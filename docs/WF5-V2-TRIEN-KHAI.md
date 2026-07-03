# WF5 v2 — Nhật ký triển khai (03/07/2026)

> Trạng thái: **ĐÃ TRIỂN KHAI, ACTIVE, đã chạy thử thành công bằng dữ liệu thật.**
> Chi tiết vận hành: xem `n8n/README.md`.

## 1. Đã làm (kiểm chứng trên hệ thống thật)

### Supabase (project bms-gmp-v10 = `jfonqwhjhsylruwfllbk`)

| Thay đổi | Migration | Kết quả kiểm chứng |
|---|---|---|
| **`rpc_bao_cao_tong_hop` v2.1** viết lại theo **schema thật** (bản nháp cũ giả định sai: không có bảng `kpi_ngay`/`phong`/cột `so_gio_oos`…) | `rpc_bao_cao_tong_hop_v2_schema_that` | Gọi thử `('THANG','2026-06-01','2026-06-30')`: tuân thủ 42.99% (kỳ trước 48.57%), 57 phòng (9 đạt/48 không), DQ 99.59%, 30/30 ngày, 3 khu + 11 AHU, 20 phòng bất thường, SPC 414 tín hiệu/58 scope, MKT max 24.49°C (C1.R28), sự cố 1323 mở/1264 đóng/MTTR 21.9h, AI có |
| **Bảng `nguoi_nhan_bao_cao`** + 3 dòng placeholder (`kich_hoat=false`) | `nguoi_nhan_bao_cao_wf5` | 3 dòng đã tạo; RLS bật (server-side only) |
| Key `cau_hinh.wf5_webhook_bao_cao_bu` = URL webhook gửi bù | (cùng migration trên) | Web đọc được qua `xem_cau_hinh_he_thong`, không bị mask |

Nguồn số liệu đối chiếu thật: `kpi_ngay_scope` (TOTAL/AREA/AHU) + `kpi_ngay_phong` (phòng),
`phong_sach`, `cam_bien`, `su_co` (thoi_gian_mo/dong, trang_thai_hien_tai),
`ngoai_le_du_lieu` (ma_loi/mo_ta_loi/bucket_utc), `dac_trung_xu_huong` (do_doc/r2/huong),
`so_sanh_baseline`, `xem_spc_canh_bao`, `xem_mkt_phong`, `bao_cao_ai` — TẤT CẢ lọc
`thuoc_thu_nghiem = cfg_bool('che_do_thu_nghiem')`.

### n8n

- **WF5 v2 tạo mới + Active**: `cjingBRK1XGYVMz9` — lịch tuần/tháng/quý + **webhook `wf5-bao-cao-bu`**.
- Credential thật đã gắn: Supabase Postgres (`4Zc8ZMCq7qPoSMtF`), kết nối google service account
  (`uqbMxdAY6BDmg4Ez`), Gmail SMTP (`sTnd4TyfGjyiau4W`).
- **Chạy thử thật** (execution `1673476`, `1673589`, `1673620`):
  - Email báo cáo TUẦN 26/2026 **đã gửi thành công** tới chanbonght@gmail.com (fallback), ~48KB, không sót placeholder.
  - Nhánh webhook `{"ky":"THANG"}` → đúng kỳ **THÁNG 06/2026 (01/06–30/06)**, nguồn `WEB_BU`.
  - `chart-render` & Gotenberg **chưa được dựng** cạnh n8n → workflow tự fallback (SVG nội bộ + đính kèm HTML) đúng thiết kế.
  - Nhật ký ghi `nhat_ky_chay_workflow` id 1867, 1868.
- **WF5 cũ (`a4cutCMwmmFv1GOS`) đã TẮT Active** — khỏi chạy trùng.

### Web (`web/src`)

- Trang **Báo cáo**: card "Gửi email báo cáo" (mô phỏng) → **"Gửi báo cáo bù (email)"** THẬT:
  chọn kỳ (Tháng trước — mặc định / Tuần trước / Quý trước) → gọi webhook WF5 v2
  (URL đọc từ `cau_hinh.wf5_webhook_bao_cao_bu`, pattern giống WF7). Build Vite OK.
- `supabaseData.js`: thêm `layWebhookBaoCaoBu()`, `guiBaoCaoBu(url, ky)`.

### Template báo cáo

- Nhãn "Giờ OOS" → **"Giờ cảnh báo (W+C)"** (schema thật không có "giờ OOS";
  số liệu = `so_gio_warning + so_gio_critical`), thêm giải thích ở phụ lục thuật ngữ.
- Lưu ý: workflow tải template từ nhánh `main` → nhãn mới có hiệu lực **sau khi merge nhánh này vào main**.

### Email text-only + Dashboard tương tác (04/07/2026 — theo yêu cầu)

Yêu cầu: "thông tin vào mail đủ màn hình, hình ảnh nén vào mail xấu" → "link đính kèm là 1 dashboard
động + thông tin trên mail tổng hợp / không nên để hình ảnh". Đã render email cũ kiểm tra: ảnh QuickChart
900×280 không có devicePixelRatio → mờ trên màn retina. Người xem dùng máy tính.

