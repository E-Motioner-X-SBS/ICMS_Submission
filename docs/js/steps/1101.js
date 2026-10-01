// 1101 From the rules, inferences: block rules that continue one another describe one pair of
// touching segments; their positions give direction and register exactly. Nucleic acids add a
// base-pairing cross-check from geometry.
import { h, theoremBlock, tags, nextStep, css, stageWidth, add, failBox, residueLabel, dataTable } from "../ui.js";
import { createViewer } from "../viz/structure3d.js";
import { circuitTerms, rulesFrom, inferences, basePairs, setText } from "../core/rules.js";
import { int } from "../core/format.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) e.append(k); return e; };
const ORIENT = {
  antiparallel: { color: "#2a78d6", word: "antiparallel" },
  parallel: { color: "#e34948", word: "parallel" },
  mixed: { color: "#9b6a1c", word: "no single direction" },
  short: { color: "#7B8A99", word: "too short to orient" },
};

/** A ladder diagram of one strand pair: two arrows in chain direction, rungs for each contact. */
function ladder(c, label, W) {
  const H = 96, pad = 34, a = c.i0, b = c.i1 - 1;
  const anti = c.orientation === "antiparallel";
  // place the second segment so that paired residues sit above each other
  const centre = c.register ? (c.register.lo + c.register.hi) / 2 : null;
  const xsI = (i) => i, xsJ = (j) => (anti ? centre - j : c.orientation === "parallel" ? j - (c.register.lo + c.register.hi) / 2 : j - c.j0 + a);
  const all = [a, b, xsJ(c.j0), xsJ(c.j1 - 1)], lo = Math.min(...all) - 0.5, hi = Math.max(...all) + 0.5;
  const X = (u) => pad + ((u - lo) / Math.max(1, hi - lo)) * (W - 2 * pad);
  const yI = 26, yJ = 70, col = ORIENT[c.orientation].color;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": `Segment ${a}–${b} against ${c.j0}–${c.j1 - 1}, ${c.orientation}` });
  for (const [i, j] of c.pairs) svg.append(s("line", { x1: X(xsI(i)), y1: yI + 6, x2: X(xsJ(j)), y2: yJ - 6, style: `stroke:${col};stroke-width:1.4;opacity:0.55` }));
  const arrow = (x1, x2, y) => { const dir = Math.sign(x2 - x1) || 1; return s("path", { d: `M${x1},${y - 5} L${x2 - dir * 9},${y - 5} L${x2 - dir * 9},${y - 9} L${x2 + dir * 3},${y} L${x2 - dir * 9},${y + 9} L${x2 - dir * 9},${y + 5} L${x1},${y + 5} Z`, style: `fill:${col}` }); };
  svg.append(arrow(X(xsI(a)) - 4, X(xsI(b)) + 4, yI));
  const j1 = X(xsJ(c.j0)), j2 = X(xsJ(c.j1 - 1));
  svg.append(arrow(j1 + (j2 > j1 ? -4 : 4), j2 + (j2 > j1 ? 4 : -4), yJ));
  const t = (x, y, str, anchor) => s("text", { x, y, "text-anchor": anchor, style: "font:600 11px var(--mono);fill:var(--ink-2)" }, str);
  svg.append(t(X(xsI(a)) - 8, yI + 4, label(a), "end"), t(X(xsI(b)) + 14, yI + 4, label(b), "start"));
  svg.append(t(j1 + (j2 > j1 ? -8 : 8), yJ + 4, label(c.j0), j2 > j1 ? "end" : "start"), t(j2 + (j2 > j1 ? 14 : -14), yJ + 4, label(c.j1 - 1), j2 > j1 ? "start" : "end"));
  return svg;
}

/** Base pairs as an arc diagram over the chain (nucleic acids). */
function pairArcs(L, pairs, W) {
  const pad = 12, y0 = 120, x = (i) => pad + (i / Math.max(1, L - 1)) * (W - 2 * pad);
  const svg = s("svg", { viewBox: `0 0 ${W} ${y0 + 26}`, width: "100%", role: "img", "aria-label": `${pairs.length} base pairs drawn as arcs over the chain` });
  for (const q of pairs) {
    const a = x(q.i), b = x(q.j), r = (b - a) / 2, lift = Math.min(y0 - 6, r * 1.2);
    svg.append(s("path", { d: `M${a},${y0} C${a},${y0 - lift} ${b},${y0 - lift} ${b},${y0}`, style: `fill:none;stroke:${q.wc ? "var(--teal)" : "var(--flip)"};stroke-width:1.6;opacity:0.85` }));
  }
  svg.append(s("line", { x1: pad, y1: y0, x2: W - pad, y2: y0, style: "stroke:var(--ink);stroke-width:2" }));
  const step = L > 150 ? 50 : L > 60 ? 20 : 10;
  for (let i = 0; i < L; i += step) svg.append(s("text", { x: x(i), y: y0 + 18, "text-anchor": "middle", style: "font:500 11px var(--sans);fill:var(--ink-3)" }, String(i)));
  return svg;
}

