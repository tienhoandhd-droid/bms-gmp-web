import { workflow, node, trigger, sticky, ifElse, expr } from '@n8n/workflow-sdk';

const lichTuDong = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Lịch tự động (T2 + ngày 1, 07:00 VN)',
    position: [-1180, 260],
    parameters: {
      rule: {
        interval: [
          { field: 'cronExpression', expression: '0 0 0 * * 1' },
          { field: 'cronExpression', expression: '0 15 0 1 * *' }
        ]
      }
    }
  },
  output: [{ timestamp: '2026-07-06T00:00:00.000Z' }]
});

const webhookBu = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook gửi bù (nút trên web)',
    position: [-1180, 520],
    parameters: {
      httpMethod: 'POST',
      path: 'wf5-bao-cao-bu',
      responseMode: 'onReceived',
      options: {
        allowedOrigins: '*',
        responseData: '{"ok":true,"message":"Đã nhận yêu cầu — báo cáo sẽ được tạo và gửi email trong vài phút."}'
      }
    }
  },
  output: [{ headers: { host: 'n8n.cpc1hn.com' }, params: {}, query: {}, body: { ky: 'THANG' }, webhookUrl: 'https://n8n.cpc1hn.com/webhook/wf5-bao-cao-bu' }]
});

const xacDinhKy = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Xác định kỳ báo cáo',
    position: [-920, 380],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const VN = 'Asia/Ho_Chi_Minh';
