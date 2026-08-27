# Pressure Active Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chỉ gọi FMS khi có ít nhất một người đang nhìn tab Chênh áp, tải tối đa 10 phút gần nhất khi mở lại và cập nhật tối đa một lần mỗi phút bất kể số người xem.

**Architecture:** React quản lý một phiên người xem bằng Page Visibility + heartbeat Supabase 30 giây. PostgreSQL giữ viewer TTL 90 giây, freshness 45 giây, lease 90 giây và backoff; cron mỗi phút và yêu cầu tải ngay dùng chung một RPC claim nguyên tử. Edge Function chặn cửa sổ FMS ở 10 phút và chỉ xử lý ba phòng song song.

**Tech Stack:** React 19, JavaScript ES modules, Node 24 `node:test`, Supabase PostgreSQL/pg_cron/pg_net, Supabase Edge Functions (Deno TypeScript), GitHub Actions/GitHub Pages.

## Global Constraints

- FMS tiếp tục ghi một mẫu mỗi phút; mỗi record FMS phải thành một row, không lấy trung bình hoặc bỏ điểm trong cửa sổ 10 phút.
- Không có viewer còn hạn thì đường chênh áp thời gian gần thực tạo 0 request FMS.
- Một, năm hoặc 20 viewer vẫn tạo tối đa một lượt FMS mỗi phút.
- Viewer chỉ active khi tab BMS Chênh áp được chọn và `document.visibilityState === "visible"`.
- Heartbeat mỗi 30 giây; viewer hết hạn sau 90 giây; freshness 45 giây; lease 90 giây.
- Tối đa ba request phòng FMS đồng thời.
- Cho phép tải theo nhu cầu cả ngoài 05:00–21:00.
- Hai lỗi liên tiếp cooldown 5 phút; bốn lỗi liên tiếp cooldown 15 phút.
- Node dùng để test/build phải là `>=20.19`; môi trường chuẩn của repo là Node 24.
- Không đổi n8n WF1/WF1b và không đưa service-role/FMS secret vào source.
- Không push, deploy Edge, áp migration production hoặc merge `main` cho đến khi người dùng xác nhận lại đích deploy BMS.

---

## File Map

- Create `web/src/features/pressure/pressureViewerSession.js`: state machine độc lập React cho active/hidden, heartbeat và tải ngay.
- Create `web/test/pressure-viewer-session.test.mjs`: fake timer tests cho state machine.
- Modify `web/package.json`: thêm `test:unit` bằng Node test runner.
- Create `supabase/migrations/20260827a_chenh_ap_theo_nguoi_xem.sql`: viewer table/RPC, ingest lease/backoff/freshness và cron gate cả ngày.
- Create `supabase/rollbacks/20260827a_chenh_ap_theo_nguoi_xem_ROLLBACK.sql`: rollback có thứ tự, không xóa dữ liệu phút.
- Create `web/test/pressure-viewer-sql.test.mjs`: contract tests tĩnh cho SQL security, TTL, cron và rollback.
- Create `supabase/functions/capnhat-phut-8h/core.js`: logic thuần cho cửa sổ 10 phút, batch ba và ngưỡng lỗi.
- Create `supabase/functions/capnhat-phut-8h/index.ts`: nguồn Edge đã kiểm chứng từ backup, tích hợp claim/finish và core.
- Create `web/test/pressure-edge-core.test.mjs`: unit tests chạy bằng Node 24 cho core Edge.
- Modify `web/src/lib/supabaseData.js`: wrapper heartbeat/release và trả status Edge đầy đủ.
- Modify `web/src/features/pressure/ChenhApTheoAhu.jsx`: tích hợp visibility session, Realtime, fallback 60 giây và trạng thái UI.
- Create `web/test/pressure-component-contract.test.mjs`: regression contract ngăn timer FMS 180 giây quay lại.
- Modify `.github/workflows/deploy.yml`: chạy `npm run test:unit` trước các gate UI.

---

### Task 1: Viewer Session State Machine

**Files:**
- Create: `web/src/features/pressure/pressureViewerSession.js`
- Create: `web/test/pressure-viewer-session.test.mjs`
- Modify: `web/package.json`

