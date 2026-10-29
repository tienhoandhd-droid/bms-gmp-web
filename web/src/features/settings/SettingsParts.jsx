// SettingsParts.jsx — các thẻ tab Cài đặt + modal đăng nhập/mật khẩu (tách move-only từ App.jsx 17/08/2026).
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Activity, AlertOctagon, CheckCircle2, Settings as Cog, KeyRound, LogIn, Plus, Save, ShieldCheck, Thermometer, X } from "lucide-react";
import { Card, HeaderChip, MucBadge, SectionTitle } from "../../components/ui/Card";
import { useHopThoai } from "../../components/ui/HopThoai";
import { dangNhapMatKhau, doiMatKhau } from "../../lib/auth";
import { COLOR, SENSOR_META_BASE, fmtPct } from "../../lib/designTokens";
import { DS_KHU, DB_MOI_MAC_DINH, VAI_TRO_CHON } from "../../lib/phanQuyen";
import { kiemChuoiHashAudit, layNguoiDung, layTaiKhoanChuaPhanQuyen, luuNguoiDung } from "../../lib/supabaseData";
import { cardShadow } from "../../lib/uiConst";
import { fmtVN } from "../../lib/dinhDang";
function LoginModal({ onClose, isLive }) {
  const [email, setEmail] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState("");
  const dangNhap = async () => {
    if (!email.includes("@")) { setLoi("Nhập email hợp lệ."); return; }
    if (!matKhau) { setLoi("Nhập mật khẩu."); return; }
    setDangXuLy(true); setLoi("");
    const { error } = await dangNhapMatKhau(email, matKhau);
    setDangXuLy(false);
    if (error) { setLoi(error.message === "Invalid login credentials" ? "Email hoặc mật khẩu không đúng." : (error.message || "Đăng nhập thất bại.")); return; }
    onClose();   // theoDoiPhien trong App tự cập nhật phiên đăng nhập
  };
  // WCAG 2.2 (đợt B 04/09/2026): dialog có role/aria, Esc đóng, focus quay vòng bên trong.
  // onClose từ AppShell là hàm inline (identity đổi mỗi render) — bọc qua ref để useHopThoai
  // không chạy lại effect và cướp focus về ô email khi người dùng đang gõ mật khẩu.
  const hopRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const dongOnDinh = useCallback(() => onCloseRef.current(), []);
  useHopThoai(hopRef, dongOnDinh);
  const idTieuDe = useId(); const idEmail = useId(); const idMk = useId();
  return (
    <div className="bms-backdrop" onClick={onClose}>
      <div ref={hopRef} role="dialog" aria-modal="true" aria-labelledby={idTieuDe} tabIndex={-1} className="w-full max-w-md rounded-3xl bg-surface ring-1 ring-line overflow-hidden outline-none" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-center gap-3" style={{ background: "var(--bg-subtle)" }}><div className="rounded-2xl bg-surface p-2.5 ring-1 ring-success-line"><LogIn className="w-5 h-5" style={{ color: "var(--primary)" }} strokeWidth={1.8} /></div><div><h2 id={idTieuDe} className="text-base font-semibold text-strong">Đăng nhập</h2><p className="text-tk-xs text-muted">Dùng email và mật khẩu được cấp</p></div></div>
        <div className="px-6 py-5 space-y-4">
          {/* Placeholder không được tính là nhãn (WCAG 3.3.2) → thêm <label> thật */}
          <div><label htmlFor={idEmail} className="text-tk-xs font-semibold text-body mb-1 block">Email</label>
          <input id={idEmail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dangNhap()} placeholder="email@cpc1hn.vn" autoComplete="username" className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm text-body outline-none focus:ring-2 focus:ring-success-line" /></div>
          <div><label htmlFor={idMk} className="text-tk-xs font-semibold text-body mb-1 block">Mật khẩu</label>
          <input id={idMk} type="password" value={matKhau} onChange={(e) => setMatKhau(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dangNhap()} placeholder="Mật khẩu" autoComplete="current-password" className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm text-body outline-none focus:ring-2 focus:ring-success-line" /></div>
          {loi && <p role="alert" className="text-tk-xs text-danger">{loi}</p>}
          <button disabled={dangXuLy} onClick={dangNhap} className="w-full text-sm font-semibold text-white rounded-2xl py-3 disabled:opacity-60" style={{ backgroundColor: "var(--primary-solid)" }}>{dangXuLy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
          <p className="text-tk-xs text-muted leading-relaxed">Tài khoản do Quản trị (IT) cấp. Quyền xem của bạn được xác định theo email.</p>
        </div>
      </div>
    </div>
  );
}


// v11.1 — WIDGET SỨC KHỎE DỮ LIỆU (data freshness).
// Tiêu thụ live.sucKhoe (đã được useLiveData nạp từ rpc_kiem_tra_suc_khoe_he_thong).
// Đèn XANH = dữ liệu mới; đèn ĐỎ = mất dữ liệu (WF1/FMS có thể đã ngừng).
function SucKhoeWidget({ sk, dangTai }) {
  if (!sk) {
    return (
      <HeaderChip>
        <Activity className="w-4 h-4 text-muted" strokeWidth={1.8} />
        <div className="leading-tight"><p className="text-tk-xs uppercase tracking-wider text-muted font-semibold">Trạng thái</p><p className="text-xs font-semibold text-muted">{dangTai ? "đang kiểm tra…" : "—"}</p></div>
      </HeaderChip>
    );
  }
  const mat = sk.matDuLieu;
  const tre = sk.treGio;
  const treTxt = tre == null ? "—" : (tre < 1 ? "< 1 giờ" : `${(+tre).toFixed(tre < 10 ? 1 : 0).replace(".0", "")} giờ`);
  const lc = sk.lanChayCuoi;
  // Dữ liệu thu theo CỬA SỔ GIỜ (WF1 ghi sau khi cửa sổ đóng) → hiển thị rõ khung
  // giờ của bản ghi mới nhất; "trễ" = thời gian từ MỐC ĐÓNG cửa sổ đó tới hiện tại
  // (cùng quy tắc nguong_tre_gio của KPI) — nhịp giờ bình thường trễ dao động 0–1.1h.
  const cuaSo = (() => {
    if (!sk.bucketMoiNhat) return null;
    const bd = new Date(sk.bucketMoiNhat); const kt = new Date(bd.getTime() + 3600000);
    return `${fmtVN(bd, "gio")}–${fmtVN(kt, "gio")} ${fmtVN(kt, "ngay")}`;
  })();
  // 12/08: server tra `tomTat`/`lyDo` — nói RÕ hỏng ở đâu (mạch phút · rollup giờ ·
  // WF1 thu 0 phòng). Trước đây đèn chỉ nhìn TRỄ GIỜ ngưỡng 2h nên nguồn chết lúc
  // 09:39 mà tới 11:00 đèn vẫn XANH. 81 phút hệ thống nói "khoẻ" trong khi đã câm.
  const tip = [
    sk.tomTat ? `Chẩn đoán: ${sk.tomTat}` : null,
    cuaSo ? `Khung giờ dữ liệu mới nhất: ${cuaSo}` : "Chưa có bản ghi dữ liệu",
    `Dữ liệu trễ ${treTxt} so với cuối khung giờ gần nhất. Hệ thống thu dữ liệu mỗi giờ nên trễ khoảng 1,1 giờ trở xuống là bình thường; trễ quá ${sk.nguongGio ?? 2} giờ là mất dữ liệu.`,
    lc ? `Chấm điểm dữ liệu lần cuối: ${lc.trangThai || "?"}${lc.ketThuc ? " · " + fmtVN(lc.ketThuc, "dayDu") : ""}` : "Chưa ghi nhận lượt chấm điểm dữ liệu",
    `Sự cố đang mở: ${sk.suCoDangMo} (Nghiêm trọng: ${sk.soCritical} · Cảnh báo: ${sk.soWarning})`,
  ].filter(Boolean).join("\n");
  // Mạch phút chết = FMS/Edge đang câm NGAY LÚC NÀY — nặng hơn "rollup giờ trễ".
  const machChet = (sk.lyDo || []).includes("mach_phut") && sk.machPhutPhut != null;
  const ring = mat ? "ring-danger-line" : "ring-success-line";
  const dot = mat ? "bg-danger-solid animate-pulse" : "bg-success-solid";
  const Icon = mat ? AlertOctagon : CheckCircle2;
  const txt = mat ? "text-danger" : "text-success";
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl bg-surface px-4 ring-1 ${ring} h-[50px] cursor-help`} style={cardShadow} title={tip}>
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <Icon className={`w-4 h-4 ${txt}`} strokeWidth={1.8} />
      <div className="leading-tight">
        <p className="text-tk-xs uppercase tracking-wider text-muted font-semibold">Trạng thái</p>
        <p className={`text-xs font-semibold ${txt}`}>{mat ? (machChet ? `Mất nguồn · ${sk.machPhutPhut} phút` : "Mất dữ liệu") : `Dữ liệu mới · trễ ${treTxt}`}</p>
      </div>
    </div>
  );
}


function DoiMatKhauCard({ user, isLive }) {
  const [mkCu, setMkCu] = useState("");
  const [mk1, setMk1] = useState("");
  const [mk2, setMk2] = useState("");
  const [dang, setDang] = useState(false);
  const [ok, setOk] = useState(false);
  const [loi, setLoi] = useState("");
  const doi = async () => {
    setLoi(""); setOk(false);
    if (!mkCu) { setLoi("Vui lòng nhập mật khẩu hiện tại."); return; }
    if (mk1.length < 6) { setLoi("Mật khẩu mới phải có ít nhất 6 ký tự."); return; }
    if (mk1 === mkCu) { setLoi("Mật khẩu mới phải khác mật khẩu hiện tại."); return; }
    if (mk1 !== mk2) { setLoi("Hai mật khẩu nhập không khớp."); return; }
    if (!isLive) { setLoi("Chỉ đổi được mật khẩu khi đã đăng nhập ở chế độ dữ liệu thật."); return; }
    setDang(true);
    const { error } = await doiMatKhau(mkCu, mk1);
    setDang(false);
    if (error) setLoi(error.message || "Đổi mật khẩu thất bại.");
    else { setOk(true); setMkCu(""); setMk1(""); setMk2(""); }
  };
  const idCu = useId(); const idMoi = useId(); const idLai = useId();
  return (
    <Card className="p-6">
      <SectionTitle icon={Cog} hint={user ? user.email : "chưa đăng nhập"}>Đổi mật khẩu</SectionTitle>
      {!user ? (
        <p className="text-tk-xs text-muted mt-2">Đăng nhập để đổi mật khẩu.</p>
      ) : (
        <div className="mt-4 space-y-3 max-w-sm">
          {/* Placeholder không được tính là nhãn (WCAG 3.3.2) → thêm <label> thật */}
          <div><label htmlFor={idCu} className="text-tk-xs font-semibold text-body mb-1 block">Mật khẩu hiện tại</label>
          <input id={idCu} type="password" value={mkCu} onChange={(e) => setMkCu(e.target.value)} placeholder="Mật khẩu hiện tại"
            autoComplete="current-password"
            className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-success-line" /></div>
          <div className="h-px bg-subtle my-1" />
          <div><label htmlFor={idMoi} className="text-tk-xs font-semibold text-body mb-1 block">Mật khẩu mới</label>
          <input id={idMoi} type="password" value={mk1} onChange={(e) => setMk1(e.target.value)} placeholder="Mật khẩu mới"
            autoComplete="new-password"
            className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-success-line" /></div>
          <div><label htmlFor={idLai} className="text-tk-xs font-semibold text-body mb-1 block">Nhập lại mật khẩu mới</label>
          <input id={idLai} type="password" value={mk2} onChange={(e) => setMk2(e.target.value)} placeholder="Nhập lại mật khẩu mới"
            autoComplete="new-password" onKeyDown={(e) => e.key === "Enter" && doi()}
            className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-success-line" /></div>
          {loi && <p role="alert" className="text-tk-xs text-danger">{loi}</p>}
          {ok && <p role="status" aria-live="polite" className="text-tk-xs text-success">Đã đổi mật khẩu thành công.</p>}
          <button disabled={dang} onClick={doi}
            className="text-sm font-semibold text-white rounded-2xl py-2.5 px-5 disabled:opacity-60"
            style={{ background: "var(--primary-solid)" }}>
            {dang ? "Đang đổi…" : "Đổi mật khẩu"}
          </button>
          <p className="text-tk-xs text-muted leading-relaxed">Bạn cần nhập đúng mật khẩu hiện tại. Mật khẩu mới có ít nhất 6 ký tự và có hiệu lực từ lần đăng nhập sau.</p>
        </div>
      )}
    </Card>
  );
}


// #5 — Đổi mật khẩu khả dụng cho MỌI vai trò (mở từ nút ở góc phải, không phụ thuộc tab Cài đặt)
function DoiMatKhauModal({ user, isLive, onClose }) {
  const [mkCu, setMkCu] = useState("");
  const [mk1, setMk1] = useState("");
  const [mk2, setMk2] = useState("");
  const [dang, setDang] = useState(false);
  const [ok, setOk] = useState(false);
  const [loi, setLoi] = useState("");
  const doi = async () => {
    setLoi(""); setOk(false);
    if (!mkCu) { setLoi("Vui lòng nhập mật khẩu hiện tại."); return; }
    if (mk1.length < 6) { setLoi("Mật khẩu mới phải có ít nhất 6 ký tự."); return; }
    if (mk1 === mkCu) { setLoi("Mật khẩu mới phải khác mật khẩu hiện tại."); return; }
    if (mk1 !== mk2) { setLoi("Hai mật khẩu nhập không khớp."); return; }
    if (!isLive) { setLoi("Chỉ đổi được mật khẩu khi đã đăng nhập ở chế độ dữ liệu thật."); return; }
    setDang(true);
    const { error } = await doiMatKhau(mkCu, mk1);
    setDang(false);
    if (error) setLoi(error.message || "Đổi mật khẩu thất bại.");
    else { setOk(true); setMkCu(""); setMk1(""); setMk2(""); }
  };
  // WCAG 2.2 (đợt B): dialog có role/aria, Esc đóng, focus quay vòng. onClose inline từ AppShell
  // → bọc qua ref cho identity ổn định, tránh useHopThoai chạy lại effect và cướp focus khi gõ.
  const hopRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const dongOnDinh = useCallback(() => onCloseRef.current(), []);
  useHopThoai(hopRef, dongOnDinh);
  const idTieuDe = useId(); const idCu = useId(); const idMoi = useId(); const idLai = useId();
  return (
    <div className="bms-backdrop bms-backdrop--tren" onClick={onClose}>
      <div ref={hopRef} role="dialog" aria-modal="true" aria-labelledby={idTieuDe} tabIndex={-1} className="w-full max-w-sm rounded-3xl bg-surface ring-1 ring-line overflow-hidden outline-none" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between" style={{ background: "var(--bg-subtle)" }}>
          <div className="flex items-center gap-2"><div className="rounded-2xl bg-surface p-2 ring-1 ring-success-line"><KeyRound className="w-5 h-5" style={{ color: "var(--primary)" }} strokeWidth={1.8} /></div><div><h2 id={idTieuDe} className="text-sm font-semibold text-strong">Đổi mật khẩu</h2><p className="text-tk-xs text-muted">{user ? `${user.name} · ${user.email}` : "chưa đăng nhập"}</p></div></div>
          <button type="button" onClick={onClose} aria-label="Đóng hộp thoại" className="rounded-full p-1.5 hover:bg-subtle text-muted"><X className="w-4 h-4" strokeWidth={1.8} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          {/* Placeholder không được tính là nhãn (WCAG 3.3.2) → thêm <label> thật */}
          <div><label htmlFor={idCu} className="text-tk-xs font-semibold text-body mb-1 block">Mật khẩu hiện tại</label>
          <input id={idCu} type="password" value={mkCu} onChange={(e) => setMkCu(e.target.value)} placeholder="Mật khẩu hiện tại" autoComplete="current-password" className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-success-line" /></div>
          <div className="h-px bg-subtle" />
          <div><label htmlFor={idMoi} className="text-tk-xs font-semibold text-body mb-1 block">Mật khẩu mới</label>
          <input id={idMoi} type="password" value={mk1} onChange={(e) => setMk1(e.target.value)} placeholder="Mật khẩu mới" autoComplete="new-password" className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-success-line" /></div>
          <div><label htmlFor={idLai} className="text-tk-xs font-semibold text-body mb-1 block">Nhập lại mật khẩu mới</label>
          <input id={idLai} type="password" value={mk2} onChange={(e) => setMk2(e.target.value)} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" onKeyDown={(e) => e.key === "Enter" && doi()} className="w-full rounded-2xl bg-subtle ring-1 ring-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-success-line" /></div>
          {loi && <p role="alert" className="text-tk-xs text-danger">{loi}</p>}
          {ok && <p role="status" aria-live="polite" className="text-tk-xs text-success">Đã đổi mật khẩu thành công.</p>}
          <button disabled={dang} onClick={doi} className="w-full text-sm font-semibold text-white rounded-2xl py-2.5 disabled:opacity-60" style={{ background: "var(--primary-solid)" }}>{dang ? "Đang đổi…" : "Đổi mật khẩu"}</button>
          <p className="text-tk-xs text-muted leading-relaxed">Bạn cần nhập đúng mật khẩu hiện tại. Mật khẩu mới có ít nhất 6 ký tự và có hiệu lực từ lần đăng nhập sau.</p>
        </div>
      </div>
    </div>
  );
}


// Phân tích GMP chuyên sâu (MKT + SPC) — tất định, job đêm tính, chỉ hiện ở LIVE.
function PhanTichGmpCard({ mkt, spc, isLive }) {
  if (!isLive) return (
    <Card className="p-6"><SectionTitle icon={Activity} hint="MKT theo ICH Q1A và kiểm soát thống kê quá trình">Phân tích GMP chuyên sâu</SectionTitle>
      <p className="mt-3 text-tk-sm text-muted">Chỉ hiển thị ở chế độ <b>dữ liệu thật</b>. Hệ thống tự tính MKT và tín hiệu dịch chuyển mỗi đêm.</p>
    </Card>
  );
  const mk = mkt || [], sp = spc || [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6"><SectionTitle icon={Thermometer} hint="Nhiệt độ động học trung bình · 30 ngày · ICH Q1A">MKT theo phòng</SectionTitle>
        <p className="text-tk-xs text-muted mt-1">MKT (nhiệt độ động học trung bình) tính nặng các đợt nhiệt cao nên luôn bằng hoặc cao hơn nhiệt độ trung bình. Phòng có MKT cao cần chú ý nguy cơ phơi nhiễm nhiệt.</p>
        {mk.length ? (
          <div className="overflow-x-auto mt-3"><table className="w-full text-tk-sm"><caption className="sr-only">Nhiệt độ động học trung bình (MKT) 30 ngày theo phòng</caption><thead><tr className="text-muted text-left text-tk-xs uppercase tracking-wider">{["Phòng", "Khu", "Ưu tiên", "MKT °C", "Trung bình °C", "Cao nhất °C"].map((hh) => <th key={hh} scope="col" className="py-2 pr-3 font-semibold whitespace-nowrap">{hh}</th>)}</tr></thead><tbody>
            {mk.slice(0, 12).map((r) => <tr key={r.ma_phong} className="border-t border-line hover:bg-info-soft/40"><td className="py-2 pr-3"><span className="font-semibold text-strong">{r.ma_phong}</span> <span className="text-muted text-tk-xs">{r.ten_phong}</span></td><td className="py-2 pr-3 text-muted">{r.khu_vuc}</td><td className="py-2 pr-3">{r.muc_uu_tien && <MucBadge p={r.muc_uu_tien} />}</td><td className="py-2 pr-3 tabular-nums font-semibold text-strong">{r.mkt == null ? "—" : r.mkt.toFixed(2)}</td><td className="py-2 pr-3 tabular-nums text-body">{r.tTb == null ? "—" : r.tTb.toFixed(2)}</td><td className="py-2 pr-3 tabular-nums text-body">{r.tMax == null ? "—" : r.tMax.toFixed(2)}</td></tr>)}
          </tbody></table></div>
        ) : <p className="mt-3 text-tk-sm text-muted">Chưa có dữ liệu MKT. Cần có cảm biến nhiệt độ và tác vụ tự động ban đêm đã chạy.</p>}
      </Card>
      <Card className="p-6"><SectionTitle icon={Activity} hint="Phát hiện sớm số liệu lệch dần">Cảnh báo dịch chuyển sớm</SectionTitle>
        <p className="text-tk-xs text-muted mt-1">"Ngoài kiểm soát" nghĩa là số liệu đang lệch dần hoặc có xu hướng, dù chưa vượt giới hạn. Quy tắc Nelson số 1: một điểm vượt 3 lần độ lệch chuẩn. Số 2: 9 điểm liên tiếp cùng một phía đường trung bình. Số 3: 6 điểm liên tiếp cùng tăng hoặc cùng giảm.</p>
        {sp.length ? (
          <div className="overflow-x-auto mt-3"><table className="w-full text-tk-sm"><caption className="sr-only">Tín hiệu dịch chuyển theo phạm vi và cảm biến</caption><thead><tr className="text-muted text-left text-tk-xs uppercase tracking-wider">{["Phạm vi", "Cảm biến", "Mục tiêu", "Độ lệch chuẩn", "Tín hiệu", "Loại"].map((hh) => <th key={hh} scope="col" className="py-2 pr-3 font-semibold whitespace-nowrap">{hh}</th>)}</tr></thead><tbody>
            {sp.slice(0, 12).map((r, i) => <tr key={`${r.scope || r.pham_vi || ""}-${r.sensor || r.loai_cam_bien || ""}-${i}`} className="border-t border-line hover:bg-info-soft/40"><td className="py-2 pr-3"><span className="font-semibold text-strong">{r.scope_id}</span> <span className="text-muted text-tk-xs">{r.ten_scope}</span></td><td className="py-2 pr-3 text-muted">{SENSOR_META_BASE[r.sensor_type]?.label || r.sensor_type}</td><td className="py-2 pr-3 tabular-nums text-body">{r.mucTieu == null ? "—" : fmtPct(r.mucTieu)}</td><td className="py-2 pr-3 tabular-nums text-body">{r.sigma == null ? "—" : r.sigma.toFixed(2)}</td><td className="py-2 pr-3"><span className="inline-block px-2 py-0.5 rounded-full text-tk-xs font-medium bg-danger-soft text-danger">{r.soTinHieu}</span></td><td className="py-2 pr-3 text-tk-xs text-muted">{r.cacLoai || "—"}</td></tr>)}
          </tbody></table></div>
        ) : <p className="mt-3 text-tk-sm text-success">Tất cả phạm vi đang trong kiểm soát, chưa có tín hiệu dịch chuyển.</p>}
      </Card>
    </div>
  );
}


function TaiKhoanCard({ isLive, actor }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loi, setLoi] = useState(null);
  const [luu, setLuu] = useState({});     // email → trạng thái lưu
  // Email đã có tài khoản đăng nhập nhưng chưa được gán vai trò. Tạo tài khoản
  // vẫn là việc của Supabase Auth; ở đây chỉ PHÂN QUYỀN cho email đã tồn tại,
  // nên không thể sinh ra dòng phân quyền mồ côi vì gõ nhầm email.
  const [chuaPhanQuyen, setChuaPhanQuyen] = useState([]);
  const [nguoiMoi, setNguoiMoi] = useState({ email: "", ho_ten: "", vai_tro: "IPC", khu_vuc: [...DS_KHU], kich_hoat: true });
  const [luuMoi, setLuuMoi] = useState(null);
  const napLai = useCallback(async () => {
    if (!isLive) { setLoading(false); return; }
    const [{ error, rows: r }, dsAuth] = await Promise.all([layNguoiDung(), layTaiKhoanChuaPhanQuyen()]);
    if (error) setLoi(error); else { setLoi(null); setRows(r.map((x) => ({ ...x, khu_vuc: Array.isArray(x.khu_vuc) ? x.khu_vuc : [] }))); }
    setChuaPhanQuyen(dsAuth.emails || []);
    setLoading(false);
  }, [isLive]);
  useEffect(() => { setLoading(true); napLai(); }, [napLai]);

  const doi = (email, patch) => setRows((rs) => rs.map((r) => r.email === email ? { ...r, ...patch } : r));
  const toggleKhu = (email, k) => setRows((rs) => rs.map((r) => {
    if (r.email !== email) return r;
    const has = r.khu_vuc.includes(k);
    return { ...r, khu_vuc: has ? r.khu_vuc.filter((x) => x !== k) : [...r.khu_vuc, k] };
  }));
  const luuMot = async (r) => {
    setLuu((s) => ({ ...s, [r.email]: "dang" }));
    const { data, error } = await luuNguoiDung({ email: r.email, ho_ten: r.ho_ten, vai_tro: r.vai_tro, khu_vuc: r.khu_vuc, kich_hoat: r.kich_hoat, so_dien_thoai: r.so_dien_thoai, ghi_chu: r.ghi_chu });
    const ok = !error && data?.ok;
    setLuu((s) => ({ ...s, [r.email]: ok ? "ok" : "loi" }));
    setTimeout(() => setLuu((s) => ({ ...s, [r.email]: null })), 3000);
    if (ok) napLai();
  };

  const themNguoi = async () => {
    if (!nguoiMoi.email) return;
    setLuuMoi("dang");
    const { data, error } = await luuNguoiDung(nguoiMoi);
    if (!error && data?.ok) {
      setLuuMoi("ok"); setNguoiMoi({ email: "", ho_ten: "", vai_tro: "IPC", khu_vuc: [...DS_KHU], kich_hoat: true }); await napLai();
    } else setLuuMoi(error?.thong_bao || data?.thong_bao || "Lỗi");
    setTimeout(() => setLuuMoi(null), 4000);
  };

  if (!isLive) return <Card className="p-8 text-center text-tk-sm text-muted">Cần chuyển sang chế độ dữ liệu thật để quản lý tài khoản.</Card>;
  return (
    <Card className="p-6">
      <SectionTitle icon={KeyRound} hint="chỉ Quản trị · gán vai trò và khu được xem">Tài khoản và quyền xem</SectionTitle>
      <p className="text-tk-xs text-muted mt-2">Mỗi tài khoản chỉ <b>xem</b> được dữ liệu của các khu đã tích. Việc chặn làm <b>ngay tại máy chủ</b> ở mọi trang (Tổng quan, Sự cố, Chênh áp, Xu hướng), kể cả khi gọi API trực tiếp. Với tài khoản bị giới hạn, số liệu toàn hệ thống chỉ gộp các khu được xem. <b>Quản trị</b> luôn xem được tất cả. Tài khoản đăng nhập mới được tạo trên Supabase; tại đây chỉ gán vai trò và khu, có hiệu lực từ lần tải dữ liệu kế tiếp.</p>{/* copy-exception: hướng dẫn riêng ADMIN */}
      {loi ? <p className="text-tk-sm text-danger mt-4">Không tải được danh sách (cần quyền Quản trị): {loi.thong_bao || loi.message}</p>
        : loading ? <p className="text-tk-sm text-muted mt-4">Đang tải…</p>
        : rows.length === 0 ? <p className="text-tk-sm text-muted mt-4">Chưa có tài khoản, hoặc bạn không có quyền Quản trị.</p>
        : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-tk-sm">
            <caption className="sr-only">Danh sách tài khoản: vai trò, khu được xem và trạng thái hoạt động</caption>
            {/* Cột cuối không có chữ → thêm tên ẩn để đầu cột không rỗng (axe empty-table-header) */}
            <thead><tr className="text-muted text-left text-tk-xs uppercase tracking-wider">{["Tài khoản", "Vai trò", "Khu được xem", "Hoạt động", ""].map((h) => <th key={h} scope="col" className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h || <span className="sr-only">Thao tác</span>}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.email} className="border-t border-line align-middle">
                <td className="py-2.5 pr-4"><p className="font-semibold text-strong">{r.ho_ten}</p><p className="text-tk-xs text-muted">{r.email}</p></td>
                <td className="py-2.5 pr-4"><select value={r.vai_tro} aria-label={`Vai trò của ${r.ho_ten || r.email}`} onChange={(e) => doi(r.email, { vai_tro: e.target.value })} className="rounded-lg bg-surface ring-1 ring-line px-2 py-1 text-tk-xs min-h-[24px]">{VAI_TRO_CHON.map((v) => <option key={v.k} value={v.k}>{v.label}</option>)}</select></td>
                <td className="py-2.5 pr-4">{r.vai_tro === "ADMIN" ? <span className="text-tk-xs text-muted italic">tất cả (Quản trị)</span> : <div className="flex gap-1.5">{DS_KHU.map((k) => { const on = r.khu_vuc.includes(k); return <button key={k} type="button" aria-pressed={on} onClick={() => toggleKhu(r.email, k)} className={`px-2.5 py-1 min-h-[24px] rounded-lg text-tk-xs font-medium ring-1 transition ${on ? "text-white ring-transparent" : "text-muted bg-surface ring-line hover:ring-success-line"}`} style={on ? { backgroundColor: "var(--primary-solid)" } : {}}>{k}</button>; })}</div>}</td>
                <td className="py-2.5 pr-4"><button onClick={() => doi(r.email, { kich_hoat: !r.kich_hoat })} className={`text-tk-xs font-medium rounded-lg px-2.5 py-1.5 ring-1 ${r.kich_hoat ? "text-success bg-success-soft ring-success-line" : "text-muted bg-subtle ring-line"}`}>{r.kich_hoat ? "Bật" : "Tắt"}</button></td>
                <td className="py-2.5 pr-4"><button onClick={() => luuMot(r)} className="text-tk-xs font-medium text-white rounded-lg px-3 py-1.5 flex items-center gap-1" style={{ backgroundColor: "var(--primary-solid)" }}><Save className="w-3.5 h-3.5" strokeWidth={1.8} /> {luu[r.email] === "dang" ? "Đang lưu…" : luu[r.email] === "ok" ? "Đã lưu ✓" : luu[r.email] === "loi" ? "Lỗi" : "Lưu"}</button></td>
              </tr>
            ))}
            {chuaPhanQuyen.length > 0 && (
              <tr className="border-t border-line bg-info-soft/50 align-middle">
                <td className="py-2.5 pr-4">
                  {/* Ô trong bảng không có nhãn hiển thị → aria-label (placeholder không tính là nhãn) */}
                  <select value={nguoiMoi.email} aria-label="Tài khoản chưa phân quyền" onChange={(e) => setNguoiMoi({ ...nguoiMoi, email: e.target.value })}
                    className="w-full min-w-[200px] rounded-lg bg-surface ring-1 ring-info-line px-2 py-1.5 text-tk-xs font-mono">
                    <option value="">Chọn tài khoản chưa phân quyền…</option>
                    {chuaPhanQuyen.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <input value={nguoiMoi.ho_ten} aria-label="Họ tên tài khoản mới (tuỳ chọn)" placeholder="Họ tên (tuỳ chọn)" onChange={(e) => setNguoiMoi({ ...nguoiMoi, ho_ten: e.target.value })}
                    className="w-full mt-1.5 rounded-lg bg-surface ring-1 ring-info-line px-2 py-1.5 text-tk-xs" />
                </td>
                <td className="py-2.5 pr-4"><select value={nguoiMoi.vai_tro} aria-label="Vai trò tài khoản mới" onChange={(e) => setNguoiMoi({ ...nguoiMoi, vai_tro: e.target.value })} className="rounded-lg bg-surface ring-1 ring-info-line px-2 py-1 text-tk-xs min-h-[24px]">{VAI_TRO_CHON.map((v) => <option key={v.k} value={v.k}>{v.label}</option>)}</select></td>
                <td className="py-2.5 pr-4">{nguoiMoi.vai_tro === "ADMIN" ? <span className="text-tk-xs text-muted italic">tất cả (Quản trị)</span> : <div className="flex gap-1.5">{DS_KHU.map((k) => { const on = nguoiMoi.khu_vuc.includes(k); return <button key={k} type="button" aria-pressed={on} onClick={() => setNguoiMoi({ ...nguoiMoi, khu_vuc: on ? nguoiMoi.khu_vuc.filter((x) => x !== k) : [...nguoiMoi.khu_vuc, k] })} className={`px-2.5 py-1 min-h-[24px] rounded-lg text-tk-xs font-medium ring-1 ${on ? "text-white ring-transparent" : "text-muted bg-surface ring-line"}`} style={on ? { backgroundColor: "var(--primary-solid)" } : {}}>{k}</button>; })}</div>}</td>
                <td className="py-2.5 pr-4 text-tk-xs text-muted">Bật</td>
                <td className="py-2.5 pr-4"><button onClick={themNguoi} disabled={!nguoiMoi.email || luuMoi === "dang"} className="text-tk-xs font-medium text-white rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-40" style={{ backgroundColor: "var(--danger-solid)" }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> {luuMoi === "dang" ? "Đang lưu…" : luuMoi === "ok" ? "Đã thêm ✓" : "Phân quyền"}</button></td>
              </tr>)}
            </tbody>
          </table>
          {luuMoi && luuMoi !== "dang" && luuMoi !== "ok" && <p role="alert" className="text-tk-xs text-danger mt-2">{luuMoi}</p>}
          {chuaPhanQuyen.length === 0 && <p className="text-tk-xs text-muted mt-3">Mọi tài khoản đăng nhập đều đã được phân quyền. Tài khoản tạo mới trên Supabase (mục <b>Authentication</b>, trang <b>Users</b>) sẽ tự hiện ở đây.</p>}{/* copy-exception: hướng dẫn riêng ADMIN */}
        </div>
      )}
    </Card>
  );
}


function ChuoiHashCard({ isLive }) {
  const [kq, setKq] = useState(null);
  const [dangChay, setDangChay] = useState(false);
  const chay = async () => {
    setDangChay(true);
    const { error, data } = await kiemChuoiHashAudit();
    setDangChay(false);
    setKq(error ? { ok: false, thong_bao: error.thong_bao || "Không kiểm tra được. Vui lòng thử lại." } : data);
  };
  return (
    <Card className="p-6">
      <SectionTitle icon={ShieldCheck} hint="chống sửa lén · 21 CFR Part 11">Toàn vẹn nhật ký truy vết</SectionTitle>
      <p className="text-tk-xs text-muted mt-2 leading-relaxed">Mỗi dòng nhật ký truy vết mang mã băm nối với dòng trước. Chỉ cần sửa lén một dòng (kể cả bằng quyền cao nhất) là <b>đứt cả chuỗi</b>. Nút dưới đây kiểm lại toàn bộ và chỉ ra dòng đầu tiên bị sửa.</p>
      <button disabled={!isLive || dangChay} onClick={chay} className="mt-3 rounded-xl px-4 py-2 text-tk-sm font-semibold text-white disabled:opacity-40" style={{ background: "var(--primary-solid)" }}>{dangChay ? "Đang kiểm tra…" : "Kiểm tra toàn vẹn"}</button>
      {kq && (
        <div role={kq.ok ? "status" : "alert"} aria-live={kq.ok ? "polite" : undefined} className={`mt-3 rounded-2xl px-4 py-3 text-tk-sm ${kq.ok ? "bg-success-soft text-success ring-1 ring-success-line" : "bg-danger-soft text-danger ring-1 ring-danger-line"}`}>
          {kq.ok ? "✓ " : "⚠ "}{kq.thong_bao}
        </div>
      )}
    </Card>
  );
}


export { LoginModal, SucKhoeWidget, DoiMatKhauCard, DoiMatKhauModal, PhanTichGmpCard, TaiKhoanCard, ChuoiHashCard };
