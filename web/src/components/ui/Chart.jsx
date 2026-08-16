// Chart.jsx — vỏ nạp trễ ECharts (tách move-only từ App.jsx 17/08/2026).
import React from "react";

// Biểu đồ (Recharts) tách sang module riêng, NẠP TRỄ (lazy) → bundle màn hình đầu
// KHÔNG kèm Recharts (~400KB); chỉ tải khi mở tab Xu hướng / modal chi tiết phòng.
const LazyChart = React.lazy(() => import("../charts"));
export default function Chart({ h = 200, ...p }) {
  return (
    <React.Suspense fallback={<div className="rounded-2xl bg-subtle animate-pulse" style={{ height: h }} />}>
      <LazyChart {...p} />
    </React.Suspense>
  );
}
