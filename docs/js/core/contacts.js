// Contact maps of one chain. DOM-free (runs in workers and Node).
//
// Demo conventions, stated on screen by the chapters that use them:
//   protein  C-beta atoms (C-alpha for glycine, or when C-beta is missing) closer than 8 Å and
//            at least 6 apart in the chain: the PSICOV convention of the poster's 150-protein
//            campaign.
//   DNA/RNA  C1′ atoms (P when C1′ is missing) closer than 10 Å and at least 3 apart: a
//            convention chosen for this demo, not a community standard.
// Indices i, j are positions in chain.residues (0-based, modelled residues only).

export const CONTACT_DEFS = Object.freeze({
  protein: Object.freeze({
    atom: "CB", fallback: "CA", glyAtom: "CA", cutoff: 8, minSep: 6, convention: "psicov",
    label: "C-beta atoms (C-alpha for glycine) closer than 8 Å, at least 6 apart in the sequence",
    source: "the PSICOV convention used in the poster's 150-protein campaign",
  }),
  dna: Object.freeze({
    atom: "C1'", fallback: "P", cutoff: 10, minSep: 3, convention: "demo",
    label: "C1′ atoms (P if missing) closer than 10 Å, at least 3 apart along a strand (any two strands may touch)",
    source: "a convention chosen for this demo",
  }),
  rna: Object.freeze({
    atom: "C1'", fallback: "P", cutoff: 10, minSep: 3, convention: "demo",
    label: "C1′ atoms (P if missing) closer than 10 Å, at least 3 apart along a strand (any two strands may touch)",
    source: "a convention chosen for this demo",
  }),
});

/** Representative atom of each residue under a definition: Float32Array(3L), NaN where missing. */
export function representativeCoords(chain, def = CONTACT_DEFS[chain.entityType]) {
  const L = chain.residues.length;
  const xyz = new Float32Array(3 * L).fill(NaN);
  const used = new Array(L).fill(null);
  chain.residues.forEach((r, k) => {
    const primary = def.glyAtom && r.one === "G" ? def.glyAtom : def.atom;
    const p = r.atoms[primary] || r.atoms[def.fallback] || null;
    if (!p) return;
    xyz[3 * k] = p[0]; xyz[3 * k + 1] = p[1]; xyz[3 * k + 2] = p[2];
    used[k] = r.atoms[primary] ? primary : def.fallback;
  });
  return { xyz, used };
}

/**
 * contactMap(chain, def?) → ContactMap
 *   L         number of residues (chain.residues.length)
 *   def       the definition used (CONTACT_DEFS[entityType] unless overridden)
 *   pairs     [[i, j], ...] with i < j; on one strand the sequence numbers differ by ≥ def.minSep;
 *             sorted by i then j
 *   n         pairs.length
 *   coords    Float32Array(3L) representative atom per residue (NaN when missing)
 *   missing   residue indices with no usable atom (they have no contacts)
 *   fallbackUsed  number of residues that used def.fallback instead of def.atom
 *   has(i, j) symmetric membership test
 *   neighbours(i)  sorted partner indices of residue i
 *   dist(i, j)     distance in Å between representative atoms (NaN if missing)
 */
/** Where the chain is not one continuous polymer: strand of each residue (merged nucleic-acid
 *  chains) and its sequence number; `breaks` holds every index that starts a new continuous run
 *  (a new strand, or a jump in the sequence numbering where residues are not modelled). */
export function chainSegments(chain) {
  const R = chain.residues, L = R.length, strand = new Int32Array(L), seq = new Float64Array(L), breaks = new Set();
  if (chain.strands) { let k = 0; chain.strands.forEach((st, n) => { for (let t = 0; t < st.length && k < L; t++) strand[k++] = n; }); }
  for (let k = 0; k < L; k++) {
    const sid = Number(R[k].seqId);
    seq[k] = Number.isFinite(sid) ? sid : k;
    if (k > 0 && (strand[k] !== strand[k - 1] || seq[k] !== seq[k - 1] + 1)) breaks.add(k);
  }
  return { strand, seq, breaks };
}

export function contactMap(chain, def = CONTACT_DEFS[chain.entityType]) {
  if (!def) throw new Error(`No contact definition for ${chain.entityType}`);
  const L = chain.residues.length;
  const { xyz, used } = representativeCoords(chain, def);
  const { strand, seq } = chainSegments(chain);
  const c2 = def.cutoff * def.cutoff;
  const pairs = [];
  const adj = Array.from({ length: L }, () => []);
  for (let i = 0; i < L; i++) {
    const xi = xyz[3 * i], yi = xyz[3 * i + 1], zi = xyz[3 * i + 2];
    if (Number.isNaN(xi)) continue;
    for (let j = i + 1; j < L; j++) {
      // "at least minSep apart in the chain": by sequence number within a strand; residues on
      // different strands are never neighbours along a chain
      if (strand[i] === strand[j] && seq[j] - seq[i] < def.minSep) continue;
      const dx = xyz[3 * j] - xi, dy = xyz[3 * j + 1] - yi, dz = xyz[3 * j + 2] - zi;
      if (dx * dx + dy * dy + dz * dz < c2) { pairs.push([i, j]); adj[i].push(j); adj[j].push(i); }
    }
  }
  for (const a of adj) a.sort((x, y) => x - y);
  const set = new Set(pairs.map(([i, j]) => i * L + j));
  const missing = [], fb = used.filter((u, k) => { if (u === null) missing.push(k); return u !== null && u === def.fallback && def.fallback !== def.atom && !(def.glyAtom && chain.residues[k].one === "G"); }).length;
  return {
    L, def, pairs, n: pairs.length, coords: xyz, missing, fallbackUsed: fb,
    has: (i, j) => (i < j ? set.has(i * L + j) : set.has(j * L + i)),
    neighbours: (i) => adj[i],
    dist: (i, j) => Math.hypot(xyz[3 * i] - xyz[3 * j], xyz[3 * i + 1] - xyz[3 * j + 1], xyz[3 * i + 2] - xyz[3 * j + 2]),
  };
}
