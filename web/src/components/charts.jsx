// ============================================================
// charts.jsx — Toàn bộ biểu đồ bằng APACHE ECHARTS (tree-shaken, canvas).
// App nạp TRỄ qua React.lazy(() => import("./components/charts")) → bundle
// màn hình đầu KHÔNG kèm thư viện biểu đồ; chỉ tải khi mở tab Xu hướng /
// modal chi tiết phòng.
//
// Giữ NGUYÊN API điều phối: default export LazyChart({ type, ...props }) —
// App.jsx gọi <Chart type="…" /> không đổi.
//
// Vì sao ECharts: canvas (mượt khi nhiều điểm), markArea vẽ dải giới hạn
// (GHD–GHT) + cửa sổ bảo trì, markLine cho ngưỡng, dataZoom, xuất ảnh — và
// tree-shaking (chỉ nạp Line/Bar + vài component) giữ bundle nhỏ.
// ============================================================
import React, { useRef, useEffect } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LegendComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, LegendComponent, CanvasRenderer]);

// ---- Hằng số thiết kế (bản sao gọn từ App.jsx — chỉ những gì biểu đồ cần) ----
const COLOR = { navy: "#102A3E", ink: "#33506e", teal: "#0E7C73", sky: "#1E72B8", coral: "#D9534F", coralDeep: "#B3261E", sand: "#C77E12", softCoral: "#D9534F" };
const SENSOR_COLOR = { DP: "#0E7C73", RH: "#1E72B8", T: "#B26F0E" };
const SENSOR_META = { DP: { label: "Chênh áp", unit: "Pa" }, RH: { label: "Độ ẩm", unit: "%" }, T: { label: "Nhiệt độ", unit: "°C" } };
const COMPLY_OK = "#0E7C73";
const COMPLY_BAD = "#B3261E";
const fmtPct = (v) => (v == null || isNaN(v) ? "—" : `${(+v).toFixed(1).replace(".0", "")}%`);
const xTickEvery = (n) => Math.max(0, Math.floor(n / 12));
function complyDomain(values) {
  const ys = values.filter((v) => v != null);
  if (!ys.length) return [0, 100];
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(4, (hi - lo) * 0.18);
  return [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];
}
const chartWrap = "rounded-2xl p-2 bg-gradient-to-b from-sky-50/70 to-white ring-1 ring-sky-100/80";
const TT_CSS = "border-radius:12px;box-shadow:0 10px 30px -8px rgba(35,80,110,0.4);padding:8px 12px;";
const tooltipBase = { backgroundColor: "#fff", borderColor: "#e2e8f0", borderWidth: 1, textStyle: { fontSize: 11, color: COLOR.ink }, extraCssText: TT_CSS };
const gradient = (c, top = 0.30, bot = 0.02) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: echarts.color.modifyAlpha(c, top) }, { offset: 1, color: echarts.color.modifyAlpha(c, bot) }]);

// ---- Wrapper React quanh ECharts: init 1 lần, cập nhật option, tự resize ----
function EChart({ option, height = 200, width = "100%", className = "" }) {
  const elRef = useRef(null);
  const instRef = useRef(null);
  useEffect(() => {
    instRef.current = echarts.init(elRef.current, null, { renderer: "canvas" });
    const ro = new ResizeObserver(() => instRef.current && instRef.current.resize());
    ro.observe(elRef.current);
    return () => { ro.disconnect(); instRef.current && instRef.current.dispose(); instRef.current = null; };
  }, []);
  useEffect(() => { if (instRef.current && option) instRef.current.setOption(option, true); }, [option]);
  return <div ref={elRef} className={className} style={{ width, height }} />;
}

const axisX = (labels, interval = 0, show = true) => ({
  type: "category", data: labels, boundaryGap: true,
  axisTick: { show: false }, axisLine: { show, lineStyle: { color: "#cbdde8" } },
  axisLabel: show ? { fontSize: 9, color: "#5f7a90", interval } : { show: false },
});

// ====== Mini cột "điểm OOS theo giờ (8h)" — thẻ phòng ở tab Tổng quan ======
export function OOSMini({ data }) {
  const option = {
    animation: false,
    grid: { top: 6, right: 4, bottom: 18, left: 4, containLabel: false },
    tooltip: { trigger: "axis", ...tooltipBase, formatter: (p) => `Giờ ${p[0].axisValue}<br/>${p[0].data} điểm OOS` },
    xAxis: { ...axisX(data.map((d) => d.label), 1), axisLine: { show: false } },
    yAxis: { type: "value", show: false, min: 0 },
    series: [{ type: "bar", data: data.map((d) => d.oos), barMaxWidth: 16, itemStyle: { color: COLOR.softCoral, borderRadius: [3, 3, 0, 0] } }],
  };
  return <EChart option={option} height={70} />;
}

