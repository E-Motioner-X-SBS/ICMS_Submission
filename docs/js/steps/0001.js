// 0001 Letters become bits: the chain's sequence, one codeword per letter.
import { h, theoremBlock, tags, nextStep, inkOn, css, sleep, reducedMotion, add, residueLabel } from "../ui.js";
import { encodeSequence, bits, GROUPS, AA_CODE, AA_NAMES, AA_GROUP, NUC_RAW, NUC_NAMES, letterVar } from "../core/encoding.js";
import { int } from "../core/format.js";

const colourOf = (l, type) => css(letterVar(l, type)) || "#7B8A99";

export default {
  mount(el, ctx) {
    const { chain } = ctx, type = chain.entityType, isProt = type === "protein";
    const seq = chain.seq;
    const enc = encodeSequence(seq, type), w = enc.bits;
    let sel = 0, timer = null, alive = true;
    this._stop = () => { alive = false; clearTimeout(timer); };

    // ── the code book ──
    const book = h("div.codebook");
    const cwButtons = new Map();
    const cw = (letter, code) => {
      const col = colourOf(letter, type);
      const b = h("button.cw", { type: "button", "aria-pressed": "false", "aria-label": `${letter}: code ${bits(code, w)}`, on: { click: () => pickLetter(letter) } },
        h("b", { style: { background: col, color: inkOn(col) } }, letter), bits(code, w));
      cwButtons.set(letter, b); return b;
    };
    if (isProt) for (const g of GROUPS) book.append(h("div.grp", h("span.gname", g.name), g.aa.map((a) => cw(a, AA_CODE[a]))));
    else book.append(h("div.grp", ["A", "C", "G", type === "rna" ? "U" : "T"].map((b) => cw(b, NUC_RAW[b]))));

    // ── the sequence and its bits ──
    const tiles = h("div.seq", { "data-noswipe": "" });
    enc.letters.forEach((l, i) => {
      const col = enc.codes[i] === null ? css("--ink-3") : colourOf(l, type);
      tiles.append(h("span", { style: { background: col, color: inkOn(col) }, title: `${i + 1}: ${l}`, on: { click: () => pick(i, true) } }, l));
    });
    const readout = h("div.readout", { "aria-live": "polite" });
    const bitbox = h("div.bitbox", { "aria-hidden": "true" });
    const stream = h("div.bitrow.small", { "data-noswipe": "" });

    function describe(l) {
      if (isProt) { const g = AA_GROUP[l]; return g ? `${AA_NAMES[l]}, ${g.name}` : "not one of the 20 standard amino acids"; }
      return NUC_NAMES[l] || "not a standard nucleotide";
    }
    function paintBits(code, prev) {
      bitbox.replaceChildren(...[...(code === null ? "?".repeat(w) : bits(code, w))].map((b, k) => {
        const flipped = prev !== null && code !== null && bits(prev, w)[k] !== b;
        return h(`span${b === "1" ? ".one" : ""}${flipped ? ".flip" : ""}`, b);
      }));
    }
    function paintStream(i) {
      // a window of codewords around the selected residue
      const lo = Math.max(0, i - 3), hi = Math.min(enc.codes.length, lo + 7);
      stream.replaceChildren(...enc.codes.slice(lo, hi).flatMap((c, k) => {
        const j = lo + k, s = c === null ? "?".repeat(w) : bits(c, w);
        return [h(j === i ? "b.bit-flip" : "span.bit-on", s), " "];
      }), h("span.bit-off", hi < enc.codes.length ? "…" : ""));
    }
    function pick(i, user) {
      if (user) { clearTimeout(timer); playing = false; playBtn.textContent = "Play"; }
      const prev = sel === i ? null : enc.codes[sel];
      tiles.children[sel]?.classList.remove("sel");
      sel = i; tiles.children[i].classList.add("sel");
      const l = enc.letters[i], c = enc.codes[i];
      readout.replaceChildren(h("span", `Residue ${residueLabel(chain, i).replace(/[A-Z]?(?=-?\d)/, "")} (position ${i}): `), h("b", l), ` (${describe(l)}) → `, h("span.mono", c === null ? "no code" : bits(c, w)));
      paintBits(c, prev); paintStream(i);
      cwButtons.forEach((b, k) => b.setAttribute("aria-pressed", String(k === l)));
      if (user && tiles.children[i].scrollIntoView) tiles.children[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    function pickLetter(l) {
      const i = enc.letters.indexOf(l, sel + 1) >= 0 ? enc.letters.indexOf(l, sel + 1) : enc.letters.indexOf(l);
      if (i >= 0) pick(i, true);
      else { cwButtons.forEach((b, k) => b.setAttribute("aria-pressed", String(k === l))); readout.replaceChildren(h("b", l), ` (${describe(l)}) → `, h("span.mono", bits(isProt ? AA_CODE[l] : NUC_RAW[l], w)), " does not occur in this chain."); }
    }
    let playing = false;
    const playBtn = h("button.btn.small", { type: "button", on: { click: () => { playing = !playing; playBtn.textContent = playing ? "Pause" : "Play"; if (playing) tick(); else clearTimeout(timer); } } }, "Play");
    let budget = Infinity;                                  // the opening autoplay stops after a dozen letters
    function tick() {
      if (!alive || !playing) return;
      if (budget-- <= 0) { playing = false; playBtn.textContent = "Play"; budget = Infinity; return; }
      pick((sel + 1) % enc.codes.length); timer = setTimeout(tick, 650);
    }

    const nBits = enc.codes.length * w;
    const counts = {}; for (const l of enc.letters) counts[l] = (counts[l] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l, n]) => `${l} ×${n}`).join(", ");

    add(el, 
      h("h1", "Letters become bits"),
      h("p.hook", isProt
        ? "Twenty amino acids need five bits each. The code numbers them group by group, then Gray-codes the number, so similar residues get nearby codewords."
        : `Four nucleotides need two bits each: A = 00, C = 01, G = 11, ${type === "rna" ? "U" : "T"} = 10. Each step A → C → G → ${type === "rna" ? "U" : "T"} → A flips a single bit.`),
      h("div.stats",
        h("div.stat", h("div.v", int(enc.codes.length)), h("div.l", `${isProt ? "residues" : "nucleotides"} in chain ${chain.id}`)),
        h("div.stat", h("div.v", `${w} bits`), h("div.l", `per ${isProt ? "residue" : "nucleotide"}`)),
        h("div.stat", h("div.v", int(nBits)), h("div.l", "bits for the whole chain")),
        h("div.stat", h("div.v", top), h("div.l", "most common letters"))),
      h("section.stage", { "aria-label": "Your sequence, tap a letter" },
        h("div.row", { style: { justifyContent: "space-between", marginBottom: "10px" } }, h("span.small", "Tap a letter, or play through the chain."), playBtn),
        h("div.scrollx", { style: { maxHeight: "180px", overflowY: "auto" } }, tiles),
        h("div", { style: { marginTop: "14px" } }, readout),
        h("div.row", { style: { marginTop: "10px" } }, bitbox, h("span.small", "orange: bits that changed from the previous residue")),
        h("div", { style: { marginTop: "10px" } }, stream)),
      h("h2", "The code book"),
      h("p", isProt
        ? "Residues are listed in chemical groups; the raw index runs 0 to 19 in this order and each codeword is gray(index). Residues next to each other in the list are one bit apart."
        : "Two bits give four codewords, one per nucleotide. The same labelling orders the axes of every K-map on the next pages."),
      book,
      enc.unknown || chain.notes?.length ? h("p.note", [
        enc.unknown ? `${enc.unknown} ${enc.unknown === 1 ? "residue has" : "residues have"} no standard letter and no code; they are shown grey and skipped by counts. ` : "",
        ...(chain.notes || []).map((n) => (n.one ? `${n.name} was read as ${n.one} (${n.count}×). ` : `${n.name} is not a standard residue and is left out (${n.count}×). `))].join("")) : null,
      tags([["lean", isProt ? "AminoAcidEncoding.encode_injective" : "KmapProofs.encode_injective"], ["data", `your chain: ${int(enc.codes.length - enc.unknown)} letters encoded, none shared by two letters`]]),
      h("p", "Injectivity is what makes the rest possible: no two letters share a codeword, so everything built from bits can be read back as sequence."),
      theoremBlock("0001", isProt ? ["AminoAcidEncoding.encode_injective", "AminoAcidEncoding.encode_in_range", "KmapEncodingEquiv.rawEncodingInjective"] : ["KmapProofs.encode_injective", "KmapProofs.gray_cycle_AC", "KmapProofs.encode_all_distinct"]),
      nextStep(ctx, "Why this particular order? Because a Gray code changes one bit at a time."));

    pick(0);
    if (!reducedMotion()) sleep(400).then(() => { if (alive) { playing = true; budget = 11; playBtn.textContent = "Pause"; tick(); } });
  },
  unmount() { this._stop?.(); },
};
