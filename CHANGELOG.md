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

- **`README.md`** rewritten as a technical overview: honest framing first, verified metrics, a
  feature map, the architecture in one diagram, a documentation index, and status reporting driven by
  the audit rather than by prose.

### Notes

- **The application runtime is unchanged in this release.** `index.html` is byte-identical; the
  9.4.1 behaviour, appearance and defects are exactly as published. Everything above is
  documentation and tooling.
- **The register is now the canonical record of known defects** — 21 IDs across 38 findings. Items
  are scheduled in `ROADMAP.md`; severe items (`NOO-001`, `NOO-007`, `NOO-016`, `NOO-019`) are
  prioritised in `9.4.2` and `9.5.0`.

---

## [9.4.1] — 2026-10-02

The current published revision: a single-document browser desktop of seven windowed subsystems over
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
