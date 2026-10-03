# Deployment

> Shipping a one-file application — locally, to GitHub Pages, and to any static host — including the
> Content-Security-Policy the current architecture actually requires.

**Deployable artefact:** `index.html` — one file, 88,649 B, no build step.
**Prerequisites:** none for the runtime. Node.js ≥ 18 only for tooling.

---

## 1. What ships

| Ships | Does not ship |
| --- | --- |
| `index.html` — the entire application | `scripts/` — audit and dev server (tooling) |
| A 404 page, if the host needs one | `docs/` — documentation, not linked by the app |
| Optionally a `<meta>`/header CSP (§ 5) | `.github/` — workflow and templates |

Nothing in `scripts/` or `docs/` is required at runtime, and the application never fetches anything
from its own origin beyond the document itself. That means the deployment target only has to serve
one static file correctly.

---

## 2. Local

```bash
# A — zero setup
open index.html                     # macOS · xdg-open · start (Windows)

# B — bundled dev server (recommended: correct MIME types, no file:// quirks)
npm start                           # → http://localhost:4173
node scripts/serve.mjs --port 8080 --host 0.0.0.0

# C — verify before shipping
npm test                            # static integrity audit; must exit 0
```

`file://` works, but some browsers restrict clipboard access on insecure origins — the palette's
"copy hex" action degrades silently because it is optional-chained. Use the dev server when
demonstrating clipboard behaviour.

**Environment variables:** `PORT` and `HOST` are honoured as fallbacks to the flags.

---

## 3. GitHub Pages (primary target)

The repository is already shaped for this: `index.html` sits at the branch root and
`package.json#homepage` points at the Pages URL.

### Option A — deploy from the branch root (simplest)

1. **Settings → Pages → Build and deployment**
2. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)` → **Save**
3. Add an empty `.nojekyll` at the root so GitHub Pages does not run the document through Jekyll
4. Wait for the deployment, then verify `https://<owner>.github.io/<repo>/`

> If the live URL 404s, Pages has not been enabled yet — step 2 is the whole fix, it takes a minute,
> and it needs repository-admin rights.

### Option B — deploy from Actions (explicit, auditable)

`.github/workflows/pages.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm test                # the audit is the deploy gate

  deploy:
    needs: verify
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .                    # publish the root; docs/ and scripts/ are inert
      - id: deployment
        uses: actions/deploy-pages@v4
```

Option B makes the audit a **hard deploy gate**: a regression cannot reach the live URL.

---

## 4. Other static hosts

All three are configured with **no build command** and the repository root as the publish directory.

| Host | Configuration |
| --- | --- |
| **Netlify** | `netlify.toml`: `[build] publish = "."` · no command · add the headers block from § 5 |
| **Vercel** | `vercel.json`: `{ "buildCommand": null, "outputDirectory": "." }` · headers from § 5 |
| **Cloudflare Pages** | Framework preset **None** · build command empty · output directory `/` · `_headers` file for § 5 |
| **S3 + CloudFront** | Sync the root; set `index.html` as the default root object and the error document |
| **nginx / Caddy** | Serve the directory as static files; add the headers in § 5 |

`netlify.toml` (including the CSP from § 5):

```toml
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = """
default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com; \
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; \
img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; \
frame-ancestors 'self'; upgrade-insecure-requests"""
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), camera=(), microphone=(), payment=()"
```

`vercel.json`:

```json
{
  "buildCommand": null,
  "outputDirectory": ".",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "geolocation=(), camera=(), microphone=(), payment=()" }
      ]
    }
  ]
}
```

---

## 5. Content-Security-Policy

### 5.1 The honest version

Every CSP recommendation here is constrained by three architectural facts:

1. **Two inline `<script>` blocks** (the Tailwind config and the runtime) — blocked without
   `'unsafe-inline'`.
2. **40+ inline event-handler attributes** (`onclick="…"`) — also blocked without `'unsafe-inline'`.
3. **Tailwind Play CDN injects a `<style>` element at runtime**, and the document has an inline
   `<style>` block — so `style-src` needs `'unsafe-inline'` too.

A policy that pretends otherwise breaks the application. The compatibility policy below is therefore
the strongest available **without refactoring**, and it is stated as such.

### 5.2 Compatibility policy (current architecture)

```
default-src  'self';
script-src   'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com;
style-src    'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src     'self' https://fonts.gstatic.com;
img-src      'self' data:;
connect-src  'none';
object-src   'none';
base-uri     'none';
form-action  'none';
frame-ancestors 'self';
upgrade-insecure-requests
```

| Directive | Why |
| --- | --- |
| `connect-src 'none'` | **Truthful and verifiable:** the runtime performs zero `fetch`/XHR/WebSocket calls. A strict `connect-src` here is a real guarantee, not a hopeful one. |
| `script-src … unpkg.com` | Lucide ships from unpkg. Pinning the URL does not remove the origin, only the version drift. |
| `object-src`/`base-uri`/`form-action: 'none'` | No plugins, no `<base>`, no forms — pure hardening with no cost. |
| `frame-ancestors 'self'` | **Change this if you embed the demo.** A portfolio that iframes the app must use `frame-ancestors <that-origin>` — or omit the directive. The bundled dev server deliberately sends no framing restriction so previews work. |

**Prefer a response header over a `<meta http-equiv>` tag.** A meta policy cannot express
`frame-ancestors`, and header-delivered policies are applied before the document starts parsing.

### 5.3 Hardened policy (after the `9.5.0` refactor)

