const _fbApp = firebase.initializeApp({
  apiKey: "AIzaSyDuT4RPa4z3JwkOP7uT9ejQYyyA3QzHcVQ",
  authDomain: "blocco-96dd9.firebaseapp.com",
  projectId: "blocco-96dd9",
  storageBucket: "blocco-96dd9.firebasestorage.app",
  messagingSenderId: "8856261247",
  appId: "1:8856261247:web:ef6048b99e0d26c2b3654a"
});

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
if (_loginStatus) _loginStatus.textContent = 'firebase ok · v37';

let _fbUnsub = null;

_fbAuth.onAuthStateChanged(user => {
  const overlay = document.getElementById('login-overlay');
  const appEl   = document.getElementById('app');
  if (_fbUnsub) { _fbUnsub(); _fbUnsub = null; }
  if (user) {
    window._fbUser = user;
    S = defaultState(user.displayName || 'Utente');
    let firstLoad = true;
    _fbUnsub = _fbDb.collection('users').doc(user.uid).onSnapshot(doc => {
      if (doc.exists) {
        const d = doc.data();
        const fresh = normalizeState(d, user.displayName || 'Utente');
        if (firstLoad) {
          S = fresh;

          const misplaced = S.idee.filter(i => i.folder);
          if (misplaced.length) {
            S.idee = S.idee.filter(i => !i.folder);
            misplaced.forEach(i => { if (!S.folderNotes.find(n => n.id===i.id)) S.folderNotes.push(i); });
            _fbDb.collection('users').doc(user.uid).set(S).catch(()=>{});
          }
          firstLoad = false;
          overlay.classList.add('hidden');
          appEl.style.display = '';
          initApp();
        } else if (!doc.metadata.hasPendingWrites) {

          const fm = document.getElementById('focus-modal');
          if (fm?.classList.contains('open')) return;
          S = fresh;
          applyTheme(); renderAll(); renderCestino();
          toast('[sync ↓]', 1500);
        }
      } else if (firstLoad) {
        firstLoad = false;
        overlay.classList.add('hidden');
        appEl.style.display = '';
        initApp();
      }
    }, err => {
      console.warn('Firestore onSnapshot error', err);
      if (firstLoad) {
        firstLoad = false;
        overlay.classList.add('hidden');
        appEl.style.display = '';
        initApp();
      }
    });
  } else {
    window._fbUser = null;
    localStorage.removeItem('blocco');
    S = defaultState('');
    appEl.style.display = 'none';
    overlay.classList.remove('hidden');
  }
});
