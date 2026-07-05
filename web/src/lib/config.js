// Cấu hình runtime đọc từ biến môi trường Vite (build-time).
//
// Thứ tự ưu tiên: biến môi trường (secret CI / .env cục bộ) → mặc định dưới đây.
// Mặc định trỏ thẳng vào project Supabase đang dùng (`snjxlsnxrefttupmnkvm`) để web
// LUÔN kết nối được kể cả khi CI chưa đặt secret hoặc chạy `npm run dev` cục bộ.
//
// AN TOÀN: chỉ nhúng ANON KEY — đây là khóa CÔNG KHAI (JWT role 'anon'), được thiết kế
// để chạy trong trình duyệt và luôn bị RLS chặn ở phía DB. TUYỆT ĐỐI không nhúng
// service_role (khóa quản trị) vào đây hay bất kỳ file nào của web.
const DEFAULT_SUPABASE_URL  = 'https://snjxlsnxrefttupmnkvm.supabase.co'
const DEFAULT_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuanhsc254cmVmdHR1cG1ua3ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTQ0NjIsImV4cCI6MjA5ODY5MDQ2Mn0.UX5iN39LEjGaxBZmQweM7peIFoMnXa5nEYG18cQb6IM'

export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || DEFAULT_SUPABASE_URL
export const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON
export const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON)
// v11.1 — ĐÃ LOẠI BỎ DEMO khỏi bản triển khai:
//   • Đã cấu hình Supabase  → LUÔN chạy LIVE (đọc/ghi dữ liệu thật).
//   • Chưa cấu hình (.env trống) → 'demo' chỉ để XEM TRƯỚC cục bộ, không có cách bật demo trên web đã deploy.
export const DEFAULT_DATA_SOURCE = HAS_SUPABASE ? 'live' : 'demo'
