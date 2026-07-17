-- =============================================================================
-- BỘ KIỂM HỆ THỐNG BMS — bất biến + kịch bản, chạy lại được bất kỳ lúc nào
--
-- Phương pháp (theo pgTAP + property-based/invariant testing):
--   LỚP 1 — BẤT BIẾN  : điều PHẢI luôn đúng trên dữ liệu live. Vỡ = có bug.
--   LỚP 2 — KỊCH BẢN  : diễn lại các đường đi của máy trạng thái trong
--                        subtransaction, TỰ ROLLBACK — không chạm dữ liệu thật.
--
-- Mỗi kiểm mang theo CHẨN ĐOÁN (đo được gì) và GỢI Ý XỬ LÝ (sửa ở đâu).
-- Nguồn gốc từng kiểm = một bug THẬT đã xảy ra (ghi số (NN) theo HANDOFF).
--
-- AN TOÀN: toàn bộ file nằm trong MỘT giao dịch, kết thúc bằng ROLLBACK.
--   Không bao giờ COMMIT (bài học bản ghi 3407: audit trail append-only,
--   ghi nhầm là phải đính chính theo thủ tục GMP, không xoá được).
--
-- CHẠY: kiem_tra/chay.sh  (bơm thêm 2 biến từ mã web: RPCS, PHIEN_BAN_WEB)
-- =============================================================================

BEGIN;

CREATE TEMP TABLE kq_kiem(
  stt      serial,
  nhom     text,      -- BAT_BIEN | KICH_BAN
  ten      text,
  dat      boolean,
  chan_doan text,     -- đo được gì (bước CHẨN ĐOÁN)
  goi_y    text       -- sửa ở đâu (bước XỬ LÝ)
);

CREATE FUNCTION pg_temp.ghi(p_nhom text, p_ten text, p_dat boolean,
                            p_chan_doan text DEFAULT NULL, p_goi_y text DEFAULT NULL)
RETURNS void LANGUAGE sql AS
$$ INSERT INTO kq_kiem(nhom, ten, dat, chan_doan, goi_y)
   VALUES (p_nhom, p_ten, p_dat, p_chan_doan, p_goi_y) $$;

