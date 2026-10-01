// From a minimised contact circuit to rules, and from rules to inferences.
//
// The cover of the contact function is a list of cubes {val, mask} over 2p bits: the high p
// bits are residue i, the low p bits residue j (plain binary positions, as in qm.js). Each
// cube is one AND gate of the circuit and, read in words, one rule:
//   "IF i is in I AND j is in J THEN residues i and j touch".
// Everything here is exact: a rule's cells are enumerated, never estimated, and the checks
// re-evaluate the circuit on every input. DOM-free (runs under Node for the tests).
import { strandPairClusters } from "./clusters.js";
import { chainSegments } from "./contacts.js";

const popcount = (x) => { x >>>= 0; let c = 0; while (x) { x &= x - 1; c++; } return c; };

/** One field of a cube: its bit pattern ('0', '1', '-' free) and the positions < L it admits. */
export function decodeField(val, mask, p, L) {
  const pattern = Array.from({ length: p }, (_, k) => { const b = p - 1 - k; return (mask >> b) & 1 ? "-" : String((val >> b) & 1); }).join("");
  const positions = [];
  for (let x = 0; x < Math.min(L, 1 << p); x++) if (((x & ~mask) >>> 0) === val) positions.push(x);
  const contiguous = (mask & (mask + 1)) === 0;                       // free bits are the low ones
  return { pattern, positions, contiguous, nFree: popcount(mask) };
}

const fieldOf = (cube, p, L, high) => {
  const m = (1 << p) - 1;
  return high ? decodeField((cube.val >>> p) & m, (cube.mask >>> p) & m, p, L) : decodeField(cube.val & m, cube.mask & m, p, L);
};

/** The circuit's terms (AND gates) with their fields, in cover order. */
export function circuitTerms(cover, p, L) {
  return cover.map((c, k) => {
    const I = fieldOf(c, p, L, true), J = fieldOf(c, p, L, false);
    return { k, val: c.val, mask: c.mask, nFree: popcount(c.mask), literals: 2 * p - popcount(c.mask), I, J };
  });
}

/** Evaluate the two-level circuit at input (i, j): the terms that fire, and the output. */
export function evaluate(terms, p, i, j) {
  const x = ((i << p) | j) >>> 0;
  const fired = terms.filter((t) => ((x & ~t.mask) >>> 0) === t.val);
  return { fired, out: fired.length > 0 };
}

/** Run the circuit on every one of the 2^(2p) inputs and compare with the contact map.
 *  Each AND gate marks the inputs it accepts (all submasks of its free bits), so the cost is
 *  the number of covered cells plus one pass over all inputs, not inputs × gates. */
export function verifyEverywhere(terms, p, L, has) {
  const N = 1 << p, out = new Uint8Array(N * N);
  for (const t of terms) { let sub = t.mask; for (;;) { out[(t.val | sub) >>> 0] = 1; if (sub === 0) break; sub = (sub - 1) & t.mask; } }
  let agree = 0, real = 0, padding = 0, ones = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const o = out[(i << p) | j] === 1, truth = i < L && j < L && i !== j && has(i, j);
    if (o === truth) agree++;
    if (i < L && j < L) real++; else padding++;
    if (o) ones++;
  }
  return { inputs: N * N, agree, real, padding, ones, exact: agree === N * N };
}

/** Rules over unordered residue pairs: each term in its canonical orientation (min I ≤ min J),
 *  mirror images merged. kind: block (≥ 4 cells, both fields unbroken), pair (2 cells),
 *  single (1 cell), strided (a field with a gap). */
