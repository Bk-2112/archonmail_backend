using System.Net.Http.Json;
using System.Threading.Channels;
using TeamArchon.Mail.Api.Models;

namespace TeamArchon.Mail.Api.Services;

public interface IDiscordLogService
{
    void EnqueueLog(LogCategory category, DiscordEmbed embed);
    void LogAuth(string title, string description, bool success, (string Name, string Value)[]? extraFields = null);
    void LogMail(string title, string from, string to, string subject, string? status = null);
    void LogError(string title, Exception ex, string? path = null, string? user = null);
    void LogSystem(string title, string description, (string Name, string Value)[]? extraFields = null);
}

public class DiscordWebhookLogger : BackgroundService, IDiscordLogService
{
    private readonly Channel<DiscordLogItem> _channel;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<DiscordWebhookLogger> _logger;

    private readonly Dictionary<LogCategory, string?> _webhookUrls = new();

    public DiscordWebhookLogger(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        ILogger<DiscordWebhookLogger> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _logger = logger;

        // Bounded channel to prevent memory leaks while guaranteeing non-blocking operations
        var options = new BoundedChannelOptions(2000)
        {
            FullMode = BoundedChannelFullMode.DropOldest
        };
        _channel = Channel.CreateBounded<DiscordLogItem>(options);

        // Load categorized webhook URLs
        _webhookUrls[LogCategory.Auth] = GetWebhookUrl("DISCORD_WEBHOOK_AUTH");
        _webhookUrls[LogCategory.Mail] = GetWebhookUrl("DISCORD_WEBHOOK_MAIL");
        _webhookUrls[LogCategory.Error] = GetWebhookUrl("DISCORD_WEBHOOK_ERROR");
        _webhookUrls[LogCategory.System] = GetWebhookUrl("DISCORD_WEBHOOK_SYSTEM");
    }

    private string? GetWebhookUrl(string envVarName)
    {
        return _config[envVarName] ?? Environment.GetEnvironmentVariable(envVarName);
    }

    public void EnqueueLog(LogCategory category, DiscordEmbed embed)
    {
        _channel.Writer.TryWrite(new DiscordLogItem { Category = category, Embed = embed });
    }

    public void LogAuth(string title, string description, bool success, (string Name, string Value)[]? extraFields = null)
    {
        var embed = new DiscordEmbed
        {
            Title = success ? $"🔐 {title}" : $"⛔ {title}",
            Description = description,
            Color = success ? 0x2ECC71 : 0xE74C3C, // Green or Red
            Timestamp = DateTime.UtcNow.ToString("o")
        };

        if (extraFields != null)
        {
            foreach (var (name, value) in extraFields)
            {
                embed.Fields.Add(new DiscordEmbedField { Name = name, Value = value, Inline = true });
            }
        }

        EnqueueLog(LogCategory.Auth, embed);
    }

    public void LogMail(string title, string from, string to, string subject, string? status = null)
    {
        var embed = new DiscordEmbed
        {
            Title = $"✉️ {title}",
            Color = 0x3498DB, // Blue
            Timestamp = DateTime.UtcNow.ToString("o"),
            Fields = new List<DiscordEmbedField>
            {
                new() { Name = "From", Value = from, Inline = true },
                new() { Name = "To", Value = to, Inline = true },
                new() { Name = "Subject", Value = string.IsNullOrWhiteSpace(subject) ? "(No Subject)" : subject, Inline = false }
            }
        };

        if (!string.IsNullOrEmpty(status))
        {
            embed.Fields.Add(new DiscordEmbedField { Name = "Status", Value = status, Inline = true });
        }

        EnqueueLog(LogCategory.Mail, embed);
    }

    public void LogError(string title, Exception ex, string? path = null, string? user = null)
    {
        var embed = new DiscordEmbed
        {
            Title = $"🚨 {title}",
            Description = $"**Exception:** `{ex.GetType().Name}`\n**Message:** {ex.Message}",
            Color = 0x992D22, // Dark Red
            Timestamp = DateTime.UtcNow.ToString("o"),
            Fields = new List<DiscordEmbedField>()
        };

        if (!string.IsNullOrEmpty(path))
            embed.Fields.Add(new DiscordEmbedField { Name = "Path", Value = path, Inline = true });

        if (!string.IsNullOrEmpty(user))
            embed.Fields.Add(new DiscordEmbedField { Name = "User", Value = user, Inline = true });

        var stackTrace = ex.StackTrace;
        if (!string.IsNullOrEmpty(stackTrace))
        {
            if (stackTrace.Length > 900) stackTrace = stackTrace[..900] + "...";
            embed.Fields.Add(new DiscordEmbedField { Name = "Stack Trace", Value = $"```{stackTrace}```", Inline = false });
        }

        EnqueueLog(LogCategory.Error, embed);
    }

    public void LogSystem(string title, string description, (string Name, string Value)[]? extraFields = null)
    {
        var embed = new DiscordEmbed
        {
            Title = $"⚙️ {title}",
            Description = description,
            Color = 0x9B59B6, // Purple
            Timestamp = DateTime.UtcNow.ToString("o")
        };

        if (extraFields != null)
        {
            foreach (var (name, value) in extraFields)
            {
                embed.Fields.Add(new DiscordEmbedField { Name = name, Value = value, Inline = true });
            }
        }

        EnqueueLog(LogCategory.System, embed);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Discord Webhook Logger started.");
        var httpClient = _httpClientFactory.CreateClient("DiscordWebhooks");

        await foreach (var item in _channel.Reader.ReadAllAsync(stoppingToken))
        {
            if (!_webhookUrls.TryGetValue(item.Category, out var webhookUrl) || string.IsNullOrWhiteSpace(webhookUrl))
            {
                continue; // Webhook not configured for this category
            }

            try
            {
                var payload = new DiscordWebhookPayload
                {
                    Username = $"Archon [{item.Category}]",
                    Embeds = new List<DiscordEmbed> { item.Embed }
                };

                var response = await httpClient.PostAsJsonAsync(webhookUrl, payload, stoppingToken);

                // Handle Discord rate limit (429)
                if ((int)response.StatusCode == 429)
                {
                    var retryAfterSeconds = 2;
                    if (response.Headers.TryGetValues("Retry-After", out var values))
                    {
                        var firstVal = values.FirstOrDefault();
                        if (int.TryParse(firstVal, out var secs)) retryAfterSeconds = secs;
                    }
                    await Task.Delay(TimeSpan.FromSeconds(retryAfterSeconds), stoppingToken);
                    // Retry once
                    await httpClient.PostAsJsonAsync(webhookUrl, payload, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send Discord webhook for category {Category}", item.Category);
            }
        }
    }
}
