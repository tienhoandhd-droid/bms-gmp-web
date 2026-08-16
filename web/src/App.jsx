import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_DATA_SOURCE, HAS_SUPABASE } from "./lib/config";
import { useLiveData } from "./hooks/useLiveData";
import { PHIEN_BAN_GIAO_THUC, capNhatPhut8h, layNguoiDung, luuNguoiDung, layTaiKhoanChuaPhanQuyen, thaoTacSuCo, kiemVeThaoTac, thaoTacSuCoTuEmail, tamDungCanhBao, batLaiCanhBao, kiemGiaoThuc, ketLuanCum, layHoSoCum, kiemChuoiHashAudit, ACTION_LABEL_TO_CODE, TRANG_THAI_CODE_TO_LABEL, layChuoiXuHuong, layChuoiXuHuongChiTiet, layChuoiXuHuongDaSensor, layChuoiGiaTriPhong, layPhanTichSau, layQuetBatThuong, layDuBaoXuHuong, layMaTranPhongNgay, luuPhanTichAi, layWebhookAi, layWebhookAiSau, phanTichAiQuaWorkflow, layWebhookWf7b, guiNhanDinhXuHuong, layWebhookBaoCaoBu, guiBaoCaoBu, themPhong, suaPhong, xoaPhong, suaGioiHan, themCamBien, xoaCamBien, suaNguong, moPhongNguong, layCanhBaoUuTien, datCanhBaoUuTien, layCanhBaoHuong, datCanhBaoHuong, layCauHinhEmail, datCauHinhEmail, layNguoiNhanBaoCao, luuNguoiNhanBaoCao, xoaNguoiNhanBaoCao, layNguoiNhanCanhBao, luuNguoiNhanCanhBao, xoaNguoiNhanCanhBao, layDanhSachAhu, layLuatPhanTuyen, luuLuatPhanTuyen, xoaLuatPhanTuyen, datCongTacPhanTuyen, layCamBienDungHinh, layChenhApTheoAhu, dangKyRealtimeChenhAp, layDanhGiaHieuQuaCanhBao, layDanhGiaCanhBaoTuan, layKhungGioCanhBao, luuKhungGioCanhBao, EMAIL_KEYS_HE_THONG, EMAIL_KEYS_BAO_CAO } from "./lib/supabaseData";
import { moTaLoi } from "./lib/bmsClient";
import { dangNhapMatKhau, dangXuat as authDangXuat, layPhienHienTai, theoDoiPhien, doiMatKhau, thuKhoiPhucPhien } from "./lib/auth";
import { COLOR, SENSOR_COLOR, SENSOR_META_BASE, COMPLY_OK, COMPLY_BAD, fmtPct } from "./lib/designTokens";
import AuthGate from "./AuthGate";
// Nạp TRỄ 2 trang nặng KHÔNG thuộc màn hình đầu: Nhật ký kiểm toán (tab Nhật ký) và
// Sơ đồ luật (tab Cài đặt) — ~880 dòng. Cắt khỏi bundle "main" eager, chỉ tải khi mở
// đúng tab → màn hình đầu tải & dựng nhanh hơn.
const AuditLogPage = React.lazy(() => import("./components/AuditLogPage"));
const SoDoLuatCard = React.lazy(() => import("./components/SoDoLuatCard"));
const SoDoVongDoi = React.lazy(() => import("./components/SoDoVongDoi"));
import { moHoSoCumBanIn } from "./lib/hoSoCum";
import {
  Droplets, Thermometer, Sparkles, ShieldCheck, ShieldAlert, Activity,
  AlertTriangle, CheckCircle2, HelpCircle, Clock, ChevronRight, X, FileText,
  TrendingDown, TrendingUp, Gauge, CircleDot, Check, ChevronDown, Bell, BellOff, Mail, Cpu,
  Wind, FileBarChart, LayoutDashboard, AlertOctagon, Building2, LineChart as LineIcon,
  ScrollText, Settings as Cog, Wifi, Printer, Plus, Trash2, Search, LogIn, LogOut,
  User, Eye, SlidersHorizontal, History, Pencil, KeyRound, Layers, Minus, Save, GitBranch, Power,
  Radio, RefreshCw, ClipboardList
} from "lucide-react";
import logoCpc1hn from "./assets/logo-cpc1hn.png";


// ===== Đã tách move-only 17/08/2026 → lib/uiConst, lib/phanQuyen, lib/dinhDang, lib/moPhong, lib/nutThaoTac, components/ui/CpcLogo =====
import { PAGE_BG, cardShadow, CARD, STATUS, PRIORITY, MUC, LEVELS, LEVEL_PRIORITY, LEVEL_GLYPH, levelGlyph, SENSOR_META, OOS_FILL, ICON_CANH_BAO } from "./lib/uiConst";
import { ROLE_VI, TEN_VAI_KHU, khuCua, tenVaiTro, docTenVaiTro, FULL_ACCESS, canManageRooms, TAB_ROLES, roleCanSeeTab } from "./lib/phanQuyen";
import { mulberry32, hashStr, fmtH, fmtDelta, deltaTone, pad, toLocalInput, vnNow } from "./lib/dinhDang";
import { RAW, ROOM_BIAS, rawSeries, sensorStats, sensorLevel, roomLevel, roomCompliance, roomHourlyOOS, genDaily, genHourly, SCOPES, MASTER, byType, findScope, RANGES, SENSORS, SCOPE_LEVELS, applySensor, getSeries, AREAS, AHUS, defSensors, ROOM_SEED, INITIAL_ROOMS, INCIDENTS0, SYSTEM_ALERTS, SOP } from "./lib/moPhong";
import { A_TEAL, A_AMBER, A_INFO, A_ROSE, A_SLATE, A_IPC, A_MEP_NHAN, A_MEP_XONG, A_MEP_KHONG, STATUS_ACTIONS, rolesOfStatus, firstActionFor, nutKhopTrangThai, nutChoVaiTro, STATUS_DOT } from "./lib/nutThaoTac";
import CpcLogo from "./components/ui/CpcLogo";
import Chart from "./components/ui/Chart";
import { Card, SectionTitle, MucBadge, HeaderChip } from "./components/ui/Card";
import ServerClock from "./components/ui/ServerClock";
import { BannerCapNhat } from "./components/ui/BannerCapNhat";
import { KpiCard, OosMiniBars } from "./components/ui/KpiCard";
export { BannerCapNhat };   // main.jsx vẫn import từ App.jsx — giữ nguyên API


// ═══ KIỂM SOÁT XỬ LÝ (17/07 — yêu cầu Quản trị) ═══
// Vé đang ở bộ phận nào, im lặng bao lâu so với NGƯỠNG THEO TRẠNG THÁI
// (IPC 20′ · Cơ điện chưa nhận 15′ · đang/chờ xử lý 1h), ai đang chậm.
// Nguồn: view xem_su_co_phu_trach (server tính, web chỉ bày).
const fmtPhut = (m) => (m == null ? "—" : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}′` : `${m}′`);
// Thanh tiến trình 4 bước của MỘT vé (17/07 — user: "cần biết 1 sự cố thực sự
// đang ở đâu, tới bước nào rồi"). Bước xong = teal ✓, bước hiện tại = vàng
// (bế tắc = đỏ), bước chưa tới = xám.
const BUOC_TT = {
  CHUA_XU_LY:               { b: 1, mo: 'đang chờ IPC ra hiện trường kiểm tra' },
  MO_LAI:                   { b: 1, mo: 'vé mở lại — IPC tiếp nhận lại từ đầu' },
  DA_BAO_CO_DIEN:           { b: 2, mo: 'đã bàn giao — chờ Cơ điện bấm "Đã nhận"' },
  CO_DIEN_DANG_XU_LY:       { b: 3, mo: 'Cơ điện đã nhận việc, đang sửa tại AHU' },
  CO_DIEN_CHO_XU_LY:        { b: 3, mo: 'Cơ điện gác lại chờ vật tư — vé vẫn mở, vẫn nhắc' },
  CO_DIEN_KHONG_XU_LY_DUOC: { b: 3, mo: 'BẾ TẮC — chờ Cơ điện có vật tư để tự nhận lại (Trực + QA đã được báo)', tac: true },
};
const TEN_BUOC = ["IPC kiểm tra", "Cơ điện nhận", "Cơ điện xử lý", "Đóng vé"];
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
              <div className={`h-1.5 rounded-full ${qua ? "bg-teal-400" : hien ? (nd.tac ? "bg-rose-500" : "bg-amber-400") : "bg-slate-200"}`} />
              <p className={`mt-1 text-[9.5px] leading-tight truncate ${hien ? (nd.tac ? "text-rose-600 font-bold" : "text-amber-700 font-bold") : qua ? "text-teal-600 font-medium" : "text-slate-400"}`}>{qua ? "✓ " : hien ? "● " : ""}{t}</p>
            </div>
          );
        })}
      </div>
      <p className={`mt-1 text-[10.5px] leading-snug ${nd.tac ? "text-rose-600 font-medium" : "text-slate-500"}`}>➜ {nd.mo}</p>
    </div>
  );
}

const KiemSoatXuLy = React.memo(function KiemSoatXuLy({ rows }) {
  // Bấm ô bộ phận → xem danh sách vé của ĐÚNG bộ phận đó (17/07: user không muốn
  // một danh sách trộn lẫn). Bấm lại ô đang chọn để đóng.
  const [locVai, setLocVai] = useState(null);
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const boPhan = [["IPC", "IPC", "text-sky-700 bg-sky-50 ring-sky-200", "ring-sky-400"],
                  ["MEP", "Cơ điện", "text-amber-700 bg-amber-50 ring-amber-200", "ring-amber-400"],
                  ["LOT", "Trực HSL", "text-rose-700 bg-rose-50 ring-rose-200", "ring-rose-400"]];
  const chamTong = rows.filter((r) => r.dang_cham).length;
  const daBaoTruc = rows.filter((r) => r.da_bao_truc).length;
  const dsChon = locVai
    ? rows.filter((r) => r.vai_tro_phu_trach === locVai)
        .sort((a, b) => Number(!!b.dang_cham) - Number(!!a.dang_cham) || (b.phut_im_lang || 0) - (a.phut_im_lang || 0))
    : [];
  const tenChon = locVai ? (boPhan.find(([v]) => v === locVai) || [])[1] : "";
  return (
    <Card className="p-4 sm:p-5" style={{ background: "linear-gradient(135deg,#FDF6F2,#FFFFFF 55%)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle icon={Eye} hint="bấm vào ô bộ phận để xem danh sách vé của bộ phận đó">Kiểm soát xử lý — vé ở đâu, ai đang chậm</SectionTitle>
        <span className="text-[11px] text-slate-400 tabular-nums">{rows.length} vé mở · <b className={chamTong ? "text-rose-600" : "text-teal-600"}>{chamTong} đang chậm</b> · {daBaoTruc} đã báo Trực</span>
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
                <span className="text-[18px] font-bold tabular-nums">{ds.length}<span className="text-[11px] font-medium opacity-60"> vé</span></span>
              </div>
              <p className="text-[11px] mt-0.5 opacity-80">{ds.length === 0 ? "không giữ vé nào" : soCham > 0 ? <><b>{soCham} đang chậm</b> · im lặng lâu nhất {fmtPhut(lauNhat)}</> : "tất cả trong nhịp"}</p>
              <p className="text-[10px] mt-1 opacity-60">{chon ? "▲ đang xem — bấm để đóng" : "▼ bấm xem danh sách"}</p>
            </button>
          );
        })}
      </div>
      {locVai && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-500">Vé {tenChon} đang giữ ({dsChon.length}) — chậm xếp trên</p>
          {dsChon.length === 0 ? (
            <p className="mt-1.5 text-[12px] text-slate-400">{tenChon} không giữ vé nào. 👍</p>
          ) : (
            <div className="mt-1.5 max-h-[52vh] overflow-y-auto overscroll-contain pr-1 space-y-1.5">
              {dsChon.map((r) => (
                <div key={r.ma_su_co} className={`rounded-xl px-3 py-2 ring-1 ${r.dang_cham ? "bg-white/80 ring-rose-200" : "bg-white/60 ring-slate-200"}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px]">
                    <b style={{ color: COLOR.navy }}>SC-{String(r.ma_su_co).padStart(4, "0")}</b>
                    <span className="text-slate-500">{r.khu_vuc}</span>
                    {r.dang_cham
                      ? <span className="font-semibold text-rose-600">im lặng {fmtPhut(r.phut_im_lang)}{r.nguong_phut > 0 ? ` / ngưỡng ${fmtPhut(r.nguong_phut)}` : ""}</span>
                      : <span className="text-teal-700">trong nhịp · {fmtPhut(r.phut_im_lang)}/{fmtPhut(r.nguong_phut)}</span>}
                    {r.da_bao_truc && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">đã lên Trực</span>}
                    {r.vang_hien_truong && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">báo vắng ({r.vang_boi || "?"})</span>}
                    <span className="ml-auto text-slate-400">mở {r.gio_mo}h · cuối: {r.nguoi_thao_tac_cuoi ? `${r.nguoi_thao_tac_cuoi === "system" ? "hệ thống" : r.nguoi_thao_tac_cuoi}${r.hanh_dong_cuoi ? ` (${docTenVaiTro(r.hanh_dong_cuoi)})` : ""}` : "chưa ai thao tác"}</span>
                  </div>
                  <div className="mt-1.5"><BuocSuCo tt={r.trang_thai_hien_tai} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="mt-2.5 text-[10.5px] text-slate-400">"Chậm" = im lặng vượt ngưỡng leo thang của trạng thái hiện tại (IPC 20′ · Cơ điện chưa nhận việc 15′ · đang/chờ xử lý 1 giờ). Đồng hồ tính từ mốc gần nhất: thao tác cuối · lần nhận email · mở vé — nên vé "chậm" nghĩa là đã nhận nhắc mà vẫn im.</p>
    </Card>
  );
});


/* Memo (nâng cấp 07/07): 4 thẻ KPI + lưới thẻ phòng re-render toàn bộ mỗi nhịp 60s và
   mỗi lần bấm bất kỳ nút nào trên trang. Comparator BỎ QUA identity của prop hàm/objeto
   trang trí (onClick, accent tạo inline) — chỉ so giá trị hiển thị; hành vi hàm không đổi
   giữa các render nên bỏ qua identity là an toàn. */


/* ===== THẺ PHÒNG =====
   Memo: chỉ render lại khi room/cfg/incident đổi THAM CHIẾU (đều là state/phần tử state —
   identity ổn định giữa 2 nhịp làm mới). Prop hàm (onDetail/onIncident) bỏ qua identity:
   hành vi không đổi giữa render, tránh 58 thẻ re-render mỗi lần bấm nút bất kỳ. */
const RoomCard = React.memo(function RoomCard({ room, cfg, onDetail, onIncident, incident }) {
  const lvl = roomLevel(room, cfg); const comp = roomCompliance(room); const failing = comp != null && comp < 80; const lm = lvl < 0 ? null : LEVELS[lvl];
  return (
    <Card className="p-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="text-[15px] font-semibold truncate" style={{ color: COLOR.navy }}>{room.name}</h3><MucBadge p={room.priority} /></div><p className="text-[11px] text-slate-500 mt-0.5 tracking-wide truncate">{room.id} · Khu {room.area} · {room.ahu}</p>{room.lastSeen && (() => { const a = room.agePhut; const tone = a == null ? "text-slate-400 bg-slate-100" : a <= 75 ? "text-teal-700 bg-teal-50" : a <= 150 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50"; const txt = a == null ? "—" : a < 60 ? `${a}′ trước` : `${(a / 60).toFixed(1)}h trước`; return <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap"><Clock className="w-3 h-3 shrink-0" strokeWidth={1.8} /> Cập nhật lúc <span className="tabular-nums text-slate-600 font-medium">{room.lastSeen}</span>{room.window && <span className="text-slate-400">· khung {room.window}</span>} <span className={`px-1.5 py-0.5 rounded-full font-semibold ${tone}`}>{txt}</span></p>; })()}</div>
        <div className="text-right shrink-0">{room.duLieuCu ? <span title={room.lastSeen ? `FMS chưa trả dữ liệu giờ này. Mốc cuối: ${room.lastSeen}` : "FMS chưa trả dữ liệu giờ gần nhất"} className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Thiếu DL giờ này</span> : room.noData ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Mất dữ liệu</span> : comp == null ? <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Chưa có DL</span> : (<><p className={`text-2xl font-light tabular-nums ${failing ? "text-rose-600" : "text-teal-600"}`}>{comp}%</p><p className="text-[10px] text-slate-400">tuân thủ 1h</p></>)}</div>
      </div>

      {lm && <div className={`mt-3 rounded-2xl px-3 py-2 ring-1 ${lm.bg} ${lm.ring} flex items-center justify-between`}><span className="flex items-center gap-2 text-[12px] font-semibold"><span className={`w-2 h-2 rounded-full ${lm.dot}`} /><span className={lm.txt}>Mức cảnh báo: {lm.label}</span></span><span className="text-[10px] text-slate-500">8h</span></div>}

      {!room.noData && (
        <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 overflow-hidden">
          <div className="grid grid-cols-5 px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold border-b border-slate-200/70"><span>Chỉ tiêu</span><span className="text-center">Hiện tại</span><span className="text-center">TB 1h</span><span className="text-center">OOS 1h</span><span className="text-center">10′</span></div>
          {room.sensors.map((s) => { const st = sensorStats(room.id, s, room._isLive); const lvl = st.khongCoDL ? -1 : ((s._live && s._live.level != null) ? s._live.level : sensorLevel(st, cfg)); const noDL = lvl < 0; const dotCls = noDL ? "bg-slate-300" : LEVELS[lvl].dot; const lblMuc = st.khongCoDL ? "Chưa có dữ liệu" : (noDL ? "Cảm biến đứng hình" : LEVELS[lvl].label); return (
            <div key={s.k} className="grid grid-cols-5 items-center px-3 py-2 text-[12px] border-b border-slate-200/50 last:border-0">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">{s.k}<span title={lblMuc} aria-label={lblMuc} className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] leading-none font-bold text-white ${dotCls}`}>{levelGlyph(lvl)}</span></span>
              {noDL ? <span className="col-span-4 text-center text-[11px] text-slate-400 italic">{st.khongCoDL ? "chưa có dữ liệu" : "cảm biến đứng hình — số đo không dùng được"}</span> : (<>
              <span className="text-center tabular-nums font-semibold" style={{ color: COLOR.navy }}>{st.cur}<span className="text-[11px] text-slate-400">{SENSOR_META[s.k].unit}</span></span>
              <span className="text-center tabular-nums text-slate-500">{st.avg1h}</span>
              <span className={`text-center tabular-nums font-medium ${st.oos1h > cfg.warn ? (st.err10 >= cfg.action ? "text-rose-600" : "text-sky-600") : "text-slate-400"}`}>{st.oos1h}/60</span>
              <span className={`text-center tabular-nums font-medium ${st.err10 != null && st.err10 >= cfg.action ? "text-rose-600" : "text-slate-400"}`}>{st.err10 == null ? "—" : `${st.err10}/10`}</span>
              </>)}
            </div>
          ); })}
        </div>
      )}

      {!room.noData && (() => { const oos8 = roomHourlyOOS(room); const tong8 = oos8.reduce((a, h) => a + (h.oos || 0), 0); return <div className="mt-3"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Điểm OOS theo giờ — 8h</span>{oos8.length > 0 && tong8 === 0 && <span className="text-[10px] text-teal-600 font-medium">0 điểm OOS · đạt</span>}</div>{oos8.length === 0 ? <p className="text-[11px] text-slate-400 italic py-3 text-center">chưa có dữ liệu 8h</p> : <OosMiniBars data={oos8} h={70} />}</div>; })()}
      {room.note && <p className="mt-3 text-[11px] text-slate-500 bg-sky-50/60 ring-1 ring-sky-100 rounded-xl px-3 py-2">📝 {room.note}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => onDetail(room)} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl py-2 ring-1 ring-sky-200 transition"><Eye className="w-3.5 h-3.5" strokeWidth={1.8} /> Chi tiết &amp; biểu đồ</button>
        {incident ? <button onClick={() => onIncident(room)} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl py-2 ring-1 ring-rose-200 transition" title={`Sự cố ${incident.id} · ${incident.status}`}><AlertOctagon className="w-3.5 h-3.5" strokeWidth={1.8} /> Sự cố {incident.id} <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} /></button>
          : failing ? <span className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-amber-600 bg-amber-50 rounded-xl py-2 ring-1 ring-amber-200"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} /> Không đạt — chưa mở sự cố</span> : null}
      </div>
    </Card>
  );
}, (t, s) => t.room === s.room && t.cfg === s.cfg && t.incident === s.incident);

function RoomDetailModal({ room, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden max-h-[88vh] overflow-y-auto" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#E6F4F1,#fff)" }}><div><h2 className="text-base font-semibold" style={{ color: COLOR.navy }}>{room.id} — {room.name}</h2><p className="text-[11px] text-slate-500">Khu {room.area} · {room.ahu} · {MUC[room.priority]} · gồm {room.sensors.length} loại dữ liệu</p></div><button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" strokeWidth={1.8} /></button></div>
        <div className="px-6 py-5 space-y-4">{room.noData ? <p className="text-amber-600 text-sm">Phòng đang thiếu dữ liệu — không có cảm biến hoạt động.</p> : room.sensors.map((s) => { const st = sensorStats(room.id, s, room._isLive); const noDL = st.khongCoDL; const pts = st.hourly8 || []; const mean = pts.length ? +(pts.reduce((a, p) => a + (p.avg ?? 0), 0) / pts.length).toFixed(1) : null; const unit = SENSOR_META[s.k].unit; return (
          <div key={s.k} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold" style={{ color: COLOR.navy }}>{SENSOR_META[s.k].label} ({s.k})</p><p className="text-[11px] text-slate-500">Giới hạn: {s.min != null ? `≥ ${s.min}` : "—"}{s.max != null ? ` · ≤ ${s.max}` : ""} {unit}</p></div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2 text-center">{[["Hiện tại", `${st.cur ?? "—"} ${unit}`], ["TB 1h", `${st.avg1h ?? "—"}`], ["TB 8h", mean == null ? "—" : `${mean}`], ["OOS 1h", st.oos1h == null ? "—" : `${st.oos1h}/60`], ["OOS 10′ cuối", st.err10 == null ? "—" : `${st.err10}/10`]].map(([k, v]) => <div key={k} className="rounded-xl bg-white ring-1 ring-slate-200 py-1.5"><p className="text-[11px] uppercase text-slate-400 font-semibold leading-tight">{k}</p><p className="text-[13px] font-semibold tabular-nums" style={{ color: COLOR.navy }}>{v}</p></div>)}</div>
            {noDL ? <div className="h-[142px] flex items-center justify-center text-center px-4 text-[12px] text-slate-400 italic rounded-xl bg-white ring-1 ring-slate-200">Chưa có dữ liệu thật cho cảm biến này — được cấu hình nhưng FMS chưa gửi số liệu.</div> : <Chart type="roomDetail" pts={pts} smin={s.min} smax={s.max} mean={mean} unit={unit} group={`rm-${room.id}`} h={182} />}
            {!noDL && <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500"><span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: COLOR.teal, opacity: 0.3 }} /> Khoảng đạt (GHD–GHT)</span><span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: COLOR.sky, opacity: 0.45 }} /> Dải min–max theo giờ</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLOR.teal }} /> trong khoảng</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLOR.coralDeep }} /> ngoài khoảng</span><span className="flex items-center gap-1"><span className="w-4 inline-block border-t-2 border-dashed" style={{ borderColor: COLOR.navy }} /> Trung bình 8h</span></div>}
          </div>
        ); })}</div>
      </div>
    </div>
  );
}

