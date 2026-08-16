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
import { LineChart, BarChart, CustomChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent, LegendComponent,
  DataZoomComponent, ToolboxComponent, CalendarComponent, VisualMapComponent, AriaComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { SENSOR_COLOR, SENSOR_META_BASE as SENSOR_META, COMPLY_OK, COMPLY_BAD, COMPLY_SCALE, complyColor, fmtPct } from "../lib/designTokens";
import { chartTokens, useThemeVersion, layToken } from "../theme/chartTheme";
// CHEX — màu series/tooltip đọc token ĐÃ RESOLVE tại thời điểm truy cập (canvas
// không hiểu var()); getter để đổi theme là option dựng lại có màu mới.
const CHEX = {
  get navy() { return layToken("--text-strong", "#102A3E"); },
  get ink() { return layToken("--text-default", "#33506e"); },
  get teal() { return layToken("--primary", "#0E7C73"); },
  get sky() { return layToken("--info", "#1E72B8"); },
  get coral() { return layToken("--danger", "#D9534F"); },
  get coralDeep() { return layToken("--danger-solid", "#B3261E"); },
  get sand() { return layToken("--warning", "#C77E12"); },
  get softCoral() { return layToken("--danger-line", "#D9534F"); },
  get tealLine() { return layToken("--success-line", "#7FC9BE"); },
  get skyLine() { return layToken("--info-line", "#9CC4E2"); },
  get sandDeep() { return layToken("--warning-solid", "#C77E12"); },
};
// T() — token biểu đồ đọc từ CSS var tại thời điểm DỰNG option (re-render khi đổi theme).
const T = () => chartTokens();

// Mảng 3: pieces cho visualMap piecewise dựng TỪ thang màu chuẩn duy nhất
// (COMPLY_SCALE) → mọi heatmap dùng chung ngưỡng, sửa 1 chỗ đồng bộ.
const complyPieces = () => COMPLY_SCALE.map((b) => ({ ...(b.gte != null ? { gte: b.gte } : {}), ...(b.lt != null ? { lt: b.lt } : {}), label: b.label, color: b.color }));

echarts.use([LineChart, BarChart, CustomChart, HeatmapChart, GridComponent, TooltipComponent, MarkLineComponent, MarkAreaComponent, MarkPointComponent, LegendComponent, DataZoomComponent, ToolboxComponent, CalendarComponent, VisualMapComponent, AriaComponent, CanvasRenderer]);

// Toolbox (xuất PNG) + dataZoom (kéo–thu phóng) dùng chung cho biểu đồ xu hướng lớn.
const toolboxLuuAnh = (ten) => ({ show: true, right: 6, top: -4, feature: { saveAsImage: { title: "Tải ảnh", name: ten || "xu-huong", pixelRatio: 2, backgroundColor: "#fff" /* chart-color-exception: print-export */ } }, iconStyle: { borderColor: T().textMuted }, emphasis: { iconStyle: { borderColor: CHEX.tealLine } } });
const dataZoomTruot = (bottom = 6) => ([
  { type: "inside", filterMode: "none" },
  { type: "slider", height: 15, bottom, filterMode: "none", brushSelect: false, borderColor: "transparent", fillerColor: echarts.color.modifyAlpha(CHEX.teal, 0.10), handleSize: "80%", moveHandleSize: 4, dataBackground: { lineStyle: { color: T().chartGrid }, areaStyle: { color: T().chartGrid } }, textStyle: { fontSize: 8, color: T().textMuted } },
]);

// ---- Hằng số thiết kế: DÙNG CHUNG qua lib/designTokens (hết lặp App/charts) ----
const xTickEvery = (n) => Math.max(0, Math.floor(n / 12));
function complyDomain(values) {
  const ys = values.filter((v) => v != null);
  if (!ys.length) return [0, 100];
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(4, (hi - lo) * 0.18);
  return [Math.max(0, Math.floor(lo - pad)), Math.min(100, Math.ceil(hi + pad))];
}
const chartWrap = "rounded-2xl p-2 bg-gradient-to-b from-info-soft/70 to-surface ring-1 ring-info-line/80";
const TT_CSS = "border-radius:12px;box-shadow:0 10px 30px -8px rgba(35,80,110,0.4);padding:8px 12px;"; // chart-color-exception: tooltip DOM shadow
const tooltipBase = () => ({ backgroundColor: T().surface, borderColor: T().border, borderWidth: 1, textStyle: { fontSize: 11, color: T().textStrong }, extraCssText: TT_CSS });
const gradient = (c, top = 0.30, bot = 0.02) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: echarts.color.modifyAlpha(c, top) }, { offset: 1, color: echarts.color.modifyAlpha(c, bot) }]);

// ---- Wrapper React quanh ECharts: init 1 lần, cập nhật option, tự resize ----
function EChart({ option, height = 200, width = "100%", className = "", group = null, onPointClick = null }) {
  const elRef = useRef(null);
  const instRef = useRef(null);
  const clickRef = useRef(onPointClick);
  clickRef.current = onPointClick;
  useEffect(() => {
    const inst = echarts.init(elRef.current, null, { renderer: "canvas" });
    instRef.current = inst;
    // Đăng ký instance để chức năng IN có thể xuất ảnh biểu đồ SẠCH (loại toolbox/dataZoom).
    const reg = (window.__bmsEcharts = window.__bmsEcharts || new Map());
    reg.set(elRef.current, inst);
    // Tooltip ĐỒNG BỘ: các chart cùng `group` (vd 3 chỉ tiêu 1 phòng) rê chuột cùng thời điểm.
    if (group) { inst.group = group; echarts.connect(group); }
    inst.on("click", (prm) => { if (clickRef.current) clickRef.current(prm); });
    // Click bất kỳ đâu trong vùng lưới → quy về mốc gần nhất trên trục X (đường
    // line ẩn symbol rất khó bấm trúng đúng điểm).
    inst.getZr().on("click", (e) => {
      if (!clickRef.current) return;
      const pt = [e.offsetX, e.offsetY];
      try {
        if (inst.containPixel("grid", pt)) {
          const xi = inst.convertFromPixel({ seriesIndex: 0 }, pt);
          if (xi && xi.length) clickRef.current({ dataIndex: Math.max(0, Math.round(xi[0])) });
        }
      } catch { /* chart chưa sẵn sàng */ }
    });
    const ro = new ResizeObserver(() => instRef.current && instRef.current.resize());
    ro.observe(elRef.current);
    return () => { ro.disconnect(); reg.delete(elRef.current); inst.dispose(); instRef.current = null; };
  }, [group]);
  useEffect(() => { if (instRef.current && option) instRef.current.setOption({ aria: { enabled: true, decal: { show: true } }, ...option }, true); }, [option]);
  return <div ref={elRef} className={className} style={{ width, height }} />;
}

