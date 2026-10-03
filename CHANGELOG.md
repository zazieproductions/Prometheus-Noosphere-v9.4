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

### Added

- **Committed Zaziopath source snapshot** (`data/zaziopath-graph.js`): 8 strata, 86 source-derived nodes, 117 cited relationships, and 15 searchable Grimoire fragments at source revision `63d99e311c852b9d57ddc29418455f9bb4ba80b1`.
- **Source/provenance validator** (`scripts/validate-zaziopath-graph.mjs`) for duplicate IDs/names, missing endpoints/provenance/excerpts, invalid strata/statuses, and broken fragment references.
- **Runtime smoke harness** (`scripts/test-runtime.mjs`) covering graph boot, deterministic fallback, bounded Ollama context/failure, Grimoire selection, session ingestion, local-only behavior, and deduplication.
- **Corpus documentation** for data refresh, committed-vs-session data, epistemic labels, privacy boundaries, optional local inference, and static fallback.

### Changed

- Replaced the procedural boot graph and placeholder Grimoire with the stable cited corpus; retained the Canvas renderer, force simulation, draggable desktop windows, CRT visual language, and zero-build app structure.
- Reframed Polymath around selected graph/source/provenance/history context, optional local `llama3.1:8b`, and deterministic lexical retrieval when Ollama is unavailable.
- Reworked local ingestion to read text with `FileReader`, extract at most three high-signal candidates, deduplicate normalized names, create source-backed file records, and visibly mark SYNTHESIS/INFERENCE links. Session additions disappear on reload and are never uploaded or persisted.
- Replaced procedural “idea mutation” with a session-local OPEN QUESTION that does not claim an undocumented cross-stratum relationship.
- Corrected source/stratum analytics and removed unsupported tone-effect language.
- Updated the static audit for the current data-driven runtime, committed graph size, and live status/count elements; adjusted the HTML audit budget for the larger source-aware runtime.

### Privacy and fallback

- Local inference routes are optional, use only `llama3.1:8b`, and are restricted to loopback use by the bundled Node server. GitHub Pages/direct-file use remains static and uses the offline graph/Grimoire/retrieval path.

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
