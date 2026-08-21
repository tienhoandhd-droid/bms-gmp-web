// StatusAnchor.jsx — khối neo xử lý nhanh trên cùng tab Tổng quan.
// Chỉ giữ số việc cần xử lý; cơ cấu phòng đạt/không đạt/thiếu dữ liệu nằm ở KPI
// bên dưới để tránh lặp số và giúp người trực đọc màn hình theo đúng thứ tự ưu tiên.
// KHÔNG thêm truy vấn — chỉ bày lại số liệu AppShell đã có.
import React from "react";
import { AlertOctagon, Clock3, ShieldCheck } from "lucide-react";

// Màu nhấn dùng TRÊN NỀN ANCHOR (tối ở cả 2 theme) — hằng sáng cố định. (token-ngoai-le)
const DO_SANG = "#FFB3AB";   // token-ngoai-le: nhấn sáng trên nền anchor tối (cả 2 theme)

export default function StatusAnchor({ p12Open, matNguon, isLive, capNhatLuc, khuChoPhep, onXemSuCo }) {
  const coViec = (p12Open || 0) > 0;
  const gioCapNhat = capNhatLuc ? new Date(capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <section aria-label="Việc cần xử lý" className="rounded-2xl px-5 sm:px-6 py-5"
      style={{ background: "var(--anchor)", color: "var(--anchor-fg)", boxShadow: "0 18px 44px -20px rgba(7,16,24,0.55)" }}>
      <p className="text-[12px] uppercase tracking-[0.2em] font-semibold" style={{ opacity: 0.8 }}>
        Việc cần chú ý{khuChoPhep ? ` · khu ${khuChoPhep.join(" · ")}` : ""}
      </p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr] gap-4">
        <div className="min-w-0">
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
        <div className="rounded-xl bg-white/10 ring-1 ring-white/15 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <Clock3 className="w-4 h-4" strokeWidth={1.8} />
            {matNguon ? "Mất kết nối dữ liệu" : isLive ? "Dữ liệu đang cập nhật" : "Dữ liệu mô phỏng"}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ opacity: 0.82 }}>
            {matNguon ? "Không kết luận đạt/không đạt khi nguồn dữ liệu gián đoạn." : gioCapNhat ? `Mốc cập nhật gần nhất ${gioCapNhat}.` : "Theo dõi theo khung giờ chốt gần nhất."}
          </p>
        </div>
        <div className="rounded-xl bg-white/10 ring-1 ring-white/15 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold">
            <ShieldCheck className="w-4 h-4" strokeWidth={1.8} />
            Phạm vi giám sát
          </div>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ opacity: 0.82 }}>
            {khuChoPhep ? `Khu ${khuChoPhep.join(", ")} theo phân quyền tài khoản.` : "Toàn bộ phòng sạch trong hệ thống BMS."}
          </p>
        </div>
      </div>
    </section>
  );
}
