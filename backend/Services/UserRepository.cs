using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using Microsoft.IdentityModel.Tokens;
using TeamArchon.Mail.Api.Models;

namespace TeamArchon.Mail.Api.Services;

public class UserRepository
{
    private readonly DatabaseService _db;
    private readonly IConfiguration _config;
    private readonly EncryptionService _encryption;
    private readonly IDiscordLogService _discordLogger;

    public UserRepository(
        DatabaseService db,
        IConfiguration config,
        EncryptionService encryption,
        IDiscordLogService discordLogger)
    {
        _db = db;
        _config = config;
        _encryption = encryption;
        _discordLogger = discordLogger;
    }

    public async Task<UserRecord> UpsertDiscordUserAsync(UserRecord profile)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO public.users (discord_id, discord_username, discord_avatar, email, roles, is_active, last_login_at, updated_at)
            VALUES (@DiscordId, @DiscordUsername, @DiscordAvatar, @Email, @Roles, true, NOW(), NOW())
            ON CONFLICT (discord_id) DO UPDATE SET
                discord_username = EXCLUDED.discord_username,
                discord_avatar = EXCLUDED.discord_avatar,
                email = EXCLUDED.email,
                last_login_at = NOW(),
                updated_at = NOW()
            RETURNING id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                      discord_avatar AS DiscordAvatar, email AS Email, roles AS Roles, 
                      is_active AS IsActive, last_login_at AS LastLoginAt, 
                      created_at AS CreatedAt, updated_at AS UpdatedAt;";

        var user = await conn.QuerySingleAsync<UserRecord>(sql, new
        {
            profile.DiscordId,
            profile.DiscordUsername,
            profile.DiscordAvatar,
            profile.Email,
            profile.Roles
        });

        // Ensure default domain mailbox exists and is assigned
        await EnsureDefaultMailboxAssignedAsync(conn, user);

