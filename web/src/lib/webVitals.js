// ============================================================
// webVitals.js — Đo Core Web Vitals KHÔNG cần thư viện ngoài (Mảng 4).
// Dùng PerformanceObserver + Navigation Timing sẵn có của trình duyệt để lấy
// LCP (Largest Contentful Paint), CLS (Cumulative Layout Shift), FCP, TTFB.
// Ghi ra console.info (prefix [vitals]) + gắn window.__BMS_VITALS để soi tay/E2E.
// Nhẹ (~1KB, 0 dependency) → an toàn để nằm ở bundle chính. Chỉ chạy khi trình
// duyệt hỗ trợ; mọi lỗi được nuốt để KHÔNG bao giờ ảnh hưởng chức năng.
//
// Cách benchmark: chạy `npm run build && npm run preview`, mở trang, xem console.
// (Đo trên bản BUILD chứ không phải dev — dev có HMR/không minify nên số sai lệch.)
// ============================================================
export function initWebVitals() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  const vitals = (window.__BMS_VITALS = window.__BMS_VITALS || {});
  const log = (name, value, extra) =>
    console.info(`[vitals] ${name} = ${Math.round(value)}ms`, extra || "");

  try {
    // ---- LCP: lấy entry cuối cùng trước khi người dùng tương tác ----
    const poLCP = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) vitals.LCP = last.renderTime || last.loadTime || last.startTime;
    });
    poLCP.observe({ type: "largest-contentful-paint", buffered: true });

    // ---- CLS: cộng dồn các layout shift KHÔNG do tương tác người dùng ----
    let cls = 0;
    const poCLS = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value;
      vitals.CLS = +cls.toFixed(4);
    });
    poCLS.observe({ type: "layout-shift", buffered: true });

    // ---- FCP ----
    const poFCP = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.name === "first-contentful-paint") vitals.FCP = e.startTime;
    });
    poFCP.observe({ type: "paint", buffered: true });

    // ---- Chốt số khi trang ẩn đi (điều hướng/đóng tab) → in tổng kết ----
    const chot = () => {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav) vitals.TTFB = nav.responseStart;
      log("TTFB", vitals.TTFB || 0);
      log("FCP", vitals.FCP || 0);
      log("LCP", vitals.LCP || 0);
      console.info(`[vitals] CLS = ${vitals.CLS ?? 0}`);
    };
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") chot(); }, { once: true });
    // Dự phòng: nếu tab không bao giờ ẩn, vẫn in sau 10s để có số benchmark.
    setTimeout(chot, 10000);
  } catch { /* trình duyệt cũ không hỗ trợ observer → bỏ qua */ }
}
