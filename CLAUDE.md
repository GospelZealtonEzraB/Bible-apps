# Versed — project memory

Durable context for building on this app. Read this first each session. Keep it updated as things
change. (User-facing overview is in `README.md`; release steps in `docs/PLAYSTORE.md`.)

## What Versed is
An installable Bible‑verse **memorization** app with a **"Growing Together"** social core (faith
partners / small groups hold each other accountable). Warm, playful, reverent tone; mascot **Ember**
(a flame). Formerly "Engraved" — renamed to **Versed** (bundle id kept `com.engraved.app`, slug
`engraved`, so the rename installs as an update, not a new app).

## Stack
- **App:** Expo SDK 54 (React 19.1, RN 0.81.5, New Architecture on), **expo-router** v6, **zustand** +
  persist (AsyncStorage), react-native-svg, Hermes. TypeScript throughout.
- **Server:** a single **Cloudflare Worker** (`server/src/worker.ts`) + **Cloudflare KV** (binding
  `ENGRAVED_KV`, id in `server/wrangler.toml`). Holds the LLM key and all shared state. Deployed at
  `https://biblememory.biblememory.workers.dev` (baked into the app as `extra.defaultServerUrl`).
- **AI:** provider‑flexible `callLLM` (OpenAI gpt‑5.4‑mini or Anthropic). References only — never sends
  Scripture text.
- **Updates:** **expo-updates** (OTA via `eas update`) + **EAS Build**. Project id
  `2ce595e5-eafc-4883-8bfa-7a1f02638d78`, account `gzezra`, EAS project slug `engraved`.

## Architecture
- **Two storage tiers.** On‑device (private, full): library, SM‑2 schedule, streaks, XP, local notes,
  study sessions/applications, settings, profile. On the server (shared slice, KV): circles + member
  progress *snapshots* + shared verses/plans/notes/prayers/challenges + per‑identity cloud backup.
- **Identity (no accounts).** Each device mints a random `memberId` (`m_…`) once; `backupCode` === the
  memberId and is the **transfer code** to move to a new phone. `effectiveId = accountId ?? memberId`
  is the single seam for a future real‑accounts upgrade (passwordless) with zero feature changes.
- **Race safety.** Every multi‑writer datum is its own KV key (a device only writes its own keys);
  rosters via `KV.list({prefix})`; only `meta` is versioned. KV is **eventually consistent** — the app
  never blocks on read‑after‑write (see Optimistic updates).

## Where things live (key files)
- `app/(tabs)/` — Today (`index.tsx`), Add, Library, **Together**, Settings.
- `app/circle/[code].tsx` — the circle hub (all the cards: progress, verses, plans, prayer, notes,
  challenges, goal, covenant). `app/circle/[code]/member/[memberId].tsx` — member detail.
- `app/challenge/[code]/[chalId].tsx` — challenge completion (reuses the Fill&Type drill).
- `app/study/[passage].tsx` — AI study brief + "living it out" application.
- `app/onboarding.tsx` — first‑run flow; gated in `app/_layout.tsx`.
- `app/_layout.tsx` — providers, **ErrorBoundary**, onboarding gate, AppState cloud‑backup trigger.
- `src/store/useStore.ts` — **the** state store (zustand persist). Everything funnels here.
- `src/data/` — `serverClient.ts` (generic `postServer`), `circleClient.ts` (all `/circle` actions +
  `EXPECTED_API_VERSION`), `studyClient.ts`, `aiClient.ts`, `bibleApi.ts`, `plans.ts`, `emberLines.ts`.
- `src/components/` — `Ember.tsx` (mascot), `ErrorBoundary.tsx`, `Celebration.tsx`, `ui.tsx`,
  `layout.tsx`, `ProgressRing.tsx`.
- `src/utils/circleProgress.ts` — pure, unit‑tested circle derivations.
- `server/src/worker.ts` — the whole backend. `docs/PLAYSTORE.md` — launch guide. `scripts/` — icon +
  store‑graphic generators.

