// Exact Quine-McCluskey, ported from co-evolution-analysis/scripts/sequence_circuits.py
// (prime_implicants, _essential_and_greedy_cover, verify_cover, implicant_to_segments,
// contact_circuit_positional, seq_circuit_positional). Same conventions, same order:
//   an implicant is { val, mask } over nVars bits; a set mask bit is a free variable;
//   it covers minterm m iff (m & ~mask) === val.
// Primes are returned sorted by (val, mask) like Python's sorted(), because the greedy
// cover breaks ties by index; that is what makes the numbers match the campaign.
// No DOM here: runs on the main thread, in a Web Worker, and under Node for tests.

const popcount = (x) => { x >>>= 0; let c = 0; while (x) { x &= x - 1; c++; } return c; };

/** Exact prime implicants of the function with on-set `on` and don't-cares `dc`.
 *  onRound(k, nTerms, nPrimesSoFar) is called after every merge round. */
export function primeImplicants(on, dc, nVars, onRound) {
  const full = nVars >= 32 ? 0xffffffff : (1 << nVars) - 1;
  let current = new Map();                                  // key "val/mask" -> [val, mask]
  for (const m of on) current.set(`${m}/0`, [m >>> 0, 0]);
  for (const m of dc || []) current.set(`${m}/0`, [m >>> 0, 0]);
  const primes = new Map();
  let round = 0;
  while (current.size) {
    // buckets keyed by mask then popcount(val)
    const buckets = new Map();
    for (const [v, mask] of current.values()) {
      const key = `${mask}|${popcount(v)}`;
      let b = buckets.get(key); if (!b) buckets.set(key, (b = []));
      b.push(v);
    }
    const next = new Map(), used = new Set();
    for (const [key, vals] of buckets) {
      const [mask, pc] = key.split("|").map(Number);
      const partners = buckets.get(`${mask}|${pc + 1}`);
      if (!partners) continue;
      const pset = new Set(partners);
      const free = ~mask & full;
      for (const v of vals) {
        let b = free & ~v;
        while (b) {
          const low = b & -b;
          const w = (v | low) >>> 0;
          if (pset.has(w)) {
            const nv = (v & ~low) >>> 0, nm = (mask | low) >>> 0;
            next.set(`${nv}/${nm}`, [nv, nm]);
            used.add(`${v}/${mask}`); used.add(`${w}/${mask}`);
          }
          b = (b ^ low) >>> 0;
        }
      }
    }
    for (const [k, t] of current) if (!used.has(k)) primes.set(k, t);
    current = next;
    round++;
    if (onRound) onRound(round, current.size, primes.size);
  }
  return [...primes.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([val, mask]) => ({ val, mask }));
}

export const covers = (pi, m) => ((m & ~pi.mask) >>> 0) === pi.val;
export const nFree = (pi) => popcount(pi.mask);

/** Essential primes + greedy completion (max newly covered, first index on ties). */
export function minimalCover(pis, on) {
  if (!on.length) return { cover: [], essentials: [] };
  const words = (on.length + 31) >>> 5;
  const pos = new Map(on.map((m, k) => [m, k]));
  const masks = pis.map((pi) => {
    const bs = new Uint32Array(words);
    // enumerate the cube's minterms (cheaper than scanning `on` for large cubes)
    const freeBits = []; for (let b = 0; b < 32; b++) if ((pi.mask >>> b) & 1) freeBits.push(b);
    if (freeBits.length <= 12) {
      for (let k = 0; k < 1 << freeBits.length; k++) {
        let m = pi.val;
        for (let t = 0; t < freeBits.length; t++) if ((k >> t) & 1) m |= 1 << freeBits[t];
        const idx = pos.get(m >>> 0); if (idx !== undefined) bs[idx >>> 5] |= 1 << (idx & 31);
      }
    } else {
      on.forEach((m, idx) => { if (covers(pi, m)) bs[idx >>> 5] |= 1 << (idx & 31); });
    }
    return bs;
  });
  const count = new Int32Array(on.length), last = new Int32Array(on.length).fill(-1);
  masks.forEach((bs, idx) => {
    for (let wi = 0; wi < words; wi++) { let w = bs[wi]; while (w) { const low = w & -w; const k = (wi << 5) + (31 - Math.clz32(low)); count[k]++; last[k] = idx; w ^= low; } }
  });
  const essentialIdx = new Set();
  for (let k = 0; k < on.length; k++) if (count[k] === 1) essentialIdx.add(last[k]);
  const chosen = new Set(essentialIdx);
  const remaining = new Uint32Array(words);
  for (let k = 0; k < on.length; k++) remaining[k >>> 5] |= 1 << (k & 31);
  const clear = (bs) => { for (let wi = 0; wi < words; wi++) remaining[wi] &= ~bs[wi]; };
  for (const idx of essentialIdx) clear(masks[idx]);
  const left = () => { for (let wi = 0; wi < words; wi++) if (remaining[wi]) return true; return false; };
  while (left()) {
    let best = -1, bestGain = 0;
    for (let idx = 0; idx < masks.length; idx++) {
      if (chosen.has(idx)) continue;
      let gain = 0; const bs = masks[idx];
      for (let wi = 0; wi < words; wi++) gain += popcount(bs[wi] & remaining[wi]);
      if (gain > bestGain) { best = idx; bestGain = gain; }
    }
    if (best < 0) break;
    chosen.add(best); clear(masks[best]);
  }
  const sortIdx = (s) => [...s].sort((a, b) => a - b);
  return { cover: sortIdx(chosen).map((i) => pis[i]), essentials: sortIdx(essentialIdx).map((i) => pis[i]) };
}

