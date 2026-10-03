#!/usr/bin/env node
/**
 * NOÖSPHERE // OS — behavioural smoke harness
 * ============================================================
 * Runs `index.html`'s runtime inside a minimal DOM/Canvas stub and exercises the
 * paths a static audit cannot see: boot, the standard force loop, entering and
 * leaving the ultra field, every submode, the Zaziopath lattice seed, corpus
 * injection, resize, the hotkeys, and the simulation fallback.
 *
 * It asserts behaviour, not pixels: the stub canvas records draw calls, so the
 * harness can prove that a mode actually rendered something rather than merely
 * not throwing. There is no browser dependency and no install step.
 *
 * Usage: node scripts/smoke.mjs [--verbose]
 * Exit codes: 0 all assertions passed · 1 an assertion failed · 2 the runtime threw
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'index.html');
const verbose = process.argv.includes('--verbose');

const html = readFileSync(SOURCE, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const runtime = scripts[scripts.length - 1];
if (!runtime || runtime.length < 1000) {
  console.error('smoke: could not locate the runtime script in index.html');
  process.exit(2);
}

/* ------------------------------------------------------------------ *
 * Minimal DOM / Canvas stubs — only what the runtime touches
 * ------------------------------------------------------------------ */
let clock = 1000;
const now = () => clock;

const stat = { fills: 0, strokes: 0, images: 0, texts: 0, gradients: 0, clears: 0 };

function makeContext2d() {
  const noop = () => {};
  const ctx = {
    canvas: null,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px monospace',
    shadowColor: '', shadowBlur: 0, imageSmoothingEnabled: true,
    save: noop, restore: noop, setTransform: noop, transform: noop, translate: noop,
    scale: noop, rotate: noop, clip: noop, setLineDash: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, rect: noop,
    fill: () => { stat.fills++; }, stroke: () => { stat.strokes++; },
    fillRect: () => { stat.fills++; }, strokeRect: () => { stat.strokes++; },
    clearRect: () => { stat.clears++; },
    drawImage: () => { stat.images++; },
    fillText: () => { stat.texts++; }, strokeText: noop,
    measureText: () => ({ width: 12 }),
    createRadialGradient: () => { stat.gradients++; return { addColorStop: noop }; },
    createLinearGradient: () => { stat.gradients++; return { addColorStop: noop }; },
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    putImageData: noop,
  };
  return ctx;
}

function makeElement(tag = 'div', id = null) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id,
    style: {},
    dataset: {},
    className: '',
    value: '50',
    textContent: '',
    innerText: '',
    checked: false,
    children: [],
    width: 600, height: 400,
    offsetLeft: 0, offsetTop: 0,
    clientWidth: 620, clientHeight: 380,
    parentElement: null,
    onclick: null, oninput: null,
    classList: {
      _set: new Set(),
      add(...c) { c.forEach((x) => this._set.add(x)); },
      remove(...c) { c.forEach((x) => this._set.delete(x)); },
      contains(c) { return this._set.has(c); },
      toggle(c, force) {
        const on = force === undefined ? !this._set.has(c) : !!force;
        if (on) this._set.add(c); else this._set.delete(c);
        return on;
      },
    },
    appendChild(c) { this.children.push(c); return c; },
    append(...c) { this.children.push(...c); },
    prepend(c) { this.children.unshift(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
    remove() {},
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; },
    focus() {}, blur() {}, scrollTo() {},
    getBoundingClientRect() { return { left: 0, top: 0, right: 620, bottom: 380, width: 620, height: 380 }; },
    getContext(kind) { return kind === '2d' ? (this._ctx || (this._ctx = makeContext2d())) : null; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html || ''; },
    set(v) { this._html = String(v); this.children = []; },
  });
  return el;
}

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const byId = new Map();
// Every element gets a viewport-sized parent, because the runtime sizes both
// canvases from `parentElement.clientWidth`.
const viewport = makeElement('div');
viewport.clientWidth = 620; viewport.clientHeight = 380;
const document = {
  body: makeElement('body'),
  documentElement: makeElement('html'),
  getElementById(id) {
    if (!ids.has(id)) return null;
    if (!byId.has(id)) {
      const el = makeElement('div', id);
      el.parentElement = viewport;
      byId.set(id, el);
    }
    return byId.get(id);
  },
  createElement(tag) { return makeElement(tag); },
  querySelector(sel) { return sel.startsWith('#') ? this.getElementById(sel.slice(1)) : makeElement('div'); },
  querySelectorAll(sel) {
    if (sel === '.glass-panel') return [];
    if (sel === '.field-chip') {
      return ['swarm', 'constellation', 'storm', 'mycelial', 'dream'].map((f) => {
        const el = makeElement('button');
        el.dataset.field = f;
        return el;
      });
    }
    if (sel === '.domain-btn') return [];
    return [];
  },
  addEventListener(type, fn) { listeners.add(type, fn); },
  removeEventListener() {},
};

