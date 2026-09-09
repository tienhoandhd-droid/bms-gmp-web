import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import esbuild from 'esbuild'
import puppeteer from 'puppeteer'

const entry = String.raw`
  import React from 'react'
  import { createRoot } from 'react-dom/client'
  import { useLiveData } from '../src/hooks/useLiveData.js'

  const root = createRoot(document.getElementById('root'))
  function Harness({ account, interval }) {
    const live = useLiveData('live', { phienId: account, tuDongMoiMs: interval })
    window.__manual = live.lamMoi
    return <pre id="state">{JSON.stringify({ rooms: live.rooms, incidents: live.incidents, actions: live.nutThaoTac })}</pre>
  }
  window.__interval = 2000
  window.__renderAccount = (account) => root.render(<Harness account={account} interval={window.__interval} />)
  window.__setAuto = (interval) => { window.__interval = interval; window.__renderAccount(window.__account) }
  window.__renderAccount('old')
`

const bmsClientStub = String.raw`
  let authListener
  export const supabase = {
    auth: {
      getSession: () => new Promise((resolve) => setTimeout(() => resolve({ data: { session: {} } }), 60)),
      onAuthStateChange: (listener) => {
        authListener = listener
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  }
  window.__auth = (event = 'TOKEN_REFRESHED') => authListener?.(event, { user: { id: window.__account } })
`

const dataStub = String.raw`
  window.__counts = { snapshot: 0, sensors: 0, incidents: 0, assigned: 0, clusters: 0, recent: 0 }
  window.__account = 'old'
  let realtimeListener
  let roomResolver
  const incidentResolvers = []
  const actionResolvers = []
  const okRows = async () => ({ rows: [] })
  export const layTongQuan = async () => { window.__counts.snapshot++; return { kpis: { account: window.__account } } }
  export const laySuCoDangMo = async () => {
    window.__counts.incidents++
    if (window.__deferIncidents) return new Promise((resolve) => incidentResolvers.push(resolve))
    return { incidents: [{ account: window.__account }] }
  }
  export const layCanhBaoHeThong = async () => ({ alerts: [] })
  export const layLichSuCauHinh = okRows
  export const layDanhSachPhong = async () => {
    if (window.__holdRooms) return new Promise((resolve) => { roomResolver = () => resolve({ rooms: [{ id: window.__account, sensors: [] }] }) })
    return { rooms: [{ id: window.__account, sensors: [] }] }
  }
  export const layThongKeSensorPhong = async () => ({ sensors: [] })
  export const layThongKeSensorNhieuPhong = async () => { window.__counts.sensors++; return { theoPhong: {} } }
  export const layXepHangRuiRo = okRows
  export const layQuyTrinhSop = okRows
  export const layBaoCaoAi = okRows
  export const layNguongCanhBao = async () => ({ cfg: {} })
  export const layCoBatBuocDangNhap = async () => ({ batBuoc: false })
  export const laySucKhoeHeThong = async () => ({ suc_khoe: {} })
  export const layPhanTichGmp = async () => ({ mkt: [], spc: [] })
  export const layNutThaoTac = async () => {
    if (window.__deferActions) return new Promise((resolve) => actionResolvers.push(resolve))
    return { rows: [{ account: window.__account }] }
  }
  export const laySuCoPhuTrach = async () => { window.__counts.assigned++; return { rows: [] } }
  export const layCumSuCo = async () => { window.__counts.clusters++; return { rows: [] } }
  export const laySuCoDongGanDay = async () => { window.__counts.recent++; return { rows: [] } }
  export const dangKyRealtimeSuCo = (listener) => { realtimeListener = listener; return () => {} }
  window.__realtime = () => realtimeListener?.()
  window.__releaseRooms = () => roomResolver?.()
  window.__incidentPending = () => incidentResolvers.length
  window.__resolveIncident = (index, account) => incidentResolvers[index]?.({ incidents: [{ account }] })
  window.__actionPending = () => actionResolvers.length
  window.__resolveAction = (index, account) => actionResolvers[index]?.({ rows: [{ account }] })
`