Giải pháp (đã chốt với người dùng: **Cả hai file + link**, **giữ PDF ký duyệt**):
- **Email → text-only** (`email-bao-cao.html` viết lại, 49KB→17KB, bỏ QuickChart/mọi `<img>`): KPI, top
  phòng, bất thường, AI dạng bảng/chữ + nút "Mở dashboard tương tác" (`cau_hinh.web_app_url`, rỗng → Drive).
- **Dashboard tương tác** (`dashboard-tuong-tac.html`, MỚI): HTML tự chứa, nhúng JSON kỳ, vanilla JS + SVG
  (line hover + lọc Nhà máy/Khu/AHU, heatmap, top phòng, bất thường, SPC, MKT, AI). Mở offline, không lib
  ngoài. **Đính kèm email + lưu Drive**. Đã render kiểm tra desktop với dữ liệu thật (không lỗi JS).
- **PDF scorecard giữ nguyên** làm bản ký duyệt GMP (đính kèm + Drive).
- Workflow: Ráp tải thêm dashboard template, nhúng JSON (escape `<`→`<`), xuất binary `dashboard_html`;
  Gộp file kèm dashboard; Drive HTML → **Drive lưu Dashboard**; Email đính kèm `(pdf|scorecard) + dashboard`.
  `cau_hinh.web_app_url` (migration + DB). Kiểm chứng execution `1675553`: email text gửi OK, đính kèm
  dashboard (72.8KB) + scorecard (70.3KB), tổng ~215KB.

### Cải tiến chart-render + Gotenberg (04/07/2026)

- **`services/docker-compose.yml`**: dựng CẢ `chart-render` (8081) + `gotenberg` (3000) bằng
  MỘT lệnh, chung mạng docker n8n, có healthcheck + restart. `services/gotenberg/Dockerfile`
  thêm **font Noto tiếng Việt** + curl. `services/README.md` + `.env.example` hướng dẫn đầy đủ.
- **`chart-render/server.js`**: `/render-batch` render **song song có giới hạn** (nhanh hơn khi
  nhiều sparkline) + **chịu lỗi từng biểu đồ** (1 lỗi không hỏng cả lô — trả `images`+`loi`,
  n8n tự bù SVG key thiếu); chỉ mở cổng khi chạy trực tiếp (import không bind cổng). Đã test
  cả 5 loại biểu đồ ra PNG hợp lệ.
- **Node Gotenberg**: thêm `printBackground=true` (**BẮT BUỘC** — nếu không PDF mất nền header
  xanh + ô KPI/bất thường có màu) + `preferCssPageSize=true` (dùng `@page A4` của template).
- **Sửa lỗi `$env` bị chặn** (phát hiện qua execution thật `1674141`: `access to env vars denied`):
  instance n8n này CHẶN `$env` trong biểu thức → URL `$env.GOTENBERG_URL` LUÔN ném lỗi, PDF không
  chạy kể cả sau khi dựng Gotenberg. Đã chuyển URL Gotenberg + chart-render (+ token) sang đọc từ
  `cau_hinh` (keys mới: `gotenberg_url`, `chart_render_url`, `chart_render_token` — đã thêm vào DB).
  Kiểm chứng execution `1674463`: lỗi đổi từ "access to env vars denied" → "EAI_AGAIN gotenberg"
  (chỉ là hostname chưa dựng — URL đã resolve đúng), email vẫn gửi OK.
- **Node Drive**: set tường minh `resource=file`/`operation=upload` (xóa cảnh báo validator; node
  vốn vẫn chạy bằng giá trị mặc định — lần chạy thật đã gọi API upload, nhận 403 do thư mục root).

## 2. Việc CẦN NGƯỜI DÙNG làm

- [ ] **Điền 3 email thật** vào bảng `nguoi_nhan_bao_cao` (Supabase Studio → Table Editor)
      và đặt `kich_hoat=true` từng dòng. (Đã hứa: "tôi sẽ thêm vào supabase sau".)
- [ ] **Sửa thư mục Drive**: tạo thư mục/Shared Drive, chia sẻ Editor cho service account
      của credential "kết nối google", đặt `cau_hinh.drive_folder_id_bao_cao` = ID thư mục.
      (Hiện `root` → SA bị 403, file KHÔNG lưu được Drive; email vẫn gửi bình thường.)
- [ ] (Tùy chọn) Dựng `chart-render` + Gotenberg: `cd services && cp .env.example .env && docker compose up -d --build`
      (xem `services/README.md`). Sau đó có biểu đồ ECharts + PDF đính kèm.
- [ ] (Tùy chọn) Đặt Error workflow = WF4 trong Settings của WF5 v2 (MCP không đặt được mục này).
- [ ] Merge nhánh `claude/wf5-v2-apply-7zksvj` vào `main` để template nhãn mới + nút web có hiệu lực khi deploy web.
