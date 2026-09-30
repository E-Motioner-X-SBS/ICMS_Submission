// Figure "aa5": the twenty amino acids on the five-cube, flattened into a 4 x 8
// Karnaugh map (rows = first two code bits, columns = last three, both in Gray
// order, so touching cells differ in one bit, edges wrapping), and the proved
// distribution of all 190 pairwise Hamming distances (KmapEncodingEquiv.lean
// `unorderedDistanceDistribution`, `encoding_edge_coverage`).
// Codes come from lib.js AA_CODE = grayNat(raw index), AminoAcidEncoding.lean.
import { mount, el, g, txt, spans, pt, gray, ham, AA_CODE, AA_ORDER, GROUPS, AA_GROUP, CODE_AA, COLORS, FONT } from "../lib.js";

const MONO_ADV = 0.6, MONO_CAP = 0.698, SANS_CAP = 0.686, ASC = 0.74, DESC = 0.24;
const SANS = { "font-family": FONT.sans, style: "font-stretch: 87.5%" };
const MONO = { "font-family": FONT.mono };

async function preloadFonts() {
  await Promise.all(["500 20px Archivo", "700 20px Archivo", "400 20px 'Plex Mono'", "500 20px 'Plex Mono'"]
    .map((f) => document.fonts.load(f).catch(() => null)));
}
// poster.css sets `svg text { font-family; fill }`, which beats SVG presentation
// attributes: move both into the style attribute of every <text>.
function hoist(root) {
  const list = root.tagName === "text" ? [root] : root.querySelectorAll("text");
  for (const t of list) {
    const st = [t.getAttribute("style")];
    for (const k of ["font-family", "fill"]) if (t.hasAttribute(k)) { st.push(`${k}:${t.getAttribute(k)}`); t.removeAttribute(k); }
    t.setAttribute("style", st.filter(Boolean).join(";"));
  }
  return root;
}
function measurer() {
  const s = el("svg", { width: "100mm", height: "100mm", viewBox: "0 0 100 100", style: "position:absolute;left:-9999px;top:0;visibility:hidden" });
  document.body.appendChild(s);
  const fn = (str, attrs) => { const t = s.appendChild(hoist(txt(0, 50, str, attrs))); const wd = t.getComputedTextLength(); t.remove(); return wd; };
  fn.done = () => s.remove();
  return fn;
}
// WCAG relative luminance / contrast, to pick the letter colour on each disc
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => { const [r, gg, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const onColor = (hex) => (contrast(hex, "#FFFFFF") >= contrast(hex, COLORS.ink) ? "#FFFFFF" : COLORS.ink);
const tint = (hex, t) => "#" + rgb(hex).map((v) => Math.round(255 - (255 - v) * t).toString(16).padStart(2, "0")).join("");

export default async function build(host, { w, h }) {
  // ── the facts, computed from the encoding ─────────────────────────────────
  const ROWS = [0, 1, 2, 3].map(gray);                  // 00 01 11 10  (first two bits)
  const COLS = [0, 1, 2, 3, 4, 5, 6, 7].map(gray);      // 000 001 011 010 110 111 101 100 (last three)
  const codeAt = (r, c) => (ROWS[r] << 3) | COLS[c];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {   // touching cells, wrap included, are one bit apart
    if (ham(codeAt(r, c), codeAt(r, (c + 1) % 8)) !== 1) throw new Error(`row ${r}: columns ${c},${c + 1} not one bit apart`);
    if (ham(codeAt(r, c), codeAt((r + 1) % 4, c)) !== 1) throw new Error(`column ${c}: rows ${r},${r + 1} not one bit apart`);
  }
  const cellOf = {};
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) { const a = CODE_AA[codeAt(r, c)]; if (a) cellOf[a] = [r, c]; }
  if (Object.keys(cellOf).length !== 20) throw new Error("not every residue has a cell");
  const nUnused = 32 - 20;
  const hist = [1, 2, 3, 4, 5].map(() => 0), far = [];
  for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) {
    const d = ham(AA_CODE[AA_ORDER[i]], AA_CODE[AA_ORDER[j]]);
    hist[d - 1]++;
    if (d === 5) far.push([AA_ORDER[i], AA_ORDER[j]]);
  }
  const nPairs = hist.reduce((s, v) => s + v, 0);
  if (nPairs !== 190 || hist.join() !== "40,66,56,24,4") throw new Error(`distance histogram ${hist} (unorderedDistanceDistribution says 40,66,56,24,4)`);
  if (far.map((p) => p.join("")).join() !== "FH,YE,WR,MK") throw new Error(`five-bit pairs ${far}`);
  let cubeEdges = 0, usedEdges = 0;
  for (let a = 0; a < 32; a++) for (let b = a + 1; b < 32; b++) if (ham(a, b) === 1) { cubeEdges++; if (a in CODE_AA && b in CODE_AA) usedEdges++; }
  if (cubeEdges !== 80 || usedEdges !== 40 || usedEdges !== hist[0]) throw new Error(`edges ${usedEdges}/${cubeEdges}`);
  // each chemical group must occupy a solid rectangle of cells (drawn as one block)
  const blocks = GROUPS.map((grp) => {
    const rs = grp.aa.map((a) => cellOf[a][0]), cs = grp.aa.map((a) => cellOf[a][1]);
    const b = { grp, r0: Math.min(...rs), r1: Math.max(...rs), c0: Math.min(...cs), c1: Math.max(...cs) };
    if ((b.r1 - b.r0 + 1) * (b.c1 - b.c0 + 1) !== grp.aa.length) throw new Error(`group ${grp.key} is not one block`);
    return b;
  });

  await preloadFonts();
  const M = measurer();

  mount(host, w, h, (svg) => {
    const inset = Math.max(1.8, 0.005 * w);
    const eCap = pt(22), eAx = pt(20), eLab = pt(22), eDisc = pt(28), eLeg = pt(20), eVal = pt(22), eTick = pt(20), eNote = pt(20), ePair = pt(20);
    const bold = (e) => ({ ...SANS, "font-size": e, "font-weight": 700, fill: COLORS.ink });
    const reg = (e, fill = COLORS.ink2) => ({ ...SANS, "font-size": e, "font-weight": 500, fill });
    const mono = (e, fill = COLORS.ink2) => ({ ...MONO, "font-size": e, fill });

    // ── horizontal plan: map | legend | chart ─────────────────────────────────
    const chartW = 0.3 * w;
    const cx0 = w - inset - chartW;
    const gapLC = 0.03 * w, gapGL = 0.02 * w;
    const swD = eLeg * 0.62;
    const legNames = [...GROUPS.map((grp) => grp.name), `unused codeword (${nUnused})`];
    const legW = swD + 1.8 + Math.max(...legNames.map((s) => M(s, reg(eLeg, COLORS.ink))));
    const lx0 = cx0 - gapLC - legW;
    const rowLabW = 2 * eLab * MONO_ADV;
    const gx0 = inset + rowLabW + 2.6;
    const gx1 = lx0 - gapGL;
    const cellW = (gx1 - gx0) / 8;

    // ── vertical plan: caption, axis titles, column labels, grid ──────────────
    const yCap = inset + eCap * ASC + 0.3;
    const yAx = yCap + eCap * DESC + 2.0 + eAx * ASC;
    const yCol = yAx + eAx * DESC + 1.4 + eLab * MONO_CAP;
    const gy0 = yCol + eLab * 0.18 + 1.6;
    const gy1 = h - inset - 0.3;
    const rowH = (gy1 - gy0) / 4;
    const cX = (c) => gx0 + cellW * (c + 0.5), cY = (r) => gy0 + rowH * (r + 0.5);

    const L = g({}); svg.appendChild(L);
    // caption: the title says "cube"; the drawing is its Karnaugh-map flattening
    const capAvail = cx0 - gapLC - inset;
    const capBold = "Flattened into a Karnaugh map";
    const capTail = [": touching cells differ in one bit, and the edges wrap", ": touching cells differ in one bit, edges wrap", ": touching cells differ in one bit", ""]
      .find((t) => M(capBold, bold(eCap)) + M(t, reg(eCap)) <= capAvail);
    L.appendChild(spans(inset, yCap, [[capBold], [capTail, { "font-weight": 500, fill: COLORS.ink2 }]], bold(eCap)));
    // axis titles and bit labels
    L.appendChild(txt(inset, yAx, "first 2 bits", reg(eAx)));
    L.appendChild(txt((gx0 + gx1) / 2, yAx, "last 3 bits", { ...reg(eAx), "text-anchor": "middle" }));
    COLS.forEach((v, c) => L.appendChild(txt(cX(c), yCol, v.toString(2).padStart(3, "0"), { ...mono(eLab, COLORS.ink), "text-anchor": "middle" })));
    ROWS.forEach((v, r) => L.appendChild(txt(gx0 - 2.6, cY(r) + eLab * MONO_CAP / 2, v.toString(2).padStart(2, "0"), { ...mono(eLab, COLORS.ink), "text-anchor": "end" })));

    // grid of hairline cells
    for (let r = 0; r <= 4; r++) L.appendChild(el("line", { x1: gx0, x2: gx1, y1: gy0 + r * rowH, y2: gy0 + r * rowH, stroke: COLORS.rule, "stroke-width": 0.3 }));
    for (let c = 0; c <= 8; c++) L.appendChild(el("line", { x1: gx0 + c * cellW, x2: gx0 + c * cellW, y1: gy0, y2: gy1, stroke: COLORS.rule, "stroke-width": 0.3 }));
    // each group is one solid block of cells: a tinted plate under its letters
    const pad = Math.min(0.9, rowH * 0.07);
    for (const b of blocks) {
      L.appendChild(el("rect", {
        x: gx0 + b.c0 * cellW + pad, y: gy0 + b.r0 * rowH + pad,
        width: (b.c1 - b.c0 + 1) * cellW - 2 * pad, height: (b.r1 - b.r0 + 1) * rowH - 2 * pad,
        rx: rowH * 0.2, fill: tint(b.grp.hex, 0.17),
      }));
    }
    // residues as letter discs, unused codewords as empty rings
    const rD = Math.min(0.4 * rowH, 0.3 * cellW);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
      const a = CODE_AA[codeAt(r, c)];
      if (!a) { L.appendChild(el("circle", { cx: cX(c), cy: cY(r), r: rD * 0.82, fill: "none", stroke: COLORS.ink200, "stroke-width": 0.3 })); continue; }
      const hex = AA_GROUP[a].hex;
      L.appendChild(el("circle", { cx: cX(c), cy: cY(r), r: rD, fill: hex }));
      L.appendChild(txt(cX(c), cY(r) + eDisc * SANS_CAP / 2, a, { ...SANS, "font-size": eDisc, "font-weight": 700, fill: onColor(hex), "text-anchor": "middle" }));
    }

    // ── legend (swatch next to ink text) ──────────────────────────────────────
    const legTop = yAx - eAx * ASC, legBot = gy1;
    const pitch = (legBot - legTop) / legNames.length;
    legNames.forEach((name, k) => {
      const yc = legTop + pitch * (k + 0.5);
      if (k < GROUPS.length) L.appendChild(el("circle", { cx: lx0 + swD / 2, cy: yc, r: swD / 2, fill: GROUPS[k].hex }));
      else L.appendChild(el("circle", { cx: lx0 + swD / 2, cy: yc, r: swD / 2 - 0.15, fill: "none", stroke: COLORS.ink300, "stroke-width": 0.3 }));
      L.appendChild(txt(lx0 + swD + 1.8, yc + eLeg * SANS_CAP / 2, name, reg(eLeg, COLORS.ink)));
    });

    // ── right: column chart of the 190 pairwise distances ────────────────────
    const R = g({}); svg.appendChild(R);
    R.appendChild(txt(cx0, yCap, `How many bits apart: all ${nPairs} pairs`, bold(eCap)));
    const note = [`1 bit apart: ${usedEdges} of the cube's ${cubeEdges} edges used`, `${usedEdges} of the cube's ${cubeEdges} edges used`]
      .find((s) => M(s, reg(eNote)) <= chartW) ?? `${usedEdges} of ${cubeEdges} edges used`;
    const yNote = h - inset - eNote * DESC - 0.2;
    const yTick = yNote - eNote * ASC - 2.4 - eTick * DESC;
    const yB = yTick - eTick * ASC - 1.8;
    const yTop = yCap + eCap * DESC + 2.4 + eVal * ASC + 1.6;
    const vmax = Math.max(...hist);
    const bPitch = chartW / 5, bw = Math.min(bPitch * 0.42, 11);
    const bx = (d) => cx0 + bPitch * (d - 0.5);
    const barTop = (v) => yB - (v / vmax) * (yB - yTop);
    R.appendChild(el("line", { x1: cx0, x2: cx0 + chartW, y1: yB, y2: yB, stroke: COLORS.ink300, "stroke-width": 0.35 }));
    hist.forEach((v, i) => {
      const d = i + 1, x0 = bx(d) - bw / 2, top = barTop(v), rr = Math.min(1.6, bw / 2, yB - top);
      R.appendChild(el("path", {
        d: `M${x0},${yB} V${top + rr} Q${x0},${top} ${x0 + rr},${top} H${x0 + bw - rr} Q${x0 + bw},${top} ${x0 + bw},${top + rr} V${yB} Z`,
        fill: d === 1 ? COLORS.flip : COLORS.ink400,          // one bit apart = the orange relation
      }));
      R.appendChild(txt(bx(d), top - 1.6, String(v), { ...bold(eVal), "text-anchor": "middle" }));
      R.appendChild(txt(bx(d), yTick, d === 1 ? "1 bit" : `${d} bits`, { ...reg(eTick), "text-anchor": "middle" }));
    });
    // the four five-bit pairs, stacked over their bar
    const r2 = ePair * 0.52, dash = M("–", reg(ePair)) + 1.6;
    const valTop5 = barTop(hist[4]) - 1.6 - eVal * SANS_CAP;
    far.forEach(([a, b], k) => {
      const yc = valTop5 - 2.2 - r2 - (far.length - 1 - k) * (2 * r2 + 1.5);     // read top-down
      const xa = bx(5) - dash / 2 - r2, xb = bx(5) + dash / 2 + r2;
      for (const [x, s] of [[xa, a], [xb, b]]) {
        const hex = AA_GROUP[s].hex;
        R.appendChild(el("circle", { cx: x, cy: yc, r: r2, fill: hex }));
        R.appendChild(txt(x, yc + ePair * SANS_CAP / 2, s, { ...SANS, "font-size": ePair, "font-weight": 700, fill: onColor(hex), "text-anchor": "middle" }));
      }
      R.appendChild(el("line", { x1: bx(5) - dash / 2 + 0.5, x2: bx(5) + dash / 2 - 0.5, y1: yc, y2: yc, stroke: COLORS.ink2, "stroke-width": 0.4 }));
    });
    R.appendChild(txt(cx0, yNote, note, reg(eNote)));
    hoist(svg);
  }, `The five-bit amino-acid code, flattened into a 4 by 8 Karnaugh map: rows are the first two bits (00 01 11 10), columns the last three (000 001 011 010 110 111 101 100). ` +
     `Row 00 holds A V L I F Y W M, row 01 D Q N T S G P C, row 11 E H K R, and ${nUnused} codewords are unused. Each chemical group fills one block of touching cells. ` +
     `Of the ${nPairs} residue pairs, ${hist.map((v, i) => `${v} are ${i + 1} bit${i ? "s" : ""} apart`).join(", ")}; the five-bit pairs are ${far.map((p) => p.join("–")).join(", ")}. ` +
     `The code uses ${usedEdges} of the cube's ${cubeEdges} edges.`);
  M.done();
}
