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

// SparkChenhAp — dòng diễn biến 5′ gần nhất của MỘT phòng, SVG thuần (yêu cầu 17/08:
// "mở tab là thấy ngay hệ thống thế nào"). Dải xám = khoảng cho phép; chấm đỏ = dưới
// giới hạn, chấm vàng = trên giới hạn, chấm cuối to hơn = điểm mới nhất.
export function SparkChenhAp({ chuoi, min, max, w = 150, h = 30 }) {
  if (!Array.isArray(chuoi) || chuoi.length === 0) return null;
  const vals = chuoi.map((p) => Number(p.v)).filter((v) => !Number.isNaN(v));
  if (!vals.length) return null;
  const lo = Math.min(...vals, min ?? Infinity);
  const hi = Math.max(...vals, max ?? -Infinity);
  const span = (hi - lo) || 1;
  const pad = span * 0.18;
  const y = (v) => h - 4 - ((v - (lo - pad)) / (span + pad * 2)) * (h - 8);
  const x = (i) => 6 + (i * (w - 12)) / Math.max(1, chuoi.length - 1);
  const diem = chuoi.map((p, i) => ({ px: x(i), py: y(Number(p.v)), t: p.t, v: Number(p.v) }));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full shrink-0" role="img"
      aria-label={`Diễn biến ${chuoi.length * 5} phút gần nhất, mới nhất ${diem[diem.length - 1].v}`}>
      {min != null && max != null && <rect x={0} y={y(max)} width={w} height={Math.max(2, y(min) - y(max))} fill="var(--bg-subtle)" />}
      {min != null && <line x1={0} x2={w} y1={y(min)} y2={y(min)} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />}
      {max != null && <line x1={0} x2={w} y1={y(max)} y2={y(max)} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />}
      <polyline points={diem.map((d) => `${d.px},${d.py}`).join(" ")} fill="none" stroke="var(--info)" strokeWidth={1.5} />
      {diem.map((d, i) => {
        const duoi = min != null && d.v < min;
        const tren = max != null && d.v > max;
        const cuoi = i === diem.length - 1;
        return (
          <circle key={i} cx={d.px} cy={d.py} r={cuoi ? 3.5 : 2.5}
            fill={duoi ? "var(--danger-solid)" : tren ? "var(--warning-solid)" : "var(--primary)"}
            stroke="var(--bg-surface)" strokeWidth={cuoi ? 1.2 : 0.8}>
            <title>{`${d.t}: ${d.v}${duoi ? " — dưới giới hạn" : tren ? " — trên giới hạn" : ""}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
