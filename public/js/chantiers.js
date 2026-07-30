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

  // Echappe les caracteres HTML sensibles avant d'injecter une valeur saisie par
  // l'utilisateur (titre, probleme, nom d'action...) dans du HTML via innerHTML.
  // Sans cela, un titre comme "<img src=x onerror=...>" executerait du code (XSS stocke).
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Message non bloquant (remplace les alert() natifs, qui figent la page).
  function toast(message, type) {
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }
    const t = el(`<div class="toast${type === 'error' ? ' toast-error' : ''}"></div>`);
    t.textContent = message;
    root.appendChild(t);
    setTimeout(() => { t.classList.add('toast-hide'); setTimeout(() => t.remove(), 300); }, 3500);
  }

  // Redimensionne et recompresse une image cote client avant l'envoi.
  // Evite les echecs sur les grosses photos (limite serveur) et allege fortement
  // le stockage et tous les chargements ulterieurs. Les fichiers non-image passent tels quels.
  function readPhoto(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      if (!file.type || !file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => resolve({ base64: reader.result.split(',')[1], mime: file.type || '', name: file.name || 'fichier' });
        reader.onerror = () => reject(new Error('Lecture impossible'));
        reader.readAsDataURL(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth, h = img.naturalHeight;
        if (Math.max(w, h) > maxSize) {
          const scale = maxSize / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
        resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg', name });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
      img.src = url;
    });
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
        <strong>${esc(quizStartChantier.titre)}</strong>
        <p style="margin:6px 0 0">${esc(quizStartChantier.probleme || 'Aucune description de probleme renseignee.')}</p>
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
      toast('Merci de repondre a toutes les questions.', 'error');
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
  // Cible de gain moyen : prudente mais un minimum engageante pour des chantiers Kaizen (petits pas).
  const GAIN_MOYEN_CIBLE = 15;

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
    const cibleAtteinte = d.gainMoyen !== null && d.gainMoyen >= GAIN_MOYEN_CIBLE;
    const cibleHtml = d.gainMoyen === null
      ? `Cible : ${GAIN_MOYEN_CIBLE}%`
      : `Cible : ${GAIN_MOYEN_CIBLE}% <span class="${cibleAtteinte ? 'gain-positive' : ''}">${cibleAtteinte ? '— atteinte' : '— pas encore atteinte'}</span>`;

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
          <div class="dash-sub">${cibleHtml}</div>
        </div>
      </div>
    `);
    wrap.appendChild(box);

    if (d.actionsEnRetard.length) {
      const list = el(`<div class="dash-retard-list"></div>`);
      d.actionsEnRetard.forEach(a => {
        const item = el(`<div class="dash-retard-item"></div>`);
        item.innerHTML = `<strong>${esc(a.echeance)}</strong> - ${esc(a.description)} <span class="tool-tag">${esc(a.chantier_titre)}</span>`;
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
  let searchQuery = '';

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
    let filtered = statutFilter === 'tous' ? chantiers : chantiers.filter(c => c.statut === statutFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(c => [c.titre, c.probleme, c.perimetre, c.pilote, ...(c.equipe || [])]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
    }
    if (filtered.length === 0) {
      wrap.appendChild(el(`<p style="color:#5a6b78">${q ? 'Aucun chantier ne correspond a cette recherche.' : 'Aucun chantier ici pour le moment.'}</p>`));
      return;
    }
    filtered.forEach(c => {
      const card = el(`
        <div class="chantier-card">
          <span class="badge ${c.statut}">${statutLabel(c.statut)}</span>
          <h3>${esc(c.titre)}</h3>
          <div class="meta">${esc(c.perimetre || 'Perimetre non defini')} ${c.pilote ? '- Pilote : ' + esc(c.pilote) : ''}</div>
          <div>${(c.outils || []).map(id => {
            const t = tools.find(tt => tt.id === id);
            return t ? `<span class="tool-tag">${t.icon} ${esc(t.name)}</span>` : '';
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
    if (!payload.titre) { toast('Le titre est obligatoire.', 'error'); return; }

    const manquantes = missingRequiredPhases(payload.outils);
    if (manquantes.length) {
      toast(`Choisis au moins un outil de : ${manquantes.map(p => p.label).join(', ')}.`, 'error');
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
      toast(err.error || "Erreur lors de l'enregistrement du chantier.", 'error');
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

  async function uploadPhotoFile(file, chantierId, actionId, onDone, outilId) {
    if (!file) return;
    try {
      const { base64, mime, name } = await readPhoto(file, 1600, 0.8);
      const res = await fetch(`/api/chantiers/${chantierId}/photos`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: name, mime_type: mime, data: base64, action_id: actionId, outil_id: outilId || null })
      });
      if (!res.ok) { toast("Echec de l'ajout de la photo.", 'error'); return; }
      onDone(await res.json());
    } catch (err) {
      toast("Impossible de lire cette image.", 'error');
    }
  }

  function pickAndUploadPhoto(chantierId, actionId, onDone, outilId) {
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
        uploadPhotoFile(input.files[0], chantierId, actionId, onDone, outilId);
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
          <img src="data:${esc(p.mime_type)};base64,${esc(p.data)}" alt="${esc(p.filename || 'photo')}">
          <button type="button" class="photo-delete no-print" title="Supprimer">&times;</button>
        </div>
      `);
      thumb.querySelector('img').addEventListener('click', () => {
        const w = window.open();
        w.document.write(`<img src="data:${esc(p.mime_type)};base64,${esc(p.data)}" style="max-width:100%">`);
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
      return t ? `<span class="tool-tag">${t.icon} ${esc(t.name)}</span>` : '';
    }).join('');
    const outilsDuChantier = (c.outils || []).map(id => tools.find(tt => tt.id === id)).filter(Boolean);

    wrap.innerHTML = '';
    wrap.appendChild(el(`
      <div>
        <div class="page-header">
          <button class="btn secondary no-print" id="btn-back">&larr; Retour aux chantiers</button>
          <h1 style="margin-top:10px">${esc(c.titre)} <span class="badge ${c.statut}">${statutLabel(c.statut)}</span></h1>
        </div>

        <div class="section-card">
          <h3>Fiche chantier
            <span class="no-print">
              <button class="btn secondary small" id="btn-edit">Modifier</button>
              <button class="btn secondary small" id="btn-toggle-statut">${nextStatut(c.statut).label}</button>
              <button class="btn danger small" id="btn-delete">Supprimer</button>
            </span>
          </h3>
          <p><strong>Probleme :</strong> ${esc(c.probleme || '-')}</p>
          <p><strong>Perimetre :</strong> ${esc(c.perimetre || '-')} &nbsp; | &nbsp; <strong>Pilote :</strong> ${esc(c.pilote || '-')}</p>
          <p><strong>Equipe :</strong> ${(c.equipe || []).map(esc).join(', ') || '-'}</p>
          <p><strong>Objectif :</strong> ${esc(c.objectif || '-')}</p>
          <p><strong>Periode :</strong> ${esc(c.date_debut || '?')} &rarr; ${esc(c.date_fin || '?')}</p>
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

        ${outilsDuChantier.length ? `
        <div class="section-card">
          <h3>Outils du chantier</h3>
          <p class="section-hint no-print">Optionnel : pour chaque outil, tu peux ajouter des photos et remplir le support.
          Cela ne remplace pas le plan d'action ci-dessous, qui reste la reference du chantier.</p>
          <div id="outils-blocks"></div>
        </div>` : ''}

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
    if (outilsDuChantier.length) renderOutilsBlocks(c, outilsDuChantier);
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
          <td>${esc(a.description)}
            <div class="photo-grid photo-grid-small" id="action-photos-${a.id}"></div>
            <button type="button" class="btn secondary small no-print btn-add-action-photo">Photo</button>
          </td>
          <td><input type="text" class="no-print inline-edit" placeholder="Responsable" style="width:110px">
            <span class="print-only">${esc(a.responsable || '-')}</span></td>
          <td><input type="date" class="no-print inline-edit">
            ${retard ? '<span class="badge bloque">En retard</span>' : ''}
            <span class="print-only">${esc(a.echeance || '-')}</span></td>
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
        // On n'envoie que les champs modifiables (pas a.photos en base64, inutile et lourd).
        const payload = {
          description: a.description, responsable: a.responsable,
          echeance: a.echeance, statut: a.statut, ...changes
        };
        const res = await fetch(`/api/chantiers/${c.id}/actions/${a.id}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        });
        renderDetail(await res.json());
      }

      row.querySelector('select').addEventListener('change', e => saveAction({ statut: e.target.value }));
      respInput.addEventListener('change', e => saveAction({ responsable: e.target.value.trim() }));
      echeanceInput.addEventListener('change', e => saveAction({ echeance: e.target.value }));
      // Cibler le bouton Suppr. explicitement : la ligne contient aussi le bouton "Photo"
      // (premier bouton du DOM), donc querySelector('button') tombait sur le mauvais.
      row.querySelector('.btn.danger').addEventListener('click', async () => {
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
          <td>${esc(i.nom)}</td>
          <td>${esc(i.valeur_avant ?? '-')} ${esc(i.unite || '')}</td>
          <td>${esc(i.valeur_apres ?? '-')} ${esc(i.unite || '')}</td>
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

  // ---------- Bloc par outil : photos dediees + support a remplir ----------
  function renderOutilsBlocks(c, outilsDuChantier) {
    const wrap = document.getElementById('outils-blocks');
    if (!wrap) return;
    wrap.innerHTML = '';
    const photosParOutil = c.photos_outils || {};

    outilsDuChantier.forEach(t => {
      const photos = photosParOutil[t.id] || [];
      const remplissable = t.template && t.template.fields && t.template.fields.length;
      const bloc = el(`
        <div class="outil-bloc">
          <div class="outil-bloc-header">
            <span class="outil-bloc-nom">${t.icon} ${esc(t.name)}</span>
            <span class="no-print">
              ${remplissable ? '<button type="button" class="btn secondary small btn-remplir">Remplir le support</button>' : ''}
              ${t.template ? `<a class="btn secondary small" href="/${esc(t.template.file)}" download>Telecharger la trame</a>` : ''}
              <button type="button" class="btn secondary small btn-photo-outil">+ Photo</button>
            </span>
          </div>
          <div class="photo-grid photo-grid-small" data-photos-outil="${esc(t.id)}"></div>
        </div>
      `);
      if (remplissable) {
        bloc.querySelector('.btn-remplir').addEventListener('click', () => openTemplateForm(t, c));
      }
      bloc.querySelector('.btn-photo-outil').addEventListener('click', () => {
        pickAndUploadPhoto(c.id, null, updated => renderDetail(updated), t.id);
      });
      renderPhotoGrid(bloc.querySelector('[data-photos-outil]'), photos, c.id);
      wrap.appendChild(bloc);
    });
  }

  // ---------- Supports a remplir (formulaire -> document pre-rempli) ----------
  function resolveAutoValue(auto, c) {
    if (!auto) return '';
    if (auto === 'equipe') return (c.equipe || []).join(', ');
    return c[auto] != null ? String(c[auto]) : '';
  }

  function buildRepeatableTable(field, existingRows) {
    const box = el(`
      <div class="repeatable-field" data-repeatable="${field.id}">
        <div class="table-scroll">
          <table class="data-table">
            <thead><tr>${field.columns.map(col => `<th>${esc(col.label)}</th>`).join('')}<th></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <button type="button" class="btn secondary small btn-add-repeatable-row">+ Ligne</button>
      </div>
    `);
    const tbody = box.querySelector('tbody');

    function addRow(values) {
      const row = el(`<tr>${field.columns.map(col => '<td></td>').join('')}<td></td></tr>`);
      const cells = row.querySelectorAll('td');
      field.columns.forEach((col, i) => {
        let input;
        if (col.type === 'select') {
          input = document.createElement('select');
          (col.options || []).forEach(opt => {
            const o = document.createElement('option');
            o.value = opt; o.textContent = opt;
            input.appendChild(o);
          });
        } else {
          input = document.createElement('input');
          input.type = 'text';
        }
        input.dataset.col = col.id;
        if (values && values[col.id] != null) input.value = values[col.id];
        cells[i].appendChild(input);
      });
      const delBtn = el(`<button type="button" class="btn danger small">&times;</button>`);
      delBtn.addEventListener('click', () => row.remove());
      cells[cells.length - 1].appendChild(delBtn);
      tbody.appendChild(row);
    }

    if (existingRows && existingRows.length) existingRows.forEach(r => addRow(r));
    else addRow(null);

    box.querySelector('.btn-add-repeatable-row').addEventListener('click', () => addRow(null));
    return box;
  }

  function collectRepeatableRows(box, field) {
    // Une ligne ne compte que si une colonne libre (texte) est renseignee : les listes
    // deroulantes ont toujours une valeur par defaut, elles ne prouvent pas une saisie.
    const colsLibres = field.columns.filter(col => col.type !== 'select').map(col => col.id);
    return Array.from(box.querySelectorAll('tbody tr')).map(row => {
      const obj = {};
      row.querySelectorAll('[data-col]').forEach(input => { obj[input.dataset.col] = input.value.trim(); });
      return obj;
    }).filter(obj => colsLibres.some(id => obj[id]));
  }

  function openTemplateForm(tool, c) {
    const t = tool.template;
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const backdrop = el(`
      <div class="modal-backdrop">
        <div class="modal template-form-modal">
          <button class="modal-close">&times;</button>
          <h2>${tool.icon} ${esc(tool.name)}</h2>
          <p>${t.remplissable
            ? 'Remplis les rubriques ci-dessous : tes reponses seront ecrites directement dans la trame SWM.'
            : 'Remplis les rubriques ci-dessous pour obtenir le support pre-rempli, pret a imprimer.'}</p>
          <form id="template-form"></form>
          <div class="modal-actions">
            ${t.remplissable ? '<button class="btn orange" type="button" id="btn-generate-trame">Remplir la trame SWM (PowerPoint)</button>' : ''}
            <button class="btn ${t.remplissable ? 'secondary' : 'orange'}" type="button" id="btn-generate-template">Version imprimable (PDF)</button>
          </div>
        </div>
      </div>
    `);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) root.innerHTML = ''; });
    backdrop.querySelector('.modal-close').addEventListener('click', () => { root.innerHTML = ''; });

    const form = backdrop.querySelector('#template-form');
    const repeatableBoxes = {};

    if (t.header && t.header.length) {
      const section = el(`<div class="form-section"><h4>En-tete</h4></div>`);
      t.header.forEach(h => {
        const value = resolveAutoValue(h.auto, c);
        const field = el(`
          <label class="form-field">
            <span>${esc(h.label)}</span>
            <input type="text" data-header="${h.id}">
          </label>
        `);
        field.querySelector('input').value = value;
        section.appendChild(field);
      });
      form.appendChild(section);
    }

    (t.fields || []).forEach(f => {
      if (f.type === 'repeatable') {
        const section = el(`<div class="form-section"><h4>${esc(f.label)}</h4></div>`);
        const box = buildRepeatableTable(f, null);
        repeatableBoxes[f.id] = box;
        section.appendChild(box);
        form.appendChild(section);
        return;
      }
      const value = resolveAutoValue(f.auto, c);
      const section = el(`<div class="form-section"></div>`);
      let inputHtml;
      if (f.type === 'select') {
        inputHtml = `<select data-field="${f.id}">${(f.options || []).map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea') {
        inputHtml = `<textarea data-field="${f.id}" rows="3"></textarea>`;
      } else {
        inputHtml = `<input type="text" data-field="${f.id}">`;
      }
      const label = el(`<label class="form-field"><span>${esc(f.label)}</span>${inputHtml}</label>`);
      const input = label.querySelector('[data-field]');
      if (f.type !== 'select') input.value = value;
      section.appendChild(label);
      form.appendChild(section);
    });

    function collecterValeurs() {
      const headerValues = {};
      (t.header || []).forEach(h => { headerValues[h.id] = form.querySelector(`[data-header="${h.id}"]`).value.trim(); });

      const fieldValues = {};
      (t.fields || []).forEach(f => {
        if (f.type === 'repeatable') {
          fieldValues[f.id] = collectRepeatableRows(repeatableBoxes[f.id], f);
        } else {
          fieldValues[f.id] = form.querySelector(`[data-field="${f.id}"]`).value.trim();
        }
      });
      return { headerValues, fieldValues };
    }

    // Remplit le vrai fichier PowerPoint SWM et le telecharge. Ce bouton n'existe
    // que pour les outils dont la trame est remplissable (l'Ishikawa est fourni en
    // PDF, la Matrice Gain/Effort n'a pas de case) : sans ce test, la modale entiere
    // ne s'affichait plus pour ces outils.
    const btnTrame = backdrop.querySelector('#btn-generate-trame');
    if (btnTrame) btnTrame.addEventListener('click', async () => {
      const { headerValues, fieldValues } = collecterValeurs();
      btnTrame.disabled = true;
      btnTrame.textContent = 'Remplissage en cours...';
      try {
        const res = await fetch(`/api/tools/${tool.id}/trame`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ header: headerValues, fields: fieldValues })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(err.error || "Impossible de remplir la trame SWM.", 'error');
          return;
        }
        const nonPlaces = res.headers.get('X-Champs-Non-Places');
        const lignesIgnorees = res.headers.get('X-Lignes-Ignorees');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tool.id}-rempli.pptx`;
        // Le lien doit etre dans la page et l'adresse temporaire liberee apres coup :
        // sinon certains navigateurs (mobiles notamment) annulent le telechargement.
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 30000);
        root.innerHTML = '';
        toast('Trame SWM remplie et telechargee.');
        // On previent si une saisie n'a pas pu etre reportee dans la trame.
        if (nonPlaces) {
          const noms = nonPlaces.split(',').map(id => {
            const champ = (t.fields || []).find(f => f.id === id);
            return champ ? champ.label : id;
          });
          toast(`A reporter a la main sur la trame : ${noms.join(', ')}.`, 'error');
        }
        if (lignesIgnorees) {
          toast(`La trame ne comporte pas assez de lignes : ${lignesIgnorees} ligne(s) non reportee(s).`, 'error');
        }
        const causesEnTrop = res.headers.get('X-Causes-En-Trop');
        if (causesEnTrop) {
          toast(`Trop de causes pour la trame : ${causesEnTrop.replace(/pourquoi/g, 'Pourquoi ')}.`, 'error');
        }
      } catch (err) {
        toast("Impossible de remplir la trame SWM.", 'error');
      } finally {
        btnTrame.disabled = false;
        btnTrame.textContent = 'Remplir la trame SWM (PowerPoint)';
      }
    });

    backdrop.querySelector('#btn-generate-template').addEventListener('click', () => {
      const { headerValues, fieldValues } = collecterValeurs();
      root.innerHTML = '';
      // Mise en page identique a la trame SWM (public/js/supports.js).
      window.KaizenSupports.generer(tool, headerValues, fieldValues);
    });

    root.appendChild(backdrop);
  }

  // ---------- Fiche A3 ----------
  function openA3(c) {
    const outilsNames = (c.outils || []).map(id => tools.find(t => t.id === id)?.name).filter(Boolean).map(esc).join(', ');
    const actionsHtml = (c.actions || []).map(a => `<tr><td>${esc(a.description)}</td><td>${esc(a.responsable || '-')}</td><td>${esc(a.echeance || '-')}</td><td>${actionStatutLabel(a.statut)}</td></tr>`).join('');
    const indicsHtml = (c.indicateurs || []).map(i => {
      const gain = computeGain(i);
      return `<tr><td>${esc(i.nom)}</td><td>${esc(i.valeur_avant ?? '-')} ${esc(i.unite || '')}</td><td>${esc(i.valeur_apres ?? '-')} ${esc(i.unite || '')}</td><td>${gain === null ? '-' : gain.toFixed(0) + '%'}</td></tr>`;
    }).join('');

    const toutesLesPhotos = [
      ...(c.photos || []).map(p => ({ ...p, legende: 'Photo chantier' })),
      ...Object.entries(c.photos_outils || {}).flatMap(([outilId, photos]) => {
        const nom = tools.find(t => t.id === outilId)?.name || outilId;
        return photos.map(p => ({ ...p, legende: nom }));
      }),
      ...(c.actions || []).flatMap(a => (a.photos || []).map(p => ({ ...p, legende: a.description })))
    ];
    const photosHtml = toutesLesPhotos.map(p => `
      <figure>
        <img src="data:${esc(p.mime_type)};base64,${esc(p.data)}" alt="${esc(p.filename || 'photo')}">
        <figcaption>${esc(p.legende)}</figcaption>
      </figure>
    `).join('');

    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>A3 - ${esc(c.titre)}</title>
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
        .barre-print{margin-bottom:16px;}
        .btn-print{background:#e8722c;color:#fff;border:none;padding:9px 18px;border-radius:6px;font-size:0.9rem;cursor:pointer;}
        @media print{.no-print{display:none;}}
      </style></head>
      <body>
        <div class="barre-print no-print"><button class="btn-print" onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
        <h1>Rapport A3 - ${esc(c.titre)}</h1>
        <div class="grid">
          <div>
            <h2>Contexte / Probleme</h2>
            <p>${esc(c.probleme || '-')}</p>
            <p><strong>Perimetre :</strong> ${esc(c.perimetre || '-')}<br><strong>Pilote :</strong> ${esc(c.pilote || '-')}<br><strong>Equipe :</strong> ${(c.equipe || []).map(esc).join(', ') || '-'}</p>
            <h2>Objectif cible</h2>
            <p>${esc(c.objectif || '-')}</p>
            <p><strong>Periode :</strong> ${esc(c.date_debut || '?')} &rarr; ${esc(c.date_fin || '?')}</p>
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
        <script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script>
      </body></html>
    `);
    // L'impression est declenchee DANS l'onglet A3 (script ci-dessus), pas depuis
    // l'application : sinon window.print() bloque le fil principal et fige l'app
    // tant que la boite d'impression n'est pas fermee.
    w.document.close();
  }

  // ---------- Init ----------
  async function init() {
    const [toolsRes, phasesRes] = await Promise.all([fetch('/api/tools'), fetch('/api/phases')]);
    tools = await toolsRes.json();
    phases = await phasesRes.json();
    await loadChantiers();

    document.getElementById('btn-new-chantier').addEventListener('click', () => startNewChantierFlow([]));
    document.getElementById('chantiers-search').addEventListener('input', e => { searchQuery = e.target.value; renderList(); });
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
          <h2>${tool.icon} Ajouter ${esc(tool.name)} a un chantier</h2>
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
      const item = el(`<div class="chantier-card"><span class="badge ${c.statut}">${statutLabel(c.statut)}</span><h3>${esc(c.titre)}</h3></div>`);
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
