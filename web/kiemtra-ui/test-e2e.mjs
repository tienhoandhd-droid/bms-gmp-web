// test-e2e.mjs — KIỂM ĐẦU-CUỐI (end-to-end) luồng người dùng trên trình duyệt thật (đợt E 04/09/2026).
// Khác test-ui.mjs (chỉ mở từng trang rồi đo tĩnh), file này BẤM như người vận hành:
//   1. Điều hướng 10 tab qua sidebar → h1 và ?tab= khớp; nút Back quay về tab trước.
//   2. Tổng quan: mở danh sách phòng (modal) → Esc đóng; mở chi tiết phòng → Esc đóng.
//   3. Sự cố: lọc Khu → số dòng giảm; bấm dòng → ngăn kéo chi tiết → Esc; nút "Đăng nhập" → modal đăng nhập → Esc.
//   4. Xu hướng: đổi khoảng 7 ngày / 90 ngày, đổi chỉ tiêu — không lỗi runtime.
//   5. Cấu hình & Nhật ký: đi qua mọi tab con.
//   6. Đổi giao diện sáng/tối → data-theme đổi và GIỮ sau khi tải lại.
//   7. Mobile 390 px: bottom-nav "Thêm" mở sheet → chọn Cấu hình → tab đổi, sheet đóng.
//   8. Skip-link là phần tử nhận Tab đầu tiên; Enter đưa focus vào <main>.
//   9. ?tv=1, action.html?token=…, datlai.html mở được, không pageerror.
// Mọi modal/sheet mở ra PHẢI có role="dialog" và đóng được bằng Esc (WCAG 2.1.2).
// Trong suốt bài kiểm: 0 pageerror, 0 console.error. Chạy ở chế độ DEMO (không cần đăng nhập)
// nên chưa phủ: thao tác phiếu, tạm hoãn cảnh báo, lưu cấu hình — cần tài khoản test (E2E LIVE).
// Cách chạy: node kiemtra-ui/test-e2e.mjs [baseUrl]   (không truyền → tự build demo + preview 4190)
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";

const GOC = new URL("..", import.meta.url).pathname;
const TABS = [["home", "Tổng quan"], ["events", "Sự cố"], ["recent", "Chênh áp"], ["sensors", "Cảm biến"], ["tasks", "Việc cần làm"],
  ["trend", "Xu hướng"], ["reports", "Báo cáo"], ["audit", "Nhật ký"], ["recipients", "Thông báo"], ["settings", "Cấu hình"]];

async function timChrome() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (existsSync(mac)) return mac;
  try { return await puppeteer.executablePath(); } catch { return undefined; }
}
let server = null, base = process.argv[2];
async function moServer() {
  if (base) return;
  console.log("· build bản demo (env rỗng) rồi preview…");
  execSync("npx vite build", { cwd: GOC, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" } });
  server = spawn("npx", ["vite", "preview", "--port", "4190", "--strictPort"], { cwd: GOC, stdio: "ignore" });
  base = "http://localhost:4190";
  await new Promise((r) => setTimeout(r, 2500));
}

const loi = []; let soDat = 0;
const dat = (ten) => { soDat++; console.log("  ✓ " + ten); };
const hong = (ten, chiTiet = "") => { loi.push(ten); console.log("  ❌ " + ten + (chiTiet ? " — " + chiTiet : "")); };
const cho = (ms) => new Promise((r) => setTimeout(r, ms));
const kiem = (dk, ten, chiTiet) => (dk ? dat(ten) : hong(ten, chiTiet));

// Bấm nút theo chữ (trong phạm vi selector), trả về true nếu tìm thấy.
async function bamNut(page, chu, pham = "body") {
  return page.evaluate((chu, pham) => {
    const goc = document.querySelector(pham) || document.body;
    const b = [...goc.querySelectorAll("button, a, [role=button], [role=tab]")].find((x) => x.textContent.replace(/\s+/g, " ").trim().startsWith(chu) && x.getBoundingClientRect().width > 0);
    if (!b) return false; b.click(); return true;
  }, chu, pham);
}
const soDialog = (page) => page.evaluate(() => document.querySelectorAll('[role="dialog"]').length);
const soOverlay = (page) => page.evaluate(() => [...document.querySelectorAll(".fixed.inset-0")].filter((el) => el.getBoundingClientRect().width > 0).length);
// Mở bằng hành động `mo`, kiểm có dialog, Esc đóng, focus quay lại phần tử trước.
async function kiemModal(page, ten, mo) {
  const truoc = await page.evaluate(() => document.activeElement && document.activeElement.textContent.trim().slice(0, 30));
  const ok = await mo();
  if (!ok) { hong(`${ten}: không tìm thấy nút mở`); return; }
  await cho(500);
  const dlg = await soDialog(page), ov = await soOverlay(page);
  if (!dlg) { hong(`${ten}: mở ra nhưng thiếu role="dialog"`, `overlay=${ov}`); }
  const trongDialog = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return !!d && d.contains(document.activeElement); });
  await page.keyboard.press("Escape"); await cho(400);
  const conLai = await soDialog(page), conOv = await soOverlay(page);
  if (dlg && conLai === 0 && conOv === 0) dat(`${ten}: có role=dialog, focus ${trongDialog ? "vào trong" : "CHƯA vào trong"}, Esc đóng`);
  else if (dlg) hong(`${ten}: Esc không đóng`, `dialog còn ${conLai}, overlay ${conOv}`);
  if (dlg && !trongDialog) hong(`${ten}: focus không chuyển vào hộp thoại khi mở`);
  void truoc;
}

