// Figure "gray": binary vs reflected Gray code, counting 0..7, every bit that
// changed from the previous row marked in orange; and the DNA 2-cube, where
// A C G T (raw codes 00 01 11 10, KmapProofs.lean `encode`) is itself a Gray cycle.
// Everything is computed from gray(), ham(), bits() and NUC_RAW.
import { mount, el, g, txt, spans, pt, gray, ham, bits, NUC_RAW, COLORS, FONT } from "../lib.js";

const MONO_ADV = 0.6, MONO_CAP = 0.698, SANS_CAP = 0.686;   // em fractions (font tables)
const SANS = { "font-family": FONT.sans, style: "font-stretch: 87.5%" };
const MONO = { "font-family": FONT.mono };

async function preloadFonts() {
  await Promise.all(["500 20px Archivo", "700 20px Archivo", "400 20px 'Plex Mono'", "600 20px 'Plex Mono'", "italic 400 20px Caladea"]
    .map((f) => document.fonts.load(f).catch(() => null)));
}
// width of a string in mm, measured in a hidden svg that uses mm user units
function measurer() {
  const s = el("svg", { width: "100mm", height: "100mm", viewBox: "0 0 100 100", style: "position:absolute;left:-9999px;top:0;visibility:hidden" });
  document.body.appendChild(s);
  const fn = (str, attrs) => { const t = s.appendChild(txt(0, 50, str, attrs)); const wd = t.getComputedTextLength(); t.remove(); return wd; };
  fn.done = () => s.remove();
  return fn;
}
// positions (MSB first) that differ between two n-bit codes
const flipped = (a, b, n) => new Set([...Array(n).keys()].filter((i) => ((a ^ b) >> (n - 1 - i)) & 1));
function arrowMarker(svg, id, size, color) {
  const defs = svg.querySelector("defs");
  defs.appendChild(el("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: size, markerHeight: size, orient: "auto", markerUnits: "userSpaceOnUse" },
    [el("path", { d: "M0,0.6 L10,5 L0,9.4 z", fill: color })]));
  return `url(#${id})`;
}

