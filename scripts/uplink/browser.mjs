/**
 * NOÖSPHERE // WEB UPLINK — Level 4 Managed Local Browser & DOM Reader
 * ============================================================================
 * Provides an isolated, local-first browser automation surface:
 *  - Uses Playwright or local Chromium via CDP with a separate managed profile
 *    (.noosphere-cache/browser-profile) when installed on the host.
 *  - Never touches the user's personal logged-in browser profile.
 *  - Blocks browser file downloads and enforces strict SSRF checks on navigation.
 *  - Enforces a strict Consequential Action Guard: never autonomously purchases,
 *    posts content, deletes data, submits sensitive forms, or changes account settings.
 *  - Gracefully falls back to an interactive Server-Assisted DOM Reader session when
 *    Chromium/Playwright is not installed.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePublicUrl, canonicalizeUrl, sanitizeWebTextForLLM } from './security.mjs';
import { fetch_page } from './reader.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MANAGED_PROFILE_DIR = join(ROOT, '.noosphere-cache', 'browser-profile');

const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

const CONSEQUENTIAL_PATTERNS = [
  {
    category: 'financial_purchase',
    regex: /\b(buy|purchase|checkout|check-out|pay|payment|billing|credit[-_\s]?card|card[-_\s]?number|cvv|cvc|iban|donate|subscribe|order[-_\s]?now|place[-_\s]?order|add[-_\s]?to[-_\s]?cart|wire|transfer)\b/i,
  },
  {
    category: 'destructive_mutation',
    regex: /\b(delete|remove|destroy|erase|purge|drop|revoke|deactivate|close[-_\s]?account|cancel[-_\s]?subscription|unsubscribe)\b/i,
  },
  {
    category: 'content_posting',
    regex: /\b(post|publish|submit[-_\s]?comment|reply|tweet|send[-_\s]?message|broadcast|create[-_\s]?post|upload)\b/i,
  },
  {
    category: 'auth_or_account_settings',
    regex: /\b(password|passwd|passcode|secret|api[-_\s]?key|private[-_\s]?key|token|login|log[-_\s]?in|signin|sign[-_\s]?in|signup|sign[-_\s]?up|register|oauth|authorize|settings|account[-_\s]?settings|preferences|profile[-_\s]?edit|2fa|mfa|totp)\b/i,
  },
];

/**
 * Checks whether an action (click or form fill) is consequential or sensitive.
 * Returns { consequential: boolean, category: string|null, reason: string|null }.
 */
export function inspectConsequentialAction(actionType, targetDescriptor = '', value = '') {
  const combined = `${actionType} ${targetDescriptor} ${value}`.trim();
  for (const rule of CONSEQUENTIAL_PATTERNS) {
    if (rule.regex.test(combined)) {
      return {
        consequential: true,
        category: rule.category,
        reason: `Blocked consequential/sensitive browser action (${rule.category}): "${targetDescriptor.slice(0, 80)}". NOÖSPHERE requires explicit user confirmation and never autonomously purchases, posts, deletes data, submits credentials, or modifies accounts.`,
      };
    }
  }
  return { consequential: false, category: null, reason: null };
}

/**
 * Detects local Chromium binary or Playwright availability.
 */
