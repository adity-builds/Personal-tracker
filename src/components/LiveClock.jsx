import { useNow } from '../hooks/useNow.js'

// Isolated live clock — single 1s interval, responsive without duplicate timers
export default function LiveClock({ is24Hour = false }) {
  const now = useNow(1000)
  const timeOpts = is24Hour
    ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }
  const timeOptsCompact = is24Hour
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', hour12: true }
  return (
    <>
      <div className="lg:hidden bg-card border rounded-full h-8 px-3 grid place-items-center tabular-nums text-xs font-medium shadow-sm">
        {now.toLocaleTimeString(undefined, timeOptsCompact)}
      </div>
      <div className="hidden lg:flex items-center gap-2 bg-card border rounded-full h-8 px-3 text-xs tabular-nums shadow-sm">
        <span className="font-medium tracking-tight">{now.toLocaleTimeString(undefined, timeOpts)}</span>
        <span className="w-px h-3 bg-border" />
        <span className="text-muted-foreground">{now.toLocaleDateString(undefined, { weekday: 'short' })}</span>
      </div>
    </>
  )
}
