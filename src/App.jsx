import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react'
import { Moon, Sun, ClipboardList, SearchX } from 'lucide-react'
import TitleBar from './components/TitleBar.jsx'
import { TodayCard, InsightsPanel, HistoryPanel } from './components/Sidebar.jsx'
import TaskForm from './components/TaskForm.jsx'
import Toolbar from './components/Toolbar.jsx'
import TaskCard from './components/TaskCard.jsx'
import * as api from './utils/api.js'
import * as Core from './utils/core.js'
import { useNow } from './hooks/useNow.js'
import { motion, AnimatePresence } from 'framer-motion'
import LiveClock from './components/LiveClock.jsx'

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

function useClockFormat() {
  const [is24Hour, setIs24Hour] = useState(() => {
    try {
      return localStorage.getItem('tracker-clock-24h') === 'true'
    } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('tracker-clock-24h', String(is24Hour)) } catch {}
  }, [is24Hour])
  return [is24Hour, setIs24Hour]
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [is24Hour, setIs24Hour] = useClockFormat()
  const now = useNow(60000)
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
      .sort((a,b) => Core.compareTasks(a,b, now))
  }, [tasks, query, priority, status, now])

  const todayCount = useMemo(() => {
    if (!history.length) return 0
    const today = Core.todayString(now)
    for (let i = 0; i < history.length; i++) {
      if (history[i].date === today) return history[i].count
    }
    return 0
  }, [history, now])

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
        <div className="max-w-[1420px] mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">⚠️ {apiError}</span>
            <button onClick={loadAll} className="ml-auto h-8 px-3 rounded-lg bg-red-500 text-white font-bold text-xs hover:bg-red-600 transition">Retry</button>
            <span className="text-xs opacity-80">API: {api.API_BASE || '(relative)'} → http://127.0.0.1:8000</span>
          </div>
        </div>
      )}

      {/* Header — minimal, electron-native */}
      <div className="max-w-[1420px] mx-auto px-4 sm:px-6 pt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="font-display font-semibold text-[22px] tracking-tight leading-none">Today</h1>
            <span className="hidden sm:inline-flex h-5 w-px bg-border" />
            <p className="hidden sm:block text-sm text-muted-foreground tabular-nums truncate">
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <button onClick={() => setMobileSidebar(v => !v)} className="lg:hidden h-8 px-3 rounded-full bg-muted text-xs font-medium border">
              {mobileSidebar ? 'Hide panels' : 'Panels'}
            </button>
          </div>
          <p className="sm:hidden text-xs text-muted-foreground mt-1 tabular-nums">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <LiveClock is24Hour={is24Hour} />
          <div className="lg:hidden">
            <LiveClock compact is24Hour={is24Hour} />
          </div>
          <div className="hidden lg:flex items-center bg-card border rounded-full h-8 px-1.5 shadow-sm">
            <select
              value={is24Hour ? '24' : '12'}
              onChange={e => setIs24Hour(e.target.value === '24')}
              className="bg-transparent text-xs font-medium px-2 py-1 outline-none cursor-pointer"
              aria-label="Clock format"
            >
              <option value="12">12h</option>
              <option value="24">24h</option>
            </select>
          </div>
          <div className="lg:hidden">
            <select
              value={is24Hour ? '24' : '12'}
              onChange={e => setIs24Hour(e.target.value === '24')}
              className="bg-card border rounded-full h-8 px-2 text-xs font-medium shadow-sm outline-none cursor-pointer"
              aria-label="Clock format"
            >
              <option value="12">12h</option>
              <option value="24">24h</option>
            </select>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} whileHover={{ scale: 1.02 }} onClick={toggleTheme} className="bg-card border rounded-full h-8 w-8 grid place-items-center hover:bg-muted transition shadow-sm" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </motion.button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="max-w-[1420px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_340px] gap-6 items-start">
        {/* Left — Today + Insights (sticky, no scroll needed) */}
        <div className={`${mobileSidebar ? 'block' : 'hidden'} lg:block space-y-4 lg:sticky lg:top-[72px]`}>
          <TodayCard count={todayCount} now={now} />
          <InsightsPanel stats={stats} loading={loading} error={apiError} onRetry={loadAll} now={now} />
        </div>

        {/* Middle — Add Task + Filters + List */}
        <div className="min-w-0 space-y-3">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <TaskForm onCreate={handleCreate} apiError={apiError} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Toolbar query={query} setQuery={setQuery} priority={priority} setPriority={setPriority} status={status} setStatus={setStatus} count={filtered.length} />
          </motion.div>

          <div className="rounded-xl bg-card border p-3 shadow-sm">
            {loading && tasks.length===0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center">
                <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </motion.div>
            ) : apiError && tasks.length===0 ? (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="py-10 text-center">
                <div className="w-12 h-12 mx-auto rounded-lg bg-muted border grid place-items-center mb-3">
                  <SearchX className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-sm">Offline</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">{apiError}</p>
                <button onClick={loadAll} className="mt-3 h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90">Retry</button>
              </motion.div>
            ) : tasks.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-lg bg-muted border grid place-items-center mb-3">
                  <ClipboardList className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-medium">No tasks yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">Create your first task above.</p>
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center">
                <div className="w-10 h-10 mx-auto rounded-lg bg-muted border grid place-items-center mb-3">
                  <SearchX className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-sm">No matches</h3>
                <p className="text-xs text-muted-foreground">Adjust search or filters.</p>
              </motion.div>
            ) : (
              <motion.ul layout className="space-y-2">
                <AnimatePresence initial={false}>
                  {filtered.map(task => (
                    <motion.li key={task.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>
                      <TaskCard task={task} now={now} onToggle={handleToggle} onEdit={setEditing} onDelete={handleDelete} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
            <span className="w-1 h-1 rounded-full bg-emerald-500" /> {tasks.filter(t=>!t.completed).length} pending • {tasks.filter(t=>t.completed).length} done
          </div>
        </div>

        {/* Right — History (shifted from left sidebar to right of Add Tasks) */}
        <div className={`${mobileSidebar ? 'block' : 'hidden'} lg:block lg:sticky lg:top-[72px]`}>
          <HistoryPanel history={history} now={now} />
        </div>
      </motion.div>

      {editing && (
        <Suspense fallback={null}>
          <EditModal task={editing} open={!!editing} onClose={handleEditClose} onSave={handleEditSave} />
        </Suspense>
      )}
    </div>
  )
}
