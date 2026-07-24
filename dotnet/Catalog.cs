using System.Globalization;
using System.Text;
using System.Text.Json;

namespace KaizenApp;

// Charge le catalogue statique (42 outils + 5 phases) depuis les fichiers JSON de Data/,
// et fournit la logique metier associee : tri des outils par phase, verification des phases
// obligatoires, libelle d'un outil pour pre-remplir le plan d'action.
// Les fichiers JSON sont servis tels quels par /api/tools et /api/phases (fidelite exacte).
public sealed class Catalog
{
    public string ToolsJson { get; }
    public string PhasesJson { get; }

    private readonly Dictionary<string, string> _toolPhase = new();   // toolId -> phaseId
    private readonly Dictionary<string, string> _toolName = new();    // toolId -> nom
    private readonly Dictionary<string, int> _phaseOrder = new();     // phaseId -> ordre
    private readonly Dictionary<string, string> _phaseLabel = new();  // phaseId -> libelle
    private readonly List<string> _requiredPhases = new();            // phaseId obligatoires
    private readonly List<(string Id, string NormName)> _toolMatch = new(); // pour repErer les outils cites dans un texte

    public IReadOnlyList<string> ToolNames { get; }

    public Catalog(string dataDir)
    {
        ToolsJson = File.ReadAllText(Path.Combine(dataDir, "tools.json"));
        PhasesJson = File.ReadAllText(Path.Combine(dataDir, "phases.json"));

        var names = new List<string>();
        using var tools = JsonDocument.Parse(ToolsJson);
        foreach (var t in tools.RootElement.EnumerateArray())
        {
            var id = t.GetProperty("id").GetString()!;
            var name = t.GetProperty("name").GetString() ?? id;
            _toolName[id] = name;
            names.Add(name);
            // Nom simplifie (sans la parenthese finale) pour matcher dans une reponse en langage naturel.
            var baseName = name.Split('(')[0].Trim();
            _toolMatch.Add((id, Normalize(baseName)));
            if (t.TryGetProperty("phase", out var ph) && ph.ValueKind == JsonValueKind.String)
                _toolPhase[id] = ph.GetString()!;
        }
        ToolNames = names;

        using var phases = JsonDocument.Parse(PhasesJson);
        foreach (var p in phases.RootElement.EnumerateArray())
        {
            var id = p.GetProperty("id").GetString()!;
            _phaseOrder[id] = p.GetProperty("order").GetInt32();
            _phaseLabel[id] = p.GetProperty("label").GetString() ?? id;
            if (p.TryGetProperty("required", out var req) && req.ValueKind == JsonValueKind.True)
                _requiredPhases.Add(id);
        }
    }

    private int PhaseOrderOf(string toolId)
    {
        if (_toolPhase.TryGetValue(toolId, out var phaseId) && _phaseOrder.TryGetValue(phaseId, out var order))
            return order;
        return 99; // outil inconnu ou sans phase : rejete en fin de liste
    }

    // Trie les ids d'outils dans l'ordre chronologique des phases (Identification -> ... -> Standardisation).
    public List<string> SortOutilsByPhase(IEnumerable<string> ids)
        => ids.OrderBy(PhaseOrderOf).ToList();

    // Renvoie les libelles des phases obligatoires non couvertes par la selection d'outils.
    public List<string> MissingRequiredPhaseLabels(IReadOnlyCollection<string> ids)
    {
        var present = ids
            .Where(_toolPhase.ContainsKey)
            .Select(id => _toolPhase[id])
            .ToHashSet();
        return _requiredPhases
            .Where(p => !present.Contains(p))
            .Select(p => _phaseLabel[p])
            .ToList();
    }

    public string? ToolName(string id) => _toolName.TryGetValue(id, out var n) ? n : null;

    // Repere jusqu'a `max` outils dont le nom apparait dans un texte (reponse de l'IA),
    // pour proposer des liens cliquables vers leur fiche. Best-effort, insensible aux accents.
    public List<string> FindToolIdsInText(string text, int max = 3)
    {
        var norm = Normalize(text);
        var found = new List<string>();
        foreach (var (id, normName) in _toolMatch)
        {
            if (normName.Length >= 2 && norm.Contains(normName) && !found.Contains(id))
            {
                found.Add(id);
                if (found.Count >= max) break;
            }
        }
        return found;
    }

    // Minuscule + suppression des accents, pour une comparaison tolerante.
    private static string Normalize(string s)
    {
        var decomposed = (s ?? "").ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        return sb.ToString();
    }
}
