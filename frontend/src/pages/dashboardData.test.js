import test from "node:test";
import assert from "node:assert/strict";
import { calculateFocusStreak } from "./dashboardData.js";

test("calculateFocusStreak counts the current consecutive 60%+ run ending on the latest date", () => {
  const streak = calculateFocusStreak([
    { opened_date: "2026-08-25T09:00:00", duration_minutes: 120, productivity: "Productive" },
    { opened_date: "2026-08-25T11:00:00", duration_minutes: 60, productivity: "Productive" },
    { opened_date: "2026-08-26T09:00:00", duration_minutes: 120, productivity: "Productive" },
    { opened_date: "2026-08-26T11:00:00", duration_minutes: 60, productivity: "Non-Productive" },
    { opened_date: "2026-08-27T09:00:00", duration_minutes: 120, productivity: "Productive" },
    { opened_date: "2026-08-27T11:00:00", duration_minutes: 60, productivity: "Productive" },
    { opened_date: "2026-08-28T09:00:00", duration_minutes: 60, productivity: "Productive" },
    { opened_date: "2026-08-28T11:00:00", duration_minutes: 60, productivity: "Productive" },
    { opened_date: "2026-08-29T09:00:00", duration_minutes: 90, productivity: "Non-Productive" },
    { opened_date: "2026-08-30T09:00:00", duration_minutes: 100, productivity: "Productive" },
    { opened_date: "2026-08-30T11:00:00", duration_minutes: 40, productivity: "Productive" },
    { opened_date: "2026-08-31T09:00:00", duration_minutes: 100, productivity: "Productive" },
    { opened_date: "2026-08-31T11:00:00", duration_minutes: 40, productivity: "Productive" },
  ]);

  assert.equal(streak.days, 2);
  assert.equal(streak.message, "You've maintained a 60%+ focus score for 2 consecutive days.");
});

test("calculateFocusStreak returns zero when there are no qualifying days", () => {
  const streak = calculateFocusStreak([
    { opened_date: "2026-08-25T09:00:00", duration_minutes: 100, productivity: "Non-Productive" },
    { opened_date: "2026-08-26T09:00:00", duration_minutes: 90, productivity: "Non-Productive" },
  ]);

  assert.equal(streak.days, 0);
  assert.equal(streak.message, "You've maintained a 60%+ focus score for 0 consecutive days.");
});
