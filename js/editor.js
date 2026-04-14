function _focusBgTouchMove(e) {
  const scrollable = document.getElementById('focus-body');
  if (scrollable && scrollable.contains(e.target)) return;
  e.preventDefault();
}

// Avvolge il testo selezionato nella textarea con **grassetto**
// ── Contenteditable helpers ──
// Testo prima del cursore nell'editor (con \n per le interruzioni di riga)
function getTextBeforeCursor() {
  const el  = document.getElementById('focus-body');
  const sel = window.getSelection();
  if (!el || !sel.rangeCount || !el.contains(sel.focusNode)) return '';
  const range = document.createRange();
  range.setStart(el, 0);
  range.setEnd(sel.focusNode, sel.focusOffset);
  return range.toString();
}
// Avvolge la selezione in uno span; usa extractContents se surroundContents fallisce
function _wrapSelectionWith(fn) {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const span  = document.createElement('span');
  fn(span);
  try { range.surroundContents(span); }
  catch(_) { span.appendChild(range.extractContents()); range.insertNode(span); }
}

let _slashOpen  = false;
let _slashIdx   = 0;
let _slashItems = [];

function checkSlashTrigger() {
  const el  = document.getElementById('focus-body');
  if (!el) return;
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) { closeSlashMenu(); return; }

  // Find the block-level ancestor of the cursor (div, h1-h6, p, li…)
  // so range.toString() only covers the current visual line, not the whole note.
  let block = sel.anchorNode;
  while (block && block !== el) {
    if (block.nodeType === 1 && /^(DIV|P|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(block.nodeName)) break;
    block = block.parentNode;
  }
  if (!block || block === el) block = el;

  const range = document.createRange();
  try { range.setStart(block, 0); range.setEnd(sel.anchorNode, sel.anchorOffset); }
  catch(_) { closeSlashMenu(); return; }

  const lineText = range.toString();
  const word = lineText.split('\n').pop() || lineText;

  if (word.startsWith('/') && !word.includes(' ') && word.length <= 12) {
    const q = word.toLowerCase();
    _slashItems = SLASH_DEFS.filter(d => d.cmd.startsWith(q));
    if (_slashItems.length) { _slashIdx = 0; _renderSlashMenu(el); return; }
  }
  closeSlashMenu();
}

function _renderSlashMenu(ta) {
  const menu = document.getElementById('slash-menu');
  if (!menu) return;
  // Position at the cursor using Selection API — works for any contenteditable layout
  let top, left;
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const r    = sel.getRangeAt(0).cloneRange();
    r.collapse(true);
    const caret = r.getBoundingClientRect();
    top  = caret.bottom + 6;
    left = caret.left;
  } else {
    const r2 = ta.getBoundingClientRect();
    top  = r2.top + 40;
    left = r2.left + 36;
  }
  const menuH = _slashItems.length * 34;
  if (top + menuH > window.innerHeight - 8) top = Math.max(8, top - menuH - 28);
  menu.style.top  = top  + 'px';
  menu.style.left = left + 'px';
  menu.innerHTML  = _slashItems.map((d, i) =>
    `<div class="slash-item${i===_slashIdx?' sel':''}" data-i="${i}"
       onmousedown="event.preventDefault();applySlashCmd('${d.cmd}')">
       <span class="slash-cmd">${d.cmd}</span><span class="slash-desc">${d.hint}</span>
     </div>`).join('');
  menu.style.display = 'block';
  _slashOpen = true;
}

function closeSlashMenu() {
  const menu = document.getElementById('slash-menu');
  if (menu) menu.style.display = 'none';
  _slashOpen = false; _slashItems = []; _slashIdx = 0;
}

function applySlashCmd(cmd) {
  const el = document.getElementById('focus-body');
  if (!el) return;
  el.focus();
  // Cancella il testo slash corrente (/title, /hr …) — solo se presente
  // Usa _getCurrentLineBeforeCursor per non leggere il testo dei blocchi precedenti
  const word = _getCurrentLineBeforeCursor();
  if (word.startsWith('/')) {
    for (let i = 0; i < word.length; i++) document.execCommand('delete');
  }
  switch (cmd) {
    case '/subtitle': document.execCommand('formatBlock', false, 'h2'); break;
    case '/section':  document.execCommand('formatBlock', false, 'h3'); break;
    case '/quote':    document.execCommand('formatBlock', false, 'blockquote'); break;
    case '/hr':
      document.execCommand('insertHTML', false, '<hr>');
      document.execCommand('insertLineBreak');
      break;
    case '/todo': document.execCommand('insertText', false, '[ ] '); break;
    case '/datetime': {
      const now = new Date();
      const p = n => String(n).padStart(2, '0');
      const dt = `${p(now.getDate())}/${p(now.getMonth()+1)}/${now.getFullYear()} · ${p(now.getHours())}:${p(now.getMinutes())}`;
      document.execCommand('insertText', false, dt);
      break;
    }
    case '/link': {
      const url = prompt('URL del link:', 'https://');
      if (url && url.trim()) {
        const txt = prompt('Testo del link (vuoto = URL):', '') || url.trim();
        document.execCommand('insertHTML', false,
          `<a href="${url.trim()}" target="_blank" rel="noopener">${txt}</a>`);
      }
      break;
    }
  }
  el.focus(); closeSlashMenu(); _updateLineNums();
}

