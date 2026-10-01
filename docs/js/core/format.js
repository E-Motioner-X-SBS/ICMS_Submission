// Formatting helpers shared by the data layer and the UI. DOM-free.

const nf = new Intl.NumberFormat("en-GB");
/** 65536 → "65,536" */
export const int = (n) => nf.format(Math.round(n));
/** Milliseconds for check reports: 0.004 → "< 0.01 ms", 0.43 → "0.4 ms", 3.2 → "3 ms", 1234 → "1.2 s". */
export function ms(t) {
  if (!(t >= 0)) return "–";
  if (t < 0.01) return "< 0.01 ms";
  if (t < 1) return `${t.toFixed(2).replace(/0$/, "")} ms`;
  if (t < 10) return `${t.toFixed(1).replace(/\.0$/, "")} ms`;
  if (t < 1000) return `${Math.round(t)} ms`;
  return `${(t / 1000).toFixed(1)} s`;
}
/** 0.20587 → "20.6%" (digits after the point). */
export const pct = (x, digits = 1) => `${(100 * x).toFixed(digits)}%`;
/** Fixed decimals without trailing noise: num(0.976747, 3) → "0.977". */
export const num = (x, digits = 2) => Number(x).toFixed(digits);

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
/** 1.52e-25 → "1.5 × 10⁻²⁵"; 0.034 → "0.034". */
export function sci(x, digits = 2) {
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -3 && e < 4) return String(Number(x.toPrecision(digits)));
  const m = x / 10 ** e;
  return `${Number(m.toPrecision(digits))} × 10${String(e).replace(/./g, (c) => SUP[c])}`;
}
/** p-value in the poster's style: "p = 1.5 × 10⁻²⁵". */
export const pValue = (p) => `p = ${sci(p)}`;

/** "1 residue" / "91 residues" */
export const plural = (n, one, many = `${one}s`) => `${int(n)} ${n === 1 ? one : many}`;

// Tokens kept upper case when a title is converted from ALL CAPS.
const KEEP_UPPER = new Set(["DNA", "RNA", "TRNA", "MRNA", "RRNA", "ATP", "ADP", "GTP", "NAD", "NADH", "NADP", "FAD", "HIV", "SARS",
  "II", "III", "IV", "VI", "VII", "VIII", "IX", "XI", "XII", "NMR", "EM", "PDB", "HLA", "MHC", "TCR", "SH2", "SH3", "PH", "UV", "X-RAY",
  "CI-2", "B-DNA", "Z-DNA", "A-DNA", "E.", "COLI", "CD4", "IGG", "FAB", "FV", "SCFV", "KDA", "GFP", "EGFR", "HER2", "P53", "RAS"]);
const FIX_CASE = { TRNA: "tRNA", MRNA: "mRNA", RRNA: "rRNA", COLI: "coli", KDA: "kDa", IGG: "IgG", FAB: "Fab", FV: "Fv", SCFV: "scFv" };
/** Titles in older PDB entries are ALL CAPS; the site never shows all-caps labels. */
export function sentenceCase(s) {
  if (!s) return s;
  const letters = s.replace(/[^A-Za-z]/g, "");
  const upper = letters.replace(/[^A-Z]/g, "").length;
  if (!letters.length || upper / letters.length < 0.8) return s;             // already mixed case
  let first = true;
  return s.split(/(\s+|[(),;:/])/).map((w) => {
    if (!w.trim() || /^[(),;:/]$/.test(w)) return w;
    const core = w.replace(/[.,;:]+$/, ""), tail = w.slice(core.length);
    let out;
    if (FIX_CASE[core]) out = FIX_CASE[core];
    else if (KEEP_UPPER.has(core) || /\d/.test(core) && /[A-Z]/.test(core) && core.length <= 8) out = core;
    else out = core.toLowerCase();
    if (first && /[a-z]/.test(out[0])) out = out[0].toUpperCase() + out.slice(1);
    first = /[.!?]$/.test(tail) || /[.!?]$/.test(core) && !KEEP_UPPER.has(core);
    return out + tail;
  }).join("");
}
/** "HOMO SAPIENS" → "Homo sapiens" */
export function species(s) {
  if (!s) return s;
  if (s !== s.toUpperCase()) return s;
  const t = s.toLowerCase();
  return t[0].toUpperCase() + t.slice(1);
}
const METHODS = {
  "X-RAY DIFFRACTION": "X-ray diffraction", "SOLUTION NMR": "solution NMR", "SOLID-STATE NMR": "solid-state NMR",
  "ELECTRON MICROSCOPY": "electron microscopy", "ELECTRON CRYSTALLOGRAPHY": "electron crystallography",
  "NEUTRON DIFFRACTION": "neutron diffraction", "FIBER DIFFRACTION": "fibre diffraction", "POWDER DIFFRACTION": "powder diffraction",
  "SOLUTION SCATTERING": "solution scattering", "INFRARED SPECTROSCOPY": "infrared spectroscopy", "THEORETICAL MODEL": "theoretical model",
};
export const method = (m) => (m ? METHODS[m.toUpperCase()] || sentenceCase(m).toLowerCase() : m);
/** Capitalise the first letter only. */
export const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
