const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const { TOOLS, TOOLS_BY_ID, PHASES, PHASES_BY_ID } = require('./data/tools.js');
const leanExpert = require('./lib/leanExpert.js');
const trameSwm = require('./lib/trameSwm.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Base de donnees PostgreSQL persistante (ex: Neon). La chaine de connexion vient
// de la variable d'environnement DATABASE_URL (jamais en dur dans le code).
// Contrairement au SQLite du disque ephemere, les donnees survivent aux redemarrages.
if (!process.env.DATABASE_URL) {
  console.error('\n  ATTENTION : variable DATABASE_URL manquante.');
  console.error('  Ajoute la chaine de connexion PostgreSQL (Neon) dans les variables');
  console.error('  d\'environnement du service. L\'application demarre mais l\'API restera');
  console.error('  en erreur tant que la base n\'est pas configuree.\n');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5
});

// Schema idempotent (cree les tables si elles n'existent pas). En PostgreSQL :
// SERIAL = auto-increment, TIMESTAMPTZ = date/heure, DOUBLE PRECISION = REAL.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS chantiers (
    id              SERIAL PRIMARY KEY,
    titre           TEXT NOT NULL,
    probleme        TEXT,
    perimetre       TEXT,
    pilote          TEXT,
    equipe          TEXT,
    objectif        TEXT,
    outils          TEXT,
    date_debut      TEXT,
    date_fin        TEXT,
    statut          TEXT DEFAULT 'a_traiter',
    eligible_kaizen INTEGER,
    quiz_reponses   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS actions (
    id              SERIAL PRIMARY KEY,
    chantier_id     INTEGER NOT NULL REFERENCES chantiers(id),
    description     TEXT NOT NULL,
    responsable     TEXT,
    echeance        TEXT,
    statut          TEXT DEFAULT 'a_faire',
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS indicateurs (
    id              SERIAL PRIMARY KEY,
    chantier_id     INTEGER NOT NULL REFERENCES chantiers(id),
    nom             TEXT NOT NULL,
    unite           TEXT,
    valeur_avant    DOUBLE PRECISION,
    valeur_apres    DOUBLE PRECISION
  );

  CREATE TABLE IF NOT EXISTS photos (
    id              SERIAL PRIMARY KEY,
    chantier_id     INTEGER NOT NULL REFERENCES chantiers(id),
    action_id       INTEGER,
    outil_id        TEXT,
    filename        TEXT,
    mime_type       TEXT,
    data            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
  );

  -- Ajout retroactif pour les bases creees avant les photos par outil.
  ALTER TABLE photos ADD COLUMN IF NOT EXISTS outil_id TEXT;
`;

async function initDb() {
  await pool.query(SCHEMA);
  console.log('  Base PostgreSQL prete.');
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

// Verifie qu'au moins un outil de chaque phase obligatoire (Identification, Analyse, Solution) est choisi.
function missingRequiredPhases(outilIds) {
  const phasesPresentes = new Set(outilIds.map(id => TOOLS_BY_ID[id]?.phase).filter(Boolean));
  return PHASES.filter(p => p.required && !phasesPresentes.has(p.id));
}

async function chantierExists(id) {
  const { rows } = await pool.query('SELECT 1 FROM chantiers WHERE id = $1', [id]);
  return rows.length > 0;
}

// Execute une fonction dans une transaction (client dedie).
async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getChantierFull(id) {
  const { rows } = await pool.query('SELECT * FROM chantiers WHERE id = $1', [id]);
  const chantier = rows[0];
  if (!chantier) return null;
  chantier.equipe = JSON.parse(chantier.equipe || '[]');
  chantier.outils = JSON.parse(chantier.outils || '[]');
  chantier.quiz_reponses = chantier.quiz_reponses ? JSON.parse(chantier.quiz_reponses) : null;

  // Ordonne par id (l'ordre d'insertion) : NOW() est constant dans une transaction,
  // donc created_at ne distingue pas des lignes creees ensemble.
  chantier.actions = (await pool.query('SELECT * FROM actions WHERE chantier_id = $1 ORDER BY id ASC', [id])).rows;
  chantier.indicateurs = (await pool.query('SELECT * FROM indicateurs WHERE chantier_id = $1 ORDER BY id ASC', [id])).rows;

  const photos = (await pool.query(
    'SELECT id, action_id, outil_id, filename, mime_type, data, created_at FROM photos WHERE chantier_id = $1 ORDER BY id ASC', [id]
  )).rows;
  // Une photo appartient soit a une action, soit a un outil, soit au chantier lui-meme.
  chantier.photos = photos.filter(p => p.action_id == null && !p.outil_id);
  chantier.actions.forEach(a => {
    a.photos = photos.filter(p => p.action_id === a.id);
  });
  chantier.photos_outils = {};
  photos.filter(p => p.action_id == null && p.outil_id).forEach(p => {
    (chantier.photos_outils[p.outil_id] = chantier.photos_outils[p.outil_id] || []).push(p);
  });

  return chantier;
}

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
  const buffer = await trameSwm.remplir(toolId, header || {}, fields || {});
  const nomFichier = `${toolId}-rempli.pptx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  res.send(buffer);
}));

