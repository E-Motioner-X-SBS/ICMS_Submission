// 1110 What the code can and cannot see: GF(2) linearity, the lex ↔ Gray permutation,
// and the one thing Gray coding does change, Hamming distance.
import { h, theoremBlock, tags, nextStep, css, inkOn, stageWidth, reducedMotion, add } from "../ui.js";
import { gray, bits, ham, encodeSequence, kmerCounts, AA_ORDER, AA_RAW, NUC_RAW, NUC_GRAYNAT, letterVar, alphabet } from "../core/encoding.js";
import { barsSVG } from "../viz/maps.js";
import { chainSegments } from "../core/contacts.js";
import { int, pct } from "../core/format.js";

function linearity() {
  let x = 0b10110, y = 0b01101;
  const W = 5;
  const rowX = h("div.bitbox.tap"), rowY = h("div.bitbox.tap");
  const out = h("div.eq", { style: { whiteSpace: "pre" } }), ok = h("div.readout", { "aria-live": "polite" });
  const toggles = (row, get, set) => row.replaceChildren(...[...bits(get(), W)].map((b, k) => h(`span${b === "1" ? ".one" : ""}`, { role: "button", tabindex: 0, "aria-label": `bit ${W - 1 - k} is ${b}, tap to flip`,
    on: { click: () => { set(get() ^ (1 << (W - 1 - k))); paint(); }, keydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); set(get() ^ (1 << (W - 1 - k))); paint(); } } } }, b)));
  function paint() {
    toggles(rowX, () => x, (v) => (x = v)); toggles(rowY, () => y, (v) => (y = v));
    const lhs = gray(x ^ y), rhs = gray(x) ^ gray(y);
    out.textContent = `x ⊕ y          = ${bits(x ^ y, W)}\ng(x ⊕ y)       = ${bits(lhs, W)}\ng(x)           = ${bits(gray(x), W)}\ng(y)           = ${bits(gray(y), W)}\ng(x) ⊕ g(y)    = ${bits(rhs, W)}`;
    ok.replaceChildren(lhs === rhs ? h("b", { style: { color: "var(--ok)" } }, "✓ equal") : h("b", { style: { color: "var(--bad)" } }, "✗ differ"), ` for x = ${x}, y = ${y}. Lean checks all 1,024 pairs.`);
  }
  paint();
  return h("section.stage", { "aria-label": "Gray code is linear over GF(2)" },
    h("div.cmp", h("span.lab", "x"), rowX, h("span.lab", "y"), rowY), h("div.cap", "Tap bits to change x and y."),
    h("div", { style: { marginTop: "10px" } }, out), h("div", { style: { marginTop: "8px" } }, ok));
}

