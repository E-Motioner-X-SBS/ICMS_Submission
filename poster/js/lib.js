// Shared helpers and the encodings, written from the same definitions the Lean
// files use, so every diagram is computed rather than drawn by hand.

export const NS = "http://www.w3.org/2000/svg";

// ── SVG construction ─────────────────────────────────────────────────────────
export function el(tag, attrs = {}, children = []) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    e.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  return e;
}
export const g = (attrs, children) => el("g", attrs, children);
export const txt = (x, y, s, attrs = {}) => el("text", { x, y, ...attrs }, [s]);

// Multi-span text: parts = [["plain"], ["bold", {"font-weight": 700}], ...]
export function spans(x, y, parts, attrs = {}) {
  return el("text", { x, y, ...attrs }, parts.map(([s, a]) => el("tspan", a || {}, [s])));
}

// Mount a figure: an <svg> whose user units are millimetres (viewBox 0 0 w h),
// drawn at exactly w × h mm. `host` is the element (or its id); build(svg, arrow)
// receives the svg and a ready-made arrowhead marker reference.
export function mount(hostOrId, w, h, build, label) {
  const host = typeof hostOrId === "string" ? document.getElementById(hostOrId) : hostOrId;
  const id = host.id || "fig";
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, width: `${w}mm`, height: `${h}mm`, role: "img", "aria-label": label });
  svg.appendChild(el("defs", {}, [
    el("marker", { id: `${id}-arrow`, viewBox: "0 0 10 10", refX: 8.6, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse", markerUnits: "userSpaceOnUse" },
      [el("path", { d: "M0,0 L10,5 L0,10 z", fill: "currentColor" })]),
  ]));
  build(svg, `url(#${id}-arrow)`);
  host.appendChild(svg);
  return svg;
}

// ── Gray code & bits (mirrors KmapProofs.lean) ────────────────────────────────
export const gray = (n) => n ^ (n >> 1);                     // grayNat
export const grayInv = (gv) => { let v = gv; for (let s = 1; s < 32; s <<= 1) v ^= v >> s; return v; };
export const popcount = (x) => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };
export const ham = (a, b) => popcount(a ^ b);                // hammingDist
export const bits = (n, w) => n.toString(2).padStart(w, "0");

// ── DNA (KmapProofs.lean: encode A=0, C=1, G=3, T=2 → A=00 C=01 G=11 T=10) ────
export const NUC_RAW = { A: 0, C: 1, G: 3, T: 2 };
export const NUC_AXIS = ["A", "C", "G", "T"];                // K-map axis order = Gray order of raw codes

// ── Amino acids (AminoAcidEncoding.lean): raw index in group order, code = grayNat(raw)
export const GROUPS = [
  { key: "hydrophobic", name: "aliphatic hydrophobic", aa: ["A", "V", "L", "I"], color: "var(--g-hydrophobic)", hex: "#9b6a1c" },
  { key: "aromatic",    name: "aromatic",              aa: ["F", "Y", "W"],      color: "var(--g-aromatic)",    hex: "#4a3aa7" },
  { key: "sulfur",      name: "sulfur-containing",     aa: ["M", "C"],           color: "var(--g-sulfur)",      hex: "#008300" },
  { key: "breaker",     name: "structure-breaking",    aa: ["P", "G"],           color: "var(--g-breaker)",     hex: "#e87ba4" },
  { key: "polar",       name: "polar uncharged",       aa: ["S", "T", "N", "Q"], color: "var(--g-polar)",       hex: "#1baf7a" },
  { key: "negative",    name: "negatively charged",    aa: ["D", "E"],           color: "var(--g-negative)",    hex: "#e34948" },
  { key: "positive",    name: "positively charged",    aa: ["H", "K", "R"],      color: "var(--g-positive)",    hex: "#2a78d6" },
];
export const AA_ORDER = GROUPS.flatMap((grp) => grp.aa);     // raw index 0..19
export const AA_RAW = Object.fromEntries(AA_ORDER.map((a, i) => [a, i]));
export const AA_CODE = Object.fromEntries(AA_ORDER.map((a, i) => [a, gray(i)]));
export const AA_GROUP = Object.fromEntries(GROUPS.flatMap((grp) => grp.aa.map((a) => [a, grp])));
export const CODE_AA = Object.fromEntries(Object.entries(AA_CODE).map(([a, c]) => [c, a]));

// Checks against the numbers the Lean files prove; a failure stops the build.
export function selfCheck() {
  const fails = [];
  const pairs = [];
  for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) pairs.push(ham(AA_CODE[AA_ORDER[i]], AA_CODE[AA_ORDER[j]]));
  const hist = [1, 2, 3, 4, 5].map((d) => pairs.filter((x) => x === d).length);
  if (hist.join() !== "40,66,56,24,4") fails.push(`distance histogram ${hist} ≠ 40,66,56,24,4 (unorderedDistanceDistribution)`);
  for (const [a, b] of [["F", "H"], ["Y", "E"], ["W", "R"], ["M", "K"]])
    if (ham(AA_CODE[a], AA_CODE[b]) !== 5) fails.push(`max_distance_${a}${b}`);
  for (const [a, b] of [["D", "E"], ["H", "K"], ["K", "R"]])
    if (ham(AA_CODE[a], AA_CODE[b]) !== 1) fails.push(`charge_adjacency_${a}${b}`);
  for (let n = 0; n < 255; n++) if (ham(gray(n), gray(n + 1)) !== 1) fails.push(`gray_hamming_one at ${n}`);
  const cyc = ["A", "C", "G", "T", "A"];
  for (let i = 0; i < 4; i++) if (ham(NUC_RAW[cyc[i]], NUC_RAW[cyc[i + 1]]) !== 1) fails.push(`gray_cycle_${cyc[i]}${cyc[i + 1]}`);
  if (fails.length) throw new Error("encoding self-check failed: " + fails.join("; "));
  return hist;
}

// Unit helpers: figures are drawn in mm. Type sizes are given in pt.
export const PT = 0.3528;                 // 1 pt in mm
export const pt = (n) => n * PT;           // e.g. "font-size": pt(22)

export async function loadJSON(name) {
  const r = await fetch(`data/${name}`);
  if (!r.ok) throw new Error(`data/${name}: HTTP ${r.status}`);
  return r.json();
}
export async function loadTSV(name) {
  const r = await fetch(`data/${name}`);
  const [head, ...rows] = (await r.text()).trim().split("\n").map((l) => l.split("\t"));
  return rows.map((row) => Object.fromEntries(head.map((h, i) => [h, row[i] ?? ""])));
}