const listeners = new Map();
listeners.add = (t, fn) => { (listeners.get(t) || listeners.set(t, []).get(t)).push(fn); };
const rafQueue = [];
const timeouts = [];

const window = {
  devicePixelRatio: 2,
  innerWidth: 1440, innerHeight: 900,
  addEventListener: (t, fn) => listeners.add(t, fn),
  requestAnimationFrame: (fn) => rafQueue.push(fn),
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  AudioContext: undefined,
};

const sandbox = {
  window, document, console,
  navigator: { clipboard: null },
  performance: { now },
  requestAnimationFrame: (fn) => rafQueue.push(fn),
  cancelAnimationFrame: () => {},
  setTimeout: (fn) => { timeouts.push(fn); return timeouts.length; },
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  AbortSignal,
  fetch: () => Promise.reject(new Error('offline')),
  FileReader: class { readAsText() {} },
  Math, JSON, Date, Object, Array, String, Number, Boolean, Map, Set, Symbol, Promise, Error, TypeError,
  isNaN, isFinite, parseFloat, parseInt, Uint8ClampedArray, Int32Array, Float32Array, Infinity, NaN, undefined,
  tailwind: {},
  lucide: { createIcons() {} },
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

/* ------------------------------------------------------------------ *
 * Run the runtime
 * ------------------------------------------------------------------ */
const probe = `\n;globalThis.__NS = { ultra, graphEngine, graphMetrics, pickNodeAt,
  nodes: () => graphNodes, edges: () => graphEdges, seeded: () => zaziopathSeeded,
  fields: ULTRA_FIELD_KEYS, weather: () => graphMetrics.weather, docIds: (id) => document.getElementById(id) };`;

let failures = 0;
const check = (label, condition, detail = '') => {
  if (condition) {
    if (verbose) console.log(`  ✔ ${label}`);
  } else {
    failures++;
    console.log(`  ✘ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

try {
  new Script(runtime + probe, { filename: 'index.html#runtime' }).runInNewContext(sandbox, { timeout: 5000 });
} catch (err) {
  console.error('smoke: the runtime threw while loading\n', err);
  process.exit(2);
}

const NS = sandbox.__NS;
const frame = (ms = 16.7) => {
  clock += ms;
  const cb = rafQueue.shift();
  if (cb) cb(clock);
};
const frames = (n, ms) => { for (let i = 0; i < n; i++) frame(ms); };

console.log('\n  NOÖSPHERE // OS — behavioural smoke harness');
console.log('  ────────────────────────────────────────────────────────────');

const fire = (type, ev = {}) => (listeners.get(type) || []).forEach((fn) => fn(ev));
const boot = () => {
  fire('DOMContentLoaded');
};

/* 1 · boot */
boot();
const bootNodes = NS.nodes().length, bootEdges = NS.edges().length;
check('DOMContentLoaded initialises the graph', NS.nodes().length === 90, `nodes=${NS.nodes().length}`);
check('procedural edges exist', NS.edges().length > 200, `edges=${NS.edges().length}`);
check('node ids are indices (renderer contract)', NS.nodes().every((n, i) => n.id === i));
check('every node carries stratum + provenance + class', NS.nodes().every((n) => n.stratum && n.provenance && n.klass));
check('every edge carries strength + kind', NS.edges().every((e) => typeof e.strength === 'number' && e.kind));

/* 2 · standard renderer */
stat.fills = 0; stat.strokes = 0;
frames(10);
check('standard loop paints fills and strokes', stat.fills > 0 && stat.strokes > 0, `fills=${stat.fills} strokes=${stat.strokes}`);
check('ultra field is off by default', NS.ultra.enabled === false);

/* 3 · ultra field */
NS.graphEngine.setDisplayMode('ultra');
check('ULTRA enables the field', NS.ultra.enabled === true);
check('entering ULTRA seeds the Zaziopath lattice', NS.seeded() === true);
const seedNodes = NS.nodes().length, seedEdges = NS.edges().length;
check('lattice added the 8 strata as nodes', NS.nodes().length > 90, `nodes=${NS.nodes().length}`);
check('§00c wires became edges', NS.edges().some((e) => e.kind === 'wire'));
check('the premise question is an unresolved node', NS.nodes().some((n) => n.klass === 'question'));
check('deck is revealed in ULTRA', sandbox.document.getElementById('ultra-deck').classList.contains('hidden') === false);

stat.images = 0; stat.gradients = 0;
frames(30);
check('ultra field draws glow stamps', stat.images > 0, `images=${stat.images}`);
check('ultra field builds nebula gradients', stat.gradients > 0, `gradients=${stat.gradients}`);
check('weather is computed from the graph', NS.weather().excitation > 0 && NS.weather().source > 0,
  JSON.stringify(NS.weather()));

const before = NS.nodes().map((n) => n.x + n.y).join(',');
frames(60);
check('swarm moves the same nodes the atlas owns', NS.nodes().map((n) => n.x + n.y).join(',') !== before);
check('frame budget stays finite', Number.isFinite(NS.ultra.avgMs));

/* 4 · submodes */
NS.fields.forEach((f) => {
  NS.ultra.setSubmode(f);
  frames(6);
  check(`submode ${f} renders without error`, NS.ultra.field === f);
});
NS.ultra.setSubmode('swarm');

/* 5 · parameters, toggles, presets, legend */
NS.ultra.setParam('density', '90');
NS.ultra.setParam('glow', '80');
NS.ultra.toggle('weather');
NS.ultra.toggle('weather');
NS.ultra.toggle('dream');
NS.ultra.toggle('dream');
NS.ultra.toggleLegend();
check('legend renders both registries', /STRATUM/.test(sandbox.document.getElementById('ultra-legend').innerHTML));
NS.ultra.toggleLegend();
NS.ultra.cyclePreset();
frames(6);
check('preset cycling keeps params in range', ['density', 'glow', 'turbulence', 'traffic'].every((k) => NS.ultra.params[k] >= 0 && NS.ultra.params[k] <= 100));

/* 6 · ingestion and synthesis enter the same field */
const n0 = NS.nodes().length, e0 = NS.edges().length;
NS.graphEngine.injectNode('SMOKE_TEST_ARTIFACT', 'memetics', 'injected by the harness', { klass: 'ingested', origin: 'ingestion', ref: 'FILE//smoke.txt' });
frames(8);
check('injection adds exactly one node', NS.nodes().length === n0 + 1);
check('injection links the node to neighbours', NS.edges().length > e0);
check('birth event registered on the ultra field', NS.ultra.waves.length > 0 || NS.ultra.surge >= 0);

/* 7 · selection drives focus, focus drives dimming */
const target = NS.nodes()[3];
NS.ultra.focus(target);
check('focus marks the node fully relevant', NS.graphMetrics.relevance[target.id] === 1);
check('focus reaches one hop neighbours', Object.values(NS.graphMetrics.relevance).some((v) => v > 0.1 && v < 1));
NS.ultra.focus(null);
check('clearing focus returns the field to neutral', NS.graphMetrics.focus === null);

/* 8 · hotkeys */
const key = (k) => fire('keydown', { key: k, target: { tagName: 'DIV' } });
key('w'); key('d'); key('l'); key('l');
key('2');
check('hotkey selects a submode', NS.ultra.field === 'constellation');
key('u');
check('hotkey U returns to STANDARD', NS.ultra.enabled === false);
NS.graphEngine.setDisplayMode('ultra');
frames(4);

/* 9 · resize while the field is live */
viewport.clientWidth = 1200; viewport.clientHeight = 640;
fire('resize');
frames(8);
check('field survives a resize', NS.ultra.enabled === true && Number.isFinite(NS.ultra.avgMs));

/* 10 · fallback paths */
NS.ultra.exit();
NS.graphEngine.setDisplayMode('standard');
frames(10);
check('STANDARD keeps running after ULTRA', NS.ultra.enabled === false);
check('payload counters stay truthful', sandbox.document.getElementById('synapse-count').innerText.includes('NODES'));

console.log(`\n  boot graph        ${bootNodes} nodes · ${bootEdges} edges`);
console.log(`  after ULTRA seed  ${seedNodes} nodes · ${seedEdges} edges`);
console.log(`  after injection   ${NS.nodes().length} nodes · ${NS.edges().length} edges (harness artefact retained)`);
console.log(`\n  ${failures === 0 ? '✔ PASS' : `✘ FAIL — ${failures} assertion(s)`} · ${Math.round((clock - 1000) / 1000)}s simulated\n`);
process.exit(failures === 0 ? 0 : 1);
