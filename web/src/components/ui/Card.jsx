// Card.jsx — primitive thẻ/tiêu đề/badge/chip dùng chung (tách move-only từ App.jsx 17/08/2026).
import React from "react";
import { CARD, cardShadow, PRIORITY, MUC } from "../../lib/uiConst";

/* ============ UI HELPERS ============ */
export function Card({ children, className = "", style = {}, ...props }) { return <div {...props} className={`${CARD} bms-panel ${className}`} style={{ ...cardShadow, ...style }}>{children}</div>; }
// Đợt B 04/09/2026: h3 → h2 — tiêu đề khối nằm ngay dưới h1 của trang; axe báo nhảy bậc ở 21/21 trang.
export function SectionTitle({ icon: Icon, children, hint }) {
  return <div className="bms-section-heading"><div className="min-w-0"><h2 className="bms-section-title">{children}</h2>{hint && <p className="bms-section-hint">{hint}</p>}</div></div>;
}
export function MucBadge({ p, stack }) { const n = p[1]; return stack ? <span className={`inline-flex flex-col items-center justify-center leading-tight px-2.5 py-1 rounded-lg ${PRIORITY[p]}`}><span className="text-[12px] font-semibold uppercase">Mức</span><span className="text-[14px] font-bold">{n}</span></span> : <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY[p]}`}>{MUC[p]}</span>; }
export function HeaderChip({ children, ring = "ring-line" }) { return <div className={`flex items-center gap-2.5 rounded-xl bg-surface px-4 ring-1 ${ring} h-[50px]`} style={cardShadow}>{children}</div>; }