**Interfaces:**
- Produces: `PRESSURE_HEARTBEAT_MS = 30000`, `isPressureViewerActive({ isLive, active, visibilityState })`, `createPressureViewerId(cryptoApi)`, and `createPressureViewerSession(deps)`.
- `createPressureViewerSession` returns `{ setActive(boolean), dispose() }` and consumes async `touch(viewerId)`, `release(viewerId)`, `requestUpdate()` plus injectable timers.

- [ ] **Step 1: Add the Node unit-test command**

Add this script to `web/package.json`:

```json
"test:unit": "node --test test/*.test.mjs"
```

- [ ] **Step 2: Write failing viewer lifecycle tests**

Create `web/test/pressure-viewer-session.test.mjs` with tests that assert:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PRESSURE_HEARTBEAT_MS,
  createPressureViewerId,
  createPressureViewerSession,
  isPressureViewerActive,
} from '../src/features/pressure/pressureViewerSession.js'

test('only a live, selected and visible pressure tab is active', () => {
  assert.equal(isPressureViewerActive({ isLive: true, active: true, visibilityState: 'visible' }), true)
  assert.equal(isPressureViewerActive({ isLive: true, active: true, visibilityState: 'hidden' }), false)
  assert.equal(isPressureViewerActive({ isLive: true, active: false, visibilityState: 'visible' }), false)
})

test('activation touches once, requests one immediate update and schedules 30s heartbeat', async () => {
  const calls = []
  let scheduled
  const session = createPressureViewerSession({
    viewerId: '00000000-0000-4000-8000-000000000001',
    touch: async () => { calls.push('touch'); return { ok: true } },
    release: async () => { calls.push('release') },
    requestUpdate: async () => { calls.push('update') },
    setTimer: (fn, ms) => { scheduled = { fn, ms }; return 7 },
    clearTimer: (id) => calls.push(`clear:${id}`),
  })
  await session.setActive(true)
  assert.deepEqual(calls, ['touch', 'update'])
  assert.equal(scheduled.ms, PRESSURE_HEARTBEAT_MS)
  await scheduled.fn()
  assert.deepEqual(calls, ['touch', 'update', 'touch'])
})

test('hiding releases immediately and cancels heartbeat', async () => {
  const calls = []
  const session = createPressureViewerSession({
    viewerId: '00000000-0000-4000-8000-000000000002',
    touch: async () => ({ ok: true }),
    release: async () => { calls.push('release') },
    requestUpdate: async () => {},
    setTimer: () => 11,
    clearTimer: (id) => calls.push(`clear:${id}`),
  })
  await session.setActive(true)
  await session.setActive(false)
  assert.deepEqual(calls, ['clear:11', 'release'])
})
```

Also test that deactivation while the first `touch()` is pending prevents `requestUpdate()`, `dispose()` is idempotent, and `createPressureViewerId()` returns a UUID from the injected crypto API.

- [ ] **Step 3: Run RED**

Run:

```bash
export PATH=/home/admin1/.nvm/versions/node/v24.18.0/bin:$PATH
npm run test:unit
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `pressureViewerSession.js`.

- [ ] **Step 4: Implement the minimal state machine**

Implement `pressureViewerSession.js` so that:

```js
export const PRESSURE_HEARTBEAT_MS = 30_000

export function isPressureViewerActive({ isLive, active, visibilityState }) {
  return Boolean(isLive && active && visibilityState === 'visible')
}

export function createPressureViewerId(cryptoApi = globalThis.crypto) {
  return cryptoApi.randomUUID()
}
```

`setActive(true)` must be transition-based, await the first successful touch, guard against a hide race, request one immediate update, then schedule heartbeat. `setActive(false)` must clear the timer and call release best-effort. Repeated true/false and `dispose()` must not duplicate calls.

- [ ] **Step 5: Run GREEN and commit**

Run `npm run test:unit`; expect all viewer session tests PASS.

```bash
git add web/package.json web/src/features/pressure/pressureViewerSession.js web/test/pressure-viewer-session.test.mjs
git commit -m "test: define active pressure viewer lifecycle"
```

