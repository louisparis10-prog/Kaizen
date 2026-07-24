(function () {
  const mode = 'ai';
  let toolsById = {};

  fetch('/api/tools').then(r => r.json()).then(list => {
    list.forEach(t => { toolsById[t.id] = t; });
  }).catch(() => {});

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function buildWidget() {
    document.body.appendChild(el(`
      <button id="kaizen-chat-toggle" title="Ouvrir le chat expert Lean">💬</button>
    `));
    document.body.appendChild(el(`
      <div id="kaizen-chat-panel">
        <div class="chat-header">
          <div>
            <div class="title">🥋 Expert Lean - Ceinture Noire</div>
            <div class="subtitle">Pose ta question sur un chantier Kaizen</div>
          </div>
        </div>
        <div class="chat-messages" id="kaizen-chat-messages"></div>
        <div class="chat-input-row">
          <input type="text" id="kaizen-chat-input" placeholder="Ex : nos changements de format durent 45 min...">
          <button id="kaizen-chat-send">Envoyer</button>
        </div>
      </div>
    `));

    document.getElementById('kaizen-chat-toggle').addEventListener('click', () => {
      const panel = document.getElementById('kaizen-chat-panel');
      if (panel.classList.contains('open')) closeChat();
      else openChat();
    });

    document.getElementById('kaizen-chat-send').addEventListener('click', sendMessage);
    document.getElementById('kaizen-chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage();
    });

    addBotMessage("Bonjour, je suis l'expert Lean. Decris-moi un probleme terrain (qualite, delai, panne, organisation, changement de serie...) et je t'orienterai vers le ou les outils Kaizen adaptes.");
  }

  // Ferme le chat si on clique en dehors du panneau (et pas sur la bulle).
  function outsideClick(e) {
    const panel = document.getElementById('kaizen-chat-panel');
    const toggle = document.getElementById('kaizen-chat-toggle');
    if (panel.contains(e.target) || toggle.contains(e.target)) return;
    closeChat();
  }

  function openChat() {
    document.getElementById('kaizen-chat-panel').classList.add('open');
    // Attache le listener au tour suivant pour ne pas capter le clic d'ouverture lui-meme.
    setTimeout(() => document.addEventListener('click', outsideClick), 0);
  }

  function closeChat() {
    document.getElementById('kaizen-chat-panel').classList.remove('open');
    document.removeEventListener('click', outsideClick);
  }

  function scrollToBottom() {
    const box = document.getElementById('kaizen-chat-messages');
    box.scrollTop = box.scrollHeight;
  }

  function addUserMessage(text) {
    const box = document.getElementById('kaizen-chat-messages');
    box.appendChild(el(`<div class="chat-msg user"></div>`)).textContent = text;
    scrollToBottom();
  }

  function addNotice(text) {
    const box = document.getElementById('kaizen-chat-messages');
    box.appendChild(el(`<div class="chat-msg notice"></div>`)).textContent = text;
    scrollToBottom();
  }

  function addBotMessage(text, tools) {
    const box = document.getElementById('kaizen-chat-messages');
    const wrap = el(`<div class="chat-msg bot"></div>`);
    wrap.textContent = text;
    if (tools && tools.length) {
      const toolsWrap = el(`<div class="chat-tools"></div>`);
      tools.forEach(id => {
        const a = el(`<a href="/index.html#tool-${id}"></a>`);
        a.textContent = '🔧 ' + (toolsById[id] ? toolsById[id].name : id);
        toolsWrap.appendChild(a);
      });
      wrap.appendChild(toolsWrap);
    }
    box.appendChild(wrap);
    scrollToBottom();
  }

  async function sendMessage() {
    const input = document.getElementById('kaizen-chat-input');
    const message = input.value.trim();
    if (!message) return;
    addUserMessage(message);
    input.value = '';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, mode })
      });
      const data = await res.json();
      if (data.notice) addNotice(data.notice);
      addBotMessage(data.text, data.tools);
    } catch (err) {
      addNotice("Erreur de connexion au serveur.");
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }

  window.prefillKaizenChat = function (text) {
    openChat();
    document.getElementById('kaizen-chat-input').value = text;
    document.getElementById('kaizen-chat-input').focus();
  };
})();
