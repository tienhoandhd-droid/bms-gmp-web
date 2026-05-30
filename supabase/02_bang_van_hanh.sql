-- ============================================================
-- 02_bang_van_hanh.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 2/11
--
-- MỤC ĐÍCH: tạo các bảng vận hành hằng ngày (append-only theo GMP)
--   • du_lieu_gio          — telemetry sensor mỗi giờ × phòng
--   • su_co                — sự cố mở/đóng (state machine)
--   • lich_su_su_co        — mỗi action trên sự cố là 1 dòng (ALCOA+)
--   • nhat_ky_chay_workflow — log mỗi lượt n8n chạy
--   • ngoai_le_du_lieu     — log lỗi ingest (sensor timeout, missing)
--
-- NGUYÊN TẮC ALCOA+:
--   Mọi bảng trong file này có TRIGGER chặn UPDATE/DELETE từ client.
--   Chỉ SECURITY DEFINER functions (set tg_bypass) mới được sửa.
--
-- THỨ TỰ: chạy SAU file 01.
-- ============================================================

-- ============================================================
-- 1. BẢNG DU_LIEU_GIO — telemetry sensor mỗi giờ
-- ============================================================
-- Mỗi dòng = 1 phòng × 1 cảm biến × 1 giờ (bucket).
-- Đây là "sổ cái" sensor data — KHÔNG BAO GIỜ SỬA/XÓA.
-- Web đọc qua view xem_*, không truy vấn trực tiếp.
-- ============================================================
CREATE TABLE public.du_lieu_gio (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Thời điểm bucket (giờ tròn UTC)
  bucket_utc      TIMESTAMPTZ NOT NULL,
  bucket_vn       TIMESTAMP WITHOUT TIME ZONE,       -- timezone Asia/Ho_Chi_Minh để hiển thị
  ma_lan_chay_n8n TEXT,                              -- n8n execution ID
  
  -- Định danh phòng/cảm biến (denormalized cho query nhanh)
  ma_phong        TEXT NOT NULL,
  ten_phong       TEXT,
  khu_vuc         TEXT,
  ahu             TEXT,
  cap_phong_sach  TEXT,
  muc_uu_tien     TEXT,
  loai_cam_bien   TEXT NOT NULL CHECK (loai_cam_bien IN ('DP','RH','T','SYSTEM','DATA')),
  don_vi          TEXT,
  gioi_han_duoi   NUMERIC,
  gioi_han_tren   NUMERIC,
  
  -- Thống kê 60 điểm/giờ
  tong_diem       INT,                               -- tổng số điểm đo trong giờ (kỳ vọng 60)
  diem_hop_le     INT,                               -- số điểm có giá trị hợp lệ
  diem_thieu      INT,                               -- số điểm thiếu/null
  chat_luong_du_lieu_pct NUMERIC,                    -- = diem_hop_le / tong_diem × 100
  gia_tri_tb      NUMERIC,
  gia_tri_min     NUMERIC,
  gia_tri_max     NUMERIC,
  
  -- Đếm OOS (Out-Of-Spec)
  diem_oos        INT,                               -- tổng điểm OOS
  diem_oos_thap   INT,                               -- < gioi_han_duoi
  diem_oos_cao    INT,                               -- > gioi_han_tren
  oos_rate_pct    NUMERIC,
  max_oos_lien_tuc        INT,                       -- số điểm OOS liên tục dài nhất
  max_oos_lien_tuc_phut   NUMERIC,                   -- quy đổi ra phút
  
  -- Phân tích
  huong_xu_huong  TEXT,                              -- worsening/improving/stable
  do_doc_xu_huong NUMERIC,
  
  -- Phân loại cảnh báo
  muc_canh_bao    TEXT NOT NULL DEFAULT 'NORMAL'     -- NORMAL/NOTICE/WARNING/CRITICAL/SUPPRESSED
                  CHECK (muc_canh_bao IN ('NORMAL','NOTICE','WARNING','CRITICAL','SUPPRESSED')),
  loai_canh_bao   TEXT,                              -- OOS_DP/OOS_RH/OOS_T/DATA_QUALITY...
  diem_rui_ro     INT,
  hash_canh_bao   TEXT,                              -- để dedup
  
  -- Raw + meta
  du_lieu_goc     JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT uq_du_lieu_gio UNIQUE(thuoc_thu_nghiem, bucket_utc, ma_phong, loai_cam_bien)
);

