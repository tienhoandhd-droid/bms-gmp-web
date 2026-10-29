// ============================================================
// TVMode — chế độ màn hình treo tường phòng vận hành (mở bằng ?tv=1)
//
// Ba màn xoay vòng 15 giây: TỔNG QUAN → SỰ CỐ → CỤM ĐIỀU TRA. Chữ to, nền tối
// (phòng điều khiển), không thanh điều hướng, không cần chuột.
//
// P0 GMP — "KHÔNG XÁC MINH ĐƯỢC" TUYỆT ĐỐI KHÔNG ĐƯỢC HIỂN THỊ THÀNH "BÌNH THƯỜNG":
// màn treo tường điều khiển sản xuất, một ô xanh sai đọc như "mọi phòng đạt". Vì vậy
// TV có 6 trạng thái TÁCH BẠCH, chỉ 2 trạng thái cuối mới vẽ dashboard xanh:
//   CHUA_CAU_HINH  — bản build không có Supabase (xám; trước đây kẹt mãi ở KIEM_PHIEN)
//   KIEM_PHIEN     — đang kiểm phiên đăng nhập (xám)
//   CAN_DANG_NHAP  — chưa đăng nhập trên trình duyệt này (xám)
//   LOI            — lỗi tải dữ liệu (ĐỎ toàn màn, KHÔNG hiện số 0 như bình thường)
//   DANG_TAI       — đang tải dữ liệu lần đầu (xám, KHÔNG hiện số 0 xanh)
//   CU             — tải được nhưng KHÔNG làm mới quá lâu (băng cảnh báo VÀNG/ĐỎ)
//   OK             — dữ liệu tươi, đã xác minh (dashboard bình thường)
//
// Đăng xuất từ tab khác / token bị thu hồi → onAuthStateChange('SIGNED_OUT') xoá phiên
// NGAY; truyền phienId=session.user.id để useLiveData xoá dữ liệu cũ khi đổi tài khoản.
// ============================================================
import React, { useEffect, useState } from "react";
import { useLiveData } from "../hooks/useLiveData";
import { supabase } from "../lib/bmsClient";
import { fmtVN } from "../lib/dinhDang";

const MAN = ["TONG_QUAN", "SU_CO", "CUM"];
const GIAY_MOI_MAN = 15;
const CU_MS = 150 * 1000;   // >2,5 phút không làm mới được (poll 60s) → coi là dữ liệu cũ
const TV = {
  nen: { OK: "var(--bg-canvas)", CU: "var(--warning-soft)", LOI: "var(--danger-soft)", DANG_TAI: "var(--bg-canvas)", KIEM_PHIEN: "var(--bg-canvas)", CAN_DANG_NHAP: "var(--bg-canvas)", CHUA_CAU_HINH: "var(--bg-canvas)" },
  text: "var(--text-default)", muted: "var(--text-muted)", strong: "var(--text-strong)", line: "var(--border)",
  primary: "var(--primary)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", subtle: "var(--bg-subtle)",
};

// Đồng hồ tách riêng: chỉ ô giờ cập nhật mỗi giây, không kéo cả màn TV render lại.
function DongHo() {
  const [gio, setGio] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setGio(new Date()), 1000); return () => clearInterval(t); }, []);
  return <span style={{ fontVariantNumeric: "tabular-nums", color: TV.strong, fontWeight: 700 }}>{fmtVN(gio, "gioGiay")}</span>;
}

