// The band-A hero: 1fnaA rendered with three.js (render3d/render.mjs, the headless
// still-export route of pdoom-video-sbs), strand pairs coloured as clusters of the
// prime-implicant blocks of its contact map. The key in the free upper-right
// corner is read from the render's sidecar (assets/hero_1fna.json), so its
// colours and residue ranges are exactly those in the picture.
import { mount, el, g, pt, COLORS, FONT } from "../lib.js";

const styleOf = (o) => `font-family:${FONT.sans};fill:${o.fill || COLORS.ink};font-stretch:87.5%;`;
const T = (x, y, s, o = {}) => el("text", { x, y, "font-size": o.size, "font-weight": o.weight || 500, "text-anchor": o.anchor, style: styleOf(o) }, [s]);

export default async function build(host, { w, h }) {
  const meta = await (await fetch("assets/hero_1fna.json")).json();
  if (meta.target !== "1fnaA") throw new Error("hero3d: sidecar is for another target");
  const [pxW, pxH] = meta.px;
  if (Math.abs(pxW / pxH - w / h) > 0.01) throw new Error(`hero3d: image aspect ${pxW}x${pxH} does not match ${w}x${h} mm`);
  if (pxW / w < 11.8) throw new Error("hero3d: image below 300 dpi at print size");
  await document.fonts.load("600 semi-condensed 20px Archivo");

  const clusters = meta.clusters.slice().sort((a, b) => b.nPairs - a.nPairs);
  const fs = pt(20), fsH = pt(21);

  mount(host, w, h, (svg) => {
    svg.appendChild(el("image", { href: "assets/hero_1fna.png", x: 0, y: 0, width: w, height: h, preserveAspectRatio: "xMidYMid meet" }));
    // key, upper right (the QR card covers the lower right)
    const kx = w * 0.665;
    let y = 4 + fsH * 0.8;
    const key = g({ "aria-label": "Strand pairs found as clusters of blocks, with their residue ranges" });
    key.appendChild(T(kx, y, "Strand pairs, found as blocks", { size: fsH, weight: 700 }));
    y += fsH * 1.45;
    for (const c of clusters) {
      key.appendChild(el("rect", { x: kx, y: y - fs * 0.62, width: fs * 1.1, height: fs * 0.62, rx: fs * 0.31, fill: c.color }));
      key.appendChild(T(kx + fs * 1.5, y, `${c.i0 + 1}–${c.i1} with ${c.j0 + 1}–${c.j1}`, { size: fs, weight: 600 }));
      key.appendChild(T(w - 2, y, `${c.nBlocks} ${c.nBlocks === 1 ? "block" : "blocks"}`, { size: fs, anchor: "end", fill: COLORS.ink2 }));
      y += fs * 1.32;
    }
    svg.appendChild(key);
  }, `Fibronectin type-III domain 1fnaA rendered in 3D; ${clusters.length} strand pairs, each a cluster of prime-implicant blocks of its contact map, are coloured.`);
}
