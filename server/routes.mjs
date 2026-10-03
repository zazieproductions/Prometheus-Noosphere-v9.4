/**
 * NOÖSPHERE // OS — shell bridge routes
 * ============================================================
 * HTTP + WebSocket surface for SYNAPSE SHELL. Every route below is gated by
 * `server/gate.mjs`: a request that is not demonstrably from the same machine
 * is answered with 403 and nothing else happens. No CORS headers are emitted,
 * so a browser on another origin cannot read these responses even if it can
 * reach the port.
 *
 * Transport contract
 * ------------------
 *   WS   /ws/shell?session=pty-01     live terminal (JSON frames, see docs/API.md)
 *   GET  /api/shell/status            host, shell, sessions, AI mode
 *   POST /api/shell/sessions          open a PTY
 *   POST /api/shell/sessions/:id/…    write · insert · exec · resize · interrupt · kill · restart · save
 *   GET  /api/shell/processes|ports   visibility into what NOÖSPHERE spawned
 *   POST /api/shell/ai                AI SHELL mode + autonomy limits
 *   POST /api/noosphere/agent/run     server-sent events for one agent loop
 */

import { classify } from './gate.mjs';
import { runAgent, activeRuns, stopRuns, TOOLS } from './agent.mjs';
import { MODEL, hasModel, listModels } from './ollama.mjs';

const MAX_BODY = 128 * 1024;

const json = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error('body too large'), { status: 413 });
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('invalid JSON body'), { status: 400 });
  }
};

const notFound = (res) => json(res, 404, { error: 'no such shell route' });

/**
 * @param {object} deps
 * @param {import('./shell.mjs').ShellHub} deps.hub
 * @param {string|null} deps.remoteToken  operator-chosen secret enabling remote access (null = local only)
 * @param {object} deps.meta              { version, repoRoot }
 */
