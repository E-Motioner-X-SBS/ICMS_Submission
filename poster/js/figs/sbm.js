// Contact rules that hold in EVERY frame of structure-based-model (SBM) folding trajectories
// (data/exact_summary.json ← data/sbm_exact.json ← data/prep_sbm_exact.py).
// Left: one rule from a dense 8,000-frame trajectory of crambin (1CBN), as its frame-count
// truth table: frames by (contact a formed?, contact t formed?). The rule a ⇒ t is exact
// because the "a formed, t broken" cell is 0. Right: the same count over every trajectory.
// Everything printed is a count; the build stops if the table does not add up.
import { mount, el, txt, pt, COLORS, FONT, loadJSON, NS } from "../lib.js";

const EXAMPLE = "1CBN";

function makeMeasure() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("style", "position:absolute;left:-9999px;top:0;visibility:hidden");
  document.body.appendChild(s);
  const m = (str, attrs) => { const t = txt(0, 0, str, attrs); s.appendChild(t); const wd = t.getComputedTextLength(); t.remove(); return wd; };
  m.done = () => s.remove();
  return m;
}
function T(size, { weight = 500, fill = COLORS.ink, anchor = "start", stretch = 92, family = FONT.sans, italic = false } = {}) {
  return {
    "font-size": pt(size), "font-weight": weight, "text-anchor": anchor,
    style: `font-family:${family};fill:${fill};font-stretch:${stretch}%;${italic ? "font-style:italic;" : ""}`,
  };
}
const n = (v) => v.toLocaleString("en-US");