// ---- Dải min–max / P5–P95 bằng CUSTOM series (thay hack 2 line stack cũ):
//   vẽ polygon theo từng ĐOẠN liên tục có đủ lo+hi → chịu được null, không phụ
//   thuộc stack (hack cũ vỡ khi lo âm hoặc chuỗi đứt quãng).
function bandCustomSeries({ name, points, color, alpha = 0.13, z = 1 }) {
  // points: [{lo, hi} | null theo index] — cùng trục category với series chính.
  const runs = [];
  let cur = null;
  points.forEach((p, i) => {
    if (p && p.lo != null && p.hi != null) { (cur = cur || []).push([i, +p.lo, +p.hi]); }
    else if (cur) { runs.push(cur); cur = null; }
  });
  if (cur) runs.push(cur);
  return {
    name, type: "custom", silent: true, z, tooltip: { show: false },
    // 1 phần tử dữ liệu "mồi" — toàn bộ polygon vẽ trong renderItem từ closure `runs`.
    data: [0],
    renderItem: (params, api) => ({
      type: "group",
      children: runs.map((run) => {
        const top = run.map(([i, , hi]) => api.coord([i, hi]));
        const bot = run.map(([i, lo]) => api.coord([i, lo])).reverse();
        return { type: "polygon", shape: { points: [...top, ...bot] }, style: { fill: echarts.color.modifyAlpha(color, alpha) }, silent: true };
      }),
      clipPath: { type: "rect", shape: { x: params.coordSys.x, y: params.coordSys.y, width: params.coordSys.width, height: params.coordSys.height } },
    }),
  };
}

const axisX = (labels, interval = 0, show = true) => ({
  type: "category", data: labels, boundaryGap: true,
  axisTick: { show: false }, axisLine: { show, lineStyle: { color: T().chartGrid } },
  axisLabel: show ? { fontSize: 9, color: T().chartAxis, interval } : { show: false },
});

// ====== Mini cột "điểm OOS theo giờ (8h)" — thẻ phòng ở tab Tổng quan ======
export function OOSMini({ data }) {
  const option = {
    animation: false,
    grid: { top: 6, right: 4, bottom: 18, left: 4, containLabel: false },
    tooltip: { trigger: "axis", ...tooltipBase(), formatter: (p) => `Giờ ${p[0].axisValue}<br/>${p[0].data} điểm OOS` },
    xAxis: { ...axisX(data.map((d) => d.label), 1), axisLine: { show: false } },
    yAxis: { type: "value", show: false, min: 0 },
    series: [{ type: "bar", data: data.map((d) => d.oos), barMaxWidth: 16, itemStyle: { color: CHEX.softCoral, borderRadius: [3, 3, 0, 0] } }],
  };
  return <EChart option={option} height={70} />;
}

// ====== MiniArea: % đạt theo thời gian (thẻ "Xu hướng theo cấp") ======
export function MiniArea({ data }) {
  const comps = data.map((d) => (d.comp == null ? null : d.comp));
  const option = {
    animation: false,
    grid: { top: 6, right: 4, bottom: 4, left: 4, containLabel: false },
    tooltip: { trigger: "axis", ...tooltipBase(), formatter: (p) => `${p[0].axisValue}<br/>${fmtPct(p[0].data)} % đạt` },
    xAxis: { ...axisX(data.map((d) => d.label), 0, false) },
    yAxis: { type: "value", show: false, scale: true, max: 100 },
    series: [{
      type: "line", data: comps, smooth: true, showSymbol: false, connectNulls: true,
      lineStyle: { color: COMPLY_OK, width: 2 }, areaStyle: { color: gradient(COMPLY_OK, 0.28, 0.02) },
      markLine: { silent: true, symbol: "none", label: { show: false }, data: [{ yAxis: 80 }], lineStyle: { color: CHEX.sand, type: "dashed", width: 1 } },
    }],
  };
  return <EChart option={option} height={84} />;
}

// ====== Sparkline (bảng xếp hạng rủi ro) — màu theo chiều tăng/giảm ======
export function Sparkline({ chuoi }) {
  if (!chuoi || chuoi.length < 2) return <span className="text-[12px] text-muted">—</span>;
  const last = chuoi[chuoi.length - 1]?.comp, first = chuoi[0]?.comp;
  const stroke = (last != null && first != null) ? (last >= first ? CHEX.teal : CHEX.coral) : CHEX.teal;
  const option = {
    animation: false,
    grid: { top: 3, right: 2, bottom: 0, left: 2, containLabel: false },
    tooltip: { trigger: "axis", ...tooltipBase(), formatter: (p) => `${p[0].axisValue}<br/>${fmtPct(p[0].data)} đạt` },
    xAxis: { ...axisX(chuoi.map((d) => d.label), 0, false) },
    yAxis: { type: "value", show: false, scale: true },
    series: [{ type: "line", data: chuoi.map((d) => d.comp), smooth: true, showSymbol: false, lineStyle: { color: stroke, width: 1.6 }, areaStyle: { color: echarts.color.modifyAlpha(stroke, 0.12) } }],
  };
  return <EChart option={option} height={30} width={96} />;
}

