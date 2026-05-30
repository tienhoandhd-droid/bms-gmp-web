-- ============================================================
-- 00_reset.sql  (TÙY CHỌN — chỉ dùng khi muốn xóa sạch làm lại)
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1
--
-- MỤC ĐÍCH: xóa sạch toàn bộ schema BMS để cài lại từ đầu.
-- KHÔNG bắt buộc — file 01 đã tự DROP trước khi tạo.
-- Dùng file này khi: muốn reset hoàn toàn mà không chạy lại 01,
-- hoặc dọn dẹp trước khi gỡ bỏ.
--
-- ⚠️ AN TOÀN: file tự CHẶN nếu moi_truong=PROD.
-- ⚠️ Sau khi chạy file này, phải chạy lại 01→10 để có hệ thống.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.cau_hinh') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.cau_hinh WHERE key='moi_truong' AND upper(value)='PROD') THEN
      RAISE EXCEPTION 'AN TOÀN GMP: moi_truong=PROD. Không được reset dữ liệu sản xuất!';
    END IF;
  END IF;
END $$;

-- Xóa view trước (phụ thuộc bảng)
DO $$
DECLARE v TEXT;
BEGIN
  FOR v IN SELECT table_name FROM information_schema.views 
           WHERE table_schema='public' AND table_name LIKE 'xem_%'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', v);
  END LOOP;
END $$;

-- Xóa function rpc_* + helper
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN 
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' 
      AND (p.proname LIKE 'rpc_%' OR p.proname LIKE 'cfg_%' OR p.proname LIKE 'tg_%'
           OR p.proname IN ('mask_secret','lay_email_nguoi_goi','co_thu_nghiem','don_du_lieu_het_han'))
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig);
  END LOOP;
END $$;

-- Xóa bảng (CASCADE để bỏ FK, trigger, index)
DROP TABLE IF EXISTS public.bao_cao_ai          CASCADE;
DROP TABLE IF EXISTS public.email_da_gui        CASCADE;
DROP TABLE IF EXISTS public.ma_token_email      CASCADE;
DROP TABLE IF EXISTS public.so_sanh_baseline    CASCADE;
DROP TABLE IF EXISTS public.dac_trung_xu_huong  CASCADE;
DROP TABLE IF EXISTS public.kpi_ngay_scope      CASCADE;
DROP TABLE IF EXISTS public.kpi_ngay_phong      CASCADE;
DROP TABLE IF EXISTS public.kpi_gio             CASCADE;
DROP TABLE IF EXISTS public.nhat_ky_loi_workflow CASCADE;
DROP TABLE IF EXISTS public.nhat_ky_chay_workflow CASCADE;
DROP TABLE IF EXISTS public.ngoai_le_du_lieu    CASCADE;
DROP TABLE IF EXISTS public.lich_su_su_co       CASCADE;
DROP TABLE IF EXISTS public.su_co               CASCADE;
DROP TABLE IF EXISTS public.du_lieu_gio         CASCADE;
DROP TABLE IF EXISTS public.cua_so_tat_canh_bao CASCADE;
DROP TABLE IF EXISTS public.lich_su_cau_hinh    CASCADE;
DROP TABLE IF EXISTS public.quy_tac_chuyen_trang_thai CASCADE;
DROP TABLE IF EXISTS public.quy_trinh_sop       CASCADE;
DROP TABLE IF EXISTS public.cam_bien            CASCADE;
DROP TABLE IF EXISTS public.phong_sach          CASCADE;
DROP TABLE IF EXISTS public.nguoi_dung          CASCADE;
DROP TABLE IF EXISTS public.cau_hinh            CASCADE;

SELECT '🗑️ ĐÃ RESET SẠCH. Chạy lại 01→10 để cài đặt lại.' AS ket_qua;
