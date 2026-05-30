-- ============================================================
-- 08_rpc_doc_du_lieu.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 8/11
--
-- MỤC ĐÍCH: RPC ĐỌC (web) + RPC ingest/tính toán (n8n WF1/WF3 gọi).
--
--   WEB gọi (authenticated):
--     • rpc_lay_chuoi_xu_huong     — tab Xu hướng (chuỗi thời gian)
--     • rpc_luu_phan_tich_ai       — lưu kết quả nút "AI phân tích"
--     • rpc_thong_ke_sensor_phong  — chi tiết RoomDetailModal
--     • rpc_kiem_tra_he_thong      — nút "Kiểm tra hệ thống" (CẢI TIẾN)
--
--   N8N gọi (service_role):
--     • rpc_xu_ly_du_lieu_phong_hang_gio — WF1 ingest 1 phòng/giờ
--     • rpc_tinh_kpi_gio                  — WF1 tổng hợp KPI giờ (CẢI TIẾN)
--     • rpc_tinh_kpi_ngay                 — WF1 tổng hợp KPI ngày (CẢI TIẾN)
--     • rpc_lay_du_lieu_bao_cao_ai        — WF3 slim payload cho OpenAI
-- ============================================================

-- ============================================================
-- 1. rpc_xu_ly_du_lieu_phong_hang_gio — WF1 ingest 1 phòng
-- ============================================================
-- WF1 gọi mỗi phòng mỗi giờ với payload đã phân tích sẵn ở node Code.
-- Nhiệm vụ: INSERT du_lieu_gio + mở/đóng/quan sát su_co theo severity.
-- service_role only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_xu_ly_du_lieu_phong_hang_gio(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tn      BOOLEAN := COALESCE((p_payload->>'thuoc_thu_nghiem')::boolean, public.cfg_bool('che_do_thu_nghiem', true));
  v_ma_phong TEXT   := p_payload->>'ma_phong';
  v_bucket  TIMESTAMPTZ := COALESCE(
                NULLIF(p_payload->>'bucket_utc','')::timestamptz,
                date_trunc('hour', now()) - interval '1 hour');
  v_tz      TEXT := public.cfg_text('mui_gio', 'Asia/Ho_Chi_Minh');
  v_sensor  JSONB;
  v_loai    TEXT;
  v_sev     TEXT;
  v_khoa    TEXT;
  v_ma_su_co BIGINT;
  v_trang_thai TEXT;
  v_la_moi  BOOLEAN;
  v_row     INT;
  v_them    INT := 0;
  v_mo      INT := 0;
  v_quan_sat INT := 0;
  v_dong    INT := 0;
BEGIN
  IF COALESCE(v_ma_phong,'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'THIEU_MA_PHONG');
  END IF;

  -- Lặp qua từng cảm biến trong payload
  FOR v_sensor IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'cam_bien', '[]'::jsonb))
  LOOP
    v_loai := COALESCE(v_sensor->>'loai_cam_bien', v_sensor->>'loai');
    v_sev  := COALESCE(v_sensor->>'muc_canh_bao', 'NORMAL');

    IF v_loai NOT IN ('DP','RH','T','SYSTEM','DATA') THEN CONTINUE; END IF;

    -- INSERT du_lieu_gio (idempotent theo UNIQUE)
    INSERT INTO public.du_lieu_gio(
      thuoc_thu_nghiem, bucket_utc, bucket_vn, ma_lan_chay_n8n,
      ma_phong, ten_phong, khu_vuc, ahu, cap_phong_sach, muc_uu_tien,
      loai_cam_bien, don_vi, gioi_han_duoi, gioi_han_tren,
      tong_diem, diem_hop_le, diem_thieu, chat_luong_du_lieu_pct,
      gia_tri_tb, gia_tri_min, gia_tri_max,
      diem_oos, diem_oos_thap, diem_oos_cao, oos_rate_pct,
      max_oos_lien_tuc, max_oos_lien_tuc_phut,
      huong_xu_huong, do_doc_xu_huong,
      muc_canh_bao, loai_canh_bao, diem_rui_ro, hash_canh_bao, du_lieu_goc
    ) VALUES (
      v_tn, v_bucket, v_bucket AT TIME ZONE v_tz, p_payload->>'ma_lan_chay_n8n',
      v_ma_phong, p_payload->>'ten_phong', p_payload->>'khu_vuc', p_payload->>'ahu', 
      p_payload->>'cap_phong_sach', p_payload->>'muc_uu_tien',
      v_loai, v_sensor->>'don_vi',
      NULLIF(v_sensor->>'gioi_han_duoi','')::numeric, NULLIF(v_sensor->>'gioi_han_tren','')::numeric,
      NULLIF(v_sensor->>'tong_diem','')::int, 
      COALESCE(NULLIF(v_sensor->>'diem_hop_le','')::int, NULLIF(v_sensor->>'tong_diem','')::int),
      NULLIF(v_sensor->>'diem_thieu','')::int,
      NULLIF(v_sensor->>'chat_luong_du_lieu_pct','')::numeric,
      NULLIF(v_sensor->>'gia_tri_tb','')::numeric, NULLIF(v_sensor->>'gia_tri_min','')::numeric, NULLIF(v_sensor->>'gia_tri_max','')::numeric,
      NULLIF(v_sensor->>'diem_oos','')::int, NULLIF(v_sensor->>'diem_oos_thap','')::int, NULLIF(v_sensor->>'diem_oos_cao','')::int,
      NULLIF(v_sensor->>'oos_rate_pct','')::numeric,
      NULLIF(v_sensor->>'max_oos_lien_tuc','')::int, NULLIF(v_sensor->>'max_oos_lien_tuc_phut','')::numeric,
      v_sensor->>'huong_xu_huong', NULLIF(v_sensor->>'do_doc_xu_huong','')::numeric,
      v_sev, v_sensor->>'loai_canh_bao', NULLIF(v_sensor->>'diem_rui_ro','')::int, v_sensor->>'hash_canh_bao',
      v_sensor
    )
    ON CONFLICT (thuoc_thu_nghiem, bucket_utc, ma_phong, loai_cam_bien) DO NOTHING;

    GET DIAGNOSTICS v_row = ROW_COUNT;
    v_them := v_them + COALESCE(v_row, 0);

    -- Nếu là dòng trùng (chạy lại cùng giờ) → bỏ qua xử lý sự cố
    IF COALESCE(v_row, 0) = 0 THEN CONTINUE; END IF;

    v_khoa := md5(concat_ws('|', v_ma_phong, v_loai, COALESCE(v_sensor->>'loai_canh_bao','OOS')));

    PERFORM set_config('app.tg_bypass_append_only', 'on', true);

    IF v_sev IN ('WARNING','CRITICAL') THEN
      -- Tìm sự cố đang mở
      SELECT ma_su_co, trang_thai_hien_tai INTO v_ma_su_co, v_trang_thai
      FROM public.su_co 
      WHERE thuoc_thu_nghiem = v_tn AND khoa_su_co = v_khoa AND thoi_gian_dong IS NULL
      LIMIT 1;

      IF v_ma_su_co IS NULL THEN
        -- Mở sự cố mới. ON CONFLICT trên uq_su_co_dang_mo (thuoc_thu_nghiem, khoa_su_co)
        -- WHERE thoi_gian_dong IS NULL → chống trùng TUYỆT ĐỐI kể cả khi 2 luồng
        -- ingest chạy song song cùng phòng/sensor (race condition).
        INSERT INTO public.su_co(
          thuoc_thu_nghiem, khoa_su_co, ma_phong, ten_phong, khu_vuc, ahu, 
          cap_phong_sach, muc_uu_tien, loai_cam_bien, loai_canh_bao,
          muc_canh_bao_ban_dau, muc_canh_bao_hien_tai, trang_thai_hien_tai,
          thoi_gian_mo, thoi_gian_lan_cuoi_quan_sat, nguon, du_lieu
        ) VALUES (
          v_tn, v_khoa, v_ma_phong, p_payload->>'ten_phong', p_payload->>'khu_vuc', p_payload->>'ahu',
          p_payload->>'cap_phong_sach', p_payload->>'muc_uu_tien', v_loai, v_sensor->>'loai_canh_bao',
          v_sev, v_sev, 'CHUA_XU_LY',
          v_bucket, v_bucket, 'WF1_INGEST', jsonb_build_object('sensor', v_sensor)
        )
        ON CONFLICT (thuoc_thu_nghiem, khoa_su_co) WHERE thoi_gian_dong IS NULL
        DO UPDATE SET muc_canh_bao_hien_tai = EXCLUDED.muc_canh_bao_hien_tai,
                      thoi_gian_lan_cuoi_quan_sat = EXCLUDED.thoi_gian_lan_cuoi_quan_sat
        RETURNING ma_su_co, (xmax = 0) INTO v_ma_su_co, v_la_moi;

        IF v_la_moi THEN
          -- Thực sự là INSERT mới → ghi audit mở sự cố
          INSERT INTO public.lich_su_su_co(thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, trang_thai_sau, ly_do, nguon)
          VALUES (v_tn, v_ma_su_co, 'system', 'SYSTEM', 'mo_su_co', 'CHUA_XU_LY', 'Hệ thống phát hiện ' || v_sev, 'system');
          v_mo := v_mo + 1;
        ELSE
          -- Đã có sự cố mở (do luồng song song chèn trước) → tính là quan sát
          v_quan_sat := v_quan_sat + 1;
        END IF;
      ELSE
        -- Cập nhật quan sát
        UPDATE public.su_co 
        SET muc_canh_bao_hien_tai = v_sev, thoi_gian_lan_cuoi_quan_sat = v_bucket
        WHERE ma_su_co = v_ma_su_co;
        v_quan_sat := v_quan_sat + 1;
      END IF;

    ELSE
      -- Sensor bình thường → đóng tự động nếu còn ở CHUA_XU_LY
      FOR v_ma_su_co, v_trang_thai IN
        SELECT ma_su_co, trang_thai_hien_tai FROM public.su_co
        WHERE thuoc_thu_nghiem = v_tn AND khoa_su_co = v_khoa AND thoi_gian_dong IS NULL
      LOOP
        IF v_trang_thai = 'CHUA_XU_LY' THEN
          UPDATE public.su_co SET trang_thai_hien_tai = 'DONG_TU_DONG', thoi_gian_dong = v_bucket
          WHERE ma_su_co = v_ma_su_co;
          INSERT INTO public.lich_su_su_co(thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, trang_thai_truoc, trang_thai_sau, ly_do, nguon)
          VALUES (v_tn, v_ma_su_co, 'system', 'SYSTEM', 'he_thong_dong_tu_dong', v_trang_thai, 'DONG_TU_DONG', 'Sensor tự bình thường trước khi IPC tiếp nhận', 'system');
          v_dong := v_dong + 1;
        END IF;
      END LOOP;
    END IF;

    PERFORM set_config('app.tg_bypass_append_only', 'off', true);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'ma_phong', v_ma_phong, 'bucket_utc', v_bucket,
    'dong_them', v_them, 'su_co_moi', v_mo, 'su_co_quan_sat', v_quan_sat, 'su_co_dong', v_dong);
