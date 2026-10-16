import test from 'node:test'
import assert from 'node:assert/strict'

import { parseEmailIncidentSearch, scrubEmailActionSearch, theoDoiPhienEmail, chonNutTheoIntent } from '../src/lib/emailIncident.js'

test('parses a valid tokenless incident locator and intent', () => {
  assert.deepEqual(parseEmailIncidentSearch('?incident=9223372036854775807&intent=receive'), {
    kind: 'incident', incidentId: '9223372036854775807', intent: 'receive',
  })
})

test('token link remains the authority when token and incident are both present', () => {
  assert.deepEqual(parseEmailIncidentSearch('?token=legacy-secret&incident=7&intent=update'), {
    kind: 'token', token: 'legacy-secret',
  })
})

test('scrubs mixed locator fields whenever the legacy token wins', () => {
  assert.equal(scrubEmailActionSearch('?token=legacy&incident=7&intent=update&x=1', true), 'x=1')
})

test('deferred initial session cannot restore an account after auth event or cleanup', async () => {
  let resolveInitial
  let listener
  let unsubscribed = false
  const events = []
  const auth = {
    onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() { unsubscribed = true } } } } },
    getSession() { return new Promise((resolve) => { resolveInitial = resolve }) },
  }
  const stop = theoDoiPhienEmail(auth, (session) => events.push(session?.user?.email || null))
  listener('SIGNED_IN', { user: { email: 'new@example.test' } })
  resolveInitial({ data: { session: { user: { email: 'old@example.test' } } } })
  await Promise.resolve()
  assert.deepEqual(events, ['new@example.test'])
  stop()
  assert.equal(unsubscribed, true)
})

test('deferred initial session cannot restore an account after sign out', async () => {
  let resolveInitial
  let listener
  const events = []
  const auth = {
    onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() {} } } } },
    getSession() { return new Promise((resolve) => { resolveInitial = resolve }) },
  }
  theoDoiPhienEmail(auth, (session) => events.push(session?.user?.email || null))
  listener('SIGNED_OUT', null)
  resolveInitial({ data: { session: { user: { email: 'old@example.test' } } } })
  await Promise.resolve()
  assert.deepEqual(events, [null])
})

test('rejects invalid incident ids and intents without treating URL data as authority', () => {
  for (const search of ['?incident=0&intent=view', '?incident=01&intent=view', '?incident=9223372036854775808&intent=view', '?incident=abc&intent=view', '?incident=12&intent=close']) {
    assert.equal(parseEmailIncidentSearch(search).kind, 'invalid')
  }
})

test('receive preselects only a matching receive action, while update makes the user choose', () => {
  const actions = [
    { code: 'mep_xu_ly_xong', label: 'Đã xử lý xong' },
    { code: 'mep_tiep_nhan', label: 'Cơ điện tiếp nhận' },
    { code: 'mep_nhan_xet', label: 'Nhận xét' },
  ]
  assert.equal(chonNutTheoIntent(actions, 'receive')?.code, 'mep_tiep_nhan')
  assert.equal(chonNutTheoIntent(actions, 'update'), null)
})
