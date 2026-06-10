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
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId:             "YOUR_APP_ID"
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
