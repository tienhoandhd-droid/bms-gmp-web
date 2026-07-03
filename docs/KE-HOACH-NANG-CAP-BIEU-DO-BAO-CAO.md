# KẾ HOẠCH NÂNG CẤP — Biểu đồ trực quan & Báo cáo quản trị hiện đại

> Phiên bản: 2026-07-03 · Phạm vi: web dashboard (`web/`), Supabase `bms-gmp-v10`, các workflow n8n "BMS"
> Căn cứ: khảo sát toàn bộ mã nguồn v11, tài liệu `LO-TRINH-NANG-CAP.md`, danh sách workflow n8n hiện có, và nghiên cứu GitHub trending 2025–2026 về visualization / báo cáo tự động.

---

## 0. Tóm tắt hiện trạng (điểm xuất phát)

**Dashboard (web):**
- ECharts 6 (canvas, tree-shaken, lazy-load) — 8 loại biểu đồ qua 1 dispatcher `<Chart type=…>`: oosMini, miniArea, sparkline, complyTotal, complyPerMetric, roomBand, roomDetail, trendMain (dự phòng).
- Dải P5–P95 / min–max đang "giả lập" bằng 2 series line xếp chồng trong suốt — mong manh khi có null.
- Chưa có: overlay sự cố lên đường xu hướng, so sánh kỳ trước, tooltip đồng bộ giữa các biểu đồ, biểu đồ SPC trực quan (dữ liệu SPC đã có sẵn trong `dac_trung_xu_huong.du_lieu.spc`!), heatmap lịch.
- Token màu/format bị lặp giữa `App.jsx` và `charts.jsx`.

**Báo cáo hiện tại:**
- WF5 (n8n): HTML tự ráp trong Code node + ảnh QuickChart remote → upload Google Drive (tuần thứ 2 07:00 / tháng ngày 1 07:15 / quý).
- WF3: email AI hằng ngày (Gemini→Groq→OpenAI fallback, Writer–Judge) + QuickChart PNG.
- Web: "In báo cáo A4" phía client (canvas→PNG + window.print). Nút gửi email trên ReportsPage chỉ **giả lập**.
- Điểm yếu: bố cục HTML cũ, ảnh remote bị mail client chặn, không có PDF vector, không có scorecard/delta kỳ trước/đèn giao thông, số liệu báo cáo ráp rải rác trong nhiều node (khó kiểm chứng GMP).

**Backend đã có sẵn (tận dụng, KHÔNG cần làm lại):**
- `kpi_ngay` giữ lâu dài (đủ cho báo cáo quý/năm), `dac_trung_xu_huong` (slope, R², EWMA/CUSUM/Nelson), `so_sanh_baseline`, `xem_mkt_phong`, `xem_spc_canh_bao`, `thoi_tiet_ngoai`.

**Rủi ro dữ liệu:** FMS hỏng từ 01/07 → chỉ ~3/57 phòng có dữ liệu mới. Mọi hạng mục dưới đây vẫn triển khai được (dựa trên dữ liệu lịch sử + 3 phòng), nhưng **nghiệm thu cuối cùng chờ FMS phục hồi**.

---

## 1. Mục tiêu

1. **Biểu đồ trực quan hơn**: người vận hành nhìn 5 giây hiểu ngay phòng nào có vấn đề, xu hướng đi đâu, vi phạm SPC ở đâu.
2. **Báo cáo tuần/tháng/quý cho quản lý**: 1 trang scorecard hiện đại (KPI lớn + mũi tên delta so kỳ trước + đèn giao thông), biểu đồ nhúng đẹp đồng nhất với dashboard, nhận định AI tiếng Việt đã kiểm chứng số liệu, xuất **HTML (Drive) + PDF (lưu trữ GMP) + email responsive**.

## 2. Stack khuyến nghị (từ nghiên cứu GitHub trending)

| Nhu cầu | Chọn | Lý do |
|---|---|---|
| Engine biểu đồ web | **Giữ ECharts 6** | Đã tích hợp, đủ mạnh (markArea/markLine/visualMap/calendar heatmap native); không đổi engine |
| Biểu đồ trong email/báo cáo | **ECharts SSR → PNG** (microservice nhỏ) — fallback: self-host **QuickChart** (`typpo/quickchart`, Docker port 3400) | Biểu đồ email **giống hệt** dashboard; PNG an toàn mọi mail client; tự host → dữ liệu GMP không rời hạ tầng, hết rate-limit |
| Template email | **MJML** (~18k★, v5.4 2026) | Responsive + an toàn Outlook "by construction"; tiếng Việt OK; compile sẵn template, n8n chỉ interpolate |
| PDF lưu trữ | **Gotenberg** (Docker, HTTP API) | Pattern chuẩn của n8n (có template chính thức HTML→Gotenberg); nhớ cài font tiếng Việt |
| Font | **Be Vietnam Pro / Noto Sans** nhúng vào container Gotenberg + service SSR | Bẫy số 1: thiếu font → dấu tiếng Việt thành ô vuông trong PDF/PNG |
| SPC chart | **Tự vẽ bằng ECharts** (không có lib JS SPC nào tốt) | Số liệu EWMA/CUSUM/Nelson đã có sẵn trong DB — chỉ cần lớp hiển thị |

