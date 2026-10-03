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

Nothing yet.

---

## [9.5.0] — 2026-10-03

The merged release combines the source-backed Zaziopath corpus with the optional SYNAPSE SHELL
workstation extension. The application remains zero-build and statically hostable; host-shell access
is an opt-in local capability, not a requirement for the corpus UI.

### Added

- **Committed Zaziopath source snapshot** (`data/zaziopath-graph.js`): 8 strata, 86 source-derived
  nodes, 117 cited relationships, and 15 searchable Grimoire fragments at source revision
  `63d99e311c852b9d57ddc29418455f9bb4ba80b1`.
- **Source/provenance validator** (`scripts/validate-zaziopath-graph.mjs`) and **runtime smoke harness**
  (`scripts/test-runtime.mjs`) for graph integrity, fallback, Ollama context/failure, Grimoire
  selection, local ingestion, and duplicate prevention.
- **SYNAPSE SHELL** — a real local PTY in an eighth draggable window (`xterm.js ⇄ WebSocket ⇄ node-pty
  ⇄ $SHELL`), with independent sessions, process/port controls, explicit session saving, and a
  bounded local-model agent. AI SHELL provides OFF / ASSIST / AUTONOMOUS modes and starts OFF.
- Shell modules (`server/`, `shell/`), pinned optional terminal/WebSocket dependencies, shell/DOM
  test suites, and documentation for provenance, deployment, testing, and the shell trust boundary.

### Changed

- Replaced the procedural boot graph and placeholder Grimoire with the reproducible cited corpus;
  retained the Canvas renderer, force simulation, draggable desktop, CRT language, and zero-build core.
- Reframed Polymath around bounded graph/source/provenance/history context, optional local
  `llama3.1:8b`, and deterministic cited lexical retrieval when Ollama is unavailable.
- Kept file ingestion in the browser: text is read locally, candidate counts are bounded, normalized
  names are deduplicated, and generated links remain visibly SYNTHESIS/INFERENCE. Corpus additions are
  session-only and are never auto-uploaded or committed.
- `scripts/serve.mjs` now optionally adds the local Ollama proxy and gated PTY/agent routes while
  retaining a dependency-free static-server path. Missing shell packages leave the corpus UI usable.
- Updated source/stratum analytics, accessibility/security documentation, and the static audit for the
  data-driven runtime and shell window.

### Privacy and security

- Inference supports only `llama3.1:8b` over HTTP loopback; remote Ollama URLs and cloud inference are
  rejected. Static Pages/direct-file use retains the committed graph and offline fallback.
- Ingestion, graph notes, and Polymath history remain in page memory. Shell scrollback is also
  ephemeral unless SAVE SESSION is explicitly used.
- SYNAPSE SHELL is a real, unsandboxed login shell with the launching user's OS permissions. Its routes
  are loopback-gated by default; the remote-token bypass is explicit and high-risk. The agent is
  bounded, starts OFF, and is not a security sandbox.

## [9.4.1] — 2026-10-02

Historical baseline before the Zaziopath corpus transformation: a single-document browser desktop of seven windowed subsystems over ten client-side engines. The release details below describe that original prototype, not the current working tree.

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

At the original `9.4.1` baseline, the static audit recorded 38 findings across 21 IDs. The prototype's defect notes below are historical, not the current audit state; current checks and residual UI debt are maintained by `scripts/audit.mjs`, `scripts/audit-baseline.json`, and [`docs/ROADMAP.md`](docs/ROADMAP.md). The most significant findings at that revision:

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

- **The original demo was satirical critical design.** Its "Polymath LLM" was a template composer,
  not a model, and its telemetry was synthetic. That framing belongs to the prototype, not the
  current Zaziopath edition; see [ADR-008](docs/DECISIONS.md#adr-008--satirical-corpus-with-explicit-disclosure) for the historical decision.
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
