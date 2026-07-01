(function () {
  let tools = [];
  let activeCategory = 'Toutes';

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function categories() {
    return ['Toutes', ...new Set(tools.map(t => t.category))];
  }

  function renderFilters() {
    const wrap = document.getElementById('category-filters');
    wrap.innerHTML = '';
    categories().forEach(cat => {
      const chip = el(`<button class="chip-filter${cat === activeCategory ? ' active' : ''}"></button>`);
      chip.textContent = cat;
      chip.addEventListener('click', () => {
        activeCategory = cat;
        renderFilters();
        renderGrid();
      });
      wrap.appendChild(chip);
    });
  }

  function renderGrid() {
    const grid = document.getElementById('tools-grid');
    const query = (document.getElementById('search').value || '').toLowerCase();
    grid.innerHTML = '';
    tools
      .filter(t => activeCategory === 'Toutes' || t.category === activeCategory)
      .filter(t => !query || t.name.toLowerCase().includes(query) || t.summary.toLowerCase().includes(query) || t.keywords.some(k => k.includes(query)))
      .forEach(tool => {
        const card = el(`
          <div class="tool-card" id="tool-${tool.id}">
            <div class="icon">${tool.icon}</div>
            <span class="category">${tool.category}</span>
            <h3>${tool.name}</h3>
            <p>${tool.summary}</p>
          </div>
        `);
        card.addEventListener('click', () => openModal(tool));
        grid.appendChild(card);
      });
  }

  function openModal(tool) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const backdrop = el(`
      <div class="modal-backdrop">
        <div class="modal">
          <button class="modal-close">&times;</button>
          <span class="category">${tool.category}</span>
          <h2>${tool.icon} ${tool.name}</h2>
          <p>${tool.summary}</p>

          <h4>Quand l'utiliser</h4>
          <ul>${tool.whenToUse.map(x => `<li>${x}</li>`).join('')}</ul>

          <h4>Comment l'appliquer</h4>
          <ol>${tool.steps.map(x => `<li>${x}</li>`).join('')}</ol>

          <h4>Benefices</h4>
          <p>${tool.benefits}</p>

          <h4>Memo a retenir</h4>
          <div class="memo-box">
            <ul>${tool.memo.map(x => `<li>${x}</li>`).join('')}</ul>
          </div>

          <div class="modal-actions">
            <button class="btn orange" id="btn-use-in-chantier">Utiliser dans un chantier</button>
            <button class="btn secondary" id="btn-ask-expert">Demander conseil a l'expert</button>
            <button class="btn secondary" id="btn-print-memo">Imprimer le memo</button>
          </div>
        </div>
      </div>
    `);

    backdrop.addEventListener('click', e => { if (e.target === backdrop) root.innerHTML = ''; });
    backdrop.querySelector('.modal-close').addEventListener('click', () => { root.innerHTML = ''; });
    backdrop.querySelector('#btn-use-in-chantier').addEventListener('click', () => {
      window.location.href = `/chantiers.html?preselect=${tool.id}`;
    });
    backdrop.querySelector('#btn-ask-expert').addEventListener('click', () => {
      root.innerHTML = '';
      if (window.prefillKaizenChat) {
        window.prefillKaizenChat(`Peux-tu m'expliquer un cas concret ou j'utiliserais l'outil ${tool.name} ?`);
      }
    });
    backdrop.querySelector('#btn-print-memo').addEventListener('click', () => {
      const w = window.open('', '_blank');
      w.document.write(`
        <html><head><title>Memo ${tool.name}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:30px;color:#202a33;}
          h1{color:#10243e;} li{margin-bottom:8px;}
        </style></head>
        <body>
          <h1>${tool.icon} ${tool.name} - Memo Kaizen</h1>
          <p>${tool.summary}</p>
          <ul>${tool.memo.map(x => `<li>${x}</li>`).join('')}</ul>
        </body></html>
      `);
      w.document.close();
      w.print();
    });

    root.appendChild(backdrop);
  }

  async function init() {
    const res = await fetch('/api/tools');
    tools = await res.json();
    renderFilters();
    renderGrid();
    document.getElementById('search').addEventListener('input', renderGrid);

    if (location.hash.startsWith('#tool-')) {
      const id = location.hash.replace('#tool-', '');
      const tool = tools.find(t => t.id === id);
      if (tool) openModal(tool);
    }
  }

  init();
})();