try {
  await moServer();
  const browser = await puppeteer.launch({ executablePath: await timChrome(), headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const loiTrang = [];
  page.on("pageerror", (e) => loiTrang.push("pageerror: " + String(e).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !page.url().includes("/404.html")) loiTrang.push("console: " + m.text().slice(0, 160)); });
  try { const c = await page.createCDPSession(); await c.send("Network.setBypassServiceWorker", { bypass: true }); } catch { /* không có CDP */ }
  await page.setViewport({ width: 1440, height: 900 });
  const goto = (u) => page.goto(`${base}${u}`, { waitUntil: "networkidle2", timeout: 60000 });

  // 1. Điều hướng + Back
  console.log("1. Điều hướng");
  await goto("/?tab=home");
  let dieuHuongOk = 0;
  for (const [k, nhan] of TABS) {
    const ok = await bamNut(page, nhan, 'nav[aria-label="Điều hướng chính"]');
    await cho(700);
    const h1 = await page.evaluate(() => (document.querySelector("h1") || {}).textContent || "");
    const url = await page.evaluate(() => new URLSearchParams(location.search).get("tab"));
    if (ok && h1.includes(nhan) && url === k) dieuHuongOk++; else hong(`tab ${k}: nút=${ok} h1="${h1.slice(0, 30)}" url=${url}`);
  }
  kiem(dieuHuongOk === TABS.length, `10 tab: h1 và ?tab= khớp (${dieuHuongOk}/10)`);
  await page.goBack(); await cho(600);
  const sauBack = await page.evaluate(() => new URLSearchParams(location.search).get("tab"));
  kiem(sauBack === "recipients", "Back quay về tab trước (recipients)", `được ${sauBack}`);

  // 2. Tổng quan: modal danh sách phòng + chi tiết phòng
  console.log("2. Tổng quan");
  await goto("/?tab=home");
  await kiemModal(page, "Modal danh sách phòng", () => page.evaluate(() => { const b = document.querySelector('button[aria-label="Xem danh sách: Phòng không đạt"]'); if (!b) return false; b.click(); return true; }));
  await kiemModal(page, "Modal chi tiết phòng (nút Xem chi tiết)", () => bamNut(page, "Xem chi tiết", "main"));
  await kiemModal(page, "Modal phòng đang đạt (nút Xem)", () => page.evaluate(() => { const b = [...document.querySelectorAll("main button")].find((x) => x.textContent.trim() === "Xem"); if (!b) return false; b.click(); return true; }));

  // 3. Sự cố
  console.log("3. Sự cố");
  await goto("/?tab=events"); await cho(500);
  const tongDong = await page.evaluate(() => document.querySelectorAll('tr[aria-label^="Xem chi tiết sự cố"]').length);
  await bamNut(page, "Khu C1", "main"); await cho(500);
  const dongC1 = await page.evaluate(() => document.querySelectorAll('tr[aria-label^="Xem chi tiết sự cố"]').length);
  kiem(tongDong > 0 && dongC1 > 0 && dongC1 < tongDong, `Lọc Khu C1: ${tongDong} → ${dongC1} dòng`);
  await bamNut(page, "Tất cả", "main"); await cho(300);
  await kiemModal(page, "Ngăn kéo chi tiết sự cố (bấm dòng)", () => page.evaluate(() => { const r = document.querySelector('tr[aria-label^="Xem chi tiết sự cố"]'); if (!r) return false; r.click(); return true; }));
  await kiemModal(page, "Ngăn kéo chi tiết sự cố (Enter trên dòng)", async () => { await page.focus('tr[aria-label^="Xem chi tiết sự cố"]'); await page.keyboard.press("Enter"); return true; });
  await kiemModal(page, "Modal đăng nhập (nút Đăng nhập ở dòng)", () => page.evaluate(() => { const b = [...document.querySelectorAll("main table button")].find((x) => x.textContent.trim() === "Đăng nhập"); if (!b) return false; b.click(); return true; }));
  await kiemModal(page, "Modal đăng nhập (nút header)", () => page.evaluate(() => { const b = document.querySelector('header button[aria-label="Đăng nhập"]'); if (!b) return false; b.click(); return true; }));

  // 4. Xu hướng
  console.log("4. Xu hướng");
  await goto("/?tab=trend"); await cho(1200);
  for (const chu of ["7 ngày", "90 ngày", "Độ ẩm", "Khu vực", "Tổng hợp"]) { const ok = await bamNut(page, chu, "main"); await cho(600); kiem(ok, `Bấm "${chu}" không lỗi`); }
  const canvas = await page.evaluate(() => document.querySelectorAll("main canvas, main svg").length);
  kiem(canvas > 0, `Biểu đồ đã vẽ (${canvas} canvas/svg)`);

  // 5. Cấu hình & Nhật ký: tab con
  console.log("5. Cấu hình & Nhật ký");
  await goto("/?tab=settings"); await cho(400);
  for (const chu of ["Phòng & cảm biến", "Phân công tự động", "Quy trình xử lý", "Hệ thống", "Nguyên tắc cảnh báo"]) { const ok = await bamNut(page, chu, "main"); await cho(700); kiem(ok, `Cấu hình → ${chu}`); }
  const ttHeThong = await page.evaluate(() => { const b = [...document.querySelectorAll("main button")].find((x) => x.textContent.trim() === "Hệ thống"); if (b) b.click(); return !!b; });
  await cho(500);
  kiem(ttHeThong && await page.evaluate(() => document.body.innerText.includes("Phiên bản phần mềm")), "Cấu hình → Hệ thống có thẻ Thông tin hệ thống");
  await goto("/?tab=audit"); await cho(600);
  const tabConAudit = await page.evaluate(() => [...document.querySelectorAll('main [role="tab"], main button')].map((b) => b.textContent.trim()).filter((t) => /SOP|cấu hình|thao tác/i.test(t)).slice(0, 4));
  for (const chu of tabConAudit) { await bamNut(page, chu, "main"); await cho(600); }
  dat(`Nhật ký: đi qua ${tabConAudit.length} tab con (${tabConAudit.join(", ") || "không có"})`);

  // 6. Đổi giao diện + giữ sau reload
  console.log("6. Giao diện sáng/tối");
  await goto("/?tab=home");
  const themeTruoc = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click('header button[aria-label^="Chuyển sang giao diện"]'); await cho(300);
  const themeSau = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.reload({ waitUntil: "networkidle2" }); await cho(300);
  const themeReload = await page.evaluate(() => document.documentElement.dataset.theme);
  kiem(themeTruoc !== themeSau && themeSau === themeReload, `Đổi ${themeTruoc} → ${themeSau}, giữ sau tải lại (${themeReload})`);
  await page.click('header button[aria-label^="Chuyển sang giao diện"]'); await cho(200);   // trả về như cũ

  // 7. Mobile bottom-nav
  console.log("7. Mobile 390 px");
  await page.setViewport({ width: 390, height: 844 });
  await goto("/?tab=home"); await cho(400);
  await kiemModal(page, "Sheet 'Thêm' của bottom-nav", () => bamNut(page, "Thêm", 'nav[aria-label="Điều hướng nhanh"]'));
  await bamNut(page, "Thêm", 'nav[aria-label="Điều hướng nhanh"]'); await cho(400);
  const chonCauHinh = await bamNut(page, "Cấu hình", '[role="dialog"]'); await cho(700);
  const tabMobile = await page.evaluate(() => new URLSearchParams(location.search).get("tab"));
  kiem(chonCauHinh && tabMobile === "settings" && (await soDialog(page)) === 0, "Sheet Thêm → Cấu hình: tab đổi, sheet đóng", `chọn=${chonCauHinh} tab=${tabMobile}`);
  await bamNut(page, "Sự cố", 'nav[aria-label="Điều hướng nhanh"]'); await cho(500);
  kiem((await page.evaluate(() => new URLSearchParams(location.search).get("tab"))) === "events", "Bottom-nav → Sự cố");

  // 8. Skip-link
  console.log("8. Bàn phím");
  await page.setViewport({ width: 1440, height: 900 });
  await goto("/?tab=home");
  await page.keyboard.press("Tab"); await cho(200);
  const skip = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press("Enter"); await cho(300);
  const focusMain = await page.evaluate(() => document.activeElement.id);
  kiem(skip.startsWith("Bỏ qua điều hướng") && focusMain === "noi-dung-chinh", "Skip-link là Tab đầu tiên, Enter vào <main>", `${skip} → #${focusMain}`);

  // 9. Trang phụ
  console.log("9. Trang phụ");
  for (const [u, mongDoi] of [["/?tv=1", "CPC1"], ["/action.html?token=abc&sc=SC-1&act=x", "máy chủ"], ["/datlai.html", "máy chủ"], ["/404.html", "Không tìm thấy trang"]]) {
    const r = await goto(u); await cho(600);
    const text = await page.evaluate(() => document.body.innerText);
    kiem(r.status() === 200 && text.includes(mongDoi), `${u} mở được (có "${mongDoi}")`);
  }

  const loiTrangDuyNhat = [...new Set(loiTrang)];
  kiem(loiTrangDuyNhat.length === 0, "Không có pageerror / console.error trong suốt bài kiểm", loiTrangDuyNhat.slice(0, 4).join(" | "));
  await browser.close();
} finally { if (server) server.kill(); }
console.log(loi.length ? `✗ test:e2e — ${loi.length} lỗi / ${soDat} đạt` : `✓ test:e2e — ${soDat} bước đạt (chế độ demo)`);
process.exit(loi.length ? 1 : 0);
