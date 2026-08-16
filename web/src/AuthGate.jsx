// ============================================================
// AuthGate.jsx — Màn hình đăng nhập CHẶN TOÀN TRANG (bắt buộc).
// Email + mật khẩu. KHÔNG có lối xem demo → chưa đăng nhập thì không thấy gì.
// Vai trò xác định theo email trong bảng nguoi_dung.
// G3 17/08/2026: viết lại PHẦN TRÌNH BÀY theo semantic token + accessibility
// (label thật, hiện/ẩn mật khẩu, role=alert, báo Caps Lock, chữ ≥12px).
// LOGIC đăng nhập/khôi phục GIỮ NGUYÊN.
// ============================================================
import React, { useState } from "react";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { dangNhapMatKhau, guiEmailKhoiPhuc } from "./lib/auth";
import logoCpc1hn from "./assets/logo-cpc1hn.png";

export default function AuthGate() {
  const [email, setEmail] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState("");
  const [kp, setKp] = useState("");   // '' | 'dang_gui' | 'da_gui'
  const [hienMk, setHienMk] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const quenMatKhau = async () => {
    if (!email.includes("@")) { setLoi("Nhập email của bạn vào ô trên rồi bấm 'Quên mật khẩu?'."); return; }
    setKp("dang_gui"); setLoi("");
    const { error } = await guiEmailKhoiPhuc(email);
    if (error) { setKp(""); setLoi(error.message || "Không gửi được email khôi phục."); return; }
    setKp("da_gui");
  };

  const dangNhap = async () => {
    if (!email.includes("@")) { setLoi("Vui lòng nhập email hợp lệ."); return; }
    if (!matKhau) { setLoi("Vui lòng nhập mật khẩu."); return; }
    setDangXuLy(true); setLoi("");
    const { error } = await dangNhapMatKhau(email, matKhau);
    setDangXuLy(false);
    if (error) setLoi(error.message === "Invalid login credentials"
      ? "Email hoặc mật khẩu không đúng." : (error.message || "Đăng nhập thất bại."));
    // thành công: theoDoiPhien trong App tự cập nhật → vào hệ thống
  };

  const doCapsLock = (e) => { try { setCapsLock(e.getModifierState && e.getModifierState("CapsLock")); } catch { /* trình duyệt cũ */ } };

  const O_INPUT = "w-full rounded-2xl surface--subtle ring-1 ring-line px-4 py-3 text-sm text-body outline-none focus:ring-2 focus:ring-[var(--focus)]";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 cleanroom-grid" style={{ background: "var(--bg-canvas)" }}>
      <form className="w-full max-w-md rounded-3xl surface ring-1 ring-line overflow-hidden"
        style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.4)" }}
        onSubmit={(e) => { e.preventDefault(); dangNhap(); }}>
        <div className="px-7 pt-7 pb-5 surface--subtle">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl surface p-2 ring-1 ring-line flex items-center justify-center h-[52px] w-[52px] shrink-0"><img src={logoCpc1hn} alt="CPC1 Hà Nội" className="h-11 w-11 object-contain select-none" draggable={false} /></div>
            <div>
              <h1 className="text-base font-bold" style={{ color: "var(--text-strong)" }}>Giám sát HVAC phòng sạch GMP</h1>
              <p className="text-[12px] font-semibold" style={{ color: "var(--primary)" }}>Hệ thống giám sát môi trường phòng sạch</p>
            </div>
          </div>
        </div>
        <div className="px-7 py-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-strong)" }}>Đăng nhập để tiếp tục</h2>
            <p className="text-[12px] meta leading-relaxed">Đăng nhập bằng tài khoản CPC1 Hà Nội.</p>
          </div>
          <div>
            <label htmlFor="dn-email" className="block text-[13px] font-medium text-body mb-1">Email công việc</label>
            <input id="dn-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@cpc1hn.vn" autoComplete="username"
              aria-invalid={Boolean(loi) || undefined} aria-describedby={loi ? "dn-loi" : undefined}
              className={O_INPUT} />
          </div>
          <div>
            <label htmlFor="dn-matkhau" className="block text-[13px] font-medium text-body mb-1">Mật khẩu</label>
            <div className="relative">
              <input id="dn-matkhau" type={hienMk ? "text" : "password"} value={matKhau}
                onChange={(e) => setMatKhau(e.target.value)}
                onKeyDown={doCapsLock} onKeyUp={doCapsLock}
                autoComplete="current-password"
                aria-invalid={Boolean(loi) || undefined} aria-describedby={loi ? "dn-loi" : undefined}
                className={`${O_INPUT} pr-12`} />
              <button type="button" onClick={() => setHienMk((v) => !v)}
                aria-label={hienMk ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute inset-y-0 right-0 px-3.5 flex items-center text-muted hover:text-body">
                {hienMk ? <EyeOff className="w-4 h-4" strokeWidth={1.8} /> : <Eye className="w-4 h-4" strokeWidth={1.8} />}
              </button>
            </div>
            {capsLock && <p className="mt-1.5 text-[12px] font-medium text-warning" role="status">Đang bật Caps Lock.</p>}
          </div>
          {loi && <p id="dn-loi" role="alert" aria-live="assertive" className="text-[12px] font-medium text-danger bg-danger-soft ring-1 ring-danger-line rounded-xl px-3 py-2">{loi}</p>}
          {kp === "da_gui" && (
            <p className="text-[12px] text-success bg-success-soft ring-1 ring-success-line rounded-xl px-3 py-2 leading-relaxed" role="status">
              Nếu email <b>{email}</b> có trong hệ thống, thư đặt lại mật khẩu đã được gửi —
              mở thư và bấm liên kết trong vòng 1 giờ. Không thấy thư? Kiểm tra mục Spam.
            </p>
          )}
          <button type="submit" disabled={dangXuLy}
            className="w-full text-sm font-semibold text-white rounded-2xl py-3 flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "var(--primary-solid)" }}>
            <LogIn className="w-4 h-4" strokeWidth={1.8} /> {dangXuLy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <button type="button" onClick={quenMatKhau} disabled={kp === "dang_gui"}
            className="w-full text-[12px] font-medium text-muted hover:text-success disabled:opacity-50">
            {kp === "dang_gui" ? "Đang gửi email khôi phục…" : "Quên mật khẩu? Gửi email đặt lại"}
          </button>
          <p className="text-[12px] meta leading-relaxed">Tài khoản nội bộ do Quản trị hệ thống cấp.</p>
        </div>
      </form>
    </div>
  );
}
