// Figure "kmap": the dinucleotide Karnaugh map (KmerIndexing.lean `dinucEncode`:
// cell = encode(first) * 4 + encode(second), raw codes A=00 C=01 G=11 T=10).
// Rows = first base, columns = second base, both axes in Gray order A C G T.
// One cell (CT) and its four one-bit neighbours are highlighted, one of them
// reached across the wrapped right edge; every adjacency is checked with ham().
// Right: the map for k = 1..4 (2x2, 4x4, 8x8, 16x16), one cell per k-mer.
import { mount, el, g, txt, spans, pt, ham, bits, NUC_RAW, NUC_AXIS, COLORS, FONT } from "../lib.js";

const MONO_ADV = 0.6, MONO_CAP = 0.698, SANS_CAP = 0.686;
const SANS = { "font-family": FONT.sans, style: "font-stretch: 87.5%" };
const MONO = { "font-family": FONT.mono };
const FLIP_WASH = "#FCEEDC";          // orange at ~15% on white: the one-bit neighbours

async function preloadFonts() {
  await Promise.all(["500 20px Archivo", "700 20px Archivo", "400 20px 'Plex Mono'", "600 20px 'Plex Mono'"]
    .map((f) => document.fonts.load(f).catch(() => null)));
}
function measurer() {
  const s = el("svg", { width: "100mm", height: "100mm", viewBox: "0 0 100 100", style: "position:absolute;left:-9999px;top:0;visibility:hidden" });
  document.body.appendChild(s);
  const fn = (str, attrs) => { const t = s.appendChild(txt(0, 50, str, attrs)); const wd = t.getComputedTextLength(); t.remove(); return wd; };
  fn.done = () => s.remove();
  return fn;
}
function arrowMarker(svg, id, size, color) {
  svg.querySelector("defs").appendChild(el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: size, markerHeight: size, orient: "auto", markerUnits: "userSpaceOnUse" },
    [el("path", { d: "M0,0.6 L10,5 L0,9.4 z", fill: color })]));
  return `url(#${id})`;
}
const flippedPos = (a, b, n) => [...Array(n).keys()].filter((i) => ((a ^ b) >> (n - 1 - i)) & 1);

