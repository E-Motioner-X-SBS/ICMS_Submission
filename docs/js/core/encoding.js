// Encodings: letters → bits, and the K-map geometry built on them.
//
// Ported from poster/js/lib.js (the same definitions the Lean files use) and extended to
// DNA/RNA and to k-mer maps. DOM-free: this module runs on the main thread, in workers and
// under Node for tests.
//
// Two nucleotide labellings exist in the Lean files and must never be mixed silently:
//   raw encode  (KmapProofs.encode, KmerIndexing): A=00 C=01 G=11 T=10  — the Gray cycle
//                A→C→G→T→A, one bit per step (gray_cycle_AC/CG/GT/TA). Used for sequences,
//                k-mer K-maps and sequence circuits.
//   grayNat labelling  grayNat(encode n):          A=00 C=01 G=10 T=11  — transitions A↔G and
//                C↔T are one bit (transition_AG/CT), Watson–Crick partners XOR to 11
//                (encode_complement_AT/CG). Used only in chapter 0110 (the 2-cube square).
// RNA: U takes T's code. This is our convention; the Lean files only define A, C, G, T.

// ── Gray code & bits (mirrors KmapProofs.lean) ────────────────────────────────
export const gray = (n) => n ^ (n >>> 1);                                  // grayNat
export const grayInv = (g) => { let v = g; for (let s = 1; s < 32; s <<= 1) v ^= v >>> s; return v; };
export const popcount = (x) => { let c = 0; x >>>= 0; while (x) { c += x & 1; x >>>= 1; } return c; };
export const ham = (a, b) => popcount(a ^ b);                              // hammingDist
export const bits = (n, w) => (n >>> 0).toString(2).padStart(w, "0");
/** Index (from the least significant end) of the single bit where a and b differ, else -1. */
export const flippedBit = (a, b) => { const d = a ^ b; return d && !(d & (d - 1)) ? 31 - Math.clz32(d) : -1; };
/** Mask of the differing bits (for highlighting several). */
export const diffMask = (a, b) => (a ^ b) >>> 0;

// ── Nucleotides ───────────────────────────────────────────────────────────────
export const NUC_RAW = Object.freeze({ A: 0, C: 1, G: 3, T: 2, U: 2 });   // KmapProofs.encode (U: our convention)
export const NUC_GRAYNAT = Object.freeze({ A: 0, C: 1, G: 2, T: 3, U: 3 }); // grayNat(encode n)
export const NUC_AXIS = Object.freeze(["A", "C", "G", "T"]);              // K-map axis order = Gray order of raw codes
export const NUC_OF_RAW = Object.freeze(["A", "C", "T", "G"]);            // raw code → letter (T; use naLetter for RNA)
export const NUC_OF_GRAYNAT = Object.freeze(["A", "C", "G", "T"]);
export const PURINES = Object.freeze(["A", "G"]);
export const PYRIMIDINES = Object.freeze(["C", "T", "U"]);
const isPurine = (x) => x === "A" || x === "G";
const tOf = (x) => (x === "U" ? "T" : x);
/** 'identical' | 'transition' | 'complement' | 'transversion' (complements are also transversions). */
export function nucRelation(a, b) {
  a = tOf(a); b = tOf(b);
  if (a === b) return "identical";
  if (isPurine(a) === isPurine(b)) return "transition";
  const pair = a + b;
  if (pair === "AT" || pair === "TA" || pair === "CG" || pair === "GC") return "complement";
  return "transversion";
}
export const NUC_NAMES = Object.freeze({ A: "adenine", C: "cytosine", G: "guanine", T: "thymine", U: "uracil" });
/** Light-mode hex for nucleotides (letters are always printed on marks). Theme-aware values: css --n-A … */
export const NUC_HEX = Object.freeze({ A: "#008300", C: "#2a78d6", G: "#4a3aa7", T: "#e34948", U: "#e34948" });

