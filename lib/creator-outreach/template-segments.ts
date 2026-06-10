export type TemplateTextSegment =
  | { type: 'text'; value: string }
  | { type: 'placeholder'; key: string }

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g

const INLINE_FORMAT_TAGS = new Set(['B', 'STRONG', 'I', 'EM'])
const BLOCK_TAGS = new Set(['DIV', 'P'])

/**
 * Strip unsupported tags; keep bold/italic. Works in browser and Node (Missive send).
 */
export function sanitizeTemplateInlineHtml(html: string): string {
  if (!html || !/<[a-z]/i.test(html)) return html

  let out = html.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<\s*(strong|b)\s*>/gi, '<strong>')
  out = out.replace(/<\s*\/\s*(strong|b)\s*>/gi, '</strong>')
  out = out.replace(/<\s*(em|i)\s*>/gi, '<em>')
  out = out.replace(/<\s*\/\s*(em|i)\s*>/gi, '</em>')
  out = out.replace(/<(?!\/?(strong|em)\b)[^>]*>/gi, '')

  return out
}

function serializeInlineElement(element: HTMLElement): string {
  const tag = element.tagName
  const inner = serializeTemplateEditorNodes(element, false)
  if (tag === 'STRONG' || tag === 'B') return `<strong>${inner}</strong>`
  if (tag === 'EM' || tag === 'I') return `<em>${inner}</em>`
  return inner
}

function appendPlainTextWithBreaks(container: HTMLElement, text: string): void {
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    if (line) container.appendChild(document.createTextNode(line))
    if (index < lines.length - 1) {
      container.appendChild(document.createElement('br'))
    }
  })
}

function appendTemplateTextSegment(container: HTMLElement, text: string): void {
  if (!text) return

  if (!/<[a-z]/i.test(text)) {
    appendPlainTextWithBreaks(container, text)
    return
  }

  const wrapper = document.createElement('span')
  wrapper.innerHTML = sanitizeTemplateInlineHtml(text)
  while (wrapper.firstChild) {
    container.appendChild(wrapper.firstChild)
  }
}

function serializeBlockElement(element: HTMLElement): string {
  const children = Array.from(element.childNodes)
  if (
    children.length === 1 &&
    children[0].nodeType === Node.ELEMENT_NODE &&
    (children[0] as HTMLElement).tagName === 'BR'
  ) {
    return ''
  }
  return serializeTemplateEditorNodes(element, false)
}

export function parseTemplateSegments(text: string): TemplateTextSegment[] {
  const segments: TemplateTextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  PLACEHOLDER_RE.lastIndex = 0
  while ((match = PLACEHOLDER_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'placeholder', key: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

export function nodePlainLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.length ?? 0
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return 0
  }

  const element = node as HTMLElement
  if (element.dataset.token) {
    return `{{${element.dataset.token}}}`.length
  }

  if (element.tagName === 'BR') {
    return 1
  }

  let length = 0
  for (const child of Array.from(element.childNodes)) {
    length += nodePlainLength(child)
  }
  return length
}

export function serializeTemplateEditor(container: HTMLElement): string {
  return serializeTemplateEditorNodes(container, true)
}

function serializeTemplateEditorNodes(container: HTMLElement, isRoot: boolean): string {
  const nodes = Array.from(container.childNodes)
  let result = ''

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? ''
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const element = node as HTMLElement
    if (element.dataset.token) {
      result += `{{${element.dataset.token}}}`
    } else if (element.tagName === 'BR') {
      result += '\n'
    } else if (INLINE_FORMAT_TAGS.has(element.tagName)) {
      result += serializeInlineElement(element)
    } else if (BLOCK_TAGS.has(element.tagName)) {
      result += serializeBlockElement(element)
    } else {
      result += serializeTemplateEditorNodes(element, false)
    }

    if (isRoot && i < nodes.length - 1 && BLOCK_TAGS.has(element.tagName)) {
      result += '\n'
    }
  }

  return result
}

