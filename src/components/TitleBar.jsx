import { memo } from 'react'
import { Minus, Square, X, Sparkles } from 'lucide-react'

function TitleBar({ version }) {
  const isWindowed = typeof window !== 'undefined' && (window.electronAPI || (window.pywebview && window.pywebview.api))
  const api = typeof window !== 'undefined' ? (window.electronAPI || (window.pywebview ? {
    minimize: () => window.pywebview.api.minimize(),
    toggleMaximize: () => window.pywebview.api.toggle_maximize(),
    close: () => window.pywebview.api.close(),
    startDrag: () => window.pywebview.api.start_drag && window.pywebview.api.start_drag(),
  } : null)) : null

  const handleMin = () => api?.minimize()
  const handleMax = () => api?.toggleMaximize()
  const handleClose = () => api?.close()
  const handleDrag = (e) => {
    // pywebview frameless needs JS-initiated drag (Electron uses -webkit-app-region)
    if (api?.startDrag && e.buttons === 1 && !e.target.closest('button')) {
      try { api.startDrag() } catch {}
    }
  }

  return (
    <div onMouseDown={handleDrag} className="h-10 flex items-center justify-between bg-card sticky top-0 z-50 border-b shadow-sm titlebar-drag select-none">
      <div className="flex items-center gap-3 pl-4">
        <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-background" />
        </div>
        <span className="font-display font-semibold text-[13px] tracking-tight">Personal Tracker</span>
        {version && (
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-muted text-muted-foreground border">
            v{version}
          </span>
        )}
        <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-muted-foreground ml-2 pl-3 border-l">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Electron • React
        </span>
      </div>

      <div className="flex items-center h-full">
        {!isWindowed && (
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground pr-3 titlebar-no-drag">
            <span className="hidden xl:inline">Press</span>
            <kbd className="px-1.5 py-1 bg-muted border rounded text-[10px] font-medium">⌘ K</kbd>
          </div>
        )}
        {isWindowed && (
          <div className="flex items-stretch h-full titlebar-no-drag">
            <button onClick={handleMin} className="w-[46px] grid place-items-center hover:bg-muted transition-colors group titlebar-no-drag" aria-label="Minimize">
              <Minus className="w-4 h-4 opacity-70 group-hover:opacity-100" />
            </button>
            <button onClick={handleMax} className="w-[46px] grid place-items-center hover:bg-muted transition-colors group titlebar-no-drag" aria-label="Maximize">
              <Square className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
            </button>
            <button onClick={handleClose} className="w-[46px] grid place-items-center hover:bg-red-500 hover:text-white transition-colors group titlebar-no-drag" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(TitleBar)
