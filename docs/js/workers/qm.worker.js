// Web Worker: runs the exact Quine-McCluskey engine off the main thread and reports
// every merge round so the page can animate the minimisation.
import { analyseContacts, sequenceCircuit, shuffleWithinSeparation, rng } from "../core/qm.js";

self.onmessage = (e) => {
  const { id, type } = e.data;
  try {
    if (type === "contacts") {
      const t0 = performance.now();
      const result = analyseContacts(e.data.pairs, e.data.length, (round, nTerms, nPrimes) => self.postMessage({ id, type: "round", round, nTerms, nPrimes }));
      result.ms = performance.now() - t0;
      self.postMessage({ id, type: "done", result });
    } else if (type === "shuffles") {
      const r = rng(e.data.seed ?? 1), out = [];
      for (let k = 0; k < e.data.n; k++) {
        const a = analyseContacts(shuffleWithinSeparation(e.data.pairs, e.data.length, r), e.data.length);
        out.push({ fracInBlocks: a.fracInBlocks, fracContactsInBlocks: a.fracContactsInBlocks, contactsInBlocks: a.contactsInBlocks, nBlockCubes: a.nBlockCubes, compression: a.compression, nCover: a.nCover });
      }
      self.postMessage({ id, type: "done", result: out });
    } else if (type === "sequence") {
      const t0 = performance.now(); const result = sequenceCircuit(e.data.codes, e.data.w); result.ms = performance.now() - t0;
      self.postMessage({ id, type: "done", result });
    } else throw new Error(`unknown job ${type}`);
  } catch (err) { self.postMessage({ id, type: "error", message: err.message }); }
};
