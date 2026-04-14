// ══════════════════════════════════════════════════════════
// RENDER PROMEMORIA
// Costruisce l'HTML delle card e lo inietta in #prom-l.
// Ordine: prima i fissati (pinned), poi per data decrescente.
// Se c'è una ricerca attiva filtra prima di rendere.
// ══════════════════════════════════════════════════════════
function renderProms() {
  const el = document.getElementById('prom-l');
  let items = [...curProms()].sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0));
  if (q) items = items.filter(i => matches([i.text]));
  if (!items.length) {
    el.innerHTML = '<div class="empty">nessun promemoria.<br>[ + ] per aggiungerne uno.</div>';
    return;
  }
  el.innerHTML = items.map(i => {
    const peek = esc(_stripHtml(i.text).slice(0, 70));
    return `
    <div class="card-slot">
      <div class="del-hint">[del]</div>
      <div class="share-hint">[share]</div>
      <div class="card${i.pinned?' pin-on':''}${clrCls(i.color)}${i.collapsed?' collapsed':''}" data-id="${i.id}" data-tp="prom">
        <div class="card-peek">${peek || '—'}</div>
        <div class="prow">
          <div class="pcb" onclick="chkProm('${i.id}')"></div>
          <div class="ptext" onclick="openFocus('prom','${i.id}')">${mdCard(i.text, i.id, 'prom')}</div>
        </div>
        ${deadlineBar(i)}
        <div class="cmeta">
          <span class="cts">${fmtTs(i.created)}${deadlineTag(i)}</span>
          <div class="cacts">
            <button class="cact"     onclick="toggleCollapse('${i.id}','prom')">[${i.collapsed?'show':'hide'}]</button>
            <button class="cact"     onclick="pinItem('${i.id}','prom')">[${i.pinned?'unpin':'pin'}]</button>
            <button class="cact"     onclick="openFocus('prom','${i.id}')">[edit]</button>
            <button class="cact cact-share" onclick="shareItem('${i.id}','prom')">[share]</button>
            <button class="cact del" onclick="delItem('${i.id}','prom')">[del]</button>
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  initDrag(el, 'prom');
  initMouseDrag(el, 'prom');
  applyTwemoji(el);
}

// Segna un promemoria come fatto: anima la card verso destra, poi la rimuove.
// Non va nel cestino: è un completamento, non una cancellazione.
function chkProm(id) {
  const card = document.querySelector(`.card[data-id="${id}"]`);
  const el   = card?.closest('.card-slot') || card;
  if (!el) return;
  el.style.transition = 'opacity .28s ease,transform .28s ease';
  el.style.opacity    = '0';
  el.style.transform  = 'translateX(44px)';
  setTimeout(() => {
    const idx = S.proms.findIndex(i => i.id === id);
    if (idx !== -1) {
      S.cestino.unshift({...S.proms[idx], type:'prom', deletedAt:Date.now()});
      S.proms.splice(idx, 1);
    }
    persist(); renderAll();
  }, 300);
}

// ══════════════════════════════════════════════════════════
// RENDER IDEE — stessa logica di renderProms
// Le idee hanno anche un titolo opzionale
// ══════════════════════════════════════════════════════════
function renderIdee() {
  const el = document.getElementById('idee-l');
  let items = [...curIdee()].sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0));
  if (q) items = items.filter(i => matches([i.title, i.text]));
  if (!items.length) {
    el.innerHTML = '<div class="empty">nessuna idea.<br>[ + ] per aggiungerne una.</div>';
    return;
  }
  el.innerHTML = items.map(i => {
    const peek = i.title ? '' : (esc(_stripHtml(i.text).slice(0, 70)) || '—');
    return `
    <div class="card-slot">
      <div class="del-hint">[del]</div>
      <div class="share-hint">[share]</div>
      <div class="card${i.pinned?' pin-on':''}${clrCls(i.color)}${i.collapsed?' collapsed':''}" data-id="${i.id}" data-tp="idee">
        <div class="card-peek">${peek}</div>
        ${i.title ? `<div class="ctitle ctitle-outer" onclick="openFocus('idee','${i.id}')">${esc(i.title)}</div>` : ''}
        <div class="cbody idea-body${i.title?' has-title':''}" onclick="openFocus('idee','${i.id}')">
          <div class="ctext">${mdCard(i.text, i.id, 'idee')}</div>
        </div>
        ${deadlineBar(i)}
        <div class="cmeta">
          <span class="cts">${fmtTs(i.created)}${deadlineTag(i)}</span>
          <div class="cacts">
            <button class="cact"     onclick="toggleCollapse('${i.id}','idee')">[${i.collapsed?'show':'hide'}]</button>
            <button class="cact"     onclick="pinItem('${i.id}','idee')">[${i.pinned?'unpin':'pin'}]</button>
            <button class="cact"     onclick="openFocus('idee','${i.id}')">[edit]</button>
            <button class="cact cact-share" onclick="shareItem('${i.id}','idee')">[share]</button>
            <button class="cact del" onclick="delItem('${i.id}','idee')">[del]</button>
          </div>
        </div>
      </div>
    </div>
  `}).join('');
  // Aggiungi fade gradient alle card con testo lungo
  requestAnimationFrame(() => {
    el.querySelectorAll('.idea-body').forEach(b => {
      b.classList.toggle('overflows', b.scrollHeight > b.clientHeight + 2);
    });
  });
  initDrag(el, 'idee');
  initMouseDrag(el, 'idee');
  applyTwemoji(el);
}

// ══════════════════════════════════════════════════════════
// RENDER LISTE — ogni lista ha header, righe e riga aggiungi
// done/tot: contatore voci completate per la lista
// ══════════════════════════════════════════════════════════
function renderListe() {
  const el = document.getElementById('liste-l');
  let items = [...S.liste].sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0));
  if (q) items = items.filter(i => matches([i.title, ...i.items.map(r => r.text)]));
  if (!items.length) {
    el.innerHTML = '<div class="empty">nessuna lista.<br>[ + ] per crearne una.</div>';
    return;
  }
  el.innerHTML = items.map(lst => {
    const done = lst.items.filter(r => r.done).length;
    return `
      <div class="card-slot">
      <div class="del-hint">[del]</div>
      <div class="card${lst.pinned?' pin-on':''}${clrCls(lst.color)}${lst.collapsed?' collapsed':''}" data-id="${lst.id}" data-tp="liste">
        <div class="lhead">
          <span class="ltitle">${esc(lst.title)}</span>
          <span class="lprog">${done}/${lst.items.length}</span>
        </div>
        <div class="lrows">
          ${lst.items.map(r => `
            <div class="lrow" data-iid="${r.id}">
              <div class="ldrag">⠿</div>
              <div class="lck${r.done?' on':''}" onclick="tglLI('${lst.id}','${r.id}')">${r.done?'✓':''}</div>
              <span class="lit${r.done?' done':''}" onclick="editLI('${lst.id}','${r.id}')">${esc(r.text)}</span>
              <button class="ldel" onclick="delLI('${lst.id}','${r.id}')">×</button>
            </div>
          `).join('')}
        </div>
        <!-- Input in fondo per aggiungere nuove voci: Invio o + -->
        <div class="ladd">
          <input class="laddinp" id="ladd-${lst.id}" placeholder="Aggiungi voce..."
            onkeydown="if(event.key==='Enter')addLI('${lst.id}',this)">
          <button class="laddbtn" onclick="addLI('${lst.id}',document.getElementById('ladd-${lst.id}'))">+</button>
        </div>
        <div class="cmeta">
          <span class="cts">${fmtTs(lst.created)}</span>
          <div class="cacts">
            <button class="cact"     onclick="toggleCollapse('${lst.id}','liste')">[${lst.collapsed?'show':'hide'}]</button>
            <button class="cact"     onclick="pinItem('${lst.id}','liste')">[${lst.pinned?'unpin':'pin'}]</button>
            <button class="cact"     onclick="openListaMod('${lst.id}')">[edit]</button>
            <button class="cact del" onclick="delItem('${lst.id}','liste')">[del]</button>
          </div>
        </div>
      </div>
      </div>
    `;
  }).join('');
  initDrag(el, 'liste');
  initMouseDrag(el, 'liste');
  items.forEach(lst => initListItemDrag(lst.id));
  applyTwemoji(el);
}

// ══════════════════════════════════════════════════════════
// RENDER CESTINO — mostra gli elementi eliminati con scadenza
// Gli elementi vengono eliminati definitivamente dopo 30 giorni
// oppure manualmente con [elimina] o [svuota cestino]
// ══════════════════════════════════════════════════════════
function renderCestino() {
  const el = document.getElementById('cestino-wrap');
  if (!S.cestino.length) {
    el.innerHTML = '<div class="empty">cestino vuoto.</div>';
    return;
  }
  // Ordina per data eliminazione: i più recenti prima
  const items = [...S.cestino].sort((a,b) => b.deletedAt - a.deletedAt);
  const lbl   = {prom:'prom', idee:'idea', liste:'lista'};

  let html = '<div class="cestino-notice">[ elementi conservati 30 giorni ]</div>';
  html += '<div class="stack" style="margin-top:10px">';
  html += items.map(i => {
    // Anteprima del contenuto: testo per prom/idee, voci per liste
    const preview = i.text
      ? i.text.slice(0, 80) + (i.text.length > 80 ? '…' : '')
      : i.items ? i.items.map(x => x.text).join(', ').slice(0, 80) : '';
    return `
      <div class="card">
        <div class="cbody">
          <!-- Metadati: tipo, quando eliminato, quando scade -->
          <div style="font-size:8px;color:var(--dim);margin-bottom:6px;letter-spacing:.05em">
            [${lbl[i.type]||i.type}] · ${fmtTs(i.deletedAt)} · ${fmtTrashExp(i.deletedAt)}
          </div>
          ${i.title ? `<div class="ctitle">${esc(i.title)}</div>` : ''}
          <div class="ctext" style="opacity:.55">${esc(preview)}</div>
        </div>
        <div class="cmeta">
          <span class="cts">${new Date(i.deletedAt).toLocaleDateString('it-IT',{day:'numeric',month:'short'})}</span>
          <div class="cacts">
            <!-- [ripristina]: rimette l'elemento nella sua sezione originale -->
            <button class="trash-act"     onclick="restoreItem('${i.id}')">[ripristina]</button>
            <!-- [elimina]: cancella definitivamente, senza possibilità di recupero -->
            <button class="trash-act del" onclick="permaDelete('${i.id}')">[elimina]</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  html += '</div>';
  html += `<div style="text-align:center;padding:0 16px 20px">
    <button class="trash-act del" onclick="clearAllTrash()" style="font-size:9px">[svuota cestino]</button>
  </div>`;
  el.innerHTML = html;
  applyTwemoji(el);
}

// ══════════════════════════════════════════════════════════
// CARTELLE — gestione cartelle personalizzate
// ══════════════════════════════════════════════════════════
function renderFolders() {
  const sec = document.getElementById('folders-sec');
  const lst = document.getElementById('folders-list');
  if (!sec || !lst) return;
  const folders = S.folders || [];
  sec.classList.toggle('has-folders', folders.length > 0);
  lst.innerHTML = folders.map(f => {
    const cnt = (S.folderNotes||[]).filter(n => n.folder === f.id).length;
    const dot = f.color ? `<span style="width:5px;height:5px;border-radius:50%;background:${CLRHEX[f.color]};display:inline-block;flex-shrink:0"></span>` : '';
    return `<button class="folder-item${curFolder===f.id?' on':''}" onclick="goFolder('${f.id}')">
      <span style="display:flex;align-items:center;gap:5px">${dot}/ ${esc(f.name)}${cnt ? ' <span style="color:var(--dim);font-size:9px">['+cnt+']</span>' : ''}</span>
      <span style="display:flex;align-items:center;gap:2px">
        <span class="folder-clr" onclick="event.stopPropagation();pickFolderColor('${f.id}')" style="color:${f.color?CLRHEX[f.color]:'var(--dim)'}">[·]</span>
        <span class="folder-del" onclick="event.stopPropagation();delFolder('${f.id}')">[×]</span>
      </span>
    </button>`;
  }).join('');
}

function renderFolder() {
  const el = document.getElementById('folder-l');
  const ep = document.getElementById('folder-parked');
  if (!el) return;
  let all = (S.folderNotes||[]).filter(n => n.folder === curFolder).sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0) || b.created-a.created);
  if (q) all = all.filter(n => matches([n.title, n.text]));
  const active = all.filter(n => !n.parked);
  const parked = all.filter(n =>  n.parked);
  el.innerHTML = active.length ? active.map(n => _folderCardHtml(n, false)).join('') :
    `<div class="empty">${q ? 'nessun risultato.' : 'nessuna nota.<br>scrivine una qui sopra.'}</div>`;
  if (ep) ep.innerHTML = parked.map(n => _folderCardHtml(n, true)).join('');
  initFolderDrag(el);
  applyTwemoji(el);
  if (ep) applyTwemoji(ep);
}

