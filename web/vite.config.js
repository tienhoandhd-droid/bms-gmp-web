import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, sep } from 'node:path'
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

// ============================================================
// Service worker precache — vì sao cần: GitHub Pages trả cache-control
// max-age=600 cho MỌI file (kể cả asset đã hash tên) → hôm sau vào lại,
// trình duyệt phải revalidate từng file qua mạng. SW cache asset theo tên
// hash (bất biến) ⇒ lần vào thứ 2 trở đi mở gần như tức thì, kể cả offline.
//  • Precache: html + css + js lõi + logo. KHÔNG precache charts-*.js
//    (247KB gzip) — giữ chiến lược "chỉ tải charts khi cần"; charts được
//    cache LÚC DÙNG qua nhánh runtime cache-first bên dưới.
//  • HTML: network-first → deploy bản mới vẫn ăn ngay như trước.
//  • CACHE version đổi theo danh sách file + nội dung html ⇒ deploy mới
//    = SW mới = xoá sạch cache phiên bản cũ (không phình bộ nhớ máy user).
// ============================================================
function swPrecachePlugin() {
  return {
    name: 'bms-sw-precache',
    apply: 'build',
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      const files = []
      const walk = (dir) => {
        for (const f of readdirSync(dir)) {
          const p = resolve(dir, f)
          if (statSync(p).isDirectory()) walk(p)
          else files.push(p.slice(dist.length + 1).split(sep).join('/'))
        }
      }
      walk(dist)
      const precache = files
        // Chỉ precache LÕI DÙNG CHUNG (react/supabase/vendor/css/html/logo…).
        // KHÔNG precache: chunk lazy (charts, SoDoLuatCard, AuditLogPage) VÀ
        // main-* (chỉ dashboard dùng, 78KB gzip) — vì action.html cũng đăng ký
        // SW: người chỉ bấm nút email (điện thoại/4G) không phải tải phần
        // dashboard. Các chunk bị loại vẫn được cache LÚC DÙNG (cache-first).
        .filter((f) => f !== 'sw.js' && !/^assets\/(charts|SoDoLuatCard|SoDoVongDoi|AuditLogPage|main)-/.test(f))
        .sort()
      const h = createHash('sha1').update(precache.join('\n'))
      for (const f of precache) if (f.endsWith('.html')) h.update(readFileSync(resolve(dist, f)))
      const version = h.digest('hex').slice(0, 12)
      const sw = `// Tự sinh bởi swPrecachePlugin (vite.config.js) — ĐỪNG sửa tay.
const CACHE = 'bms-${version}'
const PRECACHE = ${JSON.stringify(precache.map((f) => './' + f))}
// KHÔNG skipWaiting/claim: SW mới chỉ tiếp quản khi user đóng hết tab —
// tab cũ đang mở giữ nguyên cache cũ (asset cũ đã bị Pages xoá sau deploy,
// nếu xoá cache ngay thì tab cũ bấm sang tab Xu hướng sẽ vỡ 404).
// HTML network-first nên reload vẫn nhận bản mới ngay, không chờ SW mới.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return // Supabase/API: không đụng
  if (req.mode === 'navigate') {
    if (url.pathname.endsWith('/action.html')) {
      // action.html: CACHE-FIRST + cập nhật nền — nút email mở TỨC THÌ kể cả
      // mạng yếu, và miễn nhiễm cửa sổ ~10' sau deploy (HTML cũ trên CDN trỏ
      // asset đã xoá — bản cache luôn ĐỒNG BỘ với asset trong cùng CACHE).
      // Trang là công cụ thao tác, dữ liệu vé lấy qua API nên HTML cũ 1 nhịp
      // deploy không sao; bản mới theo SW mới trong ≤~10'.
      e.respondWith(
        caches.match('./action.html').then((hit) => {
          const nap = fetch(req)
            .then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put('./action.html', cp)) } return r })
            .catch(() => hit)
          return hit || nap
        })
      )
      return
    }
    // index.html: network-first CÓ TIMEOUT 2.5s — mạng khỏe thì bản deploy mới ăn
    // ngay như trước; mạng YẾU (chậm nhưng không rớt) thì mở NGAY từ cache thay vì
    // màn hình trắng chờ mạng vô hạn (15/07: mở app trên điện thoại rất chậm).
    // Bản mạng về muộn vẫn được ghi cache; banner "có bản mới — Tải lại" lo phần
    // cập nhật, nên phục vụ cache trước KHÔNG làm người dùng kẹt bản cũ.
    e.respondWith((async () => {
      const nap = fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r })
      const som = await Promise.race([
        nap.catch(() => null),
        new Promise((res) => setTimeout(() => res(null), 2500)),
      ])
      if (som) return som
      // ignoreSearch: 'index.html?tab=…' phải khớp bản precache khi offline.
      const hit = (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./index.html'))
      return hit || nap   // lần đầu tiên mở app (chưa có cache) thì đành chờ mạng
    })())
    return
  }
  if (url.pathname.includes('/assets/')) {
    // Asset tên đã hash = bất biến: cache-first (charts được cache lúc dùng)
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => {
        if (r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)) }
        return r
      }))
    )
  }
})
`
      writeFileSync(resolve(dist, 'sw.js'), sw)
      console.log(`  sw.js: precache ${precache.length} file · version ${version}`)
    },
  }
}

