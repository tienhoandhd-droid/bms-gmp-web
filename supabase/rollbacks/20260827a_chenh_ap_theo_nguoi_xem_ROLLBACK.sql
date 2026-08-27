-- =============================================================================
-- ROLLBACK 20260827a — KHÔI PHỤC CRON CHÊNH ÁP 05:00–21:00
-- =============================================================================

BEGIN;

SELECT cron.unschedule('bms-phut-8h')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='bms-phut-8h');

CREATE OR REPLACE FUNCTION public.kich_capnhat_phut_8h()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_token text;
  v_gio int;
BEGIN
  IF lower(COALESCE((SELECT value FROM public.cau_hinh WHERE key='edge_capnhat_phut_bat'),'true')) <> 'true' THEN
    RETURN;
  END IF;

  v_gio := EXTRACT(hour FROM (now() AT TIME ZONE public.mui_gio()))::int;
  IF v_gio < COALESCE((SELECT value FROM public.cau_hinh WHERE key='edge_capnhat_phut_gio_dau'),'5')::int
     OR v_gio >= COALESCE((SELECT value FROM public.cau_hinh WHERE key='edge_capnhat_phut_gio_cuoi'),'21')::int THEN
    RETURN;
  END IF;

  v_url := COALESCE((SELECT value FROM public.cau_hinh WHERE key='edge_capnhat_phut_url'),'');
  IF v_url = '' THEN RETURN; END IF;

  v_token := COALESCE((SELECT value FROM public.cau_hinh WHERE key='webhook_token_web'),'');

  PERFORM net.http_post(
    url     := v_url,
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-bms-token',  v_token));
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.kich_capnhat_phut_8h() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kich_capnhat_phut_8h() TO service_role;

SELECT cron.schedule('bms-phut-8h', '* * * * *', 'SELECT public.kich_capnhat_phut_8h();');

DROP FUNCTION IF EXISTS public.rpc_finish_capnhat_phut_8h(uuid, boolean, text, boolean);
DROP FUNCTION IF EXISTS public.rpc_claim_capnhat_phut_8h();
DROP FUNCTION IF EXISTS public.rpc_dung_xem_chenh_ap(uuid);
DROP FUNCTION IF EXISTS public.rpc_cham_nguoi_xem_chenh_ap(uuid);

DROP TABLE IF EXISTS public.bms_chenh_ap_ingest;
DROP TABLE IF EXISTS public.bms_chenh_ap_viewer;

UPDATE public.cau_hinh SET value = '20260824b' WHERE key = 'phien_ban_db';

COMMIT;
