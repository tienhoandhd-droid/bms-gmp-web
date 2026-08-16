// MobileBottomNav.jsx — điều hướng dưới cùng cho mobile (<1024px) (Phase A báo cáo 9).
// 4 tab hay dùng + "Thêm" mở sheet các mục còn lại. Desktop dùng sidebar, ẩn thanh này.
import React from "react";
import { Menu } from "lucide-react";
import { NAV_ITEMS, BOTTOM_NAV_KEYS } from "../../app/navigationConfig";
import { roleCanSeeTab } from "../../lib/phanQuyen";

export default function MobileBottomNav({ tab, setTab, role, badges = {}, onMoThem }) {
  const chinh = BOTTOM_NAV_KEYS
    .map((k) => NAV_ITEMS.find((it) => it.k === k))
    .filter((it) => it && roleCanSeeTab(role, it.k));
  const conLai = NAV_ITEMS.filter((it) => !BOTTOM_NAV_KEYS.includes(it.k) && roleCanSeeTab(role, it.k));
  const themActive = conLai.some((it) => it.k === tab);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]" aria-label="Điều hướng chính">
      <div className="grid" style={{ gridTemplateColumns: `repeat(${chinh.length + (conLai.length ? 1 : 0)}, 1fr)` }}>
        {chinh.map((it) => {
          const Icon = it.icon;
          const active = tab === it.k;
          const badge = badges[it.k];
          return (
            <button key={it.k} onClick={() => setTab(it.k)} aria-current={active ? "page" : undefined}
              className="relative flex flex-col items-center gap-0.5 py-2 text-[12px] font-medium"
              style={{ color: active ? "var(--primary)" : "var(--text-muted)" }}>
              <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.8} />
              <span>{it.label}</span>
              {badge > 0 && <span className="absolute top-1 right-1/2 translate-x-4 text-[12px] leading-none font-bold px-1 py-0.5 rounded-full bg-danger-soft text-danger tabular-nums">{badge}</span>}
            </button>
          );
        })}
        {conLai.length > 0 && (
          <button onClick={onMoThem} className="flex flex-col items-center gap-0.5 py-2 text-[12px] font-medium"
            style={{ color: themActive ? "var(--primary)" : "var(--text-muted)" }}>
            <Menu className="w-5 h-5" strokeWidth={themActive ? 2 : 1.8} />
            <span>Thêm</span>
          </button>
        )}
      </div>
    </nav>
  );
}
