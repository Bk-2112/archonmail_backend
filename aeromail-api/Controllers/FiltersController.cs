using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AeroMail.Api.Models;
using AeroMail.Api.Services;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/filters")]
[Authorize]
public class FiltersController : ControllerBase
{
    private readonly FilterService _filters;

    public FiltersController(FilterService filters)
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

    // ─── GET /api/filters ────────────────────────────────────────────────────

    /// <summary>
    /// List all filters / rules for the authenticated account.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetFilters()
    {
        var accountId = GetAccountId();
        var filters = await _filters.GetFiltersAsync(accountId);
        return Ok(filters);
    }

    // ─── POST /api/filters ───────────────────────────────────────────────────

    /// <summary>
    /// Create a new filter rule.
    /// Body: { fromPattern?, toPattern?, subjectPattern?, hasWords?, action, actionLabelId? }
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateFilter([FromBody] CreateFilterRequest request)
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
        return CreatedAtAction(nameof(GetFilters), new { id = created.Id }, created);
    }

    // ─── DELETE /api/filters/{id} ────────────────────────────────────────────

    /// <summary>
    /// Delete a filter rule.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteFilter(Guid id)
    {
        await _filters.DeleteFilterAsync(id);
        return NoContent();
    }
}

// ─── Request Models ───────────────────────────────────────────────────────────

public record CreateFilterRequest(
    string? FromPattern,
    string? ToPattern,
    string? SubjectPattern,
    string? HasWords,
    string Action,
    Guid? ActionLabelId
);
