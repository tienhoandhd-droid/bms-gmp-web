// SystemHealthStrip.jsx — MỘT dòng sức khỏe hệ thống (Phase A báo cáo 9).
// Thay cả dòng meta (Trạng thái đồng bộ/Toàn vẹn/Giờ) lẫn banner Supabase cũ.
// Nguyên tắc HMI: bình thường = im lặng (1 dòng mảnh); bất thường = nổi rõ.
import React from "react";

export default function SystemHealthStrip({ isLive, matNguon, dangTai, capNhatLuc, thieuDL = 0, suCoCanXuLy = 0, loi = null }) {
  const gio = capNhatLuc ? capNhatLuc.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;

  if (!isLive) {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5 text-[13px] text-muted">
        <span className="w-2 h-2 rounded-full bg-muted/60 shrink-0" /> Dữ liệu thử nghiệm
      </div>
    );
  }
  if (matNguon || loi) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-danger-soft ring-1 ring-danger-line px-3.5 py-2.5 text-[13px] font-semibold text-danger" role="alert">
        <span aria-hidden>⚠</span>
        <span>
          Mất kết nối dữ liệu{gio ? ` · lần cập nhật cuối ${gio}` : ""}{suCoCanXuLy > 0 ? ` · ${suCoCanXuLy} sự cố cần xử lý` : ""}
          <span className="block font-normal text-[12px] mt-0.5">Số liệu hiển thị dựa trên lần cập nhật trước khi mất kết nối.</span>
        </span>
      </div>
    );
  }
  const canhBao = [];
  if (thieuDL > 0) canhBao.push(`${thieuDL} phòng thiếu dữ liệu`);
  if (suCoCanXuLy > 0) canhBao.push(`${suCoCanXuLy} sự cố cần xử lý`);
  return (
    <div className="flex items-center gap-2 px-1 py-1.5 text-[13px] text-body">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dangTai ? "bg-success-solid animate-pulse" : "bg-success-solid"}`} />
      <span>
        {canhBao.length ? <>Đang cập nhật · {canhBao.join(" · ")}</> : "Dữ liệu bình thường"}
        {gio ? <span className="text-muted"> · cập nhật {gio}</span> : null}
      </span>
    </div>
  );
}