export default async function build(host, { w, h }) {
  // ── the map, from the Lean definitions ─────────────────────────────────────
  const code = (r, c) => NUC_RAW[NUC_AXIS[r]] * 4 + NUC_RAW[NUC_AXIS[c]];     // dinucEncode
  // axis order must be the Gray order of the raw codes, and every touching pair
  // (wrap included) must differ in one bit
  NUC_AXIS.forEach((b, p) => { if (NUC_RAW[b] !== (p ^ (p >> 1))) throw new Error(`axis ${b} not in Gray order`); });
  const cells = new Set();
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    cells.add(code(r, c));
    if (ham(code(r, c), code(r, (c + 1) % 4)) !== 1 || ham(code(r, c), code((r + 1) % 4, c)) !== 1) throw new Error(`adjacency fails at ${r},${c}`);
  }
  if (cells.size !== 16) throw new Error("dinucleotide cells not distinct");
  const HR = NUC_AXIS.indexOf("C"), HC = NUC_AXIS.indexOf("T");                // highlighted cell CT
  const nbrs = [[HR - 1, HC], [HR + 1, HC], [HR, HC - 1], [HR, HC + 1]].map(([r, c]) => [(r + 4) % 4, (c + 4) % 4]);
  const nbrKey = new Map(nbrs.map(([r, c]) => [`${r},${c}`, flippedPos(code(HR, HC), code(r, c), 4)]));
  for (const f of nbrKey.values()) if (f.length !== 1) throw new Error("neighbour is not one bit away");
  const wrapNbr = nbrs.find(([r, c]) => Math.abs(c - HC) > 1 || Math.abs(r - HR) > 1);

  await preloadFonts();
  const M = measurer();

  mount(host, w, h, (svg) => {
    const arrow = arrowMarker(svg, `${host.id || "kmap"}-ah`, 2.8, COLORS.ink);
    const inset = Math.max(1.8, 0.0095 * w);
    const eA = pt(20), eL = pt(22), eMono = pt(20), eCell = pt(20), eHi = pt(21), eCode = pt(18);

    // ── left: the 4 x 4 map ────────────────────────────────────────────────
    const L = g({}); svg.appendChild(L);
    const axisBase = inset + eA * 0.9;
    const colLabBase = axisBase + eA * 0.21 + eL * 0.95;
    const gy0 = colLabBase + eL * 0.24 + 1.4;
    const cellH = (h - inset - 0.4 - gy0) / 4;
    const labW = (b) => M(b, { ...SANS, "font-size": eL, "font-weight": 700 }) + 1.2 + 2 * eMono * MONO_ADV;
    const rowLabW = Math.max(...NUC_AXIS.map(labW));
    const stubGap = 0.034 * w;                                            // room for the wrap arrow
    const gx0 = inset + 0.01 * w + rowLabW + stubGap;
    const cellW = Math.min(0.093 * w, cellH * 1.3);
    const gx1 = gx0 + 4 * cellW, gy1 = gy0 + 4 * cellH;
    const cx = (c) => gx0 + cellW * (c + 0.5), cy = (r) => gy0 + cellH * (r + 0.5);

    // axis titles
    L.appendChild(txt((gx0 + gx1) / 2, axisBase, "second base", { ...SANS, "font-size": eA, "font-weight": 500, fill: COLORS.ink2, "text-anchor": "middle" }));
    L.appendChild(txt(inset, axisBase, "first base", { ...SANS, "font-size": eA, "font-weight": 500, fill: COLORS.ink2 }));
    // axis labels: base letter + its 2-bit code
    const axisLabel = (x, y, b, anchor) => {
      const wl = M(b, { ...SANS, "font-size": eL, "font-weight": 700 }), wc = 2 * eMono * MONO_ADV, tot = wl + 1.2 + wc;
      const x0 = anchor === "middle" ? x - tot / 2 : x - tot;
      L.appendChild(txt(x0, y, b, { ...SANS, "font-size": eL, "font-weight": 700, fill: COLORS.ink }));
      L.appendChild(txt(x0 + wl + 1.2, y, bits(NUC_RAW[b], 2), { ...MONO, "font-size": eMono, fill: COLORS.ink2 }));
    };
    NUC_AXIS.forEach((b, c) => axisLabel(cx(c), colLabBase, b, "middle"));
    NUC_AXIS.forEach((b, r) => axisLabel(gx0 - stubGap, cy(r) + eL * SANS_CAP / 2, b, "end"));

    // cells
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const key = `${r},${c}`, isHi = r === HR && c === HC, isN = nbrKey.has(key);
      const x = gx0 + c * cellW, y = gy0 + r * cellH;
      if (isN) L.appendChild(el("rect", { x, y, width: cellW, height: cellH, fill: FLIP_WASH }));
      const di = NUC_AXIS[r] + NUC_AXIS[c];
      if (!isHi && !isN) {
        L.appendChild(txt(cx(c), cy(r) + eCell * SANS_CAP / 2, di, { ...SANS, "font-size": eCell, "font-weight": 500, fill: COLORS.ink2, "text-anchor": "middle" }));
        continue;
      }
      // letters + the 4-bit cell code (first base | second base); flipped bit on orange
      const yl = y + cellH * 0.43, yc = y + cellH * 0.89;
      L.appendChild(txt(cx(c), yl, di, { ...SANS, "font-size": eHi, "font-weight": 700, fill: COLORS.ink, "text-anchor": "middle" }));
      const s = bits(code(r, c), 4), f = new Set(isN ? nbrKey.get(key) : []);
      const pitch = eCode * MONO_ADV * 1.02, split = pitch * 0.34, cw = 4 * pitch + split;
      const t = L.appendChild(el("text", { ...MONO, "font-size": eCode, fill: COLORS.ink, "text-anchor": "middle" }));
      for (let i = 0; i < 4; i++) {
        const dx = cx(c) - cw / 2 + pitch * (i + 0.5) + (i >= 2 ? split : 0);
        if (f.has(i)) {
          const bh = eCode * MONO_CAP + 1.0, bw = pitch * 0.98;
          L.insertBefore(el("rect", { x: dx - bw / 2, y: yc - eCode * MONO_CAP / 2 - bh / 2, width: bw, height: bh, rx: bh * 0.16, fill: COLORS.flip }), t);
        }
        t.appendChild(el("tspan", { x: dx, y: yc, "font-weight": f.has(i) ? 600 : 400 }, [s[i]]));
      }
    }
    // grid: hairlines, then the highlighted cell's outline on top
    for (let i = 0; i <= 4; i++) {
      L.appendChild(el("line", { x1: gx0, x2: gx1, y1: gy0 + i * cellH, y2: gy0 + i * cellH, stroke: COLORS.rule, "stroke-width": 0.3 }));
      L.appendChild(el("line", { y1: gy0, y2: gy1, x1: gx0 + i * cellW, x2: gx0 + i * cellW, stroke: COLORS.rule, "stroke-width": 0.3 }));
    }
    L.appendChild(el("rect", { x: gx0 + HC * cellW + 0.35, y: gy0 + HR * cellH + 0.35, width: cellW - 0.7, height: cellH - 0.7, fill: "none", stroke: COLORS.ink, "stroke-width": 0.7 }));
    // wrap: the right edge continues at the left edge (torus)
    if (wrapNbr) {
      const yR = cy(HR);
      const d = stubGap * 0.78;
      L.appendChild(el("path", { d: `M${gx1 + 0.4},${yR} h${d * 0.55} a${d * 0.45},${d * 0.45} 0 0 1 ${d * 0.45},${d * 0.45} v${cellH * 0.12}`, fill: "none", stroke: COLORS.ink, "stroke-width": 0.5, "marker-end": arrow }));
      L.appendChild(el("path", { d: `M${gx0 - d - 0.4},${yR + d * 0.45 + cellH * 0.12} v${-cellH * 0.12} a${d * 0.45},${d * 0.45} 0 0 1 ${d * 0.45},${-d * 0.45} h${d * 0.55 - 0.3}`, fill: "none", stroke: COLORS.ink, "stroke-width": 0.5, "marker-end": arrow }));
    }

    // ── right: how the map grows with k (constant cell size, so growth shows) ──
    const R = g({}); svg.appendChild(R);
    const rx0 = gx1 + stubGap + 0.04 * w, rx1 = w - inset;
    const stripW = rx1 - rx0;
    R.appendChild(txt(rx0, axisBase, "One cell per k-mer", { ...SANS, "font-size": pt(21), "font-weight": 700, fill: COLORS.ink }));
    const sub = { ...SANS, "font-size": pt(20), "font-weight": 500, fill: COLORS.ink2 };
    const subText = ["each added base: 4 × the cells", "4 × the cells per added base", "4 × the cells per base"].find((t) => M(t, sub) <= stripW);
    if (subText) R.appendChild(txt(rx0, colLabBase, subText, sub));
    const lb = { ...SANS, "font-size": pt(20) };
    const labs = [1, 2, 3, 4].map((k) => ({ k, n: 1 << k, a: `k\u2009=\u2009${k}`, b: `${1 << k}\u2009×\u2009${1 << k}` }));
    for (const L2 of labs) L2.w = Math.max(M(L2.a, { ...lb, "font-weight": 700 }), M(L2.b, { ...lb, "font-weight": 500 }));
    const gapX = 0.012 * w;
    // largest cell size for which every column (max of map side and label) fits
    let cs = 2.4;
    const total = (c) => labs.reduce((t, L2) => t + Math.max(L2.n * c, L2.w), 0) + gapX * (labs.length - 1);
    while (cs > 0.6 && total(cs) > stripW) cs -= 0.01;
    if (total(cs) > stripW) throw new Error(`k strip does not fit: stripW ${stripW.toFixed(1)} labels ${labs.map((l) => l.w.toFixed(1))} total ${total(cs).toFixed(1)}`);
    const labBlock = pt(20) * 2.35;
    const maxSide = 16 * cs;
    const yTop = colLabBase + pt(20) * 0.5, yBot = h - inset - 0.4;
    const baseY = yTop + (yBot - yTop - maxSide - labBlock) / 2 + maxSide;       // common baseline of the maps
    let x = rx0;
    for (const L2 of labs) {
      const colW = Math.max(L2.n * cs, L2.w), side = L2.n * cs;
      const x0 = x + (colW - side) / 2, y0 = baseY - side, gap = Math.min(0.28, cs * 0.2);
      for (let r = 0; r < L2.n; r++) for (let c = 0; c < L2.n; c++)
        R.appendChild(el("rect", { x: x0 + c * cs + gap / 2, y: y0 + r * cs + gap / 2, width: cs - gap, height: cs - gap, rx: cs * 0.14, fill: COLORS.ink200 }));
      const xc = x + colW / 2;
      R.appendChild(txt(xc, baseY + pt(20) * 1.0, L2.a, { ...lb, "font-weight": 700, fill: COLORS.ink, "text-anchor": "middle" }));
      R.appendChild(txt(xc, baseY + pt(20) * 2.05, L2.b, { ...lb, "font-weight": 500, fill: COLORS.ink2, "text-anchor": "middle" }));
      x += colW + gapX;
    }
  }, "A 4 by 4 Karnaugh map of the 16 dinucleotides, rows the first base and columns the second, both ordered A C G T with codes 00 01 11 10. Cell CT (0110) is outlined; its four neighbours AT, GT, CG and, across the wrapped edge, CA each differ from it in one bit, marked orange. Beside it the maps for k = 1 to 4: 2 by 2, 4 by 4, 8 by 8 and 16 by 16, one cell per k-mer.");
  M.done();
}
