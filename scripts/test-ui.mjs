#!/usr/bin/env node
/**
 * NOÖSPHERE // OS — SYNAPSE SHELL browser-side tests
 * ============================================================
 * The shell window has one non-negotiable failure contract:
 *
 *   **If the PTY bridge is missing, remote, or broken, NOÖSPHERE still boots
 *   and the window says `SYNAPSE SHELL // OFFLINE` instead of throwing.**
 *
 * That contract is about the browser half, so it is tested in a real DOM
 * (jsdom) rather than a real PTY: the module is fed a stubbed `fetch`, xterm is
 * replaced by a recording stub, and the four reachable states are asserted.
 *
 *   · static host / no bridge      → SHELL UNAVAILABLE // BRIDGE UNREACHABLE
 *   · remote client (403 gate)     → SHELL UNAVAILABLE
 *   · local server, PTY absent     → LOCAL PTY UNAVAILABLE (reason shown)
 *   · local server, PTY present    → console renders, socket attaches, input flows
 *
 * Requires the dev-only `jsdom` dependency (`npm install`); without it the
 * suite prints a skip notice and exits 0 so `npm test` stays usable offline.
 *
 * Usage: node scripts/test-ui.mjs [--verbose]
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const require = createRequire(import.meta.url);

let jsdom = null;
try {
  jsdom = require('jsdom');
} catch {
  console.log('\n  SYNAPSE SHELL browser tests — SKIPPED (jsdom is not installed)');
  console.log('  run `npm install` to include them; they are dev-only\n');
  process.exit(0);
}

const { JSDOM, VirtualConsole } = jsdom;

const state = { passed: 0, failed: 0, failures: [] };
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const test = async (name, fn) => {
  try {
    await fn();
    state.passed += 1;
    console.log(`  ✔ ${name}`);
  } catch (error) {
    state.failed += 1;
    state.failures.push({ name, message: error.message });
    console.log(`  ✘ ${name}\n      ${error.message}`);
  }
};

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */
const CORPUS_SOURCE = readFileSync(join(ROOT, 'data', 'zaziopath-graph.js'), 'utf8')
  // Keep any source excerpt from terminating the injected script element.
  .replace(/<\/script/gi, '<\\/script');
const PAGE = readFileSync(join(ROOT, 'index.html'), 'utf8')
  // The CDN scripts are meaningless in jsdom and would only add noise; the shell
  // module is loaded exactly as the browser loads it (deferred, external).
  .replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, '')
  .replace(/<script src="https:\/\/unpkg\.com\/lucide@latest"><\/script>/, '')
  .replace(/<link[^>]*fonts\.googleapis[^>]*>/g, '')
  .replace(/<link[^>]*shell\/synapse-shell\.css[^>]*>/, '')
  .replace(/<script src="shell\/synapse-shell\.js" defer><\/script>/, '')
  .replace('<script src="data/zaziopath-graph.js"></script>', `<script>${CORPUS_SOURCE}</script>`);

const SHELL_SOURCE = readFileSync(join(ROOT, 'shell', 'synapse-shell.js'), 'utf8');

const statusOk = (overrides = {}) => ({
  available: true,
  reason: 'ready',
  shell: '/bin/zsh',
  platform: 'darwin',
  node: 'v22',
  cwd: '/Users/zazie/Prometheus-Noosphere-v9.4',
  ai: { mode: 'off', limits: { maxSteps: 12, maxRuntimeMs: 300_000, stopOnError: false, cwd: '/Users/zazie/Zaziopath' } },
  sessions: [],
  model: { name: 'llama3.1:8b', available: true, tools: [] },
  expose: { localOnly: true, remoteToken: false },
  ...overrides,
});

