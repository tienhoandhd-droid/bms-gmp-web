// test-ui.mjs — BỘ KIỂM UX/UI RUNTIME (báo cáo 10 §Automated visual testing).
// Chạy app ở CHẾ ĐỘ DEMO (không cần đăng nhập) rồi kiểm bằng trình duyệt thật:
//   1. Không pageerror (ReferenceError/undefined…) trên 10 tab × 2 theme × 3 viewport.
//   2. Không tràn ngang toàn trang (scrollWidth ≤ viewport).
//   3. Dark mode: nền body phải TỐI thật (không kẹt light).
//   4. Không lộ thuật ngữ hạ tầng trong văn bản render (Supabase/n8n/WF*/rpc_).
//   5. Tap target bottom-nav mobile ≥ 40px cao.
//   6. Focus hiển thị: phần tử đầu nhận Tab phải có outline.
//   7. (đợt B 04/09/2026) axe-core WCAG 2.2 AA: 0 vi phạm mức critical/serious/moderate
//      trên 10 tab × 2 theme × 2 viewport (1440, 390). axe tải từ cdnjs, GHIM phiên bản +
//      sha256 (không thêm devDependency); nạp qua page.evaluate nên KHÔNG bị CSP của trang chặn
//      và lỗi CSP thật vẫn hiện. Không mạng ⇒ test FAIL rõ ràng (BMS_BO_AXE=1 để bỏ qua khi làm offline).
// Cách chạy:  node kiemtra-ui/test-ui.mjs [baseUrl]
//   Không truyền baseUrl → tự build demo (--mode kiemtra, env rỗng) + vite preview.
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";
import { createHash } from "node:crypto";

const AXE_URL = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js";
const AXE_SHA256 = "b511cd9dec01c76f4b2ad1723b66b6db37d4c2eb4ed199076e1829d9ee7b75e3";
async function taiAxe() {
  if (process.env.BMS_BO_AXE === "1") { console.log("⚠ BMS_BO_AXE=1 — bỏ qua kiểm axe-core"); return null; }
  const r = await fetch(AXE_URL);
  if (!r.ok) throw new Error(`không tải được axe-core (${r.status})`);
  const src = await r.text();
  const h = createHash("sha256").update(src).digest("hex");
  if (h !== AXE_SHA256) throw new Error(`axe-core sha256 lệch (${h.slice(0, 12)}…) — phiên bản CDN đổi, cập nhật AXE_SHA256 sau khi rà`);
  return src;
}
// Vi phạm được coi là LỖI: critical/serious/moderate. "minor" và best-practice chỉ cảnh báo.
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const GOC = new URL("..", import.meta.url).pathname;
const TABS = ["home", "tasks", "events", "recent", "sensors", "trend", "reports", "audit", "recipients", "settings"];
// Đợt D 04/09/2026: kiểm cả 3 trang ngoài dashboard (trước đây là vùng mù): bấm từ email, đặt lại mật khẩu, màn treo tường.
const TRANG = [...TABS.map((t) => ({ ten: t, url: `/?tab=${t}` })), { ten: "action", url: "/action.html" }, { ten: "datlai", url: "/datlai.html" }, { ten: "tv", url: "/?tv=1" }];
const VIEWPORTS = [[1440, 900], [768, 1024], [390, 844]];
const CAM_RUNTIME = ["Supabase", "n8n", "WF1", "WF5", "WF6", "WF7", "WF8", "rpc_", "webhook"];

async function timChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  try { return await puppeteer.executablePath(); } catch { return undefined; }
}

