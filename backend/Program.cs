using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using TeamArchon.Mail.Api.Middleware;
using TeamArchon.Mail.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Add Configuration Sources
builder.Configuration
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
    .AddJsonFile($"/etc/teamarchon-api/teamarchon-api.env", optional: true)
    .AddEnvironmentVariables();

// 2. HTTP Client for Discord API and Webhooks
builder.Services.AddHttpClient();
builder.Services.AddHttpClient("DiscordWebhooks", client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// 3. Register Core Services
builder.Services.AddSingleton<DatabaseService>();
builder.Services.AddSingleton<EncryptionService>();
builder.Services.AddSingleton<UserRepository>();
builder.Services.AddSingleton<StalwartMailService>();
builder.Services.AddScoped<IDiscordAuthService, DiscordAuthService>();

// 4. Categorized Discord Webhook Logging Engine (Hosted Background Service)
builder.Services.AddSingleton<DiscordWebhookLogger>();
builder.Services.AddSingleton<IDiscordLogService>(sp => sp.GetRequiredService<DiscordWebhookLogger>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<DiscordWebhookLogger>());

// 5. JWT Authentication
var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? "teamarchon_super_secret_jwt_key_minimum_32_characters!";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = true,
        ValidIssuer = "TeamArchonMailApi",
        ValidateAudience = true,
        ValidAudience = "TeamArchonWeb",
        ClockSkew = TimeSpan.FromMinutes(5)
    };
});

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// 6. CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWebClient", policy =>
    {
        policy.WithOrigins(
                "https://mail.teamarchon.in",
                "https://portal.teamarchon.in",
                "http://localhost:5173",
                "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// 7. Middleware Pipeline
app.UseMiddleware<GlobalErrorHandlingMiddleware>();
app.UseCors("AllowWebClient");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// 8. Log System Startup to #system-logs Webhook
var discordLogger = app.Services.GetRequiredService<IDiscordLogService>();
discordLogger.LogSystem(
    "Team Archon Mail API Started",
    "API backend initialized successfully on port 8787 in Ground Zero mode.",
    new[]
    {
        ("Environment", app.Environment.EnvironmentName),
        ("Version", "3.0.0"),
        ("Auth Gateway", "Discord OAuth2 (Gated)"),
        ("Database", "Supabase PostgreSQL")
    });

app.Run();
