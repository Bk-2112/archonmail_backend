using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeamArchon.Mail.Api.Models;
using TeamArchon.Mail.Api.Services;

namespace TeamArchon.Mail.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController : ControllerBase
{
    private readonly UserRepository _userRepo;
    private readonly IDiscordLogService _discordLogger;

    public AdminController(UserRepository userRepo, IDiscordLogService discordLogger)
    {
        _userRepo = userRepo;
        _discordLogger = discordLogger;
    }

    [HttpGet("mailboxes")]
    public async Task<IActionResult> GetMailboxes()
    {
        var mailboxes = await _userRepo.GetAllMailboxesAsync();
        return Ok(mailboxes);
    }

    [HttpPost("mailboxes")]
    public async Task<IActionResult> CreateOrUpdateMailbox([FromBody] MailboxRecord req)
    {
        if (string.IsNullOrWhiteSpace(req.Email))
            return BadRequest(new { message = "Email is required." });

        var mailbox = await _userRepo.CreateOrUpdateMailboxAsync(req);
        _discordLogger.LogSystem("Mailbox Configured", $"Admin configured mailbox **{mailbox.Email}**.");
        return Ok(mailbox);
    }

    [HttpDelete("mailboxes/{id:guid}")]
    public async Task<IActionResult> DeleteMailbox(Guid id)
    {
        var ok = await _userRepo.DeleteMailboxAsync(id);
        return ok ? Ok(new { success = true }) : NotFound();
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _userRepo.GetAllUsersAsync();
        return Ok(users);
    }

    [HttpPost("assign")]
    public async Task<IActionResult> AssignMailbox([FromBody] AssignMailboxRequest req)
    {
        var ok = await _userRepo.AssignUserMailboxAsync(req.UserId, req.MailboxId, req.Role);
        return ok ? Ok(new { success = true }) : BadRequest();
    }
}

public class AssignMailboxRequest
{
    public Guid UserId { get; set; }
    public Guid MailboxId { get; set; }
    public string Role { get; set; } = "member";
}
