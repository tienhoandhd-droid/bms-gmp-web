-- =============================================================================
-- 20260827a — CHỈ CẬP NHẬT CHÊNH ÁP KHI CÓ NGƯỜI XEM
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.bms_chenh_ap_viewer (
  viewer_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bms_chenh_ap_viewer_last_seen
  ON public.bms_chenh_ap_viewer(last_seen);

CREATE TABLE IF NOT EXISTS public.bms_chenh_ap_ingest (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  lease_token uuid,
  lease_until timestamptz,
  last_success timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  cooldown_until timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.bms_chenh_ap_ingest(singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.bms_chenh_ap_viewer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bms_chenh_ap_ingest ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bms_chenh_ap_viewer, public.bms_chenh_ap_ingest
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_cham_nguoi_xem_chenh_ap(p_viewer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CHUA_DANG_NHAP');
  END IF;

  INSERT INTO public.bms_chenh_ap_viewer(viewer_id, user_id, last_seen)
  VALUES (p_viewer_id, v_user_id, now())
  ON CONFLICT (viewer_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        last_seen = EXCLUDED.last_seen;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'LOI_HE_THONG');
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_dung_xem_chenh_ap(p_viewer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CHUA_DANG_NHAP');
  END IF;

  DELETE FROM public.bms_chenh_ap_viewer
   WHERE viewer_id = p_viewer_id
     AND user_id = v_user_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', 'LOI_HE_THONG');
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_cham_nguoi_xem_chenh_ap(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_dung_xem_chenh_ap(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cham_nguoi_xem_chenh_ap(uuid)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_dung_xem_chenh_ap(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_claim_capnhat_phut_8h()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_state public.bms_chenh_ap_ingest%ROWTYPE;
  v_token uuid;
BEGIN
  SELECT *
    INTO v_state
    FROM public.bms_chenh_ap_ingest
   WHERE singleton
   FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
      FROM public.bms_chenh_ap_viewer
     WHERE last_seen > now() - interval '90 seconds'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'SKIPPED_NO_VIEWER');
  END IF;

  IF v_state.last_success IS NOT NULL
     AND v_state.last_success > now() - interval '45 seconds' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'SKIPPED_FRESH');
  END IF;

  IF v_state.cooldown_until IS NOT NULL
     AND v_state.cooldown_until > now() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'SKIPPED_COOLDOWN');
  END IF;

  IF v_state.lease_until IS NOT NULL
     AND v_state.lease_until > now() THEN
    RETURN jsonb_build_object('ok', true, 'status', 'SKIPPED_LOCKED');
  END IF;

  v_token := gen_random_uuid();
  UPDATE public.bms_chenh_ap_ingest
     SET lease_token = v_token,
         lease_until = now() + interval '90 seconds',
         updated_at = now()
   WHERE singleton;

  RETURN jsonb_build_object('ok', true, 'status', 'CLAIMED', 'token', v_token);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_finish_capnhat_phut_8h(
  p_token uuid,
  p_ok boolean,
  p_error text,
  p_degraded boolean
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_state public.bms_chenh_ap_ingest%ROWTYPE;
  v_failures integer;
BEGIN
  SELECT *
    INTO v_state
    FROM public.bms_chenh_ap_ingest
   WHERE singleton
   FOR UPDATE;

  IF p_token IS NULL OR v_state.lease_token IS DISTINCT FROM p_token THEN
    RETURN jsonb_build_object('ok', false, 'status', 'REJECTED_TOKEN');
  END IF;

  IF p_ok THEN
    UPDATE public.bms_chenh_ap_ingest
       SET lease_token = NULL,
           lease_until = NULL,
           last_success = now(),
           consecutive_failures = 0,
           cooldown_until = NULL,
           last_error = CASE
             WHEN COALESCE(p_degraded, false) THEN NULLIF(left(COALESCE(p_error, ''), 1000), '')
             ELSE NULL
           END,
           updated_at = now()
     WHERE singleton;

    RETURN jsonb_build_object(
      'ok', true,
      'status', CASE WHEN COALESCE(p_degraded, false) THEN 'DEGRADED' ELSE 'FINISHED' END
    );
  END IF;

  v_failures := v_state.consecutive_failures + 1;
  UPDATE public.bms_chenh_ap_ingest
     SET lease_token = NULL,
         lease_until = NULL,
         consecutive_failures = v_failures,
         cooldown_until = CASE
           WHEN v_failures >= 4 THEN now() + interval '15 minutes'
           WHEN v_failures >= 2 THEN now() + interval '5 minutes'
           ELSE NULL
         END,
         last_error = NULLIF(left(COALESCE(p_error, ''), 1000), ''),
         updated_at = now()
   WHERE singleton;

  RETURN jsonb_build_object('ok', true, 'status', 'FAILED');
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_claim_capnhat_phut_8h() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rpc_finish_capnhat_phut_8h(uuid, boolean, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_claim_capnhat_phut_8h() TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_finish_capnhat_phut_8h(uuid, boolean, text, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.kich_capnhat_phut_8h()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_url text;
  v_token text;
BEGIN
  -- READ COMMITTED kiểm tra lại predicate nếu heartbeat vừa đổi hàng đồng thời;
  -- nếu DELETE thắng trước thì heartbeat upsert sẽ chờ rồi chèn lại hàng.
  DELETE FROM public.bms_chenh_ap_viewer
   WHERE last_seen <= now() - interval '90 seconds';

  IF lower(COALESCE((SELECT value FROM public.cau_hinh WHERE key='edge_capnhat_phut_bat'),'true')) <> 'true' THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.bms_chenh_ap_viewer
     WHERE last_seen > now() - interval '90 seconds'
  ) THEN
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

SELECT cron.unschedule('bms-phut-8h')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='bms-phut-8h');
SELECT cron.schedule('bms-phut-8h', '* * * * *', 'SELECT public.kich_capnhat_phut_8h();');

UPDATE public.cau_hinh SET value = '20260827a' WHERE key = 'phien_ban_db';

COMMIT;