export function getTemplateEditorCursorOffset(container: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return serializeTemplateEditor(container).length
  }

  const range = selection.getRangeAt(0)
  if (!container.contains(range.startContainer)) {
    return serializeTemplateEditor(container).length
  }

  let offset = 0
  let found = false

  const walk = (node: Node): void => {
    if (found) return

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.startOffset
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const children = Array.from(node.childNodes)
        for (let index = 0; index < range.startOffset; index += 1) {
          offset += nodePlainLength(children[index])
        }
      }
      found = true
      return
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0
      return
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement
      if (element.dataset.token) {
        offset += `{{${element.dataset.token}}}`.length
        return
      }
      if (element.tagName === 'BR') {
        offset += 1
        return
      }
      for (const child of Array.from(node.childNodes)) {
        walk(child)
        if (found) return
      }
    }
  }

  for (const child of Array.from(container.childNodes)) {
    walk(child)
    if (found) break
  }

  return offset
}

function resolveCursorNode(
  container: HTMLElement,
  targetOffset: number
): { node: Node; offset: number } | 'end' {
  let remaining = targetOffset

  for (const node of Array.from(container.childNodes)) {
    if (remaining === 0) {
      return { node: container, offset: Array.from(container.childNodes).indexOf(node) }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length ?? 0
      if (remaining <= length) {
        return { node, offset: remaining }
      }
      remaining -= length
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const element = node as HTMLElement
    if (element.dataset.token) {
      const length = `{{${element.dataset.token}}}`.length
      if (remaining <= length) {
        if (remaining === 0) {
          return { node: container, offset: Array.from(container.childNodes).indexOf(element) }
        }
        return { node: container, offset: Array.from(container.childNodes).indexOf(element) + 1 }
      }
      remaining -= length
      continue
    }

    if (element.tagName === 'BR') {
      if (remaining <= 1) {
        return { node: container, offset: Array.from(container.childNodes).indexOf(element) + 1 }
      }
      remaining -= 1
      continue
    }

    if (BLOCK_TAGS.has(element.tagName)) {
      const length = nodePlainLength(element)
      if (remaining < length) {
        const nested = resolveCursorNode(element, remaining)
        if (nested !== 'end') return nested
      }
      if (remaining <= length) {
        return {
          node: container,
          offset: Array.from(container.childNodes).indexOf(element) + 1,
        }
      }
      remaining -= length
      const nodeIndex = Array.from(container.childNodes).indexOf(element)
      if (nodeIndex < Array.from(container.childNodes).length - 1) {
        if (remaining === 0) {
          return { node: container, offset: nodeIndex + 1 }
        }
        remaining -= 1
      }
      continue
    }

    const length = nodePlainLength(element)
    if (remaining < length) {
      const nested = resolveCursorNode(element, remaining)
      if (nested !== 'end') return nested
    }
    if (remaining <= length) {
      return {
        node: container,
        offset: Array.from(container.childNodes).indexOf(element) + 1,
      }
    }
    remaining -= length
  }

  if (remaining === 0) {
    return 'end'
  }

  return 'end'
}

export function setTemplateEditorCursorOffset(container: HTMLElement, targetOffset: number): void {
  const selection = window.getSelection()
  if (!selection) return

  const resolved = resolveCursorNode(container, targetOffset)
  const range = document.createRange()

  if (resolved === 'end') {
    range.selectNodeContents(container)
    range.collapse(false)
  } else if (resolved.node.nodeType === Node.TEXT_NODE) {
    range.setStart(resolved.node, resolved.offset)
    range.collapse(true)
  } else {
    range.setStart(resolved.node, Math.min(resolved.offset, resolved.node.childNodes.length))
    range.collapse(true)
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

export const TEMPLATE_VARIABLE_BADGE_CLASS =
  'mx-0.5 inline-flex align-baseline rounded-md border-0 bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-700'

export function renderTemplateEditorContent(container: HTMLElement, text: string): void {
  container.innerHTML = ''

  if (!text) {
    return
  }

  for (const segment of parseTemplateSegments(text)) {
    if (segment.type === 'text') {
      appendTemplateTextSegment(container, segment.value)
      continue
    }

    const badge = document.createElement('span')
    badge.contentEditable = 'false'
    badge.dataset.token = segment.key
    badge.className = TEMPLATE_VARIABLE_BADGE_CLASS
    badge.textContent = `{{${segment.key}}}`
    container.appendChild(badge)
  }
}
