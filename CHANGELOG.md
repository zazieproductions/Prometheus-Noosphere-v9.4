# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The version on the application's
status bar, the version in `package.json` and the git tag are kept in lockstep.

**Scope of a version number here.** NOÖSPHERE // OS has no public API, so SemVer is applied to the
**behaviour and appearance** of the artefact:

| Bump | Meaning |
| --- | --- |
| **Major** | A structural change: the delivery contract, the visual language, or the accessibility posture changes |
| **Minor** | New subsystems, new fidelity, or new engineering guarantees — existing behaviour preserved |
| **Patch** | Corrections: defects from the register fixed, copy corrected, counters made true |

**A note on this repository's history.** The changelog begins at `9.4.1`, the revision at which the
project was published to this repository. Earlier development iterations (`v1`–`v9.3`, spanning
roughly 120 exploratory cycles) were not preserved as discrete commits, so they are summarised
rather than enumerated. Everything from `9.4.1` forward is tracked here and enforced by CI.

---

## [Unreleased]

Nothing yet. The next entry is planned as `9.5.1` — the correctness horizon in
[`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## [9.5.0] — 2026-10-03

**One graph, two renderers — and a real terminal in the workstation.** This revision adds the ultra
visualisation, a second, layered rendering system over the *same* node and edge arrays, and
**SYNAPSE SHELL**, a host terminal available only when NOÖSPHERE is started locally with `npm start`.
It retires four register IDs and clears a fifth from the automated count; the standard atlas is
unchanged in behaviour. ULTRA is a toggle beside it, not a replacement, and the published
single-file artefact keeps its shape — **181,219 bytes, 3,023 lines, one file**, zero installed
dependencies on the static path. Everything the previous `Unreleased` block contained (repository
scaffolding, the documentation set and the hardened dev server) ships here too.

### Added

#### Ultra visualisation mode

- **Ultra visualisation mode** (`RENDER: STANDARD | ULTRA`, hotkey `U`) — a Canvas 2D field composited
  additively over a second canvas in the same viewport, reading the same `graphNodes` / `graphEdges`,
  camera and selection as the standard atlas. Full reference:
  [`docs/ULTRA-VISUALIZATION.md`](docs/ULTRA-VISUALIZATION.md).
  - **Five fields** — `SWARM`, `CONSTELLATION`, `SIGNAL STORM`, `MYCELIAL`, `DREAM` — each a
    parameterisation of the same data: force profile, edge grammar, particle mix, fog density.
  - **Cognitive weather** — a second-order atmosphere derived from the graph every 30 frames
    (excitation, tension, inference, source density, cluster intensity, turbulence) driving fog,
    storm flashes, vignette breathing and traffic spawn rate, with a four-meter HUD readout.
  - **Class grammar** — node halos encode the claim class: source (hexagon), source-backed concept
    (ring), inferred synthesis (dashed ring), newly ingested (expanding birth rings), unresolved
    question (broken ring).
  - **Strata atmospheres** — the eight Zaziopath strata become real regions: aura plumes sized by
    regional intensity, semantic gravity toward the stratum centre of mass, same-stratum swarm
    cohesion, and stratum-hued tendrils in `MYCELIAL`.
  - **Focus as thought-cluster** — selection computes a three-hop relevance map over the real edge
    set: related nodes brighten, unrelated matter dims to 18 % and stops drawing edges, connected
    edges thicken, and the cluster converges while unrelated matter drifts out. The terminal's
    `selectedNode`, the Ollama context and the visual cluster are always the same entity.
  - **Birth events** — ingestion, synthesis and manual authoring enter the field as a shockwave, spark
    burst, weather spike and a halo that settles over ~3 s.
  - **Idle dream state** — after ~11 s without input: slower drift, deeper fog, thinning traffic and a
    periodic *revelation* that lights a high-tension connection and names both endpoints.
  - **Adaptive LOD** — four tiers (`SURVIVAL` → `MAXIMAL`) scale DPR, particle caps, class grammar,
    labels and nebula cadence from a frame-time EMA; a 900-slot reused particle pool, pre-baked glow
    sprites (no `shadowBlur`), a uniform-grid broad phase (`O(n·k)`) and 5 Hz DOM updates bound cost.
  - **Graceful degradation** — no 2D context, a slow device, or `prefers-reduced-motion` all have
    defined behaviour (`SURVIVAL` tier, or `CONSTELLATION` at low turbulence with idle off).
- **Zaziopath structure in the graph model** — `ZAZIOPATH_STRATA` (the vault's eight strata, glyphs and
  Okabe–Ito hues), `NODE_CLASSES`, `STRATUM_OF`, and the seventeen-wire `ZAZIOPATH_WIRES` register
  from § 00c with their published mechanisms. `graphEngine.seedZaziopath()` merges the lattice into the
  live graph — the same arrays the standard renderer draws.
- **Provenance on every node and edge** — `stratum`, `klass`, `provenance {origin, ref, recorded}`,
  `uncertainty`, `activation`, `mass`, plus `strength` / `kind` / `inferred` / `mechanism` on edges.
  Injection now records its origin (file name, combinator directive, operator) and links new nodes to
  their three nearest conceptual neighbours.
- **Derived metrics pass** (`graphMetrics`) — centrality/degree, mass, per-stratum membership,
  centroids and intensity, the weather channels, and the focus relevance map. Recomputed on a cadence
  and on topology change; never stored twice.
- **Behavioural smoke harness** (`scripts/smoke.mjs`, `npm run smoke`, `npm run verify`) — runs the
  runtime inside a dependency-free DOM/Canvas stub and asserts 36 behaviours: boot graph shape, both
  renderers, lattice seeding, submodes, presets, legend, injection, focus relevance, hotkeys, resize
  and the return to STANDARD. Wired into CI beside the audit.
- **Documentation** — this file plus [`ULTRA-VISUALIZATION.md`](docs/ULTRA-VISUALIZATION.md); updates
  across `README.md`, `ARCHITECTURE.md`, `API.md`, `DESIGN.md`, `PERFORMANCE.md`, `TESTING.md`,
  `DECISIONS.md` (ADR-015), `ROADMAP.md`, `ACCESSIBILITY.md` and `MAINTAINABILITY.md`.
- **Also in this revision:** optional localhost Ollama inference for the Polymath terminal (merged
  before this entry) — see [`API.md`](docs/API.md#local-ollama-inference-optional) and
  [`SECURITY.md`](SECURITY.md).

#### SYNAPSE SHELL

- **SYNAPSE SHELL — a real host terminal** (`9.5.0` headline). One process (`npm start`) now bridges
  a genuine PTY into a draggable NOÖSPHERE window:
  `xterm.js ⇄ WebSocket ⇄ node-pty (forkpty) ⇄ $SHELL`, started as a login shell in the repository
  root with the environment of the account that launched it. There is no command allowlist, no
  denylist, no virtual filesystem, no command parsing and no simulated output; `git`, `brew`, `ollama`,
  `ffmpeg`, `python3`, `npm`, `ssh`, `docker`, `sudo`, pipes, redirection, subshells, globbing, job
  control and full-screen TUIs work because nothing intervenes. Documented — including the absence of
  a sandbox — in the new [`docs/SHELL.md`](docs/SHELL.md).
  - **Multiple sessions**: independent PTYs (`SHELL 01`, `SHELL 02`, …) with their own cwd, process
    state, tab, and close/restart controls; live `HOST / SHELL / PTY / PID / CWD / AI` instrumentation
    in the window chrome.
  - **AI SHELL control with three explicit modes.** `OFF` exposes no tool at all (the endpoints 403);
    `ASSIST` lets the local model type a command into the input buffer *without* pressing Enter (the
    newline is stripped, and the loop stops after the first proposal); `AUTONOMOUS` permits a bounded
    agent loop. The mode *is* the authorisation — there are no per-command confirmation dialogs — and
    the current state is unmistakable in the strip, the mode badge and the dock.
  - **Bounded autonomous loop** (`server/agent.mjs`): `reason → one tool call → observe → reason`, with
    user-editable MAX STEPS (≤ 50), MAX RUNTIME, STOP ON ERROR and an output cap. Tools:
    `shell_exec`, `shell_write`, `shell_read`, `shell_cwd`, `shell_interrupt`, `shell_new_session`,
    `shell_close_session`, `finish`. Tool names are validated against that vocabulary before anything
    touches the PTY, and shell/file/web text is returned to the model fenced as *data, not
    instructions*.
  - **Local-only trust boundary, enforced per request** (`server/gate.mjs`): loopback peer + loopback
    `Host` + matching `Origin` + no forwarding headers + `Sec-Fetch-Site`. LAN clients, tunnels,
    remote previews and cross-site pages receive `403` and the window shows `SHELL UNAVAILABLE`; no
    CORS headers are ever emitted. Remote access exists only through an operator-supplied
    `--shell-remote-token`, which is off by default and announced loudly at boot.
  - **Human controls without friction**: NEW SHELL, RESTART, CLEAR, INTERRUPT (^C), KILL PROCESS
    (SIGTERM → SIGKILL over the session tree), COPY OUTPUT, SAVE SESSION, PROCESSES/PORTS panels,
    STOP AGENT. No confirmation dialogs during normal operation.
  - **Zaziopath coupling**: every session receives `$NOOSPHERE_ZAZIOPATH`, so corpus searches, analysis
    scripts, graph rebuilds and report generation run from the terminal against the same corpus the
    rest of NOÖSPHERE reasons about.
  - **Opt-in session logging**: scrollback is an in-memory ring by default; SAVE SESSION writes a
    provenance-headed artefact to `logs/sessions/` (gitignored) only when asked.
- **Behavioural test suites** — `scripts/test-shell.mjs` (29 integration tests against a live server,
  real PTYs and a scripted model stub: shell semantics, UTF-8/ANSI fidelity, Ctrl+C, resize, session
  independence, cwd tracking, restart, orphan-free shutdown, all five gate refusals over HTTP *and*
  the WebSocket upgrade, the OFF/ASSIST/AUTONOMOUS contracts, unknown-tool refusal, MAX STEPS, STOP
  AGENT, process ownership, ports, saving) and `scripts/test-ui.mjs` (5 jsdom tests proving the
  desktop still boots and reports `SYNAPSE SHELL // OFFLINE` when the bridge is absent, remote, or
  PTY-less). Both skip cleanly on a bare checkout; `npm test` now runs audit → shell → UI.
