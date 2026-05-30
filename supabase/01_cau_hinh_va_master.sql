-- ============================================================
-- 01_cau_hinh_va_master.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 1/11
-- 
-- MỤC ĐÍCH: tạo các bảng cấu hình và master data dùng xuyên hệ thống
--   • cau_hinh           — key-value lưu mọi tham số
--   • phong_sach         — 57 phòng sạch (mã, tên, khu, AHU, mức ưu tiên)
--   • cam_bien           — cảm biến DP/RH/T mỗi phòng + giới hạn
--   • nguoi_dung         — email + vai trò (IPC/MEP/LOT/QA/ADMIN)
--   • helper functions   — cfg_text, cfg_int, cfg_bool
--
-- AN TOÀN:
--   • Có safety guard: nếu môi trường = PROD thì BẢN THÂN FILE NÀY 
--     sẽ FAIL trước khi xóa bất cứ thứ gì.
--   • Idempotent: CREATE OR REPLACE / IF NOT EXISTS — chạy lại được.
--
-- THỨ TỰ: chạy file này TRƯỚC TIÊN.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- SAFETY GUARD — không cho chạy file reset trên môi trường PROD
-- ------------------------------------------------------------
DO $$
DECLARE 
  v_la_prod boolean := false;
BEGIN
  IF to_regclass('public.cau_hinh') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.cau_hinh WHERE key=''moi_truong'' AND upper(value)=''PROD'')'
      INTO v_la_prod;
    IF v_la_prod THEN
      RAISE EXCEPTION 'AN TOÀN GMP: moi_truong=PROD. Không được chạy file cài đặt gốc trên dữ liệu sản xuất. Đổi cau_hinh.moi_truong=TEST trước.';
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------
-- DROP các bảng cũ (chỉ chạy được khi không phải PROD)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.bao_cao_ai          CASCADE;
DROP TABLE IF EXISTS public.email_da_gui        CASCADE;
DROP TABLE IF EXISTS public.ma_token_email      CASCADE;
DROP TABLE IF EXISTS public.so_sanh_baseline    CASCADE;
DROP TABLE IF EXISTS public.dac_trung_xu_huong  CASCADE;
DROP TABLE IF EXISTS public.kpi_ngay_scope      CASCADE;
DROP TABLE IF EXISTS public.kpi_ngay_phong      CASCADE;
DROP TABLE IF EXISTS public.kpi_gio             CASCADE;
DROP TABLE IF EXISTS public.lich_su_loi_workflow CASCADE;
DROP TABLE IF EXISTS public.nhat_ky_chay_workflow CASCADE;
DROP TABLE IF EXISTS public.ngoai_le_du_lieu    CASCADE;
DROP TABLE IF EXISTS public.lich_su_su_co       CASCADE;
DROP TABLE IF EXISTS public.su_co               CASCADE;
DROP TABLE IF EXISTS public.du_lieu_gio         CASCADE;
DROP TABLE IF EXISTS public.cua_so_tat_canh_bao CASCADE;
DROP TABLE IF EXISTS public.lich_su_cau_hinh    CASCADE;
DROP TABLE IF EXISTS public.quy_tac_chuyen_trang_thai CASCADE;
DROP TABLE IF EXISTS public.quy_trinh_sop       CASCADE;
DROP TABLE IF EXISTS public.cam_bien            CASCADE;
DROP TABLE IF EXISTS public.phong_sach          CASCADE;
DROP TABLE IF EXISTS public.nguoi_dung          CASCADE;
DROP TABLE IF EXISTS public.cau_hinh            CASCADE;