        return user;
    }

    public async Task<UserRecord?> GetUserByIdAsync(Guid userId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                   discord_avatar AS DiscordAvatar, email AS Email, password_hash AS PasswordHash, 
                   roles AS Roles, is_active AS IsActive, last_login_at AS LastLoginAt, 
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM public.users 
            WHERE id = @userId AND is_active = true;";

        return await conn.QuerySingleOrDefaultAsync<UserRecord>(sql, new { userId });
    }

    public async Task<UserRecord?> GetUserByEmailWithPasswordAsync(string email)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                   discord_avatar AS DiscordAvatar, email AS Email, password_hash AS PasswordHash, 
                   roles AS Roles, is_active AS IsActive, last_login_at AS LastLoginAt, 
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM public.users 
            WHERE LOWER(email) = LOWER(@email) AND is_active = true;";

        return await conn.QuerySingleOrDefaultAsync<UserRecord>(sql, new { email });
    }

    public async Task<UserRecord> CreateEmailUserAsync(string email, string passwordHash, string? displayName)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var username = string.IsNullOrWhiteSpace(displayName) ? email.Split('@')[0] : displayName;

        const string sql = @"
            INSERT INTO public.users (discord_id, discord_username, discord_avatar, email, password_hash, roles, is_active, last_login_at, created_at, updated_at)
            VALUES (NULL, @username, NULL, @email, @passwordHash, @roles, true, NOW(), NOW(), NOW())
            RETURNING id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                      discord_avatar AS DiscordAvatar, email AS Email, password_hash AS PasswordHash, 
                      roles AS Roles, is_active AS IsActive, last_login_at AS LastLoginAt, 
                      created_at AS CreatedAt, updated_at AS UpdatedAt;";

        var user = await conn.QuerySingleAsync<UserRecord>(sql, new
        {
            username,
            email,
            passwordHash,
            roles = new[] { "member" }
        });

        await EnsureDefaultMailboxAssignedAsync(conn, user);
        return user;
    }

    public async Task<List<MailboxRecord>> GetAssignedMailboxesAsync(Guid userId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var user = await GetUserByIdAsync(userId);
        if (user != null && user.Roles.Contains("admin"))
        {
            // Admin users can manage and access ALL active mailboxes in the company
            const string adminSql = @"
                SELECT m.id, m.email, m.display_name AS DisplayName, 
                       m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                       m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                       m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
                FROM public.mailboxes m
                WHERE m.is_active = true
                ORDER BY m.email ASC;";

            return (await conn.QueryAsync<MailboxRecord>(adminSql)).ToList();
        }

        const string sql = @"
            SELECT m.id, m.email, m.display_name AS DisplayName, 
                   m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                   m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                   m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
            FROM public.mailboxes m
            JOIN public.user_mailboxes um ON m.id = um.mailbox_id
            WHERE um.user_id = @userId AND m.is_active = true
            ORDER BY m.email ASC;";

        var list = (await conn.QueryAsync<MailboxRecord>(sql, new { userId })).ToList();
        return list;
    }

    public async Task<MailboxRecord?> GetMailboxWithPasswordAsync(Guid mailboxId, Guid userId)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var user = await GetUserByIdAsync(userId);
        if (user != null && user.Roles.Contains("admin"))
        {
            const string adminSql = @"
                SELECT m.id, m.email, m.display_name AS DisplayName, 
                       m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                       m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                       m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
                FROM public.mailboxes m
                WHERE m.id = @mailboxId AND m.is_active = true;";

            return await conn.QuerySingleOrDefaultAsync<MailboxRecord>(adminSql, new { mailboxId });
        }

        const string sql = @"
            SELECT m.id, m.email, m.display_name AS DisplayName, 
                   m.imap_host AS ImapHost, m.imap_port AS ImapPort, m.imap_ssl AS ImapSsl, 
                   m.smtp_host AS SmtpHost, m.smtp_port AS SmtpPort, m.smtp_ssl AS SmtpSsl, 
                   m.encrypted_password AS EncryptedPassword, m.is_active AS IsActive, m.created_at AS CreatedAt
            FROM public.mailboxes m
            JOIN public.user_mailboxes um ON m.id = um.mailbox_id
            WHERE m.id = @mailboxId AND um.user_id = @userId AND m.is_active = true;";

        return await conn.QuerySingleOrDefaultAsync<MailboxRecord>(sql, new { mailboxId, userId });
    }

    public string GenerateJwtToken(UserRecord user)
    {
        var secretKey = _config["JWT_SECRET"]
            ?? Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? "teamarchon_super_secret_jwt_key_minimum_32_characters!";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("discord_id", user.DiscordId ?? ""),
            new(ClaimTypes.Name, string.IsNullOrWhiteSpace(user.DiscordUsername) ? user.Email : user.DiscordUsername),
            new(ClaimTypes.Email, user.Email)
        };

        foreach (var role in user.Roles)
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var token = new JwtSecurityToken(
            issuer: "TeamArchonMailApi",
            audience: "TeamArchonWeb",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task EnsureAdminAccountAsync()
    {
        try
        {
            await using var conn = _db.GetConnection();
            await conn.OpenAsync();

            var admin = await GetUserByEmailWithPasswordAsync("admin@teamarchon.in");
            var adminHash = PasswordHasher.HashPassword("ArchonAdmin2026!");

            if (admin == null)
            {
                const string insertAdminSql = @"
                    INSERT INTO public.users (discord_id, discord_username, discord_avatar, email, password_hash, roles, is_active, created_at, updated_at)
                    VALUES (NULL, 'Administrator', NULL, 'admin@teamarchon.in', @adminHash, @roles, true, NOW(), NOW())
                    ON CONFLICT (email) DO UPDATE SET 
                        password_hash = @adminHash,
                        roles = @roles;";

                await conn.ExecuteAsync(insertAdminSql, new { adminHash, roles = new[] { "admin" } });
            }
            else if (!PasswordHasher.VerifyPassword("ArchonAdmin2026!", admin.PasswordHash) || !admin.Roles.Contains("admin"))
            {
                const string updateAdminSql = @"
                    UPDATE public.users 
                    SET password_hash = @adminHash, roles = @roles, updated_at = NOW() 
                    WHERE LOWER(email) = 'admin@teamarchon.in';";

                await conn.ExecuteAsync(updateAdminSql, new { adminHash, roles = new[] { "admin" } });
            }

            // Ensure admin@teamarchon.in mailbox exists with actual Stalwart password
            const string ensureBoxSql = @"
                INSERT INTO public.mailboxes (email, display_name, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, encrypted_password, is_active)
                VALUES ('admin@teamarchon.in', 'Team Archon Admin', '127.0.0.1', 993, true, '127.0.0.1', 465, true, 'ArchonAdmin2026!', true)
                ON CONFLICT (email) DO UPDATE SET encrypted_password = 'ArchonAdmin2026!';";

            await conn.ExecuteAsync(ensureBoxSql);
        }
        catch (Exception ex)
        {
            _discordLogger.LogError("Failed to seed admin account", ex);
        }
    }

    public async Task<List<MailboxRecord>> GetAllMailboxesAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT id, email, display_name AS DisplayName, 
                   imap_host AS ImapHost, imap_port AS ImapPort, imap_ssl AS ImapSsl, 
                   smtp_host AS SmtpHost, smtp_port AS SmtpPort, smtp_ssl AS SmtpSsl, 
                   encrypted_password AS EncryptedPassword, is_active AS IsActive, created_at AS CreatedAt
            FROM public.mailboxes
            ORDER BY email ASC;";

        return (await conn.QueryAsync<MailboxRecord>(sql)).ToList();
    }

    public async Task<MailboxRecord> CreateOrUpdateMailboxAsync(MailboxRecord box)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO public.mailboxes (email, display_name, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, encrypted_password, is_active)
            VALUES (@Email, @DisplayName, @ImapHost, @ImapPort, @ImapSsl, @SmtpHost, @SmtpPort, @SmtpSsl, @EncryptedPassword, true)
            ON CONFLICT (email) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                encrypted_password = EXCLUDED.encrypted_password,
                is_active = true
            RETURNING id, email, display_name AS DisplayName, 
                      imap_host AS ImapHost, imap_port AS ImapPort, imap_ssl AS ImapSsl, 
                      smtp_host AS SmtpHost, smtp_port AS SmtpPort, smtp_ssl AS SmtpSsl, 
                      encrypted_password AS EncryptedPassword, is_active AS IsActive, created_at AS CreatedAt;";

        return await conn.QuerySingleAsync<MailboxRecord>(sql, box);
    }

    public async Task<bool> DeleteMailboxAsync(Guid id)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        var affected = await conn.ExecuteAsync("DELETE FROM public.mailboxes WHERE id = @id;", new { id });
        return affected > 0;
    }

    public async Task<List<UserRecord>> GetAllUsersAsync()
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            SELECT id, discord_id AS DiscordId, discord_username AS DiscordUsername, 
                   discord_avatar AS DiscordAvatar, email AS Email, roles AS Roles, 
                   is_active AS IsActive, last_login_at AS LastLoginAt, 
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM public.users
            ORDER BY created_at DESC;";

        return (await conn.QueryAsync<UserRecord>(sql)).ToList();
    }

    public async Task<bool> AssignUserMailboxAsync(Guid userId, Guid mailboxId, string role)
    {
        await using var conn = _db.GetConnection();
        await conn.OpenAsync();

        const string sql = @"
            INSERT INTO public.user_mailboxes (user_id, mailbox_id, role)
            VALUES (@userId, @mailboxId, @role)
            ON CONFLICT (user_id, mailbox_id) DO UPDATE SET role = EXCLUDED.role;";

        var affected = await conn.ExecuteAsync(sql, new { userId, mailboxId, role });
        return affected > 0;
    }

    private async Task EnsureDefaultMailboxAssignedAsync(Npgsql.NpgsqlConnection conn, UserRecord user)
    {
        try
        {
            // Check if default admin@teamarchon.in mailbox exists in DB
            var mailbox = await conn.QuerySingleOrDefaultAsync<MailboxRecord>(
                "SELECT id, email FROM public.mailboxes WHERE email = 'admin@teamarchon.in' LIMIT 1;");

            if (mailbox == null)
            {
                var defaultPass = _config["STALWART_ADMIN_PASSWORD"] ?? "ArchonPass2026!";
                var encPass = _encryption.Encrypt(defaultPass);

                const string insertMailboxSql = @"
                    INSERT INTO public.mailboxes (email, display_name, imap_host, imap_port, imap_ssl, smtp_host, smtp_port, smtp_ssl, encrypted_password, is_active)
                    VALUES ('admin@teamarchon.in', 'Team Archon Admin', '127.0.0.1', 993, true, '127.0.0.1', 465, true, @encPass, true)
                    RETURNING id, email;";

                mailbox = await conn.QuerySingleAsync<MailboxRecord>(insertMailboxSql, new { encPass });
            }

            // Assign user to this mailbox if not already assigned
            const string linkSql = @"
                INSERT INTO public.user_mailboxes (user_id, mailbox_id, role)
                VALUES (@userId, @mailboxId, 'owner')
                ON CONFLICT (user_id, mailbox_id) DO NOTHING;";

            await conn.ExecuteAsync(linkSql, new { userId = user.Id, mailboxId = mailbox.Id });
        }
        catch (Exception ex)
        {
            _discordLogger.LogError("Failed to ensure default mailbox assignment", ex, user: user.DiscordUsername);
        }
    }
}
