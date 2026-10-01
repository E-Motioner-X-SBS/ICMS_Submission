// 0100 The structure as a circuit: the minimised contact function drawn as a two-level
// AND–OR circuit (PLA view and gate view), evaluated live, verified on every input, exported.
import { h, theoremBlock, tags, nextStep, css, stageWidth, add, failBox } from "../ui.js";
import { contactMapCanvas } from "../viz/maps.js";
import { circuitTerms, evaluate, verifyEverywhere, toPLA, toVerilog } from "../core/rules.js";
import { bits } from "../core/encoding.js";
import { int, num } from "../core/format.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) e.append(k); return e; };
const PAGE = 40;

/** The pipeline from file to circuit, as a labelled flow. */
function flow(items, W) {
  const n = items.length, gap = 8, bw = (W - gap * (n - 1)) / n, H = 74;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": items.map((x) => `${x.v} ${x.l}`).join(", then ") });
  items.forEach((x, k) => {
    const X = k * (bw + gap);
    svg.append(s("rect", { x: X, y: 4, width: bw, height: H - 8, rx: 9, style: `fill:${k === n - 1 ? "var(--ink)" : "var(--paper)"};stroke:var(--rule)` }));
    svg.append(s("text", { x: X + bw / 2, y: 33, "text-anchor": "middle", style: `font:760 ${bw < 70 ? 15 : 18}px var(--sans);font-stretch:88%;fill:${k === n - 1 ? "var(--paper)" : "var(--ink)"}` }, x.v));
    svg.append(s("text", { x: X + bw / 2, y: 52, "text-anchor": "middle", style: `font:500 ${bw < 70 ? 9.5 : 11}px var(--sans);fill:${k === n - 1 ? "var(--paper)" : "var(--ink-2)"}` }, x.l));
    if (k < n - 1) svg.append(s("path", { d: `M${X + bw + 1},${H / 2} l${gap - 2},0`, style: "stroke:var(--ink-3);stroke-width:1.5" }));
  });
  return svg;
}

/** PLA view: one row per AND gate; columns are the input lines; ● needs 1, ○ needs 0. */
function plaView(terms, p, from, sel, fired, onPick, W) {
  const rows = terms.slice(from, from + PAGE), cols = 2 * p;
  const lab = 34, top = 30, rh = 18, cw = Math.min(22, Math.floor((W - lab - 70) / cols)), gx = lab + cols * cw + 10;
  const H = top + rows.length * rh + 10;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": `AND plane, terms ${from + 1} to ${from + rows.length} of ${terms.length}` });
  for (let c = 0; c < cols; c++) {
    const x = lab + c * cw + cw / 2, name = c < p ? `i${p - 1 - c}` : `j${2 * p - 1 - c}`;
    svg.append(s("text", { x, y: 12, "text-anchor": "middle", style: `font:600 ${cw < 18 ? 8.5 : 10}px var(--mono);fill:${c < p ? "var(--teal)" : "var(--gold)"}` }, name));
    svg.append(s("line", { x1: x, y1: 18, x2: x, y2: H - 6, style: "stroke:var(--rule);stroke-width:1" }));
  }
  svg.append(s("line", { x1: gx + 30, y1: top - 4, x2: gx + 30, y2: H - 6, style: "stroke:var(--ink);stroke-width:2" }));
  svg.append(s("text", { x: gx + 30, y: 12, "text-anchor": "middle", style: "font:700 10px var(--sans);fill:var(--ink)" }, "OR"));
  rows.forEach((t, r) => {
    const y = top + r * rh + rh / 2, isSel = t.k === sel, on = fired?.has(t.k);
    const g = s("g", { style: "cursor:pointer" });
    g.append(s("rect", { x: 0, y: y - rh / 2 + 1, width: W, height: rh - 2, rx: 4, style: `fill:${isSel ? "var(--flip-wash)" : on ? "var(--teal-wash)" : "transparent"}` }));
    g.append(s("text", { x: lab - 6, y: y + 3.5, "text-anchor": "end", style: "font:500 10px var(--mono);fill:var(--ink-3)" }, `T${t.k + 1}`));
    g.append(s("line", { x1: lab, y1: y, x2: gx, y2: y, style: `stroke:${on ? "var(--teal)" : "var(--ink-3)"};stroke-width:${on ? 2 : 1}` }));
    const pat = t.I.pattern + t.J.pattern;
    [...pat].forEach((ch, c) => {
      if (ch === "-") return;
      const x = lab + c * cw + cw / 2;
      g.append(s("circle", { cx: x, cy: y, r: Math.min(5, cw * 0.27), style: ch === "1" ? `fill:var(--ink)` : `fill:var(--paper);stroke:var(--ink);stroke-width:1.5` }));
    });
    // AND gate glyph
    g.append(s("path", { d: `M${gx},${y - 6} h7 a6,6 0 0 1 0,12 h-7 z`, style: `fill:${on ? "var(--teal)" : "var(--paper)"};stroke:var(--ink);stroke-width:1.2` }));
    g.append(s("line", { x1: gx + 13, y1: y, x2: gx + 30, y2: y, style: `stroke:${on ? "var(--teal)" : "var(--ink-3)"};stroke-width:${on ? 2 : 1}` }));
    g.append(s("text", { x: gx + 40, y: y + 3.5, style: "font:500 10px var(--sans);fill:var(--ink-3)" }, `${2 ** t.nFree}`));
    g.addEventListener("click", () => onPick(t.k));
    svg.append(g);
  });
  return svg;
}

