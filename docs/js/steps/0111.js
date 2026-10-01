// 0111 Contacts become a Boolean function: the chain's contact map, in 3D and as a truth table.
import { h, theoremBlock, tags, nextStep, css, stageWidth, add } from "../ui.js";
import { contactMapCanvas } from "../viz/maps.js";
import { createViewer } from "../viz/structure3d.js";
import { contactFunction } from "../core/qm.js";
import { bits } from "../core/encoding.js";
import { int, pct } from "../core/format.js";

export default {
  async mount(el, ctx) {
    const { chain } = ctx, cm = ctx.derived.contacts(), L = cm.L;
    const f = contactFunction(cm.pairs, L), p = f.p;
    const resLabel = (i) => { const r = chain.residues[i]; return `${r.one ?? "?"}${r.authSeqId ?? r.seqId}`; };
    let sel = null, viewer = null, map = null, alive = true, ro = null;
    this._off = () => { alive = false; viewer?.dispose(); ro?.disconnect(); };

    // pick the busiest residue to start with
    let busiest = 0; for (let i = 0; i < L; i++) if (cm.neighbours(i).length > cm.neighbours(busiest).length) busiest = i;

    const viewBox = h("div.viewer", { "aria-label": "3D backbone. Drag to turn, tap a residue." }, h("span.hint", "drag to turn · tap a residue"));
    const mapStage = h("section.stage.white", { "aria-label": "Contact map" });
    let canvas = h("canvas");
    mapStage.append(canvas);
    const readout = h("div.readout", { "aria-live": "polite" });
    const minterm = h("div.eq", { style: { whiteSpace: "pre" } });

    function choose(i, j = null) {
      sel = i;
      map?.paint(i);
      const nb = cm.neighbours(i);
      viewer?.setColors((k) => (k === i ? css("--flip") : nb.includes(k) ? css("--teal") : null));
      viewer?.setRungs(nb.map((k) => [i, k, css("--flip")]));
      readout.replaceChildren(h("b", `Residue ${resLabel(i)}`), ` (position ${i}) touches ${nb.length} ${nb.length === 1 ? "residue" : "residues"}`,
        nb.length ? `: ${nb.slice(0, 12).map(resLabel).join(", ")}${nb.length > 12 ? ", …" : ""}` : "", ".");
      const jj = j ?? nb[0];
      if (jj === undefined) { minterm.textContent = `C(${i}, j) = 0 for every j`; return; }
      const on = cm.has(i, jj) ? 1 : 0;
      minterm.textContent = `i = ${String(i).padStart(3)} → ${bits(i, p)}\nj = ${String(jj).padStart(3)} → ${bits(jj, p)}\nC(${bits(i, p)} ${bits(jj, p)}) = ${on}`;
    }
    function drawMap() {
      const fresh = h("canvas", { role: "img", "aria-label": `Contact map, ${L} by ${L}, ${cm.n} contacts` });
      canvas.replaceWith(fresh); canvas = fresh;
      map = contactMapCanvas(canvas, { L, pairs: cm.pairs, width: stageWidth(mapStage) - 28, onTap: ({ i, j }) => choose(i, j) });
      if (sel !== null) map.paint(sel);
    }

    // checks on the visitor's map, computed here and now
    let sym = true, irr = true, sepOK = true;
    for (const [i, j] of cm.pairs) { if (!cm.has(j, i)) sym = false; if (i === j) irr = false; if (Math.abs(i - j) < cm.def.minSep) sepOK = false; }
    const cells = new Set(f.on); const inj = cells.size === f.on.length && f.on.length === 2 * cm.n;
    const density = f.on.length / 2 ** f.nVars;

    add(el, 
      h("h1", "Contacts become a Boolean function"),
      h("p.hook", `Two ${chain.entityType === "protein" ? "residues" : "nucleotides"} are in contact when they lie close in space. Write each position in ${p} bits and the contact map becomes a Boolean function C(i, j) of ${2 * p} inputs: 1 for touching pairs, 0 everywhere else.`),
      h("p.note", `Contact: ${cm.def.label}; ${cm.def.source}.${cm.missing.length ? ` ${cm.missing.length} residues lack coordinates and have no contacts.` : ""}`),
      viewBox,
      h("div", { style: { marginTop: "10px" } }, readout),
      h("h2", "The contact map"),
      h("p", "Row i, column j is dark when residues i and j touch. The map is symmetric, the diagonal band is empty (neighbours along the chain are excluded), and stripes parallel or perpendicular to the diagonal are helices and β-strands packing together. Tap anywhere."),
      mapStage,
      h("h2", "One cell of the truth table"),
      minterm,
      h("p.small", "Each 1-cell is a minterm: a full assignment of all input bits. Positions are plain binary here, which the next chapter needs."),
      h("div.stats",
        h("div.stat", h("div.v", int(L)), h("div.l", "positions")),
        h("div.stat", h("div.v", int(cm.n)), h("div.l", "contacts")),
        h("div.stat", h("div.v", `${2 * p} bits`), h("div.l", `inputs (${p} for i, ${p} for j)`)),
        h("div.stat", h("div.v", int(f.on.length)), h("div.l", `1-cells, ${pct(density, 2)} of 2^${2 * p}`))),
      h("h2", "Checked on your map"),
      h("ul.checks",
        h(`li${sym ? "" : ".bad"}`, `Symmetric: C(i, j) = C(j, i) for all ${int(cm.n)} contacts.`),
        h(`li${irr ? "" : ".bad"}`, "Irreflexive: no residue touches itself."),
        h(`li${sepOK ? "" : ".bad"}`, `Every contact is at least ${cm.def.minSep} apart along the chain.`),
        h(`li${inj ? "" : ".bad"}`, `Injective cells: ${int(f.on.length)} ordered pairs give ${int(cells.size)} distinct ${2 * p}-bit codes.`)),
      tags([["lean", "contactMap8_symmetric (8-residue example)"], ["lean", "contactCell_injective"], ["data", `your map: ${int(cm.n)} contacts, 4 checks`]]),
      h("p", "Lean proves these properties for a fixed 8-residue example map and proves the cell encoding injective for every pair of 3-bit positions. For your structure the browser checks the same properties directly; the proofs fix the definitions the checks test."),
      theoremBlock("0111", ["ContactMapCompleteness.contactMap8_symmetric", "ContactMapCompleteness.contactMap8_irreflexive", "ContactMapCompleteness.contactCell_injective", "ContactMapCompleteness.contactMap8_min_separation"]),
      nextStep(ctx, "A Boolean function can be minimised. On a contact map, the pieces that survive turn out to be structure."));

    drawMap();
    let lastW = mapStage.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(mapStage.clientWidth - lastW) > 8) { lastW = mapStage.clientWidth; drawMap(); } });
    ro.observe(mapStage);
    choose(busiest);
    viewer = await createViewer(viewBox, chain, { onPick: (i) => choose(i) });
    if (!alive) { viewer?.dispose(); return; }
    choose(sel ?? busiest);
  },
  unmount() { this._off?.(); },
};
