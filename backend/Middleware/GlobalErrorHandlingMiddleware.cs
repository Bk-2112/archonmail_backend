using System.Net;
using System.Security.Claims;
using System.Text.Json;
using TeamArchon.Mail.Api.Services;

namespace TeamArchon.Mail.Api.Middleware;

public class GlobalErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalErrorHandlingMiddleware> _logger;

    public GlobalErrorHandlingMiddleware(RequestDelegate next, ILogger<GlobalErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, IDiscordLogService discordLogger)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception intercepted on {Path}", context.Request.Path);

            var user = context.User.FindFirstValue(ClaimTypes.Name) ?? "Anonymous";

            // 100% Categorized Logging to #error-logs Webhook
            discordLogger.LogError(
                $"API Error on {context.Request.Method} {context.Request.Path}",
                ex,
                path: context.Request.Path,
                user: user);

            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var response = new
            {
                status = 500,
                message = "An internal server error occurred.",
                error = ex.Message
            };

            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
    }
}