// ── Amino acids (AminoAcidEncoding.lean): raw index in group order, code = grayNat(raw) ──
export const GROUPS = Object.freeze([
  { key: "hydrophobic", name: "aliphatic hydrophobic", aa: ["A", "V", "L", "I"], hex: "#9b6a1c" },
  { key: "aromatic", name: "aromatic", aa: ["F", "Y", "W"], hex: "#4a3aa7" },
  { key: "sulfur", name: "sulfur-containing", aa: ["M", "C"], hex: "#008300" },
  { key: "breaker", name: "structure-breaking", aa: ["P", "G"], hex: "#e87ba4" },
  { key: "polar", name: "polar uncharged", aa: ["S", "T", "N", "Q"], hex: "#1baf7a" },
  { key: "negative", name: "negatively charged", aa: ["D", "E"], hex: "#e34948" },
  { key: "positive", name: "positively charged", aa: ["H", "K", "R"], hex: "#2a78d6" },
].map((g) => Object.freeze({ ...g, cssVar: `--g-${g.key}` })));
export const AA_ORDER = Object.freeze(GROUPS.flatMap((grp) => grp.aa));   // raw index 0..19
export const AA_RAW = Object.freeze(Object.fromEntries(AA_ORDER.map((a, i) => [a, i])));
export const AA_CODE = Object.freeze(Object.fromEntries(AA_ORDER.map((a, i) => [a, gray(i)])));
export const AA_GROUP = Object.freeze(Object.fromEntries(GROUPS.flatMap((grp) => grp.aa.map((a) => [a, grp]))));
export const CODE_AA = Object.freeze(Object.fromEntries(Object.entries(AA_CODE).map(([a, c]) => [c, a])));
/** The 12 five-bit codewords no amino acid uses: 16–23 and 28–31. */
export const UNUSED_AA_CODES = Object.freeze(Array.from({ length: 32 }, (_, c) => c).filter((c) => !(c in CODE_AA)));
export const AA_NAMES = Object.freeze({
  A: "alanine", V: "valine", L: "leucine", I: "isoleucine", F: "phenylalanine", Y: "tyrosine", W: "tryptophan",
  M: "methionine", C: "cysteine", P: "proline", G: "glycine", S: "serine", T: "threonine", N: "asparagine",
  Q: "glutamine", D: "aspartate", E: "glutamate", H: "histidine", K: "lysine", R: "arginine",
});

// ── Residue names (mmCIF comp ids) ────────────────────────────────────────────
export const AA3 = Object.freeze({
  ALA: "A", VAL: "V", LEU: "L", ILE: "I", PHE: "F", TYR: "Y", TRP: "W", MET: "M", CYS: "C", PRO: "P",
  GLY: "G", SER: "S", THR: "T", ASN: "N", GLN: "Q", ASP: "D", GLU: "E", HIS: "H", LYS: "K", ARG: "R",
});
/** Non-standard residues mapped explicitly (shown to the user as a note). */
export const AA_NONSTANDARD = Object.freeze({ MSE: "M", SEC: "C", PYL: "K" });
export const NA3 = Object.freeze({ DA: "A", DC: "C", DG: "G", DT: "T", DU: "U", A: "A", C: "C", G: "G", U: "U", T: "T" });

// ── Alphabets ─────────────────────────────────────────────────────────────────
// codeOf(letter) → the code used everywhere downstream (sequence bits, k-mer maps, circuits):
//   protein: 5-bit grayNat(raw)   dna/rna: 2-bit raw encode (A=00 C=01 G=11 T/U=10)
const mk = (kind, name, bits, letters, codeOf, letterOf) => Object.freeze({ kind, name, bits, letters: Object.freeze(letters), codeOf, letterOf });
export const ALPHABETS = Object.freeze({
  protein: mk("protein", "amino acid", 5, [...AA_ORDER], (l) => (l in AA_CODE ? AA_CODE[l] : null), (c) => CODE_AA[c] ?? null),
  dna: mk("dna", "nucleotide", 2, ["A", "C", "G", "T"], (l) => (l in NUC_RAW ? NUC_RAW[l] : null), (c) => NUC_OF_RAW[c] ?? null),
  rna: mk("rna", "nucleotide", 2, ["A", "C", "G", "U"], (l) => (l in NUC_RAW ? NUC_RAW[l] : null), (c) => (c === 2 ? "U" : NUC_OF_RAW[c] ?? null)),
});
export const alphabet = (entityType) => {
  const a = ALPHABETS[entityType];
  if (!a) throw new Error(`No alphabet for entity type "${entityType}"`);
  return a;
};
/** Colour (light-mode hex) for a letter of a given entity type. */
export function letterHex(letter, entityType) {
  if (entityType === "protein") return AA_GROUP[letter]?.hex ?? "#7B8A99";
  return NUC_HEX[letter] ?? "#7B8A99";
}
/** CSS custom property name carrying the theme-aware colour of a letter. */
export function letterVar(letter, entityType) {
  if (entityType === "protein") return AA_GROUP[letter] ? AA_GROUP[letter].cssVar : "--ink-3";
  return letter in NUC_HEX ? `--n-${tOf(letter)}` : "--ink-3";
}

