// ============================================================
// AuthGate.jsx — Màn hình đăng nhập CHẶN TOÀN TRANG (bắt buộc).
// Email + mật khẩu. KHÔNG có lối xem demo → chưa đăng nhập thì không thấy gì.
// Vai trò xác định theo email trong bảng nguoi_dung.
// ============================================================
import React, { useState } from "react";
import { LogIn } from "lucide-react";
import { dangNhapMatKhau, guiEmailKhoiPhuc } from "./lib/auth";
import logoCpc1hn from "./assets/logo-cpc1hn.png";

const NAVY = "#1e3a56", TEAL = "#149e90";

export default function AuthGate() {
  const [email, setEmail] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState("");
  const [kp, setKp] = useState("");   // '' | 'dang_gui' | 'da_gui'

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg-canvas)" }}>
      <div className="w-full max-w-md rounded-3xl bg-surface ring-1 ring-line overflow-hidden"
        style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.4)" }}>
        <div className="px-7 pt-7 pb-5" style={{ background: "var(--bg-subtle)" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-surface p-2 ring-1 ring-success-line flex items-center justify-center h-[52px] w-[52px] shrink-0"><img src={logoCpc1hn} alt="CPC1 Hà Nội" className="h-11 w-11 object-contain select-none" draggable={false} /></div>
            <div>
              <h1 className="text-base font-bold" style={{ color: NAVY }}>Giám sát HVAC phòng sạch GMP</h1>
              <p className="text-[12px] font-semibold" style={{ color: TEAL }}>V/Q team — QLCL</p>
            </div>
          </div>
        </div>
        <div className="px-7 py-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-1" style={{ color: NAVY }}>Đăng nhập để tiếp tục</h2>
            <p className="text-[12px] text-muted leading-relaxed">Hệ thống yêu cầu đăng nhập. Nhập email và mật khẩu được cấp.</p>
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dangNhap()}
            placeholder="email@cpc1hn.vn" autoComplete="username"
            className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm text-body outline-none focus:ring-2 focus:ring-success-line" />
          <input type="password" value={matKhau} onChange={(e) => setMatKhau(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dangNhap()}
            placeholder="Mật khẩu" autoComplete="current-password"
            className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm text-body outline-none focus:ring-2 focus:ring-success-line" />
          {loi && <p className="text-[12px] text-danger">{loi}</p>}
          {kp === "da_gui" && (
            <p className="text-[12px] text-success bg-success-soft ring-1 ring-success-line rounded-xl px-3 py-2 leading-relaxed">
              Nếu email <b>{email}</b> có trong hệ thống, thư đặt lại mật khẩu đã được gửi —
              mở thư và bấm liên kết trong vòng 1 giờ. Không thấy thư? Kiểm tra mục Spam.
            </p>
          )}
          <button disabled={dangXuLy} onClick={dangNhap}
            className="w-full text-sm font-semibold text-white rounded-2xl py-3 flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "var(--primary-solid)" }}>
            <LogIn className="w-4 h-4" strokeWidth={1.8} /> {dangXuLy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <button onClick={quenMatKhau} disabled={kp === "dang_gui"}
            className="w-full text-[12px] font-medium text-muted hover:text-success disabled:opacity-50">
            {kp === "dang_gui" ? "Đang gửi email khôi phục…" : "Quên mật khẩu? Gửi email đặt lại"}
          </button>
          <p className="text-[12px] text-muted leading-relaxed">
            Tài khoản do Quản trị hệ thống cấp. Vai trò (Kiểm soát hiện trường / Cơ điện / Trực hồ sơ lô / Đảm bảo chất lượng / Quản trị) xác định theo email.
          </p>
        </div>
      </div>
    </div>
  );
}
