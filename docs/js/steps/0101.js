// 0101 Minimisation finds blocks: exact Quine–McCluskey on the chain's contact function.
import { h, theoremBlock, tags, nextStep, css, stageWidth, sleep, reducedMotion, add, failBox } from "../ui.js";
import { contactMapCanvas, barsSVG } from "../viz/maps.js";
import { createViewer } from "../viz/structure3d.js";
import { bits } from "../core/encoding.js";
import { int, pct, num } from "../core/format.js";
import { strandPairClusters } from "../core/clusters.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) e.append(k); return e; };
const CATEGORICAL = ["#2a78d6", "#e34948", "#008300", "#e87ba4", "#4a3aa7", "#1baf7a", "#9b6a1c"];
const range = (a, b) => (b - a === 1 ? `${a}` : `${a}–${b - 1}`);

/** A cube's field as bits with the free (low) ones drawn as dashes. */
const fieldBits = (v, nFree, p) => bits(v, p).slice(0, p - nFree) + "–".repeat(nFree);

/** Arc diagram: the chain as a line, each strand pair a band joining its two segments. */
function arcDiagram(L, blocks, colourOf, selected, W) {
  const pad = 12, y0 = 150, H = 178, x = (i) => pad + (i / L) * (W - 2 * pad);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": `The chain as a line from 0 to ${L - 1}; each band joins two segments that touch as a block` });
  blocks.forEach((b, k) => {
    if (selected !== null && selected !== k) return;
    const a0 = x(b.i0), a1 = x(b.i1), c0 = x(b.j0), c1 = x(b.j1);
    const r = (c1 - a0) / 2, lift = Math.min(y0 - 10, r * 1.1 + 6);
    const d = `M${a0},${y0} C${a0},${y0 - lift} ${c1},${y0 - lift} ${c1},${y0} L${c0},${y0} C${c0},${y0 - lift * 0.8} ${a1},${y0 - lift * 0.8} ${a1},${y0} Z`;
    svg.append(s("path", { d, style: `fill:${colourOf(k)};opacity:${selected === null ? 0.55 : 0.8}` }));
  });
  svg.append(s("line", { x1: pad, y1: y0, x2: W - pad, y2: y0, style: "stroke:var(--ink);stroke-width:2" }));
  blocks.forEach((b, k) => {
    if (selected !== null && selected !== k) return;
    for (const [u, v] of [[b.i0, b.i1], [b.j0, b.j1]]) svg.append(s("rect", { x: x(u), y: y0 - 3, width: Math.max(2, x(v) - x(u)), height: 6, rx: 2, style: `fill:${colourOf(k)}` }));
  });
  const step = L > 400 ? 100 : L > 150 ? 50 : L > 60 ? 20 : 10;
  for (let i = 0; i < L; i += step) svg.append(s("text", { x: x(i), y: y0 + 20, "text-anchor": "middle", style: "font:500 11px var(--sans);fill:var(--ink-3)" }, String(i)));
  return svg;
}

