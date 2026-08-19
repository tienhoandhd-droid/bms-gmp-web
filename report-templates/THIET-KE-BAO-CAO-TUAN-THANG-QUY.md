# Thiết kế báo cáo tuần, tháng và quý BMS

## 1. Mục tiêu

Bộ báo cáo phải giúp người đọc trả lời nhanh 5 câu hỏi theo đúng thứ tự:

1. Hệ thống đang ở trạng thái nào?
2. Điều gì thay đổi so với kỳ trước?
3. Khu vực, phòng hoặc thiết bị nào cần chú ý?
4. Việc gì cần làm, mức ưu tiên ra sao và khi nào cần hoàn tất?
5. Số liệu và kết luận có thể truy vết về đâu?

Nguyên tắc trình bày:

- Tiếng Việt là ngôn ngữ chính; thuật ngữ tiếng Anh chỉ đặt sau phần giải thích tiếng Việt.
- Mọi chữ viết tắt phải được giải nghĩa ở lần xuất hiện đầu tiên và có trong bảng chú giải.
- Không coi thiếu dữ liệu là giá trị bằng 0; khoảng thiếu phải được hiển thị và loại khỏi kết luận.
- Màu chỉ hỗ trợ nhận biết. Trạng thái luôn phải có chữ, số hoặc biểu tượng đi kèm.
- Nhận định do trí tuệ nhân tạo chỉ hỗ trợ đọc số liệu; kết luận và phê duyệt thuộc người có thẩm quyền.
- Một nguồn số liệu duy nhất cho email, bảng phân tích tương tác (dashboard) và bản lưu trữ để tránh chênh lệch số.

## 2. Mô hình nội dung theo từng kỳ

| Kỳ | Người đọc chính | Câu hỏi quản trị | Nội dung ưu tiên | Hành động mong đợi |
|---|---|---|---|---|
| Tuần | Vận hành, Cơ điện, Kiểm soát trong quá trình | Tuần này có cảnh báo mới, sự cố đang mở hoặc phòng nào xấu đi nhanh? | Cảnh báo mới; sự cố mở; phòng giảm mạnh; khoảng thiếu dữ liệu; tín hiệu xu hướng sớm | Xử lý ngay, phân công người phụ trách, chốt việc trong tuần tiếp theo |
| Tháng | Quản lý vận hành, Kỹ thuật, Đảm bảo chất lượng | Vấn đề nào lặp lại và hành động tháng trước có hiệu quả không? | So với tháng trước; xu hướng theo khu/tổ hợp xử lý không khí; sự cố lặp lại; chất lượng dữ liệu; tiến độ hành động khắc phục và phòng ngừa | Chốt nguyên nhân, điều chỉnh bảo trì/vận hành, theo dõi hiệu lực hành động |
| Quý | Ban quản lý, Đảm bảo chất lượng, chủ hệ thống | Trạng thái kiểm soát có bền vững và cần quyết định nguồn lực nào? | Xu hướng 3 tháng; rủi ro lặp lại; hiệu lực hành động; độ tin cậy dữ liệu; tình trạng kiểm soát và khoảng trống hệ thống | Phê duyệt ưu tiên, nguồn lực, cải tiến hệ thống và kế hoạch quý sau |

Ba kỳ dùng cùng một hợp đồng dữ liệu, nhưng phần “Trọng tâm của kỳ” phải thay đổi theo loại kỳ. Bản tuần không nên bị kéo dài bởi nội dung quản trị quý; bản quý không được chỉ là bản tuần có nhiều dòng hơn.

## 3. Kiến trúc thông tin dùng chung

### Lớp 1 — Đọc trong 30 giây

- Tên kỳ, phạm vi, thời gian tạo và mã truy vết.
- Trạng thái chung bằng chữ: `Ổn định`, `Cần theo dõi` hoặc `Cần hành động`.
- Sáu chỉ số chính: tuân thủ, giờ cảnh báo, sự cố, tín hiệu kiểm soát thống kê, độ đầy đủ dữ liệu và nhiệt độ động học trung bình.
- Khối “Ưu tiên xử lý” nêu rõ số sự cố đang mở, số phòng xấu đi, tín hiệu xu hướng và vấn đề dữ liệu.

### Lớp 2 — Hiểu nguyên nhân

- Diễn biến theo ngày và so với kỳ trước.
- Xếp hạng khu vực, tổ hợp xử lý không khí và phòng.
- Sự kiện cận/vượt giới hạn; nguyên nhân; tác động; hành động khắc phục và phòng ngừa.
- Ngoại lệ dữ liệu và độ tin cậy của kết luận.

### Lớp 3 — Kiểm soát GMP và truy vết

- Giới hạn áp dụng theo phòng.
- Tình trạng soát xét/phê duyệt.
- Mã lần chạy, nguồn dữ liệu, tên tệp và mã băm kiểm tra.
- Chú giải thuật ngữ và từ viết tắt.

## 4. Từ điển thuật ngữ tiếng Việt

