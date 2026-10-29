using Dapper;
using Npgsql;
using AeroMail.Api.Models;
using AeroMail.Api.Database;

namespace AeroMail.Api.Services;

/// <summary>
/// Label CRUD operations against PostgreSQL.
/// Labels live in the `labels` table; message label associations are stored
/// as a JSONB array in `messages.labels`.
/// </summary>
public class LabelService
{
    private readonly DatabaseService _db;

    public LabelService(DatabaseService db)
    {
        _db = db;
    }

    // ─── Query ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Return all labels for an account, system labels first, then alphabetical.
    /// </summary>
    public async Task<List<AeroLabel>> GetLabelsAsync(Guid accountId)
    {
        const string sql = @"
            SELECT id            AS Id,
                   account_id   AS AccountId,
                   name         AS Name,
                   color        AS Color,
                   is_system    AS IsSystem
            FROM   labels
            WHERE  account_id = @accountId
            ORDER  BY is_system DESC, name";

        using var conn = _db.GetConnection();
        var results = await conn.QueryAsync<AeroLabel>(sql, new { accountId });
        return results.AsList();
    }

    // ─── Create ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Insert a new user label and return the created record.
    /// </summary>
    public async Task<AeroLabel> CreateLabelAsync(Guid accountId, string name, string color)
    {
        const string sql = @"
            INSERT INTO labels (account_id, name, color)
            VALUES (@accountId, @name, @color)
            RETURNING id          AS Id,
                      account_id  AS AccountId,
                      name        AS Name,
                      color       AS Color,
                      is_system   AS IsSystem";

        using var conn = _db.GetConnection();
        var result = await conn.QuerySingleAsync<AeroLabel>(sql, new { accountId, name, color });
        return result;
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Partial-update a label's name and/or color. NULL values are left unchanged.
    /// </summary>
    public async Task UpdateLabelAsync(Guid labelId, string? name, string? color)
    {
        const string sql = @"
            UPDATE labels
            SET    name  = COALESCE(@name,  name),
                   color = COALESCE(@color, color)
            WHERE  id = @labelId";

        using var conn = _db.GetConnection();
        await conn.ExecuteAsync(sql, new { labelId, name, color });
    }

    // ─── Delete ───────────────────────────────────────────────────────────────

    /// <summary>
    /// Delete a label. The ON DELETE CASCADE on message_labels removes associations.
    /// Messages themselves are NOT deleted.
    /// </summary>
    public async Task DeleteLabelAsync(Guid labelId)
    {
        const string sql = "DELETE FROM labels WHERE id = @labelId";
        using var conn = _db.GetConnection();
        await conn.ExecuteAsync(sql, new { labelId });
    }

    // ─── Apply ────────────────────────────────────────────────────────────────

    /// <summary>
    /// Append a label name to the JSONB labels array on a message.
    /// Idempotent: if the label already exists the array stays clean because
    /// we rely on the frontend / filter service to avoid duplicates.
    /// </summary>
    public async Task ApplyLabelAsync(Guid messageId, string labelName)
    {
        const string sql = @"
            UPDATE messages
            SET    labels = labels || to_jsonb(@labelName::text)
            WHERE  id = @messageId
              AND  NOT (labels @> to_jsonb(@labelName::text))";

        using var conn = _db.GetConnection();
        await conn.ExecuteAsync(sql, new { messageId, labelName });
    }

    /// <summary>
    /// Remove a label name from the JSONB labels array on a message.
    /// </summary>
    public async Task RemoveLabelAsync(Guid messageId, string labelName)
    {
        // PostgreSQL: remove all occurrences of the value from a JSON array
        const string sql = @"
            UPDATE messages
            SET    labels = (
                SELECT jsonb_agg(elem)
                FROM   jsonb_array_elements(labels) AS elem
                WHERE  elem <> to_jsonb(@labelName::text)
            )
            WHERE id = @messageId";

        using var conn = _db.GetConnection();
        await conn.ExecuteAsync(sql, new { messageId, labelName });
    }
}
