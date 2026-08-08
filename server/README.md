# Engraved server (Cloudflare Worker)

A tiny server that holds the secret AI key the app can't ship, and proxies:

- `POST /ai` — AI verse tools (memory hooks, plain-English meaning, build-a-pack)

It works with **OpenAI** or **Anthropic** — whichever key you set. The app talks only to
this server; your key never leaves it. Everything is optional — the app works fully without
it, and turns these features on once you paste the deployed URL into
**Settings → AI & Server** in the app.

> ESV is currently disabled (it needs a separate free Crossway key). The code is in place
> but commented out — see the note at the bottom to turn it on later.

## What you'll need (free to start)

1. A **Cloudflare** account — https://dash.cloudflare.com/sign-up
2. An **OpenAI API key** — https://platform.openai.com/api-keys (set a monthly usage limit
   under Billing → Limits). Starts with `sk-…`.
   - *(Or an **Anthropic** key instead — https://console.anthropic.com — the server auto-uses
     whichever key is present.)*

> 🔐 Never paste the key into the app, into git, or into chat. It goes **only** into the
> Worker's secret below.

## Deploy (command line — recommended)

```bash
cd server
npm install                          # installs wrangler locally
npx wrangler login                   # opens the browser to sign in / sign up
npx wrangler secret put OPENAI_API_KEY   # paste your sk-… key when prompted
npx wrangler deploy
```

`npx wrangler deploy` prints your URL, e.g. `https://engraved-server.<you>.workers.dev`.
Paste that into the app: **Settings → AI & Server → Server URL**.

> The worker is named `engraved-server` (from `wrangler.toml`). If you already created a
> worker with a different name in the Cloudflare dashboard, either change the `name` line in
> `wrangler.toml` to match it, or ignore/delete that empty one — `wrangler deploy` manages
> `engraved-server` on its own.

Optional extra protection: `npx wrangler secret put APP_SHARED_SECRET` (any random string).

## Model / cost

The model is set by `AI_MODEL` in `wrangler.toml` (default **`gpt-5.4-mini`**). Change it to
any exact model id your key can use. Results are cached per verse in the app, so you pay
only the first time you generate a hook or explanation for a given verse.

- OpenAI default: `gpt-5.4-mini`
- Anthropic (if you use a Claude key instead): set `AI_MODEL = "claude-haiku-4-5"`

## Notes

- The AI never generates Scripture text — `pack` returns references only, and the app fetches
  the real verses from the trusted Bible providers.

### Re-enabling ESV later
1. Uncomment `handleEsv` and the `/esv` route in `src/worker.ts`.
2. Uncomment the `esv` entry in the app's `src/data/bibleApi.ts` `TRANSLATIONS`.
3. Get a free key at https://api.esv.org and `wrangler secret put ESV_API_KEY`, then redeploy.