-- =============================================================================
-- LỚP 1 — BẤT BIẾN (phát hiện + chẩn đoán trên dữ liệu live, chỉ đọc)
-- =============================================================================
DO $khoi$
DECLARE n int; n2 int; v text;
BEGIN
  -- B1 (73/77): sự cố ĐANG MỞ phải thuộc một cụm — không có sự cố mồ côi
  SELECT count(*) INTO n FROM public.su_co WHERE thoi_gian_dong IS NULL AND ma_cum IS NULL;
  PERFORM pg_temp.ghi('BAT_BIEN','Sự cố mở nào cũng có cụm', n=0,
    n||' sự cố mở không có ma_cum',
    'SELECT public.gan_cum_su_co(ma_su_co) cho từng cái; truy vì sao trigger trg_su_co_gan_cum không chạy');

  -- B2 (76): cụm mở ⇔ còn sự cố mở; cụm đóng ⇔ hết sự cố mở
  SELECT count(*) INTO n FROM public.cum_su_co c
   WHERE c.thoi_gian_dong IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.su_co s WHERE s.ma_cum=c.ma_cum AND s.thoi_gian_dong IS NULL);
  SELECT count(*) INTO n2 FROM public.cum_su_co c
   WHERE c.thoi_gian_dong IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.su_co s WHERE s.ma_cum=c.ma_cum AND s.thoi_gian_dong IS NULL);
  PERFORM pg_temp.ghi('BAT_BIEN','Vòng đời cụm khớp vòng đời sự cố', n=0 AND n2=0,
    n||' cụm mở rỗng · '||n2||' cụm đóng còn sự cố mở',
    'Xem tg_cum_tu_dong (20260710an/ao); đóng/mở lại cụm bằng tay theo đúng thực trạng');

  -- B3: mỗi khoá chỉ MỘT cụm đang mở (ux_cum_su_co_mo phải giữ được)
  SELECT count(*) INTO n FROM (
    SELECT khoa_cum FROM public.cum_su_co WHERE thoi_gian_dong IS NULL
    GROUP BY thuoc_thu_nghiem, khoa_cum HAVING count(*)>1) x;
  PERFORM pg_temp.ghi('BAT_BIEN','Không hai cụm mở cùng khoá', n=0,
    n||' khoá có nhiều cụm mở', 'Dữ liệu đã hỏng qua đường vòng — truy nguồn ghi, gộp cụm bằng tay');

  -- B4: trạng thái sự cố khớp cờ đóng/mở
  SELECT count(*) INTO n FROM public.su_co
   WHERE thoi_gian_dong IS NOT NULL
     AND trang_thai_hien_tai NOT IN ('DA_DONG','DA_KHAC_PHUC','DONG_TU_DONG','DONG_NGOAI_PHAM_VI','IPC_BINH_THUONG');
  SELECT count(*) INTO n2 FROM public.su_co
   WHERE thoi_gian_dong IS NULL
     AND trang_thai_hien_tai IN ('DA_DONG','DA_KHAC_PHUC','DONG_TU_DONG','DONG_NGOAI_PHAM_VI');
  PERFORM pg_temp.ghi('BAT_BIEN','Trạng thái khớp cờ đóng/mở', n=0 AND n2=0,
    n||' đã đóng mà trạng thái chưa kết thúc · '||n2||' đang mở mà trạng thái kết thúc',
    'rpc_thao_tac_su_co hoặc đường ghi nào đó quên đồng bộ thoi_gian_dong với trạng thái');

  -- B5 (P0-5): công tắc vĩnh viễn đã khai tử
  SELECT count(*) INTO n FROM public.su_co WHERE da_tat_canh_bao;
  PERFORM pg_temp.ghi('BAT_BIEN','Không sự cố nào da_tat_canh_bao=true', n=0,
    n||' dòng vi phạm CHECK', 'CHECK (NOT da_tat_canh_bao) đã bị gỡ? Khôi phục 20260710u');

  -- B6: máy trạng thái — luật kích hoạt trỏ tới trạng thái hợp lệ
  SELECT count(*) INTO n FROM (
    WITH hop_le AS (SELECT unnest(regexp_matches(pg_get_constraintdef(oid),'''([A-Z_]+)''','g')) tt
                      FROM pg_constraint WHERE conrelid='public.su_co'::regclass AND conname LIKE '%trang_thai%')
    SELECT q.hanh_dong FROM public.quy_tac_chuyen_trang_thai q
     WHERE q.kich_hoat AND q.trang_thai_sau IS NOT NULL AND q.trang_thai_sau <> '__GIU__'
       AND q.trang_thai_sau NOT IN (SELECT tt FROM hop_le)) x;
  PERFORM pg_temp.ghi('BAT_BIEN','Luật kích hoạt trỏ tới trạng thái hợp lệ', n=0,
    n||' luật trỏ trạng thái ngoài CHECK', 'Sửa quy_tac_chuyen_trang_thai hoặc nới CHECK có chủ đích');

  -- B7 (bug __GIU__): luật giữ trạng thái phải gắn cờ
  SELECT count(*) INTO n FROM public.quy_tac_chuyen_trang_thai
   WHERE trang_thai_sau='__GIU__' AND NOT giu_trang_thai;
  PERFORM pg_temp.ghi('BAT_BIEN','Luật __GIU__ có cờ giu_trang_thai', n=0,
    n||' luật sẽ ghi chuỗi __GIU__ vào su_co và nổ CHECK', 'UPDATE quy_tac SET giu_trang_thai=true');

  -- B8 (68): khoá cấu hình được code đọc phải TỒN TẠI (không âm thầm dùng default)
  SELECT count(*), string_agg(key,', ') INTO n, v FROM (
    SELECT DISTINCT (regexp_matches(pg_get_functiondef(p.oid),'cfg_(?:int|text|bool)\(''([a-z0-9_]+)''','g'))[1] key
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
    UNION
    SELECT DISTINCT (regexp_matches(pg_get_viewdef(c.oid,true),'cfg_(?:int|text|bool)\(''([a-z0-9_]+)''','g'))[1]
      FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='v') d
   WHERE NOT EXISTS (SELECT 1 FROM public.cau_hinh ch WHERE ch.key=d.key);
  PERFORM pg_temp.ghi('BAT_BIEN','Mọi khoá cfg_* được đọc đều có trong cau_hinh', n=0,
    coalesce('thiếu: '||v,'đủ'), 'INSERT khoá thiếu với đúng giá trị mặc định đang chạy (xem 20260710as)');

  -- B9 (81): hàm DELETE trên bảng có trigger chặn phải bật cờ bypass
  SELECT count(*), string_agg(proname,', ') INTO n, v FROM (
    WITH bang_chan AS (
      SELECT DISTINCT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
       WHERE NOT t.tgisinternal AND (t.tgtype & 8)<>0 AND c.relnamespace='public'::regnamespace)
    SELECT p.proname FROM pg_proc p
     WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
       AND EXISTS (SELECT 1 FROM bang_chan b WHERE pg_get_functiondef(p.oid) ~ ('DELETE FROM public\.'||b.relname||'\M'))
       AND pg_get_functiondef(p.oid) !~ 'set_config\(''app\.tg_bypass_append_only'', ''on''') x;
  PERFORM pg_temp.ghi('BAT_BIEN','Hàm dọn dẹp bật cờ bypass trước khi DELETE', n=0,
    coalesce('sẽ nổ khi có dòng để xoá: '||v,'4/4 hàm đúng'),
    'Chép khuôn rpc_don_dep_du_lieu_qua_han: bật cờ → xoá → TẮT cờ (bug 81 — cron hỏng hẹn giờ)');

  -- B10 (70): khoá idempotency không trùng
  SELECT count(*) INTO n FROM (SELECT idempotency_key FROM public.email_da_gui
    WHERE idempotency_key IS NOT NULL GROUP BY 1 HAVING count(*)>1) x;
  PERFORM pg_temp.ghi('BAT_BIEN','Khoá idempotency email không trùng', n=0,
    n||' khoá trùng', 'Nếu do đổi cách sinh khoá: đổi tên khoá lịch sử như 20260710ag, KHÔNG sửa WF');

  -- B11 (69): DANG_GUI không được mắc kẹt — quá 2 giờ là có chuyện
  SELECT count(*) INTO n FROM public.email_da_gui
   WHERE trang_thai='DANG_GUI' AND tao_luc < now()-interval '2 hour';
  PERFORM pg_temp.ghi('BAT_BIEN','Không email nào kẹt DANG_GUI quá 2 giờ', n=0,
    n||' dòng kẹt (SMTP hỏng hoặc nhánh WF thiếu bước chốt)',
    'rpc_dang_ky_gui_email (20260710af) sẽ tự gửi lại; nếu vẫn kẹt → nhánh WF thiếu node "Ghi nhật ký"');

  -- B12: pg_cron 24 giờ qua không có lần chạy failed
  SELECT count(*), string_agg(DISTINCT j.jobname,', ') INTO n, v
    FROM cron.job j JOIN cron.job_run_details r ON r.jobid=j.jobid
   WHERE r.start_time > now()-interval '24 hour' AND r.status='failed';
  PERFORM pg_temp.ghi('BAT_BIEN','pg_cron 24h không lần nào failed', n=0,
    coalesce(n||' lần failed: '||v, '0 lần'),
    'SELECT * FROM cron.job_run_details WHERE status=''failed'' ORDER BY start_time DESC — đọc return_message');

  -- B13: nhật ký lỗi workflow 24 giờ
  SELECT count(*), string_agg(DISTINCT ten_workflow||':'||loai_loi,', ') INTO n, v
    FROM public.nhat_ky_loi_workflow WHERE thoi_diem > now()-interval '24 hour';
  PERFORM pg_temp.ghi('BAT_BIEN','Không lỗi workflow ghi nhận trong 24h', n=0,
    coalesce(v,'sạch'), 'Đọc mo_ta_loi + du_lieu của từng dòng; CANH_BAO_DINH_TRE = xem lớp lỗi 6 trong sổ tay');

  -- B14 (79 → 13/07 ĐẢO CHIỀU, chính sách chủ hệ thống): cảm biến đứng hình đủ chuỗi
  -- = PHÒNG THIẾU DỮ LIỆU, tách riêng — KHÔNG được còn sự cố mở (ingest 20260713c
  -- tự đóng DONG_NGOAI_PHAM_VI); theo dõi tập trung ở xem_cam_bien_dung_hinh
  -- (tab Cảm biến + thẻ Tổng quan), không phải ở su_co.
  SELECT count(*), string_agg(ma_phong||'/'||loai_cam_bien,', ') INTO n, v FROM (
    SELECT d.ma_phong, d.loai_cam_bien FROM public.xem_cam_bien_dung_hinh d
     WHERE EXISTS (SELECT 1 FROM public.su_co s
                    WHERE s.ma_phong=d.ma_phong AND s.loai_cam_bien=d.loai_cam_bien
                      AND s.thoi_gian_dong IS NULL)) y;
  PERFORM pg_temp.ghi('BAT_BIEN','Đứng hình tách riêng (không còn sự cố mở)', n=0,
    coalesce('còn vé mở: '||v, 'sạch'),
    'Ingest 20260713c phải ĐÓNG vé của cảm biến đứng hình — xem nhánh IF v_bo_qua');

  -- B15 (71): sự cố SUPPRESSED không được lọt vào định tuyến email
  SELECT count(*) INTO n FROM public.xem_dinh_tuyen_email_v14 v14
   WHERE EXISTS (SELECT 1 FROM public.su_co s WHERE s.ma_su_co=v14.ma_su_co
                   AND s.muc_canh_bao_hien_tai='SUPPRESSED');
  PERFORM pg_temp.ghi('BAT_BIEN','SUPPRESSED không bao giờ vào email', n=0,
    n||' dòng lọt', 'View v14 phải lọc muc_canh_bao_hien_tai=''CRITICAL'' — ai đó đã nới nó');

  -- B16: sự cố mở nào cũng nằm trong danh sách phụ trách (im tiếng chuông ≠ xoá trách nhiệm)
  -- 17/07: xem_su_co_qua_han (SLA) đã bỏ → bất biến chuyển sang xem_su_co_phu_trach.
  SELECT count(*) INTO n FROM public.su_co s
   WHERE s.thoi_gian_dong IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.xem_su_co_phu_trach q WHERE q.ma_su_co=s.ma_su_co);
  PERFORM pg_temp.ghi('BAT_BIEN','Mọi sự cố mở đều hiện trong xem_su_co_phu_trach', n=0,
    n||' sự cố mở biến mất khỏi danh sách trách nhiệm',
    'xem_su_co_phu_trach không được lọc theo mức — ai đó thêm WHERE muc_canh_bao?');

  -- B17 (P0-4/2026-07-10u): vé mới phát TTL ≤ 12 giờ
  SELECT count(*) INTO n FROM public.ma_token_email
   WHERE tao_luc > now()-interval '24 hour' AND het_han_luc - tao_luc > interval '12 hours';
  PERFORM pg_temp.ghi('BAT_BIEN','Vé thao tác 24h qua có TTL ≤ 12 giờ', n=0,
    n||' vé sống quá 12h', 'Đường phát vé nào đó quay lại interval ''72 hours'' — xem 20260710af');

  -- B18: WF1 còn sống — bucket mới nhất không quá 2 giờ, đủ 81 cảm biến
  SELECT extract(epoch FROM now()-max(bucket_utc))/3600, count(*) INTO n2, n
    FROM public.du_lieu_gio WHERE bucket_utc=(SELECT max(bucket_utc) FROM public.du_lieu_gio)
   GROUP BY bucket_utc;
  PERFORM pg_temp.ghi('BAT_BIEN','WF1 sống: bucket mới ≤2h và đủ 81 cảm biến', n2<=2 AND n=81,
    'bucket cách đây '||n2||'h · '||n||'/81 cảm biến',
    'Kiểm executions WF1 trên n8n; FMS login; rpc_kiem_tra_suc_khoe_he_thong');

  -- B22 (90): lỗ hổng dữ liệu cục bộ chưa được lấp (phòng lẻ thiếu, KHÔNG phải FMS sập)
  --   Chỉ tính khi giờ đó có phòng khác CÓ dữ liệu (WF1 đã chạy) — loại đợt sập toàn phần.
  SELECT count(*) INTO n FROM public.rpc_lo_hong_du_lieu(3);
  PERFORM pg_temp.ghi('BAT_BIEN','Không lỗ hổng dữ liệu cục bộ chưa lấp (3h qua)', n=0,
    n||' điểm (phòng×cảm biến) thiếu — FMS lỗi một phần lúc thu thập',
    'WF1b (:35) tự lấp KHI FMS HỒI. Nếu vẫn thiếu: kiểm FMS_LOGIN_LOI/FMS_HTTP_LOI trong ngoai_le_du_lieu — lỗ do FMS chết thì phần mềm không cứu được, báo đội FMS.');

  -- B20 (88): chuỗi hash audit phải liền mạch (tamper-evident)
  DECLARE r jsonb;
  BEGIN
    r := public.rpc_kiem_chuoi_hash_audit();
    PERFORM pg_temp.ghi('BAT_BIEN','Chuỗi hash audit liền mạch (không sửa lén)', (r->>'ok')='true',
      r->>'thong_bao', 'Chuỗi đứt = có bản ghi bị sửa/xoá ngoài luồng — điều tra id trong dut_tai_id NGAY');
  END;

  -- B21 (89): không tài khoản VIEWER nào có luật thao tác (chỉ-xem thật)
  SELECT count(*) INTO n FROM public.quy_tac_chuyen_trang_thai WHERE vai_tro='VIEWER' AND kich_hoat;
  PERFORM pg_temp.ghi('BAT_BIEN','VIEWER không có nút thao tác nào', n=0,
    n||' luật gán cho VIEWER', 'VIEWER phải chỉ-xem — xoá mọi luật vai_tro=VIEWER');

  -- B19 (80): công thức đình trệ của WF6 phải đang = 0 (nếu >0 chuông sắp kêu)
  SELECT count(*) INTO n FROM public.su_co s
   WHERE s.thoi_gian_dong IS NULL AND NOT s.da_tat_canh_bao
     AND (s.tam_dung_den IS NULL OR s.tam_dung_den <= now())
     AND public.trong_pham_vi_canh_bao(s.ma_phong, s.muc_uu_tien)
     AND s.muc_canh_bao_hien_tai='CRITICAL' AND s.thuoc_thu_nghiem=public.co_thu_nghiem()
     AND GREATEST(COALESCE(s.lan_nhac_cuoi,s.thao_tac_cuoi_luc,s.thoi_gian_mo),
                  COALESCE(s.tam_dung_den,'-infinity'::timestamptz))
         < now() - make_interval(hours => public.cfg_int('giam_sat_nguong_dinh_tre_gio',2));
  PERFORM pg_temp.ghi('BAT_BIEN','WF6 đếm đình trệ = 0 lúc này', n=0,
    n||' sự cố im lặng >2h — WF6 sẽ báo IT+QA trong ≤30 phút',
    'WF8 có đang chạy không? nhac_dung_sai_phut đủ chưa (bug 80)?');
