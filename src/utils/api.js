// Cached API base — computed once
const API_BASE = (() => {
  const env = import.meta.env.VITE_API_URL
  if (env) return env.replace(/\/$/, '')
  try {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      return 'http://127.0.0.1:8000'
    }
  } catch {}
  return ''
})()

async function apiError(response, fallback) {
  let detail = fallback
  try {
    const data = await response.json()
    if (typeof data.detail === 'string') detail = data.detail
    else if (Array.isArray(data.detail)) {
      detail = data.detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
    }
  } catch {}
  return new Error(detail || `HTTP ${response.status}`)
}

function fetchWithTimeout(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t))
}

export async function fetchTasks() {
  const r = await fetchWithTimeout(`${API_BASE}/tasks/`)
  if (!r.ok) throw await apiError(r, 'Failed to fetch tasks')
  return r.json()
}

export async function createTask({ title, description, priority, due_date }) {
  const r = await fetchWithTimeout(`${API_BASE}/tasks/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description, priority, due_date }),
  })
  if (!r.ok) throw await apiError(r, 'Could not add task.')
  return r.json()
}

export async function updateTask(taskId, payload) {
  const r = await fetchWithTimeout(`${API_BASE}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw await apiError(r, 'Could not save changes.')
  return r.json()
}

export async function deleteTask(taskId) {
  const r = await fetchWithTimeout(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function fetchHistory() {
  const r = await fetchWithTimeout(`${API_BASE}/history/`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function fetchStats() {
  const r = await fetchWithTimeout(`${API_BASE}/stats/`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function fetchVersion() {
  try {
    const r = await fetchWithTimeout(`${API_BASE}/version`, {}, 3000)
    if (!r.ok) return null
    return r.json()
  } catch {
    return null
  }
}

export { API_BASE }
