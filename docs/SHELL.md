# SYNAPSE SHELL

> A real terminal for NOÖSPHERE // OS: your own login shell, in a draggable CRT window,
> with an explicit and revocable execution surface for the local model.

**Status:** shipped in `9.5.0` · **Trust model:** local machine only ·
**Sandbox:** none, deliberately — read [§ 1](#1-what-this-is) before enabling anything.

---

## Contents

1. [What this is](#1-what-this-is)
2. [What this is not](#2-what-this-is-not)
3. [Architecture](#3-architecture)
4. [The trust boundary](#4-the-trust-boundary)
5. [Sessions](#5-sessions)
6. [AI SHELL control: OFF · ASSIST · AUTONOMOUS](#6-ai-shell-control-off--assist--autonomous)
7. [The agent loop and its tools](#7-the-agent-loop-and-its-tools)
8. [How execution is observed (the probe protocol)](#8-how-execution-is-observed-the-probe-protocol)
9. [Human controls](#9-human-controls)
10. [Processes and ports](#10-processes-and-ports)
11. [Session logging](#11-session-logging)
12. [Zaziopath and the other subsystems](#12-zaziopath-and-the-other-subsystems)
13. [Configuration](#13-configuration)
14. [Failure modes](#14-failure-modes)
15. [Troubleshooting](#15-troubleshooting)
16. [Testing](#16-testing)
17. [Deliberate non-goals](#17-deliberate-non-goals)

---

## 1. What this is

SYNAPSE SHELL is a real PTY. The chain is short and has no simulation anywhere in it:

```
browser (xterm.js)  ⇄  WebSocket  ⇄  node-pty (forkpty)  ⇄  your login shell  ⇄  macOS
```

* The shell is `$SHELL`, falling back to `/bin/zsh` (and then `/bin/bash`, `/bin/sh`).
* It is started as a **login shell** (`-l`), which is what Terminal.app does, so your
  `~/.zprofile` / `~/.zshrc` / `~/.zlogin` run as usual and your `PATH`, aliases, functions,
  plugins and prompts are exactly the ones you have outside NOÖSPHERE.
* It runs **as your user account**, with your account's filesystem permissions. `cd ~`,
  `cd /Volumes/…`, `cd /Users/…`, `sudo`, `brew`, `git`, `ssh`, `docker`, `ffmpeg`, `ollama`,
  interpreters, package managers and full-screen TUIs are not intercepted, filtered or rewritten.
* There is **no command allowlist, no denylist, no virtual filesystem, no command parser**.
  Keystrokes go to the PTY; output comes back byte-for-byte (via a stateful UTF-8 decoder so
  multi-byte characters cannot be split across frames).

The window is instrumentation around that fact: an identity strip (`HOST // LOCAL`,
`SHELL // zsh`, `PTY-01`, `PID`, `CWD`), session tabs, quick actions, and an AI control surface.

**Everything the shell can do, you can do.** The interesting questions are therefore not about the
shell's capabilities but about *who else* can reach it ([§ 4](#4-the-trust-boundary)) and *what the
local model may do with it* ([§ 6](#6-ai-shell-control-off--assist--autonomous)).

---

## 2. What this is not

| Claim you should not believe | Reality |
| --- | --- |
| "Sandboxed" | Nothing is sandboxed. There is no `chroot`, no `sandbox-exec` profile, no container, no permission wall between this shell and your home directory. |
| "Read-only" | It is read/write, including `rm`. |
| "Confined to the repository" | The initial working directory is the repository for convenience; `cd` goes anywhere your account can go. |
| "Trusted output" | Terminal output is untrusted text. It never becomes HTML (xterm renders it), and it is fenced as *data* when handed to the model. |
| "Safe to expose" | It is a **remote shell** if you expose it. The gate exists precisely because that is true. |

If you need a sandboxed experiment, run NOÖSPHERE (or the command) inside a VM/container and let
that be the boundary. The boundary this project implements is a *network* boundary, not a
capability boundary.

---

## 3. Architecture

```
┌─ browser ────────────────────────────────────────────────────────────────────────┐
│ index.html  →  #win-shell (chrome only: header, dock entry, terminal host div)    │
│ shell/synapse-shell.js   xterm.js · tabs · quick actions · agent console · panels │
│ shell/synapse-shell.css  self-contained styling (no CDN dependency)               │
└───────────────▲──────────────────────────────────────────────────────────────────┘
                │ ws://localhost:4173/ws/shell?session=pty-01     JSON frames
┌───────────────▼──────────────────────────────────────────────────────────────────┐
│ scripts/serve.mjs            one process: static files + inference proxy + bridge │
│ ├── server/gate.mjs          loopback · Host · Origin · forwarded-header gate     │
│ ├── server/routes.mjs        HTTP control plane + WebSocket upgrade + agent SSE   │
│ ├── server/shell.mjs         PTY hub: spawn/write/resize/interrupt/kill/read/save │
│ ├── server/agent.mjs         bounded reason → act → observe loop (mode-aware)     │
│ ├── server/ollama.mjs        local inference client (llama3.1:8b)                 │
│ └── server/procinfo.mjs      ps/lsof/ss visibility for the PROCESSES panel        │
└───────────────▲──────────────────────────────────────────────────────────────────┘
                │ forkpty()
        ┌───────▼────────┐
        │ your shell     │  zsh · bash · whatever $SHELL is · your PATH · your rc files
        └────────────────┘
```

One process, one port, one command (`npm start`). There is no second service to forget to launch.

| File | Responsibility |
| --- | --- |
| `scripts/serve.mjs` | Boot, static/GitHub-Pages-compatible file serving, vendor assets, inference proxy, shell routes, shutdown that reaps PTYs |
| `server/gate.mjs` | Decides whether a request is "same machine"; no other module makes that decision |
| `server/shell.mjs` | The PTY hub — the only place `node-pty` is imported |
| `server/agent.mjs` | The only place a model decision becomes machine action |
| `server/routes.mjs` | Transport surface (HTTP/WS/SSE); enforces the gate before dispatch |
| `server/ollama.mjs` | Inference; loopback by default, `NOOSPHERE_OLLAMA_URL` to relocate |
| `server/procinfo.mjs` | Process/port inspection used by the UI and by cleanup |
| `shell/synapse-shell.js` | Browser half; degrades to `OFFLINE` when the bridge is absent |
| `shell/synapse-shell.css` | Window styling that does not depend on the Tailwind CDN |

---

## 4. The trust boundary

Static files are served on `0.0.0.0` so that containers, VMs and preview proxies can load the UI.
**The shell is not part of that.** Every shell route, the WebSocket upgrade and the agent loop are
refused unless four independent signals agree:

| Signal | Requirement | Refusal reason |
| --- | --- | --- |
| TCP peer | loopback (`127.0.0.1`, `::1`, mapped forms) | `peer-not-loopback` |
| `Host` header | `localhost`, `*.localhost`, `[::1]`, `127.x.y.z` | `host-not-loopback` |
| `Origin` (if sent) | exactly matches the `Host` | `origin-mismatch` |
| `X-Forwarded-*`, `Forwarded`, `CF-*`, `X-Real-IP`, … | must be absent | `forwarded-header:…` |
| `Sec-Fetch-Site` (if sent) | `same-origin` or `none` | `sec-fetch-site-cross-site` |

The `Host` + `Origin` pair is what stops **cross-site WebSocket hijacking**: a page on
`https://evil.example` can open a socket to `127.0.0.1:4173`, but it cannot forge either header, and
browsers do not let it read the response. The forwarded-header rule is what stops a proxy the
machine does not control from laundering a remote request into a loopback one.

| Client | Shell availability |
| --- | --- |
| `http://localhost:4173` on the host machine | **available** |
| LAN browser (`http://192.168.x.y:4173`) | **unavailable** — refused, unless the operator explicitly opts in (below) |
| Remote preview / reverse proxy / tunnel | **unavailable** — refused |
| GitHub Pages / any static host | **unavailable** — there is no bridge to answer, so the window renders `SHELL UNAVAILABLE`; nothing else on the page degrades |
| A local `curl`, script or test on the host machine | available (it is the same machine, which is the actual rule) |

**No CORS headers are ever emitted for shell routes**, so even a permitted-by-accident request
cannot be read by a foreign origin.

### The explicit escape hatch

```bash
node scripts/serve.mjs --shell-remote-token <a-secret-you-chose>
# or: NOOSPHERE_SHELL_REMOTE_TOKEN=<secret> npm start
```

This is **off by default, never generated for you, and printed loudly at boot**. When a token is
set, a remote client presenting it (via `Authorization: Bearer …` or `?token=…`) is allowed through.
Anyone who can reach the port *and* knows the token gets a PTY as your user — that is the whole
point of a remote shell, and the reason this is opt-in rather than default.

### Disabling the shell entirely

```bash
npm run start:no-shell        # or: node scripts/serve.mjs --no-shell
NOOSPHERE_SHELL=off npm start # equivalent
```

No PTY is ever spawned; `/api/shell/status` reports `available: false`; the window renders
`SYNAPSE SHELL // LOCAL PTY UNAVAILABLE` and everything else in NOÖSPHERE works unchanged.

---

## 5. Sessions

* Each session is its own PTY, process group, working directory and scrollback ring. `SHELL 01`,
  `SHELL 02`, … are independent shells for one local user — not multi-user infrastructure.
* The **initial working directory** is the repository root; every session can `cd` anywhere.
* **Working directory tracking**: shells that emit OSC 7 report their path directly; otherwise the
  PTY's `cwd` is polled (`/proc/<pid>/cwd` on Linux, `lsof -a -d cwd -p <pid>` on macOS) every few
  seconds and pushed to the strip live. The value is informational; the shell owns the truth.
* **Restart** keeps the session id and label (so tabs, scripts and an agent's handle stay valid) but
  forks a brand-new shell; the old process tree is terminated first.
* **Close** sends `SIGTERM` to the process tree, then `SIGKILL` to survivors, removes the session and
  disposes the terminal. The integration test asserts that no orphan survives.
* **Backpressure**: if a browser stops reading (backgrounded tab, slow link) and > 8 MB queues, the
  PTY is paused and resumed once the queue drains below 1 MB. Output is never silently dropped.
* **Scrollback** is an in-memory ring, bounded per session (`scrollbackChars`, default 512 KB) and
  never written to disk unless you press SAVE SESSION.
* **Limits**: `maxSessions` (8), `cols` clamped to 20…500, `rows` to 5…200.

---

## 6. AI SHELL control: OFF · ASSIST · AUTONOMOUS

The mode is the authorisation. There are no per-command confirmation dialogs once you deliberately
choose AUTONOMOUS, and there is no way for the model to reach the shell while the mode is OFF.

| Mode | Tool surface | What the model can do | What it cannot do |
| --- | --- | --- | --- |
| **OFF** | none | nothing — the tools are not exposed and `/exec` and `/agent/run` return `403` | anything at all |
| **ASSIST** | read + propose | type a command into the input buffer (**without pressing Enter**), read the scrollback, read the cwd | execute anything: newline/`\r` bytes are stripped from its writes, and the loop stops after the first proposal |
| **AUTONOMOUS** | all tools | execute commands, observe output, iterate, open and close extra sessions | exceed MAX STEPS / MAX RUNTIME, or ignore STOP AGENT |

Switching modes:

* click the **AI SHELL CONTROL** badge to cycle, or the **AI: OFF / AI ASSIST / AI AUTONOMOUS**
  buttons in the quick-action row;
* `POST /api/shell/ai {"mode":"autonomous"}` for scripts.

Mode state is **in-memory only**: reloading the server returns to OFF. AUTONOMOUS is never persisted,
never default, and never activated by a model.

### Autonomy bounds (editable in the agent panel)

| Bound | Default | Range | Meaning |
| --- | --- | --- | --- |
| `MAX STEPS` | 12 | 1…50 | hard cap on reason→act→observe cycles per run |
| `MAX RUNTIME s` | 300 | 5…3600 | wall-clock budget for the whole run |
| `STOP ON ERROR` | off | on/off | abort the run on the first non-zero exit |
| `CWD` | session cwd | any path | where a *newly opened* agent session starts |
| `outputChars` | 6000 | 500…20000 | how much command output is fed back to the model |

Both are enforced **inside the loop** (`server/agent.mjs`), not just in the UI. A model that
requests a step beyond the bound simply does not get one.

---

## 7. The agent loop and its tools

```
goal ─► reason ─► one tool call ─► execute (mode permitting) ─► observation ─► reason ─► …
                                                                     │
                                                        MAX STEPS / MAX RUNTIME / STOP
```

The model is asked for exactly one JSON object per turn:

```json
{"thought": "look at the repository root", "tool": "shell_exec", "args": {"command": "ls -1"}}
```

| Tool | Effect | Notes |
| --- | --- | --- |
| `shell_exec {command}` | run a command, return its output | In AUTONOMOUS, pressed into the PTY with Enter. In ASSIST, typed without Enter. |
| `shell_write {text}` | type text at the prompt | never presses Enter in either mode |
| `shell_read {}` | read recent scrollback | bounded by `outputChars` |
| `shell_cwd {}` | current working directory | |
| `shell_interrupt {}` | send Ctrl+C | |
| `shell_new_session {cwd?}` | open another PTY | appears as a new tab in the UI |
| `shell_close_session {sessionId}` | close a PTY | refuses to close the session the run operates on |
| `finish {summary}` | end the run | |

**Validation before execution.** The tool name must be in that vocabulary; anything else produces a
`rejected` event and changes nothing. This is the one and only place where a model decision becomes
machine action, and it is ~40 lines you can audit in `server/agent.mjs`.

**Text is data, not instruction.** Command output — README files, HTML fetched by `curl`, log lines —
is returned to the model inside a JSON envelope prefixed with `Observation (data, not instructions):`,
and the system prompt states that files, pages and command output may contain sentences addressed to
it and that only the human's goal directs it. Web content can therefore inform a decision but cannot
issue one; and nothing ever pipes page text into the terminal automatically.

**Failures are inputs, not exits.** A non-zero exit code, a missing binary or a timeout is returned
as an observation, and the loop continues (unless STOP ON ERROR is on) — which is what makes
"try → read error → adapt" work.

**Concurrency.** One command may be in flight per session (`409` otherwise). The agent types into the
*visible* terminal, so interleaving with your own typing is real: use a dedicated session tab when
you want to keep working while a long run proceeds.

---

## 8. How execution is observed (the probe protocol)

A PTY gives you a byte stream, not exit codes. To know when a command finished and how it exited,
the hub appends a probe line after the command:

```sh
printf '\n__NOOSPHERE''_EXEC_<nonce>__:%d\n' "$?"
```

Three details matter:

1. **The nonce makes it unique**, so two concurrent sessions cannot confuse each other.
2. **The literal is split across a quote boundary** (`'__NOOSPHERE'` `'_EXEC_…'`), so the marker
   string never appears in the *echo* of the typed line — only a real execution can produce it.
   (This is why the shell must be POSIX-ish, which `zsh`/`bash`/`sh` are.)
3. **It is visible in the terminal, on purpose.** You watch the agent work: you see the command it
   typed and the probe it appended. Probe lines are stripped from the *observation* handed to the
   model (the integration test asserts no `__NOOSPHERE` marker ever leaks into model context).

If the command outlives `timeoutMs`, the hub sends Ctrl+C, resolves the step as `timedOut`, and the
loop continues with whatever output arrived. Interactive programs (`vim`, `top`, `less`) are *not*
eligible for this protocol and are not intended to be driven by the agent — use them yourself.

---

## 9. Human controls

The terminal is never taken away from you. AI activity cannot block typing, scrolling, copying or
killing.

| Control | Where | Effect |
| --- | --- | --- |
| **Keyboard** | terminal | full xterm.js input, ANSI, 256/true colour, alternate screen, Tab completion, arrow history, Ctrl+C/D/Z/L/R, bracketed paste |
| **Copy / paste** | terminal | ⌘C/⌘V on macOS, Ctrl+Shift+C/V elsewhere; selection copy, plus COPY OUTPUT for the whole buffer |
| **INTERRUPT ^C** | quick actions | sends `\u0003` to the PTY (what Ctrl+C is) |
| **KILL PROCESS** | quick actions | `SIGTERM` → `SIGKILL` through the session's process tree |
| **RESTART** | quick actions | new shell, same handle and cwd |
| **NEW SHELL** | quick actions, tabs | another independent PTY |
| **STOP AGENT** | agent panel | aborts the run, sends Ctrl+C, and the loop stops at the next check — never mid-write |
| **SIGKILL** | PROCESSES panel | kills one NOÖSPHERE-spawned process |
| **SAVE SESSION** | quick actions | writes the scrollback to disk (below) |

`Ctrl+C` is *not* hijacked for copy: it is the interrupt signal, as in any terminal. That is why
copy has its own chord.

Emergency sequence if something is misbehaving: **STOP AGENT** → **INTERRUPT** → **KILL PROCESS** →
**RESTART**. All four are one click, none of them ask for confirmation, and none of them require the
AI to cooperate.

---

## 10. Processes and ports

* **PROCESSES** lists processes whose ancestry includes a NOÖSPHERE PTY (pid, parent, cpu, mem,
  elapsed, command, owning session) against the host total. The SIGKILL button is restricted to that
  set — a GUI button should not be a general-purpose "kill any pid" tool, while the *shell itself*
  remains unrestricted, because that authority is yours, not the interface's.
* **PORTS** lists listening TCP sockets via `lsof -nP -iTCP -sTCP:LISTEN` (macOS) or `ss -ltnp`
  (Linux), degrading to an explanatory message when neither tool exists.
* Neither panel kills anything automatically, and neither changes your background jobs when windows
  are closed or minimised. Shutting the *server* down does reap the PTYs it spawned.

---

## 11. Session logging

* **Default: ephemeral.** Scrollback lives in memory and dies with the session.
* **SAVE SESSION** (explicit, per session) writes a snapshot to
  `logs/sessions/<timestamp>-<session-id>.log` — provenance header plus the stripped transcript.
  `logs/` is gitignored, so saving is not committing.
* Continuous logging, auto-ingestion into the Zaziopath graph and "record everything" do not exist:
  a shell history you did not ask for is a liability, not a feature. Copy or commit the artefact if
  you want it to become part of the corpus.
* `--log-dir <path>` relocates the save directory.

---

## 12. Zaziopath and the other subsystems

| Subsystem | Interface | What it buys you |
| --- | --- | --- |
| **Zaziopath corpus** | `$NOOSPHERE_ZAZIOPATH` (default `~/Zaziopath`) is exported into every session | `rg "recursive identity" "$NOOSPHERE_ZAZIOPATH"`, analysis scripts, report generation, graph rebuilds — from the shell, with the corpus as a first-class location |
| **Polymath / Ollama** | AI SHELL control + the agent loop (`/api/noosphere/agent/run`) | the model can inspect, run, read and iterate instead of only talking |
| **Web Uplink (future)** | — | the pattern to aim for: search → read docs → run a local command → inspect output. Web text is *source material*; the loop treats it as data, never as instructions |
| **Ingestion Vector** | — | save a session, then ingest the artefact through the existing upload window if you want it in the graph |
| **Neural graph** | `graphEngine.injectNode(title, domain, description)` remains a global | a script or an agent summary can seed nodes; nothing was changed about how the graph works |

Nothing here isolates the subsystems from each other — that is the point. The seam that *is*
deliberate: raw webpage text never reaches the terminal as a command.

---

## 13. Configuration

```bash
npm start                                  # everything: UI, inference proxy, PTY bridge, agent
node scripts/serve.mjs --port 8080         # different port
node scripts/serve.mjs --host 127.0.0.1    # bind loopback only (belt and braces)
node scripts/serve.mjs --no-shell          # no PTY, ever
node scripts/serve.mjs --zaziopath ~/Corpus
node scripts/serve.mjs --log-dir ~/shell-logs
node scripts/serve.mjs --ollama http://127.0.0.1:11434
node scripts/serve.mjs --shell-remote-token <secret>   # explicit, loud, off by default
```

| Environment variable | Effect |
| --- | --- |
| `PORT`, `HOST` | listen address (default `4173`, `0.0.0.0`) |
| `NOOSPHERE_SHELL=off` | same as `--no-shell` |
| `NOOSPHERE_OLLAMA_URL` | inference endpoint (default `http://127.0.0.1:11434`) |
| `NOOSPHERE_ZAZIOPATH` | corpus root exported to sessions |
| `NOOSPHERE_SHELL_REMOTE_TOKEN` | same as `--shell-remote-token` |
| `SHELL` | the shell to spawn (falls back to `/bin/zsh`, then `/bin/bash`, `/bin/sh`) |

Inside every session: `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=NOOSPHERE`,
`NOOSPHERE_SHELL=1`, `NOOSPHERE_SESSION`, `NOOSPHERE_REPO`, `NOOSPHERE_ZAZIOPATH`. Everything else is
inherited from the account that started the server, unmodified. NOÖSPHERE never dumps the
environment into the UI, and `env`/`printenv`/`echo $PATH` behave exactly as they should.

---

## 14. Failure modes

| Failure | Behaviour |
| --- | --- |
| `node-pty` not installed or unbuildable (it is an **optional** dependency) | `npm install` still succeeds; the server logs `SYNAPSE SHELL → OFFLINE (…)`; the window shows `SYNAPSE SHELL // LOCAL PTY UNAVAILABLE` with the reason; NOÖSPHERE is fully usable |
| `@xterm/xterm` missing | `/vendor/xterm.js` 404s; the window shows `TERMINAL LIBRARY MISSING` and tells you to install |
| Bridge process not running (file opened directly, static host, preview) | `SHELL UNAVAILABLE // BRIDGE UNREACHABLE`, no error dialogs, rest of the desktop unaffected |
| Remote client | `SHELL UNAVAILABLE` with the loopback explanation; the page never even opens a socket |
| PTY exits (typing `exit`, a crash, `KILL PROCESS`) | the tab turns red, the exit code is printed in the terminal, RESTART gives you a fresh shell |
| WebSocket drops (server restart, sleep/wake) | the client retries with backoff up to 5 times, then reports `bridge connection lost` |
| Shell crashes the server process | NOÖSPHERE's UI is unaffected (it is a separate page); restart `npm start` |

---

## 15. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `SHELL UNAVAILABLE` on a machine where `npm start` runs | you opened the page through a proxy/tunnel/preview, or via `file://` | open `http://localhost:4173` |
| `LOCAL PTY UNAVAILABLE` | `node-pty` missing or failed to build | `npm install`; on macOS install Xcode command-line tools (`xcode-select --install`) |
| `TERMINAL LIBRARY MISSING` | `@xterm/xterm` not installed | `npm install` |
| Session opens then instantly exits | your shell's rc file exits, or `SHELL` points at a broken binary | run `node scripts/serve.mjs` with `SHELL=/bin/zsh` and check the terminal banner |
| Prompt renders, keys do nothing | the panel was hidden when it was fitted; click the terminal | click the tab (the client re-fits on show) |
| `sudo` asks for a password | normal | type it in the terminal; nothing is stored, and no credential is ever written by NOÖSPHERE |
| Garbled characters in a program | the program does not support 256-colour/UTF-8 | `TERM=xterm-256color` is already exported; check the program's locale support |
| Everything 403s in the console | the gate is working | run from the host machine |

---

## 16. Testing

```bash
npm test              # static audit + PTY integration tests + browser tests
npm run test:shell    # 29 integration tests against a live server and a real PTY
npm run test:ui       # 5 browser tests (needs the dev-only jsdom dependency)
```

The integration suite (see [`TESTING.md`](TESTING.md)) starts the real server, spawns real PTYs and
asserts: command execution, exit codes, pipes/redirection/substitution/loops, UTF-8 integrity, ANSI
and alternate-screen passthrough, Ctrl+C, `stty size` after a resize, session independence, cwd
tracking, restart, orphan-free close, all five gate refusals (HTTP **and** the WebSocket upgrade),
the OFF/ASSIST/AUTONOMOUS contracts, unknown-tool refusal, MAX STEPS, STOP AGENT, process
ownership, port listing, opt-in saving and orphan-free shutdown. The model is replaced by a scripted
stub, so the agent loop is deterministic and needs no GPU.

The browser suite drives the real `shell/synapse-shell.js` in jsdom and asserts the four reachable
states — including that **NOÖSPHERE still boots when the PTY does not**.

Manual checks worth doing once on your machine: run `vim` and `top`; press Ctrl+R and type; run
`ollama list`; `cd ~/…` and watch CWD update in the strip; resize the window and run `tput cols`;
turn AUTONOMOUS on, ask for something small, then press STOP AGENT mid-run.

---

## 17. Deliberate non-goals

* **No command filtering.** Any list would be both a fiction (a shell can run anything) and a lie
  (it would imply safety it cannot provide).
* **No virtual filesystem, no per-command confirmation prompts, no credential storage.**
* **No multi-user support, no remote collaboration, no session sharing.** Multiple shells are for
  one local user.
* **No silent ingestion** of terminal history into the corpus, and no telemetry.
* **No mobile/keyboard-less support.** A PTY needs a keyboard; the window is not designed for touch.
* **No auto-downloading of models.** The existing `llama3.1:8b` integration is preserved exactly:
  `ollama list`, `ollama ps` and `ollama run llama3.1:8b` work *because the shell is a shell*.

---

*Related:* [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`API.md`](API.md) · [`TESTING.md`](TESTING.md) ·
[`../SECURITY.md`](../SECURITY.md) · [`DECISIONS.md`](DECISIONS.md)
