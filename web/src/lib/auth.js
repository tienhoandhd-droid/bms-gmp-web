// ============================================================
// auth.js — Đăng nhập bằng EMAIL + MẬT KHẨU (Supabase Auth).
// Vai trò (IPC/MEP/LOT/QA/IT/ADMIN) lấy từ bảng nguoi_dung theo email.
// ============================================================
import { supabase } from './bmsClient'

// Đăng nhập bằng email + mật khẩu (PROD)
export async function dangNhapMatKhau(email, matKhau) {
  if (!supabase) return { error: { message: 'Chưa cấu hình Supabase.' } }
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: matKhau,
  })
  return { error }
}

// (giữ magic link nếu cần dự phòng — không dùng ở UI mặc định)
export async function guiMagicLink(email) {
  if (!supabase) return { error: { message: 'Chưa cấu hình Supabase.' } }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  return { error }
}

export async function dangXuat() {
  if (supabase) await supabase.auth.signOut()
}

// Đổi mật khẩu của tài khoản đang đăng nhập
export async function doiMatKhau(matKhauMoi) {
  if (!supabase) return { error: { message: 'Chưa cấu hình Supabase.' } }
  const { error } = await supabase.auth.updateUser({ password: matKhauMoi })
  return { error }
}


export async function layPhienHienTai() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const email = data?.session?.user?.email
  if (!email) return null
  return await taoNguoiDungTuEmail(email)
}

export function theoDoiPhien(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const email = session?.user?.email
    callback(email ? await taoNguoiDungTuEmail(email) : null)
  })
  return () => data?.subscription?.unsubscribe?.()
}

// Tra vai trò từ bảng nguoi_dung theo email
async function taoNguoiDungTuEmail(email) {
  let role = null, name = email.split('@')[0]
  try {
    const { data } = await supabase.from('nguoi_dung').select('ho_ten, vai_tro').eq('email', email).maybeSingle()
    if (data) { role = data.vai_tro; name = data.ho_ten || name }
  } catch { /* role=null, RPC tự kiểm theo JWT */ }
  return { email, name, role: role || 'IPC' }
}