/** The visitor's map in lexicographic and in Gray addresses: same cells, permuted. */
function permutation(ctx) {
  const type = ctx.chain.entityType, isProt = type === "protein";
  const holder = h("div.perm", { "data-noswipe": "" });
  const stage = h("section.stage.white", { "aria-label": "Lexicographic and Gray addresses of the same cells" });
  let gray_ = false;
  const btn = h("button.btn.small", { type: "button" }, "Show Gray addresses");
  let items, R, C, rowsOf, colsOf, lexArr, grayArr;
  if (isProt) {
    // 20 residues; address = raw index (lex, the group order) or gray(raw index) (the code)
    const lexCounts = new Array(32).fill(0);
    for (const l of ctx.chain.seq) if (l in AA_RAW) lexCounts[AA_RAW[l]]++;
    R = 4; C = 8;
    items = AA_ORDER.map((a) => ({ label: a, n: lexCounts[AA_RAW[a]], lex: AA_RAW[a], gry: gray(AA_RAW[a]), colour: css(letterVar(a, "protein")) }));
    lexArr = lexCounts; grayArr = [...kmerCounts(ctx.chain.seq, 1, "protein").counts];      // the pipeline's own Gray map
    rowsOf = (addr) => addr >> 3; colsOf = (addr) => addr & 7;
  } else {
    // dinucleotides XY; lex index A C G T = 0 1 2 3, Gray index g(i) = raw code
    const LEX = ["A", "C", "G", type === "rna" ? "U" : "T"];
    const seq = ctx.chain.seq;
    const counts = new Map();
    const { breaks } = chainSegments(ctx.chain);
    for (let i = 0; i + 1 < seq.length; i++) { if (breaks.has(i + 1)) continue; const d = seq.slice(i, i + 2); if (LEX.includes(d[0]) && LEX.includes(d[1])) counts.set(d, (counts.get(d) || 0) + 1); }
    R = 4; C = 4; items = [];
    LEX.forEach((X, i) => LEX.forEach((Y, j) => items.push({ label: X + Y, n: counts.get(X + Y) || 0, lex: 4 * i + j, gry: 4 * gray(i) + gray(j) })));
    lexArr = items.map((t) => t.n); grayArr = [...kmerCounts(seq, 2, type, breaks).counts];              // the pipeline's own Gray map
    rowsOf = (addr) => addr >> 2; colsOf = (addr) => addr & 3;
  }
  const max = Math.max(1, ...items.map((t) => t.n));
  const ramp = (v) => css(`--cell-${v ? Math.min(6, 1 + Math.floor((v / max) * 5.999)) : 0}`);
  function layout() {
    const W = Math.min(stageWidth(stage) - 28, 520), lab = 30, cell = Math.floor((W - lab) / C);
    holder.style.height = `${lab + R * cell}px`; holder.style.width = `${lab + C * cell}px`;
    if (!holder.childElementCount) {
      for (let c = 0; c < C; c++) holder.append(h("span.axl", { "data-c": c }, bits(c, C === 8 ? 3 : 2)));
      for (let r = 0; r < R; r++) holder.append(h("span.axl", { "data-r": r }, bits(r, 2)));
      for (const t of items) {
        const bg = isProt ? t.colour : ramp(t.n);
        const el = h("span.cell", { title: `${t.label}: ${t.n}`, style: { background: bg, color: inkOn(bg.startsWith("#") ? bg : "#ffffff") } }, isProt ? `${t.label}·${t.n}` : `${t.label}`);
        t.el = el; holder.append(el);
      }
    }
    holder.querySelectorAll(".axl").forEach((a) => {
      if (a.dataset.c !== undefined) Object.assign(a.style, { left: `${lab + +a.dataset.c * cell}px`, top: "0px", width: `${cell}px`, height: `${lab}px` });
      else Object.assign(a.style, { left: "0px", top: `${lab + +a.dataset.r * cell}px`, width: `${lab - 4}px`, height: `${cell}px` });
    });
    for (const t of items) {
      const addr = gray_ ? t.gry : t.lex;
      Object.assign(t.el.style, { left: `${lab + colsOf(addr) * cell + 2}px`, top: `${lab + rowsOf(addr) * cell + 2}px`, width: `${cell - 4}px`, height: `${cell - 4}px`, fontSize: `${Math.max(9, Math.min(13, cell * 0.3))}px` });
    }
    btn.textContent = gray_ ? (isProt ? "Show plain-index addresses" : "Show lexicographic addresses") : "Show Gray addresses";
    cap.replaceChildren(h("b", gray_ ? "Gray addresses. " : isProt ? "Plain-index addresses. " : "Lexicographic (FCGR) addresses. "),
      isProt ? "Each tile is a residue with its count in your chain; the address is its raw index (group order) or its Gray code." : "Each cell is a dinucleotide shaded by its count in your chain; rows are the first base, columns the second.");
  }
  const cap = h("div.cap");
  btn.addEventListener("click", () => { gray_ = !gray_; layout(); });
  stage.append(h("div.row", { style: { justifyContent: "space-between", marginBottom: "8px" } }, h("span.small", "Same cells, two addressings"), btn), h("div.scrollx", holder), cap);
  const sorted = (arr) => [...arr].sort((a, b) => a - b).join();
  const same = sorted(lexArr) === sorted(grayArr);
  setTimeout(layout, 0);
  let auto = null;
  if (!reducedMotion()) auto = setTimeout(() => { gray_ = true; layout(); }, 1400);
  let lastW = 0; const ro = new ResizeObserver(() => { if (Math.abs(stage.clientWidth - lastW) > 8) { lastW = stage.clientWidth; layout(); } }); ro.observe(stage);
  return { stage, same, n: items.length, off: () => { clearTimeout(auto); ro.disconnect(); } };
}

