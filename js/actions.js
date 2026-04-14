// ══════════════════════════════════════════════════════════
// QUICK CAPTURE — aggiunge un promemoria dalla barra rapida
// Se non sei già nel tab Promemoria, ci porta automaticamente
// ══════════════════════════════════════════════════════════
function qAdd(inp) {
  const t = inp.value.trim(); if (!t) return;
  const now = Date.now();
  // unshift() aggiunge in cima all'array (più recente primo)
  curProms().unshift({id:uid(), text:t, title:'', color:null, pinned:false, created:now, updated:now});
  inp.value = ''; persist(); renderAll();
  toast('[+ prom]');
  if (curTab !== 'prom') goTab('prom');
}

// Toggle pin: fissa/sfissa una card in cima alla lista
function pinItem(id, tp) {
  const arr = tp === 'prom' ? curProms() : curIdee();
  const it = arr.find(i => i.id===id); if (!it) return;
  it.pinned = !it.pinned; persist(); renderAll();
  toast(it.pinned ? '[fissato]' : '[rimosso dai fissati]');
}

// Elimina (soft delete): sposta l'elemento nel cestino invece di rimuoverlo.
// Aggiunge i campi type (per sapere da dove veniva) e deletedAt (per la scadenza).
function delItem(id, tp) {
  const card = document.querySelector(`.card[data-id="${id}"]`);
  const el   = card?.closest('.card-slot') || card;
  const commit = () => {
    if (secretMode && (tp === 'prom' || tp === 'idee')) {
      const arr = tp === 'prom' ? S.secret.proms : S.secret.idee;
      const idx = arr.findIndex(i => i.id === id);
      if (idx !== -1) arr.splice(idx, 1);
      persist(); renderAll(); toast('[eliminato]');
    } else {
      const k   = tp === 'prom' ? 'proms' : tp;
      const idx = S[k].findIndex(i => i.id === id);
      if (idx === -1) return;
      S.cestino.unshift({...S[k][idx], type: tp, deletedAt: Date.now()});
      S[k].splice(idx, 1);
      persist(); renderAll(); toast('[nel cestino]');
    }
  };
  if (el) {
    el.style.transition = 'opacity .22s ease,transform .22s ease';
    el.style.opacity    = '0';
    el.style.transform  = 'translateX(28px)';
    setTimeout(commit, 230);
  } else { commit(); }
}

// Ripristina un elemento dal cestino alla sua sezione originale (proms/idee/liste)
function restoreItem(id) {
  const idx = S.cestino.findIndex(i => i.id === id);
  if (idx === -1) return;
  const it = {...S.cestino[idx]};
  const tp = it.type;
  delete it.type; delete it.deletedAt; // rimuove i campi cestino-specifici
  S.cestino.splice(idx, 1);
  const k = tp === 'prom' ? 'proms' : tp;
  S[k].unshift(it); // aggiunge in cima alla sezione
  persist(); renderAll(); renderCestino(); updateStats();
  toast('[ripristinato]');
}

// Elimina definitivamente un elemento dal cestino (con conferma)
function permaDelete(id) {
  if (!confirm('Eliminare definitivamente?')) return;
  S.cestino = S.cestino.filter(i => i.id !== id);
  persist(); renderCestino(); updateStats();
  toast('[eliminato]');
}

// Svuota l'intero cestino (con conferma)
function clearAllTrash() {
  if (!confirm('Svuotare tutto il cestino?')) return;
  S.cestino = []; persist(); renderCestino(); updateStats();
  toast('[cestino svuotato]');
}

// Rimuove automaticamente gli elementi scaduti (> 30 giorni).
// Chiamata all'avvio dell'app così il cestino si pulisce da solo.
function purgeTrash() {
  const before = S.cestino.length;
  S.cestino = S.cestino.filter(i => (Date.now() - i.deletedAt) < TRASH_TTL);
  if (S.cestino.length < before) persist(); // salva solo se c'è stato un cambiamento
}

// ══════════════════════════════════════════════════════════
// HELPERS LISTA — operazioni sulle voci delle liste
// lid: id della lista  |  iid: id della voce
// ══════════════════════════════════════════════════════════

