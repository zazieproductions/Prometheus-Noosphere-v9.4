# Testing Strategy

> What is verified automatically, what is verified by hand, what is knowingly unverified — and how
> to add a check without adding a dependency.

**Current state:** `npm test` → **PASS** (21 register IDs, 38 tracked findings, 0 fatal violations).
**Test framework:** none, by design ([ADR-007](DECISIONS.md#adr-007--zero-dependency-tooling-with-a-ratcheted-audit)).

---

## 1. Philosophy

A single HTML document with no build step has three options: no verification, a heavyweight toolchain,
or **verification that is honest about its own blind spots**. This project takes the third.

Three principles decide what gets automated:

1. **Automate what is mechanically provable.** Referential integrity, token resolution, parity between
   a number and the data that produces it. These have no false positives worth worrying about.
2. **Ratchet what is genuinely debt.** Known defects are allowed to exist, but the count is recorded
   in a file and CI fails when it grows. This converts "we know about it" from a claim into a diff.
3. **Never claim more than the tool can see.** Everything the audit cannot check is enumerated in
   [§ 4](#4-what-the-audit-cannot-see) rather than left to implication.

---

## 2. The automated tier — `npm test`

`scripts/audit.mjs` reads `index.html` as text and applies 21 register checks plus 4 always-fatal
rules. Runtime: ~0.4 s. Dependencies: none.

A second script, `scripts/smoke.mjs`, executes the runtime itself against a DOM stub — 36 behavioural
assertions, no dependencies, ~3 s of simulated time. Run both with `npm run verify`. It is documented
in [§ 7.2](#72-the-smoke-harness--npm-run-smoke).

### 2.1 Always-fatal rules (never baselined, never tolerated)

| Rule | What it proves | Why it is safe to automate |
| --- | --- | --- |
| No duplicate `id` | The DOM contract is unambiguous | HTML spec requirement; no judgement involved |
| Every `getElementById('x')` resolves | No silent `null` dereference at runtime | Exact string match against 68 declared IDs |
| Every `restoreOrFocus('win-…')` target exists | The dock cannot point at a deleted window | Same mechanism |
| Every inline handler calls a defined global | No `ReferenceError` on click | Method calls excluded; only bare globals must resolve |

These four were chosen because each is a **whole class** of bug that is cheap to detect and expensive
to debug in a document with no module boundaries.

### 2.2 Ratcheted register checks

| ID | Check | Detection method |
| --- | --- | --- |
| `NOO-001` | Undefined Tailwind colour family | Parses the `colors` block to learn the real families, then scans class strings only (not CSS) |
| `NOO-002` | Invalid spacing step | Matches fractional spacing utilities; only `.5` steps exist |
| `NOO-003` / `NOO-005` | Animation asymmetry | Compares declared animation names against `animate-*` usage |
| `NOO-004` | Undefined project class | Requires a `<style>` rule for purely visual project classes |
| `NOO-006` | Unresolvable Lucide icon | Compares against the icon list exported from `lucide-static` |
| `NOO-007` | Unescaped `innerHTML` interpolation | Template-literal scan, filtered to human-origin expressions |
| `NOO-008` | Unpinned runtime dependency | CDN URL must carry a version or commit pin |
| `NOO-009` / `NOO-010` | Advertised volume vs. shipped data | Extracts claims ("240+ fragments", "142 NODES") and compares against the data |
| `NOO-011` | Domain without a filter | Compares `DOMAINS` keys against `filterDomain(...)` call sites |
| `NOO-012` | Window missing from the dock | Compares window IDs against `restoreOrFocus` targets |
| `NOO-013` | "Live" element never written | Curated watchlist; the *condition* (zero writes) is verified mechanically |
| `NOO-014` | Canvas not DPR-scaled | Absence of `devicePixelRatio` |
| `NOO-015` | `O(n²)` broad phase | Derives pair count from the spawn count and reports it |
| `NOO-016` | Accessibility semantics absent | Counts `aria-*` / `role` / `tabindex` |
| `NOO-017` | Per-window listener multiplication | Counts `document.addEventListener` inside `makeDraggable` |
| `NOO-018` | Missing link-preview metadata | Checks for description, favicon and OG tags |
| `NOO-019` | Unreachable default geometry | Parses the window grid; computes required viewport width per window |
| `NOO-020` | Frame-rate-dependent physics | Scans `updatePhysics` for any `deltaTime` term |
| `NOO-021` | Non-reproducible initial state | Counts `Math.random()`; checks for a seeded PRNG helper |

**Detection is deliberately conservative.** `NOO-001` scans class attributes rather than the whole
document (which would flag `border-radius`); `NOO-007` only counts free variables that originate from
a human (member access on module constants is inert); `NOO-013` uses a curated watchlist but verifies
the condition mechanically. A check that cries wolf gets ignored, and an ignored check is worse than
no check.

### 2.3 Ratchet semantics

```
seen > allowed   →  FAIL      a regression; fix it or justify the baseline change in a PR
seen = allowed   →  PASS      known debt, reported as "tracked"
seen < allowed   →  PASS      improvement; refresh the baseline to lock it in
```

Refresh **only** in the pull request that changed the count:

```bash
npm test                      # inspect the delta first
npm run audit:baseline        # rewrite scripts/audit-baseline.json
git diff scripts/audit-baseline.json   # the diff IS the justification, and it is reviewable
```

The baseline file is human-readable JSON with sorted keys, precisely so that a reviewer sees the
change in a diff rather than trusting a number in a comment.

---

## 3. Manual verification tier

Behaviour that static analysis cannot reach is verified by playing the app. This matrix is task-based
rather than control-based, and is stepped through before every release.

### 3.1 Window manager

| # | Task | Expected |
| --- | --- | --- |
| 1 | Drag a window by its header | Follows the pointer; cannot be dragged above/left of the origin |
| 2 | Click into a background window | Raises to front; only one window shows the active glow |
| 3 | Minimise, then restore from the dock | Returns with its previous geometry and gains focus |
| 4 | Maximise, then restore | Exact previous geometry, position included |
| 5 | Click **RE-ALIGN** | All seven windows return to the authored grid, all visible |
| 6 | Drag on a window's header *button* | No drag; the control's own action fires |

### 3.2 Graph atlas

| # | Task | Expected |
| --- | --- | --- |
| 7 | Drag the canvas | Pan without moving any window |
| 8 | Scroll on the canvas | Zoom about the canvas centre; clamps at 0.3× and 3.0×; page does not scroll |
| 9 | Hover a node | HUD appears with domain, title, description and valence; node enlarges and whitens |
| 10 | Click a node | Terminal receives a system line and a deterministic deep-dive response |
| 11 | Filter by domain | Only that domain's nodes and edges render; the active chip takes underline **and** bold **and** colour |
| 12 | **Recluster** | Every node displaces; simulation re-settles without explosion or NaN |
| 13 | Toggle labels | Labels appear/disappear; LOD still applies while visible |

### 3.3 Ingestion

| # | Task | Expected |
| --- | --- | --- |
| 14 | Drop a `.txt` file | Status → amber "INGESTING…"; a node appears in the graph; a feed row is prepended; transcript gets a system line; status settles to "CORPUS SYNCHRONIZED" |
| 15 | Drop three files at once | Three nodes, three feed rows, three transcript lines |
| 16 | Drop a binary `.pdf` | Documents the known defect: mojibake text is tokenised (`NOO-009` copy accuracy) — must not throw |
| 17 | Use "BROWSE LOCAL ARTIFACTS" | Identical behaviour to drop |

### 3.4 Terminal, aesthetic, grimoire, combinator

| # | Task | Expected |
| --- | --- | --- |
| 18 | Type a prompt, press `Enter` | Echo with `USER@POLYMATH` prefix; composed response ≈400 ms later |
| 19 | Click all four directive chips | Echo + response; audio confirmed when enabled |
| 20 | Flush the buffer | Transcript empties, including the boot banner |
| 21 | Play all three tones | Audible tones; frequency readout changes; no autoplay warning |
| 22 | Toggle acoustics off, then interact | No sound anywhere; the toggle label updates |
| 23 | Mutate the palette, click a swatch | Swatches rotate; hex copies; transcript confirms |
| 24 | **COPY CSS VARS** | Five `--accent-*` declarations on the clipboard |
| 25 | Search the grimoire ("deleuze", "memes", "occult") | Case-insensitive filtering across title, body and tags |
| 26 | Click a grimoire fragment | System line + composed response |
| 27 | Synthesize a mutation | Pending state → mutation; result appears in the box *and* as a `hyperstition` node |
| 28 | Inject a custom node (modal) | Node appears with the chosen domain; modal closes; transcript confirms |

### 3.5 Global behaviour

| # | Task | Expected |
| --- | --- | --- |
| 29 | Leave running for 5 minutes | Clock advances each second; gauges drift; no memory blow-up; no console errors |
| 30 | Reload | Identical authored state — no persistence anywhere |
| 31 | Resize the viewport | Canvas re-sizes; windows keep their pixel geometry (and may clip — `NOO-019`) |
| 32 | Open the console | Zero errors and zero network calls after load |

**Console cleanliness is a hard requirement.** A single uncaught exception in a document with no
module boundaries can take down an entire engine silently.

### 3.6 Cross-browser

| Target | Minimum version | Notes |
| --- | --- | --- |
| Chromium | current stable | Baseline target |
| Firefox | current stable | `backdrop-filter` behaviour differs; verify glass legibility |
| Safari | 16+ | `-webkit-backdrop-filter` prefix is present; verify audio unlock on first gesture |

---

## 4. What the audit cannot see

This section exists so that "tests pass" is never mistaken for "it works".

| Blind spot | Consequence | Mitigation |
| --- | --- | --- |
| **Rendered output** | A correct class name can still produce the wrong pixel | Manual matrix; the smoke harness exercises draw paths but cannot see pixels; headless harness planned |
| **CSS cascade outcomes** | The audit knows a family is undefined; it cannot know what a utility resolves to | Contrast table in [`DESIGN.md`](DESIGN.md) is measured by formula, not by browser |
| **Runtime state** | A real browser still does not execute `index.html` in CI | The smoke harness executes the runtime against a DOM stub; the manual matrix covers the browser |
| **Timing and race conditions** | The ingestion pipeline has concurrent `FileReader` callbacks with no ordering guarantee | Manual multi-file test (#15) |
| **Frame rate** | Costs are modelled from complexity, not measured | Harness in [`PERFORMANCE.md` § 6](PERFORMANCE.md#6-profiling-method) |
| **Accessibility behaviour** | Static counts cannot prove an accessible name is *useful* | Manual AT pass planned in [`ACCESSIBILITY.md` § 9](ACCESSIBILITY.md#9-verification-plan) |
| **Layout at other viewports** | Geometry is checked against two reference widths only | Manual resize matrix (#31) |
| **Third-party drift** | Unpinned CDNs can change behaviour under a fixed commit (`NOO-008`) | Pin or self-host (roadmap `9.5.0`) |

---

## 5. Adding a check

New checks follow the existing shape: derive the fact from the source, compare to the baseline, emit
evidence. No framework, no assertion library.

```js
// scripts/audit.mjs — pattern for a new register check
'NOO-0XX': { severity: 'low', title: 'Short, factual description of the defect' },
// …
{
  // 1. Derive the fact from the source. Never hard-code what can be parsed.
  const offenders = [...src.matchAll(/SOME_PATTERN/g)].map((m) => m[0]);
  // 2. Record one finding per offence, with evidence a human can act on.
  for (const token of offenders) note('NOO-0XX', token);
}
```

**Checklist for a new rule**

- [ ] Add the ID and title to `REGISTER` (kept in sync with
      [`ARCHITECTURE.md` § 17](ARCHITECTURE.md#17-defect-register)).
- [ ] Prefer parsing the source over hard-coding values — the audit must not rot when data changes.
- [ ] Prove it catches the real defect and **not** similar-looking innocent code (check
      `--json` evidence).
- [ ] Run `npm run audit:baseline` **once**, in the same commit, and confirm the diff contains only
      the new ID.
- [ ] Document the rule in the table in [§ 2.2](#22-ratcheted-register-checks).
- [ ] Verify it fails: temporarily reintroduce the defect and confirm exit code 1.

---

## 6. Definition of done

A change is complete when all of the following hold. This is the same list reviewers apply in
[`CONTRIBUTING.md`](../CONTRIBUTING.md#review-rubric).

- [ ] `npm test` exits **0**.
- [ ] `npm run smoke` exits **0** (or `npm run verify` runs both).
- [ ] `npm start` serves the app and the change is visible in a browser.
- [ ] Every task in the manual matrix that touches the changed subsystem passes.
- [ ] The console is clean — no errors, no warnings introduced.
- [ ] Any new finding is either fixed or baselined with a stated reason in the PR description.
- [ ] `index.html` is still the only artefact required to run the app.
- [ ] No new runtime dependency, no build step, no network call from the runtime.
- [ ] User-facing change is recorded in [`CHANGELOG.md`](../CHANGELOG.md).
- [ ] If a documented signature changed, [`API.md`](API.md) is updated in the same commit.
- [ ] Payload delta is understood (current headroom: **9,343 B** to the warn threshold, 188,000 B).

---

## 7. Behavioural verification

Statics are covered by the audit and behaviour by the manual matrix; the space between them is now
partly automated. **9.5.0 shipped a behavioural smoke harness**, and a browser-level harness remains
planned.

### 7.1 Determinism — shipped in 9.5.0

`NOO-021` is retired: the runtime seeds a local `mulberry32` PRNG (`rng()`), and every call site that
used to roll `Math.random()` — graph spawn, injection, the Zaziopath lattice, field decoration — now
draws from it. The same commit produces the same boot graph every time: **90 nodes / 265 edges**, and
**128 / 312** after the lattice seed. That reproducibility is the precondition for asserting counts
at all.

```js
function mulberry32(a) { /* … six lines … */ }
const rng = mulberry32(0x9a4e);
```

What was *not* shipped: a `?seed=` URL parameter. The generator is real and shared; exposing it as a
shareable seed remains a possible follow-up, but nothing in the runtime reads the URL today, and this
document does not pretend otherwise.

### 7.2 The smoke harness — `npm run smoke`

`scripts/smoke.mjs` executes the **real runtime** — the same inline script the browser runs — inside
`node:vm` against a hand-written DOM and Canvas 2D stub.

| Property | Design |
| --- | --- |
| Runner | `node:vm` plus ~120 lines of stubs; **zero dependencies**, no browser |
| What is real | `index.html`'s runtime verbatim: engines, graph model, ultra field, metrics, controls |
| What is stubbed | DOM queries + class lists, the 2D context (call counters), the rAF queue, `AudioContext`, `fetch` (always rejects → fallback path), `FileReader`, `setInterval` |
| Time | `frames(n)` drains the rAF queue against a virtual clock; a boot report is printed before the verdict |
| Assertions | **36**, every failure printed with its label and detail |
| Boot report | node/edge counts at three points — boot · after the lattice seed · after the harness's own injection |
| Trigger | the same CI job as the audit, on Node 18/20/22 |

The assertions, by group:

| Group | # | Representative claims |
| --- | --- | --- |
| Boot contract | 5 | 90 nodes at boot; ids are array indices; every node carries stratum + provenance + class; every edge carries strength + kind |
| Standard renderer | 2 | the atlas paints fills and strokes; the ultra field is off by default |
| Ultra lifecycle | 9 | the switch enables the field; entry seeds the lattice (8 strata, § 00c wires, the question); the deck is revealed; glow stamps and nebula gradients are drawn |
| Field physics | 2 | the field moves the same node objects the atlas owns; the frame budget stays finite |
| Submodes | 5 | each of SWARM · CONSTELLATION · SIGNAL STORM · MYCELIAL · DREAM steps without throwing |
| Deck controls | 2 | the legend renders both registries; preset cycling keeps parameters in range |
| Focus | 3 | the focused node is fully relevant; relevance reaches one hop; clearing focus returns neutral |
| Ingestion | 3 | injection adds exactly one node and at least one edge; a birth event registers on the field |
| Hotkeys | 2 | `1`–`5` selects a field; `U` returns to STANDARD |
| Resilience | 3 | resize while live; STANDARD keeps running afterwards; payload counters stay truthful |

**What the harness does not prove.** It is behavioural, not visual: the canvas is a stub that counts
draw calls, so it can prove the field *asked* for a glow stamp but not that the stamp looks right.
Audio is inert, `fetch` always fails (so Ollama is exercised only as the fallback path), and no
browser, GPU or compositor is involved. It asserts the **construction bounds** — pool ceiling, tier
table, physics grid — rather than measuring real frame time. Read it as "the runtime cannot break
silently", not as a substitute for § 3 or the harness below.

### 7.3 Headless harness (still planned, dev-only, outside the deployment path)

| Property | Design |
| --- | --- |
| Runner | Playwright, pinned, in `devDependencies` — the **runtime** stays dependency-free |
| Seed | `?seed=` URL parameter (generator shipped, parameter not yet) for a deterministic layout |
| Assertions | Boot without console errors; 7 windows present; node count matches the badge; filter reduces rendered nodes; injection increments the counter; transcript grows; ingestion of a fixture adds exactly one node; **the mode switch draws on the second canvas and returns losslessly** |
| Visual | Seeded screenshots at 1280 / 1440 / 1920 — the third is what would have caught `NOO-019` automatically |
| Accessibility | Assert an accessible name on every `button`; `NOO-016` becomes a ratchet again as coverage improves |
| Trigger | Same CI workflow, second job; a harness failure is a build failure |

**Deliberate constraint:** the harness never runs against production. `index.html` must remain
openable from a filesystem with no tooling present — that is the project's thesis, and a test suite is
not a reason to weaken it.

---

<div align="center">
<sub>Next: <a href="DEPLOYMENT.md">Deployment →</a></sub>
</div>
