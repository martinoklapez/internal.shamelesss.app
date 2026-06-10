'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getTemplateEditorCursorOffset,
  renderTemplateEditorContent,
  serializeTemplateEditor,
  setTemplateEditorCursorOffset,
} from '@/lib/creator-outreach/template-segments'
import { Bold } from 'lucide-react'

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    document.execCommand('insertLineBreak')
    handleInput()
  }

  const applyFormat = (command: 'bold' | 'italic') => {
    const editor = editorRef.current
    if (!editor) return

    editor.focus()
    document.execCommand(command, false)
    handleInput()
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label="Bold"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyFormat('bold')}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div
        id={id}
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={cn(
          'min-h-[220px] w-full resize-y overflow-auto rounded-b-md border border-input bg-background px-3 py-2 text-sm leading-relaxed ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm',
          'whitespace-pre-wrap break-words empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
          className
        )}
      />
    </div>
  )
})
