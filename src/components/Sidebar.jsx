import { memo, useMemo } from 'react'
import { Flame, Trophy, TrendingUp, Calendar, CheckCircle2, Clock } from 'lucide-react'

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

export function TodayCard({ count }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 gradient-primary text-white shadow-xl">
      <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/15 rounded-full blur-2xl" />
      <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-white/80 text-xs font-semibold tracking-widest uppercase">
          <Calendar className="w-3.5 h-3.5" /> Today
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tracking-tight">{count}</span>
          <span className="text-white/80 text-sm font-medium">tasks done</span>
        </div>
        <p className="mt-1 text-xs text-white/70 font-medium">Keep the momentum going →</p>
      </div>
    </div>
  )
}

export const InsightsPanel = memo(function InsightsPanel({ stats, loading, error, onRetry }) {
  if (loading && !stats) return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-violet-500" />
        <h3 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Insights</h3>
        <span className="ml-auto text-[10px] font-bold bg-muted px-2 py-0.5 rounded-full animate-pulse">loading…</span>
      </div>
      <div className="grid grid-cols-2 gap-3 animate-pulse">
        <div className="h-16 bg-muted rounded-xl" />
        <div className="h-16 bg-muted rounded-xl" />
      </div>
      <div className="mt-4 h-[72px] bg-muted/50 rounded-xl animate-pulse" />
    </div>
  )

  if (error && !stats) {
    return (
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-violet-500" />
          <h3 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Insights</h3>
        </div>
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-700 dark:text-red-300">
          Backend offline — graph unavailable
          <button onClick={onRetry} className="ml-2 h-7 px-2 rounded-lg bg-red-500 text-white font-bold text-[11px]">Retry</button>
        </div>
        <div className="mt-4 rounded-xl bg-muted/50 border border-border/50 p-3">
          <div className="flex items-end gap-1.5 h-[72px] opacity-30">
            {Array.from({length:7}).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full max-w-[28px] h-2 bg-foreground/10 rounded-t-lg" />
                <span className="text-[10px] font-bold w-6 h-6 grid place-items-center rounded-full bg-muted text-muted-foreground">
                  {['S','M','T','W','T','F','S'][new Date(Date.now() - (6-i)*86400000).getDay()]}
                </span>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-2">Start API to see trend</p>
        </div>
      </div>
    )
  }

  const fallback = { current_streak: 0, total_completions: 0, best_day: null, best_day_count: 0, last_7_days: [], by_priority: {} }
  const s = stats || fallback

  // Memoize week/max/todayStr to avoid recalc on every render
  const { week, max, todayStr } = useMemo(() => {
    let w = s.last_7_days || []
    if (w.length === 0) {
      const today = new Date()
      w = Array.from({length:7}).map((_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() - (6 - i))
        return { date: d.toISOString().slice(0,10), count: 0 }
      })
    }
    const m = Math.max(...w.map(d => d.count), 1)
    const t = new Date().toISOString().slice(0,10)
    return { week: w, max: m, todayStr: t }
  }, [s.last_7_days])

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-violet-500" />
        <h3 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">Insights</h3>
        {error && <span className="ml-auto text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">offline</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/10 p-3">
          <div className="flex items-center gap-1.5 text-2xl font-extrabold tracking-tight">
            {s.current_streak}
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div className="text-xs font-semibold text-muted-foreground">day streak</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/10 p-3">
          <div className="text-2xl font-extrabold tracking-tight">{s.total_completions}</div>
          <div className="text-xs font-semibold text-muted-foreground">done all-time</div>
        </div>
      </div>

      {/* 7-day chart — CSS transition instead of framer-motion for speed */}
      <div className="mt-4 rounded-xl bg-muted/50 border border-border/50 p-3">
        <div className="flex items-end gap-1.5 h-[72px]">
          {week.map((d) => {
            const h = d.count > 0 ? Math.max(8, Math.round((d.count / max) * 52)) : 0
            const isToday = d.date === todayStr
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="relative flex-1 w-full flex items-end justify-center">
                  {d.count > 0 ? (
                    <div
                      className={`w-full max-w-[28px] rounded-t-lg ${isToday ? 'gradient-primary shadow-md' : 'bg-foreground/15 dark:bg-white/20'} relative group transition-all duration-500 ease-out`}
                      style={{ height: h }}
                    >
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-bold tabular-nums">{d.count}</span>
                    </div>
                  ) : (
                    <div className="w-full max-w-[28px] h-[4px] bg-foreground/10 dark:bg-white/5 rounded-full" />
                  )}
                </div>
                <span className={`text-[10px] font-bold w-6 h-6 grid place-items-center rounded-full ${isToday ? 'bg-violet-500 text-white' : 'text-muted-foreground'}`}>
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </div>
            )
          })}
        </div>
        {week.every(d=>d.count===0) && !error && (
          <p className="text-center text-[11px] text-muted-foreground mt-2">No completions last 7 days</p>
        )}
      </div>

      {s.best_day ? (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground bg-amber-500/10 border border-amber-500/15 rounded-full px-3 py-2">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          Best: {formatDate(s.best_day)} ({s.best_day_count})
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground mt-2 text-center">Complete tasks to build your streak</p>
      )}
    </div>
  )
})

export const HistoryPanel = memo(function HistoryPanel({ history }) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  if (!history) return null

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-violet-500" />
        <h3 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">History</h3>
        <span className="ml-auto text-xs font-bold bg-violet-500 text-white px-2 py-0.5 rounded-full">{history.length} days</span>
      </div>

      {history.length === 0 ? (
        <div className="py-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-muted grid place-items-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No completed tasks yet</p>
          <p className="text-xs text-muted-foreground/70">Complete a task to see it here</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-auto pr-1 -mr-1">
          {history.map((entry) => {
            const isToday = entry.date === todayStr
            return (
              <div key={entry.date} className={`rounded-xl border p-3 transition ${isToday ? 'bg-violet-500/10 border-violet-500/20' : 'bg-card/50 border-border/50 hover:border-border'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{formatDate(entry.date)}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${isToday ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'}`}>{entry.count} done</span>
                </div>
                {entry.tasks?.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {entry.tasks.slice(0, 20).map((t, idx) => (
                      <li key={idx} className="flex gap-2 text-xs leading-relaxed">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{typeof t === 'string' ? t : t.title}</div>
                          {typeof t !== 'string' && (t.created_at || t.completed_at) && (
                            <div className="text-muted-foreground text-[11px]">
                              {t.created_at && t.completed_at && String(t.created_at).slice(0,10) === String(t.completed_at).slice(0,10)
                                ? `${formatTime(t.created_at)} → ${formatTime(t.completed_at)}`
                                : `${t.completed_at ? formatDateTime(t.completed_at) : ''}`}
                              {t.priority ? ` • ${t.priority}` : ''}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                    {entry.tasks.length > 20 && (
                      <li className="text-xs text-muted-foreground pl-3">+{entry.tasks.length - 20} more</li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export default function Sidebar({ stats, history, todayCount, loading, error, onRetry }) {
  return (
    <aside className="w-[340px] shrink-0 flex flex-col gap-4">
      <TodayCard count={todayCount} />
      <InsightsPanel stats={stats} loading={loading} error={error} onRetry={onRetry} />
      <HistoryPanel history={history} />
    </aside>
  )
}
