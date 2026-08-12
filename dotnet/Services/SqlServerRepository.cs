using System.Text.Json;
using System.Text.Json.Nodes;
using Dapper;
using Microsoft.Data.SqlClient;

namespace KaizenApp.Services;

public sealed class SqlServerRepository
{
    private readonly string _connectionString;
    private readonly IWebHostEnvironment _environment;
    private readonly ToolCatalog _catalog;
    private readonly ILogger<SqlServerRepository> _logger;

    public SqlServerRepository(IConfiguration configuration, IWebHostEnvironment environment, ToolCatalog catalog,
        ILogger<SqlServerRepository> logger)
    {
        var configuredConnectionString = configuration.GetConnectionString("SqlServer");
        _connectionString = !string.IsNullOrWhiteSpace(configuredConnectionString)
            ? configuredConnectionString
            : Environment.GetEnvironmentVariable("SQLAZURECONNSTR_SqlServer")
                ?? Environment.GetEnvironmentVariable("SQLCONNSTR_SqlServer")
                ?? "";
        _environment = environment;
        _catalog = catalog;
        _logger = logger;
        DefaultTypeMap.MatchNamesWithUnderscores = true;
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_connectionString);

    public async Task InitializeAsync()
    {
        if (!IsConfigured)
        {
            _logger.LogWarning("ConnectionStrings:SqlServer absente : les API de donnees resteront indisponibles.");
            return;
        }

        var candidates = new[]
        {
            Path.Combine(_environment.ContentRootPath, "Sql", "schema.sql"),
            Path.Combine(AppContext.BaseDirectory, "Sql", "schema.sql")
        };
        var schemaPath = candidates.FirstOrDefault(File.Exists)
            ?? throw new FileNotFoundException("Script Sql/schema.sql introuvable.");
        var schema = await File.ReadAllTextAsync(schemaPath);

        Exception? lastError = null;
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            try
            {
                await using var connection = await OpenAsync();
                await connection.ExecuteAsync(schema, commandTimeout: 90);
                _logger.LogInformation("Base SQL Server prete.");
                return;
            }
            catch (Exception ex)
            {
                lastError = ex;
                _logger.LogWarning(ex, "Initialisation SQL Server impossible (tentative {Attempt}/5).", attempt);
                if (attempt < 5) await Task.Delay(TimeSpan.FromSeconds(2));
            }
        }
        throw new InvalidOperationException("La base SQL Server n'a pas pu etre initialisee.", lastError);
    }

    public async Task<bool> IsHealthyAsync()
    {
        if (!IsConfigured) return false;
        await using var connection = await OpenAsync();
        return await connection.ExecuteScalarAsync<int>(
            "SELECT CASE WHEN OBJECT_ID(N'dbo.Chantiers', N'U') IS NULL THEN 0 ELSE 1 END") == 1;
    }

    public async Task<List<ChantierDto>> GetChantiersAsync()
    {
        await using var connection = await OpenAsync();
        var rows = await connection.QueryAsync<ChantierRow>("SELECT * FROM dbo.Chantiers ORDER BY CreatedAt DESC, Id DESC");
        return rows.Select(MapChantier).ToList();
    }

    public async Task<ChantierDto?> GetChantierAsync(int id)
    {
        await using var connection = await OpenAsync();
        var row = await connection.QuerySingleOrDefaultAsync<ChantierRow>(
            "SELECT * FROM dbo.Chantiers WHERE Id = @id", new { id });
        if (row is null) return null;

        var chantier = MapChantier(row);
        chantier.Actions = (await connection.QueryAsync<ActionDto>(
            "SELECT Id, ChantierId, Description, Responsable, Echeance, Statut, CreatedAt FROM dbo.Actions WHERE ChantierId = @id ORDER BY Id", new { id })).ToList();
        chantier.Indicateurs = (await connection.QueryAsync<IndicateurDto>(
            "SELECT Id, ChantierId, Nom, Unite, ValeurAvant, ValeurApres FROM dbo.Indicateurs WHERE ChantierId = @id ORDER BY Id", new { id })).ToList();
        var photos = (await connection.QueryAsync<PhotoDto>(
            "SELECT Id, ActionId, OutilId, Filename, MimeType, Data, CreatedAt FROM dbo.Photos WHERE ChantierId = @id ORDER BY Id", new { id })).ToList();

        chantier.Photos = photos.Where(p => p.ActionId is null && string.IsNullOrWhiteSpace(p.OutilId)).ToList();
        foreach (var action in chantier.Actions)
            action.Photos = photos.Where(p => p.ActionId == action.Id).ToList();
        foreach (var photo in photos.Where(p => p.ActionId is null && !string.IsNullOrWhiteSpace(p.OutilId)))
            chantier.PhotosOutils.GetOrAdd(photo.OutilId!).Add(photo);

        var supportRows = await connection.QueryAsync<SupportRow>(
            "SELECT OutilId, Donnees, UpdatedAt FROM dbo.Supports WHERE ChantierId = @id", new { id });
        foreach (var support in supportRows)
        {
            try
            {
                var data = JsonNode.Parse(support.Donnees)?.AsObject() ?? [];
                chantier.Supports[support.OutilId] = new SupportDto
                {
                    Header = data["header"]?.AsObject() ?? [],
                    Fields = data["fields"]?.AsObject() ?? [],
                    UpdatedAt = support.UpdatedAt
                };
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Support illisible pour le chantier {ChantierId}, outil {OutilId}.", id, support.OutilId);
            }
        }
        return chantier;
    }

    public async Task<ChantierDto> CreateChantierAsync(ChantierRequest request)
    {
        var tools = _catalog.SortTools(request.Outils);
        await using var connection = await OpenAsync();
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        try
        {
            var id = await connection.ExecuteScalarAsync<int>("""
                INSERT INTO dbo.Chantiers
                    (Titre, Probleme, Perimetre, Pilote, Equipe, Objectif, Outils, DateDebut, DateFin, Statut, EligibleKaizen, QuizReponses)
                VALUES
                    (@Titre, @Probleme, @Perimetre, @Pilote, @Equipe, @Objectif, @Outils, @DateDebut, @DateFin, @Statut, @EligibleKaizen, @QuizReponses);
                SELECT CAST(SCOPE_IDENTITY() AS INT);
                """, new
            {
                Titre = request.Titre!.Trim(),
                Probleme = request.Probleme?.Trim() ?? "",
                Perimetre = request.Perimetre?.Trim() ?? "",
                Pilote = request.Pilote?.Trim() ?? "",
                Equipe = JsonSerializer.Serialize(request.Equipe ?? []),
                Objectif = request.Objectif?.Trim() ?? "",
                Outils = JsonSerializer.Serialize(tools),
                DateDebut = request.DateDebut ?? "",
                DateFin = request.DateFin ?? "",
                Statut = request.Statut ?? "a_traiter",
                EligibleKaizen = request.EligibleKaizen is null ? (int?)null : request.EligibleKaizen.Value ? 1 : 0,
                QuizReponses = request.QuizReponses?.ToJsonString()
            }, transaction);

            foreach (var toolId in tools)
            {
                await connection.ExecuteAsync("""
                    INSERT INTO dbo.Actions (ChantierId, Description, Responsable, Echeance, Statut)
                    VALUES (@id, @description, N'', N'', N'a_faire')
                    """, new { id, description = $"Realiser : {_catalog.GetToolName(toolId) ?? toolId}" }, transaction);
            }
            await transaction.CommitAsync();
            return (await GetChantierAsync(id))!;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<ChantierDto?> UpdateChantierAsync(int id, ChantierRequest request)
    {
        await using var connection = await OpenAsync();
        var existing = await connection.QuerySingleOrDefaultAsync<ChantierRow>(
            "SELECT * FROM dbo.Chantiers WHERE Id = @id", new { id });
        if (existing is null) return null;
        var tools = _catalog.SortTools(request.Outils);
        await connection.ExecuteAsync("""
            UPDATE dbo.Chantiers SET
                Titre=@Titre, Probleme=@Probleme, Perimetre=@Perimetre, Pilote=@Pilote, Equipe=@Equipe,
                Objectif=@Objectif, Outils=@Outils, DateDebut=@DateDebut, DateFin=@DateFin, Statut=@Statut,
                EligibleKaizen=@EligibleKaizen, QuizReponses=@QuizReponses
            WHERE Id=@Id
            """, new
        {
            Id = id,
            Titre = string.IsNullOrWhiteSpace(request.Titre) ? existing.Titre : request.Titre.Trim(),
            Probleme = request.Probleme?.Trim() ?? "",
            Perimetre = request.Perimetre?.Trim() ?? "",
            Pilote = request.Pilote?.Trim() ?? "",
            Equipe = JsonSerializer.Serialize(request.Equipe ?? []),
            Objectif = request.Objectif?.Trim() ?? "",
            Outils = JsonSerializer.Serialize(tools),
            DateDebut = request.DateDebut ?? "",
            DateFin = request.DateFin ?? "",
            Statut = request.Statut ?? "en_cours",
            EligibleKaizen = request.EligibleKaizen is null ? existing.EligibleKaizen : request.EligibleKaizen.Value ? 1 : 0,
            QuizReponses = request.QuizReponses?.ToJsonString() ?? existing.QuizReponses
        });
        return await GetChantierAsync(id);
    }

    public async Task<bool> DeleteChantierAsync(int id)
    {
        await using var connection = await OpenAsync();
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        try
        {
            await connection.ExecuteAsync("DELETE FROM dbo.Photos WHERE ChantierId=@id", new { id }, transaction);
            await connection.ExecuteAsync("DELETE FROM dbo.Actions WHERE ChantierId=@id", new { id }, transaction);
            await connection.ExecuteAsync("DELETE FROM dbo.Indicateurs WHERE ChantierId=@id", new { id }, transaction);
            await connection.ExecuteAsync("DELETE FROM dbo.Supports WHERE ChantierId=@id", new { id }, transaction);
            var count = await connection.ExecuteAsync("DELETE FROM dbo.Chantiers WHERE Id=@id", new { id }, transaction);
            await transaction.CommitAsync();
            return count > 0;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<ChantierDto?> AddActionAsync(int id, ActionRequest request)
    {
        if (!await ExistsAsync(id)) return null;
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("""
            INSERT INTO dbo.Actions (ChantierId, Description, Responsable, Echeance, Statut)
            VALUES (@id, @Description, @Responsable, @Echeance, @Statut)
            """, new { id, Description = request.Description!.Trim(), Responsable = request.Responsable?.Trim() ?? "", Echeance = request.Echeance ?? "", Statut = request.Statut ?? "a_faire" });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> UpdateActionAsync(int id, int actionId, ActionRequest request)
    {
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("""
            UPDATE dbo.Actions SET Description=@Description, Responsable=@Responsable, Echeance=@Echeance, Statut=@Statut
            WHERE Id=@actionId AND ChantierId=@id
            """, new { id, actionId, Description = request.Description?.Trim() ?? "", Responsable = request.Responsable?.Trim() ?? "", Echeance = request.Echeance ?? "", Statut = request.Statut ?? "a_faire" });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> DeleteActionAsync(int id, int actionId)
    {
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("DELETE FROM dbo.Photos WHERE ChantierId=@id AND ActionId=@actionId", new { id, actionId });
        await connection.ExecuteAsync("DELETE FROM dbo.Actions WHERE Id=@actionId AND ChantierId=@id", new { id, actionId });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> AddIndicatorAsync(int id, IndicateurRequest request)
    {
        if (!await ExistsAsync(id)) return null;
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("""
            INSERT INTO dbo.Indicateurs (ChantierId, Nom, Unite, ValeurAvant, ValeurApres)
            VALUES (@id, @Nom, @Unite, @ValeurAvant, @ValeurApres)
            """, new { id, Nom = request.Nom!.Trim(), Unite = request.Unite?.Trim() ?? "", request.ValeurAvant, request.ValeurApres });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> UpdateIndicatorAsync(int id, int indicatorId, IndicateurRequest request)
    {
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("""
            UPDATE dbo.Indicateurs SET Nom=@Nom, Unite=@Unite, ValeurAvant=@ValeurAvant, ValeurApres=@ValeurApres
            WHERE Id=@indicatorId AND ChantierId=@id
            """, new { id, indicatorId, Nom = request.Nom?.Trim() ?? "", Unite = request.Unite?.Trim() ?? "", request.ValeurAvant, request.ValeurApres });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> DeleteIndicatorAsync(int id, int indicatorId)
    {
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("DELETE FROM dbo.Indicateurs WHERE Id=@indicatorId AND ChantierId=@id", new { id, indicatorId });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> SaveSupportAsync(int id, string toolId, SupportRequest request)
    {
        if (!await ExistsAsync(id)) return null;
        var data = new JsonObject { ["header"] = request.Header?.DeepClone() ?? new JsonObject(), ["fields"] = request.Fields?.DeepClone() ?? new JsonObject() };
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("""
            MERGE dbo.Supports AS target
            USING (SELECT @id AS ChantierId, @toolId AS OutilId) AS source
            ON target.ChantierId=source.ChantierId AND target.OutilId=source.OutilId
            WHEN MATCHED THEN UPDATE SET Donnees=@data, UpdatedAt=SYSDATETIMEOFFSET()
            WHEN NOT MATCHED THEN INSERT (ChantierId, OutilId, Donnees) VALUES (@id, @toolId, @data);
            """, new { id, toolId, data = data.ToJsonString() });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> DeleteSupportAsync(int id, string toolId)
    {
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("DELETE FROM dbo.Supports WHERE ChantierId=@id AND OutilId=@toolId", new { id, toolId });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> AddPhotoAsync(int id, PhotoRequest request)
    {
        if (!await ExistsAsync(id)) return null;
        var toolId = !string.IsNullOrWhiteSpace(request.OutilId) && _catalog.ToolExists(request.OutilId) ? request.OutilId : null;
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("""
            INSERT INTO dbo.Photos (ChantierId, ActionId, OutilId, Filename, MimeType, Data)
            VALUES (@id, @ActionId, @toolId, @Filename, @MimeType, @Data)
            """, new { id, request.ActionId, toolId, Filename = request.Filename ?? "", MimeType = request.MimeType ?? "", Data = request.Data! });
        return await GetChantierAsync(id);
    }

    public async Task<ChantierDto?> DeletePhotoAsync(int id, int photoId)
    {
        await using var connection = await OpenAsync();
        await connection.ExecuteAsync("DELETE FROM dbo.Photos WHERE Id=@photoId AND ChantierId=@id", new { id, photoId });
        return await GetChantierAsync(id);
    }

    public async Task<object> GetDashboardAsync()
    {
        await using var connection = await OpenAsync();
        var statuses = (await connection.QueryAsync<(string Statut, int N)>(
            "SELECT Statut, COUNT(*) AS N FROM dbo.Chantiers GROUP BY Statut")).ToDictionary(x => x.Statut, x => x.N);
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var late = (await connection.QueryAsync("""
            SELECT a.Id AS id, a.Description AS description, a.Responsable AS responsable, a.Echeance AS echeance,
                   a.ChantierId AS chantier_id, c.Titre AS chantier_titre
            FROM dbo.Actions a INNER JOIN dbo.Chantiers c ON c.Id=a.ChantierId
            WHERE a.Statut<>N'fait' AND a.Echeance<>N'' AND a.Echeance<@today ORDER BY a.Echeance
            """, new { today })).ToList();
        var indicators = (await connection.QueryAsync<(double Avant, double Apres)>("""
            SELECT ValeurAvant AS Avant, ValeurApres AS Apres FROM dbo.Indicateurs
            WHERE ValeurAvant IS NOT NULL AND ValeurApres IS NOT NULL AND ValeurAvant<>0
            """)).ToList();
        var gains = indicators.Select(i => ((i.Avant - i.Apres) / i.Avant) * 100).ToList();
        var totalActions = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.Actions");
        var actionsDone = await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.Actions WHERE Statut=N'fait'");
        return new
        {
            chantiersParStatut = statuses,
            totalChantiers = statuses.Values.Sum(),
            actionsEnRetard = late,
            totalActions,
            actionsFaites = actionsDone,
            gainMoyen = gains.Count > 0 ? gains.Average() : (double?)null,
            indicateursSuivis = gains.Count
        };
    }

    public async Task<string?> BuildChatContextAsync()
    {
        var chantiers = await GetChantiersAsync();
        if (chantiers.Count == 0) return null;
        var lines = new List<string> { $"{chantiers.Count} chantier(s) enregistres :" };
        foreach (var chantier in chantiers.Take(30))
            lines.Add($"- #{chantier.Id} {chantier.Titre} [{chantier.Statut}] - {chantier.Probleme} - Outils: {string.Join(", ", chantier.Outils.Select(id => _catalog.GetToolName(id) ?? id))}");
        return string.Join('\n', lines);
    }

    private async Task<bool> ExistsAsync(int id)
    {
        await using var connection = await OpenAsync();
        return await connection.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM dbo.Chantiers WHERE Id=@id", new { id }) > 0;
    }

    private async Task<SqlConnection> OpenAsync()
    {
        if (!IsConfigured) throw new InvalidOperationException("ConnectionStrings:SqlServer n'est pas configuree.");
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync();
        return connection;
    }

    private static ChantierDto MapChantier(ChantierRow row) => new()
    {
        Id = row.Id, Titre = row.Titre, Probleme = row.Probleme, Perimetre = row.Perimetre, Pilote = row.Pilote,
        Equipe = DeserializeList(row.Equipe), Objectif = row.Objectif, Outils = DeserializeList(row.Outils),
        DateDebut = row.DateDebut, DateFin = row.DateFin, Statut = row.Statut, EligibleKaizen = row.EligibleKaizen,
        QuizReponses = string.IsNullOrWhiteSpace(row.QuizReponses) ? null : JsonNode.Parse(row.QuizReponses), CreatedAt = row.CreatedAt
    };

    private static List<string> DeserializeList(string? json)
    {
        try { return JsonSerializer.Deserialize<List<string>>(json ?? "[]") ?? []; }
        catch (JsonException) { return []; }
    }
}

internal static class DictionaryExtensions
{
    public static TValue GetOrAdd<TKey, TValue>(this IDictionary<TKey, TValue> dictionary, TKey key)
        where TKey : notnull where TValue : new()
    {
        if (!dictionary.TryGetValue(key, out var value)) dictionary[key] = value = new TValue();
        return value;
    }
}
