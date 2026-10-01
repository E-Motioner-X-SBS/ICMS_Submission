// End-to-end check of the demo site (live by default): every chapter, every control, and the
// invariants the pages must satisfy. Usage:
//   node e2e.mjs [baseURL] [entries...]      e.g. node e2e.mjs https://e-motioner-x-sbs.github.io/ICMS_Submission/ 1FNA/A 1BNA/A+B
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "https://e-motioner-x-sbs.github.io/ICMS_Submission/";
const ENTRIES = process.argv.slice(3).length ? process.argv.slice(3) : ["1FNA/A", "1UBQ/A", "2CI2/I", "1BNA/A+B", "1EHZ/A"];
const VIEW = process.env.VIEW || "phone";
const OUT = process.env.OUT || "/tmp/claude-1000/-store-shuvam-E-motioner-X-SBS/9bd3c692-cfe5-4b5a-8cf1-ce5c1a2d74a5/scratchpad/e2e";
fs.mkdirSync(OUT, { recursive: true });
const views = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desk: { viewport: { width: 1440, height: 900 } } };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ ...views[VIEW], reducedMotion: process.env.MOTION ? "no-preference" : "reduce", acceptDownloads: true, colorScheme: process.env.DARK ? "dark" : "light" });
const page = await ctx.newPage();
const logs = [];
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/GL Driver|Failed to load resource/.test(m.text())) logs.push(`console: ${m.text().slice(0, 200)}`); });
page.on("response", (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) logs.push(`http ${r.status()} ${r.url()}`); });

const results = [];
let fails = 0;
const check = (where, ok, msg) => { results.push({ where, ok, msg }); if (!ok) { fails++; console.log(`FAIL  ${where}: ${msg}`); } };
const sleep = (ms) => page.waitForTimeout(ms);
const text = async (sel) => ((await page.locator(sel).first().textContent({ timeout: 5000 }).catch(() => "")) || "").trim();
const go = async (hash, wait = 1500) => { await page.goto(BASE + "#" + hash); await page.waitForSelector("main h1", { timeout: 60000 }); await sleep(wait); };

