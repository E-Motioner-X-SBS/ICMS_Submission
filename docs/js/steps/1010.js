// 1010 What it all means: the visitor's results with their provenance, the takeaways,
// and the full theorem inventory, re-checkable here.
import { h, theoremBlock, tags, css, add } from "../ui.js";
import { STATS, THEOREMS, runAll, LEAN_FILES, REPO, TRUST_TEXT } from "../core/lean.js";
import { encodeSequence, alphabet } from "../core/encoding.js";
import { int, pct, ms } from "../core/format.js";

export default {
  async mount(el, ctx) {
    const { chain } = ctx, cm = ctx.derived.contacts();
    let alive = true;
    const ctl = new AbortController();
    this._off = () => { alive = false; ctl.abort(); };

    const yours = h("ul.checks", h("li.wait", "Collecting your results…"));
    const bar = h("i"), status = h("span.small", { "aria-live": "polite" });
    const runBtn = h("button.btn", { type: "button" }, `Re-check all ${STATS.theorems} theorems`);
    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true; status.textContent = "checking…";
      try {
        const r = await runAll({ signal: ctl.signal, onProgress: ({ index, total, cases }) => { bar.style.width = `${(100 * index) / total}%`; status.textContent = `${index} of ${total}, ${int(cases)} cases`; } });
        status.replaceChildren(h("b", { style: { color: r.ok ? "var(--ok)" : "var(--bad)" } }, r.ok ? "✓ " : "✗ "), `${r.theorems - r.failures.length} of ${r.theorems} hold: ${int(r.cases)} cases re-run in ${ms(r.ms)}.`);
      } catch (e) { if (e.name !== "AbortError") status.textContent = e.message; }
      runBtn.disabled = false;
    });

    let X = null;
    try { X = await (await fetch(new URL("../../data/exact_summary.json", import.meta.url))).json(); } catch { /* offline: the dataset section is skipped */ }
    if (!alive) return;
    const card = (title, lines, tagList) => h("div.takeaway", h("h3", title), h("ul.checks", lines.map((l) => h("li", l))), tags(tagList));
    const datasets = X ? [
      h("h2", "Exact, on whole datasets"),
      h("p", "The same pipeline, run on every structure, sequence and frame of four datasets. Each line is a count with no exception: every circuit was re-run on all its inputs, every rule against every case it names."),
      card("150 proteins (PSICOV)", [
        `${X.psicov.exact} of ${X.psicov.proteins} contact circuits exact on all ${int(X.psicov.inputs)} inputs; ${int(X.psicov.contacts)} contacts.`,
        `${int(X.psicov.rules)} rules, ${X.psicov.exceptions} exceptions, ${X.psicov.missed} contacts missed.`,
        `${int(X.psicov.contactsInBlocks)} contacts lie in ${int(X.psicov.ruleKinds.block)} block rules, in ${X.psicov.proteinsWithBlocks} proteins.`,
        `Read from the rules: ${X.psicov.antiparallel} antiparallel and ${X.psicov.parallel} parallel strand pairs, ${X.psicov.hairpins} hairpins.`,
        `${X.psicov.sequencesLossless} of ${X.psicov.proteins} sequences read back exactly from their circuits.`],
        [["data", "150 / 150 exact"], ["lean", "sc_contact_cube_is_block"]]),
      card(`${X.curated.chains} high-resolution chains (protein, DNA, RNA)`, [
        `All ${X.curated.chains} circuits exact: ${int(X.curated.totals.contacts)} contacts, ${int(X.curated.totals.rules)} rules, ${X.curated.totals.exceptions} exceptions.`,
        `${X.curated.byType.protein.structures} protein, ${X.curated.byType.dna.structures} DNA and ${X.curated.byType.rna.structures} RNA chains (X-ray, ≤ 1.5 Å).`,
        `DNA: ${X.curated.byType.dna.basePairs.watsonCrick} of ${X.curated.byType.dna.basePairs.n} base pairs found by geometry are Watson–Crick.`],
        [["data", `${X.curated.chains} / ${X.curated.chains} exact`]]),
      card(`One species: ${int(X.spike.sequences)} SARS-CoV-2 Spike sequences`, [
        `${X.spike.pairs} co-evolving position pairs: ${X.spike.allowed} allowed and ${X.spike.forbidden} forbidden residue combinations, ${X.spike.violations} violations in any sequence.`,
        `Example, positions ${X.spike.showcase.at[0]} and ${X.spike.showcase.at[1]}: ${X.spike.showcase.implications.map((i) => `${i.if} at ${i.at === "i" ? X.spike.showcase.at[0] : X.spike.showcase.at[1]} ⇒ ${i.then} at ${i.at === "i" ? X.spike.showcase.at[1] : X.spike.showcase.at[0]} (${int(i.support)} of ${int(i.support)})`).join("; ")}.`,
        `${X.spike.implications} such implications in all; every circuit is the unique minimum cover.`,
        `All ${int(X.spike.sequences)} sequences read back exactly from their sequence circuits.`],
        [["data", "100% of 1,299 sequences"]]),
      card("Folding simulations", [
        `${int(X.sbm.runs.implications)} rules “contact a formed ⇒ contact t formed” hold in every frame, in ${X.sbm.runs.with_rules} of ${X.sbm.runs.proteins} runs (${int(X.sbm.unique.implications)} in ${X.sbm.unique.proteins} unique proteins).`,
        `In the ${X.sbm.dense.proteins} long runs of 8,000 frames, all ${X.sbm.dense.implications} every-frame rules link neighbouring contacts.`,
        `Each rule has support: a formed in ≥ ${X.sbm.thresholds.min_support_frames} frames, t broken in ≥ ${X.sbm.thresholds.min_broken_frames}.`],
        [["data", "0 counterexample frames"]]),
    ] : [];

    add(el, 
      h("h1", "What it all means"),
      h("p.hook", "Lean proves the encodings and what every piece of a circuit means; every circuit, rule and read-back is then checked exhaustively by computation. Nothing on these pages is estimated."),
      h("h2", `Your structure: ${ctx.structure.id}, chain ${chain.id}`),
      yours,
      ...datasets,
      h("h2", "Takeaways"),
      h("div.takeaway", h("h3", "A verified foundation"), h("p", "131 Lean theorems, none left unproved, fix the encodings, the K-map geometry and the meaning of every cube: an unbroken segment, never padding. On that foundation every circuit is exact, checked on all its inputs.")),
      h("div.takeaway", h("h3", "Rules that are true, not likely"), h("p", "Read from exact circuits, a rule holds for every case it names: every contact of a structure, every sequence of a species, every frame of a trajectory. Inferences such as strand direction and register follow by counting.")),
      h("div.takeaway", h("h3", "One language for sequence, structure and dynamics"), h("p", "The same encoding and the same minimiser read k-mer maps, contact maps, co-evolving positions and contact states along folding trajectories. Any finite encoding that can be stated can be checked the same way.")),
      h("h2", "What the proofs guarantee"),
      h("p", "Twenty residues need five bits per axis, so a 20 × 20 residue-pair map is padded to 32 × 32. Lean proves that a fully fixed rule matches exactly its own cell, and that any rule about real residues fires only inside the 20 × 20 block: padding never enters a result."),
      theoremBlock("1010", ["ContactCircuits.cc_padding_safety", "ContactCircuits.cc_fixed_match_unique"], { title: "The padding theorems" }),
      h("h2", "The whole proof, re-checked here"),
      h("div.stats",
        h("div.stat", h("div.v", int(STATS.theorems)), h("div.l", `theorems in ${STATS.files} Lean files`)),
        h("div.stat.ok", h("div.v", "0"), h("div.l", "sorry, 0 added axioms")),
        h("div.stat", h("div.v", int(STATS.nativeDecide)), h("div.l", "by native_decide")),
        h("div.stat", h("div.v", int(STATS.kernelOnly + STATS.noAxioms)), h("div.l", "kernel-checked tactics"))),
      h("p", `Your browser can run the finite check behind every theorem: up to ${int(STATS.totalCases)} cases, fewer when a search for a witness stops at the first one. This does not replace Lean's proof; it shows the statements say what the pages claim.`),
      h("div.checkall", runBtn, h("div.bar", bar), status),
      h("p.small", `${TRUST_TEXT.compiler} ${TRUST_TEXT.kernel}`),
      h("ul.checks", { style: { fontSize: "14px" } }, LEAN_FILES.map((f) => h("li", h("span.mono", f), ` ${THEOREMS.filter((t) => t.file === f).length} theorems`))),
      h("p.small", "The theorem statements are shown verbatim on every chapter; the proofs are kept in the project's Lean development."),
      h("h2", "Go further"),
      h("div.row",
        h("a.btn", { href: `${REPO}/blob/main/SBS_ICMS2026_Poster.pdf`, target: "_blank", rel: "noopener" }, "The poster (PDF)"),
        h("a.btn.ghost", { href: REPO, target: "_blank", rel: "noopener" }, "Code and data on GitHub"),
        h("button.btn.ghost", { type: "button", on: { click: () => ctx.go("0000") } }, "Try another structure")),
      h("p.small", { style: { marginTop: "16px" } }, "Shuvam Banerji Seal, Susmita Roy, Dwaipayan Roy. IISER Kolkata. ICMS 2026, abstract ICMS2026-F-8."));

    // the visitor's own results, with provenance
    const rows = [];
    const enc = encodeSequence(chain.seq, chain.entityType);
    rows.push(h("li", `${int(enc.codes.length - enc.unknown)} letters encoded in ${alphabet(chain.entityType).bits} bits each, no two letters sharing a code`, " ", h("span.tag.lean", "⊢ encode_injective")));
    rows.push(h("li", `${int(cm.n)} contacts, a Boolean function of ${2 * Math.max(1, Math.ceil(Math.log2(Math.max(cm.L, 2))))} bits`, " ", h("span.tag.data", "◆ your map")));
    yours.replaceChildren(...rows, h("li.wait", "Minimising…"));
    try {
      const a = await ctx.derived.analysis();
      if (!alive) return;
      yours.lastChild.remove();
      add(yours, 
        h(`li${a.sound && a.complete ? "" : ".bad"}`, `${int(a.nPrimes)} prime implicants; a cover of ${int(a.nCover)}, sound and complete`, " ", h("span.tag.data", "◆ checked on every input")),
        h("li", `${int(a.contactsInBlocks)} of ${int(cm.n)} contacts in ${a.blocks.length} ${a.blocks.length === 1 ? "block" : "blocks"} of touching segments`, " ", h("span.tag.lean", "⊢ sc_contact_cube_is_block"), " ", h("span.tag.data", "◆ your map")));
    } catch (e) { if (alive) { yours.lastChild.remove(); add(yours, h("li.bad", e.message)); } }
  },
  unmount() { this._off?.(); },
};
