// ============================================================
// TVMode — chế độ màn hình treo tường phòng vận hành (mở bằng ?tv=1)
//
// Ba màn xoay vòng 15 giây: TỔNG QUAN → SỰ CỐ → CỤM ĐIỀU TRA. Chữ to, nền tối
// (phòng điều khiển), không thanh điều hướng, không cần chuột. Dữ liệu đi qua
// đúng useLiveData của bảng điều khiển thường (poll 60s + realtime) — TV không
// có đường dữ liệu riêng để mà lệch.
//
// Đăng nhập: dùng phiên đã lưu của trình duyệt. Chưa đăng nhập thì màn hình
// nhắc mở chế độ thường đăng nhập trước (RLS trả rỗng cho anon — đúng thiết kế).
// ============================================================
import React, { useEffect, useState } from "react";
import { useLiveData } from "../hooks/useLiveData";
import { supabase } from "../lib/bmsClient";

const MAN = ["TONG_QUAN", "SU_CO", "CUM"];
const GIAY_MOI_MAN = 15;

export default function TVMode() {
  const live = useLiveData("live", { tuDongMoiMs: 60000 });
  const [man, setMan] = useState(0);
  const [gio, setGio] = useState(new Date());
  const [phien, setPhien] = useState(undefined);   // undefined = đang kiểm

  useEffect(() => {
    let dung = false;
    supabase?.auth.getSession().then(({ data }) => { if (!dung) setPhien(data?.session || null); });
    const t1 = setInterval(() => setMan((m) => (m + 1) % MAN.length), GIAY_MOI_MAN * 1000);
    const t2 = setInterval(() => setGio(new Date()), 1000);
    return () => { dung = true; clearInterval(t1); clearInterval(t2); };
  }, []);

  const incidents = Array.isArray(live.incidents) ? live.incidents : [];
  const critical = incidents.filter((i) => i.mucCanhBao === "CRITICAL");
  const dungHinh = incidents.filter((i) => i.mucCanhBao === "SUPPRESSED");
  const quaHan = Array.isArray(live.suCoQuaHan) ? live.suCoQuaHan : [];
  const chuaTiepNhan = quaHan.filter((q) => q.qua_han_tiep_nhan).length;
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

  let noiDung;
  if (phien === null) {
    noiDung = (
      <div style={{ textAlign: "center", paddingTop: "18vh" }}>
        <p style={{ fontSize: "2.4vw", color: "#e2e8f0" }}>Chưa có phiên đăng nhập trên trình duyệt này</p>
        <p style={{ fontSize: "1.5vw", color: "#94a3b8", marginTop: 12 }}>Mở chế độ thường (bỏ <code>?tv=1</code>), đăng nhập bằng tài khoản trực, rồi quay lại đây.</p>
      </div>
    );
  } else if (MAN[man] === "TONG_QUAN") {
    noiDung = khungManHinh("Tổng quan phòng sạch", "#5eead4", (
      <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "2vw" }}>
        <So nhan="Phòng đạt" giaTri={kpis.dat} mau="#34d399" />
        <So nhan="Không đạt" giaTri={kpis.khongDat} mau={kpis.khongDat > 0 ? "#f87171" : "#34d399"} />
        <So nhan="Sự cố CRITICAL" giaTri={critical.length} mau={critical.length > 0 ? "#f87171" : "#34d399"} />
        <So nhan="Chưa tiếp nhận" giaTri={chuaTiepNhan} mau={chuaTiepNhan > 0 ? "#fbbf24" : "#34d399"} />
      </div>
    ));
  } else if (MAN[man] === "SU_CO") {
    const ds = critical.slice(0, 9);
    noiDung = khungManHinh(`Sự cố cần xử lý · ${critical.length}${dungHinh.length ? ` (+${dungHinh.length} cảm biến đứng hình)` : ""}`, "#f87171", (
      ds.length === 0
        ? <p style={{ fontSize: "3vw", color: "#34d399", textAlign: "center", paddingTop: "12vh" }}>✓ Không có sự cố CRITICAL</p>
        : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "1.7vw" }}>
            <tbody>{ds.map((i) => {
              const q = quaHan.find((x) => x.ma_su_co === i.dbId);
              const nong = q && (q.qua_han_tiep_nhan || q.qua_han_xu_ly);
              return (
                <tr key={i.id} style={{ borderBottom: "1px solid #1e293b" }}>
                  <td style={{ padding: "0.8vw 0.5vw", color: "#e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{i.id}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: "#cbd5e1" }}>{i.room} · {i.sensor}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: "#94a3b8" }}>{i.status}</td>
                  <td style={{ padding: "0.8vw 0.5vw", color: nong ? "#f87171" : "#94a3b8", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {i.duration} giờ{nong ? " · QUÁ HẠN" : ""}</td>
                </tr>
              );
            })}</tbody>
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
    <div style={{ position: "fixed", inset: 0, background: "#0b1220", color: "#e2e8f0", padding: "2.5vw", fontFamily: "Inter,'Segoe UI',Arial,sans-serif", display: "flex", flexDirection: "column" }}
         onDoubleClick={() => document.documentElement.requestFullscreen?.()}>
      <div style={{ flex: 1, minHeight: 0 }}>{noiDung}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "1.3vw", color: "#64748b", borderTop: "1px solid #1e293b", paddingTop: "1vw" }}>
        <span>BMS · HVAC phòng sạch — CPC1 Hà Nội <span style={{ color: "#475569" }}>· nháy đúp để toàn màn hình</span></span>
        <span style={{ display: "flex", gap: "1.5vw", alignItems: "center" }}>
          {MAN.map((m, i) => <span key={m} style={{ width: "0.7vw", height: "0.7vw", borderRadius: "50%", background: i === man ? "#5eead4" : "#334155", display: "inline-block" }} />)}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {live.capNhatLuc ? `dữ liệu ${live.capNhatLuc.toLocaleTimeString("vi-VN")}` : "đang nạp…"} · {gio.toLocaleTimeString("vi-VN")}
          </span>
        </span>
      </div>
    </div>
  );
}
