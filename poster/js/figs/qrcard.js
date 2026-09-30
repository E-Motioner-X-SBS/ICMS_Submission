// The invitation: a QR to the interactive demo, framed as a Karnaugh map.
// data/qr.json holds the 41 x 41 module matrix (error correction H) for the demo
// URL. Modules are merged into horizontal runs so the print has no hairline seams.
// Gray-coded labels run along the top and left edges (every fourth module), with
// one neighbouring pair marked orange: the bit that flips between them.
import { mount, el, g, pt, gray, bits, COLORS, FONT, loadJSON } from "../lib.js";

const styleOf = (o) => `font-family:${o.mono ? FONT.mono : FONT.sans};fill:${o.fill || COLORS.ink};${o.mono ? "" : "font-stretch:87.5%;"}`;
const T = (x, y, s, o = {}) => el("text", { x, y, "font-size": o.size, "font-weight": o.weight || 500, "text-anchor": o.anchor, style: styleOf(o) }, [s]);
function S(x, y, parts, o = {}) {
  const t = el("text", { x, y, "font-size": o.size, "text-anchor": o.anchor, style: styleOf(o) });
  for (const [s, p = {}] of parts) t.appendChild(el("tspan", { "font-weight": p.weight || o.weight || 500, style: styleOf({ ...o, ...p }) }, [s]));
  return t;
}

export default async function build(host, { w, h }) {
  const qr = await loadJSON("qr.json");
  const n = qr.size;
  if (qr.rows.length !== n || qr.rows.some((r) => r.length !== n)) throw new Error("qrcard: matrix shape");

  await Promise.all(["700 semi-condensed 20px Archivo", "500 semi-condensed 20px Archivo", '500 20px "Plex Mono"'].map((f) => document.fonts.load(f)));
  const pad = 4.2, fsHead = pt(29), fsSub = pt(20), fsUrl = pt(18), fsLab = pt(18);

  mount(host, w, h, (svg) => {
    // card
    svg.appendChild(el("rect", { x: 0.35, y: 0.35, width: w - 0.7, height: h - 0.7, rx: 5, fill: COLORS.paper, stroke: COLORS.ink, "stroke-width": 0.5 }));
    // headline
    let y = pad + fsHead * 0.82;
    svg.appendChild(T(pad, y, "Run the proofs", { size: fsHead, weight: 700 }));
    y += fsHead * 1.08;
    svg.appendChild(T(pad, y, "on any protein", { size: fsHead, weight: 700 }));

    // QR with a 4-module quiet zone, framed by Gray-coded axis labels
    const labW = fsLab * 2.2;                                 // room for the left labels
    const qz = 4, total = n + 2 * qz;
    const qx = pad + labW, qy = y + fsHead * 0.55 + fsLab * 1.1;
    const side = Math.min(w - 2 * pad - labW, h - pad - qy - fsSub * 2.55);   // square incl. quiet zone
    const m = side / total;
    const ov = m * 0.04;                                      // overlap that closes raster seams
    const code = g({ "aria-label": `QR code linking to ${qr.url}` });
    code.appendChild(el("rect", { x: qx, y: qy, width: side, height: side, fill: COLORS.paper }));
    // every run of dark modules as a sub-path of ONE path: the union is filled as
    // one shape, so neighbouring rows print without anti-aliased seams
    let d = "";
    for (let r = 0; r < n; r++) {
      const row = qr.rows[r];
      for (let c = 0; c < n; ) {
        if (row[c] !== "1") { c++; continue; }
        let e = c; while (e < n && row[e] === "1") e++;
        const x = qx + (qz + c) * m, yy = qy + (qz + r) * m;
        d += `M${x.toFixed(3)},${yy.toFixed(3)}h${((e - c) * m + ov).toFixed(3)}v${(m + ov).toFixed(3)}h${(-(e - c) * m - ov).toFixed(3)}z`;
        c = e;
      }
    }
    code.appendChild(el("path", { d, fill: COLORS.ink }));
    svg.appendChild(code);
    // K-map style labels: 2-bit Gray codes every quarter along each edge
    const ticks = [0, 1, 2, 3];
    const lab = (k) => bits(gray(k), 2);
    const span = n * m / 4;
    ticks.forEach((k) => {
      const cx = qx + qz * m + (k + 0.5) * span;
      const hi = k === 1 || k === 2;                          // 01 -> 11: one flipped bit
      svg.appendChild(T(cx, qy - fsLab * 0.25, lab(k), { size: fsLab, mono: true, anchor: "middle", fill: hi ? COLORS.flip : COLORS.ink3, weight: hi ? 600 : 500 }));
      const cy = qy + qz * m + (k + 0.5) * span;
      svg.appendChild(T(qx - 1.2, cy + fsLab * 0.34, lab(k), { size: fsLab, mono: true, anchor: "end", fill: COLORS.ink3 }));
    });

    // subline and URL
    let sy = qy + side + fsSub * 1.05;
    const sub = ["Pick any structure from the PDB", "and watch each step run."];
    for (const s of sub) { svg.appendChild(T(pad, sy, s, { size: fsSub, fill: COLORS.ink2 })); sy += fsSub * 1.2; }
  }, `Scan to run the proofs on any protein: ${qr.url}`);
}
