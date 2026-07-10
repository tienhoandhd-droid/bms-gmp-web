// ============================================================
// supabaseData.js — Ánh xạ dữ liệu Supabase ↔ hình dạng mockup
// v10.3 (2026): ĐỐI CHIẾU CHÍNH XÁC từng cột với 06_view_dashboard.sql +
//   08_rpc_doc_du_lieu.sql + 05_quy_tac_va_lich_su.sql. Sửa toàn bộ lệch cột
//   ở các hàm đọc; PROJECTION CỘT (chỉ kéo cột cần → giảm payload); dùng sẵn
//   cột đã-định-dạng của view (…_hien_thi); SỬA máy trạng thái sự cố để khớp
//   state machine thật trong DB (mã trạng thái + mã hành động).
//
// Quy ước trả về: mọi hàm đọc trả { error, <khóa-dữ-liệu> }.
//   error=null khi OK. Nếu lỗi, phần dữ liệu = null/[] (UI tự fail-mềm).
// ============================================================
import { docView, goiRPC, supabase } from './bmsClient'
import { SUPABASE_URL } from './config'

// ---- Máy trạng thái sự cố: MÃ trong DB ↔ NHÃN mà UI (STATUS_FLOW) dùng ----
// DB lưu MÃ (CHUA_XU_LY,…); UI mockup khóa state bằng nhãn tiếng Việt.
// Bảng dưới gộp các mã DB về đúng 6 nhãn UI để luồng phê duyệt chạy liền mạch.
export const TRANG_THAI_CODE_TO_LABEL = {
  CHUA_XU_LY:                'Chưa xử lý',
  MO_LAI:                    'Chưa xử lý',           // mở lại → coi như đầu luồng
  IPC_TIEP_NHAN:             'Chưa xử lý',           // DB cho phép IPC xác nhận bất thường tiếp
  IPC_BAT_THUONG:            'IPC: bất thường',
  DA_BAO_CO_DIEN:            'Đã báo cơ điện',
  CO_DIEN_DANG_XU_LY:        'Cơ điện đang xử lý',
  CO_DIEN_CHO_XU_LY:         'Cơ điện chờ xử lý',    // v14: hoãn có chủ đích, vẫn nhắc
  CO_DIEN_KHONG_XU_LY_DUOC:  'Không xử lý được',     // → Trực HSL điều phối
  CO_DIEN_DA_XU_LY:          'Chờ IPC kiểm lại',
  CHO_QA_KIEM_LAI:           'Chờ IPC kiểm lại',
  DA_KHAC_PHUC:              'Đã khắc phục',
  IPC_BINH_THUONG:           'Đã khắc phục',         // đóng (bình thường)
  DONG_TU_DONG:              'Đã khắc phục',         // đóng (tự động)
  DONG_NGOAI_PHAM_VI:        'Đóng — ngoài phạm vi',  // v14: phòng P3, cảm biến có thể VẪN lệch dải
}

// Nhãn hành động trên UI (STATUS_FLOW.label) → MÃ hành động RPC (khớp seed
// quy_tac_chuyen_trang_thai). LƯU Ý: bước đầu phải là 'ipc_bat_thuong'
// (CHUA_XU_LY → IPC_BAT_THUONG), KHÔNG phải 'ipc_tiep_nhan' (→ IPC_TIEP_NHAN),
// nếu không DB sẽ trả CHUYEN_TRANG_THAI_KHONG_HOP_LE.
export const ACTION_LABEL_TO_CODE = {
  'IPC tiếp nhận':          'ipc_bat_thuong',
  'Báo cơ điện':            'ipc_bao_co_dien',
  'Cơ điện tiếp nhận':      'mep_tiep_nhan',
  'Báo đã xử lý':           'mep_xu_ly_xong',
  'QA xác nhận khắc phục':  'qa_da_khac_phuc',
}

// MÃ hành động → nhãn hiển thị (nhật ký/trail).
// Nút bấm thì lấy từ DB (view xem_nut_thao_tac); bảng này CHỈ để dịch mã trong
// nhật ký, kể cả các hành động không bao giờ thành nút (quản trị/hệ thống).
const ACTION_CODE_TO_LABEL = {
  // IPC — bộ 4 nút v14
  ipc_binh_thuong: 'IPC: đã kiểm tra, bình thường',
  ipc_da_khac_phuc: 'IPC: đã khắc phục sự cố',
  ipc_bao_co_dien: 'IPC: chuyển Cơ điện xử lý',
  ipc_vang: 'IPC: không có ở hiện trường',
  // Cơ điện — bộ 4 nút v14
  mep_tiep_nhan: 'Cơ điện: đã nhận, đang xử lý',
  mep_xu_ly_xong: 'Cơ điện: đã khắc phục',
  mep_khong_xu_ly_duoc: 'Cơ điện: không thể xử lý',
  mep_cho_xu_ly: 'Cơ điện: chờ xử lý (khi rảnh)',
  mep_vang: 'Cơ điện: không có ở hiện trường',
  // Trực hồ sơ lô
  lot_nhac_ipc: 'Trực HSL: nhắc IPC',
  lot_nhac_co_dien: 'Trực HSL: nhắc Cơ điện',
  lot_tam_dung_4h: 'Trực HSL: tạm dừng cảnh báo 4 giờ',
  dung_canh_bao: 'Dừng cảnh báo', bat_lai_canh_bao: 'Bật lại cảnh báo',
  // QA / Quản trị / Hệ thống
  qa_da_khac_phuc: 'QA xác nhận khắc phục', qa_mo_lai: 'QA mở lại',
  admin_dong: 'Quản trị đóng (đã khắc phục)',
  admin_mo_lai: 'Quản trị mở lại',
  // Đóng vì phòng ngoài phạm vi cảnh báo — KHÔNG có nghĩa đã khắc phục
  admin_dong_ngoai_pham_vi: 'Quản trị đóng — phòng ngoài phạm vi cảnh báo',
  he_thong_dong_tu_dong: 'Hệ thống tự đóng (giá trị về dải)',
  // Hệ thống tự chuyển khi CRITICAL quá ngưỡng mà IPC chưa thao tác — KHÔNG phải IPC bấm
  tu_phan_tuyen_co_dien: 'Hệ thống tự chuyển Cơ điện (quá hạn)',
  // Đã khai tử từ v14, giữ để dịch nhật ký cũ
  ipc_tiep_nhan: 'IPC tiếp nhận', ipc_bat_thuong: 'IPC xác nhận bất thường', ipc_cho: 'IPC chờ xử lý',
  mep_cho: 'Cơ điện chờ', ipc_kiem_lai_dat: 'IPC kiểm lại: đạt', ipc_kiem_lai_khong_dat: 'IPC kiểm lại: không đạt',
  lot_nhac_nho: 'Trực HSL nhắc nhở', lot_ghi_chu: 'Trực HSL ghi chú', lot_leo_thang: 'Trực HSL leo thang',
}
const nhanHanhDong = (ma) => ACTION_CODE_TO_LABEL[ma] || ma || ''

const SENSOR_LABEL = { DP: 'Chênh áp (DP)', RH: 'Độ ẩm (RH)', T: 'Nhiệt độ (T)' }
// timestamptz ISO (UTC) → "YYYY-MM-DD HH:MM:SS" theo giờ địa phương trình duyệt (VN)
const fmtTS = (s, dai = 19) => {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d)) return String(s).replace('T', ' ').slice(0, dai)
  return d.toLocaleString('sv-SE').slice(0, dai)   // 'sv-SE' = "YYYY-MM-DD HH:MM:SS"
}

// ============================================================
// TỔNG QUAN (4 ô KPI)  ·  view: xem_tong_quan
// cột: tong_phong, phong_dat, phong_khong_dat, phong_thieu_dl, su_co_dang_mo
// ============================================================
export async function layTongQuan(signal) {
  const { data, error } = await docView('xem_tong_quan',
    (q) => q.select('tong_phong,phong_dat,phong_khong_dat,phong_thieu_dl,su_co_dang_mo'), { signal })
  if (error || !data?.length) return { error, kpis: null }
  const r = data[0]
  return {
    error: null,
    kpis: {
      tong: r.tong_phong ?? 0,
      dat: r.phong_dat ?? 0,
      khongDat: r.phong_khong_dat ?? 0,
      thieuDL: r.phong_thieu_dl ?? 0,
      suCoMo: r.su_co_dang_mo ?? 0,
    },
  }
}

