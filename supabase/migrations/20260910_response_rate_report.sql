-- Separate response report; same successful in-hours notification cohort as emailed report.
-- No SMTP addresses, tokens, HTML, or cross-area incident data is exposed.
CREATE OR REPLACE FUNCTION public.rpc_bao_cao_phan_hoi_mail(p_tu date, p_den date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_role text; v_areas text[]; v_period jsonb; v_periods jsonb := '[]'::jsonb;
  v_shift integer; v_start date; v_end date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'CHUA_DANG_NHAP' USING ERRCODE='42501'; END IF;
  SELECT n.vai_tro,n.khu_vuc INTO v_role,v_areas FROM public.nguoi_dung n
  WHERE lower(n.email)=lower(auth.jwt()->>'email') AND n.kich_hoat;
  IF v_role IS NULL OR v_role NOT IN ('QA','ADMIN','IT') THEN
    RAISE EXCEPTION 'KHONG_CO_QUYEN' USING ERRCODE='42501';
  END IF;
  IF p_tu IS NULL OR p_den IS NULL OR p_den-p_tu<>6
     OR p_den >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RAISE EXCEPTION 'KY_BAO_CAO_KHONG_HOP_LE' USING ERRCODE='22023';
  END IF;
  FOR v_shift IN 0..1 LOOP
    v_start:=p_tu-v_shift*7; v_end:=p_den-v_shift*7;
    WITH period AS (
      SELECT v_start::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AS start_at,
        (v_end+1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh' AS end_at
    ), scoped_incidents AS (
      SELECT s.ma_su_co,s.ma_phong FROM public.su_co s
      WHERE NOT s.thuoc_thu_nghiem AND s.khu_vuc=ANY(coalesce(v_areas,'{}'::text[]))
    ), legacy_mails AS (
  SELECT e.* FROM public.email_da_gui e CROSS JOIN period p
  WHERE e.loai_email='DIGEST_CANH_BAO' AND e.trang_thai='DA_GUI'
    AND NOT e.thuoc_thu_nghiem AND e.gui_luc>=p.start_at AND e.gui_luc<p.end_at
), legacy_links AS (
  SELECT e.id,e.gui_luc,e.du_lieu->>'vai_tro' AS role,
         m[1]::bigint AS incident_id,m[2] AS action,m[3] AS token
  FROM legacy_mails e CROSS JOIN LATERAL regexp_matches(
    replace(e.noi_dung_html,'&amp;','&'),
    '[?&]sc=([0-9]+)&act=([a-z_]+)&token=([^"&<> ]+)','g') m
), legacy_verified AS (
  SELECT DISTINCT l.id,l.gui_luc,l.role,l.incident_id
  FROM legacy_links l JOIN public.ma_token_email t
    ON t.token_hash=encode(sha256(convert_to(l.token,'UTF8')),'hex')
   AND NOT t.thuoc_thu_nghiem AND t.ma_su_co=l.incident_id
   AND t.hanh_dong=l.action AND t.vai_tro_can=l.role
  JOIN legacy_mails e ON e.id=l.id
  WHERE jsonb_array_length(coalesce(e.phan_hoi_smtp->'accepted','[]'::jsonb))>0
    AND coalesce(e.phan_hoi_smtp->'rejected','[]'::jsonb)='[]'::jsonb
    AND NOT e.phan_hoi_smtp ? 'error'
), deliveries AS (
  SELECT DISTINCT u.unit->>'incident_id' AS incident_id,u.unit->>'role' AS role,
    coalesce(d.sent_at,d.created_at) AS at,d.state,d.test_mode,
    u.unit->>'event_kind' AS kind,'v18'::text AS source
  FROM public.bms_mail_guard_unit_v18 u JOIN public.bms_mail_guard_v18 d USING(claim_id)
  CROSS JOIN period p
  WHERE coalesce(d.sent_at,d.created_at)>=p.start_at AND coalesce(d.sent_at,d.created_at)<p.end_at
    AND u.unit->>'incident_id' IS NOT NULL
  UNION ALL
  SELECT DISTINCT x.value AS incident_id,d.message->>'role' AS role,
    coalesce(d.sent_at,d.claimed_at) AS at,d.state,d.test_mode,
    d.message->>'kind' AS kind,'v16'::text AS source
  FROM public.bms_mail_delivery_v16 d CROSS JOIN period p
  CROSS JOIN LATERAL jsonb_array_elements_text(d.message->'incidentIds') x
  WHERE coalesce(d.sent_at,d.claimed_at)>=p.start_at AND coalesce(d.sent_at,d.claimed_at)<p.end_at
  UNION ALL
  SELECT incident_id::text,role,gui_luc,'SENT',false,'ACTION','legacy'
  FROM legacy_verified
) , scoped_deliveries AS (
  SELECT d.* FROM deliveries d JOIN scoped_incidents s ON s.ma_su_co::text=d.incident_id
), histories AS (
  SELECT l.ma_su_co::text AS incident_id,l.vai_tro AS role,l.thoi_diem AS at,
    l.hanh_dong AS action,l.nguon AS source,l.thuoc_thu_nghiem AS test_mode
  FROM public.lich_su_su_co l JOIN scoped_incidents s ON s.ma_su_co=l.ma_su_co CROSS JOIN period p
  WHERE l.thoi_diem>=p.start_at AND l.thoi_diem<p.end_at
    AND l.vai_tro IN ('IPC','MEP','LOT','QA')
), eligible AS (
  SELECT incident_id,role,min(at) AS first_sent FROM scoped_deliveries
  WHERE state='SENT' AND NOT test_mode AND role IN ('IPC','MEP','LOT','QA')
    AND kind IN ('ACTION','NEW','REMINDER','ESCALATION')
    AND public.bms_mail_hours_v18(ARRAY[role],at)
  GROUP BY 1,2
), response_actions(role,action) AS (VALUES
  ('IPC','ipc_nhan_viec'),('IPC','ipc_bao_co_dien'),('IPC','ipc_binh_thuong'),('IPC','ipc_da_khac_phuc'),
  ('MEP','mep_tiep_nhan'),('MEP','mep_cho_xu_ly'),('MEP','mep_khong_xu_ly_duoc'),('MEP','mep_xu_ly_xong'),
  ('LOT','lot_nhan_dieu_phoi'),('LOT','lot_nhac_ipc'),('LOT','lot_nhac_co_dien'),('LOT','lot_tam_dung_4h'),
  ('QA','qa_nhan_ra_soat'),('QA','qa_da_khac_phuc'),('QA','qa_mo_lai')
), detail AS (
  SELECT e.incident_id,e.role,e.first_sent,s.ma_phong,
    (SELECT min(h.at) FROM histories h JOIN response_actions a USING(role,action)
     WHERE h.incident_id=e.incident_id AND h.role=e.role AND h.at>=e.first_sent
       AND NOT h.test_mode AND h.source IN ('web','web_email')) AS response_at
  FROM eligible e JOIN scoped_incidents s ON s.ma_su_co::text=e.incident_id
), roles(role,ord) AS (VALUES ('IPC',1),('MEP',2),('LOT',3),('QA',4)), summary AS (
  SELECT r.role,r.ord,count(d.incident_id) AS denominator,
    count(d.response_at) AS responded,
    CASE WHEN count(d.incident_id)>0 THEN round(100.0*count(d.response_at)/count(d.incident_id),1) END AS rate_pct
  FROM roles r LEFT JOIN detail d USING(role) GROUP BY r.role,r.ord
)
SELECT jsonb_build_object(
  'start',v_start,'end',v_end,
  'rows',(SELECT jsonb_agg(jsonb_build_object('role',role,'denominator',denominator,
    'responded',responded,'rate_pct',rate_pct) ORDER BY ord) FROM summary),
  'details',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY role,first_sent,incident_id),'[]'::jsonb) FROM detail d),
  'has_legacy',EXISTS(SELECT 1 FROM scoped_deliveries WHERE source='legacy')
) INTO v_period;
    v_periods:=v_periods || jsonb_build_array(v_period);
  END LOOP;
  RETURN jsonb_build_object('periods',v_periods);
END
$function$;
REVOKE ALL ON FUNCTION public.rpc_bao_cao_phan_hoi_mail(date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_bao_cao_phan_hoi_mail(date,date) TO authenticated;
