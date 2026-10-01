// The theorem registry and its browser re-checks.
//
// The site shows each of the 131 theorems as its mathematical statement (statements.js, rendered
// from tools/statements.txt); no Lean code is published. This file adds, for each theorem: a
// plain-language meaning, the chapters that show it, and a check() that re-runs the theorem's
// finite statement case by case in JavaScript, the same cases the proof evaluated.
//
// Honesty rules (the UI must keep them):
//   scope 'all-cases'  the check evaluates every case of the statement.
//   scope 'closed'     the statement has no variables; the check evaluates it once
//                      (cases = number of conjuncts or of elements counted).
//   scope 'witness'    an ∃ statement; the check finds / confirms a witness.
//   scope 'bounded'    the theorem holds for ALL natural numbers (proved by case analysis); the
//                      browser can only re-run a bounded box, and says so.
// A browser check is a re-computation, not a proof. The proofs are in the private Lean development.
//
// No DOM access here: this module also runs under Node for the test harness.

import { THEOREM_META, TOPICS } from "./theorem-meta.js";
import { STATEMENTS, NOTATION } from "./statements.js";
import { kmerCode, kmapCell, kmapShape, NUC_RAW, AA_RAW } from "./encoding.js";   // the site's own tables, checked against the statements

// ─────────────────────────────────────────────────────────────────────────────
// The definitions the statements use, in JavaScript (same arithmetic)
// ─────────────────────────────────────────────────────────────────────────────
const grayNat = (n) => n ^ (n >>> 1);                               // g(n) = n ⊕ ⌊n/2⌋
const oneBitDiff = (a, b) => { const d = a ^ b; return d !== 0 && (d & (d - 1)) === 0; }; // a ⊕ b is a power of two
const hammingDist = (a, b) => {                                    // bits in which a and b differ
  let x = a ^ b, count = 0;
  while (x !== 0) { count += x % 2; x = Math.floor(x / 2); }
  return count;
};
const grayInverse = (g) => { let v = g; v ^= v >>> 1; v ^= v >>> 2; v ^= v >>> 4; return v; };
const natSub = (a, b) => (a > b ? a - b : 0);                       // Nat subtraction truncates at 0

// DNA letters A C G T and their codes
const NUC = ["A", "C", "G", "T"];
const encodeNuc = { A: 0, C: 1, G: 3, T: 2 };
const nucRow = { A: 0, C: 0, G: 1, T: 1 };
const nucCol = { A: 0, C: 1, G: 1, T: 0 };
const nucCell = (n) => nucRow[n] * 2 + nucCol[n];

// The 20 amino acids in group order; a letter's code is its position in that order
const AA = ["A", "V", "L", "I", "F", "Y", "W", "M", "C", "P", "G", "S", "T", "N", "Q", "D", "E", "H", "K", "R"];
const encodeAA = Object.fromEntries(AA.map((a, i) => [a, i]));
const encodeGray = (a) => grayNat(encodeAA[a]);
const hdAA = (a, b) => hammingDist(encodeGray(a), encodeGray(b));

// The 8-residue example map and its cells
function contactMap8(i, j) {
  if (i === 0 && j === 3) return true;
  else if (i === 3 && j === 0) return true;
  else if (i === 1 && j === 4) return true;
  else if (i === 4 && j === 1) return true;
  else if (i === 2 && j === 5) return true;
  else if (i === 5 && j === 2) return true;
  else if (i === 0 && j === 5) return true;
  else if (i === 5 && j === 0) return true;
  else return false;
}
const contactCell = (i, j) => i * 8 + j;
const residueGray = (i) => grayNat(i);
const contactGrayCell = (i, j) => residueGray(i) * 8 + residueGray(j);
const contactBool = contactMap8;
const isContactPairCell = (c) =>
  c === contactGrayCell(0, 3) || c === contactGrayCell(1, 4) || c === contactGrayCell(2, 5) || c === contactGrayCell(0, 5);

// Distances between the 20 amino-acid codes on the five-bit cube
function countPairsAtDistance(f, d) {
  let n = 0;
  for (let a = 0; a < 20; a++) for (let b = 0; b < 20; b++) if (a !== b && hammingDist(f(a), f(b)) === d) n++;
  return n;
}
function q5EdgesOrdered() {
  let n = 0;
  for (let a = 0; a < 32; a++) for (let b = 0; b < 32; b++) if (a !== b && hammingDist(a, b) === 1) n++;
  return n;
}

// Contact circuits: separation bins, cubes and the worked cover
const ccGrayNat = grayNat;
const ccH5 = (a, b) => { let n = 0; for (const i of [0, 1, 2, 3, 4]) if (((a >>> i) & 1) !== ((b >>> i) & 1)) n++; return n; };
function ccHeDist1Ordered() {
  let s = 0;
  for (let a = 0; a < 20; a++) { let c = 0; for (let b = 0; b < 20; b++) if (ccH5(ccGrayNat(a), ccGrayNat(b)) === 1) c++; s += c; }
  return s;
}
function ccHeCounts() {
  const out = [];
  for (let d = 0; d < 6; d++) { let c = 0; for (let a = 0; a < 20; a++) for (let b = 0; b < 20; b++) if (ccH5(ccGrayNat(a), ccGrayNat(b)) === d) c++; out.push(c); }
  return out;
}
const ccSepBin = (s) => (s < 11 ? 0 : s < 21 ? 1 : s < 31 ? 2 : 3);
const ccLevel1 = (gi, gj, s) => (gi * 8 + gj) * 4 + s;
const ccEval = (w, values, mask, c) => ((values ^ c) & ((2 ** w - 1) ^ mask)) === 0;
const TER = { On: "On", Off: "Off", DC: "DC" };
const ccTableToy = (c) => (c === 0 ? TER.On : c === 1 ? TER.On : TER.Off);
const ccPiToy = [0, 1];
const range = (n) => Array.from({ length: n }, (_, i) => i);
const ccCoverCompleteB = (cells, table, pis, w) =>
  range(cells).every((c) => table(c) !== TER.On || pis.some((p) => ccEval(w, p[0], p[1], c)));
const ccOffAvoidingB = (cells, table, pis, w) =>
  pis.every((p) => range(cells).every((c) => !(table(c) === TER.Off && ccEval(w, p[0], p[1], c))));

// Sequence circuits: cubes, segments and the packing of (position, residue)
const scEval = ccEval;
const scGray = grayNat;
const scCell = (b, i, a) => (i << b) | a;
const scHamming = (w, a, b) => { let n = 0; for (let k = 0; k < w; k++) if ((((a ^ b) >>> k) & 1) === 1) n++; return n; };
const filterRange = (n, f) => range(n).filter(f);
const sameList = (x, y) => x.length === y.length && x.every((v, k) => v === y[k]);

/** The definitions, exposed for tests and for chapters that want the exact arithmetic. */
export const MIRROR = {
  grayNat, oneBitDiff, hammingDist, grayInverse, encodeNuc, nucRow, nucCol, nucCell, AA, encodeAA, encodeGray,
  contactMap8, contactCell, contactGrayCell, isContactPairCell, countPairsAtDistance, ccH5, ccSepBin, ccLevel1,
  ccEval, scEval, scGray, scCell, scHamming,
};

