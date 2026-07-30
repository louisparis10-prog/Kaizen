// Generation des supports pre-remplis, mis en page a l'identique des trames SWM
// (memes rubriques, meme organisation, meme entete). Le document s'ouvre dans un
// onglet dedie et s'imprime en PDF depuis cet onglet (jamais depuis l'application,
// sinon window.print() figerait la page principale).
(function () {
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Valeur saisie, ou trait de remplissage si la rubrique est restee vide.
  function val(v) {
    const t = (v == null ? '' : String(v)).trim();
    return t ? esc(t).replace(/\n/g, '<br>') : '<span class="vide"></span>';
  }

  const STYLES = `
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #202a33; margin: 0; padding: 10mm; }
    .barre-print { margin-bottom: 12px; }
    .btn-print { background: #e8722c; color: #fff; border: none; padding: 9px 18px;
      border-radius: 6px; font-size: 0.9rem; cursor: pointer; }
    .entete { display: flex; justify-content: space-between; align-items: stretch;
      gap: 12px; margin-bottom: 14px; }
    .entete-titre { background: #10243e; color: #fff; padding: 12px 22px; border-radius: 4px;
      font-size: 1.5rem; font-weight: 700; letter-spacing: 0.5px; display: flex; align-items: center; }
    .entete-titre small { display: block; font-size: 0.8rem; font-weight: 400; opacity: 0.85; }
    .entete-infos { border: 1px solid #b9c4cd; border-radius: 4px; padding: 10px 16px;
      display: grid; grid-template-columns: repeat(2, auto); gap: 4px 26px; align-content: center; }
    .entete-infos div { font-size: 0.85rem; }
    .entete-infos strong { color: #10243e; }
    .vide { display: inline-block; min-width: 120px; border-bottom: 1px dotted #98a4ae; }
    h2.section { background: #0f8b8d; color: #fff; font-size: 0.9rem; margin: 14px 0 8px;
      padding: 6px 12px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #b9c4cd; padding: 7px 9px; font-size: 0.82rem; text-align: left;
      vertical-align: top; }
    th { background: #eef2f5; color: #10243e; }
    .cellule-vide { color: #8d99a3; }

    /* 5 Pourquoi : colonnes numerotees */
    .cinq-colonnes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
    .colonne-pourquoi { display: flex; flex-direction: column; }
    .fleche-num { background: #10243e; color: #fff; font-weight: 700; text-align: center;
      padding: 6px 0; border-radius: 3px 3px 0 0; font-size: 0.85rem; }
    .colonne-pourquoi .case { border: 1px solid #b9c4cd; padding: 8px 10px;
      font-size: 0.82rem; min-height: 72px; margin-top: -1px; }
    .encadre-racine { border: 2px solid #e8722c !important; }
    .note-bas { font-size: 0.78rem; color: #5a6b78; margin-top: 10px; font-style: italic; }

    /* QQOQCCP : deux colonnes de rubriques */
    .qqoqccp-grille { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .rubrique { display: grid; grid-template-columns: 130px 1fr; border: 1px solid #b9c4cd; }
    .rubrique-libelle { background: #10243e; color: #fff; padding: 10px; font-weight: 700;
      font-size: 0.85rem; }
    .rubrique-libelle span { display: block; font-weight: 400; font-size: 0.7rem; opacity: 0.85;
      margin-top: 4px; }
    .rubrique-valeur { padding: 10px; font-size: 0.82rem; min-height: 62px; }

    /* SIPOC : cinq colonnes */
    .sipoc-grille { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .sipoc-col-titre { background: #10243e; color: #fff; text-align: center; padding: 8px;
      border-radius: 3px 3px 0 0; }
    .sipoc-col-titre .lettre { font-size: 1.5rem; font-weight: 700; line-height: 1; }
    .sipoc-col-titre .mot { font-size: 0.78rem; }
    .sipoc-question { background: #eef2f5; font-size: 0.7rem; color: #48606f; padding: 5px 8px;
      border: 1px solid #b9c4cd; border-top: none; }
    .sipoc-valeur { border: 1px solid #b9c4cd; border-top: none; padding: 10px; font-size: 0.82rem;
      min-height: 150px; }

    /* Matrice Gain / Effort : quadrants */
    .matrice { display: grid; grid-template-columns: 34px 1fr 1fr; grid-template-rows: 1fr 1fr 34px;
      gap: 6px; height: 380px; margin-top: 6px; }
    .axe-y { grid-row: 1 / 3; writing-mode: vertical-rl; transform: rotate(180deg);
      display: flex; align-items: center; justify-content: center; font-weight: 700;
      background: #10243e; color: #fff; border-radius: 3px; font-size: 0.8rem; }
    .axe-x { grid-column: 2 / 4; display: flex; align-items: center; justify-content: center;
      font-weight: 700; background: #10243e; color: #fff; border-radius: 3px; font-size: 0.8rem; }
    .quadrant { border: 1px solid #b9c4cd; border-radius: 3px; padding: 8px; overflow: hidden; }
    .quadrant h4 { margin: 0 0 6px; font-size: 0.75rem; text-transform: uppercase; color: #48606f; }
    .quadrant.gagnant { border-color: #e8722c; background: #fdf4ee; }
    .quadrant.gagnant h4 { color: #e8722c; }
    .etiquette { background: #fff; border: 1px solid #b9c4cd; border-radius: 3px;
      padding: 4px 7px; font-size: 0.78rem; margin-bottom: 5px; }

    /* Chasse aux Mudas : legende */
    .mudas-legende { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 8px; }
    .muda { border: 1px solid #b9c4cd; border-radius: 3px; padding: 6px 8px; font-size: 0.72rem; }
    .muda strong { display: block; color: #10243e; font-size: 0.75rem; }

    /* Ishikawa : arete de poisson */
    .ishikawa { position: relative; margin-top: 10px; }
    .ishikawa-effet { position: absolute; right: 0; top: 50%; transform: translateY(-50%);
      width: 165px; border: 2px solid #e8722c; border-radius: 4px; padding: 10px;
      font-size: 0.8rem; background: #fdf4ee; }
    .ishikawa-arete { position: absolute; left: 0; right: 175px; top: 50%; height: 3px;
      background: #10243e; }
    .ishikawa-branches { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      margin-right: 185px; }
    .branche { border: 1px solid #b9c4cd; border-radius: 3px; }
    .branche-titre { background: #10243e; color: #fff; padding: 5px 9px; font-size: 0.8rem;
      font-weight: 700; }
    .branche-corps { padding: 8px 9px; font-size: 0.79rem; min-height: 78px; }

    @media print { .no-print { display: none; } body { padding: 0; } }
  `;

  // Entete commune : titre de la trame + informations du chantier.
  function entete(tool, header, headerValues) {
    const infos = (header || []).map(h =>
      `<div><strong>${esc(h.label)} :</strong> ${val(headerValues[h.id])}</div>`
    ).join('');
    return `
      <div class="entete">
        <div class="entete-titre">${esc(tool.name)}</div>
        <div class="entete-infos">${infos}</div>
      </div>
    `;
  }

  // ----- Mises en page specifiques a chaque trame -----
  const LAYOUTS = {
    '5-pourquoi': (f) => {
      // Un niveau peut avoir plusieurs causes : une ligne saisie = une case,
      // comme les cases empilees de chaque colonne de la trame SWM.
      const cases = [1, 2, 3, 4, 5].map(n => {
        const causes = String(f['pourquoi' + n] || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const boites = causes.length
          ? causes.map(c => `<div class="case${n === 5 ? ' encadre-racine' : ''}">${esc(c)}</div>`).join('')
          : `<div class="case${n === 5 ? ' encadre-racine' : ''}"><span class="vide"></span></div>`;
        return `
        <div class="colonne-pourquoi">
          <div class="fleche-num">${n}</div>
          ${boites}
        </div>
      `;
      }).join('');
      return `
        <h2 class="section">Probleme de depart</h2>
        <table><tr><td>${val(f.probleme)}</td></tr></table>
        <h2 class="section">Les 5 Pourquoi</h2>
        <div class="cinq-colonnes">${cases}</div>
        <p class="note-bas">Pour faciliter la lecture : relier les cases et encadrer la cause racine
        (colonne 5, encadree en orange).</p>
      `;
    },

    'qqoqccp': (f) => {
      const RUBRIQUES = [
        ['quoi', 'QUOI', "Quel est le probleme ?"],
        ['qui', 'QUI', "Qui l'a rencontre ? Qui est concerne ?"],
        ['ou', 'OU', "Ou a-t-il ete constate ?"],
        ['quand', 'QUAND', "Quand est-il apparu ?"],
        ['combien', 'COMBIEN', "Combien de fois ? A quelle frequence ?"],
        ['comment', 'COMMENT', "Comment est-il apparu ? Dans quelles conditions ?"],
        ['pourquoi', 'POURQUOI', "Pourquoi est-ce un probleme ?"]
      ];
      const cellules = RUBRIQUES.map(([id, titre, question]) => `
        <div class="rubrique">
          <div class="rubrique-libelle">${titre}<span>${esc(question)}</span></div>
          <div class="rubrique-valeur">${val(f[id])}</div>
        </div>
      `).join('');
      return `<div class="qqoqccp-grille">${cellules}</div>`;
    },

    'sipoc': (f) => {
      const COLONNES = [
        ['suppliers', 'S', 'Fournisseurs', 'Qui fournit les entrees ?'],
        ['inputs', 'I', 'Entrees', 'Quelles entrees sont necessaires ?'],
        ['process', 'P', 'Processus', 'Quelles sont les grandes etapes ?'],
        ['outputs', 'O', 'Sorties', 'Que produit le processus ?'],
        ['customers', 'C', 'Clients', 'Qui recoit les sorties ?']
      ];
      const cols = COLONNES.map(([id, lettre, mot, question]) => `
        <div>
          <div class="sipoc-col-titre"><div class="lettre">${lettre}</div><div class="mot">${mot}</div></div>
          <div class="sipoc-question">${esc(question)}</div>
          <div class="sipoc-valeur">${val(f[id])}</div>
        </div>
      `).join('');
      return `
        <div class="sipoc-grille">${cols}</div>
        <h2 class="section">Voix du client</h2>
        <table><tr><td>${val(f.voix_client)}</td></tr></table>
        <h2 class="section">Indicateurs</h2>
        <table>
          <tr><th style="width:33%">Exigences</th><th style="width:33%">Pilotage</th><th>Resultats</th></tr>
          <tr><td>${val(f.ind_exigences)}</td><td>${val(f.ind_pilotage)}</td><td>${val(f.ind_resultats)}</td></tr>
        </table>
      `;
    },

    'matrice-gain-effort': (f) => {
      const solutions = f.solutions || [];
      // Un quadrant par croisement Gain x Effort, comme sur la trame papier.
      function quadrant(gain, effort, titre, gagnant) {
        const etiquettes = solutions
          .filter(s => (s.gain || '') === gain && (s.effort || '') === effort)
          .map(s => `<div class="etiquette">${esc(s.solution || '')}</div>`).join('');
        return `<div class="quadrant${gagnant ? ' gagnant' : ''}">
          <h4>${titre}</h4>${etiquettes || '<div class="cellule-vide">-</div>'}</div>`;
      }
      return `
        <div class="matrice">
          <div class="axe-y">GAIN ATTENDU &rarr;</div>
          ${quadrant('Fort', 'Faible', 'Gain fort / Effort faible : a lancer en premier', true)}
          ${quadrant('Fort', 'Fort', 'Gain fort / Effort fort : a planifier')}
          ${quadrant('Faible', 'Faible', 'Gain faible / Effort faible : si temps disponible')}
          ${quadrant('Faible', 'Fort', 'Gain faible / Effort fort : a ecarter')}
          <div class="axe-x">EFFORT NECESSAIRE &rarr;</div>
        </div>
        <p class="note-bas">Lancer en priorite le quadrant encadre en orange (les "quick wins").</p>
      `;
    },

    '7-gaspillages': (f) => {
      const MUDAS = [
        ['SURPRODUCTION', 'Produire plus / trop tot'],
        ['ATTENTES', "Temps d'attente, retards"],
        ['TRANSPORTS', 'Deplacements inutiles, manutention'],
        ['SUR-STOCKS', 'Stocks excessifs, en-cours'],
        ['DEPLACEMENTS', 'Mouvements inutiles des personnes'],
        ['SUR-TRAITEMENTS', 'Etapes ou controles inutiles'],
        ['DEFAUTS', 'Erreurs, rebuts, retouches'],
        ['NON-UTILISATION DES COMPETENCES', 'Idees et talents non exploites']
      ];
      const lignes = (f.gaspillages || []).map((g, i) => `
        <tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${val(g.type)}</td>
          <td>${val(g.zone)}</td>
          <td>${val(g.probleme)}</td>
          <td style="text-align:center">${val(g.impact)}</td>
        </tr>
      `).join('');
      return `
        <h2 class="section">1. Releve des gaspillages</h2>
        <table>
          <thead><tr>
            <th style="width:70px">N&deg; pastille</th><th style="width:170px">Type de Muda</th>
            <th style="width:150px">Zone / Localisation</th><th>Problematique observee</th>
            <th style="width:80px">Impact (1-5)</th>
          </tr></thead>
          <tbody>${lignes || '<tr><td colspan="5" class="cellule-vide">Aucun gaspillage releve pour le moment</td></tr>'}</tbody>
        </table>
        <h2 class="section">2. Legende des 8 Mudas</h2>
        <div class="mudas-legende">
          ${MUDAS.map(([nom, desc]) => `<div class="muda"><strong>${nom}</strong>${esc(desc)}</div>`).join('')}
        </div>
        <p class="note-bas">A chaque gaspillage identifie, poser une pastille numerotee sur le plan de
        la zone, puis reporter ce numero dans le tableau ci-dessus.</p>
      `;
    },

    'ishikawa': (f) => {
      const BRANCHES = [
        ['main_oeuvre', 'Main d\'oeuvre'], ['materiel', 'Materiel'], ['machine', 'Machine'],
        ['milieu', 'Milieu'], ['methode', 'Methode'], ['mesure', 'Mesure']
      ];
      const branches = BRANCHES.map(([id, nom]) => `
        <div class="branche">
          <div class="branche-titre">${esc(nom)}</div>
          <div class="branche-corps">${val(f[id])}</div>
        </div>
      `).join('');
      return `
        <div class="ishikawa">
          <div class="ishikawa-arete"></div>
          <div class="ishikawa-branches">${branches}</div>
          <div class="ishikawa-effet"><strong>Effet / Probleme</strong><br>${val(f.probleme)}</div>
        </div>
      `;
    }
  };

  // Mise en page generique : utilisee si un outil n'a pas encore de trame dediee.
  function layoutGenerique(tool, fieldValues) {
    return (tool.template.fields || []).map(f => {
      if (f.type === 'repeatable') {
        const lignes = (fieldValues[f.id] || []).map(r =>
          `<tr>${f.columns.map(c => `<td>${val(r[c.id])}</td>`).join('')}</tr>`).join('');
        return `<h2 class="section">${esc(f.label)}</h2>
          <table><thead><tr>${f.columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
          <tbody>${lignes || `<tr><td colspan="${f.columns.length}" class="cellule-vide">Aucune ligne</td></tr>`}</tbody></table>`;
      }
      return `<h2 class="section">${esc(f.label)}</h2>
        <table><tr><td>${val(fieldValues[f.id])}</td></tr></table>`;
    }).join('');
  }

  function generer(tool, headerValues, fieldValues) {
    const layout = LAYOUTS[tool.id];
    const corps = layout ? layout(fieldValues) : layoutGenerique(tool, fieldValues);

    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><meta charset="utf-8"><title>${esc(tool.name)} - rempli</title>
      <style>${STYLES}</style></head>
      <body>
        <div class="barre-print no-print">
          <button class="btn-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
        </div>
        ${entete(tool, tool.template.header, headerValues)}
        ${corps}
        <script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script>
      </body></html>
    `);
    w.document.close();
  }

  window.KaizenSupports = { generer };
})();