// ══════════════════════════════════════════════════════════
// AUTO-LIST — gestione tasti speciali nel contenteditable
// ══════════════════════════════════════════════════════════

// Returns only the text of the CURRENT block (div/h1/p/…) before the cursor.
// Unlike getTextBeforeCursor(), this never bleeds text from previous blocks
// because range.toString() produces no \n at block boundaries.
function _getCurrentLineBeforeCursor() {
  const el  = document.getElementById('focus-body');
  const sel = window.getSelection();
  if (!el || !sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return '';
  let block = sel.anchorNode;
  while (block && block !== el) {
    if (block.nodeType === 1 && /^(DIV|P|H[1-6]|LI|BLOCKQUOTE|PRE)$/.test(block.nodeName)) break;
    block = block.parentNode;
  }
  if (!block || block === el) block = el;
  const range = document.createRange();
  try { range.setStart(block, 0); range.setEnd(sel.anchorNode, sel.anchorOffset); }
  catch (_) { return ''; }
  return range.toString();
}

function autoList(e) {
  const el = document.getElementById('focus-body');
  // Slash menu navigation
  if (_slashOpen && _slashItems.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); _slashIdx=(_slashIdx+1)%_slashItems.length; _renderSlashMenu(el); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _slashIdx=(_slashIdx-1+_slashItems.length)%_slashItems.length; _renderSlashMenu(el); return; }
    if (e.key==='Enter'||e.key==='Tab') { e.preventDefault(); applySlashCmd(_slashItems[_slashIdx].cmd); return; }
    if (e.key === 'Escape') { e.stopPropagation(); closeSlashMenu(); return; }
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertText', false, '  ');
    return;
  }
  if (e.key !== 'Enter') return;
  if (!el) return;
  // Esci da heading con Enter
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    let node = sel.focusNode;
    while (node && node !== el) {
      if (node.nodeType===1 && /^H[123]$/.test(node.nodeName)) {
        e.preventDefault();
        const br = document.createElement('br');
        node.after(br);
        const r = document.createRange();
        r.setStartAfter(br); r.setEndAfter(br);
        sel.removeAllRanges(); sel.addRange(r);
        _updateLineNums(); return;
      }
      node = node.parentNode;
    }
  }
  // Continua bullet/checkbox — usa solo il testo del blocco corrente
  // così se l'utente ha cancellato il prefisso "- " la riga risulta vuota
  // e non eredita il pattern dal blocco precedente.
  const currentLine = _getCurrentLineBeforeCursor();
  const m = currentLine.match(/^(\s*(?:- |\[ \] |\[x\] ))/);
  if (m) {
    e.preventDefault();
    const prefix = m[1].replace('[x] ', '[ ] ');
    if (!currentLine.slice(m[1].length).trim()) {
      // Riga vuota con solo il prefisso → esci dalla lista
      for (let i = 0; i < m[1].length; i++) document.execCommand('delete');
    } else {
      document.execCommand('insertText', false, '\n' + prefix);
    }
    _updateLineNums();
  }
  // default Enter: browser gestisce (inserisce <br> o <div>)
}

// ══════════════════════════════════════════════════════════
// NUMERO RIGHE — aggiorna il pannello numeri nel focus editor
// ══════════════════════════════════════════════════════════
function _updateLineNums() {
  const el = document.getElementById('focus-body');
  const ln = document.getElementById('focus-lnums');
  if (!el || !ln) return;
  // innerText riflette esattamente ciò che il browser renderizza:
  // ogni blocco (div, h1-h6, p…) produce un \n al confine.
  // Chrome aggiunge un \n finale aggiuntivo → lo rimuoviamo per evitare
  // una riga fantasma in fondo.
  let text = el.innerText || '';
  if (text.endsWith('\n')) text = text.slice(0, -1);
  const n = Math.max(1, text === '' ? 1 : (text.match(/\n/g) || []).length + 1);
  ln.textContent = Array.from({length: n}, (_, i) => i + 1).join('\n');
  ln.scrollTop = el.scrollTop;
}

