using AeroMail.Api.Models;
using AeroMail.Api.Services;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/setup")]
[AllowAnonymous]
public class SetupController : ControllerBase
{
    private readonly SetupService _setup;
    private readonly IImapService _imap;

    public SetupController(SetupService setup, IImapService imap)
    {
        _setup = setup;
        _imap = imap;
    }

    // GET /api/setup/status
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var configured = await _setup.IsConfiguredAsync();
        var step = await _setup.GetSetupStepAsync();
        return Ok(new SetupStatusResponse { Configured = configured, Step = step });
    }

    // POST /api/setup/configure
    [HttpPost("configure")]
    public async Task<IActionResult> Configure([FromBody] SetupConfigureRequest req)
    {
        if (await _setup.IsConfiguredAsync())
            return BadRequest(new { message = "Already configured." });

        if (string.IsNullOrWhiteSpace(req.ImapHost) || string.IsNullOrWhiteSpace(req.SmtpHost))
            return BadRequest(new { message = "IMAP host and SMTP host are required." });

        await _setup.SaveMailConfigAsync(req.ImapHost, req.ImapPort, req.SmtpHost, req.SmtpPort, req.Ssl);
        return Ok(new { message = "Mail server configuration saved.", step = 1 });
    }

    // POST /api/setup/admin
    [HttpPost("admin")]
    public async Task<IActionResult> CreateAdmin([FromBody] SetupAdminRequest req)
    {
        if (await _setup.IsConfiguredAsync())
            return BadRequest(new { message = "Already configured." });

        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Email and password are required." });

        // Mark admin created (credentials are IMAP-based; display name stored for future use)
        await _setup.MarkAdminCreatedAsync();

        return Ok(new { message = "Admin account configured.", step = 2 });
    }

    // POST /api/setup/test-connection
    [HttpPost("test-connection")]
    public async Task<IActionResult> TestConnection([FromBody] SetupTestConnectionRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ImapHost))
            return BadRequest(new { message = "IMAP host is required." });

        var imapOk = false;
        var smtpOk = false;
        string? imapError = null;
        string? smtpError = null;

        // Test IMAP
        try
        {
            using var client = new ImapClient();
            client.ServerCertificateValidationCallback = (s, c, chain, e) => true;
            var opts = req.Ssl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
            await client.ConnectAsync(req.ImapHost, req.ImapPort, opts);

            if (!string.IsNullOrWhiteSpace(req.Email) && !string.IsNullOrWhiteSpace(req.Password))
                await client.AuthenticateAsync(req.Email, req.Password);

            imapOk = client.IsConnected;
            await client.DisconnectAsync(true);
        }
        catch (Exception ex)
        {
            imapError = ex.Message;
        }

        // Test SMTP (if host provided)
        if (!string.IsNullOrWhiteSpace(req.SmtpHost))
        {
            try
            {
                using var client = new SmtpClient();
                client.ServerCertificateValidationCallback = (s, c, chain, e) => true;
                var opts = req.Ssl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
                await client.ConnectAsync(req.SmtpHost, req.SmtpPort, opts);

                if (!string.IsNullOrWhiteSpace(req.Email) && !string.IsNullOrWhiteSpace(req.Password))
                    await client.AuthenticateAsync(req.Email, req.Password);

                smtpOk = client.IsConnected;
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                smtpError = ex.Message;
            }
        }

        var success = imapOk && (string.IsNullOrWhiteSpace(req.SmtpHost) || smtpOk);

        if (success)
            await _setup.MarkConfiguredAsync();

        return Ok(new
        {
            success,
            imap = new { ok = imapOk, error = imapError },
            smtp = new { ok = smtpOk, error = smtpError },
            message = success
                ? "Connection successful. AeroMail is configured."
                : $"Connection failed. IMAP: {imapError ?? "OK"}. SMTP: {smtpError ?? "not tested"}."
        });
    }
}
