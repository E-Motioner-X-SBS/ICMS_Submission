// Contact maps are made of blocks (SequenceCircuits.lean: sc_low_free_is_interval,
// sc_contact_cube_is_block; campaign: co-evolution-analysis run_sequence_circuit_campaign.py).
// Left: the native contact map of PSICOV 1fnaA (91 residues; C-beta < 8 A, |i-j| >= 6),
// with the block cubes of its minimal circuit (free bits = the low bits of both
// position fields, >= 2 free bits) drawn on the upper triangle; the largest cluster
// of touching blocks is labelled. Middle: one of those blocks as its address,
// the free bits (the ones that flip inside the cube) in orange, and the segments
// it names. Right: fraction of contacts inside blocks, real vs separation-matched
// shuffles, for 1fnaA and for all 150 proteins (data/campaign.json).
import { mount, el, g, pt, bits, COLORS, FONT, loadJSON } from "../lib.js";
import { strandPairClusters } from "../../render3d/clusters.js";   // one definition, shared with the 3D hero

const styleOf = (o) => `font-family:${o.mono ? FONT.mono : FONT.sans};fill:${o.fill || COLORS.ink};${o.mono ? "" : "font-stretch:87.5%;"}${o.italic ? "font-style:italic;" : ""}`;
const T = (x, y, s, o = {}) => el("text", { x, y, "font-size": o.size, "font-weight": o.weight || 500, "text-anchor": o.anchor, style: styleOf(o) }, [s]);
function S(x, y, parts, o = {}) {
  const t = el("text", { x, y, "font-size": o.size, "text-anchor": o.anchor, style: styleOf(o) });
  for (const [s, p = {}] of parts) t.appendChild(el("tspan", { "font-weight": p.weight || o.weight || 500, style: styleOf({ ...o, ...p }) }, [s]));
  return t;
}

