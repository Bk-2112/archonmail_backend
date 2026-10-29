using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Configuration;
using AeroMail.Api.Services;
using Xunit;

namespace AeroMail.Tests;

/// <summary>
/// Unit tests for AuthService — AES encryption/decryption and JWT generation.
/// No network calls; no database.
/// </summary>
public class AuthServiceTests
{
    private readonly AuthService _authService;

    public AuthServiceTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"]      = "CHANGE_ME_IN_PRODUCTION_MIN_32_CHARS!!",
                ["Jwt:Issuer"]      = "aeromail-test",
                ["Jwt:Audience"]    = "aeromail-users-test",
                ["Jwt:ExpiryHours"] = "1",
                ["Aes:Key"]         = "CHANGE_THIS_32_BYTE_AES_KEY_____",
            })
            .Build();

        _authService = new AuthService(config);
    }

    // ─── AES Encrypt / Decrypt ───────────────────────────────────────────────

    [Fact]
    public void Encrypt_ThenDecrypt_ReturnsOriginalPlaintext()
    {
        const string original = "my_super_secret_password!";

        var ciphertext = _authService.Encrypt(original);
        var decrypted  = _authService.Decrypt(ciphertext);

        Assert.Equal(original, decrypted);
    }

    [Fact]
    public void Encrypt_ProducesBase64Output()
    {
        var ciphertext = _authService.Encrypt("test");

        // Should not throw; if invalid Base64 Convert.FromBase64String would throw
        var bytes = Convert.FromBase64String(ciphertext);
        Assert.NotEmpty(bytes);
    }

    [Fact]
    public void Encrypt_SamePlaintextProducesDifferentCiphertext()
    {
        // AES with a random IV should produce different ciphertexts each time
        const string plaintext = "same_password";

        var ct1 = _authService.Encrypt(plaintext);
        var ct2 = _authService.Encrypt(plaintext);

        Assert.NotEqual(ct1, ct2);
    }

    [Fact]
    public void Decrypt_InvalidBase64_ThrowsFormatException()
    {
        Assert.Throws<FormatException>(() => _authService.Decrypt("not-valid-base64!!!"));
    }

    [Fact]
    public void EncryptDecrypt_EmptyString_RoundTrips()
    {
        var ct = _authService.Encrypt(string.Empty);
        var result = _authService.Decrypt(ct);
        Assert.Equal(string.Empty, result);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("a longer password with spaces and symbols !@#$%^&*()")]
    [InlineData("unicode_\u00e9\u00e0\u00fc")]
    public void EncryptDecrypt_VariousPasswords_RoundTrip(string password)
    {
        var ct = _authService.Encrypt(password);
        var result = _authService.Decrypt(ct);
        Assert.Equal(password, result);
    }

    // ─── JWT Generation ──────────────────────────────────────────────────────

    [Fact]
    public void GenerateToken_ReturnsNonEmptyString()
    {
        var token = GenerateSampleToken();
        Assert.NotNull(token);
        Assert.NotEmpty(token);
    }

    [Fact]
    public void GenerateToken_IsValidJwt()
    {
        var token = GenerateSampleToken();

        var handler = new JwtSecurityTokenHandler();
        Assert.True(handler.CanReadToken(token), "Token is not a valid JWT");

        var jwt = handler.ReadJwtToken(token);
        Assert.NotNull(jwt);
    }

    [Fact]
    public void GenerateToken_ContainsExpectedClaims()
    {
        var accountId = Guid.NewGuid();
        const string email = "test@aeromail.com";
        const string imapHost = "mail.aeromail.com";
        const int imapPort = 993;
        const string encPwd = "encrypted_placeholder";

        var token = _authService.GenerateToken(
            accountId,
            email,
            imapHost, imapPort, imapSsl: true,
            smtpHost: "smtp.aeromail.com", smtpPort: 587, smtpSsl: false,
            encryptedPassword: encPwd
        );

        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        // sub claim should contain the accountId
        var sub = jwt.Subject;
        Assert.Equal(accountId.ToString(), sub);

        // Email claim
        var emailClaim = jwt.Claims.FirstOrDefault(c =>
            c.Type == JwtRegisteredClaimNames.Email || c.Type == "email");
        Assert.NotNull(emailClaim);
        Assert.Equal(email, emailClaim!.Value);

        // IMAP host claim
        var imapHostClaim = jwt.Claims.FirstOrDefault(c => c.Type == "imap_host");
        Assert.NotNull(imapHostClaim);
        Assert.Equal(imapHost, imapHostClaim!.Value);
    }

    [Fact]
    public void GenerateToken_HasFutureExpiry()
    {
        var token = GenerateSampleToken();
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(token);

        Assert.True(jwt.ValidTo > DateTime.UtcNow, "Token should expire in the future");
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private string GenerateSampleToken() =>
        _authService.GenerateToken(
            Guid.NewGuid(),
            "user@aeromail.com",
            imapHost: "mail.aeromail.com",
            imapPort: 993,
            imapSsl: true,
            smtpHost: "smtp.aeromail.com",
            smtpPort: 587,
            smtpSsl: false,
            encryptedPassword: _authService.Encrypt("testpassword")
        );
}
