import { BRIDGE_HTTP_URL } from '../config'
import { watchClaudeUsage, requestClaudeUsage } from './brain'

/**
 * The Settings panel's Limits tab — three unrelated ceilings, each read a
 * completely different way:
 *
 *   Claude's 5-hour window   — asked of the bridge's own agent session over
 *                              the socket, see fetchClaudeUsage() below.
 *   ElevenLabs character quota — a plain GET against the bridge, which holds
 *                              the key; see fetchElevenLabsUsage() below.
 *   The browser's own speech engine — no account, no quota to ask about, so
 *                              there is nothing to fetch. Settings.tsx shows
 *                              fixed reference text for this one instead.
 */

export type ElevenLabsUsage = {
  used: number
  limit: number
  /** Epoch ms, or null if ElevenLabs didn't report one. */
  resetsAt: number | null
}

/** A plain GET, unlike /tts and /stt — this is about the account as a whole,
 *  not any one piece of audio, so there is no voiceId/turn to thread through.
 *  Throws on any failure (no key configured, network, a non-200); the caller
 *  decides how to show that. */
export async function fetchElevenLabsUsage(): Promise<ElevenLabsUsage> {
  const res = await fetch(`${BRIDGE_HTTP_URL}/usage/elevenlabs`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export type ClaudeUsage = {
  /** 'pro' | 'max' | 'team' | 'enterprise', or null off the API/key path. */
  subscriptionType: string | null
  fiveHour: { utilization: number | null; resetsAt: string | null } | null
} | null

/**
 * One-shot: fires the request and resolves with whatever the bridge answers
 * first, or null after a short timeout — an older bridge build, a session
 * that isn't a claude.ai subscription, or one that's simply slow to reply
 * all look the same from here, and the panel shows "not available" for all
 * of them rather than guessing at a reason.
 *
 * Registers its own listener rather than sharing a caller's: only one Limits
 * tab can be open at a time, so there is never a second, stale registration
 * waiting on an answer nobody asked for any more.
 */
export function fetchClaudeUsage(): Promise<ClaudeUsage> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000)
    watchClaudeUsage((data, error) => {
      clearTimeout(timer)
      if (error || !data) {
        resolve(null)
        return
      }
      const d = data as {
        subscription_type?: string | null
        rate_limits_available?: boolean
        rate_limits?: {
          five_hour?: { utilization: number | null; resets_at: string | null } | null
        } | null
      }
      const fiveHour = d.rate_limits?.five_hour
      resolve(
        d.rate_limits_available
          ? {
              subscriptionType: d.subscription_type ?? null,
              fiveHour: fiveHour
                ? { utilization: fiveHour.utilization, resetsAt: fiveHour.resets_at }
                : null,
            }
          : null,
      )
    })
    requestClaudeUsage()
  })
}
