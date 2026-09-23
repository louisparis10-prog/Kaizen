# Reprendre le projet sur un autre ordinateur

Tout le code est sauvegarde sur GitHub : https://github.com/louisparis10-prog/Kaizen

## Architecture

Node.js + Express + SQL Server (driver `mssql`), servi derriere IIS/ARR.
**Memes technologies et meme organisation que Flash Industriel.**

| Branche | Role | Base | Hebergement |
|---|---|---|---|
| `main` | Version validee, livree a l'IT | SQL Server | IIS interne |
| `render-sandbox` | Bac a sable des nouvelles fonctionnalites | PostgreSQL | Render |

Comme sur Flash Industriel, le sens de circulation est a sens unique :
une fonctionnalite nait d'une branche issue de `main`, elle est fusionnee
dans `render-sandbox` pour etre validee en ligne, puis dans `main`.

Les deux branches ne different que par le serveur et sa base :
`server-sqlserver.js` d'un cote, `server.js` (PostgreSQL) de l'autre.
Tout le reste — `public/`, `data/`, `lib/` — est commun.

## 1. Installer les outils

- Node.js 18 ou superieur (https://nodejs.org)
- Git

## 2. Recuperer le code

```bash
git clone https://github.com/louisparis10-prog/Kaizen.git
cd Kaizen
npm install
```

## 3. Configurer

```bash
copy .env.example .env
```

Renseigner `DB_SERVER`, `DB_NAME`, `DB_USER` et `DB_PASSWORD`.
Le serveur relit ce fichier a chaque demarrage.

## 4. Lancer

```bash
npm start          # ou npm run dev pour le rechargement automatique
```

Les tables sont creees automatiquement au premier demarrage : aucun script
SQL a passer a la main.

## Mise en service sur le serveur

Voir `LANCEMENT.md` — c'est le document a transmettre a l'IT.
