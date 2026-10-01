// Canvas renderers: Karnaugh-map heat grids and contact maps. Crisp at any DPR,
// tap/click to inspect, colours read from the CSS tokens (so dark mode just works).
import { fitCanvas, css, inkOn } from "../ui.js";

const ramp = () => [1, 2, 3, 4, 5, 6].map((k) => css(`--cell-${k}`));
export const rampColor = (v, max) => { const r = ramp(); if (!v) return css("--cell-0"); return r[Math.min(r.length - 1, Math.floor((v / max) * r.length - 1e-9))]; };

/** A grid with row/column labels. values[r][c] >= 0. Returns { redraw(highlights), cellAt }. */
export function kmapGrid(canvas, { values, rowLabels, colLabels, width, cellText, onTap, maxCell = 44 }) {
  const R = values.length, C = values[0].length;
  const mono = `500 11px "Plex Mono", ui-monospace, monospace`;
  const labW = rowLabels ? Math.max(18, Math.max(...rowLabels.map((s) => s.length)) * 7 + 6) : 0;
  const labH = colLabels ? 18 : 0;
  const cell = Math.max(4, Math.min(maxCell, Math.floor((width - labW - 2) / C)));
  const W = labW + C * cell + 2, H = labH + R * cell + 2;
  const ctx = fitCanvas(canvas, W, H);
  const max = Math.max(1, ...values.flat());
  let hl = [];
  function redraw(highlights = hl) {
    hl = highlights;
    ctx.clearRect(0, 0, W, H);
    ctx.font = mono; ctx.fillStyle = css("--ink-3"); ctx.textBaseline = "middle";
    const every = Math.max(1, Math.ceil(12 / cell));
    if (colLabels) { ctx.textAlign = "center"; colLabels.forEach((s, c) => { if (c % every === 0 || cell > 20) ctx.fillText(s, labW + (c + 0.5) * cell, labH / 2); }); }
    if (rowLabels) { ctx.textAlign = "right"; rowLabels.forEach((s, r) => { if (r % every === 0 || cell > 20) ctx.fillText(s, labW - 4, labH + (r + 0.5) * cell); }); }
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      ctx.fillStyle = rampColor(values[r][c], max);
      ctx.fillRect(labW + c * cell + 0.5, labH + r * cell + 0.5, cell - 1, cell - 1);
      if (cellText && cell >= 22) {
        const t = cellText(r, c); if (t) {
          ctx.fillStyle = inkOn(rampColor(values[r][c], max)); ctx.font = `600 ${Math.min(13, cell * 0.36)}px Archivo, sans-serif`; ctx.textAlign = "center";
          ctx.fillText(t, labW + (c + 0.5) * cell, labH + (r + 0.5) * cell); ctx.font = mono;
        }
      }
    }
    ctx.strokeStyle = css("--rule"); ctx.lineWidth = 1; ctx.strokeRect(labW + 0.5, labH + 0.5, C * cell, R * cell);
    for (const { r, c, color, width: lw = 2.5 } of hl) {
      ctx.strokeStyle = color || css("--flip"); ctx.lineWidth = lw;
      ctx.strokeRect(labW + c * cell + 1.2, labH + r * cell + 1.2, cell - 2.4, cell - 2.4);
    }
  }
  const cellAt = (x, y) => { const c = Math.floor((x - labW) / cell), r = Math.floor((y - labH) / cell); return r >= 0 && r < R && c >= 0 && c < C ? { r, c } : null; };
  if (onTap) canvas.addEventListener("pointerdown", (e) => { const b = canvas.getBoundingClientRect(); const hit = cellAt(e.clientX - b.left, e.clientY - b.top); if (hit) onTap(hit); });
  canvas.dataset.noswipe = "";
  redraw();
  return { redraw, cellAt, cell, labW, labH };
}

