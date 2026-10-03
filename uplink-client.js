/**
 * NOÖSPHERE // OS — Local-First Web Uplink & Research Workstation Client
 * ============================================================================
 * Connects the Polymath Terminal (`win-terminal`), Zaziopath Graph (`win-graph`),
 * Ingestion Vector (`win-uploader`), and Web Uplink Workstation (`win-uplink`)
 * to the local Node orchestration surface (`/api/uplink/*`).
 *
 * Strictly local-first:
 *  - Local reasoning remains exclusively on `llama3.1:8b` via Ollama.
 *  - Web sources remain ephemeral by default until explicitly ingested via
 *    `INGEST SOURCE`, `INGEST FINDING`, or `ADD TO GRAPH` (`/ingest <n>`).
 */
(function initNoosphereWebUplink() {
  const EPISTEMIC_BADGE_STYLES = {
    'PRIMARY SOURCE': 'bg-emerald-950/90 text-neon-emerald border-emerald-500/50',
    'SECONDARY SOURCE': 'bg-cyan-950/90 text-neon-cyan border-cyan-500/50',
    'SEARCH SNIPPET': 'bg-amber-950/90 text-neon-amber border-amber-500/50',
    'MODEL INFERENCE': 'bg-violet-950/90 text-neon-violet border-violet-500/50',
  };

  const state = {
    activeTab: 'synthesis', // 'synthesis' | 'sources' | 'browser' | 'settings'
    busy: false,
    currentQuery: '',
    category: 'general',
    timeRange: '',
    siteFilter: '',
    page: 1,
    capabilities: {
      search: { status: 'ONLINE', label: 'SEARCH // ONLINE' },
      crawler: { status: 'ONLINE', label: 'CRAWLER // ONLINE' },
      browser: { status: 'OFFLINE', label: 'BROWSER // OFFLINE' },
      ollama: { status: 'OFFLINE', label: 'OLLAMA // OFFLINE' },
    },
    telemetry: {
      webUplink: 'ACTIVE',
      searchNodes: 0,
      sourceCorpus: 0,
      browserMode: 'MANAGED',
      crawlDepth: 2,
      localCognition: 'llama3.1:8b',
      networkEgress: 'WEB ONLY',
      roundsCompleted: 0,
      pagesInspected: 0,
    },
    settings: {
      maxRounds: 3,
      maxSearchesPerRound: 5,
      maxPages: 15,
      maxCrawlDepth: 2,
      maxContextChars: 16000,
    },
    cache: {
      entries: 0,
      bytes: 0,
      hits: 0,
      misses: 0,
    },
    lastResearch: null,
    sources: [],
    researchPath: [],
    browserState: null,
    lastScreenshot: null,
    pendingConfirmation: null,
  };

  function el(id) {
    return document.getElementById(id);
  }

  function setBusy(busy, statusMsg = '') {
    state.busy = busy;
    const progressEl = el('uplink-progress-text');
    if (progressEl) {
      progressEl.textContent = statusMsg || (busy ? 'EXECUTING LOCAL RESEARCH LOOP...' : 'READY // IDLE');
      progressEl.className = busy
        ? 'text-[10px] font-mono text-neon-amber animate-pulse font-bold'
        : 'text-[10px] font-mono text-neon-emerald';
    }
    const uplinkStateEl = el('uplink-status-pill');
    if (uplinkStateEl) {
      uplinkStateEl.textContent = busy ? 'WEB UPLINK // SCANNING' : 'WEB UPLINK // ACTIVE';
    }
  }

  async function api(path, method = 'GET', body = undefined, timeoutMs = 110000) {
    const opts = {
      method,
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    };
    if (body !== undefined && method !== 'GET') {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.code = data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function renderTelemetryAndCapabilities() {
    const caps = state.capabilities;
    const tel = state.telemetry;

    const setBadge = (id, label, online) => {
      const node = el(id);
      if (!node) return;
      node.textContent = label;
      node.className = online
        ? 'px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/50 text-neon-emerald text-[9px] font-mono font-bold'
        : 'px-1.5 py-0.5 rounded bg-slate-900 border border-amber-700/50 text-neon-amber text-[9px] font-mono';
    };

    setBadge('cap-search', `SEARCH // ${caps.search?.status || 'ONLINE'}`, Boolean(caps.search?.online ?? true));
    setBadge('cap-crawler', `CRAWLER // ${caps.crawler?.status || 'ONLINE'}`, Boolean(caps.crawler?.online ?? true));
    setBadge('cap-browser', `BROWSER // ${caps.browser?.status || 'OFFLINE'}`, Boolean(caps.browser?.online));
    setBadge('cap-ollama', `OLLAMA // ${caps.ollama?.status || 'OFFLINE'}`, Boolean(caps.ollama?.online));

    const mapText = {
      'tel-search-nodes': `SEARCH NODES // ${tel.searchNodes ?? 0}`,
      'tel-source-corpus': `SOURCE CORPUS // ${state.sources.length}`,
      'tel-browser-mode': `BROWSER // ${tel.browserMode || 'MANAGED'}`,
      'tel-crawl-depth': `CRAWL DEPTH // ${tel.crawlDepth ?? state.settings.maxCrawlDepth}`,
      'tel-local-cog': `LOCAL COGNITION // ${caps.ollama?.online ? 'llama3.1:8b' : 'llama3.1:8b (FALLBACK)'}`,
      'tel-egress': `NETWORK EGRESS // WEB ONLY`,
      'tel-rounds': `ROUNDS // ${tel.roundsCompleted ?? 0}/${state.settings.maxRounds}`,
      'tel-pages': `PAGES // ${tel.pagesInspected ?? 0}/${state.settings.maxPages}`,
    };

    for (const [id, text] of Object.entries(mapText)) {
      const node = el(id);
      if (node) node.textContent = text;
    }
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    ['synthesis', 'sources', 'browser', 'settings'].forEach((t) => {
      const btn = el(`uplink-tab-btn-${t}`);
      const pane = el(`uplink-pane-${t}`);
      if (btn) {
        btn.className =
          t === tabName
            ? 'px-2.5 py-1 rounded bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-[10px] font-mono'
            : 'px-2.5 py-1 rounded bg-surface hover:bg-surface-bright border border-cyan-950 text-slate-400 text-[10px] font-mono';
      }
      if (pane) {
        if (t === tabName) pane.classList.remove('hidden');
        else pane.classList.add('hidden');
      }
    });
    if (tabName === 'synthesis') renderSynthesisPane();
    if (tabName === 'sources') renderSourcesPane();
    if (tabName === 'browser') renderBrowserPane();
    if (tabName === 'settings') renderSettingsPane();
  }

  function createEpistemicBadge(type) {
    const span = document.createElement('span');
    const style = EPISTEMIC_BADGE_STYLES[type] || EPISTEMIC_BADGE_STYLES['SECONDARY SOURCE'];
    span.className = `text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold ${style}`;
    span.textContent = type || 'SECONDARY SOURCE';
    return span;
  }

  function renderSynthesisPane() {
    const container = el('uplink-pane-synthesis');
    if (!container) return;
    container.innerHTML = '';

    if (!state.lastResearch && state.sources.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'p-3 rounded bg-surface/50 border border-cyan-900/50 text-slate-400 space-y-2 text-[11px] font-mono';
      empty.innerHTML = `
        <div class="text-neon-cyan font-bold">LOCAL RESEARCH INTELLIGENCE WORKSTATION // STANDBY</div>
        <p>Execute multi-hop research, read public webpages, crawl domains, or inspect dynamic sites while keeping all LLM cognition strictly local on <code class="text-neon-emerald">llama3.1:8b</code>.</p>
        <div class="grid grid-cols-2 gap-1.5 text-[10px] text-slate-300 pt-1">
          <div class="p-1.5 rounded bg-obsidian border border-cyan-950"><span class="text-neon-cyan font-bold">/research &lt;topic&gt;</span> — Bounded multi-hop loop</div>
          <div class="p-1.5 rounded bg-obsidian border border-cyan-950"><span class="text-neon-cyan font-bold">/web &lt;query&gt;</span> — Metasearch (SearXNG/Fallback)</div>
          <div class="p-1.5 rounded bg-obsidian border border-cyan-950"><span class="text-neon-cyan font-bold">/read &lt;URL&gt;</span> — SSRF-safe Page Reader</div>
          <div class="p-1.5 rounded bg-obsidian border border-cyan-950"><span class="text-neon-cyan font-bold">/crawl &lt;URL&gt;</span> — Bounded site crawler</div>
          <div class="p-1.5 rounded bg-obsidian border border-cyan-950"><span class="text-neon-cyan font-bold">/site &lt;domain&gt; &lt;q&gt;</span> — Domain-scoped research</div>
          <div class="p-1.5 rounded bg-obsidian border border-cyan-950"><span class="text-neon-cyan font-bold">/browser &lt;URL&gt;</span> — Managed local browser</div>
          <div class="p-1.5 rounded bg-obsidian border border-cyan-950"><span class="text-neon-cyan font-bold">/news &lt;query&gt;</span> — Recency-weighted research</div>
          <div class="p-1.5 rounded bg-obsidian border border-cyan-950"><span class="text-neon-cyan font-bold">/ingest &lt;#&gt;</span> — Ingest source into Zaziopath</div>
        </div>
      `;
      container.appendChild(empty);
      return;
    }

    // 1. Research Path Trail
    if (Array.isArray(state.researchPath) && state.researchPath.length > 0) {
      const pathBox = document.createElement('div');
      pathBox.className = 'p-2.5 rounded bg-obsidian/90 border border-cyan-900/60 space-y-1';
      const pathHeader = document.createElement('div');
      pathHeader.className = 'text-[10px] font-bold text-neon-cyan flex justify-between items-center';
      pathHeader.textContent = 'RESEARCH PATH // MULTI-HOP PROVENANCE TRAIL';
      const pathFlow = document.createElement('div');
      pathFlow.className = 'text-[10px] text-slate-300 font-mono leading-relaxed break-words';
      pathFlow.textContent = state.researchPath.map((p) => `[R${p.round || 1}:${p.type}] ${p.label}`).join('  →  ');
      pathBox.appendChild(pathHeader);
      pathBox.appendChild(pathFlow);
      container.appendChild(pathBox);
    }

    // 2. Web Synthesis & Epistemic Separation
    if (state.lastResearch) {
      const synthBox = document.createElement('div');
      synthBox.className = 'p-3 rounded bg-surface/70 border border-cyan-800/60 space-y-2';

      const topBar = document.createElement('div');
      topBar.className = 'flex items-center justify-between border-b border-cyan-950 pb-1.5';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'text-neon-emerald font-bold text-xs';
      titleSpan.textContent = `WEB SYNTHESIS // ${state.currentQuery || 'RESEARCH REPORT'}`;

      const actGroup = document.createElement('div');
      actGroup.className = 'flex items-center space-x-1.5';

      const ingestFindingBtn = document.createElement('button');
      ingestFindingBtn.className = 'px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/50 text-neon-amber text-[9px] font-bold';
      ingestFindingBtn.textContent = 'INGEST FINDING';
      ingestFindingBtn.onclick = () => webUplink.ingestFinding();

      const addGraphBtn = document.createElement('button');
      addGraphBtn.className = 'px-2 py-0.5 rounded bg-neon-cyan/15 hover:bg-neon-cyan/30 border border-neon-cyan/50 text-neon-cyan text-[9px] font-bold';
      addGraphBtn.textContent = 'ADD TO GRAPH';
      addGraphBtn.onclick = () => webUplink.ingestFinding('ADD TO GRAPH');

      actGroup.appendChild(ingestFindingBtn);
      actGroup.appendChild(addGraphBtn);
      topBar.appendChild(titleSpan);
      topBar.appendChild(actGroup);
      synthBox.appendChild(topBar);

      // Epistemic summary bar
      const eb = state.lastResearch.epistemicBreakdown || {};
      const epBar = document.createElement('div');
      epBar.className = 'grid grid-cols-4 gap-1.5 text-[9px] pt-1';
      const epItems = [
        { label: 'PRIMARY SOURCE', count: (eb.primarySources || []).length, cls: 'text-neon-emerald border-emerald-800/60' },
        { label: 'SECONDARY SOURCE', count: (eb.secondarySources || []).length, cls: 'text-neon-cyan border-cyan-800/60' },
        { label: 'SEARCH SNIPPET', count: (eb.searchSnippets || []).length, cls: 'text-neon-amber border-amber-800/60' },
        { label: 'MODEL INFERENCE', count: state.lastResearch.model === 'llama3.1:8b' ? 'llama3.1:8b' : 'EXTRACTIVE', cls: 'text-neon-violet border-violet-800/60' },
      ];
      for (const item of epItems) {
        const cell = document.createElement('div');
        cell.className = `p-1.5 rounded bg-obsidian/80 border ${item.cls} text-center`;
        const l1 = document.createElement('div');
        l1.className = 'text-slate-500 text-[8px]';
        l1.textContent = item.label;
        const l2 = document.createElement('div');
        l2.className = 'font-bold mt-0.5';
        l2.textContent = String(item.count);
        cell.appendChild(l1);
        cell.appendChild(l2);
        epBar.appendChild(cell);
      }
      synthBox.appendChild(epBar);

      const bodyText = document.createElement('div');
      bodyText.className = 'text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed pt-1';
      bodyText.textContent = state.lastResearch.synthesis || '';
      synthBox.appendChild(bodyText);

      container.appendChild(synthBox);
    }

    // 3. Compact Citation List
    if (state.sources.length > 0) {
      const citBox = document.createElement('div');
      citBox.className = 'p-2.5 rounded bg-obsidian/80 border border-cyan-950 space-y-1.5';
      const citHead = document.createElement('div');
      citHead.className = 'text-[10px] font-bold text-neon-cyan';
      citHead.textContent = `CITATIONS & SOURCE PROVENANCE (${state.sources.length} SOURCES — EPHEMERAL UNTIL INGESTED)`;
      citBox.appendChild(citHead);

      state.sources.forEach((src, i) => {
        const idx = src.id || i + 1;
        const row = document.createElement('div');
        row.className = 'p-2 rounded bg-surface/60 border border-slate-800 flex items-start justify-between gap-2 text-[10px]';

        const left = document.createElement('div');
        left.className = 'space-y-0.5 min-w-0 flex-1';

        const topLine = document.createElement('div');
        topLine.className = 'flex items-center flex-wrap gap-1.5';
        const numSpan = document.createElement('span');
        numSpan.className = 'text-neon-cyan font-bold';
        numSpan.textContent = `[${idx}]`;
        const linkEl = document.createElement('a');
        linkEl.href = src.url;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener noreferrer';
        linkEl.className = 'text-slate-100 hover:text-neon-cyan underline font-bold truncate';
        linkEl.textContent = src.title || src.url;

        topLine.appendChild(numSpan);
        topLine.appendChild(linkEl);
        topLine.appendChild(createEpistemicBadge(src.sourceType || 'SECONDARY SOURCE'));

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'text-[9px] text-slate-400';
        scoreSpan.textContent = `${src.domain || ''}${src.publishedDate ? ` · ${src.publishedDate}` : ''} · Q:${src.qualityScore ?? src.score ?? 70}`;
        topLine.appendChild(scoreSpan);

        const snipP = document.createElement('p');
        snipP.className = 'text-slate-400 text-[10px] line-clamp-2';
        snipP.textContent = src.excerpt || src.snippet || '';

        left.appendChild(topLine);
        left.appendChild(snipP);

        const right = document.createElement('div');
        right.className = 'flex flex-col space-y-1 shrink-0';

        const ingestBtn = document.createElement('button');
        ingestBtn.className = 'px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/50 text-neon-amber text-[9px] font-bold';
        ingestBtn.textContent = 'INGEST SOURCE';
        ingestBtn.onclick = () => webUplink.ingestSource(idx, 'INGEST SOURCE');

        const graphBtn = document.createElement('button');
        graphBtn.className = 'px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/50 text-neon-emerald text-[9px] font-bold';
        graphBtn.textContent = 'ADD TO GRAPH';
        graphBtn.onclick = () => webUplink.ingestSource(idx, 'ADD TO GRAPH');

        right.appendChild(ingestBtn);
        right.appendChild(graphBtn);

        row.appendChild(left);
        row.appendChild(right);
        citBox.appendChild(row);
      });

      container.appendChild(citBox);
    }
  }

  function renderSourcesPane() {
    const container = el('uplink-pane-sources');
    if (!container) return;
    container.innerHTML = '';

    if (state.sources.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'p-3 rounded bg-surface/50 border border-cyan-950 text-slate-400 text-xs font-mono';
      empty.textContent = 'No sources in current session corpus. Run /web, /read, /crawl, or /research to populate sources.';
      container.appendChild(empty);
      return;
    }

    state.sources.forEach((src, i) => {
      const idx = src.id || i + 1;
      const card = document.createElement('div');
      card.className = 'p-2.5 rounded bg-surface/70 border border-cyan-900/50 space-y-1.5 text-[11px] font-mono';

      const header = document.createElement('div');
      header.className = 'flex items-center justify-between gap-2 flex-wrap';

      const leftHead = document.createElement('div');
      leftHead.className = 'flex items-center gap-1.5 flex-wrap';
      const idBadge = document.createElement('span');
      idBadge.className = 'text-neon-cyan font-bold';
      idBadge.textContent = `[#${idx}]`;
      const a = document.createElement('a');
      a.href = src.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'text-slate-100 hover:text-neon-cyan underline font-bold';
      a.textContent = src.title || src.url;

      leftHead.appendChild(idBadge);
      leftHead.appendChild(a);
      leftHead.appendChild(createEpistemicBadge(src.sourceType || 'SECONDARY SOURCE'));

      const scoreBadge = document.createElement('span');
      scoreBadge.className = 'px-1.5 py-0.5 rounded bg-obsidian border border-cyan-800 text-neon-cyan text-[9px] font-bold';
      scoreBadge.textContent = `QUALITY SCORE: ${src.qualityScore ?? src.score ?? 70}/100`;

      header.appendChild(leftHead);
      header.appendChild(scoreBadge);

      const metaLine = document.createElement('div');
      metaLine.className = 'text-[10px] text-slate-400';
      const qb = src.qualityBreakdown || {};
      metaLine.textContent = [
        `Domain: ${src.domain || 'unknown'} (${qb.domainTier || 'web'})`,
        `Engine: ${src.engine || 'web'}`,
        src.publishedDate ? `Date: ${src.publishedDate}` : 'Date: n/a',
        src.author ? `Author: ${src.author}` : null,
      ]
        .filter(Boolean)
        .join('  ·  ');

      const excerptEl = document.createElement('p');
      excerptEl.className = 'text-slate-300 text-[10px] leading-relaxed bg-obsidian/70 p-2 rounded border border-slate-800';
      excerptEl.textContent = src.excerpt || src.snippet || '(No excerpt text)';

      const actions = document.createElement('div');
      actions.className = 'flex items-center gap-1.5 pt-1 flex-wrap';

      const mkBtn = (label, cls, fn) => {
        const b = document.createElement('button');
        b.className = `px-2 py-0.5 rounded border text-[9px] font-bold ${cls}`;
        b.textContent = label;
        b.onclick = fn;
        return b;
      };

      actions.appendChild(
        mkBtn('INGEST SOURCE', 'bg-amber-500/15 hover:bg-amber-500/30 border-amber-500/50 text-neon-amber', () =>
          webUplink.ingestSource(idx, 'INGEST SOURCE'),
        ),
      );
      actions.appendChild(
        mkBtn('ADD TO GRAPH', 'bg-emerald-500/15 hover:bg-emerald-500/30 border-emerald-500/50 text-neon-emerald', () =>
          webUplink.ingestSource(idx, 'ADD TO GRAPH'),
        ),
      );
      actions.appendChild(
        mkBtn('READ FULL PAGE', 'bg-cyan-500/15 hover:bg-cyan-500/30 border-cyan-500/50 text-neon-cyan', () =>
          webUplink.readUrl(src.url),
        ),
      );
      actions.appendChild(
        mkBtn('OPEN IN BROWSER', 'bg-violet-500/15 hover:bg-violet-500/30 border-violet-500/50 text-neon-violet', () =>
          webUplink.openBrowser(src.url),
        ),
      );

      card.appendChild(header);
      card.appendChild(metaLine);
      card.appendChild(excerptEl);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  function renderBrowserPane() {
    const container = el('uplink-pane-browser');
    if (!container) return;
    container.innerHTML = '';

    const bState = state.browserState;

    // Browser Controls Bar
    const ctrlBar = document.createElement('div');
    ctrlBar.className = 'p-2 rounded bg-obsidian border border-cyan-900/60 space-y-2';

    const urlRow = document.createElement('div');
    urlRow.className = 'flex items-center space-x-1.5';

    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.id = 'uplink-browser-url-input';
    urlInput.placeholder = 'https://example.com (Managed isolated profile — SSRF-guarded)';
    urlInput.value = bState?.url || '';
    urlInput.className = 'flex-1 bg-surface border border-cyan-900 px-2 py-1 rounded text-[11px] font-mono text-slate-100 outline-none';
    urlInput.onkeydown = (e) => {
      if (e.key === 'Enter') webUplink.openBrowser(urlInput.value);
    };

    const openBtn = document.createElement('button');
    openBtn.className = 'px-2.5 py-1 rounded bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-[10px]';
    openBtn.textContent = 'OPEN URL';
    openBtn.onclick = () => webUplink.openBrowser(urlInput.value);

    urlRow.appendChild(urlInput);
    urlRow.appendChild(openBtn);
    ctrlBar.appendChild(urlRow);

    const btnRow = document.createElement('div');
    btnRow.className = 'flex items-center justify-between flex-wrap gap-1.5 text-[10px]';

    const navBtns = document.createElement('div');
    navBtns.className = 'flex items-center space-x-1';
    const mkActionBtn = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'px-2 py-0.5 rounded bg-surface hover:bg-surface-bright border border-cyan-900 text-slate-300 hover:text-neon-cyan';
      b.textContent = label;
      b.onclick = fn;
      return b;
    };
    navBtns.appendChild(mkActionBtn('▲ SCROLL UP', () => webUplink.browserAction('scroll', { direction: 'up' })));
    navBtns.appendChild(mkActionBtn('▼ SCROLL DOWN', () => webUplink.browserAction('scroll', { direction: 'down' })));
    navBtns.appendChild(mkActionBtn('⟳ READ DOM', () => webUplink.browserAction('read', {})));
    navBtns.appendChild(mkActionBtn('◉ SCREENSHOT', () => webUplink.browserAction('screenshot', {})));

    const profileBadge = document.createElement('span');
    profileBadge.className = 'text-[9px] text-neon-emerald font-mono';
    profileBadge.textContent = `PROFILE // ISOLATED MANAGED · ENGINE // ${(bState?.engine || 'STANDBY').toUpperCase()}`;

    btnRow.appendChild(navBtns);
    btnRow.appendChild(profileBadge);
    ctrlBar.appendChild(btnRow);
    container.appendChild(ctrlBar);

    // Consequential Action Confirmation Banner (if a sensitive action was blocked)
    if (state.pendingConfirmation) {
      const warnBox = document.createElement('div');
      warnBox.className = 'p-2.5 rounded bg-rose-950/80 border border-neon-crimson text-slate-100 space-y-1.5 text-[10px] font-mono';
      const warnTitle = document.createElement('div');
      warnTitle.className = 'text-neon-crimson font-bold';
      warnTitle.textContent = '⚠ CONSEQUENTIAL ACTION BLOCKED — EXPLICIT CONFIRMATION REQUIRED';
      const warnReason = document.createElement('p');
      warnReason.textContent = state.pendingConfirmation.reason;

      const warnBtns = document.createElement('div');
      warnBtns.className = 'flex items-center space-x-2 pt-1';
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'px-2 py-0.5 rounded bg-neon-crimson text-white font-bold';
      confirmBtn.textContent = 'CONFIRM & PROCEED';
      confirmBtn.onclick = () => {
        const pending = state.pendingConfirmation;
        state.pendingConfirmation = null;
        webUplink.browserAction(pending.action, { ...pending.payload, confirmed: true });
      };
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'px-2 py-0.5 rounded bg-surface border border-slate-700 text-slate-300';
      cancelBtn.textContent = 'ABORT ACTION';
      cancelBtn.onclick = () => {
        state.pendingConfirmation = null;
        renderBrowserPane();
      };
      warnBtns.appendChild(confirmBtn);
      warnBtns.appendChild(cancelBtn);
      warnBox.appendChild(warnTitle);
      warnBox.appendChild(warnReason);
      warnBox.appendChild(warnBtns);
      container.appendChild(warnBox);
    }

    if (!bState || !bState.active) {
      const standby = document.createElement('div');
      standby.className = 'p-3 rounded bg-surface/50 border border-cyan-950 text-slate-400 text-[11px] font-mono';
      standby.textContent =
        bState?.message ||
        'Managed local browser is in standby. Enter a public URL above or run `/browser https://example.com`. Personal logged-in browser profiles are never used.';
      container.appendChild(standby);
      return;
    }

    // Screenshot Preview (if captured)
    if (state.lastScreenshot?.dataUrl) {
      const shotBox = document.createElement('div');
      shotBox.className = 'p-2 rounded bg-obsidian border border-cyan-900/60 space-y-1';
      const shotLabel = document.createElement('div');
      shotLabel.className = 'text-[9px] text-neon-cyan font-bold flex justify-between';
      shotLabel.textContent = `VIEWPORT SNAPSHOT // ${state.lastScreenshot.timestamp || ''}`;
      const img = document.createElement('img');
      img.src = state.lastScreenshot.dataUrl;
      img.alt = 'Managed Browser Viewport Snapshot';
      img.className = 'w-full max-h-44 object-contain rounded border border-slate-800';
      shotBox.appendChild(shotLabel);
      shotBox.appendChild(img);
      container.appendChild(shotBox);
    }

    // Visible Page State & Rendered Text
    const viewBox = document.createElement('div');
    viewBox.className = 'p-2.5 rounded bg-surface/70 border border-cyan-900/60 space-y-1.5 font-mono text-[11px]';
    const viewHead = document.createElement('div');
    viewHead.className = 'flex justify-between items-center text-[10px] border-b border-cyan-950 pb-1';
    const tSpan = document.createElement('span');
    tSpan.className = 'text-neon-emerald font-bold truncate';
    tSpan.textContent = `${bState.title || bState.url} (Scroll: ${bState.scrollPercent ?? 100}%)`;
    viewHead.appendChild(tSpan);

    const textPre = document.createElement('div');
    textPre.className = 'text-slate-200 whitespace-pre-wrap text-[10px] leading-relaxed max-h-40 overflow-y-auto';
    textPre.textContent = bState.visibleText || '(Empty viewport)';

    viewBox.appendChild(viewHead);
    viewBox.appendChild(textPre);
    container.appendChild(viewBox);

    // Interactive Links Table
    if (Array.isArray(bState.links) && bState.links.length > 0) {
      const linksBox = document.createElement('div');
      linksBox.className = 'p-2 rounded bg-obsidian/80 border border-cyan-950 space-y-1';
      const lTitle = document.createElement('div');
      lTitle.className = 'text-[10px] font-bold text-neon-cyan';
      lTitle.textContent = `INTERACTIVE DOM TARGETS (${bState.links.length} LINKS — CLICK TO NAVIGATE)`;
      linksBox.appendChild(lTitle);

      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-1 gap-1 max-h-32 overflow-y-auto';
      bState.links.slice(0, 15).forEach((l) => {
        const btn = document.createElement('button');
        btn.className =
          'text-left px-2 py-1 rounded bg-surface/60 hover:bg-surface-bright border border-slate-800 text-[10px] font-mono flex items-center justify-between';
        const leftSpan = document.createElement('span');
        leftSpan.className = 'truncate text-slate-200';
        leftSpan.textContent = `[L${l.index}] ${l.text}`;
        const rightSpan = document.createElement('span');
        rightSpan.className = 'text-[9px] text-neon-cyan shrink-0 ml-2';
        rightSpan.textContent = l.url.slice(0, 42);
        btn.appendChild(leftSpan);
        btn.appendChild(rightSpan);
        btn.onclick = () => webUplink.browserAction('click', { target: String(l.index) });
        grid.appendChild(btn);
      });
      linksBox.appendChild(grid);
      container.appendChild(linksBox);
    }
  }

  function renderSettingsPane() {
    const container = el('uplink-pane-settings');
    if (!container) return;
    container.innerHTML = '';

    const s = state.settings;
    const c = state.cache;

    const form = document.createElement('div');
    form.className = 'p-3 rounded bg-surface/60 border border-cyan-900/60 space-y-3 text-[11px] font-mono';

    form.innerHTML = `
      <div class="text-neon-cyan font-bold text-xs border-b border-cyan-950 pb-1">MULTI-HOP RESEARCH BOUNDS &amp; PRIVACY CONTROLS</div>
      <div class="grid grid-cols-2 gap-2.5">
        <div>
          <label class="block text-[10px] text-slate-400 mb-1">MAX RESEARCH ROUNDS (1–5):</label>
          <input id="set-max-rounds" type="number" min="1" max="5" value="${s.maxRounds}" class="w-full bg-obsidian border border-cyan-900 px-2 py-1 rounded text-slate-100" />
        </div>
        <div>
          <label class="block text-[10px] text-slate-400 mb-1">SEARCHES / ROUND (1–8):</label>
          <input id="set-max-searches" type="number" min="1" max="8" value="${s.maxSearchesPerRound}" class="w-full bg-obsidian border border-cyan-900 px-2 py-1 rounded text-slate-100" />
        </div>
        <div>
          <label class="block text-[10px] text-slate-400 mb-1">MAX PAGES / SESSION (2–25):</label>
          <input id="set-max-pages" type="number" min="2" max="25" value="${s.maxPages}" class="w-full bg-obsidian border border-cyan-900 px-2 py-1 rounded text-slate-100" />
        </div>
        <div>
          <label class="block text-[10px] text-slate-400 mb-1">MAX CRAWL DEPTH (0–4):</label>
          <input id="set-max-depth" type="number" min="0" max="4" value="${s.maxCrawlDepth}" class="w-full bg-obsidian border border-cyan-900 px-2 py-1 rounded text-slate-100" />
        </div>
      </div>
      <div class="flex items-center justify-between pt-1">
        <button id="btn-save-uplink-settings" class="px-3 py-1 rounded bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-[10px]">APPLY RESEARCH LIMITS</button>
        <button id="btn-clear-uplink-cache" class="px-3 py-1 rounded bg-rose-950/60 border border-neon-crimson/60 text-neon-crimson font-bold text-[10px]">CLEAR BOUNDED CACHE (${c.entries || 0} ITEMS · ${Math.round((c.bytes || 0) / 1024)} KB)</button>
      </div>
      <div class="p-2 rounded bg-obsidian/90 border border-cyan-950 text-[10px] text-slate-400 space-y-1">
        <div class="text-neon-emerald font-bold">LOCAL-FIRST SECURITY &amp; PRIVACY BOUNDARY:</div>
        <div>• Local LLM: Exclusively <code class="text-neon-cyan">llama3.1:8b</code> via localhost Ollama (<code class="text-neon-cyan">127.0.0.1:11434</code>). No cloud LLMs.</div>
        <div>• Prompt-Injection Defense: Webpage text is isolated inside <code class="text-neon-cyan">&lt;untrusted_web_evidence&gt;</code> fences as passive data, never instructions.</div>
        <div>• SSRF Guard: Blocks localhost, RFC1918 private LAN IPs, link-local/cloud metadata (<code class="text-neon-cyan">169.254.169.254</code>), DNS rebinding, and <code class="text-neon-cyan">file://</code>.</div>
        <div>• Corpus Privacy: Zaziopath graph &amp; local ingested files stay local and are never sent to search engines.</div>
      </div>
    `;

    container.appendChild(form);

    const saveBtn = el('btn-save-uplink-settings');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const patch = {
          maxRounds: Number(el('set-max-rounds')?.value || 3),
          maxSearchesPerRound: Number(el('set-max-searches')?.value || 5),
          maxPages: Number(el('set-max-pages')?.value || 15),
          maxCrawlDepth: Number(el('set-max-depth')?.value || 2),
        };
        try {
          const res = await api('/api/uplink/settings', 'POST', patch);
          state.settings = res.settings || patch;
          state.cache = res.cache || state.cache;
          renderTelemetryAndCapabilities();
          renderSettingsPane();
          polymathLLM.appendChat('system', `Web Uplink limits updated: rounds=${state.settings.maxRounds}, searches/round=${state.settings.maxSearchesPerRound}, maxPages=${state.settings.maxPages}, maxCrawlDepth=${state.settings.maxCrawlDepth}.`);
        } catch (err) {
          polymathLLM.appendChat('system', `Settings update error: ${err.message}`);
        }
      };
    }

    const clearBtn = el('btn-clear-uplink-cache');
    if (clearBtn) {
      clearBtn.onclick = () => webUplink.clearCache();
    }
  }

  /**
   * Appends a rich Web Research synthesis + clickable citations card into `#terminal-output`.
   */
  function appendRichResearchToTerminal(title, reportData) {
    const container = el('terminal-output');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'p-3 rounded bg-obsidian border border-cyan-700/60 text-slate-200 font-mono space-y-2 shadow-lg';

    const header = document.createElement('div');
    header.className = 'text-neon-cyan font-bold flex items-center justify-between border-b border-cyan-950 pb-1';
    const hLeft = document.createElement('span');
    hLeft.textContent = `🛰️ ${title}`;
    const hRight = document.createElement('span');
    hRight.className = 'text-[9px] text-neon-emerald';
    hRight.textContent = reportData.model === 'llama3.1:8b' ? 'LOCAL COGNITION // llama3.1:8b' : 'EXTRACTIVE // VERIFIED TOOL OUTPUT';
    header.appendChild(hLeft);
    header.appendChild(hRight);
    card.appendChild(header);

    // Main synthesis text
    if (reportData.synthesis) {
      const synthLabel = document.createElement('div');
      synthLabel.className = 'text-[10px] font-bold text-neon-emerald';
      synthLabel.textContent = 'WEB SYNTHESIS';
      const synthBody = document.createElement('div');
      synthBody.className = 'text-[11px] text-slate-200 whitespace-pre-wrap leading-relaxed';
      synthBody.textContent = reportData.synthesis;
      card.appendChild(synthLabel);
      card.appendChild(synthBody);
    }

    // Sources list with clickable links and explicit Zaziopath ingestion buttons
    const sources = reportData.sources || reportData.results || reportData.pages || [];
    if (sources.length > 0) {
      const srcHeader = document.createElement('div');
      srcHeader.className = 'text-[10px] font-bold text-neon-cyan pt-1 border-t border-cyan-950';
      srcHeader.textContent = 'SOURCES';
      card.appendChild(srcHeader);

      const srcList = document.createElement('div');
      srcList.className = 'space-y-1 text-[10px]';
      sources.slice(0, 10).forEach((s, idx) => {
        const num = s.id || idx + 1;
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-2 bg-surface/50 px-2 py-1 rounded border border-slate-800';

        const left = document.createElement('div');
        left.className = 'truncate flex items-center gap-1.5 min-w-0 flex-1';
        const numEl = document.createElement('span');
        numEl.className = 'text-neon-cyan font-bold shrink-0';
        numEl.textContent = `[${num}]`;
        const link = document.createElement('a');
        link.href = s.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'text-slate-100 hover:text-neon-cyan underline truncate';
        link.textContent = `${s.title || s.url} — ${s.domain || ''}`;
        left.appendChild(numEl);
        left.appendChild(link);
        left.appendChild(createEpistemicBadge(s.sourceType || 'SECONDARY SOURCE'));

        const ingestBtn = document.createElement('button');
        ingestBtn.className = 'px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/50 text-neon-amber text-[9px] font-bold shrink-0';
        ingestBtn.textContent = 'INGEST SOURCE';
        ingestBtn.onclick = () => webUplink.ingestSource(num, 'INGEST SOURCE');

        row.appendChild(left);
        row.appendChild(ingestBtn);
        srcList.appendChild(row);
      });
      card.appendChild(srcList);
    }

    // Research Path
    if (Array.isArray(reportData.researchPath) && reportData.researchPath.length > 0) {
      const pathHeader = document.createElement('div');
      pathHeader.className = 'text-[10px] font-bold text-neon-amber pt-1 border-t border-cyan-950';
      pathHeader.textContent = 'RESEARCH PATH';
      const pathBody = document.createElement('div');
      pathBody.className = 'text-[10px] text-slate-400';
      pathBody.textContent = reportData.researchPath.map((p) => `${p.type}(${p.label})`).join(' → ');
      card.appendChild(pathHeader);
      card.appendChild(pathBody);
    }

    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  }

  /**
   *Applies an explicit Zaziopath ingestion record to the Graph Vault, Ingestion History,
   * and Polymath context while strictly marking provenance as WEB SOURCE.
   */
  function applyIngestedRecordToZaziopath(record) {
    if (!record || !record.graphNode) return;
    const gn = record.graphNode;

    // 1. Inject node into Zaziopath Force Graph with explicit WEB SOURCE provenance
    if (typeof graphEngine !== 'undefined' && typeof graphEngine.injectNode === 'function') {
      graphEngine.injectNode(gn.title, gn.domain || 'semiotics', gn.desc);
      const newestNode = typeof graphNodes !== 'undefined' ? graphNodes[graphNodes.length - 1] : null;
      if (newestNode) {
        newestNode.provenance = 'WEB SOURCE';
        newestNode.url = record.url;
        newestNode.retrievedAt = record.retrievedAt;
        newestNode.sourceType = record.sourceType || record.epistemicType || 'WEB SOURCE';
      }
    }

    // 2. Record in polymathLLM.ingested with strict separation between Quoted Web Source and Local Ollama Interpretation
    if (typeof polymathLLM !== 'undefined' && Array.isArray(polymathLLM.ingested)) {
      polymathLLM.ingested.push({
        file: `[WEB SOURCE] ${record.title} (${record.url})`,
        provenance: 'WEB SOURCE',
        url: record.url,
        retrievedAt: record.retrievedAt,
        sourceType: record.sourceType || 'WEB SOURCE',
        quotedSourceText: record.quotedSourceText || '',
        localOllamaInterpretation: record.localOllamaInterpretation || null,
        text: `[PROVENANCE: WEB SOURCE | URL: ${record.url} | RETRIEVED: ${record.retrievedAt}]\nQUOTED SOURCE MATERIAL:\n${(record.quotedSourceText || '').slice(0, 1200)}`,
      });
      polymathLLM.ingested = polymathLLM.ingested.slice(-5);
    }

    // 3. Add row in #ingestion-history window (`win-uploader`)
    const historyContainer = el('ingestion-history');
    if (historyContainer) {
      const item = document.createElement('div');
      item.className = 'p-2 rounded bg-surface/70 border border-neon-cyan/50 flex items-center justify-between text-slate-200';
      const left = document.createElement('span');
      left.className = 'truncate flex items-center space-x-1.5';
      const badge = document.createElement('span');
      badge.className = 'text-[9px] px-1 rounded bg-cyan-950 text-neon-cyan border border-cyan-700 font-bold';
      badge.textContent = 'WEB SOURCE';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'font-bold truncate';
      nameSpan.textContent = `${record.title} (${record.domain || 'web'})`;
      left.appendChild(badge);
      left.appendChild(nameSpan);

      const right = document.createElement('span');
      right.className = 'text-[9px] text-neon-emerald font-bold shrink-0 ml-2';
      right.textContent = record.retrievedAt ? record.retrievedAt.slice(0, 10) : '+GRAPH NODE';

      item.appendChild(left);
      item.appendChild(right);
      historyContainer.prepend(item);
    }

    if (typeof playBeep === 'function') playBeep(1420, 'triangle', 0.16);
    if (typeof polymathLLM !== 'undefined') {
      polymathLLM.appendChat(
        'system',
        `ZAZIOPATH INGESTION COMPLETE // [${record.action}] "${record.title}" (${record.url}) linked to Neural Graph with provenance=WEB SOURCE (retrieved ${record.retrievedAt}).`,
      );
    }
  }

  // Populate global `webUplink` methods
  Object.assign(window.webUplink, {
    state,
    switchTab,

    async checkCapabilities() {
      try {
        const status = await api('/api/uplink/status', 'GET', undefined, 5000);
        if (status.capabilities) state.capabilities = status.capabilities;
        if (status.telemetry) state.telemetry = { ...state.telemetry, ...status.telemetry };
        if (status.settings) state.settings = { ...state.settings, ...status.settings };
        if (status.cache) state.cache = status.cache;
        renderTelemetryAndCapabilities();
        return status;
      } catch {
        state.capabilities = {
          search: { status: 'OFFLINE', online: false },
          crawler: { status: 'OFFLINE', online: false },
          browser: { status: 'OFFLINE', online: false },
          ollama: { status: 'OFFLINE', online: false },
        };
        renderTelemetryAndCapabilities();
        return null;
      }
    },

    async submitWorkspaceBar() {
      const input = el('uplink-query-input');
      const modeSel = el('uplink-mode-select');
      const catSel = el('uplink-category-select');
      const timeSel = el('uplink-timerange-select');
      if (!input) return;
      const raw = input.value.trim();
      if (!raw) return;

      state.category = catSel ? catSel.value : 'general';
      state.timeRange = timeSel ? timeSel.value : '';
      const mode = modeSel ? modeSel.value : 'research';

      if (raw.startsWith('/')) {
        await this.handleTerminalCommand(raw, { openWindow: true });
        return;
      }

      if (mode === 'web') {
        await this.runSearch(raw, { category: state.category, timeRange: state.timeRange, page: 1 });
      } else if (mode === 'news') {
        await this.runResearch(raw, { category: 'news', timeRange: state.timeRange || 'month' });
      } else if (mode === 'read') {
        await this.readUrl(raw);
      } else if (mode === 'crawl') {
        await this.crawlUrl(raw);
      } else if (mode === 'browser') {
        await this.openBrowser(raw);
      } else {
        await this.runResearch(raw, { category: state.category, timeRange: state.timeRange });
      }
    },

    async runSearch(query, options = {}) {
      setBusy(true, `SEARCHING METASEARCH NODES FOR "${query}"...`);
      try {
        const res = await api('/api/uplink/search', 'POST', {
          query,
          category: options.category || state.category,
          timeRange: options.timeRange ?? state.timeRange,
          page: options.page || 1,
          site: options.site || state.siteFilter || undefined,
        });
        state.currentQuery = res.query;
        state.page = res.page || 1;
        state.sources = res.results || [];
        state.telemetry.searchNodes = (state.telemetry.searchNodes || 0) + state.sources.length;
        state.telemetry.sourceCorpus = state.sources.length;
        state.lastResearch = {
          query: res.query,
          model: 'metasearch',
          synthesis: `Metasearch completed via ${res.backend} (${state.sources.length} normalized sources ranked by Level 7 quality heuristics). Use /read <url>, /research ${res.query}, or INGEST SOURCE on any entry below.`,
          epistemicBreakdown: {
            primarySources: state.sources.filter((s) => s.sourceType === 'PRIMARY SOURCE'),
            secondarySources: state.sources.filter((s) => s.sourceType === 'SECONDARY SOURCE'),
            searchSnippets: state.sources.filter((s) => s.sourceType === 'SEARCH SNIPPET'),
          },
        };
        state.researchPath = [{ round: 1, type: 'search', label: `${res.query} (${res.backend})` }];
        renderTelemetryAndCapabilities();
        switchTab('sources');
        appendRichResearchToTerminal(`WEB METASEARCH // "${res.query}"`, {
          model: res.backend,
          synthesis: state.lastResearch.synthesis,
          sources: state.sources,
          researchPath: state.researchPath,
        });
        return res;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `WEB SEARCH ERROR: ${err.message}`);
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },

    async runResearch(query, options = {}) {
      setBusy(true, `RUNNING MULTI-HOP LOCAL RESEARCH ON "${query}"...`);
      try {
        const res = await api('/api/uplink/research', 'POST', {
          query,
          category: options.category || state.category,
          timeRange: options.timeRange ?? state.timeRange,
          site: options.site || undefined,
          maxRounds: state.settings.maxRounds,
          maxSearchesPerRound: state.settings.maxSearchesPerRound,
          maxPages: state.settings.maxPages,
          maxCrawlDepth: state.settings.maxCrawlDepth,
        });
        state.currentQuery = res.query;
        state.lastResearch = res;
        state.sources = res.sources || [];
        state.researchPath = res.researchPath || [];
        if (res.telemetry) {
          state.telemetry.roundsCompleted = res.telemetry.rounds;
          state.telemetry.searchNodes = res.telemetry.searchNodes;
          state.telemetry.pagesInspected = res.telemetry.pagesInspected;
          state.telemetry.sourceCorpus = res.telemetry.sourcesRetained;
          state.telemetry.crawlDepth = res.telemetry.crawlDepth;
        }
        renderTelemetryAndCapabilities();
        switchTab('synthesis');
        appendRichResearchToTerminal(`LOCAL RESEARCH SYNTHESIS // "${res.query}"`, res);
        return res;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `RESEARCH AGENT ERROR: ${err.message}`);
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },

    async readUrl(url) {
      setBusy(true, `EXTRACTING READABLE PAGE: ${url}...`);
      try {
        const page = await api('/api/uplink/read', 'POST', { url });
        state.currentQuery = page.title || url;
        state.sources = [
          {
            id: 1,
            title: page.title,
            url: page.canonicalUrl || page.url,
            domain: page.domain,
            publishedDate: page.publishedDate,
            author: page.author,
            snippet: page.excerpt,
            excerpt: page.excerpt,
            extractedText: page.text,
            sourceType: page.sourceType || 'SECONDARY SOURCE',
            qualityScore: page.sourceType === 'PRIMARY SOURCE' ? 90 : 78,
            engine: 'fetch_page',
            retrievedAt: page.retrievedAt,
          },
        ];
        state.telemetry.pagesInspected = (state.telemetry.pagesInspected || 0) + 1;
        state.telemetry.sourceCorpus = 1;
        state.lastResearch = {
          query: page.title,
          model: 'page-reader',
          synthesis: [
            `TITLE: ${page.title}`,
            `CANONICAL URL: ${page.canonicalUrl || page.url}`,
            `DOMAIN: ${page.domain} | CLASSIFICATION: ${page.sourceType}${page.publishedDate ? ` | PUBLISHED: ${page.publishedDate}` : ''}${page.author ? ` | AUTHOR: ${page.author}` : ''}`,
            `HEADINGS: ${(page.headings || []).slice(0, 6).map((h) => h.text).join(' · ') || 'None'}`,
            `LINKS PRESERVED: ${(page.links || []).length}`,
            page.injectionFlags?.length ? `SECURITY NOTICE: Neutralized prompt-injection patterns (${page.injectionFlags.join(', ')})` : '',
            ``,
            `EXTRACTED CONTENT:`,
            (page.markdown || page.text || '').slice(0, 3200),
          ]
            .filter(Boolean)
            .join('\n'),
          epistemicBreakdown: {
            primarySources: page.sourceType === 'PRIMARY SOURCE' ? state.sources : [],
            secondarySources: page.sourceType !== 'PRIMARY SOURCE' ? state.sources : [],
            searchSnippets: [],
          },
        };
        state.researchPath = [{ round: 1, type: 'fetch_page', label: `${page.domain} ("${page.title.slice(0, 40)}")` }];
        renderTelemetryAndCapabilities();
        switchTab('synthesis');
        appendRichResearchToTerminal(`PAGE READER // ${page.title}`, {
          model: 'page-reader',
          synthesis: state.lastResearch.synthesis,
          sources: state.sources,
          researchPath: state.researchPath,
        });
        return page;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `PAGE READER BLOCKED/FAILED: ${err.message}`);
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },

    async crawlUrl(url, topic = '') {
      setBusy(true, `CRAWLING BOUNDED GRAPH FROM ${url}...`);
      try {
        const res = await api('/api/uplink/crawl', 'POST', {
          url,
          query: topic,
          maxDepth: state.settings.maxCrawlDepth,
          maxPages: Math.min(10, state.settings.maxPages),
        });
        state.currentQuery = `Crawl: ${res.seedUrl}`;
        state.sources = res.pages || [];
        state.telemetry.pagesInspected = (state.telemetry.pagesInspected || 0) + state.sources.length;
        state.telemetry.crawlDepth = res.stats?.maxDepthReached ?? 0;
        state.telemetry.sourceCorpus = state.sources.length;
        state.researchPath = state.sources.map((p) => ({
          round: 1,
          type: `depth-${p.depth ?? 0}`,
          label: `${p.domain} ("${(p.title || '').slice(0, 32)}")`,
        }));
        state.lastResearch = {
          query: state.currentQuery,
          model: res.engine,
          synthesis: [
            `BOUNDED CRAWL COMPLETE // SEED: ${res.seedUrl}`,
            `ENGINE: ${res.engine} | PAGES CRAWLED: ${res.stats.pagesCrawled} | MAX DEPTH REACHED: ${res.stats.maxDepthReached} | TOTAL CHARS: ${res.stats.totalCharsExtracted} | STOP REASON: ${res.stats.stoppedReason}`,
            ``,
            ...state.sources.slice(0, 6).map((p) => `[${p.id}] (Depth ${p.depth}) ${p.title} — ${p.url}\n    ${(p.excerpt || '').slice(0, 240)}`),
          ].join('\n'),
          epistemicBreakdown: {
            primarySources: state.sources.filter((s) => s.sourceType === 'PRIMARY SOURCE'),
            secondarySources: state.sources.filter((s) => s.sourceType === 'SECONDARY SOURCE'),
            searchSnippets: [],
          },
        };
        renderTelemetryAndCapabilities();
        switchTab('synthesis');
        appendRichResearchToTerminal(`BOUNDED CRAWLER // ${res.seedDomain}`, {
          model: res.engine,
          synthesis: state.lastResearch.synthesis,
          sources: state.sources,
          researchPath: state.researchPath,
        });
        return res;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `CRAWLER ERROR: ${err.message}`);
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },

    async openBrowser(url) {
      if (!url || !url.trim()) return;
      setBusy(true, `OPENING MANAGED LOCAL BROWSER: ${url}...`);
      try {
        const bState = await api('/api/uplink/browser', 'POST', { action: 'open', url: url.trim() });
        state.browserState = bState;
        state.lastScreenshot = null;
        state.pendingConfirmation = null;
        renderTelemetryAndCapabilities();
        if (typeof restoreOrFocus === 'function') restoreOrFocus('win-uplink');
        switchTab('browser');
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat(
            'system',
            `MANAGED BROWSER OPENED // [${bState.title || bState.url}] (${bState.engine}, isolated profile).`,
          );
        }
        return bState;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `BROWSER BLOCKED/ERROR: ${err.message}`);
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },

    async browserAction(action, payload = {}) {
      setBusy(true, `BROWSER ACTION: ${action.toUpperCase()}...`);
      try {
        const res = await api('/api/uplink/browser', 'POST', { action, ...payload });
        if (res.blocked && res.requiresConfirmation) {
          state.pendingConfirmation = {
            action,
            payload,
            reason: res.reason,
          };
          if (res.state) state.browserState = res.state;
          renderBrowserPane();
          if (typeof polymathLLM !== 'undefined') {
            polymathLLM.appendChat('system', `BROWSER SAFETY GUARD: ${res.reason}`);
          }
          return res;
        }
        if (action === 'screenshot') {
          state.lastScreenshot = res;
          if (res.state) state.browserState = res.state;
        } else if (res.state) {
          state.browserState = res.state;
        } else {
          state.browserState = res;
        }
        renderBrowserPane();
        return res;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `BROWSER ACTION ERROR: ${err.message}`);
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },

    async ingestSource(sourceIndex, action = 'INGEST SOURCE') {
      try {
        const record = await api('/api/uplink/ingest', 'POST', {
          action,
          sourceIndex: Number(sourceIndex),
        });
        applyIngestedRecordToZaziopath(record);
        return record;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `INGESTION ERROR: ${err.message}`);
        }
        return null;
      }
    },

    async ingestFinding(action = 'INGEST FINDING') {
      try {
        const record = await api('/api/uplink/ingest', 'POST', { action });
        applyIngestedRecordToZaziopath(record);
        return record;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `FINDING INGESTION ERROR: ${err.message}`);
        }
        return null;
      }
    },

    async clearCache() {
      try {
        const res = await api('/api/uplink/cache/clear', 'POST', {});
        await this.checkCapabilities();
        if (state.activeTab === 'settings') renderSettingsPane();
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `WEB UPLINK CACHE CLEARED (${res.clearedEntries || 0} entries purged).`);
        }
        return res;
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `CACHE CLEAR ERROR: ${err.message}`);
        }
        return null;
      }
    },

    async handleTerminalCommand(rawCommand, opts = {}) {
      const trimmed = String(rawCommand || '').trim();
      if (!trimmed.startsWith('/')) return false;

      if (opts.openWindow && typeof restoreOrFocus === 'function') {
        restoreOrFocus('win-uplink');
      }

      const [cmdRaw, ...rest] = trimmed.split(/\s+/);
      const cmd = cmdRaw.toLowerCase();
      const argText = rest.join(' ').trim();

      try {
        if (cmd === '/web' || cmd === '/search') {
          if (!argText) throw new Error('Usage: /web <query>');
          await this.runSearch(argText);
          return true;
        }
        if (cmd === '/news') {
          if (!argText) throw new Error('Usage: /news <query>');
          await this.runResearch(argText, { category: 'news', timeRange: 'month' });
          return true;
        }
        if (cmd === '/read' || cmd === '/fetch') {
          if (!argText) throw new Error('Usage: /read <https://example.com>');
          await this.readUrl(rest[0]);
          return true;
        }
        if (cmd === '/crawl') {
          if (!argText) throw new Error('Usage: /crawl <https://example.com> [optional topic]');
          await this.crawlUrl(rest[0], rest.slice(1).join(' '));
          return true;
        }
        if (cmd === '/site') {
          if (rest.length < 2) throw new Error('Usage: /site <domain.com> <query>');
          const domain = rest[0].replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
          await this.runResearch(rest.slice(1).join(' '), { site: domain });
          return true;
        }
        if (cmd === '/research') {
          if (!argText) throw new Error('Usage: /research <query>');
          await this.runResearch(argText);
          return true;
        }
        if (cmd === '/browser') {
          if (!argText || rest[0].toLowerCase() === 'read') {
            await this.browserAction('read', {});
            if (typeof restoreOrFocus === 'function') restoreOrFocus('win-uplink');
            switchTab('browser');
            return true;
          }
          if (rest[0].toLowerCase() === 'scroll') {
            await this.browserAction('scroll', { direction: rest[1] || 'down' });
            return true;
          }
          if (rest[0].toLowerCase() === 'click') {
            await this.browserAction('click', { target: rest.slice(1).join(' ') });
            return true;
          }
          if (rest[0].toLowerCase() === 'screenshot') {
            await this.browserAction('screenshot', {});
            if (typeof restoreOrFocus === 'function') restoreOrFocus('win-uplink');
            switchTab('browser');
            return true;
          }
          await this.openBrowser(rest[0]);
          return true;
        }
        if (cmd === '/sources') {
          const res = await api('/api/uplink/sources', 'GET');
          state.sources = res.sources || state.sources;
          state.researchPath = res.researchPath || state.researchPath;
          if (typeof restoreOrFocus === 'function') restoreOrFocus('win-uplink');
          switchTab('sources');
          appendRichResearchToTerminal(`SESSION SOURCE CORPUS (${state.sources.length} SOURCES)`, {
            model: 'session-corpus',
            synthesis: state.sources.length
              ? `Displaying ${state.sources.length} ephemeral web sources from current session. Use /ingest <number> or click INGEST SOURCE to add a source to Zaziopath.`
              : 'No web sources currently in session corpus.',
            sources: state.sources,
            researchPath: state.researchPath,
          });
          return true;
        }
        if (cmd === '/ingest') {
          if (!argText) throw new Error('Usage: /ingest <source-number> (e.g. /ingest 2) or /ingest finding');
          if (/^finding\b/i.test(argText)) {
            await this.ingestFinding('INGEST FINDING');
          } else {
            const idx = Number(argText.replace(/^#/, '').trim());
            await this.ingestSource(idx, 'INGEST SOURCE');
          }
          return true;
        }
        if (cmd === '/clear-cache') {
          await this.clearCache();
          return true;
        }

        throw new Error(
          `Unknown command "${cmd}". Available commands: /web, /read, /crawl, /site, /research, /news, /browser, /sources, /ingest, /clear-cache`,
        );
      } catch (err) {
        if (typeof polymathLLM !== 'undefined') {
          polymathLLM.appendChat('system', `UPLINK COMMAND ERROR: ${err.message}`);
        }
        return true;
      }
    },
  });

  function mountWorkspaceShell() {
    const root = el('uplink-workspace-root');
    if (!root || el('uplink-pane-synthesis')) return;
    root.innerHTML = `
      <div class="bg-obsidian/90 px-3 py-1.5 border-b border-cyan-950 flex flex-wrap items-center justify-between gap-1 text-[9px] font-mono">
        <div class="flex flex-wrap items-center gap-1">
          <span id="cap-search" class="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/50 text-neon-emerald font-bold">SEARCH // ONLINE</span>
          <span id="cap-crawler" class="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/50 text-neon-emerald font-bold">CRAWLER // ONLINE</span>
          <span id="cap-browser" class="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-700/50 text-neon-amber">BROWSER // OFFLINE</span>
          <span id="cap-ollama" class="px-1.5 py-0.5 rounded bg-slate-900 border border-amber-700/50 text-neon-amber">OLLAMA // OFFLINE</span>
        </div>
        <div id="uplink-progress-text" class="text-[10px] font-mono text-neon-emerald">READY // IDLE</div>
      </div>

      <div class="bg-void/95 px-3 py-1 border-b border-cyan-950/80 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] font-mono text-slate-400">
        <span id="tel-search-nodes" class="text-neon-cyan">SEARCH NODES // 0</span>
        <span id="tel-source-corpus" class="text-neon-emerald">SOURCE CORPUS // 0</span>
        <span id="tel-browser-mode">BROWSER // MANAGED</span>
        <span id="tel-crawl-depth">CRAWL DEPTH // 2</span>
        <span id="tel-rounds">ROUNDS // 0/3</span>
        <span id="tel-pages">PAGES // 0/15</span>
        <span id="tel-local-cog" class="text-neon-amber">LOCAL COGNITION // llama3.1:8b</span>
        <span id="tel-egress">NETWORK EGRESS // WEB ONLY</span>
      </div>

      <div class="p-2 bg-obsidian border-b border-cyan-950 flex flex-wrap items-center gap-1.5 font-mono text-xs">
        <select id="uplink-mode-select" class="bg-surface border border-cyan-900 text-neon-cyan text-[10px] px-1.5 py-1 rounded outline-none font-bold">
          <option value="research">/research (Multi-Hop)</option>
          <option value="web">/web (Metasearch)</option>
          <option value="news">/news (Recency)</option>
          <option value="read">/read (Page Reader)</option>
          <option value="crawl">/crawl (Site Crawler)</option>
          <option value="browser">/browser (Managed)</option>
        </select>
        <select id="uplink-category-select" class="bg-surface border border-cyan-900 text-slate-300 text-[10px] px-1.5 py-1 rounded outline-none">
          <option value="general">WEB</option>
          <option value="science">SCIENCE</option>
          <option value="news">NEWS</option>
          <option value="images">IMAGES</option>
        </select>
        <select id="uplink-timerange-select" class="bg-surface border border-cyan-900 text-slate-300 text-[10px] px-1.5 py-1 rounded outline-none">
          <option value="">ANY TIME</option>
          <option value="day">24H</option>
          <option value="week">WEEK</option>
          <option value="month">MONTH</option>
          <option value="year">YEAR</option>
        </select>
        <input id="uplink-query-input" type="text" placeholder="Enter topic, URL, or command (e.g. /research electroacoustic spatialization)..."
               class="flex-1 min-w-[180px] bg-surface border border-cyan-950 focus:border-neon-cyan px-2.5 py-1 text-[11px] text-slate-100 placeholder-slate-600 rounded outline-none" />
        <button id="uplink-exec-btn" class="px-2.5 py-1 rounded bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-void font-bold text-[10px] transition">
          EXECUTE
        </button>
      </div>

      <div class="bg-obsidian/80 px-3 py-1 border-b border-cyan-950 flex items-center space-x-1.5">
        <button id="uplink-tab-btn-synthesis" class="px-2.5 py-1 rounded bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-bold text-[10px] font-mono">SYNTHESIS &amp; TRAIL</button>
        <button id="uplink-tab-btn-sources" class="px-2.5 py-1 rounded bg-surface hover:bg-surface-bright border border-cyan-950 text-slate-400 text-[10px] font-mono">SOURCE CORPUS</button>
        <button id="uplink-tab-btn-browser" class="px-2.5 py-1 rounded bg-surface hover:bg-surface-bright border border-cyan-950 text-slate-400 text-[10px] font-mono">MANAGED BROWSER</button>
        <button id="uplink-tab-btn-settings" class="px-2.5 py-1 rounded bg-surface hover:bg-surface-bright border border-cyan-950 text-slate-400 text-[10px] font-mono">LIMITS &amp; CACHE</button>
      </div>

      <div class="flex-1 bg-void/90 overflow-y-auto p-3 font-mono text-xs">
        <div id="uplink-pane-synthesis" class="space-y-2.5"></div>
        <div id="uplink-pane-sources" class="space-y-2 hidden"></div>
        <div id="uplink-pane-browser" class="space-y-2 hidden"></div>
        <div id="uplink-pane-settings" class="space-y-2 hidden"></div>
      </div>
    `;
    el('uplink-query-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') webUplink.submitWorkspaceBar();
    });
    el('uplink-exec-btn')?.addEventListener('click', () => webUplink.submitWorkspaceBar());
    el('uplink-tab-btn-synthesis')?.addEventListener('click', () => switchTab('synthesis'));
    el('uplink-tab-btn-sources')?.addEventListener('click', () => switchTab('sources'));
    el('uplink-tab-btn-browser')?.addEventListener('click', () => switchTab('browser'));
    el('uplink-tab-btn-settings')?.addEventListener('click', () => switchTab('settings'));
  }

  window.addEventListener('DOMContentLoaded', () => {
    mountWorkspaceShell();
    webUplink.checkCapabilities();
    renderSynthesisPane();
  });
})();
