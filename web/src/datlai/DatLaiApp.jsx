// ============================================================
// DatLaiApp — TRANG ĐẶT LẠI MẬT KHẨU từ email khôi phục (bundle riêng, siêu nhẹ).
//
// Luồng: màn đăng nhập bấm "Quên mật khẩu?" → Supabase gửi email → link trong
// email trỏ về datlai.html kèm #access_token…&type=recovery → trang này dựng
// phiên tạm từ token và cho người dùng tự đặt mật khẩu mới (updateUser).
// Không ai — kể cả quản trị — phải cấp/chạm vào mật khẩu tạm (attribution
// Part 11 giữ nguyên vẹn). Token được ĐỌC RỒI XÓA khỏi URL ngay khi nạp trang.
// ============================================================
import React, { useState } from 'react'
import { supabase } from '../lib/bmsClient'
import { guiEmailKhoiPhuc, datLaiMatKhauTuLink } from '../lib/auth'
import logoCpc1hn from '../assets/logo-cpc1hn.png'

const NAVY = '#1E3A56'
const TEAL = '#0E7C6B'
const PAGE_BG = 'linear-gradient(155deg,#EAF3F8 0%,#FAFDFF 45%,#E2F2EE 100%)'

// Đọc token từ hash NGAY khi nạp module rồi dọn URL (token là bí mật — không
// để nằm trên thanh địa chỉ/lịch sử). GoTrue trả về dạng:
//   #access_token=…&refresh_token=…&type=recovery   (thành công)
//   #error=access_denied&error_description=…        (link hỏng/hết hạn)
const _hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
const TOKEN = {
  access: _hash.get('access_token') || '',
  refresh: _hash.get('refresh_token') || '',
  type: _hash.get('type') || '',
  loi: _hash.get('error_description') || (_hash.get('error') ? 'Liên kết không hợp lệ.' : ''),
}
try { window.history.replaceState(null, '', window.location.pathname) } catch { /* bỏ qua */ }

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
        <img src={logoCpc1hn} onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="h-7 w-7 object-contain" />
      </div>
      <div className="min-w-0 text-left">
        <h1 className="text-sm font-bold leading-tight" style={{ color: NAVY }}>Đặt lại mật khẩu</h1>
        <p className="text-[12px] text-slate-500 truncate">{phu}</p>
      </div>
    </div>
  )
}

// Không có token (mở nhầm/link hết hạn) → cho tự gửi lại email khôi phục.
function FormGuiLai({ loiBanDau }) {
  const [email, setEmail] = useState('')
  const [tt, setTt] = useState('')   // '' | 'dang_gui' | 'da_gui'
  const [loi, setLoi] = useState('')
  const gui = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) { setLoi('Nhập email hợp lệ.'); return }
    setTt('dang_gui'); setLoi('')
    const { error } = await guiEmailKhoiPhuc(email)
    if (error) { setTt(''); setLoi(error.message || 'Không gửi được — thử lại.'); return }
    setTt('da_gui')
  }
  return (
    <Khung>
      <DauTrang phu="Gửi email khôi phục" />
      {loiBanDau && <p className="mt-3 text-[13px] text-amber-700 bg-amber-50 ring-1 ring-amber-100 rounded-xl px-3 py-2">{loiBanDau} Liên kết chỉ dùng được 1 lần trong ~1 giờ — gửi lại bên dưới.</p>}
      {tt === 'da_gui' ? (
        <p className="mt-4 text-[13px] text-teal-700 bg-teal-50 ring-1 ring-teal-100 rounded-xl px-3 py-2 leading-relaxed">
          Nếu email <b>{email}</b> có trong hệ thống, thư đặt lại mật khẩu đã được gửi — mở thư và bấm liên kết. Không thấy? Kiểm tra Spam.
        </p>
      ) : (
        <form onSubmit={gui} className="mt-4 space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required
            placeholder="Email tài khoản" autoComplete="username"
            className="w-full rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5 text-sm" />
          {loi && <p className="text-[13px] text-rose-600">{loi}</p>}
          <button type="submit" disabled={tt === 'dang_gui'}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: TEAL }}>
            {tt === 'dang_gui' ? 'Đang gửi…' : 'Gửi email khôi phục'}
          </button>
        </form>
      )}
      <a href="index.html" className="mt-4 inline-block text-[12px] font-medium text-slate-500 hover:text-teal-700">← Về trang đăng nhập</a>
    </Khung>
  )
}

// Có token recovery → form đặt mật khẩu mới.
function FormDatLai() {
  const [mk1, setMk1] = useState('')
  const [mk2, setMk2] = useState('')
  const [dang, setDang] = useState(false)
  const [loi, setLoi] = useState('')
  const [xong, setXong] = useState(false)
  const dat = async (e) => {
    e.preventDefault()
    if (mk1.length < 8) { setLoi('Mật khẩu cần ít nhất 8 ký tự.'); return }
    if (mk1 !== mk2) { setLoi('Hai lần nhập không khớp.'); return }
    setDang(true); setLoi('')
    const { error } = await datLaiMatKhauTuLink(TOKEN.access, TOKEN.refresh, mk1)
    setDang(false)
    if (error) { setLoi(error.message || 'Không đặt được mật khẩu — thử lại.'); return }
    setXong(true)
  }
  if (xong) return (
    <Khung>
      <DauTrang phu="Hoàn tất" />
      <h3 className="text-base font-semibold text-teal-700 mt-4">✓ Đã đổi mật khẩu</h3>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">Mật khẩu mới có hiệu lực ngay. Dùng nó cho lần đăng nhập sau.</p>
      <a href="index.html" className="mt-4 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: TEAL }}>Vào hệ thống</a>
    </Khung>
  )
  return (
    <Khung>
      <DauTrang phu="Chọn mật khẩu mới cho tài khoản của bạn" />
      <form onSubmit={dat} className="mt-4 space-y-3">
        <input type="password" value={mk1} onChange={(e) => setMk1(e.target.value)} autoFocus required
          placeholder="Mật khẩu mới (≥ 8 ký tự)" autoComplete="new-password"
          className="w-full rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5 text-sm" />
        <input type="password" value={mk2} onChange={(e) => setMk2(e.target.value)} required
          placeholder="Nhập lại mật khẩu mới" autoComplete="new-password"
          className="w-full rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3 py-2.5 text-sm" />
        {loi && <p className="text-[13px] text-rose-600">{loi}</p>}
        <button type="submit" disabled={dang}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: TEAL }}>
          {dang ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
        </button>
      </form>
      <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">
        Chỉ bạn biết mật khẩu này — quản trị hệ thống không xem được (hồ sơ GMP/Part 11).
      </p>
    </Khung>
  )
}

export default function DatLaiApp() {
  if (!supabase) return <Khung><p className="text-sm text-slate-500 py-4 text-center">Chưa cấu hình máy chủ.</p></Khung>
  const coToken = TOKEN.type === 'recovery' && TOKEN.access && TOKEN.refresh
  if (coToken) return <FormDatLai />
  return <FormGuiLai loiBanDau={TOKEN.loi} />
}