// ---------- Chat expert ----------
// Construit un instantane des chantiers de l'application, transmis au chat expert
// pour qu'il puisse repondre sur ce qui a deja ete fait (retour d'experience interne)
// et pas seulement sur la theorie Lean.
async function buildChantiersContext() {
  const { rows } = await pool.query(
    'SELECT id, titre, probleme, perimetre, pilote, objectif, outils, statut, date_debut, date_fin FROM chantiers ORDER BY id DESC'
  );
  if (!rows.length) return null;

  const ids = rows.map(r => r.id);
  const actions = (await pool.query(
    'SELECT chantier_id, description, responsable, echeance, statut FROM actions WHERE chantier_id = ANY($1) ORDER BY id ASC', [ids]
  )).rows;
  const indicateurs = (await pool.query(
    'SELECT chantier_id, nom, unite, valeur_avant, valeur_apres FROM indicateurs WHERE chantier_id = ANY($1) ORDER BY id ASC', [ids]
  )).rows;

  return rows.map(r => ({
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
      .map(i => ({ nom: i.nom, unite: i.unite || '', avant: i.valeur_avant, apres: i.valeur_apres }))
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
  const { rows } = await pool.query('SELECT * FROM chantiers ORDER BY created_at DESC, id DESC');
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
      return res.status(400).json({ error: `Choisis au moins un outil de : ${manquantes.map(p => p.label).join(', ')}` });
    }
  }

  const chantierId = await withTx(async (client) => {
    const insert = await client.query(`
      INSERT INTO chantiers (titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin, statut, eligible_kaizen, quiz_reponses)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      titre, probleme || '', perimetre || '', pilote || '',
      JSON.stringify(equipe || []), objectif || '', JSON.stringify(outilsTries),
      date_debut || '', date_fin || '', statut || 'a_traiter',
      eligible_kaizen === undefined || eligible_kaizen === null ? null : (eligible_kaizen ? 1 : 0),
      quiz_reponses ? JSON.stringify(quiz_reponses) : null
    ]);
    const newId = insert.rows[0].id;

    // Pre-remplit le plan d'action avec une action par outil, dans l'ordre des phases.
    for (const outilId of outilsTries) {
      const tool = TOOLS_BY_ID[outilId];
      if (!tool) continue;
      await client.query(
        `INSERT INTO actions (chantier_id, description, responsable, echeance, statut) VALUES ($1, $2, '', '', 'a_faire')`,
        [newId, `Realiser : ${tool.name}`]
      );
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
  const existingRes = await pool.query('SELECT eligible_kaizen, quiz_reponses FROM chantiers WHERE id = $1', [id]);
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: 'Non trouve' });
  if (equipe !== undefined && !Array.isArray(equipe)) return res.status(400).json({ error: 'equipe doit etre une liste' });
  if (outils !== undefined && !Array.isArray(outils)) return res.status(400).json({ error: 'outils doit etre une liste' });

  // eligible_kaizen / quiz_reponses ne sont fournis que par le flux questionnaire :
  // une simple edition du formulaire ne doit pas effacer une reponse deja enregistree.
  const nextEligible = eligible_kaizen === undefined ? existing.eligible_kaizen : (eligible_kaizen ? 1 : 0);
  const nextQuiz = quiz_reponses === undefined ? existing.quiz_reponses : JSON.stringify(quiz_reponses);

  await pool.query(`
    UPDATE chantiers SET titre = $1, probleme = $2, perimetre = $3, pilote = $4, equipe = $5,
      objectif = $6, outils = $7, date_debut = $8, date_fin = $9, statut = $10, eligible_kaizen = $11, quiz_reponses = $12
    WHERE id = $13
  `, [
    titre, probleme || '', perimetre || '', pilote || '',
    JSON.stringify(equipe || []), objectif || '', JSON.stringify(sortOutilsByPhase(outils || [])),
    date_debut || '', date_fin || '', statut || 'en_cours', nextEligible, nextQuiz, id
  ]);
  res.json(await getChantierFull(id));
}));

// ---------- Tableau de bord ----------
app.get('/api/dashboard', wrap(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const parChantierStatut = (await pool.query(
    `SELECT statut, COUNT(*)::int as n FROM chantiers GROUP BY statut`
  )).rows;

  const actionsEnRetard = (await pool.query(`
    SELECT a.id, a.description, a.responsable, a.echeance, a.chantier_id, c.titre as chantier_titre
    FROM actions a
    JOIN chantiers c ON c.id = a.chantier_id
    WHERE a.statut <> 'fait' AND a.echeance <> '' AND a.echeance < $1
    ORDER BY a.echeance ASC
  `, [today])).rows;

  const indicateurs = (await pool.query(`
    SELECT valeur_avant, valeur_apres FROM indicateurs
    WHERE valeur_avant IS NOT NULL AND valeur_apres IS NOT NULL AND valeur_avant <> 0
  `)).rows;

  const gains = indicateurs.map(i => ((i.valeur_avant - i.valeur_apres) / i.valeur_avant) * 100);
  const gainMoyen = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;

  const totalActions = (await pool.query(`SELECT COUNT(*)::int as n FROM actions`)).rows[0].n;
  const actionsFaites = (await pool.query(`SELECT COUNT(*)::int as n FROM actions WHERE statut = 'fait'`)).rows[0].n;

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
  await withTx(async (client) => {
    // Ordre impose par les cles etrangeres : photos/actions/indicateurs avant le chantier.
    await client.query('DELETE FROM photos WHERE chantier_id = $1', [id]);
    await client.query('DELETE FROM actions WHERE chantier_id = $1', [id]);
    await client.query('DELETE FROM indicateurs WHERE chantier_id = $1', [id]);
    await client.query('DELETE FROM chantiers WHERE id = $1', [id]);
  });
  res.json({ success: true });
}));

// ---------- Actions (plan d'action) ----------
app.post('/api/chantiers/:id/actions', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null || !(await chantierExists(id))) return res.status(404).json({ error: 'Chantier non trouve' });
  const { description, responsable, echeance, statut } = req.body;
  if (!description) return res.status(400).json({ error: 'description requise' });
  await pool.query(
    `INSERT INTO actions (chantier_id, description, responsable, echeance, statut) VALUES ($1, $2, $3, $4, $5)`,
    [id, description, responsable || '', echeance || '', statut || 'a_faire']
  );
  res.json(await getChantierFull(id));
}));

app.put('/api/chantiers/:id/actions/:actionId', wrap(async (req, res) => {
  const id = asId(req.params.id), actionId = asId(req.params.actionId);
  if (id === null || actionId === null) return res.status(404).json({ error: 'Non trouve' });
  const { description, responsable, echeance, statut } = req.body;
  await pool.query(
    `UPDATE actions SET description = $1, responsable = $2, echeance = $3, statut = $4 WHERE id = $5 AND chantier_id = $6`,
    [description, responsable || '', echeance || '', statut || 'a_faire', actionId, id]
  );
  res.json(await getChantierFull(id));
}));

app.delete('/api/chantiers/:id/actions/:actionId', wrap(async (req, res) => {
  const id = asId(req.params.id), actionId = asId(req.params.actionId);
  if (id === null || actionId === null) return res.status(404).json({ error: 'Non trouve' });
  await pool.query('DELETE FROM actions WHERE id = $1 AND chantier_id = $2', [actionId, id]);
  res.json(await getChantierFull(id));
}));

// ---------- Indicateurs (avant / apres) ----------
app.post('/api/chantiers/:id/indicateurs', wrap(async (req, res) => {
  const id = asId(req.params.id);
  if (id === null || !(await chantierExists(id))) return res.status(404).json({ error: 'Chantier non trouve' });
  const { nom, unite, valeur_avant, valeur_apres } = req.body;
  if (!nom) return res.status(400).json({ error: 'nom requis' });
  await pool.query(
    `INSERT INTO indicateurs (chantier_id, nom, unite, valeur_avant, valeur_apres) VALUES ($1, $2, $3, $4, $5)`,
    [id, nom, unite || '', toNumberOrNull(valeur_avant), toNumberOrNull(valeur_apres)]
  );
  res.json(await getChantierFull(id));
}));

app.put('/api/chantiers/:id/indicateurs/:indicId', wrap(async (req, res) => {
  const id = asId(req.params.id), indicId = asId(req.params.indicId);
  if (id === null || indicId === null) return res.status(404).json({ error: 'Non trouve' });
  const { nom, unite, valeur_avant, valeur_apres } = req.body;
  await pool.query(
    `UPDATE indicateurs SET nom = $1, unite = $2, valeur_avant = $3, valeur_apres = $4 WHERE id = $5 AND chantier_id = $6`,
    [nom, unite || '', toNumberOrNull(valeur_avant), toNumberOrNull(valeur_apres), indicId, id]
  );
  res.json(await getChantierFull(id));
}));

app.delete('/api/chantiers/:id/indicateurs/:indicId', wrap(async (req, res) => {
  const id = asId(req.params.id), indicId = asId(req.params.indicId);
  if (id === null || indicId === null) return res.status(404).json({ error: 'Non trouve' });
  await pool.query('DELETE FROM indicateurs WHERE id = $1 AND chantier_id = $2', [indicId, id]);
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
  await pool.query(
    `INSERT INTO photos (chantier_id, action_id, outil_id, filename, mime_type, data) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, asId(action_id), outilId, filename || '', mime_type || '', data]
  );
  res.json(await getChantierFull(id));
}));

app.delete('/api/chantiers/:id/photos/:photoId', wrap(async (req, res) => {
  const id = asId(req.params.id), photoId = asId(req.params.photoId);
  if (id === null || photoId === null) return res.status(404).json({ error: 'Non trouve' });
  await pool.query('DELETE FROM photos WHERE id = $1 AND chantier_id = $2', [photoId, id]);
  res.json(await getChantierFull(id));
}));

// Demarre le serveur apres l'initialisation de la base.
initDb()
  .catch(err => console.error('  Echec init base (l\'API restera en erreur tant que DATABASE_URL n\'est pas valide) :', err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`\n  Kaizen app demarree -> http://localhost:${PORT}\n`));
  });
