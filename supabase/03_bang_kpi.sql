-- ============================================================
-- 03_bang_kpi.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 3/11
--
-- MỤC ĐÍCH: tạo các bảng KPI tổng hợp sẵn để dashboard query NHANH.
-- Lý do: query trực tiếp 90 ngày × 57 phòng × 3 sensor × 24h từ
-- du_lieu_gio sẽ chậm (~370K dòng). Tổng hợp sẵn ra:
--
--   • kpi_gio              — tổng hợp theo giờ (cho banner realtime)
--   • kpi_ngay_phong       — theo ngày × phòng (cho card phòng)
--   • kpi_ngay_scope       — theo ngày × area/AHU (cho tab xu hướng)
--   • dac_trung_xu_huong   — slope, R², direction (cho AI)
--   • so_sanh_baseline     — so với baseline 30 ngày trước (cho AI)
--
-- Cập nhật bởi: WF1 sau mỗi lần ingest (gọi RPC tinh_kpi_gio…).
-- ============================================================

-- ============================================================
-- 1. KPI_GIO — KPI tổng hợp theo từng giờ
-- ============================================================
-- Mỗi dòng = (giờ × scope × sensor)
-- scope_type: TOTAL/AREA/AHU/ROOM
-- ============================================================
CREATE TABLE public.kpi_gio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tinh_luc        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  bucket_utc      TIMESTAMPTZ NOT NULL,
  bucket_vn       TIMESTAMP WITHOUT TIME ZONE,
  
  scope_type      TEXT NOT NULL CHECK (scope_type IN ('TOTAL','AREA','AHU','ROOM')),
  scope_id        TEXT NOT NULL,                     -- 'ALL' / 'C1' / 'AHU03' / 'C4.R7'
  ten_scope       TEXT,
  sensor_type     TEXT NOT NULL DEFAULT 'ALL',       -- ALL/DP/RH/T
  
  -- Đếm phòng
  so_phong_ky_vong       INT,                        -- số phòng kỳ vọng có data
  so_phong_co_du_lieu    INT,
  so_phong_thieu_du_lieu INT,
  so_phong_xau           INT,                        -- compliance < 80%
  
  -- Tổng hợp giờ-sensor
  so_gio_sensor          INT,
  so_gio_critical        INT,
  so_gio_warning         INT,
  
  -- Các tỉ lệ
  ti_le_dat_pct          NUMERIC,                    -- compliance %
  oos_rate_pct_tb        NUMERIC,
  chat_luong_du_lieu_pct NUMERIC,
  do_day_du_du_lieu_pct  NUMERIC,                    -- data completeness
  
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_kpi_gio UNIQUE(thuoc_thu_nghiem, bucket_utc, scope_type, scope_id, sensor_type)
);

CREATE INDEX idx_kpi_gio_bucket ON public.kpi_gio(thuoc_thu_nghiem, bucket_utc DESC);
CREATE INDEX idx_kpi_gio_scope  ON public.kpi_gio(scope_type, scope_id, bucket_utc DESC);

COMMENT ON TABLE public.kpi_gio IS 'KPI tổng hợp theo giờ cho dashboard. Cập nhật bởi WF1.';

-- ============================================================
-- 2. KPI_NGAY_PHONG — KPI ngày cho mỗi phòng × sensor
-- ============================================================
-- Dùng cho: card phòng (tỉ lệ đạt 7 ngày), trend chart theo phòng,
-- xếp hạng rủi ro.
-- ============================================================
CREATE TABLE public.kpi_ngay_phong (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tinh_luc        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  ngay            DATE NOT NULL,                     -- theo timezone Asia/Ho_Chi_Minh
  ma_phong        TEXT NOT NULL,
  ten_phong       TEXT,
  khu_vuc         TEXT,
  ahu             TEXT,
  muc_uu_tien     TEXT,
  sensor_type     TEXT NOT NULL,                     -- DP/RH/T/ALL
  
  ti_le_dat_pct          NUMERIC,
  oos_rate_pct_tb        NUMERIC,
  so_gio_critical        INT,
  so_gio_warning         INT,
  max_oos_lien_tuc_phut  NUMERIC,
  chat_luong_du_lieu_pct NUMERIC,
  
  CONSTRAINT uq_kpi_ngay_phong UNIQUE(thuoc_thu_nghiem, ngay, ma_phong, sensor_type)
);

