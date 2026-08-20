const API_URL = "http://127.0.0.1:8000/tasks/";
const HISTORY_URL = "http://127.0.0.1:8000/history/";

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

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

let allTasks = [];

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
      entry.tasks.forEach((taskTitle) => {
        const taskLi = document.createElement("li");
        taskLi.textContent = taskTitle;
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
  noResults.classList.toggle("hidden", hasAnyTasks || tasks.length > 0);

  if (tasks.length === 0) return;

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task-item" + (task.completed ? " completed" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", async () => {
      try {
        await updateTaskStatus(task.id, checkbox.checked);
        li.classList.toggle("completed", checkbox.checked);
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
