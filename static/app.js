const API_URL = "/tasks/";
const HISTORY_URL = "/history/";

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const priorityInput = document.getElementById("task-priority");
const searchInput = document.getElementById("search-input");
const filterPriority = document.getElementById("filter-priority");
const filterStatus = document.getElementById("filter-status");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const noResults = document.getElementById("no-results");
const todayCount = document.getElementById("today-count");
const historyList = document.getElementById("history-list");
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarExpand = document.getElementById("sidebar-expand");
const themeToggle = document.getElementById("theme-toggle");

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

let allTasks = [];

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

async function createTask(title, description, priority) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, priority }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
    checkbox.setAttribute("aria-label", task.completed ? "Mark as pending" : "Mark as completed");
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
        checkbox.setAttribute("aria-label", checkbox.checked ? "Mark as pending" : "Mark as completed");
        await loadHistory();
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

    if (task.description) {
      const description = document.createElement("span");
      description.className = "task-description";
      description.textContent = task.description;
      meta.appendChild(description);
    }

    content.appendChild(title);
    content.appendChild(meta);

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
    li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const priority = priorityInput.value;

  if (!title) return;

  try {
    await createTask(title, description || null, priority);
    titleInput.value = "";
    descriptionInput.value = "";
    priorityInput.value = "Medium";
    await loadTasks();
  } catch (error) {
    console.error("Failed to create task:", error);
    alert("Could not add task.");
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
    .sort((a, b) => {
      const orderDiff = PRIORITY_ORDER[a.priority || "Medium"] - PRIORITY_ORDER[b.priority || "Medium"];
      if (orderDiff !== 0) return orderDiff;
      return a.id - b.id;
    });
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
