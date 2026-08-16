// test-ui.mjs — BỘ KIỂM UX/UI RUNTIME (báo cáo 10 §Automated visual testing).
// Chạy app ở CHẾ ĐỘ DEMO (không cần đăng nhập) rồi kiểm bằng trình duyệt thật:
//   1. Không pageerror (ReferenceError/undefined…) trên 10 tab × 2 theme × 3 viewport.
//   2. Không tràn ngang toàn trang (scrollWidth ≤ viewport).
//   3. Dark mode: nền body phải TỐI thật (không kẹt light).
//   4. Không lộ thuật ngữ hạ tầng trong văn bản render (Supabase/n8n/WF*/rpc_).
//   5. Tap target bottom-nav mobile ≥ 40px cao.
//   6. Focus hiển thị: phần tử đầu nhận Tab phải có outline.
// Cách chạy:  node kiemtra-ui/test-ui.mjs [baseUrl]
//   Không truyền baseUrl → tự build demo (--mode kiemtra, env rỗng) + vite preview.
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";

const GOC = new URL("..", import.meta.url).pathname;
const TABS = ["home", "tasks", "events", "recent", "sensors", "trend", "reports", "audit", "recipients", "settings"];
const VIEWPORTS = [[1440, 900], [768, 1024], [390, 844]];
const CAM_RUNTIME = ["Supabase", "n8n", "WF1", "WF5", "WF6", "WF7", "WF8", "rpc_", "webhook"];

function timChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  try { return puppeteer.executablePath(); } catch { return undefined; }
}

let server = null, base = process.argv[2];
async function moServer() {
  if (base) return;
  console.log("· build bản demo (env rỗng) để kiểm không cần đăng nhập…");
  execSync("npx vite build --outDir dist-kiemtra", {
    cwd: GOC, stdio: "inherit",
    env: { ...process.env, VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  });
  server = spawn("npx", ["vite", "preview", "--outDir", "dist-kiemtra", "--port", "4189", "--strictPort"], { cwd: GOC, stdio: "ignore" });
  base = "http://localhost:4189";
  await new Promise((r) => setTimeout(r, 2500));
}

const loi = [];
function ghi(msg) { loi.push(msg); console.log("❌ " + msg); }

try {
  await moServer();
  const browser = await puppeteer.launch({ executablePath: timChrome(), headless: "new", args: ["--no-sandbox"] });
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage();
    const pageErrs = [];
    page.on("pageerror", (e) => pageErrs.push(String(e).slice(0, 160)));
    // Service worker có thể tự cập nhật giữa chừng làm reload trang → bỏ qua SW khi kiểm.
    try { const client = await page.createCDPSession(); await client.send("Network.setBypassServiceWorker", { bypass: true }); } catch { /* CDP không sẵn — bỏ qua */ }
    await page.evaluateOnNewDocument((t) => { try { localStorage.setItem("bms-theme", t); } catch {} }, theme);
    for (const [w, h] of VIEWPORTS) {
      await page.setViewport({ width: w, height: h });
      for (const tab of TABS) {
        let taiOk = false;
        for (let lan = 0; lan < 2 && !taiOk; lan++) {
          try { await page.goto(`${base}/?tab=${tab}`, { waitUntil: "domcontentloaded", timeout: 45000 }); taiOk = true; }
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
console.log(loi.length ? `✗ test:ui — ${loi.length} lỗi` : "✓ test:ui — 10 tab × 2 theme × 3 viewport đạt");
process.exit(loi.length ? 1 : 0);
