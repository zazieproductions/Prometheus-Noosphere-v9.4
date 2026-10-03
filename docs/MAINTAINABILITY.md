# Maintainability

> Dependency policy, measured code-health metrics, the coupling and change-cost analysis, the
> extraction plan, and the risk register — written for whoever inherits this repository.

**Intended reader:** a maintainer who did not write this code and needs to change it confidently.
**Companion documents:** [`CONTRIBUTING.md`](../CONTRIBUTING.md) for how to submit a change,
[`TESTING.md`](TESTING.md) for how to verify one, [`ROADMAP.md`](ROADMAP.md) for what to do next.

---

## 1. Stewardship model

| Aspect | Position |
| --- | --- |
| Ownership | Single author, open contributions. **Bus factor 1** — named honestly in the risk register (§ 8). |
| Compatibility promise | The runtime has no versioned API; [`API.md`](API.md) *is* the contract, and any change to it is breaking |
| Release cadence | Event-driven: correctness patches when the register justifies them, one feature line per horizon |
| Supported surface | Current evergreen Chromium, Firefox and Safari. No IE, no legacy Edge, no polyfills |
| Lifecycle expectation | The artefact runs offline, forever, with no backend. Nothing in it can rot by cancellation of a service. |
| Local workstation mode | Optional, started with `npm start`; the only configuration in which a PTY, the inference proxy and the agent loop exist. Its trust boundary is loopback-only ([`SECURITY.md` § 4](../SECURITY.md#4--the-local-shell-is-not-sandboxed-docsshellmd)) |
| Deprecation | Any removal is announced one minor version ahead in [`CHANGELOG.md`](../CHANGELOG.md) |

---

## 2. Dependency policy

The project's central claim is that a dense interface does not require a supply chain. The policy is
therefore unusually strict, and it is enforced in three tiers.

### 2.1 Runtime dependencies

| Rule | Published artefact | Local workstation mode |
| --- | --- | --- |
| Installed runtime dependencies | **0** — a design constraint, not a coincidence | **3** (`@xterm/xterm`, `@xterm/addon-fit`, `ws`) + 1 optional (`node-pty`) — the sanctioned exception, § 2.4 |
| Vendored assets | 0 B — no images, fonts or audio committed for the app | Served from `node_modules` at run time (`/vendor/*`); never copied into the artefact |
| Third-party origins | **3** (Tailwind Play CDN, unpkg/Lucide, Google Fonts) — the known weakness, `NOO-008` | Same three, plus no others: xterm is local |
| Network calls | **0** — no `fetch`, `XMLHttpRequest` or `WebSocket` | One same-origin `WebSocket` to the local bridge, opened by the shell window, plus optional local Ollama HTTP calls |

**Adding a runtime dependency requires an ADR.** Not a discussion, not a preference — a record with
context, consequences and rejected alternatives, appended to [`DECISIONS.md`](DECISIONS.md). The bar
is deliberately high: the project's thesis is the product.

### 2.2 Tooling dependencies

| Rule | Rationale |
| --- | --- |
| `scripts/` uses the Node standard library **only** | `npm test` must run with no install, so a reviewer can verify a checkout in one command |
| No test framework | [`ADR-007`](DECISIONS.md#adr-007--zero-dependency-tooling-with-a-ratcheted-audit) |
| Dev-only dependencies are permitted *outside the runtime path* | `jsdom` (pinned 30.1.1) for the browser suite, and the planned Playwright harness in [`TESTING.md` § 7](TESTING.md#7-the-road-to-behavioural-tests) |
| Any dev dependency must be pinned exactly | Reproducible CI is a prerequisite for a meaningful ratchet |

### 2.3 Prohibited

Frameworks and view libraries · CSS preprocessors · bundlers in the **default** path · runtime
polyfills · analytics, error-reporting or A/B SDKs · anything that introduces a **hosted** server.
The last item is absolute: a backend with state would invalidate
[ADR-006](DECISIONS.md#adr-006--no-persistence-no-backend) and the deployment story in one move.

The shell is the one place this needs a footnote, so it gets one rather than an asterisk: local
workstation mode runs `scripts/serve.mjs`, which is a loopback-only bridge, holds no state across
restarts, is never required by the published artefact, and can be switched off entirely
(`NOOSPHERE_SHELL=off`, `--no-shell`, or simply not running it). It amends ADR-006 in scope, not in
spirit — see [ADR-011](DECISIONS.md#adr-011--the-shell-module-lives-outside-indexhtml).

### 2.4 The sanctioned exception: the shell's dependencies

The rule above has exactly one exception, bounded by two ADRs.

| Rule | Status |
| --- | --- |
| The exception must not touch the published artefact | `index.html` imports nothing; the shell's assets are fetched only when a local bridge exists ([ADR-011](DECISIONS.md#adr-011--the-shell-module-lives-outside-indexhtml)) |
| Every shell dependency is pinned exactly | `@xterm/xterm` 6.0.0 · `@xterm/addon-fit` 0.11.0 · `ws` 8.22.0 · `node-pty` 1.1.0 |
| The native dependency is optional, and its absence is a feature state | `optionalDependencies` + a dynamic `import()` inside `try`/`catch`; `npm install` cannot fail the project ([ADR-012](DECISIONS.md#adr-012--optional-native-dependency-with-a-degraded-mode)) |
| No shell dependency enters the browser build | There is no build: xterm is served as a UMD script from the local `/vendor/*` route |
| `npm test` still passes without an install | The audit is dependency-free; both behavioural suites skip cleanly on a bare checkout |

A new dependency of any kind still requires an ADR. The shell's four are covered by ADR-011 and
ADR-012, and no further ones are anticipated.

---

## 3. Code-health metrics

Measured at `HEAD`; all reproducible with `npm test` and the commands in the audit.

| Metric | Value | Reading |
| --- | --- | --- |
| Application payload | 95,308 B / 1,571 lines | Within budget (692 B of headroom to the warn threshold) — the shell's runtime is external by design (ADR-011) |
| Runtime script | 45,270 B / 869 lines | Ten engines plus the hooks that mount the shell window; the console itself is external (`shell/` — ADR-011) |
| Markup + chrome | 44,686 B / 577 lines | Markup and logic are within 600 B of each other — see § 5.3 |
| Design tokens | 2,080 B | Colours, fonts, shadows, animations |
| CSS primitives | 2,056 B | Only what utilities cannot express |
| Engines / modules | 10 internal + 1 external (`window.synapseShell`) | Each with a single responsibility and a documented surface; the external one is loadable only in local workstation mode |
| Windowed subsystems | 8 | Each mapping to one engine or one engine pair; the shell window maps to `window.synapseShell` |
| Duplicated window chrome | 8 `.win-header` blocks, 15 control buttons | The single largest duplication in the repository |
| Magic numbers with semantic meaning | 12 named in § 4 | Candidates for a constants block |
| Automated checks | 21 register IDs + 4 fatal rules, then 34 behavioural tests | The audit is ~0.3 s and dependency-free; the behavioural suites skip cleanly without the shell's optional dependencies |
| Tracked findings | 36 across 21 IDs | Baselined, severity-classified, roadmap-mapped |

**Comment density and naming.** Engine banners (`// 3. FORCE-DIRECTED NEURAL GRAPH ATLAS ENGINE`)
partition the script into labelled regions, and every engine exposes verb-named methods
(`injectNode`, `filterDomain`, `appendChat`). The structure is legible without a module system — which
is what makes § 7 a mechanical exercise rather than an archaeology project.

---

## 4. Tunable surface

Every constant that meaningfully changes behaviour, in one table. If you are tuning the artefact,
this is the list — there is no config file to search.

| Constant | Value | Location | Effect |
| --- | --- | --- | --- |
| `kRepel` | `220` | `updatePhysics` | Repulsion strength between nodes |
| Repulsion radius | `260` | `updatePhysics` | Beyond this, nodes ignore each other (the perf/behaviour trade) |
| `kSpring` | `0.003` | `updatePhysics` | Edge spring stiffness |
| Spring rest length | `75` | `updatePhysics` | Target edge length in world units |
| `centerGravity` | `0.0008` | `updatePhysics` | Pull toward the origin; counteracts drift |
| Damping | `0.88` | `updatePhysics` | Per-frame velocity retention |
| Spawn count | `90` | `initGraphEngine` | Drives everything quadratic (`NOO-015`) |
| Zoom clamp | `[0.3, 3.0]` | `wheel` handler | Camera limits |
| Label LOD threshold | `zoom > 0.8` | `renderGraph` | When labels appear while zoomed out |
| Composition delay | `400 ms` | `generatePolymathResponse` | Simulated deliberation |
| Ingestion settle | `600 ms` | `processFiles` | Status transition to "synchronized" |
| Telemetry tick | `1000 ms`, drift chance `0.4` | telemetry interval | Clock cadence and gauge jitter |

**Maintainability note.** These are literals distributed across six regions. The proposed
`10.x` refactor introduces a single frozen `TUNING` object so that behaviour is adjustable without
reading the physics. That is a small, safe change with a real payoff for future tuning.

---

## 5. Coupling and change cost

### 5.1 Fan-in by engine

Call sites measured across the document:

| Engine | Call sites | Reading |
| --- | --- | --- |
| `polymathLLM` | 16 | **The most connected engine.** It is the display surface for the graph, ingestion, grimoire and the modal — a deliberate hub, but the clearest candidate for an interface boundary. |
| `graphEngine` | 10 | Second hub; receives from ingestion, combinator and the modal. |
| `playBeep` | 21 | The universal acoustic primitive — one function, every engine. |
| `lucide.createIcons()` | 4 | Re-hydration after dynamic DOM insertion (a symptom of manual DOM management). |
| `soundLab` / `paletteGen` | 3 each | Leaves. |
| `grimoire` | 2 | Near-leaf. |
| `ideaCombinator` | 1 | Leaf. |

The graph is **acyclic and shallow**: hubs are display surfaces, not coordinators. That is why
[ADR-010](DECISIONS.md#adr-010--sequential-boot-with-direct-coupling) holds at this size — and the
signal to revisit it would be a second hub that *orchestrates* rather than *renders*.

### 5.2 Change cost

What a change actually costs, in files and sites. This table is the honest answer to "how hard is it
to modify?" — and it is the argument for deriving values from data rather than literals.

| Change | Sites to touch | Cost | Why it costs that |
| --- | --- | --- | --- |
| Add a knowledge fragment | 1 (`GRIMOIRE_DATA`) | XS | Pure data |
| Add a palette | 1 (`PALETTES`) | XS | Pure data |
| Tune the physics | 1 region (`updatePhysics`) | XS | Self-contained, but see § 4 |
| Add a domain | **3** (`DOMAINS`, filter bar, modal selector) | S | Three parallel enumerations of the same concept — the source of `NOO-011` |
| Add a directive | 3 (`VOCAB`, `runDirective`, toolbar chip) | S | Composition + presentation |
| Add a window | **4** (window skeleton, dock button, `resetWindowPositions`, optional engine) | M | Four enumerations; omitting one produces exactly `NOO-012`/`NOO-019`. The SYNAPSE SHELL window (`9.5.0`) walked that checklist and produced neither — the recipe works when followed |
| Change the node count | **3** (spawn loop, header badge, boot banner) | S | Numbers that should be derived, currently literal — `NOO-010` |
| Replace the composer | 1 engine | M | Clean seam: `VOCAB` + one object literal |
| Change the design tokens | 1 block | XS | Genuinely centralised — the token layer earns its keep |

**The pattern is precise:** *data* is cheap to change; *enumerations of a concept* are expensive. The
three most instructive defects in the register (`NOO-010` counters, `NOO-011` domains, `NOO-012`/
`NOO-019` windows) are all instances of the same root cause — a fact stated in more than one place.
The systematic fix, already reflected in the roadmap, is to derive each from a single source.

### 5.3 The markup/logic ratio

Markup (44,686 B) and the runtime script (45,270 B) are now within 600 B of each other: the shell
window added an eighth header (+1.5 KB of chrome) and the hooks that mount it (+4.3 KB of logic).
The underlying reason is still duplication — eight near-identical window headers, fifteen
near-identical control buttons, repeated class strings. This is the largest structural debt in the
repository, and it is **not** a defect in the register, because it costs nothing at runtime and the
markup is honest and readable. It is a maintainability observation with a corresponding roadmap item
(template the window chrome in `10.x`).

---

## 6. Refactoring priorities

Ordered by risk-adjusted value. Each item names the register entries it closes.

| Priority | Work | Closes | Risk | Value |
| --- | --- | --- | --- | --- |
| 1 | Derive counters, domain lists and window geometry from single sources | `NOO-010`, `NOO-011`, `NOO-012`, `NOO-019` | Low | Removes a whole class of drift; fixes reachability |
| 2 | Escape all human-origin interpolation (`textContent` / `escapeHtml`) | `NOO-007` | Low | Closes the only trust-boundary finding |
| 3 | Extract a `TUNING` constants block | — | Very low | Makes behaviour adjustable without reading physics |
| 4 | Seed the RNG; add `?seed=` | `NOO-021` | Low | Unlocks deterministic demos *and* visual regression |
| 5 | Fixed-timestep accumulation | `NOO-020` | Low | Correct dynamics; less CPU on high-refresh displays |
| 6 | Vendor and pin the three CDN dependencies | `NOO-008` | Medium | Enables the hardened CSP; removes vendor drift |
| 7 | Extract engines into ES modules behind an optional bundler | — | Medium | § 7 |
| 8 | Template the window chrome | — | Medium | Removes the largest duplication |

**Do not** batch these. Each is independently reviewable, independently revertable, and each leaves
the audit green — that property is what makes the single-file constraint survivable over time.

---

## 7. Extraction plan

The code is already **extraction-ready**: ten engines, labelled regions, explicit dependencies,
no cross-cutting abstraction. Extraction is therefore a mechanical transformation rather than a
re-architecture — which is precisely why it does not need to happen yet.

### 7.1 Target layout

```
src/
├── core/      sound.js  · window-manager.js  · telemetry.js
├── engines/   graph.js  · polymath.js  · ingestion.js
│              palette.js  · grimoire.js  · combinator.js  · modal.js
├── data/      domains.js  · seed-themes.js  · vocab.js  · palettes.js  · grimoire-data.js
├── ui/        window-chrome.js     (templated markup)
├── shell/     synapse-shell.js · synapse-shell.css   (already extracted — ADR-011)
├── app.js     boot sequence (the current DOMContentLoaded body)
└── index.html thin shell: tokens + <style> + containers + <script type="module" src="src/app.js">
```

### 7.2 Dependency order to preserve

```
sound → window-manager → graph → polymath → ingestion → palette → grimoire → combinator → modal → telemetry → app
```

The order is load-bearing ([ADR-010](DECISIONS.md#adr-010--sequential-boot-with-direct-coupling)).
In a module world it becomes an explicit import graph, which is a genuine improvement: the current
ordering contract is documented but unenforced. The shell follows this rule from the outside: it
initialises after the boot sequence, talks over HTTP/WebSocket, and never touches another engine's
internals ([`ARCHITECTURE.md` § 19.4](ARCHITECTURE.md#194-coupling-rule)).

### 7.3 Constraints on the extraction

| Constraint | Requirement |
| --- | --- |
| The single file stays shippable | Extraction produces a second, optional build — never a replacement for `index.html` |
| No dependency may enter the runtime path | Modules import modules; nothing imports npm |
| The audit must keep working | `audit.mjs` gains a module-mode that walks `src/` with the same rules |
| Behaviour must be provably unchanged | Perform it after § 7.1 of [`TESTING.md`](TESTING.md#71-determinism-first) lands, so before/after states are comparable |
| Do it incrementally | One module per pull request, `index.html` untouched until the shell swap |

### 7.4 Why wait

The single-file artefact *is* the project's thesis. Extraction becomes worthwhile when the file
crosses the payload budget or when a second consumer appears. The shell is the first case taken
([ADR-011](DECISIONS.md#adr-011--the-shell-module-lives-outside-indexhtml)): its runtime is dead
weight for every static-host visitor, so it lives outside the document while the document keeps its
shape. (an embeddable component, a variant
theme). Until then it would trade a real asset — one reviewable artefact — for modularity nobody is
currently blocked on. This is a stated position, not an oversight.

---

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **Bus factor 1** | Certain | High | Conventional Commits, ADRs, this document, dependency-free tooling, and a manual matrix that assumes no author knowledge |
| Unpinned CDNs change under a fixed commit | Medium | Medium | Pin URLs now; self-host in `9.6.0` (`NOO-008`); the CSP section in [`DEPLOYMENT.md`](DEPLOYMENT.md#5-content-security-policy) documents the blast radius |
| Single file crosses the budget | **Medium** | Medium | Re-baselined at 96,000 B warn / 128,000 B fail with 692 B of headroom after the shell release; further shell work belongs in `shell/`, not the document ([ADR-011](DECISIONS.md#adr-011--the-shell-module-lives-outside-indexhtml)) |
| Shell dependencies rot or fail to compile | Medium | Low | Pinned exactly; `node-pty` is optional and its absence renders as a state, not an error ([ADR-012](DECISIONS.md#adr-012--optional-native-dependency-with-a-degraded-mode)); the published artefact imports none of it |
| A remote client or cross-site page reaches the PTY | Low | Critical | Per-request gate on peer, `Host`, `Origin`, forwarding headers and `Sec-Fetch-Site`; no CORS; refusals are tested for both HTTP and the WebSocket upgrade ([`SECURITY.md` § 4](../SECURITY.md#4--the-local-shell-is-not-sandboxed-docsshellmd)) |
| Satire misread as endorsement | Medium | Medium | Explicit framing in the README, the architecture document and [`DESIGN.md` § 9](DESIGN.md#9-satire-and-disclosure) |
| Accessibility work deferred indefinitely | Medium | High | It is P0/P1 in [`ACCESSIBILITY.md`](ACCESSIBILITY.md#8-remediation-plan) with register IDs and target releases, not a wish list |
| Browser API churn (`backdrop-filter`, Web Audio autoplay policy) | Low | Low | Both are feature-detected or gracefully degraded; no polyfills by policy |
| Reviewer cannot run it | Very low | High | Zero-install path exists: open the file, or `npm start` with no `npm install` |
| Documentation drifts from code | Medium | Medium | Every count in the README comes from the audit; the register is the shared spine across five documents |

---

## 9. Documentation maintenance

Documentation is treated as maintained code: it has an owner, a review trigger and a source of truth.

| Document | Update it when | Source of truth |
| --- | --- | --- |
| `README.md` | Features, metrics, roadmap horizons change | Counts come from `npm test` — never hand-typed |
| `ARCHITECTURE.md` | Runtime topology, data models, physics or the register change | The source; line anchors verified before each release |
| `API.md` | **Any** signature, return shape or side effect changes | The source; treated as a breaking change |
| `SHELL.md` | Shell behaviour, AI modes, the trust boundary or troubleshooting change | The source; `server/routes.mjs` + `shell/synapse-shell.js` are the implementation |
| `DESIGN.md` | A token, typeface, motion rule or chrome convention changes | `tailwind.config` + `<style>` |
| `DECISIONS.md` | A foundational choice is made or reversed | Append-only; supersede rather than edit |
| `ACCESSIBILITY.md` | A remediation item lands | Re-measure contrast; record the new state |
| `PERFORMANCE.md` | A budget, cost model or optimisation lands | `npm test` + the frame sampler |
| `TESTING.md` | A check is added or the manual matrix changes | The audit script |
| `ROADMAP.md` | A horizon item completes or is added | The register |
| `CHANGELOG.md` | Every release | Keep a Changelog format |
| `CONTRIBUTING.md` | Conventions change | — |

**The spine.** The 21 register IDs are the join key between the audit, the architecture document,
the accessibility audit, the roadmap and the changelog. Change an ID's title in one place and the
others must follow; the audit's own copy of the register is documented as needing the same sync.

---

## 10. Handover checklist

For a maintainer taking over:

1. `git clone` → `npm test` → `npm start`. If that sequence does not work, stop and fix it:
   reproducibility is the project's first promise. The behavioural suites skip cleanly on a bare
   checkout — that is a pass; run `npm install` to exercise the shell end to end.
2. Read [`README.md` § What this is not](../README.md#what-this-is-not) before reading any code. The
   framing is part of the specification.
3. Read the runtime table in [`ARCHITECTURE.md` § 6](ARCHITECTURE.md#6-engine-inventory) — eleven rows
   is the whole map.
4. Read [`ARCHITECTURE.md` § 17](ARCHITECTURE.md#17-defect-register) — the 21 items that are already
   known, so you do not rediscover them as surprises.
5. Change one tunable in § 4 and watch what happens. Nothing teaches this codebase faster.
6. Work the P0 list in [`ACCESSIBILITY.md`](ACCESSIBILITY.md#8-remediation-plan) next: it is the
   highest-value outstanding work and every item is small.
7. If you are touching the shell, read [`SHELL.md`](SHELL.md) first — it is short, and it states the
   trust boundary and the two facts easiest to get wrong (nothing is sandboxed; `AUTONOMOUS` is the
   authorisation).

---

<div align="center">
<sub>Next: <a href="ROADMAP.md">Roadmap →</a></sub>
</div>
