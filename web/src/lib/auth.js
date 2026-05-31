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
  // QUAN TRỌNG: callback này KHÔNG được async và KHÔNG được gọi bất kỳ hàm Supabase
  // nào (kể cả .from().select()) ngay bên trong. Lý do: khi onAuthStateChange chạy,
  // thư viện Supabase đang GIỮ lock của Auth (Web Locks). Nếu trong callback ta lại
  // gọi một truy vấn — truy vấn đó cần lấy access_token → lại xin chính lock đó →
  // DEADLOCK (lock không tái nhập). Hậu quả thực tế: sau khi F5 (đã có phiên lưu
  // trong localStorage), sự kiện INITIAL_SESSION kích hoạt callback → deadlock →
  // toàn bộ Auth treo → đăng nhập lại cũng treo, phải xóa dữ liệu web mới thoát.
  // Cách sửa: callback trả về NGAY (nhả lock), rồi mới tra vai trò ở task riêng.
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const email = session?.user?.email
    if (!email) { callback(null); return }
    setTimeout(() => { taoNguoiDungTuEmail(email).then(callback).catch(() => callback({ email, name: email.split('@')[0], role: 'IPC' })) }, 0)
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
