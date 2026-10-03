/**
 * NOÖSPHERE // WEB UPLINK — Level 3 Bounded Multi-Page Crawler
 * ============================================================================
 * Capabilities:
 *  - Optional Crawl4AI local service adapter (CRAWL4AI_URL, default http://127.0.0.1:11235)
 *  - Built-in local relevance-guided priority BFS crawler (always available)
 *  - Follow relevant internal links (same-domain mode by default)
 *  - Depth control (default maxDepth = 2, hard ceiling = 4)
 *  - Page-count control (default maxPages = 10, hard ceiling = 25)
 *  - Bounded extracted text before model context (default maxTotalChars = 24000)
 *  - Early stopping when sufficient high-relevance evidence has been collected
 *  - Strict SSRF validation and URL canonicalization on every discovered link
 */

import { validatePublicUrl, canonicalizeUrl, sanitizeWebTextForLLM } from './security.mjs';
import { fetch_page } from './reader.mjs';
import { extractDomain, tokenizeQuery, rankAndClassifySources } from './quality.mjs';

const DEFAULT_CRAWL4AI_URL = process.env.CRAWL4AI_URL || 'http://127.0.0.1:11235';

export const CRAWL_DEFAULTS = Object.freeze({
  maxDepth: 2,
  maxPages: 10,
  maxTotalChars: 24000,
  sameDomain: true,
});

const HARD_LIMITS = Object.freeze({
  maxDepth: 4,
  maxPages: 25,
  maxTotalChars: 60000,
});

/**
 * Checks whether an optional local Crawl4AI server is running.
 */
export async function checkCrawl4aiHealth(customUrl = undefined) {
  const base = (customUrl || DEFAULT_CRAWL4AI_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      return { online: true, engine: 'crawl4ai', endpoint: base };
    }
  } catch {
    // Crawl4AI service not running; local crawler engine remains online
  }
  return { online: true, engine: 'local-bfs-crawler', crawl4aiService: false, endpoint: null };
}

/**
 * Scores a candidate link (0..100) for crawl priority based on query keywords and URL structure.
 */
function scoreCandidateLink(link, queryTokens, seedDomain) {
  let score = 20;
  const urlLower = String(link.url || '').toLowerCase();
  const textLower = String(link.text || '').toLowerCase();

  // Penalize non-content utility paths
  if (/\b(login|signin|signup|register|cart|checkout|privacy|terms|cookie|contact|account|tag|author|feed|rss|print|share)\b/i.test(urlLower)) {
    score -= 18;
  }
  // Penalize media/archive extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg|mp3|mp4|avi|mov|zip|tar|gz|exe|dmg|iso|css|js|woff2?)(\?|$)/i.test(urlLower)) {
    return -100;
  }

  if (link.internal || extractDomain(link.url) === seedDomain) {
    score += 15;
  }

  if (queryTokens.length > 0) {
    let matched = 0;
    for (const tok of queryTokens) {
      if (textLower.includes(tok)) {
        score += 18;
        matched++;
      } else if (urlLower.includes(tok)) {
        score += 12;
        matched++;
      }
    }
    if (matched === 0) {
      score -= 5;
    }
  } else {
    // General exploration: prefer descriptive anchor text and shallow clean paths
    if (textLower.length >= 10 && textLower.length <= 90) score += 10;
  }

  const pathSegments = new URL(link.url).pathname.split('/').filter(Boolean).length;
  score -= Math.min(10, pathSegments * 2);

  return score;
}

/**
 * Optional Crawl4AI page fetch adapter (used only if Crawl4AI service is healthy).
 */
