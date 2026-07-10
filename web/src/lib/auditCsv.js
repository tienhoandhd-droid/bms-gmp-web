const TZ = 'Asia/Ho_Chi_Minh'

export const AUDIT_CSV_HEADER = [
  'audit_id', 'thoi_diem_vn', 'thoi_diem_utc', 'ma_su_co', 'ma_phong',
  'ten_phong', 'khu_vuc', 'ahu', 'nguoi_thao_tac', 'vai_tro',
  'hanh_dong_ma', 'hanh_dong', 'trang_thai_truoc', 'trang_thai_sau', 'ly_do', 'nguon',
]

function partsInVietnam(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function formatAuditVn(value) {
  const p = partsInVietnam(value)
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}` : '—'
}

export function formatAuditUtc(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().replace('T', ' ').replace('.000Z', 'Z')
}

export function escapeAuditCsvCell(value) {
  let text = value == null ? '' : String(value)
  // Chặn Excel/LibreOffice diễn giải dữ liệu audit do người dùng nhập thành công thức,
  // kể cả khi ký tự công thức đứng sau khoảng trắng hoặc tab đầu ô.
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function buildAuditCsv(rows) {
  const body = (rows || []).map((row) => [
    row.id, formatAuditVn(row.thoiDiem), formatAuditUtc(row.thoiDiem), row.maHienThi, row.maPhong,
    row.tenPhong, row.khuVuc, row.ahu, row.nguoiThaoTac || row.nguoiHienThi, row.vaiTro,
    row.hanhDong, row.hanhDongHienThi, row.trangThaiTruoc, row.trangThaiSau, row.lyDo, row.nguon,
  ])
  return '\uFEFF' + [AUDIT_CSV_HEADER, ...body]
    .map((line) => line.map(escapeAuditCsvCell).join(','))
    .join('\r\n')
}

export function makeAuditCsvFilename(now = new Date()) {
  const p = partsInVietnam(now)
  if (!p) return 'BMS-nhat-ky-audit.csv'
  return `BMS-nhat-ky-audit-${p.year}${p.month}${p.day}-${p.hour}${p.minute}.csv`
}
