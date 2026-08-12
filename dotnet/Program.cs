using System.Text.Json;
using System.Text.Json.Nodes;
using KaizenApp;
using KaizenApp.Services;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
});
builder.Services.AddHttpClient();
builder.Services.AddSingleton<ToolCatalog>();
builder.Services.AddSingleton<SqlServerRepository>();
builder.Services.AddSingleton<PptxTemplateService>();
builder.Services.AddSingleton<ChatService>();

var app = builder.Build();
var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");
var repository = app.Services.GetRequiredService<SqlServerRepository>();
try { await repository.InitializeAsync(); }
catch (Exception ex) { logger.LogError(ex, "SQL Server indisponible au demarrage ; le healthcheck restera en erreur."); }

app.UseExceptionHandler(handler => handler.Run(async context =>
{
    var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
    logger.LogError(error, "Erreur API non geree.");
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    context.Response.ContentType = "application/json";
    await context.Response.WriteAsJsonAsync(new
    {
        error = ErrorMessage(error),
        code = error is Microsoft.Data.SqlClient.SqlException sql ? sql.Number.ToString() : "INTERNAL_ERROR"
    });
}));

var staticRoot = new[]
{
    Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "public")),
    app.Environment.WebRootPath,
    Path.Combine(AppContext.BaseDirectory, "wwwroot")
}.FirstOrDefault(path => !string.IsNullOrWhiteSpace(path) && Directory.Exists(path));
if (staticRoot is not null)
{
    var provider = new PhysicalFileProvider(staticRoot);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = provider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = provider });
}

app.MapGet("/health", async (SqlServerRepository db) =>
{
    try
    {
        if (await db.IsHealthyAsync()) return Results.Ok(new { status = "ok", database = "sqlserver" });
        return Results.Json(new { status = "error", database = db.IsConfigured ? "schema_missing" : "unconfigured" }, statusCode: 503);
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "error", database = "unavailable", error = ErrorMessage(ex) }, statusCode: 503);
    }
});

app.MapGet("/api/tools", (ToolCatalog catalog) => Results.Json(catalog.GetToolsForApi()));
app.MapGet("/api/phases", (ToolCatalog catalog) => Results.Json(catalog.GetPhasesForApi()));

