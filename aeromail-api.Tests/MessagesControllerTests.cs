using System.Net;
using AeroMail.Api.Database;
using AeroMail.Api.Models;
using AeroMail.Api.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace AeroMail.Api.Tests;

/// <summary>
/// Integration tests for MessagesController using WebApplicationFactory.
/// Tests auth enforcement (401 without token) and endpoint shape.
/// All DB and IMAP dependencies are mocked to avoid external connections.
/// </summary>
public class MessagesControllerTests
{
    private static readonly IConfiguration TestConfig = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:Secret"]      = "SuperSecretJwtKeyWith32Characters!!",
            ["Jwt:Issuer"]      = "aeromail",
            ["Jwt:Audience"]    = "aeromail-users",
            ["Jwt:ExpiryHours"] = "24",
            ["Aes:Key"]         = "TestAesKey32BytesExactlyForTesting",
            // Provide a fake connection string so DatabaseService can be constructed
            ["ConnectionStrings:Default"] = "Host=localhost;Database=test;Username=test;Password=test",
        })
        .Build();

    private static Mock<IImapService> CreateDefaultImapMock()
    {
        var mock = new Mock<IImapService>();

        var messages = new List<AeroMessage>
        {
            new(1, "<msg1@example.com>", "Test Subject", "alice@example.com",
                "Alice", new[] { "bob@example.com" }, DateTime.UtcNow, false, false,
                "Snippet", "Body", "INBOX", Array.Empty<string>()),
        };

        mock.Setup(s => s.GetMessagesAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync(messages);
        mock.Setup(s => s.GetMessageAsync(It.IsAny<uint>(), It.IsAny<string>()))
            .ReturnsAsync(messages[0]);
        mock.Setup(s => s.SearchMessagesAsync(It.IsAny<string>()))
            .ReturnsAsync(messages);
        mock.Setup(s => s.GetFoldersAsync())
            .ReturnsAsync(new List<FolderInfo> { new("INBOX", "INBOX", 1, 1) });
        mock.Setup(s => s.UpdateFlagsAsync(It.IsAny<uint>(), It.IsAny<string>(), It.IsAny<string[]>(), It.IsAny<bool>()))
            .Returns(Task.CompletedTask);
        mock.Setup(s => s.MoveMessageAsync(It.IsAny<uint>(), It.IsAny<string>(), It.IsAny<string>()))
            .Returns(Task.CompletedTask);
        mock.Setup(s => s.DeleteMessageAsync(It.IsAny<uint>(), It.IsAny<string>()))
            .Returns(Task.CompletedTask);

        return mock;
    }

    /// <summary>
    /// Create a WebApplicationFactory with all external services mocked.
    /// DatabaseService is replaced with a fake that doesn't hit PostgreSQL.
    /// </summary>
    private WebApplicationFactory<Program> CreateFactory()
    {
        var imapMock = CreateDefaultImapMock();

        return new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                // Inject test config so DatabaseService gets a connection string
                builder.ConfigureAppConfiguration((ctx, cfg) =>
                {
                    cfg.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["Jwt:Secret"]      = "SuperSecretJwtKeyWith32Characters!!",
                        ["Jwt:Issuer"]      = "aeromail",
                        ["Jwt:Audience"]    = "aeromail-users",
                        ["Jwt:ExpiryHours"] = "24",
                        ["Aes:Key"]         = "TestAesKey32BytesExactlyForTesting",
                        ["ConnectionStrings:Default"] = "Host=localhost;Database=testdb;Username=test;Password=test",
                    });
                });

                builder.ConfigureServices(services =>
                {
                    // Replace DatabaseService with a no-op fake
                    ReplaceService<DatabaseService>(services, new FakeDatabaseService(TestConfig));

                    // Replace IImapService with our mock
                    ReplaceService<IImapService>(services, imapMock.Object);
                });
            });
    }

    private static void ReplaceService<T>(IServiceCollection services, T replacement) where T : class
    {
        var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(T));
        if (descriptor != null) services.Remove(descriptor);
        services.AddSingleton(replacement);
    }

    // ─── Auth enforcement: all protected routes return 401 without token ──────

    [Fact]
    public async Task GET_Messages_WithoutToken_Returns401()
    {
        using var factory = CreateFactory();
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/messages");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GET_MessageById_WithoutToken_Returns401()
    {
        using var factory = CreateFactory();
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/messages/1");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GET_Search_WithoutToken_Returns401()
    {
        using var factory = CreateFactory();
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/messages/search?q=test");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DELETE_Message_WithoutToken_Returns401()
    {
        using var factory = CreateFactory();
        var client = factory.CreateClient();
        var response = await client.DeleteAsync("/api/messages/1");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PATCH_MessageRead_WithoutToken_Returns401()
    {
        using var factory = CreateFactory();
        var client = factory.CreateClient();
        var response = await client.PatchAsync("/api/messages/1/read",
            new StringContent("{\"isRead\":true}", System.Text.Encoding.UTF8, "application/json"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ─── Public endpoints are reachable without token ─────────────────────────

    [Fact]
    public async Task GET_AuthHealth_IsPublic_Returns200()
    {
        using var factory = CreateFactory();
        var client = factory.CreateClient();
        var response = await client.GetAsync("/api/auth/health");
        // Health endpoint is [AllowAnonymous] — should return 200
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}

/// <summary>
/// A no-op DatabaseService that doesn't connect to PostgreSQL.
/// Used in tests to prevent real DB connections.
/// </summary>
internal sealed class FakeDatabaseService : DatabaseService
{
    public FakeDatabaseService(IConfiguration config) : base(config) { }

    public new Npgsql.NpgsqlConnection GetConnection() =>
        // Return a new (unconnected) NpgsqlConnection; tests that actually call DB methods will fail,
        // but the DI wiring won't blow up at startup.
        new("Host=localhost;Database=fake;Username=fake;Password=fake");

    public new Task InitializeAsync() => Task.CompletedTask;
}
