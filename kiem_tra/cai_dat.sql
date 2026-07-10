-- =============================================================================
-- BỘ KIỂM — TAB CÀI ĐẶT: chức năng + KẾT NỐI DỮ LIỆU web↔RPC↔DB
--
-- Mỗi RPC ghi cấu hình kiểm hai điều:
--   • QUYỀN: tài khoản KHÔNG đủ quyền (IPC) bị CHẶN; ADMIN (hoặc QA nơi cho phép) OK.
--   • VÒNG TRÒN DỮ LIỆU: ghi xong → ĐỌC LẠI (qua đúng RPC/view mà web dùng) phải phản
--     ánh thay đổi ⇒ chứng minh Cài đặt thực sự nối tới hệ thống, không "ghi vào hư không".
-- Đóng vai tài khoản thật (JWT claims + SET LOCAL ROLE authenticated). ROLLBACK cuối.
-- CHẠY: trong kiem_tra/chay.sh (mục "CÀI ĐẶT"), hoặc psql -f trực tiếp.
-- =============================================================================
BEGIN;
SET LOCAL app.tg_bypass_append_only = 'on';

CREATE TEMP TABLE kq_kiem(stt serial, nhom text, ten text, dat boolean, chan_doan text, goi_y text);
CREATE FUNCTION pg_temp.ghi(p_nhom text, p_ten text, p_dat boolean, p_cd text DEFAULT NULL, p_gy text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$ INSERT INTO kq_kiem(nhom,ten,dat,chan_doan,goi_y) VALUES(p_nhom,p_ten,p_dat,p_cd,p_gy) $$;
CREATE FUNCTION pg_temp.claims(p_email text) RETURNS void LANGUAGE sql AS
$$ SELECT set_config('request.jwt.claims', json_build_object('role','authenticated','email',p_email)::text, true) $$;
CREATE FUNCTION pg_temp.ok(r jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE(r->>'ok','false')='true' $$;
CREATE FUNCTION pg_temp.chan(r jsonb) RETURNS boolean LANGUAGE sql AS  -- bị chặn vì thiếu quyền?
$$ SELECT COALESCE(r->>'ok','false')<>'true' AND COALESCE(r->>'loi','') IN ('KHONG_DUOC_PHEP','KHONG_CO_QUYEN','CHUA_DANG_NHAP') OR (r->>'thong_bao') ILIKE '%Quản trị%' OR (r->>'thong_bao') ILIKE '%quyền%' $$;
CREATE FUNCTION pg_temp.cfg(k text) RETURNS text LANGUAGE sql AS $$ SELECT value FROM public.cau_hinh WHERE key=k $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C1 — NGƯỠNG CẢNH BÁO (rpc_sua_nguong_canh_bao): IPC chặn · ADMIN ghi → cau_hinh phản ánh
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r_ipc jsonb; r_adm jsonb; v_reflect boolean; v_dat boolean;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('ipcbfs@gmail.com');   r_ipc := public.rpc_sua_nguong_canh_bao(23, 6);
  PERFORM pg_temp.claims('admin@cpc1hn.vn');     r_adm := public.rpc_sua_nguong_canh_bao(23, 6);
  EXECUTE 'RESET ROLE';
  v_reflect := (pg_temp.cfg('nguong_canh_bao')='23' AND pg_temp.cfg('nguong_hanh_dong')='6');
  v_dat := pg_temp.chan(r_ipc) AND pg_temp.ok(r_adm) AND v_reflect;
  PERFORM pg_temp.ghi('CAI_DAT','C1 · Ngưỡng cảnh báo: IPC chặn · ADMIN ghi→phản ánh', v_dat,
    format('IPC ok=%s(%s) · ADMIN ok=%s · cau_hinh=%s/%s',
      r_ipc->>'ok', COALESCE(r_ipc->>'loi',r_ipc->>'thong_bao'), r_adm->>'ok',
      pg_temp.cfg('nguong_canh_bao'), pg_temp.cfg('nguong_hanh_dong')),
    'rpc_sua_nguong_canh_bao phải chốt ADMIN + ghi cau_hinh(nguong_canh_bao,nguong_hanh_dong)');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C1 · Ngưỡng cảnh báo: IPC chặn · ADMIN ghi→phản ánh', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C2 — PHÒNG CRUD (rpc_them_phong / rpc_xoa_phong): IPC chặn · ADMIN thêm→có, xoá→hết
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r_ipc jsonb; r_them jsonb; r_xoa jsonb; v_co boolean; v_het boolean; v_dat boolean;
  v_p text := 'KTCFG.R1';
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('ipcbfs@gmail.com'); r_ipc  := public.rpc_them_phong(v_p,'Phòng kiểm thử','C1','AHU-KTCFG','P2');
  PERFORM pg_temp.claims('admin@cpc1hn.vn');   r_them := public.rpc_them_phong(v_p,'Phòng kiểm thử','C1','AHU-KTCFG','P2');
  SELECT EXISTS(SELECT 1 FROM public.phong_sach WHERE ma_phong=v_p) INTO v_co;
  r_xoa := public.rpc_xoa_phong(v_p);
  SELECT NOT EXISTS(SELECT 1 FROM public.phong_sach WHERE ma_phong=v_p AND kich_hoat) INTO v_het;
  EXECUTE 'RESET ROLE';
  v_dat := pg_temp.chan(r_ipc) AND pg_temp.ok(r_them) AND v_co AND pg_temp.ok(r_xoa) AND v_het;
  PERFORM pg_temp.ghi('CAI_DAT','C2 · Phòng CRUD: IPC chặn · ADMIN thêm→có · xoá→hết', v_dat,
    format('IPC ok=%s · thêm ok=%s (có trong phong_sach=%s) · xoá ok=%s (đã ẩn/hết=%s)',
      r_ipc->>'ok', r_them->>'ok', v_co, r_xoa->>'ok', v_het),
    'rpc_them_phong/rpc_xoa_phong chốt ADMIN + ghi phong_sach');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C2 · Phòng CRUD: IPC chặn · ADMIN thêm→có · xoá→hết', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C3 — GIỚI HẠN CẢM BIẾN (rpc_sua_gioi_han_cam_bien): IPC chặn · ADMIN ghi→cam_bien phản ánh
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r_ipc jsonb; r_adm jsonb; v_phong text; v_sau numeric; v_dat boolean;
BEGIN
  SELECT c.ma_phong INTO v_phong FROM public.cam_bien c JOIN public.phong_sach p ON p.ma_phong=c.ma_phong
   WHERE c.loai_cam_bien='DP' AND c.kich_hoat AND p.kich_hoat AND p.khu_vuc='C1' ORDER BY c.ma_phong LIMIT 1;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('ipcbfs@gmail.com'); r_ipc := public.rpc_sua_gioi_han_cam_bien(v_phong,'DP', 12.5, 22.5);
  PERFORM pg_temp.claims('admin@cpc1hn.vn');   r_adm := public.rpc_sua_gioi_han_cam_bien(v_phong,'DP', 12.5, 22.5);
  EXECUTE 'RESET ROLE';
  SELECT gioi_han_tren INTO v_sau FROM public.cam_bien WHERE ma_phong=v_phong AND loai_cam_bien='DP';
  v_dat := pg_temp.chan(r_ipc) AND pg_temp.ok(r_adm) AND v_sau=22.5;
  PERFORM pg_temp.ghi('CAI_DAT','C3 · Giới hạn cảm biến: IPC chặn · ADMIN ghi→phản ánh', v_dat,
    format('phòng %s · IPC ok=%s · ADMIN ok=%s · gioi_han_tren sau=%s (kỳ vọng 22.5)',
      v_phong, r_ipc->>'ok', r_adm->>'ok', v_sau),
    'rpc_sua_gioi_han_cam_bien chốt ADMIN + ghi cam_bien.gioi_han_*');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C3 · Giới hạn cảm biến: IPC chặn · ADMIN ghi→phản ánh', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C4 — CẤU HÌNH EMAIL (rpc_dat_cau_hinh_email): IPC chặn · ADMIN ghi→cau_hinh phản ánh
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r_ipc jsonb; r_adm jsonb; v_dat boolean; v_key text := 'email_it_gmp';
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('ipcbfs@gmail.com'); r_ipc := public.rpc_dat_cau_hinh_email(v_key,'kiemthu-it@cpc1hn.vn');
  PERFORM pg_temp.claims('admin@cpc1hn.vn');   r_adm := public.rpc_dat_cau_hinh_email(v_key,'kiemthu-it@cpc1hn.vn');
  EXECUTE 'RESET ROLE';
  v_dat := pg_temp.chan(r_ipc) AND pg_temp.ok(r_adm) AND pg_temp.cfg(v_key)='kiemthu-it@cpc1hn.vn';
  PERFORM pg_temp.ghi('CAI_DAT','C4 · Cấu hình email: IPC chặn · ADMIN ghi→phản ánh', v_dat,
    format('IPC ok=%s · ADMIN ok=%s · cau_hinh[%s]=%s', r_ipc->>'ok', r_adm->>'ok', v_key, pg_temp.cfg(v_key)),
    'rpc_dat_cau_hinh_email chốt ADMIN + ghi cau_hinh[key]');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C4 · Cấu hình email: IPC chặn · ADMIN ghi→phản ánh', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C5 — ƯU TIÊN CẢNH BÁO (rpc_dat_canh_bao_uu_tien): IPC chặn · ADMIN ghi→cau_hinh phản ánh
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r_ipc jsonb; r_adm jsonb; v_dat boolean;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('ipcbfs@gmail.com'); r_ipc := public.rpc_dat_canh_bao_uu_tien('P1,P2');
  PERFORM pg_temp.claims('admin@cpc1hn.vn');   r_adm := public.rpc_dat_canh_bao_uu_tien('P1,P2');
  EXECUTE 'RESET ROLE';
  v_dat := pg_temp.chan(r_ipc) AND pg_temp.ok(r_adm) AND replace(pg_temp.cfg('canh_bao_muc_uu_tien'),' ','')='P1,P2';
  PERFORM pg_temp.ghi('CAI_DAT','C5 · Ưu tiên cảnh báo: IPC chặn · ADMIN ghi→phản ánh', v_dat,
    format('IPC ok=%s · ADMIN ok=%s · canh_bao_muc_uu_tien=%s', r_ipc->>'ok', r_adm->>'ok', pg_temp.cfg('canh_bao_muc_uu_tien')),
    'rpc_dat_canh_bao_uu_tien chốt ADMIN + ghi cau_hinh(canh_bao_muc_uu_tien)');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C5 · Ưu tiên cảnh báo: IPC chặn · ADMIN ghi→phản ánh', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C6 — LUẬT PHÂN TUYẾN (rpc_luu_luat_phan_tuyen + dat_cong_tac): IPC chặn · ADMIN ghi→đọc lại có
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r_ipc jsonb; r_adm jsonb; r_ct jsonb; v_luat jsonb; v_co boolean; v_dat boolean;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('ipcbfs@gmail.com'); r_ipc := public.rpc_luu_luat_phan_tuyen(NULL,'RH','CRITICAL', 180, 'mẫu kiểm thử', true);
  PERFORM pg_temp.claims('admin@cpc1hn.vn');
  r_adm := public.rpc_luu_luat_phan_tuyen(NULL,'RH','CRITICAL', 180, 'mẫu kiểm thử', true);
  r_ct  := public.rpc_dat_cong_tac_phan_tuyen(true);
  v_luat := public.rpc_lay_luat_phan_tuyen();     -- ĐỌC LẠI qua đúng RPC web dùng
  EXECUTE 'RESET ROLE';
  SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(v_luat->'luat', v_luat->'rows', v_luat)) e
                WHERE e->>'loai_cam_bien'='RH' AND (e->>'cho_it_nhat_phut')='180') INTO v_co;
  v_dat := pg_temp.chan(r_ipc) AND pg_temp.ok(r_adm) AND v_co;
  PERFORM pg_temp.ghi('CAI_DAT','C6 · Luật phân tuyến: IPC chặn · ADMIN lưu→đọc lại có', v_dat,
    format('IPC ok=%s · ADMIN lưu ok=%s · công tắc ok=%s · đọc lại thấy luật RH/180=%s',
      r_ipc->>'ok', r_adm->>'ok', r_ct->>'ok', v_co),
    'rpc_luu_luat_phan_tuyen (ADMIN/QA) → quy_tac_phan_tuyen_tu_dong; rpc_lay_luat_phan_tuyen đọc lại');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C6 · Luật phân tuyến: IPC chặn · ADMIN lưu→đọc lại có', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C7 — NGƯỜI NHẬN CẢNH BÁO (rpc_luu_nguoi_nhan_canh_bao): IPC chặn · ADMIN lưu→đọc lại có
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r_ipc jsonb; r_adm jsonb; v_ds jsonb; v_co boolean; v_dat boolean; v_mail text := 'nhan.kiemthu@cpc1hn.vn';
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('ipcbfs@gmail.com'); r_ipc := public.rpc_luu_nguoi_nhan_canh_bao(NULL,v_mail,'Người nhận KT','MEP',ARRAY['C1'],true);
  PERFORM pg_temp.claims('admin@cpc1hn.vn');   r_adm := public.rpc_luu_nguoi_nhan_canh_bao(NULL,v_mail,'Người nhận KT','MEP',ARRAY['C1'],true);
  SELECT EXISTS(SELECT 1 FROM public.rpc_lay_nguoi_nhan_canh_bao() WHERE lower(email)=v_mail) INTO v_co;   -- đọc lại qua RPC (SETOF)
  EXECUTE 'RESET ROLE';
  v_dat := pg_temp.chan(r_ipc) AND pg_temp.ok(r_adm) AND v_co;
  PERFORM pg_temp.ghi('CAI_DAT','C7 · Người nhận cảnh báo: IPC chặn · ADMIN lưu→đọc lại có', v_dat,
    format('IPC ok=%s · ADMIN ok=%s · đọc lại thấy %s = %s', r_ipc->>'ok', r_adm->>'ok', v_mail, v_co),
    'rpc_luu_nguoi_nhan_canh_bao (ADMIN) → bảng người nhận; rpc_lay_nguoi_nhan_canh_bao đọc lại');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C7 · Người nhận cảnh báo: IPC chặn · ADMIN lưu→đọc lại có', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C8 — NGƯỜI DÙNG / PHÂN QUYỀN (rpc_luu_nguoi_dung): CHỈ ADMIN · lưu→đọc lại có
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r_qa jsonb; r_adm jsonb; v_ten text; v_dat boolean; v_mail text := 'ipctest@gmail.com';  -- tài khoản CÓ SẴN (có auth)
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('khoado.qa@cpc1hn.vn'); r_qa  := public.rpc_luu_nguoi_dung(v_mail,'C8 QA thử','IPC',ARRAY['C1','C4','Q2'],true);   -- QA KHÔNG được (chỉ ADMIN)
  PERFORM pg_temp.claims('admin@cpc1hn.vn');       r_adm := public.rpc_luu_nguoi_dung(v_mail,'C8 ADMIN thử','IPC',ARRAY['C1','C4','Q2'],true);
  SELECT ho_ten INTO v_ten FROM public.rpc_lay_nguoi_dung() WHERE lower(email)=v_mail;   -- đọc lại: tên đã đổi?
  EXECUTE 'RESET ROLE';
  v_dat := pg_temp.chan(r_qa) AND pg_temp.ok(r_adm) AND v_ten='C8 ADMIN thử';
  PERFORM pg_temp.ghi('CAI_DAT','C8 · Người dùng/phân quyền: CHỈ ADMIN · lưu→đọc lại đổi', v_dat,
    format('QA ok=%s(%s) · ADMIN ok=%s · đọc lại ho_ten=%s (kỳ vọng "C8 ADMIN thử")',
      r_qa->>'ok', COALESCE(r_qa->>'loi',r_qa->>'thong_bao'), r_adm->>'ok', v_ten),
    'rpc_luu_nguoi_dung: la_admin() ⇒ chỉ ADMIN + email phải có tài khoản auth; rpc_lay_nguoi_dung đọc lại');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C8 · Người dùng/phân quyền: CHỈ ADMIN · lưu→đọc lại đổi', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- C9 — LỊCH SỬ CẤU HÌNH: mọi thay đổi Cài đặt được GHI VẾT (audit connection)
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_truoc int; v_sau int; v_dat boolean;
BEGIN
  -- đọc BẢNG gốc theo key (view xem_lich_su_cau_hinh bị chặn LIMIT 200 nên count không tăng)
  SELECT count(*) INTO v_truoc FROM public.lich_su_cau_hinh WHERE key_or_id='nguong_canh_bao';
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM pg_temp.claims('admin@cpc1hn.vn');
  PERFORM public.rpc_sua_nguong_canh_bao(24, 7);   -- một thay đổi cấu hình
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v_sau FROM public.lich_su_cau_hinh WHERE key_or_id='nguong_canh_bao';
  v_dat := (v_sau > v_truoc);
  PERFORM pg_temp.ghi('CAI_DAT','C9 · Lịch sử cấu hình ghi vết mọi thay đổi (trigger)', v_dat,
    format('dòng nhật ký nguong_canh_bao trước=%s sau=%s (phải tăng — trg_log_cau_hinh)', v_truoc, v_sau),
    'trg_log_cau_hinh ghi lich_su_cau_hinh khi cau_hinh đổi (ai/đổi gì/khi nào) — ALCOA+');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','C9 · Lịch sử cấu hình ghi vết mọi thay đổi (trigger)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- ẢNH HƯỞNG (E1–E6): ĐỔI CÀI ĐẶT → SỰ CỐ / HỆ THỐNG RA SAO
