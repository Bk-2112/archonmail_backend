namespace AeroMail.Api.Models;

/// <summary>
/// Core message record. Maps to the messages table in PostgreSQL.
/// Properties use the names expected by ImapService (Uid, From, To, Date, Body)
/// as well as the AccountId used by DatabaseService.
/// </summary>
public record AeroMessage(
    uint Uid,
    string MessageId,
    string Subject,
    string From,
    string FromName,
    string[] To,
    DateTime Date,
    bool IsRead,
    bool IsStarred,
    string Snippet,
    string Body,
    string Folder,
    string[] Labels
)
{
    // DB-level fields (populated when reading from PostgreSQL)
    public Guid Id { get; init; } = Guid.Empty;
    public Guid AccountId { get; init; } = Guid.Empty;
    public long ImapUid => Uid;
    public string? ThreadId { get; init; }
    public string FromEmail => From;
    public List<string> ToEmails => new(To);
    public List<string> CcEmails { get; init; } = new();
    public DateTimeOffset Timestamp => new DateTimeOffset(Date, TimeSpan.Zero);
    public bool IsImportant { get; init; }
    public bool HasAttachments { get; init; }
}

public class AeroAccount
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string ImapHost { get; set; } = string.Empty;
    public int ImapPort { get; set; } = 993;
    public bool ImapSsl { get; set; } = true;
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool SmtpSsl { get; set; } = true;
    public string? Color { get; set; }
}

public class AeroLabel
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#1a73e8";
    public bool IsSystem { get; set; }
}