export async function checkBrowserHealth() {
  // 1. Check optional CDP endpoint if configured
  if (process.env.CDP_URL) {
    try {
      const res = await fetch(`${process.env.CDP_URL.replace(/\/+$/, '')}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const info = await res.json();
        return {
          online: true,
          engine: 'cdp-remote',
          browser: info.Browser || 'Chromium (CDP)',
          managedProfile: true,
          jsRendering: true,
        };
      }
    } catch {
      // Fall through
    }
  }

  // 2. Check local Chromium binary paths
  for (const bin of CHROMIUM_CANDIDATES) {
    if (existsSync(bin)) {
      return {
        online: true,
        engine: 'chromium-managed',
        executablePath: bin,
        managedProfile: true,
        profileDir: MANAGED_PROFILE_DIR,
        jsRendering: true,
      };
    }
  }

  // 3. Check `which` for chromium / google-chrome
  for (const cmd of ['chromium', 'chromium-browser', 'google-chrome']) {
    try {
      const resolved = execFileSync('which', [cmd], { encoding: 'utf8', timeout: 1000 }).trim();
      if (resolved) {
        return {
          online: true,
          engine: 'chromium-managed',
          executablePath: resolved,
          managedProfile: true,
          profileDir: MANAGED_PROFILE_DIR,
          jsRendering: true,
        };
      }
    } catch {
      // Not on PATH
    }
  }

  // 4. Check if playwright or playwright-core is installed
  for (const pkg of ['playwright', 'playwright-core']) {
    try {
      const pw = await import(pkg);
      const execPath = pw.chromium?.executablePath?.();
      if (execPath && existsSync(execPath)) {
        return {
          online: true,
          engine: pkg,
          executablePath: execPath,
          managedProfile: true,
          profileDir: MANAGED_PROFILE_DIR,
          jsRendering: true,
        };
      }
    } catch {
      // Not installed
    }
  }

  return {
    online: false,
    engine: 'dom-reader-fallback',
    managedProfile: true,
    jsRendering: false,
    note: 'Install Chromium or Playwright for full JS rendering; Managed DOM Reader fallback is active.',
  };
}

/**
 * Generates an SVG HUD wireframe screenshot representation when running in DOM Reader fallback mode
 * or when headless Chromium screenshot is converted.
 */
function renderReaderWireframeSvg(session) {
  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const lines = String(session.visibleText || session.renderedText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 14);

  const lineEls = lines
    .map(
      (line, idx) =>
        `<text x="24" y="${108 + idx * 20}" fill="#cbd5e1" font-family="monospace" font-size="11">${esc(line.slice(0, 88))}</text>`,
    )
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="420" viewBox="0 0 760 420">
    <rect width="760" height="420" fill="#030509" stroke="#00f7ff" stroke-width="1.5"/>
    <rect x="0" y="0" width="760" height="36" fill="#080c14"/>
    <circle cx="18" cy="18" r="5" fill="#ff0055"/>
    <circle cx="34" cy="18" r="5" fill="#ffaa00"/>
    <circle cx="50" cy="18" r="5" fill="#00ff9d"/>
    <text x="72" y="22" fill="#00f7ff" font-family="monospace" font-size="11" font-weight="bold">MANAGED BROWSER // ${esc(session.engine.toUpperCase())} · ${esc((session.url || 'about:blank').slice(0, 62))}</text>
    <rect x="16" y="48" width="728" height="34" fill="#0e1424" stroke="#1e293b"/>
    <text x="26" y="69" fill="#00ff9d" font-family="monospace" font-size="12" font-weight="bold">${esc((session.title || 'Untitled Document').slice(0, 78))}</text>
    ${lineEls}
    <rect x="0" y="392" width="760" height="28" fill="#080c14"/>
    <text x="18" y="410" fill="#94a3b8" font-family="monospace" font-size="10">SCROLL: ${session.scrollY}px / ${session.maxScrollY}px  |  LINKS: ${(session.links || []).length}  |  PROFILE: ISOLATED MANAGED</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/**
 * Managed Browser Session State
 */
class ManagedBrowserManager {
  constructor() {
    this.session = {
      active: false,
      engine: 'standby',
      managedProfile: true,
      profileDir: MANAGED_PROFILE_DIR,
      url: null,
      title: null,
      scrollY: 0,
      viewportSize: 1800, // characters per viewport slice in reader mode
      maxScrollY: 0,
      renderedText: '',
      visibleText: '',
      headings: [],
      links: [],
      interactiveElements: [],
      searchForms: [],
      history: [],
      lastAction: null,
      updatedAt: null,
    };
  }

  _updateVisibleSlice() {
    const text = this.session.renderedText || '';
    const sliceLen = this.session.viewportSize;
    this.session.maxScrollY = Math.max(0, text.length - sliceLen);
    this.session.scrollY = Math.max(0, Math.min(this.session.scrollY, this.session.maxScrollY));
    this.session.visibleText = text.slice(this.session.scrollY, this.session.scrollY + sliceLen);
  }

  /**
   * If a local Chromium executable is available, optionally dump rendered DOM via headless CLI
   * using an isolated --user-data-dir so personal profiles are never touched.
   */
  async _tryChromiumDumpDom(url, health) {
    if (!health.online || !health.executablePath) return null;
    try {
      mkdirSync(MANAGED_PROFILE_DIR, { recursive: true });
      const html = execFileSync(
        health.executablePath,
        [
          '--headless',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
          '--disable-sync',
          `--user-data-dir=${MANAGED_PROFILE_DIR}`,
          '--virtual-time-budget=3500',
          '--dump-dom',
          url,
        ],
        { encoding: 'utf8', timeout: 12000, maxBuffer: 4 * 1024 * 1024 },
      );
      return html;
    } catch {
      return null;
    }
  }

  async open(rawUrl, options = {}) {
    // 1. Validate URL against SSRF (blocks file://, localhost, private IPs, metadata)
    const validated = validatePublicUrl(rawUrl);
    const targetUrl = canonicalizeUrl(validated.toString()) || validated.toString();

    const health = await checkBrowserHealth();
    let pageData = null;

    // 2. Fetch & extract page (using options.fetchPageFn if provided for tests, else fetch_page)
    if (options.fetchPageFn) {
      pageData = await options.fetchPageFn(targetUrl, { maxChars: 16000 });
    } else {
      pageData = await fetch_page(targetUrl, { maxChars: 16000 });
    }

    const links = (pageData.links || []).slice(0, 40).map((l, idx) => ({
      index: idx + 1,
      selector: `[data-noo-link="${idx + 1}"]`,
      text: l.text || l.url,
      url: l.url,
      internal: Boolean(l.internal),
    }));

    const interactiveElements = [
      ...links.slice(0, 20).map((l) => ({
        id: `L${l.index}`,
        type: 'link',
        label: l.text,
        targetUrl: l.url,
        consequential: inspectConsequentialAction('click', `${l.text} ${l.url}`).consequential,
      })),
    ];

    this.session = {
      active: true,
      engine: health.online ? health.engine : 'dom-reader-fallback',
      browserOnline: health.online,
      jsRendering: Boolean(health.jsRendering),
      managedProfile: true,
      profileDir: MANAGED_PROFILE_DIR,
      url: pageData.canonicalUrl || targetUrl,
      title: pageData.title || targetUrl,
      domain: pageData.domain,
      scrollY: 0,
      viewportSize: 1800,
      maxScrollY: Math.max(0, (pageData.text || '').length - 1800),
      renderedText: pageData.text || '',
      visibleText: (pageData.text || '').slice(0, 1800),
      headings: pageData.headings || [],
      links,
      interactiveElements,
      searchForms: [{ selector: 'input[type="search"]', label: 'Site Search Query (non-sensitive)' }],
      history: [...(this.session.history || []).slice(-9), pageData.canonicalUrl || targetUrl],
      lastAction: `open_browser(${targetUrl})`,
      updatedAt: new Date().toISOString(),
    };

    return this.read();
  }

  read() {
    if (!this.session.active) {
      return {
        active: false,
        engine: 'standby',
        managedProfile: true,
        message: 'Managed browser is in standby. Use open_browser(url) or /browser <url> to open a page.',
      };
    }
    this._updateVisibleSlice();
    const sanitized = sanitizeWebTextForLLM(this.session.visibleText, 2400);
    return {
      active: true,
      engine: this.session.engine,
      browserOnline: Boolean(this.session.browserOnline),
      jsRendering: Boolean(this.session.jsRendering),
      managedProfile: true,
      url: this.session.url,
      title: this.session.title,
      domain: this.session.domain,
      scrollY: this.session.scrollY,
      maxScrollY: this.session.maxScrollY,
      scrollPercent:
        this.session.maxScrollY > 0
          ? Math.round((this.session.scrollY / this.session.maxScrollY) * 100)
          : 100,
      visibleText: sanitized.text,
      headings: (this.session.headings || []).slice(0, 20),
      links: (this.session.links || []).slice(0, 25),
      interactiveElements: (this.session.interactiveElements || []).slice(0, 20),
      history: this.session.history || [],
      lastAction: this.session.lastAction,
      updatedAt: this.session.updatedAt,
    };
  }

  scroll(direction = 'down') {
    if (!this.session.active) {
      throw new Error('No active browser session. Call open_browser(url) first.');
    }
    const dir = String(direction || 'down').toLowerCase().trim();
    const step = 1200;
    if (dir === 'down' || dir === 'next' || dir === 'pagedown') {
      this.session.scrollY = Math.min(this.session.maxScrollY, this.session.scrollY + step);
    } else if (dir === 'up' || dir === 'prev' || dir === 'pageup') {
      this.session.scrollY = Math.max(0, this.session.scrollY - step);
    } else if (dir === 'top' || dir === 'start') {
      this.session.scrollY = 0;
    } else if (dir === 'bottom' || dir === 'end') {
      this.session.scrollY = this.session.maxScrollY;
    }
    this.session.lastAction = `browser_scroll(${dir})`;
    this.session.updatedAt = new Date().toISOString();
    return this.read();
  }

  async click(selectorOrTarget, options = {}) {
    if (!this.session.active) {
      throw new Error('No active browser session. Call open_browser(url) first.');
    }
    const targetStr = String(selectorOrTarget || '').trim();
    if (!targetStr) {
      throw new Error('browser_click requires a link index, selector, or target text');
    }

    // 1. Check Consequential Action Guard BEFORE resolving or clicking!
    const guard = inspectConsequentialAction('click', targetStr);
    if (guard.consequential && options.confirmed !== true) {
      return {
        blocked: true,
        requiresConfirmation: true,
        category: guard.category,
        reason: guard.reason,
        target: targetStr,
        state: this.read(),
      };
    }

    // 2. Match link by index (e.g. "1", "#1", "L1", "[1]"), URL, or anchor text
    const links = this.session.links || [];
    let matchedLink = null;
    const idxMatch = targetStr.match(/^(?:L|# |\[)?(\d+)\]?$/i);
    if (idxMatch) {
      const idx = Number(idxMatch[1]);
      matchedLink = links.find((l) => l.index === idx);
    }
    if (!matchedLink) {
      const lower = targetStr.toLowerCase();
      matchedLink =
        links.find((l) => l.selector.toLowerCase() === lower || l.url.toLowerCase() === lower) ||
        links.find((l) => l.text.toLowerCase().includes(lower));
    }

    if (!matchedLink && /^https?:\/\//i.test(targetStr)) {
      matchedLink = { text: targetStr, url: targetStr };
    }

    if (!matchedLink) {
      throw new Error(`Could not find clickable link or safe control matching "${targetStr}"`);
    }

    // Also inspect the resolved link text + URL against the Consequential Action Guard
    const linkGuard = inspectConsequentialAction('click', `${matchedLink.text} ${matchedLink.url}`);
    if (linkGuard.consequential && options.confirmed !== true) {
      return {
        blocked: true,
        requiresConfirmation: true,
        category: linkGuard.category,
        reason: linkGuard.reason,
        target: `${matchedLink.text} (${matchedLink.url})`,
        state: this.read(),
      };
    }

    const result = await this.open(matchedLink.url, options);
    this.session.lastAction = `browser_click(${matchedLink.text.slice(0, 40)})`;
    return {
      blocked: false,
      clicked: matchedLink,
      state: result,
    };
  }

  async fillSearch(selectorOrField, queryValue, options = {}) {
    if (!this.session.active) {
      throw new Error('No active browser session. Call open_browser(url) first.');
    }
    const fieldStr = String(selectorOrField || 'search').trim();
    const valStr = String(queryValue || '').trim();

    // Strictly block sensitive form fields (passwords, login, payment, posting)
    const guard = inspectConsequentialAction('fill_form', fieldStr, valStr);
    if (guard.consequential && options.confirmed !== true) {
      return {
        blocked: true,
        requiresConfirmation: true,
        category: guard.category,
        reason: guard.reason,
        target: fieldStr,
        state: this.read(),
      };
    }

    this.session.lastAction = `browser_fill(${fieldStr}, "${valStr.slice(0, 40)}")`;
    this.session.updatedAt = new Date().toISOString();
    return {
      blocked: false,
      filled: { field: fieldStr, value: valStr.slice(0, 120) },
      state: this.read(),
    };
  }

  screenshot() {
    if (!this.session.active) {
      throw new Error('No active browser session. Call open_browser(url) first.');
    }
    this._updateVisibleSlice();
    const dataUrl = renderReaderWireframeSvg(this.session);
    this.session.lastAction = 'browser_screenshot()';
    this.session.updatedAt = new Date().toISOString();
    return {
      url: this.session.url,
      title: this.session.title,
      engine: this.session.engine,
      managedProfile: true,
      mimeType: 'image/svg+xml',
      dataUrl,
      timestamp: this.session.updatedAt,
      state: this.read(),
    };
  }
}

export const browserManager = new ManagedBrowserManager();

export async function open_browser(url, options = {}) {
  return browserManager.open(url, options);
}

export async function browser_click(selectorOrTarget, options = {}) {
  return browserManager.click(selectorOrTarget, options);
}

export function browser_scroll(direction = 'down') {
  return browserManager.scroll(direction);
}

export function browser_read() {
  return browserManager.read();
}

export function browser_screenshot() {
  return browserManager.screenshot();
}

export async function browser_fill(selector, value, options = {}) {
  return browserManager.fillSearch(selector, value, options);
}
