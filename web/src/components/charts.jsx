// ============================================================
// charts.jsx — Toàn bộ biểu đồ (Recharts) tách khỏi App.jsx.
// Được App nạp TRỄ qua React.lazy(() => import("./components/charts")) →
// bundle màn hình đầu KHÔNG kèm Recharts (~400KB); biểu đồ chỉ tải khi
// người dùng mở tab Xu hướng hoặc modal chi tiết phòng.
//
// GIỮ NGUYÊN 100% code vẽ so với bản gốc trong App.jsx (không đổi giao diện) —
// chỉ di chuyển + gom hằng số cần dùng vào đây để module tự lập.
// Điểm vào: default export LazyChart({ type, ...props }) điều phối theo `type`.
// ============================================================
import React from "react";
import {
  ComposedChart, Bar, BarChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend
} from "recharts";

// ---- Hằng số thiết kế (bản sao gọn từ App.jsx — chỉ những gì biểu đồ cần) ----
const COLOR = { navy: "#102A3E", ink: "#33506e", teal: "#0E7C73", sky: "#1E72B8", coral: "#D9534F", coralDeep: "#B3261E", sand: "#C77E12", softCoral: "#D9534F" };
const SENSOR_COLOR = { DP: "#0E7C73", RH: "#1E72B8", T: "#B26F0E" };
const SENSOR_META = { DP: { label: "Chênh áp", unit: "Pa" }, RH: { label: "Độ ẩm", unit: "%" }, T: { label: "Nhiệt độ", unit: "°C" } };
const COMPLY_OK = "#0E7C73";
const COMPLY_BAD = "#B3261E";
const fmtPct = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}%`);
const fmtH = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}h`);
const xTickEvery = (n) => Math.max(0, Math.floor(n / 12));
function complyDomain(values) {
  const ys = values.filter((v) => v != null);
  if (!ys.length) return [0, 100];
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(4, (hi - lo) * 0.18);
  return [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];
}
const chartWrap = "rounded-2xl p-2 bg-gradient-to-b from-sky-50/70 to-white ring-1 ring-sky-100/80";

// Tooltip cho biểu đồ "% đạt/OOS theo từng chỉ tiêu"
function SensorComplyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const ks = ["DP", "RH", "T"].filter((k) => d[`comp_${k}`] != null);
  if (!ks.length) return null;
  return <div className="rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-slate-200" style={{ boxShadow: "0 10px 30px -8px rgba(35,80,110,0.4)" }}>
    <p className="text-xs font-semibold mb-1.5" style={{ color: COLOR.navy }}>{label}</p>
    <div className="space-y-1 text-[11px]">{ks.map((k) => { const v = d[`comp_${k}`]; return (
      <p key={k} className="flex justify-between gap-5">
        <span className="font-medium" style={{ color: SENSOR_COLOR[k] }}>● {SENSOR_META[k].label}</span>
        <span className="tabular-nums text-slate-600">{fmtPct(v)} · OOS {v == null ? "—" : (100 - v).toFixed(1) + "%"}</span>
      </p>); })}</div>
  </div>;
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null; const d = payload[0].payload;
  return <div className="rounded-2xl bg-white px-3.5 py-2.5 ring-1 ring-slate-200" style={{ boxShadow: "0 10px 30px -8px rgba(35,80,110,0.4)" }}><p className="text-xs font-semibold mb-1.5" style={{ color: COLOR.navy }}>{label}</p><div className="space-y-1 text-[11px]"><p className="flex justify-between gap-4"><span className="text-slate-500">Tổng giờ cảnh báo</span><span className="font-semibold tabular-nums">{fmtH(d.alert)}</span></p><p className="flex justify-between gap-4"><span style={{ color: COLOR.sand }}>● Warning</span><span className="tabular-nums">{fmtH(d.warnH)}</span></p><p className="flex justify-between gap-4"><span style={{ color: COLOR.softCoral }}>● Critical</span><span className="tabular-nums">{fmtH(d.critH)}</span></p><p className="flex justify-between gap-4"><span style={{ color: COLOR.teal }}>― Tuân thủ</span><span className="tabular-nums">{fmtPct(d.comp)}</span></p></div></div>;
}

