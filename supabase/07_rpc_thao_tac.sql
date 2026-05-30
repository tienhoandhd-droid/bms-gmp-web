-- ============================================================
-- 07_rpc_thao_tac.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 7/11
--
-- MỤC ĐÍCH: các RPC GHI dữ liệu (web + email gọi).
-- Mọi RPC kiểm quyền bằng auth.jwt()->>'email' khớp nguoi_dung.vai_tro,
-- rồi tra quy_tac_chuyen_trang_thai để quyết định cho phép hay không.
--
--   • rpc_thao_tac_su_co       — TRÁI TIM hệ thống: chuyển trạng thái sự cố
--   • rpc_dung_canh_bao        — tắt/bật cảnh báo 1 sự cố (LOT/ADMIN)
--   • rpc_them_phong           — thêm phòng (QA/ADMIN)
--   • rpc_sua_phong            — sửa thông tin phòng
--   • rpc_xoa_phong            — xóa phòng
--   • rpc_sua_gioi_han_cam_bien — sửa min/max cảm biến
--   • rpc_them_cam_bien        — thêm cảm biến cho phòng
--   • rpc_xoa_cam_bien         — bỏ cảm biến
--   • rpc_sua_nguong_canh_bao  — sửa ngưỡng notice/warning/action
--
-- BẢO MẬT: tất cả SECURITY DEFINER + SET search_path. 
-- Hàm ghi sự cố set app.tg_bypass_append_only='on' để qua trigger.
-- ============================================================