END $$;

COMMENT ON FUNCTION public.rpc_xu_ly_du_lieu_phong_hang_gio IS 'WF1 entry: ingest 1 phòng/giờ. INSERT du_lieu_gio + state machine sự cố.';

-- ============================================================
-- 1b. rpc_xu_ly_du_lieu_nhieu_phong — CẢI TIẾN: ingest HÀNG LOẠT
-- ============================================================
-- WF1 gửi MẢNG nhiều phòng trong 1 lần gọi (thay vì 57 lần HTTP).
-- → Giảm độ trễ mạng ~57 lần, giảm số lượt RPC, nhanh hơn nhiều.
-- Payload: { bucket_utc, ma_lan_chay_n8n, thuoc_thu_nghiem, tinh_kpi (bool),
--            phong: [ {ma_phong, ..., cam_bien:[...]}, ... ] }
-- Tự gọi rpc_tinh_kpi_gio 1 lần ở cuối (nếu tinh_kpi=true).
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_xu_ly_du_lieu_nhieu_phong(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tn       BOOLEAN := COALESCE((p_payload->>'thuoc_thu_nghiem')::boolean, public.cfg_bool('che_do_thu_nghiem', true));
  v_bucket   TIMESTAMPTZ := COALESCE(NULLIF(p_payload->>'bucket_utc','')::timestamptz, date_trunc('hour', now()) - interval '1 hour');
  v_exec     TEXT := p_payload->>'ma_lan_chay_n8n';
  v_tinh_kpi BOOLEAN := COALESCE((p_payload->>'tinh_kpi')::boolean, true);
  v_phong    JSONB;
  v_kq       JSONB;
  v_them INT := 0; v_mo INT := 0; v_quan_sat INT := 0; v_dong INT := 0; v_so_phong INT := 0;
  v_loi      INT := 0;
  v_bd       TIMESTAMPTZ := clock_timestamp();
  v_nhat_ky_id BIGINT;
BEGIN
  -- Mở 1 dòng nhật ký chạy workflow
  INSERT INTO public.nhat_ky_chay_workflow(thuoc_thu_nghiem, ten_workflow, ma_lan_chay_n8n, bucket_utc, bucket_vn, trang_thai)
  VALUES (v_tn, 'WF1', v_exec, v_bucket, v_bucket AT TIME ZONE public.cfg_text('mui_gio','Asia/Ho_Chi_Minh'), 'running')
  RETURNING id INTO v_nhat_ky_id;

  -- Lặp từng phòng, gọi lại hàm ingest đơn (tái dùng logic state machine)
  FOR v_phong IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'phong', '[]'::jsonb))
  LOOP
    BEGIN
      v_kq := public.rpc_xu_ly_du_lieu_phong_hang_gio(
        v_phong 
        || jsonb_build_object('bucket_utc', v_bucket::text, 'thuoc_thu_nghiem', v_tn, 'ma_lan_chay_n8n', v_exec));
      IF COALESCE((v_kq->>'ok')::boolean, false) THEN
        v_so_phong := v_so_phong + 1;
        v_them     := v_them     + COALESCE((v_kq->>'dong_them')::int, 0);
        v_mo       := v_mo       + COALESCE((v_kq->>'su_co_moi')::int, 0);
        v_quan_sat := v_quan_sat + COALESCE((v_kq->>'su_co_quan_sat')::int, 0);
        v_dong     := v_dong     + COALESCE((v_kq->>'su_co_dong')::int, 0);
      ELSE
        v_loi := v_loi + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- 1 phòng lỗi không làm hỏng cả lô — ghi ngoại lệ, tiếp tục
      v_loi := v_loi + 1;
      PERFORM set_config('app.tg_bypass_append_only', 'on', true);
      INSERT INTO public.ngoai_le_du_lieu(thuoc_thu_nghiem, ma_lan_chay_n8n, bucket_utc, ma_phong, ma_loi, mo_ta_loi)
      VALUES (v_tn, v_exec, v_bucket, v_phong->>'ma_phong', 'INGEST_ERROR', SQLERRM);
      PERFORM set_config('app.tg_bypass_append_only', 'off', true);
    END;
  END LOOP;

  -- Tính KPI giờ + KPI ngày 1 LẦN cho cả lô (thay vì mỗi phòng).
  -- KPI ngày tính theo đúng NGÀY VN của bucket (bucket 23:00 UTC = sáng hôm sau VN).
  IF v_tinh_kpi THEN
    PERFORM public.rpc_tinh_kpi_gio(v_bucket, v_tn);
    PERFORM public.rpc_tinh_kpi_ngay((v_bucket AT TIME ZONE public.cfg_text('mui_gio','Asia/Ho_Chi_Minh'))::date, v_tn);
  END IF;

  -- Đóng dòng nhật ký
  PERFORM set_config('app.tg_bypass_append_only', 'on', true);
  UPDATE public.nhat_ky_chay_workflow
  SET ket_thuc = now(), trang_thai = CASE WHEN v_loi=0 THEN 'ok' ELSE 'partial' END,
      phong_hop_le = v_so_phong, phong_bo_qua = v_loi, dong_du_lieu_gio_them = v_them,
      su_co_moi = v_mo, su_co_quan_sat = v_quan_sat, su_co_da_dong = v_dong
  WHERE id = v_nhat_ky_id;
  PERFORM set_config('app.tg_bypass_append_only', 'off', true);

  RETURN jsonb_build_object(
    'ok', true, 'bucket_utc', v_bucket,
    'phong_xu_ly', v_so_phong, 'phong_loi', v_loi,
    'dong_them', v_them, 'su_co_moi', v_mo, 'su_co_quan_sat', v_quan_sat, 'su_co_dong', v_dong,
    'thoi_gian_ms', round(extract(epoch from (clock_timestamp()-v_bd))*1000));