export function rulesFrom(terms, has) {
  const seen = new Map();
  for (const t of terms) {
    let A = t.I, B = t.J;
    if (A.positions[0] > B.positions[0]) [A, B] = [B, A];
    const key = `${A.pattern}|${B.pattern}`;
    if (seen.has(key)) { seen.get(key).terms.push(t.k); continue; }
    const cells = [];
    for (const i of A.positions) for (const j of B.positions) if (i !== j) cells.push(i < j ? [i, j] : [j, i]);
    const uniq = [...new Map(cells.map((c) => [`${c[0]},${c[1]}`, c])).values()];
    const exceptions = uniq.filter(([i, j]) => !has(i, j)).length;
    const kind = !A.contiguous || !B.contiguous ? "strided" : t.nFree >= 2 ? "block" : t.nFree === 1 ? "pair" : "single";
    seen.set(key, { key, I: A, J: B, cells: uniq, support: uniq.length, exceptions, kind, nFree: t.nFree, literals: t.literals, terms: [t.k] });
  }
  return [...seen.values()].sort((a, b) => b.support - a.support || a.I.positions[0] - b.I.positions[0] || a.J.positions[0] - b.J.positions[0]);
}

/** Do the rules, together, say exactly the contact map? */
export function checkRules(rules, pairs) {
  const covered = new Set();
  for (const r of rules) for (const [i, j] of r.cells) covered.add(`${i},${j}`);
  const missed = pairs.filter(([i, j]) => !covered.has(`${Math.min(i, j)},${Math.max(i, j)}`)).length;
  const exceptions = rules.reduce((n, r) => n + r.exceptions, 0);
  return { complete: missed === 0, sound: exceptions === 0, missed, exceptions, contacts: pairs.length };
}

/** A position set as text: "24–27", "11, 15, 75, 79", or "24–27 (step …)". */
export function setText(positions, max = 8) {
  if (!positions.length) return "∅";
  const contiguous = positions.every((x, k) => k === 0 || x === positions[k - 1] + 1);
  if (contiguous) return positions.length === 1 ? `${positions[0]}` : `${positions[0]}–${positions.at(-1)}`;
  return positions.length <= max ? positions.join(", ") : `${positions.slice(0, max).join(", ")}, … (${positions.length})`;
}

// ── inferences ──────────────────────────────────────────────────────────────

const WC = new Set(["AT", "TA", "AU", "UA", "CG", "GC"]), WOBBLE = new Set(["GU", "UG"]);
const span = (xs) => Math.max(...xs) - Math.min(...xs);

/** Strand pairs from block rules, with direction and register. chain: {residues, entityType, strands?}.
 *  The rule, stated on the page: one block is a rectangle and has no direction ("short"); for two or
 *  more blocks, the pair is antiparallel when i + j varies less than j − i across all its contacts,
 *  parallel when j − i varies less, "mixed" when both vary equally. Both ranges are reported. */
export function inferences(rules, chain, has) {
  const blocks = rules.filter((r) => r.kind === "block").map((r) => ({ i0: r.I.positions[0], i1: r.I.positions.at(-1) + 1, j0: r.J.positions[0], j1: r.J.positions.at(-1) + 1, rule: r }));
  const clusters = strandPairClusters(blocks, has);
  const { strand, seq } = chainSegments(chain);
  const strandId = (k) => (chain.strands ? chain.strands[strand[k]]?.id ?? null : null);
  return clusters.map((c) => {
    const sums = c.pairs.map(([i, j]) => i + j), diffs = c.pairs.map(([i, j]) => j - i);
    const sumRange = { lo: Math.min(...sums), hi: Math.max(...sums) }, diffRange = { lo: Math.min(...diffs), hi: Math.max(...diffs) };
    const ss = span(sums), sd = span(diffs);
    const orientation = c.blocks.length < 2 ? "short" : ss < sd ? "antiparallel" : sd < ss ? "parallel" : "mixed";
    const register = orientation === "antiparallel" ? { kind: "i + j", ...sumRange } : orientation === "parallel" ? { kind: "j − i", ...diffRange } : null;
    const sameStrand = strand[c.i0] === strand[c.j0];
    // residues between the two segments, by sequence number (unmodelled residues count)
    const gap = sameStrand ? seq[c.j0] - seq[c.i1 - 1] - 1 : null;
    return { ...c, rules: c.blocks.map((b) => blocks[b].rule), orientation, register, sumRange, diffRange, gap,
      strands: [strandId(c.i0), strandId(c.j0)], hairpin: orientation === "antiparallel" && sameStrand && gap >= 0 && gap <= 8 };
  });
}