export default {
  async mount(el, ctx) {
    const { chain } = ctx, cm = ctx.derived.contacts(), L = cm.L, na = chain.entityType !== "protein";
    let alive = true, viewer = null;
    this._off = () => { alive = false; viewer?.dispose(); };
    const status = h("div.loading", h("span.spinner"), "Reading the rules…");
    add(el, h("h1", "From the rules, inferences"),
      h("p.hook", "Block rules that continue one another along both segments describe one pair of touching segments. Their positions then tell which segments pair, in which direction and in which register, by a stated rule applied to every contact of the pair."),
      status);
    let a;
    try { a = await ctx.derived.analysis(); } catch (e) { status.replaceChildren(failBox(e)); return; }
    if (!alive) return;
    status.remove();
    const rules = rulesFrom(circuitTerms(a.cover, a.p, L), cm.has);
    const inf = inferences(rules, chain, cm.has);
    const label = (k) => residueLabel(chain, k);
    const n = (o) => inf.filter((c) => c.orientation === o).length;
    const W = () => Math.max(300, Math.min(stageWidth(el), 640));

    const cards = inf.map((c, k) => {
      const o = ORIENT[c.orientation];
      const evidence = c.register
        ? `over all ${c.nPairs} contacts, i + j spans ${c.sumRange.lo}–${c.sumRange.hi} and j − i spans ${c.diffRange.lo}–${c.diffRange.hi} (positions from 0)`
        : `${c.nPairs} contacts from ${c.blocks.length} ${c.blocks.length === 1 ? "rule" : "rules"}`;
      const sentence = [
        c.orientation === "antiparallel" || c.orientation === "parallel" ? `Segments ${label(c.i0)}–${label(c.i1 - 1)} and ${label(c.j0)}–${label(c.j1 - 1)} run ${o.word}.` : `Segments ${label(c.i0)}–${label(c.i1 - 1)} and ${label(c.j0)}–${label(c.j1 - 1)} touch as a block.`,
        c.hairpin ? ` They are joined by a loop of ${c.gap} ${c.gap === 1 ? "residue" : "residues"}: a hairpin.` : "",
        c.strands?.[0] && c.strands[0] !== c.strands[1] ? ` They lie on different strands (${c.strands[0]} and ${c.strands[1]}).` : "",
      ].join("");
      return h("section.takeaway", { "aria-label": `Pair ${k + 1}` },
        h("h3", h("span", { style: { color: o.color } }, "■ "), `Pair ${k + 1}: ${o.word}`),
        h("p", sentence),
        h("div", { "data-ladder": k }),
        h("ul.checks", h("li", `Evidence: ${evidence}.`), h("li", `From ${c.blocks.length} block ${c.blocks.length === 1 ? "rule" : "rules"} (${c.rules.map((r) => `R${rules.indexOf(r) + 1}`).join(", ")}), each holding for every pair it names.`)));
    });

    const summary = inf.length
      ? `${int(inf.length)} strand ${inf.length === 1 ? "pair" : "pairs"}: ${n("antiparallel")} antiparallel, ${n("parallel")} parallel${n("short") + n("mixed") ? `, ${n("short") + n("mixed")} too short or mixed` : ""}${inf.some((c) => c.hairpin) ? `; ${inf.filter((c) => c.hairpin).length} ${inf.filter((c) => c.hairpin).length === 1 ? "hairpin" : "hairpins"}` : ""}.`
      : cm.n ? "No block rules here, so no strand pairs to read: this structure's contacts are isolated rather than segment against segment." : "This chain has no contacts under the definition, so there are no rules to read inferences from.";
    const viewBox = h("div.viewer", { "aria-label": "3D backbone coloured by strand pair direction" }, h("span.hint", "drag sideways to turn"));

    add(el,
      h("div.stats",
        h("div.stat", h("div.v", int(inf.length)), h("div.l", "strand pairs from block rules")),
        h("div.stat", h("div.v", int(n("antiparallel"))), h("div.l", "antiparallel")),
        h("div.stat", h("div.v", int(n("parallel"))), h("div.l", "parallel")),
        h("div.stat", h("div.v", int(inf.reduce((m, c) => m + c.nPairs, 0))), h("div.l", `of ${int(cm.n)} contacts inside them`))),
      h("p", summary),
      h("p.small", "The rule: a pair made of one block has no direction. Otherwise, over all its contacts (positions i, j counted from 0), the pair is antiparallel when i + j varies less than j − i, parallel when j − i varies less. The range printed is the full spread over every contact, not an average."),
      viewBox,
      h("div.legend", Object.values(ORIENT).map((o) => h("span", h("i", { style: { background: o.color } }), o.word))),
      ...cards.slice(0, 8),
      inf.length > 8 ? h("details.thm-more", h("summary", `${inf.length - 8} more strand pairs`), dataTable([
        { key: "seg", label: "segments" }, { key: "o", label: "direction" }, { key: "ev", label: "evidence" }, { key: "n", label: "contacts", num: true }, { key: "r", label: "rules", num: true }],
        inf.slice(8).map((c) => ({ seg: `${label(c.i0)}–${label(c.i1 - 1)} · ${label(c.j0)}–${label(c.j1 - 1)}`, o: ORIENT[c.orientation].word + (c.hairpin ? ", hairpin" : ""),
          ev: c.register ? `${c.register.kind} = ${c.register.lo}–${c.register.hi}` : "", n: c.nPairs, r: c.blocks.length })), { sortKey: "n", desc: true, pageSize: 10 })) : null,
      na ? h("h2", "Cross-check: base pairs from geometry") : null,
      na ? h("div", { id: "bp" }) : null,
      tags([["lean", "sc_contact_cube_is_block"], ["lean", "contactMap8_symmetric"], ["data", `your structure: ${int(inf.length)} pairs from ${int(rules.filter((r) => r.kind === "block").length)} block rules`]]),
      h("p", "Each inference rests on rules that hold for every pair they name, and on the segment lemma that makes a block rule a pair of unbroken segments. The words antiparallel and hairpin describe the counted geometry; naming it a β-sheet or a stem is the reader's interpretation."),
      theoremBlock("1101", ["SequenceCircuits.sc_contact_cube_is_block", "ContactMapCompleteness.contactMap8_symmetric", "ContactMapCompleteness.contactCell_symmetric"]),
      nextStep(ctx, "Back to the sequence: minimised the same way, it must come back unchanged."));
    el.querySelectorAll("[data-ladder]").forEach((d) => d.append(ladder(inf[+d.dataset.ladder], label, W())));   // only the cards shown

    if (na) {
      const bp = basePairs(chain), box = el.querySelector("#bp");
      const wc = bp.pairs.filter((q) => q.wc).length;
      add(box,
        h("p", `Independently of the circuit, a base pair is counted when a purine N1 sits within ${bp.cutoff} Å of a pyrimidine N3, the central Watson–Crick hydrogen bond. This chain has ${int(bp.pairs.length)} such pairs; ${int(wc)} are Watson–Crick (A–${chain.entityType === "rna" ? "U" : "T"}, G–C).`),
        bp.pairs.length ? h("section.stage.white", { "aria-label": "Base pairs" }, pairArcs(L, bp.pairs, W()),
          h("div.legend", h("span", h("i", { style: { background: "var(--teal)" } }), "Watson–Crick"), h("span", h("i", { style: { background: "var(--flip)" } }), "other"))) : null,
        bp.stems.length ? h("ul.checks", bp.stems.filter((st) => st.length >= 2).slice(0, 8).map((st) => h("li",
          `Stem of ${st.length} pairs: ${label(st[0].i)}–${label(st.at(-1).i)} with ${label(st.at(-1).j)}–${label(st[0].j)} (${st.map((q) => q.letters).join(" ")}), ${st.filter((q) => q.wc).length} of ${st.length} Watson–Crick.`))) : null);
    }

    viewer = await createViewer(viewBox, chain);
    if (!alive) { viewer?.dispose(); return; }
    const owner = new Map();
    inf.forEach((c) => { for (const [i, j] of c.pairs) { if (!owner.has(i)) owner.set(i, c); if (!owner.has(j)) owner.set(j, c); } });
    viewer?.setColors((i) => (owner.has(i) ? ORIENT[owner.get(i).orientation].color : null));
    viewer?.setRungs(inf.flatMap((c) => c.pairs.map(([i, j]) => [i, j, ORIENT[c.orientation].color])));
  },
  unmount() { this._off?.(); },
};
