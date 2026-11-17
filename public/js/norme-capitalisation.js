// Norme et capitalisation : une fiche unique qui assemble la norme de travail
// (avant / apres, parametres sous controle, etapes) et la capitalisation
// (pratiques a diffuser, fiche audit, nouveau rituel, REX).
// Enregistrement automatique dans le navigateur ; impression en A3 paysage.
(function () {
  const CLE = 'kaizen-norme-capitalisation';
  const NB_PARAMS = 4, NB_ETAPES = 9, MAX_PARAMS = 12, MAX_ETAPES = 18;

  const CAPITALISATIONS = [
    { id: 'pratiques', titre: 'Pratiques à diffuser', sous: "Ce qui a bien marché et peut servir aux autres lignes ou sites", quoi: "Quelle pratique diffuser ? Où ?" },
    { id: 'audit', titre: 'Fiche audit', sous: "Ce qu'on vérifiera lors des audits pour que la norme tienne", quoi: "Quels points contrôler à l'audit ? À quelle fréquence ?" },
    { id: 'rituel', titre: 'Nouveau rituel', sous: "Un point régulier ou un geste d'équipe à mettre en place", quoi: "Quel rituel ? (quand, où, avec qui)" },
    { id: 'rex', titre: 'REX (retour d\'expérience)', sous: "Ce qu'on retient du chantier : réussites, difficultés, conseils", quoi: "Ce qu'on retient, ce qu'on referait autrement" }
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const params = new URLSearchParams(location.search);
  const modeExemple = params.has('exemple');

  function vide() {
    return {
      chantier: '', date: new Date().toISOString().slice(0, 10), pilote: '',
      avant: '', apres: '', photoAvant: '', photoApres: '',
      params: Array.from({ length: NB_PARAMS }, () => ({ nom: '', cible: '', controle: '' })),
      etapes: Array.from({ length: NB_ETAPES }, () => ''),
      cap: Object.fromEntries(CAPITALISATIONS.map(c => [c.id, { coche: false, texte: '', qui: '', quand: '' }])),
      validePar: '', valideLe: ''
    };
  }
  const EXEMPLE = {
    chantier: 'Changement de format – ligne 3', date: '2026-11-12', pilote: 'Sophie Martin',
    avant: 'Changement de format en 52 min en moyenne, 4 réglages différents selon l\'équipe, outils cherchés à chaque fois.',
    apres: 'Changement de format en 31 min (-40 %), mêmes réglages pour toutes les équipes, chariot d\'outils dédié.',
    photoAvant: '', photoApres: '',
    params: [
      { nom: 'Durée du changement', cible: '≤ 35 min', controle: 'Chef d\'équipe, à chaque changement' },
      { nom: 'Pression de serrage', cible: '4 bar', controle: 'Opérateur, avant démarrage' },
      { nom: 'Chariot d\'outils complet', cible: '12 / 12 outils', controle: 'Chef d\'équipe, chaque début de poste' },
      { nom: '', cible: '', controle: '' }
    ],
    etapes: ['Préparer le chariot d\'outils', 'Arrêter la ligne et consigner', 'Retirer le format en place', 'Nettoyer le support', 'Monter le nouveau format', 'Régler à 4 bar', 'Faire un essai de 3 pièces', 'Valider avec le contrôle qualité', 'Redémarrer et ranger le chariot'],
    cap: {
      pratiques: { coche: true, texte: 'Chariot d\'outils dédié à étendre aux lignes 1, 2 et 4.', qui: 'Marc D.', quand: '2026-12-15' },
      audit: { coche: true, texte: 'Vérifier le chariot complet et la durée du changement ; fréquence mensuelle.', qui: 'Sophie M.', quand: '2026-12-01' },
      rituel: { coche: false, texte: '', qui: '', quand: '' },
      rex: { coche: true, texte: 'Associer les opérateurs dès le début a accéléré l\'adoption. À refaire sur les autres lignes.', qui: 'Sophie M.', quand: '2026-12-10' }
    },
    validePar: 'Directeur de production', valideLe: '2026-11-14'
  };

  // ---------- Etat ----------
  let fiche = vide();
  let enExemple = false;
  let minuteur = null;

  function charger() {
    try {
      const brut = localStorage.getItem(CLE);
      if (brut) fiche = Object.assign(vide(), JSON.parse(brut));
    } catch (e) { /* stockage indisponible : on part d'une fiche vide */ }
    // Complete les structures si une ancienne fiche est incomplete.
    const v = vide();
    CAPITALISATIONS.forEach(c => { fiche.cap = fiche.cap || {}; fiche.cap[c.id] = Object.assign({}, v.cap[c.id], fiche.cap[c.id]); });
    if (!Array.isArray(fiche.params)) fiche.params = v.params;
    if (!Array.isArray(fiche.etapes)) fiche.etapes = v.etapes;
  }
  function enregistrer() {
    if (enExemple) return;
    $('etat-sauvegarde').textContent = 'Enregistrement…';
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      try {
        localStorage.setItem(CLE, JSON.stringify(fiche));
        $('etat-sauvegarde').textContent = '✓ Enregistré sur cet ordinateur';
      } catch (e) {
        $('etat-sauvegarde').textContent = '⚠ Enregistrement impossible (photos trop lourdes ?)';
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
  function rendreParams() {
    $('params').innerHTML = fiche.params.map((p, i) => `
      <tr class="${p.nom || p.cible || p.controle ? '' : 'vide'}">
        <td><input type="text" data-p="${i}.nom" value="${esc(p.nom)}" placeholder="Ex. durée, pression…"></td>
        <td><input type="text" data-p="${i}.cible" value="${esc(p.cible)}" placeholder="Valeur à tenir"></td>
        <td><input type="text" data-p="${i}.controle" value="${esc(p.controle)}" placeholder="Qui, à quel moment"></td>
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
  function rendreCapitalisation() {
    $('capitalisation').innerHTML = CAPITALISATIONS.map(c => {
      const d = fiche.cap[c.id];
      return `
      <section class="nc-cap ${d.coche ? 'coche' : 'vide'}" data-cap="${c.id}">
        <button type="button" class="nc-cap-tete" data-bascule="${c.id}" aria-pressed="${d.coche}">
          <span class="nc-case">${d.coche ? '✓' : ''}</span>
          <span><span class="nc-cap-titre">${esc(c.titre)}</span><span class="nc-cap-sous">${esc(c.sous)}</span></span>
        </button>
        ${d.coche ? `
        <div class="nc-cap-corps">
          <textarea rows="3" data-c="${c.id}.texte" placeholder="${esc(c.quoi)}">${esc(d.texte)}</textarea>
          <div class="nc-cap-ligne">
            <input type="text" data-c="${c.id}.qui" value="${esc(d.qui)}" placeholder="Qui s'en charge">
            <input type="date" data-c="${c.id}.quand" value="${esc(d.quand)}" title="Pour quand">
          </div>
        </div>` : ''}
      </section>`;
    }).join('');
  }
  function rendreChampsSimples() {
    document.querySelectorAll('[data-f]').forEach(el => { el.value = fiche[el.dataset.f] || ''; });
  }
  function toutRendre() {
    rendreChampsSimples(); rendrePhoto('avant'); rendrePhoto('apres');
    rendreParams(); rendreEtapes(); rendreCapitalisation();
    $('bandeau-exemple').hidden = !enExemple;
  }

  // ---------- Saisie ----------
  function chemin(el, attr) {
    const [id, champ] = el.dataset[attr].split('.');
    return [id, champ];
  }
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.f !== undefined) { fiche[el.dataset.f] = el.value; }
    else if (el.dataset.p !== undefined) {
      const [i, champ] = chemin(el, 'p'); fiche.params[+i][champ] = el.value;
      el.closest('tr').classList.toggle('vide', !fiche.params[+i].nom && !fiche.params[+i].cible && !fiche.params[+i].controle);
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
    else if (b.dataset.retirerParam !== undefined) { fiche.params.splice(+b.dataset.retirerParam, 1); if (!fiche.params.length) fiche.params.push({ nom: '', cible: '', controle: '' }); rendreParams(); enregistrer(); }
    else if (b.dataset.retirerEtape !== undefined) { fiche.etapes.splice(+b.dataset.retirerEtape, 1); if (!fiche.etapes.length) fiche.etapes.push(''); rendreEtapes(); enregistrer(); }
    else if (b.dataset.bascule) { const d = fiche.cap[b.dataset.bascule]; d.coche = !d.coche; rendreCapitalisation(); enregistrer(); }
  });
  $('btn-ajout-param').addEventListener('click', () => { fiche.params.push({ nom: '', cible: '', controle: '' }); rendreParams(); enregistrer(); });
  $('btn-ajout-etape').addEventListener('click', () => { fiche.etapes.push(''); rendreEtapes(); enregistrer(); });
  $('btn-imprimer').addEventListener('click', () => window.print());

  $('btn-nouvelle').addEventListener('click', () => {
    if (enExemple) { quitterExemple(); return; }
    const rempli = JSON.stringify(fiche) !== JSON.stringify(vide());
    if (rempli && !confirm('Vider la fiche actuelle pour en commencer une nouvelle ? Cette fiche sera perdue.')) return;
    fiche = vide(); toutRendre(); enregistrer(); toast('Nouvelle fiche prête.');
  });

  // ---------- Exemple ----------
  let sauvegarde = null;
  function entrerExemple() {
    if (!enExemple) sauvegarde = JSON.stringify(fiche);
    enExemple = true; fiche = Object.assign(vide(), JSON.parse(JSON.stringify(EXEMPLE)));
    $('etat-sauvegarde').textContent = 'Exemple : rien n\'est enregistré';
    toutRendre();
  }
  function quitterExemple() {
    enExemple = false;
    fiche = sauvegarde ? Object.assign(vide(), JSON.parse(sauvegarde)) : vide();
    history.replaceState(null, '', location.pathname);
    $('etat-sauvegarde').textContent = '';
    toutRendre();
  }
  $('btn-exemple').addEventListener('click', () => { history.replaceState(null, '', '?exemple'); entrerExemple(); });
  $('btn-quitter-exemple').addEventListener('click', quitterExemple);

  // ---------- Demarrage ----------
  charger();
  if (modeExemple) entrerExemple(); else toutRendre();
})();
