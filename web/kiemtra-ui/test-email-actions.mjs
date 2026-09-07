// Browser contract test for incident.html links. It starts a local Vite
// server and intercepts every fake Supabase request; it never contacts Supabase
// or sends email.  Run: node kiemtra-ui/test-email-actions.mjs
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import puppeteer from 'puppeteer'

const ROOT = new URL('..', import.meta.url).pathname
const PORT = Number(process.env.BMS_EMAIL_ACTION_PORT || 4195)
const BASE = `http://127.0.0.1:${PORT}`
const SB = 'https://supabase.browser-fixture.invalid'
const EMAIL = 'mep@example.test'
const ARTIFACT_DIR = process.env.BMS_EMAIL_ACTION_ARTIFACT_DIR || ''
const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: 'fixture-user', email: EMAIL, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`
const failures = []
let passed = 0
const ok = (name) => { passed++; console.log(`  ✓ ${name}`) }
const check = (condition, name, detail = '') => condition ? ok(name) : failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
const submit = (page) => page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Xác nhận và ghi nhận')?.click())
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'apikey,authorization,content-type,x-app,x-client-info,x-supabase-api-version' }
const json = (request, body, status = 200) => request.respond({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) })

function fixture(overrides = {}) {
  return {
    role: 'MEP', reads: [], requests: [], incident: { ma_su_co: 123, ma_hien_thi: 'SC-123', phong: 'C1.R7', ten_phong: 'Phòng pha chế', khu_vuc: 'C1', ahu: 'AHU-1', trang_thai: 'DA_BAO_CO_DIEN', nhan_trang_thai: 'Đã báo cơ điện', thao_tac_gan_nhat: 'IPC đã báo cơ điện' },
    actions: [
      { hanh_dong: 'mep_tiep_nhan', nhan: 'Cơ điện: đã nhận', vai_tro: 'MEP', trang_thai_truoc: 'DA_BAO_CO_DIEN', trang_thai_sau: 'CO_DIEN_DANG_XU_LY', ap_dung_khi: 'MO', thu_tu: 1, bat_buoc_ly_do: false },
      { hanh_dong: 'mep_xu_ly_xong', nhan: 'Cơ điện: đã khắc phục', vai_tro: 'MEP', trang_thai_truoc: 'DA_BAO_CO_DIEN', trang_thai_sau: 'DA_KHAC_PHUC', ap_dung_khi: 'MO', thu_tu: 2, bat_buoc_ly_do: true },
    ], writes: [], networkFail: false, ...overrides,
  }
}

async function chromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
  if (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return puppeteer.executablePath()
}

async function attachFixture(page, state) {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === BASE || url.protocol === 'data:' || url.protocol === 'blob:') return request.continue()
    if (url.origin !== SB) return request.abort('blockedbyclient')
    state.requests.push(`${request.method()} ${url.href}`)
    // Chromium rejects a synthetic 204 response that carries a body/content
    // metadata.  A body-less 200 is an equally valid CORS preflight response.
    if (request.method() === 'OPTIONS') return request.respond({ status: 200, headers: { ...CORS, 'access-control-allow-headers': request.headers()['access-control-request-headers'] || CORS['access-control-allow-headers'] }, body: '' })
    if (url.pathname === '/auth/v1/token') return json(request, { access_token: token, refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'fixture-user', email: EMAIL } })
    if (url.pathname === '/rest/v1/nguoi_dung') { state.reads.push(url.href); return json(request, state.role ? [{ vai_tro: state.role, kich_hoat: true }] : []) }
    if (url.pathname === '/rest/v1/xem_su_co_dang_mo') { state.reads.push(url.href); return json(request, state.incident ? [state.incident] : []) }
    if (url.pathname === '/rest/v1/xem_nut_thao_tac') { state.reads.push(url.href); return json(request, state.actions) }
    if (url.pathname === '/rest/v1/rpc/rpc_thao_tac_su_co') {
      state.writes.push({ method: request.method(), body: JSON.parse(request.postData() || '{}') })
      if (state.networkFail) return request.abort('failed')
      return json(request, { ok: true, thong_bao: 'Fixture đã ghi nhận.' })
    }
    return json(request, { message: `Unexpected fixture endpoint ${url.pathname}` }, 404)
  })
}

async function login(page, intent, state, expectError = false, checkReload = true, entry = 'incident.html') {
  await page.goto(`${BASE}/${entry}?incident=123&intent=${intent}`, { waitUntil: 'networkidle2' })
  check(state.reads.length === 0 && state.writes.length === 0, `chưa đăng nhập intent=${intent} không đọc/ghi phiếu`)
  await page.type('#tt-email', EMAIL)
  await page.type('#tt-mat-khau', 'fixture-password')
  await page.click('button[type="submit"]')
  try { await page.waitForFunction(() => document.body.innerText.includes('SC-123') || document.querySelector('[role="alert"]'), { timeout: 10000 }) }
  catch { throw new Error(`login timed out: ${await page.evaluate(() => document.body.innerText.slice(0, 500))}; requests=${state.requests.join(' | ')}`) }
  if (!expectError && !(await page.evaluate(() => document.body.innerText.includes('SC-123')))) throw new Error(`login fixture did not load incident: ${await page.evaluate(() => document.body.innerText.slice(0, 500))}; reads=${state.reads.join(' | ')}`)
  check(page.url().endsWith(`/${entry}?incident=123&intent=${intent}`), `login giữ nguyên URL intent=${intent}`, page.url())
  if (!checkReload) {
    if (!expectError) check(state.reads.some((url) => /xem_su_co_dang_mo/.test(url) && new URL(url).searchParams.get('ma_su_co') === 'eq.123'), `đọc đúng sự cố #123 intent=${intent}`, state.reads.join(' | '))
    return state
  }
  await page.reload({ waitUntil: 'networkidle2' })
  check(page.url().endsWith(`/${entry}?incident=123&intent=${intent}`), `F5 giữ nguyên URL intent=${intent}`, page.url())
  if (await page.$('#tt-email')) {
    await page.type('#tt-email', EMAIL); await page.type('#tt-mat-khau', 'fixture-password'); await page.click('button[type="submit"]')
    await page.waitForFunction(() => document.body.innerText.includes('SC-123') || document.querySelector('[role="alert"]'), { timeout: 10000 })
    if (!expectError && !(await page.evaluate(() => document.body.innerText.includes('SC-123')))) throw new Error(`login after F5 did not load incident: ${await page.evaluate(() => document.body.innerText.slice(0, 500))}; reads=${state.reads.join(' | ')}`)
  }
  if (!expectError) check(state.reads.some((url) => /xem_su_co_dang_mo/.test(url) && new URL(url).searchParams.get('ma_su_co') === 'eq.123'), `đọc đúng sự cố #123 intent=${intent}`, state.reads.join(' | '))
  return state
}

