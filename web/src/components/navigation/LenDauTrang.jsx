// LenDauTrang.jsx — Nút nổi "Lên đầu trang" (09/11/2026). Chỉ hiện khi đã cuộn xuống quá 600px.
// Mobile: đặt cao hơn thanh menu dưới (bottom-nav) để không che nhau.
import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function LenDauTrang() {
  const [hien, setHien] = useState(false);
  useEffect(() => {
    const onScroll = () => setHien(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!hien) return null;
  return (
    <button type="button"
      onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); document.getElementById("bms-page-heading")?.focus({ preventScroll: true }); }}
      className="bms-khong-in fixed right-4 bottom-24 lg:bottom-6 z-40 flex items-center gap-1.5 h-11 rounded-full bg-surface px-4 text-tk-xs font-semibold text-body shadow-lg ring-1 ring-line hover:bg-subtle"
      aria-label="Lên đầu trang" title="Lên đầu trang">
      <ArrowUp className="h-4 w-4" strokeWidth={2} /> <span className="hidden sm:inline">Lên đầu trang</span>
    </button>
  );
}