- **Server modules** — `server/shell.mjs` (PTY hub), `server/agent.mjs` (bounded loop),
  `server/routes.mjs` (HTTP + WS + SSE), `server/gate.mjs` (trust boundary), `server/ollama.mjs`
  (local inference client), `server/procinfo.mjs` (process/port visibility).
- **Browser assets** — `shell/synapse-shell.js` and `shell/synapse-shell.css`: the shell window's
  runtime, kept outside `index.html` so the payload budget holds for static-host visitors
  ([ADR-011](docs/DECISIONS.md)).
- **Documentation** — new [`docs/SHELL.md`](docs/SHELL.md); `SECURITY.md` gained the local-workstation
  threat model and the shell boundary; `ARCHITECTURE.md` § 19, `API.md`'s transport reference,
  `TESTING.md` § 2.4–2.5 + § 3.6, `DEPLOYMENT.md`'s local-workstation recipe and ADR-011…014 were
  added in the same change.

#### Repository and documentation set

- **Documentation set** (`docs/`) — a complete engineering dossier:
  - `ARCHITECTURE.md` — runtime topology, engine inventory, data models, the force-simulation
    derivation, camera transform, window manager, extension seams, verified invariants, the full
    defect register, and a glossary translating the interface's vocabulary into engineering terms.
  - `API.md` — every global function and engine method with signatures, side effects and complexity;
    the full DOM contract; the inline handler map; the tooling API.
  - `DESIGN.md` — token system, typography registers, elevation and texture, motion policy, chrome
    grammar, colour-in-motion semantics, voice rules, and the anti-pattern list.
  - `DECISIONS.md` — architecture decision records (`ADR-001`…`ADR-015`) covering single-file
    delivery, the no-build constraint, vanilla JS, Canvas 2D, deterministic content, no persistence,
    ratcheted tooling, the satirical framing, the semantic accent system and direct coupling.
  - `ACCESSIBILITY.md` — a measured WCAG 2.2 AA gap analysis with contrast ratios computed by
    formula, a P0/P1/P2 remediation plan and an explicit list of what remains unverified.
  - `PERFORMANCE.md` — measured payload, modelled frame budget, complexity analysis, a ten-rung
    optimisation ladder, a paste-in profiling harness, and the third-party load-cost measurement gap.
  - `TESTING.md` — the verification strategy, the 21 ratcheted checks and 4 fatal rules, a 32-task
    manual matrix, the audit's blind spots, and the plan for behavioural tests.
  - `DEPLOYMENT.md` — hosting recipes for GitHub Pages, Netlify, Vercel, Cloudflare and S3, the exact
    CSP the current architecture requires (and the hardened one it is heading toward), caching
    policy, a release checklist and rollback procedure.
  - `MAINTAINABILITY.md` — dependency policy, measured code-health metrics, the tunable surface,
    coupling and change-cost analysis, the extraction plan, the risk register and a handover list.
  - `ROADMAP.md` — now / next / later horizons with acceptance criteria, an explicit "not planned"
    section, and a traceability matrix from every register ID to its release.
