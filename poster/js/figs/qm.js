// Quine-McCluskey, worked, and the 8-residue contact map of ContactMapCompleteness.lean.
//
// Left: f(A,B,C,D) = sum m(5, 7, 8, 9, 13, 15) on a 4-variable Karnaugh map (rows AB,
// columns CD, both in Gray order). A tiny exact QM below derives its prime
// implicants and a minimal cover, and the figure draws what it finds:
//   primes  -1-1 (B.D), 100- (A.B'.C'), 1-01 (A.C'.D);  cover  B.D + A.B'.C'
// Right: contactMap8, contacts (0,3) (1,4) (2,5) (0,5) and their mirrors, laid out in
// Gray coordinates (residue p at position p, labelled gray(p)); every pair of
// contact cells is at least two bits apart (contactMap_no_groupable_minterms), so
// no two merge and each contact is its own prime implicant.
import { mount, el, g, pt, gray, ham, bits, COLORS, FONT, CATEGORICAL } from "../lib.js";

const styleOf = (o) => `font-family:${o.mono ? FONT.mono : FONT.sans};fill:${o.fill || COLORS.ink};${o.mono ? "" : "font-stretch:87.5%;"}${o.italic ? "font-style:italic;" : ""}`;
const T = (x, y, s, o = {}) => el("text", { x, y, "font-size": o.size, "font-weight": o.weight || 500, "text-anchor": o.anchor, style: styleOf(o) }, [s]);
function S(x, y, parts, o = {}) {
  const t = el("text", { x, y, "font-size": o.size, "text-anchor": o.anchor, style: styleOf(o) });
  for (const [s, p = {}] of parts) t.appendChild(el("tspan", { "font-weight": p.weight || o.weight || 500, "text-decoration": p.over ? "overline" : undefined, style: styleOf({ ...o, ...p }) }, [s]));
  return t;
}

// exact QM over n variables: implicants as {v, m} (m = free-bit mask)
function primes(on, n) {
  let cur = new Map(on.map((x) => [`${x}/0`, { v: x, m: 0 }]));
  const out = [];
  while (cur.size) {
    const next = new Map(), used = new Set(), list = [...cur.values()];
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const p = list[a], q = list[b], d = p.v ^ q.v;
      if (p.m === q.m && d && !(d & (d - 1))) {
        const c = { v: p.v & ~d, m: p.m | d };
        next.set(`${c.v}/${c.m}`, c); used.add(`${p.v}/${p.m}`); used.add(`${q.v}/${q.m}`);
      }
    }
    for (const [k, p] of cur) if (!used.has(k)) out.push(p);
    cur = next;
  }
  return out;
}
const covers = (p, x) => ((p.v ^ x) & ~p.m) === 0;
const pat = (p, n) => [...Array(n)].map((_, i) => { const b = 1 << (n - 1 - i); return p.m & b ? "-" : p.v & b ? "1" : "0"; }).join("");

