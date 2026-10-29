using AeroMail.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/messages")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly IImapService _imapService;
    private readonly SmtpService _smtpService;
    private readonly AuthService _authService;
    private readonly IMailboxService? _mailboxService;

    public MessagesController(
        IImapService imapService,
        SmtpService smtpService,
        AuthService authService,
        IMailboxService? mailboxService = null)
    {
        _imapService = imapService;
        _smtpService = smtpService;
        _authService = authService;
        _mailboxService = mailboxService;
    }

    // ─── GET /api/messages ────────────────────────────────────────────────────

    /// <summary>
    /// GET /api/messages?folder=INBOX&amp;limit=50&amp;offset=0
    /// Returns paginated list of message metadata.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMessages(
        [FromQuery] string folder = "INBOX",
        [FromQuery] int limit = 50,
        [FromQuery] int offset = 0)
    {
        // Convert offset/limit to page/pageSize for the underlying service
        var page = (offset / limit) + 1;
        var messages = await _imapService.GetMessagesAsync(folder, page, limit);
        return Ok(messages);
    }

    // ─── GET /api/messages/search ─────────────────────────────────────────────

    /// <summary>
    /// GET /api/messages/search?q=query&amp;folder=INBOX
    /// This route MUST appear before {uid} to avoid routing conflicts.
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromQuery] string folder = "INBOX")
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest(new { error = "Query parameter 'q' is required." });

        var results = await _imapService.SearchMessagesAsync(q);
        return Ok(results);
    }

    // ─── GET /api/messages/{uid} ──────────────────────────────────────────────

    /// <summary>
    /// GET /api/messages/{uid}?folder=INBOX
    /// Fetch full message with body.
    /// </summary>
    [HttpGet("{uid:long}")]
    public async Task<IActionResult> GetMessage(uint uid, [FromQuery] string folder = "INBOX")
    {
        var message = await _imapService.GetMessageAsync(uid, folder);
        if (message == null) return NotFound(new { error = "Message not found." });
        return Ok(message);
    }

    // ─── PATCH /api/messages/{uid}/read ───────────────────────────────────────

    /// <summary>
    /// PATCH /api/messages/{uid}/read?folder=INBOX
    /// Body: { isRead: bool }
    /// </summary>
    [HttpPatch("{uid:long}/read")]
    public async Task<IActionResult> SetRead(
        uint uid,
        [FromBody] SetReadRequest request,
        [FromQuery] string folder = "INBOX")
    {
        var flags = new[] { "Seen" };
        await _imapService.UpdateFlagsAsync(uid, folder, flags, request.IsRead);
        return NoContent();
    }

    // ─── DELETE /api/messages/{uid} ───────────────────────────────────────────

    /// <summary>
    /// DELETE /api/messages/{uid}?folder=INBOX
    /// Move to Trash (or expunge from Trash).
    /// </summary>
    [HttpDelete("{uid:long}")]
    public async Task<IActionResult> DeleteMessage(uint uid, [FromQuery] string folder = "INBOX")
    {
        // If already in Trash, expunge; otherwise move to Trash
        if (folder.Equals("Trash", StringComparison.OrdinalIgnoreCase) ||
            folder.EndsWith("/Trash", StringComparison.OrdinalIgnoreCase))
        {
            await _imapService.DeleteMessageAsync(uid, folder);
        }
        else
        {
            await _imapService.MoveMessageAsync(uid, folder, "Trash");
        }
        return NoContent();
    }

    // ─── POST /api/messages/send ──────────────────────────────────────────────

    /// <summary>
    /// POST /api/messages/send
    /// Body: { to, cc, subject, body, replyToUid? }
    /// </summary>
    [HttpPost("send")]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest request)
    {
        if (request.To == null || request.To.Count == 0)
            return BadRequest(new { error = "At least one recipient is required." });

        if (string.IsNullOrWhiteSpace(request.Subject))
            return BadRequest(new { error = "Subject is required." });

        try
        {
            string email;
            string fromName;
            string password;
            string smtpHost;
            int smtpPort;
            bool smtpSsl;

            if (_mailboxService != null)
            {
                var (mailbox, pass) = await _mailboxService.GetAuthorizedMailboxAsync(User);
                email = mailbox.Email;
                fromName = mailbox.DisplayName ?? email;
                password = pass;
                smtpHost = mailbox.SmtpHost;
                smtpPort = mailbox.SmtpPort;
                smtpSsl = mailbox.SmtpSsl;
            }
            else
            {
                var creds = _authService.DecryptCredentials(User);
                email = creds.email;
                fromName = email;
                password = creds.password;
                smtpHost = User.FindFirst("smtp_host")?.Value ?? "";
                var smtpPortStr = User.FindFirst("smtp_port")?.Value ?? "587";
                var smtpSslStr = User.FindFirst("smtp_ssl")?.Value ?? "false";
                smtpPort = int.TryParse(smtpPortStr, out var sp) ? sp : 587;
                smtpSsl = smtpSslStr.Equals("true", StringComparison.OrdinalIgnoreCase);
            }

            if (string.IsNullOrEmpty(smtpHost))
                return BadRequest(new { error = "SMTP server not configured. Please log in again." });

            using var smtpClient = await _smtpService.ConnectAsync(smtpHost, smtpPort, smtpSsl, email, password);

            if (request.ReplyToUid.HasValue)
            {
                // Reply mode: fetch original message and use ReplyAsync
                var original = await _imapService.GetMessageAsync(request.ReplyToUid.Value, request.ReplyToFolder ?? "INBOX");
                if (original != null)
                {
                    await _smtpService.ReplyAsync(smtpClient, original, email, fromName, request.Body ?? "");
                    await smtpClient.DisconnectAsync(true);
                    return Ok(new { status = "sent", mode = "reply" });
                }
            }

            await _smtpService.SendAsync(
                smtpClient,
                from: email,
                fromName: fromName,
                to: request.To,
                cc: request.Cc ?? new List<string>(),
                subject: request.Subject,
                body: request.Body ?? "",
                bodyIsHtml: true
            );

            await smtpClient.DisconnectAsync(true);
            return Ok(new { status = "sent" });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to send message.", detail = ex.Message });
        }
    }

    // ─── PATCH /api/messages/{uid}/flags ─────────────────────────────────────

    /// <summary>
    /// PATCH /api/messages/{uid}/flags
    /// Generic flag update (read, starred, etc.).
    /// </summary>
    [HttpPatch("{uid:long}/flags")]
    public async Task<IActionResult> UpdateFlags(
        uint uid,
        [FromBody] UpdateFlagsRequest request)
    {
        await _imapService.UpdateFlagsAsync(uid, request.Folder, request.Flags, request.Add);
        return NoContent();
    }

    // ─── POST /api/messages/{uid}/move ────────────────────────────────────────

    [HttpPost("{uid:long}/move")]
    public async Task<IActionResult> MoveMessage(uint uid, [FromBody] MoveMessageRequest request)
    {
        await _imapService.MoveMessageAsync(uid, request.FromFolder, request.ToFolder);
        return NoContent();
    }
}

// ─── Request models ───────────────────────────────────────────────────────────

public record SetReadRequest(bool IsRead);
public record UpdateFlagsRequest(string Folder, string[] Flags, bool Add);
public record MoveMessageRequest(string FromFolder, string ToFolder);

public class SendMessageRequest
{
    public List<string> To { get; set; } = new();
    public List<string>? Cc { get; set; }
    public List<string>? Bcc { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string? Body { get; set; }
    public uint? ReplyToUid { get; set; }
    public string? ReplyToFolder { get; set; }
}
