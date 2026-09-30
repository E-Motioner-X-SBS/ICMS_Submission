// The information ceiling (proved on paper, not in Lean): the top-L/5 precision
// that ANY function of a feature map can reach, because pairs that share a
// feature cell get the same score and cannot be ranked apart. Values are
// ceiling.feature_sets[*].ceiling_expected_mean from data/campaign.json (each
// cell scored by its own pooled contact rate, ties broken at random, mean over
// the 150 PSICOV proteins); markers are ceiling.literature_anchor.
//   ink bars = ceilings (paper)    teal diamonds = precision measured on data
//   (the diamond is the poster's "measured" glyph, as in its evidence tags)
import { mount, el, g, txt, pt, COLORS, FONT, loadJSON, NS } from "../lib.js";

// feature-set key in campaign.json -> readable name
const SETS = [
  ["sep_only", "separation only"],
  ["gray_h_sep", "Gray distance + separation"],
  ["L2_identity_only", "residue identity only"],
  ["L1_group_sep", "chemistry group + separation"],
  ["L2_identity_sep", "identity + separation"],
  ["L2_identity_sep_MIq", "identity + separation + MI"],
];
const CIRCUIT_SET = "L2_identity_sep";      // the trained circuit sees identity + separation
const X_MAX = 0.75;                          // axis reaches past published DCA (0.723)

const f3 = (v) => v.toFixed(3);

// Text width in mm, measured with the real fonts in a hidden svg.
function makeMeasure() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("style", "position:absolute;left:-9999px;top:0;visibility:hidden");
  document.body.appendChild(s);
  const m = (str, attrs) => { const t = txt(0, 0, str, attrs); s.appendChild(t); const wd = t.getComputedTextLength(); t.remove(); return wd; };
  m.done = () => s.remove();
  return m;
}

// Text attributes. Fill and family go in `style` because poster.css sets
// `svg text { fill; font-family }`, which beats presentation attributes.
// Archivo is variable in width; 92% matches the poster's labels and tags.
function T(size, { weight = 500, fill = COLORS.ink, anchor = "start", stretch = 92, family = FONT.sans } = {}) {
  return {
    "font-size": pt(size), "font-weight": weight, "text-anchor": anchor,
    style: `font-family:${family};fill:${fill};font-stretch:${stretch}%;`,
  };
}

// The colour the figure actually sits on (white card, or the band's wash), so
// text halos knock gridlines out without drawing a visible box.
function surfaceOf(node) {
  for (let n = node; n && n.nodeType === 1; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c)) return c;
  }
  return COLORS.paper;
}

// Horizontal bar: square at the baseline, rounded data end.
function barPath(x0, y, len, t, r) {
  r = Math.min(r, t / 2, len);
  return `M${x0},${y}H${x0 + len - r}A${r},${r} 0 0 1 ${x0 + len},${y + r}V${y + t - r}A${r},${r} 0 0 1 ${x0 + len - r},${y + t}H${x0}Z`;
}

