-- ============================================================
-- 06_view_dashboard.sql
-- ------------------------------------------------------------
-- BMS GMP v10 — Pha 1 · File 6/11
--
-- MỤC ĐÍCH: tạo các VIEW tiếng Việt để web app đọc dữ liệu.
-- Web KHÔNG truy vấn bảng thô — chỉ qua view xem_*.
-- Khi schema đổi, chỉ cần sửa view, web không phải sửa code.
--
-- Các view (mapping với tab React):
--   • xem_tong_quan         — KPI 4 ô trang chủ
--   • xem_phong_co_kpi      — Card phòng (Home + tab Phòng)
--   • xem_su_co_dang_mo     — Bảng tab Sự cố
--   • xem_su_co_co_lich_su  — Sự cố + trail (cho modal phê duyệt)
--   • xem_su_co_can_gui_email — WF2 dùng
--   • xem_nhat_ky_thao_tac  — Tab Audit
--   • xem_canh_bao_he_thong — Sidebar trang chủ (4 cảnh báo)
--   • xem_xep_hang_rui_ro   — Tab Xu hướng — bảng ranking
--   • xem_cau_hinh_he_thong — Tab Cài đặt (mask secret)
--   • xem_lich_su_cau_hinh  — Tab Cài đặt
--   • xem_quy_trinh_sop     — Tab Audit
--   • xem_email_da_gui      — Tab Báo cáo
--   • xem_bao_cao_ai        — Tab Báo cáo
-- ============================================================

-- ============================================================
-- 1. xem_tong_quan — KPI 4 ô tab Tổng quan
-- ============================================================
-- React: { phong_dat, phong_khong_dat, phong_thieu_dl, su_co_p1_mo, tong_phong }
-- Logic: tỉ lệ đạt 1h gần nhất ≥ 80% = đạt; < 80% = không đạt; 
--        phong_sach.thieu_du_lieu = true → thiếu DL
-- ============================================================
CREATE OR REPLACE VIEW public.xem_tong_quan AS
WITH bucket_moi_nhat AS (
  SELECT max(bucket_utc) AS bucket FROM public.du_lieu_gio WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
),
phong_kpi AS (
  SELECT 
    p.ma_phong,
    p.thieu_du_lieu,
    -- Tỉ lệ đạt 1h gần nhất: 100 - max(oos_rate_pct) trên các sensor của phòng
    (100 - COALESCE(MAX(d.oos_rate_pct), 0))::numeric AS ti_le_dat_1h
  FROM public.phong_sach p
  LEFT JOIN public.du_lieu_gio d 
    ON d.ma_phong = p.ma_phong
   AND d.bucket_utc = (SELECT bucket FROM bucket_moi_nhat)
   AND d.thuoc_thu_nghiem = public.co_thu_nghiem()
  WHERE p.kich_hoat
  GROUP BY p.ma_phong, p.thieu_du_lieu
)
SELECT 
  (SELECT count(*) FROM public.phong_sach WHERE kich_hoat)::int AS tong_phong,
  COUNT(*) FILTER (WHERE NOT thieu_du_lieu AND ti_le_dat_1h >= 80)::int AS phong_dat,
  COUNT(*) FILTER (WHERE NOT thieu_du_lieu AND ti_le_dat_1h < 80)::int  AS phong_khong_dat,
  COUNT(*) FILTER (WHERE thieu_du_lieu)::int                            AS phong_thieu_dl,
  (SELECT count(*) FROM public.su_co WHERE thoi_gian_dong IS NULL AND thuoc_thu_nghiem = public.co_thu_nghiem())::int AS su_co_dang_mo,
  (SELECT count(*) FROM public.su_co WHERE thoi_gian_dong IS NULL AND muc_uu_tien='P1' AND thuoc_thu_nghiem = public.co_thu_nghiem())::int AS su_co_p1_mo
FROM phong_kpi;

COMMENT ON VIEW public.xem_tong_quan IS 'Phục vụ KPI 4 ô tab Tổng quan + sidebar P1';

