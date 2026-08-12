# Deploiement .NET 8 + Azure SQL

L application principale se trouve maintenant dans `dotnet/`. Elle conserve les memes routes HTTP et les memes ecrans que la version Node.js, mais toutes les donnees metier sont stockees dans SQL Server / Azure SQL. PostgreSQL n est pas utilise par ce backend.

## Ressources creees

`azd up` provisionne puis deploie :

- un Azure App Service Linux en .NET 8 ;
- un App Service Plan B1 ;
- un serveur Azure SQL et une base `kaizen` ;
- la chaine de connexion `SqlServer` dans la configuration protegee de l App Service.

Au premier demarrage, l application execute automatiquement `dotnet/Sql/schema.sql`. Le script est idempotent : il cree les tables et les index absents sans supprimer les donnees existantes.

## Deploiement avec Azure Developer CLI

Prerequis :

- une souscription Azure avec le role Contributor ;
- .NET SDK 8 ;
- Azure Developer CLI (`azd`).

Depuis la racine du depot :

```powershell
azd auth login
azd env new dev
azd env set AZURE_LOCATION francecentral
azd env set SQL_ADMIN_LOGIN kaizenadmin
azd env set SQL_ADMIN_PASSWORD "un-mot-de-passe-fort-et-unique"
azd up
```

Le mot de passe reste dans l environnement local `.azure`, qui est ignore par Git. Il est transmis a Azure comme parametre Bicep securise et enregistre comme chaine de connexion protegee de l App Service.

Pour redeployer uniquement le code apres une modification :

```powershell
azd deploy web
```

Pour verifier le service :

```powershell
azd show
```

Puis ouvrir l URL du service et verifier `/health`. Une reponse HTTP 200 avec `"database":"sqlserver"` confirme que l application et le schema Azure SQL sont disponibles.

## Lancement local avec SQL Server

Configurer la chaine de connexion sans la placer dans Git :

```powershell
$env:ConnectionStrings__SqlServer = "Server=localhost;Database=Kaizen;User Id=sa;Password=...;Encrypt=True;TrustServerCertificate=True"
dotnet run --project dotnet/KaizenApp.csproj
```

La page est alors accessible a l adresse affichee par `dotnet run`.

## Azure DevOps

Le fichier `azure-pipelines.yml` compile et publie l artefact ZIP `kaizen-app`. Sur la branche `main`, il execute aussi `azd up` pour provisionner Azure et deployer l application.

Configurer une seule fois le projet Azure DevOps :

1. installer l extension Azure Dev CLI (`setup-azd`) depuis le Marketplace Azure DevOps ;
2. creer une connexion de service Azure Resource Manager nommee `azconnection` ;
3. creer la variable `AZURE_SUBSCRIPTION_ID` avec l identifiant de la souscription ;
4. creer la variable secrete `SQL_ADMIN_PASSWORD` avec un mot de passe fort ;
5. ajuster si besoin `AZURE_ENV_NAME`, `AZURE_LOCATION` et `SQL_ADMIN_LOGIN` dans le YAML.

Les Pull Requests ne provisionnent rien : elles compilent et produisent uniquement l artefact. Le deploiement est reserve aux changements integres dans `main`.

Les secrets IA restent optionnels. Ils peuvent etre ajoutes dans App Service > Configuration avec les noms `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` ou `GROQ_API_KEY`.

## Donnees de l ancienne base PostgreSQL

Le nouveau schema Azure SQL est pret pour une base neuve. Le deploiement ne copie pas automatiquement les anciennes lignes PostgreSQL : une migration ponctuelle doit etre executee avant la bascule si les donnees Render existantes doivent etre conservees.