export default async function build(host, { w, h }) {
  const N = 3, COUNT = 1 << N;
  // the facts the drawing shows; throw rather than draw something false
  for (let n = 1; n < COUNT; n++) if (ham(gray(n - 1), gray(n)) !== 1) throw new Error(`gray step ${n - 1}->${n} is not one bit`);
  if (ham(3, 4) !== 3) throw new Error("binary 011 -> 100 should flip three bits");
  const CYCLE = ["A", "C", "G", "T"];
  for (let i = 0; i < 4; i++) if (ham(NUC_RAW[CYCLE[i]], NUC_RAW[CYCLE[(i + 1) % 4]]) !== 1) throw new Error("DNA cycle edge not one bit");

  await preloadFonts();
  const M = measurer();

  mount(host, w, h, (svg) => {
    const arrow = arrowMarker(svg, `${host.id || "gray"}-ah`, 3.0, COLORS.ink);
    const inset = Math.max(1.8, 0.0095 * w);

    // ── left: counting table ────────────────────────────────────────────────
    const L = g({}); svg.appendChild(L);
    const HEAD = 21, DIG = 20, CNT = 19;                   // pt
    const emH = pt(HEAD), emD = pt(DIG), emC = pt(CNT);
    const headBase = inset + emH * 0.9;                    // header baseline (ascent clears the top)
    const firstBase = headBase + emH * 0.21 + emD * 1.025 - 1.0;   // line boxes may touch; glyphs keep ~2.5 mm clear
    const lastBase = h - inset - emD * 0.3;
    const rowPitch = (lastBase - firstBase) / (COUNT - 1);
    const pitch = emD * MONO_ADV * 1.34;                   // digit slot
    const boxW = pitch * 0.86, boxH = Math.min(rowPitch - 0.6, emD * MONO_CAP + 1.0);
    const codeW = pitch * N;
    const headBold = { ...SANS, "font-size": emH, "font-weight": 700, fill: COLORS.ink };
    const headSmall = { ...SANS, "font-size": emC, "font-weight": 500, fill: COLORS.ink2 };
    const wGrayHead = M("Gray ", headBold) + M("g", { "font-family": FONT.serif, "font-style": "italic", "font-size": emH }) * 1 + M("(", headBold) + M("n", { "font-family": FONT.serif, "font-style": "italic", "font-size": emH }) + M(")", headBold);
    const colN = Math.max(M("n", headBold), M("7", { ...SANS, "font-size": emH }));
    const colBin = Math.max(M("binary", headBold), codeW);
    const colGray = Math.max(wGrayHead, codeW);
    const colCnt = Math.max(M("flips", headSmall), M("3", { ...SANS, "font-size": emC, "font-weight": 700 }));
    const gapS = 0.018 * w, gapL = 0.045 * w;
    const xN = inset + 0.01 * w;                           // left edge of n column
    const xBin = xN + colN + gapL;
    const xBinCnt = xBin + colBin + gapS;
    const xGray = xBinCnt + colCnt + gapL;
    const xGrayCnt = xGray + colGray + gapS;
    const tableRight = xGrayCnt + colCnt;

    // header
    L.appendChild(txt(xN + colN, headBase, "n", { ...SANS, "font-size": emH, "font-weight": 500, "font-style": "normal", fill: COLORS.ink2, "text-anchor": "end" }));
    L.appendChild(txt(xBin, headBase, "binary", headBold));
    L.appendChild(spans(xGray, headBase, [["Gray "], ["g", { "font-family": FONT.serif, "font-style": "italic", "font-weight": 400 }], ["("], ["n", { "font-family": FONT.serif, "font-style": "italic", "font-weight": 400 }], [")"]], headBold));
    for (const x of [xBinCnt, xGrayCnt]) L.appendChild(txt(x + colCnt / 2, headBase, "flips", { ...headSmall, "text-anchor": "middle" }));
    const ruleY = (headBase + emH * 0.21 + firstBase - emD * MONO_CAP) / 2;
    L.appendChild(el("line", { x1: xN, x2: tableRight, y1: ruleY, y2: ruleY, stroke: COLORS.rule, "stroke-width": 0.3 }));

    // one <text> per column (tspans per digit) so each column is one text block
    const colText = (attrs) => L.appendChild(el("text", attrs));
    const nCol = colText({ ...SANS, "font-size": emH, "font-weight": 500, fill: COLORS.ink2, "text-anchor": "end" });
    const binCol = colText({ ...MONO, "font-size": emD, fill: COLORS.ink, "text-anchor": "middle" });
    const grayCol = colText({ ...MONO, "font-size": emD, fill: COLORS.ink, "text-anchor": "middle" });
    const binCnt = colText({ ...SANS, "font-size": emC, "text-anchor": "middle" });
    const grayCnt = colText({ ...SANS, "font-size": emC, "text-anchor": "middle" });
    const boxes = g({}); L.insertBefore(boxes, L.firstChild);
    const code = (col, x0, value, prev, y) => {
      const s = bits(value, N), f = prev === null ? new Set() : flipped(prev, value, N);
      for (let i = 0; i < N; i++) {
        const cx = x0 + pitch * (i + 0.5);
        if (f.has(i)) boxes.appendChild(el("rect", { x: cx - boxW / 2, y: y - emD * MONO_CAP / 2 - boxH / 2, width: boxW, height: boxH, rx: boxH * 0.16, fill: COLORS.flip }));
        col.appendChild(el("tspan", { x: cx, y, "font-weight": f.has(i) ? 600 : 400 }, [s[i]]));
      }
      return f.size;
    };
    for (let n = 0; n < COUNT; n++) {
      const y = firstBase + rowPitch * n;
      nCol.appendChild(el("tspan", { x: xN + colN, y }, [String(n)]));
      const kb = code(binCol, xBin, n, n ? n - 1 : null, y);
      const kg = code(grayCol, xGray, gray(n), n ? gray(n - 1) : null, y);
      if (!n) continue;
      const yc = y - (emD * MONO_CAP - emC * SANS_CAP) / 2;          // centre the count on the digits
      for (const [col, x, k] of [[binCnt, xBinCnt, kb], [grayCnt, xGrayCnt, kg]])
        col.appendChild(el("tspan", { x: x + colCnt / 2, y: yc, "font-weight": k > 1 ? 700 : 500, fill: k > 1 ? COLORS.ink : COLORS.ink2 }, [String(k)]));
    }

    // ── right: DNA on the corners of a square (a 2-cube) ────────────────────
    const R = g({}); svg.appendChild(R);
    const rx0 = tableRight + 0.07 * w, rx1 = w - inset;
    R.appendChild(txt(rx0, headBase, "DNA needs two bits", headBold));
    const keyBase = h - inset - pt(20) * 0.3;
    const slot = pt(20) * 0.64;
    const codePitch = pt(22) * MONO_ADV * 1.12;
    const rNode = pt(24) * 0.72;
    const clear = Math.max(rNode, slot + 1.8);                    // room above/below an edge
    const top = headBase + emH * 0.21 + 1.6 + clear, bot = keyBase - pt(20) * 0.95 - 1.6 - clear;
    const side = Math.min((rx1 - rx0) - 2 * (rNode + 1.8 + 2 * codePitch) - 2, bot - top);
    const cx = rx0 + (rx1 - rx0) / 2, cy = (top + bot) / 2;
    const pos = {};   // corner = (first bit -> row, second bit -> column), as in the 2 x 2 K-map
    for (const b of CYCLE) { const c = NUC_RAW[b]; pos[b] = { x: cx + ((c & 1) ? 1 : -1) * side / 2, y: cy + ((c >> 1) ? 1 : -1) * side / 2, c }; }
    const codeX0 = (p) => (p.c & 1) ? p.x + rNode + 1.8 : p.x - rNode - 1.8 - codePitch * 2;
    // the two bit positions as slots; the one an edge flips is orange
    const slots = (x0, pitchX, yc, f) => {
      for (let k = 0; k < 2; k++) {
        const scx = x0 + pitchX * (k + 0.5);
        R.appendChild(el("rect", { x: scx - slot / 2, y: yc - slot / 2, width: slot, height: slot, rx: slot * 0.18,
          fill: f.has(k) ? COLORS.flip : COLORS.paper, stroke: f.has(k) ? "none" : COLORS.ink300, "stroke-width": 0.3 }));
      }
    };
    for (let i = 0; i < 4; i++) {
      const a = pos[CYCLE[i]], b = pos[CYCLE[(i + 1) % 4]];
      const len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      const s0 = rNode + 0.9, s1 = len - rNode - 0.9;
      R.appendChild(el("line", { x1: a.x + ux * s0, y1: a.y + uy * s0, x2: a.x + ux * s1, y2: a.y + uy * s1, stroke: COLORS.ink, "stroke-width": 0.5, "marker-end": arrow }));
      const f = flipped(a.c, b.c, 2), my = (a.y + b.y) / 2, mx = (a.x + b.x) / 2;
      if (Math.abs(uy) > 0.5) slots(codeX0(a), codePitch, my, f);          // side edge: under the code digits
      else slots(mx - codePitch, codePitch, my + (my < cy ? -1 : 1) * (slot / 2 + 1.8), f);   // top / bottom edge
    }
    for (const b of CYCLE) {
      const p = pos[b];
      R.appendChild(el("circle", { cx: p.x, cy: p.y, r: rNode, fill: COLORS.paper, stroke: COLORS.ink, "stroke-width": 0.5 }));
      R.appendChild(txt(p.x, p.y + pt(24) * SANS_CAP / 2, b, { ...SANS, "font-size": pt(24), "font-weight": 700, fill: COLORS.ink, "text-anchor": "middle" }));
      const s = bits(p.c, 2), x0 = codeX0(p);
      const t = R.appendChild(el("text", { ...MONO, "font-size": pt(22), fill: COLORS.ink, "text-anchor": "middle" }));
      for (let i = 0; i < 2; i++) t.appendChild(el("tspan", { x: x0 + codePitch * (i + 0.5), y: p.y + pt(22) * MONO_CAP / 2 }, [s[i]]));
    }
    // key (shared by both panels)
    R.appendChild(el("rect", { x: rx0, y: keyBase - pt(20) * SANS_CAP / 2 - slot / 2, width: slot, height: slot, rx: slot * 0.18, fill: COLORS.flip }));
    R.appendChild(txt(rx0 + slot + 1.8, keyBase, "the bit that flips", { ...SANS, "font-size": pt(20), "font-weight": 500, fill: COLORS.ink2 }));
  }, "Counting 0 to 7: binary flips up to three bits per step (011 to 100), the Gray code exactly one. DNA's four bases A 00, C 01, G 11, T 10 sit on the corners of a square; each edge of the cycle A, C, G, T, A flips one bit.");
  M.done();
}
