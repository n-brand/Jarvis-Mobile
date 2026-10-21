import { BACKEND } from '../config'
import * as direct from './anthropic'
import * as bridge from './bridge'
import type { AskHandlers, Msg } from './anthropic'
import type { Blade, Panel } from '../store'
import type { Attachment } from './attachments'

export type { AskHandlers, Msg }
export type { ConnectionState } from './bridge'

/**
 * Picks the brain. Both backends answer a question and stream text and tool
 * events back; they differ in where they run and what they can reach.
 *
 *   bridge — a local Node process running the Claude Agent SDK. Uses your
 *            existing Claude Code login, so no API key, and every MCP server
 *            you have configured is available, including local stdio ones.
 *
 *   direct — the browser calls the Claude API itself. No process to run and it
 *            deploys as a static site, but it needs an API key in the bundle
 *            and can only use remote HTTP MCP servers.
 */

export const usingBridge = BACKEND === 'bridge'

/** Conversation state lives in the bridge session, so history is only threaded
 *  through on the direct path. `attachment` (from a paste, the I-key file
 *  picker, or the text input's + button — see attachments.ts) rides
 *  alongside the text rather than replacing it — the bridge attaches it
 *  server-side (bridge/server.mjs), the direct path builds the same content
 *  blocks itself, since there is no server here to do it. */
export async function ask(
  prompt: string,
  attachment: Attachment | null,
  history: Msg[],
  handlers: AskHandlers,
  textOnly?: boolean,
): Promise<{ text: string; tools: string[] }> {
  // textOnly is a bridge-mode hint (see bridge/server.mjs) — the direct
  // path has no equivalent prompt to thread it into, so it's simply unused
  // there rather than half-supported.
  if (usingBridge) return bridge.ask(prompt, attachment, handlers, textOnly)

  const content: Msg['content'] = attachment
    ? [
        ...(prompt ? [{ type: 'text' as const, text: prompt }] : []),
        attachment.kind === 'image'
          ? {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: attachment.mimeType as 'image/jpeg',
                data: attachment.data,
              },
            }
          : { type: 'text' as const, text: `Attached file "${attachment.name}":\n\n${attachment.content}` },
      ]
    : prompt
  return direct.ask([...history, { role: 'user', content }], handlers)
}

export async function warm(): Promise<void> {
  if (usingBridge) await bridge.warmBridge()
}

/** The bridge reports its server list twice — from config on connect, then
 *  with live status once the agent boots — so the HUD subscribes. */
export function watchServers(fn: (servers: string[]) => void): void {
  if (usingBridge) bridge.watchServers(fn)
}

/** HUD panels are pushed mid-turn by the `display` tool, not returned by ask(). */
export function watchPanels(fn: (panel: Panel) => void): void {
  if (usingBridge) bridge.watchPanels(fn)
}

/** Blades — the big surface — arrive the same way, from the `blade` tool. Like
 *  panels and the ui_* commands, this is a bridge capability: the direct path
 *  has no channel for a server to volunteer anything mid-turn. */
export function watchBlades(fn: (blade: Blade) => void): void {
  if (usingBridge) bridge.watchBlades(fn)
}

/**
 * Redressing the interface — theme, reactor, orbiting objects, effects — is a
 * bridge capability, like panels. The `ui_*` tools live in an in-process MCP
 * server inside the bridge and push straight down the open socket, mid-turn.
 * The direct path has no such channel: the browser talks to the Messages API
 * over one-shot HTTPS requests and gets back an answer, with nowhere for a
 * server to volunteer anything. On that backend this watcher simply never
 * fires and the interface stays exactly as it ships.
 */
export function watchUi(fn: (op: string, args: any) => void): void {
  if (usingBridge) bridge.watchUi(fn)
}

/** Settings panel's Limits tab, fetched on demand rather than pushed —
 *  bridge-only, like the rest of this file: the direct path has no session
 *  object to ask a rate-limit question of in the first place. */
export function watchClaudeUsage(fn: (data: unknown, error?: string) => void): void {
  if (usingBridge) bridge.watchUsage(fn)
}
export function requestClaudeUsage(): void {
  if (usingBridge) bridge.requestUsage()
}

/**
 * The one thing the bridge asks US for.
 *
 * Every other channel here is the bridge volunteering something mid-turn. A
 * camera frame is the exception — the hardware is in the browser and the model
 * is in the bridge — so this handler answers a request rather than receiving a
 * push. Bridge-only for the same reason as the rest: the direct path is one-shot
 * HTTPS, with nowhere for a request to arrive.
 */
export function watchCapture(
  fn: (req: bridge.CaptureRequest) => Promise<bridge.CaptureResult>,
): void {
  if (usingBridge) bridge.watchCapture(fn)
}

/**
 * Barge-in. Stops the answer on both paths and settles whatever `ask()` call
 * is outstanding, so the caller's await always returns — on the bridge by
 * interrupting the agent and resolving with the text so far, on the direct
 * path by aborting the stream so the model stops generating and billing.
 */
export function cancel(): void {
  if (usingBridge) bridge.cancel()
  else direct.cancel()
}

/** The older name for `cancel()`. */
export function interrupt(): void {
  cancel()
}

/**
 * Whether the brain is reachable right now.
 *
 * Only meaningful on the bridge, where a live socket is the session. The direct
 * path holds no connection between turns — each one is its own HTTPS request —
 * so there is nothing that can be down until you try it.
 */
export function isConnected(): boolean {
  return usingBridge ? bridge.isConnected() : true
}

/**
 * Connection state, for the UI.
 *
 * Worth surfacing because in bridge mode the socket *is* the conversation: all
 * of JARVIS's memory of the exchange lives in the agent session behind it, so a
 * drop wipes the conversation while the transcript on screen still shows it.
 * Never fires on the direct path, which has no connection to lose.
 */
export function watchConnection(
  fn: (state: bridge.ConnectionState) => void,
): void {
  if (usingBridge) bridge.watchConnection(fn)
}

/** Labels for the HUD's SYSTEMS rail. */
export function connectedLabels(): string[] {
  return usingBridge ? bridge.bridgeServers() : direct.connectedLabels()
}
