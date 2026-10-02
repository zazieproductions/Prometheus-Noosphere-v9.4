#!/usr/bin/env node
/**
 * NOÖSPHERE // OS — static integrity audit
 * ============================================================
 * Dependency-free static analysis for the single-file runtime in `index.html`.
 *
 * The audit is a *ratchet*: every finding is identified by a stable register ID
 * (NOO-0xx) and counted. `scripts/audit-baseline.json` records the accepted count
 * for each ID. CI fails only when a count exceeds its baseline (a regression) —
 * shipping known debt is permitted, silently adding to it is not. When a count
 * drops below baseline the audit reports the improvement and asks for a baseline
 * refresh, so the register can only move in one direction.
 *
 * Usage:
 *   node scripts/audit.mjs            # human-readable report, exits 1 on regression
 *   node scripts/audit.mjs --json     # machine-readable report to stdout
 *   node scripts/audit.mjs --write-report   # also emit reports/audit.{json,md}
 *   node scripts/audit.mjs --refresh-baseline  # rewrite baseline from current state
 *
 * Exit codes: 0 clean or within baseline · 1 regression · 2 audit could not run
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'index.html');
const BASELINE = join(ROOT, 'scripts', 'audit-baseline.json');
const REPORT_DIR = join(ROOT, 'reports');

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const writeReport = argv.includes('--write-report');
const refreshBaseline = argv.includes('--refresh-baseline');

/* ------------------------------------------------------------------ *
 * Budgets — document payload
 * ------------------------------------------------------------------ */
const SIZE_BUDGET = { warn: 96_000, fail: 128_000 };

/* ------------------------------------------------------------------ *
 * Reference tables
 * ------------------------------------------------------------------ */
// Derived from `lucide-static` (icons/*.svg). Refresh whenever the Lucide CDN
// pin is bumped in index.html.
const LUCIDE_ICONS = new Set([
  'activity', 'atom', 'book-marked', 'cpu', 'droplet', 'file-check', 'file-text',
  'file-up', 'layout-grid', 'minus', 'network', 'palette', 'radio', 'refresh-cw',
  'search', 'shuffle', 'sparkles', 'square', 'terminal', 'trash-2', 'type',
  'upload-cloud', 'volume-2', 'volume-x', 'x', 'zap',
]);

// Tailwind v3 default palette families (sufficient to disambiguate utilities that
// reference a family the project never defines) + custom families from the inline
// `tailwind.config` block, which are parsed at runtime rather than hard-coded.
const TAILWIND_DEFAULT_FAMILIES = new Set([
  'transparent', 'current', 'inherit', 'black', 'white',
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'pink', 'rose',
]);

const TAILWIND_BUILTIN_ANIMATIONS = new Set(['spin', 'ping', 'pulse', 'bounce', 'none']);

// Purely presentational project classes: each must resolve to a rule in the inline
// <style> block. Behavioural hooks that carry no visual contract (`win-header`,
// `dock-btn`, `domain-btn`) are deliberately excluded — they exist for JS selectors.
const PROJECT_CLASSES = [
  'crt-overlay', 'glass-panel', 'window-active', 'hex-bg', 'no-select',
  'cursor-cross', 'no-scrollbar',
  'glow-text-cyan', 'glow-text-amber', 'glow-text-crimson',
];

