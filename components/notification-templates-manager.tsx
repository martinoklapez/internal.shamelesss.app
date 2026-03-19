'use client'

import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/date'
import {
  type NotificationContentTemplate,
  NOTIFICATION_PLACEHOLDERS,
  PLACEHOLDERS_BY_TYPE,
  TEST_PUSH_CONTEXT_USER_LABEL,
  notificationTestNeedsContextUser,
} from '@/lib/notification-content-templates'
import { Pencil, Trash2, Send, Play, ChevronsUpDown, Check } from 'lucide-react'

type TestPushUser = {
  id: string
  name: string | null
  username: string | null
  profile_picture_url: string | null
  email: string | null
}

function TestUserCombobox({
  label,
  labelHint,
  users,
  value,
  onChange,
  open,
  onOpenChange,
  emptyLabel = 'Search or select user…',
}: {
  label: string
  labelHint?: string
  users: TestPushUser[]
  value: string
  onChange: (id: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  emptyLabel?: string
}) {
  const selected = users.find((x) => x.id === value)
  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        <Label className="text-xs">{label}</Label>
        {labelHint ? (
          <p className="text-[11px] text-gray-500 leading-snug">{labelHint}</p>
        ) : null}
      </div>
      <Popover modal={false} open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-auto min-h-9 w-full justify-between px-2 py-1.5 font-normal"
          >
            {value && selected ? (
              <UserRow u={selected} size="sm" />
            ) : value && !selected ? (
              <UserRow
                u={{
                  id: value,
                  name: null,
                  username: null,
                  profile_picture_url: null,
                  email: null,
                }}
                size="sm"
              />
            ) : (
              <span className="text-sm text-gray-500">{emptyLabel}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[200] w-[min(100vw-2rem,var(--radix-popover-trigger-width,100%))] border border-gray-200 bg-white p-0 shadow-lg"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command
            className="bg-white opacity-100"
            filter={(val, search, keywords) => {
              const q = search.trim().toLowerCase()
              if (!q) return 1
              const hay = [val, ...(keywords ?? [])].join(' ').toLowerCase()
              return hay.includes(q) ? 1 : 0
            }}
          >
            <CommandInput placeholder="Search by name, @username, email…" className="h-9" />
            <CommandList className="bg-white opacity-100 text-gray-900">
              <CommandEmpty>No user found.</CommandEmpty>
              {users.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.id}
                  keywords={
                    [
                      u.name ?? '',
                      u.username ? `@${u.username}` : '',
                      u.email ?? '',
                    ].filter(Boolean) as string[]
                  }
                  onSelect={(id) => {
                    onChange(id)
                    onOpenChange(false)
                  }}
                  className="relative cursor-pointer py-2 pr-8 opacity-100 data-[disabled]:opacity-100"
                >
                  <UserRow u={u} />
                  {value === u.id ? (
                    <Check className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function UserRow({ u, size = 'md' }: { u: TestPushUser; size?: 'sm' | 'md' }) {
  const avatarClass = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'
  const initial = (u.name || u.username || u.email || 'U').charAt(0).toUpperCase()
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Avatar className={avatarClass}>
        {u.profile_picture_url ? (
          <AvatarImage src={u.profile_picture_url} alt={u.name || u.username || 'User'} />
        ) : null}
        <AvatarFallback className="text-xs">{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium text-gray-900">{u.name || '—'}</div>
        <div className="truncate text-xs text-gray-500">
          {u.username ? `@${u.username}` : u.email || u.id.slice(0, 8)}
        </div>
      </div>
    </div>
  )
}

const KNOWN_PLACEHOLDERS = new Set(Object.keys(NOTIFICATION_PLACEHOLDERS))

/** Renders template text with placeholders as badges (known = solid, unknown = lighter tint) */
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
                ? 'bg-[#ff5252] text-black border-0 text-[10px] px-1.5 py-0 font-mono'
                : 'bg-[#ff5252]/15 text-black border-0 text-[10px] px-1.5 py-0 font-mono'
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

  const [testUsers, setTestUsers] = useState<TestPushUser[]>([])
  const [testRecipientPickerOpen, setTestRecipientPickerOpen] = useState(false)
  const [testContextPickerOpen, setTestContextPickerOpen] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  const [testModalType, setTestModalType] = useState<string | null>(null)
  /** User who receives the test push */
  const [modalTestUserId, setModalTestUserId] = useState<string>('')
  /** Other party for template placeholders (sender, accepter, etc.) */
  const [modalContextUserId, setModalContextUserId] = useState<string>('')
  /** Custom message body for message test pushes */
  const [testMessagePreview, setTestMessagePreview] = useState('Hey, want to grab coffee tomorrow?')
  /** Inline status shown in test modal after send */
  const [testSendStatus, setTestSendStatus] = useState<{
    text: string
    tone: 'success' | 'warning'
  } | null>(null)
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
      setTestUsers(
        data.users.map((u: TestPushUser) => ({
          ...u,
          username: u.username ?? null,
        }))
      )
    }
  }

  const applyInitialTestUsers = (users: TestPushUser[]) => {
    if (!users.length) {
      setModalTestUserId('')
      setModalContextUserId('')
      return
    }
    setModalTestUserId(users[0].id)
    const other = users.find((u) => u.id !== users[0].id)
    setModalContextUserId(other?.id ?? '')
  }

  const openTestModal = (notificationType: string) => {
    setTestModalType(notificationType)
    setTestMessagePreview('Hey, want to grab coffee tomorrow?')
    setTestSendStatus(null)
    if (testUsers.length > 0) {
      applyInitialTestUsers(testUsers)
    } else {
      fetch('/api/users/list')
        .then((res) => res.json())
        .then((data) => {
          if (data.users?.length) {
            const mapped = data.users.map((u: TestPushUser) => ({
              ...u,
              username: u.username ?? null,
            }))
            setTestUsers(mapped)
            applyInitialTestUsers(mapped)
          }
        })
    }
  }

  const handleSendTestFromModal = async () => {
    if (!testModalType || !modalTestUserId) {
      alert('Select who receives the push.')
      return
    }
    const needsContext = notificationTestNeedsContextUser(testModalType)
    if (needsContext) {
      if (!modalContextUserId) {
        alert('This template uses placeholders — select the other user (sender / context).')
        return
      }
      if (modalContextUserId === modalTestUserId) {
        alert('Choose two different users: one receives the push, the other fills sender/name placeholders.')
        return
      }
    }
    setSendingTest(true)
    setTestSendStatus(null)
    try {
      const payload: {
        user_id: string
        notification_type: string
        context_user_id?: string
        test_message_preview?: string
      } = {
        user_id: modalTestUserId,
        notification_type: testModalType,
      }
      if (needsContext) payload.context_user_id = modalContextUserId
      if (testModalType === 'message') {
        payload.test_message_preview =
          testMessagePreview.trim() || 'Hey, want to grab coffee tomorrow?'
      }

      const res = await fetch('/api/notification-templates/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        const parts = [data.error, data.details, data.hint, data.code ? `(${data.code})` : '']
        if (data.debug && typeof data.debug === 'object') {
          parts.push(`tried: ${JSON.stringify(data.debug)}`)
        }
        throw new Error(parts.filter(Boolean).join('\n') || 'Failed to send test')
      }
      const pushFailed = data.push_delivery_failed === true
      const pushDetail =
        typeof data.push_failure_message === 'string' ? data.push_failure_message.trim() : ''

      let text: string
      if (pushFailed) {
        text = pushDetail
          ? `Job queued. ${pushDetail}`
          : [data.message, data.warning].filter(Boolean).join(' ') ||
            'Job queued; push could not be delivered.'
      } else {
        text = [data.message, data.warning].filter(Boolean).join(' ') || 'Test push queued.'
      }

      setTestSendStatus({
        text,
        tone: pushFailed ? 'warning' : 'success',
      })
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
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-x-auto">
          {templates.map((t) => (
            <div
              key={t.notification_type}
              className="flex flex-wrap items-center gap-x-6 sm:gap-x-10 gap-y-2 px-3 sm:px-4 py-2.5 hover:bg-gray-50/80 min-w-0"
            >
              <span className="font-mono text-sm text-gray-900 w-44 sm:w-52 shrink-0 pr-2">
                {t.notification_type}
              </span>
              <span className="text-sm text-gray-700 min-w-0 flex-1 pl-1">
                <TemplateWithBadges text={t.title_template} /> — <TemplateWithBadges text={t.body_template} />
              </span>
              <span className="text-xs text-gray-400 shrink-0">{formatDate(t.updated_at)}</span>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-gray-600 hover:text-[#ff5252]"
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
                <Input
                  id="edit-title"
                  value={titleTemplate}
                  onChange={(e) => setTitleTemplate(e.target.value)}
                  placeholder="Title template"
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Body</Label>
                <Textarea
                  id="edit-body"
                  value={bodyTemplate}
                  onChange={(e) => setBodyTemplate(e.target.value)}
                  placeholder="Body template"
                  className="min-h-[100px] text-sm font-mono"
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
                      className="mr-1 font-mono text-[#ff5252] hover:underline"
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
                      className="mr-1 font-mono text-[#ff5252] hover:underline"
                    >
                      {`{${p}}`}
                    </button>
                  ))}
                </span>
              </div>
              <div className="text-xs text-gray-400 space-y-1">
                <div>
                  <span className="text-gray-500">Preview (title):</span>{' '}
                  <TemplateWithBadges text={titleTemplate} />
                </div>
                <div>
                  <span className="text-gray-500">Preview (body):</span>{' '}
                  <TemplateWithBadges text={bodyTemplate} />
                </div>
              </div>
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
      <Dialog
        open={testModalType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTestModalType(null)
            setTestRecipientPickerOpen(false)
            setTestContextPickerOpen(false)
            setModalContextUserId('')
            setTestMessagePreview('Hey, want to grab coffee tomorrow?')
            setTestSendStatus(null)
          }
        }}
      >
        <DialogContent
          className="max-w-md gap-4 p-4"
          onPointerDownOutside={(e) => {
            // Popover + cmdk render in a portal; without this, Dialog treats list clicks as “outside”.
            const t = e.target as HTMLElement
            if (
              t.closest('[data-radix-popper-content-wrapper]') ||
              t.closest('[data-radix-popover-content]') ||
              t.closest('[cmdk-root]') ||
              t.closest('[role="listbox"]')
            ) {
              e.preventDefault()
            }
          }}
          onInteractOutside={(e) => {
            const t = e.target as HTMLElement
            if (
              t.closest('[data-radix-popper-content-wrapper]') ||
              t.closest('[data-radix-popover-content]') ||
              t.closest('[cmdk-root]') ||
              t.closest('[role="listbox"]')
            ) {
              e.preventDefault()
            }
          }}
        >
          <div className="flex flex-col gap-4">
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-sm font-semibold">
                Send test push — {testModalType}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <TestUserCombobox
                label="Recipient"
                labelHint="Gets the test push on their device."
                users={testUsers}
                value={modalTestUserId}
                onChange={setModalTestUserId}
                open={testRecipientPickerOpen}
                onOpenChange={(o) => {
                  setTestRecipientPickerOpen(o)
                  if (o && testUsers.length === 0) void loadTestUsers()
                }}
              />
              {testModalType != null && notificationTestNeedsContextUser(testModalType) ? (
                <>
                  <TestUserCombobox
                    label="Context user"
                    labelHint={
                      TEST_PUSH_CONTEXT_USER_LABEL[testModalType] ??
                      'Used to fill template placeholders (name, etc.). Must be someone other than the recipient.'
                    }
                    users={testUsers}
                    value={modalContextUserId}
                    onChange={setModalContextUserId}
                    open={testContextPickerOpen}
                    onOpenChange={(o) => {
                      setTestContextPickerOpen(o)
                      if (o && testUsers.length === 0) void loadTestUsers()
                    }}
                  />
                  {testUsers.length < 2 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5">
                      You need at least two users in the database to test this template with real names.
                    </p>
                  ) : null}
                </>
              ) : null}
              {testModalType === 'message' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Test message text</Label>
                  <Textarea
                    value={testMessagePreview}
                    onChange={(e) => setTestMessagePreview(e.target.value)}
                    placeholder="Hey, want to grab coffee tomorrow?"
                    className="min-h-[76px] text-sm"
                  />
                  <p className="text-[11px] text-gray-500">
                    Used for the push body and placeholder <code>{'{message_preview}'}</code>.
                  </p>
                </div>
              ) : null}
            </div>
            <DialogFooter className="gap-2 pt-2">
              {testSendStatus ? (
                <p
                  className={cn(
                    'mr-auto text-xs rounded-md px-2 py-1.5 border',
                    testSendStatus.tone === 'warning'
                      ? 'text-amber-900 bg-amber-50 border-amber-200'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  )}
                >
                  {testSendStatus.text}
                </p>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setTestModalType(null)} disabled={sendingTest}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSendTestFromModal}
                disabled={
                  sendingTest ||
                  !modalTestUserId ||
                  (testModalType != null &&
                    notificationTestNeedsContextUser(testModalType) &&
                    (!modalContextUserId ||
                      modalContextUserId === modalTestUserId ||
                      testUsers.length < 2))
                }
              >
                <Send className="h-3.5 w-3.5" />
                {sendingTest ? 'Sending...' : 'Send test'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