// ====== MiniArea: % đạt theo thời gian (thẻ "Xu hướng theo cấp") ======
export function MiniArea({ data }) {
  const comps = data.map((d) => (d.comp == null ? null : d.comp));
  const option = {
    animation: false,
    grid: { top: 6, right: 4, bottom: 4, left: 4, containLabel: false },
    tooltip: { trigger: "axis", ...tooltipBase, formatter: (p) => `${p[0].axisValue}<br/>${fmtPct(p[0].data)} % đạt` },
    xAxis: { ...axisX(data.map((d) => d.label), 0, false) },
    yAxis: { type: "value", show: false, scale: true, max: 100 },
    series: [{
      type: "line", data: comps, smooth: true, showSymbol: false, connectNulls: true,
      lineStyle: { color: COMPLY_OK, width: 2 }, areaStyle: { color: gradient(COMPLY_OK, 0.28, 0.02) },
      markLine: { silent: true, symbol: "none", label: { show: false }, data: [{ yAxis: 80 }], lineStyle: { color: COLOR.sand, type: "dashed", width: 1 } },
    }],
  };
  return <EChart option={option} height={84} />;
}

// ====== Sparkline (bảng xếp hạng rủi ro) — màu theo chiều tăng/giảm ======
export function Sparkline({ chuoi }) {
  if (!chuoi || chuoi.length < 2) return <span className="text-[11px] text-slate-300">—</span>;
  const last = chuoi[chuoi.length - 1]?.comp, first = chuoi[0]?.comp;
  const stroke = (last != null && first != null) ? (last >= first ? COLOR.teal : COLOR.coral) : COLOR.teal;
  const option = {
    animation: false,
    grid: { top: 3, right: 2, bottom: 0, left: 2, containLabel: false },
    tooltip: { trigger: "axis", ...tooltipBase, formatter: (p) => `${p[0].axisValue}<br/>${fmtPct(p[0].data)} đạt` },
    xAxis: { ...axisX(chuoi.map((d) => d.label), 0, false) },
    yAxis: { type: "value", show: false, scale: true },
    series: [{ type: "line", data: chuoi.map((d) => d.comp), smooth: true, showSymbol: false, lineStyle: { color: stroke, width: 1.6 }, areaStyle: { color: echarts.color.modifyAlpha(stroke, 0.12) } }],
  };
  return <EChart option={option} height={30} width={96} />;
}

// ====== (A) % đạt TOÀN PHẦN + vùng OOS + ngưỡng 80% (chấm đỏ khi < 80) ======
export function ChartComplyTotal({ data, height = 280, idSuffix = "" }) {
  const [ymin, ymax] = complyDomain(data.map((d) => d.comp));
  const option = {
    animation: false,
    grid: { top: 12, right: 16, bottom: 22, left: 8, containLabel: true },
    tooltip: { trigger: "axis", ...tooltipBase, formatter: (p) => { const v = p[0].data == null ? null : p[0].data; return `${p[0].axisValue}<br/>${fmtPct(v)} · OOS ${v == null ? "—" : (100 - v).toFixed(1) + "%"}`; } },
    xAxis: axisX(data.map((d) => d.label), xTickEvery(data.length)),
    yAxis: { type: "value", min: ymin, max: ymax, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "#e6f0f5" } }, axisLabel: { fontSize: 9, color: "#5f7a90", formatter: "{value}%" } },
    series: [{
      type: "line", smooth: true, connectNulls: false, showSymbol: true, symbolSize: 5,
      data: data.map((d) => ({ value: d.comp, itemStyle: { color: d.comp != null && d.comp < 80 ? COMPLY_BAD : COMPLY_OK, borderColor: "#fff", borderWidth: 1 } })),
      lineStyle: { color: COMPLY_OK, width: 2.6 }, areaStyle: { color: gradient(COMPLY_OK, 0.30, 0.02) },
      markLine: { silent: true, symbol: "none", data: [{ yAxis: 80 }], lineStyle: { color: COLOR.sand, type: "dashed", width: 1.4 }, label: { formatter: "ngưỡng 80%", fontSize: 9, color: COLOR.sand, position: "insideEndTop" } },
    }],
  };
  return <div className={chartWrap} style={{ height: height + 16 }}><EChart option={option} height={height} /></div>;
}