-- ══════════════════════════════════════════════════════════════════════════
CREATE FUNCTION pg_temp.tao_sc(p_khu text, p_ahu text, p_tt text, p_uu text DEFAULT 'P1')
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint; v_phong text;
BEGIN
  SELECT ma_phong INTO v_phong FROM public.phong_sach WHERE kich_hoat AND khu_vuc=p_khu ORDER BY ma_phong LIMIT 1;
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  INSERT INTO public.su_co(thuoc_thu_nghiem,khoa_su_co,ma_phong,ten_phong,khu_vuc,ahu,cap_phong_sach,muc_uu_tien,loai_cam_bien,loai_canh_bao,muc_canh_bao_ban_dau,muc_canh_bao_hien_tai,trang_thai_hien_tai,thoi_gian_mo,thoi_gian_lan_cuoi_quan_sat,thao_tac_cuoi_luc,nguon)
  VALUES(false,md5(p_ahu||p_tt||clock_timestamp()::text||random()::text),v_phong,'kiểm thử',p_khu,p_ahu,'C',p_uu,'DP','OOS_DP','CRITICAL','CRITICAL',p_tt,now()-interval '90 minutes',now(),now()-interval '90 minutes','KIEMTHU')
  RETURNING ma_su_co INTO v;
  RETURN v;
