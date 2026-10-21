import { getSetting, setSetting } from './profile'

/**
 * Which face JARVIS wears.
 *
 *   'reactor' — the original: 3D reactor (src/scene) and the cyan HUD.
 *   'flat'    — test look in the style of the portfolio
 *               (n-brand.github.io/portfolio): flat reactor card, Nunito,
 *               yellow buttons with a dark edge. Nothing of the original is
 *               removed; this only swaps what is drawn.
 *
 * Chosen once at load, like the speech language: `?look=flat` / `?look=reactor`
 * in the URL sets and remembers it, the settings panel does the same and
 * reloads. The value lands on <html data-look> so the stylesheet can scope the
 * flat overrides under `[data-look='flat']`.
 */
export type Look = 'reactor' | 'flat'

export const LOOK_KEY = 'jarvis.look'

function resolve(): Look {
  const fromUrl = new URLSearchParams(location.search).get('look')
  if (fromUrl === 'flat' || fromUrl === 'reactor') {
    setSetting(LOOK_KEY, fromUrl)
    return fromUrl
  }
  return getSetting<string>(LOOK_KEY, 'reactor') === 'flat' ? 'flat' : 'reactor'
}

export const LOOK: Look = resolve()
document.documentElement.dataset.look = LOOK

export function setLook(look: Look): void {
  setSetting(LOOK_KEY, look)
  // Drop a ?look= that would otherwise win again on the reload.
  const url = new URL(location.href)
  url.searchParams.delete('look')
  location.replace(url.toString())
}
