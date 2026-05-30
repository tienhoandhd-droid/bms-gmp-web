// ============================================================
// auth.js — Đăng nhập 2 chế độ
//  • DEMO/TEST: chọn tài khoản từ danh sách (như mockup) — nhanh để thử.
//  • PROD: Supabase Auth magic link (gửi email link một-lần).
// Khi đăng nhập thật, lấy vai_tro từ bảng nguoi_dung theo email.
// ============================================================
import { supabase } from './bmsClient'

// Gửi magic link tới email (PROD)
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

// Lấy phiên hiện tại + map sang {email, name, role}
export async function layPhienHienTai() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const email = data?.session?.user?.email
  if (!email) return null
  return await taoNguoiDungTuEmail(email)
}

// Theo dõi đổi phiên (đăng nhập/đăng xuất) — trả hàm hủy
export function theoDoiPhien(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const email = session?.user?.email
    callback(email ? await taoNguoiDungTuEmail(email) : null)
  })
  return () => data?.subscription?.unsubscribe?.()
}

// Tra vai trò từ bảng nguoi_dung theo email (RLS cho phép authenticated đọc master)
async function taoNguoiDungTuEmail(email) {
  let role = null, name = email.split('@')[0]
  try {
    const { data } = await supabase.from('nguoi_dung').select('ho_ten, vai_tro').eq('email', email).maybeSingle()
    if (data) { role = data.vai_tro; name = data.ho_ten || name }
  } catch { /* để role = null, RPC sẽ tự kiểm quyền theo JWT */ }
  return { email, name, role: role || 'IPC' }
}
