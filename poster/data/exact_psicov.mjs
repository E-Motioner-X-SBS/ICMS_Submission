// Exact circuits → rules → inferences for the 150 PSICOV proteins (contacts from
// prep_psicov_contacts.py). Every circuit is re-run on all 2^(2p) inputs; every rule is checked
// against every pair it names; the sequence circuit must read the sequence back exactly.
//   node poster/data/exact_psicov.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyseContacts, sequenceCircuit } from "../../docs/js/core/qm.js";
import { circuitTerms, verifyEverywhere, rulesFrom, checkRules, inferences } from "../../docs/js/core/rules.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IN = JSON.parse(fs.readFileSync(path.join(HERE, "psicov_contacts.json"), "utf8"));
const CAMPAIGN = "/store/shuvam/E-motioner-X-SBS/co-evolution-analysis/results/sequence_circuits/stage_contact.json";
const camp = JSON.parse(fs.readFileSync(CAMPAIGN, "utf8"));
const campRow = new Map((camp.per_target || []).map((r) => [r.target, r]));
const AA = "AVLIFYWMCPGSTNQDEHKR", gray = (n) => n ^ (n >>> 1);

const rows = [];
for (const t of IN.rows) {
  const L = t.length, pairs = t.contacts;
  const set = new Set(pairs.map(([i, j]) => i * L + j));
  const has = (i, j) => (i < j ? set.has(i * L + j) : set.has(j * L + i));
  const a = analyseContacts(pairs, L);
  const terms = circuitTerms(a.cover, a.p, L);
  const v = verifyEverywhere(terms, a.p, L, has);
  const rules = rulesFrom(terms, has), chk = checkRules(rules, pairs);
  const chain = { residues: [...t.sequence].map((one) => ({ one })), entityType: "protein" };
  const inf = inferences(rules, chain, has);
  const kinds = rules.reduce((m, r) => ((m[r.kind] = (m[r.kind] || 0) + 1), m), {});
  const inBlockRules = new Set(rules.filter((r) => r.kind === "block").flatMap((r) => r.cells.map((c) => c.join(",")))).size;
  const codes = [...t.sequence].map((c) => gray(AA.indexOf(c))).filter((c) => c >= 0);
  const sc = sequenceCircuit(codes, 5);
  const cr = campRow.get(t.target);
  rows.push({
    target: t.target, length: L, contacts: pairs.length, bits: 2 * a.p, inputs: v.inputs, oneCells: a.nOn, primes: a.nPrimes, gates: terms.length,
    essential: a.nEssential, literals: terms.reduce((n, x) => n + x.literals, 0),
    exact: v.exact && a.sound && a.complete && chk.sound && chk.complete, agree: v.agree,
    rules: rules.length, exceptions: chk.exceptions, missed: chk.missed, kinds,
    contactsInBlocks: a.contactsInBlocks, contactsInBlockRules: inBlockRules,
    pairs: inf.map((c) => ({ i0: c.i0, i1: c.i1, j0: c.j0, j1: c.j1, contacts: c.nPairs, rules: c.blocks.length, orientation: c.orientation, register: c.register, gap: c.gap, hairpin: c.hairpin })),
    sequence: { positions: codes.length, gates: sc.nCover, lossless: sc.lossless && sc.residueFree === 0 && sc.sound && sc.complete },
    campaign: cr ? { n_cover: cr.real?.n_cover, n_primes: cr.real?.n_primes, n_contacts: cr.real?.n_contacts, sound: cr.real?.sound, complete: cr.real?.complete } : null,
  });
}
const sum = (f) => rows.reduce((n, r) => n + (f(r) || 0), 0);
const allPairs = rows.flatMap((r) => r.pairs);
const totals = {
  proteins: rows.length, exact: rows.filter((r) => r.exact).length, residues: sum((r) => r.length), contacts: sum((r) => r.contacts),
  inputs: sum((r) => r.inputs), oneCells: sum((r) => r.oneCells), primes: sum((r) => r.primes), gates: sum((r) => r.gates), essential: sum((r) => r.essential),
  literals: sum((r) => r.literals), rules: sum((r) => r.rules), exceptions: sum((r) => r.exceptions), missed: sum((r) => r.missed),
  ruleKinds: ["block", "pair", "strided", "single"].reduce((m, k) => ((m[k] = sum((r) => r.kinds[k])), m), {}),
  contactsInBlocks: sum((r) => r.contactsInBlocks), contactsInBlockRules: sum((r) => r.contactsInBlockRules),
  proteinsWithBlocks: rows.filter((r) => r.contactsInBlocks > 0).length,
  strandPairs: allPairs.length, antiparallel: allPairs.filter((q) => q.orientation === "antiparallel").length,
  parallel: allPairs.filter((q) => q.orientation === "parallel").length, short: allPairs.filter((q) => q.orientation === "short").length,
  mixed: allPairs.filter((q) => q.orientation === "mixed").length, hairpins: allPairs.filter((q) => q.hairpin).length,
  proteinsWithAntiparallel: rows.filter((r) => r.pairs.some((q) => q.orientation === "antiparallel")).length,
  sequencesLossless: rows.filter((r) => r.sequence.lossless).length,
  campaignMatch: { primes: rows.filter((r) => r.campaign && r.campaign.n_primes === r.primes).length, gates: rows.filter((r) => r.campaign && r.campaign.n_cover === r.gates).length, contacts: rows.filter((r) => r.campaign && r.campaign.n_contacts === r.contacts).length },
};
fs.writeFileSync(path.join(HERE, "psicov_exact.json"), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), definition: IN.definition, engine: "docs/js/core", totals, rows }));
console.log(JSON.stringify(totals, null, 1));
