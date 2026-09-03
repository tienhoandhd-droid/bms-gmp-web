# Bộ ráp báo cáo v3 — bố cục mới (03/09/2026)

Bộ dựng ba đầu ra của báo cáo giám sát môi trường phòng sạch từ một nguồn số liệu:

| Đầu ra | Tệp nguồn | Mô tả |
|---|---|---|
| Thân thư | `bo-rap-v3-nguon/email.node.js` | thư Gmail máy tính, ~50 KB, dưới ngưỡng cắt 75/102 KB |
| Bản in | `bo-rap-v3-nguon/rap-bao-cao.node.js` | 9 mục + phụ lục + kiểm soát tài liệu + ô ký |
| Bảng tra cứu | `bo-rap-v3-nguon/dashboard.node.js` | lọc khu/cụm/mức ưu tiên, bấm phòng xem số đo từng ngày |
| Lõi chung | `bo-rap-v3-nguon/bao-cao-loi.js` | từ điển tiếng Việt, phân cấp A/B, tổng hợp chỉ tiêu, vẽ SVG |

## Nguyên tắc thiết kế đã chốt

- Trình bày từ lớn tới nhỏ: cả hệ thống → ba khu (C1, C4, Q2) → cụm → phòng.
  Trong THƯ chỉ tới mức ba khu; chi tiết cụm/phòng nằm ở bản in và bảng tra cứu.
- Chênh áp là trọng tâm, tính **cả hai phía**: tụt dưới giới hạn dưới (phía nguy hiểm —
  nguy cơ nhiễm chéo) và vượt trên giới hạn trên. Nhiệt độ, độ ẩm dùng cùng thiết kế.
- So sánh giữa các nhóm bằng **tỉ lệ**, không bằng số giờ cộng dồn.
- Không dùng chữ "lệch" cho số đo ngoài dải (giữ "sai lệch" cho phiếu deviation),
  không "điểm %", không viết tắt tiếng Anh trong phần chữ.
- Phân loại việc phải xử lý do **luật cố định** trong `phanCap()`; máy viết nhận định
  chỉ nêu giả thuyết, dán nhãn "AI đề xuất", và bị lọc bởi `locPhatHien()`.
- Sự cố mở SAU ngày chốt kỳ tách khối "Ngoài kỳ báo cáo", không tính vào kết quả kỳ.

## Sửa và phát hành

1. Sửa ở `bo-rap-v3-nguon/` (bốn tệp).
2. `node dong-goi.js` → sinh `bo-rap-v3.bundle.js` (một tệp tự chứa).
3. Chép thành `report-templates/bo-rap-v3.js`, commit, push.
4. Node n8n "Ráp báo cáo v3" tải tệp theo khoá cấu hình `bo_rap_v3_phien_ban`
   (chưa khai báo = `main`). Phát hành chính thức: tạo thẻ git rồi đặt khoá trỏ thẻ.

`kiem-truong-hop-bien.js` chạy 5 trường hợp biên (kỳ rỗng, thiếu kỳ trước, thiếu dự
báo, một khu, không sự cố) — phải "dựng được trang" hết trước khi phát hành.

## Workflow nháp trên n8n

`BMS WF5 v3 — Bố cục mới (nháp, không gửi mail)` — id `CKekaM0QRPl40GhQ`.
KHÔNG đụng WF5 v2 đang chạy. Node "Gửi email báo cáo" TẮT SẴN.

Chuỗi: Webhook `wf5v3-chay-nhap` → Xác định kỳ → Supabase (chỉ SELECT) →
Nhận định máy (JSON 5 trường) → Ráp v3 → tải Drive (lỗi thì vẫn đi tiếp) →
chèn liên kết bảng tra cứu vào thư → gửi email (đang tắt).

### Cách tự kiểm thư (test mail)

1. Mở workflow → bật node **Gửi email báo cáo** (bỏ Disable).
2. (Khuyên) sửa tạm `toEmail` thành địa chỉ của mình để duyệt trước.
3. Gọi webhook:
   ```
   curl -X POST https://n8n.cpc1hn.com/webhook/wf5v3-chay-nhap \
     -H 'Content-Type: application/json' \
     -d '{"ky":"THANG","tu":"2026-08-01","den":"2026-08-31"}'
   ```
   (đổi `ky`/`tu`/`den` để thử kỳ khác; workflow phải đang Active thì webhook mới nghe)
4. Muốn nút "Mở bảng tra cứu" trỏ thẳng tệp: vào Credentials → **Kết nối drive** →
   Reconnect (chìa khoá OAuth của n8n hết hạn — tài khoản Google không sao).
   Chưa nối lại thì nút trỏ về thư mục Drive, thư vẫn gửi bình thường.

### Còn lại trước khi thay v2

- PDF qua Gotenberg (thư đang đính bản in HTML).
- Bản theo khu (fan-out) nếu vẫn cần.
- Lịch thứ 5 07:00 (chép node lịch từ v2).
- Webhook nháp chưa kiểm token — thêm bước kiểm như v2 trước khi dùng lâu dài.
