import { useEffect, useRef } from 'react'
import type { Attachment } from '../lib/attachments'

/**
 * Hidden text-entry fallback for whenever speaking isn't an option — a
 * library, late at night without headphones. Enter reveals it (see App.tsx's
 * key handler). The reply still comes back spoken, same as a voice turn —
 * this only replaces how the question gets in, not how the answer comes out.
 *
 * Stays open across sends rather than closing after each one — closing every
 * time meant an Enter-to-reveal before every single message in a back-and-
 * forth, which is the wrong trade for a quick exchange of short lines.
 * Enter on a non-empty box, or with an attachment present, sends and clears,
 * ready for the next line; Enter on an already-empty box with nothing
 * attached, Escape, or losing focus all close it instead.
 *
 * `attachment` is lifted into App.tsx rather than kept as local state here —
 * a paste can land while this input is open (attaching to what's about to be
 * sent) from the very same global listener that opens it in the first place,
 * so one owner is simpler than reconciling two.
 */
export function TextInput({
  open,
  persona,
  attachment,
  onSubmit,
  onAttach,
  onClearAttachment,
  onClose,
}: {
  open: boolean
  persona: string
  attachment: Attachment | null
  onSubmit: (text: string, attachment: Attachment | null) => void
  /** The + button — opens the same file picker as the I key (App.tsx). */
  onAttach: () => void
  onClearAttachment: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="text-input-bar">
      <button
        type="button"
        className="text-input-attach"
        title="Attach an image or text file (I)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onAttach}
      >
        +
      </button>
      {attachment && (
        <span className="text-input-attachment">
          {attachment.kind === 'image' ? (
            <img src={`data:${attachment.mimeType};base64,${attachment.data}`} alt="Attached" />
          ) : (
            <span className="text-input-attachment-name" title={attachment.name}>
              {attachment.name}
            </span>
          )}
          <button
            type="button"
            className="text-input-attachment-clear"
            title="Remove attachment"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClearAttachment}
          >
            ✕
          </button>
        </span>
      )}
      <input
        ref={ref}
        className="text-input"
        placeholder={
          attachment ? 'Add a question, or press Enter to send…' : `Type to ${persona.toUpperCase()}…`
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const text = ref.current?.value.trim() ?? ''
            if (!text && !attachment) {
              onClose()
              return
            }
            onSubmit(text, attachment)
            if (ref.current) ref.current.value = ''
          } else if (e.key === 'Escape') {
            onClose()
          }
        }}
        onBlur={onClose}
      />
    </div>
  )
}
