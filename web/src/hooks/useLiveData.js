// ============================================================
// useLiveData.js — Gom dữ liệu Supabase cho mọi tab (v10.3, 2026)
// CẢI TIẾN hiệu năng & độ bền:
//  • Diệt N+1 "burst": làm giàu thống kê 8h từng phòng chạy theo LÔ giới hạn
//    đồng thời (mặc định 6) thay vì bắn N request cùng lúc.
//  • CACHE thống kê 8h có TTL (4') — dữ liệu giờ chỉ đổi mỗi giờ nên không
//    cần kéo lại mỗi nhịp 60s; nhịp tự động dùng lại cache, chỉ làm mới khi
//    quá hạn. Thao tác ghi (manual) ép làm mới ngay.
//  • HỦY request đang chờ khi unmount/đổi nguồn (AbortController) → tránh
//    race & cập nhật state sau khi component đã gỡ (rò rỉ).
//  • Poll tạm dừng khi tab ẩn (tiết kiệm tài nguyên).
// Interface KHÔNG đổi so với bản trước → App.jsx không cần sửa.
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/bmsClient'
import {
  layTongQuan, laySuCoDangMo, layCanhBaoHeThong, layLichSuCauHinh,
  layDanhSachPhong, layThongKeSensorPhong, layThongKeSensorNhieuPhong, layXepHangRuiRo, layQuyTrinhSop, layBaoCaoAi,
  layNguongCanhBao, layCoBatBuocDangNhap, laySucKhoeHeThong, layPhanTichGmp, layNutThaoTac, laySuCoPhuTrach, layCumSuCo, laySuCoDongGanDay, dangKyRealtimeSuCo,
} from '../lib/supabaseData'

const ENRICH_TTL_MS = 4 * 60 * 1000   // thống kê 8h chỉ đổi mỗi giờ → cache 4'
const SO_SONG = 6                      // số request thống kê phòng chạy đồng thời tối đa
// Dữ liệu tab phụ (cấu hình/rủi ro/SOP/AI/GMP) đổi CHẬM (mỗi giờ hoặc do
// job đêm). Ở nhịp tự động 60s KHÔNG cần kéo lại mỗi phút — chỉ làm mới khi quá
// hạn để giảm tải mạng & tránh giật. Lần nạp đầu và thao tác thủ công luôn kéo đủ.
const TIER2_TTL_MS = 5 * 60 * 1000

// Chạy fn trên từng phần tử nhưng giới hạn số chạy song song (chống burst).
async function chayTheoLo(items, fn, soSong = SO_SONG) {
  const out = new Array(items.length)
  let i = 0
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx) } }
  await Promise.all(Array.from({ length: Math.min(soSong, items.length) }, worker))
  return out
}

