// ============================================================
// ActionApp — TRANG THAO TÁC TỪ EMAIL (bundle riêng, siêu nhẹ).
//
// Vì sao tách khỏi App.jsx: mỗi nút trong email deep-link vào web. Nếu trỏ vào
// dashboard đầy đủ thì mỗi cú bấm phải TẢI + PARSE ~776KB JS (index+react+supabase)
// và có thể prefetch cả echarts 733KB — bấm nhiều nút = nhiều tab nặng → web lag +
// refresh-token đa-tab đá nhau → "lỗi đăng nhập". Trang này CHỈ có: đăng nhập +
// soi vé + xác nhận (2 RPC). KHÔNG import App/dashboard/charts.
//
// GMP/21 CFR Part 11: VẪN bắt đăng nhập → thao tác quy được cho người thật (JWT).
// Mọi kiểm tra vai trò/khu/hạn token do RPC làm ở máy chủ (SECURITY DEFINER).
// ============================================================
import React, { useEffect, useRef, useState } from 'react'
import { supabase, moTaLoi } from '../lib/bmsClient'
import { dangNhapMatKhau, dangXuat } from '../lib/auth'
import { kiemVeThaoTac, thaoTacSuCoTuEmail } from '../lib/supabaseData'

const NAVY = '#1E3A56'
const TEAL = '#0E7C6B'
const PAGE_BG = 'linear-gradient(155deg,#EAF3F8 0%,#FAFDFF 45%,#E2F2EE 100%)'

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
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 p-6">{children}</div>
    </div>
  )
}

function DauTrang({ phu }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-2xl bg-white px-2 ring-1 ring-slate-200 flex items-center justify-center h-10 w-10 shrink-0">
        <img src="./assets/logo-cpc1hn.png" onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="h-7 w-7 object-contain" />
      </div>
      <div className="min-w-0 text-left">
        <h1 className="text-sm font-bold leading-tight" style={{ color: NAVY }}>Thao tác sự cố từ email</h1>
        <p className="text-[12px] text-slate-500 truncate">{phu}</p>
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
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required
          placeholder="Email" autoComplete="username"
          className="w-full rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5 text-sm" />
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required
          placeholder="Mật khẩu" autoComplete="current-password"
          className="w-full rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5 text-sm" />
        {loi && <p className="text-[13px] text-rose-600">{loi}</p>}
        <button type="submit" disabled={dang}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: TEAL }}>
          {dang ? 'Đang đăng nhập…' : 'Đăng nhập & tiếp tục'}
        </button>
      </form>
      <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
        Trang này cố tình gọn nhẹ để bấm nhiều nút không làm chậm web. Mỗi liên kết trong
        email chỉ cần bấm một lần.
      </p>
    </Khung>
  )
}

