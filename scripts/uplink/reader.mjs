/**
 * NOÖSPHERE // WEB UPLINK — Level 2 Page Reader & Structured Extractor
 * ============================================================================
 * Public webpage extraction with strict SSRF & redirect-hop defenses:
 *  - Validates URL & DNS before request and on every redirect hop (max 5 hops)
 *  - Enforces streaming byte limit (2 MB max) & safe MIME allowlist
 *  - Identifies canonical URL
 *  - Extracts title, author, publication date, metadata, headings, and links
 *  - Strips scripts, styles, SVGs, forms, comments, and navigation clutter
 *  - Produces clean LLM-friendly Markdown/text + chunked excerpts
 *  - Applies prompt-injection sanitization and untrusted-data tagging
 */

import {
  resolveAndValidateUrl,
  canonicalizeUrl,
  isAllowedMimeType,
  sanitizeWebTextForLLM,
  SSRFBlockedError,
} from './security.mjs';
import { extractDomain, classifyEpistemicSource, classifyDomainTier } from './quality.mjs';
import { webCache } from './cache.mjs';

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB hard limit against oversized / bomb responses
const DEFAULT_TIMEOUT_MS = 12000;
const USER_AGENT = 'Noosphere-Local-Research-Workstation/9.4 (+local-first; llama3.1:8b)';

function decodeEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, dec) => {
      const n = Number(dec);
      return n > 0 && n < 0x10ffff ? String.fromCharCode(n) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = parseInt(hex, 16);
      return n > 0 && n < 0x10ffff ? String.fromCharCode(n) : '';
    });
}

