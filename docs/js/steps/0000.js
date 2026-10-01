// 0000 Pick a structure: search the PDB, or tap an offline example; choose a chain.
import { h, add } from "../ui.js";
import { EXAMPLES, search, normalizeId } from "../core/rcsb.js";
import { CHAPTERS } from "../app.js";

const KIND = { protein: "protein", dna: "DNA", rna: "RNA" };

export default {
  async mount(el, ctx) {
    const results = h("ul.results", { "aria-live": "polite" });
    const input = h("input", { type: "search", placeholder: "PDB ID or words, e.g. 1UBQ or hemoglobin", "aria-label": "Search the Protein Data Bank", autocomplete: "off", enterkeyhint: "search" });
    let ctl = null, timer = null;
    const open = (id, chain) => ctx.go("0001", { id, chainId: chain || null });
    async function run(q) {
      ctl?.abort(); ctl = new AbortController();
      if (!q.trim()) { results.replaceChildren(); return; }
      results.replaceChildren(h("li.loading", h("span.spinner"), "Searching the Protein Data Bank…"));
      try {
        const { results: rs, total } = await search(q, { signal: ctl.signal, rows: 8 });
        if (!rs.length) { results.replaceChildren(h("li.small", "Nothing found. Try another word, or a four-character PDB ID.")); return; }
        results.replaceChildren(); add(results, ...rs.map((r) => h("li", h("button", { type: "button", on: { click: () => open(r.id) } },
          h("span.id", r.id), h("span.t", r.title || "Open this entry"),
          h("span.m", [r.kinds?.map((k) => KIND[k] || k).join(" + "), r.method, r.resolution ? `${r.resolution.toFixed(2)} Å` : null, r.organisms?.[0]].filter(Boolean).join(", "))))),
          total > rs.length ? h("li.small", `${total.toLocaleString("en-US")} entries match; showing the first ${rs.length}.`) : null);
      } catch (e) { if (e.name !== "AbortError" && e.kind !== "aborted") results.replaceChildren(h("li.error", e.userMessage || e.message)); }
    }
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => run(input.value), 380); });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { const id = normalizeId(input.value); if (id) open(id); else run(input.value); } });

    const examples = h("div.examples", EXAMPLES.map((x) => h("button.ex", { type: "button", on: { click: () => open(x.id, x.kind === "protein" ? x.chain : null) } },
      h("span.id", x.id), h("span.nm", x.name), h("span.bl", x.blurb), h("span.kind", KIND[x.kind] || x.kind))));

    add(el, 
      h("h1", "Every molecule is a Boolean function"),
      h("p.hook", "Pick a protein, DNA or RNA. Step by step it becomes bits, a Karnaugh map, an exact circuit, rules and inferences. Every step is checked in your browser: against the statement of its Lean 4 theorem, or by running the result on every case."),
      h("ol.flow", { "aria-label": "The chapters" }, CHAPTERS.slice(1).map((c) => h("li", h("button", { type: "button",
        on: { click: () => ctx.go(c.id, ctx.structure ? {} : { id: EXAMPLES[0].id, chainId: EXAMPLES[0].chain }) } }, h("span.mono", c.id), " ", c.short)))),
      input, results,
      h("h2", "Or start from an example"),
      h("p.small", "These five work offline, useful on conference Wi-Fi."),
      examples);

    if (ctx.structure) {
      const s = ctx.structure;
      const opts = ctx.chainOptions(s);
      const chains = h("div.chains", opts.map((o) => h("button", { type: "button", "aria-pressed": String(o.id === ctx.chain.id), on: { click: () => ctx.go("0000", { id: s.id, chainId: o.id }) } },
        `${o.label} `, h("span.small", o.sub))));
      el.insertBefore(h("section.entry-card", { "aria-label": "Loaded structure" },
        h("span.small", `Loaded ${s.id}${s.source === "offline" ? " (bundled copy)" : ""}`),
        h("div.t", s.meta.title),
        h("div.m", [s.meta.method, s.meta.resolution ? `${s.meta.resolution.toFixed(2)} Å` : null, s.meta.organisms?.[0], s.meta.date?.slice(0, 4)].filter(Boolean).join(", ")),
        h("div.chains-l.small", { style: { marginTop: "10px" } }, "Chain to follow:"), chains,
        h("div.row", { style: { marginTop: "12px" } }, h("button.btn", { type: "button", on: { click: () => ctx.go("0001") } }, `Start with chain ${ctx.chain.id}`, h("span", { "aria-hidden": "true" }, " →")))),
      el.children[2]);
    }
  },
};