async function freshPage(browser, state) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await attachFixture(page, state)
  return { context, page }
}

async function run() {
  if (ARTIFACT_DIR) mkdirSync(ARTIFACT_DIR, { recursive: true })
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, env: { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_ANON_KEY: 'fixture-anon-key' }, stdio: 'ignore',
  })
  let browser
  try {
    await delay(1200)
    browser = await puppeteer.launch({ executablePath: await chromePath(), headless: 'new', args: ['--no-sandbox'] })

    // Exact id, login continuation, receive selection, and an explicit-only mutation.
    { const state = fixture(); const { context, page } = await freshPage(browser, state)
      await login(page, 'receive', state)
      check(await page.$eval('input[name="incident-action"]:checked', (e) => e.value) === 'mep_tiep_nhan', 'receive chọn sẵn nút nhận việc')
      check(state.writes.length === 0, 'mở / đăng nhập / F5 không ghi dữ liệu')
      await page.click('input[type="checkbox"]')
      await Promise.all([page.waitForFunction(() => document.body.innerText.includes('Fixture đã ghi nhận.'), { timeout: 5000 }), submit(page)])
      check(state.writes.length === 1, 'xác nhận receive tạo đúng một RPC', JSON.stringify(state.writes))
      check(JSON.stringify(state.writes[0].body) === JSON.stringify({ p_ma_su_co: '123', p_hanh_dong: 'mep_tiep_nhan', p_ly_do: null, p_actor: EMAIL, p_nguon: 'web_email' }), 'RPC receive có payload đúng')
      check(await page.$eval('input[name="incident-action"]', (e) => e.disabled) && await page.$eval('#incident-reason', (e) => e.disabled), 'thành công khóa lại dữ liệu đã xác nhận')
      await context.close()
    }

    // Update must not silently choose a state-changing action; note+confirm gate required.
    { const state = fixture(); const { context, page } = await freshPage(browser, state)
      await login(page, 'update', state)
      check(await page.$('input[name="incident-action"]:checked') === null, 'update không có thao tác mặc định')
      check(state.writes.length === 0, 'update chưa xác nhận không ghi')
      await page.click('input[value="mep_xu_ly_xong"]')
      const button = await page.$('button[type="button"]')
      check(await button.evaluate((b) => b.disabled), 'ghi chú bắt buộc khóa nút xác nhận')
      await page.type('#incident-reason', 'Đã điều chỉnh van và kiểm tra lại.')
      await page.click('input[type="checkbox"]')
      await submit(page)
      await page.waitForFunction(() => document.body.innerText.includes('Fixture đã ghi nhận.'), { timeout: 5000 })
      check(state.writes.length === 1 && state.writes[0].body.p_hanh_dong === 'mep_xu_ly_xong', 'update chỉ ghi sau chọn, ghi chú và xác nhận')
      await context.close()
    }

    // Read-only and unavailable records must never expose a write path.
    { const state = fixture(); const { context, page } = await freshPage(browser, state)
      await login(page, 'view', state)
      check(await page.$('input[name="incident-action"]') === null && await page.$('button[type="button"]') === null, 'view không hiện nút ghi')
      check(state.writes.length === 0, 'view không gửi RPC')
      await context.close()
    }
    { const state = fixture(); const { context, page } = await freshPage(browser, state)
      await login(page, 'receive', state, false, false, 'action.html')
      check(await page.$('input[name="incident-action"]:checked') !== null && state.writes.length === 0, 'action.html tương thích: mở phiếu sau đăng nhập, không tự ghi')
      await context.close()
    }
    for (const [name, state] of [['role', fixture({ role: null })], ['scope/missing/closed', fixture({ incident: null })]]) {
      const { context, page } = await freshPage(browser, state)
      await login(page, 'receive', state, true)
      check(await page.$('[role="alert"]') !== null && state.writes.length === 0, `${name}: lỗi có role=alert, không có ghi`)
      await context.close()
    }
    { const state = fixture(); const { context, page } = await freshPage(browser, state)
      await page.goto(`${BASE}/incident.html?incident=0&intent=receive`, { waitUntil: 'networkidle2' })
      await page.type('#tt-email', EMAIL); await page.type('#tt-mat-khau', 'fixture-password'); await page.click('button[type="submit"]'); await delay(400)
      check(await page.$('[role="alert"]') !== null && state.writes.length === 0, 'ID không hợp lệ báo lỗi và không ghi')
      await context.close()
    }

    // A network-ambiguous POST remains one request and locks the page until reload.
    { const state = fixture({ networkFail: true }); const { context, page } = await freshPage(browser, state)
      await login(page, 'receive', state); await page.click('input[type="checkbox"]')
      await Promise.all([submit(page), submit(page)])
      await page.waitForFunction(() => document.body.innerText.includes('Không xác định được kết quả'), { timeout: 5000 })
      check(state.writes.length === 1, 'double-click và lỗi mơ hồ vẫn chỉ một RPC', String(state.writes.length))
      check(await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Xác nhận và ghi nhận').every((b) => b.disabled)), 'lỗi mơ hồ khóa thao tác đến khi F5')
      check(await page.$eval('input[name="incident-action"]', (e) => e.disabled) && await page.$eval('#incident-reason', (e) => e.disabled), 'lỗi mơ hồ khóa dữ liệu xác nhận')
      await context.close()
    }

    // Small screens must not horizontally overflow and basic controls must remain keyboard reachable.
    for (const width of [390, 768, 1440]) { const state = fixture(); const { context, page } = await freshPage(browser, state)
      await page.setViewport({ width, height: 900 }); await login(page, 'receive', state, false, false)
      if (ARTIFACT_DIR && (width === 390 || width === 768)) await page.screenshot({ path: join(ARTIFACT_DIR, `receive-${width}.png`), fullPage: true })
      const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth, minButton: Math.min(...[...document.querySelectorAll('button')].map((b) => b.getBoundingClientRect().height)) }))
      check(!metrics.overflow, `${width}px không tràn ngang`, JSON.stringify(metrics))
      check(metrics.minButton >= 44, `${width}px nút tối thiểu 44px`, JSON.stringify(metrics))
      await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      check(await page.evaluate(() => ['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(document.activeElement.tagName)), `${width}px điều khiển nhận focus bàn phím`)
      await context.close()
    }
  } finally {
    await browser?.close(); vite.kill()
  }
}

await run().catch((error) => failures.push(`browser exception: ${error.stack || error}`))
if (failures.length) console.log(`✗ email actions — ${failures.length} lỗi / ${passed} đạt\n${failures.map((x) => `  ❌ ${x}`).join('\n')}`)
else console.log(`✓ email actions — ${passed} bước đạt; toàn bộ Supabase là fixture bị intercept`)
process.exit(failures.length ? 1 : 0)
