/**
 * NOÖSPHERE // OS — SYNAPSE SHELL (browser half)
 * ============================================================================
 * A real terminal window for the NOÖSPHERE desktop: xterm.js writing to a
 * local PTY over WebSocket, one independent shell session per tab.
 *
 * What this file is responsible for
 * ---------------------------------
 *  · rendering the window chrome (instrumentation strip, tabs, quick actions)
 *  · one xterm.js instance per session, kept fitted to the panel
 *  · the WebSocket transport to `/ws/shell` (input, resize, interrupt, kill)
 *  · the AI SHELL control surface (OFF · ASSIST · AUTONOMOUS) and its bounds
 *  · streaming the agent loop's server-sent events into a readable step log
 *  · degrading to `SYNAPSE SHELL // OFFLINE` when the bridge is unreachable
 *
 * What this file is *not* responsible for
 * ---------------------------------------
 *  · deciding what a command may do — there is no command filter anywhere; the
 *    shell is the user's own shell with the user's own permissions
 *  · authorising anything — the server gate refuses non-local clients before a
 *    socket is even attached (`server/gate.mjs`)
 *  · rendering terminal output as markup — bytes go to xterm, never to the DOM
 *
 * Loaded by index.html with `<script defer>`. Everything hangs off
 * `window.synapseShell` for inspection from the NOÖSPHERE console.
 */

