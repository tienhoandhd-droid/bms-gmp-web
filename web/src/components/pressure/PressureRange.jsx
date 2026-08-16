// PressureRange.jsx — bullet/range chênh áp bằng SVG thuần (Phase C báo cáo 9).
// Trục = dải cho phép [min,max] nới 25% hai đầu; marker ● = giá trị hiện tại.
// Không cần ECharts: nhẹ, responsive, tự theo token 2 theme (SVG là DOM nên
// nhận var(--…) trực tiếp — khác canvas).
import React from "react";

export default function PressureRange({ value, min, max, stale = false, missing = false, donVi = "Pa", w = 220 }) {
  if (missing || value == null) {
    return <div className="h-6 flex items-center text-[12px] text-muted italic">Thiếu dữ liệu</div>;
  }
  const span = (max - min) || 1;
  const lo = min - span * 0.25, hi = max + span * 0.25;
  const x = (v) => Math.max(4, Math.min(w - 4, ((v - lo) / (hi - lo)) * w));
  const ok = value >= min && value <= max;
  const mau = stale ? "var(--missing)" : ok ? "var(--success-solid)" : "var(--danger)";
  return (
    <svg width={w} height={24} className="max-w-full" viewBox={`0 0 ${w} 24`} role="img"
      aria-label={`${value} ${donVi} — giới hạn ${min} đến ${max} ${donVi}${stale ? ", chưa cập nhật" : ok ? ", trong giới hạn" : ", ngoài giới hạn"}`}>
      <line x1={0} x2={w} y1={12} y2={12} stroke="var(--border)" strokeWidth={2} />
      <rect x={x(min)} y={7} width={Math.max(2, x(max) - x(min))} height={10} rx={5} fill="var(--bg-subtle)" stroke="var(--border)" />
      <line x1={x(min)} x2={x(min)} y1={3} y2={21} stroke="var(--border-strong)" strokeWidth={1.5} />
      <line x1={x(max)} x2={x(max)} y1={3} y2={21} stroke="var(--border-strong)" strokeWidth={1.5} />
      <circle cx={x(value)} cy={12} r={5.5} fill={stale ? "none" : mau} stroke={mau} strokeWidth={2} />
    </svg>
  );
}
