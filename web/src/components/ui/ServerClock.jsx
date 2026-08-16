// ServerClock.jsx — đồng hồ máy chủ (tách move-only từ App.jsx 17/08/2026).
import React, { useState, useEffect } from "react";
import { vnNow } from "../../lib/dinhDang";
import { COLOR } from "../../lib/designTokens";

// Đồng hồ máy chủ UTC+7 tự cập nhật mỗi giây (tách riêng để không render lại toàn trang).
export default function ServerClock({ live }) {
  const [t, setT] = useState(live ? vnNow() : "2026-05-29 14:08:22");
  useEffect(() => { if (!live) return; const id = setInterval(() => setT(vnNow()), 1000); return () => clearInterval(id); }, [live]);
  return <span className="text-xs font-semibold tabular-nums" style={{ color: COLOR.ink }}>{t}</span>;
}
