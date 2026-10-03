# Zaziopath corpus data and provenance

The NOÖSPHERE workspace visualizes a **curated snapshot** of the public [Zaziopath repository](https://github.com/zazieproductions/Zaziopath). It is a non-clinical self-analysis archive, creative research instrument, evidence system, recursive notebook, and conceptual laboratory—not a personality-diagnosis engine.

## Committed data and refresh workflow

- `data/zaziopath-graph.js` is the stable browser payload loaded by `index.html`. The committed snapshot identifies source revision `63d99e311c852b9d57ddc29418455f9bb4ba80b1` and contains **8 strata, 86 nodes, 117 cited relationships, and 15 Grimoire fragments**.
- `scripts/build-zaziopath-graph.mjs` is the curation/build source of truth. Edit its stratum, source, concept, wire, and fragment records—not the generated JS.
- Zaziopath is **not** an npm dependency or runtime fetch. A checkout is needed only when a maintainer intentionally refreshes the snapshot.

To refresh from a local clone of Zaziopath:

```bash
git clone --depth 1 https://github.com/zazieproductions/Zaziopath.git /tmp/Zaziopath
node scripts/build-zaziopath-graph.mjs --source /tmp/Zaziopath
npm run validate:graph
npm test
git diff -- data/zaziopath-graph.js
```

The builder resolves every cited file and excerpt anchor, captures bounded excerpts, records the source Git revision, and validates IDs, strata, provenance, relationships, fragments, and normalized concept names before writing the payload. It exits non-zero rather than silently emitting an incomplete snapshot. Text for binary source artifacts is not fabricated: when a PDF is not available as text, the curation cites a source-catalogue/ledger excerpt and labels the relationship as a catalogue reference.

The README's 17 indexed cross-stratum wires and its Shadow → Signal → Stewardship spine are curated before any additional relationships. Source-authored interpretation (for example, “Unexpected Connections”) is recorded as **what that source says**, not as independent validation. The case file's F-05 interpretation remains an INFERENCE; collider candidates are not promoted to source edges without their stated evidence. Unsupported relationships are omitted or marked INFERENCE/SYNTHESIS in session state.

## Epistemic labels

| Label | Meaning in this UI |
| --- | --- |
| **SOURCE** | A cited source document records this wording, artifact identity, claim, or explicitly documented relationship. It does not automatically make a source-authored interpretation objectively true. |
| **INFERENCE** | An interpretation or candidate is explicitly framed as inferential, including the F-05 “after silence, notarize” reading and any local Ollama proposal. |
| **SYNTHESIS** | A bounded curator/runtime comparison or local keyword-derived relationship. It is not an original source fact. |
| **OPEN QUESTION** | An unresolved question preserved as unresolved. Session-created cross-stratum prompts use this status and do not assert the proposed connection. |

The graph uses shape, line style, color, HUD text, and explicit provenance locators to keep these labels visible. Stratum colors identify navigation categories, **not** evidence strength. Local additions receive a green dashed session ring.

## What is committed vs. session-local

**Committed:** the curated JSON-like object in `data/zaziopath-graph.js`, including source identity, stratum, summary, provenance category, source path/locator/excerpt, explicit edges, and Grimoire fragments.

**Session-only:** dropped text and manual/synthesized notes are read with `FileReader` and held only in JavaScript memory for the current page/tab. The app does not write them to `localStorage`, cookies, IndexedDB, or the committed graph; reloading discards them. File content is never uploaded. The runtime limits ingestion to readable text files up to 2 MB and reads at most 500,000 characters; PDF/binary extraction is intentionally not enabled. It deduplicates normalized file/concept names, extracts at most three candidates per file, and links them to their local source record and only to relevant graph nodes. Heuristic relationships are marked SYNTHESIS; Ollama proposals and links are marked INFERENCE.

## Polymath Terminal and offline fallback

With no local model, the terminal remains useful: a deterministic lexical ranker searches graph summaries, tags, source excerpts, and Grimoire fragments. Responses show matching source paths/excerpts and status labels. It does not use embeddings, invent answers, or silently change source data. Selecting a graph node supplies its bounded neighborhood; selecting a Grimoire fragment loads the fragment and highlights its related nodes.

Optional local inference uses **only `llama3.1:8b`** through the Node-standard-library inference proxy and a local Ollama process. Its URL must be HTTP loopback; remote/cloud endpoints are rejected. The request context is bounded and includes selected node/fragment, nearby graph nodes, relevant cited summaries, current stratum, recent terminal history, and short excerpts of up to three ingested files. Inference is optional; API failure switches the terminal and ingestion back to deterministic local retrieval/extraction. The inference routes are loopback-only; do not expose Ollama or the local server to a network. The separate SYNAPSE SHELL workstation bridge uses optional pinned packages and is not needed for corpus browsing.

GitHub Pages and a direct `index.html` open need no Node server or npm packages and remain static/offline-capable for the committed graph, simulation, Grimoire, and fallback retrieval. A static host cannot provide local Ollama inference or the host PTY; the optional shell window reports unavailable without blocking the corpus UI. The CDN-delivered existing UI libraries/fonts still need a network connection for full styling/icon typography; they are not required for corpus integrity or the source data itself.

## Verify

```bash
npm test                      # graph validation + runtime smoke + static audit + optional shell/UI suites
npm run validate:graph        # graph validation only
node scripts/validate-zaziopath-graph.mjs --json
```