const nowVN = DateTime.now().setZone(VN);
const fmt = (d) => d.toFormat('yyyy-MM-dd');
const hienThi = (iso) => String(iso).split('-').reverse().join('/');
const dau = $input.first().json;
const body = dau.body || {};
const laWebhook = !!(dau.webhookUrl || dau.headers || body.ky);
const nguon = laWebhook ? 'WEB_BU' : 'LICH';
const out = [];
function themKy(ky, tuIso, denIso, nhan) {
  out.push({ json: {
    ky: ky, tu: tuIso, den: denIso, ky_bao_cao: nhan, nguon_kich_hoat: nguon,
    tu_hienthi: hienThi(tuIso), den_hienthi: hienThi(denIso),
    tao_luc: nowVN.toFormat('HH:mm dd/MM/yyyy'),
    ma_lan_chay: 'WF5V2-' + ky + '-' + denIso + '-' + $execution.id,
    ten_file: 'BaoCao-GMP-' + ky + '-' + denIso,
  }, pairedItem: { item: 0 } });
}
function thangTruoc() {
  const dauThang = nowVN.startOf('month');
  const tu = dauThang.minus({ months: 1 });
  const den = dauThang.minus({ days: 1 });
  themKy('THANG', fmt(tu), fmt(den), 'THÁNG ' + tu.toFormat('MM/yyyy'));
}
function tuanTruoc() {
  const dauTuan = nowVN.startOf('week');
  const tu = dauTuan.minus({ weeks: 1 });
  const den = dauTuan.minus({ days: 1 });
  themKy('TUAN', fmt(tu), fmt(den), 'TUẦN ' + tu.toFormat('WW/kkkk'));
}
function quyTruoc() {
  const dauQuyNay = nowVN.startOf('month').minus({ months: (nowVN.month - 1) % 3 });
  const tu = dauQuyNay.minus({ months: 3 });
  const den = dauQuyNay.minus({ days: 1 });
  themKy('QUY', fmt(tu), fmt(den), 'QUÝ ' + Math.ceil(tu.month / 3) + '/' + tu.year);
}
if (laWebhook) {
  const yc = String(body.ky || 'THANG').toUpperCase();
  if (body.tu && body.den) {
    themKy(['TUAN','THANG','QUY'].includes(yc) ? yc : 'THANG', String(body.tu), String(body.den),
      'KỲ ' + hienThi(String(body.tu)) + ' – ' + hienThi(String(body.den)));
  } else if (yc === 'TUAN') { tuanTruoc(); }
  else if (yc === 'QUY') { quyTruoc(); }
  else { thangTruoc(); }
} else if (nowVN.day === 1) {
  thangTruoc();
  if ([1, 4, 7, 10].includes(nowVN.month)) { quyTruoc(); }
} else {
  tuanTruoc();
}
return out;`
    }
  },
  output: [{ ky: 'THANG', tu: '2026-06-01', den: '2026-06-30', ky_bao_cao: 'THÁNG 06/2026', nguon_kich_hoat: 'WEB_BU', tu_hienthi: '01/06/2026', den_hienthi: '30/06/2026', tao_luc: '10:00 03/07/2026', ma_lan_chay: 'WF5V2-THANG-2026-06-30-1234', ten_file: 'BaoCao-GMP-THANG-2026-06-30' }]
});

const docSoLieu = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Supabase — số liệu + cấu hình + người nhận',
    position: [-660, 380],
    parameters: {
      resource: 'database',
      operation: 'executeQuery',
      query: `SELECT
  public.rpc_bao_cao_tong_hop($1, $2::date, $3::date)::text        AS bao_cao,
  public.cfg_text('drive_folder_id_bao_cao','root')                AS folder_id,
  public.cfg_text('email_gui_tu','')                               AS email_tu,
  public.cfg_text('quickchart_base_url','https://quickchart.io')   AS qc_base,
  public.cfg_text('gotenberg_url','http://gotenberg:3000')         AS gotenberg_url,
  public.cfg_text('chart_render_url','http://chart-render:8081')   AS chart_render_url,
  public.cfg_text('chart_render_token','')                         AS chart_render_token,
  public.cfg_text('web_app_url','')                                AS web_app_url,
  CASE WHEN upper($1) = 'TUAN' THEN public.cfg_text('email_bao_cao_tuan','')
       ELSE public.cfg_text('email_bao_cao_thang','') END          AS email_fallback,
  (SELECT string_agg(n.ho_ten || ' <' || n.email || '>', ', ')
     FROM public.nguoi_nhan_bao_cao n
     WHERE n.kich_hoat
       AND (   (upper($1) = 'TUAN'  AND n.nhan_tuan)
            OR (upper($1) = 'THANG' AND n.nhan_thang)
            OR (upper($1) = 'QUY'   AND n.nhan_quy)
            OR upper($1) NOT IN ('TUAN','THANG','QUY')))           AS nguoi_nhan`,
      options: {
        queryReplacement: expr('{{ [$json.ky, $json.tu, $json.den] }}')
      }
    },
    credentials: { postgres: { id: '4Zc8ZMCq7qPoSMtF', name: 'Supabase Postgres' } }
  },
  output: [{ bao_cao: '{"ky":"THANG"}', folder_id: 'root', email_tu: 'tienhoan.dhd@gmail.com', qc_base: 'https://quickchart.io', email_fallback: 'chanbonght@gmail.com', nguoi_nhan: null }]
});

const rapBaoCao = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Ráp báo cáo',
    position: [-400, 380],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const kyAll = $('Xác định kỳ báo cáo').all();
const items = $input.all();
const out = [];
const LOAI_VI = { SENSOR_DUNG_HINH: 'Cảm biến đứng hình (giá trị không đổi bất thường)', FMS_HTTP_LOI: 'Lỗi kết nối FMS (mất phiên lấy dữ liệu)', MAT_DU_LIEU: 'Khoảng trống dữ liệu' };
const TRANG_THAI_VI = { CHUA_XU_LY: 'Chưa xử lý', IPC_BAT_THUONG: 'IPC xác nhận bất thường', IPC_BINH_THUONG: 'IPC xác nhận bình thường', DA_KHAC_PHUC: 'Đã khắc phục', DONG_TU_DONG: 'Đóng tự động' };
const mau = (v) => (v == null ? '#94a3b8' : v >= 95 ? '#0d9488' : v >= 80 ? '#d97706' : '#b91c1c');
const fmt = (v, d = 1) => (v == null ? '—' : (+v).toFixed(d));
const muiTen = (v) => (v == null ? '' : v > 0 ? '▲' : v < 0 ? '▼' : '＝');
const deltaMau = (v, totKhiTang) => (v == null ? '#64748b' : (totKhiTang ? v >= 0 : v <= 0) ? '#0d9488' : '#b91c1c');
const uri = (svg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
function svgTrong(w, h) {
  return uri('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><rect width="100%" height="100%" fill="#f8fafc"/><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="12" fill="#94a3b8">Không có dữ liệu</text></svg>');
}
function svgDuong(points, w, h) {
  const vals = (points || []).map((p) => (p.ty_le == null ? null : +p.ty_le));
  if (!vals.length) return svgTrong(w, h);
  const padL = 36, padR = 10, padT = 12, padB = 24;
  const n = vals.length;
  const x = (i) => padL + (n <= 1 ? 0 : ((w - padL - padR) * i) / (n - 1));
  const y = (v) => padT + (h - padT - padB) * (1 - Math.max(0, Math.min(100, v)) / 100);
  let duong = '';
  vals.forEach((v, i) => { if (v == null) return; duong += (duong ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
  const luoi = [0, 25, 50, 75, 100].map((g) =>
    '<line x1="' + padL + '" y1="' + y(g).toFixed(1) + '" x2="' + (w - padR) + '" y2="' + y(g).toFixed(1) + '" stroke="#f1f5f9" stroke-width="1"/>' +
    '<text x="' + (padL - 6) + '" y="' + (y(g) + 3.5).toFixed(1) + '" text-anchor="end" font-family="Arial" font-size="10" fill="#94a3b8">' + g + '</text>').join('');
  const nhanNgay = (iso) => String(iso).slice(5).split('-').reverse().join('/');
  const chan = '<text x="' + padL + '" y="' + (h - 6) + '" font-family="Arial" font-size="10" fill="#64748b">' + nhanNgay(points[0].ngay) + '</text>' +
    '<text x="' + (w - padR) + '" y="' + (h - 6) + '" text-anchor="end" font-family="Arial" font-size="10" fill="#64748b">' + nhanNgay(points[points.length - 1].ngay) + '</text>';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<rect width="100%" height="100%" fill="#ffffff"/>' + luoi +
    '<line x1="' + padL + '" y1="' + y(80).toFixed(1) + '" x2="' + (w - padR) + '" y2="' + y(80).toFixed(1) + '" stroke="#d97706" stroke-dasharray="6 4" stroke-width="1.5"/>' +
    '<text x="' + (w - padR) + '" y="' + (y(80) - 5).toFixed(1) + '" text-anchor="end" font-family="Arial" font-size="11" fill="#d97706">Ngưỡng 80%</text>' +
    '<path d="' + duong + '" fill="none" stroke="#0d9488" stroke-width="2.2"/>' + chan + '</svg>';
  return uri(svg);
}
function svgSpark(points, w, h) {
  const vals = (points || []).map((p) => (p.ty_le == null ? null : +p.ty_le)).filter((v) => v != null);
  if (!vals.length) return svgTrong(w, h);
  const n = vals.length;
  const x = (i) => 4 + (n <= 1 ? 0 : ((w - 8) * i) / (n - 1));
  const y = (v) => 4 + (h - 8) * (1 - Math.max(0, Math.min(100, v)) / 100);
  let duong = '';
  vals.forEach((v, i) => { duong += (duong ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
  const cuoi = vals[vals.length - 1];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<rect width="100%" height="100%" fill="#ffffff"/>' +
    '<line x1="4" y1="' + y(80).toFixed(1) + '" x2="' + (w - 4) + '" y2="' + y(80).toFixed(1) + '" stroke="#e2e8f0" stroke-dasharray="4 3" stroke-width="1"/>' +
    '<path d="' + duong + '" fill="none" stroke="' + mau(cuoi) + '" stroke-width="1.8"/>' +
    '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(cuoi).toFixed(1) + '" r="2.5" fill="' + mau(cuoi) + '"/></svg>';
  return uri(svg);
}
function svgLich(points, w, h) {
  const ds = (points || []).filter((p) => p.ngay);
  if (!ds.length) return svgTrong(w, h);
  const d0 = new Date(ds[0].ngay + 'T00:00:00Z');
  const thu0 = (d0.getUTCDay() + 6) % 7;
  let soTuan = 1, maxTuan = 0;
  const cells = ds.map((p, i) => {
    const idx = thu0 + i;
    const tuan = Math.floor(idx / 7), thu = idx % 7;
    if (tuan > maxTuan) maxTuan = tuan;
    return { tuan: tuan, thu: thu, v: p.ty_le == null ? null : +p.ty_le, ngay: String(p.ngay).slice(8) };
  });
  soTuan = maxTuan + 1;
  const padL = 30, padT = 18;
  const cw = Math.min(60, Math.floor((w - padL - 8) / soTuan) - 4);
  const ch = Math.floor((h - padT - 6) / 7) - 3;
  const mauO = (v) => (v == null ? '#f1f5f9' : v >= 95 ? '#0d9488' : v >= 90 ? '#5eead4' : v >= 80 ? '#fcd34d' : '#fca5a5');
  const thuNhan = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  let body = thuNhan.map((t, i) => '<text x="' + (padL - 6) + '" y="' + (padT + i * (ch + 3) + ch / 2 + 3) + '" text-anchor="end" font-family="Arial" font-size="9" fill="#94a3b8">' + t + '</text>').join('');
  cells.forEach((c) => {
    const cx = padL + c.tuan * (cw + 4), cy = padT + c.thu * (ch + 3);
    body += '<rect x="' + cx + '" y="' + cy + '" width="' + cw + '" height="' + ch + '" rx="3" fill="' + mauO(c.v) + '"/>' +
      '<text x="' + (cx + cw / 2) + '" y="' + (cy + ch / 2 + 3) + '" text-anchor="middle" font-family="Arial" font-size="9" fill="#334155">' + c.ngay + '</text>';
  });
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<rect width="100%" height="100%" fill="#ffffff"/>' +
    '<text x="' + padL + '" y="11" font-family="Arial" font-size="10" fill="#64748b">Ô = 1 ngày · xanh ≥95 · vàng 80–95 · đỏ &lt;80 · xám: thiếu dữ liệu</text>' + body + '</svg>';
  return uri(svg);
}
const goc = 'https://raw.githubusercontent.com/tienhoandhd-droid/bms-gmp-web/main/report-templates/';
let tplChiTietGoc, tplEmailGoc, tplDashboardGoc;
try {
  tplChiTietGoc = await this.helpers.httpRequest({ url: goc + 'bao-cao-scorecard.html', json: false });
  tplEmailGoc = await this.helpers.httpRequest({ url: goc + 'email-bao-cao.html', json: false });
  tplDashboardGoc = await this.helpers.httpRequest({ url: goc + 'dashboard-tuong-tac.html', json: false });
} catch (e) {
  throw new Error('Không tải được template từ GitHub raw (' + (e.message || e) + ') — kiểm tra mạng của n8n hoặc quyền repo.');
}
function each(tpl, ten, rows, build) {
  const md = '{{#each ' + ten + '}}';
  const mk = '{{/each}}';
  let s = String(tpl), ketQua = '', idx;
  while ((idx = s.indexOf(md)) !== -1) {
    const end = s.indexOf(mk, idx);
    if (end === -1) break;
    const than = s.slice(idx + md.length, end);
    ketQua += s.slice(0, idx) + (rows || []).map((r) => build(than, r)).join('');
    s = s.slice(end + mk.length);
  }
  return ketQua + s;
}
function thay(than, obj) {
  let s = String(than);
  for (const k of Object.keys(obj)) {
    s = s.replaceAll('{{' + k + '}}', String(obj[k] == null ? '—' : obj[k]));
  }
  return s;
}
for (let i = 0; i < items.length; i++) {
  const d = items[i].json;
  let chartBase = String(d.chart_render_url || 'http://chart-render:8081');
  while (chartBase.endsWith('/')) chartBase = chartBase.slice(0, -1);
  const chartToken = String(d.chart_render_token || '').trim();
  const meta = (kyAll[i] || kyAll[0]).json;
  const bc = JSON.parse(d.bao_cao);
  const lineData = (bc.xu_huong && bc.xu_huong.nha_may) || [];
  const topXau = (bc.top_phong_rui_ro || []).slice(0, 5);
  const topTot = (bc.top_phong_tot || []).slice(0, 5);
  const theoKhu = (bc.xu_huong && bc.xu_huong.theo_khu) || [];
  const theoAhu = (bc.xu_huong && bc.xu_huong.theo_ahu) || [];
  const renderItems = [
    { key: 'chart_line', type: 'line', data: lineData.map((r) => ({ label: String(r.ngay).slice(5).split('-').reverse().join('/'), value: r.ty_le })), options: { markLine80: true }, width: 1200, height: 340 },
    { key: 'chart_heat', type: 'calendarHeatmap', data: lineData.map((r) => ({ ngay: r.ngay, gia_tri: r.ty_le })), width: 1200, height: 260 }
  ];
  topXau.forEach((ph) => renderItems.push({ key: 'spark_xau_' + ph.ma_phong, type: 'sparkline', data: (ph.chuoi || []).map((r) => ({ label: r.ngay, value: r.ty_le })), width: 240, height: 72 }));
  topTot.forEach((ph) => renderItems.push({ key: 'spark_tot_' + ph.ma_phong, type: 'sparkline', data: (ph.chuoi || []).map((r) => ({ label: r.ngay, value: r.ty_le })), width: 240, height: 72 }));
  theoKhu.forEach((k) => renderItems.push({ key: 'khu_' + k.khu_vuc, type: 'sparkline', data: (k.chuoi || []).map((r) => ({ label: r.ngay, value: r.ty_le })), width: 320, height: 90 }));
  theoAhu.forEach((a) => renderItems.push({ key: 'ahu_' + a.ahu, type: 'sparkline', data: (a.chuoi || []).map((r) => ({ label: r.ngay, value: r.ty_le })), width: 320, height: 90 }));
  let anh = {};
  let nguonChart = 'chart-render (ECharts PNG)';
  try {
    const headers = chartToken ? { Authorization: 'Bearer ' + chartToken } : undefined;
    const rb = await this.helpers.httpRequest({ method: 'POST', url: chartBase + '/render-batch', headers, body: { items: renderItems }, json: true, timeout: 90000 });
    anh = (rb && rb.images) || {};
  } catch (e) { anh = {}; nguonChart = 'SVG nội bộ (chart-render không phản hồi)'; }
  if (!anh.chart_line) anh.chart_line = svgDuong(lineData, 1200, 340);
  if (!anh.chart_heat) anh.chart_heat = svgLich(lineData, 1200, 240);
  topXau.forEach((ph) => { const k = 'spark_xau_' + ph.ma_phong; if (!anh[k]) anh[k] = svgSpark(ph.chuoi, 240, 72); });
  topTot.forEach((ph) => { const k = 'spark_tot_' + ph.ma_phong; if (!anh[k]) anh[k] = svgSpark(ph.chuoi, 240, 72); });
  theoKhu.forEach((kv) => { const k = 'khu_' + kv.khu_vuc; if (!anh[k]) anh[k] = svgSpark(kv.chuoi, 320, 90); });
  theoAhu.forEach((av) => { const k = 'ahu_' + av.ahu; if (!anh[k]) anh[k] = svgSpark(av.chuoi, 320, 90); });
  const k1 = bc.kpi_ky_nay || {}, k0 = bc.kpi_ky_truoc || {};
  const sc = bc.su_co || {};
  const dq = bc.do_phu_du_lieu || {};
  const spc = bc.spc || {};
  const mktObj = bc.mkt || {};
  const batThuong = bc.phong_xau_bat_thuong || [];
  const ngoaiLe = bc.ngoai_le || { tong_so: 0, theo_loai: [], chi_tiet: [] };
  const ai = bc.nhan_dinh_ai_gan_nhat || {};
  const dTuanThu = (k1.ty_le_tuan_thu != null && k0.ty_le_tuan_thu != null) ? +(k1.ty_le_tuan_thu - k0.ty_le_tuan_thu).toFixed(1) : null;
  const dOos = (k1.so_gio_oos != null && k0.so_gio_oos != null) ? (k1.so_gio_oos - k0.so_gio_oos) : null;
  const dSuCo = (sc.mo_trong_ky != null && sc.mo_ky_truoc != null) ? (sc.mo_trong_ky - sc.mo_ky_truoc) : null;
  const linkDrive = (d.folder_id && d.folder_id !== 'root') ? ('https://drive.google.com/drive/folders/' + d.folder_id) : 'https://drive.google.com/drive/my-drive';
  const webUrl = String(d.web_app_url || '').trim();
  const linkDashboard = webUrl ? (webUrl + (webUrl.indexOf('?') >= 0 ? '&' : '?') + 'bao_cao=' + meta.ky + '&tu=' + meta.tu + '&den=' + meta.den) : linkDrive;
  const tongTinHieu = spc.tong_tin_hieu || 0;
  const rep = {
    ky: meta.ky, ky_bao_cao: meta.ky_bao_cao, tu_ngay: meta.tu_hienthi, den_ngay: meta.den_hienthi,
    tu_ngay_iso: meta.tu, den_ngay_iso: meta.den, tao_luc: meta.tao_luc, ma_lan_chay: meta.ma_lan_chay,
    ten_file_pdf: meta.ten_file + '.pdf', logo_src: '', link_drive: linkDrive, link_dashboard: linkDashboard,
    kpi_tuan_thu: fmt(k1.ty_le_tuan_thu), kpi_tuan_thu_mau: mau(k1.ty_le_tuan_thu),
    delta_tuan_thu: (dTuanThu == null ? '—' : (dTuanThu > 0 ? '+' : '') + dTuanThu + '%'),
    delta_tuan_thu_mau: deltaMau(dTuanThu, true), delta_tuan_thu_mui_ten: muiTen(dTuanThu),
    kpi_gio_oos: (k1.so_gio_oos == null ? '—' : k1.so_gio_oos + 'h'),
    delta_oos: (dOos == null ? '—' : (dOos > 0 ? '+' : '') + dOos + 'h'),
    delta_oos_mau: deltaMau(dOos, false), delta_oos_mui_ten: muiTen(dOos),
    so_su_co_mo: sc.mo_trong_ky == null ? '—' : sc.mo_trong_ky,
    so_su_co_dong: sc.dong_trong_ky == null ? '—' : sc.dong_trong_ky,
    delta_su_co: (dSuCo == null ? '—' : (dSuCo > 0 ? '+' : '') + dSuCo),
    delta_su_co_mau: deltaMau(dSuCo, false), delta_su_co_mui_ten: muiTen(dSuCo),
    mttr_gio: fmt(sc.mttr_gio),
    so_tin_hieu_spc: tongTinHieu, kpi_spc_mau: tongTinHieu > 0 ? '#d97706' : '#0d9488',
    so_scope_ngoai_ks: spc.so_scope_ngoai_ks || 0,
    kpi_dq: fmt(dq.dq_tb_pct), kpi_dq_mau: mau(dq.dq_tb_pct),
    so_ngay_thieu_dl: dq.so_ngay_thieu == null ? '—' : dq.so_ngay_thieu,
    phong_thieu_dl: (dq.phong_thieu_nhat || []).map((p) => p.ma_phong + ' (' + fmt(p.dq_pct) + '%)').join(', ') || '—',
    kpi_mkt_max: fmt(mktObj.mkt_max, 2),
    kpi_mkt_mau: (mktObj.mkt_max != null && +mktObj.mkt_max > 25) ? '#b91c1c' : '#0f172a',
    kpi_mkt_phong: mktObj.mkt_max_phong || '—',
    chart_line_src: anh.chart_line, chart_heat_src: anh.chart_heat,
    nhan_dinh_ai: ai.noi_dung || 'Chưa có nhận định AI trong kỳ.',
    ai_model_dung: ai.model_dung || '—', ai_tao_luc: ai.tao_luc || '—',
    so_phong_bat_thuong: batThuong.length, so_ngoai_le: ngoaiLe.tong_so || 0,
    ket_luan_kiem_soat: (tongTinHieu === 0 && batThuong.length === 0)
      ? 'Duy trì trạng thái kiểm soát trong kỳ — không có tín hiệu SPC, không có phòng xấu đi bất thường.'
      : ('CÓ XU HƯỚNG BẤT LỢI cần điều tra: ' + tongTinHieu + ' tín hiệu SPC, ' + batThuong.length + ' phòng xấu đi bất thường (mục 6) — QA lập phiếu điều tra/deviation trước kỳ tiếp theo.'),
    tom_tat_dieu_hanh: 'Kỳ ' + meta.ky_bao_cao + ': tuân thủ toàn nhà máy ' + fmt(k1.ty_le_tuan_thu) + '% (' +
      (dTuanThu == null ? 'không so được kỳ trước' : (dTuanThu >= 0 ? 'tăng ' : 'giảm ') + Math.abs(dTuanThu) + ' điểm so kỳ trước') + '), ' +
      (k1.so_gio_oos == null ? '—' : k1.so_gio_oos) + ' giờ ở trạng thái cảnh báo (WARNING/CRITICAL), ' +
      (sc.mo_trong_ky == null ? 0 : sc.mo_trong_ky) + ' sự cố mở trong kỳ (MTTR ' + fmt(sc.mttr_gio) + 'h). ' +
      (batThuong.length ? ('⚠ ' + batThuong.length + ' phòng xấu đi bất thường cần rà soát (mục 6). ') : 'Không phát hiện phòng xấu đi bất thường. ') +
      (tongTinHieu > 0 ? (tongTinHieu + ' tín hiệu SPC cần theo dõi.') : 'SPC trong kiểm soát.'),
  };
  let tplChiTiet = tplChiTietGoc;
  let tplEmail = tplEmailGoc;
  tplChiTiet = each(tplChiTiet, 'top_phong_xau', topXau, (t, r) => thay(t, Object.assign({}, r, { ty_le_tuan_thu: fmt(r.ty_le_tuan_thu), so_gio_oos: (r.so_gio_oos == null ? '—' : r.so_gio_oos), mau: mau(r.ty_le_tuan_thu), spark_src: anh['spark_xau_' + r.ma_phong] || '' })));
  tplChiTiet = each(tplChiTiet, 'top_phong_tot', topTot, (t, r) => thay(t, Object.assign({}, r, { ty_le_tuan_thu: fmt(r.ty_le_tuan_thu), so_gio_oos: (r.so_gio_oos == null ? '—' : r.so_gio_oos), spark_src: anh['spark_tot_' + r.ma_phong] || '' })));
  tplChiTiet = each(tplChiTiet, 'xu_huong_khu', theoKhu, (t, r) => thay(t, { khu_vuc: r.khu_vuc, ty_le_tb: fmt(r.ty_le_tb), mau: mau(r.ty_le_tb), mini_src: anh['khu_' + r.khu_vuc] || '' }));
  tplChiTiet = each(tplChiTiet, 'xu_huong_ahu', theoAhu, (t, r) => thay(t, { ahu: r.ahu, ty_le_tb: fmt(r.ty_le_tb), mau: mau(r.ty_le_tb), mini_src: anh['ahu_' + r.ahu] || '' }));
  tplChiTiet = each(tplChiTiet, 'phong_xau_bat_thuong', batThuong, (t, r) => thay(t, Object.assign({}, r, { tuan_thu_ky_nay: fmt(r.tuan_thu_ky_nay), tuan_thu_ky_truoc: fmt(r.tuan_thu_ky_truoc), delta: (r.delta == null ? '—' : (r.delta > 0 ? '+' : '') + fmt(r.delta)), ly_do_html: (r.ly_do || []).map((x) => '<span class="the-ly-do">' + x + '</span>').join(' ') })));
  tplChiTiet = each(tplChiTiet, 'ngoai_le_theo_loai', ngoaiLe.theo_loai || [], (t, r) => thay(t, { loai_vi: LOAI_VI[r.loai] || r.loai, so_lan: r.so_lan, dien_giai: r.dien_giai || '' }));
  tplChiTiet = each(tplChiTiet, 'su_co_tieu_bieu', sc.tieu_bieu || [], (t, r) => thay(t, Object.assign({}, r, { trang_thai: TRANG_THAI_VI[r.trang_thai] || r.trang_thai })));
  tplChiTiet = each(tplChiTiet, 'spc_chi_tiet', spc.chi_tiet || [], (t, r) => thay(t, r));
  tplChiTiet = each(tplChiTiet, 'mkt_chi_tiet', mktObj.chi_tiet || [], (t, r) => thay(t, Object.assign({}, r, { mkt: fmt(r.mkt, 2), t_tb: fmt(r.t_tb, 2), t_max: fmt(r.t_max, 2) })));
  tplChiTiet = each(tplChiTiet, 'gioi_han_tham_chieu', bc.gioi_han_tham_chieu || [], (t, r) => thay(t, r));
  tplChiTiet = thay(tplChiTiet, rep);
  tplEmail = each(tplEmail, 'top_phong_xau', topXau, (t, r) => thay(t, Object.assign({}, r, { ty_le_tuan_thu: fmt(r.ty_le_tuan_thu), so_gio_oos: (r.so_gio_oos == null ? '—' : r.so_gio_oos), mau: mau(r.ty_le_tuan_thu), delta: '—', delta_mau: '#64748b' })));
  tplEmail = each(tplEmail, 'bat_thuong_tom_tat', batThuong.slice(0, 5), (t, r) => thay(t, Object.assign({}, r, { tuan_thu_ky_nay: fmt(r.tuan_thu_ky_nay), delta: (r.delta == null ? '—' : (r.delta > 0 ? '+' : '') + fmt(r.delta) + '%'), ly_do: (r.ly_do || []).join(' · ') })));
  tplEmail = thay(tplEmail, rep);
  // ---- Dashboard TƯƠNG TÁC: nhúng JSON báo cáo (escape '<' để không phá </script>) ----
  const duLieuDashboard = JSON.stringify({ meta: meta, bc: bc }).replace(/</g, '\\u003c');
  const tplDashboard = tplDashboardGoc.replace('{{DATA_JSON}}', duLieuDashboard);
  const emailTo = String(d.nguoi_nhan || '').trim() || String(d.email_fallback || '').trim();
  const binHtml = await this.helpers.prepareBinaryData(Buffer.from(tplChiTiet, 'utf8'), 'index.html', 'text/html');
  const binDashboard = await this.helpers.prepareBinaryData(Buffer.from(tplDashboard, 'utf8'), 'dashboard.html', 'text/html');
  out.push({
    json: Object.assign({}, meta, {
      folder_id: d.folder_id, email_tu: d.email_tu, email_to: emailTo,
      html_email: tplEmail, nguon_chart: nguonChart, link_dashboard: linkDashboard,
      tieu_de_email: '[BMS-GMP] Báo cáo ' + meta.ky_bao_cao + ' — tuân thủ ' + rep.kpi_tuan_thu + '% ' + rep.delta_tuan_thu_mui_ten + rep.delta_tuan_thu,
    }),
    binary: { bao_cao_html: binHtml, dashboard_html: binDashboard },
    pairedItem: { item: i }
  });
}
return out;`
    }
  },
  output: [{ ky: 'THANG', tu: '2026-06-01', den: '2026-06-30', ky_bao_cao: 'THÁNG 06/2026', ma_lan_chay: 'WF5V2-THANG-2026-06-30-1234', ten_file: 'BaoCao-GMP-THANG-2026-06-30', folder_id: 'root', email_tu: 'tienhoan.dhd@gmail.com', email_to: 'chanbonght@gmail.com', html_email: '<html>…</html>', tieu_de_email: '[BMS-GMP] Báo cáo THÁNG 06/2026 — tuân thủ 42.99% ▼-5.6%', nguon_chart: 'SVG nội bộ' }]
});

