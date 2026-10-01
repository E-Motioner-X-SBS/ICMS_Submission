// From structure to circuit to rules to inferences, for PSICOV 1fnaA, and the same pipeline's
// exact totals over 150 proteins.
// Left: the native contact map of 1fnaA (91 residues; C-beta < 8 Å, |i−j| ≥ 6) with its block
// rules coloured by the strand pair they belong to (colours read from the 3D hero's sidecar,
// assets/hero_1fna.json, so map, list and picture agree). Right: one block rule as the address of
// its AND gate (free low bits in orange: SequenceCircuits.lean sc_contact_cube_is_block makes it a
// segment against a segment); the strand pairs read from the rules, with the counted evidence for
// their direction; and the dataset line from data/exact_summary.json (every circuit re-run on all
// of its inputs; every rule checked against every pair it names).
import { mount, el, g, pt, COLORS, FONT, loadJSON, NS } from "../lib.js";
import { strandPairClusters } from "../../render3d/clusters.js";

const styleOf = (o) => `font-family:${o.mono ? FONT.mono : FONT.sans};fill:${o.fill || COLORS.ink};${o.mono ? "" : "font-stretch:87.5%;"}${o.italic ? "font-style:italic;" : ""}`;
const T = (x, y, s, o = {}) => el("text", { x, y, "font-size": o.size, "font-weight": o.weight || 500, "text-anchor": o.anchor, style: styleOf(o) }, [s]);
function S(x, y, parts, o = {}) {
  const t = el("text", { x, y, "font-size": o.size, "text-anchor": o.anchor, style: styleOf(o) });
  for (const [s, p = {}] of parts) t.appendChild(el("tspan", { "font-weight": p.weight || o.weight || 500, style: styleOf({ ...o, ...p }) }, [s]));
  return t;
}
const n = (v) => v.toLocaleString("en-US");
function measurer() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("style", "position:absolute;left:-9999px;top:0;visibility:hidden");
  document.body.appendChild(s);
  const m = (str, o) => { const t = T(0, 0, str, o); s.appendChild(t); const wd = t.getComputedTextLength(); t.remove(); return wd; };
  m.done = () => s.remove();
  return m;
}
const WORD = { antiparallel: "antiparallel", parallel: "parallel", short: "one block", mixed: "mixed" };

