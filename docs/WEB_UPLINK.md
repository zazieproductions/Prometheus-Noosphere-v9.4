# NOÖSPHERE // WEB UPLINK — Local-First Web Research & Browsing Architecture

> Complete technical guide, setup instructions, security boundaries, and command reference for NOÖSPHERE's 10-level local web research workstation.

---

## 1. Architectural Overview

NOÖSPHERE's **WEB UPLINK** upgrades the terminal and desktop workspace into a local-first research intelligence system while keeping all language reasoning strictly on your local machine via **Ollama (`llama3.1:8b`)**.

```
NOÖSPHERE (Browser Desktop: win-uplink + win-terminal + win-graph)
  ↓ (Loopback HTTP /api/uplink/* & /api/noosphere*)
Local Web Research Orchestrator (scripts/serve.mjs + scripts/uplink/orchestrator.mjs)
  ├── Level 1 · Search      (scripts/uplink/search.mjs)
  │     ├── Primary: Local SearXNG instance (SEARXNG_URL, default http://127.0.0.1:8080)
  │     └── Fallback: Zero-key public metasearch (DuckDuckGo, Wikipedia, Crossref, arXiv, HN Algolia, Wikimedia)
  ├── Level 2 · Fetch       (scripts/uplink/reader.mjs)
  │     └── SSRF-guarded redirect-safe fetcher, HTML/Markdown extractor, metadata/heading/link parser
  ├── Level 3 · Crawl       (scripts/uplink/crawler.mjs)
  │     ├── Optional: Local Crawl4AI service (CRAWL4AI_URL, default http://127.0.0.1:11235)
  │     └── Built-in: Relevance-guided priority BFS crawler (depth/page/char bounded)
  ├── Level 4 · Browser     (scripts/uplink/browser.mjs)
  │     ├── Optional: Managed local Chromium / Playwright / CDP with isolated profile
  │     └── Built-in: Interactive Server-Assisted DOM Reader fallback + Consequential Action Guard
  ├── Level 7 · Quality     (scripts/uplink/quality.mjs)
  │     └── Heuristic ranking & strict epistemic separation (PRIMARY / SECONDARY / SNIPPET / INFERENCE)
  └── Levels 5, 6, 8, 9 · Local Synthesis, Multi-Hop Loop, Citations & Zaziopath Ingestion
        └── Local Ollama (`llama3.1:8b` at http://127.0.0.1:11434) over isolated <untrusted_web_evidence>
```

### Core Invariants

1. **Single Local LLM (`llama3.1:8b`)**: All synthesis, search planning, and follow-up query generation use `llama3.1:8b` through localhost Ollama (`http://127.0.0.1:11434`). No cloud LLM APIs (OpenAI, Anthropic, Gemini, Groq, OpenRouter, Perplexity) or extra embedding models are used.
2. **Graceful Progressive Activation**: NOÖSPHERE boots and operates cleanly even if optional local services (SearXNG, Crawl4AI, Chromium/Playwright, or Ollama) are not installed.
3. **Ephemeral Web Findings by Default**: Web search results and fetched pages are never silently turned into autobiographical facts or permanent Zaziopath graph nodes. Only explicit user actions (`INGEST SOURCE`, `INGEST FINDING`, `ADD TO GRAPH`, `/ingest <n>`) add provenance-tagged `[WEB SOURCE]` nodes to the Zaziopath graph.

---

## 2. First-Run Experience & Local Tool Setup

### Minimum Setup (Zero External Dependencies)

```bash
npm start
# Open http://localhost:4173
```

With only Node.js `>= 18` installed:
- `SEARCH // ONLINE (FALLBACK)` is active immediately via zero-key public metasearch.
- `CRAWLER // ONLINE (LOCAL BFS)` is active immediately via the built-in relevance-guided crawler.
- `BROWSER // OFFLINE (DOM READER)` uses the built-in interactive DOM Reader fallback.
- `OLLAMA // OFFLINE` uses non-fabricated extractive evidence summaries until Ollama is started.

---

