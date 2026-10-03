<div align="center">

<img src="docs/assets/noosphere-banner.png" alt="NOÖSPHERE // OS — abstract neural cartography banner" width="100%" />

# NOÖSPHERE // OS

**A zero-build, CRT-styled visual operating system for exploring the Zaziopath corpus.**

[![CI](https://img.shields.io/github/actions/workflow/status/zazieproductions/Prometheus-Noosphere-v9.4/ci.yml?branch=main&label=audit&style=flat-square)](https://github.com/zazieproductions/Prometheus-Noosphere-v9.4/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-9.4.1-00f7ff?style=flat-square)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-a855f7?style=flat-square)](LICENSE)
[![Build](https://img.shields.io/badge/build%20step-none-ffaa00?style=flat-square)](#launch)
[![PRs](https://img.shields.io/badge/PRs-welcome-00f7ff?style=flat-square)](CONTRIBUTING.md)

**[Live demo](https://zazieproductions.github.io/Prometheus-Noosphere-v9.4/)** · **[Corpus & provenance](docs/ZAZIOPATH-CORPUS.md)** · **[Architecture](docs/ARCHITECTURE.md)** · **[Runtime API](docs/API.md)** · **[Testing](docs/TESTING.md)** · **[Changelog](CHANGELOG.md)**

</div>

---

## What this is

NOÖSPHERE keeps its original single-document desktop, Canvas force graph, draggable windows, CRT/glass visual language, Polymath Terminal, Ingestion Vector, Grimoire, sound controls, and zero-build structure. Its graph and searchable fragments now come from a stable, committed, source-derived snapshot of [Zaziopath](https://github.com/zazieproductions/Zaziopath), rather than procedural boot data or placeholder text.

Zaziopath is presented as a **non-clinical self-analysis archive, creative research instrument, evidence system, recursive notebook, and conceptual laboratory**—not as a personality-diagnosis engine. Source-authored interpretations are represented as what their sources say, not as independent validation.

## Corpus at a glance

The committed dataset is `data/zaziopath-graph.js` (source revision `63d99e311c852b9d57ddc29418455f9bb4ba80b1`):

- **8 strata**, preserving Zaziopath's names, glyphs, and source colors.
- **86 nodes** with source identity, summary, provenance, and excerpt/locator references.
- **117 explicitly cited relationships**, including the README's indexed cross-stratum wires and documented Shadow → Signal → Stewardship spine.
- **15 searchable, clickable Grimoire fragments** linked to source excerpts and graph nodes.
- Explicit **SOURCE / INFERENCE / SYNTHESIS / OPEN QUESTION** distinctions. Model suggestions and session-created edges are never source facts.

See [Corpus data and provenance](docs/ZAZIOPATH-CORPUS.md) for the curation, refresh process, limitations, privacy, and local fallback.

## What this is not

- **Not a diagnosis tool or validated personality assessment.** The corpus distinguishes self-report, documentary evidence, interpretation, and open questions.
- **Not an upload service.** Dropped files are read with the browser's `FileReader`; graph additions remain in page memory and disappear on reload. They are not written to browser storage or the committed dataset.
- **Not dependent on an LLM.** The committed graph, simulation, Grimoire, and deterministic lexical retrieval work without Ollama and on static GitHub Pages. Ollama is optional and local-only.
- **Not a vector database or cloud product.** There are no embeddings, API keys, cloud services, database, or package dependencies.

## Feature map

| Window | What it does |
| --- | --- |
| **Zaziopath Atlas** | Canvas 2D force graph; pan/zoom, deterministic source layout, stratum filters, provenance HUD, relationship highlighting, and green-ringed session nodes |
| **Polymath Terminal** | Bounded source/graph/selection/history context for optional local `llama3.1:8b`; deterministic cited corpus retrieval when unavailable |
| **Ingestion Vector** | Local text/Markdown/CSV/JSON/code reading; up to three high-signal candidates, normalized-name deduplication, source and marked candidate links, session-only retention |
| **Archive Signals** | Live counts for committed source nodes/edges, open questions, epistemic labels, and strata; no behavioral scores |
| **Grimoire** | Searchable source excerpts with provenance; clicking loads context and highlights related graph nodes |
| **Cross-Stratum Synthesis** | Creates a session-local OPEN QUESTION from selected source records, not a newly asserted connection |
| **Aesthetic / sound controls** | Existing palette, clipboard, and plain Web Audio tone controls |

## Launch

### Static / no inference (no Node installation needed)

Open `index.html` directly or deploy the repository root to GitHub Pages. The committed graph, simulation, Grimoire, and local retrieval fallback do not depend on an API server. Full visual styling/icons/fonts use the existing CDN references, so those presentation assets require a network connection.

### Local server (recommended for development)

Requires Node.js 18 or newer; there are no npm dependencies and no build step.

```bash
npm start
# open http://localhost:4173
```

Equivalent: `node scripts/serve.mjs --port 4173 --host 0.0.0.0`. The bundled server serves static files and exposes only loopback-restricted inference routes. The graph and fallback do not require Ollama.

### Optional local Ollama inference

Install Ollama separately and use only the existing `llama3.1:8b` model:

```bash
# Terminal 1 — with the model already installed; pull only if needed:
ollama pull llama3.1:8b
ollama serve

# Terminal 2, from this repository:
npm start
```

Open `http://localhost:4173`. When that exact model is available, the terminal reports local inference online. If Ollama is absent or a request fails, the UI returns to deterministic corpus retrieval and local extraction. The server sends bounded prompt/context to Ollama at `127.0.0.1:11434`; it is not a cloud request. Do not expose Ollama or the development server to the network. GitHub Pages cannot run the local proxy, so it remains in fallback mode.

## Validate and test

```bash
npm test                         # graph validation + runtime smoke + static UI audit
npm run validate:graph           # graph data checks only
node scripts/validate-zaziopath-graph.mjs --json
npm run audit:json               # static audit details
```

Validation covers duplicate IDs, dangling edge endpoints, missing provenance/excerpts, invalid strata/statuses, normalized duplicate concept names, and fragment references. The audit also checks DOM references, inline handlers, unsafe interpolations, and existing tracked UI debt. See [Testing](docs/TESTING.md) for browser smoke checks.

## Refresh the committed corpus

Zaziopath is source material, not a runtime or package dependency. To intentionally refresh the curated snapshot, clone it locally, run the builder, inspect the diff, and validate before committing:

```bash
git clone --depth 1 https://github.com/zazieproductions/Zaziopath.git /tmp/Zaziopath
node scripts/build-zaziopath-graph.mjs --source /tmp/Zaziopath
npm test
git diff -- data/zaziopath-graph.js
```

Curated definitions live in `scripts/build-zaziopath-graph.mjs`; edit that source, not the generated browser file. Every citation anchor is checked during generation.

## Repository map

```text
index.html                         single-document UI and runtime
 data/zaziopath-graph.js           committed source-derived browser snapshot
scripts/build-zaziopath-graph.mjs  curated graph builder and source-anchor checks
scripts/validate-zaziopath-graph.mjs  dependency-free committed-data validator
scripts/audit.mjs                  static markup/runtime integrity ratchet
scripts/serve.mjs                  static dev server + loopback-only Ollama proxy
docs/ZAZIOPATH-CORPUS.md           provenance, refresh, privacy, fallback
 docs/ARCHITECTURE.md               runtime topology and data model
 docs/API.md                       public runtime surfaces and API routes
 docs/TESTING.md                   automated and manual validation
```

## Technology

- Hand-authored HTML, vanilla JavaScript, Canvas 2D, Web Audio API.
- Existing Tailwind/Lucide/font CDN usage; no frameworks or runtime packages added.
- Node.js standard library is used only for the optional server and validation/audit scripts.
- No client storage, telemetry, cloud inference, database, embeddings, or vector database.

## License

[MIT](LICENSE) © Zazie Productions. The Zaziopath corpus remains attributed to its source repository; its claims and interpretations are represented with their recorded provenance and limitations.
