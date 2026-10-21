# JARVIS — Externe Dienste & Keys

Referenz: welche externen Accounts/Keys JARVIS optional nutzt, woher man sie
bekommt, und wo sie eingetragen werden. Bewusst **ohne** die eigentlichen
Werte — die trägt jeder für sich selbst ein (Terminal-Befehl, `.env.local`
oder `claude mcp add`), nie in eine Datei im Repo. Gleiches Prinzip wie beim
ElevenLabs-Key in der [CLAUDE.md](CLAUDE.md), hier nur an einer Stelle
gesammelt statt über die lange Datei verteilt.

## ElevenLabs — Stimme (TTS + STT)

- **Wofür**: echte Charakterstimmen (Jarvis/Edith) statt Browser-Fallback,
  plus ElevenLabs Scribe als bessere Spracherkennung
- **Bekommen**: [elevenlabs.io](https://elevenlabs.io) → API Keys. Scope nur
  **Text zu Sprache** + **Sprache zu Text** freischalten, Rest auf "Kein
  Zugang". "Bei Leaks automatisch deaktivieren" an.
- **Eintragen**: vor dem Start als Umgebungsvariable (PowerShell):
  ```
  $env:ELEVENLABS_API_KEY="dein-key"
  npm.cmd start
  ```
- **Kosten**: zeichenbasiertes Kontingent, siehe elevenlabs.io/pricing.
  Aktueller Verbrauch im laufenden JARVIS sichtbar unter Einstellungen →
  LIMITS.

## Exa — Websuche (MCP)

- **Wofür**: JARVIS kann im Web suchen (*"What's happening in AI this
  week?"*) — ohne MCP-Server hat er dafür kein Werkzeug.
- **Bekommen**: [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys)
- **Eintragen**: einmalig im Terminal (schreibt nach `~/.claude.json`,
  nicht ins Repo):
  ```
  claude.cmd mcp add exa -s user -e EXA_API_KEY=dein-key -- npx -y exa-mcp-server
  ```
- **Kosten**: gratis bis 20.000 Anfragen/Monat, plus 20$ Startguthaben
  (Stand 2026-09) — für JARVIS' gelegentliche Suchen praktisch nicht
  erreichbar.
- **Nach dem Einrichten**: `claude.cmd mcp list` zur Kontrolle, dann den
  Bridge-Prozess neu starten (`npm.cmd start`) — `MCP_SERVERS` wird in
  `bridge/server.mjs` nur einmal beim Hochfahren gelesen.

## Bewusst (noch) nicht eingerichtet

- **Bildgenerierung** (Higgsfield oder OpenRouter) — beide kostenpflichtig
  für den MCP-Weg (Higgsfields Gratis-Perks gelten laut eigener Preisseite
  nur direkt auf higgsfield.ai, nicht über MCP/CLI). Auf Nicolas' Wunsch
  vorerst ausgelassen (2026-09-22).
- **`android`** (Handy-Steuerung) — aufwendiger Lift (physisch verbundenes
  Android-Gerät per ADB, kein einzelner offizieller MCP-Server). Auf
  Nicolas' Wunsch vorerst ausgelassen (2026-09-22).

Die Bildgenerierungs-Server sind in `bridge/server.mjs`s `READ_ONLY_MCP`-
Allowlist schon vorbereitet — sobald einer konfiguriert wird, greift er ohne
weitere Code-Änderung. `android` dagegen steht dort bewusst **nicht** drin
(Handy-Steuerung ist kein reiner Lesezugriff) — bräuchte bei Bedarf noch eine
eigene Entscheidung, wie es ins Freigabe-System passt.