// ============================================================
// DANH SÁCH PHÒNG  ·  view: xem_phong_co_kpi
// cột: ma_phong, ten_phong, khu_vuc, ahu, muc_uu_tien, thieu_du_lieu, ghi_chu,
//      ti_le_dat_1h, muc_canh_bao_phong, cam_bien[{loai_cam_bien,gioi_han_duoi,gioi_han_tren,don_vi}]
// ============================================================
export async function layDanhSachPhong(signal) {
  const { data, error } = await docView('xem_phong_co_kpi',
    (q) => q.select('ma_phong,ten_phong,khu_vuc,ahu,muc_uu_tien,thieu_du_lieu,ghi_chu,ti_le_dat_1h,muc_canh_bao_phong,cam_bien,lan_cuoi_co_du_lieu,cua_so_gio,tre_phut').order('ma_phong'),
    { signal })
  if (error) return { error, rooms: null }
  const rooms = (data || []).map((r) => ({
    id: r.ma_phong,
    name: r.ten_phong || r.ma_phong,
    area: r.khu_vuc || '',
    ahu: r.ahu || '',
    priority: r.muc_uu_tien || 'P3',
    note: r.ghi_chu || '',
    noData: !!r.thieu_du_lieu,
    lastSeen: r.lan_cuoi_co_du_lieu || null,        // 'DD/MM HH:MM' = MỐC ĐÓNG cửa sổ giờ (giờ VN)
    window: r.cua_so_gio || null,                   // 'HH:MM–HH:MM' = khung giờ của bản ghi gần nhất
    agePhut: r.tre_phut != null ? Number(r.tre_phut) : null,  // số phút kể từ mốc đóng cửa sổ
    _isLive: true,
    _compliance: r.ti_le_dat_1h != null ? Math.round(r.ti_le_dat_1h) : null,
    _level: mucCanhBaoToLevel(r.muc_canh_bao_phong),
    sensors: Array.isArray(r.cam_bien)
      ? r.cam_bien.map((c) => ({
          k: c.loai_cam_bien,
          min: c.gioi_han_duoi != null ? Number(c.gioi_han_duoi) : null,
          max: c.gioi_han_tren != null ? Number(c.gioi_han_tren) : null,
        }))
      : [],
  }))
  return { error: null, rooms }
}

// Chi tiết cảm biến + thống kê 8h cho 1 phòng (modal/thẻ phòng)
// RPC: rpc_thong_ke_sensor_phong(p_ma_phong) → MẢNG
//   [{loai_cam_bien, hourly_8:[{label,avg,min,max,oos,oos_pct,severity}],
//     gia_tri_tb_1h, oos_1h (ĐẾM điểm/giờ 0..60), dq_1h, muc_canh_bao_1h}]
// Map 1 dòng sensor thô (RPC/view) → hình dạng UI. DÙNG CHUNG cho cả bản
// per-phòng và bản batch nhiều-phòng để đảm bảo KHÔNG lệch shape (an toàn GMP).
function mapSensorRow(s) {
  return {
    k: s.loai_cam_bien,
    cur: s.gia_tri_tb_1h,
    avg1h: s.gia_tri_tb_1h,
    oos1h: s.oos_1h != null ? Math.round(s.oos_1h) : 0,     // đã là SỐ ĐIỂM/giờ
    dq1h: s.dq_1h,
    level: mucCanhBaoToLevel(s.muc_canh_bao_1h),
    // #3 — OOS 10 phút cuối + giới hạn dưới/trên + giờ chốt của bản ghi gần nhất
    oos10: s.oos_10phut_cuoi != null ? Math.round(s.oos_10phut_cuoi) : null,
    min: s.gioi_han_duoi != null ? Number(s.gioi_han_duoi) : null,
    max: s.gioi_han_tren != null ? Number(s.gioi_han_tren) : null,
    lanCuoi: s.lan_cuoi || null,
    // map cả min/max theo giờ → vmin/vmax để biểu đồ chi tiết vẽ dải min–max
    hourly8: (s.hourly_8 || []).map((h) => ({ label: h.label, avg: h.avg, oos: h.oos, vmin: h.min ?? null, vmax: h.max ?? null })),
  }
}

export async function layThongKeSensorPhong(maPhong, signal) {
  const { data, error } = await goiRPC('rpc_thong_ke_sensor_phong', { p_ma_phong: maPhong }, { signal })
  if (error || !Array.isArray(data)) return { error, sensors: [] }
  return { error: null, sensors: data.map(mapSensorRow) }
}

// ============================================================
// BATCH thống kê 8h cho NHIỀU phòng trong 1 round-trip (diệt N+1)
// RPC: rpc_thong_ke_sensor_nhieu_phong(p_ma_phong text[]) → jsonb
//   { "<ma_phong>": [ {loai_cam_bien, hourly_8, gia_tri_tb_1h, oos_1h, dq_1h,
//     muc_canh_bao_1h, gioi_han_duoi/tren, oos_10phut_cuoi, lan_cuoi}, … ], … }
// Trả { error, theoPhong: { maPhong: [mappedSensors] } }. Nếu RPC CHƯA deploy
// hoặc lỗi → error != null & theoPhong=null → caller tự lùi về per-phòng (N+1).
// ============================================================
export async function layThongKeSensorNhieuPhong(maPhongArr, signal) {
  const arr = Array.isArray(maPhongArr) && maPhongArr.length ? maPhongArr : null
  const { data, error } = await goiRPC('rpc_thong_ke_sensor_nhieu_phong', { p_ma_phong: arr }, { signal })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: error || new Error('BATCH_EMPTY'), theoPhong: null }
  }
  const theoPhong = {}
  for (const [ma, rows] of Object.entries(data)) {
    theoPhong[ma] = Array.isArray(rows) ? rows.map(mapSensorRow) : []
  }
  return { error: null, theoPhong }
}

// ============================================================
// SỰ CỐ ĐANG MỞ  ·  view: xem_su_co_dang_mo
// cột: ma_hien_thi, ma_su_co, phong, ten_phong, uu_tien, cam_bien_vi,
//      loai_cam_bien, muc_canh_bao, trang_thai, bat_dau, keo_dai_gio,
//      da_tat_canh_bao, lich_su[{t,who,role,act,ly_do}]
// ============================================================
export async function laySuCoDangMo(signal) {
  const { data, error } = await docView('xem_su_co_dang_mo',
    (q) => q.select('ma_hien_thi,ma_su_co,phong,ten_phong,uu_tien,cam_bien_vi,loai_cam_bien,muc_canh_bao,trang_thai,bat_dau,keo_dai_gio,da_tat_canh_bao,lich_su,huong_vi_pham,gia_tri_gan_nhat,gioi_han_duoi,gioi_han_tren,don_vi,thoi_diem_so_lieu,muc_gan_nhat'),
    { signal })
  if (error) return { error, incidents: null }
  const incidents = (data || []).map((r) => ({
    dbId: r.ma_su_co,                                       // BIGINT → cho RPC
    id: r.ma_hien_thi || `SC-${r.ma_su_co}`,
    room: r.phong,
    roomName: r.ten_phong,
    sensor: r.cam_bien_vi || SENSOR_LABEL[r.loai_cam_bien] || r.loai_cam_bien || '—',
    huong: r.huong_vi_pham || null,   // 'THAP' | 'CAO' | 'HAI' | null — hướng vi phạm
    giaTriGanNhat: r.gia_tri_gan_nhat ?? null,   // số liệu giờ gần nhất
    gioiHanDuoi: r.gioi_han_duoi ?? null,
    gioiHanTren: r.gioi_han_tren ?? null,
    donVi: r.don_vi || '',
    thoiDiemSoLieu: r.thoi_diem_so_lieu || null,
    mucGanNhat: r.muc_gan_nhat || null,   // NORMAL/WARNING/CRITICAL của giờ gần nhất


    priority: r.uu_tien || 'P3',
    start: fmtTS(r.bat_dau),
    startTs: r.bat_dau ? new Date(r.bat_dau).getTime() : null,   // ms — overlay ⚑ lên biểu đồ xu hướng
    duration: r.keo_dai_gio != null ? +(+r.keo_dai_gio).toFixed(1) : 0,
    statusCode: r.trang_thai,
    status: TRANG_THAI_CODE_TO_LABEL[r.trang_thai] || r.trang_thai,
    silenced: !!r.da_tat_canh_bao,
    trail: Array.isArray(r.lich_su)
      ? r.lich_su.map((t) => ({
          t: t.t || '',
          who: t.who ? `${t.who}${t.role ? ' (' + t.role + ')' : ''}` : 'Hệ thống',
          act: nhanHanhDong(t.act) + (t.ly_do ? `: ${t.ly_do}` : ''),
        }))
      : [],
  }))
  return { error: null, incidents }
}

