import { useEffect, useState } from 'react'
import { useStore, phaseColor, BRAND, type Phase } from '../store'
import { usingBridge } from '../lib/brain'
import { switchPersona } from '../lib/personaControl'
import { SPEECH_LANG, SPEECH_LANG_KEY, ANTHROPIC_KEY_SETTING, env } from '../config'
import { pinchCount } from '../lib/hands'
import { MOVES } from './GestureGuide'
import { sttWantsPremium, STT_PREF_KEY } from '../lib/voice'
import { ttsWantsPremium, TTS_PREF_KEY } from '../lib/tts'
import { uiLang, setUiLang, t, type Lang, type Localized } from '../lib/i18n'
import {
  EDGE_SCALE_KEY,
  CHAT_SCALE_KEY,
  PANEL_SCALE_KEY,
  SKIP_INTRO_KEY,
  storedScale,
  storedSkipIntro,
} from '../lib/prefs'
import { fetchClaudeUsage, fetchElevenLabsUsage, type ClaudeUsage, type ElevenLabsUsage } from '../lib/limits'
import { setSetting, removeSetting } from '../lib/profile'

type Tab = 'general' | 'apis' | 'keybinds' | 'names' | 'colors' | 'gestures' | 'limits'

/** Key/phrase → what it does, straight out of the README's controls table —
 *  view-only for now, nothing here changes a binding. */
const KEYBINDS: { key: string; does: { en: string; de: string } }[] = [
  {
    key: '"Hey Jarvis" / "Hey Edith" / "Hey Friday" / "Hey Karen" / "Ultron"',
    does: {
      en: 'Wakes him — only the name of whichever persona is already active works; switch persona with a spoken command instead',
      de: 'Weckt ihn — nur der Name der gerade aktiven Persona funktioniert; Persona wechseln geht per Sprachbefehl',
    },
  },
  {
    key: '(just speak)',
    does: { en: 'Interrupt him mid-sentence (barge-in)', de: 'Unterbricht ihn mitten im Satz (Barge-in)' },
  },
  {
    key: 'Enter / Space',
    does: {
      en: 'Open text input, to type instead of speak',
      de: 'Öffnet die Texteingabe, zum Tippen statt Sprechen',
    },
  },
  { key: 'L', does: { en: 'Talk without the wake word', de: 'Sprechen ohne Weckwort' } },
  {
    // Rewritten alongside the translation — this was stale, describing only
    // the pre-V-test browser-cycle behaviour.
    key: 'V',
    does: {
      en: 'Audition ElevenLabs voices (or cycle browser voices without a bridge)',
      de: 'ElevenLabs-Stimmen durchtesten (oder Browser-Stimmen wechseln ohne Bridge)',
    },
  },
  { key: 'G', does: { en: 'Toggle hand tracking / gestures', de: 'Handerkennung/Gesten ein-/ausschalten' } },
  {
    key: 'I / paste (Ctrl+V) / + button',
    does: {
      en: 'Attach an image or text/markdown file — I or the text box\'s + open a file picker, pasting works anywhere',
      de: 'Bild oder Text-/Markdown-Datei anhängen — I oder das + im Textfeld öffnen einen Dateidialog, Einfügen (Strg+V) geht überall',
    },
  },
  { key: 'Escape', does: { en: 'Stand down (standby)', de: 'Geht in Standby' } },
  { key: 'D', does: { en: 'Live diagnostics panel', de: 'Live-Diagnose-Panel' } },
  { key: 'T', does: { en: 'One-line audio self-test', de: 'Kurzer Audio-Selbsttest' } },
  {
    key: 'E',
    does: { en: 'Expand or collapse the front blade', de: 'Vorderste Blade aus-/einklappen' },
  },
  { key: 'X', does: { en: 'Close the front blade', de: 'Vorderste Blade schließen' } },
  { key: ']', does: { en: 'Cycle to the next blade', de: 'Zur nächsten Blade wechseln' } },
  { key: '[', does: { en: 'Cycle to the previous blade', de: 'Zur vorherigen Blade wechseln' } },
  { key: '→', does: { en: 'Skip the boot animation', de: 'Überspringt die Boot-Animation' } },
  { key: '↓', does: { en: 'Stand down — same as Escape', de: 'Standby — wie Escape' } },
  { key: '↑', does: { en: 'Open/close this settings panel', de: 'Öffnet/schließt dieses Einstellungs-Panel' } },
]

