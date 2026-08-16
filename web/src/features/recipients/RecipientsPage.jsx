// RecipientsPage.jsx — cấu hình người nhận + luật phân tuyến (tách move-only từ App.jsx 17/08/2026).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertOctagon, Check, Clock, Settings as Cog, FileBarChart, GitBranch, Mail, Pencil, Plus, Power, Save, Trash2, X } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { COLOR } from "../../lib/designTokens";
import { DB_MOI_MAC_DINH, DS_KHU, ROLE_VI } from "../../lib/phanQuyen";
import { EMAIL_KEYS_BAO_CAO, EMAIL_KEYS_HE_THONG, datCauHinhEmail, datCongTacPhanTuyen, layCauHinhEmail, layDanhSachAhu, layKhungGioCanhBao, layLuatPhanTuyen, layNguoiNhanBaoCao, layNguoiNhanCanhBao, luuKhungGioCanhBao, luuLuatPhanTuyen, luuNguoiNhanBaoCao, luuNguoiNhanCanhBao, xoaLuatPhanTuyen, xoaNguoiNhanBaoCao, xoaNguoiNhanCanhBao } from "../../lib/supabaseData";
// ====== Tab NGƯỜI NHẬN: danh bạ cảnh báo (nguoi_nhan_canh_bao, vai trò × khu C1/C4/Q2)
// + người nhận báo cáo (nguoi_nhan_bao_cao, có khu_vuc) + email hệ thống (cau_hinh) ======
const NHAN_EMAIL_LABEL = {
  email_ipc: "IPC (Hiện trường)", email_co_dien: "Cơ điện", email_qa: "QA",
  email_truc_hsl: "Trực hồ sơ lô", email_it_gmp: "IT / Kỹ thuật",
  email_gui_tu: "Địa chỉ GỬI ĐI (from)", email_test: "Địa chỉ TEST (chế độ thử)",
  email_bao_cao_tuan: "Fallback báo cáo TUẦN", email_bao_cao_thang: "Fallback báo cáo THÁNG", email_bao_cao_ngay: "Fallback báo cáo NGÀY",
};
const DS_VAI_TRO_CB = [["IPC", "IPC hiện trường"], ["MEP", "Cơ điện"], ["QA", "QA"], ["LOT", "Trực HSL"], ["IT", "IT"]];
// Ô phân công AHU cho Cơ điện. Rỗng = nhận MỌI AHU trong các khu đã tích.
// Chỉ liệt kê AHU thuộc khu người đó phụ trách; AHU toàn phòng P3 hiện mờ vì không sinh sự cố.
function ChonAhu({ nn, dsAhu, canManage, onLuu }) {
  const [mo, setMo] = useState(false);
  if (nn.vai_tro !== "MEP") return <span className="text-[11px] text-muted">—</span>;
  const daChon = nn.ahu || [];
  const trongKhu = dsAhu.filter((a) => (nn.khu_vuc || []).includes(a.khu_vuc));
  const toggle = (maAhu) => onLuu({ ...nn, ahu: daChon.includes(maAhu) ? daChon.filter((x) => x !== maAhu) : [...daChon, maAhu] });
  const nhan = daChon.length === 0 ? "Tất cả AHU" : `${daChon.length} AHU`;
  return (
    <div className="relative">
      <button disabled={!canManage} onClick={() => setMo((v) => !v)}
        className={`text-[11px] px-2 py-1 rounded-lg font-medium whitespace-nowrap ${daChon.length ? "bg-info-soft text-info" : "bg-subtle text-muted"} disabled:opacity-60`}>
        {nhan} ▾
      </button>
      {mo && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMo(false)} />
          <div className="absolute z-20 mt-1 left-0 w-56 rounded-xl bg-surface ring-1 ring-line shadow-lg p-2 max-h-64 overflow-y-auto">
            <p className="text-[10px] text-muted px-1 pb-1.5 leading-snug">Bỏ trống = nhận mọi AHU trong khu đã tích.</p>
            {trongKhu.length === 0 && <p className="text-[11px] text-muted px-1 py-2 italic">Chưa tích khu nào.</p>}
            {trongKhu.map((a) => (
              <label key={a.ma_ahu} className={`flex items-center gap-2 px-1 py-1 rounded-lg text-[12px] cursor-pointer hover:bg-subtle ${a.co_p1_p2 ? "" : "opacity-45"}`}>
                <input type="checkbox" checked={daChon.includes(a.ma_ahu)} onChange={() => toggle(a.ma_ahu)} className="rounded" />
                <span className="font-mono">{a.ma_ahu}</span>
                <span className="text-muted ml-auto">{a.co_p1_p2 ? `${a.so_phong} phòng` : "chỉ P3"}</span>
              </label>))}
          </div>
        </>)}
    </div>
  );
}


