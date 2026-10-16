import test from "node:test";
import assert from "node:assert/strict";
import {
  latestCompletedResponseWeek,
  shiftResponseWeek,
  buildResponseComparison,
  formatResponseRate,
} from "../src/features/reports/responseRateModel.js";

test("latest completed response week uses the Thursday–Wednesday calendar in Vietnam", () => {
  // 10:00 UTC Thursday is Thursday evening in Vietnam; the Wednesday that just
  // ended is 2026-09-09. The in-progress Thu–Wed week must not be selectable.
  assert.deepEqual(latestCompletedResponseWeek(new Date("2026-09-10T10:00:00Z")), {
    start: "2026-09-03",
    end: "2026-09-09",
  });
  // Wednesday itself is still part of an in-progress reporting week.
  assert.deepEqual(latestCompletedResponseWeek(new Date("2026-09-09T10:00:00Z")), {
    start: "2026-08-27",
    end: "2026-09-02",
  });
});

test("week navigation moves exactly seven days and never offers an unfinished week", () => {
  const current = { start: "2026-09-03", end: "2026-09-09" };
  assert.deepEqual(shiftResponseWeek(current, -1), { start: "2026-08-27", end: "2026-09-02" });
  assert.deepEqual(shiftResponseWeek(current, 1, new Date("2026-09-10T10:00:00Z")), current);
  assert.deepEqual(shiftResponseWeek({ start: "2026-08-27", end: "2026-09-02" }, 1, new Date("2026-09-10T10:00:00Z")), current);
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
