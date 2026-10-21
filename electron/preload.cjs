// CommonJS, not ESM — Electron's sandboxed preload loader (default since v20) can't load ESM, only require(). Forced by Electron, not a style choice — see the rest of this project's .mjs convention.
const { contextBridge, ipcRenderer } = require('electron')

const cache = ipcRenderer.sendSync('profile:load')

contextBridge.exposeInMainWorld('jarvisProfile', {
  get(key) {
    return cache[key]
  },
  set(key, value) {
    cache[key] = value
    ipcRenderer.send('profile:save', key, value)
  },
})
