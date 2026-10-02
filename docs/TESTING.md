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
rules. Runtime: ~0.3 s. Dependencies: none.

### 2.1 Always-fatal rules (never baselined, never tolerated)

| Rule | What it proves | Why it is safe to automate |
| --- | --- | --- |
| No duplicate `id` | The DOM contract is unambiguous | HTML spec requirement; no judgement involved |
| Every `getElementById('x')` resolves | No silent `null` dereference at runtime | Exact string match against 42 declared IDs |
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
| **Rendered output** | A correct class name can still produce the wrong pixel | Manual matrix; headless harness planned for `9.5.0` |
| **CSS cascade outcomes** | The audit knows a family is undefined; it cannot know what a utility resolves to | Contrast table in [`DESIGN.md`](DESIGN.md) is measured by formula, not by browser |
| **Runtime state** | Nothing executes `index.html` in CI | Manual matrix; the 4 fatal rules catch the highest-severity static causes of runtime failure |
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
- [ ] `npm start` serves the app and the change is visible in a browser.
- [ ] Every task in the manual matrix that touches the changed subsystem passes.
- [ ] The console is clean — no errors, no warnings introduced.
- [ ] Any new finding is either fixed or baselined with a stated reason in the PR description.
- [ ] `index.html` is still the only artefact required to run the app.
- [ ] No new runtime dependency, no build step, no network call from the runtime.
- [ ] User-facing change is recorded in [`CHANGELOG.md`](../CHANGELOG.md).
- [ ] If a documented signature changed, [`API.md`](API.md) is updated in the same commit.
- [ ] Payload delta is understood (current headroom: 7,351 B to the warn threshold).

---

## 7. The road to behavioural tests

The audit covers statics; the manual matrix covers behaviour; nothing covers both automatically. The
`9.5.0` plan closes that gap **without** compromising the zero-dependency runtime.

### 7.1 Determinism first

Behavioural snapshot testing requires a reproducible first frame. Today there are **19 unseeded
`Math.random()` call sites** (`NOO-021`), so no two runs of the same commit produce the same graph.
The prerequisite fix:

```js
// Mulberry32 — ~6 lines, no dependency, deterministic and fast.
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = rng(0x9a4e);   // replaces all 19 Math.random() call sites
```

With a seeded generator, `?seed=` becomes a shareable, reproducible state — a feature (deterministic
demos, stable screenshots, comparable bug reports) that happens to also unlock testing.

### 7.2 Headless harness (dev-only, outside the deployment path)

| Property | Design |
| --- | --- |
| Runner | Playwright, pinned, in `devDependencies` — the **runtime** stays dependency-free |
| Seed | `?seed=` URL parameter for deterministic layout |
| Assertions | Boot without console errors; 7 windows present; node count matches the badge; filter reduces rendered nodes; injection increments the counter; transcript grows; ingestion of a fixture file adds exactly one node |
| Visual | Screenshot with the seeded layout at three reference widths (1280 / 1440 / 1920) — the third is what would have caught `NOO-019` automatically |
| Accessibility | Static helpers asserting accessible names on every `button`; the check `NOO-016` becomes a ratchet |
| Trigger | Same CI workflow, second job; a failure in the harness is a failure of the build |

**Deliberate constraint:** the harness never runs against production. `index.html` must remain
openable from a filesystem with no tooling present — that is the project's thesis, and a test suite
is not a reason to weaken it.

---

<div align="center">
<sub>Next: <a href="DEPLOYMENT.md">Deployment →</a></sub>
</div>
