# Architecture

> Runtime topology, source-data model, algorithms, privacy boundaries, and extension seams for the Zaziopath edition of **NOÖSPHERE // OS**.

## 1. Purpose and constraints

NOÖSPHERE remains a browser-resident, CRT-styled desktop built around a single application document. `index.html` owns the markup, styles, and vanilla JavaScript runtime; the committed `data/zaziopath-graph.js` file is the generated source-data sidecar required to keep the initial graph stable and auditable. There is no build step, framework, package dependency, database, or vector service.

The existing draggable windows, Canvas 2D force renderer, terminal, file-ingestion UI, searchable Grimoire, sound controls, and visual language are retained. The graph and corpus work in a browser without Ollama. `scripts/serve.mjs` is optional: it serves static files and, when run on the developer's machine, exposes a loopback-only proxy to local Ollama.

Zaziopath is framed as a non-clinical self-analysis archive, creative research instrument, evidence system, recursive notebook, and conceptual laboratory—not a personality diagnosis engine.

## 2. Runtime and data flow

```text
index.html
  ├─ existing CDN presentation assets (Tailwind Play, Lucide, fonts)
  ├─ data/zaziopath-graph.js  → window.ZAZIOPATH_GRAPH (committed snapshot)
  └─ inline vanilla runtime
       ├─ window manager / sound
       ├─ graphEngine      → Canvas simulation + session-only graph extension
       ├─ polymathLLM     → bounded context + local Ollama or offline retrieval
       ├─ ingestion        → FileReader + dedupe + session-only candidate nodes
       ├─ paletteGen       → existing palette/swatch controls
       ├─ grimoire         → committed source-fragment search and selection
       └─ ideaCombinator   → explicit session-local OPEN QUESTION generation

scripts/build-zaziopath-graph.mjs → generated data/zaziopath-graph.js
scripts/validate-zaziopath-graph.mjs → committed graph integrity checks
scripts/serve.mjs                 → static server + optional loopback-only Ollama proxy
```

No browser-side repository crawl occurs. GitHub Pages only serves the committed snapshot; it does not contact Zaziopath at runtime. The app makes a best-effort same-origin status request for the optional local API, catches failure, and stays in simulation mode. Dropped file contents are not sent to a server. When local inference is explicitly available, bounded prompt/context text is sent only through the local server to Ollama on `127.0.0.1:11434`.

## 3. Corpus snapshot and strata

`data/zaziopath-graph.js` records the source repository URL and revision (`63d99e311c852b9d57ddc29418455f9bb4ba80b1`). Current committed counts are 8 strata, 86 nodes, 117 relationships, and 15 Grimoire fragments. The static validator derives those counts from the file and checks referential integrity; see [Corpus data and provenance](ZAZIOPATH-CORPUS.md).

| ID | Stratum | Source color |
| --- | --- | --- |
| `index-meta` | INDEX / META | `#231F20` |
| `identity` | IDENTITY | `#0072B2` |
| `shadow` | SHADOW | `#CC79A7` |
| `signal-evidence` | SIGNAL / EVIDENCE | `#E69F00` |
| `recursion-lab` | RECURSION LAB | `#009E73` |
| `stewardship` | STEWARDSHIP | `#56B4E9` |
| `specimens` | SPECIMENS | `#D55E00` |
| `mythography` | MYTHOGRAPHY | `#F0E442` |

The runtime uses accessible/neon variants of those source colors for display. Color is a navigation key, never a confidence or evidence-strength score.

## 4. Epistemic and provenance model

### 4.1 Static node records

The generated node objects include a stable `id`, `title`, `stratum`, `kind`, `epistemic`, `summary`, `tags`, `provenance`, `sources`, and related file names. Each source reference preserves a repository path, section, locator, role, and bounded excerpt when source text is available. Binary artifacts are identified without fabricating a direct quote; catalogue/ledger citations are used and labeled when they are the available evidence.

### 4.2 Static relationships

Generated edges use stable IDs, source/target node IDs, a relationship `type` and `label`, an epistemic status, and source-reference provenance. The README's explicit indexed wires and the declared Shadow → Signal → Stewardship method spine are represented before additional explicitly documented relationships. An edge marked SOURCE means that the cited record documents that relation or interpretation; it is not independent proof that an interpretation is objectively true.

The current committed graph contains source-backed edges. Source-level INFERENCE and OPEN QUESTION statuses are represented on nodes and fragments; session-generated SYNTHESIS and model-generated INFERENCE relationships are created only at runtime and are never written back to the snapshot.

### 4.3 Visible labels

| Status | Representation |
| --- | --- |
| SOURCE | Solid relationship line; source/document form; cited path, locator, excerpt in the HUD |
| INFERENCE | Amber/dashed relationship; diamond node; explicit provenance label |
| SYNTHESIS | Cyan/dashed relationship; diamond node; runtime/candidate provenance |
| OPEN QUESTION | Yellow status and hexagonal node; unresolved wording is preserved |
| Session-local | Green dashed outer ring; disappears on reload |

A source-authored interpretation stays attributed to its authoring record. F-05 “after silence, notarize” remains INFERENCE; collider candidates are not silently wired into source truth.

## 5. Boot sequence

