export type TemplateTextSegment =
  | { type: 'text'; value: string }
  | { type: 'placeholder'; key: string }

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g

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
  let result = ''

  for (const node of Array.from(container.childNodes)) {
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
    } else {
      result += serializeTemplateEditor(element)
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
    }
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
      container.appendChild(document.createTextNode(segment.value))
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
