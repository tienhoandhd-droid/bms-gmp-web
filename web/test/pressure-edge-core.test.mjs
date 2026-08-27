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

function monitoredRoom(maPhong) {
  return {
    ma_phong: maPhong,
    loai_cam_bien: 'DP',
    gioi_han_duoi: -5,
    gioi_han_tren: 15,
    tu_thoi_diem: '2026-08-27T05:20:00.000Z',
  }
}

function sensorPayload(points) {
  return {
    data: {
      sensors: [{
        type: 'DP',
        params: [{
          data: points.map(({ value, minute }) => ({
            val: value,
            dateAndTime: `2026-08-27 12:${String(minute).padStart(2, '0')}:00`,
          })),
        }],
      }],
    },
  }
}

function installEdgeScenario(t, {
  list,
  rooms,
  sensorPayloads,
  upsertFailure = null,
  nowMs = Date.parse('2026-08-27T05:30:00.000Z'),
}) {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  t.after(() => {
    globalThis.fetch = originalFetch
    Date.now = originalNow
  })
  Date.now = () => nowMs
  const state = { finishBody: null, upsertBodies: [] }

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/rpc/rpc_claim_capnhat_phut_8h')) {
      return Response.json({ ok: true, status: 'CLAIMED', token: '55555555-5555-4555-8555-555555555555' })
    }
    if (url.endsWith('/rpc/rpc_phong_sensor_theo_doi_8h')) return Response.json(list)
    if (url === 'https://fms.invalid/auth/login') {
      return Response.json({ data: { access_token: 'fms-access-test-value' } })
    }
    if (url === 'https://fms.invalid/bms-room/rooms') return Response.json({ data: rooms })
    for (const [techId, payload] of Object.entries(sensorPayloads)) {
      if (url.includes(`/bms-room/rooms/${techId}/sensors-data`)) return Response.json(payload)
    }
    if (url.startsWith('https://supabase.invalid/rest/v1/du_lieu_phut_8h')) {
      state.upsertBodies.push(JSON.parse(init.body))
      if (upsertFailure) {
        return new Response(upsertFailure.body, { status: upsertFailure.status })
      }
      return new Response('', { status: 201 })
    }
    if (url.endsWith('/rpc/rpc_don_du_lieu_phut_8h')) return Response.json({ ok: true })
    if (url.endsWith('/rpc/rpc_finish_capnhat_phut_8h')) {
      state.finishBody = JSON.parse(init.body)
      return Response.json({ ok: true, status: state.finishBody.p_ok ? 'FINISHED' : 'FAILED' })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }

  return state
}

test('old cursor is clamped to ten minutes', () => {
  const now = Date.parse('2026-08-27T05:30:00.000Z')
  assert.equal(BACKFILL_MS, 600_000)
  assert.equal(clampFromIso('2026-08-27T04:00:00.000Z', now), '2026-08-27T05:20:00.000Z')
  assert.equal(clampFromIso('2026-08-27T05:27:00.000Z', now), '2026-08-27T05:27:00.000Z')
})

test('future cursor recovers from the oldest ten-minute boundary', () => {
  const now = Date.parse('2026-08-27T05:30:00.000Z')
  assert.equal(clampFromIso('2026-08-27T06:00:00.000Z', now), '2026-08-27T05:20:00.000Z')
})

test('future sensor cursor keeps a valid point from the recovered ten-minute window', async (t) => {
  const state = installEdgeScenario(t, {
    list: [{
      ...monitoredRoom('P-FUTURE'),
      tu_thoi_diem: '2026-08-27T06:00:00.000Z',
    }],
    rooms: [{ id: 'P-FUTURE', _id: 'TECH-FUTURE' }],
    sensorPayloads: {
      'TECH-FUTURE': sensorPayload([{ value: 4.5, minute: 21 }]),
    },
  })

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.so_diem, 1)
  assert.equal(state.upsertBodies.length, 1)
  assert.deepEqual(state.upsertBodies[0].map((row) => row.thoi_diem), [
    '2026-08-27T05:21:00.000Z',
  ])
})

