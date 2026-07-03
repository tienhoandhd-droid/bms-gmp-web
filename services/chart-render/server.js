// ============================================================================
// chart-render — dịch vụ render biểu đồ ECharts SSR → PNG cho báo cáo BMS-GMP
// (mục B2, KE-HOACH-NANG-CAP-BIEU-DO-BAO-CAO.md)
//
// Nguyên tắc:
//   - Biểu đồ email/PDF phải GIỐNG dashboard → option builders dưới đây mô phỏng
//     giao diện web/src/components/charts.jsx (markLine 80%, dải màu, traffic light).
//   - ECharts init {renderer:'svg', ssr:true} → renderToSVGString() → sharp
//     rasterize SVG → PNG (mail client không hiểu SVG; PNG an toàn mọi client).
//   - Font: 'Be Vietnam Pro, Noto Sans, sans-serif' — container PHẢI cài font
//     tiếng Việt (xem Dockerfile), nếu không dấu tiếng Việt thành ô vuông.
//   - Auth: Bearer token qua env CHART_RENDER_TOKEN (không đặt → bỏ kiểm tra,
//     chỉ dùng khi service nằm trong mạng nội bộ cạnh n8n).
// ============================================================================
'use strict'

const express = require('express')
const echarts = require('echarts')
const sharp = require('sharp')

const PORT = Number(process.env.PORT || 8081)
const TOKEN = process.env.CHART_RENDER_TOKEN || ''

// ---- Token màu — đồng bộ với dashboard (traffic light thống nhất báo cáo) ----
const COLOR = {
  teal: '#0d9488',   // đạt / OK
  red: '#b91c1c',    // không đạt / vi phạm
  sky: '#0284c7',    // thông tin / baseline
  sand: '#d97706',   // ngưỡng / cảnh báo
  ink: '#334155',
  grid: '#e2e8f0',
  muted: '#64748b',
}
const FONT = 'Be Vietnam Pro, Noto Sans, sans-serif'

// Đèn giao thông: xanh ≥95, vàng 80–95, đỏ <80 (chốt ngưỡng với QA)
const trafficColor = (v) => (v == null ? COLOR.muted : v >= 95 ? COLOR.teal : v >= 80 ? COLOR.sand : COLOR.red)

// ---- Chuẩn hoá dữ liệu vào: chấp nhận nhiều hình dạng từ n8n -----------------
// [{ngay|label, ty_le|gia_tri|value}] | {labels:[], values:[]} | [số, số, …]
function toXY(data) {
  if (!data) return { labels: [], values: [] }
  if (Array.isArray(data)) {
    if (data.length && typeof data[0] === 'object') {
      return {
        labels: data.map((d) => d.ngay ?? d.label ?? d.x ?? ''),
        values: data.map((d) => num(d.ty_le ?? d.gia_tri ?? d.value ?? d.y)),
      }
    }
    return { labels: data.map((_, i) => String(i + 1)), values: data.map(num) }
  }
  if (Array.isArray(data.labels) && Array.isArray(data.values)) {
    return { labels: data.labels, values: data.values.map(num) }
  }
  return { labels: [], values: [] }
}
const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))

const baseText = { fontFamily: FONT, color: COLOR.ink }
const axisBase = {
  axisLine: { lineStyle: { color: COLOR.grid } },
  axisLabel: { fontFamily: FONT, color: COLOR.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: COLOR.grid } },
}

// ============================ OPTION BUILDERS ================================

