import { defineConfig } from 'vite'
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
        .filter((f) => f !== 'sw.js' && !/^assets\/(charts|SoDoLuatCard|AuditLogPage|main)-/.test(f))
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
    // index.html: network-first — bản deploy mới ăn ngay; offline rơi về cache
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return r })
        // ignoreSearch: 'index.html?tab=…' phải khớp bản precache khi offline.
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
    )
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

// base './' để asset dùng đường dẫn tương đối → chạy đúng dù repo đặt ở
// https://<user>.github.io/<repo>/ mà không cần biết tên repo.
export default defineConfig({
  base: './',
  plugins: [react(), swPrecachePlugin()],
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
