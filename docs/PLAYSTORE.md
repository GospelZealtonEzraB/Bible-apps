# Versed — Google Play launch guide

Everything you need to get Versed onto Google Play, start to finish. Ready-to-paste copy is at the
bottom. Most of this is one-time setup; after the first release, updates are one command.

---

## 0. First decide: which track?

You almost certainly want to **start on a testing track**, not full public production. Comparison:

| Option | Who can install | Review time | Auto-updates | Best for |
|---|---|---|---|---|
| **EAS internal APK link** (today) | Anyone you send the link | none | JS only (OTA) | 1–5 people, right now |
| **Firebase App Distribution** | People you email/invite | none | You push builds; testers get notified | 5–50 testers, no Play account |
| **Play — Internal testing** | Up to 100 emails you list | ~minutes | ✅ via Play Store | your group, with real Play auto-updates |
| **Play — Closed testing** | Testers by email list / group | ~hours–1 day | ✅ | a growing group, pre-public |
| **Play — Production** | Everyone on Play | 1–3+ days, stricter | ✅ | public launch |

**Recommendation:** publish to **Play Internal testing** first (near-instant, Play-Store install +
auto-updates for your group), then promote the same build to Closed/Production when you're ready. The
steps below get you there; production is the same flow with a stricter review.

---

## 1. One-time prerequisites

1. **Google Play Developer account** — https://play.google.com/console → pay the **$25 one-time** fee,
   verify identity (can take a day or two for a personal account).
2. **Privacy policy URL** — ✅ already done: after you `wrangler deploy`, it's live at
   **`https://biblememory.biblememory.workers.dev/privacy`**. Use that URL in the listing.
3. **Assets** (see the checklist in §6): a 512×512 icon, a 1024×500 feature graphic, and 2–8 phone
   screenshots.

---

## 2. Build the release binary (AAB)

The `production` profile already produces a Play-ready **App Bundle (.aab)** with an auto-incrementing
versionCode:

```bash
cd /home/user/Bible-apps
eas build --profile production --platform android
```

