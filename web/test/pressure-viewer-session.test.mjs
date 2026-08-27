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

test('deactivation while touch is pending prevents update and releases after touch settles', async () => {
  const calls = []
  let resolveTouch
  const touch = new Promise((resolve) => { resolveTouch = resolve })
  const session = createPressureViewerSession({
    viewerId: '00000000-0000-4000-8000-000000000003',
    touch: async () => { calls.push('touch'); return touch },
    release: async () => { calls.push('release') },
    requestUpdate: async () => { calls.push('update') },
    setTimer: () => 13,
    clearTimer: (id) => calls.push(`clear:${id}`),
  })

  const activation = session.setActive(true)
  await Promise.resolve()
  const deactivation = session.setActive(false)
  resolveTouch()
  await Promise.all([activation, deactivation])

  assert.deepEqual(calls, ['touch', 'release'])
})

test('unsuccessful activation touch does not request an update or heartbeat', async () => {
  const calls = []
  const session = createPressureViewerSession({
    viewerId: '00000000-0000-4000-8000-000000000006',
    touch: async () => { calls.push('touch'); return { ok: false, error: 'CHUA_DANG_NHAP' } },
    release: async () => { calls.push('release') },
    requestUpdate: async () => { calls.push('update') },
    setTimer: () => { calls.push('timer'); return 19 },
    clearTimer: (id) => calls.push(`clear:${id}`),
  })

  await session.setActive(true)
  assert.deepEqual(calls, ['touch'])
})

test('unsuccessful heartbeat touch schedules a later retry', async () => {
  const calls = []
  const timers = []
  let touchCount = 0
  const session = createPressureViewerSession({
    viewerId: '00000000-0000-4000-8000-000000000007',
    touch: async () => {
      touchCount += 1
      calls.push('touch')
      return touchCount === 1 ? { ok: true } : { ok: false }
    },
    release: async () => {},
    requestUpdate: async () => { calls.push('update') },
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length },
    clearTimer: () => {},
  })

  await session.setActive(true)
  await timers.shift().fn()

  assert.deepEqual(calls, ['touch', 'update', 'touch'])
  assert.equal(timers.length, 1)
  assert.equal(timers[0].ms, PRESSURE_HEARTBEAT_MS)
})

test('repeated transitions and dispose are idempotent', async () => {
  const calls = []
  const session = createPressureViewerSession({
    viewerId: '00000000-0000-4000-8000-000000000004',
    touch: async () => { calls.push('touch') },
    release: async () => { calls.push('release') },
    requestUpdate: async () => { calls.push('update') },
    setTimer: () => 17,
    clearTimer: (id) => calls.push(`clear:${id}`),
  })

  await session.setActive(true)
  await session.setActive(true)
  await session.setActive(false)
  await session.setActive(false)
  session.dispose()
  session.dispose()

  assert.deepEqual(calls, ['touch', 'update', 'clear:17', 'release'])
})

test('createPressureViewerId returns a UUID from the injected crypto API', () => {
  const cryptoApi = { randomUUID: () => '00000000-0000-4000-8000-000000000005' }
  assert.equal(createPressureViewerId(cryptoApi), cryptoApi.randomUUID())
})
