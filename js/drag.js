// ══════════════════════════════════════════════════════════
// DRAG AND DROP — riordina le card con pressione lunga + trascinamento
//
// Come funziona:
// 1. touchstart: avvia un timer di 420ms
// 2. Se il dito non si sposta, dopo 420ms → startDrag (prende il controllo)
// 3. touchmove: sposta il "ghost" (copia visiva) e segna la card sotto come target
// 4. touchend: endDrag → scambia le posizioni nell'array e ri-renderizza
//
// Variabili globali usate:
//   dSrcId: id della card che stai trascinando
//   dOvId: id della card su cui stai passando sopra
//   dGhost: elemento DOM clonato che segue il dito
// ══════════════════════════════════════════════════════════
function initDrag(container, tp) {
  if (window.innerWidth >= 680) return; // swipe e touch-drag solo su mobile
  const THRESH = 65; // soglia in px per attivare l'azione
  container.querySelectorAll('.card[data-id]').forEach(card => {
    const slot      = card.closest('.card-slot');
    const delHint   = slot?.querySelector('.del-hint');
    const shareHint = slot?.querySelector('.share-hint');
    let lt = null, dragging = false, ox = 0, oy = 0, moved = false, swiped = false, didDrag = false, lastDx = 0, threshReached = false;
    const clearHints = () => {
      delHint?.classList.remove('hint-on');
      shareHint?.classList.remove('hint-on');
    };
    const snapBack = () => {
      card.style.transition = 'transform .2s ease';
      card.style.transform  = 'translateX(0)';
      clearHints();
    };
    card.addEventListener('touchstart', e => {
      if (e.target.closest('button,input,.lck,.pcb')) return;
      const t = e.touches[0]; ox = t.clientX; oy = t.clientY;
      moved = false; swiped = false; didDrag = false; lastDx = 0; threshReached = false;
      lt = setTimeout(() => { dragging = true; startDrag(card, t); }, 420);
    }, {passive:true});
    card.addEventListener('touchmove', e => {
      const t  = e.touches[0];
      const dx = t.clientX - ox;
      const dy = Math.abs(t.clientY - oy);
      lastDx = dx;
      if (!moved && (Math.abs(dx) > 9 || dy > 9)) {
        moved = true;
        if (lt) { clearTimeout(lt); lt = null; }
      }
      if (moved && !dragging && !swiped) {
        if (dx > 10 && dx > dy * 1.6) {
          // Swipe destra → [del] con rubber-band dopo la soglia
          if (e.cancelable) e.preventDefault();
          const pos = dx < THRESH ? dx : THRESH + (dx - THRESH) * 0.22;
          card.style.transition = 'none';
          card.style.transform  = `translateX(${pos}px)`;
          if (!threshReached && dx >= THRESH) {
            threshReached = true;
            if (navigator.vibrate) navigator.vibrate(8);
            delHint?.classList.add('hint-on');
          } else if (threshReached && dx < THRESH) {
            threshReached = false;
            delHint?.classList.remove('hint-on');
          }
        } else if (dx < -10 && Math.abs(dx) > dy * 1.5) {
          // Swipe sinistra → [share] con rubber-band dopo la soglia
          if (e.cancelable) e.preventDefault();
          const absDx = Math.abs(dx);
          const pos   = absDx < THRESH ? dx : -(THRESH + (absDx - THRESH) * 0.22);
          card.style.transition = 'none';
          card.style.transform  = `translateX(${pos}px)`;
          if (!threshReached && dx <= -THRESH) {
            threshReached = true;
            if (navigator.vibrate) navigator.vibrate(8);
            shareHint?.classList.add('hint-on');
          } else if (threshReached && dx > -THRESH) {
            threshReached = false;
            shareHint?.classList.remove('hint-on');
          }
        }
      }
      if (dragging) { if (e.cancelable) e.preventDefault(); moveDrag(e.touches[0], container); }
    }, {passive:false});
    card.addEventListener('touchend', () => {
      if (lt) { clearTimeout(lt); lt = null; }
      if (dragging) { dragging = false; didDrag = true; endDrag(container, tp); return; }
      if (threshReached && lastDx >= THRESH) {
        // Soglia destra superata → elimina
        swiped = true;
        card.style.transition = 'transform .28s ease,opacity .28s ease';
        card.style.transform  = 'translateX(110%)';
        card.style.opacity    = '0';
        clearHints();
        setTimeout(() => delItem(card.dataset.id, tp), 280);
      } else if (threshReached && lastDx <= -THRESH) {
        // Soglia sinistra superata → share
        snapBack();
        shareItem(card.dataset.id, tp);
      } else {
        snapBack();
      }
    }, {passive:true});
    card.addEventListener('click', e => { if (didDrag) { didDrag = false; e.stopPropagation(); e.preventDefault(); } }, true);
    card.addEventListener('touchcancel', () => {
      if (lt) { clearTimeout(lt); lt = null; }
      if (dragging) { dragging = false; cancelDrag(); }
      snapBack();
    });
  });
}