export default async function build(host, { w, h }) {
  const d = await loadJSON("contact_1fnaA.json");
  const X = await loadJSON("exact_summary.json");
  const meta = await (await fetch("assets/hero_1fna.json")).json();
  const L = d.length, p = d.pos_bits;
  if (L !== 91 || d.contacts.length !== 201 || d.blocks.length !== 16 || !d.sound || !d.complete) throw new Error("contact: 1fnaA data changed");
  if (X.psicov.exact !== X.psicov.proteins || X.psicov.exceptions !== 0 || X.psicov.missed !== 0) throw new Error("contact: dataset not exact");
  const cset = new Set(d.contacts.map(([i, j]) => `${i},${j}`));
  for (const b of d.blocks) for (let i = b.i0; i < b.i1; i++) for (let j = b.j0; j < b.j1; j++)
    if (!cset.has(`${Math.min(i, j)},${Math.max(i, j)}`)) throw new Error("contact: a block cell is not a contact");

  // strand pairs: the poster's cluster definition, coloured as in the hero; orientation from the rules
  const clusters = strandPairClusters(d);
  const colorOf = (c) => (meta.clusters.find((m) => m.i0 === c.i0 && m.j0 === c.j0) || {}).color || COLORS.teal;
  const inf = X.fna.pairs;                                              // from the rules engine (0-based, half-open)
  for (const c of clusters) if (!inf.some((q) => q.i0 === c.i0 && q.j0 === c.j0 && q.contacts === c.nPairs)) throw new Error("contact: cluster and inference disagree");
  const rows = inf.slice().sort((a, b) => b.contacts - a.contacts).map((q) => ({ ...q, color: colorOf(q) }));
  const blockColor = (b) => { const c = clusters.find((c) => c.blocks.some((k) => d.blocks[k] === b)); return c ? colorOf(c) : COLORS.teal; };

  // the example rule: a 2 × 2 block of the largest pair
  const big = clusters.slice().sort((a, b) => b.nPairs - a.nPairs)[0];
  const ex = big.blocks.map((k) => d.blocks[k]).find((b) => b.i1 - b.i0 === 2 && b.j1 - b.j0 === 2) ?? d.blocks[big.blocks[0]];
  const fi = (ex.mask >> p) & ((1 << p) - 1), fj = ex.mask & ((1 << p) - 1);
  const field = (v, m) => [...Array(p)].map((_, k) => { const bit = 1 << (p - 1 - k); return m & bit ? "-" : v & bit ? "1" : "0"; }).join("");
  const iPat = field(ex.val >> p, fi), jPat = field(ex.val & ((1 << p) - 1), fj);

  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo", '500 20px "Plex Mono"'].map((f) => document.fonts.load(f)));
  const inset = 1.6, fs = pt(20), fsH = pt(21.5), fsM = pt(19);
  const measure = measurer();

  mount(host, w, h, (svg) => {
    // ── contact map with block rules coloured by strand pair ─────────────────────
    const tick = fs * 1.9, M = h - 2 * inset - fs * 1.35, cs = M / L, mx = inset + tick, my = inset + fs * 0.2;
    const map = g({ "aria-label": `Contact map of 1fnaA with its ${d.blocks.length} block rules coloured by strand pair` });
    map.appendChild(el("rect", { x: mx, y: my, width: M, height: M, fill: COLORS.paper, stroke: COLORS.ink300, "stroke-width": 0.3 }));
    for (const [i, j] of d.contacts) for (const [r, c] of [[i, j], [j, i]])
      map.appendChild(el("rect", { x: mx + c * cs, y: my + r * cs, width: cs, height: cs, fill: COLORS.ink200 }));
    for (const b of d.blocks) {
      const col = blockColor(b);
      map.appendChild(el("rect", { x: mx + b.j0 * cs, y: my + b.i0 * cs, width: (b.j1 - b.j0) * cs, height: (b.i1 - b.i0) * cs, fill: col }));
      map.appendChild(el("rect", { x: mx + b.i0 * cs, y: my + b.j0 * cs, width: (b.i1 - b.i0) * cs, height: (b.j1 - b.j0) * cs, fill: col }));
    }
    map.appendChild(el("line", { x1: mx, y1: my, x2: mx + M, y2: my + M, stroke: COLORS.rule, "stroke-width": 0.25 }));
    for (const r of [1, 20, 40, 60, 80]) {
      map.appendChild(T(mx - 1, my + (r - 0.5) * cs + fs * 0.34, String(r), { size: fsM, anchor: "end", fill: COLORS.ink2 }));
      map.appendChild(T(mx + (r - 0.5) * cs, my + M + fs * 1.05, String(r), { size: fsM, anchor: "middle", fill: COLORS.ink2 }));
    }
    svg.appendChild(map);

    // ── right: one rule, its inferences, the dataset ─────────────────────────────
    const rx = mx + M + 7.5;
    let y = inset + fsH * 0.85;
    svg.appendChild(T(rx, y, "One AND gate, read as a rule", { size: fsH, weight: 700 }));
    y += fsH * 1.25;
    const bitsRow = (label, pat, yy) => {
      svg.appendChild(T(rx, yy, label, { size: fsM, italic: true, fill: COLORS.ink2 }));
      svg.appendChild(S(rx + fs * 1.1, yy, [...pat].map((ch) => [ch, ch === "-" ? { fill: COLORS.flip, weight: 700 } : {}]), { size: fsM, mono: true }));
    };
    bitsRow("i", iPat, y); bitsRow("j", jPat, y + fsM * 1.3);
    const dx = rx + fs * 1.1 + fsM * 0.62 * p + 4.5;
    svg.appendChild(S(dx, y, [["IF  "], [`${ex.i0 + 1}–${ex.i1}`, { weight: 700 }], ["  AND  "], [`${ex.j0 + 1}–${ex.j1}`, { weight: 700 }]], { size: fs }));
    svg.appendChild(S(dx, y + fsM * 1.3, [["THEN  "], ["contact", { weight: 700 }], ["  (0 exceptions)", { fill: COLORS.ink2 }]], { size: fs }));
    y += fsM * 1.3 + fsH * 1.3;

    svg.appendChild(el("line", { x1: rx, y1: y - fsH * 0.85, x2: w - inset, y2: y - fsH * 0.85, stroke: COLORS.rule, "stroke-width": 0.3 }));
    svg.appendChild(T(rx, y, "Read from the rules: strand pairs", { size: fsH, weight: 700 }));
    y += fsH * 1.15;
    const shown = rows.filter((q) => q.orientation !== "short");
    const segTxt = (q) => `${q.i0 + 1}–${q.i1} · ${q.j0 + 1}–${q.j1}`;
    const ori = (q) => `${WORD[q.orientation]}${q.hairpin ? " hairpin" : ""}`;
    const ev = (q) => (q.register ? (q.register.kind === "i + j" ? `i + j = ${q.register.lo + 2}–${q.register.hi + 2}` : `j − i = ${q.register.lo}–${q.register.hi}`) : "");
    const colA = rx + fs * 1.45;
    const colB = colA + Math.max(...shown.map((q) => measure(segTxt(q), { size: fsM, weight: 700 }))) + 2.4;
    const colC = colB + Math.max(...shown.map((q) => measure(ori(q), { size: fsM }))) + 2.4;
    for (const q of shown) {
      svg.appendChild(el("rect", { x: rx, y: y - fsM * 0.62, width: fs * 1.05, height: fsM * 0.62, rx: fsM * 0.31, fill: q.color }));
      svg.appendChild(T(colA, y, segTxt(q), { size: fsM, weight: 700 }));
      svg.appendChild(T(colB, y, ori(q), { size: fsM }));
      svg.appendChild(T(colC, y, ev(q), { size: fsM, fill: COLORS.ink2 }));
      y += fsM * 1.12;
    }

    // dataset lines
    const lines = [
      [[`${X.psicov.exact} / ${X.psicov.proteins} proteins exact`, { weight: 700 }], [` on all ${n(X.psicov.inputs)} inputs`]],
      [[`${n(X.psicov.rules)} rules`, { weight: 700 }], [", 0 exceptions, 0 contacts missed"]],
      [[`${X.psicov.antiparallel} antiparallel`, { weight: 700 }], [" and "], [`${X.psicov.parallel} parallel`, { weight: 700 }], [` pairs, ${X.psicov.hairpins} hairpins`]],
    ];
    let by = h - inset - fsM * 0.25 - fsM * 1.12 * (lines.length - 1);
    svg.appendChild(el("line", { x1: rx, y1: by - fsM * 1.0, x2: w - inset, y2: by - fsM * 1.0, stroke: COLORS.rule, "stroke-width": 0.3 }));
    for (const parts of lines) { svg.appendChild(S(rx, by, parts, { size: fsM })); by += fsM * 1.12; }
  }, `Contact map of 1fnaA with ${d.blocks.length} block rules coloured by strand pair. One AND gate, i = ${iPat}, j = ${jPat}, reads: if residue in ${ex.i0 + 1}-${ex.i1} and residue in ${ex.j0 + 1}-${ex.j1} then contact, with no exception. Strand pairs read from the rules: ${rows.map((q) => `${q.i0 + 1}-${q.i1} with ${q.j0 + 1}-${q.j1} ${q.orientation}`).join("; ")}. Across ${X.psicov.proteins} proteins every circuit is exact on all ${X.psicov.inputs} inputs; ${X.psicov.rules} rules, 0 exceptions; ${X.psicov.antiparallel} antiparallel and ${X.psicov.parallel} parallel strand pairs, ${X.psicov.hairpins} hairpins.`);
  measure.done();
}
