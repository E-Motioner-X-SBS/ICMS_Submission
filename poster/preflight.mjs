// Print preflight for the A0 poster PDF.
//   node preflight.mjs [../SBS_ICMS2026_Poster.pdf]
// Checks: page size = 841 x 1189 mm; every font embedded; raster images >= 200 ppi at
// placed size; the QR code decodes to the demo URL from a 150 dpi raster of the page
// (and from a 50 dpi raster, a stand-in for scanning from a distance).
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { PNG } from "pngjs"; import jsQR from "jsqr";
const pdf = path.resolve(process.argv[2] ?? "../SBS_ICMS2026_Poster.pdf");
const want = JSON.parse(fs.readFileSync(new URL("./data/qr.json", import.meta.url))).url;
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fail++; };

const info = execFileSync("pdfinfo", [pdf]).toString();
const [, wpt, hpt] = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
const wmm = (wpt / 72) * 25.4, hmm = (hpt / 72) * 25.4;
ok(Math.abs(wmm - 841) < 1 && Math.abs(hmm - 1189) < 1, `page ${wmm.toFixed(1)} x ${hmm.toFixed(1)} mm (A0 841 x 1189)`);
ok(/Pages:\s+1\b/.test(info), "single page");

const fonts = execFileSync("pdffonts", [pdf]).toString().trim().split("\n").slice(2);
const notEmb = fonts.filter((l) => { const c = l.trim().split(/\s+/); return c[c.length - 5] !== "yes"; });
ok(notEmb.length === 0, `${fonts.length} fonts, all embedded${notEmb.length ? " — NOT embedded: " + notEmb.join(" | ") : ""}`);

const imgs = execFileSync("pdfimages", ["-list", pdf]).toString().trim().split("\n").slice(2)
  .map((l) => l.trim().split(/\s+/)).map((c) => ({ w: +c[3], h: +c[4], xppi: +c[12], yppi: +c[13] }));
const low = imgs.filter((i) => Math.min(i.xppi, i.yppi) < 200);
ok(low.length === 0, `${imgs.length} raster images, all >= 200 ppi${low.length ? " — low: " + JSON.stringify(low) : ""}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "preflight-"));
for (const dpi of [150, 50]) {
  execFileSync("pdftoppm", ["-png", "-r", String(dpi), "-singlefile", pdf, path.join(tmp, `p${dpi}`)]);
  const png = PNG.sync.read(fs.readFileSync(path.join(tmp, `p${dpi}.png`)));
  // scan the top half (the QR card sits in band A) in overlapping tiles so jsQR sees one code at a time
  let found = null;
  const tile = Math.round(png.width / 3), step = Math.round(tile / 2);
  for (let y = 0; y + tile <= png.height / 2 + tile && !found; y += step)
    for (let x = 0; x + tile <= png.width && !found; x += step) {
      const w = Math.min(tile, png.width - x), h = Math.min(tile, png.height - y), buf = new Uint8ClampedArray(w * h * 4);
      for (let r = 0; r < h; r++) buf.set(png.data.subarray(((y + r) * png.width + x) * 4, ((y + r) * png.width + x + w) * 4), r * w * 4);
      const q = jsQR(buf, w, h); if (q) found = q.data;
    }
  ok(found === want, `QR at ${dpi} dpi decodes to ${found === null ? "(nothing)" : JSON.stringify(found)}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail ? `\n${fail} check(s) failed` : "\npreflight clean");
process.exit(fail ? 1 : 0);
