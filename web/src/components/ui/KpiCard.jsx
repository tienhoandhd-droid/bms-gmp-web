// KpiCard.jsx — thẻ KPI + cột OOS mini (tách move-only từ App.jsx 17/08/2026).
import React from "react";
import { ArrowUpRight } from "lucide-react";

export const KpiCard = React.memo(function KpiCard({ icon: Icon, label, value, total, sub, accent, onClick, loading }) {
  const clickable = typeof onClick === "function";
  return (
    <div className="bms-kpi" data-clickable={clickable} aria-busy={loading || undefined}>
      {clickable ? <button onClick={onClick} className="absolute inset-0 z-10" aria-label={`Xem danh sách: ${label}`} /> : null}
      {/* Mảng 4: skeleton pulse khi CHƯA có số → không hiện "0" rồi nhảy (giảm CLS). */}
      <div className="bms-kpi-label"><span>{label}</span><Icon className={`h-4 w-4 shrink-0 ${accent.txt}`} strokeWidth={1.8} aria-hidden="true" /></div>
      {loading ? <div className="my-3 h-9 w-16 max-w-full rounded bg-subtle animate-pulse" /> : <p className="bms-kpi-value">{value}{total != null && <span className="text-[13px] text-muted font-normal tracking-normal"> / {total}</span>}</p>}
      {loading ? <div className="h-3 w-20 max-w-full rounded bg-subtle animate-pulse" /> : <p className={`bms-kpi-sub ${accent.txt}`}>{sub}</p>}
      {clickable && <div className="bms-kpi-hint">Xem phòng <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" /></div>}
    </div>
  );
}, (t, s) => t.label === s.label && t.value === s.value && t.total === s.total && t.sub === s.sub
   && t.loading === s.loading && t.icon === s.icon
   && (typeof t.onClick === "function") === (typeof s.onClick === "function")
   && t.accent.txt === s.accent.txt && t.accent.bg === s.accent.bg && t.accent.tone === s.accent.tone);

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
