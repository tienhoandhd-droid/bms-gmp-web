// KhungLoi.jsx — khung báo lỗi tải dữ liệu dùng chung (đợt C 04/09/2026).
// Vì sao: trước đây mỗi tab tự xử lý (hoặc không xử lý) lỗi tải, nên "tải lỗi" và
// "không có dữ liệu" nhìn giống nhau — vi phạm nguyên tắc GMP: không được để người
// vận hành kết luận "bình thường" khi thực ra hệ thống đang hỏng.
// Một khung, ba phần cố định: chuyện gì xảy ra · lỗi cụ thể (đã dịch) · nút thử lại + thời điểm dữ liệu.
import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { moTaLoi } from "../../lib/bmsClient";

export function KhungLoi({ tieuDe = "Chưa tải được dữ liệu", loi, onThuLai, dangThu = false, capNhatLuc = null, gon = false, className = "" }) {
  const chiTiet = typeof loi === "string" ? loi : loi ? moTaLoi(loi) : "";
  const gio = capNhatLuc instanceof Date ? capNhatLuc.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  if (gon) {
    return (
      <div role="alert" className={`rounded-2xl bg-danger-soft ring-1 ring-danger-line px-4 py-3 flex items-start gap-3 text-[13px] ${className}`}>
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-danger" strokeWidth={1.9} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-danger">{tieuDe}</p>
          {chiTiet && <p className="mt-0.5 text-body">{chiTiet}</p>}
        </div>
        {onThuLai && <button type="button" onClick={onThuLai} disabled={dangThu} className="shrink-0 rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold text-danger ring-1 ring-danger-line hover:bg-danger-soft disabled:opacity-60 min-h-[32px]">{dangThu ? "Đang thử…" : "Thử lại"}</button>}
      </div>
    );
  }
  return (
    <div role="alert" className={`rounded-2xl bg-danger-soft ring-1 ring-danger-line p-5 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-surface p-2 ring-1 ring-danger-line shrink-0"><AlertTriangle className="w-5 h-5 text-danger" strokeWidth={1.8} aria-hidden="true" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-danger">{tieuDe}</p>
          {chiTiet && <p className="mt-1 text-[13px] text-body leading-relaxed">{chiTiet}</p>}
          <p className="mt-1 text-[12px] text-muted">
            {gio ? <>Đang hiển thị dữ liệu tính đến <b className="text-body tabular-nums">{gio}</b> — chưa được làm mới.</> : "Chưa có dữ liệu nào được tải trong phiên này."}
            {" "}Đừng kết luận "bình thường" khi khung này còn hiện.
          </p>
          {onThuLai && (
            <button type="button" onClick={onThuLai} disabled={dangThu} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-surface px-3.5 py-2 text-[12px] font-semibold text-danger ring-1 ring-danger-line hover:bg-danger-soft disabled:opacity-60 min-h-[40px]">
              <RefreshCw className={`w-3.5 h-3.5 ${dangThu ? "animate-spin" : ""}`} strokeWidth={2} aria-hidden="true" /> {dangThu ? "Đang tải lại…" : "Thử tải lại"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