// ══════════════════════════════════════════════════════════
// ── Focus mode — view e edit ────────────────────────────
let _focusIsEdit = false;

function openFocus(tp, id) {
  const arr = tp === 'prom' ? curProms() : curIdee();
  const it  = arr.find(i => i.id === id); if (!it) return;
  focusType = tp; focusId = id; focusColor = it.color || null;
  const fm = document.getElementById('focus-modal');
  fm.classList.add('open');
  fm.addEventListener('touchmove', _focusBgTouchMove, {passive: false});
  focusEnterEdit();
}

function _focusPopulateView(it) {
  const vTitle = document.getElementById('focus-view-title');
  const vBody  = document.getElementById('focus-view-body');
  const vMeta  = document.getElementById('focus-view-meta');
  const clrDot = document.getElementById('focus-view-clr');
  const footDl = document.getElementById('focus-foot-dl');
  if (focusType === 'idee' && it.title) {
    vTitle.textContent = it.title; vTitle.style.display = '';
  } else { vTitle.style.display = 'none'; }
  vBody.innerHTML = md(it.text || '');
  applyTwemoji(vBody);
  const metaParts = [];
  if (it.deadline) metaParts.push(fmtDeadline(it.deadline));
  metaParts.push(fmtTs(it.created));
  vMeta.textContent = metaParts.join(' · ');
  if (it.color) {
    clrDot.style.background = CLRHEX[it.color];
    clrDot.style.border = 'none';
  } else {
    clrDot.style.background = 'transparent';
    clrDot.style.border = '1px solid var(--bd2)';
  }
  footDl.textContent = it.deadline ? fmtDeadline(it.deadline) : '';
}

function focusEnterEdit() {
  const arr = focusType === 'prom' ? curProms() : curIdee();
  const it  = arr.find(i => i.id === focusId); if (!it) return;
  _focusIsEdit = true;
  const bodyEl = document.getElementById('focus-body');
  const ttlInp = document.getElementById('focus-ttl-inp');
  bodyEl.innerHTML = md(it.text); // md() gestisce sia vecchio formato che HTML
  if (focusType === 'idee') { ttlInp.value = it.title || ''; ttlInp.style.display = ''; }
  else { ttlInp.style.display = 'none'; }
  const schedAutoSave = () => {
    clearTimeout(autoSaveTimer);
    const st = document.getElementById('focus-status');
    if (st) st.textContent = '·';
    autoSaveTimer = setTimeout(() => {
      doFocusSave(false);
      const st2 = document.getElementById('focus-status');
      if (st2) { st2.textContent = '✓'; setTimeout(() => { if (st2) st2.textContent = ''; }, 1400); }
    }, 300);
  };
  const upd = () => { _updateLineNums(); schedAutoSave(); checkSlashTrigger(); };
  _updateLineNums();
  bodyEl.oninput = upd;
  bodyEl.onscroll = () => { const ln = document.getElementById('focus-lnums'); if (ln) ln.scrollTop = bodyEl.scrollTop; };
  if (focusType === 'idee') ttlInp.oninput = schedAutoSave;
  // Color picker
  focusColor = it.color || null;
  document.getElementById('focus-clr').innerHTML = ['none',...CLRS].map(c => `
    <div class="clrdot${c==='none'?' clrnone':''}${(focusColor||'none')===c?' sel':''}"
      style="${c!=='none'?'background:'+CLRHEX[c]:''}"
      onclick="pickFocusClr('${c}',this)"></div>
  `).join('');
  // Deadline
  const fdInp = document.getElementById('focus-deadline-inp');
  const fdBtn = document.getElementById('focus-deadline-toggle');
  if (it.deadline) {
    fdInp.value = toLocalDatetimeInput(it.deadline);
    fdInp.style.display = ''; fdBtn.textContent = '[on]';
  } else {
    fdInp.value = ''; fdInp.style.display = 'none'; fdBtn.textContent = '[off]';
  }
  _focusShowMode('edit');
  setTimeout(() => bodyEl.focus(), 60);
}

function _focusShowMode(mode) {
  const isEdit = mode === 'edit';
  document.getElementById('focus-view').style.display      = isEdit ? 'none' : '';
  document.getElementById('focus-edit').style.display      = isEdit ? 'flex' : 'none';
  document.getElementById('focus-edit-btn').style.display  = isEdit ? 'none' : '';
  document.getElementById('focus-save-btn').style.display  = isEdit ? '' : 'none';
  document.getElementById('focus-foot-view').style.display = isEdit ? 'none' : 'flex';
  document.getElementById('focus-foot-edit').style.display = isEdit ? 'flex' : 'none';
}

