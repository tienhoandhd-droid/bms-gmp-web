// ============================================================
// TVMode — chế độ màn hình treo tường phòng vận hành (mở bằng ?tv=1)
//
// Ba màn xoay vòng 15 giây: TỔNG QUAN → SỰ CỐ → CỤM ĐIỀU TRA. Chữ to, nền tối
// (phòng điều khiển), không thanh điều hướng, không cần chuột.
//
// P0 GMP — "KHÔNG XÁC MINH ĐƯỢC" TUYỆT ĐỐI KHÔNG ĐƯỢC HIỂN THỊ THÀNH "BÌNH THƯỜNG":
// màn treo tường điều khiển sản xuất, một ô xanh sai đọc như "mọi phòng đạt". Vì vậy
// TV có 6 trạng thái TÁCH BẠCH, chỉ 2 trạng thái cuối mới vẽ dashboard xanh:
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

const MAN = ["TONG_QUAN", "SU_CO", "CUM"];
const GIAY_MOI_MAN = 15;
const CU_MS = 150 * 1000;   // >2,5 phút không làm mới được (poll 60s) → coi là dữ liệu cũ

export default function TVMode() {
  const [phien, setPhien] = useState(undefined);   // undefined = đang kiểm · null = chưa đăng nhập
  const live = useLiveData("live", { tuDongMoiMs: 60000, phienId: phien?.user?.id || null });
  const [man, setMan] = useState(0);
  const [gio, setGio] = useState(new Date());

  useEffect(() => {
    let dung = false;
    supabase?.auth.getSession().then(({ data }) => { if (!dung) setPhien(data?.session || null); });
    // Không chỉ đọc một lần: nghe SIGNED_OUT (đăng xuất tab khác/thu hồi) để xoá phiên ngay.
    const sub = supabase?.auth.onAuthStateChange((event, session) => {
      if (dung) return;
      if (event === "SIGNED_OUT") setPhien(null);
      else if (session) setPhien(session);
    });
    const t1 = setInterval(() => setMan((m) => (m + 1) % MAN.length), GIAY_MOI_MAN * 1000);
    const t2 = setInterval(() => setGio(new Date()), 1000);
    return () => { dung = true; clearInterval(t1); clearInterval(t2); sub?.data?.subscription?.unsubscribe?.(); };
  }, []);

  // ===== Phân loại TRẠNG THÁI XÁC MINH (fail-safe) =====
  const chuaTaiXong = live.kpis == null || live.incidents == null;   // null = đang tải/lỗi, KHÁC rỗng thật ([])
  const tuoiMs = live.capNhatLuc ? (gio - live.capNhatLuc) : null;
  const tuoiPhut = tuoiMs != null ? Math.floor(tuoiMs / 60000) : null;
  let trangThai;
  if (phien === undefined) trangThai = "KIEM_PHIEN";
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

  const So = ({ nhan, giaTri, mau }) => (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: "9vw", fontWeight: 800, lineHeight: 1, color: mau, fontVariantNumeric: "tabular-nums" }}>{giaTri}</div>
      <div style={{ fontSize: "1.6vw", color: "#94a3b8", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>{nhan}</div>
    </div>
  );

  const khungManHinh = (tieuDe, mauTieuDe, thanNoiDung) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <h1 style={{ fontSize: "2.2vw", margin: 0, color: mauTieuDe, textTransform: "uppercase", letterSpacing: "0.08em" }}>{tieuDe}</h1>
      <div style={{ flex: 1, marginTop: "1.5vw", overflow: "hidden" }}>{thanNoiDung}</div>
    </div>
  );

  // Màn hình toàn khung cho các trạng thái KHÔNG xác minh được (không có dashboard xanh).
  const manToanKhung = (tieuDe, phu, mauChu) => (
    <div style={{ textAlign: "center", paddingTop: "16vh" }}>
      <p style={{ fontSize: "3vw", fontWeight: 800, color: mauChu, textTransform: "uppercase", letterSpacing: "0.06em" }}>{tieuDe}</p>
      {phu && <p style={{ fontSize: "1.7vw", color: "#cbd5e1", marginTop: 16, maxWidth: "70vw", marginLeft: "auto", marginRight: "auto" }}>{phu}</p>}
    </div>
  );

  // Nền + băng cảnh báo theo trạng thái
  const NEN = { OK: "#0b1220", CU: "#2a1e05", LOI: "#2a0b0b", DANG_TAI: "#0f1522", KIEM_PHIEN: "#0f1522", CAN_DANG_NHAP: "#0f1522" };
  const nen = NEN[trangThai] || "#0b1220";

  let noiDung;
  if (trangThai === "KIEM_PHIEN") {
    noiDung = manToanKhung("Đang xác minh phiên…", "Vui lòng đợi trong giây lát.", "#94a3b8");
  } else if (trangThai === "CAN_DANG_NHAP") {
    noiDung = manToanKhung("Chưa đăng nhập trên trình duyệt này", <>Mở chế độ thường (bỏ <code>?tv=1</code>), đăng nhập bằng tài khoản trực (nên dùng vai trò VIEWER), rồi quay lại đây.</>, "#e2e8f0");
  } else if (trangThai === "LOI") {
    noiDung = manToanKhung("⚠ LỖI TẢI DỮ LIỆU — KHÔNG XÁC MINH ĐƯỢC", `Màn hình này KHÔNG phản ánh tình trạng phòng sạch lúc này. Kiểm tra mạng/máy chủ. ${String(live.loi?.message || live.loi || "").slice(0, 160)}`, "#f87171");
  } else if (trangThai === "DANG_TAI") {
    noiDung = manToanKhung("Đang tải dữ liệu giám sát…", "Chưa hiển thị số liệu cho tới khi xác minh xong (không suy ra 'bình thường' khi chưa có dữ liệu).", "#94a3b8");
  } else if (MAN[man] === "TONG_QUAN") {
    noiDung = khungManHinh("Tổng quan phòng sạch", "#5eead4", (
      <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "2vw" }}>
        <So nhan="Phòng đạt" giaTri={kpis.dat} mau="#34d399" />
        <So nhan="Không đạt" giaTri={kpis.khongDat} mau={kpis.khongDat > 0 ? "#f87171" : "#34d399"} />
        <So nhan="Thiếu dữ liệu" giaTri={kpis.thieuDL} mau={kpis.thieuDL > 0 ? "#fbbf24" : "#34d399"} />
        <So nhan="Sự cố CRITICAL" giaTri={critical.length} mau={critical.length > 0 ? "#f87171" : "#34d399"} />
      </div>
    ));
  } else if (MAN[man] === "SU_CO") {
    const ds = critical.slice(0, 9);
    noiDung = khungManHinh(`Sự cố cần xử lý · ${critical.length}${dungHinh.length ? ` (+${dungHinh.length} cảm biến đứng tín hiệu)` : ""}`, "#f87171", (
      ds.length === 0
        ? <p style={{ fontSize: "3vw", color: "#34d399", textAlign: "center", paddingTop: "12vh" }}>✓ Không có sự cố CRITICAL</p>
        : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "1.7vw" }}>
            <tbody>{ds.map((i) => (
                <tr key={i.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.8vw 0.5vw", color: "#e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{i.id}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: "#cbd5e1" }}>{i.room} · {i.sensor}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: "#94a3b8" }}>{i.status}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: "#94a3b8", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {i.duration} giờ</td>
                </tr>
            ))}</tbody>
          </table>
    ));
  } else {
    const ds = cum.slice(0, 8);
    noiDung = khungManHinh(`Cụm điều tra · ${cum.length}`, "#fbbf24", (
      ds.length === 0
        ? <p style={{ fontSize: "3vw", color: "#34d399", textAlign: "center", paddingTop: "12vh" }}>✓ Không có cụm nào đang mở</p>
        : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "1.7vw" }}>
            <tbody>{ds.map((c) => (
              <tr key={c.ma_cum} style={{ borderBottom: "1px solid #1e293b" }}>
                <td style={{ padding: "0.8vw 0.5vw", color: "#e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{c.ma_hien_thi}</td>
                <td style={{ padding: "0.8vw 0.5vw", color: "#cbd5e1", whiteSpace: "nowrap" }}>{c.ahu || "?"} · {c.loai_cam_bien}</td>
                <td style={{ padding: "0.8vw 0.5vw", color: (c.chan_doan || "").startsWith("HVAC") ? "#f87171" : "#94a3b8" }}>{c.chan_doan}</td>
                <td style={{ padding: "0.8vw 0.5vw", color: c.da_co_ket_luan_qa ? "#34d399" : "#fbbf24", whiteSpace: "nowrap" }}>
                  {c.da_co_ket_luan_qa ? "đã kết luận" : "chưa kết luận"}</td>
              </tr>
            ))}</tbody>
          </table>
    ));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: nen, color: "#e2e8f0", padding: "2.5vw", fontFamily: "Inter,'Segoe UI',Arial,sans-serif", display: "flex", flexDirection: "column" }}
         onDoubleClick={() => document.documentElement.requestFullscreen?.()}>
      {/* Băng cảnh báo DỮ LIỆU CŨ — chỉ khi vẫn vẽ dashboard nhưng đã lâu không làm mới */}
      {trangThai === "CU" && (
        <div style={{ background: "#b45309", color: "#fff", fontSize: "1.6vw", fontWeight: 700, textAlign: "center", padding: "0.8vw", borderRadius: "0.6vw", marginBottom: "1vw" }}>
          ⚠ DỮ LIỆU CŨ — chưa cập nhật được {tuoiPhut} phút. Số liệu bên dưới có thể không phản ánh hiện trạng.
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>{noiDung}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "1.3vw", color: "#94a3b8" /* đợt D: tương phản ≥ 4,5:1 trên nền tối */, borderTop: "1px solid #1e293b", paddingTop: "1vw" }}>
        <span>BMS · HVAC phòng sạch — CPC1 Hà Nội <span style={{ color: "#94a3b8" }}>· nháy đúp để toàn màn hình</span></span>
        <span style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
          {veDashboard && MAN.map((m, i) => <span key={m} style={{ width: "0.7vw", height: "0.7vw", borderRadius: "50%", background: i === man ? "#5eead4" : "#334155", display: "inline-block" }} />)}
          <span style={{ fontVariantNumeric: "tabular-nums", color: trangThai === "CU" ? "#fbbf24" : "#94a3b8" }}>
            {live.capNhatLuc ? `dữ liệu ${live.capNhatLuc.toLocaleTimeString("vi-VN")}${tuoiPhut != null && tuoiPhut >= 1 ? ` · ${tuoiPhut} phút trước` : ""}` : "chưa có dữ liệu"} · {gio.toLocaleTimeString("vi-VN")}
          </span>
        </span>
      </div>
    </div>
  );
}
