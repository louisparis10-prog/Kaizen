// ============================================================
// KAIZEN TOOLBOX — server.js adapte SQL Server
// Driver : mssql  (npm install mssql)
// Requis  : SQL Server 2016+
//
// Meme architecture que Flash Industriel : Node.js + Express + mssql,
// servi derriere IIS/ARR, configuration lue dans un .env place a cote
// de ce fichier, tables creees automatiquement au demarrage.
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { TOOLS, TOOLS_BY_ID, PHASES, PHASES_BY_ID } = require('./data/tools.js');
const leanExpert = require('./lib/leanExpert.js');
const trameSwm = require('./lib/trameSwm.js');

// ── Lecture du fichier .env ─────────────────────────────────
// Le serveur lit lui-meme son fichier .env, a chaque demarrage : la
// configuration n'a donc pas a etre injectee par le service ou par IIS.
//
// Le fichier fait autorite : ses valeurs remplacent celles deja presentes
// dans l'environnement. C'est l'inverse de la convention habituelle, et
// c'est voulu — modifier le .env doit toujours changer ce que le serveur
// utilise, sans quoi une variable oubliee dans l'environnement de la
// machine prendrait le dessus en silence.
//
// PORT fait exception : sous IIS, c'est l'hebergeur qui impose le point
// d'ecoute au processus Node. L'ecraser depuis le fichier rendrait
// l'application injoignable.
const RESERVE_A_L_HEBERGEUR = ['PORT'];

function chargerEnv(fichier) {
  let contenu;
  try {
    contenu = fs.readFileSync(fichier, 'utf8');
  } catch (err) {
    return null;   // pas de .env : on garde l'environnement tel quel
  }

  const cles = [];
  for (const ligne of contenu.split(/\r?\n/)) {
    const l = ligne.trim();
    if (!l || l.startsWith('#')) continue;

    const sep = l.indexOf('=');
    if (sep < 1) continue;

    const cle = l.slice(0, sep).trim();
    let valeur = l.slice(sep + 1).trim();

    // Les guillemets encadrants sont retires : un mot de passe contenant
    // des espaces ou un « # » doit pouvoir etre protege.
    const q = valeur[0];
    if ((q === '"' || q === "'") && valeur.endsWith(q) && valeur.length > 1) {
      valeur = valeur.slice(1, -1);
    }

    if (RESERVE_A_L_HEBERGEUR.includes(cle) && process.env[cle] !== undefined) continue;

    process.env[cle] = valeur;
    cles.push(cle);
  }
  return { fichier, cles };
}

const FICHIER_ENV = path.join(__dirname, '.env');
const envCharge = chargerEnv(FICHIER_ENV);

const app = express();
const PORT = process.env.PORT || 3000;

// ── Connexion SQL Server ────────────────────────────────────
// Renseigner ces valeurs dans le fichier .env, a cote de ce fichier
const dbConfig = {
  server: process.env.DB_SERVER || 'VOTRE_SERVEUR',   // ex: 'SRVPROD\\SQLEXPRESS'
  database: process.env.DB_NAME || 'kaizen_toolbox',
  user: process.env.DB_USER || 'kaizen_user',
  password: process.env.DB_PASSWORD || 'VOTRE_MOT_DE_PASSE',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true,   // mettre false en production si certificat SSL valide
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  }
};

let pool;

async function getPool() {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
}