function cleanInlineText(htmlFragment) {
  if (!htmlFragment) return '';
  return decodeEntities(htmlFragment.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reads a fetch Response body stream up to maxBytes, aborting immediately if exceeded.
 */
async function readBoundedText(response, maxBytes = MAX_RESPONSE_BYTES) {
  const contentLength = Number(response.headers?.get?.('content-length') || 0);
  if (contentLength > maxBytes) {
    throw new Error(`Response Content-Length (${contentLength} B) exceeds maximum limit (${maxBytes} B)`);
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error(`Response body exceeds maximum limit (${maxBytes} B)`);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let received = 0;
  const chunks = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel('Oversized response');
          throw new Error(`Response stream exceeded maximum size limit (${maxBytes} B)`);
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    reader.releaseLock?.();
  }
}

/**
 * Extracts metadata, canonical URL, publication date, and author from raw HTML.
 */
export function extractHtmlMetadata(html, finalUrl) {
  const meta = {
    title: '',
    canonicalUrl: canonicalizeUrl(finalUrl) || finalUrl,
    publishedDate: null,
    author: null,
    description: null,
    siteName: null,
    language: null,
    keywords: [],
    scholarly: false,
  };

  const langMatch = html.match(/<html[^>]*\blang=["']([^"']+)["']/i);
  if (langMatch) meta.language = langMatch[1].trim();

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) meta.title = cleanInlineText(titleMatch[1]);

  // Canonical link tag
  const canonLink =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  if (canonLink?.[1]) {
    const resolvedCanon = canonicalizeUrl(canonLink[1], finalUrl);
    if (resolvedCanon) meta.canonicalUrl = resolvedCanon;
  }

  // Parse <meta> tags
  const metaTags = html.matchAll(/<meta\s+([^>]+)>/gi);
  for (const m of metaTags) {
    const attrs = m[1];
    const nameMatch = attrs.match(/(?:name|property|itemprop)=["']([^"']+)["']/i);
    const contentMatch = attrs.match(/content=["']([^"']*)["']/i);
    if (!nameMatch || !contentMatch) continue;
    const key = nameMatch[1].toLowerCase().trim();
    const val = cleanInlineText(contentMatch[1]);
    if (!val) continue;

    if (!meta.title && (key === 'og:title' || key === 'twitter:title' || key === 'citation_title')) {
      meta.title = val;
    }
    if (!meta.description && (key === 'description' || key === 'og:description' || key === 'twitter:description')) {
      meta.description = val;
    }
    if (!meta.siteName && (key === 'og:site_name' || key === 'application-name' || key === 'citation_journal_title')) {
      meta.siteName = val;
    }
    if (!meta.author && (key === 'author' || key === 'article:author' || key === 'citation_author' || key === 'dc.creator')) {
      meta.author = val;
    }
    if (
      !meta.publishedDate &&
      (key === 'article:published_time' ||
        key === 'datepublished' ||
        key === 'pubdate' ||
        key === 'publishdate' ||
        key === 'citation_publication_date' ||
        key === 'citation_date' ||
        key === 'dc.date' ||
        key === 'date')
    ) {
      meta.publishedDate = val.slice(0, 25);
    }
    if (key.startsWith('citation_')) {
      meta.scholarly = true;
    }
    if (key === 'keywords') {
      meta.keywords = val
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    if (key === 'og:url' && !canonLink) {
      const ogCanon = canonicalizeUrl(val, finalUrl);
      if (ogCanon) meta.canonicalUrl = ogCanon;
    }
  }

  // Check JSON-LD for Article / ScholarlyArticle / NewsArticle
  const jsonLdBlocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block[1].trim());
      const items = Array.isArray(parsed) ? parsed : parsed['@graph'] ? parsed['@graph'] : [parsed];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        if (!meta.publishedDate && (item.datePublished || item.dateCreated)) {
          meta.publishedDate = String(item.datePublished || item.dateCreated).slice(0, 25);
        }
        if (!meta.author && item.author) {
          const a = Array.isArray(item.author) ? item.author[0] : item.author;
          meta.author = typeof a === 'string' ? a : a?.name || null;
        }
        if (!meta.title && item.headline) {
          meta.title = cleanInlineText(String(item.headline));
        }
        if (String(item['@type'] || '').toLowerCase().includes('scholarly')) {
          meta.scholarly = true;
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  }

  // Fallback <time datetime="...">
  if (!meta.publishedDate) {
    const timeMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if (timeMatch?.[1]) {
      meta.publishedDate = timeMatch[1].trim().slice(0, 25);
    }
  }

  return meta;
}

/**
 * Extracts structured headings, links, and clean Markdown-formatted main text from HTML.
 */
export function extractReadableContent(html, baseUrl) {
  const baseDomain = extractDomain(baseUrl);
  const metadata = extractHtmlMetadata(html, baseUrl);

  // 1. Remove scripts, styles, comments, noscript, svg, canvas, iframe, templates, hidden blocks
  let bodyHtml = html;
  const bodyTagMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyTagMatch) bodyHtml = bodyTagMatch[1];

  bodyHtml = bodyHtml
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|canvas|iframe|object|embed|template|audio|video)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Strip hidden elements that often carry prompt-injection traps
    .replace(/<[a-z0-9-]+\b[^>]*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|\bhidden\b|\baria-hidden=["']true["'])[^>]*>[\s\S]*?<\/[a-z0-9-]+>/gi, ' ');

  // 2. Prefer <article> or <main> if it has substantial content, else strip nav/header/footer/aside
  const articleMatch = bodyHtml.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = bodyHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);

  let workingHtml = bodyHtml;
  if (articleMatch && cleanInlineText(articleMatch[1]).length > 250) {
    workingHtml = articleMatch[1];
  } else if (mainMatch && cleanInlineText(mainMatch[1]).length > 250) {
    workingHtml = mainMatch[1];
  } else {
    workingHtml = bodyHtml.replace(/<(nav|header|footer|aside|menu|dialog)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  }

  // 3. Extract headings
  const headings = [];
  for (const hMatch of workingHtml.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const level = Number(hMatch[1]);
    const text = cleanInlineText(hMatch[2]);
    if (text && text.length > 1) {
      headings.push({ level, text: text.slice(0, 200) });
      if (!metadata.title && level === 1) {
        metadata.title = text;
      }
    }
  }

  // 4. Extract links (from workingHtml first, plus key links from bodyHtml)
  const links = [];
  const seenLinkUrls = new Set();
  for (const aMatch of workingHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const rawHref = decodeEntities(aMatch[1]).trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:')) {
      continue;
    }
    const resolved = canonicalizeUrl(rawHref, baseUrl);
    if (!resolved || seenLinkUrls.has(resolved)) continue;
    const text = cleanInlineText(aMatch[2]).slice(0, 140) || resolved;
    const linkDomain = extractDomain(resolved);
    const internal = linkDomain === baseDomain || linkDomain.endsWith(`.${baseDomain}`);
    seenLinkUrls.add(resolved);
    links.push({
      text,
      url: resolved,
      domain: linkDomain,
      internal,
    });
    if (links.length >= 80) break;
  }

  // 5. Convert workingHtml into LLM-friendly Markdown/text preserving headings, links, lists, paragraphs
  let md = workingHtml
    // Convert links <a href="...">text</a> -> [text](url)
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const text = cleanInlineText(inner);
      if (!text) return '';
      const resolved = canonicalizeUrl(decodeEntities(href), baseUrl);
      return resolved ? `[${text}](${resolved})` : text;
    })
    // Convert headings <h1..h6> -> # Heading
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, inner) => {
      const text = cleanInlineText(inner);
      return text ? `\n\n${'#'.repeat(Number(lvl))} ${text}\n\n` : '';
    })
    // Convert list items
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
      const text = cleanInlineText(inner);
      return text ? `\n- ${text}` : '';
    })
    // Convert blockquotes
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
      const text = cleanInlineText(inner);
      return text ? `\n\n> ${text}\n\n` : '';
    })
    // Convert code blocks
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, '')).trim();
      return text ? `\n\n\`\`\`\n${text.slice(0, 1200)}\n\`\`\`\n\n` : '';
    })
    // Paragraph & block breaks
    .replace(/<\/(p|div|section|article|tr|table|ul|ol|dl|dd|dt)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // Strip any remaining HTML tags
  md = decodeEntities(md.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Plain readable text (without inline markdown link URLs for compact snippet display)
  const plainText = md
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim();

  return {
    metadata,
    headings,
    links,
    markdown: md,
    plainText,
  };
}

/**
 * Splits large extracted text into bounded semantic chunks for staged LLM context.
 */
export function chunkExtractedText(text, chunkSize = 1600, maxChunks = 8) {
  if (!text || typeof text !== 'string') return [];
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= chunkSize) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) {
        chunks.push(current);
        if (chunks.length >= maxChunks) return chunks;
      }
      if (para.length > chunkSize) {
        chunks.push(para.slice(0, chunkSize));
        if (chunks.length >= maxChunks) return chunks;
        current = '';
      } else {
        current = para;
      }
    }
  }
  if (current && chunks.length < maxChunks) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * Primary entry point: fetch_page(url, options)
 *
 * Follows up to MAX_REDIRECTS (5) ordinary redirects manually, validating every hop
 * against SSRF & DNS rebinding before connecting.
 */
