using System.Security.Claims;
using AeroMail.Api.Database;
using AeroMail.Api.Models;
using Dapper;

namespace AeroMail.Api.Services;

public interface IMailboxService
{
    Task<UserProfileDto> GetOrCreateUserProfileAsync(ClaimsPrincipal principal);
    Task<List<MailboxSummaryDto>> GetMailboxesForUserAsync(Guid userId);
    Task<(Mailbox mailbox, string decryptedPassword)> GetAuthorizedMailboxAsync(ClaimsPrincipal principal, Guid? requestedMailboxId = null);
    Task<MailboxSummaryDto> CreateMailboxAsync(CreateMailboxRequest request, Guid adminUserId);
    Task AssignMailboxAsync(AssignMailboxRequest request, Guid adminUserId);
}

public class MailboxService : IMailboxService
{
    private readonly DatabaseService _db;
    private readonly AuthService _authService;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<MailboxService> _logger;

    public MailboxService(
        DatabaseService db,
        AuthService authService,
        IHttpContextAccessor httpContextAccessor,
        ILogger<MailboxService> logger)
    {
        _db = db;
        _authService = authService;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public static Guid ExtractUserId(ClaimsPrincipal principal)
    {
        var sub = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? principal.FindFirst("sub")?.Value
               ?? principal.FindFirst("user_id")?.Value
               ?? throw new UnauthorizedAccessException("Missing user ID claim in token.");

        if (Guid.TryParse(sub, out var guid))
            return guid;

        throw new UnauthorizedAccessException("User ID claim is not a valid GUID.");
    }

    public static string ExtractUserEmail(ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Email)?.Value
            ?? principal.FindFirst("email")?.Value
            ?? string.Empty;
    }