// ====== (A) % đạt TOÀN PHẦN + vùng OOS + ngưỡng 80% (chấm đỏ khi < 80) ======
export function ChartComplyTotal({ data, height = 280, idSuffix = "", incidents = null, prevData = null, onPointClick = null }) {
  const prevVals = (prevData || []).map((v) => (v == null ? null : +v));
  const [ymin, ymax] = complyDomain([...data.map((d) => d.comp), ...prevVals]);
  // Overlay SỰ CỐ: vạch dọc ⚑ tại thời điểm mở sự cố — incidents = [{idx, name}]
  const markLineData = [
    { yAxis: 80, lineStyle: { color: CHEX.sand, type: "dashed", width: 1.4 }, label: { formatter: "ngưỡng 80%", fontSize: 9, color: CHEX.sand, position: "insideEndTop" } },
    ...(incidents || []).filter((sc) => sc.idx >= 0 && sc.idx < data.length).map((sc) => ({
      xAxis: sc.idx,
      lineStyle: { color: CHEX.coral, type: "solid", width: 1.1, opacity: 0.65 },
      label: { formatter: "⚑", fontSize: 11, color: CHEX.coral, position: "insideEndTop", distance: 2 },
    })),
  ];
  const incByIdx = {};
  (incidents || []).forEach((sc) => { (incByIdx[sc.idx] = incByIdx[sc.idx] || []).push(sc.name); });
  const option = {
    animation: false,
    grid: { top: 18, right: 16, bottom: 34, left: 8, containLabel: true },
    toolbox: toolboxLuuAnh("ty-le-dat" + (idSuffix ? "-" + idSuffix : "")),
    dataZoom: dataZoomTruot(6),
    tooltip: {
      trigger: "axis", axisPointer: { type: "cross", label: { show: false } }, ...tooltipBase(),
      formatter: (ps) => {
        const cur = ps.find((x) => x.seriesName === "Kỳ này") || ps[0];
        const prv = ps.find((x) => x.seriesName === "Kỳ trước");
        const v = cur && cur.data != null ? (cur.data.value != null ? cur.data.value : cur.data) : null;
        const i = cur ? cur.dataIndex : -1;
        const sc = incByIdx[i] ? `<div style="color:${CHEX.coralDeep}">⚑ ${incByIdx[i].join("<br/>⚑ ")}</div>` : "";
        const pv = prv && prv.data != null ? `<div style="color:${T().textMuted}">Kỳ trước: ${fmtPct(prv.data)}</div>` : "";
        return `${cur ? cur.axisValue : ""}<br/>${fmtPct(v)} · OOS ${v == null ? "—" : (100 - v).toFixed(1) + "%"}${pv}${sc}`;
      },
    },
    xAxis: axisX(data.map((d) => d.label), xTickEvery(data.length)),
    yAxis: { type: "value", min: ymin, max: ymax, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: T().chartGrid } }, axisLabel: { fontSize: 9, color: T().chartAxis, formatter: "{value}%" } },
    series: [
      // "Bóng" KỲ TRƯỚC (xám đứt, canh theo index) — bật qua nút So kỳ trước.
      ...(prevVals.length ? [{
        name: "Kỳ trước", type: "line", smooth: true, connectNulls: true, showSymbol: false, silent: true, z: 1,
        data: data.map((_, i) => (prevVals[i] != null ? prevVals[i] : null)),
        lineStyle: { color: T().textMuted, width: 1.6, type: "dashed" },
      }] : []),
      {
        name: "Kỳ này", type: "line", smooth: true, connectNulls: false, showSymbol: true, symbolSize: 5, z: 3,
        data: data.map((d) => ({ value: d.comp, itemStyle: { color: d.comp != null && d.comp < 80 ? COMPLY_BAD : COMPLY_OK, borderColor: T().surface, borderWidth: 1 } })),
        lineStyle: { color: COMPLY_OK, width: 2.6 }, areaStyle: { color: gradient(COMPLY_OK, 0.30, 0.02) },
        markLine: { silent: true, symbol: "none", data: markLineData },
      },
    ],
  };
  return <div className={chartWrap} style={{ height: height + 16 }}><EChart option={option} height={height} onPointClick={onPointClick} /></div>;
}

// ====== (B) % đạt THEO TỪNG CHỈ TIÊU (DP/RH/T) ======
export function ChartComplyPerMetric({ data, present, height = 280 }) {
  const ks = ["DP", "RH", "T"].filter((k) => present.includes(k));
  const allVals = [];
  data.forEach((d) => ks.forEach((k) => { if (d[`comp_${k}`] != null) allVals.push(d[`comp_${k}`]); }));
  const [ymin, ymax] = complyDomain(allVals);
  const option = {
    animation: false,
    grid: { top: 20, right: 16, bottom: 34, left: 8, containLabel: true },
    toolbox: toolboxLuuAnh("ty-le-dat-theo-chi-tieu"),
    dataZoom: [{ type: "inside", filterMode: "none" }],
    legend: { data: ks.map((k) => SENSOR_META[k].label), bottom: 0, textStyle: { fontSize: 11, color: CHEX.ink }, icon: "roundRect", itemWidth: 14, itemHeight: 3 },
    tooltip: {
      trigger: "axis", ...tooltipBase(),
      formatter: (ps) => {
        const head = `<div style="font-weight:600;color:${CHEX.navy};margin-bottom:4px">${ps[0].axisValue}</div>`;
        return head + ps.map((p) => { const v = p.data; return `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${p.color}">● ${p.seriesName}</span><span>${fmtPct(v)} · OOS ${v == null ? "—" : (100 - v).toFixed(1) + "%"}</span></div>`; }).join("");
      },
    },
    xAxis: axisX(data.map((d) => d.label), xTickEvery(data.length)),
    yAxis: { type: "value", min: ymin, max: ymax, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: T().chartGrid } }, axisLabel: { fontSize: 9, color: T().chartAxis, formatter: "{value}%" } },
    series: ks.map((k) => ({
      name: SENSOR_META[k].label, type: "line", smooth: true, connectNulls: false, showSymbol: false,
      data: data.map((d) => d[`comp_${k}`]), lineStyle: { color: SENSOR_COLOR[k], width: 2.4 }, itemStyle: { color: SENSOR_COLOR[k] },
      areaStyle: { color: gradient(SENSOR_COLOR[k], 0.16, 0.01) },
      ...(k === ks[0] ? { markLine: { silent: true, symbol: "none", data: [{ yAxis: 80 }], lineStyle: { color: CHEX.sand, type: "dashed", width: 1.4 }, label: { formatter: "80%", fontSize: 9, color: CHEX.sand, position: "insideEndTop" } } } : {}),
    })),
  };
  return <div className={chartWrap} style={{ height: height + 16 }}><EChart option={option} height={height} /></div>;
}

