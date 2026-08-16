import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays, ChevronLeft, ChevronRight, Download, FileText, Filter,
  RefreshCw, Search, X,
} from 'lucide-react'
import {
  AUDIT_ACTION_OPTIONS, TRANG_THAI_CODE_TO_LABEL, traCuuNhatKyAudit,
} from '../lib/supabaseData'
import { moTaLoi } from '../lib/bmsClient'
import { COLOR } from '../lib/designTokens'
import {
  buildAuditCsv, formatAuditUtc as formatUtc, formatAuditVn as formatVn,
  makeAuditCsvFilename,
} from '../lib/auditCsv'

const PAGE_SIZE = 50
const EXPORT_PAGE_SIZE = 500
const EXPORT_MAX_ROWS = 10000
const TZ = 'Asia/Ho_Chi_Minh'

const RANGE_OPTIONS = [
  { key: '24h', label: '24 giờ', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 ngày', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30 ngày', ms: 30 * 24 * 60 * 60 * 1000 },
]

const SOURCE_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'email', label: 'Email' },
  { value: 'web_email', label: 'Email → web xác thực' },
  { value: 'system', label: 'Hệ thống' },
  { value: 'api', label: 'API' },
]

const SOURCE_META = {
  web: { label: 'Web', cls: 'bg-info-soft text-info ring-info-line' },
  email: { label: 'Email', cls: 'bg-warning-soft text-warning ring-warning-line' },
  web_email: { label: 'Email → web', cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  system: { label: 'Hệ thống', cls: 'bg-subtle text-body ring-line' },
  api: { label: 'API', cls: 'bg-success-soft text-success ring-success-line' },
}

const pad = (n) => String(n).padStart(2, '0')

function partsInTimeZone(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((p) => [p.type, p.value]))
}

function toLocalInput(value) {
  const p = partsInTimeZone(value)
  return p ? `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}` : ''
}

// Việt Nam dùng UTC+7 và không có DST. datetime-local được hiểu cố định theo giờ VN,
// không phụ thuộc múi giờ máy đang mở dashboard.
function vietnamInputToIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value || '')) return null
  const date = new Date(`${value.length === 16 ? `${value}:00` : value}+07:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function makeQuickRange(key = '7d', now = new Date()) {
  const option = RANGE_OPTIONS.find((r) => r.key === key) || RANGE_OPTIONS[1]
  return {
    range: option.key,
    tu: toLocalInput(new Date(now.getTime() - option.ms)),
    den: toLocalInput(now),
    tuKhoa: '', nguoi: '', hanhDong: '', nguon: '',
  }
}

function toQuery(filter) {
  const tu = vietnamInputToIso(filter.tu)
  const den = vietnamInputToIso(filter.den)
  if (!tu || !den || new Date(den).getTime() <= new Date(tu).getTime()) return null
  return {
    tu, den,
    tuKhoa: filter.tuKhoa.trim(),
    nguoi: filter.nguoi.trim(),
    hanhDong: filter.hanhDong,
    nguon: filter.nguon,
  }
}

function stateLabel(code) {
  if (!code) return '—'
  return TRANG_THAI_CODE_TO_LABEL[code] || code
}

function sourceBadge(source) {
  const meta = SOURCE_META[source] || { label: source || '—', cls: 'bg-subtle text-muted ring-line' }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${meta.cls}`}>{meta.label}</span>
}

function transitionText(row) {
  if (!row.trangThaiTruoc && !row.trangThaiSau) return 'Không đổi trạng thái'
  return `${stateLabel(row.trangThaiTruoc)} → ${stateLabel(row.trangThaiSau)}`
}

function displayError(result) {
  if (result?.forbidden) return 'Bạn không có quyền xem Nhật ký audit.'
  return result?.error?.thong_bao || moTaLoi(result?.error) || 'Không tải được Nhật ký audit.'
}

