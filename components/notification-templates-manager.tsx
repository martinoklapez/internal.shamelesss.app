'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/date'
import {
  type NotificationContentTemplate,
  PLACEHOLDERS_BY_TYPE,
  NOTIFICATION_PLACEHOLDERS,
} from '@/lib/notification-content-templates'
import { Pencil, Trash2, Send, Play } from 'lucide-react'

const PREVIEW_VALUES: Record<string, string> = {
  sender_name: 'John',
  recipient_name: 'Jane',
  message_preview: 'Hey there!',
}

const KNOWN_PLACEHOLDERS = new Set(Object.keys(NOTIFICATION_PLACEHOLDERS))

function previewText(text: string): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => PREVIEW_VALUES[key] ?? `{${key}}`)
}

/** Serialize contenteditable content back to plain template string */
function serializeTemplateEl(el: HTMLElement): string {
  let out = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? ''
      return
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const span = node as HTMLElement
      if (span.getAttribute?.('data-ignore') !== null) return
      const key = span.getAttribute?.('data-placeholder')
      if (key != null) {
        out += `{${key}}`
        return
      }
    }
    node.childNodes.forEach(walk)
  }
  el.childNodes.forEach(walk)
  return out
}

/** Editable field: template string with placeholders rendered as inline badges */
function TemplateInput({
  value,
  onChange,
  placeholder,
  className,
  id,
}: {
  value: string
  onChange: (s: string) => void
  placeholder?: string
  className?: string
  id?: string
}) {
  const [internal, setInternal] = useState(value)
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInternal(value)
  }, [value])

  const parts: React.ReactNode[] = []
  const re = /\{(\w+)\}/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(internal)) !== null) {
    if (m.index > lastIndex) {
      parts.push(internal.slice(lastIndex, m.index))
    }
    const key = m[1]
    parts.push(
      <span
        key={`${m.index}-${key}`}
        contentEditable={false}
        data-placeholder={key}
        className={
          KNOWN_PLACEHOLDERS.has(key)
            ? 'inline-flex items-center rounded bg-emerald-600 text-white text-[10px] px-1.5 py-0 font-mono align-baseline'
            : 'inline-flex items-center rounded bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0 font-mono align-baseline'
        }
      >
        {`{${key}}`}
      </span>
    )
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < internal.length) {
    parts.push(internal.slice(lastIndex))
  }
  if (parts.length === 0 && placeholder) {
    parts.push(
      <span key="ph" data-ignore className="pointer-events-none text-gray-400">
        {placeholder}
      </span>
    )
  }

  return (
    <div
      ref={elRef}
      id={id}
      contentEditable
      suppressContentEditableWarning
      onInput={() => {
        if (!elRef.current) return
        const next = serializeTemplateEl(elRef.current)
        setInternal(next)
        onChange(next)
      }}
      className={cn(
        'min-h-8 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      {parts}
    </div>
  )
}

/** Renders template text with placeholders as badges (known = green, unknown = gray) */
function TemplateWithBadges({ text, className }: { text: string; className?: string }) {
  const parts: Array<{ type: 'text' | 'placeholder'; value: string }> = []
  let lastIndex = 0
  const re = /\{(\w+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, m.index) })
    }
    parts.push({ type: 'placeholder', value: m[1] })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <span key={i}>{p.value}</span>
        ) : (
          <Badge
            key={i}
            variant={KNOWN_PLACEHOLDERS.has(p.value) ? 'default' : 'secondary'}
            className={
              KNOWN_PLACEHOLDERS.has(p.value)
                ? 'bg-emerald-600 text-white border-0 text-[10px] px-1.5 py-0 font-mono'
                : 'bg-gray-200 text-gray-600 border-0 text-[10px] px-1.5 py-0 font-mono'
            }
          >
            {`{${p.value}}`}
          </Badge>
        )
      )}
    </span>
  )
}

interface NotificationTemplatesManagerProps {
  initialTemplates: NotificationContentTemplate[]
}