Không khuyến nghị: đổi sang Recharts/Tremor (mất công migrate lần nữa), Evidence.dev/Metabase (thêm 1 hệ thống phải vận hành — cân nhắc sau nếu nhu cầu BI mở rộng).

---

## 3. Phần A — Nâng cấp biểu đồ dashboard (trong repo này)

### A1. Nền tảng (làm trước, 1–2 ngày)
- [ ] Tách **design tokens** dùng chung: `web/src/lib/designTokens.js` (COLOR, SENSOR_COLOR, SENSOR_META, fmtPct…) — App.jsx và charts.jsx cùng import. Điều kiện tiên quyết để restyle không lệch màu.
- [ ] Viết **band renderer chuẩn** thay hack "2 line xếp chồng": dùng ECharts `custom` series (renderItem vẽ polygon) cho dải P5–P95 / min–max — chịu được null, không cần stack. Một hàm `bandSeries(lo, hi, color)` dùng lại cho roomBand + roomDetail.

### A2. Biểu đồ mới có giá trị cao nhất
1. **Biểu đồ SPC (Levey-Jennings)** — *đắt giá nhất, dữ liệu đã có sẵn*
   - Nguồn: `dac_trung_xu_huong.du_lieu.spc` (EWMA λ/L, CUSUM K/H, Nelson 1/2/3) + `xem_spc_canh_bao`.
   - Vẽ: đường giá trị ngày + markLine mean/±1σ/±2σ/±3σ (vùng sigma tô markArea nhạt dần), điểm vi phạm Nelson đổi màu đỏ + markPoint ghi rule nào.
   - Vị trí: tab Xu hướng GMP — thêm khối "Kiểm soát thống kê (SPC)" cạnh bảng `xem_spc_canh_bao` hiện có; click 1 dòng cảnh báo SPC → mở chart.
2. **Heatmap lịch vi phạm** (ECharts `calendar` + `heatmap` — cần đăng ký thêm 2 component, vẫn tree-shaken)
   - Ô = ngày, màu = số giờ OOS / % tuân thủ ngày (từ `kpi_ngay`). Nhìn 1 phát thấy "tuần nào tệ".
   - Vị trí: tab Xu hướng (scope TOTAL/AREA) + trong modal phòng (90 ngày).
3. **Overlay sự cố lên đường xu hướng** — markPoint/markLine dọc tại thời điểm mở sự cố (`xem_su_co_dang_mo` + lịch sử), tooltip hiện tên sự cố. Trả lời câu "đỉnh này là gì?" ngay trên biểu đồ.
4. **So sánh kỳ trước** (mục 3.7 roadmap đang nợ) — thêm series mờ "kỳ trước" (7n trước/30n trước) trên complyTotal & roomBand; toggle bật/tắt. Dữ liệu: gọi lại chính RPC hiện có với offset ngày (nếu RPC chưa nhận offset → cần thêm tham số `p_ket_thuc` — việc nhỏ phía Supabase).
5. **Tooltip đồng bộ** — `echarts.connect(group)` cho cụm 3 biểu đồ DP/RH/T trong modal phòng: rê chuột 1 chart, 2 chart kia hiện cùng thời điểm.

### A3. Tinh chỉnh trải nghiệm
- [ ] Sparkline grid trong bảng xếp hạng rủi ro: thêm chấm đánh dấu min/max + dải nền ngưỡng 80% (small-multiples đúng nghĩa).
- [ ] Nhãn trạng thái màu theo chuẩn "traffic light" thống nhất với báo cáo (xanh ≥95%, vàng 80–95%, đỏ <80% — chốt ngưỡng với QA).
- [ ] Cân nhắc `uPlot` (~10k★, 50KB) CHỈ KHI mở dữ liệu 30-phút 6 tháng (>200k điểm) sau khi backfill xong — chưa làm ngay.

---

## 4. Phần B — Nâng cấp báo cáo tuần/tháng/quý (Supabase + n8n)

### B1. Một nguồn số liệu duy nhất (GMP-critical, làm trước)
- [ ] Tạo RPC mới trong Supabase: **`rpc_bao_cao_tong_hop(p_ky text, p_tu date, p_den date)`** trả về **1 JSON duy nhất** gồm:
  - KPI kỳ này + kỳ trước (để tính delta): % tuân thủ, số giờ OOS, số sự cố mở/đóng, MTTR, số phòng đạt/không đạt, MKT, số tín hiệu SPC;
  - Top 5 phòng rủi ro + chuỗi ngày (cho biểu đồ);
  - Chuỗi tuân thủ theo ngày toàn nhà máy + theo khu;
  - Trích `so_sanh_baseline`, `dac_trung_xu_huong` (slope/R² đáng chú ý), nhận định AI gần nhất.
  - Lợi ích GMP: **mọi con số trong báo cáo truy vết về đúng 1 hàm SQL** (thay vì ráp rải rác trong node n8n); AI chỉ được viết lời bình từ JSON này, không tự bịa số (đã có Writer–Judge kiểm chứng).