/** (complete, sound): every on-cell covered; no cube leaves `allowed` (on ∪ dc). */
export function verifyCover(cover, on, allowed) {
  const complete = on.every((m) => cover.some((pi) => covers(pi, m)));
  let sound = true;
  outer: for (const pi of cover) {
    const freeBits = []; for (let b = 0; b < 32; b++) if ((pi.mask >>> b) & 1) freeBits.push(b);
    for (let k = 0; k < 1 << freeBits.length; k++) {
      let m = pi.val; for (let t = 0; t < freeBits.length; t++) if ((k >> t) & 1) m |= 1 << freeBits[t];
      if (!allowed.has(m >>> 0)) { sound = false; break outer; }
    }
  }
  return { complete, sound };
}

export const posBits = (length) => Math.max(1, Math.ceil(Math.log2(Math.max(length, 2))));

/** Contact map as a Boolean function of plain-binary position bits (i-field, j-field).
 *  Off everywhere outside the on-set (band_as_dc=False, pad_as_dc=False in the campaign). */
export function contactFunction(pairs, length) {
  const p = posBits(length);
  const set = new Set(), on = [];
  for (const [a, b] of pairs) {
    const i = Math.min(a, b), j = Math.max(a, b);
    if (i >= length || j >= length) continue;
    for (const m of [(i << p) | j, (j << p) | i]) if (!set.has(m)) { set.add(m); on.push(m); }
  }
  return { p, nVars: 2 * p, on, allowed: set };
}

/** Decode a contact-map implicant into its two chain segments (half-open, clipped). */
export function implicantToSegments(pi, p, length) {
  const field = (shift) => {
    const fm = (pi.mask >>> shift) & ((1 << p) - 1), v = (pi.val >>> shift) & ((1 << p) - 1);
    const free = popcount(fm), lowFree = (fm & (fm + 1)) === 0;
    const start = v & ~fm & ((1 << p) - 1);
    return { start, end: lowFree ? Math.min(start + (1 << free), length) : null, nFree: free, contiguous: lowFree };
  };
  return { i: field(p), j: field(0), nFree: popcount(pi.mask), size: 1 << popcount(pi.mask) };
}