---

### Task 2: PostgreSQL Viewer Gate, Lease and Backoff

**Files:**
- Create: `supabase/migrations/20260827a_chenh_ap_theo_nguoi_xem.sql`
- Create: `supabase/rollbacks/20260827a_chenh_ap_theo_nguoi_xem_ROLLBACK.sql`
- Create: `web/test/pressure-viewer-sql.test.mjs`

**Interfaces:**
- Produces authenticated RPCs `rpc_cham_nguoi_xem_chenh_ap(p_viewer_id uuid)` and `rpc_dung_xem_chenh_ap(p_viewer_id uuid)`.
- Produces service-role RPCs `rpc_claim_capnhat_phut_8h()` and `rpc_finish_capnhat_phut_8h(p_token uuid, p_ok boolean, p_error text, p_degraded boolean)` returning JSONB.
- Replaces `kich_capnhat_phut_8h()` so it queues Edge only when a viewer heartbeat is newer than 90 seconds.

- [ ] **Step 1: Write failing SQL contract tests**

Create `web/test/pressure-viewer-sql.test.mjs`. Read the migration and rollback using `readFileSync(new URL('../../supabase/...', import.meta.url), 'utf8')`, then assert the migration contains:

```js
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
```

- [ ] **Step 2: Run RED**

Run `npm run test:unit`; expect FAIL because both SQL files are absent.

- [ ] **Step 3: Create viewer and ingest state tables**

Migration requirements:

```sql
CREATE TABLE IF NOT EXISTS public.bms_chenh_ap_viewer (
  viewer_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

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
REVOKE ALL ON public.bms_chenh_ap_viewer, public.bms_chenh_ap_ingest FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 4: Implement heartbeat RPCs**

Both functions must be `SECURITY DEFINER SET search_path TO 'public'`, reject `auth.uid() IS NULL`, and return `{ok:false,error:'CHUA_DANG_NHAP'}` rather than exposing table errors. Touch upserts `(viewer_id, auth.uid(), now())`; release deletes only where both viewer ID and `user_id = auth.uid()` match. Grant execute only to `authenticated` and `service_role`.

- [ ] **Step 5: Implement atomic claim/finish RPCs**

`rpc_claim_capnhat_phut_8h()` must lock the singleton row `FOR UPDATE` and return exactly one of:

```json
{"ok":true,"status":"CLAIMED","token":"<uuid>"}
{"ok":true,"status":"SKIPPED_NO_VIEWER"}
{"ok":true,"status":"SKIPPED_FRESH"}
{"ok":true,"status":"SKIPPED_LOCKED"}
{"ok":true,"status":"SKIPPED_COOLDOWN"}
```

The order is viewer newer than 90 seconds, last success newer than 45 seconds, cooldown, lease, then claim with `gen_random_uuid()` and `lease_until = now() + interval '90 seconds'`.

`rpc_finish_capnhat_phut_8h()` must reject a non-owner token. Success clears failures/cooldown and sets `last_success = now()`. Failure increments the counter and sets cooldown from the new count: `>=4` gives 15 minutes, `>=2` gives 5 minutes, otherwise NULL. Always clear the matching lease. Grant claim/finish only to `service_role`.

- [ ] **Step 6: Gate cron all day**

Replace `kich_capnhat_phut_8h()` so it keeps the existing enable switch, URL, token and `net.http_post`, removes the 05:00–21:00 condition, and returns before `net.http_post` unless:

```sql
EXISTS (
  SELECT 1 FROM public.bms_chenh_ap_viewer
  WHERE last_seen > now() - interval '90 seconds'
)
```

Keep schedule `* * * * *`. Update `phien_ban_db` to `20260827a`.

- [ ] **Step 7: Add rollback**

Rollback must unschedule/recreate the previous 05:00–21:00 `kich_capnhat_phut_8h()`, drop the four new RPCs, and only then drop the two coordination tables. It must not touch `du_lieu_phut_8h` or FMS data.

- [ ] **Step 8: Run GREEN and commit**

Run `npm run test:unit`; expect SQL contract tests PASS.

```bash
git add -f supabase/migrations/20260827a_chenh_ap_theo_nguoi_xem.sql supabase/rollbacks/20260827a_chenh_ap_theo_nguoi_xem_ROLLBACK.sql
git add web/test/pressure-viewer-sql.test.mjs
git commit -m "feat: gate pressure ingestion by active viewers"
```

---

### Task 3: Edge Function Safety Core

**Files:**
- Create: `supabase/functions/capnhat-phut-8h/core.js`
- Create: `supabase/functions/capnhat-phut-8h/index.ts`
- Create: `web/test/pressure-edge-core.test.mjs`

**Interfaces:**
- Produces `BACKFILL_MS`, `ROOM_CONCURRENCY`, `clampFromIso()`, `mapWithConcurrency()`, `isRunFailure()`, `dedupeRows()` from `core.js`.
- Edge consumes the Task 2 claim/finish RPCs and returns `{ok,status,so_phong,so_diem,so_loi_phong}`.

- [ ] **Step 1: Write failing pure Edge tests**

Create `web/test/pressure-edge-core.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKFILL_MS, ROOM_CONCURRENCY, clampFromIso,
  dedupeRows, isRunFailure, mapWithConcurrency,
} from '../../supabase/functions/capnhat-phut-8h/core.js'

