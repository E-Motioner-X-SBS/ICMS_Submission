// 1100 From the circuit, rules: every AND gate read in words, with its support and its
// (zero) exceptions; together the rules reproduce the contact map exactly.
import { h, theoremBlock, tags, nextStep, stageWidth, add, failBox, residueLabel } from "../ui.js";
import { contactMapCanvas, barsSVG } from "../viz/maps.js";
import { circuitTerms, rulesFrom, checkRules, setText } from "../core/rules.js";
import { int, pct } from "../core/format.js";

const KINDS = {
  block: { name: "Block rules", one: "block", what: "an unbroken segment against an unbroken segment, four or more contacts", color: "var(--teal)" },
  pair: { name: "Pair rules", one: "pair", what: "two neighbouring contacts", color: "var(--ink-2)" },
  strided: { name: "Strided rules", one: "strided", what: "positions sharing a bit pattern, with gaps between them", color: "var(--gold)" },
  single: { name: "Single contacts", one: "single", what: "one contact that merges with nothing", color: "var(--ink-3)" },
};
const PER = 12;

export default {
  async mount(el, ctx) {
    const { chain } = ctx, cm = ctx.derived.contacts(), L = cm.L;
    let alive = true, ro = null;
    this._off = () => { alive = false; ro?.disconnect(); };
    const status = h("div.loading", h("span.spinner"), "Reading the circuit…");
    add(el, h("h1", "From the circuit, rules"),
      h("p.hook", "Read an AND gate in words and it is a rule: IF position i is in one set AND position j in another, THEN they touch. The cover is exact, so every rule holds without a single exception, and together the rules say everything the contact map says."),
      status);
    let a;
    try { a = await ctx.derived.analysis(); } catch (e) { status.replaceChildren(failBox(e)); return; }
    if (!alive) return;
    status.remove();
    const terms = circuitTerms(a.cover, a.p, L);
    const rules = rulesFrom(terms, cm.has), chk = checkRules(rules, cm.pairs);
    const label = (k) => residueLabel(chain, k);
    const setLabel = (ps) => (ps.length > 1 && ps.every((x, k) => k === 0 || x === ps[k - 1] + 1) ? `${label(ps[0])}–${label(ps.at(-1))}` : ps.slice(0, 6).map(label).join(", ") + (ps.length > 6 ? ", …" : ""));
    const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, rules.filter((r) => r.kind === k)]));
    const explained = Object.fromEntries(Object.keys(KINDS).map((k) => [k, new Set(counts[k].flatMap((r) => r.cells.map((c) => c.join(","))))]));
    let filter = "all", page = 0, sel = rules[0] ?? null;

    const list = h("div.blocks-list");
    const pager = h("div.row", { style: { justifyContent: "space-between" } });
    const detail = h("div");
    const mapStage = h("section.stage.white", { "aria-label": "The selected rule on the contact map" });
    let canvas = h("canvas"); mapStage.append(canvas);

    const ruleText = (r) => `IF i ∈ ${setText(r.I.positions)} AND j ∈ ${setText(r.J.positions)} THEN contact`;
    function shown() { return filter === "all" ? rules : counts[filter]; }
    function drawList() {
      const rs = shown(), pages = Math.max(1, Math.ceil(rs.length / PER));
      page = Math.min(page, pages - 1);
      list.replaceChildren(...rs.slice(page * PER, (page + 1) * PER).map((r) => h("button", { type: "button", "aria-pressed": String(r === sel), on: { click: () => { sel = r; drawList(); drawDetail(); drawMap(); } } },
        h("i", { style: { background: KINDS[r.kind].color } }),
        h("span", h("b", `R${rules.indexOf(r) + 1}`), " ", h("span.mono", { style: { fontSize: "13px" } }, ruleText(r)), h("br"),
          h("span.small", `${setLabel(r.I.positions)} with ${setLabel(r.J.positions)} · ${r.support} ${r.support === 1 ? "contact" : "contacts"} · ${r.exceptions} exceptions`)))));
      pager.replaceChildren(
        h("button.btn.small.ghost", { type: "button", disabled: page === 0, on: { click: () => { page--; drawList(); } } }, "←"),
        h("span.small", rs.length ? `${page * PER + 1}–${Math.min(rs.length, (page + 1) * PER)} of ${rs.length}` : "none"),
        h("button.btn.small.ghost", { type: "button", disabled: page >= pages - 1, on: { click: () => { page++; drawList(); } } }, "→"));
    }
    function drawDetail() {
      if (!sel) { detail.replaceChildren(); return; }
      detail.replaceChildren(h("div.eq", { style: { whiteSpace: "pre" } },
        `R${rules.indexOf(sel) + 1}  (${KINDS[sel.kind].one} rule, from AND gate${sel.terms.length > 1 ? "s" : ""} ${sel.terms.map((k) => `T${k + 1}`).join(", ")})\n` +
        `i = ${sel.I.pattern}  →  ${setText(sel.I.positions, 12)}\nj = ${sel.J.pattern}  →  ${setText(sel.J.positions, 12)}\n` +
        `holds for ${sel.support} of ${sel.support} pairs it names: ${sel.cells.slice(0, 8).map(([i, j]) => `${label(i)}–${label(j)}`).join(", ")}${sel.cells.length > 8 ? ", …" : ""}`));
    }
    function drawMap() {
      const fresh = h("canvas", { role: "img", "aria-label": "Contact map with the selected rule's cells in orange" });
      canvas.replaceWith(fresh); canvas = fresh;
      contactMapCanvas(canvas, { L, pairs: cm.pairs, width: stageWidth(mapStage) - 28, marks: sel ? sel.cells : [] });
    }
    const seg = h("div.seg", { role: "group", "aria-label": "Rule kind" }, ["all", ...Object.keys(KINDS)].map((k) => h("button", { type: "button", "aria-pressed": String(k === filter),
      on: { click: (e) => { filter = k; page = 0; [...seg.children].forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); sel = shown()[0] ?? null; drawList(); drawDetail(); drawMap(); } } },
      k === "all" ? `All ${rules.length}` : `${KINDS[k].one} ${counts[k].length}`)));

    add(el,
      h("div.stats",
        h("div.stat", h("div.v", int(rules.length)), h("div.l", `rules (${int(terms.length)} gates; mirror images merged)`)),
        h("div.stat.ok", h("div.v", `${int(chk.contacts - chk.missed)}/${int(chk.contacts)}`), h("div.l", "contacts explained by a rule")),
        h("div.stat.ok", h("div.v", int(chk.exceptions)), h("div.l", "exceptions: rule fires, no contact")),
        h("div.stat", h("div.v", int(counts.block.length)), h("div.l", `block rules, ${pct(explained.block.size / Math.max(1, cm.n))} of contacts`))),
      h("ul.checks",
        h(`li${chk.complete ? "" : ".bad"}`, `Complete: each of the ${int(chk.contacts)} contacts is named by at least one rule.`),
        h(`li${chk.sound ? "" : ".bad"}`, `Sound: no rule names a pair that does not touch (${int(rules.reduce((n, r) => n + r.support, 0))} rule–pair statements checked).`)),
      rules.length ? null : h("p.note", "This chain has no contacts under the definition, so its circuit has no AND gate and there are no rules to read. Try a larger chain, or one of the examples."),
      h("h2", "Four kinds of rule"),
      h("section.stage", { "aria-label": "Rules by kind" }, h("div", { html: barsSVG(Object.entries(KINDS).map(([k, v]) => ({ label: v.name, value: explained[k].size / Math.max(1, cm.n), color: v.color })), { width: 340, max: 1 }) }),
        h("div.cap", "Share of contacts each kind explains (a contact can be named by more than one rule)."),
        h("div.legend", Object.values(KINDS).map((v) => h("span", h("i", { style: { background: v.color } }), `${v.one}: ${v.what}`)))),
      h("h2", "The rules"),
      h("p.small", "A rule names positions, counted from 0 as in the bits; residues are labelled as in the PDB file, letter and residue number."),
      seg, h("div", { style: { marginTop: "10px" } }, list), pager,
      detail, mapStage,
      tags([["lean", "sc_low_free_is_interval"], ["lean", "sc_contact_cube_is_block"], ["lean", "cc_padding_safety"], ["data", `your structure: ${int(rules.length)} rules, 0 exceptions`]]),
      h("p", "Why the ranges are honest: with plain binary positions, free low bits mean an unbroken run of 2^u positions (proved for every position and run length up to 256), so a block rule really is one segment against another, not a scatter of cells. Rules about real positions never fire on the padding beyond the chain."),
      theoremBlock("1100", ["SequenceCircuits.sc_low_free_is_interval", "SequenceCircuits.sc_interval_span", "SequenceCircuits.sc_contact_cube_is_block", "ContactCircuits.cc_padding_safety"]),
      nextStep(ctx, "Rules that line up tell you how the chain is folded."));
    drawList(); drawDetail(); drawMap();
    let lastW = mapStage.clientWidth;
    ro = new ResizeObserver(() => { if (Math.abs(mapStage.clientWidth - lastW) > 8) { lastW = mapStage.clientWidth; drawMap(); } });
    ro.observe(mapStage);
  },
  unmount() { this._off?.(); },
};