export default function NotificationTemplatesManager({
  initialTemplates,
}: NotificationTemplatesManagerProps) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  const [editing, setEditing] = useState<NotificationContentTemplate | null>(null)
  const [titleTemplate, setTitleTemplate] = useState('')
  const [bodyTemplate, setBodyTemplate] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingType, setDeletingType] = useState<string | null>(null)

  const [testUsers, setTestUsers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([])
  const [sendingTest, setSendingTest] = useState(false)

  const [testModalType, setTestModalType] = useState<string | null>(null)
  const [modalTestUserId, setModalTestUserId] = useState<string>('')

  const openEdit = (t: NotificationContentTemplate) => {
    setEditing(t)
    setTitleTemplate(t.title_template)
    setBodyTemplate(t.body_template)
  }

  const closeEdit = () => {
    setEditing(null)
    setTitleTemplate('')
    setBodyTemplate('')
  }

  const insertPlaceholder = (key: string, target: 'title' | 'body') => {
    const value = `{${key}}`
    if (target === 'title') setTitleTemplate((prev) => prev + value)
    else setBodyTemplate((prev) => prev + value)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/notification-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_type: editing.notification_type,
          title_template: titleTemplate,
          body_template: bodyTemplate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      setTemplates((prev) =>
        prev.map((t) =>
          t.notification_type === editing.notification_type
            ? {
                ...t,
                title_template: titleTemplate,
                body_template: bodyTemplate,
                updated_at: new Date().toISOString(),
              }
            : t
        )
      )
      closeEdit()
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (notificationType: string) => {
    if (!confirm(`Delete template for "${notificationType}"? The Edge Function will fall back to job defaults.`)) return
    setDeletingType(notificationType)
    try {
      const res = await fetch(
        `/api/notification-templates?notification_type=${encodeURIComponent(notificationType)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setTemplates((prev) => prev.filter((t) => t.notification_type !== notificationType))
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeletingType(null)
    }
  }

  const loadTestUsers = async () => {
    if (testUsers.length > 0) return
    const res = await fetch('/api/users/list')
    const data = await res.json()
    if (res.ok && Array.isArray(data.users)) {
      setTestUsers(data.users)
    }
  }

  const openTestModal = (notificationType: string) => {
    setTestModalType(notificationType)
    if (testUsers.length > 0) {
      setModalTestUserId(testUsers[0].id)
    } else {
      fetch('/api/users/list')
        .then((res) => res.json())
        .then((data) => {
          if (data.users?.length) {
            setTestUsers(data.users)
            setModalTestUserId(data.users[0].id)
          }
        })
    }
  }

  const handleSendTestFromModal = async () => {
    if (!testModalType || !modalTestUserId) {
      alert('Select a user.')
      return
    }
    setSendingTest(true)
    try {
      const res = await fetch('/api/notification-templates/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: modalTestUserId, notification_type: testModalType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send test')
      setTestModalType(null)
      alert(data.message ?? 'Test push sent.')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send test')
    } finally {
      setSendingTest(false)
    }
  }

  const placeholders = editing ? PLACEHOLDERS_BY_TYPE[editing.notification_type] ?? [] : []

  return (
    <div className="space-y-8">
      {/* Templates list — minimal rows */}
      <section>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Templates</h2>
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
          {templates.map((t) => (
            <div
              key={t.notification_type}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 hover:bg-gray-50/80"
            >
              <span className="font-mono text-sm text-gray-900 w-44 shrink-0">{t.notification_type}</span>
              <span className="text-sm text-gray-700 min-w-0 flex-1">
                <TemplateWithBadges text={t.title_template} /> — <TemplateWithBadges text={t.body_template} />
              </span>
              <span className="text-xs text-gray-400 shrink-0">{formatDate(t.updated_at)}</span>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-gray-600 hover:text-emerald-600"
                  onClick={() => openTestModal(t.notification_type)}
                  title="Send test push"
                >
                  <Play className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(t)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(t.notification_type)}
                  disabled={deletingType === t.notification_type}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {templates.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center border border-gray-200 rounded-lg border-dashed">
            No templates. Run the migration to seed defaults.
          </p>
        )}
      </section>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-md gap-3 p-4">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-sm font-semibold">{editing?.notification_type}</DialogTitle>
          </DialogHeader>
          {editing && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Title</Label>
                <TemplateInput
                  id="edit-title"
                  value={titleTemplate}
                  onChange={setTitleTemplate}
                  placeholder="Title template"
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Body</Label>
                <TemplateInput
                  id="edit-body"
                  value={bodyTemplate}
                  onChange={setBodyTemplate}
                  placeholder="Body template"
                  className="text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>
                  Insert in title:{' '}
                  {placeholders.map((p) => (
                    <button
                      key={`t-${p}`}
                      type="button"
                      onClick={() => insertPlaceholder(p, 'title')}
                      className="mr-1 font-mono text-emerald-600 hover:underline"
                    >
                      {`{${p}}`}
                    </button>
                  ))}
                </span>
                <span>
                  Insert in body:{' '}
                  {placeholders.map((p) => (
                    <button
                      key={`b-${p}`}
                      type="button"
                      onClick={() => insertPlaceholder(p, 'body')}
                      className="mr-1 font-mono text-emerald-600 hover:underline"
                    >
                      {`{${p}}`}
                    </button>
                  ))}
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Preview: <strong>{previewText(titleTemplate)}</strong> — {previewText(bodyTemplate)}
              </p>
            </>
          )}
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={closeEdit} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send test modal (opened from row play icon) */}
      <Dialog open={testModalType !== null} onOpenChange={(open) => !open && setTestModalType(null)}>
        <DialogContent className="max-w-sm gap-4 p-4">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-sm font-semibold">
              Send test push — {testModalType}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">User</Label>
              <Select
                value={modalTestUserId}
                onValueChange={setModalTestUserId}
                onOpenChange={(open) => open && testUsers.length === 0 && loadTestUsers()}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {testUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email || u.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setTestModalType(null)} disabled={sendingTest}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSendTestFromModal}
              disabled={sendingTest || !modalTestUserId}
            >
              <Send className="h-3.5 w-3.5" />
              {sendingTest ? 'Sending...' : 'Send test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
