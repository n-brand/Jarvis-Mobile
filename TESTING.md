# Was noch getestet werden muss

Sammelt alles aus dieser Session, was ich nicht selbst testen konnte (kein
Mikro, kein Bildschirm für Electron-Fenster, kein Auslösen echter
Git-Commits zum Testen) — zum gesammelten Durchtesten am Ende. Wird laufend
ergänzt, so lange weitergebaut wird.

## Keine Erinnerung (Jarvis Mobile)

Dateien: `bridge/server.mjs` (SYSTEM_PROMPT, Abschnitt "Memory")

- [ ] Beim Hochfahren fragt der Browser **nicht** nach dem Standort
- [ ] "Merk dir das" → JARVIS sagt, dass er sich nichts merken kann
- [ ] "Was weißt du über mich?" → nichts Persönliches außer dem, was im
      laufenden Gespräch gesagt wurde
- [ ] Seite neu laden → das vorherige Gespräch ist weg, auch der angezeigte
      Verlauf (kein `jarvis-history` mehr in `localStorage`)

## PWA / Handy (Pages-Version)

Dateien: `public/manifest.webmanifest`, `public/sw.js`, `src/main.tsx`,
`.github/workflows/pages.yml`, `src/ui/Settings.tsx` (Key-Feld)

- [ ] Workflow läuft grün, https://n-brand.github.io/Jarvis-Mobile/ lädt
      ohne 404 (auch Musik unter `/Jarvis-Mobile/audio/…`)
- [ ] Ohne Key: Hinweis "No Claude API key on this device"
- [ ] Key in Einstellungen → APIS speichern → Seite lädt neu, Status
      "(gespeichert)", Feld bleibt leer (Key wird nie angezeigt)
- [ ] "Hey Jarvis" bzw. Frage tippen → Antwort kommt
- [ ] "Entfernen" → Key weg, Hinweis erscheint wieder
- [ ] iPhone Safari → Zum Home-Bildschirm: Icon im Portfolio-Stil, Name
      "JARVIS", startet ohne Safari-Leiste
- [ ] Flugmodus → App öffnet trotzdem (Oberfläche), Antwort scheitert mit
      Fehlermeldung statt hängen zu bleiben
- [ ] DevTools → Application → Cache: keine Einträge von api.anthropic.com

## Offline-/Degraded-Modus

Dateien: `src/App.tsx` (`mode()`, `onWake()`, `watchConnection`-Handler),
`src/lib/fillers.ts` (`STILL_OFFLINE`)

- [ ] Bridge-Prozess mitten in einer laufenden Session per Ctrl-C stoppen
- [ ] "Hey Jarvis" sagen, während getrennt → eine der Offline-Phrasen wird
      gesprochen (nicht Stille, nicht Hängenbleiben)
- [ ] Während getrennt: Standby (Escape), Mikro-Stummschaltung, Lautstärke,
      Einstellungen-Panel funktionieren weiterhin
- [ ] Bridge neu starten → "Bridge reconnected"-Meldung erscheint, nennt was
      blockiert war/wieder geht

## Einheiten (Celsius, Meter, nicht Fahrenheit/Fuß)

Datei: `bridge/server.mjs` (SYSTEM_PROMPT, Abschnitt "UNITS")

- [ ] Etwas mit Temperatur/Entfernung fragen → Antwort in Celsius/Metern
- [ ] Ausdrücklich nach Fahrenheit fragen ("wie viel Fahrenheit sind das") →
      JARVIS nennt es in Fahrenheit für diese eine Antwort, fällt danach
      wieder auf Metrik zurück

## Schreibmodus — nur Text statt Vorlesen (bei Texteingabe)

Dateien: `src/store.ts` (`textOnly`), `src/App.tsx` (`respond()`s `viaText`,
`silentSpeaker()`), `src/ui/Settings.tsx`, `bridge/server.mjs`
(Text-only-Hinweis + neuer Prompt-Abschnitt)

Bereits hier verifiziert (per Texteingabe + `window.__tts`-Zähler, kein
Mikro nötig dafür): "Nur schreiben" aktiv → Antwort erscheint im Verlauf,
`window.__tts.spoken` bleibt bei 0 für diese Antwort. "Auch vorlesen"
aktiv → dieselbe Art Frage wird tatsächlich gesprochen. Beide Richtungen
funktionieren.

