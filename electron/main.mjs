/**
 * Electron entry point. Spawns the same two processes `npm start` already
 * spawns (bridge + Vite dev server) and opens a window onto the Vite dev
 * server instead of asking the user to open Chrome by hand — everything
 * else about how JARVIS boots is unchanged.
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readProfile, writeProfile } from './profile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// Same vendoring step scripts/start.mjs does — hand-tracking's WASM runtime
// has to be served from our own origin, see that file for the full reason.
function vendorWasm() {
  const from = join(projectRoot, 'node_modules/@mediapipe/tasks-vision/wasm')
  const to = join(projectRoot, 'public/mediapipe')
  if (!existsSync(from)) return
  if (existsSync(join(to, 'vision_wasm_internal.wasm'))) return
  try {
    mkdirSync(to, { recursive: true })
    cpSync(from, to, { recursive: true })
  } catch (err) {
    console.warn(`  could not vendor the hand-tracking runtime: ${err.message}`)
  }
}

const children = []
let shuttingDown = false

function run(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...env },
    shell: false,
  })
  child.stdout.on('data', (d) => process.stdout.write(d))
  child.stderr.on('data', (d) => process.stderr.write(d))
  child.on('exit', (code) => {
    if (shuttingDown) return
    // If either half dies the other is useless — same reasoning as
    // scripts/start.mjs's own run(), which this mirrors. Without this, a
    // crashed bridge (e.g. a second instance colliding on the same port)
    // left Electron looking alive with a dead brain and no indication why.
    // Exiting non-zero is what lets start-electron.cmd's `if errorlevel 1
    // pause` show a readable message instead of nothing happening.
    console.error(`${name} exited (${code}); stopping the rest.`)
    crashOut()
  })
  children.push(child)
  return child
}

function shutdown() {
  shuttingDown = true
  for (const c of children) {
    try {
      c.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
}

function crashOut() {
  shutdown()
  app.exit(1)
}

/**
 * Vite prints "Local: http://localhost:5173/" once ready — that line is the
 * only reliable "ready" signal available without adding a dependency.
 *
 * Rejects instead of hanging forever if Vite exits first or never becomes
 * ready within the timeout, so a config error or occupied port surfaces as
 * a real, visible failure instead of a window that silently never appears.
 */
function waitForViteUrl(viteProcess) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Vite did not report a ready URL within 30s.'))
    }, 30000)
    const onData = (d) => {
      const match = d.toString().match(/Local:\s+(http:\/\/localhost:\d+\/)/)
      if (match) {
        cleanup()
        resolve(match[1])
      }
    }
    const onExit = (code) => {
      cleanup()
      reject(new Error(`Vite exited (${code}) before printing a ready URL.`))
    }
    function cleanup() {
      clearTimeout(timer)
      viteProcess.stdout.off('data', onData)
      viteProcess.off('exit', onExit)
    }
    viteProcess.stdout.on('data', onData)
    viteProcess.on('exit', onExit)
  })
}

const PROFILE_PATH = join(app.getPath('userData'), 'profile.json')

ipcMain.on('profile:load', (event) => {
  event.returnValue = readProfile(PROFILE_PATH)
})
ipcMain.on('profile:save', (_event, key, value) => {
  try {
    writeProfile(PROFILE_PATH, { [key]: value })
  } catch (err) {
    console.error(`Could not save profile setting "${key}":`, err)
  }
})

async function createWindow() {
  vendorWasm()

  // Vite first, bridge second: the bridge only trusts WebSocket origins on
  // localhost:5173-5199 by default (see scripts/start.mjs's comment on the
  // same tradeoff), and Vite doesn't use a fixed port — it auto-increments
  // past 5173 on conflict. Waiting for Vite's actual URL before spawning the
  // bridge, and pinning JARVIS_ALLOWED_ORIGINS to that exact port, keeps the
  // handshake working even if the default trusted range is ever exhausted,
  // instead of hoping Vite happened to land inside it.
  const vite = run('vite', process.execPath, ['node_modules/vite/bin/vite.js'], {
    ELECTRON_RUN_AS_NODE: '1',
  })
  const url = await waitForViteUrl(vite)
  const { port } = new URL(url)
  run('bridge', 'node', ['bridge/server.mjs'], {
    JARVIS_PROFILE_PATH: PROFILE_PATH,
    JARVIS_ALLOWED_ORIGINS: `http://localhost:${port},http://127.0.0.1:${port}`,
  })

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'J.A.R.V.I.S.',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
    },
  })
  win.loadURL(url).catch((err) => console.error('Failed to load URL:', err))
}

app.whenReady().then(createWindow).catch((err) => {
  console.error('Failed to start:', err)
  crashOut()
})
app.on('window-all-closed', () => {
  shutdown()
  app.quit()
})
app.on('before-quit', shutdown)
process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())
