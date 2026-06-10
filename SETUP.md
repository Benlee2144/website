# 🕊 Going Live — The Prayer Realm Setup Guide

Right now the site runs in **DEMO MODE**: everything works, but prayers only
save on each visitor's own device. Follow these steps (≈20 minutes, all free)
and the realm becomes fully live: **real Google sign-in, one shared database,
everything saved forever, synced in real time for every visitor.**

You'll use **Firebase** — Google's own app platform. It is the industry
standard for exactly this (login + live database), the free tier is far more
than you'll need to start, and the Google login it gives your users is the
real thing: Google handles the passwords and security, you never touch them.

---

## Step 1 — Create your Firebase project (3 min)

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Create a project** → name it `kingdomcovers-prayer-realm` → continue.
3. Google Analytics: **off** is fine (you can add it later) → **Create project**.

## Step 2 — Register the website & copy your config (3 min)

1. On the project home page, click the **`</>` (Web)** icon to add a web app.
2. Nickname: `prayer-realm` → (do NOT tick Firebase Hosting) → **Register app**.
3. Firebase shows a `firebaseConfig = { ... }` block. Copy each value into
   **`js/config.js`** in this repo, replacing the `YOUR_...` placeholders:

   ```js
   firebase: {
     apiKey:            "AIza...",
     authDomain:        "kingdomcovers-prayer-realm.firebaseapp.com",
     projectId:         "kingdomcovers-prayer-realm",
     storageBucket:     "kingdomcovers-prayer-realm.appspot.com",
     messagingSenderId: "1234567890",
     appId:             "1:1234567890:web:abc123"
   },
   ```

   > 🔓 **Is it safe to put this in public code? Yes.** The `apiKey` here is a
   > public *identifier*, not a password. Your data is protected by the
   > security rules you install in Step 4 — they run on Google's servers and
   > cannot be bypassed from a browser.

## Step 3 — Turn on Google sign-in (2 min)

1. Firebase Console → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → **Google** → **Enable**.
3. Pick a support email (your Gmail) → **Save**.
4. Still in Authentication → **Settings → Authorized domains** → **Add domain**
   for every place the site will live, e.g.:
   - `YOURUSERNAME.github.io` (GitHub Pages)
   - `your-site.pages.dev` (Cloudflare Pages, if you use it)
   - your custom domain, e.g. `prayer.kingdomcovers.com`
   (`localhost` is already allowed for testing.)

## Step 4 — Create the database & install the security rules (4 min)

1. Firebase Console → **Build → Firestore Database** → **Create database**.
2. Location: pick the default (e.g. `nam5 (us-central)`) → **production mode** → done.
3. Open the **Rules** tab → delete what's there → paste the entire contents of
   **`firestore.rules`** from this repo → **Publish**.
4. ⚠ In those rules, find `isKeeper()` and make sure **your** Google email is
   listed. That email becomes the **Keeper of the realm**: only it can update
   the Sanctuary video / go LIVE, and it can remove any prayer or comment.
   Keep the same email in `adminEmails` inside `js/config.js`.

## Step 5 — Deploy the site (5 min)

**Option A — GitHub Pages (already wired up in this repo):**
merge/push this code to the `main` branch and the included GitHub Action
deploys it automatically to `https://YOURUSERNAME.github.io/website/`.
(Repo **Settings → Pages → Source: GitHub Actions** if it isn't already.)

**Option B — Cloudflare Pages (recommended for a custom domain):**
1. <https://pages.cloudflare.com> → **Create a project** → connect this GitHub repo.
2. Build settings: **no framework, no build command**, output directory `/`. Deploy.
3. **Custom domains** tab → add e.g. `prayer.kingdomcovers.com` → Cloudflare
   handles HTTPS automatically.

> Either way, remember Step 3.4: the final domain must be in Firebase's
> **Authorized domains**, or Google sign-in will refuse.

## Step 6 — Claim your throne 👑

1. Open the live site → **Enter with Google** using your keeper email.
2. Go to **The Sanctuary** → you'll see the **Keeper's Keys** panel (only you can).
3. Paste a video link → **Update the Sanctuary**. Done — every visitor sees it.

---

## 📺 Daily videos & going LIVE

- **Daily video:** upload to YouTube (Unlisted is fine — viewers don't need
  YouTube, they watch inside your realm). Copy the link → Keeper's Keys →
  paste → update. Takes 20 seconds a day.
- **Live stream:** start a YouTube Live (or Twitch) stream → copy the live
  link (`youtube.com/live/...`) → paste into Keeper's Keys → tick
  **“We are LIVE right now”** → update. The realm shows a pulsing 🔴 LIVE
  badge and everyone watches together inside the Sanctuary.
- TikTok video links also work for replays; TikTok *lives* can't be embedded
  (TikTok doesn't allow it) — use YouTube Live for streams.

## 📣 Important: TikTok's in-app browser

When people tap your link inside TikTok, it opens TikTok's built-in browser —
and **Google blocks sign-in inside in-app browsers** (a Google rule, for
safety). The realm detects this and tells them to tap **⋯ → Open in browser**.
Best practice: put the link in your bio with “open in browser for full
experience.” Visitors can *read* the whole altar without signing in either way.

## 🛡 Safety & moderation — what's already protecting you

- Google handles all passwords/identity. You never store or see credentials.
- The server-side rules in `firestore.rules` enforce: only signed-in users can
  post; nobody can edit other people's prayers; amen counts can't be faked;
  only your email can touch the Sanctuary; everything else in the database is
  sealed off.
- Members can 🚩 report a prayer; you see the report count on the card and can
  remove anything with one tap.
- Prayer text is rendered as plain text — pasted code/links can't run on your
  page (no script injection).
- Optional hardening later: Firebase **App Check** (blocks bots) and daily
  Firestore backups — both in the Firebase console when you're ready.

## 💰 What it costs

Firebase's free tier: 50,000 reads + 20,000 writes **per day**, and Google
sign-in is unlimited. That comfortably covers thousands of daily visitors.
GitHub Pages and Cloudflare Pages are free. **Total: $0** until the realm is
genuinely big — and then it scales without rebuilding anything.

## 🧯 Troubleshooting

| Symptom | Fix |
|---|---|
| “DEMO MODE” banner still showing | `js/config.js` still has `YOUR_...` placeholders, or the deployed site hasn't updated yet. |
| Google popup closes / `auth/unauthorized-domain` | Add your exact domain in Authentication → Settings → Authorized domains. |
| Sign-in fails inside TikTok/Instagram | Expected — open in Safari/Chrome (see above). |
| “Missing or insufficient permissions” | Rules not published, or your email isn't in `isKeeper()` for keeper actions. |
| Video won't load in Sanctuary | Use a normal YouTube link; if the video is Private it can't embed — use Unlisted. |