On the **first** production build, EAS offers to **generate an upload keystore** — say **yes** and let
EAS manage it. (Never lose this; EAS stores it for you. It's what signs every future update.)

---

## 3. Create the app in Play Console

1. Play Console → **Create app**. Name: **Versed**. Default language: English. Type: **App**. Free.
2. Accept the declarations.
3. Left nav → **Test and release → Testing → Internal testing** (start here).

---

## 4. Upload the build

**Option A — automatic (recommended once set up):**
1. In Play Console → **Setup → API access**, link a **Google Cloud service account** and grant it
   release permissions; download its **JSON key**.
2. Put the JSON path in `eas.json` (`submit.production.serviceAccountKeyPath`) — it's stubbed there.
3. Then:
   ```bash
   eas submit --profile production --platform android
   ```

**Option B — manual (simplest for the very first time):**
- Download the `.aab` from the EAS build page and, in Play Console → Internal testing → **Create new
  release → Upload**, drag it in.

---

## 5. Fill in the required forms (one-time, under "Policy and programs" / "Grow")

- **Privacy policy**: paste `https://biblememory.biblememory.workers.dev/privacy`.
- **App access**: "All functionality is available without special access" (no login needed).
- **Ads**: **No ads**.
- **Content rating**: fill the IARC questionnaire honestly — no violence/sexual/etc. → expect
  **Everyone / PEGI 3**.
- **Target audience**: 13+ (the app isn't directed at children).
- **Data safety**: use the answers in §7.
- **Store listing**: use the copy in §6.
- **Category**: **Books & Reference** (or Lifestyle).

---

## 6. Store listing copy (ready to paste)

**App name (30 chars max):**
```
Versed
```

**Short description (80 chars max):**
```
Hide God's Word in your heart. Memorize Scripture and grow together with friends.
```

**Full description:**
```
Versed helps you hide God's Word in your heart — one verse at a time — and grow alongside the people you
love.

MEMORIZE, JOYFULLY
• Playful drills that make a verse stick
• Gentle spaced-repetition review brings each verse back right before you'd forget
• Streaks, levels, and celebrations to keep you going — with Ember, your encouraging companion

GROW TOGETHER
• Create a circle with a friend or small group using a simple invite code
• See what each person is learning and memorizing
• Challenge each other with a verse to recite or reflect on, and cheer one another on
• Pray together, share notes, and walk a reading plan side by side

GO DEEPER
• AI-guided study briefs: the setting, the people, the background, and questions to discuss
• Original commentary — Scripture text comes from trusted Bible sources

YOURS, AND SAFE
• No account needed — start in seconds
• Your data backs up automatically and moves to a new phone with a simple transfer code
• No ads. No trackers. We never sell your data.

"Your word I have hidden in my heart, that I might not sin against you." — Psalm 119:11
```

**Assets to upload:**
- **App icon:** 512×512 PNG. (Reuse `assets/icon.png` — it's 1024², resize to 512.)
- **Feature graphic:** 1024×500 PNG (required). A simple one: the Ember flame on the dark `#0B1220`
  background with "Versed" — I can generate this if you want.
- **Phone screenshots:** 2–8, PNG/JPG, min 320px. Capture: Today, a verse drill, a circle, the study
  brief, celebration.

---

## 7. Data safety form — recommended answers

Google's Data Safety questionnaire. These reflect how the app actually works; review before submitting.

**Does your app collect or share required user data?** → **Yes** (only if circles/backup are used).

Data types to declare (all **optional**, used for **App functionality**, **not** for tracking/ads):
- **Name** — the optional display name. Collected; **shared** with your circle's members (not with
  companies).
- **Other user-generated content** — prayers, notes, shared verses, challenges. Collected; shared with
  circle members.
- **App activity / other** — progress counters and a backup copy (verses, streaks). Collected for
  functionality and backup.
- **Device or other IDs** — the app-generated anonymous transfer code and (if you enable notifications)
  a push token.

Key answers:
- **Is data encrypted in transit?** → **Yes** (HTTPS).
- **Can users request data deletion?** → **Yes** (Reset in-app + email request; the policy states this).
- **Is any data shared with third parties?** → For the **AI study** feature, only passage *references*
  (e.g. "John 3:16") are sent to an AI provider to generate commentary — no personal data and no
  Scripture text. Circle content is shared with **other users you invite**, not with companies.
- **Is data used for tracking or advertising?** → **No.**

---

## 8. Add testers & roll out (Internal testing)

1. Internal testing → **Testers** → add the Google account **emails** of your group (or create an email
   list). Up to 100.
2. **Save → Review release → Start rollout to Internal testing.**
3. Share the **opt-in link** Play gives you. Testers open it, tap "Become a tester," install from the
   Play Store — and from then on they **auto-update**.

Internal testing goes live in minutes. When ready, promote the same release to **Closed testing** or
**Production** (Production adds a fuller review, 1–3 days).

---

## 9. Updates after launch

- **JS-only changes** (screens, logic, copy, most features): `eas update --branch production` — lands
  over the air, no store review, no reinstall.
- **Native changes** (new native module, permission, app name/icon, SDK bump): bump `version` in
  `app.json`, `eas build --profile production -p android`, then `eas submit`. Play auto-updates testers.
- versionCode auto-increments (EAS `appVersionSource: remote`), so you never manage it by hand.

⚠️ **Keep `version` and the OTA runtime in lockstep:** with `runtimeVersion.policy = "appVersion"`, an
OTA update only reaches builds whose `version` matches. When you ship a new store build at a new
`version`, publish OTA updates while `app.json` shows that same version.

---

## 10. Before a PUBLIC (production) launch — hardening

Fine for a trusted testing group as-is; do these before opening to the world:
- **Gate the server:** set a non-empty `extra.appSecret` in `app.json` **and** the matching
  `APP_SHARED_SECRET` on the Worker (`wrangler secret put APP_SHARED_SECRET`), so the AI endpoint isn't
  an open proxy to your paid key.
- **Spend cap:** confirm a hard monthly cap on your OpenAI/Anthropic key.
- Consider server-side rate limiting on `/ai`.
- The Android **package name `com.engraved.app` is permanent** once published — that's fine (users never
  see it), just know it can't change later.

---

## Alternatives to Play Store (if you're not ready)

- **Keep sharing the EAS APK link** (what you're doing) — zero setup, great for a few people. Downside:
  manual reinstall for native changes (JS still updates over the air).
- **Firebase App Distribution** — free, no Play account; invite testers by email, they get a notification
  when you push a new build. Good middle ground for 10–50 people without the Play review process.
- **Play Internal testing** — the sweet spot: Play-Store installs + automatic updates for your group,
  with essentially no review. Recommended as your next step.

iOS later would need an Apple Developer account ($99/yr) and TestFlight — separate track.
