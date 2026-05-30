-- ============================================================
-- 05_quy_tac_va_lich_su.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 5/11
--
-- MỤC ĐÍCH: tạo các bảng phụ trợ cho governance:
--   • quy_tac_chuyen_trang_thai — state machine cho rpc_thao_tac_su_co
--   • lich_su_cau_hinh           — audit mọi thay đổi cấu hình
--   • cua_so_tat_canh_bao        — bảo trì có phê duyệt → tắt cảnh báo
--   • nhat_ky_loi_workflow       — log lỗi WF1/2/3 (WF4 ghi)
--   • quy_trinh_sop              — danh mục SOP cho tab Audit
-- ============================================================

-- ============================================================
-- 1. QUY_TAC_CHUYEN_TRANG_THAI — state machine
-- ============================================================
-- Đây là "luật game" cho rpc_thao_tac_su_co. Tách bảng để:
-- (1) Đổi quy tắc không cần sửa code, (2) audit dễ.
-- 
-- VD: dòng (ipc_tiep_nhan, IPC, CHUA_XU_LY, IPC_TIEP_NHAN, false, false)
--   nghĩa là: IPC có thể bấm "ipc_tiep_nhan" khi sự cố ở CHUA_XU_LY,
--   trạng thái chuyển sang IPC_TIEP_NHAN, không đóng sự cố.
-- ============================================================
CREATE TABLE public.quy_tac_chuyen_trang_thai (
  id              BIGSERIAL PRIMARY KEY,
  hanh_dong       TEXT NOT NULL,
  vai_tro         TEXT NOT NULL CHECK (vai_tro IN ('IPC','MEP','LOT','QA','ADMIN','SYSTEM')),
  trang_thai_truoc TEXT NOT NULL,                    -- '*' = mọi trạng thái mở
  trang_thai_sau  TEXT NOT NULL,                     -- '__GIU__' = giữ nguyên
  dong_su_co      BOOLEAN NOT NULL DEFAULT false,
  giu_trang_thai  BOOLEAN NOT NULL DEFAULT false,
  thu_tu          INT NOT NULL DEFAULT 100,
  ghi_chu         TEXT,
  kich_hoat       BOOLEAN NOT NULL DEFAULT true,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_quy_tac UNIQUE(hanh_dong, vai_tro, trang_thai_truoc)
);

CREATE INDEX idx_quy_tac_lookup ON public.quy_tac_chuyen_trang_thai(hanh_dong, vai_tro, trang_thai_truoc) WHERE kich_hoat;

COMMENT ON TABLE public.quy_tac_chuyen_trang_thai IS 'State machine luật: ai làm action gì → trạng thái chuyển ra sao';

-- SEED quy tắc theo state machine của React mockup
INSERT INTO public.quy_tac_chuyen_trang_thai
  (hanh_dong, vai_tro, trang_thai_truoc, trang_thai_sau, dong_su_co, giu_trang_thai, thu_tu, ghi_chu)
