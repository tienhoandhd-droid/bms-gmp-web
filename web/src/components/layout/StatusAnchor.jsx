// StatusAnchor.jsx — khối neo "TÌNH TRẠNG HỆ THỐNG" trên cùng tab Tổng quan (G3 17/08/2026).
// Một anchor tối duy nhất trả lời trong 5 giây: có gì cần xử lý · bao nhiêu phòng đạt ·
// dữ liệu có mới không. KHÔNG thêm truy vấn — chỉ bày lại số liệu AppShell đã có.
import React from "react";
import { AlertOctagon } from "lucide-react";
import ServerClock from "../ui/ServerClock";

// Màu nhấn dùng TRÊN NỀN ANCHOR (tối ở cả 2 theme) — hằng sáng cố định, không lấy
// theo theme vì nền anchor không đổi sáng/tối đáng kể. (token-ngoai-le)
const DO_SANG = "#FFB3AB";
const XANH_SANG = "#8FE3D6";
const VANG_SANG = "#F5CE8B";

export default function StatusAnchor({ p12Open, kpis, matNguon, isLive, capNhatLuc, khuChoPhep, onXemSuCo }) {
  const coViec = (p12Open || 0) > 0;
  return (
    <section aria-label="Tình trạng hệ thống" className="rounded-3xl px-5 sm:px-7 py-5 sm:py-6"
      style={{ background: "var(--anchor)", color: "var(--anchor-fg)", boxShadow: "0 18px 44px -20px rgba(7,16,24,0.55)" }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-[12px] uppercase tracking-[0.2em] font-semibold" style={{ opacity: 0.8 }}>Tình trạng hệ thống</p>
        <span className="text-[12px] tabular-nums" style={{ opacity: 0.8 }}><ServerClock live={isLive} /></span>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
        <div>
          <p className="text-[32px] sm:text-[40px] font-light tabular-nums leading-none" style={{ color: coViec ? DO_SANG : "var(--anchor-fg)" }}>{p12Open ?? "—"}</p>
          <p className="mt-1.5 text-[13px] font-medium">sự cố cần xử lý</p>
          {onXemSuCo && (
            <button onClick={onXemSuCo}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/15 px-3 py-1.5 text-[13px] font-semibold"
              style={{ color: "var(--anchor-fg)" }}>
              <AlertOctagon className="w-3.5 h-3.5" strokeWidth={2} /> Xem sự cố
            </button>
          )}
        </div>
        <div>
          <p className="text-[32px] sm:text-[40px] font-light tabular-nums leading-none">
            {matNguon ? "—" : <>{kpis.dat}<span className="text-[20px]" style={{ opacity: 0.6 }}>/{kpis.tong}</span></>}
          </p>
          <p className="mt-1.5 text-[13px] font-medium">phòng đạt{matNguon ? " — không kết luận" : ""}</p>
          {!matNguon && kpis.thieuDL > 0 && <p className="text-[12px] mt-0.5" style={{ color: VANG_SANG }}>{kpis.thieuDL} phòng thiếu dữ liệu</p>}
        </div>
        <div>
          {matNguon ? (
            <p className="text-[20px] sm:text-[24px] font-bold leading-tight" style={{ color: DO_SANG }}>MẤT NGUỒN SỐ LIỆU</p>
          ) : (
            <p className="text-[20px] sm:text-[24px] font-semibold leading-tight" style={{ color: XANH_SANG }}>
              {isLive ? (capNhatLuc ? `Dữ liệu ${capNhatLuc.toLocaleTimeString("vi-VN")}` : "Đang đồng bộ…") : "Chế độ thử nghiệm"}
            </p>
          )}
          <p className="mt-1.5 text-[13px] font-medium">{matNguon ? "số bên dưới là số CŨ" : "cập nhật gần nhất"}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-x-3 gap-y-1 flex-wrap text-[12px]" style={{ opacity: 0.75 }}>
        <span>{kpis.tong} phòng giám sát</span>·
        <span>{khuChoPhep ? `phạm vi xem: khu ${khuChoPhep.join(" · ")}` : "3 khu: C1 · C4 · Q2"}</span>·
        <span>8 AHU</span>·
        <span>cập nhật mỗi giờ</span>
      </div>
    </section>
  );
}
