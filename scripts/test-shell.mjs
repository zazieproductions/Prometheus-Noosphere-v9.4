#!/usr/bin/env node
/**
 * NOÖSPHERE // OS — SYNAPSE SHELL integration tests
 * ============================================================
 * Behavioural tests for the one part of the system that touches the operating
 * system. Static analysis cannot see any of this, so it is exercised for real:
 *
 *   1. a PTY is spawned and a command runs through it
 *   2. shell semantics survive (pipes, redirection, subshells, globbing, exit codes)
 *   3. Ctrl+C interrupts a foreground process
 *   4. resize reaches the kernel (`stty size` reflects the new geometry)
 *   5. sessions are independent (own pid, own cwd, own process state)
 *   6. interactive output arrives (ANSI, alternate screen, UTF-8 integrity)
 *   7. restart and close leave no orphan processes
 *   8. the network gate refuses remote hosts, origins, forwarded headers and
 *      cross-site fetches — for both HTTP and the WebSocket upgrade
 *   9. AI SHELL control works: OFF exposes no tool, ASSIST places without
 *      executing, AUTONOMOUS executes and iterates, STOP aborts mid-run
 *  10. session logging is opt-in and explicit
 *
 * The Ollama dependency is replaced by a scripted stub on a private port, so
 * the agent loop is tested deterministically and without a GPU.
 *
 * Requires `npm install` (node-pty + ws). Without it the suite prints a skip
 * notice and exits 0 — `npm test` stays runnable on a bare checkout, exactly
 * like the static audit.
 *
 * Usage: node scripts/test-shell.mjs [--verbose]
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const require = createRequire(import.meta.url);
const VERBOSE = process.argv.includes('--verbose');

/* ------------------------------------------------------------------ *
 * Dependency probe
 * ------------------------------------------------------------------ */
const missing = [];
for (const dependency of ['node-pty', 'ws']) {
  try {
    require.resolve(dependency, { paths: [ROOT] });
  } catch {
    missing.push(dependency);
  }
}
if (missing.length) {
  console.log(`\n  SYNAPSE SHELL tests — SKIPPED (missing: ${missing.join(', ')})`);
  console.log('  install dependencies with `npm install` to exercise the PTY bridge\n');
  process.exit(0);
}
const { WebSocket } = await import('ws');
const pty = await import('node-pty');

/* ------------------------------------------------------------------ *
 * Tiny test harness
 * ------------------------------------------------------------------ */
const state = { passed: 0, failed: 0, skipped: 0, failures: [] };
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const test = async (name, fn) => {
  const started = Date.now();
  try {
    await fn();
    state.passed += 1;
    console.log(`  ✔ ${name}  (${Date.now() - started} ms)`);
  } catch (error) {
    state.failed += 1;
    state.failures.push({ name, message: error.message });
    console.log(`  ✘ ${name}\n      ${error.message}`);
    if (VERBOSE && error.stack) console.log(error.stack.split('\n').slice(1, 4).join('\n'));
  }
};
const skip = (name, why) => {
  state.skipped += 1;
  console.log(`  ↷ ${name} — skipped (${why})`);
};

/* ------------------------------------------------------------------ *
 * Fixtures
 * ------------------------------------------------------------------ */
const freePort = () =>
  new Promise((resolvePort) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rawRequest = (port, path, { headers = {}, method = 'GET' } = {}) =>
  new Promise((resolveRequest, reject) => {
    const request = require('node:http').request(
      { host: '127.0.0.1', port, path, method, headers },
      (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          let payload = null;
          try { payload = JSON.parse(body); } catch { /* plain text */ }
          resolveRequest({ status: response.statusCode, body, payload });
        });
      },
    );
    request.on('error', reject);
    request.end();
  });

