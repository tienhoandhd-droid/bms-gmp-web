import React, { useState, useMemo, useEffect } from "react";
import { DEFAULT_DATA_SOURCE, HAS_SUPABASE } from "./lib/config";
import { useLiveData } from "./hooks/useLiveData";
import { thaoTacSuCo, dungCanhBao, ACTION_LABEL_TO_CODE, layChuoiXuHuong, luuPhanTichAi, themPhong, suaPhong, xoaPhong, suaGioiHan, themCamBien, xoaCamBien, suaNguong } from "./lib/supabaseData";
import { dangNhapMatKhau, dangXuat as authDangXuat, layPhienHienTai, theoDoiPhien, doiMatKhau } from "./lib/auth";
import AuthGate from "./AuthGate";
import {
  Droplets, Thermometer, Sparkles, ShieldCheck, ShieldAlert, Activity,
  AlertTriangle, CheckCircle2, HelpCircle, Clock, ChevronRight, X, FileText,
  TrendingDown, TrendingUp, Gauge, CircleDot, Check, Bell, BellOff, Mail, Cpu,
  Wind, FileBarChart, LayoutDashboard, AlertOctagon, Building2, LineChart as LineIcon,
  ScrollText, Settings as Cog, Wifi, Printer, Plus, Trash2, Search, LogIn, LogOut,
  User, Eye, SlidersHorizontal, History, Pencil
} from "lucide-react";
import {
  ComposedChart, Bar, Line, AreaChart, Area, BarChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

/* ============ MÀU NƯỚC — HỆ THỦY ============ */
const COLOR = { navy: "#1e3a56", ink: "#33506e", teal: "#149e90", sky: "#4f9fd1", coral: "#e2674f", coralDeep: "#cf583f", sand: "#e6b052", softCoral: "#df7d62" };
const PAGE_BG = "linear-gradient(155deg,#EAF3F8 0%,#FAFDFF 45%,#E2F2EE 100%)";
const cardShadow = { boxShadow: "0 14px 38px -16px rgba(35,80,110,0.40)" };
const CARD = "rounded-3xl bg-white/90 backdrop-blur ring-1 ring-slate-200/80";
const STATUS = { normal: { txt: "text-teal-600", bg: "bg-teal-50", dot: "bg-teal-400" }, warning: { txt: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-400" }, critical: { txt: "text-rose-600", bg: "bg-rose-50", dot: "bg-rose-500" } };
const PRIORITY = { P1: "bg-rose-50 text-rose-600 ring-1 ring-rose-200", P2: "bg-amber-50 text-amber-600 ring-1 ring-amber-200", P3: "bg-sky-50 text-sky-600 ring-1 ring-sky-200" };
const MUC = { P1: "Mức 1", P2: "Mức 2", P3: "Mức 3" };
const LEVELS = [
  { key: "normal", label: "Bình thường", txt: "text-teal-700", bg: "bg-teal-50", ring: "ring-teal-200", dot: "bg-teal-400" },
  { key: "notice", label: "Chú ý", txt: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200", dot: "bg-sky-400" },
  { key: "warning", label: "Cảnh báo", txt: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200", dot: "bg-amber-400" },
  { key: "action", label: "Hành động", txt: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200", dot: "bg-rose-500" },
];

/* ============ NGƯỜI DÙNG & PHÂN QUYỀN ============ */
const USERS = [
  { email: "nam.ipc@cpc1hn.vn", name: "Nam", role: "IPC" },
  { email: "codien@cpc1hn.vn", name: "Tuấn", role: "MEP" },
  { email: "lan.lot@cpc1hn.vn", name: "Lan", role: "LOT" },
  { email: "hoan.qa@cpc1hn.vn", name: "Hoàn", role: "QA" },
  { email: "admin@cpc1hn.vn", name: "Quản trị", role: "ADMIN" },
];
const ROLE_VI = { IPC: "IPC Hiện trường", MEP: "Cơ điện", LOT: "Trực HSL", QA: "QA Kiểm soát", ADMIN: "Quản trị" };
const canManageRooms = (role) => ["ADMIN", "QA"].includes(role);

function CpcLogo() { return <svg viewBox="0 0 120 100" width="40" height="36" aria-label="CPC1"><g transform="translate(60,90)">{[-66, -44, -22, 0, 22, 44, 66].map((a, i) => <path key={i} transform={`rotate(${a})`} d="M -6 0 C -7.5 -42 -3 -66 0 -80 C 3 -66 7.5 -42 6 0 Z" fill="#e1251b" />)}</g></svg>; }

/* ============ TIỆN ÍCH ============ */
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const fmtPct = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}%`);
const fmtH = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}h`);
const fmtDelta = (v) => (v == null || isNaN(v) ? "—" : `${v > 0 ? "+" : ""}${(+v).toFixed(1).replace(".0", "")}%`);
const deltaTone = (v) => (v == null ? "text-slate-400" : v >= 5 ? "text-teal-600" : v <= -5 ? "text-rose-600" : "text-slate-400");
const pad = (n) => String(n).padStart(2, "0");
const toLocalInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

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
function sensorStats(roomId, sensor) {
  // LIVE: dùng thống kê thật đã nạp (DB lưu theo giờ → không có độ phân giải 10′)
  if (sensor && sensor._live) {
    const L = sensor._live;
    return { cur: L.cur, avg1h: L.avg1h, oos1h: L.oos1h ?? 0, err10: null, hourly8: L.hourly8 || [] };
  }
  const arr = rawSeries(roomId, sensor.k);
  const oos = (v) => (sensor.min != null && v < sensor.min) || (sensor.max != null && v > sensor.max);
  const last60 = arr.slice(-60), last10 = arr.slice(-10); const hourly8 = [];
  for (let h = 0; h < 8; h++) { const c = arr.slice(h * 60, (h + 1) * 60); const lab = new Date(c[0].t); hourly8.push({ label: `${pad(lab.getHours())}:00`, avg: +(c.reduce((a, p) => a + p.v, 0) / c.length).toFixed(1), oos: c.filter((p) => oos(p.v)).length }); }
  return { cur: arr[arr.length - 1].v, avg1h: +(last60.reduce((a, p) => a + p.v, 0) / 60).toFixed(1), oos1h: last60.filter((p) => oos(p.v)).length, err10: last10.filter((p) => oos(p.v)).length, hourly8 };
}
function sensorLevel(stat, cfg) { let l = stat.oos1h >= cfg.warn ? 2 : stat.oos1h >= cfg.notice ? 1 : 0; if (l >= 2 && stat.err10 >= cfg.action) l = 3; return l; }
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
const RANGES = [{ k: "1n", label: "1 ngày", days: 1 }, { k: "7n", label: "7 ngày", days: 7 }, { k: "30n", label: "30 ngày", days: 30 }, { k: "90n", label: "90 ngày", days: 90 }];
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
const SENSOR_META = { DP: { label: "Chênh áp", unit: "Pa", icon: Gauge }, RH: { label: "Độ ẩm", unit: "%", icon: Droplets }, T: { label: "Nhiệt độ", unit: "°C", icon: Thermometer } };
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

const STATUS_FLOW = {
  "Chưa xử lý": { next: "IPC: bất thường", label: "IPC tiếp nhận", roles: ["IPC"], color: "text-sky-700 bg-sky-50 hover:bg-sky-100 ring-sky-200" },
  "IPC: bất thường": { next: "Đã báo cơ điện", label: "Báo cơ điện", roles: ["IPC"], color: "text-violet-700 bg-violet-50 hover:bg-violet-100 ring-violet-200" },
  "Đã báo cơ điện": { next: "Cơ điện đang xử lý", label: "Cơ điện tiếp nhận", roles: ["MEP"], color: "text-teal-700 bg-teal-50 hover:bg-teal-100 ring-teal-200" },
  "Cơ điện đang xử lý": { next: "Chờ IPC kiểm lại", label: "Báo đã xử lý", roles: ["MEP"], color: "text-cyan-700 bg-cyan-50 hover:bg-cyan-100 ring-cyan-200" },
  "Chờ IPC kiểm lại": { next: "Đã khắc phục", label: "QA xác nhận khắc phục", roles: ["QA"], color: "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 ring-emerald-200" },
};
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
function MucBadge({ p, stack }) { const n = p[1]; return stack ? <span className={`inline-flex flex-col items-center justify-center leading-tight px-2.5 py-1 rounded-lg ${PRIORITY[p]}`}><span className="text-[9px] font-semibold uppercase tracking-wide">Mức</span><span className="text-[14px] font-bold">{n}</span></span> : <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY[p]}`}>{MUC[p]}</span>; }
function HeaderChip({ children, ring = "ring-slate-200" }) { return <div className={`flex items-center gap-2.5 rounded-2xl bg-white px-4 ring-1 ${ring} h-[50px]`} style={cardShadow}>{children}</div>; }
function KpiCard({ icon: Icon, label, value, total, sub, accent }) {
  return (
    <Card className="relative p-6 overflow-hidden"><div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${accent.glow} blur-2xl opacity-40`} />
      <div className="relative flex items-start justify-between"><div><p className="text-[11px] uppercase tracking-[0.1em] text-slate-500 font-semibold">{label}</p><p className="mt-3 text-5xl font-light tabular-nums leading-none" style={{ color: COLOR.navy }}>{value}{total != null && <span className="text-xl text-slate-300 font-light">/{total}</span>}</p><p className={`mt-2 text-xs font-medium ${accent.txt}`}>{sub}</p></div><div className={`rounded-2xl p-2.5 ${accent.bg}`}><Icon className={`w-5 h-5 ${accent.txt}`} strokeWidth={1.8} /></div></div>
    </Card>
  );
}
function OOSMini({ data }) { return <div className="w-full" style={{ height: 70 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 6, right: 2, left: 2, bottom: 0 }}><YAxis hide /><XAxis dataKey="label" tick={{ fontSize: 8, fill: "#90a8bd" }} axisLine={false} tickLine={false} interval={1} /><Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 10 }} formatter={(v) => [`${v} điểm OOS`, "Lỗi/giờ"]} labelFormatter={(l) => `Giờ ${l}`} /><Bar dataKey="oos" fill={COLOR.softCoral} radius={[3, 3, 0, 0]} maxBarSize={16} /></BarChart></ResponsiveContainer></div>; }

