// Inventory of the 131 Lean theorems: one tile per theorem, one row per file,
// grouped by the trust each proof needs (data/axiom_audit.tsv, column "axioms"):
//   mentions native_decide -> trusts Lean's compiler as well as its kernel
//   otherwise non-empty    -> standard axioms only (propext, Quot.sound)
//   empty                  -> no axiom at all
import { mount, el, g, pt, COLORS, FONT, loadTSV, NS } from "../lib.js";

const FILES = ["KmapProofs", "KmerIndexing", "AminoAcidEncoding", "ContactMapCompleteness",
  "KmapEncodingEquiv", "ContactCircuits", "SequenceCircuits"];
// ordered by how much trust is needed: most (darkest) to least (lightest)
const CATS = [
  { key: "native", label: "native_decide", mono: true, fill: COLORS.ink600 },
  { key: "std", label: "standard axioms only", fill: COLORS.ink400 },
  { key: "none", label: "no axiom", fill: COLORS.ink200 },
];
const catOf = (axioms) => (/native_decide/.test(axioms) ? "native" : axioms.trim() === "" ? "none" : "std");

// poster.css sets `svg text { font-family; fill }`, which beats presentation
// attributes, so family, fill and width go into the inline style.
function T(x, y, s, o = {}) {
  const fam = o.mono ? FONT.mono : FONT.sans;
  const style = `font-family:${fam};fill:${o.fill || COLORS.ink};${o.mono ? "" : `font-stretch:${o.stretch || "87.5%"};`}`;
  return el("text", { x, y, "font-size": o.size, "font-weight": o.weight || 500, "text-anchor": o.anchor, style }, [s]);
}
function makeMeasure() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("style", "position:absolute;left:-9999px;top:0;visibility:hidden");
  document.body.appendChild(s);
  const m = (str, o) => { const t = T(0, 0, str, o); s.appendChild(t); const w = t.getComputedTextLength(); t.remove(); return w; };
  m.done = () => s.remove();
  return m;
}

export default async function build(host, { w, h }) {
  const rows = await loadTSV("axiom_audit.tsv");
  const count = Object.fromEntries(FILES.map((f) => [f, { native: 0, std: 0, none: 0 }]));
  const total = { native: 0, std: 0, none: 0 };
  for (const r of rows) {
    if (!count[r.module]) throw new Error(`inventory: unexpected module ${r.module}`);
    const c = catOf(r.axioms);
    count[r.module][c]++; total[c]++;
  }
  const grand = rows.length;
  if (grand !== 131 || total.native !== 100 || total.std !== 23 || total.none !== 8)
    throw new Error(`inventory: audit drifted (${grand}/${total.native}/${total.std}/${total.none})`);

  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo", '400 20px "Plex Mono"']
    .map((f) => document.fonts.load(f)));
  const measure = makeMeasure();

  const inset = 1.6;
  const fs = pt(18.5);                                     // labels, legend, tips
  const fsSum = pt(21);
  const LBL = { size: fs, weight: 500 };

  // ── vertical grid: legend line, then 7 row bands ─────────────────────────────
  const legendY = inset + fs * 0.80;
  const top = legendY + fs * 0.52;
  const pitch = (h - inset * 0.6 - top) / FILES.length;
  const barH = Math.min(pitch * 0.58, 4.0);

  // ── horizontal grid: labels | tiles | tip ──────────────────────────────────
  const labelW = Math.max(...FILES.map((f) => measure(f, LBL)));
  const lblGap = 2.6;
  const x0 = inset + labelW + lblGap;
  const maxN = Math.max(...FILES.map((f) => count[f].native + count[f].std + count[f].none));
  const tipW = measure(String(maxN), { size: fs, weight: 700 }) + 1.6;
  const catGap = 0.9;                                      // extra air between trust classes
  const unit = (w - inset - tipW - x0 - 2 * catGap) / maxN; // pitch of one theorem tile
  const tileGap = Math.min(0.42, unit * 0.18);
  const tileW = unit - tileGap;
  const rx = Math.min(0.4, tileW * 0.2);

  mount(host, w, h, (svg) => {
    // legend: three entries, swatch = one tile
    let lx = inset;
    const leg = g({ "aria-label": "legend" });
    CATS.forEach((c) => {
      leg.appendChild(el("rect", { x: lx, y: legendY - fs * 0.62, width: tileW, height: barH, rx, fill: c.fill }));
      lx += tileW + 1.4;
      const o = c.mono ? { size: fs * 0.97, mono: true, weight: 400 } : LBL;
      leg.appendChild(T(lx, legendY, c.label, o));
      lx += measure(c.label, o) + 5.5;
    });
    svg.appendChild(leg);

    // rows of tiles
    FILES.forEach((f, i) => {
      const cy = top + pitch * (i + 0.5);
      const y = cy - barH / 2;
      const row = g({ "aria-label": `${f}: ${count[f].native} native_decide, ${count[f].std} standard axioms only, ${count[f].none} no axiom` });
      row.appendChild(T(x0 - lblGap, cy + fs * 0.35, f, { ...LBL, anchor: "end" }));
      let x = x0, n = 0;
      CATS.forEach((c) => {
        const k = count[f][c.key];
        for (let t = 0; t < k; t++) { row.appendChild(el("rect", { x, y, width: tileW, height: barH, rx, fill: c.fill })); x += unit; n++; }
        if (k) x += catGap;
      });
      row.appendChild(T(x - catGap + 1.0, cy + fs * 0.35, String(n), { size: fs, weight: 700 }));
      svg.appendChild(row);
    });

    // grand total, set quietly in the empty lower right beside the short rows:
    // "131 theorems" over "▮ 100 + ▮ 23 + ▮ 8" (swatches name the class, numbers stay ink)
    // offset half a row from the row baselines so it does not read as row data
    const R = w - inset;
    const yA = top + pitch * 5.0 + fsSum * 0.35, yB = top + pitch * 6.15 + fsSum * 0.35;
    svg.appendChild(T(R, yA, `${grand} theorems`, { size: fsSum, weight: 700, anchor: "end" }));
    const numO = { size: fs, weight: 500, fill: COLORS.ink2 };
    const parts = [];
    CATS.forEach((c, k) => { parts.push({ c }); parts.push({ s: String(total[c.key]) }); if (k < CATS.length - 1) parts.push({ s: "+", op: true }); });
    const wOf = (p) => (p.c ? tileW + 1.0 : measure(p.s, numO) + (p.op ? 1.8 : 2.2));
    let sx = R - parts.reduce((a, p) => a + wOf(p), 0) + 2.2;
    for (const p of parts) {
      if (p.c) svg.appendChild(el("rect", { x: sx, y: yB - fs * 0.62, width: tileW, height: barH, rx, fill: p.c.fill }));
      else svg.appendChild(T(sx, yB, p.s, numO));
      sx += wOf(p);
    }
  }, `Inventory of ${grand} Lean theorems by file, one tile per theorem: ${total.native} depend on native_decide, ${total.std} on standard axioms only, ${total.none} on no axiom.`);
  measure.done();
}
