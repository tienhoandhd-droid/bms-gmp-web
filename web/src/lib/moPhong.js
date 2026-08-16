// moPhong.js — dữ liệu & thống kê chế độ DEMO + danh mục phạm vi (tách move-only từ App.jsx 17/08/2026).
import { Wind, AlertTriangle, HelpCircle, Cpu } from "lucide-react";
import { mulberry32, hashStr, pad } from "./dinhDang";

/* ============ TELEMETRY 8H ============ */
export const RAW = new Map();
export const ROOM_BIAS = { "C4.R7": -2.6, "C1.R11": -1.7, "C4.R1": -0.9, "Q2.R8": -0.2, "C1.R5": 0.7 };
export function rawSeries(roomId, k) {
  const key = roomId + "|" + k; if (RAW.has(key)) return RAW.get(key);
  const rand = mulberry32(hashStr(key)); const bias = k === "DP" ? (ROOM_BIAS[roomId] || 0) : 0;
  const center = (k === "DP" ? 13.4 : k === "RH" ? 49 : 21.3) + bias; const amp = k === "DP" ? 3.0 : k === "RH" ? 7 : 2.0;
  const arr = []; const now = Date.now();
  for (let i = 479; i >= 0; i--) { const t = now - i * 60000; const drift = Math.sin((479 - i) / 50) * amp * 0.6; arr.push({ t, v: +(center + drift + (rand() - 0.5) * amp).toFixed(1) }); }
  RAW.set(key, arr); return arr;
}
export function sensorStats(roomId, sensor, isLive = false) {
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
export function sensorLevel(stat, cfg) {
  // Khớp đúng thang của rpc_xu_ly_du_lieu_phong_hang_gio (chỉ dùng ở chế độ DEMO).
  // OOS 1 giờ ≤ nguong_canh_bao → Kiểm soát tốt.
  // Vượt ngưỡng: 10 phút cuối ≥ nguong_hanh_dong → Cảnh báo; ngược lại → Chú ý (theo dõi).
  if (stat.oos1h <= cfg.warn) return 0;
  return (stat.err10 != null && stat.err10 >= cfg.action) ? 3 : 1;
}
export function roomLevel(room, cfg) { if (room.noData) return -1; if (room._isLive) return room._level == null ? -1 : room._level; let lvl = 0; room.sensors.forEach((s) => { lvl = Math.max(lvl, sensorLevel(sensorStats(room.id, s), cfg)); }); return lvl; }
export function roomCompliance(room) { if (room.noData || !room.sensors.length) return null; if (room._isLive) return room._compliance; const m = Math.max(...room.sensors.map((s) => sensorStats(room.id, s).oos1h / 60)); return Math.round(100 - m * 100); }
export function roomHourlyOOS(room) { if (room.noData || !room.sensors.length) return []; if (room._isLive) return room._hourlyOOS || []; const base = sensorStats(room.id, room.sensors[0]).hourly8.map((h) => ({ label: h.label, oos: 0 })); room.sensors.forEach((s) => sensorStats(room.id, s).hourly8.forEach((h, i) => { if (base[i]) base[i].oos += h.oos; })); return base; }

/* ============ XU HƯỚNG (90 ngày) ============ */
export function genDaily(s) { const rand = mulberry32(s.seed * 7919); const out = []; const today = new Date(); today.setHours(0, 0, 0, 0); const decline = s.type === "ROOM" && s.priority === 1 ? -7 : s.type === "AHU" && s.base < 75 ? -5 : 2; for (let i = 89; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); const wave = Math.sin((89 - i) / 9) * s.vol * 0.55; const drift = ((89 - i) / 89) * decline; let comp = Math.max(34, Math.min(99.4, s.base + wave + drift + (rand() - 0.5) * s.vol)); const dq = Math.max(62, Math.min(100, 94 + (rand() - 0.5) * 10)); const deficit = Math.max(0, 95 - comp); out.push({ date: d, compliance: +comp.toFixed(1), dq: +dq.toFixed(1), warnH: +Math.max(0, deficit * 0.22 + (rand() - 0.35)).toFixed(1), critH: +Math.max(0, deficit * 0.16 + (rand() - 0.6) * 0.8).toFixed(1) }); } return out; }
export function genHourly(s) { const rand = mulberry32(s.seed * 104729); const out = []; const now = new Date(); for (let h = 23; h >= 0; h--) { const t = new Date(now); t.setHours(now.getHours() - h, 0, 0, 0); const wave = Math.sin(h / 4) * s.vol * 0.4; let comp = Math.max(34, Math.min(99.4, s.base + wave + (rand() - 0.5) * s.vol * 0.8)); const deficit = Math.max(0, 95 - comp); out.push({ date: t, compliance: +comp.toFixed(1), dq: Math.min(100, 90 + rand() * 9), warnH: +Math.max(0, deficit * 0.02).toFixed(2), critH: +Math.max(0, deficit * 0.012).toFixed(2) }); } return out; }
export const SCOPES = [
  { type: "TOTAL", id: "ALL", name: "Toàn hệ thống", base: 84, vol: 7, seed: 1 },
  { type: "AREA", id: "C1", name: "Khu C1", base: 88, vol: 6, seed: 2 }, { type: "AREA", id: "C4", name: "Khu C4", base: 74, vol: 10, seed: 3 }, { type: "AREA", id: "Q2", name: "Khu Q2", base: 93, vol: 4, seed: 4 },
  { type: "AHU", id: "AHU-K01", name: "AHU-K01", area: "C4", base: 69, vol: 11, seed: 5 }, { type: "AHU", id: "AHU03", name: "AHU03", area: "C1", base: 80, vol: 8, seed: 6 }, { type: "AHU", id: "AHU01", name: "AHU01", area: "C1", base: 90, vol: 5, seed: 7 }, { type: "AHU", id: "AHU02", name: "AHU02", area: "C1", base: 92, vol: 4, seed: 8 }, { type: "AHU", id: "AHU04", name: "AHU04", area: "Q2", base: 95, vol: 3, seed: 9 }, { type: "AHU", id: "AHU-K02", name: "AHU-K02", area: "C4", base: 86, vol: 6, seed: 10 },
  { type: "ROOM", id: "C4.R7", name: "Chiết rót", area: "C4", ahu: "AHU-K01", priority: 1, base: 55, vol: 13, seed: 11 }, { type: "ROOM", id: "C1.R11", name: "Pha chế", area: "C1", ahu: "AHU03", priority: 1, base: 63, vol: 11, seed: 12 }, { type: "ROOM", id: "C4.R1", name: "Thay đồ", area: "C4", ahu: "AHU-K01", priority: 1, base: 70, vol: 9, seed: 13 }, { type: "ROOM", id: "Q2.R8", name: "Khu Q2 — Chiết", area: "Q2", ahu: "AHU04", priority: 2, base: 81, vol: 8, seed: 14 }, { type: "ROOM", id: "C1.R5", name: "Phòng sạch chung", area: "C1", ahu: "AHU02", priority: 2, base: 93, vol: 4, seed: 15 },
];
export const MASTER = SCOPES.map((s) => { const daily = genDaily(s); const last7 = daily.slice(-7); const latest = daily[daily.length - 1]; return { ...s, daily, latest, risk: Math.round((100 - latest.compliance) + last7.reduce((a, r) => a + r.critH, 0)) }; });
export const byType = (t) => MASTER.filter((m) => m.type === t).sort((a, b) => b.risk - a.risk);
export const findScope = (id) => MASTER.find((m) => m.id === id);
export const RANGES = [{ k: "1n", label: "24 giờ", days: 1 }, { k: "7n", label: "7 ngày", days: 7 }, { k: "30n", label: "30 ngày", days: 30 }, { k: "90n", label: "90 ngày", days: 90 }, { k: "180n", label: "180 ngày", days: 180 }];
export const SENSORS = [{ k: "ALL", label: "Tổng hợp" }, { k: "DP", label: "Chênh áp" }, { k: "RH", label: "Độ ẩm" }, { k: "T", label: "Nhiệt độ" }];
export const SCOPE_LEVELS = [{ k: "TOTAL", label: "Tổng" }, { k: "AREA", label: "Khu vực" }, { k: "AHU", label: "AHU" }, { k: "ROOM", label: "Phòng" }];
export function applySensor(row, sensor) { if (sensor === "ALL") return row; const shift = { DP: -5, RH: 1, T: 4 }[sensor] || 0; const factor = { DP: 1.5, RH: 1.0, T: 0.6 }[sensor] || 1; return { ...row, compliance: +Math.max(30, Math.min(99.4, row.compliance + shift)).toFixed(1), warnH: +(row.warnH * factor).toFixed(2), critH: +(row.critH * factor).toFixed(2) }; }
export function getSeries(scope, sensor, rangeKey) {
  if (!scope) return [];
  const isHour = rangeKey === "1n";
  const base = isHour ? genHourly(scope) : scope.daily.slice(-RANGES.find((r) => r.k === rangeKey).days);
  return base.map((r0, i) => { const a = applySensor(r0, sensor); const comp = a.compliance; const label = isHour ? `${pad(a.date.getHours())}:00` : `${pad(a.date.getDate())}/${pad(a.date.getMonth() + 1)}`; return { label, ts: a.date.getTime(), comp, dq: Math.round(a.dq), warnH: a.warnH, critH: a.critH, alert: +(a.warnH + a.critH).toFixed(2), oos: Math.max(0, Math.round((90 - comp) / 5 + Math.sin(i) * 0.6)) }; });
}