// ── Initialisation des tables ───────────────────────────────
// Idempotent : cree ce qui manque, ne touche jamais aux donnees existantes.
async function initDB() {
  const p = await getPool();

  await p.request().query(`
    IF OBJECT_ID('chantiers', 'U') IS NULL
    CREATE TABLE chantiers (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      titre            NVARCHAR(500)  NOT NULL,
      probleme         NVARCHAR(MAX)  NULL,
      perimetre        NVARCHAR(500)  NULL,
      pilote           NVARCHAR(200)  NULL,
      equipe           NVARCHAR(MAX)  NULL,
      objectif         NVARCHAR(MAX)  NULL,
      outils           NVARCHAR(MAX)  NULL,
      date_debut       NVARCHAR(10)   NULL,
      date_fin         NVARCHAR(10)   NULL,
      statut           NVARCHAR(20)   NOT NULL DEFAULT 'a_traiter',
      eligible_kaizen  INT            NULL,
      quiz_reponses    NVARCHAR(MAX)  NULL,
      created_at       DATETIME2      DEFAULT GETDATE()
    );
  `);

  await p.request().query(`
    IF OBJECT_ID('actions', 'U') IS NULL
    CREATE TABLE actions (
      id           INT IDENTITY(1,1) PRIMARY KEY,
      chantier_id  INT            NOT NULL,
      description  NVARCHAR(MAX)  NOT NULL,
      responsable  NVARCHAR(200)  NULL,
      echeance     NVARCHAR(10)   NULL,
      statut       NVARCHAR(20)   NOT NULL DEFAULT 'a_faire',
      created_at   DATETIME2      DEFAULT GETDATE()
    );
  `);

  await p.request().query(`
    IF OBJECT_ID('indicateurs', 'U') IS NULL
    CREATE TABLE indicateurs (
      id            INT IDENTITY(1,1) PRIMARY KEY,
      chantier_id   INT            NOT NULL,
      nom           NVARCHAR(300)  NOT NULL,
      unite         NVARCHAR(50)   NULL,
      valeur_avant  FLOAT          NULL,
      valeur_apres  FLOAT          NULL
    );
  `);

  await p.request().query(`
    IF OBJECT_ID('photos', 'U') IS NULL
    CREATE TABLE photos (
      id           INT IDENTITY(1,1) PRIMARY KEY,
      chantier_id  INT            NOT NULL,
      action_id    INT            NULL,
      outil_id     NVARCHAR(80)   NULL,
      filename     NVARCHAR(300)  NULL,
      mime_type    NVARCHAR(100)  NULL,
      data         NVARCHAR(MAX)  NOT NULL,
      created_at   DATETIME2      DEFAULT GETDATE()
    );
  `);

  // Une base creee avant les photos par outil n'a pas cette colonne :
  // la creation de table ne touche pas a l'existant, il faut l'ajouter.
  await p.request().query(`
    IF COL_LENGTH('photos', 'outil_id') IS NULL
      ALTER TABLE photos ADD outil_id NVARCHAR(80) NULL;
  `);

  // Supports SWM remplis : une ligne par couple (chantier, outil). On conserve
  // les reponses pour retrouver ce qui a ete fait et regenerer la trame.
  await p.request().query(`
    IF OBJECT_ID('supports', 'U') IS NULL
    CREATE TABLE supports (
      id           INT IDENTITY(1,1) PRIMARY KEY,
      chantier_id  INT            NOT NULL,
      outil_id     NVARCHAR(80)   NOT NULL,
      donnees      NVARCHAR(MAX)  NOT NULL,
      created_at   DATETIME2      DEFAULT GETDATE(),
      updated_at   DATETIME2      DEFAULT GETDATE()
    );
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'supports_chantier_outil')
      CREATE UNIQUE INDEX supports_chantier_outil ON supports (chantier_id, outil_id);
  `);

  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_actions_chantier')
      CREATE INDEX idx_actions_chantier ON actions(chantier_id);
  `);
  await p.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_photos_chantier')
      CREATE INDEX idx_photos_chantier ON photos(chantier_id);
  `);

  console.log('Base de donnees SQL Server initialisee ✅');
}

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Enveloppe un handler async : capture les erreurs pour repondre 500 proprement
// (Express ne capture pas seul les rejets de promesses).
const wrap = fn => (req, res) => fn(req, res).catch(err => {
  console.error(err);
  if (!res.headersSent) res.status(500).json({ error: err.message });
});

// Convertit un parametre d'URL en identifiant entier, ou null si invalide.
function asId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Trie une liste d'ids d'outils selon l'ordre des phases (Identification -> ... -> Standardisation).
function sortOutilsByPhase(outilIds) {
  if (!Array.isArray(outilIds)) return [];
  return [...outilIds].sort((a, b) => {
    const orderA = PHASES_BY_ID[TOOLS_BY_ID[a]?.phase]?.order ?? 99;
    const orderB = PHASES_BY_ID[TOOLS_BY_ID[b]?.phase]?.order ?? 99;
    return orderA - orderB;
  });
}

// Convertit une valeur en nombre fini, ou null si ce n'en est pas un.
function toNumberOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Verifie qu'au moins un outil de chaque phase obligatoire est choisi.
function missingRequiredPhases(outilIds) {
  const phasesPresentes = new Set(outilIds.map(id => TOOLS_BY_ID[id]?.phase).filter(Boolean));
  return PHASES.filter(p => p.required && !phasesPresentes.has(p.id));
}

