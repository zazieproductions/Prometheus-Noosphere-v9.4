# Deployment

> The corpus application stays zero-build and static-hostable. Its committed data and optional shell degradation assets ship together; local Ollama and the unsandboxed SYNAPSE SHELL bridge are developer-workstation paths.

## 1. Runtime files

The static browser path needs these committed files:

| File | Role |
| --- | --- |
| `index.html` | Core single-document UI, styles, and vanilla runtime |
| `data/zaziopath-graph.js` | Source-derived Zaziopath snapshot loaded before the runtime |
| `shell/synapse-shell.js` | Optional shell window client; renders an unavailable state without the bridge |
| `shell/synapse-shell.css` | Isolated shell styling |

Keep the data and shell assets at their relative paths unless the script/link references in the HTML are changed. Tailwind, Lucide, and font CDNs remain as before; full presentation needs a network. Corpus data, simulation, Grimoire, and deterministic fallback do not need an API server. Static hosting cannot provide the PTY or local Ollama routes.

Build tooling (`scripts/`) is not needed to serve the snapshot. The graph builder needs a local Zaziopath clone only when a maintainer intentionally refreshes the committed data; see [Corpus data and provenance](ZAZIOPATH-CORPUS.md).

## 2. Local launch

```bash
# Open the static corpus app directly; no install/build step.
open index.html                     # macOS · xdg-open (Linux) · start (Windows)

# Local server; Node.js >= 18. Starts without installed packages.
npm start                           # http://localhost:4173

# Optional workstation shell dependencies and PTY bridge.
npm install
npm start
# or disable PTY creation explicitly:
npm run start:no-shell

# Verify before shipping.
npm test                            # graph + runtime + audit + optional shell/UI suites
```

Opening `index.html` directly and GitHub Pages work in deterministic simulation/fallback mode. `scripts/serve.mjs` exposes inference routes only to strict loopback requests and starts the SYNAPSE SHELL bridge only when its optional packages are available. Shell access is an unsandboxed login shell as the launching user; read [SHELL.md](SHELL.md) and [SECURITY.md](../SECURITY.md) before enabling it.

## 3. GitHub Pages / static hosts

Deploy the repository root (or a directory containing `index.html`, `data/`, and `shell/`) without a build step. For GitHub Pages, select **Settings → Pages → Deploy from a branch → `main` → `/(root)**. Keep the generated data JS and shell client assets in the published root and confirm these URLs serve files rather than 404:

```text
https://<owner>.github.io/<repo>/data/zaziopath-graph.js
https://<owner>.github.io/<repo>/shell/synapse-shell.js
```

A static host cannot run Ollama or the local Node proxy/PTY bridge. It uses the exact committed graph and offline lexical retrieval instead. Do not copy only `index.html`: include `data/` and `shell/` so source data is available and the shell client can degrade cleanly.

## 4. Optional local Ollama

On the same developer machine, install/start the exact supported model and app server:

```bash
ollama pull llama3.1:8b     # only if not already installed
ollama serve                # terminal 1
npm start                   # terminal 2, from this repo
# browse http://localhost:4173
```

The local Node server checks installed model tags and proxies to the configured HTTP loopback Ollama URL (default `http://127.0.0.1:11434`). `NOOSPHERE_OLLAMA_URL` may choose another loopback host/port only; credentials, paths, and remote/cloud hosts are rejected. The server does not download another model or expose inference routes to LAN clients. Keep both the Node server and Ollama private; do not forward their ports. Static hosting and remote previews stay in simulation mode.

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

For local SYNAPSE SHELL on the default port, add `ws://localhost:4173` to `connect-src` (or the exact local WebSocket origin you configured); do not allow arbitrary remote WebSocket hosts. The public page has no PTY or Ollama route. Validate headers in browser dev tools and retain any platform-specific `frame-ancestors`/embedding requirements.

## 6. Caching and release checks

`index.html`, `data/zaziopath-graph.js`, and `shell/` client assets are same-origin runtime files. Prefer revalidation (`Cache-Control: no-cache` or an equivalent ETag policy) so a deployment cannot serve new HTML with stale graph/client assets. Existing third-party presentation assets are CDN-managed; the repository does not self-host them.

Before release:

1. Run `npm test`.
2. Review the diff for `data/zaziopath-graph.js`; confirm the source revision/count change is intended.
3. Serve locally and complete the graph, Grimoire, offline fallback, and ingestion browser checks in [Testing](TESTING.md).
4. If using local inference, confirm only `llama3.1:8b` is used and the Ollama URL and proxy remain loopback-restricted.
5. If shipping shell changes, run `npm run test:shell` and `npm run test:ui`; review the unsandboxed-shell disclosure and default gate.
6. Deploy `index.html`, `data/`, and `shell/`; verify static fallback works without Ollama or a PTY.

## 7. Cost and rollback

GitHub Pages and other static hosts have no application-server cost. Core validation/runtime/audit checks use Node's standard library; full shell tests require optional workstation packages. Local inference uses the machine's Ollama installation; there is no cloud bill or hosted database. A static deployment is rolled back by restoring `index.html`, `data/`, and `shell/` together.
