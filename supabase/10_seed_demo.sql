-- ============================================================
-- 10_seed_demo.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 10/11
--
-- MỤC ĐÍCH: nạp dữ liệu DEMO khớp React mockup để web chạy ngay
-- mà chưa cần WF1/FMS. Gồm:
--   • 6 phòng (C4.R7, C1.R11, C4.R1, C1.R14, Q2.R8, C1.R5)
--   • 5 người dùng (mỗi vai trò 1)
--   • Cảm biến + giới hạn theo mức ưu tiên
--   • 8 giờ telemetry mô phỏng
--   • 6 sự cố demo (SC-1042 → SC-1028) với trạng thái khác nhau
--   • KPI ngày 30 ngày mô phỏng (cho tab Xu hướng)
--
-- ⚠️ CHỈ chạy ở môi trường TEST. Khi go-live PROD, KHÔNG chạy file này;
--    thay bằng dữ liệu thật từ WF1 + người dùng thật.
-- ============================================================

DO $$
BEGIN
  IF upper(public.cfg_text('moi_truong','TEST')) = 'PROD' THEN
    RAISE EXCEPTION 'AN TOÀN: Không nạp dữ liệu DEMO trên môi trường PROD.';
  END IF;
END $$;

-- ============================================================
-- 1. NGƯỜI DÙNG DEMO (khớp USERS trong mockup)
-- ============================================================
INSERT INTO public.nguoi_dung(email, ho_ten, vai_tro) VALUES
  ('nam.ipc@cpc1hn.vn',  'Nam',      'IPC'),
  ('codien@cpc1hn.vn',   'Tuấn',     'MEP'),
  ('lan.lot@cpc1hn.vn',  'Lan',      'LOT'),
  ('hoan.qa@cpc1hn.vn',  'Hoàn',     'QA'),
  ('admin@cpc1hn.vn',    'Quản trị', 'ADMIN')
ON CONFLICT (email) DO UPDATE SET ho_ten=EXCLUDED.ho_ten, vai_tro=EXCLUDED.vai_tro, kich_hoat=true;

-- ============================================================
-- 2. PHÒNG DEMO (khớp ROOM_SEED)
-- ============================================================
INSERT INTO public.phong_sach(ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, cap_phong_sach, mo_ta_chuc_nang, ghi_chu, thieu_du_lieu) VALUES
  ('C4.R7',  'Chiết rót',          'C4', 'AHU-K01', 'P1', 'B', 'Khu vô trùng trọng yếu', 'Khu vô trùng trọng yếu', false),
  ('C1.R11', 'Pha chế',            'C1', 'AHU03',   'P1', 'B', 'Pha chế dung dịch', NULL, false),
  ('C4.R1',  'Thay đồ',            'C4', 'AHU-K01', 'P1', 'C', 'Phòng thay trang phục', NULL, false),
  ('C1.R14', 'Hành lang',          'C1', 'AHU01',   'P3', 'D', 'Hành lang sạch', 'Sensor đang lỗi', true),
  ('Q2.R8',  'Khu Q2 — Chiết',     'Q2', 'AHU04',   'P2', 'C', 'Chiết rót khu Q2', NULL, false),
  ('C1.R5',  'Phòng sạch chung',   'C1', 'AHU02',   'P2', 'C', 'Phòng sạch dùng chung', NULL, false)
ON CONFLICT (ma_phong) DO UPDATE SET 
  ten_phong=EXCLUDED.ten_phong, khu_vuc=EXCLUDED.khu_vuc, ahu=EXCLUDED.ahu,
  muc_uu_tien=EXCLUDED.muc_uu_tien, thieu_du_lieu=EXCLUDED.thieu_du_lieu, kich_hoat=true;

-- ============================================================
-- 3. CẢM BIẾN DEMO (giới hạn theo mức ưu tiên — như defSensors mockup)
-- ============================================================
-- P1: DP≥12.5, P2: DP≥10, P3: DP≥8. RH 30-55 (P3:60). T 18-24 (P3:25).
DO $$
DECLARE
  r RECORD;
  v_dp_min NUMERIC;
  v_rh_max NUMERIC;
  v_t_max  NUMERIC;