export default {
  async mount(el, ctx) {
    const { chain } = ctx, cm = ctx.derived.contacts(), L = cm.L;
    let alive = true, viewer = null, map = null, res = null, sel = null, ro = null;
    this._off = () => { alive = false; viewer?.dispose(); ro?.disconnect(); };
    const colourOf = (k) => (k < CATEGORICAL.length ? CATEGORICAL[k] : css("--cell-4"));

    const rounds = h("div.rounds", { "aria-live": "polite" });
    const summary = h("div");
    const results = h("div", { hidden: true });
    add(el, 
      h("h1", "Minimisation finds blocks"),
      h("p.hook", "Quine–McCluskey merges 1-cells that differ in one bit into cubes, then cubes into bigger cubes, until nothing can grow. The cubes that cannot grow are the prime implicants; a cover built from them (every essential prime, then a greedy choice of the rest) describes the map exactly, with far fewer terms than cells."),
      h("p", cm.n ? `For the ${int(cm.n)} contacts of chain ${chain.id}: every prime implicant is found exactly; the cover keeps every essential one and completes the rest greedily, so it is exact (sound and complete) though not certified minimal.` : `Chain ${chain.id} has no contacts under the definition, so there is nothing to merge.`),
      h("section.stage", { "aria-label": "Minimisation progress" }, rounds, summary),
      results);

    let analysis;
    try {
      analysis = await ctx.derived.analysis();
    } catch (e) { if (alive) rounds.replaceChildren(failBox(e)); return; }
    if (!alive) return;
    res = analysis;
    // replay the merge rounds at a readable pace
    const lines = [h("div", `Start: ${int(res.nOn)} 1-cells of ${res.nVars} bits (both orders of every contact).`)];
    rounds.replaceChildren(...lines);
    const replay = res.rounds || [];
    for (const r of replay) {
      if (!alive) return;
      if (!reducedMotion()) await sleep(360);
      const size = 2 ** r.round;
      rounds.append(h("div", h("b", `Round ${r.round}: `), r.nTerms ? `${int(r.nTerms)} cubes of ${size} cells` : "no cube can grow", `; ${int(r.nPrimes)} prime ${r.nPrimes === 1 ? "implicant" : "implicants"} so far.`));
    }
    if (!alive) return;
    summary.replaceChildren(h("div.stats", { style: { marginTop: "12px" } },
      h("div.stat", h("div.v", int(res.nPrimes)), h("div.l", "prime implicants")),
      h("div.stat", h("div.v", int(res.nCover)), h("div.l", `in the cover (${int(res.nEssential)} essential)`)),
      res.nCover ? h("div.stat", h("div.v", `${num(res.compression, 1)}×`), h("div.l", "fewer terms than 1-cells")) : h("div.stat", h("div.v", "—"), h("div.l", "no terms: the constant 0")),
      h("div.stat.ok", h("div.v", pct(res.fracContactsInBlocks)), h("div.l", `of contacts inside blocks (${int(res.contactsInBlocks)} of ${int(cm.n)})`))),
      h("ul.checks",
        h(`li${res.sound ? "" : ".bad"}`, "Sound: no cube of the cover touches a 0-cell."),
        h(`li${res.complete ? "" : ".bad"}`, `Complete: every one of the ${int(res.nOn)} 1-cells is covered.`)),
      h("p.small", { style: { marginBottom: 0 } }, res.cached
        ? `${int(res.nOn)} cells, ${int(res.nPrimes)} primes. Precomputed for this example by the same engine and matched to the contacts parsed here; any other entry is minimised live in a Web Worker.`
        : `${int(res.nOn)} cells, ${int(res.nPrimes)} primes, ${res.ms ? `${Math.round(res.ms)} ms` : ""} in a Web Worker.`));

    // ── blocks, grouped into strand pairs (the poster's definition) ──
    const blocks = res.blocks;
    const clusters = strandPairClusters(blocks, cm.has);
    const ex = [...blocks].sort((p, q) => Math.min(q.fi, q.fj) - Math.min(p.fi, p.fj) || q.size - p.size || p.i0 - q.i0)[0];
    const arcHolder = h("div", { "data-noswipe": "" });
    const mapStage = h("section.stage.white", { "aria-label": "Blocks on the contact map" });
    let canvas = h("canvas"); mapStage.append(canvas);
    const viewBox = h("div.viewer", { "aria-label": "3D backbone coloured by strand pair" }, h("span.hint", "drag sideways to turn"));
    const list = h("div.blocks-list");
    function paintAll() {
      const on = (k) => sel === null || sel === k;
      arcHolder.replaceChildren(arcDiagram(L, clusters, colourOf, sel, Math.max(300, stageWidth(arcHolder))));
      const shown = clusters.flatMap((c, k) => (on(k) ? c.blocks.map((bi) => ({ ...blocks[bi], color: colourOf(k), mirror: true })) : []));
      const fresh = h("canvas", { role: "img", "aria-label": `Contact map with ${shown.length} blocks marked` });
      canvas.replaceWith(fresh); canvas = fresh;
      map = contactMapCanvas(canvas, { L, pairs: cm.pairs, width: stageWidth(mapStage) - 28, blocks: shown });
      const owner = new Map();
      clusters.forEach((c, k) => { if (!on(k)) return; for (const [i, j] of c.pairs) { if (!owner.has(i)) owner.set(i, k); if (!owner.has(j)) owner.set(j, k); } });
      viewer?.setColors((i) => (owner.has(i) ? colourOf(owner.get(i)) : null));
      viewer?.setRungs(clusters.flatMap((c, k) => (on(k) ? c.pairs.map(([i, j]) => [i, j, colourOf(k)]) : [])));
      [...list.children].forEach((b, k) => b.setAttribute("aria-pressed", String(sel === k)));
    }
    clusters.forEach((c, k) => list.append(h("button", { type: "button", "aria-pressed": "false", on: { click: () => { sel = sel === k ? null : k; paintAll(); } } },
      h("i", { style: { background: colourOf(k) } }),
      h("span", h("b", `${range(c.i0, c.i1)} with ${range(c.j0, c.j1)}`), h("span.small", `  ${c.nPairs} contacts from ${c.blocks.length} ${c.blocks.length === 1 ? "block" : "blocks"}`)))));

    const example = ex ? h("div.eq", { style: { whiteSpace: "pre" } },
      `i = ${fieldBits(ex.val >>> res.p, ex.fi, res.p)}   j = ${fieldBits(ex.val & ((1 << res.p) - 1), ex.fj, res.p)}   (– free)\n` +
      `i ∈ ${range(ex.i0, ex.i1)},  j ∈ ${range(ex.j0, ex.j1)}\n` +
      `${ex.i1 - ex.i0} × ${ex.j1 - ex.j0} block = ${ex.size} contacts, one term`) : null;
    const inBlocks = res.contactsInBlocks;

    results.hidden = false;
    add(results,
      h("h2", "Cubes that are blocks"),
      h("p", "With plain binary positions, a cube whose free bits are the lowest ones of a field covers an unbroken run of positions. If both fields are like that, the cube is a rectangle on the map: every residue of one chain segment touches every residue of another. Lean proves this segment lemma for every cube on 4-bit positions; on your map every block is also checked, cell by cell."),
      example,
      ex ? h("p.small", `One of your blocks. Positions count from 0, as in the bits. ${blocks.length} such blocks cover ${int(inBlocks)} of the ${int(cm.n)} contacts.`) : h("p.note", cm.n ? "This map has no block of four or more cells: its contacts are isolated rather than segment against segment. Try a protein with β-sheets such as 1FNA." : "This chain has no contacts under the definition, so there are no blocks. Try a larger chain or one of the examples."),
      tags([["lean", "a contact cube is a segment × segment block"], ["lean", "low free bits = an unbroken segment"], ["data", `your map: ${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}`]]),
      clusters.length ? h("h2", "Blocks line up into strand pairs") : null,
      clusters.length ? h("p", `Neighbouring blocks that continue each other along both segments belong to one pair of touching strands or helices. Your ${blocks.length} blocks form ${clusters.length} such ${clusters.length === 1 ? "pair" : "pairs"}: the minimised circuit recovers the chain's packing without being told what a β-sheet is.`) : null,
      clusters.length ? h("section.stage.white", { "aria-label": "Arc diagram of strand pairs" }, arcHolder, h("div.cap", "The chain drawn as a line; each band joins two segments that touch. Tap a pair below to isolate it in every view.")) : null,
      clusters.length ? list : null,
      viewBox,
      mapStage,
      h("h2", "Is this more than chance?"),
      h("p", "Shuffle the contacts while keeping how far apart along the chain each one is (the same number of contacts at every separation), then minimise again. Blocks need neighbours touching neighbours; random contacts rarely line up."),
      h("div", { id: "shuffles" }, h("div.loading", h("span.spinner"), "Minimising 5 shuffled maps…")),
      h("p", "Across the 150 PSICOV proteins, every circuit is exact (150 of 150 sound and complete), and 9,260 of the 47,430 native contacts (19.5%) lie inside block rules, in 145 of the 150 proteins."),
      tags([["data", "150 / 150 exact circuits, 47,430 contacts"], ["lean", "covers every 1 (worked table)"], ["lean", "covers no 0 (worked table)"]]),
      h("p.small", "The soundness and completeness checks above are the executable versions of the two cover theorems, which Lean proves on a worked example; the browser runs them on your cover."),
      theoremBlock("0101", ["SequenceCircuits.sc_contact_cube_is_block", "SequenceCircuits.sc_low_free_is_interval", "ContactCircuits.cc_cover_complete", "ContactCircuits.cc_off_avoiding"]),
      nextStep(ctx, "The same minimiser, run on the sequence itself, must give the sequence back."));
    paintAll();
    let lastW = mapStage.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(mapStage.clientWidth - lastW) > 8) { lastW = mapStage.clientWidth; paintAll(); } });
    ro.observe(mapStage);

    // shuffles and the 3D view, in parallel
    const shufP = ctx.derived.shuffles(5).then((sh) => {
      if (!alive) return;
      const mean = sh.reduce((a, r) => a + r.fracContactsInBlocks, 0) / sh.length;
      const box = el.querySelector("#shuffles");
      box.replaceChildren(h("section.stage", { "aria-label": "Real vs shuffled" },
        h("div", { html: barsSVG([{ label: `chain ${chain.id}`, value: res.fracContactsInBlocks, color: "var(--teal)" },
          ...sh.map((r, k) => ({ label: `shuffle ${k + 1}`, value: r.fracContactsInBlocks, color: "var(--ink-3)" }))], { width: 340, max: Math.max(0.05, res.fracContactsInBlocks) }) }),
        h("div.cap", h("b", `${pct(res.fracContactsInBlocks)} vs ${pct(mean, 2)}`), " of contacts in blocks, real vs mean of 5 separation-preserving shuffles (seeded, reproducible).")));
    }).catch((e) => { const box = el.querySelector("#shuffles"); if (box) box.replaceChildren(failBox(e)); });
    viewer = await createViewer(viewBox, chain);
    if (!alive) { viewer?.dispose(); return; }
    paintAll();
    await shufP;
  },
  unmount() { this._off?.(); },
};
