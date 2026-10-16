import { docView, goiRPC } from './bmsClient'
import { layNutThaoTac } from './supabaseData'

export async function layVaiTroEmailHienTai(email, signal) {
  const { data, error } = await docView('nguoi_dung',
    (q) => q.select('vai_tro,kich_hoat').eq('email', email).eq('kich_hoat', true).limit(1),
    { signal })
  return { error, role: data?.[0]?.vai_tro || null }
}

export async function laySuCoEmailDangMo(incidentId, signal) {
  const { data, error } = await docView('xem_su_co_dang_mo',
    (q) => q.select('ma_su_co,ma_hien_thi,phong,ten_phong,khu_vuc,uu_tien,cam_bien_vi,loai_cam_bien,muc_canh_bao,trang_thai,bat_dau,lich_su')
      .eq('ma_su_co', incidentId).limit(1),
    { signal })
  return { error, incident: data?.[0] || null }
}

export async function laySuCoEmailDaDong(incidentId, signal) {
  const { data, error } = await docView('xem_su_co_dong_gan_day',
    (q) => q.select('ma_su_co,ma_hien_thi,phong,ten_phong,khu_vuc,uu_tien,cam_bien_vi,loai_cam_bien,trang_thai,nhan_trang_thai,dong_luc')
      .eq('ma_su_co', incidentId).limit(1),
    { signal })
  return { error, incident: data?.[0] || null }
}

export async function taiDuLieuSuCoEmail({ email, incidentId, intent, signal }) {
  const [roleResult, incidentResult, actionsResult] = await Promise.all([
    layVaiTroEmailHienTai(email, signal),
    laySuCoEmailDangMo(incidentId, signal),
    layNutThaoTac(signal),
  ])
  if (intent === 'view' && !incidentResult.error && !incidentResult.incident) {
    const closedResult = await laySuCoEmailDaDong(incidentId, signal)
    return { roleResult, incidentResult: closedResult, actionsResult, closed: !!closedResult.incident }
  }
  return { roleResult, incidentResult, actionsResult, closed: false }
}

export function guiThaoTacSuCoEmail({ incidentId, actionCode, lyDo, actorEmail }, signal) {
  return goiRPC('rpc_thao_tac_su_co', {
    p_ma_su_co: incidentId,
    p_hanh_dong: actionCode,
    p_ly_do: lyDo || null,
    p_actor: actorEmail || null,
    p_nguon: 'web_email',
  }, { soLanThu: 1, signal })
}