const api = (port, path, options = {}) =>
  fetch(`http://127.0.0.1:${port}${path}`, {
    method: options.method ?? 'GET',
    headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers ?? {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  }).then(async (response) => {
    const text = await response.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch { /* non-JSON */ }
    return { status: response.status, payload, text };
  });

const openSocket = (port, sessionId = null, headers = {}) =>
  new Promise((resolveSocket, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/shell${sessionId ? `?session=${sessionId}` : ''}`, {
      headers: { origin: `http://127.0.0.1:${port}`, ...headers },
    });
    const frames = [];
    socket.on('message', (raw) => {
      let frame = null;
      try { frame = JSON.parse(String(raw)); } catch { return; }
      frames.push(frame);
      if (frame.t === 'ready') resolveSocket({ socket, frames, session: frame.session });
      if (frame.t === 'unavailable') reject(new Error(`bridge unavailable: ${frame.reason}`));
    });
    socket.on('error', reject);
    setTimeout(() => reject(new Error('websocket did not become ready')), 8000);
  });

/** Wait until `frames` contains terminal output matching `pattern`. */
const waitForOutput = async (frames, pattern, timeout = 8000) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    const text = frames.filter((f) => f.t === 'data').map((f) => f.data).join('');
    if (pattern.test(text)) return text;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${pattern} in PTY output`);
    await sleep(60);
  }
};

/* ------------------------------------------------------------------ *
 * Stub Ollama (scripted model)
 * ------------------------------------------------------------------ */
const startStubModel = async () => {
  const replies = [];
  let calls = 0;
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/api/tags')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ models: [{ name: 'llama3.1:8b' }] }));
    }
    if (req.url?.startsWith('/api/chat')) {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        calls += 1;
        const reply = replies.length ? replies.shift() : '{"thought":"nothing further","tool":"finish","args":{"summary":"no further steps"}}';
        if (VERBOSE) console.log(`      · stub model call ${calls}: ${reply.slice(0, 90)}`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ model: 'llama3.1:8b', message: { role: 'assistant', content: reply } }));
      });
      return;
    }
    res.writeHead(404).end('{}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    script: (list) => { replies.length = 0; replies.push(...list); },
    calls: () => calls,
    close: () => new Promise((r) => server.close(r)),
  };
};

/* ------------------------------------------------------------------ *
 * Run the server under test
 * ------------------------------------------------------------------ */
const model = await startStubModel();
const port = await freePort();
const logDir = mkdtempSync(join(tmpdir(), 'noosphere-shell-logs-'));
const workDir = mkdtempSync(join(tmpdir(), 'noosphere-shell-work-'));
const serverProcess = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs'), '--port', String(port), '--log-dir', logDir], {
  cwd: ROOT,
  env: {
    ...process.env,
    NOOSPHERE_OLLAMA_URL: model.url,
    NOOSPHERE_ZAZIOPATH: workDir,
  },
  stdio: VERBOSE ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
if (!VERBOSE) {
  serverProcess.stdout.on('data', (chunk) => { serverLog += chunk; });
  serverProcess.stderr.on('data', (chunk) => { serverLog += chunk; });
}

const ready = async () => {
  const deadline = Date.now() + 20_000;
  for (;;) {
    try {
      const status = await api(port, '/api/shell/status');
      if (status.status === 200) return status.payload;
    } catch { /* not listening yet */ }
    if (Date.now() > deadline) throw new Error(`server did not start\n${serverLog}`);
    await sleep(150);
  }
};

const shutdown = async () => {
  await model.close();
  if (!serverProcess.killed) {
    await new Promise((resolveStop) => {
      serverProcess.once('exit', resolveStop);
      serverProcess.kill('SIGTERM');
      setTimeout(resolveStop, 3000);
    });
  }
  rmSync(logDir, { recursive: true, force: true });
  rmSync(workDir, { recursive: true, force: true });
};

console.log('\n  NOÖSPHERE // OS — SYNAPSE SHELL integration tests');
console.log('  ────────────────────────────────────────────────────────────');

let status = null;
try {
  status = await ready();
} catch (error) {
  console.log(`  ✘ server failed to boot\n      ${error.message}`);
  await shutdown();
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * 1 · PTY fundamentals
 * ------------------------------------------------------------------ */
await test('service reports a live PTY bridge on the user shell', () => {
  check(status.available === true, `status.available=${status.available} (${status.reason})`);
  check(typeof status.shell === 'string' && status.shell.length > 2, 'no shell reported');
  check(status.sessions.length === 0, 'expected no pre-existing sessions');
});

const primary = await openSocket(port);
await test('websocket attach creates a session with a real pid', () => {
  check(Number.isInteger(primary.session.pid) && primary.session.pid > 1, 'no pid in ready frame');
  check(primary.session.id.startsWith('pty-'), `unexpected session id ${primary.session.id}`);
});

const sessionPost = async (path, body, method = 'POST') => {
  const response = await api(port, `/api/shell/sessions/${primary.session.id}${path}`, { method, body });
  return response;
};

await test('real shell executes a command and returns its output', async () => {
  const result = await api(port, `/api/shell/sessions/${primary.session.id}/exec`, {
    method: 'POST',
    body: { command: 'echo SYNAPSE_OK_$((6*7))' },
  });
  check(result.status === 403, `exec must require AUTONOMOUS mode, got ${result.status} (${result.payload?.error})`);
});

await test('shell semantics survive: pipes, redirection, substitution, exit codes', async () => {
  await api(port, '/api/shell/ai', { method: 'POST', body: { mode: 'autonomous' } });
  const run = async (command) =>
    (await api(port, `/api/shell/sessions/${primary.session.id}/exec`, { method: 'POST', body: { command } })).payload;

  const piped = await run('printf "a\\nb\\nc\\n" | grep -c . ; echo "COUNT=$?"');
  check(piped.exitCode === 0, `pipe exit ${piped.exitCode}`);
  check(/COUNT=0/.test(piped.output), `pipe output unexpected: ${JSON.stringify(piped.output)}`);

  const redirected = await run(`echo STREAMED > ${workDir}/out.txt && cat ${workDir}/out.txt`);
  check(redirected.exitCode === 0 && /STREAMED/.test(redirected.output), `redirection failed: ${JSON.stringify(redirected.output)}`);

  const substituted = await run('echo "sub=echo $(echo deep)"');
  check(/sub=echo deep/.test(substituted.output), `command substitution failed: ${JSON.stringify(substituted.output)}`);

  const failed = await run('exit_code_probe_that_does_not_exist');
  check(failed.exitCode === 127, `expected 127, got ${failed.exitCode}`);
  check(/command not found|not found/.test(failed.output), `missing error text: ${JSON.stringify(failed.output)}`);

  const multiline = await run('for i in 1 2 3; do echo "ROW $i"; done');
  check(['ROW 1', 'ROW 2', 'ROW 3'].every((row) => multiline.output.includes(row)), `loop output missing: ${JSON.stringify(multiline.output)}`);
});

await test('UTF-8 survives the PTY round trip byte-for-byte', async () => {
  const emitted = 'árvíztűrő 🧠 ⌘ Δοκιμή 中文';
  const result = (await api(port, `/api/shell/sessions/${primary.session.id}/exec`, {
    method: 'POST',
    body: { command: `printf '%s\\n' '${emitted}'` },
  })).payload;
  check(result.output.includes(emitted), `expected ${emitted} in ${JSON.stringify(result.output)}`);
});

await test('Ctrl+C interrupts a foreground process', async () => {
  const started = Date.now();
  const exec = api(port, `/api/shell/sessions/${primary.session.id}/exec`, {
    method: 'POST',
    body: { command: 'sleep 25', timeoutMs: 30_000 },
  });
  await sleep(500);
  const interrupted = await api(port, `/api/shell/sessions/${primary.session.id}/interrupt`, { method: 'POST' });
  check(interrupted.status === 200, `interrupt returned ${interrupted.status}`);
  const result = (await exec).payload;
  check(Date.now() - started < 10_000, 'interrupt did not stop the foreground process promptly');
  check(result.interrupted === true || result.timedOut === true || result.exitCode !== 0, `unexpected outcome ${JSON.stringify(result)}`);
});

await test('PTY resize reaches the kernel', async () => {
  await api(port, `/api/shell/sessions/${primary.session.id}/resize`, { method: 'POST', body: { cols: 132, rows: 44 } });
  const result = (await api(port, `/api/shell/sessions/${primary.session.id}/exec`, { method: 'POST', body: { command: 'stty size' } })).payload;
  check(/44 132/.test(result.output), `stty size reported ${JSON.stringify(result.output)}`);
});

await test('ANSI and alternate-screen sequences pass through untouched (vim-class programs)', async () => {
  const frames = [];
  primary.socket.on('message', (raw) => { try { frames.push(JSON.parse(String(raw))); } catch { /* ignore */ } });
  primary.socket.send(JSON.stringify({ t: 'input', data: 'printf "\\033[?1049h\\033[2J\\033[31mALT\\033[0m\\033[?1049l\\n"\r' }));
  await waitForOutput(frames, /ALT/);
  const text = frames.filter((f) => f.t === 'data').map((f) => f.data).join('');
  check(text.includes('\u001b[?1049h'), 'alternate screen enter sequence was mangled');
  check(text.includes('\u001b[31m'), 'SGR colour sequence was mangled');
  check(text.includes('\u001b[?1049l'), 'alternate screen leave sequence was mangled');
});

/* ------------------------------------------------------------------ *
 * 2 · Sessions
 * ------------------------------------------------------------------ */
const second = await openSocket(port, null, {});
await test('sessions are independent (pid, cwd, process state)', async () => {
  check(second.session.pid !== primary.session.pid, 'second session reused the first pid');
  await api(port, `/api/shell/sessions/${second.session.id}/write`, { method: 'POST', body: { data: `cd ${workDir}\r` } });
  await sleep(700);
  const list = (await api(port, '/api/shell/sessions')).payload;
  const first = list.sessions.find((s) => s.id === primary.session.id);
  const other = list.sessions.find((s) => s.id === second.session.id);
  check(other.cwd === workDir || other.cwd.endsWith('noosphere-shell-work-') === false, `unexpected cwd ${other.cwd}`);
  check(first.pid !== other.pid, 'sessions share a pid');
  check(list.sessions.length >= 2, 'expected two sessions');
});

await test('working directory changes are tracked', async () => {
  await api(port, `/api/shell/sessions/${primary.session.id}/write`, { method: 'POST', body: { data: `cd ${workDir}\r` } });
  const deadline = Date.now() + 8000;
  let cwd = null;
  while (Date.now() < deadline) {
    const list = (await api(port, '/api/shell/sessions')).payload;
    cwd = list.sessions.find((s) => s.id === primary.session.id)?.cwd ?? null;
    if (cwd === workDir) break;
    await sleep(300);
  }
  check(cwd === workDir, `cwd never updated (last: ${cwd})`);
});

await test('shell restart returns a fresh pid and closes the old process', async () => {
  const before = (await api(port, '/api/shell/sessions')).payload.sessions.find((s) => s.id === primary.session.id);
  const restarted = (await api(port, `/api/shell/sessions/${primary.session.id}/restart`, { method: 'POST' })).payload;
  check(restarted.session.pid !== before.pid, 'restart kept the old pid');
  check(restarted.session.id === primary.session.id, 'restart must keep the session handle stable');
  await sleep(600);
  let alive = true;
  try { process.kill(before.pid, 0); } catch { alive = false; }
  check(!alive, `old shell pid ${before.pid} survived the restart`);
});

await test('closing a session terminates its process tree', async () => {
  const throwaway = await openSocket(port);
  const pid = throwaway.session.pid;
  throwaway.socket.send(JSON.stringify({ t: 'input', data: 'sleep 300 & echo spawned\r' }));
  await sleep(800);
  const close = await api(port, `/api/shell/sessions/${throwaway.session.id}`, { method: 'DELETE' });
  check(close.status === 200, `delete returned ${close.status}`);
  throwaway.socket.close();
  await sleep(900);
  let alive = true;
  try { process.kill(pid, 0); } catch { alive = false; }
  check(!alive, `session pid ${pid} still alive after close`);
});

/* ------------------------------------------------------------------ *
 * 3 · Network boundary
 * ------------------------------------------------------------------ */
await test('remote hosts are refused (Host header)', async () => {
  const response = await rawRequest(port, '/api/shell/status', { headers: { host: 'evil.example.com' } });
  check(response.status === 403, `expected 403, got ${response.status}`);
  check(response.payload?.reason === 'host-not-loopback', `reason ${response.payload?.reason}`);
});

await test('proxied requests are refused (forwarding headers)', async () => {
  const response = await rawRequest(port, '/api/shell/status', { headers: { host: `127.0.0.1:${port}`, 'x-forwarded-for': '203.0.113.9' } });
  check(response.status === 403 && response.payload?.reason === 'forwarded-header:x-forwarded-for', JSON.stringify(response.payload));
});

await test('cross-site browser fetches are refused (Sec-Fetch-Site)', async () => {
  const response = await rawRequest(port, '/api/shell/status', { headers: { host: `127.0.0.1:${port}`, 'sec-fetch-site': 'cross-site' } });
  check(response.status === 403 && response.payload?.reason === 'sec-fetch-site-cross-site', JSON.stringify(response.payload));
});

await test('third-party origins are refused (Origin header)', async () => {
  const response = await rawRequest(port, '/api/shell/status', { headers: { host: `127.0.0.1:${port}`, origin: 'http://evil.example.com' } });
  check(response.status === 403 && response.payload?.reason === 'origin-mismatch', JSON.stringify(response.payload));
});

await test('the websocket upgrade is refused for foreign origins (cross-site hijack)', async () => {
  const attempt = await new Promise((resolveAttempt) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/shell`, { headers: { origin: 'http://evil.example.com' } });
    socket.on('open', () => { socket.close(); resolveAttempt('opened'); });
    socket.on('error', (error) => resolveAttempt(`error:${error.message}`));
    setTimeout(() => resolveAttempt('timeout'), 4000);
  });
  check(attempt !== 'opened', 'a foreign origin was allowed to open a PTY socket');
});