// Inverte lo stato done/non-done di una voce
function tglLI(lid, iid) {
  const l = S.liste.find(x => x.id===lid); if (!l) return;
  const it = l.items.find(x => x.id===iid); if (!it) return;
  it.done = !it.done; l.updated = Date.now(); persist(); renderListe();
}
// Aggiunge una nuova voce alla lista, poi rimette il focus sull'input
function addLI(lid, inp) {
  const t = inp.value.trim(); if (!t) return;
  const l = S.liste.find(x => x.id===lid); if (!l) return;
  l.items.push({id:uid(), text:t, done:false});
  l.updated = Date.now(); inp.value = ''; persist(); renderListe();
  setTimeout(() => { const ni = document.getElementById('ladd-'+lid); if (ni) ni.focus(); }, 50);
}
// Rimuove una voce dalla lista
function delLI(lid, iid) {
  const l = S.liste.find(x => x.id===lid); if (!l) return;
  l.items = l.items.filter(i => i.id!==iid); l.updated = Date.now(); persist(); renderListe();
}
// Modifica il testo di una voce con un prompt nativo
function editLI(lid, iid) {
  const l = S.liste.find(x => x.id===lid); if (!l) return;
  const it = l.items.find(x => x.id===iid); if (!it) return;
  const t = prompt('Modifica:', it.text);
  if (t !== null && t.trim()) { it.text = t.trim(); l.updated = Date.now(); persist(); renderListe(); }
}

// ══════════════════════════════════════════════════════════
// COLLASSA / ESPANDI CARD
// ══════════════════════════════════════════════════════════
function toggleCollapse(id, tp) {
  let arr;
  if      (tp === 'prom')   arr = curProms();
  else if (tp === 'idee')   arr = curIdee();
  else if (tp === 'folder') arr = S.folderNotes;
  else if (tp === 'liste')  arr = S.liste;
  else return;
  const it = arr?.find(i => i.id === id);
  if (!it) return;
  it.collapsed = !it.collapsed;
  persist();
  if      (tp === 'prom')   renderProms();
  else if (tp === 'idee')   renderIdee();
  else if (tp === 'liste')  renderListe();
  else if (tp === 'folder') renderFolder();
}

// ══════════════════════════════════════════════════════════
// COLOR PICKER
// pickClr(): aggiorna ePick (colore scelto temporaneamente)
// ══════════════════════════════════════════════════════════
function pickClr(elId, c) { ePick = c === 'none' ? null : c; buildClrPick(elId, c); }

// ══════════════════════════════════════════════════════════
// NOME — tap sul nome apre un prompt nativo per modificarlo
// ══════════════════════════════════════════════════════════
function editName() {
  const n = prompt('Nome:', S.name);
  if (n && n.trim()) {
    S.name = n.trim();
    persist(); // salva subito
    document.getElementById('name-lbl').textContent = S.name; // aggiorna il DOM
  }
}

// ══════════════════════════════════════════════════════════
// CARTELLE — gestione cartelle personalizzate
// ══════════════════════════════════════════════════════════
function openFolderForm() {
  document.getElementById('new-folder-btn').style.display = 'none';
  const form = document.getElementById('new-folder-form');
  form.classList.add('open');
  setTimeout(() => document.getElementById('nfinp').focus(), 50);
}
function closeFolderForm() {
  document.getElementById('nfinp').value = '';
  document.getElementById('new-folder-form').classList.remove('open');
  document.getElementById('new-folder-btn').style.display = '';
}
function confirmFolder() {
  const name = document.getElementById('nfinp').value.trim();
  if (!name) { closeFolderForm(); return; }
  if (!S.folders) S.folders = [];
  S.folders.push({id: uid(), name});
  persist(); renderFolders();
  closeFolderForm();
  toast('[cartella creata]');
}

function delFolder(id) {
  if (!confirm('Elimina cartella? Le note non vengono eliminate.')) return;
  S.folders = (S.folders||[]).filter(f => f.id !== id);
  // Remove folder assignment from notes
  [...(S.proms||[]), ...(S.idee||[])].forEach(n => { if (n.folder === id) n.folder = null; });
  if (curFolder === id) { curFolder = null; goTab(curTab); }
  persist(); renderFolders();
}

function pickFolderColor(id) {
  const f = (S.folders||[]).find(x => x.id === id); if (!f) return;
  const idx = CLRS.indexOf(f.color);
  f.color = idx === -1 ? CLRS[0] : (idx < CLRS.length - 1 ? CLRS[idx + 1] : null);
  persist(); renderFolders();
}

function assignFolder(id, tp) {
  const folders = S.folders || [];
  if (!folders.length) { toast('nessuna cartella. creane una prima.'); return; }
  const names = folders.map((f,i) => (i+1)+'. '+f.name).join('\n');
  const choice = prompt('Cartella:\n' + names + '\n0. rimuovi', '');
  if (choice === null) return;
  const arr = tp === 'prom' ? S.proms : S.idee;
  const item = arr.find(i => i.id === id);
  if (!item) return;
  if (choice === '0') { item.folder = null; toast('[rimosso dalla cartella]'); }
  else {
    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < folders.length) { item.folder = folders[idx].id; toast('[aggiunto a ' + folders[idx].name + ']'); }
    else return;
  }
  persist(); renderAll(); renderFolders();
}

