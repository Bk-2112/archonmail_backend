using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TeamArchon.Mail.Api.Models;
using TeamArchon.Mail.Api.Services;

namespace TeamArchon.Mail.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IDiscordAuthService _discordAuth;
    private readonly UserRepository _userRepo;
    private readonly IDiscordLogService _discordLogger;

    public AuthController(
        IDiscordAuthService discordAuth,
        UserRepository userRepo,
        IDiscordLogService discordLogger)
    {
        _discordAuth = discordAuth;
        _userRepo = userRepo;
        _discordLogger = discordLogger;
    }

    [HttpPost("discord")]
    [AllowAnonymous]
    public async Task<IActionResult> DiscordLogin([FromBody] DiscordLoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { message = "OAuth code is required." });

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

        // 1. Authenticate with Discord & Enforce Guild/Role Gate
        var authResult = await _discordAuth.AuthenticateAndVerifyAsync(req.Code, req.RedirectUri);

        if (!authResult.Success || authResult.User == null)
        {
            return StatusCode(
                authResult.ErrorCode is "not_in_guild" or "missing_role" ? 403 : 400,
                new
                {
                    code = authResult.ErrorCode ?? "auth_failed",
                    message = authResult.ErrorMessage ?? "Authentication failed."
                });
        }

        // 2. Upsert User in Supabase Database
        var user = await _userRepo.UpsertDiscordUserAsync(authResult.User);

        // 3. Fetch Assigned Mailboxes
        var mailboxes = await _userRepo.GetAssignedMailboxesAsync(user.Id);

        // 4. Generate Session JWT
        var token = _userRepo.GenerateJwtToken(user);

        // 5. Categorized Logging: Log successful login to #auth-logs
        _discordLogger.LogAuth(
            "User Authenticated",
            $"User **{user.DiscordUsername}** (`{user.DiscordId}`) successfully authenticated via Discord OAuth2 and passed all role checks.",
            true,
            new[]
            {
                ("Discord Tag", user.DiscordUsername),
                ("Assigned Mailboxes", mailboxes.Count > 0 ? string.Join(", ", mailboxes.Select(m => m.Email)) : "None"),
                ("IP Address", ip ?? "Unknown")
            });

        return Ok(new AuthResponse
        {
            Token = token,
            User = user,
            Mailboxes = mailboxes
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var user = await _userRepo.GetUserByIdAsync(userId);
        if (user == null)
            return Unauthorized();

        var mailboxes = await _userRepo.GetAssignedMailboxesAsync(userId);

        return Ok(new
        {
            user,
            mailboxes
        });
    }
}
