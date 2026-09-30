// Which experiments can see the encoding (SequenceCircuits.lean, section on GF(2)).
//
// Top: why the ordering is invisible. The 11 dinucleotide steps of one strand of
// the Drew-Dickerson dodecamer CGCGAATTCGCG (PDB 1BNA) counted into a 4 x 4 map
// twice, the way 44_gray_vs_lex.py builds its maps: lexicographic (FCGR) puts
// pair XY at row i(X), column i(Y) with i = alphabetical index A C G T = 0 1 2 3;
// Gray puts it at row g(i(X)), column g(i(Y)). g(i) = i XOR (i >> 1) reproduces
// the KmapProofs.lean codes A=00 C=01 G=11 T=10 (checked below). Both maps are
// drawn in address order, so the reindexing i -> g(i) is visible as a
// permutation: same 16 values, moved. Measured: cophenetic r identical on the
// 120 protein dipeptide maps (data/gray_vs_lex.json).
//
// Bottom: what Gray does change. Hamming distance d between the 5-bit codes of
// the two residues of each native contact vs a background of non-contacts from
// the same protein and separation bin (data/path_e_gray_adjacency.json). d = 1 is
// the one-bit case, so it alone is orange.
import { mount, el, g, pt, gray, popcount, bits, NUC_RAW, COLORS, FONT, NS, loadJSON } from "../lib.js";