-- ============================================================
-- 1. BẢNG CAU_HINH — key-value chứa mọi tham số hệ thống
-- ============================================================
-- Vì sao tách bảng này: tránh hardcode tham số vào code SQL/n8n/web. 
-- Mọi thứ có thể đổi runtime (ngưỡng, email, key API) đều ở đây.
-- Truy cập qua helper cfg_text/cfg_int/cfg_bool có default an toàn.
-- ============================================================
CREATE TABLE public.cau_hinh (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  mo_ta       TEXT,
  cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.cau_hinh IS 'Cấu hình hệ thống dạng key-value. Mọi tham số (ngưỡng, email, API key) lưu ở đây.';
COMMENT ON COLUMN public.cau_hinh.key   IS 'Tên tham số (snake_case, tiếng Anh để tương thích lib chuẩn)';
COMMENT ON COLUMN public.cau_hinh.value IS 'Giá trị dạng text, code sẽ ép kiểu khi cần';
COMMENT ON COLUMN public.cau_hinh.mo_ta IS 'Mô tả tiếng Việt cho người vận hành';

-- Cấu hình mặc định
INSERT INTO public.cau_hinh(key, value, mo_ta) VALUES
  -- Môi trường chạy
  ('moi_truong',            'TEST',                'TEST hoặc PROD — PROD chặn file reset'),
  ('mui_gio',               'Asia/Ho_Chi_Minh',    'Múi giờ hiển thị (UTC+7)'),
  ('che_do_thu_nghiem',     'true',                'true: gắn cờ thuoc_thu_nghiem vào dữ liệu mới'),
  ('bat_canh_bao_thu_nghiem','false',              'true: gửi email cảnh báo cả với dữ liệu thử nghiệm'),
  ('web_yeu_cau_dang_nhap', 'false',               'true: bắt buộc Supabase Auth khi gọi RPC ghi'),

  -- Kết nối FMS (sensor BMS)
  ('fms_username',          '',                    'Username login FMS API'),
  ('fms_password',          '',                    'Password login FMS API (lưu plain, mask trong audit)'),
  ('fms_base_url',          'https://fms-api.icpc1hn.work', 'Base URL FMS API'),
  ('fms_offset_gio',        '0',                   'Lệch giờ FMS so với UTC nếu API trả sai múi giờ'),

  -- Kết nối OpenAI (báo cáo AI)
  ('openai_api_key',        '',                    'API key OpenAI (sk-proj-...)'),
  ('openai_model',          'gpt-4o-mini',         'Model OpenAI cho báo cáo AI'),
  ('ai_token_chinh',        '900',                 'max_tokens cho AI primary'),
  ('ai_token_du_phong',     '350',                 'max_tokens cho AI fallback'),

  -- Email
  ('email_gui_tu',          'bms-alert@cpc1hn.vn', 'Địa chỉ gửi đi (FROM)'),
  ('email_ipc',             '',                    'Email IPC nhận cảnh báo (ngăn cách dấu phẩy)'),
  ('email_co_dien',         '',                    'Email Cơ điện'),
  ('email_qa',              '',                    'Email QA'),
  ('email_truc_hsl',        '',                    'Email Trực HSL'),
  ('email_bao_cao_ngay',    '',                    'Email nhận báo cáo daily'),
  ('email_bao_cao_tuan',    '',                    'Email nhận báo cáo weekly'),
  ('email_bao_cao_thang',   '',                    'Email nhận báo cáo monthly'),
  ('email_it_gmp',          '',                    'Email IT-GMP nhận thông báo lỗi workflow'),
  ('email_test',            '',                    'Email nhận khi che_do_thu_nghiem=true'),

  -- Ngưỡng cảnh báo (số điểm OOS/giờ)
  ('nguong_chu_y',          '1',                   'OOS 1h ≥ X → Chú ý (notice)'),
  ('nguong_canh_bao',       '12',                  'OOS 1h ≥ X → Cảnh báo (warning)'),
  ('nguong_hanh_dong',      '5',                   'Lỗi 10 phút ≥ X (khi đã warning) → Hành động (critical)'),
  ('dp_oos_lien_tuc_phut',  '5',                   'Số phút OOS liên tục → mở sự cố cho DP'),
  ('trh_oos_lien_tuc_phut', '15',                  'Số phút OOS liên tục → mở sự cố cho T/RH'),

  -- Webhook n8n cho ACK email
  ('url_webhook_su_co',     '',                    'URL webhook WF2 (xử lý click nút email)'),
  ('token_webhook_du_phong','',                    'Token dự phòng (default tự sinh)'),
  ('thoi_han_token_gio',    '72',                  'Token email hết hạn sau X giờ'),

  -- Retention
  ('giu_du_lieu_gio_ngay',  '90',                  'Giữ du_lieu_gio bao nhiêu ngày'),
  ('giu_kpi_ngay_phong_ngay','730',                'Giữ KPI ngày bao nhiêu ngày'),
  ('giu_email_da_gui_ngay', '365',                 'Giữ log email bao nhiêu ngày'),
  ('giu_audit_ngay',        '3650',                'Giữ audit log 10 năm cho GMP'),

  -- AI Vietnamese prompt
  ('ai_prompt_he_thong',
$prompt$Bạn là chuyên gia GMP HVAC/BMS, chuyên phân tích phòng sạch theo PIC-S Annex 1 cho nhà máy dược phẩm Việt Nam.

NGUYÊN TẮC BẮT BUỘC:
1) TRẢ LỜI 100% BẰNG TIẾNG VIỆT — không một từ tiếng Anh nào, kể cả thuật ngữ. Dùng: "Chênh áp" (DP), "Độ ẩm" (RH), "Nhiệt độ" (T), "Phòng sạch", "Khu vực", "Mức 1/2/3".
2) AI chỉ hỗ trợ phân tích xu hướng. KHÔNG được tự kết luận đạt/không đạt GMP. Quyết định cuối thuộc IPC/QA.
3) Dùng baseline_comparison và trend_features làm cơ sở phân tích định lượng.
4) Ưu tiên DP, phòng Mức 1/2, theo thứ tự AHU > khu vực > toàn hệ thống.