### B2. Dịch vụ render biểu đồ (1 container nhỏ)
- [ ] Dựng **chart-render service**: Node + `echarts` SSR (`renderToSVGString`) + `sharp` rasterize → PNG; nhận POST `{type, data, options}`, trả PNG. Dùng chung module option với `charts.jsx` càng nhiều càng tốt → **biểu đồ email = biểu đồ dashboard**. Nhúng font Be Vietnam Pro.
- [ ] Fallback nhanh (nếu chưa dựng được container): self-host QuickChart — đổi `cau_hinh.quickchart_base_url` sang instance nội bộ, hết phụ thuộc quickchart.io.

### B3. Template báo cáo mới (WF5 v2)
Bố cục "executive scorecard" 1 trang + phụ lục:
1. **Header**: logo CPC1, kỳ báo cáo, khoảng ngày, dấu thời gian tạo + mã truy vết (id lần chạy WF5).
2. **Hàng KPI lớn** (4–6 ô): % tuân thủ, giờ OOS, sự cố, MKT… — mỗi ô có **mũi tên ▲▼ delta so kỳ trước** + đèn giao thông.
3. **Biểu đồ chính**: tuân thủ theo ngày (line + dải 80%) và **heatmap lịch** của kỳ.
4. **Bảng top phòng rủi ro** kèm sparkline PNG từng dòng.
5. **Khối SPC**: số tín hiệu, phòng nào, rule nào (từ `xem_spc_canh_bao`).
6. **Nhận định AI tiếng Việt** (đã Judge) — đóng khung "AI nhận định, số liệu do hệ thống tính".
7. **Phụ lục quý**: xu hướng 3 tháng, MKT chi tiết, danh mục sự cố & CAPA.

Sản phẩm mỗi kỳ: **(a)** HTML lên Drive như cũ, **(b)** **PDF qua Gotenberg** (bản lưu trữ chính thức GMP), **(c)** **email MJML** gửi danh sách quản lý (ảnh PNG đính CID, không dùng remote image → hết bị mail client chặn).

### B4. WF3 email hằng ngày — đồng bộ giao diện
- [ ] Chuyển body email sang cùng bộ template MJML + ảnh từ chart-render service. Giữ nguyên chuỗi Gemini→Groq→OpenAI và Writer–Judge (đang tốt).

---

## 5. Lộ trình & thứ tự thực hiện

| Giai đoạn | Hạng mục | Ước lượng | Phụ thuộc |
|---|---|---|---|
| **P1** (tuần 1) | A1 tokens + band renderer; B1 `rpc_bao_cao_tong_hop` | 3–4 ngày | Bật lại connector Supabase để tôi viết/apply migration |
| **P2** (tuần 1–2) | A2.1 SPC chart + A2.2 heatmap lịch | 3–4 ngày | P1 (tokens) |
| **P3** (tuần 2) | B2 chart-render service (hoặc QuickChart self-host) + font tiếng Việt | 2–3 ngày | Hạ tầng Docker (cùng máy n8n) |
| **P4** (tuần 3) | B3 WF5 v2: scorecard HTML + PDF Gotenberg + email MJML | 4–5 ngày | P1+P3; connector n8n để tôi sửa workflow |
| **P5** (tuần 3–4) | A2.3 overlay sự cố + A2.4 so sánh kỳ trước + A2.5 tooltip đồng bộ; B4 WF3 | 3–4 ngày | P2 |
| **P6** | Nghiệm thu với dữ liệu thật đầy đủ | — | **FMS phục hồi** (57 phòng) |

**Việc cần phía bạn:**
1. Bật lại connector **n8n + Supabase** cho phiên chat (hiện đang tắt) — tôi cần để đọc JSON node WF5/WF3 thật và apply migration.
2. Chỗ chạy 2 container: `chart-render` (hoặc QuickChart) + `gotenberg` — cùng host n8n là gọn nhất.
3. Chốt với QA: ngưỡng đèn giao thông, danh sách người nhận email báo cáo, PDF có cần chữ ký/số kiểm soát tài liệu không.
4. Điền các key cấu hình còn trống: `drive_folder_id_bao_cao`, `quickchart_base_url`, khóa AI, `telegram_chat_id_*`.

## 6. Rủi ro & biện pháp
- **FMS hỏng (3/57 phòng)** → phát triển trên dữ liệu lịch sử ≤30/06 + 3 phòng live; không chặn P1–P5.
- **Font tiếng Việt trong PDF/PNG** → test sớm ngay P3 với chuỗi "ĐẶNG ỄỆỠ ỰỬ" trước khi làm template.
- **Email nặng >102KB bị Gmail cắt** → ảnh đính CID thay vì base64, tối ưu PNG (pixelRatio 2, nén).
- **Trùng tên "WF5"** (báo cáo vs backfill) → nhân dịp này đổi tên workflow backfill thành WF9 cho khỏi nhầm.
- **Tính toàn vẹn GMP** → báo cáo chỉ dùng số từ `rpc_bao_cao_tong_hop`; log query + timestamp vào footer báo cáo; PDF là bản ghi lưu trữ.
