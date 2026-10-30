using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using TeamArchon.Mail.Api.Models;

namespace TeamArchon.Mail.Api.Services;

public interface IDiscordAuthService
{
    Task<DiscordAuthResult> AuthenticateAndVerifyAsync(string code, string redirectUri);
}

public class DiscordAuthService : IDiscordAuthService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _config;
    private readonly IDiscordLogService _discordLogger;
    private readonly ILogger<DiscordAuthService> _logger;

    public DiscordAuthService(
        IHttpClientFactory httpClientFactory,
        IConfiguration config,
        IDiscordLogService discordLogger,
        ILogger<DiscordAuthService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
        _discordLogger = discordLogger;
        _logger = logger;
    }

    public async Task<DiscordAuthResult> AuthenticateAndVerifyAsync(string code, string redirectUri)
    {
        var clientId = _config["DISCORD_CLIENT_ID"] ?? Environment.GetEnvironmentVariable("DISCORD_CLIENT_ID");
        var clientSecret = _config["DISCORD_CLIENT_SECRET"] ?? Environment.GetEnvironmentVariable("DISCORD_CLIENT_SECRET");
        var guildId = _config["DISCORD_GUILD_ID"] ?? Environment.GetEnvironmentVariable("DISCORD_GUILD_ID");
        var requiredRoleId = _config["DISCORD_REQUIRED_ROLE_ID"] ?? Environment.GetEnvironmentVariable("DISCORD_REQUIRED_ROLE_ID");

        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
        {
            _logger.LogError("Discord OAuth client configuration is missing.");
            return new DiscordAuthResult
            {
                Success = false,
                ErrorCode = "config_missing",
                ErrorMessage = "Discord OAuth is not properly configured on the server."
            };
        }

        var client = _httpClientFactory.CreateClient();

        // 1. Exchange OAuth2 Authorization Code for User Access Token
        var tokenRequest = new HttpRequestMessage(HttpMethod.Post, "https://discord.com/api/v10/oauth2/token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "client_id", clientId },
                { "client_secret", clientSecret },
                { "grant_type", "authorization_code" },
                { "code", code },
                { "redirect_uri", redirectUri }
            })
        };

        var tokenResponse = await client.SendAsync(tokenRequest);
        var tokenBody = await tokenResponse.Content.ReadAsStringAsync();

        if (!tokenResponse.IsSuccessStatusCode)
        {
            _logger.LogWarning("Discord token exchange failed: {Body}", tokenBody);
            _discordLogger.LogAuth("OAuth Exchange Failed", "Discord rejected the authorization code.", false);
            return new DiscordAuthResult
            {
                Success = false,
                ErrorCode = "oauth_failed",
                ErrorMessage = "Discord authentication exchange failed or expired."
            };
        }

        var tokenData = JsonSerializer.Deserialize<DiscordTokenResponse>(tokenBody);
        if (tokenData == null || string.IsNullOrEmpty(tokenData.AccessToken))
        {
            return new DiscordAuthResult
            {
                Success = false,
                ErrorCode = "invalid_token",
                ErrorMessage = "Failed to parse Discord access token."
            };
        }

        // 2. Fetch User Profile (@me)
        var userRequest = new HttpRequestMessage(HttpMethod.Get, "https://discord.com/api/v10/users/@me");
        userRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenData.AccessToken);

        var userResponse = await client.SendAsync(userRequest);
        if (!userResponse.IsSuccessStatusCode)
        {
            return new DiscordAuthResult
            {
                Success = false,
                ErrorCode = "user_fetch_failed",
                ErrorMessage = "Failed to fetch Discord user profile."
            };
        }

        var userBody = await userResponse.Content.ReadAsStringAsync();
        var discordUser = JsonSerializer.Deserialize<DiscordUser>(userBody);
        if (discordUser == null)
        {
            return new DiscordAuthResult
            {
                Success = false,
                ErrorCode = "user_parse_failed",
                ErrorMessage = "Unable to deserialize Discord user."
            };
        }

        // 3. Guild Gate & Role Gate Check (GET /users/@me/guilds/{guildId}/member)
        if (!string.IsNullOrEmpty(guildId))
        {
            var memberRequest = new HttpRequestMessage(HttpMethod.Get, $"https://discord.com/api/v10/users/@me/guilds/{guildId}/member");
            memberRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenData.AccessToken);

            var memberResponse = await client.SendAsync(memberRequest);

            if (memberResponse.StatusCode == HttpStatusCode.NotFound)
            {
                // User is not a member of the guild
                _discordLogger.LogAuth(
                    "Access Denied: Not In Server",
                    $"User **{discordUser.Username}** (`{discordUser.Id}`) tried to log in but is NOT in the official Team Archon Discord Server.",
                    false,
                    new[] { ("Discord Tag", discordUser.Username), ("User ID", discordUser.Id) });

                return new DiscordAuthResult
                {
                    Success = false,
                    ErrorCode = "not_in_guild",
                    ErrorMessage = "You must be a member of the official Team Archon Discord server to access this service."
                };
            }

            if (!memberResponse.IsSuccessStatusCode)
            {
                var memberError = await memberResponse.Content.ReadAsStringAsync();
                _logger.LogWarning("Guild member check failed for user {UserId}: {Error}", discordUser.Id, memberError);
                return new DiscordAuthResult
                {
                    Success = false,
                    ErrorCode = "guild_check_failed",
                    ErrorMessage = "Unable to verify Discord server membership."
                };
            }

            var memberBody = await memberResponse.Content.ReadAsStringAsync();
            var member = JsonSerializer.Deserialize<DiscordGuildMember>(memberBody);

            // Verify Required Role ID if configured
            if (!string.IsNullOrEmpty(requiredRoleId))
            {
                var hasRole = member?.Roles != null && member.Roles.Contains(requiredRoleId);
                if (!hasRole)
                {
                    _discordLogger.LogAuth(
                        "Access Denied: Missing Required Role",
                        $"User **{discordUser.Username}** (`{discordUser.Id}`) is in the server but lacks the required Access Role (`{requiredRoleId}`).",
                        false,
                        new[] { ("Discord Tag", discordUser.Username), ("User ID", discordUser.Id), ("Required Role", requiredRoleId) });

                    return new DiscordAuthResult
                    {
                        Success = false,
                        ErrorCode = "missing_role",
                        ErrorMessage = "You do not hold the required Discord role to access Team Archon Mail."
                    };
                }
            }
        }

        return new DiscordAuthResult
        {
            Success = true,
            User = new UserRecord
            {
                DiscordId = discordUser.Id,
                DiscordUsername = discordUser.Username,
                DiscordAvatar = discordUser.GetAvatarUrl(),
                Email = discordUser.Email ?? $"{discordUser.Username.ToLowerInvariant()}@teamarchon.in",
                Roles = new List<string> { "member" }
            }
        };
    }
}