// 'line' — tuân thủ theo ngày: đường teal + area gradient + markLine 80% đứt nét
function buildLine(data, opts = {}) {
  const { labels, values } = toXY(data)
  return {
    textStyle: baseText,
    title: opts.title
      ? { text: opts.title, left: 8, top: 4, textStyle: { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: COLOR.ink } }
      : undefined,
    grid: { left: 44, right: 16, top: opts.title ? 36 : 18, bottom: 28 },
    xAxis: { type: 'category', data: labels, boundaryGap: false, ...axisBase, splitLine: { show: false } },
    yAxis: {
      type: 'value',
      min: opts.yMin ?? ((v) => Math.max(0, Math.floor(Math.min(v.min, 78)))),
      max: opts.yMax ?? 100,
      ...axisBase,
      axisLabel: { ...axisBase.axisLabel, formatter: '{value}%' },
    },
    series: [{
      name: opts.seriesName || 'Tuân thủ',
      type: 'line',
      data: values,
      smooth: true,
      showSymbol: values.length <= 31,
      symbolSize: 5,
      connectNulls: false,
      lineStyle: { color: COLOR.teal, width: 2.6 },
      itemStyle: { color: (p) => trafficColor(p.value) },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(13,148,136,0.28)' },
            { offset: 1, color: 'rgba(13,148,136,0.02)' },
          ],
        },
      },
      markLine: {
        silent: true, symbol: 'none',
        data: [{ yAxis: opts.nguong ?? 80 }],
        lineStyle: { color: COLOR.sand, type: 'dashed', width: 1.5 },
        label: { formatter: `ngưỡng ${opts.nguong ?? 80}%`, fontFamily: FONT, fontSize: 10, color: COLOR.sand, position: 'insideEndTop' },
      },
    }],
  }
}

// 'bar' — top phòng rủi ro (bar ngang, phòng tệ nhất trên cùng, màu traffic light)
function buildBar(data, opts = {}) {
  const rows = (Array.isArray(data) ? data : []).map((d) => ({
    name: d.ten_phong ?? d.ma_phong ?? d.label ?? '',
    value: num(d.ty_le_tuan_thu ?? d.ty_le ?? d.value),
  }))
  // ECharts vẽ category từ dưới lên → đảo để phòng rủi ro nhất nằm TRÊN cùng
  const rev = rows.slice().reverse()
  return {
    textStyle: baseText,
    title: opts.title
      ? { text: opts.title, left: 8, top: 4, textStyle: { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: COLOR.ink } }
      : undefined,
    grid: { left: 130, right: 48, top: opts.title ? 36 : 14, bottom: 26 },
    xAxis: { type: 'value', min: 0, max: 100, ...axisBase, axisLabel: { ...axisBase.axisLabel, formatter: '{value}%' } },
    yAxis: { type: 'category', data: rev.map((r) => r.name), ...axisBase, splitLine: { show: false } },
    series: [{
      type: 'bar',
      data: rev.map((r) => ({ value: r.value, itemStyle: { color: trafficColor(r.value), borderRadius: [0, 4, 4, 0] } })),
      barMaxWidth: 22,
      label: { show: true, position: 'right', fontFamily: FONT, fontSize: 11, color: COLOR.ink, formatter: (p) => (p.value == null ? '—' : `${p.value}%`) },
      markLine: {
        silent: true, symbol: 'none',
        data: [{ xAxis: opts.nguong ?? 80 }],
        lineStyle: { color: COLOR.sand, type: 'dashed', width: 1.4 },
        label: { show: false },
      },
    }],
  }
}

// 'sparkline' — đường mini 120×36 cho từng dòng bảng top phòng
function buildSparkline(data, opts = {}) {
  const { values } = toXY(data)
  const last = values.filter((v) => v != null).slice(-1)[0]
  return {
    textStyle: baseText,
    grid: { left: 2, right: 2, top: 3, bottom: 3 },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: values.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: (v) => Math.min(v.min, (opts.nguong ?? 80) - 2), max: 100 },
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { color: trafficColor(last), width: 1.6 },
      areaStyle: { color: last != null && last < (opts.nguong ?? 80) ? 'rgba(185,28,28,0.10)' : 'rgba(13,148,136,0.10)' },
      markLine: {
        silent: true, symbol: 'none',
        data: [{ yAxis: opts.nguong ?? 80 }],
        lineStyle: { color: COLOR.sand, type: 'dashed', width: 0.8, opacity: 0.7 },
        label: { show: false },
      },
    }],
  }
}

