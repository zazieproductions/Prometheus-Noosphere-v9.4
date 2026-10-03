# Accessibility audit

> Current limitations and a verification plan for the Zaziopath edition of NOÖSPHERE // OS. This is a source review, not a conformance claim.

**Status:** **Not established as WCAG 2.2 AA conformant.** The static audit currently records no `NOO-016` finding because the graph has a supported Canvas role and meaningful accessible name. That rule checks only this graph-summary contract—not the keyboard model, labels of every control, live regions, visual contrast in a browser, or overall conformance.

**Current markup snapshot:** `index.html` contains one canvas `role="img"` with an `aria-label`, no `tabindex`, 48 native buttons, 4 inputs, 3 selects, and one heading element. The graph has no per-node keyboard traversal or parallel accessible node list. No browser, axe/Lighthouse/Pa11y run, or assistive-technology test has been performed in this workspace.

**Goal:** retain the visual operating-system metaphor while making controls, source status, and text access usable without relying on Canvas pointer interactions alone.

---

## 1. What works and what does not

| Area | Current state | Notes |
| --- | --- | --- |
| Language and landmarks | `lang="en"`; header, main, and footer landmarks | Partial structure; individual windows are not named regions |
| Native controls | Buttons, inputs, and selects remain native elements | Some icon-first actions and custom click targets still need manual name/keyboard review |
| Canvas summary | `role="img"` and a text alternative describe the eight-stratum source graph and point to text-based alternatives | Summary only; it does not expose individual nodes or relationships |
| Provenance distinctions | Graph legend and interface labels include SOURCE / INFERENCE / SYNTHESIS / OPEN QUESTION | Status is not conveyed by color alone |
| Contrast | Core cyan, emerald, amber, and slate-300 values are strong on dark surfaces | Slate-500/600 and violet/crimson/hyper on hover surfaces need attention for small text |
| Motion | Continuous canvas loop, status pulse, equalizer, and identity animation | `prefers-reduced-motion` is not honored |
| Text selection | Body styling suppresses selection for the draggable desktop effect | This can make copying content difficult; verify and narrow the suppression |
| Narrow viewports | Authored desktop geometry extends beyond smaller screens | High-severity `NOO-019`; some windows are difficult to grab/recover |

The VM smoke test validates JavaScript behavior with DOM/canvas stubs. It does not evaluate browser accessibility trees, focus behavior, layout, or a real screen reader.

## 2. Contrast findings

Ratios below are measured against the four dark surface tokens with the WCAG relative-luminance formula. Most interface text is small, so the 4.5:1 AA threshold is the relevant target for meaningful text.

| Foreground | `void` | `obsidian` | `surface` | `surface-bright` | Note |
| --- | ---: | ---: | ---: | ---: | --- |
| `slate-300` | 13.74 | 13.18 | 12.36 | 10.79 | AAA |
| `neon.emerald` | 15.34 | 14.72 | 13.80 | 12.04 | AAA |
| `neon.cyan` | 15.30 | 14.68 | 13.76 | 12.01 | AAA |
| `neon.amber` | 10.69 | 10.25 | 9.62 | 8.39 | AAA |
| `slate-400` | 7.96 | 7.63 | 7.16 | 6.25 | AAA |
| `neon.hyper` | 5.56 | 5.33 | 5.00 | **4.36** | Below AA on `surface-bright` |
| `neon.crimson` | 5.23 | 5.02 | 4.70 | **4.11** | Below AA on `surface-bright` |
| `neon.violet` | 5.16 | 4.95 | 4.64 | **4.05** | Below AA on `surface-bright` |
| `slate-500` | **4.29** | **4.11** | **3.86** | **3.37** | Below AA |
| `slate-600` | **2.69** | **2.58** | **2.42** | **2.11** | Below AA |

