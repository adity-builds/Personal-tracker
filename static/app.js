const API_URL = "/tasks/";
const HISTORY_URL = "/history/";
const STATS_URL = "/stats/";

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const dueTimeInput = document.getElementById("task-due-time");
const formError = document.getElementById("task-form-error");
const searchInput = document.getElementById("search-input");
const filterPriority = document.getElementById("filter-priority");
const filterStatus = document.getElementById("filter-status");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const noResults = document.getElementById("no-results");
const todayCount = document.getElementById("today-count");
const historyList = document.getElementById("history-list");
const statStreak = document.getElementById("stat-streak");
const statTotal = document.getElementById("stat-total");
const statsChart = document.getElementById("stats-chart");
const statsBest = document.getElementById("stats-best");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarExpand = document.getElementById("sidebar-expand");
const themeToggle = document.getElementById("theme-toggle");

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

let allTasks = [];

/* ===== Edit modal state ===== */
const editModal = document.getElementById("edit-modal");
const editTitle = document.getElementById("edit-title");
const editDescription = document.getElementById("edit-description");
const editDueDate = document.getElementById("edit-due-date");
const editDueTime = document.getElementById("edit-due-time");
const editPriority = document.getElementById("edit-priority");
const editError = document.getElementById("edit-error");
const editSaveBtn = document.getElementById("edit-save");
const editCancelBtn = document.getElementById("edit-cancel");

let editingTaskId = null;

/* Deadline inputs must not offer datetimes in the past. */
function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove("hidden");
}

function hideFormError() {
  formError.textContent = "";
  formError.classList.add("hidden");
}

function refreshDeadlineMins() {
  if (typeof TrackerCore === "undefined") return;
  // Calendar picker can't offer days before today; the clock stays free-form
  // because combined past-time validation happens on submit (isPastDeadline).
  const today = TrackerCore.todayString(new Date());
  dueDateInput.min = today;
  editDueDate.min = today;
}

function getDeadlineValue(dateInput, timeInput) {
  if (typeof TrackerCore === "undefined") {
    return dateInput.value || null;
  }
  return TrackerCore.combineDeadline(dateInput.value, timeInput.value);
}

/* ===== Theme System - CSS variables + localStorage persistence ===== */
const THEME_KEY = "daily-tracker-theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    /* storage may be unavailable */
  }
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch (e) {}
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
    return;
  }
  // Fallback to prefers-color-scheme
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

initTheme();

// Sync version badge from backend (/version) - keeps UI and exe version in sync
(async () => {
  try {
    const vEl = document.getElementById("app-version");
    if (!vEl) return;
    const r = await fetch("/version");
    if (r.ok) {
      const data = await r.json();
      if (data && data.version) vEl.textContent = `v${data.version}`;
    }
  } catch (e) {}
})();

// Listen for system theme changes only when no explicit choice saved
try {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e) => {
    try {
      if (!localStorage.getItem(THEME_KEY)) applyTheme(e.matches ? "dark" : "light");
    } catch (err) {}
  };
  if (mediaQuery.addEventListener) mediaQuery.addEventListener("change", handler);
  else if (mediaQuery.addListener) mediaQuery.addListener(handler);
} catch (e) {}

/* ===== Sidebar collapse - preserved intact ===== */
function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  sidebarExpand.classList.toggle("hidden", !collapsed);
  try {
    localStorage.setItem("sidebar-collapsed", collapsed ? "1" : "0");
  } catch (error) {
    /* storage may be unavailable */
  }
}

sidebarToggle.addEventListener("click", () => setSidebarCollapsed(true));
sidebarExpand.addEventListener("click", () => setSidebarCollapsed(false));

try {
  if (localStorage.getItem("sidebar-collapsed") === "1") setSidebarCollapsed(true);
} catch (error) {
  /* storage may be unavailable */
}