// 'calendarHeatmap' — lịch: ô = ngày, màu = % tuân thủ (đỏ→vàng→teal)
// data: [{ngay:'YYYY-MM-DD', ty_le|gia_tri}]; options: {tu, den, min, max, title}
function buildCalendarHeatmap(data, opts = {}) {
  const rows = (Array.isArray(data) ? data : [])
    .map((d) => [d.ngay ?? d.label, num(d.ty_le ?? d.gia_tri ?? d.value)])
    .filter((r) => r[0] && r[1] != null)
  const dates = rows.map((r) => r[0]).sort()
  const range = opts.tu && opts.den ? [opts.tu, opts.den]
    : dates.length ? [dates[0], dates[dates.length - 1]] : new Date().getFullYear()
  return {
    textStyle: baseText,
    title: opts.title
      ? { text: opts.title, left: 8, top: 2, textStyle: { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: COLOR.ink } }
      : undefined,
    visualMap: {
      min: opts.min ?? 60,
      max: opts.max ?? 100,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemHeight: 90,
      textStyle: { fontFamily: FONT, fontSize: 10, color: COLOR.muted },
      // thấp = đỏ (vi phạm nhiều) → cao = teal (đạt) — cùng nghĩa traffic light
      inRange: { color: [COLOR.red, COLOR.sand, '#facc15', COLOR.teal] },
    },
    calendar: {
      range,
      left: 46, right: 12, top: opts.title ? 42 : 24, bottom: 40,
      cellSize: ['auto', 'auto'],
      dayLabel: { firstDay: 1, nameMap: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], fontFamily: FONT, fontSize: 10, color: COLOR.muted },
      monthLabel: { nameMap: ['Th1','Th2','Th3','Th4','Th5','Th6','Th7','Th8','Th9','Th10','Th11','Th12'], fontFamily: FONT, fontSize: 11, color: COLOR.ink },
      yearLabel: { show: false },
      itemStyle: { borderWidth: 2, borderColor: '#ffffff' },
      splitLine: { lineStyle: { color: COLOR.grid, width: 1 } },
    },
    series: [{
      type: 'heatmap',
      coordinateSystem: 'calendar',
      data: rows,
      label: { show: false },
    }],
  }
}

// 'spc' — Levey-Jennings: đường giá trị + mean + ±1σ/2σ/3σ, điểm ngoài 3σ tô đỏ
// data: {diem:[{ngay|label, gia_tri}], mean, sigma} hoặc {values, mean, sigma}
function buildSpc(data, opts = {}) {
  const d = data || {}
  const { labels, values } = toXY(d.diem ?? d.values ?? d.data ?? [])
  const mean = num(d.mean ?? d.muc_tieu ?? opts.mean)
  const sigma = num(d.sigma ?? opts.sigma)
  const mk = []
  if (mean != null) {
    mk.push({ yAxis: mean, lineStyle: { color: COLOR.ink, type: 'solid', width: 1.4 }, label: { formatter: 'TB', fontFamily: FONT, fontSize: 10, color: COLOR.ink, position: 'insideEndTop' } })
    if (sigma != null && sigma > 0) {
      for (const [k, style] of [[1, 'dotted'], [2, 'dashed'], [3, 'dashed']]) {
        const color = k === 3 ? COLOR.red : k === 2 ? COLOR.sand : COLOR.sky
        for (const sign of [1, -1]) {
          mk.push({
            yAxis: +(mean + sign * k * sigma).toFixed(3),
            lineStyle: { color, type: style, width: k === 3 ? 1.4 : 1 },
            label: { formatter: `${sign > 0 ? '+' : '−'}${k}σ`, fontFamily: FONT, fontSize: 9, color, position: 'insideEndTop' },
          })
        }
      }
    }
  }
  const ngoai3s = (v) => mean != null && sigma != null && sigma > 0 && v != null && Math.abs(v - mean) > 3 * sigma
  return {
    textStyle: baseText,
    title: {
      text: opts.title || 'Biểu đồ kiểm soát SPC (Levey-Jennings)',
      left: 8, top: 4,
      textStyle: { fontFamily: FONT, fontSize: 13, fontWeight: 600, color: COLOR.ink },
    },
    grid: { left: 48, right: 44, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: labels, boundaryGap: false, ...axisBase, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, ...axisBase },
    series: [{
      type: 'line',
      data: values.map((v) => ({
        value: v,
        itemStyle: { color: ngoai3s(v) ? COLOR.red : COLOR.sky },
        symbolSize: ngoai3s(v) ? 9 : 5,
      })),
      showSymbol: true,
      smooth: false,
      connectNulls: false,
      lineStyle: { color: COLOR.sky, width: 1.8 },
      markLine: mk.length ? { silent: true, symbol: 'none', data: mk } : undefined,
    }],
  }
}