// ============================================================
// CẢNH BÁO HỆ THỐNG (sidebar)  ·  view: xem_canh_bao_he_thong
// cột: thu_tu, muc_do (critical/warning/normal), thong_bao, phu_de
// ============================================================
export async function layCanhBaoHeThong(signal) {
  const { data, error } = await docView('xem_canh_bao_he_thong',
    (q) => q.select('thu_tu,muc_do,thong_bao,phu_de').order('thu_tu'), { signal })
  if (error) return { error, alerts: null }
  const alerts = (data || []).map((r) => ({
    kind: (r.muc_do || 'normal').toLowerCase(),
    text: r.thong_bao || '',
    sub: r.phu_de || '',
  }))
  return { error: null, alerts }
}

// ============================================================
// XU HƯỚNG  ·  RPC: rpc_lay_chuoi_xu_huong(scope_type,scope_id,sensor,so_ngay)
// → MẢNG theo NGÀY: [{label, ts(ms), comp, oos, critH, warnH, dq}]
// ============================================================
export async function layChuoiXuHuong(scopeType, scopeId, sensorType, soNgay, signal) {
  const { data, error } = await goiRPC('rpc_lay_chuoi_xu_huong', {
    p_scope_type: scopeType, p_scope_id: scopeId, p_sensor: sensorType || 'ALL', p_so_ngay: soNgay,
  }, { signal })
  if (error || !Array.isArray(data)) return { error, series: [] }
  const series = data.map((r) => ({
    label: r.label,
    ts: r.ts != null ? Number(r.ts) : null,
    comp: r.comp,
    dq: r.dq != null ? Math.round(r.dq) : null,
    warnH: r.warnH ?? 0,
    critH: r.critH ?? 0,
    alert: +(((r.warnH ?? 0) + (r.critH ?? 0))).toFixed(2),
    oos: r.oos ?? 0,
  }))
  return { error: null, series }
}

// ============================================================
// XU HƯỚNG CHI TIẾT (THEO GIỜ / THEO CẢM BIẾN)  ·  RPC: rpc_lay_chuoi_xu_huong_v2
// donVi: 'GIO' (N giờ gần nhất) | 'NGAY' (N ngày). sensorType: ALL/DP/RH/T.
// → MẢNG cùng hình dạng layChuoiXuHuong: [{label, ts, comp, dq, warnH, critH, alert, oos}]
// ============================================================
export async function layChuoiXuHuongChiTiet(scopeType, scopeId, sensorType, donVi, soDiem, signal) {
  const { data, error } = await goiRPC('rpc_lay_chuoi_xu_huong_v2', {
    p_scope_type: scopeType, p_scope_id: scopeId, p_sensor: sensorType || 'ALL',
    p_don_vi: donVi || 'NGAY', p_so_diem: soDiem,
  }, { signal })
  if (error || !Array.isArray(data)) return { error, series: [] }
  const series = data.map((r) => ({
    label: r.label,
    ts: r.ts != null ? Number(r.ts) : null,
    comp: r.comp,
    dq: r.dq != null ? Math.round(r.dq) : null,
    warnH: r.warnH ?? 0,
    critH: r.critH ?? 0,
    alert: +(((r.warnH ?? 0) + (r.critH ?? 0))).toFixed(2),
    oos: r.oos ?? 0,
  }))
  return { error: null, series }
}

// ============================================================
// XU HƯỚNG ĐA CẢM BIẾN (1 phòng → vẽ ĐỦ DP/RH/T)  ·  RPC: rpc_chuoi_xu_huong_da_sensor
// donVi: 'GIO' | 'NGAY'. → { error, perSensor:[{k, series:[{label,ts,comp,oos,dq}]}] }
// ============================================================
export async function layChuoiXuHuongDaSensor(scopeType, scopeId, donVi, soDiem, signal) {
  const { data, error } = await goiRPC('rpc_chuoi_xu_huong_da_sensor', {
    p_scope_type: scopeType, p_scope_id: scopeId, p_don_vi: donVi || 'GIO', p_so_diem: soDiem,
  }, { signal })
  if (error || !Array.isArray(data)) return { error, perSensor: [] }
  const perSensor = data.map((g) => ({
    k: g.loai_cam_bien,
    series: (g.series || []).map((r) => ({
      label: r.label, ts: r.ts != null ? Number(r.ts) : null,
      comp: r.comp, oos: r.oos ?? 0, dq: r.dq != null ? Math.round(r.dq) : null,
    })),
  }))
  return { error: null, perSensor }
}

// ============================================================
// DỰ BÁO XU HƯỚNG (Mảng 3) · RPC: rpc_du_bao_xu_huong
// OLS native + gate R²≥0.5 + robust median/MAD. Trả jsonb (xem migration
// 20260705_rpc_du_bao_xu_huong.sql). p_chi_thuc=true → chỉ dữ liệu THẬT.
// LƯU Ý: RPC cần được DEPLOY lên DB trước; nếu chưa có, trả { error, du_bao:null }
// và web tự fail-mềm (không hiện dự báo).
// → { error, du_bao:{ du_bao_dang_tin, huong, r2, chuoi, du_bao:[…], ghi_chu } }
// ============================================================
export async function layDuBaoXuHuong(scopeType, scopeId, sensor, soNgayCuaSo, soNgayDuBao, signal) {
  const { data, error } = await goiRPC('rpc_du_bao_xu_huong', {
    p_scope_type: scopeType || 'TOTAL', p_scope_id: scopeId || 'ALL', p_sensor: sensor || 'ALL',
    p_so_ngay_cua_so: soNgayCuaSo || 30, p_so_ngay_du_bao: soNgayDuBao || 7,
  }, { signal })
  if (error || !data || typeof data !== 'object') return { error, du_bao: null }
  return { error: null, du_bao: data }
}

// ============================================================
// MA TRẬN PHÒNG×NGÀY (Mảng 3) · RPC: rpc_ma_tran_phong_ngay
// Nguồn cho RoomDayHeatmap. RPC trả {days, rooms:[{ma_phong,ten_phong}], values[y][x]};
// wrapper map rooms→nhãn "MÃ · Tên" để đưa thẳng vào LazyChart type="roomDayHeat".
// LƯU Ý: RPC cần được DEPLOY (migration 20260705_rpc_ma_tran_phong_ngay.sql);
// chưa có → trả { error, rooms:[], days:[], values:[] } và web tự fail-mềm.
// ============================================================
export async function layMaTranPhongNgay(scopeType, scopeId, sensor, soNgay, topPhong, signal) {
  const { data, error } = await goiRPC('rpc_ma_tran_phong_ngay', {
    p_scope_type: scopeType || 'TOTAL', p_scope_id: scopeId || 'ALL', p_sensor: sensor || 'ALL',
    p_so_ngay: soNgay || 7, p_top_phong: topPhong || 20,
  }, { signal })
  if (error || !data || typeof data !== 'object') return { error, rooms: [], days: [], values: [] }
  const rooms = (data.rooms || []).map((r) => (r.ten_phong ? `${r.ma_phong} · ${r.ten_phong}` : r.ma_phong))
  return { error: null, rooms, days: data.days || [], values: data.values || [] }
}

// ============================================================
// PHÂN TÍCH SÂU cho AI · RPC: rpc_phan_tich_xu_huong_sau
// → { do_phu_du_lieu, theo_chi_tieu, tong_hop, so_sanh_lich_su }
// ============================================================
export async function layPhanTichSau(scopeType, scopeId, sensor, donVi, soDiem, signal) {
  const { data, error } = await goiRPC('rpc_phan_tich_xu_huong_sau', {
    p_scope_type: scopeType, p_scope_id: scopeId, p_sensor: sensor || 'ALL',
    p_don_vi: donVi || 'GIO', p_so_diem: soDiem,
  }, { signal })
  if (error || !data) return { error, sau: null }
  return { error: null, sau: data }
}

