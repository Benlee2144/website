# ✝ THE PRAYER REALM — by KingdomCovers

A living sanctuary on the web. Believers lay prayers on the altar, lift each
other up with **🙏 amens**, reactions, and words of encouragement — and gather
in **The Sanctuary** for the daily word and live streams. Designed to feel
like stepping out of the internet and into another realm: starfield, rising
golden embers, light descending from above, an entry veil, and optional
generated ambience.

**The mission: pray for one another.** *“Bear one another's burdens.” — Gal 6:2*

---

## What's inside

| Area | What happens there |
|---|---|
| **The Veil** | Cinematic entry portal — enter with or without heavenly ambience. |
| **The Altar** | The prayer wall. Place a prayer (anonymously if you wish), choose a category (Healing, Family, Provision…), and lift others with 🙏 / ❤️ 🕊️ ✝️ 🔥 / encouragement comments. Authors can mark prayers **✨ Answered**. |
| **The Sanctuary** | Embedded daily video or live stream (YouTube/Twitch/TikTok), controlled by the keeper from inside the site — with a pulsing LIVE badge when you're on. |
| **Keeper's Keys** | Admin panel visible only to the owner's Google account: update the Sanctuary, go live, remove any prayer/comment, see 🚩 reports. |

## Features

- 🔐 **Real Google sign-in** (Firebase Authentication) — Google handles all credentials.
- ⚡ **Real-time shared database** (Firestore) — every amen/comment appears live for everyone.
- 🛡 **Server-side security rules** (`firestore.rules`) — counts can't be faked, prayers can't be tampered with, the Sanctuary obeys only the keeper.
- 🕊 **Demo mode** — before Firebase is connected the whole site still works on-device, so you can feel it immediately.
- 📱 Mobile-first (TikTok audience), respects reduced-motion, XSS-safe rendering, zero build step, zero frameworks, $0 hosting.

## Files

```
index.html        the realm (structure)
css/realm.css     the atmosphere (all styling & effects)
js/config.js      ← the ONLY file you edit to go live
js/app.js         the engine (auth, live data, rendering, effects)
firestore.rules   server-side security (paste into Firebase console)
SETUP.md          ← step-by-step go-live guide (~20 min, free)
```

## Quick start

1. Open `index.html` (or push to `main` — GitHub Pages deploys automatically). It runs in demo mode.
2. Follow **[SETUP.md](SETUP.md)** to connect Google login + the live database and deploy.
3. Sign in with your keeper email → Sanctuary → **Keeper's Keys** → post your first daily word.

Shop: [KingdomCovers on TikTok](https://www.tiktok.com/@kingdomcovers) — Christian debit card skins.
