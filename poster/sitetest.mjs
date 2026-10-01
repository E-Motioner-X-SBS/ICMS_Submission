// Drive the demo site in headless Chrome: every chapter, phone and desktop, several entries.
// usage: node sitetest.mjs <outdir> [entries...]   entries like 1FNA/A 1BNA/A+B 1EHZ/A
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../docs");
const out = process.argv[2];
const entries = process.argv.slice(3).length ? process.argv.slice(3) : ["1FNA/A"];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".cif": "text/plain", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".lean": "text/plain", ".tsv": "text/plain" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const STEPS = ["0000", "0001", "0011", "0010", "0110", "0111", "0101", "0100", "1100", "1101", "1111", "1110", "1010"];
const views = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const only = process.env.VIEW ? [process.env.VIEW] : Object.keys(views);
const stepsOnly = process.env.STEPS ? process.env.STEPS.split(",") : STEPS;
let problems = 0;
for (const v of only) {
  const context = await browser.newContext({ ...views[v], reducedMotion: process.env.MOTION ? "no-preference" : "reduce", colorScheme: process.env.DARK ? "dark" : "light" });
  const page = await context.newPage();
  const logs = [];
  page.on("console", (m) => { if ((m.type() === "error" || m.type() === "warning") && !/GL Driver Message|Failed to load resource/.test(m.text())) logs.push(`${m.type()}: ${m.text()}`); });
  page.on("response", (r) => { if (r.status() >= 400) logs.push(`http ${r.status()}: ${r.url()}`); });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => { if (!r.url().includes("rcsb") && !r.url().includes("ebi")) logs.push(`requestfailed: ${r.url()}`); });
  for (const entry of entries) {
    for (const step of stepsOnly) {
      logs.length = 0;
      await page.goto(`http://localhost:${port}/#/${entry.split("/")[0]}/${encodeURIComponent(entry.split("/")[1])}/${step}`);
      await page.waitForTimeout(["0101", "0100", "1100", "1101", "1010"].includes(step) ? 3500 : 1600);
      const info = await page.evaluate(() => {
        const errs = [...document.querySelectorAll(".error")].map((e) => e.textContent.slice(0, 160));
        const over = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth;
        const mr = document.querySelector("main").getBoundingClientRect().right;
        const inScroller = (e) => { for (let p = e.parentElement; p && p.tagName !== "MAIN"; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === "auto" || ox === "scroll" || ox === "hidden") return true; } return false; };
        const wide = [...document.querySelectorAll("main *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > Math.min(mr, window.innerWidth) + 1 && !inScroller(e); }).slice(0, 5).map((e) => `${e.tagName}.${[...e.classList].join(".")} right=${Math.round(e.getBoundingClientRect().right)}`);
        return { title: document.title, errs, over, wide, h: document.documentElement.scrollHeight };
      });
      const tag = `${v} ${entry} ${step}`;
      const bad = info.errs.length || info.over > 0 || info.wide.length || logs.length;
      if (bad) problems++;
      console.log(`${bad ? "!!" : "ok"} ${tag}  h=${info.h}${info.errs.length ? "  ERR " + info.errs.join(" | ") : ""}${info.over > 0 ? "  OVERFLOW " + info.over : ""}${info.wide.length ? "  WIDE " + info.wide.join(", ") : ""}${logs.length ? "  LOG " + logs.join(" | ").slice(0, 600) : ""}`);
      if (out) await page.screenshot({ path: path.join(out, `${v}_${entry.replace(/[/+]/g, "_")}_${step}.png`), fullPage: true });
    }
  }
  await context.close();
}
await browser.close(); server.close();
console.log(problems ? `${problems} problem pages` : "all clean");
