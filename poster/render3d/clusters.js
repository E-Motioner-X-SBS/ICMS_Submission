// Strand-pair clusters of the 1fnaA block cubes (data/contact_1fnaA.json).
//
// Each block is a prime implicant of the contact map with plain-binary position
// bits, i.e. a half-open rectangle [i0,i1) x [j0,j1) of residue pairs that are
// all in contact (sc_contact_cube_is_block). Blocks tile a beta ladder along
// its diagonal and may leave a one-residue step between neighbours, so two
// blocks belong to the same strand pair when BOTH their i-segments and their
// j-segments overlap, touch, or are at most one residue apart.
// Used by render3d/scene.js (colours, rungs) and js/figs/hero3d.js (labels),
// so the picture and its labels come from one definition.

export const MAX_GAP = 1; // residues allowed between blocks of one ladder

const gap = (a0, a1, b0, b1) => Math.max(a0, b0) - Math.min(a1, b1); // half-open; <= 0: overlap/touch

export function strandPairClusters(data) {
  const B = data.blocks;
  const contacts = new Set(data.contacts.map(([i, j]) => `${Math.min(i, j)},${Math.max(i, j)}`));
  const parent = B.map((_, k) => k);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let a = 0; a < B.length; a++)
    for (let b = a + 1; b < B.length; b++) {
      const p = B[a], q = B[b];
      if (gap(p.i0, p.i1, q.i0, q.i1) <= MAX_GAP && gap(p.j0, p.j1, q.j0, q.j1) <= MAX_GAP) parent[find(a)] = find(b);
    }
  const groups = new Map();
  B.forEach((_, k) => { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(k); });
  const clusters = [...groups.values()].map((ks) => {
    const blocks = ks.map((k) => B[k]);
    const pairs = new Map();
    for (const b of blocks)
      for (let i = b.i0; i < b.i1; i++)
        for (let j = b.j0; j < b.j1; j++) {
          // every cell of a block must be a contact (the cover is off-avoiding)
          if (!contacts.has(`${i},${j}`)) throw new Error(`block cell (${i},${j}) is not a contact`);
          pairs.set(`${i},${j}`, [i, j]);
        }
    const iRes = [...new Set([...pairs.values()].map((p) => p[0]))].sort((x, y) => x - y);
    const jRes = [...new Set([...pairs.values()].map((p) => p[1]))].sort((x, y) => x - y);
    return {
      blocks: ks, nBlocks: ks.length, pairs: [...pairs.values()], nPairs: pairs.size,
      i0: iRes[0], i1: iRes[iRes.length - 1] + 1, j0: jRes[0], j1: jRes[jRes.length - 1] + 1, // half-open, 0-based
      iRes, jRes,
    };
  });
  clusters.sort((a, b) => a.i0 - b.i0 || a.j0 - b.j0);
  return clusters;
}

// Residue ranges as a reader expects them: 1-based, inclusive (PSICOV numbering).
export const rangeLabel = (c, dash = "–") => `${c.i0 + 1}${dash}${c.i1} : ${c.j0 + 1}${dash}${c.j1}`;