CREATE INDEX idx_kpi_ngay_phong_ngay  ON public.kpi_ngay_phong(thuoc_thu_nghiem, ngay DESC);
CREATE INDEX idx_kpi_ngay_phong_phong ON public.kpi_ngay_phong(ma_phong, ngay DESC);
-- CẢI TIẾN: index phủ cho truy vấn lọc sensor_type='ALL' theo khoảng ngày (ranking, trend, báo cáo AI)
CREATE INDEX idx_kpi_ngay_phong_sensor ON public.kpi_ngay_phong(thuoc_thu_nghiem, sensor_type, ngay DESC);

COMMENT ON TABLE public.kpi_ngay_phong IS 'KPI ngày × phòng × sensor. Dùng cho card phòng + xếp hạng rủi ro.';

-- ============================================================
-- 3. KPI_NGAY_SCOPE — KPI ngày theo area/AHU/total
-- ============================================================
-- Tách khỏi kpi_ngay_phong cho query xu hướng theo AHU/khu nhanh.
-- ============================================================
CREATE TABLE public.kpi_ngay_scope (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tinh_luc        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  ngay            DATE NOT NULL,
  scope_type      TEXT NOT NULL CHECK (scope_type IN ('TOTAL','AREA','AHU')),
  scope_id        TEXT NOT NULL,
  ten_scope       TEXT,
  sensor_type     TEXT NOT NULL,
  
  ti_le_dat_pct          NUMERIC,
  oos_rate_pct_tb        NUMERIC,
  so_phong_co_du_lieu    INT,
  so_gio_critical        INT,
  so_gio_warning         INT,
  chat_luong_du_lieu_pct NUMERIC,
  
  CONSTRAINT uq_kpi_ngay_scope UNIQUE(thuoc_thu_nghiem, ngay, scope_type, scope_id, sensor_type)
);

CREATE INDEX idx_kpi_ngay_scope_ngay  ON public.kpi_ngay_scope(thuoc_thu_nghiem, ngay DESC);
CREATE INDEX idx_kpi_ngay_scope_scope ON public.kpi_ngay_scope(scope_type, scope_id, ngay DESC);
-- CẢI TIẾN: index phủ cho trend theo scope + sensor_type='ALL'
CREATE INDEX idx_kpi_ngay_scope_sensor ON public.kpi_ngay_scope(thuoc_thu_nghiem, scope_type, scope_id, sensor_type, ngay DESC);

COMMENT ON TABLE public.kpi_ngay_scope IS 'KPI ngày × scope (Total/Area/AHU) × sensor. Dùng cho tab Xu hướng.';

-- ============================================================
-- 4. DAC_TRUNG_XU_HUONG — phân tích xu hướng
-- ============================================================
-- Tính sẵn slope (hệ số dốc) và R² để AI dùng làm cơ sở định lượng.
-- "Worsening with R²=0.78" rõ ràng hơn "AHU-K01 trông có vẻ kém đi".
-- ============================================================
CREATE TABLE public.dac_trung_xu_huong (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tinh_luc        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  scope_type      TEXT NOT NULL,
  scope_id        TEXT NOT NULL,
  ten_scope       TEXT,
  sensor_type     TEXT NOT NULL,
  
  -- Cửa sổ tính (vd 30 ngày gần nhất)
  cua_so_ngay     INT NOT NULL DEFAULT 30,
  ngay_bat_dau    DATE,
  ngay_ket_thuc   DATE,
  
  -- Kết quả hồi quy tuyến tính
  huong           TEXT CHECK (huong IN ('worsening','improving','stable')),
  do_doc          NUMERIC,                           -- slope
  r2              NUMERIC,                           -- 0..1, càng cao càng tin cậy
  so_ngay_tai_dien INT,                              -- bao nhiêu ngày OOS lặp lại
  
  -- Compliance ngày bắt đầu/kết thúc
  comp_dau_ky     NUMERIC,
  comp_cuoi_ky    NUMERIC,
  
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_dac_trung_xu_huong UNIQUE(thuoc_thu_nghiem, scope_type, scope_id, sensor_type, cua_so_ngay)
);

