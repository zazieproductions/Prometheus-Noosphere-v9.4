# Testing and verification

> Automated checks validate the committed graph, exercise the inline runtime in a dependency-free VM harness, and optionally integration-test SYNAPSE SHELL. Pixel/browser rendering and local Ollama remain manual checks.

## 1. Commands

```bash
npm test                         # graph validator + runtime smoke + audit + optional shell/UI suites
npm run validate:graph           # committed source graph only
node scripts/validate-zaziopath-graph.mjs --json
node scripts/test-runtime.mjs    # actual inline app code with DOM/canvas stubs
npm run test:shell               # real PTY, gate, routes, agent controls (needs optional deps)
npm run test:ui                  # shell-client degradation/browser-state tests (needs jsdom)
npm run audit:json               # static audit findings/evidence
```

Requirements: Node.js 18 or newer; no build step. Graph validation, runtime smoke, and static audit need no npm packages. Shell/UI suites use the pinned optional packages (`npm install`) and skip with a clear reason when absent. `npm test` does not contact Ollama or the Zaziopath repository.

## 2. Automated coverage

### `scripts/validate-zaziopath-graph.mjs`

Loads the generated `data/zaziopath-graph.js` in an isolated VM and verifies:

- unique strata, node, edge, and Grimoire fragment IDs;
- all eight expected strata and valid stratum references;
- existing edge endpoints and valid relationship/status fields;
- required node/edge/fragment provenance and source excerpts/locators;
- provenance epistemic status/source-backed flags match their records;
- no avoidable duplicate normalized concept names; and
- Grimoire references point to existing nodes.

The build script additionally resolves every source file and anchor before writing the committed snapshot.

### `scripts/test-runtime.mjs`

Executes the actual application inline JavaScript with a small fake DOM/canvas and no browser package. It checks committed count parity, graph boot and initial status, deterministic offline retrieval, bounded/selected Ollama context and inference-failure fallback, rejection of remote/credential/path Ollama URLs, Grimoire search/selection/highlighting, local FileReader ingestion, session graph edges, no network fetch during simulation ingestion, filename/concept deduplication, and duplicate-safe session injection. This is a smoke harness—not a substitute for visual browser checks.

### `scripts/test-shell.mjs` and `scripts/test-ui.mjs`

When their optional dependencies are installed, the shell suite starts the real server and PTYs, then tests session lifecycle, gate refusals, WebSocket behavior, command execution/observation, OFF/ASSIST/AUTONOMOUS contracts, limits, agent stop behavior, process ownership, explicit session saving, and shutdown cleanup. It uses a deterministic local model stub and does not require Ollama. The jsdom UI suite verifies reachable, unavailable, library-missing, and disabled-shell states so the corpus desktop continues to boot when the bridge is absent. If `node-pty`, `ws`, xterm packages, or `jsdom` are unavailable, the scripts report a skip rather than blocking the static/core suite.

### `scripts/audit.mjs`

Runs the static markup/runtime integrity ratchet: DOM IDs and references, inline handler resolution, unsafe tainted `innerHTML` interpolation, CDN/icon/class checks, the graph canvas name/role contract, layout, and known UI debt. The current size budget is 160 KB warning / 192 KB hard failure for `index.html`; the generated corpus stays in a separate data file. See the source audit output for the finding evidence and baseline.

To inspect or intentionally refresh baseline counts:

```bash
npm test
npm run audit:json
npm run audit:baseline
git diff -- scripts/audit-baseline.json
```

Only refresh the baseline when the related regression has been reviewed; do not refresh it merely to hide a failure.

## 3. Browser smoke matrix

Run `npm start` and open `http://localhost:4173`. A browser is not installed in the dependency-free test environment, so complete the rendering checks in a current Chromium, Firefox, or Safari browser before release.

