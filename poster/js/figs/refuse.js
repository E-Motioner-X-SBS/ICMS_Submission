// refuse — the claim Lean refused.  One cube, 10--, read against a chain of 16
// residues (4 position bits) under two numberings.  Plain binary: residue p
// carries code p.  Gray-coded: residue p carries code g(p).  Either way the
// residues whose code matches the cube form ONE unbroken run of four; only the
// run differs (sc_gray_cube_is_also_interval, sc_gray_relabels_segments).
// Everything is computed from gray() and the Lean cube predicate scEval.
import { el, g, mount, pt, gray, grayInv, bits, COLORS, FONT, NS } from "../lib.js";

// Cube membership exactly as SequenceCircuits.scEval: bits set in `mask` are free.
const scEval = (w, value, mask, c) => (((value ^ c) & ((2 ** w - 1) ^ mask)) === 0);

// Text styled through the style attribute (the poster stylesheet sets fill and
// font-family on svg text, which would beat presentation attributes).
function style(o = {}) {
  return [
    `font-family:${o.family || FONT.sans}`, `font-size:${pt(o.size || 20)}px`,
    `font-weight:${o.weight || 400}`, `fill:${o.fill || COLORS.ink}`,
    o.family ? "" : `font-stretch:${o.stretch || 92}%`, o.style || "",
  ].filter(Boolean).join(";");
}
function T(x, y, s, o = {}) {
  const kids = Array.isArray(s) ? s.map(([t, a = {}]) => el("tspan", { ...(a.attrs || {}), style: a.style || "" }, [t])) : [s];
  return el("text", { x, y, "text-anchor": o.anchor || "start", ...(o.attrs || {}), style: style(o) }, kids);
}
// Width (mm) of a text node, measured in a hidden svg that uses mm user units.
function measure(node) {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 1000 100"); s.setAttribute("width", "1000mm"); s.setAttribute("height", "100mm");
  s.setAttribute("style", "position:absolute;left:-2000mm;top:0;visibility:hidden");
  document.body.appendChild(s);
  const n = node.cloneNode(true); n.setAttribute("x", 0); n.setAttribute("y", 50); s.appendChild(n);
  const wmm = n.getBBox().width; s.remove(); return wmm;
}

