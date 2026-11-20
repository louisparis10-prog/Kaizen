// Analyse simplifiée d'accident benin : un parcours guide en 4 etapes et un bilan,
// pour des personnes qui ne connaissent ni le Lean ni la securite.
// Le vocabulaire des methodes (Ishikawa, 5 Pourquoi...) n'apparait jamais :
// on pose des questions simples, on propose des exemples, et on s'arrete des
// qu'on tient quelque chose sur quoi agir.
(function () {
  const OUTIL_ID = 'analyse-flash';
  const CLE_LOCALE = 'kaizen-analyse-flash-brouillon';
  const CLE_VERS_ARBRE = 'kaizen-arbre-depuis-flash';
  const MAX_FACTEURS = 3, MAX_PHOTOS = 3;
  // Codification des actions, de la plus a la moins efficace. Les points servent au score global.
  const NIVEAUX_ACTION = [
    { n: 1, label: 'Supprimer le danger', ex: 'supprimer la cause', pts: 100 },
    { n: 2, label: 'Protéger tout le monde', ex: 'carter, garde-corps', pts: 70 },
    { n: 3, label: 'Protéger la personne', ex: 'gants, lunettes', pts: 40 },
    { n: 4, label: 'Informer', ex: 'consigne, affichage', pts: 15 }
  ];
  const niveauAction = (n) => NIVEAUX_ACTION.find(x => x.n === Number(n));

  // ---------- Referentiels ----------
  const TYPES = [
    { id: 'coupure', ico: '✂️', label: 'Coupure, piqûre', aide: 'outil, lame, arête vive…' },
    { id: 'glissade', ico: '🦶', label: 'Glissade, trébuchement', aide: 'chute ou quasi-chute de plain-pied' },
    { id: 'hauteur', ico: '🪜', label: 'Chute de hauteur', aide: 'escabeau, marche, quai, escalier' },
    { id: 'choc', ico: '💥', label: 'Choc, heurt', aide: 'contre un objet, ou objet qui tombe' },
    { id: 'coincement', ico: '🖐️', label: 'Pincement, coincement', aide: 'entre deux pièces, dans une machine' },
    { id: 'effort', ico: '🏋️', label: 'Faux mouvement, effort', aide: 'charge, posture, geste répété' },
    { id: 'projection', ico: '👁️', label: 'Projection', aide: "copeau, poussière, produit dans l'œil" },
    { id: 'brulure', ico: '🔥', label: 'Brûlure', aide: 'surface chaude, vapeur, produit chimique' },
    { id: 'engin', ico: '🚜', label: 'Engin, chariot', aide: 'collision, pied écrasé, renversement' },
    { id: 'autre', ico: '❔', label: 'Autre chose', aide: '' }
  ];
  const ZONES = [
    { id: 'main', ico: '✋', label: 'Main, doigt' },
    { id: 'bras', ico: '💪', label: 'Bras, épaule' },
    { id: 'tete', ico: '🙂', label: 'Tête, visage' },
    { id: 'oeil', ico: '👁️', label: 'Œil' },
    { id: 'dos', ico: '🧍', label: 'Dos' },
    { id: 'jambe', ico: '🦵', label: 'Jambe, genou' },
    { id: 'pied', ico: '🦶', label: 'Pied, cheville' },
    { id: 'aucune', ico: '⭕', label: "Pas de blessure (presqu'accident)" }
  ];
  const SUITES = [
    { id: 'rien', ico: '🩹', label: 'Rien, ou un pansement sur place' },
    { id: 'infirmerie', ico: '🏥', label: "Soins à l'infirmerie" },
    { id: 'medecin', ico: '🩺', label: 'Consultation médicale, hôpital' },
    { id: 'arret', ico: '🛏️', label: 'Arrêt de travail' }
  ];
  // Accidents dont le potentiel est souvent grave, meme quand l'issue est benigne.
  const TYPES_A_RISQUE = ['hauteur', 'coincement', 'engin'];

  // Les cinq familles de ce qui a pu jouer, en mots de terrain. La piece
  // travaillee est rangee avec le materiel : le produit change peu d'un poste a l'autre.
  const RUBRIQUES = [
    { id: 'materiel', ico: '🛠️', label: 'Machine, outil, matériel', q: "Qu'est-ce qui, dans la machine, l'outil, le matériel ou la pièce manipulée, a joué ?" },
    { id: 'lieu', ico: '🏭', label: 'Environnement de travail', q: "Qu'est-ce qui, dans l'environnement de travail (sol, passage, éclairage, bruit, température, rangement), a joué ?" },
    { id: 'facon', ico: '👷', label: 'Façon de faire', q: "Qu'est-ce qui, dans la façon de faire le travail, a joué ?" },
    { id: 'organisation', ico: '📋', label: 'Organisation', q: "Qu'est-ce qui, dans l'organisation (temps, effectif, consignes, accueil), a joué ?" }
  ];
  const rubrique = (id) => RUBRIQUES.find(r => r.id === id);

  const EXEMPLES_FAITS = {
    materiel: ['Outil usé ou abîmé', 'Machine sans carter à cet endroit', 'Arête vive sur la pièce', "Outil pas adapté à la tâche", 'Gants portés non résistants à la coupure'],
    lieu: ['Sol mouillé ou gras', 'Objet qui traînait dans le passage', 'Éclairage faible à cet endroit', 'Poste encombré'],
    facon: ['Geste fait à la main faute de moyen adapté', 'Tâche inhabituelle, rarement faite', 'Posture penchée ou en torsion'],
    organisation: ["Travail fait dans l'urgence", 'Personne seule pour une tâche à deux', 'Personne nouvelle au poste']
  };
  // Exemples propres a certains types d'accident, proposes en premier.
  const EXEMPLES_PAR_TYPE = {
    coupure: { materiel: ['Cutter à lame fixe', 'Gants en coton portés, peu résistants à la coupure'] },
    glissade: { lieu: ["Flaque d'huile ou d'eau au sol", "Câble ou palette dans l'allée", 'Marche peu visible'], materiel: ['Fuite sur une machine voisine'] },
    hauteur: { materiel: ['Escabeau instable ou abîmé', 'Pas de garde-corps à cet endroit'], facon: ['Montée sur un support non prévu (caisse, chaise)'] },
    choc: { lieu: ['Passage étroit près d\'une partie saillante'], materiel: ['Charge mal calée qui a bougé'] },
    coincement: { materiel: ['Partie mobile accessible en marche'], facon: ['Intervention sans arrêter la machine'] },
    effort: { materiel: ['Charge lourde portée à la main', "Pas d'aide à la manutention au poste"], facon: ['Charge soulevée dos courbé', 'Geste répété très souvent'] },
    projection: { materiel: ['Soufflette utilisée pour nettoyer', 'Lunettes non portées pour cette tâche'] },
    brulure: { materiel: ['Pièce encore chaude', 'Surface chaude non protégée', 'Produit chimique transvasé'] },
    engin: { lieu: ['Piétons et chariots dans la même allée', 'Angle sans visibilité'], organisation: ['Pas de sens de circulation défini'] }
  };
  const EXEMPLES_RAISONS = {
    materiel: ["Pas d'entretien prévu sur cet outil", 'Matériel adapté absent du poste', 'Défaut signalé mais pas réparé', 'Aucun moyen de préhension prévu', 'Protection adaptée absente du poste'],
    lieu: ['Fuite connue mais pas réparée', "Pas d'emplacement prévu pour ranger", 'Nettoyage pas prévu à ce moment'],
    facon: ['Le mode opératoire ne prévoit pas ce cas', 'Moyen adapté trop loin ou indisponible', 'Habitude prise depuis longtemps'],
    organisation: ['Retard de production à rattraper', 'Absence non remplacée', 'Accueil au poste pas encore fait']
  };
  const EXEMPLES_ACTIONS = {
    materiel: ["Réparer ou remplacer l'outil", 'Installer une protection fixe (carter)', 'Supprimer les arêtes vives à la source', 'Prévoir un moyen de préhension ou de manutention', 'Fournir des gants anti-coupure adaptés'],
    lieu: ['Réparer la fuite à la source', "Matérialiser et dégager l'allée", "Ajouter de l'éclairage"],
    facon: ["Revoir le mode opératoire avec l'équipe", 'Rapprocher le moyen adapté du poste', 'Supprimer la manipulation à la main'],
    organisation: ['Prévoir un binôme pour cette tâche', "Revoir le planning pour éviter l'urgence", "Faire l'accueil sécurité au poste"]
  };
  const STATUTS = [['a_faire', 'À faire'], ['en_cours', 'En cours'], ['realisee', 'Réalisée']];

  // Mots qui jugent la personne au lieu de decrire les faits.
  const MOTS_JUGEMENT = /(inattenti|manque d'attention|pas fait attention|pas attenti|maladr|erreur humaine|impruden|n[ée]glig|\bfaute\b|n'a pas respect|pas respect[ée]|distrait|[ée]tourderie|aurait d[ûu]|t[êe]te ailleurs|n'importe comment)/i;
  // Actions qui reposent seulement sur la vigilance des gens.
  const MOTS_CONSIGNE = /(rappel|sensibilis|consigne|faire attention|vigilan|[êe]tre prudent|redire|r[ée]-?expliquer|recadr)/i;

  const ETAPES = [
    { n: 1, titre: "L'accident" },
    { n: 2, titre: "Ce qui s'est passé" },
    { n: 3, titre: 'Ce qui a joué' },
    { n: 4, titre: "Ce qu'on change" },
    { n: 5, titre: 'Bilan' }
  ];

  // Exemple livre avec l'outil (d'apres le cas de la tole coupante).
  const EXEMPLE = {
    version: 1, etape: 5,
    typologie: { type: 'coupure', zone: 'main', suites: 'infirmerie' },
    infos: { date: '2026-11-12', secteur: 'Atelier découpe, poste 4', personne: 'Opérateur découpe', animateur: "Chef d'équipe" },
    recit: {
      activite: "L'opérateur positionnait à la main une tôle sur la table de la presse.",
      evenement: "La tôle a glissé dans sa main et le bord a entaillé son index gauche.",
      consequence: "Coupure superficielle à l'index gauche, soignée à l'infirmerie."
    },
    photos: [],
    facteurs: [
      { id: 'f1', rubrique: 'materiel', chaine: ['Le bord de la tôle est coupant (bavure de découpe)', "L'outil de découpe en amont laisse une bavure"], fin: true },
      { id: 'f2', rubrique: 'facon', chaine: ['La tôle est positionnée à la main', "Aucun moyen de préhension n'est prévu au poste"], fin: true },
      { id: 'f3', rubrique: 'materiel', chaine: ['Gants en coton portés, peu résistants à la coupure', 'Pas de gants anti-coupure au poste'], fin: true }
    ],
    actions: [
      { id: 'a1', facteur: 'f1', description: "Régler l'outil de découpe pour supprimer la bavure", responsable: 'Méthodes', echeance: '2026-11-30', statut: 'en_cours', niveau: 1 },
      { id: 'a2', facteur: 'f2', description: 'Tester une ventouse de préhension pour positionner les tôles', responsable: "Chef d'atelier", echeance: '2026-12-15', statut: 'a_faire', niveau: 2 },
      { id: 'a3', facteur: 'f3', description: 'Mettre des gants anti-coupure à disposition au poste', responsable: 'HSE', echeance: '2026-11-20', statut: 'realisee', niveau: 3 }
    ],
    potentiel: 'non'
  };

  // Exemple du mode « analyse approfondie » : le meme accident que l'arbre d'exemple « glissade »,
  // pour que l'on voie ensuite l'arbre construit a partir de ces reponses.
  const EXEMPLE_APPROFONDI = {
    version: 1, etape: 1,
    typologie: { type: 'glissade', zone: 'pied', suites: 'medecin' },
    infos: { date: '2026-11-06', secteur: 'Atelier presses, allée de la presse P3', personne: 'Opérateur presse', animateur: 'L. Paris' },
    recit: {
      activite: "L'opérateur traversait l'allée à pied en portant un carton de flacons.",
      evenement: "Il a glissé sur une flaque d'huile présente dans l'allée de la presse P3.",
      consequence: "Entorse de la cheville gauche. Le carton est tombé : 6 flacons cassés."
    },
    photos: [], facteurs: [], actions: [], potentiel: 'oui'
  };

  // ---------- Etat ----------
  const params = new URLSearchParams(location.search);
  const chantierId = params.get('chantier');
  // Mode « analyse approfondie » : les memes questions guidees pour l'accident et le recit,
  // puis on passe directement a l'arbre des causes, deja prerempli.
  const approfondi = params.get('mode') === 'approfondie';
  const urlAnalyse = (id) => '/analyse-flash.html' + (id ? `?id=${encodeURIComponent(id)}` : '') +
    (approfondi ? (id ? '&' : '?') + 'mode=approfondie' : '');
  const etapesAffichees = () => (approfondi ? ETAPES.slice(0, 2) : ETAPES);
  let chantier = null;
  let a = nouvelle();
  let modeExemple = false;
  let analysePerso = null;
  let minuterie = null;
  // Numero de l'analyse dans l'historique (null tant qu'elle n'est pas enregistree).
  let analyseId = params.get('id');

  const $ = (id) => document.getElementById(id);

  function nouvelle(infos) {
    return {
      version: 1, etape: 1,
      typologie: { type: '', zone: '', suites: '' },
      infos: Object.assign({ date: aujourdhui(), secteur: '', personne: '', animateur: '' }, infos || {}),
      recit: { activite: '', evenement: '', consequence: '' },
      photos: [], facteurs: [], actions: [], potentiel: ''
    };
  }
  function normaliser(d) {
    const n = nouvelle();
    if (!d || typeof d !== 'object') return n;
    ['typologie', 'infos', 'recit'].forEach(k => Object.assign(n[k], d[k] || {}));
    n.photos = Array.isArray(d.photos) ? d.photos.slice(0, MAX_PHOTOS) : [];
    // Les analyses commencees avec l'ancienne famille « Piece ou produit » passent dans le materiel.
    const bruts = Array.isArray(d.facteurs) ? d.facteurs : [];
    const avecMateriel = bruts.some(g => g && g.rubrique === 'materiel');
    n.facteurs = bruts.map(f => (f && (f.rubrique === 'protection' || (f.rubrique === 'produit' && !avecMateriel))) ? Object.assign({}, f, { rubrique: 'materiel' }) : f)
      .filter(f => f && rubrique(f.rubrique))
      .map(f => ({ id: f.id || uid(), rubrique: f.rubrique, chaine: Array.isArray(f.chaine) && f.chaine.length ? f.chaine : [''], fin: !!f.fin }));
    n.actions = (Array.isArray(d.actions) ? d.actions : []).map(x => Object.assign({ id: uid(), facteur: '', description: '', responsable: '', echeance: '', statut: 'a_faire', niveau: '' }, x));
    n.potentiel = ['oui', 'non', 'doute'].includes(d.potentiel) ? d.potentiel : '';
    n.etape = Math.min(5, Math.max(1, Number(d.etape) || 1));
    return n;
  }

  // ---------- Outils ----------
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function aujourdhui() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function dateFr(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
  }
  function toast(message, type) {
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    t.textContent = message;
    $('toast-root').appendChild(t);
    setTimeout(() => t.classList.add('toast-hide'), 2600);
    setTimeout(() => t.remove(), 3000);
  }
  const libelle = (liste, id) => (liste.find(x => x.id === id) || {}).label || '';
  const facteur = (id) => a.facteurs.find(f => f.id === id);
  // Ce sur quoi on agit pour un facteur : le dernier maillon renseigne.
  function pointAction(f) {
    const remplis = f.chaine.filter(t => t.trim());
    return remplis[remplis.length - 1] || '';
  }

  // ---------- Validation des etapes ----------
  function manque(etape) {
    if (etape === 1) {
      if (!a.typologie.type) return "Choisissez le type d'accident.";
      if (!a.typologie.suites) return "Indiquez les suites de l'accident.";
    }
    if (etape === 2 && !a.recit.evenement.trim()) return "Décrivez ce qui s'est passé.";
    if (etape === 3 && !a.facteurs.some(f => f.chaine[0].trim())) return 'Choisissez au moins une chose qui a joué et décrivez-la.';
    if (etape === 4 && !a.actions.some(x => x.description.trim())) return 'Décidez au moins une action.';
    return '';
  }
  function etapeAccessible(n) {
    for (let i = 1; i < n; i++) if (manque(i)) return false;
    return true;
  }

  // ---------- Efficacite des actions ----------
  // Score global : moyenne des points de toutes les actions dont le type est choisi.
  function scoreActions() {
    const liste = a.actions.filter(x => x.description.trim());
    const cotees = liste.filter(x => niveauAction(x.niveau));
    const parNiveau = NIVEAUX_ACTION.map(nv => cotees.filter(x => Number(x.niveau) === nv.n).length);
    const score = cotees.length ? Math.round(cotees.reduce((s, x) => s + niveauAction(x.niveau).pts, 0) / cotees.length) : null;
    return { score, nb: liste.length, sans: liste.length - cotees.length, parNiveau };
  }
  function verdictScore(s) {
    if (s >= 70) return { cls: 'fort', txt: 'Actions solides : elles agissent à la source du problème.' };
    if (s >= 40) return { cls: 'moyen', txt: 'Efficacité moyenne : cherchez une action de plus haut niveau (supprimer le danger, protéger tout le monde).' };
    return { cls: 'faible', txt: 'Actions fragiles : elles reposent surtout sur la vigilance des personnes. Peut-on agir plus à la source ?' };
  }
  function blocScore() {
    const s = scoreActions();
    if (!s.nb) return '';
    if (s.score === null) return '<div class="af-score vide"><div class="af-score-corps"><b>Efficacité globale des actions</b><p>Choisissez le type de chaque action : le score se calcule tout seul.</p></div></div>';
    const v = verdictScore(s.score);
    return `<div class="af-score ${v.cls}">
      <div class="af-score-rond"><b>${s.score}</b><small>/ 100</small></div>
      <div class="af-score-corps"><b>Efficacité globale des actions</b>
        <div class="af-score-barre"><i style="width:${s.score}%"></i></div>
        <p>${v.txt}</p>
        <div class="af-score-detail">${NIVEAUX_ACTION.map((nv, i) => s.parNiveau[i] ? `<span class="n${nv.n}">${s.parNiveau[i]} × ${esc(nv.label)}</span>` : '').join('')}</div>
        ${s.sans ? `<p class="af-score-note">${s.sans} action${s.sans > 1 ? 's' : ''} sans type : ${s.sans > 1 ? 'elles ne comptent' : 'elle ne compte'} pas encore dans le score.</p>` : ''}
      </div></div>`;
  }

  // ---------- Rendu ----------
  function rendre(focus) {
    $('etapes').innerHTML = etapesAffichees().map(e => {
      const cls = e.n === a.etape ? 'actif' : (e.n < a.etape && !manque(e.n) ? 'fait' : '');
      const ok = etapeAccessible(e.n);
      return `<li class="${cls}"><button type="button" data-aller="${e.n}"${ok ? '' : ' disabled'}><span>${e.n < a.etape && !manque(e.n) ? '✓' : e.n}</span>${esc(e.titre)}</button></li>`;
    }).join('');
    const vues = { 1: vueAccident, 2: vueRecit, 3: vueFacteurs, 4: vueActions, 5: vueBilan };
    $('contenu').innerHTML = vues[a.etape]();
    rendreNavigation();
    document.querySelectorAll('textarea').forEach(ajuster);
    verifierMots();
    if (focus) {
      const champ = document.querySelector(focus);
      if (champ) { champ.focus(); champ.setSelectionRange && champ.setSelectionRange(champ.value.length, champ.value.length); }
    }
  }

  function rendreNavigation() {
    const raison = manque(a.etape);
    const retour = a.etape > 1 ? '<button type="button" class="btn secondary" data-aller="prec">← Retour</button>' : '<span></span>';
    let suite = '';
    if (approfondi && a.etape === 2) {
      suite = `<div class="af-suite">${raison ? `<span class="af-raison">${esc(raison)}</span>` : ''}
        <button type="button" class="btn orange" id="btn-vers-arbre"${raison ? ' disabled' : ''}>${modeExemple ? "Voir l'arbre de l'exemple →" : "Construire l'arbre des causes →"}</button></div>`;
    } else if (a.etape < 5) {
      suite = `<div class="af-suite">${raison ? `<span class="af-raison">${esc(raison)}</span>` : ''}
        <button type="button" class="btn orange" data-aller="suiv"${raison ? ' disabled' : ''}>${a.etape === 4 ? 'Voir le bilan →' : 'Continuer →'}</button></div>`;
    }
    $('navigation').innerHTML = retour + suite;
  }

  function cartesChoix(liste, groupe, valeur, compact) {
    return `<div class="af-choix${compact ? ' compact' : ''}">${liste.map(x => `
      <button type="button" class="af-option${x.id === valeur ? ' choisi' : ''}" data-choix="${groupe}" data-valeur="${x.id}" aria-pressed="${x.id === valeur}">
        <span class="af-option-ico">${x.ico}</span><span class="af-option-label">${esc(x.label)}</span>${x.aide ? `<small>${esc(x.aide)}</small>` : ''}
      </button>`).join('')}</div>`;
  }

  function vueAccident() {
    const t = a.typologie;
    const alerte = t.suites === 'arret' ? `
      <div class="af-alerte forte">
        <b>🛑 Avec un arrêt de travail, l'analyse simplifiée ne suffit pas.</b>
        <p>Il faut faire un arbre des causes complet, en groupe. Vous pouvez aussi commencer ici : tout sera repris dans l'arbre des causes à la fin.</p>
        <a class="btn small" href="/arbre-causes.html">Aller à l'arbre des causes</a>
      </div>` : (t.suites === 'medecin' ? `
      <div class="af-alerte"><b>ℹ️ Une consultation médicale a été nécessaire.</b> Si l'accident aurait pu être plus grave, préférez l'arbre des causes.</div>` : '');
    return `
      <h2 class="af-q"><span class="af-num">1</span>Quel type d'accident ?</h2>
      ${cartesChoix(TYPES, 'type', t.type)}
      <h2 class="af-q"><span class="af-num">2</span>Où est la blessure ?</h2>
      ${cartesChoix(ZONES, 'zone', t.zone, true)}
      <h2 class="af-q"><span class="af-num">3</span>Quelles suites ?</h2>
      ${cartesChoix(SUITES, 'suites', t.suites, true)}
      ${alerte}
      <h2 class="af-q"><span class="af-num">4</span>Quand et où ?</h2>
      <div class="af-infos">
        <label>Date de l'accident<input type="date" data-champ="infos.date" value="${esc(a.infos.date)}"></label>
        <label>Lieu, secteur<input type="text" data-champ="infos.secteur" value="${esc(a.infos.secteur)}" placeholder="Ex. : atelier, poste 4"></label>
        <label>Personne concernée<input type="text" data-champ="infos.personne" value="${esc(a.infos.personne)}" placeholder="Poste ou nom"></label>
        <label>Analyse faite par<input type="text" data-champ="infos.animateur" value="${esc(a.infos.animateur)}" placeholder="Votre nom"></label>
      </div>`;
  }

  function vueRecit() {
    const type = TYPES.find(x => x.id === a.typologie.type);
    return `
      <div class="af-regle">👀 <b>Racontez seulement ce qu'on a vu ou constaté.</b> Pas de jugement sur la personne : « inattention », « maladresse » ou « erreur humaine » n'expliquent rien et n'aident pas à agir.</div>
      ${champRecit('activite', 'Que faisait la personne ?', "Ex. : elle positionnait une tôle à la main sur la table de la presse.")}
      ${champRecit('evenement', "Qu'est-ce qui s'est passé ?", type && type.id !== 'autre' ? `Ex. : ${exempleEvenement(type.id)}` : "Ex. : la pièce a glissé et lui a entaillé le doigt.")}
      ${champRecit('consequence', 'Quelle conséquence ?', 'Ex. : coupure superficielle à l\'index gauche, soignée à l\'infirmerie.')}
      <div class="af-photos">
        <div class="af-photos-titre">📷 Une photo du lieu ou de l'objet en cause <small>(facultatif, mais très utile)</small></div>
        <div class="af-photos-liste">
          ${a.photos.map((p, i) => `<figure><img src="${p}" alt="Photo ${i + 1}"><button type="button" class="af-photo-suppr" data-suppr-photo="${i}" title="Retirer la photo">×</button></figure>`).join('')}
          ${a.photos.length < MAX_PHOTOS ? '<button type="button" class="af-photo-ajout" id="btn-photo">+ Ajouter une photo</button>' : ''}
        </div>
      </div>`;
  }
  function exempleEvenement(type) {
    return {
      coupure: 'la tôle a glissé et son bord a entaillé le doigt.',
      glissade: "son pied a glissé sur une flaque d'huile, elle s'est rattrapée à la rambarde.",
      hauteur: "l'escabeau a basculé, elle est tombée de la deuxième marche.",
      choc: "en se relevant, sa tête a heurté l'angle de l'armoire.",
      coincement: 'son doigt a été pincé entre le carter et la pièce.',
      effort: "en soulevant le carton du sol, elle a ressenti une douleur dans le dos.",
      projection: "un copeau a été projeté dans son œil pendant le soufflage.",
      brulure: "son avant-bras a touché le cylindre chaud.",
      engin: "le chariot a roulé sur son pied à l'angle de l'allée."
    }[type] || '';
  }
  function champRecit(cle, question, exemple) {
    return `<label class="af-champ"><span class="af-champ-q">${question}</span>
      <textarea rows="2" data-champ="recit.${cle}" data-verifier placeholder="${esc(exemple)}">${esc(a.recit[cle])}</textarea>
      <span class="af-mot-alerte" hidden></span></label>`;
  }

  function vueFacteurs() {
    const titre = a.recit.consequence.trim() || libelle(TYPES, a.typologie.type) || "L'accident";
    const choisis = a.facteurs.map(f => f.rubrique);
    const arete = (r) => {
      const nb = choisis.filter(x => x === r.id).length;
      return `<button type="button" class="af-arete${nb ? ' choisi' : ''}" data-rubrique="${r.id}">
        <span class="af-arete-ico">${r.ico}</span><span>${esc(r.label)}</span>${nb ? `<b>${nb > 1 ? '×' + nb : '✓'}</b>` : ''}</button>`;
    };
    return `
      <h2 class="af-q">Qu'est-ce qui a permis que cet accident arrive ?</h2>
      <p class="af-aide">Touchez ce qui a joué un rôle. Si plusieurs choses ont joué dans la même famille, touchez-la plusieurs fois. ${MAX_FACTEURS} au plus : gardez les plus importantes.</p>
      <div class="af-poisson">
        <div class="af-poisson-haut">${RUBRIQUES.slice(0, 2).map(arete).join('')}</div>
        <div class="af-poisson-arete"><span></span></div>
        <div class="af-poisson-bas">${RUBRIQUES.slice(2).map(arete).join('')}</div>
        <div class="af-poisson-tete"><small>L'accident</small>${esc(titre)}</div>
      </div>
      ${a.facteurs.length ? '' : '<p class="af-vide">👆 Commencez par toucher une famille ci-dessus.</p>'}
      <div class="af-chaines">${a.facteurs.map(vueChaine).join('')}</div>`;
  }

  function vueChaine(f, i) {
    const r = rubrique(f.rubrique);
    const memes = a.facteurs.filter(g => g.rubrique === f.rubrique);
    const rang = memes.length > 1 ? ` n°${memes.indexOf(f) + 1}` : '';
    const exemples0 = [...new Set([...((EXEMPLES_PAR_TYPE[a.typologie.type] || {})[f.rubrique] || []), ...EXEMPLES_FAITS[f.rubrique]])].slice(0, 5);
    const maillons = f.chaine.map((texte, k) => {
      const question = k === 0 ? r.q : (k === 1 ? `Et qu'est-ce qui explique cela ?` : `Et derrière, qu'est-ce qui explique cela ?`);
      const exemples = k === 0 ? exemples0 : EXEMPLES_RAISONS[f.rubrique];
      const dernier = k === f.chaine.length - 1;
      const decision = dernier && texte.trim() && !f.fin ? `
        <div class="af-decision">
          <span>Peut-on agir directement là-dessus ?</span>
          <button type="button" class="btn small orange" data-fin="${f.id}">Oui, on agit là</button>
          <button type="button" class="btn small secondary" data-creuser="${f.id}">Non, il y a une raison derrière</button>
        </div>` : '';
      return `
        ${k > 0 ? '<div class="af-parce-que">parce que…</div>' : ''}
        <div class="af-maillon${dernier && f.fin ? ' cible' : ''}">
          <label class="af-champ"><span class="af-champ-q">${esc(question)}</span>
            <textarea rows="1" data-chaine="${f.id}|${k}" data-verifier placeholder="Décrivez un fait constaté">${esc(texte)}</textarea>
            <span class="af-mot-alerte" hidden></span></label>
          ${!texte.trim() && exemples.length ? `<div class="af-exemples"><small>Exemples :</small>${exemples.map(x => `<button type="button" class="af-puce" data-exemple-chaine="${f.id}|${k}">${esc(x)}</button>`).join('')}</div>` : ''}
          ${dernier && f.fin ? `<div class="af-cible-tag">🎯 C'est là qu'on agit <button type="button" class="af-lien" data-rouvrir="${f.id}">modifier</button></div>` : ''}
          ${decision}
        </div>`;
    }).join('');
    return `<article class="af-chaine" data-facteur="${f.id}">
      <header><span class="af-arete-ico">${r.ico}</span><b>${esc(r.label)}${rang}</b><button type="button" class="af-lien" data-retirer-facteur="${f.id}">Retirer</button></header>
      ${maillons}
    </article>`;
  }

  function vueActions() {
    const cibles = a.facteurs.filter(f => f.chaine[0].trim());
    return `
      <h2 class="af-q">Que fait-on concrètement pour que cela ne se reproduise pas ?</h2>
      <div class="af-echelle" title="Du plus efficace au moins efficace">
        ${NIVEAUX_ACTION.map(nv => `<span class="n${nv.n}">${esc(nv.label)}<small>${esc(nv.ex)}</small><i>${nv.pts} %</i></span>`).join('')}
      </div>
      <p class="af-aide">🎯 Plus l'action est à gauche, plus elle est efficace. Pour chaque action, indiquez son type : un score global d'efficacité se calcule avec toutes vos actions. Ajoutez-en autant que nécessaire.</p>
      ${cibles.map(f => {
        const r = rubrique(f.rubrique);
        const actions = a.actions.filter(x => x.facteur === f.id);
        return `<article class="af-bloc-action">
          <header><span class="af-arete-ico">${r.ico}</span><div><small>${esc(r.label)} · on agit sur</small><b>${esc(pointAction(f))}</b></div></header>
          ${actions.map(vueAction).join('')}
          <button type="button" class="af-ajout-action" data-ajout-action="${f.id}">+ ${actions.length ? 'Une autre action' : 'Ajouter une action'}</button>
        </article>`;
      }).join('')}
      ${blocScore()}`;
  }
  function vueAction(x) {
    const f = facteur(x.facteur);
    const exemples = f ? EXEMPLES_ACTIONS[f.rubrique] : [];
    return `<div class="af-action" data-action="${x.id}">
      <label class="af-champ"><span class="af-champ-q">Action</span>
        <textarea rows="1" data-action-champ="${x.id}|description" data-consigne placeholder="Ex. : ${esc(exemples[0] || '')}">${esc(x.description)}</textarea>
        <span class="af-mot-alerte" hidden></span></label>
      ${!x.description.trim() ? `<div class="af-exemples"><small>Idées :</small>${exemples.map(e => `<button type="button" class="af-puce" data-exemple-action="${x.id}">${esc(e)}</button>`).join('')}</div>` : ''}
      <div class="af-niveaux" role="group" aria-label="Type d'action">
        <span>Quel type d'action ?</span>
        ${NIVEAUX_ACTION.map(nv => `<button type="button" class="af-niveau n${nv.n}${Number(x.niveau) === nv.n ? ' choisi' : ''}" data-niveau="${x.id}|${nv.n}" aria-pressed="${Number(x.niveau) === nv.n}" title="${esc(nv.ex)} : ${nv.pts} %">${esc(nv.label)}</button>`).join('')}
      </div>
      <div class="af-action-ligne">
        <label>👤 Qui ?<input type="text" data-action-champ="${x.id}|responsable" value="${esc(x.responsable)}" placeholder="Responsable"></label>
        <label>📅 Pour quand ?<input type="date" data-action-champ="${x.id}|echeance" value="${esc(x.echeance)}"></label>
        <label>Où en est-on ?<select data-action-champ="${x.id}|statut">${STATUTS.map(([v, l]) => `<option value="${v}"${x.statut === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <button type="button" class="af-lien" data-suppr-action="${x.id}">Supprimer</button>
      </div>
    </div>`;
  }

  function vueBilan() {
    const p = a.potentiel;
    const risque = TYPES_A_RISQUE.includes(a.typologie.type);
    const verdict = !p ? '' : (p === 'non' ? `
      <div class="af-verdict ok"><span>✅</span><div><b>L'analyse simplifiée suffit.</b> Imprimez ou enregistrez la fiche, et suivez les actions.</div></div>` : `
      <div class="af-verdict approfondir"><span><img class="ico-pansement" src="/img/pansement.svg" alt=""></span><div><b>${p === 'oui' ? 'Il faut une analyse approfondie.' : 'Dans le doute, on approfondit.'}</b>
        Ouvrez l'arbre des causes : ce que vous avez saisi est repris, il reste à compléter en groupe.
        <button type="button" class="btn orange" id="btn-vers-arbre">Continuer dans l'arbre des causes →</button></div></div>`);
    return `
      <div class="af-potentiel no-print">
        <h2 class="af-q">Dans des circonstances un peu différentes, cet accident aurait-il pu être beaucoup plus grave ?</h2>
        <p class="af-aide">Par exemple : la main plus loin dans la machine, une chute dans l'escalier au lieu du sol plat, une charge plus lourde, une autre personne à côté…</p>
        ${risque ? `<div class="af-alerte">⚠️ Les accidents de type « ${esc(libelle(TYPES, a.typologie.type))} » peuvent souvent être graves. Prenez le temps d'y réfléchir.</div>` : ''}
        <div class="af-choix compact">
          ${[['non', '👍', 'Non'], ['oui', '⚠️', 'Oui'], ['doute', '🤔', 'Je ne sais pas']].map(([v, i, l]) => `
            <button type="button" class="af-option${p === v ? ' choisi' : ''}" data-choix="potentiel" data-valeur="${v}" aria-pressed="${p === v}"><span class="af-option-ico">${i}</span><span class="af-option-label">${l}</span></button>`).join('')}
        </div>
        ${verdict}
      </div>
      ${p ? `
        <div class="af-boutons-fiche no-print">
          <button type="button" class="btn" id="btn-imprimer">📄 Imprimer / PDF</button>
          ${modeExemple ? '' : (chantier
            ? `<button type="button" class="btn secondary" id="btn-reporter">⚑ Ajouter les actions au plan du chantier</button>`
            : '<button type="button" class="btn secondary" id="btn-chantier">Enregistrer dans un chantier</button>')}
        </div>
        ${ficheHTML()}` : ''}`;
  }

  // Le titre de la fiche (et du PDF) est l'accident lui-meme.
  function titreAccident() {
    const consequence = a.recit.consequence.trim() || a.recit.evenement.trim() || libelle(TYPES, a.typologie.type) || "Analyse d'accident";
    return [consequence, a.infos.secteur.trim(), a.infos.personne.trim()].filter(Boolean).join(' - ');
  }

  // Schema des causes (en arete de poisson) : les familles autour, l'accident a droite.
  function schemaCausesHTML() {
    const titre = a.recit.consequence.trim() || a.recit.evenement.trim() || libelle(TYPES, a.typologie.type) || "L'accident";
    const os = (r) => {
      const causes = a.facteurs.filter(f => f.rubrique === r.id && f.chaine[0].trim());
      return `<div class="af-ishi-os"><b><span>${r.ico}</span>${esc(r.label)}</b>${causes.length ? causes.map(f => {
        const remplis = f.chaine.filter(x => x.trim());
        return `<ol>${remplis.map((x, k) => `<li${k === remplis.length - 1 ? ' class="cible"' : ''}>${esc(x)}${k === remplis.length - 1 ? ' <em>🎯</em>' : ''}</li>`).join('')}</ol>`;
      }).join('') : '<p class="af-ishi-vide">Rien noté</p>'}</div>`;
    };
    return `<div class="af-ishi">
      <div class="af-ishi-haut">${RUBRIQUES.slice(0, 2).map(os).join('')}</div>
      <div class="af-ishi-arete"><span></span></div>
      <div class="af-ishi-bas">${RUBRIQUES.slice(2).map(os).join('')}</div>
      <div class="af-ishi-tete"><small>L'accident</small>${esc(titre)}</div>
    </div>`;
  }

  function ficheHTML() {
    const t = a.typologie;
    const verdict = a.potentiel === 'non' ? '✅ Analyse simplifiée suffisante'
      : (a.potentiel === 'oui' ? 'Analyse approfondie déclenchée (arbre des causes)' : 'Doute sur la gravité : analyse approfondie déclenchée');
    return `
      <div class="af-fiche">
        <div class="af-fiche-bandeau">
          <img src="/img/swm-blanc.png" alt="SWM International">
          <div class="af-fiche-titre">${esc(titreAccident())}<small>${esc([libelle(TYPES, t.type), dateFr(a.infos.date)].filter(Boolean).join(' · '))}</small></div>
        </div>
        <div class="af-fiche-infos">
          <div><small>Date</small>${esc(dateFr(a.infos.date)) || '—'}</div>
          <div><small>Lieu</small>${esc(a.infos.secteur) || '—'}</div>
          <div><small>Personne</small>${esc(a.infos.personne) || '—'}</div>
          <div><small>Analyse par</small>${esc(a.infos.animateur) || '—'}</div>
          <div><small>Type</small>${esc(libelle(TYPES, t.type)) || '—'}</div>
          <div><small>Blessure</small>${esc(libelle(ZONES, t.zone)) || '—'}</div>
          <div><small>Suites</small>${esc(libelle(SUITES, t.suites)) || '—'}</div>
        </div>
        <section class="af-fiche-schema"><h3><span>1</span>Ce qui a joué</h3>
          ${schemaCausesHTML()}
        </section>
        <section><h3><span>2</span>Ce qui s'est passé</h3>
          ${a.recit.activite ? `<p><b>La personne :</b> ${esc(a.recit.activite)}</p>` : ''}
          <p><b>L'événement :</b> ${esc(a.recit.evenement)}</p>
          ${a.recit.consequence ? `<p><b>Conséquence :</b> ${esc(a.recit.consequence)}</p>` : ''}
          ${a.photos.length ? `<div class="af-fiche-photos">${a.photos.map(p => `<img src="${p}" alt="">`).join('')}</div>` : ''}
        </section>
        <section><h3><span>3</span>Ce qu'on change</h3>
          <table><thead><tr><th>Action</th><th>Type</th><th>Responsable</th><th>Pour quand</th><th>État</th></tr></thead>
          <tbody>${a.actions.filter(x => x.description.trim()).map(x => `<tr><td>${esc(x.description)}</td><td>${niveauAction(x.niveau) ? `<span class="af-type n${x.niveau}">${esc(niveauAction(x.niveau).label)}</span>` : '—'}</td><td>${esc(x.responsable)}</td><td>${esc(dateFr(x.echeance))}</td><td>${esc((STATUTS.find(s => s[0] === x.statut) || [, ''])[1])}</td></tr>`).join('')}</tbody></table>
          ${blocScore()}
        </section>
        <div class="af-fiche-verdict ${a.potentiel === 'non' ? 'ok' : 'approfondir'}"><b>Aurait pu être beaucoup plus grave ?</b> ${a.potentiel === 'non' ? 'Non' : (a.potentiel === 'oui' ? 'Oui' : 'Je ne sais pas')} → ${verdict}</div>
      </div>`;
  }

  // Signale, sous le champ, un jugement sur la personne ou une action qui ne
  // compte que sur la vigilance. Simple conseil : rien n'est bloque.
  function verifierMots(cible) {
    const champs = cible ? [cible] : document.querySelectorAll('[data-verifier], [data-consigne]');
    champs.forEach(c => {
      const zone = c.parentElement.querySelector('.af-mot-alerte');
      if (!zone) return;
      let msg = '';
      if (c.hasAttribute('data-verifier') && MOTS_JUGEMENT.test(c.value)) {
        msg = "💡 Ce mot juge la personne. Décrivez plutôt ce qui s'est passé concrètement : qu'est-ce qu'on aurait vu ?";
      } else if (c.hasAttribute('data-consigne') && MOTS_CONSIGNE.test(c.value)) {
        msg = '💡 Un rappel ou une consigne seule change rarement les choses. Peut-on agir sur le matériel, l\'environnement de travail ou l\'organisation ?';
      }
      zone.textContent = msg;
      zone.hidden = !msg;
    });
  }
  function ajuster(t) { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

  // ---------- Actions de l'utilisateur ----------
  function aller(n) {
    if (n < 1 || n > 5) return;
    if (n > a.etape && !etapeAccessible(n)) return toast(manque(a.etape) || 'Complétez cette étape', 'error');
    a.etape = n;
    if (n === 2) preremplirConsequence();
    if (n === 4) preparerActions();
    rendre();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    sauver();
  }
  // La consequence se deduit des reponses de l'etape 1 tant qu'elle est vide.
  function preremplirConsequence() {
    if (a.recit.consequence.trim()) return;
    const zone = a.typologie.zone && a.typologie.zone !== 'aucune' ? libelle(ZONES, a.typologie.zone).toLowerCase() : '';
    const suites = libelle(SUITES, a.typologie.suites).toLowerCase();
    a.recit.consequence = a.typologie.zone === 'aucune' ? "Pas de blessure (presqu'accident)."
      : `${libelle(TYPES, a.typologie.type)}${zone ? ' (' + zone + ')' : ''} : ${suites}.`;
  }
  // Une action vide par point d'action, pour ne pas partir d'une page blanche.
  function preparerActions() {
    a.actions = a.actions.filter(x => facteur(x.facteur));
    a.facteurs.filter(f => f.chaine[0].trim()).forEach(f => {
      if (!a.actions.some(x => x.facteur === f.id)) {
        a.actions.push({ id: uid(), facteur: f.id, description: '', responsable: '', echeance: '', statut: 'a_faire', niveau: '' });
      }
    });
  }

  // Chaque appui ajoute une cause : on peut choisir plusieurs fois la meme famille.
  function ajouterFacteur(id) {
    if (a.facteurs.length >= MAX_FACTEURS) return toast(`${MAX_FACTEURS} causes au plus : gardez les plus importantes`, 'error');
    const f = { id: uid(), rubrique: id, chaine: [''], fin: false };
    a.facteurs.push(f);
    rendre(`[data-chaine="${f.id}|0"]`);
    sauver();
  }
  function retirerFacteur(fid) {
    const f = facteur(fid);
    if (!f) return;
    if (f.chaine.some(t => t.trim()) && !confirm(`Retirer cette cause (${rubrique(f.rubrique).label}) et ce que vous avez écrit ?`)) return;
    a.facteurs = a.facteurs.filter(g => g.id !== fid);
    a.actions = a.actions.filter(x => x.facteur !== fid);
    rendre();
    sauver();
  }

  function definirChamp(chemin, valeur) {
    const [groupe, cle] = chemin.split('.');
    a[groupe][cle] = valeur;
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('button, a');
    if (!b) return;
    const d = b.dataset;
    if (d.aller) {
      if (d.aller === 'suiv') aller(a.etape + 1);
      else if (d.aller === 'prec') aller(a.etape - 1);
      else aller(Number(d.aller));
    } else if (d.choix) {
      if (d.choix === 'potentiel') a.potentiel = d.valeur;
      else a.typologie[d.choix] = d.valeur;
      rendre();
      sauver();
    } else if (d.rubrique) {
      ajouterFacteur(d.rubrique);
    } else if (d.exempleChaine) {
      const [fid, k] = d.exempleChaine.split('|');
      facteur(fid).chaine[Number(k)] = b.textContent;
      rendre(`[data-chaine="${fid}|${k}"]`);
      sauver();
    } else if (d.fin) {
      facteur(d.fin).fin = true;
      rendre();
      sauver();
    } else if (d.creuser) {
      const f = facteur(d.creuser);
      f.chaine.push('');
      rendre(`[data-chaine="${f.id}|${f.chaine.length - 1}"]`);
      sauver();
    } else if (d.rouvrir) {
      const f = facteur(d.rouvrir);
      f.fin = false;
      rendre(`[data-chaine="${f.id}|${f.chaine.length - 1}"]`);
      sauver();
    } else if (d.retirerFacteur) {
      retirerFacteur(d.retirerFacteur);
    } else if (d.ajoutAction) {
      const x = { id: uid(), facteur: d.ajoutAction, description: '', responsable: '', echeance: '', statut: 'a_faire', niveau: '' };
      a.actions.push(x);
      rendre(`[data-action-champ="${x.id}|description"]`);
      sauver();
    } else if (d.exempleAction) {
      a.actions.find(x => x.id === d.exempleAction).description = b.textContent;
      rendre(`[data-action-champ="${d.exempleAction}|description"]`);
      sauver();
    } else if (d.supprAction) {
      a.actions = a.actions.filter(x => x.id !== d.supprAction);
      rendre();
      sauver();
    } else if (d.niveau) {
      const [aid, nv] = d.niveau.split('|');
      const x = a.actions.find(y => y.id === aid);
      if (x) { x.niveau = Number(x.niveau) === Number(nv) ? '' : Number(nv); rendre(); sauver(); }
    } else if (d.supprPhoto !== undefined) {
      a.photos.splice(Number(d.supprPhoto), 1);
      rendre();
      sauver();
    } else if (b.id === 'btn-photo') {
      $('input-photo').click();
    } else if (b.id === 'btn-imprimer') {
      // Le PDF prend le nom de la page : on y met la date et l'accident.
      const avant = document.title;
      const court = titreAccident().replace(/[\\/:*?"<>|.]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110);
      document.title = [dateFr(a.infos.date).split('/').join('-'), court].filter(Boolean).join(' - ');
      window.addEventListener('afterprint', () => { document.title = avant; }, { once: true });
      window.print();
    } else if (b.id === 'btn-vers-arbre') {
      versArbre();
    } else if (b.id === 'btn-chantier') {
      choisirChantier();
    } else if (b.id === 'btn-reporter') {
      reporterActions();
    }
  });

  document.addEventListener('input', (e) => {
    const c = e.target;
    const d = c.dataset;
    if (d.champ) definirChamp(d.champ, c.value);
    else if (d.chaine) {
      const [fid, k] = d.chaine.split('|');
      const f = facteur(fid);
      const avant = f.chaine[Number(k)].trim();
      f.chaine[Number(k)] = c.value;
      // Les exemples et la question suivante apparaissent ou disparaissent avec le texte.
      if (!avant !== !c.value.trim()) { rendre(`[data-chaine="${fid}|${k}"]`); sauver(); return; }
    } else if (d.actionChamp) {
      const [id, cle] = d.actionChamp.split('|');
      const x = a.actions.find(y => y.id === id);
      const avant = x.description.trim();
      x[cle] = c.value;
      if (cle === 'description' && !avant !== !c.value.trim()) { rendre(`[data-action-champ="${id}|description"]`); sauver(); return; }
    } else return;
    if (c.tagName === 'TEXTAREA') ajuster(c);
    verifierMots(c);
    rendreNavigation();
    sauver();
  });

  $('input-photo').addEventListener('change', async (e) => {
    const fichiers = [...e.target.files].slice(0, MAX_PHOTOS - a.photos.length);
    e.target.value = '';
    for (const f of fichiers) {
      try { a.photos.push(await reduirePhoto(f)); } catch (err) { toast('Photo illisible', 'error'); }
    }
    rendre();
    sauver();
  });
  // Les photos de telephone pesent plusieurs Mo : on les reduit avant de les garder.
  function reduirePhoto(fichier) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(fichier);
      img.onload = () => {
        const echelle = Math.min(1, 1000 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * echelle);
        c.height = Math.round(img.height * echelle);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  // ---------- Bascule vers l'arbre des causes ----------
  // Chaque famille devient une branche : le fait constate pres de la blessure,
  // ses explications plus a gauche, la derniere encadree comme cause racine.
  async function versArbre() {
    // Dans l'exemple, on montre l'arbre d'exemple correspondant sans toucher a l'arbre de l'utilisateur.
    if (modeExemple && approfondi) { location.href = '/arbre-causes.html?exemple=glissade'; return; }
    // La derniere reponse (« Oui ») doit etre gardee avant de quitter la page.
    if (approfondi) a.potentiel = 'oui';   // apparait « A approfondir » dans l'historique
    if (minuterie || approfondi) { clearTimeout(minuterie); await enregistrer(); }
    const plusLongue = Math.max(0, ...a.facteurs.map(f => f.chaine.filter(t => t.trim()).length));
    const COL = 210, LARGEUR = 170, NB = Math.min(20, Math.max(6, plusLongue + 1));
    const xCol = (i) => i * COL + (COL - LARGEUR) / 2;
    const branches = a.facteurs.filter(f => f.chaine[0].trim());
    const faits = [];
    const liens = [];
    const yDommage = 70 + Math.max(0, branches.length - 1) * 55;
    const dommage = {
      id: uid(), x: xCol(NB), y: yDommage, type: 'dommage', actions: [], images: [],
      texte: a.recit.consequence.trim() || a.recit.evenement.trim() || libelle(TYPES, a.typologie.type)
    };
    faits.push(dommage);
    // Sans branche (mode approfondi), l'evenement raconte devient le premier fait de l'arbre.
    if (!branches.length && a.recit.evenement.trim()) {
      const e = { id: uid(), x: xCol(NB - 1), y: yDommage, type: 'etat', texte: a.recit.evenement.trim(), actions: [], images: [] };
      faits.push(e);
      liens.push({ id: uid(), de: e.id, vers: dommage.id, pointille: false });
    }
    branches.forEach((f, i) => {
      const y = 70 + i * 110;
      let aval = dommage;
      const remplis = f.chaine.filter(t => t.trim()).slice(0, NB - 1); // l arbre accepte jusqu a 20 pourquoi
      remplis.forEach((texte, k) => {
        const n = { id: uid(), x: xCol(NB - 1 - k), y, type: 'etat', texte, actions: [], images: [] };
        if (k === remplis.length - 1) {
          n.racine = true;
          n.actions = a.actions.filter(x => x.facteur === f.id && x.description.trim())
            .map(x => ({ id: uid(), description: x.description, responsable: x.responsable, echeance: dateFr(x.echeance) }));
        }
        faits.push(n);
        liens.push({ id: uid(), de: n.id, vers: aval.id, pointille: false });
        aval = n;
      });
    });
    const arbre = {
      version: 1, nbPourquoi: NB,
      header: {
        animateur: a.infos.animateur, secteur: a.infos.secteur, date: dateFr(a.infos.date),
        evenement: a.recit.evenement.trim() || libelle(TYPES, a.typologie.type)
      },
      faits, liens
    };
    try {
      localStorage.setItem(CLE_VERS_ARBRE, JSON.stringify(arbre));
    } catch (err) {
      return toast("Impossible de préparer l'arbre des causes sur ce navigateur", 'error');
    }
    location.href = '/arbre-causes.html?depuis=flash';
  }

  // ---------- Sauvegarde ----------
  function afficherEtat(texte, erreur) {
    const e = $('etat-sauvegarde');
    e.textContent = texte;
    e.classList.toggle('erreur', !!erreur);
  }
  function sauver(delai) {
    if (modeExemple) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(enregistrer, delai == null ? 900 : delai);
  }
  // Les ecritures passent l'une apres l'autre : la creation (POST) doit avoir
  // rendu son numero avant que la suivante ne mette l'analyse a jour (PUT).
  let fileEcritures = Promise.resolve();
  function enregistrer(enPartant) {
    minuterie = null;
    fileEcritures = fileEcritures.then(() => ecrire(enPartant), () => ecrire(enPartant));
    return fileEcritures;
  }
  // Une analyse ou rien n'a encore ete saisi ne merite pas une ligne d'historique.
  function estVide() {
    return !a.typologie.type && !a.typologie.suites && !a.recit.evenement.trim() && !a.recit.activite.trim() && !a.facteurs.length;
  }
  const LIBELLES_STATUT = { brouillon: 'brouillon', terminee: 'analyse terminée', approfondie: 'à approfondir' };
  async function ecrire(enPartant) {
    if (modeExemple) return;
    if (chantier) {
      try {
        const corps = JSON.stringify({ header: enTete(), fields: { analyse: a } });
        const res = await fetch(`/api/chantiers/${chantier.id}/supports/${OUTIL_ID}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corps,
          // En quittant la page, keepalive laisse partir la requete (corps limite a 64 Ko).
          keepalive: !!enPartant && corps.length < 60000
        });
        if (!res.ok) throw new Error(res.status);
        afficherEtat(`Enregistré dans « ${chantier.titre} » à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
      } catch (err) {
        afficherEtat("Échec de l'enregistrement dans le chantier", true);
      }
      return;
    }
    if (!analyseId && estVide()) return;
    try {
      const corps = JSON.stringify({ type: 'flash', mode: approfondi ? 'approfondie' : 'simplifiee', donnees: a });
      const res = await fetch(analyseId ? `/api/securite/analyses/${encodeURIComponent(analyseId)}` : '/api/securite/analyses', {
        method: analyseId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: corps,
        keepalive: !!enPartant && corps.length < 60000
      });
      if (!res.ok) throw new Error(res.status);
      const ligne = await res.json();
      if (!analyseId) {
        // L'analyse a maintenant son numero : l'adresse de la page permet de la rouvrir.
        analyseId = String(ligne.id);
        history.replaceState(null, '', urlAnalyse(analyseId));
      }
      try { localStorage.removeItem(CLE_LOCALE); } catch (err) { /* ignore */ }
      afficherEtat(`Enregistrée à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${LIBELLES_STATUT[ligne.statut] || ''}`);
    } catch (err) {
      // Serveur injoignable : on garde l'analyse sur ce navigateur, elle partira
      // vers le serveur a la prochaine ouverture.
      try {
        localStorage.setItem(CLE_LOCALE, JSON.stringify(Object.assign({}, a, { idServeur: analyseId || null })));
        afficherEtat('Serveur injoignable : analyse gardée sur ce navigateur', true);
      } catch (e) {
        afficherEtat("Échec de l'enregistrement", true);
      }
    }
  }
  function enTete() {
    return { date: dateFr(a.infos.date), secteur: a.infos.secteur, animateur: a.infos.animateur, evenement: a.recit.evenement };
  }

  async function choisirChantier() {
    let liste;
    try { liste = await (await fetch('/api/chantiers')).json(); } catch (err) { return toast('Liste des chantiers indisponible', 'error'); }
    if (!liste.length) return toast("Aucun chantier : en créer un depuis l'onglet Chantiers Kaizen", 'error');
    const root = $('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <button class="modal-close" type="button">&times;</button>
          <h2>Enregistrer dans un chantier</h2>
          <p>L'analyse sera rattachée au chantier, et ses actions ajoutées à son plan d'action.</p>
          <select id="choix-chantier" style="width:100%;padding:8px;font:inherit">
            ${liste.map(c => `<option value="${esc(c.id)}">${esc(c.titre)}</option>`).join('')}
          </select>
          <div class="modal-actions"><button class="btn orange" type="button" id="btn-valider-chantier">Enregistrer</button></div>
        </div>
      </div>`;
    const fond = root.firstElementChild;
    const fermer = () => { root.innerHTML = ''; };
    fond.addEventListener('click', e => { if (e.target === fond) fermer(); });
    fond.querySelector('.modal-close').addEventListener('click', fermer);
    fond.querySelector('#btn-valider-chantier').addEventListener('click', async () => {
      const c = liste.find(x => String(x.id) === fond.querySelector('#choix-chantier').value);
      try {
        const res = await fetch(`/api/chantiers/${c.id}/supports/${OUTIL_ID}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ header: enTete(), fields: { analyse: a } })
        });
        if (!res.ok) throw new Error();
        if (!(c.outils || []).includes(OUTIL_ID)) {
          await fetch(`/api/chantiers/${c.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              titre: c.titre, probleme: c.probleme, perimetre: c.perimetre, pilote: c.pilote,
              equipe: c.equipe, objectif: c.objectif, outils: (c.outils || []).concat(OUTIL_ID),
              date_debut: c.date_debut, date_fin: c.date_fin, statut: c.statut
            })
          });
        }
        chantier = c;
        await reporterActions(true);
        try { localStorage.removeItem(CLE_LOCALE); } catch (err) { /* ignore */ }
        location.href = `/analyse-flash.html?chantier=${encodeURIComponent(c.id)}`;
      } catch (err) {
        toast("Échec de l'enregistrement", 'error');
      }
    });
  }

  // Ajoute au plan d'action du chantier les actions pas encore reportees.
  async function reporterActions(silencieux) {
    if (!chantier) return;
    const aReporter = a.actions.filter(x => x.description.trim() && !x.reporte);
    if (!aReporter.length) { if (!silencieux) toast('Toutes les actions sont déjà dans le plan du chantier'); return; }
    let ok = 0;
    for (const x of aReporter) {
      try {
        const res = await fetch(`/api/chantiers/${chantier.id}/actions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: x.description, responsable: x.responsable || '', echeance: x.echeance || '', statut: x.statut === 'realisee' ? 'fait' : (x.statut === 'en_cours' ? 'en_cours' : 'a_faire') })
        });
        if (res.ok) { x.reporte = true; ok++; }
      } catch (err) { /* on continue avec les suivantes */ }
    }
    await enregistrer();
    if (!silencieux) toast(ok === aReporter.length ? `${ok} action(s) ajoutée(s) au plan du chantier` : "Certaines actions n'ont pas pu être ajoutées", ok === aReporter.length ? '' : 'error');
  }

  // Rien ne doit se perdre si la page est fermee avant la sauvegarde automatique.
  window.addEventListener('pagehide', () => {
    if (minuterie) { clearTimeout(minuterie); enregistrer(true); }
  });

  // ---------- Exemple ----------
  function basculerExemple(actif) {
    if (actif === modeExemple) return;
    if (actif) {
      if (minuterie) { clearTimeout(minuterie); minuterie = null; enregistrer(); }
      analysePerso = a;
      a = normaliser(JSON.parse(JSON.stringify(approfondi ? EXEMPLE_APPROFONDI : EXEMPLE)));
      afficherEtat("Exemple : rien n'est enregistré");
    } else {
      a = analysePerso;
      analysePerso = null;
      afficherEtat('');
    }
    modeExemple = actif;
    document.body.classList.toggle('mode-exemple', actif);
    $('bandeau-exemple').hidden = !actif;
    $('btn-exemple').hidden = actif;
    $('btn-nouvelle').hidden = actif;
    rendre();
  }
  $('btn-exemple').addEventListener('click', () => basculerExemple(true));
  $('btn-quitter-exemple').addEventListener('click', () => basculerExemple(false));
  $('btn-nouvelle').addEventListener('click', async () => {
    if (chantier) {
      // Un chantier porte une seule analyse simplifiée : en commencer une autre l'efface.
      if (!confirm('Effacer l\'analyse de ce chantier et en commencer une nouvelle ?')) return;
      a = nouvelle({ secteur: chantier.perimetre || '', animateur: chantier.pilote || '' });
      rendre();
      return sauver(0);
    }
    // Hors chantier, l'analyse en cours reste dans l'historique.
    if (minuterie) { clearTimeout(minuterie); await enregistrer(); }
    location.href = urlAnalyse();
  });

  // ---------- Chargement ----------
  async function charger() {
    if (chantierId) {
      try {
        const res = await fetch(`/api/chantiers/${encodeURIComponent(chantierId)}`);
        if (!res.ok) throw new Error();
        chantier = await res.json();
      } catch (err) {
        toast('Chantier introuvable : brouillon local ouvert', 'error');
      }
    }
    if (chantier) {
      $('lien-retour').href = '/chantiers.html';
      $('lien-retour').textContent = `← Retour aux chantiers (${chantier.titre})`;
      const enregistre = (chantier.supports || {})[OUTIL_ID];
      a = enregistre && enregistre.fields && enregistre.fields.analyse
        ? normaliser(enregistre.fields.analyse)
        : nouvelle({ secteur: chantier.perimetre || '', animateur: chantier.pilote || '' });
      afficherEtat(enregistre ? `Analyse du chantier « ${chantier.titre} »` : `Nouvelle analyse pour « ${chantier.titre} »`);
    } else if (analyseId) {
      try {
        const res = await fetch(`/api/securite/analyses/${encodeURIComponent(analyseId)}`);
        if (!res.ok) throw new Error(res.status);
        const ligne = await res.json();
        a = normaliser(ligne.donnees);
        afficherEtat(`Modifiée le ${new Date(ligne.updated_at).toLocaleDateString('fr-FR')} · ${LIBELLES_STATUT[ligne.statut] || ''}`);
      } catch (err) {
        analyseId = null;
        history.replaceState(null, '', urlAnalyse());
        toast('Analyse introuvable : une nouvelle analyse est ouverte', 'error');
      }
    } else {
      // Analyse restee sur ce navigateur (serveur injoignable, ou ancienne version
      // de l'outil) : on la reprend et on l'envoie dans l'historique.
      try {
        const brouillon = JSON.parse(localStorage.getItem(CLE_LOCALE) || 'null');
        if (brouillon) {
          analyseId = brouillon.idServeur ? String(brouillon.idServeur) : null;
          if (analyseId) history.replaceState(null, '', urlAnalyse(analyseId));
          a = normaliser(brouillon);
          afficherEtat('Analyse non enregistrée reprise');
          sauver(0);
        }
      } catch (err) { /* brouillon absent ou illisible */ }
    }
    if (approfondi) {
      const h1 = document.querySelector('.af-titre h1');
      const p = document.querySelector('.af-titre p');
      if (h1) h1.innerHTML = '<img class="ico-pansement" src="/img/pansement.svg" alt=""> Analyse approfondie';
      if (p) p.textContent = "Deux étapes pour poser les faits (l'accident, puis ce qui s'est passé), puis vous construisez l'arbre des causes en groupe.";
      document.title = 'Analyse approfondie - Kaizen Toolbox';
    }
    rendre();
    if (params.get('exemple') !== null) basculerExemple(true);
  }
  charger();
})();