// Identifiers whose value originates from a human (prompt text, dropped file name).
// The lookbehind keeps member access out (`item.text` reads a module constant),
// so only genuinely tainted free variables are counted.
const USER_ORIGIN_EXPR = /(?<![\w$.'"])(text|val|prompt|value)\b|file\.(name|type)/;

/* ------------------------------------------------------------------ *
 * Finding register — documentation, roadmap and changelog cross-reference
 * every ID below. Keep titles in sync with docs/ARCHITECTURE.md § Defect register.
 * ------------------------------------------------------------------ */
const REGISTER = {
  'NOO-001': { severity: 'high', title: 'Tailwind utilities reference an undefined colour family' },
  'NOO-002': { severity: 'low', title: 'Invalid Tailwind spacing step' },
  'NOO-003': { severity: 'medium', title: 'Animation used but never defined' },
  'NOO-004': { severity: 'low', title: 'Project class used but never defined' },
  'NOO-005': { severity: 'info', title: 'Animation defined but never used (dead config)' },
  'NOO-006': { severity: 'medium', title: 'Unknown Lucide icon name — icon cannot render' },
  'NOO-007': { severity: 'high', title: 'Unescaped interpolation into innerHTML' },
  'NOO-008': { severity: 'medium', title: 'Unpinned runtime dependency' },
  'NOO-009': { severity: 'low', title: 'Advertised content volume exceeds shipped data' },
  'NOO-010': { severity: 'low', title: 'Node-count parity drift between chrome and engine' },
  'NOO-011': { severity: 'low', title: 'Domain has no filter affordance' },
  'NOO-012': { severity: 'low', title: 'Window is absent from the dock' },
  'NOO-013': { severity: 'low', title: 'Element is framed as live but is never updated' },
  'NOO-014': { severity: 'medium', title: 'Canvas is not device-pixel-ratio scaled' },
  'NOO-015': { severity: 'medium', title: 'Physics broad phase is O(n²) with no spatial index' },
  'NOO-016': { severity: 'high', title: 'Accessibility semantics absent' },
  'NOO-017': { severity: 'low', title: 'Per-instance document listeners accumulate' },
  'NOO-018': { severity: 'medium', title: 'Link-preview metadata absent' },
  'NOO-019': { severity: 'high', title: 'Default window geometry exceeds narrow viewports' },
  'NOO-020': { severity: 'medium', title: 'Simulation integration is frame-rate dependent' },
  'NOO-021': { severity: 'low', title: 'RNG is unseeded — initial state is not reproducible' },
};

// Reference viewport the default desktop layout is expected to fit inside, and the
// narrowest panel on which every window must still be reachable by hand.
const REFERENCE_VIEWPORT = { width: 1440, height: 900 };
const MIN_REACHABLE_VIEWPORT = 1280;

/* ------------------------------------------------------------------ *
 * Load + baseline
 * ------------------------------------------------------------------ */
if (!existsSync(SOURCE)) {
  console.error(`audit: cannot find ${SOURCE}`);
  process.exit(2);
}

const src = readFileSync(SOURCE, 'utf8');
const bytes = Buffer.byteLength(src, 'utf8');
const lines = src.split('\n').length;

const scriptStart = src.indexOf('<script>\n        // ---');
const scriptRegion = scriptStart === -1 ? src : src.slice(scriptStart);
const styleBlock = (src.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

let baseline = {};
if (existsSync(BASELINE)) {
  try {
    baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).counts ?? {};
  } catch {
    console.error('audit: baseline is not valid JSON — run with --refresh-baseline');
    process.exit(2);
  }
}

const counts = {};
const evidence = {};
const note = (id, detail) => {
  counts[id] = (counts[id] ?? 0) + 1;
  (evidence[id] ??= []).push(detail);
};

/* ------------------------------------------------------------------ *
 * Generic DOM contract checks (these must always be zero)
 * ------------------------------------------------------------------ */
const fatal = [];

const ids = [...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const idSet = new Set(ids);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);

for (const dup of new Set(duplicates)) fatal.push(`duplicate DOM id: ${dup}`);

const lookedUp = [...src.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
for (const ref of new Set(lookedUp)) {
  if (!idSet.has(ref)) fatal.push(`getElementById('${ref}') has no matching element`);
}

const fusedTargets = [...src.matchAll(/restoreOrFocus\('([^']+)'\)/g)].map((m) => m[1]);
for (const ref of new Set(fusedTargets)) {
  if (!idSet.has(ref)) fatal.push(`restoreOrFocus('${ref}') targets a missing window`);
}

// Every global called from an inline handler must exist in the script region.
// The lookbehind drops method calls (`graphEngine.recluster()`, `event.preventDefault()`)
// so only bare global identifiers are considered.
const handlerCalls = new Set();
for (const m of src.matchAll(/on(?:click|input|change|drop|dragover|dragleave)="([^"]+)"/g)) {
  for (const call of m[1].matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) handlerCalls.add(call[1]);
}
const definedGlobals = new Set([
  ...[...scriptRegion.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
  ...[...scriptRegion.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g)].map((m) => m[1]),
]);
const DOM_GLOBALS = new Set(['event', 'this', 'document', 'window', 'navigator', 'lucide', 'Math', 'JSON']);
for (const call of handlerCalls) {
  if (!definedGlobals.has(call) && !DOM_GLOBALS.has(call)) {
    fatal.push(`inline handler calls undefined global: ${call}()`);
  }
}

/* ------------------------------------------------------------------ *
 * NOO-001 · Tailwind colour families
 * ------------------------------------------------------------------ */
// Parse the `colors` block of the inline tailwind.config rather than hard-coding
// tokens, so the audit tracks config changes automatically.
const customFamilies = new Set();
{
  const config = /tailwind\.config\s*=\s*\{([\s\S]*?)\n    <\/script>/.exec(src)?.[1] ?? '';
  const colors = /colors:\s*\{([\s\S]*?)\n {20}\},/.exec(config)?.[1] ?? '';
  // Only top-level keys of the `colors` block declare families; nested objects
  // (`neon: { crimson: … }`) declare shades of a family and would otherwise mask
  // exactly the defect this check exists to find.
  const keys = [...colors.matchAll(/^(\s*)(?:'([^']+)'|([a-z-]+)):\s*(?:'|#|\{)/gm)].map((m) => ({
    indent: m[1].length,
    name: m[2] ?? m[3],
  }));
  const topLevel = keys.length ? Math.min(...keys.map((k) => k.indent)) : 0;
  for (const k of keys) {
    if (k.indent === topLevel) customFamilies.add(k.name);
  }
}
{
  // Only class-bearing strings can produce utilities — scanning raw CSS would flag
  // declarations such as `border-radius`.
  const classStrings = [
    ...[...src.matchAll(/class="([^"]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/className\s*=\s*(?:'([^']*)'|"([^"]*)")/g)].map((m) => m[1] ?? m[2] ?? ''),
    ...[...src.matchAll(/className\s*=\s*`([^`]*)`/g)].map((m) => m[1]),
  ];
  // A colour utility is `<prefix>-<family>-<step>` where the step is a real shade of
  // the Tailwind scale. Requiring a shade excludes non-colour utilities that share
  // the prefixes (`border-b`, `border-2`, `text-center`, `border-dashed`).
  const PALETTE_STEPS = '50|100|200|300|400|500|600|700|800|900|950';
  const colourUtility = new RegExp(
    `\\b(?:bg|text|border|from|to|via|ring|fill|stroke|divide|placeholder|accent|caret|decoration|outline|shadow)-([a-z][a-z0-9]*)-(${PALETTE_STEPS})\\b`,
    'g',
  );
  for (const cls of classStrings) {
    for (const m of cls.matchAll(colourUtility)) {
      const family = m[1];
      if (customFamilies.has(family) || TAILWIND_DEFAULT_FAMILIES.has(family)) continue;
      note('NOO-001', m[0]);
    }
  }
}

/* ------------------------------------------------------------------ *
 * NOO-002 · Spacing steps (Tailwind only ships .5 fractional steps)
 * ------------------------------------------------------------------ */
for (const m of src.matchAll(/\b(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|w|h|inset|top|left|right|bottom|space-x|space-y)-(\d+\.\d+)\b/g)) {
  if (m[1].endsWith('.5')) continue;
  note('NOO-002', m[0]);
}

/* ------------------------------------------------------------------ *
 * NOO-003 / NOO-005 · Animation symmetry
 * ------------------------------------------------------------------ */
const definedAnimations = new Set(
  [...src.matchAll(/^\s{8,}'([a-zA-Z-]+)':\s*'[a-zA-Z]+\s/gm)].map((m) => m[1]),
);
const usedAnimations = new Set([...src.matchAll(/\banimate-([a-zA-Z-]+)\b/g)].map((m) => m[1]));
for (const a of usedAnimations) {
  if (TAILWIND_BUILTIN_ANIMATIONS.has(a) || definedAnimations.has(a)) continue;
  note('NOO-003', `animate-${a}`);
}
for (const a of definedAnimations) {
  if (!usedAnimations.has(a)) note('NOO-005', `animate-${a} (keyframes declared, never applied)`);
}

/* ------------------------------------------------------------------ *
 * NOO-004 · Project classes that must exist in the inline <style> block
 * ------------------------------------------------------------------ */
for (const cls of PROJECT_CLASSES) {
  const used = new RegExp(`(?:class="[^"]*\\b${cls}\\b|'[^']*\\b${cls}\\b)`, 'g');
  const declared = new RegExp(`\\.${cls}\\b`, 'g');
  if (used.test(src) && !declared.test(styleBlock)) note('NOO-004', `.${cls}`);
}

/* ------------------------------------------------------------------ *
 * NOO-006 · Icon registry
 * ------------------------------------------------------------------ */
for (const m of src.matchAll(/data-lucide="([^"]+)"/g)) {
  if (!LUCIDE_ICONS.has(m[1])) note('NOO-006', m[1]);
}

/* ------------------------------------------------------------------ *
 * NOO-007 · Unescaped interpolation of human input into innerHTML
 * ------------------------------------------------------------------ */
for (const m of src.matchAll(/\.innerHTML\s*=\s*`[^`]*\$\{[^`]*`/gs)) {
  const sinks = [...m[0].matchAll(/\$\{([^}]+)\}/g)].map((s) => s[1].trim());
  const risky = sinks.filter((s) => USER_ORIGIN_EXPR.test(s));
  if (risky.length) note('NOO-007', `interpolates ${risky.join(', ')}`);
}

/* ------------------------------------------------------------------ *
 * NOO-008 · Unpinned runtime dependencies
 * ------------------------------------------------------------------ */
for (const m of src.matchAll(/(?:src|href)="(https:\/\/[^"]+)"/g)) {
  const url = m[1];
  const pinned = /@(\d+\.\d+\.\d+|[0-9a-f]{7,})/.test(url) || !/cdn|unpkg|jsdelivr/.test(url);
  if (!pinned) note('NOO-008', url);
}

/* ------------------------------------------------------------------ *
 * NOO-009 / NOO-010 · Content parity between chrome and data
 * ------------------------------------------------------------------ */
{
  const grimoireCount = (src.match(/\{ title: "/g) || []).length;
  const claim = src.match(/(\d+)\+ APHORISTIC FRAGMENTS/);
  if (claim && grimoireCount < Number(claim[1])) {
    note('NOO-009', `grimoire advertises ${claim[1]}+ fragments, ships ${grimoireCount}`);
  }

  const spawn = src.match(/for \(let i = 0; i < (\d+); i\+\+\)/);
  const spawned = spawn ? Number(spawn[1]) : null;
  const badge = src.match(/id="synapse-count"[^>]*>(\d+) NODES/);
  if (spawned && badge && Number(badge[1]) !== spawned) {
    note('NOO-010', `header badge claims ${badge[1]} nodes, engine spawns ${spawned}`);
  }
  const banner = src.match(/initialized with (\d+)\+ active/);
  if (spawned && banner && Number(banner[1]) > spawned) {
    note('NOO-010', `boot banner claims ${banner[1]}+ nodes, engine spawns ${spawned}`);
  }
}

/* ------------------------------------------------------------------ *
 * NOO-011 · Domains without a filter affordance
 * ------------------------------------------------------------------ */
{
  const domains = [...src.matchAll(/^\s{12}(\w+): \{ name: '([^']+)'/gm)].map((m) => m[1]);
  const filters = new Set([...src.matchAll(/filterDomain\('(\w+)'\)/g)].map((m) => m[1]));
  for (const d of domains) {
    if (d !== 'all' && !filters.has(d)) note('NOO-011', d);
  }
}

/* ------------------------------------------------------------------ *
 * NOO-012 · Windows missing from the dock
 * ------------------------------------------------------------------ */
{
  const windows = [...src.matchAll(/id="(win-[a-z-]+)"/g)].map((m) => m[1]);
  const docked = new Set(fusedTargets);
  for (const w of windows) if (!docked.has(w)) note('NOO-012', w);
}

/* ------------------------------------------------------------------ *
 * NOO-013 · Elements framed as live but never written at runtime
 * ------------------------------------------------------------------ *
 * The document presents these as streaming telemetry. Which elements count as
 * "live-framed" is a semantic judgement regex cannot infer, so the set is curated —
 * but the *condition* is verified mechanically: the moment the runtime writes to
 * one of them, the finding disappears on the next run.
 */
const LIVE_FRAMED_IDS = ['entropy-val', 'stat-sub', 'radar-poly', 'telemetry-log'];
for (const id of LIVE_FRAMED_IDS) {
  if (!idSet.has(id)) {
    fatal.push(`NOO-013 watchlist references a missing element: ${id}`);
    continue;
  }
  const writes =
    (src.split(`"${id}"`).length - 1) + (src.split(`'${id}'`).length - 1) - 1;
  if (writes === 0) {
    const tag = src.match(new RegExp(`<([a-z0-9-]+)[^>]*\\bid="${id}"`))?.[1] ?? 'unknown';
    note('NOO-013', `${id} <${tag}> — declared as live, zero runtime writes`);
  }
}

/* ------------------------------------------------------------------ *
 * NOO-014 · Device-pixel-ratio scaling
 * ------------------------------------------------------------------ */
if (!/devicePixelRatio/.test(src)) note('NOO-014', 'no devicePixelRatio handling in canvas setup');

/* ------------------------------------------------------------------ *
 * NOO-015 · Physics complexity (informational, derived)
 * ------------------------------------------------------------------ */
{
  const nodes = Number((src.match(/for \(let i = 0; i < (\d+); i\+\+\)/) || [])[1] ?? 0);
  note('NOO-015', `${(nodes * (nodes - 1)) / 2} pair evaluations per frame at ${nodes} nodes`);
}

/* ------------------------------------------------------------------ *
 * NOO-016 · Accessibility semantics
 * ------------------------------------------------------------------ */
{
  const aria = (src.match(/\baria-[a-z]+=/g) || []).length;
  const roles = (src.match(/\brole="/g) || []).length;
  const tabindex = (src.match(/\btabindex="/g) || []).length;
  const mutedOutline = (src.match(/\boutline-none\b/g) || []).length;
  if (aria + roles + tabindex === 0) {
    note('NOO-016', `${aria} aria-*, ${roles} role, ${tabindex} tabindex (${mutedOutline} outline-none)`);
  }
}

/* ------------------------------------------------------------------ *
 * NOO-017 · Per-instance document listeners
 * ------------------------------------------------------------------ */
{
  const draggable = /function makeDraggable[\s\S]*?\n        \}/.exec(src);
  if (draggable) {
    const perInstance = (draggable[0].match(/document\.addEventListener\(/g) || []).length;
    const instances = (src.match(/id="win-[a-z-]+"/g) || []).length;
    if (perInstance > 0) {
      note('NOO-017', `${perInstance} document listeners × ${instances} windows = ${perInstance * instances} permanent`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * NOO-018 · Link-preview metadata
 * ------------------------------------------------------------------ */
{
  const missing = [];
  if (!/<meta\s+name="description"/.test(src)) missing.push('description');
  if (!/rel="icon"/.test(src)) missing.push('favicon');
  if (!/property="og:/.test(src)) missing.push('og:*');
  if (missing.length) note('NOO-018', `missing: ${missing.join(', ')}`);
}

/* ------------------------------------------------------------------ *
 * NOO-019 · Default desktop geometry vs. reachable viewports
 * ------------------------------------------------------------------ *
 * A window can only be dragged by its header, so roughly 120 px of header must be
 * inside the viewport for the window to be recoverable by hand. A window that is
 * both off-canvas and absent from the dock cannot be recovered at all.
 */
const MIN_HANDLE_PX = 120;
{
  const block = /function resetWindowPositions[\s\S]*?\n        \}/.exec(src)?.[0] ?? '';
  const boxes = [...block.matchAll(/top:\s*(\d+),\s*left:\s*(\d+),\s*w:\s*(\d+),\s*h:\s*(\d+)/g)].map(
    ([, top, left, w, h]) => ({ top: +top, left: +left, w: +w, h: +h }),
  );
  if (boxes.length) {
    const right = Math.max(...boxes.map((b) => b.left + b.w));
    const bottom = Math.max(...boxes.map((b) => b.top + b.h));
    if (right > REFERENCE_VIEWPORT.width || bottom > REFERENCE_VIEWPORT.height) {
      note('NOO-019', `default layout spans ${right}×${bottom}px vs ${REFERENCE_VIEWPORT.width}×${REFERENCE_VIEWPORT.height} reference viewport`);
    }
    const docked = new Set([...src.matchAll(/restoreOrFocus\('([^']+)'\)/g)].map((m) => m[1]));
    const defaults = [...src.matchAll(/id="(win-[a-z-]+)"[^>]*?style="([^"]*)"/g)].map(
      ([, id, style]) => ({
        id,
        left: Number(/left:\s*(\d+)/.exec(style)?.[1] ?? 0),
      }),
    );
    for (const w of defaults) {
      const required = w.left + MIN_HANDLE_PX;
      if (required > MIN_REACHABLE_VIEWPORT) {
        note(
          'NOO-019',
          `${w.id} needs ≥${required}px viewport width to be grabbable` +
            (docked.has(w.id) ? ' (recoverable via dock)' : ' (undocked — unreachable, requires reload)'),
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * NOO-020 · Frame-rate independence of the integrator
 * ------------------------------------------------------------------ */
{
  const physics = /function updatePhysics[\s\S]*?\n        \}/.exec(src)?.[0] ?? '';
  if (physics && !/\b(dt|delta|deltaTime|elapsed|timestamp)\b/.test(physics)) {
    note('NOO-020', 'updatePhysics advances by a constant increment per frame — 144 Hz runs ~2.4× faster than 60 Hz');
  }
}

/* ------------------------------------------------------------------ *
 * NOO-021 · Reproducibility of initial state
 * ------------------------------------------------------------------ *
 * A deterministic first frame is a prerequisite for snapshot testing: without a
 * seeded generator, no two runs of the same commit produce the same layout, so
 * pixel diffs are meaningless. Reported once with the call-site count.
 */
{
  const calls = (src.match(/Math\.random\(\)/g) || []).length;
  const seeded = /\b(mulberry32|seedrandom|sfc32|createRng|xorshift)\b/i.test(src);
  if (calls > 0 && !seeded) {
    note('NOO-021', `${calls} unseeded Math.random() call sites; no seeded PRNG helper present`);
  }
}

/* ------------------------------------------------------------------ *
 * Reporting
 * ------------------------------------------------------------------ */
const budget = {
  bytes,
  lines,
  warn: SIZE_BUDGET.warn,
  fail: SIZE_BUDGET.fail,
  status: bytes > SIZE_BUDGET.fail ? 'fail' : bytes > SIZE_BUDGET.warn ? 'warn' : 'ok',
};

const regressions = [];
const improvements = [];
const tracked = [];

for (const [id, meta] of Object.entries(REGISTER)) {
  const seen = counts[id] ?? 0;
  const allowed = baseline[id] ?? 0;
  const row = { id, ...meta, seen, allowed, evidence: evidence[id] ?? [] };
  if (seen > allowed) regressions.push(row);
  else if (seen < allowed) improvements.push(row);
  else if (seen > 0) tracked.push(row);
}

const ok = regressions.length === 0 && fatal.length === 0 && budget.status !== 'fail';

const report = {
  generatedAt: new Date().toISOString(),
  source: 'index.html',
  budget,
  fatal,
  regressions,
  improvements,
  tracked,
  counts,
  pass: ok,
};

if (refreshBaseline) {
  const sorted = Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    BASELINE,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), counts: sorted }, null, 2)}\n`,
  );
  console.log(`audit: baseline refreshed (${Object.keys(sorted).length} register IDs)`);
  process.exit(0);
}

