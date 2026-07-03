-- ============================================================================
-- rpc_bao_cao_tong_hop v2.1 — ĐÃ ĐỐI CHIẾU SCHEMA THẬT (project bms-gmp-v10,
-- 03/07/2026) và ÁP DỤNG qua migration `rpc_bao_cao_tong_hop_v2_schema_that`.
--
-- Khác bản nháp cũ (các giả định đã được thay bằng bảng/cột THẬT):
--   kpi_ngay            → kpi_ngay_scope (TOTAL/AREA/AHU, sensor_type='ALL')
--                         + kpi_ngay_phong (cấp phòng, sensor_type='ALL')
--   phong               → phong_sach (ma_phong, ten_phong, khu_vuc, ahu,
--                         muc_uu_tien, kich_hoat)
--   so_gio_oos          → KHÔNG có cột này. Số thật: so_gio_critical +
--                         so_gio_warning (giờ ở trạng thái cảnh báo) và
--                         oos_rate_pct_tb (% điểm OOS trung bình). JSON trả
--                         `so_gio_oos` = critical + warning (để template dùng),
--                         kèm tách riêng so_gio_critical / so_gio_warning /
--                         oos_rate_pct.
--   dq_pct              → chat_luong_du_lieu_pct
--   su_co               → thoi_gian_mo / thoi_gian_dong / trang_thai_hien_tai
--                         (đóng = thoi_gian_dong IS NOT NULL)
--   ngoai_le_du_lieu    → ma_loi (SENSOR_DUNG_HINH/FMS_HTTP_LOI…), mo_ta_loi,
--                         bucket_utc (không có ket_thuc)
--   dac_trung_xu_huong  → cột thật do_doc / r2 / huong / tinh_luc
--                         (không đọc du_lieu->>'slope')
--   so_sanh_baseline    → baseline_compliance_tb / hien_tai_compliance_tb /
--                         compliance_delta / oos_rate_delta / baseline_direction
--   cau_hinh            → key/value + helper cfg_bool; MỌI bảng dữ liệu lọc
--                         thuoc_thu_nghiem = cfg_bool('che_do_thu_nghiem').
--   Ngày giờ            → thoi_gian_mo/bucket_utc đổi sang ngày VN
--                         (AT TIME ZONE 'Asia/Ho_Chi_Minh') trước khi so p_tu/p_den.
--
-- Mục đích (GMP): MỌI con số trong báo cáo tuần/tháng/quý truy vết về đúng 1 hàm
-- SQL này. n8n (WF5 v2) chỉ gọi: select rpc_bao_cao_tong_hop('THANG',
-- '2026-06-01','2026-06-30'); AI chỉ viết lời bình từ JSON trả về.
-- ============================================================================