-- ============================================================
-- 2. xem_phong_co_kpi — Card phòng + bảng quản lý
-- ============================================================
-- React: { id, name, area, ahu, priority, noData, note, sensors[] }
-- + KPI bổ sung: ti_le_dat, muc_canh_bao_hien_tai
-- ============================================================
CREATE OR REPLACE VIEW public.xem_phong_co_kpi AS
WITH bucket_moi_nhat AS (
  SELECT max(bucket_utc) AS bucket FROM public.du_lieu_gio WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
),
sensor_kpi AS (
  SELECT 
    d.ma_phong,
    d.oos_rate_pct,
    d.muc_canh_bao
  FROM public.du_lieu_gio d
  WHERE d.thuoc_thu_nghiem = public.co_thu_nghiem()
    AND d.bucket_utc = (SELECT bucket FROM bucket_moi_nhat)
),
phong_agg AS (
  SELECT 
    p.ma_phong,
    (100 - COALESCE(MAX(s.oos_rate_pct), 0))::numeric(5,1) AS ti_le_dat_1h,
    CASE 
      WHEN bool_or(s.muc_canh_bao = 'CRITICAL')  THEN 'CRITICAL'
      WHEN bool_or(s.muc_canh_bao = 'WARNING')   THEN 'WARNING'
      WHEN bool_or(s.muc_canh_bao = 'NOTICE')    THEN 'NOTICE'
      ELSE 'NORMAL'
    END AS muc_canh_bao_phong
  FROM public.phong_sach p
  LEFT JOIN sensor_kpi s ON s.ma_phong = p.ma_phong
  WHERE p.kich_hoat
  GROUP BY p.ma_phong
)
SELECT 
  p.ma_phong,
  p.ten_phong,
  p.khu_vuc,
  p.ahu,
  p.muc_uu_tien,
  p.cap_phong_sach,
  p.thieu_du_lieu,
  p.ghi_chu,
  -- KPI 1h
  CASE WHEN p.thieu_du_lieu THEN NULL ELSE pa.ti_le_dat_1h END AS ti_le_dat_1h,
  CASE WHEN p.thieu_du_lieu THEN 'MAT_DU_LIEU' ELSE pa.muc_canh_bao_phong END AS muc_canh_bao_phong,
  -- Danh sách cảm biến (JSONB)
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'loai_cam_bien', c.loai_cam_bien,
      'gioi_han_duoi', c.gioi_han_duoi,
      'gioi_han_tren', c.gioi_han_tren,
      'don_vi',        c.don_vi
    ) ORDER BY c.loai_cam_bien)
    FROM public.cam_bien c
    WHERE c.ma_phong = p.ma_phong AND c.kich_hoat
  ), '[]'::jsonb) AS cam_bien
FROM public.phong_sach p
LEFT JOIN phong_agg pa ON pa.ma_phong = p.ma_phong
WHERE p.kich_hoat;

COMMENT ON VIEW public.xem_phong_co_kpi IS 'Phòng + cảm biến + KPI 1h. Dùng cho Card phòng (Home + tab Phòng).';

