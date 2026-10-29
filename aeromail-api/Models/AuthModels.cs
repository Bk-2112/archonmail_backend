namespace AeroMail.Api.Models;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? ImapHost { get; set; }
    public int? ImapPort { get; set; }
    public bool? ImapSsl { get; set; }
    public string? SmtpHost { get; set; }
    public int? SmtpPort { get; set; }
    public bool? SmtpSsl { get; set; }
}

/// <summary>
/// 3-arg positional record to match AuthService: new LoginResponse(tokenString, email, jti)
/// </summary>
public record LoginResponse(string Token, string Email, string Jti)
{
    public AeroAccount User { get; init; } = new() { Email = Email };
}

/// <summary>
/// IMAP folder metadata. 4-argument positional constructor matches ImapService usage.
/// </summary>
public class FolderInfo
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public int UnreadCount { get; set; }
    public int TotalCount { get; set; }
    public bool IsSpecial { get; set; }

    public FolderInfo() { }

    public FolderInfo(string name, string path, int unreadCount, int totalCount)
    {
        Name = name;
        Path = path;
        UnreadCount = unreadCount;
        TotalCount = totalCount;
    }
}

/// <summary>
/// Label model used by LabelsController. Mirrors the labels table.
/// </summary>
public class Label
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Color { get; set; } = "#1a73e8";
    public bool IsSystem { get; set; }
}

/// <summary>
/// Filter rule model used by RulesController. Mirrors the filters table.
/// </summary>
public class Rule
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public string? FromPattern { get; set; }
    public string? ToPattern { get; set; }
    public string? SubjectPattern { get; set; }
    public string? HasWords { get; set; }
    public string Action { get; set; } = string.Empty;
    public Guid? ActionLabelId { get; set; }
    public bool IsActive { get; set; } = true;
}
