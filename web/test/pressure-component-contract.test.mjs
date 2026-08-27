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
