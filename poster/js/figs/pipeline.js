// Hero schematic (band A, on the pale wash): how a protein becomes a Boolean
// function, each hop wearing the Lean theorem that certifies it.
//
//   (1) sequence       first ten residues of PSICOV 1fnaA (data .sequence),
//                      tiles tinted by amino-acid group, letter white or ink by
//                      WCAG contrast.
//   (2) 5-bit codes    AA_CODE = grayNat(raw index), AminoAcidEncoding.lean.
//   (3) K-map cell     the 32 x 32 residue-pair Karnaugh map. Axes are in K-map
//                      (Gray) order: axis position r carries the label gray(r),
//                      so a code c sits at position grayInv(c). Because every
//                      code is c = gray(raw), residue k sits at position k: the
//                      20 residues fill positions 0..19 in group order (the
//                      colour bars) and the 12 unused codewords (16-23, 28-31)
//                      fill positions 20..31 (white cells). The first dipeptide
//                      R-D is the cell (row R = 11010, column D = 01000) =
//                      (position 19, position 15). Its four touching cells are
//                      exactly one bit away from it (orange = the bit that
//                      flips); the module re-checks that.
//   (4) prime implicant  an 8 x 8 window (residues 1-8 x 11-18) of the real
//                      1fnaA contact map with PLAIN BINARY positions, as the
//                      segment lemma requires. The outlined cube is block
//                      (i 2..3, j 14..15) of data .blocks, i.e. residues 3-4 x
//                      15-16. It was chosen because it lies inside the 16 x 16
//                      corner, so the drawn instance is literally in the 4+4-bit
//                      domain of sc_contact_cube_is_block (vi = 2, vj = 14,
//                      u = w = 1). The module re-checks that every cell is a
//                      contact and that no one-bit growth stays in the on-set.
//   (5) contact block  the same two segments with all four rungs; pairing
//                      direction (antiparallel) from the C-alpha coordinates.
//
// Theorems (lean_proofs/proofs/is_kmap_possible/):
//   1->2 encode_injective         AminoAcidEncoding.lean:102
//   2->3 gray_hamming_one         KmapProofs.lean:40 (n < 255, covers every step
//        of a 5-bit axis; cc_gray_consecutive_adj in ContactCircuits.lean is the
//        5-bit restatement)
//   3->4 cc_cover_complete + cc_off_avoiding   ContactCircuits.lean:145,150:
//        the Bool predicates qm_extract asserts, proved on a worked instance;
//        the 1fnaA cover passes both (data .sound / .complete)
//   4->5 sc_contact_cube_is_block SequenceCircuits.lean:93
//   return 3->1 sc_cell_injective SequenceCircuits.lean:153: the packing
//        (row <<< 5) ||| column is injective (row < 64, column < 32), so the
//        cell gives back both codes and, by encode_injective, both residues.
//        Drawn from the K-map cell, not from the contact-map cube: a contact
//        map does not determine the sequence, so an arrow from (4) would claim
//        more than the theorem says.
//
// poster.css sets `svg text { fill; font-family }`, which beats SVG
// presentation attributes, so every text colour and family here goes through
// the inline style attribute.

import { mount, el, g, pt, gray, grayInv, ham, bits, AA_CODE, AA_RAW, AA_ORDER, AA_GROUP, COLORS, FONT, loadJSON } from "../lib.js";

