# Maintainability

> Stewardship notes for the zero-build NOÖSPHERE/Zaziopath runtime and its committed corpus snapshot.

## 1. Maintainer contract

| Area | Current rule |
| --- | --- |
| Browser application | Markup/styles/runtime stay in `index.html`; Canvas and draggable windows remain vanilla JS |
| Corpus payload | `data/zaziopath-graph.js` is generated and committed; update its curation in the builder, not by hand |
| Dependencies | No npm runtime or test dependencies. Existing Tailwind/Lucide/font assets remain CDN-served |
| Node tools | Node standard library only; `npm test` runs graph validation, a DOM/canvas-stub runtime smoke, and static audit |
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

## 3. Metrics and review

- `index.html`: currently 140,094 bytes and 2,179 lines; audit warns at 160,000 bytes and fails at 192,000 bytes.
- `data/zaziopath-graph.js`: current committed snapshot is 250,159 bytes.
- Committed snapshot: 8 strata, 86 nodes, 117 edges, 15 Grimoire fragments.
- Base physics broad phase: 3,655 node-pair checks per frame, plus 117 spring edges. This is a source-derived estimate, not a browser benchmark.
- Tools and tests use no installed dependencies. Run `npm test` from a clean checkout.

A data refresh should be reviewable without running the app: the JS diff includes the source revision, citations, status labels, and relationships. Ask of every new edge: “Which exact source excerpt supports this, or is it visibly marked INFERENCE/SYNTHESIS/OPEN QUESTION?”

## 4. Privacy and threat boundary

Dropped text is read with `FileReader` and held only in live arrays/history for this tab. It is not written to `localStorage`, IndexedDB, cookies, or Git. It is never uploaded. If local Ollama is enabled, a bounded prompt and short excerpts may be sent through `scripts/serve.mjs` to local `127.0.0.1:11434`; the proxy restricts inference routes to loopback clients/Host/Origin. Do not expose Ollama or the development server externally. Static hosting never provides this proxy.

Model output remains untrusted and is rendered as text. Model-proposed concepts/links are marked INFERENCE and target IDs are allowlisted. The deterministic fallback performs local lexical ranking only; it is not semantic validation.

## 5. Review checklist

Before merging runtime or corpus changes:

1. Preserve the source-derived snapshot, all eight strata, and the single-document Canvas/window design.
2. Run `npm test` and inspect any audit baseline delta; do not refresh the ratchet without reviewing the cause.
3. If source data changed, record the source repository revision and review excerpts/locators and statuses.
4. Test with Ollama absent; graph, Grimoire, simulation, and retrieval must continue working.
5. Test duplicate ingestion and reload; session-local material must not persist or alter committed data.
6. Avoid clinical/diagnostic framing, unsupported source claims, cloud APIs, new models, embeddings, databases, or vector services.
