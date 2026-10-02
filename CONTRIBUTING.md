# Contributing to NOÖSPHERE // OS

> Conventions, verification, and the review rubric — everything a contributor needs to land a change
> without a round trip.

Thanks for considering a contribution. This project has an unusual shape (one file, no build, no
dependencies), so the conventions below matter more than usual: they are what keeps a single
1,477-line document reviewable by other people.

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
| **Fix a register item** | [`ROADMAP.md` § Now](docs/ROADMAP.md#now--942--correctness) — all `XS` items except `NOO-019` are scoped for first-time contributors |
| **Improve accessibility** | [`ACCESSIBILITY.md` § 8](docs/ACCESSIBILITY.md#8-remediation-plan) — P0 items are minutes of work and high impact |
| **Tune the artefact** | [`MAINTAINABILITY.md` § 4](docs/MAINTAINABILITY.md#4-tunable-surface) — every constant that changes behaviour, in one table |
| **Add content** | A fragment, palette, seed theme or directive: one array, no code |
| **Correct the documentation** | Docs are a deliverable, not a by-product — factual corrections are welcome and treated as code changes |
| **Report a defect** | Use the issue forms; if it is not in the register, it will be added with an ID |

---

## Setup

```bash
git clone https://github.com/zazieproductions/Prometheus-Noosphere-v9.4.git
cd Prometheus-Noosphere-v9.4

npm start          # → http://localhost:4173   (no install step)
npm test           # static integrity audit — must exit 0
```

**There is nothing to install.** Node.js ≥ 18 is required only for the audit and dev server; both use
the standard library. If you find yourself reaching for a package manager to work on this project,
stop and read [ADR-007](docs/DECISIONS.md#adr-007--zero-dependency-tooling-with-a-ratcheted-audit).

---

## Project conventions

### The five constraints

Every change must respect these. They are the project's thesis, not preferences
([`DECISIONS.md`](docs/DECISIONS.md)).

1. **One document.** `index.html` is the only artefact required to run the application.
2. **No build step.** `git clone` → open → it works.
3. **No installed runtime dependencies.** Tooling may use the Node standard library only.
4. **No backend.** No `fetch`, `XMLHttpRequest`, `WebSocket`, storage or cookies in the runtime.
5. **Tokens by name.** Never a raw hex value in the workspace markup; colour arrives as a semantic
   token from the inline `tailwind.config`.

### Code style

| Area | Convention |
| --- | --- |
| Indentation | 4 spaces in `index.html`, 2 spaces in `scripts/` and config (see `.editorconfig`) |
| Line endings | LF, final newline, no trailing whitespace |
| JavaScript | ES2020, no semicolon-less style, `const`/`let`, no classes unless a data structure demands one |
| Naming | Engine objects `camelCase` (`graphEngine`); methods are verbs (`injectNode`, `filterDomain`); DOM ids `kebab-case` |
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
npm test                # the audit — must exit 0
npm run audit:json      # full findings with evidence, if it does not
npm start               # then walk the relevant tasks in docs/TESTING.md § 3
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
| 4 | No new runtime dependency, no build step, no network call added to the runtime |
| 5 | Raw hex values do not appear in markup; new colours are tokens, documented in `DESIGN.md` |
| 6 | `index.html` remains the only artefact required to run the app |
| 7 | A new register ID (if any) is added to `scripts/audit.mjs`, the register table, and the roadmap |
| 8 | Documentation that would become stale is updated in the same PR |
| 9 | The change honours the satire framing: nothing may present the corpus as advice |

**Severity discipline.** If your change adds a defect, classify it honestly. `NOO-001` was rated
*high* because a missing border is visible on first load; a mis-ordered preference would be *low*.
Severity decides whether the roadmap interrupts the current horizon, so inflating it has a real cost.

---

## Recipes

### Add a knowledge fragment

```js
// GRIMOIRE_DATA — one entry, no code changes
{ title: "…", tags: "#domain #domain", text: "…" }
```

Keep the register honest: if the window advertises "240+ fragments", either ship the corpus or correct
the copy (`NOO-009`).

### Add a palette

```js
// PALETTES — five hex strings per state, ordered from darkest surface to brightest accent
['#0b0f1a', '#1a2233', '#00f7ff', '#ff0055', '#a855f7']
```

Swatches are generated, click-to-copy and CSS-exportable automatically.

### Add a domain (three sites — this is `NOO-011`'s root cause)

1. `DOMAINS` — key, display name, colour.
2. The toolbar — `<button onclick="graphEngine.filterDomain('mykey')" class="domain-btn" data-d="mykey">…</button>`.
3. The modal selector — an `<option value="mykey">`.

Then `npm run audit:baseline` if `NOO-011`'s count changes, and update
[`DESIGN.md`](docs/DESIGN.md) if the new domain claims an accent hue.

### Add a directive

1. A `VOCAB` slice (or reuse an existing one).
2. A branch in `runDirective(type, data)`.
3. A chip in the terminal toolbar.

### Fix an accessibility issue

Follow [`ACCESSIBILITY.md` § 8](docs/ACCESSIBILITY.md#8-remediation-plan): pick the item, implement
the stated fix, then record the new state in that document. Contrast changes must include the
recomputed ratio — the formula used is documented in § 3.

---

## Documentation contributions

Documentation is held to the same standard as code:

- **Every number must be reproducible** — run `npm test` and cite the audit, or show the command.
- **Never claim a mechanism that does not exist.** This is the reason `ARCHITECTURE.md` § 18
  translates the interface's vocabulary into engineering terms.
- **Prefer tables and diagrams to paragraphs** for structural information.
- **Update the spine.** The 21 register IDs are shared across the audit, the architecture document,
  the accessibility audit, the roadmap and the changelog. If you change an ID or its title, update
  every document that references it in the same PR.

---

## What will not be merged

Stated up front to save everyone a review cycle. Each refusal maps to a recorded decision.

| Rejected | Reason |
| --- | --- |
| A framework, bundler or CSS preprocessor in the default path | [ADR-001](docs/DECISIONS.md#adr-001--single-file-delivery), [ADR-002](docs/DECISIONS.md#adr-002--no-build-step-tailwind-play-cdn) |
| A backend, database, auth or analytics | [ADR-006](docs/DECISIONS.md#adr-006--no-persistence-no-backend) |
| A real LLM integration | [ADR-005](docs/DECISIONS.md#adr-005--deterministic-procedural-content) |
| Persisting state to `localStorage` or cookies | [ADR-006](docs/DECISIONS.md#adr-006--no-persistence-no-backend) |
| Mobile-responsive re-layout of the desktop metaphor | [`ROADMAP.md` § Not planned](docs/ROADMAP.md#explicitly-not-planned) — reachability is fixed instead (`NOO-019`) |
| New accent colours or a second display face | [`DESIGN.md` § 10](docs/DESIGN.md#10-anti-patterns) |
| Changes that present the satirical corpus as real technique | [`SECURITY.md`](SECURITY.md), [ADR-008](docs/DECISIONS.md#adr-008--satirical-corpus-with-explicit-disclosure) |
| Dependencies added without an ADR | [`MAINTAINABILITY.md` § 2](docs/MAINTAINABILITY.md#2-dependency-policy) |

---

## Getting help

- **Questions about a change** → open a discussion or comment on the issue for that register ID.
- **Unsure where to start** → pick any `XS` item in the `9.4.2` horizon; they are designed as
  onboarding.
- **Security concerns** → do **not** open a public issue; follow [`SECURITY.md`](SECURITY.md).

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are
accepted under the [MIT License](LICENSE).

---

<div align="center">
<sub>Every rule above exists because a single-file artefact is only as maintainable as its conventions.</sub>
</div>
