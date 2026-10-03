# Runtime API reference

> Current browser/runtime surfaces for the single-document-core NOÖSPHERE/Zaziopath application and its optional workstation shell.

**Source of truth:** [`index.html`](../index.html), [`data/zaziopath-graph.js`](../data/zaziopath-graph.js), `shell/`, `server/`, and [`scripts/`](../scripts). See [Architecture](ARCHITECTURE.md), [Corpus provenance](ZAZIOPATH-CORPUS.md), and [SYNAPSE SHELL](SHELL.md).

## Runtime map

```text
index.html
  ├─ graphEngine       graph filtering, deterministic layout, highlight, session injection
  ├─ polymathLLM       terminal, bounded context, Ollama, deterministic corpus fallback
  ├─ processFiles      local FileReader ingestion and session graph updates
  ├─ grimoire          committed fragment rendering/search/selection
  ├─ ideaCombinator    session-only cross-stratum OPEN QUESTION
  ├─ paletteGen       existing palette / clipboard UI
  ├─ soundLab         plain Web Audio tone controls
  ├─ window manager    draggable windows, z-order, minimize/maximize/reset
  └─ synapseShell      optional xterm client for a local PTY

data/zaziopath-graph.js → window.ZAZIOPATH_GRAPH
shell/                  → optional SYNAPSE SHELL client assets
server/                 → local PTY, gate, agent and Ollama modules
scripts/serve.mjs       → static server + loopback Ollama + gated shell routes
```

The corpus UI has no build step or npm runtime dependency. The generated dataset is committed and available to GitHub Pages/direct `index.html` use. Local inference is optional, loopback-only, and uses only `llama3.1:8b`. SYNAPSE SHELL is a separate workstation capability with pinned packages; its PTY runs with the launching user's permissions and is not sandboxed.

## Core browser methods

### `graphEngine`

#### `filterStratum(stratumId: string) → void`
Accepts `all` or one of the eight committed stratum IDs. Updates the active button and render filter.

#### `recluster() → void`
Applies a deterministic hash-based displacement to the live node positions. It does not add data or source edges.

#### `toggleLabels() → void`
Toggles Canvas labels.

#### `highlightContext(nodeIds: string[]) → void`
Highlights the supplied valid node IDs and their directly adjacent graph neighbors.

#### `findDuplicateConcept(title: string) → Node | null`
Uses normalized names plus a conservative token similarity check. Source-document and stratum hubs are excluded.

#### `injectNode(spec: SessionNodeSpec) → { node: Node | null, created: boolean, reason?: string }`
Adds a marked session-local node and any valid supplied links. This mutates only the in-memory graph arrays; nothing is stored in the committed dataset or browser storage.

```js
{
  id?: string,
  title: string,
  kind: 'source-document' | 'concept' | 'question' | string,
  stratum: 'index-meta' | 'identity' | 'shadow' | 'signal-evidence' |
           'recursion-lab' | 'stewardship' | 'specimens' | 'mythography',
  epistemic: 'source' | 'inference' | 'synthesis' | 'open-question',
  summary: string,
  tags?: string[],
  sources?: SourceReference[],
  provenance?: { category: string, note?: string },
  links?: Array<{
    targetId: string,
    type: string,
    label: string,
    epistemic: 'source' | 'inference' | 'synthesis' | 'open-question',
    provenance?: { category?: string, note?: string, sourceRefs?: SourceReference[] }
  }>
}
```

A runtime edge with `inference`, `synthesis`, or `open-question` status is styled as such; a model-proposed edge is always INFERENCE. Source-backed runtime additions must carry an actual local source reference and describe only what the file supports.

### `polymathLLM`

#### `setMode(online: boolean) → void`
Sets `inference` or `simulation` and updates the status badges.

#### `checkOllama() → Promise<void>`
Best-effort `GET /api/noosphere/status`. On static hosts, direct file open, or failure, selects simulation mode. The request does not block graph boot.

#### `context(query = '') → object`
Returns bounded JSON containing current stratum, selected node/fragment, up to eight directly related nodes, up to six ranked graph summaries with provenance, up to eight recent history entries, and short snippets from at most three session-local ingested texts.

#### `queryOllama(prompt, context = this.context(prompt)) → Promise<string>`
POSTs to the same-origin local proxy at `/api/noosphere`, sends at most 3,900 prompt characters and the bounded context, and accepts a response only when the returned model is `llama3.1:8b`.

#### `generatePolymathResponse(prompt) → Promise<string>`
Uses local Ollama when status is online. If the request fails, it switches to deterministic lexical graph/Grimoire retrieval and returns cited matches rather than fabricated facts.

#### `appendChat(role, text) → void`
Renders `user`, `system`, or `assistant` entries using text nodes/textContent for user-controlled strings. Keeps at most 12 transcript entries in context history.

#### `runDirective(type, data?) → void`
Recognized types: `trace-sources`, `check-epistemics`, `open-questions`, `cross-stratum`, and `node-deepdive`.

#### Selection state
`selectedNode` and `selectedFragment` determine terminal/LLM context. Clicking a graph node sets the selected node; clicking a Grimoire fragment selects it, selects its first related node when available, and calls `graphEngine.highlightContext` on its related IDs.

### Ingestion globals

