// ============================================================
// useBmsData.js — Hook React quản lý tải dữ liệu an toàn
// Cung cấp: dangTai (loading), loi (error), duLieu, lamMoi (refetch),
//           cu (stale: đang hiện dữ liệu cũ trong lúc tải lại).
// Tự động làm mới theo chu kỳ (vd dashboard 60s) và KHÔNG xoá dữ liệu
// cũ khi tải lại lỗi → UI không bị nháy trắng.
// ============================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import { moTaLoi } from '../lib/bmsClient'

/**
 * @param taiHam  () => Promise<{data, error}>   (vd: () => docView('xem_tong_quan'))
 * @param opts    { tuDongMoiMs?, batDau? }       tuDongMoiMs=0 nghĩa là không tự làm mới
 */
export function useBmsData(taiHam, { tuDongMoiMs = 0, batDau = true, deps = [] } = {}) {
  const [duLieu, setDuLieu]   = useState(null)
  const [dangTai, setDangTai] = useState(batDau)
  const [loi, setLoi]         = useState(null)
  const [cu, setCu]           = useState(false)        // đang hiện dữ liệu cũ?
  const [capNhatLuc, setCapNhatLuc] = useState(null)
  const huyRef = useRef(false)
  const dangChayRef = useRef(false)

  const lamMoi = useCallback(async ({ nen = false } = {}) => {
    if (dangChayRef.current) return                    // tránh chồng request
    dangChayRef.current = true
    // nen=true: làm mới ngầm (giữ dữ liệu cũ trên màn, chỉ đánh dấu "cu")
    if (!nen) setDangTai(true)
    if (duLieu != null) setCu(true)
    setLoi(null)
    try {
      const { data, error } = await taiHam()
      if (huyRef.current) return
      if (error) {
        setLoi(error)
        // GIỮ duLieu cũ — không xoá, để người dùng vẫn xem được số liệu gần nhất
      } else {
        setDuLieu(data)
        setCapNhatLuc(new Date())
      }
    } catch (e) {
      if (!huyRef.current) setLoi(e)
    } finally {
      if (!huyRef.current) { setDangTai(false); setCu(false) }
      dangChayRef.current = false
    }
  }, deps)                                              // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    huyRef.current = false
    if (batDau) lamMoi()
    let timer = null
    if (tuDongMoiMs > 0) {
      timer = setInterval(() => {
        // chỉ tự làm mới khi tab đang hiển thị → đỡ tốn quota
        if (document.visibilityState === 'visible') lamMoi({ nen: true })
      }, tuDongMoiMs)
    }
    return () => { huyRef.current = true; if (timer) clearInterval(timer) }
  }, deps)                                              // eslint-disable-line react-hooks/exhaustive-deps

  return {
    duLieu, dangTai, loi, cu, capNhatLuc,
    thongBaoLoi: loi ? moTaLoi(loi) : '',
    laLoiNghiepVu: !!loi?.nghiep_vu,
    lamMoi,
  }
}