// ====== Giá trị TB + dải P5–P95 + trung vị P50 + GHD/GHT + baseline 30 ngày ======
export function RoomBandChart({ sensorKey, series, baseline, group = null }) {
  const unit = SENSOR_META[sensorKey]?.unit || "";
  const color = SENSOR_COLOR[sensorKey] || CHEX.teal;
  const lo = [...series].reverse().find((p) => p.lo != null)?.lo ?? null;
  const hi = [...series].reverse().find((p) => p.hi != null)?.hi ?? null;
  const vals = series.filter((p) => p.avg != null);
  const mean = vals.length ? +(vals.reduce((a, p) => a + p.avg, 0) / vals.length).toFixed(2) : null;
  const hasPct = series.some((p) => p.p5 != null && p.p95 != null);   // dữ liệu phân vị (30 phút)
  const bTb = baseline && baseline.tb != null ? +baseline.tb : null;
  const bSig = baseline && baseline.sigma != null ? +baseline.sigma : null;
  // miền y bao gồm avg, GHD/GHT, P5/P95, baseline±σ để không cắt ngọn
  const dv = [];
  vals.forEach((p) => dv.push(p.avg));
  series.forEach((p) => { if (p.p5 != null) dv.push(p.p5); if (p.p95 != null) dv.push(p.p95); });
  if (lo != null) dv.push(lo); if (hi != null) dv.push(hi);
  if (bTb != null) { dv.push(bTb + (bSig || 0)); dv.push(bTb - (bSig || 0)); }
  const yLo = dv.length ? Math.min(...dv) : 0, yHi = dv.length ? Math.max(...dv) : 1;
  const pad = Math.max(0.5, (yHi - yLo) * 0.1);
  const hasDomain = dv.length && isFinite(yLo) && isFinite(yHi);
  const markLineData = [];
  if (lo != null) markLineData.push({ yAxis: lo, label: { formatter: `GHD ${lo}`, fontSize: 9, color: CHEX.coral, position: "insideStartBottom" }, lineStyle: { color: CHEX.coral, type: "dashed", width: 1.3 } });
  if (hi != null) markLineData.push({ yAxis: hi, label: { formatter: `GHT ${hi}`, fontSize: 9, color: CHEX.coral, position: "insideStartTop" }, lineStyle: { color: CHEX.coral, type: "dashed", width: 1.3 } });
  if (mean != null) markLineData.push({ yAxis: mean, label: { formatter: `TB ${mean}`, fontSize: 9, color: CHEX.navy, position: "insideEndTop" }, lineStyle: { color: CHEX.navy, type: "dashed", width: 1.2 } });
  if (bTb != null) markLineData.push({ yAxis: bTb, label: { formatter: `Nền 30n ${bTb}`, fontSize: 9, color: CHEX.sky, position: "insideEndBottom" }, lineStyle: { color: CHEX.sky, type: "dotted", width: 1.2 } });
  if (bTb != null && bSig != null && bSig > 0) {
    markLineData.push({ yAxis: +(bTb + bSig).toFixed(3), label: { show: false }, lineStyle: { color: echarts.color.modifyAlpha(CHEX.sky, 0.5), type: "dotted", width: 1 } });
    markLineData.push({ yAxis: +(bTb - bSig).toFixed(3), label: { show: false }, lineStyle: { color: echarts.color.modifyAlpha(CHEX.sky, 0.5), type: "dotted", width: 1 } });
  }
  const bandSeries = hasPct ? [bandCustomSeries({ name: "_p595", points: series.map((p) => (p.p5 != null && p.p95 != null ? { lo: p.p5, hi: p.p95 } : null)), color, alpha: 0.13 })] : [];
  const option = {
    animation: false,
    grid: { top: 14, right: 16, bottom: 34, left: 8, containLabel: true },
    toolbox: toolboxLuuAnh("gia-tri-" + sensorKey),
    dataZoom: dataZoomTruot(6),
    tooltip: {
      trigger: "axis", ...tooltipBase(),
      formatter: (ps) => {
        const i = ps[0].dataIndex; const p = series[i] || {}; const v = p.avg;
        if (v == null && p.p50 == null) return "";
        const oob = (lo != null && v < lo) || (hi != null && v > hi);
        const pctl = (p.p5 != null && p.p95 != null) ? `<div style="color:${T().textMuted}">P5–P95: ${(+p.p5).toFixed(2)}–${(+p.p95).toFixed(2)}${p.p50 != null ? ` · P50 ${(+p.p50).toFixed(2)}` : ""}</div>` : "";
        const base = (bTb != null) ? `<div style="color:${CHEX.sky}">Nền 30n: ${bTb}${bSig != null ? ` ± ${bSig}` : ""} ${unit}</div>` : "";
        return `<div style="font-weight:600;color:${CHEX.navy}">${ps[0].axisValue}</div><div>TB: <b style="color:${oob ? CHEX.coralDeep : color}">${v == null ? "—" : (+v).toFixed(2)} ${unit}</b>${oob ? ' <span style="color:${CHEX.coral}">· ngoài giới hạn</span>' : ""}</div><div style="color:${T().textMuted}">GHD ${lo == null ? "—" : lo} · GHT ${hi == null ? "—" : hi} ${unit}</div>${pctl}${base}`;
      },
    },
    xAxis: axisX(series.map((p) => p.label), xTickEvery(series.length)),
    yAxis: { type: "value", scale: true, ...(hasDomain ? { min: +(yLo - pad).toFixed(1), max: +(yHi + pad).toFixed(1) } : {}), axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: T().chartGrid } }, axisLabel: { fontSize: 9, color: T().chartAxis, formatter: (v) => `${+(+v).toFixed(1)}` } },
    series: [
      ...bandSeries,
      ...(hasPct ? [{ name: "P50", type: "line", data: series.map((p) => (p.p50 != null ? p.p50 : null)), connectNulls: true, showSymbol: false, symbol: "none", lineStyle: { color: echarts.color.modifyAlpha(color, 0.55), width: 1, type: "dashed" }, tooltip: { show: false }, z: 2 }] : []),
      {
        name: "TB", type: "line", smooth: true, connectNulls: true, showSymbol: true, symbolSize: 5, z: 3,
        data: series.map((p) => ({ value: p.avg, itemStyle: { color: (lo != null && p.avg < lo) || (hi != null && p.avg > hi) ? CHEX.coralDeep : color, borderColor: T().surface, borderWidth: 0.9 } })),
        lineStyle: { color, width: 2.4 }, areaStyle: hasPct ? undefined : { color: gradient(color, 0.16, 0.03) },
        markArea: (lo != null && hi != null) ? { silent: true, itemStyle: { color: echarts.color.modifyAlpha(color, 0.06) }, data: [[{ yAxis: lo }, { yAxis: hi }]] } : undefined,
        markLine: markLineData.length ? { silent: true, symbol: "none", data: markLineData } : undefined,
      },
    ],
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-2"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} /><h4 className="text-[14px] font-semibold" style={{ color: CHEX.navy }}>{SENSOR_META[sensorKey]?.label} ({sensorKey})</h4></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 text-center">{[["Trung bình", mean == null ? "—" : `${mean} ${unit}`], ["GHD", lo == null ? "—" : `${lo} ${unit}`], ["GHT", hi == null ? "—" : `${hi} ${unit}`], ["Nền 30n", bTb == null ? "—" : `${bTb}${bSig != null ? `±${bSig}` : ""}`]].map(([k, v]) => <div key={k} className="rounded-xl bg-subtle ring-1 ring-line py-1.5"><p className="text-[12px] uppercase text-muted font-semibold leading-tight">{k}</p><p className="text-[13px] font-semibold tabular-nums" style={{ color: CHEX.navy }}>{v}</p></div>)}</div>
      <EChart option={option} height={210} group={group} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-muted">{hasPct && <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm inline-block" style={{ background: color, opacity: 0.28 }} /> Dải P5–P95</span>}<span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} /> TB trong giới hạn</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHEX.coralDeep }} /> TB ngoài giới hạn</span><span className="flex items-center gap-1"><span className="w-4 inline-block border-t border-dotted" style={{ borderColor: CHEX.skyLine }} /> Nền 30 ngày ±σ</span></div>
    </div>
  );
}

