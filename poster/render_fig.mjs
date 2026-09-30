// Render one figure in isolation for review:
//   node render_fig.mjs <name> <w_mm> <h_mm> [px_per_mm=4]   -> figs_png/<name>.png
// Reports console errors, and any SVG <text> that overflows the figure box or
// overlaps another <text> (bounding-box test), so layout faults surface early.
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path"; import http from "node:http"; import fs from "node:fs";
const here = path.dirname(fileURLToPath(import.meta.url));
const [name, w, h, ppm = "4"] = process.argv.slice(2);
if (!name || !w || !h) { console.error("usage: node render_fig.mjs <name> <w_mm> <h_mm> [px_per_mm]"); process.exit(2); }
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".tsv": "text/plain" };
const server = http.createServer((req, res) => {
  const f = path.join(here, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(here) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] ?? "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--font-render-hinting=none"] });
const PX = 96 / 25.4;
const page = await browser.newPage({ viewport: { width: Math.ceil((+w + 12) * PX), height: Math.ceil((+h + 12) * PX) }, deviceScaleFactor: (+ppm) / PX });
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log("[console]", m.text()); });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/figtest.html?fig=${name}&w=${w}&h=${h}`);
await page.waitForFunction(() => window.__posterReady === true, null, { timeout: 60000 });
const report = await page.evaluate(() => {
  const host = document.querySelector(".fig-host"); const hb = host.getBoundingClientRect(); const out = [];
  const texts = [...host.querySelectorAll("svg text")].map((t) => ({ t, b: t.getBoundingClientRect(), s: t.textContent.trim() })).filter((o) => o.s && o.b.width > 0);
  for (const o of texts) if (o.b.left < hb.left - 1 || o.b.right > hb.right + 1 || o.b.top < hb.top - 1 || o.b.bottom > hb.bottom + 1)
    out.push(`text outside figure box: "${o.s.slice(0, 40)}"`);
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i].b, b = texts[j].b;
    const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left), iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ix > 1.5 && iy > 1.5 && ix * iy > 0.15 * Math.min(a.width * a.height, b.width * b.height))
      out.push(`text overlap: "${texts[i].s.slice(0, 30)}" × "${texts[j].s.slice(0, 30)}"`);
  }
  // effective size = user-unit font size × (CSS px per user unit) → pt
  const effPt = (t) => parseFloat(getComputedStyle(t).fontSize) * t.getScreenCTM().a * (72 / 96);
  const small = texts.filter((o) => effPt(o.t) < 17.5).map((o) => `${o.s.slice(0, 20)} (${effPt(o.t).toFixed(1)}pt)`);
  if (small.length) out.push(`text below 18 pt (too small for A0 at 1 m): ${[...new Set(small)].slice(0, 8).join(" | ")}`);
  return { title: document.title, out, nText: texts.length };
});
fs.mkdirSync(path.join(here, "figs_png"), { recursive: true });
const outPng = path.join(here, "figs_png", `${name}.png`);
await page.screenshot({ path: outPng, clip: await page.evaluate(() => { const r = document.querySelector(".fig-host").getBoundingClientRect(); return { x: r.left - 2, y: r.top - 2, width: r.width + 4, height: r.height + 4 }; }) });
console.log(report.title === "ERROR" ? "FIGURE ERROR (see console above)" : `rendered ${name}: ${report.nText} text elements`);
console.log(report.out.length ? "ISSUES:\n  " + report.out.slice(0, 40).join("\n  ") : "no text overflow/overlap/size issues detected");
console.log(`png: ${outPng}`);
await browser.close(); server.close();
