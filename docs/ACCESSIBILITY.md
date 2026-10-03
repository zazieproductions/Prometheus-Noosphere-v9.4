# Accessibility Audit

> A measured gap analysis of NOÖSPHERE // OS against **WCAG 2.2 Level AA**, with the remediation
> plan, the reasoning behind it, and the things this document does not claim.

**Status:** ❌ **Not conformant.** Tracked as [`NOO-016`](ARCHITECTURE.md#17-defect-register) (high).
**Target:** WCAG 2.2 Level AA for the interface chrome; a defined-but-exempt status for the graph
canvas (see [§ 7](#7-the-canvas-problem)).
**Method:** static analysis of `HEAD` (64 buttons, 74 declared IDs, **17 `aria-*`** — all on the graph
and ultra controls — 0 `role`, 0 `tabindex`) plus formula-measured contrast ratios. No automated
accessibility tool has been run — and saying so is the point of this document.

---

## 1. Why publish an audit that says the project fails it

Two reasons, and neither is performative.

1. **A claim of accessibility is a claim of engineering rigour.** This repository asserts that
   documentation is a deliverable. Access is the one area where a portfolio piece can look
   immaculate and exclude a third of its audience in silence. Naming the gap is cheaper than
   pretending it does not exist, and more useful than a vague "accessibility improvements planned".
2. **Most of the fixes are small and bounded.** The gap is not architectural. It is 14 missing
   labels, a handful of keyboard handlers, two contrast tokens and a media query. That is a
   *roadmap item with a size*, which is exactly what a defect register is for.

This document is deliberately specific. Every number below is reproducible from the source; every
ratio is computed with the WCAG relative-luminance formula, not estimated.

---

## 2. What is already right

Honesty cuts both ways. These properties are real, verified, and worth protecting in any refactor.

| Property | Evidence | Relevant criterion |
| --- | --- | --- |
| Language declared | `<html lang="en">` | 3.1.1 Language of Page ✅ |
| Semantic landmarks | `<header>` · `<main>` · `<footer>` | 1.3.1, 2.4.1 (partial) ✅ |
| Real controls, not div-soup | 58 `<button>`, 3 `<select>`, 4 `<input>` | 4.1.2 (partial) ✅ |
| Named ultra controls | 13 graph/ultra buttons + 4 sliders carry explicit `aria-label` (9.5.0) | 4.1.2 (partial) ✅ |
| Text zoom survives | Tailwind sizes are `rem`-based | 1.4.4 Resize Text ✅ |
| No audio autoplay | Audio context is constructed on first gesture | 1.4.2 ✅ |
| No timing traps | No session limits, no auto-advance, no CAPTCHA | 2.2.1 ✅ |
| No flashing | Nothing exceeds 3 flashes/second | 2.3.1 ✅ |
| Colour is not the only channel | Active filter = colour **+** underline **+** bold; status = colour **+** text | 1.4.1 ✅ |
| Contrast in the core palette | 6 of the primary roles clear AAA on dark steps | 1.4.3 (partial) ✅ |

The last row matters: the design system's foundation is sound. The failures are at the edges —
interaction steps, micro-labels and the canvas — not in the base palette.

---

## 3. Colour contrast (1.4.3 · 1.4.11)

Ratios computed against the four surface tokens. The interface runs at 9–12 px for most text, so the
**AA small-text threshold of 4.5:1** applies throughout; there is no "large text" exemption to
claim.

| Foreground | `void` | `obsidian` | `surface` | `surface-bright` | Verdict |
| --- | --- | --- | --- | --- | --- |
| `slate-300` | 13.74 | 13.18 | 12.36 | 10.79 | ✅ AAA |
| `neon.emerald` | 15.34 | 14.72 | 13.80 | 12.04 | ✅ AAA |
| `neon.cyan` | 15.30 | 14.68 | 13.76 | 12.01 | ✅ AAA |
| `neon.amber` | 10.69 | 10.25 | 9.62 | 8.39 | ✅ AAA |
| `slate-400` | 7.96 | 7.63 | 7.16 | 6.25 | ✅ AAA |
| `neon.hyper` | 5.56 | 5.33 | 5.00 | **4.36** | ⚠️ Fails on `surface-bright` |
| `neon.crimson` | 5.23 | 5.02 | 4.70 | **4.11** | ⚠️ Fails on `surface-bright` |
| `neon.violet` | 5.16 | 4.95 | 4.64 | **4.05** | ⚠️ Fails on `surface-bright` |
| `slate-500` | **4.29** | **4.11** | **3.86** | **3.37** | ❌ Fails everywhere |
| `slate-600` | **2.69** | **2.58** | **2.42** | **2.11** | ❌ Fails everywhere |

### Findings

| # | Finding | Impact | Fix |
| --- | --- | --- | --- |
| A1 | `slate-500` used for micro-labels and timestamps | ~4.1:1 at 9–10 px — unreadable for low-vision users | Promote to `slate-400` (7.63:1) |
| A2 | `slate-600` used for separators and hints | 2.6:1 — decorative text only | Replace with `slate-500` **or** keep strictly non-semantic |
| A3 | Violet/crimson/hyper text on `surface-bright` (hover state) | Contrast drops ~20 % on interaction — fails exactly when the user is looking | Darken the hover step, or forbid small accent text on it |
| A4 | Text-size floor of 9 px | Tracking and contrast cannot rescue 9 px on a projector or at 200 % zoom | Introduce a 12 px minimum for any text carrying meaning |
| A5 | Non-text contrast on inactive window borders | Borders sit near `rgba(0,247,255,0.12)` — well under 3:1 | Raise inactive-window border alpha, or rely on elevation shadow |

---

## 4. Keyboard and pointer (2.1.1 · 2.4.3 · 2.5.7)

| Interaction | Keyboard | Pointer alternative | Status |
| --- | --- | --- | --- |
| 40 buttons with visible text | ✅ Native, tabbable | — | Pass |
| 13 ultra/graph controls + 4 sliders with `aria-label` | ✅ Native, tabbable | — | Pass |
| 4 icon-only controls named only by `title` | ✅ Focusable, ⚠️ tooltip-only name | — | ⚠️ 4.1.2 |
| **14 icon-only buttons** | ✅ Focusable, ❌ **no accessible name** | — | ❌ 4.1.2 |
| **Window drag** | ❌ Mouse-only | ❌ None | ❌ 2.1.1, 2.5.7 |
| **Window minimise/maximise** | ✅ Buttons are reachable | — | Pass (once labelled) |
| **Graph pan/zoom** | ❌ Mouse-only; `wheel` with `preventDefault` | ❌ None | ❌ 2.1.1, 2.5.7 |
| **Swatch → clipboard** | ❌ `<div onclick>`, not focusable | Mouse only | ❌ 2.1.1, 4.1.2 |
| **Grimoire card → dispatch** | ❌ `<div onclick>`, not focusable | Mouse only | ❌ 2.1.1, 4.1.2 |
| **Modal** | ⚠️ Reachable, but no focus trap, no `Escape`, no initial focus | — | ❌ 2.4.3, 2.1.2 (containment) |
| **Focus order** | ⚠️ DOM order ≠ visual order — 7 absolutely positioned windows | — | ❌ 2.4.3 |

**The 14 unnamed controls** (measured): 7 `minimizeWindow`, 6 `maximizeWindow`, 1 `closeInjectModal`.
All render an icon and nothing else. A screen reader announces fourteen variants of "button".

**Focus visibility (2.4.7):** most controls retain the browser default outline and therefore pass.
Seven inputs use `outline-none`; each substitutes `focus:border-neon-cyan`, which is a real visible
change — but the substitution is applied inconsistently, so this is *partially* met rather than met.

---

## 5. Screen readers and live regions (1.1.1 · 1.3.1 · 4.1.3)

| Element | Accessible exposure | Status |
| --- | --- | --- |
| Graph + ultra canvases | Opaque. No text alternative, no node list, no summary; the ultra deck's controls are labelled but the field itself is invisible to AT | ❌ 1.1.1, 1.3.1 |
| Inspector HUD | Exists in the DOM and updates on hover — hover has no AT equivalent | ❌ 1.3.1 |
| Transcript (`#terminal-output`) | Appends content; not a live region, so nothing is announced | ❌ 4.1.3 |
| Ingestion status (`#ingest-status-text`) | Swaps colour and text; not announced | ❌ 4.1.3 |
| Node counter (`#synapse-count`) | Changes on injection; not announced | ❌ 4.1.3 |
| Heading structure | Exactly **one** heading in the document (an `<h4>` inside the HUD) | ❌ 1.3.1 |
| Gauge/radar values | Visual only; no table, no text summary | ⚠️ 1.1.1 |

**Headings.** The instrument aesthetic means almost no text is marked as a heading. Visually this is
correct; programmatically it leaves an AT user with no document outline for nine windowed regions.

**Suggested remediation shape:** each window becomes a labelled `role="region"` (or `<section>` with
`aria-labelledby` pointing at its title), the transcript becomes `aria-live="polite"`,
`aria-atomic="false"`, and the telemetry readouts use `role="status"`. The graph canvas gets a
companion summary: a visually-hidden, focusable list of nodes and domains that reflects the same
state — which is both a text alternative and a genuinely useful feature.

---

## 6. Motion and timing (2.2.2 · 2.3.3)

| Animated element | Duration | Pausable | Status |
| --- | --- | --- | --- |
| Graph render loop (STANDARD) | continuous, rAF | ❌ | ❌ 2.2.2 |
| Ultra field (ULTRA) | continuous, rAF | ✅ entry preset under `prefers-reduced-motion` (LOD 1 · CONSTELLATION · no dream) | ⚠️ 2.2.2 (standard loop only) |
| Status dot (`animate-ping`) | 1 s loop | ❌ | ❌ 2.2.2 |
| Equaliser bars (`animate-pulse`) | 1 s loop | ❌ | ❌ 2.2.2 |
| Identity atom (`animate-spin`) | 12 s loop | ❌ | ❌ 2.2.2 |
| CRT scanline overlay | static texture | — | ✅ |
| Telemetry drift | 1 Hz, text updates | ❌ | ❌ 2.2.2 |

**`prefers-reduced-motion` is partially honoured.** Entering ULTRA with the media query set forces LOD
1, turbulence 15, the CONSTELLATION field and dream off — announced in the transcript — but the
standard atlas, the ambient CSS loops and the telemetry drift remain unconditional. The continuous
canvas animation is the substantive issue: an auto-updating, non-pausable region of moving content,
which is both a 2.2.2 concern and a vestibular trigger. Two declared animations (`pulse-glow`,
`scanline`) are currently unused, which reduces the surface by accident rather than by design
(`NOO-005`).

**Remaining fix**, in one place, before any engine initialises:

```js
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// → render one static atlas frame, freeze ambient loops, and let telemetry
//   updates apply without transition. The ultra field already does its part.
```

A fuller fix adds an in-UI motion toggle, which is preferable to relying on an OS setting the user
may not know exists.

---

## 7. The canvas problem

The graph is the centrepiece, and a `<canvas>` is a bitmap: nothing inside it exists for assistive
technology. This is not a small fix, and pretending otherwise would be the dishonest move. The plan,
in order of cost:

| Step | Change | Effort | Value |
| --- | --- | --- | --- |
| 1 | `role="img"` + `aria-label` summarising the graph ("90 nodes across 5 domains; 5 currently prominent") | XS | Answers "what is this?" |
| 2 | Keyboard model: arrow keys pan the camera, `+`/`−` zoom, `Tab`/arrows traverse nodes with the HUD announced as a status region | M | Makes the atlas usable without a mouse |
| 3 | Visually-hidden, focusable node list mirroring graph state — the same data the HUD shows | S | Full text alternative + new feature |
| 4 | Keyboard-accessible node injection and a "clear injected nodes" control | S | Completes the loop |

Step 3 is the interesting one: the accessible version of this feature is also a *better* feature,
which is the usual case once the work is scoped honestly.

---

## 8. Remediation plan

Ordered by value per unit of effort. Every item is also a roadmap entry in
[`ROADMAP.md`](ROADMAP.md).

| Priority | Item | Criteria addressed | Effort | Release |
| --- | --- | --- | --- | --- |
| **P0** | Label the 14 icon-only buttons (`aria-label` or visually-hidden text) | 4.1.2 | XS | 9.5.1 |
| **P0** | Raise `slate-500` → `slate-400`; restrict `slate-600` to non-semantic use | 1.4.3 | XS | 9.5.1 |
| **P1** | `prefers-reduced-motion`: standard atlas + ambient loops (the ultra field honours it on entry) | 2.2.2, 2.3.3 | S | 9.5.0 ⚠️ partial · 9.6.0 rest |
| **P1** | `aria-live` on the transcript, ingestion status and node counter | 4.1.3 | S | 9.6.0 |
| **P1** | Region semantics per window (`section` + `aria-labelledby`) and a real heading per window | 1.3.1, 2.4.1 | S | 9.6.0 |
| **P1** | Modal: initial focus, `Escape` to close, focus containment, restore focus to trigger | 2.4.3, 2.1.2 | S | 9.6.0 |
| **P2** | Canvas text alternative + keyboard pan/zoom + node traversal | 1.1.1, 2.1.1, 2.5.7 | M | 10.0.0 |
| **P2** | Keyboard alternative for window movement (arrow-key nudge on the focused window) | 2.1.1, 2.5.7 | M | 10.0.0 |
| **P2** | Turn `<div onclick>` surfaces (swatches, cards) into real buttons | 2.1.1, 4.1.2 | S | 10.0.0 |
| **P2** | Raise accent contrast on `surface-bright`; verify non-text contrast for window borders | 1.4.3, 1.4.11 | S | 10.0.0 |

**Progress at 9.5.0.** The automated `NOO-016` count is clear (17 `aria-*` exist), but that is not
conformance: 14 controls still have no accessible name, there are still 0 `role` and 0 `tabindex`
attributes, and no live region exists. The rows above are the honest remainder.

**Exit criteria for "AA conformant":** P0 and P1 complete, P2 canvas item complete or explicitly
exempted with a documented text-alternative path, and a repeat manual audit recorded in this
document.

---

## 9. Verification plan

Until a headless-browser harness lands in `9.6.0` (the 9.5.0 smoke harness is behavioural and does
not test accessibility), verification is a manual matrix performed on each release candidate.
| Check | Method | Pass condition |
| --- | --- | --- |
| Keyboard-only traversal | Unplug the mouse; complete every task | All controls reachable, focus order matches visual order, focus always visible |
| Screen-reader pass | VoiceOver / NVDA / Narrator, one task per window | Every control announces a name, a role and (where relevant) a state |
| Contrast regression | Re-measure the token table in [§ 3](#3-colour-contrast-143--1411) | No ratio below 4.5:1 for meaningful text |
| Zoom / reflow | 200 % zoom and 320 px viewport | Content remains usable (will fail until `NOO-019` is fixed — recorded honestly) |
| Reduced motion | Enable the OS setting | No continuous animation; no content loss |
| Live regions | Trigger ingestion, injection and a directive | Each is announced without stealing focus |

**Automation, when it lands:** the audit script will assert static invariants (every icon-only
button carries an accessible name; every interactive `<div>` is focusable with a role; a
`prefers-reduced-motion` path exists) and the headless harness will assert real accessible names,
which converts most of this document into ratcheted checks in the same style as
[`NOO-016`](ARCHITECTURE.md#17-defect-register).

---

## 10. What this document does not claim

- **No automated audit has been run.** No axe, Lighthouse or Pa11y result exists for this repository.
  The findings above are from reading the source and computing contrast ratios by formula.
- **No assistive-technology testing has been performed.** Behaviour with real screen readers is
  predicted from the markup, not observed.
- **The project is not conformant,** at A or AA. The table in [§ 8](#8-remediation-plan) is a plan,
  not a record of work done.
- **The desktop metaphor is not a mobile layout.** Fixed-pixel window geometry is a hard limit on
  narrow viewports (`NOO-019`), and reflow at 320 px is out of scope for the metaphor rather than
  merely unimplemented. That is a trade-off to state, not to hide.

---

<div align="center">
<sub>Next: <a href="PERFORMANCE.md">Performance &amp; frame budget →</a></sub>
</div>
