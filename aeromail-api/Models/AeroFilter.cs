namespace AeroMail.Api.Models;

/// <summary>
/// Filter rule model. Maps to the filters table in PostgreSQL.
/// </summary>
public class AeroFilter
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
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
