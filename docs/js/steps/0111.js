// 0111 Contacts become a Boolean function: the chain's contact map, in 3D and as a truth table.
import { h, theoremBlock, tags, nextStep, css, stageWidth, add, residueLabel } from "../ui.js";
import { contactMapCanvas } from "../viz/maps.js";
import { createViewer } from "../viz/structure3d.js";
import { contactFunction } from "../core/qm.js";
import { chainSegments } from "../core/contacts.js";
import { bits } from "../core/encoding.js";
import { int, pct } from "../core/format.js";

export default {
  async mount(el, ctx) {
    const { chain } = ctx, cm = ctx.derived.contacts(), L = cm.L;
    const f = contactFunction(cm.pairs, L), p = f.p;
    const resLabel = (i) => residueLabel(chain, i);
    let sel = null, viewer = null, map = null, alive = true, ro = null;
    this._off = () => { alive = false; viewer?.dispose(); ro?.disconnect(); };

    // pick the busiest residue to start with
    let busiest = 0; for (let i = 0; i < L; i++) if (cm.neighbours(i).length > cm.neighbours(busiest).length) busiest = i;

    const viewBox = h("div.viewer", { "aria-label": "3D backbone. Drag to turn, tap a residue." }, h("span.hint", "drag sideways to turn · tap a residue"));
    const mapStage = h("section.stage.white", { "aria-label": "Contact map" });
    let canvas = h("canvas");
    mapStage.append(canvas);
    const readout = h("div.readout", { "aria-live": "polite" });
    const minterm = h("div.eq", { style: { whiteSpace: "pre" } });

    // the truth table itself: either every 1-cell (the minterms), or the full row of one residue
    let ttMode = "row", ttPage = 0, selJ = null;
    const TT_PER = 16;
    const ttBody = h("tbody"), ttPager = h("div.row.table-pager");
    const ttSeg = h("div.seg", { role: "group", "aria-label": "Truth table rows" },
      [["row", "Row of the selected residue"], ["ones", "Every 1-cell"]].map(([k, label]) => h("button", { type: "button", "aria-pressed": String(k === ttMode),
        on: { click: (e) => { ttMode = k; ttPage = 0; [...ttSeg.children].forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); drawTT(); } } }, label)));
    const ttRows = () => {
      if (ttMode === "ones") return f.on.map((m) => [m >>> p, m & ((1 << p) - 1)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return Array.from({ length: L }, (_, j) => [sel ?? 0, j]);
    };
    function drawTT(jump = false) {
      const rs = ttRows(), pages = Math.max(1, Math.ceil(rs.length / TT_PER));
      if (jump && selJ !== null) { const k = rs.findIndex(([i, j]) => i === sel && j === selJ); if (k >= 0) ttPage = Math.floor(k / TT_PER); }
      ttPage = Math.min(ttPage, pages - 1);
      ttBody.replaceChildren(...rs.slice(ttPage * TT_PER, (ttPage + 1) * TT_PER).map(([i, j]) => {
        const on = i !== j && cm.has(i, j);
        return h(`tr${on ? ".on" : ""}${i === sel && j === selJ ? ".sel" : ""}`, { style: { cursor: "pointer" }, on: { click: () => choose(i, j) } },
          h("td.num", String(i)), h("td.num", String(j)), h("td", bits(i, p)), h("td", bits(j, p)), h("td", h("b", on ? "1" : "0")), h("td", { style: { fontFamily: "var(--sans)" } }, on ? `${resLabel(i)}–${resLabel(j)}` : ""));
      }));
      ttPager.replaceChildren(
        h("button.btn.small.ghost", { type: "button", disabled: ttPage === 0, on: { click: () => { ttPage--; drawTT(); } } }, "←"),
        h("span.small", `rows ${ttPage * TT_PER + 1}–${Math.min(rs.length, (ttPage + 1) * TT_PER)} of ${int(rs.length)}${ttMode === "row" ? ` (i = ${sel ?? 0})` : " 1-cells"}`),
        h("button.btn.small.ghost", { type: "button", disabled: ttPage >= pages - 1, on: { click: () => { ttPage++; drawTT(); } } }, "→"));
    }

    function choose(i, j = null) {
      if (i !== sel) ttPage = 0;
      sel = i;
      map?.paint(i);
      const nb = cm.neighbours(i);
      viewer?.setColors((k) => (k === i ? css("--flip") : nb.includes(k) ? css("--teal") : null));
      viewer?.setRungs(nb.map((k) => [i, k, css("--flip")]));
      readout.replaceChildren(h("b", `Residue ${resLabel(i)}`), ` (position ${i}) touches ${nb.length} ${nb.length === 1 ? "residue" : "residues"}`,
        nb.length ? `: ${nb.slice(0, 12).map(resLabel).join(", ")}${nb.length > 12 ? ", …" : ""}` : "", ".");
      const jj = j ?? nb[0];
      selJ = jj ?? null; drawTT(true);
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
    const seg = chainSegments(chain);
    for (const [i, j] of cm.pairs) { if (!cm.has(j, i)) sym = false; if (i === j) irr = false; if (seg.strand[i] === seg.strand[j] && seg.seq[j] - seg.seq[i] < cm.def.minSep) sepOK = false; }
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
      h("h2", "The truth table"),
      h("p", `The contact map is a table of ${int(4 ** p)} rows, one for every value of the ${2 * p} input bits; ${int(f.on.length)} of them are 1. Browse one residue's row, or every 1-cell; tap a row to see it on the map and in 3D.`),
      ttSeg,
      h("div.scrollx", { style: { marginTop: "8px" }, "data-noswipe": "" }, h("table.tt", h("thead", h("tr", h("th", "i"), h("th", "j"), h("th", "i bits"), h("th", "j bits"), h("th", "C"), h("th", ""))), ttBody)),
      ttPager,
      h("div.stats",
        h("div.stat", h("div.v", int(L)), h("div.l", "positions")),
        h("div.stat", h("div.v", int(cm.n)), h("div.l", "contacts")),
        h("div.stat", h("div.v", `${2 * p} bits`), h("div.l", `inputs (${p} for i, ${p} for j)`)),
        h("div.stat", h("div.v", int(f.on.length)), h("div.l", `1-cells, ${pct(density, 2)} of 2^${2 * p}`))),
      h("h2", "Checked on your map"),
      h("ul.checks",
        h(`li${sym ? "" : ".bad"}`, `Symmetric: C(i, j) = C(j, i) for all ${int(cm.n)} contacts.`),
        h(`li${irr ? "" : ".bad"}`, "Irreflexive: no residue touches itself."),
        h(`li${sepOK ? "" : ".bad"}`, chain.strands ? `Every contact within a strand is at least ${cm.def.minSep} apart in sequence.` : `Every contact is at least ${cm.def.minSep} apart in sequence.`),
        h(`li${inj ? "" : ".bad"}`, `Injective cells: ${int(f.on.length)} ordered pairs give ${int(cells.size)} distinct ${2 * p}-bit codes.`)),
      tags([["lean", "contactMap8_symmetric (8-residue example)"], ["lean", "contactCell_injective"], ["data", `your map: ${int(cm.n)} contacts, 4 checks`]]),
      h("p", "These properties hold by the way the map is built; the browser confirms them for your map. Lean proves them for a fixed 8-residue example map, and proves the cell encoding injective for every pair of 3-bit positions."),
      theoremBlock("0111", ["ContactMapCompleteness.contactMap8_symmetric", "ContactMapCompleteness.contactMap8_irreflexive", "ContactMapCompleteness.contactCell_injective", "ContactMapCompleteness.contactMap8_min_separation"]),
      nextStep(ctx, "A Boolean function can be minimised. On a contact map, the pieces that survive turn out to be structure."));

    drawMap();
    let lastW = mapStage.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(mapStage.clientWidth - lastW) > 8) { lastW = mapStage.clientWidth; drawMap(); } });
    ro.observe(mapStage);
    choose(busiest);
    viewer = await createViewer(viewBox, chain, { onPick: (i) => choose(i) });
    if (!alive) { viewer?.dispose(); return; }
    choose(sel ?? busiest, selJ);
  },
  unmount() { this._off?.(); },
};