VALUES
  -- IPC tiếp nhận (Chưa xử lý → IPC tiếp nhận)
  ('ipc_tiep_nhan', 'IPC', 'CHUA_XU_LY',    'IPC_TIEP_NHAN', false, false, 10, 'IPC thấy email/web, đi kiểm tra hiện trường'),
  ('ipc_tiep_nhan', 'IPC', 'MO_LAI',        'IPC_TIEP_NHAN', false, false, 11, 'IPC tiếp nhận sự cố mở lại'),
  
  -- IPC ghi nhận chờ xử lý (không chuyển bước, chỉ log)
  ('ipc_cho',       'IPC', '*',             '__GIU__',       false, true,  20, 'IPC chờ xử lý — chỉ log, giữ trạng thái'),
  
  -- IPC kết luận bình thường (đóng sự cố)
  ('ipc_binh_thuong','IPC','CHUA_XU_LY',    'IPC_BINH_THUONG', true, false, 30, 'IPC kiểm tra, thực tế bình thường → đóng'),
  ('ipc_binh_thuong','IPC','IPC_TIEP_NHAN', 'IPC_BINH_THUONG', true, false, 31, ''),
  
  -- IPC xác nhận bất thường (chưa báo Cơ điện ngay — chờ MEP)
  ('ipc_bat_thuong', 'IPC','CHUA_XU_LY',    'IPC_BAT_THUONG',  false, false, 40, 'IPC xác nhận bất thường'),
  ('ipc_bat_thuong', 'IPC','IPC_TIEP_NHAN', 'IPC_BAT_THUONG',  false, false, 41, ''),
  
  -- IPC báo Cơ điện
  ('ipc_bao_co_dien','IPC','IPC_BAT_THUONG','DA_BAO_CO_DIEN',  false, false, 50, 'IPC chuyển sự cố cho Cơ điện'),
  
  -- Cơ điện tiếp nhận
  ('mep_tiep_nhan',  'MEP','DA_BAO_CO_DIEN','CO_DIEN_DANG_XU_LY', false, false, 60, 'Cơ điện tiếp nhận, đang xử lý'),
  ('mep_tiep_nhan',  'MEP','MO_LAI',        'CO_DIEN_DANG_XU_LY', false, false, 61, 'Cơ điện nhận lại sau mở lại'),
  
  -- Cơ điện chờ (chỉ log)
  ('mep_cho',        'MEP','*',             '__GIU__',         false, true,  65, 'Cơ điện chờ xử lý — chỉ log'),
  
  -- Cơ điện xử lý xong (báo IPC kiểm lại)
  ('mep_xu_ly_xong', 'MEP','CO_DIEN_DANG_XU_LY','CO_DIEN_DA_XU_LY', false, false, 70, 'Cơ điện báo đã xử lý, chờ IPC/QA kiểm lại'),
  
  -- Cơ điện không xử lý được
  ('mep_khong_xu_ly_duoc','MEP','CO_DIEN_DANG_XU_LY','CO_DIEN_KHONG_XU_LY_DUOC', false, false, 80, 'Không thể xử lý — chuyển QA/Trực HSL leo thang'),
  
  -- QA xác nhận đã khắc phục (đóng)
  ('qa_da_khac_phuc','QA', 'CO_DIEN_DA_XU_LY','DA_KHAC_PHUC',  true,  false, 90, 'QA xác nhận đã khắc phục → đóng'),
  ('qa_da_khac_phuc','IPC','CO_DIEN_DA_XU_LY','DA_KHAC_PHUC',  true,  false, 91, 'IPC kiểm lại OK → đóng (cho phép khi QA off)'),
  
  -- QA bác — mở lại
  ('qa_mo_lai',      'QA', 'CO_DIEN_DA_XU_LY','MO_LAI',        false, false, 100, 'QA kiểm lại vẫn bất thường → mở lại cho Cơ điện'),
  ('qa_mo_lai',      'IPC','CO_DIEN_DA_XU_LY','MO_LAI',        false, false, 101, ''),
  
  -- Trực HSL điều phối (không đổi trạng thái)
  ('lot_nhac_nho',   'LOT','*',             '__GIU__',         false, true,  110, 'Trực HSL nhắc nhở/điều phối'),
  ('lot_ghi_chu',    'LOT','*',             '__GIU__',         false, true,  111, 'Trực HSL ghi chú'),
  ('lot_leo_thang',  'LOT','*',             '__GIU__',         false, true,  112, 'Trực HSL leo thang lên cấp trên'),
  
  -- System auto close (sensor tự bình thường)
  ('he_thong_dong_tu_dong','SYSTEM','CHUA_XU_LY','DONG_TU_DONG', true, false, 200, 'Sensor tự bình thường trước khi IPC tiếp nhận'),
  
  -- ADMIN override (mọi trạng thái)
  ('admin_dong',     'ADMIN','*',           'DA_KHAC_PHUC',    true,  false, 250, 'ADMIN đóng sự cố thủ công'),
  ('admin_mo_lai',   'ADMIN','*',           'MO_LAI',          false, false, 251, 'ADMIN mở lại sự cố')

ON CONFLICT (hanh_dong, vai_tro, trang_thai_truoc) DO UPDATE SET
  trang_thai_sau = EXCLUDED.trang_thai_sau,
  dong_su_co = EXCLUDED.dong_su_co,
  giu_trang_thai = EXCLUDED.giu_trang_thai,
  thu_tu = EXCLUDED.thu_tu,
  ghi_chu = EXCLUDED.ghi_chu,
  kich_hoat = true;

