import { Minus, Square, X, Sparkles } from 'lucide-react'

export default function TitleBar({ version }) {
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  const handleMin = () => window.electronAPI?.minimize()
  const handleMax = () => window.electronAPI?.toggleMaximize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <div className="h-9 flex items-center justify-between glass-strong sticky top-0 z-50 border-b border-white/10 titlebar-drag select-none">
      <div className="flex items-center gap-3 pl-4">
        <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center shadow-md">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-display font-bold text-sm tracking-tight">Personal Tracker</span>
        {version && (
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-widest bg-violet-500/10 text-violet-600 dark:text-violet-300 border border-violet-500/20">
            v{version}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 pr-1 titlebar-no-drag">
        {!isElectron && (
          <div className="text-xs text-muted-foreground pr-3 hidden md:block">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">K</kbd> to search
          </div>
        )}
        {isElectron && (
          <>
            <button onClick={handleMin} className="w-9 h-7 grid place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <Minus className="w-4 h-4 opacity-70" />
            </button>
            <button onClick={handleMax} className="w-9 h-7 grid place-items-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <Square className="w-3.5 h-3.5 opacity-70" />
            </button>
            <button onClick={handleClose} className="w-9 h-7 grid place-items-center rounded-md hover:bg-red-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
