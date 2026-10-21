/**
 * The Settings panel's "Schriftsprache" toggle.
 *
 * Deliberately narrow: it only picks which half of a Localized string to
 * show — the longer descriptive text (keybinds, gestures, colours, the APIs
 * note). Labels, tab names, the panel title and the brand wordmark
 * (J.A.R.V.I.S. / E.D.I.T.H. and their taglines) stay exactly as they are
 * regardless of this setting; those are identity, not prose to translate.
 *
 * No reload needed, unlike SPEECH_LANG or the STT engine choice — nothing
 * here affects anything at boot, just which string gets rendered right now.
 */
import { getSetting, setSetting } from './profile'

export type Lang = 'en' | 'de'
export type Localized = { en: string; de: string }

const UI_LANG_KEY = 'jarvis.uiLang'

/** Defaults to German — Nicolas's own language, and what most of the rest
 *  of the Settings panel's labels already are. */
export function uiLang(): Lang {
  return getSetting<string>(UI_LANG_KEY, '') === 'en' ? 'en' : 'de'
}

export function setUiLang(lang: Lang): void {
  setSetting(UI_LANG_KEY, lang)
}

export function t(text: Localized, lang: Lang): string {
  return text[lang]
}
