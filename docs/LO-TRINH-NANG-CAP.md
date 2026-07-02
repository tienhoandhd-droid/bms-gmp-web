# Lộ trình nâng cấp hệ thống BMS-GMP (CPC1HN)

*Phiên bản 02/07/2026 — theo yêu cầu vận hành: chu kỳ 30 phút, lưu dữ liệu 6 tháng, báo cáo tuần/tháng/quý lưu Google Drive. Dữ liệu phút thô KHÔNG lưu lại phía Supabase (FMS server đã lưu, hệ chỉ lấy về tính toán).*

---

## Giai đoạn 1 — Dữ liệu & độ chính xác ✅ (đã triển khai 02/07/2026)

| # | Hạng mục | Trạng thái | Chi tiết |
|---|---|---|---|
| 1.1 | **Chu kỳ thu thập 30 phút** | ✅ | WF1 chạy phút :05 và :35, cửa sổ 30 điểm. Ngưỡng trong `cau_hinh` giữ nghĩa "trên 60 phút", code tự quy đổi (20/60' → 10/30'). Toàn bộ view/RPC tính "độ mới dữ liệu" đổi từ +1h → +30'. |
| 1.2 | **Phát hiện sensor đứng hình** | ✅ | Giá trị không đổi ≥10 phút → ghi `ngoai_le_du_lieu` mã `SENSOR_DUNG_HINH`. Vá lỗ hổng "sensor chết nhưng dashboard xanh". |
| 1.3 | **Thống kê trong-cửa-sổ** | ✅ | Mỗi sensor thêm: độ lệch chuẩn, P5/P50/P95, số đợt OOS, điểm vượt ngưỡng WARNING 2 cấp (alert limit từ FMS — trước đây bị bỏ). Lưu tại `du_lieu_gio.du_lieu_goc.chan_doan`. |
| 1.4 | **Hết "bỏ qua im lặng"** | ✅ | Lỗi HTTP FMS từng phòng → `ngoai_le_du_lieu` mã `FMS_HTTP_LOI`, hiện lên tab Tổng quan. |
| 1.5 | **Cắt bản sao thừa `du_lieu_goc`** | ✅ (dữ liệu mới) | RPC không copy nguyên sensor object nữa, chỉ lưu khối `chan_doan` (~120B vs ~650B). Dữ liệu cũ 108MB: chờ phê duyệt trước khi xóa (mục 3.4). |
| 1.6 | **Chặn ngưỡng suy biến** | ✅ | Ngưỡng FMS lower==upper (vd 0/0) bị coi là không có → hết nguy cơ OOS ảo. |

## Giai đoạn 2 — Vòng đời dữ liệu & phân tích tất định ✅ (đã triển khai 02/07/2026)

| # | Hạng mục | Trạng thái | Chi tiết |
|---|---|---|---|
| 2.1 | **Lưu dữ liệu 6 tháng** | ✅ | `rpc_don_dep_du_lieu_qua_han()` chạy 02:30 VN hằng đêm (pg_cron `bms-don-dep-du-lieu`): xóa `du_lieu_gio`, `kpi_gio`, nhật ký, ngoại lệ > 6 tháng. Số tháng đổi được qua `cau_hinh.so_thang_luu_du_lieu`. **KPI ngày giữ lâu dài** để báo cáo quý/năm vẫn đủ số liệu. |
| 2.2 | **Phân tích xu hướng đêm** | ✅ | `rpc_tinh_xu_huong_hang_ngay()` chạy 01:15 VN (pg_cron `bms-xu-huong-dem`): hồi quy tuyến tính 30 ngày (slope, R²) → `dac_trung_xu_huong`; so sánh 7 ngày vs baseline 30 ngày → `so_sanh_baseline`. Cấp TOTAL/AREA/AHU/ROOM × sensor. **AI không tham gia tính toán** — chỉ đọc kết quả viết nhận định. |
| 2.3 | **Báo cáo tuần/tháng/quý lưu Drive** | ✅ | WF5 (n8n): thứ 2 07:00 (tuần), ngày 1 07:15 (tháng; ngày 1 tháng 1/4/7/10 = quý). Tổng hợp KPI + xu hướng + baseline + nhận định AI gần nhất → file HTML tải lên Google Drive. Thư mục cấu hình tại `cau_hinh.drive_folder_id_bao_cao`. |

## Giai đoạn 3 — Web & lưu trữ (kế tiếp)

