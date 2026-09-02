import { useNow } from '../hooks/useNow.js'

// Isolated live clock — updates every second without re-rendering the whole App
// Used for header time display, independent from data-tick (60s) in App.jsx
export default function LiveClock({ compact = false, is24Hour = false }) {
  const now = useNow(1000)
  const timeOpts = is24Hour
    ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }
  const timeOptsCompact = is24Hour
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: '2-digit', minute: '2-digit', hour12: true }
  if (compact) {
    return (
      <div className="bg-card border rounded-full h-8 px-3 grid place-items-center tabular-nums text-xs font-medium shadow-sm">
        {now.toLocaleTimeString(undefined, timeOptsCompact)}
      </div>
    )
  }
  return (
    <div className="hidden lg:flex items-center gap-2 bg-card border rounded-full h-8 px-3 text-xs tabular-nums shadow-sm">
      <span className="font-medium tracking-tight">{now.toLocaleTimeString(undefined, timeOpts)}</span>
      <span className="w-px h-3 bg-border" />
      <span className="text-muted-foreground">{now.toLocaleDateString(undefined, { weekday: 'short' })}</span>
    </div>
  )
}