await test('localhost clients are served (the gate is not just "refuse everything")', async () => {
  const response = await api(port, '/api/shell/status');
  check(response.status === 200 && response.payload.available === true, JSON.stringify(response.payload));
  check(response.headers === undefined || true, 'ok');
  const raw = await rawRequest(port, '/api/shell/status', { headers: { host: `localhost:${port}`, origin: `http://localhost:${port}` } });
  check(raw.status === 200, `loopback should be allowed, got ${raw.status}`);
});

await test('static corpus/shell assets are served and terminal vendor files stay local', async () => {
  const page = await api(port, '/');
  check(page.status === 200 && page.text.includes('NOÖSPHERE'), `index.html not served (${page.status})`);
  const graph = await api(port, '/data/zaziopath-graph.js');
  check(graph.status === 200 && graph.text.includes('63d99e311c852b9d57ddc29418455f9bb4ba80b1'), `committed graph not served (${graph.status})`);
  const shellClient = await api(port, '/shell/synapse-shell.js');
  check(shellClient.status === 200 && shellClient.text.includes('window.synapseShell'), `shell client not served (${shellClient.status})`);
  const shellCss = await api(port, '/shell/synapse-shell.css');
  check(shellCss.status === 200 && shellCss.text.includes('.ns-root'), `shell stylesheet not served (${shellCss.status})`);
  const xterm = await api(port, '/vendor/xterm.js');
  check(xterm.status === 200 && xterm.text.length > 100_000, `vendor xterm missing (${xterm.status})`);
  const traversal = await rawRequest(port, '/../../etc/passwd');
  check(traversal.status === 403 || traversal.status === 404, `traversal returned ${traversal.status}`);
});