export function useLiveData(dataSource, { tuDongMoiMs = 60000, phienId = null, batDau = true } = {}) {
  const isLive = dataSource === 'live'
  // batDau=false ⇒ TẠM DỪNG mọi tải dữ liệu (dùng cho "chế độ thao tác nhẹ" khi mở web
  // từ nút trong email: chỉ soi vé + xác nhận, KHÔNG bung dashboard nặng). Khi người dùng
  // chủ động vào bảng điều khiển, batDau=true và các effect dưới tự nạp như thường.
  const dangBat = isLive && batDau
  // Bộ nút thao tác đọc từ view xem_nut_thao_tac (bảng luật = nguồn sự thật duy nhất).
  // Đổi rất hiếm (chỉ khi sửa quy trình) → nạp MỘT lần, không nằm trong nhịp 60s.
  // P0-2: null = CHƯA BIẾT bộ luật (đang tải hoặc lỗi) ⇒ giao diện phải khoá nút.
  //        [] = DB trả về rỗng thật. Không bao giờ rơi về bảng nút hard-code.
  const [nutThaoTac, setNutThaoTac] = useState(null)
  const [loiNut, setLoiNut] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [incidents, setIncidents] = useState(null)
  const [systemAlerts, setSystemAlerts] = useState(null)
  const [configHistory, setConfigHistory] = useState(null)
  const [rooms, setRooms] = useState(null)
  const [riskRows, setRiskRows] = useState(null)
  const [sopRows, setSopRows] = useState(null)
  const [aiRows, setAiRows] = useState(null)
  const [nguong, setNguong] = useState(null)
  const [sucKhoe, setSucKhoe] = useState(null)
  const [suCoPhuTrach, setSuCoPhuTrach] = useState(null)
  const [cumSuCo, setCumSuCo] = useState(null)
  const [suCoDongGanDay, setSuCoDongGanDay] = useState(null)
  const [gmpMkt, setGmpMkt] = useState(null)
  const [gmpSpc, setGmpSpc] = useState(null)
  const [batBuocDangNhap, setBatBuocDangNhap] = useState(false)
  const [dangTai, setDangTai] = useState(false)

  const [loi, setLoi] = useState(null)
  const [capNhatLuc, setCapNhatLuc] = useState(null)

  const huy = useRef(false)
  const ctrlRef = useRef(null)
  const cacheSensor = useRef({ luc: 0, theoPhong: {} })

  // ============================================================
  // P0-3 — RÒ DỮ LIỆU GIỮA HAI TÀI KHOẢN TRÊN CÙNG TRÌNH DUYỆT.
  // Hook này không hề gắn với danh tính người dùng: đăng xuất rồi đăng nhập tài
  // khoản khác, React giữ nguyên state cũ (phòng, sự cố, nhật ký của khu mà tài
  // khoản mới KHÔNG được xem) và vẽ ra ngay, trước khi lamMoi() kịp trả về.
  // Xoá state NGAY TRONG LÚC RENDER (không phải useEffect) để không có một khung
  // hình nào hiển thị dữ liệu của người trước. `theHe` để bỏ mọi phản hồi cũ.
  const phienRef = useRef(phienId)
  const theHe = useRef(0)
  if (phienRef.current !== phienId) {
    phienRef.current = phienId
    theHe.current += 1
    if (ctrlRef.current) ctrlRef.current.abort()
    setKpis(null); setIncidents(null); setSystemAlerts(null)
    setConfigHistory(null); setRooms(null); setRiskRows(null); setSopRows(null)
    // 17/08: bỏ setSuCoQuaHan — state đã xoá trong đợt bỏ SLA 17/07, gọi nữa là ReferenceError khi đổi tài khoản
    setAiRows(null); setSucKhoe(null); setCumSuCo(null); setSuCoDongGanDay(null); setGmpMkt(null); setGmpSpc(null)
    setLoi(null)
  }

  const tier2Luc = useRef(0)   // lần cuối nạp dữ liệu tab phụ (để bỏ qua trong TTL ở nhịp tự động)
  const lanNapLuc = useRef(0)  // lần lamMoi gần nhất — chặn INITIAL_SESSION nạp TRÙNG ngay sau mount (15/07)

  // Làm giàu phòng với thống kê 8h (cache + giới hạn đồng thời + abort)
  const lamGiauPhong = useCallback(async (ds, { batBuoc, signal }) => {
    const canTai = ds.filter((r) => !r.noData)
    const quaHan = Date.now() - cacheSensor.current.luc > ENRICH_TTL_MS
    const chuaCache = Object.keys(cacheSensor.current.theoPhong).length === 0
    if (batBuoc || quaHan || chuaCache) {
      // Ưu tiên BATCH 1 round-trip (diệt N+1: 1 request thay ~57). Nếu RPC batch
      // CHƯA deploy hoặc lỗi → tự lùi về per-phòng (hành vi cũ, đã kiểm chứng)
      // nên web CHẠY ĐÚNG dù migration đã áp hay chưa.
      const batch = await layThongKeSensorNhieuPhong(canTai.map((r) => r.id), signal)
      if (signal?.aborted) return ds
      let theoPhong = {}
      if (!batch.error && batch.theoPhong) {
        canTai.forEach((r) => { theoPhong[r.id] = batch.theoPhong[r.id] || cacheSensor.current.theoPhong[r.id] || [] })
      } else {
        const ket = await chayTheoLo(canTai, (r) => layThongKeSensorPhong(r.id, signal))
        if (signal?.aborted) return ds
        canTai.forEach((r, i) => { theoPhong[r.id] = (ket[i] && ket[i].sensors) || cacheSensor.current.theoPhong[r.id] || [] })
      }
      cacheSensor.current = { luc: Date.now(), theoPhong }
    }
    const theoPhong = cacheSensor.current.theoPhong
    return ds.map((room) => {
      if (room.noData) return room
      const live = theoPhong[room.id] || []
      const byK = {}
      live.forEach((s) => { byK[s.k] = s })
      const sensors = (room.sensors || []).map((s) => {
        const L = byK[s.k]
        return L ? { ...s, _live: { cur: L.cur, avg1h: L.avg1h, oos1h: L.oos1h, oos10: L.oos10, level: L.level, hourly8: L.hourly8 } } : s
      })
      live.forEach((L) => {
        if (!sensors.some((s) => s.k === L.k)) sensors.push({ k: L.k, min: L.min ?? null, max: L.max ?? null, _live: { cur: L.cur, avg1h: L.avg1h, oos1h: L.oos1h, oos10: L.oos10, level: L.level, hourly8: L.hourly8 } })
      })
      const hourlyOOS = []
      sensors.forEach((s) => (s._live?.hourly8 || []).forEach((h, i) => {
        if (!hourlyOOS[i]) hourlyOOS[i] = { label: h.label, oos: 0 }
        hourlyOOS[i].oos += h.oos || 0
      }))
      return { ...room, sensors, _hourlyOOS: hourlyOOS }
    })
  }, [])

  const lamMoi = useCallback(async ({ nen = false, tuDong = false } = {}) => {
    if (!dangBat) return
    // Hủy chu kỳ trước (nếu còn chờ) để tránh chồng request & race
    if (ctrlRef.current) ctrlRef.current.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    const signal = ctrl.signal
    lanNapLuc.current = Date.now()
    if (!nen) setDangTai(true)
    setLoi(null)

    // Còn hiệu lực? (component chưa gỡ · request chưa bị hủy · CHƯA đổi tài khoản)
    const genLucGoi = theHe.current
    const con = () => !huy.current && !signal.aborted && theHe.current === genLucGoi
    // Ghi nhận lỗi ĐẦU TIÊN không phải abort (giữ hành vi cũ: chỉ báo 1 lỗi ra UI)
    const nhanLoi = (x) => { if (con() && x && x.error && x.error.name !== 'AbortError') setLoi((cur) => cur || x.error); return x }

    // ============================================================
    // TẦNG 1 — dữ liệu "trên màn hình đầu" (Tổng quan): KPIs, sự cố, cảnh báo,
    // sức khỏe, ngưỡng, phòng. Set state NGAY khi TỪNG truy vấn xong (progressive
    // rendering) → màn hình đầu KHÔNG chờ các truy vấn nặng của tab phụ.
    // ============================================================
    const pTongQuan = layTongQuan(signal).then((x) => { nhanLoi(x); if (con() && x.kpis) setKpis(x.kpis); return x })
    const pSuCo     = laySuCoDangMo(signal).then((x) => { nhanLoi(x); if (con() && x.incidents) setIncidents(x.incidents); return x })
    // 17/07: suCoPhuTrach LÊN TẦNG 1 (trước ở tầng 2 TTL 5' → tab Nhiệm vụ lệch tab Sự cố
    // vài phút sau mỗi thao tác). View gọn ~20 dòng, rẻ; realtime su_co đổi → khớp ngay.
    const pPhuTrach = laySuCoPhuTrach(signal).then((x) => { nhanLoi(x); if (con() && x.rows) setSuCoPhuTrach(x.rows); return x })
    const pCanhBao  = layCanhBaoHeThong(signal).then((x) => { nhanLoi(x); if (con() && x.alerts) setSystemAlerts(x.alerts); return x })
    const pSucKhoe  = laySucKhoeHeThong(null, signal).then((x) => { nhanLoi(x); if (con() && x.suc_khoe) setSucKhoe(x.suc_khoe); return x })
    const pNguong   = layNguongCanhBao(signal).then((x) => { nhanLoi(x); if (con() && x.cfg) setNguong(x.cfg); return x })
    // Phòng: làm giàu thống kê 8h khởi động NGAY khi có danh sách (không còn chờ
    // cả 12 truy vấn xong mới bắt đầu như trước → thẻ phòng hiện sớm hơn nhiều).
    const pPhong = layDanhSachPhong(signal).then((x) => {
      nhanLoi(x)
      if (!con() || !x.rooms) return x
      // HIỆN PHÒNG NGAY (tuân thủ + trạng thái + giới hạn từ xem_phong_co_kpi) —
      // KHÔNG chờ enrichment sensor. Thẻ phòng + KPI hiện sớm; thanh OOS nhỏ đổ nền
      // sau. Enrichment KHÔNG còn chặn tier1 ⇒ Tổng quan/Sự cố hiện nhanh hơn, nhất
      // là trên điện thoại/4G (bớt 1 vòng mạng khỏi đường tới hạn).
      if (con()) setRooms(x.rooms)
      lamGiauPhong(x.rooms, { batBuoc: !tuDong, signal })   // manual ⇒ làm mới ngay; auto ⇒ theo TTL
        .then((full) => { if (con()) setRooms(full) })
        .catch(() => { /* giữ bản cơ bản đã hiện */ })
      return x
    })

    // Tầng 1 hoàn tất → tắt "đang tải" + đóng dấu thời điểm. KHÔNG chờ tầng 2.
    const p_tier1 = Promise.all([pTongQuan, pSuCo, pPhuTrach, pCanhBao, pSucKhoe, pNguong, pPhong])
    p_tier1.then(() => {
      if (con()) { setCapNhatLuc(new Date()); setDangTai(false) }
    })

    // ============================================================
    // TẦNG 2 — dữ liệu tab phụ (Cấu hình/Rủi ro/SOP/AI/GMP): nạp NỀN.
    // TRƯỚC ĐÂY chạy SONG SONG với tầng 1 ⇒ 14 truy vấn ập vào DB (CPU-throttle) cùng lúc,
    // làm CHẬM CẢ tầng 1 (thứ người dùng đợi). Nay CHỜ tầng 1 xong rồi mới chạy, và hoãn
    // tới lúc luồng rảnh (requestIdleCallback) → màn hình đầu có dữ liệu nhanh hơn, tầng 2
    // vẫn tự nạp ngay sau đó. Nhịp tự động vẫn chỉ nạp lại khi quá TTL (đổi chậm).
    // ============================================================
    const nenTier2 = !tuDong || (Date.now() - tier2Luc.current > TIER2_TTL_MS)
    if (nenTier2) {
      tier2Luc.current = Date.now()
      const chayTier2 = () => {
        if (!con()) return
        layLichSuCauHinh(signal).then((x) => { nhanLoi(x); if (con() && x.rows) setConfigHistory(x.rows) })
        layCumSuCo(signal).then((x) => { nhanLoi(x); if (con() && x.rows) setCumSuCo(x.rows) })
        laySuCoDongGanDay(signal).then((x) => { nhanLoi(x); if (con() && x.rows) setSuCoDongGanDay(x.rows) })
        layXepHangRuiRo(signal).then((x) => { nhanLoi(x); if (con() && x.rows) setRiskRows(x.rows) })
        layQuyTrinhSop(signal).then((x) => { nhanLoi(x); if (con() && x.rows) setSopRows(x.rows) })
        layBaoCaoAi(signal).then((x) => { nhanLoi(x); if (con() && x.rows) setAiRows(x.rows) })
        layPhanTichGmp(signal).then((x) => { nhanLoi(x); if (con()) { if (x.mkt) setGmpMkt(x.mkt); if (x.spc) setGmpSpc(x.spc) } })
      }
      // finally: chạy tầng 2 kể cả khi tầng 1 lỗi. requestIdleCallback nhường luồng cho
      // render màn hình đầu; setTimeout dự phòng cho trình duyệt không hỗ trợ.
      p_tier1.finally(() => {
        if (!con()) return
        if (typeof requestIdleCallback === 'function') requestIdleCallback(chayTier2, { timeout: 1500 })
        else setTimeout(chayTier2, 200)
      })
    }
  }, [dangBat, lamGiauPhong])

  // P0-2: nạp lại bộ luật MỖI KHI phiên sẵn sàng, không chỉ lúc mount. Trước đây
  // layNutThaoTac() chạy một lần trước khi Supabase khôi phục phiên; hỏng một lần là
  // hỏng cả phiên, và giao diện lặng lẽ rơi về STATUS_ACTIONS hard-code.
  const napNut = useCallback(() => {
    layNutThaoTac().then((r) => {
      if (huy.current) return
      if (r.error) { setLoiNut(r.error); setNutThaoTac(null) }
      else { setLoiNut(null); setNutThaoTac(r.rows) }
    }).catch((e) => { if (!huy.current) { setLoiNut(e); setNutThaoTac(null) } })
  }, [])

  useEffect(() => {
    huy.current = false
    if (dangBat) {
      // MỞ NGUỘI (15/07): chờ supabase khôi phục phiên từ localStorage (cục bộ,
      // không tốn vòng mạng) rồi mới nạp. Trước đây lamMoi() bắn ngay khi mount —
      // chưa có JWT nên cả loạt request đi vai anon bị RLS trả rỗng, rồi
      // INITIAL_SESSION nạp lại từ đầu ⇒ điện thoại trả giá 2 lượt mạng cho 1 lần
      // mở app, tab Sự cố chờ lâu gấp đôi. getSession() lỗi vẫn nạp (finally).
      if (supabase) supabase.auth.getSession().finally(() => { if (!huy.current) lamMoi() })
      else lamMoi()
      // Cờ bắt buộc đăng nhập: đọc 1 lần (hiếm đổi), không nằm trong nhịp 60s
      layCoBatBuocDangNhap().then((r) => { if (!huy.current) setBatBuocDangNhap(!!r.batBuoc) }).catch(() => {})
      napNut()
    }
    let timer = null
    if (dangBat && tuDongMoiMs > 0) {
      timer = setInterval(() => { if (document.visibilityState === 'visible') lamMoi({ nen: true, tuDong: true }) }, tuDongMoiMs)
    }
    // Mở lại app (điện thoại chuyển app / khoá màn hình) → làm mới NGAY, không đợi
    // hết chu kỳ 60s. Chặn dồn: bỏ qua nếu vừa làm mới trong 20s.
    let lanMoiCuoi = Date.now()
    const onHien = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lanMoiCuoi < 20000) return
      lanMoiCuoi = Date.now()
      lamMoi({ nen: true, tuDong: true })
    }
    if (dangBat) document.addEventListener('visibilitychange', onHien)
    return () => {
      huy.current = true
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', onHien)
      if (ctrlRef.current) ctrlRef.current.abort()    // hủy request đang chờ khi unmount
    }
  }, [dangBat, lamMoi, tuDongMoiMs])

  // ═══ Realtime: su_co đổi → nạp lại sau 1.5s (gom burst — WF1 cập nhật hàng chục
  // sự cố trong một nhịp :02). Sự kiện chỉ là tiếng gõ cửa; dữ liệu vẫn đi qua
  // đúng các view thường dùng. Poll 60s giữ nguyên làm lưới đỡ khi WebSocket rớt.
  const rtTimer = useRef(null)
  useEffect(() => {
    if (!dangBat) return
    const huyDangKy = dangKyRealtimeSuCo(() => {
      if (document.visibilityState !== 'visible') return
      if (rtTimer.current) clearTimeout(rtTimer.current)
      rtTimer.current = setTimeout(() => { lamMoi({ nen: true }) }, 1500)
    })
    return () => { if (rtTimer.current) clearTimeout(rtTimer.current); huyDangKy() }
  }, [dangBat, lamMoi])

  // ============================================================
  // KHẮC PHỤC TRIỆT ĐỂ "phải F5 mới hiện dữ liệu":
  // Lần nạp đầu (trong useEffect mount) chạy NGAY khi component xuất hiện — lúc đó
  // supabase-js CHƯA chắc đã nạp xong phiên từ localStorage, nên truy vấn đi bằng
  // vai trò `anon` → ở chế độ PROD bị "permission denied" và màn hình đứng ở trạng
  // thái lỗi/0 cho tới khi người dùng F5 (lúc F5 phiên đã có sẵn trong localStorage).
  // → Thay vì phụ thuộc thời điểm của React, ta NẠP LẠI ngay khi Supabase phát tín
  //   hiệu phiên đã sẵn sàng: INITIAL_SESSION (khôi phục lúc tải trang), SIGNED_IN
  //   (vừa đăng nhập), TOKEN_REFRESHED. Như vậy mọi truy vấn đều mang JWT.
  // ⚠️ Không await truy vấn NGAY trong callback onAuthStateChange (supabase-js
  //   serialize Auth bằng Web Locks → dễ kẹt). Đẩy lamMoi ra khỏi callback bằng
  //   setTimeout(…, 0) cho an toàn.
  useEffect(() => {
    if (!dangBat || !supabase) return
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // Mount đã chờ getSession() rồi mới nạp, nên INITIAL_SESSION đến ngay sau đó
        // sẽ nạp TRÙNG (abort lượt mount + tải lại từ đầu = chậm gấp đôi trên 4G).
        // Vẫn giữ nhánh này cho SIGNED_IN/TOKEN_REFRESHED và làm lưới an toàn.
        setTimeout(() => {
          if (huy.current) return
          napNut()
          if (Date.now() - lanNapLuc.current > 2000) lamMoi()
        }, 0)
      }
    })
    return () => sub?.subscription?.unsubscribe?.()
  }, [dangBat, lamMoi, napNut])

  // P1 — TRƯỚC ĐÂY có kênh 'bms-su-co' thứ hai đăng ký TRÙNG bảng su_co (song song với
  // 'rt-su-co' ở trên), debounce lệch (1200ms vs 1500ms), không kiểm visibility. Mỗi thay
  // đổi su_co bắn 2 lần lamMoi() cách ~300ms; lần sau abort request lần trước → tải thừa +
  // loading/race khó hiểu. Đã GỘP: chỉ giữ MỘT subscription (dangKyRealtimeSuCo ở trên).

  return {
    isLive, kpis, incidents, systemAlerts, configHistory,
    rooms, riskRows, sopRows, aiRows, nguong, sucKhoe, suCoPhuTrach, cumSuCo, suCoDongGanDay, gmpMkt, gmpSpc, batBuocDangNhap, nutThaoTac, loiNut,
    dangTai, loi, capNhatLuc, lamMoi,
  }
}
