// StatusAnchor.jsx — khối neo "TÌNH TRẠNG HIỆN TẠI" trên cùng tab Tổng quan.
// Phase B (báo cáo 9): hero chỉ còn 3 số — sự cố cần xử lý / phòng đang đạt /
// phòng thiếu dữ liệu. Đồng hồ + meta (8 AHU, cập nhật mỗi giờ) đã bỏ: độ tươi
// nằm ở SystemHealthStrip, thông tin hệ thống nằm ở Cài đặt.
// KHÔNG thêm truy vấn — chỉ bày lại số liệu AppShell đã có.
import React from "react";
import { AlertOctagon } from "lucide-react";

// Màu nhấn dùng TRÊN NỀN ANCHOR (tối ở cả 2 theme) — hằng sáng cố định. (token-ngoai-le)
const DO_SANG = "#FFB3AB";   // token-ngoai-le: nhấn sáng trên nền anchor tối (cả 2 theme)
const VANG_SANG = "#F5CE8B"; // token-ngoai-le: nhấn sáng trên nền anchor tối (cả 2 theme)

export default function StatusAnchor({ p12Open, kpis, matNguon, khuChoPhep, onXemSuCo }) {
  const coViec = (p12Open || 0) > 0;
  return (
    <section aria-label="Tình trạng hiện tại" className="rounded-3xl px-5 sm:px-7 py-5 sm:py-6"
      style={{ background: "var(--anchor)", color: "var(--anchor-fg)", boxShadow: "0 18px 44px -20px rgba(7,16,24,0.55)" }}>
      <p className="text-[12px] uppercase tracking-[0.2em] font-semibold" style={{ opacity: 0.8 }}>
        Tình trạng hiện tại{khuChoPhep ? ` · khu ${khuChoPhep.join(" · ")}` : ""}
      </p>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
        <div>
          <p className="text-[32px] sm:text-[40px] font-light tabular-nums leading-none" style={{ color: coViec ? DO_SANG : "var(--anchor-fg)" }}>{p12Open ?? "—"}</p>
          <p className="mt-1.5 text-[13px] font-medium">sự cố cần xử lý</p>
          {onXemSuCo && (
            <button onClick={onXemSuCo}
              className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/15 px-3 py-1.5 text-[13px] font-semibold"
              style={{ color: "var(--anchor-fg)" }}>
              <AlertOctagon className="w-3.5 h-3.5" strokeWidth={2} /> Xem sự cố cần xử lý
            </button>
          )}
        </div>
        <div>
          <p className="text-[32px] sm:text-[40px] font-light tabular-nums leading-none">
            {matNguon ? "—" : <>{kpis.dat}<span className="text-[20px]" style={{ opacity: 0.6 }}>/{kpis.tong}</span></>}
          </p>
          <p className="mt-1.5 text-[13px] font-medium">phòng đang đạt{matNguon ? " — không kết luận" : ""}</p>
        </div>
        <div>
          {matNguon ? (
            <>
              <p className="text-[20px] sm:text-[24px] font-bold leading-tight" style={{ color: DO_SANG }}>Mất kết nối dữ liệu</p>
              <p className="mt-1.5 text-[13px] font-medium">số liệu chưa được cập nhật</p>
            </>
          ) : (
            <>
              <p className="text-[32px] sm:text-[40px] font-light tabular-nums leading-none" style={{ color: (kpis.thieuDL || 0) > 0 ? VANG_SANG : "var(--anchor-fg)" }}>{kpis.thieuDL ?? 0}</p>
              <p className="mt-1.5 text-[13px] font-medium">phòng thiếu dữ liệu</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
