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

// QUÊN MẬT KHẨU — gửi email khôi phục. Link trong email trỏ về datlai.html
// (trang đặt lại mật khẩu siêu nhẹ, entry Vite riêng như action.html).
// Lưu ý bảo mật: Supabase KHÔNG tiết lộ email có tồn tại hay không — luôn trả
// thành công, chỉ gửi mail nếu tài khoản có thật (chống dò danh sách email).
export async function guiEmailKhoiPhuc(email) {
  if (!supabase) return { error: { message: 'Chưa cấu hình Supabase.' } }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: new URL('datlai.html', window.location.href).href,
  })
  return { error }
}

// Đặt mật khẩu mới từ link khôi phục: nhận cặp token trong hash của email link,
// dựng phiên tạm rồi updateUser. Dùng ở trang datlai.html.
export async function datLaiMatKhauTuLink(accessToken, refreshToken, matKhauMoi) {
  if (!supabase) return { error: { message: 'Chưa cấu hình Supabase.' } }
  const { error: errPhien } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (errPhien) return { error: { message: 'Liên kết đã hết hạn hoặc đã dùng — gửi lại email khôi phục.' } }
  const { error } = await supabase.auth.updateUser({ password: matKhauMoi })
  return { error }
}

// Đổi mật khẩu của tài khoản đang đăng nhập.
// #10 — Xác thực MẬT KHẨU HIỆN TẠI trước khi đổi: thử đăng nhập lại bằng mật khẩu cũ
// (Supabase không có API "verify password" riêng, nên dùng signInWithPassword để kiểm chứng).
// Nếu sai → trả lỗi rõ ràng, KHÔNG đổi. Đúng → mới updateUser sang mật khẩu mới.
export async function doiMatKhau(matKhauHienTai, matKhauMoi) {
  if (!supabase) return { error: { message: 'Chưa cấu hình Supabase.' } }
  // Lấy email phiên hiện tại để re-auth
  let email = null
  try { const { data } = await supabase.auth.getUser(); email = data?.user?.email || null } catch { /* bỏ qua */ }
  if (!email) return { error: { message: 'Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại.' } }
  if (!matKhauHienTai) return { error: { message: 'Vui lòng nhập mật khẩu hiện tại.' } }
  // Kiểm chứng mật khẩu hiện tại
  const { error: errVerify } = await supabase.auth.signInWithPassword({ email, password: matKhauHienTai })
  if (errVerify) return { error: { message: 'Mật khẩu hiện tại không đúng.' } }
  // Đổi sang mật khẩu mới
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

// Thử KHÔI PHỤC phiên trước khi kết luận "hết hạn" → đăng xuất.
// Bối cảnh: mở nhiều tab từ các nút trong email, supabase-js xoay refresh-token; một tab
// có thể tạm thấy RPC trả CHUA_DANG_NHAP dù phiên vẫn còn (tab khác vừa refresh, hoặc
// JWT vừa hết hạn và chưa refresh xong). getSession() đọc từ storage (rẻ, thấy token tab
// khác đã xoay); nếu vẫn trống thì refreshSession() chủ động 1 lần. Chỉ khi CẢ HAI đều
// trống mới thực sự là hết hạn. Trả người dùng nếu khôi phục được, null nếu không.
export async function thuKhoiPhucPhien() {
  if (!supabase) return null
  try {
    let { data } = await supabase.auth.getSession()
    let email = data?.session?.user?.email || null
    if (!email) {
      const r = await supabase.auth.refreshSession()
      email = r?.data?.session?.user?.email || null
    }
    if (!email) return null
    return await taoNguoiDungTuEmail(email)
  } catch {
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
    // Người quay lại: mở bảng NGAY bằng vai trò đã cache (dashboard không chờ mạng).
    // Không có cache: phát user tối thiểu (role=null) → hiện "Đang xác minh".
    const cache = docVaiTroCache(email)
    callback(cache ? { ...cache, dangTaiVaiTro: true } : { email, name: email.split('@')[0], role: null, dangTaiVaiTro: true })
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
// Cache vai trò theo email trong localStorage. Người quay lại được mở bảng NGAY
// bằng vai trò lần trước, rồi xác minh lại ở NỀN. An toàn: đây chỉ quyết định TAB
// nào hiện — mọi dữ liệu và thao tác vẫn do RLS + guard RPC ở máy chủ gác (DB là
// người gác thật). Sửa localStorage cùng lắm thấy một tab trống (RLS trả rỗng).
const KHOA_CACHE = 'bms_vaitro_cache'
function docVaiTroCache(email) {
  try {
    const m = JSON.parse(localStorage.getItem(KHOA_CACHE) || '{}')
    const c = m[email]
    if (c && c.role) return { email, name: c.name || email.split('@')[0], role: c.role, khuVuc: c.role === 'ADMIN' ? null : (c.khuVuc || null) }
  } catch { /* cache hỏng → bỏ qua */ }
  return null
}
function luuVaiTroCache(email, role, name, khuVuc) {
  try {
    const m = JSON.parse(localStorage.getItem(KHOA_CACHE) || '{}')
    if (role) m[email] = { role, name, khuVuc }
    else delete m[email]   // mất quyền ⇒ xoá cache để lần sau không mở nhầm
    localStorage.setItem(KHOA_CACHE, JSON.stringify(m))
  } catch { /* localStorage đầy/chặn → bỏ qua */ }
}

async function taoNguoiDungTuEmail(email) {
  let role = null, name = email.split('@')[0], khuVuc = null
  try {
    const truyVan = supabase.from('nguoi_dung').select('ho_ten, vai_tro, khu_vuc').eq('email', email).maybeSingle()
    const hetGio = new Promise((res) => setTimeout(() => res({ data: null, hetGio: true }), 8000))
    const kq = await Promise.race([truyVan, hetGio])
    const { data } = kq
    if (data) { role = data.vai_tro || null; name = data.ho_ten || name; khuVuc = Array.isArray(data.khu_vuc) ? data.khu_vuc : null }
    // Chỉ ghi cache khi tra ĐƯỢC thật (không phải do hết giờ) — tránh xoá cache oan
    // khi mạng chậm một nhịp; lần hết giờ vẫn dùng cache cũ ở theoDoiPhien.
    if (!kq.hetGio) luuVaiTroCache(email, role, name, khuVuc)
  } catch { /* giữ role=null */ }
  // ADMIN xem tất cả (khuVuc=null ⇒ không lọc); vai trò khác lọc theo khu_vuc.
  return { email, name, role, khuVuc: role === 'ADMIN' ? null : khuVuc }
}