CREATE INDEX idx_dac_trung_xu_huong_huong ON public.dac_trung_xu_huong(huong, r2 DESC) 
  WHERE huong = 'worsening';

COMMENT ON TABLE public.dac_trung_xu_huong IS 'Phân tích xu hướng (hồi quy tuyến tính). Top "worsening + R² cao" được AI ưu tiên báo cáo.';

-- ============================================================
-- 5. SO_SANH_BASELINE — so với baseline 30 ngày trước
-- ============================================================
-- VD: tuần này AHU-K01 tỉ lệ đạt 72%, baseline 30 ngày trước 81% → 
-- compliance_delta = -9%. AI sẽ flag "xấu hơn baseline".
-- ============================================================
CREATE TABLE public.so_sanh_baseline (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tinh_luc        TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  scope_type      TEXT NOT NULL,
  scope_id        TEXT NOT NULL,
  ten_scope       TEXT,
  sensor_type     TEXT NOT NULL,
  
  -- Khoảng baseline (30 ngày trước)
  baseline_tu     DATE,
  baseline_den    DATE,
  -- Khoảng hiện tại (7 ngày gần nhất)
  hien_tai_tu     DATE,
  hien_tai_den    DATE,
  
  baseline_compliance_tb NUMERIC,
  hien_tai_compliance_tb NUMERIC,
  baseline_oos_rate_tb   NUMERIC,
  hien_tai_oos_rate_tb   NUMERIC,
  
  -- Delta (positive = OOS tăng = xấu)
  oos_rate_delta  NUMERIC,
  compliance_delta NUMERIC,
  
  baseline_direction TEXT CHECK (baseline_direction IN (
    'worse_than_baseline',
    'better_than_baseline', 
    'stable',
    'insufficient_baseline'
  )),
  
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_so_sanh_baseline UNIQUE(thuoc_thu_nghiem, scope_type, scope_id, sensor_type)
);

CREATE INDEX idx_so_sanh_baseline_dir ON public.so_sanh_baseline(baseline_direction, oos_rate_delta DESC) 
  WHERE baseline_direction = 'worse_than_baseline';

COMMENT ON TABLE public.so_sanh_baseline IS 'So sánh hiện tại với baseline 30 ngày trước. AI ưu tiên báo cáo nhóm worse_than_baseline.';

-- ============================================================
-- 6. TRIGGER ngăn xóa KPI (cho phép UPDATE để cập nhật lại)
-- ============================================================
-- KPI có thể tính lại nên không append-only như du_lieu_gio.
-- Nhưng chặn DELETE thủ công (chỉ qua cleanup job).

CREATE OR REPLACE FUNCTION public.tg_chan_xoa_kpi()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.tg_bypass_append_only', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Không được DELETE KPI thủ công. Dùng job cleanup theo retention.';
END $$;

DO $$
DECLARE 
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['kpi_gio','kpi_ngay_phong','kpi_ngay_scope','dac_trung_xu_huong','so_sanh_baseline']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_chan_xoa_%s ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_chan_xoa_%s BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_chan_xoa_kpi()',
      t, t);
  END LOOP;
END $$;

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 03 OK' AS ket_qua,
  (SELECT count(*) FROM information_schema.tables 
   WHERE table_schema='public' 
     AND table_name IN ('kpi_gio','kpi_ngay_phong','kpi_ngay_scope','dac_trung_xu_huong','so_sanh_baseline')
  ) AS bang_kpi_da_tao;
