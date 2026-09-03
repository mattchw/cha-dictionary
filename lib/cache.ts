// Simple in-memory cache. On Vercel this lives only for the lifetime of a warm
// serverless instance — great for bursts, but not shared across instances or
// durable across cold starts. For a real shared cache, swap this for Vercel KV
// or Upstash Redis; keep the same get/set shape and the routes won't change.

const MAX_ENTRIES = 2000;
const store = new Map<string, unknown>();

export function cacheGet<T>(key: string): T | undefined {
  const v = store.get(key);
  if (v === undefined) return undefined;
  // touch for recency (Map preserves insertion order)
  store.delete(key);
  store.set(key, v);
  return v as T;
}

export function cacheSet<T>(key: string, value: T): void {
  if (store.has(key)) store.delete(key);
  store.set(key, value);
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
}
