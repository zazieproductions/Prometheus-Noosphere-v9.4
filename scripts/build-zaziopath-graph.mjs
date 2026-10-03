#!/usr/bin/env node
/**
 * Build the committed, curated NOÖSPHERE graph from a local Zaziopath checkout.
 *
 * Usage:
 *   node scripts/build-zaziopath-graph.mjs --source ../Zaziopath
 *
 * The corpus is curated here rather than discovered by a browser-time crawler. The
 * builder verifies every cited file and anchor, captures short source excerpts, checks
 * graph integrity, and writes a deterministic browser-loadable data object.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const SOURCE_ROOT = resolve(arg('source', process.env.ZAZIOPATH_SOURCE || join(ROOT, '..', 'Zaziopath')));
const OUTPUT = join(ROOT, 'data', 'zaziopath-graph.js');
const MODEL = 'llama3.1:8b';

const sourceRef = (path, section, anchor = '', locator = section, role = 'primary') => ({
  path, label: path, section, locator, role, ...(anchor ? { anchor } : {}),
});
const README = (section, anchor, locator = section, role = 'primary') =>
  sourceRef('README.md', section, anchor, locator, role);

const STRATA = [
  {
    id: 'index-meta', label: 'INDEX / META', short: 'INDEX', glyph: '◈', sourceColor: '#231F20',
    color: '#aeb8c8', summary: 'Maps, registries, repository governance, and the source graph itself.',
    sources: [README('§00a · The colour code', '**INDEX & META**', 'README.md §00a · colour-code table')],
  },
  {
    id: 'identity', label: 'IDENTITY', short: 'IDENTITY', glyph: '◉', sourceColor: '#0072B2',
    color: '#38bdf8', summary: 'Typology, self-description, memory export, and identity material; recorded as self-report, not diagnosis.',
    sources: [README('§00a · The colour code', '**IDENTITY**', 'README.md §00a · colour-code table')],
  },
  {
    id: 'shadow', label: 'SHADOW', short: 'SHADOW', glyph: '◐', sourceColor: '#CC79A7',
    color: '#e879b9', summary: 'Shadow observations, named patterns, inversions, and the parts-work archive.',
    sources: [README('§00a · The colour code', '**SHADOW**', 'README.md §00a · colour-code table')],
  },
  {
    id: 'signal-evidence', label: 'SIGNAL / EVIDENCE', short: 'SIGNAL', glyph: '▤', sourceColor: '#E69F00',
    color: '#ffb52e', summary: 'Catalogs, media records, case files, and evidence governance.',
    sources: [README('§00a · The colour code', '**SIGNAL / EVIDENCE**', 'README.md §00a · colour-code table')],
  },
  {
    id: 'recursion-lab', label: 'RECURSION LAB', short: 'RECURSION', glyph: '∞', sourceColor: '#009E73',
    color: '#34d399', summary: 'AI tribunals, recursive readings, ablations, and experiments on interpretation.',
    sources: [README('§00a · The colour code', '**RECURSION LAB**', 'README.md §00a · colour-code table')],
  },
  {
    id: 'stewardship', label: 'STEWARDSHIP', short: 'STEWARDSHIP', glyph: '△', sourceColor: '#56B4E9',
    color: '#7dd3fc', summary: 'Protocols and observable actions intended to carry an insight into practice.',
    sources: [README('§00a · The colour code', '**STEWARDSHIP**', 'README.md §00a · colour-code table')],
  },
  {
    id: 'specimens', label: 'SPECIMENS', short: 'SPECIMENS', glyph: '⚠', sourceColor: '#D55E00',
    color: '#fb7046', summary: 'Offensive-grade material held as annotated specimen, defence, or creative material—not a toolkit.',
    sources: [README('§00a · The colour code', '**SPECIMENS**', 'README.md §00a · colour-code table')],
  },
  {
    id: 'mythography', label: 'MYTHOGRAPHY', short: 'MYTH', glyph: '☾', sourceColor: '#F0E442',
    color: '#f0e442', summary: 'Worldbuilding, constructed languages, mythic personae, and creative works.',
    sources: [README('§00a · The colour code', '**MYTHOGRAPHY**', 'README.md §00a · colour-code table')],
  },
];

const makeNode = (id, title, stratum, kind, epistemic, category, summary, tags, sources, extra = {}) => ({
  id, title, stratum, kind, epistemic, summary, tags,
  provenance: {
    category, epistemic,
    recordedInSource: sources.some(ref => ref.path),
    note: extra.provenanceNote || '',
  },
  sources,
  relatedFiles: extra.relatedFiles || [],
  ...(extra.excerpt ? { excerpt: extra.excerpt } : {}),
});

const strataNodes = STRATA.map(s => makeNode(
  `stratum-${s.id}`, s.label, s.id, 'stratum', 'source', 'source-backed-concept', s.summary,
  ['stratum', s.short.toLowerCase()], s.sources,
  { sourceColor: s.sourceColor, color: s.color, glyph: s.glyph, provenanceNote: 'Stratum name and color are declared by the Zaziopath README.' },
));

const sourceNodes = [
  makeNode('source-readme', 'README — Zaziopath', 'index-meta', 'source-document', 'source', 'source-document',
    'The repository index defines Zaziopath as a living self-analysis archive, sets its strata and method, and states its evidence and use boundaries.',
    ['index', 'method', 'governance'], [README('§00 · What this repository is', 'working instrument for self-analysis', 'README.md §00 · opening definition')],
    { relatedFiles: ['🕸 Major Knowledge Graph.md', '⚡ Unexpected Connections.md'] }),
  makeNode('source-major-graph', 'Major Knowledge Graph', 'index-meta', 'source-document', 'source', 'source-document',
    'The source repository’s practice graph, vault strata, and cross-currents, including the deliberately blank Missing Variable node.',
    ['graph', 'index', 'wires'], [sourceRef('🕸 Major Knowledge Graph.md', 'Major Knowledge Graph', 'The practice graph plus the vault strata added 2026-09-02', 'opening description')],
    { relatedFiles: ['README.md', '⚡ Unexpected Connections.md'] }),
  makeNode('source-unexpected-connections', 'Unexpected Connections', 'index-meta', 'source-document', 'source', 'source-document',
    'A curated register of cross-stratum relationships. Its connections are source-authored interpretations, not independent proof of the proposed meanings.',
    ['wires', 'cross-stratum', 'interpretation'], [sourceRef('⚡ Unexpected Connections.md', 'Opening note', 'The vault\'s strata usually stay separated', 'opening note')],
    { relatedFiles: ['README.md', '🔍 CASE FILE — Pattern Forensics.md'] }),
  makeNode('source-particle-collider', 'Particle Collider — Cross-Stratum Experiments', 'recursion-lab', 'source-document', 'source', 'source-document',
    'A dated, seeded experiment log that records 13 cross-stratum beams: 3 HOLD, 9 SNAP, and 1 NO-BEAM, with explicit nulls and limits.',
    ['experiment', 'cross-stratum', 'null-results'], [sourceRef('⚛️ PARTICLE COLLIDER — Cross-Stratum Experiments.md', '§0 · The question the chamber asks', 'never promote an aesthetic coincidence into evidence without testing it', 'opening rule')],
    { relatedFiles: ['tools/particle_collider.py', 'docs/collider/beam_log.json'] }),
  makeNode('source-counter-zaziopath', 'Counter-Zaziopath', 'index-meta', 'source-document', 'source', 'source-document',
    'An adversarial review of overfitting, AI suggestion loops, typology reification, aesthetic coherence, prestige, and unresolved objections.',
    ['counter-reading', 'critique', 'open-questions'], [sourceRef('🧨 COUNTER-ZAZIOPATH.md', '§2 · The eight objections', 'The pattern system overfits.', 'CZ-01 · opening claim')],
    { relatedFiles: ['CLAIM_PROVENANCE_LEDGER.md', 'META_ANALYSIS_OF_ZAZIOPATH.md'] }),
  makeNode('source-controlled-amnesia', 'Controlled Amnesia Experiments', 'recursion-lab', 'source-document', 'source', 'source-document',
    'Eight category ablations test which documents carry each reconstruction; the report treats this as a claim about the archive, not a diagnosis of a person.',
    ['ablation', 'experiment', 'method'], [sourceRef('🧠 CONTROLLED AMNESIA EXPERIMENTS.md', '§0 · The question and control', 'Eight times, one category of information was surgically deleted from the corpus', 'method summary')],
    { relatedFiles: ['META_ANALYSIS_OF_ZAZIOPATH.md'] }),
  makeNode('source-pattern-forensics', 'Case File — Pattern Forensics', 'signal-evidence', 'source-document', 'source', 'source-document',
    'Ten dated findings read from catalog metadata and repository artifacts; each separates exhibit, inference, and confidence tier.',
    ['evidence', 'catalog', 'patterns'], [sourceRef('🔍 CASE FILE — Pattern Forensics.md', 'Premise · ten findings', 'Ten findings follow. Each carries its exhibits, its evidence, its inference, and its tier.', 'method statement')],
    { relatedFiles: ['Zazie_Productions_Discography.csv', 'README.md'] }),
  makeNode('source-claim-ledger', 'Claim Provenance Ledger', 'index-meta', 'source-document', 'source', 'source-document',
    'A ten-claim pilot that records source type, claim level, independence, verification, alternatives, limitations, and falsifiers.',
    ['provenance', 'claims', 'governance'], [sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'Ledger status', 'Pilot ledger', 'opening metadata')],
    { relatedFiles: ['EVIDENCE_GOVERNANCE_HANDBOOK.md', 'README.md'] }),
  makeNode('source-evidence-governance', 'Evidence Governance Handbook', 'index-meta', 'source-document', 'source', 'source-document',
    'A controlled vocabulary and claim-record standard for preserving source versions, transformations, independence, alternatives, verification, correction, and sensitivity.',
    ['provenance', 'governance', 'claim-level'], [sourceRef('EVIDENCE_GOVERNANCE_HANDBOOK.md', '§1 · Governing Principle', 'A claim does not become evidence because it is dated, linked, diagrammed, repeated, or written in forensic language.', '§1 · governing principle')],
    { relatedFiles: ['CLAIM_PROVENANCE_LEDGER.md'] }),
  makeNode('source-meta-analysis', 'Meta-Analysis of Zaziopath Interpretations', 'index-meta', 'source-document', 'source', 'source-document',
    'A skeptical reading of the verdict sequence that distinguishes description, inference, and consequence and treats inherited repetition cautiously.',
    ['meta-analysis', 'AI-recursion', 'independence'], [sourceRef('META_ANALYSIS_OF_ZAZIOPATH.md', 'Evidence status', 'not six demonstrably independent observers', 'Evidence Status')],
    { relatedFiles: ['🧨 COUNTER-ZAZIOPATH.md', 'META-ANALYSIS — The Verdict Corpus Audited.md'] }),
  makeNode('source-collected-readings', 'Zaziopath — Collected Readings', 'shadow', 'source-document', 'source', 'source-document',
    'A dated collection of two case-study readings and the questions each leaves open; it is interpretive material, not primary behavioral evidence.',
    ['readings', 'case-study', 'interpretation'], [sourceRef('ZAZIOPATH — Collected Readings (2026-09-23).md', 'Part II · The Receipt and the Record', 'A calm reading of the Zaziopath vault', 'Part II heading')],
    { relatedFiles: ['CASE STUDY — The Receipt and the Record.md', 'CASE STUDY — The Summoned Witness.md'] }),
  makeNode('source-shadow-journal', 'Shadow Journal Observations', 'shadow', 'source-document', 'source', 'source-document',
    'A 20-page journal artifact catalogued by the README as observations about performance, neutrality, meta-level addiction, paradox, and self-idealization.',
    ['shadow', 'journal', 'patterns'], [
      sourceRef('Shadow Journal Observations .pdf', 'Primary artifact', '', '20-page PDF; source text is not bundled here', 'primary-artifact'),
      README('§03 · The core · source inventory', 'Long-form pattern observations: the Strategist Performer, the allergy to the neutral middle, meta-level addiction, paradox as fuel, self-idealization as armour.', 'README.md §03 · catalogue summary', 'catalogue-summary'),
    ], { relatedFiles: ['Zazie_Productions_Shadow_Signal_Stewardship_Mega_Compendium.pdf'] }),
  makeNode('source-identity-vault', 'Identity / Typological Vault', 'identity', 'source-document', 'source', 'source-document',
    'The identity card is catalogued as typology, Big Five, shadow profile, cognitive style, creative profile, aesthetics, values, and politics; the README explicitly frames it as self-report, not diagnosis.',
    ['identity', 'typology', 'self-report'], [
      sourceRef('Identity _ Typological Vault.pdf', 'Primary artifact', '', '6-page PDF; source text is not bundled here', 'primary-artifact'),
      README('§03 · The core · source inventory', 'The identity card. Typology, Big Five, shadow profile, cognitive style, creative profile, aesthetics, values, politics.', 'README.md §03 · catalogue summary', 'catalogue-summary'),
    ], { relatedFiles: ['JSON file re-export ChatGPT Memory .md', 'Ideological Inversion Audit.pdf'] }),
  makeNode('source-memory-export', 'ChatGPT Memory Export', 'identity', 'source-document', 'source', 'source-document',
    'A model-memory summary of preferences and patterns. The provenance ledger warns that this is not an independent behavioral record.',
    ['identity', 'memory', 'model-provenance'], [sourceRef('JSON file re-export ChatGPT Memory .md', 'Assistant Response Preferences', 'Assistant Response Preferences', 'top-level key')],
    { relatedFiles: ['GPT Model 7.7-t Surveillance Subroutine.pdf', '🤖 MACHINE ANCESTRY OF THE SELF-MODEL.md'] }),
  makeNode('source-identity-castles', 'Recursive Identity Castles', 'mythography', 'source-document', 'source', 'creative-work',
    'A fictional future tribunal frames “Zazie Productions” as a collective fiction and calls for an action that could refute the claim; the source labels the passage as a constructed scenario.',
    ['mythography', 'creative-work', 'identity'], [sourceRef('RECURSIVE IDENTITY CASTLES.md', 'Opening scenario', 'It believes “Zazie Productions” was a collective fiction.', 'opening scenario')],
    { relatedFiles: ['Zazie_Productions_Complete_Discography.xlsx', 'Zazie_Media_Master (1).pdf'] }),
  makeNode('source-mythographic-childhood', 'Mythographic Childhood', 'mythography', 'source-document', 'source', 'creative-work',
    'A first-person mythic narrative; the repository explicitly treats it as constructed mythography, not literal childhood evidence.',
    ['mythography', 'creative-work', 'fiction'], [sourceRef('Mythographic Childhood.md', 'Opening narrative', 'I was born in a museum, during a thunderstorm', 'opening passage')],
    { relatedFiles: ['RECURSIVE IDENTITY CASTLES.md', 'Anémone Crottin-Foufflée Identity.md'] }),
  makeNode('source-twelve-lung', 'Twelve-Lung Grammar of the Forgotten Species', 'mythography', 'source-document', 'source', 'creative-work',
    'A constructed-language prompt and worldbuilding exercise about an extinct species, pressure-borne speech, and reversible utterances.',
    ['mythography', 'constructed-language', 'creative-work'], [sourceRef('Twelve-Lung Grammar of the Forgotten Species.md', 'Prompt · invented language', 'Invent a living language spoken by a once-extinct species with twelve lungs and no vocal cords.', 'opening prompt')],
    { relatedFiles: ['GIBBERETIC SEED SPIRAL — glocht.md', 'Dr. Caligo Vespertine in the Negative Observatory.md'] }),
  makeNode('source-matrix-protocol', 'Sovereign Interface Protocol (The Matrix)', 'mythography', 'source-document', 'source', 'creative-work',
    'A speculative protocol that frames “the Matrix” as an internal feedback loop; linked in the source graph to the ideological-inversion finding.',
    ['mythography', 'protocol', 'creative-work'], [sourceRef('Sovereign Interface Protocol (The Matrix).md', 'Opening frame', 'THE MATRIX IS NOT A PLACE. IT’S A LOOP INSIDE YOU.', 'opening claim')],
    { relatedFiles: ['Ideological Inversion Audit.pdf'] }),
  makeNode('source-four-by-three', 'Album Structure — 4×3 Fractal Modules', 'mythography', 'source-document', 'source', 'creative-work',
    'A music-structure document specifies four variants for each of twelve tracks, including a Negative Mirror Mix and a Dissolution Edit.',
    ['music', 'creative-work', 'crosswalk'], [sourceRef('ALBUM STRUCTURE - 4×3 FRACTAL MODULES.md', 'Track variants', '1 Negative Mirror Mix (reverse architecture)', 'variant list')],
    { relatedFiles: ['Zazie_Productions_Discography.csv', 'ZazieKanwarTorge_ArtZoydResidency_SignalRotAtlas_2026.pdf'] }),
  makeNode('source-cognitive-infiltration', 'Cognitive Infiltration Blueprints', 'specimens', 'source-document', 'source', 'source-document',
    'A specimen file of symbolic and persuasive schemas; Zaziopath’s README classifies this material as specimen and defence, not an endorsed toolkit.',
    ['specimen', 'defence', 'annotated-material'], [sourceRef('Cognitive Infiltration Blueprints.md', 'Core structure', 'CORE STRUCTURE: THE SIX-NODE HEXAD', 'opening structure')],
    { relatedFiles: ['README.md', 'Social Engineering Email Templates .md'] }),
  makeNode('source-social-engineering', 'Social Engineering Email Templates', 'specimens', 'source-document', 'source', 'source-document',
    'A set of rhetorical postures with mechanics annotated. The README marks the file as a specimen, not a send-this file.',
    ['specimen', 'rhetoric', 'defence'], [sourceRef('Social Engineering Email Templates .md', 'First specimen', 'The Psychopathic Charmer', 'first heading')],
    { relatedFiles: ['Blueprints for Quiet, Horrifying Wealth.md', 'Cognitive Infiltration Blueprints.md'] }),
  makeNode('source-psyops', 'Personal Branding as Class War Psy-Ops', 'specimens', 'source-document', 'source', 'creative-work',
    'A deliberately simulated cultural critique; its own front matter labels the report simulated, so its claims are not treated as factual evidence.',
    ['specimen', 'mythography', 'creative-work'], [sourceRef('Personal Branding as Class War Psy-Ops.md', 'Simulation framing', 'REALITY STATUS: Simulated for ideological containment testing', 'front matter')],
    { relatedFiles: ['⚡ Unexpected Connections.md'] }),
  makeNode('source-money-blueprints', 'Blueprints for Quiet, Horrifying Wealth', 'specimens', 'source-document', 'source', 'source-document',
    'An offensive-grade specimen document. It is included as a source artifact and should be read under the repository’s use-policy and defence framing.',
    ['specimen', 'use-policy', 'defence'], [sourceRef('Blueprints for Quiet, Horrifying Wealth.md', 'First specimen', 'Obituary Crypto Seizure Funnel', 'opening example')],
    { relatedFiles: ['README.md', 'Social Engineering Email Templates .md'] }),
  makeNode('source-discography-csv', 'Discography CSV', 'signal-evidence', 'source-document', 'source', 'evidence-cluster',
    'A structured catalog used by the Case File; the provenance ledger counts 182 release-appearance rows and cautions that rows are not unique recordings.',
    ['catalog', 'structured-data', 'ISRC'], [sourceRef('Zazie_Productions_Discography.csv', 'Primary catalog', '', 'Structured CSV; row count is recorded in CLAIM_PROVENANCE_LEDGER.md', 'primary-artifact'), sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0004', '182 data rows under one header', 'ZP-CLM-0004 · statement', 'catalogue-summary')],
    { relatedFiles: ['Zazie_Productions_Complete_Discography.xlsx', '🔍 CASE FILE — Pattern Forensics.md'] }),
  makeNode('source-discography-workbook', 'Complete Discography Workbook', 'signal-evidence', 'source-document', 'source', 'evidence-cluster',
    'A six-sheet workbook whose README summary reports 200 tracks; the ledger explicitly says its apparent scope is not reconciled with the CSV.',
    ['catalog', 'structured-data', 'open-reconciliation'], [sourceRef('Zazie_Productions_Complete_Discography.xlsx', 'Primary catalog', '', 'Six-sheet XLSX; numerical scope is discussed in CLAIM_PROVENANCE_LEDGER.md', 'primary-artifact'), sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0005', 'The workbook and CSV use different apparent catalog scopes', 'ZP-CLM-0005 · heading', 'catalogue-summary')],
    { relatedFiles: ['Zazie_Productions_Discography.csv', 'README.md'] }),
  makeNode('source-media-master', 'Media Master', 'signal-evidence', 'source-document', 'source', 'evidence-cluster',
    'A public-web census summarized by the README as 133 verified URL-level records, with unverified leads held outside that total.',
    ['evidence', 'public-record', 'census'], [sourceRef('Zazie_Media_Master (1).pdf', 'Primary artifact', '', 'PDF census; README §03 gives its scope and count', 'primary-artifact'), README('§03 · The case study of self', '133 verified URL-level records', 'README.md §03 · media census summary', 'catalogue-summary')],
    { relatedFiles: ['🔍 CASE FILE — Pattern Forensics.md', 'README.md'] }),
  makeNode('source-signal-rot', 'Signal Rot Atlas Residency', 'mythography', 'source-document', 'source', 'creative-work',
    'A creative residency artifact that the source-authored Unexpected Connections links to administrative catalog evidence as a deliberate cross-stratum reading.',
    ['creative-work', 'signal-decay', 'music'], [sourceRef('ZazieKanwarTorge_ArtZoydResidency_SignalRotAtlas_2026.pdf', 'Primary artifact', '', 'Residency PDF; relationship is documented in Unexpected Connections §III and §V', 'primary-artifact'), sourceRef('⚡ Unexpected Connections.md', '§III · structural imagination', 'The residency makes decay the medium; the catalog wages administrative war against it.', '§III · residency/catalog connection', 'relationship-summary')],
    { relatedFiles: ['Zazie_Productions_Discography.csv'] }),
  makeNode('source-stewardship-receipt', 'Stewardship Receipt Console', 'stewardship', 'source-document', 'source', 'source-document',
    'A local receipt interface. The ledger distinguishes an editable self-report from tamper-evident or corroborated evidence.',
    ['stewardship', 'local-record', 'provenance'], [sourceRef('stewardship_receipt.html', 'Source implementation', '', 'HTML application; behavior is summarized in CLAIM_PROVENANCE_LEDGER.md ZP-CLM-0007', 'primary-artifact'), sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0007', 'stores user-authored receipt objects in browser `localStorage`', 'ZP-CLM-0007 · statement', 'software-summary')],
    { relatedFiles: ['CLAIM_PROVENANCE_LEDGER.md', 'META_ANALYSIS_OF_ZAZIOPATH.md'] }),
  makeNode('source-compendium', 'Shadow / Signal / Stewardship Compendium', 'shadow', 'source-document', 'source', 'source-document',
    'The README describes this 222-page compendium as the spine: shadow cosmology, adversarial selves, counter-archetypes, crosswalks, and protocols.',
    ['shadow', 'compendium', 'method'], [sourceRef('Zazie_Productions_Shadow_Signal_Stewardship_Mega_Compendium.pdf', 'Primary artifact', '', '222-page PDF; description is summarized in README §03', 'primary-artifact'), README('§03 · The core', '25 chapters + 3 appendices', 'README.md §03 · compendium summary', 'catalogue-summary')],
    { relatedFiles: ['Shadow Journal Observations .pdf', 'README.md'] }),
  makeNode('source-missing-variable', 'X — The Missing Variable', 'index-meta', 'source-document', 'source', 'source-document',
    'A report leaves an empty graph node in place because the archive does not contain a measurement that would justify naming it.',
    ['open-question', 'evidence', 'absence'], [sourceRef('👻 X — The Missing Variable.md', 'Report status', 'Status:** open, and staying open', 'report header')],
    { relatedFiles: ['🕸 Major Knowledge Graph.md', 'docs/ghost-x/verification.json'] }),
  makeNode('source-meta-experiment', 'meta-experiment', 'recursion-lab', 'source-document', 'source', 'source-document',
    'A recursive self-observation text that argues added reflective layers can move attention away from an initiating experience; the ledger marks this as the text’s argument, not a universal finding.',
    ['recursion', 'method-limit', 'interpretation'], [sourceRef('meta-experiment', 'Section 1', '', 'Plain-text artifact; referenced in CLAIM_PROVENANCE_LEDGER.md ZP-CLM-0003', 'primary-artifact'), sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0003', 'each added reflective layer may contain less direct contact with the initiating event', 'ZP-CLM-0003 · bounded summary', 'catalogue-summary')],
    { relatedFiles: ['🧠 CONTROLLED AMNESIA EXPERIMENTS.md', '🧨 COUNTER-ZAZIOPATH.md'] }),
];

const concepts = [
  makeNode('concept-shadow-signal-stewardship', 'Shadow / Signal / Stewardship', 'index-meta', 'concept', 'source', 'source-backed-concept',
    'The repository’s declared operating method: name what is present, test where it recurs, then ask what observable action follows. The source warns against treating interpretation itself as the endpoint.',
    ['method', 'cross-stratum', 'stewardship'], [README('§01 · The three-word spine', 'architecture, its method, and its ethics', 'README.md §01 · method statement')]),
  makeNode('concept-evidence-over-map', 'Evidence over map', 'index-meta', 'concept', 'source', 'source-backed-concept',
    'The README states a governing rule: when the diagram and the record disagree, the record takes precedence; an undated insight is not evidence.',
    ['provenance', 'evidence', 'governance'], [README('§00c · The complex — every wire, one map', 'Where the map and the record disagree, the record wins', 'README.md §00c · closing rule')]),
  makeNode('concept-strange-humane-architect', 'The Strange Humane Architect', 'stewardship', 'concept', 'source', 'source-backed-concept',
    'The compendium’s named endpoint: recognize systems without treating people as components, use strategy without counterfeiting consent, and leave others free to enter and leave.',
    ['stewardship', 'ethics', 'endpoint'], [README('§02 · The alchemy · endpoint', 'sees systems without treating people as components', 'README.md §02 · endpoint quotation')]),
  makeNode('concept-no-diagnosis', 'Archive, not diagnosis engine', 'identity', 'concept', 'source', 'source-backed-concept',
    'Zaziopath explicitly says it is not clinical and does not diagnose the subject; identity and typology material is framed as self-report and observation.',
    ['epistemic-boundary', 'identity', 'non-clinical'], [README('§00 · What this repository is not', 'not clinical. No document here diagnoses anyone, including the subject.', 'README.md §00 · boundary')]),
  makeNode('concept-shadow-profile', 'Shadow profile (self-report)', 'identity', 'concept', 'source', 'source-backed-concept',
    'A component of the identity material. Preserve it as a reported profile, not an independently established trait or clinical assessment.',
    ['identity', 'self-report', 'shadow'], [
      README('§03 · The core · identity card', 'The identity card. Typology, Big Five, shadow profile', 'README.md §03 · identity-vault catalogue summary', 'catalogue-summary'),
      sourceRef('Identity _ Typological Vault.pdf', 'Primary artifact', '', 'Identity card PDF; self-report boundary is stated in README §04', 'primary-artifact'),
    ]),
  makeNode('concept-money-scam-models', 'Money-scam models', 'specimens', 'concept', 'source', 'source-backed-concept',
    'A named specimen cluster. The README files these models under defence and self-recognition; the graph does not convert them into recommended tactics.',
    ['specimen', 'defence', 'use-policy'], [README('§12 · Use policy / red lines', 'It is filed for three purposes only.', 'README.md §12 · use-policy framing')]),
  makeNode('concept-armoured-performance', 'Armoured performance', 'shadow', 'concept', 'source', 'source-backed-concept',
    'A named source-graph pattern: insight can be recruited as rank or performance. This is the archive’s vocabulary, not a diagnosis.',
    ['shadow', 'pattern', 'persona'], [README('§00c · indexed wire 02', 'recruits insight as rank', 'README.md §00c · wire 02'), sourceRef('🕸 Major Knowledge Graph.md', 'Inner-system graph', 'Psychological System', 'Mermaid practice/psychology graph', 'related-source')]),
  makeNode('concept-shadow-engine', 'Shadow engine', 'shadow', 'concept', 'source', 'source-backed-concept',
    'The archive’s shadow-reading layer names patterns before pairing them with a counter-form or behavior.',
    ['shadow', 'method', 'pattern'], [README('§02 · the alchemy', 'put the self under the lens', 'README.md §02 · Nigredo stage')]),
  makeNode('concept-meta-level-addiction', 'Meta-level addiction', 'shadow', 'pattern', 'source', 'source-backed-concept',
    'A phrase in the Shadow Journal’s source-catalogue description and a numbered wire in the README; linked to the recursion staircase and a depth-three limit.',
    ['shadow', 'recursion', 'pattern'], [
      README('§03 · Shadow Journal catalogue summary', 'meta-level addiction', 'README.md §03 · journal summary', 'catalogue-summary'),
      sourceRef('Shadow Journal Observations .pdf', 'Primary artifact', '', '20-page PDF; the source repository names this pattern in its catalogue description', 'primary-artifact'),
    ]),
  makeNode('concept-recursion-staircase', 'Recursion staircase', 'recursion-lab', 'concept', 'source', 'source-backed-concept',
    'The recursion metaphor names successive layers of commentary. The source ledger cautions that this is an argument in a text, not a universal psychological law.',
    ['recursion', 'method-limit', 'meta-experiment'], [sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0003', 'each added reflective layer may contain less direct contact with the initiating event', 'ZP-CLM-0003 · summary'), sourceRef('meta-experiment', 'Section 1', '', 'Plain-text source artifact', 'primary-artifact')]),
  makeNode('concept-depth-three-limit', 'Depth-three safety cap', 'recursion-lab', 'concept', 'source', 'source-backed-concept',
    'A declared recursion protocol limit: the README’s cross-link describes a maximum depth of three without a break.',
    ['recursion', 'safety', 'protocol'], [sourceRef('⚡ Unexpected Connections.md', '§II · Same tool, two costumes', 'depth 3 maximum without a break', 'meta-experiment / README §06 cross-link')]),
  makeNode('concept-tuffy-bunnytown', 'Tuffy Bunnytown', 'identity', 'persona', 'source', 'source-backed-concept',
    'A named member of the repository’s internal cast; the wire register says this figure turns inner parts into holdable lore in the mythographic childhood.',
    ['persona', 'identity', 'mythography'], [README('§05 · internal cast', 'Tuffy Bunnytown', 'README.md §05 · internal cast')]),
  makeNode('concept-sovereign-anarchism', 'Sovereign anarchism', 'identity', 'concept', 'source', 'source-backed-concept',
    'The README’s summary of the Ideological Inversion Audit: decentralized authority socially, with strong authorship over the interior. This is an audit finding, not a diagnosis.',
    ['identity', 'politics', 'interpretation'], [README('§03 · core source inventory', 'sovereign anarchism', 'README.md §03 · inversion-audit summary', 'catalogue-summary')]),
  makeNode('concept-shadow-light-crosswalk', 'Shadow / light crosswalk', 'stewardship', 'concept', 'source', 'source-backed-concept',
    'The method pairs a named shadow pattern with a light counterpart and an executable behavioral pivot.',
    ['stewardship', 'crosswalk', 'behavior'], [README('§01 · three-word spine', 'Crosswalk to a light counterpart + a behavioural pivot.', 'README.md §01 · stewardship stage')]),
  makeNode('concept-four-by-three-modules', '4 × 3 album modules', 'mythography', 'creative-work', 'source', 'source-backed-concept',
    'A twelve-track structure with four variants per track: Primary Mix, Negative Mirror Mix, Dissolution Edit, and Ritual Stem Suite.',
    ['creative-work', 'music', 'crosswalk'], [sourceRef('ALBUM STRUCTURE - 4×3 FRACTAL MODULES.md', 'Variant structure', '1 Primary Mix', 'track-variant list')]),
  makeNode('concept-twelve-questions', 'Twelve self-audit questions', 'stewardship', 'concept', 'source', 'source-backed-concept',
    'A set of twelve questions in the README intended to be run before sending, signing, apologizing, or posting; the questions are prompts, not validated tests.',
    ['stewardship', 'protocol', 'self-audit'], [README('§08 · The twelve self-audit questions', 'These are the vault’s executable code', 'README.md §08 · introduction')]),
  makeNode('concept-ten-money-scams', 'Ten money scams', 'shadow', 'concept', 'source', 'source-backed-concept',
    'A named chapter-level cluster in the README’s indexed wires; the relationship to specimen templates is preserved as a documented cross-stratum wire.',
    ['shadow', 'specimen', 'cross-stratum'], [README('§00c · indexed wire 09', 'Ten money scams', 'README.md §00c · wire 09')]),
  makeNode('concept-z-related-composition', 'Z-related composition', 'mythography', 'concept', 'source', 'source-backed-concept',
    'The source-authored connection compares musical material held constant and permuted with the alternate selves in Recursive Identity Castles.',
    ['mythography', 'music-theory', 'creative-work'], [sourceRef('⚡ Unexpected Connections.md', '§III · structural imagination', 'Z-related aggregate', '§III · Hypostasis / aggregate link')]),
  makeNode('concept-decay-studies', 'Decay studies', 'mythography', 'concept', 'source', 'source-backed-concept',
    'A source graph label for creative work that aestheticizes entropy and a separate administrative record-keeping response; the wire does not assert a psychological cause.',
    ['mythography', 'signal-decay', 'evidence'], [README('§00c · indexed wires 11–12', 'aestheticizes entropy as the medium', 'README.md §00c · wire 11')]),
  makeNode('concept-catalog-evidence', 'Catalog evidence', 'signal-evidence', 'evidence-cluster', 'source', 'source-backed-concept',
    'Structured catalog and public-record artifacts are treated as evidence with defined scope; row counts, track counts, and unique recordings are not interchangeable.',
    ['evidence', 'catalog', 'scope'], [sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0004 to ZP-CLM-0006', 'A row is not necessarily a unique recording', 'ZP-CLM-0004 · limitation')]),
  makeNode('concept-myth-workshop', 'Myth workshop', 'mythography', 'concept', 'source', 'source-backed-concept',
    'A source-graph term for the mythographic creative practice; the README wire records it as fuel for an AI tribunal, not as evidence about a person.',
    ['mythography', 'creative-work', 'recursion'], [README('§00c · indexed wire 15', 'Myth workshop', 'README.md §00c · wire 15')]),
  makeNode('concept-ai-tribunal', 'AI tribunal', 'recursion-lab', 'concept', 'source', 'source-backed-concept',
    'A label for commissioned AI readings in the recursive archive. The meta-analysis warns that sequential verdicts do not amount to independent observers.',
    ['recursion', 'AI', 'provenance'], [sourceRef('META_ANALYSIS_OF_ZAZIOPATH.md', 'Evidence status', 'six stages of one recursive analytic sequence', 'Evidence Status · independence limit')]),
  makeNode('concept-evidence-bench', 'Evidence bench', 'signal-evidence', 'concept', 'source', 'source-backed-concept',
    'The source graph’s label for replacing self-claims with counts before a claim is carried toward stewardship.',
    ['evidence', 'verification', 'stewardship'], [README('§00c · indexed wire 17', 'replaces self-claims with counts', 'README.md §00c · wire 17')]),
  makeNode('concept-tuesday-self', 'The Tuesday self', 'stewardship', 'concept', 'source', 'source-backed-concept',
    'A source-authored shorthand for observable everyday behavior as the endpoint of the archive’s method; the repo says this endpoint is not established merely by interpretation.',
    ['stewardship', 'behavior', 'open-evidence'], [README('§00c · indexed wire 17', 'The Tuesday self', 'README.md §00c · wire 17')]),
  makeNode('concept-gpt-77t', 'GPT 7.7-t mutual surveillance', 'recursion-lab', 'concept', 'source', 'source-backed-concept',
    'A fictional model-surveillance artifact: a model surveils the user who is surveilling it. The Unexpected Connections note compares it to the separate memory export while preserving their different genres.',
    ['recursion', 'fiction', 'machine-memory'], [README('§03 · recursive AI experiments', 'A simulated internal log of a model surveilling the user who is surveilling it.', 'README.md §03 · source inventory', 'catalogue-summary'), sourceRef('GPT Model 7.7-t Surveillance Subroutine.pdf', 'Primary artifact', '', '9-page PDF, described in README §03', 'primary-artifact')]),
  makeNode('concept-collective-fiction-claim', '“Collective fiction” scenario', 'mythography', 'creative-work', 'source', 'source-backed-concept',
    'A fictional tribunal’s claim inside Recursive Identity Castles; it is a narrative premise, not a factual assertion about the artist or business.',
    ['mythography', 'fiction', 'claim-boundary'], [sourceRef('RECURSIVE IDENTITY CASTLES.md', 'Opening scenario', 'It believes “Zazie Productions” was a collective fiction.', 'opening scenario')]),
  makeNode('concept-catalog-workbook-count', 'Workbook: 200 tracks', 'signal-evidence', 'evidence-cluster', 'source', 'source-backed-concept',
    'The README reports 200 tracks for the workbook’s scope. The provenance ledger leaves that scope unreconciled with the 182-row CSV.',
    ['evidence', 'catalog', 'count'], [README('§03 · discography workbook summary', '200 tracks', 'README.md §03 · workbook summary', 'catalogue-summary')]),
  makeNode('concept-catalog-csv-count', 'CSV: 182 release-appearance rows', 'signal-evidence', 'evidence-cluster', 'source', 'source-backed-concept',
    'The provenance ledger records 182 parsed CSV data rows and cautions that a row is not a unique recording.',
    ['evidence', 'catalog', 'count'], [sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0004', '182 data rows under one header', 'ZP-CLM-0004 · statement')]),
  makeNode('concept-sequential-verdicts', 'Sequential verdicts, not independent votes', 'recursion-lab', 'concept', 'inference', 'source-authored-inference',
    'The meta-analysis and provenance ledger treat the six verdicts as a sequential, mutually referential series, not six independent confirmations.',
    ['recursion', 'independence', 'inference'], [sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0010', 'six verdict files form a sequential, mutually referential commission series', 'ZP-CLM-0010 · statement'), sourceRef('META_ANALYSIS_OF_ZAZIOPATH.md', 'Evidence status', 'not six demonstrably independent observers', 'Evidence Status')],
    { provenanceNote: 'A source-backed process interpretation; it is not a claim that every later document adds no new material.' }),
  makeNode('concept-ai-suggestion-loop', 'AI suggestion loop', 'recursion-lab', 'concept', 'inference', 'source-authored-inference',
    'Counter-Zaziopath argues that recursive AI readings can amplify a prompt’s framing. Its own reflexivity clause identifies the review as an instance of the loop.',
    ['recursion', 'AI', 'inference'], [sourceRef('🧨 COUNTER-ZAZIOPATH.md', '§1 · reflexivity clause', 'This file is an instance of CZ-02.', 'reflexivity clause')],
    { provenanceNote: 'The criticism is explicitly marked as an adversarial interpretation in its source.' }),
  makeNode('concept-prestige-risk', 'Self-knowledge as prestige technology', 'shadow', 'concept', 'inference', 'source-authored-inference',
    'One of Counter-Zaziopath’s objections: self-analysis may function as status or performance. This remains a critique of an apparatus, not a finding about motive.',
    ['shadow', 'critique', 'inference'], [sourceRef('🧨 COUNTER-ZAZIOPATH.md', '§2 · objection CZ-06', '“Self-knowledge” may itself be a prestige technology.', 'CZ-06 · claim')],
    { provenanceNote: 'Adversarial hypothesis from the source; not promoted to source fact or personality diagnosis.' }),
  makeNode('concept-ablation-dependency', 'Ablation measures archive dependency', 'recursion-lab', 'experiment', 'source', 'source-backed-concept',
    'Controlled Amnesia removes one information category at a time and compares reconstructions. Its stated object is the archive’s claim support, not the person.',
    ['experiment', 'ablation', 'method'], [sourceRef('🧠 CONTROLLED AMNESIA EXPERIMENTS.md', '§1 · method', 'The person is not being ablated; the paper trail is.', '§1.1 · method boundary')]),
  makeNode('concept-strata-overlap', 'Strata overlap in the files', 'index-meta', 'experiment', 'source', 'source-backed-concept',
    'Controlled Amnesia reports that some files belong to more than one ablation category and others fit none; the color-coded strata are a useful map, not a claim that every artifact has one exclusive home.',
    ['strata', 'method', 'limitation'], [sourceRef('🧠 CONTROLLED AMNESIA EXPERIMENTS.md', '§1.5 · classification problem', 'The eight categories are not orthogonal, and the corpus says so itself.', '§1.5 · classification boundary')]),
  makeNode('concept-collider-result', 'Cross-stratum experiment: 3 HOLD / 9 SNAP / 1 NO-BEAM', 'recursion-lab', 'experiment', 'source', 'source-backed-concept',
    'The Particle Collider records its outcomes per beam and treats failed and unbuildable tests as part of the result; it does not turn every surprising match into evidence.',
    ['experiment', 'null-results', 'cross-stratum'], [sourceRef('⚛️ PARTICLE COLLIDER — Cross-Stratum Experiments.md', '§0 · verdicts', '3 HOLD · 9 SNAP · 1 NO-BEAM', 'report header · tally')]),
  makeNode('concept-after-silence-notarize', '“After silence, notarize”', 'signal-evidence', 'pattern', 'inference', 'source-authored-inference',
    'Pattern Forensics proposes this phrase as an interpretation of the sequence between low catalog output and later record-making. The source labels the reading as inference, not a direct fact about motive.',
    ['pattern', 'catalog', 'inference'], [sourceRef('🔍 CASE FILE — Pattern Forensics.md', 'F-05 · The Quiet Year and the Audit Reflex', 'after silence, notarize', 'F-05 · inference')],
    { provenanceNote: 'The source itself marks the connection as an inference; it should not be restated as a psychological fact.' }),
  makeNode('concept-stewardship-mass-ratio', 'Analysis / stewardship mass ratio (~750:1)', 'signal-evidence', 'pattern', 'inference', 'source-authored-inference',
    'Pattern Forensics reports a roughly 750:1 ratio by byte count between diagnosis-oriented and standalone stewardship material, while noting the count misses stewardship chapters inside the compendium.',
    ['pattern', 'stewardship', 'measurement-limit'], [sourceRef('🔍 CASE FILE — Pattern Forensics.md', 'F-09 · The Vault Measures More Than It Steers', 'Diagnosis outweighs treatment roughly **750 : 1** by byte count.', 'F-09 · finding and limitation')],
    { provenanceNote: 'This is a file-mass statistic with an explicit scope limitation, not a measure of behavior or human worth.' }),
  makeNode('concept-receipt-is-self-report', 'Receipt is a mutable self-report', 'stewardship', 'concept', 'source', 'source-backed-concept',
    'The claim ledger distinguishes a locally stored, editable receipt from tamper-evident or independently corroborated evidence.',
    ['stewardship', 'provenance', 'local-record'], [sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'C-03 · Evidence-backed endpoint versus mutable receipt', 'Distinguish reflective receipt from tamper-evident or corroborated evidence.', 'C-03 · resolution')]),
  makeNode('concept-chain-of-custody', 'Chain of custody for meaning', 'index-meta', 'concept', 'source', 'source-backed-concept',
    'The Evidence Governance Handbook requires source version, source type, transformation, responsible actor, independence, alternatives, verification, and correction state.',
    ['provenance', 'governance', 'claim-level'], [sourceRef('EVIDENCE_GOVERNANCE_HANDBOOK.md', '§1 · Governing Principle', 'the chain of custody of meaning', '§1 · governing principle')]),
  makeNode('concept-missing-variable', 'X — the unnamed variable', 'index-meta', 'question', 'open-question', 'open-question',
    'The repository keeps a blank node for an unmeasured variable. Its report states that naming it would require evidence the current archive does not contain.',
    ['open-question', 'absence', 'evidence-boundary'], [sourceRef('👻 X — The Missing Variable.md', 'Report status', 'Status:** open, and staying open', 'report header'), sourceRef('🕸 Major Knowledge Graph.md', 'Ghost layer', 'The node is empty on purpose: a name would require a measurement this repository does not contain.', 'opening description')]),
  makeNode('concept-arrangement-ethics', 'Curation, authorship, and consent', 'mythography', 'question', 'open-question', 'open-question',
    'Unexpected Connections leaves open when arranging other people’s material becomes authorship, including the relationship between curation and non-consensual AI training.',
    ['open-question', 'ethics', 'creative-work'], [sourceRef('⚡ Unexpected Connections.md', '§VII · The arrangement ethics', 'The vault does not resolve this triangle.', '§VII · closing statement')]),
  makeNode('concept-tender-horror', 'Tender-horror braid', 'mythography', 'creative-work', 'inference', 'source-authored-inference',
    'Unexpected Connections reads Mythographic Childhood, the parts cast, and psychological horror as a shared creative braid. This is a source-authored interpretation of works.',
    ['mythography', 'creative-work', 'interpretation'], [sourceRef('⚡ Unexpected Connections.md', '§VI · The tender-horror braid', 'The mythographic childhood', '§VI · opening connection')]),
  makeNode('concept-strata-method', 'Eight strata, one living archive', 'index-meta', 'concept', 'source', 'source-backed-concept',
    'The README assigns eight named strata distinct colors and glyphs while warning that the archives cross-reference one another and files can span categories.',
    ['strata', 'index', 'architecture'], [README('§00a · color code', 'Every stratum of the vault owns one colour, one glyph, and one name', 'README.md §00a · palette rule')]),
  makeNode('question-catalog-scope', 'What is the catalog denominator?', 'signal-evidence', 'question', 'open-question', 'open-question',
    'The workbook’s 200-track report and the CSV’s 182 release-appearance rows have different apparent scopes. The ledger says the relationship remains unreconciled.',
    ['open-question', 'evidence', 'catalog'], [sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'C-01 — 200 versus 182', 'Status:** Unresolved, not yet a contradiction.', 'C-01 · status')]),
  makeNode('question-motive-vs-workflow', 'ISRC registration: motive or workflow?', 'signal-evidence', 'question', 'open-question', 'open-question',
    'Counter-Zaziopath leaves open why some older releases received 2022 ISRCs; the proposed resolution is distributor and Bandcamp source records, not a psychological inference.',
    ['open-question', 'catalog', 'provenance'], [sourceRef('🧨 COUNTER-ZAZIOPATH.md', '§6 · unresolved ledger U-01', 'F-01: motive vs workflow', 'U-01 · open question')]),
  makeNode('question-nonprimed-model', 'Would a non-primed model reproduce the findings?', 'recursion-lab', 'question', 'open-question', 'open-question',
    'Counter-Zaziopath lists a blind, non-primed run as a missing test. No result is stored in the committed source cited here.',
    ['open-question', 'AI', 'method'], [sourceRef('🧨 COUNTER-ZAZIOPATH.md', '§6 · unresolved ledger U-03', 'Does a non-primed model reproduce the Case File’s findings?', 'U-03 · open question')]),
  makeNode('question-behavior-endpoint', 'Does interpretation change observable behavior?', 'stewardship', 'question', 'open-question', 'open-question',
    'The meta-analysis says a privacy-preserving, dated record could test whether a specific insight connects to an observable decision; the repository does not claim the answer is known.',
    ['open-question', 'stewardship', 'evidence'], [sourceRef('META_ANALYSIS_OF_ZAZIOPATH.md', 'What remains unknown', 'Whether behavior outside the repository changed after any audit.', 'unknowns list')]),
  makeNode('question-typology-prediction', 'Do typology labels predict anything?', 'identity', 'question', 'open-question', 'open-question',
    'Counter-Zaziopath records the lack of a test-retest or dated prediction check as unresolved; no diagnosis or trait verdict is inferred.',
    ['open-question', 'identity', 'method'], [sourceRef('🧨 COUNTER-ZAZIOPATH.md', '§6 · unresolved ledger U-09', 'Do typology labels predict anything?', 'U-09 · open question')]),
];

const fragmentDefinitions = [
  { id: 'fragment-three-word-spine', title: 'The three-word spine', stratum: 'index-meta', epistemic: 'source', tags: ['method', 'shadow', 'signal', 'stewardship'], anchor: README('§01 · The three-word spine', 'architecture, its method, and its ethics', 'README.md §01'), relatedNodeIds: ['concept-shadow-signal-stewardship', 'stratum-shadow', 'stratum-signal-evidence', 'stratum-stewardship'] },
  { id: 'fragment-map-record-rule', title: 'Where the map and record disagree', stratum: 'index-meta', epistemic: 'source', tags: ['evidence', 'provenance', 'method'], anchor: README('§00c · indexed wires and rule', 'Where the map and the record disagree, the record wins', 'README.md §00c'), relatedNodeIds: ['concept-evidence-over-map', 'source-major-graph', 'source-pattern-forensics'] },
  { id: 'fragment-depth-three-cap', title: 'Depth three, then break', stratum: 'recursion-lab', epistemic: 'source', tags: ['recursion', 'protocol', 'safety'], anchor: sourceRef('⚡ Unexpected Connections.md', '§II · same tool, two costumes', 'depth 3 maximum without a break', 'meta-experiment / README §06 cross-link'), relatedNodeIds: ['concept-depth-three-limit', 'concept-meta-level-addiction', 'concept-recursion-staircase'] },
  { id: 'fragment-ablation-boundary', title: 'The paper trail, not the person', stratum: 'recursion-lab', epistemic: 'source', tags: ['ablation', 'method', 'boundary'], anchor: sourceRef('🧠 CONTROLLED AMNESIA EXPERIMENTS.md', '§1.1 · method boundary', 'The person is not being ablated; the paper trail is.', '§1.1'), relatedNodeIds: ['source-controlled-amnesia', 'concept-ablation-dependency', 'concept-no-diagnosis'] },
  { id: 'fragment-independent-verdicts', title: 'Repetition is not independence', stratum: 'index-meta', epistemic: 'source', tags: ['AI', 'provenance', 'independence'], anchor: sourceRef('META_ANALYSIS_OF_ZAZIOPATH.md', 'Evidence status', 'not six demonstrably independent observers', 'Evidence Status'), relatedNodeIds: ['source-meta-analysis', 'concept-sequential-verdicts', 'concept-ai-suggestion-loop'] },
  { id: 'fragment-counter-reflexivity', title: 'A critique inside the loop', stratum: 'index-meta', epistemic: 'source', tags: ['counter-reading', 'recursion', 'inference'], anchor: sourceRef('🧨 COUNTER-ZAZIOPATH.md', '§1 · reflexivity clause', 'This file is an instance of CZ-02.', 'reflexivity clause'), relatedNodeIds: ['source-counter-zaziopath', 'concept-ai-suggestion-loop', 'concept-sequential-verdicts'] },
  { id: 'fragment-catalog-scope', title: '200 workbook tracks / 182 CSV rows', stratum: 'signal-evidence', epistemic: 'open-question', tags: ['catalog', 'scope', 'open-question'], anchor: sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'C-01 — 200 versus 182', 'Status:** Unresolved, not yet a contradiction.', 'C-01 · status'), relatedNodeIds: ['concept-catalog-workbook-count', 'concept-catalog-csv-count', 'question-catalog-scope'] },
  { id: 'fragment-after-silence', title: '“After silence, notarize”', stratum: 'signal-evidence', epistemic: 'inference', tags: ['pattern', 'catalog', 'inference'], anchor: sourceRef('🔍 CASE FILE — Pattern Forensics.md', 'F-05 · quiet year', 'after silence, notarize', 'F-05 · inference'), relatedNodeIds: ['source-pattern-forensics', 'concept-after-silence-notarize', 'source-discography-csv'] },
  { id: 'fragment-strange-humane', title: 'The Strange Humane Architect', stratum: 'stewardship', epistemic: 'source', tags: ['stewardship', 'ethics', 'endpoint'], anchor: README('§02 · the alchemy · endpoint quotation', 'sees systems without treating people as components', 'README.md §02'), relatedNodeIds: ['concept-strange-humane-architect', 'concept-shadow-light-crosswalk', 'concept-twelve-questions'] },
  { id: 'fragment-identity-self-report', title: 'Identity material: self-report, not diagnosis', stratum: 'identity', epistemic: 'source', tags: ['identity', 'self-report', 'boundary'], anchor: README('§04 · The subject', 'Drawn from `Identity _ Typological Vault.pdf` and the memory export. Filed as\nself-report and observation, not as diagnosis.', 'README.md §04'), relatedNodeIds: ['source-identity-vault', 'source-memory-export', 'concept-no-diagnosis', 'concept-shadow-profile'] },
  { id: 'fragment-mythographic-childhood', title: 'Museum, thunderstorm, and invented memory', stratum: 'mythography', epistemic: 'source', tags: ['mythography', 'fiction', 'creative-work'], anchor: sourceRef('Mythographic Childhood.md', 'Opening narrative', 'I was born in a museum, during a thunderstorm', 'opening passage'), relatedNodeIds: ['source-mythographic-childhood', 'concept-tuffy-bunnytown', 'concept-tender-horror'] },
  { id: 'fragment-specimen-boundary', title: 'Specimens are not a toolkit', stratum: 'specimens', epistemic: 'source', tags: ['specimen', 'defence', 'ethics'], anchor: README('§12 · use policy / red lines', 'They are not a send-this file.', 'README.md §12 · specimen boundary'), relatedNodeIds: ['concept-money-scam-models', 'source-social-engineering', 'source-cognitive-infiltration'] },
  { id: 'fragment-missing-variable', title: 'The empty node stays empty', stratum: 'index-meta', epistemic: 'open-question', tags: ['open-question', 'evidence', 'unknown'], anchor: sourceRef('🕸 Major Knowledge Graph.md', 'Ghost layer', 'The node is empty on purpose: a name would require a measurement this repository does not contain.', 'ghost-node description'), relatedNodeIds: ['source-missing-variable', 'concept-missing-variable', 'concept-evidence-over-map'] },
  { id: 'fragment-local-receipt', title: 'A receipt is not corroboration', stratum: 'stewardship', epistemic: 'source', tags: ['stewardship', 'provenance', 'local-record'], anchor: sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'C-03 · receipt boundary', 'Distinguish reflective receipt from tamper-evident or corroborated evidence.', 'C-03 · resolution'), relatedNodeIds: ['source-stewardship-receipt', 'concept-receipt-is-self-report', 'question-behavior-endpoint'] },
  { id: 'fragment-evidence-governance', title: 'Chain of custody for meaning', stratum: 'index-meta', epistemic: 'source', tags: ['provenance', 'governance', 'claim-level'], anchor: sourceRef('EVIDENCE_GOVERNANCE_HANDBOOK.md', '§1 · Governing Principle', 'the chain of custody of meaning', '§1'), relatedNodeIds: ['source-claim-ledger', 'concept-chain-of-custody', 'concept-evidence-over-map'] },
];

const makeEdge = (id, source, target, type, label, epistemic, refs, extra = {}) => ({
  id, source, target, type, label, epistemic,
  provenance: {
    category: epistemic === 'source' ? 'source-backed-relationship' : `${epistemic}-relationship`,
    sourceRefs: refs,
    note: extra.note || '',
  },
});

const edges = [];
for (const doc of sourceNodes) {
  edges.push(makeEdge(
    `contains-${doc.id}`, `stratum-${doc.stratum}`, doc.id, 'contains', 'source artifact filed in this stratum', 'source',
    doc.sources.filter(ref => ref.path.endsWith('.md') || ref.path === 'README.md').slice(0, 1),
  ));
}
for (const concept of concepts) {
  const sourceDocsByPath = {
    'README.md': 'source-readme',
    '🕸 Major Knowledge Graph.md': 'source-major-graph',
    '⚡ Unexpected Connections.md': 'source-unexpected-connections',
    '⚛️ PARTICLE COLLIDER — Cross-Stratum Experiments.md': 'source-particle-collider',
    '🧨 COUNTER-ZAZIOPATH.md': 'source-counter-zaziopath',
    '🧠 CONTROLLED AMNESIA EXPERIMENTS.md': 'source-controlled-amnesia',
    '🔍 CASE FILE — Pattern Forensics.md': 'source-pattern-forensics',
    'CLAIM_PROVENANCE_LEDGER.md': 'source-claim-ledger',
    'EVIDENCE_GOVERNANCE_HANDBOOK.md': 'source-evidence-governance',
    'META_ANALYSIS_OF_ZAZIOPATH.md': 'source-meta-analysis',
    'ZAZIOPATH — Collected Readings (2026-09-23).md': 'source-collected-readings',
    'Shadow Journal Observations .pdf': 'source-shadow-journal',
    'Identity _ Typological Vault.pdf': 'source-identity-vault',
    'JSON file re-export ChatGPT Memory .md': 'source-memory-export',
    'RECURSIVE IDENTITY CASTLES.md': 'source-identity-castles',
    'Mythographic Childhood.md': 'source-mythographic-childhood',
    'Twelve-Lung Grammar of the Forgotten Species.md': 'source-twelve-lung',
    'Sovereign Interface Protocol (The Matrix).md': 'source-matrix-protocol',
    'ALBUM STRUCTURE - 4×3 FRACTAL MODULES.md': 'source-four-by-three',
    'Cognitive Infiltration Blueprints.md': 'source-cognitive-infiltration',
    'Social Engineering Email Templates .md': 'source-social-engineering',
    'Personal Branding as Class War Psy-Ops.md': 'source-psyops',
    'Blueprints for Quiet, Horrifying Wealth.md': 'source-money-blueprints',
    'Zazie_Productions_Discography.csv': 'source-discography-csv',
    'Zazie_Productions_Complete_Discography.xlsx': 'source-discography-workbook',
    'Zazie_Media_Master (1).pdf': 'source-media-master',
    'ZazieKanwarTorge_ArtZoydResidency_SignalRotAtlas_2026.pdf': 'source-signal-rot',
    'stewardship_receipt.html': 'source-stewardship-receipt',
    'Zazie_Productions_Shadow_Signal_Stewardship_Mega_Compendium.pdf': 'source-compendium',
    '👻 X — The Missing Variable.md': 'source-missing-variable',
    'meta-experiment': 'source-meta-experiment',
  };
  for (const ref of concept.sources) {
    const target = sourceDocsByPath[ref.path];
    if (!target || edges.some(e => e.source === concept.id && e.target === target && e.type === 'derived-from')) continue;
    // Some primary artefacts are PDFs/binaries that are identified but not bundled as
    // searchable text. In that case cite the README catalogue or claim ledger that
    // names the artefact, and label the edge as a catalogue reference rather than
    // pretending we have a direct excerpt from the binary.
    const evidenceRef = ref.anchor ? ref : concept.sources.find(candidate => candidate.anchor && candidate.role === 'catalogue-summary')
      || concept.sources.find(candidate => candidate.anchor);
    if (!evidenceRef?.anchor) throw new Error(`No excerpted provenance for ${concept.id} → ${target}`);
    const label = ref.anchor ? 'provenance in source artifact' : 'catalogue reference to source artifact';
    edges.push(makeEdge(`derived-${concept.id}-${target}`, concept.id, target, 'derived-from', label, 'source', [evidenceRef]));
  }
}

const wireRows = [
  ['wire-01', 'concept-shadow-profile', 'concept-money-scam-models', 'cross-stratum-link', 'defines the exact attack surface', '| 01 | ◉ Shadow profile | defines the exact attack surface | ◐ Money-scam models |'],
  ['wire-02', 'concept-armoured-performance', 'concept-shadow-engine', 'interprets', 'recruits insight as rank', '| 02 | ◉ Armoured performance | recruits insight as rank | ◐ Shadow engine |'],
  ['wire-03', 'concept-meta-level-addiction', 'concept-recursion-staircase', 'responds-to', 'meets the depth-three safety cap', '| 03 | ◉ Meta-level addiction | meets the depth-three safety cap | ∞ Recursion staircase |'],
  ['wire-04', 'concept-tuffy-bunnytown', 'source-mythographic-childhood', 'transforms-into', 'turns inner parts into holdable lore', '| 04 | ◉ Tuffy Bunnytown | turns inner parts into holdable lore | ☾ Mythographic childhood |'],
  ['wire-05', 'concept-sovereign-anarchism', 'source-matrix-protocol', 'interprets', 'dramatizes the inversion finding', '| 05 | ◉ Sovereign anarchism | dramatizes the inversion finding | ☾ Matrix protocol |'],
  ['wire-06', 'concept-shadow-light-crosswalk', 'concept-four-by-three-modules', 'transforms-into', 'reappears as production structure', '| 06 | △ Shadow/light crosswalk | reappears as production structure | ◇ 4 × 3 album modules |'],
  ['wire-07', 'concept-shadow-light-crosswalk', 'concept-twelve-questions', 'responds-to', 'turns pivots into executable code', '| 07 | △ Shadow/light crosswalk | turns pivots into executable code | △ Twelve questions |'],
  ['wire-08', 'concept-shadow-engine', 'source-cognitive-infiltration', 'transforms-into', 'turns quiet rhetorics outward as tools', '| 08 | ◐ Shadow engine | turns quiet rhetorics outward as tools | ⚠ Cognitive Infiltration |'],
  ['wire-09', 'concept-ten-money-scams', 'source-social-engineering', 'appears-in', 'reappears annotated and under glass', '| 09 | ◐ Ten money scams | reappears annotated and under glass | ⚠ Social-engineering templates |'],
  ['wire-10', 'concept-z-related-composition', 'source-identity-castles', 'transforms-into', 'permutes identical material into new selves', '| 10 | ◇ Z-related composition | permutes identical material into new selves | ☾ Identity Castles |'],
  ['wire-11', 'concept-decay-studies', 'source-signal-rot', 'transforms-into', 'aestheticizes entropy as the medium', '| 11 | ◇ Decay studies | aestheticizes entropy as the medium | ☾ Signal Rot Atlas |'],
  ['wire-12', 'concept-decay-studies', 'source-discography-csv', 'responds-to', 'fights entropy with administration', '| 12 | ◇ Decay studies | fights entropy with administration | ▤ ISRC catalog |'],
  ['wire-13', 'source-social-engineering', 'source-psyops', 'cross-stratum-link', 'uses the same craft, aimed outward', '| 13 | ⚠ Social-engineering templates | uses the same craft, aimed outward | ☾ Branding Psy-Ops |'],
  ['wire-14', 'source-identity-castles', 'concept-catalog-evidence', 'evidence-against', 'is statistically refuted by identifiers', '| 14 | ☾ Identity Castles | is statistically refuted by identifiers | ▤ Catalog evidence |'],
  ['wire-15', 'concept-myth-workshop', 'concept-ai-tribunal', 'responds-to', 'fuels the tribunal that reads it back', '| 15 | ☾ Myth workshop | fuels the tribunal that reads it back | ∞ AI tribunal |'],
  ['wire-16', 'concept-gpt-77t', 'source-memory-export', 'related-to', 'holds machine memory in two directions', '| 16 | ∞ GPT 7.7-t | holds machine memory in two directions | ∞ Memory export |'],
  ['wire-17', 'concept-evidence-bench', 'concept-tuesday-self', 'evidence-for', 'replaces self-claims with counts', '| 17 | ▤ Evidence bench | replaces self-claims with counts | △ The Tuesday self |'],
];
for (const [id, source, target, type, label, anchor] of wireRows) {
  edges.push(makeEdge(id, source, target, type, label, 'source', [README(`§00c · indexed wire ${id.slice(-2)}`, anchor, `README.md §00c · ${id}`)]));
}

const authoredRelationships = [
  ['method-shadow-to-signal', 'stratum-shadow', 'stratum-signal-evidence', 'transforms-into', 'pattern-matching asks where a shadow recurs', README('§01 · three-word spine', 'Pattern-matching across domains', 'README.md §01 · Signal stage')],
  ['method-signal-to-stewardship', 'stratum-signal-evidence', 'stratum-stewardship', 'transforms-into', 'replace claims with a behavioral pivot', README('§02 · the alchemy', 'replace claims with counts', 'README.md §02 · Citrinitas → Rubedo')],
  ['method-stewardship-feedback', 'stratum-stewardship', 'stratum-shadow', 'recurs-in', 'the next pattern surfaces', README('§02 · the alchemy', 'the next pattern surfaces', 'README.md §02 · feedback loop')],
  ['scope-workbook-csv', 'concept-catalog-workbook-count', 'concept-catalog-csv-count', 'unresolved-with', 'apparent counts; scope is not reconciled', sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'C-01 — 200 versus 182', 'Different scope.', 'C-01 · leading explanation')],
  ['independence-claim-vs-record', 'concept-ai-tribunal', 'concept-sequential-verdicts', 'qualifies', 'sequential outputs are not independent votes', sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'ZP-CLM-0010', 'six verdict files form a sequential, mutually referential commission series', 'ZP-CLM-0010 · statement')],
  ['receipt-limit', 'source-stewardship-receipt', 'concept-receipt-is-self-report', 'qualifies', 'editable receipt is not corroboration', sourceRef('CLAIM_PROVENANCE_LEDGER.md', 'C-03 · receipt boundary', 'Distinguish reflective receipt from tamper-evident or corroborated evidence.', 'C-03 · resolution')],
  ['ablation-to-overlap', 'concept-ablation-dependency', 'concept-strata-overlap', 'evidence-for', 'ablation reports overlapping strata', sourceRef('🧠 CONTROLLED AMNESIA EXPERIMENTS.md', '§1.5 · classification problem', 'The eight categories are not orthogonal, and the corpus says so itself.', '§1.5')],
  ['pattern-forensics-to-inference', 'source-pattern-forensics', 'concept-after-silence-notarize', 'interprets', 'F-05 is explicitly labeled an inference', sourceRef('🔍 CASE FILE — Pattern Forensics.md', 'F-05 · The Quiet Year and the Audit Reflex', 'after silence, notarize', 'F-05 · inference')],
  ['pattern-mass-inference', 'source-pattern-forensics', 'concept-stewardship-mass-ratio', 'interprets', 'F-09 reports a scoped byte-count comparison', sourceRef('🔍 CASE FILE — Pattern Forensics.md', 'F-09 · The Vault Measures More Than It Steers', 'Diagnosis outweighs treatment roughly **750 : 1** by byte count.', 'F-09 · finding')],
  ['counter-loop-critique', 'source-counter-zaziopath', 'concept-ai-suggestion-loop', 'interprets', 'the hostile review names AI suggestion amplification', sourceRef('🧨 COUNTER-ZAZIOPATH.md', 'CZ-02 · AI recursion amplifies suggestion', 'AI recursion amplifies suggestion.', 'CZ-02 · heading')],
  ['evidence-myth-relationship', 'source-identity-castles', 'source-discography-workbook', 'evidence-against', 'the source-authored reading presents catalog records as a refutation of the fictional scenario', sourceRef('⚡ Unexpected Connections.md', '§I · The evidence answers the myth', 'the discography', '§I · identity-castles / catalog connection')],
  ['ghost-open-question', 'source-major-graph', 'concept-missing-variable', 'unresolved-with', 'the graph keeps an unmeasured variable blank', sourceRef('🕸 Major Knowledge Graph.md', 'Ghost layer', 'The node is empty on purpose: a name would require a measurement this repository does not contain.', 'ghost-node description')],
  ['stewardship-endpoint-open', 'concept-shadow-signal-stewardship', 'question-behavior-endpoint', 'unresolved-with', 'the archive names behavior as an endpoint; the committed evidence does not settle whether insight changed behavior', sourceRef('META_ANALYSIS_OF_ZAZIOPATH.md', 'What remains unknown', 'Whether behavior outside the repository changed after any audit.', 'unknowns list')],
  ['arrangement-question', 'source-unexpected-connections', 'concept-arrangement-ethics', 'unresolved-with', 'the source explicitly leaves the authorship triangle unresolved', sourceRef('⚡ Unexpected Connections.md', '§VII · The arrangement ethics', 'The vault does not resolve this triangle.', '§VII · closing statement')],
  ['ghost-evidence-boundary', 'concept-missing-variable', 'concept-evidence-over-map', 'unresolved-with', 'do not name a variable without a measurement', sourceRef('👻 X — The Missing Variable.md', 'Standing exclusion', 'no invention of numbers', 'report header')],
  ['creative-tender-horror', 'source-mythographic-childhood', 'concept-tender-horror', 'interprets', 'Unexpected Connections frames the works as a tender-horror braid', sourceRef('⚡ Unexpected Connections.md', '§VI · The tender-horror braid', 'The mythographic childhood', '§VI · opening connection')],
];
for (const [id, source, target, type, label, ref] of authoredRelationships) {
  edges.push(makeEdge(id, source, target, type, label, ref.role === 'primary' ? 'source' : 'synthesis', [ref]));
}

const compileRef = ref => {
  const fullPath = resolve(SOURCE_ROOT, ref.path);
  if (!fullPath.startsWith(SOURCE_ROOT + sep) && fullPath !== SOURCE_ROOT) throw new Error(`source path escapes repository: ${ref.path}`);
  if (!existsSync(fullPath)) throw new Error(`missing Zaziopath source file: ${ref.path}`);
  const compiled = {
    path: ref.path,
    label: ref.label || ref.path,
    section: ref.section || '',
    locator: ref.locator || ref.section || '',
    role: ref.role || 'primary',
  };
  if (ref.anchor) {
    const raw = readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
    const excerpt = extractExcerpt(raw, ref.anchor, 360, ref.path);
    compiled.excerpt = excerpt;
  }
  return compiled;
};

function extractExcerpt(text, anchor, maxChars, file) {
  let index = text.indexOf(anchor);
  if (index < 0) {
    const compact = value => value.replace(/^\s*>\s?/gm, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
    const haystack = compact(text);
    const needle = compact(anchor);
    index = haystack.indexOf(needle);
    if (index < 0) throw new Error(`anchor not found in ${file}: ${anchor.slice(0, 90)}`);
    const start = Math.max(0, index - 90);
    return cleanExcerpt(haystack.slice(start, index + needle.length + 220), maxChars);
  }
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const lineEndIndex = text.indexOf('\n', index);
  const lineEnd = lineEndIndex < 0 ? text.length : lineEndIndex;
  const line = text.slice(lineStart, lineEnd).trim();
  let start = Math.max(0, text.lastIndexOf('\n\n', index) + 2);
  let end = text.indexOf('\n\n', index);
  if (end < 0) end = text.length;
  let block = text.slice(start, end).trim();
  if (line.includes('|') || line.length > maxChars || block.length > maxChars * 2) block = line;
  if (!block.includes(anchor)) block = line;
  return cleanExcerpt(block, maxChars);
}

function cleanExcerpt(value, maxChars) {
  let text = value
    .replace(/^\s*#+\s*/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > maxChars) text = `${text.slice(0, maxChars - 1).trimEnd()}…`;
  return text;
}

