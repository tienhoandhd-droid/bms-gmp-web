// BannerCapNhat.jsx — banner "có bản mới" (tách move-only từ App.jsx 17/08/2026).
import React, { useState, useEffect } from "react";

// Banner "có bản mới" — hiện khi SW phát hiện phiên bản deploy mới (sự kiện
// bms:co-ban-moi từ index.html). 1 chạm Tải lại (index.html network-first nên
// reload nhận đủ HTML+asset mới). Đặc biệt hữu ích trên điện thoại (không F5 tay).
export function BannerCapNhat() {
  const [hien, setHien] = useState(false);
  useEffect(() => {
    const on = () => setHien(true);
    window.addEventListener("bms:co-ban-moi", on);
    return () => window.removeEventListener("bms:co-ban-moi", on);
  }, []);
  if (!hien) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-2xl sm:inset-x-auto sm:right-4">
      <span className="text-[13px] font-medium leading-tight">Đã có bản cập nhật mới của ứng dụng.</span>
      <button onClick={() => window.location.reload()} className="ml-auto shrink-0 rounded-xl bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-strong hover:bg-subtle">Tải lại</button>
      <button onClick={() => setHien(false)} aria-label="Để sau" className="shrink-0 text-white/50 hover:text-white">✕</button>
    </div>
  );
}