BEGIN
  FOR r IN SELECT ma_phong, muc_uu_tien, thieu_du_lieu FROM public.phong_sach WHERE kich_hoat LOOP
    -- Phòng thiếu dữ liệu: không thêm cảm biến
    IF r.thieu_du_lieu THEN CONTINUE; END IF;

    v_dp_min := CASE r.muc_uu_tien WHEN 'P1' THEN 12.5 WHEN 'P2' THEN 10 ELSE 8 END;
    v_rh_max := CASE r.muc_uu_tien WHEN 'P3' THEN 60 ELSE 55 END;
    v_t_max  := CASE r.muc_uu_tien WHEN 'P3' THEN 25 ELSE 24 END;

    INSERT INTO public.cam_bien(ma_phong, loai_cam_bien, don_vi, gioi_han_duoi, gioi_han_tren) VALUES
      (r.ma_phong, 'DP', 'Pa',  v_dp_min, 30),
      (r.ma_phong, 'RH', '%',   30,       v_rh_max),
      (r.ma_phong, 'T',  '°C',  18,       v_t_max)
    ON CONFLICT (ma_phong, loai_cam_bien) DO UPDATE SET 
      gioi_han_duoi=EXCLUDED.gioi_han_duoi, gioi_han_tren=EXCLUDED.gioi_han_tren, kich_hoat=true;
  END LOOP;
END $$;

-- ============================================================
-- 4. TELEMETRY 8 GIỜ MÔ PHỎNG (cho RoomCard hourly + KPI giờ)
-- ============================================================
-- Bias DP theo phòng giống ROOM_BIAS trong mockup → 1 số phòng OOS.
DO $$
DECLARE
  r RECORD;
  c RECORD;
  h INT;
  v_bucket TIMESTAMPTZ;
  v_tz TEXT := 'Asia/Ho_Chi_Minh';
  v_center NUMERIC;
  v_bias NUMERIC;
  v_avg NUMERIC;
  v_oos INT;
  v_oos_rate NUMERIC;
  v_sev TEXT;
  v_seed INT;
