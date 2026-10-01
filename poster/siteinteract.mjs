// Interaction checks: live search + fetch, taps, re-check all, a too-long chain.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright-core";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../docs");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".cif": "text/plain" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); }).listen(0);
const base = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const page = await ctx.newPage();
const logs = []; page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`)); page.on("console", (m) => { if (m.type() === "error" && !/GL Driver|Failed to load/.test(m.text())) logs.push(m.text()); });
const say = (...a) => console.log(...a);
const text = async (sel) => (await page.locator(sel).first().textContent())?.trim().slice(0, 200);
try {
  if (!process.env.TAIL) {
  await page.goto(base + "#/0000"); await page.waitForTimeout(800);
  await page.fill("input[type=search]", "lysozyme");
  await page.waitForSelector(".results li button", { timeout: 20000 });
  say("search results:", await page.locator(".results li button").count(), "|", await text(".results li button"));
  await page.locator(".results li button").first().click();
  await page.waitForSelector(".seq span", { timeout: 40000 });
  say("loaded:", page.url().split("#")[1], "|", await text("#entry-chip"));
  await page.goto(base + "#/4HHB/A/0000"); await page.waitForSelector(".entry-card", { timeout: 40000 });
  say("4HHB chains:", await page.locator(".chains button").allTextContents());
  await page.locator(".chains button").nth(1).click(); await page.waitForTimeout(600);
  say("chain chosen:", page.url().split("#")[1]);
  await page.goto(base + "#/4HHB/B/0101"); await page.waitForSelector(".blocks-list button, .rounds .error, .note", { timeout: 40000 });
  say("4HHB/B 0101:", await text(".stats"), "|", await page.locator(".blocks-list button").count(), "pairs");
  await page.goto(base + "#/1FNA/A/0011"); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "n plus one" }).click(); say("0011 after +1:", await text(".readout"));
  await page.goto(base + "#/1FNA/A/0010"); await page.waitForTimeout(800);
  const c = page.locator("main canvas").first(); const bb = await c.boundingBox();
  await page.touchscreen.tap(bb.x + bb.width * 0.5, bb.y + bb.height * 0.5); await page.waitForTimeout(200);
  say("0010 tap:", await text(".readout"));
  await page.goto(base + "#/1FNA/A/0110"); await page.waitForTimeout(500);
  await page.locator("main svg g").nth(5).click(); say("0110 tap:", await text(".readout"));
  await page.goto(base + "#/1FNA/A/1100"); await page.waitForTimeout(500);
  await page.locator(".bitbox.tap span").first().click(); say("1100 toggle:", (await page.locator(".readout").first().textContent()).trim());
  await page.getByRole("button", { name: /Show Gray addresses/ }).click(); await page.waitForTimeout(1000); say("1100 perm button now:", await text(".perm ~ * , .stage .btn.small"));
  await page.goto(base + "#/1FNA/A/1101"); await page.waitForTimeout(800);
  const t0 = Date.now(); await page.getByRole("button", { name: /Re-check all/ }).click();
  await page.waitForFunction(() => /hold:/.test([...document.querySelectorAll(".checkall .small")].at(-1)?.textContent || ""), null, { timeout: 300000 });
  say("re-check all:", (await page.locator(".checkall .small").last().textContent()).trim(), `(${((Date.now() - t0) / 1000).toFixed(1)} s wall)`);
  }
  // a chain too long for the live minimiser
  let t1 = Date.now();
  await page.goto(base + "#/1AON/A/0101"); await page.waitForSelector(".error, .blocks-list, .note", { timeout: 120000 });
  say("1AON/A 0101:", await text("#entry-chip"), "|", await text(".stats"), `(${((Date.now() - t1) / 1000).toFixed(1)} s)`);
  t1 = Date.now();
  await page.goto(base + "#/1TAU/A/0101"); await page.waitForSelector(".error, .blocks-list, .note", { timeout: 120000 });
  say("1TAU/A 0101:", await text("#entry-chip"), "|", (await page.locator(".error").count()) ? await text(".error") : await text(".stats"), `(${((Date.now() - t1) / 1000).toFixed(1)} s)`);
  // swipe from 0001 → next
  await page.goto(base + "#/1FNA/A/0001"); await page.waitForTimeout(400);
  await page.evaluate(() => { const t = (type, x) => document.querySelector("h1").dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === "touchend" ? [] : [new Touch({ identifier: 1, target: document.querySelector("h1"), clientX: x, clientY: 300 })], changedTouches: [new Touch({ identifier: 1, target: document.querySelector("h1"), clientX: x, clientY: 300 })] })); t("touchstart", 300); t("touchend", 100); });
  await page.waitForTimeout(600); say("after swipe:", page.url().split("#")[1]);
} catch (e) { say("FAIL", e.message.split("\n")[0]); await page.screenshot({ path: "/tmp/claude-1000/-store-shuvam-E-motioner-X-SBS/9bd3c692-cfe5-4b5a-8cf1-ce5c1a2d74a5/scratchpad/site/fail.png" }); }
say("logs:", logs.length ? logs.join(" | ").slice(0, 800) : "none");
await browser.close(); server.close();