    public async Task<UserProfileDto> GetOrCreateUserProfileAsync(ClaimsPrincipal principal)
    {
        var userId = ExtractUserId(principal);
        var email = ExtractUserEmail(principal);

        try
        {
            using var conn = _db.GetConnection();
            const string sqlUser = @"
                SELECT id, email, display_name as displayname, role, is_approved as isapproved
                FROM user_profiles
                WHERE id = @UserId";

            var profile = await conn.QuerySingleOrDefaultAsync<UserProfileDto>(sqlUser, new { UserId = userId });

            if (profile == null)
            {
                // Auto-provision profile for first-time Supabase sign-in
                const string insertSql = @"
                    INSERT INTO user_profiles (id, email, display_name, role, is_approved)
                    VALUES (@Id, @Email, @DisplayName, 'user', true)
                    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
                    RETURNING id, email, display_name as displayname, role, is_approved as isapproved;";

                profile = await conn.QuerySingleOrDefaultAsync<UserProfileDto>(
                    insertSql,
                    new { Id = userId, Email = email, DisplayName = email.Split('@')[0] }
                );
            }

            var mailboxes = await GetMailboxesForUserAsync(userId);
            if (profile != null)
            {
                profile.Mailboxes = mailboxes;
                return profile;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Database lookup failed ({Message}), returning token-derived profile.", ex.Message);
        }

        // Fallback for mock/test environments
        return new UserProfileDto
        {
            Id = userId,
            Email = email,
            Role = "user",
            IsApproved = true,
            Mailboxes = new List<MailboxSummaryDto>()
        };
    }

    public async Task<List<MailboxSummaryDto>> GetMailboxesForUserAsync(Guid userId)
    {
        try
        {
            using var conn = _db.GetConnection();
            const string sql = @"
                SELECT m.id, m.email, m.display_name as displayname, m.color, 
                       um.role, um.is_approved as isapproved
                FROM mailboxes m
                JOIN user_mailboxes um ON m.id = um.mailbox_id
                WHERE um.user_id = @UserId AND um.is_approved = true AND m.is_active = true
                ORDER BY m.email ASC";

            var result = await conn.QueryAsync<MailboxSummaryDto>(sql, new { UserId = userId });
            return result.AsList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to query user mailboxes: {Message}", ex.Message);
            return new List<MailboxSummaryDto>();
        }
    }

    public async Task<(Mailbox mailbox, string decryptedPassword)> GetAuthorizedMailboxAsync(
        ClaimsPrincipal principal,
        Guid? requestedMailboxId = null)
    {
        var userId = ExtractUserId(principal);

        // Check if mailbox ID was passed in HTTP header X-Mailbox-Id if not explicitly provided
        if (!requestedMailboxId.HasValue && _httpContextAccessor.HttpContext != null)
        {
            if (_httpContextAccessor.HttpContext.Request.Headers.TryGetValue("X-Mailbox-Id", out var headerVal) &&
                Guid.TryParse(headerVal, out var parsedHeaderId))
            {
                requestedMailboxId = parsedHeaderId;
            }
            else if (_httpContextAccessor.HttpContext.Request.Query.TryGetValue("mailboxId", out var queryVal) &&
                     Guid.TryParse(queryVal, out var parsedQueryId))
            {
                requestedMailboxId = parsedQueryId;
            }
        }

        try
        {
            using var conn = _db.GetConnection();
            string sql;
            object param;

            if (requestedMailboxId.HasValue)
            {
                sql = @"
                    SELECT m.id, m.email, m.display_name as displayname, m.imap_host as imaphost,
                           m.imap_port as imapport, m.imap_ssl as imapssl, m.smtp_host as smtphost,
                           m.smtp_port as smtpport, m.smtp_ssl as smtpssl, m.encrypted_password as encryptedpassword,
                           m.is_active as isactive
                    FROM mailboxes m
                    JOIN user_mailboxes um ON m.id = um.mailbox_id
                    WHERE um.user_id = @UserId AND um.mailbox_id = @MailboxId 
                          AND um.is_approved = true AND m.is_active = true";
                param = new { UserId = userId, MailboxId = requestedMailboxId.Value };
            }
            else
            {
                // Default to first approved mailbox assigned to user
                sql = @"
                    SELECT m.id, m.email, m.display_name as displayname, m.imap_host as imaphost,
                           m.imap_port as imapport, m.imap_ssl as imapssl, m.smtp_host as smtphost,
                           m.smtp_port as smtpport, m.smtp_ssl as smtpssl, m.encrypted_password as encryptedpassword,
                           m.is_active as isactive
                    FROM mailboxes m
                    JOIN user_mailboxes um ON m.id = um.mailbox_id
                    WHERE um.user_id = @UserId AND um.is_approved = true AND m.is_active = true
                    ORDER BY um.created_at ASC
                    LIMIT 1";
                param = new { UserId = userId };
            }

            var mailbox = await conn.QuerySingleOrDefaultAsync<Mailbox>(sql, param);
            if (mailbox != null)
            {
                var decrypted = _authService.Decrypt(mailbox.EncryptedPassword);
                return (mailbox, decrypted);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Database mailbox resolution exception: {Message}", ex.Message);
        }

        // Backward compatibility fallback: check if credentials exist in JWT claims (legacy test tokens)
        try
        {
            var (email, host, port, ssl, password) = _authService.DecryptCredentials(principal);
            var fallbackMailbox = new Mailbox
            {
                Id = requestedMailboxId ?? userId,
                Email = email,
                ImapHost = host,
                ImapPort = port,
                ImapSsl = ssl,
                SmtpHost = host.Replace("imap.", "smtp."),
                SmtpPort = 587,
                SmtpSsl = false,
                EncryptedPassword = string.Empty,
                IsActive = true
            };
            return (fallbackMailbox, password);
        }
        catch
        {
            throw new UnauthorizedAccessException("No approved mailbox assigned to your account, or access is pending administrator approval.");
        }
    }

    public async Task<MailboxSummaryDto> CreateMailboxAsync(CreateMailboxRequest request, Guid adminUserId)
    {
        var encryptedPassword = _authService.Encrypt(request.Password);
        using var conn = _db.GetConnection();

        const string insertMailboxSql = @"
            INSERT INTO mailboxes (email, display_name, imap_host, imap_port, imap_ssl, 
                                  smtp_host, smtp_port, smtp_ssl, encrypted_password, is_active)
            VALUES (@Email, @DisplayName, @ImapHost, @ImapPort, @ImapSsl, 
                    @SmtpHost, @SmtpPort, @SmtpSsl, @EncryptedPassword, true)
            RETURNING id, email, display_name as displayname, color;";

        var created = await conn.QuerySingleAsync<MailboxSummaryDto>(insertMailboxSql, new
        {
            request.Email,
            request.DisplayName,
            ImapHost = request.ImapHost ?? "127.0.0.1",
            request.ImapPort,
            request.ImapSsl,
            SmtpHost = request.SmtpHost ?? "127.0.0.1",
            request.SmtpPort,
            request.SmtpSsl,
            EncryptedPassword = encryptedPassword
        });

        // Automatically assign admin to newly created mailbox
        const string assignSql = @"
            INSERT INTO user_mailboxes (user_id, mailbox_id, role, is_approved)
            VALUES (@UserId, @MailboxId, 'admin', true)
            ON CONFLICT (user_id, mailbox_id) DO NOTHING;";

        await conn.ExecuteAsync(assignSql, new { UserId = adminUserId, MailboxId = created.Id });
        created.Role = "admin";
        created.IsApproved = true;

        return created;
    }

    public async Task AssignMailboxAsync(AssignMailboxRequest request, Guid adminUserId)
    {
        using var conn = _db.GetConnection();
        const string sql = @"
            INSERT INTO user_mailboxes (user_id, mailbox_id, role, is_approved)
            VALUES (@TargetUserId, @MailboxId, @Role, @IsApproved)
            ON CONFLICT (user_id, mailbox_id) 
            DO UPDATE SET role = EXCLUDED.role, is_approved = EXCLUDED.is_approved;";

        await conn.ExecuteAsync(sql, new
        {
            request.TargetUserId,
            request.MailboxId,
            request.Role,
            request.IsApproved
        });
    }
}
