// Exact results over a whole dataset: every structure → contact function → minimised circuit →
// rules → inferences, each checked exhaustively. Uses the same engine as the demo site
// (docs/js/core), which reproduces the campaign's Python numbers (docs/tests/qm.test.mjs).
//
//   node poster/data/exact_dataset.mjs [outfile]
//
// Input: datasets/is-kmap-possible/{protein,protein_extra,dna,dna_extra,rna,rna_extra}/*/*.cif
// (unique PDB IDs; a structure listed twice is counted once). Output: JSON with one row per
// structure and dataset totals. Nothing here is sampled or fitted; every number is a count.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCif } from "../../docs/js/core/rcsb.js";
import { contactMap } from "../../docs/js/core/contacts.js";
import { analyseContacts, sequenceCircuit } from "../../docs/js/core/qm.js";
import { circuitTerms, verifyEverywhere, rulesFrom, checkRules, inferences, basePairs } from "../../docs/js/core/rules.js";
import { encodeSequence } from "../../docs/js/core/encoding.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = "/store/shuvam/E-motioner-X-SBS/datasets/is-kmap-possible";
const SETS = ["protein", "protein_extra", "dna", "dna_extra", "rna", "rna_extra"];
const OUT = process.argv[2] || path.join(HERE, "exact_dataset.json");
const MAX_L = 1024;                                    // positions need at most 10 bits

function chainFor(s) {
  // proteins: the first protein chain with ≥ 20 residues (else the longest protein chain);
  // nucleic acids: all strands of the majority NA type together when there are 2–4, else the longest
  const prot = s.chains.filter((c) => c.entityType === "protein");
  const na = s.chains.filter((c) => c.entityType === "dna" || c.entityType === "rna");
  const naLen = na.reduce((n, c) => n + c.length, 0), protLen = prot.reduce((n, c) => n + c.length, 0);
  return { prot, na, naLen, protLen };
}
function naChain(na) {
  const type = na.filter((c) => c.entityType === "dna").length >= na.filter((c) => c.entityType === "rna").length ? "dna" : "rna";
  const cs = na.filter((c) => c.entityType === type);
  if (cs.length >= 2 && cs.length <= 4) {
    const residues = cs.flatMap((c) => c.residues);
    return { ...cs[0], id: cs.map((c) => c.id).join("+"), residues, seq: cs.map((c) => c.seq).join(""), length: residues.length, strands: cs.map((c) => ({ id: c.id, length: c.residues.length })) };
  }
  return [...cs].sort((a, b) => b.length - a.length)[0];
}

function analyse(id, set, chain, organism) {
  const t0 = performance.now();
  const cm = contactMap(chain);
  const row = { id, set, chain: chain.id, type: chain.entityType, length: cm.L, contacts: cm.n, organism };
  if (cm.L > MAX_L) return { ...row, skipped: `length ${cm.L} > ${MAX_L}` };
  if (cm.n === 0) return { ...row, skipped: "no contacts" };
  const a = analyseContacts(cm.pairs, cm.L);
  const terms = circuitTerms(a.cover, a.p, cm.L);
  const v = verifyEverywhere(terms, a.p, cm.L, cm.has);
  const rules = rulesFrom(terms, cm.has), chk = checkRules(rules, cm.pairs);
  const inf = inferences(rules, chain, cm.has);
  const kinds = rules.reduce((m, r) => ((m[r.kind] = (m[r.kind] || 0) + 1), m), {});
  const inBlock = new Set(rules.filter((r) => r.kind === "block").flatMap((r) => r.cells.map((c) => c.join(","))));
  const enc = encodeSequence(chain.seq, chain.entityType);
  const codes = enc.codes.filter((c) => c !== null);
  const sc = codes.length ? sequenceCircuit(codes, enc.bits) : null;
  const out = {
    ...row, bits: 2 * a.p, inputs: v.inputs, oneCells: a.nOn, primes: a.nPrimes, gates: terms.length,
    literals: terms.reduce((n, t) => n + t.literals, 0),
    sound: a.sound, complete: a.complete, exactEverywhere: v.exact, agree: v.agree,
    rules: rules.length, rulesSound: chk.sound, rulesComplete: chk.complete, exceptions: chk.exceptions, missed: chk.missed,
    kinds, contactsInBlockRules: inBlock.size,
    pairs: inf.map((c) => ({ i0: c.i0, i1: c.i1, j0: c.j0, j1: c.j1, contacts: c.nPairs, rules: c.blocks.length, orientation: c.orientation, register: c.register, gap: c.gap, hairpin: c.hairpin })),
    sequence: sc ? { positions: codes.length, gates: sc.nCover, lossless: sc.lossless, residueFree: sc.residueFree, sound: sc.sound, complete: sc.complete } : null,
  };
  if (chain.entityType !== "protein") {
    const bp = basePairs(chain);
    out.basePairs = { n: bp.pairs.length, watsonCrick: bp.pairs.filter((q) => q.wc).length, stems: bp.stems.filter((st) => st.length >= 2).map((st) => st.length) };
  }
  out.ms = Math.round(performance.now() - t0);
  return out;
}

