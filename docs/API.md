# API Reference

> Every public surface in NOÖSPHERE // OS: global functions, engine methods, the DOM contract that
> binds them together, the inline handler map, and the tooling API.

**Version:** 9.5.0 · **Source of truth:** [`index.html`](../index.html) and [`scripts/`](../scripts)

---

## Contents

- [Conventions](#conventions)
- [Module map](#module-map)
- [Global functions](#global-functions)
- [Engine: `graphEngine`](#engine-graphengine)
- [Engine: `graphMetrics`](#engine-graphmetrics--derived-metrics)
- [Engine: `ultra`](#engine-ultra--ultra-visualisation-field)
- [Engine: `polymathLLM`](#engine-polymathllm--local-inference-with-template-fallback)
- [Engine: `soundLab`](#engine-soundlab)
- [Engine: `paletteGen`](#engine-palettegen)
- [Engine: `grimoire`](#engine-grimoire)
- [Engine: `ideaCombinator`](#engine-ideacombinator)
- [Aggregate state](#aggregate-state)
- [DOM contract](#dom-contract)
- [Inline handler map](#inline-handler-map)
- [Data constants](#data-constants)
- [Tooling API](#tooling-api)
- [Extending](#extending)

---

## Conventions

| Symbol | Meaning |
| --- | --- |
| `→ T` | Return type (all functions are synchronous unless marked otherwise) |
| **Side effects** | Anything outside the return value: DOM, state, audio, clipboard |
| `O(…)` | Cost per call, in terms of the signature's own parameters |
| *Internal* | Not part of the stable surface; safe to rename without a changelog entry |

**Stability.** The runtime has no versioned module boundary, so this document is the contract. Any
change to a signature, a return shape or a side effect listed here is a **breaking change** and must
appear in [`CHANGELOG.md`](../CHANGELOG.md) under *Changed*.

---

## Module map

```
index.html  ─── data tables ──────── DOMAINS · ZAZIOPATH_STRATA · NODE_CLASSES · ZAZIOPATH_WIRES
            │                       annotateNode() · addEdge() · mulberry32() · rng()
            ├── globals ──────────── window-manager + ingestion + modal + hotkeys
            ├── graphMetrics        derived pass: degree · mass · strata · weather · focus reach
            ├── graphEngine         graph state, camera, standard rendering, injection, seeding
            ├── ultra               ultra visualisation field (second renderer, same arrays)
            ├── polymathLLM         transcript + composition
            ├── soundLab            audio presets           (playBeep is global)
            ├── paletteGen          palette state + clipboard
            ├── grimoire             fragment corpus + search
            └── ideaCombinator       dialectical synthesis
```

Loading order matters: `sound` → `window manager` → `data tables` → `graphMetrics` → `graphEngine`
→ `ultra` → `polymathLLM` → `ingestion` → `paletteGen` → `grimoire` → `ideaCombinator` → `modal` →
`telemetry` → initialisation. See
[`ARCHITECTURE.md` § Boot sequence](ARCHITECTURE.md#5-boot-sequence).

---

## Engine: `graphEngine`

#### `injectNode(title: string, domain: string, desc: string, opts?: object) → void`

Appends an annotated node and links it to its nearest conceptual neighbours. This is the single
insertion point for the Ingestion Vector, the idea combinator and the manual modal.

`opts`: `{ klass?, stratum?, origin?, ref?, uncertainty?, links? }` — `klass` defaults to
`'ingested'`, `links` to `3`.

```js
// node created by injectNode (9.5.0)
{
  id: graphNodes.length,          // append-only; ids are never reused
  title, domain, desc,
  valence: (92 + rng() * 7.9).toFixed(1) + '%',
  x: (rng() - 0.5) * 100,         // spawned near the origin
  y: (rng() - 0.5) * 100,
  vx: 0, vy: 0,
  radius: klass === 'source' ? 6.5 : 6,
  color: DOMAINS[domain]?.color ?? '#00f7ff',
  stratum,                        // defaults from STRATUM_OF[domain]
  klass, provenance: { origin, ref, recorded: !!ref },
  uncertainty, activation: 1, mass: 0, phase, warp, birthAt: performance.now(),
}
```

| Post-condition | Guarantee |
| --- | --- |
| `graphNodes.length` increased by 1 | Yes |
| `id` valid and unique | Yes — assigned from the current length |
| Edges added | `opts.links` (default 3), each targeting a **nearest** neighbour, `kind: 'derived'` |
| Badge updated | `#synapse-count` → `"<n> NODES"` |
| Metrics invalidated | `graphMetrics.dirty = true` |
| Field birth event | `ultra.birthEvent(node)` — a no-op unless ULTRA is active |
| Acoustic confirmation | 1400 Hz triangle |
| Unknown `domain` | Falls back to cyan; node still injects (**no validation error**) |

**Side effects:** mutates the live arrays, the DOM badge, the metrics flag and the audio context.
**Cost:** `O(n log n)` — the neighbour sort dominates at 90–130 nodes.

#### `setDisplayMode(mode: 'standard' | 'ultra') → void`
Switches renderer. `'ultra'` calls `ultra.enter()`, `'standard'` calls `ultra.exit()`. The graph,
the camera and the selection are untouched; the standard loop yields while the field is active.

#### `seedZaziopath(silent?: boolean) → boolean`
Merges the Zaziopath structure into the live graph: 8 stratum anchors, 29 § 00c entities and 1
unresolved question (38 nodes), 17 `wire` edges carrying their published mechanisms and 30
`containment` edges (one per entity, plus the question bound to the INDEX anchor) — boot 90/265 →
**128 nodes / 312 edges**. Idempotent — returns `false` and (unless `silent`) says so in the terminal.
Called automatically on the first `ultra.enter()`. **Cost:** `O(n)` plus the metrics pass.

#### `filterDomain(dom: string) → void`
Sets `activeDomainFilter` and re-styles the `.domain-btn` strip (`underline font-bold text-neon-cyan`
on the active button). Pass `'all'` to clear.
**Valid values:** `all` · `memetics` · `semiotics` · `psychoacoustics` · `hyperstition` · `alchemy`
(the alchemy button arrived in 9.5.0, retiring `NOO-011`). The filter also gates hit-testing, so a
filtered-out node cannot be selected.

#### `recluster() → void`
Displaces every node by a uniform ±100 px on both axes, re-seeding the layout. Plays a 500 Hz
square wave. **Cost:** `O(n)`.

#### `toggleLabels() → void`
Flips `showLabels`, which gates the label pass in `renderGraph`.

---

## Engine: `graphMetrics` — derived metrics

A pure function of the node and edge arrays, recomputed on a 30-frame cadence and whenever `dirty` is
set (any topology change). Both renderers read it; neither writes to it.

#### `rebuild() → void`
Per node: `degree`, `mass` (degree centrality shaded by `valence`). Per stratum: `count`, centroid
`x`/`y`, mean `activation`/`uncertainty`, `intensity`. Then calls `computeWeather()`.
**Cost:** `O(V + E)`.

#### `computeWeather() → void`
Fills `weather` with unit-interval channels:

| Channel | Reads |
| --- | --- |
| `excitation` | mean node activation, mean edge strength |
| `tension` | cross-stratum edge mass × endpoint uncertainty, unresolved share |
| `inference` | inferred edges and inferred nodes |
| `source` | share of nodes with recorded provenance |
| `cluster` | strongest stratum intensity |
| `turbulence` | `0.4·tension + 0.3·inference + 0.3·excitation` |

#### `updateRelevance(focusId: number | null) → void`
Three-hop relevance map over the real adjacency (`1`, `0.62`, `0.34`, `0.18`, default `0.1`) with a
`+0.22` bonus for same-stratum neighbours of the focus. Read by the field's dimming, convergence and
label passes. **Cost:** `O(V + E)`.

---

## Engine: `ultra` — ultra visualisation field

The second renderer. Full behaviour: [`ULTRA-VISUALIZATION.md`](ULTRA-VISUALIZATION.md).

| Member | Type | Meaning |
| --- | --- | --- |
| `enabled` | `boolean` | whether the field owns the frame |
| `field` | `'swarm' \| 'constellation' \| 'storm' \| 'mycelial' \| 'dream'` | active submode |
| `params` | `{ density, glow, turbulence, traffic }` (0–100) + `{ weather, dream, trails }` (boolean) | control-surface state |
| `tier` / `autoTier` | `0–3` / `boolean` | adaptive LOD tier and whether it self-selects |
| `focusId` / `hoverId` | `number \| null` | selected and hovered node |
| `dream` / `surge` / `flash` | `0–1` | idle ramp, event surge and storm flash |
| `waves` | `Array` | live shockwaves (births, focus, excitation bursts) |

#### Lifecycle
- `init() → void` — sprite atlas, 900-slot particle pool, legend, controls. Once, at boot.
- `enter() → void` / `exit() → void` — start/stop the field; seeds the Zaziopath lattice on first
  entry, clears the atlas canvas on entry, restores it on exit. `enter()` refuses and explains itself
  if no 2D context exists.
- `invalidate() → void` — rebuilds the vignette and forces a nebula refresh (resize / DPR change).
- `loop(ts) → void` — one field frame: decay → metrics → adapt → physics → ambient → particles →
  render → HUD (DOM at ~5 Hz).

#### Controls
- `setSubmode(name) → void` — selects a field (enters ULTRA if needed; `dream` toggles back to `swarm`).
- `setParam(key, value) → void` — clamps to `0–100`.
- `toggle(key) → void` — `'weather'`, `'dream'`, `'trails'`.
- `cyclePreset() → void` — `CALM → BALANCED → MAXIMAL`, applying density/glow/turbulence/traffic.
- `toggleLegend() → void` · `refreshControls() → void` · `syncSliders() → void`.

#### Events
- `focus(node | null) → void` — sets the focused cluster and recomputes relevance.
- `birthEvent(node) → void` — shockwave, 26-spark burst, weather spike, HUD line.
- `excite(amount, x?, y?, color?) → void` — raises the surge and optionally pushes a shockwave.
- `touch() → void` — resets the idle clock; wired to pointer movement.

#### Shared hit-test
`pickNodeAt(clientX, clientY)` is global and used by **both** renderers: it widens the radius in
ULTRA so the larger halos remain clickable, and a click always resolves to the same node and the same
terminal deep-dive.

#### Tunable tables
`ULTRA_FIELDS` (force profile, particle mix, edge grammar per field), `ULTRA_TIERS` (what each LOD
drops), `ULTRA_PRESETS` / `ULTRA_PRESET_VALUES`, `ULTRA_MAX_PARTS` (pool ceiling). Extension recipes:
[`ARCHITECTURE.md` § 15](ARCHITECTURE.md#15-extension-seams).

---

## Engine: `polymathLLM` — local inference with template fallback

> **Historical fallback:** the original engine had no inference, network or prompt consumption. The composition
> algorithm, its variation space (100 argument structures, ≈29,100 surface variations) and the
> disclosure that `prompt` is accepted but never read are all documented in
> [`ARCHITECTURE.md` § The composition engine](ARCHITECTURE.md#12-the-composition-engine-polymath-llm).

#### `appendChat(role: 'user' | 'system' | 'assistant', text: string) → void`

Creates a transcript entry, appends it to `#terminal-output`, scrolls to the bottom and hydrates any
Lucide icons inside it. Role determines the visual treatment: user prompts get a terminal-prompt
prefix, system notices a compact cyan treatment, assistant output a full panel.

**Side effects:** DOM append, `scrollTop` set, `lucide.createIcons()` re-run.
**HTML note:** transcript text is inserted as text (not HTML). The ingestion feed still has
a separate filename interpolation sink tracked as `NOO-007`.

#### `clearChat() → void`
Empties `#terminal-output` (including the authored boot banner) and plays a 400 Hz square wave.

#### `submitUserPrompt() → void`
Reads and trims `#terminal-input`; returns early when empty. Otherwise clears the field, echoes the
prompt as a `user` entry, plays a 1000 Hz tick and calls `generatePolymathResponse(val)`.

#### `generatePolymathResponse(prompt: string) → void`
**Asynchronous.** After a fixed 400 ms delay, composes a response and appends it as an `assistant`
entry. In simulation mode the `prompt` argument is **never read**; output depends solely on the RNG. See §12 of the
architecture document — this is an intentional, documented property, not an oversight.

Composition: 1 opening (5) + 2 distinct tenets (5 × 4 ordered pairs) + the fixed 4-step execution
matrix + a confidence figure (97.00–99.90 %, 291 values).

#### `runDirective(type: string, data?: object) → void`

Preset entry point used by the toolbar chips, the grimoire and the graph inspector.

| `type` | Echoed prompt | Behaviour |
| --- | --- | --- |
| `'hyperstition'` | "INITIATE DIRECTIVE: Hyperstition Blueprint Generation" | Composed response |
| `'viral-semiotics'` | "…Viral Semiotic Attack Vector" | Composed response |
| `'psychoacoustic-funnel'` | "…Acoustic Indoctrination Architecture" | Composed response |
| `'esoteric-manifesto'` | "…Occult Brand Manifesto Synthesis" | Composed response |
| `'node-deepdive'` | — | **Deterministic** analysis of `data`, bypassing the composer |

`'node-deepdive'` is the only directive that produces graph-aware content: it interpolates
`data.title`, `data.domain`, `data.valence` and `data.desc` into a fixed analytical frame. This is
the call made when a node is clicked in the atlas.

---

## Engine: `soundLab`

#### `playTone(mode: 'subliminal' | 'binaural' | 'gamma') → void`

| `mode` | Frequency | Waveform | Display string |
| --- | --- | --- | --- |
| `'subliminal'` | 432 Hz | triangle | `432.00 Hz (SOLFEGGIO ACTIVE)` |
| `'binaural'` | 528 Hz | triangle | `528.00 Hz (BIO-RESONANCE ACTIVE)` |
| `'gamma'` | 40 Hz | triangle | `40.00 Hz (GAMMA BRAINWAVE ACTIVE)` |
| anything else | 40 Hz | triangle | falls through to the gamma branch |

**Side effects:** initialises audio, plays a 0.8 s tone at gain 0.08, writes `#tone-freq-display`.
**Honest framing:** three oscillator frequencies with a psychoacoustic vocabulary layer. No
entrainment, binaural beating or solfeggio effect is implemented.

---

## Engine: `paletteGen`

#### `render() → void`
Builds five swatches from `PALETTES[currentPaletteIdx]` into `#palette-swatches`. Each swatch copies
its hex to the clipboard on click and appends a system transcript line. Clipboard access is
optional-chained (`navigator.clipboard?.`), so it degrades silently on insecure origins.

#### `mutate() → void`
Advances `currentPaletteIdx` modulo 5 and re-renders. Plays a 900 Hz triangle.

#### `copyActive() → void`
Writes the active palette as CSS custom properties and announces it in the transcript.

```css
--accent-1: #030509; --accent-2: #0e1424; --accent-3: #00f7ff; --accent-4: #ff0055; --accent-5: #a855f7;
```

---

## Engine: `grimoire`

#### `render(list = GRIMOIRE_DATA) → void`
Replaces `#grimoire-container` with one card per fragment (title, tags, three-line clamped body).
Clicking a card appends a system line and dispatches the fragment title into
`polymathLLM.generatePolymathResponse(...)`.

#### `filter(query: string) → void`
Case-insensitive substring match across `title`, `text` and `tags`; delegates to `render`. Bound
directly to `input` on `#grimoire-search`.
**Cost:** `O(F × L)` — 7 records, no index required.

---

## Engine: `ideaCombinator`

#### `synthesize() → void`
Reads two domain vectors from `#synth-domain-1` and `#synth-domain-2`, shows a pending state, then
after 500 ms composes a "mutation":

```js
title = `${d1.split(' ')[0]} ${d2.split(' ')[1] ?? d2.split(' ')[0]}`;
axiom = `By fusing ${d1} with ${d2}, we eliminate consumer price resistance: ` +
        `the product becomes an existential defense against ontological drift.`;
```

The mutation is written to `#synth-output-box` **and injected into the graph** as a `hyperstition`
node — the only path that produces both a text artefact and a persistent node.
**Combinator space:** 5 × 5 = 25 pairings (ordered; both selectors offer the same five options).

---

## Aggregate state

Module-level bindings are the engine's state model. They are **not** namespaced and share the global
scope with engine objects.

| Binding | Owner | Type | Lifecycle | Read by |
| --- | --- | --- | --- | --- |
| `audioCtx` | sound | `AudioContext \| null` | lazy, never closed | `playBeep` |
| `audioEnabled` | sound | `boolean` | toggled by user | `playBeep` |
| `highestZ` | window manager | `number` (starts 50) | monotonic; never reset | `bringToFront` |
| `canvas` / `ctx` | graph | `HTMLCanvasElement` / `CanvasRenderingContext2D` | captured at parse | render loop |
| `graphNodes` / `graphEdges` | graph | `Array` | mutated in place | physics, render, HUD, injection |
| `showLabels` | graph | `boolean` | toggled | render loop |
| `activeDomainFilter` | graph | `string` | set by toolbar | render loop |
| `hoveredNode` | graph | `node \| null` | per pointer move | render loop, HUD, click |
| `camera` | graph | `{x, y, zoom}` | pan/zoom | render loop, hit test |
| `isGraphDragging` | graph | `boolean` | per pointer gesture | pan |
| `lastMouse` | graph | `{x, y}` | per pointer gesture | pan |
| `currentPaletteIdx` | palette | `number` | rotated | `paletteGen` |

**No persistence.** Nothing is written to `localStorage`, cookies, IndexedDB or a server. Reloading
restores the authored defaults exactly.

---

## DOM contract

68 declared IDs, 45 of them resolved by `getElementById` and 0 dangling. An element is written by
exactly one owner unless stated; the audit's four fatal rules enforce uniqueness and referential
integrity on every run.

| ID | Element | Owner | Written by | Notes |
| --- | --- | --- | --- | --- |
| `workspace` | `<main>` | — | — | Positioning context only |
| `win-graph` … `win-synthesizer` | `<div>` ×7 | window manager | `makeDraggable`, minimise/maximise/realign | All share `.glass-panel` + `.win-header` |
| `neural-canvas` | `<canvas>` | graph | `resizeCanvas` | Backing store sized to parent |
| `ultra-canvas` | `<canvas>` | ultra | `ultra.render` | Second canvas, pointer-transparent overlay |
| `mode-btn-standard` `mode-btn-ultra` | `<button>` ×2 | graph | `setDisplayMode` | `mode-btn-on` marks the active renderer |
| `render-badge` | `<span>` | ultra | `ultra.refreshControls` | `FORCE-SIM` ⇄ `ULTRA FIELD` |
| `ultra-deck` | `<div>` | ultra | `enter` / `exit` | `hidden` while STANDARD is active |
| `ultra-field-name` `ultra-fps` `ultra-lod` `ultra-signal-line` | `<span>` | ultra | HUD pass (~5 Hz) | Live field readouts |
| `bar-excitation` `bar-tension` `bar-inference` `bar-source` | `<i>` | ultra | HUD pass | Weather meters; width = channel value |
| `ultra-density` `ultra-glow` `ultra-turbulence` `ultra-traffic` | `<input type=range>` | ultra | user → `setParam` | Clamped 0–100 |
| `ultra-weather-btn` `ultra-dream-btn` `ultra-trails-btn` `ultra-legend-btn` `ultra-preset` `ultra-seed-btn` | `<button>` | ultra | `toggle` · `cyclePreset` · `seedZaziopath` | Deck chips |
| `ultra-legend` | `<div>` | ultra | `ultra.renderLegend` | Class (shape) + stratum (aura) registry |
| `node-inspector-hud` | `<div>` | graph | `mousemove` handler | Opacity-toggled, not display-toggled |
| `hud-cluster` `hud-title` `hud-desc` `hud-metric` | `<span>`/`<h4>`/`<p>` | graph | `mousemove` handler | Fed from `hoveredNode` |
| `terminal-output` | `<div>` | polymath | `appendChat`, `clearChat` | Append-only log |
| `terminal-input` | `<input>` | polymath | `submitUserPrompt` | `Enter` bound inline |
| `synapse-count` | `<span>` | graph | `initGraphEngine`, `injectNode`, `seedZaziopath` | Live node count |
| `chrono-clock` | `<div>` | telemetry | 1 Hz interval | `HH:MM:SS UTC` |
| `stat-r0` `stat-cog` | `<span>` | telemetry | 1 Hz interval (~40 % of ticks) | Random-walk drift |
| `stat-sub` | `<span>` | — | **never** | Framed as live — `NOO-013` |
| `entropy-val` | `<span>` | — | **never** | Framed as live — `NOO-013` |
| `radar-poly` | `<polygon>` | — | **never** | Static points — `NOO-013` |
| `telemetry-log` | `<div>` | — | **never** | Two authored rows — `NOO-013` |
| `audio-toggle-btn` `audio-icon` | `<button>`/`<i>` | sound | `toggleAudio` | Inner HTML replaced |
| `drop-zone` | `<div>` | ingestion | inline hover handlers | `dragover` highlight |
| `file-input` | `<input type=file>` | ingestion | `handleFileInput` | `multiple`, hidden |
| `ingest-status-text` | `<span>` | ingestion | `processFiles` | Class swapped for state colour |
| `ingestion-history` | `<div>` | ingestion | `processFiles` | Newest first (`prepend`) |
| `palette-swatches` | `<div>` | palette | `paletteGen.render` | 5 swatches |
| `tone-freq-display` | `<span>` | sound | `soundLab.playTone` | Frequency readout |
| `aesthetic-cards` | `<div>` | — | — | Authored colour/type pairings |
| `grimoire-search` | `<input>` | grimoire | `grimoire.filter` | Bound to `oninput` |
| `grimoire-container` | `<div>` | grimoire | `grimoire.render` | Replaced wholesale |
| `synth-domain-1` `synth-domain-2` | `<select>` | combinator | user | 5 options each |
| `synth-output-box` | `<div>` | combinator | `ideaCombinator.synthesize` | Pending → result |
| `quick-inject-modal` | `<div>` | modal | `quickInjectModal`/`closeInjectModal` | `hidden` ⇄ `flex` |
| `custom-node-title` `custom-node-domain` `custom-node-desc` | form fields | modal | user | Read by `injectCustomNodeAction` |

---

## Inline handler map

Markup binds behaviour by attribute. Method calls (`graphEngine.*`) are excluded from the audit's
"undefined global" rule; bare function names must resolve.

| Attribute | Handler | Effect |
| --- | --- | --- |
| `onclick` | `toggleAudio()` | Mute/unmute + re-render the control |
| `onclick` | `resetWindowPositions()` | Restore the authored grid |
| `onclick` | `quickInjectModal()` | Open the injection modal |
| `onclick` | `restoreOrFocus('win-…')` | Dock launcher (6 windows; synthesizer missing — `NOO-012`) |
| `onclick` | `minimizeWindow('win-…')` | Hide a window |
| `onclick` | `maximizeWindow('win-…')` | Toggle maximise with snapshot |
| `onclick` | `graphEngine.recluster()` `toggleLabels()` `filterDomain('…')` | Atlas controls |
| `onclick` | `graphEngine.setDisplayMode('…')` | STANDARD ⇄ ULTRA renderer switch |
| `onclick` | `ultra.setSubmode('…')` | Field selection (5 submodes) |
| `oninput` | `ultra.setParam('…', this.value)` | Density · glow · turbulence · traffic |
| `onclick` | `ultra.toggle('weather' \| 'dream' \| 'trails')` `toggleLegend()` `cyclePreset()` | Deck chips |
| `onclick` | `graphEngine.seedZaziopath()` | Merge the Zaziopath lattice into the live graph |
| `onclick` | `polymathLLM.runDirective('…')` `clearChat()` `submitUserPrompt()` | Terminal controls |
| `onkeydown` | `if (event.key === 'Enter') polymathLLM.submitUserPrompt()` | Prompt submission |
| `onclick` | `soundLab.playTone('…')` | Frequency presets |
| `onclick` | `paletteGen.mutate()` `copyActive()` | Palette rotation / CSS export |
| `onclick` | `ideaCombinator.synthesize()` | Dialectical mutation |
| `oninput` | `grimoire.filter(this.value)` | Live fragment search |
| `onclick` | `injectCustomNodeAction()` `closeInjectModal()` | Modal commit/dismiss |
| `ondragover` / `ondragleave` / `ondrop` | inline | Drop-zone highlight and ingestion |
| `onchange` | `handleFileInput(event)` | Picker ingestion |

**Keyboard.** One non-inline `keydown` listener binds `U` (renderer switch), `1`–`5`
(`ultra.setSubmode`), `W` (weather), `D` (dream/IDLE) and `L` (legend). It ignores events originating
in `INPUT`/`TEXTAREA`/`SELECT` and any modified key, so typing in the terminal and the modals is
unaffected.

---

## Data constants

| Constant | Line | Shape | Cardinality |
| --- | --- | --- | --- |
| `DOMAINS` | 952 | `{ key: { name, color } }` | 5 |
| `ZAZIOPATH_STRATA` | 974 | `{ k, g, label, hex, home, i }[]` | 8 |
| `STRATUM_OF` | 991 | `{ domain: stratumKey }` | 5 |
| `NODE_CLASSES` | 999 | `{ key: { g, label, hue, shape } }` | 5 |
| `ZAZIOPATH_WIRES` | 1011 | `[from, mechanism, to][]` | 17 |
| `rawSeedThemes` | 1090 | `{ id, title, domain, desc, valence }[]` | 15 |
| `ULTRA_FIELDS` | 1664 | `{ field: { cohesion, repel, grav, … } }` | 5 |
| `ULTRA_TIERS` | 1674 | `{ name, dust, traffic, dpr, … }[]` | 4 |
| `VOCAB` | 2591 | `{ openings[5], tenets[5], actions[4] }` | 14 strings |
| `PALETTES` | 2818 | `string[5][5]` | 5 states × 5 hex |
| `GRIMOIRE_DATA` | 2863 | `{ title, tags, text }[]` | 7 |

Boot graph: **90 nodes** (15 seed archetypes × 6 procedural generations), **265 edges** (2–4 per
node). Procedural titles are suffixed `[v1.0 … v7.0]`. Seeding the Zaziopath lattice adds **38 nodes
and 47 edges** → 128 / 312 (see `seedZaziopath`).

---

## Tooling API

### `scripts/audit.mjs`

Static integrity audit. Dependency-free; requires Node.js ≥ 18.

```bash
node scripts/audit.mjs                    # human-readable report; exit 1 on regression
node scripts/audit.mjs --json             # machine-readable report to stdout
node scripts/audit.mjs --write-report     # also emit reports/audit.json (+ markdown surface)
node scripts/audit.mjs --refresh-baseline # rewrite scripts/audit-baseline.json
```

| Exit code | Meaning |
| --- | --- |
| `0` | No fatal violations, no regression, payload within the hard budget |
| `1` | Regression, fatal DOM-contract violation, or payload over the 224,000 B hard budget |
| `2` | The audit could not run (missing `index.html`, unparseable baseline) |

**Report schema** (`--json`):

```jsonc
{
  "generatedAt": "ISO-8601",
  "source": "index.html",
  "budget":   { "bytes": 178657, "lines": 2994, "warn": 188000, "fail": 224000, "status": "ok" },
  "fatal":    [],                 // always-fatal DOM contract violations
  "regressions": [ { "id": "NOO-001", "severity": "high", "title": "…",
                     "seen": 6, "allowed": 6, "evidence": ["border-crimson-900"] } ],
  "improvements": [],             // counts below baseline — tighten the baseline
  "tracked":      [],             // known debt, exactly at baseline
  "counts":       { "NOO-001": 6, "…": 0 },
  "pass": true
}
```

**Always-fatal rules** (never baselined): duplicate DOM ids · dangling `getElementById` ·
`restoreOrFocus` targeting a missing window · inline handler calling an undefined global.

**Ratchet semantics.** Each register ID carries an accepted count in
`scripts/audit-baseline.json`. Findings may not exceed it; improvements are reported but do not
fail. The baseline is updated only inside the pull request that caused the change, which is what
makes "known debt" auditable rather than rhetorical.

At `HEAD` the baseline accepts **30 findings across 16 register IDs**. Five IDs were retired in
9.5.0 — `NOO-010`, `NOO-011`, `NOO-014`, `NOO-021` (fixed) and `NOO-016` (cleared from the
automated count by 17 `aria-*` attributes; the remaining accessibility work is tracked by hand in
[`ACCESSIBILITY.md`](ACCESSIBILITY.md)) — and `NOO-007` fell from four sites to two. See
[`ARCHITECTURE.md` § Defect register](ARCHITECTURE.md#17-defect-register).

### `scripts/serve.mjs`

Zero-dependency static server.

```bash
node scripts/serve.mjs [--port 4173] [--host 0.0.0.0]
# environment fallbacks: PORT, HOST
```

| Property | Behaviour |
| --- | --- |
| Default bind | `0.0.0.0:4173` — reachable from containers and remote sandboxes |
| Directory index | `/` → `index.html` |
| MIME map | html · js · mjs · css · json · svg · png/jpeg/webp · ico · woff2 · txt · md |
| Traversal | Resolved paths must stay inside the project root; dotfile segments are refused (`403`) |
| Caching | `cache-control: no-store` — the server is a development tool |
| Headers | No `X-Frame-Options` and no `frame-ancestors` directive, so embedding works |
| Shutdown | `SIGINT` / `SIGTERM` close the listener cleanly |

### npm scripts

| Command | Equivalent |
| --- | --- |
| `npm start` / `npm run serve` | `node scripts/serve.mjs` |
| `npm test` | `node scripts/audit.mjs` |
| `npm run audit:json` | `node scripts/audit.mjs --json` |
| `npm run audit:report` | `node scripts/audit.mjs --write-report` |
| `npm run audit:baseline` | `node scripts/audit.mjs --refresh-baseline` |
| `npm run ci` | `node scripts/audit.mjs --write-report` |

---

## Extending

Three recipes, each a two-file change at most. Full seam table in
[`ARCHITECTURE.md` § Extension seams](ARCHITECTURE.md#15-extension-seams).

```js
// 1 · New domain — add to DOMAINS, the toolbar, and the modal selector
alchemy: { name: 'Alchemical OS', color: '#00f7ff' },
// <button onclick="graphEngine.filterDomain('alchemy')" class="domain-btn" data-d="alchemy">ALCHEMY</button>

// 2 · New directive — add a VOCAB slice, a runDirective branch, and a toolbar chip
runDirective(type, data = null) { /* … */ if (type === 'my-directive') { … } }

// 3 · New engine — an object literal inside the runtime script, invoked from DOMContentLoaded
const myEngine = { init() { /* … */ } };
window.addEventListener('DOMContentLoaded', () => { /* … */ myEngine.init(); });

// 4 · New ultra field — append to ULTRA_FIELDS (force profile + particle mix) and add a chip
storm: { label: 'SIGNAL STORM', cohesion: 0.6, repel: 1.0, grav: 0.4, jitter: 2.4, /* … */ },
// <button class="ultra-chip field-chip" data-field="storm" onclick="ultra.setSubmode('storm')">STORM</button>
```

**Contribution requirements:** `npm test` exits 0, new findings are baselined deliberately or fixed,
and any change to a documented signature is recorded in [`CHANGELOG.md`](../CHANGELOG.md). See
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

---

<div align="center">
<sub>Next: <a href="DESIGN.md">Design system →</a></sub>
</div>

## Local Ollama inference (optional)

The historical `polymathLLM.generatePolymathResponse(prompt)` template composer is now the
fallback. At startup `checkOllama()` calls `GET /api/noosphere/status`; `queryOllama(prompt,
context = this.context())` calls `POST /api/noosphere` and returns the generated text.
`generatePolymathResponse` uses this async path when online and switches to the original
400 ms simulated composer if a request fails. Node deep dives and grimoire selections also
use inference when available. `context()` supplies bounded graph, fragment, history and
local-ingestion excerpts. No model installation or pulling is performed.

The zero-dependency `scripts/serve.mjs` exposes only these API routes to loopback clients
using a localhost Host and matching Origin. Status returns `{online, model}` (200); POST
accepts `{prompt, context}` and returns `{response, model}` (200), or a JSON error
(400/403/405/413/503). The server checks `/api/tags` for `llama3.1:8b` and uses
`/api/chat` at `http://127.0.0.1:11434`, with `stream: false` and a NOÖSPHERE system
prompt. Static hosting has no API; the browser catches failures and stays in simulation.