// ====== (B) % đạt THEO TỪNG CHỈ TIÊU (DP/RH/T) ======
export function ChartComplyPerMetric({ data, present, height = 280 }) {
  const ks = ["DP", "RH", "T"].filter((k) => present.includes(k));
  const allVals = [];
  data.forEach((d) => ks.forEach((k) => { if (d[`comp_${k}`] != null) allVals.push(d[`comp_${k}`]); }));
  const [ymin, ymax] = complyDomain(allVals);
  const option = {
    animation: false,
    grid: { top: 12, right: 16, bottom: 34, left: 8, containLabel: true },
    legend: { data: ks.map((k) => SENSOR_META[k].label), bottom: 0, textStyle: { fontSize: 11, color: COLOR.ink }, icon: "roundRect", itemWidth: 14, itemHeight: 3 },
    tooltip: {
      trigger: "axis", ...tooltipBase,
      formatter: (ps) => {
        const head = `<div style="font-weight:600;color:${COLOR.navy};margin-bottom:4px">${ps[0].axisValue}</div>`;
        return head + ps.map((p) => { const v = p.data; return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.color}">● ${p.seriesName}</span><span>${fmtPct(v)} · OOS ${v == null ? "—" : (100 - v).toFixed(1) + "%"}</span></div>`; }).join("");
      },
    },
    xAxis: axisX(data.map((d) => d.label), xTickEvery(data.length)),
    yAxis: { type: "value", min: ymin, max: ymax, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "#e6f0f5" } }, axisLabel: { fontSize: 9, color: "#5f7a90", formatter: "{value}%" } },
    series: ks.map((k) => ({
      name: SENSOR_META[k].label, type: "line", smooth: true, connectNulls: false, showSymbol: false,
      data: data.map((d) => d[`comp_${k}`]), lineStyle: { color: SENSOR_COLOR[k], width: 2.4 }, itemStyle: { color: SENSOR_COLOR[k] },
      areaStyle: { color: gradient(SENSOR_COLOR[k], 0.16, 0.01) },
      ...(k === ks[0] ? { markLine: { silent: true, symbol: "none", data: [{ yAxis: 80 }], lineStyle: { color: COLOR.sand, type: "dashed", width: 1.4 }, label: { formatter: "80%", fontSize: 9, color: COLOR.sand, position: "insideEndTop" } } } : {}),
    })),
  };
  return <div className={chartWrap} style={{ height: height + 16 }}><EChart option={option} height={height} /></div>;
}