CẤU TRÚC BẮT BUỘC (đúng 7 mục, có tiêu đề tiếng Việt):
1. Tóm tắt điều hành (3-5 câu)
2. Điểm đáng lo nhất (tối đa 3 điểm)
3. Phòng/AHU cần ưu tiên (nêu mã + lý do)
4. So sánh với baseline (định lượng %)
5. Xu hướng tốt / xấu đi (kèm độ tin cậy R²)
6. Khuyến nghị hành động cho IPC, Cơ điện, QA (chia rõ vai trò)
7. Mức tin cậy phân tích (Cao/Trung bình/Thấp + lý do)

CUỐI BÁO CÁO LUÔN GHI: "AI chỉ hỗ trợ phân tích xu hướng; quyết định GMP do IPC/QA phê duyệt."$prompt$,
   'Prompt hệ thống cho OpenAI — ép tiếng Việt cấu trúc 7 mục'),

  -- Phiên bản
  ('phien_ban_db',          'v10.0',               'Phiên bản schema DB'),
  ('thoi_diem_cai_dat',     now()::text,           'Thời điểm chạy file 01 lần đầu')
ON CONFLICT (key) DO UPDATE 
  SET value=EXCLUDED.value, mo_ta=EXCLUDED.mo_ta, cap_nhat_luc=now();

