/**
 * NOÖSPHERE // OS — local inference client
 * ============================================================
 * Thin wrapper over the Ollama HTTP API. Every call is restricted to a loopback
 * address; NOOSPHERE_OLLAMA_URL may select a different local port/address, but
 * remote hosts and cloud inference are rejected.
 */

export const MODEL = 'llama3.1:8b';

export const baseUrl = () => {
  const raw = process.env.NOOSPHERE_OLLAMA_URL ?? 'http://127.0.0.1:11434';
  let url;
  try { url = new URL(raw); }
  catch { throw new Error('Ollama URL must be a valid loopback URL'); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname.toLowerCase());
  if (!loopback || url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Ollama is local-only; configure an HTTP loopback URL with no credentials or path');
  }
  return url.origin;
};

/** POST /api/chat — non-streaming, JSON response. */
export const chat = async ({ messages, model = MODEL, timeoutMs = 120_000, format = null, temperature = 0.3 }) => {
  const body = {
    model,
    stream: false,
    messages,
    options: { temperature },
    ...(format ? { format } : {}),
  };
  const response = await fetch(`${baseUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`ollama /api/chat → ${response.status}`);
  const result = await response.json();
  const content = result?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('empty model response');
  return { content, model: result?.model ?? model, raw: result };
};

export const listModels = async (timeoutMs = 3000) => {
  const response = await fetch(`${baseUrl()}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`ollama /api/tags → ${response.status}`);
  const tags = await response.json();
  return Array.isArray(tags?.models) ? tags.models.map((entry) => entry.name ?? entry.model) : [];
};

export const hasModel = async (model = MODEL, timeoutMs = 3000) => {
  try {
    return (await listModels(timeoutMs)).some((name) => name === model || name.startsWith(`${model}:`));
  } catch {
    return false;
  }
};

/**
 * Extract the first balanced JSON object from a model reply.
 * Small local models occasionally wrap JSON in prose or fences; that should
 * degrade to "unparseable", never to a crash.
 */
export const extractJson = (text) => {
  const source = String(text).replace(/```(?:json)?/g, '');
  const start = source.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
};
