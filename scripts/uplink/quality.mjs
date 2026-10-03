/**
 * NOÖSPHERE // WEB UPLINK — Level 7 Source Quality Heuristics & Epistemic Classifier
 * ============================================================================
 * Ranks sources deterministically using transparent, non-LLM heuristics:
 *  - Primary / official source detection
 *  - Academic / research source detection
 *  - Publication date & recency scoring
 *  - Domain reputation tiers
 *  - Direct lexical & structural relevance
 *  - Cross-source agreement (multi-engine & cross-domain corroboration)
 *  - Presence of author / publication date / canonical metadata
 *  - Near-duplicate & domain-flooding penalty
 *
 * Explicitly separates:
 *  - PRIMARY SOURCE
 *  - SECONDARY SOURCE
 *  - SEARCH SNIPPET
 *  - MODEL INFERENCE
 */

export const EPISTEMIC_TYPES = Object.freeze({
  PRIMARY: 'PRIMARY SOURCE',
  SECONDARY: 'SECONDARY SOURCE',
  SNIPPET: 'SEARCH SNIPPET',
  INFERENCE: 'MODEL INFERENCE',
});

const ACADEMIC_DOMAINS = new Set([
  'arxiv.org',
  'export.arxiv.org',
  'doi.org',
  'dx.doi.org',
  'crossref.org',
  'api.crossref.org',
  'scholar.google.com',
  'semanticscholar.org',
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'biorxiv.org',
  'medrxiv.org',
  'nature.com',
  'science.org',
  'cell.com',
  'thelancet.com',
  'nejm.org',
  'ieee.org',
  'ieeexplore.ieee.org',
  'acm.org',
  'dl.acm.org',
  'springer.com',
  'link.springer.com',
  'sciencedirect.com',
  'wiley.com',
  'onlinelibrary.wiley.com',
  'jstor.org',
  'oup.com',
  'academic.oup.com',
  'cambridge.org',
  'mitpress.mit.edu',
  'plato.stanford.edu',
  'philpapers.org',
  'hal.science',
  'ircam.fr',
  'zenodo.org',
  'osf.io',
  'ssrn.com',
  'nber.org',
]);

const PRIMARY_OFFICIAL_DOMAINS = new Set([
  'w3.org',
  'ietf.org',
  'datatracker.ietf.org',
  'rfc-editor.org',
  'whatwg.org',
  'iso.org',
  'nist.gov',
  'nasa.gov',
  'cern.ch',
  'who.int',
  'un.org',
  'europa.eu',
  'developer.mozilla.org',
  'nodejs.org',
  'ollama.com',
  'github.com',
  'docs.searxng.org',
]);

const REFERENCE_SECONDARY_DOMAINS = new Set([
  'en.wikipedia.org',
  'wikipedia.org',
  'britannica.com',
  'stanford.edu',
  'mit.edu',
  'harvard.edu',
  'ox.ac.uk',
  'cam.ac.uk',
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'npr.org',
  'pbs.org',
  'arstechnica.com',
  'lwn.net',
  'news.ycombinator.com',
]);

const LOW_SIGNAL_DOMAINS = new Set([
  'pinterest.com',
  'quora.com',
  'tiktok.com',
  'facebook.com',
  'instagram.com',
  'blogspot.com',
]);

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'what', 'when', 'where',
  'which', 'who', 'whom', 'whose', 'why', 'how', 'are', 'was', 'were', 'been',
  'being', 'have', 'has', 'had', 'having', 'does', 'did', 'doing', 'will', 'would',
  'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same',
  'than', 'too', 'very', 'over', 'also', 'around', 'history', 'current', 'debates',
]);

export function tokenizeQuery(text) {
  if (!text || typeof text !== 'string') return [];
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u017F-]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ];
}

