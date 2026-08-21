// Card.jsx — primitive thẻ/tiêu đề/badge/chip dùng chung (tách move-only từ App.jsx 17/08/2026).
import React from "react";
import { CARD, cardShadow, PRIORITY, MUC } from "../../lib/uiConst";
import { COLOR } from "../../lib/designTokens";

/* ============ UI HELPERS ============ */
export function Card({ children, className = "", style = {} }) { return <div className={`${CARD} ${className}`} style={{ ...cardShadow, ...style }}>{children}</div>; }
export function SectionTitle({ icon: Icon, children, hint }) { return <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--text-strong)" }}><Icon className="w-4 h-4" style={{ color: "var(--primary)" }} strokeWidth={1.8} />{children}{hint && <span className="text-[12px] font-normal text-muted">— {hint}</span>}</h3>; }
export function MucBadge({ p, stack }) { const n = p[1]; return stack ? <span className={`inline-flex flex-col items-center justify-center leading-tight px-2.5 py-1 rounded-lg ${PRIORITY[p]}`}><span className="text-[12px] font-semibold uppercase">Mức</span><span className="text-[14px] font-bold">{n}</span></span> : <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY[p]}`}>{MUC[p]}</span>; }
export function HeaderChip({ children, ring = "ring-line" }) { return <div className={`flex items-center gap-2.5 rounded-xl bg-surface px-4 ring-1 ${ring} h-[50px]`} style={cardShadow}>{children}</div>; }