function unassignFolder(id, tp) {
  const arr = tp === 'prom' ? S.proms : S.idee;
  const item = arr.find(i => i.id === id);
  if (item) { item.folder = null; persist(); renderFolder(); renderFolders(); }
}

function goFolder(id) {
  curFolder = curFolder === id ? null : id;
  // Deselect all tabs visually when a folder is active
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', !curFolder && b.id === 'tab-'+curTab));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', !curFolder ? v.id === 'v-'+curTab : v.id === 'v-folder'));
  document.getElementById('qcap').style.display = '';
  document.getElementById('fab').style.display  = '';
  renderFolders();
  if (curFolder) {
    renderFolder();
    const isEmpty = !(S.folderNotes||[]).some(n => n.folder === curFolder);
    if (isEmpty && window.innerWidth >= 680) {
      setTimeout(() => { const fc = document.getElementById('fc-body'); if (fc) fc.focus(); }, 80);
    }
  } else renderAll();
}

function addFolderNote() {
  const title = (document.getElementById('fc-title').value || '').trim();
  const text  = (document.getElementById('fc-body').value  || '').trim();
  if (!text && !title) return;
  const now = Date.now();
  const note = {id:uid(), title, text, created:now, updated:now, folder:curFolder, pinned:false};
  if (!S.folderNotes) S.folderNotes = [];
  S.folderNotes.unshift(note);
  persist();
  document.getElementById('fc-title').value = '';
  document.getElementById('fc-body').value  = '';
  renderFolder(); renderFolders();
  toast('[nota aggiunta]');
}

function pinFolderNote(id) {
  const it = (S.folderNotes||[]).find(n => n.id === id); if (!it) return;
  it.pinned = !it.pinned; persist(); renderFolder();
  toast(it.pinned ? '[fissato]' : '[rimosso dai fissati]');
}

function delFolderNote(id) {
  if (!confirm('Eliminare questa nota?')) return;
  const note = (S.folderNotes||[]).find(n => n.id === id);
  if (!note) return;
  S.cestino.unshift({...note, type:'folder', deletedAt:Date.now()});
  S.folderNotes = (S.folderNotes||[]).filter(n => n.id !== id);
  persist(); renderFolder(); renderFolders();
  toast('[nel cestino]');
}

// ══════════════════════════════════════════════════════════
// MODAL CARD (promemoria / idea)
// openCardMod(): prepara il modal (titolo, campi, color picker) poi lo apre
//   tp: 'prom' o 'idee'
//   id: se presente → modifica; se null → creazione nuova
// saveCard(): legge i valori dal form, salva in S, chiude il modal
// ══════════════════════════════════════════════════════════
function openCardMod(tp, id) {
  eType = tp; eId = id || null;
  let ttl, hd = '', tx = '', clr = null;
  if (id) {
    // Modalità modifica: carica i dati esistenti
    const arr = tp === 'prom' ? curProms() : curIdee();
    const it = arr.find(i => i.id===id); if (!it) return;
    ttl = tp === 'prom' ? 'Modifica promemoria' : 'Modifica idea';
    hd = it.title||''; tx = it.text; clr = it.color;
  } else {
    // Modalità creazione
    ttl = tp === 'prom' ? 'Nuovo promemoria' : 'Nuova idea';
  }
  ePick = clr || null;
  document.getElementById('m-card-ttl').textContent = ttl;
  document.getElementById('m-card-hd').value = hd;
  // Il campo titolo è visibile solo per le Idee (non per i Promemoria)
  document.getElementById('m-hd-wrap').style.display = tp === 'prom' ? 'none' : '';
  document.getElementById('m-card-tx').value = tx;
  buildClrPick('m-card-clr', ePick || 'none');
  // Carica/resetta il campo deadline
  const mdInp = document.getElementById('m-deadline-inp');
  const mdBtn = document.getElementById('m-deadline-toggle');
  const deadlineVal = id ? ((() => { const arr = tp==='prom'?curProms():curIdee(); const it=arr.find(i=>i.id===id); return it?.deadline||null; })()) : null;
  if (deadlineVal) {
    mdInp.value = toLocalDatetimeInput(deadlineVal);
    mdInp.style.display = '';
    mdBtn.textContent = '[on]';
  } else {
    mdInp.value = '';
    mdInp.style.display = 'none';
    mdBtn.textContent = '[off]';
  }
  openModal('m-card');
  setTimeout(() => document.getElementById('m-card-tx').focus(), 300);
}
function saveCard() {
  const tx = document.getElementById('m-card-tx').value.trim();
  if (!tx) { document.getElementById('m-card-tx').focus(); return; } // testo obbligatorio
  const hd  = document.getElementById('m-card-hd').value.trim();
  const now = Date.now();
  const mdInp = document.getElementById('m-deadline-inp');
  const deadline = mdInp.style.display !== 'none' && mdInp.value
    ? new Date(mdInp.value).getTime() : null;
  if (eId) {
    // Aggiorna elemento esistente
    const arr = eType === 'prom' ? curProms() : curIdee();
    const it  = arr.find(i => i.id===eId);
    if (it) { it.text = tx; it.title = hd; it.color = ePick; it.deadline = deadline; it.updated = now; }
  } else {
    // Crea nuovo elemento e lo aggiunge in cima
    const it = {id:uid(), text:tx, title:hd, color:ePick, deadline, pinned:false, created:now, updated:now};
    if (eType === 'prom') curProms().unshift(it); else curIdee().unshift(it);
  }
  persist(); closeModal('m-card'); renderAll();
}

