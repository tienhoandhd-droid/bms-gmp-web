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
biểu đồ scorecard + **dashboard tương tác** + email text) → Gotenberg PDF → Drive (PDF + dashboard) +
Email (text tóm tắt, đính kèm dashboard + PDF) + Nhật ký.

**3 sản phẩm mỗi kỳ (theo yêu cầu 04/07):**
- **EMAIL text tóm tắt** — KHÔNG nhúng ảnh biểu đồ (tránh mờ/nén): KPI, top phòng, bất thường, nhận định AI
  dạng chữ/bảng + nút **"Mở dashboard tương tác"** (`cau_hinh.web_app_url`, rỗng → link thư mục Drive).
- **DASHBOARD tương tác** (`report-templates/dashboard-tuong-tac.html`) — HTML **tự chứa**, nhúng JSON kỳ,
  vanilla JS + SVG: line chart hover + lọc Nhà máy/Khu/AHU, heatmap lịch, top phòng, bất thường, SPC, MKT, AI.
  Mở offline, không lib ngoài. **Đính kèm email + lưu Drive**.
- **PDF scorecard** (`bao-cao-scorecard.html` → Gotenberg) — bản **KÝ DUYỆT GMP** (ALCOA+), lưu Drive + đính kèm.
  Gotenberg lỗi → đính kèm HTML scorecard thay PDF.

**Thiết kế chịu lỗi (đã kiểm chứng bằng execution thật `1673476`, `1673589`, `1674463`):**
- **Biểu đồ**: URL từ `cau_hinh.chart_render_url` (mặc định `http://chart-render:8081`, token
  `cau_hinh.chart_render_token`); không phản hồi → **tự vẽ SVG nội bộ** (line + heatmap lịch +
  sparkline), báo cáo KHÔNG chết. Email luôn dùng QuickChart PNG (Gmail chặn SVG data-URI).
- **PDF**: Gotenberg từ `cau_hinh.gotenberg_url` (mặc định `http://gotenberg:3000`); form có
  `printBackground=true` (giữ nền header xanh + ô KPI màu) + `preferCssPageSize=true` (dùng
  `@page A4` của template). Lỗi → email **đính kèm HTML thay PDF**, Drive-PDF tự bỏ qua.
- Drive/Email/Nhật ký chạy song song, node lỗi không chặn node khác (onError continue + retry).

> **KHÔNG dùng `$env`**: instance n8n này CHẶN `$env` trong biểu thức (`access to env vars denied`).
> Mọi URL/token đọc từ bảng `cau_hinh` — kể cả sau khi dựng service, node vẫn resolve đúng.
> (Bản đầu dùng `$env.GOTENBERG_URL` sẽ luôn ném lỗi trên instance này → đã sửa.)

## Người nhận email

Bảng **`nguoi_nhan_bao_cao`** (Supabase): 3 dòng placeholder đã tạo sẵn (`kich_hoat=false`).
→ Điền email thật + đặt `kich_hoat=true` (và cờ `nhan_tuan`/`nhan_thang`/`nhan_quy`).
Chưa kích hoạt ai → fallback `cau_hinh.email_bao_cao_thang` / `email_bao_cao_tuan` (hiện: chanbonght@gmail.com).
FROM lấy từ `cau_hinh.email_gui_tu` (phải trùng tài khoản Gmail SMTP).

## Dựng chart-render + Gotenberg (một lệnh)

Xem `services/README.md`. Tóm tắt:

```bash
cd services
cp .env.example .env          # sửa N8N_NETWORK nếu mạng n8n khác 'n8n_default'
docker compose up -d --build  # dựng CẢ chart-render (8081) + gotenberg (3000)
docker compose ps             # STATUS phải "healthy"
```

Cả hai tham gia mạng docker của n8n → n8n gọi bằng tên container (khớp mặc định `cau_hinh`).
Sau khi dựng, chạy thử lại (Execute Workflow) → PDF đính kèm + biểu đồ ECharts thay SVG fallback.
Nếu n8n KHÔNG chạy bằng docker: đổi `cau_hinh.gotenberg_url` / `chart_render_url` sang `http://<IP-host>:3000` / `:8081`.

## Việc còn lại (tùy chọn — nâng chất lượng)

| Việc | Vì sao | Cách làm |
|---|---|---|
| **Sửa thư mục Drive** | `drive_folder_id_bao_cao='root'` → service account bị **403** (SA không có quota My Drive riêng) — file hiện KHÔNG lưu được Drive (email vẫn gửi bình thường) | Tạo thư mục Drive (hoặc Shared Drive), **chia sẻ Editor** cho email service account của credential "kết nối google", rồi đặt `cau_hinh.drive_folder_id_bao_cao` = ID thư mục |
| **Dựng chart-render + Gotenberg** | Biểu đồ ECharts PNG (dấu tiếng Việt chuẩn) + PDF đính kèm/lưu trữ (hiện SVG + đính kèm HTML) | `cd services && docker compose up -d --build` (xem trên) |
| Font Be Vietnam Pro | Biểu đồ + PDF đúng font thương hiệu (mặc định đã có Noto Sans phủ đủ dấu) | `sh services/chart-render/fonts/tai-be-vietnam-pro.sh` rồi `docker compose build` |
| errorWorkflow | Báo IT khi WF5 v2 lỗi chí mạng (Supabase/GitHub/SMTP) | Mở workflow Settings → Error workflow → chọn WF4 (`co2ICoNbvwSaGRA7`) — MCP chưa đặt được mục này |

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
