import { useState, useMemo } from 'react'
import { Plus, Calendar, Clock, Flag, Sparkles, AlertCircle } from 'lucide-react'
import * as Core from '../utils/core.js'

export default function TaskForm({ onCreate, apiError }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const today = useMemo(() => Core.todayString(new Date()), [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    const dueDate = Core.combineDeadline(date, time)
    if (dueDate && Core.isPastDeadline(date, time, new Date(), 1)) {
      setError("Deadline can't be in the past.")
      return
    }
    setLoading(true)
    setError('')
    try {
      await onCreate({ title: title.trim(), description: description.trim() || null, priority, due_date: dueDate })
      setTitle(''); setDescription(''); setPriority('Medium'); setDate(''); setTime('')
    } catch (err) {
      const msg = err.message || 'Could not add task'
      if (msg.includes('Failed to fetch') || msg.toLowerCase().includes('fetch')) {
        setError('Backend offline — run `uvicorn main:app --reload` on :8000 and refresh.')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-strong rounded-2xl p-5 animate-[fadeIn_0.2s_ease-out]"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-base tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg gradient-primary grid place-items-center shadow">
              <Plus className="w-4 h-4 text-white" />
            </span>
            Add a new task
          </h3>
          <p className="text-sm text-muted-foreground mt-1">What do you want to get done today?</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/15">
          <Sparkles className="w-3.5 h-3.5" /> Quick add
        </span>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task title — e.g., Ship the glass UI"
            maxLength={200}
            required
            className="w-full h-12 px-4 pr-12 rounded-xl bg-card border border-border focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition text-sm font-medium placeholder:text-muted-foreground/60"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-full">{title.length}/200</span>
        </div>

        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full h-11 px-4 rounded-xl bg-card border border-border focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition text-sm placeholder:text-muted-foreground/60"
        />

        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_140px] gap-3">
          <label className="relative flex items-center gap-2 bg-card border border-border dark:border-white/20 dark:bg-slate-800 rounded-xl px-3 h-11 focus-within:border-violet-500 dark:focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:focus-within:ring-violet-400/20 transition group/date">
            <Calendar className="w-4 h-4 shrink-0 text-slate-700 dark:text-white group-focus-within/date:text-violet-600 dark:group-focus-within/date:text-white transition-colors" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min={today}
              className="w-full bg-transparent outline-none text-sm text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/60" />
          </label>

          <label className="relative flex items-center gap-2 bg-card border border-border dark:border-white/20 dark:bg-slate-800 rounded-xl px-3 h-11 focus-within:border-violet-500 dark:focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:focus-within:ring-violet-400/20 transition group/time">
            <Clock className="w-4 h-4 shrink-0 text-slate-700 dark:text-white group-focus-within/time:text-violet-600 dark:group-focus-within/time:text-white transition-colors" />
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full bg-transparent outline-none text-sm text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-white/60" />
          </label>

          <label className="relative flex items-center gap-2 bg-card border border-border dark:border-white/20 dark:bg-slate-800 rounded-xl px-3 h-11 focus-within:border-violet-500 dark:focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:focus-within:ring-violet-400/20 transition group/prio">
            <Flag className="w-4 h-4 shrink-0 text-slate-700 dark:text-white group-focus-within/prio:text-violet-600 dark:group-focus-within/prio:text-white transition-colors" />
            <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-transparent outline-none text-sm font-semibold cursor-pointer text-foreground dark:text-white">
              <option className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">High</option><option className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Medium</option><option className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Low</option>
            </select>
          </label>
        </div>

        {apiError && !error && (
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {apiError}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/15 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <button disabled={loading || !title.trim()} className="w-full h-11 rounded-xl gradient-primary text-white font-bold text-sm shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:translate-y-[-1px] active:translate-y-[0px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
          {loading ? 'Adding…' : <><Plus className="w-4 h-4" /> Add Task</>}
        </button>
      </div>
    </form>
  )
}
