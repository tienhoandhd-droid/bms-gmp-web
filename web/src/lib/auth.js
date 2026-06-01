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
    const { data } = await supabase.auth.getSession()
    const email = data?.session?.user?.email
    if (!email) return null
    return await taoNguoiDungTuEmail(email)
  } catch {
    // KHÔNG xóa phiên ở đây — nếu không sẽ tự đăng xuất nhầm khi F5
    // (getSession chậm/lỗi tạm thời vẫn giữ token; theoDoiPhien sẽ khôi phục).
    return null
  }
}

export function theoDoiPhien(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const email = session?.user?.email
    if (!email) { callback(null); return }
    // ⚠️ TUYỆT ĐỐI KHÔNG await truy vấn Supabase (.from()/.rpc()) NGAY trong callback này.
    // supabase-js v2 serialize Auth bằng Web Locks; await một truy vấn ở đây sẽ KẸT KHÓA:
    //   • signInWithPassword không bao giờ resolve → nút "Đang đăng nhập…" treo;
    //   • sau F5, phiên cũ kích hoạt lại đúng bẫy → không đăng nhập lại được.
    // → Phát NGAY người dùng tối thiểu (đồng bộ) để mở khóa luồng đăng nhập,
    //    rồi tra vai trò NGOÀI khóa bằng setTimeout(…,0).
    callback({ email, name: email.split('@')[0], role: null, dangTaiVaiTro: true })
    setTimeout(async () => {
      try { callback(await taoNguoiDungTuEmail(email)) } catch { /* giữ user tối thiểu */ }
    }, 0)
  })
  return () => data?.subscription?.unsubscribe?.()
}

// Tra vai trò từ bảng nguoi_dung theo email.
// CÓ TIMEOUT (8s): nếu RLS/mạng làm treo truy vấn, vẫn trả người dùng (role=null)
// thay vì treo UI. KHÔNG mặc định 'IPC' — gán vai trò sai gây hiểu nhầm quyền
// ("thông tin không khớp"); role=null để UI hiển thị rõ "chưa xác định vai trò".
async function taoNguoiDungTuEmail(email) {
  let role = null, name = email.split('@')[0]
  try {
    const truyVan = supabase.from('nguoi_dung').select('ho_ten, vai_tro').eq('email', email).maybeSingle()
    const hetGio = new Promise((res) => setTimeout(() => res({ data: null }), 8000))
    const { data } = await Promise.race([truyVan, hetGio])
    if (data) { role = data.vai_tro || null; name = data.ho_ten || name }
  } catch { /* giữ role=null */ }
  return { email, name, role }
}
