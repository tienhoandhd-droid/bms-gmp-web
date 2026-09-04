// ThongTinHeThongCard.jsx — thẻ "Thông tin hệ thống" cho thanh tra GMP (đợt C 04/09/2026).
// Annex 11 yêu cầu nhận diện được hệ thống đã thẩm định: phiên bản phần mềm, thời điểm
// build, môi trường dữ liệu, giao thức máy chủ. Trước đây các thông tin này chỉ nằm trong
// package.json / CI — không ai đang thanh tra có thể đọc từ màn hình.
// __BMS_VERSION__ / __BMS_BUILD_TIME__ do Vite thay lúc build (vite.config.js `define`).
import React from "react";
import { Info } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { HAS_SUPABASE, SUPABASE_URL } from "../../lib/config";
import { PHIEN_BAN_GIAO_THUC } from "../../lib/supabaseData";

const PHIEN_BAN = typeof __BMS_VERSION__ === "string" ? __BMS_VERSION__ : "dev";
const BUILD_LUC = typeof __BMS_BUILD_TIME__ === "string" ? __BMS_BUILD_TIME__ : "";

function mayChu() {
  if (!HAS_SUPABASE) return "chưa cấu hình (dữ liệu mẫu)";
  try { return new URL(SUPABASE_URL).host; } catch (e) { return "địa chỉ không hợp lệ"; }
}

export function ThongTinHeThongCard({ giaoDien }) {
  const buildLuc = BUILD_LUC ? new Date(BUILD_LUC).toLocaleString("vi-VN") : "bản chạy thử (chưa build)";
  const dong = [
    ["Phiên bản phần mềm", `v${PHIEN_BAN}`],
    ["Thời điểm build", buildLuc],
    ["Môi trường dữ liệu", HAS_SUPABASE ? "Dữ liệu thật (production)" : "Dữ liệu mẫu (chỉ xem trước cục bộ)"],
    ["Máy chủ dữ liệu", mayChu()],
    ["Phiên bản giao thức máy chủ", String(PHIEN_BAN_GIAO_THUC)],
    ["Giao diện đang dùng", giaoDien === "dark" ? "Tối" : "Sáng"],
    ["Trình duyệt", typeof navigator !== "undefined" ? navigator.userAgent.replace(/^Mozilla\/5\.0 /, "").slice(0, 90) : "—"],
  ];
  return (
    <Card className="p-6">
      <SectionTitle icon={Info} hint="đọc khi thanh tra hỏi 'hệ thống này phiên bản nào'">Thông tin hệ thống</SectionTitle>
      <dl className="mt-4 grid gap-y-2 gap-x-4 text-[13px] sm:grid-cols-[220px_1fr]">
        {dong.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-muted">{k}</dt>
            <dd className="text-body font-medium break-words m-0">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="mt-3 text-[12px] text-muted">Mã nguồn và nhật ký thay đổi phần mềm lưu trên kho mã của công ty; mỗi lần phát hành đều qua bộ kiểm tự động trước khi lên máy chủ.</p>
    </Card>
  );
}
