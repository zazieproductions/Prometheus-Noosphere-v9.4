# Security and privacy

> Threat model for the static Zaziopath corpus UI, session-local file ingestion, and optional loopback-only Ollama integration.

## Supported versions

| Version | Support |
| --- | --- |
| Current working tree / `9.4.x` | Security corrections and source/provenance updates |
| Earlier untagged prototypes | Not distributed |

The application is a single `index.html` runtime plus the required committed `data/zaziopath-graph.js` snapshot. GitHub Pages/direct-file use is static. `scripts/serve.mjs` is a zero-dependency development server that also offers optional local inference routes.

## Data and network boundaries

| Data/flow | Behavior |
| --- | --- |
| Committed corpus | Served from the same origin; the browser does not crawl or download Zaziopath at runtime |
| CDN presentation assets | Existing Tailwind, Lucide, and Google Fonts requests occur when the page loads; these are third-party dependencies |
| Optional status check | The browser makes a best-effort same-origin `GET /api/noosphere/status`; static hosting returns no local model and the client stays in simulation mode |
| Normal graph/terminal use | Deterministic retrieval operates on committed records in browser memory; no remote LLM, cloud API, database, or vector service |
| Dropped local file | Read by `FileReader`, capped at 2 MB and 500,000 characters; raw files are never uploaded or persisted |
| Optional local inference | If enabled, bounded prompt/context—including short local excerpts—goes to the local Node proxy and then `127.0.0.1:11434` (Ollama). It does not go to a cloud service through this integration |
| Runtime additions | Session graph nodes, notes, selections, and terminal history exist only in page memory and disappear on reload |

The UI explicitly notes that limited local excerpts are included in a prompt when local Ollama is enabled. The full file is not sent; no data is written to localStorage, cookies, IndexedDB, or Git.

## Trust boundaries

| Boundary | Input | Handling |
| --- | --- | --- |
| Terminal prompt/model response | Arbitrary user text and generated text | Rendered via DOM `textContent`/text nodes; generated output is not interpreted as HTML |
| File ingestion | File name and text | Names/excerpts are displayed with `textContent`; parser rejects large/binary-looking files; concepts are bounded and deduplicated |
| Corpus snapshot | Source-derived titles, excerpts, and locators | Rendered as text; builder checks source files/anchors; validator checks provenance, IDs, strata, and endpoints |
| Ollama proposal | Model-generated concept/link JSON | Parsed and bounded; link types/targets allowlisted; status always INFERENCE; never silently written to committed data |
| Optional proxy | HTTP path, prompt, and context | Inference routes require a loopback client, localhost Host, and matching Origin; only `llama3.1:8b` is queried |
| CDN scripts | Tailwind and Lucide code | Loaded from existing third-party origins; pinning/self-hosting remains a supply-chain improvement |

The Node server binds static files on `0.0.0.0` for local/container/preview convenience, but the inference routes reject non-loopback clients. Do not expose Ollama or the development server to untrusted networks.

## Epistemic/product boundary

Zaziopath is represented as a non-clinical self-analysis archive, creative research instrument, evidence system, recursive notebook, and conceptual laboratory—not a personality-diagnosis engine. A citation shows what a source records; it does not independently validate a source-authored interpretation. Model proposals are INFERENCE; keyword-derived/session-created links are SYNTHESIS; unresolved questions remain OPEN QUESTION. See [Corpus data and provenance](docs/ZAZIOPATH-CORPUS.md).

## Known external risk

The existing CDN URLs are not all pinned, and the browser needs network access for the full styling/icon/font experience. The committed source graph and offline retrieval continue to work without Ollama; the CDN supply-chain risk remains tracked by the static audit (`NOO-008`). Do not treat the source excerpt/model output as verified facts without reading its provenance.

## Verification and reporting

```bash
npm test
npm run validate:graph
```

Report a vulnerability privately through GitHub's **Security → Report a vulnerability**. Include the affected commit, minimal reproduction, impact, and whether a user must first take an action (for example, drop a file or enable local inference). Do not include private files or secrets in an issue.