export default async function build(host, { w, h }) {
  const d = await loadJSON("contact_1fnaA.json");
  const camp = await loadJSON("campaign.json");
  const L = d.length, p = d.pos_bits;
  if (L !== 91 || d.contacts.length !== 201 || d.blocks.length !== 16 || !d.sound || !d.complete) throw new Error("contact: 1fnaA data changed");

  // each block must be exactly the cube its (val, mask) describes: low free bits in both fields
  for (const b of d.blocks) {
    const fi = (b.mask >> p) & ((1 << p) - 1), fj = b.mask & ((1 << p) - 1);
    const lowFree = (m) => (m & (m + 1)) === 0;
    if (!lowFree(fi) || !lowFree(fj)) throw new Error("contact: block with non-low free bits");
    if (b.i1 - b.i0 !== Math.min(1 << popc(fi), L - b.i0) || b.j1 - b.j0 !== Math.min(1 << popc(fj), L - b.j0)) throw new Error("contact: block span");
    const cset = new Set(d.contacts.map(([i, j]) => `${i},${j}`));
    for (let i = b.i0; i < b.i1; i++) for (let j = b.j0; j < b.j1; j++)
      if (!cset.has(`${Math.min(i, j)},${Math.max(i, j)}`)) throw new Error("contact: a block cell is not a contact");
  }
  // strand pairs: clusters of blocks (same definition as the 3D hero)
  const clusters = strandPairClusters(d);
  const bigC = clusters.slice().sort((a, b) => b.nPairs - a.nPairs)[0];
  const big = bigC.blocks.map((k) => d.blocks[k]);
  const [bi0, bi1, bj0, bj1] = [bigC.i0 + 1, bigC.i1, bigC.j0 + 1, bigC.j1];   // 1-based, inclusive
  // the example block: one from the big cluster with two free bits split 1 + 1
  const ex = big.find((b) => b.i1 - b.i0 === 2 && b.j1 - b.j0 === 2) ?? big[0];
  const fi = (ex.mask >> p) & ((1 << p) - 1), fj = ex.mask & ((1 << p) - 1);
  const field = (v, m) => [...Array(p)].map((_, k) => { const bit = 1 << (p - 1 - k); return m & bit ? "-" : v & bit ? "1" : "0"; }).join("");
  const iPat = field(ex.val >> p, fi), jPat = field(ex.val & ((1 << p) - 1), fj);

  const bf = camp.block_fraction, row = camp.target_row;
  const pct = (v) => `${(100 * v).toFixed(v < 0.01 && v > 0 ? 2 : 1)}%`;
  const fold = bf.real_mean / bf.shuffled_mean;
  if (Math.round(fold) !== 86) throw new Error("contact: campaign ratio changed");

  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo", '500 20px "Plex Mono"'].map((f) => document.fonts.load(f)));
  const inset = 1.6, fs = pt(20), fsH = pt(21.5), fsM = pt(19);

  mount(host, w, h, (svg) => {
    // ── contact map ────────────────────────────────────────────────────────────
    const tick = fs * 1.9;
    const M = h - 2 * inset - fs * 1.35;
    const cs = M / L, mx = inset + tick, my = inset + fs * 0.2;
    const map = g({ "aria-label": `Contact map of 1fnaA with ${d.blocks.length} block cubes` });
    map.appendChild(el("rect", { x: mx, y: my, width: M, height: M, fill: COLORS.paper, stroke: COLORS.ink300, "stroke-width": 0.3 }));
    for (const [i, j] of d.contacts) for (const [r, c] of [[i, j], [j, i]])
      map.appendChild(el("rect", { x: mx + c * cs, y: my + r * cs, width: cs, height: cs, fill: COLORS.ink300 }));
    for (const b of d.blocks)
      map.appendChild(el("rect", { x: mx + b.j0 * cs, y: my + b.i0 * cs, width: (b.j1 - b.j0) * cs, height: (b.i1 - b.i0) * cs, fill: COLORS.teal }));
    map.appendChild(el("line", { x1: mx, y1: my, x2: mx + M, y2: my + M, stroke: COLORS.rule, "stroke-width": 0.25 }));
    for (const r of [1, 20, 40, 60, 80]) {
      map.appendChild(T(mx - 1, my + (r - 0.5) * cs + fs * 0.34, String(r), { size: fsM, anchor: "end", fill: COLORS.ink2 }));
      map.appendChild(T(mx + (r - 0.5) * cs, my + M + fs * 1.05, String(r), { size: fsM, anchor: "middle", fill: COLORS.ink2 }));
    }
    // the big cluster, circled, with its label in the empty lower triangle
    const cx0 = mx + (bj0 - 1) * cs, cy0 = my + (bi0 - 1) * cs, cw = (bj1 - bj0 + 1) * cs, chh = (bi1 - bi0 + 1) * cs;
    map.appendChild(el("rect", { x: cx0 - 1, y: cy0 - 1, width: cw + 2, height: chh + 2, rx: 1.4, fill: "none", stroke: COLORS.ink, "stroke-width": 0.45 }));
    const lx = mx + M * 0.06, ly = my + M * 0.78;
    map.appendChild(el("path", { d: `M${cx0 - 1},${cy0 + chh * 0.8} L${lx + 40},${ly - fs * 1.1}`, stroke: COLORS.ink, "stroke-width": 0.35, fill: "none" }));
    map.appendChild(T(lx, ly, `β-ladder: ${big.length} blocks`, { size: fs, weight: 700 }));
    map.appendChild(T(lx, ly + fs * 1.2, `${bi0}–${bi1} with ${bj0}–${bj1}`, { size: fsM, fill: COLORS.ink2 }));
    svg.appendChild(map);

    // ── right area: the lemma on one block (top), how common blocks are (bottom) ─
    const rx = mx + M + 8, rw = w - inset - rx;
    let y = inset + fsH * 0.85;
    svg.appendChild(T(rx, y, "One block, as its address", { size: fsH, weight: 700 }));
    y += fsH * 1.45;
    const bitsRow = (label, pat) => {
      svg.appendChild(T(rx, y, label, { size: fsM, italic: true, fill: COLORS.ink2 }));
      const parts = [...pat].map((ch) => [ch, ch === "-" ? { fill: COLORS.flip, weight: 700 } : {}]);
      svg.appendChild(S(rx + fs * 1.2, y, parts, { size: fsM, mono: true }));
    };
    const y0 = y;
    bitsRow("i", iPat); y += fsM * 1.3; bitsRow("j", jPat);
    // decoded meaning, beside the bits
    const dx = rx + fs * 1.2 + fsM * 0.62 * p + 6;
    svg.appendChild(T(dx, y0, `residues ${ex.i0 + 1}–${ex.i1}`, { size: fs, weight: 700 }));
    svg.appendChild(T(dx, y0 + fsM * 1.3, `touch ${ex.j0 + 1}–${ex.j1}`, { size: fs, weight: 700 }));
    y += fsM * 1.35;
    svg.appendChild(S(rx, y, [["free low bits "], ["-", { mono: true, fill: COLORS.flip, weight: 700 }], [" make each field a segment"]], { size: fsM, fill: COLORS.ink2 }));

    // bottom: native vs shuffled, two pairs side by side, and the ratio
    const top = y + fsM * 1.35;
    svg.appendChild(el("line", { x1: rx, y1: top - fsM * 0.75, x2: w - inset, y2: top - fsM * 0.75, stroke: COLORS.rule, "stroke-width": 0.3 }));
    svg.appendChild(T(rx, top + fsH * 0.35, "Contacts inside blocks", { size: fsH, weight: 700 }));
    const heroStr = `${Math.round(fold)}×`, heroSize = pt(34);
    svg.appendChild(T(w - inset, top + fsH * 0.35 + heroSize * 0.9, heroStr, { size: heroSize, weight: 700, anchor: "end" }));
    svg.appendChild(T(w - inset, top + fsH * 0.35 + heroSize * 0.9 + fsM * 1.2, "native vs shuffled", { size: fsM, anchor: "end", fill: COLORS.ink2 }));
    const colW = (rw - 44) / 2;
    const scale = (colW - 26) / Math.max(row.real.frac_minterms_in_blocks, bf.real_mean);
    const pairAt = (x, title, real, shuf) => {
      let by = top + fsH * 1.5;
      svg.appendChild(T(x, by, title, { size: fsM, fill: COLORS.ink2 }));
      by += fsM * 0.55;
      for (const [v, fill, bold] of [[real, COLORS.teal, true], [shuf, COLORS.ink200, false]]) {
        const t = 3.0, len = Math.max(v * scale, 0.6);
        svg.appendChild(el("rect", { x, y: by, width: len, height: t, rx: 0.8, fill }));
        svg.appendChild(T(x + len + 1.3, by + t * 0.9, pct(v), { size: fsM, weight: bold ? 700 : 500 }));
        by += t + fsM * 0.75;
      }
    };
    pairAt(rx, "1fnaA", row.real.frac_minterms_in_blocks, row.shuffled_mean_block_frac);
    pairAt(rx + colW + 4, `${camp.n_targets} proteins`, bf.real_mean, bf.shuffled_mean);
    // legend for the two bar colours
    const ly2 = h - inset - fsM * 0.25;
    svg.appendChild(el("rect", { x: rx, y: ly2 - fsM * 0.62, width: fsM * 0.7, height: fsM * 0.62, rx: 0.3, fill: COLORS.teal }));
    svg.appendChild(T(rx + fsM, ly2, "native", { size: fsM }));
    svg.appendChild(el("rect", { x: rx + fsM * 4.2, y: ly2 - fsM * 0.62, width: fsM * 0.7, height: fsM * 0.62, rx: 0.3, fill: COLORS.ink200 }));
    svg.appendChild(T(rx + fsM * 5.2, ly2, "separation-matched shuffle", { size: fsM }));
  }, `Contact map of 1fnaA with the block cubes of its minimal Boolean circuit; the largest cluster, ${big.length} blocks between residues ${bi0}-${bi1} and ${bj0}-${bj1}, is a beta-ladder. One block's address ${iPat} ${jPat}: its free low bits make it residues ${ex.i0 + 1}-${ex.i1} touching ${ex.j0 + 1}-${ex.j1}. Contacts inside blocks: ${pct(row.real.frac_minterms_in_blocks)} for 1fnaA vs ${pct(row.shuffled_mean_block_frac)} shuffled; ${pct(bf.real_mean)} vs ${pct(bf.shuffled_mean)} across ${camp.n_targets} proteins, ${Math.round(fold)} times.`);
}
function popc(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }
