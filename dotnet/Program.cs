using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using Microsoft.Extensions.FileProviders;
using KaizenApp;

var builder = WebApplication.CreateBuilder(args);

// JSON : noms de proprietes exacts (snake_case cote frontend) et accents/emoji lisibles.
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = null;
    o.SerializerOptions.Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
});

var connStr = builder.Configuration.GetConnectionString("SqlServer");
if (string.IsNullOrWhiteSpace(connStr))
    throw new InvalidOperationException("ConnectionString 'SqlServer' manquante (appsettings ou App Settings Azure).");

var dataDir = Path.Combine(AppContext.BaseDirectory, "Data");
var catalog = new Catalog(dataDir);
var store = new Store(connStr, catalog);
store.InitDb(Path.Combine(dataDir, "schema.sql"));

var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
var chat = new Chat(catalog, httpClient);

var app = builder.Build();

// Sert le frontend statique (le meme dossier public/ que l'app Node) via le meme service.
var publicDir = Path.GetFullPath(Path.Combine(
    Directory.GetCurrentDirectory(), app.Configuration["PublicPath"] ?? "../public"));
if (Directory.Exists(publicDir))
{
    app.UseDefaultFiles(new DefaultFilesOptions
    {
        FileProvider = new PhysicalFileProvider(publicDir),
        RequestPath = string.Empty
    });
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(publicDir),
        RequestPath = string.Empty
    });
}

// ---------- Catalogue (outils / phases) : JSON statique servi tel quel ----------
app.MapGet("/api/tools", () => Results.Content(catalog.ToolsJson, "application/json; charset=utf-8"));
app.MapGet("/api/phases", () => Results.Content(catalog.PhasesJson, "application/json; charset=utf-8"));

// ---------- Chat expert Lean (100 % IA, Claude / Anthropic) ----------
app.MapGet("/api/chat/status", () => Results.Json(new { aiAvailable = Chat.AiAvailable }));

app.MapPost("/api/chat", async (HttpRequest req) =>
{
    var body = await ReadBody(req);
    var message = Str(body, "message");
    if (string.IsNullOrWhiteSpace(message))
        return Results.Json(new { error = "message requis" }, statusCode: 400);
    try
    {
        return Results.Json(await chat.ReplyAsync(message!));
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex);
        return Results.Json(new { error = ex.Message }, statusCode: 500);
    }
});

// ---------- Chantiers ----------
app.MapGet("/api/chantiers", () => Results.Json(store.GetChantiers()));

app.MapGet("/api/chantiers/{id:int}", (int id) =>
{
    var c = store.GetChantierFull(id);
    return c is null ? Results.Json(new { error = "Non trouve" }, statusCode: 404) : Results.Json(c);
});

app.MapPost("/api/chantiers", async (HttpRequest req) =>
{
    var body = await ReadBody(req);
    var titre = Str(body, "titre");
    if (string.IsNullOrWhiteSpace(titre))
        return Results.Json(new { error = "titre requis" }, statusCode: 400);

    var (equipePresent, equipeIsArray, equipe) = StrArray(body, "equipe");
    if (equipePresent && !equipeIsArray)
        return Results.Json(new { error = "equipe doit etre une liste" }, statusCode: 400);
    var (outilsPresent, outilsIsArray, outils) = StrArray(body, "outils");
    if (outilsPresent && !outilsIsArray)
        return Results.Json(new { error = "outils doit etre une liste" }, statusCode: 400);

    var (quizPresent, quizJson) = RawJson(body, "quiz_reponses");
    var eligible = Has(body, "eligible_kaizen") ? Bool(body, "eligible_kaizen") : null;

    var (newId, error) = store.CreateChantier(
        titre!, Str(body, "probleme"), Str(body, "perimetre"), Str(body, "pilote"),
        equipe, Str(body, "objectif"), outils,
        Str(body, "date_debut"), Str(body, "date_fin"), Str(body, "statut"),
        eligible, quizPresent ? quizJson : null);

    if (error is not null) return Results.Json(new { error }, statusCode: 400);
    return Results.Json(store.GetChantierFull(newId!.Value));
});

app.MapPut("/api/chantiers/{id:int}", async (int id, HttpRequest req) =>
{
    var body = await ReadBody(req);
    if (!store.ChantierExists(id))
        return Results.Json(new { error = "Non trouve" }, statusCode: 404);

    var (equipePresent, equipeIsArray, equipe) = StrArray(body, "equipe");
    if (equipePresent && !equipeIsArray)
        return Results.Json(new { error = "equipe doit etre une liste" }, statusCode: 400);
    var (outilsPresent, outilsIsArray, outils) = StrArray(body, "outils");
    if (outilsPresent && !outilsIsArray)
        return Results.Json(new { error = "outils doit etre une liste" }, statusCode: 400);

    var eligibleProvided = Has(body, "eligible_kaizen");
    var (quizProvided, quizJson) = RawJson(body, "quiz_reponses");

    store.UpdateChantier(
        id, Str(body, "titre") ?? "", Str(body, "probleme"), Str(body, "perimetre"), Str(body, "pilote"),
        equipe, Str(body, "objectif"), outils,
        Str(body, "date_debut"), Str(body, "date_fin"), Str(body, "statut"),
        eligibleProvided, Bool(body, "eligible_kaizen"), quizProvided, quizJson);

    return Results.Json(store.GetChantierFull(id));
});

app.MapDelete("/api/chantiers/{id:int}", (int id) =>
{
    store.DeleteChantier(id);
    return Results.Json(new { success = true });
});

app.MapGet("/api/dashboard", () => Results.Json(store.Dashboard()));

