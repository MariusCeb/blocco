// Mostra un messaggio temporaneo in alto allo schermo.
// dur: durata in ms prima che scompaia (default 2 secondi).
// Usa clearTimeout per resettare il timer se chiamato più volte di seguito.
function toast(msg, dur=2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), dur);
}

// ══════════════════════════════════════════════════════════
// TEMA — scuro/chiaro
// SVG_MOON e SVG_SUN: icone Heroicons inline (nessuna dipendenza esterna)
// applyTheme(): applica la classe .light all'html, inietta l'icona giusta,
//               aggiorna il colore della barra del browser
// ══════════════════════════════════════════════════════════
const SVG_MOON    = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"/></svg>`;
const SVG_SUN     = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"/></svg>`;
const SVG_GRUVBOX = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"/></svg>`;

function applyTheme() {
  // Rimuove tutte le classi tema e applica quella corrente
  document.documentElement.classList.remove('light', 'gruvbox');
  if (S.theme === 'light')   document.documentElement.classList.add('light');
  if (S.theme === 'gruvbox') document.documentElement.classList.add('gruvbox');
  // Icona: mostra l'icona del tema SUCCESSIVO nel ciclo
  const ico = document.getElementById('theme-ico');
  if (ico) {
    if (S.theme === 'light')   ico.innerHTML = SVG_MOON;
    else if (S.theme === 'gruvbox') ico.innerHTML = SVG_SUN;
    else                       ico.innerHTML = SVG_GRUVBOX;
  }
  // Aggiorna il colore della barra browser su Android/Safari
  const bgMap = { dark: '#0e0e0e', light: '#f0eeea', gruvbox: '#32302f' };
  document.getElementById('tc-meta').content = bgMap[S.theme] || '#0e0e0e';
}
// Toggle: dark → gruvbox → light → dark…
function tglTheme() {
  const order = ['dark', 'gruvbox', 'light'];
  const idx = order.indexOf(S.theme);
  S.theme = order[(idx + 1) % order.length];
  persist(); applyTheme();
}

// ══════════════════════════════════════════════════════════
// RICERCA
// sOpen: stato della barra di ricerca (aperta/chiusa)
// tglSearch(): apre o chiude la barra, mette il focus sull'input
// doSearch(): aggiorna q (query) e ri-renderizza tutto
// ══════════════════════════════════════════════════════════
let sOpen = false;
function tglSearch() {
  sOpen = !sOpen;
  document.getElementById('sbar').classList.toggle('open', sOpen);
  if (sOpen) setTimeout(() => document.getElementById('sinp').focus(), 260);
  else { document.getElementById('sinp').value = ''; q = ''; renderAll(); }
}
function doSearch(v) {
  if (v === '...' || v === '…') {
    toggleSecretMode();
    document.getElementById('sinp').value = '';
    document.getElementById('sbar').classList.remove('open');
    sOpen = false;
    return;
  }
  q = v.toLowerCase().trim(); renderAll();
}

// ══════════════════════════════════════════════════════════
// NAVIGAZIONE TAB
// Aggiorna classe .on sui tab e sulle viste,
// nasconde quick capture e FAB nella sezione cestino,
// forza il render del cestino al primo accesso
// ══════════════════════════════════════════════════════════
function goTab(t) {
  curTab = t;
  curFolder = null;
  // Aggiorna lo stile attivo su tab e viste
  document.querySelectorAll('.tab').forEach(b  => b.classList.toggle('on', b.id === 'tab-'+t));
  document.querySelectorAll('.folder-item').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-'+t));
  const isCestino = t === 'cestino';
  // Nel cestino non ha senso aggiungere note → nascondi quick capture e FAB
  document.getElementById('qcap').style.display = isCestino ? 'none' : '';
  document.getElementById('fab').style.display  = isCestino ? 'none' : '';
  if (isCestino) renderCestino(); // genera il contenuto del cestino
}

