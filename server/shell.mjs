/**
 * NOÖSPHERE // OS — SYNAPSE SHELL: real PTY session hub
 * ============================================================
 * This is a genuine host shell, not a command API. Each session is a `node-pty`
 * fork of the user's own login shell (`$SHELL`, falling back to `/bin/zsh`),
 * started in the repository root with the environment NOÖSPHERE inherited from
 * the account that launched it. There is no allowlist, no denylist, no virtual
 * filesystem and no command parsing: bytes typed by a human go to the PTY, and
 * bytes produced by the PTY come back unchanged.
 *
 * Design notes
 * ------------
 * · **Sessions are independent.** Each has its own PTY, process group, working
 *   directory and scrollback ring. Nothing is shared but the hub.
 * · **Output is not altered.** A stateful UTF-8 decoder prevents multi-byte
 *   characters from being split across frames; ANSI/OSC/CSI sequences pass
 *   through untouched so xterm.js can do its job.
 * · **Scrollback is a bounded in-memory ring** (default 512 KB per session).
 *   It is never written to disk unless the user explicitly saves the session.
 * · **Agent execution happens in the visible terminal.** `exec()` types the
 *   command into the PTY and appends a probe line so completion can be
 *   detected; the probe is visible in the terminal by design. It exists only
 *   while AI SHELL control is in AUTONOMOUS mode.
 * · **Process control is narrow on purpose.** The GUI may signal processes that
 *   descend from a NOÖSPHERE PTY. The *shell itself* can signal anything the
 *   account can — that authority comes from the account, not from this module.
 */

import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { killTree, snapshot, descendants, listeners } from './procinfo.mjs';

const DEFAULT_SHELL_ARGS = ['-l'];
const AI_MODES = ['off', 'assist', 'autonomous'];

export const DEFAULT_LIMITS = {
  maxSteps: 12,
  maxRuntimeMs: 300_000,
  stopOnError: false,
  outputChars: 6_000,
};

/** CSI/OSC/escape stripper used only for text handed to the language model. */
// Order matters: OSC/DCS run to a terminator and must be removed before the
// single-character escape sweep, or their payload leaks into the observation.
export const stripAnsi = (text) =>
  String(text)
    .replace(/\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g, '')
    .replace(/\u001B[P^_][^\u001B]*\u001B\\/g, '')
    .replace(/\u001B[\[\]()#;?]?[0-9;?]*[a-zA-Z@~]/g, '')
    .replace(/\u0007/g, '')
    .replace(/\r/g, '');

/** Trim the middle of a long observation, keeping both ends legible. */
export const clampText = (text, max) => {
  if (text.length <= max) return text;
  const head = Math.ceil(max * 0.6);
  const tail = Math.max(0, max - head - 40);
  return `${text.slice(0, head)}\n[… ${text.length - head - tail} characters elided …]\n${text.slice(-tail)}`;
};

const firstExisting = (candidates) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep looking */
    }
  }
  return null;
};

