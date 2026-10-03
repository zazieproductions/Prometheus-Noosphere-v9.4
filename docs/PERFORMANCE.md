# Performance

> A source-derived cost model for the current Zaziopath graph. No browser frame-rate measurement is claimed.

## 1. Current baseline

| Metric | Value | Source |
| --- | --- | --- |
| `index.html` payload | 140,094 B · 2,179 lines | `scripts/audit.mjs` |
| `data/zaziopath-graph.js` payload | 250,159 B | committed source-derived snapshot |
| Committed graph | 86 nodes · 117 edges | `data/zaziopath-graph.js` |
| Grimoire | 15 source fragments | committed snapshot |
| Installed npm dependencies | 0 | `package.json` |
| Build step | none | browser runtime uses the committed data JS |
| Frame-rate measurement | not measured here | use the browser sampler below |

The audit allows 160,000 B before warning and 192,000 B as a hard failure for the HTML runtime. The generated corpus remains a separate data file. Existing CDN delivery is outside the repository payload and needs network access for full visual styling/icons/fonts.

## 2. Frame cost model

Target frame intervals are 16.7 ms at 60 Hz and 6.9 ms at 144 Hz. These are budgets, not measured performance claims.

| Phase | Operation | Complexity | At committed boot size |
| --- | --- | --- | --- |
| `updatePhysics` | pairwise repulsion | `O(n²)` plus cutoff | 3,655 node pairs (`86 × 85 / 2`) |
| `updatePhysics` | edge springs | `O(E)` | 117 edges |
| `renderGraph` | edges + nodes + optional labels | `O(n + E)` | 86 nodes and 117 edges |
| hit testing | node scan | `O(n)` per pointer move | 86 nodes |
| offline retrieval | rank graph/fragments | bounded tokenization over 86 nodes + 15 fragments | local CPU, no API |
| ingestion | text read/extraction | `O(bytes)` | ≤2 MB file, ≤500,000 characters processed |

Session ingestion may add a few nodes and edges per file; it is capped at three concept candidates per file, and normalized duplicates are merged/skipped. Physics remains a no-library pairwise simulation; a spatial index or Worker is not justified by a measured need at the current size.

## 3. Dynamics and rendering caveats

The existing integrator advances once per animation frame and is therefore frame-rate-dependent (`NOO-020`). The committed starting positions are deterministic, but the force simulation evolves continuously. Canvas is not device-pixel-ratio scaled (`NOO-014`), and `shadowBlur` is used for glow; both could affect fidelity/performance on particular displays. This repository has not measured them in a browser.

The recommended order if profiling shows a real issue is: use a fixed timestep, bound the simulation when the tab is hidden, profile shadow rendering, then consider a uniform-grid broad phase. Do not change the existing Canvas engine or introduce a graph library without a separate product decision.

## 4. Measure in a browser

Run `npm start`, open the app, then paste into DevTools. Discard warm-up frames; report p95 and worst frame time rather than only the mean.

```js
(() => {
  const samples = [];
  let last = performance.now();
  const probe = now => {
    samples.push(now - last);
    last = now;
    if (samples.length < 310) requestAnimationFrame(probe);
    else {
      const sorted = samples.slice(10).sort((a, b) => a - b);
      const pct = q => sorted[Math.floor((sorted.length - 1) * q)].toFixed(2);
      console.table({ frames: sorted.length, p50_ms: pct(.50), p95_ms: pct(.95), p99_ms: pct(.99), worst_ms: sorted.at(-1).toFixed(2) });
    }
  };
  requestAnimationFrame(probe);
})();
```

To compare boot runs, reload the same commit and use the same viewport, browser, zoom, and stratum filter. Keep session ingestion out of the baseline run; report it separately.

## 5. Guardrails

- `npm test` validates committed graph references, runs a DOM/canvas-stub runtime smoke, and performs the static HTML audit.
- The audit derives `NOO-015`'s pair-count evidence from the committed graph rather than a hard-coded spawn loop.
- `scripts/test-runtime.mjs` smoke-tests graph boot, offline retrieval, Ollama context/failure fallback, Grimoire selection, local ingestion, and duplicate prevention. It is not a frame benchmark.
- There are no production telemetry beacons or performance scores in the UI.