async function chantierExists(id) {
  const p = await getPool();
  const r = await p.request().input('id', sql.Int, id)
    .query('SELECT 1 AS present FROM chantiers WHERE id = @id');
  return r.recordset.length > 0;
}

// Execute une fonction dans une transaction.
async function withTx(fn) {
  const p = await getPool();
  const tx = new sql.Transaction(p);
  await tx.begin();
  try {
    const resultat = await fn(tx);
    await tx.commit();
    return resultat;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function getChantierFull(id) {
  const p = await getPool();
  const r = await p.request().input('id', sql.Int, id)
    .query('SELECT * FROM chantiers WHERE id = @id');
  const chantier = r.recordset[0];
  if (!chantier) return null;
  chantier.equipe = JSON.parse(chantier.equipe || '[]');
  chantier.outils = JSON.parse(chantier.outils || '[]');
  chantier.quiz_reponses = chantier.quiz_reponses ? JSON.parse(chantier.quiz_reponses) : null;

  // Ordonne par id (l'ordre d'insertion) : GETDATE() est constant dans une
  // transaction, donc created_at ne distingue pas des lignes creees ensemble.
  chantier.actions = (await p.request().input('id', sql.Int, id)
    .query('SELECT * FROM actions WHERE chantier_id = @id ORDER BY id ASC')).recordset;
  chantier.indicateurs = (await p.request().input('id', sql.Int, id)
    .query('SELECT * FROM indicateurs WHERE chantier_id = @id ORDER BY id ASC')).recordset;

  const photos = (await p.request().input('id', sql.Int, id).query(
    'SELECT id, action_id, outil_id, filename, mime_type, data, created_at FROM photos WHERE chantier_id = @id ORDER BY id ASC'
  )).recordset;
  // Une photo appartient soit a une action, soit a un outil, soit au chantier lui-meme.
  chantier.photos = photos.filter(ph => ph.action_id == null && !ph.outil_id);
  chantier.actions.forEach(a => {
    a.photos = photos.filter(ph => ph.action_id === a.id);
  });
  chantier.photos_outils = {};
  photos.filter(ph => ph.action_id == null && ph.outil_id).forEach(ph => {
    (chantier.photos_outils[ph.outil_id] = chantier.photos_outils[ph.outil_id] || []).push(ph);
  });

  // Supports SWM remplis, indexes par outil.
  chantier.supports = {};
  (await p.request().input('id', sql.Int, id)
    .query('SELECT outil_id, donnees, updated_at FROM supports WHERE chantier_id = @id')
  ).recordset.forEach(s => {
    try {
      chantier.supports[s.outil_id] = { ...JSON.parse(s.donnees), updated_at: s.updated_at };
    } catch (err) {
      console.error(`Support illisible (chantier ${id}, outil ${s.outil_id}) :`, err.message);
    }
  });

  return chantier;
}

// Sonde de disponibilite : IIS et la supervision s'en servent pour savoir si
// l'application repond ET si sa base est joignable.
app.get('/health', async (req, res) => {
  try {
    const p = await getPool();
    await p.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'sqlserver' });
  } catch (err) {
    res.status(503).json({ status: 'error', database: 'unavailable', error: err.message });
  }
});

// ---------- Outils (bibliotheque Kaizen) ----------
// On signale au passage les outils dont la vraie trame SWM peut etre remplie
// automatiquement (lib/trameSwm.js reste la seule source de verite).
app.get('/api/tools', (req, res) => res.json(TOOLS.map(t => {
  if (!t.template) return t;
  return { ...t, template: { ...t.template, remplissable: trameSwm.trameDisponible(t.id) } };
})));
app.get('/api/phases', (req, res) => res.json(PHASES));

