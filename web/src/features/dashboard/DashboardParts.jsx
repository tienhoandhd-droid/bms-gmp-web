// DashboardParts.jsx — thẻ phòng, modal chi tiết/KPI, quản lý phòng (tách move-only từ App.jsx 17/08/2026).
import React, { useMemo, useState } from "react";
import { Activity, AlertOctagon, AlertTriangle, Building2, CheckCircle2, ChevronRight, Clock, Eye, HelpCircle, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Card, MucBadge, SectionTitle } from "../../components/ui/Card";
import Chart from "../../components/ui/Chart";
import InspectorDrawer from "../../components/layout/InspectorDrawer";
import { OosMiniBars } from "../../components/ui/KpiCard";
import { COLOR } from "../../lib/designTokens";
import { AHUS, AREAS, roomCompliance, roomHourlyOOS, roomLevel, sensorLevel, sensorStats } from "../../lib/moPhong";
import { DS_KHU } from "../../lib/phanQuyen";
import { LEVELS, MUC, SENSOR_META, levelGlyph } from "../../lib/uiConst";
// Bảng 5 cột theo sensor + cột OOS 8h — Phase B (báo cáo 9): tách khỏi thẻ phòng,
// dùng trong drawer "Xem chi tiết" (RoomDetailModal) và RoomCard cũ.
export function BangSensorPhong({ room, cfg }) {
  if (room.noData) return null;
  return (
        <div className="mt-3 rounded-2xl bg-subtle ring-1 ring-line/70 overflow-hidden">
          <div className="grid grid-cols-5 px-3 py-1.5 text-[12px] uppercase tracking-wide text-muted font-semibold border-b border-line/70"><span>Chỉ tiêu</span><span className="text-center">Hiện tại</span><span className="text-center">TB 1h</span><span className="text-center">OOS 1h</span><span className="text-center">10′</span></div>
          {room.sensors.map((s) => { const st = sensorStats(room.id, s, room._isLive); const lvl = st.khongCoDL ? -1 : ((s._live && s._live.level != null) ? s._live.level : sensorLevel(st, cfg)); const noDL = lvl < 0; const dotCls = noDL ? "bg-subtle" : LEVELS[lvl].dot; const lblMuc = st.khongCoDL ? "Chưa có dữ liệu" : (noDL ? "Cảm biến đứng tín hiệu" : LEVELS[lvl].label); return (
            <div key={s.k} className="grid grid-cols-5 items-center px-3 py-2 text-[12px] border-b border-line/50 last:border-0">
              <span className="flex items-center gap-1.5 text-body font-medium">{s.k}<span title={lblMuc} aria-label={lblMuc} className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[12px] leading-none font-bold text-white ${dotCls}`}>{levelGlyph(lvl)}</span></span>
              {noDL ? <span className="col-span-4 text-center text-[12px] text-muted italic">{st.khongCoDL ? "chưa có dữ liệu" : "cảm biến đứng tín hiệu — số đo không dùng được"}</span> : (<>
              <span className="text-center tabular-nums font-semibold" style={{ color: "var(--text-strong)" }}>{st.cur}<span className="text-[12px] text-muted">{SENSOR_META[s.k].unit}</span></span>
              <span className="text-center tabular-nums text-muted">{st.avg1h}</span>
              <span className={`text-center tabular-nums font-medium ${st.oos1h > cfg.warn ? (st.err10 >= cfg.action ? "text-danger" : "text-info") : "text-muted"}`}>{st.oos1h}/60</span>
              <span className={`text-center tabular-nums font-medium ${st.err10 != null && st.err10 >= cfg.action ? "text-danger" : "text-muted"}`}>{st.err10 == null ? "—" : `${st.err10}/10`}</span>
              </>)}
            </div>
          ); })}
        </div>
  );
}
export function OosTheoGio8h({ room }) {
  if (room.noData) return null;
  const oos8 = roomHourlyOOS(room); const tong8 = oos8.reduce((a, h) => a + (h.oos || 0), 0);
  return <div className="mt-3"><div className="flex items-center justify-between"><span className="text-[12px] uppercase tracking-wider text-muted font-medium">Điểm OOS theo giờ — 8h</span>{oos8.length > 0 && tong8 === 0 && <span className="text-[12px] text-success font-medium">0 điểm OOS · đạt</span>}</div>{oos8.length === 0 ? <p className="text-[12px] text-muted italic py-3 text-center">chưa có dữ liệu 8h</p> : <OosMiniBars data={oos8} h={70} />}</div>;
}

/* ===== THẺ PHÒNG =====
   Memo: chỉ render lại khi room/cfg/incident đổi THAM CHIẾU (đều là state/phần tử state —
   identity ổn định giữa 2 nhịp làm mới). Prop hàm (onDetail/onIncident) bỏ qua identity:
   hành vi không đổi giữa render, tránh 58 thẻ re-render mỗi lần bấm nút bất kỳ. */
const RoomCard = React.memo(function RoomCard({ room, cfg, onDetail, onIncident, incident }) {
  const lvl = roomLevel(room, cfg); const comp = roomCompliance(room); const failing = comp != null && comp < 80; const lm = lvl < 0 ? null : LEVELS[lvl];
  return (
    <Card className="p-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="text-[15px] font-semibold truncate" style={{ color: "var(--text-strong)" }}>{room.name}</h3><MucBadge p={room.priority} /></div><p className="text-[12px] text-muted mt-0.5 tracking-wide truncate">{room.id} · Khu {room.area} · {room.ahu}</p>{room.lastSeen && (() => { const a = room.agePhut; const tone = a == null ? "text-muted bg-subtle" : a <= 75 ? "text-success bg-success-soft" : a <= 150 ? "text-warning bg-warning-soft" : "text-danger bg-danger-soft"; const txt = a == null ? "—" : a < 60 ? `${a}′ trước` : `${(a / 60).toFixed(1)}h trước`; return <p className="text-[12px] text-muted mt-0.5 flex items-center gap-1 flex-wrap"><Clock className="w-3 h-3 shrink-0" strokeWidth={1.8} /> Cập nhật lúc <span className="tabular-nums text-body font-medium">{room.lastSeen}</span>{room.window && <span className="text-muted">· khung {room.window}</span>} <span className={`px-1.5 py-0.5 rounded-full font-semibold ${tone}`}>{txt}</span></p>; })()}</div>
        <div className="text-right shrink-0">{room.duLieuCu ? <span title={room.lastSeen ? `FMS chưa trả dữ liệu giờ này. Mốc cuối: ${room.lastSeen}` : "FMS chưa trả dữ liệu giờ gần nhất"} className="inline-flex items-center gap-1 text-warning text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Thiếu dữ liệu giờ này</span> : room.noData ? <span className="inline-flex items-center gap-1 text-warning text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Mất dữ liệu</span> : comp == null ? <span className="inline-flex items-center gap-1 text-muted text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Chưa có dữ liệu</span> : (<><p className={`text-2xl font-light tabular-nums ${failing ? "text-danger" : "text-success"}`}>{comp}%</p><p className="text-[12px] text-muted">tỷ lệ đạt 1h</p></>)}</div>
      </div>

      {lm && <div className={`mt-3 rounded-2xl px-3 py-2 ring-1 ${lm.bg} ${lm.ring} flex items-center justify-between`}><span className="flex items-center gap-2 text-[12px] font-semibold"><span className={`w-2 h-2 rounded-full ${lm.dot}`} /><span className={lm.txt}>Mức cảnh báo: {lm.label}</span></span><span className="text-[12px] text-muted">8h</span></div>}

      <BangSensorPhong room={room} cfg={cfg} />
      <OosTheoGio8h room={room} />
      {room.note && <p className="mt-3 text-[12px] text-muted bg-info-soft/60 ring-1 ring-info-line rounded-xl px-3 py-2">📝 {room.note}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => onDetail(room)} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-info bg-info-soft hover:bg-info-soft rounded-xl py-2 ring-1 ring-info-line transition"><Eye className="w-3.5 h-3.5" strokeWidth={1.8} /> Xem chi tiết</button>
        {incident ? <button onClick={() => onIncident(room)} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-danger bg-danger-soft hover:bg-danger-soft rounded-xl py-2 ring-1 ring-danger-line transition" title={`Sự cố ${incident.id} · ${incident.status}`}><AlertOctagon className="w-3.5 h-3.5" strokeWidth={1.8} /> Sự cố {incident.id} <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} /></button>
          : failing ? <span className="flex-1 flex items-center justify-center gap-1.5 text-[12px] text-warning bg-warning-soft rounded-xl py-2 ring-1 ring-warning-line"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.8} /> Không đạt — chưa mở sự cố</span> : null}
      </div>
    </Card>
  );
}, (t, s) => t.room === s.room && t.cfg === s.cfg && t.incident === s.incident);


function RoomDetailModal({ room, cfg, onClose }) {
  return (
    <InspectorDrawer onClose={onClose} eyebrow={`Khu ${room.area} · ${room.ahu} · ${MUC[room.priority]}`} title={`${room.id} — ${room.name}`}>
      {cfg && <BangSensorPhong room={room} cfg={cfg} />}
      <OosTheoGio8h room={room} />
        <div className="space-y-4">{room.noData ? <p className="text-warning text-sm">Phòng đang thiếu dữ liệu — không có cảm biến hoạt động.</p> : room.sensors.map((s) => { const st = sensorStats(room.id, s, room._isLive); const noDL = st.khongCoDL; const pts = st.hourly8 || []; const mean = pts.length ? +(pts.reduce((a, p) => a + (p.avg ?? 0), 0) / pts.length).toFixed(1) : null; const unit = SENSOR_META[s.k].unit; return (
          <div key={s.k} className="rounded-2xl bg-subtle ring-1 ring-line/70 p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{SENSOR_META[s.k].label} ({s.k})</p><p className="text-[12px] text-muted">Giới hạn: {s.min != null ? `≥ ${s.min}` : "—"}{s.max != null ? ` · ≤ ${s.max}` : ""} {unit}</p></div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-2 text-center">{[["Hiện tại", `${st.cur ?? "—"} ${unit}`], ["TB 1h", `${st.avg1h ?? "—"}`], ["TB 8h", mean == null ? "—" : `${mean}`], ["OOS 1h", st.oos1h == null ? "—" : `${st.oos1h}/60`], ["OOS 10′ cuối", st.err10 == null ? "—" : `${st.err10}/10`]].map(([k, v]) => <div key={k} className="rounded-xl bg-surface ring-1 ring-line py-1.5"><p className="text-[12px] uppercase text-muted font-semibold leading-tight">{k}</p><p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--text-strong)" }}>{v}</p></div>)}</div>
            {noDL ? <div className="h-[142px] flex items-center justify-center text-center px-4 text-[12px] text-muted italic rounded-xl bg-surface ring-1 ring-line">Chưa có dữ liệu thật cho cảm biến này — được cấu hình nhưng FMS chưa gửi số liệu.</div> : <Chart type="roomDetail" pts={pts} smin={s.min} smax={s.max} mean={mean} unit={unit} group={`rm-${room.id}`} h={182} />}
            {!noDL && <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-muted"><span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: "var(--primary-solid)", opacity: 0.3 }} /> Khoảng đạt (GHD–GHT)</span><span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: "var(--info-solid)", opacity: 0.45 }} /> Dải min–max theo giờ</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--primary-solid)" }} /> trong khoảng</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--danger-solid)" }} /> ngoài khoảng</span><span className="flex items-center gap-1"><span className="w-4 inline-block border-t-2 border-dashed" style={{ borderColor: "var(--anchor)" }} /> Trung bình 8h</span></div>}
          </div>
        ); })}</div>
    </InspectorDrawer>
  );
}


function KpiListModal({ kind, groups, incidents, cfg, onClose, onPickRoom, onPickIncident, onGotoIncidents }) {
  const META = {
    dat:   { title: "Phòng đạt", desc: "Tỷ lệ đạt ≥ 80% trong 1 giờ gần nhất", color: "var(--primary)", grad: "#E6F4F1", Icon: CheckCircle2 },
    khong: { title: "Phòng không đạt", desc: "Tỷ lệ đạt < 80% — nên kiểm tra ngay", color: "var(--danger)", grad: "#FBE9E4", Icon: AlertTriangle },
    thieu: { title: "Thiếu dữ liệu", desc: "Mất tín hiệu hoặc dữ liệu quá cũ — không coi là đạt", color: "var(--warning)", grad: "#FBF1DE", Icon: HelpCircle },
    p1:    { title: "Sự cố Nghiêm trọng đang mở", desc: "Phòng trọng yếu & quan trọng — ưu tiên xử lý", color: "var(--info)", grad: "#E6F1FA", Icon: Activity },
  }[kind];
  const isP1 = kind === "p1";
  const rooms = isP1 ? [] : (groups[kind] || []);
  const ageTone = (a) => a == null ? "text-muted bg-subtle" : a <= 90 ? "text-success bg-success-soft" : a <= 240 ? "text-warning bg-warning-soft" : "text-danger bg-danger-soft";
  const ageTxt = (a) => a == null ? "—" : a === 0 ? "mới nhất" : a < 60 ? `${a}′ trước` : `trễ ${(a / 60).toFixed(1)}h`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(30,58,86,0.28)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-surface ring-1 ring-line overflow-hidden max-h-[85vh] flex flex-col" style={{ boxShadow: "0 30px 80px -20px rgba(30,58,86,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 flex items-start justify-between" style={{ background: "var(--bg-subtle)" }}>
          <div className="flex items-start gap-3">
            <div className="rounded-2xl p-2.5" style={{ background: "#fff", boxShadow: "0 4px 14px -6px rgba(30,58,86,0.3)" }}><META.Icon className="w-5 h-5" style={{ color: META.color }} strokeWidth={1.9} /></div>
            <div><h2 className="text-base font-semibold" style={{ color: "var(--text-strong)" }}>{META.title}</h2><p className="text-[12px] text-muted mt-0.5 max-w-xs">{META.desc}</p></div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-surface/70 text-muted"><X className="w-4 h-4" strokeWidth={1.8} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          {isP1 ? (
            incidents.length === 0 ? <p className="text-center text-[13px] text-muted py-8">Không có sự cố Nghiêm trọng nào đang mở. 🎉</p> : (
              <div className="space-y-2">
                {incidents.map((i) => { const laP1 = i.priority === "P1"; return (
                  <button key={i.id} onClick={() => onPickIncident(i)} className={`w-full text-left rounded-2xl ring-1 border-l-[6px] px-4 py-3 transition duration-150 flex items-center justify-between gap-3 ${laP1 ? "ring-danger-line border-danger bg-danger-soft/30 hover:ring-danger-line hover:bg-danger-soft/60" : "ring-warning-line border-warning bg-warning-soft/30 hover:ring-warning-line hover:bg-warning-soft/60"}`}>
                    <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>{i.id}</span><span className="text-[12px] px-2 py-0.5 rounded-full font-bold text-white bg-danger-solid">Nghiêm trọng</span>{!laP1 && <span className="ml-1 text-[12px] text-muted">quan trọng</span>}</div><p className="text-[12px] text-body mt-0.5 truncate">{i.room} · {i.sensor || "—"} · {i.status}</p></div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${laP1 ? "text-rose-300" : "text-amber-300"}`} strokeWidth={1.8} />
                  </button>
                ); })}
                <button onClick={onGotoIncidents} className="w-full mt-1 rounded-2xl py-2.5 text-[12px] font-semibold text-white transition" style={{ background: "var(--primary-solid)" }}>Mở trang Sự cố để xử lý →</button>
              </div>
            )
          ) : (
            rooms.length === 0 ? <p className="text-center text-[13px] text-muted py-8">Không có phòng nào trong nhóm này.</p> : (
              <div className="space-y-2">
                {rooms.map((r) => { const comp = roomCompliance(r); const lvl = roomLevel(r, cfg); const lm = lvl < 0 ? null : LEVELS[lvl]; return (
                  <button key={r.id} onClick={() => onPickRoom(r)} className="w-full text-left rounded-2xl ring-1 ring-line hover:ring-success-line hover:bg-success-soft/40 px-4 py-3 transition flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="text-[13px] font-semibold truncate" style={{ color: "var(--text-strong)" }}>{r.name}</span><MucBadge p={r.priority} /></div>
                      <p className="text-[12px] text-muted mt-0.5 truncate">{r.id} · Khu {r.area} · {r.ahu}</p>
                      <div className="flex items-center gap-1.5 mt-1">{lm && <span className={`text-[12px] px-1.5 py-0.5 rounded-full font-semibold ${lm.bg} ${lm.txt} ring-1 ${lm.ring}`}>{lm.label}</span>}{r.lastSeen && <span className={`text-[12px] px-1.5 py-0.5 rounded-full font-semibold ${ageTone(r.agePhut)}`}>{ageTxt(r.agePhut)}</span>}</div>
                    </div>
                    <div className="text-right shrink-0">{comp == null ? <span className="text-[12px] text-muted font-semibold">— %</span> : <p className={`text-xl font-light tabular-nums ${comp < 80 ? "text-danger" : "text-success"}`}>{comp}%</p>}<ChevronRight className="w-4 h-4 text-muted ml-auto mt-0.5" strokeWidth={1.8} /></div>
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
  const locChip = (v, label, on, click) => <button key={v} onClick={click} className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ring-1 ${on ? "text-white ring-transparent" : "text-body bg-surface ring-line hover:ring-success-line"}`} style={on ? { backgroundColor: "var(--primary-solid)" } : {}}>{label}</button>;
  const submit = () => {
    const id = f.id.trim(); if (!id) return alert("Nhập mã phòng (vd C1.R09)"); if (rooms.some((r) => r.id === id)) return alert("Mã phòng đã tồn tại");
    const sensors = f.noData ? [] : [f.DP && { k: "DP", min: Number(f.DPmin), max: Number(f.DPmax) }, f.RH && { k: "RH", min: Number(f.RHmin), max: Number(f.RHmax) }, f.T && { k: "T", min: Number(f.Tmin), max: Number(f.Tmax) }].filter(Boolean);
    onAdd({ id, name: f.name || id, area: f.area, ahu: f.ahu, priority: f.priority, note: f.note, noData: f.noData, sensors }); setF(blank); setOpen(false);
  };
  const inp = "rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-[13px] text-body outline-none focus:ring-2 focus:ring-success-line";
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
        {canManage ? <button onClick={() => { if (editId && soThayDoi > 0 && !window.confirm("Bỏ các thay đổi chưa lưu?")) return; setOpen((o) => !o); setEditId(null); setDraft(null); }} className="text-xs font-medium text-white rounded-xl px-3.5 py-2 flex items-center gap-1.5" style={{ backgroundColor: "var(--danger-solid)" }}><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Thêm phòng</button> : <span className="text-[12px] text-muted">Cần quyền QA/Quản trị để chỉnh sửa</span>}
      </div>

      {open && canManage && (
        <div className="mt-4 rounded-2xl bg-info-soft/60 ring-1 ring-info-line p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1"><label className="text-[12px] uppercase text-muted font-semibold">Mã phòng</label><input className={inp} value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} placeholder="C1.R09" /></div>
            <div className="flex flex-col gap-1 col-span-2"><label className="text-[12px] uppercase text-muted font-semibold">Tên phòng</label><input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Phòng cân" /></div>
            <div className="flex flex-col gap-1"><label className="text-[12px] uppercase text-muted font-semibold">Khu</label><select className={inp} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-[12px] uppercase text-muted font-semibold">AHU</label><select className={inp} value={f.ahu} onChange={(e) => setF({ ...f, ahu: e.target.value })}>{AHUS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-[12px] uppercase text-muted font-semibold">Mức ưu tiên</label><select className={inp} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="P1">Mức 1</option><option value="P2">Mức 2</option><option value="P3">Mức 3</option></select></div>
          </div>
          <div className="rounded-xl bg-surface ring-1 ring-line p-3">
            <p className="text-[12px] uppercase text-muted font-semibold mb-2">Chọn loại cảm biến & giới hạn (min – max)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-1.5 text-[12px] text-body rounded-lg bg-subtle px-2 py-2"><input type="checkbox" checked={f.DP} onChange={(e) => setF({ ...f, DP: e.target.checked })} /> DP <input type="number" className="w-12 rounded ring-1 ring-line px-1 py-0.5" value={f.DPmin} onChange={(e) => setF({ ...f, DPmin: e.target.value })} />–<input type="number" className="w-12 rounded ring-1 ring-line px-1 py-0.5" value={f.DPmax} onChange={(e) => setF({ ...f, DPmax: e.target.value })} /> Pa</label>
              <label className="flex items-center gap-1.5 text-[12px] text-body rounded-lg bg-subtle px-2 py-2"><input type="checkbox" checked={f.RH} onChange={(e) => setF({ ...f, RH: e.target.checked })} /> RH <input type="number" className="w-12 rounded ring-1 ring-line px-1 py-0.5" value={f.RHmin} onChange={(e) => setF({ ...f, RHmin: e.target.value })} />–<input type="number" className="w-12 rounded ring-1 ring-line px-1 py-0.5" value={f.RHmax} onChange={(e) => setF({ ...f, RHmax: e.target.value })} /> %</label>
              <label className="flex items-center gap-1.5 text-[12px] text-body rounded-lg bg-subtle px-2 py-2"><input type="checkbox" checked={f.T} onChange={(e) => setF({ ...f, T: e.target.checked })} /> T <input type="number" className="w-12 rounded ring-1 ring-line px-1 py-0.5" value={f.Tmin} onChange={(e) => setF({ ...f, Tmin: e.target.value })} />–<input type="number" className="w-12 rounded ring-1 ring-line px-1 py-0.5" value={f.Tmax} onChange={(e) => setF({ ...f, Tmax: e.target.value })} /> °C</label>
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2"><div className="flex items-center gap-4"><label className="flex items-center gap-2 text-[12px] text-body"><input type="checkbox" checked={f.noData} onChange={(e) => setF({ ...f, noData: e.target.checked })} /> Thiếu dữ liệu</label><input className={inp + " w-56"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ghi chú (tuỳ chọn)" /></div><div className="flex gap-2"><button onClick={() => setOpen(false)} className="text-xs text-muted rounded-xl px-4 py-2 hover:bg-subtle">Hủy</button><button onClick={submit} className="text-xs font-medium text-white rounded-xl px-4 py-2" style={{ backgroundColor: "var(--primary-solid)" }}>Lưu phòng</button></div></div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.8} /><input value={qTim} onChange={(e) => setQTim(e.target.value)} placeholder="Tìm mã hoặc tên phòng…" className="w-full rounded-xl bg-surface ring-1 ring-line pl-9 pr-3 py-2 text-[12px] text-body outline-none focus:ring-2 focus:ring-success-line" />{qTim && <button onClick={() => setQTim("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-body"><X className="w-3.5 h-3.5" /></button>}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-semibold text-muted uppercase tracking-wider mr-1">Khu vực</span>
          {locChip("ALL", "Tất cả", locKhu === "ALL", () => { setLocKhu("ALL"); setLocAhu("ALL"); })}
          {DS_KHU.map((k) => locChip(k, `Khu ${k}`, locKhu === k, () => { setLocKhu(k); setLocAhu("ALL"); }))}
          {ahusLoc.length > 0 && (
            <select value={locAhu === "ALL" ? "ALL" : `${locKhu}|${locAhu}`} onChange={(e) => { const v = e.target.value; if (v === "ALL") { setLocAhu("ALL"); } else { const [k, a] = v.split("|"); setLocKhu(k); setLocAhu(a); } }} className="rounded-xl bg-surface ring-1 ring-line px-3 py-1.5 text-[12px] text-body outline-none ml-1">
              <option value="ALL">AHU: tất cả</option>
              {ahusLoc.map((p) => { const [k, a] = p.split("|"); return <option key={p} value={p}>{locKhu === "ALL" ? `Khu ${k} · ${a}` : a}</option>; })}
            </select>
          )}
        </div>
        <span className="text-[12px] text-muted ml-auto tabular-nums">{roomsHienThi.length}/{rooms.length} phòng</span>
      </div>
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-[13px]">
          <thead><tr className="text-muted text-left text-[12px] uppercase tracking-wider">{["Mã", "Tên", "Khu", "AHU", "Ưu tiên", "Loại DL", "Mức cảnh báo", ""].map((h) => <th key={h} className="py-2.5 pr-4 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {roomsHienThi.length === 0 ? <tr><td colSpan={8} className="py-6 text-center text-[12px] text-muted">Không có phòng khớp bộ lọc{locKhu !== "ALL" ? ` · Khu ${locKhu}` : ""}{locAhu !== "ALL" ? ` · ${locAhu}` : ""}{qTim.trim() ? ` · "${qTim.trim()}"` : ""}. <button onClick={() => { setLocKhu("ALL"); setLocAhu("ALL"); setQTim(""); }} className="text-success font-semibold underline">Bỏ lọc</button></td></tr> : roomsHienThi.map((r) => { const lvl = roomLevel(r, cfg); const lm = lvl < 0 ? null : LEVELS[lvl]; return (
              <tr key={r.id} className="border-t border-line hover:bg-info-soft/40 transition">
                <td className="py-2 pr-4 font-semibold" style={{ color: "var(--text-strong)" }}>{r.id}</td>
                <td className="py-2 pr-4 text-body">{r.name}</td>
                <td className="py-2 pr-4 text-muted">{r.area}</td>
                <td className="py-2 pr-4 text-muted">{r.ahu}</td>
                <td className="py-2 pr-4"><MucBadge p={r.priority} /></td>
                <td className="py-2 pr-4 text-muted">{r.noData ? "—" : r.sensors.map((s) => s.k).join(", ")}</td>
                <td className="py-2 pr-4">{lm ? <span className={`text-[12px] px-2 py-0.5 rounded-full ${lm.bg} ${lm.txt}`}>{lm.label}</span> : <span className="text-[12px] text-warning">Mất DL</span>}</td>
                <td className="py-2 pr-4">{canManage && <div className="flex gap-1.5"><button onClick={() => moSua(r)} className="text-info hover:text-info" title="Sửa phòng / cảm biến / giới hạn"><Pencil className="w-4 h-4" strokeWidth={1.8} /></button><button onClick={() => onDelete(r.id)} className="text-danger hover:text-danger"><Trash2 className="w-4 h-4" strokeWidth={1.8} /></button></div>}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>

      {editing && canManage && draft && (
        <div className="mt-4 rounded-2xl bg-success-soft/50 ring-1 ring-success-line p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-strong)" }}>Sửa phòng & cảm biến — {editing.id}{soThayDoi > 0 && <span className="ml-2 align-middle text-[12px] font-semibold text-warning bg-warning-soft ring-1 ring-warning-line rounded-full px-2 py-0.5">{soThayDoi} thay đổi chưa lưu</span>}</p>
            <button onClick={dongSua} className="text-muted hover:text-body"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1 col-span-2"><label className="text-[12px] uppercase text-muted font-semibold">Tên phòng</label><input className={inp} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="flex flex-col gap-1"><label className="text-[12px] uppercase text-muted font-semibold">Khu</label><select className={inp} value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-[12px] uppercase text-muted font-semibold">AHU</label><select className={inp} value={draft.ahu} onChange={(e) => setDraft({ ...draft, ahu: e.target.value })}>{[...new Set([draft.ahu, ...AHUS])].filter(Boolean).map((a) => <option key={a}>{a}</option>)}</select></div>
            <div className="flex flex-col gap-1"><label className="text-[12px] uppercase text-muted font-semibold">Mức ưu tiên</label><select className={inp} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}><option value="P1">Mức 1</option><option value="P2">Mức 2</option><option value="P3">Mức 3</option></select></div>
            <div className="flex flex-col gap-1"><label className="text-[12px] uppercase text-muted font-semibold">Ghi chú</label><input className={inp} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="(tuỳ chọn)" /></div>
          </div>
          {!editing.noData && (
            <div className="space-y-2 mt-3">
              {draft.sensors.map((s) => (
                <div key={s.k} className="rounded-xl bg-surface ring-1 ring-line px-3 py-2 flex items-center gap-2 text-[12px] flex-wrap">
                  <span className="font-semibold w-16" style={{ color: "var(--text-strong)" }}>{SENSOR_META[s.k].label}</span>
                  <span className="text-muted">min</span><input type="number" value={s.min ?? ""} onChange={(e) => doiGioiHan(s.k, "min", e.target.value)} className="w-16 rounded ring-1 ring-line px-1.5 py-0.5" />
                  <span className="text-muted">max</span><input type="number" value={s.max ?? ""} onChange={(e) => doiGioiHan(s.k, "max", e.target.value)} className="w-16 rounded ring-1 ring-line px-1.5 py-0.5" />
                  <span className="text-muted">{SENSOR_META[s.k].unit}</span>
                  <button onClick={() => setDraft((d) => ({ ...d, sensors: d.sensors.filter((x) => x.k !== s.k) }))} className="ml-auto text-danger hover:text-danger text-[12px] flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> bỏ</button>
                </div>
              ))}
              {["DP", "RH", "T"].filter((k) => !draft.sensors.some((s) => s.k === k)).length > 0 && (
                <div className="flex items-center gap-2 pt-1"><span className="text-[12px] text-muted">Thêm cảm biến:</span>{["DP", "RH", "T"].filter((k) => !draft.sensors.some((s) => s.k === k)).map((k) => <button key={k} onClick={() => setDraft((d) => ({ ...d, sensors: [...d.sensors, { k, ...SENSOR_DEFAULT[k] }] }))} className="text-[12px] rounded-lg px-2 py-1 ring-1 ring-success-line text-success bg-success-soft hover:bg-success-soft flex items-center gap-1"><Plus className="w-3 h-3" strokeWidth={2} /> {SENSOR_META[k].label}</button>)}</div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
            <p className="text-[12px] text-muted max-w-md">Thay đổi chỉ ghi vào hệ thống khi bấm <b>Lưu</b>. Giới hạn là <b>mốc so sánh gốc</b> — sau khi lưu, KPI, mức cảnh báo, thẻ phòng và báo cáo đều tính theo giá trị mới.</p>
            <div className="flex gap-2">
              <button onClick={dongSua} className="text-xs text-muted rounded-xl px-4 py-2 hover:bg-subtle">Hủy</button>
              <button onClick={luuSua} disabled={soThayDoi === 0 || dangLuu} className="text-xs font-medium text-white rounded-xl px-4 py-2 flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: "var(--primary-solid)" }}><Save className={`w-3.5 h-3.5 ${dangLuu ? "animate-pulse" : ""}`} strokeWidth={2} /> {dangLuu ? "Đang lưu…" : "Lưu thay đổi"}</button>
            </div>
          </div>
        </div>
      )}
      <p className="text-[12px] text-muted mt-3">Thay đổi sau khi <b>Lưu</b> cập nhật ngay KPI, thẻ phòng và được ghi vào <b>lịch sử thay đổi cấu hình</b> (tab Nhật ký &amp; SOP).</p>
    </Card>
  );
}


export { RoomCard, RoomDetailModal, KpiListModal, RoomManager };
