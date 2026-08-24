-- =============================================================================
-- 20260824b — ĐỔI MÃ NỘI BỘ THEO KIẾN TRÚC BMS → API NGUỒN IT
-- =============================================================================
-- Sự cố 22/08 22:00 → 24/08: WF1 vẫn chạy, vẫn xử lý 57 phòng và ghi đủ
-- 81 dòng/bucket, nhưng FMS trả 200 kèm 0 điểm đo. Hệ có ghi ngoai_le_du_lieu
-- ma_loi=FMS_RONG, nhưng rpc_tinh_trang_nguon() chưa coi đây là mất nguồn vì
-- chỉ bắt "WF1 lấy 0 phòng". Kết quả: có chỗ nói "nguồn bình thường" dù mọi
-- bucket mới đều gia_tri_tb=NULL.
--
-- VÁ:
--   1. Chỉ phân loại mất dữ liệu thành 3 nhóm vận hành:
--      N8N_PIPELINE_ERROR : luồng lấy dữ liệu trên n8n lỗi/quá hạn.
--      IT_API_UNREACHABLE : không kết nối được API nguồn của IT để lấy dữ liệu BMS.
--      BMS_SOURCE_EMPTY   : vẫn kết nối được API nguồn của IT nhưng không có dữ liệu BMS.
--
-- Lưu ý: n8n chết toàn bộ là N8N_PLATFORM_DOWN, nhưng WF6 không thể tự phát hiện
-- vì WF6 cũng chạy trong n8n. Trường hợp đó cần watchdog bên ngoài n8n.
--
--   2. rpc_tinh_trang_nguon() đọc thêm du_lieu của WF1 gần nhất:
--      diem_thu_duoc, phong_rong, so_ngoai_le.
--   3. Đỏ khi WF1 lấy được phòng nhưng diem_thu_duoc=0 và phần lớn phòng rỗng.
--   4. Đỏ khi bucket mới nhất có đủ dòng nhưng 0 dòng có gia_tri_tb.
--   5. rpc_kiem_tra_suc_khoe_he_thong() chuyển tiếp ma_trang_thai/muc_do/chi_tiet
--      cho web và WF6. Tên khóa cũ vẫn giữ để web cũ không vỡ.
--
-- Rollback: chạy lại định nghĩa ở 20260811e + 20260812c.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_dat_cau_hinh_email(
  p_key text, p_value text, p_actor text default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_email text; v_vai_tro text;
  v_allow text[] := ARRAY[
    'email_gui_tu','email_test','email_mat_nguon','email_ipc','email_co_dien','email_qa',
    'email_truc_hsl','email_it_gmp','email_bao_cao_tuan','email_bao_cao_thang','email_bao_cao_ngay'];
BEGIN
  v_email := public.lay_email_nguoi_goi(p_actor);
  IF v_email IS NULL THEN RETURN jsonb_build_object('ok', false, 'loi', 'CHUA_DANG_NHAP'); END IF;
  SELECT vai_tro INTO v_vai_tro FROM public.nguoi_dung WHERE email = v_email AND kich_hoat;
  IF v_vai_tro NOT IN ('ADMIN','QA') THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KHONG_CO_QUYEN', 'thong_bao', 'Chỉ QA/Quản trị được sửa cấu hình.');
  END IF;
  IF NOT (p_key = ANY(v_allow)) THEN
    RETURN jsonb_build_object('ok', false, 'loi', 'KEY_KHONG_HOP_LE', 'thong_bao', 'Key không nằm trong danh sách email cho phép.');
  END IF;
  PERFORM set_config('app.actor', v_email, true);
  INSERT INTO public.cau_hinh(key, value) VALUES (p_key, COALESCE(trim(p_value), ''))
    ON CONFLICT (key) DO UPDATE SET value = excluded.value;
  RETURN jsonb_build_object('ok', true, 'thong_bao', 'Đã lưu ' || p_key);
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_dat_cau_hinh_email(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_tinh_trang_nguon()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH ng AS (
    SELECT GREATEST(5, COALESCE(NULLIF(public.cfg_text('giam_sat_mach_phut_toi_da',''),'')::int, 12)) AS phut_max,
           public.nguong_tre_gio() AS gio_max,
           GREATEST(121, COALESCE(NULLIF(public.cfg_text('chenh_ap_tuoi_toi_da_phut',''),'')::int, 150)) AS phut_xam,
           COALESCE(NULLIF(public.cfg_text('edge_capnhat_phut_gio_dau',''),'')::int, 5) AS gio_dau,
           COALESCE(NULLIF(public.cfg_text('edge_capnhat_phut_gio_cuoi',''),'')::int, 21) AS gio_cuoi,
           EXTRACT(hour FROM (now() AT TIME ZONE public.mui_gio()))::int AS gio_vn
  ),
  phut AS (
    SELECT max(thoi_diem) AS moi_nhat
    FROM public.du_lieu_phut_8h
  ),
  gio_moi AS (
    SELECT max(bucket_utc) AS bucket_moi
    FROM public.du_lieu_gio
    WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
  ),
  gio_co_giatri AS (
    SELECT max(bucket_utc) AS bucket_co_giatri
    FROM public.du_lieu_gio
    WHERE thuoc_thu_nghiem = public.co_thu_nghiem()
      AND gia_tri_tb IS NOT NULL
  ),
  bucket AS (
    SELECT
      gm.bucket_moi,
      count(d.bucket_utc) AS dong_bucket,
      count(d.bucket_utc) FILTER (WHERE d.gia_tri_tb IS NOT NULL) AS dong_co_giatri,
      count(DISTINCT d.ma_phong) AS phong_bucket
    FROM gio_moi gm
    LEFT JOIN public.du_lieu_gio d
      ON d.bucket_utc = gm.bucket_moi
     AND d.thuoc_thu_nghiem = public.co_thu_nghiem()
    GROUP BY gm.bucket_moi
  ),
  wf AS (
    SELECT
      bat_dau,
      ket_thuc,
      phong_hop_le,
      dong_du_lieu_gio_them,
      trang_thai,
      COALESCE(NULLIF(du_lieu->>'diem_thu_duoc','')::int, NULL) AS diem_thu_duoc,
      COALESCE(NULLIF(du_lieu->>'phong_rong','')::int, NULL) AS phong_rong,
      COALESCE(NULLIF(du_lieu->>'so_ngoai_le','')::int, NULL) AS so_ngoai_le
    FROM public.nhat_ky_chay_workflow
    WHERE ten_workflow = 'WF1'
      AND bat_dau > now() - interval '6 hours'
    ORDER BY bat_dau DESC
    LIMIT 1
  ),
  ngoai_le AS (
    SELECT
      count(*) FILTER (WHERE ma_loi = 'FMS_RONG') AS fms_rong_6h,
      count(DISTINCT ma_phong) FILTER (WHERE ma_loi = 'FMS_RONG') AS phong_fms_rong_6h,
      count(*) FILTER (WHERE ma_loi = 'FMS_LOGIN_LOI') AS fms_login_loi_6h
    FROM public.ngoai_le_du_lieu
    WHERE tao_luc > now() - interval '6 hours'
      AND thuoc_thu_nghiem = public.co_thu_nghiem()
  ),
  cham AS (
    SELECT
      (SELECT gio_vn >= gio_dau AND gio_vn < gio_cuoi FROM ng) AS trong_khung_edge,
      round(EXTRACT(epoch FROM now() - (SELECT moi_nhat FROM phut))/60.0)::int AS tuoi_phut,
      round(EXTRACT(epoch FROM now() - (SELECT bucket_moi FROM gio_moi))/60.0)::int AS tuoi_bucket_moi_phut,
      round(EXTRACT(epoch FROM now() - ((SELECT bucket_co_giatri FROM gio_co_giatri) + interval '1 hour'))/60.0)::int AS tre_bucket_co_giatri_phut,
      (SELECT phut_max FROM ng) AS nguong_phut,
      (SELECT gio_max FROM ng) AS nguong_gio,
      (SELECT phut_xam FROM ng) AS nguong_xam,
      wf.bat_dau AS wf1_luc,
      wf.ket_thuc AS wf1_ket_thuc,
      wf.phong_hop_le AS wf1_phong,
      wf.dong_du_lieu_gio_them AS wf1_dong_them,
      wf.trang_thai AS wf1_trang_thai,
      wf.diem_thu_duoc AS wf1_diem,
      wf.phong_rong AS wf1_phong_rong,
      wf.so_ngoai_le AS wf1_so_ngoai_le,
      bucket.bucket_moi,
      bucket.dong_bucket,
      bucket.dong_co_giatri,
      bucket.phong_bucket,
      (SELECT bucket_co_giatri FROM gio_co_giatri) AS bucket_co_giatri_cuoi,
      ngoai_le.fms_rong_6h,
      ngoai_le.phong_fms_rong_6h,
      ngoai_le.fms_login_loi_6h
    FROM bucket
    CROSS JOIN ngoai_le
    LEFT JOIN wf ON true
  ),
  co AS (
    SELECT c.*,
      (c.trong_khung_edge AND (c.tuoi_phut IS NULL OR c.tuoi_phut > c.nguong_phut)) AS do_mach_phut,
      (c.tre_bucket_co_giatri_phut IS NULL OR c.tre_bucket_co_giatri_phut > c.nguong_gio * 60) AS do_mach_gio,
      (c.wf1_luc IS NULL) AS do_wf1_mat_nhat_ky,
      (c.wf1_trang_thai IN ('failed','partial')) AS do_wf1_loi,
      (c.wf1_phong IS NOT NULL AND c.wf1_phong = 0) AS do_thu_that_bai,
      (COALESCE(c.wf1_diem, -1) = 0
        AND COALESCE(c.wf1_phong, 0) > 0
        AND COALESCE(c.wf1_phong_rong, 0) >= GREATEST(1, floor(COALESCE(c.wf1_phong, 0) * 0.8))::int) AS do_fms_rong_toan_he,
      (COALESCE(c.dong_bucket, 0) >= 1
        AND COALESCE(c.dong_co_giatri, 0) = 0
        AND COALESCE(c.phong_bucket, 0) >= 50) AS do_bucket_rong_toan_he,
      (COALESCE(c.fms_login_loi_6h, 0) > 0) AS co_login_timeout,
      ((c.tuoi_phut IS NULL OR c.tuoi_phut > 6)
        AND (c.tre_bucket_co_giatri_phut IS NULL OR c.tre_bucket_co_giatri_phut > c.nguong_xam)) AS web_da_to_xam
    FROM cham c
  ),
  phan_loai AS (
    SELECT co.*,
      CASE
        WHEN do_thu_that_bai OR co_login_timeout THEN 'IT_API_UNREACHABLE'
        WHEN do_fms_rong_toan_he OR do_bucket_rong_toan_he THEN 'BMS_SOURCE_EMPTY'
        WHEN do_wf1_mat_nhat_ky OR do_wf1_loi OR do_mach_gio THEN 'N8N_PIPELINE_ERROR'
        ELSE 'NORMAL'
      END AS ma_trang_thai
    FROM co
  )
  SELECT jsonb_build_object(
    'kiem_luc', now(),
    'mat_nguon', (ma_trang_thai <> 'NORMAL'),
    'ma_trang_thai', ma_trang_thai,
    'muc_do', CASE WHEN ma_trang_thai = 'NORMAL' THEN 'OK' ELSE 'CRITICAL' END,
    'ly_do', ARRAY_REMOVE(ARRAY[
      CASE WHEN do_thu_that_bai THEN 'wf1_0_phong' END,
      CASE WHEN do_wf1_mat_nhat_ky THEN 'wf1_khong_co_nhat_ky_6h' END,
      CASE WHEN do_wf1_loi THEN 'wf1_trang_thai_loi' END,
      CASE WHEN co_login_timeout THEN 'co_fms_login_timeout' END,
      CASE WHEN do_fms_rong_toan_he THEN 'fms_rong_toan_he' END,
      CASE WHEN do_bucket_rong_toan_he THEN 'bucket_rong_toan_he' END,
      CASE WHEN do_mach_phut THEN 'mach_phut' END,
      CASE WHEN do_mach_gio THEN 'tre_gio' END
    ], NULL),
    'trong_khung_edge', trong_khung_edge,
    'web_da_to_xam', web_da_to_xam,
    'nguong_xam_phut', nguong_xam,
    'mach_phut', jsonb_build_object('tuoi_phut', tuoi_phut, 'nguong', nguong_phut, 'do', do_mach_phut),
    'mach_gio', jsonb_build_object('tuoi_phut', tre_bucket_co_giatri_phut, 'nguong_gio', nguong_gio, 'do', do_mach_gio),
    'wf1_gan_nhat', jsonb_build_object(
      'luc', wf1_luc,
      'ket_thuc', wf1_ket_thuc,
      'phong_hop_le', wf1_phong,
      'dong_du_lieu_gio_them', wf1_dong_them,
      'diem_thu_duoc', wf1_diem,
      'phong_rong', wf1_phong_rong,
      'so_ngoai_le', wf1_so_ngoai_le,
      'trang_thai_ghi', wf1_trang_thai,
      'do', (do_thu_that_bai OR do_fms_rong_toan_he)
    ),
    'bucket', jsonb_build_object(
      'bucket_moi_nhat', bucket_moi,
      'dong_bucket', dong_bucket,
      'dong_co_giatri', dong_co_giatri,
      'phong_bucket', phong_bucket,
      'bucket_co_giatri_cuoi', bucket_co_giatri_cuoi,
      'tre_bucket_co_giatri_phut', tre_bucket_co_giatri_phut,
      'do_bucket_rong_toan_he', do_bucket_rong_toan_he
    ),
    'ngoai_le_6h', jsonb_build_object(
      'fms_rong', fms_rong_6h,
      'phong_fms_rong', phong_fms_rong_6h,
      'fms_login_loi', fms_login_loi_6h
    ),
    'tom_tat', CASE
      WHEN ma_trang_thai = 'N8N_PIPELINE_ERROR'
        THEN 'Luồng lấy dữ liệu trên n8n bị lỗi hoặc quá hạn. Người cần tác động: quản trị n8n hoặc IT hệ thống.'
      WHEN ma_trang_thai = 'IT_API_UNREACHABLE'
        THEN 'Không kết nối được API nguồn của IT để lấy dữ liệu BMS. Người cần tác động: liên hệ Ánh IT kiểm tra API nguồn, tài khoản kết nối và đường truyền.'
      WHEN ma_trang_thai = 'BMS_SOURCE_EMPTY'
        THEN 'Vẫn kết nối được API nguồn của IT, tuy nhiên không có dữ liệu BMS: luồng thu dữ liệu xử lý '||COALESCE(wf1_phong::text,'?')||' phòng, '||COALESCE(wf1_phong_rong::text,'?')||' phòng rỗng, 0 điểm đo. Người cần tác động: Cơ điện kiểm tra máy BMS có đang ghi dữ liệu thực tế không.'
      ELSE 'Nguồn dữ liệu bình thường.'
    END
  )
  FROM phan_loai;
$function$;

REVOKE ALL ON FUNCTION public.rpc_tinh_trang_nguon() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_tinh_trang_nguon() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_kiem_tra_suc_khoe_he_thong(p_nguong_gio integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH tn AS (
    SELECT public.cfg_bool('che_do_thu_nghiem', true) AS v
  ),
  moi AS (
    SELECT max(bucket_utc) AS bucket_moi
    FROM public.du_lieu_gio, tn
    WHERE thuoc_thu_nghiem = tn.v
      AND gia_tri_tb IS NOT NULL
  ),
  duoi AS (
    SELECT CASE WHEN bucket_moi IS NULL THEN NULL ELSE bucket_moi + interval '1 hour' END AS het_gio
    FROM moi
  ),
  ng AS (
    SELECT public.rpc_tinh_trang_nguon() AS j
  ),
  tre AS (
    SELECT CASE WHEN (SELECT het_gio FROM duoi) IS NULL THEN true
                ELSE (now() - (SELECT het_gio FROM duoi)) > make_interval(hours => p_nguong_gio) END AS qua_han
  ),
  sc AS (
    SELECT
      count(*) FILTER (WHERE muc_canh_bao='CRITICAL') AS so_critical,
      count(*) FILTER (WHERE muc_canh_bao='WARNING') AS so_warning,
      count(*) AS so_dang_mo
    FROM public.xem_su_co_dang_mo
  ),
  chay AS (
    SELECT ten_workflow, trang_thai, ket_thuc
    FROM public.nhat_ky_chay_workflow
    WHERE ten_workflow IN ('WF1','WF1_NHIEU_PHONG')
    ORDER BY id DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'bucket_moi_nhat', (SELECT bucket_moi FROM moi),
    'tre_gio', CASE WHEN (SELECT het_gio FROM duoi) IS NULL THEN NULL
                    ELSE GREATEST(0, round(extract(epoch FROM (now() - (SELECT het_gio FROM duoi)))/3600.0, 1)) END,
    'mat_du_lieu', ((SELECT qua_han FROM tre) OR ((SELECT j FROM ng)->>'mat_nguon')::boolean),
    'nguong_gio', p_nguong_gio,
    'ma_trang_thai', CASE
                       WHEN COALESCE((SELECT j FROM ng)->>'ma_trang_thai','NORMAL') <> 'NORMAL'
                         THEN (SELECT j FROM ng)->>'ma_trang_thai'
                       WHEN (SELECT qua_han FROM tre)
                         THEN 'N8N_PIPELINE_ERROR'
                       ELSE 'NORMAL'
                     END,
    'muc_do', CASE
                WHEN COALESCE((SELECT j FROM ng)->>'ma_trang_thai','NORMAL') <> 'NORMAL'
                  THEN COALESCE((SELECT j FROM ng)->>'muc_do','CRITICAL')
                WHEN (SELECT qua_han FROM tre)
                  THEN 'CRITICAL'
                ELSE 'OK'
              END,
    'ly_do', (CASE WHEN (SELECT qua_han FROM tre) THEN jsonb_build_array('tre_gio') ELSE '[]'::jsonb END)
             || COALESCE((SELECT j FROM ng)->'ly_do', '[]'::jsonb),
    'tom_tat', CASE
                 WHEN ((SELECT j FROM ng)->>'ma_trang_thai') IS NOT NULL
                 AND ((SELECT j FROM ng)->>'ma_trang_thai') <> 'NORMAL'
                 THEN (SELECT j FROM ng)->>'tom_tat'
                 WHEN (SELECT qua_han FROM tre)
                 THEN 'Luồng lấy dữ liệu trên n8n đang quá hạn. Người cần tác động: quản trị n8n hoặc IT hệ thống.'
                 ELSE COALESCE((SELECT j FROM ng)->>'tom_tat', 'Nguồn dữ liệu bình thường.')
               END,
    'mach_phut_phut', ((SELECT j FROM ng)->'mach_phut'->>'tuoi_phut')::int,
    'trong_khung_edge', ((SELECT j FROM ng)->>'trong_khung_edge')::boolean,
    'web_da_to_xam', ((SELECT j FROM ng)->>'web_da_to_xam')::boolean,
    'wf1_gan_nhat', (SELECT j FROM ng)->'wf1_gan_nhat',
    'bucket', (SELECT j FROM ng)->'bucket',
    'ngoai_le_6h', (SELECT j FROM ng)->'ngoai_le_6h',
    'so_su_co_dang_mo', (SELECT so_dang_mo FROM sc),
    'so_critical', (SELECT so_critical FROM sc),
    'so_warning', (SELECT so_warning FROM sc),
    'lan_chay_cuoi', (SELECT to_jsonb(chay) FROM chay),
    'kiem_tra_luc', now()
  );
$function$;

REVOKE ALL ON FUNCTION public.rpc_kiem_tra_suc_khoe_he_thong(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_kiem_tra_suc_khoe_he_thong(integer) TO authenticated, service_role;

UPDATE public.cau_hinh SET value = '20260824b' WHERE key = 'phien_ban_db';

COMMIT;
