# JARVIS Mobile — Notizen & Setup-Referenz

> **Jarvis-Mobile** (<https://github.com/n-brand/Jarvis-Mobile>, Pages:
> <https://n-brand.github.io/Jarvis-Mobile/>) ist eine Kopie von
> `n-brand/jarvis` als Basis für eine PWA-Version. Das Repo ist **öffentlich**
> und **ohne Erinnerung**: persönlicher Kontext (`bridge/context.md`),
> Standort-Abgleich (`bridge/places.md`, `src/lib/location.ts`) und N.O.R.A.
> (`bridge/nora.mjs`, `src/ui/Nora.tsx`) sind komplett entfernt. Alles, was
> weiter unten über diese Funktionen steht, beschreibt nur das Original-Repo.
> Nicht wieder einbauen, ohne das ausdrücklich zu besprechen. Auch der
> Chat-Verlauf wird nicht mehr gespeichert (`persist` aus `src/store.ts`
> entfernt) — der Abschnitt "Chat-Verlauf übersteht Reload" unten gilt nur
> fürs Original.
>
> **PWA / Pages:** `.github/workflows/pages.yml` baut mit
> `VITE_BACKEND=direct` und `PAGES_BASE=/Jarvis-Mobile/`. **Nie Secrets oder
> Keys in den Build geben** — alle `VITE_*` landen lesbar im Bundle. Der
> Claude-Key wird pro Gerät in Einstellungen → APIS gespeichert
> (`ANTHROPIC_KEY_SETTING` in `src/config.ts`). Pfade zu Dateien aus
> `public/` immer mit `import.meta.env.BASE_URL` bauen, nie mit `/…`.
> Service Worker `public/sw.js` cacht nur eigene Dateien. Icons:
> `node scripts/make-icons.mjs` (Stil des Portfolios).

Verlauf, Kontext und technische Referenz zu dieser persönlichen JARVIS-Instanz
(ursprünglich geklont von <https://github.com/adewaskar/jarvis>, läuft jetzt
im eigenen Fork <https://github.com/n-brand/jarvis>). Diese Datei lag anfangs
bewusst außerhalb des Repos (um private Notizen nicht mit dem fremden
Upstream-Repo zu vermischen) — jetzt, da `origin` auf den eigenen Fork zeigt,
ist sie ins Projekt gewandert.

## Projektname: NICOLAS (offiziell seit 2026-09-19)

Der Fork als Ganzes heißt jetzt **NICOLAS** — ein Akronym auf Nicolas'
Vornamen, mit "NICO" als kurzer, sprechbarer Form darin:

> **N**etworked, **I**ntelligent, **C**onversational **O**perator & **L**earning
> **A**ssistant **S**ystem — **NICOLAS**

Betrifft die Projekt-/Fork-Identität, nicht die Personas: "Jarvis" und
"Edith" (und künftig Friday/Karen) bleiben die einzelnen Charaktere
*innerhalb* von NICOLAS, mit ihren eigenen Weckwörtern und Stimmen — so wie
das MCU auch zwischen "Marvel" (Universum) und "Jarvis" (Charakter)
unterscheidet. Noch nicht umgesetzt: README-Titel, `package.json`-Name,
Browser-Tab-Titel — sag Bescheid, falls das mit übernommen werden soll.

## Von Grund auf einrichten (neues Gerät)

1. **Node.js 20+** installieren — <https://nodejs.org>, einfach den Installer
   ausführen.
2. **Claude Code CLI** global installieren:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
   Unter Windows mit PowerShell: falls `"...kann nicht geladen werden, da die
   Ausführung von Skripts auf diesem System deaktiviert ist"` kommt, liegt das
   an der PowerShell Execution Policy — **`npm.cmd` statt `npm` verwenden**,
   das umgeht das blockierte `.ps1`-Skript komplett:
   ```bash
   npm.cmd install -g @anthropic-ai/claude-code
   ```
3. **Einloggen** (einmalig, interaktiv — kann Claude nicht für dich übernehmen):
   ```bash
   claude.cmd
   ```
   Darin `/login` eingeben, Browser-Login abschließen, danach `/exit`.
4. **Repo klonen** (eigener Fork):
   ```bash
   git clone https://github.com/n-brand/Jarvis-Mobile.git
   ```
5. **Dependencies installieren** (im geklonten Ordner, wieder `.cmd` wegen
   PowerShell):
   ```bash
   npm.cmd install
   ```
6. **Starten:** `npm start` (oder `npm.cmd start`) im Projektordner, dann die
   ausgegebene URL in **Chrome oder Edge öffnen** — nicht Firefox (siehe
   Stolpersteine), nicht in einer eingebetteten Vorschau/IDE.
7. Auf **INITIALISE** klicken, Mikrofon erlauben, **Kopfhörer aufsetzen**
   (verhindert, dass JARVIS sich selbst hört), "Hey Jarvis" sagen.
8. Falls er nicht hört, obwohl Windows das Mikrofon-Signal zeigt: das
   **Eingabegerät direkt in Chrome prüfen** — siehe Stolpersteine, das war bei
   der Ersteinrichtung die eigentliche Ursache, nicht Windows oder JARVIS selbst.

## Sprache

| Einstellung | Wert | Definiert in |
|---|---|---|
| Spracherkennung (STT) | `en-GB` (Standard) | `src/config.ts` → `SPEECH_LANG` |
| Browser-Fallback-Stimme (TTS, nur ohne ElevenLabs) | `en-GB` (Standard) | `src/config.ts` → `VOICE_LANG` |

Bewusst getrennt: verstehen und (im Fallback) antworten in einer Sprache sind
unterschiedliche Entscheidungen. `VOICE_LANG` betrifft nur die Browser-eigene
Stimme ohne ElevenLabs-Key — Jarvis und Edith sprechen inzwischen über feste
ElevenLabs-Stimmen (siehe "Personas" unten), die davon unberührt sind.

Überschreibbar per `.env.local`: `VITE_SPEECH_LANG`, `VITE_VOICE_LANG` (Claude
darf `.env*`-Dateien nicht anfassen, das musst du selbst eintragen).

**`SPEECH_LANG` zur Laufzeit umschaltbar** (seit dem Einstellungs-Panel,
2026-09-15): `localStorage.getItem('jarvis.speechLang')` hat Vorrang vor der
`.env.local`-Variable. Das Panel setzt diesen Key und lädt danach die Seite
neu — der Erkennungs-Loop läuft einmalig ab dem Boot (`src/lib/voice.ts`),
ein Umbau mitten in der Session ist nicht vorgesehen. Der Chat-Verlauf
übersteht den Reload (siehe "Chat-Verlauf übersteht Reload" unten).

Änderung im Detail (für Reproduktion auf einem frischen Klon):
- `src/config.ts`: `SPEECH_LANG` (Default `'en-GB'`) und `VOICE_LANG` (Default
  `'en-GB'`), je per `str(import.meta.env.VITE_...)` überschreibbar, direkt
  nach `WAKE_ENGINE` eingefügt. `SPEECH_LANG` liest zusätzlich zuerst
  `localStorage['jarvis.speechLang']`
- `src/lib/voice.ts`: `rec.lang = 'en-GB'` → `rec.lang = SPEECH_LANG` (Import ergänzt)
- `src/lib/tts.ts`: `LANG_PREFIX`/`LANG_RE` aus `VOICE_LANG` abgeleitet statt
  hart `en` anzunehmen; `score()`, `candidateVoices()`, `pickVoice()`-Fallback
  und `u.lang`-Fallback nutzen jetzt `LANG_RE`/`VOICE_LANG` statt der
  hartkodierten `en`/`en-GB`-Werte (Import ergänzt)

## Stimme (TTS)

- **Seit 2026-09-15, ElevenLabs-Key hinterlegt**: Jarvis/Edith **können**
  über feste ElevenLabs-Stimmen sprechen (Tabelle unten bei "Personas") —
  bis Settings → APIs → "Sprechen" (siehe "Einstellungs-Panel" unten) war
  das automatisch, sobald ein Key konfiguriert war, ganz ohne Schalter.
  **Seit dem Zuhören/Sprechen-Umbau ist Gratis (Browser) der Standard**,
  ElevenLabs ist jetzt ein bewusstes Opt-in, genau wie bei der
  Spracherkennung — das hier Beschriebene ist also nicht mehr nur der
  Fallback bei fehlendem Key, sondern der Standardfall, bis man aktiv
  umschaltet
- Browser-Systemstimme: automatische Auswahl über `src/lib/tts.ts`
  (`score()`-Funktion, für Englisch auf einen britischen Butler-Klang
  getrimmt — für andere Sprachen zählt nur Qualitäts-Tag wie "premium"/"enhanced")
- **Bug gefixt (2026-09-16): Edith klang auch im Gratis/Browser-Fallback
  männlich.** `score()` war komplett persona-blind — sie hat für Englisch
  immer nach einem männlichen Butler-Klang gesucht (Daniel/Oliver/Arthur/…)
  und weiblich klingende Namen sogar aktiv abgewertet, egal welche Persona
  gerade sprach. Jetzt nimmt `score()` ein `wantFemale`-Flag
  (`wantsFemaleVoice()` liest `useStore.getState().persona === 'edith'`) und
  kehrt Bonus/Abwertung für Edith um. `pickVoice()`s Cache ist jetzt nach
  diesem Flag geschlüsselt (`cachedFor`) — ein reiner Persona-Wechsel ist
  kein `voiceschanged`-Event, hätte den alten, ungeschlüsselten Cache also
  nie ungültig gemacht und Edith für den Rest der Sitzung bei Jarvis'
  Stimme belassen. Betrifft nur Edith: Jarvis' weibliche Stimme existiert nur
  auf der ElevenLabs-Seite (`voiceState.gender`), wird nie in den
  Frontend-Store gespiegelt, also hat der Fallback dafür ohnehin keine
  Information.

  **Nachgefasst, gleicher Tag:** Fix half zunächst nicht — die Stimmliste
  des Browsers (per `speechSynthesis.getVoices()`, siehe unten) hatte
  tatsächlich "Google UK English Female", die Bewertung war also korrekt.
  Ursache war `localStorage['jarvis.voice']` (der Taste-V-Merker) — stand auf
  "Google UK English Male", vermutlich aus einer viel früheren, nicht mit
  Edith zusammenhängenden Sitzung, und hatte laut Kommentar "gewinnt immer,
  unabhängig von der Persona" bewusst Vorrang vor jeder Persona-Logik.
  Ein Wert, ein Slot, egal für welche Persona zuletzt gewählt — genau das
  war das Problem, nicht bloß Vergesslichkeit. Fix: `pickVoice()` bewertet
  den gespeicherten Namen jetzt selbst neu (`score(hit, wantFemale) >= USABLE`)
  und ignoriert ihn, wenn er zur gerade gefragten Persona nicht passt — ein
  für Jarvis gewählter Männername gewinnt für Jarvis weiterhin, wird aber für
  Edith übergangen, statt fest kleben zu bleiben. Ein Name, der komplett
  verschwunden ist (Stimme deinstalliert), wird weiterhin ganz gelöscht.
- Manuell wechseln (nur Fallback-Stimme): Taste **V** im laufenden JARVIS,
  zyklisch durch Kandidaten, Wahl wird im Browser gespeichert (localStorage)
- Alle installierten Stimmen auflisten (Browser-Konsole, F12):
  ```js
  speechSynthesis.getVoices().map(v => v.name + ' — ' + v.lang).join('\n')
  ```

Aktuell hat nur Englisch namensbasierte Bewertung in `score()`
(`src/lib/tts.ts`, `LANG_PREFIX === 'en'`-Zweig); jede andere Sprache bekommt
nur den pauschalen Qualitäts-Bonus ("premium"/"enhanced" im Namen), keine
Geschlechtserkennung. Welche Stimmen es gibt, hängt von Betriebssystem,
Sprachpaketen und Browser ab — vor dem Ausweiten von `score()` auf eine neue
Sprache die Liste mit dem Befehl oben frisch abrufen.

### ElevenLabs eingerichtet (2026-09-15)

API-Key als Umgebungsvariable vor dem Start setzen (PowerShell, kein `.env.local`
— siehe Hinweis oben):

```bash
$env:ELEVENLABS_API_KEY="dein-key"
npm.cmd start
```

Key-Scope bewusst minimal: nur **Text zu Sprache** + **Sprache zu Text**
freigeschaltet, Rest auf "Kein Zugang". "Bei Leaks automatisch deaktivieren"
an, IP-Einschränkung aus.

**Wichtig:** der API-Key wurde einmal im Chat eingegeben — Claude trägt
Zugangsdaten grundsätzlich nie selbst ein, das bleibt bewusst eine
Nicolas-Aktion.

## Personas (Jarvis/Edith/Friday/Karen/Ultron)

Vier feste Stimmen für Jarvis (Sprache × Geschlecht) plus je eine für Edith,
Friday, Karen und Ultron:

| Persona | Sprache | Geschlecht | Voice ID |
|---|---|---|---|
| Jarvis | EN | männlich (Standard) | `JBFqnCBsd6RMkjVDRZzb` |
| Jarvis | EN | weiblich | `DIS307HFaAvJZzq496qM` |
| Jarvis | DE | männlich | `OwYx4Jd2f6DQax9m8SVa` |
| Jarvis | DE | weiblich | `NE7AIW5DoJ7lUosXV2KR` |
| Edith | EN | weiblich | `Xb7hH8MSUJpSbSDYk0k2` |
| Friday | EN | weiblich | *Platzhalter* — geliehen von Edith, siehe unten |
| Karen | EN | weiblich | *Platzhalter* — geliehen von Jarvis' weiblicher Stimme, siehe unten |
| Ultron | EN | männlich | *Platzhalter* — geliehen von Jarvis, siehe unten |

**Nur die aktiv gerade laufende Persona hört ihren Namen** (seit 2026-09-19,
`src/lib/voice.ts`s `matchWake`): Sagt man "Hey Edith" während Jarvis aktiv
ist, passiert nichts — `matchWake` testet nur noch das Namensmuster der
Persona, die laut Store gerade aktiv ist, nicht mehr alle fünf gleichzeitig.
Persona wechseln ist damit ein echter Sprachbefehl geworden ("Hey Jarvis,
wechsle zu Edith"), der ganz normal als Turn beim Modell ankommt und über das
`ui_voice`-Tool läuft — kein Namens-Treffer mehr, der die Konversation
stillschweigend umgeht. Nebeneffekt: das beiläufige Erwähnen einer anderen
Persona mitten im Gespräch kann jetzt nie mehr aus Versehen umschalten,
unabhängig davon, wie häufig der Name sonst im Alltag vorkommt. Vorher weckte
jeder der fünf Namen sofort als diese Persona, ganz ohne Sprachbefehl — das
ist der eigentliche Grund, warum Friday/Karen unten trotzdem noch ein
Pflicht-Präfix brauchen: das Risiko ist nicht mehr persona-übergreifend, aber
ihr eigener bloßer Name bleibt ein Wochentag bzw. ein geläufiger Vorname,
auch wenn genau diese Persona schon aktiv ist.

- **Weckwort pro Persona**: "Hey Jarvis"/"Hey Edith"/"Hey Friday"/"Hey
  Karen"/"Ultron" wecken ihn jeweils als diese Persona, schaltet automatisch
  Stimme *und* Verhalten um. Fehlhör-Varianten für Edith (aus echten Tests):
  edif, edis, eadith, edeeth, eative, itive, "eat it", "i diff" — bewusst
  **ohne** bloßes "eat" (zu häufiges normales Wort, hätte ständig falsch
  ausgelöst). Bei Friday/Karen ist das "Hey"/"Hi"/"Ok"/"Yo"-Präfix deshalb
  **pflicht** statt optional (`src/lib/voice.ts`, `WAKE_NAMES`), anders als
  bei Jarvis/Edith/Ultron, wo der reine Name reicht — "Friday" ist sonst ein
  normaler Wochentag, "Karen" ein geläufiger Vorname, hätten also ständig
  falsch ausgelöst.
- **Persönlichkeit** (`bridge/server.mjs`, System-Prompt-Abschnitt
  "Personas"): Edith ist knapper, kein "sir" (stattdessen "Nicolas"),
  nüchterner als Jarvis (Tony Starks Vermächtnis-System, nicht für
  Konversation gebaut). Friday ist Jarvis' lockerer, informellerer
  Nachfolger ("boss" statt "sir", oder gar nichts). Karen (Peter Parkers
  Anzug-KI, nicht Tonys) ist jünger, herzlicher, duzt eher als dass sie "sir"
  sagt. Ultron ist als einzige Persona bewusst **nicht** auf Seiten des
  Nutzers geschrieben — herablassend, trocken, leicht bedrohlich im Ton —
  liefert aber technisch immer eine vollständige, korrekte Antwort; die
  Attitüde ist Kostüm, keine Ausrede zum Verweigern. Auf Deutsch spiegelt
  sich das in der Anrede: Jarvis und Ultron bleiben förmlich ("Sie"), Edith,
  Friday und Karen duzen. F.R.I.D.A.Y. ist im Original ein echtes Akronym
  ("Female Replacement Intelligent Digital Assistant Youth") — der NAMES-Tab
  der Settings (`src/ui/Settings.tsx`, vormals "Akronyme" genannt, jetzt
  umbenannt weil nicht mehr jeder Eintrag ein Akronym ist) zeigt alle fünf
  Personas plus N.O.R.A.: echte Akronym-Ausschreibung wo es eine gibt
  (Jarvis/Edith/Friday/Nora), sonst eine kurze Beschreibungszeile (Karen/
  Ultron sind im Original reine Namen, kein erfundener Schriftzug).
- **Manuelle Umschaltung**: der Marken-Schriftzug oben links selbst (seit
  2026-09-16, siehe Abschnitt "Marken-Schriftzug ist jetzt der Persona-Picker"
  weiter unten — ersetzt das frühere separate Dropdown in der SYSTEMS-Leiste),
  und weiterhin auch im Einstellungs-Panel (weiblich für Jarvis bewusst
  nirgends als Knopf, nur per Sprachbefehl erreichbar), wirkt sofort ohne
  Sprachbefehl
- **Marken-Schriftzug oben links** ist ebenfalls persona-abhängig
  (`BRAND` in `src/store.ts`): "F.R.I.D.A.Y." (Fan-Backronym, im Film nie so
  ausgeschrieben), schlicht "KAREN" und "ULTRON" ohne Punkte (im Film nie als
  Akronym gestylt, deshalb eigene kurze Charakterzeile statt einer
  Pseudo-Ausschreibung: "Peter Parker's Suit AI" bzw. "Ultimate Robotic
  Network")
- **Platzhalter-Stimmen (Friday/Karen/Ultron)**: `PERSONAS` in
  `bridge/server.mjs` zeigt für alle drei vorerst auf eine bereits
  freigeschaltete fremde ID (Edith für Friday, Jarvis' weibliche Stimme für
  Karen, Jarvis' männliche Stimme für Ultron) statt zu schweigen oder auf
  die Browserstimme zurückzufallen — klingen also bis auf Weiteres wie die
  Persona, von der sie geliehen sind.
  Echte, eigene Stimmen brauchen denselben Weg wie bei Edith: Nicolas wählt
  auf elevenlabs.io eine Stimme, fügt sie über "Add to my voices" seinem
  Konto hinzu (der freie Plan verweigert sonst `402 payment_required` für
  Voice-Library-IDs über die API, siehe "Wichtige Falle" unten), und gibt mir
  die ID durch — dieses File ist bewusst nicht der Ort, um Kandidaten zu
  raten.
- Veronica und Pegasus sind reine Namens-Ideen, noch nicht gebaut (siehe
  `docs/personas.md`) — Veronica war ursprünglich bewusst gestrichen ("hat im
  Film keine sprechende Persönlichkeit"), jetzt aber wieder aufgenommen.

### Stimmen durchtesten mit V (seit 2026-09-16)

Taste **V** cycelt jetzt durch eine eigene Test-Liste von ElevenLabs-Stimmen,
komplett getrennt von den echten Persona-Stimmen oben — ein Druck auf V
spricht nur eine kurze Testzeile ("I am [Label].") mit der jeweiligen ID,
ändert aber nie `voiceState`, betrifft also nie eine echte Konversation.
Footer zeigt dabei "[Label] (N/M)" an.

Liste liegt in `bridge/server.mjs` (`VOICE_CANDIDATES`), aktuell:

| ID | Label |
|---|---|
| `Xb7hH8MSUJpSbSDYk0k2` | Edith: EN-GB female |
| `JBFqnCBsd6RMkjVDRZzb` | Jarvis: EN-GB male |

Zwei deutsche Kandidaten (`NlRO8ABjJNJNYaRaLiPJ` Jarvis DE male,
`DEZHhPbmb8LVZmWufkCh` Edith DE female) wieder rausgenommen — blieben trotz
Versuch bei `402 payment_required` hängen, offenbar wegen der
Sammlung-vs-My-Voices-Verwechslung oben. Re-hinzufügen, sobald sie
tatsächlich freigeschaltet sind.

**Wichtige Falle:** ElevenLabs' kostenloser Plan verweigert Voice-Library-IDs
über die API mit `402 payment_required` ("Free users cannot use library
voices via the API"), außer die Stimme wurde vorher im ElevenLabs-Konto
selbst über "Add to my voices" hinzugefügt. Nur Nicolas kann das freischalten
(erfordert Login bei ElevenLabs) — deshalb landen hier nur IDs, die er schon
hinzugefügt und mir durchgegeben hat, nicht geratene Kandidaten.

Änderung im Detail:
- `bridge/server.mjs`:
  - `PERSONAS`-Objekt (ersetzt die alte `VOICE_ID`-Konstante) — ein Eintrag ist
    entweder eine feste Voice-ID (string, wie bei `edith`) oder eine
    `{lang: {gender: id}}`-Tabelle (wie bei `jarvis`)
  - `voiceState`/`setVoice()`/`currentVoiceId()` verwalten den aktiven Zustand;
    `/tts`-Handler nutzt jetzt `currentVoiceId()` statt der alten Konstante
  - `GET`/`POST /voice`-Endpunkt (liest/setzt `{persona, lang, gender}`, ohne
    Agenten-Umweg — für Dropdown und Weckwort-Umschaltung)
  - System-Prompt: Abschnitt "Personas" (Charakterbeschreibung Edith: knapp,
    kein "sir", nüchterner); `msg.type === 'ask'`-Handler hängt bei aktiver
    Edith-Persona unsichtbar einen Hinweis an den Prompt an, damit das Modell
    auch bei weckwort-ausgelöstem Wechsel (ohne `ui_voice`-Tool-Aufruf) weiß,
    wer es gerade ist
- `bridge/ui.mjs`: `ui_voice`-Tool mit `persona`-Parameter (neben `lang`/`gender`)
  — Sprachbefehl wie "werde zu Edith" möglich
- `src/lib/voice.ts`: `WAKE_NAMES`-Registry + `matchWake()` — jeder
  registrierte Name ist ein eigenes Weckwort, `onWake(trailing, persona)` gibt
  mit, wer geweckt hat
- `src/App.tsx`: `onWake` postet bei erkanntem Namen sofort `{persona}` an
  `/voice` (Bridge) und an den lokalen Store — kein Agenten-Turn nötig, nur für
  die reine Stimmumschaltung
- `src/store.ts`: Feld `persona` (+ `setPersona`) — für Transkript-Label,
  Standby-Text, Footer-Hinweis und Marken-Schriftzug
- `src/lib/personaControl.ts`: `loadPersona()`/`switchPersona()` — gemeinsame
  Fetch/POST-Logik gegen `/voice`, von `VoiceSwitcher.tsx` **und**
  `Settings.tsx` genutzt, statt dupliziert
- `src/ui/VoiceSwitcher.tsx`: Dropdown in der SYSTEMS-Leiste. **Bug gefixt:**
  hielt anfangs einen eigenen lokalen Zustand statt direkt
  `useStore((s) => s.persona)` zu lesen — dadurch folgte es nicht, wenn das
  Weckwort (statt das Dropdown selbst) die Persona wechselte. Jetzt liest es
  den geteilten Store-Wert direkt
- `src/ui/Hud.tsx` / `src/ui/Suggestions.tsx`: Transkript-Label, Standby-
  Hinweis, Footer-Hinweis, "try saying"-Vorschlag und der Marken-Schriftzug
  lesen `persona` aus dem Store statt fest "JARVIS" zu zeigen

Offen: Friday, Karen (Stimmen noch auszusuchen) — je eine ElevenLabs-Stimme
wählen, dann als weitere `PERSONAS`-Einträge in `bridge/server.mjs` +
Weckwörter in `WAKE_NAMES` eintragen; das Muster ist durch Edith einmal
komplett durchexerziert, sollte schnell gehen. Weckwort-Fehlhörer für neue
Namen sind grundsätzlich Try-and-Tune — über die D-Diagnose beobachten, was
tatsächlich ankommt, dann `WAKE_NAMES` nachschärfen.

**Bug gefixt (2026-09-16):** Ediths Stimme klang laut Nicolas nicht weiblich —
und, wie sich beim genaueren Nachfragen zeigte, kam in echten Gesprächen
tatsächlich durchgehend die **Browserstimme**, nicht ElevenLabs überhaupt.
Zwei gemeldete Symptome, eine Ursache: die alte ID (`oW8bn5YtBB89X2nJ0DT9`)
ist auf Nicolas' Account offenbar gar nicht erreichbar, `fetchCloudAudio`
(`src/lib/tts.ts`) scheiterte deshalb bei jedem einzelnen Satz und fiel auf
die Systemstimme zurück — das sah nach "falsches Geschlecht" aus, war aber
"kein ElevenLabs" komplett. Der V-Taste-Testkandidat "Edith: EN-GB female"
(`Xb7hH8MSUJpSbSDYk0k2`, siehe "Stimmen durchtesten mit V" oben) war die
ganze Zeit über nachweislich erreichbar und weiblich — genau wie Jarvis'
echte Persona-ID zufällig identisch mit seinem eigenen V-Testkandidaten ist.
Fix: `PERSONAS.edith` in `bridge/server.mjs` auf dieselbe ID umgestellt.

## Einstellungs-Panel

`src/ui/Settings.tsx` — Pfeiltaste hoch oder Sprachbefehl ("open settings")
öffnet/schließt es. Optisch im Blade-Stil (`.pk-tl/tr/bl/br`-Eckklammern,
gleicher Rahmen/Gradient wie `.bl`), aber eine eigene Komponente statt der
sanitisierten Blade-Markup-Engine (`bridge/panels.mjs` lässt bewusst keine
`<form>`/interaktiven Elemente durch).

- **Öffnen/Schließen**: `src/store.ts` Feld `settingsOpen` (+ `setSettingsOpen`).
  `src/App.tsx`: Pfeiltaste hoch togglet es (nur außerhalb `offline`); neuer
  `watchUi`-Fall `'settings'` setzt es aus dem Bridge-Tool
- **Bridge-Tool** `ui_settings` (`bridge/ui.mjs`), Parameter `open` (bool,
  Default true) — emittiert `{type:'settings', open}` übers UI-Kanal
- **Stimme**: nutzt `personaControl.ts`, gleicher Mechanismus wie das Rail-Dropdown
- **Sprache**: siehe Abschnitt "Sprache" oben (`jarvis.speechLang` in
  localStorage + Reload)
- **Schriftgröße Rand**: CSS-Variable `--edge-scale` (Default `1`) auf
  `:root`; alle Rand-Textstellen (`.brand-mark`, `.brand-sub`, `.status`,
  `.rail`, `.rail-title`, `.hud-bottom`, `.suggest-lead`, `.suggest-text`,
  `.voice-select`) nutzen `calc(Npx * var(--edge-scale))` statt fixer
  px-Werte. Regler (0.7–1.8) schreibt
  `document.documentElement.style.setProperty('--edge-scale', ...)`,
  speichert in `localStorage` (`jarvis.edgeScale`)
- **Schriftgröße Chat**: zweite, unabhängige CSS-Variable `--chat-scale`, nur
  auf `.log-line`/`.log-who` (der zentrale Transkript-Text) — eigener Regler,
  eigener localStorage-Key (`jarvis.chatScale`). Bewusst getrennt vom
  Rand-Regler
- **Reiter** (`Tab` = `'general' | 'apis' | 'keybinds' | 'gestures' | 'colors'`,
  lokaler `useState` in `Settings.tsx`) — inzwischen fünf statt drei:
  - `general`: die Regler/Auswahl oben, plus mittlerweile ergänzt um
    **Audioausgabe** (Kopfhörer/Freisprechanlage, Store-Feld `headphones`),
    **Panel-Größe** (eigener Regler mit Entwurfswert + "Speichern"-Knopf,
    `--panel-scale` + `jarvis.panelScale`, bewusst nicht live wie die
    Schriftgrößen-Regler, damit das Fenster nicht bei jedem Tick ruckelt),
    **Verlauf löschen** (ein Klick löscht sofort — der ursprüngliche
    zweistufige "scharf schalten dann bestätigen"-Mechanismus ist auf
    Nicolas' Wunsch wieder raus, siehe "Einstellungen per Sprachbefehl"
    unten, wo der gleiche sofortige Charakter für den Sprachweg gefordert
    war) und **Beim Start** (Intro abspielen/überspringen, `jarvis.skipIntro`,
    wird von `App.tsx`s `powerOn()` gelesen)
  - `apis`: **echte Funktions-Schalter, keine Anzeige** — seit 2026-09-16 zwei
    davon, klar getrennt nach "was hört" und "was spricht" (vorher gab es nur
    den ersten, und der zweite lief unsichtbar automatisch):
    - **Zuhören (Spracherkennung)**: Gratis (Browser, `SpeechRecognition`,
      lokal, kostenlos) vs. Bezahlt (ElevenLabs Scribe). Schreibt
      `jarvis.sttPremium` in `localStorage` und **braucht "Aktualisieren"**
      (der gemeinsame Knopf ganz unten im Tab — bewusst für beide Zeilen
      zusammen, auf Nicolas' Wunsch, auch wenn Sprechen ihn technisch nicht
      braucht) (Engine wird nur einmal beim Boot gewählt, kein Umbau mitten in der
      laufenden Erkennung — gleiches Prinzip wie beim Sprache-Umschalter).
      `src/lib/voice.ts`s `startVoice()` liest beim Boot
      `caps().stt && sttWantsPremium()`: nur wenn **beides** zutrifft (Bridge
      meldet einen konfigurierten ElevenLabs-Key **und** der Schalter steht
      auf "Bezahlt") läuft `startElevenVoice()`, das jedes Sprachsegment per
      `POST /stt` ans Bridge-Backend schickt, welches es real an
      `https://api.elevenlabs.io/v1/speech-to-text` (Modell `scribe_v1`)
      weiterreicht — echter, kostenpflichtiger externer API-Call, kein Mock.
      Sonst (Standard) läuft `startBrowserVoice()`, komplett lokal, ohne
      jeden Netzwerk-Aufruf
    - **Sprechen (Sprachausgabe)**: Gratis (Browser-Systemstimme) vs. Bezahlt
      (ElevenLabs, die echte Charakterstimme). Schreibt `jarvis.ttsPremium`
      in `localStorage` — **braucht eigentlich keinen Reload**: `src/lib/tts.ts`s
      `synthesise()` liest `ttsWantsPremium()`
      frisch für jeden einzelnen Satz statt einmalig beim Boot, es gibt hier
      keinen langlebigen Loop, der neu gestartet werden müsste. Default ist
      Gratis (vorher lief ElevenLabs automatisch, sobald ein Key da war,
      siehe "Stimme (TTS)" oben) — `nativeBroken` (die
      Browserstimme-ist-kaputt-Rettung) darf ElevenLabs trotzdem erzwingen,
      selbst wenn Gratis eingestellt ist, weil die Alternative dort Stille
      wäre, nicht nur die günstigere Stimme
    - Beide Beschreibungstexte (Zuhören und Sprechen) stehen seit 2026-09-16
      nicht mehr als ein gemeinsamer Absatz unter beiden Knöpfen, sondern als
      zwei separate Texte nebeneinander — links unter Gratis, rechts unter
      Bezahlt (`.settings-note-pair` in `src/index.css`, rechter Text
      rechtsbündig) — auf Wunsch, weil es zwei unterschiedliche
      Beschreibungen waren, die wie eine gemeinsame aussahen
  - `keybinds`: statische Liste aus dem README-Controls-Table, reines
    Nachschlagewerk (`KEYBINDS`-Array in `Settings.tsx`), nichts editierbar
  - `gestures`: statische Liste der Handgesten (`MOVES`-Array, aus
    `GestureGuide.tsx` wiederverwendet), ebenfalls reines Nachschlagewerk
  - `colors`: Farbfeld + Phasenname + Kurzbeschreibung pro `Phase`, aus dem
    bereits vorhandenen `phaseColor`-Export in `src/store.ts` — auch rein
    informativ, keine Bearbeitung
- Bewusst erweiterbar angelegt ("weitere Dinge später") — zwei der
  ursprünglich als Nachschlagewerk gedachten Reiter (`apis`, `gestures`) sind
  seither dazugekommen; `apis` ist der erste Reiter mit echter Funktion statt
  nur Anzeige

Live getestet (isolierte Vorschau, inkl. manueller localStorage-Injektion für
den Chat-Verlauf): Panel öffnet/schließt per Pfeiltaste, alle drei Reiter
rendern korrekt, Stimm-Wechsel wirkt sofort (Footer-Hinweis ändert sich mit),
beide Schriftgrößen-Regler skalieren live und unabhängig voneinander
(computed `font-size` von `.log-line` per JS bestätigt: 14px → 22.4px bei
Faktor 1.6).

**Prompt-Fix eingebaut (2026-09-15), Verifikation steht noch aus:** Auf Zuruf
("open settings" o.ä.) hat das Modell schon mal **nicht** dieses echte Panel
geöffnet, sondern sich stattdessen selbst eine "INTERFACE SETTINGS"-Blade über
das normale `display`/`blade`-Markup-Tool zusammengebaut — nur eine statische
Anzeige, keine echten Regler. Vermutliche Ursache: die Blades-Sektion im
System-Prompt behauptete absolut, es gebe "nirgends sonst" eine Anzeigefläche,
ohne die Ausnahme für echte interaktive UI wie das Settings-Panel zu nennen —
das überstrahlte offenbar die eigentlich schon vorhandene `ui_settings`-
Beschreibung. Gegenmaßnahme: `bridge/server.mjs` nennt die Settings-Ausnahme
jetzt explizit in der Blades-Sektion, `bridge/ui.mjs` (`SETTINGS_DESCRIPTION`)
warnt zusätzlich direkt am Tool davor, eine Fake-Blade zu bauen. Da LLM-
Tool-Wahl nicht deterministisch ist, braucht das noch einen echten Test mit
Sprachbefehl, bevor es als erledigt gilt.

## Schriftsprache — Anzeigesprache der Beschreibungen (seit 2026-09-16)

Neuer Schalter im Einstellungs-Panel (general-Tab), direkt unter
"Audioeingabe": **"Schriftsprache — nur Beschreibungen"**, English/Deutsch.
Bewusst eng zugeschnitten, nach kurzer Planungsrunde vor dem Bauen:

- **Ändert**: die längeren Erklärtexte im Panel — Keybinds-"does"-Spalte,
  Gestures-"does"-Spalte (dasselbe `MOVES`-Array, das auch das kurze
  Kamera-Overlay speist), die Kurzbeschreibungen im Colors-Tab, der
  Erklärtext im APIs-Tab — **und** die kürzeren Zusätze hinter ein paar
  Zeilennamen im general-Tab (z.B. "Audioeingabe — *restarts recognition*",
  "Schriftgröße (*Edge*)"). Auch das sind Beschreibungen, nur kürzere —
  fielen in der ersten Fassung noch durchs Raster, bis Nicolas das anhand
  eines Screenshots nachgefragt hat.
- **Ändert nicht**: die eigentliche Konversationssprache (dafür `ui_voice`/
  Weckwort), die Panel-Titel und Tab-Namen selbst (General/APIs/Keybinds/…,
  "Audioeingabe", "Schriftsprache", "Schriftgröße", "Panel-Größe", "Verlauf"),
  und die Markennamen samt Taglines (J.A.R.V.I.S. / "Just A Rather Very
  Intelligent System", E.D.I.T.H. / "Even Dead, I'm The Hero") — das ist
  Identität, keine zu übersetzende Beschreibung.
- Kein Reload nötig, anders als `SPEECH_LANG`/STT-Engine — reine
  Render-Entscheidung, greift sofort.
- Default Deutsch (`jarvis.uiLang` in `localStorage`, fehlender Key zählt als
  Deutsch).

Änderung im Detail:
- `src/lib/i18n.ts` (neu): `Lang`/`Localized`-Typen, `uiLang()`/`setUiLang()`
  (localStorage-Zugriff) und `t(text, lang)` (wählt die passende Hälfte)
- `src/ui/GestureGuide.tsx`: `MOVES`s `does`-Feld von `string` auf
  `Localized` umgestellt, Render nutzt `t(m.does, uiLang())`
- `src/ui/Settings.tsx`: eigener `lang`-State (reagiert sofort, anders als
  `SPEECH_LANG`/STT, die erst nach Reload wirken); `KEYBINDS`/`PHASE_WHY` auf
  `Localized` umgestellt (dabei nebenbei die veraltete V-Beschreibung
  korrigiert), neue `STT_NOTE`/`AUDIO_IN_NOTE`/`UI_LANG_NOTE`/
  `EDGE_SCALE_NOTE`/`CHAT_SCALE_NOTE`/`PANEL_SCALE_NOTE`-Konstanten; die
  Zeile "Sprache" heißt jetzt "Audioeingabe — …", direkt darunter die neue
  Schriftsprache-Zeile

## Tastenkürzel (Ergänzungen)

| Taste | Wirkung | Wo |
|---|---|---|
| **→** (Pfeil rechts) | Boot-Animation überspringen (inkl. Ton) | `src/App.tsx` (`skipBoot`-Ref), `src/lib/music.ts` (`stopAll()`) |
| **↓** (Pfeil runter) | Standby — gleiche Wirkung wie Escape | `src/App.tsx` (ruft `goDormant()`) |
| **↑** (Pfeil hoch) | Einstellungs-Panel auf-/zuklappen | `src/App.tsx`, `src/ui/Settings.tsx` |
| **Enter** / **Space** (seit 2026-09-16) | Verstecktes Textfeld öffnen, um zu tippen statt zu sprechen | `src/App.tsx` (`onKey`), `src/ui/TextInput.tsx` |
| **L** (seit 2026-09-16) | Turn ohne Weckwort starten — Nachfolger der alten Space-Funktion, siehe unten. Zweites L während er wach/hörend ist schickt ihn stattdessen in Standby (Toggle) | `src/App.tsx` (`onKey`) |

## Text-Eingabe (seit 2026-09-16)

Löst den alten "Offen/geplant"-Punkt unten ein. `src/ui/TextInput.tsx` — ein
verstecktes `<input>`, das per **Enter** oder **Space** erscheint (fokussiert
sich automatisch) und über `App.tsx`s `submitText()` in dieselbe
`respond()`-Pipeline einspeist, die auch Sprache nutzt — die Antwort kommt
also weiterhin vorgelesen zurück, nur der Weg der Frage rein ist ein anderer.

- Bleibt nach dem Senden offen und fokussiert (nur geleert), statt sich zu
  schließen — ein Enter-zum-Aufklappen vor jeder einzelnen Nachricht in einem
  Hin und Her war die falsche Abwägung. Enter auf bereits leerem Feld,
  Escape oder Fokusverlust schließen es
- Unterbricht eine laufende Antwort genau wie `onSpeechStart` bei Sprache
  (Turn-Zähler hoch, `interrupt()`, `silence()`), bevor der neue Text als
  Turn losgeht
- Space startet damit keinen gesprochenen Turn mehr ohne Weckwort — diese
  Funktion ist auf **L** umgezogen (siehe Tastenkürzel-Tabelle oben)

**Bug gefixt:** Platzhaltertext stand fest auf "Type to JARVIS…", auch mit
aktiver Edith. `TextInput` bekommt jetzt `persona` als Prop von `App.tsx`
(dort neu als `useStore((s) => s.persona)` gelesen, vorher nirgends im
Component gebraucht) und baut den Platzhalter daraus.

## Bedienelemente in der SYSTEMS-Leiste (seit 2026-09-16)

Drei Buttons unter dem Marken-Schriftzug/Stimm-Dropdown, eigener Stil
(`.rail-btn`, `src/index.css`) statt im Einstellungs-Panel versteckt — sollen
laut Nicolas einzeln im UI stehen, nicht in Settings:

- **MIC ON/OFF** — Store-Feld `micOff` (`src/store.ts`), **persistiert seit
  2026-09-16 in `localStorage`** (`jarvis.micOff`, gleiches Muster wie
  `headphones`) — auf ausdrücklichen Wunsch, session-übergreifend, statt wie
  ursprünglich gebaut bei jedem Reload auf "an" zurückzuspringen. `App.tsx`s
  `mode()` prüft es ganz zuerst und liefert `'deaf'`, egal welche Phase gerade
  läuft — kein Weckwort, keine VAD, keine Transkription. Rot markiert
  (`.muted`) wenn aktiv.
  Wirkt zusätzlich auf die SIGNAL-Anzeige rechts (siehe unten) und spart
  echte Rechenzeit: `App.tsx`s `pump()`-Loop überspringt bei `micOff` den
  `micLevel()`-Aufruf (ein echter FFT-Read pro Frame) komplett, statt nur das
  Ergebnis am Ende zu verwerfen
- **RELOAD** — schlicht `location.reload()`. Kein echter "harter" Cache-Bypass
  möglich (Browser erlauben das per JS nicht mehr), macht bei einem
  Vite-Dev-Server aber praktisch keinen Unterschied
- **SETTINGS** — öffnet/schließt das Einstellungs-Panel (`setSettingsOpen`),
  gleiche `phase !== 'offline'`-Sperre wie die Pfeiltaste-hoch. Vorher gab es
  dafür gar keinen sichtbaren Button, nur Taste ↑ oder Sprachbefehl

**SIGNAL-Anzeige bei Mute:** zeigt "MUTED" statt Prozentzahl, Balken bleibt
auf 0%, Titel und Text färben sich rot (`.rail-title.muted`,
`.rail-item.muted`) — gleicher Rotton wie der MIC-OFF-Button, damit beide als
ein Zustand statt zwei unabhängige Anzeigen lesen.

## Marken-Schriftzug ist jetzt der Persona-Picker (seit 2026-09-16)

Das separate Dropdown in der SYSTEMS-Leiste ist weg — `VoiceSwitcher.tsx`
rendert stattdessen direkt den Marken-Schriftzug oben links ("J.A.R.V.I.S."/
"E.D.I.T.H.") als `<select>`, aber komplett von nativer Select-Optik befreit
(`.brand-select` in `src/index.css`: kein Rahmen, kein Hintergrund, kein
Pfeil) — sieht im Ruhezustand exakt wie der alte reine Text aus, nur der
Mauszeiger verrät beim Hovern, dass sich etwas öffnen lässt. Fällt auf
normalen, nicht-interaktiven Text zurück, solange die Bridge-Persona noch
lädt oder kein Bridge-Modus aktiv ist, damit der Schriftzug nie kurz
verschwindet. `BRAND`-Mapping (Marken-Text pro Persona) liegt jetzt in
`src/store.ts`, exportiert, statt lokal in `Hud.tsx` — beide Komponenten
teilen sich dieselbe Quelle.

**Stolperstein beim Bauen:** `.brand-select`s Reset nutzte zuerst
`font: inherit` — das ist eine Kurzform und setzt auch Schriftgröße/-gewicht
zurück, nicht nur die Familie, wodurch der Schriftzug auf normale Textgröße
schrumpfte. Fix: nur `font-family: inherit`.

## Einstellungen per Sprachbefehl (`ui_prefs`, seit 2026-09-16)

Auf Zuruf ("stell die Kamera an", "reload die Session", "lösch den
Chatverlauf") kann JARVIS jetzt **jeden** Schalter aus dem Einstellungs-Panel
und der SYSTEMS-Leiste selbst betätigen — nicht nur die drei genannten
Beispiele, auf ausdrücklichen Wunsch gleich der komplette Umfang statt eines
kleineren ersten Schritts. Persona/Sprache/Geschlecht der Stimme (`ui_voice`)
und das Öffnen/Schließen des Panels (`ui_settings`) hatten das schon vorher —
dieses neue Tool deckt den Rest ab:

**Nachträglich nicht mehr ganz "jeder Schalter":** das general-Tab bekam
später (2026-09-23) noch den Schreibmodus-Schalter ("Auch vorlesen"/"Nur
schreiben", `textOnly`/`setTextOnly` in `src/store.ts`) dazu, ohne `ui_prefs`s
Schema (`bridge/ui.mjs`, `prefsSchema`) oder `App.tsx`s `'prefs'`-Fall
entsprechend zu erweitern — ein Sprachbefehl kann ihn deshalb bis auf Weiteres
nicht umschalten, nur Klick im Panel.

| Feld (Tool-Parameter) | Wirkung | Entspricht |
|---|---|---|
| `headphones` | Kopfhörer/Freisprechanlage | general-Tab |
| `mic` (`on`/`off`) | Mikrofon komplett stumm/aktiv | MIC-Button (Rail) |
| `gestures` (`on`/`off`) | Kamera + Handerkennung an/aus | Taste G |
| `ui_lang` (`en`/`de`) | Schriftsprache (nur Beschreibungen) | general-Tab |
| `recognition_lang` (`en`/`de`) | Audioeingabe-Sprache — **reload sofort** | general-Tab |
| `stt_engine` (`free`/`premium`) | Zuhören-Engine — **reload sofort** | APIs-Tab |
| `tts_engine` (`free`/`premium`) | Sprechen-Engine — **live, kein reload** | APIs-Tab |
| `skip_intro` | Intro bei nächstem Boot überspringen | general-Tab |
| `edge_scale` / `chat_scale` / `panel_scale` | die drei Größen-Regler | general-Tab |
| `reload` | Seite neu laden | RELOAD-Button (Rail) |
| `clear_history` | Chatverlauf löschen, **sofort, ohne Rückfrage** | Verlauf-Button |

Zwei bewusste Zuschnitts-Entscheidungen, kurz abgefragt bevor gebaut wurde:

- **Voller Umfang statt nur der drei Beispiele** — Nicolas' Antwort auf
  Nachfrage, deshalb ein generisches Tool mit vielen optionalen Feldern
  (gleiches Muster wie `ui_theme`) statt mehrerer kleiner Tools.
- **Chatverlauf löschen ohne Rückfrage** — wie jedes andere `ui_*`-Tool auch;
  ein Sprachbefehl ist bereits die bewusste Handlung. Auf denselben Wunsch
  hin ist der zweistufige "wirklich löschen?"-Mechanismus im Panel-Button
  selbst gleich mit rausgeflogen (siehe "Einstellungs-Panel" oben) — beide
  Wege löschen jetzt gleich, sofort.

**Grenze, die man kennen sollte:** `edge_scale`/`chat_scale`/`panel_scale`/
`ui_lang`/`skip_intro` leben nicht im globalen Store, sondern nur als
`localStorage` + eigener React-State in `Settings.tsx` (siehe dessen
Kommentare). Ein Sprachbefehl setzt den echten Wert korrekt (CSS-Variable
und `localStorage` greifen sofort), aber falls das Panel in genau diesem
Moment offen ist, zeigt sein Regler/Knopf die neue Position erst nach
erneutem Öffnen — ein rein kosmetischer, selbstheilender Randfall, kein
Korrektheits-Bug. `headphones`/`mic`/`gestures`/Persona sind dagegen im
Store und überall sofort korrekt, auch bei offenem Panel.

**Noch nicht live getestet:** insbesondere der Kamera-Pfad (`gestures: 'on'`)
— `hands.enableHands()` fragt beim allerersten Mal nach Kamera-Erlaubnis,
und ob das aus einem WebSocket-Callback heraus (statt einem echten Tastendruck)
zuverlässig funktioniert, hängt vom Browser ab. Sollte laut MDN/Chrome-
Verhalten gehen, sobald die Erlaubnis für diese Seite einmal erteilt wurde
(z.B. durch die Taste G), aber ein echter Sprachtest steht noch aus.

**Reload wartet 2,5s, statt sofort zu feuern:** `recognition_lang`,
`stt_engine` und `reload` legen die eigentliche Seite-neu-laden-Aktion in
einen `setTimeout` statt sie synchron beim Empfang des UI-Events auszulösen.
Grund: ein Reload räumt die Seite (und damit jede laufende Audiowiedergabe)
sofort weg — ohne die Verzögerung hätte JARVIS keine Chance, den vom
Tool-Text geforderten kurzen Warnsatz ("Updating now, sir") tatsächlich zu
Ende zu sprechen, bevor die Seite unter ihm verschwindet. 2,5s ist grob
bemessen (ElevenLabs-Rundreise plus ein kurzer Satz), kein exaktes Timing an
die tatsächliche Sprachausgabe gekoppelt.

Änderung im Detail:
- `bridge/ui.mjs`: neues Tool `ui_prefs` (`prefsSchema`/`PREFS_DESCRIPTION`),
  snake_case-Parameter rein (gleiche Konvention wie `ui_chrome`s `tool_badge`),
  emittiert ein camelCase-Patch-Objekt (`{type:'ui', op:'prefs', args}`).
  Beschreibungstext verlangt jetzt explizit einen kurzen gesprochenen
  Warnsatz vor jeder der drei reload-auslösenden Aktionen
- `bridge/server.mjs`: SYSTEM_PROMPT-Abschnitt "The interface itself" nennt
  jetzt auch `ui_prefs`
- `src/App.tsx`: neuer `watchUi`-Fall `'prefs'`, wendet jedes mitgegebene
  Feld an; `recognition_lang`/`stt_engine`/`reload` laufen bewusst zuletzt
  und über die neue `delayedReload()`-Funktion (`PREFS_RELOAD_DELAY_MS`,
  2500ms) statt einem direkten `location.reload()`. Der G-Tasten-Handler ist
  dabei nebenbei refaktoriert: die async Kamera-Erlaubnis-Logik lebt jetzt in
  einer eigenen Modul-Funktion `setGesturesOn()`, von Taste G **und**
  `ui_prefs` genutzt, statt dupliziert
- `src/lib/prefs.ts` (neu): `EDGE_SCALE_KEY`/`CHAT_SCALE_KEY`/
  `PANEL_SCALE_KEY`/`SKIP_INTRO_KEY` plus Lese-/Schreibfunktionen — einzige
  Quelle für diese vier Keys, von `Settings.tsx` (Lesen fürs eigene
  `useState`) und `App.tsx` (Schreiben aus `ui_prefs`) gemeinsam genutzt
- Kleines Aufräumen nebenbei, um doppelte Key-Strings zu vermeiden:
  `src/lib/voice.ts`s `STT_PREF_KEY` und `src/config.ts`s neue
  `SPEECH_LANG_KEY`-Konstante sind jetzt exportiert statt nur lokal benutzt,
  `Settings.tsx` importiert beide statt eigener Kopien

## Verhalten: Bestätigen und Planen (seit 2026-09-16)

Löst den "Bestätigung bei mächtigen Aktionen"-Punkt ein, der vorher unter
Offen/geplant stand — reine Prompt-Änderung in `bridge/server.mjs`s
`SYSTEM_PROMPT`, kein neuer Tool-Mechanismus. Zwei neue Abschnitte, direkt
vor "The blades" eingefügt (gleiche Stelle wie die anderen
Verhaltensregeln, vor allem Tool-spezifischen):

- **Bestätigen vor echter Wirkung**: Vor allem mit Effekt außerhalb des
  Bildschirms — Nachricht senden, öffentlich posten, kaufen/bezahlen,
  unwiederbringlich löschen/überschreiben, ein physisches Gerät steuern,
  eine Einstellung bei einem anderen Konto/Dienst ändern — soll JARVIS
  ausdrücklich sagen, was er vorhat, und **in einem eigenen Turn auf ein
  klares Ja warten**, statt nur anzukündigen und direkt zu handeln.
  Begründung direkt im Prompt: die Fehlhör-Varianten-Liste fürs
  Edith-Weckwort beweist selbst, wie oft die Spracherkennung danebenliegt.
  Alles Reversible/Ungefährliche (Nachschlagen, Blade öffnen, eigene
  Oberfläche umfärben, eigene Einstellungen ändern, eine Seite lesen)
  braucht das ausdrücklich nicht.
  - Der bisherige, schwächere Hinweis nur für den Browser-Abschnitt
    ("say in one sentence what you are about to do" — ankündigen, aber
    direkt handeln) verwies auf genau diesen Fall, ohne wirklich zu warten.
    Ersetzt durch einen Verweis auf die neue, strengere Regel oben, damit
    Chrome-Aktionen (senden, posten, kaufen, löschen) nicht schwächer
    behandelt werden als alles andere mit echter Wirkung.
- **Erst planen bei größeren Aufträgen**: Wenn eine Anfrage nach mehreren
  echten Schritten aussieht statt nach einem — unklarer Zuschnitt, mehrere
  Seiten/Nachrichten, mühsam nochmal zu machen bei falscher Annahme — soll
  JARVIS das benennen und fragen, ob er zuerst einen Plan skizzieren soll,
  statt direkt loszulegen. Nach Zustimmung: Plan als Blade (kurz, konkret,
  nichts erfunden), fehlende Details währenddessen einzeln erfragen statt zu
  raten — sinngemäß das, was Claude Code selbst mit brainstorming/
  writing-plans macht, nur als Prompt-Verhalten statt als eigenes
  Skill-System (siehe unten, warum es kein echtes Skill-System werden kann).

Beides reine Verhaltensregeln, auf Modell-Befolgung angewiesen wie der Rest
des Prompts (z.B. die Settings-Fake-Blade-Falle oben) — nicht technisch
erzwungen, nichts hindert das Modell daran, eine Regel zu übergehen. Noch
nicht mit einem echten Sprachbefehl getestet.

**Frage von Nicolas: kann JARVIS auch "Superpowers" bekommen (die
Claude-Code-Skills wie brainstorming/systematic-debugging, die dieses
Claude-Code-Projekt selbst nutzt)?** Nein, nicht wörtlich — Superpowers ist
ein Claude-Code-**Plugin**, gebaut auf Mechanismen, die nur in der
Claude-Code-CLI existieren: das `Skill`-Tool, ein SessionStart-Hook, der die
"using-superpowers"-Einführung einspeist, ein Plugin-Cache-Ordner auf
diesem Rechner. JARVIS läuft dagegen auf dem **Claude Agent SDK**
(`bridge/server.mjs`, `@anthropic-ai/claude-agent-sdk`) — einem eigenen,
niedrigeren Baustein zum Bauen eigener Agenten, ohne das Plugin-/Skill-System
der CLI. Übertragbar ist nur der **Inhalt**, nicht der Mechanismus: die
beiden Abschnitte oben sind genau das — der Kerngedanke von
"brainstorming vor größeren Aufgaben" und "erst nachdenken, dann handeln",
von Hand in JARVIS' eigenen System-Prompt übersetzt, weil das die einzige
Form ist, die auf seiner Architektur tatsächlich ankommt. Die meisten
anderen Superpowers-Skills (test-driven-development, using-git-worktrees,
writing-skills, subagent-driven-development) passen ohnehin nicht zu dem,
was JARVIS tut — die sind für Softwareentwicklung gebaut, JARVIS führt
Gespräche, steuert die Oberfläche und den Browser.

## Limits-Tab (seit 2026-09-16)

Sechster Reiter im Einstellungs-Panel, neben general/apis/keybinds/gestures/
colors: **LIMITS**, zeigt drei ganz unterschiedliche Obergrenzen, jede auf
ihre eigene Art gelesen:

| Zeile | Woher | Live? |
|---|---|---|
| Claude | Bridge-eigene Agent-Session, über den WebSocket erfragt | Ja, bei jedem Öffnen des Tabs neu |
| ElevenLabs | `GET /usage/elevenlabs` an der Bridge, die den Key hält | Ja, bei jedem Öffnen des Tabs neu |
| Browser | Nichts abzufragen — reiner Referenztext | Nein, statisch |

**Claude (Fünf-Stunden-Fenster):** Das Claude Agent SDK hat eine
Methode `session.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET()`
(so benannt von Anthropic selbst — der Name wird sich ändern, sobald die API
stabil ist), die genau das liefert, wonach gefragt wurde:
`rate_limits.five_hour.utilization` (0–100%) und `.resets_at`. Nur gefüllt,
wenn `rate_limits_available` true ist — der Fall bei einem
claude.ai-Abo-Login wie diesem hier (siehe "Von Grund auf einrichten"),
nicht bei einem rohen API-Key. Experimentell, kann sich jederzeit ändern
oder verschwinden, deshalb defensiv aufgerufen (`typeof ... === 'function'`
geprüft, in try/catch) statt als garantiert vorhanden behandelt.

**ElevenLabs (Zeichen-Kontingent):** `GET https://api.elevenlabs.io/v1/user/subscription`
(mit `xi-api-key`), Felder `character_count`/`character_limit`/
`next_character_count_reset_unix` — dieselbe Art Aufruf wie `/tts`/`/stt`,
nur ohne Text/Audio im Body, weil es um den Account als Ganzes geht, nicht
um eine bestimmte Anfrage.

**Browser:** Kein Konto, kein Kontingent, nichts abzufragen — nur
Referenztext. Beantwortet nebenbei die eigentliche Sorge hinter der Frage
("eine Antwort mit 20k Zeichen könnte blockiert werden"): JARVIS zerlegt
jede Antwort schon vor dem Vorlesen satzweise (`SENTENCE_END`/`MAX_UNSPOKEN`
in `src/lib/tts.ts`, längst vor diesem Feature gebaut, aus einem ganz
anderen Grund — Streaming). Die größte einzelne Anfrage, die diese App
jemals verschickt, liegt bei rund 220 Zeichen. Recherchiert statt geraten:
ElevenLabs' Flash-Modell (hier verwendet) hat ein 5.000-Zeichen-Limit pro
Anfrage, Chromes `SpeechSynthesisUtterance` einen dokumentierten Hard-Cap
bei 32.767 Zeichen plus einen bekannten Chromium-Bug, bei dem sehr lange
Texte schon vorher lautlos abbrechen — 220 Zeichen liegt so oder so weit
darunter.

Änderung im Detail:
- `bridge/server.mjs`: neuer `msg.type === 'usage'`-Fall im WebSocket-Handler
  (ruft die SDK-Methode defensiv auf, schickt `{type:'usage', data}` oder
  `{type:'usage', error}` zurück); neuer HTTP-Endpunkt `GET /usage/elevenlabs`
- `src/lib/bridge.ts`: `requestUsage()`/`watchUsage()`, gleiches Ein-Callback-
  Muster wie `watchUi` — ein Request, eine Antwort, nicht gepusht
- `src/lib/brain.ts`: `requestClaudeUsage()`/`watchClaudeUsage()`, dünne
  Fassade wie der Rest der Datei
- `src/lib/limits.ts` (neu): `fetchClaudeUsage()`/`fetchElevenLabsUsage()` —
  verpacken beide den WS-Umweg bzw. den HTTP-Call in ein einfaches Promise,
  damit `Settings.tsx` nur `.then(setState)` braucht
- `src/ui/Settings.tsx`: neuer Tab, holt beide Werte per `useEffect` neu,
  jedes Mal wenn der Tab aktiv wird (kein Live-Push wie beim Rest des Panels)

## Zwei Bugfixes (2026-09-16)

**Persona-Wechsel per Chat-Befehl zeigte sich nicht:** Ein gesprochener/
getippter Befehl wie "switch to edith" (das `ui_voice`-Tool) änderte den
Bridge-internen `voiceState` korrekt — das Modell wusste danach schon
"Already EDITH" — aber die Seite bekam nie Bescheid. Grund: `ui_voice`s
Handler in `bridge/ui.mjs` rief nach einem erfolgreichen `setVoice()` nie
`emit()` auf, anders als z.B. `ui_settings` direkt darunter. Transkript-Label
und Marken-Schriftzug blieben deshalb auf der alten Persona hängen, egal was
das Modell tatsächlich gesagt hat. Das ist ein anderer Bug als der oben unter
"Personas" dokumentierte VoiceSwitcher-Fix (der war ausschließlich für das
Dropdown, das damals nicht auf den Store gehört hat) — hier fehlte der
Info-Versand von der Bridge komplett, nur für den Tool-Weg. Fix: `ui_voice`
schickt jetzt `emit('voice', {persona})`, und `App.tsx`s `watchUi` hat einen
neuen `'voice'`-Fall, der `setPersona` aufruft — genau das, was Weckwort und
Settings-Buttons ohnehin schon direkt machen.

**Stiller Audio-Ausfall bei totem AudioContext:** `src/lib/tts.ts`s
`outputContext()` hält bewusst einen einzigen AudioContext über die ganze
Sitzung (Chromes Limit liegt bei ~6 gleichzeitigen Contexts), prüfte aber nie,
ob der zwischenzeitlich in den Zustand `closed` gerutscht ist. Passiert das,
liefert die Funktion trotzdem den toten Context zurück — `playUrl()`s
`ctx.createMediaElementSource(audio)` wirft dann eine Exception (abgefangen,
"the analyser is a nice-to-have"). Das Tückische: `createMediaElementSource`
**kapert das `<audio>`-Element bereits beim Aufruf**, bevor die Exception
fliegt — das Element ist damit von seiner normalen Lautsprecher-Ausgabe
getrennt, ohne je am `ctx.destination` anzukommen. `audio.play()` "funktioniert"
technisch (kein Fehler), aber es kommt kein Ton raus, und der Level-Fallback
(`outLevel = read ? read() : 0.4`) zeigt einen konstanten Fake-Ausschlag, der
wie echte Sprachaktivität aussieht — sichtbar u.a. daran, dass die SIGNAL-
Anzeige sich bewegte, obwohl kein Ton lief. Fix: `outputContext()` baut den
Context neu auf, sobald er `closed` ist, statt den toten für immer
wiederzuverwenden.

## Kleinere Fixes (2026-09-17)

- **Footer-Hinweiszeile entfernt**: die feste Zeile am unteren Bildschirmrand
  ("Enter to type · G hands · V voice: …") komplett raus, auf Nicolas' Wunsch.
  `src/ui/Hud.tsx`: das `<footer className="hud-bottom">`-Element entfernt,
  dazu die dadurch überflüssig gewordene `voice`-Store-Subscription (nur noch
  dort gelesen). `src/index.css`: die `.hud-bottom`-Regel gestrichen sowie zwei
  Abstands-Kommentare bei `.text-input`/`.error`, die sich nur noch auf die
  jetzt gelöschte Klasse bezogen hätten — die Abstandswerte selbst unverändert
  gelassen (ungeprüft, ob sie jetzt großzügiger sind als nötig).
- **Vier fehlende Keybinds in den Settings ergänzt**: beim Abgleich der
  `KEYBINDS`-Liste (`src/ui/Settings.tsx`) gegen den tatsächlichen Code fehlten
  **E** (Blade auf-/zuklappen), **X** (Blade schließen), **]**/**[** (zur
  nächsten/vorherigen Blade) komplett — alle vier real in `src/ui/Blades.tsx`
  implementiert (aktiv, sobald mindestens eine Blade offen ist), aber nie in
  die Liste eingetragen. `README.md`s Controls-Tabelle hat denselben Stand
  (fehlt dort ebenfalls, dazu noch veraltete Space-Beschreibung) — bewusst
  nicht mit angefasst, da nicht angefragt.
- **`clear_history` bestätigte per Sprache trotz gegenteiliger Tool-Beschreibung**:
  `bridge/server.mjs`s allgemeine "vor echter Wirkung bestätigen"-Regel
  (Abschnitt "Verhalten: Bestätigen und Planen" oben) zählt "deleting …
  cannot be brought back" ausdrücklich zu den bestätigungspflichtigen Fällen —
  trifft wörtlich auch auf `clear_history` zu, obwohl dessen eigene
  Beschreibung in `bridge/ui.mjs` "no confirmation and no way back" verlangt.
  Zwei widersprüchliche Anweisungen im selben Prompt; das Modell folgte in der
  Praxis der strengeren. Fix: explizite Ausnahme direkt in der allgemeinen
  Regel ergänzt — `clear_history` wischt nur den sichtbaren Verlauf auf diesem
  Bildschirm, zählt deshalb als Einstellungsänderung am eigenen Interface, nicht
  als die Art von echtem Löschen, die die Regel meint.

## N.O.R.A. — Notizen auf Zuruf, mit eigenem Panel (seit 2026-09-17)

Erster Schritt beim "Gedanken festhalten"-Punkt aus Offen/geplant (siehe dort).
Startete als reines Tool ohne sichtbare Oberfläche, wuchs im selben Gespräch zu
einem eigenen Live-Panel — Nicolas wollte einen sichtbaren "Tab", der beim
Diktieren live mitschreibt, nicht nur eine stille Bestätigung. Bewusst trotzdem
**kein** eigener Diktier-Modus im Sinne von "JARVIS antwortet währenddessen gar
nicht mehr" (die ursprünglich verworfene Option, siehe unten) — alles läuft
weiterhin über normale Tool-Aufrufe im laufenden Gespräch, nur mit eigener
Anzeige und einem Stille-Timer obendrauf.

**Ablauf**: Cue **"Starte Nora"** / **"Start project Nora"** — ein Rufname für
dieses eine Panel, kein Persona-Wechsel wie "Hey Edith". Allein gesagt →
`nora_open` (Panel geht leer auf). Direkt mit einer Idee im selben Satz →
`nora_note` allein reicht, öffnet das Panel implizit mit. Jede weitere Idee
während das Panel offen ist: ein weiterer `nora_note`-Aufruf, erscheint sofort
als neue Zeile im Panel. Ende entweder durch **"save & close Nora"**
(`nora_close`) oder von selbst nach **30 Sekunden ohne neue Zeile**.

**Wo das Sichern passiert vs. wo das Schließen passiert** — bewusst getrennt:
jeder `nora_note`-Aufruf schreibt sofort einzeln an `bridge/nora.md` anhängend
(siehe unten), nicht erst gesammelt beim Schließen. "Schließen" (ob durch die
Phrase oder den Timer) ist dadurch nie ein Save-Schritt, nur noch ein
Wegräumen der Anzeige — ein Absturz oder eine geschlossene Verbindung
mitten im Diktat verliert dadurch nie eine bereits gesagte Zeile. Nach außen
liest sich das trotzdem als "save & close", weil am Ende beides wahr ist.

**Speicherort**: `bridge/nora.md`, das Gegenstück zu `bridge/context.md` —
Nicolas schreibt context.md von Hand im Voraus, JARVIS schreibt nora.md selbst,
laufend während des Gesprächs. Gleiches Verzeichnis, gleiches Format (einfaches
Markdown), keine `.gitignore`-Ausnahme (gleiche Begründung wie bei context.md:
das Repo ist privat). Jeder `nora_note`-Aufruf eine eigene Überschrift mit
Zeitstempel (`## 2026-09-17 16:04`), gefolgt vom Text — mehrere Aufrufe in
einer Sitzung ergeben also mehrere kurz aufeinanderfolgende Blöcke, nicht
einen zusammengefassten. Die Datei existiert erst nach dem ersten
gespeicherten Gedanken (`appendFile` legt sie bei Bedarf an).

**Codename gefunden über zwei Nachfragen**: erste Runde
(S.C.R.I.B.E./Q.U.I.L.L./A.R.C.H.I.V.E.) auf Wunsch nach einem Frauennamen
verworfen; aus der zweiten Runde (C.L.I.O./I.R.I.S./N.O.R.A., alle mit
Backronym) fiel die Wahl auf **N.O.R.A.** — "Notes & Observations Recording
Assistant". Der ausgeschriebene Name steht im COMMANDS-Reiter der Settings
(siehe unten) und als Untertitel im Panel-Kopf selbst.

**Sicherheits-Gate, differenziert pro Tool statt pro Server**: `nora_note`
ist ein echter Schreibzugriff auf die Festplatte, deshalb bewusst NICHT wie
`jarvis`/`jarvis_ui` serverweit in `decideTool()` auf die Immer-erlaubt-Liste
gesetzt — fällt durch die normale Verb-Erkennung (weder `EFFECTFUL_VERB` noch
`READ_VERB` trifft auf `nora_note` zu) und landet damit hinter
`JARVIS_ALLOW_WRITES=1`, genau wie jeder andere Schreibzugriff. `nora_open`/
`nora_close` dagegen rühren nie an die Festplatte — reine Bildschirmzustände,
wie jedes `ui_*`-Tool — und wären ohne Gegenmaßnahme trotzdem mitgesperrt
gewesen (keins der drei Namen beginnt mit einem erkannten Lese-Verb, alle drei
wären sonst im Ablehnungs-Standardfall gelandet). Neue, gezielte Ausnahme
`ALWAYS_ALLOWED_TOOLS` in `bridge/server.mjs` (Schlüssel `server__tool`,
gleiche Form wie das bestehende `VETO_EXEMPT`) erlaubt genau `nora_open` und
`nora_close` einzeln, ohne `nora_note` mit freizugeben. Ohne
`npm run bridge:writes` öffnet/schließt das Panel also ganz normal — nur das
tatsächliche Sichern auf Platte bleibt bis dahin verweigert.

**Vorlesen/Zusammenfassen/Nachfragen (seit 2026-09-23)**: viertes Tool
`nora_read` (`bridge/nora.mjs`) — reiner Lesezugriff, rührt `bridge/nora.md`
nie an (anders als `saveThought`, kein `appendFile`/`writeFileSync`/Commit).
Gibt den kompletten gespeicherten Text ans Modell zurück, das ihn selbst
vorliest, zusammenfasst oder nach einem bestimmten Detail durchsucht — kein
eigener Such-/Zusammenfassungs-Mechanismus nötig, die Datei ist kurz genug
für ein flaches "jedes Mal komplett lesen". Funktioniert jederzeit im
Gespräch, ohne "Starte Nora" davor, ohne offenes Panel. Bei leerer/fehlender
Datei sagt das Modell das ausdrücklich ("No notes saved yet, sir") statt zu
raten oder zu schweigen — gleiches Graceful-Degradation-Muster wie
`personalContext()`/`knownPlaces()`.

Steht **nicht** in der `nora_open`/`nora_note`/`nora_close`-Lebenszyklus-Kette
— eigenständig, kein Panel-Zustand. Wie `nora_open`/`nora_close` beginnt der
Toolname `nora_read` nicht mit einem von `decideTool()`s `READ_VERB`-Regex
erkannten Verb (der Regex prüft ab Zeichen 1, "nora_" steht davor) — deshalb
in `ALWAYS_ALLOWED_TOOLS` (`bridge/server.mjs`) statt sich automatisch
freizuschalten.

**Grenze, die man kennen sollte**: der 30-Sekunden-Timer misst Stille seit der
letzten *Panel*-Zeile (`src/ui/Nora.tsx`, `useEffect` auf `noraText`), nicht
Stille im Gespräch allgemein — ob und wie lange JARVIS nach einer Antwort ohne
erneutes Weckwort auf eine Folge-Äußerung lauscht, ist eine Eigenschaft der
bestehenden Sprach-Loop (`src/lib/voice.ts`/`AWAIT_SPEECH_MS`) und wurde für
dieses Feature bewusst nicht angefasst.

Änderung im Detail:
- `bridge/nora.mjs`: drei Tools statt einem — `nora_open` (leeres Schema),
  `nora_note` (`{ text: string }`, wie zuvor, jetzt zusätzlich `emit('nora_append', …)`
  nach dem `appendFile`), `nora_close` (leeres Schema). Ein gemeinsamer
  `emit`-Callback, vom Aufrufer übergeben (Parameter `noraServer(emit)`,
  vorher parameterlos)
- `bridge/server.mjs`: `jarvis_nora: noraServer((op, args) => send({ type: 'ui', op, args }))`
  — nutzt denselben `{type:'ui', op, args}`-Kanal wie `jarvis_ui`, keinen
  eigenen; neues `ALWAYS_ALLOWED_TOOLS`-Set plus eine Zeile in `decideTool()`,
  direkt vor der `EFFECTFUL_VERB`-Prüfung; SYSTEM_PROMPT-Abschnitt "N.O.R.A."
  auf den open/note/close-Ablauf samt Timer-Hinweis erweitert
- `src/store.ts`: Felder `noraOpen`/`noraText` (nicht persistiert — anders als
  `turns` bewusst nicht über einen Reload hinweg gedacht), `setNoraOpen`
  (setzt/leert bei jedem Wechsel) und `appendNoraText` (hängt an, setzt
  `noraOpen` nebenbei auf `true` — damit `nora_note` ganz ohne vorherigen
  `nora_open`-Aufruf funktioniert)
- `src/ui/Nora.tsx` (neu): eigene, undraggable Komponente im Stil des
  Settings-Panels (gleiche `.pk`-Eckklammern, gleicher Glas-Look), kein
  vollwertiger Blade — Titel + ausgeschriebener Name, darunter die
  akkumulierten Zeilen, Auto-Scroll ans Ende bei neuem Text, ✕-Knopf für
  sofortiges Schließen. Der 30-Sekunden-Timer lebt komplett hier
  (`useEffect` auf `[open, text]`, `setTimeout` + `clearTimeout`), keine
  Bridge-Beteiligung
- `src/App.tsx`: drei neue Fälle im bestehenden `watchUi`-Switch —
  `nora_open`/`nora_append`/`nora_close`, rufen jeweils nur den passenden
  Store-Setter
- `src/index.css`: neuer `.nora-panel`-Block; dazu `.settings-key` ein
  `max-width: 42%` spendiert (siehe eigener Bugfix-Punkt unten — betrifft
  auch KEYBINDS/COMMANDS allgemein, nicht nur Nora)
- `src/ui/Settings.tsx`: neuer Reiter **COMMANDS** (`Tab`-Union erweitert um
  `'commands'`), eigenes `VOICE_COMMANDS`-Array nach demselben Muster wie
  `KEYBINDS` (Phrase + zweisprachige Beschreibung), aktuell mit dem einen
  Nora-Eintrag (inkl. ausgeschriebenem Namen) — als Sammelstelle für künftige
  benannte Sprachbefehle gedacht, nicht nur für Nora

**Bug gefixt, im selben Zug (2026-09-17):** der COMMANDS-Eintrag sprengte beim
ersten Test das Zeilen-Layout — `.settings-key` (`src/index.css`) hatte
`flex: 0 0 auto` ohne `max-width`, gedacht für ein bis zwei Zeichen wie "G"
oder "D". Ein langer Schlüsseltext (`"Starte Nora" / "Start project Nora"`,
38 Zeichen) beanspruchte trotzdem seine volle Ein-Zeilen-Breite, quetschte die
Beschreibungsspalte auf einen schmalen Streifen und erzeugte einen horizontalen
Scrollbalken im ganzen Panel. Mit Browser-DevTools nachgemessen (`scrollWidth`
vs. `clientWidth`), dann behoben: `max-width: 42%` auf `.settings-key` —
kurze Schlüssel bleiben unverändert, lange brechen jetzt auf mehrere Zeilen um
statt die Zeile zu sprengen. Betrifft KEYBINDS genauso wie COMMANDS, auch wenn
dort noch kein Eintrag lang genug war, um es sichtbar zu machen.

**Nachgefragt, gleicher Tag: ist Nora nur Jarvis bekannt, nicht Edith?**
Geprüft und verneint — `SYSTEM_PROMPT` ist eine einzige statische
Zeichenkette, für beide Personas identisch; der Abschnitt "Personas" ändert
nur Ton/Anrede, keine Werkzeug-Verfügbarkeit, und `decideTool()` fragt
nirgends die aktuelle Persona ab. Nora war also schon vorher für beide
gleichermaßen erreichbar — nur nirgends **ausdrücklich** festgehalten, eher
zufällig aus der Prompt-Struktur gefolgt. Auf Nicolas' Wunsch nach einer
klaren Trennung global/persona-spezifisch jetzt explizit gemacht, statt
implizit zu bleiben:

- **Konvention, im Prompt selbst verankert**: neuer Satz am Ende des
  "Personas"-Abschnitts in `SYSTEM_PROMPT` — jede Fähigkeit ist global
  (für jede Persona gleich verfügbar), sofern nicht direkt an ihrer eigenen
  Beschreibungsstelle explizit als persona-gebunden benannt. Heute ist nichts
  so benannt; N.O.R.A. ist also ausdrücklich global, nicht nur zufällig.
- **Bewusst kein Code-Gerüst dafür gebaut**: kein leeres `PERSONA_ONLY`-Set,
  keine ungenutzte Prüfung in `decideTool()` — es gibt aktuell keine einzige
  persona-gebundene Fähigkeit, die so etwas bräuchte, und totes
  Vorbau-Gerüst ist schlechter als der Tag, an dem es wirklich gebraucht wird,
  es sauber hinzuzufügen.
- **So würde eine echte persona-gebundene Fähigkeit später aussehen**:
  `decideTool()` wertet `voiceState.persona` schon jetzt live bei jedem
  Tool-Aufruf aus (kein statischer Prompt-Wert, sondern eine echte
  Modul-Variable) — ein zukünftiges Feature, das z.B. nur unter Edith
  funktionieren soll, bräuchte dort nur eine zusätzliche Prüfung nach
  demselben Muster wie `ALWAYS_ALLOWED_TOOLS`/`VETO_EXEMPT`
  (`server__tool`-Schlüssel), nicht mehr.

## N.O.R.A.: einheitliches Schließen, Tippen statt nur Diktieren (2026-09-17)

Drei weitere Nachfragen zu Nora, im selben Gespräch:

**1. "Beim generellen Schließen soll es speichern"** — jede einzelne Zeile
landet schon beim Diktieren sofort in `bridge/nora.md` (nicht erst beim
Schließen gesammelt), aber nur der Sprachbefehl "save and close Nora" gab
dafür je eine Bestätigung — der ✕-Knopf und der 30-Sekunden-Timeout schlossen
bisher stumm, ohne jedes Zeichen, dass etwas gespeichert wurde. Vereinheitlicht:

- `src/store.ts`: neues Feld `noraCloseReason: 'voice' | 'manual' | 'timeout' | null`
  plus eine einzige `closeNora(reason)`-Action, die `setNoraOpen(false)` als
  direkten Aufrufer komplett ersetzt — Ecke ✕-Knopf, 30-Sekunden-Timer
  (beide in `src/ui/Nora.tsx`) und `nora_close` (`src/App.tsx`s `watchUi`)
  rufen jetzt alle drei nur noch `closeNora` mit ihrem jeweiligen Grund auf.
- `src/ui/Nora.tsx`: zeigt bei jedem Schließen (alle drei Gründe) für 1,4
  Sekunden "✓ Saved to your notes." im Panel, bevor es tatsächlich
  verschwindet (`justClosed`-Lokalzustand, entkoppelt vom Store-Feld
  `noraOpen`, weil das schon auf `false` steht, sobald die Bestätigung
  überhaupt erst zu sehen sein soll).

**2. "Jarvis soll das [Hand-Schließen] erkennen und sagen — ohne es in den
Chat zu schreiben"** — für `nora_close` (Sprachbefehl) sagt das Modell
sowieso schon selbst etwas, als Teil des ganz normalen Tool-Ergebnis-Turns
("Saved and closed, sir") — das erscheint zu Recht im Transkript, es ist eine
echte Antwort auf eine echte Frage. Für die anderen beiden Gründe (✕-Knopf,
Timeout) passiert aber gar kein Agenten-Turn — es gibt nichts, das etwas
sagen könnte. Gelöst nach genau demselben Muster wie der Audio-Selbsttest auf
Taste T: `src/App.tsx` bekommt einen neuen `useEffect` auf `noraCloseReason`,
der für `'manual'`/`'timeout'` (nicht für `'voice'`) einen frischen
`createSpeaker()` erzeugt, auf `speaker.current` legt (barge-in-fähig wie
jede normale Antwort) und "Nora was closed. Changes were saved." sagt — aber
nie `pushTurn`/`appendToLastTurn` aufruft, landet also nie im Chat-Verlauf.
Genau der Unterschied zwischen "JARVIS bemerkt etwas" und "JARVIS antwortet
auf etwas".

**3. "Man soll auch per Klick reinschreiben können"** — bisher ging jede
Zeile nur über Diktat (`nora_note`, ein Agenten-Tool). Jetzt hat das Panel
selbst ein Eingabefeld (`.nora-input`, immer sichtbar solange nicht gerade
die Bestätigung zu sehen ist); Enter schickt den Text direkt an einen neuen
Bridge-Endpunkt, ohne jeden Agenten-Umweg:

- `bridge/nora.mjs`: die eigentliche Schreib-Logik aus `nora_note` in eine
  eigene, exportierte `saveThought(text)` gezogen — jetzt die einzige Stelle,
  die tatsächlich an `bridge/nora.md` anhängt
- `bridge/server.mjs`: neuer Endpunkt `POST /nora/note` (`{text}` im Body),
  ruft `saveThought` direkt auf. Bewusst **kein** `ALLOW_WRITES`-Gate hier —
  dieses Gate hält das Modell zurück, wenn es selbständig entscheidet zu
  handeln; ein Klick des Nutzers in sein eigenes Notizfeld ist keine
  Modell-Entscheidung, gleiche Einordnung wie die bestehenden `/voice`-,
  `/tts`-, `/stt`-Endpunkte, die aus demselben Grund ebenfalls ohne
  Agenten-Turn und ohne dieses Gate laufen
- `src/ui/Nora.tsx`: `submitTyped()` postet ans neue Endpunkt, hängt den Text
  bei Erfolg selbst per `appendNoraText` an (kein Rundweg über den
  WebSocket nötig — dieser Tab hat den Text ja bereits, den es gerade
  losgeschickt hat) und meldet einen Fehler über den normalen
  `setError`-Banner, falls die Bridge nicht erreichbar ist
- Tippen und Diktieren landen dadurch identisch in `bridge/nora.md` — beide
  laufen letztlich durch dieselbe `saveThought()`, kein zweiter, potenziell
  abweichender Code-Pfad

## Chat-Verlauf übersteht Reload

`src/store.ts`: `useStore` mit `zustand/middleware`s `persist` umschlossen,
`partialize: (s) => ({ turns: s.turns })` — nur der Transkript-Verlauf landet
in `localStorage` (Key `jarvis-history`), alles andere (Phase, Panels,
Blades, Verbindungsstatus) startet bei jedem Laden bewusst frisch, damit
nichts einen veralteten Live-Zustand vortäuscht.

**Grenze, die man kennen sollte:** Das ist nur der angezeigte Text. Das
eigentliche Gesprächsgedächtnis liegt serverseitig in der Bridge-Session
(`bridge/server.mjs`, `query()`), die bei einer neuen WebSocket-Verbindung
(= jedem Reload) frisch anfängt. Nach einem Reload sieht man also die alten
Zeilen noch, aber eine direkt darauf aufbauende Frage ("was hast du gerade
gesagt") hat kein echtes Gedächtnis mehr dahinter.

## Chat-Verlauf (Scrollen)

Im Original wurden im HUD nur die letzten 4 Turns angezeigt (`turns.slice(-4)`),
fest angepinnt am unteren Bildschirmrand, ohne Scroll-Möglichkeit — ältere
Nachrichten verschwanden einfach. Geändert auf einen scrollbaren Verlauf:

- `src/ui/Hud.tsx`:
  - `logRef = useRef<HTMLDivElement>(null)` angelegt und an den `.log`-Container
    gehängt (`<div className="log" ref={logRef}>`)
  - `turns.slice(-4).map(...)` → `turns.map(...)` (komplette Historie rendern,
    nicht nur die letzten 4)
  - `useEffect`, der bei jeder Änderung von `turns` ans Ende scrollt — aber
    **nur wenn man ohnehin schon nah am unteren Rand ist**. Wer manuell nach
    oben scrollt, um Verlauf zu lesen, wird nicht mitten im Lesen wieder nach
    unten gerissen, sobald eine neue Nachricht reinkommt
- `src/index.css` (`.log`-Regel):
  - `max-height: 46vh` + `overflow-y: auto` + `overflow-x: hidden` ergänzt —
    vorher unbegrenzt hoch wachsend
  - dünne, ins Design passende Scrollbar (`scrollbar-width: thin` für
    Firefox-Syntax/Standard, plus `::-webkit-scrollbar*`-Regeln für Chrome/Edge)
    in der Akzentfarbe statt der Standard-OS-Scrollbar

**Bug gefixt (2026-09-16):** die "nah am unteren Rand"-Prüfung oben lief auch
beim allerersten Durchlauf nach einem Reload — `scrollTop` steht dann aber
immer erst auf 0, egal wie lang der wiederhergestellte Verlauf tatsächlich
ist. Bei einer längeren Unterhaltung war man also nie "nah dran", die Seite
öffnete oben statt unten, und weil sich `scrollTop` seither nicht mehr
bewegte, scrollte auch jede neue Nachricht danach nicht mehr runter — zwei
Symptome, eine Ursache. Fix: ein `firstScroll`-Ref überspringt die
Nähe-Prüfung nur beim allerersten Durchlauf und geht dabei immer ganz nach
unten; danach gilt die alte Logik unverändert weiter.

## Lesbarkeit (CSS)

HUD-Chrome (SYSTEMS-/SIGNAL-Leiste, Status-Zeile oben, Footer-Hinweis unten,
"try saying"-Vorschlag) größer und kontrastreicher gemacht — Schriftgrößen und
Opacity-Werte in `src/index.css` angehoben. Der zentrale Chat-Verlauf
(`.log-*`-Klassen) ist bewusst unverändert geblieben (bzw. inzwischen über den
eigenen `--chat-scale`-Regler im Einstellungs-Panel skalierbar, siehe oben).

## Mikrofon-Debugging (lang, aber gelöst)

Symptom: erst "reagiert, aber antwortet nicht", später "hört mich gar nicht".

Ursachen, der Reihe nach gefunden:

1. Zuerst in **Firefox** getestet — Firefox unterstützt die `SpeechRecognition`-API
   (Web Speech API) grundsätzlich nicht, nur `speechSynthesis` (deshalb hat
   Sprechen funktioniert, Zuhören nie). Lösung: Chrome oder Edge verwenden.
2. In Chrome: Windows-Mikrofonpegel war einwandfrei, aber **Chrome selbst hatte
   das falsche Eingabegerät ausgewählt** (mehrere Mikrofone im System vorhanden).
   Lösung: richtiges Gerät direkt in Chrome umgestellt.

## Bekannte Stolpersteine

- **PowerShell blockiert npm/claude**: `npm.cmd` / `claude.cmd` statt `npm`/`claude`
  verwenden (Execution Policy, betrifft die `.ps1`-Wrapper von npm-Global-Installs)
- **Firefox funktioniert nicht** für die Spracherkennung (keine `SpeechRecognition`-
  API) — nur Chrome/Edge, in einem echten Fenster (keine eingebettete Vorschau)
- **Mehrere Mikrofone im System**: Windows-Standardgerät und das von Chrome
  tatsächlich genutzte Gerät können auseinanderfallen — im Zweifel direkt in
  Chrome prüfen, nicht nur in Windows-Soundeinstellungen.
- **JARVIS hört sich selbst über Lautsprecher** (ohne Kopfhörer): das Mikro
  bleibt bewusst offen, während er spricht, damit man ihn unterbrechen kann
  (Barge-in). Es gibt eingebaute Gegenmaßnahmen (`echoCancellation` beim
  Mikrofon-Stream, plus eine Text-Heuristik `isEcho()` in `src/lib/voice.ts`),
  die fangen aber nicht alles ab. **Kopfhörer sind die zuverlässige Lösung.**
- **Claude in Chrome** (für die `chrome_*`-Browser-Steuerung): braucht die
  offizielle "Claude"-Erweiterung aus dem Chrome Web Store (seit 08/2026 für
  bezahlte Pläne allgemein verfügbar), Chrome muss offen und die Erweiterung
  aktiv/eingeloggt sein — sonst meldet JARVIS "Die Erweiterung läuft nicht".

## Vorschau/Start

- `C:\Source\.claude\launch.json` (im übergeordneten `C:\Source`-Ordner, **nicht**
  im Jarvis-Repo) enthält einen `jarvis`-Eintrag: `npm --prefix C:\Source\jarvis start`,
  Port 5180 (fest, `autoPort: false` — die Bridge akzeptiert nur WebSocket-Origins
  aus dem Bereich 5173–5199).
- Alternativ manuell, zwei Terminals im Ordner `C:\Source\jarvis`:
  `npm run bridge` (Gehirn) + `npm run dev` (Oberfläche)

## MCP-Server

Aktuell keine in `~/.claude.json` konfiguriert. Ohne sie funktionieren u.a.
Web-Suche, Bildgenerierung und Handy-Steuerung nicht — nur die eingebauten
HUD/Blades-Tools (`display`, `blade`, `probe_url`) sind immer verfügbar.

## Musik-Kandidaten (Sammlung, noch nicht eingebaut)

Kandidaten für zusätzliche/persona-eigene Musik, per KI-Audioanalyse
beschrieben (z.B. describemusic.net). Liegen als MP3 unter `public/audio/`,
aber bewusst in `.gitignore` eingetragen (vermutlich urheberrechtlich
geschützte kommerzielle Tracks — für privates, nicht-veröffentlichtes Projekt
laut Nicolas unbedenklich, aber nichts, was committet werden soll):

1. **`public/audio/ironman.mp3`** — Hard-Rock-Anthem: markanter verzerrter
   Gitarren-Riff als Hook, kraftvoller, hoher, rauer/schreiender Gesang
   ("melodic belting"), klassische Rock-Produktion, zwei Overdrive-Gitarren,
   treibendes Schlagzeug, Bass eng am Riff. Klingt nach einem bekannten
   kommerziellen Rocktrack.
2. **`public/audio/hello_jarvis.mp3`** — futuristischer Sci-Fi-Chime, dann
   eine stark verfremdete, robotisch/vocoder-klingende männliche Stimme
   ("Welcome home, sir... Enjoy your time, sir."), danach ein entspannter
   80s-artiger Lo-Fi-Groove. Eher als **Begrüßungs-/Boot-Cue** interessant
   (passt zu `boot-music.mp3`) als als Dauer-Hintergrundmusik. Die
   gesprochene Zeile klingt wie ein direktes Filmzitat.
3. **`public/audio/avengers_theme.mp3`** — episches Orchester-Stück:
   heroisch/triumphal, Streicher tragen die Hauptmelodie, Blechfanfaren,
   Timpani/Snare als marschartiges Rückgrat. Klingt nach dem tatsächlichen
   Avengers-Titelthema — vermutlich das am klarsten wiedererkennbare der
   vier. Passt vom Charakter eher zu `ambient.mp3`/einem
   "Team-Versammlungs"-Moment als zu Boot oder Work.
4. **`public/audio/jarvis_morning.mp3`** — zweiteilig: ruhige, klar
   artikulierte, synthetisch klingende männliche Stimme mit "Morgenbericht",
   dann ein episches Orchester-Trailer-Swell — bewusst komischer Kontrast
   zwischen banalem Briefing und übertrieben dramatischer Musik. Klingt eher
   nach generischer "epic trailer"-Stockmusik als nach einem konkreten
   Filmthema.

Noch nicht verdrahtet — reine Ablage, um sie beim Bauen der Persona-Musik
griffbereit zu haben.

## Persönliches Kontext-Wissen

In Jarvis Mobile entfernt (siehe Hinweis ganz oben). Im Original-Repo las
`personalContext()` in `bridge/server.mjs` eine handgepflegte Datei
`bridge/context.md` und hängte sie an den System-Prompt.

## Offen / geplant

Grob nach Wichtigkeit sortiert (Claude-Einschätzung, Stand 2026-09-15) —
Sicherheit/Vertrauen zuerst, dann Dinge, die viele andere Punkte erst
ermöglichen, dann klar umrissene Einzelfeatures, Show-Effekte ganz hinten.
Momentaufnahme, kein verbindlicher Fahrplan.

- **Sichtbarer Privacy-Indikator fürs Mikro**: Kamera-Status ist schon
  sichtbar (`Hud.tsx`: "LOOKING — …" bzw. "CAMERA ON · G TO STOP"). Fürs
  Mikro gibt es das nicht in der gleichen Klarheit — es bleibt laut "Bekannte
  Stolpersteine" oben bewusst auch während JARVIS spricht offen (Barge-in),
  aber die Phasenanzeige (SPEAKING/THINKING/…) sagt das nicht explizit. Idee:
  ein eigenes, dezentes "hört zu"-Signal, unabhängig von der aktuellen Phase.
  Noch offen: wie aufdringlich das sein soll, gerade weil das Mikro ohnehin
  fast immer offen ist.
- **Gäste-Modus fürs persönliche Kontext-Wissen**: `personalContext()` hängt
  das "About Nicolas"-Wissen aus `context.md` immer an den Prompt. Sobald
  jemand anderes im Raum mitredet, wäre eine Möglichkeit sinnvoll, das
  vorübergehend nicht einfließen zu lassen — inhaltlich verwandt mit dem
  Privacy-Indikator oben, aber eine Verhaltensfrage statt eine Anzeige.
- **Kopfhörer-Schalter in den Einstellungen**: Ein Schalter "Kopfhörer:
  an/aus". Mit Kopfhörern bleibt es wie jetzt (Mikro bleibt beim Sprechen
  offen, für Barge-in). Ohne Kopfhörer soll JARVIS die Mikrofon-Eingabe
  während des eigenen Sprechens bewusst ignorieren — auch ein vermeintliches
  "Hey Jarvis" — statt sich nur auf `echoCancellation` und die `isEcho()`-
  Heuristik in `src/lib/voice.ts` zu verlassen (siehe "Bekannte
  Stolpersteine" oben), die laut CLAUDE.md nicht alles abfangen. Tauscht ohne
  Kopfhörer bewusst Barge-in gegen Zuverlässigkeit.
- **Reaktor überlagert Chat-Verlauf**: die "Blase" sitzt mittig im Bild, der
  Chat-Verlauf ebenfalls — überlagert sich manchmal beim Lesen älteren
  Verlaufs. Vorschlag: Reaktor verkleinern und/oder beim Hover mit der Maus
  über den Chat-Bereich zur Seite schieben
- ~~**Text-Eingabe als Fallback**~~ — **umgesetzt (2026-09-16)**, siehe
  Abschnitt "Text-Eingabe" oben.
- ~~**Screenshot/Bild einfügen**~~ — **umgesetzt (2026-09-19), seither zu
  "Anhänge" (Bild + Text/Markdown) erweitert**: Copy-Paste geht überall auf
  der Seite (`window`-`paste`-Listener in `App.tsx`, kein Enter zum
  Fokussieren nötig), Datei-Auswahl über die Taste **I** oder über einen
  **+-Button** direkt im Texteingabefeld (beide lösen denselben versteckten
  `<input type="file">` aus) — auf Nicolas' Wunsch behält I seine Funktion,
  der Button kommt nur zusätzlich dazu, als sichtbarer Hinweis, dass es die
  Funktion überhaupt gibt (Vorbild: der Anhang-Knopf in Claude Codes eigener
  Oberfläche). Alle drei Wege landen am selben Ziel: der Anhang hängt sich ans
  Texteingabefeld (`TextInput.tsx`) — Thumbnail (Bild) oder Namens-Badge
  (Text-Datei), beides mit eigenem ✕ zum Entfernen, Platzhaltertext wechselt
  zu "Add a question, or press Enter to send…", Enter auf leerem Feld schickt
  den Anhang allein statt das Feld zu schließen (einzige Ausnahme von "Enter
  auf leerem Feld schließt").
  - **`src/lib/attachments.ts`** (vormals `imageInput.ts`, umbenannt weil
    jetzt zwei Anhang-Arten statt nur Bildern): `readAttachment(file)`
    verzweigt nach `file.type`/Endung — ein Bild wird wie zuvor clientseitig
    re-encodiert (Canvas-Downscale auf max. 1600px lange Kante, JPEG q=0.9,
    dieselbe `{data, mimeType}`-Form, die `camera.ts`s `grabFrame()` für die
    Kamera zurückgibt), eine Text-/Markdown-/Code-Datei (Liste bekannter
    Endungen, da z.B. `.md` browserseitig oft keinen `file.type` hat) wird
    einfach als Text gelesen (`file.text()`, Obergrenze 50.000 Zeichen).
    Alles andere (PDF, `.docx`, …) wird mit einer klaren Fehlermeldung
    abgelehnt statt stillschweigend als Bild fehlzuschlagen oder als
    Binärmüll durchzugehen. `fileFromClipboard()` (vormals
    `imageFromClipboard()`) filtert jetzt nach `kind === 'file'` statt nach
    Bild-MIME-Type, damit ein kopiertes Textdokument genauso erkannt wird
    wie ein Screenshot — ein normaler Text-Paste hat kein File-Item und bleibt
    dadurch unberührt.
  - **Bridge-Pfad**: `bridge.ts`s `ask()` schickt den Anhang als
    `attachment`-Feld über den WebSocket mit; `bridge/server.mjs`s
    `ask`-Handler baut daraus je nach `kind` entweder einen Bild-Content-Block
    (`{type:'image', source:{type:'base64', media_type, data}}`) oder einen
    zusätzlichen Text-Block (`Attached file "name.md":\n\n<Inhalt>`) statt
    eines reinen Text-Strings — `message.content` der Claude Agent SDK
    akzeptiert beides, genau wie die Anthropic Messages API selbst. Ein Bild
    ohne eigenen Text fällt auf "The user attached this image." zurück, aus
    demselben Grund, aus dem `vision.mjs` jedes Kamerabild ebenfalls mit
    einer erklärenden Zeile umgibt — eine Text-Datei braucht das nicht, ihr
    eigener "Attached file ...:"-Block rahmt sich selbst.
  - **Direct-Pfad** (`src/lib/anthropic.ts`, kein Bridge-Prozess): `brain.ts`s
    `ask()` baut dieselben Content-Blocks selbst, weil hier kein Server das
    übernehmen kann.
  - **Nicht mit-umgesetzt** (siehe Rückfrage von Nicolas dazu): Video
    einfügen (bräuchte Frame-Sampling wie bei der Kamera-"watch"-Funktion)
    und eine Bild-URL direkt nehmen (wäre einfach über das schon vorhandene
    SSRF-Gate in `net.mjs` machbar) — beides als mögliche Folge-Punkte
    notiert, nicht angefragt. Ebenfalls nicht umgesetzt, weil eine
    grundsätzlich andere, größere Baustelle: Anhängen **per Sprachbefehl**
    ohne Tastatur/Maus — das bräuchte echten Dateisystem-Zugriff auf der
    Bridge-Seite, siehe den eigenen Backlog-Punkt "Dateisystem-Zugriff"
    weiter unten, statt einer separaten Extra-Lösung nur fürs Anhängen.
  - Live im Browser mit synthetischen Paste-Events getestet (Bild-Thumbnail
    und Text-Datei-Badge erscheinen korrekt, ✕ entfernt nur den Anhang, Feld
    bleibt offen, + öffnet den Dateidialog ohne Fehler); ein echter
    Ende-zu-Ende-Turn durch die Bridge wurde bewusst nicht getriggert, um
    Nicolas' laufende Session nicht mit einem Test-Turn zu verunreinigen.
- Keine MCP-Server in `~/.claude.json` konfiguriert — Web-Suche,
  Bildgenerierung, Handy-Steuerung funktionieren deshalb noch nicht
- **Echtes Langzeitgedächtnis über Reloads/Sessions hinaus**: Laut "Chat-
  Verlauf übersteht Reload" oben übersteht nur der sichtbare Text einen
  Reload — das eigentliche Gespräch in der Bridge-Session (`bridge/server.mjs`,
  `query()`) fängt bei jeder neuen WebSocket-Verbindung frisch an, kein
  echtes Erinnern an das zuvor Gesagte. `bridge/context.md` (siehe
  "Persönliches Kontext-Wissen" oben) deckt nur statische, von Nicolas von
  Hand eingetragene Fakten ab, keine selbständig gemerkten Dinge aus echten
  Gesprächen. Idee: ein zweiter, dynamischer Layer obendrauf, der sich Dinge
  aus Gesprächen selbst merkt. Noch offen: wo/wie das gespeichert wird, wie
  entschieden wird, was merkenswert ist, und wie es sich zum statischen
  `context.md` abgrenzt.
- **Timer und Wecker**: JARVIS soll Timer ("erinnere mich in 20 Minuten an X")
  und Wecker (feste Uhrzeit, z.B. "weck mich morgen um 7") setzen können. Am
  liebsten direkt über die echte Windows-Wecker-App (Alarms & Clock), damit es
  auch ohne offenen Browser/Bridge-Prozess zuverlässig auslöst — noch zu
  klären, ob/wie sich dort von außen programmatisch ein Eintrag anlegen lässt,
  sonst als Rückfall ein eigener Mechanismus über die Bridge (z.B. via Windows
  Task Scheduler oder eine eigene Benachrichtigung). Braucht vermutlich ein
  neues Bridge-Tool mit echtem System-Zugriff, anders als die bisherigen
  `ui_*`-Tools, die nur UI-Events schicken.
- **Dateisystem-Zugriff**: JARVIS soll wie Claude Code selbst lesenden UND
  schreibenden Zugriff auf Nicolas' Dateien bekommen. Bräuchte eigene
  Bridge-Tools analog zu Read/Write/Edit, plus eine Entscheidung, wie weit
  der Zugriff reicht (ganzes System vs. bestimmte Ordner) und wie das mit dem
  "Bestätigung bei mächtigen Aktionen" (siehe oben, Abschnitt "Verhalten:
  Bestätigen und Planen") zusammenspielt — Dateien schreiben oder löschen ist
  genau die Art Aktion, bei der ein Verhören richtig wehtun würde.
- **Exportierbarer Gesprächsverlauf**: Der Verlauf lebt nur in `localStorage`
  des Browsers (siehe "Chat-Verlauf übersteht Reload" oben) — bei gelöschten
  Browserdaten ist alles weg. Eine Export- oder Backup-Möglichkeit wäre reine
  Absicherung.
- **Desktop-Verknüpfung / als eigene App nutzbar**: Jarvis über Chrome/Edge
  als App-artige Verknüpfung starten, ähnlich der YouTube-Music-Desktop-App.
  Einfachster Weg ganz ohne Code: Browser-Menü → "Weitere Tools" →
  "Verknüpfung erstellen..." mit Haken bei "Als Fenster öffnen" — legt ein
  Desktop-Icon an, das Jarvis in einem eigenen Fenster ohne Tabs/Adressleiste
  öffnet. Ersetzt aber nicht den Server: `npm start` (Bridge + Vite) muss
  weiterhin laufen, die Verknüpfung ist nur ein Fenster-Wrapper um die
  localhost-Seite. Für ein eigenes Icon/einen eigenen Namen statt der
  Standard-Chrome-Optik bräuchte es zusätzlich ein `manifest.json` (echte
  PWA-Installation statt einfacher Fenster-Verknüpfung) — noch offen, ob das
  gewünscht ist.
- ~~**Automatischer Start statt `npm start` von Hand**~~ — **Doppelklick-Teil
  umgesetzt (seit 2026-09-23)**: `start-electron.cmd` im Projekt-Root wechselt
  ins Verzeichnis und startet `npm run electron` — Doppelklick statt Konsole
  öffnen und tippen. Für ein echtes Desktop-Icon: Rechtsklick auf die Datei →
  "Verknüpfung erstellen" → auf den Desktop ziehen (einmaliger manueller
  Schritt). Sauberes Beenden kommt geschenkt vom Electron-Umbau (siehe
  "Vorschau/Start" unten) — Fenster schließen beendet Bridge und Vite
  automatisch mit, kein Konsolenfenster bleibt offen (außer bei einem Fehler,
  z.B. Port schon belegt — dann pausiert `start-electron.cmd` bewusst, damit
  die Meldung lesbar bleibt).
  **Bewusst nicht umgesetzt**: Windows-Autostart beim Anmelden — auf
  ausdrücklichen Wunsch nur auf Klick, JARVIS soll nicht ungefragt im
  Hintergrund mitlaufen. Erkennung "läuft schon" (kein Doppelstart) ebenfalls
  bewusst weggelassen — bei versehentlichem Doppelstart kommt einfach ein
  sichtbarer Port-Fehler statt eines stillen Fehlschlags.
  **Bekannte Lücke:** `start-electron.cmd`/die Verknüpfung startet einen
  frischen Prozessbaum ohne die PowerShell-Session, in der
  `$env:ELEVENLABS_API_KEY` gesetzt wurde (siehe "ElevenLabs eingerichtet"
  oben) — dieser Startweg bekommt den Key also nicht automatisch mit und
  fällt still auf Gratis-Stimmen zurück. Noch offen, ob/wie das gelöst wird
  (z.B. dauerhafte System-Umgebungsvariable statt Session-Variable) — bislang
  nicht angefragt.
- **Sprecher-Unterscheidung / mehrere Profile**: Falls nicht nur Nicolas mit
  JARVIS spricht — erkennen, wer gerade redet, damit persönliche Fakten
  (`context.md`) nicht der falschen Person zugeschrieben werden. Möglicher
  Ansatz: Stimmerkennung (Mikro ist ohnehin permanent offen) und/oder
  Kameraerkennung (Gesicht, `camera.ts` existiert schon fürs Handtracking) —
  beides noch unklar, wie zuverlässig und wie viel Aufwand. Eng verwandt mit
  dem Gäste-Modus oben.

  **Stand 2026-09-15:** Kurz durchgesprochen (Gesichtserkennung speziell für
  Nicolas selbst — "das ist der Operator"), dann zurückgestellt, noch nicht
  begonnen. Zwei mögliche Wege für die Kamera-Seite: (a) eine client-seitige
  Gesichtserkennungs-Bibliothek (z.B. face-api.js), einmal auf Nicolas
  eingelernt, danach laufend lokal abgeglichen — schnell genug für
  dauerhafte Hintergrunderkennung, aber neue Abhängigkeit plus Einlern-UI;
  (b) den Kamera-Frame samt einem Referenzfoto einfach an Claude selbst zur
  Beurteilung schicken, über die schon vorhandene "JARVIS schaut sich
  was an"-Fähigkeit — kein neues Modell nötig, aber jeder Check kostet einen
  echten Modell-Aufruf, eher für Einzelabfragen geeignet als für
  Dauerbetrieb. Tendenz zu (a), falls es passiv im Hintergrund laufen soll.
- **Anwesenheit erkennen**: Über die Kamera merken, ob jemand vor dem Rechner
  sitzt — beim Hereinkommen "Willkommen zurück, Sir", beim Weggehen automatisch
  Standby. Braucht nur Personen-/Gesichtserkennung ("jemand ist da"), nicht
  zwingend das Wiedererkennen von Nicolas (das wäre die
  Sprecher-Unterscheidung oben). Noch offen: Kamera dafür dauerhaft an (sichtbar
  im Kamera-Status, Datenschutz), und wie lange Abwesenheit dauern muss, bevor
  Standby greift.
- **Einstellungen dauerhaft speichern (alle, nicht nur einzelne)**:
  Recognition-Sprache (`jarvis.speechLang`) und beide Schriftgrößen-Regler
  (`jarvis.edgeScale`/`jarvis.chatScale`) landen schon einzeln in
  `localStorage` und überstehen Reloads. Die Persona-/Stimm-Wahl (Jarvis/
  Edith, Sprache, Geschlecht) dagegen lebt nur serverseitig in `voiceState`
  (`bridge/server.mjs`) — übersteht einen Browser-Reload, aber nicht einen
  Neustart der Bridge selbst (z.B. PC-Neustart), dann ist wieder Jarvis/EN/
  männlich der Standard. Sobald es mehrere KI-Modelle/Anbieter gibt (siehe
  "Weitere KI-Anbieter" oben), sollte auch die Modellwahl genauso überstehen.
  Idee: alle Einstellungen einheitlich in einem persistierten Objekt statt in
  Einzel-Keys pro Setting.
- ~~**Standort-Zugriff**~~ — **umgesetzt (2026-09-23)**: `src/lib/location.ts`s
  `requestLocationOnce()` fragt die Browser-Geolocation-API einmalig beim Boot
  ab (keine Dauerabfrage, siehe Datenschutz-Sorge oben) und schickt die
  Koordinate an die Bridge; `bridge/server.mjs`s `knownPlaces()`/
  `currentPlaceHint()` gleicht sie gegen `bridge/places.md` ab (200m-Radius)
  und hängt einen Hinweis wie "at home"/"at the club" an jeden Turn an — siehe
  `bridge/places.md` für die Orte-Liste selbst.
- **Offline-/Degraded-Modus**: Was passiert bei Verbindungsabbruch mitten in
  der Nutzung? `watchConnection` meldet das schon ("Bridge reconnected,
  vorherige Konversation nicht erhalten"), aber es gibt keinen definierten
  Fallback, was währenddessen noch geht (z.B. Lautstärke, Standby weiter per
  Taste bedienbar).
- **Neue Blade-Art "Karte"**: Für Ortsfragen ("wo ist X") eine echte
  interaktive Karte statt Bild- oder Artikel-Ansicht — wäre eine neue `kind`
  neben den bestehenden (article/image/gallery/video/embed/markup/camera) in
  `bridge/panels.mjs`.
- **Neue Blade-Art "Diagramm"**: Echte Diagramme statt Text/Screenshot für
  numerische Daten — konkrete Beispiele: eigener API-Verbrauch (Anzahl
  Aufrufe, verbrauchte Tokens, aktuelles 5-Stunden-Nutzungslimit), oder
  generische Beispieldaten (z.B. eine simulierte Einnahmen-Kurve). Gleiche
  Stelle wie "Karte" oben, neue `kind` in `bridge/panels.mjs`.
- **Neue Blade-Art "3D-Hologramm"**: "Zeig mir ein Modell von X" öffnet ein
  drehbares 3D-Objekt im Hologramm-Look (Akzentfarbe, Scanlinien), per Maus
  oder Handgeste drehbar. `@react-three` ist schon im Projekt. Gleiche Stelle
  wie "Karte"/"Diagramm", neue `kind` in `bridge/panels.mjs`. Noch offen: woher
  die Modelle kommen (freie 3D-Bibliotheken, generiert, nur einfache Formen).
- **Persistentes kleines Dashboard**: Ein dauerhaft sichtbarer, kleiner
  Bereich (Uhrzeit, nächster Termin, Wetter, ggf. eigener API-Verbrauch)
  unabhängig vom Gesprächsverlauf — Dinge, die man immer im Blick haben will,
  statt nur reaktiv auf Fragen zu antworten. Würde gut mit dem geplanten
  Kalender-Anschluss und Timer/Wecker zusammenspielen.
- **Weitere KI-Anbieter integrieren**: Andere Modelle/APIs (z.B. ChatGPT,
  Gemini) zusätzlich zu Claude anbinden — konkret genannt: Bildbearbeitung/
  -generierung, was Claude nicht nativ kann. Noch offen: eigene Bridge-Tools
  pro Anbieter, eigene API-Keys (gleiches Prinzip wie beim ElevenLabs-Key —
  Nicolas trägt die selbst ein), und wie das Modell entscheidet, wann welcher
  Anbieter dran ist.
- **Spotify-Steuerung (Musik abspielen/pausieren/skippen)**: Nach dem Vorbild
  von Alexa — dort läuft es über eine einmalige OAuth-Kontoverknüpfung (Login
  bei Spotify, Amazon bekommt nur ein Zugriffstoken, kein Passwort) plus die
  **Spotify Web API / Spotify Connect**. Alexa selbst spielt dabei kein Audio
  ab, sondern schickt nur Steuerbefehle (Suche, Play/Pause/Skip) an ein
  bereits laufendes Spotify-Gerät (Handy/PC-App/Speaker) — der eigentliche
  Audio-Stream läuft direkt Gerät↔Spotify, Alexa ist nur Fernbedienung.
  Gleiches Prinzip würde für JARVIS funktionieren: neues Bridge-Tool analog zu
  den bestehenden `ui_*`-Tools, das gegen die Spotify Web API spricht; Client-
  ID/Secret + OAuth-Login trägt Nicolas selbst ein (gleiches Prinzip wie beim
  ElevenLabs-Key). Voraussetzung: ein Gerät mit laufendem Spotify, das als
  Connect-Ziel erscheint — JARVIS selbst müsste keinen Audio-Stream abspielen.
- **Kalender-Anschluss (Outlook/Google)**: JARVIS soll die eigenen Termine
  kennen — auf Zuruf ("was steht heute an?", "wann ist mein nächster Termin?")
  und als Grundlage für das persistente Dashboard, das Morgen-/Proaktiv-Verhalten
  und den Rückblick (siehe unten), die ihn alle schon voraussetzen. Weg über
  die Microsoft Graph API bzw. Google Calendar API mit OAuth-Login, Zugangsdaten
  trägt Nicolas selbst ein (gleiches Prinzip wie beim ElevenLabs-Key). Noch
  offen: welcher Kalender, und ob zunächst nur lesend (Tendenz: ja — Termine
  anlegen/ändern fiele unter "Bestätigen vor echter Wirkung").
- **PC-Steuerung**: Lautstärke, eine App öffnen, Bildschirm sperren, Fenster
  anordnen — per Sprachbefehl. Braucht ein neues Bridge-Tool mit echtem
  Windows-Zugriff (z.B. über PowerShell-Aufrufe aus der Bridge heraus), anders
  als die bisherigen `ui_*`-Tools, die nur die eigene Oberfläche betreffen.
  Noch offen: welche Befehle genau erlaubt sind (feste Liste statt beliebiger
  Kommandos) und welche davon unter "Bestätigen vor echter Wirkung" fallen.
- **Einkaufsliste per Zuruf**: "Setz Milch auf die Einkaufsliste" — gleiches
  Muster wie N.O.R.A. (eigene Datei, z.B. `bridge/einkauf.md`, eigenes kleines
  Panel, Tippen und Diktieren), nur als abhakbare Liste statt fortlaufender
  Notizen. Noch offen: Abhaken/Entfernen per Sprache und Klick, und ob die
  Liste später aufs Handy soll (bräuchte Zugriff auf JARVIS aus dem WLAN,
  nicht nur von `localhost`).
- **Mails vorlesen und zusammenfassen**: "Hab ich neue Mails?" — JARVIS nennt
  Absender und Betreff, fasst wichtige Mails kurz zusammen. Bewusst **nur
  lesend**: Antworten/Senden fiele unter "Bestätigen vor echter Wirkung" und
  bleibt vorerst außen vor. Weg über Microsoft Graph (Outlook) bzw. Gmail-API,
  gleicher OAuth-Login wie beim Kalender-Anschluss oben. Noch offen: welches
  Postfach, und wie mit vertraulichen Inhalten umgegangen wird, wenn jemand
  mithört (vgl. Gäste-Modus).
- **Koch-Modus**: Ein Rezept Schritt für Schritt vorlesen, ohne Hände mit
  "nächster Schritt"/"nochmal" weiterschalten, Zutatenliste als Blade, eigener
  Timer pro Schritt (siehe "Timer und Wecker" oben). Noch offen: woher die
  Rezepte kommen (Web, eigene Sammlung) und ob Mengen umgerechnet werden sollen.
- **Hausaufgaben-/Lernhelfer**: Aufgaben erklären statt nur lösen — Schritt für
  Schritt, mit Rückfragen, ob es verstanden wurde. Passt direkt zum geplanten
  "Screenshot/Bild einfügen" (Foto einer Matheaufgabe) und zur Kamera. Noch
  offen: eigener Modus mit eigenem Prompt-Abschnitt, oder nur eine
  Verhaltensregel ("bei Aufgaben erst erklären").
- **Kontingent-Wächter für ElevenLabs**: Die Zahlen sind schon da (Limits-Tab,
  `GET /usage/elevenlabs`) — wenn das Zeichen-Kontingent fast aufgebraucht ist,
  soll JARVIS das von sich aus kurz sagen und automatisch auf Gratis
  (Browserstimme/-erkennung) umschalten, statt mitten im Satz an einem Fehler
  zu scheitern. Noch offen: ab welcher Schwelle (z.B. 90 %), wie oft geprüft
  wird, und ob beim Kontingent-Reset automatisch zurückgeschaltet wird.
- **Systemcheck per Sprache**: "Jarvis, Systemcheck" prüft der Reihe nach
  Mikrofon (kommt ein Pegel an, welches Gerät nutzt Chrome?), Bridge-Verbindung,
  ElevenLabs (Key gültig, Kontingent übrig), Claude-Limit und Kamera — und sagt
  bzw. zeigt als Blade, was funktioniert und was hakt. Direkte Lehre aus dem
  langen Mikrofon-Debugging (siehe "Mikrofon-Debugging" oben): damals lag die
  Ursache beim falschen Eingabegerät in Chrome, genau so etwas soll ein Check
  sofort sichtbar machen. Noch offen: welche Prüfungen der Browser selbst machen
  kann und welche die Bridge übernehmen muss.
- **Claude-Code-Status**: "Wie läuft meine Session im Projekt X?" — JARVIS schaut
  nach laufenden Claude-Code-Sessions oder Builds auf diesem Rechner und meldet
  den Stand (läuft/wartet auf Eingabe/fertig/Fehler). Noch offen: woher die
  Information kommt (z.B. Session-Dateien unter `~/.claude`, Prozessliste) und
  ob JARVIS nur lesen oder auch antworten darf (Tendenz: nur lesen).
- **Erinnerung an ungepushte eigene Commits**: Ursprünglich als "Upstream-Check"
  gegen das Original-Repo `adewaskar/jarvis` gedacht — beim Nachfragen (2026-09-23)
  stellte sich heraus, dass es eigentlich um etwas anderes geht: Nicolas soll
  erinnert werden, falls in seinem **eigenen** Repo lokale Commits liegen bleiben
  und nie gepusht werden (kommt vor — an diesem Tag lag `main` zeitweise über
  20 Commits vor `origin/main`). Nebenbefund, evtl. später nochmal relevant:
  `adewaskar/jarvis` selbst hat seit dem Fork keine neuen Commits bekommen (per
  `git fetch` geprüft, 20 Commits insgesamt, HEAD bereits vollständig in diesem
  Fork enthalten) — ein echter "gibt es Neues im Original"-Check hätte aktuell
  nichts zu melden.
  Noch offen: **wo** die Erinnerung ankommt — JARVIS selbst sagt es (Bridge
  prüft `git status` im eigenen Repo, erwähnt es im Gespräch, z.B. beim Start
  oder auf Zuruf) oder nur innerhalb einer Claude-Code-Session (unabhängig von
  der laufenden Voice-App). Auf Nicolas' Wunsch fürs Erste nur vorgemerkt, noch
  nicht umgesetzt.
- **JARVIS-Statistik mit Streak**: Wie oft JARVIS genutzt wird, Lieblingsbefehle,
  meistgenutzte Persona, gesprochene vs. getippte Turns — dazu eine **Streak**
  wie bei Claude (Tage am Stück, an denen JARVIS benutzt wurde). Anzeige z.B. als
  eigener Settings-Reiter oder Blade, passt zur Blade-Art "Diagramm" oben; auch
  als Jahresrückblick denkbar. Noch offen: wo die Zählung gespeichert wird
  (`localStorage` reicht für eine Streak nicht, wenn Browserdaten gelöscht
  werden — eher eine Datei in der Bridge).
- **Ultron/Friday/Karen: eigene Stimmen**: laufen seit 2026-09-23 mit
  geliehenen Platzhalter-Stimmen (siehe "Personas" oben) — sobald eigene
  ElevenLabs-Stimmen ausgesucht sind, nur die drei `PERSONAS`-Einträge in
  `bridge/server.mjs` austauschen, Rest bleibt unverändert.
- **Zweite Meinung einer anderen Persona**: "Was meint Edith dazu?" — die
  gerade nicht aktive Persona antwortet kurz mit eigener Stimme und eigenem
  Ton, danach geht es mit der ursprünglichen weiter (kein dauerhafter
  Persona-Wechsel wie bei `ui_voice`). Noch offen: ob das ein eigener
  Modell-Aufruf mit dem Persona-Hinweis ist oder ein Teil der normalen Antwort,
  und wie Transkript-Label und Stimme für genau diesen einen Absatz wechseln.
- **Persona-Debatte**: Erweiterung der zweiten Meinung — zwei Personas (z.B.
  Jarvis und Edith) diskutieren eine Frage mit verteilten Rollen, abwechselnd
  mit eigener Stimme, am Ende ein kurzes Fazit. Noch offen: wie viele Runden,
  und wie das Abwechseln der Stimmen technisch läuft (gleiche offene Frage wie
  oben).
- **Humor-Regler**: Wie bei TARS in Interstellar — "Humor auf 75 %" steuert, wie
  trocken, frech oder nüchtern die aktive Persona antwortet. Als Regler im
  Einstellungs-Panel und per Sprache (`ui_prefs`), wirkt als Zusatz im Prompt.
  Noch offen: pro Persona eigener Wert oder ein globaler, und ob Edith
  (bewusst nüchtern) überhaupt mitgeht.
- **Ultron-Übernahme**: Der Wechsel zu Ultron nicht still, sondern als "Hack"
  inszeniert — Glitch-Effekt, rotes Theme, verzerrte Stimme, kurzer
  bedrohlicher Spruch. Konkretes Beispiel für die "Spezialbefehle mit fester
  Inszenierung" unten, wie die Edith-Startshow. Noch offen: Effekte/Assets und
  ob der Weg zurück zu Jarvis ebenfalls inszeniert wird ("System
  wiederhergestellt").
- ~~**Friday und Karen anlegen**~~ — **Weckwort, Persönlichkeit und Wordmark
  umgesetzt (2026-09-19)**, gleich noch um **Ultron** ergänzt statt nur der
  beiden ursprünglich geplanten — siehe "Personas" oben.
- Musik-Kandidaten (siehe oben) noch nicht in `src/lib/music.ts` verdrahtet
- ~~**Gedanken festhalten**~~ — **umgesetzt** (Schreiben 2026-09-17, Vorlesen/
  Zusammenfassen/Nachfragen 2026-09-23), siehe Abschnitt "N.O.R.A." oben.
- **Abend- und Wochenrückblick**: Abends (auf Zuruf oder im proaktiven Modus)
  fasst JARVIS den Tag zusammen — N.O.R.A.-Notizen des Tages, ggf. Termine
  (Kalender-Anschluss oben) und wichtige Gesprächsthemen. Dazu ein
  **Wochenrückblick** nach demselben Muster über die letzten sieben Tage (z.B.
  sonntagabends). Baut auf der schon vorhandenen Vorlese-/Zusammenfassen-
  Fähigkeit von N.O.R.A. auf. Noch offen: woher "Gesprächsthemen" kommen, solange
  es kein echtes Langzeitgedächtnis gibt (siehe oben), und ob der Rückblick
  selbst wieder als Notiz gespeichert wird.
- **Mehrere parallele Text-Chats neben dem Voice-Hauptchat**: Ähnlich wie bei
  Claude.ai mehrere Unterhaltungen — ein primärer Chat mit vollem
  Voice-Zugriff (wie heute), daneben bis zu einer festen Obergrenze
  (Vorschlag: 10) weitere Chats, die gleichzeitig laufen können, aber bewusst
  **ohne** Stimme/Sprache — nur über die Text-Eingabe erreichbar und
  beantwortet. Noch offen: eigene Session pro Chat (vgl. Session-Resume
  oben), Umschalten zwischen ihnen in der UI, ob/wie mehrere gleichzeitig
  etwas "sagen" wollen, während nur eine Stimme existiert.
- **Echtes Multi-Fenster-Programm**: JARVIS nicht nur auf einem Bildschirm,
  sondern über mehrere Fenster/Screens verteilt, mit unterschiedlichem Inhalt
  auf jedem (nicht bloß gespiegelt) — vergleichbar mit einer IDE, die
  verschiedene Tabs in verschiedene Fenster auf verschiedene Monitore zieht.
  Größer als nur eine einzelne Blade abzudocken: bräuchte echte
  Fensterverwaltung (welches Fenster zeigt was, Layout merken, Fenster
  öffnen/schließen/verschieben) — eher Richtung eigenständige Desktop-App als
  Web-App-mit-Popup. Noch offen: wie viele Fenster, was in jedem einzelnen
  landet, und ob das im Browser bleibt oder für echte Fensterverwaltung z.B.
  Electron bräuchte.
- **Proaktiver Modus**: Ein eigener Modus, in dem JARVIS sich gelegentlich von
  sich aus melden darf (z.B. "Sir, heute sieht's nach Regen aus"), statt nur
  auf Ansprache zu reagieren. Muss ausschaltbar sein (vermutlich ein weiterer
  Schalter im Einstellungs-Panel, siehe oben). In diesem Modus darf er nur
  über vorher festgelegte Dinge reden, nicht wahllos irgendetwas kommentieren.
  Noch offen: welche Themen/Trigger erlaubt sind (Wetter? Kalender?
  Systemzustand?), wie oft/wann er sich meldet, und wie die Begrenzung auf die
  erlaubten Themen durchgesetzt wird. Fest gewünschtes Thema: **Fakten über die
  Avengers** — ab und zu ein kurzer Fun Fact aus dem Marvel-Universum
  ("Wussten Sie, Sir, dass …"), passend zur jeweils aktiven Persona.
- **Diktier-Modus**: Ein Modus, in dem JARVIS nur mitschreibt/transkribiert
  statt zu antworten — für Gedanken, die man einfach nur festhalten will,
  ohne ein Gespräch zu wollen.
- **Spezialbefehle mit fester Inszenierung**: Bestimmte Auslösephrasen
  (Platzhalter-Beispiel: "Jarvis, starte Projekt Victoria") sollen keine
  normale Antwort auslösen, sondern eine vorab choreografierte "Show" aus
  Sound, Musik und Optik — analog zum Hulkbuster-Ruf im Film. Noch offen:
  Erkennung der Phrase (Sonderfall im Weckwort-/Voice-Layer oder normaler
  Modell-Turn mit fester Tool-Kette), welche Trigger es geben soll, und wie
  die jeweilige Inszenierung aus den vorhandenen Bausteinen (`ui_effect`,
  `ui_theme`, Musik, Blades) zusammengesetzt wird.
- **Edith-Startshow bei Sprachbefehl** (konkretes Beispiel für obigen Punkt):
  Sagt man "Hey Jarvis, starte Edith", soll das nicht der stille `ui_voice`-
  Wechsel sein, sondern eine eigene Aktivierungs-Show mit Sound und Video —
  ähnlich der Boot-Sequenz (`Boot.tsx`, `boot-music`) beim Hochfahren, nur für
  den Persona-Wechsel. **Prämisse durch die Weckwort-Änderung vom 2026-09-19
  überholt**: "Hey Edith" direkt weckt seit dieser Änderung überhaupt nicht
  mehr, solange eine andere Persona aktiv ist (siehe "Weckwort weckt nur die
  gerade aktive Persona" oben) — es gibt also gar keinen zweiten, stillen Weg
  mehr, von dem sich dieser hier abgrenzen müsste. Jeder Persona-Wechsel läuft
  jetzt ausnahmslos über einen Sprachbefehl und `ui_voice`. **Entschieden
  (2026-09-19), wie die beiden Fälle unterschieden werden**: die Formulierung
  selbst ist das Signal. "Wechsle zu Edith" (oder "werde zu Edith", "talk
  like Edith") bleibt der normale, stille `ui_voice`-Wechsel — kein Vorwand
  für eine Show, nur weil zufällig die Persona wechselt. Erst ein expliziter
  Show-Auftrag ("starte die Edith-Show", "Edith Startshow") löst die
  choreografierte Aktivierungssequenz aus. Modell muss also zwischen
  "wechsle/werde zu" (→ nur `ui_voice`) und "starte die Show" (→ Inszenierung
  plus danach `ui_voice`) unterscheiden, nicht zwischen "per Weckwort" und
  "per Kommando" wie ursprünglich angenommen. Noch offen bleibt der Rest:
  eigene Sequenz/Assets für Edith, und wie genau das als Tool-Aufruf oder
  System-Prompt-Regel modelliert wird.
- **Easter Eggs**: Bekannte Filmzitate lösen eine kleine Reaktion aus statt
  einer normalen Antwort — z.B. "I am Iron Man" spielt Musik plus einen
  Effekt ab. Kleinere, spontanere Verwandte der "Spezialbefehle mit fester
  Inszenierung" oben (ein Zitat, eine kurze Reaktion statt einer ganzen Show).
  Noch offen: welche Zitate, und ob die Erkennung fest im Voice-Layer sitzt
  oder dem Modell über den Prompt überlassen wird.
- **Objekt-Scan mit Zielerfassung**: Etwas in die Kamera halten, JARVIS legt
  einen Stark-HUD-Rahmen darüber (Zielkreis, Datenlinien, Beschriftung) und
  erklärt, was es ist. Das Sehen selbst kann er schon ("JARVIS schaut sich was
  an"), neu wäre nur die Inszenierung als Overlay auf dem Kamerabild. Noch
  offen: ob das Overlay die Position des Objekts im Bild kennen muss (dann
  bräuchte es Koordinaten aus der Bildanalyse) oder bewusst nur mittig sitzt.
- **Fokus-Modus (Pomodoro)**: "Fokus für 25 Minuten" — der Reaktor zeigt die
  Restzeit als Ring und pulsiert am Ende sanft, JARVIS meldet Pause und
  nächste Runde. Überschneidet sich mit "Timer und Wecker" oben, ist aber die
  sichtbare, laufende Variante statt eines einmaligen Signals. Noch offen: ob
  JARVIS währenddessen stiller ist (z.B. kein proaktiver Modus).
- **Reaktor als Musik-Visualizer**: Der Reaktor pulsiert im Takt der Musik, die
  gerade läuft. Für die eigene Musik (`src/lib/music.ts`) lässt sich das Signal
  direkt über einen Analyser abgreifen; für Musik aus anderen Apps (z.B.
  Spotify) bräuchte es die System-Audioausgabe, was im Browser nur eingeschränkt
  geht.
- **Wetter im Reaktor**: Das aktuelle Wetter spiegelt sich in der Optik — bei
  Regen fallen Partikel, bei Sonne glüht er warm, bei Gewitter flackert er
  kurz. Braucht eine Wetterquelle (Standort-Zugriff oben hilft) und neue
  Effekte in der Reaktor-Darstellung.
- **Marvel-Quiz**: Ein Quiz-Modus, moderiert von der aktiven Persona — Fragen
  zum Marvel-Universum, Punktestand als Blade. Passt thematisch zu den
  Avengers-Fakten im proaktiven Modus. Noch offen: fester Fragenkatalog oder
  vom Modell generierte Fragen (Risiko erfundener "Fakten").
- **Energieleiste wie ein Akku**: Das Claude-5-Stunden-Limit als Akku-Anzeige
  im HUD — voll zu Beginn des Fensters, leert sich mit dem Verbrauch, Farbe
  wechselt gegen Ende (grün → gelb → rot). Dazu passende Sprüche ("Energie-
  reserven bei 20 %, Sir"). Die Daten liefert der Limits-Tab schon
  (`rate_limits.five_hour.utilization`, siehe "Limits-Tab" oben), nur als
  dauerhaft sichtbare Anzeige statt versteckt im Panel. Noch offen: wo genau
  (SYSTEMS-Leiste, neben dem Reaktor), wie oft aktualisiert wird, und ob
  ElevenLabs als zweiter Akku daneben kommt.
- **Filmsounds**: Dezente Geräusche aus dem Iron-Man-Universum —
  Repulsor-Geräusch beim Schließen einer Blade, Servo-Surren beim Öffnen, kurzer
  Ton beim Persona-Wechsel. Abschaltbar im Einstellungs-Panel. Noch offen: woher
  die Sounds kommen (frei lizenziert, vgl. `public/audio/CREDITS.md`, statt
  Originalton aus den Filmen).
- **Filmszenen nachspielen**: Nicolas sagt Tonys Zeile, JARVIS antwortet mit der
  passenden Zeile aus dem Film, ggf. mit Effekt/Musik. Verwandt mit den Easter
  Eggs oben, nur als Wechselgespräch statt einer einzelnen Reaktion. Noch
  offen: fester Katalog an Szenen, und wie genau die Zeilen wörtlich sein
  dürfen (Filmzitate sind urheberrechtlich geschützt — eher sinngemäß oder
  kurze, bekannte Zeilen).
- ~~**"From Nicolas Brand"-Signatur**~~ — **umgesetzt (2026-09-19)**: dezent,
  aber lesbar ausgeschrieben im Marken-Bereich des HUD (`Hud.tsx`/
  `index.css`: `.brand-credit`, direkt unter der Persona-Tagline), als
  abgekürzte Boot-Log-Zeile in der Startsequenz (`Boot.tsx`: `OWNER
  SIGNATURE ... F.N.B.`, zwischen `CHECKSUM` und `RUN SYSTEM TOOL` — dort
  bewusst als Kürzel, passend zum kryptischen Log-Stil der übrigen Zeilen),
  und als Footer im Einstellungs-Panel (`Settings.tsx`: `.settings-credits`,
  "Created by Nicolas Brand").
- ~~**Weckwort weckt nur die aktive Persona**~~ — **umgesetzt (2026-09-19)**,
  auf Nicolas' Wunsch ("das macht es einfacher") — siehe "Personas" oben für
  die volle Begründung. Kurzfassung: `matchWake` (`src/lib/voice.ts`) prüft
  nur noch das Namensmuster der laut Store aktiven Persona statt aller fünf;
  ein Persona-Wechsel ("Hey Jarvis, wechsle zu Edith") ist damit ein
  normaler Sprachbefehl über `ui_voice` statt eines Namens-Treffers, der die
  Konversation stumm umgeht. `VoiceHandlers` bekam dafür ein neues
  `persona: () => string` Feld (`src/App.tsx` liest `store.getState().persona`
  frisch bei jedem Aufruf, genau wie `mode`); `onWake` verlor im Gegenzug
  seinen `persona`-Parameter komplett, weil er strukturell nie mehr etwas
  anderes als die schon aktive Persona melden kann.
- **Reaktor mit den Händen bewegen/squeezen**: Idee von Nicolas — die
  Reaktor-"Kugel" per Handgeste greifen, verschieben, zusammendrücken o.ä.,
  statt nur per Sprachbefehl (`ui_reactor`) zu steuern. Kurz nachgeschaut, was
  dafür schon da ist: `src/lib/hands.ts` erkennt bereits Gesten (`pinch`,
  `frame`, `fist`, `open`, `peace`, `point`) und liefert Fingerspitzen-Position
  + `closeness`/`span` pro Hand — aber aktuell ausschließlich zur Steuerung
  von DOM-Elementen (synthetische PointerEvents) und der Blade-Größe
  (`Blades.tsx`, das schon existierende "Hände zusammen = schrumpft, näher an
  die Kamera lehnen = wächst" ist ein Blade-Feature, keine Reaktor-Geste).
  Der Reaktor selbst (`scene/Core.tsx`) ist eine reine Shader-Fläche ohne
  jede Verbindung zu Handdaten — Größe/Farbe/Spin laufen bisher nur über
  `ui_reactor`. Technisch machbar, aber echte neue Arbeit: `frame`/`pinch`
  müssten auf Reactor-Props (`scale`, `intensity`, evtl. Position) gemappt
  werden, ähnlich wie sie heute auf Blade-Maße gemappt sind.
- **Frage: 3D-Modelle einbauen, die man mit der Hand bewegen kann** (z.B. ein
  Iron-Man-Anzug)? Kurz-Antwort: technisch machbar ohne neue Abhängigkeiten
  (`@react-three/drei` inkl. `useGLTF`/GLTFLoader ist schon installiert,
  aktuell aber nirgends genutzt — die Szene ist komplett shader-/2D-basiert,
  kein einziges 3D-Modell im Projekt bisher), aber kein Konfigurationsschalter,
  sondern ein echtes neues Feature:
  - Die Szene hat aktuell **keine Lichter** (Shader brauchen keine) — ein
    geladenes GLTF-Modell mit PBR-Material würde ohne zusätzliche Beleuchtung
    schwarz rendern.
  - Handdaten liefern **keine verlässliche Tiefe** (`hands.ts` verwirft
    MediaPipes eigenes Z explizit als "the noisiest number it reports") —
    echtes Drehen/Schieben in 3D bräuchte neue Annäherungs-Logik
    (Fingerabstand/-orientierung statt echtem Z).
  - Der bestehende `ui_orbit`/`OrbitObject`-Mechanismus (Bilder, die um den
    Reaktor kreisen) ist strikt bild-/Textur-basiert und müsste für ein
    3D-Modell neu gebaut werden, nicht nur erweitert.
  - Die Bridge liefert lokale Dateien nur für Bilder aus (`/file`-Endpunkt,
    feste `IMAGE_TYPES`-Liste) — ein fest ins Projekt gepacktes Modell
    (`public/models/*.glb`, per `useGLTF('/models/suit.glb')` geladen) braucht
    aber gar keine Bridge-Änderung, läuft einfach über die eigene Origin.
  - **Lizenz-Frage genau wie bei der Musik**: ein echtes Iron-Man-Modell ist
    Marvel/Disney-IP — für ein rein privates, nicht veröffentlichtes Projekt
    laut bisheriger Haltung unbedenklich (siehe "Musik-Kandidaten"), für
    irgendeine Veröffentlichung bräuchte es ein lizenziertes oder selbst
    gebautes/gekauftes Fan-Modell.
  - Fazit: machbar, aber ein eigenständiger Feature-Block (Licht + 3D-Lade-
    Pfad + neue Geste-zu-3D-Zuordnung + Modell-Beschaffung), keine
    Nachmittags-Änderung.

  **Konkrete Idee: "Suit Locker" als holographisches Wireframe, nicht als
  fotorealistisches Modell.** Umgeht gezielt die drei Hürden oben, statt sie
  einzeln zu lösen:

  - **Stil statt Realismus**: den Anzug als glühendes Cyan-Drahtgitter zeigen,
    im selben Look wie die schon vorhandene Anzug-Silhouette in der
    Boot-Sequenz (`Boot.tsx`, `Suit()`-Komponente — "Not the actual Mark VII
    geometry, but the same read"). Ein Wireframe/Emissive-Material braucht
    **keine Szenenbeleuchtung** (Hürde 1 fällt weg) und ist als eigenes,
    abstrahiertes Design auch urheberrechtlich unproblematischer als ein
    originalgetreues, texturiertes Filmmodell (Hürde 3 entschärft, nicht
    komplett gelöst — es bliebe eine Anlehnung an eine bekannte Silhouette).
    Ließe sich sogar ganz ohne `.glb`-Datei bauen: ein einfacher Low-Poly-
    Humanoid, prozedural mit Three.js-Primitives zusammengesetzt, mit dem
    gleichen Shader-Ansatz wie der Reaktor (`Core.tsx`) — dann entfällt auch
    noch die Modell-Beschaffung komplett, zumindest für eine erste Version.
  - **Rotation statt Tiefe**: statt echtem 3D-Greifen (Hürde 2) den Anzug wie
    ein Produkt auf einer Drehscheibe behandeln — Pinch-Geste plus seitliche
    Handbewegung dreht ihn um die Hochachse. Braucht keine Z-Daten, nur
    horizontale Fingerspitzen-Position, die `hands.ts` schon zuverlässig
    liefert.
  - **Skalieren wiederverwenden statt neu bauen**: die "Hände zusammen =
    schrumpft, auseinander = wächst"-Logik, die es für Blade-Größen schon
    gibt (`Blades.tsx`, `frameSpan()`), eins zu eins auf die Anzug-Skalierung
    ummünzen — gleiche Geste, neues Ziel.
  - **Mehrere Anzüge als Locker**: eine kleine Auswahl (Mark II, Mark VII,
    War Machine, ...) durchblätterbar — z.B. mit der schon vorhandenen
    Peace-Geste (`peaceScroll()`, aktuell fürs Scrollen genutzt). Ließe sich
    später sogar an Personas koppeln: Edith zeigt statt eines Anzugs ihre
    Drohnen-Silhouette aus "Far From Home", passend zu ihrem eigentlichen
    Film-Kontext statt eines generischen Anzugs.
  - Ergibt ein deutlich kleineres erstes Stück Arbeit als das volle
    "echtes GLTF-Modell + PBR-Beleuchtung + echte Gestenerkennung"-Paket
    oben, bei gleichem "man bewegt etwas mit der Hand"-Gefühl.
