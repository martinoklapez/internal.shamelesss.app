'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  TemplateVariableTextarea,
  type TemplateVariableTextareaHandle,
} from '@/components/template-variable-textarea'
import { CalBookingWidget } from '@/components/cal-booking-widget'
import { BOOK_MEETING_TOKEN, type CalBookingMeetingDetails } from '@/lib/creator-outreach/cal-booking'
import {
  OUTREACH_TEMPLATE_PLACEHOLDERS,
} from '@/lib/creator-outreach/template-placeholders'
import {
  parseTemplateSegments,
  sanitizeTemplateInlineHtml,
  TEMPLATE_VARIABLE_BADGE_CLASS,
} from '@/lib/creator-outreach/template-segments'
import type { EmailTemplate } from '@/lib/creator-outreach/types'
import { cn } from '@/lib/utils'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'

export type EmailTemplateDraft = {
  id: string
  name: string
  subject: string
  bodyPreview: string
  isDefault: boolean
  isNew?: boolean
}

function draftFromTemplate(template: EmailTemplate): EmailTemplateDraft {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    bodyPreview: template.bodyPreview,
    isDefault: template.isDefault,
  }
}

function TemplateFormattedText({ text }: { text: string }) {
  if (!/<[a-z]/i.test(text)) {
    return <span>{text}</span>
  }
  return (
    <span dangerouslySetInnerHTML={{ __html: sanitizeTemplateInlineHtml(text) }} />
  )
}

function TemplateWithBadges({ text, className }: { text: string; className?: string }) {
  const parts = parseTemplateSegments(text)

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.type === 'text' ? (
          <TemplateFormattedText key={index} text={part.value} />
        ) : (
          <Badge key={index} variant="secondary" className={TEMPLATE_VARIABLE_BADGE_CLASS}>
            {`{{${part.key}}}`}
          </Badge>
        )
      )}
    </span>
  )
}

function TemplateBodyPreview({
  text,
  bookingDetails,
}: {
  text: string
  bookingDetails?: Partial<CalBookingMeetingDetails>
}) {
  const parts = text.split(BOOK_MEETING_TOKEN)

  return (
    <div className="space-y-3">
      {parts.map((part, index) => (
        <div key={index} className="space-y-3">
          {part ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              <TemplateWithBadges text={part} />
            </p>
          ) : null}
          {index < parts.length - 1 ? (
            <CalBookingWidget details={bookingDetails} />
          ) : null}
        </div>
      ))}
    </div>
  )
}

function draftsEqual(a: EmailTemplateDraft, b: EmailTemplateDraft): boolean {
  return (
    a.name === b.name &&
    a.subject === b.subject &&
    a.bodyPreview === b.bodyPreview &&
    a.isDefault === b.isDefault
  )
}

type CreatorOutreachTemplatesBuilderProps = {
  templates: EmailTemplate[]
  selectedId: string | null
  draft: EmailTemplateDraft | null
  dirty: boolean
  saving: boolean
  deleting: boolean
  bookingDetails?: Partial<CalBookingMeetingDetails>
  onSelect: (id: string) => void
  onDraftChange: (patch: Partial<EmailTemplateDraft>) => void
  onCreate: () => void
  onSave: () => void
  onReset?: () => void
  onDelete: () => void
}

export function buildEmailTemplateDrafts(
  templates: EmailTemplate[]
): Record<string, EmailTemplateDraft> {
  return Object.fromEntries(templates.map((template) => [template.id, draftFromTemplate(template)]))
}

export function createEmptyEmailTemplateDraft(): EmailTemplateDraft {
  return {
    id: crypto.randomUUID(),
    name: 'Untitled template',
    subject: 'Collaboration idea for {{creator_name}}',
    bodyPreview:
      'Hi {{contact_name}},\n\nWe love your content on {{platform}} (@{{handle}}). We built Shamelesss and think your audience would resonate with what we are building.\n\nWould you be open to a quick chat this week?\n\n{{book_meeting}}\n\nBest,\nShamelesss',
    isDefault: false,
    isNew: true,
  }
}

export function emailTemplateDraftEqual(
  draft: EmailTemplateDraft | null,
  baseline: EmailTemplateDraft | null
): boolean {
  if (!draft || !baseline) return draft === baseline
  return draftsEqual(draft, baseline)
}

