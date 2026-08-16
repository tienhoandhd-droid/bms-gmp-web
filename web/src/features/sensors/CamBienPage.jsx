// CamBienPage.jsx — tab Cảm biến + thẻ đứng hình + drawer cụm (tách move-only từ App.jsx 17/08/2026).
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Gauge, RefreshCw } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { COLOR } from "../../lib/designTokens";
import { docTenVaiTro } from "../../lib/phanQuyen";
import { layCamBienDungHinh } from "../../lib/supabaseData";
import { SENSOR_META } from "../../lib/uiConst";
const O_TEXTAREA = "w-full mt-1 rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[13px] text-body focus:outline-none focus:ring-2 focus:ring-success-line";
function TheDungHinhTongQuan({ isLive, khuChoPhep, onXemChiTiet }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!isLive) return;
    let huy = false;
    layCamBienDungHinh().then((kq) => { if (!huy) setRows(kq.error ? [] : kq.rows); });
    return () => { huy = true; };
  }, [isLive]);
  const ds = (rows || []).filter((r) => (!khuChoPhep || khuChoPhep.includes(r.khu_vuc)) && (r.so_gio_dung ?? 99) >= 3);
  if (!isLive || ds.length === 0) return null;
  // tu_dau_lich_su = chưa từng thấy cảm biến sống trong dữ liệu còn lưu ⇒ "≥", không phải "="
  const fmtGio = (h, tuDau) => (h == null ? "—" : `${tuDau ? "≥ " : ""}${h >= 48 ? `${Math.round(h / 24)} ngày` : `${h} giờ`}`);
  return (
    <Card className="p-5" style={{ background: "var(--warning-soft)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <SectionTitle icon={Gauge} hint="theo dõi riêng · không tính vào chấm điểm">Cảm biến đứng hình — {ds.length} điểm đo</SectionTitle>
          <p className="mt-1.5 text-[12px] text-muted leading-relaxed max-w-3xl">
            Các phòng dưới đây có cảm biến <b>mất tín hiệu (giá trị không đổi ≥ 3 giờ)</b> nên được tách riêng,
            <b> tương đương phòng thiếu dữ liệu</b>: không chấm mức, không mở sự cố, không vào báo cáo chung — chờ Cơ điện khôi phục đầu đo.
          </p>
        </div>
        {onXemChiTiet && <button onClick={onXemChiTiet} className="shrink-0 flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-[12px] font-semibold text-warning ring-1 ring-warning-line hover:bg-warning-soft">Xem chi tiết → tab Cảm biến</button>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ds.map((r) => (
          <span key={`${r.ma_phong}-${r.loai_cam_bien}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 ${r.so_gio_dung >= 168 ? "text-danger bg-danger-soft ring-danger-line" : "text-warning bg-warning-soft ring-warning-line"}`}>
            <b>{r.ma_phong}</b> · {r.loai_cam_bien} · đứng {fmtGio(r.so_gio_dung, r.tu_dau_lich_su)} (kẹt {r.gia_tri_dung})
          </span>
        ))}
      </div>
    </Card>
  );
}


function ModalKetLuanCum({ cum, dangChay, onDong, onLuu }) {
  const [nguyenNhan, setNguyenNhan] = useState(cum.nguyen_nhan_goc || "");
  const [khacPhuc, setKhacPhuc] = useState(cum.hanh_dong_khac_phuc || "");
  const [phongNgua, setPhongNgua] = useState(cum.hanh_dong_phong_ngua || "");
  const [ketLuan, setKetLuan] = useState(cum.qa_ket_luan || "");
  const thieu = nguyenNhan.trim().length < 10 || khacPhuc.trim().length < 10;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onDong}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-surface shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-strong)" }}>Kết luận điều tra · {cum.ma_hien_thi}</h3>
        <p className="mt-1 text-[12px] text-muted leading-relaxed">{cum.ahu || "—"} · {cum.loai_cam_bien} · {cum.su_co_dang_mo} sự cố đang mở. Kết luận ghi vào cụm và <b>một dòng audit cho từng sự cố</b> thuộc cụm — không hồ sơ nào mất dấu vết.</p>
        <label className="block mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">Nguyên nhân gốc <span className="text-danger">*</span></label>
        <textarea className={O_TEXTAREA} rows={2} value={nguyenNhan} onChange={(e) => setNguyenNhan(e.target.value)} placeholder="Vì sao xảy ra? (ít nhất 10 ký tự)" />
        <label className="block mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Hành động khắc phục <span className="text-danger">*</span></label>
        <textarea className={O_TEXTAREA} rows={2} value={khacPhuc} onChange={(e) => setKhacPhuc(e.target.value)} placeholder="Đã/sẽ làm gì để hết lệch? (ít nhất 10 ký tự)" />
        <label className="block mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Hành động phòng ngừa</label>
        <textarea className={O_TEXTAREA} rows={2} value={phongNgua} onChange={(e) => setPhongNgua(e.target.value)} placeholder="Làm gì để không tái diễn? (bỏ trống được)" />
        <label className="block mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Kết luận QA về ảnh hưởng chất lượng</label>
        <textarea className={O_TEXTAREA} rows={2} value={ketLuan} onChange={(e) => setKetLuan(e.target.value)} placeholder="Có/không ảnh hưởng lô sản xuất, căn cứ… (bỏ trống được)" />
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onDong} className="rounded-xl bg-surface px-4 py-2 text-[13px] font-medium text-body ring-1 ring-line hover:bg-subtle">Huỷ</button>
          <button disabled={thieu || dangChay} onClick={() => onLuu({ nguyenNhan, khacPhuc, phongNgua, ketLuan })}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: "var(--primary-solid)" }}>{dangChay ? "Đang ghi…" : "Ghi kết luận"}</button>
        </div>
        {thieu && <p className="mt-2 text-right text-[11px] text-muted">Nguyên nhân gốc và khắc phục cần ≥ 10 ký tự.</p>}
      </div>
    </div>, document.body);
}