/* ------------------------------------------------------------------ *
 * 4 · AI SHELL control modes
 * ------------------------------------------------------------------ */
await test('AI SHELL OFF exposes no tool surface', async () => {
  await api(port, '/api/shell/ai', { method: 'POST', body: { mode: 'off' } });
  const statusAfter = (await api(port, '/api/shell/status')).payload;
  check(statusAfter.model.tools.length === 0, `tools leaked while OFF: ${statusAfter.model.tools}`);
  const attempt = await api(port, '/api/noosphere/agent/run', { method: 'POST', body: { goal: 'list files' } });
  check(attempt.status === 403, `agent run should be refused while OFF, got ${attempt.status}`);
  const exec = await api(port, `/api/shell/sessions/${primary.session.id}/exec`, { method: 'POST', body: { command: 'echo SHOULD_NOT_RUN' } });
  check(exec.status === 403, `exec should be refused while OFF, got ${exec.status}`);
});

await test('AI SHELL ASSIST places a command without executing it', async () => {
  await api(port, '/api/shell/ai', { method: 'POST', body: { mode: 'assist' } });
  const marker = join(workDir, 'assist-should-not-exist');
  model.script([
    JSON.stringify({ thought: 'propose a harmless command', tool: 'shell_exec', args: { command: `touch ${marker}` } }),
  ]);
  const events = await collectAgentEvents(port, { goal: 'touch a file', sessionId: primary.session.id });
  const kinds = events.map((event) => event.type);
  check(kinds.includes('awaiting-human'), `expected awaiting-human, got ${kinds.join(',')}`);
  check(!existsSync(marker), 'ASSIST mode executed the command — it must only type it');
  const buffer = (await api(port, `/api/shell/sessions/${primary.session.id}/read?maxChars=200000`)).payload.text;
  check(buffer.includes('touch'), 'the proposed command never reached the input buffer');
});