END $$;

-- E1 — Đổi ƯU TIÊN cảnh báo (canh_bao_muc_uu_tien) → phạm vi phòng đổi theo
DO $$
DECLARE v_p3_truoc boolean; v_p3_sau boolean; v_phong text; v_dat boolean;
BEGIN
  SELECT ma_phong INTO v_phong FROM public.phong_sach WHERE kich_hoat AND khu_vuc='C1' LIMIT 1;
  EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM pg_temp.claims('admin@cpc1hn.vn');
  PERFORM public.rpc_dat_canh_bao_uu_tien('P1,P2');
  v_p3_truoc := public.trong_pham_vi_canh_bao(v_phong, 'P3');     -- P3 chưa trong phạm vi
  PERFORM public.rpc_dat_canh_bao_uu_tien('P1,P2,P3');
  v_p3_sau := public.trong_pham_vi_canh_bao(v_phong, 'P3');       -- giờ P3 trong phạm vi
  EXECUTE 'RESET ROLE';
  v_dat := (v_p3_truoc IS FALSE) AND (v_p3_sau IS TRUE);
  PERFORM pg_temp.ghi('CAI_DAT','E1 · Đổi ưu tiên cảnh báo → phạm vi phòng đổi', v_dat,
    format('P3 in-scope: trước(P1,P2)=%s → sau(P1,P2,P3)=%s', v_p3_truoc, v_p3_sau),
    'trong_pham_vi_canh_bao đọc canh_bao_muc_uu_tien ⇒ đổi cài đặt đổi phòng nào được alert');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','E1 · Đổi ưu tiên cảnh báo → phạm vi phòng đổi', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- E2 — Đổi MỨC ƯU TIÊN sự cố → SLA quá hạn đổi (P1 gắt hơn P2)
