// 0011 A code that changes one bit at a time: binary counting vs the reflected Gray code.
import { h, theoremBlock, tags, nextStep, css, reducedMotion, add } from "../ui.js";
import { gray, bits, ham } from "../core/encoding.js";
import { posBits } from "../core/qm.js";
import { int } from "../core/format.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) e.append(k); return e; };

/** Bit planes of 0..2^w−1 as columns: filled = 1, orange = the bits that flipped on the way in. */
function planes(w, code, sel) {
  const N = 1 << w, cw = 17, ch = 17, lx = 58, W = lx + N * cw + 2, H = w * ch + 22;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img" });
  for (let b = w - 1, r = 0; b >= 0; b--, r++) {
    svg.append(s("text", { x: lx - 6, y: r * ch + ch * 0.7, "text-anchor": "end", style: "font:500 11px var(--mono);fill:var(--ink-3)" }, `bit ${b}`));
    for (let n = 0; n < N; n++) {
      const v = code(n), p = n ? code(n - 1) : code(N - 1), on = (v >> b) & 1, flip = ((v ^ p) >> b) & 1;
      svg.append(s("rect", { x: lx + n * cw + 1, y: r * ch + 1, width: cw - 2, height: ch - 2, rx: 3,
        style: `fill:${flip ? "var(--flip)" : on ? "var(--ink)" : "var(--wash-2)"};opacity:${n === sel || sel < 0 ? 1 : 0.8}` }));
    }
  }
  for (let n = 0; n < N; n += w > 4 ? 4 : 1) svg.append(s("text", { x: lx + (n + 0.5) * cw, y: H - 4, "text-anchor": "middle", style: "font:500 10px var(--sans);fill:var(--ink-3)" }, String(n)));
  if (sel >= 0) svg.append(s("rect", { x: lx + sel * cw, y: 0, width: cw, height: w * ch, rx: 4, style: "fill:none;stroke:var(--teal);stroke-width:2" }));
  return svg;
}

