-- ============================================================
-- 04_email_va_token.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 4/11
--
-- MỤC ĐÍCH: tạo các bảng liên quan email và OpenAI:
--   • ma_token_email   — token sha256 dùng-một-lần cho nút email
--   • email_da_gui     — outbox + idempotency chống gửi trùng
--   • bao_cao_ai       — lưu mọi kết quả phân tích AI tiếng Việt
--
-- Vì sao tách:
--   • Token: cần TTL, FOR UPDATE check, không trộn với bảng khác
--   • Email outbox: cần idempotency_key UNIQUE → chống WF2 gửi trùng giờ
--   • Báo cáo AI: cần lưu để tab Báo cáo đọc lại + gửi email thủ công
-- ============================================================

-- ============================================================
-- 1. MA_TOKEN_EMAIL — token nút bấm email
-- ============================================================
-- Khi WF2 build email, mỗi nút (Bình thường/Bất thường/Chờ) có
-- 1 token sha256 32-byte random. Click → webhook xác thực → consume.
-- Đảm bảo: dùng-một-lần, TTL 72h, mỗi nút token riêng.
-- ============================================================
CREATE TABLE public.ma_token_email (
  token_hash      TEXT PRIMARY KEY,                  -- sha256(token plain) hex
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  ma_su_co        BIGINT NOT NULL REFERENCES public.su_co(ma_su_co),
  hanh_dong       TEXT NOT NULL,                     -- ipc_tiep_nhan, mep_xu_ly_xong...
  vai_tro_can     TEXT NOT NULL,                     -- IPC/MEP/LOT/QA
  
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  het_han_luc     TIMESTAMPTZ NOT NULL,
  
  da_dung_luc     TIMESTAMPTZ,
  da_dung_boi     TEXT,                              -- email người click (nếu có)
  dia_chi_ip      TEXT,
  
  nguon           TEXT NOT NULL DEFAULT 'email',     -- email/sms
  ma_lan_chay_n8n TEXT,
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ma_token_email_su_co     ON public.ma_token_email(ma_su_co, hanh_dong, het_han_luc DESC);
CREATE INDEX idx_ma_token_email_chua_dung ON public.ma_token_email(het_han_luc) WHERE da_dung_luc IS NULL;

COMMENT ON TABLE public.ma_token_email IS 'Token sha256 dùng-một-lần cho nút email. TTL 72h. WF2 tạo, RPC consume.';

-- ============================================================
-- 2. EMAIL_DA_GUI — outbox + idempotency
-- ============================================================
-- Idempotency_key đảm bảo WF2 chạy lại cùng giờ không gửi email trùng.
-- VD: idempotency_key = 'DIGEST|C1|2026-05-29T22:00' → unique
-- ============================================================
CREATE TABLE public.email_da_gui (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  loai_email      TEXT NOT NULL CHECK (loai_email IN ('DIGEST_CANH_BAO','BAO_CAO_NGAY','BAO_CAO_TUAN','BAO_CAO_THANG','LOI_HE_THONG','TEST')),
  idempotency_key TEXT NOT NULL UNIQUE,
  gio_digest      TIMESTAMPTZ,                       -- giờ tròn của digest (cho dedup)
  
  nguoi_nhan_to   TEXT NOT NULL,                     -- "a@x.vn,b@x.vn"
  nguoi_nhan_cc   TEXT,
  nguoi_gui       TEXT,
  tieu_de         TEXT NOT NULL,
  noi_dung_html   TEXT NOT NULL,
  so_su_co        INT NOT NULL DEFAULT 0,
  
  trang_thai      TEXT NOT NULL DEFAULT 'CHO_GUI'
                  CHECK (trang_thai IN ('CHO_GUI','DANG_GUI','DA_GUI','THAT_BAI','HUY')),
  gui_luc         TIMESTAMPTZ,
  phan_hoi_smtp   JSONB,
  loi_van_tat     TEXT,
  
  ma_lan_chay_n8n TEXT,
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_email_da_gui_trang_thai ON public.email_da_gui(trang_thai, tao_luc DESC);
CREATE INDEX idx_email_da_gui_loai       ON public.email_da_gui(loai_email, gio_digest DESC);

COMMENT ON TABLE public.email_da_gui IS 'Outbox email. idempotency_key chống gửi trùng (vd cùng giờ digest C1).';
COMMENT ON COLUMN public.email_da_gui.idempotency_key IS 'Pattern: LOAI|SCOPE|HOUR — vd DIGEST|C1|2026-05-29T22:00';

-- ============================================================
-- 3. BAO_CAO_AI — kết quả phân tích AI
-- ============================================================
-- Web tab "Xu hướng" có nút "AI phân tích" — kết quả lưu vào đây.
-- WF3 daily/weekly/monthly cũng ghi vào đây.
-- Tab "Báo cáo" đọc bảng này để hiển thị + cho gửi email lại.
-- ============================================================
CREATE TABLE public.bao_cao_ai (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thuoc_thu_nghiem BOOLEAN NOT NULL DEFAULT false,
  tao_luc         TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  loai_bao_cao    TEXT NOT NULL                      -- daily/weekly/monthly/ad_hoc
                  CHECK (loai_bao_cao IN ('NGAY','TUAN','THANG','AD_HOC')),
  -- Phạm vi phân tích
  scope_type      TEXT NOT NULL,                     -- TOTAL/AREA/AHU/ROOM
  scope_id        TEXT NOT NULL DEFAULT 'ALL',
  ten_scope       TEXT,
  sensor_type     TEXT NOT NULL DEFAULT 'ALL',
  
  -- Khoảng thời gian phân tích
  pham_vi_ngay    INT,                               -- 1/7/30/90
  thoi_gian_tu    TIMESTAMPTZ,
  thoi_gian_den   TIMESTAMPTZ,
  
  -- Kết quả AI
  noi_dung_phan_tich TEXT NOT NULL,                  -- text tiếng Việt 7 mục
  muc_canh_bao    INT NOT NULL CHECK (muc_canh_bao BETWEEN 0 AND 3),
  -- 0=Bình thường, 1=Chú ý, 2=Cảnh báo, 3=Hành động
  trang_thai_ai   TEXT NOT NULL DEFAULT 'OK'         -- OK/FALLBACK/FAILED
                  CHECK (trang_thai_ai IN ('OK','FALLBACK','FAILED')),
  model_dung      TEXT,                              -- gpt-4o-mini
  
  -- Truy nguyên
  nguoi_yeu_cau   TEXT,                              -- email user (web) hoặc 'system' (WF3)
  da_gui_email    BOOLEAN NOT NULL DEFAULT false,
  email_da_gui_id UUID REFERENCES public.email_da_gui(id),
  
  du_lieu         JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_bao_cao_ai_thoi_gian ON public.bao_cao_ai(tao_luc DESC);
CREATE INDEX idx_bao_cao_ai_scope     ON public.bao_cao_ai(scope_type, scope_id, tao_luc DESC);
CREATE INDEX idx_bao_cao_ai_muc       ON public.bao_cao_ai(muc_canh_bao DESC, tao_luc DESC);

COMMENT ON TABLE public.bao_cao_ai IS 'Kết quả phân tích AI tiếng Việt. Web tab "Xu hướng" + WF3 đều ghi.';

-- ============================================================
-- TRIGGER ngăn xóa
-- ============================================================
DROP TRIGGER IF EXISTS trg_chan_xoa_ma_token  ON public.ma_token_email;
DROP TRIGGER IF EXISTS trg_chan_xoa_email     ON public.email_da_gui;
DROP TRIGGER IF EXISTS trg_chan_xoa_bao_cao   ON public.bao_cao_ai;

CREATE TRIGGER trg_chan_xoa_ma_token
  BEFORE DELETE ON public.ma_token_email
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_xoa_kpi();   -- tái dùng

CREATE TRIGGER trg_chan_xoa_email
  BEFORE DELETE ON public.email_da_gui
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_xoa_kpi();

CREATE TRIGGER trg_chan_xoa_bao_cao
  BEFORE DELETE ON public.bao_cao_ai
  FOR EACH ROW EXECUTE FUNCTION public.tg_chan_xoa_kpi();

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 04 OK' AS ket_qua,
  (SELECT count(*) FROM information_schema.tables 
   WHERE table_schema='public' 
     AND table_name IN ('ma_token_email','email_da_gui','bao_cao_ai')
  ) AS bang_email_ai_da_tao;