DO $$
DECLARE v_p1 bigint; v_p2 bigint; v_qh_p1 boolean; v_qh_p2 boolean; v_dat boolean;
BEGIN
  v_p1 := pg_temp.tao_sc('C1','AHU-KTE2a','CHUA_XU_LY','P1');   -- mở 90' trước; SLA ack P1=30'
  v_p2 := pg_temp.tao_sc('C1','AHU-KTE2b','CHUA_XU_LY','P2');   -- SLA ack P2=60'
  -- cả hai 90' đều quá hạn, nhưng test: P1 luôn quá hạn (30'); dựng P2 mới hơn để khác biệt
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  UPDATE public.su_co SET thoi_gian_mo=now()-interval '45 minutes', thao_tac_cuoi_luc=now()-interval '45 minutes' WHERE ma_su_co=v_p2;  -- 45': quá P1(30) chưa quá P2(60)
  UPDATE public.su_co SET thoi_gian_mo=now()-interval '45 minutes', thao_tac_cuoi_luc=now()-interval '45 minutes' WHERE ma_su_co=v_p1;
  SELECT qua_han_tiep_nhan INTO v_qh_p1 FROM public.xem_su_co_qua_han WHERE ma_su_co=v_p1;
  SELECT qua_han_tiep_nhan INTO v_qh_p2 FROM public.xem_su_co_qua_han WHERE ma_su_co=v_p2;
  v_dat := (v_qh_p1 IS TRUE) AND (v_qh_p2 IS NOT TRUE);   -- 45': P1 quá hạn, P2 chưa
  PERFORM pg_temp.ghi('CAI_DAT','E2 · Mức ưu tiên → SLA quá hạn khác nhau (P1 gắt hơn P2)', v_dat,
    format('cùng 45'' chưa tiếp nhận: P1 quá hạn=%s (SLA 30'') · P2 quá hạn=%s (SLA 60'')', v_qh_p1, v_qh_p2),
    'xem_su_co_qua_han: ack_han theo muc_uu_tien (sla_ack_phut_p1=30, p2=60)');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','E2 · Mức ưu tiên → SLA quá hạn khác nhau (P1 gắt hơn P2)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- E3 — NGƯỜI NHẬN ↔ ĐỊNH TUYẾN SỰ CỐ: thêm người nhận → email_to của sự cố có họ
