-- ============================================================
-- 09_rls_va_grant.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 9/11
--
-- MỤC ĐÍCH: bật Row Level Security (RLS) và phân quyền.
--
-- 3 vai trò Postgres của Supabase:
--   • anon          — chưa đăng nhập (web dùng key public)
--   • authenticated — đã đăng nhập qua Supabase Auth (có JWT)
--   • service_role  — n8n (bypass RLS hoàn toàn)
--
-- NGUYÊN TẮC:
--   • Web đọc dữ liệu qua VIEW xem_* → grant SELECT view cho anon
--     (vì giai đoạn demo chưa bật Auth; PROD sẽ siết lại)
--   • Web ghi qua RPC rpc_* → grant EXECUTE cho authenticated (+ anon ở TEST)
--   • Bảng thô: KHÔNG cho anon/authenticated đọc trực tiếp
--   • RPC ingest (WF1) chỉ service_role
-- ============================================================

-- ============================================================
-- 1. BẬT RLS trên tất cả bảng
-- ============================================================
DO $$
DECLARE 
  t TEXT;
  cac_bang TEXT[] := ARRAY[
    'cau_hinh','nguoi_dung','phong_sach','cam_bien',
    'du_lieu_gio','su_co','lich_su_su_co','nhat_ky_chay_workflow','ngoai_le_du_lieu',
    'kpi_gio','kpi_ngay_phong','kpi_ngay_scope','dac_trung_xu_huong','so_sanh_baseline',
    'ma_token_email','email_da_gui','bao_cao_ai',
    'quy_tac_chuyen_trang_thai','lich_su_cau_hinh','cua_so_tat_canh_bao','nhat_ky_loi_workflow','quy_trinh_sop'
  ];
BEGIN
  FOREACH t IN ARRAY cac_bang LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- Xóa policy cũ nếu chạy lại
    EXECUTE format('DROP POLICY IF EXISTS p_%s_service ON public.%I', t, t);
    -- service_role: full access (n8n)
    EXECUTE format($f$
      CREATE POLICY p_%1$s_service ON public.%1$I 
      FOR ALL TO service_role USING (true) WITH CHECK (true)
    $f$, t, t);
  END LOOP;
END $$;

-- ============================================================
-- 2. POLICY đọc cho authenticated (dữ liệu non-test)
-- ============================================================
-- authenticated đọc được các bảng vận hành non-test.
-- Dùng cho trường hợp web cần đọc bảng thô (hiếm — chủ yếu qua view).
-- ============================================================
DO $$
DECLARE 
  t TEXT;
  bang_co_co_test TEXT[] := ARRAY[
    'du_lieu_gio','su_co','lich_su_su_co','nhat_ky_chay_workflow','ngoai_le_du_lieu',
    'kpi_gio','kpi_ngay_phong','kpi_ngay_scope','email_da_gui','bao_cao_ai'
  ];
BEGIN
  FOREACH t IN ARRAY bang_co_co_test LOOP
    EXECUTE format('DROP POLICY IF EXISTS p_%s_auth_read ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY p_%1$s_auth_read ON public.%1$I
      FOR SELECT TO authenticated
      USING (NOT thuoc_thu_nghiem OR public.cfg_bool('bat_canh_bao_thu_nghiem', false))
    $f$, t, t);
  END LOOP;
END $$;

-- Master data: authenticated đọc được hết (không nhạy cảm)
DROP POLICY IF EXISTS p_phong_sach_read ON public.phong_sach;
CREATE POLICY p_phong_sach_read ON public.phong_sach FOR SELECT TO authenticated, anon USING (kich_hoat);

DROP POLICY IF EXISTS p_cam_bien_read ON public.cam_bien;
CREATE POLICY p_cam_bien_read ON public.cam_bien FOR SELECT TO authenticated, anon USING (kich_hoat);

DROP POLICY IF EXISTS p_quy_tac_read ON public.quy_tac_chuyen_trang_thai;
CREATE POLICY p_quy_tac_read ON public.quy_tac_chuyen_trang_thai FOR SELECT TO authenticated, anon USING (kich_hoat);

DROP POLICY IF EXISTS p_sop_read ON public.quy_trinh_sop;
CREATE POLICY p_sop_read ON public.quy_trinh_sop FOR SELECT TO authenticated, anon USING (kich_hoat);

-- nguoi_dung: cho anon đọc danh sách active (web dropdown demo) — PROD siết
DROP POLICY IF EXISTS p_nguoi_dung_read ON public.nguoi_dung;
CREATE POLICY p_nguoi_dung_read ON public.nguoi_dung FOR SELECT TO authenticated, anon USING (kich_hoat);

-- cau_hinh: KHÔNG cho đọc trực tiếp (chứa secret) — chỉ qua view masked
-- (không tạo policy SELECT cho anon/authenticated → chặn đọc bảng thô)

-- ============================================================
-- 3. GRANT trên VIEW dashboard (web đọc)
-- ============================================================
-- Giai đoạn TEST: anon đọc view được (chưa bật Auth).
-- PROD: đổi sang chỉ authenticated (xem file pha 5).
-- ============================================================
DO $$
DECLARE v TEXT;
BEGIN
  FOR v IN SELECT table_name FROM information_schema.views 
           WHERE table_schema='public' AND table_name LIKE 'xem_%'
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', v);
  END LOOP;
END $$;

