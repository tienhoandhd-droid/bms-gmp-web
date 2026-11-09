// timKiemChung.js — Ô tìm chung ở đầu trang (09/11/2026).
// Hàm thuần (không React) để test được: gõ không dấu, không cần dấu chấm ("c1r21" khớp "C1.R21").
// Kết quả theo nhóm: Phòng → Sự cố → Trang; trong nhóm, mã khớp đúng xếp trên mã bắt đầu bằng, rồi mới tới "có chứa".

// Gộp chữ để so: bỏ dấu tiếng Việt, đ→d, chữ thường, bỏ mọi ký tự không phải chữ/số.
export function gonChu(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const THU_TU_NHOM = ["phong", "suCo", "trang"];
const GIOI_HAN_MAC_DINH = { phong: 8, suCo: 6, trang: 5 };

// điểm: 0 = mã khớp đúng, 1 = mã bắt đầu bằng, 2 = mã có chứa, 3 = trường phụ có chứa; null = không khớp
function diem(kim, ma, phu) {
  const m = gonChu(ma);
  if (m === kim) return 0;
  if (m.startsWith(kim)) return 1;
  if (m.includes(kim)) return 2;
  if (phu.some((p) => gonChu(p).includes(kim))) return 3;
  return null;
}

// q: chuỗi người dùng gõ. nguon: { trang:[{k,label}], phong:[{id,name,area,ahu}], suCo:[{id,room,sensor,status}] }
// Trả về [{ nhom, giaTri, nhan, phu }] — giaTri: mã phòng / mã phiếu / khoá tab.
export function timKiemChung(q, nguon, gioiHan = GIOI_HAN_MAC_DINH) {
  const kim = gonChu(q);
  if (!kim) return [];
  const gh = { ...GIOI_HAN_MAC_DINH, ...gioiHan };
  const ungVien = {
    phong: (nguon.phong || []).map((r) => ({ giaTri: r.id, nhan: r.id, phu: [r.name, r.area && `Khu ${r.area}`, r.ahu].filter(Boolean).join(" · "), d: diem(kim, r.id, [r.name || "", r.ahu || ""]) })),
    suCo: (nguon.suCo || []).map((i) => ({ giaTri: i.id, nhan: i.id, phu: [i.room, i.sensor, i.status].filter(Boolean).join(" · "), d: diem(kim, i.id, [i.room || "", i.sensor || "", i.status || ""]) })),
    trang: (nguon.trang || []).map((t) => ({ giaTri: t.k, nhan: t.label, phu: "Trang", d: diem(kim, t.label, [t.k]) })),
  };
  return THU_TU_NHOM.flatMap((nhom) => ungVien[nhom]
    .filter((x) => x.d != null)
    .sort((a, b) => a.d - b.d || a.nhan.localeCompare(b.nhan, "vi", { numeric: true }))
    .slice(0, gh[nhom])
    .map(({ giaTri, nhan, phu }) => ({ nhom, giaTri, nhan, phu })));
}
