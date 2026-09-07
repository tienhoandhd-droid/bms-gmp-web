import React, { useEffect, useRef, useState } from 'react'
import { moTaLoi } from '../lib/bmsClient'
import { nutChoVaiTro } from '../lib/nutThaoTac'
import { ACTION_CODE_TO_LABEL, TRANG_THAI_CODE_TO_LABEL } from '../lib/supabaseData'
import { chonNutTheoIntent } from '../lib/emailIncident'
import { guiThaoTacSuCoEmail, taiDuLieuSuCoEmail } from '../lib/emailIncidentData'

function moTaSuCo(incident) {
  return `${incident.ma_hien_thi || `SC-${incident.ma_su_co}`} · ${incident.phong || '—'}${incident.ten_phong ? ` — ${incident.ten_phong}` : ''}`
}

export default function IncidentAction({ email, incidentId, intent, Khung: KhungEmail, DauTrang: DauTrangEmail, NutMoDashboard: NutMoDashboardEmail, tenVaiTro }) {
  const [state, setState] = useState({ loading: true })
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [reloadRequired, setReloadRequired] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let stale = false
    setState({ loading: true }); setSelected(null); setReason(''); setConfirmed(false); setResult(null); setReloadRequired(false)
    taiDuLieuSuCoEmail({ email, incidentId, intent, signal: controller.signal }).then((data) => {
      if (stale) return
      const error = data.roleResult.error || data.incidentResult.error || data.actionsResult.error
      const role = data.roleResult.role
      const incident = data.incidentResult.incident
      if (error) { setState({ error: moTaLoi(error) }); return }
      if (!role) { setState({ error: 'Tài khoản hiện tại không còn vai trò hoạt động.' }); return }
      if (!incident) { setState({ error: 'Không tìm thấy sự cố đang mở, hoặc tài khoản hiện tại không có quyền xem phiếu này.' }); return }
      if (data.actionsResult.rows == null) { setState({ error: 'Không tải được luật thao tác hiện tại. Vui lòng tải lại trang.' }); return }
      const actions = nutChoVaiTro(data.actionsResult.rows, incident.trang_thai, role)
      const preselected = chonNutTheoIntent(actions, intent)
      setState({ role, incident, actions, actionRules: data.actionsResult.rows, closed: data.closed })
      setSelected(preselected)
    }).catch((error) => {
      if (!stale && error?.name !== 'AbortError') setState({ error: 'Không tải được phiếu. Kiểm tra mạng rồi tải lại trang.' })
    })
    return () => { stale = true; controller.abort() }
  }, [email, incidentId, intent])

  const submit = async () => {
    if (!selected || !confirmed || submittingRef.current || reloadRequired) return
    const mustReason = selected.batBuocLyDo && !reason.trim()
    if (mustReason) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      const { data, error } = await guiThaoTacSuCoEmail({
        incidentId, actionCode: selected.code, lyDo: reason.trim(), actorEmail: email,
      })
      if (error?.nghiep_vu || data?.ok === false) {
        setSubmitting(false)
        setReloadRequired(true)
        setResult({ error: `${data?.thong_bao || moTaLoi(error) || 'Thao tác không được chấp nhận.'} Tải lại phiếu để nhận trạng thái và luật hiện tại trước khi thao tác tiếp.` })
        return
      }
      if (!error && data?.ok === true) {
        const status = data.trang_thai_moi ? ` Trạng thái mới: ${TRANG_THAI_CODE_TO_LABEL[data.trang_thai_moi] || data.trang_thai_moi}.` : ' Tải lại phiếu để xem trạng thái hiện tại.'
        setResult({ ok: true, message: `${data.thong_bao || 'Đã ghi nhận thao tác.'}${status}` })
        return
      }
    } catch { /* kết quả ghi không chắc chắn, khóa tới khi tải lại */ }
    setSubmitting(false)
    setReloadRequired(true)
    setResult({ error: 'Không xác định được kết quả ghi nhận. Để tránh ghi trùng, hãy tải lại trang rồi kiểm tra lại phiếu trước khi thao tác tiếp.' })
  }

  if (state.loading) return <KhungEmail><DauTrangEmail phu={email} /><p className="py-6 text-center text-sm text-muted">Đang mở phiếu…</p></KhungEmail>
  if (state.error) return <KhungEmail><DauTrangEmail phu={email} /><p role="alert" className="mt-4 text-sm leading-relaxed text-danger">{state.error}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-[44px] w-full rounded-xl bg-subtle px-4 py-2 text-sm font-semibold text-body ring-1 ring-line">Tải lại phiếu</button><NutMoDashboardEmail /></KhungEmail>

  const { incident, role, actions } = state
  const reasonMissing = selected?.batBuocLyDo && !reason.trim()
  const readonly = intent === 'view' || state.closed
  const locked = submitting || result?.ok || reloadRequired
  const history = Array.isArray(incident.lich_su) ? incident.lich_su.slice(-3).reverse() : []
  const nhanThaoTac = (code) => state.actionRules?.find((rule) => rule.hanh_dong === code)?.nhan || ACTION_CODE_TO_LABEL[code] || code || '—'
  return <KhungEmail>
    <DauTrangEmail phu={`${email} · ${tenVaiTro(role)}`} />
    <p className="mt-4 text-[12px] font-semibold uppercase tracking-wider text-muted">{readonly ? 'Xem phiếu' : 'Xác nhận thao tác'}</p>
    <h2 className="mt-1 text-base font-semibold text-strong">{moTaSuCo(incident)}</h2>
    <div className="mt-3 space-y-1 rounded-2xl bg-subtle p-3 text-[13px] text-body ring-1 ring-line">
      <div>Khu vực: <b>{incident.khu_vuc || '—'}</b> · Cảm biến: <b>{incident.cam_bien_vi || incident.loai_cam_bien || '—'}</b></div>
      <div>Trạng thái hiện tại: <b>{TRANG_THAI_CODE_TO_LABEL[incident.trang_thai] || incident.trang_thai || '—'}</b></div>
      <div className="text-[12px] text-muted">Người thực hiện: {email} · {tenVaiTro(role)}</div>
    </div>
    {history.length > 0 && <div className="mt-3 rounded-2xl bg-subtle p-3 text-[12px] text-body ring-1 ring-line"><p className="font-semibold uppercase tracking-wider text-muted">Thao tác gần nhất</p><ul className="mt-1.5 space-y-1">{history.map((entry, index) => <li key={`${entry.t || ''}:${entry.act || ''}:${index}`}>{entry.t || '—'} · {entry.who || 'Hệ thống'}{entry.role ? ` (${entry.role})` : ''} · {nhanThaoTac(entry.act)}{entry.ly_do ? `: ${entry.ly_do}` : ''}</li>)}</ul></div>}
    {readonly ? <p className="mt-4 text-sm leading-relaxed text-muted">{state.closed ? 'Sự cố này không còn mở. Trang chỉ hiển thị thông tin hồ sơ đã đóng.' : 'Đây là chế độ chỉ xem. Không có thao tác nào được gửi từ trang này.'}</p> : <>
      <fieldset className="mt-4">
        <legend className="text-[12px] font-semibold uppercase tracking-wider text-muted">Thao tác</legend>
        {actions.length === 0 ? <p role="alert" className="mt-2 text-sm text-danger">Vai trò hiện tại không có thao tác phù hợp với trạng thái này.</p> : <div className="mt-2 space-y-2">
          {actions.map((action) => <label key={action.code} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line">
            <input type="radio" name="incident-action" value={action.code} disabled={locked} checked={selected?.code === action.code} onChange={() => { setSelected(action); setConfirmed(false) }} />
            <span><b>{action.label}</b><span className="block text-[12px] text-muted">Trạng thái sau: {action.next}</span></span>
          </label>)}
        </div>}
      </fieldset>
      {selected && <div className="mt-4">
        <label htmlFor="incident-reason" className="text-[12px] font-semibold uppercase tracking-wider text-muted">Lý do / ghi chú{selected.batBuocLyDo ? ' *' : ' (nếu có)'}</label>
        <textarea id="incident-reason" value={reason} disabled={locked} onChange={(e) => { setReason(e.target.value); setConfirmed(false) }} rows={3} required={selected.batBuocLyDo}
          className="mt-1.5 w-full rounded-xl bg-surface px-3 py-2 text-sm ring-1 ring-line" />
        <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-body"><input type="checkbox" disabled={locked} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Tôi xác nhận {selected.label.toLowerCase()} cho {incident.ma_hien_thi || `SC-${incident.ma_su_co}`}.</label>
      </div>}
      {result?.error && <p role="alert" className="mt-3 text-sm text-danger">{result.error}</p>}
      {result?.ok && <p role="status" className="mt-3 text-sm text-success">{result.message}</p>}
      {(reloadRequired || result?.ok) && <button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-[44px] w-full rounded-xl bg-subtle px-4 py-2 text-sm font-semibold text-body ring-1 ring-line">Tải lại phiếu</button>}
      {selected && !result?.ok && <button type="button" onClick={submit} disabled={reasonMissing || !confirmed || locked}
        className="mt-4 min-h-[44px] w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--primary-solid)' }}>
        {submitting ? 'Đang ghi nhận…' : 'Xác nhận và ghi nhận'}
      </button>}
    </>}
    <NutMoDashboardEmail />
  </KhungEmail>
}
