using System.Text.Json.Serialization;

namespace TeamArchon.Mail.Api.Models;

public class DiscordTokenResponse
{
    [JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;

    [JsonPropertyName("token_type")]
    public string TokenType { get; set; } = string.Empty;

    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; }

    [JsonPropertyName("refresh_token")]
    public string? RefreshToken { get; set; }

    [JsonPropertyName("scope")]
    public string Scope { get; set; } = string.Empty;
}

public class DiscordUser
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("discriminator")]
    public string? Discriminator { get; set; }

    [JsonPropertyName("avatar")]
    public string? Avatar { get; set; }

    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("verified")]
    public bool? Verified { get; set; }

    public string GetAvatarUrl()
    {
        if (string.IsNullOrEmpty(Avatar))
            return "https://cdn.discordapp.com/embed/avatars/0.png";

        var format = Avatar.StartsWith("a_") ? "gif" : "png";
        return $"https://cdn.discordapp.com/avatars/{Id}/{Avatar}.{format}?size=128";
    }
}

public class DiscordGuildMember
{
    [JsonPropertyName("roles")]
    public List<string> Roles { get; set; } = new();

    [JsonPropertyName("nick")]
    public string? Nick { get; set; }

    [JsonPropertyName("user")]
    public DiscordUser? User { get; set; }
}

public class DiscordAuthResult
{
    public bool Success { get; set; }
    public string? ErrorCode { get; set; } // "not_in_guild", "missing_role", "oauth_failed"
    public string? ErrorMessage { get; set; }
    public UserRecord? User { get; set; }
    public string? Token { get; set; }
}
