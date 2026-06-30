// ============================================================
// Real-time trip sync via Firebase Firestore.
// The whole trip state (collectState/applyState) is stored as one
// shared document keyed by a trip id carried in the URL (?trip=...).
// Both phones that open the same link see each other's changes live.
// Degrades silently to local-only if config/SDK is unavailable.
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const cfg = window.FIREBASE_CONFIG;

function setStatus(html, cls) {
  const el = document.getElementById('syncBar');
  if (el) { el.className = 'save-bar ' + (cls || ''); el.innerHTML = html; }
}
function msg(text, link) {
  return `<span class="save-dot"></span><span class="save-msg">${text}</span>` +
    (link ? `<span class="save-actions"><span class="save-link" onclick="shareTrip()">Copy invite link</span></span>` : '');
}

// Trip id: from ?trip=, else remembered, else freshly generated (and written
// into the URL so the link can be shared).
function getTripId() {
  const url = new URL(location.href);
  // Default to one shared trip so both phones sync automatically with no setup.
  // ?trip=... still overrides (lets you run separate trips later).
  const id = url.searchParams.get('trip') || localStorage.getItem('malta_trip_id') || window.MALTA_TRIP_ID || 'malta-shared';
  localStorage.setItem('malta_trip_id', id);
  return id;
}

window.shareTrip = async function () {
  const u = new URL(location.href);
  if (!u.searchParams.get('trip')) u.searchParams.set('trip', localStorage.getItem('malta_trip_id') || '');
  const url = u.toString();
  try { await navigator.clipboard.writeText(url); alert('Trip link copied — send it to your travel partner so you both share this plan:\n\n' + url); }
  catch (e) { prompt('Copy this link and send it to your travel partner:', url); }
};

if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf('PASTE') === 0) {
  console.info('[sync] No Firebase config — running local-only.');
} else {
  setStatus(msg('☁️ Connecting live sync…'), 'saving');
  try {
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const tripId = getTripId();
    const ref = doc(db, 'trips', tripId);
    let ready = false, pushTimer = null;

    window.maltaSync = {
      push() {
        if (!ready) return;
        clearTimeout(pushTimer);
        pushTimer = setTimeout(async () => {
          try {
            await setDoc(ref, { state: window.collectState(), updatedAt: serverTimestamp() });
          } catch (e) { setStatus(msg('⚠️ Sync error — changes saved on this phone'), 'error'); console.warn('[sync] push failed', e); }
        }, 500);
      },
      shareUrl() { return location.href; }
    };

    onAuthStateChanged(auth, (user) => {
      if (!user) return;
      onSnapshot(ref, (snap) => {
        if (snap.metadata.hasPendingWrites) return;            // ignore our own writes
        if (!snap.exists()) {                                  // first run: seed the shared doc
          ready = true;
          window.maltaSync.push();
          setStatus(msg('☁️ Live sync on · both phones share this trip', true), 'connected');
          return;
        }
        const data = snap.data();
        if (data && data.state && window.applyState) window.applyState(data.state);  // applyState guards re-push
        ready = true;
        setStatus(msg('☁️ Live sync on · both phones share this trip', true), 'connected');
      }, (err) => { setStatus(msg('⚠️ Sync offline — will catch up when online'), 'error'); console.warn('[sync] snapshot error', err); });
    });

    signInAnonymously(auth).catch((e) => {
      setStatus(msg('⚠️ Couldn\'t start sync — check Firebase setup'), 'error');
      console.warn('[sync] anonymous sign-in failed', e);
    });
  } catch (e) {
    setStatus(msg('⚠️ Sync unavailable — running local-only'), 'error');
    console.warn('[sync] init failed', e);
  }
}
