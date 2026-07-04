-- ============================================================================
-- doi-chieu-migration.sql — ĐẾM CHÍNH XÁC số dòng mỗi bảng schema public.
-- Chạy trên CẢ project cũ và project mới rồi so 2 kết quả — phải KHỚP 100%.
--   psql "$SRC_DB_URL" -f scripts/doi-chieu-migration.sql   # CŨ
--   psql "$DST_DB_URL" -f scripts/doi-chieu-migration.sql   # MỚI
-- Dùng query_to_xml để count(*) từng bảng động trong 1 câu lệnh (đếm thật,
-- không phải ước lượng n_live_tup).
-- ============================================================================
select
  relname as bang,
  (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from public.%I', relname),
                      false, true, ''))
  )[1]::text::bigint as so_dong
from pg_stat_user_tables
where schemaname = 'public'
order by relname;

-- Tổng kiểm tra nhanh: tổng số dòng toàn schema public
select sum(
  (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from public.%I', relname),
                      false, true, ''))
  )[1]::text::bigint
) as tong_dong_public
from pg_stat_user_tables
where schemaname = 'public';