// ====== Modal chi tiết phòng: TB giờ + dải min–max + GHD/GHT ======
export function RoomDetailMiniChart({ pts, smin, smax, mean, unit, group = null }) {
  const vals = []; pts.forEach((p) => { [p.avg, p.vmin, p.vmax].forEach((x) => { if (x != null) vals.push(+x); }); });
  if (smin != null) vals.push(+smin); if (smax != null) vals.push(+smax);
  let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const span = hi - lo; const dec = span >= 10 ? 0 : span >= 2 ? 1 : 2;
  const hasBand = pts.some((p) => p.vmin != null && p.vmax != null);
  const markLineData = [];
  if (smin != null) markLineData.push({ yAxis: smin, label: { formatter: `GHD ${smin}`, fontSize: 9, color: CHEX.coral, position: "insideStartBottom" }, lineStyle: { color: CHEX.coral, type: "dashed", width: 1.3 } });
  if (smax != null) markLineData.push({ yAxis: smax, label: { formatter: `GHT ${smax}`, fontSize: 9, color: CHEX.coral, position: "insideStartTop" }, lineStyle: { color: CHEX.coral, type: "dashed", width: 1.3 } });
  if (mean != null) markLineData.push({ yAxis: mean, label: { formatter: `TB ${mean}`, fontSize: 9, color: CHEX.navy, position: "insideEndTop" }, lineStyle: { color: CHEX.navy, type: "dashed", width: 1.2 } });
  const option = {
    animation: false,
    grid: { top: 8, right: 14, bottom: 20, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis", ...tooltipBase(),
      formatter: (ps) => {
        const byName = {}; ps.forEach((p) => { byName[p.seriesName] = p; });
        const avg = byName["TB giờ"] ? byName["TB giờ"].data : null;
        const f = (x) => (x == null ? "—" : (+x).toFixed(2));
        const lohi = hasBand ? `<div style="color:${T().textMuted}">Min–Max: ${f(pts[ps[0].dataIndex]?.vmin)}–${f(pts[ps[0].dataIndex]?.vmax)} ${unit}</div>` : "";
        return `<div style="font-weight:600;color:${CHEX.navy}">${ps[0].axisValue}</div><div>TB giờ: <b>${f(avg)} ${unit}</b></div>${lohi}`;
      },
    },
    xAxis: axisX(pts.map((p) => p.label)),
    yAxis: { type: "value", min: +lo.toFixed(dec), max: +hi.toFixed(dec), axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: T().chartGrid } }, axisLabel: { fontSize: 9, color: T().chartAxis, formatter: (v) => (+v).toFixed(dec) } },
    series: [
      // Dải min–max: custom polygon (chịu null, không cần stack)
      ...(hasBand ? [bandCustomSeries({ name: "_minmax", points: pts.map((p) => (p.vmin != null && p.vmax != null ? { lo: p.vmin, hi: p.vmax } : null)), color: CHEX.sky, alpha: 0.14 })] : []),
      {
        name: "TB giờ", type: "line", smooth: true, connectNulls: true, showSymbol: true, symbolSize: 6, z: 3,
        data: pts.map((p) => ({ value: p.avg, itemStyle: { color: (smin != null && p.avg < smin) || (smax != null && p.avg > smax) ? CHEX.coralDeep : CHEX.teal, borderColor: T().surface, borderWidth: 1 } })),
        lineStyle: { color: CHEX.teal, width: 2.2 },
        markArea: (smin != null && smax != null) ? { silent: true, itemStyle: { color: echarts.color.modifyAlpha(CHEX.teal, 0.10) }, data: [[{ yAxis: smin }, { yAxis: smax }]] } : undefined,
        markLine: markLineData.length ? { silent: true, symbol: "none", data: markLineData } : undefined,
      },
    ],
  };
  return <EChart option={option} height={182} group={group} />;
}

// ====== TrendMainChart (dự phòng): cột warning/critical + đường tỷ lệ đạt ======
export function TrendMainChart({ data, range }) {
  const interval = range === "90n" ? Math.floor(data.length / 9) : range === "30n" ? Math.floor(data.length / 10) : 0;
  const option = {
    animation: false,
    grid: { top: 16, right: 40, bottom: 24, left: 8, containLabel: true },
    tooltip: { trigger: "axis", ...tooltipBase() },
    legend: { show: false },
    xAxis: axisX(data.map((d) => d.label), interval),
    yAxis: [
      { type: "value", axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: T().chartGrid } }, axisLabel: { fontSize: 10, color: T().chartAxis } },
      { type: "value", min: 0, max: 100, position: "right", axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { fontSize: 10, color: T().chartAxis } },
    ],
    series: [
      { name: "Warning", type: "bar", stack: "h", data: data.map((d) => d.warnH), barMaxWidth: 26, itemStyle: { color: CHEX.sand } },
      { name: "Critical", type: "bar", stack: "h", data: data.map((d) => d.critH), barMaxWidth: 26, itemStyle: { color: CHEX.softCoral, borderRadius: [4, 4, 0, 0] } },
      { name: "Tỷ lệ đạt", type: "line", yAxisIndex: 1, smooth: true, showSymbol: false, data: data.map((d) => d.comp), lineStyle: { color: CHEX.teal, width: 2.6 }, itemStyle: { color: CHEX.teal }, markLine: { silent: true, symbol: "none", data: [{ yAxis: 80 }], lineStyle: { color: CHEX.sand, type: "dashed", width: 1.5 } } },
    ],
  };
  return <EChart option={option} height={300} />;
}

