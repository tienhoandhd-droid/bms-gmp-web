-- =============================================================================
-- BỘ KIỂM — THAY ĐỔI (NGUYÊN TẮC · TÀI KHOẢN · PHÒNG) → HỆ THỐNG CẢNH BÁO
--
-- Kiểm RIÊNG LẺ (N1–N9) và KẾT HỢP (N10–N12) tác động lên cảnh báo:
--   • Nguyên tắc cảnh báo: ngưỡng · hướng · phạm vi (ingest RPC tự áp từ cấu hình LIVE)
--   • Tài khoản: đổi khu · vô hiệu · đổi vai → ai thấy/thao tác được cảnh báo
--   • Phòng: đổi khu · vô hiệu · đổi ưu tiên → cảnh báo thuộc ai, có mở không
-- Dùng UPDATE trực tiếp để TẠO thay đổi (cô lập "hệ quả"), rồi quan sát cảnh báo.
-- ROLLBACK cuối — không chạm dữ liệu thật.
-- =============================================================================
BEGIN;
SET LOCAL app.tg_bypass_append_only = 'on';

CREATE TEMP TABLE kq_kiem(stt serial, nhom text, ten text, dat boolean, chan_doan text, goi_y text);
CREATE FUNCTION pg_temp.ghi(p_nhom text, p_ten text, p_dat boolean, p_cd text DEFAULT NULL, p_gy text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$ INSERT INTO kq_kiem(nhom,ten,dat,chan_doan,goi_y) VALUES(p_nhom,p_ten,p_dat,p_cd,p_gy) $$;
CREATE FUNCTION pg_temp.ok(r jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE(r->>'ok','false')='true' $$;
CREATE FUNCTION pg_temp.tt(p_email text, p_sc bigint, p_hd text, p_ly_do text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb; BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','email',p_email)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.rpc_thao_tac_su_co(p_ma_su_co=>p_sc, p_hanh_dong=>p_hd, p_ly_do=>p_ly_do, p_nguon=>'kiemthu');
  EXECUTE 'RESET ROLE'; RETURN COALESCE(r,'{}'::jsonb);
END $$;
CREATE FUNCTION pg_temp.tt_now(p_sc bigint) RETURNS text LANGUAGE sql AS $$ SELECT trang_thai_hien_tai FROM public.su_co WHERE ma_su_co=p_sc $$;
-- tạo sự cố ở khu/ưu tiên cho trước (phòng thật đầu khu)
CREATE FUNCTION pg_temp.tao_sc(p_khu text, p_ahu text, p_tt text, p_uu text DEFAULT 'P1')
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint; v_phong text; BEGIN
  SELECT ma_phong INTO v_phong FROM public.phong_sach WHERE kich_hoat AND khu_vuc=p_khu ORDER BY ma_phong LIMIT 1;
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  INSERT INTO public.su_co(thuoc_thu_nghiem,khoa_su_co,ma_phong,ten_phong,khu_vuc,ahu,cap_phong_sach,muc_uu_tien,loai_cam_bien,loai_canh_bao,muc_canh_bao_ban_dau,muc_canh_bao_hien_tai,trang_thai_hien_tai,thoi_gian_mo,thoi_gian_lan_cuoi_quan_sat,nguon)
  VALUES(false,md5(p_ahu||p_tt||clock_timestamp()::text||random()::text),v_phong,'kiểm thử',p_khu,p_ahu,'C',p_uu,'DP','OOS_DP','CRITICAL','CRITICAL',p_tt,now()-interval '90 minutes',now(),'KIEMTHU')
  RETURNING ma_su_co INTO v; RETURN v;
END $$;
-- ingest một giờ DP với OOS THẤP/CAO tách bạch (để thử hướng)
CREATE FUNCTION pg_temp.bom(p_phong text, p_ahu text, p_uu text, p_gio int, p_thap int, p_cao int, p_oos10 int)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM public.rpc_xu_ly_du_lieu_phong_hang_gio(jsonb_build_object(
    'bucket_utc', to_char(date_trunc('hour',now())+make_interval(hours=>p_gio),'YYYY-MM-DD"T"HH24:00:00+00'),
    'thuoc_thu_nghiem',false,'ma_phong',p_phong,'ten_phong','kb','khu_vuc',split_part(p_phong,'.',1),
    'ahu',p_ahu,'muc_uu_tien',p_uu,'cap_phong_sach','C',
    'cam_bien', jsonb_build_array(jsonb_build_object(
      'loai_cam_bien','DP','loai_canh_bao','OOS_DP','don_vi','Pa','gioi_han_duoi',10,'gioi_han_tren',20,
      'tong_diem',60,'diem_hop_le',60,'gia_tri_tb',8,'gia_tri_min',5,'gia_tri_max',25,
      'diem_oos',p_thap+p_cao,'diem_oos_thap',p_thap,'diem_oos_cao',p_cao,'oos_10phut_cuoi',p_oos10,
      'muc_canh_bao','NORMAL','chan_doan','{}'::jsonb))));
END $$;
CREATE FUNCTION pg_temp.sev(p text) RETURNS text LANGUAGE sql AS
$$ SELECT muc_canh_bao_hien_tai FROM public.su_co WHERE ma_phong=p AND loai_cam_bien='DP' AND thoi_gian_dong IS NULL ORDER BY thoi_gian_mo DESC LIMIT 1 $$;
-- GMP: phòng ngoài cấp / sai hướng VẪN GHI dữ liệu OOS (KPI/tuân thủ đủ) — chỉ không mở sự cố.
CREATE FUNCTION pg_temp.oos_ghi(p_phong text, p_gio int) RETURNS boolean LANGUAGE sql AS
$$ SELECT EXISTS(SELECT 1 FROM public.du_lieu_gio WHERE ma_phong=p_phong AND loai_cam_bien='DP'
     AND bucket_utc >= date_trunc('hour', now()) AND COALESCE(diem_oos,0) > 0) $$;  -- bucket kiểm thử = tương lai
CREATE FUNCTION pg_temp.clean_room() RETURNS text LANGUAGE sql AS $$
  SELECT p.ma_phong FROM public.phong_sach p
  WHERE p.kich_hoat AND p.muc_uu_tien IN('P1','P2')   -- mọi khu (không chỉ C1) để đủ phòng
    AND NOT EXISTS(SELECT 1 FROM public.su_co s WHERE s.ma_phong=p.ma_phong AND s.loai_cam_bien='DP' AND s.thoi_gian_dong IS NULL)
  ORDER BY p.ma_phong LIMIT 1 $$;
-- đóng sự cố kiểm thử (thoi_gian_mo tương lai) trên phòng → trả phòng về "sạch" cho kịch bản sau
CREATE FUNCTION pg_temp.tra_phong(p text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  UPDATE public.su_co SET thoi_gian_dong=now() WHERE ma_phong=p AND loai_cam_bien='DP' AND thoi_gian_dong IS NULL AND thoi_gian_mo > now();
END $$;
CREATE FUNCTION pg_temp.setcfg(k text, v text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  INSERT INTO public.cau_hinh(key,value) VALUES(k,v) ON CONFLICT(key) DO UPDATE SET value=v; END $$;

-- 17/07: GHIM phạm vi KHU + LOẠI CẢM BIẾN về ALL trong transaction test — kịch bản
-- ingest chọn phòng mọi khu (clean_room) và bom cảm biến DP, không được phụ thuộc
-- quyết định vận hành tạm thời (vd canh_bao_khu_vuc='C1,Q2' tắt C4;
-- canh_bao_loai_cam_bien='DP' tắt RH/T). ROLLBACK cuối file trả lại nguyên trạng.
DO $$ BEGIN
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  INSERT INTO public.cau_hinh(key,value) VALUES('canh_bao_khu_vuc','ALL')
  ON CONFLICT(key) DO UPDATE SET value='ALL';
  INSERT INTO public.cau_hinh(key,value) VALUES('canh_bao_loai_cam_bien','ALL')
  ON CONFLICT(key) DO UPDATE SET value='ALL';
END $$;

-- ══════════ NGUYÊN TẮC CẢNH BÁO ══════════

-- N1 — Đổi NGƯỠNG cảnh báo → mức sự cố khi ingest đổi theo
DO $$
DECLARE v_p text; v_cao text; v_thap text; v_dat boolean;
BEGIN
  PERFORM pg_temp.setcfg('canh_bao_huong','{}'); PERFORM pg_temp.setcfg('nguong_hanh_dong','5');
  v_p := pg_temp.clean_room();
  PERFORM pg_temp.setcfg('nguong_canh_bao','50');                 -- ngưỡng CAO
  PERFORM pg_temp.bom(v_p,'AHU-KTN1a','P1', 30, 30, 0, 9);        -- OOS 30 < 50 → NORMAL (không mở)
  v_cao := pg_temp.sev(v_p);
  PERFORM pg_temp.setcfg('nguong_canh_bao','10');                 -- ngưỡng THẤP
  PERFORM pg_temp.bom(v_p,'AHU-KTN1b','P1', 31, 30, 0, 9);        -- OOS 30 > 10 → CRITICAL
  v_thap := pg_temp.sev(v_p);
  v_dat := (v_cao IS NULL) AND (v_thap='CRITICAL');
  PERFORM pg_temp.ghi('CANHBAO','N1 · Đổi ngưỡng cảnh báo → mức sự cố khi ingest', v_dat,
    format('OOS=30 · ngưỡng 50→mức=%s (kỳ vọng không mở) · ngưỡng 10→mức=%s (kỳ vọng CRITICAL)',
      COALESCE(v_cao,'(không mở)'), COALESCE(v_thap,'(không mở)')),
    'ingest v_c2=nguong_canh_bao: v_od>v_c2 mới mở; đổi ngưỡng đổi ranh giới mở cảnh báo');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N1 · Đổi ngưỡng cảnh báo → mức sự cố khi ingest', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- N2 — Đổi HƯỚNG cảnh báo (canh_bao_huong) → OOS thấp/cao có mở hay không
DO $$
DECLARE v_p text; v_tren text; v_cahai text; v_ghi boolean; v_dat boolean;
BEGIN
  PERFORM pg_temp.setcfg('nguong_canh_bao','10'); PERFORM pg_temp.setcfg('nguong_hanh_dong','5');
  v_p := pg_temp.clean_room();
  PERFORM pg_temp.setcfg('canh_bao_huong','{"DP":{"su_co":"TREN"}}');   -- chỉ báo khi VƯỢT TRÊN
  PERFORM pg_temp.bom(v_p,'AHU-KTN2a','P1', 32, 55, 0, 9);              -- toàn OOS THẤP → hướng TREN bỏ qua
  v_tren := pg_temp.sev(v_p);
  v_ghi := pg_temp.oos_ghi(v_p, 32);    -- GMP: dù không mở sự cố, DỮ LIỆU OOS vẫn phải ghi
  PERFORM pg_temp.setcfg('canh_bao_huong','{"DP":{"su_co":"CA_HAI"}}'); -- báo cả hai chiều
  PERFORM pg_temp.bom(v_p,'AHU-KTN2b','P1', 33, 55, 0, 9);              -- OOS THẤP → CA_HAI mở
  v_cahai := pg_temp.sev(v_p);
  v_dat := (v_tren IS NULL) AND v_ghi AND (v_cahai='CRITICAL');
  PERFORM pg_temp.ghi('CANHBAO','N2 · Đổi hướng cảnh báo → chỉ mở đúng hướng, DỮ LIỆU vẫn ghi', v_dat,
    format('OOS toàn THẤP · hướng TREN→mức=%s (không mở) NHƯNG OOS vẫn ghi=%s · CA_HAI→mức=%s (CRITICAL)',
      COALESCE(v_tren,'(không mở)'), v_ghi, COALESCE(v_cahai,'(không mở)')),
    'ingest v_dir_sc=canh_bao_huong[loai].su_co: sai hướng KHÔNG mở sự cố nhưng du_lieu_gio VẪN ghi OOS (KPI đủ)');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N2 · Đổi hướng cảnh báo → OOS thấp có mở hay không', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- N3 — Đổi PHẠM VI (canh_bao_muc_uu_tien) → phòng ưu tiên ngoài phạm vi có được cảnh báo
DO $$
DECLARE v_p text; v_ngoai text; v_trong text; v_ghi boolean; v_dat boolean;
BEGIN
  PERFORM pg_temp.setcfg('nguong_canh_bao','10'); PERFORM pg_temp.setcfg('canh_bao_huong','{}'); PERFORM pg_temp.setcfg('nguong_hanh_dong','5');
  v_p := pg_temp.clean_room();
  PERFORM pg_temp.setcfg('canh_bao_muc_uu_tien','P1,P2');          -- P3 NGOÀI phạm vi
  PERFORM pg_temp.bom(v_p,'AHU-KTN3a','P3', 34, 55, 0, 9);         -- phòng ưu tiên P3
  v_ngoai := pg_temp.sev(v_p);
  v_ghi := pg_temp.oos_ghi(v_p, 34);   -- GMP: ngoài cấp VẪN ghi dữ liệu OOS (KPI/tuân thủ đủ)
  PERFORM pg_temp.setcfg('canh_bao_muc_uu_tien','P1,P2,P3');       -- P3 TRONG phạm vi
  PERFORM pg_temp.bom(v_p,'AHU-KTN3b','P3', 35, 55, 0, 9);
  v_trong := pg_temp.sev(v_p);
  v_dat := (v_ngoai IS NULL) AND v_ghi AND (v_trong='CRITICAL');
  PERFORM pg_temp.ghi('CANHBAO','N3 · Cấp phòng được cảnh báo: ngoài cấp KHÔNG mở nhưng VẪN ghi OOS', v_dat,
    format('phòng P3 · phạm vi P1,P2→mức=%s (không mở) NHƯNG OOS vẫn ghi=%s · P1,P2,P3→mức=%s (CRITICAL)',
      COALESCE(v_ngoai,'(không mở)'), v_ghi, COALESCE(v_trong,'(không mở)')),
    'ingest v_uu_tien=canh_bao_muc_uu_tien: ngoài cấp KHÔNG mở sự cố/leo thang, nhưng du_lieu_gio VẪN ghi OOS ⇒ KPI/tuân thủ đủ');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N3 · Đổi phạm vi ưu tiên → P3 ngoài/trong phạm vi cảnh báo', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════ TÀI KHOẢN ══════════

-- N4 — Đổi KHU tài khoản → mất quyền thao tác cảnh báo khu cũ
DO $$
DECLARE v_sc1 bigint; v_sc2 bigint; r_truoc jsonb; r_sau jsonb; v_dat boolean;
BEGIN
  v_sc1 := pg_temp.tao_sc('C1','AHU-KTN4a','CHUA_XU_LY');
  r_truoc := pg_temp.tt('ipctest@gmail.com', v_sc1, 'ipc_bao_co_dien');    -- ipctest (C1,C4,Q2) → OK
  UPDATE public.nguoi_dung SET khu_vuc=ARRAY['Q2'] WHERE email='ipctest@gmail.com';  -- đổi chỉ còn Q2
  v_sc2 := pg_temp.tao_sc('C1','AHU-KTN4b','CHUA_XU_LY');
  r_sau := pg_temp.tt('ipctest@gmail.com', v_sc2, 'ipc_bao_co_dien');      -- giờ chỉ Q2 → C1 CHẶN
  v_dat := pg_temp.ok(r_truoc) AND (NOT pg_temp.ok(r_sau)) AND (r_sau->>'loi')='KHONG_DUOC_PHEP';
  PERFORM pg_temp.ghi('CANHBAO','N4 · Đổi khu tài khoản → mất quyền thao tác cảnh báo khu cũ', v_dat,
    format('trước (C1,C4,Q2) ok=%s · sau (chỉ Q2) trên sự cố C1 ok=%s loi=%s',
      r_truoc->>'ok', r_sau->>'ok', r_sau->>'loi'),
    'khu_duoc_xem đọc nguoi_dung.khu_vuc LIVE ⇒ đổi khu tài khoản đổi ngay quyền thao tác (phong_duoc_xem)');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N4 · Đổi khu tài khoản → mất quyền thao tác cảnh báo khu cũ', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- N5 — VÔ HIỆU HOÁ tài khoản → không thao tác được cảnh báo
DO $$
DECLARE v_sc1 bigint; v_sc2 bigint; r_truoc jsonb; r_sau jsonb; v_dat boolean;
BEGIN
  v_sc1 := pg_temp.tao_sc('C1','AHU-KTN5a','DA_BAO_CO_DIEN');
  r_truoc := pg_temp.tt('chanbonght@gmail.com', v_sc1, 'mep_tiep_nhan');   -- MEP hoạt động → OK
  UPDATE public.nguoi_dung SET kich_hoat=false WHERE email='chanbonght@gmail.com';   -- khoá
  v_sc2 := pg_temp.tao_sc('C1','AHU-KTN5b','DA_BAO_CO_DIEN');
  r_sau := pg_temp.tt('chanbonght@gmail.com', v_sc2, 'mep_tiep_nhan');     -- bị khoá → CHẶN
  UPDATE public.nguoi_dung SET kich_hoat=true WHERE email='chanbonght@gmail.com';    -- phục hồi cho kịch bản sau
  v_dat := pg_temp.ok(r_truoc) AND (NOT pg_temp.ok(r_sau));
  PERFORM pg_temp.ghi('CANHBAO','N5 · Vô hiệu hoá tài khoản → không thao tác được', v_dat,
    format('trước ok=%s · sau (kich_hoat=false) ok=%s loi=%s', r_truoc->>'ok', r_sau->>'ok', r_sau->>'loi'),
    'rpc_thao_tac_su_co: SELECT vai_tro ... AND kich_hoat ⇒ tài khoản khoá không resolve được vai ⇒ chặn');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N5 · Vô hiệu hoá tài khoản → không thao tác được', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- N6 — Đổi VAI TRÒ tài khoản → bộ nút thao tác đổi theo
DO $$
DECLARE v_sc bigint; r_truoc jsonb; r_sau jsonb; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','AHU-KTN6','DA_BAO_CO_DIEN');
  r_truoc := pg_temp.tt('ninhntn01@gmail.com', v_sc, 'mep_tiep_nhan');     -- ninhntn01 là LOT → nút Cơ điện CHẶN
  UPDATE public.nguoi_dung SET vai_tro='MEP' WHERE email='ninhntn01@gmail.com';   -- đổi thành Cơ điện
  r_sau := pg_temp.tt('ninhntn01@gmail.com', v_sc, 'mep_tiep_nhan');       -- giờ MEP → OK
  UPDATE public.nguoi_dung SET vai_tro='LOT' WHERE email='ninhntn01@gmail.com';   -- phục hồi
  v_dat := (NOT pg_temp.ok(r_truoc)) AND pg_temp.ok(r_sau);
  PERFORM pg_temp.ghi('CANHBAO','N6 · Đổi vai trò tài khoản → bộ nút thao tác đổi', v_dat,
    format('LOT bấm nút Cơ điện ok=%s(%s) · sau đổi thành MEP ok=%s',
      r_truoc->>'ok', r_truoc->>'loi', r_sau->>'ok'),
    'quy_tac_chuyen_trang_thai khớp (hanh_dong,vai_tro) ⇒ đổi vai trò đổi ngay nút được bấm');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N6 · Đổi vai trò tài khoản → bộ nút thao tác đổi', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════ DANH SÁCH PHÒNG ══════════

-- N7 — Đổi KHU phòng → cảnh báo chuyển sang đội khu mới (ai thao tác được đổi)
DO $$
DECLARE v_sc bigint; v_phong text; r_c1_truoc jsonb; r_c1_sau jsonb; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','AHU-KTN7','CHUA_XU_LY');
  SELECT ma_phong INTO v_phong FROM public.su_co WHERE ma_su_co=v_sc;
  -- tài khoản chỉ-C1: được thao tác khi phòng ở C1
  UPDATE public.nguoi_dung SET khu_vuc=ARRAY['C1'] WHERE email='ipctest@gmail.com';
  r_c1_truoc := pg_temp.tt('ipctest@gmail.com', v_sc, 'ipc_bao_co_dien');  -- phòng C1 → OK
  -- ĐỔI KHU PHÒNG sang Q2  (sự cố cũng theo khu phòng)
  UPDATE public.phong_sach SET khu_vuc='Q2' WHERE ma_phong=v_phong;
  UPDATE public.su_co SET khu_vuc='Q2', trang_thai_hien_tai='CHUA_XU_LY' WHERE ma_su_co=v_sc;
  r_c1_sau := pg_temp.tt('ipctest@gmail.com', v_sc, 'ipc_bao_co_dien');    -- tài khoản C1 nay KHÔNG được (phòng đã sang Q2)
  v_dat := pg_temp.ok(r_c1_truoc) AND (NOT pg_temp.ok(r_c1_sau)) AND (r_c1_sau->>'loi')='KHONG_DUOC_PHEP';
  PERFORM pg_temp.ghi('CANHBAO','N7 · Đổi khu phòng → quyền thao tác theo khu mới', v_dat,
    format('phòng %s: TK-C1 khi phòng C1 ok=%s · sau đổi phòng→Q2 ok=%s loi=%s',
      v_phong, r_c1_truoc->>'ok', r_c1_sau->>'ok', r_c1_sau->>'loi'),
    'phong_duoc_xem theo phong_sach.khu_vuc LIVE ⇒ đổi khu phòng chuyển cảnh báo sang đội khu mới');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N7 · Đổi khu phòng → quyền thao tác theo khu mới', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- N8 — VÔ HIỆU HOÁ phòng → WF1 NGỪNG THU (nhưng sự cố đang mở VẪN đóng được, không mồ côi)
DO $$
DECLARE v_sc bigint; v_phong text; v_wf1_truoc boolean; v_wf1_sau boolean; r_dong jsonb; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','AHU-KTN8','DA_BAO_CO_DIEN');
  SELECT ma_phong INTO v_phong FROM public.su_co WHERE ma_su_co=v_sc;
  v_wf1_truoc := EXISTS(SELECT 1 FROM public.phong_sach WHERE ma_phong=v_phong AND kich_hoat);   -- WF1 SẼ thu
  UPDATE public.phong_sach SET kich_hoat=false WHERE ma_phong=v_phong;                            -- VÔ HIỆU phòng
  v_wf1_sau := EXISTS(SELECT 1 FROM public.phong_sach WHERE ma_phong=v_phong AND kich_hoat);      -- WF1 KHÔNG thu nữa
  r_dong := pg_temp.tt('khoado.qa@cpc1hn.vn', v_sc, 'qa_da_khac_phuc', 'Đóng nốt sự cố sau khi ngừng giám sát phòng'); -- sự cố cũ vẫn đóng được
  v_dat := v_wf1_truoc AND (NOT v_wf1_sau) AND pg_temp.ok(r_dong);
  PERFORM pg_temp.ghi('CANHBAO','N8 · Vô hiệu hoá phòng → WF1 ngừng thu, sự cố cũ vẫn đóng được', v_dat,
    format('phòng %s trong danh sách WF1: trước=%s → sau=%s · sự cố cũ đóng được=%s',
      v_phong, v_wf1_truoc, v_wf1_sau, r_dong->>'ok'),
    'WF1 "Đọc cấu hình + phòng" chỉ lấy phong_sach.kich_hoat ⇒ ngừng thu; phong_duoc_xem KHÔNG kiểm kich_hoat nên sự cố đang mở không bị mồ côi');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N8 · Vô hiệu hoá phòng → WF1 ngừng thu, sự cố cũ vẫn đóng được', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- N9 — (ĐÃ BỎ 17/07/2026) Mức ưu tiên → SLA quá hạn: cơ chế SLA hẹn giờ đã gỡ
-- (view xem_su_co_qua_han + 4 khoá sla_* không còn). Ảnh hưởng của mức ưu tiên
-- lên PHẠM VI cảnh báo vẫn kiểm ở cai_dat.sql E1 và bộ kiểm chính.

-- ══════════ KẾT HỢP ══════════

-- N10 — KẾT HỢP: đổi khu PHÒNG + tài khoản khu MỚI → cảnh báo "theo phòng" sang đội khu mới
DO $$
DECLARE v_sc bigint; v_phong text; r_q2_truoc jsonb; r_q2_sau jsonb; v_dat boolean;
BEGIN
  -- 17/07: GHIM fixture — hoavu.qc trên live đã bị đổi vai trò (LOT) làm test vỡ oan.
  -- File chạy trong transaction ROLLBACK nên UPDATE này không chạm dữ liệu thật.
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  UPDATE public.nguoi_dung SET vai_tro='IPC', khu_vuc=ARRAY['Q2']::text[], kich_hoat=true
   WHERE email='hoavu.qc@cpc1hn.vn';
  v_sc := pg_temp.tao_sc('C1','AHU-KTN10','CHUA_XU_LY');
  SELECT ma_phong INTO v_phong FROM public.su_co WHERE ma_su_co=v_sc;
  -- tài khoản Q2 (hoavu.qc): khi phòng còn C1 → KHÔNG thao tác được
  r_q2_truoc := pg_temp.tt('hoavu.qc@cpc1hn.vn', v_sc, 'ipc_bao_co_dien');
  -- ĐỔI KHU PHÒNG sang Q2 → tài khoản Q2 NAY thao tác được (cảnh báo theo phòng chuyển đội)
  UPDATE public.phong_sach SET khu_vuc='Q2' WHERE ma_phong=v_phong;
  UPDATE public.su_co SET khu_vuc='Q2' WHERE ma_su_co=v_sc;
  r_q2_sau := pg_temp.tt('hoavu.qc@cpc1hn.vn', v_sc, 'ipc_bao_co_dien');
  v_dat := (NOT pg_temp.ok(r_q2_truoc)) AND pg_temp.ok(r_q2_sau);
  PERFORM pg_temp.ghi('CANHBAO','N10 · KẾT HỢP: đổi khu phòng → cảnh báo chuyển đội khu mới', v_dat,
    format('TK-Q2 khi phòng C1 ok=%s(%s) · sau đổi phòng→Q2 ok=%s',
      r_q2_truoc->>'ok', r_q2_truoc->>'loi', r_q2_sau->>'ok'),
    'Đổi khu phòng làm phong_duoc_xem chuyển: đội khu cũ mất quyền (N7), đội khu mới có quyền (N10)');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N10 · KẾT HỢP: đổi khu phòng → cảnh báo chuyển đội khu mới', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- N11 — KẾT HỢP: đổi ưu tiên PHÒNG P1→P3 + BỎ P3 khỏi phạm vi → phòng NGOÀI cảnh báo hoàn toàn
DO $$
DECLARE v_pA text; v_pB text; v_p1 text; v_p3 text; v_ghiB boolean; v_dat boolean;
BEGIN
  PERFORM pg_temp.setcfg('nguong_canh_bao','10'); PERFORM pg_temp.setcfg('canh_bao_huong','{}');
  PERFORM pg_temp.setcfg('nguong_hanh_dong','5'); PERFORM pg_temp.setcfg('canh_bao_muc_uu_tien','P1,P2');  -- P3 ngoài
  v_pA := pg_temp.clean_room();
  PERFORM pg_temp.bom(v_pA,'AHU-KTN11a','P1', 40, 55, 0, 9);      -- phòng P1 (trong phạm vi) → mở (đối chứng)
  v_p1 := pg_temp.sev(v_pA);
  v_pB := pg_temp.clean_room();                                   -- phòng SẠCH khác
  UPDATE public.phong_sach SET muc_uu_tien='P3' WHERE ma_phong=v_pB;   -- hạ phòng B xuống P3
  PERFORM pg_temp.bom(v_pB,'AHU-KTN11b','P3', 41, 55, 0, 9);      -- P3 ngoài phạm vi → KHÔNG mở
  v_p3 := pg_temp.sev(v_pB);
  v_ghiB := pg_temp.oos_ghi(v_pB, 41);                            -- nhưng OOS vẫn ghi (KPI/tuân thủ đủ)
  v_dat := (v_p1='CRITICAL') AND (v_p3 IS NULL) AND v_ghiB;
  PERFORM pg_temp.ghi('CANHBAO','N11 · KẾT HỢP: phòng P1→P3 + bỏ P3 phạm vi → tắt cảnh báo, VẪN ghi OOS', v_dat,
    format('phòng P1 mở=%s · phòng hạ P3 (ngoài phạm vi) mở=%s NHƯNG OOS vẫn ghi=%s',
      COALESCE(v_p1,'(không)'), COALESCE(v_p3,'(không mở)'), v_ghiB),
    'Hai thay đổi cộng hưởng: phòng hạ ưu tiên + phạm vi bỏ ưu tiên ⇒ tắt sự cố/leo thang, nhưng dữ liệu OOS vẫn đủ');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N11 · KẾT HỢP: phòng P1→P3 + bỏ P3 phạm vi → tắt cảnh báo, VẪN ghi OOS', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- N12 — KẾT HỢP: đổi NGƯỠNG + HƯỚNG cùng lúc → hành vi mở cảnh báo cộng hưởng
DO $$
DECLARE v_p text; v_a text; v_b text; v_dat boolean;
BEGIN
  -- reset đủ config để không nhiễu từ kịch bản trước; một phòng, hai giờ (như N1 đã đạt)
  PERFORM pg_temp.setcfg('nguong_hanh_dong','5'); PERFORM pg_temp.setcfg('canh_bao_muc_uu_tien','P1,P2,P3');
  PERFORM pg_temp.setcfg('nguong_gio_sach_de_dong','2'); PERFORM pg_temp.setcfg('dung_hinh_gio_lien_tiep','3');
  v_p := pg_temp.clean_room();
  -- ngưỡng CAO + hướng TREN: OOS thấp 40 → v_od(TREN)=0 → không mở
  PERFORM pg_temp.setcfg('nguong_canh_bao','30'); PERFORM pg_temp.setcfg('canh_bao_huong','{"DP":{"su_co":"TREN"}}');
  PERFORM pg_temp.bom(v_p,'AHU-KTN12a','P1', 42, 40, 0, 9);
  v_a := pg_temp.sev(v_p);
  -- hạ ngưỡng + hướng CA_HAI: OOS thấp 40 > 10, cả hai chiều → CRITICAL
  PERFORM pg_temp.setcfg('nguong_canh_bao','10'); PERFORM pg_temp.setcfg('canh_bao_huong','{"DP":{"su_co":"CA_HAI"}}');
  PERFORM pg_temp.bom(v_p,'AHU-KTN12b','P1', 43, 40, 0, 9);
  v_b := pg_temp.sev(v_p);
  v_dat := (v_a IS NULL) AND (v_b='CRITICAL');
  PERFORM pg_temp.ghi('CANHBAO','N12 · KẾT HỢP: đổi ngưỡng + hướng → hành vi mở cộng hưởng', v_dat,
    format('OOS thấp 40 · (ngưỡng 30 + hướng TREN)→%s · (ngưỡng 10 + CA_HAI)→%s',
      COALESCE(v_a,'(không mở)'), COALESCE(v_b,'(không mở)')),
    'Ngưỡng và hướng cùng quyết định v_od>v_c2 ⇒ đổi kết hợp đổi mạnh ranh giới cảnh báo');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CANHBAO','N12 · KẾT HỢP: đổi ngưỡng + hướng → hành vi mở cộng hưởng', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- =============================================================================
-- BÁO CÁO
-- =============================================================================
SELECT CASE WHEN dat THEN '✅' ELSE '❌' END||' '||rpad(nhom,7)||' '||ten AS ket_qua,
       chan_doan, CASE WHEN dat THEN '' ELSE coalesce(goi_y,'') END AS xu_ly
  FROM kq_kiem ORDER BY dat, stt;
SELECT format('TỔNG ẢNH HƯỞNG CẢNH BÁO: %s/%s đạt · %s VỠ',
       count(*) FILTER (WHERE dat), count(*), count(*) FILTER (WHERE NOT dat)) AS tong_ket FROM kq_kiem;
SELECT 'KQ_MAY_DOC:'||count(*) FILTER (WHERE NOT dat) AS may_doc FROM kq_kiem;
ROLLBACK;
