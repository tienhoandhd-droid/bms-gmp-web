// StatusAnchor.jsx — khối neo xử lý nhanh trên cùng tab Tổng quan.
// Chỉ giữ số việc cần xử lý; cơ cấu phòng đạt/không đạt/thiếu dữ liệu nằm ở KPI
// bên dưới để tránh lặp số và giúp người trực đọc màn hình theo đúng thứ tự ưu tiên.
// KHÔNG thêm truy vấn — chỉ bày lại số liệu AppShell đã có.
import React from "react";
import { AlertOctagon, Clock3, ShieldCheck } from "lucide-react";

export default function StatusAnchor({ p12Open, matNguon, isLive, capNhatLuc, khuChoPhep, onXemSuCo }) {
  const coViec = (p12Open || 0) > 0;
  const gioCapNhat = capNhatLuc ? new Date(capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  const trangThaiDuLieu = matNguon ? "Nguồn dữ liệu gián đoạn" : isLive ? "Dữ liệu đang cập nhật" : "Dữ liệu mô phỏng";
  const ghiChuDuLieu = matNguon ? "Tạm dừng kết luận đạt/không đạt cho tới khi nguồn ổn định." : gioCapNhat ? `Cập nhật gần nhất lúc ${gioCapNhat}.` : "Theo khung giờ chốt gần nhất.";
  const phamVi = khuChoPhep ? `Khu ${khuChoPhep.join(", ")} theo phân quyền tài khoản.` : "Toàn bộ phòng sạch trong hệ thống BMS.";
  return (
    <section aria-label="Ưu tiên vận hành" className={`rounded-2xl bg-surface px-4 sm:px-5 py-4 ring-1 ${coViec ? "ring-danger-line" : "ring-line"}`}
      style={{ boxShadow: "0 16px 36px -26px rgba(7,16,24,0.42)" }}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-4 min-w-0 lg:w-[320px]">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${coViec ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}>
            <AlertOctagon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] uppercase font-semibold text-muted">Ưu tiên vận hành</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className={`text-3xl font-semibold tabular-nums leading-none ${coViec ? "text-danger" : "text-success"}`}>{p12Open ?? "—"}</span>
              <span className="text-[13px] font-medium text-body">{coViec ? "sự cố cần xử lý" : "sự cố mở"}</span>
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex min-w-0 items-start gap-3 rounded-xl bg-subtle px-3.5 py-3 ring-1 ring-line">
            <Clock3 className={`mt-0.5 h-4 w-4 shrink-0 ${matNguon ? "text-danger" : "text-success"}`} strokeWidth={1.8} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-strong">{trangThaiDuLieu}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{ghiChuDuLieu}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-3 rounded-xl bg-subtle px-3.5 py-3 ring-1 ring-line">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={1.8} />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-strong">Phạm vi hồ sơ</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">{phamVi}</p>
            </div>
          </div>
        </div>

        <div className="lg:ml-auto">
          {onXemSuCo && (
            <button onClick={onXemSuCo}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold ring-1 transition ${coViec ? "bg-danger-soft text-danger ring-danger-line hover:bg-danger-soft/80" : "bg-success-soft text-success ring-success-line hover:bg-success-soft/80"}`}>
              Xem sự cố
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
