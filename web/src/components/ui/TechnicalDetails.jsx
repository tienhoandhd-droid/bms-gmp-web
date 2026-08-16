// TechnicalDetails.jsx — chỗ DUY NHẤT được nói chuyện hạ tầng (WF*, rpc_*, Supabase…)
// trong UI (Phase F báo cáo 9). Chỉ render cho ADMIN/IT; vai trò khác thấy trống.
import React from "react";

export default function TechnicalDetails({ role, summary = "Thông tin kỹ thuật", children, className = "" }) {
  if (!["ADMIN", "IT"].includes(role)) return null;
  return (
    <details className={`rounded-xl ring-1 ring-line px-3.5 py-2.5 ${className}`}>
      <summary className="cursor-pointer text-[12px] font-medium text-muted select-none">{summary}</summary>
      <div className="mt-2 text-[12px] text-muted space-y-1.5">{children}</div>
    </details>
  );
}
