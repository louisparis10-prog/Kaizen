using System.Globalization;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace KaizenApp.Services;

public sealed partial class ChatService
{
    private static readonly string[] GeneralKeywords =
    [
        "kaizen", "lean", "gaspillage", "muda", "amelioration continue", "chantier", "productivite", "qualite",
        "defaut", "panne", "stock", "delai", "securite", "poste de travail", "operateur", "production", "flux",
        "atelier", "processus", "probleme", "performance", "usine", "reglage", "cadence", "attente", "industrie",
        "machine", "maintenance", "rebut", "non conformite", "retard", "surproduction", "micro arret", "goulot"
    ];

    private const string OffTopic = "Je suis un expert Lean / Kaizen (ceinture noire) : je ne reponds qu'aux questions liees a l'amelioration continue, aux chantiers Kaizen et aux outils Lean. Decris-moi un probleme terrain et je t'orienterai vers le bon outil.";
    private readonly ToolCatalog _catalog;
    private readonly SqlServerRepository _repository;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<ChatService> _logger;

    public ChatService(ToolCatalog catalog, SqlServerRepository repository, IConfiguration configuration,
        IHttpClientFactory httpClientFactory, ILogger<ChatService> logger)
    {
        _catalog = catalog;
        _repository = repository;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public bool AiAvailable
    {
        get
        {
            var keys = Keys();
            return !string.IsNullOrWhiteSpace(keys.Anthropic) || !string.IsNullOrWhiteSpace(keys.OpenAi) ||
                   !string.IsNullOrWhiteSpace(keys.Gemini) || !string.IsNullOrWhiteSpace(keys.Groq);
        }
    }

    public async Task<ChatResponse> ReplyAsync(string message, bool useAi)
    {
        string? context = null;
        try { context = await _repository.BuildChatContextAsync(); }
        catch (Exception ex) { _logger.LogWarning(ex, "Contexte SQL Server indisponible pour le chat."); }

        if (!useAi || !AiAvailable)
        {
            var local = LocalReply(message, context);
            return useAi && !AiAvailable
                ? local with { Notice = "Mode IA indisponible (aucune cle API IA configuree) : reponse du moteur local." }
                : local;
        }

        try
        {
            var keys = Keys();
            if (!string.IsNullOrWhiteSpace(keys.Anthropic)) return await AnthropicAsync(message, keys.Anthropic!, context);
            if (!string.IsNullOrWhiteSpace(keys.OpenAi)) return await OpenAiAsync(message, keys.OpenAi!, context);
            if (!string.IsNullOrWhiteSpace(keys.Groq)) return await GroqAsync(message, keys.Groq!, context);
            return await GeminiAsync(message, keys.Gemini!, context);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Fournisseur IA indisponible, repli sur le moteur local.");
            var local = LocalReply(message, context);
            return local with { Notice = $"Erreur API IA ({ex.Message}) : reponse du moteur local." };
        }
    }

    private ChatResponse LocalReply(string message, string? context)
    {
        var matches = _catalog.ScoreTools(message);
        var normalized = Normalize(message);
        if (HistoryPattern().IsMatch(normalized) && !string.IsNullOrWhiteSpace(context))
            return new ChatResponse($"Voici l'etat des chantiers enregistres :\n{context}", [], "local");

        if (matches.Count == 0 && !GeneralKeywords.Any(keyword => normalized.Contains(Normalize(keyword), StringComparison.Ordinal)))
            return new ChatResponse(OffTopic, [], "local");
        if (matches.Count == 0)
            return new ChatResponse("Peux-tu preciser ton probleme ? Indique s'il s'agit de qualite, delai, panne, organisation, flux ou changement de serie.", [], "local");

        var top = matches.Take(3).Select(x => x.Tool).ToList();
        var first = top[0];
        var name = first["name"]?.GetValue<string>() ?? "outil Lean";
        var summary = first["summary"]?.GetValue<string>() ?? "";
        var firstStep = first["steps"] is JsonArray steps && steps.Count > 0 ? steps[0]?.GetValue<string>() ?? "" : "";
        var text = $"Sur ce type de probleme, l'outil le plus adapte est **{name}**. {summary}";
        if (top.Count > 1)
            text += $"\n\nEn complement : {string.Join(", ", top.Skip(1).Select(t => $"**{t["name"]?.GetValue<string>()}**"))}.";
        if (firstStep.Length > 0) text += $"\n\nPour commencer : {firstStep}";
        return new ChatResponse(text, top.Select(t => t["id"]!.GetValue<string>()).ToList(), "local");
    }

    private async Task<ChatResponse> AnthropicAsync(string message, string key, string? context)
    {
        var client = _httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        request.Headers.Add("x-api-key", key);
        request.Headers.Add("anthropic-version", "2023-06-01");
        request.Content = JsonContent.Create(new
        {
            model = _configuration["ANTHROPIC_MODEL"] ?? _configuration["Ai:AnthropicModel"],
            max_tokens = 500,
            system = SystemPrompt(context),
            messages = new[] { new { role = "user", content = message } }
        });
        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Anthropic {(int)response.StatusCode}: {Limit(body)}");
        var node = JsonNode.Parse(body);
        var text = node?["content"]?.AsArray().Select(x => x?["text"]?.GetValue<string>() ?? "").Aggregate("", (a, b) => a + b).Trim() ?? "";
        return AiResult(message, text);
    }

    private async Task<ChatResponse> OpenAiAsync(string message, string key, string? context)
    {
        var payload = new
        {
            model = _configuration["OPENAI_MODEL"] ?? _configuration["Ai:OpenAiModel"],
            max_tokens = 500,
            messages = new[] { new { role = "system", content = SystemPrompt(context) }, new { role = "user", content = message } }
        };
        var node = await PostBearerAsync("https://api.openai.com/v1/chat/completions", key, payload, "OpenAI");
        var text = node?["choices"]?[0]?["message"]?["content"]?.GetValue<string>()?.Trim() ?? "";
        return AiResult(message, text);
    }

    private async Task<ChatResponse> GroqAsync(string message, string key, string? context)
    {
        var payload = new
        {
            model = _configuration["GROQ_MODEL"] ?? _configuration["Ai:GroqModel"],
            max_tokens = 500,
            messages = new[] { new { role = "system", content = SystemPrompt(context) }, new { role = "user", content = message } }
        };
        var node = await PostBearerAsync("https://api.groq.com/openai/v1/chat/completions", key, payload, "Groq");
        var text = node?["choices"]?[0]?["message"]?["content"]?.GetValue<string>()?.Trim() ?? "";
        return AiResult(message, text);
    }

    private async Task<ChatResponse> GeminiAsync(string message, string key, string? context)
    {
        var model = _configuration["GEMINI_MODEL"] ?? _configuration["Ai:GeminiModel"];
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(model!)}:generateContent?key={Uri.EscapeDataString(key)}";
        var payload = new
        {
            system_instruction = new { parts = new[] { new { text = SystemPrompt(context) } } },
            contents = new[] { new { role = "user", parts = new[] { new { text = message } } } },
            generationConfig = new { maxOutputTokens = 500 }
        };
        var client = _httpClientFactory.CreateClient();
        using var response = await client.PostAsJsonAsync(url, payload);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"Gemini {(int)response.StatusCode}: {Limit(body)}");
        var node = JsonNode.Parse(body);
        var text = node?["candidates"]?[0]?["content"]?["parts"]?.AsArray()
            .Select(x => x?["text"]?.GetValue<string>() ?? "").Aggregate("", (a, b) => a + b).Trim() ?? "";
        return AiResult(message, text);
    }

    private async Task<JsonNode?> PostBearerAsync(string url, string key, object payload, string provider)
    {
        var client = _httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new("Bearer", key);
        request.Content = JsonContent.Create(payload);
        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException($"{provider} {(int)response.StatusCode}: {Limit(body)}");
        return JsonNode.Parse(body);
    }

    private ChatResponse AiResult(string message, string text)
    {
        var tools = _catalog.ScoreTools(message + " " + text).Take(3)
            .Select(x => x.Tool["id"]!.GetValue<string>()).ToList();
        return new ChatResponse(string.IsNullOrWhiteSpace(text) ? OffTopic : text, tools, "ai");
    }

    private string SystemPrompt(string? context) => $"""
        Tu es un expert Lean Six Sigma Ceinture Noire specialise dans les chantiers Kaizen industriels.
        Reponds uniquement aux questions Lean, amelioration continue, qualite, production, flux et maintenance.
        Sois concret et bref. Oriente vers un ou plusieurs outils parmi : {string.Join(", ", _catalog.ToolNames())}.
        N'invente jamais de chantier ni de resultat. Donne une premiere etape concrete.
        {(string.IsNullOrWhiteSpace(context) ? "" : "DONNEES REELLES DE L'APPLICATION :\n" + context)}
        """;

    private (string? Anthropic, string? OpenAi, string? Gemini, string? Groq) Keys() =>
        (_configuration["ANTHROPIC_API_KEY"], _configuration["OPENAI_API_KEY"],
         _configuration["GEMINI_API_KEY"], _configuration["GROQ_API_KEY"]);

    private static string Normalize(string value)
    {
        var decomposed = (value ?? "").ToLowerInvariant().Normalize(NormalizationForm.FormD);
        return new string(decomposed.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
    }

    private static string Limit(string value) => value.Length <= 500 ? value : value[..500];

    [GeneratedRegex("deja|historique|anterieur|precedent|similaire|quel chantier|quels chantiers|retour d.experience", RegexOptions.IgnoreCase)]
    private static partial Regex HistoryPattern();
}