// Condivide il testo di una nota via Web Share API (iOS share sheet) o clipboard
function shareItem(id, tp) {
  const arr = tp === 'prom' ? S.proms : S.idee;
  const it  = arr?.find(i => i.id === id); if (!it) return;
  const text = (it.title ? it.title + '\n\n' : '') + it.text;
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text)
      .then(() => toast('[copiato]'))
      .catch(() => toast('[errore copia]'));
  }
}

// Crea il ghost e segna la card originale come placeholder
function startDrag(card, t) {
  dSrcId = card.dataset.id;
  const r = card.getBoundingClientRect();
  dGhost = card.cloneNode(true);
  dGhost.className = 'card drag-ghost';
  dGhost.style.width  = r.width  + 'px';
  dGhost.style.height = r.height + 'px';
  dGhost.style.left   = r.left   + 'px';
  dGhost.style.top    = (t.clientY - r.height / 2) + 'px';
  document.body.appendChild(dGhost);
  card.classList.add('drag-src');
  if (navigator.vibrate) navigator.vibrate(40);
}

// Sposta il ghost e riordina le card nel DOM in tempo reale
function moveDrag(t, container) {
  if (!dGhost || !dSrcId) return;
  dGhost.style.top = (t.clientY - parseInt(dGhost.style.height || 60) / 2) + 'px';

  // Trova quale slot è sotto il dito
  dGhost.style.display = 'none';
  const hit = document.elementFromPoint(t.clientX, t.clientY);
  dGhost.style.display = '';

  const targetCard = hit?.closest('.card[data-id]');
  if (!targetCard || targetCard.dataset.id === dSrcId) return;

  const srcSlot = container.querySelector(`.card[data-id="${dSrcId}"]`)?.closest('.card-slot');
  const tgtSlot = targetCard.closest('.card-slot');
  if (!srcSlot || !tgtSlot || srcSlot === tgtSlot) return;

  // Inserisce prima o dopo in base alla posizione verticale del dito
  const tgtRect = tgtSlot.getBoundingClientRect();
  if (t.clientY < tgtRect.top + tgtRect.height / 2) {
    container.insertBefore(srcSlot, tgtSlot);
  } else {
    container.insertBefore(srcSlot, tgtSlot.nextSibling);
  }
}

// Rilascio: sincronizza l'array con l'ordine del DOM e persiste
function endDrag(container, tp) {
  if (dGhost) { dGhost.remove(); dGhost = null; }
  const srcCard = container.querySelector(`.card[data-id="${dSrcId}"]`);
  if (srcCard) srcCard.classList.remove('drag-src');

  // Legge il nuovo ordine dal DOM e aggiorna l'array
  const k = tp === 'prom' ? 'proms' : tp;
  const newOrder = [...container.querySelectorAll('.card[data-id]')].map(c => c.dataset.id);
  S[k] = newOrder.map(id => S[k].find(i => i.id === id)).filter(Boolean);
  persist(); updateStats();
  dSrcId = null; dOvId = null;
}

// Drag annullato: ripristina visivamente e ri-renderizza
function cancelDrag() {
  if (dGhost) { dGhost.remove(); dGhost = null; }
  document.querySelectorAll('.drag-src').forEach(c => c.classList.remove('drag-src'));
  dSrcId = null; dOvId = null;
  renderAll();
}