function todayString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateTimeStr) {
  if (!dateTimeStr) return "";
  const d = new Date(dateTimeStr);
  if (isNaN(d.getTime())) return String(dateTimeStr);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return "";
  const d = new Date(dateTimeStr);
  if (isNaN(d.getTime())) return String(dateTimeStr);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function fetchHistory() {
  try {
    const response = await fetch(HISTORY_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return [];
  }
}

function renderHistory(history) {
  historyList.innerHTML = "";

  const today = todayString();
  // todayCount is sum of counts for today (now accurate with append-only)
  const todayEntry = history.find((h) => h.date === today);
  todayCount.textContent = todayEntry ? todayEntry.count : 0;

  if (history.length === 0) {
    const li = document.createElement("li");
    li.className = "history-empty";
    li.textContent = "No completed tasks yet.";
    historyList.appendChild(li);
    return;
  }

  history.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "history-item" + (entry.date === today ? " today" : "");

    const header = document.createElement("div");
    header.className = "history-header";

    const dateSpan = document.createElement("span");
    dateSpan.className = "history-date";
    dateSpan.textContent = formatDate(entry.date);

    const countSpan = document.createElement("span");
    countSpan.className = "history-count";
    countSpan.textContent = `${entry.count} done`;

    header.appendChild(dateSpan);
    header.appendChild(countSpan);
    li.appendChild(header);

    if (entry.tasks && entry.tasks.length > 0) {
      const tasksUl = document.createElement("ul");
      tasksUl.className = "history-tasks";
      entry.tasks.forEach((task) => {
        const taskLi = document.createElement("li");
        taskLi.className = "history-task-row";

        // Backward compat: tasks may be string (legacy) or object with timestamps
        if (typeof task === "string") {
          taskLi.textContent = task;
        } else {
          const titleSpan = document.createElement("span");
          titleSpan.className = "history-task-title";
          titleSpan.textContent = task.title || "Untitled";

          const metaSpan = document.createElement("span");
          metaSpan.className = "history-task-meta";

          // Build timestamp line: Created -> Completed with time
          const created = task.created_at ? formatDateTime(task.created_at) : "";
          const completedFull = task.completed_at ? formatDateTime(task.completed_at) : "";
          let metaText = "";
          if (created && completedFull) {
            // show both: Created: ... • Completed: time (today) or full datetime
            const sameDay = task.created_at && task.completed_at && String(task.created_at).slice(0,10) === String(task.completed_at).slice(0,10);
            if (sameDay) {
              metaText = `Created ${formatTime(task.created_at)} → Completed ${formatTime(task.completed_at)}`;
            } else {
              metaText = `Created ${formatDateTime(task.created_at)} → Completed ${completedFull}`;
            }
            // append priority if available
            if (task.priority) metaText += ` • ${task.priority}`;
          } else if (completedFull) {
            metaText = `Completed ${completedFull}`;
            if (task.priority) metaText += ` • ${task.priority}`;
          } else {
            metaText = task.priority || "";
          }
          metaSpan.textContent = metaText;
          // tooltip with full ISO
          const tip = `Created: ${task.created_at || "—"}\nCompleted: ${task.completed_at || "—"}`;
          taskLi.title = tip;

          taskLi.appendChild(titleSpan);
          if (metaText) {
            const br = document.createElement("div");
            br.style.height = "2px";
            taskLi.appendChild(br);
            taskLi.appendChild(metaSpan);
          }
        }
        tasksUl.appendChild(taskLi);
      });
      li.appendChild(tasksUl);
    }

    historyList.appendChild(li);
  });
}

async function loadHistory() {
  const history = await fetchHistory();
  renderHistory(history);
}

/* ===== Insights (Phase 3) ===== */
const SVG_NS = "http://www.w3.org/2000/svg";
const CHART_W = 224;
const CHART_H = 92;
const CHART_TOP = 14;      // headroom for count labels
const CHART_BASELINE = 74; // bars grow down to this y
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function svgEl(tag, attrs, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  if (text !== undefined) el.textContent = text;
  return el;
}

