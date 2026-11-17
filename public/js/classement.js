// Formulaires dynamiques d'aide à la déclaration : classement de l'événement et classement HIPO.
// Les questions s'affichent une à une selon les réponses, et le classement se calcule tout seul.
// La déclaration elle-même se fait dans Kissflow.
(function () {
  const OUI_NON = ['Oui', 'Non'];
  const BARRIERE_OK = 'Barrière prévue, indépendante et efficace';
  const DERNIERS_REMPARTS = [
    BARRIERE_OK,
    'Action humaine de rattrapage',
    'Quelques secondes / centimètres / différence de position',
    'Hasard ou circonstance fortuite',
    'Aucun rempart identifiable'
  ];

  const A_FAIRE = '/analyse-flash.html';
  const APPROFONDIE = '/analyse-flash.html?mode=approfondie';

  // ---------- Module 1 : classement de l'événement ----------
  const EVENEMENT = {
    cle: 'evenement',
    titre: "Classement de l'événement",
    sous: "Répondez aux questions : seules celles qui sont utiles s'affichent. Le classement se calcule automatiquement.",
    pied: "La typologie décrit la conséquence réellement constatée. La qualification HIPO se fait séparément, avec le classement HIPO.",
    questions: {
      q1: { n: 1, texte: "Un évènement s’est-il réellement produit ?", aide: "Ex. chute, accrochage, mouvement, déversement ou exposition.", options: OUI_NON },
      q2: { n: 2, texte: "Une personne a-t-elle été blessée ou présente-t-elle un symptôme ?", aide: "Répondre Non si seuls des biens sont touchés ou s’il n’y a aucun dommage.", options: OUI_NON },
      q3: { n: 3, texte: "S’agit-il d’un malaise ou symptôme sans lien professionnel établi ?", aide: "Sans blessure, arrêt ni soins médicaux significatifs.", options: OUI_NON },
      q4: { n: 4, texte: "Un arrêt de travail a-t-il été prescrit par un médecin ?", aide: "Un arrêt prescrit conduit au classement ATAA.", options: OUI_NON },
      q5: { n: 5, texte: "Des soins médicaux externes ont-ils été nécessaires ?", aide: "Une consultation uniquement diagnostique ne signifie pas automatiquement ATSA.", options: OUI_NON },
      q6: { n: 6, texte: "Un soin simple et immédiat a-t-il été réalisé sur place ?", aide: "Ex. nettoyage, désinfection, pansement ou froid. Réponse Non = ATB.", options: OUI_NON },
      q7: { n: 7, texte: "Des biens ou équipements ont-ils été endommagés ?", aide: "Dommages matériels sans atteinte corporelle.", options: OUI_NON },
      q8: { n: 8, texte: "Sans blessure ni dommage, l’évènement avait-il un potentiel réel de dommage ?", aide: "Un évènement déclencheur doit avoir eu lieu.", options: OUI_NON }
    },
    resultats: {
      SD: { sigle: 'SD', nom: 'Situation dangereuse', ton: 'alerte', desc: 'Risque identifié sans évènement dommageable ni potentiel caractérisé.' },
      PAT: { sigle: 'PAT', nom: 'Presqu’accident', ton: 'alerte', desc: 'Évènement sans blessure ni dommage, avec potentiel réel de dommage.' },
      ATM: { sigle: 'ATM', nom: 'Accident matériel', ton: 'neutre', desc: 'Dommages aux biens uniquement.' },
      ATAA: { sigle: 'ATAA', nom: 'Accident avec arrêt', ton: 'danger', desc: 'Atteinte corporelle avec arrêt prescrit par un médecin.' },
      ATSA: { sigle: 'ATSA', nom: 'Accident sans arrêt', ton: 'neutre', desc: 'Soins médicaux externes, sans arrêt de travail.' },
      ATPS: { sigle: 'ATPS', nom: 'Premier soin', ton: 'neutre', desc: 'Soin simple et immédiat réalisé sur place.' },
      ATB: { sigle: 'ATB', nom: 'Accident bénin', ton: 'neutre', desc: 'Blessure légère avec peu ou pas de soins.' },
      NR: { sigle: 'NR', nom: 'Malaise sans suite / Non recordable', ton: 'neutre', desc: 'Malaise ou symptôme sans lien professionnel établi.' }
    },
    // Parcours : renvoie les questions posées, dans l'ordre, et le classement dès qu'il est connu.
    parcourir(a) {
      const v = [];
      const q = (id) => { v.push(id); return a[id]; };
      let r = q('q1');
      if (!r) return { v };
      if (r === 'Non') return { v, code: 'SD' };
      r = q('q2');
      if (!r) return { v };
      if (r === 'Oui') {
        r = q('q3'); if (!r) return { v };
        if (r === 'Oui') return { v, code: 'NR' };
        r = q('q4'); if (!r) return { v };
        if (r === 'Oui') return { v, code: 'ATAA' };
        r = q('q5'); if (!r) return { v };
        if (r === 'Oui') return { v, code: 'ATSA' };
        r = q('q6'); if (!r) return { v };
        return { v, code: r === 'Oui' ? 'ATPS' : 'ATB' };
      }
      r = q('q7'); if (!r) return { v };
      if (r === 'Oui') return { v, code: 'ATM' };
      r = q('q8'); if (!r) return { v };
      return { v, code: r === 'Oui' ? 'PAT' : 'SD' };
    },
    // Niveau d'analyse prévu par le schéma « Analyser au bon niveau ».
    suite(code) {
      const hipo = { texte: "Qualifier le potentiel HIPO : le classement HIPO prévaut sur la conséquence réelle constatée.", lien: '/classement-hipo.html', bouton: 'Ouvrir le classement HIPO →' };
      if (code === 'SD') return { niveau: 'Niveau 0 · Traitement', texte: "Traiter la situation dangereuse. Si elle revient régulièrement, une analyse simplifiée est prévue.", actions: [hipo] };
      if (code === 'ATAA' || code === 'ATSA' || code === 'ATPS') {
        return { niveau: 'Niveau 2 · Analyse conjointe', texte: "Accident corporel : méthode arbre des causes. Le manager planifie, le HSE anime, le CSSCT participe.", actions: [{ texte: 'Lancer l’analyse approfondie (arbre des causes).', lien: APPROFONDIE, bouton: 'Commencer une analyse approfondie →', principal: true }, hipo] };
      }
      if (code === 'NR') return { niveau: 'Pas d’analyse', texte: "Non recordable : ce classement ne prévoit pas d’analyse.", actions: [] };
      return { niveau: 'Niveau 1 · Analyse simplifiée', texte: "Événement à faible potentiel : méthode simplifiée. Le manager pilote, avec l’appui du HSE / CSSCT.", actions: [{ texte: 'Lancer l’analyse simplifiée.', lien: A_FAIRE, bouton: 'Commencer l’analyse simplifiée →', principal: true }, hipo] };
    }
  };

  // ---------- Module 2 : classement HIPO ----------
  const HIPO = {
    cle: 'hipo',
    titre: 'Classement HIPO',
    sous: "Évaluez le scénario grave crédible, indépendamment de la conséquence réellement constatée. Seules les questions utiles s'affichent.",
    pied: "Le classement repose sur le potentiel crédible de décès ou blessure grave, l’exposition réelle et l’efficacité des barrières.",
    questions: {
      q1: { n: 1, texte: "Un évènement ou une perte de maîtrise s’est-il réellement produit ?", aide: "Ex. chute d’objet, mouvement imprévu, départ de feu, renversement ou libération d’énergie.", options: OUI_NON },
      q2: { n: 2, texte: "Aucun évènement : la situation présente-t-elle un potentiel crédible de décès ou de blessure grave avec séquelles permanentes ?", aide: "À renseigner uniquement si la réponse à la question 1 est Non.", options: OUI_NON },
      q3: { n: 3, texte: "L’évènement aurait-il pu entraîner un décès ou une blessure grave avec séquelles permanentes ?", aide: "Ex. décès, pronostic vital engagé, amputation, invalidité permanente, perte définitive d’une fonction.", options: OUI_NON },
      q4: { n: 4, texte: "Ce scénario grave découle-t-il directement des faits observés ?", aide: "Une faible variation de temps, distance, position, trajectoire ou énergie aurait suffi.", options: OUI_NON },
      q5: { n: 5, texte: "Une personne était-elle réellement exposée, ou normalement présente dans cette zone pendant l’opération ?", aide: "L’exposition doit être factuellement plausible.", options: OUI_NON },
      q6: { n: 6, texte: "Une barrière critique était-elle absente, contournée, défaillante ou inefficace ?", aide: "Ex. consignation, protecteur, séparation engin/piéton, zone d’exclusion, antichute, levage, ceinture avec ROPS.", options: OUI_NON },
      q7: { n: 7, texte: "Qu’est-ce qui a effectivement empêché le décès ou la blessure grave ?", aide: "À renseigner uniquement si aucune barrière critique n’était défaillante.", options: DERNIERS_REMPARTS, liste: true }
    },
    resultats: {
      HIPO: { sigle: '', nom: 'HIPO', ton: 'danger', desc: 'Potentiel crédible de décès ou blessure grave, exposition humaine, et barrière défaillante ou conséquence évitée par rattrapage ou circonstance fortuite.' },
      SITUATION: { sigle: '', nom: 'SITUATION DANGEREUSE À HAUT POTENTIEL', ton: 'alerte', desc: 'Aucun évènement, mais un scénario grave crédible à traiter prioritairement.' },
      NONHIPO: { sigle: '', nom: 'NON HIPO', ton: 'neutre', desc: 'Les critères HIPO ne sont pas réunis, ou une barrière prévue et efficace a maîtrisé la séquence.' }
    },
    parcourir(a) {
      const v = [];
      const q = (id) => { v.push(id); return a[id]; };
      let r = q('q1');
      if (!r) return { v };
      if (r === 'Non') {
        r = q('q2'); if (!r) return { v };
        return { v, code: r === 'Oui' ? 'SITUATION' : 'NONHIPO' };
      }
      r = q('q3'); if (!r) return { v };
      if (r === 'Non') return { v, code: 'NONHIPO' };
      r = q('q4'); if (!r) return { v };
      if (r === 'Non') return { v, code: 'NONHIPO' };
      r = q('q5'); if (!r) return { v };
      if (r === 'Non') return { v, code: 'NONHIPO' };
      r = q('q6'); if (!r) return { v };
      if (r === 'Oui') return { v, code: 'HIPO' };
      r = q('q7'); if (!r) return { v };
      return { v, code: r === BARRIERE_OK ? 'NONHIPO' : 'HIPO' };
    },
    suite(code) {
      if (code === 'HIPO' || code === 'SITUATION') {
        return {
          niveau: 'Niveau 3 · Analyse critique',
          texte: "Tout événement HIPO, corporel ou non : méthode inspirée d’ICAM. Le HSE planifie et pilote, le CSSCT et les experts participent. Cette analyse prévaut sur la conséquence réelle constatée.",
          actions: []
        };
      }
      return {
        niveau: 'Pas d’analyse critique',
        texte: "Le niveau d’analyse dépend alors du classement de l’événement.",
        actions: [{ texte: 'Classer l’événement.', lien: '/classement-evenement.html', bouton: 'Ouvrir le classement de l’événement →', principal: true }]
      };
    }
  };

  const MODULES = { evenement: EVENEMENT, hipo: HIPO };
  const module_ = MODULES[document.body.dataset.outil];
  if (!module_) return;

  const $ = (id) => document.getElementById(id);
  const CLE = 'kaizen-classement-' + module_.cle;
  let reponses = {};
  try { reponses = JSON.parse(sessionStorage.getItem(CLE) || '{}') || {}; } catch (err) { reponses = {}; }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function memoriser() {
    try { sessionStorage.setItem(CLE, JSON.stringify(reponses)); } catch (err) { /* ignore */ }
  }
  function toast(message) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    $('toast-root').appendChild(t);
    setTimeout(() => t.classList.add('toast-hide'), 2200);
    setTimeout(() => t.remove(), 2600);
  }

  function libelleResultat(r) { return r.sigle ? `${r.sigle} | ${r.nom}` : r.nom; }

  function rendreQuestion(id, derniere) {
    const q = module_.questions[id];
    const choix = reponses[id];
    const boutons = q.options.map(o => `
      <button type="button" class="cl-option${q.liste ? ' liste' : ''}${choix === o ? ' choisi' : ''}" data-q="${id}" data-v="${esc(o)}" aria-pressed="${choix === o}">${esc(o)}</button>`).join('');
    return `
      <section class="cl-question${choix ? ' repondue' : ''}${derniere && !choix ? ' en-cours' : ''}" id="q-${id}">
        <div class="cl-num">${q.n}</div>
        <div class="cl-corps">
          <h2>${esc(q.texte)}</h2>
          <p class="cl-aide">${esc(q.aide)}</p>
          <div class="cl-options${q.liste ? ' liste' : ''}" role="group" aria-label="${esc(q.texte)}">${boutons}</div>
        </div>
      </section>`;
  }

  function rendreResultat(code) {
    if (!code) {
      return `<section class="cl-resultat attente" aria-live="polite">
        <span class="cl-resultat-titre">Résultat automatique</span>
        <b>À COMPLÉTER</b>
        <p>Répondez aux questions pour obtenir le classement.</p>
      </section>`;
    }
    const r = module_.resultats[code];
    const s = module_.suite(code);
    const actions = s.actions.map(a => `
      <div class="cl-action"><span>${esc(a.texte)}</span><a class="btn${a.principal ? ' orange' : ' secondary'}" href="${esc(a.lien)}">${esc(a.bouton)}</a></div>`).join('');
    return `
      <section class="cl-resultat ${r.ton}" aria-live="polite">
        <span class="cl-resultat-titre">Résultat automatique</span>
        <b>${esc(libelleResultat(r))}</b>
        <p>${esc(r.desc)}</p>
      </section>
      <section class="cl-suite">
        <h3>Et ensuite ? <small>d’après le schéma « Analyser au bon niveau »</small></h3>
        <p><b>${esc(s.niveau)}</b> — ${esc(s.texte)}</p>
        ${actions}
      </section>
      <div class="cl-barre">
        <button type="button" class="btn secondary" id="btn-copier">📋 Copier le résumé pour Kissflow</button>
        <button type="button" class="btn secondary" id="btn-recommencer">↺ Recommencer</button>
      </div>`;
  }

  function resume(parcours) {
    const r = module_.resultats[parcours.code];
    const lignes = parcours.v.map(id => `${module_.questions[id].n}. ${module_.questions[id].texte} → ${reponses[id]}`);
    return [`${module_.titre} : ${libelleResultat(r)}`, r.desc, '', ...lignes].join('\n');
  }

  function rendre(defiler) {
    const p = module_.parcourir(reponses);
    const questions = p.v.map((id, i) => rendreQuestion(id, i === p.v.length - 1)).join('');
    const barre = p.code ? '' : '<div class="cl-barre"><button type="button" class="btn secondary" id="btn-recommencer"' + (Object.keys(reponses).length ? '' : ' hidden') + '>↺ Recommencer</button></div>';
    $('formulaire').innerHTML = `<div class="cl-grille"><div class="cl-questions">${questions}</div><aside class="cl-aside">${rendreResultat(p.code)}${barre}</aside></div>`;
    if (defiler) {
      // Côte à côte, le résultat reste visible ; sur petit écran il passe sous les questions.
      const etroit = window.matchMedia('(max-width: 980px)').matches;
      const cible = p.code ? (etroit ? document.querySelector('.cl-resultat') : null) : document.querySelector('.cl-question.en-cours');
      if (cible && cible.scrollIntoView) cible.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return p;
  }

  $('formulaire').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.q) {
      reponses[b.dataset.q] = b.dataset.v;
      memoriser();
      rendre(true);
    } else if (b.id === 'btn-recommencer') {
      reponses = {};
      memoriser();
      rendre(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (b.id === 'btn-copier') {
      const texte = resume(module_.parcourir(reponses));
      try {
        await navigator.clipboard.writeText(texte);
        toast('Résumé copié');
      } catch (err) {
        const zone = document.createElement('textarea');
        zone.value = texte;
        document.body.appendChild(zone);
        zone.select();
        try { document.execCommand('copy'); toast('Résumé copié'); } catch (e2) { toast('Copie impossible'); }
        zone.remove();
      }
    }
  });

  rendre(false);
})();
