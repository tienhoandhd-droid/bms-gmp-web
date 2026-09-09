import test from 'node:test'
import assert from 'node:assert/strict'
import * as guidance from '../src/lib/emailActionGuidance.js'
const denied = {loi:'THAO_TAC_KHONG_CON_HOP_LE', nut_kha_dung:[{hanh_dong:'mep_tiep_nhan',nhan:'Đã nhận thông tin — đang xử lý'}]}
test('outcome denial guides reception only when server offers it',()=>{
  assert.equal(guidance.huongDanThuTu?.(denied,'mep_xu_ly_xong')?.nextAction,'mep_tiep_nhan')
  assert.equal(guidance.huongDanThuTu?.({...denied,nut_kha_dung:[]},'mep_xu_ly_xong'),null)
})
test('absence while processing guides waiting, not reception',()=>{
  assert.equal(guidance.huongDanThuTu?.({...denied,nut_kha_dung:[{hanh_dong:'mep_cho_xu_ly',nhan:'Chờ xử lý (khi rảnh)'}]},'mep_vang')?.nextAction,'mep_cho_xu_ly')
})
test('permissions, expiry and unknown actions are never presented as prerequisites',()=>{
  for(const loi of ['TOKEN_HET_HAN','KHONG_DUOC_PHEP','TOKEN_DA_DUNG']) assert.equal(guidance.huongDanThuTu?.({...denied,loi},'mep_xu_ly_xong'),null)
  assert.equal(guidance.huongDanThuTu?.(denied,'unknown'),null)
})
test('continuation URLs contain only bounded incident IDs, never tokens',()=>{
  assert.equal(guidance.lienKetSuCo?.('123','receive'),'incident.html?incident=123&intent=receive')
  for(const id of ['0','-1','123&token=secret','9223372036854775808',null]) assert.equal(guidance.lienKetSuCo?.(id),null)
})
