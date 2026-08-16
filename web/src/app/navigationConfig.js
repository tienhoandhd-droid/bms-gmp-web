// navigationConfig.js — MỘT nguồn điều hướng duy nhất (Phase A báo cáo 9).
// Key = tham số ?tab= cũ, KHÔNG đổi (bookmark/deep-link giữ nguyên).
// Nhãn tiếng Việt theo bảng thay từ báo cáo (9): Xu hướng, Hồ sơ & SOP, Người nhận.
// Phân quyền vẫn qua roleCanSeeTab(role, k) — file này chỉ mô tả cấu trúc.
import { LayoutDashboard, AlertOctagon, Gauge, Radio, ClipboardList, LineChart, FileBarChart, ScrollText, Mail, Settings } from "lucide-react";

export const NAV_GROUPS = [
  { label: "Vận hành", items: [
    { k: "home", label: "Tổng quan", icon: LayoutDashboard },
    { k: "events", label: "Sự cố", icon: AlertOctagon },
    { k: "recent", label: "Chênh áp", icon: Gauge },
    { k: "sensors", label: "Cảm biến", icon: Radio },
    { k: "tasks", label: "Công việc", icon: ClipboardList },
  ] },
  { label: "Phân tích", items: [
    { k: "trend", label: "Xu hướng", icon: LineChart },
    { k: "reports", label: "Báo cáo", icon: FileBarChart },
  ] },
  { label: "Hồ sơ", items: [
    { k: "audit", label: "Hồ sơ & SOP", icon: ScrollText },
  ] },
  { label: "Quản trị", items: [
    { k: "recipients", label: "Người nhận", icon: Mail },
    { k: "settings", label: "Cài đặt", icon: Settings },
  ] },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
// 4 mục cố định của bottom-nav mobile; mục thứ 5 là "Thêm" (mở sheet các mục còn lại).
export const BOTTOM_NAV_KEYS = ["home", "events", "recent", "tasks"];