#### `handleFileDrop(event) → void` / `handleFileInput(event) → void`
Cancel the drop default or read the picker selection, then call `processFiles`.

#### `processFiles(files: FileList | File[]) → Promise<void>`
Reads text locally with `FileReader`; current bounds are 2 MB per file and 500,000 characters read. It rejects binary-looking input, deduplicates normalized local filenames and candidate names, records an ephemeral source-document node, extracts at most three heading/bold/name/first-line candidates, and connects them only to their provenance record plus keyword-relevant existing graph records. Fallback relations are SYNTHESIS. Local-model proposals and proposed links are INFERENCE and are allowlisted to existing graph node IDs supplied as context. Nothing persists after reload.

PDF/binary extraction is intentionally unsupported. No raw file upload occurs. Only a bounded text excerpt can enter the local Ollama prompt/context when local inference is enabled; no file data is sent to cloud services.

### `grimoire`

- `render(fragments = CORPUS.fragments)` renders committed, source-backed fragment cards with status, stratum, excerpt, and citation.
- `filter(query)` performs local lexical ranking over titles, tags, and source excerpts.
- `select(fragment)` sets selection context, highlights related nodes, and requests a bounded source trace.

### `ideaCombinator.synthesize() → void`
Takes one source-backed record from each selected stratum and creates an OPEN QUESTION in `index-meta` with unresolved edges to the records. It is session-local and explicitly does not assert a cross-stratum relationship.

### Session note/modal methods

`quickInjectModal()` / `closeInjectModal()` control the modal. `injectCustomNodeAction()` stores the user-entered note only in memory, classifies a question as OPEN QUESTION or other note as SYNTHESIS, and labels its placement edge as session synthesis.

### Existing UI methods

`playBeep(freq, waveform, duration, volume)`, `toggleAudio()`, `soundLab.playTone('tone-432' | 'tone-528' | 'tone-40')`, `paletteGen.mutate()`, `paletteGen.copyActive()`, `bringToFront()`, `minimizeWindow(id)`, `maximizeWindow(id)`, `restoreOrFocus(id)`, and `resetWindowPositions()` remain the existing presentation controls.

## Data contract

`window.ZAZIOPATH_GRAPH` has:

```js
{
  version: 1,
  corpus: { name, repository, revision, dataPolicy, epistemicStatuses },
  strata: Stratum[],
  nodes: Node[],
  edges: Edge[],
  fragments: Fragment[]
}
```

A committed `Node` has stable string identity, stratum/kind/status, summary/tags, a provenance category and one or more source references. A committed `Edge` has stable string `source` and `target` IDs; the runtime maps them to numeric array indices but preserves `sourceId`/`targetId` for inspection. A `Fragment` has a source excerpt and related node IDs. Runtime additions have `localSession: true` and are never written to this object.

The source builder/validator are documented in [`ZAZIOPATH-CORPUS.md`](ZAZIOPATH-CORPUS.md); validation checks duplicate IDs, dangling endpoints, provenance, strata, epistemic labels, and normalized duplicate concept titles.

## Optional local API (`scripts/serve.mjs`)

The local Node server serves the application and implements two loopback-only inference routes; the static corpus path also runs without installed packages:

| Route | Request | Response |
| --- | --- | --- |
| `GET /api/noosphere/status` | no body | `{ online: boolean, model: 'llama3.1:8b' }` |
| `POST /api/noosphere` | `{ prompt: string, context: object }` | `{ response: string, model: 'llama3.1:8b' }` |

It checks that the exact model is already installed via Ollama `/api/tags`, then proxies to `http://127.0.0.1:11434/api/chat`. Routes are restricted to loopback client/Host/Origin and return JSON errors if the model is unavailable. Static hosting has no local API, but all offline/fallback functionality continues to work.

## SYNAPSE SHELL transport API

SYNAPSE SHELL is available only when served by the optional local workstation bridge. Its PTY routes and WebSocket are guarded by the local request gate; the default trust boundary requires a loopback peer, localhost Host, matching Origin, no forwarding headers, and same-origin fetch metadata. The operator-supplied remote token is a dangerous explicit bypass. Full route/frame schemas and control semantics are in [SHELL.md](SHELL.md).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/shell/status` | Host, PTY availability, sessions, model availability, and AI mode |
| `GET` / `POST` | `/api/shell/sessions` | List or create PTY sessions |
| `POST` | `/api/shell/ai` | Read/change AI SHELL mode and bounded agent limits |
| `POST` | `/api/noosphere/agent/run` | Start a bounded SSE-streamed local agent run; unavailable in OFF mode |
| `POST` | `/api/noosphere/agent/stop` | Stop an active run and interrupt its session |
| WebSocket | `/ws/shell` | Attach terminal input/output to a local PTY session |

These routes grant access to a real, unsandboxed shell as the server's user; the default is local-only and AI SHELL starts OFF. Use `npm run start:no-shell` to prevent PTY creation. Static hosts have no bridge and continue to use the corpus UI only.

## Commands

```bash
npm start                         # http://localhost:4173; Node.js >= 18
npm test                         # graph validation + runtime smoke + static audit + optional shell/UI tests
npm run validate:graph            # validate only the committed graph
npm run audit:json                # static-audit JSON
node scripts/build-zaziopath-graph.mjs --source /path/to/Zaziopath
```
