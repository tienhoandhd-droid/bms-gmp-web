// GiaoDienCard.jsx — thẻ chọn giao diện Sáng/Tối trong tab Cài đặt (G2 17/08/2026).
import React from "react";
import { SunMoon } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui/Card";
import { useTheme } from "../../app/providers/ThemeProvider";

const LUA_CHON = [
  { k: "system", label: "Theo hệ thống", mo: "Tự đổi theo cài đặt máy" },
  { k: "light", label: "Sáng", mo: "Nền sáng cố định" },
  { k: "dark", label: "Tối", mo: "Nền tối cố định" },
];

export default function GiaoDienCard() {
  const { preference, setPreference } = useTheme();
  return (
    <Card className="p-6">
      <SectionTitle icon={SunMoon} hint="áp dụng ngay, lưu trên máy này">Giao diện</SectionTitle>
      <div role="radiogroup" aria-label="Chọn giao diện" className="mt-3 grid gap-2 sm:grid-cols-3">
        {LUA_CHON.map((o) => (
          <label key={o.k} className={`flex items-start gap-2.5 rounded-2xl px-3.5 py-3 cursor-pointer surface--subtle ${preference === o.k ? "ring-2" : "ring-1"}`}
            style={{ borderColor: "var(--border)", boxShadow: "none", ["--tw-ring-color"]: preference === o.k ? "var(--primary)" : "var(--border)" }}>
            <input type="radio" name="bms-theme" className="mt-0.5 accent-[var(--primary)]" checked={preference === o.k} onChange={() => setPreference(o.k)} />
            <span>
              <span className="block text-[13px] font-semibold" style={{ color: "var(--text-strong)" }}>{o.label}</span>
              <span className="block text-[12px] meta">{o.mo}</span>
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}
