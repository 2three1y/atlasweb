// Atlas Web: main page logic. The AI runs in worker.js, on this device.
const $ = (id) => document.getElementById(id);

const MODELS = [
  { id: 'atlas', name: 'Atlas', description: 'Flagship reasoning and deep knowledge',
    persona: 'You are Atlas, the flagship AI assistant providing rich, comprehensive, and well-structured answers.' },
  { id: 'hyperion', name: 'Hyperion', description: 'Wise father figure, authoritative and guiding wisdom',
    persona: 'You are Hyperion, the father of Atlas. You are a wise, steady, authoritative, and deeply experienced guiding voice.' },
  { id: 'astraea', name: 'Astraea', description: 'Warm mother figure, empathetic and nurturing intelligence',
    persona: 'You are Astraea, the mother of Atlas. You are a warm, caring, empathetic, encouraging, and deeply thoughtful companion.' },
  { id: 'prometheus', name: 'Prometheus', description: 'Quick-witted sibling, energetic and inventive companion',
    persona: 'You are Prometheus, the sibling of Atlas. You are energetic, clever, witty, quick-thinking, inventive, and fun to talk with.' },
];

const LENGTHS = [
  { id: 'concise', name: 'Concise / Short', description: 'Fast, direct and brief answers (about 80 words at most)', tokens: 256,
    rule: 'Keep your answer short and direct: one or two short paragraphs, under 80 words.' },
  { id: 'standard', name: 'Standard / Medium', description: 'Balanced length and clear explanations (about 250 words at most)', tokens: 512,
    rule: 'Give a balanced, medium-length answer under 250 words. Be clear and informative.' },
  { id: 'detailed', name: 'Detailed', description: 'Thorough and rich explanations (default)', tokens: 1024,
    rule: 'Give a rich, detailed and thorough answer with clear formatting and examples.' },
  { id: 'exhaustive', name: 'Exhaustive / Long', description: 'In-depth answers covering every aspect', tokens: 1536,
    rule: 'Give an exhaustive, deeply detailed answer that covers every aspect.' },
];

const VOICE_LANGUAGES = [
  ['en-US', 'English', 'Ready. How can I help you?'],
  ['fi-FI', 'Suomi (Finnish)', 'Valmis. Miten voin auttaa?'],
  ['es-ES', 'Español (Spanish)', 'Listo. ¿Cómo te puedo ayudar?'],
  ['fr-FR', 'Français (French)', 'Prêt. Comment puis-je vous aider ?'],
  ['de-DE', 'Deutsch (German)', 'Bereit. Wie kann ich helfen?'],
  ['it-IT', 'Italiano (Italian)', 'Pronto. Come posso aiutarti?'],
  ['pt-BR', 'Português (Portuguese)', 'Pronto. Como posso ajudar?'],
  ['ru-RU', 'Русский (Russian)', 'Готов. Чем могу помочь?'],
  ['zh-CN', '中文 (Chinese)', '准备就绪。有什么我可以帮您的？'],
  ['ja-JP', '日本語 (Japanese)', '準備完了です。お手伝いしましょうか？'],
  ['ko-KR', '한국어 (Korean)', '준비되었습니다. 무엇을 도와드릴까요?'],
  ['ar-SA', 'العربية (Arabic)', 'جاهز. كيف يمكنني مساعدتك؟'],
  ['hi-IN', 'हिन्दी (Hindi)', 'तैयार। मैं आपकी कैसे मदद कर सकता हूँ?'],
  ['tr-TR', 'Türkçe (Turkish)', 'Hazırım. Nasıl yardımcı olabilirim?'],
  ['nl-NL', 'Nederlands (Dutch)', 'Klaar. Hoe kan ik helpen?'],
  ['sv-SE', 'Svenska (Swedish)', 'Redo. Hur kan jag hjälpa till?'],
  ['pl-PL', 'Polski (Polish)', 'Gotowy. W czym mogę pomóc?'],
].map(([code, name, greeting]) => ({ code, name, greeting }));

const SUGGESTIONS = [
  ['Brainstorm ideas', 'Brainstorm 5 innovative ideas for a mobile app'],
  ['Write and debug code', 'Write a small JavaScript function that checks if a word is a palindrome, and explain it'],
  ['Write a script', 'Write an engaging video script for YouTube'],
  ['Summarize text', 'Summarize the key points of this text concisely: '],
  ['Translate to Finnish', "Translate this to Finnish: 'Welcome to my app'"],
  ['Translate to Persian', "Translate this to Persian: 'Hope you have a great day'"],
];