END $khoi$;

-- =============================================================================
-- LỚP 2 — KỊCH BẢN (diễn lại đường đi, subtransaction TỰ ROLLBACK từng cái)
--   Khuôn: khối trong cùng chạy kịch bản, kết thúc bằng RAISE 'KQ|đạt|chẩn đoán'
--   ⇒ mọi ghi chép của kịch bản bị huỷ, chỉ KẾT QUẢ thoát ra ngoài.
-- =============================================================================
CREATE FUNCTION pg_temp.bom(p_phong text, p_ahu text, p_uu text, p_gio int,
                            p_oos int, p_oos10 int, p_tb numeric, p_dh boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.rpc_xu_ly_du_lieu_phong_hang_gio(jsonb_build_object(
    'bucket_utc', to_char(date_trunc('hour',now())+make_interval(hours=>p_gio),'YYYY-MM-DD"T"HH24:00:00+00'),
    'thuoc_thu_nghiem',false,'ma_phong',p_phong,'ten_phong','kịch bản','khu_vuc',split_part(p_phong,'.',1),
    'ahu',p_ahu,'muc_uu_tien',p_uu,'cap_phong_sach','C',
    'cam_bien', jsonb_build_array(jsonb_build_object(
      'loai_cam_bien','DP','loai_canh_bao','OOS_DP','don_vi','Pa','gioi_han_duoi',10,'gioi_han_tren',20,
      'tong_diem',60,'diem_hop_le',60,'diem_thieu',0,'chat_luong_du_lieu_pct',100,
      'gia_tri_tb',p_tb,'gia_tri_min',CASE WHEN p_dh THEN p_tb ELSE p_tb-0.4 END,
      'gia_tri_max',CASE WHEN p_dh THEN p_tb ELSE p_tb+0.4 END,
      'diem_oos',p_oos,'diem_oos_thap',p_oos,'diem_oos_cao',0,'oos_10phut_cuoi',p_oos10,
      'muc_canh_bao','CRITICAL','chan_doan','{}'::jsonb))));
END $$;

-- ── K1 (bug 46 gốc): 2 giờ sạch → tự đóng; 1 giờ sạch chưa đóng ─────────────
DO $kb$
DECLARE v_dat boolean; v_cd text;
BEGIN
  BEGIN
    PERFORM set_config('app.tg_bypass_append_only','on',true);
    UPDATE public.su_co SET thoi_gian_dong=now() WHERE ma_phong='C1.R12' AND loai_cam_bien='DP' AND thoi_gian_dong IS NULL;
    PERFORM set_config('app.tg_bypass_append_only','off',true);
    PERFORM pg_temp.bom('C1.R12','AHU03','P1',1,55,9,8,false);       -- mở
    PERFORM pg_temp.bom('C1.R12','AHU03','P1',2,0,0,15,false);       -- sạch 1
    v_dat := (SELECT so_gio_sach_lien_tiep=1 AND thoi_gian_dong IS NULL
                FROM public.su_co WHERE ma_phong='C1.R12' AND loai_cam_bien='DP' AND thoi_gian_dong IS NULL);
    PERFORM pg_temp.bom('C1.R12','AHU03','P1',3,0,0,15,false);       -- sạch 2 → đóng
    v_dat := v_dat AND EXISTS (SELECT 1 FROM public.su_co
               WHERE ma_phong='C1.R12' AND loai_cam_bien='DP'
                 AND trang_thai_hien_tai='DONG_TU_DONG' AND thoi_gian_dong IS NOT NULL);
    RAISE EXCEPTION 'KQ|%|sạch 1 giờ chưa đóng, đủ 2 giờ mới đóng', coalesce(v_dat,false);
  EXCEPTION WHEN OTHERS THEN
    v_cd := SQLERRM;
    IF v_cd LIKE 'KQ|%' THEN
      PERFORM pg_temp.ghi('KICH_BAN','Tự đóng đúng luật 2 giờ sạch', (split_part(v_cd,'|',2) IN ('t','true')), split_part(v_cd,'|',3),
        'rpc_xu_ly_du_lieu_phong_hang_gio, nhánh giờ SẠCH + nguong_gio_sach_de_dong');
    ELSE
      PERFORM pg_temp.ghi('KICH_BAN','Tự đóng đúng luật 2 giờ sạch', false, 'NỔ: '||v_cd, 'đọc lỗi');
    END IF;
  END;
END $kb$;

-- ── K2 (bug 55): tái phát kế thừa đồng hồ, WF6 không báo giả ────────────────
DO $kb$
DECLARE v_dat boolean; v_cd text; v_n int;
BEGIN
  BEGIN
    PERFORM set_config('app.tg_bypass_append_only','on',true);
    UPDATE public.su_co SET thoi_gian_dong=now() WHERE ma_phong='C1.R12' AND loai_cam_bien='DP' AND thoi_gian_dong IS NULL;
    PERFORM set_config('app.tg_bypass_append_only','off',true);
    PERFORM pg_temp.bom('C1.R12','AHU03','P1',4,55,9,8,false);   -- vi phạm lại → tái phát
    SELECT count(*) INTO v_n FROM public.su_co s
     WHERE s.ma_phong='C1.R12' AND s.loai_cam_bien='DP' AND s.thoi_gian_dong IS NULL
       AND s.so_lan_tai_phat >= 1 AND s.lan_nhac_cuoi IS NOT NULL;
    v_dat := (v_n = 1);
    RAISE EXCEPTION 'KQ|%|tái phát=%, lan_nhac_cuoi kế thừa (không NULL)', coalesce(v_dat,false), v_n;
  EXCEPTION WHEN OTHERS THEN
    v_cd := SQLERRM;
    IF v_cd LIKE 'KQ|%' THEN
      PERFORM pg_temp.ghi('KICH_BAN','Tái phát kế thừa đồng hồ nhắc', (split_part(v_cd,'|',2) IN ('t','true')), split_part(v_cd,'|',3),
        'Nhánh TÁI PHÁT trong ingest (20260710s) — thiếu kế thừa lan_nhac_cuoi là WF6 báo giả');
    ELSE
      PERFORM pg_temp.ghi('KICH_BAN','Tái phát kế thừa đồng hồ nhắc', false, 'NỔ: '||v_cd, 'đọc lỗi');
    END IF;
  END;
END $kb$;

-- ── K3 (71 → 13/07 ĐẢO CHÍNH SÁCH): chết 3 giờ → TÁCH RIÊNG — đóng vé, giờ SUPPRESSED ──
DO $kb$
DECLARE v_dat boolean; v_cd text;
BEGIN
  BEGIN
    PERFORM pg_temp.bom('C1.R20','AHU04','P1',1,60,10,1.0,true);
    PERFORM pg_temp.bom('C1.R20','AHU04','P1',2,60,10,1.0,true);
    PERFORM pg_temp.bom('C1.R20','AHU04','P1',3,60,10,1.0,true);   -- giờ 3 → đủ chuỗi đứng hình
    -- Chính sách 13/07: đứng hình = THIẾU DỮ LIỆU — vé mở giờ 1-2 bị hệ ĐÓNG,
    -- KHÔNG vé mới, giờ dữ liệu mang mức SUPPRESSED (web hiện "thiếu dữ liệu")
    v_dat := NOT EXISTS (SELECT 1 FROM public.su_co WHERE ma_phong='C1.R20' AND loai_cam_bien='DP'
                           AND thoi_gian_dong IS NULL)
         AND EXISTS (SELECT 1 FROM public.su_co WHERE ma_phong='C1.R20' AND loai_cam_bien='DP'
                       AND trang_thai_hien_tai='DONG_NGOAI_PHAM_VI'
                       AND (du_lieu->>'cam_bien_dung_hinh')::boolean)
         AND EXISTS (SELECT 1 FROM public.du_lieu_gio WHERE ma_phong='C1.R20' AND loai_cam_bien='DP'
                       AND muc_canh_bao='SUPPRESSED'
                       AND bucket_utc=date_trunc('hour',now())+interval '3 hour');
    -- cảm biến chết đọc "trong dải" tiếp → vẫn nhánh đứng hình: không vé mới nào mở
    PERFORM pg_temp.bom('C1.R20','AHU04','P1',4,0,0,15,true);
    PERFORM pg_temp.bom('C1.R20','AHU04','P1',5,0,0,15,true);
    v_dat := v_dat AND NOT EXISTS (SELECT 1 FROM public.su_co WHERE ma_phong='C1.R20' AND loai_cam_bien='DP'
                                     AND thoi_gian_dong IS NULL);
    RAISE EXCEPTION 'KQ|%|3 giờ chết → vé đóng DONG_NGOAI_PHAM_VI + giờ SUPPRESSED; số liệu chết không mở vé mới', coalesce(v_dat,false);
  EXCEPTION WHEN OTHERS THEN
    v_cd := SQLERRM;
    IF v_cd LIKE 'KQ|%' THEN
      PERFORM pg_temp.ghi('KICH_BAN','Đứng hình tách riêng (đóng vé, không phán xét)', (split_part(v_cd,'|',2) IN ('t','true')), split_part(v_cd,'|',3),
        'Nhánh v_bo_qua trong ingest (20260713c) — đóng vé hệ thống, giờ ghi SUPPRESSED, không vé mới');
    ELSE
      PERFORM pg_temp.ghi('KICH_BAN','Đứng hình tách riêng (đóng vé, không phán xét)', false, 'NỔ: '||v_cd, 'đọc lỗi');
    END IF;
  END;
END $kb$;

-- ── K4 (76): mở lại khi cụm mới cùng khoá đã mở → nhập cụm, KHÔNG nổ ────────
DO $kb$
DECLARE v_dat boolean; v_cd text; v_sc bigint; v_cum_cu bigint; v_cum_moi bigint; v_sau bigint;
BEGIN
  BEGIN
    PERFORM set_config('app.tg_bypass_append_only','on',true);
    -- dựng: sự cố A có cụm, đóng nó (cụm đóng), sự cố B cùng khoá → cụm mới
    INSERT INTO public.su_co(thuoc_thu_nghiem,khoa_su_co,ma_phong,ten_phong,khu_vuc,ahu,cap_phong_sach,
          muc_uu_tien,loai_cam_bien,loai_canh_bao,muc_canh_bao_ban_dau,muc_canh_bao_hien_tai,
          trang_thai_hien_tai,thoi_gian_mo,thoi_gian_lan_cuoi_quan_sat,nguon)
    VALUES (false, md5('KB4.A'),'KB4.A','x','C1','AHU-KB4','C','P2','DP','OOS_DP',
            'CRITICAL','CRITICAL','CHUA_XU_LY',now()-interval '2 hour',now(),'TEST')
    RETURNING ma_su_co, ma_cum INTO v_sc, v_cum_cu;
    SELECT ma_cum INTO v_cum_cu FROM public.su_co WHERE ma_su_co=v_sc;
    UPDATE public.su_co SET thoi_gian_dong=now() WHERE ma_su_co=v_sc;
    INSERT INTO public.su_co(thuoc_thu_nghiem,khoa_su_co,ma_phong,ten_phong,khu_vuc,ahu,cap_phong_sach,
          muc_uu_tien,loai_cam_bien,loai_canh_bao,muc_canh_bao_ban_dau,muc_canh_bao_hien_tai,
          trang_thai_hien_tai,thoi_gian_mo,thoi_gian_lan_cuoi_quan_sat,nguon)
    VALUES (false, md5('KB4.B'),'KB4.B','x','C1','AHU-KB4','C','P2','DP','OOS_DP',
            'CRITICAL','CRITICAL','CHUA_XU_LY',now(),now(),'TEST');
    SELECT ma_cum INTO v_cum_moi FROM public.su_co WHERE khoa_su_co=md5('KB4.B');
    -- MỞ LẠI A — trước 20260710an chỗ này nổ duplicate key
    UPDATE public.su_co SET thoi_gian_dong=NULL, trang_thai_hien_tai='MO_LAI' WHERE ma_su_co=v_sc;
    SELECT ma_cum INTO v_sau FROM public.su_co WHERE ma_su_co=v_sc;
    v_dat := (v_sau = v_cum_moi) AND (v_cum_moi IS NOT NULL) AND (v_cum_cu <> v_cum_moi);
    RAISE EXCEPTION 'KQ|%|A mở lại nhập cụm % (cụm cũ %)', coalesce(v_dat,false), v_sau, v_cum_cu;
  EXCEPTION WHEN OTHERS THEN
    v_cd := SQLERRM;
    IF v_cd LIKE 'KQ|%' THEN
      PERFORM pg_temp.ghi('KICH_BAN','Mở lại sự cố nhập cụm đang mở, không nổ', (split_part(v_cd,'|',2) IN ('t','true')), split_part(v_cd,'|',3),
        'tg_cum_tu_dong (20260710an) — nhánh MỞ LẠI phải tìm cụm mở cùng khoá trước');
    ELSE
      PERFORM pg_temp.ghi('KICH_BAN','Mở lại sự cố nhập cụm đang mở, không nổ', false, 'NỔ: '||v_cd,
        'Đây chính là bug 76 tái xuất — duplicate key ux_cum_su_co_mo');
    END IF;
  END;
END $kb$;

-- ── K5 (77): chèn cụm cùng khoá lần hai vẫn trả về mã cụm (chống đua) ───────
DO $kb$
DECLARE v_dat boolean; v_cd text; v1 bigint; v2 bigint;
BEGIN
  BEGIN
    PERFORM set_config('app.tg_bypass_append_only','on',true);
    INSERT INTO public.su_co(thuoc_thu_nghiem,khoa_su_co,ma_phong,ten_phong,khu_vuc,ahu,cap_phong_sach,
          muc_uu_tien,loai_cam_bien,loai_canh_bao,muc_canh_bao_ban_dau,muc_canh_bao_hien_tai,
          trang_thai_hien_tai,thoi_gian_mo,thoi_gian_lan_cuoi_quan_sat,nguon)
    VALUES (false, md5('KB5.A'),'KB5.A','x','C1','AHU-KB5','C','P2','DP','OOS_DP',
            'CRITICAL','CRITICAL','CHUA_XU_LY',now(),now(),'TEST'),
           (false, md5('KB5.B'),'KB5.B','x','C1','AHU-KB5','C','P2','DP','OOS_DP',
            'CRITICAL','CRITICAL','CHUA_XU_LY',now(),now(),'TEST');
    SELECT ma_cum INTO v1 FROM public.su_co WHERE khoa_su_co=md5('KB5.A');
    SELECT ma_cum INTO v2 FROM public.su_co WHERE khoa_su_co=md5('KB5.B');
    v_dat := (v1 IS NOT NULL) AND (v1 = v2);
    RAISE EXCEPTION 'KQ|%|hai sự cố cùng (AHU,cảm biến) vào CÙNG cụm %', coalesce(v_dat,false), v1;
  EXCEPTION WHEN OTHERS THEN
    v_cd := SQLERRM;
    IF v_cd LIKE 'KQ|%' THEN
      PERFORM pg_temp.ghi('KICH_BAN','Gán cụm chống đua (DO UPDATE, không mồ côi)', (split_part(v_cd,'|',2) IN ('t','true')), split_part(v_cd,'|',3),
        'gan_cum_su_co phải dùng ON CONFLICT DO UPDATE ... RETURNING (bug 77)');
    ELSE
      PERFORM pg_temp.ghi('KICH_BAN','Gán cụm chống đua (DO UPDATE, không mồ côi)', false, 'NỔ: '||v_cd, 'đọc lỗi');
    END IF;
  END;
END $kb$;

-- ── K6 (56/59): quyền theo vai trò — IPC không bấm được nút Cơ điện; anon chặn
DO $kb$
DECLARE v_dat boolean := true; v_cd text := ''; r jsonb; v_sc bigint;
BEGIN
  BEGIN
    SELECT ma_su_co INTO v_sc FROM public.su_co
     WHERE thoi_gian_dong IS NULL AND trang_thai_hien_tai='DA_BAO_CO_DIEN' LIMIT 1;
    IF v_sc IS NULL THEN RAISE EXCEPTION 'KQ|true|không có sự cố DA_BAO_CO_DIEN để thử — bỏ qua'; END IF;

    PERFORM set_config('request.jwt.claims','{"role":"authenticated","email":"tienhoan.dhd@gmail.com"}',true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    r := public.rpc_thao_tac_su_co(p_ma_su_co=>v_sc, p_hanh_dong=>'mep_tiep_nhan');
    EXECUTE 'RESET ROLE';
    IF coalesce(r->>'ok','true') <> 'false' THEN
      v_dat := false; v_cd := v_cd||'IPC bấm được nút Cơ điện! ';
    ELSE
      v_cd := v_cd||'IPC bị chặn ('||coalesce(r->>'loi','?')||') ';
    END IF;

    PERFORM set_config('request.jwt.claims','{"role":"authenticated","email":"chanbonght@gmail.com"}',true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    r := public.rpc_thao_tac_su_co(p_ma_su_co=>v_sc, p_hanh_dong=>'mep_tiep_nhan');
    EXECUTE 'RESET ROLE';
    IF coalesce(r->>'ok','false') <> 'true' THEN
      v_dat := false; v_cd := v_cd||'· Cơ điện KHÔNG bấm được nút của mình: '||coalesce(r->>'loi','?');
    ELSE
      v_cd := v_cd||'· Cơ điện bấm được nút của mình';
    END IF;
    RAISE EXCEPTION 'KQ|%|%', coalesce(v_dat,false), v_cd;
  EXCEPTION WHEN OTHERS THEN
    v_cd := SQLERRM;
    IF v_cd LIKE 'KQ|%' THEN
      PERFORM pg_temp.ghi('KICH_BAN','Phân quyền nút theo vai trò giữ vững', (split_part(v_cd,'|',2) IN ('t','true')), split_part(v_cd,'|',3),
        'rpc_thao_tac_su_co guard A–D; bảng luật bo_nut');
    ELSE
      PERFORM pg_temp.ghi('KICH_BAN','Phân quyền nút theo vai trò giữ vững', false, 'NỔ: '||v_cd, 'đọc lỗi');
    END IF;
  END;
END $kb$;

-- ── K7: mọi view authenticated đọc được; anon không đọc được view nhạy cảm ──
DO $kb$
DECLARE v_hong int := 0; v_ten text := ''; v record; v_anon int := 0;
BEGIN
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","email":"admin@cpc1hn.vn"}',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOR v IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relkind IN ('v','m')
              AND has_table_privilege('authenticated',c.oid,'SELECT') LOOP
    BEGIN
      EXECUTE format('SELECT * FROM public.%I LIMIT 1', v.relname);
    EXCEPTION WHEN OTHERS THEN
      v_hong := v_hong+1; v_ten := v_ten||v.relname||' ';
    END;
  END LOOP;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO v_anon FROM pg_class c
   WHERE c.relnamespace='public'::regnamespace
     AND c.relname IN ('xem_dinh_tuyen_email_v14','xem_kiem_tra_nguoi_nhan','xem_cum_su_co',
                       'bak_merge_archive_20260708','du_lieu_phut_8h','ma_token_email')
     AND has_table_privilege('anon',c.oid,'SELECT');
  PERFORM pg_temp.ghi('KICH_BAN','View: authenticated đọc hết, anon bị chặn chỗ nhạy cảm',
    v_hong=0 AND v_anon=0,
    v_hong||' view hỏng dưới authenticated ('||v_ten||') · '||v_anon||' đối tượng nhạy cảm mở cho anon',
    'Hỏng = bug lớp 7 (REVOKE hàm trong view — 20260710ab/ad); anon mở = 20260710ac/ae/at tái diễn');
END $kb$;

-- ── K8 (14/07): BỎ MỨC CHÚ Ý — would-be-WARNING KHÔNG mở vé, chỉ CRITICAL mở ──
DO $kb$
DECLARE v_dat boolean; v_cd text;
BEGIN
  BEGIN
    PERFORM set_config('app.tg_bypass_append_only','on',true);
    UPDATE public.su_co SET thoi_gian_dong=now() WHERE ma_phong IN ('C1.R16','C1.R17') AND loai_cam_bien='DP' AND thoi_gian_dong IS NULL;
    PERFORM set_config('app.tg_bypass_append_only','off',true);
    PERFORM pg_temp.bom('C1.R16','AHU-KW8','P1',1,55,2,8,false);   -- OOS 55>20 nhưng 10' cuối 2<4 → WARNING → KHÔNG mở vé
    PERFORM pg_temp.bom('C1.R17','AHU-KC8','P1',1,55,9,8,false);   -- 10' cuối 9>=4 → CRITICAL → mở vé
    v_dat := NOT EXISTS (SELECT 1 FROM public.su_co WHERE ma_phong='C1.R16' AND loai_cam_bien='DP' AND thoi_gian_dong IS NULL)
         AND EXISTS (SELECT 1 FROM public.su_co WHERE ma_phong='C1.R17' AND loai_cam_bien='DP' AND thoi_gian_dong IS NULL AND muc_canh_bao_hien_tai='CRITICAL')
         AND EXISTS (SELECT 1 FROM public.du_lieu_gio WHERE ma_phong='C1.R16' AND loai_cam_bien='DP' AND muc_canh_bao='WARNING');   -- dữ liệu thật vẫn ghi WARNING
    RAISE EXCEPTION 'KQ|%|WARNING không mở vé · CRITICAL mở vé · du_lieu_gio vẫn ghi WARNING', coalesce(v_dat,false);
  EXCEPTION WHEN OTHERS THEN
    v_cd := SQLERRM;
    IF v_cd LIKE 'KQ|%' THEN
      PERFORM pg_temp.ghi('KICH_BAN','Bỏ mức Chú ý: would-be-WARNING không mở vé (chỉ CRITICAL)', (split_part(v_cd,'|',2) IN ('t','true')), split_part(v_cd,'|',3),
        'rpc_xu_ly_du_lieu_phong_hang_gio (20260714c): cổng mở vé mới thêm điều kiện v_sev=CRITICAL');
    ELSE
      PERFORM pg_temp.ghi('KICH_BAN','Bỏ mức Chú ý: would-be-WARNING không mở vé (chỉ CRITICAL)', false, 'NỔ: '||v_cd, 'đọc lỗi');
    END IF;
  END;
END $kb$;

-- =============================================================================
-- BÁO CÁO
-- =============================================================================
SELECT CASE WHEN dat THEN '✅' ELSE '❌' END || ' ' || rpad(nhom,9) || ' ' || ten AS ket_qua,
       chan_doan,
       CASE WHEN dat THEN '' ELSE coalesce(goi_y,'') END AS xu_ly
  FROM kq_kiem ORDER BY dat, nhom, stt;

SELECT format('TỔNG: %s/%s đạt · %s VỠ', count(*) FILTER (WHERE dat), count(*),
              count(*) FILTER (WHERE NOT dat)) AS tong_ket
  FROM kq_kiem;

-- Dòng máy-đọc cho runner (đặt exit code)
SELECT 'KQ_MAY_DOC:' || count(*) FILTER (WHERE NOT dat) AS may_doc FROM kq_kiem;

ROLLBACK;
