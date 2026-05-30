-- ============================================================
-- 11_siet_quyen_PROD.sql  (TÙY CHỌN — CHỈ CHẠY KHI CẮT SANG PROD)
-- ------------------------------------------------------------
-- Xử lý rủi ro P0: ở giai đoạn TEST, vai trò `anon` (key công khai nhúng
-- trong web tĩnh) đang được GRANT EXECUTE các RPC GHI + SELECT mọi view +
-- đọc bảng `nguoi_dung` (email/vai trò). Nghĩa là BẤT KỲ AI có URL web đều
-- ghi/đọc được dữ liệu mà không cần đăng nhập.
--
-- File này: (1) bật bắt buộc đăng nhập (RPC sẽ lấy danh tính từ JWT, bỏ qua
-- tham số p_actor có thể giả mạo), (2) thu hồi mọi quyền của anon, (3) chỉ
-- cấp cho `authenticated`. KHÔNG đụng tới service_role (n8n vẫn chạy bình thường).
--
-- ĐIỀU KIỆN TRƯỚC KHI CHẠY:
--   • Đã bật Supabase Auth (magic link) và người dùng vận hành đã có trong
--     bảng nguoi_dung (email + vai_tro), nếu không sẽ tự khóa chính mình.
--   • Web đã build với VITE_DATA_SOURCE=live và đăng nhập hoạt động.
-- CÁCH CHẠY: dán toàn bộ vào Supabase → SQL Editor → Run (1 lần).
-- ============================================================

BEGIN;

-- 1) Bắt buộc đăng nhập: RPC sẽ ưu tiên email từ JWT (auth.email()),
--    p_actor chỉ còn tác dụng ở TEST. Đặt cờ này = true để chặn ghi ẩn danh.
UPDATE public.cau_hinh SET value = 'true'
WHERE key = 'web_yeu_cau_dang_nhap';

-- 2) Thu hồi EXECUTE của anon trên TẤT CẢ RPC web (đọc + ghi).
--    (Giữ nguyên cho authenticated; cấp lại tường minh ở bước 4 cho chắc.)
REVOKE EXECUTE ON FUNCTION public.rpc_thao_tac_su_co(BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_dung_canh_bao(BIGINT,BOOLEAN,TEXT,TEXT)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_them_phong(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,JSONB,TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_sua_phong(TEXT,JSONB,TEXT)                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_xoa_phong(TEXT,TEXT)                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_sua_gioi_han_cam_bien(TEXT,TEXT,NUMERIC,NUMERIC,TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_them_cam_bien(TEXT,TEXT,NUMERIC,NUMERIC,TEXT)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_xoa_cam_bien(TEXT,TEXT,TEXT)                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_sua_nguong_canh_bao(INT,INT,INT,TEXT)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_lay_chuoi_xu_huong(TEXT,TEXT,TEXT,INT)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_luu_phan_tich_ai(TEXT,TEXT,TEXT,TEXT,INT,TEXT,INT,TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_thong_ke_sensor_phong(TEXT)                    FROM anon;

-- 3) Thu hồi SELECT view của anon (web đọc qua phiên đăng nhập).
DO $$ DECLARE v TEXT; BEGIN
  FOR v IN SELECT table_name FROM information_schema.views
           WHERE table_schema='public' AND table_name LIKE 'xem_%'
  LOOP EXECUTE format('REVOKE SELECT ON public.%I FROM anon', v); END LOOP;
END $$;

-- 4) Cấp lại cho authenticated (đảm bảo đủ quyền sau khi siết).
DO $$ DECLARE v TEXT; BEGIN
  FOR v IN SELECT table_name FROM information_schema.views
           WHERE table_schema='public' AND table_name LIKE 'xem_%'
  LOOP EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v); END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.rpc_thao_tac_su_co(BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dung_canh_bao(BIGINT,BOOLEAN,TEXT,TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_them_phong(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,JSONB,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sua_phong(TEXT,JSONB,TEXT)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_xoa_phong(TEXT,TEXT)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sua_gioi_han_cam_bien(TEXT,TEXT,NUMERIC,NUMERIC,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_them_cam_bien(TEXT,TEXT,NUMERIC,NUMERIC,TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_xoa_cam_bien(TEXT,TEXT,TEXT)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sua_nguong_canh_bao(INT,INT,INT,TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lay_chuoi_xu_huong(TEXT,TEXT,TEXT,INT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_luu_phan_tich_ai(TEXT,TEXT,TEXT,TEXT,INT,TEXT,INT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_thong_ke_sensor_phong(TEXT)                    TO authenticated;

-- 5) Siết PII: chỉ authenticated đọc bảng nguoi_dung (bỏ anon).
DROP POLICY IF EXISTS p_nguoi_dung_read ON public.nguoi_dung;
CREATE POLICY p_nguoi_dung_read ON public.nguoi_dung
  FOR SELECT TO authenticated USING (kich_hoat);

-- (Tùy chọn) Siết master data về chỉ authenticated nếu không muốn lộ sơ đồ phòng:
-- DROP POLICY IF EXISTS p_phong_sach_read ON public.phong_sach;
-- CREATE POLICY p_phong_sach_read ON public.phong_sach FOR SELECT TO authenticated USING (kich_hoat);
-- (làm tương tự cho cam_bien, quy_tac_chuyen_trang_thai, quy_trinh_sop nếu cần)

COMMIT;

-- KIỂM TRA NHANH SAU KHI CHẠY (nên trả 0 dòng cho anon):
-- SELECT grantee, privilege_type, table_name
--   FROM information_schema.role_table_grants
--  WHERE grantee='anon' AND table_schema='public' AND table_name LIKE 'xem_%';