// ====== SPC — Levey-Jennings: giá trị ngày + vùng ±1/2/3σ + vi phạm Nelson ======
// Dữ liệu vào: series [{label, avg}] + baseline {tb, sigma} (nền 30 ngày, job đêm tính).
// Nelson rules đánh dấu TRỰC QUAN tại client (đỏ = R1 vượt 3σ; cam = R2 9 điểm cùng
// phía / R3 6 điểm đơn điệu) — kết luận chính thức vẫn theo xem_spc_canh_bao (SQL).
export function nelsonViolations(vals, tb, sigma) {
  const n = vals.length; const out = Array.from({ length: n }, () => []);
  if (tb == null || sigma == null || sigma <= 0) return out;
  const z = vals.map((v) => (v == null ? null : (v - tb) / sigma));
  for (let i = 0; i < n; i++) {
    if (z[i] != null && Math.abs(z[i]) > 3) out[i].push("R1: vượt 3σ");
    if (i >= 8) { const w = z.slice(i - 8, i + 1); if (w.every((x) => x != null && x > 0) || w.every((x) => x != null && x < 0)) out[i].push("R2: 9 điểm cùng phía"); }
    if (i >= 5) {
      const w = vals.slice(i - 5, i + 1);
      if (w.every((x) => x != null)) {
        const inc = w.every((x, j) => j === 0 || x > w[j - 1]), dec = w.every((x, j) => j === 0 || x < w[j - 1]);
        if (inc || dec) out[i].push(`R3: 6 điểm ${inc ? "tăng" : "giảm"} liên tiếp`);
      }
    }
  }
  return out;
}
export function SpcChart({ sensorKey, series, baseline, height = 230, group = null }) {
  const unit = SENSOR_META[sensorKey]?.unit || "";
  const color = SENSOR_COLOR[sensorKey] || CHEX.teal;
  const tb = baseline && baseline.tb != null ? +baseline.tb : null;
  const sig = baseline && baseline.sigma != null && +baseline.sigma > 0 ? +baseline.sigma : null;
  const vals = series.map((p) => (p.avg != null ? +p.avg : null));
  const vio = nelsonViolations(vals, tb, sig);
  if (tb == null || sig == null) {
    return <p className="text-[12px] text-muted italic">Chưa đủ nền 30 ngày (TB/σ) để dựng biểu đồ kiểm soát cho {SENSOR_META[sensorKey]?.label}.</p>;
  }
  const zones = [ // vùng sigma tô nhạt dần từ trong ra
    [tb - sig, tb + sig, 0.10], [tb - 2 * sig, tb - sig, 0.05], [tb + sig, tb + 2 * sig, 0.05],
    [tb - 3 * sig, tb - 2 * sig, 0.025], [tb + 2 * sig, tb + 3 * sig, 0.025],
  ];
  const dv = vals.filter((v) => v != null).concat([tb - 3.3 * sig, tb + 3.3 * sig]);
  const yLo = Math.min(...dv), yHi = Math.max(...dv); const pad = (yHi - yLo) * 0.06;
  const sigLines = [
    { yAxis: tb, label: { formatter: `TB ${+tb.toFixed(2)}`, fontSize: 9, color: CHEX.navy, position: "insideEndTop" }, lineStyle: { color: CHEX.navy, type: "solid", width: 1.4 } },
    ...[1, 2, 3].flatMap((k) => [
      { yAxis: tb + k * sig, label: { formatter: `+${k}σ`, fontSize: 8, color: T().textMuted, position: "end" }, lineStyle: { color: k === 3 ? CHEX.coral : T().chartGrid, type: "dashed", width: k === 3 ? 1.4 : 1 } },
      { yAxis: tb - k * sig, label: { formatter: `−${k}σ`, fontSize: 8, color: T().textMuted, position: "end" }, lineStyle: { color: k === 3 ? CHEX.coral : T().chartGrid, type: "dashed", width: k === 3 ? 1.4 : 1 } },
    ]),
  ];
  const option = {
    animation: false,
    grid: { top: 16, right: 34, bottom: 26, left: 8, containLabel: true },
    toolbox: toolboxLuuAnh("spc-" + sensorKey),
    dataZoom: [{ type: "inside", filterMode: "none" }],
    tooltip: {
      trigger: "axis", ...tooltipBase(),
      formatter: (ps) => {
        const i = ps[0].dataIndex; const v = vals[i];
        const z = v != null ? ((v - tb) / sig).toFixed(2) : null;
        const rules = vio[i].length ? `<div style="color:${CHEX.coralDeep}">⚠ ${vio[i].join("<br/>⚠ ")}</div>` : `<div style="color:${CHEX.teal}">Trong kiểm soát</div>`;
        return `<div style="font-weight:600;color:${CHEX.navy}">${ps[0].axisValue}</div><div>${v == null ? "—" : (+v).toFixed(2)} ${unit} ${z != null ? `· z=${z}` : ""}</div>${rules}`;
      },
    },
    xAxis: axisX(series.map((p) => p.label), xTickEvery(series.length)),
    yAxis: { type: "value", min: +(yLo - pad).toFixed(2), max: +(yHi + pad).toFixed(2), axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }, axisLabel: { fontSize: 9, color: T().chartAxis } },
    series: [{
      name: "Giá trị", type: "line", smooth: false, connectNulls: true, showSymbol: true, symbolSize: 6, z: 3,
      data: vals.map((v, i) => ({ value: v, itemStyle: { color: vio[i].some((r) => r.startsWith("R1")) ? CHEX.coralDeep : vio[i].length ? CHEX.sand : color, borderColor: T().surface, borderWidth: 1 } })),
      lineStyle: { color, width: 1.8 },
      markArea: { silent: true, data: zones.map(([lo, hi, a]) => [{ yAxis: lo, itemStyle: { color: echarts.color.modifyAlpha(color, a) } }, { yAxis: hi }]) },
      markLine: { silent: true, symbol: "none", data: sigLines },
    }],
  };
  return (
    <div>
      <EChart option={option} height={height} group={group} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-muted">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} /> Trong kiểm soát</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHEX.sandDeep }} /> Tín hiệu Nelson R2/R3</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHEX.coralDeep }} /> Vượt 3σ (R1)</span>
        <span className="flex items-center gap-1"><span className="w-4 inline-block border-t border-dashed" style={{ borderColor: T().chartGrid }} /> ±1/2/3σ quanh nền 30 ngày</span>
      </div>
    </div>
  );
}

