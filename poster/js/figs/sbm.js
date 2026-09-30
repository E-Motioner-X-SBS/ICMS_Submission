// Contact-state logic on structure-based-model (SBM) trajectories.
// data/contact_logic_interpretation.json: for 480 proteins, how often the
// contacts selected as inputs of a learned Boolean rule lie within L1 <= 2 cells
// of the rule's target on the contact map, against the same number of random
// varying contacts from the same protein (summary.adjacency).
// The worked example is one real rule from that file's `examples` list. Its
// sum-of-products names inputs by SMOG contact index ("c5", "c0");
// assets/sbm_rule_1kms.json (written by assets/make_sbm_rule.py from the SMOG
// contact list) resolves them to residue pairs and lists the native contacts
// around the target; everything is cross-checked against the data file here.
import { mount, el, g, txt, pt, COLORS, FONT, loadJSON, NS } from "../lib.js";

const EXAMPLE = { protein: "1kms", target: [2, 129] };

function makeMeasure() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("style", "position:absolute;left:-9999px;top:0;visibility:hidden");
  document.body.appendChild(s);
  const m = (str, attrs) => { const t = txt(0, 0, str, attrs); s.appendChild(t); const wd = t.getComputedTextLength(); t.remove(); return wd; };
  m.done = () => s.remove();
  return m;
}
// fill and family in `style`: poster.css `svg text {fill; font-family}` beats attributes.
// Weights 500 / 700 match the static Archivo instances the poster ships.
function T(size, { weight = 500, fill = COLORS.ink, anchor = "start", stretch = 92, family = FONT.sans, italic = false } = {}) {
  return {
    "font-size": pt(size), "font-weight": weight, "text-anchor": anchor,
    style: `font-family:${family};fill:${fill};font-stretch:${stretch}%;${italic ? "font-style:italic;" : ""}`,
  };
}
// greedy word wrap to a width, with the real font metrics
function wrap(measure, s, attrs, width) {
  const words = s.split(" "), lines = [];
  let cur = "";
  for (const wd of words) {
    const t = cur ? `${cur} ${wd}` : wd;
    if (cur && measure(t, attrs) > width) { lines.push(cur); cur = wd; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// horizontal bar: square at the baseline, rounded data end
function barPath(x0, y, len, t, r) {
  r = Math.min(r, t / 2, len);
  return `M${x0},${y}H${x0 + len - r}A${r},${r} 0 0 1 ${x0 + len},${y + r}V${y + t - r}A${r},${r} 0 0 1 ${x0 + len - r},${y + t}H${x0}Z`;
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const cname = ([i, j]) => `c(${i},${j})`;

// "(c5 & c0) | (~c1 & q0)" -> [[{v:"c5",neg:false},{v:"c0",neg:false}], ...]
function parseSop(sop) {
  return sop.split("|").map((term) => term.replace(/[()]/g, "").trim().split("&").map((lit) => {
    const s = lit.trim();
    return { v: s.replace(/^~/, ""), neg: s.startsWith("~") };
  }));
}

export default async function build(host, { w, h }) {
  const data = await loadJSON("contact_logic_interpretation.json");
  const res = await fetch(`assets/sbm_rule_${EXAMPLE.protein}.json`);
  if (!res.ok) throw new Error(`sbm: assets/sbm_rule_${EXAMPLE.protein}.json HTTP ${res.status}`);
  const rule = await res.json();

  // ── the summary statistic ────────────────────────────────────────────────
  const S = data.summary, A = S.adjacency;
  const obs = A.frac_adjacent_observed, rnd = A.frac_adjacent_random;
  const enrich = obs / rnd;
  if (Math.abs(enrich - A.enrichment) > 1e-9) throw new Error("sbm: enrichment drifted");
  const L1 = S.adjacency_threshold_L1;
  const pct = (v) => `${(100 * v).toFixed(1)}%`;

  // ── the example rule, exactly as the data file states it ─────────────────
  const ex = data.examples.find((e) => e.protein === EXAMPLE.protein && same(e.target_contact, EXAMPLE.target));
  if (!ex) throw new Error("sbm: example rule not found in contact_logic_interpretation.json");
  if (ex.sop !== rule.sop || !same(rule.target, ex.target_contact) ||
      rule.predictors.length !== ex.predictor_contacts.length ||
      !rule.predictors.every((p, k) => same(p, ex.predictor_contacts[k])))
    throw new Error("sbm: asset disagrees with the data file");
  rule.predictor_indices.forEach((idx, k) => {
    const v = rule.variables[`c${idx}`];
    if (v && !same(v, rule.predictors[k])) throw new Error(`sbm: c${idx} resolves inconsistently`);
  });
  const terms = parseSop(ex.sop);
  for (const t of terms) for (const lit of t) {
    if (!/^c\d+$/.test(lit.v)) throw new Error(`sbm: example uses a non-contact input ${lit.v}; pick a pure contact rule`);
    if (!rule.variables[lit.v] || !ex.predictor_contacts.some((p) => same(p, rule.variables[lit.v])))
      throw new Error(`sbm: rule variable ${lit.v} is not one of the example's inputs`);
  }
  if (terms.length !== 1 || terms[0].some((l) => l.neg)) throw new Error("sbm: the glyph draws a single AND term");
  const used = terms[0].map((lit) => rule.variables[lit.v]);
  const tgt = ex.target_contact;
  const l1 = (p) => Math.abs(p[0] - tgt[0]) + Math.abs(p[1] - tgt[1]);
  ex.predictor_contacts.forEach((p, k) => { if (l1(p) !== ex.predictor_l1[k]) throw new Error("sbm: L1 mismatch"); });
  const native = rule.native_near_target;
  if (!native) throw new Error("sbm: re-run assets/make_sbm_rule.py (native_near_target missing)");
  for (const p of [tgt, ...ex.predictor_contacts]) if (!native.some((q) => same(q, p))) throw new Error("sbm: example contact is not native");

  await Promise.all([document.fonts.load(`700 20px Archivo`), document.fonts.load(`500 20px Archivo`)]);
  const measure = makeMeasure();

  // ── type ───────────────────────────────────────────────────────────────────
  const inset = Math.max(1.8, Math.min(w, h) * 0.028);
  const sHero = 58, sLabel = 21, sHead = 20, sTick = 20, sRule = 21;
  const aHero = T(sHero, { weight: 700, stretch: 88 });
  const aLabel = T(sLabel);
  const aValue = T(sLabel, { weight: 700 });
  const aName = T(sLabel, { fill: COLORS.ink2 });
  const aBarName = T(19, { fill: COLORS.ink2 });
  const aHead = T(sHead, { weight: 700 });
  const aTick = T(sTick, { fill: COLORS.ink2 });
  const aAxis = T(sTick, { fill: COLORS.ink2, italic: true, stretch: 100 });
  const aRule = T(sRule);
  const aKey = T(sHead, { fill: COLORS.ink2 });
  const capH = (size) => pt(size) * 0.72;          // Archivo cap height
  const midY = (cy, size) => cy + capH(size) / 2;   // baseline that centres caps on cy

  // ── right block: the worked example ────────────────────────────────────────
  // Transposed contact-map window (the map is symmetric): columns are residue i,
  // rows residue j, so the three-digit j labels sit on the left at full size.
  const colsI = [-2, -1, 0, 1, 2].map((d) => tgt[0] + d).filter((i) => i >= 1);   // residues start at 1
  const rowsJ = [-2, -1, 0, 1, 2].map((d) => tgt[1] + d);
  const isNative = (p) => native.some((q) => same(q, p));
  const inHood = (p) => l1(p) <= L1;
  const role = (p) => same(p, tgt) ? "target" : used.some((q) => same(q, p)) ? "input" : isNative(p) ? "contact" : "empty";
  const FILL = { target: COLORS.ink, input: COLORS.teal, contact: COLORS.ink200, empty: COLORS.paper };

  // rule as a stacked equation; each contact wears a swatch of its cell
  const ruleRows = [
    { p: tgt, s: `${cname(tgt)} =` },
    ...used.map((p, k) => ({ p, s: k < used.length - 1 ? `${cname(p)} and` : cname(p) })),
  ];
  const sw = pt(sRule) * 0.62, swGap = pt(sRule) * 0.32;
  const ruleW = sw + swGap + Math.max(...ruleRows.map((r) => measure(r.s, aRule)));
  const keyLines = [`within ${L1} cells`];                   // key for the outline
  const keyW = sw + swGap + Math.max(...keyLines.map((s) => measure(s, aKey)));
  const textColW = Math.max(ruleW, keyW);

  const headY = inset + capH(sHead);
  const colLabY = headY + pt(sTick) * 1.25;
  const gridTop = colLabY + pt(sTick) * 0.42;
  const rowLabW = Math.max(...rowsJ.map((j) => measure(String(j), aTick))) + 1.4;
  const jLabH = pt(sTick) * 1.15;                                   // room for the "j" axis letter
  const cell = Math.min((h - inset - gridTop - jLabH) / rowsJ.length, w * 0.044);
  const gridW = colsI.length * cell;
  const gapGT = w * 0.02;                                            // grid -> rule column
  const blockW = rowLabW + gridW + gapGT + textColW;
  const bx = w - inset - blockW;                                     // right block left edge
  const gx = bx + rowLabW;                                           // grid left edge
  const tx = gx + gridW + gapGT;                                     // rule column left edge
  const leftR = bx - w * 0.035;                                      // left block right edge

  mount(host, w, h, (svg) => {
    // ── left: the claim ────────────────────────────────────────────────────────
    const heroStr = `${enrich.toFixed(1)}×`;
    const heroY = inset + pt(sHero) * 0.80;          // ascender, not just cap height, inside the box
    svg.appendChild(txt(inset - pt(sHero) * 0.02, heroY, heroStr, aHero));
    const heroW = measure(heroStr, aHero);

    // the n beside the hero when it fits, else at the end of the label
    const nStr = `in ${A.n_proteins_observed_higher} of ${S.n_proteins} proteins`;
    const nx = inset + heroW + w * 0.022;
    const nLines = wrap(measure, nStr, aName, leftR - nx);
    const besideOK = nLines.length <= 2 && nLines.every((s) => measure(s, aName) <= leftR - nx);
    let label = "more often adjacent";
    if (false) {
      const lead = pt(sLabel) * 1.16, c0 = heroY - capH(sHero) / 2 - ((nLines.length - 1) * lead) / 2;
      nLines.forEach((s, k) => svg.appendChild(txt(nx, midY(c0 + k * lead, sLabel), s, aName)));
    }
    const labLines = wrap(measure, label, aLabel, leftR - inset);
    const lead = pt(sLabel) * 1.2;
    const lab0 = heroY + pt(sLabel) * 1.35;
    labLines.forEach((s, k) => svg.appendChild(txt(inset, lab0 + k * lead, s, aLabel)));

    // two bars on one scale, each with its value and meaning on the line above
    const barsTop = lab0 + (labLines.length - 1) * lead + pt(sLabel) * 0.62;
    const rowH = (h - inset - barsTop) / 2;
    const barT = Math.min(rowH * 0.28, 3.4);
    const bars = [
      { v: obs, name: "of rule inputs", fill: COLORS.teal },
      { v: rnd, name: "of random contacts", fill: COLORS.ink300 },
    ];
    const gapN = pt(sLabel) * 0.3;
    const scale = (leftR - inset) / obs;                      // the larger bar spans the block
    bars.forEach((b, k) => {
      const top = barsTop + rowH * k;
      const base = top + capH(sLabel);
      const gb = g({ "aria-label": `${pct(b.v)} ${b.name} lie within ${L1} cells of their target` });
      gb.appendChild(txt(inset, base, pct(b.v), aValue));
      gb.appendChild(txt(inset + measure(pct(b.v), aValue) + gapN, base, b.name, aBarName));
      const by = base + pt(sLabel) * 0.32;
      gb.appendChild(el("path", { d: barPath(inset, by, Math.max(b.v * scale, 0.9), barT, barT * 0.32), fill: b.fill }));
      svg.appendChild(gb);
    });

    // ── right: one real rule on its contact-map neighbourhood ───────────────────
    svg.appendChild(txt(bx, headY, `one rule, protein ${ex.protein}`, aHead));
    const patch = g({ "aria-label": `Contact map of ${ex.protein} around contact (${tgt}): native contacts, the rule's target and its inputs` });
    colsI.forEach((i, c) => patch.appendChild(txt(gx + (c + 0.5) * cell, colLabY, String(i), { ...aTick, "text-anchor": "middle" })));
    patch.appendChild(txt(gx - 1.4, colLabY, "i", { ...aAxis, "text-anchor": "end" }));
    patch.appendChild(txt(gx - 1.4, gridTop + rowsJ.length * cell + jLabH * 0.92, "j", { ...aAxis, "text-anchor": "end" }));
    rowsJ.forEach((j, r) => patch.appendChild(txt(gx - 1.4, midY(gridTop + (r + 0.5) * cell, sTick), String(j), { ...aTick, "text-anchor": "end" })));
    const pad = Math.max(0.25, cell * 0.035);
    rowsJ.forEach((j, r) => colsI.forEach((i, c) => {
      const p = [i, j], rl = role(p);
      patch.appendChild(el("rect", {
        x: gx + c * cell + pad, y: gridTop + r * cell + pad, width: cell - 2 * pad, height: cell - 2 * pad, rx: cell * 0.08,
        fill: FILL[rl], stroke: rl === "empty" ? COLORS.rule : "none", "stroke-width": 0.3,
      }));
    }));
    // the L1 <= 2 neighbourhood: its boundary, traced edge by edge
    const at = (i, j) => colsI.includes(i) && rowsJ.includes(j) && inHood([i, j]);
    const segs = [];
    rowsJ.forEach((j, r) => colsI.forEach((i, c) => {
      if (!inHood([i, j])) return;
      const x0 = gx + c * cell, y0 = gridTop + r * cell, x1 = x0 + cell, y1 = y0 + cell;
      if (!at(i, j - 1)) segs.push(`M${x0},${y0}H${x1}`);
      if (!at(i, j + 1)) segs.push(`M${x0},${y1}H${x1}`);
      if (!at(i - 1, j)) segs.push(`M${x0},${y0}V${y1}`);
      if (!at(i + 1, j)) segs.push(`M${x1},${y0}V${y1}`);
    }));
    patch.appendChild(el("path", { d: segs.join(""), fill: "none", stroke: COLORS.ink, "stroke-width": 0.5, "stroke-linecap": "square" }));
    svg.appendChild(patch);

    // the rule, stacked like an equation, from the top of the grid; each
    // contact carries a swatch of its own cell
    const rLead = pt(sRule) * 1.24;
    const r0 = gridTop + cell * 0.5;
    ruleRows.forEach((row, k) => {
      const cy = r0 + k * rLead;
      svg.appendChild(el("rect", { x: tx, y: cy - sw / 2, width: sw, height: sw, rx: sw * 0.12, fill: FILL[role(row.p)] }));
      svg.appendChild(txt(tx + sw + swGap, midY(cy, sRule), row.s, aRule));
    });
    // key for the outline, aligned with the bottom of the grid
    const kLead = pt(sHead) * 1.18;
    const kc = r0 + ruleRows.length * rLead + pt(sRule) * 0.25;   // one line under the rule
    svg.appendChild(el("rect", { x: tx + 0.25, y: kc - sw / 2 + 0.25, width: sw - 0.5, height: sw - 0.5, fill: "none", stroke: COLORS.ink, "stroke-width": 0.5 }));
    keyLines.forEach((s, k) => svg.appendChild(txt(tx + sw + swGap, midY(kc + k * kLead, sHead), s, aKey)));
  }, `Learned contact rules on SBM simulations: ${pct(obs)} of rule inputs lie within ${L1} cells of their target on the contact map versus ${pct(rnd)} of random contacts, ${enrich.toFixed(1)} times more often, higher in ${A.n_proteins_observed_higher} of ${S.n_proteins} proteins. Example from protein ${ex.protein}: ${cname(tgt)} = ${used.map(cname).join(" and ")}.`);
  measure.done();
}
