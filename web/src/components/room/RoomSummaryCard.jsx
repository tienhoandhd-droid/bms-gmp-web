// RoomSummaryCard.jsx — thẻ phòng tối giản cho Tổng quan (Phase B báo cáo 9).
// Bất thường: card đủ để ra quyết định (chỉ tiêu xấu nhất + tỷ lệ đạt + độ tươi).
// Đạt: MỘT dòng gọn, visual weight thấp — màn hình không phải chứng minh 51 thứ
// vẫn bình thường trong khi người trực đang tìm 3 thứ bất thường.
// Bảng sensor 5 cột + cột OOS 8h nằm trong drawer "Xem chi tiết" (không ở card).
import React from "react";
import { Eye, AlertOctagon, ChevronRight, Clock, HelpCircle } from "lucide-react";
import { Card, MucBadge } from "../ui/Card";
import { LEVELS, SENSOR_META } from "../../lib/uiConst";
import { roomLevel, roomCompliance, sensorStats, sensorLevel } from "../../lib/moPhong";

// Chỉ tiêu xấu nhất = sensor có mức cao nhất (hoà: OOS 1h nhiều hơn).
function chiTieuXauNhat(room, cfg) {
  if (room.noData || !room.sensors?.length) return null;
  let xau = null;
  room.sensors.forEach((s) => {
    const st = sensorStats(room.id, s, room._isLive);
    if (st.khongCoDL || st.cur == null) return;
    const lvl = (s._live && s._live.level != null) ? s._live.level : sensorLevel(st, cfg);
    const diem = (lvl < 0 ? 0 : lvl) * 1000 + (st.oos1h || 0);
    if (!xau || diem > xau.diem) xau = { s, st, lvl: Math.max(0, lvl), diem };
  });
  return xau;
}

export function laBatThuong(room, cfg, incident) {
  const lvl = roomLevel(room, cfg);
  const comp = roomCompliance(room);
  return !!(room.noData || room.duLieuCu || (comp != null && comp < 80) || lvl >= 2 || incident);
}

const tuoiTxt = (a) => (a == null ? null : a < 60 ? `${a}′ trước` : `${(a / 60).toFixed(1)}h trước`);

export const RoomSummaryCard = React.memo(function RoomSummaryCard({ room, cfg, onDetail, onIncident, incident }) {
  const lvl = roomLevel(room, cfg);
  const comp = roomCompliance(room);
  const failing = comp != null && comp < 80;
  const lm = lvl < 0 ? null : LEVELS[lvl];
  const tuoi = tuoiTxt(room.agePhut);

  if (!laBatThuong(room, cfg, incident)) {
    return (
      <div className="flex items-center gap-2 rounded-xl ring-1 ring-line bg-surface px-3.5 py-2 text-[13px]">
        <span className="font-semibold shrink-0" style={{ color: "var(--text-strong)" }}>{room.id}</span>
        <span className="text-success font-medium shrink-0">Đạt</span>
        <span className="text-muted truncate">· {room.ahu}{comp != null ? ` · ${comp}%` : ""}{tuoi ? ` · ${tuoi}` : ""}</span>
        <button onClick={() => onDetail(room)} className="ml-auto text-[12px] font-medium text-info hover:underline shrink-0">Xem</button>
      </div>
    );
  }

  const xau = chiTieuXauNhat(room, cfg);
  let huong = null;
  if (xau) {
    const { s, st } = xau;
    if (s.min != null && st.cur < s.min) huong = `↓ dưới ${s.min}`;
    else if (s.max != null && st.cur > s.max) huong = `↑ trên ${s.max}`;
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><h3 className="text-[15px] font-semibold truncate" style={{ color: "var(--text-strong)" }}>{room.id} · {room.name}</h3><MucBadge p={room.priority} /></div>
          <p className="text-[12px] text-muted mt-0.5">{room.ahu}</p>
        </div>
        <div className="text-right shrink-0">
          {room.duLieuCu ? <span className="inline-flex items-center gap-1 text-warning text-[12px] font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Thiếu dữ liệu giờ này</span>
            : room.noData ? <span className="inline-flex items-center gap-1 text-warning text-[12px] font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Thiếu dữ liệu</span>
            : comp == null ? <span className="inline-flex items-center gap-1 text-muted text-[12px] font-semibold"><HelpCircle className="w-3.5 h-3.5" strokeWidth={1.8} /> Chưa có dữ liệu</span>
            : <><p className={`text-2xl font-light tabular-nums ${failing ? "text-danger" : "text-success"}`}>{comp}%</p><p className="text-[12px] text-muted">tỷ lệ đạt 1h</p></>}
        </div>
      </div>

      {xau && (
        <div className={`mt-3 rounded-xl px-3.5 py-2.5 ring-1 ${lm ? `${lm.bg} ${lm.ring}` : "bg-subtle ring-line"} flex items-baseline justify-between gap-2`}>
          <span className="text-[12px] font-semibold uppercase tracking-wide text-muted">{SENSOR_META[xau.s.k].label}</span>
          <span className="text-right">
            <span className={`text-[18px] font-semibold tabular-nums ${lm ? lm.txt : "text-body"}`}>{xau.st.cur}<span className="text-[12px] font-normal">{SENSOR_META[xau.s.k].unit}</span></span>
            {huong && <span className={`ml-1.5 text-[12px] font-medium ${lm ? lm.txt : "text-muted"}`}>{huong}</span>}
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-muted">
        <span className="flex items-center gap-1 min-w-0 truncate"><Clock className="w-3 h-3 shrink-0" strokeWidth={1.8} />{tuoi ? `Cập nhật ${tuoi}` : room.lastSeen ? `Cập nhật ${room.lastSeen}` : "—"}</span>
        {lm && <span className={`shrink-0 font-medium ${lm.txt}`}>{lm.label}</span>}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={() => onDetail(room)} className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium text-info bg-info-soft rounded-xl py-2 ring-1 ring-info-line"><Eye className="w-3.5 h-3.5" strokeWidth={1.8} /> Xem chi tiết</button>
        {incident && <button onClick={() => onIncident(room)} className="flex-1 flex items-center justify-center gap-1.5 text-[13px] font-medium text-danger bg-danger-soft rounded-xl py-2 ring-1 ring-danger-line" title={`Phiếu ${incident.id} · ${incident.status}`}><AlertOctagon className="w-3.5 h-3.5" strokeWidth={1.8} /> Phiếu {incident.id} <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} /></button>}
      </div>
    </Card>
  );
}, (t, s) => t.room === s.room && t.cfg === s.cfg && t.incident === s.incident);
