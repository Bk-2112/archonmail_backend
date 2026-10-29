using AeroMail.Api.Models;
using AeroMail.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// GET /api/auth/health — liveness probe.
    /// </summary>
    [HttpGet("health")]
    [AllowAnonymous]
    public IActionResult Health()
        => Ok(new { status = "ok", version = "2.0.0" });

    /// <summary>
    /// POST /api/auth/login
    /// Body: { email, password, imapHost, imapPort, imapSsl, smtpHost, smtpPort, smtpSsl }
    /// Returns: { token, email, user }
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "Email and password are required." });

        var response = await _authService.LoginAsync(request);
        if (response == null)
            return Unauthorized(new { error = "Invalid credentials or server unreachable." });

        return Ok(response);
    }

    /// <summary>
    /// POST /api/auth/logout — invalidates JWT (jti blocklist in Phase 4).
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        var jti = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti)?.Value ?? "";
        await _authService.LogoutAsync(jti);
        return Ok(new { success = true });
    }

    /// <summary>
    /// GET /api/auth/me — returns current user info from JWT.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        var email = User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email)?.Value
                    ?? User.FindFirst("email")?.Value
                    ?? "";
        var imapHost = User.FindFirst("imap_host")?.Value ?? "";
        var smtpHost = User.FindFirst("smtp_host")?.Value ?? "";

        return Ok(new
        {
            email,
            imapHost,
            smtpHost,
        });
    }
}
