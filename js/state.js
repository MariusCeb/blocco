

const CLRS    = ['red','orange','yellow','green','blue','purple','pink','teal','lime'];
const CLRHEX  = {red:'#f87171',orange:'#fb923c',yellow:'#facc15',green:'#4ade80',blue:'#60a5fa',purple:'#a78bfa',pink:'#f472b6',teal:'#2dd4bf',lime:'#a3e635'};
const TRASH_TTL = 30 * 86400e3;

let S;
let curTab = 'prom';
let q = '';
let eId = null, eType = null, ePick = null;
let dSrcId = null, dOvId = null, dGhost = null;
let focusType = null, focusId = null, focusColor = null, autoSaveTimer = null;
let secretMode = false;
let curFolder = null;

const SLASH_DEFS = [
  { cmd:'/subtitle', hint:'sottotitolo  1.0'     },
  { cmd:'/section',  hint:'sezione  1.1'         },
  { cmd:'/hr',       hint:'separatore'           },
  { cmd:'/todo',     hint:'checkbox  [ ]'        },
  { cmd:'/datetime', hint:'data e ora correnti'  },
  { cmd:'/quote',    hint:'citazione rientrata'  },
  { cmd:'/link',     hint:'inserisci link'       },
];

function curProms() { return S.proms; }
function curIdee()  { return S.idee;  }

const SECRET_SWAP_KEYS = ['proms','idee','liste','folders','folderNotes','cestino'];

function swappedState(state) {
  const copy = {...state, secret: {...state.secret}};
  SECRET_SWAP_KEYS.forEach(k => { copy[k] = state.secret[k]; copy.secret[k] = state[k]; });
  return copy;
}

function toggleSecretMode() {
  secretMode = !secretMode;
  const dot = document.querySelector('.vbig .hl');
  if (dot) dot.style.color = secretMode ? '#e94560' : '';

  S = swappedState(S);

  q = '';
  goTab('prom');
  renderAll();
}

function load() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem('blocco') || '{}'));
  } catch {
    return defaultState();
  }
}

const KIND_TRASH_TYPE = {prom:'prom', idee:'idee', liste:'liste', folderNote:'folder'};
const TRASH_TYPE_KIND = {prom:'prom', idee:'idee', liste:'liste', folder:'folderNote'};

function _noteItem(n, kind, extra) {
  return {
    id: n.id, kind,
    text: n.text, title: n.title, color: n.color,
    pinned: n.pinned, collapsed: n.collapsed,
    created: n.created, updated: n.updated,
    deadline: n.deadline,
    trashed: false, deletedAt: null,
    ...extra
  };
}

function _listItem(l, extra) {
  return {
    id: l.id, kind: 'liste',
    title: l.title, items: l.items, color: l.color,
    pinned: l.pinned, collapsed: l.collapsed,
    created: l.created, updated: l.updated,
    trashed: false, deletedAt: null,
    ...extra
  };
}

function itemsFromState(state) {
  const out = [{id: '_meta', kind: 'meta', name: state.name, theme: state.theme}];

  function pushWorld(w, secret) {
    w.folders.forEach((f, i) => out.push({id: f.id, kind: 'folder', name: f.name, color: f.color, secret, order: i}));
    w.proms.forEach((n, i) => out.push(_noteItem(n, 'prom', {secret, order: i})));
    w.idee.forEach((n, i) => out.push(_noteItem(n, 'idee', {secret, order: i})));
    w.folderNotes.forEach((n, i) => out.push(_noteItem(n, 'folderNote', {folder: n.folder ?? null, parked: n.parked === true, secret, order: i})));
    w.liste.forEach((l, i) => out.push(_listItem(l, {secret, order: i})));
    w.cestino.forEach((t, i) => {
      const kind = TRASH_TYPE_KIND[t.type] || 'prom';
      if (kind === 'liste') out.push(_listItem(t, {secret, trashed: true, deletedAt: t.deletedAt, order: i}));
      else out.push(_noteItem(t, kind, {
        secret, trashed: true, deletedAt: t.deletedAt,
        ...(kind === 'folderNote' ? {folder: t.folder ?? null} : {}),
        order: i
      }));
    });
  }

  pushWorld(state, false);
  pushWorld(state.secret, true);
  return out;
}

