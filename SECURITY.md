# Security Policy

> Threat model, the vulnerability classes that actually apply to a static, dependency-free browser
> artefact *and* to the optional local workstation mode that adds a real host shell, and how to
> report a problem. Those two shapes have different answers; this document keeps them separate
> instead of averaging them.

---

## Supported versions

| Version | Supported |
| --- | --- |
| `9.5.x` (current) | ✅ Security fixes and corrections |
| < `9.5.0` | ❌ Superseded; re-copy the file to upgrade |

The deployable artefact is a single `index.html`. There is no package published to a registry and no
update mechanism — a deployment is a file, and a fix is a new commit.

**Two shapes exist, and they do not share a threat model:**

| Shape | What runs | Shell |
| --- | --- | --- |
| **Published artefact** — GitHub Pages, any static host, `file://` | One HTML document, three CDN requests, no backend | Not present. The window reports `SHELL UNAVAILABLE`; the PTY bridge does not exist. |
| **Local workstation** — `npm start` on your own machine | The document plus `scripts/serve.mjs`: static server, local inference proxy, PTY bridge, agent loop | **A real PTY running as your account.** Powerful by design; see § "The local shell boundary" below. |

Everything in *§ Threat model* applies to the static shape. The local shape adds the sections that
follow it, and is the only configuration in which the shell, the inference proxy and the agent loop
exist at all.

---

## Threat model

Being explicit about what this project *is* removes most of the usual advisory surface:

| Property | Consequence |
| --- | --- |
| **Static, client-side only** | No server to breach, no session to hijack, no database to exfiltrate |
| **No network calls from the runtime** | No SSRF, no exfiltration path, no third-party data flow (`connect-src 'none'` is truthful) |
| **No persistence** | No cookies, no `localStorage`, no IndexedDB — nothing to poison across sessions |
| **No accounts, no personal data** | No authentication, no PII, no GDPR surface. Ingested files are read locally with `FileReader` and never transmitted |
| **No telemetry** | Nothing is measured about the visitor |
| **No backend dependencies** | The supply chain is three CDN origins and the browser |

**Trust boundaries that do exist:**

| Boundary | Untrusted input | Current handling | Risk |
| --- | --- | --- | --- |
| Console prompt | Arbitrary text | Echoed into the transcript via `innerHTML` | **`NOO-007`** |
| File ingestion | Arbitrary file **names** and text content | Filename interpolated into feed rows; content tokenised | **`NOO-007`** |
| Node authoring | Modal title and description | Interpolated into transcript and tooltip text | **`NOO-007`** |
| CDN scripts | Tailwind, Lucide, Google Fonts | Loaded by URL, two unpinned | `NOO-008` |
| Dev server (`scripts/serve.mjs`) | HTTP paths | Traversal and dotfile refusal, bound to `0.0.0.0` | Low |
| **Host shell (local mode)** | Terminal input/output, and anything AI SHELL AUTONOMOUS decides | No sandbox by design; the account's own permissions are the only boundary. Network access is refused to non-loopback clients ([`docs/SHELL.md` § 4](docs/SHELL.md#4-the-trust-boundary)) | **Accepted — this is the feature** |
| **Agent loop (local mode)** | A local model's tool calls | Fixed tool vocabulary, validated before execution; output is fenced as data, never as instructions; OFF/ASSIST/AUTONOMOUS modes | Medium, bounded |
| **Saved sessions** | Scrollback written to `logs/sessions/*.log` | Explicit user action only, never automatic; `logs/` is gitignored | Low |

**Threats considered and not applicable:** CSRF (no state-changing server), SQL injection (no
database), authentication bypass (no auth), server-side request forgery (no server), deserialisation
(no serialised input), path traversal in the *application* (no filesystem access).

---

## Known issues with security relevance

These are tracked in the defect register and are **disclosed rather than hidden** — which is the
point of publishing a policy for a project of this size.

### 1 · HTML injection through `innerHTML` sinks (`NOO-007`, high)

