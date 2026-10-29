using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AeroMail.Api.Models;
using AeroMail.Api.Services;

namespace AeroMail.Api.Controllers;

[ApiController]
[Route("api/labels")]
[Authorize]
public class LabelsController : ControllerBase
{
    private readonly LabelService _labels;

    public LabelsController(LabelService labels)
    {
        _labels = labels;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private Guid GetAccountId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
               ?? User.FindFirstValue("sub")
               ?? throw new UnauthorizedAccessException("Missing account id claim.");
        return Guid.Parse(sub);
    }

    // ─── GET /api/labels ──────────────────────────────────────────────────────

    /// <summary>
    /// List all labels for the authenticated account.
    /// System labels are returned first, then user labels alphabetically.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetLabels()
    {
        var accountId = GetAccountId();
        var labels = await _labels.GetLabelsAsync(accountId);
        return Ok(labels);
    }

    // ─── POST /api/labels ─────────────────────────────────────────────────────

    /// <summary>
    /// Create a new label.
    /// Body: { name: string, color: string }
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateLabel([FromBody] CreateLabelRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { error = "Label name is required." });

        var accountId = GetAccountId();
        var label = await _labels.CreateLabelAsync(accountId, request.Name, request.Color ?? "#1a73e8");
        return CreatedAtAction(nameof(GetLabels), new { id = label.Id }, label);
    }

    // ─── PATCH /api/labels/{id} ───────────────────────────────────────────────

    /// <summary>
    /// Partially update a label's name and/or color.
    /// Body: { name?: string, color?: string }
    /// </summary>
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> UpdateLabel(Guid id, [FromBody] UpdateLabelRequest request)
    {
        await _labels.UpdateLabelAsync(id, request.Name, request.Color);
        return NoContent();
    }

    // ─── DELETE /api/labels/{id} ──────────────────────────────────────────────

    /// <summary>
    /// Delete a label (removes from all messages; does NOT delete messages).
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteLabel(Guid id)
    {
        await _labels.DeleteLabelAsync(id);
        return NoContent();
    }

    // ─── POST /api/labels/apply ───────────────────────────────────────────────

    /// <summary>
    /// Apply a label to a message by label name.
    /// Body: { messageId: guid, labelName: string }
    /// </summary>
    [HttpPost("apply")]
    public async Task<IActionResult> ApplyLabel([FromBody] ApplyLabelRequest request)
    {
        if (request.MessageId == Guid.Empty)
            return BadRequest(new { error = "messageId is required." });
        if (string.IsNullOrWhiteSpace(request.LabelName))
            return BadRequest(new { error = "labelName is required." });

        await _labels.ApplyLabelAsync(request.MessageId, request.LabelName);
        return NoContent();
    }
}

// ─── Request Models ───────────────────────────────────────────────────────────

public record CreateLabelRequest(string Name, string? Color);
public record UpdateLabelRequest(string? Name, string? Color);
public record ApplyLabelRequest(Guid MessageId, string LabelName);
