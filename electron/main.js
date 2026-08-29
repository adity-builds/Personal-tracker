import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import http from 'http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = !app.isPackaged
const API_HOST = '127.0.0.1'
const API_PORT = 8000
const API_URL = `http://${API_HOST}:${API_PORT}`

let mainWindow = null
let pyProcess = null

function waitForServer(url, timeout = 12000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout
    let delay = 150
    const tryFetch = () => {
      const req = http.get(url, (res) => {
        res.resume()
        resolve(true)
      })
      req.on('error', () => {
        if (Date.now() > deadline) return resolve(false)
        setTimeout(tryFetch, delay)
        delay = Math.min(delay * 1.4, 800)
      })
      req.setTimeout(1000, () => {
        req.destroy()
        if (Date.now() > deadline) return resolve(false)
        setTimeout(tryFetch, delay)
        delay = Math.min(delay * 1.4, 800)
      })
    }
    tryFetch()
  })
}

function getPythonCommand() {
  return process.platform === 'win32' ? 'python' : 'python3'
}

async function startPythonBackend() {
  const alreadyUp = await waitForServer(`${API_URL}/version`, 1200)
  if (alreadyUp) {
    console.log('[electron] Python backend already running')
    return
  }

  const projectRoot = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app.asar.unpacked')
  const possibleRoots = [
    path.join(__dirname, '..'),
    path.join(process.resourcesPath, 'app'),
    path.join(app.getAppPath(), '..'),
    process.cwd(),
  ]

  let backendDir = projectRoot
  for (const p of possibleRoots) {
    if (fs.existsSync(path.join(p, 'main.py'))) { backendDir = p; break }
  }

  console.log(`[electron] Starting Python backend from ${backendDir}`)

  const pyCmd = getPythonCommand()
  try {
    pyProcess = spawn(pyCmd, ['-u', 'main.py'], {
      cwd: backendDir,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    })

    pyProcess.stdout?.on('data', (d) => console.log(`[py] ${d}`.trim()))
    pyProcess.stderr?.on('data', (d) => console.error(`[py:err] ${d}`.trim()))
    pyProcess.on('error', (err) => console.error('[electron] Failed to spawn python:', err))
    pyProcess.on('exit', (code) => console.log(`[electron] Python exited with ${code}`))

    const ok = await waitForServer(`${API_URL}/version`, 12000)
    if (!ok) console.warn('[electron] Python backend did not become ready in time')
  } catch (e) {
    console.error('[electron] spawn error', e)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f8fafc',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  // IPC for window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false
    if (mainWindow.isMaximized()) { mainWindow.restore(); return false }
    mainWindow.maximize(); return true
  })
  ipcMain.handle('window:close', () => mainWindow?.close())

  mainWindow.on('ready-to-show', () => mainWindow.show())

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const indexReact = path.join(__dirname, '../dist-react/index.html')
    const indexOld = path.join(__dirname, '../dist/index.html')
    if (fs.existsSync(indexReact)) {
      mainWindow.loadFile(indexReact)
    } else if (fs.existsSync(indexOld)) {
      mainWindow.loadFile(indexOld)
    } else {
      // fallback to API-served index (old static)
      mainWindow.loadURL(`${API_URL}/`)
    }
  }
}

app.whenReady().then(async () => {
  await startPythonBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  if (pyProcess) {
    try { pyProcess.kill() } catch {}
    pyProcess = null
  }
})