test('real hook coordinates hourly, visibility, auth, realtime, manual and account refreshes', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'bms-hourly-hook-'))
  const bundle = join(temp, 'fixture.js')
  t.after(() => rm(temp, { recursive: true, force: true }))
  await esbuild.build({
    stdin: { contents: entry, resolveDir: new URL('.', import.meta.url).pathname, loader: 'jsx' },
    outfile: bundle,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    plugins: [{
      name: 'supabase-stubs',
      setup(build) {
        build.onResolve({ filter: /lib\/bmsClient$/ }, () => ({ path: 'bms-client', namespace: 'stub' }))
        build.onResolve({ filter: /lib\/supabaseData$/ }, () => ({ path: 'supabase-data', namespace: 'stub' }))
        build.onLoad({ filter: /bms-client/, namespace: 'stub' }, () => ({ contents: bmsClientStub, loader: 'js' }))
        build.onLoad({ filter: /supabase-data/, namespace: 'stub' }, () => ({ contents: dataStub, loader: 'js' }))
      },
    }],
  })

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  t.after(() => browser.close())
  const page = await browser.newPage()
  page.setDefaultTimeout(5000)
  await page.setContent('<div id="root"></div>')
  await page.evaluate(() => {
    window.__visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visibility })
    window.__timerCalls = 0
    const nativeSetTimeout = window.setTimeout
    window.setTimeout = (...args) => { window.__timerCalls += 1; return nativeSetTimeout(...args) }
  })
  await page.addScriptTag({ path: bundle })
  await page.waitForFunction(() => window.__counts?.sensors === 1)
  const initialCounts = await page.evaluate(() => ({ ...window.__counts }))
  await new Promise((resolve) => setTimeout(resolve, 80))
  await page.evaluate(() => {
    window.__visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    window.__visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    window.__auth()
  })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(await page.evaluate(() => window.__counts.snapshot), 1, 'visibility/auth before deadline must share the guard')
  assert.ok(await page.evaluate((before) => window.__counts.incidents > before.incidents, initialCounts), 'becoming visible must catch up incident views without waiting an hour')

  const beforeRealtime = await page.evaluate(() => ({ ...window.__counts }))
  await page.evaluate(() => window.__realtime())
  await page.waitForFunction((before) => window.__counts.incidents > before.incidents, {}, beforeRealtime)
  const afterRealtime = await page.evaluate(() => ({ ...window.__counts }))
  assert.equal(afterRealtime.sensors, beforeRealtime.sensors, 'incident realtime must not reload measurements')
  assert.ok(afterRealtime.assigned > beforeRealtime.assigned && afterRealtime.clusters > beforeRealtime.clusters && afterRealtime.recent > beforeRealtime.recent)

  await page.waitForFunction(() => window.__counts.snapshot >= 2, { timeout: 1000 })
  const afterDeadline = await page.evaluate(() => ({ snapshot: window.__counts.snapshot, timers: window.__timerCalls, visibility: document.visibilityState }))
  assert.ok(afterDeadline.snapshot >= 2, `snapshot must run when one interval has elapsed from initial load: ${JSON.stringify(afterDeadline)}`)

  await page.evaluate(() => window.__manual())
  await page.waitForFunction(() => window.__counts.sensors === 2)

  const timersBeforeHidden = await page.evaluate(() => {
    window.__visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    return window.__timerCalls
  })
  await new Promise((resolve) => setTimeout(resolve, 2100))
  assert.ok(await page.evaluate((before) => window.__timerCalls - before < 10, timersBeforeHidden), 'hidden overdue tab must not spin a hot timer loop')
  const snapshotsWhileHidden = await page.evaluate(() => window.__counts.snapshot)
  await page.evaluate(() => {
    window.__visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForFunction((before) => window.__counts.snapshot > before, {}, snapshotsWhileHidden)

  await page.evaluate(() => window.__setAuto(0))
  await new Promise((resolve) => setTimeout(resolve, 100))
  await page.evaluate(() => {
    window.__deferIncidents = true
    window.__manual()
  })
  await page.waitForFunction(() => window.__incidentPending() === 1)
  await page.evaluate(() => window.__realtime())
  await page.waitForFunction(() => window.__incidentPending() === 2)
  await page.evaluate(() => window.__resolveIncident(1, 'newer-realtime'))
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).incidents?.[0]?.account === 'newer-realtime')
  await page.evaluate(() => window.__resolveIncident(0, 'older-snapshot'))
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(await page.$eval('#state', (node) => JSON.parse(node.textContent).incidents[0].account), 'newer-realtime', 'late full snapshot must not overwrite a newer incident refresh')

  await page.evaluate(() => {
    window.__deferIncidents = false
    window.__setAuto(2000)
  })
  await new Promise((resolve) => setTimeout(resolve, 100))
  await page.evaluate(() => {
    window.__deferActions = true
    window.__auth('TOKEN_REFRESHED')
  })
  await page.waitForFunction(() => window.__actionPending() === 1)
  await page.evaluate(() => {
    window.__holdRooms = true
    window.__account = 'new'
    window.__renderAccount('new')
  })
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).rooms === null)
  assert.equal(await page.$eval('#state', (node) => JSON.parse(node.textContent).rooms), null, 'old account rooms must disappear immediately')
  const beforeAccountAuth = await page.evaluate(() => window.__counts.snapshot)
  await page.evaluate(() => window.__auth('SIGNED_IN'))
  await page.waitForFunction((before) => window.__counts.snapshot > before, {}, beforeAccountAuth)
  await page.waitForFunction(() => window.__actionPending() === 3)
  await page.evaluate(() => window.__resolveAction(2, 'new'))
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).actions?.[0]?.account === 'new')
  await page.evaluate(() => window.__resolveAction(0, 'old'))
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(await page.$eval('#state', (node) => JSON.parse(node.textContent).actions[0].account), 'new', 'late permission rules from the old account must be ignored')
  await page.evaluate(() => window.__releaseRooms())
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).rooms?.[0]?.id === 'new')
  // Auth can arrive before the profile changes phienId; the profile change itself must load.
  await page.evaluate(() => { window.__holdRooms = false; window.__deferActions = false; window.__account = 'third'; window.__auth('SIGNED_IN') })
  await new Promise(resolve => setTimeout(resolve, 30))
  await page.evaluate(() => window.__renderAccount('third'))
  await page.waitForFunction(() => JSON.parse(document.getElementById('state').textContent).rooms?.[0]?.id === 'third', {timeout:1000})
})
