-- =============================================================================
-- BỘ KIỂM SÂU — QUY TRÌNH XỬ LÝ SỰ CỐ & THAO TÁC CÁC BỘ PHẬN
--
-- Diễn lại TRỌN vòng đời một sự cố qua tay từng bộ phận (IPC · Cơ điện · Trực HSL ·
-- QA · Quản trị), gọi ĐÚNG rpc_thao_tac_su_co bằng tài khoản THẬT (đóng vai qua
-- request.jwt.claims + SET LOCAL ROLE authenticated), rồi kiểm:
--   • chuyển trạng thái đúng bảng luật quy_tac_chuyen_trang_thai
--   • guard vai trò (bộ phận sai KHÔNG bấm được nút của bộ phận khác)
--   • guard trạng thái (nút đúng vai nhưng SAI trạng thái hiện tại → chặn)
--   • bắt buộc lý do · ap_dung_khi (MO/DONG) · phân quyền KHU trên THAO TÁC
--   • dấu vết audit (mỗi thao tác một dòng lich_su_su_co, đúng người/vai) + hash liền
--   • cụm ↔ hàng chờ QA (đóng kỹ thuật ≠ đóng chất lượng)
--
-- AN TOÀN: MỘT giao dịch, kết thúc ROLLBACK. Không COMMIT (audit append-only).
--   Mỗi kịch bản bọc BEGIN…EXCEPTION → lỗi bất ngờ không làm sập cả bộ; mọi sự cố
--   thử nghiệm tạo mới (ma_phong 'KTS*') nên không đụng dữ liệu thật; ROLLBACK cuối
--   xoá sạch. Đọc theo cặp CHẨN ĐOÁN (đo được gì) + GỢI Ý (sửa ở đâu).
-- CHẠY: nằm trong kiem_tra/chay.sh (mục "QUY TRÌNH SỰ CỐ"), hoặc psql -f trực tiếp.
-- =============================================================================
BEGIN;
SET LOCAL app.tg_bypass_append_only = 'on';   -- cho phép dựng/sửa sự cố thử nghiệm

