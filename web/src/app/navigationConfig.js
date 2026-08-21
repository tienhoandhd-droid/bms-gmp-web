// navigationConfig.js — MỘT nguồn điều hướng duy nhất (Phase A báo cáo 9).
// Key = tham số ?tab= cũ, KHÔNG đổi (bookmark/deep-link giữ nguyên).
// Nhãn tiếng Việt theo bảng thay từ báo cáo (9): Xu hướng, Hồ sơ & SOP, Người nhận.
// Phân quyền vẫn qua roleCanSeeTab(role, k) — file này chỉ mô tả cấu trúc.
import { LayoutDashboard, AlertOctagon, Gauge, Radio, ClipboardList, LineChart, FileBarChart, ScrollText, Mail, Settings } from "lucide-react";
import { VI } from "../content/vi";

export const NAV_GROUPS = [
  { label: "Vận hành", items: [
    { k: "home", label: VI.nav.home, icon: LayoutDashboard },
    { k: "events", label: VI.nav.events, icon: AlertOctagon },
    { k: "recent", label: VI.nav.recent, icon: Gauge },
    { k: "sensors", label: VI.nav.sensors, icon: Radio },
    { k: "tasks", label: VI.nav.tasks, icon: ClipboardList },
  ] },
  { label: "Theo dõi xu hướng", items: [
    { k: "trend", label: VI.nav.trend, icon: LineChart },
    { k: "reports", label: VI.nav.reports, icon: FileBarChart },
  ] },
  { label: "Hồ sơ", items: [
    { k: "audit", label: VI.nav.audit, icon: ScrollText },
  ] },
  { label: "Quản trị", items: [
    { k: "recipients", label: VI.nav.recipients, icon: Mail },
    { k: "settings", label: VI.nav.settings, icon: Settings },
  ] },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
// 4 mục cố định của bottom-nav mobile; mục thứ 5 là "Thêm" (mở sheet các mục còn lại).
export const BOTTOM_NAV_KEYS = ["home", "events", "recent"];