-- ------------------------------------------------------------
-- HELPER: lấy email người gọi từ JWT (hoặc tham số khi gọi nội bộ)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lay_email_nguoi_goi(p_actor TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql STABLE 
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT;
  v_bat_buoc_dang_nhap BOOLEAN := public.cfg_bool('web_yeu_cau_dang_nhap', false);
BEGIN
  -- Ưu tiên JWT
  BEGIN
    v_email := NULLIF(current_setting('request.jwt.claims', true)::json->>'email', '');
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  -- Nếu chưa có JWT
  IF v_email IS NULL THEN
    IF v_bat_buoc_dang_nhap THEN
      -- PROD: bắt buộc JWT, không nhận p_actor giả
      RETURN NULL;
    ELSE
      -- TEST/demo: cho phép truyền p_actor
      v_email := NULLIF(p_actor, '');
    END IF;
  END IF;

  RETURN v_email;
END $$;

COMMENT ON FUNCTION public.lay_email_nguoi_goi IS 'Lấy email người gọi từ JWT. Khi web_yeu_cau_dang_nhap=true (PROD) thì không nhận p_actor giả.';

-- ============================================================
-- 1. rpc_thao_tac_su_co — TRÁI TIM: chuyển trạng thái sự cố
-- ============================================================
-- Web gọi:  { p_ma_su_co, p_hanh_dong, p_ly_do, p_actor (chỉ TEST) }
-- Email gọi: { p_token } — tự suy ma_su_co + hanh_dong từ token
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_thao_tac_su_co(
  p_ma_su_co   BIGINT       DEFAULT NULL,
  p_hanh_dong  TEXT         DEFAULT NULL,
  p_ly_do      TEXT         DEFAULT NULL,
  p_actor      TEXT         DEFAULT NULL,
  p_token      TEXT         DEFAULT NULL,
  p_nguon      TEXT         DEFAULT 'web'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email        TEXT;
  v_vai_tro      TEXT;
  v_su_co        public.su_co%ROWTYPE;
  v_quy_tac      public.quy_tac_chuyen_trang_thai%ROWTYPE;
  v_token_hash   TEXT;
  v_token        public.ma_token_email%ROWTYPE;
  v_trang_thai_moi TEXT;
  v_dong         BOOLEAN;
BEGIN
  -- ===== A. Xử lý token (luồng email) =====
  IF p_token IS NOT NULL AND p_token <> '' THEN
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
    SELECT * INTO v_token FROM public.ma_token_email WHERE token_hash = v_token_hash;

    IF v_token.token_hash IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'loi', 'TOKEN_KHONG_TON_TAI', 
        'thong_bao', 'Liên kết không hợp lệ. Có thể bạn đang bấm email cũ.');
    END IF;
    IF v_token.da_dung_luc IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'loi', 'TOKEN_DA_DUNG',
        'thong_bao', 'Liên kết này đã được sử dụng. Vui lòng dùng email mới nhất.');
    END IF;
    IF now() > v_token.het_han_luc THEN
      RETURN jsonb_build_object('ok', false, 'loi', 'TOKEN_HET_HAN',
        'thong_bao', 'Liên kết đã hết hạn (quá 72 giờ). Vui lòng thao tác trên web.');
    END IF;

    p_ma_su_co  := v_token.ma_su_co;
    p_hanh_dong := v_token.hanh_dong;
    v_vai_tro   := v_token.vai_tro_can;
    v_email     := COALESCE(NULLIF(p_actor,''), 'email:' || v_token.vai_tro_can);
    p_nguon     := 'email';
  ELSE
    -- ===== B. Luồng web: xác thực qua JWT =====
    v_email := public.lay_email_nguoi_goi(p_actor);
    IF v_email IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP',
        'thong_bao', 'Bạn cần đăng nhập để thao tác.');
    END IF;

    SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung 
    WHERE email = v_email AND kich_hoat;
    IF v_vai_tro IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN',
        'thong_bao', 'Tài khoản không tồn tại hoặc đã bị khóa.');
    END IF;
  END IF;

  -- ===== C. Validate input =====
  IF p_ma_su_co IS NULL OR p_hanh_dong IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'THIEU_THAM_SO',
      'thong_bao', 'Thiếu mã sự cố hoặc hành động.');
  END IF;

  SELECT * INTO v_su_co FROM public.su_co WHERE ma_su_co = p_ma_su_co;
  IF v_su_co.ma_su_co IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'SU_CO_KHONG_TON_TAI',
      'thong_bao', 'Không tìm thấy sự cố.');
  END IF;
  IF v_su_co.thoi_gian_dong IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'SU_CO_DA_DONG',
      'thong_bao', 'Sự cố này đã được đóng.');
  END IF;

  -- ===== D. Tra quy tắc state machine =====
  -- Tìm quy tắc: ưu tiên trạng thái cụ thể, fallback '*'
  SELECT * INTO v_quy_tac FROM public.quy_tac_chuyen_trang_thai
  WHERE hanh_dong = p_hanh_dong AND vai_tro = v_vai_tro
    AND trang_thai_truoc IN (v_su_co.trang_thai_hien_tai, '*')
    AND kich_hoat
  ORDER BY CASE WHEN trang_thai_truoc = v_su_co.trang_thai_hien_tai THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_quy_tac.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_DUOC_PHEP',
      'thong_bao', format('Vai trò %s không được phép "%s" khi sự cố đang ở trạng thái "%s".',
        v_vai_tro, p_hanh_dong, v_su_co.trang_thai_hien_tai));
  END IF;

  -- ===== E. Tính trạng thái mới =====
  IF v_quy_tac.giu_trang_thai THEN
    v_trang_thai_moi := v_su_co.trang_thai_hien_tai;  -- chỉ log, không đổi
  ELSE
    v_trang_thai_moi := v_quy_tac.trang_thai_sau;
  END IF;
  v_dong := v_quy_tac.dong_su_co;

  -- ===== F. Ghi (bật bypass trigger append-only) =====
  PERFORM set_config('app.tg_bypass_append_only', 'on', true);
  PERFORM set_config('app.actor', v_email, true);

  -- Cập nhật sự cố
  UPDATE public.su_co
  SET trang_thai_hien_tai = v_trang_thai_moi,
      thoi_gian_lan_cuoi_quan_sat = now(),
      thoi_gian_dong = CASE WHEN v_dong THEN now() ELSE thoi_gian_dong END,
      du_lieu = du_lieu || jsonb_build_object('thao_tac_cuoi', jsonb_build_object(
        'boi', v_email, 'hanh_dong', p_hanh_dong, 'luc', now()))
  WHERE ma_su_co = p_ma_su_co;

  -- Ghi audit trail (append-only — INSERT luôn được phép)
  INSERT INTO public.lich_su_su_co(
    thuoc_thu_nghiem, ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong,
    trang_thai_truoc, trang_thai_sau, ly_do, nguon
  ) VALUES (
    v_su_co.thuoc_thu_nghiem, p_ma_su_co, v_email, v_vai_tro, p_hanh_dong,
    v_su_co.trang_thai_hien_tai, v_trang_thai_moi, p_ly_do, p_nguon
  );

  -- Consume token (nếu là luồng email)
  IF p_token IS NOT NULL AND p_token <> '' THEN
    UPDATE public.ma_token_email
    SET da_dung_luc = now(), da_dung_boi = v_email
    WHERE token_hash = v_token_hash;
  END IF;

  PERFORM set_config('app.tg_bypass_append_only', 'off', true);

  RETURN jsonb_build_object(
    'ok', true,
    'ma_su_co', p_ma_su_co,
    'trang_thai_cu', v_su_co.trang_thai_hien_tai,
    'trang_thai_moi', v_trang_thai_moi,
    'da_dong', v_dong,
    'nguoi_thao_tac', v_email,
    'thong_bao', CASE WHEN v_dong THEN 'Đã ghi nhận và đóng sự cố.' ELSE 'Đã ghi nhận thao tác.' END
  );