### Stage 1: Enable Local LLM Cognition (`llama3.1:8b` via Ollama)

Install [Ollama](https://ollama.com) and pull **only** `llama3.1:8b`:

```bash
# 1. Pull llama3.1:8b once
ollama pull llama3.1:8b

# 2. Start local Ollama server (binds 127.0.0.1:11434)
ollama serve
```

Status indicator changes to:
- `OLLAMA // ONLINE`
- `LOCAL COGNITION // llama3.1:8b`

---

### Stage 2: Enable Primary Local Metasearch (SearXNG)

To run your own local SearXNG metasearch instance (recommended for multi-engine aggregation):

```bash
# Run SearXNG locally on port 8080 via Docker
docker run --rm -d \
  --name noosphere-searxng \
  -p 127.0.0.1:8080:8080 \
  -e SEARXNG_BASE_URL=http://127.0.0.1:8080/ \
  searxng/searxng:latest
```

Ensure JSON output is enabled in SearXNG's `settings.yml`:

```yaml
search:
  formats:
    - html
    - json
```

If SearXNG runs on a non-default port, set `SEARXNG_URL`:

```bash
SEARXNG_URL=http://127.0.0.1:8080 npm start
```

Status indicator changes to:
- `SEARCH // ONLINE (SEARXNG)`

---

### Stage 3: Enable Optional Crawl4AI Service (Deep Crawler Adapter)

NOÖSPHERE includes a built-in relevance-guided multi-page crawler out of the box. To optionally pair it with a local **Crawl4AI** service:

```bash
# Option A: Docker
docker run --rm -d -p 127.0.0.1:11235:11235 unclecode/crawl4ai:latest

# Start NOÖSPHERE (auto-detects http://127.0.0.1:11235/health)
CRAWL4AI_URL=http://127.0.0.1:11235 npm start
```

Status indicator changes to:
- `CRAWLER // ONLINE (CRAWL4AI)`

---

### Stage 4: Enable Managed Local Browser (Chromium / Playwright / CDP)

For dynamic JavaScript-heavy websites, install Chromium or Playwright on your machine. NOÖSPHERE always launches Chromium with an **isolated managed profile** (`.noosphere-cache/browser-profile`) and **never** uses your personal logged-in browser profile.

```bash
# Option A: Install system Chromium (Linux / macOS)
sudo apt install chromium          # Debian/Ubuntu
brew install --cask chromium       # macOS

# Option B: Connect to a dedicated local Chromium CDP port
chromium --headless --remote-debugging-port=9222 --user-data-dir=/tmp/noosphere-profile
CDP_URL=http://127.0.0.1:9222 npm start
```

Status indicator changes to:
- `BROWSER // ONLINE (MANAGED)`

---

## 3. Slash Commands & Interactive Controls

All commands work in both the **Polymath Terminal (`win-terminal`)** and the **Web Uplink Workstation (`win-uplink`)**:

| Command | Description | Example |
| --- | --- | --- |
| `/web <query>` | Multi-engine web metasearch with normalized results | `/web electroacoustic spatialization` |
| `/read <URL>` | Extract clean readable Markdown, metadata, headings & links from one URL | `/read https://ircam.fr/research` |
| `/crawl <URL> [topic]` | Bounded multi-page site crawl with relevance filtering & deduplication | `/crawl https://example.edu ambisonics` |
| `/site <domain> <query>` | Multi-hop research restricted to a single domain | `/site arxiv.org wave field synthesis` |
| `/research <query>` | Full bounded multi-hop research loop with `llama3.1:8b` synthesis & citations | `/research history and current debates around electroacoustic spatialization` |
| `/news <query>` | Recency-weighted news research | `/news spatial audio standards` |
| `/browser <URL>` | Open URL in the managed local browser / DOM reader | `/browser https://example.org` |
| `/browser scroll <dir>` | Scroll managed browser (`down`, `up`, `top`, `bottom`) | `/browser scroll down` |
| `/browser click <target>` | Click a link/button by index (`1`, `L1`) or visible text | `/browser click 1` |
| `/browser screenshot` | Capture viewport snapshot | `/browser screenshot` |
| `/sources` | Display numbered sources (`[1]..[N]`) from the current research session | `/sources` |
| `/ingest <number>` | Explicitly ingest source `#n` into the Zaziopath graph as a `WEB SOURCE` | `/ingest 2` |
| `/ingest finding` | Explicitly ingest the current research synthesis & citations into Zaziopath | `/ingest finding` |
| `/clear-cache` | Purge the bounded memory and disk web cache | `/clear-cache` |

---

## 4. Internal Tool Interface

Exposed via `UPLINK_TOOLS` in `scripts/uplink/orchestrator.mjs` and `POST /api/uplink/tool`:

- `search_web(query, options)`
- `fetch_page(url, options)`
- `crawl_site(url, options)`
- `open_browser(url, options)`
- `browser_click(selector_or_target, options)`
- `browser_scroll(direction)`
- `browser_read()`
- `browser_screenshot()`
- `research(query, options)`

---

## 5. Source Quality Heuristics & Epistemic Separation (Levels 7 & 8)

Sources are ranked deterministically (`0..100`) across six transparent dimensions:
1. **Authority (`0..32`)**: Academic (`.edu`, `.ac.*`, `arxiv.org`, `doi.org`, `ieee.org`, `acm.org`, `ircam.fr`, etc.), Primary/Official (`.gov`, `.int`, `w3.org`, `ietf.org`, first-party domains), Reference (`wikipedia.org`, `britannica.com`), Secondary, and Low-Signal tiers.
2. **Relevance (`0..30`)**: Query token and stem match across title, URL, headings, and body text.
3. **Recency (`0..15`)**: Publication date freshness (weighted higher for `/news` and recency filters).
4. **Provenance (`0..15`)**: Presence of author, publication date, and full-text extraction.
5. **Corroboration (`0..10`)**: Multi-engine hit agreement and cross-domain concept overlap.
6. **Duplication Penalty (`0..-25`)**: Penalizes near-duplicate titles and single-domain flooding.

Every synthesis explicitly separates four epistemic tiers:
- `PRIMARY SOURCE`
- `SECONDARY SOURCE`
- `SEARCH SNIPPET`
- `MODEL INFERENCE`

---

## 6. Security & Privacy Architecture

### SSRF & Network Egress Protections (`scripts/uplink/security.mjs`)
- **Scheme Allowlist**: Only `http:` and `https:` are permitted (`file://`, `javascript:`, `data:`, `ftp:`, etc. are blocked).
- **Private & Special IP Blocking**: Blocks `localhost`, `127.0.0.0/8`, `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `169.254.0.0/16` (including cloud metadata `169.254.169.254`), `172.16.0.0/12`, `192.168.0.0/16`, multicast/reserved ranges, IPv6 loopback `::1`, unique-local `fc00::/7` (`fd00:ec2::254`), link-local `fe80::/10`, IPv4-mapped IPv6 `::ffff:...`, and hex/octal/integer IP encodings.
- **DNS Rebinding & Redirect Defense**: Every hostname is resolved via DNS and verified against private/reserved IP ranges before connection and on **every** redirect hop (`redirect: 'manual'`, max 5 hops).
- **Stream & MIME Hardening**: Rejects binary/executable MIME types and aborts responses exceeding the 2 MB stream ceiling.

### Prompt-Injection Isolation
- Webpage text is treated strictly as **untrusted passive data**, never executable instructions.
- Hidden DOM elements (`display:none`, `visibility:hidden`, `aria-hidden="true"`) are stripped before extraction.
- Known injection phrases, role-hijack patterns, LLM control tokens (`<|im_start|>`, `[INST]`), and fake tool calls are neutralized and flagged in `injectionFlags`.
- All web excerpts passed to `llama3.1:8b` are isolated inside `<untrusted_web_evidence>` data fences.

### Consequential Browser Action Guard
- The managed browser blocks autonomous purchases/checkouts, content posting, data deletion, password/credential entry, and account/settings modifications (`requiresConfirmation: true`).
