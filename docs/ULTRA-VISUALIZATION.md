# Ultra Visualisation

> **Status:** shipped in `9.5.0` · **Source of truth:** [`index.html`](../index.html) —
> `ZAZIOPATH_STRATA`, `NODE_CLASSES`, `graphMetrics`, `ULTRA_FIELDS`, `ultra`
> **Related:** [`ARCHITECTURE.md` § 6](ARCHITECTURE.md#6-engine-inventory) ·
> [`DESIGN.md` § 5](DESIGN.md#5-motion-policy) · [`PERFORMANCE.md` § 4](PERFORMANCE.md#4-complexity-summary) ·
> [`API.md`](API.md#engine-ultra--ultra-visualisation-field)

---

## 1. What it is

NOÖSPHERE // OS has two renderers for **one graph**.

| | STANDARD | ULTRA |
| --- | --- | --- |
| Renderer | `renderGraph()` — Canvas 2D, `shadowBlur` glow, 60 Hz force loop | `ultra.loop()` — layered Canvas 2D, additive compositing, sprite glow |
| Feel | readable engineering atlas | living swarm / neural field / signal storm |
| Data | `graphNodes` / `graphEdges` | the same arrays, the same objects |
| Selection | click → terminal deep-dive | click → terminal deep-dive **and** local thought-cluster |
| Camera | shared `camera{x,y,zoom}` | shared |
| Cost | ~1–2 ms/frame at 90 nodes | 3–12 ms/frame, adaptive (see § 10) |

Ultra mode is a **second renderer over the same model**, never a second knowledge base. A node
created by ingestion exists once; it is drawn by whichever renderer is active. Positions are shared
too: switching modes is a change of perspective, not a reset of the layout.

**There is no separate data path.** Every visual property in the field is computed from the same
`graphNodes` / `graphEdges` records that feed the standard atlas, from the Zaziopath strata in
`ZAZIOPATH_STRATA`, or from the derived metrics in `graphMetrics`.

---

## 2. Enabling it

| Action | How |
| --- | --- |
| Switch renderer | `RENDER: STANDARD \| ULTRA` in the graph window toolbar, or press **U** |
| Pick a field | the `FIELD:` chips (`SWARM · CONSTELL · STORM · MYCEL · DREAM`), or keys **1–5** |
| Weather layer | `WEATHER` chip or **W** |
| Idle dream state | `IDLE` chip or **D** |
| Motion trails | `TRAILS` chip |
| Visual legend | `MAP` chip or **L** |
| Density / glow / turbulence / traffic | the four sliders in the ultra deck |
| Effect presets | `PRESET:` cycles `CALM → BALANCED → MAXIMAL` |
| Seed the Zaziopath lattice | `SEED ⧗ ZAZIOPATH` (happens automatically on first entry) |

Hotkeys are ignored while a text field has focus, so typing in the terminal or the injection modal is
unaffected.

First entry into ULTRA **seeds the Zaziopath lattice** into the live graph: the eight § 00a strata
become anchor nodes, the seventeen § 00c wires become edges carrying their published mechanisms, and
the vault's premise question becomes the graph's single unresolved node. That is announced in the
transcript, and it is real data entering the real model — the STANDARD atlas draws exactly the same
nodes afterwards.

---

## 3. The data contract

Every node carries the base record plus four provenance fields:

```js
{
  id, title, domain, desc, valence,        // base record (unchanged)
  x, y, vx, vy, radius, color,             // base record (unchanged)
  stratum,                                 // 'index' | 'identity' | 'shadow' | 'evidence'
                                           // | 'recursion' | 'stewardship' | 'specimens' | 'myth'
  klass,                                   // 'source' | 'concept' | 'inferred' | 'ingested' | 'question'
  provenance: { origin, ref, recorded },   // 'seed' | 'zaziopath' | 'ingestion' | 'synthesis' | 'manual'
  uncertainty,                             // 0–1, the claim's instability
  activation,                              // 0–1, recency / activity (decays, rekindled by traffic)
  mass, phase, warp, birthAt, degree,      // derived: importance, motion signature, birth time
}
```

Edges gained four fields; the index-based `source` / `target` contract is unchanged:

```js
{ source, target, strength, kind, inferred, activation, ref, mechanism, birthAt }
```

`kind` is one of `support` (procedural seed web), `containment` (stratum → entity), `wire` (§ 00c
cross-stratum wire), `derived` (an injected node attaching to its neighbours).

**Strata** come from `ZAZIOPATH_STRATA`, which reproduces the Zaziopath vault's own § 00a colour
code: eight strata, one glyph and one Okabe–Ito hue each. `STRATUM_OF` maps the app's five semantic
domains onto that structure (`memetics → shadow`, `semiotics → myth`, `psychoacoustics → evidence`,
`hyperstition → recursion`, `alchemy → stewardship`). The vault's ninth marker (`◇`,
practice/production) has no stratum of its own and folds into `stewardship`, because both describe
work-on-the-self routines rather than evidence or lore. `INDEX` is lifted from `#231F20` to a neutral
`#8b93a7` — the vault's near-black cannot glow on a `#030509` field.

---

## 4. Visual mappings

Each row is a mapping from data to light. Nothing in the field animates on a value the graph does not
hold.

| Visual property | Read from | Where in the source |
| --- | --- | --- |
| Node size | conceptual **mass** = degree centrality × valence | `graphMetrics.rebuild()` → `n.mass` |
| Halo radius / brightness | **activation** (recency, ingestion, focus, traffic arrivals) | `n.activation`, `ultra.stepParticles()` |
| Pulse rate | per-node motion signature | `n.warp`, `n.phase` |
| Edge width | relationship **strength** | `e.strength` |
| Edge traffic speed | edge **activation** × field speed × live traffic slider | `e.activation`, `ULTRA_FIELDS[].speed` |
| Jitter / instability | **uncertainty** × turbulence × graph tension | `n.uncertainty`, `graphMetrics.weather.turbulence` |
| Cluster aura (fog/nebula) | **stratum** membership × regional intensity | `graphMetrics.strata[k].intensity` |
| Dust density | local connectivity and the density slider | `graphMetrics.degree`, `params.density` |
| Brightness | current **focus** relevance (1 / 2 / 3 hops, same-stratum bonus) | `graphMetrics.relevance` |
| Halo ring colour | **stratum** (where the claim lives) | `ZAZIOPATH_STRATA[].hex` |
| Core colour | **domain** (what kind of idea it is) | `DOMAINS[].color` |
| Class grammar | **claim class** — see § 5 | `NODE_CLASSES[].shape` |
| Turbulence | inference density + unresolved tension | `graphMetrics.weather` |
| Storm flash / streaks | contradiction pressure (cross-stratum wire mass × endpoint uncertainty) | `weather.tension` |

Dual coding is deliberate: **the neon core is the domain, the aura is the stratum.** A `SHADOW` claim
about psychoacoustics keeps its amber core inside a pink atmosphere. The standard atlas keeps the
existing single coding (colour = domain), so nothing about the old view changes meaning.

---

## 5. Node-class grammar

Five claim classes, five halo structures. They are drawn procedurally (no sprite atlas), and only at
LOD `BALANCED` or above.

| Class | Glyph | Halo | Motion |
| --- | --- | --- | --- |
| `source` | ▤ | rotating hexagon, orange | steady; the calmest matter in the field |
| `concept` | ◉ | closed ring, cyan | steady, brighter with valence |
| `inferred` | ∞ | **dashed** ring, violet | high jitter — an inferred claim is never still |
| `ingested` | ⇣ | expanding birth rings, green | high glow for ~3 s after entry, then settles |
| `question` | ? | **broken** ring, crimson | slow, high-jitter orbit; a ring that never closes |

`inferred` covers the 75 `[vN.0]` variant nodes (synthesis of a seed archetype) and anything the
combinator or the operator authors. `source` covers the Zaziopath § 00a/§ 00c entities and artifacts.

---

## 6. Strata as regions

The field is organised into eight energetic regions. Each stratum owns:

- an **aura** — a radial fog plume in the stratum's hue, sized by `stratum.intensity`
  (share of the field × how awake that region is);
- a **gravity well** — nodes of the stratum are pulled toward the stratum's centre of mass, so the
  regions self-assemble from the data rather than being assigned fixed coordinates;
- **cohesion** — same-stratum neighbours within 190 px attract each other (swarm behaviour);
- **filament character** — in `MYCELIAL`, the edges inside a stratum curve into tendrils with a
  growth pulse crawling them.

Anchor nodes (created by the Zaziopath seed) give each region a hub, but the region's position is
still the live centre of mass of its members. Move the graph, and the regions move with it.

---

## 7. Submodes

One selection, five parameterisations of the same arrays. Each entry changes the force profile, the
particle mix and the edge grammar — never the data.

| Field | Character | What changes |
| --- | --- | --- |
| `SWARM` | default living swarm | balanced cohesion/repulsion, taut edges, full traffic |
| `CONSTELLATION` | crisp geometry | strong cohesion + high repulsion, minimal jitter, straight bright links, slow traffic, low dust |
| `SIGNAL STORM` | discharge | 2.4× jitter and traffic speed, streak particles, high flash rate driven by contradiction pressure |
| `MYCELIAL` | organic growth | curved tendrils with a growth pulse, low repulsion, dense fog |
| `DREAM` | deep idle | slowest drift, softest glow, heaviest fog; idle behaviour forced on regardless of interaction |

---

## 8. Cognitive weather

A second-order atmosphere computed from the graph every 30 frames in `graphMetrics.computeWeather()`.
It is a display layer, not a chart: weather changes the fog, the flash rate, the vignette breathing
and the traffic spawn rate, and is readable as four meters in the field's HUD.

| Channel | Computed from | Visual consequence |
| --- | --- | --- |
| `excitation` | mean activation + edge strength | fog brightness, traffic spawn rate |
| `tension` | cross-stratum edge mass × endpoint uncertainty + unresolved share | crimson storm flashes, vignette breathing, wire emphasis |
| `inference` | inferred edges + inferred nodes | violet nebula weight, jitter floor |
| `source` | share of nodes with recorded provenance | green meter (evidence density) |
| `cluster` | strongest stratum intensity | aura radius during high activity |
| `turbulence` | `0.4·tension + 0.3·inference + 0.3·excitation` | jitter multiplier, dust motion |

The values are unit-interval and bounded; the field can look stormy but it cannot degenerate.

---

## 9. Focus, ingestion and idle

**Focus.** Selecting a node (click, or a terminal deep-dive) sets `ultra.focus()`, which computes a
three-hop relevance map over the real edge set. Related nodes brighten, unrelated nodes dim to 18 %
and their edges stop being drawn at all; connected edges thicken and take the "hot" stroke; the local
cluster converges toward the selection while unrelated matter drifts outward. Clicking empty canvas
clears the focus. The terminal's `selectedNode` is the same entity, so Ollama context, deep-dives and
the visual cluster always refer to one node.

**Ingestion.** `graphEngine.injectNode()` is the single entry point used by the Ingestion Vector, the
idea combinator and the manual modal. In the field it produces a birth event: the node emerges with
an expanding halo, its links propagate to the three nearest conceptual neighbours, a shockwave and a
spark burst fire at its coordinates, and the weather spikes. `provenance.ref` records the file name,
the directive, or the operator.

**Idle / dream.** After ~11 s without pointer or keyboard activity the field sinks into its dream
state (if `IDLE` is on): drift amplitude rises, traffic thins, fog deepens, and every 9–17 s a
**revelation** lights a high-tension connection — the wire is drawn bright with a travelling pulse,
and the HUD names both endpoints. The moment the pointer moves, `ultra.touch()` resets the idle
clock and the field wakes.

---

## 10. Performance, LOD and fallbacks

Adaptive level of detail runs continuously. `ultra.adapt()` samples a frame-time EMA and a slow-frame
counter and moves between four tiers; each tier names what it drops rather than only how much.

| Tier | DPR cap | Dust | Traffic | Class grammar | Labels | Nebula cadence |
| --- | --- | --- | --- | --- | --- | --- |
| `SURVIVAL` | 1× | 0 | 0 | — | — | every 30 frames |
| `BALANCED` | 1× | 0.3× | 0.4× | ✔ | — | every 14 |
| `HIGH` | 1.5× | 0.65× | 1× | ✔ | ✔ | every 8 |
| `MAXIMAL` | 2× | 1× | 1.4× | ✔ | ✔ | every 4 |

The tier is shown in the deck (`LOD AUTO · HIGH`) and in the field badge (`ULTRA · HIGH`), so the
machine's behaviour is never mysterious.

Bounded by construction:

- particle pool: **900 slots**, reused, never allocated per frame;
- traffic pulses per frame: `150 × density × field × tier`;
- glow: pre-baked 64 px radial sprites drawn with `globalCompositeOperation = 'lighter'` — no
  `shadowBlur` anywhere in the field;
- physics: uniform grid (78 px cells) + 3×3 neighbourhood, so pair work is `O(n·k)`, not `O(n²)`;
- HUD: DOM writes at ~5 Hz, not per frame;
- nebula: offscreen canvas at 1/3.5 scale, refreshed on the tier cadence.

**Floor.** If a 2D composite context is unavailable, `ultra.enter()` refuses, says so in the terminal,
and the STANDARD renderer keeps running. If frames stay slow, the tier walks down to `SURVIVAL`
(nodes, edges, glows only) and stays there rather than dropping frames silently.

**Reduced motion.** With `prefers-reduced-motion: reduce` the field opens on `CONSTELLATION` at
turbulence 15 with the idle behaviour off — the same information, minimal ambient motion.

---

## 11. Architecture notes

- **Why Canvas 2D, not WebGL/Three.js.** The document is a zero-dependency, zero-build artefact; a
  WebGL path would add either a CDN dependency (breaking `ADR-001`/`ADR-002`) or a large amount of
  matrix/buffer code, and it needs a fallback path anyway. Pre-baked additive sprites give most of
  the visual headroom of a bloom pipeline at a fraction of the code, and they degrade gracefully.
- **Two canvases, one viewport.** `#neural-canvas` (standard) and `#ultra-canvas` (field) are stacked
  in the same container. The ultra canvas is `pointer-events-none`, so every existing interaction —
  drag-to-pan, wheel-zoom, hover inspection, click-to-select — is served by the original handlers and
  behaves identically in both modes. `pickNodeAt()` is the single hit-test both modes share.
- **One loop at a time.** `renderGraph()` yields every frame while `ultra.enabled` is true and
  resumes on exit; entering the field clears the atlas canvas so nothing stale sits under an additive
  layer.
- **Derived, never stored twice.** `graphMetrics` is a pure function of the node/edge arrays,
  recomputed on a cadence and on topology change. Adding a node anywhere in the app marks it dirty.

### Payload

The ultra field is the single largest subsystem in the document (~46 kB of the ~180 kB file). The
audit's payload budget was **re-baselined deliberately in 9.5.0** — as `ROADMAP.md` said it would be —
from 96,000/128,000 B to 188,000/224,000 B, anchored to the new measured payload with ~5 % warn and
~25 % fail headroom. See [`PERFORMANCE.md` § 8](PERFORMANCE.md#8-guardrails).

---

## 12. Verification

`npm run smoke` (`scripts/smoke.mjs`, dependency-free) runs the runtime inside a DOM/Canvas stub and
asserts the behaviour this document promises: boot graph shape, standard rendering, entering ULTRA,
lattice seeding, glow and nebula draw calls, weather derivation, movement of shared nodes, all five
submodes, presets, legend, injection adding exactly one node and its links, focus relevance, hotkeys,
resize while live, and returning to STANDARD.

```
npm test          # static integrity audit (register + payload budget)
npm run smoke     # behavioural smoke harness
npm run verify    # both
```

### Honest limits

- The visual mappings are **heuristics over real data**, not measurements: `mass` is a centrality
  proxy, and "contradiction pressure" is a weighted cross-stratum tension, not a truth claim.
- `verification is behavioural, not visual`: there is no headless-browser harness yet, so the harness
  proves the field draws and moves — not that it looks right. Pixel-level checks arrive with the
  Playwright harness scoped to `10.0.0`.
- Strata assignment for the app's five semantic domains is a **curated mapping** (§ 3), not something
  the data can decide.