// ── export ──────────────────────────────────────────────────────────────────

export function toPLA(terms, p, name = "contact") {
  const names = [...Array.from({ length: p }, (_, k) => `i${p - 1 - k}`), ...Array.from({ length: p }, (_, k) => `j${p - 1 - k}`)];
  const rows = terms.map((t) => `${t.I.pattern}${t.J.pattern} 1`);
  return [`# ${name}: minimised contact function, ${terms.length} terms (exact cover: sound and complete)`, `.i ${2 * p}`, ".o 1", `.ilb ${names.join(" ")}`, ".ob C", `.p ${terms.length}`, ...rows, ".e", ""].join("\n");
}
export function toVerilog(terms, p, name = "contact") {
  const lit = (pat, f) => [...pat].map((ch, k) => (ch === "-" ? null : `${ch === "0" ? "~" : ""}${f}[${p - 1 - k}]`)).filter(Boolean);
  const prods = terms.map((t) => { const l = [...lit(t.I.pattern, "i"), ...lit(t.J.pattern, "j")]; return l.length ? `(${l.join(" & ")})` : "1'b1"; });
  return [`// ${name}: C(i, j) = 1 iff residues i and j touch. ${terms.length} AND terms, one OR. Exact.`,
    `module ${/^[A-Za-z_]/.test(name) ? name.replace(/\W/g, "_") : `pdb_${name.replace(/\W/g, "_")}`} (input [${p - 1}:0] i, input [${p - 1}:0] j, output C);`,
    `  assign C = ${prods.length ? prods.join("\n           | ") : "1'b0   // no contacts: the constant 0"};`, "endmodule", ""].join("\n");
}

/** Base pairs by geometry (nucleic acids only): a purine N1 within `cutoff` Å of a pyrimidine
 *  N3, the central Watson–Crick hydrogen bond. Returns pairs and stems (runs of stacked pairs
 *  (i, j), (i+1, j−1), …). Exact: every pair is a measured distance under a stated cutoff. */
export function basePairs(chain, cutoff = 3.5) {
  const R = chain.residues, pur = (l) => l === "A" || l === "G", pyr = (l) => l === "C" || l === "T" || l === "U";
  const { strand, seq } = chainSegments(chain);
  const pairs = [];
  // same strand: at least 3 unpaired nucleotides between partners (the shortest hairpin loop), by
  // sequence number; that also rules out stacked neighbours, whose N1 and N3 can sit 3.4 Å apart
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    if (strand[i] === strand[j] && seq[j] - seq[i] < 4) continue;
    const a = R[i], b = R[j], la = a.one, lb = b.one;
    let u = null, v = null;
    if (pur(la) && pyr(lb)) { u = a.atoms.N1; v = b.atoms.N3; } else if (pyr(la) && pur(lb)) { u = a.atoms.N3; v = b.atoms.N1; }
    if (!u || !v) continue;
    const d = Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);
    if (d < cutoff) pairs.push({ i, j, letters: la + lb, d, wc: WC.has(la + lb), wobble: WOBBLE.has(la + lb) });
  }
  const key = (i, j) => `${i},${j}`, at = new Map(pairs.map((q) => [key(q.i, q.j), q]));
  const stems = [], used = new Set();
  for (const q of pairs) {
    if (used.has(key(q.i, q.j)) || at.has(key(q.i - 1, q.j + 1))) continue;     // start of a run
    const run = []; let i = q.i, j = q.j;
    while (at.has(key(i, j))) { run.push(at.get(key(i, j))); used.add(key(i, j)); i++; j--; }
    stems.push(run);
  }
  stems.sort((x, y) => y.length - x.length || x[0].i - y[0].i);
  return { pairs, stems, cutoff };
}
