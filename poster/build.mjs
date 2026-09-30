// Render the poster: index.html -> A0 PDF (print) + PNG previews (QA).
//
//   node build.mjs                 PDF + preview PNG
//   node build.mjs --crop x,y,w,h  also a full-resolution crop (mm) for close review
//
// Headless Chrome through playwright-core, the same route pdoom-video-sbs uses
// for its offline renders. The page signals readiness by setting
// window.__posterReady once fonts are loaded and every figure has been generated.

import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";
import http from "node:http";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const W_MM = 841, H_MM = 1189;
const PX_PER_MM = 96 / 25.4;
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

// Serve the folder over HTTP so the figures can fetch their JSON data.
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ttf": "font/ttf", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const file = path.join(here, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(here) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const URL_BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  args: ["--disable-gpu-sandbox", "--font-render-hinting=none"],
});
const page = await browser.newPage({
  viewport: { width: Math.round(W_MM * PX_PER_MM), height: Math.round(H_MM * PX_PER_MM) },
  deviceScaleFactor: Number(arg("--scale") ?? 0.5),
});
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("[page]", m.text()); });
page.on("pageerror", (e) => console.log("[page error]", e.message));

await page.goto(`${URL_BASE}/index.html`);
await page.waitForFunction(() => window.__posterReady === true, null, { timeout: 120000 });

// Overflow audit: any element whose content spills out of its own box, or that
// crosses the page edge, is reported so it can be fixed before printing.
const problems = await page.evaluate(() => {
  const out = [];
  const pageRect = document.querySelector(".poster").getBoundingClientRect();
  for (const el of document.querySelectorAll(".poster *")) {
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const style = getComputedStyle(el);
    if (!el.classList.contains("crop") && el.scrollHeight > el.clientHeight + 2 && ["hidden", "clip"].includes(style.overflowY))
      out.push(`clipped: ${el.className || el.tagName} (${el.scrollHeight} > ${el.clientHeight})`);
    if (r.right > pageRect.right + 1 || r.bottom > pageRect.bottom + 1 || r.left < pageRect.left - 1)
      out.push(`off-page: ${el.className || el.tagName} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  for (const el of document.querySelectorAll("[data-fit]")) {
    if (el.scrollHeight > el.clientHeight + 2) out.push(`overflow: ${el.dataset.fit} (${el.scrollHeight - el.clientHeight}px over)`);
  }
  return out;
});
if (problems.length) console.log("LAYOUT PROBLEMS:\n  " + [...new Set(problems)].slice(0, 60).join("\n  "));
else console.log("layout audit: no overflow, nothing off-page");

const words = await page.evaluate(() => {
  const t = [...document.querySelectorAll(".poster p, .poster li, .poster figcaption, .poster h1, .poster h2, .poster h3, .poster .say")]
    .map((e) => e.innerText).join(" ");
  return t.split(/\s+/).filter(Boolean).length;
});
console.log(`word count (prose, captions, headings): ${words}`);
const extents = await page.evaluate(() => {
  const mm = 25.4 / 96, o = [];
  for (const [k, sel] of [["band A", ".band-a"], ["left col", ".cols .col:first-child"], ["right col", ".cols .col:last-child"], ["band D", ".band-d"], ["footer", ".foot"]]) {
    const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect();
    o.push(`${k} ${Math.round(r.top * mm)}–${Math.round(r.bottom * mm)} mm`);
  }
  return o.join(" · ");
});
console.log(`extents (page 1189 mm, keep ≥ 8 mm margin): ${extents}`);

const out = arg("--out") ?? path.join(here, "..", "SBS_ICMS2026_Poster");
await page.pdf({ path: `${out}.pdf`, width: `${W_MM}mm`, height: `${H_MM}mm`, printBackground: true, preferCSSPageSize: true });
await page.screenshot({ path: path.join(here, "preview.png"), fullPage: false });
console.log(`wrote ${out}.pdf and preview.png`);

const crop = arg("--crop");
if (crop) {
  const [x, y, w, h] = crop.split(",").map(Number);
  const hi = await browser.newPage({
    viewport: { width: Math.round(W_MM * PX_PER_MM), height: Math.round(H_MM * PX_PER_MM) },
    deviceScaleFactor: Number(arg("--crop-scale") ?? 1),
  });
  await hi.goto(`${URL_BASE}/index.html`);
  await hi.waitForFunction(() => window.__posterReady === true, null, { timeout: 120000 });
  await hi.screenshot({ path: path.join(here, "crop.png"),
    clip: { x: x * PX_PER_MM, y: y * PX_PER_MM, width: w * PX_PER_MM, height: h * PX_PER_MM } });
  console.log(`wrote crop.png (${crop} mm)`);
}
await browser.close();
server.close();