// ─────────────────────────────────────────────────────────────────────────────
// Check specifications
// ─────────────────────────────────────────────────────────────────────────────
// forall(vars, dims, pred)  ∀ over the product of Fin dims (last variable fastest)
// exists(vars, dims, pred)  ∃: stops at the first witness
// given(vars, witness, pred) ∃ with the witness the proof itself supplies
// closed(cases, evalFn)     no variables; evalFn() → boolean | {ok, detail}
// bounded(vars, dims, pred, note) the theorem: all naturals; browser: the box dims
const forall = (vars, dims, pred) => ({ kind: "forall", vars, dims, pred });
const exists = (vars, dims, pred) => ({ kind: "exists", vars, dims, pred });
const given = (vars, witness, pred) => ({ kind: "given", vars, witness, pred });
const closed = (cases, evalFn) => ({ kind: "closed", cases, evalFn });
const bounded = (vars, dims, pred, note) => ({ kind: "bounded", vars, dims, pred, note });
const conj = (...fs) => closed(fs.length, () => fs.every((f) => f()));
const hdAll = (rows) => closed(rows.length, () => rows.every(([a, b, op, v]) => cmp(hdAA(a, b), op, v)));
const cmp = (x, op, v) => (op === "=" ? x === v : op === "<=" ? x <= v : op === ">=" ? x >= v : false);
const N4 = 4; // |Nucleotide|
const nuc = (k) => NUC[k];

// Implication helper: (p → q) is true when p is false.
const imp = (p, q) => !p || q;

