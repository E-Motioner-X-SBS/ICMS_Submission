// The invitation: a QR to the interactive demo, framed as a Karnaugh map.
// data/qr.json holds the 41 x 41 module matrix (error correction H) for the demo
// URL. Modules are merged into horizontal runs so the print has no hairline seams.
// Gray-coded labels run along the top and left edges (every fourth module), with
// one neighbouring pair marked orange: the bit that flips between them.
// The centre carries the GitHub mark (the demo is served by GitHub Pages): an 11 x 11 block of
// modules is left light for it, about 7% of the symbol, well inside what error correction H
// restores (preflight.mjs decodes the printed QR at 150 and 50 dpi).
import { mount, el, g, pt, gray, bits, COLORS, FONT, loadJSON } from "../lib.js";

// GitHub mark (octocat), github.com/logos, viewBox 0 0 98 96
const GITHUB_MARK = "M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z";
const CLEAR = 11;                                            // modules kept light around the mark

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
    svg.appendChild(T(pad, y, "Turn any protein", { size: fsHead, weight: 700 }));
    y += fsHead * 1.08;
    svg.appendChild(T(pad, y, "into a circuit", { size: fsHead, weight: 700 }));

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
    const c0 = (n - CLEAR) / 2, c1 = c0 + CLEAR;               // light block for the mark
    if (!Number.isInteger(c0)) throw new Error("qrcard: centre block must be symmetric");
    const dark = (r, c) => qr.rows[r][c] === "1" && !(r >= c0 && r < c1 && c >= c0 && c < c1);
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; ) {
        if (!dark(r, c)) { c++; continue; }
        let e = c; while (e < n && dark(r, e)) e++;
        const x = qx + (qz + c) * m, yy = qy + (qz + r) * m;
        d += `M${x.toFixed(3)},${yy.toFixed(3)}h${((e - c) * m + ov).toFixed(3)}v${(m + ov).toFixed(3)}h${(-(e - c) * m - ov).toFixed(3)}z`;
        c = e;
      }
    }
    code.appendChild(el("path", { d, fill: COLORS.ink }));
    // the GitHub mark, centred in the light block with a one-module margin
    const markS = (CLEAR - 2) * m, mx0 = qx + (qz + c0 + 1) * m, my0 = qy + (qz + c0 + 1) * m;
    const k = markS / 98;
    code.appendChild(el("path", { d: GITHUB_MARK, fill: COLORS.ink, transform: `translate(${mx0.toFixed(3)},${(my0 + (markS - 96 * k) / 2).toFixed(3)}) scale(${k.toFixed(5)})` }));
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
    const sub = ["Any PDB entry, step by step,", "to its rules and inferences."];
    for (const s of sub) { svg.appendChild(T(pad, sy, s, { size: fsSub, fill: COLORS.ink2 })); sy += fsSub * 1.2; }
  }, `Scan to turn any protein into a circuit, with the GitHub mark at the centre: ${qr.url}`);
}
