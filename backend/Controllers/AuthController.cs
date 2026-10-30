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

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> EmailLogin([FromBody] EmailLoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Email and password are required." });

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

        var user = await _userRepo.GetUserByEmailWithPasswordAsync(req.Email.Trim());
        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
        {
            _discordLogger.LogAuth("Failed Login Attempt", $"Failed email/password login for `{req.Email}` (User not found or no password set).", false);
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var isPasswordValid = PasswordHasher.VerifyPassword(req.Password, user.PasswordHash);
        if (!isPasswordValid)
        {
            _discordLogger.LogAuth("Failed Login Attempt", $"Invalid password entered for `{req.Email}`.", false, new[] { ("IP", ip ?? "Unknown") });
            return Unauthorized(new { message = "Invalid email or password." });
        }

        var mailboxes = await _userRepo.GetAssignedMailboxesAsync(user.Id);
        var token = _userRepo.GenerateJwtToken(user);

        _discordLogger.LogAuth("User Authenticated (Email/Password)", $"User **{user.Email}** successfully logged in via credentials.", true, new[]
        {
            ("Email", user.Email),
            ("IP", ip ?? "Unknown")
        });

        return Ok(new AuthResponse
        {
            Token = token,
            User = user,
            Mailboxes = mailboxes
        });
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> EmailRegister([FromBody] EmailRegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Email and password are required." });

        if (req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters." });

        var existing = await _userRepo.GetUserByEmailWithPasswordAsync(req.Email.Trim());
        if (existing != null)
            return Conflict(new { message = "An account with this email address already exists." });

        var hashedPassword = PasswordHasher.HashPassword(req.Password);
        var user = await _userRepo.CreateEmailUserAsync(req.Email.Trim(), hashedPassword, req.DisplayName);
        var mailboxes = await _userRepo.GetAssignedMailboxesAsync(user.Id);
        var token = _userRepo.GenerateJwtToken(user);

        _discordLogger.LogAuth("New User Registered", $"Account created for **{user.Email}** with hashed password credentials.", true);

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
