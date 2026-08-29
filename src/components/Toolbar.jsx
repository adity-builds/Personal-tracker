import { memo } from 'react'
import { Search, Filter, ArrowUpDown } from 'lucide-react'

function Toolbar({ query, setQuery, priority, setPriority, status, setStatus, count }) {
  return (
    <div className="glass rounded-2xl p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search tasks…"
          className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none text-sm transition"
        />
      </div>

      <div className="flex gap-2">
        <label className="flex items-center gap-2 bg-card border border-border dark:border-white/15 dark:bg-slate-800 rounded-xl px-3 h-10 focus-within:border-violet-500 dark:focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:focus-within:ring-violet-400/20 transition">
          <Filter className="w-4 h-4 shrink-0 text-foreground dark:text-white" />
          <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-transparent outline-none text-sm font-semibold cursor-pointer text-foreground dark:text-white">
            <option value="all" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">All priorities</option>
            <option value="High" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">High</option>
            <option value="Medium" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Medium</option>
            <option value="Low" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Low</option>
          </select>
        </label>

        <label className="flex items-center gap-2 bg-card border border-border dark:border-white/15 dark:bg-slate-800 rounded-xl px-3 h-10 focus-within:border-violet-500 dark:focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:focus-within:ring-violet-400/20 transition">
          <ArrowUpDown className="w-4 h-4 shrink-0 text-foreground dark:text-white" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="bg-transparent outline-none text-sm font-semibold cursor-pointer text-foreground dark:text-white">
            <option value="all" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">All</option>
            <option value="pending" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Pending</option>
            <option value="completed" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-white">Completed</option>
          </select>
        </label>
      </div>

      <div className="hidden lg:flex items-center text-xs font-bold text-muted-foreground bg-muted px-3 py-2 rounded-full">
        {count} tasks
      </div>
    </div>
  )
}

export default memo(Toolbar)