| Viết tắt | Cách hiển thị thân thiện |
|---|---|
| BMS | Hệ thống quản lý tòa nhà (BMS — Building Management System) |
| FMS | Hệ thống giám sát cơ sở (FMS — Facility Monitoring System), nguồn cấp dữ liệu giám sát cho BMS |
| GMP | Thực hành tốt sản xuất (GMP — Good Manufacturing Practice) |
| AHU | Tổ hợp xử lý không khí (AHU — Air Handling Unit) |
| T | Nhiệt độ (T) |
| RH | Độ ẩm tương đối (RH — Relative Humidity) |
| ΔP | Chênh áp (ΔP — Differential Pressure) |
| DQ | Độ đầy đủ/chất lượng dữ liệu (DQ — Data Quality) |
| MTTR | Thời gian xử lý trung bình (MTTR — Mean Time To Repair) |
| SPC | Kiểm soát quá trình bằng thống kê (SPC — Statistical Process Control) |
| MKT | Nhiệt độ động học trung bình (MKT — Mean Kinetic Temperature) |
| OOS | Ngoài giới hạn quy định (OOS — Out Of Specification) |
| OOT | Ngoài xu hướng dự kiến (OOT — Out Of Trend) |
| CAPA | Hành động khắc phục và phòng ngừa (CAPA — Corrective and Preventive Action) |
| IPC | Kiểm soát trong quá trình (IPC — In-Process Control) |
| QA | Đảm bảo chất lượng (QA — Quality Assurance) |
| GHD / GHT | Giới hạn dưới / giới hạn trên |
| ALCOA+ | Bộ nguyên tắc toàn vẹn dữ liệu: có thể quy trách nhiệm, dễ đọc, ghi nhận đồng thời, nguyên bản, chính xác và các thuộc tính mở rộng |
| AI | Trí tuệ nhân tạo (AI — Artificial Intelligence) |
| WF5 | Mã quy trình tự động tổng hợp và phát hành báo cáo |

Không dùng các từ `scope`, `baseline`, `excursion`, `critical`, `warning` hoặc `writer–judge` làm nhãn chính. Dùng lần lượt `phạm vi`, `mức nền tham chiếu`, `sự kiện cận/vượt giới hạn`, `nghiêm trọng`, `cảnh báo` và `đã qua bước kiểm tra chéo`.

## 5. Căn cứ thiết kế GMP

Thiết kế ưu tiên xu hướng, sự kiện lặp lại, điều tra nguyên nhân, tác động và hành động khắc phục/phòng ngừa vì EU GMP Annex 1 yêu cầu chương trình giám sát phải có cách đánh giá xu hướng; xem xét các lần vượt mức cảnh báo/hành động liên tiếp hoặc lặp lại; và khi vượt giới hạn hành động phải điều tra nguyên nhân, đánh giá tác động và xác định hành động phù hợp.

Nguồn tham khảo chính thức:

- European Commission, EudraLex Volume 4, Annex 1 — Manufacture of Sterile Medicinal Products, mục 2.5, 3.1, 9.9–9.13.
- European Commission, EudraLex Volume 4, Chapter 4 — Documentation.

## 6. Hợp đồng dữ liệu và phạm vi triển khai

Phiên bản thiết kế này là `drop-in`: không thêm khóa placeholder mới vào object `rep` của quy trình WF5; các mẫu chỉ tái sử dụng token và mảng lặp node đang cấp, nên không yêu cầu sửa dữ liệu hoặc tác động n8n để hiển thị được các phần chính.

Các dữ liệu chưa có không được tự suy diễn. Để nâng bản tháng/quý lên đầy đủ hơn trong giai đoạn sau, nguồn dữ liệu cần bổ sung có kiểm soát:

- người phụ trách và hạn xử lý của từng hành động;
- lịch sử hiệu lực hành động khắc phục/phòng ngừa;
- tình trạng hiệu chuẩn, bảo trì và tái thẩm định;
- liên kết sự kiện với lô/sản phẩm khi áp dụng;
- so sánh cùng kỳ năm trước và xu hướng 12 tháng cho bản quý.

Cho đến khi các trường này có nguồn tin cậy, báo cáo phải ghi `Chưa có dữ liệu` thay vì để trống hoặc tạo nội dung giả định.

## 7. Điều kiện trước khi áp dụng live

- Xác minh đúng workflow đang hoạt động và tên workflow phải bắt đầu bằng `BMS`.
- Xác nhận đầu ra live hiện có: email, HTML tương tác và/hoặc PDF; không suy ra chỉ từ file mẫu trong repo.
- Chốt một thang màu tuân thủ duy nhất cho web, dashboard, email, biểu đồ và scorecard. Hiện nguồn web dùng nhiều bậc hơn phần ráp báo cáo cũ; đây là việc cần đồng bộ ở lớp sinh dữ liệu/màu trước nghiệm thu production.
- Chạy thử riêng một kỳ tuần, một kỳ tháng và một kỳ quý trên dữ liệu lịch sử; đối chiếu từng số với JSON của hàm tổng hợp.
- Chỉ cập nhật/chạy/publish workflow n8n hoặc push Git sau bước xác nhận an toàn riêng, vì workflow có thể tải mẫu trực tiếp từ nhánh `main`.
