export const TAO_MOI_MAC_DINH_MS = 60 * 60 * 1000

export function taoChinhSachLamMoi({ khoangMs = TAO_MOI_MAC_DINH_MS, bayGio = Date.now } = {}) {
  let lanSnapshot = null

  const ghiNhan = () => { lanSnapshot = bayGio() }

  return {
    conLaiMs() {
      if (khoangMs <= 0) return null
      if (lanSnapshot === null) return khoangMs
      return Math.max(0, khoangMs - (bayGio() - lanSnapshot))
    },
    thuTuDong(chay) {
      if (khoangMs <= 0) return false
      const lucNay = bayGio()
      if (lanSnapshot !== null && lucNay - lanSnapshot < khoangMs) return false
      lanSnapshot = lucNay
      chay()
      return true
    },
    lamMoiThuCong(chay) {
      ghiNhan()
      chay()
    },
    ghiNhan,
    datLai() { lanSnapshot = null },
  }
}
