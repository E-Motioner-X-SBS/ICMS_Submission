// 1111 Read the sequence back: the sequence as a Boolean function, minimised, decoded.
import { h, theoremBlock, tags, nextStep, css, inkOn, sleep, reducedMotion, add, failBox } from "../ui.js";
import { encodeSequence, bits, alphabet, letterVar } from "../core/encoding.js";
import { int, num } from "../core/format.js";

const popcount = (x) => { let c = 0; x >>>= 0; while (x) { x &= x - 1; c++; } return c; };

export default {
  async mount(el, ctx) {
    const { chain } = ctx, type = chain.entityType, A = alphabet(type);
    const enc = encodeSequence(chain.seq, type);
    const known = enc.codes.map((c, i) => [c, i]).filter(([c]) => c !== null);
    const codes = known.map(([c]) => c), letters = known.map(([, i]) => enc.letters[i]);
    const w = A.bits;
    let alive = true;
    this._off = () => { alive = false; };

    const status = h("div.loading", h("span.spinner"), "Minimising the sequence circuit…");
    const body = h("div");
    add(el, 
      h("h1", "Read the sequence back"),
      h("p.hook", `Now the sequence itself becomes a Boolean function: f(i, a) = 1 when position i holds the letter whose code is a. One 1-cell per position: ${int(codes.length)} in all.`),
      h("p", "Minimise it exactly as the contact map. Cubes may merge positions that hold the same letter, but a cube that freed a letter bit would name two letters at once. Lean proves that can never happen, so the minimised circuit is a lossless description of the sequence."),
      enc.unknown ? h("p.note", `${enc.unknown} ${enc.unknown === 1 ? "position has" : "positions have"} no standard letter and ${enc.unknown === 1 ? "is" : "are"} left out here.`) : null,
      status, body);

    let r;
    try { r = await ctx.derived.sequenceCircuit(codes, w); }
    catch (e) { status.replaceChildren(failBox(e)); return; }
    if (!alive) return;
    el.querySelector(".hook").textContent = `Now the sequence itself becomes a Boolean function: f(i, a) = 1 when position i holds the letter whose code is a. That is ${int(codes.length)} 1-cells over ${r.p} position bits plus ${w} letter bits.`;
    status.remove();

    // the largest cubes: which positions they merge, and the single letter they name
    const posMask = (pi) => pi.mask >>> w, posVal = (pi) => pi.val >>> w, codeOf = (pi) => pi.val & ((1 << w) - 1);
    const covered = (pi) => { const out = []; for (let i = 0; i < codes.length; i++) if (((i & ~posMask(pi)) >>> 0) === posVal(pi)) out.push(i); return out; };
    const pattern = (pi) => [...bits(posVal(pi), r.p)].map((b, k) => ((posMask(pi) >> (r.p - 1 - k)) & 1 ? "–" : b)).join("");
    const biggest = [...r.cover].sort((a, b) => popcount(b.mask) - popcount(a.mask) || a.val - b.val).slice(0, 4);

    const tile = (l) => { const col = css(letterVar(l, type)) || "#7B8A99"; return h("span", { style: { background: col, color: inkOn(col) } }, l); };
    const orig = h("div.seq", { "aria-label": "Original sequence" }, letters.map(tile));
    const back = h("div.seq", { "aria-label": "Sequence decoded from the circuit" });
    const verdict = h("div.readout", { "aria-live": "polite" });

    add(body, 
      h("div.stats",
        h("div.stat", h("div.v", int(r.nOn)), h("div.l", "1-cells, one per position")),
        h("div.stat", h("div.v", int(r.nPrimes)), h("div.l", "prime implicants")),
        h("div.stat", h("div.v", int(r.nCover)), h("div.l", `cubes in the cover (${num(r.nOn / r.nCover, 2)}× shorter)`)),
        h("div.stat.ok", h("div.v", int(r.residueFree)), h("div.l", "cubes that free a letter bit"))),
      h("h2", "Decoding the circuit"),
      h("p", "For every position, ask the minimised circuit which letters it accepts. Each position must get exactly one, and it must be the original."),
      h("section.stage", { "aria-label": "Original and decoded sequences" },
        h("div.cap", h("b", "Original")), h("div.scrollx", { style: { maxHeight: "150px", overflowY: "auto" } }, orig),
        h("div.cap", h("b", "Read back from the circuit")), h("div.scrollx", { style: { maxHeight: "150px", overflowY: "auto" } }, back),
        h("div", { style: { marginTop: "10px" } }, verdict)),
      h("h2", "What the cubes merge"),
      h("p", "A cube's free bits (–) sit only in the position field. Here are the largest cubes of this cover: each names one letter at several positions."),
      h("div", biggest.map((pi) => {
        const pos = covered(pi), l = A.letterOf(codeOf(pi));
        return h("div.eq", { style: { whiteSpace: "pre", marginBottom: "8px" } },
          `i = ${pattern(pi)}   a = ${bits(codeOf(pi), w)} (${l})\n→ ${l} at position${pos.length > 1 ? "s" : ""} ${pos.slice(0, 10).join(", ")}${pos.length > 10 ? ", …" : ""}`);
      })),
      h("ul.checks",
        h(`li${r.sound && r.complete ? "" : ".bad"}`, "The cover is sound and complete, checked as in chapter 0101."),
        h(`li${r.residueFree === 0 ? "" : ".bad"}`, `No cube frees a letter bit: 0 of ${int(r.nCover)}.`),
        h(`li${r.lossless ? "" : ".bad"}`, `Every one of the ${int(codes.length)} positions decodes to its original letter.`)),
      tags([["lean", "sc_residue_field_fixed"], ["lean", "sc_no_cross_residue_merge"], ["lean", "sc_cell_injective"], ["data", `your chain: ${int(codes.length)} positions read back`]]),
      h("p", "This is why the encoding can be trusted as a representation: whatever minimisation does to a sequence, the proofs guarantee nothing about which letter sits where is lost."),
      theoremBlock("1111", ["SequenceCircuits.sc_residue_field_fixed", "SequenceCircuits.sc_no_cross_residue_merge", "SequenceCircuits.sc_cell_injective"]),
      nextStep(ctx, "Gray code or plain binary: what does the choice of code actually change?"));

    // animate the read-back
    const chunk = Math.max(1, Math.ceil(codes.length / 60));
    for (let i = 0; i < codes.length; i += chunk) {
      if (!alive) return;
      for (let k = i; k < Math.min(codes.length, i + chunk); k++) {
        const a = r.back[k], l = a === null ? "?" : A.letterOf(a);
        const t = tile(l); if (a !== codes[k]) { t.style.outline = "3px solid var(--bad)"; }
        back.append(t);
      }
      verdict.textContent = `${int(Math.min(codes.length, i + chunk))} of ${int(codes.length)} positions decoded…`;
      if (!reducedMotion()) await sleep(28);
    }
    const bad = r.back.filter((a, i) => a !== codes[i]).length;
    verdict.replaceChildren(bad ? h("span", { style: { color: "var(--bad)" } }, `${bad} positions differ.`)
      : h("span", h("b", { style: { color: "var(--ok)" } }, "✓ Identical. "), `${int(codes.length)} of ${int(codes.length)} letters, from ${int(r.nCover)} cubes.`));
  },
  unmount() { this._off?.(); },
};
