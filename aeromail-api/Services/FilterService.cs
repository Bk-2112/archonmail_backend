using Dapper;
using Npgsql;
using AeroMail.Api.Models;
using AeroMail.Api.Database;

namespace AeroMail.Api.Services;

/// <summary>
/// Filter / Rules engine. Stores filter definitions and applies them to incoming messages.
/// </summary>
public class FilterService
{
    private readonly DatabaseService _db;
    private readonly LabelService _labelService;

    public FilterService(DatabaseService db, LabelService labelService)
    {
        _db = db;
        _labelService = labelService;
    }

    // ─── Query ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Return all filters for an account.
    /// </summary>
    public async Task<List<AeroFilter>> GetFiltersAsync(Guid accountId)
    {
        const string sql = @"
            SELECT id                AS Id,
                   account_id       AS AccountId,
                   from_pattern     AS FromPattern,
                   to_pattern       AS ToPattern,
                   subject_pattern  AS SubjectPattern,
                   has_words        AS HasWords,
                   action           AS Action,
                   action_label_id  AS ActionLabelId,
                   is_active        AS IsActive,
                   created_at       AS CreatedAt
            FROM   filters
            WHERE  account_id = @accountId
            ORDER  BY created_at";

        using var conn = _db.GetConnection();
        var results = await conn.QueryAsync<AeroFilter>(sql, new { accountId });
        return results.AsList();
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Persist a new filter and return the created record.
    /// </summary>
    public async Task<AeroFilter> CreateFilterAsync(Guid accountId, AeroFilter filter)
    {
        const string sql = @"
            INSERT INTO filters
                (account_id, from_pattern, to_pattern, subject_pattern,
                 has_words, action, action_label_id, is_active)
            VALUES
                (@accountId, @fromPattern, @toPattern, @subjectPattern,
                 @hasWords, @action, @actionLabelId, @isActive)
            RETURNING id                AS Id,
                      account_id       AS AccountId,
                      from_pattern     AS FromPattern,
                      to_pattern       AS ToPattern,
                      subject_pattern  AS SubjectPattern,
                      has_words        AS HasWords,
                      action           AS Action,
                      action_label_id  AS ActionLabelId,
                      is_active        AS IsActive,
                      created_at       AS CreatedAt";

        using var conn = _db.GetConnection();
        var result = await conn.QuerySingleAsync<AeroFilter>(sql, new
        {
            accountId,
            fromPattern    = filter.FromPattern,
            toPattern      = filter.ToPattern,
            subjectPattern = filter.SubjectPattern,
            hasWords       = filter.HasWords,
            action         = filter.Action,
            actionLabelId  = filter.ActionLabelId,
            isActive       = filter.IsActive
        });
        return result;
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    public async Task DeleteFilterAsync(Guid filterId)
    {
        const string sql = "DELETE FROM filters WHERE id = @filterId";
        using var conn = _db.GetConnection();
        await conn.ExecuteAsync(sql, new { filterId });
    }

    // ─── Rules Engine ─────────────────────────────────────────────────────────

    /// <summary>
    /// Run all active filters for an account against an incoming message.
    /// Returns true when at least one filter matched and an action was applied.
    /// </summary>
    public async Task<bool> ApplyFiltersToMessageAsync(Guid accountId, AeroMessage message)
    {
        var filters = await GetFiltersAsync(accountId);
        var activeFilters = filters.Where(f => f.IsActive).ToList();

        if (activeFilters.Count == 0) return false;

        bool anyMatched = false;

        foreach (var filter in activeFilters)
        {
            if (!MatchesFilter(filter, message)) continue;

            anyMatched = true;
            await ExecuteActionAsync(filter, message);
        }

        return anyMatched;
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /// <summary>
    /// Check if a message satisfies all non-null criteria in a filter (AND semantics).
    /// </summary>
    private static bool MatchesFilter(AeroFilter filter, AeroMessage message)
    {
        if (!string.IsNullOrWhiteSpace(filter.FromPattern) &&
            !Contains(message.From, filter.FromPattern))
            return false;

        if (!string.IsNullOrWhiteSpace(filter.ToPattern) &&
            !message.To.Any(t => Contains(t, filter.ToPattern!)))
            return false;

        if (!string.IsNullOrWhiteSpace(filter.SubjectPattern) &&
            !Contains(message.Subject, filter.SubjectPattern))
            return false;

        if (!string.IsNullOrWhiteSpace(filter.HasWords))
        {
            var words = filter.HasWords.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (!words.All(w =>
                Contains(message.Subject, w) ||
                Contains(message.Snippet, w) ||
                Contains(message.Body, w)))
                return false;
        }

        return true;
    }

    /// <summary>
    /// Execute the filter's configured action against the matched message.
    /// </summary>
    private async Task ExecuteActionAsync(AeroFilter filter, AeroMessage message)
    {
        if (message.Id == Guid.Empty) return; // message not yet persisted — skip DB actions

        switch (filter.Action.ToLowerInvariant())
        {
            case "archive":
                await UpdateMessageFolderAsync(message.Id, "Archive");
                break;

            case "delete":
                await UpdateMessageFolderAsync(message.Id, "Trash");
                break;

            case "markread":
            case "mark_read":
                await SetMessageReadAsync(message.Id, true);
                break;

            case "label" when filter.ActionLabelId.HasValue:
                // Fetch the label name for the JSONB labels array
                var labelName = await GetLabelNameAsync(filter.ActionLabelId.Value);
                if (labelName != null)
                    await _labelService.ApplyLabelAsync(message.Id, labelName);
                break;

            case "star":
                await SetMessageStarredAsync(message.Id, true);
                break;

            default:
                // Unknown action — log and continue
                break;
        }
    }

    private async Task UpdateMessageFolderAsync(Guid messageId, string folder)
    {
        const string sql = "UPDATE messages SET folder = @folder WHERE id = @messageId";
        using var conn = _db.GetConnection();
        await conn.ExecuteAsync(sql, new { messageId, folder });
    }

    private async Task SetMessageReadAsync(Guid messageId, bool isRead)
    {
        const string sql = "UPDATE messages SET is_read = @isRead WHERE id = @messageId";
        using var conn = _db.GetConnection();
        await conn.ExecuteAsync(sql, new { messageId, isRead });
    }

    private async Task SetMessageStarredAsync(Guid messageId, bool isStarred)
    {
        const string sql = "UPDATE messages SET is_starred = @isStarred WHERE id = @messageId";
        using var conn = _db.GetConnection();
        await conn.ExecuteAsync(sql, new { messageId, isStarred });
    }

    private async Task<string?> GetLabelNameAsync(Guid labelId)
    {
        const string sql = "SELECT name FROM labels WHERE id = @labelId";
        using var conn = _db.GetConnection();
        return await conn.QuerySingleOrDefaultAsync<string>(sql, new { labelId });
    }

    private static bool Contains(string? source, string pattern) =>
        source != null && source.Contains(pattern, StringComparison.OrdinalIgnoreCase);
}
