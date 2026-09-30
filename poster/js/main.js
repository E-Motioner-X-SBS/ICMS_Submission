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
  try { await mod.default(host, { w: Number(host.dataset.w), h: Number(host.dataset.h) }); }
  catch (e) { errors.push(`${host.id}: ${e.stack || e.message}`); host.classList.add("placeholder"); }
}));
for (const e of errors) console.error("FIGURE ERROR", e);
await document.fonts.ready;
window.__posterReady = true;