export default {
  mount(el, ctx) {
    let w = 4, n = 7, timer = null, alive = true;
    this._stop = () => { alive = false; clearTimeout(timer); };
    const bin = h("div.bitbox"), gry = h("div.bitbox"), xor = h("div.eq", { style: { whiteSpace: "pre" } });
    const readout = h("div.readout", { "aria-live": "polite" });
    const figBin = h("div"), figGray = h("div");
    const slider = h("input", { type: "range", min: 0, max: 15, value: n, "aria-label": "The number n" });
    const box = (el2, v, prev) => el2.replaceChildren(...[...bits(v, w)].map((b, k) => h(`span${b === "1" ? ".one" : ""}${bits(prev, w)[k] !== b ? ".flip" : ""}`, b)));
    function paint() {
      const N = 1 << w, prev = (n - 1 + N) % N;
      box(bin, n, prev); box(gry, gray(n), gray(prev));
      const fb = ham(n, prev), fg = ham(gray(n), gray(prev));
      readout.replaceChildren(`${prev} → ${n}: binary flips `, h("b", `${fb} ${fb === 1 ? "bit" : "bits"}`), ", Gray flips ", h("b", { style: { color: "var(--flip)" } }, `${fg} bit`), n === 0 ? ` (the code wraps round: ${bits(gray(prev), w)} → ${bits(gray(0), w)})` : "");
      xor.textContent = `n       = ${bits(n, w)}   (${n})\nn >> 1  = ${bits(n >> 1, w)}   shift right\ng(n)    = ${bits(gray(n), w)}   XOR of the two`;
      figBin.replaceChildren(planes(w, (x) => x, n)); figGray.replaceChildren(planes(w, gray, n));
      slider.value = n;
    }
    slider.addEventListener("input", () => { stop(); n = +slider.value; paint(); });
    const step = (d) => { stop(); n = (n + d + (1 << w)) % (1 << w); paint(); };
    const playBtn = h("button.btn.small", { type: "button", on: { click: () => (timer ? stop() : play()) } }, "Count");
    function play() { playBtn.textContent = "Pause"; const t = () => { if (!alive) return; n = (n + 1) % (1 << w); paint(); timer = setTimeout(t, 700); }; timer = setTimeout(t, 200); }
    function stop() { clearTimeout(timer); timer = null; playBtn.textContent = "Count"; }
    const widthSeg = h("div.seg", { role: "group", "aria-label": "Number of bits" }, [4, 5, 6].map((k) => h("button", { type: "button", "aria-pressed": String(k === w), on: { click: (e) => {
      w = k; n = Math.min(n, (1 << w) - 1); slider.max = (1 << w) - 1;
      [...widthSeg.children].forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); paint(); } } }, `${k} bits`)));

    // the visitor's chain: every position step, binary vs Gray
    const L = ctx.chain.length, p = posBits(L);
    let worstBin = 0, worstAt = 0, grayOK = true;
    for (let i = 1; i < L; i++) { const d = ham(i, i - 1); if (d > worstBin) { worstBin = d; worstAt = i; } if (ham(gray(i), gray(i - 1)) !== 1) grayOK = false; }
    const T = ctx.chain.entityType === "rna" ? "U" : "T";

    add(el, 
      h("h1", "A code that changes one bit at a time"),
      h("p.hook", "Counting in binary can flip many bits at once: 0111 → 1000 flips four. The reflected Gray code g(n) = n ⊕ (n ≫ 1) visits every number once and flips exactly one bit per step."),
      h("section.stage", { "aria-label": "Binary and Gray code of n" },
        h("div.row", { style: { justifyContent: "space-between" } }, widthSeg, playBtn),
        h("div.cmp", { style: { marginTop: "14px" } },
          h("span.lab", "binary n"), bin,
          h("span.lab", "Gray g(n)"), gry),
        h("div.row", { style: { marginTop: "12px" } },
          h("button.btn.small.ghost", { type: "button", "aria-label": "n minus one", on: { click: () => step(-1) } }, "−1"),
          h("div.grow", slider),
          h("button.btn.small.ghost", { type: "button", "aria-label": "n plus one", on: { click: () => step(1) } }, "+1")),
        h("div", { style: { marginTop: "8px" } }, readout)),
      h("h2", "Every step, drawn"),
      h("p", "Each column is one number, each row one bit; orange marks the bits that flipped on the way in. Binary's flips pile up where a carry ripples through. Gray's reflected pattern always has one."),
      h("section.stage.white", { "aria-label": "Bit planes" },
        h("div.cap", h("b", "Binary")), figBin, h("div.cap", h("b", "Gray code")), figGray,
        h("div.cap", "The one-bit step holds across the wrap too, from the last number back to 0, so a Gray-ordered axis closes into a ring.")),
      h("h2", "How the code is computed"),
      xor,
      h("p.small", "The formula is linear over GF(2), the algebra of XOR, and it can be undone. Both facts come back in chapter 1110."),
      h("h2", "On your chain"),
      h("p", L < 2 ? `Chain ${ctx.chain.id} has ${int(L)} position, so there is no step to count.` : `Chain ${ctx.chain.id} has ${int(L)} positions, so a position needs ${p} bits. Counting positions in binary, the worst step is ${worstAt - 1} → ${worstAt}, which flips ${worstBin} ${worstBin === 1 ? "bit" : "bits"}. Counted in Gray code, all ${int(L - 1)} steps flip exactly one.`),
      tags([["lean", "gray_hamming_one: every n < 255"], ["data", `your chain: ${int(Math.max(0, L - 1))} of ${int(Math.max(0, L - 1))} Gray steps are one bit`]]),
      ctx.chain.entityType === "protein" ? null : h("p", `The nucleotide codes are a Gray cycle themselves: A 00 → C 01 → G 11 → ${T} 10 → A 00, one bit per step.`),
      grayOK ? null : h("div.error", "A Gray step flipped more than one bit. This should be impossible; please report it."),
      theoremBlock("0011", ["KmapProofs.gray_hamming_one", "KmapProofs.gray_injective", "KmapProofs.gray_involution", "KmerIndexing.grayNat_cyclic"]),
      nextStep(ctx, "Put Gray order on both axes of a grid and neighbouring cells differ in one bit: a Karnaugh map."));
    paint();
    if (!reducedMotion()) play();
  },
  unmount() { this._stop?.(); },
};
