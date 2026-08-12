using System.IO.Compression;
using System.Security;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace KaizenApp.Services;

public sealed record TemplateResult(byte[] Buffer, IReadOnlyList<string> NonPlaces, int LignesIgnorees,
    IReadOnlyList<string> CausesEnTrop, string Extension = "pptx");

public sealed partial class PptxTemplateService
{
    private readonly IWebHostEnvironment _environment;
    private static int _shapeId = 9000;

    public PptxTemplateService(IWebHostEnvironment environment) => _environment = environment;

    public bool IsAvailable(string toolId) => Templates.ContainsKey(toolId);

    public async Task<TemplateResult> FillAsync(string toolId, JsonObject header, JsonObject fields)
    {
        if (!Templates.TryGetValue(toolId, out var template))
            throw new KeyNotFoundException($"Aucune trame SWM remplissable pour l'outil {toolId}.");

        var templatePath = ResolveTemplatePath(template.File);
        await using var input = File.OpenRead(templatePath);
        using var sourceZip = new ZipArchive(input, ZipArchiveMode.Read, leaveOpen: true);
        var slideEntry = sourceZip.GetEntry("ppt/slides/slide1.xml")
            ?? throw new InvalidDataException("La premiere diapositive est absente de la trame.");
        string xml;
        await using (var stream = slideEntry.Open())
        using (var reader = new StreamReader(stream, Encoding.UTF8))
            xml = await reader.ReadToEndAsync();

        var nonPlaces = new List<string>();
        var extraCauses = new List<string>();
        var ignoredRows = 0;

        foreach (var item in template.Headers)
            xml = FillHeader(xml, item, Text(header, item.Id));

        foreach (var item in template.Cases)
        {
            var value = Text(fields, item.Id);
            var result = WriteInBox(xml, item.X, item.Y, value);
            xml = result.Xml;
            if (!result.Found && !string.IsNullOrWhiteSpace(value)) nonPlaces.Add(item.Id);
        }

        foreach (var column in template.Columns)
        {
            var lines = Lines(Text(fields, column.Id));
            for (var i = 0; i < Math.Min(lines.Count, column.Positions.Count); i++)
            {
                var result = WriteInBox(xml, column.Positions[i].X, column.Positions[i].Y, lines[i]);
                xml = result.Xml;
                if (!result.Found) nonPlaces.Add(column.Id);
            }
            if (lines.Count > column.Positions.Count)
                extraCauses.Add($"{column.Id} ({lines.Count - column.Positions.Count})");
        }

        foreach (var zone in template.TextZones)
            xml = AddTextZone(xml, zone, Text(fields, zone.Id, Text(header, zone.Id)));

        foreach (var column in template.TextColumns)
        {
            var lines = Lines(Text(fields, column.Id, Text(header, column.Id)));
            for (var i = 0; i < Math.Min(lines.Count, template.LineY.Count); i++)
            {
                var zone = new TextZone($"{column.Id}-{i}", column.X, template.LineY[i], column.Cx,
                    template.LineHeight, 900, "ctr");
                xml = AddTextZone(xml, zone, lines[i]);
            }
            ignoredRows += Math.Max(0, lines.Count - template.LineY.Count);
        }

        if (template.Quadrants is not null && fields[template.Quadrants.Field] is JsonArray solutions)
        {
            foreach (var zone in template.Quadrants.Zones)
            {
                var texts = solutions.OfType<JsonObject>()
                    .Where(s => Text(s, "gain") == zone.Gain && Text(s, "effort") == zone.Effort)
                    .Select(s => Text(s, template.Quadrants.TextField)).Where(x => x.Length > 0).Select(x => "- " + x);
                var value = string.Join('\n', texts);
                if (value.Length > 0)
                    xml = AddTextZone(xml, new TextZone($"quadrant-{zone.Gain}-{zone.Effort}", zone.X, zone.Y, zone.Cx, zone.Cy, 1000), value);
            }
        }

        if (template.Table is not null && fields[template.Table.Field] is JsonArray tableRows)
        {
            ignoredRows = Math.Max(ignoredRows, tableRows.Count - template.Table.MaxRows);
            for (var rowIndex = 0; rowIndex < Math.Min(tableRows.Count, template.Table.MaxRows); rowIndex++)
            {
                if (tableRows[rowIndex] is not JsonObject row) continue;
                foreach (var mapping in template.Table.Columns)
                    xml = WriteCell(xml, rowIndex + 1, mapping.Value, Text(row, mapping.Key));
            }
        }

        var destinations = template.Cases.Select(x => x.Id)
            .Concat(template.Columns.Select(x => x.Id))
            .Concat(template.TextColumns.Select(x => x.Id))
            .Concat(template.TextZones.Select(x => x.Id))
            .Concat(template.Table is null ? [] : new[] { template.Table.Field })
            .Concat(template.Quadrants is null ? [] : new[] { template.Quadrants.Field })
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var item in fields)
        {
            var filled = item.Value is JsonArray array ? array.Count > 0 : !string.IsNullOrWhiteSpace(item.Value?.ToString());
            if (filled && !destinations.Contains(item.Key)) nonPlaces.Add(item.Key);
        }

