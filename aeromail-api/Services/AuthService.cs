using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AeroMail.Api.Models;
using MailKit.Net.Imap;
using MailKit.Security;
using Microsoft.IdentityModel.Tokens;

namespace AeroMail.Api.Services;

/// <summary>
/// JWT + IMAP credential management service.
/// Passwords are AES-256 encrypted before embedding in the JWT.
/// </summary>
public class AuthService : IAuthService
{
    private readonly IConfiguration _config;

    // AES key: 32-byte (256-bit) key from config/env
    private readonly byte[] _aesKey;

    public AuthService(IConfiguration config)
    {
        _config = config;
        var rawKey = config["Aes:Key"] ?? Environment.GetEnvironmentVariable("AES_KEY") ?? "CHANGE_THIS_32_BYTE_AES_KEY_____";
        // Ensure exactly 32 bytes (pad or truncate)
        var keyBytes = Encoding.UTF8.GetBytes(rawKey);
        _aesKey = new byte[32];
        Buffer.BlockCopy(keyBytes, 0, _aesKey, 0, Math.Min(keyBytes.Length, 32));
    }

    // ─── Credential Validation ────────────────────────────────────────────────

    /// <summary>
    /// Validate IMAP credentials by actually connecting to the server.
    /// </summary>
    // SHA-256 fingerprint of the known mail.aeroverra.com self-signed cert (mailcow internal CA).
    // Pinned to prevent acceptance of arbitrary self-signed certs on other hosts.
    // Update this value if the cert is renewed.
    private const string KnownCertFingerprint = "7AD0C5F679C7AEA66DAB478D3E09BB796125 65AB67ACA5C52250E1A08B1F60F9";

    public async Task<bool> ValidateCredentialsAsync(string host, int port, bool ssl, string email, string password)
    {
        using var client = new ImapClient();

        // Use default OS cert validation. Additionally accept the known self-signed cert
        // by fingerprint pinning — prevents MITM while supporting self-hosted mailcow.
        client.ServerCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) =>
        {
            if (sslPolicyErrors == System.Net.Security.SslPolicyErrors.None)
                return true;

            if (certificate != null)
            {
                var fingerprint = certificate.GetCertHashString(System.Security.Cryptography.HashAlgorithmName.SHA256);
                var normalizedPin = KnownCertFingerprint.Replace(" ", "").Replace(":", "").ToUpperInvariant();
                var normalizedActual = fingerprint?.Replace(":", "").ToUpperInvariant() ?? "";
                if (normalizedActual == normalizedPin)
                    return true;
            }

            return false;
        };

