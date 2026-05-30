-- ============================================================
-- KIỂM TRA GỘP PHA 1 — trả về 1 BẢNG duy nhất, dễ đọc PASS/FAIL
-- Dán nguyên khối này vào Supabase SQL Editor, bấm Run.
-- Mọi dòng phải là ✅ PASS.
-- ============================================================
WITH kiem_tra AS (
  SELECT 1 AS stt, 'Số bảng (cần 22)' AS hang_muc,
    (SELECT count(*)::text FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE') AS gia_tri,
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE')=22 AS dat
  UNION ALL
  SELECT 2, 'Số view xem_* (cần 14)',
    (SELECT count(*)::text FROM information_schema.views
      WHERE table_schema='public' AND table_name LIKE 'xem_%'),
    (SELECT count(*) FROM information_schema.views
      WHERE table_schema='public' AND table_name LIKE 'xem_%')=14
  UNION ALL
  SELECT 3, 'Số RPC rpc_* (cần 18)',
    (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE 'rpc_%'),
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE 'rpc_%')=18
  UNION ALL
  SELECT 4, 'Bảng THIẾU RLS (cần 0)',
    (SELECT count(*)::text FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity),
    (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity)=0
  UNION ALL
  SELECT 5, 'Số policy RLS (cần > 0)',
    (SELECT count(*)::text FROM pg_policies WHERE schemaname='public'),
    (SELECT count(*) FROM pg_policies WHERE schemaname='public')>0
  UNION ALL
  SELECT 6, 'Secret openai_api_key qua cfg_text (phải rỗng)',
    COALESCE('['||public.cfg_text('openai_api_key','')||']','[NULL]'),
    COALESCE(public.cfg_text('openai_api_key',''),'')=''
  UNION ALL
  SELECT 7, 'anon KHÔNG có quyền cfg_secret (phải false)',
    has_function_privilege('anon','public.cfg_secret(text)','execute')::text,
    has_function_privilege('anon','public.cfg_secret(text)','execute')=false
  UNION ALL
  SELECT 8, 'service_role CÓ quyền cfg_secret (phải true)',
    has_function_privilege('service_role','public.cfg_secret(text)','execute')::text,
    has_function_privilege('service_role','public.cfg_secret(text)','execute')=true
  UNION ALL
  SELECT 9, 'anon KHÔNG gọi được ingest (phải false)',
    has_function_privilege('anon','public.rpc_xu_ly_du_lieu_nhieu_phong(jsonb)','execute')::text,
    has_function_privilege('anon','public.rpc_xu_ly_du_lieu_nhieu_phong(jsonb)','execute')=false
  UNION ALL
  SELECT 10, 'Trigger ALCOA+ chặn UPDATE/DELETE (cần 3)',
    (SELECT count(*)::text FROM pg_trigger
      WHERE tgname IN ('trg_chan_sua_du_lieu_gio','trg_su_co_check_bypass','trg_chan_sua_lich_su_su_co')),
    (SELECT count(*) FROM pg_trigger
      WHERE tgname IN ('trg_chan_sua_du_lieu_gio','trg_su_co_check_bypass','trg_chan_sua_lich_su_su_co'))=3
  UNION ALL
  SELECT 11, 'Dữ liệu demo: phòng (TEST mode)',
    (SELECT count(*)::text FROM phong_sach),
    (SELECT count(*) FROM phong_sach) >= 6
  UNION ALL
  SELECT 12, 'Dashboard xem_tong_quan chạy được',
    (SELECT 'tổng='||tong_phong||' SC='||su_co_dang_mo FROM xem_tong_quan),
    (SELECT tong_phong FROM xem_tong_quan) > 0
)
SELECT stt AS "#", hang_muc AS "Hạng mục", gia_tri AS "Giá trị",
  CASE WHEN dat THEN '✅ PASS' ELSE '❌ FAIL' END AS "Kết quả"
FROM kiem_tra ORDER BY stt;