-- ============================================================
-- 2. LICH_SU_CAU_HINH — audit mọi thay đổi cấu hình
-- ============================================================
-- Trigger tự ghi mỗi lần cau_hinh thay đổi.
-- Mask secret: openai_api_key, fms_password → "***".
-- ============================================================
CREATE TABLE public.lich_su_cau_hinh (
  id              BIGSERIAL PRIMARY KEY,
  thoi_diem       TIMESTAMPTZ NOT NULL DEFAULT now(),
  nguoi_thay_doi  TEXT NOT NULL DEFAULT current_user,
  loai_thay_doi   TEXT NOT NULL CHECK (loai_thay_doi IN ('INSERT','UPDATE','DELETE')),
  bang            TEXT NOT NULL,                     -- cau_hinh / phong_sach / cam_bien
  key_or_id       TEXT NOT NULL,
  gia_tri_cu_mask TEXT,
  gia_tri_moi_mask TEXT,
  ly_do           TEXT,
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_lich_su_cau_hinh_thoi_diem ON public.lich_su_cau_hinh(thoi_diem DESC);
CREATE INDEX idx_lich_su_cau_hinh_bang     ON public.lich_su_cau_hinh(bang, thoi_diem DESC);

COMMENT ON TABLE public.lich_su_cau_hinh IS 'Audit mọi thay đổi cau_hinh/phong_sach/cam_bien. Secret được mask.';

-- Helper mask secret
CREATE OR REPLACE FUNCTION public.mask_secret(p_key TEXT, p_value TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE 
    WHEN p_key ILIKE '%password%' OR p_key ILIKE '%api_key%' 
      OR p_key ILIKE '%token%' OR p_key ILIKE '%secret%'
    THEN CASE WHEN COALESCE(p_value,'')='' THEN '' ELSE '***đã cấu hình***' END
    ELSE p_value
  END;
$$;

-- Trigger tự log thay đổi cau_hinh
CREATE OR REPLACE FUNCTION public.tg_log_cau_hinh()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public AS $$
DECLARE
  v_actor TEXT;
BEGIN
  -- Lấy actor: ưu tiên JWT email, fallback current_user
  BEGIN
    v_actor := NULLIF(current_setting('request.jwt.claims', true)::json->>'email','');
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;
  v_actor := COALESCE(v_actor, current_setting('app.actor', true), current_user);
  
  INSERT INTO public.lich_su_cau_hinh(
    nguoi_thay_doi, loai_thay_doi, bang, key_or_id,
    gia_tri_cu_mask, gia_tri_moi_mask
  )
  VALUES (
    v_actor, TG_OP, TG_TABLE_NAME, COALESCE(NEW.key, OLD.key),
    public.mask_secret(COALESCE(OLD.key, NEW.key), OLD.value),
    public.mask_secret(COALESCE(NEW.key, OLD.key), NEW.value)
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_log_cau_hinh ON public.cau_hinh;
CREATE TRIGGER trg_log_cau_hinh
  AFTER INSERT OR UPDATE OR DELETE ON public.cau_hinh
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_cau_hinh();

-- ============================================================
-- 3. CUA_SO_TAT_CANH_BAO — bảo trì có phê duyệt
-- ============================================================
-- VD: bảo trì AHU03 ngày 28/05 8:00-18:00 → tạm tắt cảnh báo cho 
-- phòng dùng AHU03 trong khoảng đó. Cần phê duyệt QA.
-- ============================================================
CREATE TABLE public.cua_so_tat_canh_bao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phong        TEXT,                              -- NULL = áp dụng tất cả phòng
  loai_cam_bien   TEXT,                              -- NULL = mọi sensor
  khu_vuc         TEXT,                              -- NULL = mọi khu
  ahu             TEXT,                              -- NULL = mọi AHU
  bat_dau         TIMESTAMPTZ NOT NULL,
  ket_thuc        TIMESTAMPTZ NOT NULL,
  ly_do           TEXT NOT NULL,
  ma_sop_lien_quan TEXT,
  nguoi_yeu_cau   TEXT,
  nguoi_phe_duyet TEXT NOT NULL,
  kich_hoat       BOOLEAN NOT NULL DEFAULT true,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_cua_so_thoi_gian CHECK (ket_thuc > bat_dau)
);

CREATE INDEX idx_cua_so_tat_canh_bao_kich_hoat 
  ON public.cua_so_tat_canh_bao(bat_dau, ket_thuc) WHERE kich_hoat;

COMMENT ON TABLE public.cua_so_tat_canh_bao IS 'Cửa sổ bảo trì có phê duyệt — tạm tắt cảnh báo. nguoi_phe_duyet bắt buộc.';

-- ============================================================
-- 4. NHAT_KY_LOI_WORKFLOW — log lỗi WF1/2/3 (WF4 ghi)
-- ============================================================
CREATE TABLE public.nhat_ky_loi_workflow (
  id              BIGSERIAL PRIMARY KEY,
  thoi_diem       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ten_workflow    TEXT NOT NULL,
  ma_node         TEXT,                              -- tên node n8n bị lỗi
  loai_loi        TEXT,                              -- HTTP_4XX, HTTP_5XX, TIMEOUT, SQL_ERROR...
  mo_ta_loi       TEXT NOT NULL,
  muc_do          TEXT NOT NULL DEFAULT 'ERROR'      -- ERROR/CRITICAL/WARNING
                  CHECK (muc_do IN ('ERROR','CRITICAL','WARNING','INFO')),
  ma_lan_chay_n8n TEXT,
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb,
  da_xu_ly_luc    TIMESTAMPTZ,
  da_xu_ly_boi    TEXT,
  ghi_chu_xu_ly   TEXT
);

CREATE INDEX idx_nhat_ky_loi_thoi_diem ON public.nhat_ky_loi_workflow(thoi_diem DESC);
CREATE INDEX idx_nhat_ky_loi_chua_xu_ly ON public.nhat_ky_loi_workflow(thoi_diem DESC) WHERE da_xu_ly_luc IS NULL;

COMMENT ON TABLE public.nhat_ky_loi_workflow IS 'Lỗi WF1/2/3 ghi qua WF4 Error Handler.';

-- ============================================================
-- 5. QUY_TRINH_SOP — danh mục SOP
-- ============================================================
CREATE TABLE public.quy_trinh_sop (
  id              BIGSERIAL PRIMARY KEY,
  ma_sop          TEXT UNIQUE NOT NULL,
  mo_ta_ap_dung   TEXT NOT NULL,
  lien_quan_deviation TEXT,
  lien_quan_capa  TEXT,
  url_tai_lieu    TEXT,
  kich_hoat       BOOLEAN NOT NULL DEFAULT true,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.quy_trinh_sop(ma_sop, mo_ta_ap_dung, lien_quan_deviation, lien_quan_capa) VALUES
  ('SOP-HVAC-005', 'Giám sát chênh áp phòng sạch', 'Không', 'Không'),
  ('SOP-HVAC-008', 'Xử lý mất áp Grade A/B',       'Có — DEV-2026-014', 'Đang mở'),
  ('SOP-BMS-001',  'Vận hành hệ thống BMS GMP',    '—', '—'),
  ('SOP-BMS-002',  'Xử lý cảnh báo OOS qua email/web', '—', '—'),
  ('PIC/S Annex 1', 'Tiêu chuẩn phòng sạch vô trùng', '—', '—')
ON CONFLICT (ma_sop) DO NOTHING;

COMMENT ON TABLE public.quy_trinh_sop IS 'Danh mục SOP hiển thị tab Audit.';

-- ============================================================
-- TRIGGER ngăn DELETE
-- ============================================================
DROP TRIGGER IF EXISTS trg_chan_xoa_lich_su_cau_hinh ON public.lich_su_cau_hinh;
DROP TRIGGER IF EXISTS trg_chan_xoa_nhat_ky_loi      ON public.nhat_ky_loi_workflow;

CREATE TRIGGER trg_chan_xoa_lich_su_cau_hinh
  BEFORE UPDATE OR DELETE ON public.lich_su_cau_hinh
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_sua_xoa_tuyet_doi();

CREATE TRIGGER trg_chan_xoa_nhat_ky_loi
  BEFORE DELETE ON public.nhat_ky_loi_workflow
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_xoa_kpi();

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 05 OK' AS ket_qua,
  (SELECT count(*) FROM public.quy_tac_chuyen_trang_thai) AS so_quy_tac,
  (SELECT count(*) FROM public.quy_trinh_sop)              AS so_sop;
