'use strict';

function tenBaoCao(ky) {
  const ten = { TUAN: 'tuần', THANG: 'tháng', QUY: 'quý' }[String(ky).toUpperCase()];
  if (!ten) throw new Error('INVALID_REPORT_PERIOD');
  return 'Báo cáo BMS-Báo cáo ' + ten;
}

function tyLe(ct) {
  const rows = ct.xep_hang || [];
  const hopLe = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  if (!hopLe(ct.tong_gio_do) || ct.tong_gio_do === 0 || !rows.length
      || rows.length !== ct.so_phong_do
      || new Set(rows.map(r => r.ma_phong)).size !== rows.length
      || rows.some(r => !r.ma_phong || !hopLe(r.gio_do))
      || Math.abs(rows.reduce((s, r) => s + r.gio_do, 0) - ct.tong_gio_do) > 0.001) return null;
  let ngoai = ct.tong_gio_lech;
  if (ct.hai_huong && ct.hai_huong.nguoc) {
    if (!hopLe(ct.tong_gio_duoi) || !hopLe(ct.tong_gio_tren)) return null;
    ngoai = ct.tong_gio_duoi + ct.tong_gio_tren;
  }
  if (!hopLe(ngoai) || ngoai > ct.tong_gio_do) return null;
  const phanMuoi = Math.round(1000 * ngoai / ct.tong_gio_do);
  return { trong: (1000 - phanMuoi) / 10, ngoai: phanMuoi / 10 };
}

function tyLeDuLieu(d, loai, L) {
  const rows = ((d.chi_so_cam_bien || {})[loai] || {}).top_phong || [];
  const chuoi = L.bocChuoiCamBien(d)[loai] || {};
  const ok = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
  if (!rows.length || rows.length !== Object.keys(chuoi).length
      || rows.some(r => !chuoi[r.ma_phong] || !ok(r.gio_lech)
        || (loai !== 'T' && !ok(r.gio_lech_nguoc)))) return null;
  return tyLe(L.tongHopChiTieu(d, loai));
}

function tyLeTheoKhu(d, loai, khu, L) {
  const raw = ((d.chi_so_cam_bien || {})[loai] || {}).top_phong || [];
  const khuPhong = {};
  raw.forEach(r => { if (r.khu_vuc) khuPhong[r.ma_phong] = r.khu_vuc; });
  (d.tat_ca_phong || []).forEach(p => { if (p.khu_vuc) khuPhong[p.ma_phong] = p.khu_vuc; });
  const cungKhu = ma => khuPhong[ma] === khu;
  const chuoi = {};
  Object.entries(d.chuoi_cam_bien || {}).forEach(([key, value]) => {
    const [ma, type] = key.split('|');
    if (type === loai && cungKhu(ma)) chuoi[key] = value;
  });
  const scoped = Object.assign({}, d, {
    tat_ca_phong: (d.tat_ca_phong || []).filter(p => cungKhu(p.ma_phong)),
    chuoi_cam_bien: chuoi,
    chi_so_cam_bien: { [loai]: Object.assign({}, (d.chi_so_cam_bien || {})[loai], {
      top_phong: raw.filter(r => cungKhu(r.ma_phong))
    }) }
  });
  return tyLeDuLieu(scoped, loai, L);
}

function chuTyLe(p) {
  const fmt = x => x.toFixed(1).replace('.', ',') + '%';
  return p ? 'Trong ' + fmt(p.trong) + ' · Ngoài ' + fmt(p.ngoai) : 'Trong — · Ngoài —';
}

function svgKhu(rows, L, hai) {
  if (!rows.length) return '';
  const W = 780, step = 44, top = 24, H = top + rows.length * step + 4;
  const left = 200, mid = 390, half = 128;
  const pct = (r, key) => r.tong_gio_do > 0 ? 100 * (r[key] || 0) / r.tong_gio_do : 0;
  const values = r => hai ? [pct(r,'tong_gio_duoi'),pct(r,'tong_gio_tren')] : [0,pct(r,'tong_gio_lech')];
  const max = Math.max(1,...rows.filter(r=>r.bms_ty_le).flatMap(values));
  const fmt = v => v.toFixed(1).replace('.', ',') + '%';
  let s = hai
    ? '<text x="382" y="12" text-anchor="end" class="svg-nhan-duoi">← tụt dưới giới hạn dưới</text><text x="398" y="12" class="svg-nhan-tren">vượt trên giới hạn trên →</text>'
    : '<text x="398" y="12" class="svg-nhan">Ngoài khoảng (gộp hai phía)</text>';
  s += '<line x1="390" x2="390" y1="20" y2="'+(H-4)+'" stroke="#94a3b8"/>';
  rows.forEach((r,i) => {
    const [duoi,tren] = values(r), y=top+i*step;
    const nhan='Khu '+r.khu, p=r.bms_ty_le;
    s += '<g data-bms-compact="1" data-bms-khu="'+L.esc(r.khu)+'" data-bms-loai="'+L.esc(r.bms_loai)+'">'
      + '<title>'+L.esc(nhan)+' — '+L.esc(chuTyLe(p).replace('Trong ', 'Trong khoảng ').replace('Ngoài ', 'Ngoài khoảng '))
      + (p ? '; '+L.soVN(r.tong_gio_do,0)+' giờ có số đo; dưới '+L.soVN(r.tong_gio_duoi||0,1)+' giờ, trên '+L.soVN(r.tong_gio_tren||0,1)+' giờ' : '; Chưa đủ dữ liệu')+'</title>'
      + '<text x="0" y="'+(y+14)+'" class="svg-hang">'+L.esc(nhan)+'</text>'
      + '<text x="0" y="'+(y+30)+'" style="font:11px Arial,sans-serif;fill:#475569">'+L.esc(chuTyLe(p))+'</text>';
    if (!p) {
      s += '<text x="530" y="'+(y+14)+'" class="svg-nhan">Chưa đủ dữ liệu</text></g>';
      return;
    }
    if(hai) s += '<text x="'+(left+48)+'" y="'+(y+14)+'" text-anchor="end" class="svg-nhan">'+fmt(duoi)+'</text>'
      + '<rect x="'+(mid-duoi/max*half)+'" y="'+(y+3)+'" width="'+(duoi/max*half)+'" height="13" rx="2" fill="'+L.MAU.lechDuoi+'"/>';
    s += '<rect x="390" y="'+(y+3)+'" width="'+(tren/max*half)+'" height="13" rx="2" fill="'+L.MAU.lechTren+'"/>'
      + '<text x="530" y="'+(y+14)+'" class="svg-nhan">'+fmt(tren)+'</text>'
      + '<text x="780" y="'+(y+14)+'" text-anchor="end" class="svg-hang">'+r.so_phong_dat+'/'+r.so_phong+' đạt'
      + (r.so_con_lech?' · '+r.so_con_lech+' ngoài giới hạn':'')+'</text></g>';
  });
  return '<svg viewBox="0 0 '+W+' '+H+'" class="bieu-do" role="img" aria-label="Tỷ lệ trong và ngoài khoảng theo khu; chi tiết hai phía">'+s+'</svg>';
}