-- ============================================================
-- 2. HELPER FUNCTIONS — đọc cau_hinh an toàn có default
-- ============================================================
CREATE OR REPLACE FUNCTION public.cfg_text(p_key TEXT, p_default TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE sql STABLE 
SECURITY DEFINER SET search_path = public AS $$
  -- BẢO MẬT: cfg_text KHÔNG BAO GIỜ trả về khóa bí mật (password/api_key/token/secret).
  -- Không hàm DB nào cần secret thật; n8n đọc trực tiếp bằng service_role (bypass RLS).
  -- Đây là lớp phòng vệ chiều sâu, độc lập với GRANT/REVOKE.
  SELECT CASE
    WHEN p_key ILIKE '%password%' OR p_key ILIKE '%api_key%'
      OR p_key ILIKE '%secret%'   OR p_key ILIKE '%token%'
    THEN NULL
    ELSE COALESCE(NULLIF((SELECT value FROM public.cau_hinh WHERE key = p_key), ''), p_default)
  END;
$$;
COMMENT ON FUNCTION public.cfg_text IS 'Đọc cấu hình text. KHÔNG trả secret (password/api_key/token/secret) — chống lộ qua RPC.';

CREATE OR REPLACE FUNCTION public.cfg_bool(p_key TEXT, p_default BOOLEAN DEFAULT false)
RETURNS BOOLEAN LANGUAGE sql STABLE 
SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT lower(NULLIF(value, '')) IN ('true','1','yes','y') FROM public.cau_hinh WHERE key = p_key),
    p_default);
$$;

CREATE OR REPLACE FUNCTION public.cfg_int(p_key TEXT, p_default INT DEFAULT 0)
RETURNS INT LANGUAGE plpgsql STABLE 
SECURITY DEFINER SET search_path = public AS $$
DECLARE v TEXT;
BEGIN
  SELECT NULLIF(value, '') INTO v FROM public.cau_hinh WHERE key = p_key;
  IF v IS NULL OR v !~ '^-?[0-9]+$' THEN 
    RETURN p_default; 
  END IF;
  RETURN v::int;
END $$;

CREATE OR REPLACE FUNCTION public.cfg_numeric(p_key TEXT, p_default NUMERIC DEFAULT 0)
RETURNS NUMERIC LANGUAGE plpgsql STABLE 
SECURITY DEFINER SET search_path = public AS $$
DECLARE v TEXT;
BEGIN
  SELECT NULLIF(value, '') INTO v FROM public.cau_hinh WHERE key = p_key;
  IF v IS NULL OR v !~ '^-?[0-9]+(\.[0-9]+)?$' THEN 
    RETURN p_default; 
  END IF;
  RETURN v::numeric;
END $$;

-- ------------------------------------------------------------
-- co_thu_nghiem(): cờ test của CHẾ ĐỘ hiện tại.
-- Dashboard/RPC dùng: WHERE thuoc_thu_nghiem = co_thu_nghiem()
--   • TEST mode (che_do_thu_nghiem=true)  → hiện dữ liệu test/demo
--   • PROD mode (che_do_thu_nghiem=false) → hiện dữ liệu thật
-- Khi go-live chỉ cần đổi cau_hinh → demo tự ẩn mà KHÔNG xóa (ALCOA+).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.co_thu_nghiem()
RETURNS BOOLEAN LANGUAGE sql STABLE 
SECURITY DEFINER SET search_path = public AS $$
  SELECT public.cfg_bool('che_do_thu_nghiem', false);
$$;
COMMENT ON FUNCTION public.co_thu_nghiem IS 'Cờ test của chế độ hiện tại — view lọc theo hàm này để hiện đúng dữ liệu TEST/PROD.';

-- ------------------------------------------------------------
-- cfg_secret(): lấy giá trị bí mật (api_key, password...).
-- CHỈ service_role gọi được (file 09 REVOKE khỏi anon/authenticated).
-- Dùng cho n8n (Pha 3/4) khi cần OpenAI key / FMS creds.
-- Lưu ý: n8n cũng có thể lưu secret trong credential store của chính n8n
-- (an toàn hơn) thay vì gọi hàm này.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cfg_secret(p_key TEXT)
RETURNS TEXT LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT NULLIF((SELECT value FROM public.cau_hinh WHERE key = p_key), '');
$$;
COMMENT ON FUNCTION public.cfg_secret IS 'Lấy secret thật — CHỈ service_role (n8n). anon/authenticated bị REVOKE.';

