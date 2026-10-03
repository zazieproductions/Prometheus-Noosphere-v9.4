# Architecture Decision Records

> Why NOÖSPHERE // OS is built the way it is. Each record states the decision, the reasoning, the
> consequences — including the ones that hurt — and the alternatives that were rejected.

**Format:** lightweight ADR (context → decision → consequences → alternatives).
**Status values:** Accepted · Superseded · Deprecated.
**Note:** these records were written retroactively at `v9.4.1`, documenting the constraints the
project was actually built under rather than rationalising them after the fact. Every "negative"
consequence listed below is reflected in the defect register and the roadmap.

| ID | Decision | Status |
| --- | --- | --- |
| [ADR-001](#adr-001--single-file-delivery) | Single-file delivery | Accepted |
| [ADR-002](#adr-002--no-build-step-tailwind-play-cdn) | No build step; Tailwind Play CDN | Accepted |
| [ADR-003](#adr-003--vanilla-javascript-no-framework) | Vanilla JavaScript, no framework | Accepted |
| [ADR-004](#adr-004--canvas-2d-for-the-graph) | Canvas 2D for the graph | Accepted |
| [ADR-005](#adr-005--deterministic-procedural-content) | Deterministic procedural content, no model backend | Accepted |
| [ADR-006](#adr-006--no-persistence-no-backend) | No persistence, no backend | Accepted |
| [ADR-007](#adr-007--zero-dependency-tooling-with-a-ratcheted-audit) | Zero-dependency tooling with a ratcheted audit | Accepted |
| [ADR-008](#adr-008--satirical-corpus-with-explicit-disclosure) | Satirical corpus with explicit disclosure | Accepted |
| [ADR-009](#adr-009--semantic-accent-system-on-a-flat-surface-ramp) | Semantic accent system on a flat surface ramp | Accepted |
| [ADR-010](#adr-010--sequential-boot-with-direct-coupling) | Sequential boot with direct coupling | Accepted |
| [ADR-011](#adr-011--the-shell-module-lives-outside-indexhtml) | The shell module lives outside `index.html` | Accepted |
| [ADR-012](#adr-012--optional-native-dependency-with-a-degraded-mode) | Optional native dependency, with a degraded mode | Accepted |
| [ADR-013](#adr-013--no-sandbox-command-filter-or-confirmation-prompt-for-the-local-shell) | No sandbox, command filter or confirmation prompt for the local shell | Accepted |
| [ADR-014](#adr-014--ai-shell-control-mode-as-authorisation) | AI SHELL control: mode as authorisation | Accepted |

---

## ADR-001 · Single-file delivery

**Status:** Accepted · **Supersedes:** nothing

### Context
The artefact is a portfolio centrepiece: it will be opened by reviewers, recruiters and other
engineers, often on a laptop, sometimes straight from a repository view. The first impression is the
cost of "how do I run this?" — and a README that says `npm install && npm run dev` before anything
appears on screen has already spent that budget.

### Decision
Ship the entire application as **one `index.html`** containing markup, the token configuration, the
CSS primitives and all ten engines.

### Consequences

**Positive**
- `git clone` → open the file → it runs. There is no step where the artefact is not working.
- The whole system fits in a reviewable object: 1,571 lines, 95,308 B, no generated code.
- Constraint-driven design: because everything is visible at once, there is nowhere to hide
  unnecessary abstraction, and every engine was written to fit the same metaphor.
- Deployment is a file copy — Pages, Netlify, an S3 bucket, a USB stick.

**Negative**
- No module boundaries: the engines share one global scope, and the ordering of the runtime script is
  load-bearing.
- No tree-shaking, code splitting, or lazy loading; the payload is the payload.
- Editor tooling cannot follow symbol references across the document as reliably as across modules.
- Related register items: `NOO-017` (per-window listeners), `NOO-021` (denormalised colour cache).

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
- **Vendored Tailwind build on release.** This is the planned `9.6.0` direction: keep authoring
  against the CDN, and self-host a built stylesheet for offline parity.

---

## ADR-003 · Vanilla JavaScript, no framework

**Status:** Accepted

### Context
Seven windows, ten engines, one shared canvas, no server. The instinct on a project this size is to
reach for React or Svelte — but the coordination problem here is *local* (drag, zoom, append), not
*synchronisation* of shared derived state.

### Decision
Write the runtime in plain ES2020: object literals for engines, direct DOM manipulation, one
`requestAnimationFrame` loop, `innerHTML` for templated transcript entries.

### Consequences

**Positive**
- Zero framework bytes, zero hydration, zero render scheduling to reason about.
- The canvas loop is genuinely unmediated — no reconciler sits between physics and pixels.
- Every behaviour is discoverable by reading the file top to bottom, which no component framework
  offers in a single document.

**Negative**
- **DOM mutation is manual and therefore fallible**: the `innerHTML` template sinks are exactly where
  `NOO-007` lives.
- No declarative state→view binding: the node-count badge, the transcript and the graph state must be
  updated in the right places by hand, which is also how `NOO-010` (parity drift) arises.
- Accessibility primitives (focus management, ARIA state) that frameworks provide for free must be
  written by hand — currently deferred to `10.0.0` (`NOO-016`).

### Alternatives considered
- **A component framework.** Rejected: the framework would model the windows, but the interesting
  part of the system (canvas physics, audio, ingestion) has no state to reconcile.
- **Web components.** Rejected as over-engineering for eight windows sharing one behaviour module.

---

## ADR-004 · Canvas 2D for the graph

**Status:** Accepted

### Context
The atlas renders 90 nodes, ≈270 edges, animated continuously, with glow, labels, hover emphasis and
zoom-dependent level of detail.

### Decision
Render with **Canvas 2D** in a single `requestAnimationFrame` loop. Keep the simulation state in
plain arrays (`graphNodes`, `graphEdges`) and use the DOM only for the inspector overlay.

### Consequences

**Positive**
- Cost is proportional to primitives drawn, not to DOM nodes or style recalculation.
- Per-node glow (`shadowBlur`), camera transforms and LOD are one-liners in immediate mode.
- The simulation lives independently of rendering, which is what makes the extracted-worker path in
  the roadmap a drop-in change rather than a rewrite.

**Negative**
- **Nothing is accessible**: the graph is opaque to assistive technology and to the keyboard
  (`NOO-016`). A DOM/SVG renderer would have given basic semantics for free.
- Hit-testing must be implemented by hand (linear scan per pointer move) rather than delegated to
  the platform — and the same loop is where a spatial index is needed (`NOO-015`).
- The canvas is not DPR-scaled, so it is soft on HiDPI displays (`NOO-014`).

### Alternatives considered
- **SVG.** Rejected: 270+ elements with per-node glow and per-frame position updates would force style
  recalculation on every frame.
- **WebGL / a graph library.** Rejected: a hard dependency (violating C3) to render a few thousand
  primitives that Canvas 2D handles comfortably.

---

## ADR-005 · Deterministic procedural content

**Status:** Accepted

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

## ADR-006 · No persistence, no backend

**Status:** Accepted

### Context
The system accumulates state — injected nodes, ingested corpora, transcript history. Persisting it
would require storage, migrations and privacy obligations.

### Decision
Keep **all state in memory**. No `localStorage`, no cookies, no IndexedDB, no network I/O. Reloading
restores the authored defaults exactly.

### Consequences

**Positive**
- Nothing is collected, nothing is transmitted, nothing must be disclosed: the privacy policy is
  "there is no data".
- Two visitors see the same system; a demo is reproducible and screenshot comparisons are stable.
- Dropped files are read locally with `FileReader` and never leave the tab — the ingestion feature
  cannot exfiltrate anything even by accident.

**Negative**
- Injected nodes, palettes and transcripts are lost on reload; there is no "save my session".
- The ingestion pipeline cannot build a durable corpus across sessions.

### Alternatives considered
- **`localStorage` for session continuity.** Rejected: it would make reloads non-deterministic, which
  undermines both the demo and the ratcheted audit narrative.
- **Shareable URL state.** Deferred, not rejected — a compressed state fragment is a credible `10.x`
  feature and is listed in the roadmap.

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
- `npm test` runs in ~300 ms with no install step — a contributor can verify a change immediately.
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
- No rendered-state verification until the `9.6.0` headless-browser harness lands.

### Alternatives considered
- **ESLint + Prettier + html-validate.** Rejected as a dependency tree for a one-file project;
  `.editorconfig` covers formatting, and the custom checks cover the project-specific failure modes
  that generic linters miss (Tailwind families, token parity, dangling IDs).
- **No automated verification.** Rejected: an undocumented pile of known defects is precisely the
  impression this repository exists to avoid.

---

## ADR-008 · Satirical corpus with explicit disclosure

**Status:** Accepted

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
- The nested token path (`neon.crimson`) is the direct cause of `NOO-001` — six utilities referencing
  a family that only exists under the namespace.
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
Ten internal engines, one external shell module, one document, eight windows. The textbook answer is an event bus and a central
orchestrator; the honest question is whether the coupling actually needs decoupling at this size.

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

## ADR-011 · The shell module lives outside `index.html`

**Status:** Accepted · **Amends:** [ADR-001](#adr-001--single-file-delivery), [ADR-006](#adr-006--no-persistence-no-backend)

### Context

SYNAPSE SHELL needs a terminal emulator, session tabs, an agent console, panels and ~380 lines of
styling — roughly 1,100 lines. `index.html` sits at 95,308 B against a 96,000 B warn threshold and a
128,000 B hard budget. Inlining the shell would push the document past the warn threshold for every
visitor, including the majority (static hosts, GitHub Pages) for whom none of that code can execute,
because there is no PTY bridge to talk to.

### Decision

Keep the **application** single-file and put the shell's runtime in two optional assets loaded by two
tags: `shell/synapse-shell.js` (one IIFE, `defer`) and `shell/synapse-shell.css`. The window's
markup skeleton stays in `index.html` (so docking, dragging and the layout audit still work), and the
interior is built at runtime.

Admitting a shell also admits a process to serve it. Local workstation mode runs
`scripts/serve.mjs` — a loopback-only bridge. That amends [ADR-006](#adr-006--no-persistence-no-backend)
in scope, not in spirit: a loopback socket, no hosted state, no persistence beyond an explicit SAVE
SESSION, and nothing the published artefact depends on.

### Consequences

**Positive**
- The payload that every visitor downloads is unchanged in structure and only 148 bytes heavier in
  tags; the shell's ~25 KB is fetched only when the page asks for it.
- The shell is the only module that cannot run on a static host, and it can now be omitted from a
  deployment without touching the document.
- The shell's code is testable in isolation (`scripts/test-ui.mjs` loads it into jsdom directly).

**Negative**
- ADR-001's clean "one file" rule now has one documented exception, and the audit no longer sees the
  shell's DOM ids or handlers. Mitigation: the shell builds its own DOM and wires listeners by
  delegation, so there is nothing for the static audit to miss; the window skeleton that *is* audited
  keeps every window contract intact.
- Two more requests on a local server. Irrelevant at loopback latency.

### Alternatives considered
- **Inline everything.** Rejected: it spends the budget of every static visitor on the one feature
  they cannot use.
- **Move the whole app to modules.** Rejected: it breaks the project's thesis (ADR-001) for a single
  subsystem, and the extraction plan in [`MAINTAINABILITY.md`](MAINTAINABILITY.md) already covers the
  principled route.
- **Load xterm from a CDN.** Rejected: it would add a fourth unpinned third-party origin and make an
  offline-capable local tool depend on the internet.

---

## ADR-012 · Optional native dependency, with a degraded mode

**Status:** Accepted · **Supersedes:** nothing

### Context

A real PTY requires a native binding: `node-pty`, which compiles against the Node headers. The
project's identity is "no dependencies, no build step", and a failed native build must not be able to
break the application or the install.

### Decision

Ship `node-pty` as an **optionalDependency**, import it dynamically inside a `try`/`catch`
(`server/shell.mjs`), and treat its absence as a first-class state — not an error. The server boots,
logs `SYNAPSE SHELL → OFFLINE (reason)`, and `/api/shell/status` reports `available:false`; the
browser renders `SYNAPSE SHELL // LOCAL PTY UNAVAILABLE` with the reason. `ws`, `@xterm/xterm` and
`@xterm/addon-fit` are ordinary dependencies but equally optional at runtime: a missing vendor asset
404s with an install hint and the window reports `TERMINAL LIBRARY MISSING`.

### Consequences

**Positive**
- `npm install` cannot fail the project; `npm start` cannot crash the app.
- The failure is legible and actionable rather than a blank window.
- The published artefact is untouched: it never imports any of this.

**Negative**
- Two dependency classes exist now (runtime-optional, dev-only), so "does the app need Node?"
  requires a sentence rather than a word. Handled in the README and here.
- CI compiles `node-pty` only in the path-filtered behavioural workflow
  (`.github/workflows/shell.yml`); on a machine without a toolchain the suite still skips cleanly, so
  a native-build regression is caught on a pull request rather than on a user's machine.

### Alternatives considered
- **Required dependency.** Rejected: it makes a native toolchain a precondition for a project whose
  entire premise is that a file opens in a browser.
- **Custom PTY in C/Node-API.** Rejected outright: it would replace a well-tested binding with
  maintained-by-us native code.
- **No PTY at all (pipe a child process).** Rejected: it would not be a terminal, and the product
  claim would be a lie.

---

## ADR-013 · No sandbox, command filter or confirmation prompt for the local shell

**Status:** Accepted · **Supersedes:** nothing

### Context

Giving a browser window a real shell invites the instinct to "make it safe": allowlists, denylists,
a confirmation dialog per command, a jail directory. Each was considered. A shell is a Turing-complete
surface: `python3 -c`, `git`, `make`, `bash -c`, package managers and `ssh` all defeat enumeration,
so a filter cannot be sound. A prompt per command cannot be sound either — it trains the operator to
click through, and it cannot anticipate what the command will do.

### Decision

Do not filter, jail or confirm **human** input. Feed terminal input to the real PTY. Put the
enforcement where it can actually be sound:

1. **The network boundary** — the shell exists only for requests provably from the same machine
   (`server/gate.mjs`), so a remote client or a cross-site page cannot type into it.
2. **The AI boundary** — the model's access is a mode (`OFF`/`ASSIST`/`AUTONOMOUS`), a fixed tool
   vocabulary validated before execution, and hard bounds (MAX STEPS, MAX RUNTIME) enforced in the
   loop.
3. **The UI boundary** — the panel's kill button may only signal NOÖSPHERE's own process trees; the
   *shell* remains unrestricted because that authority comes from the user's account, not the UI.
4. **Honest documentation** — `SHELL.md` states in its first section that nothing is sandboxed.

### Consequences

**Positive**
- The tool does what it claims: it is a terminal, not a toy command runner, and `vim`, `htop`,
  `docker`, `ssh`, `sudo` and package managers work because nothing intervenes.
- Every control that exists is one that can be enforced; `SECURITY.md` can describe real properties
  instead of implied ones.

**Negative**
- The mode `AUTONOMOUS` grants a local model the user's own authority. That is a genuinely sharp
  edge, mitigated by it being off by default, never persisted, bound-checked, and revocable with one
  click (STOP AGENT / INTERRUPT / KILL PROCESS) without the model's cooperation.
- A user who expected a sandbox must read the docs to learn there is none — which is exactly why the
  first line of `SHELL.md` says so.

### Alternatives considered
- **Command allowlist.** Rejected: unsound and easily circumvented; it would create false confidence.
- **Per-command confirmation.** Rejected: friction without safety, and explicitly ruled out by the
  operating requirement that ordinary shell activity not be interrupted.
- **Filesystem jail (`chroot`/`sandbox-exec`).** Rejected as a default: it breaks the stated purpose
  (a personal workstation shell), and a user who wants a capability boundary should run the whole
  workstation inside a VM, which is a stronger boundary than a hand-rolled jail. This remains the
  recommended posture for untrusted experiments.
- **No shell at all.** Rejected: it is the feature.

---

## ADR-014 · AI SHELL control: mode as authorisation

**Status:** Accepted · **Supersedes:** nothing

### Context

The local model should be able to use the shell (that is the point of an integrated workstation), and
the user should not have to approve every command. The two failure directions are opposite: an
isolated AI (no shell) makes the workstation inert, and an unsupervised AI with a shell is a loaded
gun. Both extremes were on the table — "never expose the shell to the model" and "let the agent run
freely".

### Decision

Make the **control mode itself the authorisation**, with three named states that are impossible to
miss in the UI:

* `OFF` — the tool surface is not merely unused, it is not exposed; the endpoints 403.
* `ASSIST` — the model may type into the input buffer only; newline bytes are stripped so a proposal
  cannot execute itself, and the loop stops after the first proposal rather than pretending to know
  the result.
* `AUTONOMOUS` — execution permitted, bounded by user-editable MAX STEPS / MAX RUNTIME / STOP ON
  ERROR, with the command streamed into a visible step log.

The mode lives in memory only, is never enabled by the model, and is never persisted.

### Consequences

**Positive**
- The user's intent is expressed once, explicitly, and is visible at all times (badge, strip, dock).
- `ASSIST` is a genuinely useful middle state — it makes the model a prompt-composer instead of a
  gambler — and it is only honest because execution is structurally impossible in that mode.
- Stopping is always possible without cooperation: aborting the SSE stream, STOP AGENT, INTERRUPT,
  KILL PROCESS, RESTART.

**Negative**
- Two more concepts to learn (`ASSIST` vs `AUTONOMOUS`), and a state that can be left on by accident
  until the server restarts. Mitigation: the badge pulses crimson in AUTONOMOUS, the dock badge
  repeats it, and boot always returns to `OFF`.
- `AUTONOMOUS` quality depends on the model; a small local model will take wrong turns. Bounds, the
  visible step log and STOP are the answer; correctness of judgement is not something the harness can
  promise.

### Alternatives considered
- **Per-command confirmation.** Rejected: the operating requirement explicitly rules it out, and it
  degrades into rubber-stamping.
- **A permanent tool allowlist for the agent** (e.g. read-only commands). Rejected: it would make the
  stated goal (iterating on real work: tests, builds, servers, media) unreachable, and the mode
  already provides a stricter and more honest control.
- **Model-side filtering ("only safe commands").** Rejected: prompt-level safety is not an
  enforcement mechanism, and treating it as one is the failure mode this ADR exists to avoid.

---

<div align="center">
<sub>Next: <a href="ACCESSIBILITY.md">Accessibility audit →</a></sub>
</div>