// ============================================================
// QUÉT BẤT THƯỜNG + drill-down khu vực/phòng (Tổng quan) · RPC: rpc_quet_bat_thuong
// → { cua_so_gio, khu_vuc, khu_tot_nhat, khu_kem_nhat, phong_xau_di, phong_tot_len, bat_thuong }
// ============================================================
export async function layQuetBatThuong(soGio, scopeType, scopeId, signal) {
  const { data, error } = await goiRPC('rpc_quet_bat_thuong', { p_gio: soGio, p_scope_type: scopeType || 'TOTAL', p_scope_id: scopeId || 'ALL' }, { signal })
  if (error || !data) return { error, quet: null }
  return { error: null, quet: data }
}
// cột: scope_type, scope_id, ten_scope, khu_vuc, ahu, comp_moi_nhat,
//      delta_7_ngay, rui_ro, danh_gia
// ============================================================
export async function layXepHangRuiRo(signal) {
  // v11: ưu tiên RPC v2 (đọc du_lieu_gio → LUÔN có đủ 4 cấp + dòng TỔNG +
  //   tỉ lệ đạt 1/3/7 ngày + chuỗi 14 ngày). Nếu chưa nạp file 19 (RPC chưa có)
  //   → tự lùi về view cũ để web vẫn chạy bình thường.
  const v2 = await goiRPC('rpc_xep_hang_rui_ro_v2', {}, { signal })
  if (!v2.error && Array.isArray(v2.data)) {
    const rows = v2.data.map((r) => ({
      type: r.scope_type, id: r.scope_id, name: r.ten_scope,
      area: r.khu_vuc, ahu: r.ahu,
      compliance: r.comp_moi_nhat, delta7: r.delta_7_ngay, risk: r.rui_ro, danhGia: r.danh_gia,
      dat1n: r.dat_1n ?? null, dat3n: r.dat_3n ?? null, dat7n: r.dat_7n ?? null,
      critical7n: r.critical_7n ?? null,
      chuoi: Array.isArray(r.chuoi) ? r.chuoi.map((p) => ({ label: p.label, comp: p.comp })) : [],
    }))
    return { error: null, rows }
  }
  // ----- Lùi về view cũ -----
  const { data, error } = await docView('xem_xep_hang_rui_ro',
    (q) => q.select('scope_type,scope_id,ten_scope,khu_vuc,ahu,comp_moi_nhat,delta_7_ngay,rui_ro,danh_gia'),
    { signal })
  if (error) return { error, rows: null }
  const rows = (data || []).map((r) => ({
    type: r.scope_type, id: r.scope_id, name: r.ten_scope,
    area: r.khu_vuc, ahu: r.ahu,
    compliance: r.comp_moi_nhat, delta7: r.delta_7_ngay, risk: r.rui_ro, danhGia: r.danh_gia,
    dat1n: null, dat3n: null, dat7n: null, critical7n: null, chuoi: [],
  }))
  return { error: null, rows }
}

// ============================================================
// PHÂN TÍCH GMP SÂU: MKT (ICH Q1A) + SPC (EWMA/CUSUM/Nelson)
// Đọc view xem_mkt_phong + xem_spc_canh_bao (tất định, nạp bởi job đêm).
// Trả { error, mkt:[{ma_phong,ten_phong,khu_vuc,muc_uu_tien,mkt,tTb,tMax}],
//       spc:[{scope_type,scope_id,ten_scope,sensor_type,mucTieu,sigma,soTinHieu,cacLoai}] }
// ============================================================
export async function layPhanTichGmp(signal) {
  const [mktR, spcR] = await Promise.all([
    docView('xem_mkt_phong',
      (q) => q.select('ma_phong,ten_phong,khu_vuc,muc_uu_tien,mkt_30ngay,t_tb_30ngay,t_max_30ngay')
              .not('mkt_30ngay', 'is', null).order('mkt_30ngay', { ascending: false }).limit(20),
      { signal }),
    docView('xem_spc_canh_bao',
      (q) => q.select('scope_type,scope_id,ten_scope,sensor_type,muc_tieu,sigma,in_control,so_tin_hieu,cac_loai')
              .eq('in_control', false).order('so_tin_hieu', { ascending: false }).limit(20),
      { signal }),
  ])
  const err = mktR.error || spcR.error
  const mkt = (mktR.data || []).map((r) => ({
    ma_phong: r.ma_phong, ten_phong: r.ten_phong, khu_vuc: r.khu_vuc, muc_uu_tien: r.muc_uu_tien,
    mkt: r.mkt_30ngay != null ? Number(r.mkt_30ngay) : null,
    tTb: r.t_tb_30ngay != null ? Number(r.t_tb_30ngay) : null,
    tMax: r.t_max_30ngay != null ? Number(r.t_max_30ngay) : null,
  }))
  const spc = (spcR.data || []).map((r) => ({
    scope_type: r.scope_type, scope_id: r.scope_id, ten_scope: r.ten_scope, sensor_type: r.sensor_type,
    mucTieu: r.muc_tieu != null ? Number(r.muc_tieu) : null,
    sigma: r.sigma != null ? Number(r.sigma) : null,
    soTinHieu: r.so_tin_hieu ?? 0, cacLoai: r.cac_loai || '',
  }))
  return { error: err && err.name !== 'AbortError' ? err : null, mkt, spc }
}

// ============================================================
// CHUỖI GIÁ TRỊ TRUNG BÌNH + GIỚI HẠN của 1 PHÒNG · 1 CẢM BIẾN  (#4)
// RPC: rpc_chuoi_gia_tri_phong(p_ma_phong, p_sensor, p_don_vi, p_so_diem)
// donVi: 'GIO' (N giờ) | 'NGAY' (N ngày). sensor: DP/RH/T (cụ thể).
// → MẢNG [{label, ts, avg, lo, hi, vmin, vmax}] để vẽ đường TB + dải GHD–GHT.
// ============================================================
export async function layChuoiGiaTriPhong(maPhong, sensor, donVi, soDiem, signal) {
  const { data, error } = await goiRPC('rpc_chuoi_gia_tri_phong', {
    p_ma_phong: maPhong, p_sensor: sensor, p_don_vi: donVi || 'GIO', p_so_diem: soDiem,
  }, { signal })
  // RPC (mới) trả { series, baseline }; vẫn chấp nhận MẢNG cũ để tương thích.
  const rows = Array.isArray(data) ? data : (data && Array.isArray(data.series) ? data.series : [])
  if (error || !rows) return { error, series: [], baseline: null }
  const num = (v) => (v != null ? Number(v) : null)
  const series = rows.map((r) => ({
    label: r.label,
    ts: r.ts != null ? Number(r.ts) : null,
    avg: num(r.avg), lo: num(r.lo), hi: num(r.hi), vmin: num(r.vmin), vmax: num(r.vmax),
    p5: num(r.p5), p50: num(r.p50), p95: num(r.p95),
  }))
  const b = (data && !Array.isArray(data) && data.baseline) || null
  const baseline = b ? { tb: num(b.tb), sigma: num(b.sigma), n: b.n != null ? Number(b.n) : 0 } : null
  return { error: null, series, baseline }
}

// ============================================================
// NHẬT KÝ THAO TÁC (Audit)  ·  view: xem_nhat_ky_thao_tac
// cột: thoi_diem_hien_thi, nguoi_thao_tac_hien_thi, hanh_dong, doi_tuong, ly_do
// ============================================================
export async function layNhatKyThaoTac(signal) {
  const { data, error } = await docView('xem_nhat_ky_thao_tac',
    (q) => q.select('thoi_diem_hien_thi,nguoi_thao_tac_hien_thi,hanh_dong,doi_tuong,ly_do').limit(200),
    { signal })
  if (error) return { error, rows: null }
  const rows = (data || []).map((r) => ({
    t: r.thoi_diem_hien_thi || '',
    who: r.nguoi_thao_tac_hien_thi || 'Hệ thống',
    act: nhanHanhDong(r.hanh_dong),
    obj: r.doi_tuong || '',
    detail: r.ly_do || '',
  }))
  return { error: null, rows }
}