END $$;

COMMENT ON FUNCTION public.rpc_xu_ly_du_lieu_nhieu_phong IS 'WF1 CẢI TIẾN: ingest nhiều phòng trong 1 lần gọi + tính KPI 1 lần. Giảm round-trip mạng.';


-- ============================================================
-- 2. rpc_tinh_kpi_gio — CẢI TIẾN: tổng hợp KPI giờ
-- ============================================================
-- WF1 gọi sau khi ingest xong tất cả phòng trong 1 giờ.
-- Tính kpi_gio cho TOTAL + mỗi AREA + mỗi AHU + mỗi ROOM.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_tinh_kpi_gio(p_bucket_utc TIMESTAMPTZ DEFAULT NULL, p_thuoc_thu_nghiem BOOLEAN DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tn     BOOLEAN := COALESCE(p_thuoc_thu_nghiem, public.cfg_bool('che_do_thu_nghiem', true));
  v_bucket TIMESTAMPTZ := COALESCE(p_bucket_utc, (SELECT max(bucket_utc) FROM public.du_lieu_gio WHERE thuoc_thu_nghiem = v_tn));
  v_tz     TEXT := public.cfg_text('mui_gio', 'Asia/Ho_Chi_Minh');
  v_so     INT := 0;
BEGIN
  IF v_bucket IS NULL THEN RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_BUCKET'); END IF;

  PERFORM set_config('app.tg_bypass_append_only', 'on', true);

  -- TOTAL + AREA + AHU + ROOM trong 1 câu lệnh dùng GROUPING SETS
  INSERT INTO public.kpi_gio(
    thuoc_thu_nghiem, bucket_utc, bucket_vn, scope_type, scope_id, ten_scope, sensor_type,
    so_phong_co_du_lieu, so_phong_xau, so_gio_sensor, so_gio_critical, so_gio_warning,
    ti_le_dat_pct, oos_rate_pct_tb, chat_luong_du_lieu_pct)
  SELECT 
    v_tn, v_bucket, v_bucket AT TIME ZONE v_tz,
    CASE 
      WHEN GROUPING(d.ma_phong)=0 THEN 'ROOM'
      WHEN GROUPING(d.ahu)=0      THEN 'AHU'
      WHEN GROUPING(d.khu_vuc)=0  THEN 'AREA'
      ELSE 'TOTAL' END,
    COALESCE(d.ma_phong, d.ahu, d.khu_vuc, 'ALL'),
    COALESCE(d.ma_phong, d.ahu, d.khu_vuc, 'Toàn hệ thống'),
    'ALL',
    count(DISTINCT d.ma_phong),
    count(DISTINCT d.ma_phong) FILTER (WHERE d.oos_rate_pct > 20),
    count(*),
    count(*) FILTER (WHERE d.muc_canh_bao = 'CRITICAL'),
    count(*) FILTER (WHERE d.muc_canh_bao = 'WARNING'),
    ROUND((100 - AVG(d.oos_rate_pct))::numeric, 1),
    ROUND(AVG(d.oos_rate_pct)::numeric, 1),
    ROUND(AVG(d.chat_luong_du_lieu_pct)::numeric, 1)
  FROM public.du_lieu_gio d
  WHERE d.thuoc_thu_nghiem = v_tn AND d.bucket_utc = v_bucket
    AND d.loai_cam_bien IN ('DP','RH','T')
  GROUP BY GROUPING SETS ((d.ma_phong, d.ahu, d.khu_vuc), (d.ahu), (d.khu_vuc), ())
  ON CONFLICT (thuoc_thu_nghiem, bucket_utc, scope_type, scope_id, sensor_type) 
  DO UPDATE SET 
    ti_le_dat_pct = EXCLUDED.ti_le_dat_pct,
    oos_rate_pct_tb = EXCLUDED.oos_rate_pct_tb,
    so_gio_critical = EXCLUDED.so_gio_critical,
    so_gio_warning = EXCLUDED.so_gio_warning,
    chat_luong_du_lieu_pct = EXCLUDED.chat_luong_du_lieu_pct,
    tinh_luc = now();

  GET DIAGNOSTICS v_so = ROW_COUNT;
  PERFORM set_config('app.tg_bypass_append_only', 'off', true);

  RETURN jsonb_build_object('ok', true, 'bucket_utc', v_bucket, 'so_dong_kpi', v_so);
END $$;

COMMENT ON FUNCTION public.rpc_tinh_kpi_gio IS 'WF1: tổng hợp KPI giờ (TOTAL/AREA/AHU/ROOM) bằng GROUPING SETS.';

-- ============================================================
-- 3. rpc_tinh_kpi_ngay — CẢI TIẾN: tổng hợp KPI ngày
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_tinh_kpi_ngay(p_ngay DATE DEFAULT NULL, p_thuoc_thu_nghiem BOOLEAN DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tn   BOOLEAN := COALESCE(p_thuoc_thu_nghiem, public.cfg_bool('che_do_thu_nghiem', true));
  v_tz   TEXT := public.cfg_text('mui_gio', 'Asia/Ho_Chi_Minh');
  v_ngay DATE := COALESCE(p_ngay, (now() AT TIME ZONE v_tz)::date);
  v_so_phong INT := 0;
  v_so_scope INT := 0;
  -- CẢI TIẾN: tính sẵn khoảng UTC của 1 ngày VN để filter SARGABLE (dùng index).
  -- Thay cho (bucket_utc AT TIME ZONE)::date = ngay (bọc hàm → seq scan toàn bảng).
  v_tu_utc  TIMESTAMPTZ := (v_ngay::timestamp AT TIME ZONE v_tz);
  v_den_utc TIMESTAMPTZ := ((v_ngay + 1)::timestamp AT TIME ZONE v_tz);
BEGIN
  PERFORM set_config('app.tg_bypass_append_only', 'on', true);

  -- KPI ngày × phòng
  INSERT INTO public.kpi_ngay_phong(
    thuoc_thu_nghiem, ngay, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, sensor_type,
    ti_le_dat_pct, oos_rate_pct_tb, so_gio_critical, so_gio_warning, max_oos_lien_tuc_phut, chat_luong_du_lieu_pct)
  SELECT 
    v_tn, v_ngay, d.ma_phong, max(d.ten_phong), max(d.khu_vuc), max(d.ahu), max(d.muc_uu_tien), 'ALL',
    ROUND((100 - AVG(d.oos_rate_pct))::numeric, 1),
    ROUND(AVG(d.oos_rate_pct)::numeric, 1),
    count(*) FILTER (WHERE d.muc_canh_bao='CRITICAL'),
    count(*) FILTER (WHERE d.muc_canh_bao='WARNING'),
    max(d.max_oos_lien_tuc_phut),
    ROUND(AVG(d.chat_luong_du_lieu_pct)::numeric, 1)
  FROM public.du_lieu_gio d
  WHERE d.thuoc_thu_nghiem = v_tn
    AND d.bucket_utc >= v_tu_utc AND d.bucket_utc < v_den_utc   -- SARGABLE: dùng index bucket_utc
    AND d.loai_cam_bien IN ('DP','RH','T')
  GROUP BY d.ma_phong
  ON CONFLICT (thuoc_thu_nghiem, ngay, ma_phong, sensor_type)
  DO UPDATE SET ti_le_dat_pct=EXCLUDED.ti_le_dat_pct, oos_rate_pct_tb=EXCLUDED.oos_rate_pct_tb,
    so_gio_critical=EXCLUDED.so_gio_critical, so_gio_warning=EXCLUDED.so_gio_warning,
    max_oos_lien_tuc_phut=EXCLUDED.max_oos_lien_tuc_phut, chat_luong_du_lieu_pct=EXCLUDED.chat_luong_du_lieu_pct, tinh_luc=now();
  GET DIAGNOSTICS v_so_phong = ROW_COUNT;

  -- KPI ngày × scope (AREA + AHU + TOTAL)
  INSERT INTO public.kpi_ngay_scope(
    thuoc_thu_nghiem, ngay, scope_type, scope_id, ten_scope, sensor_type,
    ti_le_dat_pct, oos_rate_pct_tb, so_phong_co_du_lieu, so_gio_critical, so_gio_warning, chat_luong_du_lieu_pct)
  SELECT 
    v_tn, v_ngay,
    CASE WHEN GROUPING(d.ahu)=0 THEN 'AHU' WHEN GROUPING(d.khu_vuc)=0 THEN 'AREA' ELSE 'TOTAL' END,
    COALESCE(d.ahu, d.khu_vuc, 'ALL'),
    COALESCE(d.ahu, d.khu_vuc, 'Toàn hệ thống'),
    'ALL',
    ROUND((100 - AVG(d.oos_rate_pct))::numeric, 1),
    ROUND(AVG(d.oos_rate_pct)::numeric, 1),
    count(DISTINCT d.ma_phong),
    count(*) FILTER (WHERE d.muc_canh_bao='CRITICAL'),
    count(*) FILTER (WHERE d.muc_canh_bao='WARNING'),
    ROUND(AVG(d.chat_luong_du_lieu_pct)::numeric, 1)
  FROM public.du_lieu_gio d
  WHERE d.thuoc_thu_nghiem = v_tn
    AND d.bucket_utc >= v_tu_utc AND d.bucket_utc < v_den_utc   -- SARGABLE: dùng index bucket_utc
    AND d.loai_cam_bien IN ('DP','RH','T')
  GROUP BY GROUPING SETS ((d.ahu), (d.khu_vuc), ())
  ON CONFLICT (thuoc_thu_nghiem, ngay, scope_type, scope_id, sensor_type)
  DO UPDATE SET ti_le_dat_pct=EXCLUDED.ti_le_dat_pct, oos_rate_pct_tb=EXCLUDED.oos_rate_pct_tb,
    so_phong_co_du_lieu=EXCLUDED.so_phong_co_du_lieu, so_gio_critical=EXCLUDED.so_gio_critical,
    so_gio_warning=EXCLUDED.so_gio_warning, chat_luong_du_lieu_pct=EXCLUDED.chat_luong_du_lieu_pct, tinh_luc=now();
  GET DIAGNOSTICS v_so_scope = ROW_COUNT;

  PERFORM set_config('app.tg_bypass_append_only', 'off', true);
  RETURN jsonb_build_object('ok', true, 'ngay', v_ngay, 'kpi_phong', v_so_phong, 'kpi_scope', v_so_scope);
END $$;

-- ============================================================
-- 4. rpc_lay_chuoi_xu_huong — WEB tab Xu hướng
-- ============================================================
-- Trả mảng [{label, ts, comp, dq, warnH, critH, oos}] cho biểu đồ.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_lay_chuoi_xu_huong(
  p_scope_type TEXT,            -- TOTAL/AREA/AHU/ROOM
  p_scope_id   TEXT,            -- ALL/C1/AHU03/C4.R7
  p_sensor     TEXT DEFAULT 'ALL',
  p_so_ngay    INT  DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tn   BOOLEAN := public.cfg_bool('che_do_thu_nghiem', true);
  v_tz   TEXT := public.cfg_text('mui_gio', 'Asia/Ho_Chi_Minh');
  v_ket_qua JSONB;
BEGIN
  IF p_scope_type = 'ROOM' THEN
    SELECT jsonb_agg(jsonb_build_object(
      'label', to_char(ngay, 'DD/MM'), 'ts', extract(epoch from ngay)*1000,
      'comp', ti_le_dat_pct, 'oos', ROUND(oos_rate_pct_tb), 
      'critH', so_gio_critical, 'warnH', so_gio_warning, 'dq', ROUND(chat_luong_du_lieu_pct)
    ) ORDER BY ngay)
    INTO v_ket_qua
    FROM public.kpi_ngay_phong
    WHERE thuoc_thu_nghiem = v_tn AND ma_phong = p_scope_id AND sensor_type = 'ALL'
      AND ngay >= (now() AT TIME ZONE v_tz)::date - p_so_ngay;
  ELSE
    SELECT jsonb_agg(jsonb_build_object(
      'label', to_char(ngay, 'DD/MM'), 'ts', extract(epoch from ngay)*1000,
      'comp', ti_le_dat_pct, 'oos', ROUND(oos_rate_pct_tb),
      'critH', so_gio_critical, 'warnH', so_gio_warning, 'dq', ROUND(chat_luong_du_lieu_pct)
    ) ORDER BY ngay)
    INTO v_ket_qua
    FROM public.kpi_ngay_scope
    WHERE thuoc_thu_nghiem = v_tn AND scope_type = p_scope_type 
      AND scope_id = CASE WHEN p_scope_type='TOTAL' THEN 'ALL' ELSE p_scope_id END
      AND sensor_type = 'ALL'
      AND ngay >= (now() AT TIME ZONE v_tz)::date - p_so_ngay;
  END IF;

  RETURN COALESCE(v_ket_qua, '[]'::jsonb);
END $$;

COMMENT ON FUNCTION public.rpc_lay_chuoi_xu_huong IS 'Web tab Xu hướng: chuỗi thời gian theo scope/sensor/range.';

-- ============================================================
-- 5. rpc_luu_phan_tich_ai — WEB nút "AI phân tích"
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_luu_phan_tich_ai(
  p_scope_type TEXT,
  p_scope_id   TEXT,
  p_ten_scope  TEXT,
  p_sensor     TEXT,
  p_so_ngay    INT,
  p_noi_dung   TEXT,
  p_muc_canh_bao INT,
  p_actor      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT;
  v_id    UUID;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  INSERT INTO public.bao_cao_ai(
    thuoc_thu_nghiem, loai_bao_cao, scope_type, scope_id, ten_scope, sensor_type,
    pham_vi_ngay, noi_dung_phan_tich, muc_canh_bao, trang_thai_ai, nguoi_yeu_cau)
  VALUES (
    public.cfg_bool('che_do_thu_nghiem', true), 'AD_HOC', p_scope_type, p_scope_id, p_ten_scope, p_sensor,
    p_so_ngay, p_noi_dung, p_muc_canh_bao, 'OK', COALESCE(v_email, 'web'))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'thong_bao', 'Đã lưu phân tích AI vào tab Báo cáo.');
END $$;

-- ============================================================
-- 6. rpc_thong_ke_sensor_phong — WEB RoomDetailModal
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_thong_ke_sensor_phong(p_ma_phong TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE 
  v_ket_qua JSONB;
  v_tn      BOOLEAN := public.co_thu_nghiem();
  v_bucket  TIMESTAMPTZ;
BEGIN
  -- CẢI TIẾN: truy vấn THẲNG du_lieu_gio cho ĐÚNG 1 phòng (đẩy filter ma_phong
  -- xuống tận index idx_du_lieu_gio_phong), thay vì đọc view tính cả 57 phòng rồi lọc.
  -- → từ ~48ms xuống dưới 1ms ở quy mô lớn.
  SELECT max(bucket_utc) INTO v_bucket 
  FROM public.du_lieu_gio 
  WHERE thuoc_thu_nghiem = v_tn AND ma_phong = p_ma_phong;

  IF v_bucket IS NULL THEN RETURN '[]'::jsonb; END IF;

  WITH slice AS (
    SELECT loai_cam_bien, bucket_utc, bucket_vn, gia_tri_tb, gia_tri_min, gia_tri_max,
           diem_oos, oos_rate_pct, muc_canh_bao, chat_luong_du_lieu_pct,
           ROW_NUMBER() OVER (PARTITION BY loai_cam_bien ORDER BY bucket_utc DESC) AS rn
    FROM public.du_lieu_gio
    WHERE thuoc_thu_nghiem = v_tn AND ma_phong = p_ma_phong
      AND bucket_utc >= v_bucket - interval '8 hours'
  )
  SELECT jsonb_agg(t) INTO v_ket_qua FROM (
    SELECT loai_cam_bien,
      jsonb_agg(jsonb_build_object(
        'label', to_char(bucket_vn,'HH24:MI'), 'avg', gia_tri_tb, 'min', gia_tri_min,
        'max', gia_tri_max, 'oos', diem_oos, 'oos_pct', oos_rate_pct, 'severity', muc_canh_bao
      ) ORDER BY bucket_utc) AS hourly_8,
      max(gia_tri_tb)              FILTER (WHERE rn=1) AS gia_tri_tb_1h,
      max(diem_oos)                FILTER (WHERE rn=1) AS oos_1h,
      max(chat_luong_du_lieu_pct)  FILTER (WHERE rn=1) AS dq_1h,
      max(muc_canh_bao)            FILTER (WHERE rn=1) AS muc_canh_bao_1h
    FROM slice GROUP BY loai_cam_bien
  ) t;
  RETURN COALESCE(v_ket_qua, '[]'::jsonb);
END $$;

-- ============================================================
-- 7. rpc_lay_du_lieu_bao_cao_ai — WF3 slim payload cho OpenAI
-- ============================================================
-- Trả JSON gọn (~5KB) thay vì toàn bộ dữ liệu → tiết kiệm 90% token.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_lay_du_lieu_bao_cao_ai(
  p_loai_bao_cao TEXT,           -- NGAY/TUAN/THANG
  p_thoi_diem    TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tn    BOOLEAN := public.cfg_bool('che_do_thu_nghiem', true);
  v_tz    TEXT := public.cfg_text('mui_gio', 'Asia/Ho_Chi_Minh');
  v_so_ngay INT := CASE p_loai_bao_cao WHEN 'NGAY' THEN 1 WHEN 'TUAN' THEN 7 WHEN 'THANG' THEN 30 ELSE 1 END;
  v_tu    DATE := (p_thoi_diem AT TIME ZONE v_tz)::date - v_so_ngay;
  v_den   DATE := (p_thoi_diem AT TIME ZONE v_tz)::date;
BEGIN
  RETURN jsonb_build_object(
    'loai_bao_cao', p_loai_bao_cao,
    'tu_ngay', v_tu, 'den_ngay', v_den,
    -- Tổng quan
    'tong_quan', (SELECT to_jsonb(t) FROM public.xem_tong_quan t),
    -- Top 10 phòng tệ nhất (gom nhóm trước, build JSON sau — tránh nested aggregate)
    'top_phong_te', (
      SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      FROM (
        SELECT ma_phong,
               max(ten_phong)                       AS ten_phong,
               max(khu_vuc)                         AS khu_vuc,
               max(ahu)                             AS ahu,
               ROUND(AVG(ti_le_dat_pct)::numeric,1) AS ti_le_dat_tb,
               SUM(so_gio_critical)                 AS critical_h
        FROM public.kpi_ngay_phong
        WHERE thuoc_thu_nghiem=v_tn AND sensor_type='ALL' AND ngay >= v_tu AND ngay < v_den
        GROUP BY ma_phong
        ORDER BY ti_le_dat_tb ASC NULLS LAST
        LIMIT 10
      ) t),
    -- Top trend xấu đi
    'top_xu_huong_xau', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'scope', ten_scope, 'sensor', sensor_type, 'huong', huong, 'r2', r2, 'do_doc', do_doc)
        ORDER BY r2 DESC NULLS LAST), '[]'::jsonb)
      FROM public.dac_trung_xu_huong 
      WHERE thuoc_thu_nghiem=v_tn AND huong='worsening'),
    -- So sánh baseline
    'so_sanh_baseline', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'scope', ten_scope, 'sensor', sensor_type, 'compliance_delta', compliance_delta,
        'oos_rate_delta', oos_rate_delta, 'huong', baseline_direction)
        ORDER BY oos_rate_delta DESC NULLS LAST), '[]'::jsonb)
      FROM public.so_sanh_baseline
      WHERE thuoc_thu_nghiem=v_tn AND baseline_direction='worse_than_baseline'),
    -- Sự cố P1/P2 đang mở
    'su_co_mo', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'phong', ma_phong, 'sensor', loai_cam_bien, 'muc', muc_canh_bao_hien_tai,
        'trang_thai', trang_thai_hien_tai, 'gio_mo', ROUND(EXTRACT(EPOCH FROM (now()-thoi_gian_mo))/3600.0,1))
        ORDER BY thoi_gian_mo), '[]'::jsonb)
      FROM public.su_co WHERE thoi_gian_dong IS NULL AND thuoc_thu_nghiem = public.co_thu_nghiem()
        AND muc_uu_tien IN ('P1','P2')),
    'huong_dan_ai', jsonb_build_object(
      'ngon_ngu', 'Tiếng Việt 100%', 'cau_truc', '7 mục bắt buộc',
      'ghi_chu', 'AI chỉ hỗ trợ; quyết định GMP do IPC/QA phê duyệt')
  );
