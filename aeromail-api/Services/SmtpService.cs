using AeroMail.Api.Models;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using MimeKit.Text;

namespace AeroMail.Api.Services;

/// <summary>
/// SMTP service using MailKit for sending, replying, and forwarding email.
/// </summary>
public class SmtpService
{
    // ─── Connection ───────────────────────────────────────────────────────────

    /// <summary>
    /// Connect to SMTP server and authenticate. Caller is responsible for disposing.
    /// </summary>
    public async Task<SmtpClient> ConnectAsync(string host, int port, bool ssl, string email, string password)
    {
        var client = new SmtpClient();
        client.ServerCertificateValidationCallback = (s, c, chain, sslPolicyErrors) => true;

        // Use SSL on connect for port 465, STARTTLS for everything else
        var options = ssl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
        await client.ConnectAsync(host, port, options);
        await client.AuthenticateAsync(email, password);
        return client;
    }

    // ─── Send ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Send a new email.
    /// </summary>
    public async Task SendAsync(
        SmtpClient client,
        string from,
        string fromName,
        List<string> to,
        List<string> cc,
        string subject,
        string body,
        bool bodyIsHtml = true)
    {
        var message = BuildMessage(from, fromName, to, cc, subject, body, bodyIsHtml);
        await client.SendAsync(message);
    }

    // ─── Reply ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Send a reply. Adds In-Reply-To and References headers; prefixes "Re: " to subject once.
    /// </summary>
    public async Task ReplyAsync(
        SmtpClient client,
        AeroMessage originalMessage,
        string from,
        string fromName,
        string body)
    {
        var replySubject = NormalizeReplySubject(originalMessage.Subject);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, from));
        message.To.Add(MailboxAddress.Parse(originalMessage.From));
        message.Subject = replySubject;

        // Threading headers
        if (!string.IsNullOrEmpty(originalMessage.MessageId))
        {
            message.InReplyTo = originalMessage.MessageId;
            message.References.Add(originalMessage.MessageId);
        }

        // Build body with original quoted below
        var quotedOriginal = BuildQuotedBody(originalMessage);
        var fullBody = $"{body}\r\n\r\n{quotedOriginal}";

        message.Body = new TextPart(TextFormat.Html)
        {
            Text = fullBody
        };

        await client.SendAsync(message);
    }

    // ─── Forward ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Forward an email to new recipients with optional additional body text.
    /// </summary>
    public async Task ForwardAsync(
        SmtpClient client,
        AeroMessage originalMessage,
        string from,
        string fromName,
        List<string> to,
        string additionalBody)
    {
        var forwardSubject = NormalizeForwardSubject(originalMessage.Subject);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, from));
        foreach (var addr in to)
            message.To.Add(MailboxAddress.Parse(addr));

        message.Subject = forwardSubject;

        // Build forwarded body block
        var forwardedBlock = BuildForwardedBlock(originalMessage);
        var fullBody = string.IsNullOrWhiteSpace(additionalBody)
            ? forwardedBlock
            : $"{additionalBody}\r\n\r\n{forwardedBlock}";

        message.Body = new TextPart(TextFormat.Html)
        {
            Text = fullBody
        };

        await client.SendAsync(message);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static MimeMessage BuildMessage(
        string from,
        string fromName,
        List<string> to,
        List<string> cc,
        string subject,
        string body,
        bool bodyIsHtml)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, from));

        foreach (var addr in to.Where(a => !string.IsNullOrWhiteSpace(a)))
            message.To.Add(MailboxAddress.Parse(addr.Trim()));

        if (cc != null)
            foreach (var addr in cc.Where(a => !string.IsNullOrWhiteSpace(a)))
                message.Cc.Add(MailboxAddress.Parse(addr.Trim()));

        message.Subject = subject;
        message.Body = new TextPart(bodyIsHtml ? TextFormat.Html : TextFormat.Plain)
        {
            Text = body
        };

        return message;
    }

    /// <summary>
    /// Strip all existing Re:/Fwd:/Fw: prefixes and add exactly one "Re: ".
    /// </summary>
    private static string NormalizeReplySubject(string subject)
    {
        var stripped = System.Text.RegularExpressions.Regex.Replace(
            subject ?? "",
            @"^(Re:|Fwd?:|Fw:)\s*",
            "",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled
        ).Trim();

        // Keep stripping until fully clean (handles "Re: Re: Re: ...")
        string prev;
        do
        {
            prev = stripped;
            stripped = System.Text.RegularExpressions.Regex.Replace(
                stripped,
                @"^(Re:|Fwd?:|Fw:)\s*",
                "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            ).Trim();
        } while (stripped != prev);

        return $"Re: {stripped}";
    }

    /// <summary>
    /// Strip prefixes and add exactly one "Fwd: ".
    /// </summary>
    private static string NormalizeForwardSubject(string subject)
    {
        var stripped = System.Text.RegularExpressions.Regex.Replace(
            subject ?? "",
            @"^(Re:|Fwd?:|Fw:)\s*",
            "",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase
        ).Trim();

        string prev;
        do
        {
            prev = stripped;
            stripped = System.Text.RegularExpressions.Regex.Replace(
                stripped,
                @"^(Re:|Fwd?:|Fw:)\s*",
                "",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            ).Trim();
        } while (stripped != prev);

        return $"Fwd: {stripped}";
    }

    private static string BuildQuotedBody(AeroMessage original)
    {
        var dateStr = original.Date.ToString("ddd, MMM d, yyyy 'at' h:mm tt");
        var fromStr = string.IsNullOrEmpty(original.FromName)
            ? original.From
            : $"{original.FromName} &lt;{original.From}&gt;";

        return $"<br><br>" +
               $"<div class=\"gmail_quote\">" +
               $"<div dir=\"ltr\">On {dateStr}, {fromStr} wrote:</div>" +
               $"<blockquote style=\"margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex\">" +
               $"{original.Body}" +
               $"</blockquote></div>";
    }

    private static string BuildForwardedBlock(AeroMessage original)
    {
        var dateStr = original.Date.ToString("ddd, MMM d, yyyy 'at' h:mm tt");
        var toStr = string.Join(", ", original.To);

        return $"<br><br>" +
               $"<div class=\"gmail_quote\">" +
               $"---------- Forwarded message ---------<br>" +
               $"From: {original.FromName} &lt;{original.From}&gt;<br>" +
               $"Date: {dateStr}<br>" +
               $"Subject: {original.Subject}<br>" +
               $"To: {toStr}<br><br>" +
               $"{original.Body}" +
               $"</div>";
    }
}
