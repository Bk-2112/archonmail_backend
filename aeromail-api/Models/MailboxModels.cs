namespace AeroMail.Api.Models;

public class Mailbox
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string ImapHost { get; set; } = "127.0.0.1";
    public int ImapPort { get; set; } = 993;
    public bool ImapSsl { get; set; } = true;
    public string SmtpHost { get; set; } = "127.0.0.1";
    public int SmtpPort { get; set; } = 587;
    public bool SmtpSsl { get; set; } = false;
    public string EncryptedPassword { get; set; } = string.Empty;
    public string? Color { get; set; } = "#1a73e8";
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastSyncedAt { get; set; }
}

public class MailboxSummaryDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string Role { get; set; } = "member";
    public bool IsApproved { get; set; }
    public string? Color { get; set; }
}

public class UserProfileDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string Role { get; set; } = "user";
    public bool IsApproved { get; set; }
    public List<MailboxSummaryDto> Mailboxes { get; set; } = new();
}

public class CreateMailboxRequest
{
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string Password { get; set; } = string.Empty;
    public string? ImapHost { get; set; } = "127.0.0.1";
    public int ImapPort { get; set; } = 993;
    public bool ImapSsl { get; set; } = true;
    public string? SmtpHost { get; set; } = "127.0.0.1";
    public int SmtpPort { get; set; } = 587;
    public bool SmtpSsl { get; set; } = false;
}

public class AssignMailboxRequest
{
    public Guid TargetUserId { get; set; }
    public Guid MailboxId { get; set; }
    public string Role { get; set; } = "member";
    public bool IsApproved { get; set; } = true;
}
