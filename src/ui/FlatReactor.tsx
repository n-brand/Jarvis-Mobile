import { useEffect, useRef } from 'react'
import { useStore, type Phase } from '../store'

/**
 * The flat stand-in for the 3D scene (src/scene), used when LOOK is 'flat'
 * (src/lib/look.ts). Same drawing as the JARVIS card on the portfolio: a red
 * tile with a dark edge, a cyan reactor — dashed outer ring, solid inner ring,
 * white core, glow — and sound-wave bars either side.
 *
 * Like the 3D Rig it reads phase and level imperatively once per frame and
 * writes them onto the DOM (a CSS variable and a data attribute) rather than
 * re-rendering React sixty times a second. Everything that moves is CSS.
 */

/** The card's bars, outermost first — heights from the portfolio SVG. */
const BARS = [16, 36, 24, 12]

const BADGE: Record<Phase, string> = {
  offline: 'AUS',
  boot: 'START',
  dormant: 'STANDBY',
  waking: 'BEREIT',
  listening: 'HÖRT ZU',
  thinking: 'DENKT NACH',
  tooling: 'ARBEITET',
  speaking: 'SPRICHT',
}

export function FlatReactor() {
  const root = useRef<HTMLDivElement>(null)
  const bars = useRef<(SVGRectElement | null)[]>([])
  const badge = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let shown = 0
    let lastPhase: Phase | null = null
    const tick = (now: number) => {
      const { phase, level } = useStore.getState()
      // Fast attack, slower release — reads as a voice rather than a flicker.
      shown += (level - shown) * (level > shown ? 0.5 : 0.12)
      const el = root.current
      if (el) {
        el.style.setProperty('--lvl', shown.toFixed(3))
        if (phase !== lastPhase) {
          el.dataset.phase = phase
          if (badge.current) badge.current.textContent = BADGE[phase]
          lastPhase = phase
        }
      }
      // Each bar wobbles on its own beat; the level decides how far. A little
      // idle movement stays so the card never looks frozen.
      const t = now / 1000
      bars.current.forEach((bar, i) => {
        if (!bar) return
        const beat = 0.5 + 0.5 * Math.sin(t * (5 + (i % 4) * 1.7) + i * 1.3)
        const s = 0.3 + 0.12 * beat + shown * (0.6 + 0.9 * beat)
        bar.style.transform = `scaleY(${Math.min(1.6, s).toFixed(3)})`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Left side outermost-first from x=22, mirrored on the right — the card's
  // own layout, 12 units apart.
  const barRects = [
    ...BARS.map((h, i) => ({ x: 22 + i * 12, h })),
    ...BARS.map((h, i) => ({ x: 212 - i * 12, h })),
  ]

  return (
    <div className="flat-scene" ref={root} data-phase="offline">
      <div className="flat-card">
        <span className="flat-badge" ref={badge}>
          {BADGE.offline}
        </span>
        <svg className="flat-art" viewBox="0 0 240 140" aria-hidden="true">
          <defs>
            <radialGradient id="flat-glow">
              <stop offset="0" stopColor="#4dd4ff" stopOpacity=".7" />
              <stop offset="1" stopColor="#4dd4ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle className="flat-glow" cx="120" cy="70" r="66" fill="url(#flat-glow)" />
          <circle
            className="flat-ring"
            cx="120"
            cy="70"
            r="40"
            fill="none"
            stroke="#4dd4ff"
            strokeWidth="4"
            strokeDasharray="16 8"
          />
          <circle className="flat-inner" cx="120" cy="70" r="26" fill="none" stroke="#a5ecff" strokeWidth="3" />
          <circle className="flat-core" cx="120" cy="70" r="12" fill="#e9fbff" />
          <g fill="#4dd4ff">
            {barRects.map((b, i) => (
              <rect
                key={i}
                ref={(el) => {
                  bars.current[i] = el
                }}
                className="flat-bar"
                x={b.x}
                y={70 - b.h / 2}
                width="6"
                height={b.h}
                rx="3"
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}
