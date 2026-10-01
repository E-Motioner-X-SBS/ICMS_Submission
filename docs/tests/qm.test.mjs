// node tests/qm.test.mjs  — the JS engine must reproduce the campaign numbers for 1fnaA
import fs from "node:fs";
import { analyseContacts, sequenceCircuit, primeImplicants, minimalCover, shuffleWithinSeparation, rng } from "../js/core/qm.js";
const here = new URL(".", import.meta.url).pathname;
const d = JSON.parse(fs.readFileSync(here + "../../poster/data/contact_1fnaA.json"));
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fail++; };
const t0 = performance.now();
const r = analyseContacts(d.contacts, d.length);
ok(r.nOn === 402, `n_on ${r.nOn} (402)`);
ok(r.nPrimes === 278, `primes ${r.nPrimes} (278)`);
ok(r.nCover === 216, `cover ${r.nCover} (216)`);
ok(r.complete && r.sound, `complete ${r.complete}, sound ${r.sound}`);
const key = (b) => `${b.i0},${b.i1},${b.j0},${b.j1}`;
const want = new Set(d.blocks.map(key)), got = new Set(r.blocks.map(key));
ok(want.size === got.size && [...want].every((k) => got.has(k)), `16 upper-triangle blocks identical (${got.size})`);
ok(Math.abs(r.fracInBlocks - 0.31840796019900497) < 1e-12, `fraction in blocks ${r.fracInBlocks}`);
console.log(`  1fnaA analysis ${(performance.now() - t0).toFixed(0)} ms`);
// shuffled control: block fraction should collapse
const sh = analyseContacts(shuffleWithinSeparation(d.contacts, d.length, rng(20260905)), d.length);
ok(sh.fracInBlocks < 0.05, `shuffled block fraction ${sh.fracInBlocks.toFixed(4)} (campaign mean 0.0 for 1fnaA)`);
// sequence circuit: lossless, no free residue bit
const AA = "AVLIFYWMCPGSTNQDEHKR", g = (n) => n ^ (n >> 1);
const codes = [...d.sequence].map((c) => g(AA.indexOf(c)));
const sc = sequenceCircuit(codes, 5);
ok(sc.lossless && sc.residueFree === 0 && sc.complete && sc.sound, `sequence circuit: lossless ${sc.lossless}, residue-free cubes ${sc.residueFree}, cover ${sc.nCover}`);
// worked QM example from the poster
const P = primeImplicants([5, 7, 8, 9, 13, 15], [], 4);
ok(P.length === 3 && minimalCover(P, [5, 7, 8, 9, 13, 15]).cover.length === 2, "worked example: 3 primes, cover of 2");
console.log(fail ? `${fail} failed` : "all passed"); process.exit(fail ? 1 : 0);
