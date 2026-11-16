// Page d'accueil du module Securite : historique des analyses simplifiées
// (brouillons, analyses terminees, analyses a approfondir).
(function () {
  const TYPES = {
    coupure: '✂️', glissade: '🦶', hauteur: '🪜', choc: '💥', coincement: '🖐️',
    effort: '🏋️', projection: '👁️', brulure: '🔥', engin: '🚜', autre: '❔'
  };
  // Quatre cas a distinguer dans l'historique :
  //  - brouillon : analyse commencee, pas encore finie (simplifiee ou approfondie) ;
  //  - simplifiee : analyse simplifiee terminee, pas de gravite potentielle ;
  //  - passee : analyse simplifiee qui a demande une analyse approfondie ;
  //  - approfondie : analyse approfondie lancee directement (arbre des causes).
  const CATEGORIES = {
    brouillon: { label: 'Brouillon', ico: '✏️' },
    simplifiee: { label: 'Simplifiée terminée', ico: '✅' },
    passee: { label: 'Simplifiée passée en approfondie', ico: '<img class="ico-pansement" src="/img/pansement.svg" alt="">' },
    approfondie: { label: 'Approfondie', ico: '<img class="ico-pansement" src="/img/pansement.svg" alt="">' }
  };
  function categorie(x) {
    if (x.statut === 'brouillon') return 'brouillon';
    if (x.mode === 'approfondie') return 'approfondie';
    return x.statut === 'approfondie' ? 'passee' : 'simplifiee';
  }
  const $ = (id) => document.getElementById(id);
  let analyses = [];
  let filtre = 'toutes';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function dateFr(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
  }
  // « il y a 5 min », « hier », sinon la date.
  function quand(horodatage) {
    const d = new Date(horodatage);
    if (isNaN(d)) return '';
    const minutes = Math.round((Date.now() - d) / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const heures = Math.round(minutes / 60);
    if (heures < 24) return `il y a ${heures} h`;
    if (heures < 48) return 'hier';
    return `le ${d.toLocaleDateString('fr-FR')}`;
  }
  function toast(message, type) {
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' toast-error' : '');
    t.textContent = message;
    $('toast-root').appendChild(t);
    setTimeout(() => t.classList.add('toast-hide'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  function rendre() {
    const recherche = $('hist-recherche').value.trim().toLowerCase();
    document.querySelectorAll('#hist-filtres button').forEach(b => {
      const n = b.dataset.filtre === 'toutes' ? analyses.length : analyses.filter(x => categorie(x) === b.dataset.filtre).length;
      b.querySelector('b').textContent = n;
      b.classList.toggle('actif', b.dataset.filtre === filtre);
    });
    const visibles = analyses
      .filter(x => filtre === 'toutes' || categorie(x) === filtre)
      .filter(x => !recherche || [x.titre, x.secteur, x.auteur, dateFr(x.date_accident)].some(v => String(v || '').toLowerCase().includes(recherche)));
    if (!analyses.length) {
      $('hist-liste').innerHTML = `<p class="sec-vide">Aucune analyse pour l'instant. Elles apparaîtront ici dès la première saisie,
        brouillons compris. <a href="/analyse-flash.html">Commencer une analyse simplifiée →</a></p>`;
      return;
    }
    if (!visibles.length) {
      $('hist-liste').innerHTML = '<p class="sec-vide">Aucune analyse ne correspond.</p>';
      return;
    }
    $('hist-liste').innerHTML = visibles.map(x => {
      const cat = categorie(x);
      const s = CATEGORIES[cat];
      const approfondie = x.mode === 'approfondie';
      return `
        <article class="sec-ligne statut-${cat}">
          <a class="sec-ligne-lien" href="/analyse-flash.html?id=${encodeURIComponent(x.id)}${approfondie ? '&mode=approfondie' : ''}">
            <span class="sec-ligne-ico">${TYPES[x.type_accident] || '⚡'}</span>
            <span class="sec-ligne-texte">
              <b>${esc(x.titre) || '<i>Analyse sans description</i>'}</b>
              <small>${[approfondie ? 'Analyse approfondie' : 'Analyse simplifiée', dateFr(x.date_accident), x.secteur, x.auteur ? 'par ' + x.auteur : ''].filter(Boolean).map(esc).join(' · ')}</small>
            </span>
            <span class="sec-ligne-infos">
              <span class="sec-badge">${s.ico} ${s.label}</span>
              <small>${x.nb_actions ? `${x.nb_actions} action${x.nb_actions > 1 ? 's' : ''} · ` : ''}modifiée ${esc(quand(x.updated_at))}</small>
            </span>
          </a>
          <button type="button" class="sec-suppr" data-suppr="${esc(x.id)}" title="Supprimer cette analyse">🗑</button>
        </article>`;
    }).join('');
  }

  async function charger() {
    try {
      const res = await fetch('/api/securite/analyses?type=flash', { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      analyses = await res.json();
      rendre();
    } catch (err) {
      $('hist-liste').innerHTML = '<p class="sec-vide">Impossible de charger l\'historique pour le moment.</p>';
    }
  }

  $('hist-filtres').addEventListener('click', e => {
    const b = e.target.closest('button[data-filtre]');
    if (!b) return;
    filtre = b.dataset.filtre;
    rendre();
  });
  $('hist-recherche').addEventListener('input', rendre);
  $('hist-liste').addEventListener('click', async e => {
    const b = e.target.closest('[data-suppr]');
    if (!b) return;
    const x = analyses.find(y => String(y.id) === b.dataset.suppr);
    const nom = x && x.titre ? `« ${x.titre} »` : 'cette analyse';
    if (!confirm(`Supprimer définitivement ${nom} ?\n\nCette action ne peut pas être annulée.`)) return;
    try {
      const res = await fetch(`/api/securite/analyses/${encodeURIComponent(b.dataset.suppr)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(res.status);
      analyses = analyses.filter(y => String(y.id) !== b.dataset.suppr);
      rendre();
      toast('Analyse supprimée');
    } catch (err) {
      toast('Suppression impossible', 'error');
    }
  });

  charger();
})();