let server = null, base = process.argv[2];
async function moServer() {
  if (base) return;
  // Build vào dist/ MẶC ĐỊNH: plugin sinh sw.js trong vite.config đọc cứng thư mục dist.
  // An toàn: trong CI, bản production được build lại SAU bước kiểm này nên không lẫn demo.
  console.log("· build bản demo (env rỗng) để kiểm không cần đăng nhập…");
  execSync("npx vite build", {
    cwd: GOC, stdio: "inherit",
    env: { ...process.env, VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  });
  server = spawn("npx", ["vite", "preview", "--port", "4189", "--strictPort"], { cwd: GOC, stdio: "ignore" });
  base = "http://localhost:4189";
  await new Promise((r) => setTimeout(r, 2500));
}

const loi = [];
function ghi(msg) { loi.push(msg); console.log("❌ " + msg); }

try {
  const axeSrc = await taiAxe();
  await moServer();
  const browser = await puppeteer.launch({ executablePath: await timChrome(), headless: "new", args: ["--no-sandbox"] });
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage();
    const pageErrs = [];
    page.on("pageerror", (e) => pageErrs.push(String(e).slice(0, 160)));
    // Service worker có thể tự cập nhật giữa chừng làm reload trang → bỏ qua SW khi kiểm.
    try { const client = await page.createCDPSession(); await client.send("Network.setBypassServiceWorker", { bypass: true }); } catch { /* CDP không sẵn — bỏ qua */ }
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("bms-theme", t); } catch {} }, theme);
    for (const [w, h] of VIEWPORTS) {
      await page.setViewport({ width: w, height: h });
      for (const { ten: tab, url } of TRANG) {
        let taiOk = false;
        for (let lan = 0; lan < 2 && !taiOk; lan++) {
          try { await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded", timeout: 45000 }); taiOk = true; }
          catch { await new Promise((r) => setTimeout(r, 800)); }
        }
        if (!taiOk) { ghi(`${theme} ${w}px ${tab}: không tải được trang`); continue; }
        await new Promise((r) => setTimeout(r, 1100));
        let kq;
        try { kq = await page.evaluate((camList) => {
          const sw = document.documentElement.scrollWidth;
          const bg = getComputedStyle(document.body).backgroundColor;
          const text = document.body.innerText || "";
          const cam = camList.filter((t) => text.includes(t));
          return { sw, bg, cam };
        }, CAM_RUNTIME); } catch { ghi(`${theme} ${w}px ${tab}: evaluate thất bại (trang reload giữa chừng)`); continue; }
        if (kq.sw > w) ghi(`${theme} ${w}px ${tab}: tràn ngang (scrollWidth=${kq.sw})`);
        if (kq.cam.length) ghi(`${theme} ${w}px ${tab}: lộ thuật ngữ hạ tầng: ${kq.cam.join(", ")}`);
        // 7. axe-core — chỉ 1440 và 390 (768 trùng kết quả, tiết kiệm thời gian CI)
        if (axeSrc && w !== 768) {
          try {
            await page.evaluate(axeSrc);
            const vi = await page.evaluate(async (tags) => {
              const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
              return r.violations
                .filter((v) => ["critical", "serious", "moderate"].includes(v.impact))
                .map((v) => `${v.id}(${v.impact})×${v.nodes.length}: ${v.nodes[0].html.replace(/\s+/g, " ").slice(0, 100)}`);
            }, AXE_TAGS);
            if (vi.length) ghi(`${theme} ${w}px ${tab}: axe — ${vi.join(" | ")}`);
          } catch (e) { ghi(`${theme} ${w}px ${tab}: axe không chạy được — ${String(e.message || e).slice(0, 120)}`); }
        }
        if (theme === "dark") {
          const m = kq.bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (m && (+m[1] + +m[2] + +m[3]) / 3 > 128) ghi(`dark ${w}px ${tab}: nền body vẫn sáng (${kq.bg})`);
        }
        if (w === 390 && tab === "home") {
          const nav = await page.evaluate(() => {
            const el = document.querySelector('nav[aria-label="Điều hướng chính"].lg\\:hidden, nav.lg\\:hidden');
            if (!el) return null;
            const btn = el.querySelector("button");
            return btn ? btn.getBoundingClientRect().height : null;
          });
          if (nav != null && nav < 40) ghi(`mobile bottom-nav tap target thấp: ${Math.round(nav)}px < 40px`);
        }
      }
    }
    // 6. focus-visible: Tab lần đầu ở desktop home
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${base}/?tab=home`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.keyboard.press("Tab");
    const focusOk = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return false;
      const st = getComputedStyle(el);
      return st.outlineStyle !== "none" || st.boxShadow !== "none";
    });
    if (!focusOk) ghi(`${theme}: phần tử nhận Tab đầu tiên không có chỉ báo focus`);
    if (pageErrs.length) ghi(`${theme}: pageerror — ${[...new Set(pageErrs)].slice(0, 3).join(" | ")}`);
    await page.close();
  }
  await browser.close();
} finally {
  if (server) server.kill();
}
console.log(loi.length ? `✗ test:ui — ${loi.length} lỗi` : "✓ test:ui — 13 trang × 2 theme × 3 viewport + axe WCAG 2.2 AA đạt");
process.exit(loi.length ? 1 : 0);