/** Full contact-map analysis: primes, cover, checks, blocks (as in _contact_stats). */
export function analyseContacts(pairs, length, onRound) {
  const f = contactFunction(pairs, length);
  const primes = primeImplicants(f.on, [], f.nVars, onRound);
  const { cover, essentials } = minimalCover(primes, f.on);
  const { complete, sound } = verifyCover(cover, f.on, f.allowed);
  const segs = cover.map((pi) => ({ pi, ...implicantToSegments(pi, f.p, length) }));
  const isBlock = (s) => s.i.contiguous && s.j.contiguous && s.nFree >= 2;
  const blockSegs = segs.filter(isBlock);
  const inBlocks = blockSegs.reduce((n, s) => n + s.size, 0);          // campaign metric: sums cube sizes
  // exact: the distinct contacts (unordered pairs) that lie in at least one block cube
  const inBlockSet = new Set();
  for (const s of blockSegs) for (let i = s.i.start; i < s.i.end; i++) for (let j = s.j.start; j < s.j.end; j++) inBlockSet.add(i < j ? i * length + j : j * length + i);
  // blocks over unordered residue pairs: a cube below the diagonal is mirrored above it, and a
  // cube whose mirror is also in the cover is listed once (the greedy cover need not be symmetric)
  const m = (1 << f.p) - 1, byKey = new Map();
  for (const s of blockSegs) {
    const up = s.i.start <= s.j.start;
    const [I, J] = up ? [s.i, s.j] : [s.j, s.i];
    const val = up ? s.pi.val : (((s.pi.val & m) << f.p) | (s.pi.val >>> f.p)) >>> 0;
    const mask = up ? s.pi.mask : (((s.pi.mask & m) << f.p) | (s.pi.mask >>> f.p)) >>> 0;
    const key = `${I.start},${I.end},${J.start},${J.end}`;
    if (!byKey.has(key)) byKey.set(key, { i0: I.start, i1: I.end, j0: J.start, j1: J.end, size: s.size, nFree: s.nFree, fi: I.nFree, fj: J.nFree, val, mask });
  }
  const blocks = [...byKey.values()].sort((a, b) => b.size - a.size || a.i0 - b.i0 || a.j0 - b.j0);
  return {
    p: f.p, nVars: f.nVars, nOn: f.on.length, nPrimes: primes.length, nCover: cover.length, nEssential: essentials.length,
    complete, sound, blocks, nBlockCubes: blockSegs.length, fracInBlocks: inBlocks / Math.max(1, f.on.length),
    contactsInBlocks: inBlockSet.size, fracContactsInBlocks: inBlockSet.size / Math.max(1, f.on.length / 2),
    compression: f.on.length / Math.max(1, cover.length), cover: segs.map((s) => ({ val: s.pi.val, mask: s.pi.mask, nFree: s.nFree })),
  };
}

/** Seeded RNG (mulberry32) so shuffles are reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Separation-preserving shuffle, a faithful port of _shuffle_within_sep_bands: for every
 *  separation value, draw that many distinct start positions without replacement.
 *  Preserves the number of contacts and the full |i-j| distribution; destroys which
 *  residues touch. */
export function shuffleWithinSeparation(pairs, length, random) {
  const bySep = new Map();
  for (const [a, b] of pairs) { const s = Math.abs(a - b); bySep.set(s, (bySep.get(s) || 0) + 1); }
  const out = [];
  for (const [sep, k] of bySep) {
    const n = length - sep; if (n <= 0) continue;
    const starts = Array.from({ length: n }, (_, x) => x), take = Math.min(k, n);
    for (let t = 0; t < take; t++) {                       // partial Fisher-Yates
      const r = t + Math.floor(random() * (n - t));
      [starts[t], starts[r]] = [starts[r], starts[t]];
      out.push([starts[t], starts[t] + sep]);
    }
  }
  return out;
}

/** Sequence as a circuit: f_s(i, a) = 1 iff residue i has code a (positions p bits, codes w bits). */
export function sequenceCircuit(codes, w) {
  const p = posBits(codes.length);
  const on = codes.map((a, i) => ((i << w) | a) >>> 0);
  const primes = primeImplicants(on, [], p + w);
  const { cover } = minimalCover(primes, on);
  const { complete, sound } = verifyCover(cover, on, new Set(on));
  const residueFree = cover.filter((pi) => (pi.mask & ((1 << w) - 1)) !== 0).length;   // must be 0
  // read the sequence back: every position must be covered by cubes naming exactly one code
  const back = codes.map((_, i) => {
    const hits = new Set();
    for (const pi of cover) for (let a = 0; a < 1 << w; a++) if (covers(pi, ((i << w) | a) >>> 0)) hits.add(a);
    return hits.size === 1 ? [...hits][0] : null;
  });
  return { p, w, nOn: on.length, nPrimes: primes.length, nCover: cover.length, complete, sound, residueFree,
    lossless: back.every((a, i) => a === codes[i]), back, cover };
}