function renderStatsChart(last7Days) {
  statsChart.innerHTML = "";

  // Baseline so zero-days still read as part of the chart
  statsChart.appendChild(svgEl("line", {
    x1: 4, x2: CHART_W - 4, y1: CHART_BASELINE, y2: CHART_BASELINE,
    class: "chart-baseline",
  }));

  const maxCount = Math.max(...last7Days.map((d) => d.count), 1);
  const slot = CHART_W / last7Days.length;
  const barW = 18;
  const today = todayString();

  last7Days.forEach((day, i) => {
    const slotX = i * slot + (slot - barW) / 2;
    const barH = day.count > 0 ? Math.max(6, Math.round((day.count / maxCount) * (CHART_BASELINE - CHART_TOP))) : 0;
    const isToday = day.date === today;

    if (day.count > 0) {
      const rect = svgEl("rect", {
        x: slotX,
        y: CHART_BASELINE - barH,
        width: barW,
        height: barH,
        rx: 4,
        class: "chart-bar" + (isToday ? " chart-bar-today" : ""),
      });
      const tip = `${formatDate(day.date)} — ${day.count} completed`;
      rect.setAttribute("tabindex", "0");
      const title = svgEl("title", {}, tip);
      rect.appendChild(title);
      statsChart.appendChild(rect);

      statsChart.appendChild(svgEl("text", {
        x: slotX + barW / 2,
        y: CHART_BASELINE - barH - 4,
        "text-anchor": "middle",
        class: "chart-count",
      }, String(day.count)));
    }

    const weekdayLetter = typeof TrackerCore !== "undefined"
      ? WEEKDAYS[TrackerCore.parseDateOnly(day.date).getDay()]
      : "";
    const labelAttrs = {
      x: slotX + barW / 2,
      y: CHART_H - 4,
      "text-anchor": "middle",
      class: "chart-day" + (isToday ? " chart-day-today" : ""),
    };
    statsChart.appendChild(svgEl("text", labelAttrs, weekdayLetter));
  });
}

async function fetchStats() {
  try {
    const response = await fetch(STATS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return null;
  }
}

async function loadStats() {
  if (!statStreak || !statsChart) return;
  const stats = await fetchStats();
  if (!stats) return;

  statStreak.textContent = String(stats.current_streak);
  statTotal.textContent = String(stats.total_completions);

  renderStatsChart(stats.last_7_days || []);

  if (stats.best_day && stats.best_day_count > 0) {
    statsBest.textContent = `Best day: ${formatDate(stats.best_day)} (${stats.best_day_count})`;
    statsBest.classList.remove("hidden");
  } else {
    statsBest.textContent = "";
    statsBest.classList.add("hidden");
  }
}

async function fetchTasks() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch tasks:", error);
    return [];
  }
}

/* Turns non-2xx responses into Errors carrying a readable server message. */
async function apiError(response, fallback) {
  let detail = fallback;
  try {
    const data = await response.json();
    if (typeof data.detail === "string") detail = data.detail;
    else if (Array.isArray(data.detail)) {
      detail = data.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
    }
  } catch (e) {
    /* keep fallback */
  }
  return new Error(detail || `HTTP ${response.status}`);
}

async function createTask(title, description, priority, dueDate) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, priority, due_date: dueDate }),
  });
  if (!response.ok) throw await apiError(response, "Could not add task.");
  return response.json();
}

