using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeamArchon.Mail.Api.Models;
using TeamArchon.Mail.Api.Services;

namespace TeamArchon.Mail.Api.Controllers;

[ApiController]
[Route("api/mail")]
[Authorize]
public class MailController : ControllerBase
{
    private readonly StalwartMailService _mailService;
    private readonly UserRepository _userRepo;
    private readonly IDiscordLogService _discordLogger;

    public MailController(
        StalwartMailService mailService,
        UserRepository userRepo,
        IDiscordLogService discordLogger)
    {
        _mailService = mailService;
        _userRepo = userRepo;
        _discordLogger = discordLogger;
    }

    private Guid GetUserId()
    {
        var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : Guid.Empty;
    }

    private string GetUsername()
    {
        return User.FindFirstValue(ClaimTypes.Name) ?? "User";
    }

    [HttpGet("boxes")]
    public async Task<IActionResult> GetMailboxes()
    {
        var userId = GetUserId();
        var boxes = await _userRepo.GetAssignedMailboxesAsync(userId);
        return Ok(boxes);
    }

    [HttpGet("messages")]
    public async Task<IActionResult> GetMessages([FromQuery] Guid mailboxId, [FromQuery] string folder = "INBOX", [FromQuery] int limit = 50)
    {
        var userId = GetUserId();
        var mailbox = await _userRepo.GetMailboxWithPasswordAsync(mailboxId, userId);
        if (mailbox == null)
            return NotFound(new { message = "Mailbox not found or access denied." });

        try
        {
            var messages = await _mailService.GetFolderMessagesAsync(mailbox, folder, limit);
            return Ok(messages);
        }
        catch (Exception ex)
        {
            _discordLogger.LogError($"IMAP Fetch Failure: {mailbox.Email}", ex, user: GetUsername());
            return StatusCode(500, new { message = "Failed to fetch messages from mail server.", error = ex.Message });
        }
    }

    [HttpGet("message/{uid:long}")]
    public async Task<IActionResult> GetMessageDetail([FromRoute] uint uid, [FromQuery] Guid mailboxId, [FromQuery] string folder = "INBOX")
    {
        var userId = GetUserId();
        var mailbox = await _userRepo.GetMailboxWithPasswordAsync(mailboxId, userId);
        if (mailbox == null)
            return NotFound(new { message = "Mailbox not found or access denied." });

        try
        {
            var detail = await _mailService.GetMessageDetailAsync(mailbox, folder, uid);
            if (detail == null)
                return NotFound(new { message = "Message not found." });

            return Ok(detail);
        }
        catch (Exception ex)
        {
            _discordLogger.LogError($"IMAP Read Detail Failure: {mailbox.Email}", ex, user: GetUsername());
            return StatusCode(500, new { message = "Failed to read message details.", error = ex.Message });
        }
    }

    [HttpPost("send")]
    public async Task<IActionResult> SendEmail([FromBody] SendEmailRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.To))
            return BadRequest(new { message = "Recipient 'To' address is required." });

        var userId = GetUserId();
        var mailbox = await _userRepo.GetMailboxWithPasswordAsync(req.MailboxId, userId);
        if (mailbox == null)
            return NotFound(new { message = "Mailbox not found or access denied." });

        try
        {
            await _mailService.SendEmailAsync(mailbox, req, GetUsername());
            return Ok(new { success = true, message = "Email dispatched successfully." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Failed to send email via SMTP.", error = ex.Message });
        }
    }
}

[ApiController]
[Route("api/system")]
[AllowAnonymous]
public class SystemController : ControllerBase
{
    private readonly DatabaseService _db;

    public SystemController(DatabaseService db)
    {
        _db = db;
    }

    [HttpGet("health")]
    public async Task<IActionResult> GetHealth()
    {
        var dbOk = await _db.TestConnectionAsync();
        return Ok(new
        {
            status = "ok",
            version = "3.0.0",
            service = "Team Archon Mail API (Ground Zero)",
            database = dbOk ? "connected" : "degraded",
            timestamp = DateTime.UtcNow
        });
    }
}
