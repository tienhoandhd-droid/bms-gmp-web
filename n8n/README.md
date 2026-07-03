# n8n — Workflow định nghĩa sẵn (import thủ công)

> Sinh ra vì phiên Claude không truy cập trực tiếp n8n được (network policy).
> Import xong chỉ cần GẮN CREDENTIAL — logic đã hoàn chỉnh.

## WF5-v2-bao-cao-quan-tri.json — Báo cáo quản trị tuần/tháng/quý

**Pipeline:** Lịch (T2 07:00 / ngày 1 07:15) → Xác định kỳ (TUAN/THANG/QUY, giờ VN)
→ Postgres gọi `rpc_bao_cao_tong_hop` (1 nguồn số liệu duy nhất — truy vết GMP)
→ chuẩn bị + render mọi biểu đồ qua `chart-render /render-batch`
→ tải 2 template từ GitHub raw (`report-templates/bao-cao-scorecard.html`, `email-bao-cao.html`)
→ ráp HTML chi tiết + email tóm tắt → Gotenberg xuất PDF
→ Drive (PDF + HTML) + Email (thân thư tóm tắt, **đính kèm PDF chi tiết**).

### Các bước sau khi Import from File

1. **Chạy migration trước**: dán `supabase/migrations/20260703_rpc_bao_cao_tong_hop.sql`
   vào Supabase Studio → SQL Editor → Run (đọc kỹ header "BẢN NHÁP" — đối chiếu tên cột
   bằng `\d kpi_ngay` trước).
2. Gắn credential cho 4 node (đều dùng lại credential sẵn có của WF cũ):
   | Node | Credential |
   |---|---|
   | Supabase — rpc_bao_cao_tong_hop | Postgres của WF1 (ghi Supabase) |
   | Drive — lưu PDF / lưu HTML | Google Drive OAuth2 của WF5 cũ |
   | Gửi email | SMTP của WF3 |
3. Sửa 2 chỗ `TODO_DRIVE_FOLDER_ID` = giá trị `cau_hinh.drive_folder_id_bao_cao`,
   và `TODO_DANH_SACH_NHAN` = danh sách email lãnh đạo (phẩy ngăn cách).
4. Dựng 2 container cạnh n8n (cùng docker network):
   ```bash
   # chart-render (services/chart-render trong repo)
   docker build -t chart-render services/chart-render && \
     docker run -d --name chart-render --network n8n_default -p 8081:8081 chart-render
   # gotenberg (PDF)
   docker run -d --name gotenberg --network n8n_default -p 3000:3000 gotenberg/gotenberg:8
   ```
   Nếu tên host khác `chart-render`/`gotenberg`: đặt biến môi trường n8n
   `CHART_RENDER_URL`, `GOTENBERG_URL` (node HTTP đã đọc `$env` với fallback).
5. Chạy thử thủ công (Execute Workflow) — node "Xác định kỳ" tự tính kỳ TUẦN gần nhất
   nếu hôm chạy không phải ngày 1. Kiểm tra: file PDF/HTML trên Drive + email nhận được,
   **dấu tiếng Việt trong biểu đồ** hiển thị đúng.
6. Ổn rồi → bật Active. Workflow cũ "BMS WF5 — Báo cáo tuần/tháng/quý" (id `a4cutCMwmmFv1GOS`)
   nên tắt Active để khỏi chạy trùng; giữ lại vài tuần để đối chiếu rồi archive.

### Ghi chú thiết kế
- Template tải từ GitHub raw mỗi lần chạy → sửa giao diện báo cáo chỉ cần commit repo,
  KHÔNG phải sửa workflow. (Repo private thì thay 2 node Tải template bằng cách dán
  template vào Code node.)
- Email chủ động giữ < 102KB (giới hạn Gmail cắt thư): thân thư chỉ có 1 biểu đồ line
  nhúng base64 + bảng số; heatmap/sparkline nằm trong PDF đính kèm.
- `settings.errorWorkflow` đã trỏ về WF4 (Xử lý lỗi hệ thống báo IT, id `co2ICoNbvwSaGRA7`).
- Múi giờ workflow: Asia/Ho_Chi_Minh (settings.timezone).
- Mã lần chạy (`ma_lan_chay`) chứa `$execution.id` n8n → truy vết ngược execution log.
