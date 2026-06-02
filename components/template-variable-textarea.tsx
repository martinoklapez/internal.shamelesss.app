'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react'
import { cn } from '@/lib/utils'
import {
  getTemplateEditorCursorOffset,
  renderTemplateEditorContent,
  serializeTemplateEditor,
  setTemplateEditorCursorOffset,
} from '@/lib/creator-outreach/template-segments'

export type TemplateVariableTextareaHandle = {
  focus: () => void
  insertAtCursor: (token: string) => void
}

type TemplateVariableTextareaProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const TemplateVariableTextarea = forwardRef<
  TemplateVariableTextareaHandle,
  TemplateVariableTextareaProps
>(function TemplateVariableTextarea(
  { id, value, onChange, placeholder, className },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef<string | null>(null)
  const pendingCursorRef = useRef<number | null>(null)

  const syncEditor = (nextValue: string, cursorOffset?: number | null) => {
    const editor = editorRef.current
    if (!editor) return

    renderTemplateEditorContent(editor, nextValue)
    lastValueRef.current = nextValue

    if (cursorOffset != null) {
      requestAnimationFrame(() => {
        editor.focus()
        setTemplateEditorCursorOffset(editor, cursorOffset)
      })
    }
  }

  useLayoutEffect(() => {
    syncEditor(value)
  }, [])

  useEffect(() => {
    if (value === lastValueRef.current) return

    const cursor = pendingCursorRef.current
    pendingCursorRef.current = null
    syncEditor(value, cursor)
  }, [value])

  useImperativeHandle(ref, () => ({
    focus: () => {
      editorRef.current?.focus()
    },
    insertAtCursor: (token: string) => {
      const editor = editorRef.current
      if (!editor) {
        onChange(`${value}${token}`)
        return
      }

      const offset = getTemplateEditorCursorOffset(editor)
      const next = `${value.slice(0, offset)}${token}${value.slice(offset)}`
      pendingCursorRef.current = offset + token.length
      onChange(next)
    },
  }))

  const handleInput = () => {
    const editor = editorRef.current
    if (!editor) return

    const next = serializeTemplateEditor(editor)
    lastValueRef.current = next

    if (/\{\{\w+\}\}/.test(next)) {
      const cursor = getTemplateEditorCursorOffset(editor)
      renderTemplateEditorContent(editor, next)
      requestAnimationFrame(() => setTemplateEditorCursorOffset(editor, cursor))
    }

    onChange(next)
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  return (
    <div className="relative">
      <div
        id={id}
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={cn(
          'min-h-[220px] w-full resize-y overflow-auto rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm',
          'whitespace-pre-wrap break-words empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
          className
        )}
      />
    </div>
  )
})
