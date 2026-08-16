// check-ui-copy.mjs — GATE TỪ NGỮ (báo cáo 10, Phase F). Chạy trong CI.
// Chuỗi HIỂN THỊ cho người vận hành không được chứa thuật ngữ hạ tầng/AI-marketing.
// Chỉ quét dòng có khả năng là text hiển thị (trong chuỗi "..."/'...'/`...` hoặc JSX text);
// comment được miễn. Ngoại lệ: file TechnicalDetails, hoặc dòng có `copy-exception`.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const GOC = new URL("..", import.meta.url).pathname;
const CAM = [
  "Supabase", "n8n", "webhook", "fallback", "WF1", "WF5", "WF6", "WF7", "WF8", "WF10",
  "rpc_", "AI phân tích", "Phân tích AI", "BẾ TẮC", "đứng hình", "Chế độ thử nghiệm",
  "Xu hướng & tuân thủ", "Người nhận thông báo",
];
const ALLOW_FILES = ["src/components/ui/TechnicalDetails.jsx", "src/lib/", "src/hooks/", "src/action/", "src/datlai/"];
const NGOAI_LE = /copy-exception/;

function* duyet(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) yield* duyet(p);
    else if (/\.jsx$/.test(f)) yield p;
  }
}

// dòng "hiển thị": có chuỗi văn bản chứa từ cấm (trong nháy hoặc JSX >text<)
function hienThi(line, tu) {
  const idx = line.indexOf(tu);
  if (idx < 0) return false;
  // fallback={…} là prop React.Suspense, không phải chữ hiển thị
  if (tu === "fallback" && line.slice(idx).startsWith("fallback={")) return false;
  const truoc = line.slice(0, idx);
  // trong comment → bỏ
  if (/^\s*(\/\/|\*|\/\*)/.test(line)) return false;
  if (truoc.includes("//")) return false;
  // heuristics: từ cấm nằm trong chuỗi nháy hoặc giữa >…< của JSX
  const trongNhay = (truoc.split('"').length + truoc.split("'").length + truoc.split("`").length) % 2 === 1;
  const trongJsxText = />[^<]*$/.test(truoc);
  return trongNhay || trongJsxText;
}

let loi = 0;
for (const p of duyet(join(GOC, "src"))) {
  const rel = p.slice(GOC.length);
  if (ALLOW_FILES.some((a) => rel.startsWith(a))) continue;
  const lines = readFileSync(p, "utf8").split("\n");
  let trongCmt = false; // khối {/* … */} hoặc /* … */ nhiều dòng
  lines.forEach((l, i) => {
    if (trongCmt) { if (l.includes("*/")) trongCmt = false; return; }
    if (/\{?\/\*(?![\s\S]*\*\/)/.test(l)) { trongCmt = true; return; }
    if (/^\s*\{?\/\*/.test(l) && l.includes("*/")) return;
    if (NGOAI_LE.test(l)) return;
    for (const tu of CAM) {
      if (hienThi(l, tu)) { console.log(`❌ ${rel}:${i + 1} lộ "${tu}": ${l.trim().slice(0, 110)}`); loi++; break; }
    }
  });
}
console.log(loi ? `✗ check:copy — ${loi} vi phạm` : "✓ check:copy — sạch");
process.exit(loi ? 1 : 0);