// poster.css sets `svg text { font-family; fill }`, which beats presentation
// attributes, so family, fill and width go into the inline style.
const styleOf = (o) => {
  let st = `font-family:${o.mono ? FONT.mono : FONT.sans};fill:${o.fill || COLORS.ink};`;
  if (!o.mono) st += "font-stretch:87.5%;";
  if (o.italic) st += "font-style:italic;";
  return st;
};
const T = (x, y, s, o = {}) => el("text", { x, y, "font-size": o.size, "font-weight": o.weight || (o.mono ? 400 : 500), "text-anchor": o.anchor, style: styleOf(o) }, [s]);
function S(x, y, parts, o = {}) {                     // one line, several styles
  const t = el("text", { x, y, "font-size": o.size, "text-anchor": o.anchor, style: styleOf(o) });
  for (const [s, p = {}] of parts) {
    const q = { ...o, ...p };
    t.appendChild(el("tspan", { "font-weight": q.weight || (q.mono ? 400 : 500), "font-size": q.size, style: styleOf(q), "baseline-shift": p.sup ? "super" : undefined }, [s]));
  }
  return t;
}
function makeMeasure() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("style", "position:absolute;left:-9999px;top:0;visibility:hidden");
  document.body.appendChild(s);
  const m = (str, o) => { const t = T(0, 0, str, o); s.appendChild(t); const w = t.getComputedTextLength(); t.remove(); return w; };
  m.parts = (parts, o) => { const t = S(0, 0, parts, o); s.appendChild(t); const w = t.getComputedTextLength(); t.remove(); return w; };
  m.done = () => s.remove();
  return m;
}
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export default async function build(host, { w, h }) {
  // ════ the maps, computed ═══════════════════════════════════════════════════
  const SEQ = "CGCGAATTCGCG";                                       // PDB 1BNA, one strand 5'->3'
  const ALPHA = ["A", "C", "G", "T"];                               // lexicographic index i
  const idx = Object.fromEntries(ALPHA.map((b, i) => [b, i]));
  // the Gray index must be the KmapProofs.lean raw code (A=00 C=01 G=11 T=10)
  for (const b of ALPHA) if (gray(idx[b]) !== NUC_RAW[b]) throw new Error(`gf2: g(${idx[b]}) != encode ${b}`);
  const rc = [...SEQ].reverse().map((b) => ({ A: "T", T: "A", G: "C", C: "G" })[b]).join("");
  if (rc !== SEQ) throw new Error("gf2: dodecamer should be self-complementary");
  const steps = [...Array(SEQ.length - 1).keys()].map((k) => SEQ.slice(k, k + 2));
  const count = {};
  for (const s of steps) count[s] = (count[s] || 0) + 1;
  const lex = [...Array(4)].map(() => Array(4).fill(0)), gry = [...Array(4)].map(() => Array(4).fill(0));
  for (const [s, n] of Object.entries(count)) {
    lex[idx[s[0]]][idx[s[1]]] += n;
    gry[gray(idx[s[0]])][gray(idx[s[1]])] += n;
  }
  const flat = (m) => m.flat().slice().sort((a, b) => a - b).join();
  if (flat(lex) !== flat(gry)) throw new Error("gf2: maps are not a permutation of each other");
  if (steps.length !== 11) throw new Error("gf2: step count");
  const rowLetters = { lex: ALPHA, gray: [0, 1, 2, 3].map((p) => ALPHA.find((b) => gray(idx[b]) === p)) };   // A C T G
  // GF(2) linearity, as sc_gray_gf2_linear states it (5 bits, 1,024 cases)
  for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) if (gray(x ^ y) !== (gray(x) ^ gray(y))) throw new Error("gf2: linearity");

  const gvl = await loadJSON("gray_vs_lex.json");
  const cg = gvl.part_a_invariance.cophenetic_gray, cl = gvl.part_a_invariance.cophenetic_lex;
  if (!gvl.part_a_invariance.sorted_cell_values_identical) throw new Error("gf2: cell values differ");
  const cStr = (v) => v.toFixed(6);
  if (cStr(cg) !== cStr(cl)) throw new Error("gf2: cophenetic r differ");

  const pe = await loadJSON("path_e_gray_adjacency.json");
  const obs = pe.observed_h_distribution, bg = pe.background_h_distribution;
  const nObs = obs.reduce((a, b) => a + b, 0), nBg = bg.reduce((a, b) => a + b, 0);
  if (nObs !== pe.n_contacts || nBg !== pe.n_contacts) throw new Error("gf2: distribution totals");
  if (Math.abs(obs[1] / nObs - pe.observed_h1_rate) > 1e-12 || Math.abs(bg[1] / nBg - pe.background_h1_rate) > 1e-12) throw new Error("gf2: h1 rates");
  const pObs = obs.map((v) => (100 * v) / nObs), pBg = bg.map((v) => (100 * v) / nBg);
  const f1 = (v) => v.toFixed(1);
  const enr = (pe.observed_h1_rate / pe.background_h1_rate).toFixed(2);
  if (enr !== pe.enrichment_h1.toFixed(2)) throw new Error("gf2: enrichment");

  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo", "italic 500 semi-condensed 20px Archivo", '400 20px "Plex Mono"']
    .map((f) => document.fonts.load(f).catch(() => null)));
  const M = makeMeasure();

  // ════ type & grid ══════════════════════════════════════════════════════════
  const inset = 1.8;
  const fsH = pt(20.5), fs = pt(19.5), fsS = pt(18.5), fsMono = pt(18.5), fsCell = pt(20);
  const lineH = fs * 1.2;
  const ORANGE = COLORS.flip, ORANGE_LT = "#F6CE9F";

  // top band columns: [letters][grid][bits] -> strip -> [bits][grid][letters] | text
  const letW = Math.max(...ALPHA.map((b) => M(b, { size: fsCell, weight: 700 })));
  const bitW = M("00", { size: fsMono, mono: true });
  const padL = 1.1;                                                  // label <-> grid
  const topY = inset + fsH * 0.78;                                   // title baseline
  const colY = topY + lineH * 1.02;                                  // column-letter baseline
  const gridTop = colY + fsCell * 0.34;
  const topH = h * 0.525;                                            // top band ends here
  const c = Math.min((topH - gridTop - 0.8) / 4, (w * 0.5 - 2 * (letW + bitW + 2 * padL)) / 8 - 0.3);
  const G = 4 * c;
  const strip = Math.max(10, w * 0.068);
  const lexX = inset + letW + padL;                                  // lex grid left
  const lexBitX = lexX + G + padL;                                   // lex bits left
  const grBitX = lexBitX + bitW + strip;                             // gray bits left
  const grX = grBitX + bitW + padL;                                  // gray grid left
  const grLetX = grX + G + padL;
  const blockR = grLetX + letW;
  const colX = blockR + w * 0.03;                                    // right text column
  const colW = w - inset - colX;

  mount(host, w, h, (svg) => {
    const aid = `${host.id || "gf2"}-ah`;
    svg.querySelector("defs").appendChild(el("marker", { id: aid, viewBox: "0 0 10 10", refX: 8.5, refY: 5, markerWidth: 2.3, markerHeight: 2.3, orient: "auto", markerUnits: "userSpaceOnUse" },
      [el("path", { d: "M0,0.8 L10,5 L0,9.2 z", fill: COLORS.ink })]));
    const AH = `url(#${aid})`;

    // ── one 4 x 4 count map ──────────────────────────────────────────────────
    const maxN = Math.max(...lex.flat());
    const RAMP = [COLORS.ink100, COLORS.ink200, COLORS.ink300, COLORS.ink400, COLORS.ink500];
    const fillOf = (n) => (n ? RAMP[Math.max(0, Math.ceil((n / maxN) * RAMP.length) - 1)] : COLORS.paper);
    const drawMap = (m, x0, letters, name) => {
      const grp = g({ "aria-label": `${name} map, rows and columns ${letters.join(" ")}` });
      letters.forEach((b, k) => grp.appendChild(T(x0 + (k + 0.5) * c, colY, b, { size: fsCell, weight: 700, anchor: "middle" })));
      for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
        const n = m[r][q], x = x0 + q * c, y = gridTop + r * c;
        grp.appendChild(el("rect", { x, y, width: c, height: c, fill: fillOf(n), stroke: COLORS.rule, "stroke-width": 0.3 }));
        if (n) grp.appendChild(T(x + c / 2, y + c / 2 + fsCell * 0.35, String(n), { size: fsCell, weight: 700, anchor: "middle", fill: lum(fillOf(n)) < 0.18 ? COLORS.paper : COLORS.ink }));
      }
      grp.appendChild(el("rect", { x: x0, y: gridTop, width: G, height: G, fill: "none", stroke: COLORS.ink300, "stroke-width": 0.35 }));
      svg.appendChild(grp);
    };
    const rowY = (r) => gridTop + (r + 0.5) * c;

    // titles
    svg.appendChild(T(inset, topY, "Lexicographic (FCGR)", { size: fsH, weight: 700 }));
    svg.appendChild(T(blockR, topY, "Gray", { size: fsH, weight: 700, anchor: "end" }));

    drawMap(lex, lexX, ALPHA, "lexicographic");
    drawMap(gry, grX, rowLetters.gray, "Gray");
    for (let r = 0; r < 4; r++) {
      svg.appendChild(T(inset + letW / 2, rowY(r) + fsCell * 0.35, rowLetters.lex[r], { size: fsCell, weight: 700, anchor: "middle" }));
      svg.appendChild(T(grLetX + letW / 2, rowY(r) + fsCell * 0.35, rowLetters.gray[r], { size: fsCell, weight: 700, anchor: "middle" }));
      svg.appendChild(T(lexBitX, rowY(r) + fsMono * 0.34, bits(r, 2), { size: fsMono, mono: true }));
      svg.appendChild(T(grBitX, rowY(r) + fsMono * 0.34, bits(r, 2), { size: fsMono, mono: true }));
    }
    // the wiring: lex row i  ->  Gray row g(i)
    const ax0 = lexBitX + bitW + 0.9, ax1 = grBitX - 0.9;
    const wires = g({ "aria-label": "row i moves to row g(i): 00 to 00, 01 to 01, 10 to 11, 11 to 10" });
    for (let i = 0; i < 4; i++) {
      const y0 = rowY(i), y1 = rowY(gray(i)), moved = y0 !== y1;
      const mx = (ax0 + ax1) / 2;
      wires.appendChild(el("path", {
        d: moved ? `M${ax0},${y0} C${mx},${y0} ${mx},${y1} ${ax1},${y1}` : `M${ax0},${y0} H${ax1}`,
        fill: "none", stroke: moved ? COLORS.ink : COLORS.ink300, "stroke-width": moved ? 0.42 : 0.32, "marker-end": AH, style: `color:${COLORS.ink}`,
      }));
    }
    svg.appendChild(wires);
    const midStrip = (lexBitX + grBitX + bitW) / 2;
    svg.appendChild(S(midStrip, colY, [["i", { italic: true }], [" → "], ["g", { italic: true }], ["("], ["i", { italic: true }], [")"]], { size: fs, anchor: "middle", fill: COLORS.ink2 }));

    // right column, top: what it means
    const fitPick = (cands, o) => cands.find((cand) => (Array.isArray(cand) ? M.parts(cand, o) : M(cand, o)) <= colW) ?? cands[cands.length - 1];
    let ty = topY;
    const put = (cand, o) => { svg.appendChild(Array.isArray(cand) ? S(colX, ty, cand, o) : T(colX, ty, cand, o)); ty += lineH; };
    put("Same 16 counts, moved", { size: fsH, weight: 700 });
    put(fitPick([`${steps.length} steps of ${SEQ}`, `${SEQ}`], { size: fs, fill: COLORS.ink2 }), { size: fs, fill: COLORS.ink2 });
    put(fitPick(["(1BNA), cells in address order", "(1BNA), address order", "cells in address order"], { size: fs, fill: COLORS.ink2 }), { size: fs, fill: COLORS.ink2 });
    ty += lineH * 0.18;
    const n120 = gvl.n_sequences;
    put(fitPick([`◆ cophenetic r, ${n120} maps`, `◆ cophenetic r`, `◆ r, ${n120} maps`], { size: fs, fill: COLORS.teal, weight: 600 }), { size: fs, fill: COLORS.teal, weight: 600 });
    put(`${cStr(cl)} = ${cStr(cg)}`, { size: fsH, fill: COLORS.teal, weight: 700 });

    // ════ bottom: Hamming distance distribution ══════════════════════════════
    const bTop = topH + h * 0.035;                                   // hairline divider y
    svg.appendChild(el("line", { x1: inset, y1: bTop, x2: w - inset, y2: bTop, stroke: COLORS.rule, "stroke-width": 0.3 }));
    const titleY = bTop + fsH * 1.02;
    svg.appendChild(S(inset, titleY, [["What Gray changes: pairs one bit apart ("], ["d", { italic: true }], [" = 1)"]], { size: fsH, weight: 700 }));

    // the one comparison that matters: pairs exactly one bit apart (d = 1)
    const bars = [
      { p: pObs[1], name: "native contacts", fill: ORANGE },
      { p: pBg[1], name: "background pairs", fill: ORANGE_LT },
    ];
    const valW = Math.max(...bars.map((b) => M(`${f1(b.p)}%`, { size: fs, weight: 700 })));
    const nameW = Math.max(...bars.map((b) => M(b.name, { size: fs, fill: COLORS.ink2 })));
    const hero = `${enr}×`;
    const heroSize = pt(30);
    const heroW = M(hero, { size: heroSize, weight: 700 });
    const bx0 = inset, bxMax = w - inset - heroW - 4;                 // bars stop before the hero number
    const rowTop = titleY + lineH * 0.55, rowH = (h - inset - rowTop) / 2;
    const scale = (bxMax - bx0 - valW - 1.5 - nameW - 1.2) / Math.max(...bars.map((b) => b.p));
    const barT = Math.min(rowH * 0.42, 3.6);
    const chart = g({ "aria-label": `Native contacts one bit apart: ${f1(pObs[1])}% versus ${f1(pBg[1])}% of background pairs` });
    bars.forEach((b, k) => {
      const cy = rowTop + rowH * (k + 0.5), len = b.p * scale;
      const r = Math.min(0.7, barT / 2);
      chart.appendChild(el("path", { d: `M${bx0},${cy - barT / 2} H${bx0 + len - r} Q${bx0 + len},${cy - barT / 2} ${bx0 + len},${cy - barT / 2 + r} V${cy + barT / 2 - r} Q${bx0 + len},${cy + barT / 2} ${bx0 + len - r},${cy + barT / 2} H${bx0} Z`, fill: b.fill }));
      chart.appendChild(T(bx0 + len + 1.5, cy + fs * 0.34, `${f1(b.p)}%`, { size: fs, weight: 700 }));
      chart.appendChild(T(bx0 + len + 1.5 + valW + 1.2, cy + fs * 0.34, b.name, { size: fs, fill: COLORS.ink2 }));
    });
    chart.appendChild(el("line", { x1: bx0, y1: rowTop + rowH * 0.12, x2: bx0, y2: rowTop + rowH * 1.88, stroke: COLORS.ink3, "stroke-width": 0.35 }));
    svg.appendChild(chart);
    // the ratio, and what it is a ratio of
    const hx = w - inset;
    svg.appendChild(T(hx, rowTop + rowH + heroSize * 0.36, hero, { size: heroSize, weight: 700, anchor: "end" }));
  }, `Top: the dinucleotide counts of CGCGAATTCGCG (PDB 1BNA, one strand) on a lexicographic and a Gray 4 by 4 map; Gray reindexes rows and columns i to g(i), a permutation of the same 16 cells, so cophenetic r on ${gvl.n_sequences} protein maps is ${cStr(cl)} for both. Bottom: Hamming distance between the codes of contacting residues, d = 0 to 5, native contacts vs background; one bit apart: ${f1(pObs[1])}% vs ${f1(pBg[1])}%, ${enr} times.`);
  M.done();
}