/* ===== THẺ PHÒNG ===== */
function RoomCard({ room, cfg, onDetail, onIncident }) {
  const lvl = roomLevel(room, cfg); const comp = roomCompliance(room); const failing = comp != null && comp < 80; const lm = lvl < 0 ? null : LEVELS[lvl];
  return (
    <Card className="p-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="text-[15px] font-semibold truncate" style={{ color: COLOR.navy }}>{room.name}</h3><MucBadge p={room.priority} /></div><p className="text-[11px] text-slate-500 mt-0.5 tracking-wide truncate">{room.id} · Khu {room.area} · {room.ahu}</p></div>
        <div className="text-right shrink-0">{room.noData ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Mất dữ liệu</span> : (<><p className={`text-2xl font-light tabular-nums ${failing ? "text-rose-600" : "text-teal-600"}`}>{comp}%</p><p className="text-[10px] text-slate-400">tuân thủ 1h</p></>)}</div>
      </div>

      {lm && <div className={`mt-3 rounded-2xl px-3 py-2 ring-1 ${lm.bg} ${lm.ring} flex items-center justify-between`}><span className="flex items-center gap-2 text-[12px] font-semibold"><span className={`w-2 h-2 rounded-full ${lm.dot}`} /><span className={lm.txt}>Mức cảnh báo: {lm.label}</span></span><span className="text-[10px] text-slate-500">8h</span></div>}

      {!room.noData && (
        <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 overflow-hidden">
          <div className="grid grid-cols-5 px-3 py-1.5 text-[9px] uppercase tracking-wide text-slate-400 font-semibold border-b border-slate-200/70"><span>Chỉ tiêu</span><span className="text-center">Hiện tại</span><span className="text-center">TB 1h</span><span className="text-center">OOS 1h</span><span className="text-center">10′</span></div>
          {room.sensors.map((s) => { const st = sensorStats(room.id, s); const sm = LEVELS[(s._live && s._live.level != null) ? s._live.level : sensorLevel(st, cfg)]; return (
            <div key={s.k} className="grid grid-cols-5 items-center px-3 py-2 text-[12px] border-b border-slate-200/50 last:border-0">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">{s.k}<span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} /></span>
              <span className="text-center tabular-nums font-semibold" style={{ color: COLOR.navy }}>{st.cur}<span className="text-[9px] text-slate-400">{SENSOR_META[s.k].unit}</span></span>
              <span className="text-center tabular-nums text-slate-500">{st.avg1h}</span>
              <span className={`text-center tabular-nums font-medium ${st.oos1h >= cfg.warn ? "text-amber-600" : st.oos1h >= cfg.notice ? "text-sky-600" : "text-slate-400"}`}>{st.oos1h}/60</span>
              <span className={`text-center tabular-nums font-medium ${st.err10 != null && st.err10 >= cfg.action ? "text-rose-600" : "text-slate-400"}`}>{st.err10 == null ? "—" : `${st.err10}/10`}</span>
            </div>
          ); })}
        </div>
      )}

      {!room.noData && <div className="mt-3"><span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Điểm OOS theo giờ — 8h</span><OOSMini data={roomHourlyOOS(room)} /></div>}
      {room.note && <p className="mt-3 text-[11px] text-slate-500 bg-sky-50/60 ring-1 ring-sky-100 rounded-xl px-3 py-2">📝 {room.note}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => onDetail(room)} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl py-2 ring-1 ring-sky-200 transition"><Eye className="w-3.5 h-3.5" strokeWidth={1.8} /> Chi tiết</button>
        {failing && <button onClick={() => onIncident(room)} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl py-2 ring-1 ring-rose-200 transition">Xem sự cố <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} /></button>}
      </div>
    </Card>
  );
}

function RoomDetailModal({ room, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden max-h-[88vh] overflow-y-auto" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#E6F4F1,#fff)" }}><div><h2 className="text-base font-semibold" style={{ color: COLOR.navy }}>{room.id} — {room.name}</h2><p className="text-[11px] text-slate-500">Khu {room.area} · {room.ahu} · {MUC[room.priority]} · gồm {room.sensors.length} loại dữ liệu</p></div><button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" strokeWidth={1.8} /></button></div>
        <div className="px-6 py-5 space-y-4">{room.noData ? <p className="text-amber-600 text-sm">Phòng đang thiếu dữ liệu — không có cảm biến hoạt động.</p> : room.sensors.map((s) => { const st = sensorStats(room.id, s); return (
          <div key={s.k} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold" style={{ color: COLOR.navy }}>{SENSOR_META[s.k].label} ({s.k})</p><p className="text-[11px] text-slate-500">Giới hạn: {s.min != null ? `≥ ${s.min}` : ""}{s.max != null ? ` · ≤ ${s.max}` : ""} {SENSOR_META[s.k].unit}</p></div>
            <div className="grid grid-cols-4 gap-2 mb-2 text-center">{[["Hiện tại", `${st.cur} ${SENSOR_META[s.k].unit}`], ["TB 1h", `${st.avg1h}`], ["OOS 1h", `${st.oos1h}/60`], ["Lỗi 10′", st.err10 == null ? "—" : `${st.err10}/10`]].map(([k, v]) => <div key={k} className="rounded-xl bg-white ring-1 ring-slate-200 py-1.5"><p className="text-[9px] uppercase text-slate-400 font-semibold">{k}</p><p className="text-[13px] font-semibold tabular-nums" style={{ color: COLOR.navy }}>{v}</p></div>)}</div>
            <div style={{ height: 120 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={st.hourly8} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="2 6" stroke="#d6e6ee" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} width={34} domain={["auto", "auto"]} /><Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 11 }} formatter={(v) => [`${v} ${SENSOR_META[s.k].unit}`, "TB giờ"]} />{s.min != null && <ReferenceLine y={s.min} stroke={COLOR.coral} strokeDasharray="4 4" />}{s.max != null && <ReferenceLine y={s.max} stroke={COLOR.coral} strokeDasharray="4 4" />}<Area type="monotone" dataKey="avg" stroke={COLOR.teal} strokeWidth={2.2} fill={COLOR.teal} fillOpacity={0.12} dot={{ r: 2 }} /></AreaChart></ResponsiveContainer></div>
          </div>
        ); })}</div>
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

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-[13px]">
          <thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Mã", "Tên", "Khu", "AHU", "Ưu tiên", "Loại DL", "Mức cảnh báo", ""].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {rooms.map((r) => { const lvl = roomLevel(r, cfg); const lm = lvl < 0 ? null : LEVELS[lvl]; return (
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
      <p className="text-[11px] text-slate-400 mt-3">Mọi thay đổi cập nhật ngay KPI, thẻ phòng và được ghi vào <b>Lịch sử thay đổi cấu hình</b> (tab Cài đặt).</p>
    </Card>
  );
}