function doFocusSave(shouldClose) {
  if (focusType === 'folder') {
    const it = (S.folderNotes||[]).find(i => i.id === focusId); if (!it) return;
    it.text  = document.getElementById('focus-body').innerHTML;
    it.title = document.getElementById('focus-ttl-inp').value.trim();
    it.color = focusColor;
    const _fdInp = document.getElementById('focus-deadline-inp');
    it.deadline = _fdInp.style.display !== 'none' && _fdInp.value
      ? new Date(_fdInp.value).getTime() : null;
    it.updated = Date.now();
    persist(); renderFolder();
    if (shouldClose) closeFocus();
    return;
  }
  const arr = focusType === 'prom' ? curProms() : curIdee();
  const it  = arr.find(i => i.id === focusId); if (!it) return;
  it.text  = document.getElementById('focus-body').innerHTML;
  if (focusType === 'idee') it.title = document.getElementById('focus-ttl-inp').value.trim();
  it.color = focusColor;
  const fdInp = document.getElementById('focus-deadline-inp');
  it.deadline = fdInp.style.display !== 'none' && fdInp.value
    ? new Date(fdInp.value).getTime() : null;
  it.updated = Date.now();
  persist(); renderAll();
  if (shouldClose) { closeFocus(); return; }
  _focusPopulateView(it);
}

function saveFocus() { clearTimeout(autoSaveTimer); doFocusSave(true); }

// ══════════════════════════════════════════════════════════
// FORMAT PANEL — pannello formattazione testo (solo desktop)
// ══════════════════════════════════════════════════════════
let _fmtOpen = false;

function buildFmtColors() {
  const el = document.getElementById('fmt-clrs');
  if (!el || el.childElementCount) return; // già costruito
  el.innerHTML = `<div class="fmt-clr-none" title="nessun colore" onclick="applyFmt('color','')"></div>` +
    CLRS.map(c => `<div class="fmt-clr-dot" style="background:${CLRHEX[c]}" title="${c}" onclick="applyFmt('color','${c}')"></div>`).join('');
}

function toggleFmtPanel() {
  _fmtOpen = !_fmtOpen;
  const panel  = document.getElementById('fmt-panel');
  const toggle = document.getElementById('fmt-toggle');
  panel.classList.toggle('open', _fmtOpen);
  toggle.textContent = _fmtOpen ? '›' : '‹';
  if (_fmtOpen) buildFmtColors();
}

function applyFmt(type, arg) {
  const el = document.getElementById('focus-body');
  if (!el) return;
  el.focus();
  switch (type) {
    case 'bold':   document.execCommand('bold');   break;
    case 'italic': document.execCommand('italic'); break;
    case 'color':
      // styleWithCSS produces <span style="color:…"> instead of <font> — undo-able via Ctrl+Z
      document.execCommand('styleWithCSS', false, true);
      if (!arg) {
        // Reset color only — do NOT call removeFormat (that strips bold/italic too)
        document.execCommand('foreColor', false, 'inherit');
      } else {
        document.execCommand('foreColor', false, CLRHEX[arg]);
      }
      document.execCommand('styleWithCSS', false, false);
      break;
    case 'big':
      _wrapSelectionWith(s => { s.className = 'mbig'; });
      break;
    case 'small':
      _wrapSelectionWith(s => { s.className = 'msmall'; });
      break;
    case 'clear':
      document.execCommand('removeFormat');
      break;
    default: return;
  }
  _updateLineNums();
  el.dispatchEvent(new Event('input'));
}

// ══════════════════════════════════════════════════════════
// SELECTION TOOLBAR — appare sopra la selezione nel focus editor
// ══════════════════════════════════════════════════════════
function _buildSelToolbar() {
  const clrs = document.getElementById('stb-clrs');
  if (!clrs || clrs.childElementCount) return;
  clrs.innerHTML =
    `<div class="stb-dot-none" title="Nessun colore"
       onmousedown="event.preventDefault()" onclick="applyFmt('color','')"></div>` +
    CLRS.map(c =>
      `<div class="stb-dot" style="background:${CLRHEX[c]}" title="${c}"
         onmousedown="event.preventDefault()" onclick="applyFmt('color','${c}')"></div>`
    ).join('');
}

