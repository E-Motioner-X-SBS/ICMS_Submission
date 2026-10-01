// node tests/rules.test.mjs — circuit → rules → inferences on 1fnaA (protein) and 1BNA (DNA duplex)
import fs from "node:fs";
import { analyseContacts } from "../js/core/qm.js";
import { circuitTerms, verifyEverywhere, rulesFrom, checkRules, inferences, toPLA, toVerilog, evaluate } from "../js/core/rules.js";
import { parseCif } from "../js/core/rcsb.js";
import { contactMap } from "../js/core/contacts.js";
const here = new URL(".", import.meta.url).pathname;
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fail++; };

function run(label, chain) {
  const cm = contactMap(chain);
  const a = analyseContacts(cm.pairs, cm.L);
  const terms = circuitTerms(a.cover, a.p, cm.L);
  const v = verifyEverywhere(terms, a.p, cm.L, cm.has);
  ok(v.exact, `${label}: circuit agrees with the contact map on ${v.agree}/${v.inputs} inputs`);
  const rules = rulesFrom(terms, cm.has);
  const chk = checkRules(rules, cm.pairs);
  ok(chk.complete && chk.sound, `${label}: ${rules.length} rules, complete ${chk.complete}, sound ${chk.sound}`);
  const kinds = rules.reduce((m, r) => ((m[r.kind] = (m[r.kind] || 0) + 1), m), {});
  console.log(`   kinds ${JSON.stringify(kinds)}; terms ${terms.length}; literals ${terms.reduce((n, t) => n + t.literals, 0)}`);
  const inf = inferences(rules, chain, cm.has);
  for (const c of inf) console.log(`   pair ${c.i0}-${c.i1 - 1} x ${c.j0}-${c.j1 - 1}: ${c.orientation} (r=${c.r.toFixed(2)}) ${c.register ? `${c.register.kind} in [${c.register.lo}, ${c.register.hi}]` : ""} gap ${c.gap}${c.basePairs ? ` bp ${c.watsonCrick}/${c.basePairs.length} WC ${c.basePairs.map((q) => q[2]).join(" ")}` : ""}`);
  ok(toPLA(terms, a.p).split("\n").filter((l) => /^[01-]+ 1$/.test(l)).length === terms.length, `${label}: PLA has ${terms.length} rows`);
  ok(/assign C = /.test(toVerilog(terms, a.p)), `${label}: Verilog emitted`);
  const [i, j] = cm.pairs[0]; ok(evaluate(terms, a.p, i, j).out && evaluate(terms, a.p, j, i).out, `${label}: evaluate(${i}, ${j}) fires both orders`);
  return { rules, inf };
}
const s1 = parseCif(fs.readFileSync(here + "../examples/1FNA.cif", "utf8"), { id: "1FNA" });
run("1FNA/A", s1.chains.find((c) => c.id === "A"));
const s2 = parseCif(fs.readFileSync(here + "../examples/1BNA.cif", "utf8"), { id: "1BNA" });
const cs = s2.chains.filter((c) => c.entityType === "dna");
const merged = { ...cs[0], id: "A+B", residues: cs.flatMap((c) => c.residues), strands: cs.map((c) => ({ id: c.id, length: c.length })) };
merged.length = merged.residues.length;
run("1BNA/A+B", merged);
const s3 = parseCif(fs.readFileSync(here + "../examples/1EHZ.cif", "utf8"), { id: "1EHZ" });
run("1EHZ/A", s3.chains.find((c) => c.id === "A"));
console.log(fail ? `${fail} failed` : "all passed"); process.exit(fail ? 1 : 0);