        using var output = new MemoryStream();
        using (var outputZip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var entry in sourceZip.Entries)
            {
                var newEntry = outputZip.CreateEntry(entry.FullName, CompressionLevel.Optimal);
                newEntry.LastWriteTime = entry.LastWriteTime;
                await using var target = newEntry.Open();
                if (entry.FullName == "ppt/slides/slide1.xml")
                {
                    await using var writer = new StreamWriter(target, new UTF8Encoding(false), leaveOpen: true);
                    await writer.WriteAsync(xml);
                }
                else
                {
                    await using var source = entry.Open();
                    await source.CopyToAsync(target);
                }
            }
        }
        return new TemplateResult(output.ToArray(), nonPlaces.Distinct().ToList(), ignoredRows, extraCauses);
    }

    private string ResolveTemplatePath(string file)
    {
        var candidates = new[]
        {
            Path.Combine(_environment.ContentRootPath, "..", "public", "templates", file),
            Path.Combine(_environment.WebRootPath ?? "", "templates", file),
            Path.Combine(AppContext.BaseDirectory, "wwwroot", "templates", file)
        };
        return candidates.FirstOrDefault(File.Exists) ?? throw new FileNotFoundException($"Trame {file} introuvable.");
    }

    private static (string Xml, bool Found) ModifyShape(string xml, long x, long y, Func<string, string?> transform)
    {
        var blocks = xml.Split("<p:sp>");
        var found = false;
        for (var i = 1; i < blocks.Length; i++)
        {
            if (!blocks[i].Contains($"<a:off x=\"{x}\" y=\"{y}\"/>", StringComparison.Ordinal)) continue;
            var modified = transform(blocks[i]);
            if (modified is not null) { blocks[i] = modified; found = true; }
            break;
        }
        return (string.Join("<p:sp>", blocks), found);
    }

    private static (string Xml, bool Found) WriteInBox(string xml, long x, long y, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return (xml, true);
        return ModifyShape(xml, x, y, block =>
        {
            var start = block.IndexOf("<p:txBody>", StringComparison.Ordinal);
            var end = block.IndexOf("</p:txBody>", StringComparison.Ordinal);
            if (start < 0 || end < 0) return null;
            var body = block[(start + 10)..end];
            var endProperties = EndPropertiesRegex().Match(body).Value;
            var runProperties = string.IsNullOrEmpty(endProperties)
                ? "<a:rPr lang=\"fr-FR\" dirty=\"0\"/>"
                : endProperties.Replace("<a:endParaRPr", "<a:rPr", StringComparison.Ordinal);
            var bodyProperties = BodyPropertiesRegex().Match(body).Value;
            var listStyle = ListStyleRegex().Match(body).Value;
            var header = (bodyProperties.Length > 0 ? bodyProperties : "<a:bodyPr/>") +
                         (listStyle.Length > 0 ? listStyle : "<a:lstStyle/>");
            return block[..start] + "<p:txBody>" + header + Paragraphs(text, runProperties) +
                   "</p:txBody>" + block[(end + 11)..];
        });
    }

    private static string AddTextZone(string xml, TextZone zone, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return xml;
        var id = Interlocked.Increment(ref _shapeId);
        var paragraphs = Lines(text).Select(line =>
            $"<a:p><a:r><a:rPr lang=\"fr-FR\" sz=\"{zone.Size}\" dirty=\"0\"/><a:t>{Escape(line)}</a:t></a:r></a:p>");
        var anchor = string.IsNullOrWhiteSpace(zone.Anchor) ? "" : $" anchor=\"{zone.Anchor}\"";
        var shape = $"<p:sp><p:nvSpPr><p:cNvPr id=\"{id}\" name=\"Saisie {Escape(zone.Id)}\"/>" +
            "<p:cNvSpPr txBox=\"1\"/><p:nvPr/></p:nvSpPr>" +
            $"<p:spPr><a:xfrm><a:off x=\"{zone.X}\" y=\"{zone.Y}\"/><a:ext cx=\"{zone.Cx}\" cy=\"{zone.Cy}\"/></a:xfrm>" +
            "<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>" +
            $"<p:txBody><a:bodyPr wrap=\"square\" lIns=\"45720\" tIns=\"45720\" rIns=\"45720\" bIns=\"45720\"{anchor}>" +
            $"<a:normAutofit/></a:bodyPr><a:lstStyle/>{string.Join("", paragraphs)}</p:txBody></p:sp>";
        return xml.Replace("</p:spTree>", shape + "</p:spTree>", StringComparison.Ordinal);
    }

    private static string FillHeader(string xml, HeaderField field, string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return xml;
        return ModifyShape(xml, field.X, field.Y, block =>
        {
            if (!block.Contains(field.Label, StringComparison.OrdinalIgnoreCase)) return null;
            var replaced = false;
            return TextRegex().Replace(block, match =>
            {
                if (replaced || !match.Groups[1].Value.Contains('_')) return match.Value;
                replaced = true;
                return $"<a:t> {Escape(value)}</a:t>";
            });
        }).Xml;
    }

    private static string WriteCell(string xml, int row, int column, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return xml;
        var rows = xml.Split("<a:tr ");
        if (row + 1 >= rows.Length) return xml;
        var cells = rows[row + 1].Split("</a:tc>");
        if (column >= cells.Length - 1) return xml;
        cells[column] = CellBodyRegex().Replace(cells[column], match =>
        {
            var endProperties = EndPropertiesRegex().Match(match.Value).Value;
            var runProperties = string.IsNullOrEmpty(endProperties)
                ? "<a:rPr lang=\"fr-FR\" dirty=\"0\"/>"
                : endProperties.Replace("<a:endParaRPr", "<a:rPr", StringComparison.Ordinal);
            var bodyProperties = BodyPropertiesRegex().Match(match.Value).Value;
            return "<a:txBody>" + (bodyProperties.Length > 0 ? bodyProperties : "<a:bodyPr/>") +
                   "<a:lstStyle/>" + Paragraphs(text, runProperties) + "</a:txBody>";
        }, 1);
        rows[row + 1] = string.Join("</a:tc>", cells);
        return string.Join("<a:tr ", rows);
    }

    private static string Paragraphs(string text, string runProperties) => string.Join("", Lines(text)
        .Select(line => $"<a:p><a:r>{runProperties}<a:t>{Escape(line)}</a:t></a:r></a:p>"));
    private static List<string> Lines(string text) => (text ?? "").Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
        .Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
    private static string Text(JsonObject source, string id, string fallback = "") => source[id] switch
    {
        JsonValue value when value.TryGetValue<string>(out var text) => text?.Trim() ?? fallback,
        _ => fallback
    };
    private static string Escape(string value) => SecurityElement.Escape(value) ?? "";

    [GeneratedRegex("<a:endParaRPr[^>]*/>", RegexOptions.Singleline)] private static partial Regex EndPropertiesRegex();
    [GeneratedRegex("<a:bodyPr[^>]*(?:/>|>[\\s\\S]*?</a:bodyPr>)", RegexOptions.Singleline)] private static partial Regex BodyPropertiesRegex();
    [GeneratedRegex("<a:lstStyle[^>]*(?:/>|>[\\s\\S]*?</a:lstStyle>)", RegexOptions.Singleline)] private static partial Regex ListStyleRegex();
    [GeneratedRegex("<a:t>([^<]*)</a:t>")] private static partial Regex TextRegex();
    [GeneratedRegex("<a:txBody>[\\s\\S]*?</a:txBody>", RegexOptions.Singleline)] private static partial Regex CellBodyRegex();

    private static readonly Dictionary<string, TemplateDefinition> Templates = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ishikawa"] = new("ishikawa-swm.pptx",
            Headers: [new("chantier",6548954,174157,"Chantier"), new("date",6548954,174157,"Date")],
            TextZones:
            [
                new("main_oeuvre",1121135,1680000,2300000,930000,900), new("materiel",3940321,1680000,2300000,930000,900),
                new("machine",6786609,1680000,2300000,930000,900), new("milieu",1507762,4700000,2300000,930000,900,"b"),
                new("methode",4329659,4700000,2300000,930000,900,"b"), new("mesure",7166389,4700000,2300000,930000,900,"b"),
                new("probleme",10010000,4130000,1420000,1350000,900)
            ]),
        ["matrice-gain-effort"] = new("matrice-gain-effort-swm.pptx",
            Headers: [new("chantier",6548954,174157,"Chantier"), new("date",6548954,174157,"Date")],
            Quadrants: new("solutions", "solution",
            [
                new("Eleve","Faible",2023711,1742684,3280742,1580883), new("Eleve","Eleve",5721714,1742684,3280742,1580883),
                new("Faible","Faible",2023711,4001436,3280742,1586124), new("Faible","Eleve",5721714,4001436,3280742,1586124)
            ])),
        ["5-pourquoi"] = new("5-pourquoi-swm.pptx",
            Headers: [new("animateur",6548954,174157,"Animateur"), new("secteur",6548954,174157,"Secteur"), new("date",6548954,174157,"Date")],
            Columns:
            [
                new("pourquoi1", [new(190129,2172826),new(190129,3554617),new(190129,4904617)]),
                new("pourquoi2", [new(2603218,1754617),new(2603218,2654617),new(2603218,3554617),new(2603218,4454617),new(2603218,5354617)]),
                new("pourquoi3", [new(5016307,1754617),new(5016307,2654617),new(5016307,3554617),new(5016307,4454617),new(5016307,5354617)]),
                new("pourquoi4", [new(7400730,1754617),new(7400730,2654617),new(7400730,3554617),new(7400730,4454617),new(7400730,5354617)]),
                new("pourquoi5", [new(9813819,1754617),new(9813819,2654617),new(9813819,3554617),new(9813819,4454617),new(9813819,5354617)])
            ], TextZones: [new("probleme",190129,560000,6100000,400000,1200)]),
        ["qqoqccp"] = new("qqoqccp-swm.pptx",
            Headers: [new("animateur",6548954,194082,"Animateur"),new("secteur",6548954,194082,"Secteur"),new("date",6548954,194082,"Date")],
            Cases:
            [
                new("quoi",1794721,1013281),new("qui",1794720,2455478),new("ou",1794720,3906577),new("quand",1794720,5360654),
                new("combien",7770281,2455478),new("comment",7770281,3906577),new("pourquoi",7770281,5360654)
            ]),
        ["sipoc"] = new("sipoc-swm.pptx",
            TextZones:
            [
                new("ind_exigences",2554483,5035296,2170000,1150000,900),new("ind_pilotage",4975814,5035296,2170000,1150000,900),
                new("ind_resultats",7397145,5035296,2170000,1150000,900),new("voix_client",9818476,5035296,2170000,1150000,900),
                new("processus",182880,4948000,2183587,215000,700),new("responsable",182880,5310000,2183587,215000,700),
                new("date",182880,5673000,2183587,215000,700),new("revision",182880,6036000,2183587,215000,700)
            ],
            TextColumns:
            [
                new("suppliers",151440,2200000),new("inputs",2572771,2200000),new("process",5330000,1880000),
                new("outputs",7415433,2200000),new("customers",9836764,2200000)
            ], LineY: [1517904,1883664,2249424,2615184,2980944,3346704,3712464,4078224], LineHeight: 365760),
        ["7-gaspillages"] = new("chasse-aux-mudas-swm.pptx",
            Headers: [new("date",5650992,256032,"Date"),new("secteur",7438644,256032,"Secteur"),new("equipe",5650992,512064,"quipe"),new("animateur",7438644,539496,"Animateur")],
            Table: new("gaspillages", 10, new Dictionary<string, int> { ["type"]=1, ["zone"]=2, ["probleme"]=3, ["impact"]=4 }))
    };
}

