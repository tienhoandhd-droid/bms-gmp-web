// DesktopSidebar.jsx — điều hướng dọc desktop (Phase A báo cáo 9).
// ≥1024px: sidebar 224px, thu về 72px (nhớ qua localStorage). <1024px: ẩn (bottom-nav lo).
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
    <aside aria-label="Thanh bên điều hướng" data-collapsed={gon} className="bms-sidebar hidden lg:flex flex-col shrink-0 sticky top-0 h-screen border-r">
      <div className={`bms-brand flex items-center ${gon ? "justify-center px-0" : ""}`}>
        <CpcLogo className="h-9 w-9 shrink-0" />
        {!gon && (
          <div className="min-w-0 leading-tight">
            <p className="bms-brand-name">BMS<span className="ml-1.5 text-[12px] font-medium text-muted tracking-normal">/ HVAC</span></p>
            <p className="bms-brand-caption mt-1">CPC1 Hà Nội</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3" aria-label="Điều hướng chính">
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((it) => roleCanSeeTab(role, it.k));
          if (!items.length) return null;
          return (
            <div key={g.label} className="bms-nav-group">
              {!gon && <p className="bms-nav-label">{g.label}</p>}
              {items.map((it) => {
                const Icon = it.icon;
                const active = tab === it.k;
                const badge = badges[it.k];
                return (
                  <button key={it.k} onClick={() => setTab(it.k)} title={gon ? it.label : undefined}
                    aria-label={it.label} aria-current={active ? "page" : undefined}
                    className={`bms-nav-link relative w-full flex items-center gap-2.5 text-left ${gon ? "justify-center" : ""}`}>
                    {active && <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r" style={{ background: "var(--primary)" }} />}
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} style={active ? { color: "var(--primary)" } : {}} />
                    {!gon && <span className="flex-1 truncate">{it.label}</span>}
                    {badge > 0 && !gon && <span className="bms-nav-badge tabular-nums">{badge}</span>}
                    {badge > 0 && gon && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-danger-solid" />}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {!gon && <div className="bms-sidebar-bottom"><strong>Giám sát phòng sạch</strong><span>Phòng Quản lý chất lượng</span></div>}
      <button onClick={doiGon} className="flex items-center justify-center gap-2 h-11 border-t border-line text-muted hover:bg-subtle text-[12px]"
        aria-label={gon ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}>
        {gon ? <ChevronsRight className="w-4 h-4" strokeWidth={1.8} /> : <><ChevronsLeft className="w-4 h-4" strokeWidth={1.8} /> Thu gọn</>}
      </button>
    </aside>
  );
}