// Ô số lớn — khai báo NGOÀI TVMode: khai báo bên trong thì mỗi lần render là một component mới → React dựng lại DOM.
function So({ nhan, giaTri, mau }) {
  return (
    <div style={{ flex: "1 1 12rem", textAlign: "center", background: "var(--bg-surface)", border: `1px solid ${TV.line}`, borderTop: `6px solid ${mau}`, borderRadius: 20, padding: "clamp(1rem, 2.5vw, 2.5rem) 0.5rem", boxShadow: "var(--shadow-card)" }}>
      <div style={{ fontSize: "clamp(2.25rem, 8vw, 8rem)", fontWeight: 800, lineHeight: 1, color: mau, fontVariantNumeric: "tabular-nums" }}>{giaTri}</div>
      <div style={{ fontSize: "clamp(0.875rem, 1.5vw, 1.4rem)", color: TV.muted, marginTop: 12, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>{nhan}</div>
    </div>
  );
}

export default function TVMode() {
  const [phien, setPhien] = useState(undefined);   // undefined = đang kiểm · null = chưa đăng nhập
  const [loiPhien, setLoiPhien] = useState(null);   // getSession() lỗi (mạng/máy chủ) — không được kẹt im ở "đang xác minh"
  const live = useLiveData("live", { tuDongMoiMs: 60000, phienId: phien?.user?.id || null });
  const [man, setMan] = useState(0);
  // Mốc "bây giờ" để tính tuổi dữ liệu — 10 giây là đủ (ngưỡng dữ liệu cũ 150 giây); đồng hồ giây nằm ở <DongHo>.
  const [bayGio, setBayGio] = useState(() => Date.now());

  useEffect(() => {
    let dung = false;
    if (supabase) {
      supabase.auth.getSession()
        .then(({ data }) => { if (!dung) setPhien(data?.session || null); })
        .catch((e) => { console.error("[BMS TV] Không kiểm được phiên đăng nhập:", e); if (!dung) setLoiPhien(e); });
    }
    // Không chỉ đọc một lần: nghe SIGNED_OUT (đăng xuất tab khác/thu hồi) để xoá phiên ngay.
    const sub = supabase?.auth.onAuthStateChange((event, session) => {
      if (dung) return;
      if (event === "SIGNED_OUT") setPhien(null);
      else if (session) setPhien(session);
    });
    const t1 = setInterval(() => setMan((m) => (m + 1) % MAN.length), GIAY_MOI_MAN * 1000);
    const t2 = setInterval(() => setBayGio(Date.now()), 10000);
    return () => { dung = true; clearInterval(t1); clearInterval(t2); sub?.data?.subscription?.unsubscribe?.(); };
  }, []);

  // ===== Phân loại TRẠNG THÁI XÁC MINH (fail-safe) =====
  const chuaTaiXong = live.kpis == null || live.incidents == null;   // null = đang tải/lỗi, KHÁC rỗng thật ([])
  const tuoiMs = live.capNhatLuc ? (bayGio - live.capNhatLuc) : null;
  const tuoiPhut = tuoiMs != null ? Math.floor(tuoiMs / 60000) : null;
  let trangThai;
  if (!supabase) trangThai = "CHUA_CAU_HINH";
  else if (loiPhien) trangThai = "LOI";
  else if (phien === undefined) trangThai = "KIEM_PHIEN";
  else if (phien === null) trangThai = "CAN_DANG_NHAP";
  else if (live.loi) trangThai = "LOI";
  else if (chuaTaiXong) trangThai = "DANG_TAI";
  else if (tuoiMs != null && tuoiMs > CU_MS) trangThai = "CU";
  else trangThai = "OK";

  const veDashboard = trangThai === "OK" || trangThai === "CU";

  const incidents = Array.isArray(live.incidents) ? live.incidents : [];
  const critical = incidents.filter((i) => i.mucCanhBao === "CRITICAL");
  const dungHinh = incidents.filter((i) => i.mucCanhBao === "SUPPRESSED");
  const cum = Array.isArray(live.cumSuCo) ? live.cumSuCo : [];
  const kpis = live.kpis || { dat: 0, khongDat: 0, thieuDL: 0, tong: 0 };
  const moToanManHinh = () => {
    const root = document.documentElement;
    const ketQua = document.fullscreenElement ? document.exitFullscreen?.() : root.requestFullscreen?.();
    ketQua?.catch?.((e) => console.warn("[BMS TV] Trình duyệt từ chối toàn màn hình:", e));
  };

  const khungManHinh = (tieuDe, mauTieuDe, thanNoiDung) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <h1 style={{ fontSize: "clamp(1.25rem, 2.2vw, 2.5rem)", margin: 0, color: mauTieuDe, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "0.6em" }}>
        <span aria-hidden="true" style={{ width: "0.35em", height: "1.1em", borderRadius: 4, background: mauTieuDe, display: "inline-block" }} />{tieuDe}</h1>
      <div style={{ flex: 1, marginTop: "clamp(0.75rem, 1.5vw, 1.5rem)", minHeight: 0 }}>{thanNoiDung}</div>
    </div>
  );

  // Màn hình toàn khung cho các trạng thái KHÔNG xác minh được (không có dashboard xanh).
  const manToanKhung = (tieuDe, phu, mauChu) => (
    <div style={{ textAlign: "center", paddingTop: "16vh" }}>
      <p style={{ fontSize: "clamp(1.5rem, 3vw, 3.5rem)", fontWeight: 800, color: mauChu, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tieuDe}</p>
      {phu && <p style={{ fontSize: "clamp(1rem, 1.7vw, 1.75rem)", color: TV.text, marginTop: 16, maxWidth: "70vw", marginLeft: "auto", marginRight: "auto" }}>{phu}</p>}
    </div>
  );

  // Nền + băng cảnh báo theo trạng thái
  const nen = TV.nen[trangThai] || TV.nen.OK;

  let noiDung;
  if (trangThai === "CHUA_CAU_HINH") {
    noiDung = manToanKhung("Chưa cấu hình máy chủ dữ liệu", "Bản web này chưa được cấp địa chỉ máy chủ dữ liệu nên màn TV không có dữ liệu để hiển thị. Liên hệ quản trị hệ thống.", TV.strong);
  } else if (trangThai === "KIEM_PHIEN") {
    noiDung = manToanKhung("Đang xác minh phiên…", "Vui lòng đợi trong giây lát.", TV.muted);
  } else if (trangThai === "CAN_DANG_NHAP") {
    noiDung = manToanKhung("Chưa đăng nhập trên trình duyệt này", <>Mở chế độ thường (bỏ <code>?tv=1</code>), đăng nhập bằng tài khoản trực (nên dùng vai trò Chỉ xem), rồi quay lại đây.</>, TV.strong);
  } else if (trangThai === "LOI") {
    noiDung = manToanKhung("⚠ Lỗi tải dữ liệu, chưa xác minh được tình trạng", `Màn hình này không phản ánh tình trạng phòng sạch lúc này. Hãy kiểm tra mạng hoặc máy chủ. ${String(loiPhien?.message || live.loi?.message || live.loi || "").slice(0, 160)}`, TV.danger);
  } else if (trangThai === "DANG_TAI") {
    noiDung = manToanKhung("Đang tải dữ liệu giám sát…", "Số liệu sẽ hiện khi xác minh xong. Chưa có dữ liệu thì chưa thể coi là bình thường.", TV.muted);
  } else if (MAN[man] === "TONG_QUAN") {
    noiDung = khungManHinh("Tổng quan phòng sạch", TV.primary, (
      <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "clamp(0.75rem, 2vw, 2rem)", flexWrap: "wrap" }}>
        <So nhan="Phòng đạt" giaTri={kpis.dat} mau={TV.success} />
        <So nhan="Không đạt" giaTri={kpis.khongDat} mau={kpis.khongDat > 0 ? TV.danger : TV.success} />
        <So nhan="Thiếu dữ liệu" giaTri={kpis.thieuDL} mau={kpis.thieuDL > 0 ? TV.warning : TV.success} />
        <So nhan="Sự cố nghiêm trọng" giaTri={critical.length} mau={critical.length > 0 ? TV.danger : TV.success} />
      </div>
    ));
  } else if (MAN[man] === "SU_CO") {
    const ds = critical.slice(0, 9);
    noiDung = khungManHinh(`Sự cố cần xử lý · ${critical.length}${dungHinh.length ? ` (thêm ${dungHinh.length} cảm biến không đổi tín hiệu)` : ""}`, TV.danger, (
      ds.length === 0
        ? <p style={{ fontSize: "clamp(1rem, 3vw, 3rem)", color: TV.success, textAlign: "center", paddingTop: "12vh" }}>✓ Không có sự cố nghiêm trọng</p>
        : <div role="region" tabIndex={0} aria-label="Danh sách sự cố cần xử lý" style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", fontSize: "clamp(1rem, 1.7vw, 1.75rem)" }}>
            <tbody>{ds.map((i) => (
                <tr key={i.id} style={{ borderBottom: `1px solid ${TV.line}` }}>
                  <td style={{ padding: "0.8vw 0.5vw", color: TV.strong, fontWeight: 700, whiteSpace: "nowrap" }}>{i.id}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: TV.text }}>{i.room} · {i.sensor}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: TV.muted }}>{i.status}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: TV.muted, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {i.duration} giờ</td>
                </tr>
            ))}</tbody>
          </table></div>
    ));
  } else {
    const ds = cum.slice(0, 8);
    noiDung = khungManHinh(`Cụm điều tra · ${cum.length}`, TV.warning, (
      ds.length === 0
        ? <p style={{ fontSize: "clamp(1rem, 3vw, 3rem)", color: TV.success, textAlign: "center", paddingTop: "12vh" }}>✓ Không có cụm nào đang mở</p>
        : <div role="region" tabIndex={0} aria-label="Danh sách cụm điều tra" style={{ overflowX: "auto" }}><table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", fontSize: "clamp(1rem, 1.7vw, 1.75rem)" }}>
            <tbody>{ds.map((c) => (
              <tr key={c.ma_cum} style={{ borderBottom: `1px solid ${TV.line}` }}>
                <td style={{ padding: "0.8vw 0.5vw", color: TV.strong, fontWeight: 700, whiteSpace: "nowrap" }}>{c.ma_hien_thi}</td>
                <td style={{ padding: "0.8vw 0.5vw", color: TV.text, whiteSpace: "nowrap" }}>{c.ahu || "?"} · {c.loai_cam_bien}</td>
                <td style={{ padding: "0.8vw 0.5vw", color: (c.chan_doan || "").startsWith("HVAC") ? TV.danger : TV.muted }}>{c.chan_doan}</td>
                <td style={{ padding: "0.8vw 0.5vw", color: c.da_co_ket_luan_qa ? TV.success : TV.warning, whiteSpace: "nowrap" }}>
                  {c.da_co_ket_luan_qa ? "đã kết luận" : "chưa kết luận"}</td>
              </tr>
            ))}</tbody>
          </table></div>
    ));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: nen, color: TV.text, padding: "clamp(1rem, 2.5vw, 3rem)", fontFamily: "var(--font-ui)", display: "flex", flexDirection: "column" }}
         onDoubleClick={moToanManHinh}>
      {/* Băng cảnh báo DỮ LIỆU CŨ — chỉ khi vẫn vẽ dashboard nhưng đã lâu không làm mới */}
      {trangThai === "CU" && (
        <div style={{ background: TV.warning, color: "var(--text-inverse)", fontSize: "clamp(0.875rem, 1.6vw, 1.5rem)", fontWeight: 700, textAlign: "center", padding: "clamp(0.5rem, 0.8vw, 0.75rem)", borderRadius: 8, marginBottom: "clamp(0.5rem, 1vw, 1rem)" }}>
          ⚠ DỮ LIỆU CŨ — chưa cập nhật được {tuoiPhut} phút. Số liệu bên dưới có thể không phản ánh hiện trạng.
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>{noiDung}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", fontSize: "clamp(0.875rem, 1.3vw, 1.25rem)", color: TV.muted, borderTop: `1px solid ${TV.line}`, paddingTop: "clamp(0.5rem, 1vw, 1rem)" }}>
        <span>BMS · HVAC phòng sạch — CPC1 Hà Nội</span>
        <span style={{ display: "flex", gap: "clamp(0.75rem, 1.5vw, 1.5rem)", alignItems: "center", flexWrap: "wrap" }}>
          {veDashboard && MAN.map((m, i) => <span key={m} aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: i === man ? TV.primary : TV.subtle, display: "inline-block" }} />)}
          <span style={{ fontVariantNumeric: "tabular-nums", color: trangThai === "CU" ? TV.warning : TV.muted }}>
            {/* Chưa cấu hình: mốc "dữ liệu" là của dữ liệu mẫu — không hiện, tránh hiểu là có dữ liệu thật */}
            {trangThai !== "CHUA_CAU_HINH" && live.capNhatLuc ? `dữ liệu ${fmtVN(live.capNhatLuc, "gioGiay")}${tuoiPhut != null && tuoiPhut >= 1 ? ` · ${tuoiPhut} phút trước` : ""}` : "chưa có dữ liệu"} · <DongHo />
          </span>
          <button type="button" onClick={moToanManHinh} aria-label="Bật hoặc tắt toàn màn hình" title="Bật hoặc tắt toàn màn hình" style={{ minWidth: 44, minHeight: 44, borderRadius: 8, border: `1px solid ${TV.line}`, background: TV.subtle, color: TV.text, padding: "0 0.75rem", font: "inherit", cursor: "pointer" }}>Toàn màn hình</button>
        </span>
      </div>
    </div>
  );
}
