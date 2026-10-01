// 0010 A Karnaugh map of your sequence: k-mer counts on a Gray-ordered grid.
import { h, theoremBlock, tags, nextStep, css, stageWidth, reducedMotion, add } from "../ui.js";
import { kmerCounts, kmapCode, kmapCell, kmerString, gray, bits, alphabet, oneBitNeighbours, neighbourPlacement, CODE_AA, encodeSequence, kmerCode } from "../core/encoding.js";
import { kmapGrid } from "../viz/maps.js";
import { chainSegments } from "../core/contacts.js";
import { int } from "../core/format.js";

const PLACE = { side: "next to it", wrap: "across the wrapped edge", mirror: "mirrored, not drawn adjacent" };

export default {
  mount(el, ctx) {
    const { chain } = ctx, type = chain.entityType, isProt = type === "protein", A = alphabet(type);
    const ks = isProt ? [1, 2] : [1, 2, 3, 4];
    let k = isProt ? 1 : 2, grid = null, km = null, sel = null, timer = null, alive = true, win = -1;
    this._stop = () => { alive = false; clearTimeout(timer); };
    const enc = encodeSequence(chain.seq, type);
    const { breaks } = chainSegments(chain);                   // strand junctions and gaps: no k-mer spans them

    let canvas = h("canvas", { role: "img", "aria-label": "K-map of k-mer counts" });
    const readout = h("div.readout", { "aria-live": "polite" });
    const windowLine = h("div.bitrow", { "data-noswipe": "" });
    const stats = h("div.stats");
    const axisNote = h("p.small");
    const stage = h("section.stage.white", { "aria-label": "K-map of k-mer counts" }, canvas);

    /** Axis labels: letters when an axis holds whole symbols, else bit patterns. */
    function labels(nBits) {
      return Array.from({ length: 1 << nBits }, (_, p) => {
        const v = gray(p);
        if (nBits % A.bits === 0) {
          const syms = []; for (let t = nBits / A.bits - 1; t >= 0; t--) syms.push((v >> (t * A.bits)) & ((1 << A.bits) - 1));
          return syms.map((c) => A.letterOf(c) ?? "·").join("");
        }
        return bits(v, nBits);
      });
    }
    function build() {
      km = kmerCounts(chain.seq, k, type, breaks);
      const sh = km.shape;
      const values = Array.from({ length: sh.rows }, (_, y) => Array.from({ length: sh.cols }, (_, x) => km.counts[kmapCode(x, y, sh)]));
      const letterAxes = sh.rowBits % A.bits === 0 && sh.colBits % A.bits === 0;
      const fresh = h("canvas", { role: "img", "aria-label": `${sh.rows} by ${sh.cols} K-map of ${k}-mer counts` });
      canvas.replaceWith(fresh); canvas = fresh;
      grid = kmapGrid(canvas, {
        values, rowLabels: labels(sh.rowBits), colLabels: labels(sh.colBits), width: stageWidth(stage) - 30, maxCell: 64,
        cellText: (r, c) => { const code = kmapCode(c, r, sh); const s = kmerString(code, k, type); return s.includes("·") ? "" : (k <= 2 ? s : ""); },
        onTap: ({ r, c }) => { stopPlay(); select(kmapCode(c, r, sh)); },
      });
      let best = 0; for (let c = 1; c < km.counts.length; c++) if (km.counts[c] > km.counts[best]) best = c;
      stats.replaceChildren(
        h("div.stat", h("div.v", `${sh.rows} × ${sh.cols}`), h("div.l", `cells: one per ${k}-mer code (${km.totalBits} bits)`)),
        h("div.stat", h("div.v", int(km.windows)), h("div.l", k === 1 ? "letters in the chain" : `overlapping ${k}-mers in the chain`)),
        h("div.stat", h("div.v", int(km.distinct)), h("div.l", k === 1 ? "distinct letters seen" : `distinct ${k}-mers seen`)),
        h("div.stat", h("div.v", `${kmerString(best, k, type)} ×${km.counts[best]}`), h("div.l", "most frequent")));
      axisNote.textContent = letterAxes
        ? `Rows carry the first ${sh.rowBits / A.bits === 1 ? "letter" : `${sh.rowBits / A.bits} letters`}, columns the rest, each axis in Gray order. Darker cells occur more often.`
        : `The ${km.totalBits} bits split ${sh.rowBits} for rows and ${sh.colBits} for columns, so an axis label is a bit pattern rather than whole letters. Darker cells occur more often.`;
      select(sel !== null && sel < km.counts.length ? sel : best);
    }
    function select(code) {
      sel = code;
      const sh = km.shape, me = kmapCell(code, sh);
      const nb = oneBitNeighbours(code, km.totalBits).map((n) => ({ ...n, place: neighbourPlacement(code, n.code, sh) }));
      const colour = { side: css("--teal"), wrap: css("--teal"), mirror: css("--gold") };
      grid.redraw([{ r: me.y, c: me.x, color: css("--flip"), width: 3.5 },
        ...nb.map((n) => { const q = kmapCell(n.code, sh); return { r: q.y, c: q.x, color: colour[n.place], width: n.place === "wrap" ? 2 : 2.5 }; })]);
      const s = kmerString(code, k, type), count = km.counts[code];
      const byPlace = { side: 0, wrap: 0, mirror: 0 }; nb.forEach((n) => byPlace[n.place]++);
      readout.replaceChildren(h("b", s.includes("·") ? "unused codeword" : s), ` = ${bits(code, km.totalBits)}, seen ${count} ${count === 1 ? "time" : "times"}. `,
        h("span.small", `Its ${nb.length} one-bit neighbours: ${byPlace.side} ${PLACE.side}, ${byPlace.wrap} ${PLACE.wrap}${byPlace.mirror ? `, ${byPlace.mirror} ${PLACE.mirror}` : ""}.`));
      neighbourList.replaceChildren(...nb.map((n) => h("li", h("span.mono", bits(n.code, km.totalBits)), " ", h("b", kmerString(n.code, k, type)), h("span.small", ` flips bit ${n.bit}, ${PLACE[n.place]}`))));
    }
    const neighbourList = h("ul.checks", { style: { fontFamily: "var(--sans)" } });

    // walk the sequence: each window lights up its cell
    function showWindow(i) {
      const lo = Math.max(0, i - 6), hi = Math.min(enc.letters.length, i + k + 6);
      windowLine.replaceChildren(lo > 0 ? "…" : "", ...enc.letters.slice(lo, hi).map((l, t) => (lo + t >= i && lo + t < i + k ? h("b.bit-flip", l) : h("span.bit-on", l))), hi < enc.letters.length ? "…" : "");
    }
    const playBtn = h("button.btn.small", { type: "button", on: { click: () => (timer ? stopPlay() : play()) } }, "Walk the sequence");
    function play() {
      playBtn.textContent = "Pause";
      const t = () => {
        if (!alive) return;
        let guard = 0;
        do { win = (win + 1) % Math.max(1, enc.codes.length - k + 1); } while (++guard < enc.codes.length && [...Array(k - 1)].some((_, t) => breaks.has(win + 1 + t)));
        const w = enc.codes.slice(win, win + k);
        showWindow(win);
        if (!w.some((c) => c === null)) select(kmerCode(w, A.bits));
        timer = setTimeout(t, 520);
      };
      t();
    }
    function stopPlay() { clearTimeout(timer); timer = null; playBtn.textContent = "Walk the sequence"; }

    const kSeg = h("div.seg", { role: "group", "aria-label": "k-mer length" }, ks.map((kk) => h("button", { type: "button", "aria-pressed": String(kk === k), on: { click: (e) => {
      k = kk; sel = null; stopPlay(); win = -1; windowLine.replaceChildren();
      [...kSeg.children].forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); build(); } } }, `k = ${kk}`)));

    add(el, 
      h("h1", "A Karnaugh map of your sequence"),
      h("p.hook", "A Karnaugh map is a truth table folded onto a grid. Order the rows and columns by Gray code and any two touching cells differ in exactly one bit, even across the edges, which wrap like a torus."),
      h("p", `Here each cell is one ${k === 1 ? "letter" : "k-mer"} code of chain ${chain.id}, shaded by how often it occurs. Tap a cell to see its one-bit neighbours.`),
      h("div.row", { style: { justifyContent: "space-between" } }, kSeg, playBtn),
      stage,
      h("div.legend", h("span", h("i.ring", { style: { borderColor: "var(--flip)" } }), "selected"), h("span", h("i.ring", { style: { borderColor: "var(--teal)" } }), "one bit away, drawn adjacent (or across the edge)"),
        h("span", h("i.ring", { style: { borderColor: "var(--gold)" } }), "one bit away, mirrored (axes of 3+ bits)")),
      windowLine, readout, axisNote, stats,
      h("details.thm-more", h("summary", "All one-bit neighbours of the selected cell"), neighbourList),
      h("h2", "Why the fold matters"),
      h("p", "Two k-mers that differ in a single bit of their code sit next to each other or, on axes of three or more bits, at mirrored positions. So a pattern that ignores one bit is a pair of one-bit neighbours, and one that ignores two bits a 2 × 2 group: the cubes that minimisation (chapter 0101) finds."),
      isProt ? h("p.note", "Lean proves the nucleotide k-mer encodings injective and the 2 × 2 layout. The protein map uses the same Gray-ordered construction on the 5-bit amino-acid codes, whose encoding is proved too. The 12 unused codewords stay empty.") : null,
      tags(isProt ? [["lean", "20 residues, 20 distinct codes"], ["lean", "one substitution changes 1 or 2 bits"], ["data", "your chain's k-mer counts"]]
        : [["lean", "16 dinucleotides, 16 cells"], ["lean", "256 tetranucleotides, 256 cells"], ["lean", "one substitution changes 1 or 2 bits"], ["data", "your chain's k-mer counts"]]),
      theoremBlock("0010", ["KmerIndexing.dinucEncode_injective", "KmerIndexing.nucCell_adj_AC", "KmerIndexing.tetranucEncode_injective", "KmerIndexing.gray_code_preserves_adjacency"]),
      nextStep(ctx, isProt ? "The protein code puts 20 residues on a five-dimensional cube. Which ones are neighbours?" : "Where do complementary and transition pairs sit on the code's square?"));
    build();
    if (!reducedMotion()) setTimeout(() => alive && !timer && play(), 900);
    let rt = null, lastW = stage.clientWidth;
    this._ro = new ResizeObserver(() => { if (Math.abs(stage.clientWidth - lastW) < 8) return; lastW = stage.clientWidth; clearTimeout(rt); rt = setTimeout(() => alive && build(), 150); });
    this._ro.observe(stage);
  },
  unmount() { this._stop?.(); this._ro?.disconnect(); },
};
