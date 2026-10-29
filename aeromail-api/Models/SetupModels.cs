namespace AeroMail.Api.Models;

public class SetupStatusResponse
{
    public bool Configured { get; set; }
    public int Step { get; set; }
}

public class SetupConfigureRequest
{
    public string ImapHost { get; set; } = string.Empty;
    public int ImapPort { get; set; } = 993;
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool Ssl { get; set; } = true;
}

public class SetupAdminRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

public class SetupTestConnectionRequest
{
    public string ImapHost { get; set; } = string.Empty;
    public int ImapPort { get; set; } = 993;
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool Ssl { get; set; } = true;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
