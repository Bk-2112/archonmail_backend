using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using MimeKit;
using TeamArchon.Mail.Api.Models;

namespace TeamArchon.Mail.Api.Services;

public class StalwartMailService
{
    private readonly EncryptionService _encryption;
    private readonly IDiscordLogService _discordLogger;
    private readonly ILogger<StalwartMailService> _logger;

    public StalwartMailService(
        EncryptionService encryption,
        IDiscordLogService discordLogger,
        ILogger<StalwartMailService> logger)
    {
        _encryption = encryption;
        _discordLogger = discordLogger;
        _logger = logger;
    }

    public async Task<List<EmailSummaryDto>> GetFolderMessagesAsync(MailboxRecord mailbox, string folderName = "INBOX", int limit = 50)
    {
        using var client = new ImapClient();
        client.ServerCertificateValidationCallback = (s, c, h, e) => true;

        var plainPassword = _encryption.Decrypt(mailbox.EncryptedPassword);
        var options = mailbox.ImapSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;

        await client.ConnectAsync(mailbox.ImapHost, mailbox.ImapPort, options);
        await client.AuthenticateAsync(mailbox.Email, plainPassword);

        var folder = await client.GetFolderAsync(folderName) ?? client.Inbox;
        await folder.OpenAsync(FolderAccess.ReadOnly);

        var count = folder.Count;
        var results = new List<EmailSummaryDto>();

        if (count == 0)
        {
            await client.DisconnectAsync(true);
            return results;
        }

        var startIndex = Math.Max(0, count - limit);
        var uids = await folder.SearchAsync(SearchQuery.All);
        var targetUids = uids.Skip(startIndex).Take(limit).Reverse().ToList();

        var summaries = await folder.FetchAsync(targetUids, MessageSummaryItems.UniqueId | MessageSummaryItems.Envelope | MessageSummaryItems.Flags | MessageSummaryItems.BodyStructure);

        foreach (var s in summaries)
        {
            var from = s.Envelope.From.Mailboxes.FirstOrDefault();
            results.Add(new EmailSummaryDto
            {
                Id = s.UniqueId.ToString(),
                Uid = s.UniqueId.Id,
                Subject = s.Envelope.Subject ?? "(No Subject)",
                From = from?.Address ?? "(Unknown)",
                FromName = from?.Name ?? from?.Address ?? "(Unknown)",
                To = string.Join(", ", s.Envelope.To.Mailboxes.Select(x => x.Address)),
                Date = s.Envelope.Date?.UtcDateTime ?? DateTime.UtcNow,
                IsRead = s.Flags?.HasFlag(MessageFlags.Seen) ?? false,
                IsStarred = s.Flags?.HasFlag(MessageFlags.Flagged) ?? false,
                HasAttachments = s.Attachments.Any(),
                Snippet = s.Envelope.Subject ?? string.Empty
            });
        }

        await client.DisconnectAsync(true);
        return results;
    }

    public async Task<EmailDetailDto?> GetMessageDetailAsync(MailboxRecord mailbox, string folderName, uint uid)
    {
        using var client = new ImapClient();
        client.ServerCertificateValidationCallback = (s, c, h, e) => true;

        var plainPassword = _encryption.Decrypt(mailbox.EncryptedPassword);
        var options = mailbox.ImapSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;

        await client.ConnectAsync(mailbox.ImapHost, mailbox.ImapPort, options);
        await client.AuthenticateAsync(mailbox.Email, plainPassword);

        var folder = await client.GetFolderAsync(folderName) ?? client.Inbox;
        await folder.OpenAsync(FolderAccess.ReadWrite);

        var mimeMessage = await folder.GetMessageAsync(new UniqueId(uid));
        if (mimeMessage == null)
        {
            await client.DisconnectAsync(true);
            return null;
        }

        // Mark as seen
        await folder.AddFlagsAsync(new UniqueId(uid), MessageFlags.Seen, true);

        var from = mimeMessage.From.Mailboxes.FirstOrDefault();
        var detail = new EmailDetailDto
        {
            Id = uid.ToString(),
            Uid = uid,
            Subject = mimeMessage.Subject ?? "(No Subject)",
            From = from?.Address ?? "(Unknown)",
            FromName = from?.Name ?? from?.Address ?? "(Unknown)",
            To = string.Join(", ", mimeMessage.To.Mailboxes.Select(x => x.Address)),
            Date = mimeMessage.Date.UtcDateTime,
            IsRead = true,
            HtmlBody = mimeMessage.HtmlBody ?? mimeMessage.TextBody,
            TextBody = mimeMessage.TextBody,
            HasAttachments = mimeMessage.Attachments.Any()
        };

        foreach (var att in mimeMessage.Attachments)
        {
            detail.Attachments.Add(new EmailAttachmentDto
            {
                FileName = att.ContentDisposition?.FileName ?? "attachment",
                ContentType = att.ContentType.MimeType,
                Size = att switch
                {
                    MimePart part => part.Content?.Stream.Length ?? 0,
                    _ => 0
                }
            });
        }

        await client.DisconnectAsync(true);
        return detail;
    }

    public async Task<bool> SendEmailAsync(MailboxRecord mailbox, SendEmailRequest req, string senderDiscordUsername)
    {
        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(mailbox.DisplayName ?? mailbox.Email, mailbox.Email));

            foreach (var to in req.To.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                message.To.Add(MailboxAddress.Parse(to.Trim()));
            }

            if (!string.IsNullOrEmpty(req.Cc))
            {
                foreach (var cc in req.Cc.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
                    message.Cc.Add(MailboxAddress.Parse(cc.Trim()));
            }

            message.Subject = req.Subject;

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = req.BodyHtml,
                TextBody = req.BodyText ?? req.BodyHtml
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            var plainPassword = _encryption.Decrypt(mailbox.EncryptedPassword);
            var options = mailbox.SmtpSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;

            await client.ConnectAsync(mailbox.SmtpHost, mailbox.SmtpPort, options);
            await client.AuthenticateAsync(mailbox.Email, plainPassword);

            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            // 100% Categorized Logging to #mail-logs Webhook
            _discordLogger.LogMail(
                "Email Dispatched",
                mailbox.Email,
                req.To,
                req.Subject,
                $"Sent by {senderDiscordUsername}");

            return true;
        }
        catch (Exception ex)
        {
            _discordLogger.LogError($"SMTP Send Failure from {mailbox.Email}", ex, user: senderDiscordUsername);
            throw;
        }
    }
}
