// ============================================================
// hoSoCum.js — Bản in hồ sơ cụm điều tra (phục vụ thanh tra GMP)
//
// Nhận JSON từ rpc_ho_so_cum, dựng một trang HTML tự chứa (inline CSS, không
// phụ thuộc ngoài) rồi mở cửa sổ in — người dùng "Lưu thành PDF" từ hộp thoại
// in của trình duyệt. Không sinh PDF ở máy chủ: không thêm phụ thuộc, và bản
// in luôn khớp đúng dữ liệu người đó được xem (RPC đã lọc khu).
//
// Mọi giá trị đều đi qua esc() — lý do/ghi chú là văn bản người nhập.
// ============================================================

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ts = (v) => (v ? new Date(v).toLocaleString('vi-VN', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : '—')

export function moHoSoCumBanIn(hoSo) {
  const c = hoSo.cum || {}
  const dsSuCo = hoSo.su_co || []
  const dsAudit = hoSo.audit || []

  const rowsSuCo = dsSuCo.map((s) => `
    <tr>
      <td>${esc(s.ma_hien_thi)}</td><td>${esc(s.ma_phong)} — ${esc(s.ten_phong || '')}</td>
      <td>${esc(s.loai_cam_bien)} · ${esc(s.muc_uu_tien)}</td>
      <td>${esc(s.nhan_trang_thai || s.trang_thai)}${s.muc_canh_bao === 'SUPPRESSED' ? ' <i>(cảm biến đứng hình)</i>' : ''}</td>
      <td class="num">${ts(s.mo_luc)}</td><td class="num">${s.dong_luc ? ts(s.dong_luc) : 'đang mở'}</td>
    </tr>`).join('')

  const rowsAudit = dsAudit.map((a) => `
    <tr>
      <td class="num">${ts(a.thoi_diem)}</td><td>${esc(a.ma_hien_thi)}</td>
      <td>${esc(a.nguoi)}<br/><span class="mut">${esc(a.vai_tro)}</span></td>
      <td>${esc(a.hanh_dong)}</td>
      <td>${esc(a.truoc || '')}${a.truoc && a.sau ? ' → ' : ''}${esc(a.sau || '')}</td>
      <td>${esc(a.ly_do || '')}</td>
    </tr>`).join('')

  const capa = c.da_co_ket_luan_qa ? `
    <table class="capa">
      <tr><th>Nguyên nhân gốc</th><td>${esc(c.nguyen_nhan_goc)}</td></tr>
      <tr><th>Hành động khắc phục</th><td>${esc(c.hanh_dong_khac_phuc)}</td></tr>
      ${c.hanh_dong_phong_ngua ? `<tr><th>Hành động phòng ngừa</th><td>${esc(c.hanh_dong_phong_ngua)}</td></tr>` : ''}
      ${c.qa_ket_luan ? `<tr><th>Kết luận QA</th><td>${esc(c.qa_ket_luan)}</td></tr>` : ''}
      <tr><th>Người kết luận</th><td>${esc(c.qa_boi)} · ${ts(c.qa_luc)}</td></tr>
    </table>`
    : '<p class="mut"><i>Chưa có kết luận QA tại thời điểm xuất hồ sơ.</i></p>'

  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<title>Hồ sơ ${esc(c.ma_hien_thi)} — Sai lệch HVAC</title>
<style>
  body{font-family:"Segoe UI",Arial,sans-serif;color:#1e293b;margin:28px;font-size:12.5px;line-height:1.5}
  h1{font-size:17px;margin:0}h2{font-size:13px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.04em;color:#334155;border-bottom:1px solid #cbd5e1;padding-bottom:3px}
  .mut{color:#64748b;font-size:11px}.num{white-space:nowrap;font-variant-numeric:tabular-nums}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left;vertical-align:top;font-size:11.5px}
  thead th{background:#f1f5f9}
  .capa th{width:170px;background:#f8fafc}
  .khung{border:1px solid #cbd5e1;padding:10px 12px;margin-top:8px}
  .ky{margin-top:34px;display:flex;gap:40px}.ky div{flex:1;text-align:center}
  .ky .lan{margin-top:52px;border-top:1px solid #94a3b8;padding-top:4px;font-size:11px;color:#475569}
  @media print{ .no-print{display:none} body{margin:12mm} }
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>HỒ SƠ SAI LỆCH / CỤM ĐIỀU TRA ${esc(c.ma_hien_thi)}</h1>
      <p class="mut">Hệ giám sát HVAC phòng sạch (BMS) · CPC1 Hà Nội — hồ sơ sinh tự động từ audit trail ALCOA+</p>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:6px 14px;border-radius:8px;border:1px solid #94a3b8;background:#f8fafc;cursor:pointer">In / Lưu PDF</button>
  </div>

  <div class="khung">
    <b>Phạm vi:</b> ${esc(c.ahu || 'Không rõ AHU')} · chỉ tiêu ${esc(c.loai_cam_bien)} · khu ${esc(c.khu_vuc)}<br/>
    <b>Chẩn đoán hệ thống:</b> ${esc(c.chan_doan)}<br/>
    <b>Mở:</b> ${ts(c.thoi_gian_mo)} · <b>Trạng thái:</b> ${c.dang_mo ? `đang mở (${esc(Math.round(c.gio_mo))} giờ)` : 'đã đóng'}
    · <b>Sự cố:</b> ${esc(c.tong_su_co)} (đang mở ${esc(c.su_co_dang_mo)}${Number(c.so_cam_bien_dung_hinh) > 0 ? `, cảm biến đứng hình ${esc(c.so_cam_bien_dung_hinh)}` : ''})
  </div>

  <h2>1 · Kết luận điều tra (CAPA)</h2>
  ${capa}

  <h2>2 · Sự cố thuộc cụm (${dsSuCo.length})</h2>
  <table><thead><tr><th>Mã</th><th>Phòng</th><th>Chỉ tiêu</th><th>Trạng thái</th><th>Mở lúc</th><th>Đóng lúc</th></tr></thead>
  <tbody>${rowsSuCo}</tbody></table>

  <h2>3 · Vết audit đầy đủ (${dsAudit.length} bản ghi, ALCOA+ — chỉ ghi thêm, không sửa xoá)</h2>
  <table><thead><tr><th>Thời điểm</th><th>Sự cố</th><th>Người · vai trò</th><th>Hành động</th><th>Chuyển trạng thái</th><th>Lý do / ghi chú</th></tr></thead>
  <tbody>${rowsAudit}</tbody></table>

  <p class="mut" style="margin-top:14px">Xuất bởi <b>${esc(hoSo.xuat_boi)}</b> lúc ${ts(hoSo.xuat_luc)}. Bản in phản chiếu cơ sở dữ liệu tại thời điểm xuất; nguồn sự thật là audit trail trong hệ thống.</p>
  <div class="ky">
    <div><b>Người lập</b><div class="lan">Ký, ghi rõ họ tên · ngày</div></div>
    <div><b>QA phê duyệt</b><div class="lan">Ký, ghi rõ họ tên · ngày</div></div>
  </div>
</body></html>`

  const w = window.open('', '_blank', 'noopener,width=1000,height=800')
  if (!w) { alert('Trình duyệt chặn cửa sổ mới — hãy cho phép pop-up để in hồ sơ.'); return }
  w.document.write(html)
  w.document.close()
}