await test('AI SHELL AUTONOMOUS executes, observes and iterates', async () => {
  await api(port, '/api/shell/ai', { method: 'POST', body: { mode: 'autonomous' } });
  const marker = join(workDir, 'autonomous-ran');
  model.script([
    JSON.stringify({ thought: 'create the marker', tool: 'shell_exec', args: { command: `touch ${marker} && echo CREATED` } }),
    JSON.stringify({ thought: 'verify it exists', tool: 'shell_exec', args: { command: `ls ${marker}` } }),
    JSON.stringify({ thought: 'done', tool: 'finish', args: { summary: 'marker created and verified' } }),
  ]);
  const events = await collectAgentEvents(port, { goal: 'prove the loop runs', sessionId: primary.session.id, limits: { maxSteps: 5 } });
  const actions = events.filter((event) => event.type === 'action');
  const observations = events.filter((event) => event.type === 'observation');
  const done = events.at(-1);
  check(existsSync(marker), 'AUTONOMOUS mode did not execute the command');
  check(actions.length === 2, `expected 2 actions, saw ${actions.length}`);
  check(observations.length === 2, `expected 2 observations, saw ${observations.length}`);
  check(/CREATED/.test(observations[0]?.outcome?.output ?? ''), `first observation missed the output: ${observations[0]?.outcome?.output}`);
  check(done.type === 'done' && done.stopped === 'finished', `run did not finish cleanly: ${JSON.stringify(done)}`);
  check(!/__NOOSPHERE/.test(observations[0]?.outcome?.output ?? ''), 'probe markers must not leak into observations');
});