// Renvoie la vraie trame SWM (.pptx) deja remplie avec les reponses saisies.
app.post('/api/tools/:toolId/trame', wrap(async (req, res) => {
  const { toolId } = req.params;
  const tool = TOOLS_BY_ID[toolId];
  if (!tool || !trameSwm.trameDisponible(toolId)) {
    return res.status(404).json({ error: 'Aucune trame SWM remplissable pour cet outil' });
  }
  const { header, fields } = req.body || {};
  const { buffer, nonPlaces, lignesIgnorees, causesEnTrop, extension } =
    await trameSwm.remplir(toolId, header || {}, fields || {});
  const ext = extension || 'pptx';
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${toolId}-rempli.${ext}"`);
  // Signale au navigateur ce qui n'a pas pu etre reporte dans la trame.
  res.setHeader('X-Extension-Trame', ext);
  if (nonPlaces.length) res.setHeader('X-Champs-Non-Places', nonPlaces.join(','));
  if (lignesIgnorees) res.setHeader('X-Lignes-Ignorees', String(lignesIgnorees));
  if (causesEnTrop && causesEnTrop.length) res.setHeader('X-Causes-En-Trop', causesEnTrop.join(','));
  res.send(buffer);
}));

// ---------- Chat expert ----------
// Construit un instantane des chantiers de l'application, transmis au chat expert
// pour qu'il puisse repondre sur ce qui a deja ete fait (retour d'experience interne)
// et pas seulement sur la theorie Lean.
async function buildChantiersContext() {
  const p = await getPool();
  const chantiers = (await p.request().query(
    'SELECT id, titre, probleme, perimetre, pilote, objectif, outils, statut, date_debut, date_fin FROM chantiers ORDER BY id DESC'
  )).recordset;
  if (!chantiers.length) return null;

  // On charge les lignes liees en une fois : filtrer par liste d'identifiants
  // demanderait autant de parametres que de chantiers, sans rien y gagner.
  const actions = (await p.request().query(
    'SELECT chantier_id, description, responsable, echeance, statut FROM actions ORDER BY id ASC'
  )).recordset;
  const indicateurs = (await p.request().query(
    'SELECT chantier_id, nom, unite, valeur_avant, valeur_apres FROM indicateurs ORDER BY id ASC'
  )).recordset;
  const supports = (await p.request().query(
    'SELECT chantier_id, outil_id, donnees FROM supports'
  )).recordset;

  return chantiers.map(r => ({
    id: r.id,
    titre: r.titre,
    probleme: r.probleme || '',
    perimetre: r.perimetre || '',
    pilote: r.pilote || '',
    objectif: r.objectif || '',
    statut: r.statut,
    periode: [r.date_debut, r.date_fin].filter(Boolean).join(' -> '),
    outils: (JSON.parse(r.outils || '[]')).map(id => TOOLS_BY_ID[id]?.name).filter(Boolean),
    actions: actions.filter(a => a.chantier_id === r.id)
      .map(a => ({ description: a.description, responsable: a.responsable || '', echeance: a.echeance || '', statut: a.statut })),
    indicateurs: indicateurs.filter(i => i.chantier_id === r.id)
      .map(i => ({ nom: i.nom, unite: i.unite || '', avant: i.valeur_avant, apres: i.valeur_apres })),
    // Supports SWM remplis : le contenu de l'analyse, pas seulement son intitule.
    supports: supports.filter(s => s.chantier_id === r.id).map(s => {
      let champs = {};
      try { champs = (JSON.parse(s.donnees) || {}).fields || {}; } catch (err) { /* ignore */ }
      return { outil: TOOLS_BY_ID[s.outil_id]?.name || s.outil_id, champs };
    })
  }));
}

app.post('/api/chat', async (req, res) => {
  const { message, mode } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message requis' });
  }
  try {
    // Le contexte est facultatif : si la base est indisponible, le chat repond quand meme.
    const chantiers = await buildChantiersContext().catch(err => {
      console.error('Contexte chantiers indisponible pour le chat :', err.message);
      return null;
    });
    const result = await leanExpert.reply(message, mode === 'ai' ? 'ai' : 'local', chantiers);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chat/status', (req, res) => {
  res.json({ aiAvailable: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY) });
});

// ---------- Chantiers ----------
app.get('/api/chantiers', wrap(async (req, res) => {
  const p = await getPool();
  const rows = (await p.request()
    .query('SELECT * FROM chantiers ORDER BY created_at DESC, id DESC')).recordset;
  rows.forEach(r => {
    r.equipe = JSON.parse(r.equipe || '[]');
    r.outils = JSON.parse(r.outils || '[]');
  });
  res.json(rows);
}));

app.get('/api/chantiers/:id', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Non trouve' });
  const chantier = await getChantierFull(id);
  if (!chantier) return res.status(404).json({ error: 'Non trouve' });
  res.json(chantier);
}));