DO $$
DECLARE v_sc bigint; v_to_truoc text; v_to_sau text; v_dat boolean; v_mail text := 'mep.dinhtuyen@cpc1hn.vn';
BEGIN
  v_sc := pg_temp.tao_sc('C1','AHU-KTE3','DA_BAO_CO_DIEN','P1');   -- CRITICAL, định tuyến tới MEP
  SELECT string_agg(email_to,'|') INTO v_to_truoc FROM public.xem_dinh_tuyen_email_v14 WHERE ma_su_co=v_sc;
  EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM pg_temp.claims('admin@cpc1hn.vn');
  PERFORM public.rpc_luu_nguoi_nhan_canh_bao(NULL,v_mail,'MEP định tuyến','MEP',ARRAY['C1'],true);
  EXECUTE 'RESET ROLE';
  SELECT string_agg(email_to,'|') INTO v_to_sau FROM public.xem_dinh_tuyen_email_v14 WHERE ma_su_co=v_sc;
  v_dat := (COALESCE(v_to_truoc,'') NOT ILIKE '%'||v_mail||'%') AND (COALESCE(v_to_sau,'') ILIKE '%'||v_mail||'%');
  PERFORM pg_temp.ghi('CAI_DAT','E3 · Người nhận ↔ định tuyến sự cố (thêm→email_to có họ)', v_dat,
    format('email_to trước có %s=%s · sau=%s', v_mail,
      (COALESCE(v_to_truoc,'') ILIKE '%'||v_mail||'%'), (COALESCE(v_to_sau,'') ILIKE '%'||v_mail||'%')),
    'xem_dinh_tuyen_email_v14.email_to dựng từ bảng người nhận theo vai/khu ⇒ đổi người nhận đổi ai nhận mail sự cố');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','E3 · Người nhận ↔ định tuyến sự cố (thêm→email_to có họ)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- E4 — TẮT CÔNG TẮC phân tuyến → sự cố CHUA_XU_LY KHÔNG tự chuyển
