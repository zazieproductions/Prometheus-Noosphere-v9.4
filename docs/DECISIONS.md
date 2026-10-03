# Architecture Decision Records

> Why NOÖSPHERE // OS is built the way it is. Each record states the decision, the reasoning, the
> consequences — including the ones that hurt — and the alternatives that were rejected.

**Format:** lightweight ADR (context → decision → consequences → alternatives).
**Status values:** Accepted · Superseded · Deprecated.
**Note:** ADR-001–010 document the original v9.4 prototype and its historical trade-offs; ADR-011–013 record the Zaziopath corpus implementation. Superseded prototype choices are labeled rather than silently presented as current behavior.

| ID | Decision | Status |
| --- | --- | --- |
| [ADR-001](#adr-001--single-file-delivery) | Single-file delivery | Accepted |
| [ADR-002](#adr-002--no-build-step-tailwind-play-cdn) | No build step; Tailwind Play CDN | Accepted |
| [ADR-003](#adr-003--vanilla-javascript-no-framework) | Vanilla JavaScript, no framework | Accepted |
| [ADR-004](#adr-004--canvas-2d-for-the-graph) | Canvas 2D for the graph | Accepted |
| [ADR-005](#adr-005--deterministic-procedural-content) | Original deterministic template composer | Superseded |
| [ADR-006](#adr-006--no-persistence-optional-local-inference) | No persistence; optional local inference | Accepted |
| [ADR-007](#adr-007--zero-dependency-tooling-with-a-ratcheted-audit) | Zero-dependency tooling with a ratcheted audit | Accepted |
| [ADR-008](#adr-008--satirical-corpus-with-explicit-disclosure) | Original satirical demo corpus | Superseded |
| [ADR-009](#adr-009--semantic-accent-system-on-a-flat-surface-ramp) | Semantic accent system on a flat surface ramp | Accepted |
| [ADR-010](#adr-010--sequential-boot-with-direct-coupling) | Sequential boot with direct coupling | Accepted |
| [ADR-011](#adr-011--committed-source-derived-zaziopath-snapshot) | Committed source-derived Zaziopath snapshot | Accepted |
| [ADR-012](#adr-012--optional-loopback-only-ollama-inference) | Optional loopback-only Ollama inference | Accepted |
| [ADR-013](#adr-013--epistemic-labels-and-non-clinical-framing) | Epistemic labels and non-clinical framing | Accepted |

---

## ADR-001 · Single-file delivery

**Status:** Accepted · **Supersedes:** nothing

### Context
The artefact is a portfolio centrepiece: it will be opened by reviewers, recruiters and other
engineers, often on a laptop, sometimes straight from a repository view. The first impression is the
cost of "how do I run this?" — and a README that says `npm install && npm run dev` before anything
appears on screen has already spent that budget.

### Decision
Keep the application markup, styles, and vanilla runtime in **one `index.html`**. The source-derived graph is a separate committed data sidecar at `data/zaziopath-graph.js` so the stable corpus remains inspectable and can be refreshed without turning the app into a build product.

### Consequences

**Positive**
- `git clone` → open the file → it runs. There is no step where the artefact is not working.
- Application logic remains in one reviewable HTML document; the only generated runtime sidecar is the committed, source-auditable corpus JS.
- Constraint-driven design: because everything is visible at once, there is nowhere to hide
  unnecessary abstraction, and every engine was written to fit the same metaphor.
- Deployment is a static file copy of `index.html` plus `data/zaziopath-graph.js` — Pages, Netlify, an S3 bucket, or a USB stick.

**Negative**
- No module boundaries: the engines share one global scope, and the ordering of the runtime script is
  load-bearing.
- No tree-shaking, code splitting, or lazy loading; the payload is the payload.
- Editor tooling cannot follow symbol references across the document as reliably as across modules.
- Related register items: `NOO-017` (per-window listeners), `NOO-014` (HiDPI canvas), and the audited HTML payload budget.

### Alternatives considered
- **Multi-file ES modules with no bundler.** Rejected: browsers would need a server for a module
  graph, replacing "open the file" with "start a server" for zero user-visible benefit.
- **A modern build (Vite + Tailwind CLI).** Rejected at this scale: it buys minification and HMR,
  costs a toolchain, and contradicts C2/C3. [ADR-002](#adr-002--no-build-step-tailwind-play-cdn)
  records the closest alternative.

---

## ADR-002 · No build step (Tailwind Play CDN)

**Status:** Accepted

### Context
The interface is dense enough that hand-authoring CSS for every state would swamp the document;
utility classes keep the markup self-describing. But Tailwind conventionally implies PostCSS or the
CLI and a build artefact.

### Decision
Use the **Tailwind Play CDN** with an inline `tailwind.config` object, and keep only the primitives
that utilities cannot express (CRT overlay, backdrop-filter glass, glow, hatching, scrollbars) in a
~50-line `<style>` block.

### Consequences

**Positive**
- Design tokens are declared in the document, readable in the same scroll as their usage.
- No build artefacts, no lockfile, no "works on my machine" compilation differences.
- Editing a token is immediately visible — the config *is* the design system, at runtime.

**Negative**
- The CDN JIT compiles styles in the browser on each load: slower first paint than a built stylesheet,
  and it cannot be preloaded from cache.
- The CDN is **unpinned** (`cdn.tailwindcss.com`), so a hosting outage takes the styling with it, and
  the network is required for correct presentation (`NOO-008`).
- No purge step: irrelevant here, since nothing is generated.

### Alternatives considered
- **Full Tailwind CLI build.** Rejected: breaks C2 and introduces generated output that must be kept
  in sync and out of the review path.
- **Hand-written CSS only.** Rejected: a token layer plus utilities is a *better* system here, and
  removing utilities would push hundreds of declarations into the markup.
- **Vendored Tailwind build on release.** This is the planned `9.5.0` direction: keep authoring
  against the CDN, and self-host a built stylesheet for offline parity.

---

## ADR-003 · Vanilla JavaScript, no framework

**Status:** Accepted

### Context
Seven windows and a shared canvas run in the browser without a required application backend. An optional local Node proxy exists only for loopback Ollama inference. The instinct on a project this size is to reach for React or Svelte — but the coordination problem here is *local* (drag, zoom, append), not *synchronisation* of shared derived state.

### Decision
Write the runtime in plain ES2020: object literals for engines, direct DOM manipulation with text-safe rendering of user/source strings, and one `requestAnimationFrame` canvas loop.

### Consequences

**Positive**
- Zero framework bytes, zero hydration, zero render scheduling to reason about.
- The canvas loop is genuinely unmediated — no reconciler sits between physics and pixels.
- Every behaviour is discoverable by reading the file top to bottom, which no component framework
  offers in a single document.

**Negative**
- **DOM mutation is manual and therefore fallible.** Current user/source text is rendered through `textContent`/text nodes and the static audit detects no tainted `innerHTML` interpolation (`NOO-007` is resolved in this snapshot); future dynamic markup still needs careful review.
- No declarative state→view binding: counts, selection, transcript, and graph state must be updated in the right places by hand. Current graph/count parity checks pass (`NOO-010` has no remaining findings).
- Accessibility primitives (focus management, keyboard traversal, and complete per-node graph semantics) still need to be written and verified by hand (`NOO-016`).

### Alternatives considered
- **A component framework.** Rejected: the framework would model the windows, but the interesting
  part of the system (canvas physics, audio, ingestion) has no state to reconcile.
- **Web components.** Rejected as over-engineering for seven windows sharing one behaviour module.

---

## ADR-004 · Canvas 2D for the graph

**Status:** Accepted

### Context
The atlas starts from 86 committed source-derived nodes and 117 explicitly sourced relationships across eight strata, animated continuously with glow, labels, hover emphasis, and zoom-dependent level of detail.

### Decision
Render with **Canvas 2D** in a single `requestAnimationFrame` loop. Keep the simulation state in
plain arrays (`graphNodes`, `graphEdges`) and use the DOM only for the inspector overlay.

### Consequences

**Positive**
- Cost is proportional to primitives drawn, not to DOM nodes or style recalculation.
- Per-node glow (`shadowBlur`), camera transforms and LOD are one-liners in immediate mode.
- The force simulation is independent of the corpus-building step; the committed source graph remains available if canvas behavior or layout changes.

**Negative**
- **Per-node access is incomplete**: the canvas exposes a graph summary, but does not provide keyboard traversal or assistive-technology access to every node and edge (`NOO-016`). A DOM/SVG renderer would have supplied some semantics automatically.
- Hit-testing must be implemented by hand (linear scan per pointer move) rather than delegated to
  the platform — and the same loop is where a spatial index may eventually help (`NOO-015`).
- The canvas is not DPR-scaled, so it is soft on HiDPI displays (`NOO-014`).

### Alternatives considered
- **SVG.** Rejected: a per-node SVG tree with per-frame position updates and glow would add DOM/style work that the current 86-node Canvas graph does not require.
- **WebGL / a graph library.** Rejected: a hard dependency (violating C3) to render a few thousand
  primitives that Canvas 2D handles comfortably.

---

## ADR-005 · Deterministic procedural content

**Status:** Superseded by ADR-011 and ADR-012. The old vocabulary-template composer and procedural boot graph are no longer used; the committed graph and deterministic lexical fallback provide offline behavior, with optional local inference.

### Context
The centrepiece interaction is asking a "cognition core" for strategy, and getting an authoritative,
sectarian-sounding answer back instantly. A real model would require an API key, a network round
trip, a backend, a cost per view — and would make the artefact non-deterministic and un-testable.

### Decision
Implement the Polymath LLM as a **template-composition engine** over a fixed vocabulary table
(5 openings × 5 tenets × 4 ordered tenet pairs × 4 fixed actions × 291 confidence values ≈
**29,100 surface variations**, 100 distinct argument structures), with a fixed 400 ms delay to
simulate deliberation. Document its actual mechanism prominently.

### Consequences

**Positive**
- Zero cost, zero latency, zero keys, offline, deterministic — and testable without stubs, because
  the response is a pure function of the RNG.
- The variation space is a **design parameter**, not an accident: adding a tenet multiplies responses.
- Being explicit about what it is *is itself the artwork*: the piece is a critique of
  generative-sounding systems that generate nothing, so the disclosure is not an apology — it is
  the argument.

**Negative**
- The engine cannot respond to its input; the prompt parameter is accepted and ignored, which is
  surprising to anyone encountering it as a tool rather than as a piece of design. Mitigated by
  stating it plainly in three places (README, `API.md`, `ARCHITECTURE.md`).
- A reviewer comparing it to an actual model will find it shallow by construction. That trade is
  accepted deliberately; see ADR-008.

### Alternatives considered
- **A real LLM behind an edge function.** Rejected: it would require a backend (violating C4),
  introduce cost and latency, and destroy the guarantee that the artefact runs identically forever.
- **A much larger local corpus.** Rejected as bloat: the point is architectural, not encyclopaedic.

---

## ADR-006 · No persistence, optional local inference

**Status:** Accepted

### Context
The system accumulates graph selection, terminal history, local file ingestion, and user-authored notes. Persisting private additions would change the privacy model and require storage/export guarantees. Optional text inference is useful, but cloud APIs or a general network backend would violate the local-first/static deployment requirement.

### Decision
Keep user-added graph nodes, ingested text, synthesis questions, and terminal context in page memory only. Do not use `localStorage`, cookies, IndexedDB, a database, or cloud inference. Offer an optional zero-dependency Node proxy only for local `llama3.1:8b`; restrict its inference routes to loopback clients/Host/Origin. The committed graph and deterministic lexical retrieval must continue to work without it.

### Consequences

**Positive**
- Reloading discards private/session additions; the committed corpus remains unchanged.
- No API keys, cloud calls, hosted database, or remote inference service is needed.
- GitHub Pages and direct static use preserve the source graph, simulation, Grimoire, and fallback.

**Negative**
- Session ingestion and manual notes cannot be restored or shared after reload.
- Local inference requires the developer's own Ollama process and is unavailable on GitHub Pages/remote previews.
- When inference is enabled, bounded prompt/context text (including short local excerpts) reaches that machine's local Ollama process.

### Alternatives considered
- **Browser storage/export.** Deferred; would require a separately reviewed private-data policy.
- **Cloud model or embedding service.** Rejected: it would transmit corpus/session text and make the offline/static mode dependent on a remote service.

---

## ADR-007 · Zero-dependency tooling with a ratcheted audit

**Status:** Accepted

### Context
A repository with a single HTML file invites one of two failure modes: no verification at all, or a
heavy toolchain (bundler, linter stack, headless-browser suite) that contradicts the project's own
thesis. The realistic middle ground is verification that is *cheap to run and honest about what it
cannot see*.

### Decision
Write the audit as a **dependency-free Node script** (`scripts/audit.mjs`, Node stdlib only) with two
tiers:

1. **Always-fatal rules** (duplicate IDs, dangling references, unresolvable dock targets, undefined
   inline handlers) — never baselined.
2. **Ratchet rules** — 21 register IDs whose counts are compared against
   `scripts/audit-baseline.json`. Exceeding a baseline fails CI; falling below it is reported as an
   improvement to be locked in.

### Consequences

**Positive**
- `npm test` runs graph validation, a dependency-free runtime smoke harness, and the static audit with no install step.
- Known debt is **explicit and bounded**: it is a number in a file, reviewable in a diff, rather than
  a claim in a doc.
- The gate is one-directional: debt can only shrink, and shipping new debt requires deliberately
  editing the baseline inside a pull request where a reviewer sees it.
- The audit is extensible in the same style as the application (small, readable, no config DSL).

**Negative**
- Static analysis cannot see behaviour: layout overflow was caught only by reasoning about geometry
  and encoding it as checks (`NOO-019`), and runtime defects are found by reading, not by the tool.
- The baseline invites "baseline drift" if reviewers approve increases casually; mitigated by
  requiring the reason in the PR template.
- The VM smoke harness exercises runtime contracts but does not validate pixels or browser layout; visual behavior remains a manual browser check.

### Alternatives considered
- **ESLint + Prettier + html-validate.** Rejected as a dependency tree for a one-file project;
  `.editorconfig` covers formatting, and the custom checks cover the project-specific failure modes
  that generic linters miss (Tailwind families, token parity, dangling IDs).
- **No automated verification.** Rejected: an undocumented pile of known defects is precisely the
  impression this repository exists to avoid.

---

## ADR-008 · Satirical corpus with explicit disclosure

**Status:** Superseded by ADR-013. This records the original prototype's satirical demo corpus; the current corpus is the Zaziopath source archive and is framed non-clinically, not as a diagnosis engine.

### Context
The project's content satirises marketing's most manipulative register — "memetic warfare",
"subconscious indoctrination", "paraconsistent PR". Satire is easy to misread as endorsement,
especially in a repository that a recruiter may skim rather than read.

### Decision
Keep the satirical corpus and make the framing **explicit and unmissable**: a *What this is not*
section in the README, an honesty table in the architecture document, and a disclosure in the design
system stating that the corpus is critical design and never instructional.

### Consequences

**Positive**
- The critique lands for the audience that reads carefully, while nobody mistakes the project for a
  playbook — which is the actual risk of the genre.
- The disclosures create a second, unexpected demonstration: technical honesty about one's own
  artefact is a stronger signal of seniority than a polished feature list.
- The satirical register justifies the design system: an interface this theatrical would be
  indefensible if the content were earnest.

**Negative**
- Some readers will not get past the vocabulary and will judge the project on its surface; that is
  inherent to satire and accepted.
- Every document must repeat the framing, which costs space in the README.

### Alternatives considered
- **Soften the vocabulary.** Rejected: it would remove the point of the piece and leave a thematically
  empty dashboard.
- **Framing in the UI itself.** Partially adopted via honest labels ("force-sim", "zero-latency
  engine"); fuller disclaimers inside the artefact would break the fiction that makes it work.

---

## ADR-009 · Semantic accent system on a flat surface ramp

**Status:** Accepted

### Context
Dark, information-dense interfaces drift toward two failure modes: everything the same grey, or every
accent used everywhere until none of them mean anything.

### Decision
Two rules: a **four-step near-black surface ramp** (`void` → `obsidian` → `surface` →
`surface-bright`, steps of 4–5 % luminance) for depth, and **six accents assigned fixed semantic
roles**, one per subsystem. Hierarchy comes from elevation, borders and shadow — not from brightness.

### Consequences

**Positive**
- Depth is legible without contrast drift, and colour always carries meaning.
- Adding a subsystem has an obvious, bounded decision: which role owns this hue?
- Measured contrast is strong across the ramp for the primary roles (AAA on the dark steps — see
  [`DESIGN.md` § 2.3](DESIGN.md#23-contrast-budget-measured)).

**Negative**
- `surface-bright`, the interaction step, is where contrast is weakest: violet, crimson and hyper fall
  below 4.5:1 there, and `slate-500`/`slate-600` fail at every step (`NOO-016`).
- The nested token path (`neon.crimson`) is the direct cause of the remaining `NOO-001` audit findings: four current class occurrences use a family that exists only under the namespace.
- A flat ramp makes focus states subtle; that is why `.window-active` uses border *and* glow *and*
  `z-index`, rather than relying on any one channel.

### Alternatives considered
- **A wider luminance ramp.** Rejected: more contrast between panels makes the glass metaphor muddy
  and competes with the accent colour.
- **Fewer accents.** Rejected: five subsystems genuinely need distinct channels, and the sixth
  (`hyper`) is reserved rather than applied.

---

## ADR-010 · Sequential boot with direct coupling

**Status:** Accepted

### Context
Several interacting browser modules, one document, and seven windows. The textbook answer is an event bus and a central orchestrator; the honest question is whether the coupling actually needs decoupling at this size.

### Decision
Initialise in a fixed order inside a single `DOMContentLoaded` handler. Couple engines **directly**
through method calls, three shared state surfaces (`graphNodes`, `graphEdges`, `camera`) and append-only
DOM. No event bus, no store, no pub/sub.

### Consequences

**Positive**
- The control flow of a click is readable end-to-end in one direction, with no indirection to trace.
- Ordering is explicit and visible rather than emergent: `graph` before `polymathLLM`, window wiring
  before anything.
- Failure is obvious and local: an engine that throws takes down its own path, not a shared bus.

**Negative**
- The coupling graph, while acyclic, is a DAG rather than a tree: `injectNode` is reachable from three
  independent callers, and `appendChat` from five.
- Global scope means no encapsulation boundary and no per-engine test isolation; the audit works on
  the document as a whole instead.
- Reordering engines is a silent hazard — nothing enforces the initialisation contract, which is why
  the boot sequence is documented explicitly in [`ARCHITECTURE.md` § 5](ARCHITECTURE.md#5-boot-sequence).

### Alternatives considered
- **Event bus.** Rejected at this scale: it would add asynchrony and traceability cost to solve a
  coupling problem that does not yet exist.
- **Global store with subscriptions.** Rejected for the same reason, and because the canvas render
  loop deliberately bypasses any reactive layer.
- **Revisit trigger.** If the engine count passes ~15 or any engine needs shared *derived* state, this
  decision should be reopened rather than extended.

---

<div align="center">
<sub>Next: <a href="ACCESSIBILITY.md">Accessibility audit →</a></sub>
</div>

## ADR-011 · Committed source-derived Zaziopath snapshot

**Status:** Accepted

### Context
The original procedural seed graph and placeholder Grimoire did not preserve repository identity, strata, source excerpts, or defensible relationships. Runtime crawling would make the graph unstable and make static hosting dependent on the source repository.

### Decision
Curate a stable graph from the public Zaziopath source and commit the generated `data/zaziopath-graph.js` snapshot. Keep definitions and excerpt anchors in `scripts/build-zaziopath-graph.mjs`; validate all source paths/anchors and graph references before regeneration. Reuse the README's indexed wires and method spine before adding other explicitly documented links. Record source revision and visible epistemic labels.

### Consequences
- Boot data is deterministic and available offline/GitHub Pages without a package or API dependency.
- Source refresh is an explicit, reviewable curation operation; it is not performed in the browser.
- Binary artifacts are not quoted when their text is unavailable; catalogue/ledger provenance is labeled.
- The committed payload is a curated snapshot, not a complete mirror of the source repository.

## ADR-012 · Optional loopback-only Ollama inference

**Status:** Accepted

### Context
The Polymath Terminal benefits from bounded source/selection/history context, but the product must remain useful when offline and must not require cloud inference, API credentials, models other than `llama3.1:8b`, embeddings, or a hosted backend.

### Decision
Use a small Node-standard-library local proxy in `scripts/serve.mjs` for optional access to an already-installed `llama3.1:8b` Ollama process at `127.0.0.1:11434`. Restrict inference routes to loopback clients/Host/Origin. On static hosts or request failure, use deterministic local lexical retrieval and extraction.

### Consequences
- Static graphs, Grimoire, simulation, and fallback do not require Node/Ollama.
- Local inference requests include bounded selected graph/source/fragment/history context and short session-ingestion excerpts; keep both services private.
- Generated concepts/edges remain labeled INFERENCE and never become committed source facts.

## ADR-013 · Epistemic labels and non-clinical framing

**Status:** Accepted

### Context
The source corpus contains self-report, evidence records, authored interpretations, experiments, speculative readings, and unresolved questions. A single graph style or diagnostic framing would collapse these distinctions and overstate what the archive can establish.

### Decision
Present Zaziopath as a non-clinical self-analysis archive, creative research instrument, evidence system, recursive notebook, and conceptual laboratory—not as a personality-diagnosis engine. Preserve SOURCE, INFERENCE, SYNTHESIS, and OPEN QUESTION on records and links, with citations and visible UI treatment. Treat a source citation as evidence of what the source records, not independent validation of an interpretation.

### Consequences
- Source and model claims remain attributable; unresolved matters can remain unresolved.
- Session-generated bridges are research questions, not assertions.
- Stratum color is navigation only and does not encode confidence or evidence quality.