BEGIN
  PERFORM set_config('app.tg_bypass_append_only', 'on', true);

  FOR r IN SELECT * FROM public.phong_sach WHERE kich_hoat AND NOT thieu_du_lieu LOOP
    FOR c IN SELECT * FROM public.cam_bien WHERE ma_phong = r.ma_phong AND kich_hoat LOOP
      -- Bias DP để tạo OOS ở phòng P1
      v_bias := CASE 
        WHEN c.loai_cam_bien='DP' AND r.ma_phong='C4.R7'  THEN -3.2
        WHEN c.loai_cam_bien='DP' AND r.ma_phong='C1.R11' THEN -2.0
        WHEN c.loai_cam_bien='DP' AND r.ma_phong='C4.R1'  THEN -0.8
        ELSE 0 END;
      v_center := CASE c.loai_cam_bien WHEN 'DP' THEN 14.0 WHEN 'RH' THEN 48 ELSE 21.5 END + v_bias;

      FOR h IN 0..7 LOOP
        v_bucket := date_trunc('hour', now()) - (h || ' hours')::interval;
        v_seed := abs(hashtext(r.ma_phong || c.loai_cam_bien || h::text)) % 100;
        v_avg := ROUND((v_center + (v_seed - 50) * 0.04)::numeric, 1);

        -- Tính OOS dựa trên giới hạn
        v_oos := CASE 
          WHEN c.gioi_han_duoi IS NOT NULL AND v_avg < c.gioi_han_duoi THEN (15 + v_seed % 30)
          WHEN c.gioi_han_tren IS NOT NULL AND v_avg > c.gioi_han_tren THEN (15 + v_seed % 30)
          ELSE (v_seed % 4) END;
        v_oos_rate := ROUND((v_oos / 60.0 * 100)::numeric, 1);

        v_sev := CASE 
          WHEN v_oos >= 12 AND v_oos % 10 >= 5 THEN 'CRITICAL'
          WHEN v_oos >= 12 THEN 'WARNING'
          WHEN v_oos >= 1 THEN 'NOTICE'
          ELSE 'NORMAL' END;

        INSERT INTO public.du_lieu_gio(
          thuoc_thu_nghiem, bucket_utc, bucket_vn, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, cap_phong_sach,
          loai_cam_bien, don_vi, gioi_han_duoi, gioi_han_tren,
          tong_diem, diem_hop_le, diem_thieu, chat_luong_du_lieu_pct,
          gia_tri_tb, gia_tri_min, gia_tri_max,
          diem_oos, oos_rate_pct, max_oos_lien_tuc, max_oos_lien_tuc_phut,
          muc_canh_bao, loai_canh_bao, du_lieu_goc)
        VALUES (
          true, v_bucket, v_bucket AT TIME ZONE v_tz, r.ma_phong, r.ten_phong, r.khu_vuc, r.ahu, r.muc_uu_tien, r.cap_phong_sach,
          c.loai_cam_bien, c.don_vi, c.gioi_han_duoi, c.gioi_han_tren,
          60, 60 - (v_seed % 3), v_seed % 3, ROUND((100 - (v_seed % 3) / 60.0 * 100)::numeric, 1),
          v_avg, v_avg - 1.2, v_avg + 1.2,
          v_oos, v_oos_rate, v_oos, v_oos,
          v_sev, CASE WHEN v_sev IN ('WARNING','CRITICAL') THEN 'OOS_' || c.loai_cam_bien ELSE NULL END,
          jsonb_build_object('demo', true))
        ON CONFLICT (thuoc_thu_nghiem, bucket_utc, ma_phong, loai_cam_bien) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  PERFORM set_config('app.tg_bypass_append_only', 'off', true);
END $$;

-- ============================================================
-- 5. SỰ CỐ DEMO (khớp INCIDENTS0 trong mockup)
-- ============================================================
DO $$
DECLARE
  v_id BIGINT;