const gotenberg = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Gotenberg — HTML sang PDF',
    position: [-140, 380],
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 3000,
    parameters: {
      method: 'POST',
      url: expr("{{ $('Supabase — số liệu + cấu hình + người nhận').item.json.gotenberg_url }}/forms/chromium/convert/html"),
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: {
        parameters: [
          { parameterType: 'formBinaryData', name: 'files', inputDataFieldName: 'bao_cao_html' },
          // printBackground=true: BẮT BUỘC — nếu không PDF mất nền header xanh đậm
          // + các ô KPI/bất thường có màu (template dựa print-color-adjust:exact).
          { name: 'printBackground', value: 'true' },
          // preferCssPageSize=true: dùng @page { size:A4; margin:… } của template.
          { name: 'preferCssPageSize', value: 'true' },
          // Giữ paperWidth/Height + margin làm dự phòng (bị bỏ qua khi có @page CSS).
          { name: 'paperWidth', value: '8.27' },
          { name: 'paperHeight', value: '11.69' },
          { name: 'marginTop', value: '0.4' },
          { name: 'marginBottom', value: '0.4' }
        ]
      },
      options: {
        timeout: 120000,
        response: { response: { responseFormat: 'file', outputPropertyName: 'bao_cao_pdf' } }
      }
    }
  },
  output: [{}]
});