/** Boot the page with a stubbed transport and return the window. */
const boot = async ({ fetchImpl, withTerminal = false }) => {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    // jsdom ships no canvas backend and no CDN, so the graph engine and the
    // Tailwind/Lucide tags always fail here. Those failures are environmental
    // and unrelated to the shell window; everything else is a real defect.
    if (!/canvas|clearRect|getContext|tailwind|lucide/i.test(error.message)) errors.push(error.message);
  });

  const dom = new JSDOM(PAGE, { runScripts: 'dangerously', virtualConsole });
  const { window } = dom;
  window.fetch = fetchImpl;
  window.playBeep = () => {};
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.navigator.clipboard = { writeText: async () => {}, readText: async () => '' };
  window.sockets = [];

  if (withTerminal) {
    class FakeFitAddon {
      fit() {
        this.term.cols = 120;
        this.term.rows = 34;
        this.term.resizeCallback?.({ cols: 120, rows: 34 });
      }
    }
    class FakeTerminal {
      constructor(options) {
        this.options = options;
        this.cols = 80;
        this.rows = 24;
        this.written = '';
        this.buffer = { active: { length: 0, getLine: () => null } };
      }
      loadAddon(addon) { if (addon) addon.term = this; }
      open(element) { this.element = element; }
      write(data) { this.written += data; }
      onData(callback) { this.dataCallback = callback; }
      onResize(callback) { this.resizeCallback = callback; }
      attachCustomKeyEventHandler() {}
      focus() { this.focused = true; }
      clear() { this.cleared = true; }
      getSelection() { return ''; }
      dispose() { this.disposed = true; }
    }
    class FakeSocket {
      constructor(url) {
        this.url = url;
        this.sent = [];
        this.readyState = 1;
        window.sockets.push(this);
        setTimeout(() => this.onmessage?.({
          data: JSON.stringify({ t: 'ready', session: { id: 'pty-01', label: 'SHELL 01', pid: 4242, cols: 100, rows: 30, cwd: '/Users/zazie/Zaziopath', exited: false }, ai: { mode: 'off', limits: {} } }),
        }), 5);
      }
      send(payload) { this.sent.push(JSON.parse(payload)); }
      close() { this.readyState = 3; }
    }
    window.Terminal = FakeTerminal;
    window.FitAddon = { FitAddon: FakeFitAddon };
    window.WebSocket = FakeSocket;
  }

  new window.Function(SHELL_SOURCE).call(window);
  await new Promise((r) => setTimeout(r, 250));
  return { dom, window, errors };
};

const rootText = (window) => window.document.getElementById('shell-root').textContent.replace(/\s+/g, ' ');

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */
console.log('\n  NOÖSPHERE // OS — SYNAPSE SHELL browser tests');
console.log('  ────────────────────────────────────────────────────────────');

await test('static host (no bridge): the desktop still boots and the window says OFFLINE', async () => {
  const { dom, window, errors } = await boot({ fetchImpl: () => Promise.reject(new Error('no bridge')) });
  const text = rootText(window);
  check(/SHELL UNAVAILABLE/.test(text), 'no offline panel rendered');
  check(/BRIDGE UNREACHABLE/.test(text), 'missing diagnostic for an absent bridge');
  check(window.document.getElementById('shell-mode-badge').textContent.includes('OFFLINE'), 'dock badge did not report OFFLINE');
  check(typeof window.synapseShell === 'object', 'the shell engine was not exposed');
  check(errors.length === 0, `unexpected page errors: ${errors.join(' | ')}`);
  dom.window.close();
});

await test('remote client (403 from the gate): SHELL UNAVAILABLE, no websocket attempted', async () => {
  let sockets = 0;
  const { dom, window, errors } = await boot({
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: 'Local access only', reason: 'host-not-loopback' }),
    }),
    withTerminal: true,
  });
  window.WebSocket = class { constructor() { sockets += 1; } };
  const text = rootText(window);
  check(/SHELL UNAVAILABLE/.test(text), 'no unavailable panel rendered');
  check(/not running on the machine that hosts NOÖSPHERE/.test(text), 'the reason was not explained');
  check(sockets === 0, 'a PTY socket was opened despite the gate refusing');
  check(errors.length === 0, `unexpected page errors: ${errors.join(' | ')}`);
  dom.window.close();
});

await test('local server without a PTY: reason is surfaced verbatim', async () => {
  const reason = 'node-pty unavailable (Cannot find module) — run `npm install` in the repository root';
  const { dom, window, errors } = await boot({
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(statusOk({ available: false, reason })) }),
  });
  const text = rootText(window);
  check(/LOCAL PTY UNAVAILABLE/.test(text), 'no degraded-mode panel');
  check(text.includes('node-pty unavailable'), 'the server reason was not shown');
  check(errors.length === 0, `unexpected page errors: ${errors.join(' | ')}`);
  dom.window.close();
});