-- Auto-update cap_nhat_luc khi UPDATE cau_hinh
CREATE OR REPLACE FUNCTION public.tg_cau_hinh_cap_nhat()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.cap_nhat_luc := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cau_hinh_cap_nhat ON public.cau_hinh;
CREATE TRIGGER trg_cau_hinh_cap_nhat
  BEFORE UPDATE ON public.cau_hinh
  FOR EACH ROW EXECUTE FUNCTION public.tg_cau_hinh_cap_nhat();

-- ============================================================
-- 3. BẢNG NGUOI_DUNG — danh sách + vai trò
-- ============================================================
-- Vì sao bảng riêng (không dùng auth.users): cần lưu vai_tro GMP 
-- (IPC/MEP/LOT/QA/ADMIN) — không có trong Supabase Auth chuẩn.
-- email là PK để khớp với auth.jwt()->>'email' khi check quyền RPC.
-- ============================================================
CREATE TABLE public.nguoi_dung (
  email       TEXT PRIMARY KEY,
  ho_ten      TEXT NOT NULL,
  vai_tro     TEXT NOT NULL CHECK (vai_tro IN ('IPC','MEP','LOT','QA','ADMIN','SYSTEM')),
  so_dien_thoai TEXT,
  ghi_chu     TEXT,
  kich_hoat   BOOLEAN NOT NULL DEFAULT true,
  tao_luc     TIMESTAMPTZ NOT NULL DEFAULT now(),
  cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nguoi_dung_vai_tro ON public.nguoi_dung(vai_tro) WHERE kich_hoat;

COMMENT ON TABLE  public.nguoi_dung IS 'Danh sách người dùng + vai trò GMP. PK email khớp Supabase Auth.';
COMMENT ON COLUMN public.nguoi_dung.vai_tro IS 'IPC=Hiện trường, MEP=Cơ điện, LOT=Trực HSL, QA=Kiểm soát, ADMIN=Quản trị, SYSTEM=Hệ thống tự động';

-- ============================================================
-- 4. BẢNG PHONG_SACH — 57 phòng (master data)
-- ============================================================
-- Vì sao tách bảng: thông tin tĩnh của phòng (mã, tên, khu, AHU, ưu tiên)
-- không đổi theo từng giờ. Cảm biến/giới hạn tách sang bảng cam_bien.
-- ============================================================
CREATE TABLE public.phong_sach (
  ma_phong       TEXT PRIMARY KEY,
  ten_phong      TEXT NOT NULL,
  khu_vuc        TEXT NOT NULL,
  ahu            TEXT,
  muc_uu_tien    TEXT NOT NULL CHECK (muc_uu_tien IN ('P1','P2','P3')),
  cap_phong_sach TEXT,                              -- Grade A/B/C/D (GMP)
  mo_ta_chuc_nang TEXT,
  ghi_chu        TEXT,
  thieu_du_lieu  BOOLEAN NOT NULL DEFAULT false,    -- true khi sensor lỗi
  kich_hoat      BOOLEAN NOT NULL DEFAULT true,
  tao_luc        TIMESTAMPTZ NOT NULL DEFAULT now(),
  cap_nhat_luc   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phong_sach_khu_vuc ON public.phong_sach(khu_vuc) WHERE kich_hoat;
CREATE INDEX idx_phong_sach_ahu     ON public.phong_sach(ahu)     WHERE kich_hoat;
CREATE INDEX idx_phong_sach_uu_tien ON public.phong_sach(muc_uu_tien) WHERE kich_hoat;

COMMENT ON TABLE  public.phong_sach IS '57 phòng sạch CPC1 — master data tĩnh';
COMMENT ON COLUMN public.phong_sach.muc_uu_tien IS 'P1=Trọng yếu, P2=Quan trọng, P3=Thường';
COMMENT ON COLUMN public.phong_sach.thieu_du_lieu IS 'true = sensor đang mất kết nối, không tính KPI';

-- ============================================================
-- 5. BẢNG CAM_BIEN — cảm biến mỗi phòng + giới hạn
-- ============================================================
-- Vì sao tách: mỗi phòng có 0-3 cảm biến (DP/RH/T) với giới hạn khác nhau.
-- Tách bảng để: (1) thêm/bớt cảm biến không ảnh hưởng phòng,
-- (2) sửa giới hạn riêng từng cảm biến, (3) audit thay đổi giới hạn dễ hơn.
-- ============================================================
CREATE TABLE public.cam_bien (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ma_phong        TEXT NOT NULL REFERENCES public.phong_sach(ma_phong) ON DELETE CASCADE,
  loai_cam_bien   TEXT NOT NULL CHECK (loai_cam_bien IN ('DP','RH','T')),
  ten_hien_thi    TEXT,                             -- tự sinh nếu null
  don_vi          TEXT NOT NULL,                    -- 'Pa', '%', '°C'
  gioi_han_duoi   NUMERIC,                          -- min hợp lệ
  gioi_han_tren   NUMERIC,                          -- max hợp lệ
  hieu_chuan_han  DATE,                             -- ngày hiệu chuẩn tiếp theo
  kich_hoat       BOOLEAN NOT NULL DEFAULT true,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  cap_nhat_luc    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ma_phong, loai_cam_bien)
);

CREATE INDEX idx_cam_bien_phong ON public.cam_bien(ma_phong) WHERE kich_hoat;

COMMENT ON TABLE  public.cam_bien IS 'Cảm biến của mỗi phòng (DP/RH/T) kèm giới hạn min-max';
COMMENT ON COLUMN public.cam_bien.gioi_han_duoi IS 'Giá trị tối thiểu hợp lệ (vd DP ≥ 12.5 Pa cho phòng P1)';
COMMENT ON COLUMN public.cam_bien.gioi_han_tren IS 'Giá trị tối đa hợp lệ (vd T ≤ 24°C cho P1/P2)';

-- Auto-update cap_nhat_luc
DROP TRIGGER IF EXISTS trg_phong_sach_cap_nhat ON public.phong_sach;
CREATE TRIGGER trg_phong_sach_cap_nhat
  BEFORE UPDATE ON public.phong_sach
  FOR EACH ROW EXECUTE FUNCTION public.tg_cau_hinh_cap_nhat();

DROP TRIGGER IF EXISTS trg_cam_bien_cap_nhat ON public.cam_bien;
CREATE TRIGGER trg_cam_bien_cap_nhat
  BEFORE UPDATE ON public.cam_bien
  FOR EACH ROW EXECUTE FUNCTION public.tg_cau_hinh_cap_nhat();

DROP TRIGGER IF EXISTS trg_nguoi_dung_cap_nhat ON public.nguoi_dung;
CREATE TRIGGER trg_nguoi_dung_cap_nhat
  BEFORE UPDATE ON public.nguoi_dung
  FOR EACH ROW EXECUTE FUNCTION public.tg_cau_hinh_cap_nhat();

-- ============================================================
-- KIỂM TRA
-- ============================================================
DO $$
DECLARE 
  v_so_key INT;
BEGIN
  SELECT count(*) INTO v_so_key FROM public.cau_hinh;
  RAISE NOTICE '✓ File 01 đã chạy xong. % key trong cau_hinh.', v_so_key;
END $$;

SELECT 
  '✅ FILE 01 OK' AS ket_qua,
  (SELECT count(*) FROM public.cau_hinh)    AS so_cau_hinh,
  (SELECT count(*) FROM public.phong_sach)  AS so_phong,
  (SELECT count(*) FROM public.cam_bien)    AS so_cam_bien,
  (SELECT count(*) FROM public.nguoi_dung)  AS so_nguoi_dung;
