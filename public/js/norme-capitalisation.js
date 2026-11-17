// Norme et capitalisation : une fiche de fin de chantier en deux parties.
//  1. Fixer la norme : avant / apres, gain, parametres sous controle, nouvelle norme en etapes.
//  2. Partager ce qu'on a appris : pratiques a diffuser, fiche audit, nouveau rituel, REX.
// Enregistrement automatique dans le navigateur ; impression en A3 paysage.
(function () {
  const CLE = 'kaizen-norme-capitalisation-v2';
  const NB_GAINS = 3, NB_PARAMS = 3, NB_ETAPES = 9, MAX_PARAMS = 8, MAX_ETAPES = 18;

  // Chaque rubrique a ses propres questions : un REX n'a pas de « qui / pour quand »,
  // une pratique a diffuser en a besoin.
  const CAPITALISATIONS = [
    { id: 'pratiques', titre: 'Pratiques à diffuser', sous: 'Ce qui a bien marché et peut servir ailleurs',
      champs: [
        { k: 'quoi', l: 'Quelle pratique faut-il diffuser ?', t: 'area', ph: 'Ex. le chariot d\'outils dédié au changement de format' },
        { k: 'ou', l: 'Où peut-elle servir ?', t: 'text', ph: 'Autres lignes, ateliers, sites' },
        { k: 'qui', l: 'Qui la diffuse ?', t: 'text', ph: 'Nom' },
        { k: 'quand', l: 'Pour quand ?', t: 'date' }
      ] },
    { id: 'audit', titre: 'Fiche audit', sous: 'Pour vérifier que la norme est toujours appliquée',
      champs: [
        { k: 'points', l: 'Quels points ajouter à la fiche d\'audit ?', t: 'area', ph: 'Ex. chariot complet, durée du changement' },
        { k: 'frequence', l: 'À quelle fréquence ?', t: 'text', ph: 'Ex. une fois par mois' },
        { k: 'qui', l: 'Qui réalise l\'audit ?', t: 'text', ph: 'Nom' }
      ] },
    { id: 'rituel', titre: 'Nouveau rituel', sous: 'Un rendez-vous régulier qui fait vivre la norme',
      champs: [
        { k: 'quoi', l: 'Quel rituel met-on en place ?', t: 'area', ph: 'Ex. point de 5 minutes en début de poste devant le tableau' },
        { k: 'frequence', l: 'À quelle fréquence ?', t: 'text', ph: 'Ex. chaque jour' },
        { k: 'qui', l: 'Qui l\'anime ?', t: 'text', ph: 'Nom' }
      ] },
    { id: 'rex', titre: 'REX (retour d\'expérience)', sous: 'Ce que ce chantier nous a appris',
      champs: [
        { k: 'bien', l: 'Ce qui a bien marché', t: 'area', ph: 'Ce qu\'il faut garder' },
        { k: 'difficile', l: 'Ce qui a été difficile', t: 'area', ph: 'Les freins, les surprises' },
        { k: 'conseil', l: 'Ce que je conseille au prochain chantier', t: 'area', ph: 'Ce qu\'on referait autrement' }
      ] }
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const params = new URLSearchParams(location.search);
  const modeExemple = params.has('exemple');
  const OUTIL_ID = 'norme-capitalisation';
  const chantierId = params.get('chantier');
  let chantier = null; // chantier auquel la fiche est rattachee, s'il y en a un

  const ligneGain = () => ({ nom: '', avant: '', apres: '', gain: '' });
  const ligneParam = () => ({ nom: '', cible: '', controle: '' });
  function capVide() {
    return Object.fromEntries(CAPITALISATIONS.map(c => [c.id, Object.assign({ coche: false }, Object.fromEntries(c.champs.map(f => [f.k, ''])))]));
  }
  function vide() {
    return {
      chantier: '', date: new Date().toISOString().slice(0, 10), pilote: '',
      avant: '', apres: '', photoAvant: '', photoApres: '',
      gains: Array.from({ length: NB_GAINS }, ligneGain),
      params: Array.from({ length: NB_PARAMS }, ligneParam),
      etapes: Array.from({ length: NB_ETAPES }, () => ''),
      cap: capVide(),
      validePar: '', valideLe: '', revueLe: ''
    };
  }

  const EXEMPLE = {
    chantier: 'Changement de format – ligne 3', date: '2026-11-12', pilote: 'Sophie Martin',
    avant: 'Changement de format en 52 min en moyenne. Quatre réglages différents selon l\'équipe, outils cherchés à chaque fois.',
    apres: 'Mêmes réglages pour toutes les équipes, chariot d\'outils dédié au poste, essai de 3 pièces avant redémarrage.',
    photoAvant: '', photoApres: '',
    gains: [
      { nom: 'Durée du changement', avant: '52 min', apres: '31 min', gain: '-40 %' },
      { nom: 'Pièces rebutées au redémarrage', avant: '14', apres: '3', gain: '-11' },
      { nom: '', avant: '', apres: '', gain: '' }
    ],
    params: [
      { nom: 'Durée du changement', cible: '35 min maximum', controle: 'Chef d\'équipe, à chaque changement' },
      { nom: 'Pression de serrage', cible: '4 bar', controle: 'Opérateur, avant démarrage' },
      { nom: 'Chariot d\'outils complet', cible: '12 outils sur 12', controle: 'Chef d\'équipe, en début de poste' }
    ],
    etapes: ['Préparer le chariot d\'outils', 'Arrêter la ligne et la consigner', 'Retirer le format en place', 'Nettoyer le support', 'Monter le nouveau format', 'Régler la pression à 4 bar', 'Faire un essai de 3 pièces', 'Faire valider l\'essai par la qualité', 'Redémarrer et ranger le chariot'],
    cap: {
      pratiques: { coche: true, quoi: 'Chariot d\'outils dédié au changement de format.', ou: 'Lignes 1, 2 et 4', qui: 'Marc Dubois', quand: '2026-12-15' },
      audit: { coche: true, points: 'Chariot complet ; durée du changement inférieure à 35 min.', frequence: 'Une fois par mois', qui: 'Sophie Martin' },
      rituel: { coche: false, quoi: '', frequence: '', qui: '' },
      rex: { coche: true, bien: 'Associer les opérateurs dès le début : la norme a été adoptée tout de suite.', difficile: 'Trouver du temps pour former les équipes de nuit.', conseil: 'Prévoir la formation de toutes les équipes avant la fin du chantier.' }
    },
    validePar: 'Directeur de production', valideLe: '2026-11-14', revueLe: '2027-02-14'
  };

  // ---------- Etat ----------
  let fiche = vide();
  let enExemple = false;
  let minuteur = null;

  function charger() {
    try {
      const brut = localStorage.getItem(CLE);
      if (brut) fiche = Object.assign(vide(), JSON.parse(brut));
    } catch (e) { /* stockage indisponible : fiche vide */ }
    completer();
  }
  // Complete les structures si une fiche enregistree est incomplete.
  function completer() {
    const v = vide();
    CAPITALISATIONS.forEach(c => { fiche.cap = fiche.cap || {}; fiche.cap[c.id] = Object.assign({}, v.cap[c.id], fiche.cap[c.id]); });
    ['gains', 'params', 'etapes'].forEach(k => { if (!Array.isArray(fiche[k]) || !fiche[k].length) fiche[k] = v[k]; });
  }
  const enTete = () => ({ chantier: fiche.chantier, pilote: fiche.pilote, date: fiche.date });
  const heure = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  function enregistrer() {
    if (enExemple) return;
    $('etat-sauvegarde').textContent = 'Enregistrement…';
    clearTimeout(minuteur);
    minuteur = setTimeout(async () => {
      try {
        if (chantier) {
          // Rattachee a un chantier : la fiche est enregistree sur le serveur avec le chantier.
          const res = await fetch('/api/chantiers/' + encodeURIComponent(chantier.id) + '/supports/' + OUTIL_ID, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ header: enTete(), fields: { fiche } })
          });
          if (!res.ok) throw new Error(res.status);
          $('etat-sauvegarde').textContent = '✓ Enregistré dans « ' + chantier.titre + ' » à ' + heure();
        } else {
          localStorage.setItem(CLE, JSON.stringify(fiche));
          $('etat-sauvegarde').textContent = '✓ Enregistré sur cet ordinateur';
        }
      } catch (e) {
        $('etat-sauvegarde').textContent = chantier ? "⚠ Échec de l'enregistrement dans le chantier" : '⚠ Enregistrement impossible (photos trop lourdes ?)';
      }
    }, 400);
  }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    $('toast-root').appendChild(t); setTimeout(() => t.remove(), 3200);
  }

  // ---------- Rendu ----------
  function rendrePhoto(cle) {
    const zone = document.querySelector(`[data-photo="${cle}"]`);
    const src = fiche[cle === 'avant' ? 'photoAvant' : 'photoApres'];
    zone.innerHTML = src
      ? `<img src="${esc(src)}" alt="Photo ${cle === 'avant' ? 'avant' : 'après'}"><button type="button" class="nc-photo-retirer no-print" data-retirer-photo="${cle}" title="Retirer la photo">✕</button>`
      : `<button type="button" class="nc-photo-ajout no-print" data-ajout-photo="${cle}">📷 Ajouter une photo</button>`;
  }
  const estVideLigne = (o) => Object.values(o).every(v => !v);
  function rendreGains() {
    $('gains').innerHTML = fiche.gains.map((g, i) => `
      <tr class="${estVideLigne(g) ? 'vide' : ''}">
        <td><input type="text" data-g="${i}.nom" value="${esc(g.nom)}" placeholder="Ex. durée du changement"></td>
        <td><input type="text" data-g="${i}.avant" value="${esc(g.avant)}" placeholder="52 min"></td>
        <td><input type="text" data-g="${i}.apres" value="${esc(g.apres)}" placeholder="31 min"></td>
        <td><input type="text" data-g="${i}.gain" value="${esc(g.gain)}" placeholder="-40 %"></td>
      </tr>`).join('');
  }
  function rendreParams() {
    $('params').innerHTML = fiche.params.map((p, i) => `
      <tr class="${estVideLigne(p) ? 'vide' : ''}">
        <td><input type="text" data-p="${i}.nom" value="${esc(p.nom)}" placeholder="Ex. pression de serrage"></td>
        <td><input type="text" data-p="${i}.cible" value="${esc(p.cible)}" placeholder="Ex. 4 bar"></td>
        <td><input type="text" data-p="${i}.controle" value="${esc(p.controle)}" placeholder="Ex. opérateur, avant démarrage"></td>
        <td class="nc-sup"><button type="button" class="nc-retirer no-print" data-retirer-param="${i}" title="Retirer cette ligne">✕</button></td>
      </tr>`).join('');
    $('btn-ajout-param').hidden = fiche.params.length >= MAX_PARAMS;
  }
  function rendreEtapes() {
    $('etapes').innerHTML = fiche.etapes.map((e, i) => `
      <li class="${e ? '' : 'vide'}">
        <span class="nc-num">${i + 1}</span>
        <textarea rows="2" data-e="${i}" placeholder="Étape ${i + 1}">${esc(e)}</textarea>
        <button type="button" class="nc-retirer no-print" data-retirer-etape="${i}" title="Retirer cette étape">✕</button>
      </li>`).join('');
    $('btn-ajout-etape').hidden = fiche.etapes.length >= MAX_ETAPES;
  }
  function rendreChamp(c, f, d) {
    const nom = `${c.id}.${f.k}`;
    const controle = f.t === 'area'
      ? `<textarea rows="3" data-c="${nom}" placeholder="${esc(f.ph || '')}">${esc(d[f.k])}</textarea>`
      : `<input type="${f.t}" data-c="${nom}" value="${esc(d[f.k])}" placeholder="${esc(f.ph || '')}">`;
    return `<label class="nc-cf nc-cf-${f.t}"><span>${esc(f.l)}</span>${controle}</label>`;
  }
  function rendreCapitalisation() {
    $('capitalisation').innerHTML = CAPITALISATIONS.map(c => {
      const d = fiche.cap[c.id];
      const grands = c.champs.filter(f => f.t === 'area').map(f => rendreChamp(c, f, d)).join('');
      const petits = c.champs.filter(f => f.t !== 'area').map(f => rendreChamp(c, f, d)).join('');
      return `
      <section class="nc-cap ${d.coche ? 'coche' : 'vide'}" data-cap="${c.id}">
        <button type="button" class="nc-cap-tete" data-bascule="${c.id}" aria-pressed="${d.coche}">
          <span class="nc-case">${d.coche ? '✓' : ''}</span>
          <span><span class="nc-cap-titre">${esc(c.titre)}</span><span class="nc-cap-sous">${esc(c.sous)}</span></span>
        </button>
        ${d.coche ? `<div class="nc-cap-corps">${grands}${petits ? `<div class="nc-cap-ligne">${petits}</div>` : ''}</div>` : ''}
      </section>`;
    }).join('');
  }
  function rendreChampsSimples() {
    document.querySelectorAll('[data-f]').forEach(el => { el.value = fiche[el.dataset.f] || ''; });
  }
  function toutRendre() {
    rendreChampsSimples(); rendrePhoto('avant'); rendrePhoto('apres');
    rendreGains(); rendreParams(); rendreEtapes(); rendreCapitalisation();
    $('bandeau-exemple').hidden = !enExemple;
  }

  // ---------- Saisie ----------
  const chemin = (el, attr) => el.dataset[attr].split('.');
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.f !== undefined) { fiche[el.dataset.f] = el.value; }
    else if (el.dataset.g !== undefined) {
      const [i, champ] = chemin(el, 'g'); fiche.gains[+i][champ] = el.value;
      el.closest('tr').classList.toggle('vide', estVideLigne(fiche.gains[+i]));
    } else if (el.dataset.p !== undefined) {
      const [i, champ] = chemin(el, 'p'); fiche.params[+i][champ] = el.value;
      el.closest('tr').classList.toggle('vide', estVideLigne(fiche.params[+i]));
    } else if (el.dataset.e !== undefined) {
      fiche.etapes[+el.dataset.e] = el.value; el.closest('li').classList.toggle('vide', !el.value);
    } else if (el.dataset.c !== undefined) {
      const [id, champ] = chemin(el, 'c'); fiche.cap[id][champ] = el.value;
    } else return;
    enregistrer();
  });

  // ---------- Photos : reduites avant stockage ----------
  let photoCible = null;
  function reduire(fichier, cb) {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1000, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => toast("Cette image n'a pas pu être lue.");
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  }
  $('input-photo').addEventListener('change', (ev) => {
    const f = ev.target.files[0]; ev.target.value = '';
    if (!f || !photoCible) return;
    const cle = photoCible;
    reduire(f, (data) => { fiche[cle === 'avant' ? 'photoAvant' : 'photoApres'] = data; rendrePhoto(cle); enregistrer(); });
  });

  // ---------- Clics ----------
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.ajoutPhoto) { photoCible = b.dataset.ajoutPhoto; $('input-photo').click(); }
    else if (b.dataset.retirerPhoto) { const c = b.dataset.retirerPhoto; fiche[c === 'avant' ? 'photoAvant' : 'photoApres'] = ''; rendrePhoto(c); enregistrer(); }
    else if (b.dataset.retirerParam !== undefined) { fiche.params.splice(+b.dataset.retirerParam, 1); if (!fiche.params.length) fiche.params.push(ligneParam()); rendreParams(); enregistrer(); }
    else if (b.dataset.retirerEtape !== undefined) { fiche.etapes.splice(+b.dataset.retirerEtape, 1); if (!fiche.etapes.length) fiche.etapes.push(''); rendreEtapes(); enregistrer(); }
    else if (b.dataset.bascule) { const d = fiche.cap[b.dataset.bascule]; d.coche = !d.coche; rendreCapitalisation(); enregistrer(); }
  });
  $('btn-ajout-param').addEventListener('click', () => { fiche.params.push(ligneParam()); rendreParams(); enregistrer(); });
  $('btn-ajout-etape').addEventListener('click', () => { fiche.etapes.push(''); rendreEtapes(); enregistrer(); });
  $('btn-imprimer').addEventListener('click', () => window.print());

  $('btn-nouvelle').addEventListener('click', () => {
    if (enExemple) { quitterExemple(); return; }
    const msg = chantier ? 'Effacer la fiche de ce chantier et en commencer une nouvelle ?' : 'Vider la fiche actuelle pour en commencer une nouvelle ? Cette fiche sera perdue.';
    if (JSON.stringify(fiche) !== JSON.stringify(vide()) && !confirm(msg)) return;
    fiche = vide(); if (chantier) { fiche.chantier = chantier.titre || ''; fiche.pilote = chantier.pilote || ''; } toutRendre(); enregistrer(); toast('Nouvelle fiche prête.');
  });

  // ---------- Exemple ----------
  let sauvegarde = null;
  function entrerExemple() {
    if (!enExemple) sauvegarde = JSON.stringify(fiche);
    enExemple = true; fiche = Object.assign(vide(), JSON.parse(JSON.stringify(EXEMPLE))); completer();
    $('etat-sauvegarde').textContent = "Exemple : rien n'est enregistré";
    toutRendre();
  }
  function quitterExemple() {
    enExemple = false;
    fiche = sauvegarde ? Object.assign(vide(), JSON.parse(sauvegarde)) : vide(); completer();
    history.replaceState(null, '', chantierId ? '?chantier=' + encodeURIComponent(chantierId) : location.pathname);
    $('etat-sauvegarde').textContent = '';
    toutRendre();
  }
  $('btn-exemple').addEventListener('click', () => { history.replaceState(null, '', chantierId ? '?chantier=' + encodeURIComponent(chantierId) + '&exemple' : '?exemple'); entrerExemple(); });
  $('btn-quitter-exemple').addEventListener('click', quitterExemple);

  // ---------- Rattacher la fiche a un chantier ----------
  async function choisirChantier() {
    let liste;
    try { liste = await (await fetch('/api/chantiers')).json(); } catch (e) { return toast('Liste des chantiers indisponible'); }
    if (!Array.isArray(liste) || !liste.length) return toast("Aucun chantier : en créer un depuis l'onglet Chantiers Kaizen");
    const fond = document.createElement('div');
    fond.className = 'modal-backdrop';
    fond.innerHTML = '<div class="modal"><button class="modal-close" type="button">&times;</button>' +
      "<h2>Enregistrer dans un chantier</h2><p>La fiche sera rattachée au chantier choisi : vous la retrouverez dans sa liste d'outils.</p>" +
      '<select id="choix-chantier" style="width:100%;padding:8px;font:inherit">' + liste.map(c => '<option value="' + esc(c.id) + '">' + esc(c.titre) + '</option>').join('') + '</select>' +
      '<div class="modal-actions"><button class="btn orange" type="button" id="btn-valider-chantier">Enregistrer</button></div></div>';
    $('modal-root').appendChild(fond);
    const fermer = () => fond.remove();
    fond.querySelector('.modal-close').addEventListener('click', fermer);
    fond.addEventListener('click', (ev) => { if (ev.target === fond) fermer(); });
    fond.querySelector('#btn-valider-chantier').addEventListener('click', async () => {
      const c = liste.find(x => String(x.id) === fond.querySelector('#choix-chantier').value);
      if (!c) return;
      try {
        const complet = await (await fetch('/api/chantiers/' + encodeURIComponent(c.id))).json();
        if (complet.supports && complet.supports[OUTIL_ID] && !confirm('Ce chantier a déjà une fiche. La remplacer par celle-ci ?')) return;
        const res = await fetch('/api/chantiers/' + encodeURIComponent(c.id) + '/supports/' + OUTIL_ID, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ header: enTete(), fields: { fiche } })
        });
        if (!res.ok) throw new Error(res.status);
        location.href = '/norme-capitalisation.html?chantier=' + encodeURIComponent(c.id);
      } catch (e) { toast("Échec de l'enregistrement dans le chantier"); }
    });
  }
  $('btn-chantier').addEventListener('click', choisirChantier);

  // ---------- Demarrage ----------
  async function demarrer() {
    if (chantierId) {
      try {
        const res = await fetch('/api/chantiers/' + encodeURIComponent(chantierId));
        if (!res.ok) throw new Error(res.status);
        chantier = await res.json();
      } catch (e) { toast('Chantier introuvable : fiche locale ouverte'); }
    }
    if (chantier) {
      $('lien-retour').href = '/chantiers.html';
      $('lien-retour').textContent = '← Retour aux chantiers (' + chantier.titre + ')';
      $('btn-chantier').hidden = true;
      const enr = (chantier.supports || {})[OUTIL_ID];
      if (enr && enr.fields && enr.fields.fiche) {
        fiche = Object.assign(vide(), enr.fields.fiche);
        $('etat-sauvegarde').textContent = 'Fiche du chantier « ' + chantier.titre + ' »';
      } else {
        fiche = vide(); fiche.chantier = chantier.titre || ''; fiche.pilote = chantier.pilote || '';
        $('etat-sauvegarde').textContent = 'Nouvelle fiche pour « ' + chantier.titre + ' »';
      }
      completer();
    } else {
      charger();
    }
    if (modeExemple) entrerExemple(); else toutRendre();
  }
  demarrer();
})();