**Practical constraints:** reserve slate-500/600 for non-essential decoration, avoid small violet/crimson/hyper text on hovered `surface-bright`, and check inactive borders as non-text controls. See [Design System § 2.3](DESIGN.md#23-contrast-budget-measured).

## 3. Keyboard, focus, and regions

- Window dragging and graph pan/zoom are pointer-driven. There is no keyboard equivalent for moving windows or traversing graph nodes.
- Grimoire cards and palette swatches are created as custom clickable elements; they need button semantics, focus visibility, and keyboard activation.
- The modal does not currently implement a complete focus lifecycle (initial focus, Escape handling, focus containment, and return to the trigger).
- Each desktop window should have a named region and a logical heading. The document's single heading element is insufficient to navigate the seven windows as sections.
- Icon-only controls, including window actions, need an explicit screen-reader name. A native `title` alone is not a substitute for consistent accessible naming.
- The terminal transcript, ingestion status, and changing graph counts are not announced through live regions/status semantics.

## 4. Canvas and text alternatives

The Canvas 2D graph now announces a high-level description and directs users to Grimoire search and Polymath Terminal for text-based excerpts and provenance. Those alternatives are useful but do not provide parity with graph interaction:

1. Add a focusable, filter-aware list of graph records with title, stratum, epistemic status, summary, and source locator.
2. Provide keyboard selection and a way to activate the same terminal context as pointer selection.
3. Keep the accessible list synchronized with session-local ingestion and remove those records when the page reloads.
4. Announce selection/filter changes without forcing focus into the transcript.

The graph is a source-navigation surface, not a confidence or diagnostic visualization. An accessible alternative must preserve that epistemic distinction rather than reduce records to unlabeled text.

## 5. Motion and responsive behavior

`prefers-reduced-motion` is not currently honored. Add a reduced-motion mode that pauses ambient CSS animation and renders a stable graph frame while preserving filtering, selection, and text access. Do not disable access to the graph when motion is reduced.

The desktop layout has a documented narrow-viewport reachability issue (`NOO-019`). Keep the CRT/window language, but ensure every window can be restored and its header reached at the supported viewport width. Also review `select-none` so it only suppresses text while a drag is active.

## 6. Prioritized remediation

| Priority | Work | Acceptance |
| --- | --- | --- |
| P0 | Name icon-only controls and make custom cards/swatches native keyboard-operable buttons | Every interactive control has a programmatic name, role, state, and visible focus |
| P0 | Fix meaningful low-contrast microcopy and non-text control borders | Contrast checks meet WCAG AA for meaningful text and relevant boundaries |
| P1 | Add named regions/headings and live status semantics to transcript, ingestion, and counts | Screen-reader navigation exposes window purpose and announces important updates |
| P1 | Implement modal focus management and Escape behavior | Focus enters, stays within, and returns from the modal correctly |
| P1 | Respect `prefers-reduced-motion` | Ambient motion pauses and graph interaction remains available |
| P1 | Make all default windows reachable on the documented minimum viewport | Every header can be reached and every window can be restored without reloading |
| P2 | Add synchronized graph-record text access and keyboard selection/pan/zoom | Core source discovery and selection do not require a pointer |

See [Roadmap](ROADMAP.md) for related UI items. The static `NOO-016` check now protects the graph-summary name/role contract; it should be extended to catch missing control names and other structural accessibility regressions.

## 7. Verification still required

Before making a conformance claim, perform these checks in a current browser and document the result:

| Check | Pass condition |
| --- | --- |
| Keyboard-only use | All controls and source-discovery tasks are reachable; focus is visible and order is usable |
| Screen reader | Controls expose name/role/state; selection, ingestion, and terminal updates are announced appropriately |
| Zoom and reflow | At 200% zoom and the supported narrow viewport, content remains reachable without hidden windows |
| Reduced motion | Continuous and ambient animation stop or reduce without losing data access |
| Contrast | Re-measure meaningful text and relevant controls against rendered states |
| Graph alternative | Browse, filter, select, and open context for source nodes without interacting with Canvas |

No browser or screen-reader testing has been run for this change. The audit describes known limitations and a test plan; it is not a conformance statement.