-- ============================================================
-- 4. GRANT EXECUTE cho RPC
-- ============================================================
-- RPC ĐỌC + GHI (web): cho anon + authenticated (TEST). 
--   Bản thân RPC tự kiểm quyền qua lay_email_nguoi_goi + nguoi_dung.vai_tro.
-- RPC INGEST/KPI (n8n): chỉ service_role.
-- ============================================================

-- RPC web (đọc + ghi thao tác)
GRANT EXECUTE ON FUNCTION public.rpc_thao_tac_su_co(BIGINT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_dung_canh_bao(BIGINT,BOOLEAN,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_them_phong(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,JSONB,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sua_phong(TEXT,JSONB,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_xoa_phong(TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sua_gioi_han_cam_bien(TEXT,TEXT,NUMERIC,NUMERIC,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_them_cam_bien(TEXT,TEXT,NUMERIC,NUMERIC,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_xoa_cam_bien(TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_sua_nguong_canh_bao(INT,INT,INT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lay_chuoi_xu_huong(TEXT,TEXT,TEXT,INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_luu_phan_tich_ai(TEXT,TEXT,TEXT,TEXT,INT,TEXT,INT,TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_thong_ke_sensor_phong(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_kiem_tra_he_thong() TO anon, authenticated;

-- RPC ingest + KPI (n8n service_role ONLY)
REVOKE ALL ON FUNCTION public.rpc_xu_ly_du_lieu_phong_hang_gio(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_xu_ly_du_lieu_phong_hang_gio(JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_xu_ly_du_lieu_nhieu_phong(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_xu_ly_du_lieu_nhieu_phong(JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_tinh_kpi_gio(TIMESTAMPTZ,BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_tinh_kpi_gio(TIMESTAMPTZ,BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_tinh_kpi_ngay(DATE,BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_tinh_kpi_ngay(DATE,BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_lay_du_lieu_bao_cao_ai(TEXT,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_lay_du_lieu_bao_cao_ai(TEXT,TIMESTAMPTZ) TO service_role;

-- Helper đọc cấu hình: KHÔNG cho anon/authenticated gọi trực tiếp.
-- Quan trọng: Supabase mặc định auto-GRANT routine cho anon → phải REVOKE tường minh.
-- Các view/RPC (SECURITY DEFINER) vẫn dùng được vì chạy bằng quyền owner.
REVOKE ALL ON FUNCTION public.cfg_text(TEXT,TEXT)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cfg_bool(TEXT,BOOLEAN)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cfg_int(TEXT,INT)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cfg_numeric(TEXT,NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cfg_text(TEXT,TEXT)       TO service_role;
GRANT EXECUTE ON FUNCTION public.cfg_bool(TEXT,BOOLEAN)    TO service_role;
GRANT EXECUTE ON FUNCTION public.cfg_int(TEXT,INT)         TO service_role;
GRANT EXECUTE ON FUNCTION public.cfg_numeric(TEXT,NUMERIC) TO service_role;
-- co_thu_nghiem chỉ trả cờ TEST/PROD (không nhạy cảm) — giữ cho view phòng khi security_invoker
GRANT EXECUTE ON FUNCTION public.co_thu_nghiem() TO anon, authenticated, service_role;
-- cfg_secret: CHỈ service_role (n8n) — anon/authenticated tuyệt đối không
REVOKE ALL ON FUNCTION public.cfg_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cfg_secret(TEXT) TO service_role;

-- ============================================================
-- 5. CẢI TIẾN: pg_cron tự dọn dữ liệu hết hạn (tùy chọn)
-- ============================================================
-- Supabase hỗ trợ pg_cron. Nếu bật, sẽ tự xóa du_lieu_gio cũ
-- theo retention trong cau_hinh. KHÔNG bắt buộc — n8n cũng làm được.
-- ============================================================
CREATE OR REPLACE FUNCTION public.don_du_lieu_het_han()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_xoa_gio INT := 0;
  v_xoa_email INT := 0;
BEGIN
  PERFORM set_config('app.tg_bypass_append_only', 'on', true);
  
  -- Xóa du_lieu_gio quá hạn (chỉ test data; PROD giữ theo retention)
  DELETE FROM public.du_lieu_gio 
  WHERE bucket_utc < now() - (public.cfg_int('giu_du_lieu_gio_ngay', 90) || ' days')::interval;
  GET DIAGNOSTICS v_xoa_gio = ROW_COUNT;

  -- Xóa token email hết hạn đã dùng
  DELETE FROM public.ma_token_email 
  WHERE het_han_luc < now() - interval '7 days';

  -- Xóa email log quá hạn
  DELETE FROM public.email_da_gui 
  WHERE tao_luc < now() - (public.cfg_int('giu_email_da_gui_ngay', 365) || ' days')::interval;
  GET DIAGNOSTICS v_xoa_email = ROW_COUNT;

  PERFORM set_config('app.tg_bypass_append_only', 'off', true);
  RETURN jsonb_build_object('ok', true, 'xoa_du_lieu_gio', v_xoa_gio, 'xoa_email', v_xoa_email);
END $$;

REVOKE ALL ON FUNCTION public.don_du_lieu_het_han() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.don_du_lieu_het_han() TO service_role;

-- Để bật pg_cron tự động (chạy 3h sáng mỗi ngày), bỏ comment 2 dòng dưới
-- sau khi đã bật extension pg_cron trong Supabase Dashboard → Database → Extensions:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('don_du_lieu_bms', '0 3 * * *', $$SELECT public.don_du_lieu_het_han()$$);

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 09 OK' AS ket_qua,
  (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND rowsecurity) AS bang_co_rls,
  (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS so_policy;