/** Every persona's name and what it means — an acronym expansion where one
 *  genuinely exists (JARVIS/EDITH/FRIDAY), a short descriptive line
 *  where it doesn't (KAREN/ULTRON are plain names in the films, not
 *  acronyms — no invented backronym here either). Always shown in English,
 *  since these are proper names rather than Schriftsprache-toggled
 *  descriptions (unlike KEYBINDS above). `translation` is a
 *  hand-written German rendering, not a literal one, shown only as a hover
 *  title.
 *
 * Split in two: AIS are switchable voice personas (a PERSONAS entry, a wake
 * word, their own manner) — PROJECTS are named JARVIS features/ideas that
 * are not personas at all, never switched to and with no voice of their
 * own. Pegasus/Veronica have no concept yet (see docs/personas.md); their
 * "meaning" says so honestly instead of inventing one early. */
const AIS: { mark: string; meaning: string; translation: string }[] = [
  {
    mark: BRAND.jarvis.mark,
    meaning: BRAND.jarvis.sub,
    translation: 'Einfach ein ziemlich sehr intelligentes System',
  },
  {
    mark: BRAND.edith.mark,
    meaning: BRAND.edith.sub,
    translation: 'Selbst tot bin ich noch der Held',
  },
  {
    mark: BRAND.friday.mark,
    meaning: BRAND.friday.sub,
    translation: 'Weiblicher Ersatz — Intelligenter Digitaler Jugend-Assistent',
  },
  {
    mark: BRAND.karen.mark,
    meaning: BRAND.karen.sub,
    translation: 'Peter Parkers Anzug-KI',
  },
  {
    mark: BRAND.ultron.mark,
    meaning: BRAND.ultron.sub,
    translation: 'Ultimatives Robotik-Netzwerk',
  },
]

const PROJECTS: { mark: string; meaning: string; translation: string }[] = [
  {
    mark: 'PEGASUS',
    meaning: 'Name only — nothing decided yet',
    translation: 'Nur ein Name — noch nichts entschieden',
  },
  {
    mark: 'VERONICA',
    meaning: 'Dropped once, reconsidering — no concept yet',
    translation: 'Einmal gestrichen, jetzt wieder aufgenommen — noch kein Konzept',
  },
]

/** Phase → short plain-language reason, for the colours reference tab. */
const PHASE_WHY: Record<Phase, { en: string; de: string }> = {
  offline: { en: 'Before you have clicked INITIALISE', de: 'Bevor INITIALISE angeklickt wurde' },
  boot: { en: 'Start-up sequence playing', de: 'Startsequenz läuft' },
  dormant: { en: 'Standby, waiting for the wake word', de: 'Standby, wartet auf das Weckwort' },
  waking: { en: 'Wake word just landed', de: 'Weckwort gerade erkannt' },
  listening: { en: 'Capturing what you are saying', de: 'Nimmt auf, was du sagst' },
  thinking: { en: 'Composing an answer', de: 'Formuliert eine Antwort' },
  tooling: { en: 'A tool is running', de: 'Ein Werkzeug läuft' },
  speaking: { en: 'Reading the answer back', de: 'Liest die Antwort vor' },
}

const PHASE_ORDER: Phase[] = [
  'offline', 'boot', 'dormant', 'waking', 'listening', 'thinking', 'tooling', 'speaking',
]