export const createRouter = ({ hub, remoteToken = null, meta = {} }) => {
  const gate = (req, url) => classify(req, url, { remoteToken });

  const guard = (req, res, url) => {
    const verdict = gate(req, url);
    if (!verdict.allowed) {
      json(res, 403, {
        error: 'Local access only',
        reason: verdict.reason,
        hint: 'SYNAPSE SHELL is reachable from the machine running NOÖSPHERE. Remote previews, LAN clients and cross-origin pages are refused by design — see SECURITY.md.',
      });
      return null;
    }
    return verdict;
  };

  /* ---------------------------------------------------------------- *
   * HTTP
   * ---------------------------------------------------------------- */

  const handleHttp = async (req, res, url) => {
    const path = url.pathname;
    const segments = path.split('/').filter(Boolean); // api, shell, sessions, pty-01, verb
    const method = req.method ?? 'GET';

    /* Status is readable without the PTY so the UI can explain a degraded boot. */
    if (path === '/api/shell/status' && method === 'GET') {
      if (!guard(req, res, url)) return;
      const status = hub.status();
      status.model = { name: MODEL, available: await hasModel().catch(() => false), tools: hub.permits('assist') ? TOOLS : [] };
      status.version = meta.version ?? null;
      status.repoRoot = meta.repoRoot ?? null;
      status.expose = { remoteToken: Boolean(remoteToken), localOnly: !remoteToken };
      return json(res, 200, status);
    }

    /* Everything below is local-only. */
    if (!guard(req, res, url)) return;

    try {
      if (path === '/api/shell/ai' && method === 'POST') {
        const body = await readBody(req);
        const result = hub.aiState();
        if (body.mode !== undefined) Object.assign(result, hub.setAiMode(body.mode));
        if (body.limits !== undefined) Object.assign(result, hub.setLimits(body.limits));
        return json(res, 200, { ok: true, ...result, tools: hub.permits('assist') ? TOOLS : [] });
      }

      if (path === '/api/shell/processes' && method === 'GET') {
        return json(res, 200, { available: hub.available, ...(await hub.processes()) });
      }

      if (path === '/api/shell/ports' && method === 'GET') {
        return json(res, 200, await hub.ports());
      }

      if (path === '/api/shell/processes/kill' && method === 'POST') {
        const body = await readBody(req);
        if (!Number.isInteger(body.pid)) throw Object.assign(new Error('pid required'), { status: 400 });
        return json(res, 200, await hub.killProcess(body.pid, body.signal ?? 'SIGTERM'));
      }

      if (path === '/api/shell/sessions') {
        if (method === 'GET') return json(res, 200, { sessions: hub.list(), ai: hub.aiState() });
        if (method === 'POST') {
          const body = await readBody(req);
          const session = hub.create({ cwd: body.cwd, cols: body.cols, rows: body.rows });
          return json(res, 201, { session: hub.describe(session) });
        }
        return json(res, 405, { error: 'method not allowed' });
      }

      if (segments[0] === 'api' && segments[1] === 'shell' && segments[2] === 'sessions' && segments[3]) {
        const id = decodeURIComponent(segments[3]);
        const verb = segments[4] ?? null;
        if (!hub.get(id)) return json(res, 404, { error: `unknown session ${id}` });

        if (verb === null && method === 'DELETE') return json(res, 200, await hub.close(id));
        if (verb === 'read' && method === 'GET') {
          const from = url.searchParams.has('from') ? Number(url.searchParams.get('from')) : null;
          const maxChars = Number(url.searchParams.get('maxChars') ?? 20_000);
          const read = hub.read(id, { from, maxChars });
          return json(res, 200, { session: hub.describe(hub.get(id)), ...read });
        }
        if (method !== 'POST') return json(res, 405, { error: 'method not allowed' });
        const body = await readBody(req);

        switch (verb) {
          case 'write': {
            if (typeof body.data !== 'string') throw Object.assign(new Error('data required'), { status: 400 });
            return json(res, 200, hub.write(id, body.data));
          }
          case 'insert': {
            if (typeof body.text !== 'string') throw Object.assign(new Error('text required'), { status: 400 });
            return json(res, 200, hub.insert(id, body.text));
          }
          case 'exec': {
            if (typeof body.command !== 'string' || !body.command.trim()) throw Object.assign(new Error('command required'), { status: 400 });
            if (!hub.permits('autonomous')) {
              return json(res, 403, {
                error: 'AI SHELL control is not AUTONOMOUS',
                mode: hub.ai.mode,
                hint: 'a human can always type — but only AUTONOMOUS mode lets the model execute. Use ASSIST to place a command in the buffer instead.',
              });
            }
            const result = await hub.exec(id, body.command, { timeoutMs: body.timeoutMs ?? 120_000, source: body.source ?? 'api' });
            return json(res, 200, result);
          }
          case 'resize':
            return json(res, 200, hub.resize(id, Number(body.cols), Number(body.rows)));
          case 'interrupt':
            return json(res, 200, hub.interrupt(id, body.reason ?? 'api'));
          case 'kill':
            return json(res, 200, await hub.kill(id));
          case 'restart': {
            const session = await hub.restart(id);
            return json(res, 200, { session: hub.describe(session) });
          }
          case 'save':
            return json(res, 200, hub.save(id));
          default:
            return notFound(res);
        }
      }

      /* ------------------------------------------------------------ *
       * Agent loop (SSE over POST)
       * ------------------------------------------------------------ */
      if (path === '/api/noosphere/agent/status' && method === 'GET') {
        return json(res, 200, {
          mode: hub.ai.mode,
          limits: hub.aiState().limits,
          model: MODEL,
          tools: hub.permits('assist') ? TOOLS : [],
          runs: activeRuns(),
        });
      }

      if (path === '/api/noosphere/agent/stop' && method === 'POST') {
        const body = await readBody(req);
        const stopped = stopRuns({ runId: body.runId ?? null, sessionId: body.sessionId ?? null });
        // Emergency stop must never fail because a handle went stale.
        let interrupted = null;
        if (body.sessionId && hub.get(body.sessionId)) {
          hub.interrupt(body.sessionId, 'human-stop');
          interrupted = body.sessionId;
        }
        return json(res, 200, { stopped, interrupted, known: Boolean(body.sessionId && hub.get(body.sessionId)) });
      }

      if (path === '/api/noosphere/agent/run' && method === 'POST') {
        const body = await readBody(req);
        if (typeof body.goal !== 'string' || !body.goal.trim()) throw Object.assign(new Error('goal required'), { status: 400 });
        if (hub.ai.mode === 'off') {
          return json(res, 403, { error: 'AI SHELL control is OFF', hint: 'enable ASSIST or AUTONOMOUS in the SYNAPSE SHELL window first' });
        }
        if (!(await hasModel().catch(() => false))) {
          return json(res, 503, { error: `local model ${MODEL} unavailable`, models: await listModels().catch(() => []) });
        }

        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-store',
          connection: 'keep-alive',
          'x-accel-buffering': 'no',
        });
        const controller = new AbortController();
        req.on('close', () => controller.abort());
        const send = (event) => {
          if (res.writableEnded) return;
          try {
            res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
          } catch {
            /* socket closed between checks */
          }
        };
        try {
          await runAgent({
            hub,
            goal: body.goal.slice(0, 4000),
            sessionId: typeof body.sessionId === 'string' ? body.sessionId : null,
            limits: body.limits ?? {},
            onEvent: send,
            signal: controller.signal,
          });
        } finally {
          if (!res.writableEnded) res.end();
        }
        return undefined;
      }
    } catch (error) {
      if (res.writableEnded) return undefined;
      return json(res, error.status ?? 500, { error: error.message });
    }

    return notFound(res);
  };

  /* ---------------------------------------------------------------- *
   * WebSocket upgrade
   * ---------------------------------------------------------------- */

  const handleUpgrade = (req, socket, head, wss) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/ws/shell') return false;
    const verdict = gate(req, url);
    if (!verdict.allowed) {
      socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n');
      socket.end(JSON.stringify({ error: 'Local access only', reason: verdict.reason }));
      return true;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      hub.attach(ws, { sessionId: url.searchParams.get('session') });
    });
    return true;
  };

  return { handleHttp, handleUpgrade, gate, paths: { shell: '/api/shell', ws: '/ws/shell' } };
};