DO $$
DECLARE v_sc bigint; r_tat jsonb; r_run jsonb; v_tt_sau text; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','AHU-KTE4','CHUA_XU_LY','P1');
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  UPDATE public.su_co SET thoi_gian_mo=now()-interval '5 hour', thao_tac_cuoi_luc=now()-interval '5 hour' WHERE ma_su_co=v_sc;  -- đủ 240'
  EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM pg_temp.claims('admin@cpc1hn.vn');
  r_tat := public.rpc_dat_cong_tac_phan_tuyen(false);   -- TẮT
  EXECUTE 'RESET ROLE';
  r_run := public.rpc_tu_phan_tuyen_su_co();
  SELECT trang_thai_hien_tai INTO v_tt_sau FROM public.su_co WHERE ma_su_co=v_sc;
  v_dat := pg_temp.ok(r_tat) AND (r_run->>'bat')='false' AND v_tt_sau='CHUA_XU_LY';
  PERFORM pg_temp.ghi('CAI_DAT','E4 · Tắt công tắc phân tuyến → không tự chuyển', v_dat,
    format('tắt ok=%s · rpc bat=%s so_chuyen=%s · sự cố vẫn=%s', r_tat->>'ok', r_run->>'bat', r_run->>'so_chuyen', v_tt_sau),
    'rpc_dat_cong_tac_phan_tuyen(false) → cfg tu_phan_tuyen_bat=false ⇒ rpc_tu_phan_tuyen_su_co dừng');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','E4 · Tắt công tắc phân tuyến → không tự chuyển', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- E5 — ĐỔI THỜI GIAN CHỜ luật phân tuyến → thời điểm tự chuyển đổi theo