/* ============ PHÒNG ============ */
export const AREAS = ["C1", "C4", "Q2"];
export const AHUS = ["AHU01", "AHU02", "AHU03", "AHU04", "AHU-K01", "AHU-K02"];
export function defSensors(priority) { return [{ k: "DP", min: priority === "P1" ? 12.5 : priority === "P2" ? 10 : 8, max: 30 }, { k: "RH", min: 30, max: priority === "P3" ? 60 : 55 }, { k: "T", min: 18, max: priority === "P3" ? 25 : 24 }]; }
export const ROOM_SEED = [
  { id: "C4.R7", name: "Chiết rót", area: "C4", ahu: "AHU-K01", priority: "P1", note: "Khu vô trùng trọng yếu" },
  { id: "C1.R11", name: "Pha chế", area: "C1", ahu: "AHU03", priority: "P1", note: "" },
  { id: "C4.R1", name: "Thay đồ", area: "C4", ahu: "AHU-K01", priority: "P1", note: "" },
  { id: "C1.R14", name: "Hành lang", area: "C1", ahu: "AHU01", priority: "P3", note: "Sensor đang lỗi", noData: true },
  { id: "Q2.R8", name: "Khu Q2 — Chiết", area: "Q2", ahu: "AHU04", priority: "P2", note: "" },
  { id: "C1.R5", name: "Phòng sạch chung", area: "C1", ahu: "AHU02", priority: "P2", note: "" },
];
export const INITIAL_ROOMS = ROOM_SEED.map((r) => ({ ...r, noData: !!r.noData, sensors: r.noData ? [] : defSensors(r.priority) }));

