const { TOOLS, TOOLS_BY_ID } = require('../data/tools.js');

// Mots-cles Lean generaux (hors mots-cles specifiques a chaque outil) qui
// confirment qu'une question est bien dans le perimetre Lean / Kaizen.
const GENERAL_LEAN_KEYWORDS = [
  'kaizen', 'lean', 'gaspillage', 'muda', 'mura', 'muri', 'amelioration continue',
  'chantier', 'productivite', 'qualite', 'defaut', 'panne', 'stock', 'delai',
  'securite', 'poste de travail', 'operateur', 'production', 'flux', 'atelier',
  'ligne de production', 'processus', 'probleme', 'performance', 'usine',
  'reglage', 'cadence', 'operateurs', 'demarche', 'outil', 'attente',
  'temps d\'attente', 'perte de temps', 'lenteur', 'lent', 'trop long',
  'trop lent', 'ralentissement', 'productif'
];

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// Racine grossiere d'un mot francais : enleve uniquement le marqueur de
// pluriel final (s/x) pour tolerer "changements" vs "changement", sans
// toucher aux terminaisons qui font partie du radical (ex: "changement").
function stem(word) {
  if (word.length > 3 && /[sx]$/.test(word)) return word.slice(0, -1);
  return word;
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

async function reply(message, mode) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (mode === 'ai') {
    if (!apiKey) {
      const fallback = localReply(message);
      fallback.notice = "Mode IA indisponible (aucune cle ANTHROPIC_API_KEY configuree sur le serveur) : reponse du moteur local a la place.";
      return fallback;
    }
    try {
      return await anthropicReply(message, apiKey);
    } catch (err) {
      const fallback = localReply(message);
      fallback.notice = `Erreur API Claude (${err.message}) : reponse du moteur local a la place.`;
      return fallback;
    }
  }

  return localReply(message);
}

module.exports = { reply, localReply, TOOLS_BY_ID };
