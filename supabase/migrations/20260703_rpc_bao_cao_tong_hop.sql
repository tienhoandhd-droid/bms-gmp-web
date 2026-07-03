-- ============================================================================
-- BẢN NHÁP v2 — cần đối chiếu tên cột với schema thật (\d kpi_ngay, \d su_co,
-- \d so_sanh_baseline, \d dac_trung_xu_huong, \d bao_cao_ai, \d ngoai_le_du_lieu,
-- \d cam_bien, \d phong, \d+ xem_spc_canh_bao, \d+ xem_mkt_phong,
-- \d+ xem_su_co_dang_mo) TRƯỚC KHI APPLY.
--
-- v2 (03/07/2026) THÊM các khóa JSON: top_phong_tot, phong_xau_bat_thuong,
-- xu_huong (nha_may/theo_khu/theo_ahu), do_phu_du_lieu, ngoai_le,
-- mkt.mkt_max_phong + mkt.ich_q1a, gioi_han_tham_chieu.
-- GIỮ NGUYÊN mọi khóa của v1 (top_phong_rui_ro = khái niệm "top phòng xấu").
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
--                         → GIẢ ĐỊNH MỚI (v2, cho xu_huong.theo_ahu): cấp AHU có
--                           scope_id = mã AHU; cấp AREA có scope_id = mã khu
--                           (C1/C4/Q2…) — theo mục 2.2 LO-TRINH-NANG-CAP
--                           ("Cấp TOTAL/AREA/AHU/ROOM × sensor").
--   xem_spc_canh_bao    : scope_type, scope_id, ten_scope, sensor_type,
--                         muc_tieu, sigma, in_control (bool), so_tin_hieu (int),
--                         cac_loai (text)  ← ĐÃ đối chiếu với web/src/lib/supabaseData.js
--                         → GIẢ ĐỊNH (v2): view KHÔNG có cột thời gian, nên
--                           "tín hiệu SPC MỚI trong kỳ" (phong_xau_bat_thuong)
--                           xấp xỉ bằng "HIỆN đang ngoài kiểm soát" (job đêm
--                           bms-spc-dem tính trên chuỗi 30 ngày gần nhất);
--                           cấp ROOM có scope_id = ma_phong.
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
--                         → GIẢ ĐỊNH (v2): cấp ROOM có scope_id = ma_phong;
--                           slope tính trên hồi quy 30 ngày, đơn vị điểm-%/ngày.
--   bao_cao_ai          : id, tao_luc, ten_scope, sensor_type, pham_vi_ngay,
--                         noi_dung_phan_tich, muc_canh_bao, model_dung, trang_thai_ai
--
-- CỘT GIẢ ĐỊNH MỚI TRONG v2 (chưa đối chiếu schema thật — CẦN XÁC NHẬN):
--   ngoai_le_du_lieu    : loai (text: SENSOR_DUNG_HINH / FMS_HTTP_LOI / …),
--                         ma_phong (text), bat_dau (timestamptz),
--                         ket_thuc (timestamptz, NULL nếu đang mở), mo_ta (text)
--                         — bảng do WF1 ghi (mục 1.2/1.4 LO-TRINH-NANG-CAP);
--                           tên cột đoán theo quy ước, CẦN \d ngoai_le_du_lieu.
--   cam_bien            : ma_phong, loai_cam_bien (DP/RH/T), gioi_han_duoi,
--                         gioi_han_tren, don_vi
--                         — đối chiếu GIÁN TIẾP qua view xem_phong_co_kpi
--                           (supabaseData.js trả mảng cam_bien cùng tên cột);
--                           tên BẢNG GỐC cần xác nhận. Nếu khác, sửa khối
--                           gioi_han_tham_chieu (hoặc thay bằng ghi chú tĩnh
--                           "giới hạn cấu hình theo từng phòng").
--   phong               : ma_phong, ten_phong, khu_vuc, muc_uu_tien
--                         (v1 mới dùng ten_phong/khu_vuc; v2 dùng thêm muc_uu_tien)
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
  v_top_phong   jsonb;   -- top 5 phòng XẤU (rủi ro)
  v_top_phong_tot jsonb; -- v2: top 5 phòng TỐT
  v_phong_xau   jsonb;   -- v2: phòng xấu đi BẤT THƯỜNG trong kỳ
  v_xu_huong    jsonb;   -- v2: chuỗi tuân thủ ngày nha_may/theo_khu/theo_ahu
  v_do_phu      jsonb;   -- v2: độ phủ dữ liệu (data integrity)
  v_ngoai_le    jsonb;   -- v2: ngoại lệ thu thập dữ liệu trong kỳ
  v_gioi_han    jsonb;   -- v2: giới hạn tham chiếu theo mức ưu tiên phòng
  v_spc         jsonb;
  v_mkt         jsonb;
  v_su_co       jsonb;
  v_baseline    jsonb;
  v_xu_huong_chu_y jsonb; -- (v1 đặt tên v_xu_huong — đổi tên, khóa JSON giữ nguyên)
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
  -- (Khóa v1, GIỮ NGUYÊN hình dạng object-map; v2 thêm khóa 'xu_huong' dạng
  --  mảng chuẩn hoá bên dưới — consumer mới nên dùng 'xu_huong'.)
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
  -- v2: XU HƯỚNG chuẩn hoá — tuân thủ theo NGÀY: toàn nhà máy, từng khu,
  -- từng AHU. GIẢ ĐỊNH kpi_ngay có scope_type in (TOTAL/AREA/AHU/ROOM)
  -- với scope_id lần lượt = 'ALL' / mã khu / mã AHU / mã phòng.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'nha_may', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
                 'ty_le', round(k.ti_le_dat_pct::numeric, 2))
               order by k.ngay)
        from kpi_ngay k
        where k.scope_type = 'TOTAL' and k.scope_id = 'ALL'
          and k.sensor_type = 'ALL'                -- CẦN XÁC NHẬN
          and k.ngay between p_tu and p_den
      ), '[]'::jsonb),
      'theo_khu', coalesce((
        select jsonb_agg(jsonb_build_object('khu_vuc', a.khu, 'chuoi', a.chuoi)
               order by a.khu)
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
      ), '[]'::jsonb),
      'theo_ahu', coalesce((
        select jsonb_agg(jsonb_build_object('ahu', h.ahu, 'chuoi', h.chuoi)
               order by h.ahu)
        from (
          select k.scope_id as ahu,
                 jsonb_agg(jsonb_build_object(
                   'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
                   'ty_le', round(k.ti_le_dat_pct::numeric, 2))
                 order by k.ngay) as chuoi
          from kpi_ngay k
          where k.scope_type = 'AHU'               -- GIẢ ĐỊNH cấp AHU tồn tại
            and k.sensor_type = 'ALL'              -- CẦN XÁC NHẬN
            and k.ngay between p_tu and p_den
          group by k.scope_id
        ) h
      ), '[]'::jsonb)
    )
  into v_xu_huong;

  -- ------------------------------------------------------------------
  -- Top 5 phòng XẤU (rủi ro) trong kỳ (tuân thủ trung bình thấp nhất,
  -- ưu tiên nhiều giờ OOS) + chuỗi ngày từng phòng cho sparkline.
  -- GIẢ ĐỊNH: bảng phong(ma_phong, ten_phong, khu_vuc) — CẦN XÁC NHẬN tên bảng.
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'ma_phong',       t.ma_phong,
           'ten_phong',      coalesce(p.ten_phong, t.ma_phong),
           'khu_vuc',        p.khu_vuc,
           'ty_le_tuan_thu', round(t.tb::numeric, 2),
           'so_gio_oos',     round(t.oos::numeric, 1),
           'so_ngay_co_du_lieu', t.so_ngay,
           'chuoi_ngay',     t.chuoi
         ) order by t.tb asc nulls last, t.oos desc), '[]'::jsonb)
  into v_top_phong
  from (
    select k.scope_id as ma_phong,
           avg(k.ti_le_dat_pct)          as tb,
           coalesce(sum(k.so_gio_oos),0) as oos,
           count(*)                      as so_ngay,
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
  -- v2: Top 5 phòng TỐT nhất kỳ (tuân thủ cao nhất; đồng hạng → ít giờ OOS
  -- hơn xếp trên). Cùng hình dạng với top_phong_rui_ro. Kèm
  -- so_ngay_co_du_lieu để người đọc tự cân nhắc phòng ít dữ liệu.
  -- ------------------------------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'ma_phong',       t.ma_phong,
           'ten_phong',      coalesce(p.ten_phong, t.ma_phong),
           'khu_vuc',        p.khu_vuc,
           'ty_le_tuan_thu', round(t.tb::numeric, 2),
           'so_gio_oos',     round(t.oos::numeric, 1),
           'so_ngay_co_du_lieu', t.so_ngay,
           'chuoi_ngay',     t.chuoi
         ) order by t.tb desc nulls last, t.oos asc), '[]'::jsonb)
  into v_top_phong_tot
  from (
    select k.scope_id as ma_phong,
           avg(k.ti_le_dat_pct)          as tb,
           coalesce(sum(k.so_gio_oos),0) as oos,
           count(*)                      as so_ngay,
           jsonb_agg(jsonb_build_object(
             'ngay', to_char(k.ngay, 'YYYY-MM-DD'),
             'ty_le', round(k.ti_le_dat_pct::numeric, 2))
           order by k.ngay)              as chuoi
    from kpi_ngay k
    where k.scope_type = 'ROOM'
      and k.sensor_type = 'ALL'                    -- CẦN XÁC NHẬN
      and k.ngay between p_tu and p_den
    group by k.scope_id
    order by avg(k.ti_le_dat_pct) desc nulls last, coalesce(sum(k.so_gio_oos),0) asc
    limit 5
  ) t
  left join phong p on p.ma_phong = t.ma_phong;    -- CẦN XÁC NHẬN tên bảng phong

  -- ------------------------------------------------------------------
  -- v2 (QUAN TRỌNG): PHÒNG XẤU ĐI BẤT THƯỜNG trong kỳ — 1 phòng lọt danh
  -- sách nếu THỎA ÍT NHẤT 1 trong 3 tiêu chí:
  --   (a) tuân thủ TB kỳ này giảm ≥ 5 điểm % so kỳ trước cùng độ dài;
  --   (b) có tín hiệu SPC ngoài kiểm soát (xem_spc_canh_bao, in_control=false,
  --       cấp ROOM) — XẤP XỈ "tín hiệu mới" vì view không có cột thời gian;
  --   (c) xu hướng giảm tin cậy: dac_trung_xu_huong cấp ROOM có
  --       slope < 0 và R² ≥ 0.5 (nhiều sensor → lấy slope xấu nhất).
  -- ly_do[] ghi rõ tiêu chí nào kích hoạt (truy vết GMP). Giới hạn 20 phòng,
  -- xếp theo delta xấu nhất trước.
  -- ------------------------------------------------------------------
  with nay as (
    select k.scope_id as ma_phong, avg(k.ti_le_dat_pct) as tb
    from kpi_ngay k
    where k.scope_type = 'ROOM' and k.sensor_type = 'ALL'   -- CẦN XÁC NHẬN
      and k.ngay between p_tu and p_den
    group by k.scope_id
  ),
  truoc as (
    select k.scope_id as ma_phong, avg(k.ti_le_dat_pct) as tb
    from kpi_ngay k
    where k.scope_type = 'ROOM' and k.sensor_type = 'ALL'   -- CẦN XÁC NHẬN
      and k.ngay between v_tu_truoc and v_den_truoc
    group by k.scope_id
  ),
  spc_phong as (
    select s.scope_id as ma_phong, sum(s.so_tin_hieu)::int as so_tin_hieu
    from xem_spc_canh_bao s
    where s.scope_type = 'ROOM' and s.in_control = false
    group by s.scope_id
  ),
  xh_phong as (
    select distinct on (x.scope_id)
           x.scope_id                      as ma_phong,
           (x.du_lieu->>'slope')::numeric  as slope,
           (x.du_lieu->>'r2')::numeric     as r2
    from dac_trung_xu_huong x
    where x.scope_type = 'ROOM'
      and (x.du_lieu->>'slope') is not null
      and (x.du_lieu->>'r2')    is not null
      and (x.du_lieu->>'slope')::numeric < 0
      and (x.du_lieu->>'r2')::numeric   >= 0.5
    order by x.scope_id, (x.du_lieu->>'slope')::numeric asc  -- slope xấu nhất/phòng
  ),
  hop as (
    select ma_phong,
           n.tb              as tb_nay,
           t.tb              as tb_truoc,
           (n.tb - t.tb)     as delta,
           s.so_tin_hieu,
           x.slope, x.r2
    from nay n
    full join truoc     t using (ma_phong)
    full join spc_phong s using (ma_phong)
    full join xh_phong  x using (ma_phong)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'ma_phong',           h.ma_phong,
           'ten_phong',          coalesce(p.ten_phong, h.ma_phong),
           'khu_vuc',            p.khu_vuc,
           'tuan_thu_ky_nay',    round(h.tb_nay::numeric, 2),
           'tuan_thu_ky_truoc',  round(h.tb_truoc::numeric, 2),
           'delta',              round(h.delta::numeric, 2),
           'so_tin_hieu_spc',    coalesce(h.so_tin_hieu, 0),
           'slope',              h.slope,
           'r2',                 h.r2,
           'ly_do', (
             select coalesce(jsonb_agg(r), '[]'::jsonb)
             from unnest(array[
               case when h.delta <= -5 then
                 format('Tuân thủ giảm %s điểm %% so kỳ trước (%s%% → %s%%)',
                        round(abs(h.delta)::numeric, 1),
                        round(h.tb_truoc::numeric, 1), round(h.tb_nay::numeric, 1)) end,
               case when coalesce(h.so_tin_hieu, 0) > 0 then
                 format('%s tín hiệu SPC ngoài kiểm soát (xem_spc_canh_bao)',
                        h.so_tin_hieu) end,
               case when h.slope is not null then
                 format('Xu hướng giảm tin cậy: slope=%s điểm %%/ngày (R²=%s ≥ 0.5)',
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
  left join phong p on p.ma_phong = h.ma_phong;    -- CẦN XÁC NHẬN tên bảng phong

  -- ------------------------------------------------------------------
  -- v2: ĐỘ PHỦ DỮ LIỆU (data integrity — ALCOA+): DQ trung bình kỳ,
  -- số ngày trong kỳ KHÔNG có bản ghi kpi_ngay cấp TOTAL, và 5 phòng
  -- DQ thấp nhất kỳ.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'dq_tb_pct', (
        select round(avg(k.dq_pct)::numeric, 2)
        from kpi_ngay k
        where k.scope_type = 'TOTAL' and k.scope_id = 'ALL'
          and k.sensor_type = 'ALL'                -- CẦN XÁC NHẬN
          and k.ngay between p_tu and p_den
      ),
      'so_ngay_thieu', v_so_ngay - (
        select count(distinct k.ngay)
        from kpi_ngay k
        where k.scope_type = 'TOTAL' and k.scope_id = 'ALL'
          and k.sensor_type = 'ALL'                -- CẦN XÁC NHẬN
          and k.ngay between p_tu and p_den
      ),
      'phong_thieu_nhat', coalesce((
        select jsonb_agg(jsonb_build_object('ma_phong', r.ma_phong, 'dq_pct', r.dq)
               order by r.dq asc nulls first)
        from (
          select k.scope_id as ma_phong,
                 round(avg(k.dq_pct)::numeric, 2) as dq
          from kpi_ngay k
          where k.scope_type = 'ROOM'
            and k.sensor_type = 'ALL'              -- CẦN XÁC NHẬN
            and k.ngay between p_tu and p_den
          group by k.scope_id
          order by avg(k.dq_pct) asc nulls first
          limit 5
        ) r
      ), '[]'::jsonb)
    )
  into v_do_phu;

  -- ------------------------------------------------------------------
  -- v2: NGOẠI LỆ THU THẬP DỮ LIỆU trong kỳ (bảng ngoai_le_du_lieu do WF1 ghi:
  -- SENSOR_DUNG_HINH, FMS_HTTP_LOI, …). GIẢ ĐỊNH cột: loai, ma_phong,
  -- bat_dau, ket_thuc, mo_ta — CẦN XÁC NHẬN (\d ngoai_le_du_lieu).
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'tong_so', count(*),
      'theo_loai', coalesce((
        select jsonb_agg(jsonb_build_object('loai', g.loai, 'so_lan', g.so_lan)
               order by g.so_lan desc)
        from (
          select e.loai, count(*) as so_lan
          from ngoai_le_du_lieu e
          where e.bat_dau::date between p_tu and p_den
          group by e.loai
        ) g
      ), '[]'::jsonb),
      'chi_tiet', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'loai',     e.loai,
                 'ma_phong', e.ma_phong,
                 'bat_dau',  e.bat_dau,
                 'ket_thuc', e.ket_thuc,
                 'mo_ta',    e.mo_ta)
               order by e.bat_dau desc)
        from (
          select * from ngoai_le_du_lieu
          where bat_dau::date between p_tu and p_den
          order by bat_dau desc
          limit 10
        ) e
      ), '[]'::jsonb)
    )
  into v_ngoai_le
  from ngoai_le_du_lieu e0
  where e0.bat_dau::date between p_tu and p_den;

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
  -- MKT 30 ngày (view đã đối chiếu với web) — top 10 MKT cao nhất.
  -- v2: thêm mkt_max_phong (phòng có MKT cao nhất) + ich_q1a (ghi chú
  -- phương pháp — truy vết GMP).
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'mkt_max',       max(m.mkt_30ngay),
      'mkt_max_phong', (array_agg(m.ma_phong order by m.mkt_30ngay desc))[1],
      'ich_q1a',       'MKT tính tất định theo ICH Q1A (Arrhenius; ΔH cấu hình '
                       'tại cau_hinh.mkt_delta_h_kj, mặc định 83.144 kJ/mol; '
                       'cửa sổ 30 ngày — nguồn: rpc_tinh_mkt / xem_mkt_phong). '
                       'MKT luôn ≥ trung bình cộng.',
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
  into v_xu_huong_chu_y
  from (
    select * from dac_trung_xu_huong
    where (du_lieu->>'r2')::numeric >= 0.5           -- chỉ xu hướng "đáng chú ý"
    order by abs((du_lieu->>'slope')::numeric) desc nulls last
    limit 10
  ) x;

  -- ------------------------------------------------------------------
  -- v2: GIỚI HẠN THAM CHIẾU — các mức giới hạn (GHD–GHT) DISTINCT đang
  -- cấu hình, gộp theo mức ưu tiên phòng × loại cảm biến, kèm số phòng
  -- áp dụng. Giới hạn THỰC TẾ cấu hình theo TỪNG PHÒNG (bảng cam_bien);
  -- bảng này chỉ để báo cáo tham chiếu nhanh.
  -- GIẢ ĐỊNH: cam_bien(ma_phong, loai_cam_bien, gioi_han_duoi, gioi_han_tren,
  -- don_vi) + phong(ma_phong, muc_uu_tien) — CẦN XÁC NHẬN tên bảng/cột.
  -- ------------------------------------------------------------------
  select jsonb_build_object(
      'ghi_chu', 'Giới hạn cảnh báo (GHD–GHT) cấu hình theo TỪNG PHÒNG trong '
                 'bảng cam_bien; dưới đây là các mức DISTINCT gộp theo mức ưu '
                 'tiên phòng × loại cảm biến. Số liệu OOS trong báo cáo luôn '
                 'tính theo giới hạn riêng của từng phòng.',
      'danh_sach', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'muc_uu_tien',   g.muc_uu_tien,
                 'loai_cam_bien', g.loai_cam_bien,
                 'gioi_han_duoi', g.gioi_han_duoi,
                 'gioi_han_tren', g.gioi_han_tren,
                 'don_vi',        g.don_vi,
                 'so_phong',      g.so_phong)
               order by g.muc_uu_tien, g.loai_cam_bien, g.gioi_han_duoi)
        from (
          select p.muc_uu_tien, c.loai_cam_bien,
                 c.gioi_han_duoi, c.gioi_han_tren, c.don_vi,
                 count(distinct c.ma_phong) as so_phong
          from cam_bien c                          -- CẦN XÁC NHẬN tên bảng
          left join phong p on p.ma_phong = c.ma_phong
          group by p.muc_uu_tien, c.loai_cam_bien,
                   c.gioi_han_duoi, c.gioi_han_tren, c.don_vi
        ) g
      ), '[]'::jsonb)
    )
  into v_gioi_han;

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
    'top_phong_rui_ro',     coalesce(v_top_phong, '[]'::jsonb),      -- = "top phòng xấu"
    'top_phong_tot',        coalesce(v_top_phong_tot, '[]'::jsonb),  -- v2
    'phong_xau_bat_thuong', coalesce(v_phong_xau, '[]'::jsonb),      -- v2
    'xu_huong',             coalesce(v_xu_huong, '{}'::jsonb),       -- v2
    'do_phu_du_lieu',       coalesce(v_do_phu, '{}'::jsonb),         -- v2
    'ngoai_le',             coalesce(v_ngoai_le,
                              jsonb_build_object('tong_so', 0,
                                'theo_loai', '[]'::jsonb,
                                'chi_tiet',  '[]'::jsonb)),          -- v2
    'gioi_han_tham_chieu',  coalesce(v_gioi_han, '{}'::jsonb),       -- v2
    'spc',                  coalesce(v_spc, '{}'::jsonb),
    'mkt',                  coalesce(v_mkt, '{}'::jsonb),            -- v2: +mkt_max_phong, +ich_q1a
    'su_co',                coalesce(v_su_co, '{}'::jsonb),
    'so_sanh_baseline',     coalesce(v_baseline, '[]'::jsonb),
    'xu_huong_dang_chu_y',  coalesce(v_xu_huong_chu_y, '[]'::jsonb),
    'nhan_dinh_ai_gan_nhat',coalesce(v_ai, 'null'::jsonb),
    'tao_luc',              now(),
    'nguon',                'rpc_bao_cao_tong_hop'   -- truy vết GMP: footer báo cáo in dòng này
  );