// ══════════════════════════════════════════════════════════
// GESTIONE MODAL
// openModal(): aggiunge .open al modal → CSS lo rende visibile
// closeModal(): rimuove .open
// bgClose(): helper per chiudere cliccando l'overlay scuro
// ══════════════════════════════════════════════════════════
function openModal(id)  { document.getElementById(id).classList.add('open'); applyTwemoji(document.getElementById(id)); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function bgClose(e, id) { if (e.target === e.currentTarget) closeModal(id); }

// ══════════════════════════════════════════════════════════
// EXPORT / IMPORT JSON — backup completo dei dati
// doExport(): crea un file JSON con tutti i dati e lo scarica
// doImport(): legge un file JSON e sovrascrive i dati attuali
// ══════════════════════════════════════════════════════════
function doExport() {
  // Crea un Blob (file virtuale) con i dati JSON formattati
  const blob = new Blob([JSON.stringify(S, null, 2)], {type:'application/json'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob); // URL temporaneo per il download
  a.download = 'blocco-' + new Date().toISOString().slice(0,10) + '.json'; // nome file con data
  a.click();
  URL.revokeObjectURL(a.href); // libera la memoria
  closeModal('m-io'); toast('[backup esportato]');
}
function doExportText() {
  function htmlToText(html) {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
      .trim();
  }
  const lines = [`BLOCCO — ${S.name||''} — ${new Date().toLocaleDateString('it-IT')}`, ''];
  if (S.proms?.length) {
    lines.push('═══ PROMEMORIA ═══');
    S.proms.forEach(i => lines.push('· ' + htmlToText(i.text)));
    lines.push('');
  }
  if (S.idee?.length) {
    lines.push('═══ IDEE ═══');
    S.idee.forEach(i => { if (i.title) lines.push('# ' + i.title); lines.push(htmlToText(i.text)); lines.push(''); });
  }
  if (S.folders?.length) {
    lines.push('═══ NOTE ═══');
    S.folders.forEach(f => {
      const notes = (S.folderNotes||[]).filter(n => n.folder === f.id);
      if (!notes.length) return;
      lines.push(`/ ${f.name}`);
      notes.forEach(n => { if (n.title) lines.push('# ' + n.title); lines.push(htmlToText(n.text)); lines.push(''); });
    });
  }
  const blob = new Blob([lines.join('\n')], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'blocco-' + new Date().toISOString().slice(0,10) + '.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  closeModal('m-io'); toast('[testo esportato]');
}

function htmlToText(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .trim();
}

function doImport(inp) {
  const f = inp.files[0]; if (!f) return;
  const r = new FileReader(); // API browser per leggere file locali
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!confirm('Sovrascrivere i dati attuali con questo file?')) return;
      S = {
        name:    d.name    || S.name,
        proms:   d.proms   || [],
        idee:    d.idee    || [],
        liste:   d.liste   || [],
        cestino: d.cestino || [],
        theme:   d.theme   || 'dark'
      };
      document.getElementById('name-lbl').textContent = S.name;
      persist(); applyTheme(); renderAll(); renderCestino();
      closeModal('m-io'); toast('[importato]');
    } catch { alert('File non valido'); }
  };
  r.readAsText(f); inp.value = ''; // resetta l'input file per permettere re-import
}

// ══════════════════════════════════════════════════════════
// ZEN MODE — modalità scrittura senza distrazioni
// ══════════════════════════════════════════════════════════
let _zenMode = false;
function toggleZen() {
  const fm = document.getElementById('focus-modal');
  if (!fm) return;
  _zenMode = !_zenMode;
  fm.classList.toggle('zen', _zenMode);
}

// ══════════════════════════════════════════════════════════
// COMMAND PALETTE — Ctrl+K: cerca note e comandi
// ══════════════════════════════════════════════════════════
let _palOpen = false, _palIdx = 0, _palItems = [];

