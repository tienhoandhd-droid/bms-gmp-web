// check-bundle.mjs — NGÂN SÁCH KÍCH THƯỚC BUNDLE (đợt D 04/09/2026).
// Vì sao: web chạy trên điện thoại/4G của người trực ca; bundle phình dần qua các đợt
// nâng cấp mà không ai thấy (chunk charts đã 744 KB thô). Gate này đo dist/ SAU build và
// CHẶN deploy nếu vượt ngưỡng gzip. Ngưỡng đặt trên số đo 04/09/2026 + ~15% dư.
// Chạy: npm run check:bundle  (sau npm run build)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const DIST = resolve(new URL("..", import.meta.url).pathname, "dist/assets");
// Ngưỡng gzip (KB) theo TIỀN TỐ tên chunk. main = AppShell + 5 tab inline; react; charts (ECharts, lazy).
const NGUONG_KB = { main: 92, react: 70, charts: 260, supabase: 62, TrendPage: 25, supabaseData: 13, icons: 8 };
// Tổng JS tải ở MÀN HÌNH ĐẦU (không tính chunk lazy): index + main + react + supabase + supabaseData + icons + vendor.
const MAN_DAU = ["index", "main", "react", "supabase", "supabaseData", "icons", "vendor"];
const NGUONG_MAN_DAU_KB = 225;

let files;
try { files = readdirSync(DIST).filter((f) => f.endsWith(".js")); }
catch (e) { console.error("✗ check:bundle — chưa có dist/assets (chạy npm run build trước):", e.message); process.exit(1); }

const gz = (f) => Math.round(gzipSync(readFileSync(resolve(DIST, f))).length / 1024 * 10) / 10;
const loi = [];
let tongManDau = 0;
const dong = [];
for (const f of files.sort()) {
  const ten = f.replace(/-[A-Za-z0-9_-]+\.js$/, "");
  const kb = gz(f);
  const raw = Math.round(statSync(resolve(DIST, f)).size / 1024);
  const nguong = NGUONG_KB[ten];
  if (MAN_DAU.includes(ten)) tongManDau += kb;
  const vuot = nguong != null && kb > nguong;
  if (vuot) loi.push(`${f}: ${kb} KB gzip > ngưỡng ${nguong} KB`);
  dong.push(`  ${vuot ? "❌" : "·"} ${ten.padEnd(14)} ${String(kb).padStart(6)} KB gzip (${raw} KB thô)${nguong != null ? ` / ngưỡng ${nguong}` : ""}`);
}
console.log(dong.join("\n"));
console.log(`  màn hình đầu: ${Math.round(tongManDau * 10) / 10} KB gzip / ngưỡng ${NGUONG_MAN_DAU_KB} KB`);
if (tongManDau > NGUONG_MAN_DAU_KB) loi.push(`JS màn hình đầu ${Math.round(tongManDau)} KB gzip > ${NGUONG_MAN_DAU_KB} KB`);
if (loi.length) { console.log("✗ check:bundle — " + loi.join(" | ")); process.exit(1); }
console.log("✓ check:bundle — trong ngân sách");
