// apDungGiaoDien.js — gắn data-theme cho các trang KHÔNG có ThemeProvider (đợt C 04/09/2026):
// action.html (bấm từ email) và datlai.html (đặt lại mật khẩu). Đọc cùng khoá localStorage
// "bms-theme" với ThemeProvider của dashboard nên người dùng đã chọn Tối ở dashboard thì
// trang bấm từ email cũng tối; chưa chọn thì theo hệ điều hành. Không có React, chạy trước render.
const STORAGE_KEY = "bms-theme";

export function apDungGiaoDienDaLuu() {
  if (typeof document === "undefined") return;
  let chon = "system";
  try { chon = localStorage.getItem(STORAGE_KEY) || "system"; } catch (e) { /* trình duyệt chặn storage (chế độ riêng tư) → theo hệ điều hành */ }
  const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const apDung = () => {
    const theme = chon === "light" || chon === "dark" ? chon : (mq && mq.matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  };
  apDung();
  if (mq && chon === "system") mq.addEventListener("change", apDung);
}