// [chapters, meaning, spec, domain text]
const T = {
  // ── Gray code and the DNA letters ─────────────────────────────────────────
  "KmapProofs.gray_bound": [["0011"], "Every 8-bit number keeps an 8-bit Gray code: for n from 0 to 255, its Gray code is below 256.",
    forall(["n"], [256], (n) => grayNat(n) < 256), "n ∈ [256]"],
  "KmapProofs.gray_adjacent": [["0011"], "Counting from 0 to 255 in Gray code changes exactly one bit per step: the codes of n and n + 1 differ in a single bit.",
    forall(["n"], [255], (n) => oneBitDiff(grayNat(n), grayNat(n + 1))), "n ∈ [255]"],
  "KmapProofs.gray_hamming_one": [["0011"], "The same fact measured in bits: consecutive Gray codes are at Hamming distance exactly 1, for every n below 255.",
    forall(["n"], [255], (n) => hammingDist(grayNat(n), grayNat(n + 1)) === 1), "n ∈ [255]"],
  "KmapProofs.gray_injective": [["0011"], "No two 8-bit numbers share a Gray code, so nothing is lost by recoding.",
    forall(["a", "b"], [256, 256], (a, b) => imp(grayNat(a) === grayNat(b), a === b)), "a, b ∈ [256]"],
  "KmapProofs.gray_involution": [["0011"], "Decoding undoes encoding, for every 8-bit number.",
    forall(["n"], [256], (n) => grayInverse(grayNat(n)) === n), "n ∈ [256]"],
  "KmapProofs.encode_injective": [["0001"], "The four DNA letters get four different 2-bit codes (A=00, C=01, G=11, T=10).",
    forall(["a", "b"], [N4, N4], (a, b) => imp(encodeNuc[nuc(a)] === encodeNuc[nuc(b)], a === b)), "a, b ∈ 𝒩"],
  "KmapProofs.encode_complement_AT": [["0110"], "Watson–Crick partners A and T differ in both bits of their Gray-coded labels: their codes XOR to 11.",
    closed(1, () => (grayNat(encodeNuc.A) ^ grayNat(encodeNuc.T)) === 3), "one closed statement"],
  "KmapProofs.encode_complement_CG": [["0110"], "Watson–Crick partners C and G differ in both bits of their Gray-coded labels: their codes XOR to 11.",
    closed(1, () => (grayNat(encodeNuc.C) ^ grayNat(encodeNuc.G)) === 3), "one closed statement"],
  "KmapProofs.gray_cycle_AC": [["0011", "0001"], "A (00) and C (01) differ in one bit: the first step of the Gray cycle A → C → G → T → A.",
    closed(1, () => oneBitDiff(encodeNuc.A, encodeNuc.C)), "one closed statement"],
  "KmapProofs.gray_cycle_CG": [["0011", "0001"], "C (01) and G (11) differ in one bit.",
    closed(1, () => oneBitDiff(encodeNuc.C, encodeNuc.G)), "one closed statement"],
  "KmapProofs.gray_cycle_GT": [["0011", "0001"], "G (11) and T (10) differ in one bit.",
    closed(1, () => oneBitDiff(encodeNuc.G, encodeNuc.T)), "one closed statement"],
  "KmapProofs.gray_cycle_TA": [["0011", "0001"], "T (10) and A (00) differ in one bit, closing the cycle.",
    closed(1, () => oneBitDiff(encodeNuc.T, encodeNuc.A)), "one closed statement"],
  "KmapProofs.transition_AG": [["0110"], "With Gray-coded labels (A = 00, G = 10) the purine–purine transition A ↔ G flips one bit.",
    closed(1, () => oneBitDiff(grayNat(encodeNuc.A), grayNat(encodeNuc.G))), "one closed statement"],
  "KmapProofs.transition_CT": [["0110"], "With Gray-coded labels (C = 01, T = 11) the pyrimidine–pyrimidine transition C ↔ T flips one bit.",
    closed(1, () => oneBitDiff(grayNat(encodeNuc.C), grayNat(encodeNuc.T))), "one closed statement"],
  "KmapProofs.transversion_AC": [["0110"], "With Gray-coded labels the transversion A ↔ C is also one bit (00 vs 01).",
    closed(1, () => hammingDist(grayNat(encodeNuc.A), grayNat(encodeNuc.C)) === 1), "one closed statement"],
  "KmapProofs.encode_all_distinct": [["0001"], "All six pairs of DNA codes are different.",
    closed(6, () => {
      const e = encodeNuc;
      return e.A !== e.C && e.A !== e.G && e.A !== e.T && e.C !== e.G && e.C !== e.T && e.G !== e.T;
    }), "six inequalities"],

  // ── k-mer maps ────────────────────────────────────────────────────────────
  "KmerIndexing.grayNat_bound_2bit": [["0011"], "On two bits the Gray code stays on two bits: g(n) < 4 for n < 4.",
    forall(["n"], [4], (n) => grayNat(n) < 4), "n ∈ [4]"],
  "KmerIndexing.grayNat_injective_2bit": [["0011"], "On two bits, different numbers get different Gray codes.",
    forall(["a", "b"], [4, 4], (a, b) => imp(grayNat(a) === grayNat(b), a === b)), "a, b ∈ [4]"],
  "KmerIndexing.grayNat_oneBitDiff": [["0011"], "Counting 0, 1, 2, 3 in 2-bit Gray code flips one bit per step.",
    forall(["n"], [3], (n) => oneBitDiff(grayNat(n), grayNat(n + 1))), "n ∈ [3]"],
  "KmerIndexing.grayNat_cyclic": [["0011"], "The 2-bit Gray cycle closes: the codes of 3 and 0 also differ in one bit, so K-map edges wrap around.",
    closed(1, () => oneBitDiff(grayNat(3), grayNat(0))), "one closed statement"],
  "KmerIndexing.encode_injective": [["0001"], "The four DNA letters get four different codes (the same encoding, restated for the k-mer maps).",
    forall(["a", "b"], [N4, N4], (a, b) => imp(encodeNuc[nuc(a)] === encodeNuc[nuc(b)], a === b)), "a, b ∈ 𝒩"],
  "KmerIndexing.encode_val_injective": [["0001"], "Comparing the codes as plain numbers is enough to tell the letters apart.",
    forall(["a", "b"], [N4, N4], (a, b) => imp(encodeNuc[nuc(a)] === encodeNuc[nuc(b)], a === b)), "a, b ∈ 𝒩"],
  "KmerIndexing.gray_cycle_AC": [["0011"], "A (00) and C (01) differ in one bit (restated for the k-mer maps).",
    closed(1, () => oneBitDiff(encodeNuc.A, encodeNuc.C)), "one closed statement"],
  "KmerIndexing.gray_cycle_CG": [["0011"], "C (01) and G (11) differ in one bit.",
    closed(1, () => oneBitDiff(encodeNuc.C, encodeNuc.G)), "one closed statement"],
  "KmerIndexing.gray_cycle_GT": [["0011"], "G (11) and T (10) differ in one bit.",
    closed(1, () => oneBitDiff(encodeNuc.G, encodeNuc.T)), "one closed statement"],
  "KmerIndexing.gray_cycle_TA": [["0011"], "T (10) and A (00) differ in one bit.",
    closed(1, () => oneBitDiff(encodeNuc.T, encodeNuc.A)), "one closed statement"],
  "KmerIndexing.transition_AG": [["0110"], "With Gray-coded labels, A ↔ G (a transition) flips one bit.",
    closed(1, () => oneBitDiff(grayNat(encodeNuc.A), grayNat(encodeNuc.G))), "one closed statement"],
  "KmerIndexing.transition_CT": [["0110"], "With Gray-coded labels, C ↔ T (a transition) flips one bit.",
    closed(1, () => oneBitDiff(grayNat(encodeNuc.C), grayNat(encodeNuc.T))), "one closed statement"],
  "KmerIndexing.complement_AT": [["0110"], "With Gray-coded labels, A and T XOR to 11, both bits differ.",
    closed(1, () => (grayNat(encodeNuc.A) ^ grayNat(encodeNuc.T)) === 3), "one closed statement"],
  "KmerIndexing.complement_CG": [["0110"], "With Gray-coded labels, C and G XOR to 11, both bits differ.",
    closed(1, () => (grayNat(encodeNuc.C) ^ grayNat(encodeNuc.G)) === 3), "one closed statement"],
  "KmerIndexing.nucCell_injective": [["0010"], "On the 2×2 map every nucleotide gets its own cell.",
    forall(["a", "b"], [N4, N4], (a, b) => imp(nucCell(nuc(a)) === nucCell(nuc(b)), a === b)), "a, b ∈ 𝒩"],
  "KmerIndexing.nucRow_Col_determine": [["0010"], "A row and a column together pin down exactly one nucleotide.",
    forall(["a", "b"], [N4, N4], (a, b) => imp(nucRow[nuc(a)] === nucRow[nuc(b)] && nucCol[nuc(a)] === nucCol[nuc(b)], a === b)), "a, b ∈ 𝒩"],
  "KmerIndexing.nucCell_adj_AC": [["0010"], "A and C sit side by side in the same row of the 2×2 map.",
    conj(() => nucRow.A === nucRow.C, () => nucCol.A + 1 === nucCol.C), "two conjuncts"],
  "KmerIndexing.nucCell_adj_CG": [["0010"], "C and G sit one above the other in the same column.",
    conj(() => nucRow.C + 1 === nucRow.G, () => nucCol.C === nucCol.G), "two conjuncts"],
  "KmerIndexing.nucCell_adj_GT": [["0010"], "G and T sit side by side in the same row.",
    conj(() => nucRow.G === nucRow.T, () => nucCol.G === nucCol.T + 1), "two conjuncts"],
  "KmerIndexing.nucCell_adj_TA": [["0010"], "T and A sit one above the other, so the cycle A → C → G → T → A walks round the 2×2 map.",
    conj(() => nucRow.T === nucRow.A + 1, () => nucCol.T === nucCol.A), "two conjuncts"],
  "KmerIndexing.dinucEncode_eq": [["0010"], "A dinucleotide's cell is row × 4 + column, with the first letter giving the row and the second the column.",
    // the site's K-map code of a dinucleotide, and the row and column it is drawn at, against the statement
    forall(["d"], [16], (d) => { const a = nuc(d >> 2), b = nuc(d & 3); const code = kmerCode([NUC_RAW[a], NUC_RAW[b]], 2), cell = kmapCell(code, kmapShape(4));
      return code === cell.row * 4 + cell.col && cell.row === encodeNuc[a] && cell.col === encodeNuc[b]; }), "d ∈ 𝒩²"],
  "KmerIndexing.dinucEncode_injective": [["0010"], "The 16 dinucleotides land in 16 different cells of the 4×4 map.",
    forall(["a", "b"], [16, 16], (a, b) => {
      const ea = encodeNuc[nuc(a >> 2)] * 4 + encodeNuc[nuc(a & 3)], eb = encodeNuc[nuc(b >> 2)] * 4 + encodeNuc[nuc(b & 3)];
      return imp(ea === eb, a === b);
    }), "a, b ∈ 𝒩²"],
  "KmerIndexing.dinucEncode_bound": [["0010"], "Every dinucleotide cell index is below 16: the 4×4 map has no overflow.",
    forall(["d"], [16], (d) => encodeNuc[nuc(d >> 2)] * 4 + encodeNuc[nuc(d & 3)] < 16), "d ∈ 𝒩²"],
  "KmerIndexing.dinucRow_bound": [["0010"], "Every dinucleotide row index is below 4.",
    forall(["d"], [16], (d) => encodeNuc[nuc(d >> 2)] < 4), "d ∈ 𝒩²"],
  "KmerIndexing.dinucCol_bound": [["0010"], "Every dinucleotide column index is below 4.",
    forall(["d"], [16], (d) => encodeNuc[nuc(d & 3)] < 4), "d ∈ 𝒩²"],
  "KmerIndexing.dinucRow_cycle_diff_firstPos": [["0010"], "Stepping the first letter A → C → G → T moves the raw row index by +1, +2 and (wrapping) 2: raw numbers are not Gray distances, which is why the map orders its axes by the Gray cycle.",
    forall(["n"], [N4], () => natSub(encodeNuc.C, encodeNuc.A) === 1 && natSub(encodeNuc.G, encodeNuc.C) === 2 && natSub(encodeNuc.A + 4, encodeNuc.T) === 2), "n ∈ 𝒩"],
  "KmerIndexing.dinucCol_cycle_diff_secondPos": [["0010"], "The same for the second letter and the column index.",
    forall(["n"], [N4], () => natSub(encodeNuc.C, encodeNuc.A) === 1 && natSub(encodeNuc.G, encodeNuc.C) === 2 && natSub(encodeNuc.A + 4, encodeNuc.T) === 2), "n ∈ 𝒩"],
  "KmerIndexing.dinucRow_Col_injective": [["0010"], "Knowing a dinucleotide's row and column tells you the dinucleotide.",
    forall(["a", "b"], [16, 16], (a, b) => imp(encodeNuc[nuc(a >> 2)] === encodeNuc[nuc(b >> 2)] && encodeNuc[nuc(a & 3)] === encodeNuc[nuc(b & 3)], a === b)), "a, b ∈ 𝒩²"],
  "KmerIndexing.trinucEncode_injective": [["0010"], "The 64 trinucleotides land in 64 different cells of the 8×8 map.",
    forall(["a", "b"], [64, 64], (a, b) => {
      const e = (t) => encodeNuc[nuc(t >> 4)] * 16 + encodeNuc[nuc((t >> 2) & 3)] * 4 + encodeNuc[nuc(t & 3)];
      return imp(e(a) === e(b), a === b);
    }), "a, b ∈ 𝒩³"],
  "KmerIndexing.trinucEncode_bound": [["0010"], "Every trinucleotide cell index is below 64.",
    forall(["t"], [64], (t) => encodeNuc[nuc(t >> 4)] * 16 + encodeNuc[nuc((t >> 2) & 3)] * 4 + encodeNuc[nuc(t & 3)] < 64), "t ∈ 𝒩³"],
  "KmerIndexing.tetranucEncode_injective": [["0010"], "The 256 tetranucleotides land in 256 different cells of the 16×16 map.",
    forall(["a", "b"], [256, 256], (a, b) => {
      const e = (t) => encodeNuc[nuc(t >> 6)] * 64 + encodeNuc[nuc((t >> 4) & 3)] * 16 + encodeNuc[nuc((t >> 2) & 3)] * 4 + encodeNuc[nuc(t & 3)];
      return imp(e(a) === e(b), a === b);
    }), "a, b ∈ 𝒩⁴"],
  "KmerIndexing.tetranucEncode_bound": [["0010"], "Every tetranucleotide cell index is below 256.",
    forall(["t"], [256], (t) => encodeNuc[nuc(t >> 6)] * 64 + encodeNuc[nuc((t >> 4) & 3)] * 16 + encodeNuc[nuc((t >> 2) & 3)] * 4 + encodeNuc[nuc(t & 3)] < 256), "t ∈ 𝒩⁴"],
  "KmerIndexing.gray_code_preserves_adjacency": [["0010", "0110"], "Any single-letter substitution changes one or two bits of the Gray-coded label, never zero and never more than two.",
    forall(["a", "b"], [N4, N4], (a, b) => {
      if (a === b) return true;
      const d = hammingDist(grayNat(encodeNuc[nuc(a)]), grayNat(encodeNuc[nuc(b)]));
      return d >= 1 && d <= 2;
    }), "a, b ∈ 𝒩"],
  "KmerIndexing.complement_distance_2": [["0110"], "Watson–Crick partners are as far apart as two bits allow: A–T and C–G are both at distance 2 with Gray-coded labels.",
    conj(() => hammingDist(grayNat(encodeNuc.A), grayNat(encodeNuc.T)) === 2, () => hammingDist(grayNat(encodeNuc.C), grayNat(encodeNuc.G)) === 2), "two conjuncts"],
  "KmerIndexing.transition_distance_1": [["0110"], "Transitions A–G and C–T are both at distance 1 with Gray-coded labels.",
    conj(() => hammingDist(grayNat(encodeNuc.A), grayNat(encodeNuc.G)) === 1, () => hammingDist(grayNat(encodeNuc.C), grayNat(encodeNuc.T)) === 1), "two conjuncts"],

  // ── the amino-acid code ───────────────────────────────────────────────────
  "AminoAcidEncoding.encode_injective": [["0001"], "The 20 amino acids get 20 different 5-bit codes.",
    forall(["a", "b"], [20, 20], (a, b) => imp(encodeAA[AA[a]] === encodeAA[AA[b]], a === b)), "a, b ∈ 𝒜"],
  "AminoAcidEncoding.encode_in_range": [["0001"], "Every amino-acid index fits in five bits (below 32).",
    forall(["a"], [20], (a) => encodeAA[AA[a]] < 32), "a ∈ 𝒜"],
  "AminoAcidEncoding.group_hydrophobic_hamming_le_2": [["0110"], "The aliphatic hydrophobics A, V, L, I are all within two bits of each other.",
    hdAll([["A", "V", "<=", 2], ["A", "L", "<=", 2], ["A", "I", "<=", 2], ["V", "L", "<=", 2], ["V", "I", "<=", 2], ["L", "I", "<=", 2]]), "six conjuncts"],
  "AminoAcidEncoding.group_aromatic_hamming_le_2": [["0110"], "The aromatics F, Y, W are all within two bits of each other.",
    hdAll([["F", "Y", "<=", 2], ["F", "W", "<=", 2], ["Y", "W", "<=", 2]]), "three conjuncts"],
  "AminoAcidEncoding.group_sulfur_hamming_eq_1": [["0110"], "The sulfur pair M and C is one bit apart.",
    hdAll([["M", "C", "=", 1]]), "one closed statement"],
  "AminoAcidEncoding.group_structure_breaking_hamming_eq_1": [["0110"], "The structure breakers P and G are one bit apart.",
    hdAll([["P", "G", "=", 1]]), "one closed statement"],
  "AminoAcidEncoding.group_polar_uncharged_hamming_le_3": [["0110"], "The polar uncharged S, T, N, Q are within three bits of each other (S–Q = 3 is the widest group).",
    hdAll([["S", "T", "<=", 3], ["S", "N", "<=", 3], ["S", "Q", "<=", 3], ["T", "N", "<=", 3], ["T", "Q", "<=", 3], ["N", "Q", "<=", 3]]), "six conjuncts"],
  "AminoAcidEncoding.group_negative_charged_hamming_eq_1": [["0110"], "The acids D and E are one bit apart.",
    hdAll([["D", "E", "=", 1]]), "one closed statement"],
  "AminoAcidEncoding.group_positive_charged_hamming_le_2": [["0110"], "The bases H, K, R are within two bits of each other.",
    hdAll([["H", "K", "<=", 2], ["H", "R", "<=", 2], ["K", "R", "<=", 2]]), "three conjuncts"],
  "AminoAcidEncoding.charge_adjacency_DE": [["0110"], "D and E: distance 1.", hdAll([["D", "E", "=", 1]]), "one closed statement"],
  "AminoAcidEncoding.charge_adjacency_HK": [["0110"], "H and K: distance 1.", hdAll([["H", "K", "=", 1]]), "one closed statement"],
  "AminoAcidEncoding.charge_adjacency_KR": [["0110"], "K and R: distance 1.", hdAll([["K", "R", "=", 1]]), "one closed statement"],
  "AminoAcidEncoding.charge_adjacency_HR": [["0110"], "H and R: distance 2 (they meet through K).", hdAll([["H", "R", "=", 2]]), "one closed statement"],
  "AminoAcidEncoding.polar_group_chain": [["0110"], "S → T → N → Q is a path of one-bit steps.",
    hdAll([["S", "T", "=", 1], ["T", "N", "=", 1], ["N", "Q", "=", 1]]), "three conjuncts"],
  "AminoAcidEncoding.polar_group_max_distance": [["0110"], "The two ends of that path, S and Q, are three bits apart.",
    hdAll([["S", "Q", "=", 3]]), "one closed statement"],
  "AminoAcidEncoding.aromatic_vs_sulfur": [["0110"], "All six aromatic–sulfur distances: F–M 1, F–C 2, Y–M 2, Y–C 3, W–M 1, W–C 2.",
    hdAll([["F", "M", "=", 1], ["F", "C", "=", 2], ["Y", "M", "=", 2], ["Y", "C", "=", 3], ["W", "M", "=", 1], ["W", "C", "=", 2]]), "six conjuncts"],
  "AminoAcidEncoding.max_distance_FH": [["0110"], "F and H differ in all five bits.", hdAll([["F", "H", "=", 5]]), "one closed statement"],
  "AminoAcidEncoding.max_distance_YE": [["0110"], "Y and E differ in all five bits.", hdAll([["Y", "E", "=", 5]]), "one closed statement"],
  "AminoAcidEncoding.max_distance_WR": [["0110"], "W and R differ in all five bits.", hdAll([["W", "R", "=", 5]]), "one closed statement"],
  "AminoAcidEncoding.max_distance_MK": [["0110"], "M and K differ in all five bits.", hdAll([["M", "K", "=", 5]]), "one closed statement"],
  "AminoAcidEncoding.hydrophobic_vs_positive": [["0110"], "Hydrophobics sit away from the bases: A–K ≥ 4, V–H ≥ 2, L–R ≥ 3.",
    hdAll([["A", "K", ">=", 4], ["V", "H", ">=", 2], ["L", "R", ">=", 3]]), "three conjuncts"],
  "AminoAcidEncoding.hydrophobic_vs_negative": [["0110"], "A known weak spot: A and D are one bit apart; V–E is 3 and I–D is 2.",
    hdAll([["A", "D", "=", 1], ["V", "E", "=", 3], ["I", "D", "=", 2]]), "three conjuncts"],
  "AminoAcidEncoding.within_group_distance_1": [["0110"], "The 14 one-bit pairs that stay inside a chemical group.",
    hdAll([["A", "V", "=", 1], ["A", "I", "=", 1], ["V", "L", "=", 1], ["L", "I", "=", 1], ["F", "Y", "=", 1], ["Y", "W", "=", 1], ["M", "C", "=", 1],
      ["P", "G", "=", 1], ["S", "T", "=", 1], ["T", "N", "=", 1], ["N", "Q", "=", 1], ["D", "E", "=", 1], ["H", "K", "=", 1], ["K", "R", "=", 1]]), "fourteen conjuncts"],
  "AminoAcidEncoding.cross_group_distance_1_aliphatic": [["0110"], "Eight one-bit pairs that cross from the aliphatic group into another group.",
    hdAll([["A", "M", "=", 1], ["A", "D", "=", 1], ["V", "W", "=", 1], ["V", "Q", "=", 1], ["L", "Y", "=", 1], ["L", "N", "=", 1], ["I", "F", "=", 1], ["I", "T", "=", 1]]), "eight conjuncts"],
  "AminoAcidEncoding.cross_group_distance_1_aromatic": [["0110"], "Five one-bit pairs that cross from the aromatic group into another group.",
    hdAll([["F", "M", "=", 1], ["F", "S", "=", 1], ["Y", "G", "=", 1], ["W", "M", "=", 1], ["W", "P", "=", 1]]), "five conjuncts"],
  "AminoAcidEncoding.cross_group_distance_1_charged": [["0110"], "Five more cross-group one-bit pairs, including E–H and E–R between opposite charges.",
    hdAll([["C", "P", "=", 1], ["C", "S", "=", 1], ["C", "D", "=", 1], ["E", "H", "=", 1], ["E", "R", "=", 1]]), "five conjuncts"],
  "AminoAcidEncoding.cross_group_distance_1_polar": [["0110"], "The last eight cross-group one-bit pairs, all touching the polar or structure-breaking groups.",
    hdAll([["S", "G", "=", 1], ["G", "N", "=", 1], ["P", "Q", "=", 1], ["T", "D", "=", 1], ["T", "R", "=", 1], ["N", "K", "=", 1], ["Q", "D", "=", 1], ["Q", "H", "=", 1]]), "eight conjuncts"],

  // ── the 8-residue example map ─────────────────────────────────────────────
  "ContactMapCompleteness.contactMap8_symmetric": [["0111", "1101"], "In the fixed 8-residue example, i touches j exactly when j touches i.",
    forall(["i", "j"], [8, 8], (i, j) => contactMap8(i, j) === contactMap8(j, i)), "i, j ∈ [8]"],
  "ContactMapCompleteness.contactMap8_irreflexive": [["0111"], "In the 8-residue example no residue is in contact with itself.",
    forall(["i"], [8], (i) => contactMap8(i, i) === false), "i ∈ [8]"],
  "ContactMapCompleteness.contactMap8_unique_contacts": [["0111"], "The example's four contacts are (0,3), (1,4), (2,5) and (0,5).",
    conj(() => contactMap8(0, 3), () => contactMap8(1, 4), () => contactMap8(2, 5), () => contactMap8(0, 5)), "four conjuncts"],
  "ContactMapCompleteness.contactCell_bound": [["0111"], "Cell i × 8 + j of an 8×8 contact map is below 64.",
    forall(["i", "j"], [8, 8], (i, j) => contactCell(i, j) < 64), "i, j ∈ [8]"],
  "ContactMapCompleteness.contactCell_injective": [["0111", "0100"], "Different residue pairs get different cells of the 8×8 map.",
    forall(["i1", "j1", "i2", "j2"], [8, 8, 8, 8], (i1, j1, i2, j2) => imp(contactCell(i1, j1) === contactCell(i2, j2), i1 === i2 && j1 === j2)), "i1, j1, i2, j2 ∈ [8]"],
  "ContactMapCompleteness.contactCell_symmetric": [["0111", "1101"], "A contact (i, j) and its mirror (j, i) occupy two different cells whenever i ≠ j.",
    forall(["i", "j"], [8, 8], (i, j) => imp(i !== j, contactCell(i, j) !== contactCell(j, i))), "i, j ∈ [8]"],
  "ContactMapCompleteness.residueGray_bound": [["0111"], "The Gray code of a residue index below 8 stays below 8.",
    forall(["i"], [8], (i) => residueGray(i) < 8), "i ∈ [8]"],
  "ContactMapCompleteness.residueGray_injective": [["0111"], "Gray-coding residue indices 0–7 loses nothing.",
    forall(["i", "j"], [8, 8], (i, j) => imp(residueGray(i) === residueGray(j), i === j)), "i, j ∈ [8]"],
  "ContactMapCompleteness.contactGrayCell_bound": [["0111"], "The Gray-indexed cell of an 8×8 contact map is below 64.",
    forall(["i", "j"], [8, 8], (i, j) => contactGrayCell(i, j) < 64), "i, j ∈ [8]"],
  "ContactMapCompleteness.contactGrayCell_injective": [["0111"], "Gray-indexed cells are also one per residue pair.",
    forall(["i1", "j1", "i2", "j2"], [8, 8, 8, 8], (i1, j1, i2, j2) => imp(contactGrayCell(i1, j1) === contactGrayCell(i2, j2), i1 === i2 && j1 === j2)), "i1, j1, i2, j2 ∈ [8]"],
  "ContactMapCompleteness.contactGrayCell_differs_from_raw": [["0111"], "Gray indexing really moves cells: the pair (1, 2) lands in a different cell than under plain indexing.",
    given(["i", "j"], [1, 2], (i, j) => contactGrayCell(i, j) !== contactCell(i, j)), "the witness (1, 2) from the proof"],
  "ContactMapCompleteness.contactGrayCell_contact_pairs": [["0111"], "The example's four contacts land in Gray cells 2, 14, 31 and 7.",
    conj(() => contactGrayCell(0, 3) === 2, () => contactGrayCell(1, 4) === 14, () => contactGrayCell(2, 5) === 31, () => contactGrayCell(0, 5) === 7), "four conjuncts"],
  "ContactMapCompleteness.contactGrayCell_symmetric_pairs_distinct": [["0111"], "Each of those contacts and its mirror image are two different Gray cells.",
    conj(() => contactGrayCell(0, 3) !== contactGrayCell(3, 0), () => contactGrayCell(1, 4) !== contactGrayCell(4, 1),
      () => contactGrayCell(2, 5) !== contactGrayCell(5, 2), () => contactGrayCell(0, 5) !== contactGrayCell(5, 0)), "four conjuncts"],
  "ContactMapCompleteness.contactBool_true_entries": [["0111"], "Read as a Boolean function, the example is 1 on eight cells: the four contacts and their mirrors.",
    conj(() => contactBool(0, 3), () => contactBool(3, 0), () => contactBool(1, 4), () => contactBool(4, 1),
      () => contactBool(2, 5), () => contactBool(5, 2), () => contactBool(0, 5), () => contactBool(5, 0)), "eight conjuncts"],
  "ContactMapCompleteness.contactBool_all_entries_classified": [["0111"], "…and 0 on all other 56: the function is fully specified.",
    forall(["i", "j"], [8, 8], (i, j) => contactBool(i, j) === ((i === 0 && j === 3) || (i === 3 && j === 0) || (i === 1 && j === 4) || (i === 4 && j === 1) ||
      (i === 2 && j === 5) || (i === 5 && j === 2) || (i === 0 && j === 5) || (i === 5 && j === 0))), "i, j ∈ [8]"],
  "ContactMapCompleteness.contactMap8_min_separation": [["0111"], "Every contact in the example is at least 3 apart in sequence.",
    forall(["i", "j"], [8, 8], (i, j) => imp(contactMap8(i, j), i - j >= 3 || j - i >= 3)), "i, j ∈ [8]"],
  "ContactMapCompleteness.contactMap8_max_separation": [["0111"], "A weak bound, stated as written: for every contact, i − j ≤ 5 or j − i ≤ 5.",
    forall(["i", "j"], [8, 8], (i, j) => imp(contactMap8(i, j), i - j <= 5 || j - i <= 5)), "i, j ∈ [8]"],
  "ContactMapCompleteness.contactMap_no_groupable_minterms": [["0101"], "No two contact cells of the example are one bit apart, so Quine–McCluskey cannot merge any of them: the example is already minimal.",
    forall(["p", "q"], [64, 64], (p, q) => imp(isContactPairCell(p) && isContactPairCell(q) && p !== q, hammingDist(p, q) >= 2)), "p, q ∈ [64]"],
  "ContactMapCompleteness.contactMap_pairwise_hamming": [["0101"], "The six pairwise distances between the example's contact cells: 2, 4, 2, 2, 2, 2.",
    conj(() => hammingDist(contactGrayCell(0, 3), contactGrayCell(1, 4)) === 2, () => hammingDist(contactGrayCell(0, 3), contactGrayCell(2, 5)) === 4,
      () => hammingDist(contactGrayCell(0, 3), contactGrayCell(0, 5)) === 2, () => hammingDist(contactGrayCell(1, 4), contactGrayCell(2, 5)) === 2,
      () => hammingDist(contactGrayCell(1, 4), contactGrayCell(0, 5)) === 2, () => hammingDist(contactGrayCell(2, 5), contactGrayCell(0, 5)) === 2), "six conjuncts"],
  "ContactMapCompleteness.residue_gray_adjacent": [["0011", "0111"], "Neighbouring residue indices 0–7 are one bit apart in Gray code.",
    closed(7, () => [0, 1, 2, 3, 4, 5, 6].every((i) => hammingDist(grayNat(i), grayNat(i + 1)) === 1)), "seven conjuncts"],

  // ── the five-bit cube ─────────────────────────────────────────────────────
  "KmapEncodingEquiv.rawEncodingInjective": [["0001"], "The raw group-order index 0–19 identifies the amino acid.",
    // the site's raw-index table (encoding.js AA_RAW) against the Lean order, and injective
    forall(["a", "b"], [20, 20], (a, b) => AA_RAW[AA[a]] === a && imp(AA_RAW[AA[a]] === AA_RAW[AA[b]], a === b)), "a, b ∈ [20]"],
  "KmapEncodingEquiv.distanceDistributionCurrent": [["0110"], "Over all 380 ordered pairs of different amino acids, the code distances 1–5 occur 80, 132, 112, 48 and 8 times.",
    closed(400, () => {
      const c = [1, 2, 3, 4, 5].map((d) => countPairsAtDistance(grayNat, d));
      return { ok: c.join() === "80,132,112,48,8", detail: { ordered: c } };
    }), "all 400 ordered pairs of [20]"],
  "KmapEncodingEquiv.unorderedDistanceDistribution": [["0110"], "The 190 unordered pairs: 40 at distance 1, 66 at 2, 56 at 3, 24 at 4 and 4 at 5.",
    closed(400, () => {
      const c = [1, 2, 3, 4, 5].map((d) => Math.floor(countPairsAtDistance(grayNat, d) / 2));
      return { ok: c.join() === "40,66,56,24,4", detail: { unordered: c } };
    }), "all 400 ordered pairs of [20]"],
  "KmapEncodingEquiv.degreeOfFiveBitHypercube": [["0110"], "Every corner of the 5-bit cube has exactly five one-bit neighbours.",
    forall(["n"], [32], (n) => { let c = 0; for (let m = 0; m < 32; m++) if (hammingDist(n, m) === 1) c++; return c === 5; }), "n ∈ [32]"],
  "KmapEncodingEquiv.currentEncodingBound": [["0110"], "40 one-bit pairs is within the handshake bound of 50 for any 20 corners of the cube.",
    closed(400, () => Math.floor(countPairsAtDistance(grayNat, 1) / 2) <= 50), "all 400 ordered pairs of [20]"],
  "KmapEncodingEquiv.total_Q5_edges": [["0110"], "The 5-bit cube has 80 edges.",
    closed(1024, () => Math.floor(q5EdgesOrdered() / 2) === 80), "all 1,024 ordered pairs of [32]"],
  "KmapEncodingEquiv.encoding_edge_coverage": [["0110"], "The amino-acid code uses exactly half (40 of 80) of the cube's edges.",
    closed(1424, () => {
      const pct = Math.floor(Math.floor(Math.floor(countPairsAtDistance(grayNat, 1) / 2) * 100) / Math.floor(q5EdgesOrdered() / 2));
      return { ok: pct === 50, detail: { percent: pct } };
    }), "400 pairs of [20] and 1,024 pairs of [32]"],
  "KmapEncodingEquiv.consecutive_gray_adjacency": [["0011"], "Consecutive raw indices 0–19 are one bit apart after Gray coding.",
    forall(["i"], [19], (i) => hammingDist(grayNat(i), grayNat(i + 1)) === 1), "i ∈ [19]"],

  // ── contact circuits ──────────────────────────────────────────────────────
  "ContactCircuits.cc_gray_consecutive_adj": [["0011"], "On five bits, consecutive Gray codes 0–31 differ in one bit.",
    forall(["x"], [31], (x) => ccH5(ccGrayNat(x), ccGrayNat(x + 1)) === 1), "x ∈ [31]"],
  "ContactCircuits.cc_hd_symm": [["0110"], "Distance between codes does not depend on the order of the pair.",
    forall(["a", "b"], [32, 32], (a, b) => ccH5(ccGrayNat(a), ccGrayNat(b)) === ccH5(ccGrayNat(b), ccGrayNat(a))), "a, b ∈ [32]"],
  "ContactCircuits.cc_he_dist1_ordered_eq_80": [["0110", "1110"], "Exactly 80 of the 400 ordered amino-acid pairs are one bit apart: a random pair is one bit apart with probability 0.200.",
    closed(400, () => ({ ok: ccHeDist1Ordered() === 80, detail: { ordered: ccHeDist1Ordered() } })), "all 400 ordered pairs of codes 0–19"],
  "ContactCircuits.cc_he_dist_counts": [["0110"], "The whole ordered distance distribution, distances 0–5: 20, 80, 132, 112, 48, 8.",
    closed(400, () => { const c = ccHeCounts(); return { ok: c.join() === "20,80,132,112,48,8", detail: { counts: c } }; }), "all 400 ordered pairs of codes 0–19"],
  "ContactCircuits.cc_sep_bin_edges": [["0111"], "The four separation bins start at 6, 11, 21 and 31.",
    closed(8, () => ccSepBin(6) === 0 && ccSepBin(10) === 0 && ccSepBin(11) === 1 && ccSepBin(20) === 1 && ccSepBin(21) === 2 && ccSepBin(30) === 2 && ccSepBin(31) === 3 && ccSepBin(266) === 3), "eight conjuncts"],
  "ContactCircuits.cc_sep_bin_mono": [["0111"], "Further apart in sequence never means a lower separation bin.",
    bounded(["a", "b"], [400, 400], (a, b) => imp(a <= b, ccSepBin(a) <= ccSepBin(b)), "Lean proves this for every natural number by case analysis; the browser re-runs a, b < 400."), "a, b ∈ ℕ (all naturals)"],
  "ContactCircuits.cc_level1_bounded": [["0111"], "A (group, group, separation) cell index is below 256.",
    forall(["gi", "gj", "s"], [8, 8, 4], (gi, gj, s) => ccLevel1(gi, gj, s) < 256), "gi, gj < 8, s < 4 (the cases the hypotheses allow)"],
  "ContactCircuits.cc_level1_injective": [["0111"], "Different (group, group, separation) triples get different cells.",
    forall(["gi", "gj", "s", "gi'", "gj'", "s'"], [8, 8, 4, 8, 8, 4], (gi, gj, s, gi2, gj2, s2) =>
      imp(ccLevel1(gi, gj, s) === ccLevel1(gi2, gj2, s2), gi === gi2 && gj === gj2 && s === s2)), "gi, gj, gi', gj' < 8, s, s' < 4 (the cases the hypotheses allow)"],
  "ContactCircuits.cc_cover_complete": [["0101", "0100"], "Completeness, on a worked example: every 1-cell is covered by some cube of the cover.",
    closed(4, () => ccCoverCompleteB(4, ccTableToy, [ccPiToy], 2)), "the 4 cells of the worked table"],
  "ContactCircuits.cc_off_avoiding": [["0101", "0100"], "Soundness, on the same example: no cube of the cover touches a 0-cell.",
    closed(4, () => ccOffAvoidingB(4, ccTableToy, [ccPiToy], 2)), "the 4 cells of the worked table"],
  "ContactCircuits.cc_fixed_match_unique": [["1010", "0100", "1100"], "On the padded 32×32 grid, a rule with all ten bits fixed fires on exactly one cell: its own.",
    forall(["v", "r", "c"], [32, 32, 1024], (v, r, c) => ccEval(10, 32 * v + r, 0, c) === (c === 32 * v + r)), "v, r ∈ [32], c ∈ [1024]"],
  "ContactCircuits.cc_padding_safety": [["1010", "1100"], "Padding is inert for exact rules: a fully fixed rule about real residues (row and column below 20) fires only inside the 20×20 block, never on padding.",
    forall(["v", "r", "c"], [20, 20, 1024], (v, r, c) => imp(ccEval(10, 32 * v + r, 0, c), Math.floor(c / 32) < 20 && c % 32 < 20)), "v, r < 20, c < 1024 (the cases the hypotheses allow)"],

  // ── sequence circuits ─────────────────────────────────────────────────────
  "SequenceCircuits.sc_low_free_is_interval": [["0101", "1100"], "With plain-binary positions, a cube whose free bits are the low ones is exactly an unbroken stretch of the chain: positions v to v + 2ᵘ − 1.",
    forall(["u", "v", "i"], [9, 256, 256], (u, v, i) => imp(v % 2 ** u === 0, scEval(8, v, 2 ** u - 1, i) === (v <= i && i < v + 2 ** u))), "u ∈ [9], v, i ∈ [256]"],
  "SequenceCircuits.sc_interval_span": [["0101", "1100"], "Such a cube covers exactly 2ᵘ positions, so a block's length can be read off its free bits.",
    forall(["u", "v"], [9, 256], (u, v) => {
      if (v % 2 ** u !== 0 || v + 2 ** u > 256) return true;
      let c = 0; for (let i = 0; i < 256; i++) if (scEval(8, v, 2 ** u - 1, i)) c++;
      return c === 2 ** u;
    }), "u ∈ [9], v ∈ [256]"],
  "SequenceCircuits.sc_contact_cube_is_block": [["0101", "1100", "1101"], "A contact-map cube with low free bits in both fields is a block: one chain segment against another.",
    forall(["u", "w", "vi", "vj", "i", "j"], [5, 5, 16, 16, 16, 16], (u, w, vi, vj, i, j) => {
      if (vi % 2 ** u !== 0 || vj % 2 ** w !== 0) return true;
      const lhs = scEval(8, 16 * vi + vj, 16 * (2 ** u - 1) + (2 ** w - 1), 16 * i + j);
      return lhs === ((vi <= i && i < vi + 2 ** u) && (vj <= j && j < vj + 2 ** w));
    }), "u, w ∈ [5], vi, vj, i, j ∈ [16]"],
  "SequenceCircuits.sc_gray_cube_is_also_interval": [["0101", "1110"], "Under Gray-coded positions the same cube is still an unbroken stretch, just a relabelled one.",
    forall(["u", "v"], [5, 16], (u, v) => {
      if (v % 2 ** u !== 0) return true;
      const lhs = filterRange(16, (i) => scEval(4, v, 2 ** u - 1, scGray(i)));
      for (let s = 0; s < 16; s++) if (s % 2 ** u === 0 && sameList(lhs, filterRange(16, (i) => s <= i && i < s + 2 ** u))) return true;
      return false;
    }), "u ∈ [5], v ∈ [16]"],
  "SequenceCircuits.sc_gray_relabels_segments": [["0101", "1110", "1101"], "…but not always the same stretch: binary and Gray disagree about which segment a cube names, so the two must never be mixed.",
    exists(["v"], [16], (v) => v % 4 === 0 && !sameList(filterRange(16, (i) => scEval(4, v, 3, scGray(i))), filterRange(16, (i) => scEval(4, v, 3, i)))), "v ∈ [16]"],
  "SequenceCircuits.sc_cell_injective": [["1111"], "Packing (position, residue) into one number is lossless, so the sequence can be read back from its circuit.",
    forall(["i", "i'", "a", "a'"], [64, 64, 32, 32], (i, i2, a, a2) => imp(scCell(5, i, a) === scCell(5, i2, a2), i === i2 && a === a2)), "i, i' ∈ [64], a, a' ∈ [32]"],
  "SequenceCircuits.sc_no_cross_residue_merge": [["1111"], "Two cells with different positions and different residues are never one bit apart, so minimisation can never merge across residues.",
    forall(["i", "i'", "a", "a'"], [32, 32, 32, 32], (i, i2, a, a2) => imp(i !== i2 && a !== a2, 2 <= scHamming(10, scCell(5, i, a), scCell(5, i2, a2)))), "i, i', a, a' ∈ [32]"],
  "SequenceCircuits.sc_residue_field_fixed": [["1111"], "Flipping any one residue bit at a fixed position gives a different cell.",
    forall(["i", "a", "k"], [32, 32, 5], (i, a, k) => scCell(5, i, a) !== scCell(5, i, a ^ (1 << k))), "i, a ∈ [32], k ∈ [5]"],
  "SequenceCircuits.sc_gray_gf2_linear": [["1110"], "The Gray code is linear over GF(2): g(x ⊕ y) = g(x) ⊕ g(y).",
    forall(["x", "y"], [32, 32], (x, y) => scGray(x ^ y) === (scGray(x) ^ scGray(y))), "x, y ∈ [32]"],
  "SequenceCircuits.sc_gray_xor_closed": [["1110"], "The same identity read the other way: XOR of codes is the code of the XOR.",
    forall(["x", "y"], [32, 32], (x, y) => (scGray(x) ^ scGray(y)) === scGray(x ^ y)), "x, y ∈ [32]"],
  "SequenceCircuits.sc_gray_low_bit_commutes": [["1110"], "Flipping the lowest bit commutes with Gray coding, so 2×2 pooling groups the same pairs either way.",
    forall(["x"], [32], (x) => scGray(x ^ 1) === (scGray(x) ^ 1)), "x ∈ [32]"],
  "SequenceCircuits.sc_gray_changes_hamming": [["1110"], "What the Gray code does change: some pair of numbers sits at a different Hamming distance after coding.",
    exists(["x", "y"], [32, 32], (x, y) => scHamming(5, x, y) !== scHamming(5, scGray(x), scGray(y))), "x, y ∈ [32]"],
  "SequenceCircuits.sc_gray_bijective_on_5bits": [["1110"], "On five bits the Gray code is a bijection, so recoding a map only permutes its cells.",
    forall(["x", "y"], [32, 32], (x, y) => imp(scGray(x) === scGray(y), x === y)), "x, y ∈ [32]"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const SLICE_MS = 12;
const yieldNow = () => new Promise((r) => setTimeout(r, 0));
const product = (dims) => dims.reduce((a, b) => a * b, 1);

function expectedCases(spec) {
  switch (spec.kind) {
    case "closed": return spec.cases;
    case "given": return 1;
    default: return product(spec.dims);
  }
}
const scopeOf = (spec) => ({ forall: "all-cases", closed: "closed", exists: "witness", given: "witness", bounded: "bounded" })[spec.kind];
const named = (vars, xs) => Object.fromEntries(vars.map((v, k) => [v, xs[k]]));

async function runSpec(spec, { onProgress, signal } = {}) {
  const scope = scopeOf(spec);
  if (spec.kind === "closed" || spec.kind === "given") {
    const t0 = now();
    let ok, detail;
    if (spec.kind === "closed") {
      const r = spec.evalFn();
      ok = typeof r === "object" ? r.ok : r;
      detail = typeof r === "object" ? r.detail : undefined;
    } else ok = spec.pred(...spec.witness);
    const ms = now() - t0;
    onProgress?.(1, 1);
    const out = { ok: !!ok, cases: expectedCases(spec), ms, scope };
    if (detail) out.detail = detail;
    if (spec.kind === "given") out.witness = named(spec.vars, spec.witness);
    return out;
  }
  const { dims, pred, vars } = spec;
  const n = dims.length, total = product(dims);
  const x = [0, 0, 0, 0, 0, 0];
  const want = spec.kind === "exists";            // exists: stop at pred true; forall/bounded: stop at pred false
  let done = 0, ms = 0, hit = null;
  while (done < total) {
    const s = now();
    while (done < total) {
      const r = pred(x[0], x[1], x[2], x[3], x[4], x[5]);
      if (r === want) { hit = x.slice(0, n); done++; break; }
      done++;
      for (let d = n - 1; d >= 0; d--) { if (++x[d] < dims[d]) break; x[d] = 0; }
      if ((done & 8191) === 0 && now() - s > SLICE_MS) break;
    }
    ms += now() - s;
    if (hit) break;
    onProgress?.(done, total);
    if (done < total) {
      await yieldNow();
      if (signal?.aborted) throw new DOMException("Check cancelled", "AbortError");
    }
  }
  onProgress?.(done, total);
  if (spec.kind === "exists") {
    return hit ? { ok: true, cases: done, ms, scope, witness: named(vars, hit), searched: total }
      : { ok: false, cases: done, ms, scope, searched: total };
  }
  const out = { ok: !hit, cases: done, ms, scope };
  if (hit) out.counterexample = named(vars, hit);
  if (spec.kind === "bounded") out.note = spec.note;
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────
const TRUST = {
  compiler: "Proved by evaluating every case in compiled code (directly or through a lemma), so the proof also trusts Lean's compiler.",
  kernel: "Proved by steps that Lean's small kernel re-checks, using only its standard axioms.",
  none: "Proved by steps that Lean's kernel re-checks, with no axioms at all.",
};
export const TRUST_TEXT = TRUST;
export const TRUST_SHORT = { compiler: "compiled check", kernel: "kernel-checked", none: "no axioms" };

/** The topics the theorems are grouped in, in reading order. */
export const TOPIC_TITLES = {
  KmapProofs: "Gray code and the DNA letters", KmerIndexing: "k-mer Karnaugh maps", AminoAcidEncoding: "The amino-acid code",
  ContactMapCompleteness: "An 8-residue contact map", KmapEncodingEquiv: "The five-bit cube", ContactCircuits: "Contact circuits",
  SequenceCircuits: "Sequence circuits",
};
export const TOPIC_LIST = TOPICS.map((k) => ({ key: k, title: TOPIC_TITLES[k] }));
export { NOTATION };

export const THEOREMS = THEOREM_META.map((m) => {
  const row = T[m.id], st = STATEMENTS[m.id];
  if (!row) throw new Error(`lean.js: no check registered for ${m.id}`);
  if (!st) throw new Error(`lean.js: no mathematical statement for ${m.id}`);
  if (!TOPIC_TITLES[m.topic]) throw new Error(`lean.js: no title for topic ${m.topic}`);
  const [chapters, meaning, spec, domain] = row;
  const t = {
    id: m.id, name: m.id.split(".").pop(), topic: m.topic, trust: m.trust,
    statement: st.html, where: st.where,
    meaning, chapters, domain, spec,
    scope: scopeOf(spec),
    cases: expectedCases(spec),
    note: spec.note || null,
  };
  t.check = (opts) => runSpec(spec, opts);
  return Object.freeze(t);
});
for (const id of Object.keys(T)) if (!THEOREMS.find((t) => t.id === id)) throw new Error(`lean.js: ${id} is not a theorem of the development`);

const BY_ID = new Map(THEOREMS.map((t) => [t.id, t]));
const BY_NAME = new Map();
for (const t of THEOREMS) BY_NAME.set(t.name, [...(BY_NAME.get(t.name) || []), t]);

/** get(id), or by the short key when it is unique (internal references only; never shown). */
export function get(ref) {
  if (BY_ID.has(ref)) return BY_ID.get(ref);
  const list = BY_NAME.get(ref);
  if (!list) throw new Error(`Unknown theorem "${ref}"`);
  if (list.length > 1) throw new Error(`"${ref}" is ambiguous: use one of ${list.map((t) => t.id).join(", ")}`);
  return list[0];
}
export const has = (ref) => BY_ID.has(ref) || BY_NAME.has(ref);
export const byChapter = (stepId) => THEOREMS.filter((t) => t.chapters.includes(stepId));
export const byTopic = (topic) => THEOREMS.filter((t) => t.topic === topic);

export const STATS = Object.freeze({
  theorems: THEOREMS.length,
  topics: TOPICS.length,
  unproved: 0,
  compiled: THEOREMS.filter((t) => t.trust === "compiler").length,
  kernelOnly: THEOREMS.filter((t) => t.trust === "kernel").length,
  noAxioms: THEOREMS.filter((t) => t.trust === "none").length,
  totalCases: THEOREMS.reduce((a, t) => a + t.cases, 0),
});

export const REPO = "https://github.com/E-Motioner-X-SBS/ICMS_Submission";

/** Re-run every check in topic order. onProgress({index, total, theorem, result, cases}) after each. */
export async function runAll({ onProgress, signal, filter } = {}) {
  const list = filter ? THEOREMS.filter(filter) : THEOREMS;
  const results = [];
  let cases = 0, ms = 0;
  for (let k = 0; k < list.length; k++) {
    if (signal?.aborted) throw new DOMException("Check cancelled", "AbortError");
    const r = await list[k].check({ signal });
    results.push({ id: list[k].id, ...r });
    cases += r.cases; ms += r.ms;
    onProgress?.({ index: k + 1, total: list.length, theorem: list[k], result: r, cases, ms });
  }
  const failures = results.filter((r) => !r.ok);
  return { ok: failures.length === 0, theorems: list.length, cases, ms, results, failures };
}