// ---------- Actions (plan d'action) ----------
app.MapPost("/api/chantiers/{id:int}/actions", async (int id, HttpRequest req) =>
{
    var body = await ReadBody(req);
    if (!store.ChantierExists(id))
        return Results.Json(new { error = "Chantier non trouve" }, statusCode: 404);
    var description = Str(body, "description");
    if (string.IsNullOrWhiteSpace(description))
        return Results.Json(new { error = "description requise" }, statusCode: 400);
    store.AddAction(id, description!, Str(body, "responsable"), Str(body, "echeance"), Str(body, "statut"));
    return Results.Json(store.GetChantierFull(id));
});

app.MapPut("/api/chantiers/{id:int}/actions/{actionId:int}", async (int id, int actionId, HttpRequest req) =>
{
    var body = await ReadBody(req);
    store.UpdateAction(id, actionId, Str(body, "description"), Str(body, "responsable"), Str(body, "echeance"), Str(body, "statut"));
    return Results.Json(store.GetChantierFull(id));
});

app.MapDelete("/api/chantiers/{id:int}/actions/{actionId:int}", (int id, int actionId) =>
{
    store.DeleteAction(id, actionId);
    return Results.Json(store.GetChantierFull(id));
});

// ---------- Indicateurs (avant / apres) ----------
app.MapPost("/api/chantiers/{id:int}/indicateurs", async (int id, HttpRequest req) =>
{
    var body = await ReadBody(req);
    if (!store.ChantierExists(id))
        return Results.Json(new { error = "Chantier non trouve" }, statusCode: 404);
    var nom = Str(body, "nom");
    if (string.IsNullOrWhiteSpace(nom))
        return Results.Json(new { error = "nom requis" }, statusCode: 400);
    store.AddIndicateur(id, nom!, Str(body, "unite"), Num(body, "valeur_avant"), Num(body, "valeur_apres"));
    return Results.Json(store.GetChantierFull(id));
});

app.MapPut("/api/chantiers/{id:int}/indicateurs/{indicId:int}", async (int id, int indicId, HttpRequest req) =>
{
    var body = await ReadBody(req);
    store.UpdateIndicateur(id, indicId, Str(body, "nom"), Str(body, "unite"), Num(body, "valeur_avant"), Num(body, "valeur_apres"));
    return Results.Json(store.GetChantierFull(id));
});

app.MapDelete("/api/chantiers/{id:int}/indicateurs/{indicId:int}", (int id, int indicId) =>
{
    store.DeleteIndicateur(id, indicId);
    return Results.Json(store.GetChantierFull(id));
});

// ---------- Photos ----------
app.MapPost("/api/chantiers/{id:int}/photos", async (int id, HttpRequest req) =>
{
    var body = await ReadBody(req);
    if (!store.ChantierExists(id))
        return Results.Json(new { error = "Chantier non trouve" }, statusCode: 404);
    var data = Str(body, "data");
    if (string.IsNullOrEmpty(data))
        return Results.Json(new { error = "data (base64) requise" }, statusCode: 400);
    int? actionId = Has(body, "action_id") ? IntOrNull(body, "action_id") : null;
    store.AddPhoto(id, actionId, Str(body, "filename"), Str(body, "mime_type"), data!);
    return Results.Json(store.GetChantierFull(id));
});

app.MapDelete("/api/chantiers/{id:int}/photos/{photoId:int}", (int id, int photoId) =>
{
    store.DeletePhoto(id, photoId);
    return Results.Json(store.GetChantierFull(id));
});

// Fallback SPA : toute route non-API renvoie index.html.
if (Directory.Exists(publicDir))
{
    var indexPath = Path.Combine(publicDir, "index.html");
    app.MapFallback(async (HttpContext ctx) =>
    {
        ctx.Response.ContentType = "text/html; charset=utf-8";
        await ctx.Response.SendFileAsync(indexPath);
    });
}

app.Run();


// ================= Helpers de lecture du corps JSON (equivalent lache de req.body Express) =================
partial class Program
{
    static async Task<JsonElement> ReadBody(HttpRequest req)
    {
        try
        {
            // Corps vide -> JsonException (capturee ci-dessous) ; sinon un JsonElement exploitable.
            return await req.ReadFromJsonAsync<JsonElement>();
        }
        catch (JsonException)
        {
            throw new BadHttpRequestException("JSON invalide");
        }
    }

    static bool Has(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out _);

    static string? Str(JsonElement e, string name)
        => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? v.GetString()
            : null;

    // (present, estTableau, elements). Si present mais pas un tableau -> estTableau = false.
    static (bool present, bool isArray, List<string> list) StrArray(JsonElement e, string name)
    {
        var list = new List<string>();
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v))
            return (false, true, list);
        if (v.ValueKind != JsonValueKind.Array)
            return (true, false, list);
        foreach (var item in v.EnumerateArray())
            list.Add(item.ValueKind == JsonValueKind.String ? item.GetString()! : item.ToString());
        return (true, true, list);
    }

    static bool? Bool(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => v.GetDouble() != 0,
            _ => null
        };
    }

    // Coercion en nombre-ou-null (equivalent de toNumberOrNull cote serveur Node).
    static double? Num(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        switch (v.ValueKind)
        {
            case JsonValueKind.Number:
                return v.GetDouble();
            case JsonValueKind.String:
                var s = v.GetString();
                if (string.IsNullOrEmpty(s)) return null;
                return double.TryParse(s, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : null;
            default:
                return null;
        }
    }

    static int? IntOrNull(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i)) return i;
        return null;
    }

    // (present, json brut). json = null si absent ou explicitement null.
    static (bool present, string? json) RawJson(JsonElement e, string name)
    {
        if (e.ValueKind != JsonValueKind.Object || !e.TryGetProperty(name, out var v)) return (false, null);
        if (v.ValueKind == JsonValueKind.Null) return (true, null);
        return (true, v.GetRawText());
    }
}