test('authentication rejects missing or wrong request tokens and fails closed when configured token is empty', async (t) => {
  const originalFetch = globalThis.fetch
  const originalGet = globalThis.Deno.env.get
  const originalServe = globalThis.Deno.serve
  t.after(() => {
    globalThis.fetch = originalFetch
    globalThis.Deno.env.get = originalGet
    globalThis.Deno.serve = originalServe
  })

  let fetchCalls = 0
  globalThis.fetch = async () => {
    fetchCalls += 1
    return Response.json({ ok: true, status: 'SKIPPED_NO_VIEWER' })
  }

  const missingTokenRequest = new Request('https://edge.invalid/capnhat-phut-8h', { method: 'POST' })
  const wrongTokenRequest = new Request('https://edge.invalid/capnhat-phut-8h', {
    method: 'POST',
    headers: { 'x-bms-token': 'wrong-token' },
  })
  for (const request of [missingTokenRequest, wrongTokenRequest]) {
    const response = await edgeHandler(request)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error, 'KHONG_XAC_THUC')
  }

  let emptyTokenHandler
  globalThis.Deno.env.get = (name) => name === 'BMS_TOKEN' ? '' : originalGet(name)
  globalThis.Deno.serve = (handler) => { emptyTokenHandler = handler }
  await import('../../supabase/functions/capnhat-phut-8h/index.ts?empty-bms-token')

  const emptyTokenResponse = await emptyTokenHandler(edgeRequest())
  assert.equal(emptyTokenResponse.status, 403)
  assert.equal((await emptyTokenResponse.json()).error, 'KHONG_XAC_THUC')
  assert.equal(fetchCalls, 0)
})

test('Supabase RPC failure body is not exposed in the response or finish error', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const sentinel = 'INTERNAL_RPC_SENTINEL'
  let finishBody

  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.endsWith('/rpc/rpc_claim_capnhat_phut_8h')) {
      return Response.json({ ok: true, status: 'CLAIMED', token: '66666666-6666-4666-8666-666666666666' })
    }
    if (url.endsWith('/rpc/rpc_phong_sensor_theo_doi_8h')) {
      return new Response(JSON.stringify({ message: sentinel }), { status: 500 })
    }
    if (url.endsWith('/rpc/rpc_finish_capnhat_phut_8h')) {
      finishBody = JSON.parse(init.body)
      return Response.json({ ok: true, status: 'FAILED' })
    }
    throw new Error(`unexpected fetch: ${url}`)
  }

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 500)
  assert.equal(body.error, 'RPC rpc_phong_sensor_theo_doi_8h 500')
  assert.equal(finishBody.p_error, 'RPC rpc_phong_sensor_theo_doi_8h 500')
  assert.equal(JSON.stringify(body).includes(sentinel), false)
  assert.equal(JSON.stringify(finishBody).includes(sentinel), false)
})

test('Supabase upsert failure body is not exposed in the response or finish error', async (t) => {
  const sentinel = 'INTERNAL_UPSERT_SENTINEL'
  const state = installEdgeScenario(t, {
    list: [monitoredRoom('P-UPSERT')],
    rooms: [{ id: 'P-UPSERT', _id: 'TECH-UPSERT' }],
    sensorPayloads: {
      'TECH-UPSERT': sensorPayload([{ value: 7.5, minute: 21 }]),
    },
    upsertFailure: {
      status: 500,
      body: JSON.stringify({ message: sentinel }),
    },
  })

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 500)
  assert.equal(body.error, 'upsert 500')
  assert.equal(state.finishBody.p_error, 'upsert 500')
  assert.equal(JSON.stringify(body).includes(sentinel), false)
  assert.equal(JSON.stringify(state.finishBody).includes(sentinel), false)
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

test('mixed finite and invalid FMS markers upsert only the finite room rows', async (t) => {
  const state = installEdgeScenario(t, {
    list: [monitoredRoom('P-MIXED')],
    rooms: [{ id: 'P-MIXED', _id: 'TECH-MIXED' }],
    sensorPayloads: {
      'TECH-MIXED': sensorPayload([
        { value: 1.5, minute: 21 },
        { value: null, minute: 22 },
        { value: undefined, minute: 23 },
        { value: '', minute: 24 },
        { value: '   ', minute: 25 },
        { value: 'NaN', minute: 26 },
        { value: 'Infinity', minute: 27 },
      ]),
    },
  })

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.status, 'FINISHED')
  assert.equal(body.so_phong, 1)
  assert.equal(body.so_diem, 1)
  assert.equal(body.so_loi_phong, 0)
  assert.equal(state.upsertBodies.length, 1)
  assert.deepEqual(state.upsertBodies[0], [{
    ma_phong: 'P-MIXED',
    loai_cam_bien: 'DP',
    thoi_diem: '2026-08-27T05:21:00.000Z',
    gia_tri: 1.5,
    gioi_han_duoi: -5,
    gioi_han_tren: 15,
    oos: false,
  }])
  assert.deepEqual(state.finishBody, {
    p_token: '55555555-5555-4555-8555-555555555555',
    p_ok: true,
    p_error: null,
    p_degraded: false,
  })
})

