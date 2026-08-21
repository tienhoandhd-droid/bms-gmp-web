# WF5 Placeholder Audit

Ngày rà soát: 2026-08-21

## Phạm vi

Đối chiếu ba template được node WF5 "Ráp báo cáo" tải từ GitHub raw:

- `report-templates/email-bao-cao.html`
- `report-templates/bao-cao-scorecard.html`
- `report-templates/dashboard-tuong-tac.html`

Node hiện bơm dữ liệu qua object `rep` và các vòng `each` sau:

- `top_phong_xau`
- `top_phong_tot`
- `xu_huong_khu`
- `xu_huong_ahu`
- `phong_xau_bat_thuong`
- `ngoai_le_theo_loai`
- `su_co_tieu_bieu`
- `spc_chi_tiet`
- `mkt_chi_tiet`
- `gioi_han_tham_chieu`
- `bat_thuong_tom_tat` trong email

## Trước khi sửa

Email tuần đang dùng nhiều placeholder chưa có trong `rep`, gồm các nhóm:

- Trạng thái kỳ: `trang_thai_ky`, `trang_thai_mau`, `trang_thai_nen`, `ly_do_html`
- Cảnh báo nghiêm trọng: `kpi_gio_critical`, `kpi_gio_warning`, `delta_critical`, `ty_le_critical`
- Sự cố tồn cuối kỳ: `su_co_ton_dau`, `su_co_ton_cuoi`, `su_co_phat_sinh`, `su_co_da_dong`, `so_su_co_dang_mo`
- Độ tin cậy dữ liệu: `kpi_do_phu`, `tin_cay_ket_luan`, `du_lieu_anh_huong`, `so_dot_chua_hoi_phuc`
- Nhận định/duyệt nội dung: `khoi_nhan_dinh_html`, `truy_vet_ai`, `trang_thai_tham_dinh_vi`
- Vòng lặp `trong_tam_xu_ly`, chưa được node hiện tại nhân bản.

Scorecard chi tiết còn rộng hơn node hiện có, gồm nhiều phần chưa có dữ liệu trực tiếp:

- Hàng đợi ưu tiên xử lý
- Sổ sự kiện vượt ngưỡng cấp cảm biến
- Đợt biến động SPC đã gộp sự kiện
- Ngoại lệ dữ liệu chi tiết
- OOS/CAPA
- Chữ ký điện tử, QR, SHA-256, nơi nhận
- Heatmap HTML và dự báo xu hướng do node tự bơm

Dashboard tương tác chỉ dùng `{{DATA_JSON}}`, khớp với node hiện tại.

## Sau khi sửa

Email tuần được rút gọn thành bản hành động:

- Tóm tắt cần đọc trước
- Kết luận kiểm soát
- 4 chỉ số chính: thời gian trong ngưỡng, giờ cảnh báo, sự cố, độ phủ dữ liệu
- Phòng cần xử lý trước
- Phòng xấu hơn kỳ trước
- Link báo cáo, thư mục lưu trữ và truy vết GMP ngắn

Scorecard chi tiết được rút lại đúng dữ liệu WF5 hiện có:

- Tóm tắt quản trị
- Chỉ số chính
- Biểu đồ xu hướng
- Khu vực/AHU
- Top phòng cần xử lý và phòng ổn định
- Phòng xấu hơn kỳ trước
- Sự cố tiêu biểu
- SPC, ngoại lệ dữ liệu, MKT
- Giới hạn tham chiếu
- Nhận định hỗ trợ
- Footer truy vết GMP

Kết quả mong muốn: template không còn gọi các placeholder chưa được node WF5 bơm, nên email/PDF của lần chạy sau không còn nguy cơ hiện nguyên văn `{{...}}`.
