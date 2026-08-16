// KpiCard.jsx — thẻ KPI + cột OOS mini (tách move-only từ App.jsx 17/08/2026).
import React from "react";
import { Eye } from "lucide-react";
import { Card } from "./Card";
import { COLOR } from "../../lib/designTokens";

export const KpiCard = React.memo(function KpiCard({ icon: Icon, label, value, total, sub, accent, onClick, loading }) {
  const clickable = typeof onClick === "function";
  return (
    <Card className={`relative p-6 overflow-hidden ${clickable ? "cursor-pointer transition hover:-translate-y-0.5 hover:ring-success-line" : ""}`}>
      {clickable ? <button onClick={onClick} className="absolute inset-0 z-10" aria-label={`Xem danh sách: ${label}`} /> : null}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${accent.glow} blur-2xl opacity-40`} />
      {/* Mảng 4: skeleton pulse khi CHƯA có số → không hiện "0" rồi nhảy (giảm CLS). */}
      <div className="relative flex items-start justify-between"><div><p className="text-[12px] uppercase tracking-[0.1em] text-muted font-semibold">{label}</p>{loading ? <div className="mt-3 h-[3rem] w-20 rounded-lg bg-subtle animate-pulse" /> : <p className="mt-3 text-5xl font-light tabular-nums leading-none" style={{ color: "var(--text-strong)" }}>{value}{total != null && <span className="text-xl text-muted font-light">/{total}</span>}</p>}{loading ? <div className="mt-2 h-3 w-28 rounded bg-subtle animate-pulse" /> : <p className={`mt-2 text-xs font-medium ${accent.txt}`}>{sub}</p>}</div><div className={`rounded-2xl p-2.5 ${accent.bg}`}><Icon className={`w-5 h-5 ${accent.txt}`} strokeWidth={1.8} /></div></div>
      {clickable && <div className="relative mt-2 flex items-center gap-1 text-[12px] font-medium text-muted"><Eye className="w-3 h-3" strokeWidth={1.8} /> bấm để xem danh sách phòng</div>}
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
export const OosMiniBars = React.memo(function OosMiniBars({ data, h = 70 }) {
  const max = Math.max(1, ...data.map((d) => d.oos || 0));
  const barsH = h - 16;   // chừa ~16px cho nhãn giờ ở dưới
  return (
    <div className="w-full select-none" style={{ height: h }}>
      <div className="flex items-end gap-[3px]" style={{ height: barsH }}>
        {data.map((d, i) => { const v = d.oos || 0; const hb = v > 0 ? Math.max(2, Math.round((v / max) * barsH)) : 0; return (
          <div key={i} className="flex-1 flex items-end justify-center" title={`Giờ ${d.label} · ${v} điểm OOS`}>
            <div className="w-full rounded-t" style={{ height: hb, background: "var(--danger-line)" }} />
          </div>
        ); })}
      </div>
      <div className="flex gap-[3px] mt-1">{data.map((d, i) => <div key={i} className="flex-1 text-center text-[12px] text-muted tabular-nums leading-none truncate">{i % 2 === 0 ? d.label : ""}</div>)}</div>
    </div>
  );
});
