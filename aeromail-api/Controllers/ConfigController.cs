using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConfigController : ControllerBase
{
    /// <summary>
    /// Public endpoint — no authentication required.
    /// Returns white-label branding configuration driven by environment variables.
    /// Environment variables:
    ///   AEROMAIL_APP_NAME      (default: "AeroMail")
    ///   AEROMAIL_PRIMARY_COLOR (default: "#00BCD4")
    ///   AEROMAIL_LOGO_URL      (default: null)
    ///   AEROMAIL_FAVICON_URL   (default: null)
    /// </summary>
    [HttpGet]
    [AllowAnonymous]
    public IActionResult GetConfig()
    {
        var appName      = Environment.GetEnvironmentVariable("AEROMAIL_APP_NAME")      ?? "AeroMail";
        var primaryColor = Environment.GetEnvironmentVariable("AEROMAIL_PRIMARY_COLOR") ?? "#00BCD4";
        var logoUrl      = Environment.GetEnvironmentVariable("AEROMAIL_LOGO_URL");
        var faviconUrl   = Environment.GetEnvironmentVariable("AEROMAIL_FAVICON_URL");

        return Ok(new
        {
            appName,
            primaryColor,
            logoUrl,
            faviconUrl,
            themeColor = primaryColor,
        });
    }
}
