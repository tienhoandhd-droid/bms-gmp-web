import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/lib/emailIncidentData.js', import.meta.url), 'utf8')

async function loadDataApi({ rows = {}, rpc = { data: { ok: true }, error: null } } = {}) {
  const calls = []
  globalThis.__emailIncidentDocView = async (name, build) => {
    const query = {
      select(value) { calls.push({ name, method: 'select', value }); return this },
      eq(column, value) { calls.push({ name, method: 'eq', column, value }); return this },
      limit(value) { calls.push({ name, method: 'limit', value }); return this },
    }
    build(query)
    return { data: rows[name] || [], error: null }
  }
  globalThis.__emailIncidentGoiRpc = async (...args) => { calls.push({ name: 'rpc', args }); return rpc }
  globalThis.__emailIncidentLayNut = async () => ({ rows: [], error: null })
  const injected = source
    .replace("import { docView, goiRPC } from './bmsClient'", 'const { docView, goiRPC } = { docView: globalThis.__emailIncidentDocView, goiRPC: globalThis.__emailIncidentGoiRpc }')
    .replace("import { layNutThaoTac } from './supabaseData'", 'const layNutThaoTac = globalThis.__emailIncidentLayNut')
  const api = await import(`data:text/javascript;base64,${Buffer.from(injected).toString('base64')}#${Math.random()}`)
  return { api, calls }
}

test('reads fresh active role and exact scoped open incident through query builders', async () => {
  const { api, calls } = await loadDataApi({ rows: { nguoi_dung: [{ vai_tro: 'MEP' }], xem_su_co_dang_mo: [{ ma_su_co: 123 }] } })
  const result = await api.taiDuLieuSuCoEmail({ email: 'mep@example.test', incidentId: '123', intent: 'receive' })
  assert.equal(result.roleResult.role, 'MEP')
  assert.equal(result.incidentResult.incident.ma_su_co, 123)
  assert.deepEqual(calls.filter((call) => call.name === 'nguoi_dung' && call.method === 'eq').map(({ column, value }) => [column, value]), [['email', 'mep@example.test'], ['kich_hoat', true]])
  assert.deepEqual(calls.filter((call) => call.name === 'xem_su_co_dang_mo' && call.method === 'eq').map(({ column, value }) => [column, value]), [['ma_su_co', '123']])
  assert.ok(calls.some((call) => call.name === 'xem_su_co_dang_mo' && call.method === 'limit' && call.value === 1))
})

test('falls back to closed scoped view only for readonly intent', async () => {
  const { api, calls } = await loadDataApi({ rows: { xem_su_co_dong_gan_day: [{ ma_su_co: 123 }] } })
  const view = await api.taiDuLieuSuCoEmail({ email: 'mep@example.test', incidentId: '123', intent: 'view' })
  assert.equal(view.closed, true)
  assert.equal(view.incidentResult.incident.ma_su_co, 123)
  const { api: updateApi, calls: updateCalls } = await loadDataApi({ rows: { xem_su_co_dong_gan_day: [{ ma_su_co: 123 }] } })
  const update = await updateApi.taiDuLieuSuCoEmail({ email: 'mep@example.test', incidentId: '123', intent: 'update' })
  assert.equal(update.closed, false)
  assert.equal(update.incidentResult.incident, null)
  assert.ok(calls.some((call) => call.name === 'xem_su_co_dong_gan_day'))
  assert.equal(updateCalls.some((call) => call.name === 'xem_su_co_dong_gan_day'), false)
})

test('submits the locked incident RPC once without retry', async () => {
  const { api, calls } = await loadDataApi()
  await api.guiThaoTacSuCoEmail({ incidentId: '123', actionCode: 'mep_tiep_nhan', lyDo: '', actorEmail: 'mep@example.test' })
  const [, payload, options] = calls.find((call) => call.name === 'rpc').args
  assert.deepEqual(payload, { p_ma_su_co: '123', p_hanh_dong: 'mep_tiep_nhan', p_ly_do: null, p_actor: 'mep@example.test', p_nguon: 'web_email' })
  assert.equal(options.soLanThu, 1)
})