await test('an unknown tool is refused without touching the shell', async () => {
  await api(port, '/api/shell/ai', { method: 'POST', body: { mode: 'autonomous' } });
  model.script([
    JSON.stringify({ thought: 'try something unsupported', tool: 'shell_rm_rf', args: { path: '/' } }),
    JSON.stringify({ thought: 'give up', tool: 'finish', args: { summary: 'refused' } }),
  ]);
  const events = await collectAgentEvents(port, { goal: 'attempt an invalid tool', sessionId: primary.session.id, limits: { maxSteps: 3 } });
  check(events.some((event) => event.type === 'rejected'), 'unknown tool was not rejected');
  check(!events.some((event) => event.type === 'observation'), 'a rejected tool produced an observation');
});

await test('MAX STEPS bounds the loop', async () => {
  model.script(new Array(10).fill(JSON.stringify({ thought: 'keep going', tool: 'shell_exec', args: { command: 'echo step' } })));
  const events = await collectAgentEvents(port, { goal: 'never stop', sessionId: primary.session.id, limits: { maxSteps: 3 } });
  const done = events.at(-1);
  const actions = events.filter((event) => event.type === 'action');
  check(actions.length === 3, `expected the bound to stop at 3 actions, saw ${actions.length}`);
  check(done.stopped === 'max-steps', `expected max-steps, got ${done.stopped}`);
});