function apDung(B) {
  if (B.tieuDeTyLeVersion === 3) return B;
  if (B.tieuDeTyLeVersion) throw new Error('REPORT_EXTENSION_VERSION_MISMATCH');
  const rap = B.rapTatCa;
  B.rapTatCa = function (d, duBao, cfg) {
    const ten = tenBaoCao(d.ky);
    const c = Object.assign({}, cfg, { tieu_de: ten, tieu_de_email: ten, nhan_ky: ten.replace('Báo cáo BMS-Báo cáo ', '') });
    const L=B.L, gom=L.gomChiTieuTheoCap, hai=L.svgThanhHaiChieu, mot=L.svgSoSanhCap;
    const khuRieng=c.khu?String(c.khu).toUpperCase():null;
    const cache={};
    const lay=(loai,khu)=>{
      const key=loai+'|'+khu;
      if(!Object.prototype.hasOwnProperty.call(cache,key))cache[key]=tyLeTheoKhu(d,loai,khu,L);
      return cache[key];
    };
    L.gomChiTieuTheoCap=function(ct){
      const result=gom(ct);
      result.khu=result.khu.map(r=>Object.assign({},r,{bms_loai:ct.loai,bms_ty_le:lay(ct.loai,r.khu)}));
      return result;
    };
    const isKhu=rows=>rows&&rows.length&&rows.every(r=>r.bms_loai);
    const scope=rows=>rows.filter(r=>!khuRieng||r.khu===khuRieng);
    L.svgThanhHaiChieu=function(rows,...args){return isKhu(rows)?svgKhu(scope(rows),L,true):hai(rows,...args);};
    L.svgSoSanhCap=function(rows,...args){return isKhu(rows)?svgKhu(scope(rows),L,false):mot(rows,...args);};
    let kq;
    try { kq=rap(d,duBao,c); }
    finally { L.gomChiTieuTheoCap=gom;L.svgThanhHaiChieu=hai;L.svgSoSanhCap=mot; }
    const tenLoai={'chênh áp':'DP','nhiệt độ':'T','độ ẩm':'RH'};
    const pattern=/(Khu (C1|C4|Q2)<\/div>)(<div style="[^"]*">)([0-9]+\/[0-9]+ phòng đạt (chênh áp|nhiệt độ|độ ẩm))(<\/div>)/g;
    kq.email_html=kq.email_html.replace('>Báo cáo '+c.nhan_ky+'</div>', '>'+L.esc(ten)+'</div>');
    kq.email_html=kq.email_html.replace(pattern,(full,title,khu,open,count,loai,close)=>{
      if(khuRieng&&khu!==khuRieng)return full;
      const p=lay(tenLoai[loai],khu);
      return title+'<div data-bms-compact="1" data-bms-khu="'+khu+'" data-bms-loai="'+tenLoai[loai]
        +'" title="Trong khoảng / Ngoài khoảng; tính trên thời gian có số đo" style="font-size:12px;color:#475569;line-height:1.4;margin-top:3px;">'
        +L.esc(chuTyLe(p))+'</div>'+open+count+close;
    });
    if(khuRieng) {
      for(const [loai,so] of [['DP',3],['T',4],['RH',5]]){
        const re=new RegExp('(<section[^>]*id="muc-'+so+'"[^>]*><h2>[\\s\\S]*?<\\/h2>)');
        kq.bao_cao_html=kq.bao_cao_html.replace(re,'$1<p data-bms-compact="1" data-bms-khu="'+L.esc(khuRieng)+'" data-bms-loai="'+loai+'" class="mota">Khu '+L.esc(khuRieng)+' · '+L.esc(chuTyLe(lay(loai,khuRieng)))+'</p>');
      }
    }
    return kq;
  };
  B.tieuDeTyLeVersion = 3;
  return B;
}

module.exports = { tenBaoCao, tyLe, tyLeDuLieu, tyLeTheoKhu, chuTyLe, svgKhu, apDung };
