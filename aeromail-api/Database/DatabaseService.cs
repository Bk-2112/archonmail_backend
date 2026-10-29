using Dapper;
using Npgsql;

namespace AeroMail.Api.Database;

public class DatabaseService
{
    private readonly string _connectionString;

    public DatabaseService(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' not found.");
    }

    public NpgsqlConnection GetConnection() => new NpgsqlConnection(_connectionString);

    public async Task InitializeAsync()
    {
        var sql = await File.ReadAllTextAsync("Database/schema.sql");
        using var conn = GetConnection();
        await conn.ExecuteAsync(sql);
    }
}
