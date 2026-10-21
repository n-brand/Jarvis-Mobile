import { useEffect, useRef } from 'react'
import { Scene } from './scene/Scene'
import { Hud } from './ui/Hud'
import { Boot } from './ui/Boot'
import { Ignition } from './ui/Ignition'
import { Diagnostics } from './ui/Diagnostics'
import { TextInput } from './ui/TextInput'
import { readAttachment, fileFromClipboard, type Attachment } from './lib/attachments'
import { useStore } from './store'
import { startVoice, type Voice, type VoiceMode, WAKE_NAME_ALTERNATIVES } from './lib/voice'
import { createSpeaker, cycleVoice, currentVoiceName, TTS_PREF_KEY, type Speaker } from './lib/tts'
import * as sfx from './lib/sfx'
import * as music from './lib/music'
import * as hands from './lib/hands'
import { listenForClap } from './lib/clap'
import * as camera from './lib/camera'
import * as kokoro from './lib/kokoro'
import { TTS_ENGINE, BRIDGE_HTTP_URL } from './config'
import { forTool, attention, stillOffline } from './lib/fillers'
import {
  ask,
  warm,
  interrupt,
  watchServers,
  watchPanels,
  watchBlades,
  watchCapture,
  watchUi,
  watchConnection,
  connectedLabels,
  usingBridge,
  isConnected,
  type Msg,
} from './lib/brain'
import { startAnalyser, micLevel } from './lib/audio'
import { probeCapabilities } from './lib/capabilities'
import { env, SPEECH_LANG_KEY } from './config'
import { STT_PREF_KEY } from './lib/voice'
import { setUiLang } from './lib/i18n'
import { setEdgeScale, setChatScale, setPanelScale, setSkipIntro } from './lib/prefs'
import { getSetting, setSetting } from './lib/profile'

/**
 * The conversation.
 *
 * This used to be a sequential loop — greet, await a capture, await an answer,
 * repeat — with the microphone opened and closed around each step. That shape
 * cannot be interrupted: while it is awaiting the answer, nothing is listening,
 * so there is no way for the user to get a word in.
 *
 * It is an event machine now. The voice loop runs continuously and pushes
 * events at us; every one of them is legal in every phase. Saying anything at
 * all stops him talking, and whatever you say next becomes the new turn.
 */

/** How long to wait for someone to start speaking after he wakes. Generous:
 *  people say his name and *then* think about what they wanted. */
const AWAIT_SPEECH_MS = 14000

/** After an answer, how long the mic stays open for a follow-up before he
 *  drops back to standby. Long enough that you don't have to say the name
 *  again to continue a thought. */
const FOLLOW_UP_MS = 11000

/** crypto.randomUUID needs a secure context, which a LAN address over plain
 *  http is not. Not worth failing a whole turn over an id. */
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `id${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`

/** Stands in for createSpeaker() when a typed question is answered in
 *  text-only mode — same shape, does nothing, so respond() doesn't need a
 *  second code path for "don't actually speak this". */
const silentSpeaker = (): Speaker => ({
  push: () => {},
  say: () => {},
  end: async () => {},
  cancel: () => {},
  level: () => 0,
})

/**
 * Built from voice.ts's WAKE_NAME_ALTERNATIVES — the same mishearings the
 * wake word accepts for whichever persona is currently active, otherwise a
 * turn that woke him as "travis" gets that word sent on to the model as a
 * question. Persona-aware rather than a fixed Jarvis-only pattern: an
 * earlier version of this file hardcoded Jarvis's own mishearings, so
 * "Edith, what about tomorrow?" wasn't stripped the way "Jarvis, what about
 * tomorrow?" was while Edith (or any other persona) was active.
 */
function nameRegexes(persona: string) {
  const alt = WAKE_NAME_ALTERNATIVES[persona] ?? WAKE_NAME_ALTERNATIVES.jarvis
  return {
    /** A bare vocative — "Jarvis", "hey jarvis" — with nothing asked. */
    bare: new RegExp(`^(?:hey|hi|ok|okay|yo)?\\s*${alt}[\\s,.!?]*$`, 'i'),
    /** A leading vocative on a real command: "Jarvis, what's the weather". */
    leading: new RegExp(`^(?:hey|hi|ok|okay|yo)?\\s*${alt}\\b[\\s,.:!?-]*`, 'i'),
  }
}

/**
 * Turns hand-tracking (and the camera it needs) on or off. Module-level
 * rather than a closure inside one effect, because both the G key and a
 * voice-triggered ui_prefs("gestures") call need the exact same async
 * permission dance and the same store update on success or failure.
 */