BEGIN
  PERFORM set_config('app.tg_bypass_append_only', 'on', true);

  -- SC tương đương: dùng khoa_su_co md5 để chống trùng
  -- 1. C4.R7 DP — Chưa xử lý
  INSERT INTO public.su_co(thuoc_thu_nghiem, khoa_su_co, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, loai_cam_bien, loai_canh_bao, muc_canh_bao_ban_dau, muc_canh_bao_hien_tai, trang_thai_hien_tai, thoi_gian_mo, nguon)
  VALUES (true, md5('C4.R7|DP|OOS_DP'), 'C4.R7', 'Chiết rót', 'C4', 'AHU-K01', 'P1', 'DP', 'OOS_DP', 'CRITICAL', 'CRITICAL', 'CHUA_XU_LY', now() - interval '7.1 hours', 'WF1_INGEST')
  RETURNING ma_su_co INTO v_id;
  INSERT INTO public.lich_su_su_co(thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, trang_thai_sau, ly_do, nguon)
  VALUES (true, v_id, 'system', 'SYSTEM', 'mo_su_co', 'CHUA_XU_LY', 'Chênh áp nghiêm trọng (9.1 Pa < 12.5 Pa) — AHU-K01', 'system');

  -- 2. C1.R11 DP — Chưa xử lý
  INSERT INTO public.su_co(thuoc_thu_nghiem, khoa_su_co, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, loai_cam_bien, loai_canh_bao, muc_canh_bao_ban_dau, muc_canh_bao_hien_tai, trang_thai_hien_tai, thoi_gian_mo, nguon)
  VALUES (true, md5('C1.R11|DP|OOS_DP'), 'C1.R11', 'Pha chế', 'C1', 'AHU03', 'P1', 'DP', 'OOS_DP', 'CRITICAL', 'CRITICAL', 'CHUA_XU_LY', now() - interval '7.2 hours', 'WF1_INGEST')
  RETURNING ma_su_co INTO v_id;
  INSERT INTO public.lich_su_su_co(thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, trang_thai_sau, ly_do, nguon)
  VALUES (true, v_id, 'system', 'SYSTEM', 'mo_su_co', 'CHUA_XU_LY', 'Chênh áp nghiêm trọng (10.3 Pa) — AHU03', 'system');

  -- 3. C4.R1 DP — IPC bất thường
  INSERT INTO public.su_co(thuoc_thu_nghiem, khoa_su_co, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, loai_cam_bien, loai_canh_bao, muc_canh_bao_ban_dau, muc_canh_bao_hien_tai, trang_thai_hien_tai, thoi_gian_mo, nguon)
  VALUES (true, md5('C4.R1|DP|OOS_DP'), 'C4.R1', 'Thay đồ', 'C4', 'AHU-K01', 'P1', 'DP', 'OOS_DP', 'WARNING', 'WARNING', 'IPC_BAT_THUONG', now() - interval '4.8 hours', 'WF1_INGEST')
  RETURNING ma_su_co INTO v_id;
  INSERT INTO public.lich_su_su_co(thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, trang_thai_sau, ly_do, nguon) VALUES
    (true, v_id, 'system', 'SYSTEM', 'mo_su_co', 'CHUA_XU_LY', 'Chênh áp cảnh báo (11.8 Pa)', 'system'),
    (true, v_id, 'nam.ipc@cpc1hn.vn', 'IPC', 'ipc_bat_thuong', 'IPC_BAT_THUONG', 'Kiểm tra hiện trường, xác nhận bất thường', 'web');

  -- 4. C1.R11 RH — Cơ điện đang xử lý (khác khoa với DP ở trên)
  INSERT INTO public.su_co(thuoc_thu_nghiem, khoa_su_co, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, loai_cam_bien, loai_canh_bao, muc_canh_bao_ban_dau, muc_canh_bao_hien_tai, trang_thai_hien_tai, thoi_gian_mo, nguon)
  VALUES (true, md5('C1.R11|RH|OOS_RH'), 'C1.R11', 'Pha chế', 'C1', 'AHU03', 'P1', 'RH', 'OOS_RH', 'WARNING', 'WARNING', 'CO_DIEN_DANG_XU_LY', now() - interval '3.6 hours', 'WF1_INGEST')
  RETURNING ma_su_co INTO v_id;
  INSERT INTO public.lich_su_su_co(thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, trang_thai_sau, ly_do, nguon) VALUES
    (true, v_id, 'system', 'SYSTEM', 'mo_su_co', 'CHUA_XU_LY', 'Độ ẩm cảnh báo (56.9%)', 'system'),
    (true, v_id, 'nam.ipc@cpc1hn.vn', 'IPC', 'ipc_bat_thuong', 'IPC_BAT_THUONG', 'Xác nhận bất thường', 'web'),
    (true, v_id, 'nam.ipc@cpc1hn.vn', 'IPC', 'ipc_bao_co_dien', 'DA_BAO_CO_DIEN', 'Báo cơ điện', 'web'),
    (true, v_id, 'codien@cpc1hn.vn', 'MEP', 'mep_tiep_nhan', 'CO_DIEN_DANG_XU_LY', 'Tiếp nhận, kiểm tra bộ hút ẩm AHU03', 'web');

  -- 5. Q2.R8 DP — Đã báo cơ điện
  INSERT INTO public.su_co(thuoc_thu_nghiem, khoa_su_co, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, loai_cam_bien, loai_canh_bao, muc_canh_bao_ban_dau, muc_canh_bao_hien_tai, trang_thai_hien_tai, thoi_gian_mo, nguon)
  VALUES (true, md5('Q2.R8|DP|OOS_DP'), 'Q2.R8', 'Khu Q2 — Chiết', 'Q2', 'AHU04', 'P2', 'DP', 'OOS_DP', 'WARNING', 'WARNING', 'DA_BAO_CO_DIEN', now() - interval '3.0 hours', 'WF1_INGEST')
  RETURNING ma_su_co INTO v_id;
  INSERT INTO public.lich_su_su_co(thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, trang_thai_sau, ly_do, nguon) VALUES
    (true, v_id, 'nam.ipc@cpc1hn.vn', 'IPC', 'ipc_bao_co_dien', 'DA_BAO_CO_DIEN', 'Xác nhận bất thường — báo cơ điện AHU04', 'web');

  -- 6. C1.R14 DATA — thiếu dữ liệu, đã tắt cảnh báo
  INSERT INTO public.su_co(thuoc_thu_nghiem, khoa_su_co, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, loai_cam_bien, loai_canh_bao, muc_canh_bao_ban_dau, muc_canh_bao_hien_tai, trang_thai_hien_tai, thoi_gian_mo, da_tat_canh_bao, ly_do_tat_canh_bao, nguon)
  VALUES (true, md5('C1.R14|DATA|DATA_QUALITY'), 'C1.R14', 'Hành lang', 'C1', 'AHU01', 'P3', 'DATA', 'DATA_QUALITY', 'WARNING', 'WARNING', 'IPC_BAT_THUONG', now() - interval '6.1 hours', true, 'Sensor đang bảo trì', 'WF1_INGEST')
  RETURNING ma_su_co INTO v_id;
  INSERT INTO public.lich_su_su_co(thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, trang_thai_sau, ly_do, nguon) VALUES
    (true, v_id, 'system', 'SYSTEM', 'mo_su_co', 'CHUA_XU_LY', 'Sensor mất tín hiệu — DQ < 80%', 'system');

  PERFORM set_config('app.tg_bypass_append_only', 'off', true);