internal sealed record TemplateDefinition(string File,
    List<HeaderField>? Headers = null, List<BoxField>? Cases = null, List<MultiColumn>? Columns = null,
    List<TextZone>? TextZones = null, List<TextColumn>? TextColumns = null, List<long>? LineY = null,
    long LineHeight = 0, QuadrantDefinition? Quadrants = null, TableDefinition? Table = null)
{
    public List<HeaderField> Headers { get; } = Headers ?? [];
    public List<BoxField> Cases { get; } = Cases ?? [];
    public List<MultiColumn> Columns { get; } = Columns ?? [];
    public List<TextZone> TextZones { get; } = TextZones ?? [];
    public List<TextColumn> TextColumns { get; } = TextColumns ?? [];
    public List<long> LineY { get; } = LineY ?? [];
}
internal sealed record HeaderField(string Id, long X, long Y, string Label);
internal sealed record BoxField(string Id, long X, long Y);
internal sealed record Position(long X, long Y);
internal sealed record MultiColumn(string Id, List<Position> Positions);
internal sealed record TextZone(string Id, long X, long Y, long Cx, long Cy, int Size = 1100, string? Anchor = null);
internal sealed record TextColumn(string Id, long X, long Cx);
internal sealed record QuadrantZone(string Gain, string Effort, long X, long Y, long Cx, long Cy);
internal sealed record QuadrantDefinition(string Field, string TextField, List<QuadrantZone> Zones);
internal sealed record TableDefinition(string Field, int MaxRows, Dictionary<string, int> Columns);
