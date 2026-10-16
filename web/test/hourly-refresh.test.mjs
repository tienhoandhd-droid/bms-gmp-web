import test from 'node:test'
import assert from 'node:assert/strict'

import { TAO_MOI_MAC_DINH_MS, taoChinhSachLamMoi } from '../src/lib/refreshPolicy.js'

function taoDongHo() {
  let luc = 0
  return {
    bayGio: () => luc,
    tien: (ms) => { luc += ms },
  }
}

test('automatic snapshot runs once before an hour and again only when due', () => {
  const dongHo = taoDongHo()
  const chinhSach = taoChinhSachLamMoi({ bayGio: dongHo.bayGio })
  let soLanTaiSnapshot = 0
  const tai = () => { soLanTaiSnapshot += 1 }

  chinhSach.thuTuDong(tai)
  dongHo.tien(TAO_MOI_MAC_DINH_MS - 1)
  chinhSach.thuTuDong(tai)
  assert.equal(soLanTaiSnapshot, 1)

  dongHo.tien(1)
  chinhSach.thuTuDong(tai)
  assert.equal(soLanTaiSnapshot, 2)
})

test('visibility trigger shares the hourly guard', () => {
  const dongHo = taoDongHo()
  const chinhSach = taoChinhSachLamMoi({ bayGio: dongHo.bayGio })
  let soLanTaiSnapshot = 0

  chinhSach.thuTuDong(() => { soLanTaiSnapshot += 1 })
  dongHo.tien(20_000)
  chinhSach.thuTuDong(() => { soLanTaiSnapshot += 1 })

  assert.equal(soLanTaiSnapshot, 1)
})

test('becoming visible catches up after the hourly deadline', () => {
  const dongHo = taoDongHo()
  const chinhSach = taoChinhSachLamMoi({ bayGio: dongHo.bayGio })
  let soLanTaiSnapshot = 0

  chinhSach.thuTuDong(() => { soLanTaiSnapshot += 1 })
  dongHo.tien(TAO_MOI_MAC_DINH_MS + 5_000)
  chinhSach.thuTuDong(() => { soLanTaiSnapshot += 1 })

  assert.equal(soLanTaiSnapshot, 2)
})

test('incident realtime refresh stays independent from the measurement snapshot clock', () => {
  const dongHo = taoDongHo()
  const chinhSach = taoChinhSachLamMoi({ bayGio: dongHo.bayGio })
  let soLanTaiSnapshot = 0
  let soLanTaiSuCo = 0

  chinhSach.thuTuDong(() => { soLanTaiSnapshot += 1 })
  dongHo.tien(1_500)
  soLanTaiSuCo += 1
  chinhSach.thuTuDong(() => { soLanTaiSnapshot += 1 })

  assert.equal(soLanTaiSuCo, 1)
  assert.equal(soLanTaiSnapshot, 1)
})

test('manual refresh always runs and restarts the automatic deadline', () => {
  const dongHo = taoDongHo()
  const chinhSach = taoChinhSachLamMoi({ bayGio: dongHo.bayGio })
  let soLanTaiSnapshot = 0
  const tai = () => { soLanTaiSnapshot += 1 }

  chinhSach.thuTuDong(tai)
  dongHo.tien(1_000)
  chinhSach.lamMoiThuCong(tai)
  dongHo.tien(TAO_MOI_MAC_DINH_MS - 1)
  chinhSach.thuTuDong(tai)
  assert.equal(soLanTaiSnapshot, 2)

  dongHo.tien(1)
  chinhSach.thuTuDong(tai)
  assert.equal(soLanTaiSnapshot, 3)
})

test('account reset clears the previous account deadline without leaking it', () => {
  const dongHo = taoDongHo()
  const chinhSach = taoChinhSachLamMoi({ bayGio: dongHo.bayGio })
  const taiTheoTaiKhoan = []

  chinhSach.thuTuDong(() => { taiTheoTaiKhoan.push('cu') })
  dongHo.tien(1_000)
  chinhSach.datLai()
  chinhSach.thuTuDong(() => { taiTheoTaiKhoan.push('moi') })

  assert.deepEqual(taiTheoTaiKhoan, ['cu', 'moi'])
})

test('zero interval disables automatic refresh while keeping manual refresh', () => {
  const dongHo = taoDongHo()
  const chinhSach = taoChinhSachLamMoi({ khoangMs: 0, bayGio: dongHo.bayGio })
  let soLanTaiSnapshot = 0
  const tai = () => { soLanTaiSnapshot += 1 }

  chinhSach.thuTuDong(tai)
  chinhSach.lamMoiThuCong(tai)

  assert.equal(soLanTaiSnapshot, 1)
})
