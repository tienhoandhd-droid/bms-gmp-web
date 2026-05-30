# BMS GMP v10 — Pha 1 (Supabase): Thứ tự chạy SQL

Tài liệu này mô tả **thứ tự bắt buộc** để chạy các file SQL trong thư mục này.
Chạy đúng thứ tự `01 → 02 → … → 10`, cuối cùng `99` để kiểm tra.

## Bảng tổng quan các file

| Thứ tự | File | Nội dung | Bắt buộc? |
|--------|------|----------|-----------|
| — | `00_reset.sql` | Xóa sạch để làm lại (chỉ TEST) | Không — chỉ khi cần reset |
| 1 | `01_cau_hinh_va_master.sql` | Cấu hình + bảng master (phòng, cảm biến, người dùng) + helper | ✅ Bắt buộc |
| 2 | `02_bang_van_hanh.sql` | Bảng vận hành (telemetry, sự cố, audit) + trigger ALCOA+ | ✅ Bắt buộc |
| 3 | `03_bang_kpi.sql` | Bảng KPI tổng hợp (giờ/ngày/xu hướng/baseline) | ✅ Bắt buộc |
| 4 | `04_email_va_token.sql` | Email outbox + token nút email + báo cáo AI | ✅ Bắt buộc |
| 5 | `05_quy_tac_va_lich_su.sql` | State machine + audit cấu hình + SOP | ✅ Bắt buộc |
| 6 | `06_view_dashboard.sql` | 14 view `xem_*` cho web đọc | ✅ Bắt buộc |
| 7 | `07_rpc_thao_tac.sql` | RPC ghi (chuyển trạng thái, quản lý phòng/cảm biến) | ✅ Bắt buộc |
| 8 | `08_rpc_doc_du_lieu.sql` | RPC đọc + ingest (WF1) + tính KPI + payload AI | ✅ Bắt buộc |
| 9 | `09_rls_va_grant.sql` | Bật RLS + phân quyền anon/authenticated/service_role | ✅ Bắt buộc |
| 10 | `10_seed_demo.sql` | Dữ liệu DEMO (6 phòng, 5 user, sự cố mẫu) | ⚠️ Chỉ TEST — **bỏ qua khi PROD** |
| 99 | `99_kiem_tra.sql` | Smoke test — mọi dòng phải PASS | ✅ Nên chạy |

## Vì sao thứ tự này quan trọng

- **01 trước tiên**: tạo `cau_hinh` (mọi file sau đọc cấu hình từ đây) và các bảng master mà bảng vận hành tham chiếu (khóa ngoại).
- **02–05 tạo bảng** trước khi **06 tạo view** (view `SELECT` từ bảng).
- **06 (view) trước 07–08 (RPC)** vì một số RPC đọc lại view (`rpc_thong_ke_sensor_phong` đọc `xem_thong_ke_sensor_8h`).
- **09 (RLS/grant) sau khi mọi bảng + RPC đã tồn tại** — không thể grant quyền cho thứ chưa tạo.
- **10 (seed) gần cuối** — cần đủ bảng + RPC (`rpc_tinh_kpi_gio`) để nạp dữ liệu mẫu.
- **99 cuối cùng** — kiểm tra toàn bộ.

## Chạy lại an toàn (idempotent)

Mọi file dùng `CREATE OR REPLACE` / `IF NOT EXISTS` / `ON CONFLICT`, nên **chạy lại nhiều lần không lỗi**. File `01` tự DROP các bảng cũ trước khi tạo (chỉ khi `moi_truong ≠ PROD`).

## TEST → PROD

Khi chuyển sang môi trường thật (xem hướng dẫn ở `INSTALL_PHA1.md`, mục Pha 5):

1. **KHÔNG chạy `10_seed_demo.sql`** trên PROD.
2. Đổi `cau_hinh.moi_truong = 'PROD'` và `che_do_thu_nghiem = 'false'`.
3. Dữ liệu demo (gắn cờ `thuoc_thu_nghiem=true`) **tự động ẩn** khỏi dashboard mà **không bị xóa** (giữ theo nguyên tắc ALCOA+).

## An toàn dữ liệu (GMP / ALCOA+)

- Bảng `lich_su_su_co` và `lich_su_cau_hinh` có trigger **chặn UPDATE/DELETE tuyệt đối** — audit trail không thể sửa.
- Bảng `du_lieu_gio`, `su_co` chỉ cho phép sửa qua RPC chính thống (đặt cờ bypass nội bộ), client không sửa trực tiếp được.
- Mọi khóa bí mật (`openai_api_key`, `fms_password`…) bị **che (mask)** khi hiển thị qua view.
