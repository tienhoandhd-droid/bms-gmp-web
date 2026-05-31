// ============================================================
// bmsClient.js — Lớp gọi Supabase: TIMEOUT + RETRY + HỦY (abort) thông minh
// v10.2 (2026): bổ sung projection cột (chống over-fetch), PKCE cho Auth,
//   ghép AbortSignal ngoài (hủy request khi component unmount → tránh race
//   & rò rỉ), và chuẩn hóa lỗi nghiệp vụ vs hạ tầng.
//
// Vì sao có lớp này: mockup gốc gọi thẳng fetch → mạng chậm/timeout làm UI
// treo hoặc trắng màn hình. Lớp này đảm bảo mọi truy vấn đều có giới hạn
// thời gian, tự thử lại lỗi tạm thời, và không bao giờ thử lại lỗi nghiệp vụ.
// ============================================================
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON, HAS_SUPABASE } from './config'

// Chỉ tạo client khi có cấu hình (chế độ demo không cần Supabase).
// anon_key là CÔNG KHAI — TUYỆT ĐỐI không nhúng service_role vào web.
// flowType 'pkce': chuẩn 2026 cho magic-link/OAuth — chống chặn-bắt token,
//   liên kết đăng nhập trả 'code' rồi đổi lấy phiên ở client (an toàn hơn implicit).
export const supabase = HAS_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: { headers: { 'x-app': 'bms-gmp-v10' } },
    })
  : null

// ---- Phân loại lỗi: TẠM THỜI (nên retry) vs NGHIỆP VỤ (không retry) ----
// Chỉ retry lỗi hạ tầng (mạng, timeout, 5xx, 429). KHÔNG retry {ok:false}
// (vd KHONG_DUOC_PHEP) — retry vô nghĩa và có thể gây tác dụng phụ.
function laLoiTamThoi(err) {
  if (!err) return false
  if (err.name === 'AbortError') return false                    // timeout/hủy của ta → không tự retry vô hạn
  if (err.message && /network|fetch|timeout|failed to fetch|load failed/i.test(err.message)) return true
  const code = Number(err.status ?? err.code)
  if (code === 429) return true
  if (code >= 500 && code < 600) return true
  return false
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    if (signal) signal.addEventListener('abort', () => { clearTimeout(id); reject(new DOMException('aborted', 'AbortError')) }, { once: true })
  })

// Bọc một lời gọi với AbortController timeout, đồng thời tôn trọng signal ngoài.
// finally luôn clearTimeout + gỡ listener → KHÔNG rò rỉ timer/handler.
async function voiTimeout(taoPromise, ms, signalNgoai) {
  const ctrl = new AbortController()
  const id = setTimeout(() => ctrl.abort(new DOMException('timeout', 'AbortError')), ms)
  const onAbort = () => ctrl.abort(signalNgoai?.reason || new DOMException('aborted', 'AbortError'))
  if (signalNgoai) {
    if (signalNgoai.aborted) ctrl.abort(signalNgoai.reason)
    else signalNgoai.addEventListener('abort', onAbort, { once: true })
  }
  try { return await taoPromise(ctrl.signal) }
  finally {
    clearTimeout(id)
    if (signalNgoai) signalNgoai.removeEventListener('abort', onAbort)
  }
}

// ---- Gọi RPC (đọc/ghi qua hàm) có timeout + backoff + hủy ----
// Trả { data, error }. error.nghiep_vu === true ⇒ lỗi do quy tắc (đừng retry).
export async function goiRPC(ten, thamSo = {}, { soLanThu = 3, timeoutMs = 12000, signal } = {}) {
  if (!supabase) return { data: null, error: { thong_bao: 'Chưa cấu hình Supabase (đang ở chế độ demo).' } }
  let loiCuoi = null
  for (let lan = 0; lan < soLanThu; lan++) {
    if (signal?.aborted) return { data: null, error: { name: 'AbortError' } }
    try {
      const { data, error } = await voiTimeout(
        (sig) => supabase.rpc(ten, thamSo).abortSignal(sig),
        timeoutMs, signal,
      )
      if (error) throw error
      // RPC hệ thống trả {ok:false, loi} cho lỗi nghiệp vụ → KHÔNG retry
      if (data && data.ok === false) {
        return { data, error: { nghiep_vu: true, ma_loi: data.loi, thong_bao: data.thong_bao || data.loi } }
      }
      return { data, error: null }
    } catch (err) {
      loiCuoi = err
      if (!laLoiTamThoi(err) || lan === soLanThu - 1) break
      try { await sleep(300 * 2 ** lan + Math.random() * 200, signal) }   // backoff lũy thừa + jitter
      catch { return { data: null, error: { name: 'AbortError' } } }
    }
  }
  return { data: null, error: loiCuoi }
}

// ---- Đọc View (SELECT) có timeout + backoff + hủy + PROJECTION CỘT ----
// build: hàm dựng truy vấn TỪ supabase.from(ten). PHẢI tự .select(...) cột cần,
//   vd (q) => q.select('ma_phong,ten_phong').eq('ma_phong','C4.R7').limit(50)
//   → chỉ kéo đúng cột cần, giảm payload & thời gian phản hồi (chống over-fetch).
export async function docView(ten, build = (q) => q.select('*'), { soLanThu = 3, timeoutMs = 12000, signal } = {}) {
  if (!supabase) return { data: null, error: { thong_bao: 'Chưa cấu hình Supabase (đang ở chế độ demo).' } }
  let loiCuoi = null
  for (let lan = 0; lan < soLanThu; lan++) {
    if (signal?.aborted) return { data: null, error: { name: 'AbortError' } }
    try {
      const { data, error } = await voiTimeout(
        (sig) => build(supabase.from(ten)).abortSignal(sig),
        timeoutMs, signal,
      )
      if (error) throw error
      return { data: data ?? [], error: null }
    } catch (err) {
      loiCuoi = err
      if (!laLoiTamThoi(err) || lan === soLanThu - 1) break
      try { await sleep(300 * 2 ** lan + Math.random() * 200, signal) }
      catch { return { data: null, error: { name: 'AbortError' } } }
    }
  }
  return { data: null, error: loiCuoi }
}

// Thông điệp lỗi thân thiện tiếng Việt
export function moTaLoi(error) {
  if (!error) return ''
  if (error.name === 'AbortError') return 'Máy chủ phản hồi quá lâu hoặc yêu cầu bị hủy. Vui lòng thử lại.'
  if (error.nghiep_vu) {
    const map = {
      KHONG_DUOC_PHEP: 'Bạn không có quyền thực hiện thao tác này.',
      CHUA_DANG_NHAP: 'Vui lòng đăng nhập để tiếp tục.',
      TOKEN_DA_DUNG: 'Liên kết đã được dùng hoặc đã hết hạn.',
      TOKEN_HET_HAN: 'Liên kết đã hết hạn.',
      SU_CO_DA_DONG: 'Sự cố này đã được đóng.',
      CHUYEN_TRANG_THAI_KHONG_HOP_LE: 'Không thể chuyển trạng thái này.',
    }
    return map[error.ma_loi] || error.thong_bao || 'Thao tác không hợp lệ.'
  }
  return 'Mất kết nối tới máy chủ. Kiểm tra mạng và thử lại.'
}