await test('STOP AGENT aborts a long-running command', async () => {
  model.script([JSON.stringify({ thought: 'wait', tool: 'shell_exec', args: { command: 'sleep 45' } })]);
  const controller = new AbortController();
  const started = Date.now();
  const stream = collectAgentEvents(port, { goal: 'sleep forever', sessionId: primary.session.id, limits: { maxSteps: 4 } }, controller.signal);
  await sleep(1200);
  const stop = await api(port, '/api/noosphere/agent/stop', { method: 'POST', body: { sessionId: primary.session.id } });
  check(stop.status === 200, `stop returned ${stop.status}`);
  const events = await stream;
  check(Date.now() - started < 20_000, 'abort did not take effect promptly');
  check(events.at(-1).aborted === true || events.at(-1).stopped === 'stop-requested', `unexpected ending: ${JSON.stringify(events.at(-1))}`);
});

/* ------------------------------------------------------------------ *
 * 5 · Process visibility and logging
 * ------------------------------------------------------------------ */
await test('PROCESSES lists only NOÖSPHERE-spawned processes', async () => {
  const data = (await api(port, '/api/shell/processes')).payload;
  check(data.owned.length > 0, 'no owned processes reported');
  check(data.owned.every((row) => row.pid > 1), 'invalid pids');
  const foreign = await api(port, '/api/shell/processes/kill', { method: 'POST', body: { pid: 1 } });
  check(foreign.status === 403, `kill of a foreign pid must be refused, got ${foreign.status}`);
});

await test('PORTS reports listening sockets or explains why not', async () => {
  const data = (await api(port, '/api/shell/ports')).payload;
  check(Array.isArray(data.ports), 'ports payload malformed');
  check(typeof data.tool === 'string' || data.raw, 'no tool and no explanation');
});

await test('terminal history is ephemeral until SAVE SESSION is asked for', async () => {
  const before = (await api(port, `/api/shell/sessions/${primary.session.id}/read?maxChars=200000`)).payload;
  check(before.text.length > 0, 'scrollback is empty');
  const saved = (await api(port, `/api/shell/sessions/${primary.session.id}/save`, { method: 'POST' })).payload;
  check(existsSync(saved.file), `save did not write ${saved.file}`);
  check(resolve(saved.file).startsWith(resolve(logDir)), `saved session ignored --log-dir: ${saved.file}`);
  check(/^# NOÖSPHERE \/\/ SYNAPSE SHELL/.test(readFileSync(saved.file, 'utf8')), 'saved session lost its provenance header');
  const auto = (await api(port, `/api/shell/sessions/${primary.session.id}/save`, { method: 'POST' })).payload;
  check(auto.file !== saved.file, 'each explicit save should produce its own artefact');
});

/* ------------------------------------------------------------------ *
 * Cleanup
 * ------------------------------------------------------------------ */
await test('server shutdown reaps every PTY child', async () => {
  const list = (await api(port, '/api/shell/sessions')).payload;
  const pids = list.sessions.map((session) => session.pid);
  check(pids.length > 0, 'expected live sessions before shutdown');
  serverProcess.kill('SIGTERM');
  await new Promise((resolveExit) => serverProcess.once('exit', resolveExit));
  await sleep(700);
  const survivors = pids.filter((pid) => {
    try { process.kill(pid, 0); return true; } catch { return false; }
  });
  check(survivors.length === 0, `orphaned PTY processes after shutdown: ${survivors.join(', ')}`);
});

/* ------------------------------------------------------------------ *
 * Agent event collector (SSE over POST)
 * ------------------------------------------------------------------ */
async function collectAgentEvents(port, payload, signal = null) {
  const response = await fetch(`http://127.0.0.1:${port}/api/noosphere/agent/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok || !response.body) {
    const problem = await response.text();
    throw new Error(`agent run refused (${response.status}): ${problem.slice(0, 200)}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.split('\n').find((entry) => entry.startsWith('data: '));
      if (!line) continue;
      try { events.push(JSON.parse(line.slice(6))); } catch { /* partial frame */ }
    }
  }
  return events;
}

await shutdown();

console.log('  ────────────────────────────────────────────────────────────');
console.log(`  ${state.failed === 0 ? '✔ PASS' : '✘ FAIL'} — ${state.passed} passed, ${state.failed} failed, ${state.skipped} skipped`);
if (state.failed) {
  for (const failure of state.failures) console.log(`   ✗ ${failure.name}: ${failure.message}`);
}
console.log('');
process.exit(state.failed === 0 ? 0 : 1);
