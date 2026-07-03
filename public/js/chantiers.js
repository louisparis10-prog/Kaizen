(function () {
  let tools = [];
  let chantiers = [];
  let editingId = null;
  let selectedOutils = [];

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function show(viewId) {
    ['view-list', 'view-form', 'view-detail'].forEach(id => {
      document.getElementById(id).style.display = id === viewId ? 'block' : 'none';
    });
  }

  function statutLabel(s) {
    return { en_cours: 'En cours', termine: 'Termine' }[s] || s;
  }
  function actionStatutLabel(s) {
    return { a_faire: 'A faire', en_cours: 'En cours', fait: 'Fait', bloque: 'Bloque' }[s] || s;
  }

  // ---------- Tableau de bord ----------
  async function loadDashboard() {
    const res = await fetch('/api/dashboard');
    const d = await res.json();
    renderDashboard(d);
  }

  function renderDashboard(d) {
    const wrap = document.getElementById('dashboard');
    const enCours = d.chantiersParStatut.en_cours || 0;
    const termine = d.chantiersParStatut.termine || 0;
    const gainHtml = d.gainMoyen === null
      ? '<span class="dash-value">-</span>'
      : `<span class="dash-value ${d.gainMoyen >= 0 ? 'gain-positive' : 'gain-negative'}">${d.gainMoyen >= 0 ? '-' : '+'}${Math.abs(d.gainMoyen).toFixed(0)}%</span>`;

    wrap.innerHTML = '';
    const box = el(`
      <div class="dashboard-grid">
        <div class="dash-card">
          <div class="dash-label">Chantiers en cours</div>
          <div class="dash-value">${enCours}</div>
        </div>
        <div class="dash-card">
          <div class="dash-label">Chantiers termines</div>
          <div class="dash-value">${termine}</div>
        </div>
        <div class="dash-card${d.actionsEnRetard.length ? ' dash-alert' : ''}">
          <div class="dash-label">Actions en retard</div>
          <div class="dash-value">${d.actionsEnRetard.length}</div>
        </div>
        <div class="dash-card">
          <div class="dash-label">Gain moyen constate</div>
          ${gainHtml}
          <div class="dash-sub">${d.indicateursSuivis} indicateur(s) suivi(s)</div>
        </div>
      </div>
    `);
    wrap.appendChild(box);

    if (d.actionsEnRetard.length) {
      const list = el(`<div class="dash-retard-list"></div>`);
      d.actionsEnRetard.forEach(a => {
        const item = el(`<div class="dash-retard-item"></div>`);
        item.innerHTML = `<strong>${a.echeance}</strong> - ${a.description} <span class="tool-tag">${a.chantier_titre}</span>`;
        item.addEventListener('click', () => openDetail(a.chantier_id));
        list.appendChild(item);
      });
      wrap.appendChild(list);
    }
  }

  // ---------- Liste ----------
  async function loadChantiers() {
    const res = await fetch('/api/chantiers');
    chantiers = await res.json();
    renderList();
    loadDashboard();
  }

  function renderList() {
    const wrap = document.getElementById('chantiers-list');
    wrap.innerHTML = '';
    if (chantiers.length === 0) {
      wrap.appendChild(el(`<p style="color:#5a6b78">Aucun chantier pour le moment. Cree ton premier chantier Kaizen !</p>`));
      return;
    }
    chantiers.forEach(c => {
      const card = el(`
        <div class="chantier-card">
          <span class="badge ${c.statut}">${statutLabel(c.statut)}</span>
          <h3>${c.titre}</h3>
          <div class="meta">${c.perimetre || 'Perimetre non defini'} ${c.pilote ? '- Pilote : ' + c.pilote : ''}</div>
          <div>${(c.outils || []).map(id => {
            const t = tools.find(tt => tt.id === id);
            return t ? `<span class="tool-tag">${t.icon} ${t.name}</span>` : '';
          }).join('')}</div>
        </div>
      `);
      card.addEventListener('click', () => openDetail(c.id));
      wrap.appendChild(card);
    });
  }

  // ---------- Formulaire nouveau / edition ----------
  function renderOutilsChecklist() {
    const wrap = document.getElementById('f-outils');
    wrap.innerHTML = '';
    tools.forEach(t => {
      const chip = el(`
        <button type="button" class="tool-chip${selectedOutils.includes(t.id) ? ' selected' : ''}" data-id="${t.id}">
          <span class="tool-chip-icon">${t.icon}</span>
          <span class="tool-chip-name">${t.name}</span>
        </button>
      `);
      chip.addEventListener('click', () => {
        const active = chip.classList.toggle('selected');
        if (active) selectedOutils.push(t.id);
        else selectedOutils = selectedOutils.filter(id => id !== t.id);
      });
      wrap.appendChild(chip);
    });
  }

  function openForm(chantier) {
    editingId = chantier ? chantier.id : null;
    selectedOutils = chantier ? [...(chantier.outils || [])] : [];
    document.getElementById('form-title').textContent = chantier ? 'Modifier le chantier' : 'Nouveau chantier';
    document.getElementById('f-titre').value = chantier ? chantier.titre : '';
    document.getElementById('f-probleme').value = chantier ? chantier.probleme : '';
    document.getElementById('f-perimetre').value = chantier ? chantier.perimetre : '';
    document.getElementById('f-pilote').value = chantier ? chantier.pilote : '';
    document.getElementById('f-equipe').value = chantier ? (chantier.equipe || []).join(', ') : '';
    document.getElementById('f-objectif').value = chantier ? chantier.objectif : '';
    document.getElementById('f-date-debut').value = chantier ? chantier.date_debut : '';
    document.getElementById('f-date-fin').value = chantier ? chantier.date_fin : '';
    renderOutilsChecklist();
    show('view-form');
  }

  async function saveChantier() {
    const payload = {
      titre: document.getElementById('f-titre').value.trim(),
      probleme: document.getElementById('f-probleme').value.trim(),
      perimetre: document.getElementById('f-perimetre').value.trim(),
      pilote: document.getElementById('f-pilote').value.trim(),
      equipe: document.getElementById('f-equipe').value.split(',').map(s => s.trim()).filter(Boolean),
      objectif: document.getElementById('f-objectif').value.trim(),
      outils: selectedOutils,
      date_debut: document.getElementById('f-date-debut').value,
      date_fin: document.getElementById('f-date-fin').value
    };
    if (!payload.titre) { alert('Le titre est obligatoire.'); return; }

    const url = editingId ? `/api/chantiers/${editingId}` : '/api/chantiers';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const chantier = await res.json();
    await loadChantiers();
    openDetail(chantier.id);
  }

  // ---------- Detail ----------
  async function openDetail(id) {
    const res = await fetch(`/api/chantiers/${id}`);
    const c = await res.json();
    renderDetail(c);
    show('view-detail');
  }

  function computeGain(indic) {
    if (indic.valeur_avant == null || indic.valeur_apres == null || indic.valeur_avant === '' || indic.valeur_apres === '') return null;
    const avant = Number(indic.valeur_avant), apres = Number(indic.valeur_apres);
    if (!avant) return null;
    return ((avant - apres) / avant) * 100;
  }

  function renderDetail(c) {
    const wrap = document.getElementById('view-detail');
    const outilsBadges = (c.outils || []).map(id => {
      const t = tools.find(tt => tt.id === id);
      return t ? `<span class="tool-tag">${t.icon} ${t.name}</span>` : '';
    }).join('');

    wrap.innerHTML = '';
    wrap.appendChild(el(`
      <div>
        <div class="page-header">
          <button class="btn secondary no-print" id="btn-back">&larr; Retour aux chantiers</button>
          <h1 style="margin-top:10px">${c.titre} <span class="badge ${c.statut}">${statutLabel(c.statut)}</span></h1>
        </div>

        <div class="section-card">
          <h3>Fiche chantier
            <span class="no-print">
              <button class="btn secondary small" id="btn-edit">Modifier</button>
              <button class="btn secondary small" id="btn-toggle-statut">${c.statut === 'en_cours' ? 'Marquer termine' : 'Rouvrir'}</button>
              <button class="btn danger small" id="btn-delete">Supprimer</button>
            </span>
          </h3>
          <p><strong>Probleme :</strong> ${c.probleme || '-'}</p>
          <p><strong>Perimetre :</strong> ${c.perimetre || '-'} &nbsp; | &nbsp; <strong>Pilote :</strong> ${c.pilote || '-'}</p>
          <p><strong>Equipe :</strong> ${(c.equipe || []).join(', ') || '-'}</p>
          <p><strong>Objectif :</strong> ${c.objectif || '-'}</p>
          <p><strong>Periode :</strong> ${c.date_debut || '?'} &rarr; ${c.date_fin || '?'}</p>
          <p><strong>Outils utilises :</strong> ${outilsBadges || 'Aucun'}</p>
          <div class="modal-actions no-print">
            <button class="btn orange" id="btn-a3">Generer la fiche A3</button>
            <button class="btn secondary" id="btn-ask-expert-detail">Demander conseil a l'expert</button>
          </div>
        </div>

        <div class="section-card">
          <h3>Plan d'action</h3>
          <table class="data-table" id="actions-table">
            <thead><tr><th>Action</th><th>Responsable</th><th>Echeance</th><th>Statut</th><th class="no-print"></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>

        <div class="section-card">
          <h3>Indicateurs avant / apres</h3>
          <table class="data-table" id="indics-table">
            <thead><tr><th>Indicateur</th><th>Avant</th><th>Apres</th><th>Gain</th><th class="no-print"></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `));

    document.getElementById('btn-back').addEventListener('click', () => { loadChantiers(); show('view-list'); });
    document.getElementById('btn-edit').addEventListener('click', () => openForm(c));
    document.getElementById('btn-delete').addEventListener('click', async () => {
      if (!confirm('Supprimer ce chantier ?')) return;
      await fetch(`/api/chantiers/${c.id}`, { method: 'DELETE' });
      await loadChantiers();
      show('view-list');
    });
    document.getElementById('btn-toggle-statut').addEventListener('click', async () => {
      const res = await fetch(`/api/chantiers/${c.id}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...c, statut: c.statut === 'en_cours' ? 'termine' : 'en_cours' })
      });
      const updated = await res.json();
      renderDetail(updated);
    });
    document.getElementById('btn-a3').addEventListener('click', () => openA3(c));
    document.getElementById('btn-ask-expert-detail').addEventListener('click', () => {
      if (window.prefillKaizenChat) window.prefillKaizenChat(c.probleme || c.titre);
    });
    renderActionsTable(c);
    renderIndicsTable(c);
  }

  function isEnRetard(a) {
    if (!a.echeance || a.statut === 'fait') return false;
    return a.echeance < new Date().toISOString().slice(0, 10);
  }

  function renderActionsTable(c) {
    const tbody = document.querySelector('#actions-table tbody');
    tbody.innerHTML = '';
    (c.actions || []).forEach(a => {
      const retard = isEnRetard(a);
      const row = el(`
        <tr${retard ? ' style="background:#fdeaea"' : ''}>
          <td>${a.description}</td>
          <td>${a.responsable || '-'}</td>
          <td>${a.echeance || '-'} ${retard ? '<span class="badge bloque">En retard</span>' : ''}</td>
          <td><select class="no-print">
            <option value="a_faire">A faire</option>
            <option value="en_cours">En cours</option>
            <option value="fait">Fait</option>
            <option value="bloque">Bloque</option>
          </select> <span class="badge ${a.statut}">${actionStatutLabel(a.statut)}</span></td>
          <td class="no-print"><button class="btn danger small">Suppr.</button></td>
        </tr>
      `);
      row.querySelector('select').value = a.statut;
      row.querySelector('select').addEventListener('change', async (e) => {
        const res = await fetch(`/api/chantiers/${c.id}/actions/${a.id}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...a, statut: e.target.value })
        });
        renderDetail(await res.json());
      });
      row.querySelector('button').addEventListener('click', async () => {
        const res = await fetch(`/api/chantiers/${c.id}/actions/${a.id}`, { method: 'DELETE' });
        renderDetail(await res.json());
      });
      tbody.appendChild(row);
    });

    const addRow = el(`
      <tr class="no-print">
        <td><input type="text" id="new-action-desc" placeholder="Nouvelle action..."></td>
        <td><input type="text" id="new-action-resp" placeholder="Responsable" style="width:100px"></td>
        <td><input type="date" id="new-action-echeance"></td>
        <td colspan="2"><button class="btn small orange" id="btn-submit-action">+ Ajouter</button></td>
      </tr>
    `);
    tbody.appendChild(addRow);
    addRow.querySelector('#btn-submit-action').addEventListener('click', async () => {
      const description = document.getElementById('new-action-desc').value.trim();
      if (!description) return;
      const responsable = document.getElementById('new-action-resp').value.trim();
      const echeance = document.getElementById('new-action-echeance').value;
      const res = await fetch(`/api/chantiers/${c.id}/actions`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description, responsable, echeance })
      });
      renderDetail(await res.json());
    });
  }

  function renderIndicsTable(c) {
    const tbody = document.querySelector('#indics-table tbody');
    tbody.innerHTML = '';
    (c.indicateurs || []).forEach(i => {
      const gain = computeGain(i);
      const gainHtml = gain === null ? '-' : `<span class="${gain >= 0 ? 'gain-positive' : 'gain-negative'}">${gain >= 0 ? '-' : '+'}${Math.abs(gain).toFixed(0)}%</span>`;
      const row = el(`
        <tr>
          <td>${i.nom}</td>
          <td>${i.valeur_avant ?? '-'} ${i.unite || ''}</td>
          <td>${i.valeur_apres ?? '-'} ${i.unite || ''}</td>
          <td>${gainHtml}</td>
          <td class="no-print"><button class="btn danger small">Suppr.</button></td>
        </tr>
      `);
      row.querySelector('button').addEventListener('click', async () => {
        const res = await fetch(`/api/chantiers/${c.id}/indicateurs/${i.id}`, { method: 'DELETE' });
        renderDetail(await res.json());
      });
      tbody.appendChild(row);
    });

    const addRow = el(`
      <tr class="no-print">
        <td><input type="text" id="new-indic-nom" placeholder="Nom indicateur"></td>
        <td><input type="number" id="new-indic-avant" placeholder="Avant" style="width:70px"> <input type="text" id="new-indic-unite" placeholder="unite" style="width:60px"></td>
        <td><input type="number" id="new-indic-apres" placeholder="Apres" style="width:70px"></td>
        <td colspan="2"><button class="btn small orange" id="btn-submit-indic">+ Ajouter</button></td>
      </tr>
    `);
    tbody.appendChild(addRow);
    addRow.querySelector('#btn-submit-indic').addEventListener('click', async () => {
      const nom = document.getElementById('new-indic-nom').value.trim();
      if (!nom) return;
      const unite = document.getElementById('new-indic-unite').value.trim();
      const valeur_avant = parseFloat(document.getElementById('new-indic-avant').value);
      const valeur_apres = parseFloat(document.getElementById('new-indic-apres').value);
      const res = await fetch(`/api/chantiers/${c.id}/indicateurs`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nom, unite,
          valeur_avant: isNaN(valeur_avant) ? null : valeur_avant,
          valeur_apres: isNaN(valeur_apres) ? null : valeur_apres
        })
      });
      renderDetail(await res.json());
    });
  }

  // ---------- Fiche A3 ----------
  function openA3(c) {
    const outilsNames = (c.outils || []).map(id => tools.find(t => t.id === id)?.name).filter(Boolean).join(', ');
    const actionsHtml = (c.actions || []).map(a => `<tr><td>${a.description}</td><td>${a.responsable || '-'}</td><td>${a.echeance || '-'}</td><td>${actionStatutLabel(a.statut)}</td></tr>`).join('');
    const indicsHtml = (c.indicateurs || []).map(i => {
      const gain = computeGain(i);
      return `<tr><td>${i.nom}</td><td>${i.valeur_avant ?? '-'} ${i.unite || ''}</td><td>${i.valeur_apres ?? '-'} ${i.unite || ''}</td><td>${gain === null ? '-' : gain.toFixed(0) + '%'}</td></tr>`;
    }).join('');

    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>A3 - ${c.titre}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#202a33;}
        h1{color:#10243e;font-size:1.3rem;border-bottom:3px solid #e8722c;padding-bottom:8px;}
        h2{color:#0f8b8d;font-size:1rem;margin-top:20px;}
        table{width:100%;border-collapse:collapse;margin-top:6px;}
        th,td{border:1px solid #e1e6ea;padding:6px 8px;font-size:0.85rem;text-align:left;}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
      </style></head>
      <body>
        <h1>Rapport A3 - ${c.titre}</h1>
        <div class="grid">
          <div>
            <h2>Contexte / Probleme</h2>
            <p>${c.probleme || '-'}</p>
            <p><strong>Perimetre :</strong> ${c.perimetre || '-'}<br><strong>Pilote :</strong> ${c.pilote || '-'}<br><strong>Equipe :</strong> ${(c.equipe || []).join(', ') || '-'}</p>
            <h2>Objectif cible</h2>
            <p>${c.objectif || '-'}</p>
            <p><strong>Periode :</strong> ${c.date_debut || '?'} &rarr; ${c.date_fin || '?'}</p>
            <h2>Outils Kaizen mobilises</h2>
            <p>${outilsNames || '-'}</p>
          </div>
          <div>
            <h2>Plan d'actions</h2>
            <table><thead><tr><th>Action</th><th>Resp.</th><th>Echeance</th><th>Statut</th></tr></thead><tbody>${actionsHtml || '<tr><td colspan=4>Aucune action</td></tr>'}</tbody></table>
            <h2>Resultats (avant / apres)</h2>
            <table><thead><tr><th>Indicateur</th><th>Avant</th><th>Apres</th><th>Gain</th></tr></thead><tbody>${indicsHtml || '<tr><td colspan=4>Pas encore mesure</td></tr>'}</tbody></table>
          </div>
        </div>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  // ---------- Init ----------
  async function init() {
    const [toolsRes] = await Promise.all([fetch('/api/tools')]);
    tools = await toolsRes.json();
    await loadChantiers();

    document.getElementById('btn-new-chantier').addEventListener('click', () => openForm(null));
    document.getElementById('btn-cancel-chantier').addEventListener('click', () => { show('view-list'); });
    document.getElementById('btn-save-chantier').addEventListener('click', saveChantier);
    document.getElementById('btn-ask-expert-form').addEventListener('click', () => {
      const txt = document.getElementById('f-probleme').value || document.getElementById('f-titre').value;
      if (window.prefillKaizenChat && txt) window.prefillKaizenChat(txt);
    });

    const params = new URLSearchParams(location.search);
    const preselect = params.get('preselect');
    if (preselect) {
      openForm(null);
      selectedOutils = [preselect];
      renderOutilsChecklist();
    }
  }

  init();
})();