(() => {
    'use strict';

    const MODES = ['off', 'assist', 'autonomous'];
    const TERMINAL_THEME = {
        background: '#02040800',
        foreground: '#cbd5e1',
        cursor: '#00f7ff',
        cursorAccent: '#02040',
        selectionBackground: 'rgba(0, 247, 255, 0.25)',
        black: '#0b1120',
        red: '#ff0055',
        green: '#00ff9d',
        yellow: '#ffaa00',
        blue: '#38bdf8',
        magenta: '#a855f7',
        cyan: '#00f7ff',
        white: '#e2e8f0',
        brightBlack: '#475569',
        brightRed: '#ff4d7d',
        brightGreen: '#5cffc4',
        brightYellow: '#ffd166',
        brightBlue: '#7dd3fc',
        brightMagenta: '#c084fc',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc',
    };

    /* ------------------------------------------------------------------ *
     * Transport helpers
     * ------------------------------------------------------------------ */

    const request = async (path, { method = 'GET', body = null } = {}) => {
        const response = await fetch(path, {
            method,
            headers: body ? { 'content-type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
        });
        const text = await response.text();
        let payload = null;
        try { payload = JSON.parse(text); } catch { /* non-JSON ⇒ bridge is not ours */ }
        if (!response.ok) {
            const error = new Error(payload?.error ?? `HTTP ${response.status}`);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }
        if (!payload) throw Object.assign(new Error('unexpected response'), { status: response.status });
        return payload;
    };

    const beep = (frequency, type, duration, volume) => {
        try { window.playBeep?.(frequency, type, duration, volume); } catch { /* audio is optional */ }
    };

    /* ------------------------------------------------------------------ *
     * Engine
     * ------------------------------------------------------------------ */

    const shell = {
        root: null,
        status: null,
        mode: 'off',
        limits: { maxSteps: 12, maxRuntimeMs: 300_000, stopOnError: false, cwd: '' },
        sessions: new Map(),
        active: null,
        terminals: null,
        agent: { running: false, controller: null, runId: null, steps: 0 },
        processPanel: 'none',
        booted: false,

        /* -------------------------------------------------------------- *
         * Boot
         * -------------------------------------------------------------- */
        async boot() {
            this.root = document.getElementById('shell-root');
            if (!this.root || this.booted) return;
            this.booted = true;

            let status = null;
            let failure = null;
            try {
                status = await request('/api/shell/status');
            } catch (error) {
                failure = error;
            }

            if (!status) {
                const local = failure.payload?.error === 'Local access only';
                return this.renderOffline(
                    local ? 'SHELL UNAVAILABLE' : 'SHELL UNAVAILABLE // BRIDGE UNREACHABLE',
                    local
                        ? 'This browser is not running on the machine that hosts NOÖSPHERE. The PTY bridge answers loopback clients only — remote previews, LAN clients and static hosts are refused by design.'
                        : 'No local bridge answered. Start it with `npm start` and open http://localhost:4173 — the shell cannot exist on a static host.',
                );
            }

            this.status = status;
            this.mode = status.ai?.mode ?? 'off';
            this.limits = { ...this.limits, ...(status.ai?.limits ?? {}) };
            if (!status.available) return this.renderOffline('LOCAL PTY UNAVAILABLE', status.reason);

            try {
                await this.loadAssets();
            } catch (error) {
                return this.renderOffline(
                    'TERMINAL LIBRARY MISSING',
                    `${error.message} — the local server serves xterm.js from node_modules; run \`npm install\` and reload.`,
                );
            }

            this.renderConsole();
            try {
                const { sessions } = await request('/api/shell/sessions');
                const reusable = sessions.find((session) => !session.exited && session.attached === 0);
                if (reusable) {
                    this.attach(reusable);
                    this.select(reusable.id);
                    this.toast(`${reusable.label} reattached — ${reusable.cwd}`);
                    return;
                }
            } catch { /* fall through to a fresh session */ }
            await this.newSession();
        },

        /** xterm.js is loaded from the local server, never from a CDN. */
        async loadAssets() {
            if (window.Terminal && window.FitAddon) return;
            const stylesheet = document.createElement('link');
            stylesheet.rel = 'stylesheet';
            stylesheet.href = '/vendor/xterm.css';
            document.head.appendChild(stylesheet);
            for (const source of ['/vendor/xterm.js', '/vendor/addon-fit.js']) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = source;
                    script.onload = resolve;
                    script.onerror = () => reject(new Error(`failed to load ${source}`));
                    document.head.appendChild(script);
                });
            }
        },

        /* -------------------------------------------------------------- *
         * Offline / degraded rendering
         * -------------------------------------------------------------- */
        renderOffline(title, why) {
            this.root.innerHTML = '';
            const panel = document.createElement('div');
            panel.className = 'ns-offline';
            const heading = document.createElement('div');
            heading.className = 'ns-offline-title';
            heading.textContent = `SYNAPSE SHELL // ${title}`;
            const body = document.createElement('div');
            body.className = 'ns-offline-why';
            body.textContent = why;
            const hint = document.createElement('div');
            hint.className = 'ns-offline-why';
            hint.innerHTML = 'Local terminal: <code>npm start</code> → <code>http://localhost:4173</code> · documentation: <code>docs/SHELL.md</code>';
            panel.append(heading, body, hint);
            this.root.appendChild(panel);
            const badge = document.getElementById('shell-mode-badge');
            if (badge) {
                badge.textContent = 'SHELL // OFFLINE';
                badge.className = 'bg-rose-950/70 border border-rose-700/60 text-[10px] px-1.5 py-0.2 rounded text-rose-300 font-mono';
            }
        },

        /* -------------------------------------------------------------- *
         * Console skeleton (built once, then updated in place)
         * -------------------------------------------------------------- */
        renderConsole() {
            this.root.innerHTML = '';

            const wrap = document.createElement('div');
            wrap.className = 'ns-root';

            this.el = {
                strip: document.createElement('div'),
                tabs: document.createElement('div'),
                stage: document.createElement('div'),
                quick: document.createElement('div'),
                panel: document.createElement('div'),
                agent: document.createElement('div'),
                toast: document.createElement('div'),
            };
            this.el.strip.className = 'ns-strip';
            this.el.tabs.className = 'ns-tabs';
            this.el.stage.className = 'ns-stage';
            this.el.quick.className = 'ns-quick';
            this.el.panel.className = 'ns-panel';
            this.el.panel.hidden = true;
            this.el.agent.className = 'ns-agent';
            this.el.agent.dataset.open = 'false';
            this.el.toast.className = 'ns-toast';

            this.buildStrip();
            this.buildQuickActions();
            this.buildAgentPanel();

            wrap.append(
                this.el.strip,
                this.el.tabs,
                this.el.stage,
                this.el.quick,
                this.el.panel,
                this.el.agent,
                this.el.toast,
            );
            this.root.appendChild(wrap);

            this.root.addEventListener('click', (event) => this.onClick(event));
            window.addEventListener('resize', () => this.fitActive());
        },

        buildStrip() {
            const add = (key, value, className = 'ns-val') => {
                const group = document.createElement('span');
                const k = document.createElement('span');
                k.className = 'ns-key';
                k.textContent = `${key} // `;
                const v = document.createElement('span');
                v.className = className;
                v.textContent = value;
                group.append(k, v);
                this.el.strip.appendChild(group);
                return v;
            };

            this.refs = {};
            this.refs.host = add('HOST', 'LOCAL');
            this.refs.shell = add('SHELL', this.status?.shell ?? '—');
            this.refs.pty = add('PTY', '—');
            this.refs.pid = add('PID', '—');
            const modeButton = document.createElement('button');
            modeButton.className = 'ns-mode';
            modeButton.dataset.mode = this.mode;
            modeButton.dataset.act = 'cycle-ai';
            modeButton.title = 'cycle AI SHELL control: OFF → ASSIST → AUTONOMOUS';
            modeButton.innerHTML = '<span class="ns-dot"></span><span class="ns-mode-label"></span>';
            this.el.strip.appendChild(modeButton);
            this.refs.mode = modeButton.querySelector('.ns-mode-label');
            this.refs.cwd = add('CWD', '—', 'ns-val ns-cwd');
            this.updateModeBadge();
        },

        buildQuickActions() {
            const actions = [
                ['new', 'NEW SHELL', 'emerald'],
                ['restart', 'RESTART', 'amber'],
                ['clear', 'CLEAR', 'cyan'],
                ['interrupt', 'INTERRUPT ^C', 'amber'],
                ['kill', 'KILL PROCESS', 'crimson'],
                ['copy', 'COPY OUTPUT', 'cyan'],
                ['save', 'SAVE SESSION', 'cyan'],
                ['proc', 'PROCESSES', 'cyan'],
                ['ports', 'PORTS', 'cyan'],
                ['agent', 'AI AGENT', 'emerald'],
            ];
            for (const [act, label, tone] of actions) {
                const button = document.createElement('button');
                button.className = 'ns-btn';
                button.dataset.act = act;
                button.dataset.tone = tone;
                button.textContent = label;
                this.el.quick.appendChild(button);
            }
            const spacer = document.createElement('span');
            spacer.style.flex = '1 1 auto';
            this.el.quick.appendChild(spacer);
            for (const [mode, label] of [['off', 'AI: OFF'], ['assist', 'AI ASSIST'], ['autonomous', 'AI AUTONOMOUS']]) {
                const button = document.createElement('button');
                button.className = 'ns-btn';
                button.dataset.act = `mode-${mode}`;
                button.dataset.tone = mode === 'autonomous' ? 'crimson' : mode === 'assist' ? 'amber' : 'cyan';
                button.dataset.modeButton = mode;
                button.textContent = label;
                this.el.quick.appendChild(button);
            }
        },

        buildAgentPanel() {
            const head = document.createElement('div');
            head.className = 'ns-agent-head';

            const goalInput = document.createElement('input');
            goalInput.className = 'ns-input ns-goal';
            goalInput.placeholder = 'Autonomous goal — e.g. "inspect this repository and summarise the unfinished experiments"';
            goalInput.dataset.role = 'goal';

            const numberField = (label, role, value, title) => {
                const wrapper = document.createElement('label');
                wrapper.textContent = label;
                wrapper.title = title;
                const input = document.createElement('input');
                input.className = 'ns-num';
                input.type = 'number';
                input.dataset.role = role;
                input.value = String(value);
                wrapper.appendChild(input);
                return wrapper;
            };
            const cwdField = document.createElement('label');
            cwdField.textContent = 'CWD';
            const cwdInput = document.createElement('input');
            cwdInput.className = 'ns-input';
            cwdInput.style.width = '170px';
            cwdInput.dataset.role = 'cwd';
            cwdInput.value = this.limits.cwd ?? '';
            cwdField.appendChild(cwdInput);

            const stopOnError = document.createElement('label');
            stopOnError.textContent = 'STOP ON ERROR';
            const stopBox = document.createElement('input');
            stopBox.type = 'checkbox';
            stopBox.dataset.role = 'stopOnError';
            stopBox.checked = Boolean(this.limits.stopOnError);
            stopOnError.prepend(stopBox);

            const run = document.createElement('button');
            run.className = 'ns-btn';
            run.dataset.act = 'run-agent';
            run.dataset.tone = 'emerald';
            run.textContent = 'RUN AGENT';

            const stop = document.createElement('button');
            stop.className = 'ns-btn';
            stop.dataset.act = 'stop-agent';
            stop.dataset.tone = 'crimson';
            stop.textContent = 'STOP AGENT';
            stop.disabled = true;

            head.append(
                goalInput,
                numberField('MAX STEPS', 'maxSteps', this.limits.maxSteps, 'hard bound on agent steps per run'),
                numberField('MAX RUNTIME s', 'maxRuntimeMs', Math.round((this.limits.maxRuntimeMs ?? 300000) / 1000), 'hard wall-clock bound per run'),
                cwdField,
                stopOnError,
                run,
                stop,
            );

            const log = document.createElement('div');
            log.className = 'ns-log';
            log.dataset.role = 'log';

            this.el.agent.append(head, log);
        },

        /* -------------------------------------------------------------- *
         * Session management
         * -------------------------------------------------------------- */
        async newSession(cwd = null) {
            try {
                const { session } = await request('/api/shell/sessions', {
                    method: 'POST',
                    body: { cwd: cwd ?? this.limits.cwd ?? undefined, cols: 110, rows: 28 },
                });
                this.attach(session);
                this.renderTabs();
                this.select(session.id);
                beep(1150, 'sine', 0.05, 0.03);
                return session;
            } catch (error) {
                this.toast(`cannot open a shell: ${error.message}`, 'error');
                return null;
            }
        },

        attach(session) {
            const record = {
                session,
                term: null,
                fit: null,
                socket: null,
                wrap: null,
                retries: 0,
                exited: false,
            };
            this.sessions.set(session.id, record);
            this.createTerminal(record);
            this.connect(record);
            return record;
        },

        createTerminal(record) {
            const wrap = document.createElement('div');
            wrap.className = 'ns-term';
            wrap.dataset.visible = 'false';
            this.el.stage.appendChild(wrap);

            const term = new window.Terminal({
                fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                lineHeight: 1.15,
                letterSpacing: 0,
                cursorBlink: true,
                cursorStyle: 'bar',
                scrollback: 20000,
                allowTransparency: true,
                macOptionIsMeta: true,
                theme: TERMINAL_THEME,
            });
            const fit = new window.FitAddon.FitAddon();
            term.loadAddon(fit);
            term.open(wrap);
            try { term.options.theme = TERMINAL_THEME; } catch { /* older xterm */ }

            term.onData((data) => this.send(record, { t: 'input', data }));
            term.onResize(({ cols, rows }) => this.send(record, { t: 'resize', cols, rows }));
            term.attachCustomKeyEventHandler((event) => {
                if (event.type !== 'keydown') return true;
                if (event.ctrlKey && event.shiftKey && event.code === 'KeyC') { this.copySelection(record); return false; }
                if (event.ctrlKey && event.shiftKey && event.code === 'KeyV') { this.paste(record); return false; }
                return true;
            });

            record.term = term;
            record.fit = fit;
            record.wrap = wrap;
            record.resizeObserver = new ResizeObserver(() => this.fitRecord(record));
            record.resizeObserver.observe(wrap);
        },

        connect(record) {
            if (record.socket && record.socket.readyState <= 1) return record.socket;
            const secure = window.location.protocol === 'https:';
            const url = `${secure ? 'wss' : 'ws'}://${window.location.host}/ws/shell?session=${encodeURIComponent(record.session.id)}&v=1`;
            const socket = new WebSocket(url);
            record.socket = socket;

            socket.onmessage = (event) => {
                let message = null;
                try { message = JSON.parse(event.data); } catch { return; }
                switch (message.t) {
                    case 'ready':
                        record.session = message.session;
                        record.retries = 0;
                        this.updateStrip();
                        this.writeNotice(record, `\u001b[38;5;51mnoosphere://${message.session.label.toLowerCase()} · ${this.status?.shell ?? 'shell'} · pid ${message.session.pid}\u001b[0m`);
                        break;
                    case 'data':
                        record.term.write(message.data);
                        break;
                    case 'cwd':
                        record.session.cwd = message.cwd;
                        if (this.active === record.session.id) this.updateStrip();
                        break;
                    case 'exit':
                        record.exited = true;
                        this.writeNotice(record, `\u001b[38;5;203m— process exited (code ${message.code ?? '?'}${message.signal ? `, signal ${message.signal}` : ''}) — press RESTART —\u001b[0m`);
                        this.renderTabs();
                        break;
                    case 'unavailable':
                        this.toast(`bridge unavailable: ${message.reason}`, 'error');
                        break;
                    case 'error':
                        this.toast(message.message, 'error');
                        break;
                    default:
                        break;
                }
            };
            socket.onclose = (event) => {
                if (event.code === 1000 || record.closed) return;
                if (record.retries >= 5) {
                    this.writeNotice(record, '\u001b[38;5;203m— bridge connection lost —\u001b[0m');
                    return;
                }
                record.retries += 1;
                setTimeout(() => { if (!record.closed) this.connect(record); }, Math.min(4000, 300 * record.retries));
            };
            socket.onerror = () => { /* onclose carries the recovery */ };
            return socket;
        },

        send(record, message) {
            if (!record?.socket || record.socket.readyState !== 1) return false;
            record.socket.send(JSON.stringify(message));
            return true;
        },

        select(id) {
            const record = this.sessions.get(id);
            if (!record) return;
            this.active = id;
            for (const [key, other] of this.sessions) {
                other.wrap.dataset.visible = String(key === id);
            }
            this.renderTabs();
            this.updateStrip();
            this.fitRecord(record);
            record.term.focus();
        },

        async closeSession(id) {
            const record = this.sessions.get(id);
            if (!record) return;
            record.closed = true;
            try { record.socket?.close(1000, 'closed by user'); } catch { /* ignore */ }
            record.resizeObserver?.disconnect();
            record.term.dispose();
            record.wrap.remove();
            this.sessions.delete(id);
            await request(`/api/shell/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
            if (this.active === id) {
                const next = [...this.sessions.keys()][0] ?? null;
                if (next) this.select(next);
                else { this.active = null; await this.newSession(); }
            }
            this.renderTabs();
            beep(420, 'square', 0.05, 0.03);
        },

        async restartActive() {
            const record = this.sessions.get(this.active);
            if (!record) return;
            const id = record.session.id;
            record.closed = true;
            try { record.socket?.close(1000, 'restart'); } catch { /* ignore */ }
            record.resizeObserver?.disconnect();
            record.term.dispose();
            record.wrap.remove();
            this.sessions.delete(id);
            try {
                const { session } = await request(`/api/shell/sessions/${encodeURIComponent(id)}/restart`, { method: 'POST' });
                this.attach(session);
                this.select(session.id);
                this.toast(`${session.label} restarted`);
            } catch (error) {
                this.toast(`restart failed: ${error.message}`, 'error');
                this.sessions.clear();
                await this.newSession();
            }
        },

        fitRecord(record) {
            if (!record?.wrap || record.wrap.dataset.visible !== 'true') return;
            try {
                record.fit.fit();
                this.fitPending = false;
            } catch { /* panel not measurable yet */ }
        },

        fitActive() {
            const record = this.sessions.get(this.active);
            if (record) this.fitRecord(record);
        },

        /* -------------------------------------------------------------- *
         * Chrome updates
         * -------------------------------------------------------------- */
        renderTabs() {
            this.el.tabs.innerHTML = '';
            for (const [id, record] of this.sessions) {
                const tab = document.createElement('button');
                tab.className = 'ns-tab';
                tab.dataset.active = String(id === this.active);
                tab.dataset.exited = String(record.exited);
                tab.dataset.act = 'select';
                tab.dataset.session = id;
                tab.textContent = `${record.session.label} · ${record.session.cwd?.split('/').pop() || '~'}`;
                const close = document.createElement('span');
                close.textContent = '✕';
                close.dataset.act = 'close-session';
                close.dataset.session = id;
                close.style.opacity = '0.6';
                tab.appendChild(close);
                this.el.tabs.appendChild(tab);
            }
            const add = document.createElement('button');
            add.className = 'ns-tab';
            add.dataset.act = 'new';
            add.textContent = '+ SHELL';
            this.el.tabs.appendChild(add);
        },

        updateStrip() {
            const record = this.sessions.get(this.active);
            if (!record || !this.refs) return;
            this.refs.host.textContent = this.status?.expose?.localOnly === false ? 'LOCAL + TOKEN' : 'LOCAL';
            this.refs.shell.textContent = this.status?.shell ?? '—';
            this.refs.pty.textContent = record.session.label;
            this.refs.pid.textContent = String(record.session.pid ?? '—');
            this.refs.cwd.textContent = record.session.cwd ?? '—';
            this.updateModeBadge();
        },

        updateModeBadge() {
            if (!this.refs?.mode) return;
            this.refs.mode.textContent = `AI SHELL CONTROL ● ${this.mode.toUpperCase()}`;
            const badge = this.refs.mode.closest('.ns-mode');
            if (badge) badge.dataset.mode = this.mode;
            for (const button of this.el?.quick?.querySelectorAll('[data-mode-button]') ?? []) {
                button.dataset.active = String(button.dataset.modeButton === this.mode);
            }
            const runButton = this.el?.agent?.querySelector('[data-act="run-agent"]');
            if (runButton) runButton.disabled = this.mode === 'off' || this.agent.running;
            const dockBadge = document.getElementById('shell-mode-badge');
            if (dockBadge) {
                const label = this.mode === 'off' ? 'AI: OFF' : this.mode === 'assist' ? 'AI: ASSIST' : 'AI: AUTONOMOUS';
                dockBadge.textContent = `PTY · ${label}`;
                dockBadge.className = this.mode === 'autonomous'
                    ? 'bg-rose-950/80 border border-rose-600/60 text-[10px] px-1.5 py-0.2 rounded text-rose-300 font-mono'
                    : this.mode === 'assist'
                        ? 'bg-amber-950/70 border border-amber-700/60 text-[10px] px-1.5 py-0.2 rounded text-amber-300 font-mono'
                        : 'bg-emerald-950/70 border border-emerald-700/60 text-[10px] px-1.5 py-0.2 rounded text-emerald-300 font-mono';
            }
        },

        toast(message, tone = 'info') {
            if (!this.el?.toast) return;
            this.el.toast.textContent = message;
            this.el.toast.dataset.tone = tone;
            this.el.toast.dataset.show = 'true';
            clearTimeout(this.toastTimer);
            this.toastTimer = setTimeout(() => { this.el.toast.dataset.show = 'false'; }, 4200);
        },

        writeNotice(record, text) {
            record.term.write(`\r\n${text}\r\n`);
        },

        /* -------------------------------------------------------------- *
         * Actions
         * -------------------------------------------------------------- */
        async onClick(event) {
            const target = event.target.closest('[data-act]');
            if (!target) return;
            const act = target.dataset.act;
            const record = this.sessions.get(this.active);

            switch (act) {
                case 'new':
                    await this.newSession();
                    break;
                case 'select':
                    this.select(target.dataset.session);
                    break;
                case 'close-session':
                    event.stopPropagation();
                    await this.closeSession(target.dataset.session);
                    break;
                case 'restart':
                    await this.restartActive();
                    break;
                case 'clear':
                    record?.term.clear();
                    break;
                case 'interrupt':
                    this.send(record, { t: 'interrupt' });
                    beep(520, 'square', 0.06, 0.04);
                    this.toast('Ctrl+C sent to the shell');
                    break;
                case 'kill':
                    this.send(record, { t: 'kill' });
                    this.toast('SIGTERM → SIGKILL sent to the session tree', 'error');
                    break;
                case 'copy':
                    this.copyAll(record);
                    break;
                case 'save':
                    await this.saveSession(record);
                    break;
                case 'proc':
                    await this.togglePanel(this.processPanel === 'processes' ? 'none' : 'processes');
                    break;
                case 'ports':
                    await this.togglePanel(this.processPanel === 'ports' ? 'none' : 'ports');
                    break;
                case 'agent':
                    this.el.agent.dataset.open = this.el.agent.dataset.open === 'true' ? 'false' : 'true';
                    this.fitActive();
                    break;
                case 'cycle-ai': {
                    const next = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
                    await this.setMode(next);
                    break;
                }
                case 'mode-off':
                case 'mode-assist':
                case 'mode-autonomous':
                    await this.setMode(act.replace('mode-', ''));
                    break;
                case 'run-agent':
                    await this.runAgent();
                    break;
                case 'stop-agent':
                    await this.stopAgent();
                    break;
                case 'kill-proc':
                    await this.killProcess(Number(target.dataset.pid));
                    break;
                case 'refresh-panel':
                    await this.togglePanel(this.processPanel, true);
                    break;
                default:
                    break;
            }
        },

        async setMode(mode) {
            try {
                const result = await request('/api/shell/ai', { method: 'POST', body: { mode } });
                this.mode = result.mode;
                this.limits = { ...this.limits, ...(result.limits ?? {}) };
                this.updateModeBadge();
                this.agentLog({
                    kind: mode === 'autonomous' ? 'action' : 'finish',
                    head: `AI SHELL CONTROL → ${mode.toUpperCase()}`,
                    body: mode === 'autonomous'
                        ? 'The local model may now execute commands in this shell without per-command confirmation. The mode is the authorisation — STOP AGENT, INTERRUPT and KILL PROCESS remain live.'
                        : mode === 'assist'
                            ? 'The local model may place commands in the input buffer. Nothing executes until you press Enter.'
                            : 'Tool surface removed. The model cannot reach the shell.',
                });
                beep(mode === 'autonomous' ? 320 : mode === 'assist' ? 660 : 880, 'triangle', 0.12, 0.05);
            } catch (error) {
                this.toast(`mode change refused: ${error.message}`, 'error');
            }
        },

        async togglePanel(which, force = false) {
            this.processPanel = force ? which : which;
            for (const button of this.el.quick.querySelectorAll('[data-act="proc"]')) button.dataset.active = String(this.processPanel === 'processes');
            for (const button of this.el.quick.querySelectorAll('[data-act="ports"]')) button.dataset.active = String(this.processPanel === 'ports');
            if (this.processPanel === 'none') {
                this.el.panel.hidden = true;
                this.fitActive();
                return;
            }
            this.el.panel.hidden = false;
            this.el.panel.innerHTML = '';
            const head = document.createElement('div');
            head.className = 'ns-panel-head';
            const title = document.createElement('span');
            const refresh = document.createElement('button');
            refresh.className = 'ns-btn';
            refresh.dataset.act = 'refresh-panel';
            refresh.textContent = 'REFRESH';
            head.append(title, refresh);
            this.el.panel.appendChild(head);
            const body = document.createElement('div');
            this.el.panel.appendChild(body);
            this.fitActive();

            try {
                if (this.processPanel === 'processes') {
                    const data = await request('/api/shell/processes');
                    title.textContent = `PROCESSES SPAWNED THROUGH NOÖSPHERE — ${data.owned.length} of ${data.total} on host`;
                    for (const row of data.owned) {
                        body.appendChild(this.processRow(row));
                    }
                    if (!data.owned.length) body.appendChild(this.emptyRow('no NOÖSPHERE-spawned processes are alive'));
                } else {
                    const data = await request('/api/shell/ports');
                    title.textContent = `LISTENING TCP SOCKETS — via ${data.tool ?? 'no tool available'}`;
                    for (const port of data.ports) body.appendChild(this.portRow(port));
                    if (!data.ports.length) body.appendChild(this.emptyRow(data.raw || 'no listening sockets reported'));
                }
            } catch (error) {
                body.appendChild(this.emptyRow(`panel unavailable: ${error.message}`));
            }
        },

        processRow(row) {
            const line = document.createElement('div');
            line.className = 'ns-row';
            const pid = document.createElement('span');
            pid.className = 'ns-pid';
            pid.textContent = `${row.pid}`;
            const command = document.createElement('span');
            command.className = 'ns-cmdline';
            command.textContent = `${row.sessionId ? '§ ' : ''}${row.command}  ·  cpu ${row.cpu}% · mem ${row.mem}% · ${row.elapsed}`;
            const kill = document.createElement('button');
            kill.className = 'ns-btn';
            kill.dataset.tone = 'crimson';
            kill.dataset.act = 'kill-proc';
            kill.dataset.pid = String(row.pid);
            kill.textContent = 'SIGKILL';
            line.append(pid, command, kill);
            return line;
        },

        portRow(port) {
            const line = document.createElement('div');
            line.className = 'ns-row';
            const pid = document.createElement('span');
            pid.className = 'ns-pid';
            pid.textContent = port.pid ? `${port.pid}` : '—';
            const command = document.createElement('span');
            command.className = 'ns-cmdline';
            command.textContent = `${port.endpoint}  ${port.process ?? ''}`;
            line.append(pid, command);
            return line;
        },

        emptyRow(text) {
            const line = document.createElement('div');
            line.className = 'ns-row';
            line.textContent = text;
            return line;
        },

        async killProcess(pid) {
            try {
                const result = await request('/api/shell/processes/kill', { method: 'POST', body: { pid } });
                this.toast(`pid ${pid} signalled (${result.signalled?.length ?? 0} in tree)`);
                await this.togglePanel(this.processPanel, true);
            } catch (error) {
                this.toast(`kill refused: ${error.message}`, 'error');
            }
        },

        async saveSession(record) {
            if (!record) return;
            try {
                const result = await request(`/api/shell/sessions/${encodeURIComponent(record.session.id)}/save`, { method: 'POST' });
                this.toast(`session saved → ${result.file}`);
                this.writeNotice(record, `\u001b[38;5;114m— session saved to ${result.file} —\u001b[0m`);
            } catch (error) {
                this.toast(`save failed: ${error.message}`, 'error');
            }
        },

        copySelection(record) {
            const selection = record?.term.getSelection();
            if (!selection) return this.toast('nothing selected');
            this.copyText(selection);
        },

        copyAll(record) {
            if (!record) return;
            const buffer = record.term.buffer.active;
            const lines = [];
            for (let index = 0; index < buffer.length; index += 1) {
                const line = buffer.getLine(index);
                if (line) lines.push(line.translateToString(true));
            }
            this.copyText(lines.join('\n'));
        },

        async copyText(text) {
            try {
                await navigator.clipboard.writeText(text);
                this.toast(`copied ${text.length} characters`);
            } catch {
                this.toast('clipboard refused — select the text and press ⌘C / Ctrl+Shift+C', 'error');
            }
        },

        async paste(record) {
            try {
                const text = await navigator.clipboard.readText();
                if (text) this.send(record, { t: 'input', data: text.replace(/\r/g, '\r') });
            } catch {
                this.toast('clipboard read refused — use ⌘V', 'error');
            }
        },

        /* -------------------------------------------------------------- *
         * Agent loop (server-sent events)
         * -------------------------------------------------------------- */
        agentFields() {
            const query = (role) => this.el.agent.querySelector(`[data-role="${role}"]`);
            const limits = {
                maxSteps: Number(query('maxSteps')?.value) || this.limits.maxSteps,
                maxRuntimeMs: (Number(query('maxRuntimeMs')?.value) || Math.round(this.limits.maxRuntimeMs / 1000)) * 1000,
                cwd: query('cwd')?.value?.trim() || '',
                stopOnError: Boolean(query('stopOnError')?.checked),
            };
            return { goal: query('goal')?.value?.trim() ?? '', limits };
        },

        agentLog({ kind, head, body, detail }) {
            const log = this.el.agent.querySelector('[data-role="log"]');
            if (!log) return;
            const entry = document.createElement('div');
            entry.className = 'ns-step';
            entry.dataset.kind = kind;
            const heading = document.createElement('div');
            heading.className = 'ns-step-head';
            const bold = document.createElement('b');
            bold.textContent = head;
            heading.appendChild(bold);
            entry.appendChild(heading);
            if (body) {
                const text = document.createElement('div');
                text.className = kind === 'action' ? 'ns-cmd' : 'ns-thought';
                text.textContent = body;
                entry.appendChild(text);
            }
            if (detail) {
                const pre = document.createElement('pre');
                pre.className = 'ns-out';
                pre.textContent = detail;
                entry.appendChild(pre);
            }
            log.appendChild(entry);
            log.scrollTop = log.scrollHeight;
        },

        async runAgent() {
            if (this.agent.running) return this.toast('an agent run is already active', 'error');
            if (this.mode === 'off') return this.toast('enable AI ASSIST or AI AUTONOMOUS first', 'error');
            const { goal, limits } = this.agentFields();
            if (!goal) return this.toast('state a goal for the agent', 'error');

            const controller = new AbortController();
            this.agent = { running: true, controller, runId: null, steps: 0 };
            this.updateModeBadge();
            this.el.agent.dataset.open = 'true';
            this.fitActive();
            this.agentLog({
                kind: 'action',
                head: `AGENT RUN → ${this.mode.toUpperCase()}`,
                body: goal,
                detail: `max steps ${limits.maxSteps} · max runtime ${Math.round(limits.maxRuntimeMs / 1000)}s · cwd ${limits.cwd || 'session default'} · stop on error ${limits.stopOnError ? 'yes' : 'no'}`,
            });

            try {
                const response = await fetch('/api/noosphere/agent/run', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ goal, sessionId: this.active, limits }),
                    signal: controller.signal,
                });
                if (!response.ok || !response.body) {
                    const problem = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                    this.agentLog({ kind: 'error', head: 'RUN REFUSED', body: problem.error ?? 'unknown error', detail: problem.hint });
                    return;
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
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
                        let event = null;
                        try { event = JSON.parse(line.slice(6)); } catch { continue; }
                        this.onAgentEvent(event);
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') this.agentLog({ kind: 'error', head: 'AGENT FAULT', body: error.message });
            } finally {
                this.agent.running = false;
                this.agent.controller = null;
                this.updateModeBadge();
            }
        },

        onAgentEvent(event) {
            const step = event.step ?? this.agent.steps;
            switch (event.type) {
                case 'start':
                    this.agent.runId = event.runId;
                    this.agent.steps = 0;
                    this.agentLog({
                        kind: 'finish',
                        head: `RUN ${event.runId} STARTED`,
                        body: `${event.model} · session ${event.session?.id} (${event.session?.label}) · pid ${event.session?.pid}`,
                    });
                    break;
                case 'thinking':
                    this.agent.steps = step;
                    this.agentLog({ kind: 'thought', head: `STEP ${step} · REASONING`, body: 'consulting the local model…' });
                    break;
                case 'action':
                    this.agentLog({
                        kind: 'action',
                        head: `STEP ${step} · ${event.tool}`,
                        body: this.describeTool(event.tool, event.args),
                        detail: event.thought || undefined,
                    });
                    break;
                case 'observation': {
                    const outcome = event.outcome ?? {};
                    const detail = outcome.output ?? outcome.text ?? JSON.stringify(outcome, null, 1);
                    this.agentLog({
                        kind: 'observation',
                        head: `STEP ${step} · OBSERVED${outcome.exitCode !== undefined && outcome.exitCode !== null ? ` (exit ${outcome.exitCode}${outcome.timedOut ? ', timeout' : ''})` : ''}`,
                        body: outcome.deferred ? '⏸ placed in the input buffer — press Enter to execute' : undefined,
                        detail: typeof detail === 'string' ? detail.slice(0, 4000) : String(detail),
                    });
                    break;
                }
                case 'awaiting-human':
                    this.agentLog({
                        kind: 'awaiting-human',
                        head: 'AWAITING HUMAN',
                        body: event.command ?? 'command placed in the input buffer',
                        detail: 'ASSIST mode never presses Enter. Review the command in the terminal, then execute it yourself.',
                    });
                    this.toast('command placed in the shell buffer — press Enter to run it');
                    break;
                case 'rejected':
                    this.agentLog({ kind: 'rejected', head: `STEP ${step} · REJECTED`, body: event.message });
                    break;
                case 'error':
                    this.agentLog({ kind: 'error', head: `STEP ${step} · ERROR`, body: event.message });
                    break;
                case 'finish':
                    this.agentLog({ kind: 'finish', head: `STEP ${step} · FINISH`, body: event.summary });
                    break;
                case 'done':
                    this.agentLog({
                        kind: 'finish',
                        head: `RUN COMPLETE · ${event.stopped}`,
                        body: `${event.steps} step(s) in ${(event.ms / 1000).toFixed(1)}s${event.aborted ? ' · ABORTED' : ''}`,
                        detail: event.summary || undefined,
                    });
                    beep(880, 'sine', 0.12, 0.04);
                    break;
                default:
                    break;
            }
        },

        describeTool(tool, args = {}) {
            switch (tool) {
                case 'shell_exec': return `$ ${args.command ?? ''}`;
                case 'shell_write': return `type → ${args.text ?? ''}`;
                case 'shell_new_session': return `open session ${args.cwd ? `at ${args.cwd}` : ''}`;
                case 'shell_close_session': return `close ${args.sessionId}`;
                case 'shell_read': return 'read scrollback';
                case 'shell_cwd': return 'read working directory';
                case 'shell_interrupt': return 'send Ctrl+C';
                default: return JSON.stringify(args);
            }
        },

        async stopAgent() {
            if (!this.agent.running) return;
            const runId = this.agent.runId;
            this.agent.controller?.abort();
            await request('/api/noosphere/agent/stop', { method: 'POST', body: { runId, sessionId: this.active } }).catch(() => {});
            this.agentLog({ kind: 'error', head: 'STOP REQUESTED', body: 'run aborted · Ctrl+C sent to the session' });
            beep(300, 'square', 0.15, 0.05);
        },

        /* -------------------------------------------------------------- *
         * Reconciliation with the server (survives page reloads of state)
         * -------------------------------------------------------------- */
        async reconcile() {
            try {
                const { sessions, ai } = await request('/api/shell/sessions');
                const seen = new Set();
                for (const session of sessions) {
                    seen.add(session.id);
                    const record = this.sessions.get(session.id);
                    if (record) {
                        record.session = { ...record.session, ...session };
                        if (session.exited && !record.exited) {
                            record.exited = true;
                            this.renderTabs();
                        }
                    } else if (!session.exited && session.attached === 0) {
                        // A session opened by the agent (or a previous page) shows up as a tab.
                        this.attach(session);
                        this.renderTabs();
                    }
                }
                for (const id of [...this.sessions.keys()]) {
                    if (!seen.has(id)) await this.closeSession(id);
                }
                this.mode = ai.mode;
                this.limits = { ...this.limits, ...ai.limits };
                this.renderTabs();
                this.updateStrip();
                if (!this.sessions.size && this.status?.available) {
                    const now = Date.now();
                    if (now - (this.lastAutoCreate ?? 0) > 10_000) {
                        this.lastAutoCreate = now;
                        await this.newSession();
                    }
                }
            } catch {
                /* the bridge is gone; the socket handlers surface it */
            }
        },
    };

    window.synapseShell = shell;

    const start = () => shell.boot().then(() => setInterval(() => shell.reconcile(), 5000));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