const css = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}:${v}`).join(";");

export default async function build(host, { w, h }) {
  const data = await loadJSON("contact_1fnaA.json");
  await Promise.all([
    "semi-condensed 500 20px Archivo", "semi-condensed 700 20px Archivo", "semi-condensed 900 20px Archivo",
    "500 20px Archivo", "700 20px Archivo", "900 20px Archivo", `500 20px "Plex Mono"`,
  ].map((f) => document.fonts.load(f)));

  const svg = mount(host, w, h, () => {}, "Pipeline: the protein sequence of 1fnaA becomes 5-bit Gray codes, a cell of a 32 by 32 Karnaugh map, a prime implicant of its contact map and a contact block of two chain segments; each step is labelled with the Lean theorem that certifies it, and a return arrow shows the cell gives back both residues.");

  // ── scale: geometry follows (w, h); type never drops below 18 pt ────────────
  const sx = w / 474, sy = h / 82, s = Math.min(sx, sy);
  const F = (n) => pt(Math.max(18, n * s));               // font size (mm) for n pt
  const inset = 1.8 * s;

  // ── drawing helpers ─────────────────────────────────────────────────────────
  const T = (x, y, str, o = {}) => el("text", {
    x, y, "font-size": o.size ?? F(20), "text-anchor": o.anchor ?? "start",
    style: css({
      "font-family": o.mono ? FONT.mono : FONT.sans, "font-weight": o.weight ?? 500, fill: o.fill ?? COLORS.ink,
      "font-stretch": o.mono ? undefined : `${o.stretch ?? 92}%`,
    }),
  }, [str]);
  const measure = (node) => { svg.appendChild(node); const b = node.getBBox(); node.remove(); return b; };
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const onColor = (hex) => (contrast(hex, "#FFFFFF") >= contrast(hex, COLORS.ink) ? "#FFFFFF" : COLORS.ink);
  const rect = (x, y, rw, rh, o = {}) => el("rect", { x, y, width: rw, height: rh, rx: o.rx, fill: o.fill ?? "none", stroke: o.stroke, "stroke-width": o.sw });
  const line = (x1, y1, x2, y2, o = {}) => el("line", { x1, y1, x2, y2, stroke: o.stroke ?? COLORS.ink, "stroke-width": o.sw ?? 0.4 * s, "stroke-linecap": o.cap ?? "round" });
  const path = (d, o = {}) => el("path", { d, fill: "none", stroke: o.stroke ?? COLORS.ink, "stroke-width": o.sw ?? 0.4 * s, "stroke-linecap": o.cap ?? "round", "stroke-linejoin": "round" });

  // letter tile (square) or bead (circle) in the group colour
  function tile(cx, cy, aa, size, fsz, round = false) {
    const hex = AA_GROUP[aa].hex, fs = F(fsz);
    const shape = round
      ? el("circle", { cx, cy, r: size / 2, fill: hex })
      : rect(cx - size / 2, cy - size / 2, size, size, { rx: size * 0.2, fill: hex });
    return g({}, [shape, T(cx, cy + fs * 0.355, aa, { size: fs, weight: 700, fill: onColor(hex), anchor: "middle", stretch: 100 })]);
  }
  // straight arrow with its own head (independent of markers)
  function arrow(x1, y1, x2, y2, o = {}) {
    const col = o.stroke ?? COLORS.ink, sw = o.sw ?? 0.55 * s, L = o.head ?? 3.3 * s, W = o.hw ?? 1.4 * s;
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
    const bx = x2 - ux * L, by = y2 - uy * L;
    return g({}, [
      line(x1, y1, bx + ux * 0.2, by + uy * 0.2, { stroke: col, sw }),
      el("path", { d: `M${x2},${y2} L${bx - uy * W},${by + ux * W} L${bx + uy * W},${by - ux * W} Z`, fill: col }),
    ]);
  }
  // "proved in Lean" tag, same recipe as the HTML .tag.lean: gold turnstile + mono name
  function pill(name, fsz = 18) {
    const em = F(fsz), padX = 0.42 * em, hgt = 1.45 * em;
    const t = el("text", { x: padX, y: 0.355 * em, "font-size": em, style: css({ fill: COLORS.gold, "font-family": FONT.mono }) }, [
      el("tspan", { style: css({ "font-family": FONT.sans, "font-weight": 800, fill: COLORS.gold }) }, ["⊢"]),
      el("tspan", { dx: 0.34 * em, style: css({ "font-family": FONT.mono, "font-weight": 500, fill: COLORS.gold }) }, [name]),
    ]);
    const pw = measure(t).width + 2 * padX;
    const node = g({}, [rect(0, -hgt / 2, pw, hgt, { rx: 0.5 * em, fill: COLORS.goldWash, stroke: COLORS.gold, sw: pt(1.4) }), t]);
    return { node, w: pw, h: hgt };
  }

  // ── vertical frame (fractions of h) ─────────────────────────────────────────
  const yLane = 6.2 * sy;            // return path, column label, (4) axis numbers
  const gridTop = 14.2 * sy;          // top of both grids
  const G = 36.0 * s;                 // grid side
  const objBottom = gridTop + G;
  const yCap = 57.4 * sy;             // stage captions (baseline)
  const yBus = 60.9 * sy;             // where a tie forks to two tags
  const yPill = 67.3 * sy;            // proof rail (tag centre)
  const yGloss = 78.7 * sy;           // what each theorem guarantees (baseline)

  // ── data ────────────────────────────────────────────────────────────────────
  const seq = data.sequence, N1 = 10, first = [...seq.slice(0, N1)];
  if (first.join("") !== "RDLEVVAATP") throw new Error(`1fnaA sequence starts ${first.join("")}`);
  const [r1, r2] = first;                                   // the first dipeptide
  const rowPos = grayInv(AA_CODE[r1]), colPos = grayInv(AA_CODE[r2]);   // K-map positions
  if (rowPos !== AA_RAW[r1] || colPos !== AA_RAW[r2]) throw new Error("K-map position must equal raw index");

  const onSet = new Set();
  for (const [i, j] of data.contacts) { onSet.add(i * 1000 + j); onSet.add(j * 1000 + i); }
  const isOn = (i, j) => onSet.has(i * 1000 + j);
  const PB = data.pos_bits, L = data.length;
  // showcase cube: the first 2 x 2 block cube that lies inside the 16 x 16 corner
  const blk = data.blocks.find((b) => b.i1 - b.i0 === 2 && b.j1 - b.j0 === 2 && b.i1 <= 16 && b.j1 <= 16);
  if (!blk) throw new Error("no 2 x 2 block inside the 16 x 16 corner of 1fnaA");
  const cubeCells = [];
  for (let i = blk.i0; i < blk.i1; i++) for (let j = blk.j0; j < blk.j1; j++) cubeCells.push([i, j]);
  if (!cubeCells.every(([i, j]) => isOn(i, j))) throw new Error("block cube contains a non-contact");
  {
    // the data cube is (val, mask) over PB + PB bits: low bit of i and of j free
    if (blk.mask !== ((1 << PB) | 1) || blk.val !== ((blk.i0 << PB) | blk.j0)) throw new Error("block is not the low-bit cube it claims");
    const code = (i, j) => (i << PB) | j;
    for (let b = 0; b < 2 * PB; b++) {                         // prime: no one-bit growth stays in the on-set
      if ((blk.mask >> b) & 1) continue;
      const grown = cubeCells.map(([i, j]) => code(i, j) ^ (1 << b)).map((c) => [c >> PB, c & ((1 << PB) - 1)]);
      if (grown.every(([i, j]) => i < L && j < L && isOn(i, j))) throw new Error(`block cube is not prime (bit ${b})`);
    }
  }
  const NW = 8, winR0 = blk.i0 - (blk.i0 % 8), winC0 = blk.j0 - 4;       // 8 x 8 window, cube near the centre
  const dCA = (a, b) => Math.hypot(...data.ca[a].map((v, k) => v - data.ca[b][k]));
  const anti = dCA(blk.i0, blk.j1 - 1) + dCA(blk.i0 + 1, blk.j0) < dCA(blk.i0, blk.j0) + dCA(blk.i0 + 1, blk.j1 - 1);
  const rng = (a, b) => `${a}–${b}`;                           // 1-based residue range label

  // ── horizontal budget: natural widths, then equal gaps ──────────────────────
  const t1 = 6.9 * s, p1 = 7.6 * s;                          // (1) tiles
  const ellW = measure(T(0, 0, "…", { size: F(22) })).width;
  const W1 = N1 * p1 - (p1 - t1) + 1.4 * s + ellW;
  const t2 = 6.3 * s, b2 = 6.3 * s, bg2 = 0.55 * s, rp2 = 7.3 * s, NR2 = 4;   // (2)
  const W2 = t2 + 1.8 * s + 5 * b2 + 4 * bg2;
  const t3 = 5.8 * s, bitsFs = 19;                           // (3)
  const bitsW = measure(T(0, 0, "00000", { size: F(bitsFs), mono: true })).width;
  const lab3W = t3 + 1.2 * s + bitsW;
  const barH = 1.2 * s, barGap = 0.7 * s;
  const W3 = lab3W + 1.6 * s + barH + barGap + G;
  const rowLab = rng(blk.i0 + 1, blk.i1), colLab = rng(blk.j0 + 1, blk.j1);   // (4)
  const rowLabW = measure(T(0, 0, rowLab, { size: F(19) })).width;
  const W4 = rowLabW + 1.6 * s + G;
  const rB = 3.7 * s, bs5 = 15 * s, rs5 = 17 * s, stub5 = 7 * s;   // (5)
  const loopR = rs5 / 2;
  const loopLab = rng(blk.i1 + 1, blk.j0);                    // residues between the segments
  const loopLabW = measure(T(0, 0, loopLab, { size: F(19) })).width;
  const W5 = stub5 + 2 * rB + bs5 + loopR + 1.6 * s + loopLabW;
  const gap = (w - 2 * inset - (W1 + W2 + W3 + W4 + W5)) / 4;
  if (gap < 30 * s) throw new Error(`pipeline: gaps too narrow (${gap.toFixed(1)} mm)`);
  const X1 = inset, X2 = X1 + W1 + gap, X3 = X2 + W2 + gap, X4 = X3 + W3 + gap, X5 = X4 + W4 + gap;

  const c3 = G / 32;
  const y0 = gridTop + (rowPos + 0.5) * c3;                  // flow line = K-map row of residue 1

  const root = g({});
  svg.appendChild(root);
  const add = (n) => (root.appendChild(n), n);

  // ── (1) sequence ────────────────────────────────────────────────────────────
  const tileX = (k) => X1 + t1 / 2 + k * p1;
  first.forEach((aa, k) => add(tile(tileX(k), y0, aa, t1, 21)));
  add(T(tileX(N1 - 1) + t1 / 2 + 1.4 * s, y0 + F(22) * 0.18, "…", { size: F(22), fill: COLORS.ink2 }));
  const yNum1 = y0 + t1 / 2 + F(19) * 1.0;
  add(T(tileX(0), yNum1, "1", { size: F(19), fill: COLORS.ink2, anchor: "middle" }));
  add(T(tileX(N1 - 1), yNum1, String(N1), { size: F(19), fill: COLORS.ink2, anchor: "middle" }));
  const cx1 = X1 + (N1 * p1 - (p1 - t1)) / 2;

  // ── (2) 5-bit Gray codes of the first four residues ─────────────────────────
  const y2top = y0 - (NR2 * rp2 - (rp2 - t2)) / 2;
  for (let k = 0; k < NR2; k++) {
    const aa = first[k], cy = y2top + t2 / 2 + k * rp2, code = bits(AA_CODE[aa], 5);
    add(tile(X2 + t2 / 2, cy, aa, t2, 19));
    for (let b = 0; b < 5; b++) {
      const bx = X2 + t2 + 1.8 * s + b * (b2 + bg2), one = code[b] === "1";
      add(rect(bx, cy - b2 / 2, b2, b2, { rx: 0.9 * s, fill: one ? COLORS.ink : COLORS.paper, stroke: one ? undefined : COLORS.ink200, sw: 0.3 * s }));
      add(T(bx + b2 / 2, cy + F(19) * 0.36, code[b], { size: F(19), mono: true, fill: one ? "#FFFFFF" : COLORS.ink, anchor: "middle" }));
    }
  }
  const cx2 = X2 + W2 / 2;

  // ── (3) the 32 x 32 residue-pair Karnaugh map ───────────────────────────────
  const gx3 = X3 + lab3W + 1.6 * s + barH + barGap;          // grid left
  const barL = gx3 - barGap - barH, barT = gridTop - barGap - barH;
  const runs = [];
  AA_ORDER.forEach((aa, r) => { const gr = AA_GROUP[aa]; if (runs.length && runs.at(-1).gr === gr) runs.at(-1).n++; else runs.push({ gr, r0: r, n: 1 }); });
  for (const run of runs) {                                   // positions 0..19 = residues in group order
    add(rect(barL, gridTop + run.r0 * c3, barH, run.n * c3, { fill: run.gr.hex }));
    add(rect(gx3 + run.r0 * c3, barT, run.n * c3, barH, { fill: run.gr.hex }));
  }
  const nbr = new Set([[rowPos - 1, colPos], [rowPos + 1, colPos], [rowPos, colPos - 1], [rowPos, colPos + 1]].map(([r, c]) => r * 32 + c));
  for (const k of nbr) {                                      // re-check: touching cells are one bit away
    const r = Math.floor(k / 32), c = k % 32;
    if (ham(gray(r) * 32 + gray(c), AA_CODE[r1] * 32 + AA_CODE[r2]) !== 1) throw new Error("K-map neighbour not one bit away");
  }
  const gap3 = Math.min(0.2 * s, c3 * 0.17);
  add(rect(gx3, gridTop, G, G, { fill: COLORS.paper }));
  for (let r = 0; r < 32; r++) for (let c = 0; c < 32; c++) {
    let fill = r < 20 && c < 20 ? COLORS.ink100 : null;       // unused codewords stay white
    if ((r === rowPos && c < colPos) || (c === colPos && r < rowPos)) fill = COLORS.ink200;
    if (nbr.has(r * 32 + c)) fill = COLORS.flip;
    if (r === rowPos && c === colPos) fill = COLORS.ink;
    if (fill) add(rect(gx3 + c * c3 + gap3 / 2, gridTop + r * c3 + gap3 / 2, c3 - gap3, c3 - gap3, { fill }));
  }
  add(rect(gx3, gridTop, G, G, { stroke: COLORS.ink200, sw: 0.25 * s }));
  // row label  R 11010  (residue 1 -> row), on the flow line
  add(tile(X3 + t3 / 2, y0, r1, t3, 18));
  add(T(X3 + t3 + 1.2 * s, y0 + F(bitsFs) * 0.36, bits(AA_CODE[r1], 5), { size: F(bitsFs), mono: true }));
  // column label  D 01000  (residue 2 -> column), above the map with a leader
  const colX = gx3 + (colPos + 0.5) * c3;
  add(tile(colX, yLane, r2, t3, 18));
  add(T(colX + t3 / 2 + 1.2 * s, yLane + F(bitsFs) * 0.36, bits(AA_CODE[r2], 5), { size: F(bitsFs), mono: true }));
  add(line(colX, yLane + t3 / 2 + 0.6 * s, colX, barT - 0.5 * s, { stroke: COLORS.ink, sw: 0.3 * s }));
  const cx3 = gx3 + G / 2;

  // ── (4) contact-map window with the prime-implicant cube ────────────────────
  const gx4 = X4 + rowLabW + 1.6 * s, p4 = G / NW, gap4 = 0.5 * s;
  const inCube = (i, j) => i >= blk.i0 && i < blk.i1 && j >= blk.j0 && j < blk.j1;
  for (let a = 0; a < NW; a++) for (let b = 0; b < NW; b++) {
    const i = winR0 + a, j = winC0 + b;
    const fill = inCube(i, j) ? COLORS.ink : isOn(i, j) ? COLORS.ink300 : COLORS.paper;
    add(rect(gx4 + b * p4 + gap4 / 2, gridTop + a * p4 + gap4 / 2, p4 - gap4, p4 - gap4, { rx: 0.5 * s, fill, stroke: fill === COLORS.paper ? COLORS.ink100 : undefined, sw: 0.3 * s }));
  }
  const a0 = blk.i0 - winR0, b0 = blk.j0 - winC0;
  {
    const o = 1.0 * s;
    add(rect(gx4 + b0 * p4 - o, gridTop + a0 * p4 - o, 2 * p4 + 2 * o, 2 * p4 + 2 * o, { rx: 2.1 * s, stroke: COLORS.ink, sw: 0.75 * s }));
  }
  // the cube's residue ranges, 1-based, on the two axes
  add(T(gx4 - 1.6 * s, gridTop + (a0 + 1) * p4 + F(19) * 0.36, rowLab, { size: F(19), fill: COLORS.ink2, anchor: "end" }));
  add(T(gx4 + (b0 + 1) * p4, gridTop - 2.2 * s, colLab, { size: F(19), fill: COLORS.ink2, anchor: "middle" }));
  const cx4 = gx4 + G / 2;

  // ── (5) contact block: two chain segments, all-to-all rungs ─────────────────
  const yc5 = gridTop + G * 0.47;
  const yA = yc5 - rs5 / 2, yB = yc5 + rs5 / 2;
  const xL = X5 + stub5 + rB, xR = xL + bs5;
  const top = [blk.i0, blk.i0 + 1];                            // left -> right
  const bot = anti ? [blk.j1 - 1, blk.j0] : [blk.j0, blk.j1 - 1];   // under top[0], under top[1]
  const bx5 = [xL, xR];
  const chainSw = 1.25 * s;
  add(line(X5, yA, xR, yA, { stroke: COLORS.ink300, sw: chainSw }));   // chain continues left on both strands
  add(line(X5, yB, xR, yB, { stroke: COLORS.ink300, sw: chainSw }));
  add(path(`M${xR},${yA} A${loopR},${loopR} 0 0 1 ${xR},${yB}`, { stroke: COLORS.ink300, sw: chainSw }));
  add(T(xR + loopR + 1.6 * s, yc5 + F(19) * 0.36, loopLab, { size: F(19), fill: COLORS.ink2 }));
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const [x1, y1, x2, y2] = [bx5[a], yA, bx5[b], yB];
    const d = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / d, uy = (y2 - y1) / d, e = rB + 0.5 * s;
    if (!isOn(top[a], bot[b])) throw new Error("rung is not a contact");
    add(line(x1 + ux * e, y1 + uy * e, x2 - ux * e, y2 - uy * e, { stroke: COLORS.ink, sw: 0.55 * s }));
  }
  top.forEach((i, k) => add(tile(bx5[k], yA, seq[i], 2 * rB, 19, true)));
  bot.forEach((i, k) => add(tile(bx5[k], yB, seq[i], 2 * rB, 19, true)));
  top.forEach((i, k) => add(T(bx5[k], yA - rB - 1.4 * s, String(i + 1), { size: F(19), fill: COLORS.ink2, anchor: "middle" })));
  bot.forEach((i, k) => add(T(bx5[k], yB + rB + F(19) * 0.92, String(i + 1), { size: F(19), fill: COLORS.ink2, anchor: "middle" })));
  const cx5 = (xL + xR) / 2;

  // ── stage captions ─────────────────────────────────────────────────────────
  const caps = [[cx1, "sequence of 1fnaA"], [cx2, "5-bit Gray codes"], [cx3, "Karnaugh map cell"], [cx4, "prime implicant"], [cx5, "contact block"]];
  const capBoxes = caps.map(([x, str]) => {
    const n = add(T(x, yCap, str, { size: F(21), weight: 700, anchor: "middle" }));
    const b = n.getBBox(); return [b.x, b.x + b.width];
  });

  // ── forward arrows, each labelled with what it does ────────────────────────
  const hops = [
    { x1: X1 + W1 + 2.0 * s, x2: X2 - 2.0 * s, verb: "encode", thm: ["encode_injective"], gloss: "one code per residue" },
    { x1: X2 + W2 + 2.0 * s, x2: X3 - 2.0 * s, verb: "pair up", thm: ["gray_hamming_one"], gloss: "touching cells differ in one bit" },
    { x1: gx3 + G + 2.4 * s, x2: X4 - 2.0 * s, verb: "minimise", thm: ["cc_cover_complete", "cc_off_avoiding"], gloss: "the cover check, proved on a worked table" },
    { x1: gx4 + G + 2.4 * s, x2: X5 - 2.0 * s, verb: "decode", thm: ["sc_contact_cube_is_block"], gloss: "the cube is a segment × segment block" },
  ];
  for (const hp of hops) {
    add(arrow(hp.x1, y0, hp.x2, y0));
    hp.gx = (hp.x1 + hp.x2) / 2 - 1.0 * s;                     // tie point, a little behind the head
    add(T(hp.gx, y0 - 2.5 * s, hp.verb, { size: F(20), fill: COLORS.ink2, anchor: "middle" }));
    for (const [l, r] of capBoxes) if (hp.gx > l - 1.2 * s && hp.gx < r + 1.2 * s) throw new Error(`tie of "${hp.verb}" would cross a caption`);
  }

  // ── proof rail: gold tags under their arrows, glosses beneath ──────────────
  const pairGap = 2.4 * s, minGap = 4.5 * s;
  const items = hops.map((hp) => {
    const ps = hp.thm.map((n) => pill(n));
    const iw = ps.reduce((a, p) => a + p.w, 0) + pairGap * (ps.length - 1);
    const glW = measure(T(0, 0, hp.gloss, { size: F(19) })).width;
    return { hp, ps, iw, glW, left: hp.gx - iw / 2 };
  });
  // resolve overlaps: sweep right, then pull back from the right edge
  for (let k = 1; k < items.length; k++) items[k].left = Math.max(items[k].left, items[k - 1].left + items[k - 1].iw + minGap);
  for (let k = items.length - 1; k >= 0; k--) {
    const lim = k === items.length - 1 ? w - inset - items[k].iw : items[k + 1].left - minGap - items[k].iw;
    items[k].left = Math.min(items[k].left, lim);
  }
  if (items[0].left < inset) throw new Error("proof rail does not fit");
  const hP = items[0].ps[0].h, pillTop = yPill - hP / 2;
  const tie = { stroke: COLORS.gold, sw: 0.4 * s, cap: "butt" };
  for (const it of items) {
    let x = it.left;
    const centres = [];
    for (const p of it.ps) {
      p.node.setAttribute("transform", `translate(${x},${yPill})`); add(p.node);
      centres.push(x + p.w / 2); x += p.w + pairGap;
    }
    const gx = it.hp.gx, yFrom = y0 + 0.45 * s;
    if (centres.length === 1) {
      if (gx >= it.left + 3 * s && gx <= it.left + it.iw - 3 * s) add(line(gx, yFrom, gx, pillTop, tie));
      else {
        const xa = Math.min(Math.max(gx, it.left + 3 * s), it.left + it.iw - 3 * s);
        add(path(`M${gx},${yFrom} V${yBus} H${xa} V${pillTop}`, tie));
      }
    } else {
      add(path(`M${gx},${yFrom} V${yBus}`, tie));
      add(path(`M${centres[0]},${pillTop} V${yBus} H${centres.at(-1)} V${pillTop}`, tie));
    }
    const gcx = Math.min(Math.max(it.left + it.iw / 2, inset + it.glW / 2), w - inset - it.glW / 2);
    add(T(gcx, yGloss, it.hp.gloss, { size: F(19), fill: COLORS.ink2, anchor: "middle" }));
  }

  // ── return path: the K-map cell gives both residues back ───────────────────
  {
    const xs = gx3 + 1.4 * s, ys = barT - 0.7 * s;              // leaves the map's top-left corner
    const xe = (tileX(0) + tileX(1)) / 2, ye = y0 - t1 / 2 - 1.0 * s;   // lands on residues 1 and 2
    const rr = 2.6 * s, col = COLORS.ink2, sw = 0.45 * s;
    const P = pill("sc_cell_injective");
    const gl = T(0, 0, "lossless: the cell gives back both residues", { size: F(19), fill: COLORS.ink2 });
    const glW = measure(gl).width, sep = 2.4 * s, pad = 1.8 * s;
    const groupW = P.w + sep + glW;
    const gxl = Math.max(xe + rr + 6 * s, (xs + xe) / 2 - groupW / 2);
    if (gxl + groupW + pad > xs - rr - 2 * s) throw new Error("return-path label does not fit");
    add(path(`M${xs},${ys} V${yLane + rr} Q${xs},${yLane} ${xs - rr},${yLane} H${gxl + groupW + pad}`, { stroke: col, sw }));
    add(path(`M${gxl - pad},${yLane} H${xe + rr} Q${xe},${yLane} ${xe},${yLane + rr} V${ye - 3.0 * s}`, { stroke: col, sw }));
    add(arrow(xe, ye - 3.2 * s, xe, ye, { stroke: col, sw, head: 2.9 * s, hw: 1.25 * s }));
    add(path(`M${tileX(0) - t1 / 2 + 0.4 * s},${ye + 0.2 * s} V${ye - 0.5 * s} H${tileX(1) + t1 / 2 - 0.4 * s} V${ye + 0.2 * s}`, { stroke: col, sw, cap: "butt" }));
    P.node.setAttribute("transform", `translate(${gxl},${yLane})`); add(P.node);
    gl.setAttribute("x", gxl + P.w + sep); gl.setAttribute("y", yLane + F(19) * 0.36); add(gl);
  }
}
