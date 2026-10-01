// 0110 The geometry of the code: amino acids on the 5-cube (4 × 8 K-map), or the
// nucleotide square with Gray-coded labels.
import { h, theoremBlock, tags, nextStep, css, inkOn, stageWidth, add } from "../ui.js";
import { Q5_SHAPE, kmapCode, kmapCell, CODE_AA, AA_CODE, AA_GROUP, AA_NAMES, GROUPS, ham, bits, gray, aaPairHistogram,
  neighbourDistanceHistogram, encodeSequence, NUC_GRAYNAT, NA_SQUARE, nucRelation, UNUSED_AA_CODES, letterVar } from "../core/encoding.js";
import { barsSVG } from "../viz/maps.js";
import { chainSegments } from "../core/contacts.js";
import { int, pct } from "../core/format.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); for (const k of kids) e.append(k); return e; };

function proteinCube(el, ctx) {
  const enc = encodeSequence(ctx.chain.seq, "protein");
  const sh = Q5_SHAPE;                                   // rows: high 2 bits, columns: low 3 bits
  let sel = "A";
  const stage = h("section.stage.white", { "aria-label": "The 32 five-bit codewords as a 4 by 8 Karnaugh map" });
  const readout = h("div.readout", { "aria-live": "polite" });
  const cube = h("div", { style: { position: "relative" }, "data-noswipe": "" });
  stage.append(cube);

  function draw() {
    const W = stageWidth(stage) - 28, lab = 34, cell = Math.floor(Math.min(58, (W - lab) / 8)), H = lab + 4 * cell;
    const svg = s("svg", { viewBox: `0 0 ${lab + 8 * cell + 2} ${H + 2}`, width: "100%", role: "img", "aria-label": `Codeword map; selected ${sel}` });
    const me = AA_CODE[sel];
    for (let x = 0; x < 8; x++) svg.append(s("text", { x: lab + (x + 0.5) * cell, y: lab - 10, "text-anchor": "middle", style: "font:500 10.5px var(--mono);fill:var(--ink-3)" }, bits(gray(x), 3)));
    for (let y = 0; y < 4; y++) svg.append(s("text", { x: lab - 6, y: lab + (y + 0.55) * cell, "text-anchor": "end", style: "font:500 10.5px var(--mono);fill:var(--ink-3)" }, bits(gray(y), 2)));
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
      const code = kmapCode(x, y, sh), aa = CODE_AA[code], d = ham(code, me);
      const g = s("g", { style: aa ? "cursor:pointer" : "" });
      const X = lab + x * cell, Y = lab + y * cell;
      if (aa) {
        const col = css(letterVar(aa, "protein"));
        g.append(s("rect", { x: X + 2, y: Y + 2, width: cell - 4, height: cell - 4, rx: 6, style: `fill:${col};opacity:${aa === sel ? 1 : d === 1 ? 0.95 : 0.35}` }));
        g.append(s("text", { x: X + cell / 2, y: Y + cell * 0.5, "text-anchor": "middle", "dominant-baseline": "middle", style: `font:700 ${Math.round(cell * 0.36)}px var(--mono);fill:${inkOn(col)};opacity:${aa === sel || d === 1 ? 1 : 0.8}` }, aa));
        g.append(s("text", { x: X + cell - 6, y: Y + cell - 7, "text-anchor": "end", style: `font:600 ${Math.max(8, Math.round(cell * 0.18))}px var(--sans);fill:${inkOn(col)}` }, aa === sel ? "" : String(d)));
        g.addEventListener("click", () => { sel = aa; draw(); });
      } else {
        g.append(s("rect", { x: X + 2, y: Y + 2, width: cell - 4, height: cell - 4, rx: 6, style: "fill:none;stroke:var(--rule);stroke-dasharray:3 3" }));
      }
      if (aa === sel) g.append(s("rect", { x: X + 0.5, y: Y + 0.5, width: cell - 1, height: cell - 1, rx: 7, style: "fill:none;stroke:var(--flip);stroke-width:3" }));
      else if (aa && d === 1) g.append(s("rect", { x: X + 1, y: Y + 1, width: cell - 2, height: cell - 2, rx: 7, style: "fill:none;stroke:var(--ink);stroke-width:1.5" }));
      svg.append(g);
    }
    cube.replaceChildren(svg);
    const nb = Object.keys(AA_CODE).filter((a) => ham(AA_CODE[a], me) === 1);
    const far = Object.keys(AA_CODE).filter((a) => ham(AA_CODE[a], me) === 5);
    readout.replaceChildren(h("b", `${sel} (${AA_NAMES[sel]})`), ` = ${bits(me, 5)}. One bit away: `, h("b", nb.join(" ") || "none"),
      nb.length ? ` (${nb.map((a) => AA_GROUP[a].key === AA_GROUP[sel].key ? "same group" : AA_GROUP[a].name).filter((v, i, arr) => arr.indexOf(v) === i).join(", ")})` : "",
      far.length ? `. Five bits away, the maximum: ${far.join(" ")}.` : ".");
  }

  // distance histograms: proven over the alphabet vs measured along the chain
  const proven = aaPairHistogram();                     // [0, 40, 66, 56, 24, 4]
  const along = neighbourDistanceHistogram(enc.codes, 5, chainSegments(ctx.chain).breaks);   // neighbours in the chain only
  const nAlong = along.reduce((a, b) => a + b, 0) || 1;
  const bars = barsSVG([1, 2, 3, 4, 5].map((d) => ({ label: `${d} bit${d > 1 ? "s" : ""}: all pairs`, value: proven[d] / 190, color: "var(--ink-3)" }))
    .flatMap((b, i) => [b, { label: `along chain ${ctx.chain.id}`, value: along[i + 1] / nAlong, color: i === 0 ? "var(--flip)" : "var(--teal)" }]),
    { width: 340, max: 0.5 });

  add(el, 
    h("h1", "The geometry of the code"),
    h("p.hook", "Five bits make 32 codewords: the corners of a five-dimensional cube. Twenty of them hold an amino acid. Two residues are neighbours on the cube when their codes differ in one bit."),
    h("p", "Drawn as a Karnaugh map, the cube becomes a 4 × 8 grid: rows carry the first two bits, columns the last three, both in Gray order. Tap a residue to see how far every other one sits (the small number is the Hamming distance)."),
    stage, readout,
    h("div.legend", GROUPS.map((g) => h("span", h("i", { style: { background: `var(${g.cssVar})` } }), g.name)), h("span", h("i.ring", { style: { borderColor: "var(--rule)", borderStyle: "dashed" } }), `${UNUSED_AA_CODES.length} unused codewords`)),
    h("h2", "All 190 pairs, proved"),
    h("p", "Lean computes the distance of every unordered pair of the 20 residues: 40 pairs are one bit apart, 66 two, 56 three, 24 four and only 4 are five apart (F–H, Y–E, W–R, M–K). The code uses 40 of the cube's 80 edges, exactly half."),
    h("section.stage", { "aria-label": "Distance distribution" }, h("div", { html: bars }),
      h("div.cap", h("b", "Grey: "), "share of the 190 residue pairs at each distance (proved). ", h("b", "Colour: "), `share of the ${int(nAlong)} consecutive residue pairs of chain ${ctx.chain.id} (measured).`)),
    h("p", `Along your chain, ${pct(along[1] / nAlong)} of neighbouring residues are one bit apart, against ${pct(40 / 190)} of all residue pairs. Because the full distance table is proved, any such comparison rests on exact numbers rather than on a hand-built table.`),
    tags([["lean", "190 pairs: 40, 66, 56, 24, 4 at distance 1–5"], ["lean", "F–H, Y–E, W–R, M–K differ in all 5 bits"], ["lean", "the code uses 40 of the cube's 80 edges"], ["data", `your chain: ${int(nAlong)} steps`]]),
    theoremBlock("0110", ["KmapEncodingEquiv.unorderedDistanceDistribution", "AminoAcidEncoding.max_distance_FH", "AminoAcidEncoding.charge_adjacency_DE", "KmapEncodingEquiv.encoding_edge_coverage"]),
    nextStep(ctx, "Sequence was the warm-up. Next: the chain's 3D contacts, as a Boolean function."));
  draw();
  let lastW = stage.clientWidth;
  const ro = new ResizeObserver(() => { if (Math.abs(stage.clientWidth - lastW) > 8) { lastW = stage.clientWidth; draw(); } }); ro.observe(stage);
  return () => ro.disconnect();
}