## Conventions & patterns (follow these)
- **Persist store (critical).** In `useStore.ts` the persist config has `partialize` (what's saved),
  `merge` (backfills defaults), and `migrate`. **Every persisted slice MUST appear in `merge` with a
  default** (`{...defaultX, ...p.X}` for objects, `p.X ?? {}`/`?? []` for records/arrays) or upgrading
  users crash on undefined. `merge` is wrapped in try/catch and **must never throw**. `migrate` is a
  passthrough so a version bump never discards data. When adding a slice: add to interface, initial
  state, `partialize`, and `merge`.
- **Optimistic circle mutations.** Use `optimisticCircle(set, get, code, patch, server)` — patch the
  cached snapshot immediately (immutably; `before` is kept for rollback), persist in the background,
  roll back on error. Creates use a **client‑generated id** (`genLocalId()` → `c_…`) that the server
  **honors** (it does for prayers/plans/challenges/notes) so ids reconcile on the focus‑sync. Mutations
  don't apply the server echo (KV list lag) — the `useFocusEffect` `syncCircle` reconciles.
- **Selectors.** Record slice + `useMemo`, or a direct `useStore(s => …)`. Guard optional fields.
- **Server calls** go through `postServer`; circle ones through `circleClient` (which maps "unknown
  circle action" → a friendly "server out of date" message).
- **Verification before shipping:** `npx tsc --noEmit` · `npm test` (74 pure tests) ·
  `npx expo export --platform ios` · worker: `npx esbuild server/src/worker.ts --bundle
  --format=esm --platform=neutral --outfile=/dev/null`.
- Pure logic → `src/utils` or `src/data` with a `__tests__` unit test. UI stays thin.

## Hard‑won learnings / gotchas (do not relearn these)
- **Never navigate before the router is mounted.** The onboarding gate must wait on
  `useRootNavigationState()?.key` *and* `hydrated` before `router.replace`. Doing it too early throws
  "navigate before mounting the Root Layout" → instant crash. (`_layout.tsx`.)
- **A root `ErrorBoundary` wraps the app** (`src/components/ErrorBoundary.tsx`, mounted in
  `_layout.tsx`). Any render/effect error becomes a recovery screen (Try again / Reset & restart) that
  **shows the error text** — so failures are diagnosable from a screenshot, never a silent close. Keep
  it dependency‑free (hardcoded colors; no theme/store).
- **Android auto‑restore caused instant launch crashes.** `android.allowBackup` was resurrecting stale
  expo‑updates / AsyncStorage state across reinstalls → crash before JS renders. **`allowBackup: false`**
  now; durability is provided by cloud backup + transfer code + manual export instead.
- **Unguarded array access on cached snapshots crashes the hub** when a partner runs an older server
  (missing newer array fields). Always `(circle?.sharedVerses ?? []).length`, `(circle?.challenges ??
  []).find(…)`, `(member.versesDone ?? []).length`, etc. — never `x?.y.length`.
- **OTA vs rebuild.** JS (screens/store/logic/copy) ships via `eas update` — no reinstall. **Native**
  needs a new build+install: app name/icon/splash, permissions, `app.json` native fields (incl.
  `allowBackup`), new native modules, SDK bumps, first enabling of expo‑updates. Run EAS **from the
  repo root**, never `server/` (that mis‑resolves the EAS project). `runtimeVersion.policy=appVersion`
  → OTA only reaches builds whose `version` matches; keep them in lockstep.
- **KV is eventually consistent** — `list` can lag a write by seconds. That's why creates felt like
  "nothing happened until I navigated back" before optimistic updates. Don't rely on read‑after‑write.
- **API versioning.** `server/src/worker.ts` `API_VERSION` must equal client `EXPECTED_API_VERSION`
  (`circleClient.ts`). Bump both when `/circle` gains actions the client depends on; the hub shows a
  "server out of date" banner until the owner redeploys. **Currently `10`** (v9 added the shared daily
  devotional: `setDaily`/`completeDaily`/`shareReflection`/`setCircleReadingPlan`; v10 adds
  `shareToDay` per-member daily shares + rich `attachments` on `postMessage`).
- **Scripture copyright:** the LLM only ever gets references; verse text comes solely from Bible
  providers. `STUDY_BRIEF_SYSTEM` forbids quoting.

## Server (`server/src/worker.ts`)
- Routes: `POST /ai` · `POST /study` · `POST /circle` (+ public `GET /privacy` and `GET /`). Global
  `x-app-secret` gate (optional; `env.APP_SHARED_SECRET`), CORS `*`, global try/catch. KV guarded (501
  if unset).
- `/circle` dispatches on `action`: create · join · get · sync · leave · addVerse · removeVerse ·
  setGoal · setCovenant · createPlan · updatePlan · deletePlan · saveNote · deleteNote · addPrayer ·
  editPrayer · deletePrayer · prayFor · unpray · answerPrayer · reopenPrayer · assignChallenge ·
  submitChallenge · reviewChallenge · deleteChallenge · cheer · renameCircle · **backupPush** ·
  **backupPull**. Snapshot shape: `{apiVersion, meta, members, sharedVerses, plans, notes, prayers,
  challenges, cheersFor}`; challenge/prayer status derived from sub‑key presence.
- KV keys: `circle:{code}:meta|member:{id}|verse:{normRef}|plan:{id}|note:{id}:{noteId}|prayer:{id}
  [:pray:{id}]|chal:{id}[:submission|:review]|cheer:{from}:{to}`; `backup:{memberId}`;
  `study:brief:{normPassage}` (global AI cache). Helper `kvDeletePrefix` for cascade deletes.
- Deploy: `cd server && npx wrangler deploy`. KV + spend cap are the owner's one‑time setup.

## Data durability (foolproofing — user's top priority)
1. **On update:** robust `merge` + passthrough `migrate` → saved data always survives schema changes.
2. **On crash:** ErrorBoundary + guarded hydration → no data‑destroying hard crash.
3. **New phone / lost phone:** **automatic cloud backup** — `cloudBackup()` uploads a full export blob
   to `backup:{memberId}` on AppState `background` (throttled 90s); entering the **transfer code** on a
   new phone (`Together → Move to a new phone`) pulls it back (`cloudRestore`) — verses, streaks,
   circles, everything. Plus **manual export/import** in Settings (Share/paste, OTA‑safe).
4. **Circles** live server‑side, restored via the transfer code.

## Product decisions (settled)
- Name **Versed**; tone **warm & playful, reverent about Scripture/prayer**. Ember teases about streaks,
  never about the Word.
- **No accounts now**, clean upgrade path later. Transparent progress: share **memorized + learning**
  refs with an opt‑out (`settings.shareLibrary`).
- Circle management is **open**: anyone in a circle can edit/undo/delete shared items (matches the
  trusted small‑group model; 6‑char code is the barrier). **Leave‑only** — no "delete the whole circle."
- Full CRUD everywhere (edit/undo/delete for prayers, notes, plans, challenges, goals, applications).

## Build / release cheatsheet
- **Ship JS change:** `git pull` (repo root) → `eas update --branch preview -m "…"` (or `--branch
  production` once on Play). Reopen app twice.
- **Native change / store build:** bump `app.json` `version` if needed → `eas build --profile
  preview|production --platform android` → install / `eas submit`.
- **Server change:** `cd server && npx wrangler deploy`.
- **Distribution today:** EAS internal APK link. **Next step:** Play **Internal testing** (Play‑Store
  installs + auto‑updates; see `docs/PLAYSTORE.md`). Store graphics in `assets/store/` (regen via
  `node scripts/gen-store-assets.mjs`); app icon/splash via `node scripts/gen-icons.mjs` (dev‑only
  `@resvg/resvg-js`).

## Current state (as of this writing)
- Feature‑complete for a shared beta: memorization + drills + SRS + gamification; full Growing Together
  (circles, challenges, shared verses/plans/notes/prayer, transparent progress); AI study; onboarding;
  Ember mascot + celebrations; Versed rebrand; full CRUD; optimistic UI; crash‑proofing; cloud backup;
  Play Store prep (privacy page, listing copy, graphics, submit config).
- **Collaborative daily devotional + journaling (latest):** Tamil fixed (getbible/TAOVBSI); **ESV**
  enabled (verse + chapter via the Worker `/esv`, Crossway attribution shown — needs `ESV_API_KEY`);
  **every reference clickable** (`PeekableRef` + `VersePeekProvider` in `_layout.tsx`, plus a `RefText`
  sweep); a private **daily journal** (`journal` slice, `src/utils/journal.ts`, `app/journal.tsx`,
  reader "Journal this today"); and a **circle "Today, together"** shared devotional
  (`DailyTogetherCard`, API v9, auto-advancing shared reading plan `planPortionForDate`) with a
  **circle journal timeline** (the "Our journal" drill-in).
- **Worship & Teaching (P5 — latest):** **one Songbook** (`/songbook`; `/hymns`, `/hymns/[id]`,
  `/hymns/verse/[ref]`, `/songs` are now redirects) merging three tiers via `src/data/songbook.ts` —
  bundled `HYMNS` + the family's **own songs** (`songs` slice) + **chord overlays** (`songChords`) on
  lyrics-only hymns; **in-app song editor** (`/songbook/new`, `src/utils/songbookParse.ts` — the TS twin
  of `scripts/songbook.mjs`, kept in lockstep by a shared test suite) so Tamil/family songs no longer
  need a repo checkout; ★ favourites; **deep-link playback** (Spotify · YT Music · YouTube — never
  hosted audio); **"Sing this today"** credits the walk's `worship` movement + shares to the day.
  **Sermons deepened:** the Worker `/ai` `sermon` task is now **map-reduce over ≤4 chunks** (cap 14k →
  36k chars; the final chunk always runs to the end) returning `{title, summary, outline, keyPoints,
  application, references}`; `src/utils/teaching.ts` coerces it (tolerates the old `{summary,
  references}` shape) and composes a **`sermon` Doc** — saved teachings are just Notes filtered by type
  (`/notes?type=sermon`). Library gained a **Worship & Teaching** shelf; Abide's `worship`/`teaching`
  movements now surface favourites and saved teachings.
- **Product refinement (deep pillars — earlier):** the sprawl is being consolidated per the approved
  plan (owner decisions: private/family · passwordless accounts later · devotion+journaling anchor ·
  1:1 covenant partner · "two walks, one window" devotion model, reflections shared-first).
  Shipped: **Notes pillar** (block editor `BlockEditor`/`RichText`, `documents`+`folders` slices,
  `app/notes/*`, legacy note silos migrated via `notesMigration`); **Deep Study** (`/study` `context`
  = real Wikipedia summaries cited, `ask` = grounded Q&A → save to Notes; `validateReferences` guard);
  **parallel translations** in the reader ("Compare"); **Tamil multi-source resolver**
  (`TAMIL_CANDIDATES`); **"Our devotions" window** (per-member daily shares, adopt→Doc/library,
  anchored discuss); **Bible-lover chat** (`AttachSheet` tray: Bible/my-verses/notes/songs → rich
  message cards, 15s polling); **daily walk engine** (`dailyWalk.ts`, `walk` slice, ONE "days with
  God" streak, tracked Abide checkmarks, Today de-gimmicked — quests/badges/stat-tiles → WalkHero;
  all 6 drills on the verse screen).
- **Pending on the user:** **redeploy the Worker** (`cd server && npx wrangler deploy` — activates
  **API v10** + `/esv` + deep-study actions; the songs Vectorize binding is commented out so deploy
  succeeds) and one **`eas update`**; **set `ESV_API_KEY`** for ESV. Tamil is online-only (resolver
  self-heals across getbible/bolls). Remaining pillars: P0 accounts (needs D1 + email provisioning),
  full partner-space collapse, the 5-tab IA merge. **A bundled PD devotional is deferred** — this
  sandbox can only reach GitHub by exact URL (repo search is blocked), so no dataset can be sourced;
  it needs a source URL or an open-network session. All tests green (272), tsc clean, exports bundle,
  worker bundles.

## Likely next work (roadmap)
- Screenshots for the Play listing; wire the `eas submit` service account.
- Before public launch: set `appSecret` (app + Worker) + rate‑limit `/ai` (open AI proxy today).
- Possible: real passwordless accounts (the identity seam is ready); voice recitation; richer study;
  iOS/TestFlight.

## Constraints (always)
- **Develop only on branch `claude/scripture-memorization-app-bl3dve`.** Commit + push there; verify
  (tsc/test/export) before pushing.
- **Never** paste API keys into chat/commits/screenshots — keys live only in `wrangler secret` /
  gitignored `.dev.vars` / the Cloudflare dashboard. Never expose the model id in repo artifacts.
