import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKFILL_MS, ROOM_CONCURRENCY, clampFromIso,
  dedupeRows, isRunFailure, mapWithConcurrency,
} from '../../supabase/functions/capnhat-phut-8h/core.js'

let edgeHandler
globalThis.Deno = {
  env: {
    get(name) {
      return {
        SUPABASE_URL: 'https://supabase.invalid',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-value',
        FMS_BASE_URL: 'https://fms.invalid',
        FMS_USERNAME: 'fms-test-user',
        FMS_PASSWORD: 'fms-test-password',
        BMS_TOKEN: 'bms-test-token',
      }[name]
    },
  },
  serve(handler) {
    edgeHandler = handler
  },
}
const edgeModule = await import('../../supabase/functions/capnhat-phut-8h/index.ts')

function edgeRequest() {
  return new Request('https://edge.invalid/capnhat-phut-8h', {
    method: 'POST',
    headers: { 'x-bms-token': 'bms-test-token' },
  })
}

test('old cursor is clamped to ten minutes', () => {
  const now = Date.parse('2026-08-27T05:30:00.000Z')
  assert.equal(BACKFILL_MS, 600_000)
  assert.equal(clampFromIso('2026-08-27T04:00:00.000Z', now), '2026-08-27T05:20:00.000Z')
  assert.equal(clampFromIso('2026-08-27T05:27:00.000Z', now), '2026-08-27T05:27:00.000Z')
})

test('room worker never exceeds three concurrent requests', async () => {
  let active = 0, peak = 0
  await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], ROOM_CONCURRENCY, async () => {
    active += 1
    peak = Math.max(peak, active)
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

test('dedupe keeps unique minute rows and collapses an identical primary key once', () => {
  const rows = Array.from({ length: 10 }, (_, minute) => ({
    ma_phong: 'P-01',
    loai_cam_bien: 'DP',
    thoi_diem: `2026-08-27T05:${String(minute).padStart(2, '0')}:00.000Z`,
    gia_tri: minute,
  }))
  const duplicate = { ...rows[4], gia_tri: 999 }

  const unique = dedupeRows([...rows, duplicate])

  assert.equal(unique.length, 10)
  assert.deepEqual(unique[4], rows[4])
})

test('every skipped claim returns before any FMS request', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  for (const status of [
    'SKIPPED_NO_VIEWER',
    'SKIPPED_FRESH',
    'SKIPPED_LOCKED',
    'SKIPPED_COOLDOWN',
  ]) {
    let fmsCalls = 0
    let listCalls = 0
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/rpc/rpc_claim_capnhat_phut_8h')) {
        return Response.json({ ok: true, status })
      }
      if (url.endsWith('/rpc/rpc_phong_sensor_theo_doi_8h')) {
        listCalls += 1
        return Response.json([{
          ma_phong: 'P-01', loai_cam_bien: 'DP',
          gioi_han_duoi: -5, gioi_han_tren: 15,
          tu_thoi_diem: '2026-08-27T05:20:00.000Z',
        }])
      }
      if (url.startsWith('https://fms.invalid')) {
        fmsCalls += 1
        return new Response('', { status: 503 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }

    const response = await edgeHandler(edgeRequest())
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.status, status)
    assert.equal(listCalls, 0)
    assert.equal(fmsCalls, 0)
  }
})

test('a claimed run attempts finish once when FMS login fails', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let finishCalls = 0
  let finishBody

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/rpc/rpc_claim_capnhat_phut_8h')) {
      return Response.json({ ok: true, status: 'CLAIMED', token: '11111111-1111-4111-8111-111111111111' })
    }
    if (url.endsWith('/rpc/rpc_phong_sensor_theo_doi_8h')) {
      return Response.json([{
        ma_phong: 'P-01', loai_cam_bien: 'DP',
        gioi_han_duoi: -5, gioi_han_tren: 15,
        tu_thoi_diem: '2026-08-27T05:20:00.000Z',
      }])
    }
    if (url.endsWith('/rpc/rpc_finish_capnhat_phut_8h')) {
      finishCalls += 1
      finishBody = JSON.parse(init.body)
      return Response.json({ ok: true, status: 'FAILED' })
    }
    if (url === 'https://fms.invalid/auth/login') {
      return new Response('', { status: 503 })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 502)
  assert.equal(body.ok, false)
  assert.equal(body.status, 'FAILED')
  assert.equal(finishCalls, 1)
  assert.deepEqual(finishBody, {
    p_token: '11111111-1111-4111-8111-111111111111',
    p_ok: false,
    p_error: 'FMS login 503',
    p_degraded: false,
  })
})