function normalizeDemoRows(rows, anchor) {
  const anchorTime = anchor ? new Date(anchor).getTime() : Date.now()
  const now = Number.isNaN(anchorTime) ? Date.now() : anchorTime
  return (rows || []).map((r, index) => ({
    id: r.id || `demo-${index + 1}`,
    thoiDiem: r.thoiDiem || new Date(now - (index + 1) * 12 * 60 * 1000).toISOString(),
    maSuCo: null,
    maHienThi: String(r.obj || '').split('/')[0]?.trim() || 'SC-DEMO',
    maPhong: String(r.obj || '').split('/')[1]?.trim() || '',
    tenPhong: '', khuVuc: '', ahu: '',
    nguoiHienThi: r.who || 'Hệ thống', nguoiThaoTac: r.who || '', vaiTro: '',
    hanhDong: r.hanhDong || '', hanhDongHienThi: r.act || r.hanhDong || '—',
    trangThaiTruoc: '', trangThaiSau: '', lyDo: r.detail || '', nguon: 'web',
  }))
}

function filterDemoRows(rows, filter) {
  const from = filter?.tu ? new Date(filter.tu).getTime() : null
  const to = filter?.den ? new Date(filter.den).getTime() : null
  const keyword = (filter?.tuKhoa || '').toLocaleLowerCase('vi')
  const actor = (filter?.nguoi || '').toLocaleLowerCase('vi')

  return normalizeDemoRows(rows, filter?.den).filter((row) => {
    const timestamp = new Date(row.thoiDiem).getTime()
    const keywordText = [row.maHienThi, row.maPhong, row.tenPhong, row.lyDo]
      .join(' ').toLocaleLowerCase('vi')
    const actorText = [row.nguoiHienThi, row.nguoiThaoTac]
      .join(' ').toLocaleLowerCase('vi')
    return (from == null || timestamp >= from)
      && (to == null || timestamp < to)
      && (!keyword || keywordText.includes(keyword))
      && (!actor || actorText.includes(actor))
      && (!filter?.hanhDong || row.hanhDong === filter.hanhDong)
      && (!filter?.nguon || row.nguon === filter.nguon)
  })
}