function _posSelToolbar() {
  const sel       = window.getSelection();
  const focusBody = document.getElementById('focus-body');
  const toolbar   = document.getElementById('sel-toolbar');
  if (!toolbar) return;
  if (!sel || sel.isCollapsed || !focusBody || !focusBody.contains(sel.anchorNode)) {
    toolbar.classList.remove('show'); return;
  }
  const range = sel.getRangeAt(0);
  const rect  = range.getBoundingClientRect();
  if (rect.width === 0) { toolbar.classList.remove('show'); return; }
  _buildSelToolbar();
  toolbar.classList.add('show');
  // Posiziona centrato sopra la selezione (o sotto se non c'è spazio)
  const tbW  = toolbar.offsetWidth  || 300;
  const tbH  = toolbar.offsetHeight || 36;
  let left = rect.left + rect.width / 2 - tbW / 2;
  let top  = rect.top  - tbH - 8;
  left = Math.max(4, Math.min(left, window.innerWidth - tbW - 4));
  if (top < 4) top = rect.bottom + 8;
  toolbar.style.left = left + 'px';
  toolbar.style.top  = top  + 'px';
}

// ══════════════════════════════════════════════════════════
// LINK — aggiunge un link alla selezione nel focus editor
// ══════════════════════════════════════════════════════════
function _addLink() {
  const focusBody = document.getElementById('focus-body');
  if (!focusBody) return;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) { toast('[seleziona prima il testo]'); return; }
  const url = prompt('URL del link:', 'https://');
  if (!url || !url.trim()) return;
  focusBody.focus();
  document.execCommand('createLink', false, url.trim());
  // Assicura target=_blank su tutti i link
  focusBody.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
  document.getElementById('sel-toolbar').classList.remove('show');
  _updateLineNums();
}

function openFolderNote(id) {
  const n = (S.folderNotes||[]).find(x => x.id === id);
  if (!n) return;
  focusType = 'folder'; focusId = id; focusColor = null;
  const bodyEl  = document.getElementById('focus-body');
  const titleEl = document.getElementById('focus-ttl-inp');
  bodyEl.innerHTML = md(n.text || '');
  titleEl.value = n.title || '';
  titleEl.style.display = '';
  _focusIsEdit = true;
  const schedAutoSave = () => {
    clearTimeout(autoSaveTimer);
    const st = document.getElementById('focus-status');
    if (st) st.textContent = '·';
    autoSaveTimer = setTimeout(() => {
      doFocusSave(false);
      const st2 = document.getElementById('focus-status');
      if (st2) { st2.textContent = '✓'; setTimeout(() => { if (st2) st2.textContent = ''; }, 1400); }
    }, 300);
  };
  bodyEl.oninput  = () => { _updateLineNums(); schedAutoSave(); checkSlashTrigger(); };
  titleEl.oninput = schedAutoSave;
  bodyEl.onscroll = () => { const ln = document.getElementById('focus-lnums'); if (ln) ln.scrollTop = bodyEl.scrollTop; };
  _updateLineNums();
  focusColor = n.color || null;
  document.getElementById('focus-clr').innerHTML = ['none',...CLRS].map(c => `
    <div class="clrdot${c==='none'?' clrnone':''}${(focusColor||'none')===c?' sel':''}"
      style="${c!=='none'?'background:'+CLRHEX[c]:''}"
      onclick="pickFocusClr('${c}',this)"></div>
  `).join('');
  const fdInp = document.getElementById('focus-deadline-inp');
  const fdBtn = document.getElementById('focus-deadline-toggle');
  if (n.deadline) { fdInp.value = toLocalDatetimeInput(n.deadline); fdInp.style.display = ''; fdBtn.textContent = '[on]'; }
  else { fdInp.value = ''; fdInp.style.display = 'none'; fdBtn.textContent = '[off]'; }
  _focusShowMode('edit');
  const fm = document.getElementById('focus-modal');
  fm.classList.add('open');
  fm.addEventListener('touchmove', _focusBgTouchMove, {passive: false});
  setTimeout(() => bodyEl.focus(), 60);
}

function closeFocus() {
  closeSlashMenu();
  const _st = document.getElementById('sel-toolbar');
  if (_st) _st.classList.remove('show');
  clearTimeout(autoSaveTimer);
  if (_focusIsEdit) doFocusSave(false);
  const fm = document.getElementById('focus-modal');
  fm.classList.remove('open');
  fm.removeEventListener('touchmove', _focusBgTouchMove);
  // Reset zen mode on close
  if (_zenMode) { _zenMode = false; fm.classList.remove('zen'); }
  // Dopo l'animazione di chiusura, torna in view mode per la prossima apertura
  setTimeout(() => { if (!fm.classList.contains('open')) _focusShowMode('view'); }, 320);
}