export default async function build(host, { w, h }) {
  const camp = await loadJSON("campaign.json");
  const C = camp.ceiling;
  const rows = SETS.map(([key, name]) => {
    const fs = C.feature_sets[key];
    if (!fs) throw new Error(`ceiling: feature set ${key} missing from campaign.json`);
    return { key, name, v: fs.ceiling_expected_mean };
  }).sort((a, b) => b.v - a.v);                                   // largest at the top
  const anchor = C.literature_anchor;
  const circuit = anchor.PATH_B_circuit_L2_holdout;
  const plainMI = anchor.PATH_B_plain_MI;
  const dca = anchor.PSICOV_published_prec_at_L5;
  const circuitRow = rows.find((r) => r.key === CIRCUIT_SET);
  const pctOfCeiling = Math.round((100 * circuit) / circuitRow.v);
  const best = rows[0];
  const nProteins = C.n_targets;
  if (dca > X_MAX) throw new Error("ceiling: axis too short for DCA");

  await Promise.all([document.fonts.load(`600 20px Archivo`), document.fonts.load(`500 20px Archivo`)]);
  const measure = makeMeasure();
  const surface = surfaceOf(host);
  const halo = (a) => ({ ...a, stroke: surface, "stroke-width": 1.1, "stroke-linejoin": "round", "paint-order": "stroke" });

  // ── type ────────────────────────────────────────────────────────────────
  const sTitle = 27, sLabel = 22, sValue = 22, sTick = 20, sNote = 20, sTag = 20;
  const inset = Math.max(1.6, w * 0.006);
  const aTitle = T(sTitle, { weight: 700, stretch: 88 });
  const aLabel = T(sLabel, { weight: 500 });
  const aValue = halo(T(sValue, { weight: 700 }));
  const aMark = halo(T(sLabel, { weight: 500 }));
  const aTick = T(sTick, { weight: 500, fill: COLORS.ink2 });
  const aNote = T(sNote, { weight: 500, fill: COLORS.ink2 });

  // ── vertical grid (fractions of h) ─────────────────────────────────────────
  const titleY = inset + pt(sTitle) * 0.80;                        // title baseline
  const plotTop = titleY + h * 0.045;                              // first row band starts
  const noteY = h - inset - pt(sNote) * 0.24;                      // footnote baseline
  const tickY = noteY - pt(sNote) * 1.22;                          // tick-label baseline
  const axisY = tickY - pt(sTick) * 0.98;                          // axis line
  const stripGap = h * 0.03;                                       // extra air above the measured strip
  const pitch = (axisY - plotTop - stripGap) / (rows.length + 1);  // 6 bars + 1 strip
  const barT = Math.min(pitch * 0.5, 4.6);                         // thin bars

  // ── horizontal grid ────────────────────────────────────────────────────────
  const stripLabel = "measured predictors";
  const axisLabel = "top-L/5 precision";
  const labelW = Math.max(...rows.map((r) => measure(r.name, aLabel)), measure(stripLabel, aLabel), measure(axisLabel, aTick));
  const x0 = inset + labelW + w * 0.012;                           // bar baseline
  const x1 = w - inset - w * 0.008;                                // x = X_MAX
  const sx = (v) => x0 + ((x1 - x0) * v) / X_MAX;
  const rowCy = (i) => plotTop + pitch * (i + 0.5);
  const stripCy = plotTop + pitch * rows.length + stripGap + pitch * 0.5;
  const base = (cy, size) => cy + pt(size) * 0.35;                 // optical centring of a text line

  mount(host, w, h, (svg) => {
    // title + paper tag
    svg.appendChild(txt(inset, titleY, "What any circuit over these features can reach", aTitle));
    {
      const tagGlyph = "✎", tagText = "ceiling: proved on paper";
      const aG = T(sTag, { weight: 900, fill: COLORS.ink2 }), aT = T(sTag, { weight: 700, fill: COLORS.ink2 });
      const padX = pt(sTag) * 0.42, gap = pt(sTag) * 0.35;
      const tw = measure(tagGlyph, aG) + gap + measure(tagText, aT);
      const th = pt(sTag) * 1.34, bw = tw + 2 * padX;
      const bx = w - inset - bw, by = titleY - pt(sTitle) * 0.36 - th / 2;
      const tag = g({ "aria-label": "ceiling: proved on paper, not yet in Lean" });
      tag.appendChild(el("rect", { x: bx, y: by, width: bw, height: th, rx: th * 0.36, fill: COLORS.paper, stroke: COLORS.ink2, "stroke-width": 0.5, "stroke-dasharray": "1.3 0.9" }));
      const ty = by + th / 2 + pt(sTag) * 0.35;
      tag.appendChild(txt(bx + padX, ty, tagGlyph, aG));
      tag.appendChild(txt(bx + padX + measure(tagGlyph, aG) + gap, ty, tagText, aT));
      svg.appendChild(tag);
    }

    // gridlines + axis (behind everything)
    const grid = g({ "aria-hidden": "true" });
    const gridTop = plotTop + pitch * 0.12;
    for (let v = 0; v <= X_MAX + 1e-9; v += 0.1) {
      const x = sx(v);
      grid.appendChild(el("line", { x1: x, x2: x, y1: gridTop, y2: axisY, stroke: COLORS.rule, "stroke-width": 0.3 }));
      grid.appendChild(txt(x, tickY, v === 0 ? "0" : v.toFixed(1), { ...aTick, "text-anchor": "middle" }));
    }
    grid.appendChild(el("line", { x1: x0, x2: x1, y1: axisY, y2: axisY, stroke: COLORS.ink3, "stroke-width": 0.35 }));
    // the bars' one baseline
    grid.appendChild(el("line", { x1: x0, x2: x0, y1: gridTop, y2: rowCy(rows.length - 1) + pitch * 0.5, stroke: COLORS.ink3, "stroke-width": 0.35 }));
    svg.appendChild(grid);
    svg.appendChild(txt(x0 - w * 0.012, tickY, axisLabel, { ...aTick, "text-anchor": "end" }));

    // published DCA: a reference line through the whole plot (measured, teal)
    const xD = sx(dca);
    svg.appendChild(el("line", { x1: xD, x2: xD, y1: gridTop, y2: axisY, stroke: COLORS.teal, "stroke-width": 0.55 }));

    // ceiling bars
    const rMark = Math.max(barT * 0.62, 2.0);
    const diamond = (cx, cy, r, ring) => el("path", {
      d: `M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`, fill: COLORS.teal,
      ...(ring ? { stroke: surface, "stroke-width": 0.6, "stroke-linejoin": "round", "paint-order": "stroke" } : {}),
    });
    rows.forEach((r, i) => {
      const cy = rowCy(i), y = cy - barT / 2, len = sx(r.v) - x0;
      const grp = g({ "aria-label": `${r.name}: ceiling ${f3(r.v)}` });
      grp.appendChild(txt(x0 - w * 0.012, base(cy, sLabel), r.name, { ...aLabel, "text-anchor": "end" }));
      grp.appendChild(el("path", { d: barPath(x0, y, len, barT, barT * 0.32), fill: COLORS.ink400 }));
      const vx = sx(r.v) + 1.6;
      grp.appendChild(txt(vx, base(cy, sValue), f3(r.v), aValue));
      if (r.key === CIRCUIT_SET) {
        // the trained circuit on its own ceiling: a teal dot with a paper ring
        // the trained circuit on its own ceiling bar: a teal diamond with a halo ring
        grp.appendChild(diamond(sx(circuit), cy, rMark, true));
        const lx = vx + measure(f3(r.v), aValue) + w * 0.018;
        grp.appendChild(diamond(lx + rMark * 0.85, cy, rMark * 0.85, false));
        // say the value too when it fits before the DCA line, else the short form
        const tx = lx + rMark * 1.7 + 1.4, room = sx(dca) - w * 0.012 - tx;
        const long = `our circuit ${f3(circuit)}, ${pctOfCeiling}% of its ceiling`;
        const lab = measure(long, aMark) <= room ? long : `our circuit: ${pctOfCeiling}% of its ceiling`;
        grp.appendChild(txt(tx, base(cy, sLabel), lab, aMark));
      }
      svg.appendChild(grp);
    });

    // measured predictors strip: plain MI and published DCA on the same axis
    {
      const cy = stripCy;
      const yRule = cy - pitch * 0.5 - stripGap * 0.5;
      svg.appendChild(el("line", { x1: inset, x2: x1, y1: yRule, y2: yRule, stroke: COLORS.rule, "stroke-width": 0.3 }));
      svg.appendChild(txt(x0 - w * 0.012, base(cy, sLabel), stripLabel, { ...aLabel, "text-anchor": "end", style: aLabel.style.replace(COLORS.ink, COLORS.ink2) }));
      const dot = (v) => diamond(sx(v), cy, rMark, true);
      svg.appendChild(dot(plainMI));
      svg.appendChild(txt(sx(plainMI) + rMark + 1.4, base(cy, sLabel), `plain MI ${f3(plainMI)}`, aMark));
      svg.appendChild(dot(dca));
      svg.appendChild(txt(sx(dca) - rMark - 1.4, base(cy, sLabel), `published DCA ${f3(dca)}`, { ...aMark, "text-anchor": "end" }));
    }

    // the gap, said once, in the empty space it describes
    {
      // right-aligned against the DCA line, beside the short bars
      const ratio = best.v / dca;
      const share = ratio > 0.31 && ratio < 0.36 ? "one third" : `${Math.round(ratio * 100)}%`;
      const aGap = halo(T(sLabel, { weight: 500, fill: COLORS.ink2, anchor: "end" }));
      const gx = xD - w * 0.014;
      svg.appendChild(txt(gx, base(rowCy(3), sLabel), `the best ceiling, ${f3(best.v)}, is about`, aGap));
      svg.appendChild(txt(gx, base(rowCy(4), sLabel), `${share} of published DCA`, aGap));
    }

    // what "ceiling" means, stated where the numbers are
    svg.appendChild(txt(inset, noteY, `Cells scored by their own contact rate, ties broken at random; mean over ${nProteins} PSICOV proteins.`, aNote));
  }, `Information ceiling on top-L/5 precision for six feature sets, from ${f3(rows.at(-1).v)} (${rows.at(-1).name}) to ${f3(best.v)} (${best.name}); our circuit reaches ${f3(circuit)}, ${pctOfCeiling}% of its ceiling; plain MI ${f3(plainMI)}; published DCA ${f3(dca)}.`);
  measure.done();
}
