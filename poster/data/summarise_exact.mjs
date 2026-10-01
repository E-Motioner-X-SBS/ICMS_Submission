// One summary of every exact dataset result, read by the poster and by the demo site.
//   node poster/data/summarise_exact.mjs   →  poster/data/exact_summary.json, docs/data/exact_summary.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), "utf8"));
const gvl = J("gray_vs_lex.json");
const ps = J("psicov_exact.json").totals, ds = J("exact_dataset.json"), sp = J("spike_rules.json"), sb = J("sbm_exact.json");
const f1 = J("psicov_exact.json").rows.find((r) => r.target === "1fnaA");
const showSpike = sp.pairs.find((p) => p.wuhan[0] === 371 && p.wuhan[1] === 376);
const s = {
  psicov: { proteins: ps.proteins, exact: ps.exact, residues: ps.residues, contacts: ps.contacts, inputs: ps.inputs, gates: ps.gates, primes: ps.primes,
    rules: ps.rules, exceptions: ps.exceptions, missed: ps.missed, ruleKinds: ps.ruleKinds, contactsInBlocks: ps.contactsInBlocks, proteinsWithBlocks: ps.proteinsWithBlocks,
    strandPairs: ps.strandPairs, antiparallel: ps.antiparallel, parallel: ps.parallel, hairpins: ps.hairpins, proteinsWithAntiparallel: ps.proteinsWithAntiparallel,
    sequencesLossless: ps.sequencesLossless, campaignMatch: ps.campaignMatch },
  fna: { contacts: f1.contacts, gates: f1.gates, rules: f1.rules, inputs: f1.inputs, contactsInBlocks: f1.contactsInBlocks, pairs: f1.pairs },
  curated: { chains: ds.analysed, exact: ds.analysed && ds.allExact ? ds.analysed : 0, byType: Object.fromEntries(Object.entries(ds.byType).map(([k, v]) => [k, { structures: v.structures, contacts: v.contacts, rules: v.rules, exceptions: v.exceptions, inputs: v.inputs, basePairs: v.basePairs, antiparallel: v.antiparallel, parallel: v.parallel, hairpins: v.hairpins }])),
    totals: ds.totals, skipped: ds.skipped.length },
  spike: { sequences: sp.n_sequences, unique: sp.n_unique, pairs: sp.totals.pairs, allowed: sp.totals.allowed, forbidden: sp.totals.forbidden, implications: sp.totals.implications,
    violations: sp.totals.violations, uniqueMinimum: sp.totals.all_unique_minimum, lossless: sp.sequence_circuits.all_lossless,
    showcase: { at: showSpike.wuhan, ref: showSpike.wuhan_ref, n: showSpike.n_sequences, allowed: showSpike.allowed, forbidden: showSpike.forbidden, implications: showSpike.implications },
    pairsTable: sp.pairs.map((p) => ({ at: p.wuhan, cols: p.columns.map((c) => c + 1), n: p.n_sequences, allowed: p.allowed.map((a) => a.pair), forbidden: p.forbidden, implications: p.implications.map((i) => ({ if: i.if, at: i.at, then: i.then, support: i.support })) })) },
  grayVsLex: { maps: gvl.n_sequences, copheneticGray: gvl.part_a_invariance.cophenetic_gray, copheneticLex: gvl.part_a_invariance.cophenetic_lex, sortedValuesIdentical: gvl.part_a_invariance.sorted_cell_values_identical },
  sbm: { runs: sb.all_runs, unique: sb.unique_ids, dense: sb.dense.totals, thresholds: sb.thresholds, definition: sb.definition,
    denseExamples: sb.dense.rows.filter((r) => r.example).map((r) => ({ target: r.target, frames: r.frames, rules: r.implications, neighbour: r.neighbour_implications, example: r.example })) },
};
// one compact row per PSICOV protein for the site's table (PDB id + chain from the PSICOV name)
const table = J("psicov_exact.json").rows.map((r) => ({
  t: r.target, pdb: r.target.slice(0, 4).toUpperCase(), chain: r.target.slice(4) || "A", L: r.length, c: r.contacts, g: r.gates, r: r.rules,
  b: r.contactsInBlocks, a: r.pairs.filter((q) => q.orientation === "antiparallel").length, p: r.pairs.filter((q) => q.orientation === "parallel").length,
  h: r.pairs.filter((q) => q.hairpin).length, x: r.exact && r.exceptions === 0 && r.missed === 0, s: r.sequence.lossless,
}));
fs.writeFileSync(path.join(HERE, "../../docs/data/psicov_table.json"), JSON.stringify(table));
for (const out of [path.join(HERE, "exact_summary.json"), path.join(HERE, "../../docs/data/exact_summary.json")]) {
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(s, null, 1));
}
console.log(JSON.stringify({ psicov: [s.psicov.exact, s.psicov.rules, s.psicov.exceptions], curated: s.curated.chains, spike: [s.spike.allowed, s.spike.forbidden, s.spike.violations], sbm: [s.sbm.runs.implications, s.sbm.dense.implications] }));
