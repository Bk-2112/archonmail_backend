using AeroMail.Api.Database;
using Dapper;

namespace AeroMail.Api.Services;

/// <summary>
/// Manages first-run setup state. Config stored in system_settings table.
/// </summary>
public class SetupService
{
    private readonly DatabaseService _db;

    public SetupService(DatabaseService db)
    {
        _db = db;
    }

    public async Task<bool> IsConfiguredAsync()
    {
        try
        {
            using var conn = _db.GetConnection();
            var val = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT value FROM system_settings WHERE key = 'setup_complete'");
            return val == "true";
        }
        catch
        {
            return false;
        }
    }

    public async Task<int> GetSetupStepAsync()
    {
        try
        {
            using var conn = _db.GetConnection();
            var val = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT value FROM system_settings WHERE key = 'setup_step'");
            return int.TryParse(val, out var step) ? step : 0;
        }
        catch
        {
            return 0;
        }
    }

    public async Task SaveMailConfigAsync(string imapHost, int imapPort, string smtpHost, int smtpPort, bool ssl)
    {
        using var conn = _db.GetConnection();
        await UpsertSettingAsync(conn, "imap_host", imapHost);
        await UpsertSettingAsync(conn, "imap_port", imapPort.ToString());
        await UpsertSettingAsync(conn, "smtp_host", smtpHost);
        await UpsertSettingAsync(conn, "smtp_port", smtpPort.ToString());
        await UpsertSettingAsync(conn, "ssl_enabled", ssl.ToString().ToLower());
        await UpsertSettingAsync(conn, "setup_step", "1");
    }

    public async Task MarkAdminCreatedAsync()
    {
        using var conn = _db.GetConnection();
        await UpsertSettingAsync(conn, "setup_step", "2");
    }

    public async Task MarkConfiguredAsync()
    {
        using var conn = _db.GetConnection();
        await UpsertSettingAsync(conn, "setup_complete", "true");
        await UpsertSettingAsync(conn, "setup_step", "4");
    }

    public async Task<(string imapHost, int imapPort, string smtpHost, int smtpPort, bool ssl)> GetMailConfigAsync()
    {
        using var conn = _db.GetConnection();
        var settings = (await conn.QueryAsync<(string Key, string Value)>(
            "SELECT key, value FROM system_settings WHERE key IN ('imap_host','imap_port','smtp_host','smtp_port','ssl_enabled')"))
            .ToDictionary(x => x.Key, x => x.Value);

        settings.TryGetValue("imap_host", out var imapHost);
        settings.TryGetValue("imap_port", out var imapPortStr);
        settings.TryGetValue("smtp_host", out var smtpHost);
        settings.TryGetValue("smtp_port", out var smtpPortStr);
        settings.TryGetValue("ssl_enabled", out var sslStr);

        return (
            imapHost ?? string.Empty,
            int.TryParse(imapPortStr, out var p) ? p : 993,
            smtpHost ?? string.Empty,
            int.TryParse(smtpPortStr, out var sp) ? sp : 587,
            sslStr == "true"
        );
    }

    private static async Task UpsertSettingAsync(Npgsql.NpgsqlConnection conn, string key, string value)
    {
        await conn.ExecuteAsync(@"
            INSERT INTO system_settings(key, value) VALUES (@key, @value)
            ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
            new { key, value });
    }
}
