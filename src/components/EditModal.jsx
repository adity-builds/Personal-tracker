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
            className="w-full max-w-lg glass-strong rounded-2xl p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-lg tracking-tight">Edit task</h3>
                <p className="text-sm text-muted-foreground">Update the details of your task.</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-xl bg-muted hover:bg-muted/80 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" maxLength={200}
                className="w-full h-11 px-4 rounded-xl bg-card border border-border focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none text-sm font-medium" />

              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={3}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none text-sm resize-none" />

              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 bg-card border border-border dark:border-white/20 dark:bg-slate-800 rounded-xl px-3 h-11 focus-within:border-violet-500 dark:focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:focus-within:ring-violet-400/20 transition group/date">
                  <Calendar className="w-4 h-4 shrink-0 text-slate-700 dark:text-white transition-colors" />
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-transparent outline-none text-sm text-foreground dark:text-white" />
                </label>
                <label className="flex items-center gap-2 bg-card border border-border dark:border-white/20 dark:bg-slate-800 rounded-xl px-3 h-11 focus-within:border-violet-500 dark:focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:focus-within:ring-violet-400/20 transition group/time">
                  <Clock className="w-4 h-4 shrink-0 text-slate-700 dark:text-white transition-colors" />
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-transparent outline-none text-sm text-foreground dark:text-white" />
                </label>
                <label className="flex items-center gap-2 bg-card border border-border dark:border-white/20 dark:bg-slate-800 rounded-xl px-3 h-11 focus-within:border-violet-500 dark:focus-within:border-violet-400 transition group/prio">
                  <Flag className="w-4 h-4 shrink-0 text-slate-700 dark:text-white transition-colors" />
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-transparent outline-none text-sm font-semibold cursor-pointer text-foreground dark:text-white">
                    <option className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">High</option><option className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Medium</option><option className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Low</option>
                  </select>
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="h-10 px-5 rounded-xl bg-muted hover:bg-muted/80 font-semibold text-sm transition">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="h-10 px-5 rounded-xl gradient-primary text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 inline-flex items-center gap-2">
                  <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