if (writeReport) {
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, 'audit.json'), `${JSON.stringify(report, null, 2)}\n`);
}

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const badge = budget.status === 'ok' ? 'ok' : budget.status;
  console.log('\n  NOÖSPHERE // OS — static integrity audit');
  console.log('  ────────────────────────────────────────────────────────────');
  console.log(`  source            index.html`);
  console.log(`  payload           ${bytes.toLocaleString()} B / ${lines.toLocaleString()} lines   [${badge}]`);
  console.log(`  register IDs      ${Object.keys(REGISTER).length} tracked, ${Object.values(counts).reduce((a, b) => a + b, 0)} total findings`);
  console.log(`  DOM contract      ${fatal.length === 0 ? 'clean' : `${fatal.length} violation(s)`}`);

  if (tracked.length) {
    console.log(`\n  Known debt (within baseline) — ${tracked.length}`);
    for (const r of tracked) {
      console.log(`   • ${r.id}  [${r.severity.padEnd(6)}] ${r.title}  ×${r.seen}`);
    }
  }
  if (improvements.length) {
    console.log(`\n  Improved — refresh the baseline to lock it in`);
    for (const r of improvements) console.log(`   ↓ ${r.id}  ${r.allowed} → ${r.seen}`);
  }
  if (regressions.length) {
    console.log(`\n  REGRESSIONS — ${regressions.length}`);
    for (const r of regressions) {
      console.log(`   ✗ ${r.id}  ${r.title}  ${r.allowed} → ${r.seen}`);
      for (const e of r.evidence.slice(0, 3)) console.log(`       ${e}`);
    }
  }
  if (fatal.length) {
    console.log(`\n  FATAL`);
    for (const f of fatal) console.log(`   ✗ ${f}`);
  }
  console.log(`\n  ${ok ? '✔ PASS' : '✘ FAIL'}\n`);
}

process.exit(ok ? 0 : 1);