// ══════════════════════════════════════════════════════════
// MODAL LISTA
// openListaMod(): prepara il modal per creare o rinominare una lista
// saveLista(): salva il nome e il colore della lista
// ══════════════════════════════════════════════════════════
function openListaMod(id) {
  eId = id || null; eType = 'liste';
  let nm = '', clr = null;
  if (id) {
    const l = S.liste.find(x => x.id===id);
    if (l) { nm = l.title; clr = l.color; }
    document.getElementById('m-lista-ttl').textContent = 'Rinomina lista';
  } else {
    document.getElementById('m-lista-ttl').textContent = 'Nuova lista';
  }
  ePick = clr || null;
  document.getElementById('m-lista-nm').value = nm;
  buildClrPick('m-lista-clr', ePick || 'none');
  openModal('m-lista');
  setTimeout(() => document.getElementById('m-lista-nm').focus(), 300);
}
function saveLista() {
  const nm = document.getElementById('m-lista-nm').value.trim();
  if (!nm) { document.getElementById('m-lista-nm').focus(); return; }
  const now = Date.now();
  if (eId) {
    const l = S.liste.find(x => x.id===eId);
    if (l) { l.title = nm; l.color = ePick; l.updated = now; }
  } else {
    // Nuova lista: array items vuoto, verrà popolato dall'utente
    S.liste.unshift({id:uid(), title:nm, items:[], color:ePick, pinned:false, created:now, updated:now});
  }
  persist(); closeModal('m-lista'); renderAll();
}

// ══════════════════════════════════════════════════════════
// DEADLINE TOGGLE — mostra/nasconde il campo datetime
// ══════════════════════════════════════════════════════════
function tglDeadlineField() {
  const inp = document.getElementById('m-deadline-inp');
  const btn = document.getElementById('m-deadline-toggle');
  const isOn = inp.style.display !== 'none';
  inp.style.display = isOn ? 'none' : '';
  btn.textContent = isOn ? '[off]' : '[on]';
  if (!isOn) {
    if (!inp.value) {
      inp.value = toLocalDatetimeInput(Date.now() + 86400e3); // default: domani
    }
    setTimeout(() => inp.focus(), 50);
  }
}
function tglFocusDeadlineField() {
  const inp = document.getElementById('focus-deadline-inp');
  const btn = document.getElementById('focus-deadline-toggle');
  const isOn = inp.style.display !== 'none';
  inp.style.display = isOn ? 'none' : '';
  btn.textContent = isOn ? '[off]' : '[on]';
  if (!isOn) {
    if (!inp.value) {
      inp.value = toLocalDatetimeInput(Date.now() + 86400e3); // default: domani
    }
    setTimeout(() => inp.focus(), 50);
  }
}

// ══════════════════════════════════════════════════════════
// FAB [+] — apre il modal giusto in base al tab corrente
// Nel cestino non fa nulla (il bottone è nascosto, ma per sicurezza)
// ══════════════════════════════════════════════════════════
function onFab() {
  if (curFolder) {
    const fc = document.getElementById('fc-body');
    if (fc) { fc.focus(); fc.scrollIntoView({behavior:'smooth', block:'nearest'}); }
    return;
  }
  if (curTab === 'prom')       openCardMod('prom');
  else if (curTab === 'idee')  openCardMod('idee');
  else if (curTab === 'liste') openListaMod();
}

// Seleziona colore nel focus sheet
function pickFocusClr(c, el) {
  focusColor = c === 'none' ? null : c;
  el.parentNode.querySelectorAll('.clrdot').forEach(d => d.classList.remove('sel'));
  el.classList.add('sel');
}