app.post('/api/chantiers', wrap(async (req, res) => {
  const {
    titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin,
    statut, eligible_kaizen, quiz_reponses
  } = req.body;
  if (!titre) return res.status(400).json({ error: 'titre requis' });
  if (equipe !== undefined && !Array.isArray(equipe)) return res.status(400).json({ error: 'equipe doit etre une liste' });
  if (outils !== undefined && !Array.isArray(outils)) return res.status(400).json({ error: 'outils doit etre une liste' });

  const outilsTries = sortOutilsByPhase(outils || []);
  // Un chantier "a traiter" sans aucun outil est un irritant brut, pas encore
  // qualifie : on ne bloque que si des outils sont deja choisis mais couvrent mal les 3 phases requises.
  if (outilsTries.length) {
    const manquantes = missingRequiredPhases(outilsTries);
    if (manquantes.length) {
      return res.status(400).json({ error: `Choisis au moins un outil de : ${manquantes.map(ph => ph.label).join(', ')}` });
    }
  }

  const chantierId = await withTx(async (tx) => {
    const insert = await new sql.Request(tx)
      .input('titre', sql.NVarChar(500), titre)
      .input('probleme', sql.NVarChar(sql.MAX), probleme || '')
      .input('perimetre', sql.NVarChar(500), perimetre || '')
      .input('pilote', sql.NVarChar(200), pilote || '')
      .input('equipe', sql.NVarChar(sql.MAX), JSON.stringify(equipe || []))
      .input('objectif', sql.NVarChar(sql.MAX), objectif || '')
      .input('outils', sql.NVarChar(sql.MAX), JSON.stringify(outilsTries))
      .input('date_debut', sql.NVarChar(10), date_debut || '')
      .input('date_fin', sql.NVarChar(10), date_fin || '')
      .input('statut', sql.NVarChar(20), statut || 'a_traiter')
      .input('eligible', sql.Int, eligible_kaizen === undefined || eligible_kaizen === null ? null : (eligible_kaizen ? 1 : 0))
      .input('quiz', sql.NVarChar(sql.MAX), quiz_reponses ? JSON.stringify(quiz_reponses) : null)
      .query(`
        INSERT INTO chantiers (titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin, statut, eligible_kaizen, quiz_reponses)
        OUTPUT INSERTED.id
        VALUES (@titre, @probleme, @perimetre, @pilote, @equipe, @objectif, @outils, @date_debut, @date_fin, @statut, @eligible, @quiz)
      `);
    const newId = insert.recordset[0].id;

    // Pre-remplit le plan d'action avec une action par outil, dans l'ordre des phases.
    for (const outilId of outilsTries) {
      const tool = TOOLS_BY_ID[outilId];
      if (!tool) continue;
      await new sql.Request(tx)
        .input('cid', sql.Int, newId)
        .input('desc', sql.NVarChar(sql.MAX), `Realiser : ${tool.name}`)
        .query(`INSERT INTO actions (chantier_id, description, responsable, echeance, statut)
                VALUES (@cid, @desc, '', '', 'a_faire')`);
    }
    return newId;
  });

  res.json(await getChantierFull(chantierId));
}));

app.put('/api/chantiers/:id', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Non trouve' });
  const {
    titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin, statut,
    eligible_kaizen, quiz_reponses
  } = req.body;
  const p = await getPool();
  const existing = (await p.request().input('id', sql.Int, id)
    .query('SELECT eligible_kaizen, quiz_reponses FROM chantiers WHERE id = @id')).recordset[0];
  if (!existing) return res.status(404).json({ error: 'Non trouve' });
  if (equipe !== undefined && !Array.isArray(equipe)) return res.status(400).json({ error: 'equipe doit etre une liste' });
  if (outils !== undefined && !Array.isArray(outils)) return res.status(400).json({ error: 'outils doit etre une liste' });

  // eligible_kaizen / quiz_reponses ne sont fournis que par le flux questionnaire :
  // une simple edition du formulaire ne doit pas effacer une reponse deja enregistree.
  const nextEligible = eligible_kaizen === undefined ? existing.eligible_kaizen : (eligible_kaizen ? 1 : 0);
  const nextQuiz = quiz_reponses === undefined ? existing.quiz_reponses : JSON.stringify(quiz_reponses);

  await p.request()
    .input('titre', sql.NVarChar(500), titre)
    .input('probleme', sql.NVarChar(sql.MAX), probleme || '')
    .input('perimetre', sql.NVarChar(500), perimetre || '')
    .input('pilote', sql.NVarChar(200), pilote || '')
    .input('equipe', sql.NVarChar(sql.MAX), JSON.stringify(equipe || []))
    .input('objectif', sql.NVarChar(sql.MAX), objectif || '')
    .input('outils', sql.NVarChar(sql.MAX), JSON.stringify(sortOutilsByPhase(outils || [])))
    .input('date_debut', sql.NVarChar(10), date_debut || '')
    .input('date_fin', sql.NVarChar(10), date_fin || '')
    .input('statut', sql.NVarChar(20), statut || 'en_cours')
    .input('eligible', sql.Int, nextEligible)
    .input('quiz', sql.NVarChar(sql.MAX), nextQuiz)
    .input('id', sql.Int, id)
    .query(`
      UPDATE chantiers SET titre = @titre, probleme = @probleme, perimetre = @perimetre,
        pilote = @pilote, equipe = @equipe, objectif = @objectif, outils = @outils,
        date_debut = @date_debut, date_fin = @date_fin, statut = @statut,
        eligible_kaizen = @eligible, quiz_reponses = @quiz
      WHERE id = @id
    `);
  res.json(await getChantierFull(id));
}));

