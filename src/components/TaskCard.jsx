import { memo, useMemo, useCallback } from 'react'
import { Pencil, Trash2, Clock, Flag, Check } from 'lucide-react'
import * as Core from '../utils/core.js'

function priorityDot(p) {
  switch (p) {
    case 'High': return 'bg-red-500'
    case 'Low': return 'bg-emerald-500'
    default: return 'bg-amber-500'
  }
}

function TaskCard({ task, onToggle, onEdit, onDelete, now }) {
  const urgency = Core.dueStatus(task, now)

  const { dueText, timeText } = useMemo(() => {
    if (!task.due_date) return { dueText: null, timeText: '' }
    const s = String(task.due_date)
    const dueDay = s.slice(0, 10)
    let dt = null
    try {
      dt = new Date(Number(dueDay.slice(0, 4)), Number(dueDay.slice(5, 7)) - 1, Number(dueDay.slice(8, 10))).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { dt = dueDay }
    let tt = ''
    if (Core.hasTimeComponent(s)) {
      const d = new Date(s)
      if (!isNaN(d.getTime())) tt = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    }
    return { dueText: dt, timeText: tt }
  }, [task.due_date])

  const handleToggle = useCallback(() => { if (!task.completed) onToggle(task) }, [task, onToggle])
  const handleEdit = useCallback(() => onEdit(task), [task, onEdit])
  const handleDelete = useCallback(() => onDelete(task), [task, onDelete])

  return (
    <li
      className={`group relative flex gap-3 p-3 rounded-xl bg-card border card-hover ${task.completed ? 'opacity-60' : ''} ${urgency==='overdue' ? 'border-l-2 border-l-red-500' : urgency==='due-today' ? 'border-l-2 border-l-amber-500' : ''}`}
    >
      <button
        onClick={handleToggle}
        disabled={task.completed}
        aria-label={task.completed ? 'Completed' : 'Mark complete'}
        className={`mt-0.5 w-5 h-5 rounded-full border grid place-items-center shrink-0 transition focus:outline-none focus:ring-1 focus:ring-foreground/20 ${
          task.completed
            ? 'bg-foreground border-foreground text-background'
            : 'bg-background border hover:border-foreground hover:bg-muted'
        }`}
      >
        {task.completed ? (
          <Check className="w-3 h-3" />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/0 group-hover:bg-foreground/20 transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-sm leading-tight truncate pr-2 ${task.completed ? 'line-through text-muted-foreground' : 'font-medium'}`}>{task.title}</div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${priorityDot(task.priority)}`} /> {task.priority || 'Medium'}
          </span>
          {urgency && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${urgency==='overdue' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
              {urgency==='overdue' ? 'Overdue' : 'Today'}
            </span>
          )}
          {task.due_date && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" /> {dueText}{timeText ? ` · ${timeText}` : ''}
            </span>
          )}
        </div>
        {task.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{task.description}</p>
        )}
      </div>

      <div className="flex items-start gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
        <button onClick={handleEdit} className="w-7 h-7 grid place-items-center rounded-lg hover:bg-muted transition">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleDelete} className="w-7 h-7 grid place-items-center rounded-lg hover:bg-red-500 hover:text-white transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  )
}

export default memo(TaskCard)
