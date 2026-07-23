const express = require('express');
const path = require('path');
const { Database } = require('node-sqlite3-wasm');
const { TOOLS, TOOLS_BY_ID, PHASES, PHASES_BY_ID } = require('./data/tools.js');
const leanExpert = require('./lib/leanExpert.js');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kaizen.db');
const db = new Database(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS chantiers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS actions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chantier_id     INTEGER NOT NULL,
    description     TEXT NOT NULL,
    responsable     TEXT,
    echeance        TEXT,
    statut          TEXT DEFAULT 'a_faire',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chantier_id) REFERENCES chantiers(id)
  );

  CREATE TABLE IF NOT EXISTS indicateurs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chantier_id     INTEGER NOT NULL,
    nom             TEXT NOT NULL,
    unite           TEXT,
    valeur_avant    REAL,
    valeur_apres    REAL,
    FOREIGN KEY (chantier_id) REFERENCES chantiers(id)
  );

  CREATE TABLE IF NOT EXISTS photos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chantier_id     INTEGER NOT NULL,
    action_id       INTEGER,
    filename        TEXT,
    mime_type       TEXT,
    data            TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chantier_id) REFERENCES chantiers(id)
  );
`);

// Ajoute les colonnes du questionnaire d'eligibilite aux bases deja existantes
// (les nouvelles installations les ont deja via le CREATE TABLE ci-dessus).
['eligible_kaizen', 'quiz_reponses'].forEach(col => {
  try {
    db.exec(`ALTER TABLE chantiers ADD COLUMN ${col} ${col === 'eligible_kaizen' ? 'INTEGER' : 'TEXT'}`);
  } catch (err) {
    // colonne deja presente
  }
});

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Trie une liste d'ids d'outils selon l'ordre des phases (Identification -> ... -> Standardisation),
// pour que les badges affiches et le plan d'action genere suivent toujours cet ordre chronologique.
function sortOutilsByPhase(outilIds) {
  return [...outilIds].sort((a, b) => {
    const orderA = PHASES_BY_ID[TOOLS_BY_ID[a]?.phase]?.order ?? 99;
    const orderB = PHASES_BY_ID[TOOLS_BY_ID[b]?.phase]?.order ?? 99;
    return orderA - orderB;
  });
}

// Verifie qu'au moins un outil de chaque phase obligatoire (Identification, Analyse, Solution) est choisi.
function missingRequiredPhases(outilIds) {
  const phasesPresentes = new Set(outilIds.map(id => TOOLS_BY_ID[id]?.phase).filter(Boolean));
  return PHASES.filter(p => p.required && !phasesPresentes.has(p.id));
}

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function getChantierFull(id) {
  const chantier = db.prepare('SELECT * FROM chantiers WHERE id = ?').get([id]);
  if (!chantier) return null;
  chantier.equipe = JSON.parse(chantier.equipe || '[]');
  chantier.outils = JSON.parse(chantier.outils || '[]');
  chantier.quiz_reponses = chantier.quiz_reponses ? JSON.parse(chantier.quiz_reponses) : null;
  chantier.actions = db.prepare('SELECT * FROM actions WHERE chantier_id = ? ORDER BY created_at ASC').all([id]);
  chantier.indicateurs = db.prepare('SELECT * FROM indicateurs WHERE chantier_id = ? ORDER BY id ASC').all([id]);

  const photos = db.prepare('SELECT id, action_id, filename, mime_type, data, created_at FROM photos WHERE chantier_id = ? ORDER BY created_at ASC').all([id]);
  chantier.photos = photos.filter(p => p.action_id == null);
  chantier.actions.forEach(a => {
    a.photos = photos.filter(p => p.action_id === a.id);
  });

  return chantier;
}

// ---------- Outils (bibliotheque Kaizen) ----------
app.get('/api/tools', (req, res) => {
  res.json(TOOLS);
});

app.get('/api/phases', (req, res) => {
  res.json(PHASES);
});

// ---------- Chat expert ----------
app.post('/api/chat', async (req, res) => {
  const { message, mode } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message requis' });
  }
  try {
    const result = await leanExpert.reply(message, mode === 'ai' ? 'ai' : 'local');
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
app.get('/api/chantiers', (req, res) => {
  const rows = db.prepare('SELECT * FROM chantiers ORDER BY created_at DESC').all();
  rows.forEach(r => {
    r.equipe = JSON.parse(r.equipe || '[]');
    r.outils = JSON.parse(r.outils || '[]');
  });
  res.json(rows);
});

app.get('/api/chantiers/:id', (req, res) => {
  const chantier = getChantierFull(req.params.id);
  if (!chantier) return res.status(404).json({ error: 'Non trouve' });
  res.json(chantier);
});

app.post('/api/chantiers', (req, res) => {
  const {
    titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin,
    statut, eligible_kaizen, quiz_reponses
  } = req.body;
  if (!titre) return res.status(400).json({ error: 'titre requis' });

  const outilsTries = sortOutilsByPhase(outils || []);
  // Un chantier "a traiter" sans aucun outil est un irritant brut, pas encore
  // qualifie (ex: import en masse avant le questionnaire d'eligibilite) : on ne
  // bloque que si des outils sont deja choisis mais couvrent mal les 3 phases requises.
  if (outilsTries.length) {
    const manquantes = missingRequiredPhases(outilsTries);
    if (manquantes.length) {
      return res.status(400).json({
        error: `Choisis au moins un outil de : ${manquantes.map(p => p.label).join(', ')}`
      });
    }
  }

  const chantier_id = transaction(() => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO chantiers (titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin, statut, eligible_kaizen, quiz_reponses)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run([
      titre, probleme || '', perimetre || '', pilote || '',
      JSON.stringify(equipe || []), objectif || '', JSON.stringify(outilsTries),
      date_debut || '', date_fin || '', statut || 'a_traiter',
      eligible_kaizen === undefined || eligible_kaizen === null ? null : (eligible_kaizen ? 1 : 0),
      quiz_reponses ? JSON.stringify(quiz_reponses) : null
    ]);

    // Pre-remplit le plan d'action avec une action par outil selectionne (pas une par
    // etape : les supports/templates de chaque outil existent deja en interne, la
    // methode detaillee n'a donc pas besoin d'etre repetee action par action).
    // Ordre des phases (Identification -> ... -> Standardisation) pour une liste
    // d'actions chronologique.
    outilsTries.forEach(outilId => {
      const tool = TOOLS_BY_ID[outilId];
      if (!tool) return;
      db.prepare(`
        INSERT INTO actions (chantier_id, description, responsable, echeance, statut)
        VALUES (?, ?, '', '', 'a_faire')
      `).run([lastInsertRowid, `Realiser : ${tool.name}`]);
    });

    return lastInsertRowid;
  });

  res.json(getChantierFull(chantier_id));
});

app.put('/api/chantiers/:id', (req, res) => {
  const {
    titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin, statut,
    eligible_kaizen, quiz_reponses
  } = req.body;
  const existing = db.prepare('SELECT * FROM chantiers WHERE id = ?').get([req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Non trouve' });

  // eligible_kaizen / quiz_reponses ne sont fournis que par le flux questionnaire ;
  // une simple edition du formulaire ne doit pas effacer une reponse deja enregistree.
  const nextEligible = eligible_kaizen === undefined ? existing.eligible_kaizen : (eligible_kaizen ? 1 : 0);
  const nextQuiz = quiz_reponses === undefined ? existing.quiz_reponses : JSON.stringify(quiz_reponses);

  db.prepare(`
    UPDATE chantiers SET titre = ?, probleme = ?, perimetre = ?, pilote = ?, equipe = ?,
      objectif = ?, outils = ?, date_debut = ?, date_fin = ?, statut = ?, eligible_kaizen = ?, quiz_reponses = ?
    WHERE id = ?
  `).run([
    titre, probleme || '', perimetre || '', pilote || '',
    JSON.stringify(equipe || []), objectif || '', JSON.stringify(sortOutilsByPhase(outils || [])),
    date_debut || '', date_fin || '', statut || 'en_cours', nextEligible, nextQuiz, req.params.id
  ]);
  res.json(getChantierFull(req.params.id));
});

// ---------- Tableau de bord ----------
app.get('/api/dashboard', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const parChantierStatut = db.prepare(`
    SELECT statut, COUNT(*) as n FROM chantiers GROUP BY statut
  `).all();

  const actionsEnRetard = db.prepare(`
    SELECT a.id, a.description, a.responsable, a.echeance, a.chantier_id, c.titre as chantier_titre
    FROM actions a
    JOIN chantiers c ON c.id = a.chantier_id
    WHERE a.statut != 'fait' AND a.echeance != '' AND a.echeance < ?
    ORDER BY a.echeance ASC
  `).all([today]);

  const indicateurs = db.prepare(`
    SELECT valeur_avant, valeur_apres FROM indicateurs
    WHERE valeur_avant IS NOT NULL AND valeur_apres IS NOT NULL AND valeur_avant != 0
  `).all();

  const gains = indicateurs.map(i => ((i.valeur_avant - i.valeur_apres) / i.valeur_avant) * 100);
  const gainMoyen = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : null;

  const totalActions = db.prepare(`SELECT COUNT(*) as n FROM actions`).get().n;
  const actionsFaites = db.prepare(`SELECT COUNT(*) as n FROM actions WHERE statut = 'fait'`).get().n;

  res.json({
    chantiersParStatut: Object.fromEntries(parChantierStatut.map(r => [r.statut, r.n])),
    totalChantiers: parChantierStatut.reduce((a, r) => a + r.n, 0),
    actionsEnRetard,
    totalActions,
    actionsFaites,
    gainMoyen,
    indicateursSuivis: gains.length
  });
});

app.delete('/api/chantiers/:id', (req, res) => {
  transaction(() => {
    db.prepare('DELETE FROM actions WHERE chantier_id = ?').run([req.params.id]);
    db.prepare('DELETE FROM indicateurs WHERE chantier_id = ?').run([req.params.id]);
    db.prepare('DELETE FROM chantiers WHERE id = ?').run([req.params.id]);
  });
  res.json({ success: true });
});

// ---------- Actions (plan d'action) ----------
app.post('/api/chantiers/:id/actions', (req, res) => {
  const { description, responsable, echeance, statut } = req.body;
  if (!description) return res.status(400).json({ error: 'description requise' });
  db.prepare(`
    INSERT INTO actions (chantier_id, description, responsable, echeance, statut)
    VALUES (?, ?, ?, ?, ?)
  `).run([req.params.id, description, responsable || '', echeance || '', statut || 'a_faire']);
  res.json(getChantierFull(req.params.id));
});

app.put('/api/chantiers/:id/actions/:actionId', (req, res) => {
  const { description, responsable, echeance, statut } = req.body;
  db.prepare(`
    UPDATE actions SET description = ?, responsable = ?, echeance = ?, statut = ?
    WHERE id = ? AND chantier_id = ?
  `).run([description, responsable || '', echeance || '', statut || 'a_faire', req.params.actionId, req.params.id]);
  res.json(getChantierFull(req.params.id));
});

app.delete('/api/chantiers/:id/actions/:actionId', (req, res) => {
  db.prepare('DELETE FROM actions WHERE id = ? AND chantier_id = ?').run([req.params.actionId, req.params.id]);
  res.json(getChantierFull(req.params.id));
});

// ---------- Indicateurs (avant / apres) ----------
app.post('/api/chantiers/:id/indicateurs', (req, res) => {
  const { nom, unite, valeur_avant, valeur_apres } = req.body;
  if (!nom) return res.status(400).json({ error: 'nom requis' });
  db.prepare(`
    INSERT INTO indicateurs (chantier_id, nom, unite, valeur_avant, valeur_apres)
    VALUES (?, ?, ?, ?, ?)
  `).run([req.params.id, nom, unite || '', valeur_avant ?? null, valeur_apres ?? null]);
  res.json(getChantierFull(req.params.id));
});

app.put('/api/chantiers/:id/indicateurs/:indicId', (req, res) => {
  const { nom, unite, valeur_avant, valeur_apres } = req.body;
  db.prepare(`
    UPDATE indicateurs SET nom = ?, unite = ?, valeur_avant = ?, valeur_apres = ?
    WHERE id = ? AND chantier_id = ?
  `).run([nom, unite || '', valeur_avant ?? null, valeur_apres ?? null, req.params.indicId, req.params.id]);
  res.json(getChantierFull(req.params.id));
});

app.delete('/api/chantiers/:id/indicateurs/:indicId', (req, res) => {
  db.prepare('DELETE FROM indicateurs WHERE id = ? AND chantier_id = ?').run([req.params.indicId, req.params.id]);
  res.json(getChantierFull(req.params.id));
});

// ---------- Photos (fiche chantier ou action specifique) ----------
app.post('/api/chantiers/:id/photos', (req, res) => {
  const { filename, mime_type, data, action_id } = req.body;
  if (!data) return res.status(400).json({ error: 'data (base64) requise' });
  db.prepare(`
    INSERT INTO photos (chantier_id, action_id, filename, mime_type, data)
    VALUES (?, ?, ?, ?, ?)
  `).run([req.params.id, action_id || null, filename || '', mime_type || '', data]);
  res.json(getChantierFull(req.params.id));
});

app.delete('/api/chantiers/:id/photos/:photoId', (req, res) => {
  db.prepare('DELETE FROM photos WHERE id = ? AND chantier_id = ?').run([req.params.photoId, req.params.id]);
  res.json(getChantierFull(req.params.id));
});

app.listen(PORT, () => {
  console.log(`\n  Kaizen app demarree -> http://localhost:${PORT}\n`);
});
