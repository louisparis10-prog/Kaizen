# Kaizen Toolbox — mise en service

Application Node.js + Express + SQL Server, servie derriere IIS/ARR.
Meme architecture et memes technologies que Flash Industriel.

## Contenu du paquet

| Fichier / dossier | Role |
|---|---|
| `server-sqlserver.js` | Le serveur. C'est le point d'entree. |
| `package.json`, `package-lock.json` | Dependances : `express`, `mssql`, `jszip`. |
| `public/` | Les pages, le style, les scripts et les trames SWM. |
| `data/tools.js` | Le catalogue des 43 outils Kaizen et des 5 phases. |
| `lib/` | Le chat expert (`leanExpert.js`) et le remplissage des trames (`trameSwm.js`). |
| `.env.example` | Modele de configuration a copier en `.env`. |

## Prerequis

- Node.js 18 ou superieur.
- SQL Server 2016 ou superieur.
- Une base vide et un compte SQL ayant le droit d'y creer des tables.

## Installation

1. Copier le dossier sur le serveur.

2. Installer les dependances :

```bash
npm install --omit=dev
```

3. Creer le fichier de configuration a cote de `server-sqlserver.js` :

```bash
copy .env.example .env
```

puis renseigner `DB_SERVER`, `DB_NAME`, `DB_USER` et `DB_PASSWORD`.

4. Demarrer :

```bash
npm start
```

**Aucun script SQL a passer a la main.** Les tables et les index sont crees
automatiquement au premier demarrage, et la creation est idempotente : sur une
base qui contient deja des donnees, rien n'est supprime ni ecrase.

### Si la base est partagee avec une autre application

L'application cree cinq tables : `chantiers`, `actions`, `indicateurs`,
`photos` et `supports`. Ces noms sont courants — `actions` en particulier — et
peuvent deja exister pour une autre application. Dans ce cas le demarrage
s'arrete avec un message nommant la table et les colonnes en cause.

Deux solutions :

1. **Une base dediee et vide** — le plus simple.
2. **Un schema dedie** : renseigner `DB_SCHEMA=kaizen` dans le `.env`. Les
   tables deviennent `kaizen.chantiers`, `kaizen.actions`, etc., sans aucune
   collision possible. Le schema est cree au demarrage si le compte en a le
   droit ; sinon, le faire creer une fois :

```sql
CREATE SCHEMA kaizen;
GRANT CONTROL ON SCHEMA::kaizen TO kaizen_user;
```

L'application ne touche jamais aux tables situees hors de son schema.

## Verifier que tout fonctionne

Le journal de demarrage indique quel fichier de configuration a ete lu, vers
quel serveur la connexion est tentee et sur quel port l'application ecoute.
Le mot de passe n'y figure jamais.

```
Configuration lue dans C:\...\.env (5 variable(s) : DB_SERVER, DB_NAME, ...)
Cible SQL Server : SRVPROD:1433 · base kaizen_toolbox · utilisateur kaizen_user
Point d'ecoute : 3000
Base de donnees SQL Server initialisee
Kaizen Toolbox (SQL Server) -> http://localhost:3000
```

Une sonde de disponibilite est exposee pour la supervision :

```
GET /health   ->  {"status":"ok","database":"sqlserver"}
```

Elle renvoie `503` si la base n'est pas joignable : c'est la verification a
utiliser apres une mise en service ou un redemarrage.

## Sous IIS

Le point d'ecoute est impose par l'hebergeur (canal nomme iisnode). Pour cette
raison, `PORT` est la seule variable que le fichier `.env` ne peut pas
remplacer : la laisser commentee.

## Tables creees

| Table | Contenu |
|---|---|
| `chantiers` | La fiche de chaque chantier et son questionnaire d'eligibilite. |
| `actions` | Le plan d'action, une ligne par tache. |
| `indicateurs` | Les mesures avant / apres. |
| `photos` | Les photos, rattachees au chantier, a une action ou a un outil. |
| `supports` | Les supports SWM remplis, une ligne par couple chantier / outil. |

## Points d'attention

- **Pas d'authentification.** Contrairement a Flash Industriel, cette
  application n'a ni comptes ni SSO : toute personne qui atteint l'URL peut
  lire et modifier les chantiers. A placer derriere une restriction reseau,
  ou a completer par le meme module d'authentification que Flash Industriel.
- **Taille des photos.** Elles sont stockees en base, encodees en texte. Le
  navigateur les reduit avant envoi, mais la base grossit avec l'usage.
- **Certificat SQL Server.** `trustServerCertificate` est a `true` pour
  accepter un certificat interne. Le passer a `false` si le serveur presente
  un certificat reconnu.