async function setGesturesOn(on: boolean): Promise<void> {
  if (!on) {
    hands.disableHands()
    useStore.getState().setGestures(false)
    return
  }
  useStore.getState().setError(null)
  try {
    await hands.enableHands()
    useStore.getState().setGestures(true)
  } catch (err) {
    useStore.getState().setGestures(false)
    useStore.getState().setError(
      (err as Error)?.name === 'NotAllowedError'
        ? 'Camera access denied — gesture control is unavailable.'
        : `Gesture control failed to start: ${(err as Error)?.message ?? err}`,
    )
  }
}

/** How long a ui_prefs-triggered reload waits before actually firing — long
 *  enough for a short spoken line ("updating now, sir") to reach the speaker
 *  and finish, including the round trip to generate it. Reloading the
 *  instant the tool call lands would cut that line off mid-word, since the
 *  page (and its audio) disappears the moment this runs. */
const PREFS_RELOAD_DELAY_MS = 2500

function delayedReload(): void {
  window.setTimeout(() => location.reload(), PREFS_RELOAD_DELAY_MS)
}

export default function App() {
  const store = useStore
  const phase = useStore((s) => s.phase)
  const textOpen = useStore((s) => s.textOpen)
  const pendingAttachment = useStore((s) => s.pendingAttachment)
  const persona = useStore((s) => s.persona)
  const history = useRef<Msg[]>([])
  const speaker = useRef<ReturnType<typeof createSpeaker> | null>(null)
  const voice = useRef<Voice | null>(null)
  /** The V key's audio test — its own element, deliberately never
   *  `speaker.current`, so auditioning a voice can never be mistaken for (or
   *  interfere with) an actual conversation turn. */
  const testAudio = useRef<HTMLAudioElement | null>(null)
  /** The I key's and the text input's + button's file picker — hidden,
   *  clicked programmatically. See attach() below and the 'i' case in onKey. */
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Monotonic turn counter. Every await in a turn checks it on the way out:
   * if it has moved, that turn was superseded by a barge-in and must not touch
   * the phase, the speaker, or the busy state on its way to the floor.
   */
  const turn = useRef(0)
  const booting = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voicePoll = useRef<ReturnType<typeof setInterval> | null>(null)
  /** Set only while the boot animation's own wait is in flight — see ArrowRight
   *  in the keydown handler below. Everything after the wait (mic, capability
   *  probe, voice loop) still runs; only the artificial pacing is skippable. */
  const skipBoot = useRef<(() => void) | null>(null)

  // -- helpers --------------------------------------------------------------

  const clearIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = null
  }

  const silence = () => {
    speaker.current?.cancel()
    speaker.current = null
  }

  const goDormant = () => {
    clearIdle()
    silence()
    turn.current++
    const s = store.getState()
    s.setCaption('')
    s.setActiveTool(null)
    music.working(false)
    music.duck(false)
    sfx.duck(false)
    s.setPhase('dormant')
  }

  /** Open the mic and wait. `window` is how long before he gives up. */
  const listen = (window: number) => {
    clearIdle()
    const s = store.getState()
    s.setCaption('')
    s.setPhase('listening')
    sfx.play('listen')
    idleTimer.current = setTimeout(goDormant, window)
  }

  // -- one turn -------------------------------------------------------------

  const respond = async (
    said: string,
    attachment: Attachment | null = null,
    viaText = false,
  ): Promise<void> => {
    const mine = ++turn.current
    const stale = () => mine !== turn.current

    clearIdle()
    const s = store.getState()
    // Last turn's panels and blades go now, before the new answer starts
    // putting its own up. Anything the model marked sticky survives.
    s.clearPanels()
    s.clearBlades()
    s.setCaption('')
    // No thumbnail/content in the transcript (that would mean carrying the
    // full attachment in turn history just to render it once) — a plain tag
    // is enough to explain an otherwise-bare "[image attached]" line on
    // reread.
    const tag = attachment
      ? attachment.kind === 'image'
        ? '[image attached]'
        : `[attached: ${attachment.name}]`
      : ''
    s.pushTurn({
      id: newId(),
      role: 'user',
      text: tag ? (said ? `${said} ${tag}` : tag) : said,
    })
    s.setPhase('thinking')

    // Only a typed question, with the setting on, ever goes silent — a
    // spoken question always gets a spoken answer, regardless of this
    // setting, since viaText is false for every voice-submitted turn.
    const silent = viaText && s.textOnly
    const spk = silent ? silentSpeaker() : createSpeaker()
    speaker.current = spk
    sfx.duck(true)
    music.duck(true)

    const turnId = newId()
    let started = false
    let filled = false

    try {
      const { text } = await ask(said, attachment, history.current, {
        onText: (delta) => {
          if (stale()) return
          if (!started) {
            started = true
            store.getState().setPhase('speaking')
            // The answer arriving is what ends the tool phase — a timer would
            // clear the readout while a slow tool was still running.
            store.getState().setActiveTool(null)
            music.working(false)
            store.getState().pushTurn({ id: turnId, role: 'jarvis', text: '' })
          }
          store.getState().appendToLastTurn(delta)
          spk.push(delta)
        },
        onTool: (name) => {
          if (stale()) return
          // Only claim the tooling phase while he has nothing to say yet.
          // Setting it unconditionally pinned the machine in 'tooling' for the
          // rest of any answer that called a tool after it started talking,
          // which also broke the reactor's lip-sync for the remainder.
          if (!started) store.getState().setPhase('tooling')
          store.getState().setActiveTool(name)
          sfx.play('tool')
          music.working(true)
          // Say something the moment work starts — a tool can take ten seconds
          // and silence that long reads as a crash. Once per turn only; a
          // chain of five tools shouldn't produce five apologies.
          if (!filled && !started) {
            filled = true
            spk.say(forTool(name))
          }
        },
      }, silent)

      if (stale()) return

      // The bridge keeps conversation state in its own session, so history is
      // only threaded through on the direct path.
      if (!usingBridge) {
        history.current.push({ role: 'user', content: said })
        history.current.push({ role: 'assistant', content: text || '…' })
        if (history.current.length > 16) {
          history.current = history.current.slice(-16)
        }
      }

      await spk.end()
      if (stale()) return
      sfx.play('done')
    } catch (err) {
      if (stale()) return
      console.error(err)
      sfx.play('error')
      store
        .getState()
        .setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      if (!stale()) {
        speaker.current = null
        sfx.duck(false)
        music.duck(false)
        store.getState().setActiveTool(null)
        music.working(false)
        // Stay open. Having to say his name again to add one more sentence is
        // the difference between a conversation and a vending machine.
        listen(FOLLOW_UP_MS)
      }
    }
  }

  // -- voice events ---------------------------------------------------------

  /** What the voice loop should do with what it hears, derived from phase. */
  const mode = (): VoiceMode => {
    const { phase, headphones, micOff } = store.getState()
    if (micOff) return 'deaf'
    switch (phase) {
      case 'offline':
      case 'boot':
        return 'deaf'
      case 'dormant':
        return 'wake'
      case 'waking':
      case 'listening':
        // No bridge, no brain to send a command to — fall back to only
        // listening for his name, same as dormant, rather than assembling a
        // command that has nowhere to go.
        return isConnected() ? 'command' : 'wake'
      case 'speaking':
        // With a speaker instead of a headset, an open mic hears him — so
        // speaking goes fully deaf rather than relying on isEcho() to sort it
        // out after the fact. Headphones keep the old barge-in behaviour.
        return headphones ? 'guard' : 'deaf'
      default:
        return isConnected() ? 'guard' : 'wake' // thinking, tooling
    }
  }

  const onWake = (trailing: string) => {
    const phase = store.getState().phase
    if (phase === 'offline' || phase === 'boot') return

    // Heard his name, but there's no bridge to send anything to. Say so
    // locally — createSpeaker() needs no agent turn — instead of opening the
    // mic on a command that has nowhere to go, or silently doing nothing,
    // which would look like JARVIS just ignored him.
    if (!isConnected()) {
      sfx.play('error')
      const offlineSpeaker = createSpeaker()
      speaker.current = offlineSpeaker
      offlineSpeaker.say(stillOffline())
      void offlineSpeaker.end()
      return
    }

    store.getState().setError(null)
    sfx.play('wake')

    // No persona switch here any more: matchWake (src/lib/voice.ts) only ever
    // tests the currently active persona's own name, so waking can never name
    // a different one. Switching personas is a real request now — "Jarvis,
    // switch to Edith" — that reaches the model as `trailing` below and goes
    // through the `ui_voice` tool, the same as any other command, instead of
    // a name match short-circuiting straight past the conversation.

    // "Jarvis, what's happening in AI this week" in one breath. Waiting for a
    // greeting he didn't need is the most common way an assistant wastes time.
    if (trailing) {
      void respond(trailing)
      return
    }

    store.getState().setPhase('waking')

    // Answer to his name. Deliberately NOT awaited any more: the microphone is
    // already open and the echo filter knows his voice, so the user can talk
    // straight over the greeting instead of waiting it out.
    const greeting = createSpeaker()
    speaker.current = greeting
    greeting.say(attention())
    void greeting.end()

    listen(AWAIT_SPEECH_MS)
  }

  /**
   * Someone started talking. This is the whole point of the rewrite: he stops,
   * immediately, whatever he was doing.
   */
  const onSpeechStart = () => {
    clearIdle()
    const phase = store.getState().phase
    if (phase === 'offline' || phase === 'boot' || phase === 'dormant') return

    const wasBusy =
      phase === 'thinking' || phase === 'tooling' || phase === 'speaking'

    silence()
    if (wasBusy) {
      // Abandon the answer in flight. The turn counter moves in respond()'s
      // replacement; bumping it here covers the case where nothing replaces it.
      turn.current++
      interrupt()
      store.getState().setActiveTool(null)
      music.working(false)
      sfx.duck(false)
      music.duck(false)
    }
    store.getState().setPhase('listening')
  }

  const onUtterance = (text: string) => {
    const phase = store.getState().phase
    if (phase === 'offline' || phase === 'boot' || phase === 'dormant') return

    // People keep using his name as a vocative once they're already talking to
    // him. Strip it rather than sending "jarvis" to the model as a question.
    const { bare, leading } = nameRegexes(store.getState().persona)
    if (bare.test(text)) {
      listen(AWAIT_SPEECH_MS)
      return
    }
    const said = text.replace(leading, '').trim()
    if (!said) {
      listen(AWAIT_SPEECH_MS)
      return
    }

    void respond(said)
  }

  const onPartial = (text: string) => {
    store.getState().setCaption(text)
  }

  /**
   * A typed message, from the hidden text fallback (TextInput.tsx). Shares
   * `respond()` with voice — the reply comes back spoken too, unless the
   * text-only setting is on, in which case this specific answer is text
   * only (see respond()'s `viaText` parameter) — but skips onUtterance's
   * wake-word stripping, since a typed line has none of the mishearing that
   * logic exists for. Interrupts an in-progress answer the same way
   * onSpeechStart does, so typing over him works like talking over him.
   */
  const submitText = (text: string, attachment: Attachment | null = null) => {
    const said = text.trim()
    if (!said && !attachment) return
    const p = store.getState().phase
    if (p === 'offline' || p === 'boot') return

    clearIdle()
    if (p === 'thinking' || p === 'tooling' || p === 'speaking') {
      silence()
      turn.current++
      interrupt()
      store.getState().setActiveTool(null)
      music.working(false)
      sfx.duck(false)
      music.duck(false)
    }
    store.getState().setPendingAttachment(null)
    void respond(said, attachment, true)
  }

  const onVoiceError = (message: string) => {
    store.getState().setError(message)
  }

  /**
   * An image, or a text/markdown file, from a paste (see the window 'paste'
   * listener below), the I-key file picker, or the text input's + button —
   * the "Screenshot/Bild einfügen" backlog item, alongside the camera as a
   * second way to show him something (and now a second way to hand him text
   * too, for a file that already exists rather than one he'd have to be
   * dictated). Reveals the text fallback with the attachment in place rather
   * than sending it blind, so there's a chance to add a question ("what's
   * wrong with this proof") before it goes out; Enter on an empty box still
   * sends the attachment alone.
   */
  const attach = (file: File) => {
    const p = store.getState().phase
    if (p === 'offline' || p === 'boot') return
    void readAttachment(file)
      .then((attachment) => {
        store.getState().setPendingAttachment(attachment)
        store.getState().setTextOpen(true)
      })
      .catch((err) => {
        store
          .getState()
          .setError(err instanceof Error ? err.message : 'Could not read that file.')
      })
  }

  // -- power on -------------------------------------------------------------

  const powerOn = async () => {
    // The ignition button and the space bar can both land here, and the phase
    // only moves after the first await — so without this a double press boots
    // twice, arming two voice loops and two download polls.
    if (booting.current) return
    booting.current = true

    try {
      await ignite()
    } catch (err) {
      // The guard must not outlive a failed boot. Audio unlock can be refused,
      // the microphone prompt dismissed, the bridge unreachable at the wrong
      // moment — and with the flag still latched the ignition button was dead
      // for the rest of the page, recoverable only by reloading. Reset it and
      // put the button back so the user can simply press it again.
      booting.current = false
      console.error('[jarvis] power-up failed:', err)
      store.getState().setPhase('offline')
      store
        .getState()
        .setError(
          err instanceof Error
            ? `Power-up failed: ${err.message}`
            : 'Power-up failed. Click to try again.',
        )
    }
  }

  const ignite = async () => {
    const s = store.getState()

    // Must happen inside the click handler — browsers won't start an
    // AudioContext or speech synthesis without a user gesture.
    await sfx.unlockAudio()
    sfx.play('boot')
    // The score. Must be started from inside this click handler for the same
    // reason as the rest of the audio.
    music.enable()
    music.playBoot()
    music.startAmbient()

    s.setPhase('boot')

    watchServers((servers) => store.getState().setConnected(servers))
    watchPanels((panel) => store.getState().pushPanel(panel))
    watchBlades((blade) => store.getState().pushBlade(blade))

    /**
     * JARVIS asking to see something.
     *
     * Announced on screen for as long as it takes, with whatever he said he was
     * looking for. The camera's own light is on too, but a hardware light that
     * appears with no explanation is exactly the thing that makes people
     * distrust an assistant — so the interface says it before they have to ask.
     */
    watchCapture(async (req) => {
      const note =
        req.mode === 'watch'
          ? req.when === 'past'
            ? req.reason || 'reviewing the last few seconds'
            : `${req.reason || 'watching'} · ${req.seconds}s`
          : req.reason || 'taking a look'
      store.getState().setLooking(note)

      // The past is only available if something has been remembering it, and
      // that only happens while the camera is on screen. Answering plainly
      // beats opening the camera and recording the next few seconds instead,
      // which is a different question from the one that was asked.
      if (req.mode === 'watch' && req.when === 'past' && camera.bufferedSeconds() < 1) {
        store.getState().setLooking(null)
        return {
          error:
            'There is no recent footage — the camera has to be open on screen ' +
            'for me to remember what just happened. Ask me to open the camera, ' +
            'and I can watch from then on.',
        }
      }

      // Held for the whole capture. Without this the stream can be torn down by
      // whoever else was using it half way through a six-second watch.
      let held = false
      try {
        await camera.holdCamera()
        held = true
        if (req.mode === 'look') return camera.grabFrame()
        if (req.when === 'past') {
          const grid = camera.recentGrid(req.seconds, 9)
          return grid ?? { error: 'There is not enough recent footage to review.' }
        }
        return await camera.watchAhead(req.seconds, 9)
      } catch (err) {
        return {
          error:
            (err as DOMException)?.name === 'NotAllowedError'
              ? 'The camera is not permitted, so I cannot see anything.'
              : `The camera could not be read: ${(err as Error)?.message ?? err}`,
        }
      } finally {
        if (held) camera.releaseCamera()
        store.getState().setLooking(null)
      }
    })

    // The interface is JARVIS's to drive. These arrive out of band, pushed
    // mid-turn the way panels are, so a command can retint the reactor or put
    // something into orbit while he is still speaking the sentence about it.
    watchUi((op, args) => {
      const s = store.getState()
      const a = (args ?? {}) as Record<string, never>
      switch (op) {
        case 'patch':
          s.applyUi(args)
          break
        case 'orbit':
          if (a.action === 'add') s.addOrbit(args)
          else if (a.action === 'remove') s.removeOrbit(String(a.id))
          else s.clearOrbits()
          break
        case 'effect':
          s.fireEffect(a.kind)
          break
        case 'reset':
          s.resetUi()
          break
        case 'screen':
          s.clearScreen(a.what ?? 'all')
          break
        case 'settings':
          s.setSettingsOpen(a.open ?? true)
          break
        case 'voice':
          // ui_voice (a spoken/typed "switch to edith") changed the bridge's
          // own state directly — this just mirrors it into the store so the
          // transcript label, brand mark and standby hint catch up. The wake
          // word and the Settings/dropdown buttons already do this
          // themselves; this is the one path that didn't.
          if (typeof a.persona === 'string') s.setPersona(a.persona)
          break
        case 'prefs': {
          // ui_prefs (a spoken/typed "switch to speaker mode", "mute the
          // mic", "make the text bigger", "clear the chat history") — one
          // tool covering every switch in the Settings panel and the
          // SYSTEMS rail, so a command reaches the same code as its button.
          // recognition_lang/stt_engine reload the page and reload/clear are
          // one-off actions, so all three run last, after everything else in
          // the same call has been applied and saved. ttsEngine is the odd
          // one out among the engine choices — live, like the fields above,
          // not reload-and-last like sttEngine below.
          if (typeof a.headphones === 'boolean') s.setHeadphones(a.headphones)
          if (a.mic === 'on' || a.mic === 'off') s.setMicOff(a.mic === 'off')
          if (a.gestures === 'on' || a.gestures === 'off') {
            void setGesturesOn(a.gestures === 'on')
          }
          if (a.uiLang === 'en' || a.uiLang === 'de') setUiLang(a.uiLang)
          if (typeof a.skipIntro === 'boolean') setSkipIntro(a.skipIntro)
          if (typeof a.edgeScale === 'number') setEdgeScale(a.edgeScale)
          if (typeof a.chatScale === 'number') setChatScale(a.chatScale)
          if (typeof a.panelScale === 'number') setPanelScale(a.panelScale)
          // Unlike sttEngine below, this one is live — tts.ts reads it fresh
          // per sentence, no boot-time loop to restart, so it needs no reload.
          if (a.ttsEngine === 'free' || a.ttsEngine === 'premium') {
            setSetting(TTS_PREF_KEY, String(a.ttsEngine === 'premium'))
          }
          if (a.clearHistory) s.clearScreen('transcript')

          if (a.recognitionLang === 'en' || a.recognitionLang === 'de') {
            setSetting(SPEECH_LANG_KEY, a.recognitionLang === 'en' ? 'en-GB' : 'de-DE')
            delayedReload()
          } else if (a.sttEngine === 'free' || a.sttEngine === 'premium') {
            setSetting(STT_PREF_KEY, String(a.sttEngine === 'premium'))
            delayedReload()
          } else if (a.reload) {
            delayedReload()
          }
          break
        }
        default:
          console.warn('[jarvis] unknown ui op:', op, args)
      }
    })
    // In bridge mode the conversation lives in the agent session, which is tied
    // to the socket — so a drop silently wipes his memory while the transcript
    // on screen still shows it. Better to say so than to let him quietly forget.
    watchConnection((state) => {
      if (state === 'lost') {
        store
          .getState()
          .setError(
            "Bridge connection lost — reconnecting. JARVIS can't respond " +
              'or take commands right now; standby, mute, volume and ' +
              'settings still work.',
          )
      } else if (state === 'reconnected') {
        store
          .getState()
          .setError('Bridge reconnected. The previous conversation was not kept.')
      }
    })
    const warming = warm().catch((err: Error) => s.setError(err.message))

    if (!usingBridge && !env.anthropicKey) {
      s.setError(
        'No Claude API key on this device — add yours in Settings → APIS. It stays on this device only.',
      )
    }

    // Pull the neural voice down during the boot sequence so the first
    // "Hey Jarvis" isn't waiting on an 86MB download. Deliberately not awaited
    // — if it's slow, JARVIS comes up on the system voice and swaps over the
    // moment the model is ready.
    if (TTS_ENGINE === 'kokoro') {
      void kokoro.load()
      voicePoll.current = setInterval(() => {
        const p = kokoro.loadProgress()
        if (kokoro.isReady() || kokoro.isUnavailable()) {
          store.getState().setBootNote('')
          if (voicePoll.current) clearInterval(voicePoll.current)
          voicePoll.current = null
        } else if (p > 0 && p < 1) {
          store.getState().setBootNote(`voice ${Math.round(p * 100)}%`)
        }
      }, 200)
    }

    // Long enough for the four-beat start-up sequence in Boot.tsx to play —
    // status bar, rings, suit schematic, reactor power-up — before the live
    // interface takes over. Kept a touch under the boot cue so the music is
    // still rising as the reactor lands.
    await new Promise<void>((resolve) => {
      const id = setTimeout(resolve, 9200) // boot sequence
      skipBoot.current = () => {
        clearTimeout(id)
        resolve()
      }
      // Same skip as ArrowRight, just fired automatically — the Settings
      // panel's "Intro überspringen" choice, read fresh on every boot so it
      // takes effect on a plain F5 too, not only through a dedicated button.
      if (getSetting<string>('jarvis.skipIntro', 'false') === 'true') {
        music.stopAll()
        skipBoot.current()
      }
    })
    skipBoot.current = null
    await warming
    store.getState().setConnected(connectedLabels())
    store.getState().setVoice(currentVoiceName())

    // The analyser is what makes the reactor pulse with your voice. It needs a
    // getUserMedia stream; speech recognition does not, and gets its own. So a
    // failure here costs the animation and nothing else — saying "voice input
    // is unavailable" was both alarming and untrue.
    try {
      await startAnalyser()
    } catch {
      console.warn(
        '[jarvis] no microphone stream — the reactor will not pulse with your ' +
          'voice. Speech recognition is unaffected.',
      )
    }

    // Ask the bridge which speech engines exist before the loop starts, so the
    // first turn already uses ElevenLabs when a key is present and the browser
    // fallback when it is not — no flag, no reload.
    await probeCapabilities()

    // One voice loop, started once, running until the page closes.
    voice.current = await startVoice({
      mode,
      persona: () => store.getState().persona,
      onWake,
      onSpeechStart,
      onPartial,
      onUtterance,
      onError: onVoiceError,
    })

    store.getState().setPhase('dormant')
  }

  // -- clap to start --------------------------------------------------------

  /**
   * A clap brings him up, as an alternative to the button.
   *
   * Only while the ignition screen is showing, and torn down the moment he
   * boots — the microphone is about to belong to the voice loop, and two
   * analysers arguing over the same stream is how you get an assistant that
   * hears half of what you say.
   *
   * Deliberately silent about failure. If the microphone is refused, or has not
   * been granted yet, the button is still right there; announcing an error
   * about a feature nobody asked for would be worse than quietly doing without.
   */
  useEffect(() => {
    if (phase !== 'offline') return
    let live: { stop: () => void } | null = null
    let gone = false
    void listenForClap(() => {
      if (!gone) void powerOn()
    }).then((l) => {
      if (gone) l.stop()
      else live = l
    })
    return () => {
      gone = true
      live?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // -- level pump + keys ----------------------------------------------------

  useEffect(() => {
    let raf = 0

    const pump = () => {
      const st = store.getState()
      // Skip the analyser read entirely while muted, rather than just
      // discarding its result at display time — micLevel() does a real FFT
      // read every frame, and there is no point spending that while the
      // level is going to be shown as 0/MUTED regardless.
      const lvl = st.micOff
        ? 0
        : // While speaking, follow JARVIS's own output rather than the mic,
          // so the orb lip-syncs instead of reacting to room noise.
          st.phase === 'speaking' && speaker.current
          ? speaker.current.level()
          : micLevel()
      st.setLevel(lvl)
      raf = requestAnimationFrame(pump)
    }
    pump()

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // L starts a turn without the wake word — the old Space behaviour,
      // moved off Space now that Space (with Enter) opens the text input
      // instead. Worth using while filming so a missed wake word doesn't
      // cost a take.
      if (e.key === 'l' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        const phase = store.getState().phase
        if (phase === 'offline') {
          void powerOn()
        } else if (phase === 'boot') {
          /* ignore — the boot sequence owns the phase until it finishes */
        } else if (phase === 'waking' || phase === 'listening') {
          // A second L while he's already awake and waiting toggles him back
          // to standby, instead of re-greeting him and resetting the wait.
          goDormant()
        } else if (
          phase === 'thinking' ||
          phase === 'tooling' ||
          phase === 'speaking'
        ) {
          onSpeechStart()
          listen(AWAIT_SPEECH_MS)
        } else {
          onWake('')
        }
        return
      }

      // V auditions the next ElevenLabs voice on the bridge (or, without one,
      // the next British system voice — see the fallback below). Bare V
      // only — ⌘V and ⌃V are paste, and swallowing those was rude.
      if (
        e.key === 'v' &&
        !e.repeat &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault()

        if (usingBridge) {
          // Deliberately not `respond()`/`createSpeaker()`: this is a one-off
          // test line with an explicit voiceId, never the conversation's own
          // voice, so it stays off speaker.current and off the transcript.
          testAudio.current?.pause()
          void (async () => {
            const res = await fetch(`${BRIDGE_HTTP_URL}/voice/test`, { method: 'POST' })
            if (!res.ok) {
              throw new Error(`voice test request failed (${res.status}): ${await res.text()}`)
            }
            const { id, label, index, total } = (await res.json()) as {
              id: string
              label: string
              index: number
              total: number
            }
            store.getState().setVoice(`${label} (${index + 1}/${total})`)
            const ttsRes = await fetch(`${BRIDGE_HTTP_URL}/tts`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: `I am ${label}.`, voiceId: id }),
            })
            if (!ttsRes.ok) {
              throw new Error(`voice test tts failed (${ttsRes.status}): ${await ttsRes.text()}`)
            }
            const audio = new Audio(URL.createObjectURL(await ttsRes.blob()))
            testAudio.current = audio
            void audio.play()
          })().catch((err) => store.getState().setError(String(err)))
          return
        }

        const name = cycleVoice()
        store.getState().setVoice(name)
        silence()
        const demo = createSpeaker()
        speaker.current = demo
        demo.say(`Voice set to ${name.replace(/\(.*?\)/g, '').trim()}. At your service, sir.`)
        void demo.end()
        return
      }

      // G puts the camera on and starts tracking hands. Off by default and
      // never implicit: a webcam that turns itself on because an interface
      // thought it might be useful is not a trade anyone agreed to.
      if (e.key === 'g' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        void setGesturesOn(!store.getState().gestures)
        return
      }

      // I opens a file picker for an image or text file to show him — the
      // "Datei" half of the screenshot/image backlog item, paste being the
      // other half (see the window 'paste' listener below), and the text
      // input's own + button a third way to reach the same picker. Same
      // destination either way: attach() attaches it to the text fallback.
      if (e.key === 'i' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        fileInputRef.current?.click()
        return
      }

      // T speaks a fixed line, bypassing the wake word, the recogniser and the
      // model entirely. When "I can't hear him" is the report, this is the one
      // keypress that separates a broken voice engine from a broken voice loop
      // — and it prints the verdict rather than making you infer it.
      if (e.key === 't' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        silence()
        const t = createSpeaker()
        speaker.current = t
        t.say('Audio test. If you can hear this, speech output is working, sir.')
        void t.end().then(() => {
          const d = (window as unknown as Record<string, Record<string, unknown>>).__tts
          console.info('[jarvis] audio test →', d)
          if (d && d.started === 0 && d.rescued === 0) {
            store.getState().setError(
              `No sound produced. engine=${d.engine} voice=${d.voice} error=${d.lastError || 'none'}`,
            )
          }
        })
        return
      }

      // ArrowRight skips the boot animation's own pacing wait. Everything it
      // was waiting to do next (mic, capability probe, voice loop) still runs
      // right after — this only cuts the artificial delay, not the setup.
      if (e.key === 'ArrowRight' && store.getState().phase === 'boot') {
        e.preventDefault()
        music.stopAll()
        skipBoot.current?.()
        return
      }

      // Escape stands the whole thing down — the one thing the old build had
      // no key for at all.
      if (e.key === 'Escape') {
        e.preventDefault()
        if (store.getState().phase !== 'offline') goDormant()
        return
      }

      // ArrowDown is the same standby, just a second way to reach it.
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (store.getState().phase !== 'offline') goDormant()
        return
      }

      // ArrowUp toggles the settings panel — also reachable by asking him to
      // open it (ui_settings tool, handled below in watchUi).
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (store.getState().phase !== 'offline') {
          store.getState().setSettingsOpen(!store.getState().settingsOpen)
        }
        return
      }

      // Enter or Space reveals the hidden text fallback (TextInput.tsx
      // handles the actual send). Space is free for this now that it no
      // longer starts a spoken turn. Not while Settings is already claiming
      // the keyboard, and only once the page is up.
      if (
        (e.key === 'Enter' || e.code === 'Space') &&
        !e.repeat &&
        !store.getState().settingsOpen &&
        store.getState().phase !== 'offline' &&
        store.getState().phase !== 'boot'
      ) {
        e.preventDefault()
        store.getState().setTextOpen(true)
        return
      }
    }
    window.addEventListener('keydown', onKey)

    // Paste works everywhere, not just while the text fallback happens to be
    // focused — pasting a screenshot is the whole point of the feature, and
    // requiring Enter first just to make a target for it would defeat that.
    // Only intercepted when the clipboard actually holds a FILE (fileKind ===
    // 'file') — a normal text paste (e.g. into an already-open text input,
    // or copied prose with no attached file) has no such item and is left
    // alone. readAttachment() inside attach() is what actually decides
    // whether that file is something usable.
    const onPaste = (e: ClipboardEvent) => {
      const p = store.getState().phase
      if (p === 'offline' || p === 'boot' || store.getState().settingsOpen) return
      const items = e.clipboardData?.items
      if (!items) return
      const file = fileFromClipboard(items)
      if (!file) return
      e.preventDefault()
      attach(file)
    }
    window.addEventListener('paste', onPaste)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
      clearIdle()
      if (voicePoll.current) clearInterval(voicePoll.current)
      voice.current?.stop()
      speaker.current?.cancel()
      // The camera must not outlive the page that turned it on.
      hands.disableHands()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Scene />
      <Hud />
      <Boot />
      <Diagnostics />
      <TextInput
        open={textOpen}
        persona={persona}
        attachment={pendingAttachment}
        onSubmit={submitText}
        onAttach={() => fileInputRef.current?.click()}
        onClearAttachment={() => store.getState().setPendingAttachment(null)}
        onClose={() => {
          store.getState().setTextOpen(false)
          store.getState().setPendingAttachment(null)
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.md,.markdown,.txt,.json,.csv,.log,.yml,.yaml,.xml,.ts,.tsx,.js,.jsx,.py,.java,.c,.cpp,.h,.hpp,.css,.html,.sh,.toml,.ini,text/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) attach(file)
        }}
      />
      <Ignition onStart={() => void powerOn()} />
    </>
  )
}