const gopFile = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Gộp file xuất',
    position: [100, 380],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const rap = $('Ráp báo cáo').all();
const pdfItems = $input.all();
const out = [];
for (let i = 0; i < rap.length; i++) {
  const gocItem = rap[i];
  const binary = {};
  binary.bao_cao_html = Object.assign({}, gocItem.binary.bao_cao_html, { fileName: gocItem.json.ten_file + '.html' });
  // Dashboard tương tác (đính kèm + lưu Drive)
  binary.dashboard_html = Object.assign({}, gocItem.binary.dashboard_html, { fileName: 'Dashboard-' + gocItem.json.ten_file + '.html' });
  const pdfBin = pdfItems[i] && pdfItems[i].binary && pdfItems[i].binary.bao_cao_pdf;
  if (pdfBin) {
    binary.bao_cao_pdf = Object.assign({}, pdfBin, { fileName: gocItem.json.ten_file + '.pdf', mimeType: 'application/pdf' });
  }
  out.push({
    json: Object.assign({}, gocItem.json, { co_pdf: !!pdfBin }),
    binary: binary,
    pairedItem: { item: i }
  });
}
return out;`
    }
  },
  output: [{ ky: 'THANG', ten_file: 'BaoCao-GMP-THANG-2026-06-30', folder_id: 'root', email_to: 'chanbonght@gmail.com', email_tu: 'tienhoan.dhd@gmail.com', tieu_de_email: '[BMS-GMP] Báo cáo THÁNG 06/2026', html_email: '<html>…</html>', co_pdf: true, ma_lan_chay: 'WF5V2-THANG-2026-06-30-1234', tu: '2026-06-01', den: '2026-06-30', nguon_kich_hoat: 'LICH' }]
});

const drivePdf = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Drive — lưu PDF',
    position: [360, 200],
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 3000,
    parameters: {
      resource: 'file',
      operation: 'upload',
      authentication: 'serviceAccount',
      inputDataFieldName: 'bao_cao_pdf',
      name: expr('{{ $json.ten_file }}.pdf'),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr('{{ $json.folder_id }}') },
      options: {}
    },
    credentials: { googleApi: { id: 'uqbMxdAY6BDmg4Ez', name: 'kết nối google' } }
  },
  output: [{ id: '1AbCdEf', name: 'BaoCao-GMP-THANG-2026-06-30.pdf', webViewLink: 'https://drive.google.com/file/d/1AbCdEf/view' }]
});

const driveHtml = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Drive — lưu Dashboard',
    position: [360, 380],
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 3000,
    parameters: {
      resource: 'file',
      operation: 'upload',
      authentication: 'serviceAccount',
      inputDataFieldName: 'dashboard_html',
      name: expr('Dashboard-{{ $json.ten_file }}.html'),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr('{{ $json.folder_id }}') },
      options: {}
    },
    credentials: { googleApi: { id: 'uqbMxdAY6BDmg4Ez', name: 'kết nối google' } }
  },
  output: [{ id: '1XyZ', name: 'Dashboard-BaoCao-GMP-THANG-2026-06-30.html' }]
});

const coNguoiNhan = ifElse({
  version: 2.2,
  config: {
    name: 'Có người nhận email?',
    position: [360, 560],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr('{{ $json.email_to }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }
        ],
        combinator: 'and'
      }
    }
  }
});

const guiEmail = node({
  type: 'n8n-nodes-base.emailSend',
  version: 2.1,
  config: {
    name: 'Gửi email báo cáo',
    position: [620, 560],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      fromEmail: expr('{{ $json.email_tu }}'),
      toEmail: expr('{{ $json.email_to }}'),
      subject: expr('{{ $json.tieu_de_email }}'),
      emailFormat: 'html',
      html: expr('{{ $json.html_email }}'),
      options: {
        appendAttribution: false,
        fileAttachments: expr("{{ ($json.co_pdf ? 'bao_cao_pdf' : 'bao_cao_html') + ',dashboard_html' }}")
      }
    },
    credentials: { smtp: { id: 'sTnd4TyfGjyiau4W', name: 'Gmail SMTP' } }
  },
  output: [{ messageId: '<abc@mail.gmail.com>', accepted: ['chanbonght@gmail.com'] }]
});

const ghiNhatKy = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Ghi nhật ký báo cáo',
    position: [620, 200],
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'database',
      operation: 'executeQuery',
      query: `INSERT INTO public.nhat_ky_chay_workflow
  (thuoc_thu_nghiem, ten_workflow, ma_lan_chay_n8n, trang_thai, bat_dau, ket_thuc, du_lieu)
