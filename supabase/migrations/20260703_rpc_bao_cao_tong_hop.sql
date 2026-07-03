-- ============================================================================
-- BẢN NHÁP — cần đối chiếu tên cột với schema thật (\d kpi_ngay, \d su_co,
-- \d so_sanh_baseline, \d dac_trung_xu_huong, \d bao_cao_ai, \d+ xem_spc_canh_bao,
-- \d+ xem_mkt_phong, \d+ xem_su_co_dang_mo) TRƯỚC KHI APPLY.
--
-- Các cột GIẢ ĐỊNH (đoán theo quy ước đặt tên tiếng Việt của codebase) cần xác nhận:
--   kpi_ngay            : ngay (date), scope_type (text: TOTAL/AREA/AHU/ROOM),
--                         scope_id (text), sensor_type (text: ALL/DP/RH/T),
--                         ti_le_dat_pct (numeric), so_gio_oos (numeric),
--                         so_gio_warning (numeric), so_gio_critical (numeric),
--                         dq_pct (numeric)
--                         → nếu kpi_ngay KHÔNG có sensor_type thì bỏ điều kiện
--                           sensor_type = 'ALL'; nếu cấp ROOM lưu ma_phong thay
--                           scope_id thì đổi lại các join bên dưới.
--   xem_spc_canh_bao    : scope_type, scope_id, ten_scope, sensor_type,
--                         muc_tieu, sigma, in_control (bool), so_tin_hieu (int),
--                         cac_loai (text)  ← ĐÃ đối chiếu với web/src/lib/supabaseData.js
--   xem_mkt_phong       : ma_phong, ten_phong, khu_vuc, muc_uu_tien,
--                         mkt_30ngay, t_tb_30ngay, t_max_30ngay  ← ĐÃ đối chiếu
--   xem_su_co_dang_mo   : ma_su_co, phong, ten_phong, uu_tien, muc_canh_bao,
--                         trang_thai, bat_dau, keo_dai_gio  ← ĐÃ đối chiếu
--   su_co (bảng gốc)    : ma_su_co, ma_phong, loai_cam_bien, muc_canh_bao,
--                         trang_thai, bat_dau (timestamptz), ket_thuc (timestamptz)
--                         → cần xác nhận tên cột thời điểm đóng (ket_thuc? dong_luc?)
--                           và các mã trạng thái đóng (DA_KHAC_PHUC / IPC_BINH_THUONG /
--                           DONG_TU_DONG — theo TRANG_THAI_CODE_TO_LABEL trong web).
--   so_sanh_baseline    : scope_type, scope_id, sensor_type, tb_7ngay,
--                         tb_baseline, chenh_lech_pct, danh_gia, ngay_tinh
--   dac_trung_xu_huong  : scope_type, scope_id, sensor_type, du_lieu (jsonb:
--                         {slope, r2, spc:{in_control, tin_hieu[]}}),
--                         thuoc_thu_nghiem, cap_nhat_luc
--   bao_cao_ai          : id, tao_luc, ten_scope, sensor_type, pham_vi_ngay,
--                         noi_dung_phan_tich, muc_canh_bao, model_dung, trang_thai_ai
--
-- Mục đích (GMP): MỌI con số trong báo cáo tuần/tháng/quý truy vết về đúng 1 hàm
-- SQL này. n8n (WF5 v2) chỉ gọi: select rpc_bao_cao_tong_hop('TUAN', '2026-06-23',
-- '2026-06-29'); AI chỉ được viết lời bình từ JSON trả về, không tự tính số.
-- ============================================================================

