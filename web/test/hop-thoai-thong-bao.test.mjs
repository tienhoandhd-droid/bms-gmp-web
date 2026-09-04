// hop-thoai-thong-bao.test.mjs — hợp đồng WCAG của hộp thoại & thanh thông báo (đợt A 04/09/2026).
// Vì sao kiểm bằng render tĩnh: dự án không có thư viện test DOM; react-dom/server đủ để
// khẳng định các thuộc tính a11y BẮT BUỘC có mặt trong markup (role, aria-*, label ↔ id).
// Hành vi Esc / focus-trap thuộc useEffect nên kiểm bằng trình duyệt thật (kiemtra-ui/test-ui.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import esbuild from "esbuild";

const GOC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Dịch JSX → JS một lần vào node_modules/.cache (nằm trong cây web/ để import react từ đúng node_modules).
const OUT = resolve(GOC, "node_modules/.cache/bms-test");
mkdirSync(OUT, { recursive: true });
async function napComponent(tenFile) {
  const outfile = resolve(OUT, tenFile.replace(/\.jsx$/, ".mjs"));
  await esbuild.build({
    entryPoints: [resolve(GOC, "src/components/ui", tenFile)],
    outfile, bundle: true, format: "esm", platform: "node", jsx: "automatic",
    external: ["react", "react-dom", "lucide-react"], logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
}
const React = (await import("react")).default;
const { renderToString: _render } = await import("react-dom/server");
// react-dom/server chèn <!-- --> giữa các đoạn chữ động — bỏ đi để so chuỗi tự nhiên.
const renderToString = (el) => _render(el).replace(/<!-- -->/g, "");

test("HopThoaiTamHoan: markup có đủ role/aria, label gắn ô nhập, 5 mức thời lượng, nút xác nhận khoá khi chưa có lý do", async () => {
  const { HopThoaiTamHoan, PHUT_TAM_HOAN, LY_DO_TOI_THIEU } = await napComponent("HopThoai.jsx");
  const html = renderToString(React.createElement(HopThoaiTamHoan, { suCo: { id: "SC-1042", room: "C4.R7", sensor: "Chênh áp" }, onDong: () => {}, onXacNhan: () => {} }));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  const labelledby = html.match(/aria-labelledby="([^"]+)"/);
  assert.ok(labelledby, "phải có aria-labelledby");
  assert.ok(html.includes(`id="${labelledby[1]}"`), "aria-labelledby phải trỏ tới id tiêu đề có thật");
  assert.match(html, /<label for="tam-hoan-ly-do"/);
  assert.match(html, /<textarea id="tam-hoan-ly-do"[^>]*required/);
  assert.equal((html.match(/role="radio"/g) || []).length, PHUT_TAM_HOAN.length);
  assert.match(html, /aria-label="Đóng hộp thoại"/);
  assert.match(html, /Tạm hoãn 60 phút/, "mặc định 60 phút như luật cũ");
  assert.match(html, new RegExp(`Tối thiểu ${LY_DO_TOI_THIEU} ký tự`));
  // Nút xác nhận bị khoá lúc mở (chưa có lý do) — không thể ghi hồ sơ rỗng.
  assert.match(html, /<button[^>]*disabled=""[^>]*>[^<]*<svg[\s\S]*?Tạm hoãn 60 phút/);
  assert.match(html, /SC-1042/); assert.match(html, /C4\.R7/);
});

test("ThongBaoStack: lỗi vào vùng assertive, thông báo khác vào vùng polite, mỗi thẻ có nút đóng có tên", async () => {
  const { ThongBaoStack } = await napComponent("ThongBao.jsx");
  const html = renderToString(React.createElement(ThongBaoStack, { items: [{ id: 1, loai: "loi", text: "Mất kết nối" }, { id: 2, loai: "ok", text: "Đã lưu" }], onDong: () => {} }));
  assert.match(html, /role="alert" aria-live="assertive"[\s\S]*Mất kết nối/);
  assert.match(html, /role="status" aria-live="polite"[\s\S]*Đã lưu/);
  assert.equal((html.match(/aria-label="Đóng thông báo"/g) || []).length, 2);
  assert.match(html, /class="sr-only">Lỗi: </);
});

test("taoBao: lỗi KHÔNG tự ẩn, thành công tự ẩn sau 6 giây", async () => {
  const { taoBao } = await napComponent("ThongBao.jsx");
  let ds = [];
  const setDs = (f) => { ds = typeof f === "function" ? f(ds) : f; };
  const goc = globalThis.setTimeout; const hen = [];
  globalThis.setTimeout = (fn, ms) => { hen.push({ fn, ms }); return 0; };
  try {
    const bao = taoBao(setDs);
    bao("loi", "Lỗi A"); bao("ok", "Xong B");
    assert.equal(ds.length, 2);
    assert.equal(hen.length, 1, "chỉ thông báo thành công mới hẹn giờ ẩn");
    assert.equal(hen[0].ms, 6000);
    hen[0].fn();
    assert.deepEqual(ds.map((x) => x.text), ["Lỗi A"]);
  } finally { globalThis.setTimeout = goc; }
});
