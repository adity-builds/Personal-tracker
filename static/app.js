const API_URL = "http://127.0.0.1:8000/tasks/";

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descriptionInput = document.getElementById("task-description");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");

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

async function createTask(title, description) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
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

  if (tasks.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

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

    content.appendChild(title);

    if (task.description) {
      const description = document.createElement("div");
      description.className = "task-description";
      description.textContent = task.description;
      content.appendChild(description);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "\u2715";
    deleteBtn.title = "Delete task";
    deleteBtn.addEventListener("click", async () => {
      try {
        await deleteTask(task.id);
        li.remove();
        if (taskList.children.length === 0) {
          emptyState.classList.remove("hidden");
        }
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

  if (!title) return;

  try {
    await createTask(title, description || null);
    titleInput.value = "";
    descriptionInput.value = "";
    await loadTasks();
  } catch (error) {
    console.error("Failed to create task:", error);
    alert("Could not add task.");
  }
});

async function loadTasks() {
  const tasks = await fetchTasks();
  renderTasks(tasks);
}

loadTasks();