DO $$
DECLARE v_sc bigint; v_chuyen_som text; v_chuyen_muon text; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','AHU-KTE5','CHUA_XU_LY','P1');
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  UPDATE public.su_co SET thoi_gian_mo=now()-interval '90 minutes', thao_tac_cuoi_luc=now()-interval '90 minutes' WHERE ma_su_co=v_sc;
  -- chờ 600': sự cố 90' CHƯA đủ → không chuyển  (đổi luật bằng ADMIN; chạy route như cron=postgres)
  EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM pg_temp.claims('admin@cpc1hn.vn');
  PERFORM public.rpc_dat_cong_tac_phan_tuyen(true);
  PERFORM public.rpc_luu_luat_phan_tuyen(1::smallint,'*','CRITICAL', 600, 'chờ lâu', true);
  EXECUTE 'RESET ROLE';
  PERFORM public.rpc_tu_phan_tuyen_su_co();
  SELECT trang_thai_hien_tai INTO v_chuyen_muon FROM public.su_co WHERE ma_su_co=v_sc;
  -- chờ 60': sự cố 90' ĐỦ → chuyển
  EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM pg_temp.claims('admin@cpc1hn.vn');
  PERFORM public.rpc_luu_luat_phan_tuyen(1::smallint,'*','CRITICAL', 60, 'chờ ngắn', true);
  EXECUTE 'RESET ROLE';
  PERFORM public.rpc_tu_phan_tuyen_su_co();
  SELECT trang_thai_hien_tai INTO v_chuyen_som FROM public.su_co WHERE ma_su_co=v_sc;
  v_dat := (v_chuyen_muon='CHUA_XU_LY') AND (v_chuyen_som='DA_BAO_CO_DIEN');
  PERFORM pg_temp.ghi('CAI_DAT','E5 · Đổi thời gian chờ luật → thời điểm tự chuyển đổi', v_dat,
    format('sự cố 90'': chờ 600''→vẫn %s · chờ 60''→%s', v_chuyen_muon, v_chuyen_som),
    'rpc_luu_luat_phan_tuyen đổi cho_it_nhat_phut ⇒ rpc_tu_phan_tuyen dùng ngưỡng mới');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','E5 · Đổi thời gian chờ luật → thời điểm tự chuyển đổi', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- E6 — VÔ HIỆU người nhận → email_to KHÔNG còn họ (đổi cài đặt gỡ người khỏi luồng sự cố)
