using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace KaizenApp;

// Couche d'acces aux donnees : porte fidelement la logique de server.js (Node/SQLite)
// vers Azure SQL avec Microsoft.Data.SqlClient et des requetes parametrees.
public sealed class Store
{
    private readonly string _connStr;
    private readonly Catalog _catalog;

    public Store(string connStr, Catalog catalog)
    {
        _connStr = connStr;
        _catalog = catalog;
    }

    private SqlConnection Open()
    {
        var conn = new SqlConnection(_connStr);
        conn.Open();
        return conn;
    }

    // Initialisation idempotente de la base au demarrage (equivalent du CREATE TABLE IF NOT EXISTS).
    public void InitDb(string schemaSqlPath)
    {
        var sql = File.ReadAllText(schemaSqlPath);
        using var conn = Open();
        using var cmd = new SqlCommand(sql, conn);
        cmd.ExecuteNonQuery();
    }

    // ---------- Helpers de lecture (colonne -> type C#) ----------
    private static string? S(object v) => v is DBNull ? null : Convert.ToString(v);
    private static int Int(object v) => Convert.ToInt32(v);
    private static int? NInt(object v) => v is DBNull ? null : Convert.ToInt32(v);
    private static double? NDouble(object v) => v is DBNull ? null : Convert.ToDouble(v);
    private static bool? NBool(object v) => v is DBNull ? null : Convert.ToBoolean(v);

    // Parse une colonne JSON (equipe / outils / quiz_reponses) en element re-serialisable.
    private static object? JsonCol(object v, object? fallback)
    {
        if (v is DBNull) return fallback;
        var s = Convert.ToString(v);
        if (string.IsNullOrEmpty(s)) return fallback;
        return JsonSerializer.Deserialize<JsonElement>(s);
    }

