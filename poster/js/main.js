// Mount every figure slot. A slot <div class="fig" id="NAME" data-w data-h> is
// built by js/figs/NAME.js (default export: async build(host, {w, h})). Missing
// modules leave a labelled placeholder so the layout can be judged early.
import { selfCheck } from "./lib.js";

selfCheck();                                   // encodings must match the Lean facts
await document.fonts.ready;

const slots = [...document.querySelectorAll(".fig[id]")];
for (const host of slots) {
  host.style.width = `${host.dataset.w}mm`;
  host.style.height = `${host.dataset.h}mm`;
}
const errors = [];
await Promise.all(slots.map(async (host) => {
  let mod;
  try { mod = await import(`./figs/${host.id}.js`); }
  catch { host.classList.add("placeholder"); return; }
  // data-base-w/h: draw at the audited base size, then scale the whole diagram up to data-w × data-h
  const bw = Number(host.dataset.baseW || host.dataset.w), bh = Number(host.dataset.baseH || host.dataset.h);
  try {
    await mod.default(host, { w: bw, h: bh });
    const svg = host.querySelector(":scope > svg");
    if (svg && (bw !== Number(host.dataset.w) || bh !== Number(host.dataset.h))) { svg.setAttribute("width", `${host.dataset.w}mm`); svg.setAttribute("height", `${host.dataset.h}mm`); }
  }
  catch (e) { errors.push(`${host.id}: ${e.stack || e.message}`); host.classList.add("placeholder"); }
}));
for (const e of errors) console.error("FIGURE ERROR", e);
await document.fonts.ready;
window.__posterReady = true;
