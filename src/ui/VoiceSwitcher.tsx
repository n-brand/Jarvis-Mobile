import { useEffect, useState } from 'react'
import { usingBridge } from '../lib/brain'
import { loadPersona, switchPersona } from '../lib/personaControl'
import { useStore, BRAND } from '../store'

/**
 * The persona picker, disguised as the brand wordmark itself.
 *
 * Used to be a separate dropdown in the SYSTEMS rail, styled to look like a
 * normal `<select>`. Moved into the wordmark instead and stripped of every
 * bit of native select chrome (border, background, arrow) so at rest it
 * reads as plain branded text — "J.A.R.V.I.S." just sitting there — and the
 * fact that it opens a picker only shows up as a pointer cursor on hover.
 * One control instead of two, and no separate element competing with the
 * wordmark for attention.
 *
 * Falls back to a plain, non-interactive span before the bridge's current
 * persona has loaded (or on the direct/no-bridge path, where there is no
 * `/voice` endpoint to switch against at all) — the wordmark must never
 * flash empty just because this hasn't resolved yet.
 *
 * Reads its selected value from the shared store's `persona`, the same field
 * the transcript label, standby hint and footer hint read — not its own
 * local copy. A wake word ("Hey Edith") updates that same field from
 * App.tsx's onWake, so this has to follow it rather than only its own
 * onChange, or the two go out of sync the moment a wake switches persona
 * without touching this control at all.
 */
export function VoiceSwitcher() {
  const persona = useStore((s) => s.persona)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!usingBridge) return
    loadPersona()
      .then(() => setLoaded(true))
      .catch(() => {})
  }, [])

  const mark = (BRAND[persona] ?? BRAND.jarvis).mark

  if (!usingBridge || !loaded) {
    return <span className="brand-mark">{mark}</span>
  }

  return (
    <select
      className="brand-mark brand-select"
      value={persona}
      onChange={(e) =>
        switchPersona(e.target.value as 'jarvis' | 'edith' | 'friday' | 'karen' | 'ultron')
      }
    >
      <option value="jarvis">{BRAND.jarvis.mark}</option>
      <option value="edith">{BRAND.edith.mark}</option>
      <option value="friday">{BRAND.friday.mark}</option>
      <option value="karen">{BRAND.karen.mark}</option>
      <option value="ultron">{BRAND.ultron.mark}</option>
    </select>
  )
}
