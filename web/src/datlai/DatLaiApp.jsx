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

// Đợt C 04/09/2026: màu qua token thay hex — có giao diện tối.
const NAVY = 'var(--text-strong)'
const TEAL = 'var(--primary-solid)'
const PAGE_BG = 'var(--bg-canvas)'

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
      <div className="w-full max-w-md rounded-3xl bg-surface shadow-2xl ring-1 ring-line p-7 sm:p-8">{children}</div>
    </div>
  )
}

// Huy hiệu icon căn giữa (gradient) — lock / mail / check.
const PATHS = {
  lock: <><rect x="4" y="10.5" width="16" height="10.5" rx="2.6" /><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" /><circle cx="12" cy="15.6" r="1.4" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.6" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
}
function HuyHieu({ type = 'lock' }) {
  const ok = type === 'check'
  return (
    <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
      style={{ background: ok ? 'var(--success-solid)' : 'var(--anchor)',
        boxShadow: '0 14px 28px -12px rgba(14,124,107,0.6)' }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[type]}
      </svg>
    </div>
  )
}

// Đầu trang: huy hiệu + thương hiệu + tiêu đề lớn + mô tả (căn giữa).
function DauTrang({ type = 'lock', tieuDe, phu }) {
  return (
    <div className="flex flex-col items-center text-center">
      <HuyHieu type={type} />
      <div className="flex items-center gap-1.5 mt-4">
        <img src={logoCpc1hn} onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="h-4 w-4 object-contain opacity-70" />
        <span className="text-[12px] font-bold tracking-[0.14em] uppercase text-muted">BMS · CPC1HN</span>
      </div>
      <h1 className="mt-2 text-[22px] font-bold leading-tight" style={{ color: NAVY }}>{tieuDe}</h1>
      <p className="mt-1.5 text-[13px] text-muted leading-relaxed max-w-[300px]">{phu}</p>
    </div>
  )
}

// Ô mật khẩu có nút hiện/ẩn.
// Đợt B 04/09/2026: nhãn thật (aria-label = placeholder cũ) — placeholder không tính là nhãn WCAG;
// nút hiện/ẩn BỎ tabIndex={-1} để người dùng bàn phím vẫn bấm được.
function OMatKhau({ value, onChange, placeholder, autoFocus }) {
  const [hien, setHien] = useState(false)
  return (
    <div className="relative">
      <input type={hien ? 'text' : 'password'} value={value} onChange={onChange} autoFocus={autoFocus} required
        placeholder={placeholder} aria-label={placeholder} autoComplete="new-password"
        className="w-full rounded-xl bg-subtle ring-1 ring-line px-3.5 py-3 pr-11 text-sm outline-none transition focus:bg-surface focus:ring-2 focus:ring-success-line/70" />
      <button type="button" onClick={() => setHien((v) => !v)}
        aria-label={hien ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={hien}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-body">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {hien
            ? <><path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.3 13.3 0 0 1-2.16 2.83M6.1 6.1A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 3.32-.6M1 1l22 22" /></>
            : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>}
        </svg>
      </button>
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
  if (tt === 'da_gui') return (
    <Khung>
      <DauTrang type="check" tieuDe="Đã gửi email" phu="Kiểm tra hộp thư để tiếp tục đặt lại mật khẩu." />
      <p className="mt-5 text-[13px] text-success bg-success-soft ring-1 ring-success-line rounded-xl px-4 py-3 leading-relaxed text-center">
        Nếu <b>{email}</b> có trong hệ thống, liên kết đặt lại đã được gửi. Mở thư và bấm liên kết. Không thấy? Kiểm tra <b>Spam/Quảng cáo</b>.
      </p>
      <div className="mt-5 text-center">
        <a href="index.html" className="text-[12.5px] font-medium text-muted hover:text-success">← Về trang đăng nhập</a>
      </div>
    </Khung>
  )
  return (
    <Khung>
      <DauTrang type="mail" tieuDe="Khôi phục mật khẩu" phu="Nhập email tài khoản — chúng tôi gửi liên kết đặt lại mật khẩu tới hộp thư của bạn." />
      {loiBanDau && <p className="mt-5 text-[12.5px] text-warning bg-warning-soft ring-1 ring-warning-line rounded-xl px-4 py-2.5 leading-relaxed text-center">{loiBanDau} Liên kết chỉ dùng 1 lần trong ~1 giờ — gửi lại bên dưới.</p>}
      <form onSubmit={gui} className="mt-5 space-y-3">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required
          placeholder="Email tài khoản" aria-label="Email tài khoản" autoComplete="username"
          className="w-full rounded-xl bg-subtle ring-1 ring-line px-3.5 py-3 text-sm outline-none transition focus:bg-surface focus:ring-2 focus:ring-success-line/70" />
        {loi && <p role="alert" className="text-[13px] text-danger text-center">{loi}</p>}
        <button type="submit" disabled={tt === 'dang_gui'}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-40" style={{ backgroundColor: TEAL }}>
          {tt === 'dang_gui' ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
        </button>
      </form>
      <div className="mt-5 text-center">
        <a href="index.html" className="text-[12.5px] font-medium text-muted hover:text-success">← Về trang đăng nhập</a>
      </div>
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
      <DauTrang type="check" tieuDe="Đã đổi mật khẩu" phu="Mật khẩu mới có hiệu lực ngay. Dùng nó cho lần đăng nhập sau." />
      <div className="mt-6 text-center">
        <a href="index.html" className="inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105" style={{ backgroundColor: TEAL }}>Vào hệ thống →</a>
      </div>
    </Khung>
  )
  const khop = mk2.length > 0 && mk1 === mk2
  return (
    <Khung>
      <DauTrang type="lock" tieuDe="Tạo mật khẩu mới" phu="Chọn mật khẩu mới cho tài khoản của bạn. Chỉ bạn biết mật khẩu này." />
      <form onSubmit={dat} className="mt-5 space-y-3">
        <OMatKhau value={mk1} onChange={(e) => setMk1(e.target.value)} placeholder="Mật khẩu mới" autoFocus />
        <p className="text-[12px] text-muted -mt-1 pl-1">{mk1.length >= 8 ? <span className="text-success">✓ Đủ độ dài</span> : 'Tối thiểu 8 ký tự'}</p>
        <OMatKhau value={mk2} onChange={(e) => setMk2(e.target.value)} placeholder="Nhập lại mật khẩu mới" />
        {mk2.length > 0 && <p className={`text-[12px] -mt-1 pl-1 ${khop ? 'text-success' : 'text-danger'}`}>{khop ? '✓ Hai mật khẩu khớp' : 'Hai lần nhập chưa khớp'}</p>}
        {loi && <p role="alert" className="text-[13px] text-danger text-center">{loi}</p>}
        <button type="submit" disabled={dang}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-40" style={{ backgroundColor: TEAL }}>
          {dang ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
        </button>
      </form>
      <p className="mt-4 text-[12px] text-muted leading-relaxed text-center">
        🔒 Chỉ bạn biết mật khẩu này — quản trị hệ thống không xem được (hồ sơ GMP/Part 11).
      </p>
    </Khung>
  )
}

export default function DatLaiApp() {
  if (!supabase) return <Khung><p className="text-sm text-muted py-4 text-center">Chưa cấu hình máy chủ.</p></Khung>
  const coToken = TOKEN.type === 'recovery' && TOKEN.access && TOKEN.refresh
  if (coToken) return <FormDatLai />
  return <FormGuiLai loiBanDau={TOKEN.loi} />
}