        try
        {
            var options = ssl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTlsWhenAvailable;
            await client.ConnectAsync(host, port, options);
            await client.AuthenticateAsync(email, password);
            return true;
        }
        catch
        {
            return false;
        }
        finally
        {
            if (client.IsConnected)
                await client.DisconnectAsync(true);
        }
    }

    // ─── Token Generation ─────────────────────────────────────────────────────

    /// <summary>
    /// Generate a JWT token with encrypted IMAP/SMTP credentials embedded in claims.
    /// </summary>
    public string GenerateToken(
        Guid accountId,
        string email,
        string imapHost,
        int imapPort,
        bool imapSsl,
        string smtpHost,
        int smtpPort,
        bool smtpSsl,
        string encryptedPassword)
    {
        var secret = _config["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt:Secret not configured.");
        var issuer = _config["Jwt:Issuer"] ?? "aeromail";
        var audience = _config["Jwt:Audience"] ?? "aeromail-users";
        var expiryHours = int.TryParse(_config["Jwt:ExpiryHours"], out var h) ? h : 24;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, accountId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("imap_host", imapHost),
            new Claim("imap_port", imapPort.ToString()),
            new Claim("imap_ssl", imapSsl.ToString().ToLower()),
            new Claim("smtp_host", smtpHost),
            new Claim("smtp_port", smtpPort.ToString()),
            new Claim("smtp_ssl", smtpSsl.ToString().ToLower()),
            new Claim("enc_pwd", encryptedPassword),
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(expiryHours),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ─── Credential Extraction ────────────────────────────────────────────────

    /// <summary>
    /// Extract and decrypt IMAP credentials from JWT claims.
    /// Returns (email, host, port, ssl, password).
    /// </summary>
    public (string email, string host, int port, bool ssl, string password) DecryptCredentials(ClaimsPrincipal user)
    {
        string Get(string type) => user.FindFirst(type)?.Value
            ?? throw new UnauthorizedAccessException($"JWT missing claim: {type}");

        var email = Get(ClaimTypes.Email) is { } e && !string.IsNullOrEmpty(e)
            ? e
            : Get(JwtRegisteredClaimNames.Email);

        // Fallback to "email" claim name used by JwtBearer mapping
        if (string.IsNullOrEmpty(email))
            email = user.FindFirst("email")?.Value
                ?? throw new UnauthorizedAccessException("JWT missing email claim.");

        var host = Get("imap_host");
        var portStr = Get("imap_port");
        var sslStr = Get("imap_ssl");
        var encPwd = Get("enc_pwd");

        if (!int.TryParse(portStr, out var port))
            throw new UnauthorizedAccessException("JWT imap_port is not a valid integer.");

        var ssl = sslStr.Equals("true", StringComparison.OrdinalIgnoreCase);
        var password = Decrypt(encPwd);

        return (email, host, port, ssl, password);
    }

    // ─── IAuthService ─────────────────────────────────────────────────────────

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var imapHost = request.ImapHost ?? "mail.aeroverra.com";
        var imapPort = request.ImapPort ?? 993;
        var imapSsl = request.ImapSsl ?? true;
        var smtpHost = request.SmtpHost ?? imapHost.Replace("imap.", "smtp.");
        var smtpPort = request.SmtpPort ?? 587;
        var smtpSsl = request.SmtpSsl ?? false;

        var valid = await ValidateCredentialsAsync(imapHost, imapPort, imapSsl, request.Email, request.Password);
        if (!valid) return null;

        var encryptedPassword = Encrypt(request.Password);
        var accountId = Guid.NewGuid(); // Phase 4: look up from DB

        var token = GenerateToken(
            accountId,
            request.Email,
            imapHost, imapPort, imapSsl,
            smtpHost, smtpPort, smtpSsl,
            encryptedPassword
        );

        var response = new LoginResponse(token, request.Email, accountId.ToString())
        {
            User = new AeroAccount
            {
                Id = accountId,
                Email = request.Email,
                ImapHost = imapHost,
                ImapPort = imapPort,
                ImapSsl = imapSsl,
                SmtpHost = smtpHost,
                SmtpPort = smtpPort,
                SmtpSsl = smtpSsl,
            }
        };

        return response;
    }

    // In-memory token revocation. For multi-instance deployments, replace with
    // a distributed cache (Redis) or PostgreSQL revocation table.
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTimeOffset>
        _revokedTokens = new();

    public Task LogoutAsync(string jti)
    {
        if (!string.IsNullOrEmpty(jti))
            _revokedTokens[jti] = DateTimeOffset.UtcNow.AddHours(25); // keep until past max token expiry
        return Task.CompletedTask;
    }

    public bool IsTokenRevoked(string jti)
    {
        if (string.IsNullOrEmpty(jti)) return false;
        // Purge expired entries opportunistically
        var expired = _revokedTokens.Where(kv => kv.Value < DateTimeOffset.UtcNow).Select(kv => kv.Key).ToList();
        foreach (var k in expired) _revokedTokens.TryRemove(k, out _);
        return _revokedTokens.ContainsKey(jti);
    }

    // ─── AES-256 Encryption ───────────────────────────────────────────────────

    /// <summary>
    /// AES-256-CBC encrypt. Returns Base64(IV + ciphertext).
    /// </summary>
    public string Encrypt(string plaintext)
    {
        using var aes = Aes.Create();
        aes.Key = _aesKey;
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = encryptor.TransformFinalBlock(plaintextBytes, 0, plaintextBytes.Length);

        // Prepend IV to ciphertext
        var result = new byte[aes.IV.Length + ciphertext.Length];
        Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
        Buffer.BlockCopy(ciphertext, 0, result, aes.IV.Length, ciphertext.Length);

        return Convert.ToBase64String(result);
    }

    /// <summary>
    /// AES-256-CBC decrypt. Input is Base64(IV + ciphertext).
    /// </summary>
    public string Decrypt(string ciphertext)
    {
        var data = Convert.FromBase64String(ciphertext);

        using var aes = Aes.Create();
        aes.Key = _aesKey;

        // Extract IV (first 16 bytes)
        var iv = new byte[16];
        var cipher = new byte[data.Length - 16];
        Buffer.BlockCopy(data, 0, iv, 0, 16);
        Buffer.BlockCopy(data, 16, cipher, 0, cipher.Length);

        aes.IV = iv;
        using var decryptor = aes.CreateDecryptor();
        var plaintext = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
        return Encoding.UTF8.GetString(plaintext);
    }
}
