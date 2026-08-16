// check-ui-colors.mjs — GATE MÀU (báo cáo 10, UI-10). Chạy trong CI.
// Cấm trong src/**/*.jsx|js: class màu Tailwind thô + hex literal — màu phải đi qua
// semantic token (tokens.css). Ngoại lệ: file theme/legacy trong ALLOW_FILES, hoặc dòng
// có chú thích ui-color-exception / chart-color-exception / token-ngoai-le.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const GOC = new URL("..", import.meta.url).pathname; // web/
const BAN_CLASS = /\b(bg-white(?!\/(?:10|15|25)\b)|text-slate-\d+|bg-slate-(?:50|100|200|300|700|800)\b|text-rose-[4-9]\d*|bg-rose-\d+|text-teal-\d+|bg-teal-\d+|text-amber-[4-9]\d*|bg-amber-\d+|text-sky-[4-9]\d*|bg-sky-\d+|ring-slate-\d+|ring-teal-\d+|ring-rose-\d+|ring-amber-\d+|ring-sky-\d+|text-emerald-\d+|bg-emerald-\d+|bg-violet-\d+|text-violet-\d+)\b/;
const BAN_HEX = /#[0-9a-fA-F]{6}\b/;
const ALLOW_FILES = [
  "src/theme/", // tokens + chartTheme (fallback hex khi chưa có DOM)
  "src/lib/designTokens.js", // hex cho canvas ECharts + COMPLY_SCALE (khớp email WF)
  "src/lib/theme.js", // legacy compatibility
  "src/lib/moPhong.js", // dữ liệu demo
  "src/lib/hoSoCum.js", // hồ sơ BẢN IN — cửa sổ in không có tokens.css, nền trắng có chủ đích
  "src/components/TVMode.jsx", // màn TV treo tường — bảng màu tối cố định riêng, xem từ xa (P2)
  "src/datlai/", "src/action/", // 2 trang email siêu nhẹ, light cố định, không tải theme app
  "src/ErrorBoundary.jsx", // màn CRASH — phải tự đứng, không phụ thuộc token đã tải hay chưa
];
const NGOAI_LE = /ui-color-exception|chart-color-exception|token-ngoai-le/;

function* duyet(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) yield* duyet(p);
    else if (/\.(jsx|js)$/.test(f)) yield p;
  }
}

let loi = 0;
for (const p of duyet(join(GOC, "src"))) {
  const rel = p.slice(GOC.length);
  if (ALLOW_FILES.some((a) => rel.startsWith(a))) continue;
  const lines = readFileSync(p, "utf8").split("\n");
  let tat = false; // vùng /* mau:off */ … /* mau:on */ (CSS bản in nhúng trong template)
  lines.forEach((l, i) => {
    if (l.includes("mau:off")) { tat = true; return; }
    if (l.includes("mau:on")) { tat = false; return; }
    if (tat) return;
    const t = l.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
    if (NGOAI_LE.test(l)) return;
    if (l.includes("layToken(")) return; // fallback hex khi DOM chưa có — token là nguồn chính
    if (BAN_CLASS.test(l)) { console.log(`❌ ${rel}:${i + 1} class màu thô: ${t.slice(0, 110)}`); loi++; }
    else if (BAN_HEX.test(l)) { console.log(`❌ ${rel}:${i + 1} hex literal: ${t.slice(0, 110)}`); loi++; }
  });
}
console.log(loi ? `✗ check:colors — ${loi} vi phạm` : "✓ check:colors — sạch");
process.exit(loi ? 1 : 0);