| # | Hạng mục | Ưu tiên | Ghi chú |
|---|---|---|---|
| 3.1 | Bỏ `web/dist` khỏi git + `.gitignore` | ✅ đã làm | CI tự build, không commit sản phẩm build. |
| 3.2 | Tách biểu đồ khỏi `App.jsx` + `React.lazy` | ✅ đã làm | Gom 8 biểu đồ vào `src/components/charts.jsx`, nạp trễ qua 1 wrapper `<Chart>`. **Đo thực tế:** chunk Recharts (360KB / 107KB gzip) rời khỏi màn hình đầu — không còn `modulepreload` ở `index.html`, chỉ tải khi mở tab Xu hướng / modal phòng. Đã build + smoke-test (Playwright): tab Tổng quan vẽ đúng 5 SVG / 73 bar, không lỗi mới. Sửa `vite.config.js` (bỏ ép Recharts vào chunk 'charts' → Rollup tự đẩy vào chunk async). |
| 3.3 | Chuyển Recharts → Apache ECharts (tree-shaken) | Hoãn (đánh giá) | Lợi ích tải-nhẹ đã đạt ở 3.2 (giữ Recharts, lazy). Riêng lợi ích ECharts (canvas 50k+ điểm, `markArea`, `dataZoom`, xuất PNG) **chưa cấp thiết** ở quy mô ~90 điểm/chuỗi; và viết lại 8 biểu đồ (tooltip/đường-dải giới hạn/chấm OOB đổi màu) mang rủi ro sai lệch hiển thị **không kiểm chứng trực quan được trong môi trường headless**. → Nên làm thành 1 đợt riêng có review trực quan trước khi merge, không đẩy mù vào production GMP. |
| 3.4 | Xóa `du_lieu_goc` cũ (bản sao thừa 108MB) | Trung bình | **Cần phê duyệt QA/ADMIN** vì đụng dữ liệu lịch sử (dù chỉ là bản sao của các cột đã có, FMS giữ bản gốc). Sau phê duyệt: UPDATE về `{}` + VACUUM. |
| 3.5 | Cảnh báo CRITICAL tức thời qua Telegram theo khu vực | ✅ đã làm | WF1 thêm chuỗi: Lấy sự cố CRITICAL mới (mở trong 3') → Soạn tin theo khu → Switch C1/C4/Q2 → 3 bot Telegram (Tele C1/Tele C4/Q2_BMS). Chống spam: chỉ báo sự cố MỚI mở; chat-id rỗng thì bỏ qua. Đã chạy thử (0 CRITICAL → no-op an toàn, ingest không ảnh hưởng). **Cần điền** `telegram_chat_id_c1/c4/q2` trong `cau_hinh`. |
| 3.6 | pg_partman phân vùng `du_lieu_gio` theo tháng | Thấp | Cần khi 57 phòng có dữ liệu đầy đủ (48 lượt/ngày × 81 sensor). Retention khi đó = drop partition (tức thời). |

## Giai đoạn 4 — AI đa nhân & báo cáo nâng cao (kế tiếp)

| # | Hạng mục | Ghi chú |
|---|---|---|
| 4.1 | Fallback chain Gemini → Groq → OpenAI trong WF3 | ✅ **đã làm.** WF3 thay node "Gọi OpenAI" bằng Code node chuỗi dự phòng (thứ tự đọc từ `cau_hinh.ai_thu_tu_uu_tien`, mặc định Gemini→Groq→OpenAI). Provider key rỗng → bỏ qua; primary hỏng → tự rơi sang provider sau. Ghi `model_dung` + `trang_thai_ai` (OK/FALLBACK/FAILED) qua `rpc_luu_bao_cao_ai_wf`. **Cần điền** `gemini_api_key`, `groq_api_key` (OpenAI đã có). AI chỉ viết nhận định — số liệu tính tất định ở SQL. |
| 4.2 | Writer–Judge: mô hình B thẩm định nhận định của mô hình A (bịa số? mâu thuẫn?) trước khi ghi DB | Ensemble nhẹ, không cần framework đa-agent. |
| 4.3 | Biểu đồ PNG trong email (QuickChart/ECharts SSR) | Báo cáo email có trend line + control chart. |
| 4.4 | SPC đầy đủ: EWMA/CUSUM + Nelson rules trong SQL | Nền tảng σ (1.3) đã có. Tham khảo spc-kit. |
| 4.5 | Join dữ liệu thời tiết (project Supabase `Du_bao_thoi_tiet` có sẵn) | Tách "AHU yếu" khỏi "trời nồm" khi phân tích RH. |
| 4.6 | MKT (Mean Kinetic Temperature) cho sensor T | Chỉ số ICH chuẩn thanh tra GMP, tính trong job đêm. |

---

## Ghi chú vận hành sau nâng cấp 02/07/2026

- **Ngưỡng cảnh báo**: `cau_hinh` giữ nguyên nghĩa "điểm OOS trên 60 phút" (chu_y=10, canh_bao=20, hanh_dong=4/10'). WF1 tự quy đổi về cửa sổ 30 phút — KHÔNG cần sửa giá trị khi đổi chu kỳ.
- **KPI theo bucket**: các cột `so_gio_*` trong `kpi_gio` từ nay đếm theo bucket 30 phút (2 bucket/giờ).
- **Đổi thời gian lưu**: sửa `cau_hinh.so_thang_luu_du_lieu` (mặc định 6).
- **Báo cáo Drive**: điền ID thư mục Drive vào `cau_hinh.drive_folder_id_bao_cao` (mở thư mục trên Drive, lấy chuỗi sau `/folders/`). Nếu để trống, WF5 báo lỗi qua Error Handler (WF4).
- **2 job đêm** xem tại: `select * from cron.job;` — `bms-xu-huong-dem` (01:15 VN), `bms-don-dep-du-lieu` (02:30 VN).
- **Telegram cảnh báo**: điền `telegram_chat_id_c1/c4/q2` trong `cau_hinh` (mỗi bot post vào nhóm khu của nó); `telegram_bat_canh_bao=false` để tắt toàn bộ.
- **AI đa mô hình (WF3)**: điền `gemini_api_key`, `groq_api_key`; đổi thứ tự ưu tiên tại `ai_thu_tu_uu_tien`.
- **Biểu đồ web lazy-load**: sau khi build, `web/dist/index.html` KHÔNG còn preload chunk Recharts; biểu đồ nằm ở chunk async `charts-*.js`, chỉ tải khi cần. Nếu thêm biểu đồ mới, đặt vào `src/components/charts.jsx` và gọi qua `<Chart type="…" />` để giữ tính lazy.
- **Lưu ý (bug có sẵn, ngoài phạm vi)**: ở chế độ DEMO (không cấu hình Supabase) tab "Xu hướng" lỗi `demoFull is not defined` — có từ trước, chỉ ảnh hưởng preview cục bộ, KHÔNG ảnh hưởng bản LIVE. Nên sửa riêng khi tiện.