test('old cursor is clamped to ten minutes', () => {
  const now = Date.parse('2026-08-27T05:30:00.000Z')
  assert.equal(BACKFILL_MS, 600_000)
  assert.equal(clampFromIso('2026-08-27T04:00:00.000Z', now), '2026-08-27T05:20:00.000Z')
  assert.equal(clampFromIso('2026-08-27T05:27:00.000Z', now), '2026-08-27T05:27:00.000Z')
})

test('room worker never exceeds three concurrent requests', async () => {
  let active = 0, peak = 0
  await mapWithConcurrency([1,2,3,4,5,6,7], ROOM_CONCURRENCY, async () => {
    active += 1; peak = Math.max(peak, active)
    await new Promise((resolve) => setImmediate(resolve))
    active -= 1
  })
  assert.equal(ROOM_CONCURRENCY, 3)
  assert.equal(peak, 3)
})

test('twenty percent room failures marks the run failed', () => {
  assert.equal(isRunFailure(57, 11), false)
  assert.equal(isRunFailure(57, 12), true)
})
```

Also assert 10 unique minute rows remain 10 after `dedupeRows`, while an identical primary key is collapsed once.

- [ ] **Step 2: Run RED**

Run `npm run test:unit`; expect module-not-found for `core.js`.

- [ ] **Step 3: Implement `core.js` minimally**

Use `BACKFILL_MS = 10 * 60 * 1000`, `ROOM_CONCURRENCY = 3`, clamp invalid/old cursors to `nowMs - BACKFILL_MS`, implement a shared-index worker pool for concurrency, use `Math.ceil(total * 0.20)` for run failure, and dedupe by `ma_phong|loai_cam_bien|thoi_diem`.

- [ ] **Step 4: Bring in and verify the backup Edge source**

Compare `/home/admin1/BMS/supabase/functions/capnhat-phut-8h/index.ts` against the verified backup checksum/archive provenance already recorded. Add it to the worktree without copying secrets. Preserve auth headers, room mapping, minute timestamp normalization, upsert and cleanup behavior.

- [ ] **Step 5: Integrate claim before the first FMS call**

Call `rpc_claim_capnhat_phut_8h` before `rpc_phong_sensor_theo_doi_8h` and before FMS login. For every `SKIPPED_*`, return HTTP 200 with `{ok:true,status}` and make zero FMS requests.

- [ ] **Step 6: Clamp and limit FMS work**

Use one fixed `nowMs` per run. Replace each room cursor with `clampFromIso(info.from, nowMs)`, convert it to the existing VN query format, and process room entries through `mapWithConcurrency(..., 3, worker)`. Count room failures instead of swallowing them.

- [ ] **Step 7: Finish every claimed run**

Wrap claimed work in `try/catch/finally`. Successful and degraded runs call finish with `p_ok=true`; global or `>=20%` room failure calls finish with `p_ok=false` and a bounded error string. Never return from a claimed path without attempting finish. The original request timeout remains bounded.

- [ ] **Step 8: Run GREEN and commit**

Run `npm run test:unit`; expect all core tests PASS.

```bash
git add -f supabase/functions/capnhat-phut-8h/core.js supabase/functions/capnhat-phut-8h/index.ts
git add web/test/pressure-edge-core.test.mjs
git commit -m "feat: bound on-demand FMS pressure collection"
```

---

### Task 4: React/Supabase Integration

**Files:**
- Modify: `web/src/lib/supabaseData.js`
- Modify: `web/src/features/pressure/ChenhApTheoAhu.jsx`
- Create: `web/test/pressure-component-contract.test.mjs`

**Interfaces:**
- Consumes Task 1 session controller and Task 2 RPC names.
- Produces `chamNguoiXemChenhAp(viewerId, signal)`, `dungXemChenhAp(viewerId, signal)` and extended `capNhatPhut8h(signal)` status.

- [ ] **Step 1: Write failing integration contract tests**

Create a source contract test that reads `ChenhApTheoAhu.jsx` and asserts:

```js
assert.doesNotMatch(source, /180000|setInterval\(kichEdge/)
assert.match(source, /createPressureViewerSession/)
assert.match(source, /visibilitychange/)
assert.match(source, /60000/)
assert.match(source, /Đang tải 10 phút gần nhất/)
```

Read `supabaseData.js` and assert it references `rpc_cham_nguoi_xem_chenh_ap`, `rpc_dung_xem_chenh_ap`, and preserves `SKIPPED_NO_VIEWER`, `SKIPPED_FRESH`, `SKIPPED_LOCKED`, `SKIPPED_COOLDOWN` from Edge JSON.

- [ ] **Step 2: Run RED**

Run `npm run test:unit`; expect contract failures for the current timer/client code.

- [ ] **Step 3: Add Supabase wrappers**

Implement heartbeat/release through `goiRPC`. Validate `viewerId` is non-empty. Return normalized `{ok,status,error}` without throwing so cleanup remains best-effort. Extend `capNhatPhut8h` to return Edge `status`, counts and error without treating valid `SKIPPED_*` as failures.

- [ ] **Step 4: Integrate Page Visibility and session lifecycle**

In `ChenhApTheoAhu.jsx`:

- initialize one viewer UUID in `useRef`;
- track `document.visibilityState`, subscribe/unsubscribe `visibilitychange`;
- compute active viewer with `isLive`, component `active`, and visibility;
- create one session controller wired to heartbeat, release and immediate `capNhatPhut8h`;
- call `setActive()` on state transitions and `dispose()` on unmount;
- keep `docSo()` immediate, Realtime debounce 1.2 seconds and local age clock 10 seconds only while visible;
- change the RPC fallback from 20 seconds to 60 seconds;
- remove `nap`, the 180-second Edge interval and any repeated browser FMS timer.

- [ ] **Step 5: Update truthful UI states**

Show “Đang tải 10 phút gần nhất…” only for the first immediate request. Hidden mode must retain the last values but show no “đang cập nhật”. Keep existing five-minute calculation labels where they describe the RPC calculation; do not relabel a five-minute average as a ten-minute average.

- [ ] **Step 6: Run GREEN and focused build**

Run:

```bash
npm run test:unit
npm run check:copy
npm run build
```

Expected: all PASS on Node 24; build may retain the existing non-blocking chunk-size warning.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/supabaseData.js web/src/features/pressure/ChenhApTheoAhu.jsx web/test/pressure-component-contract.test.mjs
git commit -m "feat: load pressure data only while viewed"
```

---

### Task 5: CI Gate, Regression and Independent Review

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes all Tasks 1–4.
- Produces a CI gate that cannot deploy Pages when pressure unit/contract tests fail.

- [ ] **Step 1: Add a failing workflow contract assertion**

Extend `pressure-component-contract.test.mjs` to read `.github/workflows/deploy.yml` and require `npm run test:unit` before `npm run test:ui`.

- [ ] **Step 2: Run RED**

Run `npm run test:unit`; expect the workflow assertion to fail.

- [ ] **Step 3: Add the CI unit-test step**

Add this step after `npm ci` and before UI gates:

```yaml
      - name: Unit tests — Chênh áp theo người xem
        run: npm run test:unit
```

- [ ] **Step 4: Run full local verification**

Run with Node 24:

```bash
git diff --check
python3 kiem_tra/kiem_import.py
cd web
npm run test:unit
npm run check:colors
npm run check:copy
npm run check:contrast
npm run build
npm run test:ui
```

Record exact pass/fail counts and warnings. Do not claim success if Puppeteer/Chrome is unavailable; install the pinned browser or report the blocker.

- [ ] **Step 5: Independent high-risk review**

Dispatch a reviewer separate from implementers using `gpt-5.6-sol`. Review SQL authorization, atomic claim/finish, 90-second TTL/lease races, failure backoff, FMS concurrency, 10-minute clamp, rollback order and client visibility cleanup. Primary agent must inspect every finding and every resulting diff.

- [ ] **Step 6: Apply review fixes and rerun verification**

For each accepted finding, add a failing regression test before the fix. Repeat the entire Step 4 suite after the final diff.

- [ ] **Step 7: Commit CI/review changes**

```bash
git add .github/workflows/deploy.yml web/test
git commit -m "ci: test pressure viewer gate before deploy"
```

---

### Task 6: Production Rollout and GitHub Pages Deployment

**Files:**
- No new source files; uses the reviewed commits and rollback file.

**Interfaces:**
- Consumes verified migration, Edge Function and web commits.
- Produces production database/Edge behavior plus GitHub Pages deployment.

- [ ] **Step 1: Obtain explicit final deployment confirmation**

Show the user the target Supabase project ref in masked form, GitHub repo `tienhoandhd-droid/bms-gmp-web`, branch/commit list, migration name and rollback command. Do not continue without confirmation because the prior deployment request was identified as referring to the wrong repo.

- [ ] **Step 2: Read-only preflight**

Verify GitHub auth/repo permission, remote `main` head, clean branch, Supabase project link, production DB version, current Edge version, cron schedule and GitHub Actions secrets presence without printing secret values.

- [ ] **Step 3: Apply database migration first**

Apply only `20260827a_chenh_ap_theo_nguoi_xem.sql` using the approved Supabase production workflow. Verify read-only:

- RPC signatures/grants;
- viewer and ingest tables/RLS;
- cron remains `* * * * *`;
- with no viewer, `kich_capnhat_phut_8h()` queues no FMS Edge request.

- [ ] **Step 4: Deploy Edge Function second**

Deploy `capnhat-phut-8h` to the confirmed project without changing secrets. Exercise read-only/controlled calls:

- no viewer returns `SKIPPED_NO_VIEWER` and zero FMS work;
- two concurrent requests produce at most one `CLAIMED`;
- no raw secret/error body is returned.

- [ ] **Step 5: Push reviewed commits and deploy web last**

Integrate the reviewed feature branch into `main` using the selected branch-finishing workflow, push `main`, then monitor GitHub Actions `Deploy web GitHub Pages` to completion. Do not force-push.

- [ ] **Step 6: Production smoke checks**

Verify:

1. No pressure viewer for two cron ticks gives zero pressure-path FMS calls.
2. Open visible pressure tab loads at most 10 minutes and receives a new minute sample.
3. Open five tabs and confirm at most one FMS run/minute.
4. Hide all tabs and confirm active viewer count reaches zero and FMS stops within 90 seconds.
5. Reopen outside 05:00–21:00 and confirm demand load works.
6. GitHub Pages shows the reviewed commit and no runtime errors.

- [ ] **Step 7: Roll back on failed acceptance**

If the DB/Edge gate fails, stop cron, deploy the prior Edge revision, run the reviewed rollback SQL, then restore cron. If only web fails, redeploy the prior Pages commit while leaving the safer server gate in place. Report exactly what was rolled back and whether data remained recoverable.
