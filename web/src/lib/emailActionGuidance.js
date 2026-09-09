import { parseEmailIncidentSearch } from './emailIncident.js'

// Presentation only: available actions and rejection reason come from the RPC.
// URL hints never authorize a write; the destination reloads rules and permissions.
export function huongDanThuTu(context, requestedAction) {
  if (context?.loi !== 'THAO_TAC_KHONG_CON_HOP_LE') return null
  const nextAction = ['mep_xu_ly_xong', 'mep_khong_xu_ly_duoc', 'mep_cho_xu_ly'].includes(requestedAction)
    ? 'mep_tiep_nhan' : requestedAction === 'mep_vang' ? 'mep_cho_xu_ly' : null
  const next = context.nut_kha_dung?.find((action) => action.hanh_dong === nextAction)
  if (!next) return null
  return { nextAction, label: next.nhan,
    steps: [
      `Chọn “${next.nhan}” trong trang sự cố, rồi xác nhận.`,
      'Chờ thông báo “Đã ghi nhận”. Chỉ mở nút hoặc đăng nhập chưa tính là hoàn tất.',
      'Mở lại trang sự cố để chọn thao tác tiếp theo. Ghi nội dung nếu được yêu cầu, rồi xác nhận.',
    ],
  }
}

export function lienKetSuCo(id, intent = 'update') {
  const query = new URLSearchParams({ incident: String(id ?? ''), intent }).toString()
  return parseEmailIncidentSearch(`?${query}`).kind === 'incident' ? `incident.html?${query}` : null
}