END $$;

COMMENT ON FUNCTION public.rpc_thao_tac_su_co IS 'Trái tim hệ thống: chuyển trạng thái sự cố. Web (JWT) hoặc email (token). Kiểm quy_tac_chuyen_trang_thai.';

-- ============================================================
-- 2. rpc_dung_canh_bao — tắt/bật cảnh báo 1 sự cố
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_dung_canh_bao(
  p_ma_su_co BIGINT,
  p_tat      BOOLEAN,
  p_ly_do    TEXT DEFAULT NULL,
  p_actor    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email   TEXT;
  v_vai_tro TEXT;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP', 'thong_bao', 'Bạn cần đăng nhập.');
  END IF;

  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','LOT') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN',
      'thong_bao', 'Chỉ Quản trị hoặc Trực HSL được dừng/bật cảnh báo.');
  END IF;

  PERFORM set_config('app.tg_bypass_append_only', 'on', true);
  UPDATE public.su_co
  SET da_tat_canh_bao = p_tat,
      ly_do_tat_canh_bao = CASE WHEN p_tat THEN p_ly_do ELSE NULL END
  WHERE ma_su_co = p_ma_su_co AND thoi_gian_dong IS NULL;

  INSERT INTO public.lich_su_su_co(ma_su_co, nguoi_thao_tac, vai_tro, hanh_dong, ly_do, nguon)
  VALUES (p_ma_su_co, v_email, v_vai_tro, 
          CASE WHEN p_tat THEN 'dung_canh_bao' ELSE 'bat_lai_canh_bao' END, p_ly_do, 'web');
  PERFORM set_config('app.tg_bypass_append_only', 'off', true);

  RETURN jsonb_build_object('ok', true, 'da_tat', p_tat,
    'thong_bao', CASE WHEN p_tat THEN 'Đã dừng cảnh báo.' ELSE 'Đã bật lại cảnh báo.' END);
END $$;