/* ===== XU HƯỚNG ===== */
function TrendTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null; const d = payload[0].payload;
  return <div className="rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-slate-200" style={{ boxShadow: "0 10px 30px -8px rgba(35,80,110,0.4)" }}><p className="text-xs font-semibold mb-1.5" style={{ color: COLOR.navy }}>{label}</p><div className="space-y-1 text-[11px]"><p className="flex justify-between gap-4"><span className="text-slate-500">Tổng giờ cảnh báo</span><span className="font-semibold tabular-nums">{fmtH(d.alert)}</span></p><p className="flex justify-between gap-4"><span style={{ color: COLOR.sand }}>● Warning</span><span className="tabular-nums">{fmtH(d.warnH)}</span></p><p className="flex justify-between gap-4"><span style={{ color: COLOR.softCoral }}>● Critical</span><span className="tabular-nums">{fmtH(d.critH)}</span></p><p className="flex justify-between gap-4"><span style={{ color: COLOR.teal }}>― Tuân thủ</span><span className="tabular-nums">{fmtPct(d.comp)}</span></p></div></div>;
}
function TrendMainChart({ data, range }) {
  const interval = range === "90n" ? Math.floor(data.length / 9) : range === "30n" ? Math.floor(data.length / 10) : 0;
  return (
    <div className="w-full" style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 14, left: 0, bottom: 4 }}>
          <defs><linearGradient id="warnG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLOR.sand} stopOpacity={1} /><stop offset="100%" stopColor={COLOR.sand} stopOpacity={0.65} /></linearGradient><linearGradient id="critG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLOR.softCoral} stopOpacity={1} /><stop offset="100%" stopColor={COLOR.softCoral} stopOpacity={0.65} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="2 6" stroke="#bcd7e4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#5f7a90" }} interval={interval} axisLine={{ stroke: "#cbdde8" }} tickLine={false} />
          <YAxis yAxisId="h" tick={{ fontSize: 10, fill: "#5f7a90" }} axisLine={false} tickLine={false} width={38} />
          <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#5f7a90" }} axisLine={false} tickLine={false} width={34} />
          <Tooltip content={<TrendTooltip />} cursor={{ fill: "rgba(79,159,209,0.1)" }} />
          <ReferenceLine yAxisId="p" y={80} stroke={COLOR.sand} strokeDasharray="5 5" strokeWidth={1.5} />
          <Bar yAxisId="h" dataKey="warnH" stackId="a" fill="url(#warnG)" maxBarSize={26} />
          <Bar yAxisId="h" dataKey="critH" stackId="a" fill="url(#critG)" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Line yAxisId="p" type="monotone" dataKey="comp" stroke={COLOR.teal} strokeWidth={2.6} dot={false} activeDot={{ r: 4, fill: COLOR.teal }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
function MiniArea({ data }) { return <div className="w-full" style={{ height: 84 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}><YAxis hide /><XAxis dataKey="label" hide /><Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 10 }} formatter={(v) => [fmtH(v), "Giờ CB"]} labelFormatter={(l) => l} /><Area type="monotone" dataKey="alert" stroke={COLOR.softCoral} strokeWidth={2} fill={COLOR.softCoral} fillOpacity={0.16} dot={false} /></AreaChart></ResponsiveContainer></div>; }

function printTrend() {
  try { const node = document.getElementById("trendPrintArea"); if (!node) { window.print(); return; } const win = window.open("", "PRINT", "height=760,width=1040"); if (!win) { window.print(); return; }
    win.document.write(`<html><head><title>Biểu đồ xu hướng GMP</title><style>body{font-family:Inter,'Segoe UI',sans-serif;padding:28px;color:#1e3a56}h1{font-size:16px;margin:0 0 4px}p{font-size:12px;color:#5f7a90;margin:0 0 16px}svg{max-width:100%}</style></head><body><h1>Hệ thống giám sát HVAC phòng sạch GMP — V/Q team QLCL</h1><p>Báo cáo xu hướng · xuất ${new Date().toLocaleString("vi-VN")}</p>${node.innerHTML}</body></html>`);
    win.document.close(); win.focus(); setTimeout(() => { win.print(); win.close(); }, 350);
  } catch (e) { window.print(); }
}

