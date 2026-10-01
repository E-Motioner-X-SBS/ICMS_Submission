// Rules that hold for 100% of one species' sequences: SARS-CoV-2 Omicron Spike, 1,299 sequences
// (data/spike_rules.json ← data/prep_spike_rules.py, which recounts every combination from the
// alignment and checks every sequence; circuits from co-evolution-analysis stage_coevo.json).
// Left: the contact map of the Omicron BA.2 RBD (PDB 7XB0, data/spike_rbd.json ←
// data/prep_spike_rbd.py; C-beta < 8 Å, |i−j| ≥ 6, as for the proteins) with every rule pair whose
// two positions lie in the RBD ringed; none of them is a contact. Right: three co-evolving
// position pairs (Wuhan-Hu-1 numbering) drawn as residue-pair tables: each cell is the number of
// sequences with that combination; a dashed 0 is a combination of two residues that both occur
// at their positions but never together (a forbidden rule).
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
function T(size, { weight = 500, fill = COLORS.ink, anchor = "start", stretch = 92, family = FONT.sans, italic = false } = {}) {
  return { "font-size": pt(size), "font-weight": weight, "text-anchor": anchor, style: `font-family:${family};fill:${fill};font-stretch:${stretch}%;${italic ? "font-style:italic;" : ""}` };
}
const n = (v) => v.toLocaleString("en-US");
// greedy word wrap to a width (mm)
function wrap(M, str, attrs, width) {
  const out = []; let cur = "";
  for (const wd of str.split(" ")) { const t = cur ? `${cur} ${wd}` : wd; if (cur && M(t, attrs) > width) { out.push(cur); cur = wd; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}

export default async function build(host, { w, h }) {
  const R = await loadJSON("spike_rules.json");
  const S = await loadJSON("spike_rbd.json");
  if (R.totals.violations !== 0 || !R.totals.all_match_recount || !R.totals.all_sound_complete) throw new Error("spike: rules not exact");
  const pairs = SHOW.map(([p, q]) => {
    const pr = R.pairs.find((x) => x.wuhan[0] === p && x.wuhan[1] === q);
    if (!pr) throw new Error(`spike: pair ${p}/${q} missing`);
    const cnt = Object.fromEntries(pr.allowed.map((a) => [a.pair, a.count]));
    const total = pr.allowed.reduce((s, a) => s + a.count, 0);
    if (total !== pr.n_sequences) throw new Error(`spike: ${p}/${q} counts do not add up`);
    return { ...pr, p, q, cnt };
  });
  // the structure: every RBD rule pair is in spike_rbd.json, none is a contact, and the structure
  // carries the dataset's most common combination at each pair
  const inRbd = R.pairs.filter((x) => x.wuhan.every((v) => v !== null && v >= S.first && v <= S.last));
  if (inRbd.length !== S.pairs.length || S.pairs.some((q) => !inRbd.some((x) => x.wuhan[0] === q.p && x.wuhan[1] === q.q))) throw new Error("spike: RBD pairs differ");
  const cset = new Set(S.contacts.map(([i, j]) => `${i},${j}`));
  for (const q of S.pairs) {
    if (q.contact || cset.has(`${q.p},${q.q}`) || S.pairs_in_contact !== 0) throw new Error("spike: a rule pair is a contact");
    if (q.res_p + q.res_q !== q.most_common) throw new Error(`spike: 7XB0 is not the main haplotype at ${q.p}/${q.q}`);
  }
  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo"].map((f) => document.fonts.load(f).catch(() => null)));
  const M = makeMeasure();

  mount(host, w, h, (svg) => {
    const inset = 1.4, fs = 19.5, fsS = 18.5, fsH = 20.5;

    // ── left: the RBD contact map with the rule pairs ringed ──────────────────────
    const LW = 100, N = S.last - S.first + 1;
    const ax = pt(fsS) * 1.2, tick = pt(fsS) * 1.75;
    const noteTxt = `Rings: the ${S.pairs.length} RBD rule pairs. None is a contact: Cβ ${Math.min(...S.pairs.filter((q) => q.separation >= 6).map((q) => q.cb_distance)).toFixed(1)}–${Math.max(...S.pairs.map((q) => q.cb_distance)).toFixed(1)} Å, or ${S.pairs.filter((q) => q.separation < 6 && q.cb_distance < 8).map((q) => `${q.separation} apart (${q.p}–${q.q})`).join(", ")}.`;
    const note = wrap(M, noteTxt, T(fsS), LW - inset);
    const titleY = inset + pt(fsH) * 0.85;
    const my = titleY + 3.2, mx = inset + ax + tick;
    const Mm = Math.min(LW - mx, h - my - pt(fsS) * 1.05 - pt(fsS) * 1.25 - note.length * pt(fsS) * 1.15 - inset - 1.5);
    const cs = Mm / N, X = (r) => mx + (r - S.first) * cs, Y = (r) => my + (r - S.first) * cs;
    svg.appendChild(el("text", { x: inset, y: titleY, ...T(fsH) }, [
      el("tspan", { "font-weight": 700 }, ["Omicron BA.2 RBD"]),
      el("tspan", { style: `font-family:${FONT.sans};fill:${COLORS.ink2};font-stretch:92%;` }, [`  PDB ${S.pdb}`]),
    ]));
    svg.appendChild(el("rect", { x: mx, y: my, width: Mm, height: Mm, fill: COLORS.paper, stroke: COLORS.ink300, "stroke-width": 0.3 }));
    for (const [i, j] of S.contacts) for (const [r, c] of [[i, j], [j, i]])
      svg.appendChild(el("rect", { x: X(c), y: Y(r), width: cs, height: cs, fill: COLORS.ink400 }));
    svg.appendChild(el("line", { x1: mx, y1: my, x2: mx + Mm, y2: my + Mm, stroke: COLORS.rule, "stroke-width": 0.25 }));
    for (const r of [340, 380, 420, 460, 500]) {
      svg.appendChild(txt(mx - 1, Y(r) + cs / 2 + pt(fsS) * 0.34, String(r), T(fsS, { anchor: "end", fill: COLORS.ink2 })));
      svg.appendChild(txt(X(r) + cs / 2, my + Mm + pt(fsS) * 1.05, String(r), T(fsS, { anchor: "middle", fill: COLORS.ink2 })));
    }
    const axisT = (v) => [el("tspan", {}, ["Spike residue "]), el("tspan", { style: `font-family:${FONT.sans};fill:${COLORS.ink};font-style:italic;` }, [v])];
    svg.appendChild(el("text", { x: mx + Mm / 2, y: my + Mm + pt(fsS) * 2.25, ...T(fsS, { anchor: "middle" }) }, axisT("j")));
    const yt = el("text", { x: 0, y: 0, ...T(fsS, { anchor: "middle" }) }, axisT("i"));
    yt.setAttribute("transform", `translate(${inset + pt(fsS) * 0.78},${my + Mm / 2}) rotate(-90)`);
    svg.appendChild(yt);
    // rings on the upper triangle (row i < column j); each label takes the first free spot around its ring
    const rr = 2.1, placed = [], fsL = pt(fsS), inMap = (b) => b.x0 >= mx + 0.5 && b.x1 <= mx + Mm - 0.5 && b.y0 >= my + 0.5 && b.y1 <= my + Mm - 0.5;
    const rings = S.pairs.map((q) => ({ q, cx: X(q.q) + cs / 2, cy: Y(q.p) + cs / 2 }));
    const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    for (const { cx, cy } of rings) placed.push({ x0: cx - rr, x1: cx + rr, y0: cy - rr, y1: cy + rr });
    for (const { q, cx, cy } of rings) {
      svg.appendChild(el("circle", { cx, cy, r: rr, fill: "none", stroke: COLORS.teal, "stroke-width": 0.75 }));
      const str = `${q.p}–${q.q}`, lw = M(str, T(fsS, { weight: 700 })), g0 = rr + 0.9;
      const spots = [[cx + g0, cy + fsL * 0.34], [cx - lw / 2, cy - g0 - 0.3], [cx - g0 - lw, cy + fsL * 0.34], [cx - lw / 2, cy + g0 + fsL * 0.72]];
      const spot = spots.map(([x, y]) => ({ x, y, b: { x0: x - 0.4, x1: x + lw + 0.4, y0: y - fsL * 0.74, y1: y + 0.4 } })).find((o) => inMap(o.b) && !placed.some((pb) => hit(pb, o.b)));
      if (!spot) throw new Error(`spike: no room for the label of ${str}`);
      placed.push(spot.b);
      const lab = txt(spot.x, spot.y, str, T(fsS, { weight: 700 }));
      lab.setAttribute("paint-order", "stroke"); lab.setAttribute("stroke", COLORS.paper); lab.setAttribute("stroke-width", 0.9); lab.setAttribute("stroke-linejoin", "round");
      svg.appendChild(lab);
    }
    let ny = my + Mm + pt(fsS) * 2.25 + pt(fsS) * 1.25;
    for (const line of note) { svg.appendChild(txt(inset, ny, line, T(fsS, { fill: COLORS.ink2 }))); ny += pt(fsS) * 1.15; }

    // ── right: three residue-pair tables ─────────────────────────────────────────
    const RX = LW + 5, colW = (w - RX - inset) / SHOW.length;
    const maxRows = Math.max(...pairs.map((p) => p.alphabet_i.length));
    const ch = 8.6, top = inset + pt(fsH) * 0.85;
    let tablesBottom = 0;
    pairs.forEach((pr, k) => {
      const x0 = RX + k * colW;
      const cw = Math.min(17.5, (colW - 18) / pr.alphabet_j.length);
      svg.appendChild(txt(x0, top, `${pr.p} × ${pr.q}`, T(fsH, { weight: 700 })));
      svg.appendChild(txt(x0, top + pt(fsS) * 1.2, `${n(pr.n_sequences)} sequences`, T(fsS, { fill: COLORS.ink2 })));
      const gx = x0 + 15, gy = top + pt(fsS) * 1.2 + 9.2;
      pr.alphabet_j.forEach((b, c) => svg.appendChild(txt(gx + (c + 0.5) * cw, gy - 1.6, `${b}${pr.q}`, T(fsS, { anchor: "middle", weight: 700, fill: COLORS.ink2 }))));
      pr.alphabet_i.forEach((a, r) => {
        svg.appendChild(txt(gx - 1.4, gy + (r + 0.66) * ch, `${a}${pr.p}`, T(fsS, { anchor: "end", weight: 700, fill: COLORS.ink2 })));
        pr.alphabet_j.forEach((b, c) => {
          const v = pr.cnt[a + b] ?? 0, x = gx + c * cw, y = gy + r * ch;
          svg.appendChild(el("rect", { x: x + 0.35, y: y + 0.35, width: cw - 0.7, height: ch - 0.7, rx: 1,
            fill: v ? COLORS.tealWash : COLORS.paper, stroke: v ? "none" : COLORS.ink, "stroke-width": v ? 0 : 0.4, "stroke-dasharray": v ? null : "1.1 0.8" }));
          svg.appendChild(txt(x + cw / 2, y + ch * 0.66, n(v), T(fs, { weight: 700, anchor: "middle" })));
        });
      });
      // implications that hold in every sequence, in words: the rule, then its support
      let iy = gy + maxRows * ch + pt(fs) * 1.3;
      for (const im of pr.implications.filter((i) => i.support >= 20).slice(0, 2)) {
        const from = im.at === "i" ? `${im.if}${pr.p}` : `${im.if}${pr.q}`, to = im.at === "i" ? `${im.then}${pr.q}` : `${im.then}${pr.p}`;
        svg.appendChild(txt(x0, iy, `${from} ⇒ ${to}`, T(fs, { weight: 700 })));
        svg.appendChild(txt(x0, iy + pt(fsS) * 1.12, `in ${n(im.support)} of ${n(im.support)}`, T(fsS, { fill: COLORS.ink2 })));
        iy += pt(fs) * 1.12 + pt(fsS) * 1.3;
      }
      tablesBottom = Math.max(tablesBottom, iy);
    });
    // the dataset lines
    const t = R.totals;
    const tot = wrap(M, `${t.pairs} position pairs · ${t.allowed} allowed and ${t.forbidden} forbidden residue combinations · ${t.implications} implications · ${t.violations} violations: every one of the ${n(R.n_sequences)} sequences obeys every rule`, T(fs, { weight: 700 }), w - RX - inset);
    let ly = h - inset - pt(fs) * 0.3 - pt(fs) * 1.2 * (tot.length - 1);
    if (ly - pt(fs) * 1.2 < tablesBottom - pt(fs)) throw new Error("spike: totals collide with the tables");
    svg.appendChild(el("line", { x1: RX, y1: ly - pt(fs) * 1.2, x2: w - inset, y2: ly - pt(fs) * 1.2, stroke: COLORS.rule, "stroke-width": 0.3 }));
    for (const line of tot) { svg.appendChild(txt(RX, ly, line, T(fs, { weight: 700 }))); ly += pt(fs) * 1.2; }
  }, `SARS-CoV-2 Omicron Spike, ${R.n_sequences} sequences. Left: contact map of the Omicron BA.2 RBD, PDB ${S.pdb}, residues ${S.first} to ${S.last}, with the ${S.pairs.length} rule pairs that lie in the RBD ringed (${S.pairs.map((q) => `${q.p}-${q.q}, ${q.cb_distance} Å`).join("; ")}); none is a contact. Right: residue-pair tables for positions ${SHOW.map((s) => s.join(" and ")).join("; ")}; every combination never observed is a forbidden rule; ${R.totals.pairs} pairs, ${R.totals.allowed} allowed and ${R.totals.forbidden} forbidden combinations, ${R.totals.implications} implications, ${R.totals.violations} violations.`);
  M.done();
}
