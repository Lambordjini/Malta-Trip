// Firebase project config. Safe to commit — Firebase web keys are public
// identifiers; access is controlled by your Firestore security rules.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyA9IXtNnR3kx7GKEB_6Kc0wz0PgycvqI90",
  authDomain: "malta-trip-c83ee.firebaseapp.com",
  projectId: "malta-trip-c83ee",
  storageBucket: "malta-trip-c83ee.firebasestorage.app",
  messagingSenderId: "741745259268",
  appId: "1:741745259268:web:bc848215b2efc0ee991651"
};

// Both phones use this one shared trip by default, so they sync with zero setup.
// (A ?trip=... in the URL still overrides it if you ever want separate trips.)
window.MALTA_TRIP_ID = "malta-c83ee-2026";