export default async function build(host, { w, h }) {
  // ── the worked example, computed and checked ─────────────────────────────────
  const ON = [5, 7, 8, 9, 13, 15];
  const P = primes(ON, 4).sort((a, b) => pat(a, 4).localeCompare(pat(b, 4)));
  const pats = P.map((p) => pat(p, 4));
  if (pats.join() !== ["-1-1", "1-01", "100-"].join()) throw new Error(`qm: primes ${pats}`);
  const essential = P.filter((p) => ON.some((x) => covers(p, x) && P.filter((q) => covers(q, x)).length === 1));
  if (essential.map((p) => pat(p, 4)).sort().join() !== "-1-1,100-") throw new Error("qm: essentials");
  if (!ON.every((x) => essential.some((p) => covers(p, x)))) throw new Error("qm: cover incomplete");
  if ([...Array(16).keys()].some((x) => !ON.includes(x) && P.some((p) => covers(p, x)))) throw new Error("qm: covers an off cell");

  // ── contactMap8, in Gray coordinates ─────────────────────────────────────────
  const C8 = [[0, 3], [1, 4], [2, 5], [0, 5]];
  const all = C8.flatMap(([i, j]) => [[i, j], [j, i]]);
  const cellOf = ([i, j]) => gray(i) * 8 + gray(j);                 // contactGrayCell
  for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++)
    if (ham(cellOf(all[a]), cellOf(all[b])) < 2) throw new Error("qm: two contact cells are adjacent");

  await Promise.all(["500 semi-condensed 20px Archivo", "700 semi-condensed 20px Archivo", '500 20px "Plex Mono"'].map((f) => document.fonts.load(f)));
  const inset = 1.6, fs = pt(20), fsH = pt(21.5), fsM = pt(18.5), fsCell = pt(19);
  const gray2 = ["00", "01", "11", "10"];

  mount(host, w, h, (svg) => {
    const headY = inset + fsH * 0.8;
    // ── left: K-map ────────────────────────────────────────────────────────────
    svg.appendChild(T(inset, headY, "Merge cells one bit apart", { size: fsH, weight: 700 }));
    const lab = fsM * 2.1;                                   // room for row labels
    const kx = inset + lab, ky = headY + fsH * 1.35;
    const c = Math.min(9.4, (h - ky - inset - fs * 1.2) / 4);
    svg.appendChild(T(kx - 1.2, ky - 1.2, "AB", { size: fsM, anchor: "end", italic: true, fill: COLORS.ink2 }));
    svg.appendChild(T(kx + 4 * c + 1.2, ky - 1.2, "CD", { size: fsM, italic: true, fill: COLORS.ink2 }));
    gray2.forEach((lb, q) => svg.appendChild(T(kx + (q + 0.5) * c, ky - 1.2, lb, { size: fsM, mono: true, anchor: "middle", fill: COLORS.ink2 })));
    gray2.forEach((lb, r) => svg.appendChild(T(kx - 1.2, ky + (r + 0.5) * c + fsM * 0.34, lb, { size: fsM, mono: true, anchor: "end", fill: COLORS.ink2 })));
    const at = (m) => ({ r: gray2.indexOf(bits(m >> 2, 2)), q: gray2.indexOf(bits(m & 3, 2)) });
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
      const m = parseInt(gray2[r] + gray2[q], 2), on = ON.includes(m);
      svg.appendChild(el("rect", { x: kx + q * c, y: ky + r * c, width: c, height: c, fill: on ? COLORS.ink100 : COLORS.paper, stroke: COLORS.rule, "stroke-width": 0.3 }));
      if (on) svg.appendChild(T(kx + (q + 0.5) * c, ky + (r + 0.5) * c + fsCell * 0.35, "1", { size: fsCell, weight: 700, anchor: "middle" }));
    }
    // outline each prime by the bounding box of its cells in K-map positions
    const box = (p, color, dash) => {
      const pos = ON.filter((x) => covers(p, x)).map(at);
      const r0 = Math.min(...pos.map((o) => o.r)), r1 = Math.max(...pos.map((o) => o.r));
      const q0 = Math.min(...pos.map((o) => o.q)), q1 = Math.max(...pos.map((o) => o.q));
      const ins = dash ? 1.1 : 0.55;
      return el("rect", { x: kx + q0 * c + ins, y: ky + r0 * c + ins, width: (q1 - q0 + 1) * c - 2 * ins, height: (r1 - r0 + 1) * c - 2 * ins,
        rx: c * 0.32, fill: "none", stroke: color, "stroke-width": dash ? 0.45 : 0.75, "stroke-dasharray": dash ? "1.2 0.9" : undefined });
    };
    const [pBD, pACD, pABC] = P;                             // sorted: -1-1, 1-01, 100-
    svg.appendChild(box(pACD, COLORS.ink300, true));
    svg.appendChild(box(pBD, CATEGORICAL[0], false));
    svg.appendChild(box(pABC, CATEGORICAL[4], false));

    // ── middle: the merges, as bit strings ─────────────────────────────────────
    const mx = kx + 4 * c + 4.5;
    let y = ky + fsM * 0.8;
    const lh = fsM * 1.3;
    const line = (parts, o = {}) => { svg.appendChild(S(mx, y, parts, { size: fsM, mono: true, ...o })); y += lh; };
    line([["0101+0111 → "], ["01-1", { weight: 600 }]]);
    line([["1101+1111 → "], ["11-1", { weight: 600 }]]);
    line([["01-1+11-1 → "], ["-1-1", { weight: 600, fill: CATEGORICAL[0] }]]);
    line([["1000+1001 → "], ["100-", { weight: 600, fill: CATEGORICAL[4] }]]);
    y += lh * 0.25;
    svg.appendChild(S(mx, y, [["f", { italic: true }], [" = "], ["B", { italic: true }], ["D", { italic: true }], [" + "], ["A", { italic: true }], ["B", { italic: true, over: true }], ["C", { italic: true, over: true }]], { size: fs, weight: 700 })); y += lh;
    svg.appendChild(T(mx, y, "dashed: prime, not needed", { size: fsM, fill: COLORS.ink2 }));

    // ── right: contactMap8 ─────────────────────────────────────────────────────
    const cs = Math.min(6.2, (h - ky - inset - fsM * 2.8) / 8);
    const gx = w - inset - 8 * cs, gy = ky;
    svg.appendChild(T(w - inset, headY, "8 residues, 4 contacts", { size: fsH, weight: 700, anchor: "end" }));
    const g3 = [...Array(8).keys()].map((p) => bits(gray(p), 3));
    for (let p = 0; p < 8; p++) {
      svg.appendChild(T(gx - 1, gy + (p + 0.5) * cs + fsM * 0.34, g3[p], { size: fsM, mono: true, anchor: "end", fill: COLORS.ink2 }));
    }
    // axes: residue i down the rows (Gray-coded labels), residue j along the columns
    svg.appendChild(T(gx - 2.4, gy - 1.2, "i ↓", { size: fsM, italic: true, anchor: "end", fill: COLORS.ink2 }));
    svg.appendChild(T(gx + 1.6, gy - 1.2, "j →", { size: fsM, italic: true, fill: COLORS.ink2 }));
    const isC = (i, j) => all.some(([a, b]) => a === i && b === j);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      svg.appendChild(el("rect", { x: gx + j * cs, y: gy + i * cs, width: cs, height: cs,
        fill: isC(i, j) ? COLORS.ink : i === j ? COLORS.wash : COLORS.paper, stroke: COLORS.rule, "stroke-width": 0.25 }));
    }
    svg.appendChild(el("rect", { x: gx, y: gy, width: 8 * cs, height: 8 * cs, fill: "none", stroke: COLORS.ink300, "stroke-width": 0.3 }));
    svg.appendChild(T(w - inset, gy + 8 * cs + fsM * 1.2, "no two touch, so each", { size: fsM, anchor: "end", fill: COLORS.ink2 }));
    svg.appendChild(T(w - inset, gy + 8 * cs + fsM * 2.45, "is its own prime implicant", { size: fsM, anchor: "end", fill: COLORS.ink2 }));
  }, "Quine-McCluskey worked on a 4-variable Karnaugh map: minterms 5, 7, 13, 15 merge into B·D and 8, 9 into A·B̄·C̄, giving f = BD + AB̄C̄; A·C̄·D is also prime but not needed. Right: the 8-residue contact map proved in Lean; no two of its contact cells are one bit apart, so each contact is its own prime implicant.");
}
