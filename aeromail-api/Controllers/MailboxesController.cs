using System.Security.Claims;
using AeroMail.Api.Models;
using AeroMail.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/mailboxes")]
[Authorize]
public class MailboxesController : ControllerBase
{
    private readonly IMailboxService _mailboxService;
    private readonly ILogger<MailboxesController> _logger;

    public MailboxesController(IMailboxService mailboxService, ILogger<MailboxesController> logger)
    {
        _mailboxService = mailboxService;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/mailboxes
    /// Returns all approved mailboxes assigned to the authenticated Supabase user.
    /// Never returns passwords or secrets.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMailboxes()
    {
        var userId = MailboxService.ExtractUserId(User);
        var mailboxes = await _mailboxService.GetMailboxesForUserAsync(userId);
        return Ok(mailboxes);
    }

    /// <summary>
    /// GET /api/mailboxes/profile
    /// Returns the authenticated user's profile and active mailbox assignments.
    /// </summary>
    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var profile = await _mailboxService.GetOrCreateUserProfileAsync(User);
        return Ok(profile);
    }

    /// <summary>
    /// POST /api/mailboxes
    /// Create a new mailbox on teamarchon.in.
    /// Password is encrypted on the server and stored in Supabase PostgreSQL.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateMailbox([FromBody] CreateMailboxRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "Email and password are required." });

        var userId = MailboxService.ExtractUserId(User);
        var created = await _mailboxService.CreateMailboxAsync(request, userId);
        return Ok(created);
    }

    /// <summary>
    /// POST /api/mailboxes/assign
    /// Assign mailbox access to a user with approval status.
    /// </summary>
    [HttpPost("assign")]
    public async Task<IActionResult> AssignMailbox([FromBody] AssignMailboxRequest request)
    {
        var userId = MailboxService.ExtractUserId(User);
        await _mailboxService.AssignMailboxAsync(request, userId);
        return Ok(new { success = true, message = "Mailbox assignment updated." });
    }
}
