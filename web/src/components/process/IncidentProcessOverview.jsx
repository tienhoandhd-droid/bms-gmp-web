// IncidentProcessOverview.jsx — sơ đồ quy trình 4 BƯỚC (Phase D báo cáo 9).
// Người mới hiểu quy trình trong 5 giây; bấm bước → drawer liệt kê trạng thái +
// nút thao tác theo vai trò (nguồn duy nhất: bảng luật xem_nut_thao_tac qua dsNut).
// KHÔNG hiện mã enum/WF ở overview — chúng nằm trong "Thông tin kỹ thuật" của drawer.
import React from "react";
import { ArrowRight, ArrowDown } from "lucide-react";
import InspectorDrawer from "../layout/InspectorDrawer";
import { nutKhopTrangThai } from "../../lib/nutThaoTac";
import { tenVaiTro } from "../../lib/phanQuyen";
import { TRANG_THAI_CODE_TO_LABEL } from "../../lib/supabaseData";

const CAC_BUOC = [
  { id: "detect", label: "Phát hiện", owner: "Hệ thống", mo: "Dữ liệu vượt giới hạn — phiếu sự cố tự mở", codes: [] },
  { id: "ipc", label: "IPC kiểm tra", owner: "IPC", mo: "Xác nhận tại hiện trường", codes: ["CHUA_XU_LY", "MO_LAI"] },
  { id: "mep", label: "Cơ điện xử lý", owner: "Cơ điện", mo: "Khắc phục hoặc chuyển tiếp", codes: ["DA_BAO_CO_DIEN", "CO_DIEN_DANG_XU_LY", "CO_DIEN_CHO_XU_LY", "CO_DIEN_KHONG_XU_LY_DUOC"] },
  { id: "close", label: "Xác nhận & đóng", owner: "QA / Hệ thống", mo: "Đóng hồ sơ khi đã về ngưỡng", codes: ["DA_KHAC_PHUC"] },
];

export default function IncidentProcessOverview({ dsNut = null, role = null }) {
  const [buoc, setBuoc] = React.useState(null);

  const Node = ({ b }) => (
    <button onClick={() => setBuoc(b)}
      className="flex-1 min-w-[150px] text-left rounded-2xl ring-1 ring-line bg-surface hover:bg-subtle px-4 py-3">
      <p className="text-[14px] font-semibold" style={{ color: "var(--text-strong)" }}>{b.label}</p>
      <p className="text-[12px] text-muted mt-0.5">{b.owner}</p>
      <p className="text-[13px] text-body mt-1 leading-snug">{b.mo}</p>
    </button>
  );

  return (
    <div>
      <div className="hidden sm:flex items-stretch gap-2">
        {CAC_BUOC.map((b, i) => (
          <React.Fragment key={b.id}>
            <Node b={b} />
            {i < CAC_BUOC.length - 1 && <span className="self-center text-muted shrink-0"><ArrowRight className="w-4 h-4" strokeWidth={2} /></span>}
          </React.Fragment>
        ))}
      </div>
      <div className="sm:hidden flex flex-col gap-2">
        {CAC_BUOC.map((b, i) => (
          <React.Fragment key={b.id}>
            <Node b={b} />
            {i < CAC_BUOC.length - 1 && <span className="self-center text-muted"><ArrowDown className="w-4 h-4" strokeWidth={2} /></span>}
          </React.Fragment>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-muted">Bấm một bước để xem trạng thái và thao tác của từng bộ phận.</p>

      {buoc && (
        <InspectorDrawer onClose={() => setBuoc(null)} eyebrow={`Phụ trách: ${buoc.owner}`} title={buoc.label}>
          <p className="text-[13px] text-body">{buoc.mo}.</p>
          {buoc.codes.length > 0 && (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-1.5">Trạng thái có thể gặp</p>
              <ul className="space-y-1">
                {[...new Set(buoc.codes.map((c) => TRANG_THAI_CODE_TO_LABEL[c] || c))].map((nhan) => <li key={nhan} className="text-[13px] text-body">• {nhan}</li>)}
              </ul>
            </div>
          )}
          {buoc.codes.length > 0 && (dsNut && dsNut.length ? (
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-1.5">Thao tác theo bộ phận</p>
              <div className="space-y-2">
                {buoc.codes.map((c) => {
                  const nut = nutKhopTrangThai(dsNut, c);
                  if (!nut.length) return null;
                  return (
                    <div key={c} className="rounded-xl ring-1 ring-line px-3 py-2">
                      <p className="text-[12px] text-muted mb-1">{TRANG_THAI_CODE_TO_LABEL[c] || c}</p>
                      <ul className="space-y-0.5">
                        {nut.filter((n) => n.nhan).map((n) => (
                          <li key={`${c}-${n.vai_tro}-${n.hanh_dong}`} className="text-[13px] text-body">
                            <b className="text-strong">{tenVaiTro(n.vai_tro)}</b>: {n.nhan}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-muted italic">Đăng nhập chế độ dữ liệu thật để xem nút thao tác theo bảng quy tắc đang chạy.</p>
          ))}
          {buoc.id === "detect" && (
            <p className="text-[13px] text-body">Hệ thống chấm điểm dữ liệu mỗi giờ theo ngưỡng trong <b>Cài đặt → Quy tắc cảnh báo</b>; vượt ngưỡng thì phiếu sự cố tự mở và giao cho IPC.</p>
          )}
          {buoc.id === "close" && (
            <p className="text-[13px] text-body">Phiếu đóng khi bộ phận xác nhận đã khắc phục, hoặc hệ thống tự đóng khi số liệu về ngưỡng đủ lâu. Hồ sơ và nhật ký thao tác được giữ nguyên phục vụ GMP.</p>
          )}
          {["ADMIN", "IT"].includes(role) && buoc.codes.length > 0 && (
            <details className="rounded-xl ring-1 ring-line px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-medium text-muted select-none">Thông tin kỹ thuật</summary>
              <p className="mt-1.5 text-[12px] text-muted">Mã trạng thái: {buoc.codes.join(" · ")}</p>
            </details>
          )}
        </InspectorDrawer>
      )}
    </div>
  );
}
