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

// Questions du type "qu'a-t-on deja fait sur ... ?" : le moteur local sait y repondre
// en cherchant directement dans les chantiers enregistres.
const HISTORIQUE_PATTERNS = /(deja (fait|traite|lance)|historique|anterieur|precedent|similaire|existe.?t.?il|a.t.on|avons.nous|quel chantier|quels chantiers|chantier sur|retour d.experience)/i;

// Moteur local : gratuit, deterministe, sans appel reseau.
function localReply(message, chantiers) {
  const matches = scoreTools(message);

  // Recherche dans l'historique des chantiers avant l'orientation outil.
  if (HISTORIQUE_PATTERNS.test(normalize(message))) {
    const trouves = chercherChantiers(message, chantiers);
    if (trouves.length) {
      const lignes = trouves.map(c => `- ${formatChantier(c, false)}`).join('\n');
      return {
        text: `J'ai trouve ${trouves.length} chantier(s) en lien avec ta question :\n${lignes}\n\nOuvre le chantier concerne pour voir son plan d'action et ses resultats.`,
        tools: [], source: 'local'
      };
    }
    if (Array.isArray(chantiers) && chantiers.length) {
      return {
        text: "Je n'ai trouve aucun chantier enregistre sur ce sujet. C'est donc probablement un nouveau sujet a lancer.",
        tools: [], source: 'local'
      };
    }
  }

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

// ---------- Connaissance des chantiers de l'application ----------
// Le serveur transmet un instantane des chantiers : le chat peut ainsi repondre
// sur ce qui a deja ete fait en interne, et pas seulement sur la theorie Lean.

const STATUT_LABELS = { a_traiter: 'a traiter', en_cours: 'en cours', termine: 'termine' };
const ACTION_STATUT_LABELS = { a_faire: 'a faire', en_cours: 'en cours', fait: 'fait', bloque: 'bloque' };

// Pertinence d'un chantier vis-a-vis de la question posee (recherche par mots).
function scoreChantier(messageWords, c) {
  const champs = [c.titre, c.probleme, c.perimetre, c.pilote, c.objectif, (c.outils || []).join(' ')];
  const motsChantier = normalize(champs.join(' ')).split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;
  // Les mots trop courts (le, de, un...) generent du bruit : on les ignore.
  messageWords.filter(w => w.length > 3).forEach(w => {
    if (motsChantier.some(m => stem(m) === stem(w))) score += 1;
  });
  return score;
}

function formatChantier(c, complet) {
  const lignes = [`#${c.id} "${c.titre}" (${STATUT_LABELS[c.statut] || c.statut}` +
    `${c.perimetre ? ', ' + c.perimetre : ''}${c.pilote ? ', pilote ' + c.pilote : ''})`];
  if (!complet) return lignes.join('');

  if (c.probleme) lignes.push(`  Probleme : ${c.probleme}`);
  if (c.objectif) lignes.push(`  Objectif : ${c.objectif}`);
  if (c.periode) lignes.push(`  Periode : ${c.periode}`);
  if (c.outils && c.outils.length) lignes.push(`  Outils utilises : ${c.outils.join(', ')}`);
  if (c.actions && c.actions.length) {
    lignes.push('  Plan d\'action :');
    c.actions.forEach(a => {
      const details = [a.responsable, a.echeance].filter(Boolean).join(', ');
      lignes.push(`    - ${a.description} [${ACTION_STATUT_LABELS[a.statut] || a.statut}]${details ? ' (' + details + ')' : ''}`);
    });
  }
  if (c.indicateurs && c.indicateurs.length) {
    lignes.push('  Indicateurs :');
    c.indicateurs.forEach(i => {
      lignes.push(`    - ${i.nom} : ${i.avant ?? '?'} -> ${i.apres ?? '?'} ${i.unite}`.trim());
    });
  }
  if (c.supports && c.supports.length) {
    lignes.push('  Supports SWM remplis :');
    c.supports.forEach(s => {
      const contenu = Object.entries(s.champs || {})
        .map(([cle, val]) => {
          if (Array.isArray(val)) {
            if (!val.length) return null;
            return `${cle} = ${val.map(o => Object.values(o).filter(Boolean).join(' / ')).join(' ; ')}`;
          }
          const t = String(val || '').replace(/\s*\n\s*/g, ' / ').trim();
          return t ? `${cle} = ${t}` : null;
        })
        .filter(Boolean).join(' | ');
      lignes.push(`    - ${s.outil}${contenu ? ' : ' + contenu : ''}`);
    });
  }
  return lignes.join('\n');
}

// Construit un resume borne en taille : detail complet pour les chantiers actifs et
// ceux qui repondent a la question, simple liste pour les irritants restants.
function buildChantiersContext(message, chantiers) {
  if (!Array.isArray(chantiers) || !chantiers.length) return null;

  const messageWords = normalize(message).split(/[^a-z0-9]+/).filter(Boolean);
  const compte = { a_traiter: 0, en_cours: 0, termine: 0 };
  chantiers.forEach(c => { compte[c.statut] = (compte[c.statut] || 0) + 1; });

  const actifs = chantiers.filter(c => c.statut !== 'a_traiter');
  const idsActifs = new Set(actifs.map(c => c.id));
  const pertinents = chantiers
    .filter(c => !idsActifs.has(c.id))
    .map(c => ({ c, score: scoreChantier(messageWords, c) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(x => x.c);

  const blocs = [
    `Etat de l'application : ${chantiers.length} chantiers enregistres ` +
    `(${compte.a_traiter || 0} a traiter, ${compte.en_cours || 0} en cours, ${compte.termine || 0} termines).`
  ];

  if (actifs.length) {
    blocs.push('Chantiers demarres ou termines (detail complet) :\n' +
      actifs.map(c => formatChantier(c, true)).join('\n'));
  }
  if (pertinents.length) {
    blocs.push('Sujets "a traiter" en lien avec la question :\n' +
      pertinents.map(c => '- ' + formatChantier(c, false)).join('\n'));
  }

  return blocs.join('\n\n');
}

// Recherche interne utilisee par le moteur local (sans IA).
function chercherChantiers(message, chantiers) {
  if (!Array.isArray(chantiers) || !chantiers.length) return [];
  const messageWords = normalize(message).split(/[^a-z0-9]+/).filter(Boolean);
  return chantiers
    .map(c => ({ c, score: scoreChantier(messageWords, c) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(x => x.c);
}

const SYSTEM_PROMPT = `Tu es un expert Lean Six Sigma "Ceinture Noire", specialiste de l'animation de chantiers Kaizen en industrie.
Regles strictes :
- Tu ne reponds QUE aux questions en lien avec le Lean management, l'amelioration continue et les chantiers Kaizen (organisation du travail, qualite, production, flux, maintenance, gaspillages).
- Si la question sort de ce cadre (sujet personnel, general, autre domaine), decline poliment en une phrase et recentre sur le Lean.
- Sois concret et bref (envrion 5-8 lignes maximum).
- Reponds en texte simple, sans mise en forme Markdown (pas d'asterisques ** ni de #) : l'interface affiche le texte brut.
- Oriente TOUJOURS vers un ou plusieurs outils precis parmi cette liste : ${TOOLS.map(t => t.name).join(', ')}.
- Explique en 2-3 phrases pourquoi cet outil est adapte au cas decrit et donne une premiere etape concrete pour s'y mettre.
- Termine si pertinent par une question pour approfondir le diagnostic (ex: as-tu des donnees chiffrees ? depuis quand ce probleme existe-t-il ?).

Tu as aussi acces aux chantiers reellement enregistres dans l'application (voir "DONNEES DE L'APPLICATION" ci-dessous quand elles sont fournies).
- Si la question porte sur ce qui a deja ete fait, sur un chantier existant, sur un historique ou sur un sujet deja traite, appuie-toi sur ces donnees et cite les chantiers concernes par leur titre (et leur statut).
- N'invente jamais un chantier, une action ou un resultat qui ne figure pas dans ces donnees. Si l'information n'y est pas, dis-le simplement.
- Si un sujet proche a deja ete traite, signale-le pour eviter de refaire deux fois le meme chantier.`;

// Assemble le prompt systeme avec, si disponible, l'instantane des chantiers.
function systemPromptWithContext(message, chantiers) {
  const contexte = buildChantiersContext(message, chantiers);
  if (!contexte) return SYSTEM_PROMPT;
  return `${SYSTEM_PROMPT}\n\nDONNEES DE L'APPLICATION (chantiers reels, a jour) :\n${contexte}`;
}

async function anthropicReply(message, apiKey, chantiers) {
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
      system: systemPromptWithContext(message, chantiers),
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

async function openaiReply(message, apiKey, chantiers) {
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
        { role: 'system', content: systemPromptWithContext(message, chantiers) },
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

async function geminiReply(message, apiKey, chantiers) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPromptWithContext(message, chantiers) }] },
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

async function groqReply(message, apiKey, chantiers) {
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
        { role: 'system', content: systemPromptWithContext(message, chantiers) },
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

async function reply(message, mode, chantiers) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (mode === 'ai') {
    if (!anthropicKey && !openaiKey && !geminiKey && !groqKey) {
      const fallback = localReply(message, chantiers);
      fallback.notice = "Mode IA indisponible (aucune cle API IA configuree sur le serveur) : reponse du moteur local a la place.";
      return fallback;
    }
    try {
      if (anthropicKey) return await anthropicReply(message, anthropicKey, chantiers);
      if (openaiKey) return await openaiReply(message, openaiKey, chantiers);
      if (groqKey) return await groqReply(message, groqKey, chantiers);
      return await geminiReply(message, geminiKey, chantiers);
    } catch (err) {
      const fallback = localReply(message, chantiers);
      fallback.notice = `Erreur API IA (${err.message}) : reponse du moteur local a la place.`;
      return fallback;
    }
  }

  return localReply(message, chantiers);
}

module.exports = { reply, localReply, scoreTools, chercherChantiers, buildChantiersContext, TOOLS_BY_ID };