create or replace function public.rpc_bao_cao_tong_hop(
  p_ky  text,   -- 'TUAN' | 'THANG' | 'QUY' (ghi vào JSON, không đổi logic)
  p_tu  date,   -- ngày đầu kỳ (bao gồm)
  p_den date    -- ngày cuối kỳ (bao gồm)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tn          boolean := public.cfg_bool('che_do_thu_nghiem', true);
  v_so_ngay     int;
  v_tu_truoc    date;
  v_den_truoc   date;
  v_kpi_ky_nay  jsonb;
  v_kpi_ky_truoc jsonb;
  v_chuoi_ngay  jsonb;
  v_top_phong   jsonb;
  v_top_phong_tot jsonb;
  v_phong_xau   jsonb;
  v_xu_huong    jsonb;
  v_do_phu      jsonb;
  v_ngoai_le    jsonb;
  v_gioi_han    jsonb;
  v_spc         jsonb;
  v_mkt         jsonb;
  v_su_co       jsonb;
  v_baseline    jsonb;
  v_xu_huong_chu_y jsonb;
  v_ai          jsonb;
begin
  if p_tu is null or p_den is null or p_den < p_tu then
    raise exception 'Khoảng ngày không hợp lệ: p_tu=% p_den=%', p_tu, p_den;
  end if;

  v_so_ngay   := (p_den - p_tu) + 1;
  v_den_truoc := p_tu - 1;
  v_tu_truoc  := p_tu - v_so_ngay;

  -- ------------------------------------------------------------------
  -- KPI tổng hợp kỳ này (kpi_ngay_scope cấp TOTAL) + đếm phòng đạt/không
  -- đạt (kpi_ngay_phong, trung bình kỳ so ngưỡng 80%).
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'ty_le_tuan_thu',  round(avg(k.ti_le_dat_pct)::numeric, 2),
      'oos_rate_pct',    round(avg(k.oos_rate_pct_tb)::numeric, 2),
      'so_gio_critical', coalesce(sum(k.so_gio_critical), 0),
      'so_gio_warning',  coalesce(sum(k.so_gio_warning), 0),
      'so_gio_oos',      coalesce(sum(k.so_gio_critical), 0) + coalesce(sum(k.so_gio_warning), 0),
      'dq_pct',          round(avg(k.chat_luong_du_lieu_pct)::numeric, 2),
      'so_ngay_co_du_lieu', count(*)
    )
  into v_kpi_ky_nay
  from kpi_ngay_scope k
  where k.thuoc_thu_nghiem = v_tn
    and k.scope_type = 'TOTAL' and k.sensor_type = 'ALL'
    and k.ngay between p_tu and p_den;

  v_kpi_ky_nay := v_kpi_ky_nay || (
    select jsonb_build_object(
        'so_phong_dat',       count(*) filter (where tb >= 80),
        'so_phong_khong_dat', count(*) filter (where tb <  80),
        'tong_phong_co_du_lieu', count(*)
      )
    from (
      select k.ma_phong, avg(k.ti_le_dat_pct) as tb
      from kpi_ngay_phong k
      where k.thuoc_thu_nghiem = v_tn and k.sensor_type = 'ALL'
        and k.ngay between p_tu and p_den and k.ti_le_dat_pct is not null
      group by k.ma_phong
    ) t
  );

  select jsonb_build_object(
      'ty_le_tuan_thu',  round(avg(k.ti_le_dat_pct)::numeric, 2),
      'oos_rate_pct',    round(avg(k.oos_rate_pct_tb)::numeric, 2),
      'so_gio_critical', coalesce(sum(k.so_gio_critical), 0),
      'so_gio_warning',  coalesce(sum(k.so_gio_warning), 0),
      'so_gio_oos',      coalesce(sum(k.so_gio_critical), 0) + coalesce(sum(k.so_gio_warning), 0),
      'dq_pct',          round(avg(k.chat_luong_du_lieu_pct)::numeric, 2),
      'so_ngay_co_du_lieu', count(*)
    )
  into v_kpi_ky_truoc
  from kpi_ngay_scope k
  where k.thuoc_thu_nghiem = v_tn
    and k.scope_type = 'TOTAL' and k.sensor_type = 'ALL'
    and k.ngay between v_tu_truoc and v_den_truoc;

  -- ------------------------------------------------------------------
  -- Chuỗi tuân thủ theo ngày (khóa v1 — giữ hình dạng cũ cho tương thích)
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'total', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
                 'ty_le', round(k.ti_le_dat_pct::numeric, 2),
                 'oos_rate_pct', round(k.oos_rate_pct_tb::numeric, 2))
               order by k.ngay)
        from kpi_ngay_scope k
        where k.thuoc_thu_nghiem = v_tn
          and k.scope_type = 'TOTAL' and k.sensor_type = 'ALL'
          and k.ngay between p_tu and p_den
      ), '[]'::jsonb),
      'theo_khu', coalesce((
        select jsonb_object_agg(khu, chuoi)
        from (
          select k.scope_id as khu,
                 jsonb_agg(jsonb_build_object(
                   'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
                   'ty_le', round(k.ti_le_dat_pct::numeric, 2))
                 order by k.ngay) as chuoi
          from kpi_ngay_scope k
          where k.thuoc_thu_nghiem = v_tn
            and k.scope_type = 'AREA' and k.sensor_type = 'ALL'
            and k.ngay between p_tu and p_den
          group by k.scope_id
        ) a
      ), '{}'::jsonb)
    )
  into v_chuoi_ngay;

  -- ------------------------------------------------------------------
  -- v2: XU HƯỚNG chuẩn hoá — nha_may / theo_khu / theo_ahu, kèm ty_le_tb
  -- từng scope (template hiển thị % cạnh sparkline).
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'nha_may', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
                 'ty_le', round(k.ti_le_dat_pct::numeric, 2))
               order by k.ngay)
        from kpi_ngay_scope k
        where k.thuoc_thu_nghiem = v_tn
          and k.scope_type = 'TOTAL' and k.sensor_type = 'ALL'
          and k.ngay between p_tu and p_den
      ), '[]'::jsonb),
      'theo_khu', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'khu_vuc', a.khu, 'ten_khu', a.ten_khu,
                 'ty_le_tb', a.tb, 'chuoi', a.chuoi)
               order by a.khu)
        from (
          select k.scope_id as khu, max(k.ten_scope) as ten_khu,
                 round(avg(k.ti_le_dat_pct)::numeric, 2) as tb,
                 jsonb_agg(jsonb_build_object(
                   'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
                   'ty_le', round(k.ti_le_dat_pct::numeric, 2))
                 order by k.ngay) as chuoi
          from kpi_ngay_scope k
          where k.thuoc_thu_nghiem = v_tn
            and k.scope_type = 'AREA' and k.sensor_type = 'ALL'
            and k.ngay between p_tu and p_den
          group by k.scope_id
        ) a
      ), '[]'::jsonb),
      'theo_ahu', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'ahu', h.ahu, 'ten_ahu', h.ten_ahu,
                 'ty_le_tb', h.tb, 'chuoi', h.chuoi)
               order by h.ahu)
        from (
          select k.scope_id as ahu, max(k.ten_scope) as ten_ahu,
                 round(avg(k.ti_le_dat_pct)::numeric, 2) as tb,
                 jsonb_agg(jsonb_build_object(
                   'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
                   'ty_le', round(k.ti_le_dat_pct::numeric, 2))
                 order by k.ngay) as chuoi
          from kpi_ngay_scope k
          where k.thuoc_thu_nghiem = v_tn
            and k.scope_type = 'AHU' and k.sensor_type = 'ALL'
            and k.ngay between p_tu and p_den
          group by k.scope_id
        ) h
      ), '[]'::jsonb)
    )
  into v_xu_huong;

  -- ------------------------------------------------------------------
  -- Top 5 phòng XẤU nhất kỳ (kpi_ngay_phong; tuân thủ TB thấp nhất,
  -- đồng hạng → nhiều giờ cảnh báo hơn xếp trên) + chuỗi ngày cho sparkline.
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'ma_phong',       t.ma_phong,
           'ten_phong',      coalesce(p.ten_phong, t.ten_phong, t.ma_phong),
           'khu_vuc',        coalesce(p.khu_vuc, t.khu_vuc),
           'ty_le_tuan_thu', round(t.tb::numeric, 2),
           'so_gio_oos',     t.gio_cb,
           'oos_rate_pct',   round(t.oos::numeric, 2),
           'so_ngay_co_du_lieu', t.so_ngay,
           'chuoi',          t.chuoi
         ) order by t.tb asc nulls last, t.gio_cb desc), '[]'::jsonb)
  into v_top_phong
  from (
    select k.ma_phong, max(k.ten_phong) as ten_phong, max(k.khu_vuc) as khu_vuc,
           avg(k.ti_le_dat_pct) as tb,
           avg(k.oos_rate_pct_tb) as oos,
           coalesce(sum(k.so_gio_critical),0) + coalesce(sum(k.so_gio_warning),0) as gio_cb,
           count(*) as so_ngay,
           jsonb_agg(jsonb_build_object(
             'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
             'ty_le', round(k.ti_le_dat_pct::numeric, 2))
           order by k.ngay) as chuoi
    from kpi_ngay_phong k
    where k.thuoc_thu_nghiem = v_tn and k.sensor_type = 'ALL'
      and k.ngay between p_tu and p_den and k.ti_le_dat_pct is not null
    group by k.ma_phong
    order by avg(k.ti_le_dat_pct) asc nulls last,
             coalesce(sum(k.so_gio_critical),0) + coalesce(sum(k.so_gio_warning),0) desc
    limit 5
  ) t
  left join phong_sach p on p.ma_phong = t.ma_phong;

  -- ------------------------------------------------------------------
  -- v2: Top 5 phòng TỐT nhất kỳ (cùng hình dạng, chiều ngược lại).
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'ma_phong',       t.ma_phong,
           'ten_phong',      coalesce(p.ten_phong, t.ten_phong, t.ma_phong),
           'khu_vuc',        coalesce(p.khu_vuc, t.khu_vuc),
           'ty_le_tuan_thu', round(t.tb::numeric, 2),
           'so_gio_oos',     t.gio_cb,
           'oos_rate_pct',   round(t.oos::numeric, 2),
           'so_ngay_co_du_lieu', t.so_ngay,
           'chuoi',          t.chuoi
         ) order by t.tb desc nulls last, t.gio_cb asc), '[]'::jsonb)
  into v_top_phong_tot
  from (
    select k.ma_phong, max(k.ten_phong) as ten_phong, max(k.khu_vuc) as khu_vuc,
           avg(k.ti_le_dat_pct) as tb,
           avg(k.oos_rate_pct_tb) as oos,
           coalesce(sum(k.so_gio_critical),0) + coalesce(sum(k.so_gio_warning),0) as gio_cb,
           count(*) as so_ngay,
           jsonb_agg(jsonb_build_object(
             'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
             'ty_le', round(k.ti_le_dat_pct::numeric, 2))
           order by k.ngay) as chuoi
    from kpi_ngay_phong k
    where k.thuoc_thu_nghiem = v_tn and k.sensor_type = 'ALL'
      and k.ngay between p_tu and p_den and k.ti_le_dat_pct is not null
    group by k.ma_phong
    order by avg(k.ti_le_dat_pct) desc nulls last,
             coalesce(sum(k.so_gio_critical),0) + coalesce(sum(k.so_gio_warning),0) asc
    limit 5
  ) t
  left join phong_sach p on p.ma_phong = t.ma_phong;

  -- ------------------------------------------------------------------
  -- v2 (QUAN TRỌNG): PHÒNG XẤU ĐI BẤT THƯỜNG — lọt danh sách nếu THỎA ≥ 1:
  --   (a) tuân thủ TB kỳ này giảm ≥ 5 điểm % so kỳ trước cùng độ dài;
  --   (b) đang có tín hiệu SPC ngoài kiểm soát (xem_spc_canh_bao cấp ROOM,
  --       scope_id = ma_phong — job đêm tính trên 30 ngày gần nhất);
  --   (c) xu hướng giảm tin cậy: dac_trung_xu_huong cấp ROOM có
  --       huong='worsening', do_doc<0, r2≥0.5, tính trong 2 ngày gần đây.
  -- ly_do[] ghi rõ tiêu chí kích hoạt (truy vết GMP). Tối đa 20 phòng.
  -- ------------------------------------------------------------------
  with nay as (
    select k.ma_phong, avg(k.ti_le_dat_pct) as tb
    from kpi_ngay_phong k
    where k.thuoc_thu_nghiem = v_tn and k.sensor_type = 'ALL'
      and k.ngay between p_tu and p_den and k.ti_le_dat_pct is not null
    group by k.ma_phong
  ),
  truoc as (
    select k.ma_phong, avg(k.ti_le_dat_pct) as tb
    from kpi_ngay_phong k
    where k.thuoc_thu_nghiem = v_tn and k.sensor_type = 'ALL'
      and k.ngay between v_tu_truoc and v_den_truoc and k.ti_le_dat_pct is not null
    group by k.ma_phong
  ),
  spc_phong as (
    select s.scope_id as ma_phong, sum(s.so_tin_hieu)::int as so_tin_hieu
    from xem_spc_canh_bao s
    where s.scope_type = 'ROOM' and s.in_control = false
    group by s.scope_id
  ),
  xh_phong as (
    select distinct on (x.scope_id)
           x.scope_id as ma_phong, x.do_doc as slope, x.r2
    from dac_trung_xu_huong x
    where x.thuoc_thu_nghiem = v_tn
      and x.scope_type = 'ROOM'
      and x.huong = 'worsening'
      and x.do_doc < 0 and x.r2 >= 0.5
      and x.tinh_luc >= now() - interval '2 days'
    order by x.scope_id, x.do_doc asc      -- slope xấu nhất mỗi phòng
  ),
  hop as (
    select ma_phong,
           n.tb          as tb_nay,
           t.tb          as tb_truoc,
           (n.tb - t.tb) as delta,
           s.so_tin_hieu,
           x.slope, x.r2
    from nay n
    full join truoc     t using (ma_phong)
    full join spc_phong s using (ma_phong)
    full join xh_phong  x using (ma_phong)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ma_phong',          h.ma_phong,
           'ten_phong',         coalesce(p.ten_phong, h.ma_phong),
           'khu_vuc',           p.khu_vuc,
           'tuan_thu_ky_nay',   round(h.tb_nay::numeric, 2),
           'tuan_thu_ky_truoc', round(h.tb_truoc::numeric, 2),
           'delta',             round(h.delta::numeric, 2),
           'so_tin_hieu_spc',   coalesce(h.so_tin_hieu, 0),
           'slope',             h.slope,
           'r2',                h.r2,
           'ly_do', (
             select coalesce(jsonb_agg(r), '[]'::jsonb)
             from unnest(array[
               case when h.delta <= -5 then
                 format('Tuân thủ giảm %s điểm %% so kỳ trước (%s%% → %s%%)',
                        round(abs(h.delta)::numeric, 1),
                        round(h.tb_truoc::numeric, 1), round(h.tb_nay::numeric, 1)) end,
               case when coalesce(h.so_tin_hieu, 0) > 0 then
                 format('%s tín hiệu SPC ngoài kiểm soát (EWMA/CUSUM/Nelson)',
                        h.so_tin_hieu) end,
               case when h.slope is not null then
                 format('Xu hướng giảm tin cậy: %s điểm %%/ngày (R²=%s ≥ 0.5)',
                        round(h.slope::numeric, 3), round(h.r2::numeric, 2)) end
             ]) r where r is not null)
         ) order by h.delta asc nulls last, coalesce(h.so_tin_hieu,0) desc),
         '[]'::jsonb)
  into v_phong_xau
  from (
    select * from hop
    where delta <= -5
       or coalesce(so_tin_hieu, 0) > 0
       or slope is not null
    order by delta asc nulls last, coalesce(so_tin_hieu,0) desc
    limit 20
  ) h
  left join phong_sach p on p.ma_phong = h.ma_phong;

  -- ------------------------------------------------------------------
  -- v2: ĐỘ PHỦ DỮ LIỆU (ALCOA+): DQ TB kỳ, số ngày không có bản ghi TOTAL,
  -- 5 phòng DQ thấp nhất.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'dq_tb_pct', (
        select round(avg(k.chat_luong_du_lieu_pct)::numeric, 2)
        from kpi_ngay_scope k
        where k.thuoc_thu_nghiem = v_tn
          and k.scope_type = 'TOTAL' and k.sensor_type = 'ALL'
          and k.ngay between p_tu and p_den
      ),
      'so_ngay_thieu', v_so_ngay - (
        select count(distinct k.ngay)
        from kpi_ngay_scope k
        where k.thuoc_thu_nghiem = v_tn
          and k.scope_type = 'TOTAL' and k.sensor_type = 'ALL'
          and k.ngay between p_tu and p_den
      ),
      'phong_thieu_nhat', coalesce((
        select jsonb_agg(jsonb_build_object('ma_phong', r.ma_phong, 'dq_pct', r.dq)
               order by r.dq asc nulls first)
        from (
          select k.ma_phong,
                 round(avg(k.chat_luong_du_lieu_pct)::numeric, 2) as dq
          from kpi_ngay_phong k
          where k.thuoc_thu_nghiem = v_tn and k.sensor_type = 'ALL'
            and k.ngay between p_tu and p_den
          group by k.ma_phong
          order by avg(k.chat_luong_du_lieu_pct) asc nulls first
          limit 5
        ) r
      ), '[]'::jsonb)
    )
  into v_do_phu;

  -- ------------------------------------------------------------------
  -- v2: NGOẠI LỆ THU THẬP DỮ LIỆU trong kỳ (ngoai_le_du_lieu do WF1 ghi).
  -- Cột thật: ma_loi / mo_ta_loi / bucket_utc (ngày VN).
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'tong_so', count(*),
      'theo_loai', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'loai', g.loai, 'so_lan', g.so_lan, 'dien_giai', g.dien_giai)
               order by g.so_lan desc)
        from (
          select e.ma_loi as loai, count(*) as so_lan,
                 left((array_agg(e.mo_ta_loi order by e.bucket_utc desc))[1], 160) as dien_giai
          from ngoai_le_du_lieu e
          where e.thuoc_thu_nghiem = v_tn
            and (e.bucket_utc at time zone 'Asia/Ho_Chi_Minh')::date between p_tu and p_den
          group by e.ma_loi
        ) g
      ), '[]'::jsonb),
      'chi_tiet', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'loai',     e.ma_loi,
                 'ma_phong', e.ma_phong,
                 'bat_dau',  to_char(e.bucket_utc at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI'),
                 'mo_ta',    left(e.mo_ta_loi, 200))
               order by e.bucket_utc desc)
        from (
          select * from ngoai_le_du_lieu
          where thuoc_thu_nghiem = v_tn
            and (bucket_utc at time zone 'Asia/Ho_Chi_Minh')::date between p_tu and p_den
          order by bucket_utc desc
          limit 10
        ) e
      ), '[]'::jsonb)
    )
  into v_ngoai_le
  from ngoai_le_du_lieu e0
  where e0.thuoc_thu_nghiem = v_tn
    and (e0.bucket_utc at time zone 'Asia/Ho_Chi_Minh')::date between p_tu and p_den;

  -- ------------------------------------------------------------------
  -- SPC: tổng tín hiệu trên TOÀN BỘ scope ngoài kiểm soát; chi tiết top 10.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'tong_tin_hieu', coalesce((
        select sum(so_tin_hieu) from xem_spc_canh_bao where in_control = false), 0),
      'so_scope_ngoai_ks', coalesce((
        select count(*) from xem_spc_canh_bao where in_control = false), 0),
      'chi_tiet', coalesce((
        select jsonb_agg(jsonb_build_object(
            'scope_type',  s.scope_type,
            'scope_id',    s.scope_id,
            'ten_scope',   s.ten_scope,
            'sensor_type', s.sensor_type,
            'muc_tieu',    s.muc_tieu,
            'sigma',       s.sigma,
            'so_tin_hieu', s.so_tin_hieu,
            'cac_loai',    s.cac_loai
          ) order by s.so_tin_hieu desc)
        from (
          select * from xem_spc_canh_bao
          where in_control = false
          order by so_tin_hieu desc
          limit 10
        ) s
      ), '[]'::jsonb)
    )
  into v_spc;

  -- ------------------------------------------------------------------
  -- MKT 30 ngày (xem_mkt_phong) — top 10 cao nhất + ghi chú ICH Q1A.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'mkt_max',       max(m.mkt_30ngay),
      'mkt_max_phong', (array_agg(m.ma_phong order by m.mkt_30ngay desc))[1],
      'ich_q1a',       'MKT tính tất định theo ICH Q1A (Arrhenius; ΔH cấu hình '
                       'tại cau_hinh.mkt_delta_h_kj, mặc định 83.144 kJ/mol; '
                       'cửa sổ 30 ngày — nguồn: xem_mkt_phong). MKT luôn ≥ trung bình cộng.',
      'chi_tiet', coalesce(jsonb_agg(jsonb_build_object(
          'ma_phong',  m.ma_phong,
          'ten_phong', m.ten_phong,
          'khu_vuc',   m.khu_vuc,
          'mkt',       m.mkt_30ngay,
          't_tb',      m.t_tb_30ngay,
          't_max',     m.t_max_30ngay
        ) order by m.mkt_30ngay desc), '[]'::jsonb)
    )
  into v_mkt
  from (
    select * from xem_mkt_phong
    where mkt_30ngay is not null
    order by mkt_30ngay desc
    limit 10
  ) m;

  -- ------------------------------------------------------------------
  -- Sự cố: đang mở (view) + mở/đóng trong kỳ + MTTR + sự cố tiêu biểu
  -- (kéo dài nhất kỳ). Cột thật: thoi_gian_mo / thoi_gian_dong /
  -- trang_thai_hien_tai; đóng = thoi_gian_dong IS NOT NULL. Ngày theo giờ VN.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'dang_mo', (select count(*) from xem_su_co_dang_mo),
      'mo_trong_ky', (
        select count(*) from su_co c
        where c.thuoc_thu_nghiem = v_tn
          and (c.thoi_gian_mo at time zone 'Asia/Ho_Chi_Minh')::date between p_tu and p_den
      ),
      'dong_trong_ky', (
        select count(*) from su_co c
        where c.thuoc_thu_nghiem = v_tn
          and c.thoi_gian_dong is not null
          and (c.thoi_gian_dong at time zone 'Asia/Ho_Chi_Minh')::date between p_tu and p_den
      ),
      'mttr_gio', (
        select round(avg(extract(epoch from (c.thoi_gian_dong - c.thoi_gian_mo)) / 3600.0)::numeric, 1)
        from su_co c
        where c.thuoc_thu_nghiem = v_tn
          and c.thoi_gian_dong is not null
          and (c.thoi_gian_dong at time zone 'Asia/Ho_Chi_Minh')::date between p_tu and p_den
      ),
      'mo_ky_truoc', (
        select count(*) from su_co c
        where c.thuoc_thu_nghiem = v_tn
          and (c.thoi_gian_mo at time zone 'Asia/Ho_Chi_Minh')::date between v_tu_truoc and v_den_truoc
      ),
      'tieu_bieu', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'ma_su_co',   coalesce(c.khoa_su_co, c.ma_su_co::text),
                 'phong',      c.ma_phong,
                 'ten_phong',  coalesce(c.ten_phong, c.ma_phong),
                 'chi_tieu',   c.loai_cam_bien,
                 'bat_dau',    to_char(c.thoi_gian_mo at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI'),
                 'keo_dai_gio',round((extract(epoch from (coalesce(c.thoi_gian_dong, now()) - c.thoi_gian_mo)) / 3600.0)::numeric, 1),
                 'trang_thai', c.trang_thai_hien_tai)
               order by extract(epoch from (coalesce(c.thoi_gian_dong, now()) - c.thoi_gian_mo)) desc)
        from (
          select * from su_co
          where thuoc_thu_nghiem = v_tn
            and (thoi_gian_mo at time zone 'Asia/Ho_Chi_Minh')::date between p_tu and p_den
          order by extract(epoch from (coalesce(thoi_gian_dong, now()) - thoi_gian_mo)) desc
          limit 8
        ) c
      ), '[]'::jsonb),
      'danh_sach_dang_mo', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'ma_su_co', o.ma_su_co, 'phong', o.phong, 'ten_phong', o.ten_phong,
                 'uu_tien', o.uu_tien, 'muc_canh_bao', o.muc_canh_bao,
                 'trang_thai', o.trang_thai, 'bat_dau', o.bat_dau,
                 'keo_dai_gio', o.keo_dai_gio)
               order by o.bat_dau)
        from xem_su_co_dang_mo o
      ), '[]'::jsonb)
    )
  into v_su_co;

  -- ------------------------------------------------------------------
  -- Baseline 7n vs 30n (so_sanh_baseline, job đêm ≤ 2 ngày) — cột thật.
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'scope_type',       b.scope_type,
           'scope_id',         b.scope_id,
           'ten_scope',        b.ten_scope,
           'sensor_type',      b.sensor_type,
           'hien_tai_tb',      b.hien_tai_compliance_tb,
           'baseline_tb',      b.baseline_compliance_tb,
           'compliance_delta', b.compliance_delta,
           'oos_rate_delta',   b.oos_rate_delta,
           'danh_gia',         b.baseline_direction
         ) order by abs(coalesce(b.compliance_delta,0)) desc), '[]'::jsonb)
  into v_baseline
  from (
    select * from so_sanh_baseline
    where thuoc_thu_nghiem = v_tn
      and tinh_luc >= now() - interval '2 days'
    order by abs(coalesce(compliance_delta, 0)) desc
    limit 10
  ) b;

  -- ------------------------------------------------------------------
  -- Xu hướng đáng chú ý (hồi quy 30 ngày, R² ≥ 0.5) — cột thật do_doc/r2/huong.
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'scope_type',  x.scope_type,
           'scope_id',    x.scope_id,
           'ten_scope',   x.ten_scope,
           'sensor_type', x.sensor_type,
           'huong',       x.huong,
           'slope',       x.do_doc,
           'r2',          x.r2,
           'spc',         x.du_lieu->'spc'
         )), '[]'::jsonb)
  into v_xu_huong_chu_y
  from (
    select * from dac_trung_xu_huong
    where thuoc_thu_nghiem = v_tn
      and r2 >= 0.5
      and tinh_luc >= now() - interval '2 days'
    order by abs(do_doc) desc nulls last
    limit 10
  ) x;

  -- ------------------------------------------------------------------
  -- v2: GIỚI HẠN THAM CHIẾU — mức GHD–GHT DISTINCT theo mức ưu tiên phòng
  -- × chỉ tiêu (bảng cam_bien kich_hoat, join phong_sach). MẢNG phẳng đúng
  -- khóa template: muc_uu_tien / chi_tieu / ghd / ght / don_vi / so_phong.
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'muc_uu_tien', g.muc_uu_tien,
           'chi_tieu',    g.chi_tieu,
           'ghd',         g.ghd,
           'ght',         g.ght,
           'don_vi',      g.don_vi,
           'so_phong',    g.so_phong)
         order by g.muc_uu_tien, g.chi_tieu, g.ghd), '[]'::jsonb)
  into v_gioi_han
  from (
    select coalesce(p.muc_uu_tien, '—') as muc_uu_tien,
           c.loai_cam_bien              as chi_tieu,
           c.gioi_han_duoi              as ghd,
           c.gioi_han_tren              as ght,
           c.don_vi,
           count(distinct c.ma_phong)   as so_phong
    from cam_bien c
    left join phong_sach p on p.ma_phong = c.ma_phong
    where c.kich_hoat
    group by p.muc_uu_tien, c.loai_cam_bien,
             c.gioi_han_duoi, c.gioi_han_tren, c.don_vi
  ) g;

  -- ------------------------------------------------------------------
  -- Nhận định AI gần nhất (bao_cao_ai; WF3 Writer–Judge; trang_thai_ai='OK')
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'tao_luc',      to_char(a.tao_luc at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'),
      'noi_dung',     a.noi_dung_phan_tich,
      'muc_canh_bao', a.muc_canh_bao,
      'model_dung',   a.model_dung,
      'trang_thai_ai',a.trang_thai_ai,
      'ten_scope',    a.ten_scope,
      'loai_bao_cao', a.loai_bao_cao
    )
  into v_ai
  from bao_cao_ai a
  where a.thuoc_thu_nghiem = v_tn
    and a.trang_thai_ai = 'OK'
    and a.noi_dung_phan_tich is not null
  order by a.tao_luc desc
  limit 1;

  -- ------------------------------------------------------------------
  -- Ráp JSON cuối — 1 nguồn số liệu duy nhất cho toàn bộ báo cáo
  -- ------------------------------------------------------------------
  return jsonb_build_object(
    'ky',                   upper(coalesce(p_ky, 'TUAN')),
    'tu_ngay',              to_char(p_tu, 'YYYY-MM-DD'),
    'den_ngay',             to_char(p_den, 'YYYY-MM-DD'),
    'ky_truoc',             jsonb_build_object(
                              'tu_ngay',  to_char(v_tu_truoc, 'YYYY-MM-DD'),
                              'den_ngay', to_char(v_den_truoc, 'YYYY-MM-DD')),
    'kpi_ky_nay',           coalesce(v_kpi_ky_nay, '{}'::jsonb),
    'kpi_ky_truoc',         coalesce(v_kpi_ky_truoc, '{}'::jsonb),
    'chuoi_ngay',           coalesce(v_chuoi_ngay, '{}'::jsonb),
    'top_phong_rui_ro',     coalesce(v_top_phong, '[]'::jsonb),      -- = "top phòng xấu"
    'top_phong_tot',        coalesce(v_top_phong_tot, '[]'::jsonb),  -- v2
    'phong_xau_bat_thuong', coalesce(v_phong_xau, '[]'::jsonb),      -- v2
    'xu_huong',             coalesce(v_xu_huong, '{}'::jsonb),       -- v2
    'do_phu_du_lieu',       coalesce(v_do_phu, '{}'::jsonb),         -- v2
    'ngoai_le',             coalesce(v_ngoai_le,
                              jsonb_build_object('tong_so', 0,
                                'theo_loai', '[]'::jsonb,
                                'chi_tiet',  '[]'::jsonb)),          -- v2
    'gioi_han_tham_chieu',  coalesce(v_gioi_han, '[]'::jsonb),       -- v2 (MẢNG)
    'spc',                  coalesce(v_spc, '{}'::jsonb),
    'mkt',                  coalesce(v_mkt, '{}'::jsonb),
    'su_co',                coalesce(v_su_co, '{}'::jsonb),
    'so_sanh_baseline',     coalesce(v_baseline, '[]'::jsonb),
    'xu_huong_dang_chu_y',  coalesce(v_xu_huong_chu_y, '[]'::jsonb),
    'nhan_dinh_ai_gan_nhat',coalesce(v_ai, 'null'::jsonb),
    'che_do_thu_nghiem',    v_tn,
    'tao_luc',              now(),
    'nguon',                'rpc_bao_cao_tong_hop'   -- truy vết GMP: footer in dòng này
  );
end;
$$;

comment on function public.rpc_bao_cao_tong_hop(text, date, date) is
  'v2.1 ĐÃ ĐỐI CHIẾU SCHEMA THẬT: 1 JSON duy nhất cho báo cáo tuần/tháng/quý '
  '(WF5 v2). Nguồn: kpi_ngay_scope/kpi_ngay_phong, phong_sach, cam_bien, su_co '
  '(thoi_gian_mo/dong), ngoai_le_du_lieu (ma_loi), dac_trung_xu_huong '
  '(do_doc/r2/huong), so_sanh_baseline, xem_spc_canh_bao, xem_mkt_phong, '
  'bao_cao_ai. Kỳ trước = cùng độ dài, liền kề trước p_tu. Mọi bảng lọc '
  'thuoc_thu_nghiem = cfg_bool(''che_do_thu_nghiem''). LƯU Ý: so_gio_oos = '
  'so_gio_critical + so_gio_warning (giờ ở trạng thái cảnh báo).';

-- Báo cáo chạy server-side từ n8n (postgres/service_role) — KHÔNG cấp cho anon/authenticated.
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from public;
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from anon;
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from authenticated;
grant execute on function public.rpc_bao_cao_tong_hop(text, date, date) to service_role;
