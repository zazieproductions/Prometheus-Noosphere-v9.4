# Performance

> The frame budget, the cost model, the measured payload, the optimisation ladder, and an explicit
> statement of what has *not* been measured.

**Reader's contract:** every number in this document is labelled as **measured** (reproducible from
this repository), **modelled** (derived from the source's complexity), or **unverified** (requires a
browser or network access this environment did not have). No number is presented as measured when it
is modelled.

---

## 1. The performance thesis

Two claims are worth defending, and one is worth retracting.

| Claim | Status | Evidence |
| --- | --- | --- |
| The application payload is small and auditable | ✅ **Measured** — 181,219 B, 3,023 lines, 0 vendored assets | `npm test` |
| The ultra field's cost is bounded by construction | ⚠️ **Modelled** — pool (900), LOD tiers (4) and grid (`O(n·k)`) bound it; per-frame ms **unverified** without a browser ([§ 3.3](#33-the-ultra-field-cost-model-modelled)) | source |
| The total delivery cost is small | ⚠️ **Unverified** — third-party CDN cost not measured here ([§ 7](#7-load-cost-and-its-measurement-gap)) | Requires network |
| "Canvas 60 fps" (window badge) | ⚠️ **Aspirational** — the badge is authored copy, and several costs below are frame-budget-relevant | [§ 3](#3-frame-budget-model) |

The retraction matters: the interface advertises "Canvas 60fps" as a capability badge. That is a
design statement, not a measurement, and this document is where that distinction is made explicit.

---

## 2. Measured baseline

| Metric | Value | Source |
| --- | --- | --- |
| Application payload | **181,219 B** (177 KiB) | `scripts/audit.mjs` |
| Lines | **3,023** | `scripts/audit.mjs` |
| Runtime dependencies installed | **0** | `package.json` |
| Vendored assets (images/fonts/audio) | **0 B** | Repository contains one data-free PNG in `docs/` |
| Network calls from the runtime | **0** | No `fetch` / `XMLHttpRequest` / `WebSocket` in the source |
| Third-party runtime dependencies | **3** (Tailwind CDN, Lucide CDN, Google Fonts) | `<head>` |
| Font families requested | **3** (Cinzel 3 weights, JetBrains Mono variable + italic variable, Syne 4 weights) | `<head>` |
| Ultra particle pool ceiling | **900 slots** (`ULTRA_MAX_PARTS`), scaled by density × tier — SURVIVAL uses **0** | `index.html` |
| Ultra LOD tiers | **4** named tiers, self-selected from measured frame ms | `ULTRA_TIERS`, `ultra.adapt` |
| Ultra physics grid | **78 px** uniform cells over a 260 px cutoff | `ultra.physics` |
| Audit runtime | **~0.4 s**, no install | `time npm test` |

**Payload budget, enforced in CI** (`scripts/audit.mjs`):

| Threshold | Bytes | Current | Headroom |
| --- | --- | --- | --- |
| Warn | 188,000 | 181,219 | +6,781 B |
| Fail | 224,000 | 181,219 | +42,781 B |
The budget exists because a single-file application is a *design asset*: it stays reviewable in one
sitting. The band was re-baselined in 9.5.0 from `96,000 / 128,000` in the same change that added the
ultra renderer — the largest single addition the file has taken. The new numbers are anchored to the
measured payload rather than to round figures: **warn at ≈ +5 %**, **fail at ≈ +25 %**. Past the warn
threshold the question is unchanged — whether the single-file delivery decision still pays for
itself — and it is a signal to reconsider that decision, not merely to raise a number. See
[`DECISIONS.md` ADR-015](DECISIONS.md).

---

## 3. Frame budget model

Target: **16.7 ms** per frame at 60 Hz; **6.9 ms** at 144 Hz.

### 3.1 Per-frame cost, by phase

| Phase | Operation | Complexity | Magnitude at boot | Notes |
| --- | --- | --- | --- | --- |
| `updatePhysics` | Pairwise repulsion | `O(n²)` with a 260 px cutoff | **4,005 pair evaluations** | No spatial index (`NOO-015`) |
| `updatePhysics` | Edge springs | `O(E)` | ≈270 | Trivial |
| `updatePhysics` | Gravity + damping + integration | `O(n)` ×3 passes | 90 ×3 | Trivial |
| `renderGraph` | Edge strokes | `O(E)` | ≈270 paths | One `beginPath`/`stroke` per edge |
| `renderGraph` | Node fills | `O(n)` | 90 arcs | Each sets `shadowColor` + `shadowBlur` |
| `renderGraph` | Labels | `O(n)` gated by LOD | ~15 typical | Full `n` only when zoomed in |
| Hit test | Nearest-node scan | `O(n)` per pointer move | 90 | Mouse-driven, not per-frame |

### 3.2 The two costs that actually matter

**(a) The quadratic broad phase.** 4,005 pairs per frame, each with a distance test plus a division
and four multiply-accumulates — roughly 40k–60k floating-point operations per frame before rendering.
This is the dominant CPU term and it scales badly: at 300 nodes it becomes 44,850 pairs
(**11×** the work for 3.3× the nodes). It is affordable at the current graph size by construction, and
it is the first thing to fix if the graph grows (`NOO-015`).

**(b) `shadowBlur` per node.** Canvas 2D shadows are not free: each blurred draw typically costs an
offscreen pass. Ninety shadowed arcs per frame is, in practice, the most expensive *rendering* line in
the system — and it is pure decoration (glow). This is the highest-leverage rendering optimisation
available, and it is listed first in the ladder for that reason. The ultra field already proves the
alternative: it stamps pre-baked radial-gradient sprites with `drawImage` and never touches
`shadowBlur`.

### 3.3 The ultra field cost model (modelled)

The field's costs are **structural bounds, not measurements** — they are enforced by the source and
verifiable by reading it, but no browser was available to time a frame.

| Phase | Cost | Bound |
| --- | --- | --- |
| Metrics pass | `O(V + E)` every 30 frames | `graphMetrics.rebuild` |
| Broad phase | `O(n·k)` | uniform grid, 78 px cells, 260 px cutoff |
| Particle step + draw | `O(P)` | `P = round(900 × density/100 × tierFactor)`, `0` at SURVIVAL |
| Glow stamps | `O(n + P)` | one pre-baked `drawImage` per sprite; no `shadowBlur` |
| Signal traffic | `O(E × traffic × tier)` | capped by tier, off at SURVIVAL |
| Nebula rebuild | **1 gradient / 4–30 frames** at ⅛ scale | `nebula` field of the active tier |
| HUD write | **~5 Hz** | text values + four bar widths |
| Adaptive tier | attempts the highest tier whose measured `avgMs` fits | `ultra.adapt`, hysteresis via `slowRun` |

Two consequences worth stating: the field **yields the standard loop** while it is active (one rAF
loop runs at a time), and it replaces the standard renderer's per-node `shadowBlur` with pre-baked
sprites — so the ultra path is, by construction, the cheaper of the two glow strategies. What remains
unmeasured is whether it actually holds 16.7 ms on real hardware; the harness in § 6 plus the
in-app `--fps` readout and `LOD AUTO` badge are how a reader can check.

### 3.4 The frame-rate coupling (a performance bug, not just a physics one)

`updatePhysics` advances by a constant increment per frame with no `deltaTime` (`NOO-020`). The
consequence is not only that the simulation runs ≈2.4× faster on a 144 Hz display — it is that the
**CPU cost per second scales with refresh rate**: 144 integrations per second instead of 60, plus 144
renders instead of 60, on the displays most likely to be attached to the fastest machines.

Fixing it is therefore a double win: correct dynamics *and* a 2.4× reduction in per-second simulation
cost on high-refresh hardware.

---

## 4. Complexity summary

| Subsystem | Per-event cost | Scales with | Bound by |
| --- | --- | --- | --- |
| Physics step | `O(n²) + O(E)` | node count squared | cutoff radius (260 px) |
| Render pass | `O(n + E)` | primitives | DPR × area (if DPR scaling lands) |
| Hit test | `O(n)` | node count | pointer move frequency |
| `injectNode` | `O(n log n)` | nearest-neighbour sort | 90–130 nodes |
| Ultra field step | `O(n·k + P + E·t)` | neighbours · particles · traffic | grid + tier caps (§ 3.3) |
| Ultra physics | `O(n·k)` | node count × local density | 78 px cells, 260 px cutoff |
| `appendChat` | `O(1)` + reflow | transcript length | DOM growth (unbounded — see § 5.6) |
| `grimoire.filter` | `O(F × L)` | fragments × length | 7 records, no index needed |
| Composition (`polymathLLM`) | `O(1)` | — | Fixed vocabulary, no search |
| Ingestion | `O(bytes)` | file size | `readAsText` on the main thread (§ 5.7) |

---

## 5. Optimisation ladder

Ordered by **impact per unit of effort**. Each rung is independently shippable; the register ID
column links to the tracked item where one exists.

| # | Optimisation | Why it pays | Effort | Impact | Register |
| --- | --- | --- | --- | --- | --- |
| 1 | **Fixed-timestep accumulator** (60 Hz, interpolated) | Correctness *and* 2.4× less simulation work per second on 120–144 Hz displays | S | High | `NOO-020` |
| 2 | **Replace per-node `shadowBlur`** with a pre-rendered radial-gradient sprite, or drop blur on the 75 small procedural nodes | Removes the most expensive per-frame draw call from 90 nodes | S | High | — |
| 3 | **Suspend the loop when hidden** (`document.hidden`, window `blur`) | Ends battery drain in an unviewed tab; the loop currently runs forever | XS | High | — |
| 4 | **Uniform-grid broad phase** | `O(n²)` → `O(n·k)`; unlocks larger graphs | M | High *(at scale)* | `NOO-015` |
| 5 | **DPR-aware canvas** with a cap at 2× | Fixes blurry output on HiDPI — but costs up to 4× the fill rate, hence the cap | S | Medium *(fidelity, at a perf cost)* | `NOO-014` |
| 6 | **Throttle hit-testing** to one scan per animation frame | Decouples pointer-event frequency (up to 1000 Hz on high-polling mice) from a linear scan | XS | Medium | — |
| 7 | **Bound the transcript DOM** (cap entries, prune from the head) | Unbounded append growth is a long-session memory and layout cost | S | Medium | — |
| 8 | **Move physics to a Worker** with transferable typed arrays | Off the main thread; smooth interaction under heavy load | L | High *(only at scale)* | roadmap `10.x` |
| 9 | **Batch edge strokes** into one path per colour | 270 `stroke()` calls → a handful | S | Low–Medium | — |
| 10 | **Off-screen static layer** for the dot hatching | Currently pure CSS on the substrate, already cheap | — | None | — |

**Ladder status after 9.5.0.** Rungs 2, 4 and 5 are implemented **inside the ultra field**: pre-baked
glow sprites replace per-node `shadowBlur` there, the field's broad phase is a uniform grid, and both
canvases are DPR-scaled with a 2× cap. The standard atlas deliberately keeps its original integrator
and glow pass, so `NOO-015` and `NOO-020` remain open **for STANDARD**; rung 1 is shipped for the
field (it integrates with `dt`) but not for the atlas. Rungs 3 (suspend when hidden) and 7 (bound the
transcript) remain open for both renderers.

### Two anti-optimisations, rejected

- **Capping node count.** The graph's visual density *is* the artefact; capping it trades the product
  for a metric.
- **Dropping the CRT overlay or glass blur.** Both are compositing costs with real visual value, and
  both are already GPU-friendly. Measure before removing.

---

## 6. Profiling method

No browser was available in the environment where this document was written, so nothing in § 3 is
presented as measured. The following harness takes a measurement in the reader's own browser —
paste it into the console on the running app:

```js
// NOÖSPHERE // OS — frame-time sampler (paste into devtools)
(() => {
  const samples = [];
  let last = performance.now();
  const probe = (now) => {
    samples.push(now - last);
    last = now;
    if (samples.length < 300) requestAnimationFrame(probe);
    else {
      const sorted = samples.slice(10).sort((a, b) => a - b);
      const p = (q) => sorted[Math.floor(sorted.length * q)].toFixed(2);
      console.table({
        frames:   sorted.length,
        p50_ms:   p(0.50),
        p95_ms:   p(0.95),
        p99_ms:   p(0.99),
        worst_ms: sorted.at(-1).toFixed(2),
        budget:   '16.7 ms @ 60 Hz',
      });
    }
  };
  requestAnimationFrame(probe);
})();
```

Report p95 rather than mean: a stable mean with a fat tail is exactly what a dropped-frame stutter
looks like, and it is the number that decides whether the simulation feels smooth.

**Also worth capturing:** Chrome DevTools → Performance → *Frames* track (look for frames exceeding
16.7 ms and correlate with GC), and the Memory panel after several hundred injections to confirm the
transcript growth noted in § 5.7.

---

## 7. Load cost and its measurement gap

The repository's own payload is measured and small. The **total** delivery cost is dominated by three
third-party origins, and this document does not state their sizes because they were not measured —
`cdn.tailwindcss.com`, `fonts.googleapis.com` and `unpkg.com` were unreachable from the environment
in which this documentation was written.

| Dependency | Nature | Known characteristics | Measured here |
| --- | --- | --- | --- |
| `cdn.tailwindcss.com` | JIT compiler **plus** stylesheet | Compiles utilities **in the browser at runtime**; the dominant script cost and a main-thread task at startup | ❌ |
| `fonts.googleapis.com` | 3 families, 6+ `woff2` files | JetBrains Mono is requested as a variable font across two axes (upright + italic), the heaviest of the three | ❌ |
| `unpkg.com/lucide@latest` | Icon library, **unpinned** | `@latest` resolves per request — an unversioned URL means the icon set can change under the artefact | ❌ (`NOO-008`) |

**Reproduce the measurement** (any network with access):

```bash
curl -sSL -o /dev/null -w 'tailwind   %{size_download} B  %{time_total}s\n' \
  -A 'Mozilla/5.0' https://cdn.tailwindcss.com
curl -sSL -w '\nfonts      %{size_download} B\n' -A 'Mozilla/5.0' \
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Syne:wght@400;600;700;800&display=swap'
curl -sSL -o /dev/null -w 'lucide     %{size_download} B\n' \
  -A 'Mozilla/5.0' https://unpkg.com/lucide@latest
```

Then load the app with the Network panel open and **record the transfer size and the main-thread
compilation task** — the Tailwind JIT pass shows up as a long task during load, which no amount of
optimisation to our 178 KB can offset.

### The two conclusions that follow

1. **Our payload is not the load cost.** Optimising a 88 KB file while a browser-side CSS compiler
   runs at startup is optimising the wrong thing — which is precisely the argument for the self-hosting
   path in [`ROADMAP.md`](ROADMAP.md) (`9.6.0`, `NOO-008`) and the reason ADR-002 is recorded as a
   trade-off rather than a win.
2. **Unreachable CDNs degrade the artefact.** With no network, `index.html` renders as unstyled
   semantic HTML: every utility class is a no-op. The application still *functions* (all behaviour is
   local), but it stops looking like itself. Honest statement of a real fragility — the fix is a
   vendored, pinned build, not a defensive loader.

---

## 8. Guardrails

| Guardrail | Mechanism | Where |
| --- | --- | --- |
| Payload cannot creep silently | Warn at 188,000 B, fail at 224,000 B (re-baselined in 9.5.0) | `scripts/audit.mjs` |
| Findings cannot creep silently | Ratcheted baseline, 21 register IDs | `scripts/audit-baseline.json` |
| Complexity cannot creep silently | `NOO-015` reports pair evaluations per frame derived from the spawn count | `scripts/audit.mjs` |
| Frame-rate behaviour is reviewed | `NOO-020` asserts the integrator steps by `deltaTime` | `scripts/audit.mjs` |
| Frame budget is re-measured per release | Manual harness in § 6, recorded in the release checklist | `DEPLOYMENT.md` |
| Effect density cannot creep silently | 900-slot pool + 4 LOD tiers with hysteresis; SURVIVAL allocates nothing | `ULTRA_MAX_PARTS`, `ULTRA_TIERS` |

**A note on the ratchet:** the audit deliberately fails on *new* debt rather than on *existing* debt,
because a hard gate against known defects would block every unrelated improvement. The cost of that
choice is honest and stated: the register can contain items for longer than a strict gate would
allow, and the mitigation is that each item carries a severity and a roadmap horizon.

---

<div align="center">
<sub>Next: <a href="TESTING.md">Testing strategy →</a></sub>
</div>
