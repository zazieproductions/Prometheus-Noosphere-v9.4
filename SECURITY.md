# Security Policy

> Threat model, the vulnerability classes that actually apply to a static, dependency-free,
> backend-free browser artefact, and how to report a problem.

---

## Supported versions

| Version | Supported |
| --- | --- |
| `9.4.x` (current) | ✅ Security fixes and corrections |
| < `9.4.1` | ❌ Pre-repository iterations; not distributed |

The deployable artefact is a single `index.html`. There is no server component, no package published
to a registry, and no update mechanism — a deployment is a file, and a fix is a new commit.

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
fix is a scheduled `9.4.2` item rather than an emergency.

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

**Mitigation:** pin the URLs immediately; self-host all three in `9.5.0` (which also enables the
hardened CSP with zero third-party origins). Subresource Integrity is **not** applicable to the
Tailwind Play CDN (it generates content dynamically) — another argument for vendoring.

### 3 · Dev server path handling

`scripts/serve.mjs` refuses traversal and dotfiles and binds to `0.0.0.0:4173`. It sets no
`X-Frame-Options` and no `frame-ancestors`, deliberately, so that sandbox previews and iframe embeds
work. **It is a development tool: do not expose it to the public internet.** Production hosting
guidance lives in [`DEPLOYMENT.md`](docs/DEPLOYMENT.md), with a CSP that supports embedding under an
explicit origin allowlist.

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

---

## Privacy statement

There is no data collection. No cookies, no fingerprints, no analytics, no beacons, no error
reporting, and no network requests originating from the runtime. Files dropped into the ingestion
window are read with `FileReader` inside the tab and are never transmitted, stored or retained. The
only third-party requests are the three CDN dependencies described above, which are made by the
browser at page load and governed by their vendors' own policies.

---

<div align="center">
<sub>Disclosing your own defects in a public register is a security posture, not a liability.</sub>
</div>
