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
import {
  layTongQuan, laySuCoDangMo, layCanhBaoHeThong, layNhatKyThaoTac, layLichSuCauHinh,
  layDanhSachPhong, layThongKeSensorPhong, layXepHangRuiRo, layQuyTrinhSop, layBaoCaoAi,
  layNguongCanhBao,
} from '../lib/supabaseData'

const ENRICH_TTL_MS = 4 * 60 * 1000   // thống kê 8h chỉ đổi mỗi giờ → cache 4'
const SO_SONG = 6                      // số request thống kê phòng chạy đồng thời tối đa

// Chạy fn trên từng phần tử nhưng giới hạn số chạy song song (chống burst).
async function chayTheoLo(items, fn, soSong = SO_SONG) {
  const out = new Array(items.length)
  let i = 0
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx) } }
  await Promise.all(Array.from({ length: Math.min(soSong, items.length) }, worker))
  return out
}

export function useLiveData(dataSource, { tuDongMoiMs = 60000 } = {}) {
  const isLive = dataSource === 'live'
  const [kpis, setKpis] = useState(null)
  const [incidents, setIncidents] = useState(null)
  const [systemAlerts, setSystemAlerts] = useState(null)
  const [audit, setAudit] = useState(null)
  const [configHistory, setConfigHistory] = useState(null)
  const [rooms, setRooms] = useState(null)
  const [riskRows, setRiskRows] = useState(null)
  const [sopRows, setSopRows] = useState(null)
  const [aiRows, setAiRows] = useState(null)
  const [nguong, setNguong] = useState(null)
  const [dangTai, setDangTai] = useState(false)
  const [loi, setLoi] = useState(null)
  const [capNhatLuc, setCapNhatLuc] = useState(null)

  const huy = useRef(false)
  const ctrlRef = useRef(null)
  const cacheSensor = useRef({ luc: 0, theoPhong: {} })

  // Làm giàu phòng với thống kê 8h (cache + giới hạn đồng thời + abort)
  const lamGiauPhong = useCallback(async (ds, { batBuoc, signal }) => {
    const canTai = ds.filter((r) => !r.noData)
    const quaHan = Date.now() - cacheSensor.current.luc > ENRICH_TTL_MS
    const chuaCache = Object.keys(cacheSensor.current.theoPhong).length === 0
    if (batBuoc || quaHan || chuaCache) {
      const ket = await chayTheoLo(canTai, (r) => layThongKeSensorPhong(r.id, signal))
      if (signal?.aborted) return ds
      const theoPhong = {}
      canTai.forEach((r, i) => { theoPhong[r.id] = (ket[i] && ket[i].sensors) || cacheSensor.current.theoPhong[r.id] || [] })
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
        return L ? { ...s, _live: { cur: L.cur, avg1h: L.avg1h, oos1h: L.oos1h, level: L.level, hourly8: L.hourly8 } } : s
      })
      live.forEach((L) => {
        if (!sensors.some((s) => s.k === L.k)) sensors.push({ k: L.k, min: null, max: null, _live: { cur: L.cur, avg1h: L.avg1h, oos1h: L.oos1h, level: L.level, hourly8: L.hourly8 } })
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
    if (!isLive) return
    // Hủy chu kỳ trước (nếu còn chờ) để tránh chồng request & race
    if (ctrlRef.current) ctrlRef.current.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    const signal = ctrl.signal
    if (!nen) setDangTai(true)
    setLoi(null)
    const [tq, sc, cb, nk, ls, ph, rr, sop, ai, ng] = await Promise.all([
      layTongQuan(signal), laySuCoDangMo(signal), layCanhBaoHeThong(signal), layNhatKyThaoTac(signal), layLichSuCauHinh(signal),
      layDanhSachPhong(signal), layXepHangRuiRo(signal), layQuyTrinhSop(signal), layBaoCaoAi(signal), layNguongCanhBao(signal),
    ])
    if (huy.current || signal.aborted) return
    const cacLoi = [tq, sc, cb, nk, ls, ph, rr, sop, ai, ng].map((x) => x.error).filter(Boolean)
    const loiThat = cacLoi.find((e) => e && e.name !== 'AbortError')
    if (loiThat) setLoi(loiThat)
    if (tq.kpis) setKpis(tq.kpis)
    if (sc.incidents) setIncidents(sc.incidents)
    if (cb.alerts) setSystemAlerts(cb.alerts)
    if (nk.rows) setAudit(nk.rows)
    if (ls.rows) setConfigHistory(ls.rows)
    if (rr.rows) setRiskRows(rr.rows)
    if (sop.rows) setSopRows(sop.rows)
    if (ai.rows) setAiRows(ai.rows)
    if (ng.cfg) setNguong(ng.cfg)
    if (ph.rooms) {
      try {
        const full = await lamGiauPhong(ph.rooms, { batBuoc: !tuDong, signal })   // manual ⇒ làm mới ngay; auto ⇒ theo TTL
        if (!huy.current && !signal.aborted) setRooms(full)
      } catch { if (!huy.current && !signal.aborted) setRooms(ph.rooms) }
    }
    if (!huy.current && !signal.aborted) { setCapNhatLuc(new Date()); setDangTai(false) }
  }, [isLive, lamGiauPhong])

  useEffect(() => {
    huy.current = false
    if (isLive) lamMoi()
    let timer = null
    if (isLive && tuDongMoiMs > 0) {
      timer = setInterval(() => { if (document.visibilityState === 'visible') lamMoi({ nen: true, tuDong: true }) }, tuDongMoiMs)
    }
    return () => {
      huy.current = true
      if (timer) clearInterval(timer)
      if (ctrlRef.current) ctrlRef.current.abort()    // hủy request đang chờ khi unmount
    }
  }, [isLive, lamMoi, tuDongMoiMs])

  return {
    isLive, kpis, incidents, systemAlerts, audit, configHistory,
    rooms, riskRows, sopRows, aiRows, nguong,
    dangTai, loi, capNhatLuc, lamMoi,
  }
}
