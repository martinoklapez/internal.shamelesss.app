import { sanitizeTemplateInlineHtml } from '@/lib/creator-outreach/template-segments'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraphInnerHtml(paragraph: string): string {
  if (!paragraph) return '<br>'
  if (/<[a-z]/i.test(paragraph)) {
    return sanitizeTemplateInlineHtml(paragraph).replace(/\n/g, '<br>')
  }
  return escapeHtml(paragraph).replace(/\n/g, '<br>')
}

/**
 * Plain text (optional inline <strong>/<em>) + line breaks → Missive-friendly HTML.
 */
export function outreachPlainTextToEmailHtml(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return '<div><br></div>'

  return trimmed
    .split(/\n\n+/)
    .map((paragraph) => `<div>${paragraphInnerHtml(paragraph.trim())}</div>`)
    .join('<div><br></div>')
}