function TrendPage({ onAI, isLive = false, liveRisk = null, onSaveAI = null }) {
  const [range, setRange] = useState("30n");
  const [level, setLevel] = useState("TOTAL");
  const [selId, setSelId] = useState("");
  const [sensor, setSensor] = useState("ALL");
  const [optArea, setOptArea] = useState("ALL");
  const [query, setQuery] = useState("");
  const [dtFrom, setDtFrom] = useState("");
  const [dtTo, setDtTo] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const RANGE_DAYS = { "1n": 1, "7n": 7, "30n": 30, "90n": 90 };
  const [liveSeries, setLiveSeries] = useState({});   // {scopeId: chuỗi 90 ngày}

  // Vũ trụ scope ở chế độ LIVE — định dạng GIỐNG MASTER để JSX dùng chung
  const liveScopes = useMemo(() => {
    if (!isLive || !liveRisk) return [];
    const mk = (r) => ({ type: r.type, id: r.id, name: r.name || r.id, area: r.area || undefined, ahu: r.ahu || undefined, risk: r.risk ?? 0, latest: { compliance: r.compliance }, daily: [{ compliance: (r.compliance != null && r.delta7 != null) ? +(r.compliance - r.delta7).toFixed(1) : r.compliance }] });
    const arr = liveRisk.map(mk);
    const areas = arr.filter((s) => s.type === "AREA");
    const totalComp = areas.length ? +(areas.reduce((a, s) => a + (s.latest.compliance || 0), 0) / areas.length).toFixed(1) : null;
    arr.unshift({ type: "TOTAL", id: "ALL", name: "Toàn hệ thống", risk: 0, latest: { compliance: totalComp }, daily: [{ compliance: totalComp }] });
    return arr;
  }, [isLive, liveRisk]);
  const lByType = (t) => liveScopes.filter((s) => s.type === t).sort((a, b) => b.risk - a.risk);
  const lFind = (id) => liveScopes.find((s) => s.id === id);

  const allOptions = useMemo(() => isLive ? (level === "TOTAL" ? lByType("TOTAL") : lByType(level)) : (level === "TOTAL" ? [findScope("ALL")] : byType(level)), [isLive, level, liveScopes]); // eslint-disable-line
  const options = useMemo(() => allOptions.filter((o) => o && (optArea === "ALL" || o.area === optArea) && (!query || `${o.id} ${o.name}`.toLowerCase().includes(query.toLowerCase()))), [allOptions, optArea, query]);
  const activeId = selId && options.some((o) => o.id === selId) ? selId : (options[0] ? options[0].id : "ALL");
  const activeScope = (isLive ? lFind(activeId) : findScope(activeId)) || (isLive ? (liveScopes[0] || { id: "ALL", name: "—", daily: [{}], latest: {} }) : findScope("ALL"));

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

  const demoFull = useMemo(() => isLive ? [] : getSeries(activeScope, sensor, range), [isLive, activeScope, sensor, range]); // eslint-disable-line
  const full = isLive ? (liveSeries[activeId] || []).slice(-(RANGE_DAYS[range] || 30)) : demoFull;
  const minTs = full[0]?.ts, maxTs = full[full.length - 1]?.ts;
  const fromMs = dtFrom ? new Date(dtFrom).getTime() : minTs;
  const toMs = dtTo ? new Date(dtTo).getTime() : maxTs;
  const series = full.filter((r) => r.ts >= Math.min(fromMs, toMs) && r.ts <= Math.max(fromMs, toMs));
  const view = series.length ? series : full;

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
  const riskRows = (isLive
    ? [...lByType("ROOM"), ...lByType("AHU"), ...lByType("AREA")]
    : [...byType("ROOM"), ...byType("AHU"), ...byType("AREA")]).sort((a, b) => b.risk - a.risk).slice(0, 12);

  const runAI = () => {
    const avg = view.length ? view.reduce((a, r) => a + (r.comp || 0), 0) / view.length : 0;
    const worst = [...view].sort((a, b) => b.alert - a.alert)[0];
    const win = dtFrom || dtTo ? `, ${view[0]?.label}→${view[view.length - 1]?.label}` : "";
    const level = avg < 70 ? 3 : avg < 80 ? 2 : avg < 88 ? 1 : 0;
    const text = `Trong khoảng ${RANGES.find((r) => r.k === range).label}${win} của ${activeScope.name} · ${SENSORS.find((s) => s.k === sensor).label}: tỉ lệ đạt trung bình ${avg.toFixed(1)}%, xu hướng 7 ngày ${fmtDelta(delta7)}, tổng giờ cảnh báo ${fmtH(totalAlert)}${worst ? `, cao điểm ${worst.label} (${fmtH(worst.alert)})` : ""}. Khuyến nghị: ${avg < 80 ? "ưu tiên kiểm tra AHU/cảm biến liên quan, lập CAPA nếu tái diễn." : "duy trì giám sát, chưa cần can thiệp khẩn."}`;
    const payload = { scope: activeScope.name, sensor: SENSORS.find((s) => s.k === sensor).label, range: RANGES.find((r) => r.k === range).label, text, time: new Date().toLocaleString("vi-VN"), level };
    onAI(payload); setAiResult(payload);
    if (isLive && onSaveAI) onSaveAI({ scopeType: activeScope.type, scopeId: activeScope.id, scopeName: activeScope.name, sensor, days: RANGE_DAYS[range] || 30, text, level });
  };

  const Chip = ({ active, onClick, children }) => <button onClick={onClick} className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${active ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200 hover:ring-teal-300"}`} style={active ? { backgroundColor: COLOR.teal } : {}}>{children}</button>;
  const sel = "rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[12px] text-slate-700 outline-none";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: COLOR.navy }}><LineIcon className="w-5 h-5" style={{ color: COLOR.teal }} strokeWidth={1.8} /> Xu hướng GMP — biểu đồ theo thời gian</h2>
        <div className="flex gap-2"><button onClick={runAI} className="text-xs font-medium text-white rounded-xl px-4 py-2 flex items-center gap-1.5" style={{ backgroundColor: COLOR.teal }}><Sparkles className="w-4 h-4" strokeWidth={1.8} /> AI phân tích</button><button onClick={printTrend} className="text-xs font-medium text-white rounded-xl px-4 py-2 flex items-center gap-1.5" style={{ backgroundColor: COLOR.coral }}><Printer className="w-4 h-4" strokeWidth={1.8} /> In biểu đồ</button></div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Khoảng</span>{RANGES.map((r) => <Chip key={r.k} active={range === r.k} onClick={() => { setRange(r.k); setDtFrom(""); setDtTo(""); }}>{r.label}</Chip>)}</div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Cấp xem</span>{SCOPE_LEVELS.map((s) => <Chip key={s.k} active={level === s.k} onClick={() => { setLevel(s.k); setSelId(""); setQuery(""); setOptArea("ALL"); }}>{s.label}</Chip>)}</div>
          <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Chỉ tiêu</span>{SENSORS.map((s) => <Chip key={s.k} active={sensor === s.k} onClick={() => setSensor(s.k)}>{s.label}</Chip>)}</div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap rounded-2xl bg-sky-50/50 ring-1 ring-sky-100 px-3 py-2.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Từ ngày–giờ</span>
          <input type="datetime-local" value={dtFrom} min={minTs ? toLocalInput(minTs) : undefined} max={maxTs ? toLocalInput(maxTs) : undefined} onChange={(e) => setDtFrom(e.target.value)} className={sel} />
          <span className="text-[12px] text-slate-500">đến</span>
          <input type="datetime-local" value={dtTo} min={minTs ? toLocalInput(minTs) : undefined} max={maxTs ? toLocalInput(maxTs) : undefined} onChange={(e) => setDtTo(e.target.value)} className={sel} />
          {(dtFrom || dtTo) && <button onClick={() => { setDtFrom(""); setDtTo(""); }} className="text-[11px] text-slate-500 underline">Đặt lại</button>}
          <span className="text-[11px] text-slate-400 ml-1">Đang xem {view.length}/{full.length} điểm{range === "1n" ? " (theo giờ)" : " (theo ngày)"}</span>
        </div>
        {level !== "TOTAL" && (
          <div className="mt-3 rounded-2xl bg-sky-50/60 ring-1 ring-sky-100 p-3.5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Lọc khu</span>{["ALL", ...AREAS].map((a) => <Chip key={a} active={optArea === a} onClick={() => { setOptArea(a); setSelId(""); }}>{a === "ALL" ? "Tất cả" : a}</Chip>)}</div>
            <div className="flex items-center gap-2 flex-1 min-w-[200px] rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2"><Search className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} /><input value={query} onChange={(e) => { setQuery(e.target.value); setSelId(""); }} placeholder="Tìm mã / tên…" className="w-full text-[13px] text-slate-700 outline-none bg-transparent" /></div>
            <select value={activeId} onChange={(e) => setSelId(e.target.value)} className={sel + " min-w-[240px]"}>{options.length === 0 ? <option>Không có kết quả</option> : options.map((o) => <option key={o.id} value={o.id}>{o.id} — {o.name} · {fmtPct(o.latest.compliance)} · risk {o.risk}</option>)}</select>
            <span className="text-[11px] text-slate-500">{options.length} đối tượng</span>
          </div>
        )}
      </Card>

      <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
        <span className="text-[12px] text-slate-600">Đang chọn: <b style={{ color: COLOR.navy }}>{activeScope.name}</b> · {SENSORS.find((s) => s.k === sensor).label} · {RANGES.find((r) => r.k === range).label}{(dtFrom || dtTo) ? ` · ${view[0]?.label}→${view[view.length - 1]?.label}` : ""}</span>
        <div className="flex gap-2">
          <button onClick={printTrend} className="text-xs font-medium rounded-xl px-4 py-2 text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> In biểu đồ từ lựa chọn này</button>
          <button onClick={runAI} className="text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5" style={{ backgroundColor: COLOR.teal }}><Sparkles className="w-3.5 h-3.5" strokeWidth={1.8} /> AI phân tích & cảnh báo</button>
        </div>
      </Card>
      {aiResult && (() => { const al = [{ l: "Bình thường", c: "text-teal-700", bg: "bg-teal-50", ring: "ring-teal-200" }, { l: "Chú ý", c: "text-sky-700", bg: "bg-sky-50", ring: "ring-sky-200" }, { l: "Cảnh báo", c: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" }, { l: "Hành động", c: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-200" }][aiResult.level]; return (
        <Card className={`p-5 ring-1 ${al.ring}`}>
          <div className="flex items-center justify-between flex-wrap gap-2"><SectionTitle icon={Sparkles}>Kết quả AI phân tích & cảnh báo</SectionTitle><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${al.bg} ${al.c}`}>Mức cảnh báo: {al.l}</span></div>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{aiResult.text}</p>
          <p className="mt-2 text-[11px] text-slate-400">Đã lưu vào tab <b>Báo cáo</b> để gửi email · {aiResult.time}</p>
        </Card>
      ); })()}
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
        <Card className="p-6"><SectionTitle icon={LineIcon} hint={`${activeScope.name} · ${SENSORS.find((s) => s.k === sensor).label} · giờ cảnh báo + tuân thủ`}>Biểu đồ giờ cảnh báo theo thời gian</SectionTitle>
          <div className="mt-4"><TrendMainChart data={view} range={range} /></div>
          <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-slate-500 font-medium"><span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: COLOR.sand }} /> Warning</span><span className="flex items-center gap-1.5"><span className="w-3 h-2.5 rounded-sm inline-block" style={{ background: COLOR.softCoral }} /> Critical</span><span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block" style={{ background: COLOR.teal }} /> % Tuân thủ</span></div>
        </Card>
        <Card className="p-6"><SectionTitle icon={AlertOctagon} hint={`${SENSORS.find((s) => s.k === sensor).label} · số điểm vượt giới hạn`}>Giá trị OOS theo thời gian</SectionTitle>
          <div className="mt-4" style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={view} margin={{ top: 10, right: 12, left: -12, bottom: 4 }}><CartesianGrid strokeDasharray="2 6" stroke="#bcd7e4" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} interval={range === "90n" ? 11 : range === "30n" ? 4 : 0} /><YAxis tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} /><Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 11 }} formatter={(v) => [`${v} điểm OOS`, "Vượt giới hạn"]} cursor={{ fill: "rgba(223,125,98,0.08)" }} /><Bar dataKey="oos" fill={COLOR.softCoral} radius={[4, 4, 0, 0]} maxBarSize={22} /></BarChart></ResponsiveContainer></div>
          <p className="text-[11px] text-slate-400 mt-2">Số điểm nằm ngoài giới hạn theo {range === "1n" ? "giờ" : "ngày"} cho {SENSORS.find((s) => s.k === sensor).label}.</p>
        </Card>
      </div>

      <Card className="p-6"><SectionTitle icon={CircleDot} hint="rủi ro cao nhất mỗi cấp">Xu hướng theo cấp</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">{miniScopes.map(([lvl, sc]) => { const d = sc._series ? sc._series.slice(-(RANGE_DAYS[range] || 30)) : getSeries(sc, sensor, range); const lt = d[d.length - 1] || {}; return <div key={lvl} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-3"><div className="flex items-center justify-between mb-1"><p className="text-xs font-semibold" style={{ color: COLOR.navy }}>{SCOPE_LEVELS.find((x) => x.k === lvl).label}</p><span className="text-[10px] px-2 py-0.5 rounded-full text-slate-600 bg-white ring-1 ring-slate-200">{sc.id}</span></div><p className="text-[10px] text-slate-500 mb-1">{sc.name} · {fmtPct(lt.comp)}</p><MiniArea data={d} /></div>; })}</div>
      </Card>

      <Card className="p-6"><SectionTitle icon={AlertOctagon} hint="mới nhất">Xếp hạng rủi ro</SectionTitle>
        <div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Cấp", "Đối tượng", "Khu/AHU", "Đạt", "Δ 7 ngày", "Risk", "Đánh giá"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{riskRows.map((r) => { const d7 = +(r.latest.compliance - r.daily.slice(-8)[0].compliance).toFixed(1); const a = r.latest.compliance < 70 ? ["Cần điều tra ưu tiên", "text-rose-600"] : r.latest.compliance < 88 ? ["Cần chú ý", "text-amber-600"] : ["Tốt", "text-teal-600"]; return <tr key={r.id} className="border-t border-slate-100 hover:bg-sky-50/40"><td className="py-2.5 pr-4 text-slate-500">{SCOPE_LEVELS.find((x) => x.k === r.type)?.label}</td><td className="py-2.5 pr-4"><span className="font-semibold" style={{ color: COLOR.navy }}>{r.id}</span> <span className="text-slate-500">{r.name}</span></td><td className="py-2.5 pr-4 text-slate-500">{[r.area, r.ahu].filter(Boolean).join(" / ") || "—"}</td><td className="py-2.5 pr-4 tabular-nums">{fmtPct(r.latest.compliance)}</td><td className={`py-2.5 pr-4 tabular-nums font-medium ${deltaTone(d7)}`}>{fmtDelta(d7)}</td><td className="py-2.5 pr-4"><span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ backgroundColor: "rgba(226,103,79,0.14)", color: COLOR.coralDeep }}>{r.risk}</span></td><td className={`py-2.5 pr-4 font-semibold ${a[1]}`}>{a[0]}</td></tr>; })}</tbody></table></div>
      </Card>
    </div>
  );
}

function ApprovalModal({ incident, user, onClose, onCommit }) {
  const [reason, setReason] = useState(""); const flow = STATUS_FLOW[incident.status]; const valid = reason.trim().length >= 6 && flow && user;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white ring-1 ring-slate-200 overflow-hidden" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ background: "linear-gradient(135deg,#E6F4F1,#fff)" }}><div className="flex items-center gap-3"><div className="rounded-2xl bg-white p-2.5 ring-1 ring-teal-100 shadow-sm"><ShieldCheck className="w-5 h-5" style={{ color: COLOR.teal }} strokeWidth={1.8} /></div><div><h2 className="text-base font-semibold" style={{ color: COLOR.navy }}>Phê duyệt thao tác</h2><p className="text-[11px] text-slate-500">Ghi nhận bằng tài khoản đăng nhập · ALCOA+</p></div></div><button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" strokeWidth={1.8} /></button></div>
        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-xs">{[["Mã sự cố", incident.id], ["Phòng", incident.room], ["Chỉ tiêu", incident.sensor]].map(([k, v]) => <div key={k}><p className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{k}</p><p className="mt-1 font-semibold" style={{ color: COLOR.navy }}>{v}</p></div>)}</div>
          <div className="rounded-2xl bg-teal-50 ring-1 ring-teal-100 px-4 py-3 flex items-center gap-2 text-[13px]"><User className="w-4 h-4 text-teal-600" strokeWidth={1.8} /><span className="text-slate-600">Người thực hiện:</span> <span className="font-semibold" style={{ color: COLOR.navy }}>{user ? `${user.name} (${user.role})` : "chưa đăng nhập"}</span></div>
          <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200/70 p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1.5"><FileText className="w-3 h-3" strokeWidth={1.8} /> Nhật ký truy vết</p><div className="space-y-2 max-h-32 overflow-y-auto pr-1">{incident.trail.map((e, i) => <div key={i} className="flex gap-3 text-xs"><span className="text-slate-400 tabular-nums shrink-0">{e.t}</span><span className="text-slate-300">·</span><span className="text-slate-600"><span className="font-semibold">{e.who}</span> — {e.act}</span></div>)}</div></div>
          <div><label className="text-[11px] font-semibold text-slate-600 mb-2 block">Lý do / kết quả <span className="text-rose-500">*</span></label><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ghi rõ lý do/kết quả (tối thiểu 6 ký tự)…" className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-teal-300 resize-none placeholder:text-slate-300" /></div>
        </div>
        <div className="px-6 py-4 bg-slate-50 flex items-center justify-between gap-3"><span className="text-[11px] text-slate-500">Trạng thái tiếp → <span className="font-semibold text-slate-700">{flow?.next}</span></span><div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Hủy</button><button disabled={!valid} onClick={() => onCommit(incident, reason)} className="px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 text-white disabled:bg-slate-200 disabled:text-slate-400" style={valid ? { backgroundColor: COLOR.coral } : {}}><Check className="w-4 h-4" strokeWidth={2} /> Xác nhận & lưu</button></div></div>
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
  const [sender, setSender] = useState(USERS[3].email);
  const [recips, setRecips] = useState([USERS[3].email]);
  const [sent, setSent] = useState(false);
  const toggle = (em) => setRecips((r) => (r.includes(em) ? r.filter((x) => x !== em) : [...r, em]));
  const sel = "rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-[13px] text-slate-700 outline-none";
  const AI_LV = ["text-teal-700 bg-teal-50 ring-teal-200", "text-sky-700 bg-sky-50 ring-sky-200", "text-amber-700 bg-amber-50 ring-amber-200", "text-rose-700 bg-rose-50 ring-rose-200"];
  return (
    <div className="space-y-5">
      <SectionTitle icon={FileBarChart}>Báo cáo & Phân tích AI</SectionTitle>
      <Card className="p-6"><SectionTitle icon={Sparkles} hint="tích hợp từ tab Xu hướng GMP">Phân tích AI</SectionTitle>
        {ai ? <div className="rounded-2xl ring-1 ring-teal-100 p-5 text-sm leading-relaxed text-slate-700 mt-4" style={{ background: "linear-gradient(135deg,#EAF6F3,#fff)" }}><p className="text-[11px] text-slate-500 mb-2">{ai.scope} · {ai.sensor} · {ai.range} · tạo lúc {ai.time}</p><p>{ai.text}</p></div> : <div className="rounded-2xl ring-1 ring-amber-100 bg-amber-50/50 p-5 text-sm text-slate-600 mt-4">Chưa có phân tích. Vào tab <b>Xu hướng GMP</b>, chọn đối tượng/khoảng thời gian rồi bấm <b>AI phân tích</b>.</div>}
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
      <Card className="p-6"><SectionTitle icon={Mail}>Gửi email báo cáo</SectionTitle>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div><label className="text-[11px] uppercase text-slate-500 font-semibold">Email người gửi</label><select value={sender} onChange={(e) => setSender(e.target.value)} className={sel + " w-full mt-1.5"}>{USERS.map((u) => <option key={u.email} value={u.email}>{u.email}</option>)}</select></div>
          <div><label className="text-[11px] uppercase text-slate-500 font-semibold">Email người nhận</label><div className="mt-1.5 flex flex-wrap gap-2">{USERS.map((u) => <button key={u.email} onClick={() => toggle(u.email)} className={`text-[12px] rounded-full px-3 py-1.5 ring-1 transition ${recips.includes(u.email) ? "text-white ring-transparent" : "text-slate-600 bg-white ring-slate-200"}`} style={recips.includes(u.email) ? { backgroundColor: COLOR.teal } : {}}>{u.email}</button>)}</div></div>
        </div>
        <div className="mt-5 flex items-center gap-3 flex-wrap"><button onClick={() => { setSent(true); setTimeout(() => setSent(false), 2500); }} className="text-xs font-medium rounded-xl px-4 py-2 text-white flex items-center gap-1.5" style={{ backgroundColor: COLOR.coral }}><Mail className="w-3.5 h-3.5" strokeWidth={1.8} /> Gửi email</button><button onClick={() => window.print()} className="text-xs font-medium rounded-xl px-4 py-2 text-slate-600 ring-1 ring-slate-200 bg-white hover:bg-slate-50 flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" strokeWidth={1.8} /> In / PDF</button>{sent && <span className="text-xs text-teal-600 font-medium">✓ Đã gửi tới {recips.length} email (mô phỏng).</span>}</div>
        <p className="text-[11px] text-slate-400 mt-3">Gửi từ <b>{sender}</b> tới {recips.length} email người nhận. Kèm phân tích AI ở trên (nếu có).</p>
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
        <div className="leading-tight"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sức khỏe dữ liệu</p><p className="text-xs font-semibold text-slate-400">{dangTai ? "đang kiểm tra…" : "—"}</p></div>
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
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sức khỏe dữ liệu</p>
        <p className={`text-xs font-semibold ${txt}`}>{mat ? "MẤT DỮ LIỆU" : `Dữ liệu mới · trễ ${treTxt}`}</p>
      </div>
    </div>
  );
}

function DoiMatKhauCard({ user, isLive }) {
  const [mk1, setMk1] = useState("");
  const [mk2, setMk2] = useState("");
  const [dang, setDang] = useState(false);
  const [ok, setOk] = useState(false);
  const [loi, setLoi] = useState("");
  const doi = async () => {
    setLoi(""); setOk(false);
    if (mk1.length < 6) { setLoi("Mật khẩu mới tối thiểu 6 ký tự."); return; }
    if (mk1 !== mk2) { setLoi("Hai mật khẩu nhập không khớp."); return; }
    if (!isLive) { setLoi("Chỉ đổi được mật khẩu ở chế độ LIVE (đã đăng nhập thật)."); return; }
    setDang(true);
    const { error } = await doiMatKhau(mk1);
    setDang(false);
    if (error) setLoi(error.message || "Đổi mật khẩu thất bại.");
    else { setOk(true); setMk1(""); setMk2(""); }
  };
  return (
    <Card className="p-6">
      <SectionTitle icon={Cog} hint={user ? user.email : "chưa đăng nhập"}>Đổi mật khẩu</SectionTitle>
      {!user ? (
        <p className="text-[12px] text-slate-500 mt-2">Đăng nhập để đổi mật khẩu.</p>
      ) : (
        <div className="mt-4 space-y-3 max-w-sm">
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
          <p className="text-[11px] text-slate-400 leading-relaxed">Mật khẩu tối thiểu 6 ký tự. Sau khi đổi, lần đăng nhập sau dùng mật khẩu mới.</p>
        </div>
      )}
    </Card>
  );
}

const TABS = [{ k: "home", label: "Tổng quan", icon: LayoutDashboard }, { k: "events", label: "Sự cố", icon: AlertOctagon }, { k: "rooms", label: "Phòng", icon: Building2 }, { k: "trend", label: "Xu hướng GMP", icon: LineIcon }, { k: "reports", label: "Báo cáo", icon: FileBarChart }, { k: "audit", label: "Nhật ký & SOP", icon: ScrollText }, { k: "settings", label: "Cài đặt", icon: Cog }];

export default function App() {
  const [tab, setTab] = useState("home");
  const [dataSource, setDataSource] = useState(DEFAULT_DATA_SOURCE);   // 'demo' | 'live'
  const [rooms, setRooms] = useState(INITIAL_ROOMS);
  const [incidents, setIncidents] = useState(INCIDENTS0);
  const [cfg, setCfg] = useState({ notice: 1, warn: 12, action: 5 });
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [roomModal, setRoomModal] = useState(null);
  const [configHistory, setConfigHistory] = useState([{ t: "08:00 29/5", who: "Quản trị (ADMIN)", change: "Khởi tạo cấu hình hệ thống · 6 phòng" }]);
  const [audit, setAudit] = useState([{ t: "13:05 29/5", who: "Hệ thống", act: "Tạo sự cố", obj: "SC-1042 / C4.R7", detail: "Chênh áp nghiêm trọng" }, { t: "10:18 29/5", who: "Nam (IPC)", act: "Xác nhận bất thường", obj: "SC-1038 / C4.R1", detail: "Kiểm tra thực tế" }]);
  const [ai, setAi] = useState(null);
  const role = user?.role; const canManage = canManageRooms(role);

  // ===== Dữ liệu LIVE từ Supabase (Tổng quan/Sự cố/Nhật ký) =====
  const live = useLiveData(dataSource);
  const isLive = dataSource === "live";

  // Đồng bộ phiên đăng nhập thật (magic link) khi ở chế độ live
  useEffect(() => {
    if (!isLive || !HAS_SUPABASE) return;
    let off = () => {};
    layPhienHienTai().then((u) => { if (u) setUser(u); });
    off = theoDoiPhien((u) => setUser(u));
    return () => off();
  }, [isLive]);

  // Khi có dữ liệu sự cố LIVE → thay danh sách demo
  useEffect(() => { if (isLive && live.incidents) setIncidents(live.incidents); }, [isLive, live.incidents]);
  useEffect(() => { if (isLive && live.audit) setAudit(live.audit); }, [isLive, live.audit]);
  useEffect(() => { if (isLive && live.configHistory) setConfigHistory(live.configHistory); }, [isLive, live.configHistory]);
  useEffect(() => { if (isLive && live.rooms) setRooms(live.rooms); }, [isLive, live.rooms]);
  useEffect(() => { if (isLive && live.nguong) setCfg(live.nguong); }, [isLive, live.nguong]);

  // Giờ máy chủ: demo cố định; live dùng giờ thực
  const now = isLive ? new Date().toISOString().replace("T", " ").slice(0, 19) : "2026-05-29 14:08:22";

  const demoKpis = useMemo(() => ({ dat: rooms.filter((r) => { const c = roomCompliance(r); return !r.noData && c >= 80; }).length, khongDat: rooms.filter((r) => { const c = roomCompliance(r); return !r.noData && c < 80; }).length, thieuDL: rooms.filter((r) => r.noData).length, tong: rooms.length }), [rooms]);
  const kpis = (isLive && live.kpis) ? live.kpis : demoKpis;
  const systemAlerts = (isLive && live.systemAlerts) ? live.systemAlerts.map((a) => ({ ...a, icon: ICON_CANH_BAO(a) })) : SYSTEM_ALERTS;
  const sopRows = (isLive && live.sopRows && live.sopRows.length) ? live.sopRows : SOP;
  const p1Open = incidents.filter((i) => i.priority === "P1" && i.status !== "Đã khắc phục").length;

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

  const requireLogin = () => { if (!user) { setLoginOpen(true); return false; } return true; };
  const openApproval = (inc) => { if (!requireLogin()) return; setModal(inc); };
  const handleCommit = async (inc, reason) => {
    const who = `${user.name} (${user.role})`; const flow = STATUS_FLOW[inc.status];
    if (isLive && inc.dbId) {
      const actionCode = ACTION_LABEL_TO_CODE[flow.label];
      const { error } = await thaoTacSuCo({ dbId: inc.dbId, actionCode, lyDo: reason, actorEmail: user.email });
      setModal(null);
      if (error) { alert(error.nghiep_vu ? (error.thong_bao || error.ma_loi) : "Lỗi kết nối — thử lại."); return; }
      await live.lamMoi({ nen: true });   // đồng bộ lại từ DB (đã có audit/trail thật)
      return;
    }
    // DEMO
    setIncidents((prev) => prev.map((i) => i.id === inc.id ? { ...i, status: flow.next, trail: [...i.trail, { t: now.slice(11), who, act: `${flow.label}: ${reason}` }] } : i));
    setAudit((a) => [{ t: now.slice(11, 16) + " 29/5", who, act: flow.label, obj: `${inc.id} / ${inc.room}`, detail: reason }, ...a]); setModal(null);
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
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white p-2 ring-1 ring-slate-200 flex items-center justify-center h-[50px] w-[50px]" style={cardShadow}><CpcLogo /></div>
            <div className="flex flex-col justify-center"><h1 className="text-base sm:text-lg font-bold tracking-tight leading-none" style={{ color: COLOR.navy }}>Hệ thống giám sát HVAC phòng sạch GMP</h1><p className="text-[12px] font-semibold tracking-wide mt-1" style={{ color: COLOR.teal }}>V/Q team — QLCL</p></div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <HeaderChip ring="ring-amber-200"><ShieldAlert className="w-4 h-4 text-amber-600" strokeWidth={1.8} /><div className="leading-tight"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Toàn vẹn dữ liệu</p><p className="text-xs font-semibold text-amber-600">{kpis.thieuDL} phòng thiếu DL</p></div></HeaderChip>
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
            <HeaderChip><Clock className="w-4 h-4" style={{ color: COLOR.teal }} strokeWidth={1.8} /><div className="leading-tight"><p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Giờ máy chủ · UTC+7</p><p className="text-xs font-semibold tabular-nums" style={{ color: COLOR.ink }}>{now}</p></div></HeaderChip>
            {user ? <div className="flex items-center gap-2.5 rounded-2xl bg-white pl-2 pr-2 ring-1 ring-slate-200 h-[50px]" style={cardShadow}><div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-semibold" style={{ background: "linear-gradient(135deg,#5ec8d8,#149e90)" }}>{user.name[0]}</div><div className="leading-tight"><p className="text-xs font-semibold" style={{ color: COLOR.ink }}>{user.name}</p><p className="text-[10px] font-medium" style={{ color: COLOR.teal }}>{ROLE_VI[user.role]}</p></div><button onClick={() => { setUser(null); if (isLive) authDangXuat(); }} className="ml-1 rounded-lg p-1.5 hover:bg-slate-100 text-slate-400" title="Đăng xuất"><LogOut className="w-4 h-4" strokeWidth={1.8} /></button></div>
              : <button onClick={() => setLoginOpen(true)} className="flex items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white h-[50px]" style={{ background: "linear-gradient(135deg,#1aa899,#149e90)", ...cardShadow }}><LogIn className="w-4 h-4" strokeWidth={1.8} /> Đăng nhập</button>}
          </div>
        </header>

        <nav className="mt-5"><div className="rounded-2xl bg-white/80 backdrop-blur ring-1 ring-slate-200 p-1.5 flex gap-1 overflow-x-auto" style={cardShadow}>{TABS.map((t) => { const Icon = t.icon; const active = tab === t.k; return <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition ${active ? "text-white" : "text-slate-600 hover:bg-slate-100"}`} style={active ? { background: "linear-gradient(135deg,#1aa899,#149e90)", boxShadow: "0 6px 16px -6px rgba(20,158,144,0.55)" } : {}}><Icon className="w-4 h-4" strokeWidth={1.8} /> {t.label}{t.k === "events" && <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={active ? { background: "rgba(255,255,255,0.25)" } : { background: "rgba(226,103,79,0.16)", color: COLOR.coralDeep }}>{p1Open}</span>}</button>; })}</div></nav>

        <main className="mt-6">
          {isLive && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl bg-teal-50 ring-1 ring-teal-100 px-4 py-2.5 text-[12px] text-slate-600">
              <Wifi className="w-4 h-4 mt-0.5 text-teal-600 shrink-0" strokeWidth={1.8} />
              <span>Đang đọc/ghi dữ liệu thật từ Supabase cho <b>tất cả các tab</b> (Tổng quan · Sự cố · Phòng · Xu hướng · Báo cáo · Nhật ký). Dữ liệu <b>Xu hướng / Rủi ro / Báo cáo AI</b> dựa trên KPI tổng hợp theo ngày — sẽ đầy đủ dần khi WF rollup (Pha 3) chạy hoặc gọi <code>rpc_tinh_kpi_ngay</code>.{live.loi && <span className="text-rose-600"> · Lỗi tải: {live.loi.thong_bao || live.loi.message || "kết nối"}</span>}{live.capNhatLuc && !live.loi && <span className="text-slate-400"> · Cập nhật {live.capNhatLuc.toLocaleTimeString("vi-VN")}</span>}</span>
            </div>
          )}
          {tab === "home" && (
            <div className="space-y-5">
              <Card className="px-7 py-6 overflow-hidden" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 55%,#E6F1FA)" }}><p className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: COLOR.teal }}>Tri thức · Tuân thủ · Toàn vẹn dữ liệu</p><h2 className="mt-1 text-2xl font-semibold" style={{ color: COLOR.navy }}>Giám sát chênh áp · độ ẩm · nhiệt độ theo thời gian thực</h2><div className="mt-4 flex gap-2 flex-wrap text-xs">{[`${kpis.tong} phòng giám sát`, "3 khu: C1 · C4 · Q2", "8 AHU", "Cập nhật mỗi giờ"].map((p) => <span key={p} className="bg-white ring-1 ring-slate-200 text-slate-600 px-3 py-1.5 rounded-full font-medium">{p}</span>)}</div>{!user && <div className="mt-4 inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 ring-1 ring-amber-200 px-3 py-1.5 rounded-xl font-medium"><LogIn className="w-3.5 h-3.5" strokeWidth={1.8} /> Đăng nhập để thao tác theo phân quyền.</div>}</Card>
              <div className="flex items-center justify-between px-1"><SectionTitle icon={Clock} hint="cập nhật theo giờ">Tổng quan trạng thái — 1 giờ gần nhất</SectionTitle></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={CheckCircle2} label="Phòng đạt" value={kpis.dat} total={kpis.tong} sub="tuân thủ ≥ 80% (1h)" accent={{ txt: "text-teal-600", bg: "bg-teal-50", glow: "bg-teal-200" }} />
                <KpiCard icon={AlertTriangle} label="Phòng không đạt" value={kpis.khongDat} total={kpis.tong} sub="tuân thủ < 80%" accent={{ txt: "text-rose-600", bg: "bg-rose-50", glow: "bg-rose-200" }} />
                <KpiCard icon={HelpCircle} label="Thiếu dữ liệu" value={kpis.thieuDL} total={kpis.tong} sub="không coi là đạt" accent={{ txt: "text-amber-600", bg: "bg-amber-50", glow: "bg-amber-200" }} />
                <KpiCard icon={Activity} label="Sự cố Mức 1 mở" value={p1Open} sub="phòng trọng yếu" accent={{ txt: "text-sky-600", bg: "bg-sky-50", glow: "bg-sky-200" }} />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
                <div><div className="flex items-center justify-between mb-3 px-1"><SectionTitle icon={CircleDot}>Phòng trọng điểm cần theo dõi</SectionTitle><span className="text-[11px] text-slate-500">{rooms.length} phòng</span></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{rooms.map((r) => <RoomCard key={r.id} room={r} cfg={cfg} onDetail={setRoomModal} onIncident={openRoomIncident} />)}</div></div>
                <aside className="space-y-5">
                  <Card className="p-5" style={{ background: "linear-gradient(135deg,#E6F4F1,#FFFFFF 60%,#E6F1FA)" }}><div className="flex items-center justify-between"><SectionTitle icon={Sparkles}>Phân tích AI</SectionTitle><span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-1 rounded-full"><TrendingDown className="w-3 h-3" strokeWidth={2} /> Δ 7 ngày −6%</span></div><p className="mt-3 text-[13px] leading-relaxed text-slate-600"><span className="font-semibold" style={{ color: COLOR.navy }}>AHU-K01</span> cần kiểm tra ưu tiên — C4.R7, C4.R1 đều kém, nghi lỗi quạt/filter.</p></Card>
                  <Card className="p-5"><SectionTitle icon={Bell}>Cảnh báo hệ thống</SectionTitle><div className="space-y-2 mt-3">{systemAlerts.map((a, i) => { const Icon = a.icon || ICON_CANH_BAO(a); return <div key={i} className={`flex items-start gap-3 rounded-2xl px-3 py-2.5 ${STATUS[a.kind].bg} ring-1 ring-slate-200/60`}><Icon className={`w-4 h-4 mt-0.5 shrink-0 ${STATUS[a.kind].txt}`} strokeWidth={1.8} /><div className="leading-tight"><p className="text-xs text-slate-700 font-medium">{a.text}</p><p className="text-[10px] text-slate-500 mt-0.5">{a.sub}</p></div></div>; })}</div></Card>
                </aside>
              </div>
            </div>
          )}

          {tab === "events" && (
            <div className="space-y-5">
              <SectionTitle icon={AlertOctagon} hint={user ? `vai trò: ${ROLE_VI[role]}` : "đăng nhập để thao tác"}>Sự cố đang xử lý</SectionTitle>
              <Card className="p-2 sm:p-4"><div className="overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Mã", "Phòng", "Mức", "Chỉ tiêu", "Bắt đầu", "Kéo dài", "Trạng thái", "Cảnh báo", "Hành động"].map((h) => <th key={h} className="py-2.5 px-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{incidents.map((inc) => { const flow = STATUS_FLOW[inc.status]; const allowed = user && (role === "ADMIN" || (flow && flow.roles.includes(role))); return (
                  <tr key={inc.id} className={`border-t border-slate-100 hover:bg-sky-50/40 transition ${inc.silenced ? "opacity-60" : ""}`}>
                    <td className="py-3 px-3 font-semibold" style={{ color: COLOR.navy }}>{inc.id}</td>
                    <td className="py-3 px-3">{inc.room}</td>
                    <td className="py-3 px-3"><MucBadge p={inc.priority} stack /></td>
                    <td className="py-3 px-3 text-slate-600">{inc.sensor}</td>
                    <td className="py-3 px-3 text-slate-500 tabular-nums text-[12px]">{inc.start.slice(11)}</td>
                    <td className="py-3 px-3 text-amber-600 font-medium">{inc.duration}h</td>
                    <td className="py-3 px-3"><span className="inline-flex items-center gap-1.5 text-[12px] text-slate-700 font-medium"><span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inc.status]}`} />{inc.status}</span></td>
                    <td className="py-3 px-3">{user && (role === "ADMIN" || role === "LOT") ? <button onClick={() => toggleSilence(inc.id)} className={`text-[11px] font-medium rounded-lg px-2.5 py-1.5 ring-1 transition flex items-center gap-1 ${inc.silenced ? "text-slate-500 bg-slate-100 ring-slate-200 hover:bg-slate-200" : "text-rose-600 bg-rose-50 ring-rose-200 hover:bg-rose-100"}`}>{inc.silenced ? <><Bell className="w-3.5 h-3.5" strokeWidth={1.8} /> Bật lại</> : <><BellOff className="w-3.5 h-3.5" strokeWidth={1.8} /> Dừng CB</>}</button> : <span className="text-[11px] text-slate-300">{inc.silenced ? "đã dừng" : "—"}</span>}</td>
                    <td className="py-3 px-3">{!flow ? <span className="text-teal-600 text-[12px] font-medium">Đã khắc phục</span> : !user ? <button onClick={() => setLoginOpen(true)} className="text-[11px] font-medium rounded-xl px-3 py-1.5 ring-1 ring-slate-200 text-slate-500 bg-white hover:bg-slate-50">Đăng nhập</button> : allowed ? <button onClick={() => openApproval(inc)} className={`text-[11px] font-medium rounded-xl px-3 py-1.5 ring-1 transition flex items-center gap-1.5 ${flow.color}`}>{flow.label} <ChevronRight className="w-3 h-3" strokeWidth={2} /></button> : <span className="text-[11px] text-slate-400">Chờ {flow.roles.map((r) => ROLE_VI[r]).join("/")}</span>}</td>
                  </tr>
                ); })}</tbody></table></div></Card>
              <p className="text-[11px] text-slate-500 text-center"><b>Dừng CB</b> tắt chuông (vẫn giữ trong danh sách & audit) — chỉ <b>Quản trị / Trực HSL</b> thao tác. IPC và Cơ điện chỉ bấm nút hành động tương ứng theo vai trò; phê duyệt ghi bằng tên người đăng nhập (không cần PIN).</p>
            </div>
          )}

          {tab === "rooms" && (
            <div className="space-y-5"><SectionTitle icon={Building2}>Quản lý phòng</SectionTitle><RoomManager rooms={rooms} cfg={cfg} canManage={canManage} onAdd={addRoom} onEdit={editRoom} onDelete={deleteRoom} onUpdateLimit={updateLimit} onAddSensor={addSensor} onRemoveSensor={removeSensor} /></div>
          )}

          {tab === "trend" && <TrendPage onAI={setAi} isLive={isLive} liveRisk={isLive ? live.riskRows : null} onSaveAI={handleSaveAI} />}
          {tab === "reports" && <ReportsPage ai={ai} aiRows={isLive ? live.aiRows : null} />}

          {tab === "audit" && (
            <div className="space-y-5">
              <SectionTitle icon={ScrollText} hint="ALCOA+">Nhật ký truy vết & SOP</SectionTitle>
              <Card className="p-6"><SectionTitle icon={FileText}>Nhật ký audit</SectionTitle><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Thời gian", "Người thực hiện", "Hành động", "Đối tượng", "Chi tiết"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{audit.map((a, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2.5 pr-4 text-slate-500 tabular-nums">{a.t}</td><td className="py-2.5 pr-4 text-slate-600">{a.who}</td><td className="py-2.5 pr-4 text-slate-700">{a.act}</td><td className="py-2.5 pr-4 font-semibold" style={{ color: COLOR.navy }}>{a.obj}</td><td className="py-2.5 pr-4 text-slate-500">{a.detail}</td></tr>)}</tbody></table></div></Card>
              <Card className="p-6"><SectionTitle icon={ShieldCheck} hint="phục vụ thanh tra">SOP & Deviation / CAPA</SectionTitle><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["SOP", "Áp dụng cho", "Deviation", "CAPA"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{sopRows.map((s, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2.5 pr-4 font-semibold" style={{ color: COLOR.navy }}>{s.sop}</td><td className="py-2.5 pr-4 text-slate-600">{s.apply}</td><td className="py-2.5 pr-4 text-slate-600">{s.dev}</td><td className="py-2.5 pr-4 text-slate-600">{s.capa}</td></tr>)}</tbody></table></div></Card>
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-5">
              <SectionTitle icon={Cog}>Cài đặt</SectionTitle>
              <Card className="p-6"><SectionTitle icon={SlidersHorizontal} hint="hành động · cảnh báo · chú ý">Nguyên tắc cảnh báo</SectionTitle><p className="text-[12px] text-slate-500 mt-2">Số điểm vượt giới hạn trong 1 giờ (x/60) quyết định mức; số điểm lỗi 10′ gần nhất (x/10) phân biệt <b>Cảnh báo</b> với <b>Hành động</b>.</p><div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">{[["Chú ý khi OOS 1h ≥", "notice", "/60"], ["Cảnh báo khi OOS 1h ≥", "warn", "/60"], ["Nâng lên Hành động khi lỗi 10′ ≥", "action", "/10"]].map(([lbl, key, suf]) => <div key={key} className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4"><label className="text-[11px] uppercase text-slate-500 font-semibold">{lbl}</label><div className="flex items-center gap-2 mt-2"><input type="number" min="0" value={cfg[key]} disabled={!canManage} onChange={(e) => setCfg({ ...cfg, [key]: Number(e.target.value) })} onBlur={() => saveCfg(cfg)} className="w-20 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /><span className="text-sm text-slate-400">{suf} điểm</span></div></div>)}</div>{!canManage && <p className="text-[11px] text-amber-600 mt-3">Cần quyền QA/Quản trị để chỉnh.</p>}</Card>
              <Card className="p-6"><SectionTitle icon={History}>Lịch sử thay đổi cấu hình</SectionTitle><div className="overflow-x-auto mt-3"><table className="w-full text-[13px]"><thead><tr className="text-slate-500 text-left text-[11px] uppercase tracking-wider">{["Thời gian", "Người thực hiện", "Thay đổi"].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead><tbody>{configHistory.map((c, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2.5 pr-4 text-slate-500 tabular-nums">{c.t}</td><td className="py-2.5 pr-4 text-slate-600">{c.who}</td><td className="py-2.5 pr-4 text-slate-700">{c.change}</td></tr>)}</tbody></table></div><p className="text-[11px] text-slate-400 mt-3">Thêm/sửa cảm biến & giới hạn thực hiện tại tab <b>Phòng → Quản lý phòng</b>.</p></Card>
              <Card className="p-6"><SectionTitle icon={Wifi}>Kết nối Supabase</SectionTitle><div className="space-y-3 mt-4 text-sm">{(() => { const conn = !HAS_SUPABASE ? ["chưa cấu hình", "text-slate-600 bg-slate-100"] : !isLive ? ["DEMO", "text-amber-700 bg-amber-100"] : live.loi ? ["lỗi kết nối", "text-rose-700 bg-rose-100"] : live.dangTai ? ["đang tải…", "text-sky-700 bg-sky-100"] : ["đã kết nối", "text-teal-700 bg-teal-100"]; const keyState = HAS_SUPABASE ? ["đã nạp", "text-teal-700 bg-teal-100"] : ["thiếu .env", "text-rose-700 bg-rose-100"]; const rows = [{ k: "Nguồn dữ liệu", v: isLive ? "LIVE — đọc/ghi Supabase" : "DEMO — dữ liệu mẫu", s: conn }, { k: "Khóa môi trường", v: HAS_SUPABASE ? "VITE_SUPABASE_URL · ANON_KEY" : "chưa thiết lập", s: keyState }, { k: "Cập nhật gần nhất", v: live.capNhatLuc ? live.capNhatLuc.toLocaleString("vi-VN") : "—", s: conn }]; return rows.map((r, i) => <div key={i} className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0"><span className="text-slate-500 w-44">{r.k}</span><code className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg ring-1 ring-slate-200 flex-1">{r.v}</code><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.s[1]}`}>{r.s[0]}</span></div>); })()}</div>{isLive && live.loi && <p className="text-[11px] text-rose-600 mt-3">Chi tiết lỗi: {live.loi.thong_bao || live.loi.message || "không xác định"}</p>}</Card>
              <DoiMatKhauCard user={user} isLive={isLive} />
            </div>
          )}
        </main>

        <footer className="mt-8 text-center text-[11px] text-slate-400 tracking-wide leading-relaxed"><span className="font-semibold" style={{ color: COLOR.ink }}>Hệ thống giám sát HVAC phòng sạch GMP</span> · V/Q team — QLCL</footer>
      </div>

      {modal && <ApprovalModal incident={modal} user={user} onClose={() => setModal(null)} onCommit={handleCommit} />}
      {roomModal && <RoomDetailModal room={roomModal} onClose={() => setRoomModal(null)} />}
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} isLive={isLive} />}
    </div>
  );
}