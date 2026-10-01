// Exact rules on a padded map (ContactCircuits.lean).
// A residue-pair map has 20 x 20 cells. Quine-McCluskey needs a power of two per
// axis, so the map is padded to 32 x 32 (5 bits per residue, 10-bit addresses,
// 1,024 cells): cell of (row v, column r) = 32 v + r. Rows and columns 20-31 are
// padding, marked don't-care.
//   cc_fixed_match_unique : a fully fixed 10-bit implicant matches exactly its own cell
//   cc_padding_safety     : an implicant whose fixed bits name real residues (v < 20,
//                           r < 20) fires only inside the 20 x 20 block
// The example cube below is checked cell by cell against both statements.
import { mount, el, g, pt, bits, COLORS, FONT } from "../lib.js";

const styleOf = (o) => `font-family:${o.mono ? FONT.mono : FONT.sans};fill:${o.fill || COLORS.ink};${o.mono ? "" : "font-stretch:87.5%;"}${o.italic ? "font-style:italic;" : ""}`;
const T = (x, y, s, o = {}) => el("text", { x, y, "font-size": o.size, "font-weight": o.weight || 500, "text-anchor": o.anchor, style: styleOf(o) }, [s]);
function S(x, y, parts, o = {}) {
  const t = el("text", { x, y, "font-size": o.size, "text-anchor": o.anchor, style: styleOf(o) });
  for (const [s, p = {}] of parts) t.appendChild(el("tspan", { "font-weight": p.weight || o.weight || 500, style: styleOf({ ...o, ...p }) }, [s]));
  return t;
}

export default async function build(host, { w, h }) {
  const N = 20, P = 32, BITS = 5;
  // an implicant as (value, mask) over 10 bits; a set mask bit = free ("-")
  const cube = { v: 0b00100, mv: 0b00011, r: 0b01000, mr: 0b00011 };   // rows 4-7 x columns 8-11
  // ccEval semantics: an implicant (value, mask) matches cell c iff ((value ^ c) & ~mask) == 0
  const match = (value, mask, c) => ((value ^ c) & ~mask & 1023) === 0;
  const value = (cube.v << BITS) | cube.r, mask = (cube.mv << BITS) | cube.mr;
  const cells = [];
  for (let c = 0; c < P * P; c++) if (match(value, mask, c)) cells.push([c >> BITS, c & 31]);
  if (cells.length !== 16) throw new Error("padding: cube size");
  if (!cells.every(([v, r]) => v < N && r < N)) throw new Error("padding: cube leaves the 20 x 20 block");
  // cc_fixed_match_unique: a fully fixed implicant (mask 0) matches exactly its own address
  for (let a = 0; a < P * P; a++) for (let c = 0; c < P * P; c++) if (match(a, 0, c) !== (a === c)) throw new Error("padding: fixed match");
  const pattern = `${bits(cube.v >> 2, 3)}--${bits(cube.r >> 2, 3)}--`;   // 001-- 010--

  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo", '500 20px "Plex Mono"'].map((f) => document.fonts.load(f)));
  const inset = 1.6, fs = pt(20), fsHead = pt(21.5);
  const lineH = fs * 1.22;

  mount(host, w, h, (svg) => {
    // grid: square, full height minus the axis label
    const top = inset + fsHead * 1.35;
    const G = h - top - inset - fs * 1.2;
    const s = G / P;
    const gx = inset + fs * 1.1, gy = top;
    svg.appendChild(T(gx, inset + fsHead * 0.8, `${P} × ${P} = 1,024 addresses (10 bits)`, { size: fsHead, weight: 700 }));
    const grid = g({ "aria-label": "32 by 32 padded map: rows and columns 0 to 19 are real residues, 20 to 31 are padding" });
    for (let v = 0; v < P; v++) for (let r = 0; r < P; r++) {
      const real = v < N && r < N;
      grid.appendChild(el("rect", { x: gx + r * s + 0.06, y: gy + v * s + 0.06, width: s - 0.12, height: s - 0.12,
        fill: real ? COLORS.ink100 : COLORS.paper, stroke: real ? "none" : COLORS.rule, "stroke-width": 0.12 }));
    }
    // the 20 x 20 block and the example cube
    grid.appendChild(el("rect", { x: gx, y: gy, width: N * s, height: N * s, fill: "none", stroke: COLORS.ink, "stroke-width": 0.45 }));
    const [v0, r0] = cells[0];
    grid.appendChild(el("rect", { x: gx + r0 * s, y: gy + v0 * s, width: 4 * s, height: 4 * s, rx: s * 0.6, fill: COLORS.teal, opacity: 0.9 }));
    grid.appendChild(el("rect", { x: gx, y: gy, width: G, height: G, fill: "none", stroke: COLORS.ink300, "stroke-width": 0.3 }));
    svg.appendChild(grid);
    // axis labels
    svg.appendChild(T(gx + G / 2, gy + G + fs * 1.05, "second residue, 5 bits", { size: fs, anchor: "middle", fill: COLORS.ink2 }));
    const ly = gy + G / 2;
    svg.appendChild(el("text", { x: 0, y: 0, "font-size": fs, "text-anchor": "middle", transform: `translate(${inset + fs * 0.72},${ly}) rotate(-90)`, style: styleOf({ fill: COLORS.ink2 }) }, ["first residue, 5 bits"]));

    // right: three statements, each tied to what the grid shows
    const tx = gx + G + 5;
    let y = top + fs * 0.9;
    const put = (parts, o = {}) => { svg.appendChild(Array.isArray(parts) ? S(tx, y, parts, { size: fs, ...o }) : T(tx, y, parts, { size: fs, ...o })); y += lineH; };
    const sw = (fill, stroke) => el("rect", { x: tx, y: y - fs * 0.72, width: fs * 0.8, height: fs * 0.8, rx: 0.3, fill, stroke: stroke || "none", "stroke-width": 0.2 });
    svg.appendChild(sw(COLORS.ink100)); svg.appendChild(T(tx + fs * 1.15, y, "20 × 20 real residue pairs", { size: fs })); y += lineH;
    svg.appendChild(sw(COLORS.paper, COLORS.rule)); svg.appendChild(T(tx + fs * 1.15, y, "padding 20–31: don't-care", { size: fs, fill: COLORS.ink2 })); y += lineH * 1.25;
    svg.appendChild(sw(COLORS.teal)); svg.appendChild(S(tx + fs * 1.15, y, [["one rule "], [pattern, { mono: true }]], { size: fs })); y += lineH;
    svg.appendChild(T(tx + fs * 1.15, y, "covers 16 real cells, no padding", { size: fs, fill: COLORS.ink2 })); y += lineH;

  }, `A 20 by 20 residue-pair map padded to 32 by 32 = 1,024 ten-bit addresses; padding rows and columns 20 to 31 are don't-care. A rule ${pattern} covers 16 real cells and no padding; Lean proves a fully fixed rule on real residues fires only inside the 20 by 20 block.`);
}
