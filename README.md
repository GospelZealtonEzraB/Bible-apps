# 📖 Engraved — Scripture Memorization

> _"Your word I have hidden in my heart, that I might not sin against you."_ — Psalm 119:11

An installable mobile app that makes memorizing Bible verses **easy, effective, and
creative**. Pick a verse, learn it through a set of memory drills, and let spaced
repetition resurface it right before you'd forget — while your library of memorized
verses grows.

Built with **Expo (React Native) + TypeScript**. Runs on iOS and Android, works
offline once verses are saved, and installs to your home screen.

---

## ✨ Features

### Add verses
- Look up any reference (`John 3:16`, `Romans 12:1-2`) from a free, public-domain
  Bible API (bible-api.com — WEB, KJV, BBE, and more).
- **Starter packs** (Anxiety & Peace, Foundations of Faith, Psalms of Comfort, The
  Romans Road, Strength & Courage) to get going in seconds.
- Saved verses are cached on-device, so learning and review work **offline**.

### Four creative memorization drills
| Drill | How it trains recall |
|---|---|
| 🃏 **Flashcards** | Flip between reference and verse (either direction), then self-rate. |
| 🌫️ **Vanishing Words** | The verse fades away a few words at a time each pass until you recite it from nothing. |
| 🔤 **First Letters** | The whole verse collapses to just the first letter of every word — a powerful recall scaffold. |
| ⌨️ **Fill & Type** | Fill in blanked-out words, or type the verse from memory for word-by-word accuracy scoring. |

### Remember them later (spaced repetition)
- An **SM-2** scheduler resurfaces each verse right before it's forgotten.
- The **Today** screen shows what's due; a quick review session grades your recall
  (Again / Hard / Good / Easy) and reschedules automatically.

### Stay motivated
- 🔥 Daily **streaks**, a daily-goal ring, and per-verse **mastery** rings.
- Status tracking: **New → Learning → Memorized → Reviewing**.
- 🔊 **Listen** (text-to-speech), 🎉 celebration + haptics on a strong recall.
- ⏰ Optional daily **reminder** notification, light/dark themes.

---

## 🏗️ Project structure

```
app/                     # expo-router screens (file-based routing)
  (tabs)/                #   Today · Library · Add · Settings
  verse/[id].tsx         #   verse detail + drill launchpad
  drill/[id]/[mode].tsx  #   drill runner
  review.tsx             #   spaced-repetition review session
src/
  data/                  # bible-api client (+ offline fixtures), starter packs
  srs/sm2.ts             # SM-2 spaced-repetition algorithm (pure)
  drills/helpers.ts      # word masking, first-letters, type-diff (pure)
  store/useStore.ts      # zustand + AsyncStorage persistence
  components/            # UI kit, progress rings, drill components
  theme/                 # light/dark palette, spacing, typography
__tests__/               # jest unit tests for the pure modules
```

---

## 🚀 Running it

Requires Node 18+.

```bash
npm install
npx expo start
```

Then either:
- **On your phone:** install **Expo Go** and scan the QR code. Verse lookup,
  notifications, and text-to-speech all work here.
- **Web preview (layout only):** press `w`. (Notifications/TTS are native-only.)

### Building an installable app

Use [EAS Build](https://docs.expo.dev/build/introduction/) to produce a real,
installable binary:

```bash
npm install -g eas-cli
eas login
eas build -p android   # APK/AAB
eas build -p ios       # requires an Apple Developer account
```

---

## ✅ Tests & checks

```bash
npm test          # jest unit tests (SM-2, drill helpers, date utils)
npm run typecheck # tsc --noEmit
```

The core memorization logic — spaced-repetition scheduling, word masking,
first-letter conversion, and typing accuracy — is covered by unit tests so the
algorithms are provably correct independent of the UI.

---

## 🤖 AI features (optional server)

Memory hooks, plain-English explanations, and AI build-a-pack are powered by a tiny server
that holds the secret AI key (an LLM key can't ship inside the app). Everything else works
without it; these features stay off until you deploy the server and paste its URL into
**Settings → AI & Server**.

- The server is a **Cloudflare Worker** in [`server/`](./server) — see
  [`server/README.md`](./server/README.md) for the deploy steps and the (free) accounts/keys
  you'll need (Cloudflare + an **OpenAI** or **Anthropic** key).
- Works with **OpenAI** (default `gpt-5.4-mini`) or **Anthropic** — the server uses whichever
  key you set.
- The AI never generates Scripture text — build-a-pack returns references only, and the app
  always fetches real verses from the trusted Bible providers.
- Results are cached per verse, so you pay only once per hook/explanation.
- *(ESV is coded but disabled — it needs a separate free Crossway key; see server/README.md
  to turn it on.)*

## 📜 Scripture text & licensing

Verse text is fetched from public sources: **bible-api.com** (public-domain English/Latin)
and **bolls.life** (public-domain Tamil). Bundled offline fixtures use the **World English
Bible (WEB)**, public domain. ESV (© Crossway) is supported via your own server but off by
default; NKJV is not included (no free/legal source).
