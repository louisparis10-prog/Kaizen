# Kaizen App — backend .NET 8 (migration)

Portage du backend Node/Express/SQLite vers **ASP.NET Core Minimal API + Azure SQL**,
selon l'architecture cible (voir `ARCHITECTURE-A-REPLIQUER.md`). Le frontend
(`../public/`) est **partagé** avec la version Node et servi tel quel par ce backend.

> Cette version vit sur la branche `dotnet-migration`. La version Node reste
> déployée sur Render depuis `main` et n'est pas touchée tant que la bascule
> n'est pas décidée.

## Structure

| Fichier | Rôle |
|---|---|
| `Program.cs` | Point d'entrée, câblage des endpoints (Minimal API à plat), fichiers statiques, fallback SPA |
| `Store.cs` | Accès aux données (Azure SQL via `Microsoft.Data.SqlClient`, requêtes paramétrées) |
| `Catalog.cs` | Catalogue statique (42 outils + 5 phases) chargé depuis `Data/*.json` + logique de tri/validation par phase |
| `Data/schema.sql` | Schéma T-SQL idempotent (créé au démarrage) |
| `Data/tools.json`, `Data/phases.json` | Données du catalogue (identiques à celles servies par l'API Node) |
| `appsettings*.json` | Configuration (chaîne de connexion, port, chemin du frontend) |

## Lancer en local

Prérequis : **SDK .NET 8** et une base **SQL Server** accessible
(Azure SQL, SQL Server Express, ou LocalDB pour le développement).

```bash
cd dotnet
# la chaîne de connexion de dev est dans appsettings.Development.json (LocalDB par défaut)
dotnet run
```
L'application écoute sur `http://localhost:8080` et sert le frontend de `../public/`.

Ne jamais commiter de secret : en production, la chaîne de connexion vient des
**App Settings Azure App Service**, pas de `appsettings.json`.

## Intégration continue

`.github/workflows/dotnet.yml` compile et publie le projet à chaque push
touchant `dotnet/`. C'est la validation de compilation (aucun SDK requis en local).

## Déploiement Azure (à activer quand les accès IT seront disponibles)

1. **Azure SQL Database** (tier Basic/Standard). Récupérer la chaîne de connexion ADO.NET.
2. **Azure App Service** (Linux, runtime .NET 8).
3. App Service → Configuration → Application settings :
   - `ConnectionStrings__SqlServer` = la chaîne de connexion Azure SQL
   - `PublicPath` = chemin du dossier `public` dans l'artefact publié (voir ci-dessous)
4. Publier : `dotnet publish -c Release`. Le dossier `public/` doit être inclus à côté
   du binaire (copie du `../public` dans l'artefact, ou `PublicPath` pointant vers son emplacement).
5. Le schéma est créé automatiquement au premier démarrage (`schema.sql` idempotent) —
   contrairement à Render, **les données ne sont pas effacées** aux redéploiements.

## Chat expert (IA)

Le chat (`Chat.cs`, endpoints `/api/chat` et `/api/chat/status`) est **100 % IA**,
via l'API Claude (Anthropic) appelée en HTTP direct. Configuration par variables
d'environnement (App Settings Azure), jamais en dur :

- `ANTHROPIC_API_KEY` — la clé API (obligatoire pour activer le chat)
- `ANTHROPIC_MODEL` — le modèle Claude (optionnel ; défaut `claude-opus-4-8`).
  L'IT peut choisir un modèle moins coûteux (ex. `claude-haiku-4-5`, `claude-sonnet-5`).

Sans clé configurée, le chat renvoie un message clair invitant à se tourner vers
la bibliothèque d'outils (l'appli reste pleinement fonctionnelle).

## Reste à faire

- Étape de publication incluant `public/` dans l'artefact pour Azure.