VALUES
  (public.cfg_bool('che_do_thu_nghiem', true), 'WF5_BAO_CAO_V2', $1, 'ok', now(), now(),
   jsonb_build_object('ky', $2, 'tu', $3, 'den', $4, 'ten_file', $5,
                      'drive_file_id', $6, 'nguon_kich_hoat', $7))
RETURNING id`,
      options: {
        queryReplacement: expr("{{ [$('Gộp file xuất').item.json.ma_lan_chay, $('Gộp file xuất').item.json.ky, $('Gộp file xuất').item.json.tu, $('Gộp file xuất').item.json.den, $('Gộp file xuất').item.json.ten_file, $json.id || '', $('Gộp file xuất').item.json.nguon_kich_hoat] }}")
      }
    },
    credentials: { postgres: { id: '4Zc8ZMCq7qPoSMtF', name: 'Supabase Postgres' } }
  },
  output: [{ id: 123 }]
});

const ghiChu = sticky(
  `## BMS WF5 v2 — Báo cáo quản trị (scorecard + PDF + email)

**Kích hoạt:** (1) Lịch UTC: T2 00:00 (=07:00 VN, báo cáo TUẦN trước) · ngày 1 00:15 (=07:15 VN, báo cáo THÁNG trước, kèm QUÝ nếu là tháng 1/4/7/10). (2) Webhook POST /webhook/wf5-bao-cao-bu — nút "Gửi báo cáo bù" trên web, body {"ky":"THANG"|"TUAN"|"QUY"} hoặc {"tu":"YYYY-MM-DD","den":"YYYY-MM-DD"}.

