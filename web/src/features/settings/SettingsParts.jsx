// SettingsParts.jsx — các thẻ tab Cài đặt + modal đăng nhập/mật khẩu (tách move-only từ App.jsx 17/08/2026).
import React, { useCallback, useEffect, useState } from "react";
import { Activity, AlertOctagon, CheckCircle2, Settings as Cog, KeyRound, LogIn, Plus, Save, ShieldCheck, Thermometer, X } from "lucide-react";
import { Card, HeaderChip, MucBadge, SectionTitle } from "../../components/ui/Card";
import { dangNhapMatKhau, doiMatKhau } from "../../lib/auth";
import { COLOR, fmtPct } from "../../lib/designTokens";
import { DS_KHU, DB_MOI_MAC_DINH, VAI_TRO_CHON } from "../../lib/phanQuyen";
import { kiemChuoiHashAudit, layNguoiDung, layTaiKhoanChuaPhanQuyen, luuNguoiDung } from "../../lib/supabaseData";
import { cardShadow } from "../../lib/uiConst";
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-center gap-3" style={{ background: "linear-gradient(135deg,#E6F4F1,#fff)" }}><div className="rounded-2xl bg-white p-2.5 ring-1 ring-teal-100"><LogIn className="w-5 h-5" style={{ color: COLOR.teal }} strokeWidth={1.8} /></div><div><h2 className="text-base font-semibold" style={{ color: COLOR.navy }}>Đăng nhập</h2><p className="text-[11px] text-slate-500">Email + mật khẩu — phân quyền theo vai trò</p></div></div>
        <div className="px-6 py-5 space-y-4">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dangNhap()} placeholder="email@cpc1hn.vn" autoComplete="username" className="w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-300" />
          <input type="password" value={matKhau} onChange={(e) => setMatKhau(e.target.value)} onKeyDown={(e) => e.key === "Enter" && dangNhap()} placeholder="Mật khẩu" autoComplete="current-password" className="w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-300" />
          {loi && <p className="text-[12px] text-rose-600">{loi}</p>}
          <button disabled={dangXuLy} onClick={dangNhap} className="w-full text-sm font-semibold text-white rounded-2xl py-3 disabled:opacity-60" style={{ backgroundColor: COLOR.teal }}>{dangXuLy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
          <p className="text-[11px] text-slate-400 leading-relaxed">Tài khoản do quản trị (IT) cấp trong bảng người dùng. Vai trò xác định theo email.</p>
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
        <Activity className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
        <div className="leading-tight"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Trạng thái</p><p className="text-xs font-semibold text-slate-400">{dangTai ? "đang kiểm tra…" : "—"}</p></div>
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
    const hhmm = (d) => d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return `${hhmm(bd)}–${hhmm(kt)} ${kt.toLocaleDateString("vi-VN")}`;
  })();
  // 12/08: server tra `tomTat`/`lyDo` — nói RÕ hỏng ở đâu (mạch phút · rollup giờ ·
  // WF1 thu 0 phòng). Trước đây đèn chỉ nhìn TRỄ GIỜ ngưỡng 2h nên nguồn chết lúc
  // 09:39 mà tới 11:00 đèn vẫn XANH. 81 phút hệ thống nói "khoẻ" trong khi đã câm.
  const tip = [
    sk.tomTat ? `Chẩn đoán: ${sk.tomTat}` : null,
    cuaSo ? `Cửa sổ dữ liệu mới nhất: ${cuaSo}` : "Chưa có bản ghi dữ liệu",
    `Trễ ${treTxt} tính từ mốc đóng cửa sổ giờ (ngưỡng mất dữ liệu ${sk.nguongGio ?? 2}h; thu mỗi giờ nên trễ ≤ ~1.1h là bình thường)`,
    lc ? `WF1 lần cuối: ${lc.trangThai || "?"}${lc.ketThuc ? " · " + new Date(lc.ketThuc).toLocaleString("vi-VN") : ""}` : "Chưa ghi nhận WF1 chạy",
    `Sự cố đang mở: ${sk.suCoDangMo} (Mức 1: ${sk.soCritical} · Cảnh báo: ${sk.soWarning})`,
  ].filter(Boolean).join("\n");
  // Mạch phút chết = FMS/Edge đang câm NGAY LÚC NÀY — nặng hơn "rollup giờ trễ".
  const machChet = (sk.lyDo || []).includes("mach_phut") && sk.machPhutPhut != null;
  const ring = mat ? "ring-rose-300" : "ring-teal-200";
  const dot = mat ? "bg-rose-500 animate-pulse" : "bg-teal-400";
  const Icon = mat ? AlertOctagon : CheckCircle2;
  const txt = mat ? "text-rose-600" : "text-teal-600";
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl bg-white px-4 ring-1 ${ring} h-[50px] cursor-help`} style={cardShadow} title={tip}>
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      <Icon className={`w-4 h-4 ${txt}`} strokeWidth={1.8} />
      <div className="leading-tight">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Trạng thái</p>
        <p className={`text-xs font-semibold ${txt}`}>{mat ? (machChet ? `MẤT NGUỒN · ${sk.machPhutPhut}′` : "MẤT DỮ LIỆU") : `Dữ liệu mới · trễ ${treTxt}`}</p>
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
    if (mk1.length < 6) { setLoi("Mật khẩu mới tối thiểu 6 ký tự."); return; }
    if (mk1 === mkCu) { setLoi("Mật khẩu mới phải khác mật khẩu hiện tại."); return; }
    if (mk1 !== mk2) { setLoi("Hai mật khẩu nhập không khớp."); return; }
    if (!isLive) { setLoi("Chỉ đổi được mật khẩu ở chế độ LIVE (đã đăng nhập thật)."); return; }
    setDang(true);
    const { error } = await doiMatKhau(mkCu, mk1);
    setDang(false);
    if (error) setLoi(error.message || "Đổi mật khẩu thất bại.");
    else { setOk(true); setMkCu(""); setMk1(""); setMk2(""); }
  };
  return (
    <Card className="p-6">
      <SectionTitle icon={Cog} hint={user ? user.email : "chưa đăng nhập"}>Đổi mật khẩu</SectionTitle>
      {!user ? (
        <p className="text-[12px] text-slate-500 mt-2">Đăng nhập để đổi mật khẩu.</p>
      ) : (
        <div className="mt-4 space-y-3 max-w-sm">
          <input type="password" value={mkCu} onChange={(e) => setMkCu(e.target.value)} placeholder="Mật khẩu hiện tại"
            autoComplete="current-password"
            className="w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-300" />
          <div className="h-px bg-slate-100 my-1" />
          <input type="password" value={mk1} onChange={(e) => setMk1(e.target.value)} placeholder="Mật khẩu mới"
            autoComplete="new-password"
            className="w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-300" />
          <input type="password" value={mk2} onChange={(e) => setMk2(e.target.value)} placeholder="Nhập lại mật khẩu mới"
            autoComplete="new-password" onKeyDown={(e) => e.key === "Enter" && doi()}
            className="w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-300" />
          {loi && <p className="text-[12px] text-rose-600">{loi}</p>}
          {ok && <p className="text-[12px] text-teal-600">Đã đổi mật khẩu thành công.</p>}
          <button disabled={dang} onClick={doi}
            className="text-sm font-semibold text-white rounded-2xl py-2.5 px-5 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#1aa899,#149e90)" }}>
            {dang ? "Đang đổi…" : "Đổi mật khẩu"}
          </button>
          <p className="text-[11px] text-slate-400 leading-relaxed">Cần xác thực mật khẩu hiện tại. Mật khẩu mới tối thiểu 6 ký tự; lần đăng nhập sau dùng mật khẩu mới.</p>
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
    if (mk1.length < 6) { setLoi("Mật khẩu mới tối thiểu 6 ký tự."); return; }
    if (mk1 === mkCu) { setLoi("Mật khẩu mới phải khác mật khẩu hiện tại."); return; }
    if (mk1 !== mk2) { setLoi("Hai mật khẩu nhập không khớp."); return; }
    if (!isLive) { setLoi("Chỉ đổi được mật khẩu ở chế độ LIVE (đã đăng nhập thật)."); return; }
    setDang(true);
    const { error } = await doiMatKhau(mkCu, mk1);
    setDang(false);
    if (error) setLoi(error.message || "Đổi mật khẩu thất bại.");
    else { setOk(true); setMkCu(""); setMk1(""); setMk2(""); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#E6F4F1,#fff)" }}>
          <div className="flex items-center gap-2"><div className="rounded-2xl bg-white p-2 ring-1 ring-teal-100"><KeyRound className="w-5 h-5" style={{ color: COLOR.teal }} strokeWidth={1.8} /></div><div><h2 className="text-sm font-semibold" style={{ color: COLOR.navy }}>Đổi mật khẩu</h2><p className="text-[11px] text-slate-500">{user ? `${user.name} · ${user.email}` : "chưa đăng nhập"}</p></div></div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" strokeWidth={1.8} /></button>
        </div>
        <div className="px-6 py-5 space-y-3">
          <input type="password" value={mkCu} onChange={(e) => setMkCu(e.target.value)} placeholder="Mật khẩu hiện tại" autoComplete="current-password" className="w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-300" />
          <div className="h-px bg-slate-100" />
          <input type="password" value={mk1} onChange={(e) => setMk1(e.target.value)} placeholder="Mật khẩu mới" autoComplete="new-password" className="w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-300" />
          <input type="password" value={mk2} onChange={(e) => setMk2(e.target.value)} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" onKeyDown={(e) => e.key === "Enter" && doi()} className="w-full rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-300" />
          {loi && <p className="text-[12px] text-rose-600">{loi}</p>}
          {ok && <p className="text-[12px] text-teal-600">Đã đổi mật khẩu thành công.</p>}
          <button disabled={dang} onClick={doi} className="w-full text-sm font-semibold text-white rounded-2xl py-2.5 disabled:opacity-60" style={{ background: "linear-gradient(135deg,#1aa899,#149e90)" }}>{dang ? "Đang đổi…" : "Đổi mật khẩu"}</button>
          <p className="text-[11px] text-slate-400 leading-relaxed">Cần xác thực mật khẩu hiện tại. Mật khẩu mới tối thiểu 6 ký tự; lần đăng nhập sau dùng mật khẩu mới.</p>
        </div>
      </div>
    </div>
  );
}


// Phân tích GMP chuyên sâu (MKT + SPC) — tất định, job đêm tính, chỉ hiện ở LIVE.
function PhanTichGmpCard({ mkt, spc, isLive }) {
  if (!isLive) return (
    <Card className="p-6"><SectionTitle icon={Activity} hint="MKT (ICH Q1A) + SPC (EWMA/CUSUM/Nelson)">Phân tích GMP chuyên sâu</SectionTitle>
      <p className="mt-3 text-[13px] text-slate-500">Hiển thị ở chế độ <b>LIVE</b> (đọc dữ liệu thật). MKT/SPC được job đêm tính tất định từ Supabase.</p>
    </Card>
  );
  const mk = mkt || [], sp = spc || [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6"><SectionTitle icon={Thermometer} hint="Nhiệt độ động học TB · 30 ngày · ICH Q1A">MKT theo phòng</SectionTitle>
        <p className="text-[11px] text-slate-400 mt-1">MKT phạt các đợt nhiệt cao (Arrhenius), luôn ≥ nhiệt độ TB. Phòng MKT cao → chú ý phơi nhiễm nhiệt.</p>
        {mk.length ? (
          <div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Phòng", "Khu", "Ưu tiên", "MKT °C", "T TB", "T max"].map((hh) => <th key={hh} className="py-2 pr-3 font-semibold whitespace-nowrap">{hh}</th>)}</tr></thead><tbody>
            {mk.slice(0, 12).map((r) => <tr key={r.ma_phong} className="border-t border-slate-100 hover:bg-sky-50/40"><td className="py-2 pr-3"><span className="font-semibold" style={{ color: COLOR.navy }}>{r.ma_phong}</span> <span className="text-slate-400 text-[11px]">{r.ten_phong}</span></td><td className="py-2 pr-3 text-slate-500">{r.khu_vuc}</td><td className="py-2 pr-3">{r.muc_uu_tien && <MucBadge p={r.muc_uu_tien} />}</td><td className="py-2 pr-3 tabular-nums font-semibold" style={{ color: COLOR.navy }}>{r.mkt == null ? "—" : r.mkt.toFixed(2)}</td><td className="py-2 pr-3 tabular-nums text-slate-600">{r.tTb == null ? "—" : r.tTb.toFixed(2)}</td><td className="py-2 pr-3 tabular-nums text-slate-600">{r.tMax == null ? "—" : r.tMax.toFixed(2)}</td></tr>)}
          </tbody></table></div>
        ) : <p className="mt-3 text-[13px] text-slate-500">Chưa có dữ liệu MKT (cần sensor nhiệt + job đêm đã chạy).</p>}
      </Card>
      <Card className="p-6"><SectionTitle icon={Activity} hint="EWMA · CUSUM · Nelson rules">SPC — cảnh báo dịch chuyển</SectionTitle>
        <p className="text-[11px] text-slate-400 mt-1">"Ngoài kiểm soát" = có tín hiệu dịch chuyển/xu hướng trước khi vượt ngưỡng OOS. Nelson1=vượt 3σ, 2=9 điểm cùng phía, 3=6 điểm tăng/giảm.</p>
        {sp.length ? (
          <div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Phạm vi", "Sensor", "Mục tiêu", "σ", "Tín hiệu", "Loại"].map((hh) => <th key={hh} className="py-2 pr-3 font-semibold whitespace-nowrap">{hh}</th>)}</tr></thead><tbody>
            {sp.slice(0, 12).map((r, i) => <tr key={i} className="border-t border-slate-100 hover:bg-sky-50/40"><td className="py-2 pr-3"><span className="font-semibold" style={{ color: COLOR.navy }}>{r.scope_id}</span> <span className="text-slate-400 text-[11px]">{r.ten_scope}</span></td><td className="py-2 pr-3 text-slate-500">{r.sensor_type}</td><td className="py-2 pr-3 tabular-nums text-slate-600">{r.mucTieu == null ? "—" : fmtPct(r.mucTieu)}</td><td className="py-2 pr-3 tabular-nums text-slate-600">{r.sigma == null ? "—" : r.sigma.toFixed(2)}</td><td className="py-2 pr-3"><span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: "rgba(226,103,79,0.14)", color: COLOR.coralDeep }}>{r.soTinHieu}</span></td><td className="py-2 pr-3 text-[11px] text-slate-500">{r.cacLoai || "—"}</td></tr>)}
          </tbody></table></div>
        ) : <p className="mt-3 text-[13px] text-teal-600">Tất cả phạm vi đang trong kiểm soát — không có tín hiệu SPC.</p>}
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

  if (!isLive) return <Card className="p-8 text-center text-[13px] text-slate-500">Cần kết nối dữ liệu thật (LIVE) để quản lý tài khoản.</Card>;
  return (
    <Card className="p-6">
      <SectionTitle icon={KeyRound} hint="chỉ Quản trị · gán vai trò + khu được xem cho từng tài khoản">Tài khoản & phân quyền xem</SectionTitle>
      <p className="text-[12px] text-slate-500 mt-2">Mỗi tài khoản chỉ <b>xem</b> dữ liệu của các khu được tích — <b>chặn ngay tại máy chủ</b> (mọi tab: Tổng quan · Sự cố · Chênh áp · Xu hướng GMP; kể cả gọi API trực tiếp cũng không lấy được khu khác). Tổng/toàn hệ với tài khoản giới hạn = gộp đúng các khu được xem. <b>Quản trị</b> luôn xem tất cả. Tạo tài khoản đăng nhập mới thực hiện ở Supabase; tại đây gán vai trò & khu — có hiệu lực ngay lần tải dữ liệu kế tiếp.</p>
      {loi ? <p className="text-[13px] text-rose-600 mt-4">Không tải được danh sách (cần quyền Quản trị): {loi.thong_bao || loi.message}</p>
        : loading ? <p className="text-[13px] text-slate-500 mt-4">Đang tải…</p>
        : rows.length === 0 ? <p className="text-[13px] text-slate-500 mt-4">Chưa có tài khoản, hoặc bạn không có quyền Quản trị.</p>
        : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-[13px]">
            <thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Tài khoản", "Vai trò", "Khu được xem", "Hoạt động", ""].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.email} className="border-t border-slate-100 align-middle">
                <td className="py-2.5 pr-4"><p className="font-semibold" style={{ color: COLOR.navy }}>{r.ho_ten}</p><p className="text-[11px] text-slate-500">{r.email}</p></td>
                <td className="py-2.5 pr-4"><select value={r.vai_tro} onChange={(e) => doi(r.email, { vai_tro: e.target.value })} className="rounded-lg bg-white ring-1 ring-slate-200 px-2 py-1 text-[12px]">{VAI_TRO_CHON.map((v) => <option key={v.k} value={v.k}>{v.label}</option>)}</select></td>
                <td className="py-2.5 pr-4">{r.vai_tro === "ADMIN" ? <span className="text-[11px] text-slate-400 italic">tất cả (Quản trị)</span> : <div className="flex gap-1.5">{DS_KHU.map((k) => { const on = r.khu_vuc.includes(k); return <button key={k} onClick={() => toggleKhu(r.email, k)} className={`px-2.5 py-1 rounded-lg text-[12px] font-medium ring-1 transition ${on ? "text-white ring-transparent" : "text-slate-500 bg-white ring-slate-200 hover:ring-teal-300"}`} style={on ? { backgroundColor: COLOR.teal } : {}}>{k}</button>; })}</div>}</td>
                <td className="py-2.5 pr-4"><button onClick={() => doi(r.email, { kich_hoat: !r.kich_hoat })} className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 ring-1 ${r.kich_hoat ? "text-teal-700 bg-teal-50 ring-teal-200" : "text-slate-500 bg-slate-100 ring-slate-200"}`}>{r.kich_hoat ? "Bật" : "Tắt"}</button></td>
                <td className="py-2.5 pr-4"><button onClick={() => luuMot(r)} className="text-[11px] font-medium text-white rounded-lg px-3 py-1.5 flex items-center gap-1" style={{ backgroundColor: COLOR.teal }}><Save className="w-3.5 h-3.5" strokeWidth={1.8} /> {luu[r.email] === "dang" ? "Đang lưu…" : luu[r.email] === "ok" ? "Đã lưu ✓" : luu[r.email] === "loi" ? "Lỗi" : "Lưu"}</button></td>
              </tr>
            ))}
            {chuaPhanQuyen.length > 0 && (
              <tr className="border-t border-slate-200 bg-sky-50/50 align-middle">
                <td className="py-2.5 pr-4">
                  <select value={nguoiMoi.email} onChange={(e) => setNguoiMoi({ ...nguoiMoi, email: e.target.value })}
                    className="w-full min-w-[200px] rounded-lg bg-white ring-1 ring-sky-200 px-2 py-1.5 text-[12px] font-mono">
                    <option value="">Chọn tài khoản chưa phân quyền…</option>
                    {chuaPhanQuyen.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <input value={nguoiMoi.ho_ten} placeholder="Họ tên (tuỳ chọn)" onChange={(e) => setNguoiMoi({ ...nguoiMoi, ho_ten: e.target.value })}
                    className="w-full mt-1.5 rounded-lg bg-white ring-1 ring-sky-200 px-2 py-1.5 text-[12px]" />
                </td>
                <td className="py-2.5 pr-4"><select value={nguoiMoi.vai_tro} onChange={(e) => setNguoiMoi({ ...nguoiMoi, vai_tro: e.target.value })} className="rounded-lg bg-white ring-1 ring-sky-200 px-2 py-1 text-[12px]">{VAI_TRO_CHON.map((v) => <option key={v.k} value={v.k}>{v.label}</option>)}</select></td>
                <td className="py-2.5 pr-4">{nguoiMoi.vai_tro === "ADMIN" ? <span className="text-[11px] text-slate-400 italic">tất cả (Quản trị)</span> : <div className="flex gap-1.5">{DS_KHU.map((k) => { const on = nguoiMoi.khu_vuc.includes(k); return <button key={k} onClick={() => setNguoiMoi({ ...nguoiMoi, khu_vuc: on ? nguoiMoi.khu_vuc.filter((x) => x !== k) : [...nguoiMoi.khu_vuc, k] })} className={`px-2.5 py-1 rounded-lg text-[12px] font-medium ring-1 ${on ? "text-white ring-transparent" : "text-slate-500 bg-white ring-slate-200"}`} style={on ? { backgroundColor: COLOR.teal } : {}}>{k}</button>; })}</div>}</td>
                <td className="py-2.5 pr-4 text-[11px] text-slate-400">Bật</td>
                <td className="py-2.5 pr-4"><button onClick={themNguoi} disabled={!nguoiMoi.email || luuMoi === "dang"} className="text-[11px] font-medium text-white rounded-lg px-3 py-1.5 flex items-center gap-1 disabled:opacity-40" style={{ backgroundColor: COLOR.coral }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> {luuMoi === "dang" ? "Đang lưu…" : luuMoi === "ok" ? "Đã thêm ✓" : "Phân quyền"}</button></td>
              </tr>)}
            </tbody>
          </table>
          {luuMoi && luuMoi !== "dang" && luuMoi !== "ok" && <p className="text-[12px] text-rose-600 mt-2">{luuMoi}</p>}
          {chuaPhanQuyen.length === 0 && <p className="text-[11px] text-slate-400 mt-3">Mọi tài khoản đăng nhập đều đã được phân quyền. Tài khoản mới tạo ở <b>Supabase → Authentication → Users</b> sẽ tự hiện ở đây.</p>}
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
    setKq(error ? { ok: false, thong_bao: error.thong_bao || "Không kiểm được" } : data);
  };
  return (
    <Card className="p-6">
      <SectionTitle icon={ShieldCheck} hint="tamper-evident · 21 CFR Part 11">Toàn vẹn nhật ký audit</SectionTitle>
      <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">Mỗi bản ghi audit mang mã băm móc vào bản ghi trước. Sửa lén một dòng bất kỳ (kể cả bằng quyền cao nhất) là <b>đứt cả chuỗi</b> — nút dưới đây duyệt lại toàn bộ và chỉ ra ngay bản ghi đầu tiên bị đổi.</p>
      <button disabled={!isLive || dangChay} onClick={chay} className="mt-3 rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: COLOR.teal }}>{dangChay ? "Đang duyệt…" : "Kiểm toàn vẹn chuỗi"}</button>
      {kq && (
        <div className={`mt-3 rounded-2xl px-4 py-3 text-[13px] ${kq.ok ? "bg-teal-50 text-teal-800 ring-1 ring-teal-200" : "bg-rose-50 text-rose-800 ring-1 ring-rose-200"}`}>
          {kq.ok ? "✓ " : "⚠ "}{kq.thong_bao}
        </div>
      )}
    </Card>
  );
}


export { LoginModal, SucKhoeWidget, DoiMatKhauCard, DoiMatKhauModal, PhanTichGmpCard, TaiKhoanCard, ChuoiHashCard };
