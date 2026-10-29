using System.Security.Claims;
using AeroMail.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;

namespace AeroMail.Api.Tests;

/// <summary>
/// Tests for AuthService: AES-256 encryption/decryption and JWT generation.
/// Note: ValidateCredentialsAsync requires a live IMAP server — tested separately via integration.
/// </summary>
public class AuthServiceTests
{
    private static IConfiguration BuildConfig(string? aesKey = null, string? jwtSecret = null) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Aes:Key"]        = aesKey ?? "TestAesKey32BytesExactlyForTesting",
                ["Jwt:Secret"]     = jwtSecret ?? "SuperSecretJwtKeyWith32Characters!!",
                ["Jwt:Issuer"]     = "aeromail-test",
                ["Jwt:Audience"]   = "aeromail-test-users",
                ["Jwt:ExpiryHours"] = "24",
            })
            .Build();

    private static AuthService CreateService(string? aesKey = null) =>
        new(BuildConfig(aesKey));

    // ─── Encrypt / Decrypt ────────────────────────────────────────────────────

    [Fact]
    public void Encrypt_ThenDecrypt_ReturnsOriginalPlaintext()
    {
        var svc = CreateService();
        const string original = "my-secret-password";

        var cipher = svc.Encrypt(original);
        var decrypted = svc.Decrypt(cipher);

        decrypted.Should().Be(original);
    }

    [Fact]
    public void Encrypt_ProducesBase64String()
    {
        var svc = CreateService();

        var cipher = svc.Encrypt("hello");

        var bytes = Convert.FromBase64String(cipher); // throws if invalid
        bytes.Should().NotBeEmpty();
    }

    [Fact]
    public void Encrypt_TwoCalls_ProduceDifferentCiphertexts()
    {
        // AES with random IV means same plaintext → different cipher each call
        var svc = CreateService();

        var c1 = svc.Encrypt("password");
        var c2 = svc.Encrypt("password");

        c1.Should().NotBe(c2);
    }

    [Fact]
    public void Decrypt_InvalidBase64_Throws()
    {
        var svc = CreateService();
        var act = () => svc.Decrypt("not-valid-base64!!!");
        act.Should().Throw<Exception>();
    }

    [Fact]
    public void Encrypt_EmptyString_WorksRoundTrip()
    {
        var svc = CreateService();
        var cipher = svc.Encrypt(string.Empty);
        svc.Decrypt(cipher).Should().Be(string.Empty);
    }

    [Fact]
    public void Encrypt_SpecialCharacters_WorksRoundTrip()
    {
        var svc = CreateService();
        const string special = "pässwörd!@#$%^&*()_+";
        var cipher = svc.Encrypt(special);
        svc.Decrypt(cipher).Should().Be(special);
    }

    // ─── JWT Generation ───────────────────────────────────────────────────────

    [Fact]
    public void GenerateToken_ReturnsNonEmptyString()
    {
        var svc = CreateService();

        var token = svc.GenerateToken(
            Guid.NewGuid(), "user@example.com",
            "imap.example.com", 993, true,
            "smtp.example.com", 587, false,
            "encryptedpwd"
        );

        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void GenerateToken_IsValidJwtFormat()
    {
        var svc = CreateService();

        var token = svc.GenerateToken(
            Guid.NewGuid(), "user@example.com",
            "imap.example.com", 993, true,
            "smtp.example.com", 587, false,
            "encryptedpwd"
        );

        // A JWT has exactly 3 base64url parts separated by dots
        var parts = token.Split('.');
        parts.Should().HaveCount(3);
    }

    [Fact]
    public void GenerateToken_MissingJwtSecret_Throws()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Aes:Key"] = "TestAesKey32BytesExactlyForTesting",
                // No Jwt:Secret
            })
            .Build();

        var svc = new AuthService(config);

        var act = () => svc.GenerateToken(
            Guid.NewGuid(), "user@example.com",
            "imap.example.com", 993, true,
            "smtp.example.com", 587, false,
            "encryptedpwd"
        );

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Jwt:Secret*");
    }

    // ─── DecryptCredentials ───────────────────────────────────────────────────

    [Fact]
    public void DecryptCredentials_ValidClaims_ReturnsExpectedValues()
    {
        var svc = CreateService();
        const string password = "securepassword";
        const string email = "test@example.com";

        var encrypted = svc.Encrypt(password);

        // DecryptCredentials looks for ClaimTypes.Email (full URI) or "email" fallback
        var claims = new[]
        {
            new Claim(ClaimTypes.Email, email),
            new Claim("imap_host", "imap.example.com"),
            new Claim("imap_port", "993"),
            new Claim("imap_ssl", "true"),
            new Claim("enc_pwd", encrypted),
        };
        var identity = new ClaimsIdentity(claims, "Test");
        var principal = new ClaimsPrincipal(identity);

        var (outEmail, host, port, ssl, pwd) = svc.DecryptCredentials(principal);

        outEmail.Should().Be(email);
        host.Should().Be("imap.example.com");
        port.Should().Be(993);
        ssl.Should().BeTrue();
        pwd.Should().Be(password);
    }

    [Fact]
    public void DecryptCredentials_MissingClaim_Throws()
    {
        var svc = CreateService();
        // Missing imap_host claim — should throw UnauthorizedAccessException
        var claims = new[]
        {
            new Claim(ClaimTypes.Email, "user@example.com"),
            new Claim("imap_port", "993"),
            new Claim("imap_ssl", "true"),
            new Claim("enc_pwd", svc.Encrypt("pwd")),
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));

        var act = () => svc.DecryptCredentials(principal);
        act.Should().Throw<UnauthorizedAccessException>();
    }

    [Fact]
    public void FullRoundTrip_EncryptInTokenDecryptFromClaims()
    {
        var svc = CreateService();
        const string password = "myP@ssword123";
        const string email = "user@example.com";

        var encrypted = svc.Encrypt(password);
        var claims = new[]
        {
            new Claim(ClaimTypes.Email, email),
            new Claim("imap_host", "mail.aeroverra.com"),
            new Claim("imap_port", "993"),
            new Claim("imap_ssl", "true"),
            new Claim("enc_pwd", encrypted),
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"));

        var (_, _, _, _, decryptedPwd) = svc.DecryptCredentials(principal);
        decryptedPwd.Should().Be(password);
    }
}