// ====== Heatmap LỊCH: mỗi ô = 1 ngày, màu = % đạt — nhìn 1 phát thấy tuần xấu ======
// days: [{date:'YYYY-MM-DD', value:comp|null}]
export function CalendarHeat({ days, height = 190 }) {
  const valid = (days || []).filter((d) => d.value != null && d.date);
  if (!valid.length) return <p className="text-[12px] text-muted italic">Chưa có dữ liệu ngày để dựng lịch tỷ lệ đạt.</p>;
  const dates = valid.map((d) => d.date).sort();
  const option = {
    animation: false,
    tooltip: { ...tooltipBase(), formatter: (p) => `${p.data[0]}<br/><b>${fmtPct(p.data[1])}</b> đạt` },
    visualMap: {
      type: "piecewise", orient: "horizontal", left: "center", bottom: 0,
      pieces: complyPieces(),   // Mảng 3: dùng thang màu chuẩn duy nhất
      textStyle: { fontSize: 9, color: T().chartAxis }, itemWidth: 12, itemHeight: 12,
    },
    calendar: {
      top: 22, left: 40, right: 10, bottom: 34, cellSize: ["auto", 15],
      range: [dates[0], dates[dates.length - 1]],
      itemStyle: { color: T().subtle, borderWidth: 2.5, borderColor: T().surface },
      splitLine: { lineStyle: { color: T().chartGrid, width: 1 } },
      dayLabel: { nameMap: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"], fontSize: 8.5, color: T().textMuted, firstDay: 1 },
      monthLabel: { nameMap: ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"], fontSize: 9.5, color: T().chartAxis },
      yearLabel: { show: false },
    },
    series: [{ type: "heatmap", coordinateSystem: "calendar", data: valid.map((d) => [d.date, d.value]) }],
  };
  return <EChart option={option} height={height} />;
}

// ====== Heatmap PHÒNG × NGÀY (cartesian2d) — "phòng NÀO xấu, ngày nào xấu" ======
// Mảng 3: bổ sung trục PHÒNG (CalendarHeat cũ chỉ 1 chiều nhà máy×ngày). Dùng
// ECharts heatmap trên cartesian2d: X=ngày, Y=phòng, visualMap piecewise theo
// thang màu tỷ lệ đạt chuẩn. Nhận:
//   rooms  : ['C1.R19', …]           (nhãn trục Y — thứ tự do caller sắp, vd theo Khu/AHU, xấu lên trên)
//   days   : ['01/07', …]            (nhãn trục X)
//   values : number[rooms][days]     (%-đạt hoặc null nếu thiếu dữ liệu)
export function RoomDayHeatmap({ rooms, days, values, height, cellH = 18 }) {
  if (!rooms?.length || !days?.length) return <p className="text-[12px] text-muted italic">Chưa đủ dữ liệu phòng×ngày để dựng bản đồ tỷ lệ đạt.</p>;
  const data = [];
  for (let y = 0; y < rooms.length; y++) {
    const row = values[y] || [];
    for (let x = 0; x < days.length; x++) {
      const v = row[x];
      data.push([x, y, v == null || isNaN(v) ? "-" : +(+v).toFixed(1)]);   // "-" = ô trống (ECharts bỏ qua)
    }
  }
  const h = height || Math.max(140, rooms.length * cellH + 70);
  const option = {
    animation: false,
    grid: { top: 8, right: 12, bottom: 46, left: 8, containLabel: true },
    tooltip: {
      position: "top", ...tooltipBase(),
      formatter: (p) => `${rooms[p.data[1]]} · ${days[p.data[0]]}<br/><b>${p.data[2] === "-" ? "thiếu dữ liệu" : fmtPct(p.data[2])}</b>`,
    },
    xAxis: { type: "category", data: days, splitArea: { show: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: T().chartGrid } }, axisLabel: { fontSize: 9, color: T().chartAxis, interval: xTickEvery(days.length) } },
    yAxis: { type: "category", data: rooms, splitArea: { show: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: T().chartGrid } }, axisLabel: { fontSize: 10, color: T().chartAxis } },
    visualMap: { type: "piecewise", orient: "horizontal", left: "center", bottom: 6, pieces: complyPieces(), textStyle: { fontSize: 9, color: T().chartAxis }, itemWidth: 12, itemHeight: 12 },
    series: [{
      name: "% đạt", type: "heatmap", data,
      label: { show: rooms.length * days.length <= 240, fontSize: 8, color: T().textStrong, formatter: (p) => (p.data[2] === "-" ? "" : Math.round(p.data[2])) },
      itemStyle: { borderColor: T().surface, borderWidth: 1.5 },
      emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(35,80,110,0.4)" } },
    }],
  };
  return <EChart option={option} height={h} />;
}