/** `$SHELL`, then `/bin/zsh` (the macOS default), then anything that exists. */
export const resolveShell = (preferred) =>
  firstExisting([preferred, process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh']) ?? '/bin/sh';

class ShellHub extends EventEmitter {
  #pty = null;
  #ptyError = null;
  #sessions = new Map();
  #seq = 0;
  #execSeq = 0;
  #cwdTimer = null;
  #flowTimer = null;

  constructor(options = {}) {
    super();
    this.setMaxListeners(0);
    this.options = {
      cwd: options.cwd ?? process.cwd(),
      shell: resolveShell(options.shell),
      shellArgs: options.shellArgs ?? DEFAULT_SHELL_ARGS,
      zaziopath: options.zaziopath ?? null,
      logDir: options.logDir ?? null,
      cols: 100,
      rows: 30,
      maxSessions: 8,
      scrollbackChars: 512 * 1024,
      execOutputCap: 60_000,
      ...options,
    };
    this.ai = { mode: 'off', limits: { ...DEFAULT_LIMITS, cwd: this.options.cwd } };
    this.startedAt = new Date().toISOString();
  }

  /** Load the native PTY binding. Failure is a degraded mode, never a crash. */
  async init() {
    if (this.options.disabled) {
      this.#pty = null;
      this.#ptyError = this.options.disabledReason ?? 'SYNAPSE SHELL disabled (--no-shell): no PTY is ever spawned';
      return { available: false, reason: this.#ptyError };
    }
    try {
      this.#pty = await import('node-pty');
      return { available: true, reason: 'node-pty loaded' };
    } catch (error) {
      this.#pty = null;
      this.#ptyError = error?.message ?? String(error);
      return {
        available: false,
        reason: `node-pty unavailable (${this.#ptyError}) — run \`npm install\` in the repository root`,
      };
    }
  }

  get available() {
    return Boolean(this.#pty);
  }

  /* ---------------------------------------------------------------- *
   * Environment
   * ---------------------------------------------------------------- */

  #childEnv(sessionId) {
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') env[key] = value;
    }
    return {
      ...env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'NOOSPHERE',
      TERM_PROGRAM_VERSION: this.options.version ?? '',
      // Tells shells/scripts they are running inside SYNAPSE SHELL.
      NOOSPHERE_SHELL: '1',
      NOOSPHERE_SESSION: sessionId,
      NOOSPHERE_REPO: this.options.cwd,
      ...(this.options.zaziopath ? { NOOSPHERE_ZAZIOPATH: this.options.zaziopath } : {}),
      ...(process.env.LANG ? {} : { LANG: 'en_US.UTF-8' }),
    };
  }

  /* ---------------------------------------------------------------- *
   * Session lifecycle
   * ---------------------------------------------------------------- */

  #require(id) {
    const session = this.#sessions.get(id);
    if (!session) throw Object.assign(new Error(`unknown session: ${id}`), { status: 404 });
    return session;
  }

  create({ cwd, cols, rows, id = null, label = null } = {}) {
    if (!this.#pty) throw Object.assign(new Error('PTY support unavailable'), { status: 503 });
    if (!id && this.#sessions.size >= this.options.maxSessions) {
      throw Object.assign(new Error(`session limit reached (${this.options.maxSessions})`), { status: 409 });
    }
    if (id && this.#sessions.has(id)) {
      throw Object.assign(new Error(`session ${id} already exists`), { status: 409 });
    }

    const index = id ? null : ++this.#seq;
    const sessionId = id ?? `pty-${String(index).padStart(2, '0')}`;
    const size = {
      cols: clampInt(cols, 20, 500, this.options.cols),
      rows: clampInt(rows, 5, 200, this.options.rows),
    };
    const startCwd = safeCwd(cwd, this.options.cwd);
    const pty = this.#pty.spawn(this.options.shell, this.options.shellArgs, {
      name: 'xterm-256color',
      cwd: startCwd,
      env: this.#childEnv(sessionId),
      ...size,
    });

    const session = {
      id: sessionId,
      label: label ?? `SHELL ${String(index).padStart(2, '0')}`,
      pty,
      pid: pty.pid,
      cols: size.cols,
      rows: size.rows,
      cwd: startCwd,
      startedAt: new Date().toISOString(),
      exited: false,
      exit: null,
      sockets: new Set(),
      decoder: new StringDecoder('utf8'),
      chunks: [],
      base: 0,
      end: 0,
      size: 0,
      lastActivity: Date.now(),
      pendingExec: null,
      savedAt: null,
    };

    pty.onData((data) => this.#ingest(session, data));
    pty.onExit(({ exitCode, signal }) => {
      session.exited = true;
      session.exit = { code: exitCode, signal: signal ?? null, at: new Date().toISOString() };
      if (session.pendingExec) session.pendingExec.resolve({ exit: null, interrupted: true, reason: 'shell-exited' });
      this.#broadcast(session, { t: 'exit', code: exitCode, signal: signal ?? null });
      this.emit('session-exit', { id: session.id, code: exitCode, signal: signal ?? null });
    });

    this.#sessions.set(sessionId, session);
    this.#ensureCwdPolling();
    this.emit('session-created', this.describe(session));
    return session;
  }

  #ingest(session, data) {
    const text = session.decoder.write(Buffer.from(data, 'utf8'));
    if (!text) return;
    this.#append(session, text);
    this.#sniffOsc7(session, text);
    if (session.pendingExec) session.pendingExec.feed(text);
    if (session.sockets.size) this.#broadcast(session, { t: 'data', data: text });
  }

  #append(session, text) {
    session.chunks.push({ start: session.end, text });
    session.end += text.length;
    session.size += text.length;
    session.lastActivity = Date.now();
    while (session.chunks.length > 1 && session.size > this.options.scrollbackChars) {
      const dropped = session.chunks.shift();
      session.base = dropped.start + dropped.text.length;
      session.size -= dropped.text.length;
    }
  }

  /** Terminals that emit OSC 7 (`\e]7;file://host/path\e\\`) report their cwd. */
  #sniffOsc7(session, text) {
    const match = /\u001B\]7;file:\/\/[^/]*(\/[^\u0007\u001B]*)/.exec(text);
    if (!match) return;
    try {
      session.cwd = decodeURIComponent(match[1]);
    } catch {
      session.cwd = match[1];
    }
  }

  read(id, { from = null, maxChars = this.options.execOutputCap } = {}) {
    const session = this.#require(id);
    const start = Math.max(from ?? session.base, session.base);
    let out = '';
    for (const chunk of session.chunks) {
      const chunkEnd = chunk.start + chunk.text.length;
      if (chunkEnd <= start) continue;
      const offset = Math.max(0, start - chunk.start);
      out += chunk.text.slice(offset);
    }
    return {
      id,
      from: start,
      to: session.end,
      truncated: from !== null && from < session.base,
      text: clampText(out, maxChars),
      raw: out,
    };
  }

  write(id, data) {
    const session = this.#require(id);
    if (session.exited) throw Object.assign(new Error('session has exited'), { status: 409 });
    session.pty.write(data);
    session.lastActivity = Date.now();
    return { id, bytes: data.length };
  }

  /** Type text into the shell **without** executing it (the AI ASSIST contract). */
  insert(id, text) {
    return this.write(id, String(text).replace(/[\r\n]/g, ' '));
  }

  resize(id, cols, rows) {
    const session = this.#require(id);
    const next = { cols: clampInt(cols, 20, 500, session.cols), rows: clampInt(rows, 5, 200, session.rows) };
    if (next.cols === session.cols && next.rows === session.rows) return this.describe(session);
    session.cols = next.cols;
    session.rows = next.rows;
    try {
      session.pty.resize(next.cols, next.rows);
      this.#broadcast(session, { t: 'resized', cols: next.cols, rows: next.rows });
    } catch (error) {
      this.emit('warning', { id, message: `resize failed: ${error.message}` });
    }
    return this.describe(session);
  }

  /** Ctrl+C — the same bytes a human would press. */
  interrupt(id, reason = 'human') {
    const session = this.#require(id);
    try {
      session.pty.write('\u0003');
    } catch {
      /* the shell may already be gone */
    }
    if (session.pendingExec) session.pendingExec.resolve({ interrupted: true, reason });
    this.emit('interrupt', { id, reason });
    return { id, interrupted: true };
  }

  /** SIGTERM the tree, then SIGKILL survivors. Used by KILL PROCESS / RESTART. */
  async kill(id) {
    const session = this.#require(id);
    const result = await killTree([session.pid]);
    if (session.pendingExec) session.pendingExec.resolve({ interrupted: true, reason: 'killed' });
    return { id, pid: session.pid, ...result };
  }

  async close(id) {
    const session = this.#require(id);
    await this.kill(id).catch(() => {});
    this.#dispose(session);
    return { id, closed: true };
  }

  /** Restart keeps the session id so agents, tabs and scripts keep their handle. */
  async restart(id) {
    const session = this.#require(id);
    const { cwd, cols, rows, label } = session;
    await this.close(id);
    return this.create({ cwd, cols, rows, id, label });
  }

  #dispose(session) {
    this.#sessions.delete(session.id);
    for (const socket of session.sockets) {
      try {
        socket.close(1000, 'session closed');
      } catch {
        /* ignore */
      }
    }
    session.sockets.clear();
    try {
      session.pty.kill();
    } catch {
      /* already dead */
    }
    this.emit('session-closed', { id: session.id });
    if (!this.#sessions.size) this.#stopCwdPolling();
  }

  async closeAll() {
    const ids = [...this.#sessions.keys()];
    await Promise.all(ids.map((id) => this.close(id).catch(() => {})));
    this.#stopCwdPolling();
    return ids;
  }

  /** Last-resort cleanup for `process.on('exit')`, where nothing can be awaited. */
  killAllSync() {
    for (const session of this.#sessions.values()) {
      try {
        process.kill(-session.pid, 'SIGKILL');
      } catch {
        try { process.kill(session.pid, 'SIGKILL'); } catch { /* already gone */ }
      }
    }
    this.#sessions.clear();
  }

  list() {
    return [...this.#sessions.values()].map((session) => this.describe(session));
  }

  get(id) {
    return this.#sessions.get(id) ?? null;
  }

  describe(session) {
    return {
      id: session.id,
      label: session.label,
      pid: session.pid,
      cols: session.cols,
      rows: session.rows,
      cwd: session.cwd,
      startedAt: session.startedAt,
      exited: session.exited,
      exit: session.exit,
      attached: session.sockets.size,
      bufferChars: session.size,
      savedAt: session.savedAt,
      lastActivity: new Date(session.lastActivity).toISOString(),
    };
  }

  status() {
    return {
      available: this.available,
      reason: this.available ? 'ready' : this.#ptyError ?? 'PTY unavailable',
      shell: this.options.shell,
      shellArgs: this.options.shellArgs,
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      hostname: safeHostname(),
      cwd: this.options.cwd,
      zaziopath: this.options.zaziopath,
      maxSessions: this.options.maxSessions,
      scrollbackChars: this.options.scrollbackChars,
      ai: this.aiState(),
      sessions: this.list(),
      startedAt: this.startedAt,
    };
  }

  /* ---------------------------------------------------------------- *
   * Working-directory tracking
   * ---------------------------------------------------------------- */

  #ensureCwdPolling() {
    if (this.#cwdTimer || !this.#sessions.size) return;
    this.#cwdTimer = setInterval(() => {
      for (const session of this.#sessions.values()) this.#refreshCwd(session).catch(() => {});
    }, 2500);
    this.#cwdTimer.unref?.();
  }

  #stopCwdPolling() {
    if (!this.#cwdTimer) return;
    clearInterval(this.#cwdTimer);
    this.#cwdTimer = null;
  }

  async #refreshCwd(session) {
    if (session.exited) return;
    const cwd = await cwdOfPid(session.pid);
    if (cwd && cwd !== session.cwd) {
      session.cwd = cwd;
      this.emit('cwd', { id: session.id, cwd });
      this.#broadcast(session, { t: 'cwd', cwd });
    }
  }

  /* ---------------------------------------------------------------- *
   * Agent execution surface (AUTONOMOUS only)
   * ---------------------------------------------------------------- */

  /**
   * Type `command` into the PTY, then a probe line so completion is detectable.
   *
   * The probe is split across a quote boundary (`'__NOOSPHERE''_EXEC_nonce__'`)
   * so the literal marker never appears in the echoed input line — only a real
   * run can produce it. Requires a POSIX-ish shell, which is what we spawn.
   */
  async exec(id, command, { timeoutMs = 120_000, source = 'agent' } = {}) {
    const session = this.#require(id);
    if (session.exited) throw Object.assign(new Error('session has exited'), { status: 409 });
    if (session.pendingExec) throw Object.assign(new Error('another command is already in flight'), { status: 409 });

    const nonce = `${Date.now().toString(36)}${(++this.#execSeq).toString(36)}`;
    const marker = `__NOOSPHERE_EXEC_${nonce}__`;
    const splitMarker = `__NOOSPHERE''_EXEC_${nonce}__`;
    const pattern = new RegExp(`${marker}:(\\d+)`);
    const started = Date.now();
    const from = session.end;

    let collected = '';
    let settle = null;
    const result = new Promise((resolvePromise) => { settle = resolvePromise; });

    session.pendingExec = {
      command,
      feed: (text) => {
        if (collected.length < 4_000_000) collected += text;
        const match = pattern.exec(collected);
        if (match) settle({ code: Number(match[1]), index: match.index, markerLength: match[0].length });
      },
      resolve: (payload) => settle(payload),
    };

    this.emit('exec', { id, command, source, at: new Date().toISOString() });
    session.pty.write(`${command}\r`);
    session.pty.write(`printf '\\n${splitMarker}:%d\\n' "$?"\r`);

    const timer = setTimeout(() => settle({ timeout: true }), timeoutMs);
    let outcome;
    try {
      outcome = await result;
    } finally {
      clearTimeout(timer);
      session.pendingExec = null;
    }

    if (outcome.interrupted || outcome.timeout) {
      try { session.pty.write('\u0003'); } catch { /* gone */ }
    }

    const elapsed = Date.now() - started;
    const { text, raw } = this.read(id, { from, maxChars: 4_000_000 });
    const observable = this.#observation(raw, command);
    return {
      command,
      sessionId: id,
      exitCode: typeof outcome.code === 'number' ? outcome.code : null,
      timedOut: Boolean(outcome.timeout),
      interrupted: Boolean(outcome.interrupted),
      reason: outcome.reason ?? null,
      ms: elapsed,
      output: clampText(observable, this.options.execOutputCap),
      rawChars: text.length,
      cwd: session.cwd,
    };
  }

  /**
   * Turn raw PTY output into something a model can read without noise:
   * strip escapes, drop the echo of the typed command, drop the probe line
   * (visible in the terminal by design, meaningless to the model) and drop a
   * trailing bare prompt.
   */
  #observation(raw, command) {
    const text = stripAnsi(raw);
    const commandLine = command.replace(/\s+/g, ' ').trim();
    const kept = [];
    for (const [index, line] of text.split('\n').entries()) {
      if (line.includes('__NOOSPHERE')) continue;
      if (index === 0 && line.replace(/\s+/g, ' ').trim().endsWith(commandLine)) continue;
      kept.push(line);
    }
    while (kept.length && kept[0].trim() === '') kept.shift();
    while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
    const last = kept[kept.length - 1] ?? '';
    if (kept.length > 1 && /[$#%\u276F>]\s*$/.test(last) && last.length < 120) kept.pop();
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ---------------------------------------------------------------- *
   * Session logging (opt-in, never automatic)
   * ---------------------------------------------------------------- */

  save(id) {
    const session = this.#require(id);
    if (!this.options.logDir) throw Object.assign(new Error('no log directory configured'), { status: 500 });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = join(this.options.logDir, `${stamp}-${session.id}.log`);
    mkdirSync(dirname(file), { recursive: true });
    const header = [
      `# NOÖSPHERE // SYNAPSE SHELL — saved session`,
      `# session   ${session.label} (${session.id})`,
      `# shell     ${this.options.shell}`,
      `# pid       ${session.pid}`,
      `# started   ${session.startedAt}`,
      `# saved     ${new Date().toISOString()}`,
      `# cwd       ${session.cwd}`,
      `# note      saved on explicit request; scrollback is otherwise ephemeral`,
      '',
    ].join('\n');
    const body = stripAnsi(this.read(id, { maxChars: this.options.scrollbackChars }).raw);
    writeFileSync(file, `${header}${body}\n`, 'utf8');
    session.savedAt = new Date().toISOString();
    return { id, file, bytes: Buffer.byteLength(body, 'utf8') };
  }

  /* ---------------------------------------------------------------- *
   * Process / port visibility
   * ---------------------------------------------------------------- */

  async processes() {
    const rows = await snapshot();
    const roots = [...this.#sessions.values()].map((session) => session.pid);
    const owned = descendants(rows, roots);
    const ownedBySession = new Map();
    for (const session of this.#sessions.values()) {
      const ids = new Set(descendants(rows, [session.pid]).map((r) => r.pid));
      ownedBySession.set(session.id, ids);
    }
    return {
      total: rows.length,
      owned: owned.map((row) => ({
        ...row,
        sessionId: [...ownedBySession.entries()].find(([, ids]) => ids.has(row.pid))?.[0] ?? null,
      })),
      ownPids: owned.map((row) => row.pid),
    };
  }

  async ports() {
    const info = await listeners();
    const owned = new Set((await this.processes()).ownPids);
    return { ...info, owned: info.ports.filter((port) => owned.has(port.pid)) };
  }

  /** Kill a process **only** if it descends from a NOÖSPHERE PTY. */
  async killProcess(pid, signal = 'SIGTERM') {
    const rows = await snapshot();
    const roots = [...this.#sessions.values()].map((session) => session.pid);
    const owned = new Set(descendants(rows, roots).map((row) => row.pid));
    if (!owned.has(Number(pid))) {
      throw Object.assign(new Error('process was not spawned through NOÖSPHERE — use the terminal'), { status: 403 });
    }
    const killed = await killTree([Number(pid)]);
    return { pid: Number(pid), signal, ...killed };
  }

  /* ---------------------------------------------------------------- *
   * AI SHELL control
   * ---------------------------------------------------------------- */

  aiState() {
    return { mode: this.ai.mode, limits: { ...this.ai.limits } };
  }

  setAiMode(mode) {
    const next = String(mode).toLowerCase();
    if (!AI_MODES.includes(next)) throw Object.assign(new Error(`unknown AI shell mode: ${mode}`), { status: 400 });
    const previous = this.ai.mode;
    this.ai.mode = next;
    this.emit('ai-mode', { from: previous, to: next, at: new Date().toISOString() });
    return this.aiState();
  }

  setLimits(limits = {}) {
    const next = { ...this.ai.limits };
    if (limits.maxSteps !== undefined) next.maxSteps = clampInt(limits.maxSteps, 1, 50, next.maxSteps);
    if (limits.maxRuntimeMs !== undefined) next.maxRuntimeMs = clampInt(limits.maxRuntimeMs, 5_000, 3_600_000, next.maxRuntimeMs);
    if (limits.stopOnError !== undefined) next.stopOnError = Boolean(limits.stopOnError);
    if (limits.outputChars !== undefined) next.outputChars = clampInt(limits.outputChars, 500, 20_000, next.outputChars);
    if (typeof limits.cwd === 'string' && limits.cwd.trim()) next.cwd = safeCwd(limits.cwd, next.cwd ?? this.options.cwd);
    this.ai.limits = next;
    return this.aiState();
  }

  permits(level) {
    const order = { off: 0, assist: 1, autonomous: 2 };
    return order[this.ai.mode] >= order[level];
  }

  /* ---------------------------------------------------------------- *
   * Browser transport (WebSocket)
   * ---------------------------------------------------------------- */

  attach(socket, { sessionId } = {}) {
    if (!this.available) {
      socket.send(JSON.stringify({ t: 'unavailable', reason: this.status().reason }));
      socket.close(1011, 'pty unavailable');
      return null;
    }
    const session = sessionId && this.get(sessionId) ? this.get(sessionId) : this.create({});
    session.sockets.add(socket);
    socket.send(JSON.stringify({ t: 'ready', session: this.describe(session), ai: this.aiState(), status: this.status() }));

    socket.on('message', (raw) => {
      let message = null;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      try {
        switch (message?.t) {
          case 'input':
            if (typeof message.data === 'string' && message.data.length <= 64_000) this.write(session.id, message.data);
            break;
          case 'insert':
            if (typeof message.data === 'string' && message.data.length <= 64_000) this.insert(session.id, message.data);
            break;
          case 'resize':
            this.resize(session.id, Number(message.cols), Number(message.rows));
            break;
          case 'interrupt':
            this.interrupt(session.id, 'browser');
            break;
          case 'kill':
            this.kill(session.id).catch(() => {});
            break;
          case 'ping':
            socket.send(JSON.stringify({ t: 'pong', at: Date.now() }));
            break;
          default:
            break;
        }
      } catch (error) {
        socket.send(JSON.stringify({ t: 'error', message: error.message }));
      }
    });

    const detach = () => {
      session.sockets.delete(socket);
      this.emit('detach', { id: session.id });
    };
    socket.on('close', detach);
    socket.on('error', detach);
    this.emit('attach', { id: session.id, sockets: session.sockets.size });
    return session;
  }

  #broadcast(session, frame) {
    const payload = JSON.stringify(frame);
    for (const socket of session.sockets) {
      if (socket.readyState !== 1) {
        session.sockets.delete(socket);
        continue;
      }
      try {
        socket.send(payload);
      } catch {
        session.sockets.delete(socket);
      }
    }
    this.#applyBackpressure(session);
  }

  /**
   * Flow control: if a browser stops reading (background tab, slow link),
   * pause the PTY instead of buffering the process to death.
   */
  #applyBackpressure(session) {
    if (!session.sockets.size) return;
    const worst = Math.max(...[...session.sockets].map((socket) => socket.bufferedAmount ?? 0));
    if (worst > 8 * 1024 * 1024 && !session.paused) {
      session.paused = true;
      try { session.pty.pause(); } catch { /* ignore */ }
    }
    if (session.paused && !this.#flowTimer) {
      this.#flowTimer = setInterval(() => {
        const current = Math.max(0, ...[...session.sockets].map((socket) => socket.bufferedAmount ?? 0));
        if (current < 1024 * 1024) {
          clearInterval(this.#flowTimer);
          this.#flowTimer = null;
          for (const s of this.#sessions.values()) {
            if (!s.paused) continue;
            s.paused = false;
            try { s.pty.resume(); } catch { /* ignore */ }
          }
        }
      }, 120);
      this.#flowTimer.unref?.();
    }
  }
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const clampInt = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
};

const safeCwd = (candidate, fallback) => {
  for (const path of [candidate, fallback, process.env.HOME, '/']) {
    if (!path) continue;
    try {
      const resolved = resolve(String(path).replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));
      if (statSync(resolved).isDirectory()) return resolved;
    } catch {
      /* try the next candidate */
    }
  }
  return process.cwd();
};

const safeHostname = () => {
  try {
    return process.env.HOSTNAME ?? '';
  } catch {
    return '';
  }
};

/** Working directory of a live pid: /proc on Linux, lsof on macOS. */
const cwdOfPid = async (pid) => {
  if (process.platform === 'linux') {
    try {
      const { readlinkSync } = await import('node:fs');
      return readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      return null;
    }
  }
  const { execFile } = await import('node:child_process');
  return new Promise((resolvePromise) => {
    execFile('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn'], { timeout: 3000 }, (error, stdout) => {
      if (error && !stdout) return resolvePromise(null);
      const line = String(stdout).split('\n').find((entry) => entry.startsWith('n'));
      resolvePromise(line ? line.slice(1) : null);
    });
  });
};

export const createShellHub = async (options) => {
  const hub = new ShellHub(options);
  hub.initResult = await hub.init();
  return hub;
};

export { ShellHub, AI_MODES };
