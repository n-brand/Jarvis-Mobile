/**
 * The one local settings file — window layout (a later phase), device
 * settings, and (via the bridge) persona/voice choice. Lives outside the
 * repo (see the caller in main.mjs, which resolves the path from
 * Electron's userData directory) so it can never cross devices through
 * git.
 *
 * Missing or corrupted reads the same way — both just mean "nothing saved
 * yet" — same pattern bridge/server.mjs already uses for context.md and
 * places.md.
 */
import { readFileSync, writeFileSync } from 'node:fs'

export function readProfile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Not safe against two OS processes writing at once — this file is also
 * written by the bridge process (see bridge/server.mjs's persona/voice
 * persistence), and a near-simultaneous write from both can silently drop
 * one side's change (last write wins, no merge across the gap). Accepted
 * for a single-user local settings file: worst case is re-setting one
 * value, not corruption — not worth file locking over.
 */
export function writeProfile(path, patch) {
  const current = readProfile(path)
  writeFileSync(path, JSON.stringify({ ...current, ...patch }, null, 2))
}
