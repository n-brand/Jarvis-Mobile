import { BRIDGE_HTTP_URL } from '../config'
import { useStore } from '../store'

/**
 * Shared by the rail dropdown and the settings panel — both are manual,
 * agent-free ways to do what a wake word already does: flip the bridge's
 * `/voice` state and mirror it into the store for the transcript label,
 * standby hint and footer hint to read.
 */

export async function loadPersona(): Promise<void> {
  const res = await fetch(`${BRIDGE_HTTP_URL}/voice`)
  const s = (await res.json()) as { persona: string }
  useStore.getState().setPersona(s.persona)
}

/** Jarvis only offers male here — female stays reachable by voice command
 *  (ui_voice's gender param), just not as a manual control. Every other
 *  persona has exactly one fixed voice, so there is no gender to pin. */
export function switchPersona(persona: 'jarvis' | 'edith' | 'friday' | 'karen' | 'ultron'): void {
  const patch =
    persona === 'jarvis'
      ? { persona: 'jarvis' as const, gender: 'male' as const }
      : { persona }
  useStore.getState().setPersona(patch.persona)
  fetch(`${BRIDGE_HTTP_URL}/voice`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {})
}
