// Rules that hold for 100% of one species' sequences: SARS-CoV-2 Spike, 1,299 sequences
// (data/spike_rules.json ← data/prep_spike_rules.py, which recounts every combination from the
// alignment and checks every sequence; circuits from co-evolution-analysis stage_coevo.json).
// Three co-evolving position pairs (Wuhan-Hu-1 numbering) drawn as residue-pair tables: each
// cell is the number of sequences with that combination; a dashed 0 is a combination of two
// residues that both occur at their positions but never together (a forbidden rule).
import { mount, el, txt, pt, COLORS, FONT, loadJSON, NS } from "../lib.js";

const SHOW = [[371, 376], [405, 408], [486, 493]];

function makeMeasure() {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("style", "position:absolute;left:-9999px;top:0;visibility:hidden");
  document.body.appendChild(s);
  const m = (str, attrs) => { const t = txt(0, 0, str, attrs); s.appendChild(t); const wd = t.getComputedTextLength(); t.remove(); return wd; };
  m.done = () => s.remove();
  return m;
}
function T(size, { weight = 500, fill = COLORS.ink, anchor = "start", stretch = 92, family = FONT.sans } = {}) {
  return { "font-size": pt(size), "font-weight": weight, "text-anchor": anchor, style: `font-family:${family};fill:${fill};font-stretch:${stretch}%;` };
}
const n = (v) => v.toLocaleString("en-US");

export default async function build(host, { w, h }) {
  const R = await loadJSON("spike_rules.json");
  if (R.totals.violations !== 0 || !R.totals.all_match_recount || !R.totals.all_sound_complete) throw new Error("spike: rules not exact");
  const pairs = SHOW.map(([p, q]) => {
    const pr = R.pairs.find((x) => x.wuhan[0] === p && x.wuhan[1] === q);
    if (!pr) throw new Error(`spike: pair ${p}/${q} missing`);
    const cnt = Object.fromEntries(pr.allowed.map((a) => [a.pair, a.count]));
    const total = pr.allowed.reduce((s, a) => s + a.count, 0);
    if (total !== pr.n_sequences) throw new Error(`spike: ${p}/${q} counts do not add up`);
    return { ...pr, p, q, cnt };
  });
  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo"].map((f) => document.fonts.load(f).catch(() => null)));
  const M = makeMeasure();

  mount(host, w, h, (svg) => {
    const inset = 1.4, fs = 19.5, fsS = 18.5, fsH = 20.5;
    const colW = (w - 2 * inset) / SHOW.length;
    let maxRows = Math.max(...pairs.map((p) => p.alphabet_i.length));
    const ch = 9, top = inset + pt(fsH) * 0.9;
    pairs.forEach((pr, k) => {
      const x0 = inset + k * colW;
      const cw = Math.min(19, (colW - 22) / pr.alphabet_j.length);
      svg.appendChild(txt(x0, top, `positions ${pr.p} × ${pr.q}`, T(fsH, { weight: 700 })));
      svg.appendChild(txt(x0, top + pt(fsS) * 1.2, `${n(pr.n_sequences)} sequences`, T(fsS, { fill: COLORS.ink2 })));
      const gx = x0 + 15, gy = top + pt(fsS) * 1.2 + 9.5;
      pr.alphabet_j.forEach((b, c) => svg.appendChild(txt(gx + (c + 0.5) * cw, gy - 1.6, `${b}${pr.q}`, T(fsS, { anchor: "middle", weight: 700, fill: COLORS.ink2 }))));
      pr.alphabet_i.forEach((a, r) => {
        svg.appendChild(txt(gx - 1.4, gy + (r + 0.66) * ch, `${a}${pr.p}`, T(fsS, { anchor: "end", weight: 700, fill: COLORS.ink2 })));
        pr.alphabet_j.forEach((b, c) => {
          const v = pr.cnt[a + b] ?? 0, x = gx + c * cw, y = gy + r * ch;
          svg.appendChild(el("rect", { x: x + 0.35, y: y + 0.35, width: cw - 0.7, height: ch - 0.7, rx: 1,
            fill: v ? COLORS.tealWash : COLORS.paper, stroke: v ? "none" : COLORS.ink, "stroke-width": v ? 0 : 0.4, "stroke-dasharray": v ? null : "1.1 0.8" }));
          svg.appendChild(txt(x + cw / 2, y + ch * 0.66, n(v), T(v ? fs : fs, { weight: 700, anchor: "middle", fill: v ? COLORS.ink : COLORS.ink })));
        });
      });
      // implications that hold in every sequence, in words
      let iy = gy + maxRows * ch + pt(fs) * 1.25;
      for (const im of pr.implications.filter((i) => i.support >= 20).slice(0, 2)) {
        const from = im.at === "i" ? `${im.if}${pr.p}` : `${im.if}${pr.q}`, to = im.at === "i" ? `${im.then}${pr.q}` : `${im.then}${pr.p}`;
        svg.appendChild(txt(x0, iy, `${from} ⇒ ${to}`, T(fs, { weight: 700 })));
        svg.appendChild(txt(x0 + M(`${from} ⇒ ${to}`, T(fs, { weight: 700 })) + 1.6, iy, `in ${n(im.support)} of ${n(im.support)}`, T(fsS, { fill: COLORS.ink2 })));
        iy += pt(fs) * 1.25;
      }
    });
    // the dataset lines
    const t = R.totals, ly = h - inset - pt(fs) * 1.45;
    svg.appendChild(el("line", { x1: inset, y1: ly - pt(fs) * 1.2, x2: w - inset, y2: ly - pt(fs) * 1.2, stroke: COLORS.rule, "stroke-width": 0.3 }));
    svg.appendChild(txt(inset, ly, `${t.pairs} position pairs · ${t.allowed} allowed and ${t.forbidden} forbidden residue combinations · ${t.implications} implications`, T(fs, { weight: 700 })));
    svg.appendChild(txt(inset, ly + pt(fs) * 1.2, `${t.violations} violations: every one of the ${n(R.n_sequences)} sequences obeys every rule`, T(fs, { weight: 700 })));
  }, `SARS-CoV-2 Spike, ${R.n_sequences} sequences: residue-pair tables for positions ${SHOW.map((s) => s.join(" and ")).join("; ")}; every combination never observed is a forbidden rule; ${R.totals.pairs} pairs, ${R.totals.allowed} allowed and ${R.totals.forbidden} forbidden combinations, ${R.totals.implications} implications, ${R.totals.violations} violations.`);
  M.done();
}