-- ============================================================
-- 3. xem_su_co_dang_mo — Bảng tab Sự cố
-- ============================================================
-- React: { id (SC-XXXX), room, sensor (Chênh áp/DP), priority,
--          start (timestamp), duration (h), status, silenced, trail[] }
-- ============================================================
CREATE OR REPLACE VIEW public.xem_su_co_dang_mo AS
SELECT 
  'SC-' || lpad(s.ma_su_co::text, 4, '0') AS ma_hien_thi,
  s.ma_su_co,
  s.ma_phong                           AS phong,
  s.ten_phong,
  s.khu_vuc,
  s.ahu,
  s.muc_uu_tien                        AS uu_tien,
  CASE s.loai_cam_bien 
    WHEN 'DP' THEN 'Chênh áp (DP)' 
    WHEN 'RH' THEN 'Độ ẩm (RH)' 
    WHEN 'T'  THEN 'Nhiệt độ (T)' 
    ELSE s.loai_cam_bien 
  END AS cam_bien_vi,
  s.loai_cam_bien,
  s.muc_canh_bao_hien_tai              AS muc_canh_bao,
  s.trang_thai_hien_tai                AS trang_thai,
  s.thoi_gian_mo                       AS bat_dau,
  ROUND(EXTRACT(EPOCH FROM (now() - s.thoi_gian_mo))/3600.0, 1) AS keo_dai_gio,
  s.da_tat_canh_bao,
  -- Trail
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      't',      to_char(l.thoi_diem AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI:SS'),
      'who',    l.nguoi_thao_tac,
      'role',   l.vai_tro,
      'act',    l.hanh_dong,
      'ly_do',  l.ly_do
    ) ORDER BY l.thoi_diem)
    FROM public.lich_su_su_co l 
    WHERE l.ma_su_co = s.ma_su_co
  ), '[]'::jsonb) AS lich_su
FROM public.su_co s
WHERE s.thoi_gian_dong IS NULL 
  AND s.thuoc_thu_nghiem = public.co_thu_nghiem()
ORDER BY 
  CASE s.muc_uu_tien WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
  s.thoi_gian_mo;

COMMENT ON VIEW public.xem_su_co_dang_mo IS 'Sự cố đang mở + trail. Dùng cho bảng tab Sự cố và modal phê duyệt.';

-- ============================================================
-- 4. xem_su_co_can_gui_email — WF2 đọc danh sách cần email
-- ============================================================
-- Sự cố đang mở + ưu tiên P1/P2 + chưa tắt cảnh báo + thuộc khu cấu hình
-- ============================================================
CREATE OR REPLACE VIEW public.xem_su_co_can_gui_email AS
SELECT 
  s.ma_su_co,
  s.ma_phong,
  s.ten_phong,
  s.khu_vuc,
  s.ahu,
  s.muc_uu_tien,
  s.loai_cam_bien,
  s.muc_canh_bao_hien_tai,
  s.trang_thai_hien_tai,
  s.thoi_gian_mo,
  ROUND(EXTRACT(EPOCH FROM (now() - s.thoi_gian_mo))/3600.0, 1) AS keo_dai_gio
FROM public.su_co s
WHERE s.thoi_gian_dong IS NULL
  AND NOT s.da_tat_canh_bao
  AND s.muc_canh_bao_hien_tai IN ('WARNING','CRITICAL')
  AND s.thuoc_thu_nghiem = public.co_thu_nghiem()
  AND (NOT public.co_thu_nghiem() OR public.cfg_bool('bat_canh_bao_thu_nghiem', false))
ORDER BY 
  CASE s.muc_canh_bao_hien_tai WHEN 'CRITICAL' THEN 1 ELSE 2 END,
  CASE s.muc_uu_tien WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
  s.thoi_gian_mo;