function nucleotideSquare(el, ctx) {
  const type = ctx.chain.entityType, T = type === "rna" ? "U" : "T";
  const enc = encodeSequence(ctx.chain.seq, type);
  let sel = null;
  const stage = h("section.stage.white", { "aria-label": "The nucleotide square" });
  const readout = h("div.readout", { "aria-live": "polite" });
  const holder = h("div", { "data-noswipe": "" });
  stage.append(holder);
  const LET = ["A", "C", "G", T];
  const pos = (l) => NA_SQUARE[l === "U" ? "T" : l];
  const rel = (a, b) => nucRelation(a, b);
  const EDGE = { transition: "var(--flip)", transversion: "var(--ink-3)", complement: "var(--teal)" };
  function draw() {
    const S = 220, pad = 56, W = S + 2 * pad;
    const svg = s("svg", { viewBox: `0 0 ${W} ${W}`, width: "100%", style: "max-width:380px;display:block;margin:0 auto", role: "img",
      "aria-label": "Square with A, C, T, G at the corners: transitions one bit apart on the sides, complements two bits apart on the diagonals" });
    const P = (l) => ({ x: pad + pos(l).x * S, y: pad + pos(l).y * S });
    const pairs = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) pairs.push([LET[i], LET[j]]);
    for (const [a, b] of pairs) {
      const r = rel(a, b), pa = P(a), pb = P(b), d = ham(NUC_GRAYNAT[a === "U" ? "T" : a], NUC_GRAYNAT[b === "U" ? "T" : b]);
      const on = !sel || sel === a || sel === b;
      svg.append(s("line", { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, style: `stroke:${EDGE[r]};stroke-width:${r === "complement" ? 3 : 4};stroke-dasharray:${r === "complement" ? "7 6" : "none"};opacity:${on ? 1 : 0.2}` }));
      const diag = pa.x !== pb.x && pa.y !== pb.y;
      let lx, ly, anchor = "middle";
      if (diag) {                                   // one label for both diagonals, just below the crossing
        if (!(a === "A" || b === "A")) continue;
        lx = W / 2; ly = W / 2 + 26;
      } else if (pa.x === pb.x) { lx = pa.x + (pa.x < W / 2 ? -14 : 14); ly = (pa.y + pb.y) / 2 + 4; anchor = pa.x < W / 2 ? "end" : "start"; }
      else { lx = (pa.x + pb.x) / 2; ly = pa.y + (pa.y < W / 2 ? -10 : 20); }
      if (on) svg.append(s("text", { x: lx, y: ly, "text-anchor": anchor, style: `font:600 12px var(--sans);fill:${EDGE[r] === "var(--ink-3)" ? "var(--ink-2)" : EDGE[r]}` }, `${d} bit${d > 1 ? "s" : ""}`));
    }
    for (const l of LET) {
      const p = P(l), col = css(`--n-${l === "U" ? "T" : l}`);
      const g = s("g", { style: "cursor:pointer" });
      g.append(s("circle", { cx: p.x, cy: p.y, r: 25, style: `fill:${col};stroke:${sel === l ? "var(--flip)" : "var(--paper)"};stroke-width:${sel === l ? 4 : 2}` }));
      g.append(s("text", { x: p.x, y: p.y + 1, "text-anchor": "middle", "dominant-baseline": "middle", style: `font:700 20px var(--mono);fill:${inkOn(col)}` }, l));
      const code = bits(NUC_GRAYNAT[l === "U" ? "T" : l], 2);
      g.append(s("text", { x: p.x, y: p.y + (pos(l).y ? 44 : -36), "text-anchor": "middle", style: "font:600 13px var(--mono);fill:var(--ink-2)" }, code));
      g.addEventListener("click", () => { sel = sel === l ? null : l; draw(); });
      svg.append(g);
    }
    holder.replaceChildren(svg);
    if (sel) {
      const others = LET.filter((x) => x !== sel).map((x) => `${x} (${rel(sel, x)}, ${ham(NUC_GRAYNAT[sel === "U" ? "T" : sel], NUC_GRAYNAT[x === "U" ? "T" : x])} bit${rel(sel, x) === "complement" ? "s" : ""})`);
      readout.textContent = `${sel} = ${bits(NUC_GRAYNAT[sel === "U" ? "T" : sel], 2)}: ${others.join(", ")}.`;
    } else readout.textContent = "Tap a corner.";
  }

  // relations between consecutive bases along the chain (within each strand)
  const counts = { identical: 0, transition: 0, transversion: 0, complement: 0 };
  const cuts = chainSegments(ctx.chain).breaks;              // strand junctions and gaps
  for (let i = 0; i + 1 < enc.letters.length; i++) {
    if (cuts.has(i + 1)) continue;
    const a = enc.letters[i], b = enc.letters[i + 1];
    if (enc.codes[i] === null || enc.codes[i + 1] === null) continue;
    counts[rel(a, b)]++;
  }
  const n = Object.values(counts).reduce((x, y) => x + y, 0) || 1;
  const bars = barsSVG([
    { label: "same base (0 bits)", value: counts.identical / n, color: "var(--ink-3)" },
    { label: "transition (1 bit)", value: counts.transition / n, color: "var(--flip)" },
    { label: "other transversion (1 bit)", value: counts.transversion / n, color: "var(--ink-2)" },
    { label: "complement (2 bits)", value: counts.complement / n, color: "var(--teal)" }], { width: 340, max: 0.6 });

  add(el, 
    h("h1", "The geometry of the code"),
    h("p.hook", `Two bits make a square. Relabelled by the Gray code, the four bases sit at its corners so that chemistry becomes distance: transitions (A↔G, C↔${T}) are one bit apart, Watson–Crick partners (A–${T}, C–G) two.`),
    h("p", `This page uses the Gray-coded labels g(e(x)): A = 00, C = 01, G = 10, ${T} = 11. Both labellings are proved; the other chapters keep the raw codes A = 00, C = 01, G = 11, ${T} = 10.`),
    stage, readout,
    h("div.legend", h("span", h("i", { style: { background: "var(--flip)" } }), "transition, 1 bit"), h("span", h("i", { style: { background: "var(--ink-3)" } }), "transversion, 1 bit"), h("span", h("i", { style: { background: "var(--teal)" } }), "complement, 2 bits (diagonal)")),
    h("p", `Complementary bases always XOR to 11: flipping both bits turns a strand into its complement. In the square, that is the jump across a diagonal.`),
    h("h2", `Along chain ${ctx.chain.id}`),
    h("section.stage", { "aria-label": "Steps between consecutive bases" }, h("div", { html: bars }),
      h("div.cap", `${int(n)} steps between consecutive bases${ctx.chain.strands ? ", within each strand" : ""}, by their relation on the square.`)),
    tags([["lean", "A–T and C–G differ in both bits"], ["lean", "transitions flip one bit"], ["lean", "Watson–Crick partners two bits apart"], ["data", `your chain: ${int(n)} steps`]]),
    theoremBlock("0110", ["KmapProofs.encode_complement_AT", "KmapProofs.transition_AG", "KmerIndexing.complement_distance_2", "KmerIndexing.transition_distance_1"]),
    nextStep(ctx, "Sequence was the warm-up. Next: the molecule's 3D contacts, as a Boolean function."));
  draw();
  return null;
}

export default {
  mount(el, ctx) { this._off = ctx.chain.entityType === "protein" ? proteinCube(el, ctx) : nucleotideSquare(el, ctx); },
  unmount() { this._off?.(); },
};
