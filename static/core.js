/* TrackerCore - pure task/date logic shared by the UI and Node tests.
   No DOM access here so tests can run headless (node tests/test_core_logic.js). */
(function () {
  "use strict";

  const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

  /* Urgency rank for sorting: overdue first, then due today, then everything else. */
  const URGENCY_ORDER = { "overdue": 0, "due-today": 1, none: 2 };

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  /* Local-date string "YYYY-MM-DD" - never uses UTC, unlike toISOString(). */
  function todayString(now) {
    const d = now instanceof Date ? now : new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function addDays(dateStr, days) {
    if (!dateStr) return null;
    const d = parseDateOnly(dateStr);
    d.setDate(d.getDate() + days);
    return todayString(d);
  }

  /* Parse a due date into a LOCAL-midnight Date.
     Accepts "YYYY-MM-DD" or ISO datetime; ignores time/timezone suffixes on
     purpose so "2026-08-25T00:00:00" never shifts a day via UTC parsing. */
  function parseDateOnly(value) {
    const day = String(value).slice(0, 10); // "YYYY-MM-DD"
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  /* Parse a datetime-local style value as LOCAL time (never UTC).
     Manual parsing keeps browsers and Node byte-for-byte consistent. */
  function parseLocalDateTime(value) {
    const s = String(value);
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    const hh = Number(s.slice(11, 13)) || 0;
    const mm = Number(s.slice(14, 16)) || 0;
    return new Date(y, m - 1, d, hh, mm);
  }

  /* "YYYY-MM-DDTHH:MM" for <input type="datetime-local"> values and min attrs. */
  function toLocalInputValue(date) {
    const d = date instanceof Date ? date : new Date();
    return `${todayString(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  /* True when both values fall in the same calendar minute (ignores seconds). */
  function sameMinute(a, b) {
    if (!a || !b) return false;
    return String(a).slice(0, 16) === String(b).slice(0, 16);
  }

  /* True when the given due datetime is strictly before now (minus grace).
     Manual parse => identical behaviour in browser and Node tests. */
  function isPastDue(value, now, graceMinutes) {
    if (!value) return false;
    const grace = Number(graceMinutes) || 0;
    const cutoff = (now instanceof Date ? now : new Date()).getTime() - grace * 60000;
    return parseLocalDateTime(value).getTime() < cutoff;
  }

  /* Validation for the split date + time inputs.
     - No time chosen: day-level check (today counts as valid, not past).
     - Time chosen: minute-level check with submit-lag grace. */
  function isPastDeadline(dateStr, timeStr, now, graceMinutes) {
    if (!dateStr) return false;
    if (!timeStr) return compareDay(dateStr, todayString(now)) < 0;
    return isPastDue(`${dateStr}T${timeStr}`, now, graceMinutes);
  }

  /* Combine the split inputs into one API payload value (null when empty). */
  function combineDeadline(dateStr, timeStr) {
    if (!dateStr) return null;
    return `${dateStr}T${timeStr || "00:00"}`;
  }

  /* True when a stored due date carries a meaningful (non-midnight) time,
     used to decide whether to render "Due Aug 25, 2:30 PM" vs "Due Aug 25". */
  function hasTimeComponent(value) {
    const t = String(value).slice(11, 16);
    return /^\d{2}:\d{2}$/.test(t) && t !== "00:00";
  }

  /* Day-level comparison of a due date against another local day string. */
  function compareDay(dueDateValue, dayString) {
    const due = parseDateOnly(dueDateValue);
    const [y, m, d] = dayString.split("-").map(Number);
    const ref = new Date(y, m - 1, d);
    const diff = due.getTime() - ref.getTime();
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }

  /* "overdue" | "due-today" | null. Completed tasks and missing dates are never urgent. */
  function dueStatus(task, now) {
    if (!task || task.completed || !task.due_date) return null;
    const today = todayString(now);
    const cmp = compareDay(task.due_date, today);
    if (cmp < 0) return "overdue";
    if (cmp === 0) return "due-today";
    return null;
  }

  /* Priority first (High > Medium > Low), then urgency within the same
     priority, then creation order. Never mutates inputs. */
  function compareTasks(a, b, now) {
    const pa = PRIORITY_ORDER[a.priority || "Medium"];
    const pb = PRIORITY_ORDER[b.priority || "Medium"];
    if (pa !== pb) return pa - pb;

    const ua = URGENCY_ORDER[dueStatus(a, now) || "none"];
    const ub = URGENCY_ORDER[dueStatus(b, now) || "none"];
    if (ua !== ub) return ua - ub;

    return (a.id || 0) - (b.id || 0);
  }

  const TrackerCore = {
    PRIORITY_ORDER,
    URGENCY_ORDER,
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
  };

  globalThis.TrackerCore = TrackerCore;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = TrackerCore;
  }
})();