// ============================================================
// LỊCH SỬ CẤU HÌNH (Cài đặt)  ·  view: xem_lich_su_cau_hinh
// cột: thoi_diem_hien_thi, nguoi_hien_thi, loai_thay_doi, bang, key_or_id,
//      gia_tri_cu_mask, gia_tri_moi_mask, ly_do
// ============================================================
export async function layLichSuCauHinh(signal) {
  const { data, error } = await docView('xem_lich_su_cau_hinh',
    (q) => q.select('thoi_diem_hien_thi,nguoi_hien_thi,loai_thay_doi,bang,key_or_id,gia_tri_cu_mask,gia_tri_moi_mask,ly_do').limit(200),
    { signal })
  if (error) return { error, rows: null }
  const rows = (data || []).map((r) => {
    const doiGiaTri = (r.gia_tri_cu_mask != null || r.gia_tri_moi_mask != null)
      ? `: ${r.gia_tri_cu_mask ?? '∅'} → ${r.gia_tri_moi_mask ?? '∅'}` : ''
    return {
      t: r.thoi_diem_hien_thi || '',
      who: r.nguoi_hien_thi || 'Hệ thống',
      change: r.ly_do || `${r.loai_thay_doi || ''} ${r.bang || ''}.${r.key_or_id || ''}${doiGiaTri}`.trim(),
    }
  })
  return { error: null, rows }
}

// ============================================================
// CỜ BẮT BUỘC ĐĂNG NHẬP  ·  đọc web_yeu_cau_dang_nhap từ cau_hinh
// Trả về true nếu hệ thống yêu cầu đăng nhập mới được dùng web.
// ============================================================
export async function layCoBatBuocDangNhap(signal) {
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').eq('key', 'web_yeu_cau_dang_nhap'),
    { signal })
  if (error || !Array.isArray(data) || !data.length) return { error, batBuoc: false }
  const v = String(data[0].value_hien_thi || '').toLowerCase()
  return { error: null, batBuoc: v === 'true' || v === '1' || v === 't' }
}

// NGƯỠNG CẢNH BÁO  ·  view: xem_cau_hinh_he_thong (key, value_hien_thi, la_bi_mat)
// ============================================================
export async function layNguongCanhBao(signal) {
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').in('key', ['nguong_chu_y', 'nguong_canh_bao', 'nguong_hanh_dong']),
    { signal })
  if (error || !Array.isArray(data)) return { error, cfg: null }
  const m = {}
  data.forEach((r) => { m[r.key] = Number(r.value_hien_thi) })
  return {
    error: null,
    cfg: {
      notice: Number.isFinite(m.nguong_chu_y) ? m.nguong_chu_y : 1,
      warn: Number.isFinite(m.nguong_canh_bao) ? m.nguong_canh_bao : 20,
      action: Number.isFinite(m.nguong_hanh_dong) ? m.nguong_hanh_dong : 5,
    },
  }
}

// Phạm vi cảnh báo theo ưu tiên phòng (config canh_bao_muc_uu_tien). Trả mảng ['P1','P2','P3'].
export async function layCanhBaoUuTien(signal) {
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').eq('key', 'canh_bao_muc_uu_tien'), { signal })
  const v = (!error && data && data.length ? (data[0].value_hien_thi || '') : '').trim() || 'P1,P2,P3'
  return v.split(',').map((s) => s.trim()).filter(Boolean)
}
// Lưu phạm vi ưu tiên. dsCap: mảng con của ['P1','P2','P3']. Trả { ok, gia_tri } hoặc { ok:false, thong_bao }.
export async function datCanhBaoUuTien(dsCap, actor, signal) {
  const { data, error } = await goiRPC('rpc_dat_canh_bao_uu_tien',
    { p_gia_tri: (Array.isArray(dsCap) ? dsCap : []).join(','), p_actor: actor || null }, { signal })
  if (error) return { ok: false, thong_bao: error.thong_bao || error.message || 'Không lưu được' }
  return data || { ok: false, thong_bao: 'Không rõ kết quả' }
}

// Hướng cảnh báo theo chỉ tiêu × loại ngưỡng (config canh_bao_huong). Trả object {DP:{su_co,canh_bao},...}.
const HUONG_MAC_DINH = { DP: { su_co: 'CA_HAI', canh_bao: 'CA_HAI' }, RH: { su_co: 'CA_HAI', canh_bao: 'CA_HAI' }, T: { su_co: 'CA_HAI', canh_bao: 'CA_HAI' } }
export async function layCanhBaoHuong(signal) {
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').eq('key', 'canh_bao_huong'), { signal })
  if (error || !data || !data.length) return HUONG_MAC_DINH
  try { const o = JSON.parse(data[0].value_hien_thi || '{}'); return { ...HUONG_MAC_DINH, ...o } } catch { return HUONG_MAC_DINH }
}
export async function datCanhBaoHuong(huong, actor, signal) {
  const { data, error } = await goiRPC('rpc_dat_canh_bao_huong', { p_json: huong || {}, p_actor: actor || null }, { signal })
  if (error) return { ok: false, thong_bao: error.thong_bao || error.message || 'Không lưu được' }
  return data || { ok: false, thong_bao: 'Không rõ kết quả' }
}

// ============================================================
// SỨC KHỎE HỆ THỐNG (data freshness)  ·  RPC: rpc_kiem_tra_suc_khoe_he_thong(nguong_gio)
// → OBJECT: { bucket_moi_nhat, tre_gio, mat_du_lieu, nguong_gio,
//             so_su_co_dang_mo, so_critical, so_warning, lan_chay_cuoi{…}, kiem_tra_luc }
// Bịt điểm hở lớn nhất của BMS: WF1/FMS ngừng → dữ liệu "đứng" mà không ai biết.
// ============================================================
export async function laySucKhoeHeThong(nguongGio, signal) {
  const { data, error } = await goiRPC('rpc_kiem_tra_suc_khoe_he_thong',
    (nguongGio != null ? { p_nguong_gio: nguongGio } : {}), { signal, soLanThu: 2 })
  if (error || !data || typeof data !== 'object') return { error, suc_khoe: null }
  const lc = data.lan_chay_cuoi || null
  return {
    error: null,
    suc_khoe: {
      bucketMoiNhat: data.bucket_moi_nhat || null,
      treGio: data.tre_gio != null ? Number(data.tre_gio) : null,
      matDuLieu: !!data.mat_du_lieu,
      nguongGio: data.nguong_gio != null ? Number(data.nguong_gio) : null,
      suCoDangMo: data.so_su_co_dang_mo ?? 0,
      soCritical: data.so_critical ?? 0,
      soWarning: data.so_warning ?? 0,
      lanChayCuoi: lc ? { wf: lc.ten_workflow, trangThai: lc.trang_thai, ketThuc: lc.ket_thuc } : null,
      kiemTraLuc: data.kiem_tra_luc || null,
    },
  }
}

// ============================================================
// SOP  ·  view: xem_quy_trinh_sop (sop, ap_dung, deviation, capa)
// ============================================================
export async function layQuyTrinhSop(signal) {
  const { data, error } = await docView('xem_quy_trinh_sop',
    (q) => q.select('sop,ap_dung,deviation,capa'), { signal })
  if (error) return { error, rows: null }
  const rows = (data || []).map((r) => ({ sop: r.sop, apply: r.ap_dung, dev: r.deviation || '—', capa: r.capa || '—' }))
  return { error: null, rows }
}

// ============================================================
// BÁO CÁO AI  ·  view: xem_bao_cao_ai
// cột: thoi_diem_hien_thi, tao_luc, ten_scope, sensor_type, pham_vi_ngay,
//      noi_dung_phan_tich, muc_canh_bao
// ============================================================
export async function layBaoCaoAi(signal) {
  const { data, error } = await docView('xem_bao_cao_ai',
    (q) => q.select('thoi_diem_hien_thi,tao_luc,ten_scope,sensor_type,pham_vi_ngay,noi_dung_phan_tich,muc_canh_bao').limit(20),
    { signal })
  if (error) return { error, rows: null }
  const rows = (data || []).map((r) => ({
    scope: r.ten_scope || '',
    sensor: r.sensor_type,
    range: r.pham_vi_ngay != null ? `${r.pham_vi_ngay} ngày` : '',
    text: r.noi_dung_phan_tich,
    time: r.thoi_diem_hien_thi || fmtTS(r.tao_luc, 16),
    level: r.muc_canh_bao ?? 0,
  }))
  return { error: null, rows }
}

// ================= GHI (RPC thao tác) =================
export async function thaoTacSuCo({ dbId, actionCode, lyDo, actorEmail }, signal) {
  return goiRPC('rpc_thao_tac_su_co', {
    p_ma_su_co: dbId, p_hanh_dong: actionCode, p_ly_do: lyDo, p_actor: actorEmail || null, p_nguon: 'web',
  }, { signal })
}

