(function () {
  let mode = 'local';
  let aiAvailable = false;
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
          <div class="chat-mode-toggle">
            <button data-mode="local" class="active">Local</button>
            <button data-mode="ai">IA</button>
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
      document.getElementById('kaizen-chat-panel').classList.toggle('open');
    });

    document.querySelectorAll('.chat-mode-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.mode === 'ai' && !aiAvailable) {
          addNotice("Mode IA non configure sur ce serveur (variable ANTHROPIC_API_KEY absente). Le moteur local repondra a la place.");
        }
        mode = btn.dataset.mode;
        document.querySelectorAll('.chat-mode-toggle button').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('kaizen-chat-send').addEventListener('click', sendMessage);
    document.getElementById('kaizen-chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage();
    });

    addBotMessage("Bonjour, je suis l'expert Lean. Decris-moi un probleme terrain (qualite, delai, panne, organisation, changement de serie...) et je t'orienterai vers le ou les outils Kaizen adaptes.");

    fetch('/api/chat/status').then(r => r.json()).then(d => {
      aiAvailable = Boolean(d.aiAvailable);
    }).catch(() => {});
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
    document.getElementById('kaizen-chat-panel').classList.add('open');
    document.getElementById('kaizen-chat-input').value = text;
    document.getElementById('kaizen-chat-input').focus();
  };
})();