-- ============================================================
-- 3. rpc_them_phong — thêm phòng (QA/ADMIN)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_them_phong(
  p_ma_phong    TEXT,
  p_ten_phong   TEXT,
  p_khu_vuc     TEXT,
  p_ahu         TEXT,
  p_muc_uu_tien TEXT,
  p_ghi_chu     TEXT    DEFAULT NULL,
  p_thieu_du_lieu BOOLEAN DEFAULT false,
  p_cam_bien    JSONB   DEFAULT '[]'::jsonb,   -- [{loai,min,max}]
  p_actor       TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email   TEXT;
  v_vai_tro TEXT;
  v_cb      JSONB;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP', 'thong_bao', 'Bạn cần đăng nhập.');
  END IF;
  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','QA') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN', 'thong_bao', 'Chỉ QA/Quản trị được thêm phòng.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.phong_sach WHERE ma_phong = p_ma_phong) THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'PHONG_DA_TON_TAI', 'thong_bao', 'Mã phòng đã tồn tại.');
  END IF;

  PERFORM set_config('app.actor', v_email, true);
  INSERT INTO public.phong_sach(ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, ghi_chu, thieu_du_lieu)
  VALUES (p_ma_phong, COALESCE(NULLIF(p_ten_phong,''), p_ma_phong), p_khu_vuc, p_ahu, p_muc_uu_tien, p_ghi_chu, p_thieu_du_lieu);

  -- Thêm cảm biến
  FOR v_cb IN SELECT * FROM jsonb_array_elements(p_cam_bien) LOOP
    INSERT INTO public.cam_bien(ma_phong, loai_cam_bien, don_vi, gioi_han_duoi, gioi_han_tren)
    VALUES (
      p_ma_phong, 
      v_cb->>'loai',
      CASE v_cb->>'loai' WHEN 'DP' THEN 'Pa' WHEN 'RH' THEN '%' WHEN 'T' THEN '°C' ELSE '' END,
      NULLIF(v_cb->>'min','')::numeric, 
      NULLIF(v_cb->>'max','')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'ma_phong', p_ma_phong, 'thong_bao', 'Đã thêm phòng ' || p_ma_phong || '.');
END $$;

-- ============================================================
-- 4. rpc_sua_phong — sửa thông tin phòng
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sua_phong(
  p_ma_phong    TEXT,
  p_patch       JSONB,   -- {ten_phong, khu_vuc, ahu, muc_uu_tien, ghi_chu, thieu_du_lieu}
  p_actor       TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email   TEXT;
  v_vai_tro TEXT;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP'); END IF;
  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','QA') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN', 'thong_bao', 'Chỉ QA/Quản trị được sửa phòng.');
  END IF;

  PERFORM set_config('app.actor', v_email, true);
  UPDATE public.phong_sach SET
    ten_phong     = COALESCE(p_patch->>'ten_phong', ten_phong),
    khu_vuc       = COALESCE(p_patch->>'khu_vuc', khu_vuc),
    ahu           = COALESCE(p_patch->>'ahu', ahu),
    muc_uu_tien   = COALESCE(p_patch->>'muc_uu_tien', muc_uu_tien),
    ghi_chu       = COALESCE(p_patch->>'ghi_chu', ghi_chu),
    thieu_du_lieu = COALESCE((p_patch->>'thieu_du_lieu')::boolean, thieu_du_lieu)
  WHERE ma_phong = p_ma_phong;

  RETURN jsonb_build_object('ok', true, 'thong_bao', 'Đã cập nhật phòng ' || p_ma_phong || '.');
END $$;

-- ============================================================
-- 5. rpc_xoa_phong
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_xoa_phong(
  p_ma_phong TEXT,
  p_actor    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email   TEXT;
  v_vai_tro TEXT;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP'); END IF;
  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','QA') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN', 'thong_bao', 'Chỉ QA/Quản trị được xóa phòng.');
  END IF;

  PERFORM set_config('app.actor', v_email, true);
  -- Soft delete: chỉ tắt kích hoạt để giữ dữ liệu lịch sử (ALCOA+)
  UPDATE public.phong_sach SET kich_hoat = false WHERE ma_phong = p_ma_phong;
  UPDATE public.cam_bien SET kich_hoat = false WHERE ma_phong = p_ma_phong;

  RETURN jsonb_build_object('ok', true, 'thong_bao', 'Đã ẩn phòng ' || p_ma_phong || ' (giữ dữ liệu lịch sử).');
END $$;

COMMENT ON FUNCTION public.rpc_xoa_phong IS 'Soft-delete phòng (kich_hoat=false) — giữ dữ liệu lịch sử theo ALCOA+.';

-- ============================================================
-- 6. rpc_sua_gioi_han_cam_bien
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sua_gioi_han_cam_bien(
  p_ma_phong      TEXT,
  p_loai_cam_bien TEXT,
  p_gioi_han_duoi NUMERIC,
  p_gioi_han_tren NUMERIC,
  p_actor         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email   TEXT;
  v_vai_tro TEXT;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP'); END IF;
  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','QA') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN', 'thong_bao', 'Chỉ QA/Quản trị được sửa giới hạn.');
  END IF;

  PERFORM set_config('app.actor', v_email, true);
  UPDATE public.cam_bien 
  SET gioi_han_duoi = p_gioi_han_duoi, gioi_han_tren = p_gioi_han_tren
  WHERE ma_phong = p_ma_phong AND loai_cam_bien = p_loai_cam_bien;

  -- Log riêng vào lich_su_cau_hinh (vì cam_bien không có trigger auto-log)
  INSERT INTO public.lich_su_cau_hinh(nguoi_thay_doi, loai_thay_doi, bang, key_or_id, gia_tri_moi_mask)
  VALUES (v_email, 'UPDATE', 'cam_bien', p_ma_phong || '/' || p_loai_cam_bien,
          format('min=%s, max=%s', p_gioi_han_duoi, p_gioi_han_tren));

  RETURN jsonb_build_object('ok', true, 'thong_bao', 
    format('Đã sửa giới hạn %s phòng %s: %s–%s.', p_loai_cam_bien, p_ma_phong, p_gioi_han_duoi, p_gioi_han_tren));
END $$;

-- ============================================================
-- 7. rpc_them_cam_bien / rpc_xoa_cam_bien
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_them_cam_bien(
  p_ma_phong      TEXT,
  p_loai_cam_bien TEXT,
  p_gioi_han_duoi NUMERIC DEFAULT NULL,
  p_gioi_han_tren NUMERIC DEFAULT NULL,
  p_actor         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email   TEXT;
  v_vai_tro TEXT;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP'); END IF;
  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','QA') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN');
  END IF;

  PERFORM set_config('app.actor', v_email, true);
  INSERT INTO public.cam_bien(ma_phong, loai_cam_bien, don_vi, gioi_han_duoi, gioi_han_tren)
  VALUES (p_ma_phong, p_loai_cam_bien,
          CASE p_loai_cam_bien WHEN 'DP' THEN 'Pa' WHEN 'RH' THEN '%' WHEN 'T' THEN '°C' ELSE '' END,
          p_gioi_han_duoi, p_gioi_han_tren)
  ON CONFLICT (ma_phong, loai_cam_bien) DO UPDATE 
    SET kich_hoat = true, gioi_han_duoi = EXCLUDED.gioi_han_duoi, gioi_han_tren = EXCLUDED.gioi_han_tren;

  RETURN jsonb_build_object('ok', true, 'thong_bao', 
    format('Đã thêm cảm biến %s cho phòng %s.', p_loai_cam_bien, p_ma_phong));
END $$;

CREATE OR REPLACE FUNCTION public.rpc_xoa_cam_bien(
  p_ma_phong      TEXT,
  p_loai_cam_bien TEXT,
  p_actor         TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email   TEXT;
  v_vai_tro TEXT;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP'); END IF;
  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','QA') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN');
  END IF;

  PERFORM set_config('app.actor', v_email, true);
  UPDATE public.cam_bien SET kich_hoat = false 
  WHERE ma_phong = p_ma_phong AND loai_cam_bien = p_loai_cam_bien;

  RETURN jsonb_build_object('ok', true, 'thong_bao', 
    format('Đã bỏ cảm biến %s khỏi phòng %s.', p_loai_cam_bien, p_ma_phong));
END $$;

-- ============================================================
-- 8. rpc_sua_nguong_canh_bao — sửa ngưỡng (Cài đặt)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_sua_nguong_canh_bao(
  p_nguong_chu_y    INT,
  p_nguong_canh_bao INT,
  p_nguong_hanh_dong INT,
  p_actor           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email   TEXT;
  v_vai_tro TEXT;
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP'); END IF;
  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','QA') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN', 'thong_bao', 'Chỉ QA/Quản trị được sửa ngưỡng.');
  END IF;

  PERFORM set_config('app.actor', v_email, true);
  UPDATE public.cau_hinh SET value = p_nguong_chu_y::text     WHERE key = 'nguong_chu_y';
  UPDATE public.cau_hinh SET value = p_nguong_canh_bao::text  WHERE key = 'nguong_canh_bao';
  UPDATE public.cau_hinh SET value = p_nguong_hanh_dong::text WHERE key = 'nguong_hanh_dong';

  RETURN jsonb_build_object('ok', true, 'thong_bao', 'Đã cập nhật ngưỡng cảnh báo.');
END $$;

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 07 OK' AS ket_qua,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace 
   WHERE n.nspname='public' AND p.proname LIKE 'rpc_%') AS so_rpc_da_tao;
