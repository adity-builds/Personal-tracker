import { memo, useMemo } from 'react'
import { Flame, Trophy, TrendingUp, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { todayString } from '../utils/core.js'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}
function formatTime(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  if (isNaN(d.getTime())) return String(dt)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
function formatDateTime(dt) {
  if (!dt) return ''
  const d = new Date(dt)
  if (isNaN(d.getTime())) return String(dt)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export const TodayCard = memo(function TodayCard({ count, now }) {
  const liveDate = useMemo(() => now ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '', [now])
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="rounded-xl bg-card border p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium tracking-wide">
        <Calendar className="w-3.5 h-3.5" /> {liveDate || 'Today'}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{count}</span>
        <span className="text-sm text-muted-foreground">completed</span>
      </div>
      <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, count * 12)}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="h-full bg-foreground" />
      </div>
    </motion.div>
  )
})

export const InsightsPanel = memo(function InsightsPanel({ stats, loading, error, onRetry, now }) {
  if (loading && !stats) return (
    <div className="rounded-xl bg-card border p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground">Insights</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        <div className="h-16 bg-muted rounded-lg" />
        <div className="h-16 bg-muted rounded-lg" />
      </div>
      <div className="mt-4 h-[72px] bg-muted rounded-lg animate-pulse" />
    </div>
  )

  if (error && !stats) {
    return (
      <div className="rounded-xl bg-card border p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground">Insights</h3>
        </div>
        <div className="rounded-lg bg-muted border p-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>Offline — no data</span>
          <button onClick={onRetry} className="h-7 px-3 rounded-full bg-foreground text-background text-xs font-medium">Retry</button>
        </div>
        <div className="mt-4 rounded-lg bg-muted/50 border p-3">
          <div className="flex items-end gap-1.5 h-[72px] opacity-30">
            {Array.from({length:7}).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full max-w-[28px] h-1.5 bg-border rounded-full" />
                <span className="text-[10px] w-6 h-6 grid place-items-center rounded-full bg-muted text-muted-foreground">
                  {['S','M','T','W','T','F','S'][new Date(Date.now() - (6-i)*86400000).getDay()]}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">Start API to see trend</p>
        </div>
      </div>
    )
  }

  const fallback = { current_streak: 0, total_completions: 0, best_day: null, best_day_count: 0, last_7_days: [], by_priority: {} }
  const s = stats || fallback

  // Memoize week/max/todayStr to avoid recalc on every render - realtime via now
  const { week, max, todayStr } = useMemo(() => {
    const baseNow = now || new Date()
    let w = s.last_7_days || []
    if (w.length === 0) {
      w = Array.from({length:7}).map((_, i) => {
        const d = new Date(baseNow)
        d.setDate(baseNow.getDate() - (6 - i))
        return { date: todayString(d), count: 0 }
      })
    }
    const m = Math.max(...w.map(d => d.count), 1)
    const t = todayString(baseNow)
    return { week: w, max: m, todayStr: t }
  }, [s.last_7_days, now])

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="rounded-xl bg-card border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground">Insights</h3>
        {error && <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full">offline</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted p-3">
          <div className="flex items-baseline gap-1.5 text-xl font-semibold tracking-tight tabular-nums">
            {s.current_streak}
            <Flame className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-xs text-muted-foreground">day streak</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="text-xl font-semibold tracking-tight tabular-nums">{s.total_completions}</div>
          <div className="text-xs text-muted-foreground">completed</div>
        </div>
      </div>

      {/* 7-day chart — balanced scale, larger area */}
      <div className="mt-4 rounded-lg bg-muted/40 border p-3 pt-7">
        <div className="flex items-end gap-1.5 h-[96px]">
          {week.map((d, i) => {
            // Balanced: base 20px + proportional 44px → 1 vs 5 is 29 vs 64 (≈1:2.2) not 10 vs 52 (≈1:5)
            const h = d.count > 0 ? Math.round(20 + (d.count / max) * 44) : 0
            const isToday = d.date === todayStr
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="relative flex-1 w-full flex items-end justify-center">
                  {d.count > 0 ? (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: h }}
                      transition={{ duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                      className={`w-full max-w-[24px] rounded-sm ${isToday ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
                    >
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-medium tabular-nums">{d.count}</span>
                    </motion.div>
                  ) : (
                    <div className="w-full max-w-[24px] h-1 bg-border rounded-full" />
                  )}
                </div>
                <span className={`text-[10px] w-5 h-5 grid place-items-center rounded-full ${isToday ? 'bg-foreground text-background font-medium' : 'text-muted-foreground'}`}>
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </div>
            )
          })}
        </div>
        {week.every(d=>d.count===0) && !error && (
          <p className="text-center text-xs text-muted-foreground mt-2">No activity last 7 days</p>
        )}
      </div>

      {s.best_day ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1.5">
          <Trophy className="w-3.5 h-3.5" />
          Best {formatDate(s.best_day)} • {s.best_day_count}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-3 text-center">Complete a task to start streak</p>
      )}
    </motion.div>
  )
})

export const HistoryPanel = memo(function HistoryPanel({ history, now }) {
  const todayStr = useMemo(() => todayString(now || new Date()), [now])
  if (!history || history.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="rounded-xl bg-card border p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground">History</h3>
          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full tabular-nums">0d</span>
        </div>
        <div className="py-8 text-center">
          <div className="w-10 h-10 mx-auto rounded-lg bg-muted grid place-items-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">No history yet</p>
          <p className="text-xs text-muted-foreground/70">Completed tasks appear here</p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="rounded-xl bg-card border p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground">History</h3>
        <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full tabular-nums">{history.length}d</span>
      </div>

      <div className="space-y-2 max-h-[380px] overflow-auto pr-1 -mr-1">
        {history.map((entry) => {
          const isToday = entry.date === todayStr
          return (
            <div key={entry.date} className={`rounded-lg border p-3 ${isToday ? 'bg-muted border-foreground/10' : 'bg-card border hover:bg-muted/50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{formatDate(entry.date)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums ${isToday ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>{entry.count}</span>
              </div>
              {entry.tasks?.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {entry.tasks.slice(0, 12).map((t, idx) => (
                    <li key={idx} className="flex gap-2 text-xs">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground/60 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate leading-tight">{typeof t === 'string' ? t : t.title}</div>
                        {typeof t !== 'string' && (t.created_at || t.completed_at) && (
                          <div className="text-muted-foreground text-[11px] tabular-nums">
                            {t.created_at && t.completed_at && String(t.created_at).slice(0,10) === String(t.completed_at).slice(0,10)
                              ? `${formatTime(t.created_at)} → ${formatTime(t.completed_at)}`
                              : `${t.completed_at ? formatDateTime(t.completed_at) : ''}`}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {entry.tasks.length > 12 && (
                    <li className="text-xs text-muted-foreground pl-3">+{entry.tasks.length - 12} more</li>
                  )}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
})