function openCmdPal() {
  _palOpen = true; _palIdx = 0;
  const el = document.getElementById('cmdpal');
  if (!el) return;
  el.style.display = 'flex';
  const inp = document.getElementById('cmdpal-inp');
  if (inp) { inp.value = ''; inp.focus(); }
  renderCmdPal();
}
function _closeCmdPal() {
  _palOpen = false;
  const el = document.getElementById('cmdpal');
  if (el) el.style.display = 'none';
}
function renderCmdPal() {
  const q = (document.getElementById('cmdpal-inp')?.value || '').toLowerCase().trim();
  const lst = document.getElementById('cmdpal-list');
  if (!lst) return;
  _palItems = [];

  // Notes from all sections
  const sections = [
    { arr: curProms(),           label: 'prom'  },
    { arr: curIdee(),            label: 'idea'  },
    { arr: S.folderNotes || [], label: 'nota'  },
  ];
  sections.forEach(({ arr, label }) => {
    arr.forEach(n => {
      const hay = ((n.title || '') + ' ' + (n.text || '')).toLowerCase().replace(/<[^>]*>/g, '');
      if (!q || hay.includes(q)) {
        const preview = (n.text || '').replace(/<[^>]*>/g, '').slice(0, 60);
        _palItems.push({ kind: 'note', label, id: n.id, title: n.title || '', preview });
      }
    });
  });

  // Slash commands
  SLASH_DEFS.forEach(d => {
    if (!q || d.cmd.includes(q) || d.hint.includes(q))
      _palItems.push({ kind: 'cmd', label: 'cmd', id: d.cmd, title: d.cmd, preview: d.hint });
  });

  _palItems = _palItems.slice(0, 24);
  _palIdx = Math.min(_palIdx, Math.max(0, _palItems.length - 1));

  if (!_palItems.length) {
    lst.innerHTML = `<div class="cmdpal-empty">nessun risultato</div>`;
    return;
  }
  lst.innerHTML = _palItems.map((it, i) => `
    <div class="cmdpal-row${i === _palIdx ? ' sel' : ''}" onclick="_palSelect(${i})">
      <span class="cmdpal-tag">${it.label}</span>
      <span class="cmdpal-name">${esc(it.title || it.preview)}</span>
      ${it.title && it.preview ? `<span class="cmdpal-sub">${esc(it.preview)}</span>` : ''}
    </div>`).join('');
}
function cmdPalKey(e) {
  if (e.key === 'ArrowDown')  { e.preventDefault(); _palIdx = Math.min(_palIdx + 1, _palItems.length - 1); _palHighlight(); }
  else if (e.key === 'ArrowUp')   { e.preventDefault(); _palIdx = Math.max(_palIdx - 1, 0); _palHighlight(); }
  else if (e.key === 'Enter')     { e.preventDefault(); _palSelect(_palIdx); }
  else if (e.key === 'Escape')    { e.preventDefault(); _closeCmdPal(); }
}
function _palHighlight() {
  document.querySelectorAll('.cmdpal-row').forEach((r, i) => r.classList.toggle('sel', i === _palIdx));
  document.querySelectorAll('.cmdpal-row')[_palIdx]?.scrollIntoView({ block: 'nearest' });
}
function _palSelect(idx) {
  const it = _palItems[idx]; if (!it) return;
  _closeCmdPal();
  if (it.kind === 'note') {
    const labelMap = { prom: 'prom', idea: 'idee', nota: 'folder' };
    const tp = labelMap[it.label];
    if (tp === 'folder') openFolderNote(it.id);
    else openFocus(tp, it.id);
  } else {
    const fm = document.getElementById('focus-modal');
    if (fm?.classList.contains('open')) applySlashCmd(it.id);
    else toast(it.id + ' — apri prima una nota');
  }
}

// BOOT — chiamato dopo il login Firebase
function initApp() {
  purgeTrash();
  applyTheme();
  document.getElementById('name-lbl').textContent = S.name;
updateDatetime();
setInterval(() => {
  updateDatetime();
  // Aggiorna le card se ci sono scadenze attive (countdown che avanza)
  if ([...S.proms, ...S.idee, ...(S.folderNotes||[])].some(i => i.deadline)) renderAll();
}, 30000);
renderAll();
initTabSwipe();
} // end initApp()

// ══════════════════════════════════════════════════════════
// EVENT LISTENERS — tastiera, focus, touch, visibilità
// ══════════════════════════════════════════════════════════

document.addEventListener('mouseup',  () => setTimeout(_posSelToolbar, 10));
document.addEventListener('touchend', () => setTimeout(_posSelToolbar, 60));
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (sel && sel.isCollapsed) {
    const t = document.getElementById('sel-toolbar');
    if (t) t.classList.remove('show');
  }
});

// Click su link dentro le card e il focus viewer → apre in nuova tab
document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (!link) return;
  if (!link.closest('.ctext,.ptext,.focus-view-body,.focus-body,.ctitle')) return;
  e.preventDefault();
  e.stopPropagation();
  const href = link.getAttribute('href');
  if (href) window.open(href, '_blank', 'noopener');
}, true);

// Nascondi FAB quando la tastiera iOS è aperta (qualsiasi input attivo)
document.addEventListener('focusin', e => {
  if (e.target.matches('input,textarea')) {
    const fab = document.getElementById('fab');
    if (fab) fab.style.visibility = 'hidden';
  }
});
document.addEventListener('focusout', () => {
  setTimeout(() => {
    if (!document.activeElement || !document.activeElement.matches('input,textarea')) {
      const fab = document.getElementById('fab');
      if (fab) fab.style.visibility = '';
    }
  }, 150);
});
// Blocca il bounce/scroll della pagina intera su iOS.
// Solo i contenitori esplicitamente scrollabili possono ricevere touchmove.
document.addEventListener('touchmove', e => {
  if (!e.target.closest('.view, .focus-view, .focus-body, .modal-sheet, textarea')) {
    e.preventDefault();
  }
}, {passive: false});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && secretMode) toggleSecretMode();
});