DO $$
DECLARE v_sc bigint; v_id bigint; v_to_co text; v_to_het text; v_dat boolean; v_mail text := 'mep.gonguoi@cpc1hn.vn';
BEGIN
  v_sc := pg_temp.tao_sc('C1','AHU-KTE6','DA_BAO_CO_DIEN','P1');
  EXECUTE 'SET LOCAL ROLE authenticated'; PERFORM pg_temp.claims('admin@cpc1hn.vn');
  PERFORM public.rpc_luu_nguoi_nhan_canh_bao(NULL,v_mail,'MEP gỡ','MEP',ARRAY['C1'],true);
  SELECT string_agg(email_to,'|') INTO v_to_co FROM public.xem_dinh_tuyen_email_v14 WHERE ma_su_co=v_sc;
  SELECT id INTO v_id FROM public.rpc_lay_nguoi_nhan_canh_bao() WHERE lower(email)=v_mail;
  PERFORM public.rpc_luu_nguoi_nhan_canh_bao(v_id,v_mail,'MEP gỡ','MEP',ARRAY['C1'],false);   -- vô hiệu hoá
  SELECT string_agg(email_to,'|') INTO v_to_het FROM public.xem_dinh_tuyen_email_v14 WHERE ma_su_co=v_sc;
  EXECUTE 'RESET ROLE';
  v_dat := (COALESCE(v_to_co,'') ILIKE '%'||v_mail||'%') AND (COALESCE(v_to_het,'') NOT ILIKE '%'||v_mail||'%');
  PERFORM pg_temp.ghi('CAI_DAT','E6 · Vô hiệu người nhận → gỡ khỏi email_to sự cố', v_dat,
    format('email_to có %s: bật=%s → tắt=%s', v_mail,
      (COALESCE(v_to_co,'') ILIKE '%'||v_mail||'%'), (COALESCE(v_to_het,'') ILIKE '%'||v_mail||'%')),
    'người nhận kich_hoat=false ⇒ xem_dinh_tuyen_email_v14 loại khỏi email_to');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('CAI_DAT','E6 · Vô hiệu người nhận → gỡ khỏi email_to sự cố', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- =============================================================================
-- BÁO CÁO
-- =============================================================================
SELECT CASE WHEN dat THEN '✅' ELSE '❌' END||' '||rpad(nhom,7)||' '||ten AS ket_qua,
       chan_doan, CASE WHEN dat THEN '' ELSE coalesce(goi_y,'') END AS xu_ly
  FROM kq_kiem ORDER BY dat, stt;
SELECT format('TỔNG CÀI ĐẶT: %s/%s đạt · %s VỠ',
       count(*) FILTER (WHERE dat), count(*), count(*) FILTER (WHERE NOT dat)) AS tong_ket FROM kq_kiem;
SELECT 'KQ_MAY_DOC:'||count(*) FILTER (WHERE NOT dat) AS may_doc FROM kq_kiem;
ROLLBACK;