- **Static integrity audit** (`scripts/audit.mjs`) — dependency-free, ~0.3 s, 21 register checks plus
  four always-fatal DOM contract rules (duplicate ids, dangling `getElementById` references,
  unresolved dock targets, undefined inline handlers). Findings are ratcheted against
  `scripts/audit-baseline.json`: known debt is permitted, new debt fails CI.
- **Zero-dependency dev server** (`scripts/serve.mjs`) — MIME mapping, directory index,
  path-traversal refusal, dotfile blocking, `no-store`, and binding to `0.0.0.0` for containers and
  remote sandboxes.
- **Project files** — `CONTRIBUTING.md` (conventions, commit format, review rubric, recipes),
  `SECURITY.md` (threat model and disclosure policy), `CODE_OF_CONDUCT.md`, `.editorconfig`,
  `.gitignore`, and a rewritten `README.md`.
- **CI and templates** (`.github/`) — an audit workflow, a deployment workflow, issue forms and a PR
  template that asks for the register delta.
- **Doc asset** — an abstract neural-cartography banner for the README (`docs/assets/`).

### Changed

- **Payload budget re-baselined, deliberately** — `SIZE_BUDGET` moves from `96,000 / 128,000 B` to
  `188,000 / 224,000 B`, anchored to the new measured payload with ~5 % warn and ~25 % fail headroom.
  `ROADMAP.md` (9.4.2) had already stated the budget would be re-baselined deliberately in 9.5.0 with
  the reason recorded; the reason is the ultra renderer, which is the largest subsystem in the file
  (~46 kB of ~179 kB). The ratchet against unbounded growth is preserved. See
  [`PERFORMANCE.md` § 8](docs/PERFORMANCE.md#8-guardrails).
- **Both canvases are now device-pixel-ratio scaled** (capped at 2×), with the camera transform kept
  in CSS pixels so the pointer mapping, labels and zoom stay exact. `NOO-014` retired.
- **The graph's initial layout is now seeded** (`mulberry32`) instead of `Math.random()`, so the boot
  graph is reproducible: 90 nodes and 265 edges, twice in a row. `NOO-021` retired.
- **Node-count chrome is truthful** — the status-bar badge matches the spawn count and the boot banner
  reports the live node total. `NOO-010` retired.
- **The alchemy domain gained the filter affordance it never had.** `NOO-011` retired.
- **Graph controls carry ARIA labels** (17 attributes across the toolbar, mode switch, fields, sliders
  and toggles). This is a partial answer to `NOO-016`: the audit's heuristic clears when any semantics
  exist, but the deeper P1 items (live regions, region semantics, modal focus) remain open and are
  still tracked in [`ACCESSIBILITY.md` § 8](docs/ACCESSIBILITY.md#8-remediation-plan).
- `package.json` version → `9.5.0`; the status-bar label follows. CI now runs the smoke harness after
  the audit.

- **`scripts/serve.mjs`** is now the local workstation server rather than a bare static server: it
  keeps the existing static behaviour and inference proxy, and adds vendor assets (`/vendor/xterm.*`
  from `node_modules`), the PTY bridge (`/api/shell/*`, `/ws/shell`), the agent endpoint
  (`/api/noosphere/agent/*`) and shutdown that reaps every spawned PTY. The previous zero-dependency
  promise still holds for the static path: without `npm install` the server starts, serves and
  reports `SYNAPSE SHELL // OFFLINE`.
- **`package.json`** — added the shell's pinned dependencies (`@xterm/xterm` 6.0.0,
  `@xterm/addon-fit` 0.11.0, `ws` 8.22.0), `node-pty` 1.1.0 as an **optional** dependency (see
  [ADR-012](docs/DECISIONS.md)), `jsdom` as dev-only, and new scripts (`start:no-shell`, `test:shell`,
  `test:ui`; `npm test` now runs all three suites).
- **`index.html`** — added the eighth window (`#win-shell`, chrome only), its dock launcher, the
  window in the grid-realignment defaults, and two asset tags. The shell's runtime is external, so the
  document's growth is dominated by the ultra renderer — **181,219 B, under the re-baselined 188,000 B
  warn threshold**. Every existing window contract, id and handler is unchanged.
- **Documentation** — README, ARCHITECTURE, API, SECURITY, TESTING, DEPLOYMENT and DECISIONS updated
  for the new subsystem; `docs/SHELL.md` added.
- **`scripts/audit-baseline.json`** refreshed: `NOO-007` (unescaped `innerHTML` interpolation) had
  already dropped from 4 to 2 sites in `index.html` before this change, and the baseline was stale.
  The ratchet is tightened rather than left as unearned headroom.

### Fixed

- `NOO-011` — domain without a filter affordance (alchemy).
- `NOO-014` — canvas not device-pixel-ratio scaled (both canvases).
- `NOO-010` — node-count parity drift between chrome and engine (both directions).
- `NOO-021` — RNG unseeded; the layout is now reproducible per run.
- `NOO-007` — reduced from 4 to 2 as the transcript and ingestion paths were refactored to write text
  nodes; the remaining two sinks are tracked.

### Notes

- **Selection behaviour is preserved and extended.** A click still appends the inspection line, sets
  `polymathLLM.selectedNode` and fires `node-deepdive`; it now also opens the field's local cluster.
  Clicking empty canvas clears the field focus and leaves the terminal's context untouched.
- **Ultra mode seeds the Zaziopath lattice on first entry** (announced in the transcript). The 38
  extra nodes live in the same arrays, so STANDARD draws them too after the seed.
- **The graph simulation is still `O(n²)` in STANDARD** (`NOO-015`); the ultra field uses a uniform
  grid. `NOO-020` (frame-rate-dependent integration) is unchanged in the standard integrator.
- Deep links, hashes and persistence: still none, by [ADR-006](docs/DECISIONS.md#adr-006--no-persistence-no-backend).

- **The published artefact's behaviour is preserved.** `index.html` gained one window's chrome, its
  dock launcher, an entry in the grid-realignment defaults and two asset tags; every existing
  engine, id, handler and window contract is unchanged. The shell's runtime is external
  ([ADR-011](docs/DECISIONS.md)) and inert on a static host, where the window reports
  `SHELL UNAVAILABLE`.
- **SYNAPSE SHELL is not sandboxed** — deliberately, and by design
  ([ADR-013](docs/DECISIONS.md)). It runs with your account's authority because that is what a
  terminal is. The boundary is the network, not the filesystem: read
  [`SECURITY.md` § 4](SECURITY.md#4--the-local-shell-is-not-sandboxed-docsshellmd) and
  [`docs/SHELL.md`](docs/SHELL.md) before exposing the bridge to anything but `localhost`.
- **`AUTONOMOUS` is off by default, never persisted, and revocable without the model's
  cooperation** (STOP AGENT / INTERRUPT / KILL PROCESS / RESTART). It is an authorisation you grant,
  not one the model can claim ([ADR-014](docs/DECISIONS.md)).
- **The register is the canonical record of known defects** — **16 tracked IDs across 30 findings**
  after this release retired `NOO-010`/`NOO-011`/`NOO-014`/`NOO-021` and cleared `NOO-016` from the
  automated count. Items are scheduled in `ROADMAP.md`; severe items (`NOO-001`, `NOO-007`,
  `NOO-016`, `NOO-019`) are prioritised in `9.5.1` and `9.6.0`, and the `9.5.0` shell added no
  register IDs.

---

## [9.4.1] — 2026-10-02

The published revision at this tag: a single-document browser desktop of seven windowed subsystems over
ten client-side engines. Total delivery: **88,649 bytes, 1,477 lines, one file, zero installed
dependencies, zero build steps, zero network calls from the runtime.**

### Added

- **Window manager** — seven draggable, overlappable windows sharing one shell: focus z-ordering,
  minimise/restore, maximise with geometry snapshot, grid realignment, and a dock for six of the
  seven.
- **Neural Vault** — Canvas 2D force-directed atlas: 90 nodes across five semantic domains, ≈270
  procedural edges, pairwise repulsion with a 260 px cutoff, Hooke springs, centre gravity, damped
  integration, pan/zoom camera with level-of-detail labels, hover inspection HUD, and domain filtering.
- **Synapse-X** — a role-typed terminal over a template-composition engine: 5 openings × 5 tenets ×
  4 ordered pairs × 4 fixed actions ≈ 29,100 surface variations, four preset directives, and
  deterministic node deep-dives.
- **Ingestion Vector** — drag-and-drop and file-picker ingestion with `FileReader` tokenisation,
  keyword-derived node titles, live graph augmentation and an artefact feed.
- **Memetic Contagion** — analytics viewport with derived gauges, an SVG radar plot, a 1 Hz system
  clock and simulated telemetry drift.
- **Aesthetic Hexonomy & Sound Lab** — five curated vector palettes with clipboard export as CSS
  custom properties, plus Web Audio oscillator synthesis at 432/528/40 Hz.
- **Grimoire** — a searchable fragment corpus with substring matching across titles, bodies and tags,
  dispatching fragments into the terminal.
- **Hyper-Idea Combinator** — dialectical cross-product of two domain vectors producing a synthesised
  axiom that is injected into the graph.
- **Quick-injection modal** — manual authoring of graph nodes with cluster selection.
- **Aesthetic system** — a four-step near-black surface ramp, six semantically assigned accents,
  three type registers (Cinzel / Syne / JetBrains Mono), CRT scanline overlay, glass panels and a
  neon elevation vocabulary.

### Known issues

The full register — 21 IDs, 38 findings, severity-classified with remediation notes — is maintained
in [`docs/ARCHITECTURE.md` § 17](docs/ARCHITECTURE.md#17-defect-register) and enforced by
`npm test`. The most significant at this revision:

- `NOO-001` — six utilities reference an undefined Tailwind colour family (`crimson-*`), silently
  dropping borders.
- `NOO-007` — four `innerHTML` sinks interpolate prompt text and dropped filenames without escaping.
- `NOO-016` — the interface has no accessibility semantics: zero `aria-*`, `role` or `tabindex`
  attributes, and 14 icon-only buttons with no accessible name.
- `NOO-019` — the default window layout spans 1760 × 880 px; the synthesizer window is unreachable
  on any viewport narrower than ~1500 px and has no dock entry.
- `NOO-014` / `NOO-015` / `NOO-020` — the canvas is not HiDPI-scaled, the physics broad phase is
  `O(n²)`, and the integrator is frame-rate dependent.

### Notes

- **This is satirical fiction presented as critical design.** The "Polymath LLM" is a template
  composer, not a model; the telemetry is synthetic; the corpus is a critique of growth-hacking
  language and is not advice. See [`README.md` § What this is not](README.md#what-this-is-not).
- No analytics, no cookies, no persistence, no uploads. Ingested files never leave the tab.

---

## Pre-`9.4.x` summary

The version lineage `v1`–`v9.3` was the exploratory phase of the project: iterating on the CRT/terminal
aesthetic, discovering the ten-engine decomposition, and testing how much of a desktop metaphor is
legible inside one document. Those iterations are reflected in the 9.4.1 artefact (for example, the
procedural `[v{n}.0]` node generations are a nod to that lineage) but are not reconstructed here,
because a changelog that invents detail is worse than one that begins honestly.

---

<div align="center">
<sub><a href="https://keepachangelog.com/en/1.1.0/">Keep a Changelog</a> · <a href="https://semver.org/spec/v2.0.0.html">Semantic Versioning</a></sub>
</div>