export function TrendMainChart({ data, range }) {
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

export function MiniArea({ data }) { return <div className="w-full" style={{ height: 84 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}><defs><linearGradient id="miniComply" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COMPLY_OK} stopOpacity={0.28} /><stop offset="100%" stopColor={COMPLY_OK} stopOpacity={0.02} /></linearGradient></defs><YAxis hide domain={[(d) => Math.max(0, Math.floor(d - 8)), 100]} /><XAxis dataKey="label" hide /><Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 10 }} formatter={(v) => [fmtPct(v), "% đạt"]} labelFormatter={(l) => l} /><ReferenceLine y={80} stroke={COLOR.sand} strokeDasharray="3 3" strokeWidth={1} /><Area type="monotone" dataKey="comp" stroke={COMPLY_OK} strokeWidth={2} fill="url(#miniComply)" dot={false} connectNulls isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>; }

export function Sparkline({ chuoi }) {
  if (!chuoi || chuoi.length < 2) return <span className="text-[11px] text-slate-300">—</span>;
  const last = chuoi[chuoi.length - 1]?.comp;
  const first = chuoi[0]?.comp;
  const stroke = (last != null && first != null) ? (last >= first ? COLOR.teal : COLOR.coral) : COLOR.teal;
  return <div style={{ width: 96, height: 30 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chuoi} margin={{ top: 3, right: 2, left: 2, bottom: 0 }}><YAxis hide domain={["dataMin - 2", "dataMax + 2"]} /><XAxis dataKey="label" hide /><Tooltip contentStyle={{ borderRadius: 8, border: "none", fontSize: 10 }} formatter={(v) => [fmtPct(v), "Đạt"]} labelFormatter={(l) => l} /><Area type="monotone" dataKey="comp" stroke={stroke} strokeWidth={1.6} fill={stroke} fillOpacity={0.12} dot={false} /></AreaChart></ResponsiveContainer></div>;
}

export function ChartComplyTotal({ data, height = 280, idSuffix = "" }) {
  const gid = `oosGrad${idSuffix}`;
  const dom = complyDomain(data.map((d) => d.comp));
  return (
    <div className={chartWrap} style={{ height: height + 16 }}><ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COMPLY_OK} stopOpacity={0.30} />
            <stop offset="100%" stopColor={COMPLY_OK} stopOpacity={0.02} />
          </linearGradient>
          <filter id={`glow${idSuffix}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor={COMPLY_OK} floodOpacity="0.25" />
          </filter>
        </defs>
        <CartesianGrid strokeDasharray="2 6" stroke="#cfe2ec" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} interval={xTickEvery(data.length)} />
        <YAxis tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} width={42} domain={dom} tickFormatter={(v) => `${v}%`} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "none", fontSize: 11, boxShadow: "0 8px 24px -8px rgba(30,58,86,0.35)" }}
          formatter={(v) => [`${fmtPct(v)} · OOS ${v == null ? "—" : (100 - v).toFixed(1) + "%"}`, "% đạt"]} />
        <ReferenceLine y={80} stroke={COLOR.sand} strokeDasharray="5 5" strokeWidth={1.4} label={{ value: "ngưỡng 80%", position: "insideTopRight", fontSize: 9, fill: COLOR.sand }} />
        <Area type="monotone" dataKey="comp" stroke="none" fill={`url(#${gid})`} isAnimationActive={false} connectNulls={false} />
        <Line type="monotone" dataKey="comp" stroke={COMPLY_OK} strokeWidth={2.6} isAnimationActive={false} connectNulls={false} filter={`url(#glow${idSuffix})`}
          dot={(dp) => { const { cx, cy, payload } = dp; if (cx == null || cy == null) return null; const low = payload.comp != null && payload.comp < 80; return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={low ? 3.4 : 2.4} fill={low ? COMPLY_BAD : COMPLY_OK} stroke="#fff" strokeWidth={1} />; }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} />
      </ComposedChart>
    </ResponsiveContainer></div>
  );
}

export function ChartComplyPerMetric({ data, present, height = 280 }) {
  const allVals = [];
  data.forEach((d) => ["DP", "RH", "T"].forEach((k) => { if (d[`comp_${k}`] != null) allVals.push(d[`comp_${k}`]); }));
  const dom = complyDomain(allVals);
  return (
    <div className={chartWrap} style={{ height: height + 16 }}><ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
        <defs>{["DP", "RH", "T"].map((k) => (
          <linearGradient key={k} id={`grad_${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SENSOR_COLOR[k]} stopOpacity={0.18} />
            <stop offset="100%" stopColor={SENSOR_COLOR[k]} stopOpacity={0.01} />
          </linearGradient>
        ))}</defs>
        <CartesianGrid strokeDasharray="2 6" stroke="#cfe2ec" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} interval={xTickEvery(data.length)} />
        <YAxis tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} width={42} domain={dom} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<SensorComplyTooltip />} cursor={{ fill: "rgba(79,159,209,0.08)" }} />
        <ReferenceLine y={80} stroke={COLOR.sand} strokeDasharray="5 5" strokeWidth={1.4} label={{ value: "80%", position: "insideTopRight", fontSize: 9, fill: COLOR.sand }} />
        {["DP", "RH", "T"].filter((k) => present.includes(k)).map((k) => (
          <Area key={`a_${k}`} type="monotone" dataKey={`comp_${k}`} stroke="none" fill={`url(#grad_${k})`} isAnimationActive={false} connectNulls={false} legendType="none" />
        ))}
        {["DP", "RH", "T"].filter((k) => present.includes(k)).map((k) => (
          <Line key={k} type="monotone" dataKey={`comp_${k}`} name={SENSOR_META[k].label} stroke={SENSOR_COLOR[k]} strokeWidth={2.4} dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} connectNulls={false} />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
      </ComposedChart>
    </ResponsiveContainer></div>
  );
}

export function RoomBandChart({ sensorKey, series, isHourly }) {
  const unit = SENSOR_META[sensorKey]?.unit || "";
  const color = SENSOR_COLOR[sensorKey] || COLOR.teal;
  const lo = [...series].reverse().find((p) => p.lo != null)?.lo ?? null;
  const hi = [...series].reverse().find((p) => p.hi != null)?.hi ?? null;
  const vals = series.filter((p) => p.avg != null);
  const mean = vals.length ? +(vals.reduce((a, p) => a + p.avg, 0) / vals.length).toFixed(2) : null;
  const gid = `bandFill_${sensorKey}`;
  const ys = vals.map((p) => p.avg);
  const yLo = Math.min(...ys, lo == null ? Infinity : lo, hi == null ? Infinity : hi);
  const yHi = Math.max(...ys, lo == null ? -Infinity : lo, hi == null ? -Infinity : hi);
  const pad = Math.max(0.5, (yHi - yLo) * 0.1);
  const yDomain = ys.length && isFinite(yLo) && isFinite(yHi) ? [+(yLo - pad).toFixed(1), +(yHi + pad).toFixed(1)] : ["auto", "auto"];
  return (
    <div>
      <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} /><h4 className="text-[14px] font-semibold" style={{ color: COLOR.navy }}>{SENSOR_META[sensorKey]?.label} ({sensorKey})</h4></div>
      <div className="grid grid-cols-4 gap-2 mb-2 text-center">{[["Trung bình", mean == null ? "—" : `${mean} ${unit}`], ["GHD", lo == null ? "—" : `${lo} ${unit}`], ["GHT", hi == null ? "—" : `${hi} ${unit}`], ["Số điểm", `${series.length}`]].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 ring-1 ring-slate-200 py-1.5"><p className="text-[10px] uppercase text-slate-400 font-semibold leading-tight">{k}</p><p className="text-[13px] font-semibold tabular-nums" style={{ color: COLOR.navy }}>{v}</p></div>)}</div>
      <div style={{ height: 210 }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={series} margin={{ top: 10, right: 16, left: -2, bottom: 4 }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.16} /><stop offset="100%" stopColor={color} stopOpacity={0.03} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="2 6" stroke="#cfe2ec" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} interval={xTickEvery(series.length)} />
        <YAxis tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} width={46} domain={yDomain} allowDataOverflow tickFormatter={(v) => `${+(+v).toFixed(1)}`} />
        <Tooltip cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }} content={({ active, payload, label }) => {
          if (!active || !payload || !payload.length) return null;
          const d = payload[0].payload; if (d.avg == null) return null;
          const oob = (lo != null && d.avg < lo) || (hi != null && d.avg > hi);
          return <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200" style={{ boxShadow: "0 8px 24px -8px rgba(30,58,86,0.35)" }}>
            <p className="text-[11px] font-semibold mb-1" style={{ color: COLOR.navy }}>{label}</p>
            <p className="text-[12px]"><span className="text-slate-500">TB: </span><span className="font-semibold tabular-nums" style={{ color: oob ? COLOR.coralDeep : color }}>{(+d.avg).toFixed(2)} {unit}</span>{oob && <span className="text-[10px] text-rose-600 ml-1">· ngoài giới hạn</span>}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">GHD {lo == null ? "—" : lo} · GHT {hi == null ? "—" : hi} {unit}</p>
          </div>;
        }} />
        {lo != null && hi != null && <ReferenceArea y1={lo} y2={hi} fill={color} fillOpacity={0.07} stroke="none" />}
        {lo != null && <ReferenceLine y={lo} stroke={COLOR.coral} strokeDasharray="5 4" strokeWidth={1.3} label={{ value: `GHD ${lo}`, position: "insideBottomLeft", fontSize: 9, fill: COLOR.coralDeep }} />}
        {hi != null && <ReferenceLine y={hi} stroke={COLOR.coral} strokeDasharray="5 4" strokeWidth={1.3} label={{ value: `GHT ${hi}`, position: "insideTopLeft", fontSize: 9, fill: COLOR.coralDeep }} />}
        {mean != null && <ReferenceLine y={mean} stroke={COLOR.navy} strokeDasharray="2 3" strokeWidth={1.2} label={{ value: `TB ${mean}`, position: "right", fontSize: 9, fill: COLOR.navy }} />}
        <Area type="monotone" dataKey="avg" stroke="none" fill={`url(#${gid})`} isAnimationActive={false} connectNulls />
        <Line type="monotone" dataKey="avg" stroke={color} strokeWidth={2.4} isAnimationActive={false} connectNulls
          dot={(dp) => { const { cx, cy, payload } = dp; if (cx == null || cy == null) return null; const oob = (lo != null && payload.avg < lo) || (hi != null && payload.avg > hi); return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={oob ? 3.2 : 2.6} fill={oob ? COLOR.coralDeep : color} stroke="#fff" strokeWidth={0.9} />; }}
          activeDot={{ r: 4 }} />
      </ComposedChart></ResponsiveContainer></div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500"><span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: color, opacity: 0.35 }} /> Dải giới hạn (GHD–GHT)</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} /> TB trong giới hạn</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLOR.coralDeep }} /> TB ngoài giới hạn</span></div>
    </div>
  );
}

// Biểu đồ nhỏ trong modal chi tiết phòng (1 cảm biến): TB giờ + dải min–max + GHD/GHT.
export function RoomDetailMiniChart({ pts, smin, smax, mean, unit }) {
  const vals = []; pts.forEach((p) => { [p.avg, p.vmin, p.vmax].forEach((x) => { if (x != null) vals.push(+x); }); });
  if (smin != null) vals.push(+smin); if (smax != null) vals.push(+smax);
  let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const span = hi - lo; const dec = span >= 10 ? 0 : span >= 2 ? 1 : 2;
  const fmtY = (v) => (+v).toFixed(dec);
  return <div style={{ height: 182 }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={pts} margin={{ top: 8, right: 14, left: 2, bottom: 0 }}>
    <CartesianGrid strokeDasharray="2 6" stroke="#d6e6ee" vertical={false} />
    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} />
    <YAxis tick={{ fontSize: 9, fill: "#5f7a90" }} axisLine={false} tickLine={false} width={48} domain={[lo, hi]} allowDecimals={dec > 0} tickCount={6} tickFormatter={fmtY} />
    <Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 11 }} formatter={(v, n) => { const f = (x) => (x == null ? "—" : (+x).toFixed(2)); if (n === "_band") return [Array.isArray(v) ? `${f(v[0])}–${f(v[1])} ${unit}` : `${f(v)} ${unit}`, "Min–Max"]; return [v == null ? "—" : `${f(v)} ${unit}`, n === "avg" ? "TB giờ" : n]; }} />
    {smin != null && smax != null && <ReferenceArea y1={smin} y2={smax} fill={COLOR.teal} fillOpacity={0.10} stroke="none" />}
    {pts.some((p) => p.vmin != null && p.vmax != null) && <Area type="monotone" dataKey={(d) => (d.vmin != null && d.vmax != null ? [d.vmin, d.vmax] : null)} name="_band" stroke="none" fill={COLOR.sky} fillOpacity={0.14} connectNulls isAnimationActive={false} />}
    {smin != null && <ReferenceLine y={smin} stroke={COLOR.coral} strokeDasharray="5 4" strokeWidth={1.3} label={{ value: `GHD ${smin}`, position: "insideBottomLeft", fontSize: 9, fill: COLOR.coralDeep }} />}
    {smax != null && <ReferenceLine y={smax} stroke={COLOR.coral} strokeDasharray="5 4" strokeWidth={1.3} label={{ value: `GHT ${smax}`, position: "insideTopLeft", fontSize: 9, fill: COLOR.coralDeep }} />}
    {mean != null && <ReferenceLine y={mean} stroke={COLOR.navy} strokeDasharray="2 3" strokeWidth={1.2} label={{ value: `TB ${mean}`, position: "right", fontSize: 9, fill: COLOR.navy }} />}
    <Line type="monotone" dataKey="avg" stroke={COLOR.teal} strokeWidth={2.2} isAnimationActive={false}
      dot={(dp) => { const { cx, cy, payload } = dp; if (cx == null || cy == null) return null; const oob = (smin != null && payload.avg < smin) || (smax != null && payload.avg > smax); return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={oob ? COLOR.coralDeep : COLOR.teal} stroke="#fff" strokeWidth={1} />; }}
      activeDot={{ r: 4 }} />
  </ComposedChart></ResponsiveContainer></div>;
}

// Mini cột "điểm OOS theo giờ (8h)" trong thẻ phòng ở tab Tổng quan.
export function OOSMini({ data }) { return <div className="w-full" style={{ height: 70 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 6, right: 2, left: 2, bottom: 0 }}><YAxis hide /><XAxis dataKey="label" tick={{ fontSize: 8, fill: "#90a8bd" }} axisLine={false} tickLine={false} interval={1} /><Tooltip contentStyle={{ borderRadius: 10, border: "none", fontSize: 10 }} formatter={(v) => [`${v} điểm OOS`, "Lỗi/giờ"]} labelFormatter={(l) => `Giờ ${l}`} /><Bar dataKey="oos" fill={COLOR.softCoral} radius={[3, 3, 0, 0]} maxBarSize={16} /></BarChart></ResponsiveContainer></div>; }

// Điểm vào điều phối: App gọi <Chart type=... {...} /> → lazy tải module này 1 lần.
export default function LazyChart({ type, ...p }) {
  switch (type) {
    case "oosMini": return <OOSMini data={p.data} />;
    case "roomBand": return <RoomBandChart sensorKey={p.sensorKey} series={p.series} isHourly={p.isHourly} />;
    case "complyPerMetric": return <ChartComplyPerMetric data={p.data} present={p.present} />;
    case "complyTotal": return <ChartComplyTotal data={p.data} idSuffix={p.idSuffix} />;
    case "miniArea": return <MiniArea data={p.data} />;
    case "sparkline": return <Sparkline chuoi={p.chuoi} />;
    case "roomDetail": return <RoomDetailMiniChart pts={p.pts} smin={p.smin} smax={p.smax} mean={p.mean} unit={p.unit} />;
    case "trendMain": return <TrendMainChart data={p.data} range={p.range} />;
    default: return null;
  }
}
