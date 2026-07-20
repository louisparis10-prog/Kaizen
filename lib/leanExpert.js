const { TOOLS, TOOLS_BY_ID } = require('../data/tools.js');

// Mots-cles Lean generaux (hors mots-cles specifiques a chaque outil) qui
// confirment qu'une question est bien dans le perimetre Lean / Kaizen.
const GENERAL_LEAN_KEYWORDS = [
  // Vocabulaire Lean / amelioration continue
  'kaizen', 'lean', 'gaspillage', 'muda', 'mura', 'muri', 'amelioration continue',
  'chantier', 'productivite', 'qualite', 'defaut', 'panne', 'stock', 'delai',
  'securite', 'poste de travail', 'operateur', 'production', 'flux', 'atelier',
  'ligne de production', 'processus', 'probleme', 'performance', 'usine',
  'reglage', 'cadence', 'operateurs', 'demarche', 'outil', 'attente',
  'temps d\'attente', 'perte de temps', 'lenteur', 'lent', 'trop long',
  'trop lent', 'ralentissement', 'productif',

  // Secteurs et environnements industriels
  'industrie', 'industriel', 'usine', 'site de production', 'agroalimentaire',
  'automobile', 'aeronautique', 'textile', 'chimie', 'metallurgie', 'plasturgie',
  'pharmaceutique', 'cosmetique', 'emballage', 'logistique', 'entrepot',
  'menuiserie', 'imprimerie', 'fonderie', 'usinage', 'assemblage', 'montage',
  'conditionnement', 'injection plastique', 'extrusion', 'soudure', 'peinture industrielle',
  'chaine de production', 'chaine de montage', 'atelier de production',

  // Roles et fonctions
  'operateur de production', 'regleur', 'technicien de maintenance', 'chef d\'equipe',
  'responsable production', 'responsable qualite', 'responsable maintenance',
  'ingenieur process', 'agent de fabrication', 'conducteur de ligne', 'magasinier',
  'caviste', 'cariste', 'controleur qualite', 'directeur d\'usine', 'superviseur',

  // Machines et equipements
  'machine', 'convoyeur', 'presse', 'four', 'extrudeuse', 'robot', 'palettiseur',
  'emballeuse', 'etiqueteuse', 'chariot elevateur', 'pont roulant', 'ligne d\'assemblage',
  'automate', 'capteur', 'convoyeur a bande', 'chaine logistique', 'entrepot automatise',

  // Problemes qualite / production courants
  'rebut', 'non-conformite', 'non conformite', 'casse', 'fuite', 'vibration',
  'usure', 'corrosion', 'encrassement', 'bourrage', 'blocage', 'casse outil',
  'defaut dimensionnel', 'defaut d\'aspect', 'mauvais assemblage', 'sous-effectif',
  'absenteisme', 'turnover', 'accident du travail', 'presqu\'accident', 'retard livraison',
  'sur-stockage', 'rupture de stock', 'ecart de qualite', 'reclamation client',
  'produit refuse', 'taux de rebut', 'variation de process', 'derive process',
  'surproduction', 'sous-production', 'temps mort', 'micro-arret', 'goulot d\'etranglement',
  'goulet d\'etranglement', 'surcharge de travail', 'charge de travail', 'cout de non qualite'
];

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Racine grossiere d'un mot francais : enleve le marqueur de pluriel final
// (s/x) puis les 'e' muets finaux (accord feminin : apres normalisation NFD,
// "cassee" vs "casse" ne different que par ce e), pour tolerer les variations
// de genre/nombre sans toucher aux radicaux eux-memes.
function stem(word) {
  let w = word;
  if (w.length > 3 && /[sx]$/.test(w)) w = w.slice(0, -1);
  while (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);
  return w;
}

function messageContainsWord(messageWords, word) {
  const target = stem(word);
  if (!target) return false;
  return messageWords.some(w => stem(w) === target);
}

function phraseMatches(messageWords, phrase) {
  const words = normalize(phrase).split(/\s+/).filter(Boolean);
  return words.every(w => messageContainsWord(messageWords, w));
}

function scoreTools(message) {
  const norm = normalize(message);
  const messageWords = norm.split(/[^a-z0-9]+/).filter(Boolean);
  const scores = TOOLS.map(tool => {
    let score = 0;
    for (const kw of tool.keywords) {
      if (phraseMatches(messageWords, kw)) score += 2;
    }
    // le nom de l'outil cite directement compte double
    if (phraseMatches(messageWords, tool.name)) score += 3;
    return { tool, score };
  });
  return scores.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
}

function isInScope(message, matchedTools) {
  if (matchedTools.length > 0) return true;
  const norm = normalize(message);
  const messageWords = norm.split(/[^a-z0-9]+/).filter(Boolean);
  return GENERAL_LEAN_KEYWORDS.some(kw => phraseMatches(messageWords, kw));
}

