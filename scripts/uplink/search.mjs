/**
 * NOÖSPHERE // WEB UPLINK — Level 1 Metasearch Engine
 * ============================================================================
 * Primary backend: Local SearXNG instance (SEARXNG_URL, default http://127.0.0.1:8080)
 * Fallback backends (zero-key, no paid APIs):
 *  - DuckDuckGo HTML & Instant Answer API (general web)
 *  - Wikipedia MediaWiki API (reference knowledge)
 *  - Crossref & arXiv APIs (science / academic research)
 *  - Hacker News Algolia API (news & recency-filtered web links)
 *  - Wikimedia Commons API (images)
 *
 * All results are normalized into:
 *  { title, url, snippet, domain, engine, publishedDate, score }
 */

import { validatePublicUrl, canonicalizeUrl, sanitizeSearchQuery } from './security.mjs';
import { extractDomain, rankAndClassifySources } from './quality.mjs';
import { webCache } from './cache.mjs';

const DEFAULT_SEARXNG_URLS = [
  process.env.SEARXNG_URL,
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8888',
].filter(Boolean);

const USER_AGENT = 'Noosphere-Local-Research-Workstation/9.4 (+local-first; llama3.1:8b)';

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtmlTags(str) {
  if (!str || typeof str !== 'string') return '';
  return decodeHtmlEntities(str.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

let lastFallbackProbe = { checkedAt: 0, online: false };

/**
 * Checks whether a local SearXNG instance or public fallback metasearch is reachable.
 */
export async function checkSearxngHealth(customUrl = undefined) {
  const candidates = customUrl ? [customUrl] : [...new Set(DEFAULT_SEARXNG_URLS)];
  for (const base of candidates) {
    try {
      const cleanBase = base.replace(/\/+$/, '');
      const res = await fetch(`${cleanBase}/config`, {
        headers: { accept: 'application/json', 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(1200),
      });
      if (res.ok) {
        return { online: true, searxngOnline: true, backend: 'searxng', endpoint: cleanBase };
      }
      const healthRes = await fetch(`${cleanBase}/healthz`, {
        signal: AbortSignal.timeout(1000),
      });
      if (healthRes.ok) {
        return { online: true, searxngOnline: true, backend: 'searxng', endpoint: cleanBase };
      }
    } catch {
      // Try next candidate
    }
  }

  // Probe whether fallback public search is reachable (cached for 30s)
  const now = Date.now();
  if (now - lastFallbackProbe.checkedAt > 30000) {
    try {
      const probe = await fetch('https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&format=json', {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(1500),
      });
      lastFallbackProbe = { checkedAt: now, online: probe.ok };
    } catch {
      lastFallbackProbe = { checkedAt: now, online: false };
    }
  }

  return {
    online: lastFallbackProbe.online,
    searxngOnline: false,
    backend: lastFallbackProbe.online ? 'fallback-metasearch' : 'offline',
    endpoint: null,
  };
}

/**
 * Queries a local SearXNG instance.
 */
async function querySearxng(endpoint, query, options = {}) {
  const {
    category = 'general',
    timeRange = '',
    page = 1,
    engines = '',
  } = options;

  const u = new URL(`${endpoint.replace(/\/+$/, '')}/search`);
  u.searchParams.set('q', query);
  u.searchParams.set('format', 'json');
  u.searchParams.set('pageno', String(Math.max(1, Number(page) || 1)));

  if (category && ['general', 'news', 'science', 'images'].includes(category)) {
    u.searchParams.set('categories', category);
  }
  if (timeRange && ['day', 'week', 'month', 'year'].includes(timeRange)) {
    u.searchParams.set('time_range', timeRange);
  }
  if (engines && typeof engines === 'string') {
    u.searchParams.set('engines', engines);
  }

  const res = await fetch(u.toString(), {
    headers: { accept: 'application/json', 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`SearXNG HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.results)) {
    throw new Error('Invalid SearXNG JSON payload');
  }

  return data.results.map((r) => ({
    title: stripHtmlTags(r.title || 'Untitled'),
    url: r.url || '',
    snippet: stripHtmlTags(r.content || r.snippet || ''),
    domain: extractDomain(r.url || ''),
    engine: Array.isArray(r.engines) && r.engines.length
      ? r.engines.join(',')
      : String(r.engine || 'searxng'),
    publishedDate: r.publishedDate || r.pubdate || null,
    score: typeof r.score === 'number' ? Math.min(100, Math.round(r.score * 20)) : 70,
    thumbnailUrl: r.img_src || r.thumbnail || undefined,
    author: r.author || undefined,
  }));
}

/**
 * Fallback Provider 1: DuckDuckGo HTML endpoint + Instant Answer API
 */
async function searchDuckDuckGoFallback(query, page = 1) {
  const results = [];

  // 1a. DuckDuckGo HTML scrape
  try {
    const body = new URLSearchParams({
      q: query,
      s: String((Math.max(1, page) - 1) * 30),
    });
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        accept: 'text/html',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(6500),
    });

    if (res.ok) {
      const html = await res.text();
      const blocks = html.split(/class="result\s+results_links/i).slice(1, 16);
      for (const block of blocks) {
        const linkMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!linkMatch) continue;
        let href = decodeHtmlEntities(linkMatch[1]);
        if (href.includes('uddg=')) {
          try {
            const parsedHref = new URL(href, 'https://html.duckduckgo.com');
            href = parsedHref.searchParams.get('uddg') || href;
          } catch {
            // keep href
          }
        }
        const title = stripHtmlTags(linkMatch[2]);
        const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
        const snippet = snippetMatch ? stripHtmlTags(snippetMatch[1]) : '';
        if (title && href.startsWith('http')) {
          results.push({
            title,
            url: href,
            snippet,
            domain: extractDomain(href),
            engine: 'duckduckgo',
            publishedDate: null,
            score: 72,
          });
        }
      }
    }
  } catch {
    // Continue to Instant Answer API
  }

  // 1b. DuckDuckGo Instant Answer API
  try {
    const u = new URL('https://api.duckduckgo.com/');
    u.searchParams.set('q', query);
    u.searchParams.set('format', 'json');
    u.searchParams.set('no_html', '1');
    u.searchParams.set('skip_disambig', '1');
    const res = await fetch(u.toString(), {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.AbstractURL && data.AbstractText) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: stripHtmlTags(data.AbstractText),
          domain: extractDomain(data.AbstractURL),
          engine: 'duckduckgo-ia',
          publishedDate: null,
          score: 78,
        });
      }
      if (Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, 6)) {
          if (topic.FirstURL && topic.Text) {
            results.push({
              title: stripHtmlTags(topic.Text).slice(0, 90),
              url: topic.FirstURL,
              snippet: stripHtmlTags(topic.Text),
              domain: extractDomain(topic.FirstURL),
              engine: 'duckduckgo-ia',
              publishedDate: null,
              score: 68,
            });
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  return results;
}

/**
 * Fallback Provider 2: Wikipedia Search API
 */
async function searchWikipediaFallback(query, page = 1) {
  try {
    const cleanQ = query.replace(/\bsite:[^\s]+/gi, '').trim();
    if (!cleanQ) return [];
    const offset = (Math.max(1, page) - 1) * 6;
    const u = new URL('https://en.wikipedia.org/w/api.php');
    u.searchParams.set('action', 'query');
    u.searchParams.set('list', 'search');
    u.searchParams.set('srsearch', cleanQ);
    u.searchParams.set('srlimit', '6');
    u.searchParams.set('sroffset', String(offset));
    u.searchParams.set('format', 'json');

    const res = await fetch(u.toString(), {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(5500),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.query?.search || [];
    return list.map((item) => {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
      return {
        title: `${item.title} — Wikipedia`,
        url,
        snippet: stripHtmlTags(item.snippet || ''),
        domain: 'en.wikipedia.org',
        engine: 'wikipedia',
        publishedDate: item.timestamp ? item.timestamp.slice(0, 10) : null,
        score: 76,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Fallback Provider 3: Crossref Academic Search API (Science & Primary Literature)
 */
async function searchCrossrefFallback(query, page = 1) {
  try {
    const cleanQ = query.replace(/\bsite:[^\s]+/gi, '').trim();
    if (!cleanQ) return [];
    const rows = 6;
    const offset = (Math.max(1, page) - 1) * rows;
    const u = new URL('https://api.crossref.org/works');
    u.searchParams.set('query', cleanQ);
    u.searchParams.set('rows', String(rows));
    u.searchParams.set('offset', String(offset));

    const res = await fetch(u.toString(), {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.message?.items || [];
    return items
      .map((item) => {
        const title = Array.isArray(item.title) ? item.title[0] : item.title;
        const url = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : '');
        if (!title || !url) return null;
        const dateParts =
          item.published?.['date-parts']?.[0] ||
          item['published-print']?.['date-parts']?.[0] ||
          item['published-online']?.['date-parts']?.[0];
        const publishedDate = Array.isArray(dateParts)
          ? dateParts.map((n) => String(n).padStart(2, '0')).join('-')
          : null;
        const authors = Array.isArray(item.author)
          ? item.author
              .slice(0, 3)
              .map((a) => [a.given, a.family].filter(Boolean).join(' '))
              .join(', ')
          : '';
        const container = Array.isArray(item['container-title']) ? item['container-title'][0] : '';
        const abstractText = item.abstract ? stripHtmlTags(item.abstract) : '';
        const snippet = abstractText
          ? abstractText.slice(0, 360)
          : [container ? `Published in ${container}.` : '', authors ? `Authors: ${authors}.` : '', item.DOI ? `DOI: ${item.DOI}` : '']
              .filter(Boolean)
              .join(' ');
        return {
          title: stripHtmlTags(title),
          url,
          snippet: snippet || title,
          domain: extractDomain(url),
          engine: 'crossref',
          publishedDate,
          author: authors || undefined,
          isAcademicAbstract: Boolean(abstractText),
          score: 86,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Fallback Provider 4: arXiv API (Science & Preprints)
 */
async function searchArxivFallback(query, page = 1) {
  try {
    const cleanQ = query.replace(/\bsite:[^\s]+/gi, '').trim();
    if (!cleanQ) return [];
    const maxResults = 5;
    const start = (Math.max(1, page) - 1) * maxResults;
    const u = new URL('https://export.arxiv.org/api/query');
    u.searchParams.set('search_query', `all:${cleanQ}`);
    u.searchParams.set('start', String(start));
    u.searchParams.set('max_results', String(maxResults));

    const res = await fetch(u.toString(), {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split('<entry>').slice(1);
    return entries
      .map((entry) => {
        const id = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || '';
        const title = stripHtmlTags(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
        const summary = stripHtmlTags(entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '');
        const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim()?.slice(0, 10) || null;
        const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
          .slice(0, 3)
          .map((m) => m[1].trim())
          .join(', ');
        if (!id || !title) return null;
        const httpsUrl = id.replace(/^http:\/\//i, 'https://');
        return {
          title,
          url: httpsUrl,
          snippet: summary.slice(0, 380),
          domain: 'arxiv.org',
          engine: 'arxiv',
          publishedDate: published,
          author: authors || undefined,
          isAcademicAbstract: true,
          score: 88,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Fallback Provider 5: Hacker News Algolia API (News & Web Links)
 */
async function searchHackerNewsFallback(query, options = {}) {
  try {
    const cleanQ = query.replace(/\bsite:[^\s]+/gi, '').trim();
    if (!cleanQ) return [];
    const page = Math.max(0, (Number(options.page) || 1) - 1);
    const endpoint =
      options.category === 'news' || options.timeRange
        ? 'https://hn.algolia.com/api/v1/search_by_date'
        : 'https://hn.algolia.com/api/v1/search';
    const u = new URL(endpoint);
    u.searchParams.set('query', cleanQ);
    u.searchParams.set('tags', 'story');
    u.searchParams.set('hitsPerPage', '8');
    u.searchParams.set('page', String(page));

    if (options.timeRange) {
      const nowSec = Math.floor(Date.now() / 1000);
      const ranges = {
        day: 86400,
        week: 86400 * 7,
        month: 86400 * 30,
        year: 86400 * 365,
      };
      if (ranges[options.timeRange]) {
        u.searchParams.set('numericFilters', `created_at_i>${nowSec - ranges[options.timeRange]}`);
      }
    }

    const res = await fetch(u.toString(), {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(5500),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const hits = data?.hits || [];
    return hits
      .map((h) => {
        const url = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
        const title = stripHtmlTags(h.title || '');
        if (!title || !url) return null;
        return {
          title,
          url,
          snippet: stripHtmlTags(
            h.story_text ||
              `Discussed by ${h.author || 'community'} (${h.points || 0} pts, ${h.num_comments || 0} comments) — Source: ${extractDomain(url)}`,
          ),
          domain: extractDomain(url),
          engine: 'hn-algolia',
          publishedDate: h.created_at ? h.created_at.slice(0, 10) : null,
          author: h.author || undefined,
          score: 70,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Fallback Provider 6: Wikimedia Commons API (Images)
 */
async function searchWikimediaImagesFallback(query, page = 1) {
  try {
    const cleanQ = query.replace(/\bsite:[^\s]+/gi, '').trim();
    if (!cleanQ) return [];
    const offset = (Math.max(1, page) - 1) * 8;
    const u = new URL('https://commons.wikimedia.org/w/api.php');
    u.searchParams.set('action', 'query');
    u.searchParams.set('generator', 'search');
    u.searchParams.set('gsrsearch', cleanQ);
    u.searchParams.set('gsrnamespace', '6');
    u.searchParams.set('gsrlimit', '8');
    u.searchParams.set('gsroffset', String(offset));
    u.searchParams.set('prop', 'imageinfo');
    u.searchParams.set('iiprop', 'url|extmetadata|timestamp');
    u.searchParams.set('format', 'json');

    const res = await fetch(u.toString(), {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(5500),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    return pages
      .map((p) => {
        const info = p.imageinfo?.[0];
        if (!info?.url) return null;
        const desc = stripHtmlTags(info.extmetadata?.ImageDescription?.value || p.title || '');
        return {
          title: String(p.title || '').replace(/^File:/i, ''),
          url: info.descriptionurl || info.url,
          snippet: desc || 'Wikimedia Commons media file',
          domain: 'commons.wikimedia.org',
          engine: 'wikimedia-images',
          publishedDate: info.timestamp ? info.timestamp.slice(0, 10) : null,
          thumbnailUrl: info.url,
          score: 75,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Filters results by recency (`day`, `week`, `month`, `year`) when `publishedDate` is present.
 */
function filterByTimeRange(results, timeRange) {
  if (!timeRange || !['day', 'week', 'month', 'year'].includes(timeRange)) return results;
  const maxAgeDays = { day: 2, week: 8, month: 35, year: 370 }[timeRange];
  const cutoff = Date.now() - maxAgeDays * 86400 * 1000;
  const filtered = results.filter((r) => {
    if (!r.publishedDate) return false;
    const ts = Date.parse(r.publishedDate);
    return !Number.isNaN(ts) && ts >= cutoff;
  });
  // If strict date filtering removes everything because providers omitted dates, retain top results
  return filtered.length > 0 ? filtered : results;
}

/**
 * Primary entry point: search_web(query, options)
 *
 * Options:
 *  - category: 'general' | 'news' | 'science' | 'images'
 *  - timeRange: '' | 'day' | 'week' | 'month' | 'year'
 *  - page: number (default 1)
 *  - site: string (optional domain filter, e.g. 'arxiv.org')
 *  - engines: string (optional SearXNG engine list)
 *  - limit: number (default 12)
 *  - bypassCache: boolean
 *  - mockFetcher: optional function for deterministic unit testing
 */
export async function search_web(rawQuery, options = {}) {
  const cleanQuery = sanitizeSearchQuery(rawQuery);
  if (!cleanQuery) {
    throw new Error('Search query must be a non-empty string');
  }

  // Extract inline `site:domain.com` if present in query
  let targetSite = (options.site || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const inlineSiteMatch = cleanQuery.match(/\bsite:([a-z0-9.-]+\.[a-z]{2,})\b/i);
  if (!targetSite && inlineSiteMatch) {
    targetSite = inlineSiteMatch[1].toLowerCase();
  }

  const effectiveQuery =
    targetSite && !/\bsite:/i.test(cleanQuery) ? `site:${targetSite} ${cleanQuery}` : cleanQuery;

  const category = ['general', 'news', 'science', 'images'].includes(options.category)
    ? options.category
    : 'general';
  const timeRange = ['day', 'week', 'month', 'year'].includes(options.timeRange) ? options.timeRange : '';
  const page = Math.max(1, Math.min(20, Number(options.page) || 1));
  const limit = Math.max(1, Math.min(30, Number(options.limit) || 12));

  const cacheKey = JSON.stringify({ q: effectiveQuery, category, timeRange, page, targetSite, engines: options.engines || '' });
  if (!options.bypassCache && !options.mockResults) {
    const cached = webCache.get('search', cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  let rawResults = [];
  let backendUsed = 'fallback-metasearch';
  let searxngOnline = false;

  if (Array.isArray(options.mockResults)) {
    rawResults = options.mockResults;
    backendUsed = 'mock';
  } else {
    // 1. Try SearXNG primary backend first
    const searxHealth = await checkSearxngHealth(options.searxngUrl);
    if (searxHealth.searxngOnline && searxHealth.endpoint) {
      try {
        rawResults = await querySearxng(searxHealth.endpoint, effectiveQuery, {
          category,
          timeRange,
          page,
          engines: options.engines,
        });
        backendUsed = `searxng (${searxHealth.endpoint})`;
        searxngOnline = true;
      } catch {
        rawResults = [];
      }
    }

    // 2. If SearXNG is unavailable or returned 0 results, run zero-key fallback metasearch
    if (rawResults.length === 0) {
      const tasks = [];
      if (category === 'images') {
        tasks.push(searchWikimediaImagesFallback(effectiveQuery, page));
        tasks.push(searchDuckDuckGoFallback(effectiveQuery, page));
      } else if (category === 'science') {
        tasks.push(searchArxivFallback(effectiveQuery, page));
        tasks.push(searchCrossrefFallback(effectiveQuery, page));
        tasks.push(searchWikipediaFallback(effectiveQuery, page));
        tasks.push(searchDuckDuckGoFallback(effectiveQuery, page));
      } else if (category === 'news') {
        tasks.push(searchHackerNewsFallback(effectiveQuery, { category: 'news', timeRange, page }));
        tasks.push(searchDuckDuckGoFallback(effectiveQuery, page));
        tasks.push(searchWikipediaFallback(effectiveQuery, page));
      } else {
        // general web metasearch across multiple engines
        tasks.push(searchDuckDuckGoFallback(effectiveQuery, page));
        tasks.push(searchWikipediaFallback(effectiveQuery, page));
        tasks.push(searchCrossrefFallback(effectiveQuery, page));
        tasks.push(searchArxivFallback(effectiveQuery, page));
        tasks.push(searchHackerNewsFallback(effectiveQuery, { category, timeRange, page }));
      }

      const settled = await Promise.allSettled(tasks);
      for (const s of settled) {
        if (s.status === 'fulfilled' && Array.isArray(s.value)) {
          rawResults.push(...s.value);
        }
      }
      backendUsed = 'fallback-metasearch';
    }
  }

  // 3. Validate URLs against SSRF, deduplicate by canonical URL, and merge engine provenance
  const dedupedMap = new Map();
  for (const item of rawResults) {
    if (!item || !item.url) continue;
    const canon = canonicalizeUrl(item.url);
    if (!canon) continue;
    try {
      validatePublicUrl(canon);
    } catch {
      // Never include private/local/invalid URLs in search results
      continue;
    }

    const domain = extractDomain(canon);
    if (targetSite && domain !== targetSite && !domain.endsWith(`.${targetSite}`)) {
      continue;
    }

    const existing = dedupedMap.get(canon);
    if (existing) {
      const enginesSet = new Set([
        ...String(existing.engine || '').split(',').filter(Boolean),
        ...String(item.engine || '').split(',').filter(Boolean),
      ]);
      existing.engine = [...enginesSet].join(',');
      existing.engines = [...enginesSet];
      if ((!existing.snippet || existing.snippet.length < (item.snippet || '').length) && item.snippet) {
        existing.snippet = item.snippet;
      }
      if (!existing.publishedDate && item.publishedDate) {
        existing.publishedDate = item.publishedDate;
      }
      if (!existing.author && item.author) {
        existing.author = item.author;
      }
    } else {
      const engines = String(item.engine || 'web')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      dedupedMap.set(canon, {
        title: String(item.title || canon).trim().slice(0, 240),
        url: canon,
        snippet: String(item.snippet || '').trim().slice(0, 500),
        domain,
        engine: engines.join(',') || 'web',
        engines,
        publishedDate: item.publishedDate || null,
        author: item.author || undefined,
        thumbnailUrl: item.thumbnailUrl || undefined,
        isAcademicAbstract: Boolean(item.isAcademicAbstract),
      });
    }
  }

  let candidates = [...dedupedMap.values()];
  if (timeRange) {
    candidates = filterByTimeRange(candidates, timeRange);
  }

  // 4. Rank and normalize into required schema
  const ranked = rankAndClassifySources(candidates, {
    query: cleanQuery,
    category,
    timeRange,
    targetSite,
  }).slice(0, limit);

  const normalizedResults = ranked.map((r, i) => ({
    id: i + 1,
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    domain: r.domain,
    engine: r.engine,
    publishedDate: r.publishedDate || null,
    score: r.score,
    sourceType: r.sourceType,
    qualityScore: r.qualityScore,
    qualityBreakdown: r.qualityBreakdown,
    author: r.author,
    thumbnailUrl: r.thumbnailUrl,
  }));

  const payload = {
    query: cleanQuery,
    effectiveQuery,
    category,
    timeRange: timeRange || null,
    page,
    site: targetSite || null,
    backend: backendUsed,
    searxngOnline,
    totalResults: normalizedResults.length,
    results: normalizedResults,
    timestamp: new Date().toISOString(),
  };

  if (!options.mockResults && normalizedResults.length > 0) {
    webCache.set('search', cacheKey, payload);
  }

  return payload;
}
