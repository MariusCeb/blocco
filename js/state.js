// ══════════════════════════════════════════════════════════
// COSTANTI
// CLRS: lista dei nomi dei colori disponibili per le etichette
// CLRHEX: mappa nome → codice colore hex (per disegnare i pallini)
// TRASH_TTL: quanto tempo tenere gli elementi nel cestino (30 giorni in ms)
// ══════════════════════════════════════════════════════════
const CLRS    = ['red','orange','yellow','green','blue','purple','pink','teal','lime'];
const CLRHEX  = {red:'#f87171',orange:'#fb923c',yellow:'#facc15',green:'#4ade80',blue:'#60a5fa',purple:'#a78bfa',pink:'#f472b6',teal:'#2dd4bf',lime:'#a3e635'};
const TRASH_TTL = 30 * 86400e3; // 86400e3 = millisecondi in un giorno

// ══════════════════════════════════════════════════════════
// STATO GLOBALE — S è l'unico oggetto che contiene tutti i dati
// Ogni modifica passa da qui e viene salvata con persist()
// Variabili ausiliarie:
//   curTab: tab attivo ('prom'|'idee'|'liste'|'cestino')
//   q: testo della ricerca corrente
//   eId/eType/ePick: dati temporanei del modal aperto (id, tipo, colore scelto)
//   dSrcId/dOvId/dGhost: variabili per il drag-and-drop
// ══════════════════════════════════════════════════════════
let S = load();
let curTab = 'prom';
let q = '';
let eId = null, eType = null, ePick = null;
let dSrcId = null, dOvId = null, dGhost = null;
let focusType = null, focusId = null, focusColor = null, autoSaveTimer = null;
let secretMode = false;
let curFolder = null; // null = no folder filter, string = folder id

// ══════════════════════════════════════════════════════════
// SLASH COMMAND DROPDOWN
// ══════════════════════════════════════════════════════════
const SLASH_DEFS = [
  { cmd:'/subtitle', hint:'sottotitolo  1.0'     },
  { cmd:'/section',  hint:'sezione  1.1'         },
  { cmd:'/hr',       hint:'separatore'           },
  { cmd:'/todo',     hint:'checkbox  [ ]'        },
  { cmd:'/datetime', hint:'data e ora correnti'  },
  { cmd:'/quote',    hint:'citazione rientrata'  },
  { cmd:'/link',     hint:'inserisci link'       },
];

function curProms() { return secretMode ? S.secret.proms : S.proms; }
function curIdee()  { return secretMode ? S.secret.idee  : S.idee;  }

function toggleSecretMode() {
  secretMode = !secretMode;
  const dot = document.querySelector('.vbig .hl');
  if (dot) dot.style.color = secretMode ? '#e94560' : '';
  ['tab-liste','tab-cestino','v-liste','v-cestino'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = secretMode ? 'none' : '';
  });
  if (secretMode && (curTab === 'liste' || curTab === 'cestino')) goTab('prom');
  q = ''; renderAll();
}

// Carica i dati da localStorage.
// Se non esistono (primo avvio) o il JSON è corrotto → valori di default.
function load() {
  try {
    const d = JSON.parse(localStorage.getItem('blocco') || '{}');
    return {
      name:    d.name    || 'Marius',
      proms:   d.proms   || [],   // array di promemoria
      idee:    d.idee    || [],   // array di idee
      liste:   d.liste   || [],   // array di liste
      cestino: d.cestino || [],   // array di elementi eliminati
      theme:   d.theme   || 'dark',
      secret:      d.secret      || {proms:[], idee:[]},
      folders:     d.folders     || [],
      folderNotes: d.folderNotes || []
    };
  } catch { return {name:'Marius',proms:[],idee:[],liste:[],cestino:[],theme:'dark',secret:{proms:[],idee:[]},folders:[],folderNotes:[]}; }
}

// Salva tutto lo stato in localStorage come stringa JSON.
// Viene chiamata ogni volta che qualcosa cambia.
function persist() {
  localStorage.setItem('blocco', JSON.stringify(S));
  if (window._fbUser && window._fbDb) {
    window._fbDb.collection('users').doc(window._fbUser.uid).set(S).catch(() => {});
  }
}

