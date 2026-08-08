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

### Building an installable app (share it with others)

Use [EAS Build](https://docs.expo.dev/build/introduction/) to produce a real,
installable binary — its own **Engraved** icon on the home screen, no Expo Go
required. A one-time free Expo account is all you need to start.

```bash
npm install -g eas-cli
eas login                        # free Expo account
eas build -p android --profile preview   # shareable .apk (see eas.json)
```

When it finishes, EAS gives you a download link. Send that link to anyone —
they tap it on an Android phone, allow "install from this source," and Engraved
installs like any app. The `preview` profile (in `eas.json`) is tuned for exactly
this: internal distribution as a direct-install **APK**.

```bash
eas build -p android --profile production   # .aab for the Play Store
eas build -p ios --profile production       # requires an Apple Developer account
```

> 📲 **Reminders** (the daily notification) only work in a real build like this —
> not in Expo Go. So this is also the first place you can test them.

> 🤖 **AI for everyone, no setup.** The built-in AI server URL is baked into the
> build (`app.json` → `extra.defaultServerUrl`), so everyone who installs the APK
> gets memory hooks / explanations / build-a-pack with **zero configuration**.
> All those calls bill to *your* AI key, so set a spend cap — see
> [AI features](#-ai-features-optional-server) below.

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

### Zero-setup AI for a shared build

Set `app.json` → `extra.defaultServerUrl` to your deployed Worker URL (already done for the
maintainer's build). That URL is baked into every APK, so **anyone who installs the app gets
AI immediately** — no Settings step. A user can still override it in **Settings → AI & Server**
to point at their own server.

Because every AI tap bills to *your* key, protect yourself before sharing widely:

1. **Set a hard spend cap** at platform.openai.com → **Billing → Limits** (e.g. $5/month). This
   is the real guarantee — usage can never exceed it.
2. **(Optional) Shared secret** — a light speed bump so a stranger who finds the URL can't use
   your server. Pick any random string and set it in **both** places (they must match, or AI
   returns 401):
   - App: `app.json` → `extra.appSecret` (or the `EXPO_PUBLIC_APP_SECRET` build env var).
   - Worker: `npx wrangler secret put APP_SHARED_SECRET`.
   Leave both empty to keep it off (the spend cap alone is fine for a small group).
3. **Cost scales with users.** Per-verse caching lives on each phone, so heavy public use
   multiplies calls. For hundreds of users, add server-side caching (Cloudflare KV) so each
   verse's AI is generated once for everyone — not needed for a small group.

## 📜 Scripture text & licensing

Verse text is fetched from public sources: **bible-api.com** (public-domain English/Latin)
and **bolls.life** (public-domain Tamil). Bundled offline fixtures use the **World English
Bible (WEB)**, public domain. ESV (© Crossway) is supported via your own server but off by
default; NKJV is not included (no free/legal source).
