import test from "node:test";
import assert from "node:assert/strict";
import {
  latestCompletedResponseWeek,
  shiftResponseWeek,
  buildResponseComparison,
  formatResponseRate,
} from "../src/features/reports/responseRateModel.js";

test("latest completed response week uses the Monday–Sunday calendar in Vietnam", () => {
  // 03:00 UTC thứ Hai 09/11/2026 là 10:00 sáng thứ Hai giờ VN: tuần vừa xong là 02/11–08/11.
  assert.deepEqual(latestCompletedResponseWeek(new Date("2026-11-09T03:00:00Z")), {
    start: "2026-11-02",
    end: "2026-11-08",
  });
  // Chủ nhật vẫn thuộc tuần đang chạy, nên chỉ chọn được tuần trước nữa.
  assert.deepEqual(latestCompletedResponseWeek(new Date("2026-11-08T10:00:00Z")), {
    start: "2026-10-26",
    end: "2026-11-01",
  });
  // 18:00 UTC Chủ nhật đã là 01:00 thứ Hai giờ VN: tính theo ngày Việt Nam.
  assert.deepEqual(latestCompletedResponseWeek(new Date("2026-11-08T18:00:00Z")), {
    start: "2026-11-02",
    end: "2026-11-08",
  });
});

test("week navigation moves exactly seven days and never offers an unfinished week", () => {
  const current = { start: "2026-11-02", end: "2026-11-08" };
  const now = new Date("2026-11-09T03:00:00Z");
  assert.deepEqual(shiftResponseWeek(current, -1), { start: "2026-10-26", end: "2026-11-01" });
  assert.deepEqual(shiftResponseWeek(current, 1, now), current);
  assert.deepEqual(shiftResponseWeek({ start: "2026-10-26", end: "2026-11-01" }, 1, now), current);
});

test("comparison keeps null rates and deltas when either week has no eligible deliveries", () => {
  const comparison = buildResponseComparison({
    periods: [
      { rows: [
        { role: "IPC", denominator: 8, responded: 6, rate_pct: 75 },
        { role: "MEP", denominator: 0, responded: 0, rate_pct: null },
      ] },
      { rows: [
        { role: "IPC", denominator: 4, responded: 3, rate_pct: 75 },
        { role: "MEP", denominator: 5, responded: 5, rate_pct: 100 },
      ] },
    ],
  });

  assert.deepEqual(comparison, [
    { role: "IPC", current: { role: "IPC", denominator: 8, responded: 6, rate_pct: 75 }, previous: { role: "IPC", denominator: 4, responded: 3, rate_pct: 75 }, delta_pct_points: 0 },
    { role: "MEP", current: { role: "MEP", denominator: 0, responded: 0, rate_pct: null }, previous: { role: "MEP", denominator: 5, responded: 5, rate_pct: 100 }, delta_pct_points: null },
  ]);
  assert.equal(formatResponseRate(null), "—");
  assert.equal(formatResponseRate(75.5), "75,5%");
});

test("comparison preserves a missing rate when a row has an eligible denominator", () => {
  const [item] = buildResponseComparison({
    periods: [
      { rows: [{ role: "QA", denominator: 3, responded: 1, rate_pct: null }] },
      { rows: [{ role: "QA", denominator: 2, responded: 2, rate_pct: 100 }] },
    ],
  });
  assert.equal(item.current.rate_pct, null);
  assert.equal(item.delta_pct_points, null);
});