export function CreatorOutreachTemplatesBuilder({
  templates,
  selectedId,
  draft,
  dirty,
  saving,
  deleting,
  onSelect,
  onDraftChange,
  onCreate,
  onSave,
  onReset,
  onDelete,
  bookingDetails,
}: CreatorOutreachTemplatesBuilderProps) {
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<TemplateVariableTextareaHandle>(null)
  const [variablesOpen, setVariablesOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview')

  useEffect(() => {
    setActiveTab('preview')
    setVariablesOpen(false)
  }, [draft?.id])

  const insertPlaceholder = (key: string, target: 'subject' | 'body') => {
    const token = `{{${key}}}`
    if (target === 'subject') {
      const input = subjectRef.current
      if (input) {
        const start = input.selectionStart ?? draft?.subject.length ?? 0
        const end = input.selectionEnd ?? start
        const next = `${draft?.subject.slice(0, start) ?? ''}${token}${draft?.subject.slice(end) ?? ''}`
        onDraftChange({ subject: next })
        requestAnimationFrame(() => {
          input.focus()
          const pos = start + token.length
          input.setSelectionRange(pos, pos)
        })
        return
      }
      onDraftChange({ subject: `${draft?.subject ?? ''}${token}` })
      return
    }

    const bodyEditor = bodyRef.current
    if (bodyEditor) {
      bodyEditor.insertAtCursor(token)
      return
    }
    onDraftChange({ bodyPreview: `${draft?.bodyPreview ?? ''}${token}` })
  }

  return (
    <div className="flex min-h-[32rem] flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:w-64">
        <div className="rounded-xl border border-gray-200/90 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">Templates</p>
            <Button variant="outline" size="sm" className="h-8 px-2" onClick={onCreate}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          </div>
          <ul className="divide-y divide-gray-100">
            {templates.map((template) => {
              const selected = template.id === selectedId
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(template.id)}
                    className={cn(
                      'w-full px-4 py-3 text-left transition-colors',
                      selected ? 'bg-gray-50' : 'hover:bg-gray-50/70'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-900">
                        {template.name}
                      </span>
                      {template.isDefault ? (
                        <span className="shrink-0 text-[10px] uppercase text-gray-400">default</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-gray-500">{template.subject}</p>
                  </button>
                </li>
              )
            })}
          </ul>
          {templates.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              No templates yet. Create one to get started.
            </p>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {!draft ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-6 py-16 text-center text-sm text-gray-500">
            Select a template or create a new one.
          </div>
        ) : (
          <article className="rounded-xl border border-gray-200/90 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-gray-900">Edit template</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Used by outreach rules when a contact gets a new email.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="template-default" className="text-xs text-gray-500">
                  Default template
                </Label>
                <Switch
                  id="template-default"
                  checked={draft.isDefault}
                  onCheckedChange={(isDefault) => onDraftChange({ isDefault })}
                />
              </div>
            </div>

            <div className="mt-6">
              <div
                className="flex gap-5 border-b border-gray-100"
                role="tablist"
                aria-label="Template sections"
              >
                {(
                  [
                    ['edit', 'Template editing'],
                    ['preview', 'Preview'],
                  ] as const
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      '-mb-px border-b-2 pb-2.5 text-xs font-medium transition-colors',
                      activeTab === tab
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'edit' ? (
                <div role="tabpanel" className="space-y-5 pt-5">
                <div className="space-y-2">
                  <Label htmlFor="template-name" className="text-xs">
                    Name
                  </Label>
                  <Input
                    id="template-name"
                    value={draft.name}
                    onChange={(event) => onDraftChange({ name: event.target.value })}
                    placeholder="Partnership intro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-subject" className="text-xs">
                    Subject
                  </Label>
                  <Input
                    id="template-subject"
                    ref={subjectRef}
                    value={draft.subject}
                    onChange={(event) => onDraftChange({ subject: event.target.value })}
                    placeholder="Collaboration idea for {{creator_name}}"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-body" className="text-xs">
                    Body
                  </Label>
                  <TemplateVariableTextarea
                    key={draft.id}
                    id="template-body"
                    ref={bodyRef}
                    value={draft.bodyPreview}
                    onChange={(bodyPreview) => onDraftChange({ bodyPreview })}
                    placeholder="Hi {{contact_name}}, ..."
                  />
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50/70">
                  <button
                    type="button"
                    onClick={() => setVariablesOpen((open) => !open)}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left"
                    aria-expanded={variablesOpen}
                  >
                    <ChevronRight
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform',
                        variablesOpen && 'rotate-90'
                      )}
                    />
                    <span className="text-xs font-medium text-gray-700">Variables</span>
                    <span className="text-xs text-gray-400">
                      creator_name, contact_name, platform, handle, book_meeting
                    </span>
                  </button>
                  {variablesOpen ? (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                      <p className="text-xs text-gray-500">
                        Click to insert at the cursor. These are replaced when the email is sent.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {OUTREACH_TEMPLATE_PLACEHOLDERS.map((placeholder) =>
                          placeholder.kind === 'widget' ? (
                            <Button
                              key={placeholder.key}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs font-mono"
                              onClick={() => insertPlaceholder(placeholder.key, 'body')}
                            >
                              Body · {`{{${placeholder.key}}}`}
                            </Button>
                          ) : (
                            <div key={placeholder.key} className="flex flex-wrap items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs font-mono"
                                onClick={() => insertPlaceholder(placeholder.key, 'subject')}
                              >
                                Subject · {`{{${placeholder.key}}}`}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs font-mono"
                                onClick={() => insertPlaceholder(placeholder.key, 'body')}
                              >
                                Body · {`{{${placeholder.key}}}`}
                              </Button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              ) : (
                <div role="tabpanel" className="space-y-5 pt-5">
                  <p className="text-xs text-gray-500">
                    Variables are filled in with contact data when the email is sent.
                  </p>
                  <div className="rounded-lg border border-gray-100 bg-gray-50/40 p-4">
                    <p className="text-xs text-gray-500">Subject</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      <TemplateWithBadges text={draft.subject} />
                    </p>
                    <p className="mt-5 text-xs text-gray-500">Body</p>
                    <div className="mt-1">
                      <TemplateBodyPreview text={draft.bodyPreview} bookingDetails={bookingDetails} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
              <Button disabled={!dirty || saving} onClick={onSave}>
                {saving ? 'Saving…' : draft.isNew ? 'Create template' : 'Save template'}
              </Button>
              {dirty && onReset ? (
                <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
                  Reset
                </Button>
              ) : null}
              {!draft.isNew ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={onDelete}
                  disabled={deleting || saving}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
              ) : null}
            </div>
          </article>
        )}
      </div>
    </div>
  )
}
