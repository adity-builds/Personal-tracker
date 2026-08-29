import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { Moon, Sun, LayoutDashboard, ClipboardList, SearchX, Sparkles } from 'lucide-react'
import TitleBar from './components/TitleBar.jsx'
import Sidebar from './components/Sidebar.jsx'
import TaskForm from './components/TaskForm.jsx'
import Toolbar from './components/Toolbar.jsx'
import TaskCard from './components/TaskCard.jsx'
import * as api from './utils/api.js'
import * as Core from './utils/core.js'

const EditModal = lazy(() => import('./components/EditModal.jsx'))

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('daily-tracker-theme')
      if (saved === 'dark' || saved === 'light') return saved
    } catch {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem('daily-tracker-theme', theme) } catch {}
  }, [theme])
  return [theme, () => setTheme(t => t === 'dark' ? 'light' : 'dark')]
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [version, setVersion] = useState(null)
  const [tasks, setTasks] = useState([])
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [query, setQuery] = useState('')
  const [priority, setPriority] = useState('all')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState(null)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const results = await Promise.allSettled([api.fetchTasks(), api.fetchHistory(), api.fetchStats()])
      const [tRes, hRes, sRes] = results
      if (tRes.status === 'fulfilled') setTasks(tRes.value)
      else console.error('fetchTasks failed', tRes.reason)
      if (hRes.status === 'fulfilled') setHistory(hRes.value)
      else console.error('fetchHistory failed', hRes.reason)
      if (sRes.status === 'fulfilled') setStats(sRes.value)
      else console.error('fetchStats failed', sRes.reason)

      const anyFailed = results.some(r => r.status === 'rejected')
      if (anyFailed) {
        const msg = results.find(r => r.status==='rejected')?.reason?.message || 'Failed to fetch'
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('aborted')) {
          setApiError('Backend offline — run `uvicorn main:app --reload` on :8000 (or `npm run electron:dev`) and refresh.')
        } else {
          setApiError(msg)
        }
      } else {
        setApiError(null)
      }
    } catch (e) {
      console.error('loadAll error', e)
      setApiError(e.message || 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    api.fetchVersion().then(v => v && setVersion(v.version))
  }, [loadAll])

  // Keyboard shortcuts — isolated effect, no re-subscribe on editing change
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.querySelector('input[placeholder="Search tasks…"]')?.focus()
      }
      if (e.key === 'Escape' && editing) setEditing(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks
      .filter(t => {
        if (priority !== 'all' && (t.priority || 'Medium') !== priority) return false
        if (status === 'pending' && t.completed) return false
        if (status === 'completed' && !t.completed) return false
        if (q) {
          const hay = `${t.title} ${t.description || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a,b) => Core.compareTasks(a,b))
  }, [tasks, query, priority, status])

  const todayCount = useMemo(() => {
    if (!history.length) return 0
    const today = Core.todayString(new Date())
    for (let i = 0; i < history.length; i++) {
      if (history[i].date === today) return history[i].count
    }
    return 0
  }, [history])

  const handleCreate = useCallback(async (payload) => {
    await api.createTask(payload)
    await loadAll()
  }, [loadAll])

  const handleToggle = useCallback(async (task) => {
    await api.updateTask(task.id, { completed: true })
    await loadAll()
  }, [loadAll])

  const handleDelete = useCallback(async (task) => {
    if (!confirm(`Delete "${task.title}"?`)) return
    await api.deleteTask(task.id)
    await loadAll()
  }, [loadAll])

  const handleEditSave = useCallback(async (id, payload) => {
    await api.updateTask(id, payload)
    await loadAll()
  }, [loadAll])

  const handleEditClose = useCallback(() => setEditing(null), [])

  return (
    <div className="min-h-screen gradient-mesh">
      <TitleBar version={version} />

      {/* Backend offline banner */}
      {apiError && (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">⚠️ {apiError}</span>
            <button onClick={loadAll} className="ml-auto h-8 px-3 rounded-lg bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition">Retry</button>
            <span className="text-xs opacity-80">API: {api.API_BASE || '(relative)'} → http://127.0.0.1:8000</span>
          </div>
        </div>
      )}

      {/* Top bar actions */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-sm font-semibold">
            <span className="w-8 h-8 rounded-xl gradient-primary grid place-items-center text-white shadow"><LayoutDashboard className="w-4 h-4" /></span>
            <span className="font-display font-bold tracking-tight">Daily Task Tracker</span>
            <span className="text-muted-foreground font-normal hidden lg:inline">— Stay on top of your day, one task at a time.</span>
          </div>
          <button onClick={() => setMobileSidebar(v => !v)} className="md:hidden glass rounded-xl px-3 py-2 text-sm font-semibold">
            {mobileSidebar ? 'Hide insights' : 'Show insights'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="glass rounded-full h-9 px-4 inline-flex items-center gap-2 text-sm font-semibold hover:shadow-md transition">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Sidebar */}
        <div className={`${mobileSidebar ? 'block' : 'hidden'} lg:block`}>
          <Sidebar stats={stats} history={history} todayCount={todayCount} loading={loading} error={apiError} onRetry={loadAll} />
        </div>

        {/* Main */}
        <div className="min-w-0 space-y-4">
          <TaskForm onCreate={handleCreate} apiError={apiError} />

          <Toolbar query={query} setQuery={setQuery} priority={priority} setPriority={setPriority} status={status} setStatus={setStatus} count={filtered.length} />

          <div className="glass rounded-2xl p-3 sm:p-4">
            {loading && tasks.length===0 ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading tasks…</p>
              </div>
            ) : apiError && tasks.length===0 ? (
              <div className="py-16 text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 grid place-items-center mb-4">
                  <SearchX className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="font-bold">Backend offline</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">{apiError}</p>
                <button onClick={loadAll} className="mt-4 h-9 px-4 rounded-xl bg-violet-500 text-white font-bold text-sm hover:bg-violet-600">Retry</button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl gradient-primary-soft border flex items-center justify-center mb-4">
                  <ClipboardList className="w-8 h-8 text-violet-600 dark:text-violet-300" />
                </div>
                <h3 className="font-display font-bold text-lg">No tasks yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">Add your first task above and start tracking your day. Your progress will appear in Insights.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-muted border grid place-items-center mb-4">
                  <SearchX className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold">No matching tasks</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {filtered.map(task => (
                  <TaskCard key={task.id} task={task} onToggle={handleToggle} onEdit={setEditing} onDelete={handleDelete} />
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5" /> Glassmorphic UI — React + Electron • {tasks.filter(t=>!t.completed).length} pending • {tasks.filter(t=>t.completed).length} completed • API {api.API_BASE || 'relative'}
          </div>
        </div>
      </div>

      {editing && (
        <Suspense fallback={null}>
          <EditModal task={editing} open={!!editing} onClose={handleEditClose} onSave={handleEditSave} />
        </Suspense>
      )}
    </div>
  )
}