const TOOLS = [
  ['Fix grammar', 'Fix all grammar, spelling, and punctuation errors in this text.'],
  ['Make casual', 'Rewrite this text in a friendly and casual tone.'],
  ['Make professional', 'Rewrite this text to sound polished, professional, and clear.'],
  ['Shorten text', 'Make this text shorter and more direct.'],
  ['Summarize text', 'Summarize the key points of this text concisely.'],
  ['Translate to Finnish', 'Translate this text into fluent, natural Finnish.'],
  ['Translate to Persian', 'Translate this text into fluent, natural Persian (Farsi).'],
  ['Write a script', 'Write a captivating video script based on this topic.'],
];

const BASE_PROMPT = 'Atlas was created by Taha Armin. Reply in the same language the user writes in.';
const VOICE_RULE = 'Voice mode: speak directly to the user in first person. Answer in one brief, natural sentence of under 15 words. No lists, no markdown.';
const TOOL_PROMPT = 'You are Atlas Writing Tools. Return ONLY the final text, with no intro or outro like "Here is your text". ' +
  'Translations must be fluent and natural, with no explanations.';

const store = {
  get(key, fallback) { try { const v = localStorage.getItem('atlasweb.' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem('atlasweb.' + key, JSON.stringify(value)); } catch { /* storage full or blocked */ } },
};

// ---------- state ----------
let worker = null;
let ready = false;
let loading = null;
let busy = false;
let pending = null; // { id, onToken, resolve, reject }
let reqCounter = 0;
let sessions = store.get('sessions', []);
let current = newSession();

function newSession() {
  return { id: 'c' + Date.now().toString(36), title: '', messages: [], updated: Date.now() };
}

function setStatus(text) { $('status').textContent = text; }

// ---------- model ----------
function ensureWorker() {
  if (worker) return;
  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  worker.addEventListener('message', (e) => {
    const m = e.data;
    if (m.type === 'progress') {
      $('load-progress').value = m.percent;
      $('progress-text').textContent = m.percent + ' percent';
    } else if (m.type === 'ready') {
      ready = true;
      $('progress-row').hidden = true;
      $('load-button').textContent = 'Atlas is loaded';
      $('load-button').disabled = true;
      setStatus('Atlas is ready, running on your ' + (m.device === 'webgpu' ? 'graphics chip.' : 'processor. Answers may be slow.'));
      if (loading) { loading.resolve(); loading = null; }
    } else if (m.type === 'token') {
      if (pending && pending.id === m.id && pending.onToken) pending.onToken(m.text);
    } else if (m.type === 'done') {
      if (pending && pending.id === m.id) { const p = pending; pending = null; p.resolve(m.text); }
    } else if (m.type === 'error') {
      if (loading) {
        loading.reject(new Error(m.message)); loading = null;
        $('load-button').disabled = false;
        $('progress-row').hidden = true;
      } else if (pending) { const p = pending; pending = null; p.reject(new Error(m.message)); }
    }
  });
}

function loadModel() {
  if (ready) return Promise.resolve();
  if (loading) return loading.promise;
  ensureWorker();
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  loading = { promise, resolve, reject };
  $('load-button').disabled = true;
  $('progress-row').hidden = false;
  setStatus('Loading Atlas. The first time, this downloads about 500 megabytes.');
  worker.postMessage({ type: 'load' });
  return promise;
}

async function generate(messages, maxTokens, onToken, greedy = false) {
  await loadModel();
  const id = ++reqCounter;
  return new Promise((resolve, reject) => {
    pending = { id, onToken, resolve, reject };
    worker.postMessage({ type: 'generate', id, messages, maxTokens, greedy });
  });
}

function stopGeneration() { if (worker) worker.postMessage({ type: 'stop' }); }

// ---------- rendering ----------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

// A small, safe Markdown subset: code blocks, lists, headings as bold lines, paragraphs.
function renderMarkdown(text) {
  const out = [];
  const parts = text.split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const code = part.replace(/^[a-zA-Z0-9+#-]*\n/, '');
      out.push('<div class="code"><pre><code>' + escapeHtml(code.replace(/\n$/, '')) + '</code></pre>' +
        '<button type="button" class="copy-code">Copy code</button></div>');
      return;
    }
    const blocks = part.split(/\n{2,}/);
    for (const block of blocks) {
      const lines = block.split('\n').filter((l) => l.trim() !== '');
      if (!lines.length) continue;
      if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
        out.push('<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*•]\s+/, '')) + '</li>').join('') + '</ul>');
      } else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
        out.push('<ol>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*\d+[.)]\s+/, '')) + '</li>').join('') + '</ol>');
      } else {
        out.push('<p>' + lines.map((l) => /^#{1,6}\s/.test(l) ? '<strong>' + inline(l.replace(/^#{1,6}\s+/, '')) + '</strong>' : inline(l)).join('<br>') + '</p>');
      }
    }
  });
  return out.join('');
}

function speak(text, lang, onEnd) {
  if (!('speechSynthesis' in window)) { if (onEnd) onEnd(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ''));
  if (lang) u.lang = lang;
  u.onend = () => onEnd && onEnd();
  u.onerror = () => onEnd && onEnd();
  speechSynthesis.speak(u);
}

function messageElement(msg) {
  const li = document.createElement('li');
  li.className = 'message ' + (msg.role === 'user' ? 'from-user' : 'from-atlas');
  const h = document.createElement('h3');
  h.textContent = msg.role === 'user' ? 'You' : (msg.model || 'Atlas');
  const body = document.createElement('div');
  body.className = 'content';
  if (msg.role === 'user') body.textContent = msg.text; else body.innerHTML = renderMarkdown(msg.text);
  li.append(h, body);
  if (msg.role !== 'user') li.append(messageActions(msg));
  return li;
}

function messageActions(msg) {
  const row = document.createElement('div');
  row.className = 'button-row small';
  const copy = document.createElement('button');
  copy.type = 'button'; copy.textContent = 'Copy reply';
  copy.addEventListener('click', () => copyText(msg.text, 'Reply copied.'));
  row.append(copy);
  if (navigator.share) {
    const share = document.createElement('button');
    share.type = 'button'; share.textContent = 'Share reply';
    share.addEventListener('click', () => navigator.share({ title: 'Atlas Web', text: msg.text }).catch(() => {}));
    row.append(share);
  }
  const read = document.createElement('button');
  read.type = 'button'; read.textContent = 'Read aloud';
  read.addEventListener('click', () => speak(msg.text, document.documentElement.lang));
  row.append(read);
  return row;
}

function renderChat() {
  const list = $('messages');
  list.replaceChildren(...current.messages.map(messageElement));
  $('welcome').hidden = current.messages.length > 0;
}

async function copyText(text, done) {
  try { await navigator.clipboard.writeText(text); setStatus(done); }
  catch { setStatus('Copying is blocked in this browser.'); }
}

// ---------- chat ----------
function selected(list, id) { return list.find((x) => x.id === id) || list[0]; }

function buildMessages(extraRule) {
  const model = selected(MODELS, $('model-select').value);
  const length = selected(LENGTHS, $('length-select').value);
  // Short and plain: a small on-device model follows a short system prompt best.
  const system = model.persona + ' ' + BASE_PROMPT + ' ' + (extraRule || length.rule);
  // Like the app: the last 10 messages, alternating roles.
  const history = [];
  for (const m of current.messages.slice(-10)) {
    if (!m.text.trim()) continue;
    const role = m.role === 'user' ? 'user' : 'assistant';
    if (!history.length && role !== 'user') continue;
    if (history.length && history[history.length - 1].role === role) history[history.length - 1] = { role, content: m.text };
    else history.push({ role, content: m.text });
  }
  return [{ role: 'system', content: system }, ...history];
}

function setBusy(on) {
  busy = on;
  $('send-button').disabled = on;
  $('stop-button').hidden = !on;
  document.querySelectorAll('#tool-buttons button, #suggestions button').forEach((b) => { b.disabled = on; });
}

async function ask(text, { voice = false } = {}) {
  text = text.trim();
  if (!text || busy) return null;
  const model = selected(MODELS, $('model-select').value);
  const length = selected(LENGTHS, $('length-select').value);
  current.messages.push({ role: 'user', text });
  if (!current.title) current.title = text.slice(0, 60);
  renderChat();
  const reply = { role: 'assistant', text: '', model: model.name };
  current.messages.push(reply);
  const el = messageElement(reply);
  $('messages').append(el);
  const body = el.querySelector('.content');
  body.textContent = '…';
  setBusy(true);
  try {
    if (!ready) await loadModel();
    setStatus('Atlas is thinking...');
    const finalText = await generate(buildMessages(voice ? VOICE_RULE : null), voice ? 60 : length.tokens, (t) => { body.textContent = t; });
    reply.text = finalText || '(No answer)';
    el.replaceWith(messageElement(reply));
    setStatus(model.name + ' replied.');
    if (!voice && $('speak-replies').checked) speak(reply.text, document.documentElement.lang);
    saveSession();
    return reply.text;
  } catch (err) {
    reply.text = 'Atlas AI Error: ' + err.message;
    el.replaceWith(messageElement(reply));
    setStatus('Something went wrong: ' + err.message);
    return null;
  } finally {
    setBusy(false);
  }
}

function saveSession() {
  current.updated = Date.now();
  sessions = sessions.filter((s) => s.id !== current.id);
  if (current.messages.length) sessions.unshift(JSON.parse(JSON.stringify(current)));
  sessions = sessions.slice(0, 50);
  store.set('sessions', sessions);
  renderHistory();
}

// ---------- history ----------
function renderHistory() {
  const q = $('history-search').value.trim().toLowerCase();
  const list = $('history-list');
  const items = sessions.filter((s) => !q || s.title.toLowerCase().includes(q) ||
    s.messages.some((m) => m.text.toLowerCase().includes(q)));
  list.replaceChildren(...items.map((s) => {
    const li = document.createElement('li');
    const open = document.createElement('button');
    open.type = 'button';
    const when = new Date(s.updated).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    open.textContent = 'Open chat: ' + (s.title || 'Untitled') + ', ' + when;
    open.addEventListener('click', () => {
      current = JSON.parse(JSON.stringify(s));
      renderChat();
      setStatus('Opened chat: ' + (s.title || 'Untitled') + '.');
      $('chat-heading').focus();
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'quiet';
    del.textContent = 'Delete chat: ' + (s.title || 'Untitled');
    del.addEventListener('click', () => {
      sessions = sessions.filter((x) => x.id !== s.id);
      store.set('sessions', sessions);
      renderHistory();
      setStatus('Chat deleted.');
      $('history-search').focus();
    });
    li.append(open, del);
    return li;
  }));
  $('history-empty').hidden = items.length > 0;
  $('history-empty').textContent = sessions.length ? 'No chats match your search.' : 'No saved chats yet.';
}

// ---------- speech recognition ----------
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function listenOnce(lang) {
  return new Promise((resolve, reject) => {
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let got = '';
    rec.onresult = (e) => { got = e.results[0][0].transcript; };
    rec.onerror = (e) => reject(new Error(e.error === 'no-speech' ? 'No speech input detected' : 'Listening failed: ' + e.error));
    rec.onend = () => resolve(got);
    voice.rec = rec;
    rec.start();
  });
}

const voice = { active: false, rec: null };

async function voiceLoop() {
  const lang = selected(VOICE_LANGUAGES.map((l) => ({ ...l, id: l.code })), $('voice-language').value);
  while (voice.active) {
    $('voice-state').textContent = 'Listening...';
    let heard = '';
    try { heard = await listenOnce(lang.code); }
    catch (err) { $('voice-state').textContent = err.message; if (!voice.active) break; continue; }
    if (!voice.active) break;
    if (!heard.trim()) continue;
    $('voice-state').textContent = 'Atlas is thinking...';
    const answer = await ask(heard, { voice: true });
    if (!voice.active || !answer) continue;
    $('voice-state').textContent = 'Atlas is speaking...';
    await new Promise((res) => speak(answer, lang.code, res));
  }
}

async function startVoice() {
  voice.active = true;
  $('voice-start').hidden = true;
  $('voice-end').hidden = false;
  $('voice-end').focus();
  try { await loadModel(); } catch (err) { endVoice(); setStatus('Could not load Atlas: ' + err.message); return; }
  const lang = VOICE_LANGUAGES.find((l) => l.code === $('voice-language').value) || VOICE_LANGUAGES[0];
  $('voice-state').textContent = 'Atlas is speaking...';
  await new Promise((res) => speak(lang.greeting, lang.code, res));
  voiceLoop();
}

function endVoice() {
  voice.active = false;
  try { voice.rec && voice.rec.abort(); } catch { /* already stopped */ }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (busy) stopGeneration();
  $('voice-end').hidden = true;
  $('voice-start').hidden = false;
  $('voice-start').focus();
  $('voice-state').textContent = 'Voice chat is off.';
}

// ---------- writing tools ----------
// Small models like to add "Sure! Here is..." even when told not to. Keep only the text.
function cleanToolResult(text) {
  let t = text.trim().replace(/^(sure|certainly|of course|here)[^\n]*:\s*\n+/i, '').trim();
  if (/^["“].*["”]$/s.test(t)) t = t.slice(1, -1).trim();
  return t;
}

async function runTool(name, instruction) {
  const text = $('tool-input').value.trim();
  if (!text) { setStatus('Type or paste some text first.'); $('tool-input').focus(); return; }
  if (busy) return;
  setBusy(true);
  const out = $('tool-output');
  out.value = '';
  try {
    if (!ready) await loadModel();
    setStatus(name + ': working...');
    const messages = [
      { role: 'system', content: TOOL_PROMPT },
      { role: 'user', content: 'User instruction: ' + instruction + '\n\nContext/Text to operate on:\n' + text },
    ];
    const result = await generate(messages, 512, (t) => { out.value = t; }, true);
    out.value = cleanToolResult(result);
    setStatus(name + ': result ready.');
  } catch (err) {
    setStatus('Something went wrong: ' + err.message);
  } finally {
    setBusy(false);
  }
}

// ---------- setup ----------
function fillSelect(select, items, valueKey, saved) {
  for (const item of items) {
    const o = document.createElement('option');
    o.value = item[valueKey];
    o.textContent = item.name;
    select.append(o);
  }
  if (saved && items.some((i) => i[valueKey] === saved)) select.value = saved;
}

function init() {
  fillSelect($('model-select'), MODELS, 'id', store.get('model', 'atlas'));
  fillSelect($('length-select'), LENGTHS, 'id', store.get('length', 'detailed'));
  fillSelect($('voice-language'), VOICE_LANGUAGES, 'code', store.get('voice', 'en-US'));
  $('speak-replies').checked = store.get('speak', false);

  const describe = () => {
    $('model-description').textContent = selected(MODELS, $('model-select').value).description;
    $('length-description').textContent = selected(LENGTHS, $('length-select').value).description;
  };
  $('model-select').setAttribute('aria-describedby', 'model-description');
  $('length-select').setAttribute('aria-describedby', 'length-description');
  describe();
  $('model-select').addEventListener('change', () => { store.set('model', $('model-select').value); describe(); });
  $('length-select').addEventListener('change', () => { store.set('length', $('length-select').value); describe(); });
  $('voice-language').addEventListener('change', () => store.set('voice', $('voice-language').value));
  $('speak-replies').addEventListener('change', () => store.set('speak', $('speak-replies').checked));

  $('load-button').addEventListener('click', () => loadModel().catch((err) => setStatus('Could not load Atlas: ' + err.message)));

  for (const [label, prompt] of SUGGESTIONS) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => {
      const p = $('prompt');
      p.value = prompt;
      p.focus();
      p.setSelectionRange(p.value.length, p.value.length);
    });
    li.append(b);
    $('suggestions').append(li);
  }

  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('prompt').value;
    if (!text.trim()) { setStatus('Type a message first.'); $('prompt').focus(); return; }
    $('prompt').value = '';
    ask(text);
  });
  $('prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('chat-form').requestSubmit(); }
  });
  $('stop-button').addEventListener('click', () => { stopGeneration(); setStatus('Stopped.'); $('prompt').focus(); });
  $('new-chat-button').addEventListener('click', () => {
    if (current.messages.length) saveSession();
    current = newSession(); renderChat(); setStatus('New chat started.'); $('prompt').focus();
  });
  $('clear-button').addEventListener('click', () => {
    sessions = sessions.filter((s) => s.id !== current.id);
    store.set('sessions', sessions);
    current = newSession(); renderChat(); renderHistory(); setStatus('Conversation cleared.'); $('prompt').focus();
  });

  $('messages').addEventListener('click', (e) => {
    const b = e.target.closest('.copy-code');
    if (b) copyText(b.parentElement.querySelector('code').textContent, 'Code copied.');
  });

  if (Recognition) {
    $('dictate-button').addEventListener('click', async () => {
      try {
        setStatus('Listening...');
        const said = await listenOnce($('voice-language').value);
        if (said) { $('prompt').value = ($('prompt').value + ' ' + said).trim(); setStatus('Added what you said to the message box.'); }
        else setStatus('No speech match.');
        $('prompt').focus();
      } catch (err) { setStatus(err.message); }
    });
    $('voice-start').addEventListener('click', startVoice);
    $('voice-end').addEventListener('click', endVoice);
  } else {
    $('dictate-button').hidden = true;
    $('voice-start').disabled = true;
    $('voice-support').hidden = false;
  }

  for (const [name, instruction] of TOOLS) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = name;
    b.addEventListener('click', () => runTool(name, instruction));
    li.append(b);
    $('tool-buttons').append(li);
  }
  $('tool-copy').addEventListener('click', () => {
    const v = $('tool-output').value;
    if (v) copyText(v, 'Result copied.'); else setStatus('There is no result to copy yet.');
  });

  $('history-search').addEventListener('input', renderHistory);
  renderChat();
  renderHistory();
}

init();
