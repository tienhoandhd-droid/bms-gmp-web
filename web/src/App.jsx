import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_DATA_SOURCE, HAS_SUPABASE } from "./lib/config";
import { useLiveData } from "./hooks/useLiveData";
import { laySuCoPhut, capNhatPhut8h, thaoTacSuCo, dungCanhBao, ACTION_LABEL_TO_CODE, layChuoiXuHuong, layChuoiXuHuongChiTiet, layChuoiXuHuongDaSensor, layChuoiGiaTriPhong, layPhanTichSau, layQuetBatThuong, layDuBaoXuHuong, layMaTranPhongNgay, luuPhanTichAi, layWebhookAi, phanTichAiQuaWorkflow, layWebhookWf7b, guiNhanDinhXuHuong, layWebhookBaoCaoBu, guiBaoCaoBu, themPhong, suaPhong, xoaPhong, suaGioiHan, themCamBien, xoaCamBien, suaNguong, layCanhBaoUuTien, datCanhBaoUuTien, layCanhBaoHuong, datCanhBaoHuong, layCauHinhEmail, datCauHinhEmail, layNguoiNhanBaoCao, luuNguoiNhanBaoCao, xoaNguoiNhanBaoCao, layNguoiNhanCanhBao, luuNguoiNhanCanhBao, xoaNguoiNhanCanhBao, layLuatPhanTuyen, luuLuatPhanTuyen, xoaLuatPhanTuyen, datCongTacPhanTuyen, EMAIL_KEYS_HE_THONG, EMAIL_KEYS_BAO_CAO } from "./lib/supabaseData";
import { dangNhapMatKhau, dangXuat as authDangXuat, layPhienHienTai, theoDoiPhien, doiMatKhau } from "./lib/auth";
import { COLOR, SENSOR_COLOR, SENSOR_META_BASE, COMPLY_OK, COMPLY_BAD, fmtPct } from "./lib/designTokens";
import AuthGate from "./AuthGate";
import {
  Droplets, Thermometer, Sparkles, ShieldCheck, ShieldAlert, Activity,
  AlertTriangle, CheckCircle2, HelpCircle, Clock, ChevronRight, X, FileText,
  TrendingDown, TrendingUp, Gauge, CircleDot, Check, ChevronDown, Bell, BellOff, Mail, Cpu,
  Wind, FileBarChart, LayoutDashboard, AlertOctagon, Building2, LineChart as LineIcon,
  ScrollText, Settings as Cog, Wifi, Printer, Plus, Trash2, Search, LogIn, LogOut,
  User, Eye, SlidersHorizontal, History, Pencil, KeyRound, Layers, Minus, Save, GitBranch, Power,
  Radio, RefreshCw
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
const LEVELS = [
  { key: "normal", label: "Kiểm soát tốt", txt: "text-teal-700", bg: "bg-teal-50", ring: "ring-teal-200", dot: "bg-teal-400" },
  { key: "notice", label: "Cần chú ý", txt: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", dot: "bg-sky-400" },
  { key: "warning", label: "Cảnh báo", txt: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", dot: "bg-amber-400" },
  { key: "action", label: "Hành động", txt: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", dot: "bg-rose-500" },
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
const ROLE_VI = { IPC: "IPC Hiện trường", MEP: "Cơ điện", LOT: "Trực HSL", QA: "QA Kiểm soát", ADMIN: "Quản trị (IT)", IT: "IT / Quản trị" };
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
  // 4 mức theo quy tắc: OOS 1h > nguong_canh_bao → CẢNH BÁO; nếu thêm 10′ cuối ≥ nguong_hanh_dong → HÀNH ĐỘNG.
  // 10 ≤ OOS 1h ≤ 20 (nguong_chu_y..nguong_canh_bao) → CẦN CHÚ Ý; < nguong_chu_y → KIỂM SOÁT TỐT.
  let l = stat.oos1h > cfg.warn ? 2 : stat.oos1h >= cfg.notice ? 1 : 0;
  if (l >= 2 && stat.err10 != null && stat.err10 >= cfg.action) l = 3;
  return l;
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
const RANGES = [{ k: "1n", label: "24 giờ", days: 1 }, { k: "7n", label: "7 ngày", days: 7 }, { k: "30n", label: "30 ngày", days: 30 }, { k: "90n", label: "90 ngày", days: 90 }];
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
const firstActionFor = (st, role) => (STATUS_ACTIONS[st] || []).find((a) => role === "ADMIN" || a.roles.includes(role)) || null;
const STATUS_DOT = { "Chưa xử lý": "bg-rose-500", "IPC: bất thường": "bg-violet-500", "Đã báo cơ điện": "bg-amber-500", "Cơ điện đang xử lý": "bg-cyan-500", "Chờ IPC kiểm lại": "bg-teal-500", "Đã khắc phục": "bg-emerald-500" };
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
        <div className="text-right shrink-0">{room.noData ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Mất dữ liệu</span> : comp == null ? <span className="inline-flex items-center gap-1 text-slate-400 text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Chưa có DL</span> : (<><p className={`text-2xl font-light tabular-nums ${failing ? "text-rose-600" : "text-teal-600"}`}>{comp}%</p><p className="text-[10px] text-slate-400">tuân thủ 1h</p></>)}</div>
      </div>

      {lm && <div className={`mt-3 rounded-2xl px-3 py-2 ring-1 ${lm.bg} ${lm.ring} flex items-center justify-between`}><span className="flex items-center gap-2 text-[12px] font-semibold"><span className={`w-2 h-2 rounded-full ${lm.dot}`} /><span className={lm.txt}>Mức cảnh báo: {lm.label}</span></span><span className="text-[10px] text-slate-500">8h</span></div>}

      {!room.noData && (
        <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 overflow-hidden">
          <div className="grid grid-cols-5 px-3 py-1.5 text-[11px] uppercase tracking-wide text-slate-400 font-semibold border-b border-slate-200/70"><span>Chỉ tiêu</span><span className="text-center">Hiện tại</span><span className="text-center">TB 1h</span><span className="text-center">OOS 1h</span><span className="text-center">10′</span></div>
          {room.sensors.map((s) => { const st = sensorStats(room.id, s, room._isLive); const noDL = st.khongCoDL; const lvl = noDL ? -1 : ((s._live && s._live.level != null) ? s._live.level : sensorLevel(st, cfg)); const dotCls = noDL ? "bg-slate-300" : LEVELS[lvl].dot; const lblMuc = noDL ? "Chưa có dữ liệu" : LEVELS[lvl].label; return (
            <div key={s.k} className="grid grid-cols-5 items-center px-3 py-2 text-[12px] border-b border-slate-200/50 last:border-0">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">{s.k}<span title={lblMuc} aria-label={lblMuc} className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] leading-none font-bold text-white ${dotCls}`}>{levelGlyph(lvl)}</span></span>
              {noDL ? <span className="col-span-4 text-center text-[11px] text-slate-400 italic">chưa có dữ liệu</span> : (<>
              <span className="text-center tabular-nums font-semibold" style={{ color: COLOR.navy }}>{st.cur}<span className="text-[11px] text-slate-400">{SENSOR_META[s.k].unit}</span></span>
              <span className="text-center tabular-nums text-slate-500">{st.avg1h}</span>
              <span className={`text-center tabular-nums font-medium ${st.oos1h >= cfg.warn ? "text-amber-600" : st.oos1h >= cfg.notice ? "text-sky-600" : "text-slate-400"}`}>{st.oos1h}/60</span>
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
    p1:    { title: "Sự cố Mức 1 đang mở", desc: "Phòng trọng yếu — xử lý ưu tiên cao nhất", color: COLOR.sky, grad: "#E6F1FA", Icon: Activity },
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
            incidents.length === 0 ? <p className="text-center text-[13px] text-slate-500 py-8">Không có sự cố Mức 1 nào đang mở. 🎉</p> : (
              <div className="space-y-2">
                {incidents.map((i) => (
                  <button key={i.id} onClick={() => onPickIncident(i)} className="w-full text-left rounded-2xl ring-1 ring-rose-200 border-l-[6px] border-rose-600 bg-rose-50/30 hover:ring-rose-300 hover:bg-rose-50/60 px-4 py-3 transition duration-150 flex items-center justify-between gap-3">
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[14px] font-semibold" style={{ color: COLOR.navy }}>{i.id}</span><span className="text-[11px] px-2 py-0.5 rounded-full font-bold text-white bg-rose-600">Mức 1</span></div><p className="text-[12px] text-slate-600 mt-0.5 truncate">{i.room} · {i.sensor || "—"} · {i.status}</p></div>
                    <ChevronRight className="w-4 h-4 text-rose-300 shrink-0" strokeWidth={1.8} />
                  </button>
                ))}
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
  const ahusLoc = [...new Set(rooms.filter((r) => locKhu === "ALL" || r.area === locKhu).map((r) => r.ahu).filter(Boolean))].sort();
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
          {locKhu !== "ALL" && ahusLoc.length > 0 && (
            <select value={locAhu} onChange={(e) => setLocAhu(e.target.value)} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] text-slate-700 outline-none ml-1">
              <option value="ALL">AHU: tất cả</option>
              {ahusLoc.map((a) => <option key={a} value={a}>{a}</option>)}
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
    return (
      <div key={idx} className={`rounded-2xl ring-1 ${m.ring} ${m.bg} p-3.5`}>
        <div className="flex items-center gap-2 mb-1.5"><Icon className="w-4 h-4 shrink-0" style={{ color: m.c }} strokeWidth={1.9} /><h5 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: m.c }}>{title}</h5></div>
        <div className="space-y-1">{lines.map((l, j) => {
          const t = l.trim();
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

function TrendPage({ onAI, isLive = false, liveRisk = null, liveRooms = null, liveIncidents = null, onSaveAI = null }) {
  // Ghi nhớ lựa chọn giữa các lần vào (localStorage) — chỉ lưu tuỳ chọn nhẹ, không lưu dữ liệu.
  const LS_KEY = "bms_trend_prefs";
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } })();
  const [range, setRange] = useState(["1n", "7n", "30n", "90n"].includes(prefs.range) ? prefs.range : "30n");
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
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const u = await layWebhookAi(); if (!huy) setAiWebhook(u || ""); })(); return () => { huy = true; }; }, [isLive]);
  // WF7b: URL gửi email/lưu Drive + điền sẵn người nhận email từ danh sách người nhận báo cáo.
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const [u, ds] = await Promise.all([layWebhookWf7b(), layNguoiNhanBaoCao().catch(() => ({ rows: [] }))]); if (huy) return; setWf7bUrl(u || ""); const emails = ((ds && ds.rows) || []).map((r) => r.email).filter(Boolean); setEmailTo(emails.join(", ")); })(); return () => { huy = true; }; }, [isLive]);
  const RANGE_DAYS = { "1n": 1, "7n": 7, "30n": 30, "90n": 90 };
  // Độ phân giải: 30n/90n → NGÀY; 1n/7n → THEO GIỜ (dữ liệu thu thập 1 giờ/lần, bỏ mốc 30 phút cũ).
  const donVi = (range === "30n" || range === "90n") ? "NGAY" : "GIO";
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
    const totalScope = { type: "TOTAL", id: "ALL", name: "Toàn hệ thống", risk: 0, delta7: null,
      dat1n: totalComp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: totalComp }, daily: [{ compliance: totalComp }] };
    return [totalScope, ...areaScopes, ...ahuScopes, ...roomScopes].map(enrich);
  }, [isLive, liveRooms, liveRisk]);
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

  const runAI = async () => {
    if (aiBusy) return;
    setAiNote(null);
    if (!tech.n) { finishAI("Chưa có đủ dữ liệu trong khoảng đã chọn để phân tích. Hãy mở rộng khoảng thời gian hoặc kiểm tra kết nối FMS/WF1.", 0, "cuc_bo"); return; }

    // Nếu đã cấu hình WF7 → gửi DỮ LIỆU BIỂU ĐỒ THẬT cho OpenAI phân tích.
    if (isLive && aiWebhook) {
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
        scope: { name: activeScope.name, type: activeScope.type, area: activeScope.area, ahu: activeScope.ahu, dat1n: activeScope.dat1n, dat3n: activeScope.dat3n, dat7n: activeScope.dat7n,
          cap_sach: roomRec.cap_phong_sach || roomRec.capPhong || null, uu_tien: roomRec.priority || roomRec.muc_uu_tien || null },
        rangeLabel: RANGES.find((r) => r.k === range).label, isHourly,
        metrics: { mean: tech.mean, std: tech.std, slope: tech.slope, r2: tech.r2, totOos: tech.totOos, dq: tech.dqAvg, vmin: tech.vmin, vmax: tech.vmax, n: tech.n },
        series: view.map((r) => ({ label: r.label, comp: r.comp, oos: r.oos })),
        perSensor: showMulti ? sensorsPresent.map((k) => ({ k, label: SENSOR_META[k]?.label, series: viewMulti.map((r) => ({ label: r.label, comp: r[`comp_${k}`], oos: r[`oos_${k}`] })) })) : [],
        gia_tri_thuc_3: giaTriThuc3,      // giá trị đo thực + GHD/GHT cho cả 3 chỉ tiêu
        phong_cung_ahu: phongCungAhu,     // tình trạng các phòng cùng AHU (suy luận hệ thống)
        su_co_lien_quan: suCoLienQuan,    // sự cố mở/gần đây trong phạm vi (bối cảnh)
        phan_tich_sau: phanTichSau,       // độ phủ DL + OOS tách trên/dưới + lịch sử (kỳ trước, TB 7/30 ngày)
        quet_bat_thuong: quetBatThuong,   // (Tổng quan/Khu vực) xếp hạng khu vực + phòng tốt/xấu + đợt bất thường có mốc thời gian
      };
      const r = await phanTichAiQuaWorkflow(aiWebhook, payload, undefined, (m) => setAiNote(m));
      setAiBusy(false);
      if (r.ok) { setAiNote(null); const loc = buildLocalAnalysis(); finishAI(r.text, r.level != null ? r.level : loc.level, "openai"); return; }
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

  // Chụp TẤT CẢ biểu đồ đang hiển thị ở tab Xu hướng (#trendPrintArea) → mảng ảnh PNG (data URI).
  // Dùng registry window.__bmsEcharts (map DOM→instance) như hàm in A4; fallback canvas.toDataURL.
  const capTrendCharts = () => {
    try {
      const node = document.getElementById("trendPrintArea");
      if (!node) return [];
      const reg = window.__bmsEcharts;
      const instFor = (canvas) => { let el = canvas.parentElement; while (el) { if (reg && reg.has(el)) return reg.get(el); el = el.parentElement; } return null; };
      return Array.from(node.querySelectorAll("canvas")).map((c) => {
        try { const inst = instFor(c); return inst ? inst.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff", excludeComponents: ["toolbox", "dataZoom"] }) : c.toDataURL("image/png"); }
        catch { try { return c.toDataURL("image/png"); } catch { return null; } }
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

  const Chip = ({ active, onClick, children }) => <button onClick={onClick} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${active ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`} style={active ? { backgroundColor: COLOR.teal } : {}}>{children}</button>;
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
        {/* Lọc nhanh + chọn khoảng thời gian (có nút Áp dụng) — #2 */}
        <div className="mt-3 rounded-2xl bg-sky-50/50 ring-1 ring-sky-100 px-3 py-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Lọc nhanh</span>
            {(isHourly
              ? [["6 giờ qua", 6], ["12 giờ qua", 12], ["24 giờ qua", 24]]
              : [["7 ngày qua", 7 * 24], ["14 ngày qua", 14 * 24], ["30 ngày qua", 30 * 24]]
            ).map(([lab, hrs]) => <Chip key={lab} active={false} onClick={() => { if (!maxTs) return; const f = maxTs - hrs * 3600000; const fs = toLocalInput(f), ts2 = toLocalInput(maxTs); setDtFrom(fs); setDtTo(ts2); setDtFromDraft(fs); setDtToDraft(ts2); }}>{lab}</Chip>)}
            <Chip active={!dtFrom && !dtTo} onClick={() => { setDtFrom(""); setDtTo(""); setDtFromDraft(""); setDtToDraft(""); }}>Toàn khoảng</Chip>
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Từ → đến</span>
            <input type="datetime-local" value={dtFromDraft} min={minTs ? toLocalInput(minTs) : undefined} max={maxTs ? toLocalInput(maxTs) : undefined} onChange={(e) => setDtFromDraft(e.target.value)} className={sel} />
            <span className="text-[12px] text-slate-500">đến</span>
            <input type="datetime-local" value={dtToDraft} min={minTs ? toLocalInput(minTs) : undefined} max={maxTs ? toLocalInput(maxTs) : undefined} onChange={(e) => setDtToDraft(e.target.value)} className={sel} />
            <button onClick={() => { setDtFrom(dtFromDraft); setDtTo(dtToDraft); }} className="text-[12px] font-medium text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: COLOR.teal }}><Search className="w-3.5 h-3.5" strokeWidth={1.8} /> Áp dụng</button>
            {(dtFrom || dtTo || dtFromDraft || dtToDraft) && <button onClick={() => { setDtFrom(""); setDtTo(""); setDtFromDraft(""); setDtToDraft(""); }} className="text-[11px] text-slate-500 underline">Đặt lại</button>}
            <span className="text-[11px] text-slate-400 ml-1">Đang xem {view.length}/{full.length} điểm ({resLbl})</span>
          </div>
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
          <button onClick={runAI} disabled={aiBusy} className={`text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5 ${aiBusy ? "opacity-60 cursor-wait" : ""}`} style={{ backgroundColor: COLOR.teal }}><Sparkles className={`w-3.5 h-3.5 ${aiBusy ? "animate-pulse" : ""}`} strokeWidth={1.8} /> {aiBusy ? "AI đang đọc…" : "AI gợi ý đọc biểu đồ"}</button>
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
  const tip = [
    sk.bucketMoiNhat ? `Bản ghi mới nhất: ${new Date(sk.bucketMoiNhat).toLocaleString("vi-VN")}` : "Chưa có bản ghi dữ liệu",
    `Trễ: ${treTxt} (ngưỡng ${sk.nguongGio ?? 2}h)`,
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
const DB_MOI_MAC_DINH = () => ({ email: "", ho_ten: "", vai_tro: "IPC", khu_vuc: [...DS_KHU], kich_hoat: true });
function CauHinhNguoiNhan({ isLive, canManage, actor }) {
  const [emailCfg, setEmailCfg] = useState({});
  const [nguoiNhan, setNguoiNhan] = useState([]);
  const [danhBa, setDanhBa] = useState([]);    // danh bạ cảnh báo vai trò × khu
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
    const [e, n, d] = await Promise.all([layCauHinhEmail(), layNguoiNhanBaoCao(), layNguoiNhanCanhBao()]);
    if (e.cfg) { setEmailCfg(e.cfg); goc.current = { ...e.cfg }; }
    setNguoiNhan(n.rows || []);
    setDanhBa(d.rows || []);
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
          <div className="overflow-x-auto mt-4"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Email", "Họ tên", "Vai trò", "C1", "C4", "Q2", "Hoạt động", ""].map((h, i) => <th key={i} className="py-2.5 pr-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {danhBa.length === 0 && !canManage && <tr><td colSpan={8} className="py-4 text-slate-400 italic">Chưa có địa chỉ nào trong danh bạ.</td></tr>}
              {danhBa.map((n) => (
                <tr key={n.id} className={`border-t border-slate-100 ${n.kich_hoat ? "" : "opacity-50"}`}>
                  <td className="py-2 pr-4"><input type="email" value={n.email || ""} disabled={!canManage} onChange={(e) => suaDB(n.id, "email", e.target.value)} onBlur={() => blurDB(n, "email")} className="w-full min-w-[190px] rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] font-mono disabled:bg-slate-50 disabled:ring-0" /></td>
                  <td className="py-2 pr-4"><input value={n.ho_ten || ""} disabled={!canManage} placeholder="—" onChange={(e) => suaDB(n.id, "ho_ten", e.target.value)} onBlur={() => blurDB(n, "ho_ten")} className="w-full min-w-[110px] rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-sm disabled:bg-slate-50 disabled:ring-0" /></td>
                  <td className="py-2 pr-4"><select value={n.vai_tro} disabled={!canManage} onChange={(e) => luuDB({ ...n, vai_tro: e.target.value })} className="rounded-xl bg-white ring-1 ring-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50">{DS_VAI_TRO_CB.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  {DS_KHU.map((k) => <td key={k} className="py-2 pr-4"><button disabled={!canManage} onClick={() => toggleKhuDB(n, k)} className={`w-6 h-6 rounded-lg flex items-center justify-center ${(n.khu_vuc || []).includes(k) ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-300"} disabled:opacity-60`}>{(n.khu_vuc || []).includes(k) ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                  <td className="py-2 pr-4"><button disabled={!canManage} onClick={() => luuDB({ ...n, kich_hoat: !n.kich_hoat })} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${n.kich_hoat ? "bg-teal-100 text-teal-700" : "bg-slate-200 text-slate-500"} disabled:opacity-60`}>{n.kich_hoat ? "Bật" : "Tắt"}</button></td>
                  <td className="py-2 pr-4">{canManage && <button onClick={() => xoaDB(n.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" strokeWidth={1.8} /></button>}</td>
                </tr>))}
              {canManage && (  /* hàng THÊM MỚI cuối bảng */
                <tr className="border-t border-slate-200 bg-sky-50/50">
                  <td className="py-2.5 pr-4"><input type="email" value={dbMoi.email} placeholder="email@cpc1hn.vn" onChange={(e) => setDbMoi({ ...dbMoi, email: e.target.value })} onKeyDown={(e) => e.key === "Enter" && themDB()} className="w-full min-w-[190px] rounded-xl bg-white ring-1 ring-sky-200 px-3 py-1.5 text-[12px] font-mono" /></td>
                  <td className="py-2.5 pr-4"><input value={dbMoi.ho_ten} placeholder="Họ tên (tuỳ chọn)" onChange={(e) => setDbMoi({ ...dbMoi, ho_ten: e.target.value })} className="w-full min-w-[110px] rounded-xl bg-white ring-1 ring-sky-200 px-3 py-1.5 text-sm" /></td>
                  <td className="py-2.5 pr-4"><select value={dbMoi.vai_tro} onChange={(e) => setDbMoi({ ...dbMoi, vai_tro: e.target.value })} className="rounded-xl bg-white ring-1 ring-sky-200 px-2 py-1.5 text-sm">{DS_VAI_TRO_CB.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                  {DS_KHU.map((k) => <td key={k} className="py-2.5 pr-4"><button onClick={() => setDbMoi({ ...dbMoi, khu_vuc: dbMoi.khu_vuc.includes(k) ? dbMoi.khu_vuc.filter((x) => x !== k) : [...dbMoi.khu_vuc, k] })} className={`w-6 h-6 rounded-lg flex items-center justify-center ${dbMoi.khu_vuc.includes(k) ? "bg-teal-100 text-teal-700" : "bg-white ring-1 ring-slate-200 text-slate-300"}`}>{dbMoi.khu_vuc.includes(k) ? <Check className="w-4 h-4" strokeWidth={2.5} /> : ""}</button></td>)}
                  <td className="py-2.5 pr-4 text-[11px] text-slate-400">Kích hoạt</td>
                  <td className="py-2.5 pr-4"><button onClick={themDB} className="text-xs font-medium text-white rounded-xl px-3 py-1.5 flex items-center gap-1" style={{ backgroundColor: COLOR.coral }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm</button></td>
                </tr>)}
            </tbody></table></div>}
        <p className="text-[11px] text-slate-400 mt-3">Sự cố ở khu nào chỉ gửi người có tích khu đó. Khu chưa ai tích → gửi <b>toàn bộ</b> người kích hoạt của vai trò (không bỏ sót). Bỏ tích cả 3 khu khi lưu = hệ thống tự đặt lại đủ 3 khu. IPC nhận trước; chưa xử lý leo thang Cơ điện → Trực HSL.</p>
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

/* ===== SỰ CỐ GẦN ĐÂY — bản đồ phút cửa sổ 8h (chỉ phòng có sự cố) ===== */
const RECENT_RANGES = [{ k: 1, label: "1 giờ" }, { k: 4, label: "4 giờ" }, { k: 8, label: "8 giờ" }];
function SuCoGanDayPage({ isLive }) {
  const [gio, setGio] = useState(8);            // khoảng xem: 1 / 4 / 8h (mặc định 8)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capNhatLuc, setCapNhatLuc] = useState(null);
  const [loi, setLoi] = useState(null);
  const [locKhu, setLocKhu] = useState("ALL");
  const gioRef = useRef(gio); gioRef.current = gio;

  const taiLai = useCallback(async (kichFms) => {
    if (!isLive) { setLoading(false); return; }
    // Kích Edge Function nạp điểm phút mới (fail-mềm nếu chưa deploy) rồi đọc bảng
    if (kichFms) { try { await capNhatPhut8h(); } catch { /* Edge chưa sẵn — vẫn đọc bảng */ } }
    const { error, rows: r } = await laySuCoPhut(gioRef.current);
    if (error) setLoi(error); else { setLoi(null); setRows(r); setCapNhatLuc(new Date()); }
    setLoading(false);
  }, [isLive]);

  useEffect(() => { setLoading(true); taiLai(true); }, [taiLai]);
  useEffect(() => { taiLai(false); }, [gio, taiLai]);      // đổi khoảng → đọc lại (không cần kích FMS)
  useEffect(() => {                                         // tự làm mới mỗi 60s
    if (!isLive) return;
    const id = setInterval(() => taiLai(true), 60000);
    return () => clearInterval(id);
  }, [isLive, taiLai]);

  // gom theo phòng: { ma_phong, ten_phong, khu_vuc, ahu, sensors:[row], oosMax }
  const phongList = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      let p = m.get(r.ma_phong);
      if (!p) { p = { ma_phong: r.ma_phong, ten_phong: r.ten_phong, khu_vuc: r.khu_vuc, ahu: r.ahu, muc_uu_tien: r.muc_uu_tien, sensors: [] }; m.set(r.ma_phong, p); }
      p.sensors.push(r);
    }
    const uuTienHang = (p) => ({ P1: 1, P2: 2, P3: 3 }[p] || 9);   // P1 lên đầu
    const arr = [...m.values()].map((p) => ({ ...p, oosMax: Math.max(0, ...p.sensors.map((s) => s.so_oos || 0)), oosTong: p.sensors.reduce((a, s) => a + (s.so_oos || 0), 0) }));
    // Sắp xếp: mức ưu tiên phòng (P1→P2→P3) trước, rồi số điểm ngoài ngưỡng nhiều hơn lên trên
    arr.sort((a, b) => uuTienHang(a.muc_uu_tien) - uuTienHang(b.muc_uu_tien) || b.oosTong - a.oosTong || a.ma_phong.localeCompare(b.ma_phong));
    return arr;
  }, [rows]);

  const khus = useMemo(() => [...new Set(phongList.map((p) => p.khu_vuc).filter(Boolean))].sort(), [phongList]);
  const phongHienThi = phongList.filter((p) => locKhu === "ALL" || p.khu_vuc === locKhu);

  // 1 sensor phút → series cho RoomBandChart: {label, avg, lo, hi}
  const seriesTu = (r) => (r.chuoi || []).map((pt) => ({
    label: new Date(pt.t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    avg: pt.v, lo: r.gioi_han_duoi, hi: r.gioi_han_tren,
  }));

  if (!isLive) return <Card className="p-8 text-center text-[13px] text-slate-500">Cần kết nối dữ liệu thật (LIVE) để xem bản đồ sự cố theo phút.</Card>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon={Radio} hint="dữ liệu theo phút · chỉ phòng đang có sự cố ≤8h · tự làm mới mỗi phút">Sự cố gần đây — bản đồ theo phút</SectionTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl ring-1 ring-slate-200 overflow-hidden text-[12px] font-medium">
            {RECENT_RANGES.map((r) => <button key={r.k} onClick={() => setGio(r.k)} className={`px-3 py-1.5 ${gio === r.k ? "text-white" : "text-slate-500 bg-white hover:bg-slate-50"}`} style={gio === r.k ? { backgroundColor: COLOR.teal } : {}}>{r.label}</button>)}
          </div>
          <button onClick={() => { setLoading(true); taiLai(true); }} className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600 rounded-xl px-3 py-1.5 ring-1 ring-slate-200 bg-white hover:bg-slate-50"><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={1.8} /> Làm mới</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Lọc khu</span>
        <button onClick={() => setLocKhu("ALL")} className={`px-3 py-1.5 rounded-full text-[12px] font-medium ring-1 ${locKhu === "ALL" ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200"}`} style={locKhu === "ALL" ? { backgroundColor: COLOR.teal } : {}}>Tất cả</button>
        {khus.map((k) => <button key={k} onClick={() => setLocKhu(k)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium ring-1 ${locKhu === k ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200"}`} style={locKhu === k ? { backgroundColor: COLOR.teal } : {}}>Khu {k}</button>)}
        <span className="text-[11px] text-slate-400 ml-auto tabular-nums flex items-center gap-2">
          {capNhatLuc && <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" /> Cập nhật {capNhatLuc.toLocaleTimeString("vi-VN")}</span>}
          · {phongHienThi.length} phòng
        </span>
      </div>

      {loi ? <Card className="p-6 text-center text-[13px] text-rose-600">Không tải được dữ liệu phút: {loi.thong_bao || loi.message || "lỗi kết nối"}.</Card>
        : loading && !rows.length ? <Card className="p-8 text-center text-[13px] text-slate-500">Đang tải dữ liệu theo phút…</Card>
        : phongHienThi.length === 0 ? (
          <Card className="px-5 py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#E6F4F1" }}><CheckCircle2 className="w-6 h-6" style={{ color: COLOR.teal }} strokeWidth={1.8} /></div>
            <p className="mt-3 text-[14px] font-semibold" style={{ color: COLOR.navy }}>Không có phòng nào đang có sự cố trong 8 giờ qua</p>
            <p className="mt-1.5 text-[12px] text-slate-500 max-w-md mx-auto leading-relaxed">Tab này chỉ hiện các phòng phát sinh sự cố gần đây, với dữ liệu đo <b>từng phút</b> (làm mới mỗi 60 giây). Khi có sự cố, biểu đồ chi tiết sẽ xuất hiện ở đây.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {phongHienThi.map((p) => (
              <Card key={p.ma_phong} className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><h3 className="text-[14px] font-semibold truncate" style={{ color: COLOR.navy }}>{p.ma_phong}<span className="text-slate-400 font-normal"> · {p.ten_phong}</span></h3>{p.muc_uu_tien && <MucBadge p={p.muc_uu_tien} />}</div>
                    <p className="text-[11px] text-slate-500">Khu {p.khu_vuc} · {p.ahu}</p>
                  </div>
                  {p.oosTong > 0 && <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 ring-1 ring-rose-200 px-2 py-1 rounded-full shrink-0">{p.oosTong} điểm ngoài ngưỡng</span>}
                </div>
                <div className="space-y-4">
                  {p.sensors.map((s) => (
                    <div key={s.loai_cam_bien}>
                      <Chart type="roomBand" sensorKey={s.loai_cam_bien} series={seriesTu(s)} baseline={null} group={"recent-" + p.ma_phong} />
                      <p className="text-[10.5px] text-slate-400 mt-1">{s.so_diem} điểm/phút · {s.so_oos} điểm ngoài ngưỡng · mới nhất {s.gia_tri_cuoi == null ? "—" : (+s.gia_tri_cuoi).toFixed(2)}{SENSOR_META[s.loai_cam_bien]?.unit || ""}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      <p className="text-[11px] text-slate-400 text-center">Dữ liệu phút lấy trực tiếp từ FMS qua Supabase Edge Function (giữ mật khẩu phía máy chủ), lưu cửa sổ trượt 8 giờ và tự xoá điểm cũ hơn. Chọn 1/4/8 giờ để phóng to khoảng xem.</p>
    </div>
  );
}

const TABS = [{ k: "home", label: "Tổng quan", icon: LayoutDashboard }, { k: "events", label: "Sự cố", icon: AlertOctagon }, { k: "recent", label: "Sự cố gần đây", icon: Radio }, { k: "trend", label: "Xu hướng GMP", icon: LineIcon }, { k: "reports", label: "Báo cáo", icon: FileBarChart }, { k: "audit", label: "Nhật ký & SOP", icon: ScrollText }, { k: "recipients", label: "Người nhận", icon: Mail }, { k: "settings", label: "Cài đặt", icon: Cog }];

export default function App() {
  const [tab, setTab] = useState("home");
  const [auditTab, setAuditTab] = useState("audit");   // tab con Nhật ký & SOP: audit | config | sop
  const [cfgTab, setCfgTab] = useState("canhbao");     // tab con Cài đặt: canhbao | phong | phantuyen | hethong
  const [dataSource, setDataSource] = useState(DEFAULT_DATA_SOURCE);   // 'demo' | 'live'
  const LIVE_MAC_DINH = DEFAULT_DATA_SOURCE === "live";   // LIVE → KHÔNG nhồi dữ liệu demo (tránh "thông tin không khớp")
  const [rooms, setRooms] = useState(LIVE_MAC_DINH ? [] : INITIAL_ROOMS);
  const [incidents, setIncidents] = useState(LIVE_MAC_DINH ? [] : INCIDENTS0);
  const [evtKhu, setEvtKhu] = useState("ALL");   // Sự cố: lọc theo khu (ALL/C1/C4/Q2)
  const [evtAhu, setEvtAhu] = useState("ALL");   // Sự cố: lọc theo AHU trong khu đã chọn
  const [cfg, setCfg] = useState({ notice: 10, warn: 20, action: 4 }); // #4 — DEMO; chế độ LIVE đọc từ DB (cau_hinh)
  const [alertUuTien, setAlertUuTien] = useState(["P1", "P2", "P3"]); // cấp độ phòng được cảnh báo (config)
  const [alertHuong, setAlertHuong] = useState({ DP: { su_co: "CA_HAI", canh_bao: "CA_HAI" }, RH: { su_co: "CA_HAI", canh_bao: "CA_HAI" }, T: { su_co: "CA_HAI", canh_bao: "CA_HAI" } }); // hướng cảnh báo
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [roomModal, setRoomModal] = useState(null);
  const [configHistory, setConfigHistory] = useState(LIVE_MAC_DINH ? [] : [{ t: "08:00 29/5", who: "Quản trị (ADMIN)", change: "Khởi tạo cấu hình hệ thống · 6 phòng" }]);
  const [audit, setAudit] = useState(LIVE_MAC_DINH ? [] : [{ t: "13:05 29/5", who: "Hệ thống", act: "Tạo sự cố", obj: "SC-1042 / C4.R7", detail: "Chênh áp nghiêm trọng" }, { t: "10:18 29/5", who: "Nam (IPC)", act: "Xác nhận bất thường", obj: "SC-1038 / C4.R1", detail: "Kiểm tra thực tế" }]);
  const [ai, setAi] = useState(null);
  const [pwOpen, setPwOpen] = useState(false);   // #5 — modal đổi mật khẩu (mọi vai trò)
  const [kpiModal, setKpiModal] = useState(null); // #3 — modal danh sách phòng theo ô KPI ('dat'|'khong'|'thieu'|'p1')
  const [xemTatCaPhong, setXemTatCaPhong] = useState(false);   // Overview: ưu tiên 1&2 (mặc định) ↔ tất cả phòng
  const role = user?.role; const canManage = canManageRooms(role);
  // #5 — danh sách tab hiển thị theo vai trò
  const visibleTabs = useMemo(() => TABS.filter((t) => roleCanSeeTab(role, t.k)), [role]);

  // ===== Dữ liệu LIVE từ Supabase (Tổng quan/Sự cố/Nhật ký) =====
  const live = useLiveData(dataSource);
  const isLive = dataSource === "live";

  // Đồng bộ phiên đăng nhập thật (magic link) khi ở chế độ live
  useEffect(() => {
    if (!isLive || !HAS_SUPABASE) return;
    let off = () => {};
    layPhienHienTai().then((u) => { if (u) setUser(u); });
    off = theoDoiPhien((u) => setUser(u));
    // Phiên hết hạn giữa chừng (RPC trả CHUA_DANG_NHAP dù UI đang hiện đã đăng nhập):
    // báo rõ + đăng xuất → AuthGate tự hiện màn đăng nhập lại. Chặn lặp bằng cờ 1 lần.
    let daBao = false;
    const onHetHan = () => {
      if (daBao) return; daBao = true;
      alert("Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại để tiếp tục thao tác.\n(Dữ liệu giám sát không bị ảnh hưởng.)");
      setUser(null); authDangXuat();
    };
    window.addEventListener("bms:phien-het-han", onHetHan);
    const offHetHan = () => window.removeEventListener("bms:phien-het-han", onHetHan);
    const offCu = off; off = () => { offCu && offCu(); offHetHan(); };
    return () => off();
  }, [isLive]);

  // Khi có dữ liệu sự cố LIVE → thay danh sách demo
  useEffect(() => { if (isLive && live.incidents) setIncidents(live.incidents); }, [isLive, live.incidents]);
  useEffect(() => { if (isLive && live.audit) setAudit(live.audit); }, [isLive, live.audit]);
  useEffect(() => { if (isLive && live.configHistory) setConfigHistory(live.configHistory); }, [isLive, live.configHistory]);
  useEffect(() => { if (isLive && live.rooms) setRooms(live.rooms); }, [isLive, live.rooms]);
  useEffect(() => { if (isLive && live.nguong) setCfg(live.nguong); }, [isLive, live.nguong]);
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const ds = await layCanhBaoUuTien(); if (!huy && Array.isArray(ds) && ds.length) setAlertUuTien(ds); })(); return () => { huy = true; }; }, [isLive]);
  useEffect(() => { if (!isLive) return; let huy = false; (async () => { const h = await layCanhBaoHuong(); if (!huy && h) setAlertHuong(h); })(); return () => { huy = true; }; }, [isLive]);

  // #1 KHẮC PHỤC "phải F5 mới hiện dữ liệu" đã chuyển vào useLiveData:
  // hook tự nạp lại NGAY khi Supabase phát INITIAL_SESSION/SIGNED_IN (phiên sẵn sàng),
  // nên không còn phụ thuộc thời điểm của React ở đây nữa.

  // #5 — nếu vai trò không được phép xem tab đang mở (vd IPC đang ở Cài đặt khi đăng nhập) → đưa về Tổng quan
  useEffect(() => { if (role && !roleCanSeeTab(role, tab)) setTab("home"); }, [role, tab]);
  // Prefetch chunk biểu đồ (ECharts ~243KB) khi trình duyệt rảnh → mở tab Xu hướng tức thì, không khựng.
  useEffect(() => {
    const warm = () => { import("./components/charts").catch(() => {}); };
    if (typeof requestIdleCallback === "function") { const id = requestIdleCallback(warm, { timeout: 3000 }); return () => cancelIdleCallback(id); }
    const tm = setTimeout(warm, 1500); return () => clearTimeout(tm);
  }, []);

  // Giờ máy chủ UTC+7: trước đây dùng toISOString() (UTC) nên lệch -7h so với nhãn "UTC+7".
  // Định dạng theo đúng múi giờ Asia/Ho_Chi_Minh, không phụ thuộc múi giờ trình duyệt.
  const now = isLive ? vnNow() : "2026-05-29 14:08:22";

  const demoKpis = useMemo(() => ({ dat: rooms.filter((r) => { const c = roomCompliance(r); return !r.noData && c >= 80; }).length, khongDat: rooms.filter((r) => { const c = roomCompliance(r); return !r.noData && c < 80; }).length, thieuDL: rooms.filter((r) => r.noData).length, tong: rooms.length }), [rooms]);
  const kpis = isLive ? (live.kpis || { dat: 0, khongDat: 0, thieuDL: 0, tong: 0 }) : demoKpis;
  // Mảng 4: chỉ hiện skeleton KPI khi LIVE và chưa có số thật (tránh nháy "0").
  const kpiLoading = isLive && !live.kpis;
  const systemAlerts = (isLive && live.systemAlerts) ? live.systemAlerts.map((a) => ({ ...a, icon: ICON_CANH_BAO(a) })) : SYSTEM_ALERTS;
  const sopRows = (isLive && live.sopRows && live.sopRows.length) ? live.sopRows : SOP;
  const p1Open = incidents.filter((i) => i.priority === "P1" && i.status !== "Đã khắc phục").length;
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
    rooms.forEach((r) => g[phanLoaiPhong(r)].push(r));
    const sx = (a, b) => (roomCompliance(a) ?? -1) - (roomCompliance(b) ?? -1);
    g.dat.sort((a, b) => (roomCompliance(b) ?? 0) - (roomCompliance(a) ?? 0)); // đạt: cao→thấp
    g.khong.sort(sx); g.thieu.sort((a, b) => (a.id < b.id ? -1 : 1));          // không đạt: thấp→cao
    return g;
  }, [rooms, isLive, FRESH_MIN]); // eslint-disable-line react-hooks/exhaustive-deps
  // Phòng "trọng yếu" gắn với sự cố Mức 1 (P1) đang mở — để link từ ô "Sự cố Mức 1 mở"
  const suCoP1 = incidents.filter((i) => i.priority === "P1" && i.status !== "Đã khắc phục");
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
    () => rooms.filter((r) => r.priority === "P1" || r.priority === "P2").sort(sapTheoNguyCo),
    [rooms, cfg] // eslint-disable-line react-hooks/exhaustive-deps
  );
  // "Tất cả": mọi phòng, cũng xếp theo nguy cơ
  const phongTatCa = useMemo(
    () => [...rooms].sort(sapTheoNguyCo),
    [rooms, cfg] // eslint-disable-line react-hooks/exhaustive-deps
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
  const saveCfg = async (next) => {
    if (isLive) { const { error } = await suaNguong({ p_nguong_chu_y: next.notice, p_nguong_canh_bao: next.warn, p_nguong_hanh_dong: next.action, p_actor: user?.email || null }); if (baoLoi(error, "Không lưu được ngưỡng")) await apMoi(); }
    else logConfig(`Sửa ngưỡng cảnh báo: chú ý ${next.notice} · cảnh báo ${next.warn} · hành động ${next.action}`);
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
  const openApproval = (inc, action) => { if (!requireLogin()) return; const act = action || firstActionFor(inc.status, role); setModal({ inc, action: act }); };
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
  const toggleSilence = async (id) => {
    if (!requireLogin()) return;
    const inc = incidents.find((i) => i.id === id);
    if (isLive && inc?.dbId) {
      if (!inc.silenced) { const { error } = await dungCanhBao({ dbId: inc.dbId, lyDo: "Tắt cảnh báo từ web", actorEmail: user.email }); if (error) { alert(error.thong_bao || error.ma_loi || "Lỗi"); return; } }
      await live.lamMoi({ nen: true }); return;
    }
    setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, silenced: !i.silenced } : i));
  };
  const openRoomIncident = (room) => { const inc = incidents.find((i) => i.room === room.id && i.status !== "Đã khắc phục"); if (inc) openApproval(inc); else setRoomModal(room); };

  // ===== CỔNG ĐĂNG NHẬP: chỉ tài khoản đã đăng nhập mới dùng được web (đã loại bỏ demo) =====
  // Chặn TOÀN TRANG khi đang LIVE và chưa đăng nhập. Không còn lối "xem thử demo".
  const canChanDangNhap = isLive && !user;
  if (canChanDangNhap) {
    return <AuthGate />;
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
              <div className="flex items-center gap-2.5 rounded-2xl bg-white px-4 ring-1 h-[50px]" style={{ ...cardShadow, borderColor: COLOR.teal }} title="Đang đọc/ghi dữ liệu thật từ Supabase">
                <span className={`w-2.5 h-2.5 rounded-full bg-teal-400 ${live.dangTai ? "animate-pulse" : ""}`} />
                <div className="leading-tight text-left"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Nguồn dữ liệu</p><p className="text-xs font-semibold" style={{ color: COLOR.teal }}>LIVE · Supabase</p></div>
              </div>
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

        <nav className="mt-5"><div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-slate-200 p-1.5 flex gap-1 overflow-x-auto" style={cardShadow}>{visibleTabs.map((t) => { const Icon = t.icon; const active = tab === t.k; return <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition ${active ? "text-white" : "text-slate-600 hover:bg-slate-100"}`} style={active ? { background: "linear-gradient(135deg,#1aa899,#149e90)", boxShadow: "0 6px 16px -6px rgba(20,158,144,0.55)" } : {}}><Icon className="w-4 h-4" strokeWidth={1.8} /> {t.label}{t.k === "events" && <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={active ? { background: "rgba(255,255,255,0.25)" } : { background: "rgba(226,103,79,0.16)", color: COLOR.coralDeep }}>{p1Open}</span>}</button>; })}</div></nav>

        <main className="mt-6">
          {isLive && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl bg-teal-50 ring-1 ring-teal-100 px-4 py-2.5 text-[12px] text-slate-600">
              <Wifi className="w-4 h-4 mt-0.5 text-teal-600 shrink-0" strokeWidth={1.8} />
              <span>Đang đọc/ghi dữ liệu thật từ Supabase cho <b>tất cả các tab</b> (Tổng quan · Sự cố · Phòng · Xu hướng · Báo cáo · Nhật ký). <b>Xu hướng &amp; Rủi ro</b> tính trực tiếp từ dữ liệu theo giờ (luôn có sẵn); riêng <b>Báo cáo AI</b> tổng hợp theo ngày sẽ đầy đủ dần khi WF rollup chạy.{live.loi && <span className="text-rose-600"> · Lỗi tải: {live.loi.thong_bao || live.loi.message || "kết nối"}</span>}{live.capNhatLuc && !live.loi && <span className="text-slate-400"> · Cập nhật {live.capNhatLuc.toLocaleTimeString("vi-VN")}</span>}</span>
            </div>
          )}
          {tab === "home" && (
            <div className="space-y-5">
              <Card className="px-7 py-6 overflow-hidden" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 55%,#E6F1FA)" }}><p className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: COLOR.teal }}>Tri thức · Tuân thủ · Toàn vẹn dữ liệu</p><h2 className="mt-1 text-2xl font-semibold" style={{ color: COLOR.navy }}>Giám sát chênh áp · độ ẩm · nhiệt độ theo thời gian thực</h2><div className="mt-4 flex gap-2 flex-wrap text-xs">{[`${kpis.tong} phòng giám sát`, "3 khu: C1 · C4 · Q2", "8 AHU", "Cập nhật mỗi giờ"].map((p) => <span key={p} className="bg-white ring-1 ring-slate-200 text-slate-600 px-3 py-1.5 rounded-full font-medium">{p}</span>)}</div>{!user && <div className="mt-4 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-3 py-1.5 rounded-xl font-medium"><LogIn className="w-3.5 h-3.5" strokeWidth={1.8} /> Đăng nhập để thao tác theo phân quyền.</div>}</Card>
              <div className="flex items-center justify-between px-1"><SectionTitle icon={Clock} hint="cập nhật theo giờ">Tổng quan trạng thái — 1 giờ gần nhất</SectionTitle></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={CheckCircle2} label="Phòng đạt" value={kpis.dat} total={kpis.tong} sub="tuân thủ ≥ 80% (1h)" accent={{ txt: "text-teal-600", bg: "bg-teal-50", glow: "bg-teal-200" }} onClick={() => setKpiModal("dat")} loading={kpiLoading} />
                <KpiCard icon={AlertTriangle} label="Phòng không đạt" value={kpis.khongDat} total={kpis.tong} sub="tuân thủ < 80%" accent={{ txt: "text-rose-600", bg: "bg-rose-50", glow: "bg-rose-200" }} onClick={() => setKpiModal("khong")} loading={kpiLoading} />
                <KpiCard icon={HelpCircle} label="Thiếu dữ liệu" value={kpis.thieuDL} total={kpis.tong} sub="không coi là đạt" accent={{ txt: "text-amber-600", bg: "bg-amber-50", glow: "bg-amber-200" }} onClick={() => setKpiModal("thieu")} loading={kpiLoading} />
                <KpiCard icon={Activity} label="Sự cố Mức 1 mở" value={p1Open} sub="phòng trọng yếu" accent={{ txt: "text-sky-600", bg: "bg-sky-50", glow: "bg-sky-200" }} onClick={() => setKpiModal("p1")} loading={kpiLoading} />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
                <div><div className="flex items-center justify-between mb-3 px-1 flex-wrap gap-2"><SectionTitle icon={CircleDot} hint={xemTatCaPhong ? "tất cả phòng" : "chỉ ưu tiên 1 & 2"}>Phòng trọng điểm cần theo dõi</SectionTitle><div className="flex items-center gap-2"><div className="flex rounded-xl ring-1 ring-slate-200 overflow-hidden text-[11px] font-medium"><button onClick={() => setXemTatCaPhong(false)} className={`px-2.5 py-1 ${!xemTatCaPhong ? "text-white" : "text-slate-500 bg-white hover:bg-slate-50"}`} style={!xemTatCaPhong ? { backgroundColor: COLOR.teal } : {}}>Ưu tiên 1 &amp; 2</button><button onClick={() => setXemTatCaPhong(true)} className={`px-2.5 py-1 ${xemTatCaPhong ? "text-white" : "text-slate-500 bg-white hover:bg-slate-50"}`} style={xemTatCaPhong ? { backgroundColor: COLOR.teal } : {}}>Tất cả</button></div><span className="text-[11px] text-slate-500">{phongHienThi.length}/{rooms.length} phòng</span></div></div>{phongHienThi.length === 0 ? <Card className="p-6 text-center text-[13px] text-slate-500">{xemTatCaPhong ? "Chưa có phòng nào." : "Không có phòng ưu tiên 1 hoặc 2 nào đang hoạt động."}</Card> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{phongHienThi.map((r) => <RoomCard key={r.id} room={r} cfg={cfg} onDetail={setRoomModal} onIncident={openRoomIncident} incident={incidents.find((i) => i.room === r.id && i.status !== "Đã khắc phục") || null} />)}</div>}</div>
                <aside className="space-y-5">
                  {isLive ? (
                  <Card className="p-5" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 60%,#E6F1FA)" }}><div className="flex items-center justify-between"><SectionTitle icon={Sparkles}>Tóm tắt hệ thống</SectionTitle>{live.capNhatLuc && !live.loi && <span className="text-[10px] text-slate-400">Cập nhật {live.capNhatLuc.toLocaleTimeString("vi-VN")}</span>}</div><p className="mt-3 text-[13px] leading-relaxed text-slate-600">{live.kpis ? <>Đang giám sát <b style={{ color: COLOR.navy }}>{kpis.tong}</b> phòng: <span className="text-teal-700 font-semibold">{kpis.dat} đạt</span> · <span className="text-rose-600 font-semibold">{kpis.khongDat} không đạt</span> · <span className="text-amber-600 font-semibold">{kpis.thieuDL} thiếu DL</span>. {p1Open > 0 ? <><b className="text-rose-600">{p1Open}</b> sự cố Mức 1 đang mở — ưu tiên xử lý.</> : "Không có sự cố Mức 1 đang mở."}</> : (live.loi ? "Không tải được dữ liệu — kiểm tra kết nối/đăng nhập." : "Đang tải dữ liệu…")}</p><p className="mt-2 text-[11px] text-slate-400">Phân tích AI chi tiết ở tab Báo cáo · Xu hướng GMP.</p></Card>
                  ) : (
                  <Card className="p-5" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 60%,#E6F1FA)" }}><div className="flex items-center justify-between"><SectionTitle icon={Sparkles}>Phân tích AI</SectionTitle><span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-full"><TrendingDown className="w-3 h-3" strokeWidth={2} /> Δ 7 ngày −6%</span></div><p className="mt-3 text-[13px] leading-relaxed text-slate-600"><span className="font-semibold" style={{ color: COLOR.navy }}>AHU-K01</span> cần kiểm tra ưu tiên — C4.R7, C4.R1 đều kém, nghi lỗi quạt/filter.</p></Card>
                  )}
                  <Card className="p-5"><SectionTitle icon={Bell}>Cảnh báo hệ thống</SectionTitle><div className="space-y-2 mt-3">{systemAlerts.map((a, i) => { const Icon = a.icon || ICON_CANH_BAO(a); return <div key={i} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ${STATUS[a.kind].bg} ring-1 ring-slate-200/60`}><Icon className={`w-4 h-4 mt-0.5 shrink-0 ${STATUS[a.kind].txt}`} strokeWidth={1.8} /><div className="leading-tight"><p className="text-xs text-slate-700 font-medium">{a.text}</p><p className="text-[10px] text-slate-500 mt-0.5">{a.sub}</p></div></div>; })}</div></Card>
                </aside>
              </div>
            </div>
          )}

          {tab === "events" && (() => {
            const metaPhong = {}; (rooms || []).forEach((r) => { metaPhong[r.id] = { area: r.area, ahu: r.ahu }; });
            const incKhu = (i) => (metaPhong[i.room] || {}).area || "";
            const incAhu = (i) => (metaPhong[i.room] || {}).ahu || "";
            const ahus = [...new Set((rooms || []).filter((r) => evtKhu === "ALL" || r.area === evtKhu).map((r) => r.ahu).filter(Boolean))].sort();
            const incFiltered = incidents.filter((i) => (evtKhu === "ALL" || incKhu(i) === evtKhu) && (evtAhu === "ALL" || incAhu(i) === evtAhu));
            const locChip = (v, label, on, click) => <button key={v} onClick={click} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${on ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`} style={on ? { backgroundColor: COLOR.teal } : {}}>{label}</button>;
            return (
            <div className="space-y-5">
              <SectionTitle icon={AlertOctagon} hint={user ? `vai trò: ${ROLE_VI[role]}` : "đăng nhập để thao tác"}>Sự cố đang xử lý</SectionTitle>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">Lọc khu</span>
                {locChip("ALL", "Tất cả", evtKhu === "ALL", () => { setEvtKhu("ALL"); setEvtAhu("ALL"); })}
                {DS_KHU.map((k) => locChip(k, `Khu ${k}`, evtKhu === k, () => { setEvtKhu(k); setEvtAhu("ALL"); }))}
                {evtKhu !== "ALL" && ahus.length > 0 && (
                  <select value={evtAhu} onChange={(e) => setEvtAhu(e.target.value)} className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-1.5 text-[12px] text-slate-700 outline-none ml-1">
                    <option value="ALL">AHU: tất cả</option>
                    {ahus.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                )}
                <span className="text-[11px] text-slate-400 ml-auto tabular-nums">{incFiltered.length}/{incidents.length} sự cố</span>
              </div>
              <Card className="p-2 sm:p-4">{incFiltered.length === 0 ? (incidents.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#E6F4F1" }}><CheckCircle2 className="w-6 h-6" style={{ color: COLOR.teal }} strokeWidth={1.8} /></div>
                  <p className="mt-3 text-[14px] font-semibold" style={{ color: COLOR.navy }}>Chưa có sự cố nào đang mở</p>
                  <p className="mt-1.5 text-[12px] text-slate-500 max-w-md mx-auto leading-relaxed">Sự cố được <b>tự động tạo</b> khi luồng n8n (WF1) phát hiện mức <b className="text-amber-600">Cảnh báo</b> hoặc <b className="text-rose-600">Hành động</b> từ dữ liệu theo giờ và ghi vào Supabase. Danh sách trống nghĩa là tất cả phòng đang trong ngưỡng — hoặc chưa có dữ liệu kích hoạt.</p>
                  {isLive && <p className="mt-3 text-[11px] text-slate-400 max-w-md mx-auto">Nếu bạn chắc chắn đang có cảnh báo mà vẫn trống, kiểm tra: WF1 có đang chạy theo lịch · ngưỡng trong <b>Cài đặt</b> · và bạn đã <b>đăng nhập</b> đúng vai trò để xem.</p>}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-[13px] text-slate-500">Không có sự cố khớp bộ lọc{evtKhu !== "ALL" ? ` · Khu ${evtKhu}` : ""}{evtAhu !== "ALL" ? ` · ${evtAhu}` : ""}. <button onClick={() => { setEvtKhu("ALL"); setEvtAhu("ALL"); }} className="text-teal-600 font-semibold underline">Bỏ lọc</button></div>
              )) : (
              <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Mã", "Phòng", "Mức", "Chỉ tiêu", "Bắt đầu", "Kéo dài", "Trạng thái", "Cảnh báo", "Hành động"].map((h) => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{incFiltered.map((inc) => { const acts = STATUS_ACTIONS[inc.status] || []; const terminal = acts.length === 0; const myActs = user ? acts.filter((a) => role === "ADMIN" || a.roles.includes(role)) : []; return (
                  <tr key={inc.id} className={`border-t border-slate-100 hover:bg-sky-50/40 transition ${inc.silenced ? "opacity-60" : ""}`}>
                    <td className="py-3 px-3 font-semibold" style={{ color: COLOR.navy }}>{inc.id}</td>
                    <td className="py-3 px-3">{inc.room}{(() => { const kh = [incKhu(inc), incAhu(inc)].filter(Boolean).join(" · "); return kh ? <span className="block text-[10px] text-slate-400">{kh}</span> : null; })()}</td>
                    <td className="py-3 px-3"><MucBadge p={inc.priority} stack /></td>
                    <td className="py-3 px-3 text-slate-600">{inc.sensor}{inc.huong && <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${inc.huong === "CAO" ? "bg-rose-50 text-rose-600" : inc.huong === "THAP" ? "bg-sky-50 text-sky-600" : "bg-amber-50 text-amber-600"}`}>{inc.huong === "CAO" ? "↑ cao" : inc.huong === "THAP" ? "↓ thấp" : "↕ cả 2"}</span>}
                      {inc.giaTriGanNhat != null && <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">TB 5′ cuối <b className="text-slate-600 tabular-nums">{inc.giaTriGanNhat}{inc.donVi}</b>{inc.gioiHanDuoi != null && <> · yêu cầu <span className="tabular-nums">{inc.gioiHanDuoi}–{inc.gioiHanTren}</span></>}{inc.mucGanNhat === "NORMAL" ? <span className="text-emerald-600"> · đã về ngưỡng</span> : inc.mucGanNhat && <span className="text-rose-500"> · {inc.mucGanNhat}</span>}</div>}</td>
                    <td className="py-3 px-3 text-slate-500 tabular-nums text-[12px]">{inc.start.slice(11)}</td>
                    <td className="py-3 px-3 text-amber-600 font-medium">{inc.duration}h</td>
                    <td className="py-3 px-3"><span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 font-medium"><span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inc.status]}`} />{inc.status}</span></td>
                    <td className="py-3 px-3">{user && (role === "ADMIN" || role === "LOT") ? <button onClick={() => toggleSilence(inc.id)} className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 ring-1 transition flex items-center gap-1 ${inc.silenced ? "text-slate-500 bg-slate-100 ring-slate-200 hover:bg-slate-200" : "text-rose-600 bg-rose-50 ring-rose-200 hover:bg-rose-100"}`}>{inc.silenced ? <><Bell className="w-3.5 h-3.5" strokeWidth={1.8} /> Bật lại</> : <><BellOff className="w-3.5 h-3.5" strokeWidth={1.8} /> Dừng CB</>}</button> : <span className="text-[11px] text-slate-300">{inc.silenced ? "đã dừng" : "—"}</span>}</td>
                    <td className="py-3 px-3">{terminal ? <span className="text-teal-600 text-[12px] font-medium">Đã khắc phục</span> : !user ? <button onClick={() => setLoginOpen(true)} className="text-[11px] font-medium rounded-xl px-3 py-1.5 ring-1 ring-slate-200 text-slate-500 bg-white hover:bg-slate-50">Đăng nhập</button> : myActs.length ? <div className="flex flex-wrap gap-1.5">{myActs.map((a) => <button key={a.code} onClick={() => openApproval(inc, a)} className={`text-[11px] font-medium rounded-xl px-2.5 py-1.5 ring-1 transition ${a.color}`}>{a.label}</button>)}</div> : <span className="text-[11px] text-slate-400">Chờ {rolesOfStatus(inc.status).map((r) => ROLE_VI[r]).join("/")}</span>}</td>
                  </tr>
                ); })}</tbody></table></div>)}</Card>
              <p className="text-[11px] text-slate-500 text-center"><b>Dừng CB</b> tắt chuông (vẫn giữ trong danh sách & audit) — chỉ <b>Quản trị / Trực HSL</b> thao tác. IPC và Cơ điện chỉ bấm nút hành động tương ứng theo vai trò; phê duyệt ghi bằng tên người đăng nhập (không cần PIN).</p>
            </div>
            );
          })()}

          {tab === "recent" && <SuCoGanDayPage isLive={isLive} />}
          {tab === "trend" && <div className="space-y-6"><TrendPage onAI={setAi} isLive={isLive} liveRisk={isLive ? live.riskRows : null} liveRooms={isLive ? live.rooms : null} liveIncidents={isLive ? incidents : null} onSaveAI={handleSaveAI} /><PhanTichGmpCard mkt={isLive ? live.gmpMkt : null} spc={isLive ? live.gmpSpc : null} isLive={isLive} /></div>}
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
              <Card className="p-6"><SectionTitle icon={FileText} hint="thao tác web + ghi từ Supabase">Nhật ký audit</SectionTitle><p className="text-[11px] text-slate-500 mt-1.5">Tổng hợp <b>thao tác trên web</b> (phê duyệt sự cố, dừng cảnh báo…) và các sự kiện ghi tại <b>Supabase</b>. Mọi thay đổi đều lưu vết theo ALCOA+.</p><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Thời gian", "Người thực hiện", "Hành động", "Đối tượng", "Chi tiết"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{audit.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-[12px]">Chưa có bản ghi audit.</td></tr> : audit.map((a, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2.5 pr-4 text-slate-500 tabular-nums">{a.t}</td><td className="py-2.5 pr-4 text-slate-600">{a.who}</td><td className="py-2.5 pr-4 text-slate-700">{a.act}</td><td className="py-2.5 pr-4 font-semibold" style={{ color: COLOR.navy }}>{a.obj}</td><td className="py-2.5 pr-4 text-slate-500">{a.detail}</td></tr>)}</tbody></table></div></Card>
              )}
              {auditTab === "config" && (
              <Card className="p-6"><SectionTitle icon={History} hint="cấu hình ngưỡng · phòng · cảm biến">Thay đổi cấu hình & dữ liệu gốc</SectionTitle><p className="text-[11px] text-slate-500 mt-1.5">Các thay đổi cấu hình ghi tại Supabase (sửa ngưỡng cảnh báo, thêm/bớt phòng & cảm biến, chỉnh giới hạn) — kể cả khi sửa trực tiếp trên database, đều hiển thị tại đây.</p><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Thời gian", "Người thực hiện", "Thay đổi"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{configHistory.length === 0 ? <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-[12px]">Chưa có thay đổi cấu hình.</td></tr> : configHistory.map((c, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2.5 pr-4 text-slate-500 tabular-nums">{c.t}</td><td className="py-2.5 pr-4 text-slate-600">{c.who}</td><td className="py-2.5 pr-4 text-slate-700">{c.change}</td></tr>)}</tbody></table></div></Card>
              )}
              {auditTab === "sop" && (
              <Card className="p-6"><SectionTitle icon={ShieldCheck} hint="phục vụ thanh tra">SOP & Deviation / CAPA</SectionTitle><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["SOP", "Áp dụng cho", "Deviation", "CAPA"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{sopRows.map((s, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2.5 pr-4 font-semibold" style={{ color: COLOR.navy }}>{s.sop}</td><td className="py-2.5 pr-4 text-slate-600">{s.apply}</td><td className="py-2.5 pr-4 text-slate-600">{s.dev}</td><td className="py-2.5 pr-4 text-slate-600">{s.capa}</td></tr>)}</tbody></table></div></Card>
              )}
            </div>
            );
          })()}

          {tab === "recipients" && <CauHinhNguoiNhan isLive={isLive} canManage={canManage} actor={user?.email} />}

          {tab === "settings" && (() => {
            const cfgSubTabs = [
              { k: "canhbao", label: "Nguyên tắc cảnh báo", icon: SlidersHorizontal },
              { k: "phong", label: "Phòng & cảm biến", icon: Building2 },
              { k: "phantuyen", label: "Tự phân tuyến", icon: ShieldCheck },
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
                <SectionTitle icon={SlidersHorizontal} hint="4 mức: kiểm soát tốt → chú ý → cảnh báo → hành động">Nguyên tắc cảnh báo</SectionTitle>
                <p className="text-[12px] text-slate-500 mt-2">Mỗi giờ hệ thống chấm mỗi phòng tối đa <b>60 điểm</b> (mỗi phút lỗi = 1 điểm). Số điểm lỗi trong 1 giờ quyết định mức cảnh báo — kéo thanh trượt để chỉnh.</p>
                <div className="mt-5">
                  <div className="relative h-10 rounded-xl overflow-hidden ring-1 ring-slate-200 flex text-[11px] font-semibold text-white select-none">
                    <div style={{ width: pct(cfg.notice) + "%", background: COLOR.teal }} className="flex items-center justify-center min-w-0"><span className="truncate px-1">Tốt</span></div>
                    <div style={{ width: Math.max(0, pct(cfg.warn) - pct(cfg.notice)) + "%", background: "#f59e0b" }} className="flex items-center justify-center min-w-0"><span className="truncate px-1">Chú ý</span></div>
                    <div style={{ width: Math.max(0, 100 - pct(cfg.warn)) + "%", background: "#ef4444" }} className="flex items-center justify-center min-w-0"><span className="truncate px-1">Cảnh báo</span></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1 tabular-nums"><span>0</span><span>số điểm lỗi trong 1 giờ →</span><span>60</span></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                  {[["Chuyển CHÚ Ý khi OOS 1 giờ ≥", "notice", "text-amber-600"], ["Chuyển CẢNH BÁO khi OOS 1 giờ >", "warn", "text-rose-600"]].map(([lbl, key, tone]) => (
                    <div key={key} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                      <div className="flex items-center justify-between gap-2"><label className="text-[12px] font-semibold text-slate-600">{lbl}</label><span className={`text-[16px] font-bold tabular-nums ${tone}`}>{cfg[key]}<span className="text-[11px] text-slate-400 font-normal">/60</span></span></div>
                      <input type="range" min="0" max="60" value={cfg[key]} disabled={!canManage} onChange={(e) => setCfg({ ...cfg, [key]: Number(e.target.value) })} onMouseUp={() => saveCfg(cfg)} onTouchEnd={() => saveCfg(cfg)} className="w-full mt-3 accent-teal-600 disabled:opacity-50" />
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-rose-50/60 ring-1 ring-rose-100 p-4 mt-4 flex items-center justify-between flex-wrap gap-3">
                  <div><label className="text-[12px] font-semibold text-rose-700">Nâng CẢNH BÁO → HÀNH ĐỘNG khi 10 phút cuối có ≥</label><p className="text-[11px] text-slate-500 mt-0.5">Bắt lỗi kéo dài liên tục sát hiện tại — khẩn cấp hơn, đẩy sự cố ngay.</p></div>
                  <div className="flex items-center gap-2"><input type="number" min="0" max="10" value={cfg.action} disabled={!canManage} onChange={(e) => setCfg({ ...cfg, action: Number(e.target.value) })} onBlur={() => saveCfg(cfg)} className="w-20 rounded-xl bg-white ring-1 ring-rose-200 px-3 py-2 text-sm text-center font-bold disabled:bg-slate-100" /><span className="text-sm text-slate-400">/10 điểm</span></div>
                </div>
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

              {cfgTab === "hethong" && (
              <div className="space-y-5">
                <Card className="p-6"><SectionTitle icon={Wifi}>Kết nối Supabase</SectionTitle><div className="space-y-3 mt-4 text-sm">{(() => { const conn = !HAS_SUPABASE ? ["chưa cấu hình", "text-slate-600 bg-slate-100"] : !isLive ? ["DEMO", "text-amber-700 bg-amber-100"] : live.loi ? ["lỗi kết nối", "text-rose-700 bg-rose-100"] : live.dangTai ? ["đang tải…", "text-sky-700 bg-sky-100"] : ["đã kết nối", "text-teal-700 bg-teal-100"]; const keyState = HAS_SUPABASE ? ["đã nạp", "text-teal-700 bg-teal-100"] : ["thiếu .env", "text-rose-700 bg-rose-100"]; const rows = [{ k: "Nguồn dữ liệu", v: isLive ? "LIVE — đọc/ghi Supabase" : "DEMO — dữ liệu mẫu", s: conn }, { k: "Khóa môi trường", v: HAS_SUPABASE ? "VITE_SUPABASE_URL · ANON_KEY" : "chưa thiết lập", s: keyState }, { k: "Cập nhật gần nhất", v: live.capNhatLuc ? live.capNhatLuc.toLocaleString("vi-VN") : "—", s: conn }]; return rows.map((r, i) => <div key={i} className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"><span className="text-slate-500 w-44">{r.k}</span><code className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg ring-1 ring-slate-200 flex-1">{r.v}</code><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.s[1]}`}>{r.s[0]}</span></div>); })()}</div>{isLive && live.loi && <p className="text-[11px] text-rose-600 mt-3">Chi tiết lỗi: {live.loi.thong_bao || live.loi.message || "không xác định"}</p>}</Card>
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
      {roomModal && <RoomDetailModal room={roomModal} onClose={() => setRoomModal(null)} />}
      {kpiModal && <KpiListModal kind={kpiModal} groups={nhomPhong} incidents={suCoP1} cfg={cfg}
        onClose={() => setKpiModal(null)}
        onPickRoom={(r) => { setKpiModal(null); setRoomModal(r); }}
        onPickIncident={(i) => { setKpiModal(null); openApproval(i); }}
        onGotoIncidents={() => { setKpiModal(null); setTab("events"); }} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} isLive={isLive} />}
      {pwOpen && <DoiMatKhauModal user={user} isLive={isLive} onClose={() => setPwOpen(false)} />}
    </div>
  );
}