Noch offen (dein Rechner):
- [ ] Bei "Nur schreiben" etwas fragen, wo sich Markdown/Links/Struktur
      anbieten (z.B. "gib mir eine Liste mit 5 Ideen für X") → Antwort
      nutzt tatsächlich lockerere Formatierung statt reinem Fließtext
- [ ] Per **Sprache** gefragt (nicht getippt) → wird immer vorgelesen,
      unabhängig vom Schreibmodus-Schalter
- [ ] Schalter steht nach App-Neustart (Electron) noch auf dem zuletzt
      gewählten Wert

## Electron-Hülle (Task 1 des Umbau-Plans)

Datei: `electron/main.mjs` — **wichtig:** die Kindprozesse (Bridge, Vite)
wurden in einer Umgebung ohne Bildschirm bereits als startfähig bestätigt,
aber ob sich tatsächlich ein Fenster öffnet, ist noch **komplett
unverifiziert** — das kann nur auf deinem echten Rechner passieren.

- [ ] `npm run electron` im Projektordner (Hauptverzeichnis, nicht Worktree)
- [ ] Doppelklick auf `start-electron.cmd` (Windows-Explorer, ganz ohne
      Konsole öffnen) → startet genauso wie `npm run electron` manuell
- [ ] Fenster über `start-electron.cmd` gestartet, dann geschlossen →
      Konsolenfenster verschwindet von allein mit, kein Fehler sichtbar
- [ ] `start-electron.cmd` zweimal hintereinander doppelklicken → zweiter
      Versuch zeigt einen lesbaren Port-Fehler (pausiert), stürzt nicht
      lautlos ab
- [ ] Ein Fenster öffnet sich tatsächlich (Titel "J.A.R.V.I.S.", 1400×900)
- [ ] Boot-Animation, INITIALISE, "Hey Jarvis" — verhält sich identisch zu
      `npm start` im Chrome-Tab
- [ ] Fenster schließen / Ctrl-C im Terminal → beide Kindprozesse (Bridge +
      Vite) beenden sich sauber, keine verwaisten `node`-Prozesse im
      Task-Manager

## Profil-Datei (Task 2 des Umbau-Plans)

Datei: `electron/profile.mjs` — bereits mit echten automatisierten Tests
verifiziert (`node --test electron/profile.test.mjs`, 4/4 grün, vom Review
unabhängig nachgeprüft). Noch nicht an echte Einstellungen angebunden
(kommt mit Task 3-5) — hier nichts manuell zu testen, bis das steht.

## Neue Personas: Ultron, Friday, Karen

Dateien: `bridge/server.mjs` (PERSONAS, Personas-Prompt-Abschnitt),
`bridge/ui.mjs` (`ui_voice`-Schema), `src/lib/voice.ts` (WAKE_NAMES),
`src/store.ts` (BRAND)