function stateFromItems(items, fallbackName) {
  const used = new Set();
  const meta  = items.find(it => it.kind === 'meta') || {};
  const state = defaultState(str(meta.name, 200) || fallbackName);
  state.theme = safeTheme(meta.theme);

  const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

  const folderRawPub = items.filter(it => it.kind === 'folder' && !it.secret).sort(byOrder);
  const folderRawSec = items.filter(it => it.kind === 'folder' && it.secret).sort(byOrder);
  state.folders        = arr(folderRawPub, 200).map(f => normalizeFolder(f, used)).filter(f => f.name);
  state.secret.folders = arr(folderRawSec, 200).map(f => normalizeFolder(f, used)).filter(f => f.name);
  const folderIds       = new Set(state.folders.map(f => f.id));
  const secretFolderIds = new Set(state.secret.folders.map(f => f.id));

  const b = {
    proms: [], idee: [], folderNotes: [], liste: [], cestino: [],
    sProms: [], sIdee: [], sFolderNotes: [], sListe: [], sCestino: []
  };
  items.forEach(it => {
    if (it.kind === 'meta' || it.kind === 'folder') return;
    if (it.trashed) {
      (it.secret ? b.sCestino : b.cestino).push(it);
    } else if (it.kind === 'prom') {
      (it.secret ? b.sProms : b.proms).push(it);
    } else if (it.kind === 'idee') {
      (it.secret ? b.sIdee : b.idee).push(it);
    } else if (it.kind === 'folderNote') {
      (it.secret ? b.sFolderNotes : b.folderNotes).push(it);
    } else if (it.kind === 'liste') {
      (it.secret ? b.sListe : b.liste).push(it);
    }
  });

  state.proms        = b.proms.sort(byOrder).slice(0, 500).map(n => normalizeNote(n, used));
  state.idee         = b.idee.sort(byOrder).slice(0, 500).map(n => normalizeNote(n, used));
  state.folderNotes  = b.folderNotes.sort(byOrder).slice(0, 500).map(n => normalizeNote(n, used, folderIds));
  state.liste        = b.liste.sort(byOrder).slice(0, 200).map(l => normalizeList(l, used));
  state.cestino      = b.cestino.sort(byOrder).slice(0, 500).map(t =>
    normalizeTrash({...t, type: KIND_TRASH_TYPE[t.kind] || 'prom'}, used, folderIds)
  );

  state.secret.proms       = b.sProms.sort(byOrder).slice(0, 500).map(n => normalizeNote(n, used));
  state.secret.idee        = b.sIdee.sort(byOrder).slice(0, 500).map(n => normalizeNote(n, used));
  state.secret.folderNotes = b.sFolderNotes.sort(byOrder).slice(0, 500).map(n => normalizeNote(n, used, secretFolderIds));
  state.secret.liste       = b.sListe.sort(byOrder).slice(0, 200).map(l => normalizeList(l, used));
  state.secret.cestino     = b.sCestino.sort(byOrder).slice(0, 500).map(t =>
    normalizeTrash({...t, type: KIND_TRASH_TYPE[t.kind] || 'prom'}, used, secretFolderIds)
  );

  return state;
}

function persist() {
  S = normalizeState(S, S?.name || 'Marius');
  const canonical = secretMode ? swappedState(S) : S;
  localStorage.setItem('blocco', JSON.stringify(canonical));
  if (window._fbUser && window._fbDb && window._cloudReady) {
    _syncItemsToCloud(canonical);
  }
}

function _syncItemsToCloud(canonicalState) {
  const itemsRef = window._fbDb.collection('users').doc(window._fbUser.uid).collection('items');
  const current  = itemsFromState(canonicalState);
  const currentMap = new Map(current.map(it => [it.id, it]));
  const last = window._fbLastItems || new Map();

  const batch = window._fbDb.batch();
  let ops = 0;
  currentMap.forEach((it, id) => {
    if (last.get(id) !== JSON.stringify(it)) { batch.set(itemsRef.doc(id), it); ops++; }
  });
  last.forEach((_, id) => {
    if (!currentMap.has(id)) { batch.delete(itemsRef.doc(id)); ops++; }
  });

  window._fbLastItems = new Map(current.map(it => [it.id, JSON.stringify(it)]));
  if (ops > 0) batch.commit().catch(() => {});
}

