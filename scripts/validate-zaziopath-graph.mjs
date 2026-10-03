#!/usr/bin/env node
/** Validate the committed, source-derived browser graph without loading a browser. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const DATA = resolve('data/zaziopath-graph.js');
const errors = [];
const fail = message => errors.push(message);

let corpus;
try {
  const sandbox = { window: {} };
  runInNewContext(readFileSync(DATA, 'utf8'), sandbox, { timeout: 1000, filename: DATA });
  corpus = sandbox.window.ZAZIOPATH_GRAPH;
} catch (error) {
  console.error(`graph validation failed: cannot load ${DATA}: ${error.message}`);
  process.exit(1);
}

if (!corpus || corpus.version !== 1) fail('expected window.ZAZIOPATH_GRAPH version 1');
if (!corpus?.corpus?.name || !corpus?.corpus?.revision) fail('missing corpus identity or source revision');
const VALID_EPISTEMIC = new Set(['source', 'inference', 'synthesis', 'open-question']);
const strata = Array.isArray(corpus?.strata) ? corpus.strata : [];
const nodes = Array.isArray(corpus?.nodes) ? corpus.nodes : [];
const edges = Array.isArray(corpus?.edges) ? corpus.edges : [];
const fragments = Array.isArray(corpus?.fragments) ? corpus.fragments : [];
const stratumIds = new Set();
const nodeIds = new Set();
const edgeIds = new Set();
const fragmentIds = new Set();
const normalizedConcepts = new Map();

const normalize = value => String(value ?? '')
  .normalize('NFKC')
  .toLocaleLowerCase('en')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim().replace(/\s+/g, ' ');
const hasSource = refs => Array.isArray(refs) && refs.some(ref =>
  ref && typeof ref.path === 'string' && ref.path.trim() &&
  typeof ref.excerpt === 'string' && ref.excerpt.trim() &&
  typeof ref.locator === 'string' && ref.locator.trim()
);

if (strata.length !== 8) fail(`expected 8 Zaziopath strata, found ${strata.length}`);
for (const stratum of strata) {
  if (!stratum?.id || !stratum.label || !/^#[\da-f]{6}$/i.test(stratum.color || '')) fail(`invalid stratum record: ${JSON.stringify(stratum)}`);
  if (stratumIds.has(stratum.id)) fail(`duplicate stratum id: ${stratum.id}`);
  stratumIds.add(stratum.id);
}

for (const node of nodes) {
  if (!node?.id) { fail('node is missing an id'); continue; }
  if (nodeIds.has(node.id)) fail(`duplicate node id: ${node.id}`);
  nodeIds.add(node.id);
  if (!node.title?.trim()) fail(`node ${node.id} is missing a title`);
  if (!stratumIds.has(node.stratum)) fail(`node ${node.id} references invalid stratum ${node.stratum}`);
  if (!VALID_EPISTEMIC.has(node.epistemic)) fail(`node ${node.id} has invalid epistemic status ${node.epistemic}`);
  if (!node.provenance || typeof node.provenance.category !== 'string' || !node.provenance.category.trim()) fail(`node ${node.id} is missing provenance/category`);
  if (!hasSource(node.sources)) fail(`node ${node.id} is missing a source path, locator, and excerpt`);
  if (node.provenance?.epistemic !== node.epistemic) fail(`node ${node.id} provenance status disagrees with node status`);
  if (node.provenance?.sourceBacked !== (node.epistemic === 'source')) fail(`node ${node.id} sourceBacked flag disagrees with epistemic status`);
  if (!['stratum', 'source-document'].includes(node.kind)) {
    const key = normalize(node.title);
    if (key) {
      const previous = normalizedConcepts.get(key);
      if (previous) fail(`duplicate normalized concept title “${node.title}” (${previous} and ${node.id})`);
      else normalizedConcepts.set(key, node.id);
    }
  }
}

for (const edge of edges) {
  if (!edge?.id) { fail('edge is missing an id'); continue; }
  if (edgeIds.has(edge.id)) fail(`duplicate edge id: ${edge.id}`);
  edgeIds.add(edge.id);
  if (!nodeIds.has(edge.source)) fail(`edge ${edge.id} has missing source target ${edge.source}`);
  if (!nodeIds.has(edge.target)) fail(`edge ${edge.id} has missing target ${edge.target}`);
  if (!VALID_EPISTEMIC.has(edge.epistemic)) fail(`edge ${edge.id} has invalid epistemic status ${edge.epistemic}`);
  if (!edge.type || !edge.label) fail(`edge ${edge.id} is missing relationship type or label`);
  if (!edge.provenance || typeof edge.provenance.category !== 'string' || !edge.provenance.category.trim()) fail(`edge ${edge.id} is missing provenance/category`);
  if (edge.epistemic === 'source' && !hasSource(edge.provenance?.sourceRefs)) fail(`source edge ${edge.id} is missing its citation excerpt`);
  for (const ref of edge.provenance?.sourceRefs || []) {
    if (!ref?.path || !ref?.locator || !ref?.excerpt) fail(`edge ${edge.id} has an incomplete source reference`);
  }
}

for (const fragment of fragments) {
  if (!fragment?.id) { fail('Grimoire fragment is missing an id'); continue; }
  if (fragmentIds.has(fragment.id)) fail(`duplicate Grimoire fragment id: ${fragment.id}`);
  fragmentIds.add(fragment.id);
  if (!fragment.title?.trim()) fail(`fragment ${fragment.id} is missing a title`);
  if (!stratumIds.has(fragment.stratum)) fail(`fragment ${fragment.id} references invalid stratum ${fragment.stratum}`);
  if (!VALID_EPISTEMIC.has(fragment.epistemic)) fail(`fragment ${fragment.id} has invalid epistemic status ${fragment.epistemic}`);
  if (!hasSource(fragment.sources)) fail(`fragment ${fragment.id} is missing provenance excerpt`);
  for (const nodeId of fragment.relatedNodeIds || []) if (!nodeIds.has(nodeId)) fail(`fragment ${fragment.id} references missing node ${nodeId}`);
}

const result = {
  corpus: corpus?.corpus?.name || 'unknown',
  revision: corpus?.corpus?.revision || 'unknown',
  strata: strata.length,
  nodes: nodes.length,
  edges: edges.length,
  sourceEdges: edges.filter(edge => edge.epistemic === 'source').length,
  fragments: fragments.length,
  normalizedConcepts: normalizedConcepts.size,
  errors,
  pass: errors.length === 0,
};
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else if (result.pass) console.log(`graph validation: PASS · ${result.strata} strata · ${result.nodes} nodes · ${result.edges} edges · ${result.fragments} source fragments · ${result.revision}`);
else {
  console.error(`graph validation: FAIL · ${errors.length} issue(s)`);
  for (const error of errors) console.error(`  - ${error}`);
}
if (!result.pass) process.exit(1);
