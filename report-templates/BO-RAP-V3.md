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
- Số giờ vượt giới hạn hành động gọi là "giờ ngoài giới hạn" (không "giờ nghiêm trọng");
  chữ "nghiêm trọng" chỉ còn dùng cho mức của phiếu sự cố.
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

Chuỗi (19 node, cập nhật 04/09/2026):

```
Webhook wf5v3-chay-nhap → Đọc token webhook → Kiểm token webhook → Token hợp lệ?
Lịch thứ 5 07:00 (ĐANG TẮT)                                            ┘
  → Xác định kỳ → Fan-out theo khu → Gắn khu vào kỳ → Supabase (chỉ SELECT)
  → Nhận định máy (JSON 5 trường) → Ráp báo cáo v3 → Tạo PDF (Gotenberg)
      ├→ Dựng file báo cáo → Tải báo cáo lên Drive        (PDF nếu có, không thì HTML)
      └→ Dựng file dashboard → Tải dashboard lên Drive
            → Chèn liên kết vào thư → Có người nhận email? → Gửi email báo cáo
```

Những phần chép nguyên từ WF5 v2 (cùng credential, cùng bảng):

- **Kiểm token webhook**: so `body._token` với `cau_hinh.webhook_token_web`; token rỗng
  trong DB = không kiểm. Khác v2 một điều: chạy thử từ trong n8n (`$execution.mode === 'test'`)
  không cần token, vì chỉ chủ n8n bấm được.
- **Lịch thứ 5 07:00** (`0 0 7 * * 4`): node có sẵn nhưng **TẮT**. Bật lên là chạy song
  song với v2 — chỉ bật khi đã tắt lịch của v2.
- **Fan-out theo khu + Gắn khu vào kỳ**: bản TỔNG gửi người có ≥ 2 khu trong
  `nguoi_nhan_bao_cao`; mỗi khu C1/C4/Q2 có người nhận riêng thì thêm một bản khu.
  Bản TỔNG không có ai thì rơi về `cau_hinh.email_bao_cao_thang/tuan`; bản khu không có
  ai thì bỏ qua.

Phần mới so với cả v2:

- **Tạo PDF (Gotenberg)**: gọi `cau_hinh.gotenberg_url` (tự thêm `/forms/chromium/convert/html`
  nếu thiếu), A4, lề 0,4 inch, in nền. Không có dịch vụ hoặc lỗi → `co_pdf=false`, thư đính
  bản in HTML như trước, lý do ghi ở trường `loi_pdf` của item. Thư được ráp trước khi biết
  có PDF hay không nên node này đổi nhãn "Bản in (HTML)" → "Bản in (PDF)" khi có PDF.
- Email chỉ đính **bản in**; bảng tra cứu nằm trên Drive, thư có nút trỏ tới `webViewLink`.

### Cách tự kiểm thư (test mail)

1. Mở workflow → bật node **Gửi email báo cáo** (bỏ Disable).
2. (Khuyên) sửa tạm `toEmail` thành địa chỉ của mình để duyệt trước.
3. Gọi webhook:
   ```
   curl -X POST https://n8n.cpc1hn.com/webhook/wf5v3-chay-nhap \
     -H 'Content-Type: application/json' \
     -d '{"ky":"THANG","tu":"2026-08-01","den":"2026-08-31","_token":"<webhook_token_web>"}'
   ```
   (đổi `ky`/`tu`/`den` để thử kỳ khác; workflow phải đang Active thì webhook mới nghe;
   bỏ `_token` được nếu `cau_hinh.webhook_token_web` rỗng, hoặc bấm chạy thử trong n8n)
4. Muốn nút "Mở bảng tra cứu" trỏ thẳng tệp: vào Credentials → **Kết nối drive** →
   Reconnect (chìa khoá OAuth của n8n hết hạn — tài khoản Google không sao).
   Chưa nối lại thì nút trỏ về thư mục Drive, thư vẫn gửi bình thường.

### Còn lại trước khi thay v2

- Xem PDF thật do Gotenberg sinh (ngắt trang, dấu tiếng Việt); nếu dịch vụ Gotenberg chưa
  chạy cạnh n8n thì dựng theo `services/README.md` hoặc chấp nhận đính HTML.
- Ghi `nhat_ky_chay_workflow` như v2 (v3 chưa ghi nhật ký lần chạy).
- Khi thay: tắt lịch v2, bật lịch v3, đổi `cau_hinh.wf5_webhook_bao_cao_bu` sang
  `.../webhook/wf5v3-chay-nhap`, trả `toEmail` về `{{ $json.email_to }}`.
