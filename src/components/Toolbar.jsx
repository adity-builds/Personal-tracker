import { memo } from 'react'
import { Search, Filter, ArrowUpDown } from 'lucide-react'

function Toolbar({ query, setQuery, priority, setPriority, status, setStatus, count }) {
  return (
    <div className="rounded-xl bg-card border p-3 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center shadow-sm">
      <div className="flex-1 relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search"
          className="w-full h-8 pl-8 pr-3 rounded-lg bg-muted border-0 focus:bg-background focus:ring-1 focus:ring-foreground/20 outline-none text-sm transition placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex gap-2">
        <label className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 h-8 focus-within:bg-background focus-within:ring-1 focus-within:ring-foreground/20 transition">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-transparent outline-none text-sm cursor-pointer pr-1">
            <option value="all">All</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 h-8 focus-within:bg-background focus-within:ring-1 focus-within:ring-foreground/20 transition">
          <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <select value={status} onChange={e => setStatus(e.target.value)} className="bg-transparent outline-none text-sm cursor-pointer pr-1">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>

      <div className="hidden lg:flex items-center text-xs text-muted-foreground tabular-nums">
        {count}
      </div>
    </div>
  )
}

export default memo(Toolbar)