/** What changes: Hamming distance between contact partners. */
function hamming(ctx) {
  const type = ctx.chain.entityType, cm = ctx.derived.contacts();
  const enc = encodeSequence(ctx.chain.seq, type);
  if (type === "protein") {
    let c1 = 0, cn = 0, b1 = 0, bn = 0;
    const isC = new Set(cm.pairs.map(([i, j]) => i * cm.L + j));
    for (let i = 0; i < cm.L; i++) for (let j = i + cm.def.minSep; j < cm.L; j++) {
      const a = enc.codes[i], b = enc.codes[j]; if (a === null || b === null || a === undefined || b === undefined) continue;
      const one = ham(a, b) === 1;
      if (isC.has(i * cm.L + j)) { cn++; c1 += one; } else { bn++; b1 += one; }
    }
    const fc = c1 / Math.max(1, cn), fb = b1 / Math.max(1, bn);
    return h("div",
      h("p", "Gray coding does change one thing: which residues sit one bit apart. That is a property of the code, not of the map's layout, so it is where an experiment can see the encoding."),
      h("section.stage", { "aria-label": "One-bit fraction of contacts" },
        h("div", { html: barsSVG([
          { label: "contacts", value: fc, color: "var(--flip)" },
          { label: "non-contacts", value: fb, color: "var(--ink-3)" },
          { label: "any two residues", value: 0.2, color: "var(--rule)" }], { width: 340, max: 0.4 }) }),
        h("div.cap", h("b", "Share of pairs whose codes differ in one bit. "), `Your chain: ${int(cn)} contacts, ${int(bn)} non-contact pairs at the same minimum separation. Any two residues: 80 of 400 ordered pairs, proved.`)),
      h("p", `In this chain, ${int(c1)} of ${int(cn)} contacts and ${int(b1)} of ${int(bn)} non-contact pairs are one bit apart. Exactly 80 of the 400 ordered pairs of amino acids are one bit apart under this code; a different labelling of the residues would change all three numbers, while leaving every count on the K-map unchanged.`),
      tags([["lean", "80 of 400 pairs one bit apart"], ["lean", "Gray coding changes some distances"], ["data", `your chain: ${int(cn)} contacts, counted`]]));
  }
  // nucleotides: distance between contact partners under the raw labelling and after relabelling
  const T = type === "rna" ? "U" : "T", rawOf = (l) => NUC_RAW[l], grOf = (l) => NUC_GRAYNAT[l];
  const hr = [0, 0, 0], hg = [0, 0, 0]; let n = 0;
  for (const [i, j] of cm.pairs) {
    const a = enc.letters[i], b = enc.letters[j]; if (!(a in NUC_RAW) || !(b in NUC_RAW)) continue;
    hr[ham(rawOf(a), rawOf(b))]++; hg[ham(grOf(a), grOf(b))]++; n++;
  }
  const N = Math.max(1, n);
  return h("div",
    h("p", `Relabelling does change one thing: Hamming distance. With the raw codes, Watson–Crick partners A–${T} (00, 10) and C–G (01, 11) are one bit apart; after Gray relabelling they are two (00, 11 and 01, 10). The map is only permuted, but distances between letters are not preserved.`),
    h("section.stage", { "aria-label": "Distances between contact partners" },
      h("div", { html: barsSVG([0, 1, 2].flatMap((d) => [
        { label: `${d} bit${d === 1 ? "" : "s"}, raw`, value: hr[d] / N, color: "var(--ink-3)" },
        { label: `${d} bit${d === 1 ? "" : "s"}, relabelled`, value: hg[d] / N, color: d === 1 ? "var(--flip)" : "var(--teal)" }]), { width: 340, max: 1 }) }),
      h("div.cap", `Code distance between the two bases of each of the ${int(n)} contacts of chain ${ctx.chain.id}, under each labelling.`)),
    tags([["lean", "Gray coding changes some distances"], ["lean", "A–T and C–G differ in both bits"], ["data", `your chain: ${int(n)} contacts`]]));
}

export default {
  mount(el, ctx) {
    const perm = permutation(ctx);
    this._off = perm.off;
    add(el, 
      h("h1", "What the code can and cannot see"),
      h("p.hook", "The Gray code is linear over GF(2): g(x ⊕ y) = g(x) ⊕ g(y). So it is a relabelling, not a new measurement, and knowing exactly what it can change tells you which results depend on it."),
      linearity(),
      tags([["lean", "g(x ⊕ y) = g(x) ⊕ g(y) for all x, y < 32"], ["lean", "the Gray code is a bijection on 5 bits"]]),
      h("h2", "A Gray map is a permuted lexicographic map"),
      h("p", "Because g is a bijection, a Gray-ordered K-map and the lexicographic map used by chaos-game representations (FCGR) hold exactly the same cells, moved. Any statistic that depends only on the cell values or the distances between maps is identical."),
      perm.stage,
      h("ul.checks", h(`li${perm.same ? "" : ".bad"}`, `Your map, built twice (plain addresses here, Gray addresses by the K-map pipeline of chapter 0010), holds the same multiset of ${perm.n} counts.`)),
      h("p.small#gvl", ""),
      tags([["data", "120 maps, same cell values"], ["data", `your chain: ${perm.n} cells`]]),
      h("h2", "What it does change"),
      hamming(ctx),
      h("h2", "Segments under either numbering"),
      h("p", "Gray-coded positions also turn low-free-bit cubes into unbroken chain segments, but they name different segments than plain binary. Lean proves both facts, so an analysis must fix one numbering and never mix them; this demo uses plain binary for positions throughout."),
      tags([["lean", "a Gray cube is still a segment"], ["lean", "but not the same segment"]]),
      theoremBlock("1110", ["SequenceCircuits.sc_gray_gf2_linear", "SequenceCircuits.sc_gray_bijective_on_5bits", "SequenceCircuits.sc_gray_changes_hamming", "SequenceCircuits.sc_gray_cube_is_also_interval"]),
      nextStep(ctx, "What all of this adds up to."));
    // the 120-map measurement, read from the same summary the poster uses
    fetch(new URL("../../data/exact_summary.json", import.meta.url)).then((r) => r.json()).then((X) => {
      const g = X.grayVsLex, box = el.querySelector("#gvl");
      if (g && box) box.textContent = `On ${g.maps} protein dipeptide maps, the sorted cell values are ${g.sortedValuesIdentical ? "identical" : "not identical"} under both orderings, and hierarchical clustering gives the same cophenetic correlation, ${g.copheneticGray.toFixed(4)} and ${g.copheneticLex.toFixed(4)}.`;
    }).catch(() => { /* offline without the summary: the sentence stays empty */ });
  },
  unmount() { this._off?.(); },
};