// ============================================================
// Content-Security-Policy (đợt A 04/09/2026) — vì sao cần: GitHub Pages không cho đặt
// HTTP header, nên CSP phải đi bằng <meta http-equiv>. Token phiên Supabase nằm trong
// localStorage; CSP là lớp chặn tối thiểu để script lạ (XSS) không chạy/không gửi được
// dữ liệu ra ngoài. Chạy ở closeBundle vì phải băm NỘI DUNG CUỐI của các <script>
// inline (Vite đã thay %VITE_…% lúc này) — hash sha256 đổi theo từng bản build.
//  • script-src: 'self' + hash từng script inline (không 'unsafe-inline').
//  • style-src: 'unsafe-inline' — React/ECharts/xyflow gắn style trực tiếp lên phần tử.
//  • connect-src: Supabase (https + wss) + n8n webhook + VITE_CSP_CONNECT_THEM (tuỳ chọn).
//  • Cửa sổ in (window.open về about:blank) KẾ THỪA CSP này ⇒ hoSoCum.js/TrendPage.jsx
//    đã bỏ script/onclick inline, gắn sự kiện từ trang mẹ.
//  • frame-ancestors/report-uri bị bỏ qua trong meta theo chuẩn — không đặt.
// ============================================================
const N8N_ORIGIN = 'https://n8n.cpc1hn.com'   // máy chủ webhook (AGENTS.md) — thêm host khác qua VITE_CSP_CONNECT_THEM
function cspMetaPlugin() {
  let env = {}
  return {
    name: 'bms-csp-meta',
    apply: 'build',
    configResolved(cfg) { env = loadEnv(cfg.mode, cfg.envDir || process.cwd(), 'VITE_') },
    closeBundle() {
      const dist = resolve(__dirname, 'dist')
      const connect = new Set(["'self'"])
      const su = (env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
      if (/^https:\/\//.test(su)) {
        const origin = new URL(su).origin
        connect.add(origin); connect.add(origin.replace(/^https:/, 'wss:'))
      }
      connect.add(N8N_ORIGIN)
      for (const o of (env.VITE_CSP_CONNECT_THEM || process.env.VITE_CSP_CONNECT_THEM || '').split(/\s+/)) if (/^(https|wss):\/\//.test(o)) connect.add(o)
      for (const f of readdirSync(dist).filter((x) => x.endsWith('.html'))) {
        const p = resolve(dist, f)
        let html = readFileSync(p, 'utf8')
        if (html.includes('http-equiv="Content-Security-Policy"')) continue
        const hashes = []
        for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
          hashes.push(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
        }
        const csp = [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "form-action 'self'",
          `script-src 'self' ${hashes.join(' ')}`.trim(),
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          `connect-src ${[...connect].join(' ')}`,
          "worker-src 'self'",
          "manifest-src 'self'",
        ].join('; ')
        // Đặt ngay sau <meta charset> — CSP meta phải đứng trước mọi script để có hiệu lực với chúng.
        html = html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
        writeFileSync(p, html)
        console.log(`  csp: ${f} · ${hashes.length} script inline · connect-src ${[...connect].filter((x) => x !== "'self'").join(' ') || '(chỉ self)'}`)
      }
    },
  }
}

// base './' để asset dùng đường dẫn tương đối → chạy đúng dù repo đặt ở
// https://<user>.github.io/<repo>/ mà không cần biết tên repo.
export default defineConfig({
  base: './',
  // cspMetaPlugin đứng TRƯỚC swPrecachePlugin: SW băm nội dung html cuối (đã có CSP) để đặt version cache.
  plugins: [react(), cspMetaPlugin(), swPrecachePlugin()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Tách thư viện nặng thành chunk riêng:
    //  • Tải SONG SONG (nhanh hơn 1 cục lớn).
    //  • Khi deploy bản mới CHỈ phần code app đổi hash → recharts/react/... giữ
    //    nguyên trong cache trình duyệt → người dùng vào lại gần như tức thì.
    rollupOptions: {
      // 2 entry: dashboard đầy đủ (index) + trang thao tác từ email siêu nhẹ (action).
      // action.html KHÔNG import App/dashboard/charts → email deep-link vào đây chỉ tải
      // react+supabase+~10KB code thay vì cả app; bấm nhiều nút không lag.
      input: {
        main: resolve(__dirname, 'index.html'),
        action: resolve(__dirname, 'action.html'),
        // Trang đặt lại mật khẩu từ email khôi phục — siêu nhẹ như action.
        datlai: resolve(__dirname, 'datlai.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('lucide-react')) return 'icons'
          // Recharts + phụ thuộc (d3…): KHÔNG ép chunk riêng. Chúng chỉ được
          // import động qua src/components/charts.jsx (React.lazy) → trả undefined
          // để Rollup tự gộp vào chunk ASYNC của module đó → KHÔNG tải ở màn hình
          // đầu, chỉ tải khi mở tab Xu hướng / modal phòng.
          if (
            id.includes('echarts') || id.includes('zrender') ||
            id.includes('recharts') || id.includes('victory-vendor') ||
            id.includes('d3-') || id.includes('internmap') ||
            id.includes('decimal.js') || id.includes('robust-predicates') ||
            // @xyflow/react: chỉ SoDoLuatCard (React.lazy) dùng — ép vào 'vendor'
            // sẽ dính modulepreload ở màn hình đầu (+37KB gzip đo trên live 11/07).
            // Trả undefined để Rollup gộp vào chunk ASYNC của SoDoLuatCard.
            id.includes('@xyflow') || id.includes('xyflow')
          ) return
          if (id.includes('@supabase') || id.includes('supabase')) return 'supabase'
          if (id.includes('react-dom') || id.includes('scheduler') || /[\\/]react[\\/]/.test(id)) return 'react'
          return 'vendor'
        },
      },
    },
  },
})