/** Encode a one-letter sequence. Letters outside the alphabet become null (never silently dropped). */
export function encodeSequence(seq, entityType) {
  const A = alphabet(entityType);
  const letters = [...seq];
  const codes = letters.map((l) => A.codeOf(l));
  return { kind: A.kind, bits: A.bits, letters, codes, unknown: codes.reduce((n, c) => n + (c === null), 0) };
}
/** "RDL" → "11010 01000 00011" */
export const bitString = (codes, width, sep = " ") => codes.map((c) => (c === null ? "?".repeat(width) : bits(c, width))).join(sep);

// ── K-map geometry ────────────────────────────────────────────────────────────
// A K-map over n bits splits them into rowBits (high) and colBits (low). Each axis is laid
// out in Gray order: display position p carries the label gray(p), so neighbouring cells
// (including across the wrapped edge) differ in one bit.
/** Row/column split: nucleotide k-mers 2k bits → k + k (2×2, 4×4, 8×8, 16×16, as in KmerIndexing.lean
 * and gray_nucleotide.kmer_to_row_col); protein 5 bits → 2 + 3 (4×8), 10 bits → 5 + 5 (32×32). */
export function kmapShape(totalBits) {
  const rowBits = Math.floor(totalBits / 2), colBits = totalBits - rowBits;
  return Object.freeze({ totalBits, rowBits, colBits, rows: 1 << rowBits, cols: 1 << colBits });
}
/** Labels (bit patterns) in display order along an axis of nBits. */
export const kmapAxis = (nBits) => Array.from({ length: 1 << nBits }, (_, p) => gray(p));
/** Display position of an axis label. */
export const axisPos = (label) => grayInv(label);
/** Code → {row, col (labels), x, y (display positions)}. */
export function kmapCell(code, shape) {
  const row = code >>> shape.colBits, col = code & (shape.cols - 1);
  return { code, row, col, x: grayInv(col), y: grayInv(row) };
}
/** Display position → code. */
export const kmapCode = (x, y, shape) => (gray(y) << shape.colBits) | gray(x);
/** All codes one bit away, with the bit index (0 = least significant). */
export const oneBitNeighbours = (code, totalBits) => Array.from({ length: totalBits }, (_, b) => ({ code: code ^ (1 << b), bit: b }));
/** For a one-bit neighbour, how it sits on the drawn map: 'side' (touching), 'wrap' (touching across the
 * wrapped edge) or 'mirror' (a K-map neighbour that is not drawn next to it; happens with ≥ 3 bits per axis). */
export function neighbourPlacement(code, other, shape) {
  const a = kmapCell(code, shape), b = kmapCell(other, shape);
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) return "side";
  if ((dy === 0 && dx === shape.cols - 1 && shape.cols > 2) || (dx === 0 && dy === shape.rows - 1 && shape.rows > 2)) return "wrap";
  return "mirror";
}

// ── k-mers ────────────────────────────────────────────────────────────────────
/** Concatenate symbol codes, first symbol most significant (dinucEncode: g1 * 4 + g2). */
export function kmerCode(symbolCodes, bitsPerSymbol) {
  let c = 0;
  for (const s of symbolCodes) c = c * (1 << bitsPerSymbol) + s;
  return c;
}
/** Split a k-mer code back into symbol codes. */
export function kmerSymbols(code, k, bitsPerSymbol) {
  const out = new Array(k), m = (1 << bitsPerSymbol) - 1;
  for (let t = k - 1; t >= 0; t--) { out[t] = code & m; code >>>= bitsPerSymbol; }
  return out;
}
export function kmerString(code, k, entityType) {
  const A = alphabet(entityType);
  return kmerSymbols(code, k, A.bits).map((c) => A.letterOf(c) ?? "·").join("");
}
/** Overlapping k-mer frequencies. Windows touching an unknown letter, or crossing one of `breaks`
 * (indices that start a new strand or follow a gap in the modelled chain), are skipped.
 * Returns {k, bits, totalBits, shape, counts: Uint32Array(2^(k·bits)), windows, skipped, distinct}. */
