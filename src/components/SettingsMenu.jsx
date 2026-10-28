import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, X, Moon, Sun, Clock, Sparkles, RotateCcw, Download, Upload, Save, Database } from 'lucide-react'

import * as api from '../utils/api.js'

export default function SettingsMenu({
  theme,
  toggleTheme,
  is24Hour,
  setIs24Hour,
  auroraSettings,
  setAuroraSettings,
  onReset,
  onDataChanged,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // close on outside click / Esc
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const { speed, amplitude, blend } = auroraSettings

  const [dataStatus, setDataStatus] = useState(null) // {type: 'export'|'import', message: string, error: boolean}

  const handleExport = async (format) => {
    setDataStatus({ type: 'export', message: `Exporting ${format}…`, error: false })
    try {
      const r = await api.exportBackup(format)
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `personaltracker_export_${new Date().toISOString().slice(0, 16).replace(/[:.]/g, '-')}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDataStatus({ type: 'export', message: `${format.toUpperCase()} export saved.`, error: false })
    } catch (e) {
      setDataStatus({ type: 'export', message: e.message || 'Export failed.', error: true })
    }
  }

  const handleImport = async (file) => {
    setDataStatus({ type: 'import', message: 'Importing…', error: false })
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const result = await api.importBackup(json, 'merge')
      setDataStatus({
        type: 'import',
        message: `Imported: ${result.imported_tasks} tasks, ${result.imported_history} history (skipped ${result.skipped}).`,
        error: false,
      })
      await onDataChanged?.()
    } catch (e) {
      setDataStatus({ type: 'import', message: e.message || 'Import failed.', error: true })
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <motion.button
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.02 }}
        onClick={() => setOpen(v => !v)}
        className="bg-card border rounded-full h-8 w-8 grid place-items-center hover:bg-muted transition shadow-sm"
        aria-label="Open settings"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Settings className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] sm:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2 z-50 w-[320px] max-w-[92vw] rounded-xl bg-card border shadow-xl overflow-hidden"
              role="dialog"
              aria-label="Settings"
            >
              {/* header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-foreground text-background grid place-items-center">
                    <Settings className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold leading-none">Settings</h3>
                    <p className="text-[11px] text-muted-foreground">Appearance & background</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-muted grid place-items-center transition"
                  aria-label="Close settings"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Appearance */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                    <Sun className="w-3 h-3" /> Appearance
                  </h4>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium flex items-center gap-2">
                      {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      Theme
                    </span>
                    <div className="flex items-center bg-muted rounded-full p-1 gap-1">
                      <button
                        onClick={() => theme !== 'light' && toggleTheme()}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${theme === 'light' ? 'bg-card shadow-sm border' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Light
                      </button>
                      <button
                        onClick={() => theme !== 'dark' && toggleTheme()}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${theme === 'dark' ? 'bg-card shadow-sm border text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Dark
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Clock format
                    </span>
                    <div className="flex items-center bg-muted rounded-full p-1 gap-1">
                      <button
                        onClick={() => setIs24Hour(false)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${!is24Hour ? 'bg-card shadow-sm border' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        12h
                      </button>
                      <button
                        onClick={() => setIs24Hour(true)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${is24Hour ? 'bg-card shadow-sm border' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        24h
                      </button>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border" />

                {/* Background Animation */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" /> Background
                    </h4>
                    <button
                      onClick={onReset}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-muted hover:bg-muted/80 border transition"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>

                  {/* Speed */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Speed</label>
                      <span className="text-xs tabular-nums px-2 py-0.5 rounded-full bg-muted border font-medium">
                        {speed.toFixed(1)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={speed}
                      onChange={e => setAuroraSettings(s => ({ ...s, speed: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-[hsl(var(--primary))]"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Frozen</span><span>1×</span><span>3× Fast</span>
                    </div>
                  </div>

                  {/* Amplitude */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Amplitude</label>
                      <span className="text-xs tabular-nums px-2 py-0.5 rounded-full bg-muted border font-medium">
                        {amplitude.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={2}
                      step={0.1}
                      value={amplitude}
                      onChange={e => setAuroraSettings(s => ({ ...s, amplitude: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-[hsl(var(--primary))]"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Flat</span><span>Default</span><span>Tall</span>
                    </div>
                  </div>

                  {/* Blend */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Blend</label>
                      <span className="text-xs tabular-nums px-2 py-0.5 rounded-full bg-muted border font-medium">
                        {blend.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={blend}
                      onChange={e => setAuroraSettings(s => ({ ...s, blend: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-[hsl(var(--primary))]"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Sharp</span><span>Soft</span><span>Fog</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/50 rounded-lg p-2 border">
                    Tip: <span className="font-medium text-foreground">Speed 0</span> freezes, <span className="font-medium text-foreground">Blend 0.9</span> is softest. Changes save automatically.
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Data Safety */}
              <div className="px-4 mt-4 space-y-4 pb-4">
                <h4 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                  <Database className="w-3 h-3" /> Data Safety
                </h4>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleExport('json')}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs bg-card border rounded-full shadow-sm hover:bg-muted transition"
                  >
                    <Download className="w-3 h-3" /> Export JSON
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs bg-card border rounded-full shadow-sm hover:bg-muted transition"
                  >
                    <Save className="w-3 h-3" /> Export CSV
                  </button>
                  <label className="flex items-center gap-2 px-3 py-1.5 text-xs bg-card border rounded-full shadow-sm cursor-pointer hover:bg-muted transition">
                    <Upload className="w-3 h-3" /> Import JSON
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) handleImport(e.target.files[0])
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>

                {dataStatus && (
                  <div
                    className={`rounded-lg p-2 text-[11px] border ${
                      dataStatus.error
                        ? 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {dataStatus.message}
                  </div>
                )}
              </div>

              <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Press <kbd className="px-1 py-0.5 bg-card border rounded text-[10px]">Esc</kbd> to close</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live preview</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
