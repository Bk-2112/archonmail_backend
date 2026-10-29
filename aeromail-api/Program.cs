using System.Text;
using System.Text.Json;
using AeroMail.Api.Database;
using AeroMail.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Configure port to listen on all interfaces or ASPNETCORE_URLS (defaults to 5000 / 8787)
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

builder.Services.AddSingleton<DatabaseService>();

// ─── Core services ────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IMailboxService, MailboxService>();
builder.Services.AddScoped<MailboxService>();
builder.Services.AddScoped<IImapService, ImapService>();
builder.Services.AddScoped<SmtpService>();

// ─── Labels, Filters, Search ─────────────────────────────────────────────────
builder.Services.AddScoped<LabelService>();
builder.Services.AddScoped<FilterService>();

// ─── Setup wizard ────────────────────────────────────────────────────────────
builder.Services.AddScoped<SetupService>();

builder.Services.AddCors(o => o.AddPolicy("AllowWeb", p =>
    p.SetIsOriginAllowed(origin =>
        origin.StartsWith("http://localhost:") ||
        origin.StartsWith("https://mail.teamarchon.in") ||
        origin.StartsWith("https://teamarchon.in") ||
        origin.EndsWith(".vercel.app") ||
        origin.Contains("aeroverra.com"))
     .AllowAnyMethod()
     .AllowAnyHeader()
     .AllowCredentials()));

// ─── Supabase Auth & JWT Authentication ───────────────────────────────────────
var supabaseUrl = builder.Configuration["Supabase:Url"]
    ?? Environment.GetEnvironmentVariable("SUPABASE_URL")
    ?? "";
var supabaseJwtSecret = builder.Configuration["Supabase:JwtSecret"]
    ?? Environment.GetEnvironmentVariable("SUPABASE_JWT_SECRET")
    ?? "";

var fallbackSecret = builder.Configuration["Jwt:Secret"] ?? "SuperSecretJwtKeyWith32Characters!!";
var activeSecret = !string.IsNullOrWhiteSpace(supabaseJwtSecret) ? supabaseJwtSecret : fallbackSecret;

var validIssuers = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "aeromail",
    "aeromail-test",
    "teamarchon"
};
if (!string.IsNullOrWhiteSpace(supabaseUrl))
{
    validIssuers.Add($"{supabaseUrl.TrimEnd('/')}/auth/v1");
}
if (!string.IsNullOrWhiteSpace(builder.Configuration["Jwt:Issuer"]))
{
    validIssuers.Add(builder.Configuration["Jwt:Issuer"]!);
}

var validAudiences = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "authenticated",
    "aeromail-users",
    "aeromail-test-users",
    "teamarchon-users"
};
if (!string.IsNullOrWhiteSpace(builder.Configuration["Jwt:Audience"]))
{
    validAudiences.Add(builder.Configuration["Jwt:Audience"]!);
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuers = validIssuers,
            ValidateAudience = true,
            ValidAudiences = validAudiences,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(activeSecret)),
            ClockSkew = TimeSpan.FromMinutes(2),
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = ctx =>
            {
                var authService = ctx.HttpContext.RequestServices.GetRequiredService<IAuthService>();
                var jti = ctx.Principal?.FindFirst("jti")?.Value ?? string.Empty;
                if (!string.IsNullOrEmpty(jti) && authService.IsTokenRevoked(jti))
                    ctx.Fail("Token has been revoked");
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();
app.UseCors("AllowWeb");
app.UseAuthentication();
app.UseAuthorization();

// Initialize DB schema on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DatabaseService>();
    try { await db.InitializeAsync(); } catch (Exception ex) { Console.WriteLine($"DB init skipped: {ex.Message}"); }
}

app.MapControllers();
app.Run();

// Required for WebApplicationFactory in tests
public partial class Program { }
