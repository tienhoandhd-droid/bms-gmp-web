// ============================================================
// ActionApp — TRANG THAO TÁC TỪ EMAIL (bundle riêng, siêu nhẹ).
//
// Vì sao tách khỏi App.jsx: mỗi nút trong email deep-link vào web. Nếu trỏ vào
// dashboard đầy đủ thì mỗi cú bấm phải TẢI + PARSE ~776KB JS (index+react+supabase)
// và có thể prefetch cả echarts 733KB — bấm nhiều nút = nhiều tab nặng → web lag +
// refresh-token đa-tab đá nhau → "lỗi đăng nhập". Trang này CHỈ có: đăng nhập +
// soi phiếu + xác nhận (2 RPC). KHÔNG import App/dashboard/charts.
//
// GMP/21 CFR Part 11: VẪN bắt đăng nhập → thao tác quy được cho người thật (JWT).
// Mọi kiểm tra vai trò/khu/hạn token do RPC làm ở máy chủ (SECURITY DEFINER).
// ============================================================
import React, { useEffect, useRef, useState } from 'react'
import { supabase, moTaLoi } from '../lib/bmsClient'
import { dangNhapMatKhau, dangXuat } from '../lib/auth'
import { kiemVeThaoTac, thaoTacSuCoTuEmail } from '../lib/supabaseData'
// Import để Vite trả URL đã hash — đường dẫn cứng './assets/logo-cpc1hn.png' cũ
// 404 trên bản build (asset bị hash tên). Ảnh 16KB tải lười, không chặn JS.
import logoCpc1hn from '../assets/logo-cpc1hn.png'

const NAVY = '#1E3A56'
const TEAL = '#0E7C6B'
// Tên vai trò đầy đủ (không viết tắt trên giao diện — đồng bộ ROLE_VI của App).
const VAI_TRO_VI = { IPC: 'Kiểm soát hiện trường', MEP: 'Cơ điện', LOT: 'Trực hồ sơ lô', QA: 'Đảm bảo chất lượng', ADMIN: 'Quản trị hệ thống', IT: 'Quản trị hệ thống' }
const tenVaiTro = (m) => VAI_TRO_VI[m] || m
const PAGE_BG = 'var(--bg-canvas)'

// Đọc token NGAY khi nạp module rồi dọn URL (token là bí mật — không để nằm trên
// thanh địa chỉ / lịch sử). sc/act chỉ để hiển thị, RPC lấy tất cả từ token.
const params = new URLSearchParams(window.location.search)
const TOKEN0 = params.get('token') || ''
try {
  const q = new URLSearchParams(window.location.search)
  q.delete('token'); q.delete('sc'); q.delete('act')
  window.history.replaceState(null, '', window.location.pathname + (q.toString() ? '?' + q.toString() : ''))
} catch { /* bỏ qua */ }

// Link mở dashboard đầy đủ (cùng thư mục, base './').
const URL_DASHBOARD = 'index.html?tab=events'

function Khung({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: PAGE_BG }}>
      <div className="w-full max-w-md rounded-3xl bg-surface shadow-2xl ring-1 ring-line p-6">{children}</div>
    </div>
  )
}

function DauTrang({ phu }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-2xl bg-surface px-2 ring-1 ring-line flex items-center justify-center h-10 w-10 shrink-0">
        <img src={logoCpc1hn} onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="h-7 w-7 object-contain" />
      </div>
      <div className="min-w-0 text-left">
        <h1 className="text-sm font-bold leading-tight" style={{ color: NAVY }}>Thao tác sự cố từ email</h1>
        <p className="text-[12px] text-muted truncate">{phu}</p>
      </div>
    </div>
  )
}

function NutMoDashboard() {
  return (
    <a href={URL_DASHBOARD}
      className="mt-4 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: TEAL }}>
      Mở bảng điều khiển
    </a>
  )
}

function FormDangNhap({ onXong }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [dang, setDang] = useState(false)
  const [loi, setLoi] = useState('')
  const guiDi = async (e) => {
    e.preventDefault()
    if (dang) return
    setDang(true); setLoi('')
    const { error } = await dangNhapMatKhau(email, pw)
    setDang(false)
    if (error) { setLoi(error.message || 'Đăng nhập không thành công.'); return }
    onXong?.()
  }
  return (
    <Khung>
      <DauTrang phu="Đăng nhập bằng tài khoản được phân công" />
      <form onSubmit={guiDi} className="mt-4 space-y-3">
        {/* Đợt B 04/09/2026: nhãn thật thay placeholder (WCAG 1.3.1) + lỗi có role=alert */}
        <label htmlFor="tt-email" className="block text-[12px] font-medium text-body">Email công việc
          <input id="tt-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required
            placeholder="email@cpc1hn.vn" autoComplete="username" aria-invalid={loi ? true : undefined}
            className="mt-1 w-full rounded-xl bg-subtle ring-1 ring-line px-3 py-2.5 text-sm font-normal" /></label>
        <label htmlFor="tt-mat-khau" className="block text-[12px] font-medium text-body">Mật khẩu
          <input id="tt-mat-khau" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required
            autoComplete="current-password" aria-invalid={loi ? true : undefined}
            className="mt-1 w-full rounded-xl bg-subtle ring-1 ring-line px-3 py-2.5 text-sm font-normal" /></label>
        {loi && <p role="alert" className="text-[13px] text-danger">{loi}</p>}
        <button type="submit" disabled={dang}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: TEAL }}>
          {dang ? 'Đang đăng nhập…' : 'Đăng nhập & tiếp tục'}
        </button>
      </form>
      <p className="mt-3 text-[12px] text-muted leading-relaxed">
        Trang này cố tình gọn nhẹ để bấm nhiều nút không làm chậm web. Mỗi liên kết trong
        email chỉ cần bấm một lần.
      </p>
    </Khung>
  )
}

