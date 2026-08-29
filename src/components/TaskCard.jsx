import { memo, useMemo, useCallback } from 'react'
import { Pencil, Trash2, Clock, Flag, Check } from 'lucide-react'
import * as Core from '../utils/core.js'

function priorityStyles(p) {
  switch (p) {
    case 'High': return 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/20'
    case 'Low': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20'
    default: return 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/20'
  }
}

function TaskCard({ task, onToggle, onEdit, onDelete }) {
  const urgency = Core.dueStatus(task)

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
      className={`group relative flex gap-3 p-4 rounded-2xl border transition-all glass hover:shadow-lg hover:-translate-y-[1px] animate-[fadeIn_0.2s_ease-out] ${task.completed ? 'opacity-70' : ''} ${urgency==='overdue' ? 'border-red-500/20 bg-red-500/[0.03]' : urgency==='due-today' ? 'border-amber-500/20 bg-amber-500/[0.03]' : 'border-border/60'}`}
    >
      <button
        onClick={handleToggle}
        disabled={task.completed}
        aria-label={task.completed ? 'Completed' : 'Mark complete'}
        className={`mt-0.5 w-6 h-6 rounded-full border-2 grid place-items-center shrink-0 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-1 focus:ring-offset-card ${
          task.completed
            ? 'bg-violet-500 border-violet-500 text-white shadow-md shadow-violet-500/20'
            : 'bg-card dark:bg-white/[0.06] border-border dark:border-white/25 hover:border-violet-500 dark:hover:border-violet-400 hover:bg-violet-500/10 dark:hover:bg-violet-500/20 shadow-sm hover:shadow-md hover:scale-105 active:scale-95'
        }`}
      >
        {task.completed ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-violet-500/0 group-hover:bg-violet-500/20 dark:group-hover:bg-violet-400/30 transition-colors" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`font-semibold leading-tight truncate pr-2 ${task.completed ? 'line-through decoration-2 decoration-muted-foreground/40 text-muted-foreground' : 'tracking-tight'}`}>{task.title}</div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${priorityStyles(task.priority)}`}>
            <Flag className="w-3 h-3" /> {task.priority || 'Medium'}
          </span>
          <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border ${task.completed ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20' : 'bg-muted text-muted-foreground border-transparent'}`}>
            {task.completed ? 'Completed' : 'Pending'}
          </span>
          {urgency && (
            <span className={`inline-flex items-center text-xs font-extrabold px-2.5 py-1 rounded-full border ${urgency==='overdue' ? 'bg-red-500 text-white border-red-600 shadow' : 'bg-amber-500 text-white border-amber-600 shadow'}`}>
              {urgency==='overdue' ? 'Overdue' : 'Due today'}
            </span>
          )}
          {task.due_date && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3" /> Due {dueText}{timeText ? `, ${timeText}` : ''}
            </span>
          )}
          {task.description && (
            <span className="text-xs text-muted-foreground line-clamp-2">{task.description}</span>
          )}
        </div>
      </div>

      <div className="flex items-start gap-1 shrink-0">
        <button onClick={handleEdit} className="w-8 h-8 grid place-items-center rounded-xl bg-card border border-border hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300 transition">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={handleDelete} className="w-8 h-8 grid place-items-center rounded-xl bg-card border border-border hover:bg-red-500 hover:text-white hover:border-red-500 transition">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  )
}

export default memo(TaskCard)
