# Deployment

> The browser application stays zero-build and static-hostable. The application document and committed corpus data ship together; optional local Ollama inference is a separate developer-only path.

## 1. Runtime files

The browser needs both:

| File | Role |
| --- | --- |
| `index.html` | Single-document UI, styles, and vanilla runtime |
| `data/zaziopath-graph.js` | Committed source-derived Zaziopath snapshot loaded before the runtime |

`data/zaziopath-graph.js` must remain at the relative path `data/zaziopath-graph.js` unless the script reference in the HTML is changed. CDN references for the existing Tailwind, Lucide, and font assets are unchanged; styling/icon typography needs a network, while the committed corpus, simulation, Grimoire, and deterministic fallback do not need an API server.

Build tooling (`scripts/`) is not needed to serve the snapshot. The graph builder needs a local Zaziopath clone only when a maintainer intentionally refreshes the committed data; see [Corpus data and provenance](ZAZIOPATH-CORPUS.md).

## 2. Local launch

```bash
# Open directly or serve statically; no build/install step for the browser app.
open index.html                     # macOS · xdg-open (Linux) · start (Windows)

# Recommended local development server; Node.js >= 18, zero npm dependencies.
npm start                           # http://localhost:4173

# Verify before shipping.
npm test                            # graph checks + runtime smoke + static UI audit
```

Opening `index.html` directly and GitHub Pages work in deterministic simulation/fallback mode. `scripts/serve.mjs` also exposes local Ollama routes, but only to loopback clients with a localhost Host/Origin.

## 3. GitHub Pages / static hosts

Deploy the repository root (or a directory containing both `index.html` and `data/`) without a build step. For GitHub Pages, select **Settings → Pages → Deploy from a branch → `main` → `/(root)**. Keep the generated data JS in the published root and confirm this URL serves JavaScript rather than a 404:

```text
https://<owner>.github.io/<repo>/data/zaziopath-graph.js
```

A static host cannot run Ollama or the local Node proxy. It uses the exact committed graph and offline lexical retrieval instead. Do not copy only `index.html` and omit the data sidecar.

## 4. Optional local Ollama

On the same developer machine, install/start the exact supported model and app server:

```bash
ollama pull llama3.1:8b     # only if not already installed
ollama serve                # terminal 1
npm start                   # terminal 2, from this repo
# browse http://localhost:4173
```

The local Node server checks installed model tags and proxies to `http://127.0.0.1:11434`. It does not download another model, use cloud inference, or expose inference routes to LAN clients. Keep both the Node server and Ollama private; do not forward their ports. Static hosting and remote previews stay in simulation mode.

## 5. Headers and CSP

The current single HTML document uses inline scripts/styles and existing CDNs. A strict CSP needs to account for those assets and the same-origin local status/API route; do not apply the older `connect-src 'none'` guidance.

An example starting point (test on the target host and adjust for its exact CDN responses):

```text
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com data:;
connect-src 'self';
img-src 'self' data:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'self';
```

This does not make the public page an Ollama proxy; GitHub Pages has no such route. Validate headers in browser dev tools and retain any platform-specific `frame-ancestors`/embedding requirements.

## 6. Caching and release checks

`index.html` and `data/zaziopath-graph.js` are both required, same-origin runtime files. Prefer revalidation (`Cache-Control: no-cache` or an equivalent ETag policy) for both so a deployment cannot serve new HTML with a stale graph snapshot. Existing third-party assets are CDN-managed; the repository does not self-host them.

Before release:

1. Run `npm test`.
2. Review the diff for `data/zaziopath-graph.js`; confirm the source revision/count change is intended.
3. Serve locally and complete the graph, Grimoire, offline fallback, and ingestion browser checks in [Testing](TESTING.md).
4. If using local inference, confirm only `llama3.1:8b` is used and the server remains loopback-restricted.
5. Deploy both `index.html` and `data/`; verify static fallback works without Ollama.

## 7. Cost and rollback

GitHub Pages and other static hosts have no application server cost. `npm test` uses only Node's standard library. Optional local inference uses the machine's Ollama installation; there is no cloud bill or hosted database. A static deployment is rolled back by restoring the previous versions of both browser files.