export const INCIDENTS0 = [
  { id: "SC-1042", room: "C4.R7", sensor: "Chênh áp (DP)", priority: "P1", start: "2026-05-29 06:12:04", duration: 7.1, status: "Chưa xử lý", silenced: false, trail: [{ t: "06:12:04", who: "Hệ thống", act: "Chênh áp nghiêm trọng (9.1 Pa < 12.5 Pa) — AHU-K01" }] },
  { id: "SC-1041", room: "C1.R11", sensor: "Chênh áp (DP)", priority: "P1", start: "2026-05-29 06:08:11", duration: 7.2, status: "Chưa xử lý", silenced: false, trail: [{ t: "06:08:11", who: "Hệ thống", act: "Chênh áp nghiêm trọng (10.3 Pa) — AHU03" }] },
  { id: "SC-1038", room: "C4.R1", sensor: "Chênh áp (DP)", priority: "P1", start: "2026-05-29 04:42:30", duration: 4.8, status: "IPC: bất thường", silenced: false, trail: [{ t: "04:42:30", who: "Hệ thống", act: "Chênh áp cảnh báo (11.8 Pa)" }, { t: "10:18:02", who: "Nam (IPC)", act: "Kiểm tra hiện trường, xác nhận bất thường" }] },
  { id: "SC-1035", room: "C1.R20", sensor: "Độ ẩm (RH)", priority: "P1", start: "2026-05-29 03:36:09", duration: 3.6, status: "Cơ điện đang xử lý", silenced: false, trail: [{ t: "03:36:09", who: "Hệ thống", act: "Độ ẩm cảnh báo (56.9%)" }, { t: "04:20:40", who: "Tuấn (MEP)", act: "Tiếp nhận, kiểm tra bộ hút ẩm AHU03" }] },
  { id: "SC-1030", room: "Q2.R8", sensor: "Chênh áp (DP)", priority: "P2", start: "2026-05-29 03:00:00", duration: 3.0, status: "Đã báo cơ điện", silenced: false, trail: [{ t: "03:12:18", who: "Nam (IPC)", act: "Xác nhận bất thường — báo cơ điện AHU04" }] },
  { id: "SC-1028", room: "C1.R14", sensor: "Thiếu dữ liệu", priority: "P3", start: "2026-05-29 00:05:00", duration: 6.1, status: "IPC: bất thường", silenced: true, trail: [{ t: "00:05:00", who: "Hệ thống", act: "Sensor mất tín hiệu — DQ < 80%" }] },
];
export const SYSTEM_ALERTS = [
  { icon: Wind, kind: "critical", text: "Sensor C4.R7 mất tín hiệu ~12 phút", sub: "Kiểm tra đường truyền FMS" },
  { icon: AlertTriangle, kind: "warning", text: "5 sự cố chưa được IPC tiếp nhận", sub: "Cần xử lý trong giờ" },
  { icon: HelpCircle, kind: "warning", text: "1 phòng thiếu dữ liệu (DQ < 80%)", sub: "C1.R14" },
  { icon: Cpu, kind: "normal", text: "Workflow chạy lúc 13:05 — thành công", sub: "Rollup theo giờ" },
];
export const SOP = [{ sop: "SOP-HVAC-005", apply: "Chênh áp phòng sạch", dev: "Không", capa: "Không" }, { sop: "SOP-HVAC-008", apply: "Xử lý mất áp Grade A/B", dev: "Có — DEV-2026-014", capa: "Đang mở" }, { sop: "PIC/S Annex 1", apply: "Tiêu chuẩn vô trùng", dev: "—", capa: "—" }];
