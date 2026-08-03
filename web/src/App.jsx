import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_DATA_SOURCE, HAS_SUPABASE } from "./lib/config";
import { useLiveData } from "./hooks/useLiveData";
import { PHIEN_BAN_GIAO_THUC, capNhatPhut8h, layNguoiDung, luuNguoiDung, layTaiKhoanChuaPhanQuyen, thaoTacSuCo, kiemVeThaoTac, thaoTacSuCoTuEmail, tamDungCanhBao, batLaiCanhBao, kiemGiaoThuc, ketLuanCum, layHoSoCum, kiemChuoiHashAudit, ACTION_LABEL_TO_CODE, TRANG_THAI_CODE_TO_LABEL, layChuoiXuHuong, layChuoiXuHuongChiTiet, layChuoiXuHuongDaSensor, layChuoiGiaTriPhong, layPhanTichSau, layQuetBatThuong, layDuBaoXuHuong, layMaTranPhongNgay, luuPhanTichAi, layWebhookAi, layWebhookAiSau, phanTichAiQuaWorkflow, layWebhookWf7b, guiNhanDinhXuHuong, layWebhookBaoCaoBu, guiBaoCaoBu, themPhong, suaPhong, xoaPhong, suaGioiHan, themCamBien, xoaCamBien, suaNguong, moPhongNguong, layCanhBaoUuTien, datCanhBaoUuTien, layCanhBaoHuong, datCanhBaoHuong, layCauHinhEmail, datCauHinhEmail, layNguoiNhanBaoCao, luuNguoiNhanBaoCao, xoaNguoiNhanBaoCao, layNguoiNhanCanhBao, luuNguoiNhanCanhBao, xoaNguoiNhanCanhBao, layDanhSachAhu, layLuatPhanTuyen, luuLuatPhanTuyen, xoaLuatPhanTuyen, datCongTacPhanTuyen, layCamBienDungHinh, layChenhApTheoAhu, dangKyRealtimeChenhAp, layKhungGioCanhBao, luuKhungGioCanhBao, EMAIL_KEYS_HE_THONG, EMAIL_KEYS_BAO_CAO } from "./lib/supabaseData";
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

// Biểu đồ (Recharts) tách sang module riêng, NẠP TRỄ (lazy) → bundle màn hình đầu
// KHÔNG kèm Recharts (~400KB); chỉ tải khi mở tab Xu hướng / modal chi tiết phòng.
const LazyChart = React.lazy(() => import("./components/charts"));
function Chart({ h = 200, ...p }) {
  return (
    <React.Suspense fallback={<div className="rounded-2xl bg-slate-50 animate-pulse" style={{ height: h }} />}>
      <LazyChart {...p} />
    </React.Suspense>
  );
}

/* ============ AQUA CLINICAL NEO-MINIMALISM — HỆ THỦY ============ */
/* Giữ tên biến, làm SÂU màu để đủ tương phản (WCAG): chữ đậm, teal/sky sâu,
   critical đỏ trầm chuyên nghiệp, warning amber đậm, không hồng/vàng nhạt. */
const PAGE_BG = "linear-gradient(155deg,#EAF3F8 0%,#FAFDFF 45%,#E2F2EE 100%)";
const cardShadow = { boxShadow: "0 12px 34px -18px rgba(16,40,55,0.30)" };
const CARD = "rounded-3xl bg-white/95 backdrop-blur ring-1 ring-[#D8E6EC]";
const STATUS = { normal: { txt: "text-teal-700", bg: "bg-teal-50", dot: "bg-teal-500" }, warning: { txt: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" }, critical: { txt: "text-rose-700", bg: "bg-rose-50", dot: "bg-rose-600" } };
const PRIORITY = { P1: "bg-rose-600 text-white ring-1 ring-rose-700", P2: "bg-amber-100 text-amber-900 ring-1 ring-amber-400", P3: "bg-sky-100 text-sky-800 ring-1 ring-sky-300" };
const MUC = { P1: "Mức 1", P2: "Mức 2", P3: "Mức 3" };
// Thang 3 mức từ 10/07/2026 (mức NOTICE cũ đã gỡ — nó chưa bao giờ đổi hành vi gì):
//   0 Kiểm soát tốt      OOS 1 giờ ≤ nguong_canh_bao
//   1 Chú ý — theo dõi   OOS vượt ngưỡng NHƯNG 10 phút cuối đã về dải ⇒ không gửi mail
//   3 Cảnh báo           OOS vượt ngưỡng VÀ 10 phút cuối còn ≥ nguong_hanh_dong ⇒ gửi mail
// Chỉ số 2 giữ chỗ để không phải đánh số lại toàn bộ mã cũ; không mức nào rơi vào đó.
const LEVELS = [
  { key: "normal", label: "Kiểm soát tốt", txt: "text-teal-700", bg: "bg-teal-50", ring: "ring-teal-200", dot: "bg-teal-400" },
  { key: "notice", label: "Chú ý — theo dõi", txt: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", dot: "bg-sky-400" },
  { key: "warning", label: "Cảnh báo", txt: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", dot: "bg-amber-400" },
  { key: "action", label: "Cảnh báo — cần xử lý", txt: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", dot: "bg-rose-500" },
];
// Thứ tự ưu tiên theo dõi: phòng nguy cơ cao nhất (Hành động) xếp trước. -1 = mất dữ liệu.
const LEVEL_PRIORITY = (lvl) => (lvl == null || lvl < 0 ? -0.5 : lvl);
// WCAG 1.4.1 — mỗi mức có GLYPH riêng (không phân biệt chỉ bằng màu): người mù màu
// vẫn đọc được qua hình dạng. Kiểm soát tốt ✓ · Chú ý ◦ · Cảnh báo ▲ · Hành động ■.
const LEVEL_GLYPH = ["✓", "◦", "▲", "■"];
const levelGlyph = (lvl) => (lvl == null || lvl < 0 ? "–" : (LEVEL_GLYPH[lvl] || "•"));

/* ============ NGƯỜI DÙNG & PHÂN QUYỀN ============ */
// Danh sách người dùng + vai trò lấy từ bảng Supabase `nguoi_dung` theo email (xem lib/auth.js),
// KHÔNG hardcode ở đây (tránh lộ email nội bộ ra source công khai).
// Tên vai trò ĐẦY ĐỦ theo chức năng (yêu cầu 11/07: không dùng viết tắt trên giao diện).
const ROLE_VI = { IPC: "Kiểm soát hiện trường", MEP: "Cơ điện", LOT: "Trực hồ sơ lô", QA: "Đảm bảo chất lượng", ADMIN: "Quản trị hệ thống", IT: "Quản trị hệ thống" };
// 31/07: khu Q2 do QC kiểm soát, không phải IPC. Chỉ đổi CHỮ HIỂN THỊ theo khu — mã vai trò,
// phân quyền và luật nút (xem_nut_thao_tac) vẫn là 'IPC'. Cùng bảng ánh xạ với node
// "Đổi tên vai trò theo khu" của WF8, để email và web không gọi hai tên khác nhau.
const TEN_VAI_KHU = { Q2: { IPC: "QC" } };
// Nhận "Q2" hoặc mã phòng "Q2.R7" — khu là phần trước dấu chấm.
const khuCua = (s) => String(s || "").split(".")[0];
const tenVaiTro = (vai, khuHoacPhong) => (TEN_VAI_KHU[khuCua(khuHoacPhong)] || {})[vai] || ROLE_VI[vai] || vai;
// Chuỗi server trả về (chẩn đoán SLA, nhật ký…) vẫn chứa mã vai trò → dịch khi hiển thị.
const docTenVaiTro = (s, khuHoacPhong) => (s == null ? s : String(s).replace(/\b(IPC|MEP|LOT|QA|ADMIN)\b/g, (m) => tenVaiTro(m, khuHoacPhong)));
const FULL_ACCESS = ["QA", "ADMIN", "IT"];                 // QA và IT: xem TẤT CẢ các tab
const canManageRooms = (role) => FULL_ACCESS.includes(role);
// PHÂN QUYỀN TAB (yêu cầu #5):
//   • IPC, Cơ điện (MEP): chỉ Tổng quan + Sự cố (để kích hoạt sự cố liên quan).
//   • Trực (LOT): Tổng quan + Sự cố + Xu hướng.
//   • QA, IT (ADMIN): tất cả các tab.
//   • ĐỔI MẬT KHẨU: mọi vai trò đều có (nút riêng ở góc phải, không phụ thuộc tab).
const TAB_ROLES = {
  home:     ["IPC", "MEP", "LOT", "QA", "ADMIN", "IT"],
  events:   ["IPC", "MEP", "LOT", "QA", "ADMIN", "IT"],
  recent:   ["IPC", "MEP", "LOT", "QA", "ADMIN", "IT"],
  sensors:  ["MEP", "LOT", "QA", "ADMIN", "IT"],   // theo dõi cảm biến đứng hình — Cơ điện xử lý
  trend:    ["LOT", "QA", "ADMIN", "IT"],
  reports:  FULL_ACCESS,
  audit:    FULL_ACCESS,
  settings: FULL_ACCESS,
};
// role rỗng = chế độ xem trước cục bộ (demo, chưa Supabase) → hiện mọi tab cho tiện thử.
const roleCanSeeTab = (role, key) => (!role ? true : (TAB_ROLES[key] || FULL_ACCESS).includes(role));

function CpcLogo({ className = "h-9 w-auto" }) { return <img src={logoCpc1hn} alt="CPC1 Hà Nội" className={`${className} object-contain select-none`} draggable={false} />; }

/* ============ TIỆN ÍCH ============ */
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const fmtH = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}h`);
const fmtDelta = (v) => (v == null || isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${(+v).toFixed(1).replace(".0", "")}%`);
const deltaTone = (v) => (v == null ? "text-slate-400" : v >= 5 ? "text-teal-600" : v <= -5 ? "text-rose-600" : "text-slate-400");
const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
// Giờ hiện tại theo múi giờ VN (UTC+7) — "YYYY-MM-DD HH:MM:SS", độc lập với múi giờ trình duyệt.
const vnNow = () => new Date().toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).replace(/\u202f/g, " ");

/* ============ TELEMETRY 8H ============ */
const RAW = new Map();
const ROOM_BIAS = { "C4.R7": -2.6, "C1.R11": -1.7, "C4.R1": -0.9, "Q2.R8": -0.2, "C1.R5": 0.7 };
function rawSeries(roomId, k) {
  const key = roomId + "|" + k; if (RAW.has(key)) return RAW.get(key);
  const rand = mulberry32(hashStr(key)); const bias = k === "DP" ? (ROOM_BIAS[roomId] || 0) : 0;
  const center = (k === "DP" ? 13.4 : k === "RH" ? 49 : 21.3) + bias; const amp = k === "DP" ? 3.0 : k === "RH" ? 7 : 2.0;
  const arr = []; const now = Date.now();
  for (let i = 479; i >= 0; i--) { const t = now - i * 60000; const drift = Math.sin((479 - i) / 50) * amp * 0.6; arr.push({ t, v: +(center + drift + (rand() - 0.5) * amp).toFixed(1) }); }
  RAW.set(key, arr); return arr;
}
function sensorStats(roomId, sensor, isLive = false) {
  // LIVE: dùng thống kê thật đã nạp (DB lưu theo giờ → không có độ phân giải 10′)
  if (sensor && sensor._live) {
    const L = sensor._live;
    return { cur: L.cur, avg1h: L.avg1h, oos1h: L.oos1h ?? 0, err10: (L.oos10 != null ? L.oos10 : null), hourly8: L.hourly8 || [] };
  }
  // LIVE mà cảm biến KHÔNG có dữ liệu thật (cấu hình cam_bien có nhưng FMS chưa gửi)
  // → TUYỆT ĐỐI không bịa số demo (đây là lỗi "hiển thị nhầm nhiệt độ/độ ẩm").
  if (isLive) return { cur: null, avg1h: null, oos1h: null, err10: null, hourly8: [], khongCoDL: true };
  const arr = rawSeries(roomId, sensor.k);
  const oos = (v) => (sensor.min != null && v < sensor.min) || (sensor.max != null && v > sensor.max);
  const last60 = arr.slice(-60), last10 = arr.slice(-10); const hourly8 = [];
  for (let h = 0; h < 8; h++) { const c = arr.slice(h * 60, (h + 1) * 60); const lab = new Date(c[0].t); hourly8.push({ label: `${pad(lab.getHours())}:00`, avg: +(c.reduce((a, p) => a + p.v, 0) / c.length).toFixed(1), oos: c.filter((p) => oos(p.v)).length }); }
  return { cur: arr[arr.length - 1].v, avg1h: +(last60.reduce((a, p) => a + p.v, 0) / 60).toFixed(1), oos1h: last60.filter((p) => oos(p.v)).length, err10: last10.filter((p) => oos(p.v)).length, hourly8 };
}
function sensorLevel(stat, cfg) {
  // Khớp đúng thang của rpc_xu_ly_du_lieu_phong_hang_gio (chỉ dùng ở chế độ DEMO).
  // OOS 1 giờ ≤ nguong_canh_bao → Kiểm soát tốt.
  // Vượt ngưỡng: 10 phút cuối ≥ nguong_hanh_dong → Cảnh báo; ngược lại → Chú ý (theo dõi).
  if (stat.oos1h <= cfg.warn) return 0;
  return (stat.err10 != null && stat.err10 >= cfg.action) ? 3 : 1;
}
function roomLevel(room, cfg) { if (room.noData) return -1; if (room._isLive) return room._level == null ? -1 : room._level; let lvl = 0; room.sensors.forEach((s) => { lvl = Math.max(lvl, sensorLevel(sensorStats(room.id, s), cfg)); }); return lvl; }
function roomCompliance(room) { if (room.noData || !room.sensors.length) return null; if (room._isLive) return room._compliance; const m = Math.max(...room.sensors.map((s) => sensorStats(room.id, s).oos1h / 60)); return Math.round(100 - m * 100); }
function roomHourlyOOS(room) { if (room.noData || !room.sensors.length) return []; if (room._isLive) return room._hourlyOOS || []; const base = sensorStats(room.id, room.sensors[0]).hourly8.map((h) => ({ label: h.label, oos: 0 })); room.sensors.forEach((s) => sensorStats(room.id, s).hourly8.forEach((h, i) => { if (base[i]) base[i].oos += h.oos; })); return base; }

/* ============ XU HƯỚNG (90 ngày) ============ */
function genDaily(s) { const rand = mulberry32(s.seed * 7919); const out = []; const today = new Date(); today.setHours(0, 0, 0, 0); const decline = s.type === "ROOM" && s.priority === 1 ? -7 : s.type === "AHU" && s.base < 75 ? -5 : 2; for (let i = 89; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const wave = Math.sin((89 - i) / 9) * s.vol * 0.55; const drift = ((89 - i) / 89) * decline; let comp = Math.max(34, Math.min(99.4, s.base + wave + drift + (rand() - 0.5) * s.vol)); const dq = Math.max(62, Math.min(100, 94 + (rand() - 0.5) * 10)); const deficit = Math.max(0, 95 - comp); out.push({ date: d, compliance: +comp.toFixed(1), dq: +dq.toFixed(1), warnH: +Math.max(0, deficit * 0.22 + (rand() - 0.35)).toFixed(1), critH: +Math.max(0, deficit * 0.16 + (rand() - 0.6) * 0.8).toFixed(1) }); } return out; }
function genHourly(s) { const rand = mulberry32(s.seed * 104729); const out = []; const now = new Date(); for (let h = 23; h >= 0; h--) { const t = new Date(now); t.setHours(now.getHours() - h, 0, 0, 0); const wave = Math.sin(h / 4) * s.vol * 0.4; let comp = Math.max(34, Math.min(99.4, s.base + wave + (rand() - 0.5) * s.vol * 0.8)); const deficit = Math.max(0, 95 - comp); out.push({ date: t, compliance: +comp.toFixed(1), dq: Math.min(100, 90 + rand() * 9), warnH: +Math.max(0, deficit * 0.02).toFixed(2), critH: +Math.max(0, deficit * 0.012).toFixed(2) }); } return out; }
const SCOPES = [
  { type: "TOTAL", id: "ALL", name: "Toàn hệ thống", base: 84, vol: 7, seed: 1 },
  { type: "AREA", id: "C1", name: "Khu C1", base: 88, vol: 6, seed: 2 }, { type: "AREA", id: "C4", name: "Khu C4", base: 74, vol: 10, seed: 3 }, { type: "AREA", id: "Q2", name: "Khu Q2", base: 93, vol: 4, seed: 4 },
  { type: "AHU", id: "AHU-K01", name: "AHU-K01", area: "C4", base: 69, vol: 11, seed: 5 }, { type: "AHU", id: "AHU03", name: "AHU03", area: "C1", base: 80, vol: 8, seed: 6 }, { type: "AHU", id: "AHU01", name: "AHU01", area: "C1", base: 90, vol: 5, seed: 7 }, { type: "AHU", id: "AHU02", name: "AHU02", area: "C1", base: 92, vol: 4, seed: 8 }, { type: "AHU", id: "AHU04", name: "AHU04", area: "Q2", base: 95, vol: 3, seed: 9 }, { type: "AHU", id: "AHU-K02", name: "AHU-K02", area: "C4", base: 86, vol: 6, seed: 10 },
  { type: "ROOM", id: "C4.R7", name: "Chiết rót", area: "C4", ahu: "AHU-K01", priority: 1, base: 55, vol: 13, seed: 11 }, { type: "ROOM", id: "C1.R11", name: "Pha chế", area: "C1", ahu: "AHU03", priority: 1, base: 63, vol: 11, seed: 12 }, { type: "ROOM", id: "C4.R1", name: "Thay đồ", area: "C4", ahu: "AHU-K01", priority: 1, base: 70, vol: 9, seed: 13 }, { type: "ROOM", id: "Q2.R8", name: "Khu Q2 — Chiết", area: "Q2", ahu: "AHU04", priority: 2, base: 81, vol: 8, seed: 14 }, { type: "ROOM", id: "C1.R5", name: "Phòng sạch chung", area: "C1", ahu: "AHU02", priority: 2, base: 93, vol: 4, seed: 15 },
];
const MASTER = SCOPES.map((s) => { const daily = genDaily(s); const last7 = daily.slice(-7); const latest = daily[daily.length - 1]; return { ...s, daily, latest, risk: Math.round((100 - latest.compliance) + last7.reduce((a, r) => a + r.critH, 0)) }; });
const byType = (t) => MASTER.filter((m) => m.type === t).sort((a, b) => b.risk - a.risk);
const findScope = (id) => MASTER.find((m) => m.id === id);
const RANGES = [{ k: "1n", label: "24 giờ", days: 1 }, { k: "7n", label: "7 ngày", days: 7 }, { k: "30n", label: "30 ngày", days: 30 }, { k: "90n", label: "90 ngày", days: 90 }, { k: "180n", label: "180 ngày", days: 180 }];
const SENSORS = [{ k: "ALL", label: "Tổng hợp" }, { k: "DP", label: "Chênh áp" }, { k: "RH", label: "Độ ẩm" }, { k: "T", label: "Nhiệt độ" }];
const SCOPE_LEVELS = [{ k: "TOTAL", label: "Tổng" }, { k: "AREA", label: "Khu vực" }, { k: "AHU", label: "AHU" }, { k: "ROOM", label: "Phòng" }];
function applySensor(row, sensor) { if (sensor === "ALL") return row; const shift = { DP: -5, RH: 1, T: 4 }[sensor] || 0; const factor = { DP: 1.5, RH: 1.0, T: 0.6 }[sensor] || 1; return { ...row, compliance: +Math.max(30, Math.min(99.4, row.compliance + shift)).toFixed(1), warnH: +(row.warnH * factor).toFixed(2), critH: +(row.critH * factor).toFixed(2) }; }
function getSeries(scope, sensor, rangeKey) {
  if (!scope) return [];
  const isHour = rangeKey === "1n";
  const base = isHour ? genHourly(scope) : scope.daily.slice(-RANGES.find((r) => r.k === rangeKey).days);
  return base.map((r0, i) => { const a = applySensor(r0, sensor); const comp = a.compliance; const label = isHour ? `${pad(a.date.getHours())}:00` : `${pad(a.date.getDate())}/${pad(a.date.getMonth() + 1)}`; return { label, ts: a.date.getTime(), comp, dq: Math.round(a.dq), warnH: a.warnH, critH: a.critH, alert: +(a.warnH + a.critH).toFixed(2), oos: Math.max(0, Math.round((90 - comp) / 5 + Math.sin(i) * 0.6)) }; });
}

/* ============ PHÒNG ============ */
const AREAS = ["C1", "C4", "Q2"];
const AHUS = ["AHU01", "AHU02", "AHU03", "AHU04", "AHU-K01", "AHU-K02"];
// Meta cơ bản (label/unit/màu) dùng chung với charts.jsx qua lib/designTokens — chỉ icon là riêng App.
const SENSOR_META = { DP: { ...SENSOR_META_BASE.DP, icon: Gauge }, RH: { ...SENSOR_META_BASE.RH, icon: Droplets }, T: { ...SENSOR_META_BASE.T, icon: Thermometer } };
const OOS_FILL = "#df7d62";     // vùng OOS
function defSensors(priority) { return [{ k: "DP", min: priority === "P1" ? 12.5 : priority === "P2" ? 10 : 8, max: 30 }, { k: "RH", min: 30, max: priority === "P3" ? 60 : 55 }, { k: "T", min: 18, max: priority === "P3" ? 25 : 24 }]; }
const ROOM_SEED = [
  { id: "C4.R7", name: "Chiết rót", area: "C4", ahu: "AHU-K01", priority: "P1", note: "Khu vô trùng trọng yếu" },
  { id: "C1.R11", name: "Pha chế", area: "C1", ahu: "AHU03", priority: "P1", note: "" },
  { id: "C4.R1", name: "Thay đồ", area: "C4", ahu: "AHU-K01", priority: "P1", note: "" },
  { id: "C1.R14", name: "Hành lang", area: "C1", ahu: "AHU01", priority: "P3", note: "Sensor đang lỗi", noData: true },
  { id: "Q2.R8", name: "Khu Q2 — Chiết", area: "Q2", ahu: "AHU04", priority: "P2", note: "" },
  { id: "C1.R5", name: "Phòng sạch chung", area: "C1", ahu: "AHU02", priority: "P2", note: "" },
];
const INITIAL_ROOMS = ROOM_SEED.map((r) => ({ ...r, noData: !!r.noData, sensors: r.noData ? [] : defSensors(r.priority) }));

// Mỗi trạng thái → DANH SÁCH hành động (nút) theo vai trò. code = mã RPC; next = trạng thái hiển thị kế; dong = đóng sự cố.
const A_TEAL = "text-teal-700 bg-teal-50 hover:bg-teal-100 ring-teal-200";
const A_AMBER = "text-amber-700 bg-amber-50 hover:bg-amber-100 ring-amber-200";
const A_INFO = "text-sky-700 bg-sky-50 hover:bg-sky-100 ring-sky-200";
const A_ROSE = "text-rose-700 bg-rose-50 hover:bg-rose-100 ring-rose-200";
const A_SLATE = "text-slate-600 bg-slate-100 hover:bg-slate-200 ring-slate-200";
// Luồng gọn: IPC (kiểm tra hiện trường) + Cơ điện (điều chỉnh). Luật DB dùng '*' nên đóng được từ mọi trạng thái.
const A_IPC = { label: "Bình thường — đóng", code: "ipc_binh_thuong", next: "Đã khắc phục", dong: true, roles: ["IPC"], color: A_TEAL };
const A_MEP_NHAN = { label: "Cơ điện đang xử lý", code: "mep_tiep_nhan", next: "Cơ điện đang xử lý", roles: ["MEP"], color: A_INFO };
const A_MEP_XONG = { label: "Đã xử lý xong — đóng", code: "mep_xu_ly_xong", next: "Đã khắc phục", dong: true, roles: ["MEP"], color: A_TEAL };
const A_MEP_KHONG = { label: "Không xử lý được", code: "mep_khong_xu_ly_duoc", next: "Không xử lý được", roles: ["MEP"], color: A_ROSE };
const STATUS_ACTIONS = {
  "Chưa xử lý": [A_IPC, A_MEP_NHAN, A_MEP_XONG],
  "Cơ điện đang xử lý": [A_MEP_XONG, A_MEP_KHONG, A_IPC],
  "Không xử lý được": [A_MEP_XONG, A_IPC],
  // Nhãn cũ (sự cố mở trước khi đổi luồng) — vẫn đóng được
  "Đã báo cơ điện": [A_MEP_NHAN, A_MEP_XONG, A_IPC],
  "Chờ IPC kiểm lại": [A_MEP_XONG, A_IPC],
  "IPC: bất thường": [A_MEP_NHAN, A_IPC],
};
// gộp mọi vai trò có thể thao tác ở 1 trạng thái (để hiện "Chờ …")
const rolesOfStatus = (st) => [...new Set((STATUS_ACTIONS[st] || []).flatMap((a) => a.roles))];
// CHỈ dùng ở chế độ DEMO. Ở LIVE, openApproval giải nút từ bảng luật (xem P0-2).
// Bỏ đặc quyền `role === "ADMIN"`: nó cho ADMIN nút của IPC/Cơ điện mà DB luôn từ chối.
const firstActionFor = (st, role) => (STATUS_ACTIONS[st] || []).find((a) => a.roles.includes(role)) || null;

// ===== Bộ nút lấy TỪ BẢNG LUẬT (view xem_nut_thao_tac), không hard-code =====
// STATUS_ACTIONS phía trên chỉ còn dùng cho chế độ DEMO (không có Supabase).
// Ở LIVE, nút hiện ra phải là nút bấm được. Muốn vậy phải lọc ĐỦ BA chiều mà DB
// dùng khi từ chối: trang_thai_truoc · vai_tro · ap_dung_khi (mở/đã đóng).
//
// 10/07/2026: lọc thiếu hai chiều, và lỗi "nút hiện nhưng bấm trả KHONG_DUOC_PHEP"
// vẫn sống — chỉ là không ai gặp vì nó nấp ở vai trò ADMIN (đúng một tài khoản):
//   • `role === "ADMIN" ||` cho ADMIN thấy toàn bộ nút của IPC/MEP/LOT, trong khi
//     rpc_thao_tac_su_co tra luật theo (hanh_dong, vai_tro) nên từ chối 100%.
//   • Ngược lại ba nút thật của ADMIN có nhan = NULL nên không bao giờ hiện.
// Nay ADMIN xem như mọi vai trò khác: thấy đúng nút của mình, bấm là chạy.
function nutKhopTrangThai(dsNut, statusCode, daDong = false) {
  if (!dsNut?.length || !statusCode) return [];
  const uu = new Map();   // ưu tiên luật khớp ĐÚNG trạng thái hơn luật '*'
  for (const n of dsNut) {
    if (n.trang_thai_truoc !== statusCode && n.trang_thai_truoc !== "*") continue;
    const apDung = n.ap_dung_khi || "MO";                 // DB mặc định 'MO'
    if (apDung === "MO" && daDong) continue;               // nút thường: sự cố đã đóng thì thôi
    if (apDung === "DONG" && !daDong) continue;            // "Mở lại": chỉ khi đã đóng
    const cu = uu.get(n.hanh_dong);
    if (!cu || (n.trang_thai_truoc === statusCode && cu.trang_thai_truoc === "*")) uu.set(n.hanh_dong, n);
  }
  return [...uu.values()].sort((a, b) => (a.thu_tu || 0) - (b.thu_tu || 0));
}
function nutChoVaiTro(dsNut, statusCode, role, daDong = false) {
  return nutKhopTrangThai(dsNut, statusCode, daDong)
    .filter((n) => n.vai_tro === role)
    .map((n) => ({
      code: n.hanh_dong, label: n.nhan, roles: [n.vai_tro], dong: !!n.dong_su_co,
      batBuocLyDo: !!n.bat_buoc_ly_do,
      next: n.giu_trang_thai ? "(giữ nguyên)" : (TRANG_THAI_CODE_TO_LABEL[n.trang_thai_sau] || n.trang_thai_sau),
      style: { color: n.mau_chu, backgroundColor: n.mau_nen },
    }));
}
const STATUS_DOT = { "Chưa xử lý": "bg-rose-500", "IPC: bất thường": "bg-violet-500", "Đã báo cơ điện": "bg-amber-500", "Cơ điện đang xử lý": "bg-cyan-500", "Cơ điện chờ xử lý": "bg-slate-400", "Chờ IPC kiểm lại": "bg-teal-500", "Đã khắc phục": "bg-emerald-500" };
const INCIDENTS0 = [
  { id: "SC-1042", room: "C4.R7", sensor: "Chênh áp (DP)", priority: "P1", start: "2026-05-29 06:12:04", duration: 7.1, status: "Chưa xử lý", silenced: false, trail: [{ t: "06:12:04", who: "Hệ thống", act: "Chênh áp nghiêm trọng (9.1 Pa < 12.5 Pa) — AHU-K01" }] },
  { id: "SC-1041", room: "C1.R11", sensor: "Chênh áp (DP)", priority: "P1", start: "2026-05-29 06:08:11", duration: 7.2, status: "Chưa xử lý", silenced: false, trail: [{ t: "06:08:11", who: "Hệ thống", act: "Chênh áp nghiêm trọng (10.3 Pa) — AHU03" }] },
  { id: "SC-1038", room: "C4.R1", sensor: "Chênh áp (DP)", priority: "P1", start: "2026-05-29 04:42:30", duration: 4.8, status: "IPC: bất thường", silenced: false, trail: [{ t: "04:42:30", who: "Hệ thống", act: "Chênh áp cảnh báo (11.8 Pa)" }, { t: "10:18:02", who: "Nam (IPC)", act: "Kiểm tra hiện trường, xác nhận bất thường" }] },
  { id: "SC-1035", room: "C1.R20", sensor: "Độ ẩm (RH)", priority: "P1", start: "2026-05-29 03:36:09", duration: 3.6, status: "Cơ điện đang xử lý", silenced: false, trail: [{ t: "03:36:09", who: "Hệ thống", act: "Độ ẩm cảnh báo (56.9%)" }, { t: "04:20:40", who: "Tuấn (MEP)", act: "Tiếp nhận, kiểm tra bộ hút ẩm AHU03" }] },
  { id: "SC-1030", room: "Q2.R8", sensor: "Chênh áp (DP)", priority: "P2", start: "2026-05-29 03:00:00", duration: 3.0, status: "Đã báo cơ điện", silenced: false, trail: [{ t: "03:12:18", who: "Nam (IPC)", act: "Xác nhận bất thường — báo cơ điện AHU04" }] },
  { id: "SC-1028", room: "C1.R14", sensor: "Thiếu dữ liệu", priority: "P3", start: "2026-05-29 00:05:00", duration: 6.1, status: "IPC: bất thường", silenced: true, trail: [{ t: "00:05:00", who: "Hệ thống", act: "Sensor mất tín hiệu — DQ < 80%" }] },
];
const SYSTEM_ALERTS = [
  { icon: Wind, kind: "critical", text: "Sensor C4.R7 mất tín hiệu ~12 phút", sub: "Kiểm tra đường truyền FMS" },
  { icon: AlertTriangle, kind: "warning", text: "5 sự cố chưa được IPC tiếp nhận", sub: "Cần xử lý trong giờ" },
  { icon: HelpCircle, kind: "warning", text: "1 phòng thiếu dữ liệu (DQ < 80%)", sub: "C1.R14" },
  { icon: Cpu, kind: "normal", text: "Workflow chạy lúc 13:05 — thành công", sub: "Rollup theo giờ" },
];
const SOP = [{ sop: "SOP-HVAC-005", apply: "Chênh áp phòng sạch", dev: "Không", capa: "Không" }, { sop: "SOP-HVAC-008", apply: "Xử lý mất áp Grade A/B", dev: "Có — DEV-2026-014", capa: "Đang mở" }, { sop: "PIC/S Annex 1", apply: "Tiêu chuẩn vô trùng", dev: "—", capa: "—" }];
// Chọn icon cho cảnh báo hệ thống LIVE theo mức
const ICON_CANH_BAO = (a) => (a.kind === "critical" ? Wind : a.kind === "warning" ? AlertTriangle : Cpu);

/* ============ UI HELPERS ============ */
function Card({ children, className = "", style = {} }) { return <div className={`${CARD} ${className}`} style={{ ...cardShadow, ...style }}>{children}</div>; }
function SectionTitle({ icon: Icon, children, hint }) { return <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: COLOR.navy }}><Icon className="w-4 h-4" style={{ color: COLOR.teal }} strokeWidth={1.8} />{children}{hint && <span className="text-[11px] font-normal text-slate-400">— {hint}</span>}</h3>; }
function MucBadge({ p, stack }) { const n = p[1]; return stack ? <span className={`inline-flex flex-col items-center justify-center leading-tight px-2.5 py-1 rounded-lg ${PRIORITY[p]}`}><span className="text-[11px] font-semibold uppercase tracking-wide">Mức</span><span className="text-[14px] font-bold">{n}</span></span> : <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY[p]}`}>{MUC[p]}</span>; }
function HeaderChip({ children, ring = "ring-slate-200" }) { return <div className={`flex items-center gap-2.5 rounded-2xl bg-white px-4 ring-1 ${ring} h-[50px]`} style={cardShadow}>{children}</div>; }
// Đồng hồ máy chủ UTC+7 tự cập nhật mỗi giây (tách riêng để không render lại toàn trang).
function ServerClock({ live }) {
  const [t, setT] = useState(live ? vnNow() : "2026-05-29 14:08:22");
  useEffect(() => { if (!live) return; const id = setInterval(() => setT(vnNow()), 1000); return () => clearInterval(id); }, [live]);
  return <span className="text-xs font-semibold tabular-nums" style={{ color: COLOR.ink }}>{t}</span>;
}

// Banner "có bản mới" — hiện khi SW phát hiện phiên bản deploy mới (sự kiện
// bms:co-ban-moi từ index.html). 1 chạm Tải lại (index.html network-first nên
// reload nhận đủ HTML+asset mới). Đặc biệt hữu ích trên điện thoại (không F5 tay).
export function BannerCapNhat() {
  const [hien, setHien] = useState(false);
  useEffect(() => {
    const on = () => setHien(true);
    window.addEventListener("bms:co-ban-moi", on);
    return () => window.removeEventListener("bms:co-ban-moi", on);
  }, []);
  if (!hien) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-2xl sm:inset-x-auto sm:right-4">
      <span className="text-[13px] font-medium leading-tight">Đã có bản cập nhật mới của ứng dụng.</span>
      <button onClick={() => window.location.reload()} className="ml-auto shrink-0 rounded-xl bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-900 hover:bg-slate-100">Tải lại</button>
      <button onClick={() => setHien(false)} aria-label="Để sau" className="shrink-0 text-white/50 hover:text-white">✕</button>
    </div>
  );
}
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

// ═══ HƯỚNG DẪN NÚT EMAIL (17/07 — tab Nhiệm vụ, cho mọi người đọc) ═══
// Nội dung TĨNH khớp bảng luật + sơ đồ vòng đời: email gửi nút gì, bấm mỗi nút vé đi đâu.
function HuongDanEmailNut() {
  const Nut = ({ mau, khoa, children }) => (
    <span className={`inline-block shrink-0 rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${khoa ? "bg-slate-100 text-slate-400 ring-1 ring-dashed ring-slate-300" : mau}`}>{khoa ? "🔒 " : ""}{children}</span>
  );
  const Dong = ({ nut, mau, khoa, kq }) => (
    <div className="flex items-start gap-2.5">
      <Nut mau={mau} khoa={khoa}>{nut}</Nut>
      <span className="pt-0.5 text-[12px] leading-snug text-slate-600">→ {kq}</span>
    </div>
  );
  return (
    <Card className="p-4 sm:p-5">
      <SectionTitle icon={Mail} hint="khớp bảng luật đang chạy — email nhắc 2 giờ/lần, chỉ gửi trong khung 07:45–16:45">Email cảnh báo — bấm nút nào, vé đi đâu</SectionTitle>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl ring-1 ring-sky-200 bg-sky-50/40 p-4">
          <p className="text-[13px] font-bold text-sky-800">📧 Email IPC — toàn cảnh khu · 4 nút</p>
          <p className="mt-0.5 text-[10.5px] text-slate-500">nút hiện khi vé ở: Chưa xử lý · Mở lại (vé bế tắc: chỉ Cơ điện tự gỡ bằng "Đã có vật tư")</p>
          <div className="mt-3 space-y-2">
            <Dong nut="Chuyển Cơ điện xử lý" mau="bg-sky-100 text-sky-700" kq={<>vé sang <b>Đã báo Cơ điện</b> — đường duy nhất sang tay</>} />
            <Dong nut="Đã kiểm tra — Bình thường ✍" mau="bg-sky-100 text-sky-700" kq={<><b>ĐÓNG vé</b> — cảnh báo giả (IPC đã ra tận nơi, bắt ghi lý do)</>} />
            <Dong nut="Đã khắc phục sự cố ✍" mau="bg-sky-100 text-sky-700" kq={<><b>ĐÓNG vé</b> — IPC tự xử lý được tại chỗ</>} />
            <Dong nut="Không tại hiện trường ⟳" mau="bg-sky-100 text-sky-700" kq={<>vé đứng yên · <b>ân hạn 1 giờ</b>, quá thì lên Trực</>} />
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">Mail còn mục 2 <b>"Cơ điện đang xử lý"</b> — chỉ theo dõi, không nút. Vé đã sang Cơ điện thì IPC còn đúng 2 nút đóng (luật "mọi trạng thái" — không phải mất nút). <span className="text-rose-600 font-medium">Nhận mail rồi im lặng quá 20′ → vé tự lên Trực.</span></p>
        </div>
        <div className="rounded-2xl ring-1 ring-amber-200 bg-amber-50/40 p-4">
          <p className="text-[13px] font-bold text-amber-800">📧 Email Cơ điện — theo khu/AHU · đủ 5 nút ngay từ mail đầu</p>
          <p className="mt-0.5 text-[10.5px] text-slate-500">2 nút bấm được ngay + 3 nút 🔒 mở khóa SAU khi bấm "Đã nhận"</p>
          <div className="mt-3 space-y-2">
            <Dong nut="Đã nhận — đang xử lý" mau="bg-amber-100 text-amber-800" kq={<>vé sang <b>Đang xử lý</b> · đồng hồ im lặng nới thành 1 giờ</>} />
            <Dong nut="Không tại hiện trường ⟳" mau="bg-amber-100 text-amber-800" kq={<>vé đứng yên · <b>ân hạn 1 giờ</b>, quá thì lên Trực</>} />
            <Dong nut="Đã khắc phục ✍" khoa kq={<><b>ĐÓNG vé</b> — xong việc, hết email</>} />
            <Dong nut="Không thể xử lý ✍" khoa kq={<span className="text-rose-600"><b>bế tắc</b> — Trực + QA được báo NGAY LẬP TỨC</span>} />
            <Dong nut="Chờ xử lý (khi rảnh)" khoa kq={<>vé sang <b>Chờ xử lý</b> — vẫn nhắc 2h/lần, đồng hồ 1 giờ</>} />
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">Nút 🔒 là link thật: bấm <b>sau khi</b> "Đã nhận" là chạy luôn; bấm sớm máy chủ từ chối đúng trình tự, <b>không mất lượt</b>. <span className="text-rose-600 font-medium">Chưa nhận việc mà im lặng quá 15′ → vé lên Trực.</span></p>
        </div>
        <div className="rounded-2xl ring-1 ring-rose-200 bg-rose-50/40 p-4 lg:col-span-2">
          <p className="text-[13px] font-bold text-rose-800">🚨 Nhiệm vụ Trực HSL — tầng điều phối cuối · 3 nút</p>
          <p className="mt-0.5 text-[10.5px] text-slate-500">vé "kêu cứu" lên Trực khi: IPC im lặng &gt; 20′ · Cơ điện chưa nhận việc &gt; 15′ · đang/chờ xử lý &gt; 1 giờ · báo vắng quá 1 giờ · "không xử lý được" → lên NGAY + CC QA</p>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            <Dong nut="Nhắc IPC ⟳" mau="bg-rose-100 text-rose-700" kq={<>vé giữ nguyên — IPC nhận thêm mail nhắc ra hiện trường (có ghi hồ sơ)</>} />
            <Dong nut="Nhắc Cơ điện ⟳" mau="bg-rose-100 text-rose-700" kq={<>vé giữ nguyên — Cơ điện nhận thêm mail nhắc tiếp nhận / xử lý</>} />
            <Dong nut="Tạm dừng cảnh báo 4 giờ ✍" mau="bg-rose-100 text-rose-700" kq={<>tắt chuông tối đa <b>4 giờ</b>, bắt ghi lý do — vé NGHIÊM TRỌNG / phòng P1 chỉ QA · Quản trị được hoãn</>} />
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">Trực là <b>chốt chặn cuối</b>: chưa ai thao tác thì hệ nhắc Trực lại <b>mỗi 1 giờ</b> tới khi có người bấm nút. Ngoài vé leo thang, Trực còn nhận <b>email tổng quan ca 6h · 14h · 22h</b> điểm danh toàn bộ vé đang mở.</p>
        </div>
      </div>
      <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">Mỗi nút trong email là liên kết dùng <b>1 lần</b>, sống <b>4 giờ</b> — vé để lâu thì dùng email nhắc mới nhất. Bấm nút sẽ mở trang xác nhận, yêu cầu đăng nhập đúng vai trò và đúng khu; nút có ✍ bắt buộc ghi lý do. Email "vé đã đóng" không có nút — hết việc để bấm. Mọi email chỉ gửi trong khung giờ <b>07:45–16:45</b>; ngoài giờ vé vẫn chạy, sáng hôm sau gửi dồn trong ≤ 5 phút.</p>
    </Card>
  );
}

/* Memo (nâng cấp 07/07): 4 thẻ KPI + lưới thẻ phòng re-render toàn bộ mỗi nhịp 60s và
   mỗi lần bấm bất kỳ nút nào trên trang. Comparator BỎ QUA identity của prop hàm/objeto
   trang trí (onClick, accent tạo inline) — chỉ so giá trị hiển thị; hành vi hàm không đổi
   giữa các render nên bỏ qua identity là an toàn. */
const KpiCard = React.memo(function KpiCard({ icon: Icon, label, value, total, sub, accent, onClick, loading }) {
  const clickable = typeof onClick === "function";
  return (
    <Card className={`relative p-6 overflow-hidden ${clickable ? "cursor-pointer transition hover:-translate-y-0.5 hover:ring-teal-200" : ""}`}>
      {clickable ? <button onClick={onClick} className="absolute inset-0 z-10" aria-label={`Xem danh sách: ${label}`} /> : null}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${accent.glow} blur-2xl opacity-40`} />
      {/* Mảng 4: skeleton pulse khi CHƯA có số → không hiện "0" rồi nhảy (giảm CLS). */}
      <div className="relative flex items-start justify-between"><div><p className="text-[11px] uppercase tracking-[0.1em] text-slate-500 font-semibold">{label}</p>{loading ? <div className="mt-3 h-[3rem] w-20 rounded-lg bg-slate-100 animate-pulse" /> : <p className="mt-3 text-5xl font-light tabular-nums leading-none" style={{ color: COLOR.navy }}>{value}{total != null && <span className="text-xl text-slate-300 font-light">/{total}</span>}</p>}{loading ? <div className="mt-2 h-3 w-28 rounded bg-slate-100 animate-pulse" /> : <p className={`mt-2 text-xs font-medium ${accent.txt}`}>{sub}</p>}</div><div className={`rounded-2xl p-2.5 ${accent.bg}`}><Icon className={`w-5 h-5 ${accent.txt}`} strokeWidth={1.8} /></div></div>
      {clickable && <div className="relative mt-2 flex items-center gap-1 text-[10px] font-medium text-slate-400"><Eye className="w-3 h-3" strokeWidth={1.8} /> bấm để xem danh sách phòng</div>}
    </Card>
  );
}, (t, s) => t.label === s.label && t.value === s.value && t.total === s.total && t.sub === s.sub
   && t.loading === s.loading && t.icon === s.icon
   && (typeof t.onClick === "function") === (typeof s.onClick === "function")
   && t.accent.txt === s.accent.txt && t.accent.bg === s.accent.bg && t.accent.glow === s.accent.glow);