function CauHinhNguoiNhan({ isLive, canManage, laAdmin, actor }) {
  const [emailCfg, setEmailCfg] = useState({});
  const [nguoiNhan, setNguoiNhan] = useState([]);
  const [danhBa, setDanhBa] = useState([]);    // danh bạ cảnh báo vai trò × khu
  const [dongHo, setDongHo] = useState([]);    // đồng hồ cảnh báo theo bộ phận (khung_gio_canh_bao) — bản NHÁP đang sửa
  const gocDongHo = useRef([]);                // bản server đã lưu (so sánh để biết dòng nào đổi)
  const [dsAhu, setDsAhu] = useState([]);      // {ma_ahu:'C1/AHU03', khu_vuc, ahu, so_phong, co_p1_p2}
  const [dbMoi, setDbMoi] = useState(DB_MOI_MAC_DINH());   // hàng "thêm mới" cuối bảng danh bạ
  const [tai, setTai] = useState(true);
  const [tb, setTb] = useState(null);          // {ok, text}
  const [form, setForm] = useState(null);      // form thêm/sửa người nhận báo cáo
  const goc = useRef({});                       // giá trị email đã lưu (so sánh khi blur)
  const gocDB = useRef({});                     // email/họ tên danh bạ đã lưu theo id (so sánh khi blur)
  const flash = (ok, text) => { setTb({ ok, text }); setTimeout(() => setTb(null), 4000); };
  const napLai = async () => {
    if (!isLive) { setTai(false); return; }
    setTai(true);
    const [e, n, d, a, kg] = await Promise.all([layCauHinhEmail(), layNguoiNhanBaoCao(), layNguoiNhanCanhBao(), layDanhSachAhu(), layKhungGioCanhBao()]);
    if (e.cfg) { setEmailCfg(e.cfg); goc.current = { ...e.cfg }; }
    setNguoiNhan(n.rows || []);
    setDanhBa(d.rows || []);
    setDsAhu(a.rows || []);
    setDongHo(kg.rows || []);
    gocDongHo.current = JSON.parse(JSON.stringify(kg.rows || []));
    gocDB.current = Object.fromEntries((d.rows || []).map((r) => [r.id, { email: r.email || "", ho_ten: r.ho_ten || "" }]));
    setTai(false);
  };
  useEffect(() => { napLai(); /* eslint-disable-next-line */ }, [isLive]);
  // ---- Danh bạ CẢNH BÁO (ghi qua rpc_luu/xoa_nguoi_nhan_canh_bao, gate ADMIN/QA) ----
  const luuDB = async (nn, textOk) => {
    if (!canManage) return false;
    const { error } = await luuNguoiNhanCanhBao(nn, actor);
    if (error) { flash(false, error.thong_bao || "Không lưu được"); await napLai(); return false; }
    flash(true, textOk || "Đã lưu danh bạ cảnh báo"); await napLai(); return true;
  };
  const toggleKhuDB = (nn, khu) => {
    const cu = nn.khu_vuc || [];
    // bỏ tích cả 3 khu → RPC tự đặt lại đủ 3 khu (an toàn, không mất cảnh báo im lặng)
    luuDB({ ...nn, khu_vuc: cu.includes(khu) ? cu.filter((k) => k !== khu) : [...cu, khu] });
  };
  const suaDB = (id, field, value) => setDanhBa((ds) => ds.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const blurDB = (nn, field) => {  // chỉ ghi khi email/họ tên thật sự đổi
    if ((nn[field] || "").trim() !== (gocDB.current[nn.id]?.[field] || "")) luuDB(nn);
  };
  const xoaDB = async (id) => {
    if (!canManage || !window.confirm("Xoá địa chỉ này khỏi danh bạ cảnh báo?")) return;
    const { error } = await xoaNguoiNhanCanhBao(id, actor);
    if (error) { flash(false, error.thong_bao || "Không xoá được"); return; }
    flash(true, "Đã xoá"); await napLai();
  };
  const themDB = async () => {
    if (!(dbMoi.email || "").trim()) { flash(false, "Cần nhập email trước khi thêm"); return; }
    if (await luuDB({ ...dbMoi, id: null }, "Đã thêm vào danh bạ cảnh báo")) setDbMoi(DB_MOI_MAC_DINH());
  };
  // ---- Đồng hồ cảnh báo (ghi qua rpc_luu_khung_gio_canh_bao, gate CHỈ ADMIN) ----
  // Sửa NHÁP tại chỗ, một nút "Lưu thay đổi" ghi mọi dòng đã đổi trong MỘT lượt —
  // không lưu-và-nạp-lại sau từng cú bấm (phản hồi 15/07: bấm 5 ô ngày = 5 lần giật trang).
  const khoaDongHo = (r) => JSON.stringify([!!r.kich_hoat, r.gio_tu, r.gio_den, [...(r.ngay || [])].sort((a, b) => a - b)]);
  const dongHoDoi = useMemo(() => dongHo.filter((r) => {
    const g = (gocDongHo.current || []).find((x) => x.vai_tro === r.vai_tro);
    return g && khoaDongHo(g) !== khoaDongHo(r);
  }), [dongHo]); // eslint-disable-line react-hooks/exhaustive-deps
  const suaDongHo = (vaiTro, patch) => { if (laAdmin) setDongHo((ds) => ds.map((r) => (r.vai_tro === vaiTro ? { ...r, ...patch } : r))); };
  const [dangLuuDH, setDangLuuDH] = useState(false);
  const luuTatCaDongHo = async () => {
    if (!laAdmin || !dongHoDoi.length) return;
    setDangLuuDH(true);
    const loi = [];
    for (const kg of dongHoDoi) {
      const { error, data } = await luuKhungGioCanhBao(kg, actor);
      if (error) loi.push(`${kg.vai_tro}: ${error.thong_bao || error.ma_loi || "lỗi kết nối"}`);
      else if (data && data.ok === false) loi.push(`${kg.vai_tro}: ${data.thong_bao || data.loi}`);
    }
    setDangLuuDH(false);
    if (loi.length) flash(false, loi.join(" · "));
    else flash(true, `Đã lưu đồng hồ cảnh báo (${dongHoDoi.length} bộ phận)`);
    await napLai();
  };
  const huyDongHo = () => setDongHo(JSON.parse(JSON.stringify(gocDongHo.current || [])));
  const luuEmail = async (key, value) => {
    if (!canManage) return;
    const { error } = await datCauHinhEmail(key, value, actor);
    if (error) flash(false, error.thong_bao || "Không lưu được");
    else { const v = (value || "").trim(); goc.current = { ...goc.current, [key]: v }; setEmailCfg((m) => ({ ...m, [key]: v })); flash(true, "Đã lưu " + (NHAN_EMAIL_LABEL[key] || key)); }
  };
  const luuNN = async () => {
    if (!form) return;
    const { error } = await luuNguoiNhanBaoCao(form, actor);
    if (error) { flash(false, error.thong_bao || "Không lưu được"); return; }
    flash(true, "Đã lưu người nhận"); setForm(null); await napLai();
  };
  const toggleNN = async (nn, field) => {
    if (!canManage) return;
    const { error } = await luuNguoiNhanBaoCao({ ...nn, [field]: !nn[field] }, actor);
    if (error) flash(false, error.thong_bao || "Không cập nhật được"); else await napLai();
  };
  const toggleKhuNN = async (nn, khu) => {   // tích/bỏ khu C1/C4/Q2 cho người nhận báo cáo
    if (!canManage) return;
    const cu = nn.khu_vuc || [];
    const khuMoi = cu.includes(khu) ? cu.filter((k) => k !== khu) : [...cu, khu];
    const { error } = await luuNguoiNhanBaoCao({ ...nn, khu_vuc: khuMoi }, actor);
    if (error) flash(false, error.thong_bao || "Không cập nhật được"); else await napLai();
  };
  const xoaNN = async (id) => {
    if (!canManage || !window.confirm("Xoá người nhận này?")) return;
    const { error } = await xoaNguoiNhanBaoCao(id, actor);
    if (error) { flash(false, error.thong_bao || "Không xoá được"); return; }
    flash(true, "Đã xoá"); await napLai();
  };
  const emailFields = (keys) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">{keys.map((k) => (
      <div key={k} className="rounded-2xl bg-subtle ring-1 ring-line p-4">
        <label className="text-[11px] uppercase text-muted font-semibold">{NHAN_EMAIL_LABEL[k] || k}</label>
        <input type="email" value={emailCfg[k] || ""} disabled={!canManage} placeholder="email@cpc1hn.vn"
          onChange={(e) => setEmailCfg((m) => ({ ...m, [k]: e.target.value }))}
          onBlur={(e) => { if ((e.target.value || "").trim() !== (goc.current[k] || "")) luuEmail(k, e.target.value); }}
          className="w-full mt-2 rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-sm disabled:bg-subtle" />
        <p className="text-[10px] text-muted mt-1 font-mono">{k}</p>
      </div>))}</div>
  );
  if (!isLive) return <Card className="p-6"><p className="text-sm text-warning">Cần chế độ LIVE (kết nối Supabase) để cấu hình người nhận.</p></Card>;
  return (
    <div className="space-y-5">
      <SectionTitle icon={Mail}>Người nhận email</SectionTitle>
      {tb && <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${tb.ok ? "bg-success-soft text-success ring-1 ring-success-line" : "bg-danger-soft text-danger ring-1 ring-danger-line"}`}>{tb.ok ? "✓ " : "✗ "}{tb.text}</div>}
      {!canManage && <p className="text-[12px] text-warning">Bạn đang xem ở chế độ chỉ-đọc. Cần quyền <b>QA/Quản trị</b> để chỉnh.</p>}

      <Card className="p-6">
        <SectionTitle icon={AlertOctagon} hint="định tuyến cảnh báo theo vai trò × khu — sự cố khu nào gửi người tích khu đó">Danh bạ email CẢNH BÁO (vai trò × khu)</SectionTitle>
        {tai ? <div className="h-24 rounded-2xl bg-subtle animate-pulse mt-4" /> :
          <div className="overflow-x-auto mt-4"><table className="w-full text-[13px]"><thead><tr className="text-muted text-left text-[11px] uppercase tracking-wider">{["Email", "Họ tên", "Vai trò", "C1", "C4", "Q2", "AHU phụ trách", "Hoạt động", ""].map((h, i) => <th key={i} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {danhBa.length === 0 && !canManage && <tr><td colSpan={9} className="py-4 text-muted italic">Chưa có địa chỉ nào trong danh bạ.</td></tr>}
              {danhBa.map((n) => (
                <tr key={n.id} className={`border-t border-line ${n.kich_hoat ? "" : "opacity-50"}`}>
                  <td className="py-2 pr-4"><input type="email" value={n.email || ""} disabled={!canManage} onChange={(e) => suaDB(n.id, "email", e.target.value)} onBlur={() => blurDB(n, "email")} className="w-full min-w-[190px] rounded-xl bg-surface ring-1 ring-line px-3 py-1.5 text-[12px] font-mono disabled:bg-subtle disabled:ring-0" /></td>
                  <td className="py-2 pr-4"><input value={n.ho_ten || ""} disabled={!canManage} placeholder="—" onChange={(e) => suaDB(n.id, "ho_ten", e.target.value)} onBlur={() => blurDB(n, "ho_ten")} className="w-full min-w-[110px] rounded-xl bg-surface ring-1 ring-line px-3 py-1.5 text-sm disabled:bg-subtle disabled:ring-0" /></td>
                  <td className="py-2 pr-4"><select value={n.vai_tro} disabled={!canManage} onChange={(e) => luuDB({ ...n, vai_tro: e.target.value })} className="rounded-xl bg-surface ring-1 ring-line px-2 py-1.5 text-sm disabled:bg-subtle">{DS_VAI_TRO_CB.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  {DS_KHU.map((k) => <td key={k} className="py-2 pr-4"><button disabled={!canManage} onClick={() => toggleKhuDB(n, k)} className={`w-6 h-6 rounded-lg flex items-center justify-center ${(n.khu_vuc || []).includes(k) ? "bg-success-soft text-success" : "bg-subtle text-muted"} disabled:opacity-60`}>{(n.khu_vuc || []).includes(k) ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                  <td className="py-2 pr-4"><ChonAhu nn={n} dsAhu={dsAhu} canManage={canManage} onLuu={(x) => luuDB(x, "Đã lưu phân công AHU")} /></td>
                  <td className="py-2 pr-4"><button disabled={!canManage} onClick={() => luuDB({ ...n, kich_hoat: !n.kich_hoat })} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${n.kich_hoat ? "bg-success-soft text-success" : "bg-subtle text-muted"} disabled:opacity-60`}>{n.kich_hoat ? "Bật" : "Tắt"}</button></td>
                  <td className="py-2 pr-4">{canManage && <button onClick={() => xoaDB(n.id)} className="text-danger hover:text-danger"><Trash2 className="w-4 h-4" strokeWidth={1.8} /></button>}</td>
                </tr>))}
              {canManage && (  /* hàng THÊM MỚI cuối bảng */
                <tr className="border-t border-line bg-info-soft/50">
                  <td className="py-2.5 pr-4"><input type="email" value={dbMoi.email} placeholder="email@cpc1hn.vn" onChange={(e) => setDbMoi({ ...dbMoi, email: e.target.value })} onKeyDown={(e) => e.key === "Enter" && themDB()} className="w-full min-w-[190px] rounded-xl bg-surface ring-1 ring-info-line px-3 py-1.5 text-[12px] font-mono" /></td>
                  <td className="py-2.5 pr-4"><input value={dbMoi.ho_ten} placeholder="Họ tên (tuỳ chọn)" onChange={(e) => setDbMoi({ ...dbMoi, ho_ten: e.target.value })} className="w-full min-w-[110px] rounded-xl bg-surface ring-1 ring-info-line px-3 py-1.5 text-sm" /></td>
                  <td className="py-2.5 pr-4"><select value={dbMoi.vai_tro} onChange={(e) => setDbMoi({ ...dbMoi, vai_tro: e.target.value })} className="rounded-xl bg-surface ring-1 ring-info-line px-2 py-1.5 text-sm">{DS_VAI_TRO_CB.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  {DS_KHU.map((k) => <td key={k} className="py-2.5 pr-4"><button onClick={() => setDbMoi({ ...dbMoi, khu_vuc: dbMoi.khu_vuc.includes(k) ? dbMoi.khu_vuc.filter((x) => x !== k) : [...dbMoi.khu_vuc, k] })} className={`w-6 h-6 rounded-lg flex items-center justify-center ${dbMoi.khu_vuc.includes(k) ? "bg-success-soft text-success" : "bg-surface ring-1 ring-line text-muted"}`}>{dbMoi.khu_vuc.includes(k) ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                  <td className="py-2.5 pr-4 text-[11px] text-muted">{dbMoi.vai_tro === "MEP" ? "Phân công sau khi thêm" : "—"}</td>
                  <td className="py-2.5 pr-4 text-[11px] text-muted">Kích hoạt</td>
                  <td className="py-2.5 pr-4"><button onClick={themDB} className="text-xs font-medium text-white rounded-xl px-3 py-1.5 flex items-center gap-1" style={{ backgroundColor: "var(--danger-solid)" }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm</button></td>
                </tr>)}
            </tbody></table></div>}
        <p className="text-[11px] text-muted mt-3">Sự cố ở khu nào chỉ gửi người có tích khu đó, và <b>chỉ khi tài khoản của họ được xem khu đó</b>. Khu chưa ai tích → gửi toàn bộ người hợp lệ của vai trò (không bỏ sót). <b>Phải chọn ít nhất một khu</b> — bỏ tích cả ba sẽ không lưu được.</p>
        <p className="text-[11px] text-muted mt-1"><b>AHU phụ trách</b> chỉ áp dụng cho Cơ điện: mỗi AHU sẽ gửi một email riêng cho đúng người phụ trách. Bỏ trống = nhận mọi AHU trong các khu đã tích. Tên AHU trùng nhau giữa các khu nên ghi dạng <span className="font-mono">KHU/AHU</span>. AHU hiển thị mờ là AHU chỉ có phòng P3 — không bao giờ sinh sự cố.</p>
      </Card>

      <Card className="p-6">
        <SectionTitle icon={Clock} hint="chỉ gửi email cảnh báo trong khung giờ của từng bộ phận — chỉ Quản trị chỉnh được">Đồng hồ cảnh báo theo bộ phận</SectionTitle>
        {!laAdmin && <p className="text-[12px] text-warning mt-2">Chỉ <b>Quản trị</b> được sửa đồng hồ. Bạn đang xem chỉ-đọc.</p>}
        {tai ? <div className="h-24 rounded-2xl bg-subtle animate-pulse mt-4" /> :
          <div className="overflow-x-auto mt-4"><table className="w-full text-[13px]"><thead><tr className="text-muted text-left text-[11px] uppercase tracking-wider">{["Bộ phận", "Chế độ", "Từ", "Đến", "Ngày trong tuần", "Hiện tại", "Cập nhật"].map((h, i) => <th key={i} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {dongHo.map((k) => (
                <tr key={k.vai_tro} className="border-t border-line">
                  <td className="py-2.5 pr-4 font-semibold" style={{ color: "var(--text-strong)" }}>{ROLE_VI[k.vai_tro] || k.vai_tro}</td>
                  <td className="py-2.5 pr-4">
                    <button disabled={!laAdmin} onClick={() => suaDongHo(k.vai_tro, { kich_hoat: !k.kich_hoat })}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${k.kich_hoat ? "bg-warning-soft text-warning" : "bg-success-soft text-success"} disabled:opacity-60`}>
                      {k.kich_hoat ? "Theo khung giờ" : "24/7"}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4"><input type="time" value={k.gio_tu || ""} disabled={!laAdmin || !k.kich_hoat}
                    onChange={(e) => suaDongHo(k.vai_tro, { gio_tu: e.target.value })}
                    className="rounded-xl bg-surface ring-1 ring-line px-2.5 py-1.5 text-[12px] tabular-nums disabled:bg-subtle disabled:text-muted" /></td>
                  <td className="py-2.5 pr-4"><input type="time" value={k.gio_den || ""} disabled={!laAdmin || !k.kich_hoat}
                    onChange={(e) => suaDongHo(k.vai_tro, { gio_den: e.target.value })}
                    className="rounded-xl bg-surface ring-1 ring-line px-2.5 py-1.5 text-[12px] tabular-nums disabled:bg-subtle disabled:text-muted" /></td>
                  <td className="py-2.5 pr-4">
                    <div className="flex gap-1">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((nhan, i) => {
                      const d = i + 1; const on = (k.ngay || []).includes(d);
                      return <button key={d} disabled={!laAdmin || !k.kich_hoat}
                        onClick={() => suaDongHo(k.vai_tro, { ngay: on ? (k.ngay || []).filter((x) => x !== d) : [...(k.ngay || []), d].sort((a, b) => a - b) })}
                        className={`w-8 h-7 rounded-lg text-[11px] font-semibold ${on ? "bg-success-soft text-success" : "bg-subtle text-muted"} disabled:opacity-60`}>{nhan}</button>;
                    })}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${k.dang_trong_gio ? "bg-success-soft text-success ring-1 ring-success-line" : "bg-subtle text-muted ring-1 ring-line"}`}>
                      {k.dang_trong_gio ? "đang gửi cảnh báo" : "ngoài giờ — im lặng"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-[11px] text-muted whitespace-nowrap">{k.cap_nhat_boi ? `${k.cap_nhat_luc} · ${k.cap_nhat_boi}` : "—"}</td>
                </tr>))}
            </tbody></table></div>}
        {laAdmin && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button onClick={luuTatCaDongHo} disabled={!dongHoDoi.length || dangLuuDH}
              className="text-xs font-semibold text-white rounded-xl px-4 py-2 flex items-center gap-1.5 disabled:opacity-40"
              style={{ backgroundColor: "var(--danger-solid)" }}>
              <Save className="w-3.5 h-3.5" strokeWidth={2} />
              {dangLuuDH ? "Đang lưu…" : dongHoDoi.length ? `Lưu thay đổi (${dongHoDoi.length} bộ phận)` : "Lưu thay đổi"}
            </button>
            {dongHoDoi.length > 0 && !dangLuuDH && (
              <button onClick={huyDongHo} className="text-xs font-medium text-muted rounded-xl px-3.5 py-2 ring-1 ring-line bg-surface hover:bg-subtle">Hủy — về bản đã lưu</button>
            )}
            {dongHoDoi.length > 0 && <span className="text-[11px] text-warning">Thay đổi CHƯA có hiệu lực cho tới khi bấm Lưu.</span>}
          </div>
        )}
        <p className="text-[11px] text-muted mt-3"><b>Ngoài khung giờ</b> bộ phận đó KHÔNG nhận email (cả nhắc định kỳ lẫn email tức thời); vé vẫn mở, web vẫn hiện, hệ vẫn tự đóng khi đủ 2 giờ sạch. Vào lại khung giờ, lượt kiểm 5′ đầu tiên gửi ngay các vé còn mở — không mất tin. Muốn một bộ phận nhận 24/7 (ví dụ Trực HSL) thì để chế độ <b>24/7</b>.</p>
        <p className="text-[11px] text-muted mt-1">Lưu ý: đồng hồ leo thang (IPC 20′ · Cơ điện chưa nhận việc 15′ · đang/chờ xử lý 1 giờ) vẫn chạy ngoài giờ — sáng vào khung giờ, vé tồn qua đêm sẽ hiện đã leo thang lên Trực.</p>
      </Card>

      <Card className="p-6"><SectionTitle icon={Cog} hint="địa chỉ gửi đi + nhận khi ở chế độ thử + fallback báo cáo">Địa chỉ hệ thống & fallback</SectionTitle>
        {tai ? <div className="h-24 rounded-2xl bg-subtle animate-pulse mt-4" /> : emailFields([...EMAIL_KEYS_HE_THONG, ...EMAIL_KEYS_BAO_CAO])}
        <p className="text-[11px] text-muted mt-3">Các key cảnh báo cũ (email_ipc, email_co_dien, email_qa, email_truc_hsl, email_it_gmp) trong Cài đặt chỉ còn là <b>dự phòng tầng 3</b> — hệ thống chỉ dùng khi danh bạ cảnh báo phía trên trống hoàn toàn.</p>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SectionTitle icon={FileBarChart} hint="ai nhận báo cáo quản trị tuần / tháng / quý (WF5)">Người nhận BÁO CÁO</SectionTitle>
          {canManage && <button onClick={() => setForm({ ho_ten: "", email: "", vai_tro: "", nhan_tuan: true, nhan_thang: true, nhan_quy: true, kich_hoat: true })} className="text-xs font-medium text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: "var(--danger-solid)" }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm người</button>}
        </div>
        {form && (
          <div className="rounded-2xl bg-info-soft/60 ring-1 ring-info-line p-4 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input value={form.ho_ten} onChange={(e) => setForm({ ...form, ho_ten: e.target.value })} placeholder="Họ tên" className="rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-sm" />
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-sm" />
            <input value={form.vai_tro || ""} onChange={(e) => setForm({ ...form, vai_tro: e.target.value })} placeholder="Vai trò (QA, Quản lý…)" className="rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-sm" />
            <div className="flex items-center gap-3 flex-wrap text-[12px] text-body">
              {[["nhan_tuan", "Tuần"], ["nhan_thang", "Tháng"], ["nhan_quy", "Quý"], ["kich_hoat", "Kích hoạt"]].map(([f, l]) => <label key={f} className="flex items-center gap-1.5"><input type="checkbox" checked={!!form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.checked })} />{l}</label>)}
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
              <button onClick={luuNN} className="text-xs font-medium text-white rounded-xl px-4 py-2 flex items-center gap-1.5" style={{ backgroundColor: "var(--primary-solid)" }}><Save className="w-3.5 h-3.5" strokeWidth={2} /> Lưu</button>
              <button onClick={() => setForm(null)} className="text-xs font-medium text-body rounded-xl px-4 py-2 ring-1 ring-line flex items-center gap-1.5"><X className="w-3.5 h-3.5" strokeWidth={2} /> Huỷ</button>
            </div>
          </div>
        )}
        {tai ? <div className="h-24 rounded-2xl bg-subtle animate-pulse mt-4" /> :
          <div className="overflow-x-auto mt-4"><table className="w-full text-[13px]"><thead><tr className="text-muted text-left text-[11px] uppercase tracking-wider">{["Họ tên", "Email", "Vai trò", "Tuần", "Tháng", "Quý", "C1", "C4", "Q2", "Hoạt động", ""].map((h, i) => <th key={i} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{nguoiNhan.length === 0 ? <tr><td colSpan={11} className="py-4 text-muted italic">Chưa có người nhận. Bấm “Thêm người”.</td></tr> : nguoiNhan.map((n) => (
              <tr key={n.id} className={`border-t border-line ${n.kich_hoat ? "" : "opacity-50"}`}>
                <td className="py-2.5 pr-4 font-semibold" style={{ color: "var(--text-strong)" }}>{n.ho_ten}</td>
                <td className="py-2.5 pr-4 text-body font-mono text-[12px]">{n.email}</td>
                <td className="py-2.5 pr-4 text-muted">{n.vai_tro || "—"}</td>
                {["nhan_tuan", "nhan_thang", "nhan_quy"].map((f) => <td key={f} className="py-2.5 pr-4"><button disabled={!canManage} onClick={() => toggleNN(n, f)} className={`w-6 h-6 rounded-lg flex items-center justify-center ${n[f] ? "bg-success-soft text-success" : "bg-subtle text-muted"} disabled:opacity-60`}>{n[f] ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                {DS_KHU.map((k) => <td key={k} className="py-2.5 pr-4"><button disabled={!canManage} onClick={() => toggleKhuNN(n, k)} className={`w-6 h-6 rounded-lg flex items-center justify-center ${(n.khu_vuc || []).includes(k) ? "bg-info-soft text-info" : "bg-subtle text-muted"} disabled:opacity-60`}>{(n.khu_vuc || []).includes(k) ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                <td className="py-2.5 pr-4"><button disabled={!canManage} onClick={() => toggleNN(n, "kich_hoat")} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${n.kich_hoat ? "bg-success-soft text-success" : "bg-subtle text-muted"} disabled:opacity-60`}>{n.kich_hoat ? "Bật" : "Tắt"}</button></td>
                <td className="py-2.5 pr-4">{canManage && <div className="flex gap-1.5"><button onClick={() => setForm({ ...n })} className="text-info hover:text-info"><Pencil className="w-4 h-4" strokeWidth={1.8} /></button><button onClick={() => xoaNN(n.id)} className="text-danger hover:text-danger"><Trash2 className="w-4 h-4" strokeWidth={1.8} /></button></div>}</td>
              </tr>))}</tbody></table></div>}
        <p className="text-[11px] text-muted mt-3">Tích 1 khu = nhận báo cáo riêng khu đó · tích ≥2 khu = nhận bản Tổng (áp dụng khi bật báo cáo theo khu). Chỉ người <b>Kích hoạt</b> mới nhận báo cáo; chưa kích hoạt ai thì WF5 gửi về địa chỉ fallback (mục Địa chỉ hệ thống · Fallback). Mỗi thao tác được ghi nhật ký cấu hình.</p>
      </Card>
    </div>
  );
}


/* ===== LUẬT TỰ PHÂN TUYẾN SỰ CỐ (tab Cài đặt) =====
   Bảng luật loại cảm biến × mức → sau X phút chờ, hệ thống tự chuyển sự cố sang
   Cơ điện (không đợi người bấm nút). Công tắc tổng bật/tắt. Chỉ QA/Quản trị sửa. */
function LuatPhanTuyenCard({ isLive, canManage, actor }) {
  const [bat, setBat] = React.useState(false);
  const [luat, setLuat] = React.useState([]);
  const [tai, setTai] = React.useState(true);
  const [luu, setLuu] = React.useState(false);
  const [note, setNote] = React.useState(null);
  const [moi, setMoi] = React.useState({ loai_cam_bien: "DP", muc_canh_bao: "CRITICAL", cho_it_nhat_phut: 15, ly_do_mau: "" });

  const nap = React.useCallback(async () => {
    if (!isLive) { setTai(false); return; }
    setTai(true);
    const r = await layLuatPhanTuyen();
    if (!r.error) { setBat(r.bat); setLuat(r.luat); }
    setTai(false);
  }, [isLive]);
  React.useEffect(() => { nap(); }, [nap]);

  const baoLoi = (r) => { setNote({ loi: true, msg: (r.error && (r.error.thong_bao || r.error.ma_loi)) || "Lỗi — thử lại." }); setTimeout(() => setNote(null), 4000); };
  const toggleTong = async () => {
    if (!canManage) return;
    const r = await datCongTacPhanTuyen(!bat, actor);
    if (r.error) return baoLoi(r);
    setBat(!bat); setNote({ loi: false, msg: r.data?.thong_bao || "Đã cập nhật." }); setTimeout(() => setNote(null), 4000);
  };
  const themLuat = async () => {
    if (!canManage) return; setLuu(true);
    const r = await luuLuatPhanTuyen(moi, actor); setLuu(false);
    if (r.error) return baoLoi(r);
    setMoi({ loai_cam_bien: "DP", muc_canh_bao: "CRITICAL", cho_it_nhat_phut: 15, ly_do_mau: "" });
    nap();
  };
  const doiKichHoat = async (l) => { if (!canManage) return; const r = await luuLuatPhanTuyen({ ...l, kich_hoat: !l.kich_hoat }, actor); if (r.error) return baoLoi(r); nap(); };
  const xoa = async (id) => { if (!canManage) return; const r = await xoaLuatPhanTuyen(id, actor); if (r.error) return baoLoi(r); nap(); };

  const SENSOR_VI = { DP: "Chênh áp (DP)", RH: "Độ ẩm (RH)", T: "Nhiệt độ (T)", "*": "Mọi loại" };
  const MUC_VI = { CRITICAL: "Nghiêm trọng", WARNING: "Cảnh báo", "*": "Mọi mức" };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <SectionTitle icon={GitBranch} hint="tự chuyển sự cố sang Cơ điện theo bản chất — không đợi bấm nút">Luật tự phân tuyến sự cố</SectionTitle>
        <button onClick={toggleTong} disabled={!canManage} title={canManage ? "" : "Cần quyền QA/Quản trị"}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-semibold ring-1 transition ${bat ? "bg-success-soft text-success ring-success-line" : "bg-subtle text-muted ring-line"} ${canManage ? "hover:ring-success-line" : "opacity-60 cursor-not-allowed"}`}>
          <Power className="w-3.5 h-3.5" strokeWidth={2} /> {bat ? "ĐANG BẬT" : "ĐANG TẮT"}
        </button>
      </div>
      <p className="text-[12px] text-muted mt-2">Khi <b>BẬT</b>: mỗi 15 phút hệ thống quét sự cố <b>chưa xử lý</b> (mở trong 48h) khớp luật bên dưới và đã chờ đủ số phút → tự chuyển sang <b>Cơ điện</b> (ghi nhật ký, IPC vẫn nhận bản digest). Bản chất kỹ thuật (vd chênh áp nghiêm trọng = nghi lỗi AHU) không còn nằm chờ khi IPC vắng.</p>
      {note && <p className={`mt-3 text-[12px] rounded-xl px-3 py-2 ring-1 ${note.loi ? "text-danger bg-danger-soft ring-danger-line" : "text-success bg-success-soft ring-success-line"}`}>{note.msg}</p>}

      {tai ? <div className="h-24 rounded-2xl bg-subtle animate-pulse mt-4" /> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[640px]">
            <thead><tr className="text-left text-muted text-[10px] uppercase tracking-wide">
              <th className="py-2 px-2">Loại cảm biến</th><th className="py-2 px-2">Mức</th><th className="py-2 px-2 text-right">Chờ trước (phút)</th><th className="py-2 px-2">Diễn giải</th><th className="py-2 px-2 text-center">Bật</th><th className="py-2 px-2"></th>
            </tr></thead>
            <tbody>
              {luat.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="py-2 px-2 font-semibold" style={{ color: "var(--text-strong)" }}>{SENSOR_VI[l.loai_cam_bien] || l.loai_cam_bien}</td>
                  <td className="py-2 px-2">{MUC_VI[l.muc_canh_bao] || l.muc_canh_bao}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{l.cho_it_nhat_phut}′</td>
                  <td className="py-2 px-2 text-muted text-[11px] max-w-[280px]">{l.ly_do_mau}</td>
                  <td className="py-2 px-2 text-center"><button onClick={() => doiKichHoat(l)} disabled={!canManage} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${l.kich_hoat ? "text-success bg-success-soft" : "text-muted bg-subtle"} ${canManage ? "" : "opacity-60"}`}>{l.kich_hoat ? "bật" : "tắt"}</button></td>
                  <td className="py-2 px-2 text-right">{canManage && <button onClick={() => xoa(l.id)} className="text-muted hover:text-danger p-1" title="Xoá luật"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} /></button>}</td>
                </tr>
              ))}
              {luat.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted text-[12px]">Chưa có luật nào.</td></tr>}
            </tbody>
          </table>

          {canManage && (
            <div className="mt-4 rounded-2xl bg-subtle ring-1 ring-line p-4">
              <p className="text-[11px] uppercase text-muted font-semibold mb-3">Thêm luật mới</p>
              <div className="flex items-end gap-3 flex-wrap">
                <label className="flex flex-col gap-1"><span className="text-[10px] text-muted font-medium">Loại cảm biến</span>
                  <select value={moi.loai_cam_bien} onChange={(e) => setMoi({ ...moi, loai_cam_bien: e.target.value })} className="rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[12px]">{["DP", "RH", "T", "*"].map((k) => <option key={k} value={k}>{SENSOR_VI[k]}</option>)}</select></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] text-muted font-medium">Mức</span>
                  <select value={moi.muc_canh_bao} onChange={(e) => setMoi({ ...moi, muc_canh_bao: e.target.value })} className="rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[12px]">{["CRITICAL", "WARNING", "*"].map((k) => <option key={k} value={k}>{MUC_VI[k]}</option>)}</select></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] text-muted font-medium">Chờ trước (phút)</span>
                  <input type="number" min="0" max="1440" value={moi.cho_it_nhat_phut} onChange={(e) => setMoi({ ...moi, cho_it_nhat_phut: Number(e.target.value) })} className="w-24 rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[12px]" /></label>
                <label className="flex flex-col gap-1 flex-1 min-w-[180px]"><span className="text-[10px] text-muted font-medium">Diễn giải (tuỳ chọn)</span>
                  <input value={moi.ly_do_mau} onChange={(e) => setMoi({ ...moi, ly_do_mau: e.target.value })} placeholder="vd: chênh áp nghiêm trọng — nghi lỗi AHU" className="rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[12px]" /></label>
                <button onClick={themLuat} disabled={luu} className={`flex items-center gap-1.5 text-[12px] font-medium text-white rounded-xl px-4 py-2 ${luu ? "opacity-60" : ""}`} style={{ backgroundColor: "var(--primary-solid)" }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm</button>
              </div>
            </div>
          )}
        </div>
      )}
      {!canManage && <p className="text-[11px] text-warning mt-3">Cần quyền QA/Quản trị để chỉnh luật.</p>}
      <p className="text-[10.5px] text-muted mt-3">Tuyến hiện hỗ trợ: sự cố → <b>Cơ điện</b> (qua đúng máy trạng thái duyệt sự cố, có nhật ký người thao tác “hệ thống”). Sự cố hạ tầng cảm biến (đứng hình, mất FMS) đã có nhánh cảnh báo Cơ điện riêng.</p>
    </Card>
  );
}


export { CauHinhNguoiNhan as default, CauHinhNguoiNhan, LuatPhanTuyenCard, ChonAhu };
