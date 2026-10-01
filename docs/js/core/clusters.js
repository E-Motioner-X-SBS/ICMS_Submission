// Strand-pair clusters of block cubes: the same definition as the poster
// (poster/render3d/clusters.js). Blocks tile a β-ladder along its diagonal and may
// leave a one-residue step between neighbours, so two blocks belong to the same
// strand pair when BOTH their i-segments and their j-segments overlap, touch, or are
// at most MAX_GAP residues apart. DOM-free.

export const MAX_GAP = 1;
const gap = (a0, a1, b0, b1) => Math.max(a0, b0) - Math.min(a1, b1); // half-open; <= 0: overlap/touch

/** blocks: [{i0,i1,j0,j1}] half-open, upper triangle. has(i, j): contact test.
 *  → clusters sorted by size: {blocks: [index], pairs: [[i,j]], nPairs, i0, i1, j0, j1} */
export function strandPairClusters(blocks, has) {
  const parent = blocks.map((_, k) => k);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (let a = 0; a < blocks.length; a++)
    for (let b = a + 1; b < blocks.length; b++) {
      const p = blocks[a], q = blocks[b];
      if (gap(p.i0, p.i1, q.i0, q.i1) <= MAX_GAP && gap(p.j0, p.j1, q.j0, q.j1) <= MAX_GAP) parent[find(a)] = find(b);
    }
  const groups = new Map();
  blocks.forEach((_, k) => { const r = find(k); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(k); });
  return [...groups.values()].map((ks) => {
    const pairs = new Map();
    for (const k of ks) {
      const b = blocks[k];
      for (let i = b.i0; i < b.i1; i++) for (let j = b.j0; j < b.j1; j++) {
        if (!has(i, j)) throw new Error(`block cell (${i}, ${j}) is not a contact`);   // the cover is off-avoiding
        pairs.set(`${i},${j}`, [i, j]);
      }
    }
    const P = [...pairs.values()];
    const is = P.map((p) => p[0]), js = P.map((p) => p[1]);
    return { blocks: ks, pairs: P, nPairs: P.length, i0: Math.min(...is), i1: Math.max(...is) + 1, j0: Math.min(...js), j1: Math.max(...js) + 1 };
  }).sort((a, b) => b.nPairs - a.nPairs || a.i0 - b.i0);
}