// Genera un ID unico basato sul timestamp + caratteri random.
// Esempio: "lq3k7abcd" — usato come chiave per ogni nota/lista/voce.
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// Formatta un timestamp in testo leggibile relativo ("adesso", "3m fa", "2g fa"…)
// t: timestamp in millisecondi (Date.now())
function fmtTs(t) {
  const d    = new Date(t);
  const time = d.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  const date = d.toLocaleDateString('it-IT',  {day:'2-digit', month:'2-digit', year:'numeric'});
  return '[' + time + ' · ' + date + ']';
}

// Calcola quanti giorni mancano alla scadenza di un elemento nel cestino.
// deletedAt: timestamp di quando è stato eliminato.
function fmtTrashExp(deletedAt) {
  const days = Math.ceil((deletedAt + TRASH_TTL - Date.now()) / 86400e3);
  if (days <= 0) return 'scaduto';
  if (days === 1) return 'scade domani';
  return 'scade tra ' + days + 'g';
}

// Escape HTML: converte i caratteri speciali in entità sicure.
// Impedisce che il testo dell'utente venga interpretato come HTML (XSS).
// Usato per titoli e testi dove non vogliamo markdown.
function esc(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

// Renderer markdown leggero: prima fa escape dell'HTML (sicurezza),
// poi applica **grassetto** e _corsivo_, poi converte i newline in <br>.
function md(s) {
  if (!s) return '';
  // Contenuto HTML (da contenteditable) — converti solo le checkbox rimaste come testo
  if (/<br|<b>|<i>|<span|<h[1-6]|<div|<hr/i.test(s)) {
    return s
      .replace(/\[ \] /g, '<span class="cb cb-open">○</span> ')
      .replace(/\[x\] /g,  '<span class="cb cb-done">✓</span> ');
  }
  // Vecchio formato con marcatori testuali
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

// mdCard: like md() but checkboxes get onclick handlers so they're clickable in cards.
function mdCard(text, id, tp) {
  if (!text) return '';
  let n = 0;
  if (/<br|<b>|<i>|<span|<h[1-6]|<div|<hr/i.test(text)) {
    return text.replace(/\[([ x])\] /g, (_, c) =>
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

// toggleCb: flip the n-th checkbox in a card's stored text.
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

// arr: array di stringhe da cercare (es: [titolo, testo])
function matches(arr) { return !q || arr.some(s => s && s.toLowerCase().includes(q)); }

function clrCls(c) { return c ? ' clr-'+c : ''; } // classe CSS per il bordo colorato
function buildClrPick(elId, sel) {
  document.getElementById(elId).innerHTML = ['none',...CLRS].map(c => `
    <div class="clrdot${c==='none'?' clrnone':''}${(sel||'none')===c?' sel':''}"
      style="${c!=='none' ? 'background:'+CLRHEX[c] : ''}"
      onclick="pickClr('${elId}','${c}')"></div>
  `).join('');
}

// ══════════════════════════════════════════════════════════
// TWEMOJI — converte le emoji Unicode in immagini SVG di Twitter
// Chiamata dopo ogni render per sostituire le emoji nei contenuti utente
// ══════════════════════════════════════════════════════════
function applyTwemoji(el) {
  if (typeof twemoji === 'undefined') return; // libreria non caricata (offline)
  twemoji.parse(el || document.body, {
    base:'https://abs.twimg.com/emoji/v2/', folder:'svg', ext:'.svg'
  });
}

// ══════════════════════════════════════════════════════════
// DATA E ORA — aggiorna il display nell'header
// Chiamata all'avvio e poi ogni 30 secondi con setInterval
// ══════════════════════════════════════════════════════════
function updateDatetime() {
  const now = new Date();
  const d = now.toLocaleDateString('it-IT', {day:'numeric', month:'short', year:'numeric'});
  const t = now.toLocaleTimeString('it-IT', {hour:'2-digit', minute:'2-digit'});
  const el = document.getElementById('vdate-lbl');
  if (el) el.textContent = d + ' — ' + t + ' [v30]';
}

// ══════════════════════════════════════════════════════════
// STATISTICHE — aggiorna la riga [N prom] [N idee] ecc.
// e il badge numerico sul tab Cestino
// ══════════════════════════════════════════════════════════
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