    private static void P(SqlCommand cmd, string name, object? value)
        => cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);

    public bool ChantierExists(int id)
    {
        using var conn = Open();
        using var cmd = new SqlCommand("SELECT 1 FROM chantiers WHERE id = @id", conn);
        P(cmd, "@id", id);
        return cmd.ExecuteScalar() is not null;
    }

    // ---------- Lecture des chantiers ----------
    public List<Dictionary<string, object?>> GetChantiers()
    {
        using var conn = Open();
        using var cmd = new SqlCommand("SELECT * FROM chantiers ORDER BY created_at DESC", conn);
        using var r = cmd.ExecuteReader();
        var list = new List<Dictionary<string, object?>>();
        while (r.Read())
        {
            list.Add(new Dictionary<string, object?>
            {
                ["id"] = Int(r["id"]),
                ["titre"] = S(r["titre"]),
                ["probleme"] = S(r["probleme"]),
                ["perimetre"] = S(r["perimetre"]),
                ["pilote"] = S(r["pilote"]),
                ["equipe"] = JsonCol(r["equipe"], Array.Empty<string>()),
                ["objectif"] = S(r["objectif"]),
                ["outils"] = JsonCol(r["outils"], Array.Empty<string>()),
                ["date_debut"] = S(r["date_debut"]),
                ["date_fin"] = S(r["date_fin"]),
                ["statut"] = S(r["statut"]),
                ["eligible_kaizen"] = NBool(r["eligible_kaizen"]),
                ["quiz_reponses"] = S(r["quiz_reponses"]),
                ["created_at"] = r["created_at"]
            });
        }
        return list;
    }

    public Dictionary<string, object?>? GetChantierFull(int id)
    {
        using var conn = Open();

        Dictionary<string, object?> chantier;
        using (var cmd = new SqlCommand("SELECT * FROM chantiers WHERE id = @id", conn))
        {
            P(cmd, "@id", id);
            using var r = cmd.ExecuteReader();
            if (!r.Read()) return null;
            chantier = new Dictionary<string, object?>
            {
                ["id"] = Int(r["id"]),
                ["titre"] = S(r["titre"]),
                ["probleme"] = S(r["probleme"]),
                ["perimetre"] = S(r["perimetre"]),
                ["pilote"] = S(r["pilote"]),
                ["equipe"] = JsonCol(r["equipe"], Array.Empty<string>()),
                ["objectif"] = S(r["objectif"]),
                ["outils"] = JsonCol(r["outils"], Array.Empty<string>()),
                ["date_debut"] = S(r["date_debut"]),
                ["date_fin"] = S(r["date_fin"]),
                ["statut"] = S(r["statut"]),
                ["eligible_kaizen"] = NBool(r["eligible_kaizen"]),
                ["quiz_reponses"] = JsonCol(r["quiz_reponses"], null),
                ["created_at"] = r["created_at"]
            };
        }

        // Photos du chantier (regroupees ensuite : niveau chantier vs niveau action).
        var photos = new List<Dictionary<string, object?>>();
        using (var cmd = new SqlCommand(
            "SELECT id, action_id, filename, mime_type, data, created_at FROM photos WHERE chantier_id = @id ORDER BY created_at ASC", conn))
        {
            P(cmd, "@id", id);
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                photos.Add(new Dictionary<string, object?>
                {
                    ["id"] = Int(r["id"]),
                    ["action_id"] = NInt(r["action_id"]),
                    ["filename"] = S(r["filename"]),
                    ["mime_type"] = S(r["mime_type"]),
                    ["data"] = S(r["data"]),
                    ["created_at"] = r["created_at"]
                });
            }
        }

        // Actions du plan d'action, chacune avec ses photos rattachees.
        var actions = new List<Dictionary<string, object?>>();
        using (var cmd = new SqlCommand("SELECT * FROM actions WHERE chantier_id = @id ORDER BY created_at ASC", conn))
        {
            P(cmd, "@id", id);
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                var actionId = Int(r["id"]);
                actions.Add(new Dictionary<string, object?>
                {
                    ["id"] = actionId,
                    ["chantier_id"] = Int(r["chantier_id"]),
                    ["description"] = S(r["description"]),
                    ["responsable"] = S(r["responsable"]),
                    ["echeance"] = S(r["echeance"]),
                    ["statut"] = S(r["statut"]),
                    ["created_at"] = r["created_at"],
                    ["photos"] = photos.Where(p => (int?)p["action_id"] == actionId).ToList()
                });
            }
        }

        var indicateurs = new List<Dictionary<string, object?>>();
        using (var cmd = new SqlCommand("SELECT * FROM indicateurs WHERE chantier_id = @id ORDER BY id ASC", conn))
        {
            P(cmd, "@id", id);
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                indicateurs.Add(new Dictionary<string, object?>
                {
                    ["id"] = Int(r["id"]),
                    ["chantier_id"] = Int(r["chantier_id"]),
                    ["nom"] = S(r["nom"]),
                    ["unite"] = S(r["unite"]),
                    ["valeur_avant"] = NDouble(r["valeur_avant"]),
                    ["valeur_apres"] = NDouble(r["valeur_apres"])
                });
            }
        }

        chantier["actions"] = actions;
        chantier["indicateurs"] = indicateurs;
        chantier["photos"] = photos.Where(p => p["action_id"] is null).ToList();
        return chantier;
    }

    // ---------- Creation / mise a jour / suppression de chantiers ----------
    public (int? id, string? error) CreateChantier(
        string titre, string? probleme, string? perimetre, string? pilote,
        IReadOnlyList<string> equipe, string? objectif, IReadOnlyList<string> outils,
        string? dateDebut, string? dateFin, string? statut, bool? eligibleKaizen, string? quizReponsesJson)
    {
        var outilsTries = _catalog.SortOutilsByPhase(outils);

        // Un chantier "a traiter" sans outil est un irritant brut, pas encore qualifie :
        // on ne bloque que si des outils sont choisis mais couvrent mal les 3 phases requises.
        if (outilsTries.Count > 0)
        {
            var manquantes = _catalog.MissingRequiredPhaseLabels(outilsTries);
            if (manquantes.Count > 0)
                return (null, $"Choisis au moins un outil de : {string.Join(", ", manquantes)}");
        }

        using var conn = Open();
        using var tx = conn.BeginTransaction();
        try
        {
            int newId;
            using (var cmd = new SqlCommand(@"
                INSERT INTO chantiers (titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin, statut, eligible_kaizen, quiz_reponses)
                VALUES (@titre, @probleme, @perimetre, @pilote, @equipe, @objectif, @outils, @date_debut, @date_fin, @statut, @eligible, @quiz);
                SELECT CAST(SCOPE_IDENTITY() AS INT);", conn, tx))
            {
                P(cmd, "@titre", titre);
                P(cmd, "@probleme", probleme ?? "");
                P(cmd, "@perimetre", perimetre ?? "");
                P(cmd, "@pilote", pilote ?? "");
                P(cmd, "@equipe", JsonSerializer.Serialize(equipe));
                P(cmd, "@objectif", objectif ?? "");
                P(cmd, "@outils", JsonSerializer.Serialize(outilsTries));
                P(cmd, "@date_debut", dateDebut ?? "");
                P(cmd, "@date_fin", dateFin ?? "");
                P(cmd, "@statut", string.IsNullOrEmpty(statut) ? "a_traiter" : statut);
                P(cmd, "@eligible", eligibleKaizen.HasValue ? (eligibleKaizen.Value ? 1 : 0) : (object?)null);
                P(cmd, "@quiz", (object?)quizReponsesJson);
                newId = Convert.ToInt32(cmd.ExecuteScalar());
            }

            // Pre-remplit le plan d'action : une action par outil, dans l'ordre des phases.
            foreach (var outilId in outilsTries)
            {
                var name = _catalog.ToolName(outilId);
                if (name is null) continue;
                using var actCmd = new SqlCommand(@"
                    INSERT INTO actions (chantier_id, description, responsable, echeance, statut)
                    VALUES (@cid, @desc, '', '', 'a_faire');", conn, tx);
                P(actCmd, "@cid", newId);
                P(actCmd, "@desc", $"Realiser : {name}");
                actCmd.ExecuteNonQuery();
            }

            tx.Commit();
            return (newId, null);
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    public bool UpdateChantier(
        int id, string titre, string? probleme, string? perimetre, string? pilote,
        IReadOnlyList<string> equipe, string? objectif, IReadOnlyList<string> outils,
        string? dateDebut, string? dateFin, string? statut,
        bool? eligibleProvided, bool? eligibleValue, bool quizProvided, string? quizReponsesJson)
    {
        using var conn = Open();

        // Recupere l'existant pour ne pas effacer eligible/quiz si l'edition ne les fournit pas.
        object? existingEligible, existingQuiz;
        using (var cmd = new SqlCommand("SELECT eligible_kaizen, quiz_reponses FROM chantiers WHERE id = @id", conn))
        {
            P(cmd, "@id", id);
            using var r = cmd.ExecuteReader();
            if (!r.Read()) return false;
            existingEligible = r["eligible_kaizen"] is DBNull ? null : Convert.ToInt32(r["eligible_kaizen"]);
            existingQuiz = r["quiz_reponses"] is DBNull ? null : Convert.ToString(r["quiz_reponses"]);
        }

        var nextEligible = eligibleProvided == true
            ? (eligibleValue == true ? 1 : 0)
            : existingEligible;
        var nextQuiz = quizProvided ? quizReponsesJson : existingQuiz;

        using (var cmd = new SqlCommand(@"
            UPDATE chantiers SET titre = @titre, probleme = @probleme, perimetre = @perimetre, pilote = @pilote,
                equipe = @equipe, objectif = @objectif, outils = @outils, date_debut = @date_debut, date_fin = @date_fin,
                statut = @statut, eligible_kaizen = @eligible, quiz_reponses = @quiz
            WHERE id = @id", conn))
        {
            P(cmd, "@titre", titre);
            P(cmd, "@probleme", probleme ?? "");
            P(cmd, "@perimetre", perimetre ?? "");
            P(cmd, "@pilote", pilote ?? "");
            P(cmd, "@equipe", JsonSerializer.Serialize(equipe));
            P(cmd, "@objectif", objectif ?? "");
            P(cmd, "@outils", JsonSerializer.Serialize(_catalog.SortOutilsByPhase(outils)));
            P(cmd, "@date_debut", dateDebut ?? "");
            P(cmd, "@date_fin", dateFin ?? "");
            P(cmd, "@statut", string.IsNullOrEmpty(statut) ? "en_cours" : statut);
            P(cmd, "@eligible", nextEligible);
            P(cmd, "@quiz", (object?)nextQuiz);
            P(cmd, "@id", id);
            cmd.ExecuteNonQuery();
        }
        return true;
    }

    public void DeleteChantier(int id)
    {
        using var conn = Open();
        using var tx = conn.BeginTransaction();
        try
        {
            // Ordre impose par les cles etrangeres : photos/actions/indicateurs avant le chantier.
            foreach (var sql in new[]
            {
                "DELETE FROM photos WHERE chantier_id = @id",
                "DELETE FROM actions WHERE chantier_id = @id",
                "DELETE FROM indicateurs WHERE chantier_id = @id",
                "DELETE FROM chantiers WHERE id = @id"
            })
            {
                using var cmd = new SqlCommand(sql, conn, tx);
                P(cmd, "@id", id);
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }
    }

    // ---------- Actions ----------
    public void AddAction(int chantierId, string description, string? responsable, string? echeance, string? statut)
    {
        using var conn = Open();
        using var cmd = new SqlCommand(@"
            INSERT INTO actions (chantier_id, description, responsable, echeance, statut)
            VALUES (@cid, @desc, @resp, @ech, @statut)", conn);
        P(cmd, "@cid", chantierId);
        P(cmd, "@desc", description);
        P(cmd, "@resp", responsable ?? "");
        P(cmd, "@ech", echeance ?? "");
        P(cmd, "@statut", string.IsNullOrEmpty(statut) ? "a_faire" : statut);
        cmd.ExecuteNonQuery();
    }

    public void UpdateAction(int chantierId, int actionId, string? description, string? responsable, string? echeance, string? statut)
    {
        using var conn = Open();
        using var cmd = new SqlCommand(@"
            UPDATE actions SET description = @desc, responsable = @resp, echeance = @ech, statut = @statut
            WHERE id = @aid AND chantier_id = @cid", conn);
        P(cmd, "@desc", description ?? "");
        P(cmd, "@resp", responsable ?? "");
        P(cmd, "@ech", echeance ?? "");
        P(cmd, "@statut", string.IsNullOrEmpty(statut) ? "a_faire" : statut);
        P(cmd, "@aid", actionId);
        P(cmd, "@cid", chantierId);
        cmd.ExecuteNonQuery();
    }

    public void DeleteAction(int chantierId, int actionId)
    {
        using var conn = Open();
        using var cmd = new SqlCommand("DELETE FROM actions WHERE id = @aid AND chantier_id = @cid", conn);
        P(cmd, "@aid", actionId);
        P(cmd, "@cid", chantierId);
        cmd.ExecuteNonQuery();
    }

    // ---------- Indicateurs ----------
    public void AddIndicateur(int chantierId, string nom, string? unite, double? avant, double? apres)
    {
        using var conn = Open();
        using var cmd = new SqlCommand(@"
            INSERT INTO indicateurs (chantier_id, nom, unite, valeur_avant, valeur_apres)
            VALUES (@cid, @nom, @unite, @avant, @apres)", conn);
        P(cmd, "@cid", chantierId);
        P(cmd, "@nom", nom);
        P(cmd, "@unite", unite ?? "");
        P(cmd, "@avant", (object?)avant);
        P(cmd, "@apres", (object?)apres);
        cmd.ExecuteNonQuery();
    }

    public void UpdateIndicateur(int chantierId, int indicId, string? nom, string? unite, double? avant, double? apres)
    {
        using var conn = Open();
        using var cmd = new SqlCommand(@"
            UPDATE indicateurs SET nom = @nom, unite = @unite, valeur_avant = @avant, valeur_apres = @apres
            WHERE id = @iid AND chantier_id = @cid", conn);
        P(cmd, "@nom", nom ?? "");
        P(cmd, "@unite", unite ?? "");
        P(cmd, "@avant", (object?)avant);
        P(cmd, "@apres", (object?)apres);
        P(cmd, "@iid", indicId);
        P(cmd, "@cid", chantierId);
        cmd.ExecuteNonQuery();
    }

    public void DeleteIndicateur(int chantierId, int indicId)
    {
        using var conn = Open();
        using var cmd = new SqlCommand("DELETE FROM indicateurs WHERE id = @iid AND chantier_id = @cid", conn);
        P(cmd, "@iid", indicId);
        P(cmd, "@cid", chantierId);
        cmd.ExecuteNonQuery();
    }

    // ---------- Photos ----------
    public void AddPhoto(int chantierId, int? actionId, string? filename, string? mimeType, string data)
    {
        using var conn = Open();
        using var cmd = new SqlCommand(@"
            INSERT INTO photos (chantier_id, action_id, filename, mime_type, data)
            VALUES (@cid, @aid, @filename, @mime, @data)", conn);
        P(cmd, "@cid", chantierId);
        P(cmd, "@aid", (object?)actionId);
        P(cmd, "@filename", filename ?? "");
        P(cmd, "@mime", mimeType ?? "");
        P(cmd, "@data", data);
        cmd.ExecuteNonQuery();
    }

    public void DeletePhoto(int chantierId, int photoId)
    {
        using var conn = Open();
        using var cmd = new SqlCommand("DELETE FROM photos WHERE id = @pid AND chantier_id = @cid", conn);
        P(cmd, "@pid", photoId);
        P(cmd, "@cid", chantierId);
        cmd.ExecuteNonQuery();
    }

    // ---------- Tableau de bord ----------
    public Dictionary<string, object?> Dashboard()
    {
        using var conn = Open();
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

        var parStatut = new Dictionary<string, object?>();
        var totalChantiers = 0;
        using (var cmd = new SqlCommand("SELECT statut, COUNT(*) AS n FROM chantiers GROUP BY statut", conn))
        using (var r = cmd.ExecuteReader())
        {
            while (r.Read())
            {
                var n = Int(r["n"]);
                parStatut[S(r["statut"]) ?? ""] = n;
                totalChantiers += n;
            }
        }

        var actionsEnRetard = new List<Dictionary<string, object?>>();
        using (var cmd = new SqlCommand(@"
            SELECT a.id, a.description, a.responsable, a.echeance, a.chantier_id, c.titre AS chantier_titre
            FROM actions a
            JOIN chantiers c ON c.id = a.chantier_id
            WHERE a.statut <> 'fait' AND a.echeance <> '' AND a.echeance < @today
            ORDER BY a.echeance ASC", conn))
        {
            P(cmd, "@today", today);
            using var r = cmd.ExecuteReader();
            while (r.Read())
            {
                actionsEnRetard.Add(new Dictionary<string, object?>
                {
                    ["id"] = Int(r["id"]),
                    ["description"] = S(r["description"]),
                    ["responsable"] = S(r["responsable"]),
                    ["echeance"] = S(r["echeance"]),
                    ["chantier_id"] = Int(r["chantier_id"]),
                    ["chantier_titre"] = S(r["chantier_titre"])
                });
            }
        }

        var gains = new List<double>();
        using (var cmd = new SqlCommand(@"
            SELECT valeur_avant, valeur_apres FROM indicateurs
            WHERE valeur_avant IS NOT NULL AND valeur_apres IS NOT NULL AND valeur_avant <> 0", conn))
        using (var r = cmd.ExecuteReader())
        {
            while (r.Read())
            {
                var avant = Convert.ToDouble(r["valeur_avant"]);
                var apres = Convert.ToDouble(r["valeur_apres"]);
                gains.Add((avant - apres) / avant * 100);
            }
        }
        double? gainMoyen = gains.Count > 0 ? gains.Average() : null;

        int totalActions, actionsFaites;
        using (var cmd = new SqlCommand("SELECT COUNT(*) FROM actions", conn))
            totalActions = Convert.ToInt32(cmd.ExecuteScalar());
        using (var cmd = new SqlCommand("SELECT COUNT(*) FROM actions WHERE statut = 'fait'", conn))
            actionsFaites = Convert.ToInt32(cmd.ExecuteScalar());

        return new Dictionary<string, object?>
        {
            ["chantiersParStatut"] = parStatut,
            ["totalChantiers"] = totalChantiers,
            ["actionsEnRetard"] = actionsEnRetard,
            ["totalActions"] = totalActions,
            ["actionsFaites"] = actionsFaites,
            ["gainMoyen"] = gainMoyen,
            ["indicateursSuivis"] = gains.Count
        };
    }
}
