using System.Text;
using System.Text.Json;
using AeroMail.Api.Database;
using AeroMail.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddSingleton<DatabaseService>();

// ─── Core services ────────────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IImapService, ImapService>();
builder.Services.AddScoped<SmtpService>();

// ─── Phase 3: Labels, Filters, Search ────────────────────────────────────────
builder.Services.AddScoped<LabelService>();
builder.Services.AddScoped<FilterService>();

// ─── Phase 5: Setup wizard ───────────────────────────────────────────────────
builder.Services.AddScoped<SetupService>();

builder.Services.AddCors(o => o.AddPolicy("AllowWeb", p =>
    p.WithOrigins("http://localhost:3000", "https://webmail.aeroverra.com")
     .AllowAnyMethod().AllowAnyHeader()));

// ─── JWT Authentication ───────────────────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "CHANGE_ME_IN_PRODUCTION_MIN_32_CHARS!!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "aeromail";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "aeromail-users";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = ctx =>
            {
                var authService = ctx.HttpContext.RequestServices.GetRequiredService<IAuthService>();
                var jti = ctx.Principal?.FindFirst("jti")?.Value ?? string.Empty;
                if (authService.IsTokenRevoked(jti))
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