// ---------- Tableau de bord ----------
app.get('/api/dashboard', wrap(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const p = await getPool();

  const parChantierStatut = (await p.request()
    .query('SELECT statut, COUNT(*) AS n FROM chantiers GROUP BY statut')).recordset;

  const actionsEnRetard = (await p.request().input('today', sql.NVarChar(10), today).query(`
    SELECT a.id, a.description, a.responsable, a.echeance, a.chantier_id, c.titre AS chantier_titre
    FROM actions a
    JOIN chantiers c ON c.id = a.chantier_id
    WHERE a.statut <> 'fait' AND a.echeance <> '' AND a.echeance < @today
    ORDER BY a.echeance ASC
  `)).recordset;

  const indicateurs = (await p.request().query(`
    SELECT valeur_avant, valeur_apres FROM indicateurs
    WHERE valeur_avant IS NOT NULL AND valeur_apres IS NOT NULL AND valeur_avant <> 0
  `)).recordset;

  const gains = indicateurs.map(i => ((i.valeur_avant - i.valeur_apres) / i.valeur_avant) * 100);
  const gainMoyen = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;

  const totalActions = (await p.request().query('SELECT COUNT(*) AS n FROM actions')).recordset[0].n;
  const actionsFaites = (await p.request()
    .query("SELECT COUNT(*) AS n FROM actions WHERE statut = 'fait'")).recordset[0].n;

  res.json({
    chantiersParStatut: Object.fromEntries(parChantierStatut.map(r => [r.statut, r.n])),
    totalChantiers: parChantierStatut.reduce((a, r) => a + r.n, 0),
    actionsEnRetard,
    totalActions,
    actionsFaites,
    gainMoyen,
    indicateursSuivis: gains.length
  });
}));

app.delete('/api/chantiers/:id', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Non trouve' });
  await withTx(async (tx) => {
    // Ordre impose par les dependances : les lignes liees avant le chantier.
    for (const table of ['photos', 'actions', 'indicateurs', 'supports']) {
      await new sql.Request(tx).input('id', sql.Int, id)
        .query(`DELETE FROM ${table} WHERE chantier_id = @id`);
    }
    await new sql.Request(tx).input('id', sql.Int, id)
      .query('DELETE FROM chantiers WHERE id = @id');
  });
  res.json({ success: true });
}));

// ---------- Actions (plan d'action) ----------
app.post('/api/chantiers/:id/actions', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null || !(await chantierExists(id))) return res.status(404).json({ error: 'Chantier non trouve' });
  const { description, responsable, echeance, statut } = req.body;
  if (!description) return res.status(400).json({ error: 'description requise' });
  const p = await getPool();
  await p.request()
    .input('cid', sql.Int, id)
    .input('desc', sql.NVarChar(sql.MAX), description)
    .input('resp', sql.NVarChar(200), responsable || '')
    .input('ech', sql.NVarChar(10), echeance || '')
    .input('statut', sql.NVarChar(20), statut || 'a_faire')
    .query(`INSERT INTO actions (chantier_id, description, responsable, echeance, statut)
            VALUES (@cid, @desc, @resp, @ech, @statut)`);
  res.json(await getChantierFull(id));
}));

