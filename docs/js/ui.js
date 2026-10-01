// Small DOM toolkit shared by the chapters: an element builder, Lean syntax tinting,
// theorem cards with live re-checks, evidence tags, and canvas sizing.
import { byChapter, get, TRUST_TEXT, sourceLabel } from "./core/lean.js";
import { int, ms } from "./core/format.js";

/** h("div.cls#id", {attrs, on: {click}}, children...) */
export function h(spec, attrs = {}, ...kids) {
  const [tag, ...rest] = spec.split(/(?=[.#])/);
  const el = document.createElement(tag || "div");
  for (const r of rest) r[0] === "." ? el.classList.add(r.slice(1)) : (el.id = r.slice(1));
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = {}; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k in el && k !== "list" && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Lean source with light tinting: keywords, the theorem name, comments, tactics. */
export function leanHTML(src, name) {
  const KW = /\b(theorem|lemma|def|by|fun|let|if|then|else|match|with|∀|∃|in|at|have|show|from|Fin|Nat|Bool|true|false)\b|∀|∃|→|↔|∧|∨|¬/g;
  return String(src).split("\n").map((line) => {
    const ci = line.indexOf("--");
    const code = ci >= 0 ? line.slice(0, ci) : line, comment = ci >= 0 ? line.slice(ci) : "";
    let out = esc(code).replace(KW, (m) => `<span class="k">${m}</span>`)
      .replace(/\b(native_decide|decide|omega|simp|rfl|intro|cases|exact|trivial|norm_num|induction)\b/g, '<span class="t">$1</span>');
    if (name) out = out.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), `<span class="n">${name}</span>`);
    return out + (comment ? `<span class="c">${esc(comment)}</span>` : "");
  }).join("\n");
}

export const tag = (kind, text) => h(`span.tag.${kind}`, text);

const SCOPE_NOTE = {
  "all-cases": (t) => `every case: ${int(t.cases)}`,
  closed: () => "a closed statement, evaluated once",
  witness: () => "finds a witness",
  bounded: () => "Lean proves it for all numbers; the browser checks a bounded range",
};

/** One theorem: name, meaning, verbatim statement, trust, live check. */
export function theoremCard(t, { compact = false } = {}) {
  if (typeof t === "string") t = get(t);
  if (!t) return null;
  const result = h("span.result", { "aria-live": "polite" });
  const btn = h("button.btn.small.ghost", { type: "button" }, "Run the check");
  btn.addEventListener("click", async () => {
    btn.disabled = true; result.className = "result"; result.textContent = "checking…";
    await new Promise((r) => setTimeout(r, 30));
    try {
      const t0 = performance.now(); const r = await t.check(); const dt = performance.now() - t0;
      const n = r.cases ?? t.cases;
      result.className = `result ${r.ok ? "ok" : "bad"}`;
      result.textContent = r.ok ? `✓ ${n ? int(n) + " " + (n === 1 ? "case" : "cases") : "holds"} in ${ms(dt)}` : `✗ failed${r.detail ? ": " + r.detail : ""}`;
    } catch (e) { result.className = "result bad"; result.textContent = `✗ ${e.message}`; }
    btn.disabled = false; btn.textContent = "Run again";
  });
  const trust = TRUST_TEXT[t.trust] || "";
  return h("section.thm", { "aria-label": `Theorem ${t.name}` },
    h("header", h("span.name", t.name), h("span.file", sourceLabel(t))),
    h("p.meaning", t.meaning),
    compact ? null : h("pre", { html: leanHTML(t.statement, t.name) }),
    h("footer", btn, result, h("span.trust", `${SCOPE_NOTE[t.scope]?.(t) ?? ""}. ${trust}`)));
}

/** The theorems of a chapter: the featured ones as cards, the rest behind a toggle,
 *  and a button that re-checks all of them with a progress bar. */
export function theoremBlock(chapterId, featuredNames = [], { title = "The theorems behind this step" } = {}) {
  const all = byChapter(chapterId);
  const featured = featuredNames.map((n) => all.find((t) => t.name === n || t.id === n)).filter(Boolean);
  const rest = all.filter((t) => !featured.includes(t));
  const bar = h("i"), status = h("span.small", { "aria-live": "polite" });
  const runAll = h("button.btn.small", { type: "button" }, `Check all ${all.length}`);
  runAll.addEventListener("click", async () => {
    runAll.disabled = true; let cases = 0, okN = 0; const t0 = performance.now();
    for (let k = 0; k < all.length; k++) {
      const r = await all[k].check(); cases += r.cases ?? all[k].cases ?? 0; if (r.ok) okN++;
      bar.style.width = `${(100 * (k + 1)) / all.length}%`;
      if (k % 4 === 3) await new Promise((res) => setTimeout(res, 0));
    }
    status.textContent = `${okN} of ${all.length} hold: ${int(cases)} cases re-checked in ${ms(performance.now() - t0)}.`;
    runAll.disabled = false;
  });
  return h("section.theorems-block",
    h("h2", title),
    h("div.checkall", runAll, h("div.bar", bar), status),
    h("div.theorems", featured.map((t) => theoremCard(t))),
    rest.length ? h("details.thm-more", h("summary", `${rest.length} more ${rest.length === 1 ? "theorem" : "theorems"} for this step`),
      h("div.theorems", rest.map((t) => theoremCard(t, { compact: true })))) : null);
}

/** Size a canvas for crisp drawing; returns the 2D context in CSS pixels. */
export function fitCanvas(canvas, cssW, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`; canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const stageWidth = (el) => Math.max(240, Math.min(el.clientWidth || 340, 720));
export const sleep = (t) => new Promise((r) => setTimeout(r, t));
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function toast(msg, t = 3200) {
  const el = document.getElementById("toast"); el.textContent = msg; el.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (el.hidden = true), t);
}

/** Readable text colour on a filled mark (WCAG relative luminance). */
export function inkOn(hex) {
  const m = String(hex).replace("#", "");
  if (m.length !== 6) return "#fff";
  const c = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.0785 ? "#fff" : "#14304F";   // vs white, vs ink #14304F
}

/** The call to action at the end of a chapter. */
export function nextStep(ctx, text) {
  if (!ctx.next) return null;
  return h("div.next-step", h("p.small", text || ""), h("button.btn", { type: "button", on: { click: () => ctx.go(ctx.next.id) } },
    `Next: ${ctx.next.title}`, h("span", { "aria-hidden": "true" }, " →")));
}

/** Evidence tags row: [["lean","gray_hamming_one"],["data","your chain"]] */
export const tags = (list) => h("div.tags", list.map(([k, t]) => tag(k, `${k === "lean" ? "⊢ " : k === "data" ? "◆ " : "✎ "}${t}`)));

/** parent.append that skips null/false/undefined (plain append would print "null"). */
export function add(parent, ...kids) {
  parent.append(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false).map((k) => (k instanceof Node ? k : String(k))));
  return parent;
}
