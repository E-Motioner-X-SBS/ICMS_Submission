// The app: routing (#/ID/CHAIN/STEP), structure loading, per-chain caches, navigation.
import { EXAMPLES, fetchEntry, defaultChain, normalizeId } from "./core/rcsb.js";
import { chainOptions } from "./core/chains.js";
import { cachedExample, fingerprint } from "./core/cache.js";
import { contactMap } from "./core/contacts.js";
import { h, toast } from "./ui.js";

export const CHAPTERS = [
  { id: "0000", title: "Pick a structure", short: "Pick" },
  { id: "0001", title: "Letters become bits", short: "Bits" },
  { id: "0011", title: "A code that changes one bit at a time", short: "Gray code" },
  { id: "0010", title: "A Karnaugh map of your sequence", short: "K-map" },
  { id: "0110", title: "The geometry of the code", short: "Geometry" },
  { id: "0111", title: "Contacts become a Boolean function", short: "Contacts" },
  { id: "0101", title: "Minimisation finds blocks", short: "Blocks" },
  { id: "0100", title: "The structure as a circuit", short: "Circuit" },
  { id: "1100", title: "From the circuit, rules", short: "Rules" },
  { id: "1101", title: "From the rules, inferences", short: "Inferences" },
  { id: "1111", title: "Read the sequence back", short: "Read back" },
  { id: "1110", title: "What the code can and cannot see", short: "Invariance" },
  { id: "1010", title: "What it all means", short: "Takeaways" },
];
const idx = (id) => CHAPTERS.findIndex((c) => c.id === id);

// ── state ────────────────────────────────────────────────────────────────────
const state = { id: null, chainId: null, structure: null, chain: null, step: "0000", derived: new Map(), mounted: null, loading: null };

export { chainOptions };
function pickChain(structure, chainId) {
  const opts = chainOptions(structure);
  if (chainId) { const o = opts.find((x) => x.id === chainId); if (o) return o.chain; }
  const d = defaultChain(structure);
  if (d.entityType !== "protein") { const both = opts.find((o) => o.chain.strands && o.chain.entityType === d.entityType); if (both) return both.chain; }
  return d;
}

// ── derived data, cached per chain ────────────────────────────────────────────
let worker = null, jobId = 0;
const pending = new Map();
function qmWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./workers/qm.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const { id, type } = e.data, p = pending.get(id); if (!p) return;
    if (type === "round") p.onRound?.(e.data);
    else if (type === "done") { pending.delete(id); p.resolve(e.data.result); }
    else if (type === "error") { pending.delete(id); p.reject(new Error(e.data.message)); }
  };
  return worker;
}
function runJob(msg, onRound) {
  const id = ++jobId;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, onRound }); qmWorker().postMessage({ id, ...msg }); });
}
export const MAX_QM_RESIDUES = 2048;                 // 11 position bits; a 972-residue chain minimises in ~0.3 s
function memo(key, make) {
  const k = `${state.chain?.uid}|${key}`;
  if (!state.derived.has(k)) state.derived.set(k, make());
  return state.derived.get(k);
}
// For the bundled examples the slow results are precomputed (data/examples/, same engine); a
// cached record is used only when its fingerprint matches the contacts or codes computed here.
async function fromCache(part, key) {
  const rec = await cachedExample(state.chain?.uid);
  return rec && rec[part] && rec.contactsKey === key ? rec[part] : null;
}
const derived = {
  contacts: () => memo("contacts", () => contactMap(state.chain)),
  analysis: (onRound) => memo("analysis", async () => {
    const cm = derived.contacts();
    if (cm.L > MAX_QM_RESIDUES) throw Object.assign(new Error(`This chain has ${cm.L} residues; the in-browser minimiser takes chains of up to ${MAX_QM_RESIDUES}. Pick another chain of this entry, or another structure.`), { kind: "too-long" });
    const hit = await fromCache("analysis", fingerprint(cm.L, cm.pairs));
    if (hit) return { ...hit, cached: true };
    const rounds = [];                                   // kept, so a later visit can replay the merge rounds
    return runJob({ type: "contacts", pairs: cm.pairs, length: cm.L }, (r) => { rounds.push(r); onRound?.(r); }).then((res) => ({ ...res, rounds }));
  }),
  shuffles: (n = 5) => memo(`shuffles${n}`, async () => {
    const cm = derived.contacts();
    const hit = n === 5 ? await fromCache("shuffles", fingerprint(cm.L, cm.pairs)) : null;
    if (hit) return hit;
    return runJob({ type: "shuffles", pairs: cm.pairs, length: cm.L, n, seed: 20260905 });
  }),
  sequenceCircuit: (codes, w) => memo(`seq${w}`, async () => {
    const rec = await cachedExample(state.chain?.uid);
    if (rec?.sequence && rec.sequence.w === w && rec.sequence.codesKey === fingerprint(codes.length, codes)) return { ...rec.sequence.result, cached: true };
    return runJob({ type: "sequence", codes, w });
  }),
};