- [ ] Per Sprachbefehl zu jedem der drei wechseln ("Hey Jarvis, switch to
      ultron"/"werde zu friday"/"werde zu karen") — siehe Abschnitt
      "Weckwort gilt nur noch für die aktive Persona" unten, warum das jetzt
      der einzige Weg ist
- [ ] Ultron aktiv: Stimme ist Jarvis' männliche Stimme (Platzhalter),
      Marken-Schriftzug zeigt "ULTRON", Ton süffisant/trocken
- [ ] Friday aktiv: Stimme ist Ediths Stimme (Platzhalter), Schriftzug zeigt
      "F.R.I.D.A.Y.", Ton locker/"boss" statt "sir"
- [ ] Karen aktiv: Stimme ist Jarvis' weibliche Stimme (Platzhalter),
      Schriftzug zeigt "KAREN", Ton sehr leger/redet drauflos
- [ ] NAMES-Tab (Settings): alle fünf Personas gelistet — bei
      Jarvis/Edith/Friday die echte Akronym-Ausschreibung, bei
      Karen/Ultron nur die kurze Beschreibungszeile (bewusst kein erfundenes
      Akronym)
- [ ] Fehlhör-Varianten für alle drei fehlen noch — über D-Diagnose
      beobachten, was tatsächlich ankommt, `WAKE_NAMES` ggf. nachschärfen

## Weckwort gilt nur noch für die aktive Persona (seit 2026-09-23)

Betrifft jetzt auch Jarvis/Edith, nicht nur die drei neuen — echte
Verhaltensänderung. Datei: `src/lib/voice.ts` (`matchWake`), `src/App.tsx`
(`currentPersona`-Handler)

- [ ] Jarvis ist aktiv (Standard nach Boot): "Hey Edith" **allein** weckt
      **nicht** mehr — keine Reaktion
- [ ] Jarvis ist aktiv: "Hey Jarvis" weckt wie gewohnt
- [ ] "Hey Jarvis, switch to Edith" (oder deutsch: "werde zu Edith") →
      wechselt zu Edith
- [ ] Danach ist Edith aktiv: jetzt weckt "Hey Edith", aber "Hey Jarvis"
      **nicht** mehr
- [ ] Kein Bridge/Agenten-Turn nötig, um zur eigenen aktiven Persona
      zurückzukommen — nur ein fremder Name braucht den Sprachbefehl-Umweg

## Electron: Einstellungen überstehen einen kompletten Neustart (Task 3-5 + Settings.tsx)

Dateien: `electron/preload.cjs`, `electron/main.mjs` (IPC), `src/lib/profile.ts`
(`getSetting`/`setSetting`/`removeSetting`), plus alle Dateien, die jetzt
darüber laufen (`store.ts`, `prefs.ts`, `config.ts`, `voice.ts`, `tts.ts`,
`i18n.ts`, `App.tsx`, `Settings.tsx`) — bisher nur automatisiert
verifiziert (Build/Lint/Tests, node:test für `electron/profile.mjs`), noch
**kein einziger echter Durchlauf mit Fenster**.

- [ ] `npm run electron` — Fenster öffnet sich, DevTools auf (Strg+Umschalt+I),
      `window.jarvisProfile.set('test', 123)` dann `window.jarvisProfile.get('test')`
      → liefert `123`
- [ ] App komplett schließen und neu starten (nicht nur Reload) →
      `window.jarvisProfile.get('test')` liefert immer noch `123` — beweist,
      dass es wirklich auf Platte lag
- [ ] `%APPDATA%/jarvis/profile.json` existiert und enthält `{"test":123}`
- [ ] Kopfhörer-Schalter, eine Schriftgrößen-Regler-Position, Panel-Größe,
      "Intro überspringen" im Einstellungs-Panel ändern → App komplett
      neu starten → alle Änderungen noch da (nicht nur nach einem
      Browser-Reload, das ging schon vorher — hier zählt der volle
      Neustart)
- [ ] Sprache/Zuhören-Engine/Sprechen-Engine im Panel umschalten → App
      komplett neu starten → Wahl noch da
- [ ] `npm run dev` (kein Electron, kein `window.jarvisProfile`) → alles wie
      bisher über `localStorage`, keine Fehler, keine Regression
- [ ] Eine gespeicherte Stimme im Browser-Fallback künstlich ungültig machen
      (z.B. Sprachpaket deinstallieren) → Taste V mehrfach drücken → Name
      wird laut Konsole/Verhalten wirklich fallengelassen, nicht bei jedem
      Aufruf erneut (unbeobachtbarer) Lösch-Versuch — betrifft die
      `removeSetting`-Ergänzung

## Electron: Persona/Stimme übersteht einen Neustart (Task 6)

Datei: `bridge/server.mjs` (`readVoiceProfile`/`writeVoiceProfile`)

- [ ] Unter `npm run electron`: "Hey Jarvis, switch to Edith" (oder
      Dropdown/Settings) → App komplett neu starten → JARVIS kommt als
      Edith zurück, nicht als Standard-Jarvis
- [ ] Danach `npm run bridge` allein starten (kein Electron, keine
      `JARVIS_PROFILE_PATH`) → startet trotzdem fehlerfrei, Standard ist
      wieder Jarvis/EN/männlich wie schon immer — bestätigt, dass der
      Standalone-Weg unverändert ist
