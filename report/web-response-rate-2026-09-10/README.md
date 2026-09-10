# Báo cáo phản hồi trên web — bản sẵn sàng kiểm tra

Yêu cầu: báo cáo riêng trên web theo cùng cách tính báo cáo mail, loại lần gửi ngoài giờ, đẹp và có bảng so sánh tuần trước. Mặc định kỳ T5–T4 vừa kết thúc; chuyển lùi/tiến từng tuần đã kết thúc. Mỗi ô có tỷ lệ và tử/mẫu, delta theo điểm phần trăm, không xếp hạng hay tự áp ngưỡng đánh giá. Không có mẫu là null, không phải 0%.

## Files

- `web/src/features/reports/ResponseRateReport.jsx`, `responseRateModel.js`: cards, thanh 0–100%, bảng hai tuần kèm ngày cụ thể, chi tiết, trạng thái và định dạng.
- `ResponseRateSection.jsx`: RPC load, abort/stale response guard, không giữ dữ liệu khi đổi kỳ.
- `ReportsPage.jsx`/`web/src/app/AppShell.jsx`: mount, truyền live và key email/role/khu để xóa dữ liệu khi đổi phạm vi/phiên.
- `web/src/features/incidents/IncidentsParts.jsx`: prop hideResponse chỉ tại báo cáo, bỏ các tỷ lệ/so sánh cũ dựa thời gian phiếu còn mở, giữ phần môi trường.
- `supabase/migrations/20260910_response_rate_report.sql`: RPC read-only cho QA/ADMIN/IT active từ JWT, lọc khu được cấp, deny empty khu, không xuất email/token/HTML. Trả 2 tuần cùng logic ledger v18/v16/legacy đã xác minh. Thiếu log legacy không suy thành đã gửi.

## Verification

- `node --test web/test/response-rate-model.test.mjs`: 4/4; calendar VN, navigation, null/no sample, delta.
- `node --test report/web-response-rate-2026-09-10/rpc.test.mjs`: PostgreSQL offline 7/7; auth/scope/date, exclude ngoài giờ, dedup multi-ledger/resend, legacy token verification và secret non-disclosure.
- `node report/web-response-rate-2026-09-10/browser.test.mjs`: desktop/mobile/print, next/previous từ kỳ rỗng, error/loading không để bảng cũ, không tràn cả trang. Cần Vite trên 127.0.0.1:5178. Fixture HTML tạm tự xóa; số liệu synthetic chỉ dùng kiểm giao diện, không bundle data thật.
- `npm run lint`: 0 errors, 7 warnings có sẵn ở các file khác.
- `npm run build`: PASS. Local không có VITE_SUPABASE_URL/ANON_KEY nên artifact build này chỉ kiểm tra, không dùng để deploy production.
- `npm run check:colors`, `check:copy`, `check:contrast`: PASS.
- Reviewer Sol: auth/scope/cách tính không blocker; cần kiểm query plan với dữ liệu production trước apply.
- Review giao diện cuối: đã sửa cảnh báo legacy có điều kiện theo hai kỳ, không khẳng định thiếu dữ liệu khi chưa có bằng chứng; browser test false/true đều đạt. Reviewer Sol xác nhận không còn finding. Bộ kiểm import JSX đạt.

## Chưa triển khai production

Chưa apply migration, chưa push Git, chưa deploy. AGENTS yêu cầu ủy quyền rõ cho thao tác remote/deploy. Sau khi được phép: kiểm EXPLAIN (ANALYZE, BUFFERS) pipeline read-only trên kỳ thật, đo chi phí legacy regex và thêm index chỉ khi cần; apply RPC; kiểm quyền anon/authorized account; build bằng cấu hình Supabase production có sẵn và deploy đúng phần thay đổi đã review, không gom dirty edits của task khác. Kiểm web thật so với báo cáo mail và tuần trước. Rollback tháo mount/khôi phục file task diff và DROP FUNCTION rpc_bao_cao_phan_hoi_mail(date,date); không xóa ledger.

Ảnh xem trước trong output/web-response-rate-2026-09-10/desktop.png và mobile.png dùng dữ liệu minh họa để kiểm giao diện, không phải kết quả thực của nhà máy.