// ── routing ──────────────────────────────────────────────────────────────────
function parseHash() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!parts.length) return { step: "0000" };
  if (/^[01]{4}$/.test(parts[0])) return { step: parts[0] };
  const id = normalizeId(decodeURIComponent(parts[0]));
  if (!id) return { bad: decodeURIComponent(parts[0]), step: "0000" };
  return { id, chainId: parts[1] ? decodeURIComponent(parts[1]) : null, step: /^[01]{4}$/.test(parts[2] || "") ? parts[2] : "0001" };
}
export function go(step, { id = state.id, chainId = state.chainId } = {}) {
  const target = id ? `#/${id}/${encodeURIComponent(chainId || "")}/${step}` : `#/${step}`;
  if (location.hash !== target) location.hash = target; else route();
}
export async function loadEntry(id, chainId) {
  const norm = normalizeId(id);
  if (!norm) throw new Error(`"${id}" is not a PDB ID. PDB IDs have four characters, like 1UBQ.`);
  if (state.id === norm && state.structure) {
    const chain = pickChain(state.structure, chainId);
    if (chain.uid !== state.chain?.uid) { state.chain = chain; state.chainId = chain.id; }
    return state.structure;
  }
  const s = await fetchEntry(norm);
  state.id = norm; state.structure = s; state.chain = pickChain(s, chainId); state.chainId = state.chain.id;
  return s;
}

async function route() {
  const r = parseHash();
  const step = CHAPTERS.some((c) => c.id === r.step) ? r.step : "0000";
  const main = document.getElementById("chapter");
  if (r.bad) {
    renderChrome();
    main.replaceChildren(h("div.error", `“${r.bad}” is not a PDB ID. A PDB ID has four characters and starts with a digit, like 1UBQ.`), h("p", h("a", { href: "#/0000" }, "Pick a structure")));
    return;
  }
  try {
    if (r.id && (r.id !== state.id || (r.chainId && r.chainId !== state.chainId))) {
      main.replaceChildren(h("div.loading", h("span.spinner"), `Loading ${r.id} from the Protein Data Bank…`));
      await loadEntry(r.id, r.chainId);
    } else if (!state.structure && step !== "0000") {
      const ex = EXAMPLES[0]; await loadEntry(ex.id, ex.chain);
    }
  } catch (e) {
    main.replaceChildren(h("div.error", e.userMessage || e.message), h("p", h("a", { href: "#/0000" }, "Pick another structure")));
    return;
  }
  await mountChapter(step);
}