export default async function build(host, { w, h }) {
  const X = (await loadJSON("exact_summary.json")).sbm;
  const ex = X.denseExamples.find((r) => r.target === EXAMPLE);
  if (!ex) throw new Error(`sbm: no dense example for ${EXAMPLE}`);
  const e = ex.example, [[at, anot], [nat, nant]] = e.table;
  if (anot !== 0 || e.counterexamples !== 0) throw new Error("sbm: the example rule has a counterexample");
  if (at + anot + nat + nant !== e.frames || at + anot !== e.if_formed || at + nat !== e.then_formed) throw new Error("sbm: table does not add up");
  if (X.dense.implications !== X.dense.neighbour_implications) throw new Error("sbm: not every dense rule links neighbours");
  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo", '500 20px "Plex Mono"'].map((f) => document.fonts.load(f).catch(() => null)));
  const M = makeMeasure();
  const a = `${e.if[0]}–${e.if[1]}`, t = `${e.then[0]}–${e.then[1]}`;

  mount(host, w, h, (svg) => {
    const inset = 1.4, fsH = 20.5, fs = 19.5, fsS = 18.5;
    // ── left: the truth-count table of one rule ────────────────────────────────
    let y = inset + pt(fsH) * 0.85;
    svg.appendChild(txt(inset, y, `Crambin, ${n(e.frames)} frames`, T(fsH, { weight: 700 })));
    y += pt(fs) * 1.18;
    svg.appendChild(txt(inset, y, `a = contact ${a}, t = ${t}`, T(fsS, { fill: COLORS.ink2 })));
    const rowLab = Math.max(M("a formed", T(fsS)), M("a broken", T(fsS))) + 2;
    const cw = Math.max(M("t formed", T(fsS)), M("t broken", T(fsS)), M("5,429", T(fs, { weight: 700 }))) + 3, chh = 9.2;
    const gx = inset + rowLab, gy = y + pt(fsS) * 1.7;
    svg.appendChild(txt(gx + cw / 2, gy - 1.3, "t formed", T(fsS, { anchor: "middle", fill: COLORS.ink2 })));
    svg.appendChild(txt(gx + cw * 1.5, gy - 1.3, "t broken", T(fsS, { anchor: "middle", fill: COLORS.ink2 })));
    const cell = (c, r, v, hot) => {
      const x = gx + c * cw, yy = gy + r * chh;
      svg.appendChild(el("rect", { x: x + 0.4, y: yy + 0.4, width: cw - 0.8, height: chh - 0.8, rx: 1.2,
        fill: hot ? COLORS.paper : r === 0 && c === 0 ? COLORS.tealWash : COLORS.wash, stroke: hot ? COLORS.ink : "none", "stroke-width": hot ? 0.5 : 0, "stroke-dasharray": hot ? "1.1 0.8" : null }));
      svg.appendChild(txt(x + cw / 2, yy + chh * 0.68, n(v), T(hot ? 24 : fs, { weight: 700, anchor: "middle" })));
    };
    cell(0, 0, at, false); cell(1, 0, anot, true); cell(0, 1, nat, false); cell(1, 1, nant, false);
    svg.appendChild(txt(gx - 1.4, gy + chh * 0.64, "a formed", T(fsS, { anchor: "end", fill: COLORS.ink2 })));
    svg.appendChild(txt(gx - 1.4, gy + chh * 1.64, "a broken", T(fsS, { anchor: "end", fill: COLORS.ink2 })));
    const leftEnd = gx + 2 * cw;

    // ── right: the dataset count ─────────────────────────────────────────────────
    const rx = leftEnd + 10;
    let ry = inset + pt(30) * 0.8;
    svg.appendChild(txt(rx, ry, n(X.runs.implications), T(30, { weight: 700, stretch: 88 })));
    ry += pt(fsS) * 1.25;
    svg.appendChild(txt(rx, ry, "rules hold in every frame", T(fsS, { weight: 700 })));
    ry += pt(fsS) * 1.15;
    svg.appendChild(txt(rx, ry, `of ${X.runs.proteins} folding runs`, T(fsS, { fill: COLORS.ink2 })));
    ry += pt(fsS) * 1.5;
    svg.appendChild(txt(rx, ry, "like a ⇒ t: a formed", T(fsS, { fill: COLORS.ink2 })));
    ry += pt(fsS) * 1.15;
    svg.appendChild(txt(rx, ry, "never without t", T(fsS, { fill: COLORS.ink2 })));

    // ── bottom row: where the rules sit ──────────────────────────────────────────
    const by = h - inset - pt(fsS) * 0.3;
    svg.appendChild(el("line", { x1: inset, y1: by - pt(24) * 1.05, x2: w - inset, y2: by - pt(24) * 1.05, stroke: COLORS.rule, "stroke-width": 0.3 }));
    const NUM = T(24, { weight: 700, stretch: 88 }), LAB = T(fsS, { fill: COLORS.ink2 });
    const widthOf = (v, label) => M(v, NUM) + 1.6 + M(label, LAB);
    const inline = (x, v, label) => {
      svg.appendChild(txt(x, by, v, NUM));
      svg.appendChild(txt(x + M(v, NUM) + 1.6, by, label, LAB));
    };
    const v1 = n(X.runs.neighbour_implications), l1 = "join neighbouring contacts";
    const v2 = `${X.dense.neighbour_implications} / ${X.dense.implications}`;
    const end1 = inset + widthOf(v1, l1) + 5;
    const l2 = ["in ten 8,000-frame runs", "in the long runs", "in long runs"].find((l) => w - inset - widthOf(v2, l) >= end1) ?? "in long runs";
    inline(inset, v1, l1);
    inline(w - inset - widthOf(v2, l2), v2, l2);
  }, `Crambin ${EXAMPLE}, ${e.frames} frames: whenever contact ${a} is formed, contact ${t} is formed; frames: both formed ${at}, ${a} formed and ${t} broken ${anot}, ${a} broken and ${t} formed ${nat}, both broken ${nant}. Over all trajectories ${X.runs.implications} rules hold in every frame (${X.runs.with_rules} of ${X.runs.proteins}), ${X.runs.neighbour_implications} join neighbouring contacts; in the 10 long runs all ${X.dense.implications} do.`);
  M.done();
}
