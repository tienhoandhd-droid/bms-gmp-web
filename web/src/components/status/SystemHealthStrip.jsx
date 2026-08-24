// SystemHealthStrip.jsx — MỘT dòng sức khỏe hệ thống (Phase A báo cáo 9).
// Thay cả dòng meta (Trạng thái đồng bộ/Toàn vẹn/Giờ) lẫn banner Supabase cũ.
// Nguyên tắc HMI: bình thường = im lặng (1 dòng mảnh); bất thường = nổi rõ.
import React from "react";

export default function SystemHealthStrip({ isLive, matNguon, dangTai, capNhatLuc, thieuDL = 0, suCoCanXuLy = 0, loi = null, inline = false, sucKhoe = null }) {
  const gio = capNhatLuc ? capNhatLuc.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
  const maTrangThai = sucKhoe?.maTrangThai || null;
  const tomTat = sucKhoe?.tomTat || null;
  const loiN8n = maTrangThai === "N8N_PIPELINE_ERROR" || maTrangThai === "WF1_PIPELINE_ERROR";
  const apiItKhongKetNoi = maTrangThai === "IT_API_UNREACHABLE" || maTrangThai === "FMS_UNREACHABLE";
  const bmsKhongCoDuLieu = maTrangThai === "BMS_SOURCE_EMPTY" || maTrangThai === "FMS_DATA_LOSS";
  const nhanLoi = loiN8n
    ? "Luồng lấy dữ liệu lỗi"
    : bmsKhongCoDuLieu
      ? "API có kết nối, không có dữ liệu BMS"
      : apiItKhongKetNoi
        ? "Không kết nối được API nguồn"
        : "Mất dữ liệu";

  // inline: chip gọn nằm trong header (báo cáo 10 — bình thường không chiếm hàng riêng)
  if (inline) {
    if (!isLive) return <span className="inline-flex items-center gap-1.5 text-[13px] text-muted"><span className="w-2 h-2 rounded-full bg-muted/60" /> Dữ liệu mẫu</span>;
    if (matNguon || loi) return <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-danger"><span className="w-2 h-2 rounded-full bg-danger-solid" /> {loi ? "Không xác minh được" : nhanLoi}{gio ? ` · ${gio}` : ""}</span>;
    const canh = [];
    if (thieuDL > 0) canh.push(`${thieuDL} thiếu dữ liệu`);
    if (suCoCanXuLy > 0) canh.push(`${suCoCanXuLy} sự cố`);
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-body" aria-label={`Kết nối ổn định${gio ? `, cập nhật ${gio}` : ""}`}>
        <span className={`w-2 h-2 rounded-full bg-success-solid ${dangTai ? "animate-pulse" : ""}`} />
        <span className="hidden xl:inline">{canh.length ? canh.join(" · ") : "Kết nối ổn định"}</span>
        {gio && <span className="text-muted tabular-nums">{gio}</span>}
      </span>
    );
  }
  if (!isLive) {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5 text-[13px] text-muted">
        <span className="w-2 h-2 rounded-full bg-muted/60 shrink-0" /> Dữ liệu mẫu
      </div>
    );
  }
  if (matNguon || loi) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-danger-soft ring-1 ring-danger-line px-3.5 py-2.5 text-[13px] font-semibold text-danger" role="alert">
        <span aria-hidden>⚠</span>
        <span>
          {loi ? "Không xác minh được trạng thái dữ liệu" : nhanLoi}{gio ? ` · lần cập nhật cuối ${gio}` : ""}{suCoCanXuLy > 0 ? ` · ${suCoCanXuLy} sự cố cần xử lý` : ""}
          <span className="block font-normal text-[12px] mt-0.5">{tomTat || "Tạm dừng kết luận đạt/không đạt cho tới khi nguồn dữ liệu ổn định."}</span>
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
