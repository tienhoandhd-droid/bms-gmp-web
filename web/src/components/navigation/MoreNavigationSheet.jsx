// MoreNavigationSheet.jsx — sheet "Thêm" trên mobile: các mục ngoài bottom-nav (Phase A báo cáo 9).
import React from "react";
import InspectorDrawer from "../layout/InspectorDrawer";
import { NAV_ITEMS, BOTTOM_NAV_KEYS } from "../../app/navigationConfig";
import { roleCanSeeTab } from "../../lib/phanQuyen";

export default function MoreNavigationSheet({ open, onClose, tab, setTab, role }) {
  if (!open) return null;
  const items = NAV_ITEMS.filter((it) => !BOTTOM_NAV_KEYS.includes(it.k) && roleCanSeeTab(role, it.k));
  return (
    <InspectorDrawer onClose={onClose} title="Thêm" eyebrow="Điều hướng">
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.k;
          return (
            <button key={it.k} onClick={() => { setTab(it.k); onClose(); }}
              className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] font-medium ring-1 ${active ? "bg-primarytk-soft ring-success-line" : "ring-line hover:bg-subtle text-body"}`}
              style={active ? { color: "var(--text-strong)" } : {}}>
              <Icon className="w-4 h-4" strokeWidth={1.8} style={active ? { color: "var(--primary)" } : {}} /> {it.label}
            </button>
          );
        })}
      </div>
    </InspectorDrawer>
  );
}