// ---- Nút bấm từ EMAIL (deep link ?sc=&act=&token=) ----
// Bước 1: soi vé, CHỈ ĐỌC — không tiêu token, không đổi trạng thái. Chạy dưới JWT
// nên DB tự kiểm vai trò + khu, và phát hiện sự cố đã đổi trạng thái từ lúc gửi mail.
// Bộ nút thao tác — NGUỒN SỰ THẬT DUY NHẤT là bảng luật (view xem_nut_thao_tac).
// Trước v14 web và WF8 mỗi nơi hard-code một bảng nút, lệch với luật DB ⇒ nút hiện
// ra nhưng bấm vào trả KHONG_DUOC_PHEP. Nay cả hai cùng đọc một chỗ.
export async function layNutThaoTac(signal) {
  const { data, error } = await docView('xem_nut_thao_tac',
    (q) => q.select('hanh_dong,vai_tro,bo_nut,trang_thai_truoc,nhan,mau_nen,mau_chu,bat_buoc_ly_do,dong_su_co,giu_trang_thai,thu_tu'),
    { signal })
  if (error) return { error, rows: [] }
  return { error: null, rows: data || [] }
}

export async function kiemVeThaoTac(token, signal) {
  const { data, error } = await goiRPC('rpc_kiem_ve_thao_tac', { p_token: token }, { signal })
  if (error) return { error, ve: null }
  return { error: null, ve: data }
}
// Bước 2: thực thi. Token là chìa; ly_do bắt buộc với hành động có bat_buoc_ly_do.
export async function thaoTacSuCoTuEmail({ token, lyDo }, signal) {
  return goiRPC('rpc_thao_tac_su_co', { p_token: token, p_ly_do: lyDo || null }, { signal })
}
export async function dungCanhBao({ dbId, lyDo, actorEmail }, signal) {
  return goiRPC('rpc_dung_canh_bao', { p_ma_su_co: dbId, p_ly_do: lyDo, p_actor: actorEmail || null }, { signal })
}
export async function themPhong(p, signal)    { return goiRPC('rpc_them_phong', p, { signal }) }
export async function suaPhong(p, signal)     { return goiRPC('rpc_sua_phong', p, { signal }) }
export async function xoaPhong(p, signal)     { return goiRPC('rpc_xoa_phong', p, { signal }) }
export async function suaGioiHan(p, signal)   { return goiRPC('rpc_sua_gioi_han_cam_bien', p, { signal }) }
export async function themCamBien(p, signal)  { return goiRPC('rpc_them_cam_bien', p, { signal }) }
export async function xoaCamBien(p, signal)   { return goiRPC('rpc_xoa_cam_bien', p, { signal }) }
export async function suaNguong(p, signal)    { return goiRPC('rpc_sua_nguong_canh_bao', p, { signal }) }
export async function luuPhanTichAi(p, signal){ return goiRPC('rpc_luu_phan_tich_ai', p, { signal }) }

// ============================================================
// TAB CẤU HÌNH NGƯỜI NHẬN  ·  danh bạ cảnh báo (nguoi_nhan_canh_bao, vai trò × khu)
// + người nhận báo cáo (nguoi_nhan_bao_cao, có khu_vuc) + email hệ thống (cau_hinh).
// Ghi qua RPC SECURITY DEFINER (migration 20260705_rpc_cau_hinh_email_nguoi_nhan.sql
// + 20260707_nguoi_nhan_theo_khu.sql) — chỉ ADMIN/QA, có audit.
// Lưu ý: các key email_ipc/email_co_dien/… chỉ còn là DỰ PHÒNG tầng 3 của định tuyến.
// ============================================================
export const EMAIL_KEYS_CANH_BAO = ['email_ipc', 'email_co_dien', 'email_qa', 'email_truc_hsl', 'email_it_gmp']
export const EMAIL_KEYS_HE_THONG = ['email_gui_tu', 'email_test']
export const EMAIL_KEYS_BAO_CAO = ['email_bao_cao_tuan', 'email_bao_cao_thang', 'email_bao_cao_ngay']

export async function layCauHinhEmail(signal) {
  const keys = [...EMAIL_KEYS_CANH_BAO, ...EMAIL_KEYS_HE_THONG, ...EMAIL_KEYS_BAO_CAO]
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').in('key', keys), { signal })
  if (error) return { error, cfg: null }
  const cfg = {}
  ;(data || []).forEach((r) => { cfg[r.key] = r.value_hien_thi || '' })
  return { error: null, cfg }
}
export async function datCauHinhEmail(key, value, actor, signal) {
  return goiRPC('rpc_dat_cau_hinh_email', { p_key: key, p_value: value ?? '', p_actor: actor || null }, { signal })
}
// khu_vuc từ PostgREST thường là mảng JSON ['C1','C4']; phòng hờ cả dạng chuỗi
// Postgres '{C1,C4}' (tuỳ cách serialize) → luôn chuẩn hoá về mảng string sạch.
function chuanHoaKhuVuc(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    return v.replace(/^\{|\}$/g, '').split(',')
      .map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
  }
  return []
}
export async function layNguoiNhanBaoCao(signal) {
  const { data, error } = await goiRPC('rpc_lay_nguoi_nhan_bao_cao', {}, { signal })
  if (error) return { error, rows: [] }
  const rows = (Array.isArray(data) ? data : []).map((r) => ({ ...r, khu_vuc: chuanHoaKhuVuc(r.khu_vuc) }))
  return { error: null, rows }
}
export async function luuNguoiNhanBaoCao(nn, actor, signal) {
  return goiRPC('rpc_luu_nguoi_nhan_bao_cao', {
    p_id: nn.id ?? null, p_ho_ten: nn.ho_ten, p_email: nn.email, p_vai_tro: nn.vai_tro || null,
    p_nhan_tuan: !!nn.nhan_tuan, p_nhan_thang: !!nn.nhan_thang, p_nhan_quy: !!nn.nhan_quy,
    p_kich_hoat: nn.kich_hoat !== false, p_ghi_chu: nn.ghi_chu || null, p_actor: actor || null,
    // null = giữ nguyên khu hiện có (khi tạo mới RPC tự đặt đủ 3 khu)
    p_khu_vuc: Array.isArray(nn.khu_vuc) ? nn.khu_vuc : null,
  }, { signal })
}
export async function xoaNguoiNhanBaoCao(id, actor, signal) {
  return goiRPC('rpc_xoa_nguoi_nhan_bao_cao', { p_id: id, p_actor: actor || null }, { signal })
}

// ---- Danh bạ email CẢNH BÁO theo vai trò × khu (nguoi_nhan_canh_bao) ----
// Migration 20260707_nguoi_nhan_theo_khu.sql: định tuyến WF8/WF2 đọc bảng này
// (lọc theo khu sự cố, fallback 3 tầng); RPC gate ADMIN/QA, trả jsonb {ok,...}.
export async function layNguoiNhanCanhBao(signal) {
  const { data, error } = await goiRPC('rpc_lay_nguoi_nhan_canh_bao', {}, { signal })
  if (error) return { error, rows: [] }
  const rows = (Array.isArray(data) ? data : []).map((r) => ({
    ...r, khu_vuc: chuanHoaKhuVuc(r.khu_vuc), ahu: Array.isArray(r.ahu) ? r.ahu : [],
  }))
  return { error: null, rows }
}
export async function luuNguoiNhanCanhBao(nn, actor, signal) {
  return goiRPC('rpc_luu_nguoi_nhan_canh_bao', {
    p_id: nn.id ?? null, p_email: nn.email, p_ho_ten: nn.ho_ten || null, p_vai_tro: nn.vai_tro,
    // luôn gửi mảng từ UI; bỏ tích hết → RPC tự đặt lại đủ 3 khu (chống "mất cảnh báo im lặng")
    p_khu_vuc: Array.isArray(nn.khu_vuc) ? nn.khu_vuc : null,
    // AHU phụ trách, phần tử dạng 'KHU/AHU' (tên AHU trùng nhau giữa các khu).
    // Rỗng = nhận mọi AHU trong các khu đã tích → giữ nguyên hành vi cũ.
    p_ahu: Array.isArray(nn.ahu) ? nn.ahu : null,
    p_kich_hoat: nn.kich_hoat !== false, p_ghi_chu: nn.ghi_chu || null, p_actor: actor || null,
  }, { signal })
}
// Danh sách AHU để đổ vào ô phân công. Trả { ma_ahu:'C1/AHU03', khu_vuc, ahu, so_phong, co_p1_p2 }.
// co_p1_p2=false ⇒ AHU chỉ có phòng P3, không bao giờ sinh sự cố.
export async function layDanhSachAhu(signal) {
  const { data, error } = await goiRPC('rpc_danh_sach_ahu', {}, { signal })
  if (error) return { error, rows: [] }
  return { error: null, rows: Array.isArray(data) ? data : [] }
}
export async function xoaNguoiNhanCanhBao(id, actor, signal) {
  return goiRPC('rpc_xoa_nguoi_nhan_canh_bao', { p_id: id, p_actor: actor || null }, { signal })
}

