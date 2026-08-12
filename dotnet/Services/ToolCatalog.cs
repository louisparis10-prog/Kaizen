using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using Jint;

namespace KaizenApp.Services;

public sealed class ToolCatalog
{
    private static readonly HashSet<string> FillableTemplates = new(StringComparer.OrdinalIgnoreCase)
    {
        "ishikawa", "5-pourquoi", "qqoqccp", "matrice-gain-effort", "sipoc", "7-gaspillages"
    };

    private readonly JsonArray _tools;
    private readonly JsonArray _phases;
    private readonly Dictionary<string, JsonObject> _toolsById;
    private readonly Dictionary<string, JsonObject> _phasesById;

    public ToolCatalog(IWebHostEnvironment environment)
    {
        var candidates = new[]
        {
            Path.Combine(environment.ContentRootPath, "..", "data", "tools.js"),
            Path.Combine(AppContext.BaseDirectory, "Data", "tools.js"),
            Path.Combine(environment.ContentRootPath, "Data", "tools.js")
        };
        var path = candidates.FirstOrDefault(File.Exists)
            ?? throw new FileNotFoundException("Catalogue data/tools.js introuvable.");

        var script = File.ReadAllText(path, Encoding.UTF8);
        var engine = new Engine(options => options.LimitRecursion(256));
        var json = engine.Evaluate(
            "var module = { exports: {} };\n" + script +
            "\nJSON.stringify({ tools: TOOLS, phases: PHASES });").AsString();
        var root = JsonNode.Parse(json)?.AsObject()
            ?? throw new InvalidDataException("Catalogue d'outils illisible.");

        _tools = root["tools"]?.AsArray() ?? [];
        _phases = root["phases"]?.AsArray() ?? [];
        _toolsById = _tools.OfType<JsonObject>()
            .Where(t => t["id"] is not null)
            .ToDictionary(t => t["id"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase);
        _phasesById = _phases.OfType<JsonObject>()
            .Where(p => p["id"] is not null)
            .ToDictionary(p => p["id"]!.GetValue<string>(), StringComparer.OrdinalIgnoreCase);
    }

    public JsonArray GetToolsForApi()
    {
        var result = new JsonArray();
        foreach (var source in _tools.OfType<JsonObject>())
        {
            var tool = source.DeepClone().AsObject();
            var id = tool["id"]?.GetValue<string>() ?? "";
            if (tool["template"] is JsonObject template)
                template["remplissable"] = FillableTemplates.Contains(id);
            result.Add(tool);
        }
        return result;
    }

    public JsonArray GetPhasesForApi() => _phases.DeepClone().AsArray();
    public bool ToolExists(string id) => _toolsById.ContainsKey(id);
    public bool TemplateIsFillable(string id) => FillableTemplates.Contains(id);
    public string? GetToolName(string id) => _toolsById.GetValueOrDefault(id)?["name"]?.GetValue<string>();
    public string? GetToolPhase(string id) => _toolsById.GetValueOrDefault(id)?["phase"]?.GetValue<string>();

    public IReadOnlyList<string> SortTools(IEnumerable<string>? ids) => (ids ?? [])
        .Where(ToolExists)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(id => PhaseOrder(GetToolPhase(id)))
        .ToList();

    public IReadOnlyList<JsonObject> MissingRequiredPhases(IEnumerable<string>? ids)
    {
        var present = (ids ?? []).Select(GetToolPhase).Where(x => x is not null).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return _phases.OfType<JsonObject>()
            .Where(p => p["required"]?.GetValue<bool>() == true)
            .Where(p => !present.Contains(p["id"]?.GetValue<string>()))
            .Select(p => p.DeepClone().AsObject())
            .ToList();
    }

    public IReadOnlyList<(JsonObject Tool, int Score)> ScoreTools(string message)
    {
        var words = Words(message);
        return _tools.OfType<JsonObject>().Select(tool =>
        {
            var score = 0;
            if (tool["keywords"] is JsonArray keywords)
            {
                foreach (var keyword in keywords)
                    if (PhraseMatches(words, keyword?.GetValue<string>() ?? "")) score += 2;
            }
            if (PhraseMatches(words, tool["name"]?.GetValue<string>() ?? "")) score += 3;
            return (Tool: tool, Score: score);
        }).Where(x => x.Score > 0).OrderByDescending(x => x.Score).ToList();
    }

    public IReadOnlyList<string> ToolNames() => _tools.OfType<JsonObject>()
        .Select(t => t["name"]?.GetValue<string>() ?? "").Where(x => x.Length > 0).ToList();

    private int PhaseOrder(string? phase) => phase is not null && _phasesById.TryGetValue(phase, out var p)
        ? p["order"]?.GetValue<int>() ?? 99 : 99;

    private static string Normalize(string value)
    {
        var decomposed = (value ?? "").ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    private static List<string> Words(string value) => Normalize(value)
        .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
        .SelectMany(part => part.Split(part.Where(c => !char.IsLetterOrDigit(c)).Distinct().ToArray(), StringSplitOptions.RemoveEmptyEntries))
        .ToList();

    private static string Stem(string word)
    {
        var value = word;
        if (value.Length > 3 && (value.EndsWith('s') || value.EndsWith('x'))) value = value[..^1];
        while (value.Length > 3 && value.EndsWith('e')) value = value[..^1];
        return value;
    }

    private static bool PhraseMatches(List<string> messageWords, string phrase)
    {
        var phraseWords = Words(phrase);
        return phraseWords.Count > 0 && phraseWords.All(target => messageWords.Any(word => Stem(word) == Stem(target)));
    }
}
