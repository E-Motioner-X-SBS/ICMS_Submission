// Precomputed results for the bundled examples (data/examples/, written by
// tools/precompute-examples.mjs). A cached result is used only when its fingerprint matches the
// contacts or codes the app has just computed itself; anything else is computed live.

/** FNV-1a over a length and a list of numbers or number pairs: a cheap identity check. */
export function fingerprint(n, list) {
  let h = 0x811c9dc5 ^ n;
  const mix = (v) => { h ^= v & 0xffff; h = Math.imul(h, 0x01000193); h ^= v >>> 16; h = Math.imul(h, 0x01000193); };
  for (const x of list) { if (Array.isArray(x)) { mix(x[0]); mix(x[1]); } else mix(x); }
  return (h >>> 0).toString(16) + "-" + list.length;
}

let indexP = null;
const files = new Map();
/** The cached record for a chain uid, or null (never throws: offline or missing → null). */
export async function cachedExample(uid) {
  try {
    if (typeof fetch !== "function") return null;
    indexP ??= fetch(new URL("../../data/examples/index.json", import.meta.url)).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
    const file = (await indexP)[uid];
    if (!file) return null;
    if (!files.has(file)) files.set(file, fetch(new URL(`../../data/examples/${file}`, import.meta.url)).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    return await files.get(file);
  } catch { return null; }
}