export default async function build(host, { w, h }) {
  const NB = 4, N = 1 << NB;                      // 4 position bits: residues 0..15
  const CUBE = { value: 0b1000, mask: 0b0011 };   // 10--: top bits fixed at 1 0, low two free
  const cubeStr = [...bits(CUBE.value, NB)].map((b, k) => ((CUBE.mask >> (NB - 1 - k)) & 1 ? "-" : b)).join("");
  const codeOf = { binary: (p) => p, gray: (p) => gray(p) };
  const run = {};
  for (const [k, f] of Object.entries(codeOf)) run[k] = [...Array(N).keys()].filter((p) => scEval(NB, CUBE.value, CUBE.mask, f(p)));

  // ── checks against the Lean statements (throw = the figure refuses to draw) ─
  const isRun = (a, u) => a.length === 2 ** u && a[0] % 2 ** u === 0 && a.every((p, i) => p === a[0] + i);
  if (cubeStr !== "10--") throw new Error(`cube ${cubeStr}`);
  if (!isRun(run.binary, 2) || run.binary[0] !== 8) throw new Error(`binary run ${run.binary}`);   // sc_low_free_is_interval
  if (!isRun(run.gray, 2) || run.gray[0] !== 12) throw new Error(`gray run ${run.gray}`);
  const viaInv = [8, 9, 10, 11].map(grayInv).sort((a, b) => a - b);                                    // inverse-Gray relabelling
  if (viaInv.join() !== run.gray.join()) throw new Error("grayInv disagrees");
  for (let u = 0; u <= 4; u++) for (let v = 0; v < 16; v += 2 ** u) {                                  // sc_gray_cube_is_also_interval
    const r = [...Array(16).keys()].filter((i) => scEval(4, v, 2 ** u - 1, gray(i)));
    if (!isRun(r, u)) throw new Error(`not an interval: u=${u} v=${v}`);
  }
  if (run.gray.join() === run.binary.join()) throw new Error("sc_gray_relabels_segments");
  for (let p = 0; p + 1 < N; p++) if (((gray(p) ^ gray(p + 1)) & ((gray(p) ^ gray(p + 1)) - 1)) !== 0) throw new Error("gray step");

  const sCode = 18, sLab = 20, sNum = 18;

  mount(host, w, h, (svg) => {
    const pad = Math.max(1.8, w * 0.011);
    const x0 = pad;
    const cw = (w - 2 * pad) / N;                  // full width: 16 two-digit codes need it
    const em = pt(sCode), eL = pt(sLab);
    const pitch = em * 0.92;                       // two digit-lines per code (digits have no descenders)
    const codeH = pitch + em * 0.72 + 2 * em * 0.17;
    const vgap = h * 0.017;
    // headline (the claim) on top; its size shrinks only as far as needed to fit, never below 19 pt
    const headParts = (sz) => T(pad, 0, [["Same cube, still a segment, ", { style: "font-weight:700" }],
      ["different residues", { style: `fill:${COLORS.ink2}` }]], { size: sz, stretch: 90 });
    let sHead = 22;
    while (sHead > 19 && measure(headParts(sHead)) > w - 2 * pad) sHead -= 0.5;
    const eH = pt(sHead);
    const row0 = pad + eH * 0.72;
    const row1 = row0 + eH * 0.22 + eL * 0.9 + h * 0.012;
    const s1 = row1 + eL * 0.18 + vgap;            // binary codes
    const bottom = h - pad;
    const fixed = s1 + 4 * vgap + 2 * codeH + eL * 0.72 + eL * 0.2;   // everything but the chain
    const beadR = Math.max(2.4, Math.min(cw * 0.37, (bottom - fixed) / 2));
    const chainY = s1 + codeH + vgap + beadR;
    const s2 = chainY + beadR + vgap;              // Gray codes
    const row5 = s2 + codeH + vgap + eL * 0.72;
    const root = g({});
    svg.appendChild(root);
    const cx = (p) => x0 + (p + 0.5) * cw;

    // codes, two lines per residue: top = the two bits the cube fixes, bottom = the two it frees
    const codes = (y, kind) => {
      const r = run[kind];
      root.appendChild(el("rect", { x: x0 + r[0] * cw + 0.25, y, width: r.length * cw - 0.5, height: codeH, rx: 1.6, fill: COLORS.ink }));
      for (let p = 0; p < N; p++) {
        const on = r.includes(p);
        const c = bits(codeOf[kind](p), NB);
        const yb = y + em * 0.17 + em * 0.72;
        root.appendChild(el("text", { x: cx(p), y: yb, "text-anchor": "middle",
          style: `font-family:${FONT.mono};font-size:${pt(sCode)}px;fill:${on ? COLORS.paper : COLORS.ink}` }, [
          el("tspan", { x: cx(p), style: `font-weight:${on ? 600 : 500}` }, [c.slice(0, 2)]),
          el("tspan", { x: cx(p), dy: pitch, style: `font-weight:400;fill:${on ? "#BFD0E1" : COLORS.ink2}` }, [c.slice(2)]),
        ]));
      }
    };
    codes(s1, "binary");
    codes(s2, "gray");

    // the chain of residues, shared by both numberings
    root.appendChild(el("line", { x1: cx(0), x2: cx(N - 1), y1: chainY, y2: chainY, stroke: COLORS.ink300, "stroke-width": 0.5 }));
    for (let p = 0; p < N; p++) {
      const hit = run.binary.includes(p) || run.gray.includes(p);
      const bw = Math.min(cw - 1.4, beadR * 2.7);
      root.appendChild(el("rect", { x: cx(p) - bw / 2, y: chainY - beadR, width: bw, height: 2 * beadR, rx: beadR, fill: COLORS.paper,
        stroke: hit ? COLORS.ink : COLORS.ink300, "stroke-width": hit ? 0.55 : 0.35 }));
      root.appendChild(T(cx(p), chainY + pt(sNum) * 0.35, String(p), { size: sNum, weight: hit ? 700 : 450,
        fill: hit ? COLORS.ink : COLORS.ink2, anchor: "middle", stretch: 80 }));
    }
    // ticks tying each run of codes to its residues
    for (const [kind, y1, y2] of [["binary", s1 + codeH, chainY - beadR], ["gray", s2, chainY + beadR]])
      for (const p of run[kind]) root.appendChild(el("line", { x1: cx(p), x2: cx(p), y1, y2, stroke: COLORS.ink, "stroke-width": 0.5 }));

    // row names (left) and what the cube picks out (centred over / right of each run)
    const mono = `font-family:${FONT.mono};font-weight:600`;
    const runTxt = (r) => ` → residues ${r[0]}–${r.at(-1)}`;
    const mid = (r) => x0 + ((r[0] + r.at(-1) + 1) / 2) * cw;
    root.appendChild(T(x0, row1, "Plain binary", { size: sLab, weight: 700 }));
    root.appendChild(T(mid(run.binary), row1, [["cube ", {}], [cubeStr, { style: mono }], [runTxt(run.binary), {}]], { size: sLab, anchor: "middle" }));
    root.appendChild(T(x0, row5, "Gray-coded", { size: sLab, weight: 700 }));
    root.appendChild(T(w - pad, row5, [["cube ", {}], [cubeStr, { style: mono }], [runTxt(run.gray), {}]], { size: sLab, anchor: "end" }));
    // the claim
    const head = headParts(sHead); head.setAttribute("y", row0); root.appendChild(head);
  }, `Cube ${cubeStr} over a chain of 16 residues: plain binary picks residues ${run.binary[0]}–${run.binary.at(-1)}, Gray-coded picks ${run.gray[0]}–${run.gray.at(-1)}; both are one unbroken segment.`);
}