await test('live bridge: console renders, session attaches, input and modes flow', async () => {
  const calls = [];
  const known = new Map();
  const session = { id: 'pty-01', label: 'SHELL 01', pid: 4242, cols: 100, rows: 30, cwd: '/Users/zazie/Zaziopath', exited: false, attached: 0 };
  known.set(session.id, session);

  const { dom, window, errors } = await boot({
    withTerminal: true,
    fetchImpl: async (path, options = {}) => {
      calls.push({ path, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : null });
      const ok = (payload) => ({ ok: true, status: 200, text: async () => JSON.stringify(payload) });
      if (path === '/api/shell/status') return ok(statusOk({ shell: '/bin/zsh', ai: { mode: 'assist', limits: { maxSteps: 12, maxRuntimeMs: 300_000, stopOnError: false, cwd: '/Users/zazie/Zaziopath' } } }));
      if (path === '/api/shell/sessions' && (options.method ?? 'GET') === 'GET') return ok({ sessions: [...known.values()], ai: { mode: 'assist', limits: {} } });
      if (path === '/api/shell/sessions' && options.method === 'POST') return ok({ session });
      if (path === '/api/shell/ai') return ok({ ok: true, mode: 'autonomous', limits: { maxSteps: 12, maxRuntimeMs: 300_000, stopOnError: false, cwd: '/Users/zazie/Zaziopath' } });
      if (path === '/api/shell/processes') return ok({ total: 400, owned: [{ pid: 4243, ppid: 4242, cpu: 0, mem: 0, elapsed: '00:03', command: '/bin/zsh', sessionId: 'pty-01' }], ownPids: [4243] });
      return ok({ ok: true });
    },
  });

  const { document } = window;
  const strip = document.querySelector('.ns-strip').textContent.replace(/\s+/g, ' ');
  check(/HOST \/\/ LOCAL/.test(strip), `strip missing host (${strip})`);
  check(/SHELL \/\/ \/bin\/zsh/.test(strip), 'strip missing shell');
  check(/PID \/\/ 4242/.test(strip), `strip missing pid (${strip})`);
  check(/CWD \/\/ \/Users\/zazie\/Zaziopath/.test(strip), `strip missing cwd (${strip})`);
  check(/AI SHELL CONTROL ● ASSIST/.test(strip), `strip missing AI mode (${strip})`);

  const tabs = [...document.querySelectorAll('.ns-tab')].map((tab) => tab.textContent);
  check(tabs.some((label) => label.includes('SHELL 01')), `no session tab (${tabs.join('|')})`);
  check(tabs.some((label) => label.includes('+ SHELL')), 'no new-shell affordance');

  const actions = [...document.querySelectorAll('.ns-quick .ns-btn')].map((button) => button.textContent);
  for (const required of ['NEW SHELL', 'RESTART', 'CLEAR', 'INTERRUPT ^C', 'KILL PROCESS', 'COPY OUTPUT', 'SAVE SESSION', 'AI: OFF', 'AI ASSIST', 'AI AUTONOMOUS']) {
    check(actions.includes(required), `quick action missing: ${required}`);
  }

  const socket = window.sockets[0];
  check(socket && /\/ws\/shell\?session=pty-01/.test(socket.url), `socket url ${socket?.url}`);
  const term = window.synapseShell.sessions.get('pty-01')?.term;
  check(term && /noosphere:\/\/shell 01/.test(term.written), 'no banner written to the terminal');
  check(socket.sent.some((frame) => frame.t === 'resize' && frame.cols === 120), `terminal did not report its fitted size (${JSON.stringify(socket.sent)})`);

  term.dataCallback('ls -la\r');
  check(socket.sent.at(-1)?.t === 'input' && socket.sent.at(-1).data === 'ls -la\r', 'keystrokes did not reach the socket');

  const autonomous = actions.includes('AI AUTONOMOUS') && [...document.querySelectorAll('.ns-quick .ns-btn')].find((button) => button.textContent === 'AI AUTONOMOUS');
  autonomous.click();
  await new Promise((r) => setTimeout(r, 30));
  check(window.synapseShell.mode === 'autonomous', `mode did not change (${window.synapseShell.mode})`);
  check(document.querySelector('.ns-mode').dataset.mode === 'autonomous', 'the mode badge did not become AUTONOMOUS');
  check(calls.some((call) => call.path === '/api/shell/ai' && call.body?.mode === 'autonomous'), 'the mode change never reached the server');

  document.querySelector('[data-act="proc"]').click();
  await new Promise((r) => setTimeout(r, 40));
  const panel = document.querySelector('.ns-panel').textContent.replace(/\s+/g, ' ');
  check(/PROCESSES SPAWNED THROUGH NOÖSPHERE/.test(panel), `process panel did not render (${panel.slice(0, 90)})`);
  check(/\/bin\/zsh/.test(panel), 'process panel omitted the owned process');

  check(errors.length === 0, `unexpected page errors: ${errors.join(' | ')}`);
  dom.window.close();
});

await test('the shell window is docked and grabbable like every other panel', async () => {
  const { dom, window } = await boot({ fetchImpl: () => Promise.reject(new Error('no bridge')) });
  const { document } = window;
  const win = document.getElementById('win-shell');
  check(Boolean(win), 'no #win-shell window in the document');
  check(win.classList.contains('glass-panel'), 'the window is not a glass panel (drag/stacking contract)');
  check(Boolean(win.querySelector('.win-header')), 'the window has no drag handle');
  check(Boolean(document.getElementById('shell-root')), 'the window has no host element for the terminal');
  const dock = [...document.querySelectorAll('[onclick="restoreOrFocus(\'win-shell\')"]')];
  check(dock.length > 0, 'the window is not reachable from the dock');
  dom.window.close();
});

console.log('  ────────────────────────────────────────────────────────────');
console.log(`  ${state.failed === 0 ? '✔ PASS' : '✘ FAIL'} — ${state.passed} passed, ${state.failed} failed`);
if (state.failed) for (const failure of state.failures) console.log(`   ✗ ${failure.name}: ${failure.message}`);
console.log('');
process.exit(state.failed === 0 ? 0 : 1);