const BUILDERS = {
  line: { build: buildLine, w: 720, h: 300 },
  bar: { build: buildBar, w: 720, h: 300 },
  sparkline: { build: buildSparkline, w: 120, h: 36 },
  calendarHeatmap: { build: buildCalendarHeatmap, w: 760, h: 220 },
  spc: { build: buildSpc, w: 720, h: 320 },
}

// ============================== RENDER CORE ==================================

async function renderPng({ type, data, options = {}, width, height, theme }) {
  const spec = BUILDERS[type]
  if (!spec) throw Object.assign(new Error(`Loại biểu đồ không hỗ trợ: ${type}. Hỗ trợ: ${Object.keys(BUILDERS).join(', ')}`), { status: 400 })
  const w = Math.min(Math.max(Number(width) || spec.w, 40), 2000)
  const h = Math.min(Math.max(Number(height) || spec.h, 20), 2000)

  const chart = echarts.init(null, theme || null, { renderer: 'svg', ssr: true, width: w, height: h })
  let svg
  try {
    const option = spec.build(data, options)
    option.backgroundColor = options.backgroundColor || '#ffffff'
    option.animation = false
    chart.setOption(option)
    svg = chart.renderToSVGString()
  } finally {
    chart.dispose()
  }

  // Rasterize ×2 (pixelRatio 2 — email retina); sharp dùng font hệ thống qua
  // fontconfig → container PHẢI có font tiếng Việt (fonts-noto-core + fonts/).
  const scale = Math.min(Math.max(Number(options.pixelRatio) || 2, 1), 4)
  return sharp(Buffer.from(svg), { density: 72 * scale })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()
}

// ================================ HTTP API ===================================

const app = express()
app.use(express.json({ limit: '4mb' }))

app.get('/healthz', (_req, res) => res.json({ ok: true, service: 'chart-render', types: Object.keys(BUILDERS) }))

// Bearer auth (tùy chọn): đặt CHART_RENDER_TOKEN thì mọi POST /render phải kèm
// header "Authorization: Bearer <token>". Không đặt → bỏ qua kiểm tra.
app.use('/render', (req, res, next) => {
  if (!TOKEN) return next()
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (got !== TOKEN) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Thiếu hoặc sai Bearer token (CHART_RENDER_TOKEN)' })
  next()
})

app.post('/render', async (req, res) => {
  try {
    const { type, data, options, width, height, theme } = req.body || {}
    if (!type) return res.status(400).json({ error: 'BAD_REQUEST', message: 'Thiếu trường "type"' })
    const png = await renderPng({ type, data, options, width, height, theme })
    res.set('Content-Type', 'image/png')
    res.set('Cache-Control', 'no-store')
    res.send(png)
  } catch (e) {
    const status = e.status || 500
    if (status >= 500) console.error('[render] lỗi:', e)
    res.status(status).json({ error: status === 400 ? 'BAD_REQUEST' : 'RENDER_FAILED', message: e.message })
  }
})

app.listen(PORT, () => {
  console.log(`chart-render lắng nghe cổng ${PORT} — POST /render, GET /healthz`)
  if (!TOKEN) console.log('CẢNH BÁO: CHART_RENDER_TOKEN chưa đặt — /render KHÔNG yêu cầu xác thực (chỉ dùng trong mạng nội bộ).')
})

module.exports = { app, renderPng } // cho phép test không cần HTTP