/** Contact map of length L. pairs: [[i,j]] (0-based). Blocks drawn on the upper triangle. */
export function contactMapCanvas(canvas, { L, pairs, width, blocks = [], marks = [], onTap }) {
  const pad = 30, top = 8, S = Math.max(160, Math.min(width - pad - 4, 560));
  const W = pad + S + 4, H = top + S + pad;
  const ctx = fitCanvas(canvas, W, H);
  const img = document.createElement("canvas"); img.width = L; img.height = L;
  const ictx = img.getContext("2d"), id = ictx.createImageData(L, L);
  const hex = (s) => { const m = s.replace("#", ""); return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)]; };
  let sel = null;
  function paint(highlightResidue = sel) {
    sel = highlightResidue;
    const bg = hex(css("--cell-0").length === 7 ? css("--cell-0") : "#ffffff"), fg = hex(css("--cell-4")), bl = hex(css("--teal")), hi = hex(css("--flip"));
    for (let k = 0; k < L * L; k++) id.data.set([...bg, 255], k * 4);
    const put = (r, c, col) => { if (r < L && c < L) id.data.set([...col, 255], (r * L + c) * 4); };
    for (const [i, j] of pairs) { put(i, j, fg); put(j, i, fg); }
    for (const b of blocks) { const col = b.color ? hex(b.color) : bl; for (let i = b.i0; i < b.i1; i++) for (let j = b.j0; j < b.j1; j++) { put(i, j, col); if (b.mirror) put(j, i, col); } }
    if (sel !== null) for (const [i, j] of pairs) { if (i === sel || j === sel) { put(i, j, hi); put(j, i, hi); } }
    for (const [i, j] of marks) { put(i, j, hi); put(j, i, hi); }
    ictx.putImageData(id, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, pad, top, S, S);
    ctx.strokeStyle = css("--rule"); ctx.strokeRect(pad + 0.5, top + 0.5, S, S);
    ctx.beginPath(); ctx.moveTo(pad, top); ctx.lineTo(pad + S, top + S); ctx.strokeStyle = css("--rule"); ctx.stroke();
    ctx.fillStyle = css("--ink-3"); ctx.font = `500 11px Archivo, sans-serif`; ctx.textBaseline = "middle";
    const step = L > 400 ? 100 : L > 150 ? 50 : L > 60 ? 20 : 10;
    for (let r = 0; r < L; r += step) {
      const y = top + ((r + 0.5) / L) * S, x = pad + ((r + 0.5) / L) * S;
      ctx.textAlign = "right"; ctx.fillText(String(r), pad - 5, y);
      ctx.textAlign = "center"; ctx.fillText(String(r), x, top + S + 12);
    }
  }
  paint();
  const at = (x, y) => { const j = Math.floor(((x - pad) / S) * L), i = Math.floor(((y - top) / S) * L); return i >= 0 && i < L && j >= 0 && j < L ? { i, j } : null; };
  if (onTap) canvas.addEventListener("pointerdown", (e) => { const b = canvas.getBoundingClientRect(); const hit = at(e.clientX - b.left, e.clientY - b.top); if (hit) onTap(hit); });
  canvas.dataset.noswipe = "";
  return { paint, at, S, pad };
}

/** Simple horizontal bar pair list: [{label, value, color}] with values as fractions. */
export function barsSVG(items, { width = 320, max = null, fmt = (v) => `${(100 * v).toFixed(1)}%` } = {}) {
  const rowH = 30, lw = Math.min(width * 0.56, Math.max(...items.map((d) => String(d.label).length)) * 6.9 + 12), mx = max ?? Math.max(...items.map((d) => d.value), 1e-9);
  const H = items.length * rowH + 4, bw = width - lw - 64;
  const rows = items.map((d, k) => {
    const y = k * rowH + 6, len = Math.max(2, (d.value / mx) * bw);
    return `<text x="${lw - 8}" y="${y + 12}" text-anchor="end" style="font:500 13px Archivo,sans-serif;fill:var(--ink-2)">${d.label}</text>
      <rect x="${lw}" y="${y + 3}" width="${len}" height="12" rx="3" style="fill:${d.color || "var(--ink)"}"/>
      <text x="${lw + len + 6}" y="${y + 13}" style="font:700 13px Archivo,sans-serif;fill:var(--ink)">${fmt(d.value)}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${H}" width="100%" style="max-width:${Math.round(width * 1.45)}px" role="img">${rows}</svg>`;
}
