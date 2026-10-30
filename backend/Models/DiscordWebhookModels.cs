using System.Text.Json.Serialization;

namespace TeamArchon.Mail.Api.Models;

public enum LogCategory
{
    Auth,
    Mail,
    Error,
    System
}

public class DiscordWebhookPayload
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = "Team Archon Mailer";

    [JsonPropertyName("avatar_url")]
    public string AvatarUrl { get; set; } = "https://portal.teamarchon.in/favicon.png";

    [JsonPropertyName("content")]
    public string? Content { get; set; }

    [JsonPropertyName("embeds")]
    public List<DiscordEmbed> Embeds { get; set; } = new();
}

public class DiscordEmbed
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("color")]
    public int Color { get; set; } // Hex integer (e.g. 0xD32F2F)

    [JsonPropertyName("fields")]
    public List<DiscordEmbedField> Fields { get; set; } = new();

    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("o");

    [JsonPropertyName("footer")]
    public DiscordEmbedFooter? Footer { get; set; }
}

public class DiscordEmbedField
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("value")]
    public string Value { get; set; } = string.Empty;

    [JsonPropertyName("inline")]
    public bool Inline { get; set; } = true;
}

public class DiscordEmbedFooter
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = "Team Archon Mail Service";

    [JsonPropertyName("icon_url")]
    public string? IconUrl { get; set; } = "https://portal.teamarchon.in/favicon.png";
}

public class DiscordLogItem
{
    public LogCategory Category { get; set; }
    public DiscordEmbed Embed { get; set; } = new();
}
