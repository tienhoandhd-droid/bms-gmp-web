// check-ui-contrast.mjs — GATE CONTRAST WCAG trên CẶP TOKEN THẬT, cả Light lẫn Dark.
// (Bản CI của gate 2 trong scripts/kiem-mau.mjs — đặt ở kiemtra-ui/ để được commit.)
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/theme/tokens.css", import.meta.url), "utf8");
const pick = (block) => {
  const m = {};
  for (const [, k, v] of block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) if (!(k in m)) m[k] = v;
  return m;
};
const darkMatch = css.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
const light = pick(css.slice(0, darkMatch.index));
const dark = pick(darkMatch[1]);

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const CAP = [
  ["text-strong", "bg-surface", 4.5], ["text-default", "bg-surface", 4.5], ["text-muted", "bg-surface", 4.5],
  ["text-default", "bg-canvas", 4.5], ["text-muted", "bg-subtle", 4.5], ["text-default", "bg-subtle", 4.5],
  ["danger", "danger-soft", 4.5], ["warning", "warning-soft", 4.5],
  ["success", "success-soft", 4.5], ["info", "info-soft", 4.5], ["missing", "missing-soft", 4.5],
  ["danger", "bg-surface", 4.5], ["warning", "bg-surface", 4.5], ["success", "bg-surface", 4.5], ["info", "bg-surface", 4.5],
  ["text-inverse", "primary", 4.5], ["anchor-fg", "anchor", 4.5],
  ["border-strong", "bg-surface", 3], ["focus", "bg-surface", 3],
];
const WHITE_TREN = ["danger-solid", "primary-solid", "info-solid"];

let loi = 0;
for (const [ten, t] of [["LIGHT", light], ["DARK", dark]]) {
  for (const [fg, bg, min] of CAP) {
    if (!t[fg] || !t[bg]) continue;
    const r = ratio(t[fg], t[bg]);
    if (r < min) { console.log(`❌ ${ten} ${fg}/${bg} = ${r.toFixed(2)} < ${min}`); loi++; }
  }
  for (const bg of WHITE_TREN) {
    if (!t[bg]) continue;
    const r = ratio("#FFFFFF", t[bg]);
    if (r < 4.5) { console.log(`❌ ${ten} trắng/${bg} = ${r.toFixed(2)} < 4.5`); loi++; }
  }
}
console.log(loi ? `✗ check:contrast — ${loi} cặp trượt` : "✓ check:contrast — đạt cả 2 theme");
process.exit(loi ? 1 : 0);