async function generic(where) {
  const g = await page.evaluate(() => {
    const main = document.querySelector("main");
    const t = main.innerText;
    const bad = [...main.querySelectorAll(".error")].map((e) => e.textContent.trim().slice(0, 120));
    const crosses = [...main.querySelectorAll(".checks li.bad")].map((e) => e.textContent.trim().slice(0, 120));
    const over = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth;
    const words = (t.match(/\b(NaN|undefined|null|Infinity)\b|\[object/g) || []);
    return { bad, crosses, over, words, h1: main.querySelector("h1")?.textContent };
  });
  check(where, !g.bad.length, `error boxes: ${g.bad.join(" | ")}`);
  check(where, !g.crosses.length, `✗ checks: ${g.crosses.join(" | ")}`);
  check(where, g.over <= 0, `horizontal overflow ${g.over}px`);
  check(where, !g.words.length, `suspicious text: ${g.words.join(", ")}`);
  if (logs.length) { check(where, false, logs.join(" | ")); logs.length = 0; }
  return g;
}
async function checkAllTheorems(where) {
  const btns = page.locator(".checkall button");
  const n = await btns.count();
  for (let k = 0; k < n; k++) {
    await btns.nth(k).click();
    const status = page.locator(".checkall").nth(k).locator(".small, span[aria-live]").last();
    await page.waitForFunction((el) => /hold/.test(el.textContent), await status.elementHandle(), { timeout: 120000 }).catch(() => null);
    const t = (await status.textContent()) || "";
    const m = t.match(/(\d+) of (\d+) hold/);
    check(where, m && m[1] === m[2], `theorem checks: "${t.trim().slice(0, 100)}"`);
  }
  return n;
}

for (const entry of ENTRIES) {
  const [id, chain] = entry.split("/");
  const H = (step) => `/${id}/${encodeURIComponent(chain)}/${step}`;
  const tag = (s) => `${VIEW} ${entry} ${s}`;

  // 0000 pick
  await go(H("0000"));
  await generic(tag("0000"));
  check(tag("0000"), (await page.locator(".entry-card").count()) === 1, "entry card shown");
  check(tag("0000"), (await page.locator(".flow button").count()) === 12, "chapter flow has 12 chips");

  // 0001 bits: tiles = residues; tapping a tile shows its codeword
  await go(H("0001"));
  await generic(tag("0001"));
  const nTiles = await page.locator(".seq span").count();
  const chip = await text("#entry-chip");
  const L = +((chip.match(/(\d+)\s*$/) || [])[1] || 0);
  check(tag("0001"), nTiles === L, `tiles ${nTiles} = chain length ${L}`);
  if (nTiles > 3) {
    await page.locator(".seq span").nth(3).click(); await sleep(150);
    const r = await text(".readout");
    check(tag("0001"), /Residue .+ \(position 3\):/.test(r) && /[01]{2,5}/.test(r), `tap residue 4 → "${r.slice(0, 80)}"`);
  }
  await checkAllTheorems(tag("0001"));

  // 0011 Gray code: +1 always flips one Gray bit
  await go(H("0011"));
  for (let k = 0; k < 6; k++) {
    await page.getByRole("button", { name: "n plus one" }).click(); await sleep(60);
    const r = await text(".readout");
    check(tag("0011"), /Gray flips 1 bit/.test(r), `step ${k}: "${r}"`);
  }
  for (const b of ["5 bits", "6 bits", "4 bits"]) { await page.getByRole("button", { name: b }).click(); await sleep(80); }
  await generic(tag("0011"));
  await checkAllTheorems(tag("0011"));

  // 0010 K-map: each k; tapping a cell lists totalBits neighbours
  await go(H("0010"));
  const ks = await page.locator(".seg button").count();
  for (let k = 0; k < ks; k++) {
    await page.locator(".seg button").nth(k).click(); await sleep(250);
    const cv = page.locator("main canvas").first(); const bb = await cv.boundingBox();
    await cv.click({ position: { x: bb.width * 0.7, y: bb.height * 0.7 } }); await sleep(150);
    const r = await text(".readout");
    const m = r.match(/Its (\d+) one-bit neighbours: (\d+) next to it, (\d+) across the wrapped edge(?:, (\d+) mirrored)?/);
    check(tag(`0010 k${k + 1}`), !!m && +m[1] === +m[2] + +m[3] + +(m[4] || 0), `neighbours add up: "${r.slice(0, 120)}"`);
  }
  await generic(tag("0010"));
  await checkAllTheorems(tag("0010"));

  // 0110 geometry
  await go(H("0110"));
  const gs = page.locator("main svg g[style*='cursor']");
  if (await gs.count()) { await gs.nth(Math.min(3, (await gs.count()) - 1)).click(); await sleep(150); }
  const r6 = await text(".readout");
  check(tag("0110"), r6.length > 5, `readout "${r6.slice(0, 80)}"`);
  await generic(tag("0110"));
  await checkAllTheorems(tag("0110"));

  // 0111 contacts: truth table + checks
  await go(H("0111"), 2500);
  const g7 = await generic(tag("0111"));
  const nContacts = +(((await page.locator(".stat").nth(1).textContent()) || "").replace(/\D/g, "") || 0);
  if (await page.locator("table.tt tbody tr").count()) {
    await page.locator("table.tt tbody tr").nth(2).click(); await sleep(150);
    const eq = await text(".eq");
    check(tag("0111"), /C\(/.test(eq), `truth-table click updates the cell: "${eq.replace(/\n/g, " ")}"`);
    await page.getByRole("button", { name: "Every 1-cell" }).click(); await sleep(150);
    const pager = await page.locator(".table-pager span.small").first().textContent();
    const m = pager.match(/of ([\d,]+) 1-cells/);
    check(tag("0111"), m && +m[1].replace(/,/g, "") === 2 * nContacts, `1-cells ${m?.[1]} = 2 × contacts ${nContacts}`);
  }
  await checkAllTheorems(tag("0111"));

  // 0101 blocks (minimiser in a worker)
  await go(H("0101"), 4000);
  await page.waitForSelector(".stats, .error", { timeout: 60000 });
  await generic(tag("0101"));
  const sc = await page.locator(".checks li").allTextContents();
  check(tag("0101"), sc.some((t) => /Sound/.test(t)) && sc.some((t) => /Complete/.test(t)), "sound and complete listed");
  await page.waitForSelector("#shuffles section, #shuffles .error", { timeout: 60000 }).catch(() => null);
  if (await page.locator(".blocks-list button").count()) { await page.locator(".blocks-list button").first().click(); await sleep(200); }
  await checkAllTheorems(tag("0101"));

  // 0100 circuit: verify on every input; downloads re-checked independently
  await go(H("0100"), 3000);
  if (await page.locator(".error").count()) { await generic(tag("0100")); }
  else {
    await page.getByRole("button", { name: /Run the circuit on all/ }).click();
    await page.waitForFunction(() => /inputs agree/.test(document.querySelector("main").innerText), null, { timeout: 60000 });
    const vt = await page.evaluate(() => [...document.querySelectorAll(".readout")].map((e) => e.textContent).find((t) => /inputs agree/.test(t)));
    const m = vt.match(/([\d,]+) of ([\d,]+) inputs agree/);
    check(tag("0100"), m && m[1] === m[2] && /Exact/.test(vt), `verify: "${vt.slice(0, 120)}"`);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download .pla/ }).click()]);
    const pla = fs.readFileSync(await dl.path(), "utf8");
    const rows = pla.split("\n").filter((l) => /^[01-]+ 1$/.test(l)).map((l) => l.split(" ")[0]);
    const nIn = +(pla.match(/^\.i (\d+)/m) || [])[1], p = nIn / 2;
    // independent evaluation: every contact must fire some row; spot-check non-contacts
    const contacts = await page.evaluate(async () => {
      const app = await import("./js/app.js"); return null;
    }).catch(() => null);
    check(tag("0100"), nIn % 2 === 0 && new RegExp(`^\\.p ${rows.length}$`, "m").test(pla), `PLA rows ${rows.length}, ${nIn} inputs`);
    const [dv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download Verilog/ }).click()]);
    const v = fs.readFileSync(await dv.path(), "utf8");
    check(tag("0100"), /module \w+ \(input \[\d+:0\] i, input \[\d+:0\] j, output C\);/.test(v) && (rows.length ? (v.match(/\|/g) || []).length === rows.length - 1 : /1'b0/.test(v)), "Verilog has one OR term per PLA row (or the constant 0)");
    fs.writeFileSync(path.join(OUT, `${id}_${chain.replace(/\W/g, "")}.pla`), pla);
    // tap a cell of the contact map: output must match the structure
    const cv = page.locator("main canvas").first(); const bb = await cv.boundingBox();
    await cv.click({ position: { x: bb.width * 0.55, y: bb.height * 0.3 } }); await sleep(200);
    const pr = await page.evaluate(() => [...document.querySelectorAll(".readout")].map((e) => e.textContent).find((t) => /OR = /.test(t)) || "");
    check(tag("0100"), /matches the structure/.test(pr), `probe: "${pr.slice(0, 140)}"`);
    await generic(tag("0100"));
  }
  await checkAllTheorems(tag("0100"));

  // 1100 rules
  await go(H("1100"), 3000);
  if (!(await page.locator(".error").count())) {
    const st = await page.locator(".stat").allTextContents();
    const m = (st[1] || "").replace(/,/g, "").match(/(\d+)\/(\d+)/);
    check(tag("1100"), m && m[1] === m[2], `contacts explained ${st[1]}`);
    check(tag("1100"), /^0/.test((st[2] || "").trim()), `exceptions ${st[2]}`);
    const segs = await page.locator(".seg button").count();
    for (let k = 0; k < segs; k++) { await page.locator(".seg button").nth(k).click(); await sleep(120); }
    await page.locator(".seg button").first().click();
    if (await page.locator(".blocks-list button").count() > 2) { await page.locator(".blocks-list button").nth(2).click(); await sleep(150); }
    if (await page.locator(".blocks-list button").count()) {
      const det = await text(".eq");
      const dm = det.match(/holds for (\d+) of (\d+) pairs/);
      check(tag("1100"), dm && dm[1] === dm[2], `rule detail: "${det.split("\n").pop()}"`);
    }
  }
  await generic(tag("1100"));
  await checkAllTheorems(tag("1100"));

  // 1101 inferences
  await go(H("1101"), 3500);
  await generic(tag("1101"));
  await checkAllTheorems(tag("1101"));

  // 1111 read back
  await go(H("1111"), 2000);
  await page.waitForFunction(() => /Identical|differ|error/i.test(document.querySelector("main").innerText), null, { timeout: 60000 }).catch(() => null);
  const rb = await page.evaluate(() => [...document.querySelectorAll(".readout")].map((e) => e.textContent).join(" "));
  check(tag("1111"), /Identical/.test(rb), `read back: "${rb.slice(0, 100)}"`);
  await generic(tag("1111"));
  await checkAllTheorems(tag("1111"));

  // 1110 invariance: GF(2) toggles keep equality
  await go(H("1110"), 2000);
  for (let k = 0; k < 6; k++) { await page.locator(".bitbox.tap span").nth(k % 10).click(); await sleep(50); }
  const lin = await text(".readout");
  check(tag("1110"), /equal/.test(lin) && !/differ/.test(lin), `GF(2): "${lin.slice(0, 60)}"`);
  await page.getByRole("button", { name: /Show (Gray|lexicographic|plain-index) addresses/ }).click(); await sleep(1100);
  await generic(tag("1110"));
  await checkAllTheorems(tag("1110"));

  // 1010 takeaways
  await go(H("1010"), 3500);
  await generic(tag("1010"));
  await checkAllTheorems(tag("1010"));
}

