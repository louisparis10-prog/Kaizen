# Reprendre le projet sur un autre ordinateur

Tout le code est sauvegarde sur GitHub : https://github.com/louisparis10-prog/Kaizen
C'est ca, ta copie complete — pas besoin de transferer des fichiers a la main.

## 1. Installer les outils de base (si pas deja fait)
- .NET SDK 8 (https://dotnet.microsoft.com/download/dotnet/8.0)
- Git (deja installe sur Mac en general)

## 2. Recuperer le code
```
git clone git@github.com:louisparis10-prog/Kaizen.git
cd Kaizen
dotnet restore dotnet/KaizenApp.csproj --configfile dotnet/NuGet.Config
```

Si `git clone` demande une authentification et refuse (`Permission denied` ou `Repository not found`) :
c'est qu'il faut ajouter une cle SSH de CE nouveau PC a ton compte GitHub (meme procedure que la premiere fois) :
```
ssh-keygen -t ed25519 -C "ton-email" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```
Copie la cle affichee sur https://github.com/settings/ssh/new, puis relance `git clone`.

## 3. Lancer l'appli en local
```
dotnet run --project dotnet/KaizenApp.csproj
```
Ouvre l adresse affichee par .NET dans le terminal.

Configure `ConnectionStrings__SqlServer` pour utiliser SQL Server en local. Le backend
.NET n utilise pas `DATABASE_URL` ni PostgreSQL. Le schema est cree automatiquement
au premier demarrage.

Pour activer le chat IA en local, il faut la variable d'environnement avec ta cle Anthropic :
```
$env:ANTHROPIC_API_KEY="sk-ant-..."
dotnet run --project dotnet/KaizenApp.csproj
```
(La cle n'est jamais dans le code : elle est configuree localement ou dans App Service.)

## 4. Deployer les modifications sur Azure
La procedure complete Azure App Service + Azure SQL se trouve dans `AZURE_DEPLOYMENT.md`.
L infrastructure est decrite dans `infra/` et se deploie avec `azd up`.

## Liens utiles
- Repo GitHub : https://github.com/louisparis10-prog/Kaizen
- Documentation Azure : `AZURE_DEPLOYMENT.md`

## A savoir
- Les donnees sont conservees dans Azure SQL et ne dependent pas du disque de l App Service.
