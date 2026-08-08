# Engraved server (Cloudflare Worker)

A tiny server that holds the secret API keys the app can't ship, and proxies:

- `POST /ai` — AI verse tools (memory hooks, plain-English meaning, build-a-pack) via Claude
- `POST /esv` — ESV verse text via the Crossway API

The app talks only to this server; your keys never leave it. Everything is optional —
the app works fully without it, and turns these features on once you paste the deployed
URL into **Settings → AI & Server** in the app.

## What you'll need (all free to start)

1. A **Cloudflare** account — https://dash.cloudflare.com/sign-up
2. An **Anthropic API key** — https://console.anthropic.com → Billing (add a card and set a
   small monthly spend cap, e.g. $5) → API Keys → Create Key. Starts with `sk-ant-…`.
3. *(Optional, only for ESV)* a free **ESV API key** — https://api.esv.org → create an
   account → create an API key.

> 🔐 Never paste these keys into the app, into git, or into chat. They go **only** into the
> Worker's secrets below.

## Deploy

```bash
cd server
npm install -g wrangler        # one time
wrangler login                 # opens the browser

# Set your secrets (each command prompts you to paste the value)
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put ESV_API_KEY          # optional — only if using ESV
wrangler secret put APP_SHARED_SECRET    # optional — any random string, extra protection

wrangler deploy
```

`wrangler deploy` prints your URL, e.g. `https://engraved-server.<you>.workers.dev`.
Paste that into the app: **Settings → AI & Server → Server URL**.

## Change the model / cost

Edit `AI_MODEL` in `wrangler.toml` (default `claude-haiku-4-5`, the cheapest). `claude-sonnet-5`
gives richer explanations for a bit more. Results are cached per verse in the app, so you
pay only the first time you generate a hook or explanation for a given verse.

## Notes

- The AI never generates Scripture text — `pack` returns references only, and the app fetches
  the real verses from the trusted Bible providers.
- ESV text is © Crossway; the app shows the required attribution wherever ESV verses appear.
