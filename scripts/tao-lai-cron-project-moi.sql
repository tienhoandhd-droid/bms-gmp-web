-- ============================================================================
-- tao-lai-cron-project-moi.sql
-- Tạo lại 3 job pg_cron trên PROJECT MỚI sau khi restore schema + data.
-- ĐIỀU KIỆN: đã bật extension pg_cron trên project mới
--   (Supabase Dashboard → Database → Extensions → bật "pg_cron").
-- Giờ chạy theo UTC (Supabase chạy pg_cron theo UTC). Các job này giữ đúng
-- lịch như project cũ (đã đối chiếu 04/07/2026).
-- ============================================================================

-- Xóa job trùng tên nếu chạy lại script (bỏ qua lỗi nếu chưa có)
do $$
begin
  perform cron.unschedule('bms-xu-huong-dem');    exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('bms-spc-dem');          exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('bms-don-dep-du-lieu');   exception when others then null;
end $$;

select cron.schedule('bms-xu-huong-dem',    '15 18 * * *', $$SELECT public.rpc_tinh_xu_huong_hang_ngay();$$);
select cron.schedule('bms-spc-dem',         '45 18 * * *', $$SELECT public.rpc_capnhat_spc_dac_trung();$$);
select cron.schedule('bms-don-dep-du-lieu', '30 19 * * *', $$SELECT public.rpc_don_dep_du_lieu_qua_han();$$);

-- Kiểm tra
select jobname, schedule, active, command from cron.job order by jobname;
