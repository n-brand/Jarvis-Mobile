/**
 * Turning something dropped on JARVIS — pasted, or picked via the I key /
 * the text input's attach button — into one of two shapes the model can
 * use, regardless of where it came from.
 *
 *   image — re-encoded through a canvas into the same {data, mimeType} shape
 *           the camera already hands the model (grabFrame in camera.ts), so
 *           the bridge has one image contract whether the picture came from
 *           the lens or the clipboard.
 *   text  — a markdown/text/code file, read as-is and carried as its own
 *           content block. There is no image to preview, so TextInput.tsx
 *           shows a name badge instead of a thumbnail for these.
 *
 * Re-encoded rather than sent as the original file bytes for images, for the
 * same reason camera.ts re-encodes every frame: a consistent, modest JPEG
 * rather than whatever format and size the source happened to be (a phone
 * screenshot can be several megabytes of PNG).
 */

export type Attachment =
  | { kind: 'image'; data: string; mimeType: string }
  | { kind: 'text'; name: string; content: string }

/** Long side, in pixels. Large enough that text in a screenshot stays
 *  legible, small enough that a multi-megapixel photo does not balloon the
 *  turn's token cost the way an unscaled original would. */
const MAX_DIMENSION = 1600

/** Text files past this size are refused rather than silently truncated —
 *  large enough for any real note or config, small enough that attaching one
 *  can never quietly dwarf the rest of the turn. */
const MAX_TEXT_CHARS = 50_000

/** Extensions accepted as plain text even when file.type says nothing useful
 *  — most browsers report an empty type for .md, since it has no registered
 *  system MIME type the way .txt or .json do. */
const TEXT_EXTENSIONS =
  /\.(md|markdown|txt|json|csv|log|ya?ml|xml|ts|tsx|js|jsx|py|java|c|cpp|h|hpp|css|html|sh|toml|ini)$/i

function isTextFile(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    TEXT_EXTENSIONS.test(file.name)
  )
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('could not decode the image'))
    img.src = url
  })
}

async function encodeImage(file: Blob): Promise<{ data: string; mimeType: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale) || 1
    const h = Math.round(img.naturalHeight * scale) || 1
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('could not read the image')
    ctx.drawImage(img, 0, 0, w, h)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Throws for anything neither an image nor recognisable as text — a PDF or
 *  a .docx, say — rather than attaching something the model would only see
 *  as either a broken picture or a wall of binary noise. */
export async function readAttachment(file: File): Promise<Attachment> {
  if (file.type.startsWith('image/')) {
    const { data, mimeType } = await encodeImage(file)
    return { kind: 'image', data, mimeType }
  }
  if (isTextFile(file)) {
    const content = await file.text()
    if (content.length > MAX_TEXT_CHARS) {
      throw new Error(
        `${file.name} is too large to attach (over ${MAX_TEXT_CHARS.toLocaleString()} characters).`,
      )
    }
    return { kind: 'text', name: file.name, content }
  }
  throw new Error(`Can't attach ${file.name || 'this file'} — only images and text/markdown files work.`)
}

/** The first real file among a paste event's items, if any — covers both a
 *  screenshot on the clipboard and a file copied in a file manager. Plain
 *  copied text has no file-kind item, so a normal text paste is never
 *  intercepted by this. */
export function fileFromClipboard(items: DataTransferItemList): File | null {
  for (const item of Array.from(items)) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}