/** Gate view of one term: the input lines it reads, with NOT bubbles, into its AND gate. */
function gateView(t, p, W) {
  const pat = t.I.pattern + t.J.pattern, used = [...pat].map((ch, c) => ({ ch, c })).filter((x) => x.ch !== "-");
  const rh = 20, H = Math.max(80, used.length * rh + 30), gx = W - 130, gy = H / 2;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": `AND gate T${t.k + 1} reading ${used.length} literals` });
  used.forEach(({ ch, c }, r) => {
    const y = 18 + r * rh, name = c < p ? `i${p - 1 - c}` : `j${2 * p - 1 - c}`;
    svg.append(s("text", { x: 8, y: y + 4, style: `font:600 12px var(--mono);fill:${c < p ? "var(--teal)" : "var(--gold)"}` }, name));
    const x0 = 44, xb = gx - 40;
    svg.append(s("path", { d: `M${x0},${y} H${xb} C${xb + 20},${y} ${gx - 20},${gy + (r - used.length / 2) * 4} ${gx},${gy + (r - (used.length - 1) / 2) * Math.min(4, 40 / used.length)}`, style: "fill:none;stroke:var(--ink-2);stroke-width:1.3" }));
    if (ch === "0") svg.append(s("circle", { cx: xb - 6, cy: y, r: 4.5, style: "fill:var(--paper);stroke:var(--ink);stroke-width:1.5" }));
    svg.append(s("text", { x: xb - 18, y: y - 5, "text-anchor": "end", style: "font:500 10px var(--sans);fill:var(--ink-3)" }, ch === "0" ? "NOT" : ""));
  });
  const gh = Math.max(40, Math.min(H - 20, used.length * 4 + 24));
  svg.append(s("path", { d: `M${gx},${gy - gh / 2} h22 a${gh / 2},${gh / 2} 0 0 1 0,${gh} h-22 z`, style: "fill:var(--teal-wash);stroke:var(--ink);stroke-width:1.8" }));
  svg.append(s("text", { x: gx + 20, y: gy + 5, "text-anchor": "middle", style: "font:800 13px var(--sans);fill:var(--ink)" }, "AND"));
  svg.append(s("line", { x1: gx + 22 + gh / 2, y1: gy, x2: W - 8, y2: gy, style: "stroke:var(--ink);stroke-width:2" }));
  svg.append(s("text", { x: W - 8, y: gy - 8, "text-anchor": "end", style: "font:600 11px var(--mono);fill:var(--ink)" }, `T${t.k + 1} → OR`));
  return svg;
}

const download = (name, text, type = "text/plain") => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