// ====== Giá trị TB + dải giới hạn (GHD–GHT) cho MỘT chỉ tiêu của phòng ======
export function RoomBandChart({ sensorKey, series }) {
  const unit = SENSOR_META[sensorKey]?.unit || "";
  const color = SENSOR_COLOR[sensorKey] || COLOR.teal;
  const lo = [...series].reverse().find((p) => p.lo != null)?.lo ?? null;
  const hi = [...series].reverse().find((p) => p.hi != null)?.hi ?? null;
  const vals = series.filter((p) => p.avg != null);
  const mean = vals.length ? +(vals.reduce((a, p) => a + p.avg, 0) / vals.length).toFixed(2) : null;
  const ys = vals.map((p) => p.avg);
  const yLo = Math.min(...ys, lo == null ? Infinity : lo, hi == null ? Infinity : hi);
  const yHi = Math.max(...ys, lo == null ? -Infinity : lo, hi == null ? -Infinity : hi);
  const pad = Math.max(0.5, (yHi - yLo) * 0.1);
  const hasDomain = ys.length && isFinite(yLo) && isFinite(yHi);
  const markLineData = [];
  if (lo != null) markLineData.push({ yAxis: lo, label: { formatter: `GHD ${lo}`, fontSize: 9, color: COLOR.coralDeep, position: "insideStartBottom" }, lineStyle: { color: COLOR.coral, type: "dashed", width: 1.3 } });
  if (hi != null) markLineData.push({ yAxis: hi, label: { formatter: `GHT ${hi}`, fontSize: 9, color: COLOR.coralDeep, position: "insideStartTop" }, lineStyle: { color: COLOR.coral, type: "dashed", width: 1.3 } });
  if (mean != null) markLineData.push({ yAxis: mean, label: { formatter: `TB ${mean}`, fontSize: 9, color: COLOR.navy, position: "insideEndTop" }, lineStyle: { color: COLOR.navy, type: "dashed", width: 1.2 } });
  const option = {
    animation: false,
    grid: { top: 10, right: 16, bottom: 22, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis", ...tooltipBase,
      formatter: (ps) => { const v = ps[0].data; if (v == null) return ""; const oob = (lo != null && v < lo) || (hi != null && v > hi); return `<div style="font-weight:600;color:${COLOR.navy}">${ps[0].axisValue}</div><div>TB: <b style="color:${oob ? COLOR.coralDeep : color}">${(+v).toFixed(2)} ${unit}</b>${oob ? ' <span style="color:#e11d48">· ngoài giới hạn</span>' : ""}</div><div style="color:#94a3b8">GHD ${lo == null ? "—" : lo} · GHT ${hi == null ? "—" : hi} ${unit}</div>`; },
    },
    xAxis: axisX(series.map((p) => p.label), xTickEvery(series.length)),
    yAxis: { type: "value", scale: true, ...(hasDomain ? { min: +(yLo - pad).toFixed(1), max: +(yHi + pad).toFixed(1) } : {}), axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "#e6f0f5" } }, axisLabel: { fontSize: 9, color: "#5f7a90", formatter: (v) => `${+(+v).toFixed(1)}` } },
    series: [{
      type: "line", smooth: true, connectNulls: true, showSymbol: true, symbolSize: 5,
      data: series.map((p) => ({ value: p.avg, itemStyle: { color: (lo != null && p.avg < lo) || (hi != null && p.avg > hi) ? COLOR.coralDeep : color, borderColor: "#fff", borderWidth: 0.9 } })),
      lineStyle: { color, width: 2.4 }, areaStyle: { color: gradient(color, 0.16, 0.03) },
      markArea: (lo != null && hi != null) ? { silent: true, itemStyle: { color: echarts.color.modifyAlpha(color, 0.07) }, data: [[{ yAxis: lo }, { yAxis: hi }]] } : undefined,
      markLine: markLineData.length ? { silent: true, symbol: "none", data: markLineData } : undefined,
    }],
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} /><h4 className="text-[14px] font-semibold" style={{ color: COLOR.navy }}>{SENSOR_META[sensorKey]?.label} ({sensorKey})</h4></div>
      <div className="grid grid-cols-4 gap-2 mb-2 text-center">{[["Trung bình", mean == null ? "—" : `${mean} ${unit}`], ["GHD", lo == null ? "—" : `${lo} ${unit}`], ["GHT", hi == null ? "—" : `${hi} ${unit}`], ["Số điểm", `${series.length}`]].map(([k, v]) => <div key={k} className="rounded-xl bg-slate-50 ring-1 ring-slate-200 py-1.5"><p className="text-[10px] uppercase text-slate-400 font-semibold leading-tight">{k}</p><p className="text-[13px] font-semibold tabular-nums" style={{ color: COLOR.navy }}>{v}</p></div>)}</div>
      <EChart option={option} height={210} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500"><span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: color, opacity: 0.35 }} /> Dải giới hạn (GHD–GHT)</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} /> TB trong giới hạn</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLOR.coralDeep }} /> TB ngoài giới hạn</span></div>
    </div>
  );
}