export async function fetch_page(rawUrl, options = {}) {
  const maxChars = Math.max(500, Math.min(24000, Number(options.maxChars) || 8000));
  const timeoutMs = Math.max(2000, Math.min(25000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS));

  // Initial URL & DNS validation (throws SSRFBlockedError on localhost/LAN/metadata/bad scheme)
  const initialValidation = await resolveAndValidateUrl(rawUrl, { lookupFn: options.lookupFn });
  let currentUrl = initialValidation.url.toString();

  const cacheKey = `${canonicalizeUrl(currentUrl) || currentUrl}:${maxChars}`;
  if (!options.bypassCache && !options.fetchFn && !options.lookupFn) {
    const cached = webCache.get('page', cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  const fetchImpl = options.fetchFn ?? fetch;
  const redirectChain = [currentUrl];
  let response = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (hop > 0) {
      // Validate redirect target against SSRF and DNS rebinding BEFORE fetching
      const hopValidation = await resolveAndValidateUrl(currentUrl, { lookupFn: options.lookupFn });
      currentUrl = hopValidation.url.toString();
    }

    response = await fetchImpl(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,text/plain,text/markdown,application/json,application/xml;q=0.9',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    const status = response.status;
    if ([301, 302, 303, 307, 308].includes(status)) {
      if (hop === MAX_REDIRECTS) {
        throw new Error(`Exceeded maximum redirect hops (${MAX_REDIRECTS})`);
      }
      const location = response.headers?.get?.('location');
      if (!location) {
        throw new Error(`Redirect response (${status}) missing Location header`);
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, currentUrl).toString();
      } catch {
        throw new SSRFBlockedError('Malformed redirect Location URL', location);
      }
      // Immediately validate scheme/host of redirect target
      await resolveAndValidateUrl(nextUrl, { lookupFn: options.lookupFn });
      currentUrl = nextUrl;
      redirectChain.push(currentUrl);
      continue;
    }

    break;
  }

  if (!response) {
    throw new Error('No response received');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} when fetching ${currentUrl}`);
  }

  const contentType = response.headers?.get?.('content-type') || 'text/html';
  if (!isAllowedMimeType(contentType)) {
    throw new Error(`Disallowed or binary Content-Type "${contentType}" rejected for safety`);
  }

  const rawBody = await readBoundedText(response, options.maxBytes || MAX_RESPONSE_BYTES);
  const mime = contentType.split(';')[0].trim().toLowerCase();

  let title = '';
  let canonicalUrl = canonicalizeUrl(currentUrl) || currentUrl;
  let publishedDate = null;
  let author = null;
  let metadata = {};
  let headings = [];
  let links = [];
  let markdown = '';
  let plainText = '';

  if (mime.includes('json')) {
    title = `${extractDomain(currentUrl)} JSON Document`;
    try {
      const parsedJson = JSON.parse(rawBody);
      plainText = JSON.stringify(parsedJson, null, 2);
      markdown = `\`\`\`json\n${plainText.slice(0, maxChars)}\n\`\`\``;
    } catch {
      plainText = rawBody;
      markdown = rawBody;
    }
    metadata = { contentType: mime, canonicalUrl };
  } else if (mime === 'text/plain' || mime.includes('markdown')) {
    const firstLine = rawBody.split('\n').find((l) => l.trim().length > 0) || currentUrl;
    title = firstLine.replace(/^#+\s*/, '').trim().slice(0, 160);
    plainText = rawBody.trim();
    markdown = rawBody.trim();
    metadata = { contentType: mime, canonicalUrl };
  } else {
    const extracted = extractReadableContent(rawBody, currentUrl);
    metadata = { ...extracted.metadata, contentType: mime };
    title = metadata.title || extractDomain(currentUrl) || currentUrl;
    canonicalUrl = metadata.canonicalUrl || canonicalUrl;
    publishedDate = metadata.publishedDate || null;
    author = metadata.author || null;
    headings = extracted.headings;
    links = extracted.links;
    markdown = extracted.markdown;
    plainText = extracted.plainText;
  }

  // Sanitize extracted text against prompt injection before returning
  const sanitizedMarkdown = sanitizeWebTextForLLM(markdown, maxChars);
  const sanitizedPlain = sanitizeWebTextForLLM(plainText, maxChars);
  const chunks = chunkExtractedText(sanitizedPlain.text, 1500, 6);

  const domain = extractDomain(canonicalUrl);
  const tierInfo = classifyDomainTier(domain, options);
  const sourceType = classifyEpistemicSource(
    {
      url: canonicalUrl,
      domain,
      hasFullText: sanitizedPlain.text.length > 120,
      extractedText: sanitizedPlain.text,
      metadata,
    },
    options,
  );

  const result = {
    url: currentUrl,
    canonicalUrl,
    redirectChain,
    domain,
    title: title || canonicalUrl,
    author,
    publishedDate,
    metadata,
    headings: headings.slice(0, 40),
    links: links.slice(0, 60),
    text: sanitizedPlain.text,
    markdown: sanitizedMarkdown.text,
    excerpt: sanitizedPlain.text.slice(0, 600),
    chunks,
    charCount: sanitizedPlain.text.length,
    truncated: sanitizedPlain.truncated,
    injectionFlags: sanitizedMarkdown.injectionFlags,
    sourceType,
    domainTier: tierInfo.tier,
    retrievedAt: new Date().toISOString(),
  };

  if (!options.fetchFn && !options.lookupFn) {
    webCache.set('page', cacheKey, result);
  }

  return result;
}