// Fix iOS: tastiera copre le ultime righe della textarea.
// Quando il visual viewport si riduce (tastiera aperta), aggiungo
// padding-bottom alla textarea pari all'altezza della tastiera,
// così l'ultima riga può essere scrollata sopra la tastiera.
if (window.visualViewport) {
  visualViewport.addEventListener('resize', () => {
    const el = document.getElementById('focus-body');
    if (!el) return;
    const kbH = window.innerHeight - visualViewport.height;
    el.style.paddingBottom = (kbH > 80 ? kbH + 24 : 16) + 'px';
  });
}
// Swipe destra per chiudere il focus sheet (come iOS Notes)
(function() {
  const fm = document.getElementById('focus-modal');
  let sx = 0, sy = 0, tracking = false, swiping = false, dx = 0;

  fm.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    tracking = true; swiping = false; dx = 0;
    fm.style.transition = 'none';
  }, {passive: true});

  fm.addEventListener('touchmove', e => {
    if (!tracking || e.touches.length !== 1) return;
    const ddx = e.touches[0].clientX - sx;
    const ddy = e.touches[0].clientY - sy;
    if (!swiping) {
      if (Math.abs(ddx) < 10 && Math.abs(ddy) < 10) return;
      if (ddx > 0 && Math.abs(ddx) > Math.abs(ddy) * 1.2) {
        swiping = true; // swipe orizzontale verso destra confermato
      } else {
        tracking = false; return; // verticale o verso sinistra: lascia scorrere normalmente
      }
    }
    dx = Math.max(0, ddx);
    fm.style.transform = `translateX(${dx}px)`;
    fm.style.opacity = String(1 - dx / window.innerWidth * 0.4);
    e.preventDefault();
    e.stopImmediatePropagation();
  }, {passive: false});

  fm.addEventListener('touchend', () => {
    if (!swiping) { fm.style.transition = ''; return; }
    swiping = false; tracking = false;
    if (dx > window.innerWidth * 0.3) {
      fm.style.transition = 'transform .28s cubic-bezier(.32,.72,0,1), opacity .28s';
      fm.style.transform  = `translateX(${window.innerWidth}px)`;
      fm.style.opacity    = '0';
      setTimeout(() => {
        fm.style.transform = '';
        fm.style.opacity   = '';
        fm.style.transition = '';
        closeFocus();
      }, 280);
    } else {
      fm.style.transition = 'transform .22s ease, opacity .22s';
      fm.style.transform  = '';
      fm.style.opacity    = '';
      setTimeout(() => fm.style.transition = '', 220);
    }
    dx = 0;
  }, {passive: true});
})();

setTimeout(() => {
  const s = document.getElementById('splash');
  if (s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 400); }
}, 1200);

// ══════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS — solo desktop
// ══════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  const inInput = e.target.matches('input,textarea,select') || e.target.isContentEditable;

  // Ctrl+K — command palette (works everywhere)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); openCmdPal(); return;
  }
  // Cmd/Ctrl+F — focus search (works everywhere)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    if (!sOpen) tglSearch();
    setTimeout(() => document.getElementById('sinp')?.focus(), 60);
    return;
  }
  // Cmd/Ctrl+Enter — save & close focus modal
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    const fm = document.getElementById('focus-modal');
    if (fm?.classList.contains('open')) { e.preventDefault(); doFocusSave(true); }
    return;
  }
  // Alt+C — zen mode (only when focus editor is open)
  if (e.altKey && e.key.toLowerCase() === 'c') {
    const fm = document.getElementById('focus-modal');
    if (fm?.classList.contains('open')) { e.preventDefault(); toggleZen(); }
    return;
  }
  // Esc — close: slash menu → command palette → zen → focus modal → search
  if (e.key === 'Escape') {
    if (_slashOpen) { closeSlashMenu(); return; }
    if (_palOpen)   { _closeCmdPal(); return; }
    if (_zenMode)   { toggleZen(); return; }
    const fm = document.getElementById('focus-modal');
    if (fm?.classList.contains('open')) { closeFocus(); return; }
    if (sOpen) { tglSearch(); return; }
    return;
  }

  if (inInput) return;
  if (e.metaKey || e.ctrlKey) return;
  if (window.innerWidth < 680) return;
  switch(e.key) {
    case 'n': case 'N': e.preventDefault(); onFab(); break;
    case '1': goTab('prom'); break;
    case '2': goTab('idee'); break;
    case '3': goTab('liste'); break;
    case '4': goTab('cestino'); break;
    case '/': e.preventDefault(); tglSearch(); break;
  }
});

// ══════════════════════════════════════════════════════════
// SERVICE WORKER — registra il SW per la modalità offline (PWA)
// Il file notes-sw.js gestisce la cache e gli aggiornamenti.
// .catch(() => {}) ignora silenziosamente se il SW non è supportato.
// ══════════════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