test('a claimed run deadline aborts stalled work and still attempts finish', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let finishCalls = 0
  let runSignal
  let finishSignal

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/rpc/rpc_claim_capnhat_phut_8h')) {
      return Response.json({ ok: true, status: 'CLAIMED', token: '22222222-2222-4222-8222-222222222222' })
    }
    if (url.endsWith('/rpc/rpc_phong_sensor_theo_doi_8h')) {
      runSignal = init.signal
      return new Promise((resolve, reject) => {
        runSignal.addEventListener('abort', () => reject(runSignal.reason), { once: true })
      })
    }
    if (url.endsWith('/rpc/rpc_finish_capnhat_phut_8h')) {
      finishCalls += 1
      finishSignal = init.signal
      return Response.json({ ok: true, status: 'FAILED' })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }

  const timeoutHandler = edgeModule.createHandler({ runTimeoutMs: 5, finishTimeoutMs: 100 })
  const response = await timeoutHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 500)
  assert.equal(body.ok, false)
  assert.equal(body.status, 'FAILED')
  assert.equal(runSignal.aborted, true)
  assert.equal(finishSignal.aborted, false)
  assert.notEqual(finishSignal, runSignal)
  assert.equal(finishCalls, 1)
})

test('room failure ratio wires degraded and failed finish states at the boundary', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })

  for (const scenario of [
    { rooms: 6, status: 'DEGRADED', httpStatus: 200, ok: true, degraded: true },
    { rooms: 5, status: 'FAILED', httpStatus: 502, ok: false, degraded: false },
  ]) {
    const list = Array.from({ length: scenario.rooms }, (_, index) => ({
      ma_phong: `P-${index}`,
      loai_cam_bien: 'DP',
      gioi_han_duoi: -5,
      gioi_han_tren: 15,
      tu_thoi_diem: '2026-08-27T05:20:00.000Z',
    }))
    let finishBody

    globalThis.fetch = async (input, init) => {
      const url = String(input)
      if (url.endsWith('/rpc/rpc_claim_capnhat_phut_8h')) {
        return Response.json({ ok: true, status: 'CLAIMED', token: '33333333-3333-4333-8333-333333333333' })
      }
      if (url.endsWith('/rpc/rpc_phong_sensor_theo_doi_8h')) return Response.json(list)
      if (url === 'https://fms.invalid/auth/login') {
        return Response.json({ data: { access_token: 'fms-access-test-value' } })
      }
      if (url === 'https://fms.invalid/bms-room/rooms') {
        return Response.json({
          data: list.map((room, index) => ({ id: room.ma_phong, _id: `TECH-${index}` })),
        })
      }
      if (url.includes('/bms-room/rooms/TECH-0/sensors-data')) {
        return new Response('', { status: 503 })
      }
      if (url.includes('/sensors-data')) return Response.json({ data: { sensors: [] } })
      if (url.endsWith('/rpc/rpc_don_du_lieu_phut_8h')) return Response.json({ ok: true })
      if (url.endsWith('/rpc/rpc_finish_capnhat_phut_8h')) {
        finishBody = JSON.parse(init.body)
        return Response.json({ ok: true, status: scenario.status })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }

    const response = await edgeHandler(edgeRequest())
    const body = await response.json()

    assert.equal(response.status, scenario.httpStatus)
    assert.equal(body.ok, scenario.ok)
    assert.equal(body.status, scenario.status)
    assert.equal(body.so_phong, scenario.rooms)
    assert.equal(body.so_diem, 0)
    assert.equal(body.so_loi_phong, 1)
    assert.deepEqual(finishBody, {
      p_token: '33333333-3333-4333-8333-333333333333',
      p_ok: scenario.ok,
      p_error: 'P-0: sensor-data 503',
      p_degraded: scenario.degraded,
    })
  }
})

test('a rejected finish is surfaced after an otherwise successful empty run', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let finishCalls = 0

  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url.endsWith('/rpc/rpc_claim_capnhat_phut_8h')) {
      return Response.json({ ok: true, status: 'CLAIMED', token: '44444444-4444-4444-8444-444444444444' })
    }
    if (url.endsWith('/rpc/rpc_phong_sensor_theo_doi_8h')) return Response.json([])
    if (url.endsWith('/rpc/rpc_finish_capnhat_phut_8h')) {
      finishCalls += 1
      return Response.json({ ok: false, status: 'REJECTED_TOKEN' })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 500)
  assert.equal(body.ok, false)
  assert.equal(body.status, 'FINISH_FAILED')
  assert.equal(body.so_phong, 0)
  assert.equal(body.so_diem, 0)
  assert.equal(body.so_loi_phong, 0)
  assert.equal(finishCalls, 1)
})
