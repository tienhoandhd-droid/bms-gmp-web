-- ============================================================
-- 99_kiem_tra.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 11/11
--
-- MỤC ĐÍCH: kiểm tra toàn bộ cài đặt Pha 1 sau khi chạy file 01-10.
-- Chạy file này CUỐI CÙNG. Mọi dòng phải hiển thị PASS.
--
-- KHÔNG ghi/sửa dữ liệu — chỉ đọc kiểm tra.
-- ============================================================

-- ============================================================
-- 1. Đếm thành phần
-- ============================================================
SELECT '═══ 1. THÀNH PHẦN DATABASE ═══' AS kiem_tra;

SELECT 
  'Bảng' AS loai,
  count(*) AS so_luong,
  CASE WHEN count(*) >= 22 THEN '✅ PASS' ELSE '❌ FAIL (cần ≥22)' END AS ket_qua
FROM information_schema.tables 
WHERE table_schema='public' AND table_type='BASE TABLE'
UNION ALL
SELECT 'View xem_*', count(*),
  CASE WHEN count(*) >= 13 THEN '✅ PASS' ELSE '❌ FAIL (cần ≥13)' END
FROM information_schema.views WHERE table_schema='public' AND table_name LIKE 'xem_%'
UNION ALL
SELECT 'RPC rpc_*', count(*),
  CASE WHEN count(*) >= 16 THEN '✅ PASS' ELSE '❌ FAIL (cần ≥16)' END
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'rpc_%'
UNION ALL
SELECT 'Trigger chặn sửa/xóa', count(*),
  CASE WHEN count(*) >= 8 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM information_schema.triggers 
WHERE event_object_schema='public' AND trigger_name LIKE 'trg_chan%'
UNION ALL
SELECT 'Policy RLS', count(*),
  CASE WHEN count(*) >= 25 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM pg_policies WHERE schemaname='public';

-- ============================================================
-- 2. Master data
-- ============================================================
SELECT '═══ 2. MASTER DATA ═══' AS kiem_tra;

SELECT 
  'Người dùng (5 vai trò)' AS muc, count(*) AS so_luong,
  CASE WHEN count(*) >= 5 THEN '✅ PASS' ELSE '❌ FAIL' END AS ket_qua
FROM public.nguoi_dung WHERE kich_hoat
UNION ALL
SELECT 'Phòng demo', count(*),
  CASE WHEN count(*) >= 6 THEN '✅ PASS' ELSE '⚠️ chưa seed' END
FROM public.phong_sach WHERE kich_hoat
UNION ALL
SELECT 'Cảm biến', count(*),
  CASE WHEN count(*) >= 15 THEN '✅ PASS' ELSE '⚠️ chưa seed' END
FROM public.cam_bien WHERE kich_hoat
UNION ALL
SELECT 'Quy tắc state machine', count(*),
  CASE WHEN count(*) >= 20 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM public.quy_tac_chuyen_trang_thai WHERE kich_hoat
UNION ALL
SELECT 'SOP', count(*),
  CASE WHEN count(*) >= 5 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM public.quy_trinh_sop WHERE kich_hoat;

-- ============================================================
-- 3. Kiểm tra các view trả dữ liệu (không lỗi)
-- ============================================================
SELECT '═══ 3. VIEW HOẠT ĐỘNG ═══' AS kiem_tra;

SELECT 'xem_tong_quan' AS view_name, 
  (SELECT tong_phong FROM public.xem_tong_quan)::text || ' phòng' AS mau_du_lieu,
  '✅' AS ket_qua;

SELECT 'xem_phong_co_kpi' AS view_name,
  count(*)::text || ' phòng' AS mau_du_lieu, '✅' AS ket_qua
FROM public.xem_phong_co_kpi;

SELECT 'xem_su_co_dang_mo' AS view_name,
  count(*)::text || ' sự cố mở' AS mau_du_lieu, '✅' AS ket_qua
FROM public.xem_su_co_dang_mo;

SELECT 'xem_canh_bao_he_thong' AS view_name,
  count(*)::text || ' cảnh báo' AS mau_du_lieu, '✅' AS ket_qua