function _folderCardHtml(n, parked) {
  const peek = n.title ? '' : (esc(_stripHtml(n.text).slice(0, 70)) || '—');
  return `
  <div class="card${n.pinned?' pin-on':''}${clrCls(n.color)}${n.collapsed?' collapsed':''}" data-id="${n.id}" data-parked="${parked?'1':'0'}">
    <div class="card-peek">${peek}</div>
    ${n.title ? `<div class="ctitle ctitle-outer" onclick="openFolderNote('${n.id}')">${esc(n.title)}</div>` : ''}
    <div class="cbody idea-body${n.title?' has-title':''}" onclick="openFolderNote('${n.id}')">
      <div class="ctext">${mdCard(n.text, n.id, 'folder')}</div>
    </div>
    ${deadlineBar(n)}
    <div class="cmeta">
      <span class="cts">${fmtTs(n.created)}${deadlineTag(n)}</span>
      <div class="cacts">
        ${parked ? `<button class="cact" onclick="unparkFolderNote('${n.id}')">[← riporta]</button>` : `<button class="cact" onclick="toggleCollapse('${n.id}','folder')">[${n.collapsed?'show':'hide'}]</button>`}
        <button class="cact" onclick="pinFolderNote('${n.id}')">[${n.pinned?'unpin':'pin'}]</button>
        <button class="cact" onclick="openFolderNote('${n.id}')">[edit]</button>
        <button class="cact del" onclick="delFolderNote('${n.id}')">[del]</button>
      </div>
    </div>
  </div>`;
}

function unparkFolderNote(id) {
  const n = (S.folderNotes||[]).find(x => x.id === id);
  if (n) { n.parked = false; persist(); renderFolder(); }
}

// Re-renderizza tutte e tre le sezioni + aggiorna le statistiche
function renderAll() { renderProms(); renderIdee(); renderListe(); updateStats(); renderFolders(); if (curFolder) renderFolder(); }
