# Mẫu báo cáo tháng và quý đã được duyệt — 09/11/2026

Người dùng duyệt thư thử tháng 10/2026 và quý III/2026 gửi ngày 09/11/2026, yêu cầu lưu lại và
dùng mẫu này cho các lần gửi sau.

## Mẫu

Thư tháng, thư quý dùng chung mẫu với thư tuần (Kết luận · Phòng theo dõi so với kỳ trước ·
Cảnh báo và tác động · Ai làm gì · Bộ phận có phản hồi không), thêm hai mục ngay sau Kết luận:

- **Xu hướng tuần**: từng tuần thứ Hai – Chủ nhật trong kỳ (tuần đầu, cuối cắt theo ngày của kỳ).
- **Xu hướng tháng**: thư tháng gồm tháng này và 2 tháng trước; thư quý gồm 3 tháng của quý.

Mỗi mục gồm: câu tổng quát rút từ số → biểu đồ cột (vạch mức yêu cầu 80%) → bảng "Đánh giá cả kỳ"
(trung bình, thấp – cao, xu hướng = độ dốc hồi quy tuyến tính; đổi cả kỳ dưới 2 điểm là "đi ngang")
→ bảng từng tuần/tháng tô nền theo độ lệch so với trung bình các tuần/tháng của chính chỉ tiêu
(xanh cao hơn, xám quanh mức ±2 điểm, đỏ nhạt thấp hơn). Chỉ tiêu: toàn nhà máy (hoặc khu của bản
riêng), từng khu C1/C4/Q2, chênh áp phòng theo dõi. Bản in: mục 9.1, có thêm chênh áp từng phòng
theo dõi × từng tuần và × từng tháng. Thư tuần không có hai mục này.

## Bản tham chiếu

Dựng từ dữ liệu thật bằng mã nguồn đã duyệt, trong `output/bao-cao-thang-quy-xu-huong-2026-11-09/`:
`thang-10-2026-thu.html` / `-banin.html`, `quy-3-2026-thu.html` / `-banin.html`,
`thang-10-2026-khu-Q2-thu.html` / `-banin.html`. Các kỳ sau dùng dữ liệu kỳ tương ứng.

Thư thử đã gửi tới tienhoan.dhd@gmail.com: tháng 10 exec 12817582, quý 3 exec 12818017
(cả hai Gmail `250 OK`); thư tuần qua node mới exec 12818193.

## Vận hành

- WF5 `CKekaM0QRPl40GhQ` "BMS WF5 v3 — Báo cáo quản trị tuần/tháng/quý", bản active `b7547bd0`.
- Lịch: tuần thứ Hai 07:45; tháng mùng 1 07:00 (tháng lịch liền trước); quý mùng 1 tháng 1/4/7/10.
  Lần gửi thật đầu tiên theo mẫu này: báo cáo tháng 11/2026 ngày 01/12/2026; quý IV ngày 01/01/2027.
- Dữ liệu xu hướng lấy ở node SQL riêng "Supabase — xu hướng tuần/tháng" (n8n cắt mỗi câu SQL ở
  120 giây); node "Gộp xu hướng vào số liệu" ghép vào `bao_cao.xu_huong_chi_tiet`. Câu chính của quý
  đo 80 giây ngày 09/11/2026 — khoảng dư so với 120 giây không nhiều.
- Mã nguồn: `bo-rap-v3-nguon/xu-huong-ky.js` (+ `email.node.js`, `rap-bao-cao.node.js`,
  `bieu-do-thu.js`); test `report/xu-huong-ky-2026-11-09/xu-huong.test.mjs`. Chi tiết ở `BO-RAP-V3.md`.
