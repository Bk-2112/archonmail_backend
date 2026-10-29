using System.Security.Claims;
using AeroMail.Api.Models;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using MailKit.Security;
using MimeKit;

namespace AeroMail.Api.Services;

/// <summary>
/// Full IMAP service using MailKit.
/// Credentials are provided per-call (extracted from JWT by AuthService).
/// </summary>
public class ImapService : IImapService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly AuthService _authService;

    public ImapService(IHttpContextAccessor httpContextAccessor, AuthService authService)
    {
        _httpContextAccessor = httpContextAccessor;
        _authService = authService;
    }

    // ─── Connection ───────────────────────────────────────────────────────────

    /// <summary>
    /// Connect to IMAP server and authenticate. Caller is responsible for disposing.
    /// </summary>

    public async Task<ImapClient> ConnectAsync(string host, int port, bool ssl, string email, string password)
    {
        var client = new ImapClient();

        // Accept self-signed certificates (common for internal/private mail servers).
        client.ServerCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) => true;
        client.CheckCertificateRevocation = false;

        var options = ssl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
        await client.ConnectAsync(host, port, options);
        await client.AuthenticateAsync(email, password);
        return client;
    }

    // ─── Internal helper: get credentials from JWT ───────────────────────────

    private async Task<ImapClient> ConnectFromJwtAsync()
    {
        var user = _httpContextAccessor.HttpContext?.User
            ?? throw new UnauthorizedAccessException("No HTTP context.");
        var (email, host, port, ssl, password) = _authService.DecryptCredentials(user);
        return await ConnectAsync(host, port, ssl, email, password);
    }

    // ─── Folders ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Get list of all mailbox/folder names.
    /// </summary>
    public async Task<List<string>> GetFoldersAsync(ImapClient client)
    {
        var ns = client.PersonalNamespaces.FirstOrDefault();
        if (ns == null)
            return new List<string>();

        var folders = await client.GetFoldersAsync(ns);
        return folders.Select(f => f.FullName).ToList();
    }

    // ─── Messages (metadata) ─────────────────────────────────────────────────

    /// <summary>
    /// Fetch message metadata (no body) from a folder. Newest first, with offset paging.
    /// </summary>
    public async Task<List<AeroMessage>> GetMessagesAsync(ImapClient client, string folder = "INBOX", int limit = 50, int offset = 0)
    {
        var mailbox = await client.GetFolderAsync(folder);
        await mailbox.OpenAsync(FolderAccess.ReadOnly);

        var total = mailbox.Count;
        if (total == 0)
        {
            await mailbox.CloseAsync();
            return new List<AeroMessage>();
        }

        // Sequence-number range for newest-first paging
        // Newest = index (total-1), oldest = index 0
        // Page window: skip `offset` from the newest end
        var endIdx = total - 1 - offset;
        var startIdx = Math.Max(0, endIdx - limit + 1);

        if (endIdx < 0)
        {
            await mailbox.CloseAsync();
            return new List<AeroMessage>();
        }

        var fetchItems = MessageSummaryItems.UniqueId
            | MessageSummaryItems.Envelope
            | MessageSummaryItems.Flags
            | MessageSummaryItems.PreviewText
            | MessageSummaryItems.Headers;

        var summaries = await mailbox.FetchAsync(startIdx, endIdx, fetchItems);
        await mailbox.CloseAsync();

        // Return newest first
        return summaries
            .OrderByDescending(s => s.Envelope?.Date ?? DateTimeOffset.MinValue)
            .Select(s => MapToAeroMessage(s, folder))
            .ToList();
    }

    // ─── Message body ─────────────────────────────────────────────────────────

    /// <summary>
    /// Fetch the full HTML (or text) body of a message by UID.
    /// </summary>
    public async Task<string?> GetMessageBodyAsync(ImapClient client, string folder, uint uid)
    {
        var mailbox = await client.GetFolderAsync(folder);
        await mailbox.OpenAsync(FolderAccess.ReadOnly);

        var message = await mailbox.GetMessageAsync(new UniqueId(uid));
        await mailbox.CloseAsync();

        return message.HtmlBody ?? message.TextBody;
    }

    // ─── Search ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Search messages by subject, from, or body containing the query string.
    /// </summary>
    public async Task<List<AeroMessage>> SearchAsync(ImapClient client, string query, string folder = "INBOX")
    {
        var mailbox = await client.GetFolderAsync(folder);
        await mailbox.OpenAsync(FolderAccess.ReadOnly);

        var searchQuery = SearchQuery.Or(
            SearchQuery.SubjectContains(query),
            SearchQuery.Or(
                SearchQuery.FromContains(query),
                SearchQuery.BodyContains(query)
            )
        );

        var uids = await mailbox.SearchAsync(searchQuery);
        if (uids.Count == 0)
        {
            await mailbox.CloseAsync();
            return new List<AeroMessage>();
        }

        var fetchItems = MessageSummaryItems.UniqueId
            | MessageSummaryItems.Envelope
            | MessageSummaryItems.Flags
            | MessageSummaryItems.PreviewText;

        var summaries = await mailbox.FetchAsync(uids, fetchItems);
        await mailbox.CloseAsync();

        return summaries
            .OrderByDescending(s => s.Envelope?.Date ?? DateTimeOffset.MinValue)
            .Select(s => MapToAeroMessage(s, folder))
            .ToList();
    }

    // ─── Flags ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Mark a message as read or unread via the \Seen flag.
    /// </summary>
    public async Task SetReadAsync(ImapClient client, string folder, uint uid, bool isRead)
    {
        var mailbox = await client.GetFolderAsync(folder);
        await mailbox.OpenAsync(FolderAccess.ReadWrite);

        var uniqueId = new UniqueId(uid);
        if (isRead)
            await mailbox.AddFlagsAsync(new[] { uniqueId }, MessageFlags.Seen, true);
        else
            await mailbox.RemoveFlagsAsync(new[] { uniqueId }, MessageFlags.Seen, true);

        await mailbox.CloseAsync();
    }

    // ─── Move ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Move a message from one folder to another (IMAP MOVE or COPY+EXPUNGE).
    /// </summary>
    public async Task MoveMessageAsync(ImapClient client, string folder, uint uid, string destinationFolder)
    {
        var source = await client.GetFolderAsync(folder);
        var dest = await client.GetFolderAsync(destinationFolder);
        await source.OpenAsync(FolderAccess.ReadWrite);

        // MoveToAsync uses IMAP MOVE if available, otherwise COPY + STORE \Deleted + EXPUNGE
        await source.MoveToAsync(new[] { new UniqueId(uid) }, dest);

        await source.CloseAsync();
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Permanently delete a message (set \Deleted + EXPUNGE).
    /// </summary>
    public async Task DeleteMessageAsync(ImapClient client, string folder, uint uid)
    {
        var mailbox = await client.GetFolderAsync(folder);
        await mailbox.OpenAsync(FolderAccess.ReadWrite);

        await mailbox.AddFlagsAsync(new[] { new UniqueId(uid) }, MessageFlags.Deleted, true);
        await mailbox.ExpungeAsync();
        await mailbox.CloseAsync();
    }

    // ─── IImapService interface (JWT-based wrappers) ──────────────────────────

    public async Task<IEnumerable<AeroMessage>> GetMessagesAsync(string folder, int page, int pageSize)
    {
        using var client = await ConnectFromJwtAsync();
        var offset = (page - 1) * pageSize;
        return await GetMessagesAsync(client, folder, pageSize, offset);
    }

    public async Task<AeroMessage?> GetMessageAsync(uint uid, string folder)
    {
        using var client = await ConnectFromJwtAsync();
        var mailbox = await client.GetFolderAsync(folder);
        await mailbox.OpenAsync(FolderAccess.ReadOnly);

        var summaries = await mailbox.FetchAsync(
            new[] { new UniqueId(uid) },
            MessageSummaryItems.UniqueId | MessageSummaryItems.Envelope | MessageSummaryItems.Flags
        );
        if (summaries.Count == 0)
        {
            await mailbox.CloseAsync();
            return null;
        }

        var body = await GetMessageBodyAsync(client, folder, uid);
        var result = MapToAeroMessage(summaries[0], folder);
        result = result with { Body = body ?? "" };

        await mailbox.CloseAsync();
        return result;
    }

    public async Task<IEnumerable<AeroMessage>> SearchMessagesAsync(string query)
    {
        using var client = await ConnectFromJwtAsync();
        return await SearchAsync(client, query);
    }

    public async Task<IEnumerable<FolderInfo>> GetFoldersAsync()
    {
        using var client = await ConnectFromJwtAsync();
        var ns = client.PersonalNamespaces.FirstOrDefault();
        if (ns == null) return Enumerable.Empty<FolderInfo>();

        var folders = await client.GetFoldersAsync(ns);
        var result = new List<FolderInfo>();
        foreach (var f in folders)
        {
            try
            {
                await f.StatusAsync(StatusItems.Count | StatusItems.Unread);
                result.Add(new FolderInfo(f.Name, f.FullName, f.Unread, f.Count));
            }
            catch
            {
                result.Add(new FolderInfo(f.Name, f.FullName, 0, 0));
            }
        }
        return result;
    }

    public async Task UpdateFlagsAsync(uint uid, string folder, string[] flags, bool add)
    {
        using var client = await ConnectFromJwtAsync();
        var mailbox = await client.GetFolderAsync(folder);
        await mailbox.OpenAsync(FolderAccess.ReadWrite);

        var messageFlags = MessageFlags.None;
        foreach (var flag in flags)
        {
            if (flag.Equals("Seen", StringComparison.OrdinalIgnoreCase)) messageFlags |= MessageFlags.Seen;
            if (flag.Equals("Flagged", StringComparison.OrdinalIgnoreCase)) messageFlags |= MessageFlags.Flagged;
            if (flag.Equals("Draft", StringComparison.OrdinalIgnoreCase)) messageFlags |= MessageFlags.Draft;
        }

        if (add)
            await mailbox.AddFlagsAsync(new[] { new UniqueId(uid) }, messageFlags, true);
        else
            await mailbox.RemoveFlagsAsync(new[] { new UniqueId(uid) }, messageFlags, true);

        await mailbox.CloseAsync();
    }

    public async Task MoveMessageAsync(uint uid, string fromFolder, string toFolder)
    {
        using var client = await ConnectFromJwtAsync();
        await MoveMessageAsync(client, fromFolder, uid, toFolder);
    }

    public async Task DeleteMessageAsync(uint uid, string folder)
    {
        using var client = await ConnectFromJwtAsync();
        await DeleteMessageAsync(client, folder, uid);
    }

    // ─── Mapping helper ───────────────────────────────────────────────────────

    private static AeroMessage MapToAeroMessage(IMessageSummary summary, string folder)
    {
        var env = summary.Envelope;
        var fromMailbox = env?.From?.Mailboxes.FirstOrDefault();
        return new AeroMessage(
            Uid: summary.UniqueId.Id,
            MessageId: env?.MessageId ?? "",
            Subject: env?.Subject ?? "(no subject)",
            From: fromMailbox?.Address ?? "",
            FromName: fromMailbox?.Name ?? fromMailbox?.Address ?? "",
            To: env?.To?.Mailboxes.Select(m => m.Address).ToArray() ?? Array.Empty<string>(),
            Date: env?.Date?.UtcDateTime ?? DateTime.UtcNow,
            IsRead: summary.Flags?.HasFlag(MessageFlags.Seen) ?? false,
            IsStarred: summary.Flags?.HasFlag(MessageFlags.Flagged) ?? false,
            Snippet: summary.PreviewText ?? "",
            Body: "",
            Folder: folder,
            Labels: Array.Empty<string>()
        )
        {
            HasAttachments = summary.Attachments?.Any() ?? false,
            ThreadId = env?.InReplyTo ?? env?.MessageId
        };
    }
}
