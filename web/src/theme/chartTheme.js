// chartTheme.js — ECharts đọc semantic token thật tại runtime (G2 17/08/2026).
// Chart không được kẹt light khi trang dark: LazyChart gọi useThemeVersion() để
// re-render toàn bộ option mỗi khi <html data-theme> đổi.
import React from "react";

export function layToken(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function chartTokens() {
  return {
    textStrong: layToken("--text-strong", "#0B1F2E"),
    textDefault: layToken("--text-default", "#243B4D"),
    textMuted: layToken("--text-muted", "#526878"),
    chartGrid: layToken("--chart-grid", "#CCD9DF"),
    chartAxis: layToken("--chart-axis", "#526878"),
    surface: layToken("--bg-surface", "#FFFFFF"),
    subtle: layToken("--bg-subtle", "#E1EDF1"),
    border: layToken("--border", "#C4D4DC"),
    danger: layToken("--danger", "#A72924"),
    warning: layToken("--warning", "#8A5300"),
    primary: layToken("--primary", "#0A6E68"),
    info: layToken("--info", "#1768A1"),
  };
}

// Phiên bản theme — tăng khi data-theme trên <html> đổi. Dùng useSyncExternalStore
// để component re-render đúng lúc, không polling.
let phienBan = 0;
const listeners = new Set();
if (typeof window !== "undefined" && typeof MutationObserver !== "undefined") {
  const mo = new MutationObserver(() => {
    phienBan += 1;
    listeners.forEach((l) => l());
  });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function getSnapshot() { return phienBan; }

export function useThemeVersion() {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