end;
$$;

comment on function public.rpc_bao_cao_tong_hop(text, date, date) is
  'BẢN NHÁP B1 v2 (KE-HOACH-NANG-CAP-BIEU-DO-BAO-CAO): 1 JSON duy nhất cho báo cáo '
  'tuần/tháng/quý (WF5 v2). Mọi con số báo cáo truy vết về hàm này. '
  'Kỳ trước = cùng độ dài cửa sổ, liền kề trước p_tu (tính delta). '
  'v2 thêm: top_phong_tot, phong_xau_bat_thuong (delta ≤ -5 điểm / SPC / slope<0 với R²≥0.5), '
  'xu_huong (nha_may/theo_khu/theo_ahu), do_phu_du_lieu, ngoai_le, '
  'mkt.mkt_max_phong + mkt.ich_q1a, gioi_han_tham_chieu. '
  'CẦN đối chiếu tên cột kpi_ngay/su_co/so_sanh_baseline/dac_trung_xu_huong/'
  'ngoai_le_du_lieu/cam_bien/phong trước khi apply.';

-- Báo cáo chạy server-side từ n8n (service_role) — KHÔNG cấp cho anon/authenticated.
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from public;
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from anon;
revoke all on function public.rpc_bao_cao_tong_hop(text, date, date) from authenticated;
grant execute on function public.rpc_bao_cao_tong_hop(text, date, date) to service_role;
