import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Save, Calendar, Clock, Flag, AlertCircle } from 'lucide-react'
import * as Core from '../utils/core.js'

export default function EditModal({ task, open, onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (task && open) {
      setTitle(task.title || '')
      setDescription(task.description || '')
      setPriority(task.priority || 'Medium')
      setDate(task.due_date ? String(task.due_date).slice(0,10) : '')
      setTime(Core.hasTimeComponent(task.due_date) ? String(task.due_date).slice(11,16) : '')
      setError('')
    }
  }, [task, open])

  if (!open || !task) return null

  const handleSave = async () => {
    if (!title.trim()) { setError('Title cannot be empty.'); return }
    const dueValue = Core.combineDeadline(date, time)
    const keptExisting = dueValue !== null && Core.sameMinute(dueValue, task.due_date)
    if (dueValue && !keptExisting && Core.isPastDeadline(date, time, new Date(), 1)) {
      setError("Deadline can't be in the past."); return
    }
    setSaving(true); setError('')
    try {
      await onSave(task.id, {
        completed: task.completed,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueValue,
      })
      onClose()
    } catch (e) {
      setError(e.message || 'Could not save')
    } finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-card border rounded-xl p-5 shadow-xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-medium tracking-tight">Edit task</h3>
                <p className="text-xs text-muted-foreground">Update task details.</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg bg-muted hover:bg-muted/80 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" maxLength={200}
                className="w-full h-10 px-3 rounded-lg bg-card border focus:border-foreground focus:ring-1 focus:ring-foreground/10 outline-none text-sm font-medium text-foreground" />

              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-card border focus:border-foreground focus:ring-1 focus:ring-foreground/10 outline-none text-sm resize-none text-foreground placeholder:text-muted-foreground" />

              <div className="grid grid-cols-3 gap-2">
                <label onClick={e => { const inp = e.currentTarget.querySelector('input'); try { inp?.showPicker?.() } catch {} }} className="flex items-center gap-2 bg-card border rounded-lg px-2.5 h-9 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/10 transition cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} onClick={e => { try { e.currentTarget.showPicker?.() } catch {} }} onFocus={e => { try { e.currentTarget.showPicker?.() } catch {} }} className="w-full bg-transparent outline-none text-sm text-foreground cursor-pointer" />
                </label>
                <label onClick={e => { const inp = e.currentTarget.querySelector('input'); try { inp?.showPicker?.() } catch {} }} className="flex items-center gap-2 bg-card border rounded-lg px-2.5 h-9 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/10 transition cursor-pointer">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} onClick={e => { try { e.currentTarget.showPicker?.() } catch {} }} onFocus={e => { try { e.currentTarget.showPicker?.() } catch {} }} className="w-full bg-transparent outline-none text-sm text-foreground cursor-pointer" />
                </label>
                <label className="flex items-center gap-2 bg-card border rounded-lg px-2.5 h-9 focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/10 transition">
                  <Flag className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-transparent outline-none text-sm cursor-pointer text-foreground">
                    <option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="h-9 px-4 rounded-lg bg-muted hover:bg-muted/80 font-medium text-sm transition">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="h-9 px-4 rounded-lg bg-foreground text-background font-medium text-sm hover:bg-foreground/90 disabled:opacity-50 inline-flex items-center gap-2">
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