CREATE INDEX idx_du_lieu_gio_bucket    ON public.du_lieu_gio(thuoc_thu_nghiem, bucket_utc DESC);
CREATE INDEX idx_du_lieu_gio_phong     ON public.du_lieu_gio(thuoc_thu_nghiem, ma_phong, loai_cam_bien, bucket_utc DESC);
CREATE INDEX idx_du_lieu_gio_khu_vuc   ON public.du_lieu_gio(thuoc_thu_nghiem, khu_vuc, ahu, bucket_utc DESC);
CREATE INDEX idx_du_lieu_gio_muc_canh_bao ON public.du_lieu_gio(muc_canh_bao, bucket_utc DESC) 
  WHERE muc_canh_bao IN ('WARNING','CRITICAL');

COMMENT ON TABLE public.du_lieu_gio IS 'Telemetry sensor mỗi giờ. APPEND-ONLY theo ALCOA+. WF1 ghi, web đọc qua view.';

-- ============================================================
-- 2. BẢNG SU_CO — sự cố mở/đóng theo state machine
-- ============================================================
-- Khi du_lieu_gio có dòng severity WARNING/CRITICAL → mở 1 sự cố.
-- trang_thai chỉ chuyển qua RPC rpc_thao_tac_su_co (có quy_tac check).
-- closed_at chỉ set khi đóng — đảm bảo "1 sự cố mở duy nhất / phòng/sensor".
-- ============================================================
CREATE TABLE public.su_co (
  ma_su_co        BIGSERIAL PRIMARY KEY,
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Khóa duy nhất khi đang mở (1 phòng × 1 sensor × 1 param)
  khoa_su_co      TEXT NOT NULL,
  
  -- Định danh
  ma_phong        TEXT NOT NULL,
  ten_phong       TEXT,
  khu_vuc         TEXT,
  ahu             TEXT,
  cap_phong_sach  TEXT,
  muc_uu_tien     TEXT,
  loai_cam_bien   TEXT NOT NULL,
  loai_canh_bao   TEXT,                              -- OOS_DP, OOS_RH...
  
  -- Mức độ ban đầu / hiện tại
  muc_canh_bao_ban_dau   TEXT NOT NULL,              -- NOTICE/WARNING/CRITICAL
  muc_canh_bao_hien_tai  TEXT NOT NULL,
  
  -- State machine
  trang_thai_hien_tai TEXT NOT NULL DEFAULT 'CHUA_XU_LY'
    CHECK (trang_thai_hien_tai IN (
      'CHUA_XU_LY',              -- mới mở
      'IPC_TIEP_NHAN',           -- IPC đã thấy
      'IPC_BAT_THUONG',          -- IPC xác nhận bất thường
      'IPC_BINH_THUONG',         -- IPC kết luận bình thường (đóng)
      'DA_BAO_CO_DIEN',          -- chuyển sang Cơ điện
      'CO_DIEN_DANG_XU_LY',      -- Cơ điện tiếp nhận
      'CO_DIEN_DA_XU_LY',        -- Cơ điện báo xong
      'CO_DIEN_KHONG_XU_LY_DUOC',-- Cơ điện báo không xử lý được
      'CHO_QA_KIEM_LAI',         -- chờ QA xác nhận
      'DA_KHAC_PHUC',            -- đóng (kết thúc tốt)
      'MO_LAI',                  -- QA bác — mở lại
      'DONG_TU_DONG'             -- sensor tự bình thường → đóng auto
    )),
  
  -- Thời gian
  thoi_gian_mo    TIMESTAMPTZ NOT NULL DEFAULT now(),
  thoi_gian_lan_cuoi_quan_sat TIMESTAMPTZ NOT NULL DEFAULT now(),
  thoi_gian_dong  TIMESTAMPTZ,
  
  -- Flag tắt cảnh báo (silenced) — không gửi email nữa
  da_tat_canh_bao BOOLEAN NOT NULL DEFAULT false,
  ly_do_tat_canh_bao TEXT,
  
  -- Meta
  nguon           TEXT NOT NULL DEFAULT 'WF1_INGEST',
  ghi_chu         TEXT,
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Đảm bảo 1 phòng × sensor × loại cảnh báo chỉ có 1 sự cố MỞ tại 1 thời điểm
CREATE UNIQUE INDEX uq_su_co_dang_mo 
  ON public.su_co(thuoc_thu_nghiem, khoa_su_co) 
  WHERE thoi_gian_dong IS NULL;

CREATE INDEX idx_su_co_trang_thai ON public.su_co(trang_thai_hien_tai, thoi_gian_mo DESC);
CREATE INDEX idx_su_co_dang_mo    ON public.su_co(thoi_gian_mo DESC) WHERE thoi_gian_dong IS NULL;
CREATE INDEX idx_su_co_phong      ON public.su_co(ma_phong, loai_cam_bien, thoi_gian_mo DESC);
CREATE INDEX idx_su_co_uu_tien    ON public.su_co(muc_uu_tien, thoi_gian_mo DESC) WHERE thoi_gian_dong IS NULL;

COMMENT ON TABLE public.su_co IS 'Sự cố mở/đóng theo state machine. Cập nhật qua RPC rpc_thao_tac_su_co.';
COMMENT ON COLUMN public.su_co.khoa_su_co IS 'md5(ma_phong|loai_cam_bien|loai_canh_bao) — chống mở sự cố trùng';

-- ============================================================
-- 3. BẢNG LICH_SU_SU_CO — nhật ký mọi thao tác trên sự cố
-- ============================================================
-- Mỗi action = 1 dòng. APPEND-ONLY tuyệt đối. Đây là audit trail ALCOA+
-- để xuất bundle cho thanh tra DAV/EMA.
-- ============================================================
CREATE TABLE public.lich_su_su_co (
  id              BIGSERIAL PRIMARY KEY,
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  thoi_diem       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ma_su_co        BIGINT NOT NULL REFERENCES public.su_co(ma_su_co),
  
  -- Ai làm
  nguoi_thao_tac  TEXT NOT NULL,                     -- email hoặc 'system'
  vai_tro         TEXT,                              -- IPC/MEP/LOT/QA/ADMIN/SYSTEM
  
  -- Làm gì
  hanh_dong       TEXT NOT NULL,                     -- ipc_tiep_nhan, mep_xu_ly_xong...
  trang_thai_truoc TEXT,
  trang_thai_sau  TEXT,
  ly_do           TEXT,
  
  -- Từ đâu
  nguon           TEXT NOT NULL DEFAULT 'web'        -- web/email/system/api
                  CHECK (nguon IN ('web','email','system','api')),
  dia_chi_ip      TEXT,
  thiet_bi        TEXT,
  
  -- Audit
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_lich_su_su_co_su_co  ON public.lich_su_su_co(ma_su_co, thoi_diem DESC);
CREATE INDEX idx_lich_su_su_co_nguoi  ON public.lich_su_su_co(nguoi_thao_tac, thoi_diem DESC);
CREATE INDEX idx_lich_su_su_co_thoi_diem ON public.lich_su_su_co(thoi_diem DESC);

COMMENT ON TABLE public.lich_su_su_co IS 'Audit trail ALCOA+ cho mọi thao tác trên sự cố. APPEND-ONLY tuyệt đối.';

-- ============================================================
-- 4. BẢNG NHAT_KY_CHAY_WORKFLOW — log mỗi lượt n8n chạy
-- ============================================================
CREATE TABLE public.nhat_ky_chay_workflow (
  id              BIGSERIAL PRIMARY KEY,
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  ten_workflow    TEXT NOT NULL,                     -- WF1, WF2, WF3, WF4
  ma_lan_chay_n8n TEXT,                              -- execution ID
  bat_dau         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ket_thuc        TIMESTAMPTZ,
  trang_thai      TEXT NOT NULL DEFAULT 'running'    -- running/ok/failed/partial
                  CHECK (trang_thai IN ('running','ok','failed','partial')),
  
  -- Thống kê (cho WF1)
  bucket_utc      TIMESTAMPTZ,
  bucket_vn       TIMESTAMP WITHOUT TIME ZONE,
  tong_phong_fms  INT,
  phong_hop_le    INT,
  phong_bo_qua    INT,
  phong_da_xu_ly  INT,
  dong_du_lieu_gio_them INT,
  su_co_moi       INT,
  su_co_quan_sat  INT,
  su_co_da_dong   INT,
  
  -- Lỗi (nếu có)
  loi_van_tat     TEXT,
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_nhat_ky_chay_workflow_ten ON public.nhat_ky_chay_workflow(ten_workflow, bat_dau DESC);
CREATE INDEX idx_nhat_ky_chay_workflow_bucket ON public.nhat_ky_chay_workflow(bucket_utc DESC) WHERE bucket_utc IS NOT NULL;

COMMENT ON TABLE public.nhat_ky_chay_workflow IS 'Mỗi lượt n8n chạy ghi 1 dòng. Web đọc để hiện "Workflow chạy lúc HH:MM".';

-- ============================================================
-- 5. BẢNG NGOAI_LE_DU_LIEU — log lỗi ingest cụ thể
-- ============================================================
-- VD: phòng C4.R7 timeout khi gọi FMS, hoặc sensor trả null.
-- Khác nhat_ky_loi_workflow ở chỗ: đây là lỗi ingest từng phòng, 
-- không phải lỗi WF1 toàn bộ.
-- ============================================================
CREATE TABLE public.ngoai_le_du_lieu (
  id              BIGSERIAL PRIMARY KEY,
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ma_lan_chay_n8n TEXT,
  bucket_utc      TIMESTAMPTZ,
  ma_phong        TEXT,
  ten_phong       TEXT,
  khu_vuc         TEXT,
  ma_loi          TEXT NOT NULL,                     -- FMS_TIMEOUT, SENSOR_NULL, DQ_BELOW_80...
  mo_ta_loi       TEXT,
  http_status     INT,
  du_lieu_trich   JSONB,
  nguon           TEXT NOT NULL DEFAULT 'WF1'
);

CREATE INDEX idx_ngoai_le_du_lieu_bucket ON public.ngoai_le_du_lieu(bucket_utc DESC, ma_loi);
CREATE INDEX idx_ngoai_le_du_lieu_phong  ON public.ngoai_le_du_lieu(ma_phong, tao_luc DESC);

COMMENT ON TABLE public.ngoai_le_du_lieu IS 'Lỗi ingest từng phòng (FMS timeout, sensor null, DQ thấp). Hiện tab Tổng quan.';

-- ============================================================
-- 6. TRIGGER NGĂN UPDATE/DELETE — ALCOA+ "Original"
-- ============================================================
-- Mọi bảng vận hành: chỉ INSERT. UPDATE chỉ cho phép qua SECURITY DEFINER
-- function set tham số tg_bypass_append_only='on' (file 07).
-- DELETE: NEVER (chỉ qua maintenance script khi env != PROD).
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_chan_sua_xoa()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Cho phép bypass khi SECURITY DEFINER set custom variable
  IF current_setting('app.tg_bypass_append_only', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 
    'ALCOA+: Bảng % chỉ cho INSERT. UPDATE/DELETE bị chặn. Dùng RPC chính thống để ghi lịch sử.', 
    TG_TABLE_NAME;
END $$;

DROP TRIGGER IF EXISTS trg_chan_sua_du_lieu_gio       ON public.du_lieu_gio;
DROP TRIGGER IF EXISTS trg_chan_sua_lich_su_su_co     ON public.lich_su_su_co;
DROP TRIGGER IF EXISTS trg_chan_sua_nhat_ky_chay_workflow ON public.nhat_ky_chay_workflow;
DROP TRIGGER IF EXISTS trg_chan_sua_ngoai_le_du_lieu  ON public.ngoai_le_du_lieu;

-- du_lieu_gio: append-only cứng (kể cả khi WF1 chạy lại cùng giờ → ON CONFLICT)
CREATE TRIGGER trg_chan_sua_du_lieu_gio
  BEFORE UPDATE OR DELETE ON public.du_lieu_gio
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_sua_xoa();

-- lich_su_su_co: append-only TUYỆT ĐỐI (không bypass)
CREATE OR REPLACE FUNCTION public.tg_chan_sua_xoa_tuyet_doi()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 
    'ALCOA+: Bảng % là audit log — UPDATE/DELETE bị chặn TUYỆT ĐỐI. Mọi thao tác chỉ qua INSERT.', 
    TG_TABLE_NAME;
END $$;

CREATE TRIGGER trg_chan_sua_lich_su_su_co
  BEFORE UPDATE OR DELETE ON public.lich_su_su_co
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_sua_xoa_tuyet_doi();

-- nhat_ky_chay_workflow: cho phép UPDATE ket_thuc/status từ SECURITY DEFINER (WF cần đóng dòng khi xong)
CREATE TRIGGER trg_chan_sua_nhat_ky_chay_workflow
  BEFORE DELETE ON public.nhat_ky_chay_workflow
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_sua_xoa();

-- ngoai_le_du_lieu: append-only
CREATE TRIGGER trg_chan_sua_ngoai_le_du_lieu
  BEFORE UPDATE OR DELETE ON public.ngoai_le_du_lieu
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_sua_xoa();

-- su_co: cần UPDATE để chuyển trạng thái → cho phép qua bypass flag từ RPC
CREATE OR REPLACE FUNCTION public.tg_su_co_check_bypass()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.tg_bypass_append_only', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ALCOA+: Không được DELETE sự cố. Đóng bằng RPC thao tác.';
  END IF;
  -- Chỉ cho UPDATE 1 số cột (tránh client sửa tùy tiện)
  IF OLD.ma_su_co IS DISTINCT FROM NEW.ma_su_co 
     OR OLD.thoi_gian_mo IS DISTINCT FROM NEW.thoi_gian_mo
     OR OLD.ma_phong IS DISTINCT FROM NEW.ma_phong
     OR OLD.khoa_su_co IS DISTINCT FROM NEW.khoa_su_co THEN
    RAISE EXCEPTION 'ALCOA+: Không được sửa các trường định danh sự cố (ma_su_co, ma_phong, khoa_su_co, thoi_gian_mo). Dùng RPC chính thống.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_su_co_check_bypass ON public.su_co;
CREATE TRIGGER trg_su_co_check_bypass
  BEFORE UPDATE OR DELETE ON public.su_co
  FOR EACH ROW EXECUTE FUNCTION public.tg_su_co_check_bypass();

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 02 OK' AS ket_qua,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('du_lieu_gio','su_co','lich_su_su_co','nhat_ky_chay_workflow','ngoai_le_du_lieu')) AS bang_da_tao,
  (SELECT count(*) FROM information_schema.triggers WHERE event_object_schema='public' AND trigger_name LIKE 'trg_chan_sua%') AS trigger_chan_sua_xoa;