// ═══ TAB CẢM BIẾN — theo dõi cảm biến ĐỨNG HÌNH (im lặng/chết) ═══
// Nguồn: view xem_cam_bien_dung_hinh (cờ của WF1: giá trị không đổi ≥3 giờ liên
// tiếp). Tải KHI MỞ TAB (view quét lùi lịch sử tìm mốc giá trị đổi ~0,3–0,8s)
// + nút Làm mới. Sự cố của các cảm biến này đã bị tách khỏi chấm điểm (SUPPRESSED)
// nên tab này là nơi DUY NHẤT nhìn thấy chúng một cách tập trung.
function CamBienPage({ isLive }) {
  const [rows, setRows] = useState(null);   // null = đang tải
  const [loi, setLoi] = useState(null);
  const [luc, setLuc] = useState(null);
  const taiVe = useCallback(async () => {
    setRows(null); setLoi(null);
    const kq = await layCamBienDungHinh();
    if (kq.error) { setLoi(kq.error); setRows([]); return; }
    setRows(kq.rows); setLuc(new Date());
  }, []);
  useEffect(() => { if (isLive) taiVe(); }, [isLive, taiVe]);
  // 27/07: cờ tu_dau_lich_su = cảm biến chưa từng cho một giờ "còn sống" nào trong dữ liệu
  // còn lưu ⇒ chỉ khẳng định được "đứng TỪ TRƯỚC mốc đầu dữ liệu", không khẳng định đúng bằng.
  const fmtGio = (h, tuDau) => (h == null ? "—" : `${tuDau ? "≥ " : ""}${h >= 48 ? `${Math.round(h / 24)} ngày` : `${h} giờ`}`);
  const fmtTu = (iso, tuDau) => (iso ? `${tuDau ? "trước " : ""}${new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}` : "—");
  const doDam = (h) => (h >= 168 ? "text-danger bg-danger-soft ring-danger-line" : h >= 24 ? "text-warning bg-warning-soft ring-warning-line" : "text-body bg-subtle ring-line");
  if (!isLive) return <Card className="p-6"><SectionTitle icon={Gauge}>Cảm biến đứng hình</SectionTitle><p className="mt-3 text-sm text-muted">Chế độ xem trước — chưa kết nối dữ liệu thật.</p></Card>;
  // 16/07 (user hỏi "sao ghi 1 giờ?"): cờ đứng-trong-giờ bật NGAY từ giờ đầu (60 điểm
  // y hệt), nhưng chỉ ≥3 giờ liên tiếp mới TÁCH khỏi chấm điểm. Tab tách 2 tầng cho khớp.
  const duNguong = (rows || []).filter((r) => (r.so_gio_dung ?? 99) >= 3);
  const nghi = (rows || []).filter((r) => (r.so_gio_dung ?? 99) < 3);
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <SectionTitle icon={Gauge}>Cảm biến đứng hình (im lặng)</SectionTitle>
          <p className="mt-1.5 text-[12px] text-muted leading-relaxed max-w-3xl">
            Bảng dưới là cảm biến <b>đứng hình ≥ 3 giờ liên tiếp</b> — thường do hỏng, mất kết nối
            hoặc treo tín hiệu tại FMS. Từ 13/07, phòng có cảm biến đứng hình được <b>tách riêng như phòng thiếu dữ liệu</b>:
            không chấm mức, <b>không mở sự cố</b> và không tính vào báo cáo chung. Danh sách này là nơi theo dõi duy nhất;
            việc cần làm là Cơ điện kiểm tra / thay thế đầu đo — cảm biến sống lại sẽ tự trở lại chấm điểm bình thường.
            <br /><span className="text-muted">Dấu <b>≥</b> nghĩa là cảm biến chưa từng cho một giờ đo &ldquo;còn sống&rdquo; nào trong toàn bộ dữ liệu còn lưu — thời gian đứng thật có thể dài hơn con số hiển thị.</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {luc && <span className="text-[11px] text-muted">Cập nhật {luc.toLocaleTimeString("vi-VN")}</span>}
          <button onClick={taiVe} className="flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-[12px] font-semibold text-success ring-1 ring-success-line hover:bg-success-soft">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Làm mới
          </button>
        </div>
      </div>
      {loi && <p className="mt-3 text-[12px] text-danger">Không tải được danh sách: {loi.thong_bao || loi.message || "lỗi kết nối"}. Bấm Làm mới để thử lại.</p>}
      {rows === null ? (
        <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-2xl bg-subtle animate-pulse" />)}</div>
      ) : duNguong.length === 0 && nghi.length === 0 && !loi ? (
        <div className="mt-4 rounded-2xl bg-success-soft ring-1 ring-success-line px-4 py-6 text-center">
          <p className="text-sm font-semibold text-success">Không có cảm biến nào đang đứng hình</p>
          <p className="mt-1 text-[12px] text-muted">Mọi cảm biến đều đang gửi giá trị thay đổi bình thường.</p>
        </div>
      ) : duNguong.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-[10.5px] uppercase tracking-wider text-muted border-b border-line">
              <th className="py-2 pr-4 font-semibold">Phòng</th>
              <th className="py-2 pr-4 font-semibold">Khu · AHU</th>
              <th className="py-2 pr-4 font-semibold">Cảm biến</th>
              <th className="py-2 pr-4 font-semibold">Giá trị đứng</th>
              <th className="py-2 pr-4 font-semibold">Đứng từ</th>
              <th className="py-2 font-semibold">Thời gian đứng</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {duNguong.map((r) => {
                const meta = SENSOR_META[r.loai_cam_bien] || {};
                return (
                  <tr key={`${r.ma_phong}-${r.loai_cam_bien}`} className="text-[13px]">
                    <td className="py-2.5 pr-4"><b style={{ color: "var(--text-strong)" }}>{r.ma_phong}</b>{r.ten_phong && <span className="text-muted text-[12px]"> — {r.ten_phong}</span>}</td>
                    <td className="py-2.5 pr-4 text-body">{r.khu_vuc} · {r.ahu || "—"}</td>
                    <td className="py-2.5 pr-4 text-body">{meta.label || r.loai_cam_bien}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-body">
                      {r.gia_tri_dung != null ? `${r.gia_tri_dung} ${meta.unit || ""}` : "—"}
                      {(r.gioi_han_duoi != null || r.gioi_han_tren != null) && <span className="text-[11px] text-muted"> (giới hạn {r.gioi_han_duoi ?? "—"}–{r.gioi_han_tren ?? "—"})</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-body tabular-nums">{fmtTu(r.dung_tu, r.tu_dau_lich_su)}</td>
                    <td className="py-2.5"><span className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ${doDam(r.so_gio_dung)}`}>{fmtGio(r.so_gio_dung, r.tu_dau_lich_su)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows !== null && nghi.length > 0 && (
        <div className="mt-5 rounded-2xl bg-subtle ring-1 ring-line px-4 py-3">
          <p className="text-[12px] font-semibold text-body">Nghi đứng hình — mới dưới 3 giờ ({nghi.length} điểm đo)</p>
          <p className="mt-0.5 text-[11px] text-muted leading-relaxed">Giá trị vừa lặp y hệt trong 1–2 giờ gần nhất. <b>Chưa đủ ngưỡng 3 giờ</b> nên vẫn chấm điểm và mở vé như thường; nếu tiếp tục đứng, đủ 3 giờ sẽ tự chuyển lên bảng trên và được tách khỏi cảnh báo.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {nghi.map((r) => (
              <span key={`${r.ma_phong}-${r.loai_cam_bien}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 text-body bg-surface ring-line">
                <b>{r.ma_phong}</b> · {r.loai_cam_bien} · {r.so_gio_dung} giờ (kẹt {r.gia_tri_dung})
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}


// Mở lại một hồ sơ đã đóng là THAY ĐỔI hồ sơ GMP — bảng luật bắt buộc lý do,
// modal chỉ phản chiếu luật đó chứ không tự đặt luật.
function ModalMoLai({ row, act, dangChay, onDong, onLuu }) {
  const [lyDo, setLyDo] = useState("");
  const thieu = lyDo.trim().length < 10;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onDong}>
      <div className="w-full max-w-md rounded-3xl bg-surface shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-strong)" }}>Mở lại {row.ma_hien_thi} · {row.phong}</h3>
        <p className="mt-1 text-[12px] text-muted leading-relaxed">{row.cam_bien_vi} · đã đóng {row.dong_luc ? new Date(row.dong_luc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"} ({row.nhan_trang_thai || row.trang_thai}). Sự cố sẽ quay lại danh sách đang mở và nhập vào cụm điều tra hiện hành.</p>
        <label className="block mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted">Lý do mở lại <span className="text-danger">*</span></label>
        <textarea className={O_TEXTAREA} rows={3} autoFocus value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vì sao hồ sơ này chưa thể khép? (ít nhất 10 ký tự — ghi vào audit)" />
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onDong} className="rounded-xl bg-surface px-4 py-2 text-[13px] font-medium text-body ring-1 ring-line hover:bg-subtle">Huỷ</button>
          <button disabled={thieu || dangChay} onClick={() => onLuu(lyDo.trim())}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={act?.style || {}}>{dangChay ? "Đang mở lại…" : (act?.label || "Mở lại sự cố")}</button>
        </div>
        {thieu && <p className="mt-2 text-right text-[11px] text-muted">Lý do cần ≥ 10 ký tự.</p>}
      </div>
    </div>, document.body);
}


// Ngăn kéo chi tiết cụm: hồ sơ CAPA + các sự cố con ĐANG MỞ (sự cố đã đóng của cụm
// nằm ở khung "Đóng gần đây" — ngăn kéo phục vụ cuộc điều tra đang diễn ra).
function CumDrawer({ cum, dsSuCo, onDong, coQuyenKetLuan, onKetLuan, onInHoSo }) {
  const hh = (cum.chan_doan || "").startsWith("THIẾT BỊ ĐO");
  const honHop = (cum.chan_doan || "").startsWith("HỖN HỢP");
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onDong} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-surface shadow-2xl">
        <div className="sticky top-0 bg-surface/95 backdrop-blur px-5 py-4 border-b border-line flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">Cụm điều tra</p>
            <h3 className="mt-0.5 text-[17px] font-semibold" style={{ color: "var(--text-strong)" }}>{cum.ma_hien_thi} — {cum.ahu || "Không rõ AHU"} · {cum.loai_cam_bien}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onInHoSo} title="Hồ sơ đầy đủ: CAPA + mọi sự cố thành viên + audit — in hoặc lưu PDF cho thanh tra" className="rounded-xl px-2.5 py-1 text-[13px] font-medium text-success ring-1 ring-success-line bg-success-soft hover:bg-success-soft">In hồ sơ</button>
            <button aria-label="Đóng" onClick={onDong} className="rounded-xl px-2.5 py-1 text-[13px] text-muted ring-1 ring-line hover:bg-subtle">Đóng</button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <span className={`inline-block rounded-lg px-2.5 py-1 text-[11px] leading-tight ${hh ? "text-body bg-subtle" : honHop ? "text-warning bg-warning-soft" : "text-danger bg-danger-soft"}`}>{docTenVaiTro(cum.chan_doan, cum.khu_vuc)}</span>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-xl bg-subtle px-3 py-2"><span className="text-muted block text-[10px] uppercase tracking-wider">Khu · mở</span><span className="font-semibold text-body tabular-nums">{cum.khu_vuc} · {Math.round(cum.gio_mo)} giờ</span></div>
            <div className="rounded-xl bg-subtle px-3 py-2"><span className="text-muted block text-[10px] uppercase tracking-wider">Sự cố mở</span><span className="font-semibold text-body tabular-nums">{cum.su_co_dang_mo}{cum.so_chua_tiep_nhan > 0 && <span className="text-danger font-medium"> · {cum.so_chua_tiep_nhan} chưa tiếp nhận</span>}</span></div>
          </div>
          <div className="rounded-2xl ring-1 ring-line p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Hồ sơ điều tra (CAPA)</p>
              {coQuyenKetLuan && <button onClick={onKetLuan} className="rounded-lg bg-surface px-2 py-1 text-[11px] font-medium text-body ring-1 ring-line hover:bg-subtle">{cum.da_co_ket_luan_qa ? "Sửa kết luận" : "Ghi kết luận"}</button>}
            </div>
            {cum.da_co_ket_luan_qa ? (
              <dl className="mt-2 space-y-2 text-[12px] leading-relaxed">
                <div><dt className="text-muted">Nguyên nhân gốc</dt><dd className="text-body">{cum.nguyen_nhan_goc}</dd></div>
                <div><dt className="text-muted">Khắc phục</dt><dd className="text-body">{cum.hanh_dong_khac_phuc}</dd></div>
                {cum.hanh_dong_phong_ngua && <div><dt className="text-muted">Phòng ngừa</dt><dd className="text-body">{cum.hanh_dong_phong_ngua}</dd></div>}
                {cum.qa_ket_luan && <div><dt className="text-muted">Kết luận QA</dt><dd className="text-body">{cum.qa_ket_luan}</dd></div>}
                <p className="text-[10px] text-muted">bởi {cum.qa_boi} · {cum.qa_luc ? new Date(cum.qa_luc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</p>
              </dl>
            ) : <p className="mt-2 text-[12px] text-muted italic">Chưa có kết luận QA.</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Sự cố đang mở trong cụm</p>
            <div className="mt-2 space-y-2">
              {dsSuCo.length === 0 && <p className="text-[12px] text-muted italic">Không còn sự cố mở (cụm sắp tự đóng).</p>}
              {dsSuCo.map((i) => (
                <div key={i.id} className="rounded-xl ring-1 ring-line px-3 py-2 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold" style={{ color: "var(--text-strong)" }}>{i.id} · {i.room}</span>
                    {i.mucCanhBao === "SUPPRESSED"
                      ? <span className="rounded-lg bg-subtle px-1.5 py-0.5 text-[10px] text-muted">cảm biến đứng hình</span>
                      : <span className="rounded-lg bg-danger-soft px-1.5 py-0.5 text-[10px] text-danger">{i.sensor}</span>}
                  </div>
                  <p className="mt-0.5 text-muted">{i.status} · kéo dài {i.duration} giờ{i.giaTriGanNhat != null && <> · TB 5′ cuối <b className="tabular-nums text-body">{i.giaTriGanNhat}{i.donVi}</b>{i.cuaSo5p && <span className="tabular-nums"> ({i.cuaSo5p}{i.ngay5p ? ` · ${i.ngay5p}` : ""})</span>}</>}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>, document.body);
}


export { TheDungHinhTongQuan, ModalKetLuanCum, ModalMoLai, CumDrawer };
export default CamBienPage;
