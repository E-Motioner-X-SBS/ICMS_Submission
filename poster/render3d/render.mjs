// Render the band-A hero still of 1fnaA with three.js in headless Chrome
// (software WebGL through SwiftShader), the still-export route of pdoom-video-sbs:
// the page renders into a float accumulation target, the pixels come back to
// Node and are written as a straight-alpha PNG with pngjs.
//
//   node render3d/render.mjs                         -> assets/hero_1fna.png (+ .json sidecar)
//   node render3d/render.mjs --w 1200 --h 640 --amb 24 --key 8 --out /tmp/x.png   (quick look)
// Any other --key value pair is passed to render3d/scene.js as a query parameter
// (roll, yaw, tilt, fit, align, fov, rb, rc, rr, orad, othr, fog, wamb, wkey, ...).
//
// The sidecar JSON lists, for every strand-pair cluster, projected image
// positions (fractions of width/height, y down) of points on its segments and
// rungs with a visibility flag, the termini, and a coarse coverage mask, so the
// SVG overlay (js/figs/hero3d.js) can place leader lines on visible structure.
import { chromium } from "playwright-core";
import { PNG } from "pngjs";
import { fileURLToPath } from "node:url";
import path from "node:path"; import http from "node:http"; import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i += 2) opts[argv[i].replace(/^--/, "")] = argv[i + 1];
// 300 x 160 mm at 12 px/mm = 304.8 dpi
const defaults = { w: 3600, h: 1920, amb: 224, key: 64 };
const params = { ...defaults, ...opts };
const out = path.resolve(root, params.out ?? "assets/hero_1fna.png");
delete params.out;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] ?? "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log("[console]", m.text()); });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
const qs = new URLSearchParams(params).toString();
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${server.address().port}/render3d/scene.html?${qs}`);
await page.waitForFunction(() => window.__done === true, null, { timeout: 30 * 60 * 1000, polling: 500 });
const err = await page.evaluate(() => window.__error);
if (err) { console.error("SCENE ERROR\n" + err); await browser.close(); server.close(); process.exit(1); }
const { w, h, passes, ms, meta } = await page.evaluate(() => { const r = window.__result; return { w: r.w, h: r.h, passes: r.passes, ms: r.ms, meta: r.meta }; });

// pull the RGBA buffer in row chunks (base64), flip bottom-up rows
const rowsPer = 128;
const png = new PNG({ width: w, height: h, colorType: 6 });
for (let y0 = 0; y0 < h; y0 += rowsPer) {
  const n = Math.min(rowsPer, h - y0);
  const b64 = await page.evaluate(([y0, n]) => {
    const r = window.__result; const s = r.buf.subarray(y0 * r.w * 4, (y0 + n) * r.w * 4);
    let bin = ""; for (let i = 0; i < s.length; i += 0x8000) bin += String.fromCharCode.apply(null, s.subarray(i, i + 0x8000));
    return btoa(bin);
  }, [y0, n]);
  const chunk = Buffer.from(b64, "base64");
  for (let r = 0; r < n; r++) chunk.copy(png.data, (h - 1 - (y0 + r)) * w * 4, r * w * 4, (r + 1) * w * 4);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(png, { colorType: 6 }));

// coarse coverage mask: cols x rows cells, 1 where any pixel has alpha > 0.1
const MC = 150, MR = Math.round((MC * h) / w);
const mask = [];
for (let r = 0; r < MR; r++) {
  let row = "";
  for (let c = 0; c < MC; c++) {
    let on = 0;
    const x0 = Math.floor((c * w) / MC), x1 = Math.floor(((c + 1) * w) / MC), y0 = Math.floor((r * h) / MR), y1 = Math.floor(((r + 1) * h) / MR);
    for (let y = y0; y < y1 && !on; y += 2) for (let x = x0; x < x1; x += 2) if (png.data[(y * w + x) * 4 + 3] > 25) { on = 1; break; }
    row += on;
  }
  mask.push(row);
}
const side = out.replace(/\.png$/, ".json");
fs.writeFileSync(side, JSON.stringify({ ...meta, image: path.basename(out), px: [w, h], params, mask: { cols: MC, rows: MR, rows01: mask } }));
console.log(`rendered ${w}x${h}, ${passes} passes, GPU ${(ms / 1000).toFixed(1)} s, total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`png: ${out}\njson: ${side}`);
await browser.close(); server.close();
