// StatusAnchor.jsx — khối neo xử lý nhanh trên cùng tab Tổng quan.
// Chỉ giữ số việc cần xử lý; cơ cấu phòng đạt/không đạt/thiếu dữ liệu nằm ở KPI
// bên dưới để tránh lặp số và giúp người trực đọc màn hình theo đúng thứ tự ưu tiên.
// KHÔNG thêm truy vấn — chỉ bày lại số liệu AppShell đã có.
import React from "react";
import { ArrowRight, Clock3 } from "lucide-react";

export default function StatusAnchor({ p12Open, matNguon, isLive, capNhatLuc, khuChoPhep, onXemSuCo, sucKhoe = null }) {
  const coViec = (p12Open || 0) > 0;
  const gioCapNhat = capNhatLuc ? new Date(capNhatLuc).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  const maTrangThai = sucKhoe?.maTrangThai || null;
  const loiN8n = maTrangThai === "N8N_PIPELINE_ERROR" || maTrangThai === "WF1_PIPELINE_ERROR";
  const apiItKhongKetNoi = maTrangThai === "IT_API_UNREACHABLE" || maTrangThai === "FMS_UNREACHABLE";
  const bmsKhongCoDuLieu = maTrangThai === "BMS_SOURCE_EMPTY" || maTrangThai === "FMS_DATA_LOSS";
  const trangThaiDuLieu = matNguon
    ? (loiN8n ? "Luồng lấy dữ liệu lỗi"
      : bmsKhongCoDuLieu ? "API có kết nối, không có dữ liệu BMS"
      : apiItKhongKetNoi ? "Không kết nối được API nguồn"
      : "Nguồn dữ liệu gián đoạn")
    : isLive ? "Dữ liệu đang cập nhật" : "Dữ liệu mô phỏng";
  const ghiChuDuLieu = matNguon ? (sucKhoe?.tomTat || "Tạm dừng kết luận đạt/không đạt cho tới khi nguồn ổn định.") : gioCapNhat ? `Cập nhật gần nhất lúc ${gioCapNhat}.` : "Theo khung giờ chốt gần nhất.";
  const phamVi = khuChoPhep ? `Khu ${khuChoPhep.join(", ")} theo phân quyền tài khoản.` : "Toàn bộ phòng sạch trong hệ thống BMS.";
  return (
    <section aria-label="Ưu tiên vận hành" className="bms-priority">
      <div className="bms-priority-main">
        <p className="text-[12px] text-muted font-medium mb-2">Cần chú ý</p>
        <div className="bms-priority-title">
          <span className={`bms-priority-count ${coViec ? "text-danger" : "text-success"}`}>{p12Open ?? "—"}</span>
          <span>{coViec ? "sự cố cần xử lý" : "sự cố mở"}</span>
        </div>
      </div>
      <div className="bms-priority-meta" data-interrupted={matNguon}>
        <p className={`flex items-center gap-1.5 font-medium ${matNguon ? "text-danger" : "text-body"}`}><Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{trangThaiDuLieu}</p>
        <p>{ghiChuDuLieu}</p>
        <p className="bms-scope">{phamVi}</p>
      </div>
      {onXemSuCo && <button onClick={onXemSuCo} className="bms-priority-action">Xem sự cố <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
    </section>
  );
}