app.put('/api/chantiers/:id/actions/:actionId', wrap(async (req, res) => {
  const id = asId(req.params.id), actionId = asId(req.params.actionId);
  if (id === null || actionId === null) return res.status(404).json({ error: 'Non trouve' });
  const { description, responsable, echeance, statut } = req.body;
  const p = await getPool();
  await p.request()
    .input('desc', sql.NVarChar(sql.MAX), description)
    .input('resp', sql.NVarChar(200), responsable || '')
    .input('ech', sql.NVarChar(10), echeance || '')
    .input('statut', sql.NVarChar(20), statut || 'a_faire')
    .input('aid', sql.Int, actionId)
    .input('cid', sql.Int, id)
    .query(`UPDATE actions SET description = @desc, responsable = @resp, echeance = @ech,
            statut = @statut WHERE id = @aid AND chantier_id = @cid`);
  res.json(await getChantierFull(id));
}));

app.delete('/api/chantiers/:id/actions/:actionId', wrap(async (req, res) => {
  const id = asId(req.params.id), actionId = asId(req.params.actionId);
  if (id === null || actionId === null) return res.status(404).json({ error: 'Non trouve' });
  const p = await getPool();
  await p.request().input('aid', sql.Int, actionId).input('cid', sql.Int, id)
    .query('DELETE FROM actions WHERE id = @aid AND chantier_id = @cid');
  res.json(await getChantierFull(id));
}));

// ---------- Indicateurs (avant / apres) ----------
app.post('/api/chantiers/:id/indicateurs', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null || !(await chantierExists(id))) return res.status(404).json({ error: 'Chantier non trouve' });
  const { nom, unite, valeur_avant, valeur_apres } = req.body;
  if (!nom) return res.status(400).json({ error: 'nom requis' });
  const p = await getPool();
  await p.request()
    .input('cid', sql.Int, id)
    .input('nom', sql.NVarChar(300), nom)
    .input('unite', sql.NVarChar(50), unite || '')
    .input('avant', sql.Float, toNumberOrNull(valeur_avant))
    .input('apres', sql.Float, toNumberOrNull(valeur_apres))
    .query(`INSERT INTO indicateurs (chantier_id, nom, unite, valeur_avant, valeur_apres)
            VALUES (@cid, @nom, @unite, @avant, @apres)`);
  res.json(await getChantierFull(id));
}));

app.put('/api/chantiers/:id/indicateurs/:indicId', wrap(async (req, res) => {
  const id = asId(req.params.id), indicId = asId(req.params.indicId);
  if (id === null || indicId === null) return res.status(404).json({ error: 'Non trouve' });
  const { nom, unite, valeur_avant, valeur_apres } = req.body;
  const p = await getPool();
  await p.request()
    .input('nom', sql.NVarChar(300), nom)
    .input('unite', sql.NVarChar(50), unite || '')
    .input('avant', sql.Float, toNumberOrNull(valeur_avant))
    .input('apres', sql.Float, toNumberOrNull(valeur_apres))
    .input('iid', sql.Int, indicId)
    .input('cid', sql.Int, id)
    .query(`UPDATE indicateurs SET nom = @nom, unite = @unite, valeur_avant = @avant,
            valeur_apres = @apres WHERE id = @iid AND chantier_id = @cid`);
  res.json(await getChantierFull(id));
}));

app.delete('/api/chantiers/:id/indicateurs/:indicId', wrap(async (req, res) => {
  const id = asId(req.params.id), indicId = asId(req.params.indicId);
  if (id === null || indicId === null) return res.status(404).json({ error: 'Non trouve' });
  const p = await getPool();
  await p.request().input('iid', sql.Int, indicId).input('cid', sql.Int, id)
    .query('DELETE FROM indicateurs WHERE id = @iid AND chantier_id = @cid');
  res.json(await getChantierFull(id));
}));

