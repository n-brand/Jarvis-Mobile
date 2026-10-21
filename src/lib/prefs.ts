/**
 * The General-tab sliders/toggles that are plain localStorage (plus a CSS
 * variable for the two text-size sliders and the panel-size one) — no
 * reload, no global store. Settings.tsx keeps its own reactive local state
 * for the widgets themselves and reads/writes through the key constants and
 * reader functions here, so the key names exist in exactly one place.
 * App.tsx's ui_prefs handler (a spoken "make the text bigger") calls the
 * setters directly, since it has no component state of its own to keep in
 * sync with a slider handle.
 */
import { getSetting, setSetting } from './profile'

export const EDGE_SCALE_KEY = 'jarvis.edgeScale'
export const CHAT_SCALE_KEY = 'jarvis.chatScale'
export const PANEL_SCALE_KEY = 'jarvis.panelScale'
export const SKIP_INTRO_KEY = 'jarvis.skipIntro'

export function storedScale(key: string): number {
  const raw = getSetting<string | null>(key, null)
  const n = raw ? Number(raw) : 1
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function storedSkipIntro(): boolean {
  return getSetting<string>(SKIP_INTRO_KEY, 'false') === 'true'
}

export function setEdgeScale(v: number): void {
  document.documentElement.style.setProperty('--edge-scale', String(v))
  setSetting(EDGE_SCALE_KEY, String(v))
}

export function setChatScale(v: number): void {
  document.documentElement.style.setProperty('--chat-scale', String(v))
  setSetting(CHAT_SCALE_KEY, String(v))
}

export function setPanelScale(v: number): void {
  document.documentElement.style.setProperty('--panel-scale', String(v))
  setSetting(PANEL_SCALE_KEY, String(v))
}

export function setSkipIntro(v: boolean): void {
  setSetting(SKIP_INTRO_KEY, String(v))
}