FROM public.xem_canh_bao_he_thong;

SELECT 'xem_xep_hang_rui_ro' AS view_name,
  count(*)::text || ' dòng ranking' AS mau_du_lieu, '✅' AS ket_qua
FROM public.xem_xep_hang_rui_ro;

-- ============================================================
-- 4. Kiểm tra RPC hoạt động (read-only)
-- ============================================================
SELECT '═══ 4. RPC HOẠT ĐỘNG ═══' AS kiem_tra;

-- Health check RPC
SELECT 'rpc_kiem_tra_he_thong' AS rpc_name,
  jsonb_array_length(public.rpc_kiem_tra_he_thong())::text || ' mục kiểm tra' AS ket_qua;

-- Trend RPC (TOTAL 30 ngày)
SELECT 'rpc_lay_chuoi_xu_huong' AS rpc_name,
  jsonb_array_length(public.rpc_lay_chuoi_xu_huong('TOTAL','ALL','ALL',30))::text || ' điểm dữ liệu' AS ket_qua;

-- AI payload RPC
SELECT 'rpc_lay_du_lieu_bao_cao_ai' AS rpc_name,
  CASE WHEN (public.rpc_lay_du_lieu_bao_cao_ai('NGAY', now()))->>'loai_bao_cao' = 'NGAY' 
       THEN '✅ trả JSON đúng' ELSE '❌ lỗi' END AS ket_qua;

-- ============================================================
-- 5. Kiểm tra trigger ALCOA+ thực sự chặn
-- ============================================================
SELECT '═══ 5. TRIGGER ALCOA+ ═══' AS kiem_tra;

DO $$
DECLARE v_chan BOOLEAN := false;
BEGIN
  -- Thử UPDATE du_lieu_gio không bypass → phải bị chặn
  BEGIN
    UPDATE public.du_lieu_gio SET gia_tri_tb = 999 WHERE id = (SELECT id FROM public.du_lieu_gio LIMIT 1);
  EXCEPTION WHEN OTHERS THEN
    v_chan := true;
  END;
  IF v_chan THEN
    RAISE NOTICE '✅ PASS: Trigger chặn UPDATE du_lieu_gio hoạt động đúng.';
  ELSE
    RAISE WARNING '❌ FAIL: Trigger KHÔNG chặn UPDATE du_lieu_gio!';
  END IF;
END $$;

DO $$
DECLARE v_chan BOOLEAN := false;
BEGIN
  -- Thử DELETE lich_su_su_co → phải bị chặn tuyệt đối
  BEGIN
    DELETE FROM public.lich_su_su_co WHERE id = (SELECT id FROM public.lich_su_su_co LIMIT 1);
  EXCEPTION WHEN OTHERS THEN
    v_chan := true;
  END;
  IF v_chan THEN
    RAISE NOTICE '✅ PASS: Trigger chặn DELETE lich_su_su_co (audit) hoạt động đúng.';
  ELSE
    RAISE WARNING '❌ FAIL: Audit log có thể bị xóa!';
  END IF;
END $$;

-- ============================================================
-- 6. Kiểm tra secret được mask
-- ============================================================
SELECT '═══ 6. BẢO MẬT ═══' AS kiem_tra;

SELECT 
  'Mask secret trong view' AS muc,
  value_hien_thi,
  CASE WHEN value_hien_thi NOT LIKE 'sk-%' THEN '✅ PASS (đã mask)' ELSE '❌ FAIL (lộ key)' END AS ket_qua
FROM public.xem_cau_hinh_he_thong 
WHERE key = 'openai_api_key';

-- ============================================================
-- 7. TỔNG KẾT
-- ============================================================
SELECT '═══ ✅ HOÀN TẤT KIỂM TRA PHA 1 ═══' AS ket_qua,
  public.cfg_text('phien_ban_db', '?') AS phien_ban,
  public.cfg_text('moi_truong', '?')   AS moi_truong,
  'Nếu mọi dòng PASS, Pha 1 OK. Chuyển sang Pha 2 (Web).' AS buoc_tiep;