**Số liệu:** 1 nguồn duy nhất rpc_bao_cao_tong_hop (truy vết GMP, đã đối chiếu schema thật 03/07/2026).

**Người nhận:** bảng nguoi_nhan_bao_cao (kich_hoat=true + cờ nhan_tuan/thang/quy). Chưa có ai kích hoạt → fallback cau_hinh.email_bao_cao_thang/tuan.

**Biểu đồ:** URL từ cau_hinh.chart_render_url (mặc định http://chart-render:8081, token cau_hinh.chart_render_token); không phản hồi → tự vẽ SVG nội bộ, báo cáo KHÔNG chết. Email dùng QuickChart PNG (Gmail chặn SVG).

**PDF:** Gotenberg từ cau_hinh.gotenberg_url (mặc định http://gotenberg:3000, printBackground+preferCssPageSize → giữ nền header + ô KPI màu); lỗi → email đính kèm HTML thay PDF. (KHÔNG dùng $env — instance này chặn $env.)

**Drive:** cau_hinh.drive_folder_id_bao_cao ('root' = My Drive). Nhật ký: nhat_ky_chay_workflow (WF5_BAO_CAO_V2).

**Dựng chart-render + Gotenberg:** cd services && cp .env.example .env && docker compose up -d --build`,
  [],
  { color: 4, position: [-1180, -240], width: 620, height: 400 }
);

export default workflow('wf5-v2-bao-cao-quan-tri', 'BMS WF5 v2 — Báo cáo quản trị tuần/tháng/quý (scorecard + PDF + email)')
  .add(lichTuDong)
  .to(xacDinhKy)
  .to(docSoLieu)
  .to(rapBaoCao)
  .to(gotenberg)
  .to(gopFile)
  .to(drivePdf.to(ghiNhatKy))
  .add(gopFile)
  .to(driveHtml)
  .add(gopFile)
  .to(coNguoiNhan.onTrue(guiEmail))
  .add(webhookBu)
  .to(xacDinhKy)
  .add(ghiChu);
