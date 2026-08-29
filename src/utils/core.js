/* TrackerCore — pure task/date logic (ported from static/core.js) */
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const URGENCY_ORDER = { "overdue": 0, "due-today": 1, none: 2 };

function pad2(n) {
  return String(n).padStart(2, "0");
}

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

function parseDateOnly(value) {
  const day = String(value).slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function parseLocalDateTime(value) {
  const s = String(value);
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const hh = Number(s.slice(11, 13)) || 0;
  const mm = Number(s.slice(14, 16)) || 0;
  return new Date(y, m - 1, d, hh, mm);
}

function toLocalInputValue(date) {
  const d = date instanceof Date ? date : new Date();
  return `${todayString(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function sameMinute(a, b) {
  if (!a || !b) return false;
  return String(a).slice(0, 16) === String(b).slice(0, 16);
}

function isPastDue(value, now, graceMinutes) {
  if (!value) return false;
  const grace = Number(graceMinutes) || 0;
  const cutoff = (now instanceof Date ? now : new Date()).getTime() - grace * 60000;
  return parseLocalDateTime(value).getTime() < cutoff;
}

function isPastDeadline(dateStr, timeStr, now, graceMinutes) {
  if (!dateStr) return false;
  if (!timeStr) return compareDay(dateStr, todayString(now)) < 0;
  return isPastDue(`${dateStr}T${timeStr}`, now, graceMinutes);
}

function combineDeadline(dateStr, timeStr) {
  if (!dateStr) return null;
  return `${dateStr}T${timeStr || "00:00"}`;
}

function hasTimeComponent(value) {
  const t = String(value).slice(11, 16);
  return /^\d{2}:\d{2}$/.test(t) && t !== "00:00";
}

function compareDay(dueDateValue, dayString) {
  const due = parseDateOnly(dueDateValue);
  const [y, m, d] = dayString.split("-").map(Number);
  const ref = new Date(y, m - 1, d);
  const diff = due.getTime() - ref.getTime();
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

function dueStatus(task, now) {
  if (!task || task.completed || !task.due_date) return null;
  const today = todayString(now);
  const cmp = compareDay(task.due_date, today);
  if (cmp < 0) return "overdue";
  if (cmp === 0) return "due-today";
  return null;
}

function compareTasks(a, b, now) {
  const pa = PRIORITY_ORDER[a.priority || "Medium"];
  const pb = PRIORITY_ORDER[b.priority || "Medium"];
  if (pa !== pb) return pa - pb;
  const ua = URGENCY_ORDER[dueStatus(a, now) || "none"];
  const ub = URGENCY_ORDER[dueStatus(b, now) || "none"];
  if (ua !== ub) return ua - ub;
  return (a.id || 0) - (b.id || 0);
}

export {
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

const _TrackerCore = {
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

export default _TrackerCore;

// CJS compat for Node tests: require('../src/utils/core.js')
if (typeof module !== 'undefined' && module.exports) {
  module.exports = _TrackerCore;
}
if (typeof globalThis !== 'undefined') {
  globalThis.TrackerCore = _TrackerCore;
}