app.MapPost("/api/tools/{toolId}/trame", async (string toolId, SupportRequest? request, ToolCatalog catalog,
    PptxTemplateService templates, HttpResponse response) =>
{
    if (!catalog.ToolExists(toolId) || !templates.IsAvailable(toolId))
        return Results.NotFound(new { error = "Aucune trame SWM remplissable pour cet outil" });
    var result = await templates.FillAsync(toolId, request?.Header ?? [], request?.Fields ?? []);
    response.Headers["X-Extension-Trame"] = result.Extension;
    if (result.NonPlaces.Count > 0) response.Headers["X-Champs-Non-Places"] = string.Join(',', result.NonPlaces);
    if (result.LignesIgnorees > 0) response.Headers["X-Lignes-Ignorees"] = result.LignesIgnorees.ToString();
    if (result.CausesEnTrop.Count > 0) response.Headers["X-Causes-En-Trop"] = string.Join(',', result.CausesEnTrop);
    return Results.File(result.Buffer,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation", $"{toolId}-rempli.{result.Extension}");
});

app.MapGet("/api/chat/status", (ChatService chat) => Results.Ok(new { aiAvailable = chat.AiAvailable }));
app.MapPost("/api/chat", async (ChatRequest request, ChatService chat) =>
{
    if (string.IsNullOrWhiteSpace(request.Message)) return Results.BadRequest(new { error = "message requis" });
    return Results.Ok(await chat.ReplyAsync(request.Message.Trim(), request.Mode == "ai"));
});

app.MapGet("/api/chantiers", async (SqlServerRepository db) => Results.Ok(await db.GetChantiersAsync()));
app.MapGet("/api/chantiers/{id:int}", async (int id, SqlServerRepository db) =>
    await db.GetChantierAsync(id) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Non trouve" }));

app.MapPost("/api/chantiers", async (ChantierRequest request, ToolCatalog catalog, SqlServerRepository db) =>
{
    if (string.IsNullOrWhiteSpace(request.Titre)) return Results.BadRequest(new { error = "titre requis" });
    var tools = catalog.SortTools(request.Outils);
    if (tools.Count > 0)
    {
        var missing = catalog.MissingRequiredPhases(tools);
        if (missing.Count > 0)
            return Results.BadRequest(new { error = $"Choisis au moins un outil de : {string.Join(", ", missing.Select(p => p["label"]?.GetValue<string>()))}" });
    }
    return Results.Ok(await db.CreateChantierAsync(request));
});

app.MapPut("/api/chantiers/{id:int}", async (int id, ChantierRequest request, SqlServerRepository db) =>
    await db.UpdateChantierAsync(id, request) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Non trouve" }));
app.MapDelete("/api/chantiers/{id:int}", async (int id, SqlServerRepository db) =>
    await db.DeleteChantierAsync(id) ? Results.Ok(new { success = true }) : Results.NotFound(new { error = "Non trouve" }));
app.MapGet("/api/dashboard", async (SqlServerRepository db) => Results.Ok(await db.GetDashboardAsync()));

app.MapPost("/api/chantiers/{id:int}/actions", async (int id, ActionRequest request, SqlServerRepository db) =>
{
    if (string.IsNullOrWhiteSpace(request.Description)) return Results.BadRequest(new { error = "description requise" });
    return await db.AddActionAsync(id, request) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Chantier non trouve" });
});
app.MapPut("/api/chantiers/{id:int}/actions/{actionId:int}", async (int id, int actionId, ActionRequest request, SqlServerRepository db) =>
    await db.UpdateActionAsync(id, actionId, request) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Non trouve" }));
app.MapDelete("/api/chantiers/{id:int}/actions/{actionId:int}", async (int id, int actionId, SqlServerRepository db) =>
    await db.DeleteActionAsync(id, actionId) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Non trouve" }));

app.MapPost("/api/chantiers/{id:int}/indicateurs", async (int id, IndicateurRequest request, SqlServerRepository db) =>
{
    if (string.IsNullOrWhiteSpace(request.Nom)) return Results.BadRequest(new { error = "nom requis" });
    return await db.AddIndicatorAsync(id, request) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Chantier non trouve" });
});
app.MapPut("/api/chantiers/{id:int}/indicateurs/{indicatorId:int}", async (int id, int indicatorId, IndicateurRequest request, SqlServerRepository db) =>
    await db.UpdateIndicatorAsync(id, indicatorId, request) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Non trouve" }));
app.MapDelete("/api/chantiers/{id:int}/indicateurs/{indicatorId:int}", async (int id, int indicatorId, SqlServerRepository db) =>
    await db.DeleteIndicatorAsync(id, indicatorId) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Non trouve" }));

app.MapPut("/api/chantiers/{id:int}/supports/{toolId}", async (int id, string toolId, SupportRequest request,
    ToolCatalog catalog, SqlServerRepository db) =>
{
    if (!catalog.ToolExists(toolId)) return Results.NotFound(new { error = "Outil inconnu" });
    return await db.SaveSupportAsync(id, toolId, request) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Chantier non trouve" });
});
app.MapDelete("/api/chantiers/{id:int}/supports/{toolId}", async (int id, string toolId, SqlServerRepository db) =>
    await db.DeleteSupportAsync(id, toolId) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Non trouve" }));

app.MapPost("/api/chantiers/{id:int}/photos", async (int id, PhotoRequest request, SqlServerRepository db) =>
{
    if (string.IsNullOrWhiteSpace(request.Data)) return Results.BadRequest(new { error = "data (base64) requise" });
    return await db.AddPhotoAsync(id, request) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Chantier non trouve" });
});
app.MapDelete("/api/chantiers/{id:int}/photos/{photoId:int}", async (int id, int photoId, SqlServerRepository db) =>
    await db.DeletePhotoAsync(id, photoId) is { } item ? Results.Ok(item) : Results.NotFound(new { error = "Non trouve" }));

app.Run();

static string ErrorMessage(Exception? error)
{
    if (error is null) return "Erreur interne du serveur";
    if (!string.IsNullOrWhiteSpace(error.Message)) return error.Message;
    if (error.InnerException is not null && !string.IsNullOrWhiteSpace(error.InnerException.Message)) return error.InnerException.Message;
    return "Erreur interne du serveur";
}
