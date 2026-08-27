import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(
  new URL('../../supabase/migrations/20260827a_chenh_ap_theo_nguoi_xem.sql', import.meta.url),
  'utf8',
)
const rollback = readFileSync(
  new URL('../../supabase/rollbacks/20260827a_chenh_ap_theo_nguoi_xem_ROLLBACK.sql', import.meta.url),
  'utf8',
)

test('pressure viewer migration defines the viewer gate, lease, backoff and cron contract', () => {
  assert.match(sql, /create table if not exists public\.bms_chenh_ap_viewer/i)
  assert.match(sql, /last_seen\s+timestamptz\s+not null/i)
  assert.match(sql, /interval '90 seconds'/i)
  assert.match(sql, /interval '45 seconds'/i)
  assert.match(sql, /interval '5 minutes'/i)
  assert.match(sql, /interval '15 minutes'/i)
  assert.match(sql, /security definer set search_path to 'public'/i)
  assert.match(sql, /revoke all on function public\.rpc_claim_capnhat_phut_8h\(\) from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.rpc_claim_capnhat_phut_8h\(\) to service_role/i)
  assert.match(sql, /cron\.schedule\('bms-phut-8h', '\* \* \* \* \*'/i)
  assert.doesNotMatch(sql, /edge_capnhat_phut_gio_dau.*extract\(hour/is)
  assert.match(rollback, /drop function if exists public\.rpc_cham_nguoi_xem_chenh_ap/i)
})

test('viewer expiry checks use a last_seen index', () => {
  assert.match(
    sql,
    /create index if not exists \w+\s+on public\.bms_chenh_ap_viewer\s*\(last_seen\)/i,
  )
})

test('the minute cron removes expired viewers before checking for an active viewer', () => {
  const cronFunction = sql.match(
    /create or replace function public\.kich_capnhat_phut_8h\(\)[\s\S]*?\$function\$;/i,
  )?.[0]
  assert.ok(cronFunction, 'kich_capnhat_phut_8h must exist')
  assert.match(
    cronFunction,
    /delete from public\.bms_chenh_ap_viewer\s+where last_seen <= now\(\) - interval '90 seconds';\s*if not exists\s*\(\s*select 1\s+from public\.bms_chenh_ap_viewer\s+where last_seen > now\(\) - interval '90 seconds'/is,
  )
})
