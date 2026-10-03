/**
 * NOÖSPHERE // WEB UPLINK — Bounded Ephemeral + Disk Cache
 * ============================================================================
 * Keeps storage low:
 *  - In-memory LRU cache (max 60 entries, max 2 MB)
 *  - Bounded disk cache in .noosphere-cache/web-cache.json (max 40 entries, max 1.5 MB)
 *  - TTL expiration (default 15 minutes)
 *  - Explicit clearCache() action exposed to UI and CLI
 */

import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE_DIR = join(ROOT, '.noosphere-cache');
const DISK_CACHE_FILE = join(CACHE_DIR, 'web-cache.json');

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_MEM_ENTRIES = 60;
const MAX_DISK_ENTRIES = 40;
const MAX_DISK_BYTES = 1_500_000; // 1.5 MB ceiling
const MAX_SINGLE_VALUE_BYTES = 120_000; // 120 KB per cached entry

class BoundedWebCache {
  constructor() {
    this.mem = new Map();
    this.hits = 0;
    this.misses = 0;
    this._loadDisk();
  }

  _hashKey(namespace, key) {
    return `${namespace}:${createHash('sha256').update(String(key)).digest('hex').slice(0, 24)}`;
  }

  _loadDisk() {
    try {
      if (!existsSync(DISK_CACHE_FILE)) return;
      const raw = readFileSync(DISK_CACHE_FILE, 'utf8');
      if (Buffer.byteLength(raw, 'utf8') > MAX_DISK_BYTES) {
        rmSync(DISK_CACHE_FILE, { force: true });
        return;
      }
      const parsed = JSON.parse(raw);
      const now = Date.now();
      if (Array.isArray(parsed?.entries)) {
        for (const item of parsed.entries) {
          if (item && item.k && item.expiresAt > now) {
            this.mem.set(item.k, {
              value: item.v,
              storedAt: item.storedAt || now,
              expiresAt: item.expiresAt,
              bytes: item.bytes || 0,
            });
          }
        }
      }
    } catch {
      // Ignore corrupt cache
    }
  }

  _persistDisk() {
    try {
      const now = Date.now();
      const valid = [];
      let totalBytes = 0;
      const entries = [...this.mem.entries()].reverse(); // newest first
      for (const [k, entry] of entries) {
        if (entry.expiresAt <= now) continue;
        if (valid.length >= MAX_DISK_ENTRIES) break;
        if (totalBytes + entry.bytes > MAX_DISK_BYTES) break;
        valid.push({
          k,
          v: entry.value,
          storedAt: entry.storedAt,
          expiresAt: entry.expiresAt,
          bytes: entry.bytes,
        });
        totalBytes += entry.bytes;
      }
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(
        DISK_CACHE_FILE,
        JSON.stringify({ updatedAt: new Date(now).toISOString(), entries: valid.reverse() }),
      );
    } catch {
      // Non-fatal if disk is read-only
    }
  }

  get(namespace, key) {
    const k = this._hashKey(namespace, key);
    const entry = this.mem.get(k);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.mem.delete(k);
      this.misses++;
      return null;
    }
    // Refresh LRU order
    this.mem.delete(k);
    this.mem.set(k, entry);
    this.hits++;
    return entry.value;
  }

  set(namespace, key, value, ttlMs = DEFAULT_TTL_MS) {
    try {
      const serialized = JSON.stringify(value);
      const bytes = Buffer.byteLength(serialized, 'utf8');
      if (bytes > MAX_SINGLE_VALUE_BYTES) return false;

      const k = this._hashKey(namespace, key);
      const now = Date.now();
      if (this.mem.has(k)) this.mem.delete(k);
      while (this.mem.size >= MAX_MEM_ENTRIES) {
        const oldestKey = this.mem.keys().next().value;
        if (!oldestKey) break;
        this.mem.delete(oldestKey);
      }
      this.mem.set(k, {
        value: JSON.parse(serialized),
        storedAt: now,
        expiresAt: now + ttlMs,
        bytes,
      });
      this._persistDisk();
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    const clearedEntries = this.mem.size;
    this.mem.clear();
    this.hits = 0;
    this.misses = 0;
    try {
      rmSync(DISK_CACHE_FILE, { force: true });
    } catch {
      // ignore
    }
    return { cleared: true, clearedEntries, timestamp: new Date().toISOString() };
  }

  stats() {
    const now = Date.now();
    let totalBytes = 0;
    let activeEntries = 0;
    for (const [k, entry] of this.mem.entries()) {
      if (entry.expiresAt <= now) {
        this.mem.delete(k);
      } else {
        activeEntries++;
        totalBytes += entry.bytes || 0;
      }
    }
    return {
      entries: activeEntries,
      maxEntries: MAX_MEM_ENTRIES,
      bytes: totalBytes,
      maxBytes: MAX_DISK_BYTES,
      hits: this.hits,
      misses: this.misses,
      ttlMinutes: Math.round(DEFAULT_TTL_MS / 60000),
    };
  }
}

export const webCache = new BoundedWebCache();
