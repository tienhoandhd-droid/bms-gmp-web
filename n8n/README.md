# n8n — WF5 v2: Báo cáo quản trị tuần/tháng/quý

> **TRẠNG THÁI: ĐÃ TRIỂN KHAI & ACTIVE trên n8n ngày 03/07/2026.**
> Workflow id `cjingBRK1XGYVMz9` — https://n8n.cpc1hn.com/workflow/cjingBRK1XGYVMz9
> (tạo trực tiếp qua n8n MCP, KHÔNG cần import thủ công nữa).
> WF5 cũ `a4cutCMwmmFv1GOS` đã **tắt Active** để khỏi chạy trùng — giữ vài tuần để đối chiếu rồi archive.

## Kiến trúc

**2 trigger:**
1. **Lịch (UTC)**: T2 00:00 (= 07:00 VN) → báo cáo TUẦN trước · ngày 1 00:15 (= 07:15 VN)
   → báo cáo THÁNG trước (+ QUÝ trước nếu là tháng 1/4/7/10 — chạy 2 báo cáo trong 1 lần).
2. **Webhook `POST /webhook/wf5-bao-cao-bu`** — nút **"Gửi báo cáo bù"** trên web (trang Báo cáo).
   Body: `{"ky":"THANG"}` (mặc định) | `"TUAN"` | `"QUY"` — kỳ LIỀN TRƯỚC;
   hoặc `{"ky":"THANG","tu":"2026-05-01","den":"2026-05-31"}` cho khoảng tùy chọn.
   Trả lời ngay khi nhận (CORS `*`); báo cáo tạo + gửi trong nền (~30–60s).

**Pipeline:** Xác định kỳ (giờ VN) → Postgres: `rpc_bao_cao_tong_hop` (**1 nguồn số liệu — truy vết GMP,
đã đối chiếu schema thật**) + cấu hình + người nhận (`nguoi_nhan_bao_cao`) → Ráp báo cáo (1 Code node:
biểu đồ + template + email) → Gotenberg PDF → Drive (PDF + HTML) + Email (tóm tắt + đính kèm) + Nhật ký.

**Thiết kế chịu lỗi (đã kiểm chứng bằng execution thật `1673476`, `1673589`):**
- **Biểu đồ**: thử service `chart-render` (env `CHART_RENDER_URL`, mặc định `http://chart-render:8081`);
  không phản hồi → **tự vẽ SVG nội bộ** (line + heatmap lịch + sparkline), báo cáo KHÔNG chết.
  Email luôn dùng QuickChart PNG (Gmail chặn SVG data-URI).
- **PDF**: Gotenberg (env `GOTENBERG_URL`, mặc định `http://gotenberg:3000`); lỗi → email
  **đính kèm HTML thay PDF**, Drive-PDF tự bỏ qua.
- Drive/Email/Nhật ký chạy song song, node lỗi không chặn node khác (onError continue + retry).

## Người nhận email

Bảng **`nguoi_nhan_bao_cao`** (Supabase): 3 dòng placeholder đã tạo sẵn (`kich_hoat=false`).
→ Điền email thật + đặt `kich_hoat=true` (và cờ `nhan_tuan`/`nhan_thang`/`nhan_quy`).
Chưa kích hoạt ai → fallback `cau_hinh.email_bao_cao_thang` / `email_bao_cao_tuan` (hiện: chanbonght@gmail.com).
FROM lấy từ `cau_hinh.email_gui_tu` (phải trùng tài khoản Gmail SMTP).

## Việc còn lại (tùy chọn — nâng chất lượng)

| Việc | Vì sao | Cách làm |
|---|---|---|
| **Sửa thư mục Drive** | `drive_folder_id_bao_cao='root'` → service account bị **403** (SA không có quota My Drive riêng) — file hiện KHÔNG lưu được Drive (email vẫn gửi bình thường) | Tạo thư mục Drive (hoặc Shared Drive), **chia sẻ Editor** cho email service account của credential "kết nối google", rồi đặt `cau_hinh.drive_folder_id_bao_cao` = ID thư mục |
| Dựng `chart-render` | Biểu đồ ECharts PNG đẹp hơn SVG fallback, có dấu tiếng Việt chuẩn font | `docker build -t chart-render services/chart-render && docker run -d --name chart-render --network n8n_default chart-render` |
| Dựng Gotenberg | Có PDF đính kèm + lưu trữ (hiện đính kèm HTML) | `docker run -d --name gotenberg --network n8n_default gotenberg/gotenberg:8` |
| errorWorkflow | Báo IT khi WF5 v2 lỗi | Mở workflow Settings → Error workflow → chọn WF4 (`co2ICoNbvwSaGRA7`) — MCP chưa đặt được mục này |

## File trong thư mục này

- `WF5-v2-bao-cao-quan-tri.json` — export từ n8n (bản đã deploy) để lưu vết/khôi phục.
  Import lại chỉ cần gắn 3 credential: Supabase Postgres, kết nối google (service account), Gmail SMTP.
- `WF5-v2-bao-cao-quan-tri.sdk.js` — mã nguồn n8n Workflow SDK (nguồn chuẩn để tái tạo qua MCP).

## Ghi chú thiết kế

- Template tải từ GitHub raw (`report-templates/bao-cao-scorecard.html`, `email-bao-cao.html`, nhánh `main`)
  mỗi lần chạy → sửa giao diện chỉ cần merge vào main, KHÔNG sửa workflow.
- Email giữ < 102KB (giới hạn Gmail cắt thư) — đo thật ~48KB.
- `so_gio_oos` trong JSON = `so_gio_warning + so_gio_critical` (giờ ở trạng thái cảnh báo) —
  schema thật không có cột "giờ OOS"; template đã ghi nhãn "Giờ cảnh báo (W+C)".
- Nhật ký mỗi lần chạy: `nhat_ky_chay_workflow` (`ten_workflow='WF5_BAO_CAO_V2'`,
  `ma_lan_chay_n8n='WF5V2-<KY>-<đến-ngày>-<execution.id>'`) — truy vết ngược execution log n8n.
- Múi giờ tính kỳ: Asia/Ho_Chi_Minh (Luxon trong Code node — không phụ thuộc timezone n8n).
