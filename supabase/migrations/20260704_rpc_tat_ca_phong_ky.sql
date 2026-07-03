-- ============================================================================
-- rpc_tat_ca_phong_ky(p_tu, p_den) — TOÀN BỘ phòng có KPI trong kỳ (không giới hạn)
-- cho BẢNG CHI TIẾT tương tác trên dashboard (tìm/sắp/lọc + bấm xem chuỗi).
--
-- Tách riêng khỏi rpc_bao_cao_tong_hop (giữ function chính đã kiểm chứng nguyên
-- trạng). WF5 v2 gộp kết quả vào JSON báo cáo ngay ở node query:
--   (rpc_bao_cao_tong_hop(...) || jsonb_build_object('tat_ca_phong',
--      rpc_tat_ca_phong_ky(p_tu, p_den)))::text
-- Vẫn 1 phạm vi dữ liệu tất định (kpi_ngay_phong, lọc thuoc_thu_nghiem) — truy vết GMP.
-- ============================================================================
create or replace function public.rpc_tat_ca_phong_ky(p_tu date, p_den date)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'ma_phong',       t.ma_phong,
           'ten_phong',      coalesce(t.ten_phong, t.ma_phong),
           'khu_vuc',        t.khu_vuc,
           'ahu',            t.ahu,
           'muc_uu_tien',    t.muc_uu_tien,
           'ty_le_tuan_thu', round(t.tb::numeric, 2),
           'so_gio_critical',t.crit,
           'so_gio_warning', t.warn,
           'so_gio_oos',     t.gio_cb,
           'oos_rate_pct',   round(t.oos::numeric, 2),
           'dq_pct',         round(t.dq::numeric, 2),
           'so_ngay_co_du_lieu', t.so_ngay,
           'chuoi',          t.chuoi
         ) order by t.khu_vuc nulls last, t.ahu nulls last, t.ma_phong), '[]'::jsonb)
  from (
    select k.ma_phong,
           max(k.ten_phong) as ten_phong, max(k.khu_vuc) as khu_vuc,
           max(k.ahu) as ahu, max(k.muc_uu_tien) as muc_uu_tien,
           avg(k.ti_le_dat_pct)          as tb,
           avg(k.oos_rate_pct_tb)        as oos,
           avg(k.chat_luong_du_lieu_pct) as dq,
           coalesce(sum(k.so_gio_critical),0) as crit,
           coalesce(sum(k.so_gio_warning),0)  as warn,
           coalesce(sum(k.so_gio_critical),0) + coalesce(sum(k.so_gio_warning),0) as gio_cb,
           count(*) as so_ngay,
           jsonb_agg(jsonb_build_object(
             'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
             'ty_le', round(k.ti_le_dat_pct::numeric, 2))
           order by k.ngay) as chuoi
    from kpi_ngay_phong k
    where k.thuoc_thu_nghiem = public.cfg_bool('che_do_thu_nghiem', true)
      and k.sensor_type = 'ALL'
      and k.ngay between p_tu and p_den
      and k.ti_le_dat_pct is not null
    group by k.ma_phong
  ) t;
$$;

comment on function public.rpc_tat_ca_phong_ky(date, date) is
  'v3: Toàn bộ phòng có KPI trong kỳ (kpi_ngay_phong, sensor ALL) cho bảng chi tiết '
  'dashboard WF5 v2. Lọc thuoc_thu_nghiem = cfg_bool(che_do_thu_nghiem). Gộp vào '
  'JSON báo cáo tại node query (khóa tat_ca_phong).';

revoke all on function public.rpc_tat_ca_phong_ky(date, date) from public;
revoke all on function public.rpc_tat_ca_phong_ky(date, date) from anon;
revoke all on function public.rpc_tat_ca_phong_ky(date, date) from authenticated;
grant execute on function public.rpc_tat_ca_phong_ky(date, date) to service_role;