Removing the three constraints above is a bounded piece of work, not a rewrite:

| Step | Change | Removes |
| --- | --- | --- |
| Vendor a built Tailwind stylesheet | Build once at release, commit the CSS | `cdn.tailwindcss.com` + runtime style injection |
| Move inline handlers to delegated `addEventListener` | One listener per container, dispatched via `data-action` | 40+ handler attributes |
| Self-host Lucide and the three font families | Commit the subsetted `woff2` and the icon sprite | `unpkg.com`, `fonts.googleapis.com`, `fonts.gstatic.com` |
| Keep the two inline scripts, or move them to a file | A single `<script src>` | the last `'unsafe-inline'` |

Target policy once complete:

```
default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self';
img-src 'self' data:; connect-src 'none'; object-src 'none';
base-uri 'none'; form-action 'none'; frame-ancestors 'self'
```

No `'unsafe-inline'`, no third-party origins, no network at all. This is the destination implied by
[ADR-002](DECISIONS.md#adr-002--no-build-step-tailwind-play-cdn) and tracked as `NOO-008`.

---

## 6. Caching

The whole application is one file, which inverts the usual advice: **there is no hashed asset to
cache forever, and a stale copy of `index.html` is a stale application.**

| Resource | Recommended header | Rationale |
| --- | --- | --- |
| `index.html` | `Cache-Control: no-cache` (revalidate, with ETag) | Instant correctness after a deploy; the document is small enough that revalidation is cheap |
| `docs/assets/*.png` | `Cache-Control: public, max-age=31536000, immutable` | Documentation images, never referenced by the runtime |
| Third-party CDN responses | Vendor-controlled | Another argument for self-hosting: you cannot set caching or pinning on someone else's origin |

**Do not** apply `immutable` to `index.html`. With an unpinned Lucide/Tailwind CDN in play, a cached
document and a changed vendor library can disagree in ways that are invisible until something breaks
(`NOO-008`).

---

## 7. Observability

| Concern | Position |
| --- | --- |
| Analytics | **None, deliberately.** No telemetry, no cookies, no third-party scripts. Adding any would contradict [ADR-006](DECISIONS.md#adr-006--no-persistence-no-backend). |
| Uptime | An external synthetic check against the URL is sufficient — one 200 response means the whole app is up. |
| Errors | The runtime logs nothing and should never throw; `npm test` plus the manual matrix is the error budget ([`TESTING.md`](TESTING.md)). |
| Performance | Re-run the frame-time harness and the Lighthouse/Network pass from [`PERFORMANCE.md`](PERFORMANCE.md) on each release candidate. |

---

## 8. Release checklist

Run top to bottom. Every line is either automated or takes under a minute.

```bash
# 1 · Verify
npm test                       # must be PASS (exit 0)
npm run audit:json             # confirm the finding count matches the baseline

# 2 · Version
#    bump "version" in package.json and add the CHANGELOG entry
#    (Keep a Changelog: Added / Changed / Fixed / Removed)

# 3 · Smoke-test locally
npm start                      # walk the manual matrix in docs/TESTING.md § 3

# 4 · Publish
git commit -am "chore(release): v9.4.2"
git tag -a v9.4.2 -m "v9.4.2"
git push origin main --follow-tags

# 5 · Verify live
#    - hard-reload the deployed URL (bypass cache)
#    - console: zero errors, zero unexpected network calls
#    - all seven windows present; RE-ALIGN restores the grid
#    - header shows the expected version string
```

| Check | Expected |
| --- | --- |
| `npm test` | `✔ PASS`, findings ≤ baseline |
| Payload | < 96,000 B (warn threshold) |
| Console | Clean |
| Windows | 7 · dock 6 · modal 1 |
| Tag | `v<version>` pushed and visible in Releases |
| Pages deployment | Green, and the live version string matches the tag |

---

## 9. Rollback

Because the artefact is a single file and every deploy is a new commit or a new Pages deployment:

| Situation | Action | Time |
| --- | --- | --- |
| Bad deploy, cause unknown | Re-run the previous successful Pages deployment (or `git revert <sha> && git push`) | < 1 min |
| Styling broken in production only | Compare the live network trace against § 5 — a CSP violation looks exactly like "the CSS vanished" | minutes |
| Vendor library changed under the artefact | Symptom of `NOO-008`; pin the URL and redeploy | minutes |
| Audit regression shipped | `npm test` reproduces it locally from the tag; fix forward with a patch release | depends |

Every deploy is trivially reversible, which is the main operational dividend of having no build
pipeline and no server state.

---

## 10. Cost

| Host | Cost | Notes |
| --- | --- | --- |
| GitHub Pages / Cloudflare Pages / Netlify free tier | **$0** | A single 88 KB file with no functions |
| Bandwidth | negligible | One document per visit plus CDN dependencies |
| Build minutes | **zero** | `npm test` (~0.3 s) is the only CI work |
| Runtime | $0 | No backend, no database, no serverless function |

The only recurring cost this project could incur is a domain name.

---

<div align="center">
<sub>Next: <a href="MAINTAINABILITY.md">Maintainability →</a></sub>
</div>

## Local inference versus static deployment

GitHub Pages and other static hosts cannot run Ollama or the local Node proxy; the public
terminal remains in `SIMULATION MODE` with the original deterministic templates. For private
local inference run `ollama serve` with the already-installed `llama3.1:8b`, then `npm start`
and visit `http://localhost:4173`. Keep both services private. Do not forward the dev server
or Ollama ports to the internet. There are no API keys or cloud inference services.