async function mountChapter(step) {
  const main = document.getElementById("chapter");
  try { state.mounted?.unmount?.(); } catch { /* ignore */ }
  state.step = step;
  renderChrome();
  const k = idx(step), ch = CHAPTERS[k];
  document.title = `${ch.title} · Is KMAP possible?`;
  main.replaceChildren(h("div.loading", h("span.spinner"), "Preparing…"));
  let mod;
  try { mod = (await import(`./steps/${step}.js`)).default; }
  catch (e) { main.replaceChildren(h("div.error", `This chapter could not load: ${e.message}`)); return; }
  const el = h("div");
  main.replaceChildren(el);
  main.classList.remove("chapter"); void main.offsetWidth; main.classList.add("chapter");
  const ctx = { structure: state.structure, chain: state.chain, derived, go, loadEntry, chainOptions, chapter: ch, next: CHAPTERS[k + 1], state };
  state.mounted = mod;                       // set first, so leaving mid-mount still unmounts
  try { await mod.mount(el, ctx); }
  catch (e) { console.error(e); el.append(h("div.error", `Something went wrong in this chapter: ${e.message}`)); }
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  document.getElementById("main").focus({ preventScroll: true });
}

// ── chrome: chapter head, dots, prev/next, entry chip ─────────────────────────
function renderChrome() {
  const k = idx(state.step), ch = CHAPTERS[k], prev = CHAPTERS[k - 1];
  const head = document.getElementById("chapter-head");
  const bits = [...ch.id].map((b, i) => h(`b${prev && prev.id[i] !== b ? ".flip" : ""}`, b));
  head.replaceChildren(h("span.gc", { title: prev ? "Chapter numbers are a Gray code: the orange bit is the one that flipped" : "Chapter numbers are a Gray code" }, bits),
    h("span.count", `${k + 1} of ${CHAPTERS.length}`));
  const dots = document.getElementById("dots");
  dots.replaceChildren(...CHAPTERS.map((c, i) => h("li", h(`button${i < k ? ".done" : ""}`, {
    type: "button", "aria-label": `${c.id}: ${c.title}`, "aria-current": i === k ? "step" : undefined,
    on: { click: () => go(c.id) }, disabled: !state.structure && i > 0 }))));
  const prevB = document.getElementById("prev"), nextB = document.getElementById("next");
  prevB.disabled = k === 0; prevB.onclick = () => k > 0 && go(CHAPTERS[k - 1].id);
  const nx = CHAPTERS[k + 1];
  nextB.disabled = !nx || (!state.structure && k === 0);
  document.getElementById("next-label").textContent = nx ? nx.short : "Done";
  nextB.setAttribute("aria-label", nx ? `Next chapter: ${nx.title}` : "Last chapter");
  nextB.onclick = () => nx && go(nx.id);
  const chip = document.getElementById("entry-chip");
  if (state.structure) {
    chip.hidden = false;
    chip.replaceChildren(h("span", state.id), " ", h("span.muted", `${state.chain.id}, ${state.chain.entityType}, ${state.chain.length}`));
    chip.onclick = () => go("0000");
    chip.setAttribute("aria-label", `Structure ${state.id}, chain ${state.chain.id}. Change structure`);
  } else chip.hidden = true;
}

// swipe between chapters (not on maps or the 3D viewer, which use touch themselves)
let t0 = null;
document.addEventListener("touchstart", (e) => { if (e.target.closest("[data-noswipe], input, canvas, .viewer")) { t0 = null; return; } t0 = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!t0) return; const dx = e.changedTouches[0].clientX - t0.x, dy = e.changedTouches[0].clientY - t0.y; t0 = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
  const k = idx(state.step);
  if (dx < 0 && CHAPTERS[k + 1] && state.structure) go(CHAPTERS[k + 1].id);
  if (dx > 0 && CHAPTERS[k - 1]) go(CHAPTERS[k - 1].id);
}, { passive: true });
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = idx(state.step);
  if (e.key === "ArrowRight" && CHAPTERS[k + 1] && state.structure) go(CHAPTERS[k + 1].id);
  if (e.key === "ArrowLeft" && CHAPTERS[k - 1]) go(CHAPTERS[k - 1].id);
});
window.addEventListener("hashchange", route);
window.addEventListener("error", (e) => toast(`Unexpected error: ${e.message}`));
route();

// offline and instant revisits: the service worker precaches the site and keeps fetched structures
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).catch(() => { /* the site works without it */ });
}