| Area | Check | Expected |
| --- | --- | --- |
| Boot | Load with no Ollama or shell dependencies | All core desktop windows and the optional shell window appear; graph shows the committed Zaziopath snapshot; Polymath says SIMULATION MODE; shell degrades with a clear unavailable state; no uncaught errors |
| Stable graph | Reload several times | Same committed IDs, strata, source relationships, and deterministic initial node arrangement; simulation settles normally |
| Strata | Click each filter and ALL | Only the selected stratum and connected visible edges remain; each button updates its active styling |
| Provenance | Hover representative source, inference, open-question, and source-document nodes | HUD shows status, stratum, source locator/excerpt where available, summary, and relationship labels |
| Selection | Click a graph node | It is highlighted with direct neighbors; bounded source context appears in Polymath; offline response cites path/status |
| Grimoire search | Search `evidence`, `after silence`, `catalog`, `stewardship` | Matching source fragments display their excerpt/status/path/locator |
| Grimoire click | Click a fragment | Fragment loads into terminal context, related graph nodes are highlighted, and no source claim is upgraded |
| Offline terminal | Enter `meta-level addiction`, `evidence over map`, and an unmatched term | Matches include source/provenance information; unmatched query explains the lexical limitation; no Ollama is needed |
| Ingestion | Drop a small `.md`/`.txt` fixture with headings | Browser reads locally; source and at most three candidate nodes get green session rings; source and marked candidate links render |
| Ingestion dedupe | Re-add same filename, then add a second file with a duplicate heading | No duplicate source title/concept node is created; feed identifies skipped/merged candidates |
| Ingestion privacy | Inspect Network tab while Ollama is unavailable | No file content leaves the browser; local fallback issues no inference request |
| Unsupported input | Try PDF/binary or a file larger than 2 MB | Clear rejection; no mojibake/binary-derived graph spam |
| Session boundary | Add a file/note/question, then reload | Private additions and selected ingestion context disappear; committed graph remains unchanged |
| Synthesis | Choose two strata and create a bridge | A green-ringed OPEN QUESTION appears with unresolved links, never a source-backed claim |
| Manual note | Add a question, then add a short concept note | Question is OPEN QUESTION; note is SYNTHESIS; both are session-local and deduplicated |
| Local inference | With local Ollama unavailable | Status remains simulation; graph, Grimoire, ingestion, and fallback work |
| Local inference | With `llama3.1:8b` installed and `ollama serve` running | Terminal uses local model with selected node, nearby graph, cited summaries, fragment, history, and bounded ingestion snippets |
| Local inference failure | Stop Ollama while the page is open, then query | Request failure switches back to simulation/retrieval; committed graph is unchanged |
| Desktop | Drag, minimize/restore, maximize/restore, reset windows | Original draggable window interaction remains usable |
| Shell disabled | Run `npm run start:no-shell`; click SYNAPSE SHELL | Clear PTY-disabled state; all corpus windows and fallback remain usable |
| Shell local | Install optional dependencies, run `npm start`, open `http://localhost:4173` | Local PTY opens; terminal input/output, resize, session switching, interrupt, and close work |
| Shell remote preview | Open the UI through a remote preview or static host | Shell window reports unavailable; no PTY endpoint becomes reachable; rest of UI works |
| AI SHELL | Start in OFF; switch through ASSIST/AUTONOMOUS, then STOP | OFF exposes no agent tools; ASSIST only stages a command; AUTONOMOUS honors the configured limits and human stop |
| Audio | Toggle mute; test tone controls | Toggle updates; plain tones play only after user gesture; no unsupported bio/brain effect is claimed |

## 4. Local Ollama check

Install/start the exact model only if you want inference:

```bash
ollama pull llama3.1:8b     # only if not already present
ollama serve                # separate terminal
npm start                   # repository terminal
```

Then confirm the status badge reads local inference online. The server routes are restricted to loopback; do not expose the server or Ollama. GitHub Pages/direct file open use the same corpus and fallback but cannot connect to the local server.

## 5. What these tests do not prove

- A VM stub does not prove pixel layout, browser Canvas behavior, keyboard usability, CDN availability, or assistive-technology quality.
- Lexical ranking is not semantic search, fact checking, or an embedding system.
- A citation establishes what a source records, not that a source-authored interpretation is objectively true.
- A model response can still be wrong. Local inference is optional; keep generated text/links visibly marked and verify against source excerpts.
- Corpus session-local means page memory only. Closing/reloading the tab discards ingestion and notes; browser persistence/export is deliberately absent. SYNAPSE SHELL is separate and saves scrollback only after the explicit SAVE SESSION action.

The committed-data refresh procedure is documented in [Corpus data and provenance](ZAZIOPATH-CORPUS.md).