// ---------- Luật tự phân tuyến sự cố (tab Cài đặt) ----------
export async function layLuatPhanTuyen(signal) {
  const { data, error } = await goiRPC('rpc_lay_luat_phan_tuyen', {}, { signal })
  if (error) return { error, bat: false, luat: [] }
  return { error: null, bat: !!(data && data.bat), luat: (data && Array.isArray(data.luat)) ? data.luat : [] }
}
export async function luuLuatPhanTuyen(l, actor, signal) {
  return goiRPC('rpc_luu_luat_phan_tuyen', {
    p_id: l.id ?? null, p_loai_cam_bien: l.loai_cam_bien, p_muc_canh_bao: l.muc_canh_bao,
    p_cho_it_nhat_phut: l.cho_it_nhat_phut, p_ly_do_mau: l.ly_do_mau || null,
    p_kich_hoat: l.kich_hoat !== false, p_actor: actor || null,
  }, { signal })
}
export async function xoaLuatPhanTuyen(id, actor, signal) {
  return goiRPC('rpc_xoa_luat_phan_tuyen', { p_id: id, p_actor: actor || null }, { signal })
}
export async function datCongTacPhanTuyen(bat, actor, signal) {
  return goiRPC('rpc_dat_cong_tac_phan_tuyen', { p_bat: !!bat, p_actor: actor || null }, { signal })
}

// Khóa xác thực webhook (cau_hinh.webhook_token_web, cấp qua RPC cho user đăng nhập) —
// gửi kèm body `_token` mỗi lần gọi webhook n8n; workflow so khớp trước khi làm việc.
// Cache theo phiên trang; lỗi/chưa đăng nhập → '' (workflow phía n8n sẽ từ chối).
let _webhookToken = null
async function layWebhookToken(signal) {
  if (_webhookToken != null) return _webhookToken
  const { data, error } = await goiRPC('rpc_lay_webhook_token', {}, { signal })
  _webhookToken = (!error && typeof data === 'string') ? data.trim() : ''
  return _webhookToken
}

// Lấy URL webhook WF7 (cấu hình trong cau_hinh: key 'wf7_webhook_url'). Trả '' nếu chưa đặt.
export async function layWebhookAi(signal) {
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').eq('key', 'wf7_webhook_url'), { signal })
  if (error || !data || !data.length) return ''
  return (data[0].value_hien_thi || '').trim()
}

// Lấy URL webhook WF7-SÂU — phân tích AI CHUYÊN SÂU (key 'wf7_sau_webhook_url'). Trả '' nếu chưa đặt.
export async function layWebhookAiSau(signal) {
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').eq('key', 'wf7_sau_webhook_url'), { signal })
  if (error || !data || !data.length) return ''
  return (data[0].value_hien_thi || '').trim()
}

// Lấy URL webhook WF7b — gửi email / lưu Drive nhận định xu hướng (key 'wf7b_webhook_url').
export async function layWebhookWf7b(signal) {
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').eq('key', 'wf7b_webhook_url'), { signal })
  if (error || !data || !data.length) return ''
  return (data[0].value_hien_thi || '').trim()
}

// fetch có thử lại 1 lần khi đứt mạng/CORS thoáng qua (webhook n8n đang re-deploy, Wi-Fi chớp…).
// Chỉ retry khi fetch NÉM lỗi (không phải HTTP status xấu); Abort thì tôn trọng ngay.
async function fetchThuLai(url, init) {
  try { return await fetch(url, init) } catch (e) {
    if (e && e.name === 'AbortError') throw e
    await new Promise((r) => setTimeout(r, 1500))
    return fetch(url, init)
  }
}

// Gửi nhận định xu hướng qua WF7b. action: 'email' | 'drive'.
// nhanDinh: { scope, sensor, range, text, time, level, nguon }. to: chuỗi email (chỉ khi 'email').
// charts: MẢNG { src, title } (src = data URI PNG, title = tên biểu đồ) của TẤT CẢ biểu đồ
// tab Xu hướng — WF7b nhúng vào file .html đính kèm theo định dạng báo cáo tuần/tháng/quý.
// (Vẫn nhận chuỗi data URI trần để tương thích ngược.) Trả { ok, kind, link, error }.
export async function guiNhanDinhXuHuong(url, action, nhanDinh, to, charts, signal) {
  if (!url) return { ok: false, error: 'CHUA_CAU_HINH_WEBHOOK' }
  try {
    const res = await fetchThuLai(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ _token: await layWebhookToken(signal), action, to: to || '', charts: Array.isArray(charts) ? charts : (charts ? [charts] : []), ...nhanDinh }),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const j = await res.json().catch(() => ({}))
    if (j && j.ok) return { ok: true, kind: j.kind, link: j.link || null }
    return { ok: false, error: (j && j.error) || 'EMPTY' }
  } catch (e) {
    return { ok: false, error: (e && e.name === 'AbortError') ? 'ABORT' : 'NETWORK' }
  }
}

// Gọi WF7 (n8n) để AI phân tích dữ liệu biểu đồ thật. Trả { ok, text, level, error }.
// 07/2026 — WF7 ASYNC: có cache → webhook trả kết quả ngay (như cũ); chưa có cache →
// webhook trả ngay {pending:true, input_hash} rồi AI Agent chạy nền (~0.5–2 phút, 6 tool
// truy vấn DB) và ghi kết quả vào nhat_ky_ai — web poll bảng đó theo input_hash.
// (Tránh lỗi NETWORK cũ: agent 31–90s vượt timeout gateway ~100s của lời gọi đồng bộ.)
// onTienTrinh(msg): callback tùy chọn — cập nhật dòng trạng thái chờ lên UI.
// Vé phạm vi AI: RPC chạy dưới JWT phiên đăng nhập — DB tự kiểm scope thuộc quyền xem
// rồi ký HMAC (rpc_lay_ve_ai). WF7/WF7-SÂU xác minh vé (rpc_kiem_ve_ai) trước khi phân tích.
// KHÔNG cache vé (hết hạn 15 phút) — xin mới mỗi lần bấm Phân tích.
async function layVeAi(scopeType, scopeId, signal) {
  const { data, error } = await goiRPC('rpc_lay_ve_ai',
    { p_scope_type: scopeType || 'TOTAL', p_scope_id: scopeId || 'ALL' }, { signal })
  if (error) return { ok: false, ly_do: error.thong_bao || error.message || 'RPC_LOI' }
  return data && typeof data === 'object' ? data : { ok: false, ly_do: 'VE_RONG' }
}

export async function phanTichAiQuaWorkflow(url, payload, signal, onTienTrinh, tenWf = 'WF7') {
  if (!url) return { ok: false, error: 'CHUA_CAU_HINH_WEBHOOK' }
  try {
    // Xin vé phạm vi trước; vé có thể THU HẸP scope (TOTAL → AREA khi tài khoản chỉ 1 khu)
    // → body gửi đi dùng scope CỦA VÉ để WF7 so khớp vé↔scope.
    const ve = await layVeAi(payload?.scope?.type, payload?.scope?.id, signal)
    if (!ve || ve.ok !== true) return { ok: false, error: `VE_AI: ${(ve && ve.ly_do) || 'KHONG_CAP_DUOC_VE'}` }
    const scope = { ...((payload && payload.scope) || {}), type: ve.scope_type, id: ve.scope_id }
    const res = await fetchThuLai(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _token: await layWebhookToken(signal), _ve: ve, ...payload, scope }), signal,
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const j = await res.json()
    const text = (j && (j.text || j.ket_qua || j.content)) || ''
    if (text) return { ok: true, text, level: j.level != null ? Number(j.level) : null }
    if (j && j.pending && j.input_hash) return await doiKetQuaAiWf7(j.input_hash, signal, onTienTrinh, tenWf)
    return { ok: false, error: 'EMPTY' }
  } catch (e) {
    return { ok: false, error: (e && e.name === 'AbortError') ? 'ABORT' : 'NETWORK' }
  }
}

