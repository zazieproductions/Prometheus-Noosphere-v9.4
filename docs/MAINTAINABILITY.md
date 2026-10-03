# Maintainability

> Stewardship notes for the zero-build NOÖSPHERE/Zaziopath runtime, committed corpus snapshot, and optional workstation shell.

## 1. Maintainer contract

| Area | Current rule |
| --- | --- |
| Browser application | Core markup/styles/runtime stay in `index.html`; Canvas and draggable windows remain vanilla JS; optional shell client is isolated under `shell/` |
| Corpus payload | `data/zaziopath-graph.js` is generated and committed; update its curation in the builder, not by hand |
| Dependencies | Static graph use and core tests require no npm packages. Optional workstation shell uses pinned xterm/WebSocket packages, optional native `node-pty`, and dev-only jsdom |
| Node tools | Core validator/runtime/audit use Node standard library; `npm test` adds shell/UI suites which skip when optional packages are absent |
| User data | Ingested files, notes, and generated questions stay in tab memory; no browser storage or persistence |
| Inference | Optional local-only Ollama route, exact model `llama3.1:8b`; static Pages/offline lexical fallback must continue to work |

Read [Corpus data and provenance](ZAZIOPATH-CORPUS.md), [Architecture](ARCHITECTURE.md), [API](API.md), and [Testing](TESTING.md) before changing these boundaries.

## 2. Change ownership

| Change | Edit | Then verify |
| --- | --- | --- |
| Add/remove/curate a source concept or fragment | `scripts/build-zaziopath-graph.mjs` | Rebuild against a named Zaziopath revision; review generated diff; `npm test` |
| Change a source excerpt | Builder anchor/locator definitions | Builder must find the anchor; inspect path, locator, excerpt, and status in generated data |
| Change graph rendering/interaction | Graph runtime section in `index.html` | Runtime smoke + browser graph/filter/selection checks |
| Change offline retrieval/Ollama context | `polymathLLM` in `index.html`; local proxy policy in `scripts/serve.mjs` | Test context fields, exact model, failure fallback, and static page behavior |
| Change local ingestion | `processFiles` and extractor in `index.html` | Test local-only read, size/type limit, source link, concept links, duplicate prevention, session reset |
| Change runtime data schema | Builder, validator, runtime, and docs together | `npm test` plus regenerate data from the cited source revision |
| Change SYNAPSE SHELL or its trust gate | `shell/`, `server/`, `scripts/serve.mjs`, `docs/SHELL.md`, `SECURITY.md` | `npm run test:shell`, `npm run test:ui`, and review gate/token behavior |

## 3. Metrics and review

- `index.html`: currently 142,656 bytes and 2,208 lines; audit warns at 160,000 bytes and fails at 192,000 bytes.
- `data/zaziopath-graph.js`: current committed snapshot is 250,159 bytes.
- Committed snapshot: 8 strata, 86 nodes, 117 edges, 15 Grimoire fragments.
- Base physics broad phase: 3,655 node-pair checks per frame, plus 117 spring edges. This is a source-derived estimate, not a browser benchmark.
- Core graph checks, runtime smoke tests, and static audit use no installed dependencies. Shell integration/UI suites skip cleanly without optional packages; install them to exercise the PTY/DOM layers.

A data refresh should be reviewable without running the app: the JS diff includes the source revision, citations, status labels, and relationships. Ask of every new edge: “Which exact source excerpt supports this, or is it visibly marked INFERENCE/SYNTHESIS/OPEN QUESTION?”

## 4. Privacy and threat boundary

Dropped corpus text is read with `FileReader` and held only in live arrays/history for this tab. It is not written to browser storage or the committed graph and is not uploaded for ingestion. If local Ollama is enabled, bounded prompts and short excerpts may be sent to an HTTP loopback endpoint; remote URLs are rejected. SYNAPSE SHELL is different: it is a real, unsandboxed login shell with the launching user's filesystem/network permissions. Scrollback is ephemeral unless SAVE SESSION is explicitly used. The server gates shell/agent routes to loopback by default; a remote token intentionally bypasses that gate. Do not expose the server or Ollama externally.

Model output remains untrusted and is rendered as text. Model-proposed concepts/links are marked INFERENCE and target IDs are allowlisted. The deterministic fallback performs local lexical ranking only; it is not semantic validation.

## 5. Review checklist

Before merging runtime or corpus changes:

1. Preserve the source-derived snapshot, all eight strata, and the single-document Canvas/window core; keep shell code isolated and optional.
2. Run `npm test` and inspect any audit baseline delta; do not refresh the ratchet without reviewing the cause.
3. If source data changed, record the source repository revision and review excerpts/locators and statuses.
4. Test with Ollama absent; graph, Grimoire, simulation, and retrieval must continue working.
5. Test duplicate ingestion and reload; session-local material must not persist or alter committed data.
6. Avoid clinical/diagnostic framing, unsupported source claims, cloud APIs, new models, embeddings, databases, or vector services.
7. If shell code or request routing changed, run the optional PTY/gate and UI-degradation suites and review the unsandboxed-shell disclosure.