test('an all-invalid candidate window fails its room without upserting markers', async (t) => {
  const state = installEdgeScenario(t, {
    list: [monitoredRoom('P-INVALID')],
    rooms: [{ id: 'P-INVALID', _id: 'TECH-INVALID' }],
    sensorPayloads: {
      'TECH-INVALID': sensorPayload([
        { value: null, minute: 21 },
        { value: undefined, minute: 22 },
        { value: '', minute: 23 },
        { value: '   ', minute: 24 },
        { value: 'NaN', minute: 25 },
        { value: 'Infinity', minute: 26 },
      ]),
    },
  })

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 502)
  assert.equal(body.ok, false)
  assert.equal(body.status, 'FAILED')
  assert.equal(body.so_phong, 1)
  assert.equal(body.so_diem, 0)
  assert.equal(body.so_loi_phong, 1)
  assert.equal(state.upsertBodies.length, 0)
  assert.deepEqual(state.finishBody, {
    p_token: '55555555-5555-4555-8555-555555555555',
    p_ok: false,
    p_error: 'P-INVALID: giá trị sensor không hợp lệ',
    p_degraded: false,
  })
})

test('ten valid minute samples produce exactly ten finite upsert rows', async (t) => {
  const points = Array.from({ length: 10 }, (_, index) => ({
    value: index + 0.5,
    minute: 21 + index,
  }))
  const state = installEdgeScenario(t, {
    list: [monitoredRoom('P-10')],
    rooms: [{ id: 'P-10', _id: 'TECH-10' }],
    sensorPayloads: { 'TECH-10': sensorPayload(points) },
  })

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.status, 'FINISHED')
  assert.equal(body.so_diem, 10)
  assert.equal(body.so_loi_phong, 0)
  assert.equal(state.upsertBodies.length, 1)
  assert.equal(state.upsertBodies[0].length, 10)
  assert.equal(state.upsertBodies[0].every((row) => Number.isFinite(row.gia_tri)), true)
  assert.equal(new Set(state.upsertBodies[0].map((row) => row.thoi_diem)).size, 10)
  assert.deepEqual(state.finishBody, {
    p_token: '55555555-5555-4555-8555-555555555555',
    p_ok: true,
    p_error: null,
    p_degraded: false,
  })
})

test('aggregated room error passed to finish is bounded to one thousand characters', async (t) => {
  const list = Array.from({ length: 57 }, (_, index) => monitoredRoom(`PHONG-${index}`))
  const state = installEdgeScenario(t, { list, rooms: [], sensorPayloads: {} })

  const response = await edgeHandler(edgeRequest())
  const body = await response.json()

  assert.equal(response.status, 502)
  assert.equal(body.status, 'FAILED')
  assert.equal(body.so_loi_phong, 57)
  assert.equal(state.upsertBodies.length, 0)
  assert.equal(state.finishBody.p_error.length, 1000)
})