CREATE TEMP TABLE kq_kiem(stt serial, nhom text, ten text, dat boolean, chan_doan text, goi_y text);
CREATE FUNCTION pg_temp.ghi(p_nhom text, p_ten text, p_dat boolean, p_cd text DEFAULT NULL, p_gy text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$ INSERT INTO kq_kiem(nhom,ten,dat,chan_doan,goi_y) VALUES(p_nhom,p_ten,p_dat,p_cd,p_gy) $$;

-- Đóng vai một tài khoản THẬT và bấm một nút (trả jsonb kết quả của rpc).
CREATE FUNCTION pg_temp.tt(p_email text, p_sc bigint, p_hd text, p_ly_do text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','email',p_email)::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r := public.rpc_thao_tac_su_co(p_ma_su_co=>p_sc, p_hanh_dong=>p_hd, p_ly_do=>p_ly_do, p_nguon=>'kiemthu');
  EXECUTE 'RESET ROLE';
  RETURN COALESCE(r, '{}'::jsonb);
END $$;

-- Dựng một sự cố CRITICAL thử nghiệm. ma_phong PHẢI là phòng THẬT (phong_duoc_xem
-- deny-by-default phòng lạ) ⇒ tự chọn một phòng thật trong khu; p_ahu GIẢ và duy nhất
-- mỗi kịch bản để khoá cụm md5(ahu|sensor) không gộp nhầm giữa các kịch bản.
CREATE FUNCTION pg_temp.tao_sc(p_khu text, p_phong text, p_ahu text, p_tt text, p_uu text DEFAULT 'P1')
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint; v_phong text;
BEGIN
  SELECT ma_phong INTO v_phong FROM public.phong_sach
   WHERE kich_hoat AND khu_vuc=p_khu ORDER BY ma_phong LIMIT 1;
  IF v_phong IS NULL THEN RAISE EXCEPTION 'không có phòng thật ở khu %', p_khu; END IF;
  PERFORM set_config('app.tg_bypass_append_only','on',true);
  INSERT INTO public.su_co(thuoc_thu_nghiem,khoa_su_co,ma_phong,ten_phong,khu_vuc,ahu,cap_phong_sach,
     muc_uu_tien,loai_cam_bien,loai_canh_bao,muc_canh_bao_ban_dau,muc_canh_bao_hien_tai,
     trang_thai_hien_tai,thoi_gian_mo,thoi_gian_lan_cuoi_quan_sat,nguon)
  VALUES (false, md5(p_ahu||p_tt||clock_timestamp()::text||random()::text), v_phong,'kiểm thử',p_khu,p_ahu,'C',
     p_uu,'DP','OOS_DP','CRITICAL','CRITICAL',p_tt,now()-interval '90 minutes',now(),'KIEMTHU')
  RETURNING ma_su_co INTO v;
  RETURN v;
END $$;

-- tiện: trạng thái hiện tại + đã đóng chưa
CREATE FUNCTION pg_temp.tt_now(p_sc bigint) RETURNS text LANGUAGE sql AS
$$ SELECT trang_thai_hien_tai FROM public.su_co WHERE ma_su_co=p_sc $$;
CREATE FUNCTION pg_temp.dong_chua(p_sc bigint) RETURNS boolean LANGUAGE sql AS
$$ SELECT thoi_gian_dong IS NOT NULL FROM public.su_co WHERE ma_su_co=p_sc $$;
CREATE FUNCTION pg_temp.ok(r jsonb) RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE(r->>'ok','false')='true' $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S1 — ĐƯỜNG VÀNG TRỌN VẸN: IPC báo → Cơ điện tiếp nhận → Cơ điện khắc phục
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc bigint; r1 jsonb; r2 jsonb; r3 jsonb; v_dat boolean; v_audit int;
BEGIN
  v_sc := pg_temp.tao_sc('C1','KTS1.R1','AHU-KTS1','CHUA_XU_LY');
  r1 := pg_temp.tt('ipcbfs@gmail.com',  v_sc, 'ipc_bao_co_dien');           -- IPC → Đã báo Cơ điện
  r2 := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_tiep_nhan');          -- Cơ điện tiếp nhận
  r3 := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_xu_ly_xong');         -- Cơ điện khắc phục (đóng)
  SELECT count(*) INTO v_audit FROM public.lich_su_su_co WHERE ma_su_co=v_sc
     AND hanh_dong IN ('ipc_bao_co_dien','mep_tiep_nhan','mep_xu_ly_xong');
  v_dat := pg_temp.ok(r1) AND pg_temp.ok(r2) AND pg_temp.ok(r3)
       AND pg_temp.tt_now(v_sc)='DA_KHAC_PHUC' AND pg_temp.dong_chua(v_sc) AND v_audit=3;
  PERFORM pg_temp.ghi('KICH_BAN','S1 · Đường vàng IPC→Cơ điện→khắc phục', v_dat,
    format('trạng thái cuối=%s · đóng=%s · %s dòng audit · [%s|%s|%s]',
      pg_temp.tt_now(v_sc), pg_temp.dong_chua(v_sc), v_audit,
      r1->>'ok', r2->>'ok', r3->>'ok'),
    'rpc_thao_tac_su_co áp bảng luật quy_tac_chuyen_trang_thai; mỗi bước ghi lich_su_su_co');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S1 · Đường vàng IPC→Cơ điện→khắc phục', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S2 — NHÁNH CHỜ / KHÔNG XỬ LÝ ĐƯỢC / LEO THANG LẠI (Cơ điện ↔ IPC)
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc bigint; a jsonb; b jsonb; c jsonb; d jsonb; e jsonb; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','KTS2.R1','AHU-KTS2','DA_BAO_CO_DIEN');
  a := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_tiep_nhan');           -- → đang xử lý
  b := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_cho_xu_ly');           -- → chờ xử lý
  c := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_tiep_nhan');           -- chờ → đang xử lý lại
  d := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_khong_xu_ly_duoc', 'Thiếu vật tư — chờ mua bổ sung'); -- → không xử lý được
  e := pg_temp.tt('ipcbfs@gmail.com',  v_sc, 'ipc_bao_co_dien');            -- IPC leo thang lại → Đã báo Cơ điện
  v_dat := pg_temp.ok(a) AND pg_temp.ok(b) AND pg_temp.ok(c) AND pg_temp.ok(d) AND pg_temp.ok(e)
       AND pg_temp.tt_now(v_sc)='DA_BAO_CO_DIEN' AND NOT pg_temp.dong_chua(v_sc);
  PERFORM pg_temp.ghi('KICH_BAN','S2 · Nhánh chờ / không xử lý được / leo thang lại', v_dat,
    format('cuối=%s (kỳ vọng DA_BAO_CO_DIEN) · bước ok=[%s%s%s%s%s]',
      pg_temp.tt_now(v_sc), a->>'ok',b->>'ok',c->>'ok',d->>'ok',e->>'ok'),
    'Các cạnh vệ tinh Cơ điện + ipc_bao_co_dien từ CO_DIEN_KHONG_XU_LY_DUOC (bảng luật)');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S2 · Nhánh chờ / không xử lý được / leo thang lại', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S3 — GUARD VAI TRÒ: bộ phận SAI không bấm được nút của bộ phận khác
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc bigint; r_ipc jsonb; r_lot jsonb; r_mep jsonb; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','KTS3.R1','AHU-KTS3','DA_BAO_CO_DIEN');
  r_ipc := pg_temp.tt('ipcbfs@gmail.com',  v_sc, 'mep_tiep_nhan');          -- IPC bấm nút Cơ điện → phải CHẶN
  r_lot := pg_temp.tt('tructest@gmail.com', v_sc, 'mep_xu_ly_xong');        -- Trực bấm nút Cơ điện → phải CHẶN
  r_mep := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_tiep_nhan');       -- Cơ điện bấm nút mình → phải OK
  v_dat := (NOT pg_temp.ok(r_ipc)) AND (NOT pg_temp.ok(r_lot)) AND pg_temp.ok(r_mep);
  PERFORM pg_temp.ghi('KICH_BAN','S3 · Guard vai trò (bộ phận sai bị chặn)', v_dat,
    format('IPC→nút CơĐiện: %s(%s) · LOT→nút CơĐiện: %s(%s) · CơĐiện→nút mình: %s',
      r_ipc->>'ok', r_ipc->>'loi', r_lot->>'ok', r_lot->>'loi', r_mep->>'ok'),
    'rpc_thao_tac_su_co: không có luật (hanh_dong,vai_tro) ⇒ KHONG_DUOC_PHEP');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S3 · Guard vai trò (bộ phận sai bị chặn)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S4 — GUARD TRẠNG THÁI: nút đúng vai nhưng SAI trạng thái hiện tại → chặn
--   (mep_xu_ly_xong chỉ hợp lệ từ CO_DIEN_DANG_XU_LY, KHÔNG từ DA_BAO_CO_DIEN)
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc bigint; r jsonb; v_dat boolean; v_tt_truoc text;
BEGIN
  v_sc := pg_temp.tao_sc('C1','KTS4.R1','AHU-KTS4','DA_BAO_CO_DIEN');
  v_tt_truoc := pg_temp.tt_now(v_sc);
  r := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_xu_ly_xong');   -- nhảy cóc bỏ bước "đang xử lý" → phải CHẶN
  v_dat := (NOT pg_temp.ok(r)) AND pg_temp.tt_now(v_sc)=v_tt_truoc AND NOT pg_temp.dong_chua(v_sc);
  PERFORM pg_temp.ghi('KICH_BAN','S4 · Guard trạng thái (không cho nhảy cóc bước)', v_dat,
    format('mep_xu_ly_xong tại %s: ok=%s loi=%s · trạng thái giữ nguyên=%s',
      v_tt_truoc, r->>'ok', r->>'loi', (pg_temp.tt_now(v_sc)=v_tt_truoc)),
    'Nếu bấm được: rpc thiếu kiểm current=trang_thai_truoc của luật ⇒ cho nhảy cóc — SỬA guard');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S4 · Guard trạng thái (không cho nhảy cóc bước)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S5 — BẮT BUỘC LÝ DO: nút có bat_buoc_ly_do phải từ chối khi thiếu lý do
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc bigint; r_thieu jsonb; r_du jsonb; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','KTS5.R1','AHU-KTS5','CO_DIEN_DANG_XU_LY');
  r_thieu := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_khong_xu_ly_duoc', NULL);                 -- thiếu lý do → THIEU_LY_DO
  r_du    := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_khong_xu_ly_duoc', 'Hỏng van, chờ vật tư'); -- có lý do → OK
  v_dat := (NOT pg_temp.ok(r_thieu)) AND (r_thieu->>'loi')='THIEU_LY_DO' AND pg_temp.ok(r_du);
  PERFORM pg_temp.ghi('KICH_BAN','S5 · Bắt buộc lý do (mep_khong_xu_ly_duoc)', v_dat,
    format('thiếu lý do: ok=%s loi=%s · có lý do: ok=%s', r_thieu->>'ok', r_thieu->>'loi', r_du->>'ok'),
    'rpc_thao_tac_su_co: bat_buoc_ly_do ⇒ THIEU_LY_DO khi btrim(p_ly_do)=''''');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S5 · Bắt buộc lý do (mep_khong_xu_ly_duoc)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S6 — ap_dung_khi: không mở-lại sự cố ĐANG MỞ; không thao-tác-MO trên sự cố ĐÓNG
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc_mo bigint; v_sc_dong bigint; r_molai jsonb; r_mep jsonb; v_dat boolean;
BEGIN
  v_sc_mo := pg_temp.tao_sc('C1','KTS6.R1','AHU-KTS6','DA_BAO_CO_DIEN');           -- đang mở
  r_molai := pg_temp.tt('khoado.qa@cpc1hn.vn', v_sc_mo, 'qa_mo_lai', 'thử mở lại khi đang mở'); -- ap_dung_khi=DONG → chặn
  v_sc_dong := pg_temp.tao_sc('C1','KTS6.R2','AHU-KTS6b','DA_KHAC_PHUC');
  UPDATE public.su_co SET thoi_gian_dong=now() WHERE ma_su_co=v_sc_dong;           -- ép đã đóng
  r_mep := pg_temp.tt('chanbonght@gmail.com', v_sc_dong, 'mep_tiep_nhan');         -- ap_dung_khi=MO trên sự cố đóng → chặn
  v_dat := (NOT pg_temp.ok(r_molai)) AND (NOT pg_temp.ok(r_mep));
  PERFORM pg_temp.ghi('KICH_BAN','S6 · ap_dung_khi (mở-lại chỉ khi ĐÓNG, thao tác thường chỉ khi MỞ)', v_dat,
    format('qa_mo_lai trên sự cố MỞ: ok=%s loi=%s · mep_tiep_nhan trên sự cố ĐÓNG: ok=%s loi=%s',
      r_molai->>'ok', r_molai->>'loi', r_mep->>'ok', r_mep->>'loi'),
    'rpc_thao_tac_su_co: so khớp COALESCE(ap_dung_khi,''MO'') với thoi_gian_dong IS NULL');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S6 · ap_dung_khi (mở-lại chỉ khi ĐÓNG, thao tác thường chỉ khi MỞ)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S7 — PHÂN QUYỀN KHU TRÊN THAO TÁC: IPC chỉ-Q2 KHÔNG được thao tác sự cố C1
--   (kiểm xem guard có chặn theo khu — không chỉ theo vai trò)
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc_c1 bigint; v_sc_q2 bigint; r_ngoai jsonb; r_trong jsonb; v_dat boolean;
BEGIN
  v_sc_c1 := pg_temp.tao_sc('C1','KTS7.C1','AHU-KTS7a','CHUA_XU_LY');
  v_sc_q2 := pg_temp.tao_sc('Q2','KTS7.Q2','AHU-KTS7b','CHUA_XU_LY');
  r_ngoai := pg_temp.tt('hoavu.qc@cpc1hn.vn', v_sc_c1, 'ipc_bao_co_dien');   -- IPC Q2 thao tác sự cố C1 → PHẢI CHẶN
  r_trong := pg_temp.tt('hoavu.qc@cpc1hn.vn', v_sc_q2, 'ipc_bao_co_dien');   -- IPC Q2 thao tác sự cố Q2 → OK
  v_dat := (NOT pg_temp.ok(r_ngoai)) AND pg_temp.ok(r_trong);
  PERFORM pg_temp.ghi('KICH_BAN','S7 · Phân quyền KHU trên thao tác (IPC Q2 chặn ở C1)', v_dat,
    format('IPC-Q2 → sự cố C1: ok=%s loi=%s (kỳ vọng bị chặn) · → sự cố Q2: ok=%s',
      r_ngoai->>'ok', r_ngoai->>'loi', r_trong->>'ok'),
    'NẾU bấm được sự cố C1: rpc_thao_tac_su_co CHƯA kiểm khu_duoc_xem() — chỉ chặn vai trò. Thêm guard khu (SECURITY DEFINER bỏ qua RLS).');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S7 · Phân quyền KHU trên thao tác (IPC Q2 chặn ở C1)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S8 — TRỰC HSL __GIU__ (ghi chú, KHÔNG đổi trạng thái) + QA đóng có lý do
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc bigint; r_lot jsonb; r_qa jsonb; v_tt_truoc text; v_dat boolean; v_audit_lot int;
BEGIN
  v_sc := pg_temp.tao_sc('C1','KTS8.R1','AHU-KTS8','CO_DIEN_DANG_XU_LY');
  v_tt_truoc := pg_temp.tt_now(v_sc);
  r_lot := pg_temp.tt('tructest@gmail.com', v_sc, 'lot_nhac_co_dien');   -- Trực nhắc Cơ điện → GIỮ trạng thái
  SELECT count(*) INTO v_audit_lot FROM public.lich_su_su_co WHERE ma_su_co=v_sc AND hanh_dong='lot_nhac_co_dien';
  r_qa := pg_temp.tt('khoado.qa@cpc1hn.vn', v_sc, 'qa_da_khac_phuc', 'QA xác nhận đã khắc phục sau kiểm tra');
  -- LOT ok & giữ trạng thái & có audit; QA ok & đóng
  v_dat := pg_temp.ok(r_lot) AND (v_audit_lot=1)
       AND pg_temp.ok(r_qa) AND pg_temp.tt_now(v_sc)='DA_KHAC_PHUC' AND pg_temp.dong_chua(v_sc);
  PERFORM pg_temp.ghi('KICH_BAN','S8 · Trực HSL giữ trạng thái + QA đóng có lý do', v_dat,
    format('LOT nhắc: ok=%s (audit=%s) giữ %s · QA đóng: ok=%s → %s đóng=%s',
      r_lot->>'ok', v_audit_lot, v_tt_truoc, r_qa->>'ok', pg_temp.tt_now(v_sc), pg_temp.dong_chua(v_sc)),
    'Luật LOT là __GIU__ (giu_trang_thai) — ghi lich_su nhưng không đổi trang_thai_hien_tai');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S8 · Trực HSL giữ trạng thái + QA đóng có lý do', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S9 — CỤM ↔ HÀNG CHỜ QA: đóng kỹ thuật KHÔNG được đá cụm khỏi hàng QA (#4)
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc bigint; v_cum bigint; v_con_trong_view_truoc boolean; v_con_sau_dong boolean; v_da_qa_sau boolean; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','KTS9.R1','AHU-KTS9','CO_DIEN_DANG_XU_LY');
  SELECT ma_cum INTO v_cum FROM public.su_co WHERE ma_su_co=v_sc;
  -- Cơ điện khắc phục → sự cố đóng → cụm tự đóng (nếu là sự cố cuối)
  PERFORM pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_xu_ly_xong');
  -- Cụm ĐÓNG kỹ thuật nhưng CHƯA có kết luận QA → PHẢI còn trong view (loader web đọc .or dang_mo OR chưa-QA)
  SELECT EXISTS(SELECT 1 FROM public.xem_cum_su_co WHERE ma_cum=v_cum AND (dang_mo OR NOT da_co_ket_luan_qa))
    INTO v_con_sau_dong;
  -- QA kết luận cụm → rời hàng chờ
  PERFORM set_config('request.jwt.claims', json_build_object('role','authenticated','email','khoado.qa@cpc1hn.vn')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.rpc_ket_luan_cum(v_cum, 'Điều tra: chênh áp thoáng qua do cửa mở', 'Chỉnh van tay AHU và hiệu chuẩn lại cảm biến', 'Bảo trì định kỳ, đưa vào checklist ca');
  EXECUTE 'RESET ROLE';
  SELECT da_co_ket_luan_qa INTO v_da_qa_sau FROM public.xem_cum_su_co WHERE ma_cum=v_cum;
  v_dat := v_con_sau_dong AND COALESCE(v_da_qa_sau,false);
  PERFORM pg_temp.ghi('KICH_BAN','S9 · Cụm đóng-kỹ-thuật vẫn ở hàng QA tới khi có kết luận (#4)', v_dat,
    format('sau đóng kỹ thuật còn trong hàng QA=%s · sau QA kết luận da_co_ket_luan_qa=%s',
      v_con_sau_dong, v_da_qa_sau),
    'View xem_cum_su_co + loader layCumSuCo .or(dang_mo.eq.true,da_co_ket_luan_qa.eq.false); rpc_ket_luan_cum ghi qa_ket_luan');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S9 · Cụm đóng-kỹ-thuật vẫn ở hàng QA tới khi có kết luận (#4)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- S10 — DẤU VẾT AUDIT: mỗi thao tác một dòng đúng người/vai + chuỗi hash liền mạch
-- ══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE v_sc bigint; v_dat boolean; v_vai text; v_email text; r jsonb; v_hash jsonb;
BEGIN
  v_sc := pg_temp.tao_sc('C1','KTS10.R1','AHU-KTS10','CHUA_XU_LY');
  PERFORM pg_temp.tt('ipcbfs@gmail.com', v_sc, 'ipc_bao_co_dien');
  -- dòng audit của bước IPC phải mang đúng vai IPC + đúng email người bấm
  SELECT vai_tro, nguoi_thao_tac INTO v_vai, v_email FROM public.lich_su_su_co
    WHERE ma_su_co=v_sc AND hanh_dong='ipc_bao_co_dien' ORDER BY thoi_diem DESC LIMIT 1;
  v_hash := public.rpc_kiem_chuoi_hash_audit();
  v_dat := (v_vai='IPC') AND (v_email LIKE '%ipcbfs%') AND ((v_hash->>'ok')='true');
  PERFORM pg_temp.ghi('KICH_BAN','S10 · Audit ghi đúng người/vai + chuỗi hash liền mạch', v_dat,
    format('dòng audit: vai=%s người=%s · hash chain ok=%s (%s)',
      v_vai, v_email, v_hash->>'ok', v_hash->>'thong_bao'),
    'rpc_thao_tac_su_co INSERT lich_su_su_co(nguoi_thao_tac,vai_tro,...); trigger tg_lich_su_hash nối chuỗi');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','S10 · Audit ghi đúng người/vai + chuỗi hash liền mạch', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- ══════════════════════════════════════════════════════════════════════════
-- GÓC ĐỘ KHÁC (T1–T5): mặt trận vận hành ngoài luồng bộ phận thuần
-- ══════════════════════════════════════════════════════════════════════════

-- T1 — VÉ EMAIL (token nút bấm): hợp lệ→ok · dùng lại→chặn · hết hạn→chặn
DO $$
DECLARE v_sc bigint; v_sc2 bigint; r_ok jsonb; r_lai jsonb; r_hh jsonb; v_dat boolean;
  v_tok text := 'KTMAIL-'||md5(random()::text); v_tok2 text := 'KTMAIL2-'||md5(random()::text);
BEGIN
  v_sc := pg_temp.tao_sc('C1','x','AHU-KTT1','DA_BAO_CO_DIEN');
  INSERT INTO public.ma_token_email(token_hash,thuoc_thu_nghiem,ma_su_co,hanh_dong,vai_tro_can,tao_luc,het_han_luc,nguon)
    VALUES(encode(extensions.digest(v_tok,'sha256'),'hex'),false,v_sc,'mep_tiep_nhan','MEP',now(),now()+interval '2 hour','KIEMTHU');
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","email":"chanbonght@gmail.com"}',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r_ok  := public.rpc_thao_tac_su_co(p_token=>v_tok, p_nguon=>'email');   -- vé hợp lệ
  r_lai := public.rpc_thao_tac_su_co(p_token=>v_tok, p_nguon=>'email');   -- dùng LẠI → TOKEN_DA_DUNG
  EXECUTE 'RESET ROLE';
  v_sc2 := pg_temp.tao_sc('C1','x','AHU-KTT1b','DA_BAO_CO_DIEN');
  INSERT INTO public.ma_token_email(token_hash,thuoc_thu_nghiem,ma_su_co,hanh_dong,vai_tro_can,tao_luc,het_han_luc,nguon)
    VALUES(encode(extensions.digest(v_tok2,'sha256'),'hex'),false,v_sc2,'mep_tiep_nhan','MEP',now()-interval '3 hour',now()-interval '1 hour','KIEMTHU');
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","email":"chanbonght@gmail.com"}',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r_hh := public.rpc_thao_tac_su_co(p_token=>v_tok2, p_nguon=>'email');   -- HẾT HẠN → TOKEN_HET_HAN
  EXECUTE 'RESET ROLE';
  v_dat := pg_temp.ok(r_ok) AND (r_lai->>'loi')='TOKEN_DA_DUNG' AND (r_hh->>'loi')='TOKEN_HET_HAN';
  PERFORM pg_temp.ghi('KICH_BAN','T1 · Vé email: hợp lệ→ok · dùng lại→chặn · hết hạn→chặn', v_dat,
    format('hợp lệ ok=%s · dùng lại loi=%s · hết hạn loi=%s', r_ok->>'ok', r_lai->>'loi', r_hh->>'loi'),
    'rpc nhánh token: da_dung_luc ⇒ TOKEN_DA_DUNG (chống chuyển tiếp mail 2 lần); het_han_luc ⇒ TOKEN_HET_HAN');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','T1 · Vé email: hợp lệ→ok · dùng lại→chặn · hết hạn→chặn', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- T2 — DOUBLE-CLICK / lặp thao tác: bấm 2 lần chỉ tác dụng MỘT lần (không nhân đôi audit)
DO $$
DECLARE v_sc bigint; r1 jsonb; r2 jsonb; v_audit int; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','x','AHU-KTT2','DA_BAO_CO_DIEN');
  r1 := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_tiep_nhan');   -- lần 1
  r2 := pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_tiep_nhan');   -- lần 2 (state đã đổi)
  SELECT count(*) INTO v_audit FROM public.lich_su_su_co WHERE ma_su_co=v_sc AND hanh_dong='mep_tiep_nhan';
  v_dat := pg_temp.ok(r1) AND (NOT pg_temp.ok(r2)) AND v_audit=1 AND pg_temp.tt_now(v_sc)='CO_DIEN_DANG_XU_LY';
  PERFORM pg_temp.ghi('KICH_BAN','T2 · Double-click chỉ tác dụng 1 lần (không nhân đôi)', v_dat,
    format('lần1 ok=%s · lần2 ok=%s loi=%s · số dòng audit=%s (kỳ vọng 1)',
      r1->>'ok', r2->>'ok', r2->>'loi', v_audit),
    'Guard trạng thái: sau lần1 state=DANG_XU_LY, mep_tiep_nhan không còn hợp lệ ⇒ chặn, không ghi audit thừa');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','T2 · Double-click chỉ tác dụng 1 lần (không nhân đôi)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- T3 — TẠM DỪNG CẢNH BÁO (chốt an toàn): Trực không im được CRITICAL/P1 · trần 4h · lý do ≥10
DO $$
DECLARE v_sc bigint; r_lot jsonb; r_ngan jsonb; r_qa jsonb; v_den timestamptz; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','x','AHU-KTT3','CO_DIEN_DANG_XU_LY','P1');   -- CRITICAL + P1
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","email":"tructest@gmail.com"}',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r_lot := public.rpc_tam_dung_canh_bao(v_sc, 60, 'Chờ ca sau xử lý tiếp');   -- Trực im CRITICAL/P1 → CHẶN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","email":"khoado.qa@cpc1hn.vn"}',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  r_ngan := public.rpc_tam_dung_canh_bao(v_sc, 60, 'ngắn');                 -- lý do <10 → THIEU_LY_DO
  r_qa   := public.rpc_tam_dung_canh_bao(v_sc, 999, 'Chờ vật tư thay van, đã đặt mua và báo QA'); -- 999' → trần 240'
  EXECUTE 'RESET ROLE';
  SELECT tam_dung_den INTO v_den FROM public.su_co WHERE ma_su_co=v_sc;
  v_dat := (r_lot->>'loi')='KHONG_CO_QUYEN' AND (r_ngan->>'loi')='THIEU_LY_DO'
       AND pg_temp.ok(r_qa) AND v_den IS NOT NULL AND v_den <= now()+interval '241 minutes';
  PERFORM pg_temp.ghi('KICH_BAN','T3 · Tạm dừng cảnh báo: chốt quyền + trần 4h + lý do', v_dat,
    format('Trực im CRITICAL/P1: %s · lý do ngắn: %s · QA im 999'': ok=%s hoãn tới %s (≤ now+240'')',
      r_lot->>'loi', r_ngan->>'loi', r_qa->>'ok', to_char(v_den,'HH24:MI')),
    'rpc_tam_dung_canh_bao: CRITICAL/P1 chỉ QA/ADMIN; v_phut=LEAST(240,...); lý do ≥10');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','T3 · Tạm dừng cảnh báo: chốt quyền + trần 4h + lý do', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- T4 — MỞ LẠI toàn vẹn: đóng→mở lại xoá dấu đóng + xoá tạm dừng + cụm sống lại + lại vào hàng trách nhiệm
DO $$
DECLARE v_sc bigint; v_cum bigint; r_dong jsonb; r_ml jsonb; v_dat boolean;
  v_cum_mo boolean; v_trong_qh boolean; v_tam timestamptz;
BEGIN
  v_sc := pg_temp.tao_sc('C1','x','AHU-KTT4','CO_DIEN_DANG_XU_LY');
  SELECT ma_cum INTO v_cum FROM public.su_co WHERE ma_su_co=v_sc;
  -- tạm dừng trước (QA), rồi đóng, rồi mở lại → mở lại phải xoá tam_dung_den
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","email":"khoado.qa@cpc1hn.vn"}',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM public.rpc_tam_dung_canh_bao(v_sc, 120, 'Tạm hoãn trong lúc chờ vật tư thay thế');
  EXECUTE 'RESET ROLE';
  r_dong := pg_temp.tt('khoado.qa@cpc1hn.vn', v_sc, 'qa_da_khac_phuc', 'QA xác nhận đã khắc phục hiện trường');
  r_ml   := pg_temp.tt('khoado.qa@cpc1hn.vn', v_sc, 'qa_mo_lai', 'Tái phát ngay sau đó, mở lại điều tra');
  SELECT thoi_gian_dong IS NULL INTO v_cum_mo FROM public.cum_su_co WHERE ma_cum=v_cum;
  SELECT tam_dung_den INTO v_tam FROM public.su_co WHERE ma_su_co=v_sc;
  SELECT EXISTS(SELECT 1 FROM public.xem_su_co_qua_han WHERE ma_su_co=v_sc) INTO v_trong_qh;
  v_dat := pg_temp.ok(r_dong) AND pg_temp.ok(r_ml)
       AND pg_temp.tt_now(v_sc)='MO_LAI' AND NOT pg_temp.dong_chua(v_sc)
       AND v_tam IS NULL AND v_cum_mo AND v_trong_qh;
  PERFORM pg_temp.ghi('KICH_BAN','T4 · Mở lại: sống lại đầy đủ (dấu đóng + tạm dừng + cụm + trách nhiệm)', v_dat,
    format('mở lại ok=%s → %s (đóng=%s) · tam_dung_den=%s (kỳ vọng NULL) · cụm mở lại=%s · lại vào hàng quá hạn=%s',
      r_ml->>'ok', pg_temp.tt_now(v_sc), pg_temp.dong_chua(v_sc), v_tam, v_cum_mo, v_trong_qh),
    'rpc_thao_tac_su_co nhánh mo_lai: thoi_gian_dong=NULL, tam_dung_den=NULL, lan_nhac_cuoi=NULL; tg_cum_tu_dong mở lại cụm');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','T4 · Mở lại: sống lại đầy đủ (dấu đóng + tạm dừng + cụm + trách nhiệm)', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- T5 — SLA QUÁ HẠN: sự cố P1 quá SLA tiếp nhận hiện cờ quá hạn; sau khi tiếp nhận → hết cờ
DO $$
DECLARE v_sc bigint; v_qh_truoc boolean; v_qh_sau boolean; v_ack timestamptz; v_dat boolean;
BEGIN
  v_sc := pg_temp.tao_sc('C1','x','AHU-KTT5','CHUA_XU_LY','P1');   -- thoi_gian_mo = now-90' > SLA ack 30'
  SELECT qua_han_tiep_nhan INTO v_qh_truoc FROM public.xem_su_co_qua_han WHERE ma_su_co=v_sc;
  -- Cơ điện tiếp nhận (qua IPC báo trước) → trigger tg_su_co_ack set ack_luc
  PERFORM pg_temp.tt('ipcbfs@gmail.com', v_sc, 'ipc_bao_co_dien');
  PERFORM pg_temp.tt('chanbonght@gmail.com', v_sc, 'mep_tiep_nhan');
  SELECT ack_luc INTO v_ack FROM public.su_co WHERE ma_su_co=v_sc;
  SELECT qua_han_tiep_nhan INTO v_qh_sau FROM public.xem_su_co_qua_han WHERE ma_su_co=v_sc;
  v_dat := (v_qh_truoc IS TRUE) AND (v_ack IS NOT NULL) AND (v_qh_sau IS NOT TRUE);
  PERFORM pg_temp.ghi('KICH_BAN','T5 · SLA quá hạn tiếp nhận: hiện cờ rồi tự hết khi tiếp nhận', v_dat,
    format('trước tiếp nhận quá_hạn=%s · ack_luc sau=%s · sau tiếp nhận quá_hạn=%s',
      v_qh_truoc, (v_ack IS NOT NULL), v_qh_sau),
    'xem_su_co_qua_han: ack_luc IS NULL AND now()>ack_han; trigger tg_su_co_ack set ack_luc khi bộ phận tiếp nhận');
EXCEPTION WHEN OTHERS THEN PERFORM pg_temp.ghi('KICH_BAN','T5 · SLA quá hạn tiếp nhận: hiện cờ rồi tự hết khi tiếp nhận', false, 'NỔ: '||SQLERRM, 'đọc lỗi'); END $$;

-- =============================================================================
-- BÁO CÁO
-- =============================================================================
SELECT CASE WHEN dat THEN '✅' ELSE '❌' END||' '||rpad(nhom,9)||' '||ten AS ket_qua,
       chan_doan, CASE WHEN dat THEN '' ELSE coalesce(goi_y,'') END AS xu_ly
  FROM kq_kiem ORDER BY dat, stt;
SELECT format('TỔNG QUY TRÌNH SỰ CỐ: %s/%s đạt · %s VỠ',
       count(*) FILTER (WHERE dat), count(*), count(*) FILTER (WHERE NOT dat)) AS tong_ket FROM kq_kiem;
SELECT 'KQ_MAY_DOC:'||count(*) FILTER (WHERE NOT dat) AS may_doc FROM kq_kiem;

ROLLBACK;
