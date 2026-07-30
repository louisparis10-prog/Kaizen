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

## Déploiement — dossier publié autonome

```bash
cd dotnet
dotnet publish -c Release -o ./publish
```

Le dossier `./publish` produit contient **tout** : `KaizenApp.dll`, `Data/` (catalogue +
schéma SQL), et `public/` (le frontend, copié automatiquement — voir la cible MSBuild
`CopyPublicFolder` dans `KaizenApp.csproj`). **Ce dossier se copie tel quel sur n'importe
quel serveur** (Windows, Linux, cloud) sans dépendre du reste du dépôt.

Un seul réglage est nécessaire partout : la chaîne de connexion SQL Server, via la
variable d'environnement `ConnectionStrings__SqlServer` (jamais dans un fichier
committé). Le schéma est créé automatiquement au premier démarrage (`schema.sql`
idempotent) — les données ne sont **jamais effacées** aux redémarrages/redéploiements,
contrairement au plan gratuit Render.

### Option A — Windows Server + IIS (la plus courante en entreprise)

1. Installer l'**ASP.NET Core Hosting Bundle** sur le serveur ([dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0) — inclut le module IIS).
2. Copier le dossier `publish/` dans un répertoire du serveur (ex. `C:\inetpub\kaizen-app`).
3. Dans IIS Manager : créer un site pointant vers ce dossier, avec un Application Pool en **"No Managed Code"** (le runtime .NET est géré par le module ASP.NET Core, pas par IIS).
4. Définir la variable d'environnement `ConnectionStrings__SqlServer` (dans `web.config` généré, ou dans les variables d'environnement du site IIS).
5. Démarrer le site. IIS relance le processus automatiquement s'il s'arrête.

### Option B — Serveur Linux (systemd)

1. Installer le [runtime ASP.NET Core 8](https://learn.microsoft.com/dotnet/core/install/linux) sur le serveur.
2. Copier `publish/` dans `/opt/kaizen-app`.
3. Créer un service systemd (`/etc/systemd/system/kaizen-app.service`) :
   ```ini
   [Unit]
   Description=Kaizen App
   After=network.target

   [Service]
   WorkingDirectory=/opt/kaizen-app
   ExecStart=/usr/bin/dotnet /opt/kaizen-app/KaizenApp.dll
   Restart=always
   User=www-data
   Environment=ConnectionStrings__SqlServer=Server=...;Database=...;User Id=...;Password=...;

   [Install]
   WantedBy=multi-user.target
   ```
4. `sudo systemctl enable --now kaizen-app` — démarre le service et le relance automatiquement au redémarrage du serveur ou en cas de crash.
5. Mettre un reverse proxy devant (nginx/Apache) si un accès HTTPS/nom de domaine interne est nécessaire — pratique standard, non spécifique à cette appli.

### Option C — Azure App Service (si le tenant Azure de l'entreprise est utilisé, comme Flash Industriel)

1. **Azure SQL Database** (tier Basic/Standard) : récupérer la chaîne de connexion ADO.NET.
2. **Azure App Service** (Linux, runtime .NET 8).
3. App Service → Configuration → Application settings : `ConnectionStrings__SqlServer` = la chaîne de connexion Azure SQL.
4. Déployer le dossier `publish/` (zip deploy, GitHub Actions, ou pipeline Azure DevOps — au choix de l'IT selon ce qui est déjà en place pour Flash Industriel).

Dans les trois cas, la base de données (Azure SQL ou SQL Server interne classique) est
interchangeable : le schéma (`Data/schema.sql`) est du T-SQL standard, sans fonctionnalité
propre à Azure — voir la section suivante.

## Compatibilité SQL Server interne vs Azure SQL

Le schéma et le code d'accès aux données (`Store.cs`, `Microsoft.Data.SqlClient`) sont
écrits en T-SQL générique (`SERIAL`→`IDENTITY`, `TIMESTAMPTZ`→`DATETIME2`, clés
étrangères standard) : **aucune fonctionnalité propre à Azure n'est utilisée**. Un SQL
Server interne classique (2016+) fonctionne aussi bien qu'Azure SQL Database — seule la
chaîne de connexion change :

```
# SQL Server interne (authentification Windows ou SQL)
Server=NOM-DU-SERVEUR\INSTANCE;Database=KaizenApp;User Id=...;Password=...;TrustServerCertificate=True;

# Azure SQL Database
Server=tcp:VOTRE-SERVEUR.database.windows.net,1433;Database=KaizenApp;User Id=...;Password=...;Encrypt=True;
```

Si l'IT préfère héberger la base sur un SQL Server déjà existant en interne plutôt que
de provisionner une base Azure, c'est directement compatible sans changement de code.

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

- Aucun point bloquant côté code. Il reste à choisir avec l'IT l'option d'hébergement
  (A/B/C ci-dessus) et à obtenir un premier accès au serveur/base cible pour un run réel
  de validation (le CI valide la compilation et l'artefact, pas l'exécution contre une
  vraie base — voir la note à ce sujet plus haut dans la conversation).
