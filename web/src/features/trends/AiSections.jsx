// AiSections.jsx — khối trình bày văn bản phân tích (tách khỏi TrendPage 17/08/2026 để ReportsPage không kéo cả trang trends).
import React from "react";
import { Gauge, Activity, FileBarChart, CheckCircle2, Sparkles } from "lucide-react";
import { COLOR } from "../../lib/designTokens";

export // Hiển thị kết quả AI theo MỤC: tách theo "## TÊN MỤC", mỗi mục là 1 khối có tiêu đề + màu.
// Nếu văn bản không có marker "##" → hiển thị nguyên văn (tương thích kết quả cũ).
function AiSections({ text }) {
  if (!text) return null;
  const raw = String(text).trim();
  if (!/##\s+/.test(raw)) return <p className="text-[13px] leading-relaxed text-slate-600 whitespace-pre-line">{raw}</p>;
  const blocks = raw.split(/\n?##\s+/).map((s) => s.trim()).filter(Boolean);
  const META = [
    { kw: "DỮ LIỆU", icon: Gauge, c: COLOR.sky, bg: "bg-sky-50/70", ring: "ring-sky-100" },
    { kw: "PHÂN TÍCH", icon: Activity, c: COLOR.teal, bg: "bg-teal-50/70", ring: "ring-teal-100" },
    { kw: "BÁO CÁO", icon: FileBarChart, c: COLOR.navy, bg: "bg-slate-50", ring: "ring-slate-200" },
    { kw: "CAPA", icon: CheckCircle2, c: COLOR.coralDeep, bg: "bg-amber-50/70", ring: "ring-amber-100" },
  ];
  return <div className="space-y-3 mt-3">{blocks.map((b, idx) => {
    const nl = b.indexOf("\n");
    const title = (nl < 0 ? b : b.slice(0, nl)).trim();
    const body = (nl < 0 ? "" : b.slice(nl + 1)).trim();
    const m = META.find((x) => title.toUpperCase().includes(x.kw)) || { icon: Sparkles, c: COLOR.teal, bg: "bg-slate-50", ring: "ring-slate-200" };
    const Icon = m.icon;
    const lines = body.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
    // Gom các dòng BẢNG markdown (| a | b |) liền kề thành 1 khối bảng; còn lại là dòng chữ.
    const khoi = [];
    lines.forEach((l) => {
      const t = l.trim();
      if (t.startsWith("|") && t.endsWith("|")) {
        const last = khoi[khoi.length - 1];
        if (last && last.kind === "table") last.rows.push(t); else khoi.push({ kind: "table", rows: [t] });
      } else khoi.push({ kind: "line", text: l });
    });
    const parseRow = (r) => r.slice(1, -1).split("|").map((c) => c.trim());
    const laNgan = (cells) => cells.every((c) => /^[-: ]*$/.test(c));
    return (
      <div key={idx} className={`rounded-2xl ring-1 ${m.ring} ${m.bg} p-3.5`}>
        <div className="flex items-center gap-2 mb-1.5"><Icon className="w-4 h-4 shrink-0" style={{ color: m.c }} strokeWidth={1.9} /><h5 className="text-[12px] font-bold uppercase tracking-wide" style={{ color: m.c }}>{title}</h5></div>
        <div className="space-y-1.5">{khoi.map((k, j) => {
          if (k.kind === "table") {
            const rows = k.rows.map(parseRow).filter((cells) => !laNgan(cells));
            if (!rows.length) return null;
            const [head, ...than] = rows;
            return (
              <div key={j} className="overflow-x-auto rounded-lg ring-1 ring-slate-200/80 bg-white/70 my-1">
                <table className="w-full text-[11.5px]">
                  <thead><tr className="text-left text-[10.5px] uppercase tracking-wide text-slate-500 bg-slate-50/80">{head.map((c, i) => <th key={i} className="py-1.5 px-2.5 font-semibold whitespace-nowrap">{c}</th>)}</tr></thead>
                  <tbody>{than.map((r, ri) => <tr key={ri} className="border-t border-slate-100">{r.map((c, ci) => <td key={ci} className={`py-1.5 px-2.5 ${ci === 0 ? "font-medium text-slate-700" : "text-slate-600 tabular-nums"}`}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          }
          const t = k.text.trim();
          const bullet = t.startsWith("•") || t.startsWith("-");
          const txt = t.replace(/^[•-]\s*/, "");
          const warn = txt.startsWith("⚠");
          return <p key={j} className={`text-[12.5px] leading-relaxed ${warn ? "text-amber-700 font-medium" : "text-slate-600"} ${bullet ? "flex gap-1.5" : ""}`}>{bullet && <span className="mt-[2px] shrink-0" style={{ color: m.c }}>•</span>}<span>{txt}</span></p>;
        })}</div>
      </div>
    );
  })}</div>;
}