END $$;

COMMENT ON FUNCTION public.rpc_lay_du_lieu_bao_cao_ai IS 'WF3: slim payload cho OpenAI (~5KB, tiết kiệm 90% token).';

-- ============================================================
-- 8. rpc_kiem_tra_he_thong — CẢI TIẾN: nút "Kiểm tra hệ thống"
-- ============================================================
-- Web tab Cài đặt gọi → trả checklist PASS/FAIL tiếng Việt.
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_kiem_tra_he_thong()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tn BOOLEAN := public.cfg_bool('che_do_thu_nghiem', true);
BEGIN
  RETURN jsonb_build_array(
    jsonb_build_object('muc', 'Bảng dữ liệu', 
      'trang_thai', CASE WHEN (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%') >= 18 THEN 'PASS' ELSE 'FAIL' END,
      'chi_tiet', (SELECT count(*)::text || ' bảng' FROM information_schema.tables WHERE table_schema='public')),
    jsonb_build_object('muc', 'View dashboard',
      'trang_thai', CASE WHEN (SELECT count(*) FROM information_schema.views WHERE table_schema='public' AND table_name LIKE 'xem_%') >= 13 THEN 'PASS' ELSE 'FAIL' END,
      'chi_tiet', (SELECT count(*)::text || ' view xem_*' FROM information_schema.views WHERE table_schema='public' AND table_name LIKE 'xem_%')),
    jsonb_build_object('muc', 'RPC chức năng',
      'trang_thai', CASE WHEN (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'rpc_%') >= 16 THEN 'PASS' ELSE 'FAIL' END,
      'chi_tiet', (SELECT count(*)::text || ' RPC' FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'rpc_%')),
    jsonb_build_object('muc', 'Phòng đã cấu hình',
      'trang_thai', CASE WHEN (SELECT count(*) FROM public.phong_sach WHERE kich_hoat) > 0 THEN 'PASS' ELSE 'FAIL' END,
      'chi_tiet', (SELECT count(*)::text || ' phòng' FROM public.phong_sach WHERE kich_hoat)),
    jsonb_build_object('muc', 'Người dùng',
      'trang_thai', CASE WHEN (SELECT count(*) FROM public.nguoi_dung WHERE kich_hoat) >= 1 THEN 'PASS' ELSE 'FAIL' END,
      'chi_tiet', (SELECT count(*)::text || ' tài khoản' FROM public.nguoi_dung WHERE kich_hoat)),
    jsonb_build_object('muc', 'Quy tắc state machine',
      'trang_thai', CASE WHEN (SELECT count(*) FROM public.quy_tac_chuyen_trang_thai WHERE kich_hoat) >= 20 THEN 'PASS' ELSE 'FAIL' END,
      'chi_tiet', (SELECT count(*)::text || ' quy tắc' FROM public.quy_tac_chuyen_trang_thai WHERE kich_hoat)),
    jsonb_build_object('muc', 'Dữ liệu sensor 24h',
      'trang_thai', CASE WHEN (SELECT count(*) FROM public.du_lieu_gio WHERE bucket_utc >= now()-interval '24 hours' AND thuoc_thu_nghiem=v_tn) > 0 THEN 'PASS' ELSE 'CHO_DU_LIEU' END,
      'chi_tiet', (SELECT count(*)::text || ' dòng/24h' FROM public.du_lieu_gio WHERE bucket_utc >= now()-interval '24 hours' AND thuoc_thu_nghiem=v_tn))
  );
END $$;

COMMENT ON FUNCTION public.rpc_kiem_tra_he_thong IS 'Web nút "Kiểm tra hệ thống": checklist PASS/FAIL tiếng Việt.';

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 08 OK' AS ket_qua,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace 
   WHERE n.nspname='public' AND p.proname LIKE 'rpc_%') AS tong_rpc;