// Drag con mouse su desktop — inizia subito al mousedown + move > 5px
function initMouseDrag(container, tp) {
  container.querySelectorAll('.card[data-id]').forEach(card => {
    card.addEventListener('mousedown', e => {
      if (e.target.closest('button,input,.lck,.pcb')) return;
      if (e.button !== 0) return;
      e.preventDefault();
      let dragging = false;
      const sx = e.clientX, sy = e.clientY;
      const onMove = ev => {
        if (!dragging && (Math.abs(ev.clientX-sx)>5 || Math.abs(ev.clientY-sy)>5)) {
          dragging = true;
          startDrag(card, ev);
        }
        if (dragging) moveDrag(ev, container);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (dragging) endDrag(container, tp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// Drag note cartella su desktop — riordina e drop sulla zona destra per eliminare
function initFolderDrag(container) {
  if (window.innerWidth < 680) return;

  const dz = document.getElementById('folder-drop-zone');
  if (!dz) return;

  const overZone = ev => {
    const r = dz.getBoundingClientRect();
    return ev.clientX >= r.left && ev.clientX <= r.right &&
           ev.clientY >= r.top  && ev.clientY <= r.bottom;
  };

  container.querySelectorAll('.card[data-id]').forEach(card => {
    card.addEventListener('mousedown', e => {
      if (e.target.closest('button,input')) return;
      if (e.button !== 0) return;
      e.preventDefault();

      const sx = e.clientX, sy = e.clientY;
      let started = false, ghost = null, dragId = null, gw = 0, gh = 0;

      const onMove = ev => {
        if (!started && (Math.abs(ev.clientX - sx) > 5 || Math.abs(ev.clientY - sy) > 5)) {
          started = true;
          dragId = card.dataset.id;
          const r = card.getBoundingClientRect();
          gw = r.width; gh = r.height;
          ghost = card.cloneNode(true);
          ghost.className = 'card drag-ghost';
          ghost.style.width  = gw + 'px';
          ghost.style.height = gh + 'px';
          ghost.style.left   = (ev.clientX - gw / 2) + 'px';
          ghost.style.top    = (ev.clientY - gh / 2) + 'px';
          document.body.appendChild(ghost);
          card.classList.add('drag-src');
          dz.classList.add('visible');
        }
        if (!started) return;

        // ghost segue il cursore in 2D
        ghost.style.left = (ev.clientX - gw / 2) + 'px';
        ghost.style.top  = (ev.clientY - gh / 2) + 'px';

        // evidenzia zona drop
        dz.classList.toggle('drag-over', overZone(ev));

        // riordina card nella colonna note solo se non siamo sulla zona drop
        if (!overZone(ev)) {
          ghost.style.display = 'none';
          const hit = document.elementFromPoint(ev.clientX, ev.clientY);
          ghost.style.display = '';
          const tgt = hit?.closest('.card[data-id]');
          if (tgt && tgt !== card && container.contains(tgt)) {
            const tr = tgt.getBoundingClientRect();
            container.insertBefore(card, ev.clientY < tr.top + tr.height / 2 ? tgt : tgt.nextSibling);
          }
        }
      };

      const onUp = ev => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (!started) return;

        // controlla zona PRIMA di nasconderla (altrimenti getBoundingClientRect → 0)
        const dropped = overZone(ev);
        dz.classList.remove('drag-over', 'visible');
        if (ghost) { ghost.remove(); ghost = null; }
        card.classList.remove('drag-src');

        const id = dragId; dragId = null;
        if (dropped) {
          // sposta nella colonna destra (parcheggio) — non cancella
          const n = (S.folderNotes||[]).find(x => x.id === id);
          if (n) { n.parked = true; persist(); renderFolder(); }
        } else {
          // riordina solo le note attive della cartella corrente
          const newOrder = [...container.querySelectorAll('.card[data-id]')].map(c => c.dataset.id);
          const altri = (S.folderNotes||[]).filter(n => n.folder !== curFolder || n.parked);
          const riord = newOrder.map(i => (S.folderNotes||[]).find(n => n.id === i)).filter(Boolean);
          S.folderNotes = [...altri, ...riord];
          persist();
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// ══════════════════════════════════════════════════════════
// DRAG VOCI LISTA — riordina le voci dentro una lista
// Usa un handle ⠿ su ogni riga; touch e mouse supportati.
// ══════════════════════════════════════════════════════════
function initListItemDrag(lid) {
  const lst    = S.liste.find(x => x.id === lid);
  const lrows  = document.querySelector(`.card[data-id="${lid}"] .lrows`);
  if (!lst || !lrows) return;

  let srcRow = null, gh = null, oy = 0;

  const doStart = (row, cx, cy) => {
    srcRow = row;
    const r = row.getBoundingClientRect();
    oy = cy - r.top;
    gh = row.cloneNode(true);
    gh.className = 'lrow lrow-ghost';
    gh.style.width = r.width + 'px';
    gh.style.left  = r.left  + 'px';
    gh.style.top   = r.top   + 'px';
    document.body.appendChild(gh);
    row.style.opacity = '.15';
  };

  const doMove = (cx, cy) => {
    if (!gh || !srcRow) return;
    gh.style.top = (cy - oy) + 'px';
    gh.style.display = 'none';
    const hit = document.elementFromPoint(cx, cy);
    gh.style.display = '';
    const tgt = hit?.closest('.lrow[data-iid]');
    if (tgt && tgt !== srcRow && lrows.contains(tgt)) {
      const tr = tgt.getBoundingClientRect();
      lrows.insertBefore(srcRow, cy < tr.top + tr.height / 2 ? tgt : tgt.nextSibling);
    }
  };

  const doEnd = () => {
    if (gh) { gh.remove(); gh = null; }
    if (!srcRow) return;
    srcRow.style.opacity = '';
    const newOrder = [...lrows.querySelectorAll('.lrow[data-iid]')].map(r => r.dataset.iid);
    lst.items = newOrder.map(id => lst.items.find(i => i.id === id)).filter(Boolean);
    lst.updated = Date.now();
    persist();
    srcRow = null;
  };

  lrows.querySelectorAll('.ldrag').forEach(handle => {
    const row = handle.closest('.lrow');

    // Mouse
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      doStart(row, e.clientX, e.clientY);
      const onMove = ev => doMove(ev.clientX, ev.clientY);
      const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); doEnd(); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // Touch
    handle.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      doStart(row, t.clientX, t.clientY);
      if (navigator.vibrate) navigator.vibrate(20);
    }, {passive: false});

    handle.addEventListener('touchmove', e => {
      if (!gh) return;
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      doMove(t.clientX, t.clientY);
    }, {passive: false});

    handle.addEventListener('touchend',    doEnd, {passive: true});
    handle.addEventListener('touchcancel', doEnd, {passive: true});
  });
}

// ══════════════════════════════════════════════════════════
// SWIPE TRA TAB — swipe orizzontale per cambiare sezione
// Solo su mobile; non interferisce con lo swipe delle card
// (il tocco sulle .card-slot viene ignorato)
// ══════════════════════════════════════════════════════════
function initTabSwipe() {
  const TAB_ORDER = ['prom','idee','liste','cestino'];
  const views = document.querySelector('.views');
  let tx = null, ty = 0, moving = false;

  views.addEventListener('touchstart', e => {
    // Ignora se il tocco parte su una card o su un elemento interattivo
    if (e.target.closest('.card-slot,button,input,.lck,.pcb,.ldrag')) {
      tx = null; return;
    }
    const t = e.touches[0];
    tx = t.clientX; ty = t.clientY; moving = false;
  }, {passive: true});

  views.addEventListener('touchmove', e => {
    if (tx === null) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - tx) > 8 || Math.abs(t.clientY - ty) > 8) moving = true;
  }, {passive: true});

  views.addEventListener('touchend', e => {
    if (tx === null || !moving) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - tx;
    const dy = Math.abs(t.clientY - ty);
    tx = null; moving = false;
    // Soglia 70px orizzontale, angolo non troppo verticale
    if (Math.abs(dx) < 70 || dy > Math.abs(dx) * 0.65) return;
    const idx = TAB_ORDER.indexOf(curTab);
    if (dx < 0 && idx < TAB_ORDER.length - 1) goTab(TAB_ORDER[idx + 1]); // sinistra → avanti
    if (dx > 0 && idx > 0)                    goTab(TAB_ORDER[idx - 1]); // destra  → indietro
  }, {passive: true});
}