/* ===== OOS mini 8h — cột thuần CSS (KHÔNG dùng ECharts) =====
   Trước đây thẻ phòng ở tab Tổng quan (trang mặc định) render <Chart type="oosMini">
   → kéo cả chunk ECharts (~730KB) ngay màn hình đầu, dù chỉ để vẽ 8 cột đơn giản.
   Thay bằng cột div nhẹ → ECharts chỉ nạp khi mở Xu hướng / chi tiết phòng. */
const OosMiniBars = React.memo(function OosMiniBars({ data, h = 70 }) {
  const max = Math.max(1, ...data.map((d) => d.oos || 0));
  const barsH = h - 16;   // chừa ~16px cho nhãn giờ ở dưới
  return (
    <div className="w-full select-none" style={{ height: h }}>
      <div className="flex items-end gap-[3px]" style={{ height: barsH }}>
        {data.map((d, i) => { const v = d.oos || 0; const hb = v > 0 ? Math.max(2, Math.round((v / max) * barsH)) : 0; return (
          <div key={i} className="flex-1 flex items-end justify-center" title={`Giờ ${d.label} · ${v} điểm OOS`}>
            <div className="w-full rounded-t" style={{ height: hb, background: COLOR.softCoral }} />
          </div>
        ); })}
      </div>
      <div className="flex gap-[3px] mt-1">{data.map((d, i) => <div key={i} className="flex-1 text-center text-[10px] text-slate-400 tabular-nums leading-none truncate">{i % 2 === 0 ? d.label : ""}</div>)}</div>
    </div>
  );
});

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
function RoomManager({ rooms, cfg, canManage, onAdd, onEdit, onDelete, onUpdateLimit, onAddSensor, onRemoveSensor }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
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
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle icon={Building2} hint="thêm / sửa cảm biến & giới hạn / xóa">Quản lý phòng</SectionTitle>
        {canManage ? <button onClick={() => { setOpen((o) => !o); setEditId(null); }} className="text-xs font-medium text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: COLOR.coral }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm phòng</button> : <span className="text-[11px] text-slate-400">Cần quyền QA/Quản trị để chỉnh sửa</span>}
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
                <td className="py-2 pr-4"><select disabled={!canManage} value={r.priority} onChange={(e) => onEdit(r.id, { priority: e.target.value })} className="rounded-lg bg-white ring-1 ring-slate-200 px-2 py-1 text-[12px] disabled:bg-slate-50"><option value="P1">Mức 1</option><option value="P2">Mức 2</option><option value="P3">Mức 3</option></select></td>
                <td className="py-2 pr-4 text-slate-500">{r.noData ? "—" : r.sensors.map((s) => s.k).join(", ")}</td>
                <td className="py-2 pr-4">{lm ? <span className={`text-[11px] px-2 py-0.5 rounded-full ${lm.bg} ${lm.txt}`}>{lm.label}</span> : <span className="text-[11px] text-amber-600">Mất DL</span>}</td>
                <td className="py-2 pr-4">{canManage && <div className="flex gap-1.5"><button onClick={() => { setEditId(editId === r.id ? null : r.id); setOpen(false); }} className="text-sky-600 hover:text-sky-800" title="Sửa cảm biến/giới hạn"><Pencil className="w-4 h-4" strokeWidth={1.8} /></button><button onClick={() => onDelete(r.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" strokeWidth={1.8} /></button></div>}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>

      {editing && canManage && !editing.noData && (
        <div className="mt-4 rounded-2xl bg-teal-50/50 ring-1 ring-teal-100 p-4">
          <div className="flex items-center justify-between mb-3"><p className="text-sm font-semibold" style={{ color: COLOR.navy }}>Sửa cảm biến & giới hạn — {editing.id} ({editing.name})</p><button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button></div>
          <div className="space-y-2">
            {editing.sensors.map((s) => (
              <div key={s.k} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 flex items-center gap-2 text-[12px] flex-wrap">
                <span className="font-semibold w-16" style={{ color: COLOR.navy }}>{SENSOR_META[s.k].label}</span>
                <span className="text-slate-400">min</span><input type="number" value={s.min ?? ""} onChange={(e) => onUpdateLimit(editing.id, s.k, "min", e.target.value)} className="w-16 rounded ring-1 ring-slate-200 px-1.5 py-0.5" />
                <span className="text-slate-400">max</span><input type="number" value={s.max ?? ""} onChange={(e) => onUpdateLimit(editing.id, s.k, "max", e.target.value)} className="w-16 rounded ring-1 ring-slate-200 px-1.5 py-0.5" />
                <span className="text-slate-400">{SENSOR_META[s.k].unit}</span>
                <button onClick={() => onRemoveSensor(editing.id, s.k)} className="ml-auto text-rose-500 hover:text-rose-700 text-[11px] flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> bỏ</button>
              </div>
            ))}
          </div>
          {["DP", "RH", "T"].filter((k) => !editing.sensors.some((s) => s.k === k)).length > 0 && (
            <div className="flex items-center gap-2 mt-3"><span className="text-[11px] text-slate-500">Thêm cảm biến:</span>{["DP", "RH", "T"].filter((k) => !editing.sensors.some((s) => s.k === k)).map((k) => <button key={k} onClick={() => onAddSensor(editing.id, k)} className="text-[11px] rounded-lg px-2 py-1 ring-1 ring-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100 flex items-center gap-1"><Plus className="w-3 h-3" strokeWidth={2} /> {SENSOR_META[k].label}</button>)}</div>
          )}
        </div>
      )}
      <p className="text-[11px] text-slate-400 mt-3">Mọi thay đổi cập nhật ngay KPI, thẻ phòng và được ghi vào <b>lịch sử thay đổi cấu hình</b> (tab Nhật ký &amp; SOP).</p>
    </Card>
  );
}

/* ===== XU HƯỚNG ===== */
// Thống kê hồi quy tuyến tính cho 1 chuỗi số: trung bình, độ lệch chuẩn, độ dốc/điểm, R², min, max
function regStat(ys) {
  const n = ys.length;
  if (!n) return { n: 0 };
  const mean = ys.reduce((a, v) => a + v, 0) / n;
  const std = Math.sqrt(ys.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
  let slope = 0, r2 = 0;
  if (n >= 2) {
    const xm = (n - 1) / 2; let sxy = 0, sxx = 0, syy = 0;
    ys.forEach((y, i) => { sxy += (i - xm) * (y - mean); sxx += (i - xm) ** 2; syy += (y - mean) ** 2; });
    slope = sxx ? sxy / sxx : 0; r2 = (sxx && syy) ? (sxy * sxy) / (sxx * syy) : 0;
  }
  return { n, mean, std, slope, r2, vmin: Math.min(...ys), vmax: Math.max(...ys) };
}
// Hiển thị kết quả AI theo MỤC: tách theo "## TÊN MỤC", mỗi mục là 1 khối có tiêu đề + màu.
// Nếu văn bản không có marker "##" → hiển thị nguyên văn (tương thích kết quả cũ).
function AiSections({ text }) {
  if (!text) return null;
  const raw = String(text).trim();
  if (!/##\s+/.test(raw)) return <p className="text-[13px] leading-relaxed text-slate-600 whitespace-pre-line">{raw}</p>;
  const blocks = raw.split(/\n?##\s+/).map((s) => s.trim()).filter(Boolean);
  const META = [
    { kw: "DỮ LIỆU", icon: Gauge, c: COLOR.sky, bg: "bg-sky-50/70", ring: "ring-sky-100" },
    { kw: "PHÂN TÍCH", icon: Activity, c: COLOR.teal, bg: "bg-teal-50/70", ring: "ring-teal-100" },
    { kw: "BÁO CÁO", icon: FileBarChart, c: COLOR.navy, bg: "bg-slate-50", ring: "ring-slate-200" },
    { kw: "CAPA", icon: CheckCircle2, c: COLOR.coralDeep, bg: "bg-amber-50/70", ring: "ring-amber-100" },
  ];
  return <div className="space-y-3 mt-3">{blocks.map((b, idx) => {
    const nl = b.indexOf("\n");
    const title = (nl < 0 ? b : b.slice(0, nl)).trim();
    const body = (nl < 0 ? "" : b.slice(nl + 1)).trim();
    const m = META.find((x) => title.toUpperCase().includes(x.kw)) || { icon: Sparkles, c: COLOR.teal, bg: "bg-slate-50", ring: "ring-slate-200" };
    const Icon = m.icon;
    const lines = body.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
    // Gom các dòng BẢNG markdown (| a | b |) liền kề thành 1 khối bảng; còn lại là dòng chữ.
    const khoi = [];
    lines.forEach((l) => {
      const t = l.trim();
      if (t.startsWith("|") && t.endsWith("|")) {
        const last = khoi[khoi.length - 1];
        if (last && last.kind === "table") last.rows.push(t); else khoi.push({ kind: "table", rows: [t] });
      } else khoi.push({ kind: "line", text: l });
    });
    const parseRow = (r) => r.slice(1, -1).split("|").map((c) => c.trim());
    const laNgan = (cells) => cells.every((c) => /^[-: ]*$/.test(c));
    return (
      <div key={idx} className={`rounded-2xl ring-1 ${m.ring} ${m.bg} p-3.5`}>
        <div className="flex items-center gap-2 mb-1.5"><Icon className="w-4 h-4 shrink-0" style={{ color: m.c }} strokeWidth={1.9} /><h5 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: m.c }}>{title}</h5></div>
        <div className="space-y-1.5">{khoi.map((k, j) => {
          if (k.kind === "table") {
            const rows = k.rows.map(parseRow).filter((cells) => !laNgan(cells));
            if (!rows.length) return null;
            const [head, ...than] = rows;
            return (
              <div key={j} className="overflow-x-auto rounded-lg ring-1 ring-slate-200/80 bg-white/70 my-1">
                <table className="w-full text-[11.5px]">
                  <thead><tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50/80">{head.map((c, i) => <th key={i} className="py-1.5 px-2.5 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
                  <tbody>{than.map((r, ri) => <tr key={ri} className="border-t border-slate-100">{r.map((c, ci) => <td key={ci} className={`py-1.5 px-2.5 ${ci === 0 ? "font-medium text-slate-700" : "text-slate-600 tabular-nums"}`}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          }
          const t = k.text.trim();
          const bullet = t.startsWith("•") || t.startsWith("-");
          const txt = t.replace(/^[•-]\s*/, "");
          const warn = txt.startsWith("⚠");
          return <p key={j} className={`text-[12.5px] leading-relaxed ${warn ? "text-amber-700 font-medium" : "text-slate-600"} ${bullet ? "flex gap-1.5" : ""}`}>{bullet && <span className="mt-[2px] shrink-0" style={{ color: m.c }}>•</span>}<span>{txt}</span></p>;
        })}</div>
      </div>
    );
  })}</div>;
}


// In tab Xu hướng thành BÁO CÁO A4 chuẩn form: biểu đồ ECharts (canvas) được
// XUẤT THÀNH ẢNH (getDataURL, loại toolbox/dataZoom) — nếu chỉ copy innerHTML thì
// canvas ra TRẮNG. Giữ nguyên CSS ứng dụng để thẻ đẹp; thêm khổ giấy A4 + tiêu đề.
function printTrend(meta = {}) {
  try {
    const node = document.getElementById("trendPrintArea");
    if (!node) { window.print(); return; }
    const reg = window.__bmsEcharts;
    const instForCanvas = (canvas) => { let el = canvas.parentElement; while (el) { if (reg && reg.has(el)) return reg.get(el); el = el.parentElement; } return null; };
    // 1) Chụp từng canvas → ảnh (sạch, độ nét gấp đôi)
    const srcCanvases = Array.from(node.querySelectorAll("canvas"));
    const shots = srcCanvases.map((c) => {
      const w = c.clientWidth || c.width;
      try {
        const inst = instForCanvas(c);
        const url = inst ? inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff", excludeComponents: ["toolbox", "dataZoom"] }) : c.toDataURL("image/png");
        return { url, w };
      } catch { try { return { url: c.toDataURL("image/png"), w }; } catch { return null; } }
    });
    // 2) Nhân bản vùng in, thay canvas bằng <img>
    const clone = node.cloneNode(true);
    Array.from(clone.querySelectorAll("canvas")).forEach((c, i) => {
      const s = shots[i];
      if (s && s.url) { const img = document.createElement("img"); img.src = s.url; img.style.width = "100%"; img.style.maxWidth = (s.w || 640) + "px"; img.style.height = "auto"; img.style.display = "block"; c.replaceWith(img); }
    });
    // 3) Giữ nguyên CSS ứng dụng (link tuyệt đối + style inline) để thẻ hiển thị đẹp
    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => `<link rel="stylesheet" href="${l.href}">`).join("\n");
    const styleTags = Array.from(document.querySelectorAll("style")).map((n) => n.outerHTML).join("\n");
    const logo = document.querySelector('img[alt="CPC1 Hà Nội"]');
    const logoSrc = logo ? logo.src : "";
    const now = new Date().toLocaleString("vi-VN");
    const phamVi = meta.phamVi || meta.scope || "";
    const detail = [meta.sensor ? `Chỉ tiêu: ${meta.sensor}` : "", meta.range ? `Khoảng: ${meta.range}` : "", meta.res ? `Độ phân giải: ${meta.res}` : "", meta.window ? `Cửa sổ thời gian: ${meta.window}` : ""].filter(Boolean).join(" · ");
    const win = window.open("", "PRINT", "height=900,width=1200");
    // KHÔNG rơi về window.print() (sẽ in CẢ trang gồm tìm kiếm/xếp hạng) — báo người dùng cho phép pop-up.
    if (!win) { try { alert("Trình duyệt đang chặn cửa sổ in. Hãy CHO PHÉP pop-up cho trang này rồi bấm In lại — báo cáo chỉ in phần nội dung (không kèm tìm kiếm/xếp hạng)."); } catch (_) { /* bỏ qua */ } return; }
    win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo xu hướng GMP — ${meta.scope || ""}</title>
${linkTags}
${styleTags}
<style>
  @page { size: A4 portrait; margin: 12mm 10mm; }
  html, body { background:#fff !important; }
  body { font-family: Inter, 'Segoe UI', sans-serif; color:#102A3E; -webkit-print-color-adjust:exact; print-color-adjust:exact; margin:0; }
  .rp-wrap { max-width: 190mm; margin: 0 auto; }
  .rp-head { display:flex; align-items:center; gap:12px; border-bottom:2px solid #0E7C73; padding-bottom:10px; margin-bottom:14px; }
  .rp-head img { height:46px; width:auto; }
  .rp-title { font-size:15px; font-weight:800; color:#102A3E; line-height:1.25; }
  .rp-sub { font-size:10.5px; color:#5f7a90; margin-top:3px; }
  .rp-scope { font-size:12.5px; font-weight:800; color:#102A3E; margin-top:5px; letter-spacing:.2px; }
  .rp-scope b { color:#0E7C73; }
  .rp-meta { font-size:10.5px; color:#5f7a90; font-weight:600; margin-top:2px; }
  #trendPrintArea { display:block !important; }
  #trendPrintArea > * { break-inside: avoid; page-break-inside: avoid; margin-bottom:12px; }
  /* Bảng cuộn → in đầy đủ */
  .max-h-72, .max-h-32 { max-height:none !important; overflow:visible !important; }
  .overflow-auto, .overflow-x-auto, .overflow-y-auto { overflow:visible !important; }
  table { width:100%; border-collapse:collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  img { break-inside: avoid; }
  .rp-foot { margin-top:10px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:9.5px; color:#94a3b8; text-align:center; }
</style></head>
<body><div class="rp-wrap">
  <div class="rp-head">${logoSrc ? `<img src="${logoSrc}" alt="logo"/>` : ""}<div><div class="rp-title">CÔNG TY CPC1 HÀ NỘI — Giám sát môi trường HVAC phòng sạch GMP</div><div class="rp-sub">BÁO CÁO XU HƯỚNG · xuất lúc ${now}</div>${phamVi ? `<div class="rp-scope">PHẠM VI IN: <b>${phamVi}</b></div>` : ""}${detail ? `<div class="rp-meta">${detail}</div>` : ""}</div></div>
  ${clone.outerHTML}
  <div class="rp-foot">Số liệu tất định do hệ thống tính (giới hạn GHD/GHT theo phòng trong CSDL). AI chỉ hỗ trợ gợi ý — kết luận GMP do IPC/QA phê duyệt.</div>
</div>
<scr` + `ipt>window.onload=function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},450);};</scr` + `ipt>
</body></html>`);
    win.document.close(); win.focus();
  } catch (e) { try { window.print(); } catch (_) { /* bỏ qua */ } }
}


// ====== COMBOBOX TÌM KIẾM (kiểu web bán hàng) cho chọn đối tượng ======
// Gõ để lọc; danh sách thả xuống có highlight, %đạt, khu/AHU; chọn bằng chuột hoặc bàn phím.
function ScopeCombobox({ items, value, onPick, placeholder, levelLabel }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState(null);
  const boxRef = useRef(null);
  const listRef = useRef(null);
  const cur = items.find((o) => o.id === value) || null;

  // click ngoài: bỏ qua cả ô input (boxRef) lẫn danh sách trong portal (listRef)
  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && boxRef.current.contains(e.target)) return;
      if (listRef.current && listRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // tính vị trí cố định của danh sách theo ô input; cập nhật khi mở / cuộn / đổi kích thước
  useEffect(() => {
    if (!open) return;
    const upd = () => { if (boxRef.current) { const r = boxRef.current.getBoundingClientRect(); setPos({ left: r.left, top: r.bottom + 6, width: r.width }); } };
    upd();
    window.addEventListener("scroll", upd, true);
    window.addEventListener("resize", upd);
    return () => { window.removeEventListener("scroll", upd, true); window.removeEventListener("resize", upd); };
  }, [open]);
  useEffect(() => { setHi(0); }, [q, open]);

  const ql = q.trim().toLowerCase();
  const filtered = ql ? items.filter((o) => `${o.id} ${o.name}`.toLowerCase().includes(ql)) : items;

  const pick = (o) => { if (!o) return; onPick(o.id); setOpen(false); setQ(""); };
  const onKey = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(filtered[hi]); }
    else if (e.key === "Escape") { setOpen(false); }
  };
  useEffect(() => {
    if (open && listRef.current) { const el = listRef.current.querySelector(`[data-i="${hi}"]`); if (el) el.scrollIntoView({ block: "nearest" }); }
  }, [hi, open]);

  const pctColor = (p) => (p == null ? "#94a3b8" : p < 70 ? COMPLY_BAD : p < 88 ? "#d99a2b" : COMPLY_OK);
  const hl = (text) => {
    if (!ql) return text;
    const i = text.toLowerCase().indexOf(ql);
    if (i < 0) return text;
    return (<>{text.slice(0, i)}<mark className="bg-amber-200/70 text-inherit rounded px-0.5">{text.slice(i, i + ql.length)}</mark>{text.slice(i + ql.length)}</>);
  };

  return (
    <div className="relative flex-1 min-w-[260px]" ref={boxRef}>
      <div className={`flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ${open ? "ring-2 ring-teal-300" : "ring-slate-200"} transition`}>
        <Search className="w-4 h-4 text-slate-400 shrink-0" strokeWidth={1.8} />
        <input
          value={open ? q : (cur ? `${cur.id} — ${cur.name}` : q)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="w-full text-[13px] text-slate-700 outline-none bg-transparent placeholder:text-slate-400"
        />
        {cur && cur.latest && cur.latest.compliance != null && !open && (
          <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: pctColor(cur.latest.compliance) }}>{fmtPct(cur.latest.compliance)}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition cursor-pointer ${open ? "rotate-180" : ""}`} strokeWidth={1.8} onClick={() => setOpen((v) => !v)} />
      </div>
      {open && pos && createPortal(
        <div ref={listRef} style={{ position: "fixed", left: pos.left, top: pos.top, width: pos.width, zIndex: 9999 }} className="max-h-72 overflow-auto rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl shadow-slate-400/30 py-1.5">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between"><span>{levelLabel}</span><span>{filtered.length} kết quả</span></div>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-slate-400">Không tìm thấy — thử từ khoá khác</div>
          ) : filtered.map((o, i) => {
            const p = o.latest && o.latest.compliance != null ? o.latest.compliance : null;
            const isSel = o.id === value;
            return (
              <button key={o.id} data-i={i} onMouseEnter={() => setHi(i)} onClick={() => pick(o)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 ${i === hi ? "bg-teal-50" : ""} ${isSel ? "bg-teal-50/60" : ""}`}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pctColor(p) }} />
                <span className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold" style={{ color: COLOR.navy }}>{hl(o.id)}</span>
                  <span className="text-[13px] text-slate-500"> — {hl(o.name)}</span>
                  {(o.area || o.ahu) && <span className="block text-[10px] text-slate-400 truncate">{[o.area, o.ahu].filter(Boolean).join(" · ")}</span>}
                </span>
                {p != null && <span className="text-[11px] font-semibold tabular-nums shrink-0" style={{ color: pctColor(p) }}>{fmtPct(p)}</span>}
                {isSel && <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" strokeWidth={2.2} />}
              </button>
            );
          })}
        </div>, document.body)}
    </div>
  );
}

function TrendPage({ onAI, isLive = false, liveRisk = null, liveRooms = null, liveIncidents = null, khuChoPhep = null, onSaveAI = null }) {
  // Ghi nhớ lựa chọn giữa các lần vào (localStorage) — chỉ lưu tuỳ chọn nhẹ, không lưu dữ liệu.
  const LS_KEY = "bms_trend_prefs";
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } })();
  const [range, setRange] = useState(["1n", "7n", "30n", "90n", "180n"].includes(prefs.range) ? prefs.range : "30n");
  const [level, setLevel] = useState(["TOTAL", "AREA", "AHU", "ROOM"].includes(prefs.level) ? prefs.level : "TOTAL");
  const [selId, setSelId] = useState("");
  const [sensor, setSensor] = useState(["ALL", "DP", "RH", "T"].includes(prefs.sensor) ? prefs.sensor : "ALL");
  const [resOverride, setResOverride] = useState(["GIO"].includes(prefs.res) ? prefs.res : null); // độ phân giải khung dưới-ngày (chỉ còn GIO sau khi bỏ 30 phút)
  const [optArea, setOptArea] = useState("ALL");
  const [optAhu, setOptAhu] = useState("ALL");
  const [dtFrom, setDtFrom] = useState("");
  const [dtTo, setDtTo] = useState("");
  const [dtFromDraft, setDtFromDraft] = useState("");
  const [dtToDraft, setDtToDraft] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);        // đang gọi AI qua workflow
  const [dangInBaoCao, setDangInBaoCao] = useState(false); // đang chuẩn bị in (chờ AI xong)
  const [aiNote, setAiNote] = useState(null);         // ghi chú trạng thái (vd: lỗi → dùng bản cục bộ)
  const [aiWebhook, setAiWebhook] = useState("");     // URL WF7 (nếu cấu hình)
  const [aiWebhookSau, setAiWebhookSau] = useState(""); // URL WF7-sâu (phân tích chuyên sâu)
  const [wf7bUrl, setWf7bUrl] = useState("");         // URL WF7b — gửi email / lưu Drive nhận định
  const [emailTo, setEmailTo] = useState("");         // người nhận email (điền sẵn từ người nhận báo cáo)
  const [emailOpen, setEmailOpen] = useState(false);  // mở ô nhập email
  const [sendBusy, setSendBusy] = useState("");       // "" | "email" | "drive"
  const [sendMsg, setSendMsg] = useState(null);       // { ok, text }
  const [soKyTruoc, setSoKyTruoc] = useState(!!prefs.prevCmp); // A3: bật đường "kỳ trước" (chỉ khung NGÀY)
  const [prevSeries, setPrevSeries] = useState({});   // {trendKey: chuỗi kỳ TRƯỚC (cùng độ dài)}
  // Mảng 3: dự báo (RPC gate R²) + bản đồ nhiệt phòng×ngày. Cache theo khoá scope|sensor.
  const [duBao, setDuBao] = useState(null);           // {du_bao_dang_tin, huong, r2, ghi_chu, chuoi, du_bao[]}
  const [maTran, setMaTran] = useState(null);         // {rooms[], days[], values[][]}
  const [dbBusy, setDbBusy] = useState(false);
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const [u, us] = await Promise.all([layWebhookAi(), layWebhookAiSau().catch(() => "")]); if (huy) return; setAiWebhook(u || ""); setAiWebhookSau(us || ""); })(); return () => { huy = true; }; }, [isLive]);
  // WF7b: URL gửi email/lưu Drive + điền sẵn người nhận email từ danh sách người nhận báo cáo.
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const [u, ds] = await Promise.all([layWebhookWf7b(), layNguoiNhanBaoCao().catch(() => ({ rows: [] }))]); if (huy) return; setWf7bUrl(u || ""); const emails = ((ds && ds.rows) || []).map((r) => r.email).filter(Boolean); setEmailTo(emails.join(", ")); })(); return () => { huy = true; }; }, [isLive]);
  const RANGE_DAYS = { "1n": 1, "7n": 7, "30n": 30, "90n": 90, "180n": 180 };
  // Độ phân giải: 30n/90n/Từ-đầu → NGÀY; 1n/7n → THEO GIỜ (dữ liệu thu thập 1 giờ/lần, bỏ mốc 30 phút cũ).
  const donVi = (range === "30n" || range === "90n" || range === "180n") ? "NGAY" : "GIO";
  const soDiem = range === "1n" ? 24 : range === "7n" ? 168 : (RANGE_DAYS[range] || 30);  // GIO: số GIỜ; NGAY: số ngày
  const resLbl = donVi === "GIO" ? "theo giờ" : "theo ngày";
  const isSubDay = donVi === "GIO";
  // Lưu lựa chọn nhẹ
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify({ range, level, sensor, res: resOverride, prevCmp: soKyTruoc })); } catch { /* bỏ qua */ } }, [range, level, sensor, resOverride, soKyTruoc]);
  const [liveSeries, setLiveSeries] = useState({});   // {scopeId: chuỗi 90 ngày ALL} — cho mini-scope & thẻ kỳ
  const [mainSeries, setMainSeries] = useState({});   // {`id|sensor|range`: chuỗi chính (giờ/ngày + đúng cảm biến)}
  const [roomBand, setRoomBand] = useState({});       // {`room|sensor|range`: chuỗi giá trị TB + giới hạn (phòng)}
  const [roomBandsMulti, setRoomBandsMulti] = useState({}); // {`room|range`: { DP:series, RH:series, T:series }} — hiện CẢ 3 chỉ tiêu
  const [multiSensor, setMultiSensor] = useState({}); // {`room|range`: [{k, series}]} — vẽ ĐỦ DP/RH/T của 1 phòng

  // Vũ trụ scope ở chế độ LIVE — DỰNG TỪ DANH SÁCH PHÒNG (luôn có dữ liệu nhờ WF1)
  //   rồi LÀM GIÀU bằng bảng xếp hạng rủi ro v2 (tỉ lệ đạt 1/3/7 ngày + chuỗi 14 ngày).
  //   → KHẮC PHỤC lỗi "chưa xem được cấp phòng": phòng/AHU/khu LUÔN xuất hiện,
  //     không còn phụ thuộc rollup KPI ngày.
  const liveScopes = useMemo(() => {
    if (!isLive) return [];
    const rs = liveRooms || [];
    // Bản đồ làm giàu theo "type:id" từ RPC rủi ro v2 (nếu đã nạp file 19)
    const riskById = {};
    (liveRisk || []).forEach((r) => { if (r && r.type && r.id != null) riskById[`${r.type}:${r.id}`] = r; });
    const enrich = (sc) => {
      const e = riskById[`${sc.type}:${sc.id}`];
      if (!e) return sc;
      return {
        ...sc,
        risk: e.risk != null ? e.risk : sc.risk,
        delta7: e.delta7 != null ? e.delta7 : sc.delta7,
        dat1n: e.dat1n != null ? e.dat1n : sc.dat1n,
        dat3n: e.dat3n != null ? e.dat3n : sc.dat3n,
        dat7n: e.dat7n != null ? e.dat7n : sc.dat7n,
        chuoi: (e.chuoi && e.chuoi.length) ? e.chuoi : sc.chuoi,
        latest: { compliance: e.compliance != null ? e.compliance : sc.latest.compliance },
      };
    };
    const mkRoom = (r) => {
      const comp = r._compliance != null ? r._compliance : null;
      return { type: "ROOM", id: r.id, name: r.name || r.id, area: r.area || undefined, ahu: r.ahu || undefined,
        risk: comp != null ? Math.max(0, Math.round(100 - comp)) : 999, delta7: null,
        dat1n: comp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: comp }, daily: [{ compliance: comp }] };
    };
    const roomScopes = rs.filter((r) => !r.noData).map(mkRoom);
    const aggBy = (keyOf, type, nameOf) => {
      const g = {};
      roomScopes.forEach((s) => { const k = keyOf(s); if (!k) return; (g[k] = g[k] || []).push(s); });
      return Object.entries(g).map(([k, arr]) => {
        const vals = arr.map((s) => s.latest.compliance).filter((v) => v != null);
        const comp = vals.length ? +(vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1) : null;
        return { type, id: k, name: nameOf ? nameOf(k) : k, area: type === "AREA" ? k : undefined, ahu: type === "AHU" ? k : undefined,
          risk: comp != null ? Math.max(0, Math.round(100 - comp)) : 999, delta7: null,
          dat1n: comp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: comp }, daily: [{ compliance: comp }] };
      });
    };
    const areaScopes = aggBy((s) => s.area, "AREA");
    const ahuScopes = aggBy((s) => s.ahu, "AHU");
    const allVals = roomScopes.map((s) => s.latest.compliance).filter((v) => v != null);
    const totalComp = allVals.length ? +(allVals.reduce((a, v) => a + v, 0) / allVals.length).toFixed(1) : null;
    // Tài khoản giới hạn khu: server đã tự lọc mọi chuỗi/scope → "TOTAL" thực chất
    // là gộp các khu được xem; đặt tên đúng bản chất để không gây hiểu nhầm.
    const totalScope = { type: "TOTAL", id: "ALL", name: khuChoPhep ? `Phạm vi được xem (khu ${khuChoPhep.join(" · ")})` : "Toàn hệ thống", risk: 0, delta7: null,
      dat1n: totalComp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: totalComp }, daily: [{ compliance: totalComp }] };
    return [totalScope, ...areaScopes, ...ahuScopes, ...roomScopes].map(enrich);
  }, [isLive, liveRooms, liveRisk, khuChoPhep]);
  const lByType = (t) => liveScopes.filter((s) => s.type === t).sort((a, b) => b.risk - a.risk);
  const lFind = (id) => liveScopes.find((s) => s.id === id);

  // Danh sách Khu / AHU lấy TỪ DỮ LIỆU thật (không hardcode) — #2
  const areaList = useMemo(() => {
    const src = isLive ? (liveRooms || []) : MASTER.filter((m) => m.type === "ROOM");
    return [...new Set(src.map((r) => r.area).filter(Boolean))].sort();
  }, [isLive, liveRooms]);
  const ahuList = useMemo(() => {
    let src = isLive ? (liveRooms || []) : MASTER.filter((m) => m.type === "ROOM");
    if (optArea !== "ALL") src = src.filter((r) => r.area === optArea);
    return [...new Set(src.map((r) => r.ahu).filter(Boolean))].sort();
  }, [isLive, liveRooms, optArea]);

  const allOptions = useMemo(() => isLive ? (level === "TOTAL" ? lByType("TOTAL") : lByType(level)) : (level === "TOTAL" ? [findScope("ALL")] : byType(level)), [isLive, level, liveScopes]); // eslint-disable-line
  const options = useMemo(() => allOptions.filter((o) => o
    && (optArea === "ALL" || o.area === optArea)
    && (optAhu === "ALL" || o.ahu === optAhu)
  ), [allOptions, optArea, optAhu]);
  const activeId = selId && options.some((o) => o.id === selId) ? selId : (options[0] ? options[0].id : "ALL");
  const activeScope = (isLive ? lFind(activeId) : findScope(activeId)) || (isLive ? (liveScopes[0] || { id: "ALL", name: "—", daily: [{}], latest: {} }) : findScope("ALL"));
  const trendKey = `${activeId}|${sensor}|${range}|${donVi}`;   // khóa cache chuỗi chính (kèm độ phân giải)

  // Mảng 3 — LIVE: dự báo (gate R²) + ma trận phòng×ngày cho scope/cảm biến đang chọn.
  // Heatmap chỉ có nghĩa ở cấp Tổng/Khu (nhiều phòng); Tổng/AHU/Phòng đều dự báo được.
  useEffect(() => {
    if (!isLive || !activeId) { setDuBao(null); setMaTran(null); return; }
    let huy = false;
    const st = activeScope.type || "TOTAL";
    // Heatmap phòng×ngày chỉ có nghĩa ở cấp có NHIỀU phòng (Tổng/Khu); AHU/Phòng → bỏ.
    const capHeatmap = st === "TOTAL" || st === "AREA";
    const hmType = st === "AREA" ? "AREA" : "TOTAL";
    const hmId = st === "AREA" ? activeId : "ALL";
    const soNgayHm = Math.min(14, RANGE_DAYS[range] || 30);
    (async () => {
      setDbBusy(true);
      try {
        const [fc, mt] = await Promise.all([
          layDuBaoXuHuong(st, activeId, sensor, 30, 7),
          capHeatmap ? layMaTranPhongNgay(hmType, hmId, sensor, soNgayHm, 20) : Promise.resolve({ rooms: [] }),
        ]);
        if (huy) return;
        setDuBao(fc && fc.du_bao ? fc.du_bao : null);
        setMaTran(mt && mt.rooms && mt.rooms.length ? mt : null);
      } catch { if (!huy) { setDuBao(null); setMaTran(null); } }
      finally { if (!huy) setDbBusy(false); }
    })();
    return () => { huy = true; };
  }, [isLive, activeScope.type, activeId, sensor, range]); // eslint-disable-line

  // LIVE: tải chuỗi 90 ngày cho scope đang chọn + 4 scope mini (cache theo id)
  const miniIds = useMemo(() => isLive ? [lByType("TOTAL")[0], lByType("AREA")[0], lByType("AHU")[0], lByType("ROOM")[0]].map((s) => s && s.id).filter(Boolean) : [], [isLive, liveScopes]); // eslint-disable-line
  useEffect(() => {
    if (!isLive) return;
    const need = [activeId, ...miniIds].filter((id, i, a) => id && a.indexOf(id) === i && !liveSeries[id]);
    if (!need.length) return;
    let huy = false;
    (async () => {
      const got = await Promise.all(need.map((id) => { const sc = lFind(id); return layChuoiXuHuong(sc ? sc.type : "TOTAL", id, "ALL", 90); }));
      if (huy) return;
      setLiveSeries((m) => { const n = { ...m }; need.forEach((id, i) => { n[id] = (got[i] && got[i].series) || []; }); return n; });
    })();
    return () => { huy = true; };
  }, [isLive, activeId, miniIds]); // eslint-disable-line

  // LIVE: chuỗi CHÍNH cho biểu đồ — phụ thuộc scope · cảm biến · khoảng.
  // #3: 24 giờ & 7 ngày → THEO GIỜ; chỉ 30 ngày & 90 ngày → theo NGÀY.
  useEffect(() => {
    if (!isLive || !activeId) return;
    if (mainSeries[trendKey]) return;                 // đã có cache
    const sc = lFind(activeId);
    let huy = false;
    (async () => {
      const r = await layChuoiXuHuongChiTiet(sc ? sc.type : "TOTAL", activeId, sensor, donVi, soDiem);
      if (huy) return;
      setMainSeries((m) => ({ ...m, [trendKey]: (r && r.series) || [] }));
    })();
    return () => { huy = true; };
  }, [isLive, activeId, sensor, range, donVi]); // eslint-disable-line

  // A3 — SO KỲ TRƯỚC: chỉ khung NGÀY (30n/90n). Lấy 2× số ngày từ CÙNG RPC rồi
  //   cắt NỬA ĐẦU làm "kỳ trước" — không cần sửa backend, canh theo index.
  useEffect(() => {
    if (!isLive || !activeId || !soKyTruoc || donVi !== "NGAY") return;
    if (prevSeries[trendKey]) return;
    const sc = lFind(activeId);
    let huy = false;
    (async () => {
      const r = await layChuoiXuHuongChiTiet(sc ? sc.type : "TOTAL", activeId, sensor, "NGAY", soDiem * 2);
      if (huy) return;
      const s = (r && r.series) || [];
      setPrevSeries((m) => ({ ...m, [trendKey]: s.slice(0, Math.max(0, s.length - soDiem)) }));
    })();
    return () => { huy = true; };
  }, [isLive, activeId, sensor, range, donVi, soKyTruoc]); // eslint-disable-line

  // LIVE: chuỗi GIÁ TRỊ TRUNG BÌNH + giới hạn cho 1 PHÒNG · 1 CẢM BIẾN (#4)
  //   chỉ tải khi đang xem cấp PHÒNG và đã chọn 1 chỉ tiêu cụ thể (DP/RH/T).
  const roomBandKey = `${activeId}|${sensor}|${range}|${donVi}`;
  const wantRoomBand = isLive && activeScope && activeScope.type === "ROOM" && ["DP", "RH", "T"].includes(sensor);
  useEffect(() => {
    if (!wantRoomBand) return;
    if (roomBand[roomBandKey]) return;
    let huy = false;
    (async () => {
      const r = await layChuoiGiaTriPhong(activeId, sensor, donVi, soDiem);
      if (huy) return;
      setRoomBand((m) => ({ ...m, [roomBandKey]: (r && r.series) || [] }));
    })();
    return () => { huy = true; };
  }, [wantRoomBand, activeId, sensor, range, donVi]); // eslint-disable-line

  // LIVE: nạp band TB + giới hạn cho CẢ 3 chỉ tiêu (DP/RH/T) của phòng — để hiện đồng thời.
  const roomBandsKey = `${activeId}|${range}|${donVi}`;
  const wantRoomBands = isLive && activeScope && activeScope.type === "ROOM";
  useEffect(() => {
    if (!wantRoomBands) return;
    if (roomBandsMulti[roomBandsKey]) return;
    let huy = false;
    (async () => {
      // Mảng 4 (tốc độ): 3 RPC DP/RH/T ĐỘC LẬP → chạy SONG SONG (Promise.all)
      // thay vì tuần tự for…await (nhanh ~3× khi mở chi tiết phòng).
      const ks = ["DP", "RH", "T"];
      const rs = await Promise.all(ks.map((k) => layChuoiGiaTriPhong(activeId, k, donVi, soDiem)));
      if (huy) return;
      const out = {};
      ks.forEach((k, i) => {
        const r = rs[i];
        const s = (r && r.series) || [];
        if (s.length) out[k] = { series: s, baseline: r.baseline || null };   // kèm baseline 30 ngày
      });
      if (!huy) setRoomBandsMulti((m) => ({ ...m, [roomBandsKey]: out }));
    })();
    return () => { huy = true; };
  }, [wantRoomBands, activeId, range, donVi]); // eslint-disable-line

  // chuỗi ĐA CẢM BIẾN (vẽ đủ DP/RH/T) — tải cho MỌI cấp: phòng/khu/AHU/tổng.
  const multiKey = `${activeScope?.type || "TOTAL"}|${activeId}|${range}|${donVi}`;
  const wantMulti = isLive && !!activeScope;
  useEffect(() => {
    if (!wantMulti) return;
    if (multiSensor[multiKey]) return;
    const scType = activeScope.type || "TOTAL";
    let huy = false;
    (async () => {
      const r = await layChuoiXuHuongDaSensor(scType, activeId, donVi, soDiem);
      if (huy) return;
      setMultiSensor((m) => ({ ...m, [multiKey]: (r && r.perSensor) || [] }));
    })();
    return () => { huy = true; };
  }, [wantMulti, activeId, range, donVi, activeScope]); // eslint-disable-line

  // Gộp chuỗi đa cảm biến theo mốc thời gian → {ts,label,comp_DP,oos_DP,comp_RH,...}
  const multiMerged = useMemo(() => {
    if (!wantMulti) return [];
    const ps = multiSensor[multiKey] || [];
    const byTs = new Map();
    ps.forEach((g) => (g.series || []).forEach((p) => {
      const cur = byTs.get(p.ts) || { ts: p.ts, label: p.label };
      cur[`comp_${g.k}`] = p.comp; cur[`oos_${g.k}`] = p.oos;
      byTs.set(p.ts, cur);
    }));
    return [...byTs.values()].sort((a, b) => a.ts - b.ts);
  }, [wantMulti, multiSensor, multiKey]);
  const sensorsPresent = useMemo(() => (wantMulti ? (multiSensor[multiKey] || []).map((g) => g.k) : []), [wantMulti, multiSensor, multiKey]);
  const full = isLive ? (mainSeries[trendKey] || []) : getSeries(activeScope, sensor, range);
  const minTs = full[0]?.ts, maxTs = full[full.length - 1]?.ts;
  // Ô "Từ → đến" TỰ hiển thị mốc dữ liệu thật (điểm đầu có dữ liệu → điểm cuối) khi chưa có
  // bộ lọc/nháp nào — chạy khi dữ liệu nạp xong lần đầu, đổi Khoảng/cấp xem, hoặc bấm Đặt lại/Toàn khoảng.
  useEffect(() => {
    if (!minTs || !maxTs) return;
    if (dtFrom || dtTo || dtFromDraft || dtToDraft) return;   // user đang lọc/soạn → không đè
    setDtFromDraft(toLocalInput(minTs));
    setDtToDraft(toLocalInput(maxTs));
  }, [minTs, maxTs, dtFrom, dtTo, dtFromDraft, dtToDraft]);
  const fromMs = dtFrom ? new Date(dtFrom).getTime() : minTs;
  const toMs = dtTo ? new Date(dtTo).getTime() : maxTs;
  const series = full.filter((r) => r.ts >= Math.min(fromMs, toMs) && r.ts <= Math.max(fromMs, toMs));
  const view = series.length ? series : full;
  const isHourly = range === "1n" || range === "7n";   // #3: 24 giờ & 7 ngày theo GIỜ
  // #3 — chuỗi đa cảm biến đã lọc theo cùng cửa sổ thời gian
  const viewMulti = useMemo(() => {
    if (!wantMulti || !multiMerged.length) return [];
    const f = multiMerged.filter((r) => r.ts >= Math.min(fromMs, toMs) && r.ts <= Math.max(fromMs, toMs));
    return f.length ? f : multiMerged;
  }, [wantMulti, multiMerged, fromMs, toMs]);
  const showMulti = wantMulti && sensor === "ALL" && viewMulti.length > 0 && sensorsPresent.length > 0;
  const isRoom = !!activeScope && activeScope.type === "ROOM";
  const isLargeScope = !!activeScope && !isRoom;  // TOTAL / AREA / AHU

  // A3 — đường "kỳ trước" (mờ, đứt): chỉ khi khung NGÀY + không lọc thời gian con.
  const prevData = (soKyTruoc && donVi === "NGAY" && !dtFrom && !dtTo && (prevSeries[trendKey] || []).length)
    ? (prevSeries[trendKey] || []).map((p) => p.comp) : null;
  // A3 — overlay SỰ CỐ (⚑) lên đường xu hướng: lọc theo phạm vi đang xem, tìm điểm gần nhất.
  const incidentMarks = useMemo(() => {
    if (!isLive || !liveIncidents || !liveIncidents.length || !view.length) return null;
    const roomsById = {}; (liveRooms || []).forEach((r) => { roomsById[r.id] = r; });
    const step = view.length > 1 ? Math.abs((view[view.length - 1].ts - view[0].ts) / (view.length - 1)) : 86400000;
    const marks = [];
    liveIncidents.forEach((s) => {
      if (s.startTs == null) return;
      const r = roomsById[s.room];
      const ok = activeScope.type === "TOTAL" ? true
        : activeScope.type === "ROOM" ? s.room === activeId
        : activeScope.type === "AREA" ? (r && r.area === activeId)
        : (r && r.ahu === activeId);
      if (!ok) return;
      if (s.startTs < view[0].ts - step / 2 || s.startTs > view[view.length - 1].ts + step / 2) return;
      let best = 0, bd = Infinity;
      view.forEach((p, i) => { const d = Math.abs(p.ts - s.startTs); if (d < bd) { bd = d; best = i; } });
      marks.push({ idx: best, name: `${s.id} · ${s.room} ${s.sensor}` });
    });
    return marks.length ? marks : null;
  }, [isLive, liveIncidents, liveRooms, view, activeScope, activeId]);
  // A2 — lịch tuân thủ 90 ngày (ô ngày, giờ LOCAL để không lệch múi giờ VN)
  const calDays = useMemo(() => {
    if (!isLive) return [];
    return (liveSeries[activeId] || []).map((p) => {
      const d = new Date(p.ts);
      return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, value: p.comp };
    });
  }, [isLive, liveSeries, activeId]);

  const latest = view[view.length - 1] || {};
  const prev = view[view.length - 2] || {};
  const deltaDay = latest.comp != null && prev.comp != null ? +(latest.comp - prev.comp).toFixed(1) : null;
  const wk = view.length > 7 ? view[view.length - 8] : view[0];
  const delta7 = latest.comp != null && wk?.comp != null ? +(latest.comp - wk.comp).toFixed(1) : null;
  const totalAlert = view.reduce((a, r) => a + r.alert, 0);

  const periodCards = useMemo(() => [1, 7, 30, 90].map((d) => {
    let sl;
    if (isLive) { const all = liveSeries[activeId] || []; sl = all.slice(-d).map((r) => ({ compliance: r.comp, warnH: r.warnH, critH: r.critH })); }
    else { sl = activeScope.daily.slice(-d).map((r) => applySensor(r, sensor)); }
    const warn = sl.reduce((a, r) => a + (r.warnH || 0), 0), crit = sl.reduce((a, r) => a + (r.critH || 0), 0);
    const avg = sl.length ? sl.reduce((a, r) => a + (r.compliance || 0), 0) / sl.length : null;
    return { d, avail: sl.length, warn, crit, alert: warn + crit, avg, status: sl.length < d ? "PARTIAL" : "FULL" };
  }), [isLive, activeScope, sensor, liveSeries, activeId]);
  const miniScopes = isLive
    ? [["TOTAL", lByType("TOTAL")[0]], ["AREA", lByType("AREA")[0]], ["AHU", lByType("AHU")[0]], ["ROOM", lByType("ROOM")[0]]].map(([lvl, sc]) => [lvl, sc ? { ...sc, _series: liveSeries[sc.id] || [] } : { id: "—", name: "—", _series: [] }])
    : [["TOTAL", findScope("ALL")], ["AREA", byType("AREA")[0]], ["AHU", byType("AHU")[0]], ["ROOM", byType("ROOM")[0]]];
  // #4 — Xếp hạng rủi ro: SẮP theo CẤP (Tổng→Khu→AHU→Phòng), trong cấp theo rủi ro giảm dần.
  const LEVEL_RANK = { TOTAL: 0, AREA: 1, AHU: 2, ROOM: 3 };
  const riskRows = (isLive
    ? liveScopes.slice()
    : [findScope("ALL"), ...byType("AREA"), ...byType("AHU"), ...byType("ROOM")].map((s) => ({ ...s, latest: s.latest || {} })))
    .filter(Boolean)
    .sort((a, b) => (LEVEL_RANK[a.type] - LEVEL_RANK[b.type]) || (b.risk - a.risk) || String(a.id).localeCompare(String(b.id)));

  // #4 — Phân tích kỹ thuật của chuỗi đang xem (cho AI + bảng cạnh biểu đồ)
  const tech = useMemo(() => {
    const ys = view.map((r) => r.comp).filter((v) => v != null);
    const s = regStat(ys);
    if (!s.n) return { n: 0 };
    const totOos = view.reduce((a, r) => a + (r.oos || 0), 0);
    const dqAvg = (() => { const d = view.map((r) => r.dq).filter((v) => v != null); return d.length ? d.reduce((a, v) => a + v, 0) / d.length : null; })();
    return { ...s, totOos, dqAvg };
  }, [view]);

  // Bản phân tích CỤC BỘ (dự phòng khi chưa cấu hình WF7 hoặc gọi lỗi) — như trước.
  const buildLocalAnalysis = () => {
    const donViLbl = isHourly ? "giờ" : "ngày";
    const perTxt2 = isHourly ? "%/giờ" : "%/ngày";
    if (!tech.n) return { text: "Chưa có đủ dữ liệu trong khoảng đã chọn để phân tích. Hãy mở rộng khoảng thời gian hoặc kiểm tra kết nối FMS/WF1.", level: 0 };
    const avg = tech.mean;
    const level = avg < 70 ? 3 : avg < 80 ? 2 : avg < 88 ? 1 : 0;
    const win = (dtFrom || dtTo) ? ` (lọc ${view[0]?.label}→${view[view.length - 1]?.label})` : "";
    const worst = [...view].sort((a, b) => (b.oos || 0) - (a.oos || 0) || (a.comp ?? 999) - (b.comp ?? 999))[0];
    const slopeTxt = tech.n >= 2 ? `${tech.slope > 0 ? "tăng" : tech.slope < 0 ? "giảm" : "đi ngang"} ${Math.abs(tech.slope).toFixed(2)} ${perTxt2} (R²=${tech.r2.toFixed(2)}, ${tech.r2 >= 0.5 ? "xu hướng rõ" : "biến động ngẫu nhiên"})` : "chưa đủ điểm để ước lượng";
    const dqTxt = tech.dqAvg != null ? `${tech.dqAvg.toFixed(0)}%` : "—";
    const dqWarn = tech.dqAvg != null && tech.dqAvg < 80 ? ` — ⚠ độ đầy đủ dữ liệu thấp làm giảm độ tin cậy kết luận` : "";
    const rateTxt = `đạt 1 ngày ${fmtPct(activeScope.dat1n)} · 3 ngày ${fmtPct(activeScope.dat3n)} · 7 ngày ${fmtPct(activeScope.dat7n)}`;
    const perSensorLines = [];
    if (showMulti) {
      sensorsPresent.forEach((k) => {
        const ys = viewMulti.map((r) => r[`comp_${k}`]).filter((v) => v != null);
        const st = regStat(ys);
        if (!st.n) return;
        const oosTot = viewMulti.reduce((a, r) => a + (r[`oos_${k}`] || 0), 0);
        const dir = st.slope > 0.05 ? "đang cải thiện" : st.slope < -0.05 ? "đang xấu đi" : "đi ngang";
        const tin = st.r2 >= 0.5 ? "rõ" : "chưa rõ";
        perSensorLines.push(`• ${SENSOR_META[k]?.label || k}: đạt TB ${st.mean.toFixed(1)}% (${st.vmin.toFixed(0)}–${st.vmax.toFixed(0)}%), dốc ${st.slope > 0 ? "+" : ""}${st.slope.toFixed(2)} ${perTxt2} [R²=${st.r2.toFixed(2)}, ${tin}] → ${dir}; ${oosTot} điểm OOS.`);
      });
    }
    const khuyenNghi = (avg < 80 || tech.slope < -0.5)
      ? `IPC: kiểm tra hiện trường ${activeScope.name} (cửa/chốt liên động, chênh áp thực, chế độ phòng). Cơ điện: soát AHU${activeScope.ahu ? " " + activeScope.ahu : ""} — lưu lượng, cấp lọc, van/biến tần, rò khí. QA: xem xét mở/đánh giá CAPA nếu tái diễn, rà soát rủi ro liên đới.`
      : `Duy trì giám sát thường quy; chưa cần can thiệp khẩn. QA tiếp tục theo dõi các ${donViLbl} tới.`;
    const i = (a, b) => (showMulti ? a : b);
    const levelLbl = ["Kiểm soát tốt", "Cần chú ý", "Cảnh báo", "Hành động khắc phục"][level];
    const xuHuongDien = tech.n >= 2
      ? (tech.slope > 0.05 ? "đang cải thiện dần" : tech.slope < -0.05 ? "đang xấu đi — cần lưu ý" : "đi ngang, ổn định")
      : "chưa đủ dữ liệu để kết luận xu hướng";
    const dgPhanTich = avg >= 88
      ? `Tỉ lệ đạt TB ${avg.toFixed(1)}% ở mức tốt, trên ngưỡng GMP 80%; ${xuHuongDien}.`
      : avg >= 80
        ? `Tỉ lệ đạt TB ${avg.toFixed(1)}% còn mỏng so với ngưỡng 80% — biên an toàn hẹp; ${xuHuongDien}.`
        : `Tỉ lệ đạt TB ${avg.toFixed(1)}% DƯỚI ngưỡng GMP 80% — chưa đạt kiểm soát; ${xuHuongDien}.`;
    const worstTxt = worst ? `Cao điểm mất kiểm soát tại ${worst.label}: đạt ${fmtPct(worst.comp)}, ${worst.oos || 0} điểm OOS.` : "Không có mốc nổi bật về OOS.";
    const capaLines = (avg < 80 || tech.slope < -0.5)
      ? [
          `IPC: kiểm tra hiện trường ${activeScope.name} — cửa/chốt liên động, chênh áp thực tế, chế độ vận hành phòng.`,
          `Cơ điện: soát AHU${activeScope.ahu ? " " + activeScope.ahu : ""} — lưu lượng cấp/hồi, cấp lọc (chênh áp phin lọc), van/biến tần, rò khí.`,
          `QA: xem xét mở/đánh giá CAPA nếu lặp lại; rà soát rủi ro liên đới và hồ sơ lô bị ảnh hưởng.`,
        ]
      : [
          `Duy trì giám sát thường quy; chưa cần can thiệp khẩn.`,
          `QA tiếp tục theo dõi ${donViLbl} tới; ghi nhận nếu xu hướng đảo chiều.`,
        ];
    const secTho = [
      `• Đối tượng: ${activeScope.name} · ${showMulti ? `đủ cảm biến (${sensorsPresent.join("/")})` : SENSORS.find((s) => s.k === sensor).label} · khoảng ${RANGES.find((r) => r.k === range).label}${win} · ${tech.n} điểm theo ${donViLbl}.`,
      `• Tỉ lệ đạt: TB ${avg.toFixed(1)}% (min–max ${tech.vmin.toFixed(0)}–${tech.vmax.toFixed(0)}%, SD ${tech.std.toFixed(1)}%). ${rateTxt}.`,
      `• OOS & dữ liệu: tổng ${tech.totOos} điểm OOS; độ đầy đủ dữ liệu ${dqTxt}.`,
      `• Xu hướng: ${slopeTxt}; Δ7 ${donViLbl} ${fmtDelta(delta7)}.`,
      showMulti && perSensorLines.length ? `• Theo từng chỉ tiêu:\n${perSensorLines.join("\n")}` : "",
    ].filter(Boolean).join("\n");
    const secPhanTich = [
      `• ${dgPhanTich}`,
      `• ${worstTxt}`,
      dqWarn ? `• ⚠ Độ đầy đủ dữ liệu thấp (${dqTxt}) làm giảm độ tin cậy kết luận.` : `• Độ đầy đủ dữ liệu ${dqTxt} — đủ tin cậy để kết luận.`,
    ].join("\n");
    const secBaoCao = [
      `• Mức kết luận: ${levelLbl}.`,
      `• ${activeScope.name} ${avg >= 80 ? "đang trong tầm kiểm soát" : "chưa đạt kiểm soát"} ở khoảng ${RANGES.find((r) => r.k === range).label}; ${tech.slope < -0.5 ? "xu hướng suy giảm cần theo dõi sát." : "xu hướng ổn định/cải thiện."}`,
    ].join("\n");
    const secCapa = capaLines.map((x) => `• ${x}`).concat("• AI chỉ hỗ trợ phân tích xu hướng; quyết định GMP do IPC/QA phê duyệt.").join("\n");
    const text = [
      `## DỮ LIỆU THÔ\n${secTho}`,
      `## PHÂN TÍCH\n${secPhanTich}`,
      `## BÁO CÁO\n${secBaoCao}`,
      `## CAPA & KHUYẾN NGHỊ\n${secCapa}`,
    ].join("\n\n");
    return { text, level };
  };

  const finishAI = (text, level, nguon) => {
    const payload = { scope: activeScope.name, sensor: SENSORS.find((s) => s.k === sensor).label, range: RANGES.find((r) => r.k === range).label, text, time: new Date().toLocaleString("vi-VN"), level, nguon };
    onAI(payload); setAiResult(payload);
    if (isLive && onSaveAI) onSaveAI({ scopeType: activeScope.type, scopeId: activeScope.id, scopeName: activeScope.name, sensor, days: RANGE_DAYS[range] || 30, text, level });
  };

  const runAI = async (sau = false) => {
    if (aiBusy) return;
    setAiNote(null);
    if (!tech.n) { finishAI("Chưa có đủ dữ liệu trong khoảng đã chọn để phân tích. Hãy mở rộng khoảng thời gian hoặc kiểm tra kết nối FMS/WF1.", 0, "cuc_bo"); return; }
    const aiUrl = sau ? aiWebhookSau : aiWebhook;   // chọn workflow: chuyên sâu hay thường

    // Nếu đã cấu hình workflow AI → gửi DỮ LIỆU BIỂU ĐỒ THẬT cho AI phân tích.
    if (isLive && aiUrl) {
      setAiBusy(true);
      // dữ liệu bổ sung cho phân tích chuyên sâu (đều từ dữ liệu web đã có)
      const slimAI = (arr, keep = 60) => { if (!Array.isArray(arr) || arr.length <= keep) return arr || []; const st = Math.ceil(arr.length / keep); return arr.filter((_, i) => i % st === 0); };
      const bandsAll = (activeScope.type === "ROOM" && roomBandsMulti[roomBandsKey]) || {};
      const giaTriThuc3 = ["DP", "RH", "T"].filter((k) => bandsAll[k] && bandsAll[k].series && bandsAll[k].series.length).map((k) => {
        const s = bandsAll[k].series;
        const lo = [...s].reverse().find((p) => p.lo != null)?.lo ?? null;
        const hi = [...s].reverse().find((p) => p.hi != null)?.hi ?? null;
        const v = s.filter((p) => p.avg != null);
        const tb = v.length ? +(v.reduce((a, p) => a + p.avg, 0) / v.length).toFixed(2) : null;
        return { chi_tieu: SENSOR_META[k]?.label || k, don_vi: SENSOR_META[k]?.unit || "", GHD: lo, GHT: hi, TB_ky: tb, chuoi: slimAI(s).map((p) => ({ t: p.label, tb: p.avg, min: p.vmin, max: p.vmax })) };
      });
      const ahuId = activeScope.ahu;
      const phongCungAhu = ahuId ? (liveRooms || []).filter((r) => r.ahu === ahuId).map((r) => ({ ma: r.id, ten: r.name || r.id, dat_pct: r._compliance != null ? +(+r._compliance).toFixed(1) : null, thieu_dl: !!r.noData })) : [];
      const scId = activeScope.id;
      const suCoLienQuan = (liveIncidents || []).filter((i) => {
        if (activeScope.type === "TOTAL") return true;
        if (activeScope.type === "ROOM") return i.room === scId;
        if (activeScope.type === "AHU") return (liveRooms || []).some((r) => r.ahu === scId && r.id === i.room);
        if (activeScope.type === "AREA") return (liveRooms || []).some((r) => r.area === scId && r.id === i.room);
        return false;
      }).slice(0, 12).map((i) => ({ ma: i.id, phong: i.room, chi_tieu: i.sensor || null, muc: i.priority, trang_thai: i.status }));
      const roomRec = (liveRooms || []).find((r) => r.id === activeScope.id) || {};
      // ===== Dữ liệu PHÂN TÍCH SÂU (Supabase tính) =====
      const _donVi = donVi === "NGAY" ? "NGAY" : "GIO";   // phân tích sâu chỉ có GIO/NGAY (PHUT→GIO)
      const _soDiem = range === "1n" ? 24 : range === "7n" ? 168 : (RANGE_DAYS[range] || 30);
      const _soGio = range === "1n" ? 24 : range === "7n" ? 168 : ((RANGE_DAYS[range] || 30) * 24);
      const _canDrill = activeScope.type === "TOTAL" || activeScope.type === "AREA" || activeScope.type === "AHU";
      let phanTichSau = null, quetBatThuong = null;
      try {
        const can = [layPhanTichSau(activeScope.type, activeScope.id, sensor, _donVi, _soDiem)];
        if (_canDrill) can.push(layQuetBatThuong(_soGio, activeScope.type, activeScope.id));
        const kq = await Promise.all(can);
        phanTichSau = kq[0] && kq[0].sau ? kq[0].sau : null;
        quetBatThuong = _canDrill && kq[1] && kq[1].quet ? kq[1].quet : null;
      } catch { /* bỏ qua — payload vẫn gửi phần còn lại */ }
      const payload = {
        scope: { name: activeScope.name, type: activeScope.type, id: activeScope.id, area: activeScope.area, ahu: activeScope.ahu, dat1n: activeScope.dat1n, dat3n: activeScope.dat3n, dat7n: activeScope.dat7n,
          cap_sach: roomRec.cap_phong_sach || roomRec.capPhong || null, uu_tien: roomRec.priority || roomRec.muc_uu_tien || null },
        rangeLabel: RANGES.find((r) => r.k === range).label, isHourly,
        metrics: { mean: tech.mean, std: tech.std, slope: tech.slope, r2: tech.r2, totOos: tech.totOos, dq: tech.dqAvg, vmin: tech.vmin, vmax: tech.vmax, n: tech.n },
        series: view.map((r) => ({ label: r.label, ts: r.ts, comp: r.comp, oos: r.oos, dq: r.dq })),
        perSensor: showMulti ? sensorsPresent.map((k) => ({ k, label: SENSOR_META[k]?.label, series: viewMulti.map((r) => ({ label: r.label, comp: r[`comp_${k}`], oos: r[`oos_${k}`] })) })) : [],
        gia_tri_thuc_3: giaTriThuc3,      // giá trị đo thực + GHD/GHT cho cả 3 chỉ tiêu
        phong_cung_ahu: phongCungAhu,     // tình trạng các phòng cùng AHU (suy luận hệ thống)
        su_co_lien_quan: suCoLienQuan,    // sự cố mở/gần đây trong phạm vi (bối cảnh)
        phan_tich_sau: phanTichSau,       // độ phủ DL + OOS tách trên/dưới + lịch sử (kỳ trước, TB 7/30 ngày)
        quet_bat_thuong: quetBatThuong,   // (Tổng quan/Khu vực) xếp hạng khu vực + phòng tốt/xấu + đợt bất thường có mốc thời gian
      };
      const r = await phanTichAiQuaWorkflow(aiUrl, payload, undefined, (m) => setAiNote(m), sau ? "WF7_SAU" : "WF7");
      setAiBusy(false);
      if (r.ok) { setAiNote(null); const loc = buildLocalAnalysis(); finishAI(r.text, r.level != null ? r.level : loc.level, sau ? "openai_sau" : "openai"); return; }
      // lỗi → rơi về bản cục bộ + ghi chú trạng thái (KHÔNG nối vào nội dung để giữ 4 mục sạch)
      const loc = buildLocalAnalysis();
      setAiNote(`Chưa gọi được AI qua workflow (${r.error}). Đang hiển thị phân tích cục bộ — kiểm tra WF7 / khóa OpenAI nếu cần.`);
      finishAI(loc.text, loc.level, "cuc_bo");
      return;
    }
    // Chưa cấu hình webhook → bản cục bộ
    const loc = buildLocalAnalysis();
    finishAI(loc.text, loc.level, "cuc_bo");
  };

  // Chụp TẤT CẢ biểu đồ đang hiển thị ở tab Xu hướng (#trendPrintArea) → mảng { src, title }
  // (src = PNG data URI; title = tiêu đề thẻ chứa biểu đồ, để WF7b chú thích như báo cáo WF5).
  // Dùng registry window.__bmsEcharts (map DOM→instance) như hàm in A4; fallback canvas.toDataURL.
  const capTrendCharts = () => {
    try {
      const node = document.getElementById("trendPrintArea");
      if (!node) return [];
      const reg = window.__bmsEcharts;
      const instFor = (canvas) => { let el = canvas.parentElement; while (el) { if (reg && reg.has(el)) return reg.get(el); el = el.parentElement; } return null; };
      const titleFor = (canvas) => {
        let el = canvas.parentElement;
        while (el && el !== node) { const h = el.querySelector && el.querySelector("h3"); if (h && h.textContent) return h.textContent.replace(/\s+/g, " ").trim(); el = el.parentElement; }
        return "";
      };
      return Array.from(node.querySelectorAll("canvas")).map((c) => {
        let src = null;
        try { const inst = instFor(c); src = inst ? inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff", excludeComponents: ["toolbox", "dataZoom"] }) : c.toDataURL("image/png"); }
        catch { try { src = c.toDataURL("image/png"); } catch { src = null; } }
        return src ? { src, title: titleFor(c) } : null;
      }).filter(Boolean);
    } catch { return []; }
  };
  // Lưu bản nhận định AI hiện tại (.html, kèm biểu đồ) vào Google Drive (folder con "Nhan-dinh-xu-huong") qua WF7b.
  const luuDriveNhanDinh = async () => {
    if (!aiResult || sendBusy) return;
    setSendBusy("drive"); setSendMsg(null);
    const r = await guiNhanDinhXuHuong(wf7bUrl, "drive", aiResult, "", capTrendCharts());
    setSendBusy("");
    setSendMsg(r.ok ? { ok: true, text: "Đã lưu nhận định (kèm biểu đồ) vào Google Drive." } : { ok: false, text: `Không lưu được (${r.error}).` });
  };
  // Gửi bản nhận định AI (kèm biểu đồ) qua email (tuỳ chọn) tới người nhập.
  const guiEmailNhanDinh = async () => {
    if (!aiResult || sendBusy) return;
    const to = emailTo.trim();
    if (!to) { setSendMsg({ ok: false, text: "Nhập ít nhất 1 email người nhận." }); return; }
    setSendBusy("email"); setSendMsg(null);
    const r = await guiNhanDinhXuHuong(wf7bUrl, "email", aiResult, to, capTrendCharts());
    setSendBusy("");
    if (r.ok) { setSendMsg({ ok: true, text: `Đã gửi email (kèm biểu đồ) tới: ${to}` }); setEmailOpen(false); }
    else setSendMsg({ ok: false, text: `Không gửi được (${r.error}).` });
  };

  // In báo cáo A4 — LUÔN kèm phân tích AI: nếu chưa có nhận định thì chạy AI trước rồi mới in.
  const inBaoCaoA4 = async () => {
    const LVL = { TOTAL: "Toàn hệ thống", AREA: "Khu vực", AHU: "AHU", ROOM: "Phòng" };
    const phamVi = activeScope.type === "TOTAL" ? "Toàn hệ thống" : `${LVL[activeScope.type] || ""}: ${activeScope.name}`;
    const meta = { phamVi, scope: activeScope.name, sensor: SENSORS.find((s) => s.k === sensor)?.label, range: RANGES.find((r) => r.k === range)?.label, res: resLbl, window: (dtFrom || dtTo) ? `${view[0]?.label}→${view[view.length - 1]?.label}` : `${RANGES.find((r) => r.k === range)?.label} gần nhất` };
    if (!aiResult) {
      setDangInBaoCao(true);
      try { await runAI(); await new Promise((r) => setTimeout(r, 650)); } catch { /* vẫn in phần còn lại */ }
      setDangInBaoCao(false);
    }
    printTrend(meta);
  };

  const Chip = ({ active, onClick, children, disabled, title }) => <button onClick={onClick} disabled={disabled} title={title} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${disabled ? "text-slate-300 bg-slate-50 ring-slate-100 cursor-not-allowed" : active ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`} style={active && !disabled ? { backgroundColor: COLOR.teal } : {}}>{children}</button>;
  const sel = "rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[12px] text-slate-700 outline-none";

  // #4 — chuỗi giá trị TB + dải giới hạn của phòng (chỉ khi đang chọn 1 phòng + 1 chỉ tiêu DP/RH/T trong LIVE)
  const bandSeries = (wantRoomBand && roomBand[roomBandKey]) || [];
  const bandLo = [...bandSeries].reverse().find((p) => p.lo != null)?.lo ?? null;
  const bandHi = [...bandSeries].reverse().find((p) => p.hi != null)?.hi ?? null;
  const bandMean = bandSeries.length ? +(bandSeries.reduce((a, p) => a + (p.avg ?? 0), 0) / bandSeries.filter((p) => p.avg != null).length).toFixed(2) : null;
  const sUnit = SENSOR_META[sensor]?.unit || "";
  const perTxt = (range === "1n" || range === "7n") ? "%/giờ" : "%/ngày"; // đơn vị độ dốc theo khoảng xem

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: COLOR.navy }}><LineIcon className="w-5 h-5" style={{ color: COLOR.teal }} strokeWidth={1.8} /> Xu hướng GMP — biểu đồ theo thời gian</h2>
      </div>

      <Card className="relative z-30 p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Khoảng</span>{RANGES.map((r) => <Chip key={r.k} active={range === r.k} onClick={() => { setRange(r.k); setResOverride(null); setDtFrom(""); setDtTo(""); setDtFromDraft(""); setDtToDraft(""); }}>{r.label}</Chip>)}</div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Cấp xem</span>{SCOPE_LEVELS.map((s) => <Chip key={s.k} active={level === s.k} onClick={() => { setLevel(s.k); setSelId(""); setOptArea("ALL"); setOptAhu("ALL"); }}>{s.label}</Chip>)}</div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Chỉ tiêu</span>{SENSORS.map((s) => <Chip key={s.k} active={sensor === s.k} onClick={() => setSensor(s.k)}>{s.label}</Chip>)}</div>
          {!isSubDay && (
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">So sánh</span>
              <Chip active={soKyTruoc} onClick={() => setSoKyTruoc((v) => !v)}>Kỳ trước</Chip>
            </div>
          )}
          {isSubDay && (
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Độ phân giải</span>
              <span className="text-[12px] text-slate-500">Theo giờ (dữ liệu thu thập 1 giờ/lần)</span>
            </div>
          )}
        </div>
        {/* Chọn khoảng thời gian thủ công (Từ → đến, có nút Áp dụng) — ô tự điền mốc dữ liệu thật */}
        <div className="mt-3 rounded-2xl bg-sky-50/50 ring-1 ring-sky-100 px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Từ → đến</span>
            <input type="datetime-local" value={dtFromDraft} min={minTs ? toLocalInput(minTs) : undefined} max={maxTs ? toLocalInput(maxTs) : undefined} onChange={(e) => setDtFromDraft(e.target.value)} className={sel} />
            <span className="text-[12px] text-slate-500">đến</span>
            <input type="datetime-local" value={dtToDraft} min={minTs ? toLocalInput(minTs) : undefined} max={maxTs ? toLocalInput(maxTs) : undefined} onChange={(e) => setDtToDraft(e.target.value)} className={sel} />
            <button onClick={() => { setDtFrom(dtFromDraft); setDtTo(dtToDraft); }} className="text-[12px] font-medium text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: COLOR.teal }}><Search className="w-3.5 h-3.5" strokeWidth={1.8} /> Áp dụng</button>
            {(dtFrom || dtTo || dtFromDraft || dtToDraft) && <button onClick={() => { setDtFrom(""); setDtTo(""); setDtFromDraft(""); setDtToDraft(""); }} className="text-[11px] text-slate-500 underline">Đặt lại</button>}
            <span className="text-[11px] text-slate-400 ml-1">Đang xem {view.length}/{full.length} điểm ({resLbl})</span>
          </div>
          {/* Khoảng đã chọn THIẾU dữ liệu → nói rõ (thay vì biểu đồ ngắn khó hiểu) */}
          {(() => {
            const days = RANGE_DAYS[range] || 30;
            if (isLive && Array.isArray(mainSeries[trendKey]) && mainSeries[trendKey].length === 0) return <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 ring-1 ring-amber-100 rounded-lg px-2.5 py-1.5">⚠ Chưa có dữ liệu trong khoảng đã chọn cho phạm vi này.</p>;
            if (!minTs) return null;
            const thieuNgay = Math.floor((minTs - (Date.now() - days * 86400000)) / 86400000);
            if (thieuNgay < 2) return null;   // đủ (chênh ≤1 ngày là biên bình thường)
            return <p className="mt-2 text-[11px] text-sky-700 bg-sky-50 ring-1 ring-sky-100 rounded-lg px-2.5 py-1.5">ℹ️ Khoảng {RANGES.find((r) => r.k === range)?.label} nhưng dữ liệu hệ thống mới có từ <b>{new Date(minTs).toLocaleDateString("vi-VN")}</b> — biểu đồ hiển thị {full.length} điểm hiện có (thiếu ~{thieuNgay} ngày đầu khoảng).</p>;
          })()}
        </div>
        {level !== "TOTAL" && (
          <div className="mt-3 rounded-2xl bg-sky-50/60 ring-1 ring-sky-100 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Lọc khu</span>{["ALL", ...areaList].map((a) => <Chip key={a} active={optArea === a} onClick={() => { setOptArea(a); setOptAhu("ALL"); setSelId(""); }}>{a === "ALL" ? "Tất cả" : a}</Chip>)}</div>
              {(level === "ROOM" || level === "AHU") && ahuList.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Lọc AHU</span>{["ALL", ...ahuList].map((a) => <Chip key={a} active={optAhu === a} onClick={() => { setOptAhu(a); setSelId(""); }}>{a === "ALL" ? "Tất cả" : a}</Chip>)}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Chọn {level === "ROOM" ? "phòng" : level === "AHU" ? "AHU" : "khu"}</span>
              <ScopeCombobox items={options} value={activeId} onPick={(id) => setSelId(id)}
                placeholder={`Gõ mã hoặc tên ${level === "ROOM" ? "phòng" : level === "AHU" ? "AHU" : "khu"} để tìm…`}
                levelLabel={`${SCOPE_LEVELS.find((x) => x.k === level)?.label || ""} (${options.length})`} />
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
        <span className="text-[12px] text-slate-600">Đang chọn: <b style={{ color: COLOR.navy }}>{activeScope.name}</b> · {SENSORS.find((s) => s.k === sensor).label} · {RANGES.find((r) => r.k === range).label}{(dtFrom || dtTo) ? ` · ${view[0]?.label}→${view[view.length - 1]?.label}` : ""}</span>
        <div className="flex gap-2">
          <button onClick={inBaoCaoA4} disabled={dangInBaoCao || aiBusy} className={`text-xs font-medium rounded-xl px-4 py-2 text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5 ${dangInBaoCao ? "opacity-60 cursor-wait" : ""}`}><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> {dangInBaoCao ? "Đang soạn báo cáo (chờ AI)…" : "In báo cáo A4 (kèm phân tích AI)"}</button>
          <button onClick={() => runAI(false)} disabled={aiBusy} className={`text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${aiBusy ? "opacity-60 cursor-wait" : ""}`} style={{ backgroundColor: COLOR.teal }}><Sparkles className={`w-3.5 h-3.5 ${aiBusy ? "animate-pulse" : ""}`} strokeWidth={1.8} /> {aiBusy ? "AI đang đọc…" : "AI gợi ý đọc biểu đồ"}</button>
          {isLive && aiWebhookSau && <button onClick={() => runAI(true)} disabled={aiBusy} title="Phân tích sâu hơn: nguyên nhân gốc + CAPA đa tầng (IPC/Cơ điện/BMS) + đề xuất phòng ngừa — dùng model mạnh, chạy ~1–3 phút" className={`text-xs font-semibold rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${aiBusy ? "opacity-60 cursor-wait" : ""}`} style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}><Sparkles className={`w-3.5 h-3.5 ${aiBusy ? "animate-pulse" : ""}`} strokeWidth={2} /> {aiBusy ? "AI đang phân tích sâu…" : "AI phân tích chuyên sâu (CAPA)"}</button>}
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={CheckCircle2} label="Tỉ lệ đạt hiện tại" value={fmtPct(latest.comp)} sub={`${activeScope.name} · ${SENSORS.find((s) => s.k === sensor).label}`} accent={{ txt: "text-teal-600", bg: "bg-teal-50", glow: "bg-teal-200" }} />
        <KpiCard icon={Wifi} label="Độ đầy đủ dữ liệu" value={`${latest.dq || "—"}%`} sub="dùng để kết luận" accent={{ txt: "text-sky-600", bg: "bg-sky-50", glow: "bg-sky-200" }} />
        <KpiCard icon={delta7 != null && delta7 < 0 ? TrendingDown : TrendingUp} label="Delta ngày / 7 ngày" value={fmtDelta(deltaDay)} sub={`7 ngày: ${fmtDelta(delta7)}`} accent={{ txt: deltaTone(delta7), bg: "bg-amber-50", glow: "bg-amber-200" }} />
        <KpiCard icon={AlertTriangle} label="Giờ cảnh báo (kỳ)" value={fmtH(totalAlert)} sub="Warning + Critical" accent={{ txt: "text-rose-600", bg: "bg-rose-50", glow: "bg-rose-200" }} />
      </div>

      <Card className="p-6"><SectionTitle icon={FileBarChart} hint="1 / 7 / 30 / 90 ngày">Báo cáo xu hướng nhanh</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{periodCards.map((p) => <div key={p.d} className={`rounded-2xl p-4 ring-1 ${p.status === "FULL" ? "ring-teal-200 bg-teal-50/50" : "ring-amber-200 bg-amber-50/50"}`}><div className="flex items-center justify-between"><h4 className="text-sm font-semibold" style={{ color: COLOR.navy }}>{p.d} ngày</h4><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.status === "FULL" ? "text-teal-700 bg-teal-100" : "text-amber-700 bg-amber-100"}`}>{p.status === "FULL" ? "ĐỦ" : "THIẾU"}</span></div><p className="text-2xl font-light mt-1.5 tabular-nums" style={{ color: COLOR.navy }}>{fmtH(p.alert)}</p><p className="text-[11px] text-slate-500 mt-1">W {fmtH(p.warn)} · C {fmtH(p.crit)}</p><p className="text-[11px] text-slate-500">Đạt TB {fmtPct(p.avg)} · {p.avail}/{p.d} ngày</p></div>)}</div>
      </Card>

      <div id="trendPrintArea" className="space-y-5">
        {aiBusy && (
          <Card className="p-5 ring-1 ring-teal-100">
            <div className="flex items-center gap-3"><Sparkles className="w-5 h-5 animate-pulse" style={{ color: COLOR.teal }} strokeWidth={1.9} /><div><p className="text-[13px] font-semibold" style={{ color: COLOR.navy }}>Đang phân tích qua AI…</p><p className="text-[12px] text-slate-500">Đang gửi dữ liệu biểu đồ cho AI (OpenAI). Thường mất 10–30 giây — vui lòng đợi.</p></div></div>
          </Card>
        )}
        {!aiBusy && aiResult && (() => { const al = [{ l: "Kiểm soát tốt", c: "text-teal-700", bg: "bg-teal-50", ring: "ring-teal-200" }, { l: "Cần chú ý", c: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200" }, { l: "Cảnh báo", c: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" }, { l: "Hành động", c: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200" }][aiResult.level]; return (
          <Card className={`p-5 ring-1 ${al.ring}`}>
            <div className="flex items-center justify-between flex-wrap gap-2"><SectionTitle icon={Sparkles}>Gợi ý đọc biểu đồ (AI hỗ trợ)</SectionTitle><div className="flex items-center gap-2">{aiResult.nguon === "openai" && <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200">OpenAI</span>}{aiResult.nguon === "cuc_bo" && <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500">Tự luận cục bộ</span>}<span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${al.bg} ${al.c}`}>Gợi ý mức: {al.l}</span></div></div>
            <p className="mt-1 mb-2 text-[11px] text-slate-500 bg-slate-50 ring-1 ring-slate-200/70 rounded-lg px-3 py-1.5">ℹ️ AI chỉ <b>đọc số liệu và gợi ý</b> — mọi con số do hệ thống tính (SQL/thống kê), <b>không phải AI</b>. Kết luận &amp; quyết định GMP do IPC/QA phê duyệt.</p>
            <AiSections text={aiResult.text} />
            {aiNote && <p className="mt-3 text-[12px] text-amber-700 bg-amber-50 ring-1 ring-amber-100 rounded-xl px-3 py-2">⚠ {aiNote}</p>}
            {wf7bUrl && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => { setEmailOpen((v) => !v); setSendMsg(null); }} disabled={!!sendBusy} className="text-xs font-medium rounded-xl px-3.5 py-2 text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-60"><Mail className="w-3.5 h-3.5" strokeWidth={1.8} /> Gửi email (tuỳ chọn)</button>
                  <button onClick={luuDriveNhanDinh} disabled={!!sendBusy} className="text-xs font-medium rounded-xl px-3.5 py-2 text-white flex items-center gap-1.5 disabled:opacity-60" style={{ backgroundColor: COLOR.teal }}><Save className={`w-3.5 h-3.5 ${sendBusy === "drive" ? "animate-pulse" : ""}`} strokeWidth={1.8} /> {sendBusy === "drive" ? "Đang lưu…" : "Lưu vào Drive"}</button>
                  <span className="text-[11px] text-slate-400">Lưu bản nhận định này (.html) vào Google Drive; email là tuỳ chọn.</span>
                </div>
                {emailOpen && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && guiEmailNhanDinh()} placeholder="email1@…, email2@… (phân tách bằng dấu phẩy)" className="flex-1 min-w-[240px] rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[12px] text-slate-700 outline-none focus:ring-2 focus:ring-teal-300" />
                    <button onClick={guiEmailNhanDinh} disabled={sendBusy === "email"} className="text-xs font-semibold rounded-xl px-4 py-2 text-white flex items-center gap-1.5 disabled:opacity-60" style={{ backgroundColor: COLOR.teal }}>{sendBusy === "email" ? "Đang gửi…" : "Gửi email"}</button>
                  </div>
                )}
                {sendMsg && <p className={`mt-2 text-[12px] rounded-xl px-3 py-2 ring-1 ${sendMsg.ok ? "text-teal-700 bg-teal-50 ring-teal-100" : "text-rose-600 bg-rose-50 ring-rose-100"}`}>{sendMsg.ok ? "✓ " : "✗ "}{sendMsg.text}</p>}
              </div>
            )}
            <p className="mt-3 text-[11px] text-slate-400">Nhận định lúc {aiResult.time} · đã lưu vào hệ thống (tab Báo cáo).</p>
          </Card>
        ); })()}
        {/* ============ PHÒNG: phân tích chi tiết khi có lỗi ============ */}
        {isRoom && (<>
          {/* (1) Giá trị trung bình mỗi giờ + dải giới hạn — hiện CẢ 3 chỉ tiêu của phòng */}
          {(() => {
            const bands = (wantRoomBands && roomBandsMulti[roomBandsKey]) || null;
            const ks = bands ? ["DP", "RH", "T"].filter((k) => bands[k] && bands[k].series && bands[k].series.length) : [];
            return (
              <Card className="p-6"><SectionTitle icon={Minus} hint={`${activeScope.name} · trung bình mỗi ${isHourly ? "giờ" : "ngày"} · tất cả chỉ tiêu`}>① Giá trị trung bình &amp; dải giới hạn</SectionTitle>
                {!isLive ? (
                  <p className="mt-4 text-[13px] text-slate-500">Biểu đồ giá trị trung bình theo phòng hiển thị ở chế độ <b>LIVE</b> (đọc dữ liệu thật từ Supabase).</p>
                ) : !bands ? (
                  <p className="mt-4 text-[13px] text-amber-600">Đang tải dữ liệu giá trị phòng cho cả 3 chỉ tiêu…</p>
                ) : ks.length === 0 ? (
                  <p className="mt-4 text-[13px] text-slate-500">Phòng này chưa ghi nhận giá trị (Chênh áp / Độ ẩm / Nhiệt độ) trong khoảng đã chọn.</p>
                ) : (
                  <div className="mt-4 divide-y divide-slate-100">{ks.map((k, idx) => <div key={k} className={idx > 0 ? "pt-6" : ""}><Chart type="roomBand" sensorKey={k} series={bands[k].series} baseline={bands[k].baseline} isHourly={isHourly} group={`bands-${activeId}`} h={296} /></div>)}</div>
                )}
              </Card>
            );
          })()}
          {/* (2) % đạt / OOS theo thời gian — vẽ đủ cảm biến phòng có */}
          <Card className="p-6"><SectionTitle icon={LineIcon} hint={showMulti ? `${activeScope.name} · ${sensorsPresent.map((k) => SENSOR_META[k]?.label).join(" · ")} · theo ${isHourly ? "giờ" : "ngày"}` : `${activeScope.name} · ${SENSORS.find((s) => s.k === sensor).label} · theo ${isHourly ? "giờ" : "ngày"}`}>② % đạt / OOS theo thời gian{showMulti ? " — theo từng cảm biến" : ""}</SectionTitle>
            <p className="text-[11px] text-slate-400 mt-1">% đạt = 100% − % ngoài giới hạn (OOS). Đường dưới mốc 80% là kỳ cần chú ý.</p>
            <div className="mt-3">{showMulti
              ? <Chart type="complyPerMetric" data={viewMulti} present={sensorsPresent} h={296} />
              : <Chart type="complyTotal" data={view} idSuffix="RoomOne" incidents={incidentMarks} prevData={prevData} h={296} />}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">{showMulti ? sensorsPresent.map((k) => <span key={k} className="flex items-center gap-1"><span className="w-4 inline-block border-t-2" style={{ borderColor: SENSOR_COLOR[k] }} /> {SENSOR_META[k]?.label || k}</span>) : (<><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COMPLY_OK }} /> ≥ 80% đạt</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COMPLY_BAD }} /> &lt; 80% (điểm đỏ)</span></>)}<span className="flex items-center gap-1"><span className="w-4 inline-block border-t-2 border-dashed" style={{ borderColor: COLOR.sand }} /> Ngưỡng 80%</span></div>
          </Card>
          {/* (3) SPC — Levey-Jennings quanh nền 30 ngày (A2) */}
          <Card className="p-6"><SectionTitle icon={Activity} hint={`${activeScope.name} · vùng ±1/2/3σ quanh nền 30 ngày · tín hiệu Nelson`}>③ Kiểm soát thống kê (SPC — Levey-Jennings)</SectionTitle>
            <p className="text-[11px] text-slate-400 mt-1">Phát hiện <b>dịch chuyển/xu hướng trước khi vượt ngưỡng OOS</b>: điểm cam = tín hiệu Nelson R2 (9 điểm cùng phía) / R3 (6 điểm đơn điệu), điểm đỏ = vượt 3σ (R1). Nền TB±σ do job đêm tính (tất định) — kết luận chính thức theo bảng SPC bên dưới trang.</p>
            {(() => {
              const bands = (wantRoomBands && roomBandsMulti[roomBandsKey]) || null;
              const ks = bands ? ["DP", "RH", "T"].filter((k) => bands[k] && bands[k].series && bands[k].series.length) : [];
              if (!isLive) return <p className="mt-4 text-[13px] text-slate-500">Biểu đồ SPC hiển thị ở chế độ <b>LIVE</b>.</p>;
              if (!bands) return <p className="mt-4 text-[13px] text-amber-600">Đang tải dữ liệu…</p>;
              if (!ks.length) return <p className="mt-4 text-[13px] text-slate-500">Chưa có chuỗi giá trị để dựng biểu đồ kiểm soát trong khoảng đã chọn.</p>;
              return <div className="mt-4 divide-y divide-slate-100">{ks.map((k, idx) => (
                <div key={k} className={idx > 0 ? "pt-6" : ""}>
                  <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: SENSOR_COLOR[k] }} /><h4 className="text-[14px] font-semibold" style={{ color: COLOR.navy }}>{SENSOR_META[k]?.label} ({k})</h4></div>
                  <Chart type="spc" sensorKey={k} series={bands[k].series} baseline={bands[k].baseline} group={`bands-${activeId}`} h={230} />
                </div>
              ))}</div>;
            })()}
          </Card>
        </>)}

        {/* ============ KHU / AHU / TỔNG: tổng quát + theo chỉ tiêu ============ */}
        {isLargeScope && (<>
          {/* (1) % đạt / OOS TOÀN PHẦN (hoặc theo chỉ tiêu đang chọn) */}
          <Card className="p-6"><SectionTitle icon={LineIcon} hint={`${activeScope.name} · ${sensor === "ALL" ? "toàn phần" : SENSOR_META[sensor]?.label} · theo ${isHourly ? "giờ" : "ngày"}`}>① % đạt / OOS {sensor === "ALL" ? "toàn phần" : `— ${SENSOR_META[sensor]?.label}`} theo thời gian</SectionTitle>
            <p className="text-[11px] text-slate-400 mt-1">{sensor === "ALL" ? "Tổng hợp mọi cảm biến trong phạm vi" : `Chỉ riêng ${SENSOR_META[sensor]?.label}`}. % đạt = 100% − % ngoài giới hạn (OOS). Vùng xanh nhạt minh hoạ mức đạt.</p>
            <div className="mt-3"><Chart type="complyTotal" data={view} idSuffix="Large" incidents={incidentMarks} prevData={prevData} h={296} /></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500"><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COMPLY_OK }} /> ≥ 80% đạt</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COMPLY_BAD }} /> &lt; 80% (điểm đỏ)</span><span className="flex items-center gap-1"><span className="w-4 inline-block border-t-2 border-dashed" style={{ borderColor: COLOR.sand }} /> Ngưỡng 80%</span></div>
          </Card>
          {/* (2) % đạt / OOS THEO TỪNG CHỈ TIÊU */}
          <Card className="p-6"><SectionTitle icon={CircleDot} hint={`${activeScope.name} · theo từng chỉ tiêu · theo ${isHourly ? "giờ" : "ngày"}`}>② % đạt / OOS theo từng chỉ tiêu</SectionTitle>
            <p className="text-[11px] text-slate-400 mt-1">Tách riêng <span style={{ color: SENSOR_COLOR.DP }}>Chênh áp</span>, <span style={{ color: SENSOR_COLOR.RH }}>Độ ẩm</span>, <span style={{ color: SENSOR_COLOR.T }}>Nhiệt độ</span> để thấy chỉ tiêu nào kéo tỉ lệ đạt xuống.</p>
            {sensorsPresent.length > 0 && viewMulti.length > 0 ? (<>
              <div className="mt-3"><Chart type="complyPerMetric" data={viewMulti} present={sensorsPresent} h={296} /></div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500">{sensorsPresent.map((k) => <span key={k} className="flex items-center gap-1"><span className="w-4 inline-block border-t-2" style={{ borderColor: SENSOR_COLOR[k] }} /> {SENSOR_META[k]?.label || k}</span>)}<span className="flex items-center gap-1"><span className="w-4 inline-block border-t-2 border-dashed" style={{ borderColor: COLOR.sand }} /> Ngưỡng 80%</span></div>
            </>) : (
              <p className="mt-4 text-[13px] text-amber-600">Đang tải dữ liệu theo chỉ tiêu… (nếu trống, phạm vi này chưa có đủ dữ liệu cảm biến trong khoảng đã chọn)</p>
            )}
          </Card>
        </>)}

        {/* ============ CHUNG: lịch tuân thủ 90 ngày (A2 — heatmap) ============ */}
        {isLive && (
          <Card className="p-6"><SectionTitle icon={History} hint={`${activeScope.name} · 90 ngày gần nhất · % đạt toàn phần theo ngày`}>Lịch tuân thủ 90 ngày</SectionTitle>
            <p className="text-[11px] text-slate-400 mt-1">Mỗi ô = 1 ngày, màu theo % đạt (đèn giao thông). Cụm ô đỏ/cam liền nhau = giai đoạn cần điều tra; nhìn được ngay "tuần nào xấu" mà không cần dò từng biểu đồ.</p>
            <div className="mt-3"><Chart type="calHeat" days={calDays} h={190} /></div>
          </Card>
        )}

        {/* ============ CHUNG: phân tích kỹ thuật phục vụ AI ============ */}
        <Card className="p-6"><SectionTitle icon={CircleDot} hint="dữ liệu phân tích kỹ thuật phục vụ AI đánh giá xu hướng">Phân tích kỹ thuật xu hướng</SectionTitle>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">{[
            ["Số điểm", tech.n ? `${tech.n}` : "—", "text-slate-600"],
            ["Tỉ lệ đạt TB", tech.n ? `${tech.mean.toFixed(1)}%` : "—", "text-teal-600"],
            ["Độ lệch chuẩn", tech.std != null ? `${tech.std.toFixed(1)}%` : "—", "text-sky-600"],
            ["Độ dốc xu hướng", tech.n >= 2 ? `${tech.slope > 0 ? "+" : ""}${tech.slope.toFixed(2)} ${perTxt}` : "—", deltaTone(tech.slope * 10)],
            ["R² (độ tin cậy)", tech.n >= 2 ? tech.r2.toFixed(2) : "—", "text-slate-600"],
            ["Tổng điểm OOS", `${tech.totOos ?? 0}`, "text-rose-600"],
          ].map(([k, v, c]) => <div key={k} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-3"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold leading-tight">{k}</p><p className={`text-lg font-light mt-1 tabular-nums ${c}`}>{v}</p></div>)}</div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">{[["Đạt 1 ngày", fmtPct(activeScope.dat1n)], ["Đạt 3 ngày", fmtPct(activeScope.dat3n)], ["Đạt 7 ngày", fmtPct(activeScope.dat7n)], ["Min–Max kỳ", tech.n ? `${tech.vmin.toFixed(0)}–${tech.vmax.toFixed(0)}%` : "—"]].map(([k, v]) => <div key={k} className="rounded-xl bg-white ring-1 ring-slate-200 py-2"><p className="text-[11px] uppercase text-slate-400 font-semibold">{k}</p><p className="text-[13px] font-semibold tabular-nums" style={{ color: COLOR.navy }}>{v}</p></div>)}</div>
          <p className="text-[11px] text-slate-400 mt-3">Độ dốc &gt; 0 là xu hướng cải thiện; R² càng gần 1 thì xu hướng càng rõ. Đây là <b>số liệu tất định</b> (hệ thống tính). Bấm <b>“AI gợi ý đọc biểu đồ”</b> để AI diễn giải &amp; gợi ý (không thay thế kết luận GMP).</p>
        </Card>

        {/* ====== BẢNG DỮ LIỆU THÔ + ĐÁNH GIÁ CƠ BẢN (tất định, TRƯỚC khi AI gợi ý / QA kết luận) ====== */}
        <Card className="p-6"><SectionTitle icon={FileBarChart} hint={`${activeScope.name} · ${resLbl} · số liệu nền để tự đánh giá xu hướng — trước khi AI gợi ý / QA kết luận`}>Bảng dữ liệu thô &amp; đánh giá cơ bản</SectionTitle>
          {(() => {
            const fv = (x, d = 2) => (x == null || isNaN(x) ? "—" : (+x).toFixed(d));
            const bands = (isRoom && wantRoomBands && roomBandsMulti[roomBandsKey]) || null;
            const ksB = bands ? ["DP", "RH", "T"].filter((k) => bands[k] && bands[k].series && bands[k].series.length) : [];
            if (isRoom && ksB.length) {
              return <div className="mt-4 space-y-6">{ksB.map((k) => {
                const s = bands[k].series; const unit = SENSOR_META[k]?.unit || "";
                const lo = [...s].reverse().find((p) => p.lo != null)?.lo ?? null;
                const hi = [...s].reverse().find((p) => p.hi != null)?.hi ?? null;
                const vals = s.filter((p) => p.avg != null).map((p) => p.avg);
                const st = regStat(vals);
                const within = vals.filter((v) => (lo == null || v >= lo) && (hi == null || v <= hi)).length;
                const pctIn = vals.length ? (within / vals.length * 100) : null;
                const perUnit = donVi === "NGAY" ? `${unit}/ngày` : `${unit}/giờ`;
                const b = bands[k].baseline;
                const evalCards = [
                  ["TB kỳ", `${fv(st.mean)} ${unit}`], ["Min–Max", `${fv(st.vmin)}–${fv(st.vmax)} ${unit}`],
                  ["Độ lệch chuẩn σ", `${fv(st.std)} ${unit}`], ["Giới hạn GHD–GHT", `${lo == null ? "—" : lo}–${hi == null ? "—" : hi} ${unit}`],
                  ["% trong giới hạn", pctIn == null ? "—" : `${pctIn.toFixed(1)}%`], ["Điểm ngoài GH", `${vals.length - within}/${vals.length}`],
                  ["Xu hướng", st.n >= 2 ? `${st.slope > 0 ? "+" : ""}${st.slope.toFixed(3)} ${perUnit} · R²=${st.r2.toFixed(2)}` : "—"],
                  ["Nền 30 ngày", b && b.tb != null ? `${b.tb}${b.sigma != null ? `±${b.sigma}` : ""} ${unit}` : "—"],
                ];
                return (
                  <div key={k}>
                    <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full" style={{ background: SENSOR_COLOR[k] }} /><h4 className="text-[14px] font-semibold" style={{ color: COLOR.navy }}>{SENSOR_META[k]?.label} ({k})</h4><span className="text-[11px] text-slate-400">— đánh giá cơ bản (hệ thống tính)</span></div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">{evalCards.map(([kk, vv]) => <div key={kk} className="rounded-xl bg-slate-50 ring-1 ring-slate-200/70 py-1.5 px-2 text-center"><p className="text-[11px] uppercase text-slate-400 font-semibold leading-tight">{kk}</p><p className="text-[12px] font-semibold tabular-nums" style={{ color: COLOR.navy }}>{vv}</p></div>)}</div>
                    <div className="overflow-auto max-h-72 rounded-xl ring-1 ring-slate-200"><table className="w-full text-[12px]"><thead className="sticky top-0 bg-slate-50"><tr className="text-slate-500 text-left text-[10px] uppercase tracking-wider">{["Thời điểm", "TB", "Min", "Max", "P5", "P50", "P95", "GHD", "GHT", "TT"].map((h) => <th key={h} className="py-2 px-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{[...s].reverse().map((p, i) => { const oob = (lo != null && p.avg < lo) || (hi != null && p.avg > hi); return <tr key={i} className={`border-t border-slate-100 ${oob ? "bg-rose-50/50" : ""}`}><td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">{p.label}</td><td className={`py-1.5 px-2 tabular-nums font-medium ${oob ? "text-rose-600" : ""}`}>{fv(p.avg)}</td><td className="py-1.5 px-2 tabular-nums text-slate-500">{fv(p.vmin)}</td><td className="py-1.5 px-2 tabular-nums text-slate-500">{fv(p.vmax)}</td><td className="py-1.5 px-2 tabular-nums text-slate-500">{fv(p.p5)}</td><td className="py-1.5 px-2 tabular-nums text-slate-500">{fv(p.p50)}</td><td className="py-1.5 px-2 tabular-nums text-slate-500">{fv(p.p95)}</td><td className="py-1.5 px-2 tabular-nums text-slate-400">{lo == null ? "—" : lo}</td><td className="py-1.5 px-2 tabular-nums text-slate-400">{hi == null ? "—" : hi}</td><td className="py-1.5 px-2">{oob ? <span className="text-rose-600 font-semibold">OOS</span> : <span className="text-teal-600">Đạt</span>}</td></tr>; })}</tbody></table></div>
                  </div>
                );
              })}</div>;
            }
            if (view.length) {
              const vm = {}; viewMulti.forEach((r) => { vm[r.ts] = r; });
              return (
                <div className="mt-4">
                  <p className="text-[11px] text-slate-400 mb-2">% đạt = 100 − % ngoài giới hạn (OOS) · tổng hợp cảm biến trong phạm vi <b>{activeScope.name}</b>.</p>
                  <div className="overflow-auto max-h-72 rounded-xl ring-1 ring-slate-200"><table className="w-full text-[12px]"><thead className="sticky top-0 bg-slate-50"><tr className="text-slate-500 text-left text-[10px] uppercase tracking-wider">{["Thời điểm", "% đạt", "OOS", "DQ", ...sensorsPresent.map((k) => SENSOR_META[k]?.label || k)].map((h) => <th key={h} className="py-2 px-2 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{[...view].reverse().map((r, i) => { const low = r.comp != null && r.comp < 80; const m = vm[r.ts] || {}; return <tr key={i} className={`border-t border-slate-100 ${low ? "bg-amber-50/40" : ""}`}><td className="py-1.5 px-2 text-slate-500 whitespace-nowrap">{r.label}</td><td className={`py-1.5 px-2 tabular-nums font-medium ${low ? "text-amber-600" : ""}`}>{fmtPct(r.comp)}</td><td className="py-1.5 px-2 tabular-nums text-slate-500">{r.oos ?? "—"}</td><td className="py-1.5 px-2 tabular-nums text-slate-400">{r.dq == null ? "—" : `${r.dq}%`}</td>{sensorsPresent.map((k) => <td key={k} className="py-1.5 px-2 tabular-nums text-slate-500">{fmtPct(m[`comp_${k}`])}</td>)}</tr>; })}</tbody></table></div>
                </div>
              );
            }
            return <p className="mt-4 text-[13px] text-slate-500">Chưa có dữ liệu trong khoảng đã chọn để lập bảng.</p>;
          })()}
          <p className="text-[11px] text-slate-400 mt-3">Bảng &amp; đánh giá này là <b>số liệu tất định</b> từ dữ liệu đo — <b>giới hạn GHD/GHT lấy theo từng phòng trong CSDL</b> (không phải AI đặt). Dùng để <b>tự đánh giá xu hướng trước khi</b> AI gợi ý và QA kết luận.</p>
        </Card>
      </div>

      <Card className="p-6"><SectionTitle icon={CircleDot} hint="% điểm đạt mỗi cấp · theo dõi nhanh">Xu hướng theo cấp</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">{miniScopes.map(([lvl, sc]) => { const d = sc._series ? sc._series.slice(-(RANGE_DAYS[range] || 30)) : getSeries(sc, sensor, range); const lt = d[d.length - 1] || {}; const p = lt.comp; const pc = p == null ? "#94a3b8" : p < 70 ? COMPLY_BAD : p < 88 ? "#d99a2b" : COMPLY_OK; return <div key={lvl} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-3"><div className="flex items-center justify-between mb-1"><p className="text-xs font-semibold" style={{ color: COLOR.navy }}>{SCOPE_LEVELS.find((x) => x.k === lvl).label}</p><span className="text-[10px] px-2 py-0.5 rounded-full text-slate-600 bg-white ring-1 ring-slate-200">{sc.id}</span></div><div className="flex items-baseline gap-1.5 mb-1"><span className="text-2xl font-light tabular-nums leading-none" style={{ color: pc }}>{p == null ? "—" : fmtPct(p)}</span><span className="text-[10px] text-slate-400">% đạt mới nhất</span></div><p className="text-[10px] text-slate-400 mb-1 truncate">{sc.name}</p><Chart type="miniArea" data={d} h={84} /></div>; })}</div>
      </Card>

      <Card className="p-6"><SectionTitle icon={AlertOctagon} hint="Tổng → Khu → AHU → Phòng · tỉ lệ đạt 1/3/7 ngày">Xếp hạng rủi ro</SectionTitle>
        <div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Cấp", "Đối tượng", "Khu/AHU", "Đạt 1n", "Đạt 3n", "Đạt 7n", "Δ 7 ngày", "Xu hướng 14n", "Risk", "Đánh giá"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{riskRows.map((r) => { const comp = r.dat1n != null ? r.dat1n : r.latest.compliance; const a = comp == null ? ["Chờ dữ liệu", "text-slate-400"] : comp < 70 ? ["Cần điều tra ưu tiên", "text-rose-600"] : comp < 88 ? ["Cần chú ý", "text-amber-600"] : ["Tốt", "text-teal-600"]; const canPick = isLive && (r.type === level || level === "TOTAL"); return <tr key={`${r.type}:${r.id}`} className={`border-t border-slate-100 hover:bg-sky-50/40 ${r.type === "TOTAL" ? "bg-teal-50/30" : ""}`}><td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">{SCOPE_LEVELS.find((x) => x.k === r.type)?.label}</td><td className="py-2.5 pr-4"><button disabled={!canPick} onClick={() => { if (r.type !== "TOTAL") { setLevel(r.type); setSelId(r.id); } else { setLevel("TOTAL"); } }} className={`text-left ${canPick ? "hover:underline" : ""}`}><span className="font-semibold" style={{ color: COLOR.navy }}>{r.id}</span> <span className="text-slate-500">{r.name}</span></button></td><td className="py-2.5 pr-4 text-slate-500 whitespace-nowrap">{[r.area, r.ahu].filter(Boolean).join(" / ") || "—"}</td><td className="py-2.5 pr-4 tabular-nums font-medium">{fmtPct(r.dat1n)}</td><td className="py-2.5 pr-4 tabular-nums text-slate-600">{fmtPct(r.dat3n)}</td><td className="py-2.5 pr-4 tabular-nums text-slate-600">{fmtPct(r.dat7n)}</td><td className={`py-2.5 pr-4 tabular-nums font-medium ${deltaTone(r.delta7)}`}>{fmtDelta(r.delta7)}</td><td className="py-2.5 pr-4"><Chart type="sparkline" chuoi={r.chuoi} h={30} /></td><td className="py-2.5 pr-4"><span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: "rgba(226,103,79,0.14)", color: COLOR.coralDeep }}>{r.risk >= 999 ? "—" : r.risk}</span></td><td className={`py-2.5 pr-4 font-semibold whitespace-nowrap ${a[1]}`}>{a[0]}</td></tr>; })}</tbody></table></div>
        <p className="text-[11px] text-slate-400 mt-2">Bấm vào tên đối tượng để xem nhanh xu hướng của cấp đó. Tỉ lệ đạt = trung bình tuân thủ trong 1 / 3 / 7 ngày gần nhất.</p>
      </Card>

      {/* Mảng 3 — Dự báo xu hướng (RPC gate R²) */}
      {isLive && (
      <Card className="p-6"><SectionTitle icon={LineIcon} hint="hồi quy OLS + cổng R²≥0.5 · dải tin cậy robust (MAD) · dữ liệu thật">Dự báo xu hướng 7 ngày</SectionTitle>
        {dbBusy && !duBao ? <div className="mt-3 h-16 rounded-2xl bg-slate-50 animate-pulse" /> :
         !duBao ? <p className="mt-3 text-[13px] text-slate-400 italic">Chưa đủ dữ liệu để dự báo cho phạm vi đang chọn.</p> :
         (duBao.du_bao_dang_tin && (duBao.du_bao || []).length) ? (() => {
           const last = duBao.du_bao[duBao.du_bao.length - 1];
           const hv = { cai_thien: ["Cải thiện", COMPLY_OK], xau_di: ["Xấu đi", COMPLY_BAD], on_dinh: ["Ổn định", "#5f7a90"] }[duBao.huong] || ["—", "#5f7a90"];
           return (
             <div className="mt-3">
               <div className="flex items-baseline gap-3 flex-wrap">
                 <span className="text-3xl font-light tabular-nums" style={{ color: COMPLY_OK }}>{fmtPct(last.gia_tri)}</span>
                 <span className="text-[12px] text-slate-500">dự kiến sau 7 ngày · dải {fmtPct(last.canh_duoi)}–{fmtPct(last.canh_tren)}</span>
                 <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: hv[1] + "22", color: hv[1] }}>{hv[0]}</span>
                 <span className="text-[11px] text-slate-400">R²={(+duBao.r2).toFixed(2)}</span>
               </div>
               <p className="mt-2 text-[12px] leading-relaxed text-slate-600">{duBao.ghi_chu}</p>
               {(duBao.chuoi || []).length >= 2 && <div className="mt-3"><Chart type="forecast" chuoi={duBao.chuoi} duBao={duBao.du_bao} h={180} /></div>}
             </div>
           );
         })() : (
           <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-4">
             <p className="text-[13px] font-semibold text-slate-600">Không chiếu dự báo</p>
             <p className="text-[12px] text-slate-500 mt-1">{duBao.ghi_chu}</p>
           </div>
         )}
      </Card>
      )}

      {/* Mảng 3 — Bản đồ tuân thủ phòng × ngày (chỉ cấp Tổng/Khu) */}
      {isLive && maTran && (
      <Card className="p-6"><SectionTitle icon={CircleDot} hint="% đạt mỗi phòng theo ngày · phòng rủi ro nhất xếp trên">Bản đồ tuân thủ phòng × ngày</SectionTitle>
        <div className="mt-3"><Chart type="roomDayHeat" rooms={maTran.rooms} days={maTran.days} values={maTran.values} height={Math.max(180, maTran.rooms.length * 20 + 70)} h={Math.max(180, maTran.rooms.length * 20 + 70)} /></div>
      </Card>
      )}
    </div>
  );
}

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

/* ===== BÁO CÁO ===== */
function ReportsPage({ ai, aiRows = null }) {
  // ==== Gửi báo cáo bù qua WF5 v2 (n8n) — kỳ LIỀN TRƯỚC, chọn để gửi ====
  const [wf5Url, setWf5Url] = useState("");
  const [kyBu, setKyBu] = useState("THANG");           // mặc định: bù THÁNG trước
  const [guiTT, setGuiTT] = useState(null);            // null | 'DANG_GUI' | {ok, message|error}
  useEffect(() => { let huy = false; (async () => { const u = await layWebhookBaoCaoBu(); if (!huy) setWf5Url(u || ""); })(); return () => { huy = true; }; }, []);
  const KY_BU = [
    { key: "THANG", label: "Tháng trước" },
    { key: "TUAN", label: "Tuần trước" },
    { key: "QUY", label: "Quý trước" },
  ];
  const guiBu = async () => {
    if (guiTT === "DANG_GUI") return;
    setGuiTT("DANG_GUI");
    const r = await guiBaoCaoBu(wf5Url, kyBu);
    setGuiTT(r);
  };
  const sel = "rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[13px] text-slate-700 outline-none";
  const AI_LV = ["text-teal-700 bg-teal-50 ring-teal-200", "text-sky-700 bg-sky-50 ring-sky-200", "text-amber-700 bg-amber-50 ring-amber-200", "text-rose-700 bg-rose-50 ring-rose-200"];
  return (
    <div className="space-y-5">
      <SectionTitle icon={FileBarChart}>Báo cáo & Phân tích AI</SectionTitle>
      <Card className="p-6"><SectionTitle icon={Sparkles} hint="tích hợp từ tab Xu hướng GMP">Phân tích AI</SectionTitle>
        {ai ? <div className="rounded-2xl ring-1 ring-teal-100 p-5 text-sm leading-relaxed text-slate-700 mt-4" style={{ background: "linear-gradient(135deg,#EAF6F3,#fff)" }}><p className="text-[11px] text-slate-500 mb-2">{ai.scope} · {ai.sensor} · {ai.range} · tạo lúc {ai.time}</p><AiSections text={ai.text} /></div> : <div className="rounded-2xl ring-1 ring-amber-100 bg-amber-50/50 p-5 text-sm text-slate-600 mt-4">Chưa có phân tích. Vào tab <b>Xu hướng GMP</b>, chọn đối tượng/khoảng thời gian rồi bấm <b>AI phân tích</b>.</div>}
        {aiRows && aiRows.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5"><History className="w-3 h-3" strokeWidth={1.8} /> Phân tích đã lưu — gần đây</p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">{aiRows.map((r, i) => (
              <div key={i} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-3.5">
                <div className="flex items-center justify-between gap-2 mb-1"><span className="text-[12px] font-semibold" style={{ color: COLOR.navy }}>{r.scope}<span className="text-slate-400 font-normal"> · {r.sensor} · {r.range}</span></span><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${AI_LV[r.level] || AI_LV[0]}`}>{r.time}</span></div>
                <p className="text-[12px] leading-relaxed text-slate-600">{r.text}</p>
              </div>
            ))}</div>
          </div>
        )}
      </Card>
      <Card className="p-6"><SectionTitle icon={Mail} hint="báo cáo quản trị WF5 v2 — kỳ liền trước">Gửi báo cáo bù (email)</SectionTitle>
        <p className="text-[12px] text-slate-500 mt-3">Dùng khi cần gửi lại báo cáo của kỳ đã qua (ví dụ lịch tự động bị lỡ). Hệ thống tổng hợp số liệu thật từ Supabase (<code className="text-[11px]">rpc_bao_cao_tong_hop</code>), ráp scorecard + PDF rồi gửi email trong nền (~1 phút).</p>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label className="text-[11px] uppercase text-slate-500 font-semibold">Kỳ báo cáo</label>
          <select value={kyBu} onChange={(e) => setKyBu(e.target.value)} className={sel}>
            {KY_BU.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <button onClick={guiBu} disabled={guiTT === "DANG_GUI" || !wf5Url}
            className={`text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${guiTT === "DANG_GUI" ? "opacity-60 cursor-wait" : !wf5Url ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{ backgroundColor: COLOR.coral }}>
            <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
            {guiTT === "DANG_GUI" ? "Đang gửi yêu cầu…" : "Gửi báo cáo bù"}
          </button>
          <button onClick={() => window.print()} className="text-xs font-medium rounded-xl px-4 py-2 text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> In / PDF</button>
        </div>
        {guiTT && guiTT !== "DANG_GUI" && (guiTT.ok
          ? <p className="text-xs text-teal-600 font-medium mt-3">✓ {guiTT.message || "Đã nhận yêu cầu — báo cáo sẽ được tạo và gửi email trong vài phút."}</p>
          : <p className="text-xs text-rose-600 font-medium mt-3">✗ Không gửi được yêu cầu ({guiTT.error === "CHUA_CAU_HINH_WEBHOOK" ? "chưa cấu hình cau_hinh.wf5_webhook_bao_cao_bu" : guiTT.error}). Thử lại hoặc báo IT.</p>)}
        <p className="text-[11px] text-slate-400 mt-3">Người nhận quản lý trong bảng <b>nguoi_nhan_bao_cao</b> (Supabase — bật <code className="text-[10px]">kich_hoat</code> sau khi điền email thật); chưa kích hoạt ai thì gửi về địa chỉ trong <code className="text-[10px]">cau_hinh.email_bao_cao_thang/tuan</code>. File PDF/HTML đồng thời lưu Google Drive.</p>
      </Card>
    </div>
  );
}

/* ============ APP ============ */

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
  const tip = [
    cuaSo ? `Cửa sổ dữ liệu mới nhất: ${cuaSo}` : "Chưa có bản ghi dữ liệu",
    `Trễ ${treTxt} tính từ mốc đóng cửa sổ giờ (ngưỡng mất dữ liệu ${sk.nguongGio ?? 2}h; thu mỗi giờ nên trễ ≤ ~1.1h là bình thường)`,
    lc ? `WF1 lần cuối: ${lc.trangThai || "?"}${lc.ketThuc ? " · " + new Date(lc.ketThuc).toLocaleString("vi-VN") : ""}` : "Chưa ghi nhận WF1 chạy",
    `Sự cố đang mở: ${sk.suCoDangMo} (Mức 1: ${sk.soCritical} · Cảnh báo: ${sk.soWarning})`,
  ].join("\n");
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
        <p className={`text-xs font-semibold ${txt}`}>{mat ? "MẤT DỮ LIỆU" : `Dữ liệu mới · trễ ${treTxt}`}</p>
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

// ====== Tab NGƯỜI NHẬN: danh bạ cảnh báo (nguoi_nhan_canh_bao, vai trò × khu C1/C4/Q2)
// + người nhận báo cáo (nguoi_nhan_bao_cao, có khu_vuc) + email hệ thống (cau_hinh) ======
const NHAN_EMAIL_LABEL = {
  email_ipc: "IPC (Hiện trường)", email_co_dien: "Cơ điện", email_qa: "QA",
  email_truc_hsl: "Trực hồ sơ lô", email_it_gmp: "IT / Kỹ thuật",
  email_gui_tu: "Địa chỉ GỬI ĐI (from)", email_test: "Địa chỉ TEST (chế độ thử)",
  email_bao_cao_tuan: "Fallback báo cáo TUẦN", email_bao_cao_thang: "Fallback báo cáo THÁNG", email_bao_cao_ngay: "Fallback báo cáo NGÀY",
};
const DS_KHU = ["C1", "C4", "Q2"];                 // 3 khu của nhà máy — khớp check trong RPC
const DS_VAI_TRO_CB = [["IPC", "IPC hiện trường"], ["MEP", "Cơ điện"], ["QA", "QA"], ["LOT", "Trực HSL"], ["IT", "IT"]];
const DB_MOI_MAC_DINH = () => ({ email: "", ho_ten: "", vai_tro: "IPC", khu_vuc: [...DS_KHU], ahu: [], kich_hoat: true });

// Ô phân công AHU cho Cơ điện. Rỗng = nhận MỌI AHU trong các khu đã tích.
// Chỉ liệt kê AHU thuộc khu người đó phụ trách; AHU toàn phòng P3 hiện mờ vì không sinh sự cố.
function ChonAhu({ nn, dsAhu, canManage, onLuu }) {
  const [mo, setMo] = useState(false);
  if (nn.vai_tro !== "MEP") return <span className="text-[11px] text-slate-300">—</span>;
  const daChon = nn.ahu || [];
  const trongKhu = dsAhu.filter((a) => (nn.khu_vuc || []).includes(a.khu_vuc));
  const toggle = (maAhu) => onLuu({ ...nn, ahu: daChon.includes(maAhu) ? daChon.filter((x) => x !== maAhu) : [...daChon, maAhu] });
  const nhan = daChon.length === 0 ? "Tất cả AHU" : `${daChon.length} AHU`;
  return (
    <div className="relative">
      <button disabled={!canManage} onClick={() => setMo((v) => !v)}
        className={`text-[11px] px-2 py-1 rounded-lg font-medium whitespace-nowrap ${daChon.length ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"} disabled:opacity-60`}>
        {nhan} ▾
      </button>
      {mo && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMo(false)} />
          <div className="absolute z-20 mt-1 left-0 w-56 rounded-xl bg-white ring-1 ring-slate-200 shadow-lg p-2 max-h-64 overflow-y-auto">
            <p className="text-[10px] text-slate-400 px-1 pb-1.5 leading-snug">Bỏ trống = nhận mọi AHU trong khu đã tích.</p>
            {trongKhu.length === 0 && <p className="text-[11px] text-slate-400 px-1 py-2 italic">Chưa tích khu nào.</p>}
            {trongKhu.map((a) => (
              <label key={a.ma_ahu} className={`flex items-center gap-2 px-1 py-1 rounded-lg text-[12px] cursor-pointer hover:bg-slate-50 ${a.co_p1_p2 ? "" : "opacity-45"}`}>
                <input type="checkbox" checked={daChon.includes(a.ma_ahu)} onChange={() => toggle(a.ma_ahu)} className="rounded" />
                <span className="font-mono">{a.ma_ahu}</span>
                <span className="text-slate-400 ml-auto">{a.co_p1_p2 ? `${a.so_phong} phòng` : "chỉ P3"}</span>
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
      <div key={k} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
        <label className="text-[11px] uppercase text-slate-500 font-semibold">{NHAN_EMAIL_LABEL[k] || k}</label>
        <input type="email" value={emailCfg[k] || ""} disabled={!canManage} placeholder="email@cpc1hn.vn"
          onChange={(e) => setEmailCfg((m) => ({ ...m, [k]: e.target.value }))}
          onBlur={(e) => { if ((e.target.value || "").trim() !== (goc.current[k] || "")) luuEmail(k, e.target.value); }}
          className="w-full mt-2 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" />
        <p className="text-[10px] text-slate-400 mt-1 font-mono">{k}</p>
      </div>))}</div>
  );
  if (!isLive) return <Card className="p-6"><p className="text-sm text-amber-600">Cần chế độ LIVE (kết nối Supabase) để cấu hình người nhận.</p></Card>;
  return (
    <div className="space-y-5">
      <SectionTitle icon={Mail}>Người nhận email</SectionTitle>
      {tb && <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${tb.ok ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"}`}>{tb.ok ? "✓ " : "✗ "}{tb.text}</div>}
      {!canManage && <p className="text-[12px] text-amber-600">Bạn đang xem ở chế độ chỉ-đọc. Cần quyền <b>QA/Quản trị</b> để chỉnh.</p>}

      <Card className="p-6">
        <SectionTitle icon={AlertOctagon} hint="định tuyến cảnh báo theo vai trò × khu — sự cố khu nào gửi người tích khu đó">Danh bạ email CẢNH BÁO (vai trò × khu)</SectionTitle>
        {tai ? <div className="h-24 rounded-2xl bg-slate-50 animate-pulse mt-4" /> :
          <div className="overflow-x-auto mt-4"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Email", "Họ tên", "Vai trò", "C1", "C4", "Q2", "AHU phụ trách", "Hoạt động", ""].map((h, i) => <th key={i} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {danhBa.length === 0 && !canManage && <tr><td colSpan={9} className="py-4 text-slate-400 italic">Chưa có địa chỉ nào trong danh bạ.</td></tr>}
              {danhBa.map((n) => (
                <tr key={n.id} className={`border-t border-slate-100 ${n.kich_hoat ? "" : "opacity-50"}`}>
                  <td className="py-2 pr-4"><input type="email" value={n.email || ""} disabled={!canManage} onChange={(e) => suaDB(n.id, "email", e.target.value)} onBlur={() => blurDB(n, "email")} className="w-full min-w-[190px] rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] font-mono disabled:bg-slate-50 disabled:ring-0" /></td>
                  <td className="py-2 pr-4"><input value={n.ho_ten || ""} disabled={!canManage} placeholder="—" onChange={(e) => suaDB(n.id, "ho_ten", e.target.value)} onBlur={() => blurDB(n, "ho_ten")} className="w-full min-w-[110px] rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-sm disabled:bg-slate-50 disabled:ring-0" /></td>
                  <td className="py-2 pr-4"><select value={n.vai_tro} disabled={!canManage} onChange={(e) => luuDB({ ...n, vai_tro: e.target.value })} className="rounded-xl bg-white ring-1 ring-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50">{DS_VAI_TRO_CB.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  {DS_KHU.map((k) => <td key={k} className="py-2 pr-4"><button disabled={!canManage} onClick={() => toggleKhuDB(n, k)} className={`w-6 h-6 rounded-lg flex items-center justify-center ${(n.khu_vuc || []).includes(k) ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-300"} disabled:opacity-60`}>{(n.khu_vuc || []).includes(k) ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                  <td className="py-2 pr-4"><ChonAhu nn={n} dsAhu={dsAhu} canManage={canManage} onLuu={(x) => luuDB(x, "Đã lưu phân công AHU")} /></td>
                  <td className="py-2 pr-4"><button disabled={!canManage} onClick={() => luuDB({ ...n, kich_hoat: !n.kich_hoat })} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${n.kich_hoat ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-500"} disabled:opacity-60`}>{n.kich_hoat ? "Bật" : "Tắt"}</button></td>
                  <td className="py-2 pr-4">{canManage && <button onClick={() => xoaDB(n.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" strokeWidth={1.8} /></button>}</td>
                </tr>))}
              {canManage && (  /* hàng THÊM MỚI cuối bảng */
                <tr className="border-t border-slate-200 bg-sky-50/50">
                  <td className="py-2.5 pr-4"><input type="email" value={dbMoi.email} placeholder="email@cpc1hn.vn" onChange={(e) => setDbMoi({ ...dbMoi, email: e.target.value })} onKeyDown={(e) => e.key === "Enter" && themDB()} className="w-full min-w-[190px] rounded-xl bg-white ring-1 ring-sky-200 px-3 py-1.5 text-[12px] font-mono" /></td>
                  <td className="py-2.5 pr-4"><input value={dbMoi.ho_ten} placeholder="Họ tên (tuỳ chọn)" onChange={(e) => setDbMoi({ ...dbMoi, ho_ten: e.target.value })} className="w-full min-w-[110px] rounded-xl bg-white ring-1 ring-sky-200 px-3 py-1.5 text-sm" /></td>
                  <td className="py-2.5 pr-4"><select value={dbMoi.vai_tro} onChange={(e) => setDbMoi({ ...dbMoi, vai_tro: e.target.value })} className="rounded-xl bg-white ring-1 ring-sky-200 px-2 py-1.5 text-sm">{DS_VAI_TRO_CB.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  {DS_KHU.map((k) => <td key={k} className="py-2.5 pr-4"><button onClick={() => setDbMoi({ ...dbMoi, khu_vuc: dbMoi.khu_vuc.includes(k) ? dbMoi.khu_vuc.filter((x) => x !== k) : [...dbMoi.khu_vuc, k] })} className={`w-6 h-6 rounded-lg flex items-center justify-center ${dbMoi.khu_vuc.includes(k) ? "bg-teal-100 text-teal-700" : "bg-white ring-1 ring-slate-200 text-slate-300"}`}>{dbMoi.khu_vuc.includes(k) ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                  <td className="py-2.5 pr-4 text-[11px] text-slate-400">{dbMoi.vai_tro === "MEP" ? "Phân công sau khi thêm" : "—"}</td>
                  <td className="py-2.5 pr-4 text-[11px] text-slate-400">Kích hoạt</td>
                  <td className="py-2.5 pr-4"><button onClick={themDB} className="text-xs font-medium text-white rounded-xl px-3 py-1.5 flex items-center gap-1" style={{ backgroundColor: COLOR.coral }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm</button></td>
                </tr>)}
            </tbody></table></div>}
        <p className="text-[11px] text-slate-400 mt-3">Sự cố ở khu nào chỉ gửi người có tích khu đó, và <b>chỉ khi tài khoản của họ được xem khu đó</b>. Khu chưa ai tích → gửi toàn bộ người hợp lệ của vai trò (không bỏ sót). <b>Phải chọn ít nhất một khu</b> — bỏ tích cả ba sẽ không lưu được.</p>
        <p className="text-[11px] text-slate-400 mt-1"><b>AHU phụ trách</b> chỉ áp dụng cho Cơ điện: mỗi AHU sẽ gửi một email riêng cho đúng người phụ trách. Bỏ trống = nhận mọi AHU trong các khu đã tích. Tên AHU trùng nhau giữa các khu nên ghi dạng <span className="font-mono">KHU/AHU</span>. AHU hiển thị mờ là AHU chỉ có phòng P3 — không bao giờ sinh sự cố.</p>
      </Card>

      <Card className="p-6">
        <SectionTitle icon={Clock} hint="chỉ gửi email cảnh báo trong khung giờ của từng bộ phận — chỉ Quản trị chỉnh được">Đồng hồ cảnh báo theo bộ phận</SectionTitle>
        {!laAdmin && <p className="text-[12px] text-amber-600 mt-2">Chỉ <b>Quản trị</b> được sửa đồng hồ. Bạn đang xem chỉ-đọc.</p>}
        {tai ? <div className="h-24 rounded-2xl bg-slate-50 animate-pulse mt-4" /> :
          <div className="overflow-x-auto mt-4"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Bộ phận", "Chế độ", "Từ", "Đến", "Ngày trong tuần", "Hiện tại", "Cập nhật"].map((h, i) => <th key={i} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {dongHo.map((k) => (
                <tr key={k.vai_tro} className="border-t border-slate-100">
                  <td className="py-2.5 pr-4 font-semibold" style={{ color: COLOR.navy }}>{ROLE_VI[k.vai_tro] || k.vai_tro}</td>
                  <td className="py-2.5 pr-4">
                    <button disabled={!laAdmin} onClick={() => suaDongHo(k.vai_tro, { kich_hoat: !k.kich_hoat })}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${k.kich_hoat ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"} disabled:opacity-60`}>
                      {k.kich_hoat ? "Theo khung giờ" : "24/7"}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4"><input type="time" value={k.gio_tu || ""} disabled={!laAdmin || !k.kich_hoat}
                    onChange={(e) => suaDongHo(k.vai_tro, { gio_tu: e.target.value })}
                    className="rounded-xl bg-white ring-1 ring-slate-200 px-2.5 py-1.5 text-[12px] tabular-nums disabled:bg-slate-50 disabled:text-slate-400" /></td>
                  <td className="py-2.5 pr-4"><input type="time" value={k.gio_den || ""} disabled={!laAdmin || !k.kich_hoat}
                    onChange={(e) => suaDongHo(k.vai_tro, { gio_den: e.target.value })}
                    className="rounded-xl bg-white ring-1 ring-slate-200 px-2.5 py-1.5 text-[12px] tabular-nums disabled:bg-slate-50 disabled:text-slate-400" /></td>
                  <td className="py-2.5 pr-4">
                    <div className="flex gap-1">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((nhan, i) => {
                      const d = i + 1; const on = (k.ngay || []).includes(d);
                      return <button key={d} disabled={!laAdmin || !k.kich_hoat}
                        onClick={() => suaDongHo(k.vai_tro, { ngay: on ? (k.ngay || []).filter((x) => x !== d) : [...(k.ngay || []), d].sort((a, b) => a - b) })}
                        className={`w-8 h-7 rounded-lg text-[11px] font-semibold ${on ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-300"} disabled:opacity-60`}>{nhan}</button>;
                    })}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${k.dang_trong_gio ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"}`}>
                      {k.dang_trong_gio ? "đang gửi cảnh báo" : "ngoài giờ — im lặng"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-[11px] text-slate-400 whitespace-nowrap">{k.cap_nhat_boi ? `${k.cap_nhat_luc} · ${k.cap_nhat_boi}` : "—"}</td>
                </tr>))}
            </tbody></table></div>}
        {laAdmin && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button onClick={luuTatCaDongHo} disabled={!dongHoDoi.length || dangLuuDH}
              className="text-xs font-semibold text-white rounded-xl px-4 py-2 flex items-center gap-1.5 disabled:opacity-40"
              style={{ backgroundColor: COLOR.coral }}>
              <Save className="w-3.5 h-3.5" strokeWidth={2} />
              {dangLuuDH ? "Đang lưu…" : dongHoDoi.length ? `Lưu thay đổi (${dongHoDoi.length} bộ phận)` : "Lưu thay đổi"}
            </button>
            {dongHoDoi.length > 0 && !dangLuuDH && (
              <button onClick={huyDongHo} className="text-xs font-medium text-slate-500 rounded-xl px-3.5 py-2 ring-1 ring-slate-200 bg-white hover:bg-slate-50">Hủy — về bản đã lưu</button>
            )}
            {dongHoDoi.length > 0 && <span className="text-[11px] text-amber-600">Thay đổi CHƯA có hiệu lực cho tới khi bấm Lưu.</span>}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-3"><b>Ngoài khung giờ</b> bộ phận đó KHÔNG nhận email (cả nhắc định kỳ lẫn email tức thời); vé vẫn mở, web vẫn hiện, hệ vẫn tự đóng khi đủ 2 giờ sạch. Vào lại khung giờ, lượt kiểm 5′ đầu tiên gửi ngay các vé còn mở — không mất tin. Muốn một bộ phận nhận 24/7 (ví dụ Trực HSL) thì để chế độ <b>24/7</b>.</p>
        <p className="text-[11px] text-slate-400 mt-1">Lưu ý: đồng hồ leo thang (IPC 20′ · Cơ điện chưa nhận việc 15′ · đang/chờ xử lý 1 giờ) vẫn chạy ngoài giờ — sáng vào khung giờ, vé tồn qua đêm sẽ hiện đã leo thang lên Trực.</p>
      </Card>

      <Card className="p-6"><SectionTitle icon={Cog} hint="địa chỉ gửi đi + nhận khi ở chế độ thử + fallback báo cáo">Địa chỉ hệ thống & fallback</SectionTitle>
        {tai ? <div className="h-24 rounded-2xl bg-slate-50 animate-pulse mt-4" /> : emailFields([...EMAIL_KEYS_HE_THONG, ...EMAIL_KEYS_BAO_CAO])}
        <p className="text-[11px] text-slate-400 mt-3">Các key cảnh báo cũ (email_ipc, email_co_dien, email_qa, email_truc_hsl, email_it_gmp) trong Cài đặt chỉ còn là <b>dự phòng tầng 3</b> — hệ thống chỉ dùng khi danh bạ cảnh báo phía trên trống hoàn toàn.</p>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SectionTitle icon={FileBarChart} hint="ai nhận báo cáo quản trị tuần / tháng / quý (WF5)">Người nhận BÁO CÁO</SectionTitle>
          {canManage && <button onClick={() => setForm({ ho_ten: "", email: "", vai_tro: "", nhan_tuan: true, nhan_thang: true, nhan_quy: true, kich_hoat: true })} className="text-xs font-medium text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: COLOR.coral }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm người</button>}
        </div>
        {form && (
          <div className="rounded-2xl bg-sky-50/60 ring-1 ring-sky-200 p-4 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input value={form.ho_ten} onChange={(e) => setForm({ ...form, ho_ten: e.target.value })} placeholder="Họ tên" className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm" />
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm" />
            <input value={form.vai_tro || ""} onChange={(e) => setForm({ ...form, vai_tro: e.target.value })} placeholder="Vai trò (QA, Quản lý…)" className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm" />
            <div className="flex items-center gap-3 flex-wrap text-[12px] text-slate-600">
              {[["nhan_tuan", "Tuần"], ["nhan_thang", "Tháng"], ["nhan_quy", "Quý"], ["kich_hoat", "Kích hoạt"]].map(([f, l]) => <label key={f} className="flex items-center gap-1.5"><input type="checkbox" checked={!!form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.checked })} />{l}</label>)}
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
              <button onClick={luuNN} className="text-xs font-medium text-white rounded-xl px-4 py-2 flex items-center gap-1.5" style={{ backgroundColor: COLOR.teal }}><Save className="w-3.5 h-3.5" strokeWidth={2} /> Lưu</button>
              <button onClick={() => setForm(null)} className="text-xs font-medium text-slate-600 rounded-xl px-4 py-2 ring-1 ring-slate-200 flex items-center gap-1.5"><X className="w-3.5 h-3.5" strokeWidth={2} /> Huỷ</button>
            </div>
          </div>
        )}
        {tai ? <div className="h-24 rounded-2xl bg-slate-50 animate-pulse mt-4" /> :
          <div className="overflow-x-auto mt-4"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Họ tên", "Email", "Vai trò", "Tuần", "Tháng", "Quý", "C1", "C4", "Q2", "Hoạt động", ""].map((h, i) => <th key={i} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{nguoiNhan.length === 0 ? <tr><td colSpan={11} className="py-4 text-slate-400 italic">Chưa có người nhận. Bấm “Thêm người”.</td></tr> : nguoiNhan.map((n) => (
              <tr key={n.id} className={`border-t border-slate-100 ${n.kich_hoat ? "" : "opacity-50"}`}>
                <td className="py-2.5 pr-4 font-semibold" style={{ color: COLOR.navy }}>{n.ho_ten}</td>
                <td className="py-2.5 pr-4 text-slate-600 font-mono text-[12px]">{n.email}</td>
                <td className="py-2.5 pr-4 text-slate-500">{n.vai_tro || "—"}</td>
                {["nhan_tuan", "nhan_thang", "nhan_quy"].map((f) => <td key={f} className="py-2.5 pr-4"><button disabled={!canManage} onClick={() => toggleNN(n, f)} className={`w-6 h-6 rounded-lg flex items-center justify-center ${n[f] ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-300"} disabled:opacity-60`}>{n[f] ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                {DS_KHU.map((k) => <td key={k} className="py-2.5 pr-4"><button disabled={!canManage} onClick={() => toggleKhuNN(n, k)} className={`w-6 h-6 rounded-lg flex items-center justify-center ${(n.khu_vuc || []).includes(k) ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-300"} disabled:opacity-60`}>{(n.khu_vuc || []).includes(k) ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                <td className="py-2.5 pr-4"><button disabled={!canManage} onClick={() => toggleNN(n, "kich_hoat")} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${n.kich_hoat ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-500"} disabled:opacity-60`}>{n.kich_hoat ? "Bật" : "Tắt"}</button></td>
                <td className="py-2.5 pr-4">{canManage && <div className="flex gap-1.5"><button onClick={() => setForm({ ...n })} className="text-sky-600 hover:text-sky-800"><Pencil className="w-4 h-4" strokeWidth={1.8} /></button><button onClick={() => xoaNN(n.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" strokeWidth={1.8} /></button></div>}</td>
              </tr>))}</tbody></table></div>}
        <p className="text-[11px] text-slate-400 mt-3">Tích 1 khu = nhận báo cáo riêng khu đó · tích ≥2 khu = nhận bản Tổng (áp dụng khi bật báo cáo theo khu). Chỉ người <b>Kích hoạt</b> mới nhận báo cáo; chưa kích hoạt ai thì WF5 gửi về địa chỉ fallback (mục Địa chỉ hệ thống · Fallback). Mỗi thao tác được ghi nhật ký cấu hình.</p>
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
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-semibold ring-1 transition ${bat ? "bg-teal-50 text-teal-700 ring-teal-200" : "bg-slate-50 text-slate-500 ring-slate-200"} ${canManage ? "hover:ring-teal-300" : "opacity-60 cursor-not-allowed"}`}>
          <Power className="w-3.5 h-3.5" strokeWidth={2} /> {bat ? "ĐANG BẬT" : "ĐANG TẮT"}
        </button>
      </div>
      <p className="text-[12px] text-slate-500 mt-2">Khi <b>BẬT</b>: mỗi 15 phút hệ thống quét sự cố <b>chưa xử lý</b> (mở trong 48h) khớp luật bên dưới và đã chờ đủ số phút → tự chuyển sang <b>Cơ điện</b> (ghi nhật ký, IPC vẫn nhận bản digest). Bản chất kỹ thuật (vd chênh áp nghiêm trọng = nghi lỗi AHU) không còn nằm chờ khi IPC vắng.</p>
      {note && <p className={`mt-3 text-[12px] rounded-xl px-3 py-2 ring-1 ${note.loi ? "text-rose-700 bg-rose-50 ring-rose-100" : "text-teal-700 bg-teal-50 ring-teal-100"}`}>{note.msg}</p>}

      {tai ? <div className="h-24 rounded-2xl bg-slate-50 animate-pulse mt-4" /> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse min-w-[640px]">
            <thead><tr className="text-left text-slate-400 text-[10px] uppercase tracking-wide">
              <th className="py-2 px-2">Loại cảm biến</th><th className="py-2 px-2">Mức</th><th className="py-2 px-2 text-right">Chờ trước (phút)</th><th className="py-2 px-2">Diễn giải</th><th className="py-2 px-2 text-center">Bật</th><th className="py-2 px-2"></th>
            </tr></thead>
            <tbody>
              {luat.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-2 px-2 font-semibold" style={{ color: COLOR.navy }}>{SENSOR_VI[l.loai_cam_bien] || l.loai_cam_bien}</td>
                  <td className="py-2 px-2">{MUC_VI[l.muc_canh_bao] || l.muc_canh_bao}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{l.cho_it_nhat_phut}′</td>
                  <td className="py-2 px-2 text-slate-500 text-[11px] max-w-[280px]">{l.ly_do_mau}</td>
                  <td className="py-2 px-2 text-center"><button onClick={() => doiKichHoat(l)} disabled={!canManage} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${l.kich_hoat ? "text-teal-700 bg-teal-50" : "text-slate-400 bg-slate-100"} ${canManage ? "" : "opacity-60"}`}>{l.kich_hoat ? "bật" : "tắt"}</button></td>
                  <td className="py-2 px-2 text-right">{canManage && <button onClick={() => xoa(l.id)} className="text-slate-400 hover:text-rose-500 p-1" title="Xoá luật"><Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} /></button>}</td>
                </tr>
              ))}
              {luat.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-400 text-[12px]">Chưa có luật nào.</td></tr>}
            </tbody>
          </table>

          {canManage && (
            <div className="mt-4 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
              <p className="text-[11px] uppercase text-slate-500 font-semibold mb-3">Thêm luật mới</p>
              <div className="flex items-end gap-3 flex-wrap">
                <label className="flex flex-col gap-1"><span className="text-[10px] text-slate-500 font-medium">Loại cảm biến</span>
                  <select value={moi.loai_cam_bien} onChange={(e) => setMoi({ ...moi, loai_cam_bien: e.target.value })} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[12px]">{["DP", "RH", "T", "*"].map((k) => <option key={k} value={k}>{SENSOR_VI[k]}</option>)}</select></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] text-slate-500 font-medium">Mức</span>
                  <select value={moi.muc_canh_bao} onChange={(e) => setMoi({ ...moi, muc_canh_bao: e.target.value })} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[12px]">{["CRITICAL", "WARNING", "*"].map((k) => <option key={k} value={k}>{MUC_VI[k]}</option>)}</select></label>
                <label className="flex flex-col gap-1"><span className="text-[10px] text-slate-500 font-medium">Chờ trước (phút)</span>
                  <input type="number" min="0" max="1440" value={moi.cho_it_nhat_phut} onChange={(e) => setMoi({ ...moi, cho_it_nhat_phut: Number(e.target.value) })} className="w-24 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[12px]" /></label>
                <label className="flex flex-col gap-1 flex-1 min-w-[180px]"><span className="text-[10px] text-slate-500 font-medium">Diễn giải (tuỳ chọn)</span>
                  <input value={moi.ly_do_mau} onChange={(e) => setMoi({ ...moi, ly_do_mau: e.target.value })} placeholder="vd: chênh áp nghiêm trọng — nghi lỗi AHU" className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[12px]" /></label>
                <button onClick={themLuat} disabled={luu} className={`flex items-center gap-1.5 text-[12px] font-medium text-white rounded-xl px-4 py-2 ${luu ? "opacity-60" : ""}`} style={{ backgroundColor: COLOR.teal }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm</button>
              </div>
            </div>
          )}
        </div>
      )}
      {!canManage && <p className="text-[11px] text-amber-600 mt-3">Cần quyền QA/Quản trị để chỉnh luật.</p>}
      <p className="text-[10.5px] text-slate-400 mt-3">Tuyến hiện hỗ trợ: sự cố → <b>Cơ điện</b> (qua đúng máy trạng thái duyệt sự cố, có nhật ký người thao tác “hệ thống”). Sự cố hạ tầng cảm biến (đứng hình, mất FMS) đã có nhánh cảnh báo Cơ điện riêng.</p>
    </Card>
  );
}

/* ===== QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN XEM THEO KHU (chỉ ADMIN) ===== */
const VAI_TRO_CHON = [{ k: "IPC", label: "IPC Hiện trường" }, { k: "MEP", label: "Cơ điện" }, { k: "LOT", label: "Trực HSL" }, { k: "QA", label: "QA Kiểm soát" }, { k: "ADMIN", label: "Quản trị" }];
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

/* ===== SỰ CỐ GẦN ĐÂY — bản đồ phút cửa sổ 8h (chỉ phòng có sự cố) ===== */
const RECENT_RANGES = [{ k: 1, label: "1 giờ" }, { k: 4, label: "4 giờ" }, { k: 8, label: "8 giờ" }];
// ====== Modal xác nhận thao tác đến từ NÚT TRONG EMAIL (deep link) ======
// Vì sao tồn tại: nút email không thể nhập ghi chú, cũng không biết ai đang bấm.
// Đưa về web ⇒ (1) DB xác thực vai trò + khu qua JWT, (2) nhập được ghi chú bắt
// buộc, (3) audit ghi email THẬT thay vì 'email:IPC', (4) bộ quét link của Gmail
// không thể vô tình thao tác vì mọi thứ chỉ chạy sau khi người dùng bấm Xác nhận.
function ModalVeEmail({ trangThai, onDong, onChay }) {
  const [lyDo, setLyDo] = useState("");
  const [dangChay, setDangChay] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  if (!trangThai) return null;
  const ve = trangThai.ve;
  const canNote = !!ve?.bat_buoc_ly_do;
  const thieuNote = canNote && !lyDo.trim();
  const xacNhan = async () => {
    if (thieuNote || dangChay) return;
    setDangChay(true);
    setKetQua(await onChay(lyDo.trim() || null));
    setDangChay(false);
  };
  const Khung = ({ children }) => createPortal(
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-6">{children}</div>
    </div>, document.body);

  if (trangThai.dangTai) return <Khung><p className="text-sm text-slate-500 py-6 text-center">Đang kiểm tra liên kết…</p></Khung>;

  // Màn từ chối. Câu hỏi đầu tiên của người bấm nút luôn là "vậy tôi đã ấn nút nào?"
  // — DB trả sẵn thao_tac_gan_nhat và nut_kha_dung, ta chỉ việc bày ra.
  if (trangThai.loi || (ketQua && !ketQua.ok)) {
    const boiCanh = ketQua && !ketQua.ok ? ketQua : ve;      // nguồn ngữ cảnh giàu nhất đang có
    const ganNhat = boiCanh?.thao_tac_gan_nhat;
    const khaDung = boiCanh?.nut_kha_dung || [];
    return (
      <Khung>
        <h3 className="text-base font-semibold text-rose-700">Không thực hiện được</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{trangThai.loi || ketQua.thong_bao}</p>
        {ganNhat && (
          <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3 text-[13px]">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Thao tác gần nhất</div>
            <div className="mt-1 text-slate-700 font-medium">{ganNhat.nhan}</div>
            <div className="text-[12px] text-slate-500">{ganNhat.vai_tro} · {ganNhat.boi} · {ganNhat.luc_hien_thi}</div>
          </div>)}
        {khaDung.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Bây giờ bạn bấm được</div>
            <ul className="mt-1.5 space-y-1">
              {khaDung.map((n) => (
                <li key={n.hanh_dong} className="text-[13px] text-slate-700 flex gap-1.5">
                  <span className="text-slate-300">•</span>{n.nhan}
                </li>))}
            </ul>
          </div>)}
        <p className="text-[12px] text-slate-400 mt-3">Bạn vẫn có thể xử lý sự cố trực tiếp ở tab <b>Sự cố</b>.</p>
        <button onClick={onDong} className="mt-5 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700">Đóng</button>
      </Khung>);
  }

  if (ketQua?.ok) return (
    <Khung>
      <h3 className="text-base font-semibold text-teal-700">✓ Đã ghi nhận</h3>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{ketQua.thong_bao}</p>
      <button onClick={onDong} className="mt-5 w-full rounded-xl py-2.5 text-sm font-medium text-white" style={{ backgroundColor: COLOR.teal }}>Xong</button>
    </Khung>);

  return (
    <Khung>
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Thao tác từ email · {ve.vai_tro_can}</p>
      <h3 className="text-base font-semibold text-slate-800 mt-1">{ve.nhan}</h3>
      <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3 text-[13px] text-slate-600 space-y-1">
        <div><b>{ve.ma_hien_thi}</b> · {ve.ma_phong} {ve.ten_phong ? `— ${ve.ten_phong}` : ""}</div>
        <div className="text-[12px] text-slate-500">{ve.khu_vuc} · {ve.ahu || "—"} · {ve.loai_cam_bien} · {ve.muc_canh_bao}</div>
        <div className="text-[12px] text-slate-500">
          Trạng thái: <b>{ve.nhan_trang_thai || ve.trang_thai_hien_tai}</b>
          {ve.giu_trang_thai
            ? <span className="text-slate-400"> — thao tác này chỉ ghi chú, không đổi trạng thái</span>
            : <> → <b>{ve.nhan_trang_thai_sau || ve.trang_thai_sau}</b>{ve.dong_su_co && <span className="text-teal-600"> (đóng sự cố)</span>}</>}
        </div>
        {ve.thao_tac_gan_nhat && (
          <div className="text-[12px] text-slate-500">
            Gần nhất: <b>{ve.thao_tac_gan_nhat.nhan}</b> — {ve.thao_tac_gan_nhat.vai_tro} · {ve.thao_tac_gan_nhat.luc_hien_thi}
          </div>)}
        {ve.so_lan_vang > 0 && (
          <div className="text-[12px] text-amber-700">Đã báo “không tại hiện trường” {ve.so_lan_vang} lần</div>)}
      </div>
      {canNote && (
        <div className="mt-3">
          <label className="text-[11px] uppercase text-slate-500 font-semibold">Nội dung sự cố / biện pháp <span className="text-rose-500">*</span></label>
          <textarea value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={3} autoFocus
            placeholder="Ví dụ: van điều tiết kẹt, đã chỉnh lại 40% và theo dõi 30 phút"
            className="w-full mt-1.5 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm" />
          <p className="text-[11px] text-slate-400 mt-1">Bắt buộc — ghi vào hồ sơ kiểm toán ALCOA+.</p>
        </div>)}
      <div className="flex gap-2 mt-5">
        <button onClick={onDong} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700">Huỷ</button>
        <button onClick={xacNhan} disabled={thieuNote || dangChay}
          className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: COLOR.teal }}>{dangChay ? "Đang ghi…" : "Xác nhận"}</button>
      </div>
    </Khung>);
}

/* ═══ TỔNG QUAN — thẻ CẢM BIẾN ĐỨNG HÌNH (chính sách 13/07: tách riêng) ═══
   Phòng có cảm biến đứng hình = tương đương THIẾU DỮ LIỆU: không chấm mức,
   không mở sự cố, không vào báo cáo chung. Thẻ này là lối vào nhanh từ Tổng
   quan; chi tiết + nút làm mới nằm ở tab Cảm biến. Ẩn khi không có cái nào. */
// Bảng CHÊNH ÁP THEO AHU (tab Sự cố gần đây) — yêu cầu (dải giới hạn) + kết quả (TB
// 5′ cuối của bucket giờ mới nhất), gom theo AHU. Không đạt: Mức 1/2 (P1/P2) = ĐỎ ·
// Mức 3 (P3) = VÀNG. Đạt = xanh. Thiếu dữ liệu = xám. Có bộ lọc khu/AHU riêng.
function ChenhApTheoAhu({ isLive, khuChoPhep = null, active = true }) {
  const [rows, setRows] = React.useState(null);   // null = đang tải
  const [khu, setKhu] = React.useState("ALL");
  const [ahuLoc, setAhuLoc] = React.useState("ALL");
  const [dangTuoi, setDangTuoi] = React.useState(false);   // đang gọi FMS lấy realtime
  const [dhMap, setDhMap] = React.useState({});            // ma_phong → số giờ đứng hình (cảm biến DP)
  const [napLuc, setNapLuc] = React.useState(Date.now());  // mốc client nhận lô số hiện hành
  const [dongHo, setDongHo] = React.useState(Date.now());  // nhịp 10s để nhãn tuổi TỰ ĐẾM LÊN
  // 03/08: TÁCH ĐÔI NHỊP. Trước đây một hàm `nap()` vừa đọc số vừa gọi Edge (~6s)
  // rồi lặp mỗi 60s ⇒ màn hình chỉ đổi mỗi 60s dù số trong bảng đã mới. Nay:
  //   • docSo (RPC ~100ms) — nhịp nhanh + mỗi khi realtime gõ cửa
  //   • kichEdge (gọi FMS ~6s) — nhịp CHẬM, chỉ còn là lưới đỡ vì cron
  //     `bms-phut-8h` đã kéo FMS mỗi phút phía máy chủ (migration 20260803a).
  const docSo = React.useCallback(async () => {
    const [kq, dh] = await Promise.all([layChenhApTheoAhu(), layCamBienDungHinh()]);
    if (!kq.error) { setRows(kq.rows); setNapLuc(Date.now()); }
    if (dh && !dh.error && dh.rows) setDhMap(Object.fromEntries(dh.rows.filter((x) => x.loai_cam_bien === "DP").map((x) => [x.ma_phong, x.so_gio_dung])));
  }, []);
  const kichEdge = React.useCallback(async () => {
    setDangTuoi(true);
    const up = await capNhatPhut8h();
    setDangTuoi(false);
    if (up && up.ok) { const kq = await layChenhApTheoAhu(); if (!kq.error) { setRows(kq.rows); setNapLuc(Date.now()); } }
  }, []);
  const nap = React.useCallback(async () => { await docSo(); await kichEdge(); }, [docSo, kichEdge]);
  React.useEffect(() => {
    if (!isLive || !active) return;   // CHỈ gọi FMS/đọc khi tab Chênh áp đang mở — không tải nền làm chậm tab khác
    nap();
    // Đọc số: 20s/lần. Rẻ (RPC ~100ms), KHÔNG đụng FMS. Đây là lưới đỡ cho realtime.
    const tDoc = setInterval(docSo, 20000);
    // Gọi FMS: 180s/lần. Cron `bms-phut-8h` đã kéo mỗi phút; nhịp này chỉ để phòng
    // khi cron tắt / ngoài khung giờ (cau_hinh.edge_capnhat_phut_gio_dau|_cuoi).
    const tEdge = setInterval(kichEdge, 180000);
    // Realtime: bảng du_lieu_phut_8h đổi → đọc lại sau 1.2s (gom burst: đo lượt cron
    // thật ngày 03/08 = 112 điểm / 56 phòng; không gom thì nạp lại hơn trăm lần).
    let hen = null;
    const huyRt = dangKyRealtimeChenhAp(() => {
      if (hen) clearTimeout(hen);
      hen = setTimeout(() => { hen = null; docSo(); }, 1200);
    });
    return () => { clearInterval(tDoc); clearInterval(tEdge); if (hen) clearTimeout(hen); huyRt(); };
  }, [isLive, active, nap, docSo, kichEdge]);
  // Nhịp riêng 10s: KHÔNG gọi mạng, chỉ để nhãn tuổi dữ liệu đếm lên giữa 2 lần nạp.
  React.useEffect(() => {
    if (!isLive || !active) return;
    const t = setInterval(() => setDongHo(Date.now()), 10000);
    return () => clearInterval(t);
  }, [isLive, active]);
  if (!isLive) return <Card className="p-8 text-center text-[13px] text-slate-500">Cần kết nối dữ liệu thật (LIVE) để xem chênh áp theo AHU.</Card>;
  const dsKhu = khuChoPhep || DS_KHU;
  const ahuPairs = [...new Set((rows || []).filter((r) => (khu === "ALL" || r.khuVuc === khu)).map((r) => `${r.khuVuc}|${r.ahu}`))].sort();
  const chip = (v, label, on, click) => <button key={v} onClick={click} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${on ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`} style={on ? { backgroundColor: COLOR.teal } : {}}>{label}</button>;
  const filt = (rows || []).filter((r) => (khu === "ALL" || r.khuVuc === khu) && (ahuLoc === "ALL" || r.ahu === ahuLoc));
  const groups = {};
  filt.forEach((r) => { const k = `${r.khuVuc} / ${r.ahu}`; (groups[k] ??= []).push(r); });
  // Màu theo NGUYÊN TẮC CẢNH BÁO (16/07): ĐỎ = vi phạm theo hướng (DP=DUOI → dưới sàn,
  // cần chỉnh) · VÀNG = ngoài khoảng nhưng KHÔNG thuộc hướng (vd vượt trần — chú ý,
  // không phải sự cố) · XANH = trong dải · XÁM = không dữ liệu. `dat` do server chấm
  // theo canh_bao_huong nên đổi hướng trong Cài đặt là màu tự đổi theo.
  const ngoaiKhoang = (r) => r.coDuLieu !== false && r.giaTri != null
    && ((r.ghDuoi != null && r.giaTri < r.ghDuoi) || (r.ghTren != null && r.giaTri > r.ghTren));
  // 16/07 (user): P3 không mở vé → P3 không đạt hiển thị DỊU (đỏ nhạt + nhãn
  // "chưa cần xử lý ngay"), tách khỏi số "cần chỉnh" của P1/P2.
  // 16/07 (user): cảm biến ĐỨNG HÌNH → số đang xem là số CHẾT — nhãn cảnh báo riêng,
  // không tô đỏ/xanh (đỏ giả hoặc đạt giả), không tính vào "cần chỉnh".
  const laDungHinh = (r) => dhMap[r.maPhong] != null;
  const canGap = (r) => r.dat === false && r.uuTien !== "P3" && !laDungHinh(r);
  const p3KhongDat = (r) => r.dat === false && r.uuTien === "P3" && !laDungHinh(r);
  const soKhongDat = filt.filter(canGap).length;
  const soP3 = filt.filter(p3KhongDat).length;
  const soDh = filt.filter(laDungHinh).length;
  const soNgoaiKhoang = filt.filter((r) => r.dat !== false && ngoaiKhoang(r) && !laDungHinh(r)).length;
  const oCls = (r) => r.coDuLieu === false ? "bg-slate-100 ring-slate-300"
    : laDungHinh(r) ? "bg-slate-100 ring-2 ring-amber-400"
    : canGap(r) ? "bg-rose-100 ring-2 ring-rose-600"
    : p3KhongDat(r) ? "bg-rose-50/40 ring-1 ring-slate-200"
    : ngoaiKhoang(r) ? "bg-amber-100 ring-2 ring-amber-600"
    : "bg-emerald-50 ring-1 ring-emerald-500";
  const vCls = (r) => r.coDuLieu === false ? "text-slate-500"
    : laDungHinh(r) ? "text-slate-400 line-through"
    : canGap(r) ? "text-rose-900"
    : p3KhongDat(r) ? "text-slate-500"
    : ngoaiKhoang(r) ? "text-amber-800" : "text-emerald-800";
  // 03/08 (user: "cơ điện đọc trên app để sửa rất khó vì chậm vài phút"): hiện TUỔI
  // dữ liệu, không bắt người đứng máy tự nhẩm "10:32 là mấy phút trước". `tuoi_phut`
  // do server tính LÚC TRUY VẤN nên phải CỘNG thời gian trôi từ lúc nạp — nếu chỉ in
  // số của server thì nhãn đứng yên trong khi màn hình mỗi lúc một cũ (đúng loại lỗi
  // "hệ nói sai về chính nó" đã mắc với nhãn TB-5-phút).
  const nhanTuoi = (r) => {
    if (r.tuoiPhut == null) return null;
    const p = r.tuoiPhut + Math.floor(Math.max(0, dongHo - napLuc) / 60000);
    const mau = p >= 6 ? "text-rose-600" : p >= 3 ? "text-amber-600" : "text-slate-400";
    return <span className={`font-semibold ${mau}`}> · {p <= 0 ? "vừa xong" : `${p}′ trước`}</span>;
  };
  const ordUu = (p) => p === "P1" ? 1 : p === "P2" ? 2 : p === "P3" ? 3 : 4;
  return (
    <Card className="p-5">
      <SectionTitle icon={Gauge} hint="5 phút gần nhất từ FMS · ĐỎ = dưới sàn cần chỉnh (P1/P2) · VIỀN VÀNG XÁM = cảm biến đứng hình · XÁM PHỚT HỒNG = P3 chưa gấp · VÀNG = trên dải · XANH = đạt">Chênh áp theo AHU{filt.length > 0 && <> — <b className="text-rose-600">{soKhongDat}</b> cần chỉnh{soDh > 0 && <> · <b className="text-amber-600">{soDh}</b> đứng hình</>}{soP3 > 0 && <> · <b className="text-slate-400">{soP3}</b> P3 chưa gấp</>}{soNgoaiKhoang > 0 && <> · <b className="text-amber-600">{soNgoaiKhoang}</b> trên dải</>} /{filt.length} phòng</>}{dangTuoi && <span className="text-[10px] font-normal text-teal-600"> · đang lấy realtime…</span>}</SectionTitle>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Lọc khu</span>
        {chip("ALL", "Tất cả", khu === "ALL", () => { setKhu("ALL"); setAhuLoc("ALL"); })}
        {dsKhu.map((k) => chip(k, `Khu ${k}`, khu === k, () => { setKhu(k); setAhuLoc("ALL"); }))}
        {ahuPairs.length > 0 && (
          <select value={ahuLoc === "ALL" ? "ALL" : `${khu}|${ahuLoc}`} onChange={(e) => { const v = e.target.value; if (v === "ALL") setAhuLoc("ALL"); else { const [k, a] = v.split("|"); setKhu(k); setAhuLoc(a); } }} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] text-slate-700 outline-none ml-1">
            <option value="ALL">AHU: tất cả</option>
            {ahuPairs.map((p) => { const [k, a] = p.split("|"); return <option key={p} value={p}>{khu === "ALL" ? `Khu ${k} · ${a}` : a}</option>; })}
          </select>
        )}
      </div>
      {rows === null ? <div className="mt-3 h-24 rounded-2xl bg-slate-50 animate-pulse" />
        : filt.length === 0 ? <p className="mt-3 text-[13px] text-slate-400">Không có phòng chênh áp trong phạm vi lọc.</p>
        : <div className="mt-3 space-y-4">
          {/* ĐỎ lên đầu (16/07): trong nhóm xếp đỏ → vàng → xanh → xám; nhóm AHU có
              phòng đỏ cũng nổi lên trước các nhóm toàn xanh. */}
          {Object.keys(groups).sort((a, b) => {
            const rank = (r) => r.coDuLieu === false ? 5 : canGap(r) ? 0 : laDungHinh(r) ? 1 : p3KhongDat(r) ? 2 : ngoaiKhoang(r) ? 3 : 4;
            const ma = Math.min(...groups[a].map(rank)), mb = Math.min(...groups[b].map(rank));
            return ma - mb || a.localeCompare(b);
          }).map((k) => {
            const rank = (r) => r.coDuLieu === false ? 5 : canGap(r) ? 0 : laDungHinh(r) ? 1 : p3KhongDat(r) ? 2 : ngoaiKhoang(r) ? 3 : 4;
            const ds = groups[k].slice().sort((a, b) => rank(a) - rank(b) || ordUu(a.uuTien) - ordUu(b.uuTien) || String(a.maPhong).localeCompare(String(b.maPhong)));
            const soDat = ds.filter((r) => r.dat).length;
            return (
              <div key={k}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{k}</span>
                  <span className="text-[11px] text-slate-400 tabular-nums">{soDat}/{ds.length} đạt</span>
                </div>
                <div className="space-y-1.5">
                  {ds.map((r) => (
                    <div key={r.maPhong} className={`rounded-xl px-3.5 py-2.5 flex items-center gap-x-5 gap-y-2 flex-wrap ${oCls(r)}`}>
                      <div className="w-[168px] shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-semibold text-slate-800">{r.maPhong}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 text-slate-500">{r.uuTien}</span>
                        </div>
                        <div className="text-[10.5px] text-slate-400 truncate" title={r.tenPhong}>{r.tenPhong}</div>
                        {laDungHinh(r) && (
                          <div className="mt-1 inline-block rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-amber-800 ring-1 ring-amber-300">
                            ⚠ Cảm biến đứng hình {dhMap[r.maPhong]} giờ — vui lòng kiểm tra lại trước khi chỉnh
                          </div>
                        )}
                      </div>
                      <div className="w-[96px] shrink-0 rounded-lg bg-white/80 px-2 py-1 text-center ring-1 ring-slate-200/60">
                        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Yêu cầu ({r.donVi})</div>
                        <div className="text-[15px] font-bold text-slate-800 tabular-nums leading-tight">{r.ghDuoi}–{r.ghTren}</div>
                      </div>
                      {/* 16/07 (user): chuỗi 5′ kẻ BẢNG 2 hàng — giờ trên, chênh áp dưới — dễ dò cột hơn dãy chữ liền */}
                      {r.chuoi && r.chuoi.length > 0 && (
                        <div className="grow flex justify-center"><div className="rounded-lg overflow-hidden ring-1 ring-slate-200 bg-white shrink-0">
                        <table className="border-collapse shrink-0">
                          <tbody>
                            <tr>
                              {r.chuoi.map((p) => (
                                <td key={`t${p.t}`} className="border border-slate-200 bg-slate-50 px-2 py-0.5 text-center text-[10.5px] text-slate-600 tabular-nums">{p.t}</td>
                              ))}
                            </tr>
                            <tr>
                              {r.chuoi.map((p, i) => {
                                const cuoi = i === r.chuoi.length - 1;
                                const duoiSan = Number(p.v) < r.ghDuoi; const trenTran = Number(p.v) > r.ghTren;
                                return (
                                  <td key={`v${p.t}`} className={`border border-slate-200 px-2 py-0.5 text-center text-[12.5px] tabular-nums ${cuoi ? `font-bold ${vCls(r)} bg-white` : duoiSan ? "text-rose-600 font-semibold bg-rose-50/50" : trenTran ? "text-amber-600 font-semibold bg-amber-50/50" : "text-slate-700 bg-white"}`}>{p.v}</td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                        </div></div>
                      )}
                      <div className="ml-auto w-[132px] text-right shrink-0">
                        <div className={`text-[17px] font-bold tabular-nums leading-none ${vCls(r)}`}>{r.coDuLieu === false ? "—" : <>{r.giaTri}<span className="text-[10px] font-medium"> {r.donVi}</span></>}</div>
                        <div className="text-[9.5px] text-slate-400 mt-0.5">{r.coDuLieu === false ? "thiếu dữ liệu" : <>{r.realtime ? <span className="text-teal-600 font-semibold">● realtime</span> : <span className="text-amber-600">giờ gần nhất</span>} {r.thoiDiem}{nhanTuoi(r)}{r.dat === false && (r.uuTien === "P3"
                          ? <span className="font-medium text-slate-400"> · P3 — chưa cần xử lý ngay</span>
                          : <span className={`font-semibold ${vCls(r)}`}> · KHÔNG ĐẠT</span>)}</>}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>}
    </Card>
  );
}

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
  const editRoom = async (id, patch) => {
    if (isLive) { const M = { name: "ten_phong", area: "khu_vuc", ahu: "ahu", priority: "muc_uu_tien", note: "ghi_chu", noData: "thieu_du_lieu" }; const p_patch = {}; Object.keys(patch).forEach((k) => { if (M[k]) p_patch[M[k]] = patch[k]; }); const { error } = await suaPhong({ p_ma_phong: id, p_patch, p_actor: user?.email || null }); if (baoLoi(error, "Không sửa được phòng")) await apMoi(); return; }
    setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); if (patch.priority) logConfig(`Đổi mức ưu tiên phòng ${id} → ${MUC[patch.priority]}`);
  };
  const deleteRoom = async (id) => {
    if (isLive) { const { error } = await xoaPhong({ p_ma_phong: id, p_actor: user?.email || null }); if (baoLoi(error, "Không xóa được phòng")) await apMoi(); return; }
    setRooms((rs) => rs.filter((r) => r.id !== id)); logConfig(`Xóa phòng ${id}`);
  };
  const updateLimit = async (roomId, k, field, value) => {
    if (isLive) { const room = rooms.find((r) => r.id === roomId); const s = (room && room.sensors.find((x) => x.k === k)) || {}; const v = value === "" ? null : Number(value); const duoi = field === "min" ? v : (s.min ?? null); const tren = field === "max" ? v : (s.max ?? null); const { error } = await suaGioiHan({ p_ma_phong: roomId, p_loai_cam_bien: k, p_gioi_han_duoi: duoi, p_gioi_han_tren: tren, p_actor: user?.email || null }); if (baoLoi(error, "Không sửa được giới hạn")) await apMoi(); return; }
    setRooms((rs) => rs.map((r) => r.id === roomId ? { ...r, sensors: r.sensors.map((s) => s.k === k ? { ...s, [field]: value === "" ? null : Number(value) } : s) } : r)); logConfig(`Sửa giới hạn ${k}.${field} phòng ${roomId} = ${value}`);
  };
  const addSensor = async (roomId, k) => {
    if (isLive) { const d = SENSOR_DEFAULT[k] || {}; const { error } = await themCamBien({ p_ma_phong: roomId, p_loai_cam_bien: k, p_gioi_han_duoi: d.min ?? null, p_gioi_han_tren: d.max ?? null, p_actor: user?.email || null }); if (baoLoi(error, "Không thêm được cảm biến")) await apMoi(); return; }
    setRooms((rs) => rs.map((r) => r.id === roomId && !r.sensors.some((s) => s.k === k) ? { ...r, sensors: [...r.sensors, { k, ...SENSOR_DEFAULT[k] }] } : r)); logConfig(`Thêm cảm biến ${k} cho phòng ${roomId}`);
  };
  const removeSensor = async (roomId, k) => {
    if (isLive) { const { error } = await xoaCamBien({ p_ma_phong: roomId, p_loai_cam_bien: k, p_actor: user?.email || null }); if (baoLoi(error, "Không bỏ được cảm biến")) await apMoi(); return; }
    setRooms((rs) => rs.map((r) => r.id === roomId ? { ...r, sensors: r.sensors.filter((s) => s.k !== k) } : r)); logConfig(`Bỏ cảm biến ${k} khỏi phòng ${roomId}`);
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
              <div className="flex items-center justify-between px-1"><SectionTitle icon={Clock} hint="khung giờ chốt gần nhất · cập nhật theo giờ">Tổng quan trạng thái — 1 giờ gần nhất</SectionTitle></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={CheckCircle2} label="Phòng đạt" value={kpis.dat} total={kpis.tong} sub="tuân thủ ≥ 80% (1h)" accent={{ txt: "text-teal-600", bg: "bg-teal-50", glow: "bg-teal-200" }} onClick={() => setKpiModal("dat")} loading={kpiLoading} />
                <KpiCard icon={AlertTriangle} label="Phòng không đạt" value={kpis.khongDat} total={kpis.tong} sub="tuân thủ < 80%" accent={{ txt: "text-rose-600", bg: "bg-rose-50", glow: "bg-rose-200" }} onClick={() => setKpiModal("khong")} loading={kpiLoading} />
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
                  <Card className="p-5" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 60%,#E6F1FA)" }}><div className="flex items-center justify-between"><SectionTitle icon={Sparkles}>Tóm tắt hệ thống</SectionTitle>{live.capNhatLuc && !live.loi && <span className="text-[10px] text-slate-400">Cập nhật {live.capNhatLuc.toLocaleTimeString("vi-VN")}</span>}</div><p className="mt-3 text-[13px] leading-relaxed text-slate-600">{live.kpis ? <>Đang giám sát <b style={{ color: COLOR.navy }}>{kpis.tong}</b> phòng: <span className="text-teal-700 font-semibold">{kpis.dat} đạt</span> · <span className="text-rose-600 font-semibold">{kpis.khongDat} không đạt</span> · <span className="text-amber-600 font-semibold">{kpis.thieuDL} thiếu DL</span>. {p12Open > 0 ? <><b className="text-rose-600">{p12Open}</b> sự cố Nghiêm trọng đang mở — ưu tiên xử lý.</> : "Không có sự cố Nghiêm trọng đang mở."}</> : (live.loi ? "Không tải được dữ liệu — kiểm tra kết nối/đăng nhập." : "Đang tải dữ liệu…")}</p><p className="mt-2 text-[11px] text-slate-400">Phân tích AI chi tiết ở tab Báo cáo · Xu hướng GMP.</p></Card>
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
            return (
            <div className="space-y-5">
              <SectionTitle icon={AlertOctagon} hint={user ? `vai trò: ${ROLE_VI[role]}` : "đăng nhập để thao tác"}>Sự cố đang xử lý</SectionTitle>
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
              <div className="space-y-5"><SectionTitle icon={Building2}>Quản lý phòng & cảm biến</SectionTitle><RoomManager rooms={rooms} cfg={cfg} canManage={canManage} onAdd={addRoom} onEdit={editRoom} onDelete={deleteRoom} onUpdateLimit={updateLimit} onAddSensor={addSensor} onRemoveSensor={removeSensor} /></div>
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