// Soi phiếu + xác nhận. Tái hiện đúng hành vi ModalVeEmail trong App (nhưng dạng trang).
function TheoVe({ email }) {
  const [ve, setVe] = useState(null)       // { dangTai } | { ve } | { loi }
  const [ketQua, setKetQua] = useState(null)
  const [lyDo, setLyDo] = useState('')
  const [dangChay, setDangChay] = useState(false)
  // lanThu tăng khi bấm "Thử lại" (lỗi mạng). daChayLan chống StrictMode gọi đúp.
  const [lanThu, setLanThu] = useState(0)
  const daChayLan = useRef(-1)
  const daGo = useRef(false)

  useEffect(() => () => { daGo.current = true }, [])
  useEffect(() => {
    if (!TOKEN0 || daChayLan.current === lanThu) return
    daChayLan.current = lanThu
    setVe({ dangTai: true })
    kiemVeThaoTac(TOKEN0).then(({ error, ve }) => {
      if (daGo.current) return
      if (ve?.ok) setVe({ ve })
      else if (ve) setVe({ loi: ve.thong_bao || 'Liên kết không dùng được.', boiCanh: ve })
      else setVe({ loi: moTaLoi(error) })
    }).catch(() => { if (!daGo.current) setVe({ loi: 'Không kiểm tra được liên kết. Kiểm tra mạng rồi thử lại.' }) })
  }, [lanThu])

  if (!TOKEN0) return (
    <Khung>
      <DauTrang phu={email} />
      <p className="mt-4 text-[13px] text-muted leading-relaxed">Không có liên kết thao tác. Bạn có thể mở bảng điều khiển để xử lý trực tiếp.</p>
      <NutMoDashboard />
    </Khung>
  )

  if (!ve || ve.dangTai) return (
    <Khung><DauTrang phu={email} /><p className="mt-6 text-sm text-muted text-center py-4">Đang kiểm tra liên kết…</p></Khung>
  )

  // Màn từ chối (phiếu lỗi HOẶC thực thi trả ok:false) — bày ngữ cảnh DB gửi kèm.
  if (ve.loi || (ketQua && !ketQua.ok)) {
    const bc = ketQua && !ketQua.ok ? ketQua : ve.boiCanh
    const ganNhat = bc?.thao_tac_gan_nhat
    const khaDung = bc?.nut_kha_dung || []
    return (
      <Khung>
        <DauTrang phu={email} />
        <h3 className="text-base font-semibold text-danger mt-4">Không thực hiện được</h3>
        <p className="text-sm text-body mt-2 leading-relaxed">{ve.loi || ketQua.thong_bao}</p>
        {ganNhat && (
          <div className="mt-3 rounded-2xl bg-subtle ring-1 ring-line p-3 text-[13px]">
            <div className="text-[12px] uppercase tracking-wider text-muted font-semibold">Thao tác gần nhất</div>
            <div className="mt-1 text-body font-medium">{ganNhat.nhan}</div>
            <div className="text-[12px] text-muted">{tenVaiTro(ganNhat.vai_tro)} · {ganNhat.boi} · {ganNhat.luc_hien_thi}</div>
          </div>)}
        {khaDung.length > 0 && (
          <div className="mt-3">
            <div className="text-[12px] uppercase tracking-wider text-muted font-semibold">Bây giờ bạn bấm được</div>
            <ul className="mt-1.5 space-y-1">{khaDung.map((n) => (
              <li key={n.hanh_dong} className="text-[13px] text-body flex gap-1.5"><span className="text-muted">•</span>{n.nhan}</li>))}</ul>
          </div>)}
        {/* Lỗi MẠNG (không có bối cảnh DB, chưa thực thi gì) → cho thử lại tại chỗ,
            khỏi đóng-mở lại email. Từ chối nghiệp vụ (phiếu hết hạn/đã xử lý) thì không. */}
        {!ketQua && ve.loi && !ve.boiCanh && (
          <button onClick={() => setLanThu((n) => n + 1)}
            className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: TEAL }}>
            Thử lại
          </button>)}
        <NutMoDashboard />
      </Khung>)
  }

  if (ketQua?.ok) return (
    <Khung>
      <DauTrang phu={email} />
      <h3 className="text-base font-semibold text-success mt-4">✓ Đã ghi nhận</h3>
      <p className="text-sm text-body mt-2 leading-relaxed">{ketQua.thong_bao}</p>
      <NutMoDashboard />
      <p className="mt-3 text-[12px] text-muted">Có thể đóng tab này.</p>
    </Khung>)

  const v = ve.ve
  const canNote = !!v?.bat_buoc_ly_do
  const thieuNote = canNote && !lyDo.trim()
  const xacNhan = async () => {
    if (thieuNote || dangChay) return
    setDangChay(true)
    const { data, error } = await thaoTacSuCoTuEmail({ token: TOKEN0, lyDo: lyDo.trim() || null })
    setDangChay(false)
    if (daGo.current) return
    if (error) setKetQua({ ...(data || {}), ok: false, thong_bao: moTaLoi(error) })
    else setKetQua(data)
  }
  return (
    <Khung>
      <DauTrang phu={email} />
      <p className="text-[12px] uppercase tracking-wider text-muted font-semibold mt-4">Xác nhận thao tác · {tenVaiTro(v.vai_tro_can)}</p>
      <h3 className="text-base font-semibold text-strong mt-1">{v.nhan}</h3>
      <div className="mt-3 rounded-2xl bg-subtle ring-1 ring-line p-3 text-[13px] text-body space-y-1">
        <div><b>{v.ma_hien_thi}</b> · {v.ma_phong} {v.ten_phong ? `— ${v.ten_phong}` : ''}</div>
        <div className="text-[12px] text-muted">{v.khu_vuc} · {v.ahu || '—'} · {v.loai_cam_bien} · {v.muc_canh_bao}</div>
        <div className="text-[12px] text-muted">
          Trạng thái: <b>{v.nhan_trang_thai || v.trang_thai_hien_tai}</b>
          {v.giu_trang_thai
            ? <span className="text-muted"> — thao tác này chỉ ghi chú, không đổi trạng thái</span>
            : <> → <b>{v.nhan_trang_thai_sau || v.trang_thai_sau}</b>{v.dong_su_co && <span className="text-success"> (đóng sự cố)</span>}</>}
        </div>
        {v.thao_tac_gan_nhat && (
          <div className="text-[12px] text-muted">Gần nhất: <b>{v.thao_tac_gan_nhat.nhan}</b> — {tenVaiTro(v.thao_tac_gan_nhat.vai_tro)} · {v.thao_tac_gan_nhat.luc_hien_thi}</div>)}
        {v.so_lan_vang > 0 && <div className="text-[12px] text-warning">Đã báo "không tại hiện trường" {v.so_lan_vang} lần</div>}
      </div>
      {canNote && (
        <div className="mt-3">
          <label className="text-[12px] uppercase text-muted font-semibold">Nội dung sự cố / biện pháp <span className="text-danger">*</span></label>
          <textarea value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={3} autoFocus
            placeholder="Ví dụ: van điều tiết kẹt, đã chỉnh lại 40% và theo dõi 30 phút"
            className="w-full mt-1.5 rounded-xl bg-surface ring-1 ring-line px-3 py-2 text-sm" />
          <p className="text-[12px] text-muted mt-1">Bắt buộc — ghi vào hồ sơ kiểm toán ALCOA+.</p>
        </div>)}
      <div className="flex gap-2 mt-5">
        <a href={URL_DASHBOARD} className="flex-1 rounded-xl bg-subtle py-2.5 text-sm font-medium text-body text-center">Để sau</a>
        <button onClick={xacNhan} disabled={thieuNote || dangChay}
          className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: TEAL }}>
          {dangChay ? 'Đang lưu…' : 'Xác nhận'}
        </button>
      </div>
    </Khung>
  )
}

export default function ActionApp() {
  const [email, setEmail] = useState(undefined)   // undefined=đang tải · null=chưa đăng nhập · string=email
  useEffect(() => {
    let go = false
    supabase?.auth.getSession().then(({ data }) => { if (!go) setEmail(data?.session?.user?.email || null) })
      .catch(() => { if (!go) setEmail(null) })
    const { data: sub } = supabase?.auth.onAuthStateChange((_e, s) => { if (!go) setEmail(s?.user?.email || null) }) || { data: null }
    return () => { go = true; sub?.subscription?.unsubscribe?.() }
  }, [])

  if (!supabase) return <Khung><p className="text-sm text-muted py-4 text-center">Chưa cấu hình máy chủ.</p></Khung>
  if (email === undefined) return <Khung><p className="text-sm text-muted py-6 text-center">Đang tải…</p></Khung>
  if (!email) return <FormDangNhap />
  return <TheoVe email={email} />
}