// Soi vé + xác nhận. Tái hiện đúng hành vi ModalVeEmail trong App (nhưng dạng trang).
function TheoVe({ email }) {
  const [ve, setVe] = useState(null)       // { dangTai } | { ve } | { loi }
  const [ketQua, setKetQua] = useState(null)
  const [lyDo, setLyDo] = useState('')
  const [dangChay, setDangChay] = useState(false)
  const daChay = useRef(false)
  const daGo = useRef(false)

  useEffect(() => () => { daGo.current = true }, [])
  useEffect(() => {
    if (!TOKEN0 || daChay.current) return
    daChay.current = true
    setVe({ dangTai: true })
    kiemVeThaoTac(TOKEN0).then(({ error, ve }) => {
      if (daGo.current) return
      if (ve?.ok) setVe({ ve })
      else if (ve) setVe({ loi: ve.thong_bao || 'Liên kết không dùng được.', boiCanh: ve })
      else setVe({ loi: moTaLoi(error) })
    }).catch(() => { if (!daGo.current) setVe({ loi: 'Không kiểm tra được liên kết. Kiểm tra mạng rồi thử lại.' }) })
  }, [])

  if (!TOKEN0) return (
    <Khung>
      <DauTrang phu={email} />
      <p className="mt-4 text-[13px] text-slate-500 leading-relaxed">Không có liên kết thao tác. Bạn có thể mở bảng điều khiển để xử lý trực tiếp.</p>
      <NutMoDashboard />
    </Khung>
  )

  if (!ve || ve.dangTai) return (
    <Khung><DauTrang phu={email} /><p className="mt-6 text-sm text-slate-500 text-center py-4">Đang kiểm tra liên kết…</p></Khung>
  )

  // Màn từ chối (vé lỗi HOẶC thực thi trả ok:false) — bày ngữ cảnh DB gửi kèm.
  if (ve.loi || (ketQua && !ketQua.ok)) {
    const bc = ketQua && !ketQua.ok ? ketQua : ve.boiCanh
    const ganNhat = bc?.thao_tac_gan_nhat
    const khaDung = bc?.nut_kha_dung || []
    return (
      <Khung>
        <DauTrang phu={email} />
        <h3 className="text-base font-semibold text-rose-700 mt-4">Không thực hiện được</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{ve.loi || ketQua.thong_bao}</p>
        {ganNhat && (
          <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3 text-[13px]">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Thao tác gần nhất</div>
            <div className="mt-1 text-slate-700 font-medium">{ganNhat.nhan}</div>
            <div className="text-[12px] text-slate-500">{ganNhat.vai_tro} · {ganNhat.boi} · {ganNhat.luc_hien_thi}</div>
          </div>)}
        {khaDung.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Bây giờ bạn bấm được</div>
            <ul className="mt-1.5 space-y-1">{khaDung.map((n) => (
              <li key={n.hanh_dong} className="text-[13px] text-slate-700 flex gap-1.5"><span className="text-slate-300">•</span>{n.nhan}</li>))}</ul>
          </div>)}
        <NutMoDashboard />
      </Khung>)
  }

  if (ketQua?.ok) return (
    <Khung>
      <DauTrang phu={email} />
      <h3 className="text-base font-semibold text-teal-700 mt-4">✓ Đã ghi nhận</h3>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{ketQua.thong_bao}</p>
      <NutMoDashboard />
      <p className="mt-3 text-[11px] text-slate-400">Có thể đóng tab này.</p>
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
      <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-4">Xác nhận thao tác · {v.vai_tro_can}</p>
      <h3 className="text-base font-semibold text-slate-800 mt-1">{v.nhan}</h3>
      <div className="mt-3 rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-3 text-[13px] text-slate-600 space-y-1">
        <div><b>{v.ma_hien_thi}</b> · {v.ma_phong} {v.ten_phong ? `— ${v.ten_phong}` : ''}</div>
        <div className="text-[12px] text-slate-500">{v.khu_vuc} · {v.ahu || '—'} · {v.loai_cam_bien} · {v.muc_canh_bao}</div>
        <div className="text-[12px] text-slate-500">
          Trạng thái: <b>{v.nhan_trang_thai || v.trang_thai_hien_tai}</b>
          {v.giu_trang_thai
            ? <span className="text-slate-400"> — thao tác này chỉ ghi chú, không đổi trạng thái</span>
            : <> → <b>{v.nhan_trang_thai_sau || v.trang_thai_sau}</b>{v.dong_su_co && <span className="text-teal-600"> (đóng sự cố)</span>}</>}
        </div>
        {v.thao_tac_gan_nhat && (
          <div className="text-[12px] text-slate-500">Gần nhất: <b>{v.thao_tac_gan_nhat.nhan}</b> — {v.thao_tac_gan_nhat.vai_tro} · {v.thao_tac_gan_nhat.luc_hien_thi}</div>)}
        {v.so_lan_vang > 0 && <div className="text-[12px] text-amber-700">Đã báo "không tại hiện trường" {v.so_lan_vang} lần</div>}
      </div>
      {canNote && (
        <div className="mt-3">
          <label className="text-[11px] uppercase text-slate-500 font-semibold">Nội dung sự cố / biện pháp <span className="text-rose-500">*</span></label>
          <textarea value={lyDo} onChange={(e) => setLyDo(e.target.value)} rows={3} autoFocus
            placeholder="Ví dụ: van điều tiết kẹt, đã chỉnh lại 40% và theo dõi 30 phút"
            className="w-full mt-1.5 rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm" />
          <p className="text-[11px] text-slate-400 mt-1">Bắt buộc — ghi vào hồ sơ kiểm toán ALCOA+.</p>
        </div>)}
      <div className="flex gap-2 mt-5">
        <a href={URL_DASHBOARD} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-medium text-slate-700 text-center">Để sau</a>
        <button onClick={xacNhan} disabled={thieuNote || dangChay}
          className="flex-1 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: TEAL }}>
          {dangChay ? 'Đang ghi…' : 'Xác nhận'}
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

  if (!supabase) return <Khung><p className="text-sm text-slate-500 py-4 text-center">Chưa cấu hình máy chủ.</p></Khung>
  if (email === undefined) return <Khung><p className="text-sm text-slate-500 py-6 text-center">Đang tải…</p></Khung>
  if (!email) return <FormDangNhap />
  return <TheoVe email={email} />
}