// ====== Modal chi tiết phòng: TB giờ + dải min–max + GHD/GHT ======
export function RoomDetailMiniChart({ pts, smin, smax, mean, unit }) {
  const vals = []; pts.forEach((p) => { [p.avg, p.vmin, p.vmax].forEach((x) => { if (x != null) vals.push(+x); }); });
  if (smin != null) vals.push(+smin); if (smax != null) vals.push(+smax);
  let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const span = hi - lo; const dec = span >= 10 ? 0 : span >= 2 ? 1 : 2;
  const hasBand = pts.some((p) => p.vmin != null && p.vmax != null);
  const markLineData = [];
  if (smin != null) markLineData.push({ yAxis: smin, label: { formatter: `GHD ${smin}`, fontSize: 9, color: COLOR.coralDeep, position: "insideStartBottom" }, lineStyle: { color: COLOR.coral, type: "dashed", width: 1.3 } });
  if (smax != null) markLineData.push({ yAxis: smax, label: { formatter: `GHT ${smax}`, fontSize: 9, color: COLOR.coralDeep, position: "insideStartTop" }, lineStyle: { color: COLOR.coral, type: "dashed", width: 1.3 } });
  if (mean != null) markLineData.push({ yAxis: mean, label: { formatter: `TB ${mean}`, fontSize: 9, color: COLOR.navy, position: "insideEndTop" }, lineStyle: { color: COLOR.navy, type: "dashed", width: 1.2 } });
  const option = {
    animation: false,
    grid: { top: 8, right: 14, bottom: 20, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis", ...tooltipBase,
      formatter: (ps) => {
        const byName = {}; ps.forEach((p) => { byName[p.seriesName] = p; });
        const avg = byName["TB giờ"] ? byName["TB giờ"].data : null;
        const f = (x) => (x == null ? "—" : (+x).toFixed(2));
        const lohi = hasBand ? `<div style="color:#94a3b8">Min–Max: ${f(pts[ps[0].dataIndex]?.vmin)}–${f(pts[ps[0].dataIndex]?.vmax)} ${unit}</div>` : "";
        return `<div style="font-weight:600;color:${COLOR.navy}">${ps[0].axisValue}</div><div>TB giờ: <b>${f(avg)} ${unit}</b></div>${lohi}`;
      },
    },
    xAxis: axisX(pts.map((p) => p.label)),
    yAxis: { type: "value", min: +lo.toFixed(dec), max: +hi.toFixed(dec), axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "#e6f0f5" } }, axisLabel: { fontSize: 9, color: "#5f7a90", formatter: (v) => (+v).toFixed(dec) } },
    series: [
      // Dải min–max: 2 series stack (đáy vmin trong suốt + phần vmax-vmin tô nền)
      ...(hasBand ? [
        { name: "_lo", type: "line", stack: "band", data: pts.map((p) => (p.vmin != null ? p.vmin : "-")), lineStyle: { opacity: 0 }, showSymbol: false, symbol: "none", silent: true, tooltip: { show: false } },
        { name: "_band", type: "line", stack: "band", data: pts.map((p) => (p.vmin != null && p.vmax != null ? +(p.vmax - p.vmin).toFixed(4) : "-")), lineStyle: { opacity: 0 }, areaStyle: { color: echarts.color.modifyAlpha(COLOR.sky, 0.14) }, showSymbol: false, symbol: "none", silent: true, tooltip: { show: false } },
      ] : []),
      {
        name: "TB giờ", type: "line", smooth: true, connectNulls: true, showSymbol: true, symbolSize: 6, z: 3,
        data: pts.map((p) => ({ value: p.avg, itemStyle: { color: (smin != null && p.avg < smin) || (smax != null && p.avg > smax) ? COLOR.coralDeep : COLOR.teal, borderColor: "#fff", borderWidth: 1 } })),
        lineStyle: { color: COLOR.teal, width: 2.2 },
        markArea: (smin != null && smax != null) ? { silent: true, itemStyle: { color: echarts.color.modifyAlpha(COLOR.teal, 0.10) }, data: [[{ yAxis: smin }, { yAxis: smax }]] } : undefined,
        markLine: markLineData.length ? { silent: true, symbol: "none", data: markLineData } : undefined,
      },
    ],
  };
  return <EChart option={option} height={182} />;
}

// ====== TrendMainChart (dự phòng): cột warning/critical + đường tuân thủ ======
export function TrendMainChart({ data, range }) {
  const interval = range === "90n" ? Math.floor(data.length / 9) : range === "30n" ? Math.floor(data.length / 10) : 0;
  const option = {
    animation: false,
    grid: { top: 16, right: 40, bottom: 24, left: 8, containLabel: true },
    tooltip: { trigger: "axis", ...tooltipBase },
    legend: { show: false },
    xAxis: axisX(data.map((d) => d.label), interval),
    yAxis: [
      { type: "value", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: "#e6f0f5" } }, axisLabel: { fontSize: 10, color: "#5f7a90" } },
      { type: "value", min: 0, max: 100, position: "right", axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { fontSize: 10, color: "#5f7a90" } },
    ],
    series: [
      { name: "Warning", type: "bar", stack: "h", data: data.map((d) => d.warnH), barMaxWidth: 26, itemStyle: { color: COLOR.sand } },
      { name: "Critical", type: "bar", stack: "h", data: data.map((d) => d.critH), barMaxWidth: 26, itemStyle: { color: COLOR.softCoral, borderRadius: [4, 4, 0, 0] } },
      { name: "Tuân thủ", type: "line", yAxisIndex: 1, smooth: true, showSymbol: false, data: data.map((d) => d.comp), lineStyle: { color: COLOR.teal, width: 2.6 }, itemStyle: { color: COLOR.teal }, markLine: { silent: true, symbol: "none", data: [{ yAxis: 80 }], lineStyle: { color: COLOR.sand, type: "dashed", width: 1.5 } } },
    ],
  };
  return <EChart option={option} height={300} />;
}

// ====== Điểm vào điều phối ======
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
