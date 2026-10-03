/**
 * NOÖSPHERE // OS — process and port visibility
 * ============================================================
 * Backs the PROCESSES / PORTS panels of SYNAPSE SHELL. Everything here is
 * read-only except `signalPids`, which the HTTP layer restricts to processes
 * that descend from a NOÖSPHERE-spawned PTY (see `POST /api/shell/processes/kill`).
 *
 * `ps -axo` is POSIX-ish and present on macOS and Linux; `lsof` exists on macOS
 * and is optional on Linux, so `ss` is used as the fallback. Every command runs
 * with a hard timeout and a bounded output buffer — a hung `lsof` must never
 * take the shell window down with it.
 */

import { execFile } from 'node:child_process';

const PS_FORMAT = 'pid=,ppid=,pcpu=,pmem=,etime=,command=';
const MAX_OUTPUT = 256 * 1024;

const run = (file, args, timeout = 4000) =>
  new Promise((resolve) => {
    execFile(file, args, { timeout, maxBuffer: MAX_OUTPUT, encoding: 'utf8' }, (error, stdout) => {
      resolve(error && !stdout ? null : String(stdout ?? ''));
    });
  });

/** Snapshot of every process as `{ pid, ppid, cpu, mem, elapsed, command }`. */
export const snapshot = async () => {
  const raw = await run('ps', ['-axo', PS_FORMAT]);
  if (!raw) return [];
  const rows = [];
  for (const line of raw.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!match) continue;
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      cpu: Number(match[3]),
      mem: Number(match[4]),
      elapsed: match[5],
      command: match[6].trim(),
    });
  }
  return rows;
};

/** Every descendant of `roots` (inclusive), depth-first, cycle-safe. */
export const descendants = (rows, roots) => {
  const byParent = new Map();
  for (const row of rows) {
    if (!byParent.has(row.ppid)) byParent.set(row.ppid, []);
    byParent.get(row.ppid).push(row);
  }
  const byPid = new Map(rows.map((r) => [r.pid, r]));
  const seen = new Set();
  const out = [];
  const walk = (pid) => {
    if (seen.has(pid)) return;
    seen.add(pid);
    const row = byPid.get(pid);
    if (row) out.push(row);
    for (const child of byParent.get(pid) ?? []) walk(child.pid);
  };
  for (const root of roots) walk(root);
  return out;
};

/** Listening TCP sockets, using whichever tool the platform actually ships. */
export const listeners = async () => {
  const lsof = await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN']);
  if (lsof) {
    const ports = [];
    for (const line of lsof.split('\n').slice(1)) {
      const match = /^\S+\s+(\d+)\s+(\S+)\s+\S+\s+\S+\s+\S+\s+(.*?)\s+\(LISTEN\)$/.exec(line);
      if (match) ports.push({ pid: Number(match[1]), process: match[2], endpoint: match[3] });
    }
    return { tool: 'lsof', ports, raw: lsof.trim() };
  }

  const ss = await run('ss', ['-ltnp']);
  if (ss) {
    const ports = [];
    for (const line of ss.split('\n').slice(1)) {
      const match = /LISTEN\s+\d+\s+\d+\s+(\S+)\s+(\S+)/.exec(line);
      if (!match) continue;
      const users = /users:\(\("([^"]+)",pid=(\d+)/.exec(line);
      ports.push({
        pid: users ? Number(users[2]) : null,
        process: users ? users[1] : '',
        endpoint: `${match[1]} ${match[2]}`,
      });
    }
    return { tool: 'ss', ports, raw: ss.trim() };
  }

  return { tool: null, ports: [], raw: 'no port tool available (lsof / ss)' };
};

/**
 * Send a signal to each pid. Returns the pids that accepted it.
 * Callers are responsible for authorising the pids first.
 */
export const signalPids = (pids, signal = 'SIGTERM') => {
  const delivered = [];
  for (const pid of pids) {
    if (!Number.isInteger(pid) || pid <= 1) continue;
    try {
      process.kill(pid, signal);
      delivered.push(pid);
    } catch {
      /* already gone — not an error worth surfacing */
    }
  }
  return delivered;
};

/** SIGTERM the tree, then SIGKILL whatever ignored it. */
export const killTree = async (rootPids, { graceMs = 400 } = {}) => {
  const rows = await snapshot();
  const tree = descendants(rows, rootPids).map((r) => r.pid);
  const ordered = [...new Set(tree)].reverse(); // children before parents
  signalPids(ordered, 'SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, graceMs));
  const survivors = ordered.filter((pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  });
  signalPids(survivors, 'SIGKILL');
  return { signalled: ordered, forced: survivors };
};