Four template-literal assignments interpolate human-origin values without escaping:

| Sink | Input origin | Impact |
| --- | --- | --- |
| `polymathLLM.appendChat` | Typed prompts, echoed as `user` entries | **Self-inflicted only** — you can only inject into your own session by typing markup into your own console |
| Ingestion feed rows | The **filename** of a dropped file | A malicious filename (`<img src=x onerror=…>.txt`) executes in the page when the file is dropped by the user |
| `polymathLLM.runDirective('node-deepdive')` | Node data, authored in-repo | Not attacker-controlled |
| `ideaCombinator.synthesize` | Fixed option values from `<select>` elements | Not attacker-controlled |

**Realistic severity.** There is no cross-user attack: the app has no accounts, no sharing and no
server. The meaningful vectors are (a) a victim socially engineered into dropping an attacker-supplied
filename, and (b) content-driven injection if the corpus ever becomes user-editable. Both are real but
narrow — which is exactly why this is rated *high* in the register rather than *critical*, and why the
fix is a scheduled `9.5.1` item rather than an emergency.

**Mitigation until the fix lands:** do not drop files with untrusted names into the ingestion window,
and do not paste untrusted markup into the terminal. Hosting behind a CSP does **not** mitigate this
— the current architecture requires `'unsafe-inline'`
([`DEPLOYMENT.md` § 5](docs/DEPLOYMENT.md#5-content-security-policy)), and inline event handlers keep
that requirement in place.

### 2 · Third-party supply chain (`NOO-008`, medium)

Three origins are loaded at page load, two of them unpinned:

| Dependency | Pin | Implication |
| --- | --- | --- |
| `cdn.tailwindcss.com` | none | A vendor change is adopted silently on the next visit |
| `unpkg.com/lucide@latest` | `@latest` — resolves per request | The icon set can change under a fixed commit |
| `fonts.googleapis.com` | n/a | Stylesheet + font files; CSS is not a script-execution vector, but it is a third-party request that reveals the visitor's IP to Google |

**Mitigation:** pin the URLs immediately; self-host all three in `9.6.0` (which also enables the
hardened CSP with zero third-party origins). Subresource Integrity is **not** applicable to the
Tailwind Play CDN (it generates content dynamically) — another argument for vendoring.

### 3 · Dev server path handling

`scripts/serve.mjs` refuses traversal and dotfiles and binds to `0.0.0.0:4173`. It sets no
`X-Frame-Options` and no `frame-ancestors`, deliberately, so that sandbox previews and iframe embeds
work. **It is a development tool: do not expose it to the public internet.** Production hosting
guidance lives in [`DEPLOYMENT.md`](docs/DEPLOYMENT.md), with a CSP that supports embedding under an
explicit origin allowlist.

The wide bind is now deliberate in a second sense as well: static files stay reachable so that a
container, VM or preview can load the interface, while every shell route, the `/ws/shell` upgrade and
the agent loop are gated **per request** on loopback evidence (peer, `Host`, `Origin`, absence of
forwarding headers, `Sec-Fetch-Site`). Binding the whole server to `127.0.0.1` is still available
(`--host 127.0.0.1`) and is the belt-and-braces choice for a machine that never needs a remote
preview.

### 4 · The local shell is not sandboxed (`docs/SHELL.md`)

Stated plainly because the opposite would be easy to imply: SYNAPSE SHELL is a real login shell
running as your user, with your `PATH`, your permissions and your filesystem. It can read, write,
delete, install, network and escalate exactly as far as your account can. There is no allowlist, no
denylist, no virtual filesystem and no per-command confirmation — those were considered and refused,
because each of them would be a cosmetic control that implies safety it cannot deliver.

What *is* enforced:

| Control | Mechanism |
| --- | --- |
| Remote clients cannot reach the PTY | Five-signal loopback gate on every shell request and on the WebSocket upgrade; no CORS headers ever emitted |
| A foreign page cannot hijack the socket | `Host`/`Origin` equality plus `Sec-Fetch-Site`, which a cross-site page cannot forge |
| A proxy cannot launder a remote request | Any `X-Forwarded-*`/`Forwarded`/`CF-*`/… header is a refusal |
| Remote access is never implicit | `--shell-remote-token`, chosen and supplied by the operator, off by default, printed loudly at boot |
| The model cannot reach the shell while OFF | The tool surface is not exposed and `/exec` + `/agent/run` return 403 |
| A proposed command cannot execute itself in ASSIST | Newline/`
` bytes are stripped from model writes, and the loop stops after the first proposal |
| The model cannot invent tools | Tool names are validated against a fixed vocabulary before any PTY interaction |
| Page/file text cannot command the agent | Tool output is returned inside a JSON envelope marked as data, with an explicit system-prompt rule |
| The account's secrets are not touched | No credential storage, no `sudo` automation, no password capture: `sudo` prompts behave exactly as in Terminal.app |

### 5 · Autonomous mode is privileged by design

AUTONOMOUS is the only configuration in which a model may run commands without per-command
confirmation, and it is never on by default, never persisted across a server restart, and never
enabled by a model. Bounds (MAX STEPS, MAX RUNTIME, STOP ON ERROR) are enforced in the loop, and
STOP AGENT / INTERRUPT / KILL PROCESS are always available without the model's cooperation. Treat
enabling it as equivalent to handing someone your unlocked laptop: a deliberate, understood act.

---

## Reporting a vulnerability

**Please report privately — do not open a public issue.**

1. Use GitHub's **Security → Report a vulnerability** (private advisory) on this repository. This is
   the preferred channel and keeps the discussion, the fix and the CVE-style record in one place.
2. Include: affected version or commit, a minimal reproduction, the impact you believe it has, and
   whether it requires the user to be coerced into an action (this matters a great deal here — see
   § 1).
3. If the private-advisory form is unavailable, open an issue that says only *"security report,
   please provide a private channel"* — with no technical detail — and a maintainer will respond.

**What to expect:**

| Stage | Target |
| --- | --- |
| Acknowledgement | 72 hours |
| Initial assessment (severity, applicability, whether it is already in the register) | 7 days |
| Fix / mitigation | 30 days for high severity, next scheduled horizon for low |
| Credit | Offered in the advisory and in [`CHANGELOG.md`](CHANGELOG.md) unless you prefer otherwise |

There is no bug bounty. This is a single-author project with no revenue; the reward is a fix, a
credit and a fast, honest conversation.

---

## Out of scope

Reports about the following will be closed with a pointer to this section. They are **known,
documented, and not vulnerabilities**:

| Class | Why it is out of scope |
| --- | --- |
| **The satirical corpus** | Interface copy such as "memetic warfare" and "subliminal indoctrination" is critical design fiction, disclosed in three documents ([`README.md`](README.md#what-this-is-not), [`ARCHITECTURE.md` § 18](docs/ARCHITECTURE.md#18-vocabulary-project-language--engineering-meaning), [`DESIGN.md` § 9](docs/DESIGN.md#9-satire-and-disclosure)). It is not a claim of capability, and it is not advice. |
| **Self-XSS via the console** | Typing markup into your own transcript affects only your own session, in memory, with no persistence |
| **The "LLM" not being a model** | Explicitly documented, including where the prompt parameter is ignored ([`ARCHITECTURE.md` § 12](docs/ARCHITECTURE.md#12-the-composition-engine-polymath-llm)) |
| **Synthetic telemetry** | Documented as synthetic (`NOO-013` tracks the parts that are merely static) |
| **Widget/iframe embedding** | The artefact is designed to be embeddable; use `frame-ancestors` at the host if you need to restrict it |
| **Denial of service by opening a large file** | Client-side, self-inflicted, no server impact |
| **Missing security headers on a host you configured** | Host configuration is the operator's responsibility; guidance is provided in [`DEPLOYMENT.md` § 5](docs/DEPLOYMENT.md#5-content-security-policy) |
| **"The shell can delete my files"** | It is a shell. That is the documented, intended behaviour ([`SHELL.md` § 1](docs/SHELL.md#1-what-this-is)) |
| **"The agent ran a command I did not expect"** | AUTONOMOUS mode was enabled by the operator; the mode *is* the authorisation, and STOP AGENT exists ([`SHELL.md` § 6](docs/SHELL.md#6-ai-shell-control-off--assist--autonomous)) |
| **Lan/remote clients being refused** | The refusal is the security control, not a bug ([`SHELL.md` § 4](docs/SHELL.md#4-the-trust-boundary)) |
| **A model making a wrong decision** | The loop is a bounded tool loop over a real shell with the user's authority; correctness of model judgement is not a security property of this project |

---

## Privacy statement

There is no data collection. No cookies, no fingerprints, no analytics, no beacons, no error
reporting, and no network requests originating from the runtime (for the published artefact — the
local modes below are the explicit exception). Files dropped into the ingestion
window are read with `FileReader` inside the tab and are never transmitted, stored or retained. The
only third-party requests are the three CDN dependencies described above, which are made by the
browser at page load and governed by their vendors' own policies.

---

<div align="center">
<sub>Disclosing your own defects in a public register is a security posture, not a liability.</sub>
</div>

## Optional local inference & Web Uplink privacy and security boundary

On `npm start`, terminal prompts and limited graph, grimoire, history and ingested text excerpts
are posted to the same-origin local server and forwarded only to `127.0.0.1:11434` (Ollama `llama3.1:8b`).
They do not leave the machine through this integration. The inference and `/api/uplink/*` routes require a
loopback socket, localhost Host and matching Origin; static assets retain the existing bind
behavior. Do not expose either server to untrusted users. Model outputs are rendered as text,
not HTML. The historical static-only privacy statement above applies to file-open and
GitHub Pages simulation mode, not to local inference or Web Uplink mode. The separate Ollama installation
and its configuration are the user's responsibility.

When the user explicitly invokes **Web Uplink** commands (`/web`, `/read`, `/crawl`, `/site`, `/research`, `/news`, `/browser`):
- **Search Egress**: Sanitized search queries (and never your local Zaziopath corpus or ingested files) are sent to your local SearXNG instance (`SEARXNG_URL`) or fallback public search APIs.
- **Public Webpage Fetching & SSRF Protection**: Requested URLs are fetched from the public internet after strict SSRF and DNS-rebinding validation (`scripts/uplink/security.mjs`), which blocks `localhost`, `127.0.0.0/8`, RFC1918 private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local and cloud metadata endpoints (`169.254.169.254`, `fd00:ec2::254`), `file://`, non-HTTP schemes, binary MIME types, and redirect-to-private-IP hops.
- **Prompt-Injection Isolation**: Fetched webpage content is treated strictly as untrusted data, stripped of hidden DOM elements and known injection/control tokens, and wrapped in `<untrusted_web_evidence>` fences before local `llama3.1:8b` synthesis.
- **Ephemeral by Default**: Web findings remain ephemeral unless the user explicitly runs `/ingest <n>`, `INGEST SOURCE`, `INGEST FINDING`, or `ADD TO GRAPH`, which tags provenance as `WEB SOURCE` and separates quoted source text from local Ollama interpretation.

### Host shell privacy boundary

SYNAPSE SHELL changes what the *machine* can be asked to do, not who can ask. Nothing about terminal
activity is transmitted by NOÖSPHERE: scrollback is in-memory by default, saved only when the user
presses SAVE SESSION, and never auto-ingested into the corpus. The shell itself can of course make
network requests (`curl`, `git`, `ssh`, `brew`) — that capability belongs to the account and to the
commands the user or an authorised agent chose to run, and it is the same capability the user already
has in Terminal.app. The gate ensures that a browser on another machine, a preview proxy or a
cross-origin page cannot be the one choosing those commands.
