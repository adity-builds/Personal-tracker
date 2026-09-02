import { useState, useMemo } from 'react'
import { Plus, Calendar, Clock, Flag, Sparkles, AlertCircle } from 'lucide-react'
import { todayString, combineDeadline, isPastDeadline } from '../utils/core.js'

export default function TaskForm({ onCreate, apiError }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const today = useMemo(() => todayString(new Date()), [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    const dueDate = combineDeadline(date, time)
    if (dueDate && isPastDeadline(date, time, new Date(), 1)) {
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
      className="rounded-xl bg-card border p-4 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm tracking-tight flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-foreground grid place-items-center">
            <Plus className="w-3.5 h-3.5 text-background" />
          </span>
          Add task
        </h3>
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="w-3 h-3" /> Quick add
        </span>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            maxLength={200}
            required
            className="w-full h-10 px-3 pr-14 rounded-lg bg-background border focus:border-foreground focus:ring-1 focus:ring-foreground/10 outline-none transition text-sm placeholder:text-muted-foreground"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{title.length}/200</span>
        </div>

        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full h-9 px-3 rounded-lg bg-background border focus:border-foreground focus:ring-1 focus:ring-foreground/10 outline-none transition text-sm placeholder:text-muted-foreground"
        />

        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_120px] gap-2">
          <label onClick={e => { const inp = e.currentTarget.querySelector('input'); try { inp?.showPicker?.() } catch {} }} className="flex items-center gap-2 bg-card border rounded-lg px-2.5 h-9 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/10 transition cursor-pointer">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min={today}
              onClick={e => { try { e.currentTarget.showPicker?.() } catch {} }}
              onFocus={e => { try { e.currentTarget.showPicker?.() } catch {} }}
              className="w-full bg-transparent outline-none text-sm text-foreground cursor-pointer" />
          </label>

          <label onClick={e => { const inp = e.currentTarget.querySelector('input'); try { inp?.showPicker?.() } catch {} }} className="flex items-center gap-2 bg-card border rounded-lg px-2.5 h-9 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/10 transition cursor-pointer">
            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              onClick={e => { try { e.currentTarget.showPicker?.() } catch {} }}
              onFocus={e => { try { e.currentTarget.showPicker?.() } catch {} }}
              className="w-full bg-transparent outline-none text-sm text-foreground cursor-pointer" />
          </label>

          <label className="flex items-center gap-2 bg-card border rounded-lg px-2.5 h-9 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/10 transition">
            <Flag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-transparent outline-none text-sm cursor-pointer text-foreground">
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
          </label>
        </div>

        {apiError && !error && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted border rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {apiError}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </div>
        )}

        <button disabled={loading || !title.trim()} className="w-full h-9 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5">
          {loading ? 'Adding…' : <><Plus className="w-3.5 h-3.5" /> Add task</>}
        </button>
      </div>
    </form>
  )
}
