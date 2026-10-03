<div align="center">

<img src="docs/assets/noosphere-banner.png" alt="NOÖSPHERE // OS — abstract neural cartography banner" width="100%" />

# NOÖSPHERE // OS

**A single-file browser operating system for polymathic neural cartography, semantic engineering and procedural idea synthesis.**

[![CI](https://img.shields.io/github/actions/workflow/status/zazieproductions/Prometheus-Noosphere-v9.4/ci.yml?branch=main&label=audit&style=flat-square)](https://github.com/zazieproductions/Prometheus-Noosphere-v9.4/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-9.5.0-00f7ff?style=flat-square)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-a855f7?style=flat-square)](LICENSE)
[![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-00ff9d?style=flat-square)](#technology-stack)
[![Build](https://img.shields.io/badge/build%20step-none-ffaa00?style=flat-square)](#quick-start)
[![Payload](https://img.shields.io/badge/index.html-93.1%20KiB%20%C2%B7%201%2C571%20lines-ff0055?style=flat-square)](docs/PERFORMANCE.md)
[![PRs](https://img.shields.io/badge/PRs-welcome-00f7ff?style=flat-square)](CONTRIBUTING.md)
[![Conventional Commits](https://img.shields.io/badge/commits-conventional-ffaa00?style=flat-square)](CONTRIBUTING.md#commit-convention)

**[Live demo](https://zazieproductions.github.io/Prometheus-Noosphere-v9.4/)** · **[Architecture](docs/ARCHITECTURE.md)** · **[Engine API](docs/API.md)** · **[Design rationale](docs/DESIGN.md)** · **[Roadmap](docs/ROADMAP.md)** · **[Changelog](CHANGELOG.md)**

</div>

---

## Table of contents

- [What this is](#what-this-is)
- [What this is not](#what-this-is-not)
- [Screenshot](#screenshot)
- [Feature map](#feature-map)
- [SYNAPSE SHELL — the local host terminal](#synapse-shell--the-local-host-terminal)
- [Quick start](#quick-start)
- [Architecture at a glance](#architecture-at-a-glance)
- [Verified metrics](#verified-metrics)
- [Repository map](#repository-map)
- [Technology stack](#technology-stack)
- [Engineering status](#engineering-status)
- [Documentation index](#documentation-index)
- [Roadmap](#roadmap)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## What this is

NOÖSPHERE // OS is a **browser-resident desktop environment** built inside one HTML document. It renders eight draggable, minimisable, focus-aware windows over a simulated systems desktop, and wires them to ten cooperating client-side engines — a force-directed graph laboratory, a template-composition language engine, a corpus ingestion pipeline, an analytics viewport, an aesthetic synthesiser with Web Audio output, a searchable knowledge base, and a dialectical idea combinator — plus an eleventh engine, `window.synapseShell`, loaded only in local workstation mode, which puts a real host terminal in one of those windows.

It is a **front-end craft project** — the reference implementation for a set of opinions about what a zero-build, zero-dependency, zero-backend interface can look like when the constraints are treated as the design brief rather than as obstacles.

Everything in this repository is **local, self-contained and non-networked**: no API keys, no telemetry, no persistence, no cookies, no build step, no package manager required. The generation engine is deterministic; the graph simulation is procedural rather than seeded (`NOO-021`).

**One deliberate exception, added in `9.5.0`: the local workstation.** `npm start` additionally boots
a small Node process that serves the document, proxies local Ollama inference, and — for same-machine
clients only — bridges a **real host shell** into the desktop as a draggable terminal
([`docs/SHELL.md`](docs/SHELL.md)). The published artefact is unchanged and remains backend-free: on
GitHub Pages or any static host the shell window reports `SHELL UNAVAILABLE` and nothing else
degrades. Both shapes are documented honestly; neither is described as sandboxed.

**Design constraints that shaped every decision:**

| Constraint | Consequence |
| --- | --- |
| One document, no build step | All styling, structure and behaviour live in `index.html`; nothing must be compiled to run |
| No runtime dependencies to install | Libraries arrive by CDN and the repository ships zero `node_modules`; pinning them is tracked as `NOO-008` |
| No backend | Every engine executes on the client; the audit toolchain is the only Node.js surface |
| Local and offline | No network, no keys, no server; simulation and generation are procedural functions of local state (seeded determinism is `NOO-021`) |
| Aesthetic as architecture | The CRT/terminal conceit is enforced through a token system, not ad-hoc styling |

---

## What this is not

Honest framing matters more than a pitch. **NOÖSPHERE // OS is fiction — a satirical artefact.** The corpus satirises the vocabulary of growth hacking, semiotic marketing and "memetic warfare" by pushing it to absurd, self-incriminating extremes. It is a piece of critical design, in the tradition of the language it mocks.

- **The "Polymath LLM" is not a language model.** It is a deterministic template-composition engine over a fixed vocabulary table ([`docs/API.md`](docs/API.md#engine-polymathllm--local-inference-with-template-fallback)). It performs no inference, calls no API, and produces recognisably finite variation. That is the joke *and* the engineering: a "recursive cognition core" that is honestly one vocabulary table and one template literal.
- **Nothing here is marketing advice.** Techniques named in the corpus (infrasound coercion, subliminal indoctrination, paraconsistent PR warfare, "cognitive friction arbitrage") are parodied as sinister, not documented as playbooks. They are not effective, tested, or endorsed.
- **No analytics, no tracking, no uploads.** Dropped files are read with `FileReader` and never leave the tab. The static artefact makes no `fetch`, `XMLHttpRequest` or `WebSocket` call; in local workstation mode the only socket is same-origin, opened by the shell window against the local bridge, and refused outright unless the request is provably from the same machine.

---

## Screenshot

> A capture is not committed yet: the default layout is corrected in `9.5.1` (`NOO-019`) and the
> screenshot will be regenerated from a **seeded** run when determinism lands in `9.6.0`
> ([`TESTING.md` § 7](docs/TESTING.md#7-the-road-to-behavioural-tests)). Until then, run it locally in
> five seconds and look at the real thing — it is one file.

```bash
git clone https://github.com/zazieproductions/Prometheus-Noosphere-v9.4.git
cd Prometheus-Noosphere-v9.4 && npm start   # → http://localhost:4173
```

---

## Feature map

Eight windowed subsystems, each owned by exactly one engine.

| Window | Subsystem | Engine | What it demonstrates |
| --- | --- | --- | --- |
| `win-graph` | Neural Vault // Hyper-Graph Atlas | `graphEngine` | Canvas 2D force simulation: semi-implicit Euler integration with pairwise repulsion, Hooke springs, centre gravity, pan/zoom camera, hover inspection HUD, domain filtering |
| `win-terminal` | Synapse-X // Polymath Terminal | `polymathLLM` | A "generative" read-eval-print loop implemented as compositional templating over a vocabulary table; role-typed transcript rendering |
| `win-uploader` | Ingestion Vector // File→Neural | ingestion pipeline | Drag-and-drop and file-picker ingestion, `FileReader` tokenisation, keyword extraction, dynamic graph augmentation |
| `win-analytics` | Memetic Contagion // Telemetry | telemetry simulator | Radar/gauge visualisation of a synthetic corpus, live clock, drift simulation on a 1 Hz interval |
| `win-aesthetic` | Aesthetic Hexonomy & Sound Lab | `paletteGen` / `soundLab` | Curated palette rotation with clipboard export of CSS custom properties; Web Audio oscillator synthesis at 432/528/40 Hz |
| `win-notes` | Grimoire // Aphoristic Fragments | `grimoire` | Client-side substring search across titles, bodies and tags; fragment dispatch into the terminal |
| `win-synthesizer` | Hyper-Idea Combinator | `ideaCombinator` | Dialectical cross-product of two domain vectors into a synthesised axiom, injected as a graph node |
| `win-shell` | SYNAPSE SHELL // Host Compute Interface | `window.synapseShell` (client) + `server/shell.mjs` (bridge) | A **real PTY**: xterm.js ⇄ WebSocket ⇄ node-pty ⇄ your `$SHELL`, with AI SHELL control modes (OFF · ASSIST · AUTONOMOUS) over a bounded local-model agent loop. Local clients only. |

**Global systems:** window manager (drag, z-order, minimise, maximise, grid realignment), CRT/glass chrome, acoustic event vocabulary, 1 Hz system clock, quick-injection modal.

---

## SYNAPSE SHELL — the local host terminal

The headline addition of `9.5.0`. Under `npm start` the desktop gains a window that is not a
simulation of a terminal but a terminal:

```
browser (xterm.js)  ⇄  WebSocket  ⇄  node-pty (forkpty)  ⇄  $SHELL (zsh)  ⇄  macOS
```

* **Your shell, your environment.** `$SHELL` (fallback `/bin/zsh`) started as a login shell with the
  environment NOÖSPHERE inherited — your `PATH`, aliases, prompts and rc files. `git`, `brew`,
  `ollama`, `ffmpeg`, `python3`, `npm`, `ssh`, `docker`, `sudo`, pipes, redirection, subshells,
  globbing and full-screen TUIs all work because nothing is intercepted.
* **No sandbox, no allowlist, no virtual filesystem.** It runs as your account with your account's
  permissions. That is the design, and it is stated that way in [`docs/SHELL.md`](docs/SHELL.md).
* **Multiple sessions.** `SHELL 01`, `SHELL 02`, … each with its own PTY, cwd, process state, tab and
  close/restart controls. Live `CWD`, `PID`, `PTY` and mode readouts in the window chrome.
* **AI SHELL control — the mode is the authorisation.** `OFF` exposes no tool at all; `ASSIST` lets
  the local model type a command into the input buffer *without* pressing Enter, for you to execute;
  `AUTONOMOUS` lets it run, observe and iterate inside editable bounds (MAX STEPS, MAX RUNTIME,
  STOP ON ERROR). The current state is unmistakable in the UI, and STOP AGENT / INTERRUPT /
  KILL PROCESS / RESTART never require the model's cooperation.
* **Local only, enforced.** Static files stay on `0.0.0.0` so previews can load the UI; every shell
  route and the WebSocket upgrade require loopback peer + loopback `Host` + matching `Origin` + no
  forwarding headers. LAN, tunnels, previews and cross-origin pages get `403`, and the browser shows
  `SHELL UNAVAILABLE`. Remote access exists only through `--shell-remote-token`, typed by you.
* **Degrades, never crashes.** Without `node-pty`, without xterm, without a server at all, the window
  says `SYNAPSE SHELL // OFFLINE` (with the reason) and the rest of NOÖSPHERE is untouched.

Read [`docs/SHELL.md`](docs/SHELL.md) before enabling AUTONOMOUS. It is the honest version.

---

## Quick start

### Option 1 — open the file

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

No server, no build, no install. The document is the application.

### Option 2 — the bundled zero-dependency dev server

```bash
npm install            # optional: enables SYNAPSE SHELL (node-pty, xterm.js, ws)
npm start              # → http://localhost:4173   (UI + Ollama proxy + PTY bridge, one process)
# or: node scripts/serve.mjs --port 8080 --host 0.0.0.0
# or: npm run start:no-shell        # never spawn a PTY
```

`scripts/serve.mjs` serves the document with MIME mapping, path-traversal refusal and dotfile
blocking, proxies local Ollama inference, and bridges SYNAPSE SHELL. It works without
`npm install` — you get the full desktop and `SYNAPSE SHELL // LOCAL PTY UNAVAILABLE` instead of a
terminal. Nothing about the static artefact requires Node.js at all.

### Option 3 — any static host

Upload `index.html`. That is the entire deployable artefact. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### Verify the checkout

```bash
npm test               # static integrity audit; exits non-zero on regression
npm run audit:report   # same, plus reports/audit.json + reports/audit.md
```

Node.js ≥ 18 is required **only** for tooling. The application itself requires nothing.

---

## Architecture at a glance

```
                          index.html  (1 document · 1,571 lines)
┌──────────────────────────────────────────────────────────────────────────────┐
│  <head>            tailwind.config  →  design tokens (colour/type/shadow)     │
│                    <style>          →  CRT, glass, glow, scrollbar, hatching   │
├──────────────────────────────────────────────────────────────────────────────┤
│  chrome            <header>  system status bar   ·  <footer> dock + telemetry │
│  workspace         <main id="workspace">  —  absolutely positioned windows    │
│                    └── .glass-panel ×8   ← every window: one draggable shell  │
├──────────────────────────────────────────────────────────────────────────────┤
│  runtime           single <script>      —  11 engines, ordered by dependency  │
│                                                                              │
│   1 sound        Web Audio oscillator + event vocabulary  ◄── all engines     │
│   2 window mgr   drag · z-order · minimise · maximise · re-align              │
│   3 graph        force simulation · camera · HUD · domain filter              │
│   4 polymathLLM  vocabulary → composition → role-typed transcript             │
│   5 ingestion    FileReader → tokens → node synthesis → graph injection       │
│   6 palette      curated palettes → swatches → clipboard CSS vars             │
│   7 grimoire     fragment corpus → substring index → terminal dispatch        │
│   8 combinator   domain cross-product → axiom → graph injection               │
│   9 modal        manual node authoring                                        │
│  10 telemetry    1 Hz clock + bounded random-walk drift                        │
│  11 synapseShell host PTY window (external module, local bridge only)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Local workstation layer** (`npm start`, not part of the published artefact):

```
scripts/serve.mjs ─┬─ static files (0.0.0.0, preview-friendly)
                   ├─ /api/noosphere            → 127.0.0.1:11434 (Ollama proxy)
                   ├─ /api/shell/*, /ws/shell   → server/shell.mjs (node-pty) ← gate: loopback only
                   └─ /api/noosphere/agent/*    → server/agent.mjs (bounded tool loop)
```

**Boot sequence** — `DOMContentLoaded` → `initGraphEngine()` (90 nodes, ≈270 edges) →
`resizeCanvas()` → `renderGraph()` (self-scheduling `requestAnimationFrame` loop) →
`paletteGen.render()` → `grimoire.render()` → `lucide.createIcons()` → welcome banner.
Every window is wired to `makeDraggable` at parse time, before any engine initialises.

**Data flow** — engines communicate through three shared surfaces only: direct method calls, the
live `graphNodes` / `graphEdges` arrays, and appended DOM in the terminal transcript. There is no
event bus and no global store; the coupling graph is deliberately shallow and acyclic.

Full treatment, including data models, the physics derivation, the camera transform and the
extension seams: **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

---

## Verified metrics

Measured from `HEAD` by [`scripts/audit.mjs`](scripts/audit.mjs) — reproduce with `npm test`.

| Metric | Value |
| --- | --- |
| Application payload | **95,308 B** (93.1 KiB) · **1,571 lines** · 1 document |
| Contribution of assets | 0 B — no images, fonts or audio are vendored |
| Runtime dependencies installed | **0** for the static artefact · 3 + 1 optional for the local shell (`@xterm/xterm`, `@xterm/addon-fit`, `ws`, optional `node-pty`) |
| Build steps | **0** (the shell's JavaScript is served from `node_modules` at runtime, not bundled) |
| Windowed subsystems | **8** |
| Engines / modules | **10** in-document engines + **1** external module (`window.synapseShell`, listed as engine 11) + **5** server modules (`shell`, `agent`, `routes`, `gate`, `procinfo`) |
| Semantic domains | **5** (memetics · semiotics · psychoacoustics · hyperstition · alchemical OS) |
| Boot graph | **90 nodes**, ≈**270** procedural edges, from **15** seed archetypes |
| Physics cost at boot | **4,005** pair evaluations per frame |
| Palette states | **5** × 5 swatches |
| Knowledge fragments | **7** |
| Combinator space | **5 × 5** = 25 dialectical pairings |
| Icon references | **48** across **27** distinct names (26 resolve; `dread` does not — `NOO-006`) |
| Accessibility attributes | **0** (tracked as `NOO-016`) |
| Automated checks | **21** register IDs + 4 always-fatal DOM contract rules + **34** behavioural tests (29 PTY integration, 5 browser) |
| Tracked findings | **36**, all within `scripts/audit-baseline.json` |
| Shell sessions | up to **8** concurrent PTYs, one browser tab each, independent cwd/process state |
| Shell trust boundary | loopback peer + loopback `Host` + matching `Origin` + no forwarded headers + `Sec-Fetch-Site` |

---

## Repository map

```
Prometheus-Noosphere-v9.4/
├── index.html                     # the entire application
├── package.json                   # tooling + optional shell dependencies
├── scripts/
│   ├── audit.mjs                  # 21-check static integrity audit (dependency-free)
│   ├── audit-baseline.json        # accepted finding counts — the ratchet
│   ├── serve.mjs                  # local workstation server: static + Ollama proxy + PTY bridge
│   ├── test-shell.mjs             # 29 PTY/agent/gate integration tests (live server, real shell)
│   └── test-ui.mjs                # 5 browser tests for the shell window's degradation paths
├── server/                        # the local bridge (never shipped to a static host)
│   ├── shell.mjs                  # PTY hub: spawn, write, resize, interrupt, kill, read, save
│   ├── agent.mjs                  # bounded reason → act → observe loop (mode-aware)
│   ├── routes.mjs                 # HTTP control plane, WebSocket upgrade, agent SSE
│   ├── gate.mjs                   # the loopback/Host/Origin/forwarded-header gate
│   ├── ollama.mjs                 # local inference client (llama3.1:8b)
│   └── procinfo.mjs               # process and port visibility
├── shell/
│   ├── synapse-shell.js           # browser half: xterm.js, tabs, quick actions, agent console
│   └── synapse-shell.css          # self-contained window styling (no CDN dependency)
├── logs/                          # SAVE SESSION artefacts (gitignored, opt-in only)
├── docs/
│   ├── SHELL.md                   # SYNAPSE SHELL: trust boundary, AI modes, controls
│   ├── ARCHITECTURE.md            # runtime topology, data models, physics, seams
│   ├── API.md                     # engine methods, DOM contract, handler map
│   ├── DESIGN.md                  # token system, motion, chrome grammar, rationale
│   ├── DECISIONS.md               # architecture decision records (ADR-001…)
│   ├── ACCESSIBILITY.md           # WCAG 2.2 audit with measured contrast ratios
│   ├── PERFORMANCE.md             # frame budget, complexity analysis, optimisation ladder
│   ├── TESTING.md                 # verification strategy and manual matrix
│   ├── DEPLOYMENT.md              # static hosting, CSP, caching, release checklist
│   ├── MAINTAINABILITY.md         # stewardship, dependency policy, extraction plan
│   ├── ROADMAP.md                 # now / next / later, tied to register IDs
│   └── assets/noosphere-banner.png
├── .github/                       # CI workflows (audit · behavioural), issue forms, PR template
├── CHANGELOG.md                   # Keep a Changelog
├── CONTRIBUTING.md                # setup, conventions, review rubric
├── SECURITY.md                    # threat model and disclosure policy
└── LICENSE                        # MIT
```

---

## Technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| Markup & behaviour | Hand-authored HTML + vanilla ES2020 | No framework earns its weight for one document; the DOM *is* the component tree |
| Styling | Tailwind Play CDN + a small inline `<style>` layer | Utility velocity for a dense UI; bespoke CRT/glass primitives stay in plain CSS |
| Graph rendering | Canvas 2D + `requestAnimationFrame` | Thousands of primitives per frame with predictable cost; DOM/SVG would buckle under per-node styling |
| Iconography | Lucide (SVG, CDN) | Consistent 24 px stroke geometry; icons are declarative `data-lucide` attributes |
| Type | Cinzel (display) · Syne (UI) · JetBrains Mono (data) | Ritual / editorial / instrument — three registers, three families |
| Audio | Web Audio API oscillators | A few hundred bytes of code instead of vendored samples |
| Terminal | `@xterm/xterm` + `@xterm/addon-fit` (served locally) | A real terminal emulator doing ANSI, alternate screen, selection and resize — not a `<textarea>` pretending |
| PTY | `node-pty` (optional dependency) | The only way to get a genuine host shell: `forkpty`, real signals, real TTY semantics |
| Transport | `ws` (WebSocket) | Bidirectional byte streaming with backpressure; refused for non-local clients |
| Tooling | Node.js ≥ 18, stdlib only | The audit and dev server must not introduce a dependency tree the app refuses to have |

**Browser support:** current evergreen Chromium, Firefox and Safari. `backdrop-filter` and the
Web Audio API are required for full fidelity; clipboard export degrades silently via optional
chaining. Internet access is needed at load time for the three CDN dependencies — see
[`docs/MAINTAINABILITY.md`](docs/MAINTAINABILITY.md#2-dependency-policy) for the rationale and the
planned self-hosting path.

---

## Engineering status

This repository treats **documentation as a first-class deliverable** and **debt as a tracked
register** rather than a surprise. Every known defect has a stable ID, a severity, a baseline
count and a roadmap slot.

`npm test` runs in three tiers: the **static audit** (21 register checks plus four always-fatal DOM
contract rules — duplicate IDs, dangling `getElementById` references, `restoreOrFocus` targets that
do not exist, inline handlers calling undefined globals), the **PTY integration suite** (29 tests
against a live server and a real shell, including the network gate and every AI SHELL mode), and the
**browser suite** (5 tests that prove the desktop still boots when the shell cannot). The audit is a
**ratchet**: findings may not exceed their baseline, and improvements are reported so the baseline
can be tightened. The current state is green with 36 tracked findings; the behavioural suites skip
cleanly on a bare checkout instead of failing.

| Severity | Register IDs | Findings | Themes |
| --- | --- | --- | --- |
| High | 4 | 12 | undefined colour family (`NOO-001`) · unescaped `innerHTML` sinks (`NOO-007`) · absent accessibility semantics (`NOO-016`) · unreachable default window geometry (`NOO-019`) |
| Medium | 7 | 8 | undefined animation · unresolvable icon · unpinned CDNs · HiDPI canvas · `O(n²)` physics · frame-rate-dependent integration · missing link-preview metadata |
| Low | 9 | 14 | invalid utilities, content/number parity drift, undocked window, static "live" gauges, listener multiplication, unseeded RNG |
| Info | 1 | 2 | dead animation config |

The full register — what each finding means, its user impact and its remediation — lives in
[`docs/ARCHITECTURE.md` § Defect register](docs/ARCHITECTURE.md#17-defect-register).

---

## Documentation index

| Document | Purpose | Read it when |
| --- | --- | --- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Runtime topology, engine inventory, data models, physics derivation, extension seams, defect register | You want to understand or modify how it works |
| [API.md](docs/API.md) | Signatures for every engine method, global and handler; the DOM contract; the tooling API | You are writing code against it |
| [DESIGN.md](docs/DESIGN.md) | Token system, typography, motion rules, chrome grammar, aesthetic rationale | You are extending the visual language |
| [DECISIONS.md](docs/DECISIONS.md) | ADRs: single-file, no build, CDN delivery, canvas, procedural data, no persistence | You are questioning a foundational choice |
| [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | WCAG 2.2 AA audit with measured contrast ratios, remediation plan | You are fixing `NOO-016` or reviewing inclusion |
| [PERFORMANCE.md](docs/PERFORMANCE.md) | Frame budget, complexity model, profiling method, optimisation ladder | You are touching the render loop |
| [SHELL.md](docs/SHELL.md) | SYNAPSE SHELL: real-PTY architecture, the local-only trust boundary, AI SHELL modes, agent tools, emergency controls, troubleshooting | You are using, auditing or extending the host shell |
| [TESTING.md](docs/TESTING.md) | Verification strategy, what is covered, manual test matrix, definition of done | You are opening a pull request |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Static hosting recipes, CSP for CDN deps, caching, rollback | You are shipping it |
| [MAINTAINABILITY.md](docs/MAINTAINABILITY.md) | Dependency policy, code-health metrics, extraction plan, stewardship | You are inheriting this repository |
| [ROADMAP.md](docs/ROADMAP.md) | Now / next / later, mapped to register IDs with effort and impact | You want to contribute |
| [CHANGELOG.md](CHANGELOG.md) | Release history in Keep a Changelog form | You are upgrading |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, conventions, commit format, review rubric, recipes | You are contributing |
| [SECURITY.md](SECURITY.md) | Threat model, the `innerHTML` posture, disclosure policy | You are auditing or reporting |

---

## Roadmap

Condensed from [`docs/ROADMAP.md`](docs/ROADMAP.md); every item is traceable to a register ID or an ADR consequence.

```mermaid
flowchart LR
    subgraph SHIP["Shipped · 9.5.0 — SYNAPSE SHELL"]
      S1["PTY bridge + loopback gate"] --> S2["AI SHELL: OFF · ASSIST · AUTONOMOUS"]
    end
    subgraph NOW["Now · 9.5.1 — correctness"]
      A["NOO-019 reachable layout"] --> B["NOO-001 colour families"]
      B --> C["NOO-006 icon name"]
      C --> D["NOO-007 escape sinks"]
      D --> E["Parity: NOO-009 · 010 · 011 · 012"]
    end
    subgraph NEXT["Next · 9.6.0 — fidelity"]
      F["NOO-014 HiDPI canvas"] --> G["NOO-018 link preview"]
      G --> H["NOO-008 self-host vendors"]
      H --> I["NOO-020 fixed-step physics"]
      I --> J["prefers-reduced-motion"]
    end
    subgraph LATER["Later · 10.0.0 — structure"]
      K["NOO-015 spatial index"] --> L["NOO-016 keyboard + AT model"]
      L --> M["Optional module extraction"]
    end
    SHIP --> NOW --> NEXT --> LATER
```

| Horizon | Theme | Headline items |
| --- | --- | --- |
| **Shipped — 9.5.0** | Host shell | SYNAPSE SHELL: real PTY bridge · multiple sessions · AI SHELL `OFF`/`ASSIST`/`AUTONOMOUS` · loopback-only gate · 29 + 5 behavioural tests |
| **Now — 9.5.1** | Correctness | `NOO-019` responsive default layout · `NOO-001` undefined Tailwind family · `NOO-006` invalid icon · `NOO-007` HTML escaping · content/number parity (`NOO-009`…`NOO-012`) |
| **Next — 9.6.0** | Fidelity & trust | `NOO-014` HiDPI canvas · `NOO-018` favicon/OG/description · `NOO-008` self-hosted vendors · `NOO-020` fixed-step integration · `prefers-reduced-motion` |
| **Later — 10.0.0** | Structure & access | `NOO-015` spatial index + worker physics · `NOO-016` keyboard and screen-reader model · ES-module extraction behind an optional bundler |

---

## Deployment

The deployable artefact is `index.html`. GitHub Pages serves it unchanged from the repository root.

```bash
# One-line publish: serve the working tree at http://localhost:4173
npm start
```

Full recipes for GitHub Pages, Netlify, Vercel and Cloudflare Pages — plus the exact CSP header the
CDN dependencies require, immutable caching rules and a release checklist — are in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Contributing

Contributions are welcome, including to the writing. Before opening a pull request:

```bash
npm test            # must exit 0
npm run audit:json  # inspect findings if it does not
```

1. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) — conventions, commit format, review rubric.
2. Check [`ROADMAP.md`](docs/ROADMAP.md) for the current horizon and pick an unclaimed item.
3. Keep `index.html` the only artefact that must run; tooling stays dependency-free.
4. Commit in [Conventional Commits](https://www.conventionalcommits.org/) form with a scope from the engine inventory (`graph`, `window`, `polymath`, `ingest`, `aesthetic`, `grimoire`, `combinator`, `audit`, `docs`).

Good first issues are labelled [`good first issue`](https://github.com/zazieproductions/Prometheus-Noosphere-v9.4/issues?q=label%3A%22good+first+issue%22); nearly all of
them are small, verifiable corrections to the register above.

---

## License

[MIT](LICENSE) © Zazie Productions.

The corpus text — aphorisms, generated directives, "field reports" — is **satirical fiction**
presented as critical design. It is licensed with the code, and it is not advice.

<div align="center">
<sub>Built as a single file, on purpose. <code>NOÖSPHERE // OS v9.5.0</code></sub>
</div>

### Local workstation mode (optional, no API keys)

`npm start` runs one process that serves the interface, proxies local Ollama inference, and bridges
SYNAPSE SHELL (a real PTY) — all local-only. `npm install` is required only for the shell; the
inference proxy and the interface work without it.

The original Polymath terminal used vocabulary templates and did **not** perform inference.
To enable real local responses, install Ollama separately and install **only** `llama3.1:8b`
(if it is not already installed). No model is downloaded by NOÖSPHERE.

```bash
# Terminal 1 (with llama3.1:8b already installed)
ollama serve
# Terminal 2
npm start
# Browser: http://localhost:4173
```

The local Node server checks the installed model and proxies terminal requests exclusively to
`http://127.0.0.1:11434`. The status badge reads `LOCAL INFERENCE // ONLINE · MODEL // llama3.1:8b`
when available; otherwise `SIMULATION MODE` uses the original template engine. Prompts,
selected graph nodes, nearby nodes, grimoire fragments, terminal history and short excerpts
of ingested local text are sent to the local Ollama process. Do not expose the development
server or Ollama to the internet. Opening `index.html` directly or using GitHub Pages remains
simulation-only: a static host cannot run Ollama or the local proxy. No cloud inference or
API keys are used.

### Local-First Web Uplink & Research Workstation (`WEB_UPLINK`)

When running via `npm start`, NOÖSPHERE includes a 10-level **Local Web Research Orchestrator** (`win-uplink` + terminal slash commands) while keeping all LLM reasoning strictly on local `llama3.1:8b` via Ollama:

- **Commands**: `/web <query>`, `/read <URL>`, `/crawl <URL>`, `/site <domain> <query>`, `/research <query>`, `/news <query>`, `/browser <URL>`, `/sources`, `/ingest <n>`, `/clear-cache`.
- **Progressive Capability Detection**:
  - `SEARCH // ONLINE`: Prefers local **SearXNG** (`SEARXNG_URL`, default `http://127.0.0.1:8080`) and automatically falls back to zero-key public metasearch (DuckDuckGo, Wikipedia, Crossref, arXiv, HN Algolia, Wikimedia).
  - `CRAWLER // ONLINE`: Uses optional local **Crawl4AI** (`CRAWL4AI_URL`, default `http://127.0.0.1:11235`) or the built-in relevance-guided bounded BFS crawler.
  - `BROWSER // ONLINE/OFFLINE`: Uses local **Chromium / Playwright / CDP** with an isolated managed profile (`.noosphere-cache/browser-profile`, never your personal profile) when installed, or the built-in interactive DOM Reader fallback.
  - `OLLAMA // ONLINE/OFFLINE`: Uses `llama3.1:8b` at `http://127.0.0.1:11434` for search planning, multi-hop follow-up generation, and citation synthesis, or non-fabricated extractive synthesis when offline.
- **Full setup & security documentation**: **[`docs/WEB_UPLINK.md`](docs/WEB_UPLINK.md)**.