// Chờ AI Agent (chạy nền) ghi kết quả vào nhat_ky_ai — poll 4s/lần, tối đa 3 phút.
// tenWf: 'WF7' (thường) hoặc 'WF7_SAU' (chuyên sâu) — lọc đúng dòng của workflow tương ứng.
// RLS nhat_ky_ai: authenticated ĐỌC được, anon không → chưa đăng nhập thì khỏi poll (fail-mềm).
async function doiKetQuaAiWf7(inputHash, signal, onTienTrinh, tenWf = 'WF7') {
  const CHO_TOI_DA_MS = 300000, NHIP_MS = 4000    // sâu có thể lâu hơn → tối đa 5 phút
  const tBatDau = Date.now()
  try {
    const { data: { session } = {} } = await supabase.auth.getSession()
    if (!session) return { ok: false, error: 'CAN_DANG_NHAP_DE_CHO_AI' }
  } catch { /* không đọc được phiên → cứ thử poll */ }
  // Mốc id: chỉ nhận dòng ghi SAU lượt gọi này (id tăng đơn điệu — không lệ thuộc đồng hồ máy;
  // tránh nhặt nhầm dòng cũ cùng hash bị judge chặn nên không thành cache).
  let idMoc = 0
  {
    const { data } = await docView('nhat_ky_ai',
      (q) => q.select('id').eq('workflow', tenWf).eq('input_hash', inputHash).order('id', { ascending: false }).limit(1), { signal })
    if (data && data.length) idMoc = data[0].id
  }
  try { if (onTienTrinh) onTienTrinh('AI đang phân tích sâu — agent truy vấn thêm dữ liệu gốc từ hệ thống, thường mất 1–2 phút. Kết quả sẽ tự hiện ở đây.') } catch { /* UI không chặn poll */ }
  while (Date.now() - tBatDau < CHO_TOI_DA_MS) {
    if (signal && signal.aborted) return { ok: false, error: 'ABORT' }
    await new Promise((r) => setTimeout(r, NHIP_MS))
    const { data, error } = await docView('nhat_ky_ai',
      (q) => q.select('id,ket_qua,trang_thai').eq('workflow', tenWf).eq('input_hash', inputHash).gt('id', idMoc).order('id', { ascending: false }).limit(1), { signal })
    if (error) return { ok: false, error: 'LOI_DOC_KET_QUA_AI' }
    if (data && data.length) {
      const r = data[0]
      if (r.trang_thai === 'FAILED' || !r.ket_qua) return { ok: false, error: 'AI_FAILED' }
      return { ok: true, text: r.ket_qua, level: null }   // level null → UI dùng level cục bộ
    }
  }
  return { ok: false, error: 'TIMEOUT_AI' }
}

// Lấy URL webhook WF5 v2 — nút "Gửi báo cáo bù" (key 'wf5_webhook_bao_cao_bu'). Trả '' nếu chưa đặt.
export async function layWebhookBaoCaoBu(signal) {
  const { data, error } = await docView('xem_cau_hinh_he_thong',
    (q) => q.select('key,value_hien_thi').eq('key', 'wf5_webhook_bao_cao_bu'), { signal })
  if (error || !data || !data.length) return ''
  return (data[0].value_hien_thi || '').trim()
}

// Gọi WF5 v2 (n8n) gửi báo cáo bù. ky: 'THANG' | 'TUAN' | 'QUY' (kỳ LIỀN TRƯỚC).
// Webhook trả lời ngay khi NHẬN yêu cầu; báo cáo được tạo + gửi email trong nền (~1 phút).
// Trả { ok, message, error }.
export async function guiBaoCaoBu(url, ky, signal) {
  if (!url) return { ok: false, error: 'CHUA_CAU_HINH_WEBHOOK' }
  try {
    const res = await fetchThuLai(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _token: await layWebhookToken(signal), ky }), signal,
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    let message = ''
    try { const j = await res.json(); message = (j && j.message) || '' } catch { /* thân trả lời không phải JSON — vẫn OK */ }
    return { ok: true, message }
  } catch (e) {
    return { ok: false, error: (e && e.name === 'AbortError') ? 'ABORT' : 'NETWORK' }
  }
}

// ---------- Tab "Sự cố gần đây" — dữ liệu PHÚT cửa sổ 8h ----------
// Đọc dữ liệu phút đã gom theo phòng-sensor cho khoảng giờ p_gio (1/4/8).
// Trả { error, rows }. Mỗi row: { ma_phong, ten_phong, khu_vuc, ahu, loai_cam_bien,
//   gioi_han_duoi, gioi_han_tren, so_diem, so_oos, gia_tri_cuoi, chuoi:[{t,v,o}] }.
export async function laySuCoPhut(gio = 8, signal) {
  const { data, error } = await goiRPC('rpc_du_lieu_phut_gan_day', { p_gio: gio }, { signal })
  if (error) return { error, rows: [] }
  return { error: null, rows: Array.isArray(data) ? data : [] }
}

// Kích Edge Function capnhat-phut-8h: đăng nhập FMS phía server, nạp điểm phút
// mới vào bảng du_lieu_phut_8h + tự dọn >8h. Gọi trước mỗi lần đọc để dữ liệu tươi.
// Fail-mềm: Edge chưa deploy / lỗi mạng → web vẫn đọc dữ liệu bảng gần nhất.
export async function capNhatPhut8h(signal) {
  if (!SUPABASE_URL) return { ok: false, error: 'NO_URL' }
  // Timeout 35s: nếu FMS chậm/treo, hủy để KHÔNG treo request chồng chất (chạy nền,
  // không ảnh hưởng hiển thị — web đã đọc bảng riêng). Lần làm mới sau thử lại.
  const ac = new AbortController()
  const tm = setTimeout(() => ac.abort(), 35000)
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/capnhat-phut-8h`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bms-token': await layWebhookToken(signal) },
      signal: signal || ac.signal,
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const j = await res.json().catch(() => ({}))
    return j && j.ok ? { ok: true, soPhong: j.so_phong, soDiem: j.so_diem } : { ok: false, error: (j && j.error) || 'EMPTY' }
  } catch (e) {
    return { ok: false, error: (e && e.name === 'AbortError') ? 'ABORT' : 'NETWORK' }
  } finally {
    clearTimeout(tm)
  }
}

// ---------- Phân quyền tài khoản (chỉ ADMIN) ----------
export async function layNguoiDung(signal) {
  const { data, error } = await goiRPC('rpc_lay_nguoi_dung', {}, { signal })
  if (error) return { error, rows: [] }
  return { error: null, rows: Array.isArray(data) ? data : [] }
}
// Email đã có tài khoản đăng nhập (auth.users) nhưng CHƯA được phân quyền.
// Chỉ ADMIN đọc được; người khác nhận mảng rỗng.
export async function layTaiKhoanChuaPhanQuyen(signal) {
  const { data, error } = await goiRPC('rpc_tai_khoan_chua_phan_quyen', {}, { signal })
  if (error) return { error, emails: [] }
  return { error: null, emails: (Array.isArray(data) ? data : []).map((r) => r.email || r) }
}
export async function luuNguoiDung(u, signal) {
  return goiRPC('rpc_luu_nguoi_dung', {
    p_email: u.email, p_ho_ten: u.ho_ten, p_vai_tro: u.vai_tro,
    p_khu_vuc: u.khu_vuc, p_kich_hoat: u.kich_hoat,
    p_so_dien_thoai: u.so_dien_thoai || null, p_ghi_chu: u.ghi_chu || null,
  }, { signal })
}

// ---------- tiện ích ----------
function mucCanhBaoToLevel(muc) {
  switch ((muc || '').toUpperCase()) {
    case 'CRITICAL': return 3
    case 'WARNING': return 2
    case 'NOTICE': return 1
    case 'NORMAL': return 0
    case 'MAT_DU_LIEU': return -1
    default: return muc == null ? -1 : 0
  }
}
