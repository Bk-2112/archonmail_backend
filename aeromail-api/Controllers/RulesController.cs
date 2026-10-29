using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AeroMail.Api.Models;
using AeroMail.Api.Services;

namespace AeroMail.Api.Controllers;

/// <summary>
/// Alias route for filters — the spec uses /api/rules in some places.
/// Delegates to FilterService for full implementation.
/// </summary>
[ApiController]
[Route("api/rules")]
[Authorize]
public class RulesController : ControllerBase
{
    private readonly FilterService _filters;

    public RulesController(FilterService filters)
    {
        _filters = filters;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Guid GetAccountId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub")
               ?? throw new UnauthorizedAccessException("Missing account id claim.");
        return Guid.Parse(sub);
    }

    // ─── GET /api/rules ───────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetRules()
    {
        var accountId = GetAccountId();
        var rules = await _filters.GetFiltersAsync(accountId);
        return Ok(rules);
    }

    // ─── POST /api/rules ──────────────────────────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> CreateRule([FromBody] CreateRuleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Action))
            return BadRequest(new { error = "action is required." });

        var accountId = GetAccountId();

        var filter = new AeroFilter
        {
            FromPattern    = request.FromPattern,
            ToPattern      = request.ToPattern,
            SubjectPattern = request.SubjectPattern,
            HasWords       = request.HasWords,
            Action         = request.Action,
            ActionLabelId  = request.ActionLabelId,
            IsActive       = true
        };

        var created = await _filters.CreateFilterAsync(accountId, filter);
        return CreatedAtAction(nameof(GetRules), new { id = created.Id }, created);
    }

    // ─── DELETE /api/rules/{id} ───────────────────────────────────────────────

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteRule(Guid id)
    {
        await _filters.DeleteFilterAsync(id);
        return NoContent();
    }
}

// ─── Request Models ───────────────────────────────────────────────────────────

public record CreateRuleRequest(
    string? FromPattern,
    string? ToPattern,
    string? SubjectPattern,
    string? HasWords,
    string Action,
    Guid? ActionLabelId
);
