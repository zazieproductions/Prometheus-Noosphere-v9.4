/**
 * NOÖSPHERE // OS — SYNAPSE SHELL local-origin gate
 * ============================================================
 * The host shell is a real PTY running as the account that started NOÖSPHERE.
 * The browser UI is served on `0.0.0.0` so the sandbox/preview workflow keeps
 * working, therefore *the network is the trust boundary*, not the port.
 *
 * This module answers exactly one question: "did this request genuinely
 * originate from the same machine, or from a browser tab somebody remote can
 * reach?" Four independent signals must agree before a shell request is served:
 *
 *   1. TCP peer is a loopback address           — no routed traffic
 *   2. Host header names a loopback host        — not a proxy/public hostname
 *   3. Origin (when present) matches that host  — no cross-site WS hijack
 *   4. No forwarding headers, and Sec-Fetch-Site (when present) is same-origin
 *
 * Any signal that disagrees produces `local: false`; the caller then refuses to
 * service the request. There is no code path where "unknown" means "allowed".
 *
 * Deliberate non-features: no CORS headers are ever emitted for shell routes,
 * and no cookie/token is minted automatically. The single opt-in escape hatch
 * (`--shell-remote-token`) requires the operator to choose a secret on the
 * command line; it is never on by default and is used by nothing in this repo.
 */

import { timingSafeEqual as cryptoEq } from 'node:crypto';

/** Loopback peers, including IPv4-mapped IPv6 as Node reports it. */
export const LOOPBACK_PEERS = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  '::ffff:7f00:1',
]);

/** Headers that only ever appear when something is proxying the connection. */
const FORWARDING_HEADERS = [
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
  'x-real-ip',
  'x-client-ip',
  'cf-connecting-ip',
  'cf-connecting-ipv6',
  'cf-ray',
  'true-client-ip',
  'fastly-client-ip',
  'fly-client-ip',
  'x-vercel-forwarded-for',
  'x-azure-clientip',
  'x-amzn-trace-id',
  'x-envoy-external-address',
];

/** Hostnames that mean "this machine" and nothing else. */
const isLoopbackHostname = (hostname) => {
  if (!hostname) return false;
  const name = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (name === 'localhost' || name.endsWith('.localhost')) return true;
  if (name === '::1') return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
  return Boolean(v4) && v4[1] === '127';
};

const hostnameOf = (hostHeader) => {
  if (!hostHeader) return '';
  const value = String(hostHeader).trim();
  if (value.startsWith('[')) return value.slice(0, value.indexOf(']') + 1);
  return value.split(':')[0];
};

/** `sec-fetch-site` is sent by every current browser; `none` = address-bar load. */
const fetchSiteAllows = (value) => {
  if (value === undefined) return true; // non-browser client (curl, tests, tools)
  const site = String(value).toLowerCase();
  return site === 'same-origin' || site === 'none';
};

/** Constant-time string compare; length mismatch short-circuits to `false`. */
const timingSafeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length || left.length === 0) return false;
  try { return cryptoEq(left, right); } catch { return false; }
};

/** Present-but-untrusted token from either `?token=` or an Authorization header. */
const presentedToken = (req, url) => {
  const query = url.searchParams.get('token');
  if (query) return query;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && /^bearer\s+/i.test(auth)) return auth.replace(/^bearer\s+/i, '').trim();
  return '';
};

/**
 * Classify a request.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {URL} url
 * @param {{ remoteToken?: string|null }} [options] operator-provided secret enabling remote access
 * @returns {{ allowed: boolean, local: boolean, reason: string }}
 */
export const classify = (req, url, options = {}) => {
  const peer = req.socket?.remoteAddress ?? '';
  const host = req.headers.host ?? '';
  const origin = req.headers.origin;

  if (options.remoteToken) {
    const presented = presentedToken(req, url);
    if (presented && timingSafeEqual(presented, options.remoteToken)) {
      return { allowed: true, local: false, reason: 'remote-token' };
    }
  }

  if (!LOOPBACK_PEERS.has(peer)) return { allowed: false, local: false, reason: 'peer-not-loopback' };
  if (!isLoopbackHostname(hostnameOf(host))) return { allowed: false, local: false, reason: 'host-not-loopback' };
  if (origin) {
    let originHost = '';
    try { originHost = new URL(origin).host; } catch { return { allowed: false, local: false, reason: 'origin-unparseable' }; }
    if (originHost !== host) return { allowed: false, local: false, reason: 'origin-mismatch' };
  }
  for (const header of FORWARDING_HEADERS) {
    if (req.headers[header] !== undefined) return { allowed: false, local: false, reason: `forwarded-header:${header}` };
  }
  if (!fetchSiteAllows(req.headers['sec-fetch-site'])) {
    return { allowed: false, local: false, reason: 'sec-fetch-site-cross-site' };
  }
  return { allowed: true, local: true, reason: 'loopback' };
};

/** Convenience wrapper: strict "same machine only", no escape hatch. */
export const classifyStrict = (req, url) => classify(req, url, {});
