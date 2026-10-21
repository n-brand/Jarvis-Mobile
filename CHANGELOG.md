# Changelog — eigener Fork (n-brand/jarvis, gespiegelt nach n-brand/Jarvis-Mobile)

Laufende, oberflächliche Übersicht über Features, die **nach dem Abspalten
vom Original** (<https://github.com/adewaskar/jarvis>) neu gebaut oder
verbessert wurden. Alles, was schon im Original steckte, taucht hier nicht
auf — der gemeinsame Stand endet bei Commit `1c4016a` ("JARVIS can open the
camera, watch you, and review what just happened"); alles danach ist
eigene Fork-Arbeit. Details, Bugfixes und technischer Tiefgang stehen in
[CLAUDE.md](CLAUDE.md); hier steht nur, *was* dazukam.

## 2026-10-21 — Jarvis Mobile als PWA
- Installierbar aufs Handy: Manifest, Service Worker (nur eigene Dateien,
  nie API-Aufrufe), iPhone-Tags, App-Icons im Stil des Portfolios
  (`scripts/make-icons.mjs`).
- GitHub-Pages-Workflow (`.github/workflows/pages.yml`) baut die direkte
  Variante ohne Bridge, ohne Secrets.
- Claude-API-Key wird pro Gerät in Einstellungen → APIS eingegeben statt
  in den Build eingebaut.
- Modell auf Claude Opus 5.5 umgestellt, mit automatischem Fallback bei
  Ablehnungen.
- Chat-Verlauf wird nicht mehr im Browser gespeichert.

## 2026-10-21 — Jarvis Mobile: ohne Erinnerung
- Kopie als `n-brand/Jarvis-Mobile`, Basis für die PWA-Version.
- Alles entfernt, womit JARVIS sich etwas über den Nutzer merkt: persönlicher
  Kontext (`bridge/context.md`), Standort-Abgleich (`bridge/places.md` und
  Browser-Geolocation) und der Notizblock N.O.R.A. (`bridge/nora.md`). Jedes
  Gespräch beginnt leer und endet mit der Verbindung.
- System-Prompt namensneutral: EDITH nennt den Vornamen nur, wenn er im
  Gespräch gefallen ist.
- Die Einträge unten beschreiben die Geschichte des Original-Repos und
  enthalten deshalb noch die entfernten Funktionen.

## 2026-09-23 — Electron-Shell, Standort-Zugriff, Text-only-Modus, Einstellungen persistent
- Eigene Desktop-App statt Chrome-Tab: `npm run electron`/`start-electron.cmd`
  startet Bridge + Vite + ein Electron-Fenster zusammen, sauberes Beenden
  inklusive.
- JARVIS kennt jetzt den tatsächlichen Standort (einmalige Browser-Geolocation
  pro Session, abgeglichen gegen `bridge/places.md`) statt nur zu raten.
- Neuer Schreibmodus-Schalter: Antworten nur schreiben statt vorlesen.
- Persona-/Stimm-Wahl übersteht jetzt einen Bridge-Neustart (JSON-Profildatei,
  geteilt zwischen Electron und Bridge).
- N.O.R.A. kann jetzt auch vorgelesen/zusammengefasst werden (`nora_read`).

## 2026-09-19 — Friday, Karen, Ultron; Weckwort nur für aktive Persona; Anhänge; Signatur
- Drei weitere Personas neben Jarvis/Edith: Friday, Karen, Ultron — je mit
  eigenem Weckwort, eigener Persönlichkeit und eigenem Marken-Schriftzug.
- Weckwort weckt jetzt nur noch die gerade aktive Persona; ein
  Persona-Wechsel läuft als echter Sprachbefehl über `ui_voice`.
- Bilder und Text-/Markdown-Dateien lassen sich jetzt anhängen (Copy-Paste,
  Taste I oder ein +-Button im Texteingabefeld).
- "From Nicolas Brand"-Signatur im HUD, in der Boot-Sequenz und im
  Einstellungs-Panel.

## 2026-09-18 — N.O.R.A.
Ein Notizblock, den JARVIS selbst auf dem Bildschirm öffnet und beschreibt —
per Sprache oder von Hand. Gegenstück zu `bridge/context.md` (das Nicolas
vorab füllt): hier schreibt JARVIS während des Gesprächs mit. Nebenbei:
ein alter Footer-Hinweis, fehlende Keybind-Einträge und ein Konflikt beim
`clear_history`-Befehl gefixt.

## 2026-09-16 — Sprache der Oberfläche, Sprachbefehle für Einstellungen, Limits
- Schalter, in welcher Sprache die Beschreibungstexte im Einstellungs-Panel
  angezeigt werden (unabhängig von der Sprache, in der JARVIS zuhört/spricht).
- JARVIS kann jetzt praktisch jede Einstellung per Sprachbefehl selbst
  umschalten (Mikrofon, Gesten, Sprache, Panel-Größen, Verlauf löschen, …).
- Neuer "Limits"-Tab im Einstellungs-Panel: zeigt Nutzungsobergrenzen an.
- Mehrere Sprach-/Stimm-Bugs behoben (u.a. Edith klang männlich, Persona-
  Wechsel per Weckwort wurde vom Dropdown nicht übernommen).

## 2026-09-15 — Text statt Sprache, Kopfhörer-Modus, Settings-Feinschliff
- Verstecktes Texteingabefeld (Enter/Space) als Alternative zum Sprechen.
- Umschalter Kopfhörer vs. Freisprechanlage.
- Diverses Feinschliff am Einstellungs-Panel; Fix: Persona blieb bei
  Sprachbefehl-Wechsel nicht synchron zwischen Store und UI.
- Fix: JARVIS baute sich bei "open settings" manchmal eine funktionslose
  Fake-Blade statt das echte Panel zu öffnen.
- Große Sammlung offener Ideen/Backlog-Punkte festgehalten.

## 2026-09-15 — Zweite Persona, Einstellungs-Panel
- JARVIS bekommt eine zweite Persona (Edith) mit eigenem Weckwort, eigener
  Stimme und eigenem Charakter, umschaltbar per Zuruf oder UI.
- Erstes richtiges Einstellungs-Panel (Stimme, Sprache, Schriftgrößen, …)
  statt verstreuter Einzel-Regler.

## 2026-09-14 — Chat-Verlauf scrollbar
Der Gesprächsverlauf zeigt nicht mehr nur die letzten vier Turns, sondern
lässt sich durch die ganze Session scrollen.

## 2026-09-14 — Getrennte Sprachen für Zuhören und Sprechen
Erkennungssprache (was JARVIS versteht) und Ausgabesprache (Browser-Fallback-
Stimme) sind jetzt unabhängig voneinander einstellbar statt zwangsweise gleich.
