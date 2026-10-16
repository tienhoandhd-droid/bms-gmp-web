// ChiCoLive.jsx — khung "chức năng này chỉ có khi đọc dữ liệu thật" (16/10/2026).
// Vì sao: ở chế độ dữ liệu mẫu, nhiều khối trước đây hiện hộp ĐỎ "Mất kết nối…" hoặc
// hộp VÀNG "chưa sẵn sàng" — người xem tưởng hệ thống hỏng. Đây không phải lỗi mà là
// giới hạn của chế độ mẫu ⇒ dùng màu TRUNG TÍNH (ISA-101: màu chỉ dành cho bất thường).
import React from "react";
import { Database } from "lucide-react";

export function ChiCoLive({ tieuDe = "Chỉ có khi kết nối dữ liệu thật", children, className = "" }) {
  return (
    <div role="status" className={`cleanroom-grid rounded-2xl ring-1 ring-line bg-subtle/40 px-5 py-6 flex items-start gap-3 ${className}`}>
      <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-surface ring-1 ring-line text-muted" aria-hidden="true">
        <Database className="w-4 h-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-tk-sm font-semibold text-strong">{tieuDe}</p>
        {children && <p className="mt-1 text-tk-xs leading-relaxed text-muted">{children}</p>}
      </div>
    </div>
  );
}