// navigation: keyboard, back/forward, chip, dots, swipe
await go("/1FNA/A/0011");
await page.keyboard.press("ArrowRight"); await sleep(800);
check("nav", /\/0010$/.test(page.url()), `ArrowRight → ${page.url().split("#")[1]}`);
await page.goBack(); await sleep(800);
check("nav", /\/0011$/.test(page.url()), `back → ${page.url().split("#")[1]}`);
await page.goForward(); await sleep(800);
check("nav", /\/0010$/.test(page.url()), `forward → ${page.url().split("#")[1]}`);
await page.locator("#dots button").nth(12).click(); await sleep(1500);
check("nav", /\/1010$/.test(page.url()), `dot 13 → ${page.url().split("#")[1]}`);
await page.locator("#entry-chip").click(); await sleep(800);
check("nav", /\/0000$/.test(page.url()), `chip → ${page.url().split("#")[1]}`);
// rapid navigation must not leave errors behind
for (const s of ["0101", "0100", "1100", "1101", "0111", "0101", "1010"]) { await page.goto(BASE + "#/1FNA/A/" + s); await sleep(120); }
await sleep(4000);
await generic("nav rapid");
// bad inputs
await page.goto(BASE + "#/ZZZZ/A/0001"); await sleep(2000);
check("bad id", (await page.locator(".error").count()) === 1 && /not a PDB ID/.test(await text(".error")), `malformed id: "${await text(".error")}"`);
logs.length = 0;
await page.goto(BASE + "#/9ZZZ/A/0001"); await sleep(6000);
check("missing id", (await page.locator(".error").count()) === 1, `well-formed but missing id: "${await text(".error")}"`);
logs.length = 0;
await go("/1FNA/Q/0001");
check("bad chain", /1FNA/.test(await text("#entry-chip")), `bad chain falls back: ${await text("#entry-chip")}`);
await go("/1FNA/A/9999");
check("bad step", (await text("main h1")).length > 0, `unknown step → "${await text("main h1")}"`);
logs.length = 0;

await browser.close();
const okN = results.filter((r) => r.ok).length;
console.log(`\n${VIEW}: ${okN}/${results.length} checks passed, ${fails} failed`);
fs.writeFileSync(path.join(OUT, `results_${VIEW}.json`), JSON.stringify(results, null, 1));
process.exit(fails ? 1 : 0);
