/* ═══════════════════════════════════════════════════════════════════
   THE PRAYER REALM — configuration
   This is the ONLY file you need to edit to go live.
   Full walkthrough: see SETUP.md in the root of this repo.
   ═══════════════════════════════════════════════════════════════════ */

window.REALM_CONFIG = {

  /* 1 ▸ Paste your Firebase web config here (SETUP.md, step 2).
         Until you do, the site runs in DEMO MODE: everything works,
         but data saves only on the visitor's own device.
         NOTE: the apiKey is a public identifier, not a secret —
         it is safe to commit. Your data is protected by the
         security rules in firestore.rules, not by hiding this key. */
  firebase: {
    apiKey:            "AIzaSyDaLJ2-ZRciuvH3dAnrcA6WgJyU4bpww54",
    authDomain:        "kingdomcovers-prayer-realm.firebaseapp.com",
    projectId:         "kingdomcovers-prayer-realm",
    storageBucket:     "kingdomcovers-prayer-realm.firebasestorage.app",
    messagingSenderId: "1040878986291",
    appId:             "1:1040878986291:web:b13c29dc7d3e4455d4af46",
    measurementId:     "G-6BXPQERP1J"
  },

  /* 2 ▸ Keeper accounts (you). These Google emails see the
         “Keeper's Keys” panel: set the Sanctuary video / go live,
         and remove any prayer or comment.
         IMPORTANT: also list the same emails in firestore.rules. */
  adminEmails: [
    "benarp2144@gmail.com"
  ],

  /* 3 ▸ Your shop / socials */
  shopUrl: "https://www.tiktok.com/@kingdomcovers",
  brand:   "KingdomCovers"
};
