using System.Text;
using System.Text.Json;

namespace KaizenApp;

// Chat expert Lean 100 % IA (Claude / Anthropic), porte fidelement depuis lib/leanExpert.js.
// Appel HTTP direct a l'API Messages (comme le code Node : POST /v1/messages,
// en-tetes x-api-key + anthropic-version). La cle et le modele viennent de
// l'environnement (jamais en dur) : c'est l'IT qui les configure au deploiement.
public sealed class Chat
{
    private readonly Catalog _catalog;
    private readonly HttpClient _http;
    private readonly string _systemPrompt;

    public Chat(Catalog catalog, HttpClient http)
    {
        _catalog = catalog;
        _http = http;
        _systemPrompt =
            "Tu es un expert Lean Six Sigma \"Ceinture Noire\", specialiste de l'animation de chantiers Kaizen en industrie.\n" +
            "Regles strictes :\n" +
            "- Tu ne reponds QUE aux questions en lien avec le Lean management, l'amelioration continue et les chantiers Kaizen (organisation du travail, qualite, production, flux, maintenance, gaspillages).\n" +
            "- Si la question sort de ce cadre (sujet personnel, general, autre domaine), decline poliment en une phrase et recentre sur le Lean.\n" +
            "- Sois concret et bref (environ 5-8 lignes maximum).\n" +
            "- Oriente TOUJOURS vers un ou plusieurs outils precis parmi cette liste : " + string.Join(", ", _catalog.ToolNames) + ".\n" +
            "- Explique en 2-3 phrases pourquoi cet outil est adapte au cas decrit et donne une premiere etape concrete pour s'y mettre.\n" +
            "- Termine si pertinent par une question pour approfondir le diagnostic (ex: as-tu des donnees chiffrees ? depuis quand ce probleme existe-t-il ?).";
    }

    public static bool AiAvailable =>
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"));

    public async Task<object> ReplyAsync(string message)
    {
        var apiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        if (string.IsNullOrEmpty(apiKey))
        {
            return new
            {
                text = "L'assistant IA n'est pas encore configure (cle API manquante). Contacte l'administrateur, ou consulte directement la bibliotheque d'outils Kaizen.",
                tools = Array.Empty<string>(),
                source = "unavailable"
            };
        }

        var model = Environment.GetEnvironmentVariable("ANTHROPIC_MODEL") ?? "claude-opus-4-8";
        var payload = new
        {
            model,
            max_tokens = 1024,
            system = _systemPrompt,
            messages = new[] { new { role = "user", content = message } }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
        req.Headers.Add("x-api-key", apiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");
        req.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req);
        var body = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new Exception($"Anthropic API error {(int)resp.StatusCode}: {body}");

        // Concatene les blocs de texte de la reponse (data.content[].text).
        var sb = new StringBuilder();
        using (var doc = JsonDocument.Parse(body))
        {
            if (doc.RootElement.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
            {
                foreach (var block in content.EnumerateArray())
                    if (block.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String)
                        sb.Append(t.GetString());
            }
        }
        var text = sb.ToString().Trim();
        if (string.IsNullOrEmpty(text))
            text = "Je n'ai pas pu formuler de reponse. Reformule ton probleme terrain (qualite, delai, panne, organisation...) et je t'orienterai vers le bon outil Kaizen.";

        return new { text, tools = _catalog.FindToolIdsInText(text), source = "ai" };
    }
}