export default {
  async mount(el, ctx) {
    const { chain, structure } = ctx, cm = ctx.derived.contacts(), L = cm.L;
    let alive = true, ro = null;
    this._off = () => { alive = false; ro?.disconnect(); };
    const status = h("div.loading", h("span.spinner"), "Minimising the contact function…");
    add(el, h("h1", "The structure as a circuit"),
      h("p.hook", `This chain is now one Boolean function, and its minimised cover is a circuit: one AND gate per term, one OR gate collecting them. Feed it the bits of two positions and it answers, exactly, whether those ${chain.entityType === "protein" ? "residues" : "nucleotides"} touch.`),
      status);
    let a;
    try { a = await ctx.derived.analysis(); } catch (e) { status.replaceChildren(failBox(e)); return; }
    if (!alive) return;
    status.remove();
    const p = a.p, terms = circuitTerms(a.cover, p, L);
    const order = [...terms].sort((x, y) => y.nFree - x.nFree || x.k - y.k);   // biggest cubes first
    const literals = terms.reduce((n, t) => n + t.literals, 0);
    let sel = order[0]?.k ?? null, page = 0, probe = null;

    const flowBox = h("div");
    const pla = h("div", { "data-noswipe": "" }), gate = h("div"), formula = h("div.eq", { style: { whiteSpace: "pre" } });
    const pager = h("div.row", { style: { justifyContent: "space-between", marginTop: "6px" } });
    const mapStage = h("section.stage.white", { "aria-label": "Pick an input on the contact map" });
    let canvas = h("canvas"); mapStage.append(canvas);
    const probeOut = h("div.readout", { "aria-live": "polite" });
    const verifyOut = h("div.readout", { "aria-live": "polite" });
    const firedSet = () => (probe ? new Set(evaluate(terms, p, probe[0], probe[1]).fired.map((t) => t.k)) : null);

    function drawFlow() {
      flowBox.replaceChildren(flow([{ v: structure.id, l: `chain ${chain.id}` }, { v: int(L), l: "positions" }, { v: int(cm.n), l: "contacts" },
        { v: int(a.nOn), l: "1-cells" }, { v: int(terms.length), l: "AND gates" }, { v: "1", l: "OR gate" }], Math.max(320, stageWidth(flowBox))));
    }
    function drawPLA() {
      const W = Math.max(300, Math.min(stageWidth(pla), 640));
      pla.replaceChildren(plaView(order, p, page * PAGE, sel, firedSet(), (k) => { sel = k; drawPLA(); drawGate(); drawMap(); }, W));
      const pages = Math.ceil(order.length / PAGE);
      pager.replaceChildren(
        h("button.btn.small.ghost", { type: "button", disabled: page === 0, on: { click: () => { page--; drawPLA(); } } }, "← previous"),
        h("span.small", `terms ${page * PAGE + 1}–${Math.min(order.length, (page + 1) * PAGE)} of ${order.length}, largest first`),
        h("button.btn.small.ghost", { type: "button", disabled: page >= pages - 1, on: { click: () => { page++; drawPLA(); } } }, "next →"));
    }
    function drawGate() {
      const t = terms[sel]; if (!t) return;
      gate.replaceChildren(gateView(t, p, Math.max(300, Math.min(stageWidth(gate), 640))));
      const lit = (pat, f) => [...pat].map((ch, k) => (ch === "-" ? null : `${ch === "0" ? "¬" : ""}${f}${p - 1 - k}`)).filter(Boolean);
      formula.textContent = `T${t.k + 1} = ${[...lit(t.I.pattern, "i"), ...lit(t.J.pattern, "j")].join(" ∧ ") || "1"}\n` +
        `i = ${t.I.pattern}  j = ${t.J.pattern}   (${t.literals} literals, ${2 ** t.nFree} cells)`;
    }
    function drawMap() {
      const fresh = h("canvas", { role: "img", "aria-label": "Contact map; tap a cell to feed it to the circuit" });
      canvas.replaceWith(fresh); canvas = fresh;
      const t = terms[sel], marks = [];
      if (t) for (const i of t.I.positions) for (const j of t.J.positions) marks.push([i, j]);
      contactMapCanvas(canvas, { L, pairs: cm.pairs, width: stageWidth(mapStage) - 28, marks, onTap: ({ i, j }) => { probe = [i, j]; runProbe(); } });
    }
    function runProbe() {
      const [i, j] = probe, r = evaluate(terms, p, i, j), truth = i !== j && cm.has(i, j);
      probeOut.replaceChildren(h("span.mono", `i = ${i} → ${bits(i, p)}, j = ${j} → ${bits(j, p)}`), h("br"),
        r.out ? h("span", `${r.fired.length} AND ${r.fired.length === 1 ? "gate fires" : "gates fire"} (${r.fired.slice(0, 6).map((t) => `T${t.k + 1}`).join(", ")}${r.fired.length > 6 ? ", …" : ""}), OR = 1: `, h("b", "contact")) : h("span", "No AND gate fires, OR = 0: ", h("b", "no contact")),
        h("span.small", r.out === truth ? `  ✓ matches the structure (${truth ? "they touch" : "they do not touch"}).` : "  ✗ disagrees with the structure."));
      if (r.fired.length) { sel = r.fired[0].k; page = Math.floor(order.findIndex((t) => t.k === sel) / PAGE); }
      drawPLA(); drawGate(); drawMap();
    }
    const verifyBtn = h("button.btn", { type: "button" }, `Run the circuit on all ${int(4 ** p)} inputs`);
    verifyBtn.addEventListener("click", () => {
      verifyBtn.disabled = true; const t0 = performance.now();
      const v = verifyEverywhere(terms, p, L, cm.has);
      verifyOut.replaceChildren(h("b", { style: { color: v.exact ? "var(--ok)" : "var(--bad)" } }, v.exact ? "✓ Exact. " : "✗ "),
        `${int(v.agree)} of ${int(v.inputs)} inputs agree with the structure: all ${int(v.real)} real position pairs and all ${int(v.padding)} padding inputs (positions ≥ ${L}), in ${Math.round(performance.now() - t0)} ms.`);
      verifyBtn.disabled = false;
    });
    const name = `${structure.id}_${chain.id.replace(/\W/g, "")}_contacts`;

    add(el,
      flowBox,
      h("div.stats",
        h("div.stat", h("div.v", `${2 * p}`), h("div.l", `input wires (${p} for i, ${p} for j)`)),
        h("div.stat", h("div.v", int(terms.length)), h("div.l", "AND gates, one OR")),
        h("div.stat", h("div.v", int(literals)), h("div.l", "literals (wires into ANDs)")),
        terms.length ? h("div.stat", h("div.v", `${num(4 ** p / terms.length, 0)}×`), h("div.l", `smaller than the ${int(4 ** p)}-row truth table`))
          : h("div.stat", h("div.v", "C = 0"), h("div.l", "the constant 0: no gate is needed"))),
      terms.length ? null : h("p.note", `This chain has no contacts under the definition (${cm.def.label}), so its circuit is the constant 0: it answers “no contact” for every input, which the button below checks.`),
      h("h2", "The AND plane"),
      h("p", "Each row is one AND gate. A filled dot means the gate needs that input wire to be 1, an open dot that it needs 0 (a NOT in front), no dot that it ignores the wire. Every gate feeds the single OR on the right; the number after it is how many cells the gate covers. Tap a row."),
      h("section.stage.white", { "aria-label": "AND plane of the circuit" }, pla, pager),
      h("h2", "One gate, drawn"),
      h("section.stage.white", { "aria-label": "Gate view" }, gate), formula,
      h("h2", "Run it"),
      h("p", "Tap any cell of the contact map: its two positions become the circuit's input bits, the gates that fire light up above, and the output is compared with the structure. The selected gate's cells are orange."),
      mapStage, probeOut,
      h("div", { style: { marginTop: "14px" } }, verifyBtn), verifyOut,
      tags([["lean", "cc_cover_complete"], ["lean", "cc_off_avoiding"], ["lean", "cc_fixed_match_unique"], ["data", `your circuit: ${int(terms.length)} gates, checked on ${int(4 ** p)} inputs`]]),
      h("p", "How exactness is established: the minimiser checks every cover for soundness (no gate covers a 0) and completeness (every 1 covered), the button above re-runs the finished circuit on every possible input, and Lean proves on a worked table that these two checks say what they claim."),
      h("h2", "Take the circuit with you"),
      h("div.row",
        h("button.btn.small.ghost", { type: "button", on: { click: () => download(`${name}.pla`, toPLA(terms, p, name)) } }, "Download .pla (Espresso)"),
        h("button.btn.small.ghost", { type: "button", on: { click: () => download(`${name}.v`, toVerilog(terms, p, name)) } }, "Download Verilog")),
      h("p.small", "Both files describe the same circuit; any logic tool can re-verify it against the contact map."),
      theoremBlock("0100", ["ContactCircuits.cc_cover_complete", "ContactCircuits.cc_off_avoiding", "ContactCircuits.cc_fixed_match_unique", "ContactMapCompleteness.contactCell_injective"]),
      nextStep(ctx, "Each AND gate, read in words, is a rule about the structure."));

    drawFlow(); drawPLA(); drawGate(); drawMap();
    probe = cm.pairs[0] ? [...cm.pairs[0]] : [0, 1]; runProbe();
    let lastW = mapStage.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(mapStage.clientWidth - lastW) > 8) { lastW = mapStage.clientWidth; drawFlow(); drawPLA(); drawGate(); drawMap(); } });
    ro.observe(mapStage);
  },
  unmount() { this._off?.(); },
};