async function updateTaskStatus(taskId, completed) {
  const response = await fetch(`${API_URL}${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/* Full edit: only sends editable fields; completion state is preserved as-is
   (completed tasks cannot be unchecked - server enforces with 409). */
async function updateTask(taskId, payload) {
  const response = await fetch(`${API_URL}${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await apiError(response, "Could not save changes.");
  return response.json();
}

async function deleteTask(taskId) {
  const response = await fetch(`${API_URL}${taskId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

function renderTasks(tasks) {
  taskList.innerHTML = "";

  const hasAnyTasks = allTasks.length > 0;
  emptyState.classList.toggle("hidden", hasAnyTasks);
  noResults.classList.toggle("hidden", !(hasAnyTasks && tasks.length === 0));

  if (tasks.length === 0) return;

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item" + (task.completed ? " completed" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    if (task.completed) {
      // Completed tasks are permanent - prevent unchecking (server rejects with 409 too)
      checkbox.disabled = true;
      checkbox.title = "Completed tasks can't be unchecked";
    }
    checkbox.setAttribute("aria-label", task.completed ? "Completed (cannot be unchecked)" : "Mark as completed");
    checkbox.addEventListener("change", async () => {
      try {
        await updateTaskStatus(task.id, checkbox.checked);
        li.classList.toggle("completed", checkbox.checked);
        // Update status badge live
        const statusBadge = li.querySelector(".status-badge");
        if (statusBadge) {
          statusBadge.textContent = checkbox.checked ? "Completed" : "Pending";
          statusBadge.className = "status-badge " + (checkbox.checked ? "status-completed" : "status-pending");
        }
        checkbox.setAttribute("aria-label", checkbox.checked ? "Completed (cannot be unchecked)" : "Mark as completed");
        checkbox.title = checkbox.checked ? "Completed tasks can't be unchecked" : "";
        checkbox.disabled = checkbox.checked;
        await loadHistory();
        await loadStats();
      } catch (error) {
        console.error("Failed to update task:", error);
        checkbox.checked = !checkbox.checked;
        alert("Could not update task status.");
      }
    });

    const content = document.createElement("div");
    content.className = "task-content";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const badge = document.createElement("span");
    badge.className = "priority-badge priority-" + (task.priority || "Medium").toLowerCase();
    badge.textContent = task.priority || "Medium";
    meta.appendChild(badge);

    const statusBadge = document.createElement("span");
    statusBadge.className = "status-badge " + (task.completed ? "status-completed" : "status-pending");
    statusBadge.textContent = task.completed ? "Completed" : "Pending";
    meta.appendChild(statusBadge);

    // Due date badge + label (urgency logic lives in TrackerCore)
    if (task.due_date) {
      const urgency = typeof TrackerCore !== "undefined" ? TrackerCore.dueStatus(task) : null;
      const dueDay = String(task.due_date).slice(0, 10);
      const dueText = new Date(
        Number(dueDay.slice(0, 4)),
        Number(dueDay.slice(5, 7)) - 1,
        Number(dueDay.slice(8, 10))
      ).toLocaleDateString(undefined, { month: "short", day: "numeric" });

      let labelText = "Due " + dueText;
      if (typeof TrackerCore !== "undefined" && TrackerCore.hasTimeComponent(task.due_date)) {
        labelText += ", " + formatTime(task.due_date);
      }

      const dueLabel = document.createElement("span");
      dueLabel.className = "task-due-text";
      dueLabel.textContent = labelText;

      if (urgency) {
        const dueBadge = document.createElement("span");
        dueBadge.className =
          "due-badge " + (urgency === "overdue" ? "badge-overdue" : "badge-due-today");
        dueBadge.textContent = urgency === "overdue" ? "Overdue" : "Due today";
        meta.appendChild(dueBadge);
      }
      meta.appendChild(dueLabel);
    }

    if (task.description) {
      const description = document.createElement("span");
      description.className = "task-description";
      description.textContent = task.description;
      meta.appendChild(description);
    }

    content.appendChild(title);
    content.appendChild(meta);

    const editBtn = document.createElement("button");
    editBtn.className = "edit-btn";
    editBtn.textContent = "\u270E";
    editBtn.title = "Edit task";
    editBtn.setAttribute("aria-label", "Edit task: " + task.title);
    editBtn.addEventListener("click", () => openEditModal(task));

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "\u2715";
    deleteBtn.title = "Delete task";
    deleteBtn.setAttribute("aria-label", "Delete task: " + task.title);
    deleteBtn.addEventListener("click", async () => {
      try {
        await deleteTask(task.id);
        await loadTasks();
        await loadHistory();
      } catch (error) {
        console.error("Failed to delete task:", error);
        alert("Could not delete task.");
      }
    });

    li.appendChild(checkbox);
    li.appendChild(content);
    li.appendChild(editBtn);
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const priority = priorityInput.value;
  const dueDate = getDeadlineValue(dueDateInput, dueTimeInput);

  if (!title) return;

  // Belt-and-braces guard: the date picker's min already blocks past days
  if (dueDate && typeof TrackerCore !== "undefined" && TrackerCore.isPastDeadline(dueDateInput.value, dueTimeInput.value, new Date(), 1)) {
    showFormError("The deadline can't be in the past.");
    return;
  }

  try {
    await createTask(title, description || null, priority, dueDate);
    titleInput.value = "";
    descriptionInput.value = "";
    priorityInput.value = "Medium";
    dueDateInput.value = "";
    dueTimeInput.value = "";
    hideFormError();
    refreshDeadlineMins();
    await loadTasks();
  } catch (error) {
    console.error("Failed to create task:", error);
    showFormError(error.message || "Could not add task.");
  }
});

/* ===== Edit modal ===== */
function openEditModal(task) {
  editingTaskId = task.id;
  editTitle.value = task.title || "";
  editDescription.value = task.description || "";
  // Split stored deadline ("...T14:30:00") into the calendar + clock fields.
  // Existing (possibly overdue) deadlines load as-is - only NEW past entries are blocked.
  editDueDate.value = task.due_date ? String(task.due_date).slice(0, 10) : "";
  editDueTime.value =
    typeof TrackerCore !== "undefined" && TrackerCore.hasTimeComponent(task.due_date)
      ? String(task.due_date).slice(11, 16)
      : "";
  editPriority.value = task.priority || "Medium";
  hideEditError();
  refreshDeadlineMins();
  editModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  editTitle.focus();
}

function closeEditModal() {
  editingTaskId = null;
  editModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function showEditError(message) {
  editError.textContent = message;
  editError.classList.remove("hidden");
}

function hideEditError() {
  editError.textContent = "";
  editError.classList.add("hidden");
}

editSaveBtn.addEventListener("click", async () => {
  const taskId = editingTaskId;
  if (taskId === null) return;

  const title = editTitle.value.trim();
  if (!title) {
    showEditError("Title cannot be empty.");
    return;
  }

  const original = allTasks.find((t) => t.id === taskId);
  if (!original) {
    closeEditModal();
    await loadTasks();
    return;
  }

  const dueValue = getDeadlineValue(editDueDate, editDueTime);
  // Allow keeping the task's existing (possibly overdue) deadline untouched;
  // block picking a NEW date/time that is already in the past.
  const keptExisting = dueValue !== null &&
    typeof TrackerCore !== "undefined" && TrackerCore.sameMinute(dueValue, original.due_date);
  if (
    dueValue && !keptExisting &&
    typeof TrackerCore !== "undefined" &&
    TrackerCore.isPastDeadline(editDueDate.value, editDueTime.value, new Date(), 1)
  ) {
    showEditError("The deadline can't be in the past.");
    return;
  }

  const payload = {
    completed: original.completed,
    title,
    description: editDescription.value.trim() || null,
    priority: editPriority.value,
    due_date: dueValue,
  };

  editSaveBtn.disabled = true;
  try {
    await updateTask(taskId, payload);
    closeEditModal();
    await loadTasks();
  } catch (error) {
    console.error("Failed to update task:", error);
    showEditError(error.message || "Could not save changes.");
  } finally {
    editSaveBtn.disabled = false;
  }
});

editCancelBtn.addEventListener("click", closeEditModal);

editModal.addEventListener("click", (event) => {
  if (event.target === editModal) closeEditModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !editModal.classList.contains("hidden")) {
    closeEditModal();
  }
});

function getFilteredTasks() {
  const query = searchInput.value.trim().toLowerCase();
  const priority = filterPriority.value;
  const status = filterStatus.value;

  return allTasks
    .filter((task) => {
      if (priority !== "all" && (task.priority || "Medium") !== priority) return false;
      if (status === "pending" && task.completed) return false;
      if (status === "completed" && !task.completed) return false;
      if (query) {
        const haystack = `${task.title} ${task.description || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort(
      typeof TrackerCore !== "undefined" && TrackerCore
        ? (a, b) => TrackerCore.compareTasks(a, b)
        : (a, b) => {
            // Fallback if core.js failed to load: old priority/id order
            const orderDiff = PRIORITY_ORDER[a.priority || "Medium"] - PRIORITY_ORDER[b.priority || "Medium"];
            if (orderDiff !== 0) return orderDiff;
            return a.id - b.id;
          }
    );
}

async function loadTasks() {
  const tasks = await fetchTasks();
  allTasks = tasks;
  renderTasks(getFilteredTasks());
}

searchInput.addEventListener("input", () => renderTasks(getFilteredTasks()));
filterPriority.addEventListener("change", () => renderTasks(getFilteredTasks()));
filterStatus.addEventListener("change", () => renderTasks(getFilteredTasks()));

loadTasks();
loadHistory();
loadStats();
refreshDeadlineMins();

function getWindowApi() {
  return window.pywebview && window.pywebview.api;
}

const winMin = document.getElementById("btn-min");
const winMax = document.getElementById("btn-max");
const winClose = document.getElementById("btn-close");

if (winMin) {
  winMin.addEventListener("click", () => {
    const api = getWindowApi();
    if (api && api.minimize) api.minimize();
  });
}

if (winMax) {
  winMax.addEventListener("click", async () => {
    const api = getWindowApi();
    if (!api || !api.toggle_maximize) return;
    const maximized = await api.toggle_maximize();
    winMax.innerHTML = maximized ? "\u2750" : "\u25A1";
  });
}

if (winClose) {
  winClose.addEventListener("click", () => {
    const api = getWindowApi();
    if (api && api.close) api.close();
  });
}
