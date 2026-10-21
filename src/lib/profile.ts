/**
 * One settings API for both runtimes: under Electron, backed by the local
 * profile file (see electron/profile.mjs); under a plain browser tab
 * (`npm run dev`, no Electron), falls back to localStorage exactly as
 * every setting already worked before this file existed. Keeps
 * `npm run dev` working unchanged — see the plan's global constraints.
 */
declare global {
  interface Window {
    jarvisProfile?: {
      get(key: string): unknown
      set(key: string, value: unknown): void
    }
  }
}

export function getSetting<T>(key: string, fallback: T): T {
  if (window.jarvisProfile) {
    const v = window.jarvisProfile.get(key)
    return v === undefined ? fallback : (v as T)
  }
  const raw = localStorage.getItem(key)
  return raw === null ? fallback : (raw as unknown as T)
}

export function setSetting(key: string, value: unknown): void {
  if (window.jarvisProfile) {
    window.jarvisProfile.set(key, value)
    return
  }
  localStorage.setItem(key, String(value))
}

/**
 * Not just setSetting(key, undefined) — that would delete correctly on the
 * Electron side (JSON.stringify drops undefined properties), but the
 * browser-fallback branch would call localStorage.setItem(key,
 * String(undefined)), storing the four-character string "undefined" rather
 * than actually removing anything.
 */
export function removeSetting(key: string): void {
  if (window.jarvisProfile) {
    window.jarvisProfile.set(key, undefined)
    return
  }
  localStorage.removeItem(key)
}