const OFF_TOPIC_REPLY = "Je suis un expert Lean / Kaizen (ceinture noire) : je ne reponds qu'aux questions liees a l'amelioration continue, aux chantiers Kaizen et aux outils Lean (5S, SMED, Ishikawa, PDCA, A3...). Reformule ta question en me decrivant un probleme terrain (qualite, delai, panne, organisation...) et je t'orienterai vers le bon outil.";

const INTRO_PHRASES = [
  "D'apres ce que tu decris, je recommande",
  "Sur ce type de probleme, l'outil le plus adapte est",
  "C'est un cas classique pour",
  "Je t'oriente vers"
];

function pickIntro(seed) {
  return INTRO_PHRASES[seed % INTRO_PHRASES.length];
}

// Moteur local : gratuit, deterministe, sans appel reseau.
function localReply(message) {
  const matches = scoreTools(message);

  if (!isInScope(message, matches)) {
    return { text: OFF_TOPIC_REPLY, tools: [], source: 'local' };
  }

  if (matches.length === 0) {
    return {
      text: "Peux-tu preciser ton probleme ? Dis-moi par exemple s'il s'agit d'un defaut qualite recurrent, d'un temps de changement de serie trop long, d'un poste desorganise, d'une panne machine ou d'un flux trop complexe : je pourrai t'orienter vers l'outil Kaizen adapte.",
      tools: [],
      source: 'local'
    };
  }

  const top = matches.slice(0, 3).map(m => m.tool);
  const seed = Math.abs(top[0].id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const intro = pickIntro(seed);

  let text = `${intro} **${top[0].name}**. ${top[0].summary}`;
  if (top.length > 1) {
    text += `\n\nEn complement, tu peux aussi t'appuyer sur : ${top.slice(1).map(t => `**${t.name}**`).join(', ')}.`;
  }
  text += `\n\nPour commencer : ${top[0].steps[0]}`;

  return { text, tools: top.map(t => t.id), source: 'local' };
}

const SYSTEM_PROMPT = `Tu es un expert Lean Six Sigma "Ceinture Noire", specialiste de l'animation de chantiers Kaizen en industrie.
Regles strictes :
- Tu ne reponds QUE aux questions en lien avec le Lean management, l'amelioration continue et les chantiers Kaizen (organisation du travail, qualite, production, flux, maintenance, gaspillages).
- Si la question sort de ce cadre (sujet personnel, general, autre domaine), decline poliment en une phrase et recentre sur le Lean.
- Sois concret et bref (envrion 5-8 lignes maximum).
- Oriente TOUJOURS vers un ou plusieurs outils precis parmi cette liste : ${TOOLS.map(t => t.name).join(', ')}.
- Explique en 2-3 phrases pourquoi cet outil est adapte au cas decrit et donne une premiere etape concrete pour s'y mettre.
- Termine si pertinent par une question pour approfondir le diagnostic (ex: as-tu des donnees chiffrees ? depuis quand ce probleme existe-t-il ?).`;

async function anthropicReply(message, apiKey) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  const matches = scoreTools(message + ' ' + text);
  return { text: text || OFF_TOPIC_REPLY, tools: matches.slice(0, 3).map(m => m.tool.id), source: 'ai' };
}

async function openaiReply(message, apiKey) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = (data.choices || []).map(c => c.message?.content || '').join('').trim();
  const matches = scoreTools(message + ' ' + text);
  return { text: text || OFF_TOPIC_REPLY, tools: matches.slice(0, 3).map(m => m.tool.id), source: 'ai' };
}

async function geminiReply(message, apiKey) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: message }] }]
      })
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = ((data.candidates || [])[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  const matches = scoreTools(message + ' ' + text);
  return { text: text || OFF_TOPIC_REPLY, tools: matches.slice(0, 3).map(m => m.tool.id), source: 'ai' };
}

async function groqReply(message, apiKey) {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = (data.choices || []).map(c => c.message?.content || '').join('').trim();
  const matches = scoreTools(message + ' ' + text);
  return { text: text || OFF_TOPIC_REPLY, tools: matches.slice(0, 3).map(m => m.tool.id), source: 'ai' };
}

async function reply(message, mode) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (mode === 'ai') {
    if (!anthropicKey && !openaiKey && !geminiKey && !groqKey) {
      const fallback = localReply(message);
      fallback.notice = "Mode IA indisponible (aucune cle API IA configuree sur le serveur) : reponse du moteur local a la place.";
      return fallback;
    }
    try {
      if (anthropicKey) return await anthropicReply(message, anthropicKey);
      if (openaiKey) return await openaiReply(message, openaiKey);
      if (groqKey) return await groqReply(message, groqKey);
      return await geminiReply(message, geminiKey);
    } catch (err) {
      const fallback = localReply(message);
      fallback.notice = `Erreur API IA (${err.message}) : reponse du moteur local a la place.`;
      return fallback;
    }
  }

  return localReply(message);
}

module.exports = { reply, localReply, scoreTools, TOOLS_BY_ID };
