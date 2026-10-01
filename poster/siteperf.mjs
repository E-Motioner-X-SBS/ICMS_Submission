// How fast does each chapter of each bundled example open? Walks the chapters in order, the way a
// visitor presses Next, on a phone profile with the CPU slowed down, and reports per chapter: the
// time until the chapter has no spinner left, the main-thread long tasks in that window (total and
// longest), and the requests it made.
//   node siteperf.mjs [entries...]      CPU=4 (slow-down factor), BASE=<url> (default: serve ../docs,
//                                        or ROOT=<dir>), LAT=<ms> KBPS=<kbit/s> to slow the network
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(process.env.ROOT || path.join(path.dirname(new URL(import.meta.url).pathname), "../docs"));
const entries = process.argv.slice(2).length ? process.argv.slice(2) : ["1FNA/A", "1UBQ/A", "2CI2/I", "1BNA/A+B", "1EHZ/A"];
const CPU = Number(process.env.CPU || 4);
const STEPS = ["0001", "0011", "0010", "0110", "0111", "0101", "0100", "1100", "1101", "1111", "1110", "1010"];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".cif": "text/plain", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
let base = process.env.BASE, server = null;
if (!base) {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  base = `http://localhost:${server.address().port}/`;
}
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const rows = [];
// FLOW=home: open the home page fresh, read it for READ ms, tap an example card, time its first chapter
if (process.env.FLOW === "home") {
  for (const entry of entries) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    if (process.env.LAT) { const k = Number(process.env.KBPS || 1600) * 125; await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: Number(process.env.LAT), downloadThroughput: k, uploadThroughput: k }); }
    await page.goto(base + "#/0000");
    await page.waitForSelector(".examples button.ex");
    await page.waitForTimeout(Number(process.env.READ || 3000));
    const id = entry.split("/")[0];
    const t0 = await page.evaluate(() => performance.now());
    await page.locator(".examples button.ex", { hasText: id }).first().click();
    await page.waitForFunction(() => /\/0001$/.test(location.hash) && document.querySelector("#chapter h1") && !document.querySelector("#chapter .loading, #chapter .spinner"), null, { timeout: 120000, polling: "raf" });
    rows.push({ entry, step: "tap", ms: (await page.evaluate(() => performance.now())) - t0, longTotal: 0, longMax: 0, reqs: 0 });
    await ctx.close();
  }
  entries.length = 0;
}
for (const entry of entries) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
  if (process.env.LAT) {
    const kbps = Number(process.env.KBPS || 1600) * 1000 / 8;
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: Number(process.env.LAT), downloadThroughput: kbps, uploadThroughput: kbps });
  }
  let reqs = 0;
  page.on("request", () => reqs++);
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  });
  const [id, chain] = entry.split("/");
  const ready = () => page.waitForFunction(() => {
    const m = document.querySelector("#chapter");
    return m && m.querySelector("h1") && !m.querySelector(".loading, .spinner");
  }, null, { timeout: 120000, polling: "raf" });
  for (const [k, step] of STEPS.entries()) {
    reqs = 0;
    const t0 = await page.evaluate(() => performance.now()).catch(() => 0);
    const hash = `#/${id}/${encodeURIComponent(chain)}/${step}`;
    if (k === 0) await page.goto(base + hash); else await page.evaluate((hh) => { location.hash = hh; }, hash);
    const start = k === 0 ? 0 : t0;
    await ready();
    await page.waitForTimeout(250);                       // let deferred drawing land
    const r = await page.evaluate((s) => {
      const now = performance.now(), lt = window.__long.filter(([t]) => t >= s);
      return { ms: now - s - 250, longTotal: lt.reduce((a, [, d]) => a + d, 0), longMax: Math.max(0, ...lt.map(([, d]) => d)) };
    }, start);
    rows.push({ entry, step, ...r, reqs });
  }
  await ctx.close();
}
await browser.close(); server?.close();
const f = (v) => String(Math.round(v)).padStart(6);
console.log(`${process.env.LAT ? `network ${process.env.LAT} ms, ${process.env.KBPS || 1600} kbit/s; ` : ""}CPU slowed ${CPU}x, phone profile. ms = until no spinner; long = main-thread long tasks (total / longest)`);
console.log("entry      step      ms   long   max  reqs");
for (const r of rows) console.log(`${r.entry.padEnd(10)} ${r.step}  ${f(r.ms)} ${f(r.longTotal)} ${f(r.longMax)} ${String(r.reqs).padStart(5)}`);
const worst = [...rows].sort((a, b) => b.longMax - a.longMax).slice(0, 8);
console.log("\nlongest blocking tasks:", worst.map((r) => `${r.entry} ${r.step} ${Math.round(r.longMax)} ms`).join(", "));
