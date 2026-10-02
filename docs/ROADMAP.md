# Roadmap

> What is being fixed, what is being added, and what is deliberately refused — with the register IDs,
> acceptance criteria and effort estimates needed to pick something up.

**Tracing rule:** every item below is either a register entry ([`ARCHITECTURE.md` § 17](ARCHITECTURE.md#17-defect-register))
or an ADR consequence. Nothing arrives on this roadmap as a preference.

**Releases:** `9.4.2` correctness · `9.5.0` fidelity and trust · `10.0.0` structure and access.

---

## Reading this document

| Column | Meaning |
| --- | --- |
| **ID** | Register entry, or `—` for work with no defect attached |
| **Effort** | XS < 1 h · S < 1 day · M < 1 week · L > 1 week |
| **Impact** | What changes for a user if this lands |
| **Acceptance** | The objective condition that closes the item |

Horizons are named after [Semantic Versioning](https://semver.org): patches are corrections, minors
are additive fidelity, majors are structural or contract-breaking.

---

## Now — `9.4.2` · Correctness

Theme: **the artefact should not contradict itself.** Every item here is small, verifiable, and
either removes a visible flaw or makes an advertised number true.

| ID | Item | Effort | Impact | Acceptance |
| --- | --- | --- | --- | --- |
| `NOO-019` | **Viewport-aware default layout** — clamp and flow the seven windows on boot and resize; keep the desktop metaphor | M | The synthesizer window stops being unreachable on ≤1500 px displays | No window requires a viewport wider than 1280 px to be grabbable; the audit's `NOO-019` count reaches 0 |
| `NOO-001` | **Fix the undefined colour family** — rename `crimson-*` utilities to `neon-crimson-*`, or promote `crimson` to a top-level family | XS | Restores six missing borders; the analytics window stops blending into its background | `NOO-001` reaches 0; the affected panels show their intended borders in all three browsers |
| `NOO-006` | **Replace the invalid Lucide icon** (`dread` → a real name such as `brain-circuit`) | XS | The combinator window regains its header glyph | `NOO-006` reaches 0; the icon renders |
| `NOO-007` | **Escape human-origin interpolation** — route prompt text and dropped filenames through `textContent` or an `escapeHtml` helper | S | Closes the only trust-boundary problem in the runtime | `NOO-007` reaches 0; a filename containing `<img src=x onerror=…>` renders as literal text |
| `NOO-009` | **Make advertised content true** — either correct "240+ fragments" / the `.PDF` claim, or ship the corpus | XS | The interface stops over-claiming | Every claim in the chrome matches its data; `NOO-009` reaches 0 |
| `NOO-010` | **Derive all counters from one source** — badge and boot banner read `graphNodes.length` | XS | Header, banner and reality agree at 90 nodes | `NOO-010` reaches 0; injecting a node updates all three |
| `NOO-011` | **Add the missing domain filter** (alchemical OS) | XS | The fifth domain becomes isolatable | `NOO-011` reaches 0; filtering by alchemy shows only its nodes |
| `NOO-012` | **Add the synthesizer to the dock** | XS | The seventh window gains a launcher, compounding the `NOO-019` fix | `NOO-012` reaches 0; the dock lists 7 |
| `NOO-002` | Replace `py-0.2` with a valid spacing step | XS | Correct padding on window badges | `NOO-002` reaches 0 |
| `NOO-003` | Declare the `fadeIn` animation used by ingested artefact rows | XS | Rows animate in as intended | `NOO-003` reaches 0 |
| `NOO-004` | Define the `.no-scrollbar` utility | XS | The directive strip scrolls without a visible bar | `NOO-004` reaches 0 |
| `NOO-005` | Delete or apply the dead `pulse-glow` / `scanline` animations | XS | Removes misleading config | Either applied and visible, or removed; `NOO-005` reaches 0 |
| `NOO-013` | **Resolve the static "live" readouts** — drive them from state, or relabel them as static | S | Removes four places where the UI narrates activity that does not exist | `NOO-013` reaches 0 by either route; the choice is documented |

**Patch exit criteria:** the audit reports **≤ 8 findings** (from 38), the payload stays under
90,000 B, and no new register ID is introduced. Accessibility P0 items from
[`ACCESSIBILITY.md`](ACCESSIBILITY.md#8-remediation-plan) ship in this release as well.

---

## Next — `9.5.0` · Fidelity and trust

Theme: **make it look right everywhere, tell the truth about itself, and become testable.**

| ID | Item | Effort | Impact | Acceptance |
| --- | --- | --- | --- | --- |
| `NOO-014` | **HiDPI canvas** — scale the backing store by `devicePixelRatio` (cap at 2× to bound fill cost) | S | The graph stops being soft on every modern laptop and Mac display | Node edges are crisp at DPR 2; the frame sampler stays under 16.7 ms p95 |
| `NOO-018` | **Link-preview metadata** — description, favicon, Open Graph/Twitter set, theme colour | XS | Shared links render as a card instead of a bare URL — the highest-value item for a portfolio artefact | Validators pass; the card renders in Slack/X/iMessage previews |
| `NOO-008` | **Vendor and pin the three CDN dependencies** — build Tailwind once at release, subset and self-host the fonts, ship a pinned Lucide sprite | M | Offline parity; no vendor drift; enables the hardened CSP | Zero third-party origins; the app renders identically with the network disabled |
| `NOO-020` | **Fixed-timestep physics** — 60 Hz accumulator with interpolated rendering | S | Identical dynamics on 60/120/144 Hz; ~2.4× less simulation work on fast displays | The sampler shows the same p95 on a 144 Hz panel; node motion matches at 60 Hz |
| `NOO-021` | **Seeded RNG + `?seed=`** — replace the 19 `Math.random()` call sites with a seeded generator | S | Deterministic demos, shareable layouts, reproducible bug reports | The same seed produces an identical first frame, twice in a row |
| — | **`prefers-reduced-motion`** (P1 accessibility) | S | Removes continuous animation for users who request it | With the OS setting enabled: one static frame, no ambient loops, no content loss |
| — | **`aria-live` regions** (P1 accessibility) | S | Announces ingestion, injection and composition to screen readers | Transcript, ingestion status and node counter announce without stealing focus |
| — | **Window semantics and headings** (P1 accessibility) | S | Gives assistive technology a navigable structure for seven windows | Each window is a labelled region with a heading; the audit ratchets `NOO-016` down |
| — | **Modal focus management** (P1 accessibility) | S | Keyboard users can enter, use and leave the injection modal | Initial focus set, `Escape` closes, focus returns to the trigger |
| — | **Headless harness** — Playwright, pinned, dev-only, driven by the seeded layout | M | Behavioural and visual regression at three reference widths; would have caught `NOO-019` automatically | CI runs the harness; the 1280 px visual case fails on the pre-fix commit and passes after |
| — | **README screenshot + live demo link** | XS | Replaces the placeholder block once the layout is stable | Committed capture at 1440 px from a seeded run |

**Minor exit criteria:** `NOO-016` reduced to a single ratcheted count; accessibility P0 and P1
complete; the harness runs in CI; payload under 96,000 B including vendored assets (the budget will
be re-baselined deliberately in this release, with the reason recorded).

---

## Later — `10.0.0` · Structure and access

Theme: **change the shape of the artefact without changing the promise that it is one openable
file.** Major version because these items move the contract, not just the implementation.

| ID | Item | Effort | Impact | Acceptance |
| --- | --- | --- | --- | --- |
| `NOO-015` | **Spatial index + worker physics** — uniform grid broad phase, optionally off the main thread with transferable typed arrays | L | Supports a much larger graph (300+ nodes) at 60 fps | Pair work drops from `O(n²)` to `O(n·k)`; the graph scales to 300 nodes within budget |
| `NOO-016` | **Keyboard and assistive-technology model** — canvas text alternative, keyboard pan/zoom, node traversal, keyboard window movement | L | Makes the centrepiece usable without a pointing device | The full manual matrix in [`ACCESSIBILITY.md` § 9](ACCESSIBILITY.md#9-verification-plan) passes with a keyboard only |
| — | **Module extraction behind an optional bundler** — one module per PR, `index.html` untouched until the shell swap | L | Reviewability of a growing codebase; keeps the single-file artefact shippable | Source modules exist, a build produces a byte-equivalent artefact, and the audit runs in both modes |
| — | **Templated window chrome** | M | Removes the largest duplication (42 KB of markup > 41 KB of logic) | One template renders all seven windows; markup volume drops materially |
| — | **`TUNING` constants block** | XS | Behaviour adjustable without reading the physics | All 12 tunables in one frozen object, referenced by name |
| `NOO-017` | **Delegated drag listeners** | S | Removes 14 permanent `document` listeners | One delegated listener pair regardless of window count |
| — | **Shareable state** (`#state=` fragment) | M | Reproducible layouts without a backend, consistent with [ADR-006](DECISIONS.md#adr-006--no-persistence-no-backend) | A copied URL restores graph, palette and transcript state with no server involved |
| — | **Fourth domain-composition pass** — grow the vocabulary table so the composer's variation space scales with the corpus | S | Keeps the satire generative rather than repetitive | Composition space documented in `ARCHITECTURE.md` § 12 and updated in the same PR |

**Major exit criteria:** the canvas has a real text alternative; the app is operable by keyboard;
the payload budget is either met or the single-file decision is formally revisited in a superseding
ADR.

---

## Explicitly not planned

Refusals are roadmap decisions too. Each of these would contradict a recorded ADR.

| Not planned | Why |
| --- | --- |
| A backend, accounts or cloud sync | [ADR-006](DECISIONS.md#adr-006--no-persistence-no-backend): the artefact must run offline, forever, with nobody paying for it |
| A real LLM integration | [ADR-005](DECISIONS.md#adr-005--deterministic-procedural-content): determinism, zero cost and offline operation *are* the piece |
| A framework migration | [ADR-003](DECISIONS.md#adr-003--vanilla-javascript-no-framework): there is no synchronisation problem to solve |
| Analytics or telemetry of any kind | Contradicts the privacy posture; the deployable artefact makes no network calls |
| A mobile layout | The desktop metaphor is the design; **reachability** on small screens is fixed (`NOO-019`), a responsive re-layout is not attempted |
| A light theme | [One theme, executed completely](DESIGN.md#10-anti-patterns) |
| Localisation | The satire is language-specific; a translation would be a separate artistic decision, not a roadmap item |
| Rendering the app as a component library for reuse | Speculative until a second consumer exists; § 7 of [`MAINTAINABILITY.md`](MAINTAINABILITY.md#7-extraction-plan) is the prerequisite |

---

## Contribution flow

```mermaid
flowchart LR
  A["Pick an item below<br/>(or propose one via an issue)"] --> B{"Claimed yet?"}
  B -- no --> C["Comment on the issue / open one"]
  C --> D["Branch: type/scope-short-description"]
  D --> E["Change + npm test + manual matrix"]
  E --> F["PR: Conventional Commit title,<br/>register delta stated"]
  F --> G{"Review: audit green,<br/>criteria met, docs updated"}
  G -- changes --> E
  G -- approve --> H["Squash-merge to main"]
```

**Good first issues:** every `XS` item in `9.4.2` except `NOO-019` — each is a single, verifiable
correction with an objective acceptance criterion and a corresponding audit check that will flip to
zero. That is deliberate: the register doubles as an onboarding queue.

**Claiming an item:** open or comment on an issue named `<ID> — <title>`, and say which horizon you
are working in. Two people on one register ID is wasted effort; the ID itself prevents collisions.

---

## Traceability matrix

Every register ID mapped to its horizon. This is the audit's register, kept in lockstep with
[`ARCHITECTURE.md` § 17](ARCHITECTURE.md#17-defect-register) — if the two disagree, the audit's copy
wins.

| Horizon | Register IDs | Count |
| --- | --- | --- |
| `9.4.2` | `NOO-001` `NOO-002` `NOO-003` `NOO-004` `NOO-005` `NOO-006` `NOO-007` `NOO-009` `NOO-010` `NOO-011` `NOO-012` `NOO-013` `NOO-019` | 13 |
| `9.5.0` | `NOO-008` `NOO-014` `NOO-018` `NOO-020` `NOO-021` | 5 |
| `10.0.0` | `NOO-015` `NOO-016` `NOO-017` | 3 |
| **Total** | | **21** |

Progress is measured by the baseline shrinking — not by this document being edited.

---

<div align="center">
<sub>Next: <a href="../CHANGELOG.md">Changelog →</a></sub>
</div>