// ====== Dự báo xu hướng (Mảng 3): lịch sử + đường chiếu + dải tin cậy ======
// chuoi=[{ngay,y}] (lịch sử) · duBao=[{ngay,gia_tri,canh_duoi,canh_tren}] (chiếu tới).
// Dải tin cậy dựng bằng kỹ thuật stack 2 series (nền trong suốt + phần tô).
export function ForecastChart({ chuoi, duBao, height = 180 }) {
  const hist = (chuoi || []).map((p) => (p.y == null ? null : +p.y));
  const fc = duBao || [];
  if (!hist.length || !fc.length) return <p className="text-[12px] text-muted italic">Chưa đủ dữ liệu để vẽ dự báo.</p>;
  const fmtD = (s) => String(s).slice(5).split("-").reverse().join("/");
  const N = hist.length, F = fc.length;
  const labels = [...(chuoi || []).map((p) => fmtD(p.ngay)), ...fc.map((p) => fmtD(p.ngay))];
  const lastY = hist[hist.length - 1];
  const histData = [...hist, ...Array(F).fill(null)];
  const fcData = [...Array(N - 1).fill(null), lastY, ...fc.map((p) => +p.gia_tri)];      // nối từ điểm cuối lịch sử
  const bandLow = [...Array(N).fill(null), ...fc.map((p) => +p.canh_duoi)];               // nền dải (ẩn)
  const bandDelta = [...Array(N).fill(null), ...fc.map((p) => +p.canh_tren - +p.canh_duoi)]; // phần tô = trên − dưới
  const allV = [...hist.filter((v) => v != null), ...fc.map((p) => +p.canh_duoi), ...fc.map((p) => +p.canh_tren)];
  const ymin = Math.max(0, Math.floor(Math.min.apply(null, allV) - 2));
  const ymax = Math.min(100, Math.ceil(Math.max.apply(null, allV) + 2));
  const option = {
    animation: false,
    grid: { top: 10, right: 12, bottom: 22, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis", ...tooltipBase(),
      formatter: (ps) => {
        const l = ps[0].axisValue;
        const h = ps.find((x) => x.seriesName === "Lịch sử" && x.data != null);
        const f = ps.find((x) => x.seriesName === "Ước tính" && x.data != null);
        const row = h || f;
        return `${l}<br/>${row ? fmtPct(row.data) : "—"}${f && !h ? " (ước tính)" : ""}`;
      },
    },
    xAxis: { ...axisX(labels, xTickEvery(labels.length), true) },
    yAxis: { type: "value", scale: true, min: ymin, max: ymax, axisLabel: { fontSize: 9, color: T().chartAxis, formatter: (v) => v + "%" }, splitLine: { lineStyle: { color: T().chartGrid } } },
    series: [
      { name: "band-nen", type: "line", data: bandLow, stack: "cf", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
      { name: "band-to", type: "line", data: bandDelta, stack: "cf", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: echarts.color.modifyAlpha(COMPLY_OK, 0.13) }, silent: true, tooltip: { show: false } },
      { name: "Lịch sử", type: "line", data: histData, showSymbol: false, connectNulls: false, lineStyle: { color: COMPLY_OK, width: 2.2 } },
      { name: "Ước tính", type: "line", data: fcData, showSymbol: false, connectNulls: true, lineStyle: { color: COMPLY_OK, width: 2, type: "dashed" } },
      { name: "nguong", type: "line", data: [], markLine: { silent: true, symbol: "none", label: { formatter: "80%", fontSize: 9, color: CHEX.sand, position: "insideEndTop" }, data: [{ yAxis: 80 }], lineStyle: { color: CHEX.sand, type: "dashed", width: 1 } } },
    ],
  };
  return <EChart option={option} height={height} />;
}

// ====== Điểm vào điều phối ======
// ====== Tỉ lệ phản hồi của các bộ phận theo NGÀY (tab Nhiệm vụ) ======
// Dữ liệu vào: { ngay[], series: [{vai_tro, nhan, mau, diem:[{pct, can, da}]}] }.
// Ngày KHÔNG có phiếu nào để pct = null ⇒ đường ĐỨT tại đó (connectNulls:false).
// Cố ý không nối liền: "hôm đó không có phiếu" khác hẳn "có phiếu mà không ai đụng",
// nối liền hai đoạn qua ngày rỗng là bịa ra một xu hướng không có thật.
export function PhanHoiTheoNgayChart({ ngay, series, height = 260 }) {
  const option = {
    animation: false,
    grid: { top: 30, right: 14, bottom: 34, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis", ...tooltipBase(),
      formatter: (ps) => {
        if (!ps || !ps.length) return "";
        const i = ps[0].dataIndex;
        let h = `<b>${ngay[i]}</b>`;
        for (const s of series) {
          const d = s.diem[i] || {};
          h += `<br/><span style="display:inline-block;width:8px;height:8px;border-radius:9px;background:${s.mau}"></span> ${s.nhan}: `
            + (d.pct == null ? `<i style="color:${T().textMuted}">không có phiếu</i>` : `<b>${d.pct}%</b> <span style="color:${T().textMuted}">(${d.da}/${d.can} phiếu)</span>`);
        }
        return h;
      },
    },
    legend: { top: 0, itemWidth: 14, itemHeight: 8, textStyle: { fontSize: 11, color: T().chartAxis } },
    xAxis: axisX(ngay, xTickEvery(ngay.length)),
    yAxis: { type: "value", min: 0, max: 100, axisLine: { show: false }, axisTick: { show: false },
             splitLine: { lineStyle: { color: T().chartGrid } },
             axisLabel: { fontSize: 10, color: T().chartAxis, formatter: "{value}%" } },
    series: series.map((s) => ({
      name: s.nhan, type: "line", smooth: false, connectNulls: false,
      showSymbol: true, symbolSize: 5,
      data: s.diem.map((d) => (d && d.pct != null ? d.pct : null)),
      lineStyle: { color: s.mau, width: 2.2 }, itemStyle: { color: s.mau },
    })),
  };
  return <EChart option={option} height={height} />;
}

export default function LazyChart({ type, ...p }) {
  useThemeVersion();   // đổi theme → dựng lại option với token mới (chart không giữ nguyên ở light)
  switch (type) {
    case "oosMini": return <OOSMini data={p.data} />;
    case "roomBand": return <RoomBandChart sensorKey={p.sensorKey} series={p.series} baseline={p.baseline} isHourly={p.isHourly} group={p.group} />;
    case "complyPerMetric": return <ChartComplyPerMetric data={p.data} present={p.present} />;
    case "complyTotal": return <ChartComplyTotal data={p.data} idSuffix={p.idSuffix} incidents={p.incidents} prevData={p.prevData} onPointClick={p.onPointClick} />;
    case "miniArea": return <MiniArea data={p.data} />;
    case "sparkline": return <Sparkline chuoi={p.chuoi} />;
    case "roomDetail": return <RoomDetailMiniChart pts={p.pts} smin={p.smin} smax={p.smax} mean={p.mean} unit={p.unit} group={p.group} />;
    case "trendMain": return <TrendMainChart data={p.data} range={p.range} />;
    case "spc": return <SpcChart sensorKey={p.sensorKey} series={p.series} baseline={p.baseline} group={p.group} />;
    case "calHeat": return <CalendarHeat days={p.days} />;
    case "roomDayHeat": return <RoomDayHeatmap rooms={p.rooms} days={p.days} values={p.values} height={p.height} cellH={p.cellH} />;
    case "forecast": return <ForecastChart chuoi={p.chuoi} duBao={p.duBao} height={p.height} />;
    case "phanHoiNgay": return <PhanHoiTheoNgayChart ngay={p.ngay} series={p.series} height={p.height} />;
    default: return null;
  }
}
