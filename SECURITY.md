# Security and privacy

> Threat model for the committed Zaziopath corpus, session-local ingestion, optional loopback Ollama inference, and SYNAPSE SHELL.

## Supported versions

| Version | Support |
| --- | --- |
| Current working tree / `9.5.x` | Security corrections and source/provenance updates |
| Earlier untagged prototypes | Not distributed |

The published application is a static UI (`index.html`, `data/zaziopath-graph.js`, and the shell's graceful-degradation assets). `scripts/serve.mjs` optionally adds local Ollama inference and SYNAPSE SHELL. Static hosting does not provide either service.

## Data and network boundaries

| Data/flow | Behavior |
| --- | --- |
| Committed corpus | Served from the same origin; the browser does not crawl or fetch Zaziopath at runtime |
| CDN presentation assets | Existing Tailwind, Lucide, and Google Fonts requests are third-party requests; URLs are not all pinned |
| Optional status check | Best-effort same-origin request; static hosts or unavailable services fall back without blocking the corpus UI |
| Normal graph/terminal use | Deterministic retrieval operates on committed records in browser memory; no cloud LLM, database, or vector service |
| Dropped local file | Read by `FileReader`, capped at 2 MB and 500,000 characters; raw files are never uploaded or persisted |
| Optional local inference | Bounded prompt/context—including short local excerpts—goes to the local server and an HTTP loopback Ollama URL. This integration rejects remote/cloud Ollama endpoints and uses only `llama3.1:8b` |
| Corpus/session state | Committed data is read-only at runtime. Session graph nodes, notes, selections, and Polymath history are page-memory only and disappear on reload |
| SYNAPSE SHELL | A real local PTY runs as the user who launched the server. Scrollback is in memory by default; SAVE SESSION writes an explicit log under the ignored `logs/sessions/` directory |

The UI discloses that short local-file excerpts can be included in the prompt when local inference is enabled. The full file is not sent. No corpus-ingestion data is written to `localStorage`, cookies, IndexedDB, or Git.

## SYNAPSE SHELL: high-risk local capability

**The shell is not sandboxed.** It inherits the account's permissions and can read/write files, launch programs, access the network, and run commands such as `rm`, `sudo`, `ssh`, or package managers. It is a real login shell, not a restricted command runner. Treat its authority as your own.

- Shell and agent control modes start at **OFF** and are session-memory only. ASSIST proposes without pressing Enter; AUTONOMOUS permits a local model to execute commands within configured step/time limits. Limits reduce runaway loops; they do not sandbox commands or guarantee safe model judgment.
- The host listener binds to `0.0.0.0` for static preview/container access, but shell and agent routes are gated by loopback peer, localhost Host, matching Origin, forwarding-header absence, and fetch-site checks. No CORS access is provided.
- `--shell-remote-token` / `NOOSPHERE_SHELL_REMOTE_TOKEN` is an explicit opt-in that bypasses the local shell gate for a holder of the token. Anyone who can reach the port and obtains that token can control a PTY and possibly the autonomous agent as the launching user. Do not use it on a shared or public network.
- Use `npm run start:no-shell` or `--no-shell` to prevent PTY creation entirely. Static/GitHub Pages deployments have no shell bridge.
- The optional model agent receives bounded terminal output as untrusted data, but prompt-injection defenses cannot guarantee model correctness. Keep AI SHELL OFF unless you intend to grant the selected mode's authority.

Read [docs/SHELL.md](docs/SHELL.md) before enabling SYNAPSE SHELL. The network boundary limits who can reach it; it is not a filesystem or process sandbox. For untrusted commands, use a VM/container outside NOÖSPHERE.

## Trust boundaries

| Boundary | Input | Handling |
| --- | --- | --- |
| Polymath prompt/model response | Arbitrary user and generated text | Rendered via DOM `textContent`/text nodes; generated output is not interpreted as HTML |
| File ingestion | Local file names and text | Text-safe rendering; size/binary checks; bounded extraction and normalized-name deduplication |
| Corpus snapshot | Source titles, excerpts, locators | Text-safe rendering; builder checks source files/anchors; validator checks provenance, IDs, strata, and endpoints |
| Ollama ingestion proposal | Model-generated concept/link JSON | Parsed and bounded; link types/targets allowlisted; proposals remain INFERENCE and never write to committed data |
| Optional local proxy | HTTP paths, prompt, and context | Inference routes require the strict loopback/Origin gate; model fixed to `llama3.1:8b`; Ollama URL is restricted to loopback |
| Shell/agent HTTP and WebSocket routes | Local browser input, PTY data, model tool calls | Shared request gate; fixed agent tool vocabulary, validated modes and bounds, visible execution; no sandbox |
| Static server paths | Request paths and static files | Path containment and dotfile refusal; static pages may be served through previews |
| Third-party scripts | Tailwind and Lucide | Loaded from existing CDN origins; supply-chain risk remains |

## Epistemic/product boundary

Zaziopath is represented as a non-clinical self-analysis archive, creative research instrument, evidence system, recursive notebook, and conceptual laboratory—not a personality-diagnosis engine. A citation shows what a source records; it does not independently validate a source-authored interpretation. Model proposals are INFERENCE; keyword-derived/session-created links are SYNTHESIS; unresolved questions remain OPEN QUESTION. See [Corpus data and provenance](docs/ZAZIOPATH-CORPUS.md).

## Known external risk

The existing CDN URLs are not all pinned, and full styling/icon/font presentation needs a network. The committed source graph and lexical retrieval continue to work without Ollama. SYNAPSE SHELL's optional npm dependencies are supply-chain inputs and its native PTY operates with user authority; only install them when you want the feature and review their pinned versions.

## Verification and reporting

```bash
npm test
npm run validate:graph
npm run test:shell   # runs the real PTY/gate suite when dependencies are installed
```

Report a vulnerability privately through GitHub's **Security → Report a vulnerability**. Include the affected commit, minimal reproduction, impact, and required user action. Do not include private files, terminal transcripts, or secrets in an issue.
