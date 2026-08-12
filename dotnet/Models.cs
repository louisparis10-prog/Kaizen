using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace KaizenApp;

public sealed record ChantierRequest(
    [property: JsonPropertyName("titre")] string? Titre,
    [property: JsonPropertyName("probleme")] string? Probleme,
    [property: JsonPropertyName("perimetre")] string? Perimetre,
    [property: JsonPropertyName("pilote")] string? Pilote,
    [property: JsonPropertyName("equipe")] List<string>? Equipe,
    [property: JsonPropertyName("objectif")] string? Objectif,
    [property: JsonPropertyName("outils")] List<string>? Outils,
    [property: JsonPropertyName("date_debut")] string? DateDebut,
    [property: JsonPropertyName("date_fin")] string? DateFin,
    [property: JsonPropertyName("statut")] string? Statut,
    [property: JsonPropertyName("eligible_kaizen")] bool? EligibleKaizen,
    [property: JsonPropertyName("quiz_reponses")] JsonNode? QuizReponses);

public sealed record ActionRequest(
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("responsable")] string? Responsable,
    [property: JsonPropertyName("echeance")] string? Echeance,
    [property: JsonPropertyName("statut")] string? Statut);

public sealed record IndicateurRequest(
    [property: JsonPropertyName("nom")] string? Nom,
    [property: JsonPropertyName("unite")] string? Unite,
    [property: JsonPropertyName("valeur_avant")] double? ValeurAvant,
    [property: JsonPropertyName("valeur_apres")] double? ValeurApres);

public sealed record PhotoRequest(
    [property: JsonPropertyName("filename")] string? Filename,
    [property: JsonPropertyName("mime_type")] string? MimeType,
    [property: JsonPropertyName("data")] string? Data,
    [property: JsonPropertyName("action_id")] int? ActionId,
    [property: JsonPropertyName("outil_id")] string? OutilId);

public sealed record SupportRequest(
    [property: JsonPropertyName("header")] JsonObject? Header,
    [property: JsonPropertyName("fields")] JsonObject? Fields);

public sealed record ChatRequest(
    [property: JsonPropertyName("message")] string? Message,
    [property: JsonPropertyName("mode")] string? Mode);

public sealed class ChantierDto
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("titre")] public string Titre { get; set; } = "";
    [JsonPropertyName("probleme")] public string Probleme { get; set; } = "";
    [JsonPropertyName("perimetre")] public string Perimetre { get; set; } = "";
    [JsonPropertyName("pilote")] public string Pilote { get; set; } = "";
    [JsonPropertyName("equipe")] public List<string> Equipe { get; set; } = [];
    [JsonPropertyName("objectif")] public string Objectif { get; set; } = "";
    [JsonPropertyName("outils")] public List<string> Outils { get; set; } = [];
    [JsonPropertyName("date_debut")] public string DateDebut { get; set; } = "";
    [JsonPropertyName("date_fin")] public string DateFin { get; set; } = "";
    [JsonPropertyName("statut")] public string Statut { get; set; } = "a_traiter";
    [JsonPropertyName("eligible_kaizen")] public int? EligibleKaizen { get; set; }
    [JsonPropertyName("quiz_reponses")] public JsonNode? QuizReponses { get; set; }
    [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; set; }
    [JsonPropertyName("actions")] public List<ActionDto> Actions { get; set; } = [];
    [JsonPropertyName("indicateurs")] public List<IndicateurDto> Indicateurs { get; set; } = [];
    [JsonPropertyName("photos")] public List<PhotoDto> Photos { get; set; } = [];
    [JsonPropertyName("photos_outils")] public Dictionary<string, List<PhotoDto>> PhotosOutils { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    [JsonPropertyName("supports")] public Dictionary<string, SupportDto> Supports { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class ActionDto
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("chantier_id")] public int ChantierId { get; set; }
    [JsonPropertyName("description")] public string Description { get; set; } = "";
    [JsonPropertyName("responsable")] public string Responsable { get; set; } = "";
    [JsonPropertyName("echeance")] public string Echeance { get; set; } = "";
    [JsonPropertyName("statut")] public string Statut { get; set; } = "a_faire";
    [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; set; }
    [JsonPropertyName("photos")] public List<PhotoDto> Photos { get; set; } = [];
}

public sealed class IndicateurDto
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("chantier_id")] public int ChantierId { get; set; }
    [JsonPropertyName("nom")] public string Nom { get; set; } = "";
    [JsonPropertyName("unite")] public string Unite { get; set; } = "";
    [JsonPropertyName("valeur_avant")] public double? ValeurAvant { get; set; }
    [JsonPropertyName("valeur_apres")] public double? ValeurApres { get; set; }
}

public sealed class PhotoDto
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("action_id")] public int? ActionId { get; set; }
    [JsonPropertyName("outil_id")] public string? OutilId { get; set; }
    [JsonPropertyName("filename")] public string Filename { get; set; } = "";
    [JsonPropertyName("mime_type")] public string MimeType { get; set; } = "";
    [JsonPropertyName("data")] public string Data { get; set; } = "";
    [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; set; }
}

public sealed class SupportDto
{
    [JsonPropertyName("header")] public JsonObject Header { get; set; } = [];
    [JsonPropertyName("fields")] public JsonObject Fields { get; set; } = [];
    [JsonPropertyName("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
}

public sealed record ChatResponse(
    [property: JsonPropertyName("text")] string Text,
    [property: JsonPropertyName("tools")] List<string> Tools,
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("notice")] string? Notice = null);

internal sealed class ChantierRow
{
    public int Id { get; set; }
    public string Titre { get; set; } = "";
    public string Probleme { get; set; } = "";
    public string Perimetre { get; set; } = "";
    public string Pilote { get; set; } = "";
    public string Equipe { get; set; } = "[]";
    public string Objectif { get; set; } = "";
    public string Outils { get; set; } = "[]";
    public string DateDebut { get; set; } = "";
    public string DateFin { get; set; } = "";
    public string Statut { get; set; } = "a_traiter";
    public int? EligibleKaizen { get; set; }
    public string? QuizReponses { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class SupportRow
{
    public string OutilId { get; set; } = "";
    public string Donnees { get; set; } = "{}";
    public DateTimeOffset UpdatedAt { get; set; }
}
