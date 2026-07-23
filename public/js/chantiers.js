(function () {
  let tools = [];
  let phases = [];
  let chantiers = [];
  let editingId = null;
  let selectedOutils = [];

  function toolPhaseOrder(toolId) {
    const tool = tools.find(t => t.id === toolId);
    const phase = tool && phases.find(p => p.id === tool.phase);
    return phase ? phase.order : 99;
  }

  function sortOutilsByPhase(ids) {
    return [...ids].sort((a, b) => toolPhaseOrder(a) - toolPhaseOrder(b));
  }

  function missingRequiredPhases(ids) {
    const phasesPresentes = new Set(ids.map(id => tools.find(t => t.id === id)?.phase).filter(Boolean));
    return phases.filter(p => p.required && !phasesPresentes.has(p.id));
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function show(viewId) {
    ['view-list', 'view-quiz', 'view-form', 'view-detail'].forEach(id => {
      document.getElementById(id).style.display = id === viewId ? 'block' : 'none';
    });
  }

  function statutLabel(s) {
    return { a_traiter: 'A traiter', en_cours: 'En cours', termine: 'Termine' }[s] || s;
  }

  // ---------- Questionnaire d'eligibilite Kaizen ----------
  const QUIZ_QUESTIONS = [
    "Le probleme touche-t-il un poste, une machine, une zone ou une tache precise (pas toute l'organisation) ?",
    "Peut-on agir avec les moyens et l'autorite du secteur, sans investissement lourd ni validation d'un niveau superieur ?",
    "Le probleme est-il recurrent ou a-t-il un impact reel (pas un incident isole unique) ?",
    "Une premiere piste de cause ou de solution est-elle deja envisageable ?",
    "Le probleme peut-il raisonnablement etre traite en quelques jours a quelques semaines (pas un projet de plusieurs mois) ?"
  ];
  let quizResult = null; // { reponses: ['oui'|'non', ...], score, eligible }
  let pendingOutils = [];
  let quizMode = 'create'; // 'create' | 'start'
  let quizStartChantier = null;

  function renderQuiz() {
    const contextWrap = document.getElementById('quiz-context');
    if (quizMode === 'start' && quizStartChantier) {
      contextWrap.style.display = 'block';
      contextWrap.innerHTML = `
        <strong>${quizStartChantier.titre}</strong>
        <p style="margin:6px 0 0">${quizStartChantier.probleme || 'Aucune description de probleme renseignee.'}</p>
      `;
    } else {
      contextWrap.style.display = 'none';
      contextWrap.innerHTML = '';
    }

    const wrap = document.getElementById('quiz-questions');
    wrap.innerHTML = '';
    document.getElementById('quiz-result').style.display = 'none';
    document.getElementById('quiz-result').innerHTML = '';
    QUIZ_QUESTIONS.forEach((q, i) => {
      const block = el(`
        <div class="quiz-question">
          <p>${i + 1}. ${q}</p>
          <label class="quiz-radio"><input type="radio" name="quiz-q${i}" value="oui"> Oui</label>
          <label class="quiz-radio"><input type="radio" name="quiz-q${i}" value="non"> Non</label>
        </div>
      `);
      wrap.appendChild(block);
    });
  }

  function startNewChantierFlow(presetOutils) {
    quizMode = 'create';
    quizStartChantier = null;
    pendingOutils = presetOutils || [];
    quizResult = null;
    renderQuiz();
    show('view-quiz');
  }

  function startExistingChantierFlow(chantier) {
    quizMode = 'start';
    quizStartChantier = chantier;
    quizResult = null;
    renderQuiz();
    show('view-quiz');
  }

  async function applyQuizToExistingChantier(chantier, result) {
    const res = await fetch(`/api/chantiers/${chantier.id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...chantier, statut: 'en_cours',
        eligible_kaizen: result.eligible, quiz_reponses: result.reponses
      })
    });
    const updated = await res.json();
    await loadChantiers();
    openDetail(updated.id);
  }

  function evaluateQuiz() {
    const reponses = QUIZ_QUESTIONS.map((_, i) => {
      const checked = document.querySelector(`input[name="quiz-q${i}"]:checked`);
      return checked ? checked.value : null;
    });
    if (reponses.includes(null)) {
      alert('Merci de repondre a toutes les questions.');
      return;
    }
    const score = reponses.filter(r => r === 'oui').length;
    const eligible = score >= 4;
    quizResult = { reponses, score, eligible };

    const proceed = () => quizMode === 'start'
      ? applyQuizToExistingChantier(quizStartChantier, quizResult)
      : openForm(null);

    if (eligible) {
      proceed();
    } else {
      const box = document.getElementById('quiz-result');
      box.style.display = 'block';
      box.innerHTML = `
        <div class="memo-box" style="border-color:#d64545;background:#fdeaea;margin-top:16px;">
          <strong>Score : ${score}/5 — ce probleme semble plus adapte a un projet structure (investissement, decision de direction, RH...) qu'a un chantier Kaizen classique.</strong>
          <p style="margin:10px 0 0">Tu peux quand meme ${quizMode === 'start' ? 'demarrer' : 'creer'} le chantier si tu penses que c'est justifie.</p>
        </div>
      `;
      const actions = el(`<div class="modal-actions"></div>`);
      const forceBtn = el(`<button class="btn orange">${quizMode === 'start' ? 'Demarrer' : 'Creer'} quand meme</button>`);
      forceBtn.addEventListener('click', proceed);
      actions.appendChild(forceBtn);
      box.appendChild(actions);
    }
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
    const aTraiter = d.chantiersParStatut.a_traiter || 0;
    const enCours = d.chantiersParStatut.en_cours || 0;
    const termine = d.chantiersParStatut.termine || 0;
    const gainHtml = d.gainMoyen === null
      ? '<span class="dash-value">-</span>'
      : `<span class="dash-value ${d.gainMoyen >= 0 ? 'gain-positive' : 'gain-negative'}">${d.gainMoyen >= 0 ? '-' : '+'}${Math.abs(d.gainMoyen).toFixed(0)}%</span>`;

    wrap.innerHTML = '';
    const box = el(`
      <div class="dashboard-grid">
        <div class="dash-card">
          <div class="dash-label">Kaizen a traiter</div>
          <div class="dash-value">${aTraiter}</div>
        </div>
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

  let statutFilter = 'tous';

  function renderStatutFilters() {
    const wrap = document.getElementById('statut-filters');
    if (!wrap) return;
    const counts = { tous: chantiers.length };
    ['a_traiter', 'en_cours', 'termine'].forEach(s => {
      counts[s] = chantiers.filter(c => c.statut === s).length;
    });
    const labels = { tous: 'Tous', a_traiter: 'A traiter', en_cours: 'En cours', termine: 'Termine' };
    wrap.innerHTML = '';
    Object.keys(labels).forEach(key => {
      const chip = el(`<button type="button" class="chip-filter${statutFilter === key ? ' active' : ''}">${labels[key]} (${counts[key]})</button>`);
      chip.addEventListener('click', () => { statutFilter = key; renderList(); });
      wrap.appendChild(chip);
    });
  }

  function renderList() {
    renderStatutFilters();
    const wrap = document.getElementById('chantiers-list');
    wrap.innerHTML = '';
    const filtered = statutFilter === 'tous' ? chantiers : chantiers.filter(c => c.statut === statutFilter);
    if (filtered.length === 0) {
      wrap.appendChild(el(`<p style="color:#5a6b78">Aucun chantier ici pour le moment.</p>`));
      return;
    }
    filtered.forEach(c => {
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
      card.addEventListener('click', () => {
        if (c.statut === 'a_traiter') startExistingChantierFlow(c);
        else openDetail(c.id);
      });
      wrap.appendChild(card);
    });
  }

  // ---------- Formulaire nouveau / edition ----------
  function renderOutilsChecklist() {
    const wrap = document.getElementById('f-outils');
    wrap.innerHTML = '';
    [...phases].sort((a, b) => a.order - b.order).forEach(phase => {
      const toolsDePhase = tools.filter(t => t.phase === phase.id);
      if (!toolsDePhase.length) return;

      const section = el(`
        <div class="tool-phase-group">
          <div class="tool-phase-header">
            <span class="tool-phase-order">${phase.order}</span>
            <span class="tool-phase-label">${phase.label}</span>
            ${phase.required ? '<span class="tool-phase-required">obligatoire</span>' : '<span class="tool-phase-optional">optionnel</span>'}
          </div>
          <div class="tool-phase-chips"></div>
        </div>
      `);
      const chipsWrap = section.querySelector('.tool-phase-chips');

      toolsDePhase.forEach(t => {
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
        chipsWrap.appendChild(chip);
      });

      wrap.appendChild(section);
    });
  }

  function openForm(chantier) {
    editingId = chantier ? chantier.id : null;
    selectedOutils = chantier ? [...(chantier.outils || [])] : [...pendingOutils];
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

    const eligibiliteP = document.getElementById('form-eligibilite');
    if (!chantier && quizResult) {
      eligibiliteP.style.display = 'block';
      eligibiliteP.innerHTML = quizResult.eligible
        ? `<span class="badge en_cours">Eligible Kaizen (${quizResult.score}/5)</span>`
        : `<span class="badge bloque">Cree malgre un score faible (${quizResult.score}/5)</span>`;
    } else {
      eligibiliteP.style.display = 'none';
    }

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
      outils: sortOutilsByPhase(selectedOutils),
      date_debut: document.getElementById('f-date-debut').value,
      date_fin: document.getElementById('f-date-fin').value
    };
    if (!payload.titre) { alert('Le titre est obligatoire.'); return; }

    const manquantes = missingRequiredPhases(payload.outils);
    if (manquantes.length) {
      alert(`Choisis au moins un outil de : ${manquantes.map(p => p.label).join(', ')}.`);
      return;
    }

    if (!editingId && quizResult) {
      payload.eligible_kaizen = quizResult.eligible;
      payload.quiz_reponses = quizResult.reponses;
    }

    const url = editingId ? `/api/chantiers/${editingId}` : '/api/chantiers';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Erreur lors de l'enregistrement du chantier.");
      return;
    }
    const chantier = await res.json();
    quizResult = null;
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

  function nextStatut(s) {
    if (s === 'a_traiter') return { next: 'en_cours', label: 'Demarrer le chantier' };
    if (s === 'en_cours') return { next: 'termine', label: 'Marquer termine' };
    return { next: 'en_cours', label: 'Rouvrir' };
  }

  function computeGain(indic) {
    if (indic.valeur_avant == null || indic.valeur_apres == null || indic.valeur_avant === '' || indic.valeur_apres === '') return null;
    const avant = Number(indic.valeur_avant), apres = Number(indic.valeur_apres);
    if (!avant) return null;
    return ((avant - apres) / avant) * 100;
  }

  function uploadPhotoFile(file, chantierId, actionId, onDone) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const res = await fetch(`/api/chantiers/${chantierId}/photos`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mime_type: file.type, data: base64, action_id: actionId })
      });
      onDone(await res.json());
    };
    reader.readAsDataURL(file);
  }

  function pickAndUploadPhoto(chantierId, actionId, onDone) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const backdrop = el(`
      <div class="modal-backdrop">
        <div class="modal" style="max-width:340px">
          <button class="modal-close">&times;</button>
          <h2>Ajouter une photo</h2>
          <div class="modal-actions" style="flex-direction:column">
            <button class="btn orange" id="btn-photo-camera" style="width:100%">Prendre une photo</button>
            <button class="btn secondary" id="btn-photo-file" style="width:100%">Choisir un fichier</button>
          </div>
        </div>
      </div>
    `);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) root.innerHTML = ''; });
    backdrop.querySelector('.modal-close').addEventListener('click', () => { root.innerHTML = ''; });

    function makeInput(capture) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (capture) input.capture = capture;
      input.addEventListener('change', () => {
        root.innerHTML = '';
        uploadPhotoFile(input.files[0], chantierId, actionId, onDone);
      });
      return input;
    }

    backdrop.querySelector('#btn-photo-camera').addEventListener('click', () => makeInput('environment').click());
    backdrop.querySelector('#btn-photo-file').addEventListener('click', () => makeInput(false).click());

    root.appendChild(backdrop);
  }

  function renderPhotoGrid(container, photos, chantierId) {
    container.innerHTML = '';
    photos.forEach(p => {
      const thumb = el(`
        <div class="photo-thumb">
          <img src="data:${p.mime_type};base64,${p.data}" alt="${p.filename || 'photo'}">
          <button type="button" class="photo-delete no-print" title="Supprimer">&times;</button>
        </div>
      `);
      thumb.querySelector('img').addEventListener('click', () => {
        const w = window.open();
        w.document.write(`<img src="data:${p.mime_type};base64,${p.data}" style="max-width:100%">`);
      });
      thumb.querySelector('.photo-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        const res = await fetch(`/api/chantiers/${chantierId}/photos/${p.id}`, { method: 'DELETE' });
        renderDetail(await res.json());
      });
      container.appendChild(thumb);
    });
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
              <button class="btn secondary small" id="btn-toggle-statut">${nextStatut(c.statut).label}</button>
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
          <h3>Photos du chantier
            <button class="btn small orange no-print" id="btn-add-photo-chantier">+ Ajouter une photo</button>
          </h3>
          <div class="photo-grid" id="chantier-photos"></div>
        </div>

        <div class="section-card">
          <h3>Plan d'action</h3>
          <div class="table-scroll">
            <table class="data-table" id="actions-table">
              <thead><tr><th>Action</th><th>Responsable</th><th>Echeance</th><th>Statut</th><th class="no-print"></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div class="section-card">
          <h3>Indicateurs avant / apres</h3>
          <div class="table-scroll">
            <table class="data-table" id="indics-table">
              <thead><tr><th>Indicateur</th><th>Avant</th><th>Apres</th><th>Gain</th><th class="no-print"></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
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
      if (c.statut === 'a_traiter') {
        startExistingChantierFlow(c);
        return;
      }
      const res = await fetch(`/api/chantiers/${c.id}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...c, statut: nextStatut(c.statut).next })
      });
      const updated = await res.json();
      renderDetail(updated);
    });
    document.getElementById('btn-a3').addEventListener('click', () => openA3(c));
    document.getElementById('btn-ask-expert-detail').addEventListener('click', () => {
      if (window.prefillKaizenChat) window.prefillKaizenChat(c.probleme || c.titre);
    });
    document.getElementById('btn-add-photo-chantier').addEventListener('click', () => {
      pickAndUploadPhoto(c.id, null, updated => renderDetail(updated));
    });
    renderPhotoGrid(document.getElementById('chantier-photos'), c.photos || [], c.id);
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
          <td>${a.description}
            <div class="photo-grid photo-grid-small" id="action-photos-${a.id}"></div>
            <button type="button" class="btn secondary small no-print btn-add-action-photo">Photo</button>
          </td>
          <td><input type="text" class="no-print inline-edit" placeholder="Responsable" style="width:110px">
            <span class="print-only">${a.responsable || '-'}</span></td>
          <td><input type="date" class="no-print inline-edit">
            ${retard ? '<span class="badge bloque">En retard</span>' : ''}
            <span class="print-only">${a.echeance || '-'}</span></td>
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
      const [respInput, echeanceInput] = row.querySelectorAll('input.inline-edit');
      respInput.value = a.responsable || '';
      echeanceInput.value = a.echeance || '';

      async function saveAction(changes) {
        const res = await fetch(`/api/chantiers/${c.id}/actions/${a.id}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...a, ...changes })
        });
        renderDetail(await res.json());
      }

      row.querySelector('select').addEventListener('change', e => saveAction({ statut: e.target.value }));
      respInput.addEventListener('change', e => saveAction({ responsable: e.target.value.trim() }));
      echeanceInput.addEventListener('change', e => saveAction({ echeance: e.target.value }));
      row.querySelector('button').addEventListener('click', async () => {
        const res = await fetch(`/api/chantiers/${c.id}/actions/${a.id}`, { method: 'DELETE' });
        renderDetail(await res.json());
      });
      row.querySelector('.btn-add-action-photo').addEventListener('click', () => {
        pickAndUploadPhoto(c.id, a.id, updated => renderDetail(updated));
      });
      renderPhotoGrid(row.querySelector(`#action-photos-${a.id}`), a.photos || [], c.id);
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

    const toutesLesPhotos = [
      ...(c.photos || []).map(p => ({ ...p, legende: 'Photo chantier' })),
      ...(c.actions || []).flatMap(a => (a.photos || []).map(p => ({ ...p, legende: a.description })))
    ];
    const photosHtml = toutesLesPhotos.map(p => `
      <figure>
        <img src="data:${p.mime_type};base64,${p.data}" alt="${p.filename || 'photo'}">
        <figcaption>${p.legende}</figcaption>
      </figure>
    `).join('');

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
        .photos-grid{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;}
        .photos-grid figure{width:150px;margin:0;}
        .photos-grid img{width:100%;height:110px;object-fit:cover;border-radius:4px;border:1px solid #e1e6ea;display:block;}
        .photos-grid figcaption{font-size:0.75rem;color:#5a6b78;margin-top:3px;text-align:center;}
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
        ${toutesLesPhotos.length ? `<h2>Photos</h2><div class="photos-grid">${photosHtml}</div>` : ''}
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  // ---------- Init ----------
  async function init() {
    const [toolsRes, phasesRes] = await Promise.all([fetch('/api/tools'), fetch('/api/phases')]);
    tools = await toolsRes.json();
    phases = await phasesRes.json();
    await loadChantiers();

    document.getElementById('btn-new-chantier').addEventListener('click', () => startNewChantierFlow([]));
    document.getElementById('btn-cancel-chantier').addEventListener('click', () => { show('view-list'); });
    document.getElementById('btn-save-chantier').addEventListener('click', saveChantier);
    document.getElementById('btn-ask-expert-form').addEventListener('click', () => {
      const txt = document.getElementById('f-probleme').value || document.getElementById('f-titre').value;
      if (window.prefillKaizenChat && txt) window.prefillKaizenChat(txt);
    });
    document.getElementById('btn-quiz-continue').addEventListener('click', evaluateQuiz);
    document.getElementById('btn-quiz-cancel').addEventListener('click', () => {
      if (quizMode === 'start' && quizStartChantier) openDetail(quizStartChantier.id);
      else show('view-list');
    });

    const params = new URLSearchParams(location.search);
    const preselect = params.get('preselect');
    if (preselect) {
      window.history.replaceState({}, '', '/chantiers.html');
      openAddToChantierChooser(preselect);
    }
  }

  function openAddToChantierChooser(toolId) {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) return;

    if (chantiers.length === 0) {
      startNewChantierFlow([toolId]);
      return;
    }

    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const backdrop = el(`
      <div class="modal-backdrop">
        <div class="modal">
          <button class="modal-close">&times;</button>
          <h2>${tool.icon} Ajouter ${tool.name} a un chantier</h2>
          <p>Choisis un chantier existant, ou cree un nouveau chantier avec cet outil.</p>
          <div id="chooser-list"></div>
          <div class="modal-actions">
            <button class="btn orange" id="btn-chooser-new">+ Nouveau chantier</button>
          </div>
        </div>
      </div>
    `);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) root.innerHTML = ''; });
    backdrop.querySelector('.modal-close').addEventListener('click', () => { root.innerHTML = ''; });

    const list = backdrop.querySelector('#chooser-list');
    chantiers.forEach(c => {
      const item = el(`<div class="chantier-card"><span class="badge ${c.statut}">${statutLabel(c.statut)}</span><h3>${c.titre}</h3></div>`);
      item.addEventListener('click', async () => {
        const outils = Array.from(new Set([...(c.outils || []), toolId]));
        const res = await fetch(`/api/chantiers/${c.id}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...c, outils })
        });
        const updated = await res.json();
        root.innerHTML = '';
        await loadChantiers();
        openDetail(updated.id);
      });
      list.appendChild(item);
    });

    backdrop.querySelector('#btn-chooser-new').addEventListener('click', () => {
      root.innerHTML = '';
      startNewChantierFlow([toolId]);
    });

    root.appendChild(backdrop);
  }

  init();
})();