function downloadCsv(rows) {
  const csv = buildAuditCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = makeAuditCsvFilename()
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function AuditDetailDrawer({ row, onClose }) {
  useEffect(() => {
    if (!row) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [row, onClose])

  if (!row || typeof document === 'undefined') return null
  const field = (label, value, wide = false) => (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">{label}</p>
      <div className="mt-1 text-[13px] leading-relaxed text-body break-words">{value || '—'}</div>
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Chi tiết bản ghi audit">
      <button aria-label="Đóng chi tiết" onClick={onClose} className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]" />
      <aside className="absolute inset-y-0 right-0 w-full max-w-xl bg-surface shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface/95 backdrop-blur px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted font-semibold">Bản ghi audit #{row.id}</p>
            <h3 className="mt-1 text-[17px] font-semibold" style={{ color: "var(--text-strong)" }}>{row.hanhDongHienThi || row.hanhDong}</h3>
          </div>
          <button aria-label="Đóng" onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-subtle hover:text-body"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field('Thời gian Việt Nam', formatVn(row.thoiDiem))}
            {field('Thời gian UTC', formatUtc(row.thoiDiem))}
            {field('Người thực hiện', row.nguoiHienThi)}
            {field('Email / định danh gốc', row.nguoiThaoTac)}
            {field('Vai trò tại thời điểm ghi', row.vaiTro)}
            {field('Nguồn', sourceBadge(row.nguon))}
            {field('Mã hành động', <code className="text-[12px]">{row.hanhDong || '—'}</code>)}
            {field('Nhãn hành động', row.hanhDongHienThi)}
          </div>

          <div className="rounded-2xl bg-subtle ring-1 ring-line/80 p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Đối tượng sự cố</p>
            <p className="mt-1.5 text-[15px] font-semibold" style={{ color: "var(--text-strong)" }}>{row.maHienThi}</p>
            <p className="mt-1 text-[12px] text-muted">
              {[row.maPhong, row.tenPhong, row.khuVuc && `Khu ${row.khuVuc}`, row.ahu].filter(Boolean).join(' · ') || 'Không có thông tin phòng'}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Chuyển trạng thái</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              {row.trangThaiTruoc || row.trangThaiSau ? <>
                <span className="rounded-lg bg-subtle px-2.5 py-1.5 text-body">{stateLabel(row.trangThaiTruoc)}</span>
                <span className="text-muted">→</span>
                <span className="rounded-lg bg-success-soft px-2.5 py-1.5 font-medium text-success">{stateLabel(row.trangThaiSau)}</span>
              </> : <span className="text-muted">Hành động này không đổi trạng thái sự cố.</span>}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">Lý do / chi tiết</p>
            <div className="mt-2 min-h-20 whitespace-pre-wrap rounded-2xl bg-subtle p-4 text-[13px] leading-relaxed text-body ring-1 ring-line/80">{row.lyDo || 'Không có nội dung bổ sung.'}</div>
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}

export default function AuditLogPage({ isLive, demoRows = [] }) {
  const initialRef = useRef(makeQuickRange('7d'))
  const [draft, setDraft] = useState(initialRef.current)
  const [applied, setApplied] = useState(() => toQuery(initialRef.current))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [forbidden, setForbidden] = useState(false)
  const [selected, setSelected] = useState(null)
  const [cursorStack, setCursorStack] = useState([null])
  const [pageIndex, setPageIndex] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [validationError, setValidationError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const requestRef = useRef({ seq: 0, controller: null })

  const currentCursor = cursorStack[pageIndex] || null

  useEffect(() => {
    const req = requestRef.current
    req.controller?.abort()
    const controller = new AbortController()
    const seq = ++req.seq
    req.controller = controller
    setLoading(true)
    setError('')
    setForbidden(false)
    setSelected(null)

    if (!isLive) {
      const filtered = filterDemoRows(demoRows, applied)
      setRows(filtered.slice(0, PAGE_SIZE))
      setHasMore(false)
      setNextCursor(null)
      setLoading(false)
      return () => controller.abort()
    }

    traCuuNhatKyAudit({ ...applied, cursor: currentCursor, gioiHan: PAGE_SIZE }, controller.signal)
      .then((result) => {
        if (seq !== requestRef.current.seq) return
        if (!result.ok) {
          setRows([])
          setError(displayError(result))
          setForbidden(!!result.forbidden)
          setHasMore(false)
          setNextCursor(null)
        } else {
          setRows(result.rows)
          setHasMore(result.hasMore)
          setNextCursor(result.nextCursor)
        }
      })
      .catch((err) => {
        if (seq === requestRef.current.seq && err?.name !== 'AbortError') setError('Không tải được Nhật ký audit.')
      })
      .finally(() => { if (seq === requestRef.current.seq) setLoading(false) })

    return () => controller.abort()
  }, [isLive, demoRows, applied, pageIndex, currentCursor])

  useEffect(() => () => requestRef.current.controller?.abort(), [])

  const applyFilter = (nextDraft = draft) => {
    // Với khoảng nhanh, mốc `đến` phải được chốt đúng lúc người dùng áp dụng,
    // không giữ mốc cũ từ lúc vừa mở tab rồi vô tình bỏ sót audit mới phát sinh.
    const normalizedDraft = nextDraft.range === 'custom' ? nextDraft : {
      ...makeQuickRange(nextDraft.range),
      tuKhoa: nextDraft.tuKhoa,
      nguoi: nextDraft.nguoi,
      hanhDong: nextDraft.hanhDong,
      nguon: nextDraft.nguon,
    }
    const query = toQuery(normalizedDraft)
    if (!query) {
      setValidationError('Hãy chọn khoảng thời gian hợp lệ; mốc đến phải sau mốc từ.')
      return
    }
    setValidationError('')
    setExportError('')
    setDraft(normalizedDraft)
    setCursorStack([null])
    setPageIndex(0)
    setApplied(query)
  }

  const chooseQuickRange = (key) => {
    const range = makeQuickRange(key)
    const next = { ...range, tuKhoa: draft.tuKhoa, nguoi: draft.nguoi, hanhDong: draft.hanhDong, nguon: draft.nguon }
    applyFilter(next)
  }

  const resetFilters = () => applyFilter(makeQuickRange('7d'))

  const refresh = () => {
    if (draft.range === 'custom') applyFilter(draft)
    else {
      const range = makeQuickRange(draft.range)
      applyFilter({ ...range, tuKhoa: draft.tuKhoa, nguoi: draft.nguoi, hanhDong: draft.hanhDong, nguon: draft.nguon })
    }
  }

  const nextPage = () => {
    if (!hasMore || !nextCursor || loading) return
    setCursorStack((old) => [...old.slice(0, pageIndex + 1), nextCursor])
    setPageIndex((p) => p + 1)
  }

  const previousPage = () => {
    if (pageIndex > 0 && !loading) setPageIndex((p) => p - 1)
  }

  const exportCsv = async () => {
    setExportError('')
    setExporting(true)
    try {
      let all = []
      let cursor = null
      if (!isLive) {
        all = filterDemoRows(demoRows, applied)
      } else {
        while (true) {
          const result = await traCuuNhatKyAudit({ ...applied, cursor, gioiHan: EXPORT_PAGE_SIZE })
          if (!result.ok) throw new Error(displayError(result))
          all = all.concat(result.rows)
          if (all.length > EXPORT_MAX_ROWS || (all.length === EXPORT_MAX_ROWS && result.hasMore)) {
            throw new Error(`Kết quả vượt ${EXPORT_MAX_ROWS.toLocaleString('vi-VN')} dòng. Hãy thu hẹp khoảng thời gian hoặc bộ lọc trước khi xuất.`)
          }
          if (!result.hasMore) break
          if (!result.nextCursor) throw new Error('Máy chủ không trả cursor cho trang tiếp theo.')
          cursor = result.nextCursor
        }
      }
      if (!all.length) throw new Error('Không có bản ghi nào khớp bộ lọc để xuất.')
      downloadCsv(all)
    } catch (err) {
      setExportError(err?.message || 'Không xuất được CSV.')
    } finally {
      setExporting(false)
    }
  }

  const appliedSummary = useMemo(() => {
    if (!applied) return ''
    return `${formatVn(applied.tu).slice(0, 16)} → ${formatVn(applied.den).slice(0, 16)}`
  }, [applied])

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-surface/95 p-5 ring-1 ring-[#D8E6EC] sm:p-6" style={{ boxShadow: '0 12px 34px -18px rgba(16,40,55,0.30)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><FileText className="h-4 w-4" style={{ color: "var(--primary)" }} /><h3 className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>Nhật ký audit</h3><span className="text-[10px] uppercase tracking-wider text-muted">thao tác sự cố</span></div>
            <p className="mt-1.5 max-w-3xl text-[11px] leading-relaxed text-muted">Tra cứu thao tác web, email và sự kiện hệ thống đã ghi tại Supabase. Dữ liệu nguồn là audit trail append-only theo ALCOA+.</p>
          </div>
          <div className="text-right text-[10px] text-muted"><p>Khoảng đang áp dụng</p><p className="mt-0.5 font-medium tabular-nums text-body">{appliedSummary}</p></div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((option) => <button key={option.key} onClick={() => chooseQuickRange(option.key)} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition ${draft.range === option.key ? 'text-white ring-transparent' : 'bg-surface text-body ring-line hover:ring-success-line'}`} style={draft.range === option.key ? { backgroundColor: "var(--primary-solid)" } : {}}>{option.label}</button>)}
          <button onClick={() => setDraft((old) => ({ ...old, range: 'custom' }))} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition ${draft.range === 'custom' ? 'text-white ring-transparent' : 'bg-surface text-body ring-line hover:ring-success-line'}`} style={draft.range === 'custom' ? { backgroundColor: "var(--primary-solid)" } : {}}><CalendarDays className="mr-1 inline h-3.5 w-3.5" />Tùy chọn</button>
        </div>

        {draft.range === 'custom' && <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-[11px] font-semibold text-muted">Từ<input type="datetime-local" step="1" value={draft.tu} onChange={(e) => setDraft((old) => ({ ...old, tu: e.target.value }))} className="mt-1.5 w-full rounded-xl bg-surface px-3 py-2 text-[12px] font-normal text-body ring-1 ring-line" /></label>
          <label className="text-[11px] font-semibold text-muted">Đến<input type="datetime-local" step="1" value={draft.den} onChange={(e) => setDraft((old) => ({ ...old, den: e.target.value }))} className="mt-1.5 w-full rounded-xl bg-surface px-3 py-2 text-[12px] font-normal text-body ring-1 ring-line" /></label>
        </div>}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative"><span className="sr-only">Từ khóa</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" /><input value={draft.tuKhoa} onChange={(e) => setDraft((old) => ({ ...old, tuKhoa: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') applyFilter() }} placeholder="Mã sự cố, phòng, lý do…" className="w-full rounded-xl bg-surface py-2 pl-9 pr-3 text-[12px] text-body ring-1 ring-line" /></label>
          <label><span className="sr-only">Người thực hiện</span><input value={draft.nguoi} onChange={(e) => setDraft((old) => ({ ...old, nguoi: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') applyFilter() }} placeholder="Tên hoặc email người thực hiện" className="w-full rounded-xl bg-surface px-3 py-2 text-[12px] text-body ring-1 ring-line" /></label>
          <label><span className="sr-only">Hành động</span><select value={draft.hanhDong} onChange={(e) => setDraft((old) => ({ ...old, hanhDong: e.target.value }))} className="w-full rounded-xl bg-surface px-3 py-2 text-[12px] text-body ring-1 ring-line"><option value="">Tất cả hành động</option>{AUDIT_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label><span className="sr-only">Nguồn</span><select value={draft.nguon} onChange={(e) => setDraft((old) => ({ ...old, nguon: e.target.value }))} className="w-full rounded-xl bg-surface px-3 py-2 text-[12px] text-body ring-1 ring-line"><option value="">Tất cả nguồn</option>{SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => applyFilter()} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-semibold text-white" style={{ backgroundColor: "var(--primary-solid)" }}><Filter className="h-3.5 w-3.5" />Áp dụng</button>
          <button onClick={resetFilters} className="rounded-xl bg-surface px-3.5 py-2 text-[12px] font-medium text-body ring-1 ring-line hover:bg-subtle">Đặt lại</button>
          <button onClick={refresh} disabled={loading} className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3.5 py-2 text-[12px] font-medium text-body ring-1 ring-line hover:bg-subtle disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Làm mới</button>
          <button onClick={exportCsv} disabled={exporting || loading || forbidden} className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3.5 py-2 text-[12px] font-medium text-body ring-1 ring-line hover:bg-subtle disabled:opacity-50"><Download className="h-3.5 w-3.5" />{exporting ? 'Đang xuất…' : 'Xuất CSV'}</button>
          <span className="ml-auto text-[11px] tabular-nums text-muted">Trang {pageIndex + 1} · tối đa {PAGE_SIZE} dòng/trang</span>
        </div>

        {(validationError || exportError) && <p className="mt-3 text-[12px] text-danger">{validationError || exportError}</p>}
      </div>

      <div className="overflow-hidden rounded-3xl bg-surface/95 ring-1 ring-[#D8E6EC]" style={{ boxShadow: '0 12px 34px -18px rgba(16,40,55,0.30)' }}>
        {error ? <div className="px-6 py-12 text-center"><p className="text-[13px] font-medium text-danger">{error}</p>{!forbidden && <button onClick={refresh} className="mt-3 rounded-xl bg-surface px-3 py-1.5 text-[12px] text-body ring-1 ring-line">Thử lại</button>}</div>
          : loading && rows.length === 0 ? <div className="space-y-2 p-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-subtle" />)}</div>
            : rows.length === 0 ? <div className="px-6 py-12 text-center"><FileText className="mx-auto h-7 w-7 text-muted" /><p className="mt-3 text-[13px] font-medium text-body">Không có bản ghi audit khớp bộ lọc.</p><p className="mt-1 text-[11px] text-muted">Thử mở rộng khoảng thời gian hoặc đặt lại điều kiện tra cứu.</p></div>
              : <div className="overflow-x-auto"><table className={`w-full min-w-[1120px] text-[12px] transition ${loading ? 'opacity-60' : ''}`}><thead><tr className="bg-subtle/80 text-left text-[10px] uppercase tracking-wider text-muted">{['Thời gian', 'Người thực hiện', 'Hành động', 'Sự cố / phòng', 'Chuyển trạng thái', 'Nguồn', 'Lý do / chi tiết'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} tabIndex={0} onClick={() => setSelected(row)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(row) } }} className="cursor-pointer border-t border-line outline-none transition hover:bg-info-soft/50 focus:bg-info-soft/70"><td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{formatVn(row.thoiDiem)}</td><td className="max-w-[190px] px-4 py-3"><p className="truncate font-medium text-body" title={row.nguoiHienThi}>{row.nguoiHienThi}</p>{row.nguoiThaoTac && row.nguoiThaoTac.toLocaleLowerCase('vi') !== row.nguoiHienThi.toLocaleLowerCase('vi') && <p className="mt-0.5 truncate text-[10px] text-muted" title={row.nguoiThaoTac}>{row.nguoiThaoTac}</p>}</td><td className="max-w-[220px] px-4 py-3"><p className="font-medium text-body">{row.hanhDongHienThi || row.hanhDong}</p>{row.hanhDong && <code className="mt-0.5 block truncate text-[9.5px] text-muted">{row.hanhDong}</code>}</td><td className="px-4 py-3"><p className="font-semibold" style={{ color: "var(--text-strong)" }}>{row.maHienThi}</p><p className="mt-0.5 text-[10px] text-muted">{[row.maPhong, row.khuVuc, row.ahu].filter(Boolean).join(' · ') || '—'}</p></td><td className="max-w-[240px] px-4 py-3 text-body">{transitionText(row)}</td><td className="px-4 py-3">{sourceBadge(row.nguon)}</td><td className="max-w-[280px] px-4 py-3"><p className="line-clamp-2 text-muted" title={row.lyDo}>{row.lyDo || '—'}</p></td></tr>)}</tbody></table></div>}

        {!error && rows.length > 0 && <div className="flex items-center justify-between border-t border-line px-4 py-3"><button onClick={previousPage} disabled={pageIndex === 0 || loading} className="inline-flex items-center gap-1 rounded-xl bg-surface px-3 py-1.5 text-[12px] font-medium text-body ring-1 ring-line disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Trang trước</button><span className="text-[11px] text-muted">{rows.length} bản ghi trên trang {pageIndex + 1}</span><button onClick={nextPage} disabled={!hasMore || !nextCursor || loading} className="inline-flex items-center gap-1 rounded-xl bg-surface px-3 py-1.5 text-[12px] font-medium text-body ring-1 ring-line disabled:opacity-40">Trang sau<ChevronRight className="h-3.5 w-3.5" /></button></div>}
      </div>

      <AuditDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