// Split left/right (free/paid) rather than one combined paragraph, so each
// description sits under the button it explains instead of under both. The
// "when does this apply" fact is the same regardless of which side you pick,
// so it isn't repeated in each half — see STT_APPLY_NOTE/TTS_APPLY_NOTE,
// rendered once, spanning both columns.
const STT_NOTE_FREE = {
  en: 'Free (Browser) runs entirely locally, with no quota at all, just somewhat less reliable.',
  de: 'Gratis (Browser) läuft komplett lokal, ohne jedes Kontingent, nur etwas weniger zuverlässig.',
}
const STT_NOTE_PAID = {
  en:
    'Premium (ElevenLabs) runs the whole time, including standby while ' +
    'waiting for the wake word — every recognised speech segment gets sent ' +
    'for transcription, not just a real "Hey Jarvis".',
  de:
    'Bezahlt (ElevenLabs) läuft die ganze Zeit mit, auch im Standby beim ' +
    'Warten auf das Weckwort — jedes erkannte Sprachsegment wird zur ' +
    'Transkription geschickt, nicht nur ein echtes "Hey Jarvis".',
}
const ANTHROPIC_KEY_NOTE: Localized = {
  en: 'Your own key from console.anthropic.com. Stored on this device only, never uploaded or built into the app — anyone with this device can use it, so set a spend limit in the console. Saving reloads the page.',
  de: 'Dein eigener Key von console.anthropic.com. Wird nur auf diesem Gerät gespeichert, nie hochgeladen oder in die App eingebaut — wer dieses Gerät hat, kann ihn nutzen, also in der Console ein Ausgabenlimit setzen. Speichern lädt die Seite neu.',
}
const STT_APPLY_NOTE: Localized = {
  en: 'Takes effect only after "Aktualisieren" below.',
  de: 'Wirkt erst nach "Aktualisieren" unten.',
}

const TTS_NOTE_FREE = {
  en: 'Free (Browser) uses your operating system\'s own voice: no quota at all, just a generic one, not the character\'s own.',
  de:
    'Gratis (Browser) nutzt die Stimme deines Betriebssystems: kein ' +
    'Kontingent, aber generisch, nicht die eigentliche Charakterstimme.',
}
const TTS_NOTE_PAID = {
  en:
    'Premium (ElevenLabs) is the actual character voice, generated fresh ' +
    'for every sentence — best quality, real cost per sentence.',
  de:
    'Bezahlt (ElevenLabs) ist die echte Charakterstimme, für jeden Satz ' +
    'frisch erzeugt — beste Qualität, echte Kosten pro Satz.',
}
const TTS_APPLY_NOTE: Localized = {
  en: 'Takes effect immediately, no reload needed.',
  de: 'Wirkt sofort, kein Neuladen nötig.',
}

const LIMITS_UNAVAILABLE: Localized = { en: 'not available', de: 'nicht verfügbar' }

const BROWSER_LIMIT_STATUS: Localized = {
  en: 'no account, no quota',
  de: 'kein Konto, kein Kontingent',
}

// Three short, separate notes instead of one combined paragraph — each sits
// directly under the row it explains, same idea as splitting the APIs tab's
// free/paid descriptions left and right.
const CLAUDE_LIMIT_NOTE: Localized = {
  en:
    'Read straight from the running session via an experimental Anthropic ' +
    'API that may change or disappear without notice — treat it as approximate.',
  de:
    'Direkt aus der laufenden Sitzung gelesen, über eine experimentelle ' +
    'Anthropic-API, die sich jederzeit ändern oder verschwinden kann — als ' +
    'Näherung verstehen.',
}
const ELEVEN_LIMIT_NOTE: Localized = {
  en: 'Your account\'s monthly character quota, shared by every ElevenLabs voice this app uses.',
  de:
    'Das monatliche Zeichen-Kontingent deines Accounts, geteilt von jeder ' +
    'hier genutzten ElevenLabs-Stimme.',
}
const BROWSER_LIMIT_NOTE: Localized = {
  en:
    'No risk of a long answer being blocked either: every reply is split ' +
    'sentence by sentence before being spoken, so the largest single ' +
    'request this app ever sends is about 220 characters — well under ' +
    'ElevenLabs\' 5,000-character limit for the model used here and ' +
    'Chrome\'s undocumented but real ceiling around 32,767.',
  de:
    'Auch kein Risiko, dass eine lange Antwort blockiert wird: jede Antwort ' +
    'wird vor dem Vorlesen satzweise zerlegt, die größte einzelne Anfrage ' +
    'dieser App liegt bei rund 220 Zeichen — deutlich unter ElevenLabs\' ' +
    '5.000-Zeichen-Limit für das hier genutzte Modell und Chromes ' +
    'unbelegtem, aber realem Limit um 32.767.',
}

