const express = require('express');
const path = require('path');
const { Database } = require('node-sqlite3-wasm');
const { TOOLS } = require('./data/tools.js');
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
    statut          TEXT DEFAULT 'en_cours',
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
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
  chantier.actions = db.prepare('SELECT * FROM actions WHERE chantier_id = ? ORDER BY created_at ASC').all([id]);
  chantier.indicateurs = db.prepare('SELECT * FROM indicateurs WHERE chantier_id = ? ORDER BY id ASC').all([id]);
  return chantier;
}

// ---------- Outils (bibliotheque Kaizen) ----------
app.get('/api/tools', (req, res) => {
  res.json(TOOLS);
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
  const { titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin } = req.body;
  if (!titre) return res.status(400).json({ error: 'titre requis' });
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO chantiers (titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run([
    titre, probleme || '', perimetre || '', pilote || '',
    JSON.stringify(equipe || []), objectif || '', JSON.stringify(outils || []),
    date_debut || '', date_fin || ''
  ]);
  res.json(getChantierFull(lastInsertRowid));
});

app.put('/api/chantiers/:id', (req, res) => {
  const { titre, probleme, perimetre, pilote, equipe, objectif, outils, date_debut, date_fin, statut } = req.body;
  const existing = db.prepare('SELECT id FROM chantiers WHERE id = ?').get([req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Non trouve' });
  db.prepare(`
    UPDATE chantiers SET titre = ?, probleme = ?, perimetre = ?, pilote = ?, equipe = ?,
      objectif = ?, outils = ?, date_debut = ?, date_fin = ?, statut = ?
    WHERE id = ?
  `).run([
    titre, probleme || '', perimetre || '', pilote || '',
    JSON.stringify(equipe || []), objectif || '', JSON.stringify(outils || []),
    date_debut || '', date_fin || '', statut || 'en_cours', req.params.id
  ]);
  res.json(getChantierFull(req.params.id));
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

app.listen(PORT, () => {
  console.log(`\n  Kaizen app demarree -> http://localhost:${PORT}\n`);
});