// ---------- Supports SWM remplis ----------
// Enregistre (ou met a jour) les reponses saisies pour un outil du chantier, afin
// de retrouver ce qui a ete fait et de pouvoir regenerer la trame a l'identique.
app.put('/api/chantiers/:id/supports/:outilId', wrap(async (req, res) => {
  const id = asId(req.params.id);
  const { outilId } = req.params;
  if (id === null || !(await chantierExists(id))) return res.status(404).json({ error: 'Chantier non trouve' });
  if (!TOOLS_BY_ID[outilId]) return res.status(404).json({ error: 'Outil inconnu' });

  const { header, fields } = req.body || {};
  const donnees = JSON.stringify({ header: header || {}, fields: fields || {} });
  const p = await getPool();
  // MERGE tient lieu du « INSERT ... ON CONFLICT DO UPDATE » de PostgreSQL.
  await p.request()
    .input('cid', sql.Int, id)
    .input('oid', sql.NVarChar(80), outilId)
    .input('donnees', sql.NVarChar(sql.MAX), donnees)
    .query(`
      MERGE supports AS cible
      USING (SELECT @cid AS chantier_id, @oid AS outil_id) AS source
        ON cible.chantier_id = source.chantier_id AND cible.outil_id = source.outil_id
      WHEN MATCHED THEN
        UPDATE SET donnees = @donnees, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (chantier_id, outil_id, donnees) VALUES (@cid, @oid, @donnees);
    `);
  res.json(await getChantierFull(id));
}));

app.delete('/api/chantiers/:id/supports/:outilId', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null) return res.status(404).json({ error: 'Non trouve' });
  const p = await getPool();
  await p.request().input('cid', sql.Int, id)
    .input('oid', sql.NVarChar(80), req.params.outilId)
    .query('DELETE FROM supports WHERE chantier_id = @cid AND outil_id = @oid');
  res.json(await getChantierFull(id));
}));

// ---------- Photos (fiche chantier, action specifique ou outil du chantier) ----------
app.post('/api/chantiers/:id/photos', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null || !(await chantierExists(id))) return res.status(404).json({ error: 'Chantier non trouve' });
  const { filename, mime_type, data, action_id, outil_id } = req.body;
  if (!data) return res.status(400).json({ error: 'data (base64) requise' });
  // On n'accepte qu'un identifiant d'outil connu du catalogue.
  const outilId = outil_id && TOOLS_BY_ID[outil_id] ? outil_id : null;
  const p = await getPool();
  await p.request()
    .input('cid', sql.Int, id)
    .input('aid', sql.Int, asId(action_id))
    .input('oid', sql.NVarChar(80), outilId)
    .input('nom', sql.NVarChar(300), filename || '')
    .input('mime', sql.NVarChar(100), mime_type || '')
    .input('data', sql.NVarChar(sql.MAX), data)
    .query(`INSERT INTO photos (chantier_id, action_id, outil_id, filename, mime_type, data)
            VALUES (@cid, @aid, @oid, @nom, @mime, @data)`);
  res.json(await getChantierFull(id));
}));

app.delete('/api/chantiers/:id/photos/:photoId', wrap(async (req, res) => {
  const id = asId(req.params.id), photoId = asId(req.params.photoId);
  if (id === null || photoId === null) return res.status(404).json({ error: 'Non trouve' });
  const p = await getPool();
  await p.request().input('pid', sql.Int, photoId).input('cid', sql.Int, id)
    .query('DELETE FROM photos WHERE id = @pid AND chantier_id = @cid');
  res.json(await getChantierFull(id));
}));

// ── Demarrage ───────────────────────────────────────────────
// La trace de configuration precede la connexion : si celle-ci echoue,
// on voit dans le journal quel fichier a ete lu et vers quel serveur on
// a tente de se connecter. Le mot de passe n'est jamais affiche.
if (envCharge) {
  console.log(`Configuration lue dans ${envCharge.fichier} (${envCharge.cles.length} variable(s) : ${envCharge.cles.join(', ')})`);
} else {
  console.log(`Aucun fichier .env trouve (${FICHIER_ENV}) — configuration prise dans l'environnement.`);
}
console.log(`Cible SQL Server : ${dbConfig.server}:${dbConfig.port} · base ${dbConfig.database} · utilisateur ${dbConfig.user}`);
console.log(`Point d'ecoute : ${PORT}`);

if (dbConfig.server === 'VOTRE_SERVEUR' || dbConfig.password === 'VOTRE_MOT_DE_PASSE') {
  console.error(`Configuration absente : renseignez DB_SERVER, DB_NAME, DB_USER et DB_PASSWORD dans ${FICHIER_ENV}`);
  process.exit(1);
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Kaizen Toolbox (SQL Server) → http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Erreur connexion SQL Server:', err.message);
  process.exit(1);
});
