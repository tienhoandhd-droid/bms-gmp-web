// boLocXuHuong.js — Logic THUẦN (không React) của bộ lọc trang Xu hướng, tách ra 05/11/2026 để test được.
//   1. dungPhamViLive: dựng danh sách đối tượng Tổng / Khu / AHU / Phòng từ danh sách phòng LIVE.
//   2. locLuaChon:     lọc danh sách theo cấp xem + chip Khu + chip AHU.
//   3. boDau:          chuẩn hoá chuỗi để tìm KHÔNG DẤU.
//
// Vì sao tách: lỗi "chọn cấp Phòng ra 0 kết quả" (05/11/2026) nằm ở nhánh dữ liệu thật —
// bài test demo không chạm tới. Logic thuần thì test bằng node --test với dữ liệu giả lập.

// Bỏ dấu tiếng Việt + chữ thường. Với chuỗi dựng sẵn (NFC) độ dài GIỮ NGUYÊN → tô sáng đúng vị trí.
export const boDau = (s) => String(s ?? "").normalize("NFC").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const trungBinh = (vals) => (vals.length ? +(vals.reduce((a, v) => a + v, 0) / vals.length).toFixed(1) : null);
const ruiRo = (comp) => (comp != null ? Math.max(0, Math.round(100 - comp)) : 999);

// Dựng vũ trụ đối tượng LIVE.
//   rooms      — từ layDanhSachPhong (có noData, duLieuCu, _compliance, area, ahu)
//   riskRows   — RPC xếp hạng rủi ro v2 ({type,id,risk,delta7,dat1n,dat3n,dat7n,chuoi,compliance}), có thể rỗng
//   khuChoPhep — mảng khu tài khoản được xem (null = toàn bộ)
//
// QUY TẮC noData (05/11/2026): phòng noData (thiếu giờ dữ liệu mới nhất / chưa có cảm biến)
//   VẪN có trong danh sách để xem LỊCH SỬ, nhưng % đạt = null (không chấm bằng số cũ),
//   không vào trung bình gộp, xếp cuối, không vào bảng xếp hạng rủi ro.
//   Trước đây lọc bỏ hẳn → nguồn FMS trễ là ô "Chọn phòng" ra 0 kết quả.
export function dungPhamViLive(rooms, riskRows, khuChoPhep) {
  const riskById = {};
  (riskRows || []).forEach((r) => { if (r && r.type && r.id != null) riskById[`${r.type}:${r.id}`] = r; });
  const enrich = (sc) => {
    const e = riskById[`${sc.type}:${sc.id}`];
    if (!e) return sc;
    return {
      ...sc,
      risk: sc.noData ? sc.risk : (e.risk != null ? e.risk : sc.risk),
      delta7: e.delta7 != null ? e.delta7 : sc.delta7,
      dat1n: e.dat1n != null ? e.dat1n : sc.dat1n,
      dat3n: e.dat3n != null ? e.dat3n : sc.dat3n,
      dat7n: e.dat7n != null ? e.dat7n : sc.dat7n,
      chuoi: (e.chuoi && e.chuoi.length) ? e.chuoi : sc.chuoi,
      // noData: KHÔNG để số của RPC che mất trạng thái "chưa có số liệu giờ gần nhất"
      latest: { compliance: sc.noData ? null : (e.compliance != null ? e.compliance : sc.latest.compliance) },
    };
  };
  const mkRoom = (r) => {
    const comp = !r.noData && r._compliance != null ? r._compliance : null;
    return { type: "ROOM", id: r.id, name: r.name || r.id, area: r.area || undefined, ahu: r.ahu || undefined,
      noData: !!r.noData, duLieuCu: !!r.duLieuCu,
      risk: ruiRo(comp), delta7: null,
      dat1n: comp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: comp }, daily: [{ compliance: comp }] };
  };
  const roomScopes = (rooms || []).map(mkRoom);
  const aggBy = (keyOf, type) => {
    const g = {};
    roomScopes.forEach((s) => { const k = keyOf(s); if (!k) return; (g[k] = g[k] || []).push(s); });
    return Object.entries(g).map(([k, arr]) => {
      const comp = trungBinh(arr.map((s) => s.latest.compliance).filter((v) => v != null));
      // Khu/AHU mà MỌI phòng đều chưa có số liệu → cũng noData
      return { type, id: k, name: k, area: type === "AREA" ? k : undefined, ahu: type === "AHU" ? k : undefined,
        noData: comp == null, duLieuCu: comp == null && arr.some((s) => s.duLieuCu),
        risk: ruiRo(comp), delta7: null,
        dat1n: comp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: comp }, daily: [{ compliance: comp }] };
    });
  };
  const totalComp = trungBinh(roomScopes.map((s) => s.latest.compliance).filter((v) => v != null));
  // Tài khoản giới hạn khu: server đã tự lọc → "TOTAL" thực chất là gộp các khu được xem.
  const totalScope = { type: "TOTAL", id: "ALL", name: khuChoPhep ? `Phạm vi được xem (khu ${khuChoPhep.join(" · ")})` : "Toàn hệ thống", risk: 0, delta7: null,
    dat1n: totalComp, dat3n: null, dat7n: null, chuoi: [], latest: { compliance: totalComp }, daily: [{ compliance: totalComp }] };
  return [totalScope, ...aggBy((s) => s.area, "AREA"), ...aggBy((s) => s.ahu, "AHU"), ...roomScopes].map(enrich);
}

// Đối tượng của 1 cấp, sắp: có số liệu trước (rủi ro giảm dần), noData xếp CUỐI
// (rủi ro 999 chỉ nghĩa là "chưa chấm", không phải rủi ro cao nhất).
export const theoCap = (scopes, type) => scopes.filter((s) => s.type === type).sort((a, b) => (!!a.noData - !!b.noData) || (b.risk - a.risk));

// Lọc theo chip Khu / AHU — so khớp THEO CẤP vì đối tượng gộp không phải lúc nào cũng có area/ahu:
//   Khu: mã khu chính là o.id · AHU LIVE không mang area → AHU phải nằm trong ahuList (đã lọc theo khu)
//   AHU: mã AHU chính là o.id. Trước 05/11/2026 so o.area/o.ahu trực tiếp → bấm chip khu ở cấp AHU ra 0.
//   Cấp Tổng: không áp chip.
export function locLuaChon(items, { level, area = "ALL", ahu = "ALL", ahuList = [] }) {
  const ds = (items || []).filter(Boolean);
  if (level === "TOTAL") return ds;
  const khopKhu = (o) => area === "ALL" || o.area === area || (o.type === "AREA" && o.id === area) || (o.type === "AHU" && ahuList.includes(o.id));
  const khopAhu = (o) => ahu === "ALL" || o.ahu === ahu || (o.type === "AHU" && o.id === ahu);
  return ds.filter((o) => khopKhu(o) && khopAhu(o));
}

// Ô tìm kiếm: khớp mã, tên, khu, AHU — không phân biệt dấu / hoa thường.
export function timTheoTu(items, q) {
  const ql = boDau(String(q || "").trim());
  if (!ql) return items;
  return items.filter((o) => boDau(`${o.id} ${o.name} ${o.area || ""} ${o.ahu || ""}`).includes(ql));
}
