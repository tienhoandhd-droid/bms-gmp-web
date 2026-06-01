// ============================================================
// auth.js — Đăng nhập bằng EMAIL + MẬT KHẨU (Supabase Auth).
// Vai trò (IPC/MEP/LOT/QA/IT/ADMIN) lấy từ bảng nguoi_dung theo email.
// ============================================================
import { supabase } from './bmsClient'

// Đăng nhập bằng email + mật khẩu (PROD)
// Tự phục hồi: nếu phiên cũ trong trình duyệt bị hỏng/kẹt khiến lần đăng nhập đầu
// thất bại (lỗi storage/lock/JSON), tự DỌN phiên cục bộ rồi thử lại 1 lần →
// người dùng KHÔNG cần xóa cookie/dữ liệu trang thủ công.
export async function dangNhapMatKhau(email, matKhau) {
  if (!supabase) return { error: { message: 'Chưa cấu hình Supabase.' } }
  const cred = { email: email.trim(), password: matKhau }
  let { error } = await supabase.auth.signInWithPassword(cred)
  if (error && /lock|storage|localStorage|JSON|unexpected|navigator/i.test(error.message || '')) {
    try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* bỏ qua */ }
    ;({ error } = await supabase.auth.signInWithPassword(cred))
  }
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
  try {
    // Chống KẸT: nếu getSession treo (khóa storage bị giữ) → coi như chưa có phiên sau 8s.
    const phien = await Promise.race([
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(() => resolve({ data: { session: null }, error: { message: 'timeout' } }), 8000)),
    ])
    if (phien?.error) throw phien.error
    const email = phien?.data?.session?.user?.email
    if (!email) return null
    return await taoNguoiDungTuEmail(email)
  } catch {
    // Phiên lưu trong trình duyệt hỏng/kẹt → tự DỌN để lần đăng nhập sau sạch sẽ,
    // KHÔNG cần người dùng tự xóa cookie/dữ liệu trang.
    try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* bỏ qua */ }
    return null
  }
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