function gitRevision() {
  try { return execFileSync('git', ['-C', SOURCE_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'unversioned-source-copy'; }
}

function validateGraph(graph) {
  const errors = [];
  const strataIds = new Set(graph.strata.map(s => s.id));
  const nodeIds = new Set();
  const names = new Map();
  const normalizeName = value => value.toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    nodeIds.add(node.id);
    if (!strataIds.has(node.stratum)) errors.push(`invalid stratum on ${node.id}: ${node.stratum}`);
    if (!node.provenance?.category || !node.provenance?.epistemic) errors.push(`missing provenance on ${node.id}`);
    if (!node.sources?.length || !node.sources.some(ref => ref.excerpt)) errors.push(`missing source excerpt/provenance on ${node.id}`);
    if (['concept', 'pattern', 'experiment', 'persona', 'creative-work', 'evidence-cluster', 'question'].includes(node.kind)) {
      const normalized = normalizeName(node.title);
      if (names.has(normalized)) errors.push(`duplicate normalized concept name: ${node.title} / ${names.get(normalized)}`);
      else names.set(normalized, node.title);
    }
  }
  const edgeIds = new Set();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) errors.push(`duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) errors.push(`dangling edge ${edge.id}: ${edge.source} → ${edge.target}`);
    if (!edge.provenance?.sourceRefs?.length) errors.push(`missing edge provenance: ${edge.id}`);
  }
  for (const fragment of graph.fragments) {
    if (!fragment.sources?.length || !fragment.sources.some(ref => ref.excerpt)) errors.push(`fragment missing source excerpt: ${fragment.id}`);
    for (const id of fragment.relatedNodeIds) if (!nodeIds.has(id)) errors.push(`fragment ${fragment.id} references missing node ${id}`);
  }
  return errors;
}

const sourceByPath = new Map();
const nodes = [...strataNodes, ...sourceNodes, ...concepts].map(node => {
  const sources = node.sources.map(ref => {
    const compiled = compileRef(ref);
    sourceByPath.set(ref.path, compiled);
    return compiled;
  });
  const relatedFiles = [...new Set([...node.relatedFiles, ...sources.map(ref => ref.path)])];
  const stratumMeta = STRATA.find(s => s.id === node.stratum);
  return {
    ...node,
    color: stratumMeta.color,
    sourceColor: stratumMeta.sourceColor,
    glyph: stratumMeta.glyph,
    sources,
    relatedFiles,
    provenance: {
      ...node.provenance,
      sourceBacked: node.epistemic === 'source',
      sourceFiles: relatedFiles,
    },
  };
});

const fragments = fragmentDefinitions.map(fragment => ({
  id: fragment.id,
  title: fragment.title,
  stratum: fragment.stratum,
  epistemic: fragment.epistemic,
  tags: fragment.tags,
  relatedNodeIds: fragment.relatedNodeIds,
  sources: [compileRef(fragment.anchor)],
}));

// File/anchor references on edges are compiled after node citations. They remain
// separate records so each relation retains its own provenance locator.
const compiledEdges = edges.map(edge => ({
  ...edge,
  provenance: { ...edge.provenance, sourceRefs: edge.provenance.sourceRefs.map(compileRef) },
}));

const graph = {
  version: 1,
  corpus: {
    name: 'Zaziopath',
    repository: 'https://github.com/zazieproductions/Zaziopath',
    revision: gitRevision(),
    model: MODEL,
    generatedBy: 'scripts/build-zaziopath-graph.mjs',
    dataPolicy: 'Curated, source-cited snapshot; the browser does not crawl the repository.',
    epistemicStatuses: ['source', 'inference', 'synthesis', 'open-question'],
  },
  strata: STRATA.map(({ id, label, short, glyph, sourceColor, color, summary }) => ({ id, label, short, glyph, sourceColor, color, summary })),
  nodes,
  edges: compiledEdges,
  fragments,
};

const errors = validateGraph(graph);
if (errors.length) {
  console.error('Graph build failed validation:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

mkdirSync(dirname(OUTPUT), { recursive: true });
const output = `/* Generated by scripts/build-zaziopath-graph.mjs; edit the curation, not this file. */\nwindow.ZAZIOPATH_GRAPH = ${JSON.stringify(graph, null, 2)};\n`;
writeFileSync(OUTPUT, output);
console.log(`Built ${relative(ROOT, OUTPUT)} from ${SOURCE_ROOT}`);
console.log(`${nodes.length} nodes · ${compiledEdges.length} edges · ${fragments.length} source fragments · source ${graph.corpus.revision}`);
