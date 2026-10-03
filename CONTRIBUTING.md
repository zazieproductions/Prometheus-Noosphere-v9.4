# Contributing to NOÖSPHERE // OS

> Conventions, verification, and the review rubric — everything a contributor needs to land a change
> without a round trip.

Thanks for considering a contribution. This project has a zero-build, single-document core and an
optional workstation shell split into small modules. The conventions below protect the Canvas/CRT
experience, static corpus path, provenance rules, and the shell's separate trust boundary.

---

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Setup](#setup)
- [Project conventions](#project-conventions)
- [Verification](#verification)
- [Commit convention](#commit-convention)
- [Pull requests](#pull-requests)
- [Review rubric](#review-rubric)
- [Recipes](#recipes)
- [Documentation contributions](#documentation-contributions)
- [What will not be merged](#what-will-not-be-merged)
- [Getting help](#getting-help)

---

## Ways to contribute

| Contribution | Where to start |
| --- | --- |
| **Fix a tracked issue** | [`ROADMAP.md`](docs/ROADMAP.md) — current usability, accessibility, and performance work |
| **Improve accessibility** | [`ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) — review the documented findings and remediation plan |
| **Change runtime ownership** | [`MAINTAINABILITY.md` § 2](docs/MAINTAINABILITY.md#2-change-ownership) — edit the named source and run its verification |
| **Curate source content** | [`ZAZIOPATH-CORPUS.md`](docs/ZAZIOPATH-CORPUS.md) — builder definitions, provenance, and cited source revision |
| **Improve shell behavior or security** | [`SHELL.md`](docs/SHELL.md), `server/`, and `shell/` — preserve the local-only gate and unsandboxed-shell disclosure |
| **Correct the documentation** | Docs are a deliverable, not a by-product — factual corrections are welcome and treated as code changes |
| **Report a defect** | Use the issue forms; if it is not in the register, it will be added with an ID |

---

## Setup

```bash
git clone https://github.com/zazieproductions/Prometheus-Noosphere-v9.4.git
cd Prometheus-Noosphere-v9.4

npm start          # → http://localhost:4173; starts without installed packages
npm test           # graph + runtime checks + static audit + optional shell/UI suites
```

Node.js ≥ 18 is required. Graph validation, runtime smoke, static hosting, and the offline corpus path
use the standard library. To exercise the workstation shell and jsdom UI suites, run `npm install`;
the shell can still degrade if the optional native `node-pty` binding is unavailable. See
[ADR-007](docs/DECISIONS.md#adr-007--zero-dependency-tooling-with-a-ratcheted-audit) and
[ADR-015](docs/DECISIONS.md#adr-015--optional-workstation-dependencies-with-a-degraded-mode).

---

## Project conventions

### The project boundaries

Every change must respect these product and trust constraints
([`DECISIONS.md`](docs/DECISIONS.md)).

1. **Preserve the core.** Keep the Canvas 2D renderer, vanilla JS, draggable desktop, CRT visual language, and zero-build structure; do not replace them with a framework or graph library.
2. **Keep static use complete.** The committed graph, Grimoire, simulation, and deterministic fallback work on GitHub Pages/offline without npm packages, a database, embeddings, or a cloud service.
3. **Treat Zaziopath as source material.** Keep the reproducible graph snapshot, stratum identity, excerpts, source provenance, and explicitly documented wires. Omit unsupported links or visibly label them as inference/synthesis/open questions.
4. **Preserve epistemic boundaries.** Source-backed records and model-generated interpretations remain distinguishable. Never present the archive as a clinical/personality diagnosis engine.
5. **Keep ingestion local and ephemeral.** Read files in the browser, never upload them for ingestion, deduplicate names, bound candidate creation, and discard private additions on reload.
6. **Keep SYNAPSE SHELL optional and isolated.** The PTY is a real, unsandboxed shell with the launching user's permissions. Local route gating is not a filesystem sandbox; AI SHELL starts OFF. Do not expose the remote-token bypass as a default.
7. **Use design tokens.** Never add a raw display hex value to workspace markup; use the established semantic `tailwind.config` tokens.

### Code style

| Area | Convention |
| --- | --- |
| Indentation | 4 spaces in `index.html`, 2 spaces in `scripts/` and config (see `.editorconfig`) |
| Line endings | LF, final newline, no trailing whitespace |
| JavaScript | ES2020, no semicolon-less style, `const`/`let`, no classes unless a data structure demands one |
| Naming | Engine objects `camelCase` (`graphEngine`); methods are verbs (`injectNode`, `filterStratum`); DOM ids `kebab-case` |
| Comments | Engine banners use the existing numbered format; explain *why*, never *what* |
| Dependencies | Adding one requires an ADR. This is not a formality. |

### Engine pattern

Engines are plain object literals with a public surface, grouped under a numbered banner:

```js
// -------------------------------------------------------------
// 11. MY ENGINE
// -------------------------------------------------------------
const myEngine = {
  doThing(input) { /* … */ }
};
```

If your change needs shared state, prefer extending an existing engine's state over introducing a new
global. The global scope is the scarcest resource in a single-document runtime.

---

## Verification

```bash
npm test                         # graph validation + runtime smoke + static audit + shell/UI suites
npm run validate:graph           # graph/provenance checks only
npm run audit:json               # full findings with evidence, if it does not
npm run test:shell               # real PTY/gate/agent tests (optional dependencies)
npm run test:ui                  # shell-client degradation tests (jsdom)
npm start                        # then follow docs/TESTING.md and docs/SHELL.md
```

### If the audit fails

```
seen > allowed   →  regression: fix it, or baseline it deliberately (see below)
seen < allowed   →  improvement: refresh the baseline to lock it in
```

Refreshing the baseline is a **reviewed change**, not a formality: it rewrites
`scripts/audit-baseline.json`, and the diff is the justification.

```bash
npm run audit:baseline
git diff scripts/audit-baseline.json     # must contain only the intended change
```

Never refresh a baseline to silence a regression you do not understand. If a count rose unexpectedly,
you have found something — that is the tool working.

### Manual verification

Static analysis cannot see behaviour. Any change that affects rendering, interaction or audio must be
verified by hand against the relevant tasks in [`docs/TESTING.md` § 3](docs/TESTING.md#3-manual-verification-tier).
Console cleanliness is a hard requirement: zero errors, zero warnings introduced.

---

## Commit convention

[Conventional Commits](https://www.conventionalcommits.org/), with a scope from the engine inventory:

```
<type>(<scope>): <description>

[optional body — why, not what]

[optional footer: Closes #12 · Refs NOO-016]
```

| Type | Use for |
| --- | --- |
| `feat` | New behaviour or subsystem |
| `fix` | Fixes a register item |
| `docs` | Documentation only |
| `refactor` | Behaviour-preserving restructure |
| `perf` | Performance work (state the measured or modelled effect) |
| `test` | Audit checks and harness changes |
| `chore` | Tooling, config, dependencies |
| `style` | Formatting with no behaviour change |

| Scope | Area |
| --- | --- |
| `graph` `window` `polymath` `ingest` `aesthetic` `grimoire` `combinator` | Engines and windows |
| `audit` `ci` | Tooling |
| `docs` `readme` `changelog` | Documentation |
| `a11y` | Accessibility work |

**Examples**

```
fix(aesthetic): resolve undefined crimson colour family — NOO-001
feat(graph): fixed-timestep integration — NOO-020
docs(architecture): correct pair-evaluation count in § 8.3
a11y(window): label icon-only controls — NOO-016
```

One logical change per commit. If a commit's message needs the word "and", it is two commits.

---

## Pull requests

1. **Claim the work** — comment on the issue for that register ID so two people do not duplicate it.
2. **Branch** — `type/scope-short-description` (e.g. `fix/aesthetic-crimson-family`).
3. **Change, verify, document** — update the affected docs in the *same* pull request. A signature
   change without an `API.md` update will be sent back.
4. **Open the PR** using the template. It asks for the three things a reviewer needs:
   - which register ID(s) this closes,
   - the audit delta (`seen → allowed` before and after),
   - which manual-matrix tasks you ran.
5. **Respond to review** with new commits, not force-pushes, until approval.

Keep pull requests small. A 40-line change with a clear narrative gets reviewed thoroughly; a 600-line
change gets reviewed politely.

---

## Review rubric

Reviewers apply the same list the author used. A change is ready when all nine hold.

| # | Criterion |
| --- | --- |
| 1 | `npm test` exits 0, and any count change is explained in the description |
| 2 | The change is visible and correct in a browser, verified against the manual matrix |
| 3 | The console is clean — no errors, no warnings introduced |
| 4 | No framework/build step; any optional dependency is pinned, ADR-reviewed, and does not block static corpus use |
| 5 | Raw hex values do not appear in workspace markup; new design colours use documented tokens |
| 6 | Static app files remain directly hostable; shell assets degrade cleanly without the local bridge |
| 7 | A new audit register ID is added to `scripts/audit.mjs`, its documentation, and the roadmap |
| 8 | Documentation that would become stale is updated in the same PR |
| 9 | The corpus stays non-clinical, and source facts, interpretations, synthesis, and open questions remain distinct |

**Severity discipline.** If your change adds a defect, classify it honestly. `NOO-001` was rated
*high* because a missing border is visible on first load; a mis-ordered preference would be *low*.
Severity decides whether the roadmap interrupts the current horizon, so inflating it has a real cost.

---

## Recipes

### Curate a source concept, relationship, or fragment

1. Edit the appropriate definition in `scripts/build-zaziopath-graph.mjs` (`sourceNodes`, `concepts`, `wireRows`, `authoredRelationships`, or `fragmentDefinitions`).
2. Include a source path, stable locator/anchor, bounded excerpt when available, and the correct stratum/epistemic status. Reuse README-indexed wires before adding any other edge; unsupported links are omitted or explicitly marked non-source.
3. Build against a named local Zaziopath revision, inspect the generated diff, then run `npm test` and `npm run validate:graph`.

Grimoire is rendered from committed `data/zaziopath-graph.js`, not from a runtime-discovered placeholder array.

### Add a palette

```js
// PALETTES — five hex strings per state, ordered from darkest surface to brightest accent
['#0b0f1a', '#1a2233', '#00f7ff', '#ff0055', '#a855f7']
```

Swatches are generated, click-to-copy and CSS-exportable automatically.

### Change stratum filtering

The eight source-defined Zaziopath strata are fixed by the corpus contract. If a label or filter control changes, update the committed stratum metadata, toolbar, graph filter, and relevant provenance/UI documentation together. Do not invent a replacement domain taxonomy or treat color as evidence strength.

### Add a Polymath directive

1. Add a bounded behavior to `polymathLLM.runDirective(type, data)` in `index.html`.
2. Expose it through the existing terminal controls only if it adds a useful, source-aware action.
3. Keep any output cited/epistemically labeled; cover selection and fallback behavior with `scripts/test-runtime.mjs`.

### Fix an accessibility issue

Follow [`ACCESSIBILITY.md` § 8](docs/ACCESSIBILITY.md#8-remediation-plan): pick the item, implement
the stated fix, then record the new state in that document. Contrast changes must include the
recomputed ratio — the formula used is documented in § 3.

---

## Documentation contributions

Documentation is held to the same standard as code:

- **Every number must be reproducible** — run `npm test` and cite the audit, or show the command.
- **Never claim a mechanism that does not exist.** Verify runtime details against `index.html`, `server/`, and `shell/`; `ARCHITECTURE.md` § 10 documents the workstation extension.
- **Prefer tables and diagrams to paragraphs** for structural information.
- **Update the spine.** The 21 register IDs are shared across the audit, the architecture document,
  the accessibility audit, the roadmap and the changelog. If you change an ID or its title, update
  every document that references it in the same PR.

---

## What will not be merged

Stated up front to save everyone a review cycle. Each refusal maps to a recorded decision.

| Rejected | Reason |
| --- | --- |
| Replacing Canvas/draggable windows with a framework or graph library | [ADR-001](docs/DECISIONS.md#adr-001--single-file-delivery), [ADR-003](docs/DECISIONS.md#adr-003--vanilla-javascript-no-framework), [ADR-004](docs/DECISIONS.md#adr-004--canvas-2d-for-the-graph) |
| Making static corpus use depend on a service, database, auth, analytics, or cloud inference | [ADR-006](docs/DECISIONS.md#adr-006--no-persistence-optional-local-inference), [ADR-012](docs/DECISIONS.md#adr-012--optional-loopback-only-ollama-inference) |
| Additional models, embeddings, vector databases, or remote inference providers | Preserve the exact local `llama3.1:8b` boundary; [ADR-012](docs/DECISIONS.md#adr-012--optional-loopback-only-ollama-inference) |
| Persisting browser ingestion/notes to `localStorage`, cookies, or an unreviewed service | [ADR-006](docs/DECISIONS.md#adr-006--no-persistence-optional-local-inference) |
| Exposing the real host PTY without the explicit high-risk token opt-in, or describing it as sandboxed | [ADR-016](docs/DECISIONS.md#adr-016--the-shell-is-unsandboxed-and-gated-at-the-network-boundary), [`SECURITY.md`](SECURITY.md) |
| Clinical/personality diagnosis claims or unsupported graph relationships | [ADR-013](docs/DECISIONS.md#adr-013--epistemic-labels-and-non-clinical-framing), [`ZAZIOPATH-CORPUS.md`](docs/ZAZIOPATH-CORPUS.md) |
| Dependencies added without an ADR or without preserving the degraded static path | [ADR-015](docs/DECISIONS.md#adr-015--optional-workstation-dependencies-with-a-degraded-mode), [`MAINTAINABILITY.md`](docs/MAINTAINABILITY.md) |

---

## Getting help

- **Questions about a change** → open a discussion or comment on the issue for that register ID.
- **Unsure where to start** → choose a focused usability, accessibility, test, or documentation item from [`ROADMAP.md`](docs/ROADMAP.md).
- **Security concerns** → do **not** open a public issue; follow [`SECURITY.md`](SECURITY.md).

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are
accepted under the [MIT License](LICENSE).

---

<div align="center">
<sub>Every rule above protects the zero-build corpus core and its optional, separately gated workstation shell.</sub>
</div>