async function fetchViaCrawl4ai(endpoint, targetUrl, maxChars) {
  // Always validate targetUrl against SSRF first!
  validatePublicUrl(targetUrl);
  const res = await fetch(`${endpoint.replace(/\/+$/, '')}/md`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: targetUrl }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Crawl4AI HTTP ${res.status}`);
  const data = await res.json();
  const md = String(data.markdown || data.result?.markdown || '');
  if (!md.trim()) throw new Error('Empty Crawl4AI markdown');
  const sanitized = sanitizeWebTextForLLM(md, maxChars);
  // Extract links from markdown [text](url)
  const links = [];
  const baseDomain = extractDomain(targetUrl);
  for (const m of md.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const canon = canonicalizeUrl(m[2], targetUrl);
    if (!canon) continue;
    const dom = extractDomain(canon);
    links.push({
      text: m[1].trim().slice(0, 120),
      url: canon,
      domain: dom,
      internal: dom === baseDomain || dom.endsWith(`.${baseDomain}`),
    });
  }
  return {
    url: targetUrl,
    canonicalUrl: canonicalizeUrl(targetUrl) || targetUrl,
    domain: baseDomain,
    title: data.title || md.split('\n')[0]?.replace(/^#+\s*/, '')?.slice(0, 140) || targetUrl,
    author: null,
    publishedDate: null,
    metadata: { extractor: 'crawl4ai' },
    headings: [],
    links,
    text: sanitized.text,
    markdown: sanitized.text,
    excerpt: sanitized.text.slice(0, 600),
    charCount: sanitized.text.length,
    truncated: sanitized.truncated,
    injectionFlags: sanitized.injectionFlags,
    sourceType: 'SECONDARY SOURCE',
    retrievedAt: new Date().toISOString(),
  };
}

/**
 * Primary entry point: crawl_site(seedUrl, options)
 *
 * Options:
 *  - query / topic: optional focus topic for relevance filtering & early stopping
 *  - maxDepth: number (default 2, max 4)
 *  - maxPages: number (default 10, max 25)
 *  - maxTotalChars: number (default 24000, max 60000)
 *  - sameDomain: boolean (default true)
 *  - fetchPageFn: optional custom page fetcher for testing
 */
export async function crawl_site(seedUrl, options = {}) {
  const validatedSeed = validatePublicUrl(seedUrl);
  const canonicalSeed = canonicalizeUrl(validatedSeed.toString()) || validatedSeed.toString();
  const seedDomain = extractDomain(canonicalSeed);

  const maxDepth = Math.max(
    0,
    Math.min(HARD_LIMITS.maxDepth, Number(options.maxDepth ?? CRAWL_DEFAULTS.maxDepth)),
  );
  const maxPages = Math.max(
    1,
    Math.min(HARD_LIMITS.maxPages, Number(options.maxPages ?? CRAWL_DEFAULTS.maxPages)),
  );
  const maxTotalChars = Math.max(
    2000,
    Math.min(HARD_LIMITS.maxTotalChars, Number(options.maxTotalChars ?? CRAWL_DEFAULTS.maxTotalChars)),
  );
  const sameDomain = options.sameDomain !== undefined ? Boolean(options.sameDomain) : CRAWL_DEFAULTS.sameDomain;
  const topic = String(options.query || options.topic || '').trim();
  const queryTokens = tokenizeQuery(topic);

  const crawlHealth = options.fetchPageFn
    ? { online: true, engine: 'custom-fetcher', endpoint: null }
    : await checkCrawl4aiHealth(options.crawl4aiUrl);

  const visited = new Set();
  const enqueued = new Set([canonicalSeed]);
  const queue = [{ url: canonicalSeed, depth: 0, priority: 100, parentUrl: null, anchorText: 'SEED' }];

  const pages = [];
  const crawlGraph = [];
  const skippedErrors = [];
  let totalChars = 0;
  let maxDepthReached = 0;
  let stoppedReason = 'queue_exhausted';

  const perPageCharBudget = Math.max(2500, Math.min(8000, Math.floor(maxTotalChars / Math.max(1, Math.min(maxPages, 6)))));

  while (queue.length > 0) {
    if (pages.length >= maxPages) {
      stoppedReason = 'max_pages_reached';
      break;
    }
    if (totalChars >= maxTotalChars) {
      stoppedReason = 'max_total_chars_reached';
      break;
    }

    // Sort queue by highest priority first, then shallowest depth
    queue.sort((a, b) => b.priority - a.priority || a.depth - b.depth);
    const current = queue.shift();
    if (!current || visited.has(current.url)) continue;

    visited.add(current.url);

    let pageData = null;
    try {
      validatePublicUrl(current.url);
      if (options.fetchPageFn) {
        pageData = await options.fetchPageFn(current.url, { maxChars: perPageCharBudget, query: topic });
      } else if (crawlHealth.engine === 'crawl4ai' && crawlHealth.endpoint) {
        try {
          pageData = await fetchViaCrawl4ai(crawlHealth.endpoint, current.url, perPageCharBudget);
        } catch {
          pageData = await fetch_page(current.url, { maxChars: perPageCharBudget, query: topic });
        }
      } else {
        pageData = await fetch_page(current.url, { maxChars: perPageCharBudget, query: topic });
      }
    } catch (err) {
      skippedErrors.push({ url: current.url, depth: current.depth, error: err.message });
      continue;
    }

    if (!pageData || !pageData.text) continue;

    // Also mark canonicalUrl as visited to prevent alias loops
    if (pageData.canonicalUrl) {
      visited.add(pageData.canonicalUrl);
    }

    maxDepthReached = Math.max(maxDepthReached, current.depth);

    const remainingBudget = Math.max(600, maxTotalChars - totalChars);
    const boundedText = pageData.text.slice(0, remainingBudget);
    const boundedMarkdown = (pageData.markdown || pageData.text).slice(0, remainingBudget);
    totalChars += boundedText.length;

    pages.push({
      id: pages.length + 1,
      url: pageData.canonicalUrl || current.url,
      title: pageData.title || current.anchorText || current.url,
      domain: pageData.domain || extractDomain(current.url),
      depth: current.depth,
      parentUrl: current.parentUrl,
      publishedDate: pageData.publishedDate || null,
      author: pageData.author || null,
      excerpt: boundedText.slice(0, 500),
      extractedText: boundedText,
      markdown: boundedMarkdown,
      headings: pageData.headings || [],
      linksCount: (pageData.links || []).length,
      charCount: boundedText.length,
      sourceType: pageData.sourceType || 'SECONDARY SOURCE',
      injectionFlags: pageData.injectionFlags || [],
      retrievedAt: pageData.retrievedAt || new Date().toISOString(),
    });

    // Check early-stopping condition if topic is specified and we already have strong evidence
    if (queryTokens.length > 0 && pages.length >= 4 && totalChars >= Math.min(12000, maxTotalChars * 0.6)) {
      const relevantPages = pages.filter((p) => {
        const hay = `${p.title} ${p.extractedText}`.toLowerCase();
        return queryTokens.some((tok) => hay.includes(tok));
      });
      if (relevantPages.length >= 4) {
        stoppedReason = 'sufficient_relevant_evidence';
        break;
      }
    }

    // Expand links if within depth limit
    if (current.depth < maxDepth && Array.isArray(pageData.links)) {
      for (const link of pageData.links) {
        const canonLink = canonicalizeUrl(link.url, current.url);
        if (!canonLink || visited.has(canonLink) || enqueued.has(canonLink)) continue;

        try {
          validatePublicUrl(canonLink);
        } catch {
          continue;
        }

        const linkDomain = extractDomain(canonLink);
        if (sameDomain && linkDomain !== seedDomain && !linkDomain.endsWith(`.${seedDomain}`)) {
          continue;
        }

        const priority = scoreCandidateLink(link, queryTokens, seedDomain);
        if (priority < 0) continue;
        // If a topic is provided, skip low-relevance links at deeper hops
        if (queryTokens.length > 0 && current.depth >= 1 && priority < 25) {
          continue;
        }

        enqueued.add(canonLink);
        queue.push({
          url: canonLink,
          depth: current.depth + 1,
          priority,
          parentUrl: pageData.canonicalUrl || current.url,
          anchorText: link.text || canonLink,
        });
        crawlGraph.push({
          from: pageData.canonicalUrl || current.url,
          to: canonLink,
          anchor: (link.text || '').slice(0, 80),
          depth: current.depth + 1,
        });
      }
    }
  }

  // Rank crawled pages using Level 7 source quality heuristics
  const rankedPages = rankAndClassifySources(
    pages.map((p) => ({
      ...p,
      snippet: p.excerpt,
      hasFullText: true,
      engine: crawlHealth.engine,
    })),
    { query: topic || seedDomain, targetSite: sameDomain ? seedDomain : undefined },
  );

  return {
    seedUrl: canonicalSeed,
    seedDomain,
    topic: topic || null,
    engine: crawlHealth.engine,
    limits: { maxDepth, maxPages, maxTotalChars, sameDomain },
    stats: {
      pagesCrawled: rankedPages.length,
      urlsVisited: visited.size,
      urlsQueued: enqueued.size,
      maxDepthReached,
      totalCharsExtracted: totalChars,
      skippedErrors: skippedErrors.length,
      stoppedReason,
    },
    pages: rankedPages,
    crawlGraph: crawlGraph.slice(0, 60),
    skippedErrors: skippedErrors.slice(0, 10),
    timestamp: new Date().toISOString(),
  };
}