1. The generated data script assigns `window.ZAZIOPATH_GRAPH` before the inline application runtime executes.
2. The runtime builds `graphNodeById`, copies the committed nodes into simulation records, and converts edge IDs to numeric array indices for force calculations.
3. Node positions are deterministically seeded from stable IDs and stratum/group order. No `Math.random()` is used for the boot graph.
4. Counts and analytics derive from committed records; the canvas is sized and the animation loop begins on `DOMContentLoaded`.
5. Grimoire cards render from `CORPUS.fragments`; the terminal begins in simulation mode and checks the optional local inference endpoint.
6. If no endpoint/model exists—or an inference request fails—the status remains or returns to local lexical retrieval.

The force simulation remains dynamic after boot; deterministic means a stable initial layout/graph state, not a frozen screenshot.

## 6. Canvas force simulation and interaction

`graphNodes` and `graphEdges` are the live runtime arrays. `updatePhysics()` applies pairwise repulsion, edge springs, centre gravity, and damping once per animation frame; at the current 86-node committed graph the broad phase performs 3,655 node-pair checks per frame, plus edge integration. Session ingestion adds only a few candidate nodes per file. The existing no-library Canvas 2D renderer handles edge/node styling, hover inspection, labels, pan/zoom, and stratum filters.

Initial coordinates use a deterministic string hash of node IDs and fixed stratum centres. `graphEngine.recluster()` uses the same deterministic hash with an incremented recluster counter; it does not invent nodes or source relationships. `highlightContext(ids)` highlights selected nodes and their directly related graph neighbors.

A hovered node shows its stratum, SOURCE/INFERENCE/SYNTHESIS/OPEN QUESTION label, summary, best available citation/excerpt, and relationship labels. Clicking selects it and loads a bounded Polymath context.

## 7. Polymath Terminal and offline retrieval

`polymathLLM.context(query)` creates a bounded request object containing:

- current filter/stratum;
- selected node and up to eight adjacent relationship records;
- up to six ranked graph summaries with epistemic labels and source references;
- selected Grimoire fragment and its related nodes/source excerpts;
- up to eight recent transcript entries; and
- short text snippets from up to three locally ingested files.

The local path uses only `llama3.1:8b`. It never pulls or selects a different model. The local system prompt explicitly treats Zaziopath as non-clinical, requests source paths, preserves epistemic status, and forbids silently promoting source interpretations or generated links.

When Ollama is unavailable, a deterministic lexical ranker searches titles, summaries, tags, source excerpts, and fragments. It returns bounded matches, citations, excerpts, and links without claiming semantic embeddings or inventing a source answer. Selecting a Grimoire card sets fragment context, selects the first linked graph node when available, and highlights the related graph neighborhood.

## 8. Local ingestion and session memory

`processFiles(files)` reads supported text locally with `FileReader.readAsText`. It caps files at 2 MB and stored text at 500,000 characters; binary/PDF extraction is intentionally unsupported. A lightweight extractor favors Markdown headings, bold phrases, and a useful filename/first-line fallback, with no more than three candidates per file.

A normalized-name check and session fingerprint prevent repeat file/concept nodes. Each accepted file receives a green-ringed local source-document record. Candidate concepts link to that file; additional graph links are added only when bounded token overlap identifies plausible records. Heuristic relations are marked SYNTHESIS. If local Ollama proposes concepts or links, they are marked INFERENCE and links are allowlisted to IDs in the supplied graph context. No new data is persisted to the committed corpus, browser storage, or a remote endpoint. Reloading drops the session graph and ingested context.

The UI tells the user that selected graph/fragment/history context and short ingestion excerpts may be sent to local Ollama when that feature is enabled. The raw file and full text are not sent; only bounded excerpts appear in the prompt context. The development server restricts inference API routes to loopback Host/Origin/client addresses. Do not expose Ollama or the proxy externally.

## 9. Cross-stratum synthesis and manual notes

The synthesis panel chooses source-backed records from two selected strata and creates a session-local OPEN QUESTION asking what evidence would establish or falsify a link. It adds explicitly labeled unresolved/question edges to the two records; it does not claim that a relationship exists. Manual notes are session-local SYNTHESIS or OPEN QUESTION records, marked by the same green ring and linked only to the user-selected stratum as a synthesis placement.

## 10. Validation and extension points

```bash
npm test                         # graph validator + runtime smoke + static audit
npm run validate:graph
node scripts/validate-zaziopath-graph.mjs --json
```

The validator checks duplicate IDs, missing edge endpoints, required provenance and excerpts, valid strata/statuses, normalized duplicate concept titles, and fragment links. The builder validates source files and excerpt anchors before generating data. Static UI checks remain in `scripts/audit.mjs`.

**Safe extension rules:**

1. Add committed source material by editing the curated definitions in `scripts/build-zaziopath-graph.mjs`, then regenerate from the cited source revision.
2. Keep every source relationship traceable to its cited excerpt. If evidence is interpretive, label it INFERENCE/SYNTHESIS or leave it OPEN QUESTION.
3. Keep private user additions in runtime memory only unless a separately reviewed product decision changes the privacy model.
4. Keep the Canvas renderer and single-document application runtime; do not add a framework, vector database, embedding, API key, or cloud dependency.