/* ===== #3 — DANH SÁCH PHÒNG THEO Ô KPI (bấm ô → biết phòng nào) ===== */
function KpiListModal({ kind, groups, incidents, cfg, onClose, onPickRoom, onPickIncident, onGotoIncidents }) {
  const META = {
    dat:   { title: "Phòng đạt", desc: "Tuân thủ ≥ 80% trong 1 giờ gần nhất", color: COLOR.teal, grad: "#E6F4F1", Icon: CheckCircle2 },
    khong: { title: "Phòng không đạt", desc: "Tuân thủ < 80% — nên kiểm tra ngay", color: COLOR.coralDeep, grad: "#FBE9E4", Icon: AlertTriangle },
    thieu: { title: "Thiếu dữ liệu", desc: "Mất tín hiệu hoặc dữ liệu quá cũ — không coi là đạt", color: COLOR.sand, grad: "#FBF1DE", Icon: HelpCircle },
    p1:    { title: "Sự cố Nghiêm trọng đang mở", desc: "Phòng trọng yếu & quan trọng — ưu tiên xử lý", color: COLOR.sky, grad: "#E6F1FA", Icon: Activity },
  }[kind];
  const isP1 = kind === "p1";
  const rooms = isP1 ? [] : (groups[kind] || []);
  const ageTone = (a) => a == null ? "text-slate-400 bg-slate-100" : a <= 90 ? "text-teal-700 bg-teal-50" : a <= 240 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50";
  const ageTxt = (a) => a == null ? "—" : a === 0 ? "mới nhất" : a < 60 ? `${a}′ trước` : `trễ ${(a / 60).toFixed(1)}h`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden max-h-[85vh] flex flex-col" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between" style={{ background: `linear-gradient(135deg,${META.grad},#fff)` }}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5" style={{ background: "#fff", boxShadow: "0 4px 14px -6px rgba(30,58,86,0.3)" }}><META.Icon className="w-5 h-5" style={{ color: META.color }} strokeWidth={1.9} /></div>
            <div><h2 className="text-base font-semibold" style={{ color: COLOR.navy }}>{META.title}</h2><p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">{META.desc}</p></div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/70 text-slate-400"><X className="w-4 h-4" strokeWidth={1.8} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          {isP1 ? (
            incidents.length === 0 ? <p className="text-center text-[13px] text-slate-500 py-8">Không có sự cố Nghiêm trọng nào đang mở. 🎉</p> : (
              <div className="space-y-2">
                {incidents.map((i) => { const laP1 = i.priority === "P1"; return (
                  <button key={i.id} onClick={() => onPickIncident(i)} className={`w-full text-left rounded-2xl ring-1 border-l-[6px] px-4 py-3 transition duration-150 flex items-center justify-between gap-3 ${laP1 ? "ring-rose-200 border-rose-600 bg-rose-50/30 hover:ring-rose-300 hover:bg-rose-50/60" : "ring-amber-200 border-amber-500 bg-amber-50/30 hover:ring-amber-300 hover:bg-amber-50/60"}`}>
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[14px] font-semibold" style={{ color: COLOR.navy }}>{i.id}</span><span className="text-[11px] px-2 py-0.5 rounded-full font-bold text-white bg-rose-600">Nghiêm trọng</span>{!laP1 && <span className="ml-1 text-[10px] text-slate-400">quan trọng</span>}</div><p className="text-[12px] text-slate-600 mt-0.5 truncate">{i.room} · {i.sensor || "—"} · {i.status}</p></div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${laP1 ? "text-rose-300" : "text-amber-300"}`} strokeWidth={1.8} />
                  </button>
                ); })}
                <button onClick={onGotoIncidents} className="w-full mt-1 rounded-2xl py-2.5 text-[12px] font-semibold text-white transition" style={{ background: COLOR.teal }}>Mở trang Sự cố để xử lý →</button>
              </div>
            )
          ) : (
            rooms.length === 0 ? <p className="text-center text-[13px] text-slate-500 py-8">Không có phòng nào trong nhóm này.</p> : (
              <div className="space-y-2">
                {rooms.map((r) => { const comp = roomCompliance(r); const lvl = roomLevel(r, cfg); const lm = lvl < 0 ? null : LEVELS[lvl]; return (
                  <button key={r.id} onClick={() => onPickRoom(r)} className="w-full text-left rounded-2xl ring-1 ring-slate-200 hover:ring-teal-300 hover:bg-teal-50/40 px-4 py-3 transition flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="text-[13px] font-semibold truncate" style={{ color: COLOR.navy }}>{r.name}</span><MucBadge p={r.priority} /></div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{r.id} · Khu {r.area} · {r.ahu}</p>
                      <div className="flex items-center gap-1.5 mt-1">{lm && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${lm.bg} ${lm.txt} ring-1 ${lm.ring}`}>{lm.label}</span>}{r.lastSeen && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ageTone(r.agePhut)}`}>{ageTxt(r.agePhut)}</span>}</div>
                    </div>
                    <div className="text-right shrink-0">{comp == null ? <span className="text-[11px] text-slate-400 font-semibold">— %</span> : <p className={`text-xl font-light tabular-nums ${comp < 80 ? "text-rose-600" : "text-teal-600"}`}>{comp}%</p>}<ChevronRight className="w-4 h-4 text-slate-300 ml-auto mt-0.5" strokeWidth={1.8} /></div>
                  </button>
                ); })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== QUẢN LÝ PHÒNG (gồm sửa cảm biến/giới hạn phòng cũ) ===== */
const SENSOR_DEFAULT = { DP: { min: 12.5, max: 30 }, RH: { min: 30, max: 55 }, T: { min: 18, max: 24 } };
function RoomManager({ rooms, cfg, canManage, onAdd, onDelete, onSaveEdits }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  // Bản NHÁP của phòng đang sửa — gõ chỉ đổi state cục bộ, bấm "Lưu thay đổi" mới ghi hệ thống.
  const [draft, setDraft] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);
  const blank = { id: "", name: "", area: "C1", ahu: "AHU01", priority: "P3", note: "", noData: false, DP: true, RH: true, T: true, DPmin: 12.5, DPmax: 30, RHmin: 30, RHmax: 55, Tmin: 18, Tmax: 24 };
  const [f, setF] = useState(blank);
  const [qTim, setQTim] = useState("");        // tìm kiếm phòng
  const [locKhu, setLocKhu] = useState("ALL");  // lọc theo khu (đồng nhất với tab Sự cố)
  const [locAhu, setLocAhu] = useState("ALL");  // lọc theo AHU trong khu đã chọn
  const ahusLoc = [...new Set(rooms.filter((r) => (locKhu === "ALL" || r.area === locKhu) && r.ahu).map((r) => `${r.area}|${r.ahu}`))].sort();
  const roomsHienThi = rooms.filter((r) => (locKhu === "ALL" || r.area === locKhu) && (locAhu === "ALL" || r.ahu === locAhu) && (!qTim.trim() || (r.id + " " + (r.name || "")).toLowerCase().includes(qTim.trim().toLowerCase())));
  const locChip = (v, label, on, click) => <button key={v} onClick={click} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${on ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`} style={on ? { backgroundColor: COLOR.teal } : {}}>{label}</button>;
  const submit = () => {
    const id = f.id.trim(); if (!id) return alert("Nhập mã phòng (vd C1.R09)"); if (rooms.some((r) => r.id === id)) return alert("Mã phòng đã tồn tại");
    const sensors = f.noData ? [] : [f.DP && { k: "DP", min: Number(f.DPmin), max: Number(f.DPmax) }, f.RH && { k: "RH", min: Number(f.RHmin), max: Number(f.RHmax) }, f.T && { k: "T", min: Number(f.Tmin), max: Number(f.Tmax) }].filter(Boolean);
    onAdd({ id, name: f.name || id, area: f.area, ahu: f.ahu, priority: f.priority, note: f.note, noData: f.noData, sensors }); setF(blank); setOpen(false);
  };
  const inp = "rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[13px] text-slate-700 outline-none focus:ring-2 focus:ring-teal-200";
  const editing = rooms.find((r) => r.id === editId);
  // So bản nháp với bản gốc → danh sách thay đổi sẽ ghi khi bấm Lưu.
  const num = (v) => (v === "" || v == null ? null : Number(v));
  const diff = useMemo(() => {
    if (!editing || !draft) return null;
    const patch = {};
    ["name", "area", "ahu", "priority", "note"].forEach((k) => { if ((draft[k] ?? "") !== (editing[k] ?? "")) patch[k] = draft[k]; });
    const gocS = editing.sensors || [], drS = draft.sensors || [];
    const boSensor = gocS.filter((s) => !drS.some((d) => d.k === s.k)).map((s) => s.k);
    const themSensor = drS.filter((d) => !gocS.some((s) => s.k === d.k)).map((d) => ({ k: d.k, min: num(d.min), max: num(d.max) }));
    const capNhatGioiHan = drS.filter((d) => { const g = gocS.find((s) => s.k === d.k); return g && (num(d.min) !== (g.min ?? null) || num(d.max) !== (g.max ?? null)); }).map((d) => ({ k: d.k, min: num(d.min), max: num(d.max) }));
    return { patch, boSensor, themSensor, capNhatGioiHan };
  }, [editing, draft]);
  const soThayDoi = diff ? Object.keys(diff.patch).length + diff.boSensor.length + diff.themSensor.length + diff.capNhatGioiHan.length : 0;
  const dongSua = () => { if (soThayDoi > 0 && !window.confirm("Bỏ các thay đổi chưa lưu?")) return; setEditId(null); setDraft(null); };
  const moSua = (r) => {
    if (editId === r.id) { dongSua(); return; }
    if (editId && soThayDoi > 0 && !window.confirm("Bỏ các thay đổi chưa lưu?")) return;
    setOpen(false); setEditId(r.id);
    setDraft({ name: r.name || "", area: r.area, ahu: r.ahu || "", priority: r.priority, note: r.note || "", sensors: (r.sensors || []).map((s) => ({ ...s })) });
  };
  const doiGioiHan = (k, field, value) => setDraft((d) => ({ ...d, sensors: d.sensors.map((s) => (s.k === k ? { ...s, [field]: value } : s)) }));
  const luuSua = async () => {
    if (!diff || soThayDoi === 0 || dangLuu) return;
    setDangLuu(true);
    const ok = await onSaveEdits(editing.id, diff);
    setDangLuu(false);
    if (ok) { setEditId(null); setDraft(null); }
  };
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle icon={Building2} hint="thêm / sửa cảm biến & giới hạn / xóa">Quản lý phòng</SectionTitle>
        {canManage ? <button onClick={() => { if (editId && soThayDoi > 0 && !window.confirm("Bỏ các thay đổi chưa lưu?")) return; setOpen((o) => !o); setEditId(null); setDraft(null); }} className="text-xs font-medium text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: COLOR.coral }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm phòng</button> : <span className="text-[11px] text-slate-400">Cần quyền QA/Quản trị để chỉnh sửa</span>}
      </div>

      {open && canManage && (
        <div className="mt-4 rounded-2xl bg-sky-50/60 ring-1 ring-sky-100 p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Mã phòng</label><input className={inp} value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} placeholder="C1.R09" /></div>
            <div className="flex flex-col gap-1 col-span-2"><label className="text-[10px] uppercase text-slate-500 font-semibold">Tên phòng</label><input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Phòng cân" /></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Khu</label><select className={inp} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">AHU</label><select className={inp} value={f.ahu} onChange={(e) => setF({ ...f, ahu: e.target.value })}>{AHUS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Mức ưu tiên</label><select className={inp} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="P1">Mức 1</option><option value="P2">Mức 2</option><option value="P3">Mức 3</option></select></div>
          </div>
          <div className="rounded-xl bg-white ring-1 ring-slate-200 p-3">
            <p className="text-[10px] uppercase text-slate-500 font-semibold mb-2">Chọn loại cảm biến & giới hạn (min – max)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-1.5 text-[12px] text-slate-600 rounded-lg bg-slate-50 px-2 py-2"><input type="checkbox" checked={f.DP} onChange={(e) => setF({ ...f, DP: e.target.checked })} /> DP <input type="number" className="w-12 rounded ring-1 ring-slate-200 px-1 py-0.5" value={f.DPmin} onChange={(e) => setF({ ...f, DPmin: e.target.value })} />–<input type="number" className="w-12 rounded ring-1 ring-slate-200 px-1 py-0.5" value={f.DPmax} onChange={(e) => setF({ ...f, DPmax: e.target.value })} /> Pa</label>
              <label className="flex items-center gap-1.5 text-[12px] text-slate-600 rounded-lg bg-slate-50 px-2 py-2"><input type="checkbox" checked={f.RH} onChange={(e) => setF({ ...f, RH: e.target.checked })} /> RH <input type="number" className="w-12 rounded ring-1 ring-slate-200 px-1 py-0.5" value={f.RHmin} onChange={(e) => setF({ ...f, RHmin: e.target.value })} />–<input type="number" className="w-12 rounded ring-1 ring-slate-200 px-1 py-0.5" value={f.RHmax} onChange={(e) => setF({ ...f, RHmax: e.target.value })} /> %</label>
              <label className="flex items-center gap-1.5 text-[12px] text-slate-600 rounded-lg bg-slate-50 px-2 py-2"><input type="checkbox" checked={f.T} onChange={(e) => setF({ ...f, T: e.target.checked })} /> T <input type="number" className="w-12 rounded ring-1 ring-slate-200 px-1 py-0.5" value={f.Tmin} onChange={(e) => setF({ ...f, Tmin: e.target.value })} />–<input type="number" className="w-12 rounded ring-1 ring-slate-200 px-1 py-0.5" value={f.Tmax} onChange={(e) => setF({ ...f, Tmax: e.target.value })} /> °C</label>
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2"><div className="flex items-center gap-4"><label className="flex items-center gap-2 text-[12px] text-slate-600"><input type="checkbox" checked={f.noData} onChange={(e) => setF({ ...f, noData: e.target.checked })} /> Thiếu dữ liệu</label><input className={inp + " w-56"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ghi chú (tuỳ chọn)" /></div><div className="flex gap-2"><button onClick={() => setOpen(false)} className="text-xs text-slate-500 rounded-xl px-4 py-2 hover:bg-slate-100">Hủy</button><button onClick={submit} className="text-xs font-medium text-white rounded-xl px-4 py-2" style={{ backgroundColor: COLOR.teal }}>Lưu phòng</button></div></div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.8} /><input value={qTim} onChange={(e) => setQTim(e.target.value)} placeholder="Tìm mã hoặc tên phòng…" className="w-full rounded-xl bg-white ring-1 ring-slate-200 pl-9 pr-3 py-2 text-[12px] text-slate-700 outline-none focus:ring-2 focus:ring-teal-300" />{qTim && <button onClick={() => setQTim("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Lọc khu</span>
          {locChip("ALL", "Tất cả", locKhu === "ALL", () => { setLocKhu("ALL"); setLocAhu("ALL"); })}
          {DS_KHU.map((k) => locChip(k, `Khu ${k}`, locKhu === k, () => { setLocKhu(k); setLocAhu("ALL"); }))}
          {ahusLoc.length > 0 && (
            <select value={locAhu === "ALL" ? "ALL" : `${locKhu}|${locAhu}`} onChange={(e) => { const v = e.target.value; if (v === "ALL") { setLocAhu("ALL"); } else { const [k, a] = v.split("|"); setLocKhu(k); setLocAhu(a); } }} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] text-slate-700 outline-none ml-1">
              <option value="ALL">AHU: tất cả</option>
              {ahusLoc.map((p) => { const [k, a] = p.split("|"); return <option key={p} value={p}>{locKhu === "ALL" ? `Khu ${k} · ${a}` : a}</option>; })}
            </select>
          )}
        </div>
        <span className="text-[11px] text-slate-400 ml-auto tabular-nums">{roomsHienThi.length}/{rooms.length} phòng</span>
      </div>
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-[13px]">
          <thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Mã", "Tên", "Khu", "AHU", "Ưu tiên", "Loại DL", "Mức cảnh báo", ""].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {roomsHienThi.length === 0 ? <tr><td colSpan={8} className="py-6 text-center text-[12px] text-slate-400">Không có phòng khớp bộ lọc{locKhu !== "ALL" ? ` · Khu ${locKhu}` : ""}{locAhu !== "ALL" ? ` · ${locAhu}` : ""}{qTim.trim() ? ` · "${qTim.trim()}"` : ""}. <button onClick={() => { setLocKhu("ALL"); setLocAhu("ALL"); setQTim(""); }} className="text-teal-600 font-semibold underline">Bỏ lọc</button></td></tr> : roomsHienThi.map((r) => { const lvl = roomLevel(r, cfg); const lm = lvl < 0 ? null : LEVELS[lvl]; return (
              <tr key={r.id} className="border-t border-slate-100 hover:bg-sky-50/40 transition">
                <td className="py-2 pr-4 font-semibold" style={{ color: COLOR.navy }}>{r.id}</td>
                <td className="py-2 pr-4 text-slate-600">{r.name}</td>
                <td className="py-2 pr-4 text-slate-500">{r.area}</td>
                <td className="py-2 pr-4 text-slate-500">{r.ahu}</td>
                <td className="py-2 pr-4"><MucBadge p={r.priority} /></td>
                <td className="py-2 pr-4 text-slate-500">{r.noData ? "—" : r.sensors.map((s) => s.k).join(", ")}</td>
                <td className="py-2 pr-4">{lm ? <span className={`text-[11px] px-2 py-0.5 rounded-full ${lm.bg} ${lm.txt}`}>{lm.label}</span> : <span className="text-[11px] text-amber-600">Mất DL</span>}</td>
                <td className="py-2 pr-4">{canManage && <div className="flex gap-1.5"><button onClick={() => moSua(r)} className="text-sky-600 hover:text-sky-800" title="Sửa phòng / cảm biến / giới hạn"><Pencil className="w-4 h-4" strokeWidth={1.8} /></button><button onClick={() => onDelete(r.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" strokeWidth={1.8} /></button></div>}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>

      {editing && canManage && draft && (
        <div className="mt-4 rounded-2xl bg-teal-50/50 ring-1 ring-teal-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: COLOR.navy }}>Sửa phòng & cảm biến — {editing.id}{soThayDoi > 0 && <span className="ml-2 align-middle text-[10px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5">{soThayDoi} thay đổi chưa lưu</span>}</p>
            <button onClick={dongSua} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1 col-span-2"><label className="text-[10px] uppercase text-slate-500 font-semibold">Tên phòng</label><input className={inp} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Khu</label><select className={inp} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">AHU</label><select className={inp} value={draft.ahu} onChange={(e) => setDraft({ ...draft, ahu: e.target.value })}>{[...new Set([draft.ahu, ...AHUS])].filter(Boolean).map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Mức ưu tiên</label><select className={inp} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}><option value="P1">Mức 1</option><option value="P2">Mức 2</option><option value="P3">Mức 3</option></select></div>
            <div className="flex flex-col gap-1"><label className="text-[10px] uppercase text-slate-500 font-semibold">Ghi chú</label><input className={inp} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="(tuỳ chọn)" /></div>
          </div>
          {!editing.noData && (
            <div className="space-y-2 mt-3">
              {draft.sensors.map((s) => (
                <div key={s.k} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 flex items-center gap-2 text-[12px] flex-wrap">
                  <span className="font-semibold w-16" style={{ color: COLOR.navy }}>{SENSOR_META[s.k].label}</span>
                  <span className="text-slate-400">min</span><input type="number" value={s.min ?? ""} onChange={(e) => doiGioiHan(s.k, "min", e.target.value)} className="w-16 rounded ring-1 ring-slate-200 px-1.5 py-0.5" />
                  <span className="text-slate-400">max</span><input type="number" value={s.max ?? ""} onChange={(e) => doiGioiHan(s.k, "max", e.target.value)} className="w-16 rounded ring-1 ring-slate-200 px-1.5 py-0.5" />
                  <span className="text-slate-400">{SENSOR_META[s.k].unit}</span>
                  <button onClick={() => setDraft((d) => ({ ...d, sensors: d.sensors.filter((x) => x.k !== s.k) }))} className="ml-auto text-rose-500 hover:text-rose-700 text-[11px] flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> bỏ</button>
                </div>
              ))}
              {["DP", "RH", "T"].filter((k) => !draft.sensors.some((s) => s.k === k)).length > 0 && (
                <div className="flex items-center gap-2 pt-1"><span className="text-[11px] text-slate-500">Thêm cảm biến:</span>{["DP", "RH", "T"].filter((k) => !draft.sensors.some((s) => s.k === k)).map((k) => <button key={k} onClick={() => setDraft((d) => ({ ...d, sensors: [...d.sensors, { k, ...SENSOR_DEFAULT[k] }] }))} className="text-[11px] rounded-lg px-2 py-1 ring-1 ring-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 flex items-center gap-1"><Plus className="w-3 h-3" strokeWidth={2} /> {SENSOR_META[k].label}</button>)}</div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
            <p className="text-[11px] text-slate-500 max-w-md">Thay đổi chỉ ghi vào hệ thống khi bấm <b>Lưu</b>. Giới hạn là <b>mốc so sánh gốc</b> — sau khi lưu, KPI, mức cảnh báo, thẻ phòng và báo cáo đều tính theo giá trị mới.</p>
            <div className="flex gap-2">
              <button onClick={dongSua} className="text-xs text-slate-500 rounded-xl px-4 py-2 hover:bg-slate-100">Hủy</button>
              <button onClick={luuSua} disabled={soThayDoi === 0 || dangLuu} className="text-xs font-medium text-white rounded-xl px-4 py-2 flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: COLOR.teal }}><Save className={`w-3.5 h-3.5 ${dangLuu ? "animate-pulse" : ""}`} strokeWidth={2} /> {dangLuu ? "Đang lưu…" : "Lưu thay đổi"}</button>
            </div>
          </div>
        </div>
      )}
      <p className="text-[11px] text-slate-400 mt-3">Thay đổi sau khi <b>Lưu</b> cập nhật ngay KPI, thẻ phòng và được ghi vào <b>lịch sử thay đổi cấu hình</b> (tab Nhật ký &amp; SOP).</p>
    </Card>
  );
}

import TrendPage, { AiSections } from "./features/trends/TrendPage";
import ReportsPage, { HuongDanEmailNut, ModalVeEmail } from "./features/reports/ReportsPage";
import { LoginModal, SucKhoeWidget, DoiMatKhauCard, DoiMatKhauModal, PhanTichGmpCard, TaiKhoanCard, ChuoiHashCard } from "./features/settings/SettingsParts";
import { DS_KHU, DB_MOI_MAC_DINH } from "./lib/phanQuyen";
import CauHinhNguoiNhan, { LuatPhanTuyenCard } from "./features/recipients/RecipientsPage";
import ChenhApTheoAhu from "./features/pressure/ChenhApTheoAhu";

function ApprovalModal({ incident, action, user, onClose, onCommit }) {
  const [reason, setReason] = useState(""); const valid = reason.trim().length >= 6 && action && user;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#E6F4F1,#fff)" }}><div className="flex items-center gap-3"><div className="rounded-2xl bg-white p-2.5 ring-1 ring-teal-100 shadow-sm"><ShieldCheck className="w-5 h-5" style={{ color: COLOR.teal }} strokeWidth={1.8} /></div><div><h2 className="text-base font-semibold" style={{ color: COLOR.navy }}>{action ? action.label : "Xem sự cố"}</h2><p className="text-[11px] text-slate-500">Ghi nhận bằng tài khoản đăng nhập · ALCOA+</p></div></div><button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" strokeWidth={1.8} /></button></div>
        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-xs">{[["Mã sự cố", incident.id], ["Phòng", incident.room], ["Chỉ tiêu", incident.sensor]].map(([k, v]) => <div key={k}><p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{k}</p><p className="mt-1 font-semibold" style={{ color: COLOR.navy }}>{v}</p></div>)}</div>
          <div className="rounded-2xl bg-teal-50 ring-1 ring-teal-100 px-4 py-3 flex items-center gap-2 text-[13px]"><User className="w-4 h-4 text-teal-600" strokeWidth={1.8} /><span className="text-slate-600">Người thực hiện:</span> <span className="font-semibold" style={{ color: COLOR.navy }}>{user ? `${user.name} (${user.role})` : "chưa đăng nhập"}</span></div>
          <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1.5"><FileText className="w-3 h-3" strokeWidth={1.8} /> Nhật ký truy vết</p><div className="space-y-2 max-h-32 overflow-y-auto pr-1">{incident.trail.map((e, i) => <div key={i} className="flex gap-3 text-xs"><span className="text-slate-400 tabular-nums shrink-0">{e.t}</span><span className="text-slate-300">·</span><span className="text-slate-600"><span className="font-semibold">{e.who}</span> — {e.act}</span></div>)}</div></div>
          <div><label className="text-[11px] font-semibold text-slate-600 mb-2 block">Lý do / kết quả <span className="text-rose-500">*</span></label><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ghi rõ lý do/kết quả (tối thiểu 6 ký tự)…" className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-300 resize-none placeholder:text-slate-300" /></div>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex items-center justify-between gap-3"><span className="text-[11px] text-slate-500">{action ? <>Trạng thái tiếp → <span className="font-semibold text-slate-700">{action.next}</span></> : <span className="text-slate-400">Bạn không có quyền thao tác bước này</span>}</span><div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">{action ? "Hủy" : "Đóng"}</button>{action && <button disabled={!valid} onClick={() => onCommit(incident, action, reason)} className="px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 text-white disabled:bg-slate-200 disabled:text-slate-400" style={valid ? { backgroundColor: COLOR.coral } : {}}><Check className="w-4 h-4" strokeWidth={2} /> Xác nhận & lưu</button>}</div></div>
      </div>
    </div>
  );
}


/* ============ APP ============ */








/* ===== QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN XEM THEO KHU (chỉ ADMIN) ===== */

/* ===== SỰ CỐ GẦN ĐÂY — bản đồ phút cửa sổ 8h (chỉ phòng có sự cố) ===== */
const RECENT_RANGES = [{ k: 1, label: "1 giờ" }, { k: 4, label: "4 giờ" }, { k: 8, label: "8 giờ" }];

/* ═══ TỔNG QUAN — thẻ CẢM BIẾN ĐỨNG HÌNH (chính sách 13/07: tách riêng) ═══
   Phòng có cảm biến đứng hình = tương đương THIẾU DỮ LIỆU: không chấm mức,
   không mở sự cố, không vào báo cáo chung. Thẻ này là lối vào nhanh từ Tổng
   quan; chi tiết + nút làm mới nằm ở tab Cảm biến. Ẩn khi không có cái nào. */

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
    <Card className="p-5" style={{ background: "linear-gradient(135deg,#FFFBEB,#FFFFFF 65%)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <SectionTitle icon={Gauge} hint="theo dõi riêng · không tính vào chấm điểm">Cảm biến đứng hình — {ds.length} điểm đo</SectionTitle>
          <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed max-w-3xl">
            Các phòng dưới đây có cảm biến <b>mất tín hiệu (giá trị không đổi ≥ 3 giờ)</b> nên được tách riêng,
            <b> tương đương phòng thiếu dữ liệu</b>: không chấm mức, không mở sự cố, không vào báo cáo chung — chờ Cơ điện khôi phục đầu đo.
          </p>
        </div>
        {onXemChiTiet && <button onClick={onXemChiTiet} className="shrink-0 flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50">Xem chi tiết → tab Cảm biến</button>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {ds.map((r) => (
          <span key={`${r.ma_phong}-${r.loai_cam_bien}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 ${r.so_gio_dung >= 168 ? "text-rose-700 bg-rose-50 ring-rose-200" : "text-amber-700 bg-amber-50 ring-amber-200"}`}>
            <b>{r.ma_phong}</b> · {r.loai_cam_bien} · đứng {fmtGio(r.so_gio_dung, r.tu_dau_lich_su)} (kẹt {r.gia_tri_dung})
          </span>
        ))}
      </div>
    </Card>
  );
}

/* ═══ ĐÁNH GIÁ HIỆU QUẢ CẢNH BÁO (03/08 — yêu cầu chủ hệ thống) ═══
   Ba câu hỏi, theo đúng thứ tự người đọc cần:
     1. Luật cảnh báo đang áp là gì, và nó BỎ SÓT bao nhiêu phòng?
     2. Vé đến tay từng bộ phận rồi có ai động vào không?
     3. Từng phòng đạt bao nhiêu % so với yêu cầu?
   Điểm thiết kế quan trọng: bảng KHÔNG chỉ liệt kê phòng trong phạm vi. Phòng bị
   loại vẫn hiện, kèm LÝ DO bị loại — vì chỗ nguy hiểm nhất không phải phòng hỏng
   mà có cảnh báo, mà là phòng hỏng nặng KHÔNG AI ĐƯỢC BÁO. */
// Phễu vòng đời vé (11/08) — trả lời câu "IPC kích 4 vé, 2 vé chuyển Cơ điện,
// còn 2 vé kia đi đâu?". Một con số % không nói được điều đó: vé có thể được IPC
// tự kết luận "bình thường", chỉ bị báo vắng, hoặc tự tan trước khi ai kịp đụng.
// Chặng 3-5 là nhánh CON của chặng 2, chặng 7-8 là nhánh con của chặng 3 — thụt
// vào để không đọc nhầm thành các nhóm rời nhau cộng lại bằng tổng.
function PhieuVongDoiVe({ chang, tuanMoc, soTuan, dmy }) {
  const [moKhu, setMoKhu] = React.useState(null);   // "C1|ipc_bao_cd" đang xổ mã vé
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
      className={`px-2.5 py-1 rounded-full text-[11.5px] font-medium ring-1 transition ${tuan === v ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`}
      style={tuan === v ? { backgroundColor: COLOR.navy } : {}}>{label}</button>
  );
  const CON = { ipc_bao_cd: 1, ipc_ket_luan: 1, ipc_chi_vang: 1, mep_nhan: 2, mep_xong: 2 };
  const MAU = {
    ipc_bao_cd: COLOR.navy, ipc_ket_luan: COLOR.teal, ipc_chi_vang: COLOR.sand,
    ipc_khong_dung: COLOR.softCoral, mep_nhan: COLOR.sky, mep_xong: COLOR.teal,
    he_tu_dong: COLOR.softCoral, con_mo: COLOR.sand,
  };
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Vé đi đâu — phễu vòng đời</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {chipTuan(null, "Cả kỳ")}
        {dsTuan.map((t) => chipTuan(t, nhanTuan(t)))}
        <span className="ml-1 text-[11px] text-slate-400">vé xếp theo tuần MỞ VÉ</span>
      </div>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        {dsKhu.map((k) => {
          const ds = loc.filter((c) => c.khu_vuc === k).sort((a, b) => a.thu_tu - b.thu_tu);
          // Không có dòng nào = tuần đó khu này KHÔNG có vé. Khác hẳn "có vé mà mọi
          // chặng bằng 0" — nên phải nói rõ, đừng vẽ phễu rỗng gây hiểu nhầm.
          if (ds.length === 0) return (
            <div key={k} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <p className="text-[12.5px] font-bold" style={{ color: COLOR.navy }}>Khu {k}</p>
              <p className="mt-1 text-[12px] text-slate-500">Không có vé nào {tuan == null ? "trong kỳ" : `trong tuần ${tuan}`}.</p>
            </div>
          );
          const tong = ds.find((c) => c.ma === "mo")?.so_ve || 0;
          return (
            <div key={k} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-[12.5px] font-bold" style={{ color: COLOR.navy }}>
                Khu {k} · {tong} vé {tuan == null ? "trong kỳ" : nhanTuan(tuan).toLowerCase()}
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
                        className={`w-full text-left rounded-md px-1.5 py-1 ${co ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}`}>
                        <span className="flex items-baseline gap-2">
                          <span className={`text-[12px] ${muc ? "text-slate-600" : "font-semibold text-slate-700"}`}>{c.nhan}</span>
                          <span className="ml-auto tabular-nums text-[12.5px] font-bold text-slate-800">{c.so_ve}</span>
                          <span className="tabular-nums text-[10.5px] text-slate-400 w-10 text-right">
                            {tong > 0 ? `${Math.round((c.so_ve / tong) * 100)}%` : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 block h-1.5 rounded-full bg-slate-100">
                          <span className="block h-1.5 rounded-full" style={{ width: `${rong}%`, backgroundColor: MAU[c.ma] || COLOR.ink }} />
                        </span>
                      </button>
                      {moKhu === khoa && co && (
                        <p className="mt-0.5 mb-1 rounded-md bg-slate-50 px-2 py-1 text-[10.5px] leading-snug text-slate-500 ring-1 ring-slate-200">
                          <b className="text-slate-600">Mã vé:</b> {c.ma_ve.join(", ")}
                          {c.ma_ve.length >= 50 && <span className="text-slate-400"> … (chỉ liệt kê 50 vé đầu)</span>}
                          <br /><span className="text-slate-400">{c.giai_thich}</span>
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
      <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
        Các dòng <b>thụt vào</b> là nhánh con: "chuyển Cơ điện" / "IPC tự kết luận" / "chỉ báo vắng" nằm trong
        "IPC/QC có động vào"; "Cơ điện bấm…" nằm trong "chuyển Cơ điện". Nên đừng cộng dồn tất cả các dòng.
        Một vé có thể vào nhiều nhánh (vừa báo vắng vừa chuyển Cơ điện), và <b>hệ thống tự đóng</b> chồng lên mọi nhánh —
        chênh áp về dải thì vé đóng bất kể ai đang giữ. Bấm vào một chặng để xem mã vé.
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
  const mauKhongDat = (p) => p == null ? "text-slate-400"
    : p >= 50 ? "text-rose-700 font-bold" : p >= 25 ? "text-rose-600 font-semibold"
    : p >= 10 ? "text-amber-600 font-semibold" : p > 0 ? "text-teal-700" : "text-emerald-700 font-semibold";
  const ROLE = { IPC: "IPC / QC", MEP: "Cơ điện", LOT: "Trực HSL", QA: "QA" };
  // 10/08: IPC tách theo khu (C1 · Q2) — vé thuộc phòng, phòng thuộc khu, nên gộp
  // chung một số % là chấm điểm đội này bằng vé của đội kia. Khu Q2 hiển thị "QC"
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
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium ring-1 transition ${soTuan === v ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`}
      style={soTuan === v ? { backgroundColor: COLOR.teal } : {}}>{label}</button>
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
    if (ds.length < 2) return { ma: "?", nhan: "không đủ dữ liệu", mau: "text-slate-400", delta: null };
    const d = Math.round((ds[ds.length - 1].pct_duoi_san - ds[0].pct_duoi_san) * 10) / 10;
    if (Math.abs(d) < 5) return { ma: "→", nhan: "đi ngang", mau: "text-slate-500", delta: d };
    return d > 0
      ? { ma: "▲", nhan: "xấu đi", mau: "text-rose-600 font-semibold", delta: d }
      : { ma: "▼", nhan: "tốt lên", mau: "text-emerald-700 font-semibold", delta: d };
  };

  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle icon={ShieldAlert} hint="chỉ tính lệch phía DƯỚI SÀN — đúng hướng mà cảnh báo đang canh">
        Đánh giá hiệu quả cảnh báo
      </SectionTitle>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Kỳ đánh giá</span>
        {chip(2, "2 tuần")}{chip(3, "3 tuần")}{chip(6, "6 tuần")}
        {tuan.length > 0 && (
          <span className="text-[12px] text-slate-500">
            từ <b className="text-slate-700">{dmy(tuan[0]?.tu)}</b> đến <b className="text-slate-700">{dmy(tuan[tuan.length - 1]?.den)}</b>
          </span>
        )}
        {dangTai && <span className="text-[11px] text-teal-600">đang tính…</span>}
      </div>
      {loi && <p className="mt-3 text-[12.5px] text-rose-600">Không đọc được báo cáo: {loi}</p>}

      {bc && tuanBc && (<>
        <div className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-[12px] text-teal-900 ring-1 ring-teal-200">
          <b>Thước đo:</b> % số giờ chênh áp <b>TỤT DƯỚI SÀN</b>. Đây đúng là hướng mà cảnh báo đang canh
          (<code>canh_bao_huong</code> DP = <b>DUOI</b>), nên cột % và cột số vé nói cùng một chuyện.
          Phần <b>vượt trần</b> để riêng ở cột cuối — không sinh vé nhưng vẫn là sai lệch.
        </div>

        {/* ── Luật cảnh báo ── */}
        <div className="mt-3 rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Luật cảnh báo đang áp</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-slate-700">
            <span>Khu: <b>{luat.khu_vuc || "—"}</b></span>
            <span>Mức ưu tiên: <b>{luat.muc_uu_tien || "—"}</b></span>
            <span>Loại cảm biến: <b>{luat.loai_cam_bien || "—"}</b></span>
            <span>Hướng vi phạm: <b>{luat.huong_dp === "DUOI" ? "chỉ khi DƯỚI sàn" : luat.huong_dp}</b></span>
          </div>
          <p className="mt-2.5 text-[13px] text-slate-600">
            <b className="text-slate-800">{tuanBc.tong_ket.so_phong}</b> phòng trong danh sách sự cố, thuộc{" "}
            <b className="text-slate-800">{tuanBc.tong_ket.so_khu}</b> khu · trung bình{" "}
            <b className={mauKhongDat(tuanBc.tong_ket.pct_duoi_san_tb)}>{tuanBc.tong_ket.pct_duoi_san_tb}%</b> thời gian dưới sàn ·{" "}
            <b className="text-slate-800">{tuanBc.tong_ket.so_ve}</b> vé trong kỳ.
          </p>
        </div>

        {/* ── Tỉ lệ phản hồi ── */}
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tỉ lệ phản hồi của các bộ phận</p>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {sapBoPhan(bc.bo_phan || []).map((b) => {
            // QA là vai GIÁM SÁT — không có hàng đợi nên không chấm %. Trước 11/08
            // thẻ này ra "0% — 0/94 vé", đọc như thể QA bỏ sót 94 lần.
            if (b.vai_giam_sat) return (
              <div key={khoaBoPhan(b)} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-[11.5px] font-semibold text-slate-500">{ROLE[b.vai_tro] || b.vai_tro} <span className="font-normal">· giám sát</span></p>
                <p className="text-[22px] font-bold tabular-nums leading-tight text-slate-600">{b.ve_da_thao_tac}</p>
                <p className="text-[10.5px] text-slate-500 leading-snug">vé đã can thiệp · {b.tong_thao_tac} thao tác</p>
                <p className="text-[10.5px] text-slate-400 leading-snug">Không có hàng đợi — chỉ vào khi xác nhận khắc phục hoặc mở lại vé, nên không tính tỉ lệ.</p>
              </div>
            );
            const tCoBao = coBao(b);        // trên vé bộ phận thực sự được báo
            const tTong = b.ty_le_phan_hoi; // trên MỌI vé, kể cả vé ngoài giờ
            const t = tCoBao ?? tTong;
            const mau = t == null ? "text-slate-400" : t < 20 ? "text-rose-600" : t < 50 ? "text-amber-600" : "text-emerald-700";
            const boSot = b.ve_co_bao != null && b.ve_can_xu_ly != null ? b.ve_can_xu_ly - b.ve_co_bao : 0;
            return (
              <div key={khoaBoPhan(b)} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <p className="text-[11.5px] font-semibold text-slate-500">{nhanBoPhan(b)}</p>
                <p className={`text-[22px] font-bold tabular-nums leading-tight ${mau}`}>{t == null ? "—" : `${t}%`}</p>
                <p className="text-[10.5px] text-slate-500 leading-snug">
                  động vào <b>{tCoBao != null ? b.ve_da_thao_tac_co_bao : b.ve_da_thao_tac}</b>/{tCoBao != null ? b.ve_co_bao : b.ve_can_xu_ly} vé
                  {tCoBao != null && <span className="text-slate-400"> có báo</span>} · {b.tong_thao_tac} thao tác
                </p>
                {boSot > 0 && (
                  <p className="text-[10.5px] text-slate-400 leading-snug">
                    tính cả <b>{boSot}</b> vé ngoài khung giờ báo: <b>{tTong}%</b> ({b.ve_da_thao_tac}/{b.ve_can_xu_ly})
                  </p>
                )}
                <p className="text-[10.5px] text-slate-400">{b.gio_phan_hoi_tb == null ? "chưa có phản hồi nào" : `phản hồi sau TB ${b.gio_phan_hoi_tb} giờ`}</p>
                {b.gio_ipc_giu_tb != null && (
                  <p className="text-[10.5px] text-amber-700">IPC giữ TB <b>{b.gio_ipc_giu_tb} giờ</b> trước khi chuyển</p>
                )}
              </div>
            );
          })}
        </div>
        {khungGio && (
          <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
            <b>"Vé có báo"</b> = vé còn đang mở trong khung giờ cảnh báo ({khungGio}) nên bộ phận mới có email để biết.
            Vé mở rồi tự tan gọn trong đêm/Chủ nhật không ai được báo — để trong mẫu số là chấm điểm người ta trên việc họ không thể biết.
            Số cũ (trên MỌI vé) vẫn để ở dòng dưới để truy vết.
            Riêng <b>Cơ điện</b> tính từ lúc vé được <b>chuyển sang</b>, không phải từ lúc mở vé.
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
              <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                Mỗi điểm = lứa vé <b>mở trong ngày đó</b> mà bộ phận ấy <b>có được báo</b>, tính xem bao nhiêu % được động vào (bất kỳ lúc nào sau đó).
                Ngày <b>không có vé nào</b> để trống nên đường bị đứt — cố ý: "không có vé" khác hẳn "có vé mà không ai đụng".
                Cơ điện chỉ tính trên các vé đã được chuyển sang Cơ điện, và xếp theo <b>ngày được chuyển</b> chứ không phải ngày mở vé.
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
          const mauPct = (t) => t == null ? "text-slate-400" : t < 20 ? "text-rose-600 font-semibold" : t < 50 ? "text-amber-600 font-semibold" : "text-emerald-700 font-semibold";
          // Tiến bộ = tuần CÓ VÉ cuối cùng so tuần CÓ VÉ đầu tiên. Tuần không có vé
          // nào để bộ phận ấy xử lý thì không phải thành tích cũng không phải lỗi.
          // Từ 11/08 so trên cùng thước đo đang hiện trong ô: tỉ lệ trên VÉ CÓ BÁO.
          const tienBo = (b) => {
            const ds = dsTuan.map((t) => lay(b, t)).filter((o) => o && mauSo(o) > 0 && pct(o) != null);
            if (ds.length < 2) return { ma: "?", nhan: "chưa đủ tuần có vé", mau: "text-slate-400", d: null };
            const d = Math.round((pct(ds[ds.length - 1]) - pct(ds[0])) * 10) / 10;
            if (Math.abs(d) < 5) return { ma: "→", nhan: "đi ngang", mau: "text-slate-500", d };
            return d > 0 ? { ma: "▲", nhan: "tiến bộ", mau: "text-emerald-700 font-semibold", d }
                         : { ma: "▼", nhan: "kém đi", mau: "text-rose-600 font-semibold", d };
          };
          return (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Tình trạng phản hồi từng tuần — có tiến bộ không</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold">Bộ phận</th>
                      {dsTuan.map((t) => {
                        const m = mocTuan(t);
                        return (
                          <th key={t} className="border border-slate-200 px-2 py-1.5 text-center font-semibold">
                            Tuần {t}{m && <><br /><span className="font-normal text-[10px] text-slate-400">{dmy(m.tu)}–{dmy(m.den)}</span></>}
                          </th>
                        );
                      })}
                      <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold bg-slate-100">Tiến bộ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nhom.map((b) => {
                      const tb = tienBo(b);
                      return (
                        <tr key={khoaBoPhan(b)}>
                          <td className="border border-slate-200 px-2 py-1.5 font-semibold" style={{ color: COLOR.navy }}>{nhanBoPhan(b)}</td>
                          {dsTuan.map((t) => {
                            const o = lay(b, t);
                            return (
                              <td key={t} className={`border border-slate-200 px-2 py-1.5 text-center tabular-nums ${mauPct(pct(o))}`}>
                                {!o || !o.ve_can_xu_ly
                                  ? <span className="text-slate-400 text-[11px]">không có vé</span>
                                  : !mauSo(o)
                                  ? <span className="text-slate-400 text-[11px]" title={`${o.ve_can_xu_ly} vé nhưng không vé nào rơi vào khung giờ báo`}>không vé nào được báo<br /><span className="text-[9.5px]">({o.ve_can_xu_ly} vé ngoài giờ)</span></span>
                                  : <>{pct(o)}%<br />
                                      <span className="text-[9.5px] font-normal text-slate-400">
                                        {tuSo(o)}/{mauSo(o)} vé{o.gio_phan_hoi_tb != null && ` · ${o.gio_phan_hoi_tb}h`}
                                        {o.ve_co_bao != null && o.ve_can_xu_ly > o.ve_co_bao && <><br />({o.ve_can_xu_ly - o.ve_co_bao} vé ngoài giờ không tính)</>}
                                      </span>
                                    </>}
                              </td>
                            );
                          })}
                          <td className={`border border-slate-200 px-2 py-1.5 text-center text-[11.5px] bg-slate-50 ${tb.mau}`}>
                            {tb.ma} {tb.nhan}
                            {tb.d != null && <span className="block text-[9.5px] font-normal tabular-nums">{tb.d > 0 ? "+" : ""}{tb.d} điểm %</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
                Số nhỏ = <b>vé đã động vào / vé có báo</b> và thời gian phản hồi trung bình; vé mở ngoài khung giờ cảnh báo
                được đếm riêng chứ không nằm trong mẫu số. Cột <b>Tiến bộ</b> so tuần có vé cuối với tuần có vé đầu; tuần
                <b> không có vé</b> nào để bộ phận ấy xử lý thì không tính là thành tích cũng không tính là lỗi.
                Lưu ý đọc: tỉ lệ tụt còn có thể vì <b>vé tự tan nhanh hơn</b> — xem tuổi thọ vé ở phễu bên dưới trước khi kết luận người kém đi.
              </p>
            </div>
          );
        })()}

        {/* ── Phễu vòng đời vé — "vé kia đi đâu" ── */}
        {Array.isArray(bc.phieu_vong_doi) && bc.phieu_vong_doi.length > 0 && (
          <PhieuVongDoiVe chang={bc.phieu_vong_doi} tuanMoc={bc.tuan_moc} soTuan={soTuan} dmy={dmy} />
        )}

        {/* ── Kết luận ── */}
        <div className="mt-4 rounded-xl bg-amber-50 p-3.5 ring-1 ring-amber-300">
          <p className="text-[12.5px] font-bold text-slate-800">Kết luận kỳ {soTuan} tuần (từ {dmy(tuan[0]?.tu)} đến {dmy(tuan[tuan.length - 1]?.den)})</p>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-slate-700 list-disc pl-4">
            <li><b>{tk.ve_mo_trong_ky}</b> vé mở, trong đó <b className={tk.ve_he_thong_dong / Math.max(1, tk.ve_mo_trong_ky) > 0.5 ? "text-rose-600" : ""}>{tk.ve_he_thong_dong}</b> vé <b>hệ thống tự đóng</b> — chênh áp tự về dải trước khi có người xử lý.</li>
            {(() => {
              const ds = khu.flatMap((k) => k.phong || []).map(xuHuong);
              const xau = ds.filter((x) => x.ma === "▲").length;
              const tot = ds.filter((x) => x.ma === "▼").length;
              const ngang = ds.filter((x) => x.ma === "→").length;
              const thieu = ds.filter((x) => x.ma === "?").length;
              return (
                <li>
                  Xu hướng qua {soTuan} tuần: <b className="text-emerald-700">{tot} phòng tốt lên</b> ·{" "}
                  <b className="text-rose-600">{xau} phòng xấu đi</b> · {ngang} đi ngang
                  {thieu > 0 && <> · {thieu} chưa đủ dữ liệu để kết luận</>}.
                </li>
              );
            })()}
            <li>Đã gửi <b>{tk.email_digest}</b> email cảnh báo trong kỳ.</li>
            {muP1P2.length > 0 && (
              <li className="text-rose-700">Ngoài danh sách: <b>{muP1P2.length}</b> phòng <b>P1/P2</b> đạt dưới 90% mà không được cảnh báo. Cân nhắc có nên đưa vào danh sách không.</li>
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
            if (ds.length < 2) return { ma: "?", nhan: "chưa đủ", mau: "text-slate-400", d: null };
            const d = Math.round((ds[ds.length - 1].pct_duoi_san_tb - ds[0].pct_duoi_san_tb) * 10) / 10;
            if (Math.abs(d) < 5) return { ma: "→", nhan: "đi ngang", mau: "text-slate-500", d };
            return d < 0 ? { ma: "▼", nhan: "tiến bộ", mau: "text-emerald-700 font-semibold", d }
                         : { ma: "▲", nhan: "kém đi", mau: "text-rose-600 font-semibold", d };
          };
          const o = (sl, t) => sl.find((x) => x.tuan === t);
          return (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Trung bình toàn khu theo tuần — có tiến bộ không</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold" rowSpan={2}>Phạm vi</th>
                      {tuan.map((w) => (
                        <th key={w.tuan} className="border border-slate-200 px-2 py-1 text-center font-semibold" colSpan={2}>
                          Tuần {w.tuan}<br /><span className="font-normal text-[10px] text-slate-400">{dmy(w.tu)}–{dmy(w.den)}</span>
                        </th>
                      ))}
                      <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold bg-slate-100" rowSpan={2}>Tiến bộ<br /><span className="font-normal text-[9.5px]">(dưới sàn)</span></th>
                    </tr>
                    <tr className="bg-slate-50 text-slate-400 text-[10px]">
                      {tuan.map((w) => (
                        <React.Fragment key={w.tuan}>
                          <th className="border border-slate-200 px-1.5 py-1 text-center font-semibold">dưới sàn</th>
                          <th className="border border-slate-200 px-1.5 py-1 text-center font-normal">vượt trần</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hang.map((h) => {
                      const tb = tienBo(h.sl);
                      return (
                        <tr key={h.ten} className={h.dam ? "bg-slate-50 font-semibold" : ""}>
                          <td className="border border-slate-200 px-2 py-1.5" style={{ color: COLOR.navy }}>{h.ten}</td>
                          {tuan.map((w) => {
                            const x = o(h.sl, w.tuan);
                            return (
                              <React.Fragment key={w.tuan}>
                                <td className={`border border-slate-200 px-1.5 py-1.5 text-center tabular-nums ${mauKhongDat(x?.pct_duoi_san_tb)}`}>
                                  {x == null ? "—" : `${x.pct_duoi_san_tb}%`}
                                </td>
                                <td className="border border-slate-200 px-1.5 py-1.5 text-center tabular-nums text-slate-400">
                                  {x == null ? "—" : `${x.pct_tren_tran_tb}%`}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className={`border border-slate-200 px-2 py-1.5 text-center text-[11.5px] bg-slate-50 ${tb.mau}`}>
                            {tb.ma} {tb.nhan}
                            {tb.d != null && <span className="block text-[9.5px] font-normal tabular-nums">{tb.d > 0 ? "+" : ""}{tb.d} điểm %</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 leading-snug">
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
            <p className="text-[12.5px] font-bold" style={{ color: COLOR.navy }}>
              Khu {k.khu_vuc}
              <span className="ml-2 font-normal text-slate-500">{k.so_phong} phòng · trung bình <b className={mauKhongDat(k.pct_duoi_san_tb)}>{k.pct_duoi_san_tb}%</b> dưới sàn</span>
            </p>
            <div className="mt-1.5 overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500">
                    <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold">Phòng</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold">Ưu tiên</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold">Yêu cầu</th>
                    {tuan.map((w) => (
                      <th key={w.tuan} className="border border-slate-200 px-2 py-1.5 text-center font-semibold">
                        {w.nhan}<br /><span className="font-normal text-[10px] text-slate-400">{dmy(w.tu)}–{dmy(w.den)}</span>
                      </th>
                    ))}
                    <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold bg-slate-100">Cả kỳ</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold">Xu hướng</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold">Vé</th>
                    <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold text-slate-400">Vượt trần</th>
                  </tr>
                </thead>
                <tbody>
                  {(k.phong || []).map((r) => {
                    const veTong = (r.tuan || []).reduce((a, w) => a + (w.so_ve || 0), 0);
                    return (
                      <tr key={r.ma_phong} className={r.pct_duoi_san >= 25 ? "bg-rose-50/40" : ""}>
                        <td className="border border-slate-200 px-2 py-1.5"><b style={{ color: COLOR.navy }}>{r.ma_phong}</b><span className="ml-1 text-slate-400">{r.ahu}</span></td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-600">{r.muc_uu_tien}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums text-slate-600">{r.gioi_han_duoi}–{r.gioi_han_tren} {r.don_vi}</td>
                        {tuan.map((w) => {
                          const o = oTuan(r, w.tuan);
                          // Độ phủ thấp ⇒ KHÔNG tô màu. Một tuần chỉ 4 giờ dữ liệu mà hiện
                          // "100%" đỏ chót là con số nói dối — C1.R11 tuần 1 đúng ca đó.
                          const thua = o != null && o.gio_co_dl >= 84;
                          return (
                            <td key={w.tuan} className={`border border-slate-200 px-2 py-1.5 text-center tabular-nums ${thua ? mauKhongDat(o.pct_duoi_san) : "text-slate-400"}`}>
                              {o == null ? "—" : <>{o.pct_duoi_san}%{!thua && <span title="ít dữ liệu — không đủ tin cậy để so sánh">†</span>}
                                <br /><span className="text-[9px] font-normal text-slate-400">{o.gio_co_dl}h</span></>}
                            </td>
                          );
                        })}
                        <td className={`border border-slate-200 px-2 py-1.5 text-center tabular-nums bg-slate-50 ${mauKhongDat(r.pct_duoi_san)}`}>
                          {r.pct_duoi_san == null ? "—" : <>{r.pct_duoi_san}%<br /><span className="text-[9px] font-normal text-slate-400">{r.gio_co_dl}h</span></>}
                        </td>
                        <td className={`border border-slate-200 px-2 py-1.5 text-center text-[11.5px] ${xuHuong(r).mau}`}>
                          {xuHuong(r).ma} {xuHuong(r).nhan}
                          {xuHuong(r).delta != null && <span className="block text-[9.5px] font-normal tabular-nums">{xuHuong(r).delta > 0 ? "+" : ""}{xuHuong(r).delta} điểm %</span>}
                        </td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums text-slate-600">{veTong}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums text-slate-400">{r.pct_tren_tran == null ? "—" : `${r.pct_tren_tran}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="mt-2.5 text-[11px] text-slate-400 leading-snug">
          Số trong ô = % số giờ chênh áp nằm DƯỚI giới hạn dưới. <b>Càng cao càng xấu</b> (0% = luôn đạt).
          Số nhỏ bên dưới là <b>số giờ có dữ liệu</b> làm cơ sở tính — một tuần trọn vẹn là 168 giờ.
          Cột <b>Xu hướng</b> so tuần cuối với tuần đầu, và chỉ tính khi cả hai tuần đó đủ dữ liệu.
          Ô có dấu <b>†</b> nghĩa là dưới 84 giờ (chưa tới nửa tuần): số đó <b>không đủ tin cậy để so sánh</b>, nên không tô màu.
          Giờ thiếu dữ liệu và giờ cảm biến đứng hình bị loại khỏi phép tính — không tính là đạt cũng không tính là hỏng.
        </p>

        {/* ── Mục phụ: phòng ngoài danh sách ── */}
        {ngoaiPv.length > 0 && (
          <div className="mt-4">
            <button onClick={() => setXemHet((v) => !v)} className="text-[12px] font-semibold text-teal-700 hover:underline">
              {xemHet ? "▾ Thu gọn" : `▸ Xem ${ngoaiPv.length} phòng NGOÀI danh sách sự cố (không sinh cảnh báo)`}
            </button>
            {xemHet && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold">Phòng</th>
                      <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold">Khu / AHU</th>
                      <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold">Ưu tiên</th>
                      <th className="border border-slate-200 px-2 py-1.5 text-center font-semibold">% đạt (cả 2 hướng)</th>
                      <th className="border border-slate-200 px-2 py-1.5 text-left font-semibold">Vì sao không cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ngoaiPv.map((r) => (
                      <tr key={r.ma_phong}>
                        <td className="border border-slate-200 px-2 py-1.5"><b style={{ color: COLOR.navy }}>{r.ma_phong}</b></td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-600">{r.khu_vuc} / {r.ahu || "—"}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center text-slate-600">{r.muc_uu_tien}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-center tabular-nums text-slate-600">{r.pct_dat == null ? "—" : `${r.pct_dat}%`}</td>
                        <td className="border border-slate-200 px-2 py-1.5 text-slate-500">{(r.ly_do_loai || []).join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-1.5 text-[11px] text-slate-400">Các phòng này không sinh vé nên không được chấm ở phần trên. Cột % đạt ở đây tính CẢ HAI hướng lệch (nguồn rollup ngày), khác thước đo của bảng chính.</p>
              </div>
            )}
          </div>
        )}
      </>)}
    </Card>
  );
}

const TABS = [{ k: "home", label: "Tổng quan", icon: LayoutDashboard }, { k: "tasks", label: "Nhiệm vụ", icon: ClipboardList }, { k: "events", label: "Sự cố", icon: AlertOctagon }, { k: "recent", label: "Chênh áp", icon: Gauge }, { k: "sensors", label: "Cảm biến", icon: Gauge }, { k: "trend", label: "Xu hướng GMP", icon: LineIcon }, { k: "reports", label: "Báo cáo", icon: FileBarChart }, { k: "audit", label: "Nhật ký & SOP", icon: ScrollText }, { k: "recipients", label: "Người nhận", icon: Mail }, { k: "settings", label: "Cài đặt", icon: Cog }];

// ═══════════════════════════════════════════════════════════════════════════
// CỤM ĐIỀU TRA & MỞ LẠI SỰ CỐ — modal/ngăn kéo (10/07/2026)
// Thay 4 hộp window.prompt nối đuôi: QA nhìn cả bốn trường một lúc, biết trường nào
// bắt buộc, sửa được trước khi ghi. RPC phía sau giữ nguyên (rpc_ket_luan_cum,
// rpc_thao_tac_su_co) — giao diện chỉ là lớp vỏ, luật vẫn nằm ở máy chủ.
// ═══════════════════════════════════════════════════════════════════════════
const O_TEXTAREA = "w-full mt-1 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-300";

function ModalKetLuanCum({ cum, dangChay, onDong, onLuu }) {
  const [nguyenNhan, setNguyenNhan] = useState(cum.nguyen_nhan_goc || "");
  const [khacPhuc, setKhacPhuc] = useState(cum.hanh_dong_khac_phuc || "");
  const [phongNgua, setPhongNgua] = useState(cum.hanh_dong_phong_ngua || "");
  const [ketLuan, setKetLuan] = useState(cum.qa_ket_luan || "");
  const thieu = nguyenNhan.trim().length < 10 || khacPhuc.trim().length < 10;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onDong}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold" style={{ color: COLOR.navy }}>Kết luận điều tra · {cum.ma_hien_thi}</h3>
        <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">{cum.ahu || "—"} · {cum.loai_cam_bien} · {cum.su_co_dang_mo} sự cố đang mở. Kết luận ghi vào cụm và <b>một dòng audit cho từng sự cố</b> thuộc cụm — không hồ sơ nào mất dấu vết.</p>
        <label className="block mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nguyên nhân gốc <span className="text-rose-500">*</span></label>
        <textarea className={O_TEXTAREA} rows={2} value={nguyenNhan} onChange={(e) => setNguyenNhan(e.target.value)} placeholder="Vì sao xảy ra? (ít nhất 10 ký tự)" />
        <label className="block mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hành động khắc phục <span className="text-rose-500">*</span></label>
        <textarea className={O_TEXTAREA} rows={2} value={khacPhuc} onChange={(e) => setKhacPhuc(e.target.value)} placeholder="Đã/sẽ làm gì để hết lệch? (ít nhất 10 ký tự)" />
        <label className="block mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hành động phòng ngừa</label>
        <textarea className={O_TEXTAREA} rows={2} value={phongNgua} onChange={(e) => setPhongNgua(e.target.value)} placeholder="Làm gì để không tái diễn? (bỏ trống được)" />
        <label className="block mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Kết luận QA về ảnh hưởng chất lượng</label>
        <textarea className={O_TEXTAREA} rows={2} value={ketLuan} onChange={(e) => setKetLuan(e.target.value)} placeholder="Có/không ảnh hưởng lô sản xuất, căn cứ… (bỏ trống được)" />
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onDong} className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Huỷ</button>
          <button disabled={thieu || dangChay} onClick={() => onLuu({ nguyenNhan, khacPhuc, phongNgua, ketLuan })}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: COLOR.teal }}>{dangChay ? "Đang ghi…" : "Ghi kết luận"}</button>
        </div>
        {thieu && <p className="mt-2 text-right text-[11px] text-slate-400">Nguyên nhân gốc và khắc phục cần ≥ 10 ký tự.</p>}
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
  const doDam = (h) => (h >= 168 ? "text-rose-700 bg-rose-50 ring-rose-200" : h >= 24 ? "text-amber-700 bg-amber-50 ring-amber-200" : "text-slate-600 bg-slate-100 ring-slate-200");
  if (!isLive) return <Card className="p-6"><SectionTitle icon={Gauge}>Cảm biến đứng hình</SectionTitle><p className="mt-3 text-sm text-slate-500">Chế độ xem trước — chưa kết nối dữ liệu thật.</p></Card>;
  // 16/07 (user hỏi "sao ghi 1 giờ?"): cờ đứng-trong-giờ bật NGAY từ giờ đầu (60 điểm
  // y hệt), nhưng chỉ ≥3 giờ liên tiếp mới TÁCH khỏi chấm điểm. Tab tách 2 tầng cho khớp.
  const duNguong = (rows || []).filter((r) => (r.so_gio_dung ?? 99) >= 3);
  const nghi = (rows || []).filter((r) => (r.so_gio_dung ?? 99) < 3);
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <SectionTitle icon={Gauge}>Cảm biến đứng hình (im lặng)</SectionTitle>
          <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed max-w-3xl">
            Bảng dưới là cảm biến <b>đứng hình ≥ 3 giờ liên tiếp</b> — thường do hỏng, mất kết nối
            hoặc treo tín hiệu tại FMS. Từ 13/07, phòng có cảm biến đứng hình được <b>tách riêng như phòng thiếu dữ liệu</b>:
            không chấm mức, <b>không mở sự cố</b> và không tính vào báo cáo chung. Danh sách này là nơi theo dõi duy nhất;
            việc cần làm là Cơ điện kiểm tra / thay thế đầu đo — cảm biến sống lại sẽ tự trở lại chấm điểm bình thường.
            <br /><span className="text-slate-400">Dấu <b>≥</b> nghĩa là cảm biến chưa từng cho một giờ đo &ldquo;còn sống&rdquo; nào trong toàn bộ dữ liệu còn lưu — thời gian đứng thật có thể dài hơn con số hiển thị.</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {luc && <span className="text-[11px] text-slate-400">Cập nhật {luc.toLocaleTimeString("vi-VN")}</span>}
          <button onClick={taiVe} className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12px] font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Làm mới
          </button>
        </div>
      </div>
      {loi && <p className="mt-3 text-[12px] text-rose-600">Không tải được danh sách: {loi.thong_bao || loi.message || "lỗi kết nối"}. Bấm Làm mới để thử lại.</p>}
      {rows === null ? (
        <div className="mt-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
      ) : duNguong.length === 0 && nghi.length === 0 && !loi ? (
        <div className="mt-4 rounded-2xl bg-teal-50 ring-1 ring-teal-100 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-teal-700">Không có cảm biến nào đang đứng hình</p>
          <p className="mt-1 text-[12px] text-slate-500">Mọi cảm biến đều đang gửi giá trị thay đổi bình thường.</p>
        </div>
      ) : duNguong.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="text-[10.5px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="py-2 pr-4 font-semibold">Phòng</th>
              <th className="py-2 pr-4 font-semibold">Khu · AHU</th>
              <th className="py-2 pr-4 font-semibold">Cảm biến</th>
              <th className="py-2 pr-4 font-semibold">Giá trị đứng</th>
              <th className="py-2 pr-4 font-semibold">Đứng từ</th>
              <th className="py-2 font-semibold">Thời gian đứng</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {duNguong.map((r) => {
                const meta = SENSOR_META[r.loai_cam_bien] || {};
                return (
                  <tr key={`${r.ma_phong}-${r.loai_cam_bien}`} className="text-[13px]">
                    <td className="py-2.5 pr-4"><b style={{ color: COLOR.navy }}>{r.ma_phong}</b>{r.ten_phong && <span className="text-slate-400 text-[12px]"> — {r.ten_phong}</span>}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{r.khu_vuc} · {r.ahu || "—"}</td>
                    <td className="py-2.5 pr-4 text-slate-600">{meta.label || r.loai_cam_bien}</td>
                    <td className="py-2.5 pr-4 tabular-nums text-slate-700">
                      {r.gia_tri_dung != null ? `${r.gia_tri_dung} ${meta.unit || ""}` : "—"}
                      {(r.gioi_han_duoi != null || r.gioi_han_tren != null) && <span className="text-[11px] text-slate-400"> (giới hạn {r.gioi_han_duoi ?? "—"}–{r.gioi_han_tren ?? "—"})</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600 tabular-nums">{fmtTu(r.dung_tu, r.tu_dau_lich_su)}</td>
                    <td className="py-2.5"><span className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ${doDam(r.so_gio_dung)}`}>{fmtGio(r.so_gio_dung, r.tu_dau_lich_su)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows !== null && nghi.length > 0 && (
        <div className="mt-5 rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-3">
          <p className="text-[12px] font-semibold text-slate-600">Nghi đứng hình — mới dưới 3 giờ ({nghi.length} điểm đo)</p>
          <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">Giá trị vừa lặp y hệt trong 1–2 giờ gần nhất. <b>Chưa đủ ngưỡng 3 giờ</b> nên vẫn chấm điểm và mở vé như thường; nếu tiếp tục đứng, đủ 3 giờ sẽ tự chuyển lên bảng trên và được tách khỏi cảnh báo.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {nghi.map((r) => (
              <span key={`${r.ma_phong}-${r.loai_cam_bien}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 text-slate-600 bg-white ring-slate-200">
                <b>{r.ma_phong}</b> · {r.loai_cam_bien} · {r.so_gio_dung} giờ (kẹt {r.gia_tri_dung})
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

const HIEN_VIEC_CUA_BAN = false;   // 16/07: user tạm ẩn — chưa cần thiết giai đoạn này
// ═══ VIỆC CỦA BẠN — banner nổi trên MỌI tab (QA/ADMIN thấy cụm chờ kết luận;
// IPC/MEP/LOT thấy sự cố mình phụ trách theo SLA server) ═══
// Tách khỏi App + React.memo với comparator bỏ-qua-prop-hàm (pattern KpiCard):
// trạng thái Thu gọn/Mở ra nằm TRONG banner nên bấm toggle chỉ render lại chính nó,
// không kéo cả cây App (bảng sự cố + biểu đồ) render theo — nguồn lag cũ.
const ViecCuaBan = React.memo(function ViecCuaBan({ viecCuaToi, cumChoToi, onXuLy, onGhiKetLuan }) {
  const [mo, setMo] = useState(true);
  const [tatCa, setTatCa] = useState(false);   // false = 5 việc + 3 cụm đầu · true = toàn bộ (khung cuộn)
  const [an, setAn] = useState(false);         // Ẩn cho gọn → còn viên nhỏ, bấm hiện lại (tự hiện lại khi F5)
  if (viecCuaToi.length === 0 && cumChoToi.length === 0) return null;
  const tong = viecCuaToi.length + cumChoToi.length;
  if (an) return (
    <button onClick={() => setAn(false)}
      className="mb-4 inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-amber-200 px-3.5 py-1.5 text-[12px] font-semibold hover:bg-amber-50"
      style={{ color: COLOR.navy, ...cardShadow }} title="Hiện lại danh sách Việc của bạn">
      Việc của bạn · {tong}
      <span className="text-slate-400 font-normal">Hiện ▾</span>
    </button>
  );
  const dsViec = tatCa ? viecCuaToi : viecCuaToi.slice(0, 5);
  const dsCum = tatCa ? cumChoToi : cumChoToi.slice(0, 3);
  const conAn = (viecCuaToi.length - dsViec.length) + (cumChoToi.length - dsCum.length);
  return (
    <div className="mb-4 rounded-2xl bg-white ring-1 ring-amber-200 px-4 py-3" style={cardShadow}>
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => setMo(!mo)} className="min-w-0 flex-1 text-left">
          <span className="text-[13px] font-semibold" style={{ color: COLOR.navy }}>
            Việc của bạn · {tong}
          </span>
        </button>
        <div className="shrink-0 flex items-center gap-1">
          <button onClick={() => setAn(true)} title="Ẩn cho gọn — còn viên nhỏ để hiện lại"
            className="rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 hover:text-slate-600">Ẩn ✕</button>
          <button onClick={() => setMo(!mo)} className="rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50">{mo ? "Thu gọn ▲" : "Mở ra ▼"}</button>
        </div>
      </div>
      {mo && (
        <div className={`mt-2 space-y-1.5 ${tatCa ? "max-h-[46vh] overflow-y-auto overscroll-contain pr-1" : ""}`}>
          {dsViec.map(({ q, inc }) => (
            <div key={q.ma_su_co} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="min-w-0 text-[12px] text-slate-600 truncate">
                <b style={{ color: COLOR.navy }}>{inc.id}</b> · {inc.room} · {inc.sensor}
                {q.gio_mo != null && <span className="ml-2 text-slate-400 tabular-nums">mở {q.gio_mo}h</span>}
              </span>
              <button onClick={() => onXuLy(inc)} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50">Xử lý</button>
            </div>
          ))}
          {dsCum.map((c) => (
            <div key={c.ma_cum} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
              <span className="min-w-0 text-[12px] text-slate-600 truncate">
                <b style={{ color: COLOR.navy }}>{c.ma_hien_thi}</b> · {c.ahu || "?"} · {c.loai_cam_bien}
                <span className="ml-2 text-amber-600">chưa có kết luận điều tra</span>
              </span>
              <button onClick={() => onGhiKetLuan(c)} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Ghi kết luận</button>
            </div>
          ))}
        </div>
      )}
      {mo && (conAn > 0 || tatCa) && (
        <button onClick={() => setTatCa(!tatCa)}
          className="mt-2 w-full rounded-xl bg-amber-50/60 px-3 py-1.5 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-100 hover:bg-amber-50">
          {tatCa ? "Thu về danh sách ngắn ▴" : `Xem tất cả ${tong} việc ▾`}
        </button>
      )}
    </div>
  );
}, (a, b) => a.viecCuaToi === b.viecCuaToi && a.cumChoToi === b.cumChoToi);

// Mở lại một hồ sơ đã đóng là THAY ĐỔI hồ sơ GMP — bảng luật bắt buộc lý do,
// modal chỉ phản chiếu luật đó chứ không tự đặt luật.
function ModalMoLai({ row, act, dangChay, onDong, onLuu }) {
  const [lyDo, setLyDo] = useState("");
  const thieu = lyDo.trim().length < 10;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onDong}>
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-semibold" style={{ color: COLOR.navy }}>Mở lại {row.ma_hien_thi} · {row.phong}</h3>
        <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">{row.cam_bien_vi} · đã đóng {row.dong_luc ? new Date(row.dong_luc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"} ({row.nhan_trang_thai || row.trang_thai}). Sự cố sẽ quay lại danh sách đang mở và nhập vào cụm điều tra hiện hành.</p>
        <label className="block mt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lý do mở lại <span className="text-rose-500">*</span></label>
        <textarea className={O_TEXTAREA} rows={3} autoFocus value={lyDo} onChange={(e) => setLyDo(e.target.value)} placeholder="Vì sao hồ sơ này chưa thể khép? (ít nhất 10 ký tự — ghi vào audit)" />
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onDong} className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">Huỷ</button>
          <button disabled={thieu || dangChay} onClick={() => onLuu(lyDo.trim())}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={act?.style || {}}>{dangChay ? "Đang mở lại…" : (act?.label || "Mở lại sự cố")}</button>
        </div>
        {thieu && <p className="mt-2 text-right text-[11px] text-slate-400">Lý do cần ≥ 10 ký tự.</p>}
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
      <div className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 bg-white/95 backdrop-blur px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">Cụm điều tra</p>
            <h3 className="mt-0.5 text-[17px] font-semibold" style={{ color: COLOR.navy }}>{cum.ma_hien_thi} — {cum.ahu || "Không rõ AHU"} · {cum.loai_cam_bien}</h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={onInHoSo} title="Hồ sơ đầy đủ: CAPA + mọi sự cố thành viên + audit — in hoặc lưu PDF cho thanh tra" className="rounded-xl px-2.5 py-1 text-[13px] font-medium text-teal-700 ring-1 ring-teal-200 bg-teal-50 hover:bg-teal-100">In hồ sơ</button>
            <button aria-label="Đóng" onClick={onDong} className="rounded-xl px-2.5 py-1 text-[13px] text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50">Đóng</button>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <span className={`inline-block rounded-lg px-2.5 py-1 text-[11px] leading-tight ${hh ? "text-slate-600 bg-slate-100" : honHop ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50"}`}>{docTenVaiTro(cum.chan_doan, cum.khu_vuc)}</span>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-400 block text-[10px] uppercase tracking-wider">Khu · mở</span><span className="font-semibold text-slate-700 tabular-nums">{cum.khu_vuc} · {Math.round(cum.gio_mo)} giờ</span></div>
            <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-400 block text-[10px] uppercase tracking-wider">Sự cố mở</span><span className="font-semibold text-slate-700 tabular-nums">{cum.su_co_dang_mo}{cum.so_chua_tiep_nhan > 0 && <span className="text-rose-600 font-medium"> · {cum.so_chua_tiep_nhan} chưa tiếp nhận</span>}</span></div>
          </div>
          <div className="rounded-2xl ring-1 ring-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hồ sơ điều tra (CAPA)</p>
              {coQuyenKetLuan && <button onClick={onKetLuan} className="rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">{cum.da_co_ket_luan_qa ? "Sửa kết luận" : "Ghi kết luận"}</button>}
            </div>
            {cum.da_co_ket_luan_qa ? (
              <dl className="mt-2 space-y-2 text-[12px] leading-relaxed">
                <div><dt className="text-slate-400">Nguyên nhân gốc</dt><dd className="text-slate-700">{cum.nguyen_nhan_goc}</dd></div>
                <div><dt className="text-slate-400">Khắc phục</dt><dd className="text-slate-700">{cum.hanh_dong_khac_phuc}</dd></div>
                {cum.hanh_dong_phong_ngua && <div><dt className="text-slate-400">Phòng ngừa</dt><dd className="text-slate-700">{cum.hanh_dong_phong_ngua}</dd></div>}
                {cum.qa_ket_luan && <div><dt className="text-slate-400">Kết luận QA</dt><dd className="text-slate-700">{cum.qa_ket_luan}</dd></div>}
                <p className="text-[10px] text-slate-400">bởi {cum.qa_boi} · {cum.qa_luc ? new Date(cum.qa_luc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</p>
              </dl>
            ) : <p className="mt-2 text-[12px] text-slate-400 italic">Chưa có kết luận QA.</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sự cố đang mở trong cụm</p>
            <div className="mt-2 space-y-2">
              {dsSuCo.length === 0 && <p className="text-[12px] text-slate-400 italic">Không còn sự cố mở (cụm sắp tự đóng).</p>}
              {dsSuCo.map((i) => (
                <div key={i.id} className="rounded-xl ring-1 ring-slate-200 px-3 py-2 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold" style={{ color: COLOR.navy }}>{i.id} · {i.room}</span>
                    {i.mucCanhBao === "SUPPRESSED"
                      ? <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">cảm biến đứng hình</span>
                      : <span className="rounded-lg bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-600">{i.sensor}</span>}
                  </div>
                  <p className="mt-0.5 text-slate-500">{i.status} · kéo dài {i.duration} giờ{i.giaTriGanNhat != null && <> · TB 5′ cuối <b className="tabular-nums text-slate-600">{i.giaTriGanNhat}{i.donVi}</b>{i.cuaSo5p && <span className="tabular-nums"> ({i.cuaSo5p}{i.ngay5p ? ` · ${i.ngay5p}` : ""})</span>}</>}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>, document.body);
}


export default function App() {
  const [tab, setTab] = useState(() => { try { const t = new URLSearchParams(window.location.search).get("tab"); return TABS.some((x) => x.k === t) ? t : "home"; } catch { return "home"; } });
  // KEEP-ALIVE tab nặng (Xu hướng GMP, Sự cố gần đây): đã mở 1 lần thì GIỮ MOUNTED, chỉ ẩn
  // bằng display:none — đổi tab rồi quay lại KHÔNG tải lại từ đầu (giữ cache chuỗi, kết quả AI,
  // bộ lọc, vị trí cuộn trong tab). Kèm cú "resize" khi quay lại để ECharts tự căn lại khung.
  const [daMo, setDaMo] = useState({});
  useEffect(() => {
    setDaMo((v) => (v[tab] ? v : { ...v, [tab]: true }));
    if (tab === "trend" || tab === "recent") { try { requestAnimationFrame(() => window.dispatchEvent(new Event("resize"))); } catch { /* không chặn render */ } }
  }, [tab]);
  const [auditTab, setAuditTab] = useState("audit");   // tab con Nhật ký & SOP: audit | config | sop
  const [cfgTab, setCfgTab] = useState("canhbao");     // tab con Cài đặt: canhbao | phong | phantuyen | hethong
  const [dataSource, setDataSource] = useState(DEFAULT_DATA_SOURCE);   // 'demo' | 'live'
  const LIVE_MAC_DINH = DEFAULT_DATA_SOURCE === "live";   // LIVE → KHÔNG nhồi dữ liệu demo (tránh "thông tin không khớp")
  const [rooms, setRooms] = useState(LIVE_MAC_DINH ? [] : INITIAL_ROOMS);
  const [incidents, setIncidents] = useState(LIVE_MAC_DINH ? [] : INCIDENTS0);
  const [evtKhu, setEvtKhu] = useState("ALL");   // Sự cố: lọc theo khu (ALL/C1/C4/Q2)
  const [evtAhu, setEvtAhu] = useState("ALL");   // Sự cố: lọc theo AHU trong khu đã chọn
  const [cfg, setCfg] = useState({ warn: 20, action: 4 });   // ngưỡng ĐANG ÁP DỤNG (LIVE đọc từ cau_hinh)
  // ③ Bản nháp + kết quả mô phỏng. Kéo thanh trượt KHÔNG còn ghi thẳng xuống production:
  // hai khoá này quyết định giờ nào mở sự cố, giờ nào GỬI MAIL, giờ nào TỰ ĐÓNG.
  const [cfgNhap, setCfgNhap] = useState(null);   // null = chưa sửa gì
  const [moPhong, setMoPhong] = useState(null);   // {dangTai} | {kq} | {loi}
  const [alertUuTien, setAlertUuTien] = useState(["P1", "P2", "P3"]); // cấp độ phòng được cảnh báo (config)
  // Khoá con `canh_bao` đã gỡ 10/07/2026: chưa hàm/view/dòng web nào đọc nó, và nó cũng
  // chưa bao giờ được vẽ ra. Một nút không làm gì còn tệ hơn không có nút.
  const [alertHuong, setAlertHuong] = useState({ DP: { su_co: "CA_HAI" }, RH: { su_co: "CA_HAI" }, T: { su_co: "CA_HAI" } }); // hướng mở sự cố
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [roomModal, setRoomModal] = useState(null);
  const [configHistory, setConfigHistory] = useState(LIVE_MAC_DINH ? [] : [{ t: "08:00 29/5", who: "Quản trị (ADMIN)", change: "Khởi tạo cấu hình hệ thống · 6 phòng" }]);
  const [audit, setAudit] = useState(LIVE_MAC_DINH ? [] : [{ t: "13:05 29/5", who: "Hệ thống", act: "Tạo sự cố", obj: "SC-1042 / C4.R7", detail: "Chênh áp nghiêm trọng" }, { t: "10:18 29/5", who: "Nam (IPC)", act: "Xác nhận bất thường", obj: "SC-1038 / C4.R1", detail: "Kiểm tra thực tế" }]);
  const [ai, setAi] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);   // #5 — modal đổi mật khẩu (mọi vai trò)
  // Ẩn banner "Đang đọc/ghi dữ liệu thật…" cho gọn (nhớ qua localStorage; bấm ô
  // "Nguồn dữ liệu" trên header để hiện/ẩn lại). Khi CÓ LỖI tải banner luôn hiện.
  const [anBannerLive, setAnBannerLive] = useState(() => { try { return localStorage.getItem("bms_an_banner_live") === "1"; } catch { return false; } });
  const doiBannerLive = () => setAnBannerLive((v) => { const m = !v; try { localStorage.setItem("bms_an_banner_live", m ? "1" : "0"); } catch { /* bỏ qua */ } return m; });
  const [kpiModal, setKpiModal] = useState(null); // #3 — modal danh sách phòng theo ô KPI ('dat'|'khong'|'thieu'|'p1')
  const [xemTatCaPhong, setXemTatCaPhong] = useState(false);   // Overview: ưu tiên 1&2 (mặc định) ↔ tất cả phòng
  // Nút bấm từ email: ?sc=&act=&token=. Đọc token NGAY khi tải trang rồi dọn URL
  // (token là bí mật, không để nằm trên thanh địa chỉ / lịch sử trình duyệt).
  // Chưa đăng nhập thì AuthGate chặn màn hình, token vẫn nằm trong ref → xử lý sau khi vào.
  const tokenEmail = useRef(null);
  const [veEmail, setVeEmail] = useState(null);   // { dangTai } | { ve } | { loi }
  // CHẾ ĐỘ THAO TÁC NHẸ (mở web từ nút trong email): bấm nút mail deep-link vào web;
  // TRƯỚC ĐÂY mỗi cú bấm bung TOÀN BỘ dashboard + useLiveData (tải nặng) + phiên mới →
  // bấm nhiều nút = nhiều tab nặng cùng lúc → web lag + refresh-token đa-tab đá nhau =
  // "lỗi đăng nhập". Nay khi mở từ email chỉ dựng màn thao tác nhẹ; dashboard chỉ mount
  // khi người dùng CHỦ ĐỘNG bấm "Mở bảng điều khiển". moTuEmail chốt ở render đầu (effect
  // dọn URL xoá token ngay sau đó).
  const [moTuEmail] = useState(() => { try { return !!new URLSearchParams(window.location.search).get("token"); } catch { return false; } });
  const [vaoDashboard, setVaoDashboard] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const tk = q.get("token");
    if (!tk) return;
    tokenEmail.current = tk;
    q.delete("token"); q.delete("sc"); q.delete("act");
    const sach = window.location.pathname + (q.toString() ? "?" + q.toString() : "") + window.location.hash;
    window.history.replaceState(null, "", sach);
  }, []);
  const role = user?.role; const canManage = canManageRooms(role);
  const isLive = dataSource === "live";
  // #5 — danh sách tab hiển thị theo vai trò
  // Tab hiển thị theo vai trò. LIVE mà vai trò CHƯA xác định (đang tải / lỗi tra) → chỉ
  // các tab xem cơ bản (không lộ Cài đặt/Người nhận khi role=null). RPC vẫn gate server-side.
  // ===== Dữ liệu LIVE từ Supabase (Tổng quan/Sự cố/Nhật ký) =====
  // ④ Release manifest — web cũ + DB mới = nút không hoạt động, không một thông báo nào.
  // Hôm nay đã gặp: rpc_sua_nguong_canh_bao đổi từ 4 tham số xuống 3.
  const [giaoThucLech, setGiaoThucLech] = useState(null);
  useEffect(() => {
    if (!isLive) return;
    let huy = false;
    kiemGiaoThuc().then((r) => { if (!huy && !r.ok) setGiaoThucLech(r.phienBanDb); }).catch(() => {});
    return () => { huy = true; };
  }, [isLive]);

  // P0-3: gắn hook với danh tính phiên. Đổi tài khoản ⇒ hook xoá sạch state trong lúc
  // render và bỏ mọi phản hồi của phiên cũ. Không còn cửa sổ lộ dữ liệu khu người trước.
  // batDau=false khi đang ở chế độ thao tác nhẹ (mở từ email, chưa vào dashboard) → hook
  // KHÔNG tải gì cho tới khi người dùng bấm "Mở bảng điều khiển".
  const cheDoThaoTac = moTuEmail && !vaoDashboard;
  const live = useLiveData(dataSource, { phienId: user?.email || null, batDau: !cheDoThaoTac });
  // Có token email + đã đăng nhập → soi vé (CHỈ ĐỌC). DB kiểm vai trò, khu, hạn
  // token, và cả việc sự cố đã đổi trạng thái từ lúc gửi mail.
  //
  // ⚠ BUG ĐÃ SỬA (10/07/2026) — effect tự huỷ chính nó, modal kẹt ở "Đang kiểm tra liên kết…":
  //   Bản cũ để `veEmail` trong mảng phụ thuộc VÀ gọi setVeEmail({dangTai:true}) ngay trong
  //   effect. Chuỗi sự kiện: set state → veEmail đổi → React chạy hàm dọn dẹp (huy = true)
  //   → effect chạy lại nhưng thoát sớm vì `veEmail` đã có → promise cũ về đích, thấy
  //   huy === true nên KHÔNG set kết quả. Modal đứng mãi ở trạng thái đang tải.
  //   `user` cũng đổi tham chiếu hai lần (theoDoiPhien phát user tối thiểu rồi user đủ vai
  //   trò), nên kể cả bỏ veEmail khỏi deps thì cleanup vẫn bắn và vẫn hỏng.
  //
  // Cách sửa: cờ "đã chạy" và cờ "đã unmount" nằm ở ref, không phải ở deps. Effect chỉ
  //   phụ thuộc điều kiện KHỞI ĐỘNG (isLive, có user), không phụ thuộc kết quả của nó.
  const veDaChay = useRef(false);
  const veDaGo = useRef(false);
  useEffect(() => () => { veDaGo.current = true; }, []);
  useEffect(() => {
    if (!isLive || !user || !tokenEmail.current || veDaChay.current) return;
    veDaChay.current = true;
    setVeEmail({ dangTai: true });
    kiemVeThaoTac(tokenEmail.current).then(({ error, ve }) => {
      if (veDaGo.current) return;              // chỉ bỏ qua khi component đã bị gỡ
      // ve != null ⇒ DB đã trả lời (kể cả từ chối), luôn ưu tiên ngữ cảnh của nó.
      if (ve?.ok) setVeEmail({ ve });
      else if (ve) setVeEmail({ loi: ve.thong_bao || "Liên kết không dùng được.", ve });
      else setVeEmail({ loi: moTaLoi(error) });
    }).catch(() => {
      if (!veDaGo.current) setVeEmail({ loi: "Không kiểm tra được liên kết. Kiểm tra mạng rồi thử lại." });
    });
  }, [isLive, user]);
  const dongVe = () => { tokenEmail.current = null; setVeEmail(null); };
  const chayVe = async (lyDo) => {
    const { data, error } = await thaoTacSuCoTuEmail({ token: tokenEmail.current, lyDo });
    // Lỗi nghiệp vụ vẫn kèm data (goiRPC trả cả hai) — giữ lại để modal bày ngữ cảnh.
    if (error) return { ...(data || {}), ok: false, thong_bao: moTaLoi(error) };
    live.lamMoi({ nen: true });
    return data;
  };
  // Tab hiển thị theo vai trò; LIVE mà vai trò CHƯA xác định → chỉ tab xem cơ bản
  // (khai báo SAU isLive để tránh dùng biến trước khi khởi tạo — TDZ).
  const visibleTabs = useMemo(() => {
    const base = TABS.filter((t) => roleCanSeeTab(role, t.k));
    if (isLive && user && !role) return base.filter((t) => ["home", "tasks", "events", "recent"].includes(t.k));
    return base;
  }, [role, isLive, user]);

  // Đồng bộ phiên đăng nhập thật (magic link) khi ở chế độ live
  useEffect(() => {
    if (!isLive || !HAS_SUPABASE) return;
    let off = () => {};
    layPhienHienTai().then((u) => { if (u) setUser(u); });
    off = theoDoiPhien((u) => setUser(u));
    // Phiên hết hạn giữa chừng (RPC trả CHUA_DANG_NHAP dù UI đang hiện đã đăng nhập):
    // báo rõ + đăng xuất → AuthGate tự hiện màn đăng nhập lại. Chặn lặp bằng cờ 1 lần.
    // ĐA-TAB (mở nhiều nút email cùng lúc): supabase-js xoay refresh-token; một tab có thể
    // TẠM thấy CHUA_DANG_NHAP dù phiên vẫn còn. THỬ KHÔI PHỤC trước khi đăng xuất → tránh
    // đá người dùng ra oan. Chỉ khi khôi phục thất bại mới thực sự đăng xuất.
    let daBao = false, dangKhoiPhuc = false;
    const onHetHan = async () => {
      if (daBao || dangKhoiPhuc) return;
      dangKhoiPhuc = true;
      try {
        const u = await thuKhoiPhucPhien();
        if (u) { setUser(u); return; }   // phiên còn sống (tab khác vừa refresh) → giữ nguyên
      } finally { dangKhoiPhuc = false; }
      if (daBao) return; daBao = true;
      alert("Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại để tiếp tục thao tác.\n(Dữ liệu giám sát không bị ảnh hưởng.)");
      setUser(null); authDangXuat();
    };
    window.addEventListener("bms:phien-het-han", onHetHan);
    const offHetHan = () => window.removeEventListener("bms:phien-het-han", onHetHan);
    const offCu = off; off = () => { offCu && offCu(); offHetHan(); };
    return () => off();
  }, [isLive]);

  // Khi có dữ liệu sự cố LIVE → thay danh sách demo.
  // P0 (rò dữ liệu đổi tài khoản): SET CẢ KHI null. useLiveData đặt live.* = null ngay
  // lúc render khi đổi phiên (phienId đổi); nếu chỉ set khi truthy, App giữ nguyên bản
  // sao phòng/sự cố/nhật ký của khu tài khoản TRƯỚC và vẽ ra. Về [] ngay để không lộ.
  useEffect(() => { if (isLive) setIncidents(live.incidents || []); }, [isLive, live.incidents]);
  useEffect(() => { if (isLive) setConfigHistory(live.configHistory || []); }, [isLive, live.configHistory]);
  useEffect(() => { if (isLive) setRooms(live.rooms || []); }, [isLive, live.rooms]);
  useEffect(() => { if (isLive && live.nguong) { setCfg(live.nguong); setCfgNhap(null); setMoPhong(null); } }, [isLive, live.nguong]);
  // P0 — đổi tài khoản/đăng xuất: ĐÓNG mọi modal + xoá bản sao nhạy cảm NGAY. RLS không
  // dọn được dữ liệu ĐÃ nằm trong bộ nhớ trình duyệt (modal đang mở của khu cũ) → phải tự xoá.
  const emailTruoc = useRef(user?.email);
  useEffect(() => {
    if (emailTruoc.current === user?.email) return;
    emailTruoc.current = user?.email;
    setKpiModal(null); setRoomModal(null); setModal(null); setMoPhong(null);
    if (LIVE_MAC_DINH) { setRooms([]); setIncidents([]); setConfigHistory([]); setAudit([]); }
  }, [user?.email]);
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const ds = await layCanhBaoUuTien(); if (!huy && Array.isArray(ds) && ds.length) setAlertUuTien(ds); })(); return () => { huy = true; }; }, [isLive]);
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const h = await layCanhBaoHuong(); if (!huy && h) setAlertHuong(h); })(); return () => { huy = true; }; }, [isLive]);

  // #1 KHẮC PHỤC "phải F5 mới hiện dữ liệu" đã chuyển vào useLiveData:
  // hook tự nạp lại NGAY khi Supabase phát INITIAL_SESSION/SIGNED_IN (phiên sẵn sàng),
  // nên không còn phụ thuộc thời điểm của React ở đây nữa.

  // #5 — nếu vai trò không được phép xem tab đang mở (vd IPC đang ở Cài đặt khi đăng nhập) → đưa về Tổng quan
  useEffect(() => { if (role && !roleCanSeeTab(role, tab)) setTab("home"); }, [role, tab]);
  // Prefetch chunk biểu đồ (ECharts ~243KB gzip) → mở tab Xu hướng tức thì, không khựng.
  // TRƯỚC ĐÂY chạy NGAY lúc mount (kể cả màn đăng nhập / màn Tổng quan) ⇒ 243KB tải song
  // song CẠNH TRANH với lần tải dữ liệu đầu → vào trang chậm. Nay CHỜ: đã đăng nhập
  // (có vai trò) VÀ màn hình đầu đã có dữ liệu (live.capNhatLuc), rồi mới prefetch lúc rảnh.
  const daWarmCharts = useRef(false);
  useEffect(() => {
    if (daWarmCharts.current || !role || !live.capNhatLuc) return;
    daWarmCharts.current = true;
    let id, tm;
    const warm = () => { import("./components/charts").catch(() => {}); };
    if (typeof requestIdleCallback === "function") id = requestIdleCallback(warm, { timeout: 4000 });
    else tm = setTimeout(warm, 1200);
    return () => { if (id) cancelIdleCallback(id); if (tm) clearTimeout(tm); };
  }, [role, live.capNhatLuc]);

  // Giờ máy chủ UTC+7: trước đây dùng toISOString() (UTC) nên lệch -7h so với nhãn "UTC+7".
  // Định dạng theo đúng múi giờ Asia/Ho_Chi_Minh, không phụ thuộc múi giờ trình duyệt.
  const now = isLive ? vnNow() : "2026-05-29 14:08:22";

  // ===== Phân quyền XEM theo khu: user.khuVuc = mảng khu được xem (null = ADMIN/không giới hạn) =====
  const khuChoPhep = (isLive && user && Array.isArray(user.khuVuc)) ? user.khuVuc : null;
  // Khi bị giới hạn khu: phòng KHÔNG rõ khu → CHẶN (deny-by-default, tránh lọt dữ liệu khu lạ).
  const loKhu = (khu) => !khuChoPhep || (!!khu && khuChoPhep.includes(khu));
  const areaCuaPhong = useMemo(() => { const m = {}; rooms.forEach((r) => { m[r.id] = r.area; }); return m; }, [rooms]);
  const roomsXem = useMemo(() => (khuChoPhep ? rooms.filter((r) => loKhu(r.area)) : rooms), [rooms, khuChoPhep]); // eslint-disable-line react-hooks/exhaustive-deps
  // Khu ưu tiên lấy từ chính sự cố (view đã lọc khu_duoc_xem SERVER-side); chỉ rơi về
  // map phòng khi thiếu. KHÔNG loại sự cố chưa rõ khu — trước 15/07 sự cố về trước
  // danh sách phòng bị lọc SẠCH ⇒ tab Sự cố trống rất lâu với tài khoản giới hạn khu.
  const incidentsXem = useMemo(() => (khuChoPhep ? incidents.filter((i) => { const a = i.khu || areaCuaPhong[i.room]; return !a || loKhu(a); }) : incidents), [incidents, khuChoPhep, areaCuaPhong]); // eslint-disable-line react-hooks/exhaustive-deps
  // ⑤ Owner — ai đang giữ việc (suy từ trạng thái, server tính). 17/07: bỏ SLA hẹn giờ.
  const phuTrachTheoId = useMemo(() => {
    const m = {};
    (isLive && Array.isArray(live.suCoPhuTrach) ? live.suCoPhuTrach : []).forEach((r) => { m[r.ma_su_co] = r; });
    return m;
  }, [isLive, live.suCoPhuTrach]);

  const demoKpis = useMemo(() => ({ dat: roomsXem.filter((r) => { const c = roomCompliance(r); return !r.noData && c >= 80; }).length, khongDat: roomsXem.filter((r) => { const c = roomCompliance(r); return !r.noData && c < 80; }).length, thieuDL: roomsXem.filter((r) => r.noData).length, tong: roomsXem.length }), [roomsXem]);
  // Server đã tự lọc KPI theo quyền khu của phiên đăng nhập (khu_duoc_xem() trong
  // xem_tong_quan) → LIVE luôn dùng số server, kể cả tài khoản bị giới hạn khu.
  const kpis = isLive ? (live.kpis || { dat: 0, khongDat: 0, thieuDL: 0, tong: 0 }) : demoKpis;
  // Mảng 4: chỉ hiện skeleton KPI khi LIVE và chưa có số thật (tránh nháy "0").
  const kpiLoading = isLive && !live.kpis;
  // ═══ P0-1 — LIVE TUYỆT ĐỐI KHÔNG ĐƯỢC RƠI VỀ FIXTURE DEMO ═══
  // Trước 10/07/2026: `live.systemAlerts` null (đang tải HOẶC lỗi) ⇒ hiện SYSTEM_ALERTS
  // demo, trong đó có dòng "Workflow chạy lúc 13:05 — thành công". Nghĩa là khi workflow
  // thật CHẾT, người vận hành đọc được một cảnh báo giả nói nó đang chạy tốt.
  // `sopRows` còn tệ hơn: fallback cả khi DB trả về RỖNG HỢP LỆ ⇒ QA nhìn thấy hồ sơ
  // CAPA giả (DEV-2026-014) như hồ sơ thật. Đây là lỗi toàn vẹn dữ liệu, không phải UI.
  //
  // Bốn trạng thái rõ ràng, không trạng thái nào rơi về demo:
  //   null            → đang tải        (skeleton)
  //   []              → tải xong, rỗng  ("không có cảnh báo")
  //   live.loi        → lỗi             ("Không xác minh được trạng thái")
  const systemAlerts = isLive
    ? (live.systemAlerts ? live.systemAlerts.map((a) => ({ ...a, icon: ICON_CANH_BAO(a) })) : null)
    : SYSTEM_ALERTS;
  const sopRows = isLive ? live.sopRows : SOP;
  const duLieuLoi = isLive && !!live.loi;
  // "Sự cố Mức 1 & 2" — cả phòng trọng yếu (P1) và quan trọng (P2), khớp phạm vi email cảnh báo (canh_bao_muc_uu_tien = P1,P2)
  const suCoP12ds = incidentsXem.filter((i) => (i.priority === "P1" || i.priority === "P2") && i.status !== "Đã khắc phục");
  const p12Open = suCoP12ds.length;
  // #3 — Phân loại phòng để bấm vào ô KPI biết "phòng nào". Quy tắc khớp với view xem_tong_quan:
  //   thiếu DL = mất dữ liệu / chưa có % / dữ liệu quá cũ (trễ > ngưỡng giờ); còn lại đạt khi ≥80%.
  const FRESH_MIN = (isLive && live.sucKhoe?.nguongGio != null ? live.sucKhoe.nguongGio : 2) * 60;
  // 12/08 — MẤT NGUỒN: server (rpc_tinh_trang_nguon qua rpc_kiem_tra_suc_khoe_he_thong)
  // là nơi DUY NHẤT kết luận. Khi đỏ, các ô "Phòng đạt / không đạt" KHÔNG được hiện số:
  // "0 đạt" đọc như "đo được 0 phòng đạt", trong khi sự thật là KHÔNG ĐO ĐƯỢC GÌ.
  const matNguon = isLive && live.sucKhoe?.matDuLieu === true;
  const skTomTat = live.sucKhoe?.tomTat || null;
  const phanLoaiPhong = (r) => {
    const comp = roomCompliance(r);
    if (r.noData || comp == null || (r.agePhut != null && r.agePhut > FRESH_MIN)) return "thieu";
    return comp >= 80 ? "dat" : "khong";
  };
  const nhomPhong = useMemo(() => {
    const g = { dat: [], khong: [], thieu: [] };
    roomsXem.forEach((r) => g[phanLoaiPhong(r)].push(r));   // P0: roomsXem (đã lọc khu), KHÔNG dùng rooms → modal KPI không lộ phòng ngoài khu
    const sx = (a, b) => (roomCompliance(a) ?? -1) - (roomCompliance(b) ?? -1);
    g.dat.sort((a, b) => (roomCompliance(b) ?? 0) - (roomCompliance(a) ?? 0)); // đạt: cao→thấp
    g.khong.sort(sx); g.thieu.sort((a, b) => (a.id < b.id ? -1 : 1));          // không đạt: thấp→cao
    return g;
  }, [roomsXem, isLive, FRESH_MIN]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sự cố Mức 1 & 2 đang mở — để link từ ô KPI (P1 xếp trước P2, rồi theo lúc mở)
  const suCoP12 = [...suCoP12ds].sort((a, b) => (a.priority === b.priority ? String(a.start).localeCompare(String(b.start)) : a.priority === "P1" ? -1 : 1));
  // #9 — "Phòng trọng điểm" xếp theo NGUY CƠ để tập trung theo dõi:
  //   Hành động (3) → Cảnh báo (2) → Cần chú ý (1) → Kiểm soát tốt (0) → thiếu DL (cuối).
  //   Cùng mức cảnh báo thì phòng có % đạt thấp hơn lên trước.
  const sapTheoNguyCo = (a, b) => {
    const la = LEVEL_PRIORITY(roomLevel(a, cfg)), lb = LEVEL_PRIORITY(roomLevel(b, cfg));
    if (la !== lb) return lb - la;                                  // mức cao → lên đầu
    return (roomCompliance(a) ?? 999) - (roomCompliance(b) ?? 999); // cùng mức: % đạt thấp lên trước
  };
  // "Ưu tiên 1 & 2": lọc P1/P2 nhưng vẫn xếp theo nguy cơ
  const phongUuTien = useMemo(
    () => roomsXem.filter((r) => r.priority === "P1" || r.priority === "P2").sort(sapTheoNguyCo),
    [roomsXem, cfg] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // "Tất cả": mọi phòng (trong quyền xem), cũng xếp theo nguy cơ
  const phongTatCa = useMemo(
    () => [...roomsXem].sort(sapTheoNguyCo),
    [roomsXem, cfg] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const phongHienThi = xemTatCaPhong ? phongTatCa : phongUuTien;

  const logConfig = (change) => setConfigHistory((h) => [{ t: now.slice(11, 16) + " 29/5", who: user ? `${user.name} (${user.role})` : "(chưa đăng nhập)", change }, ...h]);
  const apMoi = () => live.lamMoi({ nen: true });
  const baoLoi = (error, fallback) => { if (error) alert(error.thong_bao || error.ma_loi || fallback || "Lỗi kết nối — thử lại."); return !error; };
  const addRoom = async (r) => {
    if (isLive) { const { error } = await themPhong({ p_ma_phong: r.id, p_ten_phong: r.name, p_khu_vuc: r.area, p_ahu: r.ahu, p_muc_uu_tien: r.priority, p_ghi_chu: r.note || null, p_thieu_du_lieu: !!r.noData, p_cam_bien: (r.sensors || []).map((s) => ({ loai: s.k, min: s.min, max: s.max })), p_actor: user?.email || null }); if (baoLoi(error, "Không thêm được phòng")) await apMoi(); return; }
    setRooms((rs) => [...rs, r]); logConfig(`Thêm phòng ${r.id} (${r.name}) · ${r.noData ? "no-data" : r.sensors.map((s) => s.k).join("/")}`);
  };
  const deleteRoom = async (id) => {
    if (isLive) { const { error } = await xoaPhong({ p_ma_phong: id, p_actor: user?.email || null }); if (baoLoi(error, "Không xóa được phòng")) await apMoi(); return; }
    setRooms((rs) => rs.filter((r) => r.id !== id)); logConfig(`Xóa phòng ${id}`);
  };
  // Lưu GỘP các thay đổi từ panel sửa phòng (bản nháp + nút Lưu): chạy tuần tự các RPC
  // cần thiết rồi làm mới MỘT lần — đây là dữ liệu gốc (mốc so sánh) nên sau khi lưu,
  // KPI/thẻ phòng/ngưỡng cảnh báo đều tính lại theo giá trị mới. Trả về true nếu lưu trọn vẹn.
  const saveRoomEdits = async (id, { patch = {}, capNhatGioiHan = [], themSensor = [], boSensor = [] }) => {
    if (isLive) {
      const actor = user?.email || null; const loi = [];
      const ghi = (nhan, error) => { if (error) loi.push(`${nhan}: ${error.thong_bao || error.ma_loi || "lỗi kết nối"}`); };
      if (Object.keys(patch).length) {
        const M = { name: "ten_phong", area: "khu_vuc", ahu: "ahu", priority: "muc_uu_tien", note: "ghi_chu" };
        const p_patch = {}; Object.keys(patch).forEach((k) => { if (M[k]) p_patch[M[k]] = patch[k] === "" ? null : patch[k]; });
        const { error } = await suaPhong({ p_ma_phong: id, p_patch, p_actor: actor }); ghi("Thông tin phòng", error);
      }
      for (const k of boSensor) { const { error } = await xoaCamBien({ p_ma_phong: id, p_loai_cam_bien: k, p_actor: actor }); ghi(`Bỏ cảm biến ${k}`, error); }
      for (const s of themSensor) { const { error } = await themCamBien({ p_ma_phong: id, p_loai_cam_bien: s.k, p_gioi_han_duoi: s.min, p_gioi_han_tren: s.max, p_actor: actor }); ghi(`Thêm cảm biến ${s.k}`, error); }
      for (const s of capNhatGioiHan) { const { error } = await suaGioiHan({ p_ma_phong: id, p_loai_cam_bien: s.k, p_gioi_han_duoi: s.min, p_gioi_han_tren: s.max, p_actor: actor }); ghi(`Giới hạn ${s.k}`, error); }
      await apMoi();
      if (loi.length) { alert(`Một số thay đổi của ${id} CHƯA lưu được:\n• ` + loi.join("\n• ")); return false; }
      return true;
    }
    setRooms((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      let sensors = (r.sensors || []).filter((s) => !boSensor.includes(s.k));
      sensors = sensors.map((s) => { const c = capNhatGioiHan.find((x) => x.k === s.k); return c ? { ...s, min: c.min, max: c.max } : s; });
      themSensor.forEach((t) => { if (!sensors.some((s) => s.k === t.k)) sensors = [...sensors, { k: t.k, min: t.min, max: t.max }]; });
      return { ...r, ...patch, sensors };
    }));
    logConfig(`Lưu phòng ${id}: ${[Object.keys(patch).length && "thông tin phòng", capNhatGioiHan.length && `giới hạn ${capNhatGioiHan.map((s) => s.k).join("/")}`, themSensor.length && `thêm ${themSensor.map((s) => s.k).join("/")}`, boSensor.length && `bỏ ${boSensor.join("/")}`].filter(Boolean).join(" · ")}`);
    return true;
  };
  const handleSaveAI = async ({ scopeType, scopeId, scopeName, sensor, days, text, level }) => {
    if (!isLive) return;
    const { error } = await luuPhanTichAi({ p_scope_type: scopeType, p_scope_id: scopeId, p_ten_scope: scopeName, p_sensor: sensor, p_so_ngay: days, p_noi_dung: text, p_muc_canh_bao: level, p_actor: user?.email || null });
    if (!error) live.lamMoi({ nen: true });
  };
  // ③ Không còn onMouseUp → ghi DB. Phải xem tác động rồi mới áp.
  const cfgHT = cfgNhap || cfg;
  const coThayDoi = !!cfgNhap && (cfgNhap.warn !== cfg.warn || cfgNhap.action !== cfg.action);
  const xemTacDong = async () => {
    if (!coThayDoi) return;
    setMoPhong({ dangTai: true });
    const { data, error } = await moPhongNguong({ warn: cfgNhap.warn, action: cfgNhap.action, soNgay: 7 });
    if (error) { setMoPhong({ loi: error.thong_bao || error.ma_loi || "Không mô phỏng được." }); return; }
    setMoPhong({ kq: data });
  };
  const saveCfg = async (next) => {
    if (isLive) {
      const { error } = await suaNguong({ p_nguong_canh_bao: next.warn, p_nguong_hanh_dong: next.action, p_actor: user?.email || null });
      if (baoLoi(error, "Không lưu được ngưỡng")) { setCfgNhap(null); setMoPhong(null); await apMoi(); }
    } else { logConfig(`Sửa ngưỡng cảnh báo: vượt ngưỡng ${next.warn} · gửi mail khi 10′ cuối ≥ ${next.action}`); setCfg(next); setCfgNhap(null); setMoPhong(null); }
  };
  // Bật/tắt 1 cấp ưu tiên trong phạm vi cảnh báo (phải giữ ≥1 cấp).
  const toggleUuTien = async (p) => {
    if (!canManage) return;
    const cur = alertUuTien.includes(p) ? alertUuTien.filter((x) => x !== p) : [...alertUuTien, p];
    if (!cur.length) return;
    const arr = ["P1", "P2", "P3"].filter((x) => cur.includes(x));
    setAlertUuTien(arr);
    if (isLive) { const r = await datCanhBaoUuTien(arr, user?.email); if (r && r.ok && r.gia_tri) setAlertUuTien(r.gia_tri.split(",")); }
    else logConfig(`Phạm vi cảnh báo theo ưu tiên: ${arr.join(", ")}`);
  };
  // Đổi hướng cảnh báo cho 1 chỉ tiêu × 1 loại ngưỡng.
  const doiHuong = async (chiTieu, loai, giaTri) => {
    if (!canManage) return;
    const next = { ...alertHuong, [chiTieu]: { ...(alertHuong[chiTieu] || {}), [loai]: giaTri } };
    setAlertHuong(next);
    if (isLive) { const r = await datCanhBaoHuong(next, user?.email); if (r && r.ok && r.gia_tri) setAlertHuong(r.gia_tri); }
    else logConfig(`Hướng cảnh báo ${chiTieu}/${loai === "su_co" ? "sự cố" : "cảnh báo sớm"}: ${giaTri}`);
  };

  const requireLogin = () => { if (!user) { setLoginOpen(true); return false; } return true; };
  // P0-2 — Thẻ phòng và modal KPI gọi openApproval(inc) KHÔNG kèm nút. Trước 10/07/2026
  // hàm rơi về firstActionFor() hard-code, và với ADMIN nó trả nút của IPC/Cơ điện mà DB
  // luôn từ chối. Ở LIVE, nút phải giải từ CÙNG một resolver: trạng thái × vai trò × mở/đóng.
  const openApproval = (inc, action) => {
    if (!requireLogin()) return;
    let act = action;
    if (!act) {
      if (isLive) {
        const ds = live.nutThaoTac;
        if (!Array.isArray(ds) || !ds.length || !inc.statusCode) {
          alert("Chưa tải được bộ quy tắc thao tác. Tải lại trang rồi thử lại.");
          return;
        }
        act = nutChoVaiTro(ds, inc.statusCode, role)[0] || null;
      } else {
        act = firstActionFor(inc.status, role);
      }
    }
    setModal({ inc, action: act });
  };
  const handleCommit = async (inc, action, reason) => {
    const who = `${user.name} (${user.role})`;
    if (isLive && inc.dbId) {
      const { error } = await thaoTacSuCo({ dbId: inc.dbId, actionCode: action.code, lyDo: reason, actorEmail: user.email });
      setModal(null);
      if (error) { alert(error.nghiep_vu ? (error.thong_bao || error.ma_loi) : "Lỗi kết nối — thử lại."); return; }
      await live.lamMoi({ nen: true });   // đồng bộ lại từ DB (đã có audit/trail thật)
      return;
    }
    // DEMO
    const nextStatus = action.dong ? "Đã khắc phục" : action.next;
    setIncidents((prev) => prev.map((i) => i.id === inc.id ? { ...i, status: nextStatus, trail: [...i.trail, { t: now.slice(11), who, act: `${action.label}: ${reason}` }] } : i));
    setAudit((a) => [{ t: now.slice(11, 16) + " 29/5", who, act: action.label, obj: `${inc.id} / ${inc.room}`, detail: reason }, ...a]); setModal(null);
  };
  // NGÕ CỤT đã vá (10/07/2026). Hai lỗi chồng nhau:
  //  1. dungCanhBao() gọi thiếu p_tat ⇒ PostgREST báo hàm không tồn tại ⇒ "Dừng CB"
  //     luôn hiện alert lỗi. lich_su_su_co có 0 dòng dung_canh_bao: chưa từng chạy.
  //  2. Kể cả chạy được, nhánh này chỉ gọi RPC khi CHƯA tắt ⇒ "Bật lại" là no-op.
  // Mà khi da_tat_canh_bao = true, sự cố biến mất khỏi view định tuyến email VÀ khỏi
  // WF6 (dead-man's-switch). Không mail, không leo thang, không ai được báo — và
  // không có đường quay lại. Một cú bấm là im lặng vĩnh viễn.
  // ═══ P0-5 — "DỪNG CẢNH BÁO" KHÔNG ĐƯỢC LÀ CÔNG TẮC VĨNH VIỄN ═══
  // da_tat_canh_bao (boolean, không hạn) làm sự cố biến mất khỏi WF8 VÀ khỏi WF6 —
  // chuông báo tử cũng mù. DB đã xoá RPC đó và chặn cứng cột bằng CHECK.
  // Nay: tạm hoãn CÓ HẠN, bắt buộc lý do, ghi ai hoãn và tới bao giờ, tự cảnh báo lại.
  // CRITICAL hoặc phòng P1 chỉ QA/Quản trị được hoãn — máy chủ tự kiểm, không tin giao diện.
  // ═══ CỤM ĐIỀU TRA (10/07/2026) ═══
  // 24 sự cố đang mở là 12 cụm. Cơ điện không sửa "một phòng", họ sửa một AHU; QA không
  // kết luận "một vé", họ kết luận một sai lệch có nguyên nhân gốc và CAPA. Máy chủ ghi
  // một dòng audit cho TỪNG sự cố thuộc cụm — không ai được đóng gộp mà mất dấu vết.
  const cumRows = useMemo(() => (isLive && Array.isArray(live.cumSuCo) ? live.cumSuCo : []), [isLive, live.cumSuCo]);
  // Lọc hai tầng: quyền khu của phiên (khuChoPhep) + bộ lọc Khu/AHU người dùng đang
  // chọn trên tab Sự cố — nếu không, lọc AHU02 mà bảng cụm vẫn bày 12 cụm là lạc nhịp.
  const cumHienThi = useMemo(() => cumRows
    .filter((c) => !khuChoPhep || loKhu(c.khu_vuc))
    .filter((c) => evtKhu === "ALL" || c.khu_vuc === evtKhu)
    .filter((c) => evtAhu === "ALL" || c.ahu === evtAhu), [cumRows, khuChoPhep, evtKhu, evtAhu]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ Cụm điều tra & Mở lại — trạng thái modal/ngăn kéo ═══
  const [cumKetLuan, setCumKetLuan] = useState(null);   // cụm đang ghi kết luận (modal)
  const [cumChiTiet, setCumChiTiet] = useState(null);   // cụm đang mở ngăn kéo
  const [moLai, setMoLai] = useState(null);             // { row, act } — sự cố đóng đang mở lại
  const [dangGhiCum, setDangGhiCum] = useState(false);
  const [khungDongMo, setKhungDongMo] = useState(false);
  const suCoDongXem = useMemo(() => (isLive && Array.isArray(live.suCoDongGanDay) ? live.suCoDongGanDay : [])
    .filter((r) => !khuChoPhep || loKhu(r.khu_vuc))
    .filter((r) => evtKhu === "ALL" || r.khu_vuc === evtKhu)
    .filter((r) => evtAhu === "ALL" || r.ahu === evtAhu), [isLive, live.suCoDongGanDay, khuChoPhep, evtKhu, evtAhu]); // eslint-disable-line react-hooks/exhaustive-deps

  const ghiKetLuanCum = (cum) => { if (!requireLogin()) return; setCumKetLuan(cum); };
  const luuKetLuanCum = async ({ nguyenNhan, khacPhuc, phongNgua, ketLuan }) => {
    setDangGhiCum(true);
    const { error, data } = await ketLuanCum({ maCum: cumKetLuan.ma_cum, nguyenNhan, khacPhuc, phongNgua, ketLuan });
    setDangGhiCum(false);
    if (error) { alert(error.thong_bao || error.ma_loi || "Không ghi được kết luận"); return; }
    if (data && data.ok === false) { alert(data.thong_bao || data.loi); return; }
    setCumKetLuan(null); setCumChiTiet(null);
    await live.lamMoi({ nen: true });
  };
  const xacNhanMoLai = async (lyDo) => {
    setDangGhiCum(true);
    const { error, data } = await thaoTacSuCo({ dbId: moLai.row.ma_su_co, actionCode: moLai.act.code, lyDo, actorEmail: user.email });
    setDangGhiCum(false);
    if (error) { alert(error.thong_bao || error.ma_loi || "Không mở lại được"); return; }
    if (data && data.ok === false) { alert(data.thong_bao || data.loi); return; }
    setMoLai(null); setKhungDongMo(false);
    await live.lamMoi({ nen: true });
  };

  // Bản in hồ sơ cụm: RPC trả trọn bộ (đã lọc khu ở máy chủ), lib dựng HTML tự chứa.
  const inHoSoCum = async (cum) => {
    const { error, data } = await layHoSoCum(cum.ma_cum);
    if (error || !data || data.ok === false) { alert((data && (data.thong_bao || data.loi)) || error?.thong_bao || "Không tải được hồ sơ cụm"); return; }
    moHoSoCumBanIn(data);
  };

  // ═══ VIỆC CỦA TÔI — hiện trên MỌI tab (10/07/2026) ═══
  // Máy chủ đã tính ai phụ trách (vai_tro_phu_trach); banner chỉ bày đúng phần
  // của người đang đăng nhập. Không thêm truy vấn nào: ghép từ
  // suCoPhuTrach + incidents + cumRows đã nạp sẵn. View đã xếp P1 trước, cũ trước.
  const viecCuaToi = useMemo(() => {
    if (!isLive || !role) return [];
    const qh = Array.isArray(live.suCoPhuTrach) ? live.suCoPhuTrach : [];
    return qh.filter((q) => q.vai_tro_phu_trach === role)
      .map((q) => ({ q, inc: incidentsXem.find((i) => i.dbId === q.ma_su_co) }))
      .filter((x) => x.inc);
  }, [isLive, role, live.suCoPhuTrach, incidentsXem]);
  // 17/07: TẠM TẮT hàng chờ "kết luận điều tra cụm" (user: quá nhiều cụm tồn cũ làm
  // ngập Việc của bạn — sẽ xử lý riêng sau). Bật lại: bỏ `false &&`.
  const cumChoToi = useMemo(() => (false && (role === "QA" || role === "ADMIN") && isLive)
    ? cumRows.filter((c) => !c.da_co_ket_luan_qa && (!khuChoPhep || loKhu(c.khu_vuc)))
    : [], [role, isLive, cumRows, khuChoPhep]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSilence = async (id) => {
    if (!requireLogin()) return;
    const inc = incidents.find((i) => i.id === id);
    if (!isLive || !inc?.dbId) {
      setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, silenced: !i.silenced } : i));
      return;
    }
    if (inc.silenced) {
      const { error, data } = await batLaiCanhBao({ dbId: inc.dbId, lyDo: "Bật lại từ bảng điều khiển", actorEmail: user.email });
      if (error) { alert(error.thong_bao || error.ma_loi || "Lỗi"); return; }
      if (data && data.ok === false) { alert(data.thong_bao || data.loi); return; }
      await live.lamMoi({ nen: true });
      return;
    }
    const lyDo = window.prompt("Lý do tạm hoãn cảnh báo (ít nhất 10 ký tự) — sẽ ghi vào hồ sơ:", "");
    if (lyDo == null) return;
    const phutStr = window.prompt("Tạm hoãn bao nhiêu phút? (15–240)", "60");
    if (phutStr == null) return;
    const phut = Number(phutStr);
    if (!Number.isFinite(phut) || phut < 15) { alert("Thời lượng phải từ 15 phút trở lên."); return; }
    const { error, data } = await tamDungCanhBao({ dbId: inc.dbId, phut, lyDo, actorEmail: user.email });
    if (error) { alert(error.thong_bao || error.ma_loi || "Lỗi"); return; }
    if (data && data.ok === false) { alert(data.thong_bao || data.loi); return; }
    if (data?.thong_bao) alert(data.thong_bao);
    await live.lamMoi({ nen: true });
  };
  const openRoomIncident = (room) => { const inc = incidents.find((i) => i.room === room.id && i.status !== "Đã khắc phục"); if (inc) openApproval(inc); else setRoomModal(room); };

  // ===== CỔNG ĐĂNG NHẬP: chỉ tài khoản đã đăng nhập mới dùng được web (đã loại bỏ demo) =====
  if (isLive && giaoThucLech) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAGE_BG }}>
        <div className="max-w-md text-center">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-amber-50 ring-1 ring-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-lg font-semibold" style={{ color: COLOR.ink }}>Bản web không khớp cơ sở dữ liệu</h1>
          <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">
            Trang này chạy hợp đồng <b>{PHIEN_BAN_GIAO_THUC}</b>, còn cơ sở dữ liệu đã ở <b>{giaoThucLech}</b>.
            Một số nút sẽ không hoạt động. Tải lại trang để lấy bản mới nhất.
          </p>
          <button onClick={() => window.location.reload()}
            className="mt-5 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: COLOR.teal }}>
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  // Chặn TOÀN TRANG khi đang LIVE và chưa đăng nhập. Không còn lối "xem thử demo".
  const canChanDangNhap = isLive && !user;
  if (canChanDangNhap) {
    return <AuthGate />;
  }

  // ═══ P0-3 — KHÔNG MỞ DASHBOARD KHI CHƯA BIẾT VAI TRÒ VÀ KHU ═══
  // theoDoiPhien() phát NGAY một người dùng tối thiểu { role: null } để gỡ khoá Web Locks
  // của supabase-js, rồi mới tra vai trò. Trong khoảng đó khuChoPhep = null nghĩa là
  // KHÔNG lọc khu ở phía trình duyệt. Trên máy dùng chung, người vừa đăng nhập có thể
  // thấy dữ liệu còn lại của tài khoản trước. Nay chặn hẳn màn hình.
  if (isLive && user && !role) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAGE_BG }}>
        <div className="max-w-md text-center">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-teal-50 ring-1 ring-teal-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-teal-600" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-lg font-semibold" style={{ color: COLOR.ink }}>Đang xác minh quyền truy cập</h1>
          <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">
            {user.dangTaiVaiTro
              ? <>Đang tra vai trò và khu được xem của <b>{user.email}</b>. Bảng điều khiển chỉ mở sau khi xác minh xong.</>
              : <>Tài khoản <b>{user.email}</b> chưa được phân quyền, hoặc đã bị khoá. Liên hệ Quản trị để được gán vai trò và khu.</>}
          </p>
          {!user.dangTaiVaiTro && (
            <button onClick={() => { setUser(null); if (isLive) authDangXuat(); }}
              className="mt-5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Đăng xuất</button>
          )}
        </div>
      </div>
    );
  }

  // ═══ CHẾ ĐỘ THAO TÁC NHẸ (mở web từ nút trong email) ═══
  // Đã đăng nhập + có vai trò + mở từ email và CHƯA chủ động vào dashboard → chỉ dựng
  // màn thao tác nhẹ (soi vé + xác nhận + kết quả). useLiveData đã tắt (batDau=false) nên
  // KHÔNG có tải nặng nào chạy. Bấm nhiều nút email = nhiều tab nhẹ, hết lag & hết đá phiên.
  if (isLive && user && role && cheDoThaoTac) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: PAGE_BG }}>
        <div className="max-w-md w-full">
          <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-6 text-center" style={cardShadow}>
            <div className="flex items-center gap-3 justify-center">
              <div className="rounded-2xl bg-white px-2 ring-1 ring-slate-200 flex items-center justify-center h-11 w-11 shrink-0"><CpcLogo className="h-8 w-8" /></div>
              <div className="text-left min-w-0">
                <h1 className="text-sm font-bold leading-tight" style={{ color: COLOR.navy }}>Thao tác sự cố từ email</h1>
                <p className="text-[12px] text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <p className="mt-4 text-[13px] text-slate-500 leading-relaxed">
              {veEmail
                ? "Đang mở liên kết thao tác từ email…"
                : "Đã xử lý xong liên kết. Bạn có thể mở bảng điều khiển để xem chi tiết, hoặc đóng tab này."}
            </p>
            <button onClick={() => setVaoDashboard(true)}
              className="mt-5 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: COLOR.teal }}>
              Mở bảng điều khiển
            </button>
            <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
              Mẹo: mỗi nút trong email chỉ cần bấm MỘT lần. Trang này cố tình gọn nhẹ để bấm
              nhiều nút không làm chậm web hay rớt đăng nhập.
            </p>
          </div>
        </div>
        {veEmail && <ModalVeEmail trangThai={veEmail} onDong={dongVe} onChay={chayVe} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG, color: COLOR.ink, fontFamily: "'Inter','Montserrat',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif" }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -top-40 -left-24 w-[28rem] h-[28rem] rounded-full bg-sky-200 opacity-15 blur-3xl" /><div className="absolute top-32 right-0 w-96 h-96 rounded-full bg-teal-200 opacity-10 blur-3xl" /><div className="absolute bottom-0 left-1/4 w-[30rem] h-[30rem] rounded-full bg-cyan-100 opacity-20 blur-3xl" /></div>

      <div className="relative max-w-[1400px] mx-auto px-6 py-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-2xl bg-white px-2.5 ring-1 ring-slate-200 flex items-center justify-center h-[50px] w-[50px] shrink-0" style={cardShadow}><CpcLogo className="h-10 w-10" /></div>
            <div className="flex flex-col justify-center min-w-0"><h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight truncate" style={{ color: COLOR.navy }}>Hệ thống giám sát HVAC phòng sạch GMP</h1><p className="text-[12px] font-semibold tracking-wide mt-0.5" style={{ color: COLOR.teal }}>V/Q team — QLCL</p></div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap justify-end ml-auto">
            {(() => { const ok = (kpis.thieuDL || 0) === 0; return (
              <div className={`hidden md:flex items-center gap-2.5 rounded-2xl bg-white px-4 ring-1 h-[50px] ${ok ? "ring-teal-200" : "ring-amber-200"}`} style={cardShadow}>
                {ok ? <ShieldCheck className="w-4 h-4 text-teal-600" strokeWidth={1.8} /> : <ShieldAlert className="w-4 h-4 text-amber-600" strokeWidth={1.8} />}
                <div className="leading-tight"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Toàn vẹn dữ liệu</p><p className={`text-xs font-semibold ${ok ? "text-teal-600" : "text-amber-600"}`}>{ok ? "Đầy đủ" : `${kpis.thieuDL} phòng thiếu DL`}</p></div>
              </div>
            ); })()}
            {isLive && <SucKhoeWidget sk={live.sucKhoe} dangTai={live.dangTai} />}
            {HAS_SUPABASE ? (
              <button onClick={doiBannerLive} className="flex items-center gap-2.5 rounded-2xl bg-white px-4 ring-1 h-[50px] hover:bg-teal-50/50" style={{ ...cardShadow, borderColor: COLOR.teal }} title={`Đang đọc/ghi dữ liệu thật từ Supabase — bấm để ${anBannerLive ? "hiện" : "ẩn"} dòng mô tả nguồn dữ liệu`}>
                <span className={`w-2.5 h-2.5 rounded-full bg-teal-400 ${live.dangTai ? "animate-pulse" : ""}`} />
                <div className="leading-tight text-left"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Nguồn dữ liệu</p><p className="text-xs font-semibold" style={{ color: COLOR.teal }}>LIVE · Supabase</p></div>
              </button>
            ) : (
              <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 ring-1 ring-amber-200 h-[50px]" style={cardShadow} title="Chưa cấu hình VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <div className="leading-tight text-left"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Nguồn dữ liệu</p><p className="text-xs font-semibold text-amber-600">Chưa cấu hình</p></div>
              </div>
            )}
            <HeaderChip><Clock className="w-4 h-4" style={{ color: COLOR.teal }} strokeWidth={1.8} /><div className="leading-tight"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Giờ máy chủ · UTC+7</p><ServerClock live={isLive} /></div></HeaderChip>
            {user ? <div className="flex items-center gap-2.5 rounded-2xl bg-white pl-2 pr-2 ring-1 ring-slate-200 h-[50px]" style={cardShadow}><div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg,#5ec8d8,#149e90)" }}>{user.name[0]}</div><div className="leading-tight"><p className="text-xs font-semibold" style={{ color: COLOR.ink }}>{user.name}</p><p className="text-[10px] font-medium" style={{ color: COLOR.teal }}>{ROLE_VI[user.role] || user.role}</p></div><button onClick={() => setPwOpen(true)} className="ml-1 rounded-lg p-1.5 hover:bg-slate-100 text-slate-400" title="Đổi mật khẩu"><KeyRound className="w-4 h-4" strokeWidth={1.8} /></button><button onClick={() => { setUser(null); if (isLive) authDangXuat(); }} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400" title="Đăng xuất"><LogOut className="w-4 h-4" strokeWidth={1.8} /></button></div>
              : <button onClick={() => setLoginOpen(true)} className="flex items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white h-[50px]" style={{ background: "linear-gradient(135deg,#1aa899,#149e90)", ...cardShadow }}><LogIn className="w-4 h-4" strokeWidth={1.8} /> Đăng nhập</button>}
          </div>
        </header>

        {/* Mobile: tab TỰ XUỐNG DÒNG (không kéo ngang); desktop giữ 1 hàng cuộn. */}
        <nav className="mt-5"><div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-slate-200 p-1.5 flex gap-1 flex-wrap md:flex-nowrap md:overflow-x-auto" style={cardShadow}>{visibleTabs.map((t) => { const Icon = t.icon; const active = tab === t.k; return <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition ${active ? "text-white" : "text-slate-600 hover:bg-slate-100"}`} style={active ? { background: "linear-gradient(135deg,#1aa899,#149e90)", boxShadow: "0 6px 16px -6px rgba(20,158,144,0.55)" } : {}}><Icon className="w-4 h-4" strokeWidth={1.8} /> {t.label}{t.k === "events" && <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={active ? { background: "rgba(255,255,255,0.25)" } : { background: "rgba(226,103,79,0.16)", color: COLOR.coralDeep }}>{p12Open}</span>}</button>; })}</div></nav>

        <main className="mt-6">
          {isLive && (!anBannerLive || live.loi) && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl bg-teal-50 ring-1 ring-teal-100 px-4 py-2.5 text-[12px] text-slate-600">
              <Wifi className="w-4 h-4 mt-0.5 text-teal-600 shrink-0" strokeWidth={1.8} />
              <span className="flex-1">Đang đọc/ghi dữ liệu thật từ Supabase cho <b>tất cả các tab</b> (Tổng quan · Sự cố · Phòng · Xu hướng · Báo cáo · Nhật ký). <b>Xu hướng &amp; Rủi ro</b> tính trực tiếp từ dữ liệu theo giờ (luôn có sẵn); riêng <b>Báo cáo AI</b> tổng hợp theo ngày sẽ đầy đủ dần khi WF rollup chạy.{live.loi && <span className="text-rose-600"> · Lỗi tải: {live.loi.thong_bao || live.loi.message || "kết nối"}</span>}{live.capNhatLuc && !live.loi && <span className="text-slate-400"> · Cập nhật {live.capNhatLuc.toLocaleTimeString("vi-VN")}</span>}</span>
              {!live.loi && (
                <button onClick={doiBannerLive} title="Ẩn dòng này cho gọn — bấm ô 'Nguồn dữ liệu' trên đầu trang để hiện lại"
                  className="shrink-0 rounded-lg px-1.5 py-0.5 text-slate-400 hover:bg-teal-100/60 hover:text-slate-600 text-[13px] leading-none">✕</button>
              )}
            </div>
          )}
          {/* 16/07 (user): TẠM ẨN banner "Việc của bạn" — chưa cần trong giai đoạn triển khai.
              Bật lại: đổi HIEN_VIEC_CUA_BAN = true (component + dữ liệu giữ nguyên). */}
          {HIEN_VIEC_CUA_BAN && isLive && user && role && <ViecCuaBan viecCuaToi={viecCuaToi} cumChoToi={cumChoToi} onXuLy={openApproval} onGhiKetLuan={ghiKetLuanCum} />}
          {tab === "home" && (
            <div className="space-y-5">
              <Card className="px-5 sm:px-7 py-5 sm:py-6 overflow-hidden" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 55%,#E6F1FA)" }}><p className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: COLOR.teal }}>Tri thức · Tuân thủ · Toàn vẹn dữ liệu</p><h2 className="mt-1 text-xl sm:text-2xl font-semibold" style={{ color: COLOR.navy }}>Giám sát chênh áp · độ ẩm · nhiệt độ theo thời gian thực</h2><div className="mt-4 flex gap-2 flex-wrap text-xs">{[`${kpis.tong} phòng giám sát`, khuChoPhep ? `Phạm vi xem: khu ${khuChoPhep.join(" · ")}` : "3 khu: C1 · C4 · Q2", "8 AHU", "Cập nhật mỗi giờ"].map((p) => <span key={p} className="bg-white ring-1 ring-slate-200 text-slate-600 px-3 py-1.5 rounded-full font-medium">{p}</span>)}</div>{!user && <div className="mt-4 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-3 py-1.5 rounded-xl font-medium"><LogIn className="w-3.5 h-3.5" strokeWidth={1.8} /> Đăng nhập để thao tác theo phân quyền.</div>}</Card>
              {/* 12/08 — BĂNG MẤT NGUỒN ĐẦU TRANG. Sự cố 09:39 (FMS + n8n cùng câm) cho thấy
                  người trực mở trang ra là thấy ngay các ô KPI đầy số, phải cuộn xuống thẻ
                  chênh áp mới biết nguồn đã chết. Trạng thái nguồn phải nằm TRÊN mọi con số
                  mà nó chi phối, không phải nấp trong tooltip của đèn header. */}
              {matNguon && (
                <div className="rounded-2xl bg-rose-50 px-4 sm:px-5 py-3.5 ring-1 ring-rose-300">
                  <p className="text-[13px] font-bold text-rose-800 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 shrink-0" strokeWidth={2} /> MẤT NGUỒN SỐ LIỆU — các con số bên dưới KHÔNG phản ánh hiện tại
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-rose-900">
                    {skTomTat || "Nguồn dữ liệu không cập nhật."} Hệ <b>không kết luận đạt/không đạt</b> trên số đã cũ — mọi phòng chuyển sang ô “Thiếu dữ liệu”.
                    Kiểm FMS và n8n ngay: nguồn treo thì phải có người khởi động lại, hệ không tự khỏi.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between px-1"><SectionTitle icon={Clock} hint="khung giờ chốt gần nhất · cập nhật theo giờ">Tổng quan trạng thái — 1 giờ gần nhất</SectionTitle></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={CheckCircle2} label="Phòng đạt" value={matNguon ? "—" : kpis.dat} total={matNguon ? null : kpis.tong} sub={matNguon ? "mất nguồn — không kết luận" : "tuân thủ ≥ 80% (1h)"} accent={{ txt: "text-teal-600", bg: "bg-teal-50", glow: "bg-teal-200" }} onClick={() => setKpiModal("dat")} loading={kpiLoading} />
                <KpiCard icon={AlertTriangle} label="Phòng không đạt" value={matNguon ? "—" : kpis.khongDat} total={matNguon ? null : kpis.tong} sub={matNguon ? "mất nguồn — không kết luận" : "tuân thủ < 80%"} accent={{ txt: "text-rose-600", bg: "bg-rose-50", glow: "bg-rose-200" }} onClick={() => setKpiModal("khong")} loading={kpiLoading} />
                <KpiCard icon={HelpCircle} label="Thiếu dữ liệu" value={kpis.thieuDL} total={kpis.tong} sub="không coi là đạt" accent={{ txt: "text-amber-600", bg: "bg-amber-50", glow: "bg-amber-200" }} onClick={() => setKpiModal("thieu")} loading={kpiLoading} />
                <KpiCard icon={Activity} label="Sự cố Nghiêm trọng mở" value={p12Open} sub="phòng trọng yếu & quan trọng" accent={{ txt: "text-sky-600", bg: "bg-sky-50", glow: "bg-sky-200" }} onClick={() => setKpiModal("p1")} loading={kpiLoading} />
              </div>
              {/* Chú thích cách tính — tránh hiểu nhầm "phòng nhìn đẹp mà vẫn không đạt" */}
              <p className="text-[11px] text-slate-400 px-1 leading-relaxed -mt-2">
                <b className="text-slate-500">Cách tính:</b> tuân thủ của phòng = 100% − %thời gian ngoài khoảng (OOS) của <b className="text-slate-500">cảm biến kém nhất</b> (DP/RH/T) trong <b className="text-slate-500">khung giờ chốt gần nhất</b> — chỉ cần một chỉ tiêu lệch là cả phòng bị tính không đạt, dù các chỉ tiêu khác vẫn đẹp. Phòng <b className="text-slate-500">đạt</b> khi tuân thủ ≥ 80% <b className="text-slate-500">và</b> dữ liệu còn tươi (chốt giờ cách hiện tại ≤ {Math.round(FRESH_MIN / 60)}h); phòng thiếu dữ liệu/dữ liệu quá cũ không được tính là đạt.{khuChoPhep ? <> Số liệu tính trong phạm vi được xem của tài khoản: <b className="text-slate-500">khu {khuChoPhep.join(", ")}</b>.</> : null}
              </p>
              <TheDungHinhTongQuan isLive={isLive} khuChoPhep={khuChoPhep} onXemChiTiet={roleCanSeeTab(role, "sensors") ? () => setTab("sensors") : null} />
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
                <div><div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2"><SectionTitle icon={CircleDot} hint={xemTatCaPhong ? "tất cả phòng" : "chỉ ưu tiên 1 & 2"}>Phòng trọng điểm cần theo dõi</SectionTitle><div className="flex items-center gap-2"><div className="flex rounded-xl ring-1 ring-slate-200 overflow-hidden text-[11px] font-medium"><button onClick={() => setXemTatCaPhong(false)} className={`px-2.5 py-1 ${!xemTatCaPhong ? "text-white" : "text-slate-500 bg-white hover:bg-slate-50"}`} style={!xemTatCaPhong ? { backgroundColor: COLOR.teal } : {}}>Ưu tiên 1 &amp; 2</button><button onClick={() => setXemTatCaPhong(true)} className={`px-2.5 py-1 ${xemTatCaPhong ? "text-white" : "text-slate-500 bg-white hover:bg-slate-50"}`} style={xemTatCaPhong ? { backgroundColor: COLOR.teal } : {}}>Tất cả</button></div><span className="text-[11px] text-slate-500">{phongHienThi.length}/{roomsXem.length} phòng</span></div></div>{phongHienThi.length === 0 ? <Card className="p-6 text-center text-[13px] text-slate-500">{xemTatCaPhong ? "Chưa có phòng nào." : "Không có phòng ưu tiên 1 hoặc 2 nào đang hoạt động."}</Card> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{phongHienThi.map((r) => <RoomCard key={r.id} room={r} cfg={cfg} onDetail={setRoomModal} onIncident={openRoomIncident} incident={incidentsXem.find((i) => i.room === r.id && i.status !== "Đã khắc phục") || null} />)}</div>}</div>
                <aside className="space-y-5">
                  {isLive ? (
                  <Card className="p-5" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 60%,#E6F1FA)" }}><div className="flex items-center justify-between"><SectionTitle icon={Sparkles}>Tóm tắt hệ thống</SectionTitle>{live.capNhatLuc && !live.loi && <span className="text-[10px] text-slate-400">Cập nhật {live.capNhatLuc.toLocaleTimeString("vi-VN")}</span>}</div><p className="mt-3 text-[13px] leading-relaxed text-slate-600">{matNguon ? <><b className="text-rose-600">MẤT NGUỒN SỐ LIỆU.</b> {skTomTat || ""} Không kết luận đạt/không đạt cho {kpis.tong} phòng cho tới khi nguồn trở lại.{p12Open > 0 && <> Còn <b className="text-rose-600">{p12Open}</b> sự cố Nghiêm trọng đang mở.</>}</> : live.kpis ? <>Đang giám sát <b style={{ color: COLOR.navy }}>{kpis.tong}</b> phòng: <span className="text-teal-700 font-semibold">{kpis.dat} đạt</span> · <span className="text-rose-600 font-semibold">{kpis.khongDat} không đạt</span> · <span className="text-amber-600 font-semibold">{kpis.thieuDL} thiếu DL</span>. {p12Open > 0 ? <><b className="text-rose-600">{p12Open}</b> sự cố Nghiêm trọng đang mở — ưu tiên xử lý.</> : "Không có sự cố Nghiêm trọng đang mở."}</> : (live.loi ? "Không tải được dữ liệu — kiểm tra kết nối/đăng nhập." : "Đang tải dữ liệu…")}</p><p className="mt-2 text-[11px] text-slate-400">Phân tích AI chi tiết ở tab Báo cáo · Xu hướng GMP.</p></Card>
                  ) : (
                  <Card className="p-5" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 60%,#E6F1FA)" }}><div className="flex items-center justify-between"><SectionTitle icon={Sparkles}>Phân tích AI</SectionTitle><span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-full"><TrendingDown className="w-3 h-3" strokeWidth={2} /> Δ 7 ngày −6%</span></div><p className="mt-3 text-[13px] leading-relaxed text-slate-600"><span className="font-semibold" style={{ color: COLOR.navy }}>AHU-K01</span> cần kiểm tra ưu tiên — C4.R7, C4.R1 đều kém, nghi lỗi quạt/filter.</p></Card>
                  )}
                  <Card className="p-5"><SectionTitle icon={Bell}>Cảnh báo hệ thống</SectionTitle><div className="space-y-2 mt-3">{duLieuLoi ? <div className="rounded-2xl bg-rose-50 ring-1 ring-rose-100 px-3 py-3 text-[12px] text-rose-700"><b>Không xác minh được trạng thái hệ thống.</b><p className="text-[11px] text-rose-600/80 mt-1">Máy chủ không trả lời. Đây KHÔNG có nghĩa là hệ thống đang bình thường — hãy kiểm tra n8n và Supabase.</p></div> : systemAlerts === null ? <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />  : systemAlerts.length === 0 ? <p className="text-[12px] text-slate-500 py-2">Không có cảnh báo hệ thống nào.</p>  : systemAlerts.map((a, i) => { const Icon = a.icon || ICON_CANH_BAO(a); return <div key={i} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ${STATUS[a.kind].bg} ring-1 ring-slate-200/60`}><Icon className={`w-4 h-4 mt-0.5 shrink-0 ${STATUS[a.kind].txt}`} strokeWidth={1.8} /><div className="leading-tight"><p className="text-xs text-slate-700 font-medium">{a.text}</p><p className="text-[10px] text-slate-500 mt-0.5">{a.sub}</p></div></div>; })}</div></Card>
                </aside>
              </div>
            </div>
          )}

          {/* ═══ TAB NHIỆM VỤ (17/07 — yêu cầu user: "ai cũng thấy") ═══
              Vé đang ở bộ phận nào, ai đang chậm (KiemSoatXuLy — mọi vai trò đều xem
              được) + danh sách việc đang chờ đúng vai trò của mình, bấm xử lý ngay. */}
          {tab === "tasks" && (
            <div className="space-y-5">
              <SectionTitle icon={ClipboardList} hint={user ? `vai trò: ${ROLE_VI[role] || "chưa phân quyền"}` : "đăng nhập để thao tác"}>Nhiệm vụ — vé đang ở đâu, ai đang chậm</SectionTitle>
              {isLive && Array.isArray(live.suCoPhuTrach) && live.suCoPhuTrach.length === 0 && (
                <Card className="p-6 text-center"><CheckCircle2 className="mx-auto w-7 h-7" style={{ color: COLOR.teal }} strokeWidth={1.8} /><p className="mt-2 text-[14px] font-semibold" style={{ color: COLOR.navy }}>Không có vé nào đang mở</p><p className="mt-1 text-[12px] text-slate-500">Tất cả sự cố đã được xử lý hoặc hệ đã tự đóng.</p></Card>
              )}
              <KiemSoatXuLy rows={isLive ? (live.suCoPhuTrach || []) : []} />
              {isLive && user && role && (
                <Card className="p-4 sm:p-5">
                  <SectionTitle icon={User} hint="các vé đang chờ đúng vai trò của bạn bấm nút — bấm Xử lý để thao tác ngay">Việc của bạn — {ROLE_VI[role] || role}</SectionTitle>
                  {viecCuaToi.length === 0 && cumChoToi.length === 0 ? (
                    <p className="mt-3 text-[13px] text-slate-500">Không có vé nào đang chờ vai trò của bạn. 👍</p>
                  ) : (
                    <div className="mt-3 space-y-1.5">
                      {viecCuaToi.map(({ q, inc }) => (
                        <div key={q.ma_su_co} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                          <span className="min-w-0 text-[12.5px] text-slate-600 truncate">
                            <b style={{ color: COLOR.navy }}>{inc.id}</b> · {inc.room} · {inc.sensor}
                            <span className={`ml-2 ${q.dang_cham ? "text-rose-600 font-medium" : "text-slate-400"}`}>{q.dang_cham ? `im lặng ${fmtPhut(q.phut_im_lang)}/${fmtPhut(q.nguong_phut)}${q.da_bao_truc ? " · đã lên Trực" : ""}` : `mở ${q.gio_mo}h · trong nhịp`}</span>
                          </span>
                          <button onClick={() => openApproval(inc)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-50">Xử lý</button>
                        </div>
                      ))}
                      {cumChoToi.map((c) => (
                        <div key={c.ma_cum} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                          <span className="min-w-0 text-[12.5px] text-slate-600 truncate">
                            <b style={{ color: COLOR.navy }}>{c.ma_hien_thi}</b> · {c.ahu || "?"} · {c.loai_cam_bien}
                            <span className="ml-2 text-amber-600">chưa có kết luận điều tra</span>
                          </span>
                          <button onClick={() => ghiKetLuanCum(c)} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50">Ghi kết luận</button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
              <DanhGiaHieuQuaCanhBao isLive={isLive} />
              <HuongDanEmailNut />
              <Card className="p-4 sm:p-5">
                <SectionTitle icon={GitBranch} hint="mỗi bộ phận một làn · mũi tên mang màu người bấm nút · kéo ngang để xem hết">Sơ đồ vòng đời chi tiết — ai làm gì, lúc nào</SectionTitle>
                <div className="mt-3">
                  <React.Suspense fallback={<div className="rounded-2xl bg-slate-50 animate-pulse" style={{ height: 420 }} />}>
                    <SoDoVongDoi />
                  </React.Suspense>
                </div>
              </Card>
              {!isLive && <Card className="p-6 text-center text-[13px] text-slate-500">Tab Nhiệm vụ chỉ hoạt động ở chế độ LIVE (đọc dữ liệu thật).</Card>}
            </div>
          )}

          {tab === "events" && (() => {
            const metaPhong = {}; (rooms || []).forEach((r) => { metaPhong[r.id] = { area: r.area, ahu: r.ahu }; });
            const incKhu = (i) => i.khu || (metaPhong[i.room] || {}).area || "";
            const incAhu = (i) => (metaPhong[i.room] || {}).ahu || "";
            // Cặp khu|AHU (AHU01 có ở cả C1 lẫn C4 nên tên AHU trần là nhập nhằng);
            // đứng ở "Tất cả" vẫn chọn được AHU — chọn phát là áp luôn cả khu.
            const ahuPairs = [...new Set((roomsXem || []).filter((r) => (evtKhu === "ALL" || r.area === evtKhu) && r.ahu).map((r) => `${r.area}|${r.ahu}`))].sort();
            const incFiltered = incidentsXem.filter((i) => (evtKhu === "ALL" || incKhu(i) === evtKhu) && (evtAhu === "ALL" || incAhu(i) === evtAhu));
            // Gom theo AHU — khớp cách email của Cơ điện được gom (mỗi AHU một mail),
            // nên đối chiếu web ↔ email không lệch. Thứ tự NHÓM: AHU chứa phòng quan
            // trọng nhất (P1) đang gặp sự cố lên đầu, đồng hạng thì nhiều CRITICAL hơn
            // lên trước; trong nhóm: P1 → P2 → P3, rồi theo lúc bắt đầu.
            const uuTienSo = (p) => (p === "P1" ? 1 : p === "P2" ? 2 : 3);
            const cumAhu = (i) => `${incKhu(i) || "?"} / ${incAhu(i) || "Không rõ AHU"}`;
            const hangCum = {};
            incFiltered.forEach((i) => {
              const k = cumAhu(i); const h = hangCum[k] || (hangCum[k] = { min: 9, crit: 0 });
              h.min = Math.min(h.min, uuTienSo(i.priority));
              if (i.mucCanhBao === "CRITICAL") h.crit++;
            });
            const incSorted = [...incFiltered].sort((a, b) => {
              const ka = cumAhu(a), kb = cumAhu(b);
              if (ka !== kb) return hangCum[ka].min - hangCum[kb].min || hangCum[kb].crit - hangCum[ka].crit || ka.localeCompare(kb);
              return uuTienSo(a.priority) - uuTienSo(b.priority) || String(a.start).localeCompare(String(b.start));
            });
            const dsNut = isLive ? live.nutThaoTac : null;
            // luatSanSang = ĐÃ BIẾT bộ luật (mảng, kể cả rỗng). null = đang tải hoặc lỗi.
            const luatSanSang = Array.isArray(dsNut) && dsNut.length > 0;
            const luatHong = isLive && (dsNut === null || !!live.loiNut);
            const locChip = (v, label, on, click) => <button key={v} onClick={click} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${on ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`} style={on ? { backgroundColor: COLOR.teal } : {}}>{label}</button>;
            // Nút hành động của 1 sự cố — DÙNG CHUNG cho bảng (desktop) và thẻ (mobile)
            // để 2 giao diện không bao giờ lệch luật.
            const tinhNut = (inc) => {
              const acts = luatSanSang ? nutKhopTrangThai(dsNut, inc.statusCode)
                         : isLive ? [] : (STATUS_ACTIONS[inc.status] || []);
              const terminal = luatSanSang || !isLive ? acts.length === 0 : false;
              const myActs = !user ? [] : luatSanSang ? nutChoVaiTro(dsNut, inc.statusCode, role)
                         : isLive ? [] : acts.filter((a) => a.roles.includes(role));
              const choAi = luatSanSang ? [...new Set(acts.map((a) => a.vai_tro))]
                         : isLive ? [] : rolesOfStatus(inc.status);
              return { acts, terminal, myActs, choAi };
            };
            // 12/08 — TUỔI SỐ LIỆU PHẢI ĐỨNG NGANG HÀNG VỚI MỨC CẢNH BÁO khi mất nguồn.
            // Vé SC-4177 hô CRITICAL bằng số đo lúc 08:00 (186 phút trước): chữ CRITICAL
            // to và đỏ, còn tuổi số liệu là chữ xám nhỏ cuối dòng ⇒ người trực đọc lướt
            // tưởng phòng ĐANG lệch ngay lúc này. Sự thật là KHÔNG BIẾT — có thể tệ hơn,
            // có thể đã về đạt. Mất nguồn thì nhãn hiện với MỌI tuổi, không chờ quá 75′.
            const nhanSoCu = (inc) => {
              const t = inc.tuoiDuLieuPhut;
              if (t == null || (!matNguon && t <= 75)) return null;
              const txt = t < 60 ? `${t}′` : `${(t / 60).toFixed(1)}h`;
              return <span title="Số đo cuối cùng lấy được. Nguồn đang mất nên KHÔNG khẳng định được tình trạng hiện tại của phòng." className="ml-1.5 align-middle inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-800 ring-1 ring-amber-300 whitespace-nowrap">số liệu {txt} trước</span>;
            };
            return (
            <div className="space-y-5">
              <SectionTitle icon={AlertOctagon} hint={user ? `vai trò: ${ROLE_VI[role]}` : "đăng nhập để thao tác"}>Sự cố đang xử lý</SectionTitle>
              {/* Vé VẪN hiện khi mất nguồn là ĐÚNG — mất dữ liệu không xoá được sự kiện đã
                  xảy ra, đóng vé vì hết dữ liệu là làm mất hồ sơ GMP (bài học 14/07). Cái
                  phải nói rõ là: mức đang hiện dựa trên số CŨ, và khoảng mù này KHÔNG mở
                  được vé mới vì WF1 không chạy. */}
              {matNguon && (
                <div className="rounded-2xl bg-rose-50 px-4 sm:px-5 py-3.5 ring-1 ring-rose-300">
                  <p className="text-[13px] font-bold text-rose-800 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 shrink-0" strokeWidth={2} /> MẤT NGUỒN SỐ LIỆU — mức cảnh báo bên dưới dựa trên số đo CŨ
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-rose-900">
                    {skTomTat || "Nguồn dữ liệu không cập nhật."} Vé đang mở <b>vẫn giữ nguyên</b> (sự cố đã xảy ra là có thật, hệ không tự đóng khi thiếu dữ liệu),
                    nhưng <b>không khẳng định được phòng hiện giờ ra sao</b> — có thể đã nặng hơn, có thể đã về đạt.
                    Nguy hơn: trong lúc mất nguồn hệ <b>không mở được vé mới</b>, phòng lệch chuẩn lúc này sẽ không có ai báo.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Lọc khu</span>
                {locChip("ALL", "Tất cả", evtKhu === "ALL", () => { setEvtKhu("ALL"); setEvtAhu("ALL"); })}
                {(khuChoPhep || DS_KHU).map((k) => locChip(k, `Khu ${k}`, evtKhu === k, () => { setEvtKhu(k); setEvtAhu("ALL"); }))}
                {ahuPairs.length > 0 && (
                  <select value={evtAhu === "ALL" ? "ALL" : `${evtKhu}|${evtAhu}`} onChange={(e) => { const v = e.target.value; if (v === "ALL") { setEvtAhu("ALL"); } else { const [k, a] = v.split("|"); setEvtKhu(k); setEvtAhu(a); } }} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] text-slate-700 outline-none ml-1">
                    <option value="ALL">AHU: tất cả</option>
                    {ahuPairs.map((p) => { const [k, a] = p.split("|"); return <option key={p} value={p}>{evtKhu === "ALL" ? `Khu ${k} · ${a}` : a}</option>; })}
                  </select>
                )}
                <span className="text-[11px] text-slate-400 ml-auto tabular-nums">{incFiltered.length}/{incidentsXem.length} sự cố</span>
              </div>
              <Card className="p-2 sm:p-4">{isLive && live.dangTai && incidentsXem.length === 0 ? (
                /* ĐANG TẢI + chưa có gì: skeleton — không được hiện "Chưa có sự cố nào"
                   khi thật ra là đang chờ mạng (15/07: gây hiểu lầm hệ trống vé). */
                <div className="p-2 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
              ) : incFiltered.length === 0 ? (incidentsXem.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#E6F4F1" }}><CheckCircle2 className="w-6 h-6" style={{ color: COLOR.teal }} strokeWidth={1.8} /></div>
                  <p className="mt-3 text-[14px] font-semibold" style={{ color: COLOR.navy }}>Chưa có sự cố nào đang mở</p>
                  <p className="mt-1.5 text-[12px] text-slate-500 max-w-md mx-auto leading-relaxed">Sự cố được <b>tự động tạo</b> khi luồng n8n (WF1) phát hiện mức <b className="text-amber-600">Cảnh báo</b> hoặc <b className="text-rose-600">Hành động</b> từ dữ liệu theo giờ và ghi vào Supabase. Danh sách trống nghĩa là tất cả phòng đang trong ngưỡng — hoặc chưa có dữ liệu kích hoạt.</p>
                  {isLive && <p className="mt-3 text-[11px] text-slate-400 max-w-md mx-auto">Nếu bạn chắc chắn đang có cảnh báo mà vẫn trống, kiểm tra: WF1 có đang chạy theo lịch · ngưỡng trong <b>Cài đặt</b> · và bạn đã <b>đăng nhập</b> đúng vai trò để xem.</p>}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-[13px] text-slate-500">Không có sự cố khớp bộ lọc{evtKhu !== "ALL" ? ` · Khu ${evtKhu}` : ""}{evtAhu !== "ALL" ? ` · ${evtAhu}` : ""}. <button onClick={() => { setEvtKhu("ALL"); setEvtAhu("ALL"); }} className="text-teal-600 font-semibold underline">Bỏ lọc</button></div>
              )) : (<>
              {/* ═══ MOBILE (<md): thẻ dọc — KHÔNG kéo ngang ═══ */}
              <div className="md:hidden space-y-2 p-1">
                {incSorted.map((inc, idx) => {
                  const { terminal, myActs, choAi } = tinhNut(inc);
                  const q = phuTrachTheoId[inc.dbId];
                  const moCum = idx === 0 || cumAhu(incSorted[idx - 1]) !== cumAhu(inc);
                  return (
                    <React.Fragment key={inc.id}>
                      {moCum && <p className="pt-2 pb-0.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{cumAhu(inc)}</p>}
                      <div className={`rounded-2xl ring-1 ring-slate-200 bg-white p-3 ${inc.silenced ? "opacity-60" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate"><b style={{ color: COLOR.navy }}>{inc.id}</b><span className="text-slate-600"> · {inc.room}</span>{inc.cumHienThi && <span className="ml-1.5 rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 tabular-nums">{inc.cumHienThi}</span>}</span>
                          <span className="shrink-0 flex items-center gap-1.5"><MucBadge p={inc.priority} /><span className="text-[12px] text-amber-600 font-medium tabular-nums">{inc.duration}h</span></span>
                        </div>
                        <p className="mt-1 text-[12px] text-slate-600">
                          {inc.sensor}{inc.huong && <span className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${inc.huong === "CAO" ? "bg-rose-50 text-rose-600" : inc.huong === "THAP" ? "bg-sky-50 text-sky-600" : "bg-amber-50 text-amber-600"}`}>{inc.huong === "CAO" ? "↑ cao" : inc.huong === "THAP" ? "↓ thấp" : "↕ cả 2"}</span>}
                          {inc.mucCanhBao === "SUPPRESSED" && <span className="ml-1.5 rounded-lg bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-500">cảm biến đứng hình</span>}
                          {nhanSoCu(inc)}
                        </p>
                        {inc.giaTriGanNhat != null && <p className="text-[11px] text-slate-400 mt-0.5">TB 5′ cuối <b className="text-slate-600 tabular-nums">{inc.giaTriGanNhat}{inc.donVi}</b>{inc.gioiHanDuoi != null && <> · yêu cầu <span className="tabular-nums">{inc.gioiHanDuoi}–{inc.gioiHanTren}</span></>}{(inc.mucGanNhat === "NORMAL" || inc.mucGanNhat === "WARNING") && <span className="text-emerald-600"> · đã về ngưỡng</span>}</p>}
                        <p className="mt-1.5 text-[12px] flex items-center gap-1.5 flex-wrap">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inc.status]}`} /><span className="text-slate-700 font-medium">{inc.status}</span>
                          {q && <span className={`text-[11px] ${q.dang_cham ? "text-rose-600 font-medium" : "text-slate-400"}`}>· {tenVaiTro(q.vai_tro_phu_trach, inc.room)}{q.dang_cham ? ` im lặng ${fmtPhut(q.phut_im_lang)}/${fmtPhut(q.nguong_phut)}${q.da_bao_truc ? " · đã báo Trực" : ""}` : " phụ trách"}</span>}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {terminal ? <span className="text-teal-600 text-[12px] font-medium py-1">Đã khắc phục</span>
                            : !user ? <button onClick={() => setLoginOpen(true)} className="text-[12px] font-medium rounded-xl px-3 py-1.5 ring-1 ring-slate-200 text-slate-500 bg-white">Đăng nhập để thao tác</button>
                            : myActs.length ? myActs.map((a) => <button key={a.code} onClick={() => openApproval(inc, a)} className={`text-[12px] font-medium rounded-xl px-3 py-1.5 ring-1 ring-black/5 ${a.color || ""}`} style={a.style || {}}>{a.label}</button>)
                            : <span className="text-[11px] text-slate-400 py-1">Chờ {choAi.map((r) => tenVaiTro(r, inc.room)).join(" / ")}</span>}
                          {user && (role === "ADMIN" || role === "LOT" || role === "QA") && <button onClick={() => toggleSilence(inc.id)} className={`text-[12px] font-medium rounded-xl px-3 py-1.5 ring-1 ${inc.silenced ? "text-slate-500 bg-slate-100 ring-slate-200" : "text-rose-600 bg-rose-50 ring-rose-200"}`}>{inc.silenced ? "Bật lại" : "Tạm hoãn"}</button>}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
              {/* ═══ DESKTOP (md+): bảng đầy đủ như cũ ═══ */}
              <div className="hidden md:block overflow-x-auto"><table className="w-full min-w-[1024px] text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Mã", "Cụm", "Phòng", "Mức", "Chỉ tiêu", "Bắt đầu", "Kéo dài", "Trạng thái", "Phụ trách", "Cảnh báo", "Hành động"].map((h) => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{incSorted.map((inc, idx) => {
                  // P0-2: ở LIVE, nếu chưa biết bộ luật thì KHOÁ nút — logic chung trong tinhNut.
                  const { terminal, myActs, choAi } = tinhNut(inc);
                  const moCum = idx === 0 || cumAhu(incSorted[idx - 1]) !== cumAhu(inc);
                  const soTrongCum = incSorted.filter((x) => cumAhu(x) === cumAhu(inc)).length;
                  return (
                  <React.Fragment key={inc.id}>
                  {moCum && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={11} className="py-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {cumAhu(inc)} <span className="text-slate-400 font-normal normal-case tracking-normal">· {soTrongCum} sự cố</span>
                      </td>
                    </tr>)}
                  <tr className={`border-t border-slate-100 hover:bg-sky-50/40 transition ${inc.silenced ? "opacity-60" : ""}`}>
                    <td className="py-3 px-3 font-semibold" style={{ color: COLOR.navy }}>{inc.id}</td>
                    <td className="py-3 px-3">{inc.cumHienThi
                      ? <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 tabular-nums">{inc.cumHienThi}</span>
                      : <span className="text-[11px] text-slate-300">—</span>}</td>
                    <td className="py-3 px-3">{inc.room}{inc.mucCanhBao === "SUPPRESSED" && <span title="Cảm biến không đo được — hệ ngừng chấm mức, chờ Thiết bị đo. Không gửi email." className="ml-1.5 align-middle inline-block rounded-lg bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-500">cảm biến đứng hình</span>}{(() => { const kh = [incKhu(inc), incAhu(inc)].filter(Boolean).join(" · "); return kh ? <span className="block text-[10px] text-slate-400">{kh}</span> : null; })()}</td>
                    <td className="py-3 px-3"><MucBadge p={inc.priority} stack /></td>
                    <td className="py-3 px-3 text-slate-600">{inc.sensor}{inc.huong && <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${inc.huong === "CAO" ? "bg-rose-50 text-rose-600" : inc.huong === "THAP" ? "bg-sky-50 text-sky-600" : "bg-amber-50 text-amber-600"}`}>{inc.huong === "CAO" ? "↑ cao" : inc.huong === "THAP" ? "↓ thấp" : "↕ cả 2"}</span>}
                      {nhanSoCu(inc)}
                      {inc.giaTriGanNhat != null && <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">TB 5′ cuối <b className="text-slate-600 tabular-nums">{inc.giaTriGanNhat}{inc.donVi}</b>{inc.cuaSo5p && <span className="tabular-nums"> ({inc.cuaSo5p}{inc.ngay5p ? ` · ${inc.ngay5p}` : ""})</span>}{inc.gioiHanDuoi != null && <> · yêu cầu <span className="tabular-nums">{inc.gioiHanDuoi}–{inc.gioiHanTren}</span></>}{(inc.mucGanNhat === "NORMAL" || inc.mucGanNhat === "WARNING") ? <span className="text-emerald-600"> · đã về ngưỡng</span> : inc.mucGanNhat && <span className="text-rose-500"> · {inc.mucGanNhat}</span>}{inc.thieuDiem && <span className="text-amber-600"> · FMS thiếu điểm</span>}{inc.tuoiDuLieuPhut > 75 && <span className="text-amber-600"> · số liệu {(inc.tuoiDuLieuPhut / 60).toFixed(1)}h trước</span>}</div>}</td>
                    <td className="py-3 px-3 text-slate-500 tabular-nums text-[12px]">{inc.start.slice(11)}</td>
                    <td className="py-3 px-3 text-amber-600 font-medium">{inc.duration}h</td>
                    <td className="py-3 px-3"><span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 font-medium"><span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inc.status]}`} />{inc.status}</span></td>
                    <td className="py-3 px-3">{(() => { const q = phuTrachTheoId[inc.dbId]; if (!q) return <span className="text-[11px] text-slate-300">—</span>;
                      const cham = !!q.dang_cham;
                      return (<div className="leading-tight">
                        <span className={`text-[11px] font-semibold ${cham ? "text-rose-600" : "text-slate-600"}`}>{tenVaiTro(q.vai_tro_phu_trach, inc.room) || "—"}</span>
                        <p className={`text-[10px] mt-0.5 ${cham ? "text-rose-500 font-medium" : "text-slate-400"}`}>
                          {q.nguong_phut === 0 ? "bế tắc — Trực + QA được báo ngay"
                            : cham ? `im lặng ${fmtPhut(q.phut_im_lang)} / ngưỡng ${fmtPhut(q.nguong_phut)}`
                            : `trong nhịp · ${fmtPhut(q.phut_im_lang)}/${fmtPhut(q.nguong_phut)}`}
                        </p>
                        {cham && q.da_bao_truc && <p className="text-[10px] text-amber-600 mt-0.5">đã báo Trực</p>}
                      </div>); })()}</td>
                    <td className="py-3 px-3">{user && (role === "ADMIN" || role === "LOT" || role === "QA") ? <button onClick={() => toggleSilence(inc.id)} className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 ring-1 transition flex items-center gap-1 ${inc.silenced ? "text-slate-500 bg-slate-100 ring-slate-200 hover:bg-slate-200" : "text-rose-600 bg-rose-50 ring-rose-200 hover:bg-rose-100"}`}>{inc.silenced ? <><Bell className="w-3.5 h-3.5" strokeWidth={1.8} /> Bật lại</> : <><BellOff className="w-3.5 h-3.5" strokeWidth={1.8} /> Tạm hoãn</>}</button> : <span className="text-[11px] text-slate-300">{inc.silenced ? "đang tạm hoãn" : "—"}</span>}{inc.silenced && inc.tamDungDen && <div className="text-[10px] text-slate-400 mt-1" title={inc.tamDungLyDo || ""}>tới {new Date(inc.tamDungDen).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})} · {inc.tamDungBoi || "?"}</div>}</td>
                    <td className="py-3 px-3">{terminal ? <span className="text-teal-600 text-[12px] font-medium">Đã khắc phục</span> : !user ? <button onClick={() => setLoginOpen(true)} className="text-[11px] font-medium rounded-xl px-3 py-1.5 ring-1 ring-slate-200 text-slate-500 bg-white hover:bg-slate-50">Đăng nhập</button> : myActs.length ? <div className="flex flex-wrap gap-1.5">{myActs.map((a) => <button key={a.code} onClick={() => openApproval(inc, a)} className={`text-[11px] font-medium rounded-xl px-2.5 py-1.5 ring-1 ring-black/5 transition hover:brightness-95 ${a.color || ""}`} style={a.style || {}}>{a.label}</button>)}</div> : <span className="text-[11px] text-slate-400">Chờ {choAi.map((r) => tenVaiTro(r, inc.room)).join("/")}</span>}</td>
                  </tr>
                  </React.Fragment>
                ); })}</tbody></table></div></>)}</Card>
              <p className="text-[11px] text-slate-500 text-center"><b>Dừng CB</b> tắt chuông (vẫn giữ trong danh sách & audit) — chỉ <b>Quản trị / Trực HSL</b> thao tác. IPC và Cơ điện chỉ bấm nút hành động tương ứng theo vai trò; phê duyệt ghi bằng tên người đăng nhập (không cần PIN).</p>
              {/* Cụm điều tra — mục RIÊNG, đặt SAU danh sách sự cố: sự cố là thứ vận hành
                  cần thấy trước; cụm là lớp điều tra/kết luận QA, tra cứu sau. */}
              {isLive && cumHienThi.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-[14px] font-semibold" style={{ color: COLOR.navy }}>Cụm điều tra · {cumHienThi.length} cụm / {cumHienThi.reduce((n, c) => n + (c.su_co_dang_mo || 0), 0)} sự cố</h3>
                      <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed max-w-2xl">Sự cố được gộp theo <b>AHU × loại cảm biến</b> — đơn vị mà Cơ điện can thiệp được và QA kết luận được. Cụm tự mở khi sự cố đầu tiên sinh ra, tự đóng khi sự cố cuối cùng đóng.</p>
                    </div>
                  </div>
                  {/* MOBILE: thẻ cụm dọc — không kéo ngang */}
                  <div className="md:hidden mt-3 space-y-2">
                    {cumHienThi.map((c) => {
                      const hh = c.chan_doan && c.chan_doan.startsWith("THIẾT BỊ ĐO");
                      const honHop = c.chan_doan && c.chan_doan.startsWith("HỖN HỢP");
                      const mauChanDoan = hh ? "text-slate-600 bg-slate-100" : honHop ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50";
                      return (
                        <div key={c.ma_cum} onClick={() => setCumChiTiet(c)} className="rounded-2xl ring-1 ring-slate-200 bg-white p-3 cursor-pointer active:bg-sky-50/40">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold tabular-nums" style={{ color: COLOR.navy }}>{c.ma_hien_thi}</span>
                            <span className="text-[12px] text-slate-600">{c.ahu || "—"} · {c.loai_cam_bien} <span className="text-slate-400">· Khu {c.khu_vuc}</span></span>
                          </div>
                          <p className="mt-1 text-[12px] tabular-nums"><b className="text-slate-700">{c.su_co_dang_mo}</b> sự cố mở{c.so_chua_tiep_nhan > 0 && <span className="text-rose-600"> · {c.so_chua_tiep_nhan} chưa tiếp nhận</span>} · mở {Math.round(c.gio_mo)}h</p>
                          <p className="mt-1.5"><span className={`inline-block rounded-lg px-2 py-1 text-[10.5px] leading-tight ${mauChanDoan}`}>{docTenVaiTro(c.chan_doan, c.khu_vuc)}</span></p>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                            {c.da_co_ket_luan_qa ? <span className="text-teal-700">✓ Kết luận: {c.qa_boi}</span> : <span className="text-slate-400">chưa có kết luận</span>}
                            {(role === "QA" || role === "ADMIN") && <button onClick={(e) => { e.stopPropagation(); ghiKetLuanCum(c); }} className="rounded-lg bg-white px-2.5 py-1 font-medium text-slate-600 ring-1 ring-slate-200">{c.da_co_ket_luan_qa ? "Sửa" : "Ghi kết luận"}</button>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* DESKTOP: bảng như cũ */}
                  <div className="hidden md:block mt-3 overflow-x-auto">
                    <table className="w-full text-[12px] min-w-[860px]">
                      <thead><tr className="text-slate-500 text-left text-[10px] uppercase tracking-wider">{["Cụm", "AHU · Chỉ tiêu", "Sự cố", "Chẩn đoán", "Phòng", "Mở", "Kết luận QA"].map((h) => <th key={h} className="py-2 px-3 font-semibold">{h}</th>)}</tr></thead>
                      <tbody>{cumHienThi.map((c) => {
                        const hh = c.chan_doan && c.chan_doan.startsWith("THIẾT BỊ ĐO");
                        const honHop = c.chan_doan && c.chan_doan.startsWith("HỖN HỢP");
                        const mauChanDoan = hh ? "text-slate-600 bg-slate-100" : honHop ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50";
                        return (
                          <tr key={c.ma_cum} onClick={() => setCumChiTiet(c)} className="border-t border-slate-100 align-top cursor-pointer hover:bg-sky-50/40">
                            <td className="py-2.5 px-3 font-semibold tabular-nums" style={{ color: COLOR.navy }}>{c.ma_hien_thi}</td>
                            <td className="py-2.5 px-3"><span className="font-medium text-slate-700">{c.ahu || "—"}</span><span className="text-slate-400"> · {c.loai_cam_bien}</span><div className="text-[10px] text-slate-400">Khu {c.khu_vuc}</div></td>
                            <td className="py-2.5 px-3 tabular-nums">
                              <span className="font-semibold text-slate-700">{c.su_co_dang_mo}</span>
                              {c.so_chua_tiep_nhan > 0 && <span className="ml-1.5 text-[10px] text-rose-600">{c.so_chua_tiep_nhan} chưa tiếp nhận</span>}
                            </td>
                            <td className="py-2.5 px-3"><span className={`inline-block rounded-lg px-2 py-1 text-[10.5px] leading-tight ${mauChanDoan}`}>{docTenVaiTro(c.chan_doan, c.khu_vuc)}</span></td>
                            <td className="py-2.5 px-3 text-slate-500 max-w-[190px]"><span className="line-clamp-2" title={c.cac_phong}>{c.cac_phong || "—"}</span></td>
                            <td className="py-2.5 px-3 tabular-nums text-slate-500">{Math.round(c.gio_mo)} h</td>
                            <td className="py-2.5 px-3">
                              {c.da_co_ket_luan_qa
                                ? <span className="text-[11px] text-teal-700" title={`${c.nguyen_nhan_goc}\n\nKhắc phục: ${c.hanh_dong_khac_phuc}`}>✓ {c.qa_boi}</span>
                                : <span className="text-[11px] text-slate-400">chưa có</span>}
                              {(role === "QA" || role === "ADMIN") && (
                                <button onClick={(e) => { e.stopPropagation(); ghiKetLuanCum(c); }} className="ml-2 rounded-lg bg-white px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">{c.da_co_ket_luan_qa ? "Sửa" : "Ghi kết luận"}</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                </Card>
              )}
              {isLive && suCoDongXem.length > 0 && (
                <Card className="p-4">
                  <button onClick={() => setKhungDongMo(!khungDongMo)} className="w-full flex items-center justify-between gap-3 text-left">
                    <div>
                      <h3 className="text-[14px] font-semibold" style={{ color: COLOR.navy }}>Đóng gần đây · {suCoDongXem.length} sự cố (7 ngày)</h3>
                      <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">QA/Quản trị mở lại được trong cửa sổ này — bắt buộc lý do, ghi vào audit. Sự cố mở lại nhập vào cụm điều tra đang mở của cùng (AHU × chỉ tiêu).</p>
                    </div>
                    <span className="shrink-0 text-[12px] text-slate-400">{khungDongMo ? "Thu gọn ▲" : "Mở ra ▼"}</span>
                  </button>
                  {khungDongMo && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[940px] text-[12px]">
                        <thead><tr className="text-slate-500 text-left text-[10px] uppercase tracking-wider">{["Mã", "Cụm", "Phòng", "Chỉ tiêu", "Đóng lúc", "Cách đóng", "Bởi", "Lý do", ""].map((h, i) => <th key={i} className="py-2 px-3 font-semibold">{h}</th>)}</tr></thead>
                        <tbody>{suCoDongXem.map((r) => {
                          const act = (!user || !luatSanSang) ? null : nutChoVaiTro(dsNut, r.trang_thai, role, true)[0] || null;
                          return (
                            <tr key={r.ma_su_co} className="border-t border-slate-100 align-top">
                              <td className="py-2.5 px-3 font-semibold tabular-nums" style={{ color: COLOR.navy }}>{r.ma_hien_thi}</td>
                              <td className="py-2.5 px-3">{r.cum_hien_thi ? <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 tabular-nums">{r.cum_hien_thi}</span> : <span className="text-slate-300">—</span>}</td>
                              <td className="py-2.5 px-3">{r.phong}<span className="block text-[10px] text-slate-400">{[r.khu_vuc, r.ahu].filter(Boolean).join(" · ")}</span></td>
                              <td className="py-2.5 px-3 text-slate-600">{r.cam_bien_vi}</td>
                              <td className="py-2.5 px-3 tabular-nums text-slate-500">{r.dong_luc ? new Date(r.dong_luc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                              <td className="py-2.5 px-3 text-slate-600">{r.nhan_trang_thai || r.trang_thai}</td>
                              <td className="py-2.5 px-3 text-slate-500 max-w-[130px]"><span className="block truncate" title={r.dong_boi || ""}>{r.dong_boi || "—"}</span></td>
                              <td className="py-2.5 px-3 text-slate-500 max-w-[200px]"><span className="line-clamp-2" title={r.dong_ly_do || ""}>{r.dong_ly_do || "—"}</span></td>
                              <td className="py-2.5 px-3 text-right">{act && <button onClick={() => setMoLai({ row: r, act })} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap" style={act.style}>{act.label}</button>}</td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}
              {cumChiTiet && <CumDrawer cum={cumChiTiet} dsSuCo={incidentsXem.filter((i) => i.maCum === cumChiTiet.ma_cum)} onDong={() => setCumChiTiet(null)} coQuyenKetLuan={role === "QA" || role === "ADMIN"} onKetLuan={() => ghiKetLuanCum(cumChiTiet)} onInHoSo={() => inHoSoCum(cumChiTiet)} />}
              {moLai && <ModalMoLai row={moLai.row} act={moLai.act} dangChay={dangGhiCum} onDong={() => setMoLai(null)} onLuu={xacNhanMoLai} />}
            </div>
            );
          })()}

          {(daMo.recent || tab === "recent") && <div style={{ display: tab === "recent" ? "" : "none" }}><ChenhApTheoAhu isLive={isLive} khuChoPhep={khuChoPhep} active={tab === "recent"} /></div>}
          {tab === "sensors" && <CamBienPage isLive={isLive} />}
          {(daMo.trend || tab === "trend") && <div className="space-y-6" style={{ display: tab === "trend" ? "" : "none" }}><TrendPage onAI={setAi} isLive={isLive} liveRisk={isLive ? live.riskRows : null} liveRooms={isLive ? roomsXem : null} liveIncidents={isLive ? incidentsXem : null} khuChoPhep={khuChoPhep} onSaveAI={handleSaveAI} /><PhanTichGmpCard mkt={isLive ? live.gmpMkt : null} spc={isLive ? live.gmpSpc : null} isLive={isLive} /></div>}
          {tab === "reports" && <ReportsPage ai={ai} aiRows={isLive ? live.aiRows : null} />}

          {tab === "audit" && (() => {
            const subTabs = [
              { k: "audit", label: "Nhật ký audit", icon: FileText },
              { k: "config", label: "Thay đổi cấu hình", icon: History },
              { k: "sop", label: "SOP & CAPA", icon: ShieldCheck },
            ];
            return (
            <div className="space-y-5">
              <SectionTitle icon={ScrollText} hint="ALCOA+">Nhật ký truy vết & SOP</SectionTitle>
              {/* Thanh tab con trên cùng — đỡ phải cuộn để chuyển mục */}
              <div className="flex flex-wrap gap-2 sticky top-0 z-10 bg-white/80 backdrop-blur rounded-2xl ring-1 ring-slate-200 p-1.5">
                {subTabs.map((s) => { const Ic = s.icon; const on = auditTab === s.k; return (
                  <button key={s.k} onClick={() => setAuditTab(s.k)} className={`flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium transition ${on ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`} style={on ? { backgroundColor: COLOR.teal } : {}}><Ic className="w-4 h-4" strokeWidth={1.8} /> {s.label}</button>
                ); })}
              </div>

              {auditTab === "audit" && (
              <React.Suspense fallback={<div className="rounded-2xl bg-slate-50 animate-pulse" style={{ height: 320 }} />}>
                <AuditLogPage isLive={isLive} demoRows={audit} />
              </React.Suspense>
              )}
              {auditTab === "config" && (
              <Card className="p-6"><SectionTitle icon={History} hint="cấu hình ngưỡng · phòng · cảm biến">Thay đổi cấu hình & dữ liệu gốc</SectionTitle><p className="text-[11px] text-slate-500 mt-1.5">Các thay đổi cấu hình ghi tại Supabase (sửa ngưỡng cảnh báo, thêm/bớt phòng & cảm biến, chỉnh giới hạn) — kể cả khi sửa trực tiếp trên database, đều hiển thị tại đây.</p><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Thời gian", "Người thực hiện", "Thay đổi"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{configHistory.length === 0 ? <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-[12px]">Chưa có thay đổi cấu hình.</td></tr> : configHistory.map((c, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2.5 pr-4 text-slate-500 tabular-nums">{c.t}</td><td className="py-2.5 pr-4 text-slate-600">{c.who}</td><td className="py-2.5 pr-4 text-slate-700">{c.change}</td></tr>)}</tbody></table></div></Card>
              )}
              {auditTab === "sop" && (
              <Card className="p-6"><SectionTitle icon={ShieldCheck} hint="phục vụ thanh tra">SOP & Deviation / CAPA</SectionTitle><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["SOP", "Áp dụng cho", "Deviation", "CAPA"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{(sopRows || []).map((s, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2.5 pr-4 font-semibold" style={{ color: COLOR.navy }}>{s.sop}</td><td className="py-2.5 pr-4 text-slate-600">{s.apply}</td><td className="py-2.5 pr-4 text-slate-600">{s.dev}</td><td className="py-2.5 pr-4 text-slate-600">{s.capa}</td></tr>)}</tbody></table>{isLive && sopRows === null && <div className="h-10 rounded-xl bg-slate-100 animate-pulse mt-2" />}{isLive && Array.isArray(sopRows) && sopRows.length === 0 && <p className="text-[12px] text-slate-500 mt-2">Chưa có hồ sơ SOP/CAPA nào trong cơ sở dữ liệu.</p>}</div></Card>
              )}
            </div>
            );
          })()}

          {tab === "recipients" && <CauHinhNguoiNhan isLive={isLive} canManage={canManage} laAdmin={user?.role === "ADMIN"} actor={user?.email} />}

          {tab === "settings" && (() => {
            const cfgSubTabs = [
              { k: "canhbao", label: "Nguyên tắc cảnh báo", icon: SlidersHorizontal },
              { k: "phong", label: "Phòng & cảm biến", icon: Building2 },
              { k: "phantuyen", label: "Tự phân tuyến", icon: ShieldCheck },
              { k: "sodo", label: "Sơ đồ xử lý", icon: GitBranch },
              ...(role === "ADMIN" ? [{ k: "taikhoan", label: "Tài khoản & quyền", icon: KeyRound }] : []),
              { k: "hethong", label: "Hệ thống", icon: Wifi },
            ];
            const pct = (v) => Math.max(0, Math.min(100, (Number(v) || 0) / 60 * 100));
            return (
            <div className="space-y-5">
              <SectionTitle icon={Cog}>Cài đặt</SectionTitle>
              <div className="flex flex-wrap gap-2 sticky top-0 z-10 bg-white/80 backdrop-blur rounded-2xl ring-1 ring-slate-200 p-1.5">
                {cfgSubTabs.map((s) => { const Ic = s.icon; const on = cfgTab === s.k; return (
                  <button key={s.k} onClick={() => setCfgTab(s.k)} className={`flex-1 min-w-[150px] flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium transition ${on ? "text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`} style={on ? { backgroundColor: COLOR.teal } : {}}><Ic className="w-4 h-4" strokeWidth={1.8} /> {s.label}</button>
                ); })}
              </div>

              {cfgTab === "canhbao" && (
              <Card className="p-6">
                <SectionTitle icon={SlidersHorizontal} hint="3 mức: kiểm soát tốt → chú ý (theo dõi) → cảnh báo (gửi mail)">Nguyên tắc cảnh báo</SectionTitle>
                <p className="text-[12px] text-slate-500 mt-2">Mỗi giờ hệ thống chấm mỗi phòng tối đa <b>60 điểm</b> (mỗi phút lỗi = 1 điểm). Vượt ngưỡng thì <b>10 phút cuối</b> quyết định: còn lệch ngay lúc này thì gửi mail, đã về dải thì chỉ theo dõi.</p>
                <div className="mt-5">
                  <div className="relative h-10 rounded-xl overflow-hidden ring-1 ring-slate-200 flex text-[11px] font-semibold text-white select-none">
                    <div style={{ width: pct(cfgHT.warn) + "%", background: COLOR.teal }} className="flex items-center justify-center min-w-0"><span className="truncate px-1">Kiểm soát tốt · tự đóng sự cố</span></div>
                    <div style={{ width: Math.max(0, 100 - pct(cfgHT.warn)) + "%", background: "#ef4444" }} className="flex items-center justify-center min-w-0"><span className="truncate px-1">Vượt ngưỡng</span></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums"><span>0</span><span>số điểm lỗi trong 1 giờ →</span><span>60</span></div>
                </div>
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4 mt-5">
                  <div className="flex items-center justify-between gap-2"><label className="text-[12px] font-semibold text-slate-600">Vượt ngưỡng khi OOS 1 giờ &gt;</label><span className="text-[16px] font-bold tabular-nums text-rose-600">{cfgHT.warn}<span className="text-[11px] text-slate-400 font-normal">/60</span></span></div>
                  <p className="text-[11px] text-slate-500 mt-0.5">Từ hoặc dưới mức này, phòng coi như <b>kiểm soát tốt</b> và sự cố đang mở sẽ <b>tự đóng</b>.</p>
                  <input type="range" min="0" max="60" value={cfgHT.warn} disabled={!canManage} onChange={(e) => { setCfgNhap({ ...cfgHT, warn: Number(e.target.value) }); setMoPhong(null); }} className="w-full mt-3 accent-teal-600 disabled:opacity-50" />
                </div>
                <div className="rounded-2xl bg-rose-50/60 ring-1 ring-rose-100 p-4 mt-4 flex items-center justify-between flex-wrap gap-3">
                  <div><label className="text-[12px] font-semibold text-rose-700">Đã vượt ngưỡng — GỬI MAIL khi 10 phút cuối có ≥</label><p className="text-[11px] text-slate-500 mt-0.5">Ít hơn mức này nghĩa là 10 phút cuối đã về dải: sự cố vẫn mở và vẫn hiện ở tab Sự cố, nhưng xếp <b>Chú ý — theo dõi</b> và <b>không gửi mail</b>, vì không có gì để xử lý ngay trong nhịp này.</p></div>
                  <div className="flex items-center gap-2"><input type="number" min="0" max="10" value={cfgHT.action} disabled={!canManage} onChange={(e) => { setCfgNhap({ ...cfgHT, action: Number(e.target.value) }); setMoPhong(null); }} className="w-20 rounded-xl bg-white ring-1 ring-rose-200 px-3 py-2 text-sm text-center font-bold disabled:bg-slate-100" /><span className="text-sm text-slate-400">/10 điểm</span></div>
                </div>

                {/* ③ Không thể chỉnh nhầm bằng một cú kéo chuột. Xem tác động trên 7 ngày
                    dữ liệu THẬT rồi mới áp. Mô phỏng tính lại cả hai mức từ số liệu thô. */}
                {canManage && coThayDoi && (
                  <div className="rounded-2xl ring-1 ring-amber-200 bg-amber-50/60 p-4 mt-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[12px] text-slate-700">
                        Đang sửa: <b>OOS 1 giờ &gt; {cfgNhap.warn}</b> · <b>10′ cuối ≥ {cfgNhap.action}</b>
                        <span className="text-slate-500"> (đang áp dụng: {cfg.warn} / {cfg.action})</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setCfgNhap(null); setMoPhong(null); }}
                          className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600">Hủy</button>
                        <button onClick={xemTacDong}
                          className="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: COLOR.navy }}>Xem tác động</button>
                        <button onClick={() => saveCfg(cfgNhap)} disabled={!moPhong?.kq}
                          className="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
                          style={moPhong?.kq ? { backgroundColor: COLOR.coral } : {}}>Áp dụng</button>
                      </div>
                    </div>

                    {moPhong?.dangTai && <div className="h-16 rounded-xl bg-white/70 animate-pulse mt-3" />}
                    {moPhong?.loi && <p className="text-[12px] text-rose-700 mt-3">{moPhong.loi}</p>}
                    {moPhong?.kq && (
                      <div className="mt-3">
                        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Chiếu lên {moPhong.kq.so_ngay} ngày dữ liệu thật · {moPhong.kq.tong_gio} giờ-cảm-biến</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                          {[["Giờ GỬI MAIL", moPhong.kq.hien_tai.gui_mail, moPhong.kq.de_xuat.gui_mail],
                            ["Giờ chỉ theo dõi", moPhong.kq.hien_tai.theo_doi, moPhong.kq.de_xuat.theo_doi],
                            ["Giờ bình thường", moPhong.kq.hien_tai.binh_thuong, moPhong.kq.de_xuat.binh_thuong]].map(([lbl, a, b]) => (
                            <div key={lbl} className="rounded-xl bg-white ring-1 ring-slate-200 p-3">
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{lbl}</p>
                              <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: COLOR.ink }}>
                                {a} <span className="text-slate-400 font-normal">→</span> {b}
                              </p>
                            </div>))}
                          <div className="rounded-xl bg-white ring-1 ring-slate-200 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Phòng bị ảnh hưởng</p>
                            <p className="text-[15px] font-semibold tabular-nums mt-0.5" style={{ color: COLOR.ink }}>{moPhong.kq.phong_anh_huong}</p>
                          </div>
                        </div>
                        <p className="text-[12px] mt-3 leading-relaxed" style={{ color: moPhong.kq.gui_mail_bot > moPhong.kq.gui_mail_them ? "#854f0b" : COLOR.ink }}>
                          {moPhong.kq.gui_mail_them > 0 && <>Sẽ <b>gửi mail thêm {moPhong.kq.gui_mail_them} giờ</b>{moPhong.kq.p1_gui_mail_them > 0 && <> (trong đó <b>{moPhong.kq.p1_gui_mail_them} giờ ở phòng P1</b>)</>}. </>}
                          {moPhong.kq.gui_mail_bot > 0 && <>Sẽ <b>bớt gửi mail {moPhong.kq.gui_mail_bot} giờ</b>{moPhong.kq.p1_gui_mail_bot > 0 && <> — trong đó <b>{moPhong.kq.p1_gui_mail_bot} giờ ở phòng P1</b>, nghĩa là những giờ đó sẽ không ai được báo</>}. </>}
                          {moPhong.kq.tu_dong_them > 0 && <>Hệ sẽ <b>tự đóng thêm {moPhong.kq.tu_dong_them} giờ</b>. </>}
                          {moPhong.kq.gui_mail_them === 0 && moPhong.kq.gui_mail_bot === 0 && moPhong.kq.tu_dong_them === 0 && moPhong.kq.tu_dong_bot === 0 && <>Không giờ nào đổi mức. Ngưỡng mới không thay đổi hành vi trên 7 ngày vừa qua.</>}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4 mt-4">
                  <label className="text-[12px] font-semibold text-slate-600">Cấp độ phòng được cảnh báo</label>
                  <p className="text-[11px] text-slate-500 mt-0.5">Chỉ mở sự cố + gửi cảnh báo cho phòng thuộc cấp đã chọn. Phòng ngoài cấp <b>vẫn ghi dữ liệu OOS</b> (KPI/tuân thủ đủ), chỉ không tạo sự cố/leo thang.</p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {[["P1", "P1 · trọng yếu"], ["P2", "P2 · quan trọng"], ["P3", "P3 · thường"]].map(([p, lbl]) => { const on = alertUuTien.includes(p); return (
                      <button key={p} onClick={() => toggleUuTien(p)} disabled={!canManage} className={`px-3.5 py-2 rounded-xl text-[12px] font-medium ring-1 transition disabled:opacity-60 ${on ? "text-white ring-transparent" : "text-slate-500 bg-white ring-slate-200 hover:ring-teal-300"}`} style={on ? { backgroundColor: COLOR.teal } : {}}>{on ? "✓ " : ""}{lbl}</button>
                    ); })}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Đang cảnh báo: <b className="text-slate-600">{alertUuTien.join(" · ") || "—"}</b>{alertUuTien.length === 3 ? " (tất cả phòng)" : ""}. Phải giữ ít nhất 1 cấp.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4 mt-4">
                  <label className="text-[12px] font-semibold text-slate-600">Hướng mở sự cố theo chỉ tiêu</label>
                  <p className="text-[11px] text-slate-500 mt-0.5">Chọn <b>mở sự cố</b> khi vượt giới hạn <b>DƯỚI</b>, <b>TRÊN</b> hay <b>CẢ HAI</b> — theo từng chỉ tiêu. Vd: chênh áp (DP) thường chỉ nguy hiểm khi <b>thấp</b> (mất áp dương). Dữ liệu thô luôn ghi đủ; đổi lúc nào cũng được, áp dụng từ giờ chạy kế tiếp.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                    {[["DP", "Chênh áp"], ["RH", "Độ ẩm"], ["T", "Nhiệt độ"]].map(([k, ten]) => (
                      <div key={k} className="rounded-xl bg-white ring-1 ring-slate-200 p-3">
                        <div className="text-[12px] font-medium text-slate-700 mb-1.5">{ten} <span className="text-slate-400">({k})</span></div>
                        <select disabled={!canManage} value={(alertHuong[k] || {}).su_co || "CA_HAI"} onChange={(e) => doiHuong(k, "su_co", e.target.value)} className="w-full rounded-lg bg-slate-50 ring-1 ring-slate-200 px-2 py-1.5 text-[12px] disabled:bg-slate-100"><option value="CA_HAI">Cả hai (dưới + trên)</option><option value="DUOI">Chỉ khi THẤP (dưới)</option><option value="TREN">Chỉ khi CAO (trên)</option></select>
                      </div>
                    ))}
                  </div>
                </div>
                {!canManage && <p className="text-[11px] text-amber-600 mt-3">Cần quyền QA/Quản trị để chỉnh.</p>}
              </Card>
              )}

              {cfgTab === "phong" && (
              <div className="space-y-5"><SectionTitle icon={Building2}>Quản lý phòng & cảm biến</SectionTitle><RoomManager rooms={rooms} cfg={cfg} canManage={canManage} onAdd={addRoom} onDelete={deleteRoom} onSaveEdits={saveRoomEdits} /></div>
              )}

              {cfgTab === "phantuyen" && (
              <LuatPhanTuyenCard isLive={isLive} canManage={canManage} actor={user?.email} />
              )}

              {cfgTab === "taikhoan" && role === "ADMIN" && (
              <TaiKhoanCard isLive={isLive} actor={user?.email} />
              )}

              {cfgTab === "sodo" && (
              <Card className="p-6"><SectionTitle icon={GitBranch} hint="luồng tự động + bảng luật đang chạy">Sơ đồ xử lý sự cố toàn hệ thống</SectionTitle>
                <div className="mt-4"><React.Suspense fallback={<div className="rounded-2xl bg-slate-50 animate-pulse" style={{ height: 320 }} />}><SoDoLuatCard dsNut={isLive ? live.nutThaoTac : null} /></React.Suspense></div>
              </Card>
              )}
              {cfgTab === "hethong" && (
              <div className="space-y-5">
                <Card className="p-6"><SectionTitle icon={Wifi}>Kết nối Supabase</SectionTitle><div className="space-y-3 mt-4 text-sm">{(() => { const conn = !HAS_SUPABASE ? ["chưa cấu hình", "text-slate-600 bg-slate-100"] : !isLive ? ["DEMO", "text-amber-700 bg-amber-100"] : live.loi ? ["lỗi kết nối", "text-rose-700 bg-rose-100"] : live.dangTai ? ["đang tải…", "text-sky-700 bg-sky-100"] : ["đã kết nối", "text-teal-700 bg-teal-100"]; const keyState = HAS_SUPABASE ? ["đã nạp", "text-teal-700 bg-teal-100"] : ["thiếu .env", "text-rose-700 bg-rose-100"]; const rows = [{ k: "Nguồn dữ liệu", v: isLive ? "LIVE — đọc/ghi Supabase" : "DEMO — dữ liệu mẫu", s: conn }, { k: "Khóa môi trường", v: HAS_SUPABASE ? "VITE_SUPABASE_URL · ANON_KEY" : "chưa thiết lập", s: keyState }, { k: "Cập nhật gần nhất", v: live.capNhatLuc ? live.capNhatLuc.toLocaleString("vi-VN") : "—", s: conn }]; return rows.map((r, i) => <div key={i} className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"><span className="text-slate-500 w-44">{r.k}</span><code className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg ring-1 ring-slate-200 flex-1">{r.v}</code><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.s[1]}`}>{r.s[0]}</span></div>); })()}</div>{isLive && live.loi && <p className="text-[11px] text-rose-600 mt-3">Chi tiết lỗi: {live.loi.thong_bao || live.loi.message || "không xác định"}</p>}</Card>
                <ChuoiHashCard isLive={isLive} />
                <DoiMatKhauCard user={user} isLive={isLive} />
              </div>
              )}
            </div>
            );
          })()}
        </main>

        <footer className="mt-8 text-center text-[11px] text-slate-400 tracking-wide leading-relaxed"><span className="font-semibold" style={{ color: COLOR.ink }}>Hệ thống giám sát HVAC phòng sạch GMP</span> · V/Q team — QLCL</footer>
      </div>

      {modal && <ApprovalModal incident={modal.inc} action={modal.action} user={user} onClose={() => setModal(null)} onCommit={handleCommit} />}
      {/* Ghi kết luận cụm render ở GỐC (như ApprovalModal), KHÔNG trong tab Sự cố:
          banner "Việc của bạn" hiện trên mọi tab — trước đây bấm "Ghi kết luận" từ
          tab khác thì state đặt xong mà modal không render (nút như chết). */}
      {cumKetLuan && <ModalKetLuanCum cum={cumKetLuan} dangChay={dangGhiCum} onDong={() => setCumKetLuan(null)} onLuu={luuKetLuanCum} />}
      {roomModal && <RoomDetailModal room={roomModal} onClose={() => setRoomModal(null)} />}
      {kpiModal && <KpiListModal kind={kpiModal} groups={nhomPhong} incidents={suCoP12} cfg={cfg}
        onClose={() => setKpiModal(null)}
        onPickRoom={(r) => { setKpiModal(null); setRoomModal(r); }}
        onPickIncident={(i) => { setKpiModal(null); openApproval(i); }}
        onGotoIncidents={() => { setKpiModal(null); setTab("events"); }} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} isLive={isLive} />}
      {pwOpen && <DoiMatKhauModal user={user} isLive={isLive} onClose={() => setPwOpen(false)} />}
      {veEmail && <ModalVeEmail trangThai={veEmail} onDong={dongVe} onChay={chayVe} />}
    </div>
  );
}
