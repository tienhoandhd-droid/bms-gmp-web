// IncidentsParts.jsx — tiến trình phiếu, kiểm soát xử lý, đánh giá hiệu quả cảnh báo (tách move-only từ App.jsx 17/08/2026).
import React, { useState } from "react";
import { Check, Eye, FileText, ShieldAlert, ShieldCheck, User, X } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import Chart from "../../components/ui/Chart";
import { moTaLoi } from "../../lib/bmsClient";
import { COLOR } from "../../lib/designTokens";
import { fmtPhut } from "../../lib/dinhDang";
import { TEN_VAI_KHU, docTenVaiTro } from "../../lib/phanQuyen";
import { TRANG_THAI_CODE_TO_LABEL, layDanhGiaCanhBaoTuan, layDanhGiaHieuQuaCanhBao } from "../../lib/supabaseData";
// Thanh tiến trình 4 bước của MỘT phiếu (17/07 — user: "cần biết 1 sự cố thực sự
// đang ở đâu, tới bước nào rồi"). Bước xong = teal ✓, bước hiện tại = vàng
// (chờ điều kiện = đỏ), bước chưa tới = xám.
const BUOC_TT = {
  CHUA_XU_LY:               { b: 1, mo: 'đang chờ IPC ra hiện trường kiểm tra' },
  MO_LAI:                   { b: 1, mo: 'phiếu mở lại — IPC tiếp nhận lại từ đầu' },
  DA_BAO_CO_DIEN:           { b: 2, mo: 'đã bàn giao — chờ Cơ điện bấm "Đã nhận"' },
  CO_DIEN_DANG_XU_LY:       { b: 3, mo: 'Cơ điện đã nhận việc, đang sửa tại AHU' },
  CO_DIEN_CHO_XU_LY:        { b: 3, mo: 'Cơ điện gác lại chờ vật tư — phiếu vẫn mở, vẫn nhắc' },
  CO_DIEN_KHONG_XU_LY_DUOC: { b: 3, mo: 'Chờ điều kiện xử lý — Cơ điện chưa có vật tư, sẽ tự nhận lại (Trực + QA đã được báo)', tac: true },
};
const TEN_BUOC = ["IPC kiểm tra", "Cơ điện nhận", "Cơ điện xử lý", "Đóng phiếu"];
// ═══ KIỂM SOÁT XỬ LÝ (17/07 — yêu cầu Quản trị) ═══
// Phiếu đang ở bộ phận nào, im lặng bao lâu so với NGƯỠNG THEO TRẠNG THÁI
// (IPC 20′ · Cơ điện chưa nhận 15′ · đang/chờ xử lý 1h), ai quá thời hạn.
// Nguồn: view xem_su_co_phu_trach (server tính, web chỉ bày).
function BuocSuCo({ tt }) {
  const nd = BUOC_TT[tt] || { b: 1, mo: TRANG_THAI_CODE_TO_LABEL[tt] || tt };
  return (
    <div className="w-full">
      <div className="flex items-start gap-1.5">
        {TEN_BUOC.map((t, i) => {
          const idx = i + 1;
          const qua = idx < nd.b, hien = idx === nd.b;
          return (
            <div key={t} className="flex-1 min-w-0">
              <div className={`h-1.5 rounded-full ${qua ? "bg-success-solid" : hien ? (nd.tac ? "bg-danger-solid" : "bg-warning-solid") : "bg-subtle"}`} />
              <p className={`mt-1 text-[12px] leading-tight truncate ${hien ? (nd.tac ? "text-danger font-bold" : "text-warning font-bold") : qua ? "text-success font-medium" : "text-muted"}`}>{qua ? "✓ " : hien ? "● " : ""}{t}</p>
            </div>
          );
        })}
      </div>
      <p className={`mt-1 text-[12px] leading-snug ${nd.tac ? "text-danger font-medium" : "text-muted"}`}>➜ {nd.mo}</p>
    </div>
  );
}


