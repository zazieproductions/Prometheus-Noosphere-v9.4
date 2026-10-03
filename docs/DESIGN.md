# Design System

> The visual language of NOÖSPHERE // OS: tokens, type, motion, chrome grammar and the reasoning
> behind them — written as a system, not as a mood board.

**Scope:** the design of the interface. For the honesty policy governing the corpus language it
presents, see [§ 9 Corpus framing and disclosure](#9-corpus-framing-and-disclosure).

---

## 1. Thesis

The interface is a **CRT terminal that grew a window manager.** Three convictions follow from that,
and every rule below is downstream of them.

1. **Instrument, not dashboard.** Data is set in monospace at small sizes with tight tracking, the
   way measurement equipment prints. Prose is not; editorial text uses a different family entirely.
2. **Darkness is the substrate, light is the signal.** Surfaces are four near-black steps; colour is
   reserved for meaning. A saturated hue on screen means the system is telling you something.
3. **Texture is earned.** Scanlines, glass, glow and hatching are used where they explain something
   about the metaphor (a screen, a raised panel, a focus state, a coordinate space) and nowhere else.

The design problem this solves is specific: **a dense technical toy must still read as considered.**
That is why there is a token layer, a documented contrast budget and a written motion policy rather
than a pile of inline styles.

---

## 2. Token system

Core surface and accent tokens are declared in the inline `tailwind.config` block (`index.html:16–61`) and used by name in the utility classes. Deliberate exceptions include the Aesthetic Matrix's sample palettes and small CSS primitives such as the CRT/glass treatments; document those exceptions rather than treating every literal as a design token.

### 2.1 Surfaces — the four-step elevation ramp

| Token | Hex | Role |
| --- | --- | --- |
| `void` | `#030509` | Page substrate, canvas interior, terminal well |
| `obsidian` | `#080c14` | Chrome bars, window headers, insets |
| `surface` | `#0e1424` | Panel bodies, inputs, cards |
| `surface-bright` | `#172138` | Hover/active state of `surface` — the only *interactive* surface step |

The ramp is intentionally shallow (steps of roughly 4–5 % luminance). Depth is communicated by
**borders and elevation shadows**, not by brightness — which is what keeps a dense dark UI from
turning into grey mush.

### 2.2 Accents — semantic, not decorative

| Token | Hex | Semantic role | Where it appears |
| --- | --- | --- | --- |
| `neon.cyan` | `#00f7ff` | **System / focus / primary action** | Identity, graph, active window, primary CTA |
| `neon.emerald` | `#00ff9d` | **Healthy / confirm / live** | Status pulse, terminal core, synthesis confirm |
| `neon.amber` | `#ffaa00` | **Warning / ingestion / pending** | Upload states, node counts, latency |
| `neon.crimson` | `#ff0055` | **Alert / archive signal** | Corpus-count window accent and status cues |
| `neon.violet` | `#a855f7` | **Aesthetic / secondary concept** | Palette engine, hexonomy, semiotic accents |
| `neon.hyper` | `#f43f5e` | **Emphasis (reserved)** | Registered but currently unapplied |

Rule: **an accent hue owns a subsystem.** Cyan is the system's voice, emerald its health, amber its
process, crimson its archive-count/status cues, violet its aesthetic. A component that borrows a hue
outside its lane is a bug, not a stylistic choice.

### 2.3 Contrast budget (measured)

Ratios computed with the WCAG 2.x relative-luminance formula against the four surface steps. Small
UI text (9–11 px dominates this interface) is held to the **AA small-text threshold of 4.5:1**.

| Foreground | on `void` | on `obsidian` | on `surface` | on `surface-bright` | Verdict |
| --- | --- | --- | --- | --- | --- |
| `slate-300` (`#cbd5e1`) | 13.74 | 13.18 | 12.36 | 10.79 | AAA everywhere |
| `neon.emerald` | 15.34 | 14.72 | 13.80 | 12.04 | AAA everywhere |
| `neon.cyan` | 15.30 | 14.68 | 13.76 | 12.01 | AAA everywhere |
| `neon.amber` | 10.69 | 10.25 | 9.62 | 8.39 | AAA everywhere |
| `slate-400` (`#94a3b8`) | 7.96 | 7.63 | 7.16 | 6.25 | AAA everywhere |
| `neon.hyper` | 5.56 | 5.33 | 5.00 | 4.36 | AA on dark steps; **fails on `surface-bright`** |
| `neon.crimson` | 5.23 | 5.02 | 4.70 | 4.11 | AA on dark steps; **fails on `surface-bright`** |
| `neon.violet` | 5.16 | 4.95 | 4.64 | 4.05 | AA on dark steps; **fails on `surface-bright`** |
| `slate-500` (`#64748b`) | 4.29 | 4.11 | 3.86 | 3.37 | **Fails AA at all sizes** |
| `slate-600` (`#475569`) | 2.69 | 2.58 | 2.42 | 2.11 | Fails AA and large-text AA |

**Conclusions that drive the accessibility roadmap:**

- The **core palette is strong.** Five foreground values in the table clear AAA on all four dark
  surface steps — the interface is not fighting its own contrast.
- **`surface-bright` is the failure region.** Violet, crimson and hyper fall below 4.5:1 there. The
  rule that follows: *never set small text in violet/crimson on a hovered surface.*
- **`slate-500` and `slate-600` are decoration only.** They are currently used for micro-labels and
  timestamps; measured, those two steps do not carry readable text at 9–11 px. Tracked with the
  wider accessibility work as `NOO-016`.

Full audit, including non-text failures: [`ACCESSIBILITY.md`](ACCESSIBILITY.md).

### 2.4 Known token defect

Four utility occurrences across the archive-count and Grimoire windows reference a `crimson` family
that does not exist — the token is nested as `neon.crimson`, so Tailwind generates
`neon-crimson-*`. The invalid classes (`border-crimson-900/60`, `bg-crimson-950/60`,
`border-crimson-700/50`) produce no intended Tailwind background/border rule.

| | |
| --- | --- |
| **Tracked as** | `NOO-001` (high — it is the most visible defect in the register) |
| **Detected by** | `scripts/audit.mjs` check `NOO-001`, which parses the config rather than hard-coding names |
| **Fix** | Rename to `neon-crimson-*`, or promote `crimson` to a top-level family |
| **Design lesson** | A nested token namespace is only safe if every utility author knows the full path. When accent families are semantic roles, flattening them (`crimson`, `cyan`, …) removes an entire class of silent failure. |

---

## 3. Typography

Three families, three registers. Mixing them is meaningful, never incidental.

| Family | Token | Register | Applied to |
| --- | --- | --- | --- |
| **JetBrains Mono** | `font-mono` | Instrument | Nearly everything: labels, data, controls, transcript, chrome. Includes weights 100–800 plus italics. |
| **Syne** | `font-sans` | Editorial | Panel prose, descriptions, longer copy — anything meant to be read rather than scanned. |
| **Cinzel** | `font-esoteric` | Ritual | The system identity line. One use. Ceremony, not navigation. |

### Rules

- **Monospace is the default, not a garnish.** The interface is an instrument; it sets like one.
- **Cinzel is rationed to a single element** (`NOÖSPHERE // OS v9.4.1` in the status bar). The moment
  a third register appears twice, the hierarchy collapses — the rule is one use, forever.
- **Small is the base case.** Body copy sits at 9–12 px with `tracking-wider`/`tracking-widest` on
  labels. This is a deliberate instrument aesthetic and it is the primary accessibility debt
  (`NOO-016`): the roadmap pairs every contrast fix with a minimum-size floor, because tracking and
  contrast cannot rescue 9 px text on a projector.

### Scale in use

| Size | Role |
| --- | --- |
| 9–10 px | Micro-labels, tags, telemetry rows, timestamps |
| 11–12 px | Body copy, control labels, transcript text |
| 14–16 px | Panel headings, inspector title, gauge values |
| 18 px+ | Identity and hero moments only |

---

## 4. Elevation and texture

| Primitive | Implementation | Purpose |
| --- | --- | --- |
| `.glass-panel` | `rgba(10,15,26,.82)` + `backdrop-filter: blur(16px)` + 1 px cyan-tinted border + deep shadow | Every window. The blur is what makes overlapping windows legible. |
| `.window-active` | Cyan border + 30 px cyan glow, `z-index: 40` | Focus. Colour *and* elevation, because glow alone is ambiguous when two windows overlap. |
| `shadow.glass` | `0 8px 32px rgba(0,0,0,.7)` | Panel lift |
| `shadow.neon-*` | 25 px coloured bloom at 25 % alpha | Emphasis on high-priority controls |
| `.crt-overlay::before` | Scanline gradient + RGB subpixel fringe, `pointer-events: none` | Screen metaphor. Non-interactive so it never intercepts input. |
| `.hex-bg` | Two offset radial-gradient dot layers | Coordinate space behind the desktop — it makes panning windows feel spatial. |
| `.glow-text-*` | Single-colour text shadow | Applied to identity and critical labels only |

**Discipline:** every texture above is either a metaphor or a state. None is applied "for depth".
The scanline overlay is an *interaction-free* layer — a texture that swallows clicks is a bug.

---

## 5. Motion policy

Motion is functional, short, and never the only carrier of meaning.

| Class | Duration | Used for |
| --- | --- | --- |
| `transition` (colour/border) | 150 ms | Hover, focus, state colour |
| `transition-all duration-75` | 75 ms | Window position/geometry — must feel immediate |
| `animate-pulse` | 1 s loop | Live indicators, pending states |
| `animate-ping` | 1 s loop | The "online" status dot |
| `animate-spin` (slowed) | 12 s loop | The identity atom — ambient, not urgent |
| `animation.pulse-glow` | 4 s loop | **Declared, unapplied** — `NOO-005` |
| `animation.scanline` | 8 s loop | **Declared, unapplied** — `NOO-005` |
| `animate-fadeIn` | — | **Referenced, never declared** — `NOO-003` |

### Rules

1. **Interaction feedback ≤ 150 ms.** Anything slower reads as latency rather than craft.
2. **Ambient loops must be slow (≥ 4 s) or tiny.** The equaliser bars and status pulse are the only
   sub-second loops, and both are 1–4 px elements.
3. **Nothing animates layout that the user is not dragging.** Windows use `transition-all
   duration-75` for programmatic moves only.
4. **`prefers-reduced-motion` is not yet honoured** — scoped to `9.5.0` alongside `NOO-014`/`NOO-018`
   and recorded in [`ROADMAP.md`](ROADMAP.md). Until then the CRT overlay and ambient loops are
   unconditional, and the two scanline/pulse animations sit unused, which removes two of the three
   worst offenders by accident rather than design.

### Frame-rate coupling (a motion concern, not just a physics one)

The graph integrates by a fixed increment per frame with no `deltaTime`, so the simulation's visual
tempo is display-dependent: approximately **2.4× faster at 144 Hz than at 60 Hz** (`NOO-020`). For a
decorative simulation this is imperceptible in isolation, but it means the interface has no single
"feel" — and on a portfolio piece, "feels different on a good monitor" is a defect worth naming.

---

## 6. Chrome grammar

Every window is built from the same five parts, in the same order. Learn one, know seven.

```
┌────────────────────────────────────────────────────────────┐
│ ▣  TITLE // MONIKER        [badge]      ⚙ · — · ▢          │  1 · header
├────────────────────────────────────────────────────────────┤
│ STRATUM: ALL · INDEX · IDENTITY · SHADOW … PAN · ZOOM       │  2 · toolbar
├────────────────────────────────────────────────────────────┤
│                                                            │
│                        viewport                            │  3 · content
│              (canvas · transcript · list · form)           │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ directives · chips · search · status                          │  4 · action strip
└────────────────────────────────────────────────────────────┘
```

| Part | Rule |
| --- | --- |
| **1 · Header** | Icon + monospace title in the subsystem's accent colour + a small capability badge; controls right-aligned: subsystem-specific, then `—`, then `▢`. Always the drag handle (`.win-header`). |
| **2 · Toolbar** | Optional. Sets the accent to the *data*, not the subsystem. Left = filters; right = interaction hints. Hints are how the pan/zoom model is discoverable without documentation. |
| **3 · Content** | Owns its own scrolling. One primary visual per window. |
| **4 · Action strip** | Optional. Chips for presets; a status readout in accent colour. |
| **5 · Input/status bar** | Only where the window accepts input. |

**Icons:** Lucide only, 24 px stroke geometry, scaled to 12–16 px. One icon per concept —
`network` is always the graph, `terminal` always the terminal. 27 distinct names are referenced;
one (`dread`) is not a real Lucide icon and therefore renders as nothing (`NOO-006`). Icon auditing
is mechanical precisely so this class of typo cannot ship silently again.

**Windows in the dock:** six of seven. `win-synthesizer` has no launcher (`NOO-012`), which
compounds `NOO-019` — it is the one window that can be lost entirely on a smaller display.

---

## 7. Colour-in-motion semantics

The accent system carries live state. The mapping is fixed and worth knowing before changing a hue:

| State | Signal | Example |
| --- | --- | --- |
| Idle / ready | emerald, steady | `SIMULATION MODE // LOCAL CORPUS RETRIEVAL` |
| Active / focused | cyan border + glow | Focused window |
| Processing | amber, `animate-pulse` | `INGESTING n LOCAL FILE(S)…` |
| Good outcome | emerald string | `CORPUS EXPANDED · SESSION ONLY` |
| Archive count / error cue | crimson | Corpus counts; `NOT INGESTED` errors |
| Secondary / aesthetic | violet | Palette engine and selected corpus accents |

Because the mapping is stable, the UI can be understood at a glance without reading it — which is
what allows the copy to be as dense as it is.

---

## 8. Writing and voice

| Context | Rule | Example |
| --- | --- | --- |
| Controls | Imperative, uppercase, terse | `TRACE SOURCES` · `RE-ALIGN` · `OPEN QUESTIONS` |
| Data labels | Instrument style; status and provenance stay explicit | `SOURCE NODES` · `INFERENCE` · `PROVENANCE` |
| System messages | Terse, present tense, prefixed by role | `Local file read: [name] · session only` |
| Corpus content | Preserve the source wording, excerpt, and epistemic label | A bounded citation with its path and locator |
| Error/empty states | Honest, never cute | `SIMULATION MODE` · `No lexical match in the curated graph. Try a source title…` |

The interface keeps the **chrome disciplined and the archive attributable**: terminal controls stay
terse, while source excerpts, authored interpretations, and unresolved questions retain their own
wording and status. That contrast supports exploration without turning the archive into a diagnosis
or an unqualified claim engine.

---

## 9. Corpus framing and disclosure

The interface preserves its CRT/terminal language while presenting **Zaziopath as a non-clinical self-analysis archive, creative research instrument, evidence system, recursive notebook, and conceptual laboratory**—not as a personality-diagnosis engine.

Two design constraints keep the visual system from overstating the evidence:

1. **The chrome reflects actual data.** Graph/stratum counts derive from the committed source snapshot; no synthetic telemetry or behavioral scores are displayed.
2. **Epistemic status remains visible.** SOURCE, INFERENCE, SYNTHESIS, and OPEN QUESTION use distinct labels and graph styling. Stratum hue is a navigation key, not a confidence score; source-authored interpretations remain interpretations.

The detailed source and privacy policy lives in [`ZAZIOPATH-CORPUS.md`](ZAZIOPATH-CORPUS.md), [`README.md`](../README.md#what-this-is-not), and [`SECURITY.md`](../SECURITY.md).

---

## 10. Anti-patterns

Rejected on purpose. Each entry names the alternative that was chosen instead.

| Anti-pattern | Why it is refused | Chosen instead |
| --- | --- | --- |
| New accent hues | Colour is a semantic channel; adding one breaks the mapping | Reuse a role, or express hierarchy with elevation |
| A second display face | Three registers already cover ritual, editorial and instrument | Ration Cinzel |
| Animated background gradients | Decorative motion that competes with telemetry | Static dot hatching + a single CRT overlay |
| Glass on everything | Blur on glass is legibility; blur on blur is noise | Glass only for floating windows |
| Icons as the sole label | Icon-only affordances fail recognition and accessibility | Icon + monospace label together |
| Personalised empty states | Cuteness dilutes the instrument metaphor | Terse, honest status |
| Light mode | The conceit is emissive instrumentation on darkness | One theme, executed completely |

---

## 11. Extending the design system

```mermaid
flowchart TD
  A["Need a new visual element"] --> B{"Does an existing token express the role?"}
  B -- yes --> C["Use the token by name — never a raw hex"]
  B -- no --> D{"Is the role semantic and recurring?"}
  D -- yes --> E["Add the token to tailwind.config, document it here, add an audit family"]
  D -- no --> F["Use a utility composition; do not extend the token layer"]
  E --> G["Run npm test — NOO-001 verifies families resolve"]
```

Non-negotiables for any contribution: tokens by name, accents in their lanes, interaction feedback
≤ 150 ms, and `npm test` green with the delta baselined.

---

<div align="center">
<sub>Next: <a href="DECISIONS.md">Architecture decisions →</a></sub>
</div>