function uid() {
  if (globalThis.crypto?.getRandomValues) {
    const a = new Uint32Array(2);
    globalThis.crypto.getRandomValues(a);
    return Date.now().toString(36) + a[0].toString(36) + a[1].toString(36);
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2,12);
}

function defaultState(name='Marius') {
  return {
    name, proms:[], idee:[], liste:[], cestino:[], theme:'dark', folders:[], folderNotes:[],
    secret: {proms:[], idee:[], liste:[], cestino:[], folders:[], folderNotes:[]}
  };
}

function str(v, max=20000) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function arr(v, max=500) {
  return Array.isArray(v) ? v.slice(0, max) : [];
}

function safeId(v, used) {
  const s = str(v, 64);
  const id = /^[A-Za-z0-9_-]{1,64}$/.test(s) && !used.has(s) ? s : uid();
  used.add(id);
  return id;
}

function safeTs(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 4102444800000 ? n : Date.now();
}

function safeDeadline(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 4102444800000 ? n : null;
}

function safeColor(v) {
  return CLRS.includes(v) ? v : null;
}

function safeTheme(v) {
  return ['dark','light','gruvbox'].includes(v) ? v : 'dark';
}

function normalizeNote(n, used, folderIds=null) {
  const x = n && typeof n === 'object' ? n : {};
  const note = {
    id: safeId(x.id, used),
    text: str(x.text),
    title: str(x.title, 300),
    color: safeColor(x.color),
    pinned: x.pinned === true,
    collapsed: x.collapsed === true,
    created: safeTs(x.created),
    updated: safeTs(x.updated),
    deadline: safeDeadline(x.deadline)
  };
  if (folderIds) note.folder = folderIds.has(x.folder) ? x.folder : null;
  if (x.parked === true) note.parked = true;
  return note;
}

function normalizeListItem(x, used) {
  const item = x && typeof x === 'object' ? x : {};
  return {id: safeId(item.id, used), text: str(item.text, 1000), done: item.done === true};
}

function normalizeList(x, used) {
  const l = x && typeof x === 'object' ? x : {};
  return {
    id: safeId(l.id, used),
    title: str(l.title, 300),
    items: arr(l.items, 1000).map(i => normalizeListItem(i, used)),
    color: safeColor(l.color),
    pinned: l.pinned === true,
    collapsed: l.collapsed === true,
    created: safeTs(l.created),
    updated: safeTs(l.updated)
  };
}

function normalizeFolder(x, used) {
  const f = x && typeof x === 'object' ? x : {};
  return {id: safeId(f.id, used), name: str(f.name, 200), color: safeColor(f.color)};
}

function normalizeTrash(x, used, folderIds) {
  const t = x && typeof x === 'object' ? x : {};
  const type = ['prom','idee','liste','folder'].includes(t.type) ? t.type : 'prom';
  const base = type === 'liste' ? normalizeList(t, used) : normalizeNote(t, used, folderIds);
  return {...base, type, deletedAt: safeTs(t.deletedAt)};
}

function normalizeState(raw, fallbackName='Marius') {
  const d = raw && typeof raw === 'object' ? raw : {};
  const used = new Set();
  const state = defaultState(str(d.name, 200) || fallbackName);
  state.theme = safeTheme(d.theme);

  state.folders = arr(d.folders, 200).map(f => normalizeFolder(f, used)).filter(f => f.name);
  const folderIds = new Set(state.folders.map(f => f.id));
  state.proms = arr(d.proms).map(n => normalizeNote(n, used));
  state.idee = arr(d.idee).map(n => normalizeNote(n, used));
  state.liste = arr(d.liste, 200).map(l => normalizeList(l, used));
  state.folderNotes = arr(d.folderNotes).map(n => normalizeNote(n, used, folderIds));
  state.cestino = arr(d.cestino, 500).map(n => normalizeTrash(n, used, folderIds));

  const sec = d.secret && typeof d.secret === 'object' ? d.secret : {};
  state.secret.folders = arr(sec.folders, 200).map(f => normalizeFolder(f, used)).filter(f => f.name);
  const secretFolderIds = new Set(state.secret.folders.map(f => f.id));
  state.secret.proms = arr(sec.proms).map(n => normalizeNote(n, used));
  state.secret.idee = arr(sec.idee).map(n => normalizeNote(n, used));
  state.secret.liste = arr(sec.liste, 200).map(l => normalizeList(l, used));
  state.secret.folderNotes = arr(sec.folderNotes).map(n => normalizeNote(n, used, secretFolderIds));
  state.secret.cestino = arr(sec.cestino, 500).map(n => normalizeTrash(n, used, secretFolderIds));

  return state;
}

