/* Headless unit tests for TrackerCore (run: node tests/test_core_logic.js).
   Covers the tricky parts of the due-date feature: timezone-safe parsing,
   day-level overdue/today detection, and task ordering.
   Now loads from src/utils/core.js (React build) */
import assert from "assert";
import * as Core from "../src/utils/core.js";

const {
  todayString,
  addDays,
  parseDateOnly,
  parseLocalDateTime,
  toLocalInputValue,
  sameMinute,
  isPastDue,
  isPastDeadline,
  combineDeadline,
  hasTimeComponent,
  compareDay,
  dueStatus,
  compareTasks,
} = Core.default || Core;

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

/* ===== todayString ===== */
test("todayString formats local date without UTC shift", () => {
  const d = new Date(2026, 7, 25, 23, 59, 59); // Aug 25 local, near midnight
  assert.strictEqual(todayString(d), "2026-08-25");
});

test("todayString zero-pads month and day", () => {
  assert.strictEqual(todayString(new Date(2026, 0, 5)), "2026-01-05");
});

/* ===== parseDateOnly ===== */
test("parseDateOnly keeps date-only strings on the same local day", () => {
  const d = parseDateOnly("2026-08-25");
  assert.deepStrictEqual(
    [d.getFullYear(), d.getMonth(), d.getDate()],
    [2026, 7, 25]
  );
});

test("parseDateOnly ignores time and timezone suffixes", () => {
  for (const value of [
    "2026-08-25T00:00:00",
    "2026-08-25T23:59:59.999",
    "2026-08-25T09:30:00Z",
    "2026-08-25",
  ]) {
    const d = parseDateOnly(value);
    assert.deepStrictEqual(
      [d.getFullYear(), d.getMonth(), d.getDate()],
      [2026, 7, 25],
      `failed for ${value}`
    );
  }
});

/* ===== compareDay / addDays ===== */
test("compareDay is a pure day-level comparator", () => {
  assert.strictEqual(compareDay("2026-08-24", "2026-08-25"), -1);
  assert.strictEqual(compareDay("2026-08-25", "2026-08-25"), 0);
  assert.strictEqual(compareDay("2026-08-26", "2026-08-25"), 1);
  assert.strictEqual(compareDay("2026-08-25T18:00:00", "2026-08-25"), 0);
});

test("addDays rolls over month ends", () => {
  assert.strictEqual(addDays("2026-08-31", 1), "2026-09-01");
  assert.strictEqual(addDays("2026-03-01", -1), "2026-02-28");
  assert.strictEqual(addDays(null, 3), null);
});

/* ===== dueStatus ===== */
const NOW = new Date(2026, 7, 25, 12, 0, 0); // fixed noon, Aug 25 2026

test("yesterday due date is overdue", () => {
  assert.strictEqual(
    dueStatus({ completed: false, due_date: "2026-08-24" }, NOW),
    "overdue"
  );
});

test("today due date is due-today regardless of stored time", () => {
  assert.strictEqual(
    dueStatus({ completed: false, due_date: "2026-08-25" }, NOW),
    "due-today"
  );
  assert.strictEqual(
    dueStatus({ completed: false, due_date: "2026-08-25T09:00:00" }, NOW),
    "due-today"
  );
  assert.strictEqual(
    dueStatus({ completed: false, due_date: "2026-08-25T23:59:00" }, NOW),
    "due-today"
  );
});

test("tomorrow and later are not urgent", () => {
  assert.strictEqual(dueStatus({ completed: false, due_date: "2026-08-26" }, NOW), null);
  assert.strictEqual(dueStatus({ completed: false, due_date: "2027-01-01" }, NOW), null);
});

test("completed tasks never show urgency", () => {
  assert.strictEqual(dueStatus({ completed: true, due_date: "2026-08-20" }, NOW), null);
  assert.strictEqual(dueStatus({ completed: true, due_date: "2026-08-25" }, NOW), null);
});

test("missing due date or malformed task yields no status", () => {
  assert.strictEqual(dueStatus({ completed: false, due_date: null }, NOW), null);
  assert.strictEqual(dueStatus({}, NOW), null);
  assert.strictEqual(dueStatus(null, NOW), null);
});

test("month-old due date is overdue (long gap)", () => {
  assert.strictEqual(
    dueStatus({ completed: false, due_date: "2026-07-01" }, NOW),
    "overdue"
  );
});

/* ===== compareTasks ===== */
function ids(tasks) {
  return tasks.map((t) => t.id);
}

test("priority stays the primary sort key", () => {
  const tasks = [
    { id: 3, priority: "Low", due_date: "2026-08-20" },
    { id: 1, priority: "High", due_date: null },
    { id: 2, priority: "Medium", due_date: null },
  ];
  assert.deepStrictEqual(ids(tasks.slice().sort((a, b) => compareTasks(a, b, NOW))), [1, 2, 3]);
});

test("within same priority, overdue sorts before plain tasks", () => {
  const tasks = [
    { id: 1, priority: "High", due_date: "2026-09-01" },
    { id: 2, priority: "High", due_date: "2026-08-20" },
    { id: 3, priority: "High", due_date: "2026-08-25" },
  ];
  assert.deepStrictEqual(ids(tasks.slice().sort((a, b) => compareTasks(a, b, NOW))), [2, 3, 1]);
});

