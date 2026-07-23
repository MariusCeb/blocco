const _fbApp = firebase.initializeApp({
  apiKey: "AIzaSyDuT4RPa4z3JwkOP7uT9ejQYyyA3QzHcVQ",
  authDomain: "blocco-96dd9.firebaseapp.com",
  projectId: "blocco-96dd9",
  storageBucket: "blocco-96dd9.firebasestorage.app",
  messagingSenderId: "8856261247",
  appId: "1:8856261247:web:ef6048b99e0d26c2b3654a"
});

// App Check — verifica che le richieste vengano dalla nostra app reale (reCAPTCHA v3).
// Blocca abuso della API key pubblica da origin non autorizzati. Va attivato
// PRIMA di usare auth/firestore così il token App Check viene allegato alle richieste.
firebase.appCheck().activate('6Ld9JCAtAAAAANsmsAgxHyLGkbVLIoVr1xhDbxgb', true); // true = auto-refresh token

const _fbAuth = firebase.auth();
const _fbDb   = firebase.firestore();
window._fbDb  = _fbDb;
_fbDb.enablePersistence().catch(() => {});

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  _fbAuth.signInWithPopup(provider).catch(err => {

    if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
      _fbAuth.signInWithRedirect(provider);
    } else {
      console.error(err);
    }
  });
}

function doSignOut() {
  _fbAuth.signOut();
}

_fbAuth.getRedirectResult().catch(err => console.error(err));
const _loginStatus = document.getElementById('login-status');
if (_loginStatus) _loginStatus.textContent = 'firebase ok · v42';

let _fbUnsub = null;

_fbAuth.onAuthStateChanged(user => {
  const overlay = document.getElementById('login-overlay');
  const appEl   = document.getElementById('app');
  if (_fbUnsub) { _fbUnsub(); _fbUnsub = null; }
  if (user) {
    window._fbUser = user;
    window._cloudReady = false;
    window._fbLastItems = new Map();
    S = defaultState(user.displayName || 'Utente');

    const userRef  = _fbDb.collection('users').doc(user.uid);
    const itemsRef = userRef.collection('items');
    let firstLoad = true;

    _fbUnsub = itemsRef.onSnapshot(async snap => {
      let itemDocs = snap.docs.map(d => ({...d.data(), id: d.id}));

      if (firstLoad && itemDocs.length === 0) {
        try {
          const legacyDoc = await userRef.get();
          const legacyData = legacyDoc.exists ? legacyDoc.data() : null;
          if (legacyData && (Array.isArray(legacyData.proms) || Array.isArray(legacyData.idee) || Array.isArray(legacyData.liste))) {
            const legacyState = normalizeState(legacyData, user.displayName || 'Utente');
            const migrated = itemsFromState(legacyState);
            const batch = _fbDb.batch();
            migrated.forEach(it => batch.set(itemsRef.doc(it.id), it));
            await batch.commit();
            itemDocs = migrated;
          }
        } catch (e) { console.warn('Migrazione dati legacy fallita', e); }
      }

      window._fbLastItems = new Map(itemDocs.map(it => [it.id, JSON.stringify(it)]));
      const canonical = stateFromItems(itemDocs, user.displayName || 'Utente');
      const fresh = secretMode ? swappedState(canonical) : canonical;

      if (firstLoad) {
        firstLoad = false;
        S = fresh;
        window._cloudReady = true;
        overlay.classList.add('hidden');
        appEl.style.display = '';
        initApp();
      } else if (!snap.metadata.hasPendingWrites) {

        const fm = document.getElementById('focus-modal');
        if (fm?.classList.contains('open')) return;
        S = fresh;
        applyTheme(); renderAll(); renderCestino();
        toast('[sync ↓]', 1500);
      }
    }, err => {
      console.warn('Firestore onSnapshot error', err);
      if (firstLoad) {
        firstLoad = false;
        overlay.classList.add('hidden');
        appEl.style.display = '';
        toast('[offline · dati cloud non caricati, modifiche solo locali]', 4000);
        initApp();
      }
    });
  } else {
    window._fbUser = null;
    window._cloudReady = false;
    window._fbLastItems = new Map();
    localStorage.removeItem('blocco');
    S = defaultState('');
    appEl.style.display = 'none';
    overlay.classList.remove('hidden');
  }
});