-- ============================================================
-- 5. xem_nhat_ky_thao_tac — Tab Audit
-- ============================================================
CREATE OR REPLACE VIEW public.xem_nhat_ky_thao_tac AS
SELECT 
  l.id,
  to_char(l.thoi_diem AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') AS thoi_diem_hien_thi,
  l.thoi_diem,
  COALESCE(n.ho_ten, l.nguoi_thao_tac) || COALESCE(' (' || l.vai_tro || ')', '') AS nguoi_thao_tac_hien_thi,
  l.nguoi_thao_tac,
  l.vai_tro,
  l.hanh_dong,
  'SC-' || lpad(l.ma_su_co::text, 4, '0') || ' / ' || s.ma_phong AS doi_tuong,
  l.trang_thai_truoc,
  l.trang_thai_sau,
  l.ly_do,
  l.nguon
FROM public.lich_su_su_co l
LEFT JOIN public.su_co s ON s.ma_su_co = l.ma_su_co
LEFT JOIN public.nguoi_dung n ON n.email = l.nguoi_thao_tac
WHERE l.thuoc_thu_nghiem = public.co_thu_nghiem()
ORDER BY l.thoi_diem DESC
LIMIT 500;

-- ============================================================
-- 6. xem_canh_bao_he_thong — Sidebar 4 cảnh báo
-- ============================================================
-- React mockup hiện 4 dòng: sensor mất tín hiệu, sự cố chưa tiếp nhận, 
-- DQ < 80%, workflow chạy lúc HH:MM.
-- View này tổng hợp 4 nguồn vào 1 UNION.
-- ============================================================
CREATE OR REPLACE VIEW public.xem_canh_bao_he_thong AS
WITH sensor_mat_tin_hieu AS (
  SELECT 
    1 AS thu_tu,
    'critical' AS muc_do,
    CASE WHEN count(*) > 0 
      THEN 'Sensor ' || string_agg(ma_phong, ', ') || ' mất tín hiệu'
      ELSE NULL END AS thong_bao,
    CASE WHEN count(*) > 0 THEN 'Kiểm tra đường truyền FMS' ELSE NULL END AS phu_de
  FROM public.phong_sach WHERE thieu_du_lieu AND kich_hoat
),
su_co_chua_tiep_nhan AS (
  SELECT 
    2 AS thu_tu,
    'warning' AS muc_do,
    CASE WHEN count(*) > 0 
      THEN count(*) || ' sự cố chưa được IPC tiếp nhận'
      ELSE NULL END AS thong_bao,
    CASE WHEN count(*) > 0 THEN 'Cần xử lý trong giờ' ELSE NULL END AS phu_de
  FROM public.su_co 
  WHERE thoi_gian_dong IS NULL 
    AND trang_thai_hien_tai = 'CHUA_XU_LY'
    AND thuoc_thu_nghiem = public.co_thu_nghiem()
),
dq_thap AS (
  SELECT 
    3 AS thu_tu,
    'warning' AS muc_do,
    CASE WHEN count(*) > 0 
      THEN count(*) || ' phòng thiếu dữ liệu (DQ < 80%)'
      ELSE NULL END AS thong_bao,
    CASE WHEN count(*) > 0 
      THEN string_agg(ma_phong, ', ' ORDER BY ma_phong) 
      ELSE NULL END AS phu_de
  FROM public.phong_sach WHERE thieu_du_lieu AND kich_hoat
),
workflow_gan_day AS (
  SELECT 
    4 AS thu_tu,
    'normal' AS muc_do,
    'Workflow ' || ten_workflow || ' chạy lúc ' || 
      to_char(bat_dau AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI') || 
      ' — ' || trang_thai AS thong_bao,
    'Lượt chạy gần nhất' AS phu_de
  FROM public.nhat_ky_chay_workflow 
  WHERE ten_workflow = 'WF1' 
  ORDER BY bat_dau DESC LIMIT 1
)
SELECT thu_tu, muc_do, thong_bao, phu_de FROM sensor_mat_tin_hieu WHERE thong_bao IS NOT NULL
UNION ALL
SELECT thu_tu, muc_do, thong_bao, phu_de FROM su_co_chua_tiep_nhan WHERE thong_bao IS NOT NULL
UNION ALL  
SELECT thu_tu, muc_do, thong_bao, phu_de FROM dq_thap WHERE thong_bao IS NOT NULL
UNION ALL
SELECT thu_tu, muc_do, thong_bao, phu_de FROM workflow_gan_day
ORDER BY thu_tu;

-- ============================================================
-- 7. xem_xep_hang_rui_ro — Tab Xu hướng - bảng ranking
-- ============================================================
-- React: SCOPES sorted by risk, hiển thị 12 dòng
-- Risk = (100 - latest compliance) + sum(critical_hours over 7 days)
-- ============================================================
CREATE OR REPLACE VIEW public.xem_xep_hang_rui_ro AS
WITH ngay_moi_nhat AS (
  SELECT max(ngay) AS d FROM public.kpi_ngay_phong WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
),
phong_rui_ro AS (
  SELECT 
    'ROOM'              AS scope_type,
    k.ma_phong          AS scope_id,
    k.ten_phong         AS ten_scope,
    k.khu_vuc,
    k.ahu,
    k.muc_uu_tien,
    -- compliance hôm nay
    AVG(CASE WHEN k.ngay = (SELECT d FROM ngay_moi_nhat) THEN k.ti_le_dat_pct END) AS comp_moi_nhat,
    -- compliance 8 ngày trước (cho delta)
    AVG(CASE WHEN k.ngay = (SELECT d FROM ngay_moi_nhat) - 7 THEN k.ti_le_dat_pct END) AS comp_7_ngay_truoc,
    -- tổng critical hours 7 ngày
    SUM(CASE WHEN k.ngay >= (SELECT d FROM ngay_moi_nhat) - 7 THEN k.so_gio_critical ELSE 0 END) AS critical_7n
  FROM public.kpi_ngay_phong k
  WHERE k.thuoc_thu_nghiem = public.co_thu_nghiem() AND k.sensor_type = 'ALL'
    AND k.ngay >= (SELECT d FROM ngay_moi_nhat) - 7
  GROUP BY k.ma_phong, k.ten_phong, k.khu_vuc, k.ahu, k.muc_uu_tien
),
ahu_rui_ro AS (
  SELECT 
    'AHU'                AS scope_type,
    k.scope_id,
    k.ten_scope,
    NULL::text           AS khu_vuc,
    k.scope_id           AS ahu,
    NULL::text           AS muc_uu_tien,
    AVG(CASE WHEN k.ngay = (SELECT d FROM ngay_moi_nhat) THEN k.ti_le_dat_pct END) AS comp_moi_nhat,
    AVG(CASE WHEN k.ngay = (SELECT d FROM ngay_moi_nhat) - 7 THEN k.ti_le_dat_pct END) AS comp_7_ngay_truoc,
    SUM(CASE WHEN k.ngay >= (SELECT d FROM ngay_moi_nhat) - 7 THEN k.so_gio_critical ELSE 0 END) AS critical_7n
  FROM public.kpi_ngay_scope k
  WHERE k.scope_type = 'AHU' AND k.thuoc_thu_nghiem = public.co_thu_nghiem() AND k.sensor_type = 'ALL'
    AND k.ngay >= (SELECT d FROM ngay_moi_nhat) - 7
  GROUP BY k.scope_id, k.ten_scope
),
area_rui_ro AS (
  SELECT 
    'AREA'               AS scope_type,
    k.scope_id,
    k.ten_scope,
    k.scope_id           AS khu_vuc,
    NULL::text           AS ahu,
    NULL::text           AS muc_uu_tien,
    AVG(CASE WHEN k.ngay = (SELECT d FROM ngay_moi_nhat) THEN k.ti_le_dat_pct END) AS comp_moi_nhat,
    AVG(CASE WHEN k.ngay = (SELECT d FROM ngay_moi_nhat) - 7 THEN k.ti_le_dat_pct END) AS comp_7_ngay_truoc,
    SUM(CASE WHEN k.ngay >= (SELECT d FROM ngay_moi_nhat) - 7 THEN k.so_gio_critical ELSE 0 END) AS critical_7n
  FROM public.kpi_ngay_scope k
  WHERE k.scope_type = 'AREA' AND k.thuoc_thu_nghiem = public.co_thu_nghiem() AND k.sensor_type = 'ALL'
    AND k.ngay >= (SELECT d FROM ngay_moi_nhat) - 7
  GROUP BY k.scope_id, k.ten_scope
),
hop_nhat AS (
  SELECT * FROM phong_rui_ro
  UNION ALL SELECT * FROM ahu_rui_ro
  UNION ALL SELECT * FROM area_rui_ro
)
SELECT 
  scope_type,
  scope_id,
  ten_scope,
  khu_vuc,
  ahu,
  muc_uu_tien,
  ROUND(comp_moi_nhat::numeric, 1)                                AS comp_moi_nhat,
  ROUND((comp_moi_nhat - comp_7_ngay_truoc)::numeric, 1)          AS delta_7_ngay,
  COALESCE(critical_7n, 0)::int                                    AS critical_7n,
  -- Risk score
  ROUND((100 - COALESCE(comp_moi_nhat, 0) + COALESCE(critical_7n, 0))::numeric, 0)::int AS rui_ro,
  CASE 
    WHEN comp_moi_nhat < 70 THEN 'Cần điều tra ưu tiên'
    WHEN comp_moi_nhat < 88 THEN 'Cần chú ý'
    ELSE 'Tốt'
  END AS danh_gia
FROM hop_nhat
WHERE comp_moi_nhat IS NOT NULL
ORDER BY rui_ro DESC
LIMIT 12;

-- ============================================================
-- 8. xem_cau_hinh_he_thong — Tab Cài đặt (mask secret)
-- ============================================================
CREATE OR REPLACE VIEW public.xem_cau_hinh_he_thong AS
SELECT 
  key,
  public.mask_secret(key, value) AS value_hien_thi,
  CASE 
    WHEN key ILIKE '%password%' OR key ILIKE '%api_key%' 
      OR key ILIKE '%token%' OR key ILIKE '%secret%'
    THEN true ELSE false 
  END AS la_bi_mat,
  mo_ta,
  cap_nhat_luc
FROM public.cau_hinh
ORDER BY key;

-- ============================================================
-- 9. xem_lich_su_cau_hinh — Tab Cài đặt - lịch sử
-- ============================================================
CREATE OR REPLACE VIEW public.xem_lich_su_cau_hinh AS
SELECT 
  id,
  to_char(thoi_diem AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') AS thoi_diem_hien_thi,
  COALESCE(n.ho_ten, h.nguoi_thay_doi) || COALESCE(' (' || n.vai_tro || ')', '') AS nguoi_hien_thi,
  h.nguoi_thay_doi,
  h.loai_thay_doi,
  h.bang,
  h.key_or_id,
  h.gia_tri_cu_mask,
  h.gia_tri_moi_mask,
  h.ly_do
FROM public.lich_su_cau_hinh h
LEFT JOIN public.nguoi_dung n ON n.email = h.nguoi_thay_doi
ORDER BY h.thoi_diem DESC
LIMIT 200;

-- ============================================================
-- 10. xem_quy_trinh_sop — Tab Audit - bảng SOP
-- ============================================================
CREATE OR REPLACE VIEW public.xem_quy_trinh_sop AS
SELECT 
  ma_sop                AS sop,
  mo_ta_ap_dung         AS ap_dung,
  COALESCE(lien_quan_deviation, '—') AS deviation,
  COALESCE(lien_quan_capa, '—')      AS capa,
  url_tai_lieu
FROM public.quy_trinh_sop 
WHERE kich_hoat
ORDER BY ma_sop;

-- ============================================================
-- 11. xem_email_da_gui — Tab Báo cáo
-- ============================================================
CREATE OR REPLACE VIEW public.xem_email_da_gui AS
SELECT 
  id,
  to_char(tao_luc AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') AS thoi_diem_hien_thi,
  loai_email,
  nguoi_nhan_to,
  tieu_de,
  trang_thai,
  so_su_co,
  CASE WHEN gui_luc IS NULL THEN '—' 
       ELSE to_char(gui_luc AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') END AS gui_luc_hien_thi,
  loi_van_tat
FROM public.email_da_gui
WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
ORDER BY tao_luc DESC
LIMIT 100;

-- ============================================================
-- 12. xem_bao_cao_ai — Tab Báo cáo
-- ============================================================
CREATE OR REPLACE VIEW public.xem_bao_cao_ai AS
SELECT 
  id,
  to_char(tao_luc AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM') AS thoi_diem_hien_thi,
  tao_luc,
  loai_bao_cao,
  ten_scope,
  sensor_type,
  pham_vi_ngay,
  noi_dung_phan_tich,
  muc_canh_bao,
  CASE muc_canh_bao
    WHEN 0 THEN 'Bình thường'
    WHEN 1 THEN 'Chú ý'
    WHEN 2 THEN 'Cảnh báo'
    WHEN 3 THEN 'Hành động'
  END AS muc_canh_bao_hien_thi,
  trang_thai_ai,
  nguoi_yeu_cau,
  da_gui_email
FROM public.bao_cao_ai
WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
ORDER BY tao_luc DESC
LIMIT 50;

-- ============================================================
-- 13. xem_thong_ke_sensor_8h — RoomCard mockup hiển thị 8 giờ
-- ============================================================
-- React: sensorStats() returns {cur, avg1h, oos1h, err10, hourly8: [...]}
-- ============================================================
CREATE OR REPLACE VIEW public.xem_thong_ke_sensor_8h AS
WITH bucket_moi_nhat AS (
  SELECT max(bucket_utc) AS bucket FROM public.du_lieu_gio WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
),
sensor_8h AS (
  SELECT 
    ma_phong,
    loai_cam_bien,
    bucket_utc,
    bucket_vn,
    gia_tri_tb,
    gia_tri_max,
    gia_tri_min,
    diem_oos,
    oos_rate_pct,
    muc_canh_bao,
    chat_luong_du_lieu_pct,
    ROW_NUMBER() OVER (PARTITION BY ma_phong, loai_cam_bien ORDER BY bucket_utc DESC) AS rn
  FROM public.du_lieu_gio
  WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
    AND bucket_utc >= (SELECT bucket FROM bucket_moi_nhat) - interval '8 hours'
)
SELECT 
  ma_phong,
  loai_cam_bien,
  -- Hourly array (8 dòng nếu đủ)
  jsonb_agg(jsonb_build_object(
    'label',     to_char(bucket_vn, 'HH24:MI'),
    'bucket_utc', bucket_utc,
    'avg',       gia_tri_tb,
    'min',       gia_tri_min,
    'max',       gia_tri_max,
    'oos',       diem_oos,
    'oos_pct',   oos_rate_pct,
    'severity',  muc_canh_bao
  ) ORDER BY bucket_utc) AS hourly_8,
  -- Stat 1h gần nhất
  MAX(CASE WHEN rn=1 THEN gia_tri_tb END)              AS gia_tri_tb_1h,
  MAX(CASE WHEN rn=1 THEN diem_oos END)                AS oos_1h,
  MAX(CASE WHEN rn=1 THEN chat_luong_du_lieu_pct END)  AS dq_1h,
  MAX(CASE WHEN rn=1 THEN muc_canh_bao END)            AS muc_canh_bao_1h
FROM sensor_8h
GROUP BY ma_phong, loai_cam_bien;

COMMENT ON VIEW public.xem_thong_ke_sensor_8h IS 'Thống kê 8 giờ gần nhất mỗi (phòng, cảm biến) cho RoomCard.';

-- ============================================================
-- 14. xem_dinh_tuyen_email — WF2 biết gửi email cho AI
-- ============================================================
-- Gom sự cố cần gửi theo "nhóm digest" + danh sách email người nhận
-- dựa trên cau_hinh. WF2 chỉ cần đọc view này là đủ thông tin gửi.
-- Quy tắc người nhận:
--   • Sự cố CHUA_XU_LY / IPC_*          → email_ipc
--   • DA_BAO_CO_DIEN / CO_DIEN_*        → email_co_dien (+ cc IPC)
--   • CO_DIEN_KHONG_XU_LY_DUOC          → email_qa + email_truc_hsl (leo thang)
--   • CHO_QA_KIEM_LAI / CO_DIEN_DA_XU_LY→ email_qa (+ cc IPC)
-- ============================================================
CREATE OR REPLACE VIEW public.xem_dinh_tuyen_email AS
SELECT 
  s.ma_su_co,
  'SC-' || lpad(s.ma_su_co::text, 4, '0') AS ma_hien_thi,
  s.ma_phong, s.ten_phong, s.khu_vuc, s.ahu, s.muc_uu_tien,
  s.loai_cam_bien, s.muc_canh_bao_hien_tai, s.trang_thai_hien_tai,
  s.thoi_gian_mo,
  ROUND(EXTRACT(EPOCH FROM (now() - s.thoi_gian_mo))/3600.0, 1) AS keo_dai_gio,
  -- Nhóm người nhận chính theo trạng thái
  CASE 
    WHEN s.trang_thai_hien_tai IN ('CHUA_XU_LY','IPC_TIEP_NHAN','IPC_BAT_THUONG','MO_LAI') THEN 'IPC'
    WHEN s.trang_thai_hien_tai IN ('DA_BAO_CO_DIEN','CO_DIEN_DANG_XU_LY')                  THEN 'MEP'
    WHEN s.trang_thai_hien_tai = 'CO_DIEN_KHONG_XU_LY_DUOC'                                THEN 'ESCALATE'
    WHEN s.trang_thai_hien_tai IN ('CO_DIEN_DA_XU_LY','CHO_QA_KIEM_LAI')                   THEN 'QA'
    ELSE 'IPC'
  END AS nhom_nguoi_nhan,
  -- Email người nhận (TO) — đọc từ cau_hinh
  CASE 
    WHEN s.trang_thai_hien_tai IN ('CHUA_XU_LY','IPC_TIEP_NHAN','IPC_BAT_THUONG','MO_LAI') THEN public.cfg_text('email_ipc','')
    WHEN s.trang_thai_hien_tai IN ('DA_BAO_CO_DIEN','CO_DIEN_DANG_XU_LY')                  THEN public.cfg_text('email_co_dien','')
    WHEN s.trang_thai_hien_tai = 'CO_DIEN_KHONG_XU_LY_DUOC'                                THEN concat_ws(',', NULLIF(public.cfg_text('email_qa',''),''), NULLIF(public.cfg_text('email_truc_hsl',''),''))
    WHEN s.trang_thai_hien_tai IN ('CO_DIEN_DA_XU_LY','CHO_QA_KIEM_LAI')                   THEN public.cfg_text('email_qa','')
    ELSE public.cfg_text('email_ipc','')
  END AS email_to,
  -- CC: thường cc IPC để theo dõi xuyên suốt
  public.cfg_text('email_ipc','') AS email_cc,
  -- Khóa idempotency theo giờ (chống gửi trùng cùng giờ)
  'DIGEST|' || s.khu_vuc || '|' || to_char(date_trunc('hour', now()) AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD"T"HH24:00') AS idempotency_key_goi_y
FROM public.su_co s
WHERE s.thoi_gian_dong IS NULL
  AND NOT s.da_tat_canh_bao
  AND s.muc_canh_bao_hien_tai IN ('WARNING','CRITICAL')
  AND s.thuoc_thu_nghiem = public.co_thu_nghiem()
ORDER BY 
  CASE s.muc_canh_bao_hien_tai WHEN 'CRITICAL' THEN 1 ELSE 2 END,
  CASE s.muc_uu_tien WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
  s.thoi_gian_mo;

COMMENT ON VIEW public.xem_dinh_tuyen_email IS 'WF2: sự cố cần gửi email + người nhận (TO/CC) theo trạng thái + khóa idempotency.';

-- ============================================================
-- KIỂM TRA
-- ============================================================
SELECT 
  '✅ FILE 06 OK' AS ket_qua,
  (SELECT count(*) FROM information_schema.views 
   WHERE table_schema='public' AND table_name LIKE 'xem_%'
  ) AS so_view_da_tao;