test("completed tasks never claim urgency over an equal pending task", () => {
  const tasks = [
    { id: 1, priority: "High", completed: true, due_date: "2026-08-24" },
    { id: 2, priority: "High", completed: false, due_date: "2026-08-24" },
  ];
  assert.deepStrictEqual(ids(tasks.slice().sort((a, b) => compareTasks(a, b, NOW))), [2, 1]);
});

test("completed tasks tie with plain tasks via creation order", () => {
  const tasks = [
    { id: 2, priority: "High", completed: false, due_date: null },
    { id: 1, priority: "High", completed: true, due_date: "2026-08-20" },
  ];
  assert.deepStrictEqual(ids(tasks.slice().sort((a, b) => compareTasks(a, b, NOW))), [1, 2]);
});

test("ties fall back to creation order (id)", () => {
  const tasks = [
    { id: 9, priority: "Low", due_date: null },
    { id: 4, priority: "Low", due_date: null },
  ];
  assert.deepStrictEqual(ids(tasks.slice().sort((a, b) => compareTasks(a, b, NOW))), [4, 9]);
});

test("missing priority defaults to Medium", () => {
  const tasks = [
    { id: 1, priority: undefined, due_date: null },
    { id: 2, priority: "Medium", due_date: null },
    { id: 3, priority: "Low", due_date: null },
  ];
  assert.deepStrictEqual(ids(tasks.slice().sort((a, b) => compareTasks(a, b, NOW))), [1, 2, 3]);
});

/* ===== datetime-local helpers (deadline time feature) ===== */

test("parseLocalDateTime treats naive datetimes as local wall time", () => {
  const d = parseLocalDateTime("2026-08-25T14:30");
  assert.deepStrictEqual(
    [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()],
    [2026, 7, 25, 14, 30]
  );
});

test("toLocalInputValue renders datetime-local format with zero padding", () => {
  assert.strictEqual(
    toLocalInputValue(new Date(2026, 7, 5, 9, 5)),
    "2026-08-05T09:05"
  );
});

test("sameMinute ignores seconds and handles nulls", () => {
  assert.strictEqual(sameMinute("2026-08-25T14:30:00", "2026-08-25T14:30:59"), true);
  assert.strictEqual(sameMinute("2026-08-25T14:30", "2026-08-25T14:31"), false);
  assert.strictEqual(sameMinute(null, "2026-08-25T14:30"), false);
  assert.strictEqual(sameMinute("2026-08-25T14:30", null), false);
});

const NOW2 = new Date(2026, 7, 25, 12, 0, 0);

test("isPastDue flags past datetimes", () => {
  assert.strictEqual(isPastDue("2026-08-25T11:59", NOW2), true);
  assert.strictEqual(isPastDue("2026-08-20T23:00", NOW2), true);
});

test("isPastDue honours grace window and treats 'now' as not-yet-past", () => {
  assert.strictEqual(isPastDue("2026-08-25T12:00", NOW2), false);
  assert.strictEqual(isPastDue("2026-08-25T11:59", NOW2), true);
  assert.strictEqual(isPastDue("2026-08-25T11:59", NOW2, 1), false);
  assert.strictEqual(isPastDue("2026-08-25T13:00", NOW2), false);
});

test("isPastDue ignores empty values", () => {
  assert.strictEqual(isPastDue(null, NOW2), false);
  assert.strictEqual(isPastDue("", NOW2), false);
});

test("hasTimeComponent distinguishes midnight from real times", () => {
  assert.strictEqual(hasTimeComponent("2026-08-25T14:30"), true);
  assert.strictEqual(hasTimeComponent("2026-08-25T14:30:45"), true);
  assert.strictEqual(hasTimeComponent("2026-08-25T00:00"), false);
  assert.strictEqual(hasTimeComponent("2026-08-25T00:00:00"), false);
  assert.strictEqual(hasTimeComponent("2026-08-25"), false);
});

/* ===== split date + time inputs (calendar + clock pickers) ===== */

test("isPastDeadline without time is day-level: today passes, yesterday fails", () => {
  assert.strictEqual(isPastDeadline("2026-08-25", "", NOW2), false);
  assert.strictEqual(isPastDeadline("2026-08-24", null, NOW2), true);
  assert.strictEqual(isPastDeadline("2026-09-01", "", NOW2), false);
});

test("isPastDeadline with time is minute-level with grace", () => {
  assert.strictEqual(isPastDeadline("2026-08-25", "11:59", NOW2), true);
  assert.strictEqual(isPastDeadline("2026-08-25", "11:59", NOW2, 1), false);
  assert.strictEqual(isPastDeadline("2026-08-25", "12:00", NOW2), false);
});

test("isPastDeadline ignores missing dates", () => {
  assert.strictEqual(isPastDeadline(null, "09:00", NOW2), false);
  assert.strictEqual(isPastDeadline("", "", NOW2), false);
});

test("combineDeadline merges fields; time defaults to midnight; empty -> null", () => {
  assert.strictEqual(combineDeadline("2026-08-25", "14:30"), "2026-08-25T14:30");
  assert.strictEqual(combineDeadline("2026-08-25", ""), "2026-08-25T00:00");
  assert.strictEqual(combineDeadline("2026-08-25", null), "2026-08-25T00:00");
  assert.strictEqual(combineDeadline("", "14:30"), null);
  assert.strictEqual(combineDeadline(null, null), null);
});

console.log(`\n${passed} frontend logic tests passed`);