function formatResetsAt(value: number | string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

/** Short qualifiers tacked onto a few General-tab row names — e.g.
 *  "Audioeingabe — restarts recognition" — are descriptions too, just
 *  shorter ones than STT_NOTE above, so they follow the same Schriftsprache
 *  toggle. Only the row's own name (Audioeingabe, Schriftsprache,
 *  Schriftgröße, Panel-Größe) stays fixed, same as a tab name. */
const AUDIO_IN_NOTE: Localized = { en: 'restarts recognition', de: 'Neustart der Erkennung' }
const TEXT_ONLY_NOTE: Localized = { en: 'typed questions only', de: 'nur bei getippten Fragen' }
const UI_LANG_NOTE: Localized = { en: 'descriptions only', de: 'nur Beschreibungen' }
const EDGE_SCALE_NOTE: Localized = { en: 'Edge', de: 'Rand' }
const CHAT_SCALE_NOTE: Localized = { en: 'Chat', de: 'Chat' }
const PANEL_SCALE_NOTE: Localized = { en: 'this window', de: 'dieses Fenster' }

/**
 * The settings panel — opened by ArrowUp or by telling him to open it
 * (`ui_settings` tool, App.tsx's watchUi 'settings' case). Same visual
 * language as a blade, but a real component with real controls: the blade
 * markup system is deliberately sanitised against forms and interactive
 * elements, so it can't host this.
 *
 * Three tabs: General (the actual controls), Keybinds and Colours (both
 * view-only references for now — nothing there is editable yet).
 *
 * Persona and both font-size sliders take effect immediately. Language is
 * the odd one out — the recogniser is a single long-lived loop started once
 * at boot (see voice.ts), not something safely torn down and rebuilt
 * mid-session, so changing it stores the choice and reloads the page. In
 * Jarvis Mobile nothing of the conversation is kept, so that reload also
 * starts a fresh one — the same as any other reload.
 */
export function Settings() {
  const open = useStore((s) => s.settingsOpen)
  const persona = useStore((s) => s.persona)
  const setOpen = useStore((s) => s.setSettingsOpen)
  const headphones = useStore((s) => s.headphones)
  const setHeadphones = useStore((s) => s.setHeadphones)
  const textOnly = useStore((s) => s.textOnly)
  const setTextOnly = useStore((s) => s.setTextOnly)
  const clearScreen = useStore((s) => s.clearScreen)
  // Real state, unlike SPEECH_LANG/sttPremium — this doesn't reload, so the
  // descriptions below have to update the instant this changes.
  const [lang, setLang] = useState<Lang>(uiLang)
  const changeUiLang = (v: Lang) => {
    setLang(v)
    setUiLang(v)
  }
  const [tab, setTab] = useState<Tab>('general')
  // Real state, unlike SPEECH_LANG's choice: picking Gratis/Bezahlt no longer
  // reloads immediately (see changeSttPremium), so the active highlight has
  // to update on its own, ahead of the separate "Aktualisieren" button.
  const [sttPremium, setSttPremium] = useState(sttWantsPremium)
  // Unlike sttPremium, a change here needs no "Aktualisieren" — see
  // changeTtsPremium below.
  const [ttsPremium, setTtsPremium] = useState(ttsWantsPremium)
  /** 'loading' while a fetch for the Limits tab is in flight; null once
   *  settled with nothing to show (unavailable, no key, or the request
   *  failed) — the panel treats every one of those reasons the same way. */
  const [claudeUsage, setClaudeUsage] = useState<ClaudeUsage | 'loading'>('loading')
  const [elevenUsage, setElevenUsage] = useState<ElevenLabsUsage | 'loading' | null>('loading')
  const [edgeScale, setEdgeScale] = useState(() => storedScale(EDGE_SCALE_KEY))
  const [chatScale, setChatScale] = useState(() => storedScale(CHAT_SCALE_KEY))
  const [panelScale, setPanelScale] = useState(() => storedScale(PANEL_SCALE_KEY))
  /** The slider's own position — separate from `panelScale` (the value
   *  actually applied to --panel-scale) because resizing the whole panel on
   *  every tick of the slider reads as janky rather than smooth. This one
   *  only takes effect on "Speichern"; every other control here still
   *  applies immediately. */
  const [panelScaleDraft, setPanelScaleDraft] = useState(panelScale)
  /** Whether a fresh boot should skip the intro animation. Read directly
   *  by App.tsx's powerOn() at the moment it boots — not reactive, so it
   *  lives here as a plain preference rather than in the store. Persists
   *  across reloads (including a plain F5), and across a full Electron
   *  restart too, for free — see src/lib/profile.ts. */
  const [skipIntro, setSkipIntro] = useState(storedSkipIntro)
  /** Where the user has dragged the panel to, from its centred rest position. */
  const [pos, setPos] = useState({ x: 0, y: 0 })
  /** The Claude API key being typed on the direct path. Never pre-filled with
   *  the stored one — the field only ever writes, so a saved key is not put
   *  back on screen. Applying it reloads, the same as the STT engine switch:
   *  the API client is built once, at load. */
  const [keyDraft, setKeyDraft] = useState('')

  useEffect(() => {
    document.documentElement.style.setProperty('--edge-scale', String(edgeScale))
  }, [edgeScale])
  useEffect(() => {
    document.documentElement.style.setProperty('--chat-scale', String(chatScale))
  }, [chatScale])
  useEffect(() => {
    document.documentElement.style.setProperty('--panel-scale', String(panelScale))
  }, [panelScale])
  // Fetched fresh every time the Limits tab is opened, not once at mount —
  // both numbers can move between visits and there is no live push for
  // either, unlike the rest of this panel.
  useEffect(() => {
    if (tab !== 'limits') return
    setClaudeUsage('loading')
    setElevenUsage('loading')
    fetchClaudeUsage().then(setClaudeUsage)
    fetchElevenLabsUsage()
      .then(setElevenUsage)
      .catch(() => setElevenUsage(null))
  }, [tab])
  if (!open) return null

  const saveAnthropicKey = () => {
    const key = keyDraft.trim()
    if (!key) return
    setSetting(ANTHROPIC_KEY_SETTING, key)
    location.reload()
  }
  const forgetAnthropicKey = () => {
    removeSetting(ANTHROPIC_KEY_SETTING)
    location.reload()
  }

  const changeEdgeScale = (v: number) => {
    setEdgeScale(v)
    setSetting(EDGE_SCALE_KEY, String(v))
  }
  const changeChatScale = (v: number) => {
    setChatScale(v)
    setSetting(CHAT_SCALE_KEY, String(v))
  }
  const savePanelScale = () => {
    setPanelScale(panelScaleDraft)
    setSetting(PANEL_SCALE_KEY, String(panelScaleDraft))
  }

  const changeSkipIntro = (v: boolean) => {
    setSkipIntro(v)
    setSetting(SKIP_INTRO_KEY, String(v))
  }

  const clearHistory = () => clearScreen('transcript')
  const changeLang = (lang: 'de-DE' | 'en-GB') => {
    if (lang === SPEECH_LANG) return
    setSetting(SPEECH_LANG_KEY, lang)
    location.reload()
  }

  /** Unlike language, doesn't reload immediately — just updates the
   *  highlight and the saved setting. voice.ts's startVoice() still only reads
   *  this once at boot, so it has no effect until the "Aktualisieren"
   *  button below (or any other reload) actually applies it. */
  const changeSttPremium = (v: boolean) => {
    setSttPremium(v)
    setSetting(STT_PREF_KEY, String(v))
  }

  /** Unlike changeSttPremium, this one is live: tts.ts's synthesise() reads
   *  ttsWantsPremium() fresh for every sentence rather than once at boot, so
   *  there is no loop to tear down and rebuild — the very next line spoken
   *  already uses the new choice. */
  const changeTtsPremium = (v: boolean) => {
    setTtsPremium(v)
    setSetting(TTS_PREF_KEY, String(v))
  }

  /**
   * Drag start, header only. Listens on `window` rather than the header
   * itself — same reasoning as Blades.tsx's `grab`: the hand-tracking layer
   * dispatches synthetic pointer events aimed with `elementFromPoint`, so one
   * pixel into a drag the cursor is no longer over the element that started
   * it. `window` sees mouse, touch and a synthetic hand identically.
   */
  const onHeadDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    e.stopPropagation()
    let baseX = e.clientX
    let baseY = e.clientY
    let dx = 0
    let dy = 0
    const from = { ...pos }

    const move = (ev: PointerEvent) => {
      // Two hands pinching is someone doing something else two-handed, not a
      // drag — re-anchor instead of bailing so releasing one hand doesn't
      // snap the panel by however far the other hand moved meanwhile.
      if (ev.pointerType === 'touch' && pinchCount() > 1) {
        baseX = ev.clientX - dx
        baseY = ev.clientY - dy
        return
      }
      dx = ev.clientX - baseX
      dy = ev.clientY - baseY
      setPos({ x: from.x + dx, y: from.y + dy })
    }
    const done = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)
  }

  return (
    <div
      className="settings-panel"
      style={{
        transform: `translateX(calc(-50% + ${pos.x}px)) translateY(${pos.y}px) scale(var(--panel-scale, 1))`,
      }}
    >
      <span className="pk pk-tl" />
      <span className="pk pk-tr" />
      <span className="pk pk-bl" />
      <span className="pk pk-br" />

      <header className="settings-head" onPointerDown={onHeadDown}>
        <span>SETTINGS</span>
        <button className="bl-btn" onClick={() => setOpen(false)} title="Close (↑)">
          ✕
        </button>
      </header>

      <div className="settings-main">
      <nav className="settings-tabs">
        <button
          className={`settings-tab${tab === 'general' ? ' active' : ''}`}
          onClick={() => setTab('general')}
        >
          GENERAL
        </button>
        <button
          className={`settings-tab${tab === 'apis' ? ' active' : ''}`}
          onClick={() => setTab('apis')}
        >
          APIS
        </button>
        <button
          className={`settings-tab${tab === 'keybinds' ? ' active' : ''}`}
          onClick={() => setTab('keybinds')}
        >
          KEYBINDS
        </button>
        <button
          className={`settings-tab${tab === 'names' ? ' active' : ''}`}
          onClick={() => setTab('names')}
        >
          NAMES
        </button>
        <button
          className={`settings-tab${tab === 'gestures' ? ' active' : ''}`}
          onClick={() => setTab('gestures')}
        >
          GESTURES
        </button>
        <button
          className={`settings-tab${tab === 'colors' ? ' active' : ''}`}
          onClick={() => setTab('colors')}
        >
          COLORS
        </button>
        <button
          className={`settings-tab${tab === 'limits' ? ' active' : ''}`}
          onClick={() => setTab('limits')}
        >
          LIMITS
        </button>
      </nav>

      {tab === 'general' && (
        <div className="settings-body">
          {usingBridge && (
            <div className="settings-row">
              <span className="settings-label">Stimme</span>
              <div className="settings-choices">
                <button
                  className={`settings-choice${persona === 'jarvis' ? ' active' : ''}`}
                  onClick={() => switchPersona('jarvis')}
                >
                  J.A.R.V.I.S.
                </button>
                <button
                  className={`settings-choice${persona === 'edith' ? ' active' : ''}`}
                  onClick={() => switchPersona('edith')}
                >
                  E.D.I.T.H.
                </button>
                <button
                  className={`settings-choice${persona === 'friday' ? ' active' : ''}`}
                  onClick={() => switchPersona('friday')}
                >
                  F.R.I.D.A.Y.
                </button>
                <button
                  className={`settings-choice${persona === 'karen' ? ' active' : ''}`}
                  onClick={() => switchPersona('karen')}
                >
                  KAREN
                </button>
                <button
                  className={`settings-choice${persona === 'ultron' ? ' active' : ''}`}
                  onClick={() => switchPersona('ultron')}
                >
                  ULTRON
                </button>
              </div>
            </div>
          )}

          <div className="settings-row">
            <span className="settings-label">Audioausgabe</span>
            <div className="settings-choices">
              <button
                className={`settings-choice${headphones ? ' active' : ''}`}
                onClick={() => setHeadphones(true)}
              >
                Kopfhörer
              </button>
              <button
                className={`settings-choice${!headphones ? ' active' : ''}`}
                onClick={() => setHeadphones(false)}
              >
                Freisprechanlage
              </button>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Schreibmodus — {t(TEXT_ONLY_NOTE, lang)}</span>
            <div className="settings-choices">
              <button
                className={`settings-choice${!textOnly ? ' active' : ''}`}
                onClick={() => setTextOnly(false)}
              >
                Auch vorlesen
              </button>
              <button
                className={`settings-choice${textOnly ? ' active' : ''}`}
                onClick={() => setTextOnly(true)}
              >
                Nur schreiben
              </button>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Audioeingabe — {t(AUDIO_IN_NOTE, lang)}</span>
            <div className="settings-choices">
              <button
                className={`settings-choice${SPEECH_LANG === 'en-GB' ? ' active' : ''}`}
                onClick={() => changeLang('en-GB')}
              >
                English
              </button>
              <button
                className={`settings-choice${SPEECH_LANG === 'de-DE' ? ' active' : ''}`}
                onClick={() => changeLang('de-DE')}
              >
                Deutsch
              </button>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Schriftsprache — {t(UI_LANG_NOTE, lang)}</span>
            <div className="settings-choices">
              <button
                className={`settings-choice${lang === 'en' ? ' active' : ''}`}
                onClick={() => changeUiLang('en')}
              >
                English
              </button>
              <button
                className={`settings-choice${lang === 'de' ? ' active' : ''}`}
                onClick={() => changeUiLang('de')}
              >
                Deutsch
              </button>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Schriftgröße ({t(EDGE_SCALE_NOTE, lang)})</span>
            <input
              className="settings-slider"
              type="range"
              min={0.7}
              max={1.8}
              step={0.05}
              value={edgeScale}
              onChange={(e) => changeEdgeScale(Number(e.target.value))}
            />
          </div>

          <div className="settings-row">
            <span className="settings-label">Schriftgröße ({t(CHAT_SCALE_NOTE, lang)})</span>
            <input
              className="settings-slider"
              type="range"
              min={0.7}
              max={1.8}
              step={0.05}
              value={chatScale}
              onChange={(e) => changeChatScale(Number(e.target.value))}
            />
          </div>

          <div className="settings-row">
            <span className="settings-label">Panel-Größe ({t(PANEL_SCALE_NOTE, lang)})</span>
            <div className="settings-inline">
              <input
                className="settings-slider settings-slider-inline"
                type="range"
                min={0.85}
                max={1.2}
                step={0.05}
                value={panelScaleDraft}
                onChange={(e) => setPanelScaleDraft(Number(e.target.value))}
              />
              <button className="settings-choice settings-choice-save" onClick={savePanelScale}>
                Speichern
              </button>
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Verlauf</span>
            <button className="settings-choice" onClick={clearHistory}>
              Chatverlauf löschen
            </button>
          </div>

          <div className="settings-row">
            <span className="settings-label">Beim Start</span>
            <div className="settings-choices">
              <button
                className={`settings-choice${!skipIntro ? ' active' : ''}`}
                onClick={() => changeSkipIntro(false)}
              >
                Intro abspielen
              </button>
              <button
                className={`settings-choice${skipIntro ? ' active' : ''}`}
                onClick={() => changeSkipIntro(true)}
              >
                Intro überspringen
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'apis' && (
        <div className="settings-body">
          {!usingBridge && (
            <>
              <div className="settings-row">
                <span className="settings-label">
                  Claude API-Key {env.anthropicKey ? '(gespeichert)' : '(fehlt)'}
                </span>
                <div className="settings-inline">
                  <input
                    className="settings-key-input"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={env.anthropicKey ? 'Neuen Key einfügen' : 'sk-ant-…'}
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveAnthropicKey()}
                  />
                  <button
                    className="settings-choice settings-choice-save"
                    onClick={saveAnthropicKey}
                    disabled={!keyDraft.trim()}
                  >
                    Speichern
                  </button>
                  {env.anthropicKey && (
                    <button className="settings-choice" onClick={forgetAnthropicKey}>
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
              <p className="settings-note settings-note-shared">{t(ANTHROPIC_KEY_NOTE, lang)}</p>
            </>
          )}
          <div className="settings-row">
            <span className="settings-label">Zuhören (Spracherkennung)</span>
            <div className="settings-choices">
              <button
                className={`settings-choice${!sttPremium ? ' active' : ''}`}
                onClick={() => changeSttPremium(false)}
              >
                Gratis (Browser)
              </button>
              <button
                className={`settings-choice${sttPremium ? ' active' : ''}`}
                onClick={() => changeSttPremium(true)}
              >
                Bezahlt (ElevenLabs)
              </button>
            </div>
          </div>
          <div className="settings-note-pair">
            <p className="settings-note">{t(STT_NOTE_FREE, lang)}</p>
            <p className="settings-note">{t(STT_NOTE_PAID, lang)}</p>
          </div>
          <p className="settings-note settings-note-shared">{t(STT_APPLY_NOTE, lang)}</p>

          <div className="settings-row">
            <span className="settings-label">Sprechen (Sprachausgabe)</span>
            <div className="settings-choices">
              <button
                className={`settings-choice${!ttsPremium ? ' active' : ''}`}
                onClick={() => changeTtsPremium(false)}
              >
                Gratis (Browser)
              </button>
              <button
                className={`settings-choice${ttsPremium ? ' active' : ''}`}
                onClick={() => changeTtsPremium(true)}
              >
                Bezahlt (ElevenLabs)
              </button>
            </div>
          </div>
          <div className="settings-note-pair">
            <p className="settings-note">{t(TTS_NOTE_FREE, lang)}</p>
            <p className="settings-note">{t(TTS_NOTE_PAID, lang)}</p>
          </div>
          <p className="settings-note settings-note-shared">{t(TTS_APPLY_NOTE, lang)}</p>

          <div className="settings-row">
            <button className="settings-choice" onClick={() => location.reload()}>
              Aktualisieren
            </button>
          </div>
        </div>
      )}

      {tab === 'keybinds' && (
        <div className="settings-body">
          <div className="settings-list">
            {KEYBINDS.map((k) => (
              <div className="settings-list-row" key={k.key}>
                <span className="settings-key">{k.key}</span>
                <span className="settings-list-does">{t(k.does, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'names' && (
        <div className="settings-body">
          <span className="settings-label">AIs</span>
          <div className="settings-list">
            {AIS.map((n) => (
              <div className="settings-list-row" key={n.mark}>
                <span className="settings-key">{n.mark}</span>
                <span className="settings-list-does" title={n.translation}>
                  {n.meaning}
                </span>
              </div>
            ))}
          </div>

          <span className="settings-label">Projekte</span>
          <div className="settings-list">
            {PROJECTS.map((n) => (
              <div className="settings-list-row" key={n.mark}>
                <span className="settings-key">{n.mark}</span>
                <span className="settings-list-does" title={n.translation}>
                  {n.meaning}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'gestures' && (
        <div className="settings-body">
          <div className="settings-list">
            {MOVES.map((m) => (
              <div className="settings-list-row" key={m.gesture}>
                <span className="settings-key">
                  {m.hand} {m.gesture}
                </span>
                <span className="settings-list-does">{t(m.does, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'colors' && (
        <div className="settings-body">
          <div className="settings-list">
            {PHASE_ORDER.map((p) => (
              <div className="settings-list-row" key={p}>
                <span className="settings-swatch" style={{ background: phaseColor[p] }} />
                <span className="settings-key">{p}</span>
                <span className="settings-list-does">{t(PHASE_WHY[p], lang)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'limits' && (
        <div className="settings-body">
          <div className="settings-list">
            <div className="settings-list-row">
              <span className="settings-key">Claude</span>
              <span className="settings-list-does">
                {claudeUsage === 'loading'
                  ? '…'
                  : claudeUsage?.fiveHour?.utilization != null
                    ? `${Math.round(claudeUsage.fiveHour.utilization)}%`
                    : t(LIMITS_UNAVAILABLE, lang)}
              </span>
            </div>
          </div>
          <p className="settings-note">{t(CLAUDE_LIMIT_NOTE, lang)}</p>

          <div className="settings-list">
            <div className="settings-list-row">
              <span className="settings-key">ElevenLabs</span>
              <span className="settings-list-does">
                {elevenUsage === 'loading'
                  ? '…'
                  : elevenUsage
                    ? `${elevenUsage.used.toLocaleString()} / ${elevenUsage.limit.toLocaleString()}` +
                      (elevenUsage.resetsAt ? ` · ${formatResetsAt(elevenUsage.resetsAt)}` : '')
                    : t(LIMITS_UNAVAILABLE, lang)}
              </span>
            </div>
          </div>
          <p className="settings-note">{t(ELEVEN_LIMIT_NOTE, lang)}</p>

          <div className="settings-list">
            <div className="settings-list-row">
              <span className="settings-key">Browser</span>
              <span className="settings-list-does">{t(BROWSER_LIMIT_STATUS, lang)}</span>
            </div>
          </div>
          <p className="settings-note">{t(BROWSER_LIMIT_NOTE, lang)}</p>
        </div>
      )}
      </div>

      <footer className="settings-credits">
        <span>
          {t({ en: 'Created by Nicolas Brand', de: 'Erstellt von Nicolas Brand' }, lang)}
        </span>
        <span className="settings-credits-fnb" title="From Nicolas Brand">
          F.N.B.
        </span>
      </footer>
    </div>
  )
}
