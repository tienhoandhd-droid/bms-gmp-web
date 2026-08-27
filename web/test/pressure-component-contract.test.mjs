import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync(
  new URL('../src/features/pressure/ChenhApTheoAhu.jsx', import.meta.url),
  'utf8',
)
const data = readFileSync(
  new URL('../src/lib/supabaseData.js', import.meta.url),
  'utf8',
)
const workflow = readFileSync(
  new URL('../../.github/workflows/deploy.yml', import.meta.url),
  'utf8',
)

async function taiPressureData(t, { goiRPC, fetchImpl }) {
  const previousGlobals = Object.fromEntries([
    '__pressureDocView',
    '__pressureGoiRpc',
    '__pressureSupabase',
    '__pressureSupabaseUrl',
  ].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  globalThis.__pressureDocView = async () => ({ data: [], error: null })
  globalThis.__pressureGoiRpc = goiRPC
  globalThis.__pressureSupabase = null
  globalThis.__pressureSupabaseUrl = 'https://supabase.test'
  const source = data
    .replace(
      "import { docView, goiRPC, supabase } from './bmsClient'",
      'const docView = globalThis.__pressureDocView; const goiRPC = globalThis.__pressureGoiRpc; const supabase = globalThis.__pressureSupabase',
    )
    .replace(
      "import { SUPABASE_URL } from './config'",
      'const SUPABASE_URL = globalThis.__pressureSupabaseUrl',
    )
  const previousFetch = globalThis.fetch
  globalThis.fetch = fetchImpl
  t.after(() => {
    globalThis.fetch = previousFetch
    for (const [key, descriptor] of Object.entries(previousGlobals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Math.random()}`)
}

function choDenKhiHuy(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}

test('pressure tab opens an active-viewer session and reads only while visible', () => {
  assert.match(component, /createPressureViewerSession/)
  assert.match(component, /createPressureViewerId/)
  assert.match(component, /isPressureViewerActive/)
  assert.match(component, /visibilitychange/)
  assert.match(component, /60000/)
  assert.match(component, /Đang tải 10 phút gần nhất/)
  assert.doesNotMatch(component, /180000|setInterval\(kichEdge/)
  assert.doesNotMatch(component, /const nap\b/)
})

test('pressure API client keeps viewer RPCs and normalized skipped Edge statuses', () => {
  assert.match(data, /rpc_cham_nguoi_xem_chenh_ap/)
  assert.match(data, /rpc_dung_xem_chenh_ap/)
  assert.match(data, /SKIPPED_NO_VIEWER/)
  assert.match(data, /SKIPPED_FRESH/)
  assert.match(data, /SKIPPED_LOCKED/)
  assert.match(data, /SKIPPED_COOLDOWN/)
})

test('pressure Edge deadline also aborts token retrieval with a caller signal', async (t) => {
  let tokenSignal
  let fetchCalls = 0
  const api = await taiPressureData(t, {
    goiRPC: async (name, _params, { signal }) => {
      assert.equal(name, 'rpc_lay_webhook_token')
      tokenSignal = signal
      return choDenKhiHuy(signal)
    },
    fetchImpl: async () => { fetchCalls += 1; throw new Error('fetch must not start') },
  })
  assert.equal(typeof api.taoSignalHan, 'function')

  const caller = new AbortController()
  const result = await api.capNhatPhut8h(caller.signal, { timeoutMs: 5 })

  assert.equal(result.error, 'ABORT')
  assert.equal(caller.signal.aborted, false)
  assert.notEqual(tokenSignal, caller.signal)
  assert.equal(tokenSignal.aborted, true)
  assert.equal(fetchCalls, 0)
})

test('pressure Edge treats a skipped claim as a successful no-op', async (t) => {
  const api = await taiPressureData(t, {
    goiRPC: async () => ({ data: 'webhook-token', error: null }),
    fetchImpl: async () => Response.json({ ok: false, status: 'SKIPPED_FRESH', so_phong: 0, so_diem: 0, so_loi_phong: 0 }),
  })

  const result = await api.capNhatPhut8h(undefined, { timeoutMs: 50 })

  assert.deepEqual(result, {
    ok: true, status: 'SKIPPED_FRESH', soPhong: 0, soDiem: 0, soLoiPhong: 0, error: null,
  })
})

test('pressure viewer wrapper is fail-soft when the RPC client throws', async (t) => {
  const api = await taiPressureData(t, {
    goiRPC: async () => { throw new Error('offline') },
    fetchImpl: async () => { throw new Error('not used') },
  })

  const result = await api.chamNguoiXemChenhAp('00000000-0000-4000-8000-000000000001')

  assert.deepEqual(result, { ok: false, status: null, error: 'Error' })
})

test('deploy workflow runs unit tests before UI tests', () => {
  const installIndex = workflow.indexOf('- run: npm ci')
  const unitIndex = workflow.indexOf('run: npm run test:unit')
  const uiIndex = workflow.indexOf('run: |\n          npx puppeteer browsers install chrome\n          npm run test:ui')

  assert.notEqual(installIndex, -1, 'workflow must install dependencies with npm ci')
  assert.notEqual(unitIndex, -1, 'workflow must run the unit-test gate')
  assert.notEqual(uiIndex, -1, 'workflow must retain the UI-test gate')
  assert.ok(installIndex < unitIndex, 'unit tests must run after npm ci')
  assert.ok(unitIndex < uiIndex, 'unit tests must run before UI tests')
})
