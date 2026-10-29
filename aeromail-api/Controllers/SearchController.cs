using System.Security.Claims;
using Dapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AeroMail.Api.Database;
using AeroMail.Api.Models;
using AeroMail.Api.Services;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/search")]
[Authorize]
public class SearchController : ControllerBase
{
    private readonly IImapService _imap;
    private readonly DatabaseService _db;
    private readonly AuthService _authService;

    public SearchController(IImapService imap, DatabaseService db, AuthService authService)
    {
        _imap = imap;
        _db = db;
        _authService = authService;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Guid GetAccountId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub")
               ?? throw new UnauthorizedAccessException("Missing account id claim.");
        return Guid.Parse(sub);
    }

    // ─── GET /api/search?q=...&folder=INBOX&limit=50 ──────────────────────────

    /// <summary>
    /// Search messages using both IMAP SEARCH and PostgreSQL full-text search.
    /// Results from both sources are combined and de-duplicated by Message-ID.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromQuery] string folder = "INBOX",
        [FromQuery] int limit = 50)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest(new { error = "Query parameter 'q' is required." });

        var accountId = GetAccountId();
        var combined = new Dictionary<string, AeroMessage>(StringComparer.OrdinalIgnoreCase);

        // ── 1. IMAP SEARCH ────────────────────────────────────────────────────
        try
        {
            var (email, host, port, ssl, password) = _authService.DecryptCredentials(User);
            var imapService = (ImapService)_imap;
            using var client = await imapService.ConnectAsync(host, port, ssl, email, password);
            var imapResults = await imapService.SearchAsync(client, q, folder);

            foreach (var msg in imapResults.Take(limit))
            {
                var key = msg.MessageId ?? msg.Uid.ToString();
                combined.TryAdd(key, msg);
            }
        }
        catch (Exception ex)
        {
            // IMAP unavailable — fall through to DB-only results
            Console.WriteLine($"[SearchController] IMAP search failed: {ex.Message}");
        }

        // ── 2. PostgreSQL full-text search (cache fallback + enrichment) ──────
        try
        {
            const string sql = @"
                SELECT id            AS Id,
                       account_id    AS AccountId,
                       message_id    AS MessageId,
                       thread_id     AS ThreadId,
                       subject       AS Subject,
                       from_email    AS From,
                       from_name     AS FromName,
                       to_emails     AS To,
                       timestamp     AS Date,
                       is_read       AS IsRead,
                       is_starred    AS IsStarred,
                       snippet       AS Snippet,
                       folder        AS Folder,
                       labels        AS Labels,
                       imap_uid      AS Uid,
                       has_attachments AS HasAttachments
                FROM   messages
                WHERE  account_id = @accountId
                  AND  to_tsvector('english',
                           coalesce(subject,'') || ' ' ||
                           coalesce(snippet,'') || ' ' ||
                           coalesce(from_email,''))
                       @@ plainto_tsquery('english', @query)
                ORDER  BY timestamp DESC
                LIMIT  @limit";

            using var conn = _db.GetConnection();
            var dbRows = await conn.QueryAsync<DbMessageRow>(sql, new { accountId, query = q, limit });

            foreach (var row in dbRows)
            {
                var msg = row.ToAeroMessage();
                var key = row.MessageId ?? row.Uid.ToString();
                combined.TryAdd(key, msg);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SearchController] DB search failed: {ex.Message}");
        }

        var results = combined.Values
            .OrderByDescending(m => m.Date)
            .Take(limit)
            .ToList();

        return Ok(results);
    }

    // ─── Internal DB row shape ────────────────────────────────────────────────

    private class DbMessageRow
    {
        public Guid Id { get; set; }
        public Guid AccountId { get; set; }
        public string? MessageId { get; set; }
        public string? ThreadId { get; set; }
        public string? Subject { get; set; }
        public string From { get; set; } = string.Empty;
        public string? FromName { get; set; }
        public string? To { get; set; }          // JSONB comes back as string via Dapper
        public DateTime Date { get; set; }
        public bool IsRead { get; set; }
        public bool IsStarred { get; set; }
        public string? Snippet { get; set; }
        public string Folder { get; set; } = "INBOX";
        public string? Labels { get; set; }      // JSONB array as string
        public long Uid { get; set; }
        public bool HasAttachments { get; set; }

        public AeroMessage ToAeroMessage()
        {
            var toArr = ParseJsonArray(To);
            var labelsArr = ParseJsonArray(Labels);

            return new AeroMessage(
                Uid: (uint)Uid,
                MessageId: MessageId ?? string.Empty,
                Subject: Subject ?? "(no subject)",
                From: From,
                FromName: FromName ?? From,
                To: toArr,
                Date: Date,
                IsRead: IsRead,
                IsStarred: IsStarred,
                Snippet: Snippet ?? string.Empty,
                Body: string.Empty,
                Folder: Folder,
                Labels: labelsArr
            )
            {
                Id = Id,
                AccountId = AccountId,
                ThreadId = ThreadId,
                HasAttachments = HasAttachments
            };
        }

        private static string[] ParseJsonArray(string? json)
        {
            if (string.IsNullOrWhiteSpace(json) || json == "[]") return Array.Empty<string>();
            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
            }
            catch
            {
                return Array.Empty<string>();
            }
        }
    }
}