create or replace function public.rpc_bao_cao_tong_hop(
  p_ky  text,   -- 'TUAN' | 'THANG' | 'QUY' (chỉ để ghi vào JSON, không đổi logic)
  p_tu  date,   -- ngày đầu kỳ (bao gồm)
  p_den date    -- ngày cuối kỳ (bao gồm)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_so_ngay     int;     -- độ dài kỳ (ngày)
  v_tu_truoc    date;    -- đầu kỳ trước (cùng độ dài, liền kề trước p_tu)
  v_den_truoc   date;    -- cuối kỳ trước
  v_kpi_ky_nay  jsonb;
  v_kpi_ky_truoc jsonb;
  v_chuoi_ngay  jsonb;
  v_top_phong   jsonb;
  v_spc         jsonb;
  v_mkt         jsonb;
  v_su_co       jsonb;
  v_baseline    jsonb;
  v_xu_huong    jsonb;
  v_ai          jsonb;
begin
  if p_tu is null or p_den is null or p_den < p_tu then
    raise exception 'Khoảng ngày không hợp lệ: p_tu=% p_den=%', p_tu, p_den;
  end if;

  v_so_ngay   := (p_den - p_tu) + 1;
  v_den_truoc := p_tu - 1;
  v_tu_truoc  := p_tu - v_so_ngay;

  -- ------------------------------------------------------------------
  -- KPI tổng hợp cho 1 cửa sổ ngày (dùng 2 lần: kỳ này + kỳ trước).
  -- GIẢ ĐỊNH: kpi_ngay cấp TOTAL/ALL đại diện toàn nhà máy;
  --           cấp ROOM để đếm phòng đạt/không đạt (ngưỡng 80%).
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'ty_le_tuan_thu',  round(avg(k.ti_le_dat_pct)::numeric, 2),
      'so_gio_oos',      round(coalesce(sum(k.so_gio_oos), 0)::numeric, 1),
      'so_gio_warning',  round(coalesce(sum(k.so_gio_warning), 0)::numeric, 1),
      'so_gio_critical', round(coalesce(sum(k.so_gio_critical), 0)::numeric, 1),
      'dq_pct',          round(avg(k.dq_pct)::numeric, 2),
      'so_ngay_co_du_lieu', count(*)
    )
  into v_kpi_ky_nay
  from kpi_ngay k
  where k.scope_type = 'TOTAL' and k.scope_id = 'ALL'
    and k.sensor_type = 'ALL'                      -- CẦN XÁC NHẬN: cột sensor_type
    and k.ngay between p_tu and p_den;

  -- Đếm phòng đạt / không đạt trong kỳ (trung bình kỳ so ngưỡng 80)
  v_kpi_ky_nay := v_kpi_ky_nay || (
    select jsonb_build_object(
        'so_phong_dat',       count(*) filter (where tb >= 80),
        'so_phong_khong_dat', count(*) filter (where tb <  80),
        'tong_phong_co_du_lieu', count(*)
      )
    from (
      select k.scope_id, avg(k.ti_le_dat_pct) as tb
      from kpi_ngay k
      where k.scope_type = 'ROOM'
        and k.sensor_type = 'ALL'                  -- CẦN XÁC NHẬN
        and k.ngay between p_tu and p_den
      group by k.scope_id
    ) t
  );

  select jsonb_build_object(
      'ty_le_tuan_thu',  round(avg(k.ti_le_dat_pct)::numeric, 2),
      'so_gio_oos',      round(coalesce(sum(k.so_gio_oos), 0)::numeric, 1),
      'so_gio_warning',  round(coalesce(sum(k.so_gio_warning), 0)::numeric, 1),
      'so_gio_critical', round(coalesce(sum(k.so_gio_critical), 0)::numeric, 1),
      'dq_pct',          round(avg(k.dq_pct)::numeric, 2),
      'so_ngay_co_du_lieu', count(*)
    )
  into v_kpi_ky_truoc
  from kpi_ngay k
  where k.scope_type = 'TOTAL' and k.scope_id = 'ALL'
    and k.sensor_type = 'ALL'                      -- CẦN XÁC NHẬN
    and k.ngay between v_tu_truoc and v_den_truoc;

  -- ------------------------------------------------------------------
  -- Chuỗi tuân thủ theo ngày (toàn nhà máy + theo khu) — cho line chart
  -- và calendar-heatmap. GIẢ ĐỊNH cấp AREA có scope_id = mã khu (C1/C4/Q2…).
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'total', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
                 'ty_le', round(k.ti_le_dat_pct::numeric, 2),
                 'so_gio_oos', round(coalesce(k.so_gio_oos, 0)::numeric, 1))
               order by k.ngay)
        from kpi_ngay k
        where k.scope_type = 'TOTAL' and k.scope_id = 'ALL'
          and k.sensor_type = 'ALL'                -- CẦN XÁC NHẬN
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
          from kpi_ngay k
          where k.scope_type = 'AREA'
            and k.sensor_type = 'ALL'              -- CẦN XÁC NHẬN
            and k.ngay between p_tu and p_den
          group by k.scope_id
        ) a
      ), '{}'::jsonb)
    )
  into v_chuoi_ngay;

  -- ------------------------------------------------------------------
  -- Top 5 phòng rủi ro trong kỳ (tuân thủ trung bình thấp nhất, ưu tiên
  -- nhiều giờ OOS) + chuỗi ngày từng phòng cho sparkline.
  -- GIẢ ĐỊNH: bảng phong(ma_phong, ten_phong, khu_vuc) — CẦN XÁC NHẬN tên bảng.
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'ma_phong',       t.ma_phong,
           'ten_phong',      coalesce(p.ten_phong, t.ma_phong),
           'khu_vuc',        p.khu_vuc,
           'ty_le_tuan_thu', round(t.tb::numeric, 2),
           'so_gio_oos',     round(t.oos::numeric, 1),
           'chuoi_ngay',     t.chuoi
         ) order by t.tb asc nulls last, t.oos desc), '[]'::jsonb)
  into v_top_phong
  from (
    select k.scope_id as ma_phong,
           avg(k.ti_le_dat_pct)          as tb,
           coalesce(sum(k.so_gio_oos),0) as oos,
           jsonb_agg(jsonb_build_object(
             'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
             'ty_le', round(k.ti_le_dat_pct::numeric, 2))
           order by k.ngay)              as chuoi
    from kpi_ngay k
    where k.scope_type = 'ROOM'
      and k.sensor_type = 'ALL'                    -- CẦN XÁC NHẬN
      and k.ngay between p_tu and p_den
    group by k.scope_id
    order by avg(k.ti_le_dat_pct) asc nulls last, coalesce(sum(k.so_gio_oos),0) desc
    limit 5
  ) t
  left join phong p on p.ma_phong = t.ma_phong;    -- CẦN XÁC NHẬN tên bảng phong

  -- ------------------------------------------------------------------
  -- SPC: tóm tắt tín hiệu ngoài kiểm soát (view đã đối chiếu với web)
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'tong_tin_hieu',       coalesce(sum(s.so_tin_hieu), 0),
      'so_scope_ngoai_ks',   count(*),
      'chi_tiet', coalesce(jsonb_agg(jsonb_build_object(
          'scope_type',  s.scope_type,
          'scope_id',    s.scope_id,
          'ten_scope',   s.ten_scope,
          'sensor_type', s.sensor_type,
          'muc_tieu',    s.muc_tieu,
          'sigma',       s.sigma,
          'so_tin_hieu', s.so_tin_hieu,
          'cac_loai',    s.cac_loai
        ) order by s.so_tin_hieu desc), '[]'::jsonb)
    )
  into v_spc
  from (
    select * from xem_spc_canh_bao
    where in_control = false
    order by so_tin_hieu desc
    limit 10
  ) s;

  -- ------------------------------------------------------------------
  -- MKT 30 ngày (view đã đối chiếu với web) — top 10 MKT cao nhất
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'mkt_max',  max(m.mkt_30ngay),
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
  -- Sự cố: đang mở (view) + mở/đóng trong kỳ + MTTR (bảng gốc su_co).
  -- CẦN XÁC NHẬN: tên bảng su_co, cột bat_dau/ket_thuc, mã trạng thái đóng.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'dang_mo', (select count(*) from xem_su_co_dang_mo),
      'mo_trong_ky', (
        select count(*) from su_co c
        where c.bat_dau::date between p_tu and p_den
      ),
      'dong_trong_ky', (
        select count(*) from su_co c
        where c.ket_thuc is not null
          and c.ket_thuc::date between p_tu and p_den
          and c.trang_thai in ('DA_KHAC_PHUC','IPC_BINH_THUONG','DONG_TU_DONG')
      ),
      'mttr_gio', (
        select round(avg(extract(epoch from (c.ket_thuc - c.bat_dau)) / 3600.0)::numeric, 1)
        from su_co c
        where c.ket_thuc is not null
          and c.ket_thuc::date between p_tu and p_den
      ),
      'mo_ky_truoc', (
        select count(*) from su_co c
        where c.bat_dau::date between v_tu_truoc and v_den_truoc
      ),
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
  -- Baseline 7n vs 30n + xu hướng slope/R² đáng chú ý (job đêm đã tính).
  -- CẦN XÁC NHẬN toàn bộ tên cột 2 bảng này.
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'scope_type',    b.scope_type,
           'scope_id',      b.scope_id,
           'sensor_type',   b.sensor_type,
           'tb_7ngay',      b.tb_7ngay,
           'tb_baseline',   b.tb_baseline,
           'chenh_lech_pct',b.chenh_lech_pct,
           'danh_gia',      b.danh_gia
         ) order by abs(coalesce(b.chenh_lech_pct,0)) desc), '[]'::jsonb)
  into v_baseline
  from (
    select * from so_sanh_baseline
    order by abs(coalesce(chenh_lech_pct, 0)) desc
    limit 10
  ) b;

  select coalesce(jsonb_agg(jsonb_build_object(
           'scope_type',  x.scope_type,
           'scope_id',    x.scope_id,
           'sensor_type', x.sensor_type,
           'slope',       x.du_lieu->'slope',
           'r2',          x.du_lieu->'r2',
           'spc',         x.du_lieu->'spc'
         )), '[]'::jsonb)
  into v_xu_huong
  from (
    select * from dac_trung_xu_huong
    where (du_lieu->>'r2')::numeric >= 0.5           -- chỉ xu hướng "đáng chú ý"
    order by abs((du_lieu->>'slope')::numeric) desc nulls last
    limit 10
  ) x;

  -- ------------------------------------------------------------------
  -- Nhận định AI gần nhất (đã qua Writer–Judge ở WF3)
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'tao_luc',      a.tao_luc,
      'noi_dung',     a.noi_dung_phan_tich,
      'muc_canh_bao', a.muc_canh_bao,
      'model_dung',   a.model_dung,       -- CẦN XÁC NHẬN cột (từ rpc_luu_bao_cao_ai_wf)
      'trang_thai_ai',a.trang_thai_ai     -- CẦN XÁC NHẬN cột
    )
  into v_ai
  from bao_cao_ai a
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
    'top_phong_rui_ro',     coalesce(v_top_phong, '[]'::jsonb),
    'spc',                  coalesce(v_spc, '{}'::jsonb),
    'mkt',                  coalesce(v_mkt, '{}'::jsonb),
    'su_co',                coalesce(v_su_co, '{}'::jsonb),
    'so_sanh_baseline',     coalesce(v_baseline, '[]'::jsonb),
    'xu_huong_dang_chu_y',  coalesce(v_xu_huong, '[]'::jsonb),
    'nhan_dinh_ai_gan_nhat',coalesce(v_ai, 'null'::jsonb),
    'tao_luc',              now(),
    'nguon',                'rpc_bao_cao_tong_hop'   -- truy vết GMP: footer báo cáo in dòng này
  );
end;
$$;

comment on function public.rpc_bao_cao_tong_hop(text, date, date) is
  'BẢN NHÁP B1 (KE-HOACH-NANG-CAP-BIEU-DO-BAO-CAO): 1 JSON duy nhất cho báo cáo '
  'tuần/tháng/quý (WF5 v2). Mọi con số báo cáo truy vết về hàm này. '
  'Kỳ trước = cùng độ dài cửa sổ, liền kề trước p_tu (tính delta). '
  'CẦN đối chiếu tên cột kpi_ngay/su_co/so_sanh_baseline/dac_trung_xu_huong trước khi apply.';

-- Báo cáo chạy server-side từ n8n (service_role) — KHÔNG cấp cho anon/authenticated.
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from public;
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from anon;
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from authenticated;
grant execute on function public.rpc_bao_cao_tong_hop(text, date, date) to service_role;
