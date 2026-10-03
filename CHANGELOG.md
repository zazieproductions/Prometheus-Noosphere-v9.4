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

The local-workstation release. The single-file artefact keeps its shape — **95,308 bytes, 1,571
lines, one file**, zero installed dependencies on the published path — and gains **SYNAPSE SHELL**:
a real host terminal, available only when NOÖSPHERE is started locally with `npm start`. Everything
the previous `Unreleased` block contained (repository scaffolding, documentation and the hardened
dev server) ships here too.

### Added

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
- **Documentation set** (`docs/`) — a complete engineering dossier:
  - `ARCHITECTURE.md` — runtime topology, ten-engine inventory, data models, the force-simulation
    derivation, camera transform, window manager, extension seams, verified invariants, the full
    defect register, and a glossary translating the interface's vocabulary into engineering terms.
  - `API.md` — every global function and engine method with signatures, side effects and complexity;
    the 42-element DOM contract; the inline handler map; the tooling API.
  - `DESIGN.md` — token system, typography registers, elevation and texture, motion policy, chrome
    grammar, colour-in-motion semantics, voice rules, and the anti-pattern list.
  - `DECISIONS.md` — ten architecture decision records (`ADR-001`…`ADR-010`) covering single-file
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
  window in the grid-realignment defaults, and two asset tags (95,308 B, still under the 96,000 B warn
  threshold). Every existing window contract, id and handler is unchanged.
- **Documentation** — README, ARCHITECTURE, API, SECURITY, TESTING, DEPLOYMENT and DECISIONS updated
  for the new subsystem; `docs/SHELL.md` added.
- **`scripts/audit-baseline.json`** refreshed: `NOO-007` (unescaped `innerHTML` interpolation) had
  already dropped from 4 to 2 sites in `index.html` before this change, and the baseline was stale.
  The ratchet is tightened rather than left as unearned headroom.

### Notes

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
- **The register is the canonical record of known defects** — 21 IDs across 36 findings. Items are
  scheduled in `ROADMAP.md`; severe items (`NOO-001`, `NOO-007`, `NOO-016`, `NOO-019`) are
  prioritised in `9.5.1` and `9.6.0`, and the `9.5.0` shell added no register IDs.

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
