// DesktopSidebar.jsx — điều hướng dọc desktop (Phase A báo cáo 9).
// ≥1024px: sidebar 232px, thu về 68px (nhớ qua localStorage). <1024px: ẩn (bottom-nav lo).
// Chỉ TRÌNH BÀY — quyền xem tab vẫn là roleCanSeeTab, key tab giữ nguyên.
import React from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_GROUPS } from "../../app/navigationConfig";
import { roleCanSeeTab } from "../../lib/phanQuyen";
import CpcLogo from "../ui/CpcLogo";

const KEY_THU_GON = "bms-sidebar";

export default function DesktopSidebar({ tab, setTab, role, badges = {} }) {
  const [gon, setGon] = React.useState(() => {
    try { return localStorage.getItem(KEY_THU_GON) === "gon"; } catch { return false; }
  });
  const doiGon = () => setGon((v) => {
    const m = !v;
    try { localStorage.setItem(KEY_THU_GON, m ? "gon" : "rong"); } catch { /* private mode */ }
    return m;
  });

  return (
    <aside aria-label="Thanh bên điều hướng" className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen border-r border-line bg-surface ${gon ? "w-[68px]" : "w-[232px]"}`}>
      <div className={`flex items-center gap-2.5 px-3.5 h-16 border-b border-line ${gon ? "justify-center px-0" : ""}`}>
        <CpcLogo className="h-9 w-9 shrink-0" />
        {!gon && (
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] font-bold truncate" style={{ color: "var(--text-strong)" }}>Giám sát HVAC</p>
            <p className="text-[12px] text-muted truncate">phòng sạch</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3" aria-label="Điều hướng chính">
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((it) => roleCanSeeTab(role, it.k));
          if (!items.length) return null;
          return (
            <div key={g.label} className="mb-4">
              {!gon && <p className="px-4 mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted">{g.label}</p>}
              {items.map((it) => {
                const Icon = it.icon;
                const active = tab === it.k;
                const badge = badges[it.k];
                return (
                  <button key={it.k} onClick={() => setTab(it.k)} title={gon ? it.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`relative w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium text-left ${active ? "bg-primarytk-soft" : "hover:bg-subtle text-body"} ${gon ? "justify-center px-0" : ""}`}
                    style={active ? { color: "var(--text-strong)" } : {}}>
                    {active && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r" style={{ background: "var(--primary)" }} />}
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} style={active ? { color: "var(--primary)" } : {}} />
                    {!gon && <span className="flex-1 truncate">{it.label}</span>}
                    {badge > 0 && !gon && <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-danger-soft text-danger tabular-nums">{badge}</span>}
                    {badge > 0 && gon && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-danger-solid" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <button onClick={doiGon} className="flex items-center justify-center gap-2 h-11 border-t border-line text-muted hover:bg-subtle text-[12px]"
        aria-label={gon ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}>
        {gon ? <ChevronsRight className="w-4 h-4" strokeWidth={1.8} /> : <><ChevronsLeft className="w-4 h-4" strokeWidth={1.8} /> Thu gọn</>}
      </button>
    </aside>
  );
}