END $$;

-- ============================================================
-- 6. KPI NGÀY 30 NGÀY MÔ PHỎNG (cho tab Xu hướng)
-- ============================================================
DO $$
DECLARE
  r RECORD;
  d INT;
  v_ngay DATE;
  v_seed INT;
  v_comp NUMERIC;
  v_base NUMERIC;
BEGIN
  PERFORM set_config('app.tg_bypass_append_only', 'on', true);

  -- KPI ngày × phòng
  FOR r IN SELECT * FROM public.phong_sach WHERE kich_hoat AND NOT thieu_du_lieu LOOP
    v_base := CASE r.muc_uu_tien WHEN 'P1' THEN 62 WHEN 'P2' THEN 82 ELSE 90 END;
    FOR d IN 0..29 LOOP
      v_ngay := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - d;
      v_seed := abs(hashtext(r.ma_phong || d::text)) % 100;
      -- Xu hướng giảm dần cho phòng P1 (giống mockup)
      v_comp := GREATEST(40, LEAST(99, v_base + (v_seed - 50) * 0.2 + (CASE WHEN r.muc_uu_tien='P1' THEN -d*0.15 ELSE d*0.05 END)));

      INSERT INTO public.kpi_ngay_phong(thuoc_thu_nghiem, ngay, ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, sensor_type, ti_le_dat_pct, oos_rate_pct_tb, so_gio_critical, so_gio_warning, chat_luong_du_lieu_pct)
      VALUES (true, v_ngay, r.ma_phong, r.ten_phong, r.khu_vuc, r.ahu, r.muc_uu_tien, 'ALL', 
              ROUND(v_comp::numeric,1), ROUND((100-v_comp)::numeric,1), 
              GREATEST(0, (50-v_seed)/10)::int, GREATEST(0, (60-v_seed)/8)::int, ROUND((90 + v_seed%10)::numeric,1))
      ON CONFLICT (thuoc_thu_nghiem, ngay, ma_phong, sensor_type) DO NOTHING;
    END LOOP;
  END LOOP;

  -- KPI ngày × scope (AREA + AHU + TOTAL) — tổng hợp lại từ phòng
  FOR d IN 0..29 LOOP
    v_ngay := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - d;
    -- AREA
    INSERT INTO public.kpi_ngay_scope(thuoc_thu_nghiem, ngay, scope_type, scope_id, ten_scope, sensor_type, ti_le_dat_pct, oos_rate_pct_tb, so_phong_co_du_lieu, so_gio_critical, so_gio_warning, chat_luong_du_lieu_pct)
    SELECT true, v_ngay, 'AREA', khu_vuc, 'Khu ' || khu_vuc, 'ALL',
           ROUND(AVG(ti_le_dat_pct)::numeric,1), ROUND(AVG(oos_rate_pct_tb)::numeric,1), count(DISTINCT ma_phong), SUM(so_gio_critical), SUM(so_gio_warning), ROUND(AVG(chat_luong_du_lieu_pct)::numeric,1)
    FROM public.kpi_ngay_phong WHERE thuoc_thu_nghiem AND ngay=v_ngay AND sensor_type='ALL'
    GROUP BY khu_vuc
    ON CONFLICT (thuoc_thu_nghiem, ngay, scope_type, scope_id, sensor_type) DO NOTHING;
    -- AHU
    INSERT INTO public.kpi_ngay_scope(thuoc_thu_nghiem, ngay, scope_type, scope_id, ten_scope, sensor_type, ti_le_dat_pct, oos_rate_pct_tb, so_phong_co_du_lieu, so_gio_critical, so_gio_warning, chat_luong_du_lieu_pct)
    SELECT true, v_ngay, 'AHU', ahu, ahu, 'ALL',
           ROUND(AVG(ti_le_dat_pct)::numeric,1), ROUND(AVG(oos_rate_pct_tb)::numeric,1), count(DISTINCT ma_phong), SUM(so_gio_critical), SUM(so_gio_warning), ROUND(AVG(chat_luong_du_lieu_pct)::numeric,1)
    FROM public.kpi_ngay_phong WHERE thuoc_thu_nghiem AND ngay=v_ngay AND sensor_type='ALL' AND ahu IS NOT NULL
    GROUP BY ahu
    ON CONFLICT (thuoc_thu_nghiem, ngay, scope_type, scope_id, sensor_type) DO NOTHING;
    -- TOTAL
    INSERT INTO public.kpi_ngay_scope(thuoc_thu_nghiem, ngay, scope_type, scope_id, ten_scope, sensor_type, ti_le_dat_pct, oos_rate_pct_tb, so_phong_co_du_lieu, so_gio_critical, so_gio_warning, chat_luong_du_lieu_pct)
    SELECT true, v_ngay, 'TOTAL', 'ALL', 'Toàn hệ thống', 'ALL',
           ROUND(AVG(ti_le_dat_pct)::numeric,1), ROUND(AVG(oos_rate_pct_tb)::numeric,1), count(DISTINCT ma_phong), SUM(so_gio_critical), SUM(so_gio_warning), ROUND(AVG(chat_luong_du_lieu_pct)::numeric,1)
    FROM public.kpi_ngay_phong WHERE thuoc_thu_nghiem AND ngay=v_ngay AND sensor_type='ALL'
    ON CONFLICT (thuoc_thu_nghiem, ngay, scope_type, scope_id, sensor_type) DO NOTHING;
  END LOOP;

  PERFORM set_config('app.tg_bypass_append_only', 'off', true);
END $$;

-- Tính KPI giờ cho bucket mới nhất (để xem_tong_quan có số)
SELECT public.rpc_tinh_kpi_gio(NULL, true);

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 10 OK — DỮ LIỆU DEMO' AS ket_qua,
  (SELECT count(*) FROM public.nguoi_dung WHERE kich_hoat)  AS nguoi_dung,
  (SELECT count(*) FROM public.phong_sach WHERE kich_hoat)  AS phong,
  (SELECT count(*) FROM public.cam_bien WHERE kich_hoat)    AS cam_bien,
  (SELECT count(*) FROM public.du_lieu_gio)                 AS dong_telemetry,
  (SELECT count(*) FROM public.su_co WHERE thoi_gian_dong IS NULL) AS su_co_mo,
  (SELECT count(*) FROM public.kpi_ngay_phong)              AS kpi_ngay;