S = load();

function fmtTs(t) {
  const d    = new Date(t);
  const time = d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  const date = d.toLocaleDateString('it-IT',  {day:'2-digit', month:'2-digit', year:'numeric'});
  return '[' + time + ' · ' + date + ']';
}

function fmtTrashExp(deletedAt) {
  const days = Math.ceil((deletedAt + TRASH_TTL - Date.now()) / 86400e3);
  if (days <= 0) return 'scaduto';
  if (days === 1) return 'scade domani';
  return 'scade tra ' + days + 'g';
}

function esc(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function attr(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function safeHref(raw) {
  try {
    const u = new URL(String(raw || '').trim(), location.href);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : '';
  } catch {
    return '';
  }
}

function cssId(s) {
  return globalThis.CSS?.escape ? CSS.escape(String(s)) : String(s).replace(/["\\\]]/g, '\\$&');
}

const _SANITIZE_CFG = {
  ALLOWED_TAGS: ['b','i','u','s','strong','em','span','br','div','p','a','h1','h2','h3','h4','h5','h6','hr','ul','ol','li','blockquote'],
  ALLOWED_ATTR: ['class','style','href','target','rel'],
  ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i
};
function _sanitize(html) {
  if (typeof DOMPurify === 'undefined') return esc(html);
  const tpl = document.createElement('template');
  tpl.innerHTML = DOMPurify.sanitize(html, _SANITIZE_CFG);
  tpl.content.querySelectorAll('[style]').forEach(el => {
    const color = el.style.color;
    el.removeAttribute('style');
    if (color && !/url|expression|javascript/i.test(color)) el.style.color = color;
  });
  tpl.content.querySelectorAll('a[href]').forEach(a => {
    const href = safeHref(a.getAttribute('href'));
    if (!href) a.removeAttribute('href');
    else {
      a.setAttribute('href', href);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return tpl.innerHTML;
}

function md(s) {
  if (!s) return '';

  if (/<br|<b>|<i>|<span|<h[1-6]|<div|<hr/i.test(s)) {
    return _sanitize(s)
      .replace(/\[ \] /g, '<span class="cb cb-open">○</span> ')
      .replace(/\[x\] /g,  '<span class="cb cb-done">✓</span> ');
  }

  return s
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/_(.+?)_/g,'<i>$1</i>')
    .replace(/\{(red|orange|yellow|green|blue|purple|pink|teal|lime)\}([\s\S]*?)\{\/\}/g,
      (_,c,t) => `<span style="color:${CLRHEX[c]}">${t}</span>`)
    .replace(/\{big\}([\s\S]*?)\{\/\}/g,'<span class="mbig">$1</span>')
    .replace(/\{small\}([\s\S]*?)\{\/\}/g,'<span class="msmall">$1</span>')
    .replace(/(^|\n)\[x\] /g,'$1<span class="cb cb-done">✓</span> ')
    .replace(/(^|\n)\[ \] /g,'$1<span class="cb cb-open">○</span> ')
    .replace(/\n/g,'<br>');
}

function mdCard(text, id, tp) {
  if (!text) return '';
  let n = 0;
  if (/<br|<b>|<i>|<span|<h[1-6]|<div|<hr/i.test(text)) {

    return _sanitize(text).replace(/\[([ x])\] /g, (_, c) =>
      `<span class="cb ${c===' '?'cb-open':'cb-done'}" onclick="event.stopPropagation();toggleCb('${id}','${tp}',${n++})">${c===' '?'○':'✓'}</span> `);
  }
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')
    .replace(/_(.+?)_/g,'<i>$1</i>')
    .replace(/\{(red|orange|yellow|green|blue|purple|pink|teal|lime)\}([\s\S]*?)\{\/\}/g,
      (_,c,t) => `<span style="color:${CLRHEX[c]}">${t}</span>`)
    .replace(/\{big\}([\s\S]*?)\{\/\}/g,'<span class="mbig">$1</span>')
    .replace(/\{small\}([\s\S]*?)\{\/\}/g,'<span class="msmall">$1</span>')
    .replace(/(^|\n)\[([ x])\] /g, (_, pre, c) =>
      `${pre}<span class="cb ${c===' '?'cb-open':'cb-done'}" onclick="event.stopPropagation();toggleCb('${id}','${tp}',${n++})">${c===' '?'○':'✓'}</span> `)
    .replace(/\n/g,'<br>');
}

function toggleCb(id, tp, idx) {
  let arr;
  if      (tp === 'prom')   arr = S.proms;
  else if (tp === 'idee')   arr = S.idee;
  else if (tp === 'folder') arr = S.folderNotes;
  else return;
  const it = arr.find(x => x.id === id); if (!it) return;
  let n = 0;
  it.text = it.text.replace(/\[([ x])\] /g, (m, c) => n++ === idx ? (c === ' ' ? '[x] ' : '[ ] ') : m);
  persist();
  if      (tp === 'prom')   renderProms();
  else if (tp === 'idee')   renderIdee();
  else                      renderFolder();
}

function _stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function toLocalDatetimeInput(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDeadline(ts) {
  const diff = ts - Date.now();
  if (diff <= 0) return 'SCADUTO';
  const m = Math.floor(diff / 60e3);
  const h = Math.floor(diff / 3600e3);
  const d = Math.floor(diff / 86400e3);
  if (d >= 2) return `↓ ${d}g`;
  if (d === 1) return '↓ domani';
  if (h >= 1)  return `↓ ${h}h`;
  return `↓ ${m}m`;
}
function deadlineProgress(item) {
  if (!item.deadline) return 0;
  const total = item.deadline - item.created;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (Date.now() - item.created) / total));
}
function deadlineBar(item) {
  if (!item.deadline) return '';
  const p = deadlineProgress(item);
  const pct = (p * 100).toFixed(1);
  const col = item.color ? CLRHEX[item.color] : 'var(--accent)';
  const pulse = p >= 1 ? ';animation:deadlinePulse 1.2s ease-in-out infinite' : '';
  return `<div class="deadline-bar"><div class="deadline-fill" style="width:${pct}%;background:${col}${pulse}"></div></div>`;
}
function deadlineTag(item) {
  if (!item.deadline) return '';
  const p = deadlineProgress(item);
  return ` · <span class="dl-lbl${p >= 1 ? ' expired' : ''}">${fmtDeadline(item.deadline)}</span>`;
}

function matches(arr) { return !q || arr.some(s => s && s.toLowerCase().includes(q)); }

function clrCls(c) { return c ? ' clr-'+c : ''; }
function buildClrPick(elId, sel) {
  document.getElementById(elId).innerHTML = ['none',...CLRS].map(c => `
    <div class="clrdot${c==='none'?' clrnone':''}${(sel||'none')===c?' sel':''}"
      style="${c!=='none' ? 'background:'+CLRHEX[c] : ''}"
      onclick="pickClr('${elId}','${c}')"></div>
  `).join('');
}

function applyTwemoji(el) {
  if (typeof twemoji === 'undefined') return;
  twemoji.parse(el || document.body, {
    base:'https://abs.twimg.com/emoji/v2/', folder:'svg', ext:'.svg'
  });
}

function updateDatetime() {
  const now = new Date();
  const d = now.toLocaleDateString('it-IT', {day:'numeric', month:'short', year:'numeric'});
  const t = now.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  const el = document.getElementById('vdate-lbl');
  if (el) el.textContent = d + ' — ' + t + ' [v42]';
}

function updateStats() {
  const badge = document.getElementById('cestino-badge');
  if (badge) badge.textContent = S.cestino.length ? ' [' + S.cestino.length + ']' : '';
  const cp = document.getElementById('cnt-prom');
  const ci = document.getElementById('cnt-idee');
  const cl = document.getElementById('cnt-liste');
  if (cp) cp.textContent = S.proms.length ? S.proms.length : '';
  if (ci) ci.textContent = S.idee.length ? S.idee.length : '';
  if (cl) cl.textContent = S.liste.length ? S.liste.length : '';
}
