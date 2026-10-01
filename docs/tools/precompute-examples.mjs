#!/usr/bin/env node
// Precompute the slow results for the five bundled examples, so their chapters open instantly:
// the parsed structure itself (the mmCIF is sent uncompressed and parsed on the phone; this JSON
// is a few kB gzipped and needs no parsing), the minimised contact circuit (with its merge
// rounds), the five seeded separation-preserving shuffles, and the sequence circuit, for every
// chain a visitor can pick.
//
//   node docs/tools/precompute-examples.mjs      → docs/data/examples/*.json + index.json
//
// Same engine as the Web Worker (js/core/qm.js). Each file records a fingerprint of the contact
// list and of the sequence codes it was computed from; the app uses a file only when the
// fingerprint matches what it has just parsed, and computes live otherwise.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCif, EXAMPLES } from "../js/core/rcsb.js";
import { chainOptions } from "../js/core/chains.js";
import { contactMap } from "../js/core/contacts.js";
import { analyseContacts, shuffleWithinSeparation, rng, sequenceCircuit } from "../js/core/qm.js";
import { encodeSequence } from "../js/core/encoding.js";
import { fingerprint } from "../js/core/cache.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.resolve(HERE, "..");
const OUT = path.join(DOCS, "data", "examples");
const MAX_QM_RESIDUES = 2048, SHUFFLES = 5, SEED = 20260905;    // as in js/app.js
fs.mkdirSync(OUT, { recursive: true });

const index = {};
for (const ex of EXAMPLES) {
  const s = parseCif(fs.readFileSync(path.join(DOCS, "examples", `${ex.id}.cif`), "utf8"), { id: ex.id });
  fs.writeFileSync(path.join(OUT, `${ex.id}.structure.json`), JSON.stringify(s));   // before anything below touches s
  for (const opt of chainOptions(s)) {
    const chain = opt.chain, uid = chain.uid;
    const cm = contactMap(chain);
    const out = { uid, length: cm.L, contacts: cm.n, contactsKey: fingerprint(cm.L, cm.pairs) };
    if (cm.L <= MAX_QM_RESIDUES) {
      const rounds = [];
      const t0 = performance.now();
      const a = analyseContacts(cm.pairs, cm.L, (round, nTerms, nPrimes) => rounds.push({ round, nTerms, nPrimes }));
      out.analysis = { ...a, ms: Math.round(performance.now() - t0), rounds };
      const r = rng(SEED);
      out.shuffles = Array.from({ length: SHUFFLES }, () => {
        const b = analyseContacts(shuffleWithinSeparation(cm.pairs, cm.L, r), cm.L);
        return { fracInBlocks: b.fracInBlocks, fracContactsInBlocks: b.fracContactsInBlocks, contactsInBlocks: b.contactsInBlocks, nBlockCubes: b.nBlockCubes, compression: b.compression, nCover: b.nCover };
      });
    }
    const enc = encodeSequence(chain.seq, chain.entityType);
    const codes = enc.codes.filter((c) => c !== null);
    if (codes.length) {
      const t0 = performance.now();
      const sc = sequenceCircuit(codes, enc.bits);
      out.sequence = { w: enc.bits, codesKey: fingerprint(codes.length, codes), result: { ...sc, ms: Math.round(performance.now() - t0) } };
    }
    const file = `${uid.replace(/[^A-Za-z0-9]+/g, "_")}.json`;
    fs.writeFileSync(path.join(OUT, file), JSON.stringify(out));
    index[uid] = file;
    console.log(`${uid.padEnd(10)} L=${cm.L} contacts=${cm.n}${out.analysis ? ` gates=${out.analysis.nCover}` : ""}${out.sequence ? ` seqGates=${out.sequence.result.nCover}` : ""} → ${file}`);
  }
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
console.log(`${Object.keys(index).length} chains → ${path.relative(DOCS, OUT)}/`);