export function extractDomain(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Determines domain reputation tier and whether the source is primary/academic.
 */
export function classifyDomainTier(domain, options = {}) {
  const d = (domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) return { tier: 'secondary', isPrimary: false, isAcademic: false, baseAuthority: 10 };

  const isGovOrMil =
    d.endsWith('.gov') ||
    d.includes('.gov.') ||
    d.endsWith('.mil') ||
    d.endsWith('.int') ||
    d.endsWith('.europa.eu');

  const isEduOrAc =
    d.endsWith('.edu') ||
    d.includes('.edu.') ||
    d.includes('.ac.') ||
    d.endsWith('.edu.au') ||
    d.endsWith('.ac.uk') ||
    d.endsWith('.ac.jp') ||
    d.endsWith('.edu.cn');

  const matchesSet = (set) => {
    if (set.has(d)) return true;
    for (const entry of set) {
      if (d.endsWith(`.${entry}`)) return true;
    }
    return false;
  };

  if (matchesSet(ACADEMIC_DOMAINS) || isEduOrAc) {
    return { tier: 'academic', isPrimary: true, isAcademic: true, baseAuthority: 32 };
  }

  if (matchesSet(PRIMARY_OFFICIAL_DOMAINS) || isGovOrMil) {
    return { tier: 'primary', isPrimary: true, isAcademic: false, baseAuthority: 30 };
  }

  if (options.targetSite && (d === options.targetSite || d.endsWith(`.${options.targetSite}`))) {
    return { tier: 'primary', isPrimary: true, isAcademic: false, baseAuthority: 30 };
  }

  if (matchesSet(REFERENCE_SECONDARY_DOMAINS)) {
    return { tier: 'reference', isPrimary: false, isAcademic: false, baseAuthority: 22 };
  }

  if (matchesSet(LOW_SIGNAL_DOMAINS)) {
    return { tier: 'low-signal', isPrimary: false, isAcademic: false, baseAuthority: 5 };
  }

  return { tier: 'secondary', isPrimary: false, isAcademic: false, baseAuthority: 15 };
}

/**
 * Classifies epistemic category strictly:
 *  - PRIMARY SOURCE (fetched page or verified primary/academic artifact with direct text/abstract)
 *  - SECONDARY SOURCE (fetched page with extracted body text from secondary/reference domain)
 *  - SEARCH SNIPPET (search metadata/snippet only, full page not fetched)
 */
export function classifyEpistemicSource(source, options = {}) {
  const domain = source.domain || extractDomain(source.url);
  const { isPrimary, isAcademic } = classifyDomainTier(domain, options);
  const hasFullText = Boolean(
    source.hasFullText ||
      (typeof source.extractedText === 'string' && source.extractedText.trim().length > 180) ||
      source.isAcademicAbstract,
  );

  // Check if query tokens match the domain root (first-party official website)
  const queryTokens = tokenizeQuery(options.query || '');
  const domainRoot = domain.split('.')[0] || '';
  const isFirstPartyDomain =
    domainRoot.length >= 4 && queryTokens.some((tok) => tok === domainRoot);

  if (!hasFullText) {
    return EPISTEMIC_TYPES.SNIPPET;
  }

  if (isPrimary || isAcademic || isFirstPartyDomain || source.metadata?.scholarly) {
    return EPISTEMIC_TYPES.PRIMARY;
  }

  return EPISTEMIC_TYPES.SECONDARY;
}

/**
 * Computes recency score (0..15) from publishedDate.
 */
export function computeRecencyScore(publishedDate, preferRecent = false) {
  if (!publishedDate) return preferRecent ? 2 : 5;
  const ts = Date.parse(publishedDate);
  if (Number.isNaN(ts)) {
    const yearMatch = String(publishedDate).match(/\b(19\d{2}|20\d{2})\b/);
    if (!yearMatch) return 5;
    const year = Number(yearMatch[1]);
    const ageYears = Math.max(0, new Date().getUTCFullYear() - year);
    if (ageYears <= 1) return 14;
    if (ageYears <= 3) return 11;
    if (ageYears <= 7) return 8;
    return 6;
  }

  const ageDays = Math.max(0, (Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (ageDays <= 7) return 15;
  if (ageDays <= 30) return 14;
  if (ageDays <= 180) return 12;
  if (ageDays <= 365) return 10;
  if (ageDays <= 365 * 3) return 8;
  return preferRecent ? 4 : 6;
}

/**
 * Computes lexical relevance score (0..30) against query keywords.
 */
export function computeRelevanceScore(source, queryTokens) {
  if (!queryTokens || queryTokens.length === 0) return 18;
  const title = String(source.title || '').toLowerCase();
  const body = String(source.extractedText || source.snippet || '').toLowerCase();
  const url = String(source.url || '').toLowerCase();
  const fullDoc = `${title} ${url} ${body}`;

  let matchedInTitle = 0;
  let matchedInDoc = 0;
  let totalTermFreq = 0;

  for (const token of queryTokens) {
    const stem = token.length >= 6 ? token.slice(0, 6) : token;
    if (title.includes(token) || url.includes(token) || (stem.length >= 5 && (title.includes(stem) || url.includes(stem)))) {
      matchedInTitle++;
    }
    if (fullDoc.includes(token) || (stem.length >= 5 && fullDoc.includes(stem))) {
      matchedInDoc++;
      const occurrences = fullDoc.split(stem).length - 1;
      totalTermFreq += Math.min(4, occurrences);
    }
  }

  const titleRatio = matchedInTitle / queryTokens.length;
  const docRatio = matchedInDoc / queryTokens.length;
  const anyMatchBonus = matchedInDoc > 0 ? 6 : 0;
  const tfBonus = Math.min(6, totalTermFreq);

  return Math.min(30, Math.round(titleRatio * 12 + docRatio * 10 + anyMatchBonus + tfBonus));
}

/**
 * Ranks, classifies, and scores a list of candidate sources using Level 7 heuristics.
 */
export function rankAndClassifySources(candidates, options = {}) {
  const queryTokens = tokenizeQuery(options.query || '');
  const preferRecent = Boolean(options.preferRecent || options.category === 'news' || options.timeRange);

  // Build cross-source term frequency across independent domains to measure corroboration
  const phraseDomains = new Map();
  for (const item of candidates) {
    const dom = item.domain || extractDomain(item.url);
    const tokens = tokenizeQuery(`${item.title || ''} ${item.snippet || ''}`);
    for (const tok of tokens) {
      if (!phraseDomains.has(tok)) phraseDomains.set(tok, new Set());
      phraseDomains.get(tok).add(dom);
    }
  }

  const domainCounts = new Map();
  const seenFingerprints = new Set();

  const scored = candidates.map((item) => {
    const domain = item.domain || extractDomain(item.url);
    const tierInfo = classifyDomainTier(domain, options);
    const sourceType = classifyEpistemicSource({ ...item, domain }, options);

    const authorityScore = tierInfo.baseAuthority;
    const relevanceScore = computeRelevanceScore(item, queryTokens);
    const recencyScore = computeRecencyScore(item.publishedDate, preferRecent);

    // Provenance score (0..15): author, date, full text / canonical metadata
    let provenanceScore = 0;
    if (item.author || item.metadata?.author) provenanceScore += 5;
    if (item.publishedDate) provenanceScore += 5;
    if (sourceType !== EPISTEMIC_TYPES.SNIPPET) provenanceScore += 5;
    else if (item.url && item.snippet && item.snippet.length > 80) provenanceScore += 2;

    // Cross-source agreement (0..10): multi-engine hit + corroborated concepts across domains
    const engineCount = Array.isArray(item.engines)
      ? item.engines.length
      : String(item.engine || '')
          .split(',')
          .filter(Boolean).length || 1;
    const itemTokens = tokenizeQuery(`${item.title || ''} ${item.snippet || ''}`);
    const corroboratedTokens = itemTokens.filter((t) => (phraseDomains.get(t)?.size || 0) >= 2).length;
    const corroborationScore = Math.min(
      10,
      Math.min(6, (engineCount - 1) * 4) + Math.min(4, Math.floor(corroboratedTokens / 2)),
    );

    // Duplication penalty
    const titleFingerprint = String(item.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 48);
    let duplicationPenalty = 0;
    if (titleFingerprint && seenFingerprints.has(titleFingerprint)) {
      duplicationPenalty += 18;
    } else if (titleFingerprint) {
      seenFingerprints.add(titleFingerprint);
    }

    const prevDomainCount = domainCounts.get(domain) || 0;
    domainCounts.set(domain, prevDomainCount + 1);
    if (!options.targetSite && prevDomainCount >= 2) {
      duplicationPenalty += Math.min(15, (prevDomainCount - 1) * 5);
    }

    const rawTotal =
      authorityScore +
      relevanceScore +
      recencyScore +
      provenanceScore +
      corroborationScore -
      duplicationPenalty;

    const qualityScore = Math.max(5, Math.min(100, Math.round(rawTotal)));

    return {
      ...item,
      domain,
      sourceType,
      score: qualityScore,
      qualityScore,
      qualityBreakdown: {
        domainTier: tierInfo.tier,
        isPrimary: tierInfo.isPrimary,
        isAcademic: tierInfo.isAcademic,
        authorityScore,
        relevanceScore,
        recencyScore,
        provenanceScore,
        corroborationScore,
        duplicationPenalty,
      },
    };
  });

  scored.sort((a, b) => b.qualityScore - a.qualityScore);

  return scored.map((item, idx) => ({
    ...item,
    id: idx + 1,
  }));
}
