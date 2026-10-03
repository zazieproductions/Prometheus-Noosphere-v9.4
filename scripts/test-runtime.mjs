#!/usr/bin/env node
/** Smoke-test the real inline runtime in a small DOM/canvas stub; no browser deps. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInContext, createContext } from 'node:vm';
import { baseUrl } from '../server/ollama.mjs';

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...names) { for (const name of names) this.values.add(name); }
  remove(...names) { for (const name of names) this.values.delete(name); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.values.has(name) : Boolean(force);
    if (next) this.values.add(name); else this.values.delete(name);
    return next;
  }
}

class FakeElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.parentElement = null;
    this.value = '';
    this.textContent = '';
    this.innerText = '';
    this.innerHTML = '';
    this.className = '';
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.width = 0;
    this.height = 0;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener));
  }
  append(...items) {
    for (const item of items) {
      const child = typeof item === 'string' ? new FakeText(item) : item;
      child.parentElement = this;
      this.children.push(child);
    }
  }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  prepend(...items) {
    const children = items.map(item => typeof item === 'string' ? new FakeText(item) : item);
    for (const child of children) child.parentElement = this;
    this.children.unshift(...children);
  }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter(child => child !== this);
  }
  focus() { this.focused = true; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 1000, bottom: 600, width: 1000, height: 600 }; }
  getContext() { return drawingContext; }
}
class FakeText extends FakeElement {
  constructor(value) { super('#text'); this.textContent = value; }
}

const drawingContext = new Proxy({}, {
  get(target, key) {
    if (key in target) return target[key];
    if (['lineWidth', 'strokeStyle', 'fillStyle', 'font', 'shadowColor', 'shadowBlur', 'globalAlpha'].includes(key)) return target[key];
    return (..._args) => {};
  },
  set(target, key, value) { target[key] = value; return true; },
});

const html = readFileSync('index.html', 'utf8');
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(text => text.trim());
assert.ok(inlineScripts.length >= 2, 'expected the existing Tailwind and application inline scripts');
const appSource = inlineScripts.at(-1);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const elements = new Map(ids.map(id => [id, new FakeElement('div', id)]));
const canvas = elements.get('neural-canvas');
canvas.parentElement = { clientWidth: 1000, clientHeight: 600 };
canvas.getContext = () => drawingContext;
const created = [];
const windowListeners = new Map();
const document = {
  body: new FakeElement('body', 'body'),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new FakeElement('div', id));
    return elements.get(id);
  },
  createElement(tag) { const element = new FakeElement(tag); created.push(element); return element; },
  createTextNode(text) { return new FakeText(String(text)); },
  querySelectorAll(selector) { return selector === '.glass-panel' || selector === '.stratum-btn' ? [] : []; },
  addEventListener() {},
};
const window = {
  ZAZIOPATH_GRAPH: undefined,
  addEventListener(type, listener) {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(listener);
  },
};
let fileReaderCalls = 0;
class TestFileReader {
  readAsText(file) {
    fileReaderCalls++;
    this.result = file.contents;
    this.onload?.({ target: this });
  }
}
let fetchCalls = [];
const sandbox = {
  window,
  document,
  lucide: { createIcons() {} },
  FileReader: TestFileReader,
  navigator: { clipboard: { writeText: async () => {} } },
  AbortSignal,
  fetch: async (...args) => { fetchCalls.push(args); throw new Error('offline test stub'); },
  requestAnimationFrame() { return 1; },
  setInterval() { return 1; },
  setTimeout() { return 1; },
  console,
};
const context = createContext(sandbox);
runInContext(readFileSync('data/zaziopath-graph.js', 'utf8'), context, { filename: 'data/zaziopath-graph.js' });
const exports = `\nglobalThis.__runtimeTestApi = {
  CORPUS, graphNodes, graphEdges, graphNodeById, graphEngine, polymathLLM, grimoire,
  processFiles, rankedGraphNodes, rankedFragments, extractCandidateConcepts,
  get highlightedNodeIds() { return highlightedNodeIds; },
  get activeStratumFilter() { return activeStratumFilter; },
};\n`;
runInContext(`${appSource}\n${exports}`, context, { filename: 'index.html inline runtime' });
const api = sandbox.__runtimeTestApi;
assert.ok(api, 'inline runtime exposed test hooks');

// Boot and static corpus parity.
assert.equal(api.graphNodes.length, 86);
assert.equal(api.graphEdges.length, 117);
assert.equal(api.CORPUS.fragments.length, 15);
assert.ok(api.graphNodes.every(node => node.id && node.provenance && node.sources?.length));
assert.ok(api.graphEdges.every(edge => Number.isInteger(edge.source) && Number.isInteger(edge.target)));
const ready = windowListeners.get('DOMContentLoaded')?.[0];
assert.equal(typeof ready, 'function', 'DOMContentLoaded initializer is registered');
ready();
await new Promise(resolve => setImmediate(resolve));
assert.equal(elements.get('source-node-count').textContent, '73');
assert.equal(elements.get('grimoire-count').textContent, '15');
assert.ok(elements.get('grimoire-container').children.length > 0, 'source fragments rendered at boot');

// Deterministic offline retrieval includes source status and citations.
api.polymathLLM.setMode(false);
const fallback = api.polymathLLM.deterministicAnswer('meta-level addiction');
assert.match(fallback, /SIMULATION MODE/);
assert.match(fallback, /Meta-level addiction/i);
assert.match(fallback, /Shadow Journal Observations/i);
assert.match(fallback, /SOURCE|INFERENCE|SYNTHESIS/);
assert.ok(api.rankedGraphNodes('evidence over map').length > 0);
assert.ok(api.rankedFragments('paper trail person').length > 0);

// The Ollama request context is bounded and carries selection, neighbors, history and ingestion snippets.
const selectedNode = api.graphNodeById.get('concept-meta-level-addiction');
api.polymathLLM.selectedNode = selectedNode;
api.polymathLLM.selectedFragment = api.CORPUS.fragments[0];
api.polymathLLM.history.push({ role: 'user', text: 'Prior bounded question about the source record.' });
api.polymathLLM.ingested.push({ file: 'session-note.md', text: 'Private excerpt remains in memory.', sessionOnly: true });
const llmContext = api.polymathLLM.context('recursion staircase');
assert.equal(llmContext.selectedNode.id, selectedNode.id);
assert.ok(llmContext.nearbyNodes.length > 0);
assert.ok(llmContext.relevantSourceSummaries.length > 0);
assert.equal(llmContext.selectedFragment.title, api.CORPUS.fragments[0].title);
assert.ok(llmContext.recentTerminalHistory.length > 0);
assert.equal(llmContext.ingestedLocalText[0].sessionOnly, true);
let capturedRequest;
sandbox.fetch = async (url, options) => {
  fetchCalls.push([url, options]);
  capturedRequest = { url, body: JSON.parse(options.body) };
  return { ok: true, json: async () => ({ response: 'Local model response.', model: 'llama3.1:8b' }) };
};
api.polymathLLM.setMode(true);
assert.equal(await api.polymathLLM.queryOllama('Trace the selected source.', llmContext), 'Local model response.');
assert.equal(capturedRequest.url, '/api/noosphere');
assert.equal(capturedRequest.body.context.selectedNode.id, selectedNode.id);
assert.ok(capturedRequest.body.context.recentTerminalHistory.length > 0);
assert.ok(capturedRequest.body.context.ingestedLocalText[0].text.includes('Private excerpt'));

// A failed local request switches back to deterministic retrieval instead of blocking the terminal.
sandbox.fetch = async () => { throw new Error('Ollama offline'); };
api.polymathLLM.setMode(true);
const fallbackAfterFailure = await api.polymathLLM.generatePolymathResponse('meta-level addiction');
assert.equal(api.polymathLLM.mode, 'simulation');
assert.match(fallbackAfterFailure, /DETERMINISTIC LOCAL RETRIEVAL/);

// Grimoire search and selection load a source-backed fragment and highlight its linked records.
api.grimoire.filter('after silence');
assert.ok(elements.get('grimoire-container').children.length > 0);
const fragment = api.CORPUS.fragments.find(item => item.id === 'fragment-after-silence');
api.grimoire.select(fragment);
assert.equal(api.polymathLLM.selectedFragment.id, fragment.id);
assert.ok(fragment.relatedNodeIds.some(id => api.highlightedNodeIds.has(id)));
assert.ok(api.polymathLLM.selectedNode);

// Local file ingestion creates a source node, bounded candidate concepts, and provenance links without any upload.
api.polymathLLM.setMode(false);
api.polymathLLM.selectedFragment = null;
const fixture = {
  name: 'arena-ingest-evidence.md',
  size: 180,
  contents: '# Ephemeral Citation Candidate\n\nThe archive records a meta-level addiction and a recursion staircase. Compare the cited source excerpts and keep inference separate from documented evidence.\n',
};
const beforeIngestion = api.graphNodes.length;
const beforeFileReads = fileReaderCalls;
const beforeFetchCalls = fetchCalls.length;
await api.processFiles([fixture]);
assert.ok(fileReaderCalls > beforeFileReads);
assert.ok(api.graphNodes.length > beforeIngestion);
assert.equal(fetchCalls.length, beforeFetchCalls, 'simulation ingestion makes no network request');
const localSource = api.graphNodes.find(node => node.localSession && node.kind === 'source-document' && node.title === fixture.name);
assert.ok(localSource, 'local source record was created');
const localConcepts = api.graphNodes.filter(node => node.localSession && node.kind === 'concept' && node.sources?.some(source => source.path === fixture.name));
assert.ok(localConcepts.length > 0 && localConcepts.length <= 3, 'at most three concepts created');
assert.ok(localConcepts.every(node => ['source', 'synthesis', 'inference'].includes(node.epistemic)));
assert.ok(api.graphEdges.some(edge => edge.localSession && edge.sourceId === localSource.id && edge.targetId.startsWith('stratum-') && edge.epistemic === 'synthesis'));
assert.ok(api.graphEdges.some(edge => edge.localSession && localConcepts.some(node => edge.sourceId === node.id && edge.targetId === localSource.id)));

// Re-ingesting a normalized duplicate filename is skipped; duplicate concepts across files do not multiply.
const countAfterFirst = api.graphNodes.length;
await api.processFiles([{ ...fixture, contents: `${fixture.contents}\nA different tail does not create a second same-name file record.` }]);
assert.equal(api.graphNodes.length, countAfterFirst, 'same normalized filename is deduplicated');
const duplicateFixture = {
  name: 'different-copy.txt',
  size: 120,
  contents: '# Ephemeral Citation Candidate\n\nA separate local file repeats the same named concept for deduplication testing.\n',
};
await api.processFiles([duplicateFixture]);
assert.equal(api.graphNodes.filter(node => node.localSession && node.kind === 'concept' && normalizeText(node.title) === normalizeText('Ephemeral Citation Candidate')).length, 1);

// Direct injection is deterministic and duplicate-safe.
const duplicateNode = api.graphEngine.injectNode({ title: 'Meta-level Addiction', stratum: 'shadow', kind: 'concept', epistemic: 'synthesis', summary: 'duplicate probe' });
assert.equal(duplicateNode.created, false);
const added = api.graphEngine.injectNode({
  id: 'session-runtime-probe', title: 'Arena Runtime Probe', stratum: 'recursion-lab', kind: 'concept', epistemic: 'synthesis',
  summary: 'Temporary validation node.', provenance: { category: 'test-synthesis' },
  links: [{ targetId: 'stratum-recursion-lab', type: 'related-to', label: 'test-only local relation', epistemic: 'synthesis' }],
});
assert.equal(added.created, true);
assert.equal(added.node.localSession, true);
assert.ok(api.graphEdges.some(edge => edge.sourceId === added.node.id && edge.targetId === 'stratum-recursion-lab' && edge.localSession));

function normalizeText(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

// Ollama endpoint configuration accepts only plain HTTP loopback origins.
const priorOllamaUrl = process.env.NOOSPHERE_OLLAMA_URL;
try {
  delete process.env.NOOSPHERE_OLLAMA_URL;
  assert.equal(baseUrl(), 'http://127.0.0.1:11434');
  for (const url of ['http://127.0.0.1:11434', 'http://localhost:11435', 'http://[::1]:11436']) {
    process.env.NOOSPHERE_OLLAMA_URL = url;
    assert.equal(baseUrl(), url);
  }
  for (const url of [
    'https://example.com',
    'http://8.8.8.8:11434',
    'http://user:secret@localhost:11434',
    'http://localhost:11434/api',
    'http://localhost:11434/?token=secret',
  ]) {
    process.env.NOOSPHERE_OLLAMA_URL = url;
    assert.throws(() => baseUrl(), /loopback|local-only/i, `remote/credential/path URL accepted: ${url}`);
  }
} finally {
  if (priorOllamaUrl === undefined) delete process.env.NOOSPHERE_OLLAMA_URL;
  else process.env.NOOSPHERE_OLLAMA_URL = priorOllamaUrl;
}

console.log('runtime smoke tests: PASS · graph boot · deterministic fallback · loopback-only Ollama URLs · context/failure · Grimoire selection · session ingestion/dedupe');