const KiemSoatXuLy = React.memo(function KiemSoatXuLy({ rows }) {
  // Bấm ô bộ phận → xem danh sách phiếu của ĐÚNG bộ phận đó (17/07: user không muốn
  // một danh sách trộn lẫn). Bấm lại ô đang chọn để đóng.
  const [locVai, setLocVai] = useState(null);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const boPhan = [["IPC", "IPC", "text-info bg-info-soft ring-info-line", "ring-info"],
                  ["MEP", "Cơ điện", "text-warning bg-warning-soft ring-warning-line", "ring-warning"],
                  ["LOT", "Trực HSL", "text-danger bg-danger-soft ring-danger-line", "ring-danger-line"]];
  const chamTong = rows.filter((r) => r.dang_cham).length;
  const daBaoTruc = rows.filter((r) => r.da_bao_truc).length;
  const dsChon = locVai
    ? rows.filter((r) => r.vai_tro_phu_trach === locVai)
        .sort((a, b) => Number(!!b.dang_cham) - Number(!!a.dang_cham) || (b.phut_im_lang || 0) - (a.phut_im_lang || 0))
    : [];
  const tenChon = locVai ? (boPhan.find(([v]) => v === locVai) || [])[1] : "";
  return (
    <Card className="p-4 sm:p-5" style={{ background: "var(--bg-subtle)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={Eye} hint="bấm vào ô bộ phận để xem danh sách phiếu của bộ phận đó">Kiểm soát xử lý — phiếu ở đâu, ai quá thời hạn</SectionTitle>
        <span className="text-[12px] text-muted tabular-nums">{rows.length} phiếu mở · <b className={chamTong ? "text-danger" : "text-success"}>{chamTong} quá thời hạn</b> · {daBaoTruc} đã báo Trực</span>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {boPhan.map(([vai, ten, mau, vien]) => {
          const ds = rows.filter((r) => r.vai_tro_phu_trach === vai);
          const soCham = ds.filter((r) => r.dang_cham).length;
          const lauNhat = ds.reduce((mx, r) => Math.max(mx, r.phut_im_lang || 0), 0);
          const chon = locVai === vai;
          return (
            <button key={vai} type="button" aria-pressed={chon}
              onClick={() => setLocVai(chon ? null : vai)}
              className={`rounded-xl px-3.5 py-2.5 text-left transition ring-1 ${mau} ${chon ? `ring-2 ${vien} shadow-md` : "hover:ring-2 hover:shadow-sm"}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-[12px] font-bold">{ten}</span>
                <span className="text-[18px] font-bold tabular-nums">{ds.length}<span className="text-[12px] font-medium opacity-60"> phiếu</span></span>
              </div>
              <p className="text-[12px] mt-0.5 opacity-80">{ds.length === 0 ? "không giữ phiếu nào" : soCham > 0 ? <><b>{soCham} quá thời hạn</b> · im lặng lâu nhất {fmtPhut(lauNhat)}</> : "tất cả trong nhịp"}</p>
              <p className="text-[12px] mt-1 opacity-60">{chon ? "▲ đang xem — bấm để đóng" : "▼ bấm xem danh sách"}</p>
            </button>
          );
        })}
      </div>
      {locVai && (
        <div className="mt-3">
          <p className="text-[12px] font-semibold text-muted">Phiếu {tenChon} đang giữ ({dsChon.length}) — chậm xếp trên</p>
          {dsChon.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-muted">{tenChon} không giữ phiếu nào. 👍</p>
          ) : (
            <div className="mt-1.5 max-h-[52vh] overflow-y-auto overscroll-contain pr-1 space-y-1.5">
              {dsChon.map((r) => (
                <div key={r.ma_su_co} className={`rounded-xl px-3 py-2 ring-1 ${r.dang_cham ? "bg-surface/80 ring-danger-line" : "bg-surface/60 ring-line"}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
                    <b style={{ color: "var(--text-strong)" }}>SC-{String(r.ma_su_co).padStart(4, "0")}</b>
                    <span className="text-muted">{r.khu_vuc}</span>
                    {r.dang_cham
                      ? <span className="font-semibold text-danger">im lặng {fmtPhut(r.phut_im_lang)}{r.nguong_phut > 0 ? ` / ngưỡng ${fmtPhut(r.nguong_phut)}` : ""}</span>
                      : <span className="text-success">trong nhịp · {fmtPhut(r.phut_im_lang)}/{fmtPhut(r.nguong_phut)}</span>}
                    {r.da_bao_truc && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[12px] font-bold text-danger">đã lên Trực</span>}
                    {r.vang_hien_truong && <span className="rounded-full bg-subtle px-2 py-0.5 text-[12px] text-muted">báo vắng ({r.vang_boi || "?"})</span>}
                    <span className="ml-auto text-muted">mở {r.gio_mo}h · cuối: {r.nguoi_thao_tac_cuoi ? `${r.nguoi_thao_tac_cuoi === "system" ? "hệ thống" : r.nguoi_thao_tac_cuoi}${r.hanh_dong_cuoi ? ` (${docTenVaiTro(r.hanh_dong_cuoi)})` : ""}` : "chưa ai thao tác"}</span>
                  </div>
                  <div className="mt-1.5"><BuocSuCo tt={r.trang_thai_hien_tai} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-2.5 text-[12px] text-muted">"Chậm" = im lặng vượt ngưỡng leo thang của trạng thái hiện tại (IPC 20′ · Cơ điện chưa nhận việc 15′ · đang/chờ xử lý 1 giờ). Đồng hồ tính từ mốc gần nhất: thao tác cuối · lần nhận email · mở phiếu — nên phiếu "chậm" nghĩa là đã nhận nhắc mà vẫn im.</p>
    </Card>
  );
});


function ApprovalModal({ incident, action, user, onClose, onCommit }) {
  const [reason, setReason] = useState(""); const valid = reason.trim().length >= 6 && action && user;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-surface ring-1 ring-line overflow-hidden" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ background: "var(--bg-subtle)" }}><div className="flex items-center gap-3"><div className="rounded-2xl bg-surface p-2.5 ring-1 ring-success-line shadow-sm"><ShieldCheck className="w-5 h-5" style={{ color: "var(--primary)" }} strokeWidth={1.8} /></div><div><h2 className="text-base font-semibold" style={{ color: "var(--text-strong)" }}>{action ? action.label : "Xem sự cố"}</h2><p className="text-[12px] text-muted">Ghi nhận bằng tài khoản đăng nhập · ALCOA+</p></div></div><button onClick={onClose} className="rounded-full p-1.5 hover:bg-subtle text-muted"><X className="w-4 h-4" strokeWidth={1.8} /></button></div>
        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-xs">{[["Mã sự cố", incident.id], ["Phòng", incident.room], ["Chỉ tiêu", incident.sensor]].map(([k, v]) => <div key={k}><p className="text-muted text-[12px] uppercase tracking-wider font-semibold">{k}</p><p className="mt-1 font-semibold" style={{ color: "var(--text-strong)" }}>{v}</p></div>)}</div>
          <div className="rounded-2xl bg-success-soft ring-1 ring-success-line px-4 py-3 flex items-center gap-2 text-[13px]"><User className="w-4 h-4 text-success" strokeWidth={1.8} /><span className="text-body">Người thực hiện:</span> <span className="font-semibold" style={{ color: "var(--text-strong)" }}>{user ? `${user.name} (${user.role})` : "chưa đăng nhập"}</span></div>
          <div className="rounded-2xl bg-subtle ring-1 ring-line/70 p-4"><p className="text-[12px] uppercase tracking-wider text-muted font-semibold mb-2 flex items-center gap-1.5"><FileText className="w-3 h-3" strokeWidth={1.8} /> Nhật ký truy vết</p><div className="space-y-2 max-h-32 overflow-y-auto pr-1">{incident.trail.map((e, i) => <div key={i} className="flex gap-3 text-xs"><span className="text-muted tabular-nums shrink-0">{e.t}</span><span className="text-muted">·</span><span className="text-body"><span className="font-semibold">{e.who}</span> — {e.act}</span></div>)}</div></div>
          <div><label className="text-[12px] font-semibold text-body mb-2 block">Lý do / kết quả <span className="text-danger">*</span></label><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ghi rõ lý do/kết quả (tối thiểu 6 ký tự)…" className="w-full rounded-2xl bg-subtle px-4 py-3 text-sm text-body outline-none ring-1 ring-line focus:ring-2 focus:ring-success-line resize-none placeholder:text-muted" /></div>
        </div>
        <div className="px-6 py-4 bg-subtle flex items-center justify-between gap-3"><span className="text-[12px] text-muted">{action ? <>Trạng thái tiếp → <span className="font-semibold text-body">{action.next}</span></> : <span className="text-muted">Bạn không có quyền thao tác bước này</span>}</span><div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-body hover:bg-subtle">{action ? "Hủy" : "Đóng"}</button>{action && <button disabled={!valid} onClick={() => onCommit(incident, action, reason)} className="px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 text-white disabled:bg-subtle disabled:text-muted" style={valid ? { backgroundColor: "var(--danger-solid)" } : {}}><Check className="w-4 h-4" strokeWidth={2} /> Xác nhận & lưu</button>}</div></div>
      </div>
    </div>
  );
}


/* ═══ ĐÁNH GIÁ HIỆU QUẢ CẢNH BÁO (03/08 — yêu cầu chủ hệ thống) ═══
   Ba câu hỏi, theo đúng thứ tự người đọc cần:
     1. Luật cảnh báo đang áp là gì, và nó BỎ SÓT bao nhiêu phòng?
     2. Phiếu đến tay từng bộ phận rồi có ai động vào không?
     3. Từng phòng đạt bao nhiêu % so với yêu cầu?
   Điểm thiết kế quan trọng: bảng KHÔNG chỉ liệt kê phòng trong phạm vi. Phòng bị
   loại vẫn hiện, kèm LÝ DO bị loại — vì chỗ nguy hiểm nhất không phải phòng hỏng
   mà có cảnh báo, mà là phòng hỏng nặng KHÔNG AI ĐƯỢC BÁO. */
// Phễu vòng đời phiếu (11/08) — trả lời câu "IPC kích 4 phiếu, 2 phiếu chuyển Cơ điện,
// còn 2 phiếu kia đi đâu?". Một con số % không nói được điều đó: phiếu có thể được IPC
// tự kết luận "bình thường", chỉ bị báo vắng, hoặc tự tan trước khi ai kịp đụng.
// Chặng 3-5 là nhánh CON của chặng 2, chặng 7-8 là nhánh con của chặng 3 — thụt
// vào để không đọc nhầm thành các nhóm rời nhau cộng lại bằng tổng.
function PhieuVongDoiVe({ chang, tuanMoc, soTuan, dmy }) {
  const [moKhu, setMoKhu] = React.useState(null);   // "C1|ipc_bao_cd" đang xổ mã phiếu
  // 11/08 (chủ hệ thống): lọc theo TUẦN. null = cả kỳ (server trả sẵn dòng tuan=null),
  // nên đổi tuần KHÔNG gọi lại mạng — chỉ lọc trên mảng đã có.
  const [tuan, setTuan] = React.useState(null);
  const moc = Array.isArray(tuanMoc) ? tuanMoc : [];
  const dsTuan = moc.length ? moc.map((m) => m.tuan)
                            : [...new Set(chang.map((c) => c.tuan).filter((t) => t != null))].sort((a, b) => a - b);
  React.useEffect(() => { setTuan(null); setMoKhu(null); }, [soTuan]);  // đổi kỳ ⇒ về cả kỳ
  const loc = chang.filter((c) => (c.tuan ?? null) === tuan);
  const dsKhu = [...new Set(chang.map((c) => c.khu_vuc))].sort();
  const nhanTuan = (t) => {
    const m = moc.find((x) => x.tuan === t);
    return m ? `Tuần ${t} · ${dmy(m.tu)}–${dmy(m.den)}` : `Tuần ${t}`;
  };
  const chipTuan = (v, label) => (
    <button key={String(v)} onClick={() => { setTuan(v); setMoKhu(null); }}
      className={`px-2.5 py-1 rounded-full text-[12px] font-medium ring-1 transition ${tuan === v ? "text-white ring-transparent" : "text-body bg-surface ring-line hover:ring-success-line"}`}
      style={tuan === v ? { backgroundColor: "var(--anchor)" } : {}}>{label}</button>
  );
  const CON = { ipc_bao_cd: 1, ipc_ket_luan: 1, ipc_chi_vang: 1, mep_nhan: 2, mep_xong: 2 };
  const MAU = {
    ipc_bao_cd: COLOR.navy, ipc_ket_luan: COLOR.teal, ipc_chi_vang: COLOR.sand,
    ipc_khong_dung: COLOR.softCoral, mep_nhan: COLOR.sky, mep_xong: COLOR.teal,
    he_tu_dong: COLOR.softCoral, con_mo: COLOR.sand,
  };
  return (
    <div className="mt-4">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Phiếu đi đâu — phễu vòng đời</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {chipTuan(null, "Cả kỳ")}
        {dsTuan.map((t) => chipTuan(t, nhanTuan(t)))}
        <span className="ml-1 text-[12px] text-muted">phiếu xếp theo tuần MỞ VÉ</span>
      </div>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        {dsKhu.map((k) => {
          const ds = loc.filter((c) => c.khu_vuc === k).sort((a, b) => a.thu_tu - b.thu_tu);
          // Không có dòng nào = tuần đó khu này KHÔNG có phiếu. Khác hẳn "có phiếu mà mọi
          // chặng bằng 0" — nên phải nói rõ, đừng vẽ phễu rỗng gây hiểu nhầm.
          if (ds.length === 0) return (
            <div key={k} className="rounded-xl bg-subtle p-3 ring-1 ring-line">
              <p className="text-[12.5px] font-bold" style={{ color: "var(--text-strong)" }}>Khu {k}</p>
              <p className="mt-1 text-[12px] text-muted">Không có phiếu nào {tuan == null ? "trong kỳ" : `trong tuần ${tuan}`}.</p>
            </div>
          );
          const tong = ds.find((c) => c.ma === "mo")?.so_ve || 0;
          return (
            <div key={k} className="rounded-xl bg-surface p-3 ring-1 ring-line">
              <p className="text-[12.5px] font-bold" style={{ color: "var(--text-strong)" }}>
                Khu {k} · {tong} phiếu {tuan == null ? "trong kỳ" : nhanTuan(tuan).toLowerCase()}
              </p>
              <div className="mt-2 space-y-1">
                {ds.map((c) => {
                  const muc = CON[c.ma] || 0;
                  const rong = tong > 0 ? Math.max(c.so_ve > 0 ? 2 : 0, (c.so_ve / tong) * 100) : 0;
                  const khoa = k + "|" + c.ma;
                  const co = Array.isArray(c.ma_ve) && c.ma_ve.length > 0;
                  return (
                    <div key={c.ma} style={{ paddingLeft: muc * 14 }}>
                      <button
                        onClick={() => co && setMoKhu(moKhu === khoa ? null : khoa)}
                        title={c.giai_thich}
                        className={`w-full text-left rounded-md px-1.5 py-1 ${co ? "hover:bg-subtle cursor-pointer" : "cursor-default"}`}>
                        <span className="flex items-baseline gap-2">
                          <span className={`text-[12px] ${muc ? "text-body" : "font-semibold text-body"}`}>{c.nhan}</span>
                          <span className="ml-auto tabular-nums text-[12.5px] font-bold text-strong">{c.so_ve}</span>
                          <span className="tabular-nums text-[12px] text-muted w-10 text-right">
                            {tong > 0 ? `${Math.round((c.so_ve / tong) * 100)}%` : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 block h-1.5 rounded-full bg-subtle">
                          <span className="block h-1.5 rounded-full" style={{ width: `${rong}%`, backgroundColor: MAU[c.ma] || COLOR.ink }} />
                        </span>
                      </button>
                      {moKhu === khoa && co && (
                        <p className="mt-0.5 mb-1 rounded-md bg-subtle px-2 py-1 text-[12px] leading-snug text-muted ring-1 ring-line">
                          <b className="text-body">Mã phiếu:</b> {c.ma_ve.join(", ")}
                          {c.ma_ve.length >= 50 && <span className="text-muted"> … (chỉ liệt kê 50 phiếu đầu)</span>}
                          <br /><span className="text-muted">{c.giai_thich}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[12px] text-muted leading-snug">
        Các dòng <b>thụt vào</b> là nhánh con: "chuyển Cơ điện" / "IPC tự kết luận" / "chỉ báo vắng" nằm trong
        "IPC/QC có động vào"; "Cơ điện bấm…" nằm trong "chuyển Cơ điện". Nên đừng cộng dồn tất cả các dòng.
        Một phiếu có thể vào nhiều nhánh (vừa báo vắng vừa chuyển Cơ điện), và <b>hệ thống tự đóng</b> chồng lên mọi nhánh —
        chênh áp về dải thì phiếu đóng bất kể ai đang giữ. Bấm vào một chặng để xem mã phiếu.
      </p>
    </div>
  );
}


function DanhGiaHieuQuaCanhBao({ isLive }) {
  const [soTuan, setSoTuan] = React.useState(3);
  const [bc, setBc] = React.useState(null);      // luật + bộ phận + phòng ngoài phạm vi
  const [tuanBc, setTuanBc] = React.useState(null); // bổ theo tuần, chia theo khu
  const [dangTai, setDangTai] = React.useState(false);
  const [loi, setLoi] = React.useState(null);
  const [xemHet, setXemHet] = React.useState(false);
  React.useEffect(() => {
    if (!isLive) return;
    let huy = false;
    setDangTai(true); setLoi(null);
    Promise.all([layDanhGiaHieuQuaCanhBao(soTuan * 7), layDanhGiaCanhBaoTuan(soTuan)])
      .then(([a, b]) => {
        if (huy) return;
        setDangTai(false);
        if (a.error || b.error) { setLoi(moTaLoi(a.error || b.error)); setBc(null); setTuanBc(null); }
        else { setBc(a.bc); setTuanBc(b.bc); }
      });
    return () => { huy = true; };
  }, [isLive, soTuan]);

  if (!isLive) return null;
  // Thước đo nay là % KHÔNG ĐẠT — càng cao càng xấu (ngược với "% đạt" bản đầu).
  const mauKhongDat = (p) => p == null ? "text-muted"
    : p >= 50 ? "text-danger font-bold" : p >= 25 ? "text-danger font-semibold"
    : p >= 10 ? "text-warning font-semibold" : p > 0 ? "text-success" : "text-success font-semibold";
  const ROLE = { IPC: "IPC / QC", MEP: "Cơ điện", LOT: "Trực HSL", QA: "QA" };
  // 10/08: IPC tách theo khu (C1 · Q2) — phiếu thuộc phòng, phòng thuộc khu, nên gộp
  // chung một số % là chấm điểm đội này bằng phiếu của đội kia. Khu Q2 hiển thị "QC"
  // theo quy ước TEN_VAI_KHU. MEP/Trực/QA phụ trách chéo khu nên vẫn một dòng.
  const khoaBoPhan = (b) => b.vai_tro + (b.khu_vuc ? "·" + b.khu_vuc : "");
  const nhanBoPhan = (b) => b.khu_vuc
    ? `${(TEN_VAI_KHU[b.khu_vuc] || {})[b.vai_tro] || b.vai_tro} · khu ${b.khu_vuc}`
    : (ROLE[b.vai_tro] || b.vai_tro);
  const THU_TU_VAI = { IPC: 0, MEP: 1, LOT: 2, QA: 3 };
  const sapBoPhan = (ds) => [...ds].sort((a, b2) =>
    (THU_TU_VAI[a.vai_tro] ?? 9) - (THU_TU_VAI[b2.vai_tro] ?? 9)
    || String(a.khu_vuc || "").localeCompare(String(b2.khu_vuc || "")));
  // 'YYYY-MM-DD' → 'dd/mm' — người đọc xem theo lịch nhà máy, không bắt họ dịch ISO.
  const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
  // 11/08: thước đo chính chuyển sang tỉ lệ trên VÉ CÓ BÁO. Fallback về số cũ để
  // web bản mới vẫn đọc được RPC bản cũ (và ngược lại) trong lúc deploy lệch nhau.
  const coBao = (o) => (o && o.ty_le_phan_hoi_co_bao !== undefined ? o.ty_le_phan_hoi_co_bao : null);
  const mauSo = (o) => (o && o.ve_co_bao != null ? o.ve_co_bao : o?.ve_can_xu_ly);
  const tuSo = (o) => (o && o.ve_co_bao != null ? o.ve_da_thao_tac_co_bao : o?.ve_da_thao_tac);
  const pct = (o) => (coBao(o) != null ? coBao(o) : o?.ty_le_phan_hoi);
  // Khung giờ cảnh báo, viết gọn cho chú thích. Các vai đang dùng chung một khung
  // nên gộp một dòng; nếu sau này lệch nhau thì liệt kê từng vai.
  const THU_VI = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7", 7: "CN" };
  const khungGio = (() => {
    const ds = (Array.isArray(bc?.khung_gio) ? bc.khung_gio : []).filter((k) => k.kich_hoat);
    if (!ds.length) return null;
    const k = ds[0];
    return `${k.gio_tu}–${k.gio_den}, ${(k.ngay || []).map((n) => THU_VI[n] || n).join("/")}`;
  })();
  const chip = (v, label) => (
    <button key={v} onClick={() => setSoTuan(v)}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium ring-1 transition ${soTuan === v ? "text-white ring-transparent" : "text-body bg-surface ring-line hover:ring-success-line"}`}
      style={soTuan === v ? { backgroundColor: "var(--primary-solid)" } : {}}>{label}</button>
  );

  const luat = bc?.luat, tk = bc?.tong_ket;
  const tuan = Array.isArray(tuanBc?.tuan) ? tuanBc.tuan : [];
  const khu = Array.isArray(tuanBc?.khu) ? tuanBc.khu : [];
  const ngoaiPv = (Array.isArray(bc?.phong) ? bc.phong : []).filter((r) => !r.trong_pham_vi);
  const muP1P2 = ngoaiPv.filter((r) => r.pct_dat != null && r.pct_dat < 90 && (r.muc_uu_tien === "P1" || r.muc_uu_tien === "P2"));
  const oTuan = (r, t) => (r.tuan || []).find((w) => w.tuan === t);
  const DU = 84;   // nửa tuần — dưới mức này không đủ tin cậy để so sánh
  // Xu hướng = tuần CUỐI so tuần ĐẦU, và chỉ tính khi cả hai đầu mút đủ dữ liệu.
  // Suy xu hướng từ một tuần 4 giờ là bịa; thà trả "không đủ dữ liệu".
  const xuHuong = (r) => {
    const ds = (r.tuan || []).filter((w) => w.gio_co_dl >= DU).sort((x, y) => x.tuan - y.tuan);
    if (ds.length < 2) return { ma: "?", nhan: "không đủ dữ liệu", mau: "text-muted", delta: null };
    const d = Math.round((ds[ds.length - 1].pct_duoi_san - ds[0].pct_duoi_san) * 10) / 10;
    if (Math.abs(d) < 5) return { ma: "→", nhan: "đi ngang", mau: "text-muted", delta: d };
    return d > 0
      ? { ma: "▲", nhan: "xấu đi", mau: "text-danger font-semibold", delta: d }
      : { ma: "▼", nhan: "tốt lên", mau: "text-success font-semibold", delta: d };
  };

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle icon={ShieldAlert} hint="chỉ tính lệch phía DƯỚI SÀN — đúng hướng mà cảnh báo đang canh">
        Đánh giá hiệu quả cảnh báo
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[12px] font-semibold text-muted uppercase tracking-wider mr-1">Kỳ đánh giá</span>
        {chip(2, "2 tuần")}{chip(3, "3 tuần")}{chip(6, "6 tuần")}
        {tuan.length > 0 && (
          <span className="text-[12px] text-muted">
            từ <b className="text-body">{dmy(tuan[0]?.tu)}</b> đến <b className="text-body">{dmy(tuan[tuan.length - 1]?.den)}</b>
          </span>
        )}
        {dangTai && <span className="text-[12px] text-success">đang tính…</span>}
      </div>
      {loi && <p className="mt-3 text-[12.5px] text-danger">Không đọc được báo cáo: {loi}</p>}

      {bc && tuanBc && (<>
        <div className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-[12px] text-success ring-1 ring-success-line">
          <b>Thước đo:</b> % số giờ chênh áp <b>TỤT DƯỚI SÀN</b>. Đây đúng là hướng mà cảnh báo đang canh
          (<code>canh_bao_huong</code> DP = <b>DUOI</b>), nên cột % và cột số phiếu nói cùng một chuyện.
          Phần <b>vượt trần</b> để riêng ở cột cuối — không sinh phiếu nhưng vẫn là sai lệch.
        </div>

        {/* ── Luật cảnh báo ── */}
        <div className="mt-3 rounded-xl bg-subtle p-3.5 ring-1 ring-line">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Luật cảnh báo đang áp</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-body">
            <span>Khu: <b>{luat.khu_vuc || "—"}</b></span>
            <span>Mức ưu tiên: <b>{luat.muc_uu_tien || "—"}</b></span>
            <span>Loại cảm biến: <b>{luat.loai_cam_bien || "—"}</b></span>
            <span>Hướng vi phạm: <b>{luat.huong_dp === "DUOI" ? "chỉ khi DƯỚI sàn" : luat.huong_dp}</b></span>
          </div>
          <p className="mt-2.5 text-[13px] text-body">
            <b className="text-strong">{tuanBc.tong_ket.so_phong}</b> phòng trong danh sách sự cố, thuộc{" "}
            <b className="text-strong">{tuanBc.tong_ket.so_khu}</b> khu · trung bình{" "}
            <b className={mauKhongDat(tuanBc.tong_ket.pct_duoi_san_tb)}>{tuanBc.tong_ket.pct_duoi_san_tb}%</b> thời gian dưới sàn ·{" "}
            <b className="text-strong">{tuanBc.tong_ket.so_ve}</b> phiếu trong kỳ.
          </p>
        </div>

        {/* ── Tỉ lệ phản hồi ── */}
        <p className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-muted">Tỉ lệ phản hồi của các bộ phận</p>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {sapBoPhan(bc.bo_phan || []).map((b) => {
            // QA là vai GIÁM SÁT — không có hàng đợi nên không chấm %. Trước 11/08
            // thẻ này ra "0% — 0/94 phiếu", đọc như thể QA bỏ sót 94 lần.
            if (b.vai_giam_sat) return (
              <div key={khoaBoPhan(b)} className="rounded-xl bg-subtle p-3 ring-1 ring-line">
                <p className="text-[12px] font-semibold text-muted">{ROLE[b.vai_tro] || b.vai_tro} <span className="font-normal">· giám sát</span></p>
                <p className="text-[22px] font-bold tabular-nums leading-tight text-body">{b.ve_da_thao_tac}</p>
                <p className="text-[12px] text-muted leading-snug">phiếu đã can thiệp · {b.tong_thao_tac} thao tác</p>
                <p className="text-[12px] text-muted leading-snug">Không có hàng đợi — chỉ vào khi xác nhận khắc phục hoặc mở lại phiếu, nên không tính tỉ lệ.</p>
              </div>
            );
            const tCoBao = coBao(b);        // trên phiếu bộ phận thực sự được báo
            const tTong = b.ty_le_phan_hoi; // trên MỌI phiếu, kể cả phiếu ngoài giờ
            const t = tCoBao ?? tTong;
            const mau = t == null ? "text-muted" : t < 20 ? "text-danger" : t < 50 ? "text-warning" : "text-success";
            const boSot = b.ve_co_bao != null && b.ve_can_xu_ly != null ? b.ve_can_xu_ly - b.ve_co_bao : 0;
            return (
              <div key={khoaBoPhan(b)} className="rounded-xl bg-surface p-3 ring-1 ring-line">
                <p className="text-[12px] font-semibold text-muted">{nhanBoPhan(b)}</p>
                <p className={`text-[22px] font-bold tabular-nums leading-tight ${mau}`}>{t == null ? "—" : `${t}%`}</p>
                <p className="text-[12px] text-muted leading-snug">
                  động vào <b>{tCoBao != null ? b.ve_da_thao_tac_co_bao : b.ve_da_thao_tac}</b>/{tCoBao != null ? b.ve_co_bao : b.ve_can_xu_ly} phiếu
                  {tCoBao != null && <span className="text-muted"> có báo</span>} · {b.tong_thao_tac} thao tác
                </p>
                {boSot > 0 && (
                  <p className="text-[12px] text-muted leading-snug">
                    tính cả <b>{boSot}</b> phiếu ngoài khung giờ báo: <b>{tTong}%</b> ({b.ve_da_thao_tac}/{b.ve_can_xu_ly})
                  </p>
                )}
                <p className="text-[12px] text-muted">{b.gio_phan_hoi_tb == null ? "chưa có phản hồi nào" : `phản hồi sau TB ${b.gio_phan_hoi_tb} giờ`}</p>
                {b.gio_ipc_giu_tb != null && (
                  <p className="text-[12px] text-warning">IPC giữ TB <b>{b.gio_ipc_giu_tb} giờ</b> trước khi chuyển</p>
                )}
              </div>
            );
          })}
        </div>
        {khungGio && (
          <p className="mt-1.5 text-[12px] text-muted leading-snug">
            <b>"Phiếu có báo"</b> = phiếu còn đang mở trong khung giờ cảnh báo ({khungGio}) nên bộ phận mới có email để biết.
            Phiếu mở rồi tự tan gọn trong đêm/Chủ nhật không ai được báo — để trong mẫu số là chấm điểm người ta trên việc họ không thể biết.
            Số cũ (trên MỌI phiếu) vẫn để ở dòng dưới để truy vết.
            Riêng <b>Cơ điện</b> tính từ lúc phiếu được <b>chuyển sang</b>, không phải từ lúc mở phiếu.
          </p>
        )}

        {/* ── Phản hồi theo NGÀY (đường) ── */}
        {Array.isArray(bc.bo_phan_ngay) && bc.bo_phan_ngay.length > 0 && (() => {
          const dsNgay = [...new Set(bc.bo_phan_ngay.map((x) => x.ngay))].sort();
          const MAU = { "IPC·C1": COLOR.teal, "IPC·Q2": COLOR.navy, IPC: COLOR.teal, MEP: COLOR.softCoral, LOT: COLOR.sand, QA: COLOR.sky };
          const nhom = sapBoPhan(bc.bo_phan || []).filter((b) => !b.vai_giam_sat);
          const chuoi = nhom.map((b) => {
            const k = khoaBoPhan(b);
            const theoNgay = new Map(bc.bo_phan_ngay
              .filter((x) => x.vai_tro === b.vai_tro && (x.khu_vuc || null) === (b.khu_vuc || null))
              .map((x) => [x.ngay, x]));
            return {
              vai_tro: k, nhan: nhanBoPhan(b), mau: MAU[k] || COLOR.ink,
              diem: dsNgay.map((n) => {
                const o = theoNgay.get(n);
                return o ? { pct: pct(o), can: mauSo(o), da: tuSo(o) } : {};
              }),
            };
          });
          return (
            <div className="mt-3">
              <Chart type="phanHoiNgay" h={260} ngay={dsNgay.map((n) => n.slice(5))} series={chuoi} />
              <p className="mt-1.5 text-[12px] text-muted leading-snug">
                Mỗi điểm = lứa phiếu <b>mở trong ngày đó</b> mà bộ phận ấy <b>có được báo</b>, tính xem bao nhiêu % được động vào (bất kỳ lúc nào sau đó).
                Ngày <b>không có phiếu nào</b> để trống nên đường bị đứt — cố ý: "không có phiếu" khác hẳn "có phiếu mà không ai đụng".
                Cơ điện chỉ tính trên các phiếu đã được chuyển sang Cơ điện, và xếp theo <b>ngày được chuyển</b> chứ không phải ngày mở phiếu.
              </p>
            </div>
          );
        })()}

        {/* ── Bảng phản hồi theo TUẦN (có tiến bộ không) ── */}
        {Array.isArray(bc.bo_phan_tuan) && bc.bo_phan_tuan.length > 0 && (() => {
          const dsTuan = [...new Set(bc.bo_phan_tuan.map((x) => x.tuan))].sort((a2, b2) => a2 - b2);
          const mocTuan = (t) => (Array.isArray(bc.tuan_moc) ? bc.tuan_moc : []).find((m) => m.tuan === t);
          const nhom = sapBoPhan(bc.bo_phan || []).filter((b) => !b.vai_giam_sat);
          const lay = (b, t) => bc.bo_phan_tuan.find((x) => x.vai_tro === b.vai_tro && (x.khu_vuc || null) === (b.khu_vuc || null) && x.tuan === t);
          const mauPct = (t) => t == null ? "text-muted" : t < 20 ? "text-danger font-semibold" : t < 50 ? "text-warning font-semibold" : "text-success font-semibold";
          // Tiến bộ = tuần CÓ VÉ cuối cùng so tuần CÓ VÉ đầu tiên. Tuần không có phiếu
          // nào để bộ phận ấy xử lý thì không phải thành tích cũng không phải lỗi.
          // Từ 11/08 so trên cùng thước đo đang hiện trong ô: tỉ lệ trên VÉ CÓ BÁO.
          const tienBo = (b) => {
            const ds = dsTuan.map((t) => lay(b, t)).filter((o) => o && mauSo(o) > 0 && pct(o) != null);
            if (ds.length < 2) return { ma: "?", nhan: "chưa đủ tuần có phiếu", mau: "text-muted", d: null };
            const d = Math.round((pct(ds[ds.length - 1]) - pct(ds[0])) * 10) / 10;
            if (Math.abs(d) < 5) return { ma: "→", nhan: "đi ngang", mau: "text-muted", d };
            return d > 0 ? { ma: "▲", nhan: "tiến bộ", mau: "text-success font-semibold", d }
                         : { ma: "▼", nhan: "kém đi", mau: "text-danger font-semibold", d };
          };
          return (
            <div className="mt-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Tình trạng phản hồi từng tuần — có tiến bộ không</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-subtle text-muted">
                      <th className="border border-line px-2 py-1.5 text-left font-semibold">Bộ phận</th>
                      {dsTuan.map((t) => {
                        const m = mocTuan(t);
                        return (
                          <th key={t} className="border border-line px-2 py-1.5 text-center font-semibold">
                            Tuần {t}{m && <><br /><span className="font-normal text-[12px] text-muted">{dmy(m.tu)}–{dmy(m.den)}</span></>}
                          </th>
                        );
                      })}
                      <th className="border border-line px-2 py-1.5 text-center font-semibold bg-subtle">Tiến bộ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nhom.map((b) => {
                      const tb = tienBo(b);
                      return (
                        <tr key={khoaBoPhan(b)}>
                          <td className="border border-line px-2 py-1.5 font-semibold" style={{ color: "var(--text-strong)" }}>{nhanBoPhan(b)}</td>
                          {dsTuan.map((t) => {
                            const o = lay(b, t);
                            return (
                              <td key={t} className={`border border-line px-2 py-1.5 text-center tabular-nums ${mauPct(pct(o))}`}>
                                {!o || !o.ve_can_xu_ly
                                  ? <span className="text-muted text-[12px]">không có phiếu</span>
                                  : !mauSo(o)
                                  ? <span className="text-muted text-[12px]" title={`${o.ve_can_xu_ly} phiếu nhưng không phiếu nào rơi vào khung giờ báo`}>không phiếu nào được báo<br /><span className="text-[12px]">({o.ve_can_xu_ly} phiếu ngoài giờ)</span></span>
                                  : <>{pct(o)}%<br />
                                      <span className="text-[12px] font-normal text-muted">
                                        {tuSo(o)}/{mauSo(o)} phiếu{o.gio_phan_hoi_tb != null && ` · ${o.gio_phan_hoi_tb}h`}
                                        {o.ve_co_bao != null && o.ve_can_xu_ly > o.ve_co_bao && <><br />({o.ve_can_xu_ly - o.ve_co_bao} phiếu ngoài giờ không tính)</>}
                                      </span>
                                    </>}
                              </td>
                            );
                          })}
                          <td className={`border border-line px-2 py-1.5 text-center text-[12px] bg-subtle ${tb.mau}`}>
                            {tb.ma} {tb.nhan}
                            {tb.d != null && <span className="block text-[12px] font-normal tabular-nums">{tb.d > 0 ? "+" : ""}{tb.d} điểm %</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[12px] text-muted leading-snug">
                Số nhỏ = <b>phiếu đã động vào / phiếu có báo</b> và thời gian phản hồi trung bình; phiếu mở ngoài khung giờ cảnh báo
                được đếm riêng chứ không nằm trong mẫu số. Cột <b>Tiến bộ</b> so tuần có phiếu cuối với tuần có phiếu đầu; tuần
                <b> không có phiếu</b> nào để bộ phận ấy xử lý thì không tính là thành tích cũng không tính là lỗi.
                Lưu ý đọc: tỉ lệ tụt còn có thể vì <b>phiếu tự tan nhanh hơn</b> — xem tuổi thọ phiếu ở phễu bên dưới trước khi kết luận người kém đi.
              </p>
            </div>
          );
        })()}

        {/* ── Phễu vòng đời phiếu — "phiếu kia đi đâu" ── */}
        {Array.isArray(bc.phieu_vong_doi) && bc.phieu_vong_doi.length > 0 && (
          <PhieuVongDoiVe chang={bc.phieu_vong_doi} tuanMoc={bc.tuan_moc} soTuan={soTuan} dmy={dmy} />
        )}

        {/* ── Kết luận ── */}
        <div className="mt-4 rounded-xl bg-warning-soft p-3.5 ring-1 ring-warning-line">
          <p className="text-[12.5px] font-bold text-strong">Kết luận kỳ {soTuan} tuần (từ {dmy(tuan[0]?.tu)} đến {dmy(tuan[tuan.length - 1]?.den)})</p>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-body list-disc pl-4">
            <li><b>{tk.ve_mo_trong_ky}</b> phiếu mở, trong đó <b className={tk.ve_he_thong_dong / Math.max(1, tk.ve_mo_trong_ky) > 0.5 ? "text-danger" : ""}>{tk.ve_he_thong_dong}</b> phiếu <b>hệ thống tự đóng</b> — chênh áp tự về dải trước khi có người xử lý.</li>
            {(() => {
              const ds = khu.flatMap((k) => k.phong || []).map(xuHuong);
              const xau = ds.filter((x) => x.ma === "▲").length;
              const tot = ds.filter((x) => x.ma === "▼").length;
              const ngang = ds.filter((x) => x.ma === "→").length;
              const thieu = ds.filter((x) => x.ma === "?").length;
              return (
                <li>
                  Xu hướng qua {soTuan} tuần: <b className="text-success">{tot} phòng tốt lên</b> ·{" "}
                  <b className="text-danger">{xau} phòng xấu đi</b> · {ngang} đi ngang
                  {thieu > 0 && <> · {thieu} chưa đủ dữ liệu để kết luận</>}.
                </li>
              );
            })()}
            <li>Đã gửi <b>{tk.email_digest}</b> email cảnh báo trong kỳ.</li>
            {muP1P2.length > 0 && (
              <li className="text-danger">Ngoài danh sách: <b>{muP1P2.length}</b> phòng <b>P1/P2</b> đạt dưới 90% mà không được cảnh báo. Cân nhắc có nên đưa vào danh sách không.</li>
            )}
          </ul>
        </div>

        {/* ── Trung bình TOÀN KHU theo tuần ── */}
        {Array.isArray(tuanBc.toan_bo_tuan) && tuanBc.toan_bo_tuan.length > 0 && (() => {
          const hang = [
            ...khu.map((k) => ({ ten: `Khu ${k.khu_vuc}`, sl: k.tuan || [], dam: false })),
            { ten: "Toàn bộ", sl: tuanBc.toan_bo_tuan, dam: true },
          ];
          const tienBo = (sl) => {
            const ds = [...sl].sort((x, y) => x.tuan - y.tuan).filter((o) => o.pct_duoi_san_tb != null);
            if (ds.length < 2) return { ma: "?", nhan: "chưa đủ", mau: "text-muted", d: null };
            const d = Math.round((ds[ds.length - 1].pct_duoi_san_tb - ds[0].pct_duoi_san_tb) * 10) / 10;
            if (Math.abs(d) < 5) return { ma: "→", nhan: "đi ngang", mau: "text-muted", d };
            return d < 0 ? { ma: "▼", nhan: "tiến bộ", mau: "text-success font-semibold", d }
                         : { ma: "▲", nhan: "kém đi", mau: "text-danger font-semibold", d };
          };
          const o = (sl, t) => sl.find((x) => x.tuan === t);
          return (
            <div className="mt-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">Trung bình toàn khu theo tuần — có tiến bộ không</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-subtle text-muted">
                      <th className="border border-line px-2 py-1.5 text-left font-semibold" rowSpan={2}>Phạm vi</th>
                      {tuan.map((w) => (
                        <th key={w.tuan} className="border border-line px-2 py-1 text-center font-semibold" colSpan={2}>
                          Tuần {w.tuan}<br /><span className="font-normal text-[12px] text-muted">{dmy(w.tu)}–{dmy(w.den)}</span>
                        </th>
                      ))}
                      <th className="border border-line px-2 py-1.5 text-center font-semibold bg-subtle" rowSpan={2}>Tiến bộ<br /><span className="font-normal text-[12px]">(dưới sàn)</span></th>
                    </tr>
                    <tr className="bg-subtle text-muted text-[12px]">
                      {tuan.map((w) => (
                        <React.Fragment key={w.tuan}>
                          <th className="border border-line px-1.5 py-1 text-center font-semibold">dưới sàn</th>
                          <th className="border border-line px-1.5 py-1 text-center font-normal">vượt trần</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hang.map((h) => {
                      const tb = tienBo(h.sl);
                      return (
                        <tr key={h.ten} className={h.dam ? "bg-subtle font-semibold" : ""}>
                          <td className="border border-line px-2 py-1.5" style={{ color: "var(--text-strong)" }}>{h.ten}</td>
                          {tuan.map((w) => {
                            const x = o(h.sl, w.tuan);
                            return (
                              <React.Fragment key={w.tuan}>
                                <td className={`border border-line px-1.5 py-1.5 text-center tabular-nums ${mauKhongDat(x?.pct_duoi_san_tb)}`}>
                                  {x == null ? "—" : `${x.pct_duoi_san_tb}%`}
                                </td>
                                <td className="border border-line px-1.5 py-1.5 text-center tabular-nums text-muted">
                                  {x == null ? "—" : `${x.pct_tren_tran_tb}%`}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className={`border border-line px-2 py-1.5 text-center text-[12px] bg-subtle ${tb.mau}`}>
                            {tb.ma} {tb.nhan}
                            {tb.d != null && <span className="block text-[12px] font-normal tabular-nums">{tb.d > 0 ? "+" : ""}{tb.d} điểm %</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[12px] text-muted leading-snug">
                Trung bình <b>cân theo số giờ</b>, không phải trung bình cộng các phòng — phòng ít dữ liệu tự động
                ảnh hưởng ít, đúng với mức bằng chứng nó mang lại. Cột <b>vượt trần</b> để cạnh có chủ đích:
                chênh áp rời khỏi sàn có thể là do <b>đã về dải</b>, mà cũng có thể là do <b>bị đẩy quá lên trên</b> —
                nhìn một cột dễ mừng nhầm.
              </p>
            </div>
          );
        })()}

        {/* ── Bảng theo KHU → PHÒNG → TUẦN ── */}
        {khu.map((k) => (
          <div key={k.khu_vuc} className="mt-4">
            <p className="text-[12.5px] font-bold" style={{ color: "var(--text-strong)" }}>
              Khu {k.khu_vuc}
              <span className="ml-2 font-normal text-muted">{k.so_phong} phòng · trung bình <b className={mauKhongDat(k.pct_duoi_san_tb)}>{k.pct_duoi_san_tb}%</b> dưới sàn</span>
            </p>
            <div className="mt-1.5 overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-subtle text-muted">
                    <th className="border border-line px-2 py-1.5 text-left font-semibold">Phòng</th>
                    <th className="border border-line px-2 py-1.5 text-center font-semibold">Ưu tiên</th>
                    <th className="border border-line px-2 py-1.5 text-center font-semibold">Yêu cầu</th>
                    {tuan.map((w) => (
                      <th key={w.tuan} className="border border-line px-2 py-1.5 text-center font-semibold">
                        {w.nhan}<br /><span className="font-normal text-[12px] text-muted">{dmy(w.tu)}–{dmy(w.den)}</span>
                      </th>
                    ))}
                    <th className="border border-line px-2 py-1.5 text-center font-semibold bg-subtle">Cả kỳ</th>
                    <th className="border border-line px-2 py-1.5 text-center font-semibold">Xu hướng</th>
                    <th className="border border-line px-2 py-1.5 text-center font-semibold">Phiếu</th>
                    <th className="border border-line px-2 py-1.5 text-center font-semibold text-muted">Vượt trần</th>
                  </tr>
                </thead>
                <tbody>
                  {(k.phong || []).map((r) => {
                    const veTong = (r.tuan || []).reduce((a, w) => a + (w.so_ve || 0), 0);
                    return (
                      <tr key={r.ma_phong} className={r.pct_duoi_san >= 25 ? "bg-danger-soft/40" : ""}>
                        <td className="border border-line px-2 py-1.5"><b style={{ color: "var(--text-strong)" }}>{r.ma_phong}</b><span className="ml-1 text-muted">{r.ahu}</span></td>
                        <td className="border border-line px-2 py-1.5 text-center text-body">{r.muc_uu_tien}</td>
                        <td className="border border-line px-2 py-1.5 text-center tabular-nums text-body">{r.gioi_han_duoi}–{r.gioi_han_tren} {r.don_vi}</td>
                        {tuan.map((w) => {
                          const o = oTuan(r, w.tuan);
                          // Độ phủ thấp ⇒ KHÔNG tô màu. Một tuần chỉ 4 giờ dữ liệu mà hiện
                          // "100%" đỏ chót là con số nói dối — C1.R11 tuần 1 đúng ca đó.
                          const thua = o != null && o.gio_co_dl >= 84;
                          return (
                            <td key={w.tuan} className={`border border-line px-2 py-1.5 text-center tabular-nums ${thua ? mauKhongDat(o.pct_duoi_san) : "text-muted"}`}>
                              {o == null ? "—" : <>{o.pct_duoi_san}%{!thua && <span title="ít dữ liệu — không đủ tin cậy để so sánh">†</span>}
                                <br /><span className="text-[12px] font-normal text-muted">{o.gio_co_dl}h</span></>}
                            </td>
                          );
                        })}
                        <td className={`border border-line px-2 py-1.5 text-center tabular-nums bg-subtle ${mauKhongDat(r.pct_duoi_san)}`}>
                          {r.pct_duoi_san == null ? "—" : <>{r.pct_duoi_san}%<br /><span className="text-[12px] font-normal text-muted">{r.gio_co_dl}h</span></>}
                        </td>
                        <td className={`border border-line px-2 py-1.5 text-center text-[12px] ${xuHuong(r).mau}`}>
                          {xuHuong(r).ma} {xuHuong(r).nhan}
                          {xuHuong(r).delta != null && <span className="block text-[12px] font-normal tabular-nums">{xuHuong(r).delta > 0 ? "+" : ""}{xuHuong(r).delta} điểm %</span>}
                        </td>
                        <td className="border border-line px-2 py-1.5 text-center tabular-nums text-body">{veTong}</td>
                        <td className="border border-line px-2 py-1.5 text-center tabular-nums text-muted">{r.pct_tren_tran == null ? "—" : `${r.pct_tren_tran}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="mt-2.5 text-[12px] text-muted leading-snug">
          Số trong ô = % số giờ chênh áp nằm DƯỚI giới hạn dưới. <b>Càng cao càng xấu</b> (0% = luôn đạt).
          Số nhỏ bên dưới là <b>số giờ có dữ liệu</b> làm cơ sở tính — một tuần trọn vẹn là 168 giờ.
          Cột <b>Xu hướng</b> so tuần cuối với tuần đầu, và chỉ tính khi cả hai tuần đó đủ dữ liệu.
          Ô có dấu <b>†</b> nghĩa là dưới 84 giờ (chưa tới nửa tuần): số đó <b>không đủ tin cậy để so sánh</b>, nên không tô màu.
          Giờ thiếu dữ liệu và giờ cảm biến đứng hình bị loại khỏi phép tính — không tính là đạt cũng không tính là hỏng.
        </p>

        {/* ── Mục phụ: phòng ngoài danh sách ── */}
        {ngoaiPv.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setXemHet((v) => !v)} className="text-[12px] font-semibold text-success hover:underline">
              {xemHet ? "▾ Thu gọn" : `▸ Xem ${ngoaiPv.length} phòng NGOÀI danh sách sự cố (không sinh cảnh báo)`}
            </button>
            {xemHet && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-subtle text-muted">
                      <th className="border border-line px-2 py-1.5 text-left font-semibold">Phòng</th>
                      <th className="border border-line px-2 py-1.5 text-left font-semibold">Khu / AHU</th>
                      <th className="border border-line px-2 py-1.5 text-center font-semibold">Ưu tiên</th>
                      <th className="border border-line px-2 py-1.5 text-center font-semibold">% đạt (cả 2 hướng)</th>
                      <th className="border border-line px-2 py-1.5 text-left font-semibold">Vì sao không cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ngoaiPv.map((r) => (
                      <tr key={r.ma_phong}>
                        <td className="border border-line px-2 py-1.5"><b style={{ color: "var(--text-strong)" }}>{r.ma_phong}</b></td>
                        <td className="border border-line px-2 py-1.5 text-body">{r.khu_vuc} / {r.ahu || "—"}</td>
                        <td className="border border-line px-2 py-1.5 text-center text-body">{r.muc_uu_tien}</td>
                        <td className="border border-line px-2 py-1.5 text-center tabular-nums text-body">{r.pct_dat == null ? "—" : `${r.pct_dat}%`}</td>
                        <td className="border border-line px-2 py-1.5 text-muted">{(r.ly_do_loai || []).join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1.5 text-[12px] text-muted">Các phòng này không sinh phiếu nên không được chấm ở phần trên. Cột % đạt ở đây tính CẢ HAI hướng lệch (nguồn rollup ngày), khác thước đo của bảng chính.</p>
              </div>
            )}
          </div>
        )}
      </>)}
    </Card>
  );
}


export { BuocSuCo, KiemSoatXuLy, ApprovalModal, PhieuVongDoiVe, DanhGiaHieuQuaCanhBao };
