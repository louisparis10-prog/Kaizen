// Editeur d'arbre des causes (methode INRS) sur la grille de la trame SWM
// 5 Pourquoi, etendue a 6 Pourquoi et a une colonne Blessure / dommage.
// Les faits se deplacent librement, se relient par glisser depuis leur poignee
// orange, et portent leurs actions de prevention et leurs images.
(function () {
  const OUTIL_ID = 'arbre-des-causes';
  const COL = 210;          // largeur d'une colonne (doit suivre --adc-col)
  const LARGEUR_FAIT = 170;
  const HAUT_MIN = 52;      // sous le titre de colonne
  const CLE_LOCALE = 'kaizen-arbre-causes-brouillon';

  // Nombre de Pourquoi reglable : 6 par defaut (5 Pourquoi SWM + 1).
  const NB_DEFAUT = 6, NB_MIN = 3, NB_MAX = 10;

  // De gauche a droite : le plus en amont d'abord, la blessure a droite (sens INRS).
  function colonnes() {
    const n = etat.nbPourquoi;
    const liste = [];
    for (let i = n; i >= 1; i--) {
      liste.push([`Pourquoi ${i}`, i === n ? 'le plus en amont' : (i === 1 ? 'fait le plus proche' : '')]);
    }
    liste.push(['Blessure / dommage', 'point de depart']);
    return liste;
  }
  function colDommage() { return etat.nbPourquoi; }

  const TYPES = {
    etat: 'Fait habituel (etat)',
    variation: 'Variation (fait inhabituel)',
    dommage: 'Blessure / dommage'
  };

  const params = new URLSearchParams(location.search);
  const chantierId = params.get('chantier');
  let chantier = null;

  let etat = nouvelArbre();
  let selection = null;     // { type: 'fait' | 'lien', id }
  let historique = [];
  let minuterieSauvegarde = null;
  let modeExemple = false;   // true : l'exemple est affiche, rien n'est enregistre
  let arbrePerso = null;     // arbre de l'utilisateur mis de cote pendant l'exemple
  const FICHIER_EXEMPLE = '/exemples/arbre-des-causes-glissade.json';
  // Evenements des exemples livres : un brouillon qui en est une copie n'est pas repris.
  const EVENEMENTS_EXEMPLES = ["Chute de plain-pied dans l'allée de la presse P3",
    "Main happée au rouleau presseur lors d'un dégagement de bourrage"];

  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');

  // ---------- Outils ----------
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function toast(message, type) {
    const root = $('toast-root');
    const t = el(`<div class="toast${type === 'error' ? ' toast-error' : ''}">${esc(message)}</div>`);
    root.appendChild(t);
    setTimeout(() => t.classList.add('toast-hide'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  function nouvelArbre(header, nbPourquoi) {
    const nb = nbPourquoi || NB_DEFAUT;
    return {
      version: 1,
      nbPourquoi: nb,
      header: Object.assign({ animateur: '', secteur: '', date: '', evenement: '' }, header || {}),
      faits: [{ id: uid(), x: xColonne(nb), y: 70, type: 'dommage', texte: '', actions: [], images: [] }],
      liens: []
    };
  }

  function xColonne(i) { return i * COL + (COL - LARGEUR_FAIT) / 2; }
  function colonneDe(x) {
    return Math.max(0, Math.min(colDommage(), Math.floor((x + LARGEUR_FAIT / 2) / COL)));
  }
  function fait(id) { return etat.faits.find(f => f.id === id); }
  function lien(id) { return etat.liens.find(l => l.id === id); }

  // Premiere hauteur libre dans une colonne, a partir de yDepart.
  function yLibre(col, yDepart) {
    let y = Math.max(HAUT_MIN, yDepart);
    const occupes = etat.faits.filter(f => colonneDe(f.x) === col);
    while (occupes.some(f => Math.abs(f.y - y) < 80)) y += 85;
    return y;
  }

  // ---------- Historique (Ctrl+Z) ----------
  function memoriser() {
    historique.push(JSON.stringify(etat));
    if (historique.length > 60) historique.shift();
  }

  function annuler() {
    const precedent = historique.pop();
    if (!precedent) return toast('Rien a annuler');
    etat = JSON.parse(precedent);
    if (selection && !(selection.type === 'fait' ? fait(selection.id) : lien(selection.id))) selection = null;
    toutRedessiner();
    planifierSauvegarde();
  }

  // ---------- Dessin ----------
  function dessinerColonnes() {
    const nbCol = colonnes().length;
    canvas.style.width = (nbCol * COL) + 'px';
    $('colonnes').style.gridTemplateColumns = `repeat(${nbCol}, ${COL}px)`;
    // A l'impression, l'arbre est reduit pour tenir dans la largeur d'une page A3.
    canvas.style.setProperty('--adc-zoom', Math.min(1, 1480 / (nbCol * COL)).toFixed(3));
    $('opt-nb').value = String(etat.nbPourquoi);
    const n = etat.nbPourquoi;
    $('colonnes').innerHTML = colonnes().map(([titre, sous], i) => {
      const dommage = i === colDommage();
      // Fleches numerotees comme la trame 5 Pourquoi : du vert d'eau (1) au bleu nuit (n).
      const num = n - i;
      const fleche = dommage ? '' : `--fleche:${couleurFleche(n === 1 ? 0 : (num - 1) / (n - 1))}`;
      return `
      <div class="adc-colonne${dommage ? ' dommage' : ''}" data-col="${i}">
        <div class="adc-colonne-titre">
          <div class="adc-chevron" style="${fleche}" title="${esc(titre)}">${dommage ? 'Blessure / dommage' : num}</div>
          <span class="adc-colonne-sous">${sous ? esc(sous) : '&nbsp;'}</span>
        </div>
      </div>`;
    }).join('');
  }

  // Degrade de la trame SWM : #8DB5B2, #62A7AC, #4993B4, #0062AC, #00487E.
  const DEGRADE = [[0x8d, 0xb5, 0xb2], [0x62, 0xa7, 0xac], [0x49, 0x93, 0xb4], [0x00, 0x62, 0xac], [0x00, 0x48, 0x7e]];
  function couleurFleche(t) {
    const pos = Math.max(0, Math.min(1, t)) * (DEGRADE.length - 1);
    const i = Math.min(DEGRADE.length - 2, Math.floor(pos));
    const k = pos - i;
    const c = DEGRADE[i].map((v, j) => Math.round(v + (DEGRADE[i + 1][j] - v) * k));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // ---------- Causes racines ----------
  function racines() {
    return etat.faits.filter(f => f.racine && f.type !== 'dommage')
      .sort((a, b) => colonneDe(a.x) - colonneDe(b.x) || a.y - b.y);
  }

  // Faits et liens situes entre les causes racines et la blessure (pour les faire ressortir).
  function cheminRacines() {
    const faits = new Set(racines().map(f => f.id));
    const liens = new Set();
    const pile = [...faits];
    while (pile.length) {
      const id = pile.pop();
      etat.liens.filter(l => l.de === id).forEach(l => {
        liens.add(l.id);
        if (!faits.has(l.vers)) { faits.add(l.vers); pile.push(l.vers); }
      });
    }
    return { faits, liens };
  }

  function basculerRacine(f) {
    if (!f) return;
    if (f.type === 'dommage') return toast('La blessure ne peut pas etre une cause racine', 'error');
    memoriser();
    f.racine = !f.racine;
    dessinerFaits();
    dessinerLiens();
    dessinerPanneau();
    dessinerActions();
    planifierSauvegarde();
    toast(f.racine ? 'Cause racine encadree' : 'Ce fait n\'est plus une cause racine');
  }

  function htmlFait(f, chemin) {
    const nbActions = (f.actions || []).length;
    const images = (f.images || []).slice(0, 3).map(src => `<img src="${src}" alt="">`).join('');
    const racine = f.racine && f.type !== 'dommage';
    return `
      <div class="adc-fait ${f.type}${racine ? ' racine' : ''}${chemin && chemin.faits.has(f.id) ? ' chemin' : ''}${selection && selection.type === 'fait' && selection.id === f.id ? ' selection' : ''}"
           data-id="${f.id}" style="left:${f.x}px;top:${f.y}px">
        ${racine ? '<span class="adc-racine-tag">★ Cause racine</span>' : ''}
        <div class="adc-outils no-print${f.y < 130 ? ' bas' : ''}">
          ${f.type === 'dommage' ? '' : `<button data-outil="racine" title="Encadrer comme cause racine (touche R)">${racine ? '★ Retirer' : '☆ Racine'}</button>`}
          <button data-outil="etat" title="Ajouter une cause (fait habituel) a gauche">+ Pourquoi ?</button>
          <button data-outil="variation" title="Ajouter une variation a gauche">+ Variation</button>
          <button data-outil="suppr" class="danger" title="Supprimer ce fait (Suppr)">✕</button>
        </div>
        <div class="adc-fait-texte${f.texte ? '' : ' vide'}">${f.texte ? esc(f.texte) : (f.type === 'dommage' ? 'Decrire la blessure ou le dommage' : 'Double-cliquer pour decrire le fait')}</div>
        ${images ? `<div class="adc-fait-images">${images}</div>` : ''}
        ${nbActions || (f.images || []).length > 3 ? `<div class="adc-fait-badges">
          ${nbActions ? `<span class="adc-badge">⚑ ${nbActions} action${nbActions > 1 ? 's' : ''}</span>` : ''}
          ${(f.images || []).length > 3 ? `<span class="adc-badge">+${f.images.length - 3} image(s)</span>` : ''}
        </div>` : ''}
        <span class="adc-poignee no-print" title="Glisser vers le fait qui en decoule pour les relier"></span>
      </div>`;
  }

  function dessinerFaits() {
    const chemin = cheminRacines();
    $('faits').innerHTML = etat.faits.map(f => htmlFait(f, chemin)).join('');
    $('faits').querySelectorAll('.adc-fait').forEach(brancherFait);
    ajusterHauteur();
  }

  function redessinerFait(id) {
    const ancien = $('faits').querySelector(`[data-id="${id}"]`);
    const f = fait(id);
    if (!ancien || !f) return dessinerFaits();
    const nouveau = el(htmlFait(f, cheminRacines()));
    ancien.replaceWith(nouveau);
    brancherFait(nouveau);
    ajusterHauteur();
    dessinerLiens();
  }

  function ajusterHauteur() {
    let bas = 640;
    $('faits').querySelectorAll('.adc-fait').forEach(n => {
      bas = Math.max(bas, n.offsetTop + n.offsetHeight + 160);
    });
    canvas.style.height = bas + 'px';
  }

  function boite(id) {
    const n = $('faits').querySelector(`[data-id="${id}"]`);
    const f = fait(id);
    if (!n || !f) return null;
    return { x: f.x, y: f.y, l: n.offsetWidth, h: n.offsetHeight };
  }

  // Courbe du fait cause vers le fait consequence.
  function trace(a, b) {
    const versDroite = b.x + b.l / 2 >= a.x + a.l / 2;
    const sx = versDroite ? a.x + a.l : a.x;
    const sy = a.y + a.h / 2;
    const ex = versDroite ? b.x : b.x + b.l;
    const ey = b.y + b.h / 2;
    const dx = Math.max(40, Math.abs(ex - sx) / 2) * (versDroite ? 1 : -1);
    return `M${sx},${sy} C${sx + dx},${sy} ${ex - dx},${ey} ${ex},${ey}`;
  }

  function dessinerLiens() {
    const g = $('liens-g');
    const chemin = cheminRacines();
    g.innerHTML = etat.liens.map(l => {
      const a = boite(l.de), b = boite(l.vers);
      if (!a || !b) return '';
      const d = trace(a, b);
      const actif = selection && selection.type === 'lien' && selection.id === l.id;
      return `<path class="adc-lien${l.pointille ? ' pointille' : ''}${actif ? ' actif' : ''}${chemin.liens.has(l.id) ? ' chemin' : ''}" d="${d}"
                marker-end="url(#${actif ? 'fleche-active' : 'fleche'})"></path>
              <path class="adc-lien-hit" data-lien="${l.id}" d="${d}"></path>`;
    }).join('');
    g.querySelectorAll('[data-lien]').forEach(p => {
      p.addEventListener('pointerdown', e => {
        e.stopPropagation();
        selectionner({ type: 'lien', id: p.dataset.lien });
      });
    });
  }

  function toutRedessiner() {
    dessinerColonnes();
    remplirEntete();
    dessinerFaits();
    dessinerLiens();
    dessinerPanneau();
    dessinerActions();
  }

  // ---------- Interactions sur les faits ----------
  function pointCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function surlignerColonne(col) {
    $('colonnes').querySelectorAll('.adc-colonne').forEach(c => {
      c.classList.toggle('survol', col !== null && Number(c.dataset.col) === col);
    });
  }

  function brancherFait(noeud) {
    const id = noeud.dataset.id;

    // Mini barre d'outils du fait selectionne.
    noeud.querySelectorAll('[data-outil]').forEach(b => {
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('dblclick', e => e.stopPropagation());
      b.addEventListener('click', e => {
        e.stopPropagation();
        const outil = b.dataset.outil;
        if (outil === 'racine') basculerRacine(fait(id));
        else if (outil === 'suppr') supprimerSelection();
        else ajouterFait(outil);
      });
    });

    noeud.querySelector('.adc-poignee').addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
      commencerLiaison(id, e);
    });

    noeud.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const f = fait(id);
      const depart = pointCanvas(e);
      const origine = { x: f.x, y: f.y };
      let bouge = false;
      // Garde le glisser meme si le pointeur sort du fait ; sans effet si refuse.
      try { noeud.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (!selection || selection.id !== id) selectionner({ type: 'fait', id });

      function deplacer(ev) {
        const p = pointCanvas(ev);
        const dx = p.x - depart.x, dy = p.y - depart.y;
        if (!bouge && Math.abs(dx) + Math.abs(dy) < 4) return;
        if (!bouge) { bouge = true; memoriser(); noeud.classList.add('glisse'); }
        f.x = Math.max(0, Math.min(COL * colonnes().length - LARGEUR_FAIT, origine.x + dx));
        f.y = Math.max(HAUT_MIN, origine.y + dy);
        noeud.style.left = f.x + 'px';
        noeud.style.top = f.y + 'px';
        surlignerColonne(colonneDe(f.x));
        dessinerLiens();
      }
      function lacher() {
        noeud.removeEventListener('pointermove', deplacer);
        noeud.removeEventListener('pointerup', lacher);
        noeud.removeEventListener('pointercancel', lacher);
        noeud.classList.remove('glisse');
        surlignerColonne(null);
        if (!bouge) return;
        f.x = Math.round(f.x);
        f.y = Math.round(f.y);
        noeud.style.top = f.y + 'px';
        if ($('opt-aligner').checked) {
          f.x = xColonne(colonneDe(f.x));
          noeud.style.left = f.x + 'px';
        }
        noeud.querySelector('.adc-outils').classList.toggle('bas', f.y < 130);
        ajusterHauteur();
        dessinerLiens();
        planifierSauvegarde();
      }
      noeud.addEventListener('pointermove', deplacer);
      noeud.addEventListener('pointerup', lacher);
      noeud.addEventListener('pointercancel', lacher);
    });

    noeud.addEventListener('dblclick', e => {
      e.stopPropagation();
      const zone = $('panneau').querySelector('#champ-texte');
      if (zone) { zone.focus(); zone.select(); }
    });
  }

  // Glisser depuis la poignee d'un fait vers le fait qui en decoule.
  function commencerLiaison(deId, e) {
    const temp = $('lien-temp');
    const a = boite(deId);
    let cible = null;

    function suivre(ev) {
      const p = pointCanvas(ev);
      temp.setAttribute('d', `M${a.x + a.l},${a.y + a.h / 2} L${p.x},${p.y}`);
      const sous = document.elementFromPoint(ev.clientX, ev.clientY);
      const n = sous && sous.closest('.adc-fait');
      const id = n && n.dataset.id !== deId ? n.dataset.id : null;
      if (id !== cible) {
        $('faits').querySelectorAll('.cible').forEach(x => x.classList.remove('cible'));
        cible = id;
        if (n && id) n.classList.add('cible');
      }
    }
    function fin() {
      document.removeEventListener('pointermove', suivre);
      document.removeEventListener('pointerup', fin);
      temp.setAttribute('d', '');
      $('faits').querySelectorAll('.cible').forEach(x => x.classList.remove('cible'));
      if (!cible) return;
      if (etat.liens.some(l => (l.de === deId && l.vers === cible) || (l.de === cible && l.vers === deId))) {
        return toast('Ces deux faits sont deja relies');
      }
      memoriser();
      const nouveau = { id: uid(), de: deId, vers: cible, pointille: $('opt-pointille').checked };
      etat.liens.push(nouveau);
      selection = { type: 'lien', id: nouveau.id };
      dessinerFaits();
      dessinerLiens();
      dessinerPanneau();
      planifierSauvegarde();
    }
    suivre(e);
    document.addEventListener('pointermove', suivre);
    document.addEventListener('pointerup', fin);
  }

  function selectionner(sel) {
    selection = sel;
    $('faits').querySelectorAll('.adc-fait').forEach(n => {
      n.classList.toggle('selection', !!sel && sel.type === 'fait' && n.dataset.id === sel.id);
    });
    dessinerLiens();
    dessinerPanneau();
  }

  // Ajoute un fait. Si un fait est selectionne, le nouveau en devient une cause :
  // place une colonne plus a gauche et relie vers lui (« qu'a-t-il fallu pour... ? »).
  function ajouterFait(type, position) {
    memoriser();
    const base = selection && selection.type === 'fait' ? fait(selection.id) : null;
    let col, y;
    if (position) {
      col = colonneDe(position.x - LARGEUR_FAIT / 2);
      y = Math.max(HAUT_MIN, position.y - 25);
    } else if (type === 'dommage') {
      col = colDommage();
      y = yLibre(col, 70);
    } else if (base) {
      col = Math.max(0, colonneDe(base.x) - 1);
      y = yLibre(col, base.y);
    } else {
      col = colDommage() - 1;
      y = yLibre(col, 70);
    }
    const f = {
      id: uid(),
      x: position && !$('opt-aligner').checked ? Math.max(0, position.x - LARGEUR_FAIT / 2) : xColonne(col),
      y, type, texte: '', actions: [], images: []
    };
    etat.faits.push(f);
    if (base && !position && type !== 'dommage') {
      etat.liens.push({ id: uid(), de: f.id, vers: base.id, pointille: $('opt-pointille').checked });
    }
    selection = { type: 'fait', id: f.id };
    dessinerFaits();
    dessinerLiens();
    dessinerPanneau();
    planifierSauvegarde();
    const zone = $('panneau').querySelector('#champ-texte');
    if (zone) zone.focus();
    const noeud = $('faits').querySelector(`[data-id="${f.id}"]`);
    if (noeud) noeud.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function supprimerSelection() {
    if (!selection) return;
    memoriser();
    if (selection.type === 'fait') {
      etat.faits = etat.faits.filter(f => f.id !== selection.id);
      etat.liens = etat.liens.filter(l => l.de !== selection.id && l.vers !== selection.id);
    } else {
      etat.liens = etat.liens.filter(l => l.id !== selection.id);
    }
    selection = null;
    dessinerFaits();
    dessinerLiens();
    dessinerPanneau();
    dessinerActions();
    planifierSauvegarde();
  }

  // ---------- Panneau lateral ----------
  // Bandeau d'aide qui suit ce que l'on est en train de faire.
  function majAstuce() {
    const zone = $('astuce');
    if (!zone) return;
    let texte;
    if (selection && selection.type === 'fait' && fait(selection.id)) {
      const f = fait(selection.id);
      texte = f.type === 'dommage'
        ? '<b>Etape suivante :</b> cliquez sur <b>+ Pourquoi ?</b> au-dessus de la blessure : « qu\'a-t-il fallu pour qu\'elle se produise ? »'
        : '<b>Pour relier :</b> glissez le <span class="adc-point"></span> orange vers le fait qu\'il a provoque. <b>R</b> encadre la cause racine, <b>Suppr</b> efface.';
    } else if (selection && selection.type === 'lien') {
      texte = 'Lien selectionne : rendez-le <b>pointille</b> s\'il est incertain, ou inversez son sens dans le panneau.';
    } else if (etat.faits.length <= 1) {
      texte = '<b>Pour commencer :</b> decrivez la blessure (cadre rouge), puis cliquez dessus et remontez les causes avec <b>+ Pourquoi ?</b> — ou regardez d\'abord <b>💡 l\'exemple</b>.';
    } else {
      texte = 'Cliquez sur un fait pour le modifier. <b>Double-clic</b> dans une colonne pour poser un fait a cet endroit.';
    }
    zone.innerHTML = '<span class="adc-astuce-ico">💡</span><span>' + texte + '</span>';
  }

  function dessinerPanneau() {
    majAstuce();
    const p = $('panneau');
    if (selection && selection.type === 'fait' && fait(selection.id)) return panneauFait(p, fait(selection.id));
    if (selection && selection.type === 'lien' && lien(selection.id)) return panneauLien(p, lien(selection.id));
    p.innerHTML = `
      <h3>Comment construire l'arbre</h3>
      <ol class="adc-etapes">
        <li><b>Decrire la blessure</b> ou le dommage dans la colonne rouge.</li>
        <li><b>Remonter les causes</b> : cliquer sur un fait puis <b>+ Pourquoi ?</b> — la cause s'ajoute a gauche, deja reliee.</li>
        <li><b>Relier</b> : glisser le rond orange d'un fait vers le fait qu'il a provoque. Plusieurs fleches vers un fait = il a fallu tout cela (ET).</li>
        <li><b>Encadrer les causes racines</b> (☆ Racine) et leur associer des actions.</li>
      </ol>
      <button class="adc-exemple-btn" data-vue="exemple">💡 Voir un exemple<small>Glissade sur une flaque d'huile : 5 Pourquoi, 3 causes racines</small></button>
      <h4>Legende INRS</h4>
      <div class="adc-legende">
        <div><i></i> Fait habituel (etat)</div>
        <div><i class="ovale"></i> Variation (fait inhabituel)</div>
        <div><i class="dommage"></i> Blessure / dommage</div>
        <div><i class="racine"></i> Cause racine</div>
        <div><i class="trait"></i> Lien etabli</div>
        <div><i class="pointille"></i> Lien incertain</div>
      </div>
      <p class="adc-aide">Des faits, pas d'interpretations : « il travaillait en baskets » plutot que
      « il ne portait pas ses chaussures de securite ».</p>`;
  }

  function panneauFait(p, f) {
    const aChantier = !!chantier;
    const racine = f.racine && f.type !== 'dommage';
    p.innerHTML = `
      <div class="adc-panneau-tete ${f.type}">
        <span class="adc-pastille ${f.type}"></span>
        <div><h3>${esc(TYPES[f.type])}</h3><small>${esc(colonnes()[colonneDe(f.x)][0])}</small></div>
      </div>
      <label for="champ-texte">Description du fait</label>
      <textarea id="champ-texte" placeholder="Un fait observable, sans jugement">${esc(f.texte)}</textarea>
      <label for="champ-type">Nature</label>
      <select id="champ-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${k === f.type ? ' selected' : ''}>${v}</option>`).join('')}</select>
      ${f.type === 'dommage' ? '' : `
      <button class="adc-racine-btn${racine ? ' actif' : ''}" id="btn-racine" title="Touche R">
        ${racine ? '★ Cause racine — cliquer pour retirer' : '☆ Marquer comme cause racine'}
      </button>`}
      <div class="ligne">
        <button class="btn small" id="btn-cause" title="Ajoute une cause une colonne plus a gauche, reliee a ce fait">+ Pourquoi ?</button>
        <button class="btn small secondary" id="btn-cause-variation">+ Variation</button>
        <button class="btn small danger" id="btn-suppr-fait">Supprimer</button>
      </div>

      <h4>⚑ Actions de prevention</h4>
      <div id="liste-actions">${(f.actions || []).map(a => `
        <div class="adc-action">
          <div class="adc-action-tete">
            <span>${esc(a.description)}</span>
            <button class="btn danger small" data-suppr-action="${a.id}" title="Supprimer">&times;</button>
          </div>
          <small>${esc(a.responsable || 'Responsable a definir')}${a.echeance ? ' · ' + esc(a.echeance) : ''}</small>
          ${aChantier ? (a.reporte
            ? '<small>Reportee au plan d\'action du chantier</small>'
            : `<button class="btn secondary small" style="margin-top:5px" data-reporter="${a.id}">Reporter au plan d'action</button>`) : ''}
        </div>`).join('') || '<p class="adc-vide">Aucune action sur ce fait.</p>'}</div>
      <label for="action-desc">Nouvelle action</label>
      <input type="text" id="action-desc" placeholder="Ex. : capoter le tambour de retour">
      <label for="action-resp">Responsable</label>
      <input type="text" id="action-resp">
      <label for="action-ech">Echeance</label>
      <input type="date" id="action-ech">
      <div class="ligne"><button class="btn small orange" id="btn-ajout-action">Ajouter l'action</button></div>

      <h4>🖼 Images</h4>
      <div class="adc-images">${(f.images || []).map((src, i) => `
        <figure><img src="${src}" alt="" data-voir="${i}"><button data-suppr-image="${i}" title="Retirer">&times;</button></figure>`).join('')}</div>
      <div class="ligne"><button class="btn small secondary" id="btn-image">+ Image</button></div>`;

    const texte = p.querySelector('#champ-texte');
    texte.addEventListener('focus', memoriser, { once: true });
    texte.addEventListener('input', () => {
      f.texte = texte.value;
      redessinerFait(f.id);
      dessinerActions();
      planifierSauvegarde();
    });
    p.querySelector('#champ-type').addEventListener('change', e => {
      memoriser();
      f.type = e.target.value;
      if (f.type === 'dommage') f.racine = false;
      dessinerFaits();
      dessinerLiens();
      panneauFait(p, f);
      dessinerActions();
      planifierSauvegarde();
    });
    const btnRacine = p.querySelector('#btn-racine');
    if (btnRacine) btnRacine.addEventListener('click', () => basculerRacine(f));
    p.querySelector('#btn-cause').addEventListener('click', () => ajouterFait('etat'));
    p.querySelector('#btn-cause-variation').addEventListener('click', () => ajouterFait('variation'));
    p.querySelector('#btn-suppr-fait').addEventListener('click', supprimerSelection);

    p.querySelector('#btn-ajout-action').addEventListener('click', () => {
      const desc = p.querySelector('#action-desc').value.trim();
      if (!desc) return toast("Decrire l'action avant de l'ajouter", 'error');
      memoriser();
      f.actions = f.actions || [];
      f.actions.push({
        id: uid(), description: desc,
        responsable: p.querySelector('#action-resp').value.trim(),
        echeance: p.querySelector('#action-ech').value
      });
      redessinerFait(f.id);
      panneauFait(p, f);
      dessinerActions();
      planifierSauvegarde();
    });
    p.querySelector('#action-desc').addEventListener('keydown', e => {
      if (e.key === 'Enter') p.querySelector('#btn-ajout-action').click();
    });
    p.querySelectorAll('[data-suppr-action]').forEach(b => b.addEventListener('click', () => {
      memoriser();
      f.actions = f.actions.filter(a => a.id !== b.dataset.supprAction);
      redessinerFait(f.id);
      panneauFait(p, f);
      dessinerActions();
      planifierSauvegarde();
    }));
    p.querySelectorAll('[data-reporter]').forEach(b => b.addEventListener('click', () => {
      reporterAction(f, f.actions.find(a => a.id === b.dataset.reporter));
    }));

    p.querySelector('#btn-image').addEventListener('click', () => {
      const input = $('input-image');
      input.value = '';
      input.onchange = () => ajouterImages(f, Array.from(input.files));
      input.click();
    });
    p.querySelectorAll('[data-suppr-image]').forEach(b => b.addEventListener('click', () => {
      memoriser();
      f.images.splice(Number(b.dataset.supprImage), 1);
      redessinerFait(f.id);
      panneauFait(p, f);
      planifierSauvegarde();
    }));
    p.querySelectorAll('[data-voir]').forEach(img => img.addEventListener('click', () => voirImage(img.src)));
  }

  function panneauLien(p, l) {
    const de = fait(l.de), vers = fait(l.vers);
    p.innerHTML = `
      <h3>Lien</h3>
      <p class="adc-aide"><strong>${esc((de && de.texte) || 'Fait')}</strong><br>a ete necessaire pour<br>
      <strong>${esc((vers && vers.texte) || 'Fait')}</strong></p>
      <label class="adc-case"><input type="checkbox" id="lien-pointille"${l.pointille ? ' checked' : ''}> Lien incertain (en pointille)</label>
      <div class="ligne">
        <button class="btn small secondary" id="btn-inverser">Inverser le sens</button>
        <button class="btn small danger" id="btn-suppr-lien">Supprimer le lien</button>
      </div>`;
    p.querySelector('#lien-pointille').addEventListener('change', e => {
      memoriser();
      l.pointille = e.target.checked;
      dessinerLiens();
      planifierSauvegarde();
    });
    p.querySelector('#btn-inverser').addEventListener('click', () => {
      memoriser();
      [l.de, l.vers] = [l.vers, l.de];
      dessinerLiens();
      panneauLien(p, l);
      planifierSauvegarde();
    });
    p.querySelector('#btn-suppr-lien').addEventListener('click', supprimerSelection);
  }

  // ---------- Images ----------
  // Reduite a 1000 px et recompressee : l'arbre complet reste leger a enregistrer.
  function reduireImage(fichier) {
    return new Promise((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onerror = reject;
      lecteur.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const ratio = Math.min(1, 1000 / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * ratio);
          c.height = Math.round(img.height * ratio);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.8));
        };
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    });
  }

  async function ajouterImages(f, fichiers) {
    const images = fichiers.filter(x => x.type.startsWith('image/'));
    if (!images.length) return;
    try {
      const sources = await Promise.all(images.map(reduireImage));
      memoriser();
      f.images = (f.images || []).concat(sources);
      redessinerFait(f.id);
      if (selection && selection.id === f.id) dessinerPanneau();
      planifierSauvegarde();
    } catch (err) {
      toast("Image illisible", 'error');
    }
  }

  function voirImage(src) {
    const v = el(`<div class="adc-visionneuse"><img src="${src}" alt=""></div>`);
    v.addEventListener('click', () => v.remove());
    document.body.appendChild(v);
  }

  // ---------- Tableau des actions ----------
  function dessinerRacines() {
    const zone = $('liste-racines');
    const liste = racines();
    const btn = $('btn-racines');
    if (btn) btn.querySelector('b').textContent = liste.length;
    if (!liste.length) {
      canvas.classList.remove('focus-racines');
      if (btn) { btn.classList.remove('actif'); btn.setAttribute('aria-pressed', 'false'); }
      zone.innerHTML = '<p class="adc-vide">Aucune cause racine encadree : cliquer sur un fait puis sur « ☆ Racine ».</p>';
      return;
    }
    zone.innerHTML = `<ol class="adc-racines">${liste.map(f => {
      const actions = f.actions || [];
      return `
        <li data-aller="${f.id}" title="Afficher dans l'arbre">
          <div class="adc-racine-texte">${esc(f.texte || '(fait sans description)')}
            <small>${esc(colonnes()[colonneDe(f.x)][0])} · ${f.type === 'variation' ? 'variation' : 'fait habituel'}</small></div>
          <div class="adc-racine-actions">${actions.length
            ? actions.map(a => `<span>⚑ ${esc(a.description)}</span>`).join('')
            : '<em>Aucune action : en proposer une</em>'}</div>
        </li>`;
    }).join('')}</ol>`;
    zone.querySelectorAll('[data-aller]').forEach(li => li.addEventListener('click', () => {
      selectionner({ type: 'fait', id: li.dataset.aller });
      const n = $('faits').querySelector(`[data-id="${li.dataset.aller}"]`);
      if (n) n.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }));
  }

  function dessinerActions() {
    dessinerRacines();
    const lignes = [];
    etat.faits.forEach(f => (f.actions || []).forEach(a => lignes.push({ f, a })));
    const zone = $('tableau-actions');
    if (!lignes.length) {
      zone.innerHTML = '<p class="adc-vide">Selectionner un fait pour lui associer une action de prevention.</p>';
      return;
    }
    zone.innerHTML = `
      <table class="adc-table">
        <thead><tr><th style="width:28%">Fait vise</th><th>Action</th><th style="width:16%">Responsable</th>
          <th style="width:12%">Echeance</th>${chantier ? '<th style="width:14%" class="no-print">Plan d\'action</th>' : ''}</tr></thead>
        <tbody>${lignes.map(({ f, a }) => `
          <tr>
            <td>${f.racine && f.type !== 'dommage' ? '<span class="adc-mini-racine" title="Cause racine">★</span> ' : ''}${esc(f.texte || '(fait sans description)')} <small>(${esc(colonnes()[colonneDe(f.x)][0])})</small></td>
            <td>${esc(a.description)}</td>
            <td>${esc(a.responsable)}</td>
            <td>${esc(a.echeance)}</td>
            ${chantier ? `<td class="no-print">${a.reporte ? 'Reportee' : `<button class="btn secondary small" data-tab-reporter="${f.id}|${a.id}">Reporter</button>`}</td>` : ''}
          </tr>`).join('')}</tbody>
      </table>`;
    zone.querySelectorAll('[data-tab-reporter]').forEach(b => b.addEventListener('click', () => {
      const [fid, aid] = b.dataset.tabReporter.split('|');
      const f = fait(fid);
      reporterAction(f, f && f.actions.find(a => a.id === aid));
    }));
  }

  async function reporterAction(f, a) {
    if (!chantier || !f || !a) return;
    try {
      const res = await fetch(`/api/chantiers/${chantier.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: a.description, responsable: a.responsable || '', echeance: a.echeance || '', statut: 'a_faire' })
      });
      if (!res.ok) throw new Error();
      a.reporte = true;
      dessinerPanneau();
      dessinerActions();
      planifierSauvegarde(0);
      toast("Action ajoutee au plan d'action du chantier");
    } catch (err) {
      toast("Impossible de reporter l'action", 'error');
    }
  }

  // ---------- Entete ----------
  function remplirEntete() {
    document.querySelectorAll('[data-header]').forEach(input => {
      input.value = etat.header[input.dataset.header] || '';
      ajusterChamp(input);
    });
  }

  // Les zones de texte de l'entete grandissent avec leur contenu au lieu de le couper.
  function ajusterChamp(champ) {
    if (champ.tagName !== 'TEXTAREA') return;
    champ.style.height = 'auto';
    champ.style.height = champ.scrollHeight + 'px';
  }
  window.addEventListener('resize', () => document.querySelectorAll('textarea[data-header]').forEach(ajusterChamp));

  // ---------- Sauvegarde ----------
  function afficherEtat(texte, erreur) {
    const e = $('etat-sauvegarde');
    e.textContent = texte;
    e.classList.toggle('erreur', !!erreur);
  }

  function planifierSauvegarde(delai) {
    if (modeExemple) return afficherEtat('Exemple : rien n\'est enregistre');
    clearTimeout(minuterieSauvegarde);
    afficherEtat('Modifications en cours...');
    minuterieSauvegarde = setTimeout(sauvegarder, delai == null ? 1200 : delai);
  }

  async function sauvegarder() {
    minuterieSauvegarde = null;
    if (modeExemple) return;
    if (chantier) {
      try {
        const corps = JSON.stringify({ header: etat.header, fields: { arbre: etat } });
        if (corps.length > 14 * 1024 * 1024) {
          return afficherEtat("Trop d'images : l'arbre depasse 14 Mo et ne peut pas etre enregistre", true);
        }
        const res = await fetch(`/api/chantiers/${chantier.id}/supports/${OUTIL_ID}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corps
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
        afficherEtat(`Enregistre dans le chantier « ${chantier.titre} » a ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
      } catch (err) {
        afficherEtat("Echec de l'enregistrement dans le chantier : " + err.message, true);
      }
      return;
    }
    try {
      localStorage.setItem(CLE_LOCALE, JSON.stringify(etat));
      afficherEtat('Brouillon enregistre sur ce navigateur');
    } catch (err) {
      afficherEtat("Brouillon trop lourd pour ce navigateur : exporter l'arbre ou l'enregistrer dans un chantier", true);
    }
  }

  function valide(donnees) {
    return donnees && Array.isArray(donnees.faits) && Array.isArray(donnees.liens);
  }

  function normaliser(donnees) {
    const nb = Number(donnees.nbPourquoi);
    const n = nouvelArbre(null, nb >= NB_MIN && nb <= NB_MAX ? nb : NB_DEFAUT);
    n.header = Object.assign(n.header, donnees.header || {});
    n.faits = donnees.faits.map(f => Object.assign({ actions: [], images: [], texte: '', type: 'etat' }, f));
    const ids = new Set(n.faits.map(f => f.id));
    n.liens = donnees.liens.filter(l => ids.has(l.de) && ids.has(l.vers));
    return n;
  }

  async function choisirChantier() {
    let liste;
    try {
      liste = await (await fetch('/api/chantiers')).json();
    } catch (err) {
      return toast('Liste des chantiers indisponible', 'error');
    }
    if (!liste.length) return toast("Aucun chantier : en creer un depuis l'onglet Chantiers Kaizen", 'error');
    const root = $('modal-root');
    root.innerHTML = '';
    const fond = el(`
      <div class="modal-backdrop">
        <div class="modal">
          <button class="modal-close">&times;</button>
          <h2>Enregistrer dans un chantier</h2>
          <p>L'arbre sera rattache au chantier et l'outil ajoute a sa liste s'il n'y figure pas.</p>
          <select id="choix-chantier" style="width:100%;padding:8px;font:inherit">
            ${liste.map(c => `<option value="${c.id}">${esc(c.titre)}</option>`).join('')}
          </select>
          <div class="modal-actions"><button class="btn orange" id="btn-valider-chantier">Enregistrer</button></div>
        </div>
      </div>`);
    fond.addEventListener('click', e => { if (e.target === fond) root.innerHTML = ''; });
    fond.querySelector('.modal-close').addEventListener('click', () => { root.innerHTML = ''; });
    fond.querySelector('#btn-valider-chantier').addEventListener('click', async () => {
      const c = liste.find(x => String(x.id) === fond.querySelector('#choix-chantier').value);
      try {
        const res = await fetch(`/api/chantiers/${c.id}/supports/${OUTIL_ID}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ header: etat.header, fields: { arbre: etat } })
        });
        if (!res.ok) throw new Error();
        // L'outil doit figurer parmi ceux du chantier pour y apparaitre.
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
        try { localStorage.removeItem(CLE_LOCALE); } catch (err) { /* ignore */ }
        location.href = `/arbre-causes.html?chantier=${c.id}`;
      } catch (err) {
        toast("Echec de l'enregistrement", 'error');
      }
    });
    root.appendChild(fond);
  }

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
      $('btn-enregistrer').textContent = 'Enregistrer maintenant';
      const enregistre = (chantier.supports || {})[OUTIL_ID];
      if (enregistre && enregistre.fields && valide(enregistre.fields.arbre)) {
        etat = normaliser(enregistre.fields.arbre);
      } else {
        etat = nouvelArbre({
          animateur: chantier.pilote || '', secteur: chantier.perimetre || '',
          date: chantier.date_debut || '', evenement: chantier.probleme || ''
        });
      }
      afficherEtat(enregistre ? `Arbre du chantier « ${chantier.titre} »` : `Nouvel arbre pour le chantier « ${chantier.titre} »`);
    } else {
      try {
        const brouillon = JSON.parse(localStorage.getItem(CLE_LOCALE) || 'null');
        // Ancien comportement : l'exemple pouvait remplacer le brouillon. On repart alors d'un arbre vierge.
        const copieExemple = brouillon && brouillon.header && EVENEMENTS_EXEMPLES.includes(brouillon.header.evenement);
        if (copieExemple) localStorage.removeItem(CLE_LOCALE);
        else if (valide(brouillon)) { etat = normaliser(brouillon); afficherEtat('Brouillon repris'); }
      } catch (err) { /* brouillon absent ou illisible */ }
    }
    toutRedessiner();
    if (params.get('exemple') !== null) basculerExemple(true);
  }

  // Change le nombre de Pourquoi. Les faits gardent leur niveau par rapport a la
  // blessure : toutes les colonnes se decalent ensemble.
  function changerNombre(nb) {
    const ancien = etat.nbPourquoi;
    if (nb === ancien) return;
    const niveauMax = Math.max(0, ...etat.faits.map(f => ancien - colonneDe(f.x)));
    if (nb < niveauMax) {
      $('opt-nb').value = String(ancien);
      return toast(`Un fait occupe le Pourquoi ${niveauMax} : le deplacer avant de reduire a ${nb}`, 'error');
    }
    memoriser();
    etat.faits.forEach(f => { f.x += (nb - ancien) * COL; });
    etat.nbPourquoi = nb;
    toutRedessiner();
    planifierSauvegarde();
  }

  // ---------- Branchements ----------
  for (let i = NB_MIN; i <= NB_MAX; i++) {
    $('opt-nb').appendChild(new Option(`${i} Pourquoi`, String(i)));
  }
  $('opt-nb').addEventListener('change', e => changerNombre(Number(e.target.value)));
  dessinerColonnes();

  $('btn-etat').addEventListener('click', () => ajouterFait('etat'));
  $('btn-variation').addEventListener('click', () => ajouterFait('variation'));
  $('btn-dommage').addEventListener('click', () => ajouterFait('dommage'));
  $('btn-annuler').addEventListener('click', annuler);

  // ---------- Exemple : vue a part, jamais enregistree ----------
  // L'exemple s'affiche a la place de l'arbre de l'utilisateur sans l'ecraser :
  // on garde son arbre de cote et on le remet en revenant sur « Mon arbre ».
  let exempleCache = null;
  async function basculerExemple(actif) {
    if (actif === modeExemple) return;
    if (actif) {
      try {
        if (!exempleCache) {
          const res = await fetch(FICHIER_EXEMPLE);
          if (!res.ok) throw new Error();
          exempleCache = await res.json();
        }
      } catch (err) {
        return toast("Impossible de charger l'exemple", 'error');
      }
      // Enregistre tout de suite ce qui etait en attente sur l'arbre de l'utilisateur.
      if (minuterieSauvegarde) { clearTimeout(minuterieSauvegarde); minuterieSauvegarde = null; await sauvegarder(); }
      arbrePerso = { etat, historique, statut: $('etat-sauvegarde').textContent };
      etat = normaliser(JSON.parse(JSON.stringify(exempleCache)));
      historique = [];
      modeExemple = true;
    } else {
      etat = arbrePerso.etat;
      historique = arbrePerso.historique;
      modeExemple = false;
    }
    selection = null;
    canvas.classList.remove('focus-racines');
    $('btn-racines').classList.remove('actif');
    document.body.classList.toggle('mode-exemple', modeExemple);
    $('vue-perso').classList.toggle('actif', !modeExemple);
    $('vue-exemple').classList.toggle('actif', modeExemple);
    $('vue-perso').setAttribute('aria-pressed', String(!modeExemple));
    $('vue-exemple').setAttribute('aria-pressed', String(modeExemple));
    toutRedessiner();
    afficherEtat(modeExemple ? 'Exemple : rien n\'est enregistre' : (arbrePerso.statut || ''));
    if (!modeExemple) arbrePerso = null;
  }
  $('vue-perso').addEventListener('click', () => basculerExemple(false));
  $('vue-exemple').addEventListener('click', () => basculerExemple(true));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-vue]');
    if (b) basculerExemple(b.dataset.vue === 'exemple');
  });
  $('btn-imprimer').addEventListener('click', () => { selectionner(null); setTimeout(() => window.print(), 50); });
  $('btn-enregistrer').addEventListener('click', () => {
    if (modeExemple) return toast('Revenez sur « Mon arbre » pour enregistrer votre arbre', 'error');
    if (chantier) planifierSauvegarde(0);
    else choisirChantier();
  });
  $('btn-vider').addEventListener('click', () => {
    if (!confirm("Effacer tout l'arbre ? (Annuler permet de revenir en arriere)")) return;
    memoriser();
    etat = nouvelArbre(etat.header, etat.nbPourquoi);
    selection = null;
    toutRedessiner();
    planifierSauvegarde();
  });
  $('btn-exporter').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(etat, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arbre-des-causes.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('btn-importer').addEventListener('click', () => {
    const input = $('input-import');
    input.value = '';
    input.onchange = async () => {
      try {
        const donnees = JSON.parse(await input.files[0].text());
        if (!valide(donnees)) throw new Error();
        if (modeExemple) await basculerExemple(false);
        memoriser();
        etat = normaliser(donnees);
        selection = null;
        toutRedessiner();
        planifierSauvegarde();
        toast('Arbre importe');
      } catch (err) {
        toast("Ce fichier n'est pas un arbre des causes exporte", 'error');
      }
    };
    input.click();
  });

  document.querySelectorAll('[data-header]').forEach(input => {
    input.addEventListener('focus', memoriser, { once: true });
    input.addEventListener('input', () => {
      etat.header[input.dataset.header] = input.value;
      ajusterChamp(input);
      planifierSauvegarde();
    });
  });

  // Faire apparaitre les causes racines : le reste de l'arbre passe au second plan.
  $('btn-racines').addEventListener('click', () => {
    if (!racines().length) return toast('Aucune cause racine : cliquer sur un fait puis sur « ☆ Racine »', 'error');
    const actif = !canvas.classList.contains('focus-racines');
    canvas.classList.toggle('focus-racines', actif);
    $('btn-racines').classList.toggle('actif', actif);
    $('btn-racines').setAttribute('aria-pressed', String(actif));
  });

  // Clic dans le vide : deselection ; double-clic : nouveau fait a cet endroit.
  canvas.addEventListener('pointerdown', e => {
    if (e.target.closest('.adc-fait')) return;
    if (selection) selectionner(null);
  });
  canvas.addEventListener('dblclick', e => {
    if (e.target.closest('.adc-fait')) return;
    const p = pointCanvas(e);
    selection = null;
    ajouterFait(colonneDe(p.x - LARGEUR_FAIT / 2) === colDommage() ? 'dommage' : 'etat', p);
  });

  // Deposer une image directement sur un fait.
  canvas.addEventListener('dragover', e => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
  });
  canvas.addEventListener('drop', e => {
    const n = e.target.closest('.adc-fait');
    if (!n || !e.dataTransfer.files.length) return;
    e.preventDefault();
    ajouterImages(fait(n.dataset.id), Array.from(e.dataTransfer.files));
  });

  document.addEventListener('keydown', e => {
    const saisie = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !saisie) {
      e.preventDefault();
      annuler();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !saisie && selection) {
      e.preventDefault();
      supprimerSelection();
    } else if (e.key === 'Escape' && selection) {
      selectionner(null);
    } else if (e.key.toLowerCase() === 'r' && !saisie && !e.ctrlKey && !e.metaKey && selection && selection.type === 'fait') {
      basculerRacine(fait(selection.id));
    }
  });

  window.addEventListener('beforeunload', () => {
    if (minuterieSauvegarde) { clearTimeout(minuterieSauvegarde); sauvegarder(); }
  });

  charger();
})();