export function kmerCounts(seq, k, entityType, breaks = null) {
  const A = alphabet(entityType);
  const totalBits = k * A.bits;
  if (totalBits > 20) throw new Error(`k = ${k} gives a map of 2^${totalBits} cells; too large to draw`);
  const { codes } = encodeSequence(seq, entityType);
  const counts = new Uint32Array(1 << totalBits);
  let windows = 0, skipped = 0, crossing = 0;
  const crosses = (i) => { if (!breaks) return false; for (let t = i + 1; t < i + k; t++) if (breaks.has(t)) return true; return false; };
  for (let i = 0; i + k <= codes.length; i++) {
    if (crosses(i)) { crossing++; continue; }                 // spans a strand junction or a gap in the chain
    const w = codes.slice(i, i + k);
    if (w.some((c) => c === null)) { skipped++; continue; }
    counts[kmerCode(w, A.bits)]++; windows++;
  }
  let distinct = 0; for (const n of counts) if (n) distinct++;
  return { k, bits: A.bits, totalBits, shape: kmapShape(totalBits), counts, windows, skipped, crossing, distinct };
}

// ── Code geometry ─────────────────────────────────────────────────────────────
/** Proven histogram over the 190 unordered pairs of the 20 amino acids: [d0..d5] = [0,40,66,56,24,4]. */
export function aaPairHistogram() {
  const h = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) h[ham(gray(i), gray(j))]++;
  return h;
}
/** Histogram of code distances between consecutive symbols of a sequence (null codes skipped). */
export function neighbourDistanceHistogram(codes, width, breaks = null) {
  const h = new Array(width + 1).fill(0);
  for (let i = 0; i + 1 < codes.length; i++) if (codes[i] !== null && codes[i + 1] !== null && !(breaks && breaks.has(i + 1))) h[ham(codes[i], codes[i + 1])]++;
  return h;
}
/** The 5-cube drawn as a 4×8 K-map (rows: high 2 bits, columns: low 3 bits, both in Gray order). */
export const Q5_SHAPE = kmapShape(5);
/** 2-cube square in the grayNat labelling: vertex positions (x, y ∈ {0,1}) walk A→C→T→G round the square. */
export const NA_SQUARE = Object.freeze({ A: { x: 0, y: 0 }, C: { x: 1, y: 0 }, T: { x: 1, y: 1 }, G: { x: 0, y: 1 } });

// ── Self-check against the numbers the Lean files prove ───────────────────────
export function selfCheck() {
  const fails = [];
  const hist = aaPairHistogram().slice(1);
  if (hist.join() !== "40,66,56,24,4") fails.push(`distance histogram ${hist} ≠ 40,66,56,24,4 (unorderedDistanceDistribution)`);
  for (const [a, b] of [["F", "H"], ["Y", "E"], ["W", "R"], ["M", "K"]]) if (ham(AA_CODE[a], AA_CODE[b]) !== 5) fails.push(`max_distance_${a}${b}`);
  for (const [a, b] of [["D", "E"], ["H", "K"], ["K", "R"]]) if (ham(AA_CODE[a], AA_CODE[b]) !== 1) fails.push(`charge_adjacency_${a}${b}`);
  for (let n = 0; n < 255; n++) if (ham(gray(n), gray(n + 1)) !== 1) fails.push(`gray_hamming_one at ${n}`);
  const cyc = ["A", "C", "G", "T", "A"];
  for (let i = 0; i < 4; i++) if (ham(NUC_RAW[cyc[i]], NUC_RAW[cyc[i + 1]]) !== 1) fails.push(`gray_cycle_${cyc[i]}${cyc[i + 1]}`);
  for (const b of ["A", "C", "G", "T"]) if (NUC_GRAYNAT[b] !== gray(NUC_RAW[b])) fails.push(`grayNat labelling of ${b}`);
  if ((NUC_GRAYNAT.A ^ NUC_GRAYNAT.T) !== 3 || (NUC_GRAYNAT.C ^ NUC_GRAYNAT.G) !== 3) fails.push("encode_complement_AT/CG");
  if (ham(NUC_GRAYNAT.A, NUC_GRAYNAT.G) !== 1 || ham(NUC_GRAYNAT.C, NUC_GRAYNAT.T) !== 1) fails.push("transition_AG/CT");
  NUC_AXIS.forEach((b, p) => { if (NUC_RAW[b] !== gray(p)) fails.push(`axis ${b} not in Gray order`); });
  if (UNUSED_AA_CODES.join() !== "16,17,18,19,20,21,22,23,28,29,30,31") fails.push(`unused codes ${UNUSED_AA_CODES}`);
  if (AA_CODE.A !== 0 || AA_CODE.R !== 0b11010) fails.push("A = 00000, R = 11010");
  if (fails.length) throw new Error("encoding self-check failed: " + fails.join("; "));
  return true;
}