const seen = new Set(), rows = [];
for (const set of SETS) {
  const dir = path.join(DATA, set);
  if (!fs.existsSync(dir)) continue;
  for (const sub of fs.readdirSync(dir).sort()) {
    const d = path.join(dir, sub);
    if (!fs.statSync(d).isDirectory()) continue;
    const cif = fs.readdirSync(d).find((f) => f.toLowerCase().endsWith(".cif"));
    if (!cif) continue;
    const id = cif.replace(/\.cif$/i, "").toUpperCase();
    let s;
    try { s = parseCif(fs.readFileSync(path.join(d, cif), "utf8"), { id }); }
    catch (e) { rows.push({ id, set, skipped: `parse: ${e.message}` }); continue; }
    const { prot, na } = chainFor(s);
    const targets = [];
    // every polymer type in the entry: its protein chain and its nucleic-acid strand(s)
    const pc = prot.find((x) => x.length >= 20) || [...prot].sort((a, b) => b.length - a.length)[0];
    if (pc) targets.push(pc);
    if (na.length) targets.push(naChain(na));
    for (const c of targets) {
      const key = `${id}/${c.entityType}`;
      if (seen.has(key)) continue;                      // listed in two sets: count once
      seen.add(key);
      const org = c.organism || s.meta.organisms?.[0] || null;
      try { rows.push(analyse(id, set, c, org)); process.stdout.write(`${id} `); }
      catch (e) { rows.push({ id, set, type: c.entityType, skipped: `error: ${e.message}` }); }
    }
  }
}
const done = rows.filter((r) => !r.skipped);
const sum = (f, rs = done) => rs.reduce((n, r) => n + (f(r) || 0), 0);
const byType = Object.fromEntries(["protein", "dna", "rna"].map((t) => {
  const rs = done.filter((r) => r.type === t);
  const pairs = rs.flatMap((r) => r.pairs);
  return [t, {
    structures: rs.length, exact: rs.filter((r) => r.exactEverywhere && r.rulesSound && r.rulesComplete).length,
    contacts: sum((r) => r.contacts, rs), oneCells: sum((r) => r.oneCells, rs), inputs: sum((r) => r.inputs, rs), gates: sum((r) => r.gates, rs), rules: sum((r) => r.rules, rs),
    exceptions: sum((r) => r.exceptions, rs), missed: sum((r) => r.missed, rs),
    contactsInBlockRules: sum((r) => r.contactsInBlockRules, rs),
    strandPairs: pairs.length, antiparallel: pairs.filter((q) => q.orientation === "antiparallel").length, parallel: pairs.filter((q) => q.orientation === "parallel").length,
    hairpins: pairs.filter((q) => q.hairpin).length,
    sequencesLossless: rs.filter((r) => r.sequence?.lossless && r.sequence.residueFree === 0).length,
    basePairs: t === "protein" ? null : { n: sum((r) => r.basePairs?.n, rs), watsonCrick: sum((r) => r.basePairs?.watsonCrick, rs) },
  }];
}));
const result = {
  generated: new Date().toISOString().slice(0, 10), source: DATA, engine: "docs/js/core (qm.js, rules.js)",
  contactDefinition: { protein: "C-beta (C-alpha for Gly) < 8 Å, |i−j| ≥ 6", na: "C1′ (P if missing) < 10 Å, |i−j| ≥ 3" },
  structures: rows.length, analysed: done.length, skipped: rows.filter((r) => r.skipped).map((r) => ({ id: r.id, set: r.set, why: r.skipped })),
  allExact: done.every((r) => r.exactEverywhere && r.rulesSound && r.rulesComplete && r.sound && r.complete),
  totals: { contacts: sum((r) => r.contacts), inputs: sum((r) => r.inputs), gates: sum((r) => r.gates), rules: sum((r) => r.rules), exceptions: sum((r) => r.exceptions), missed: sum((r) => r.missed) },
  byType, rows,
};
fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(`\n${done.length}/${rows.length} analysed; all exact: ${result.allExact}`);
console.log(JSON.stringify(byType, null, 1));
