# ✝ THE PRAYER REALM — by KingdomCovers

A living sanctuary on the web. Believers lay prayers on the altar, lift each
other up with amens, reactions, and words of encouragement — send each other
**private words**, and keep watch together on a **live map of the nation**.
Designed to feel like stepping out of the internet and into another realm:
starfield, rising golden embers, light descending from above, an entry veil,
hand-forged iconography (zero emoji), and optional generated ambience.

**The mission: pray for one another.** *“Bear one another's burdens.” — Gal 6:2*

---

## The rooms

| Area | What happens there |
|---|---|
| **The Veil** | Cinematic entry portal — enter with or without heavenly ambience. |
| **Today's Watch** | The daily heartbeat: each day the realm entrusts you with **three people to pray for** (chosen where need is greatest) plus the day's manna — a verse and a charge. Complete your three: **WATCH KEPT**. |
| **Your Flame** | A streak in the header that grows each consecutive day you intercede for someone — Ember, Flame, Blaze, and at 30 days a **Pillar of Fire**. Miss a day and it returns to embers. |
| **The Altar** | The prayer wall. Place a prayer (anonymously if you wish), choose a category (Healing, Family, Provision…), lift others with amens, reactions, and encouragement comments. Authors can mark prayers **Answered**. |
| **The Watch** | The live American map (Albers USA with state lines). Violet lights are souls present right now; gold flames are prayers rising from real places. Opt-in, city-level only. Click a flame to jump to that prayer. |
| **The Unbroken Chain** | A digital revival of the Moravian prayer watch: believers each claim **one hour of the day**; a 24-segment ring shows which hours are guarded. The goal: all 24 lit — prayer that never sleeps. |
| **Words** | Private one-to-one messages between believers — tap **Word** on any prayer to privately encourage its author. Only the two participants can ever read a thread (not even the keeper). |

## Features

- 🔐 **Real Google sign-in** (Firebase Authentication) — Google handles all credentials.
- ⚡ **Real-time shared database** (Firestore) — every amen, comment, message, and light on the map appears live for everyone.
- 🛡 **Server-side security rules** (`firestore.rules`) — counts can't be faked, prayers can't be tampered with, private words stay private, locations are validated and coarse.
- 🕊 **Demo mode** — before Firebase is connected the whole site still works on-device.
- Hand-drawn SVG icon set (no platform emoji), film grain, gradient-forged borders, generated ambient audio, mobile-first, reduced-motion support, XSS-safe rendering, zero build step, zero frameworks, $0 hosting.

## Files

```
index.html        the realm (structure + icon forge)
css/realm.css     the atmosphere (all styling & effects)
js/config.js      ← the ONLY file you edit to go live
js/app.js         the engine (auth, live data, map, words, effects)
firestore.rules   server-side security (paste into Firebase console)
SETUP.md          ← step-by-step go-live guide (~20 min, free)
```

## Quick start

1. Open `index.html` (or push to `main` — GitHub Pages deploys automatically). It runs in demo mode.
2. Follow **[SETUP.md](SETUP.md)** to connect Google login + the live database.
3. **Whenever `firestore.rules` changes in this repo, re-paste it into Firebase Console → Firestore → Rules → Publish** — new features (the map, private words) need their rules live.

Shop: [KingdomCovers on TikTok](https://www.tiktok.com/@kingdomcovers) — Christian debit card skins.
