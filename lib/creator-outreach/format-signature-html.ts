const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

function tagName(line: string): string | null {
  const match = line.match(/^<\/?\s*([a-z][a-z0-9]*)\b/i)
  return match?.[1]?.toLowerCase() ?? null
}

function isClosingTag(line: string): boolean {
  return /^<\//.test(line)
}

function isOpeningTag(line: string): boolean {
  return /^<[^/!?]/.test(line) && !isSelfClosingTag(line)
}

function isSelfClosingTag(line: string): boolean {
  return /\/>$/.test(line) || (tagName(line) !== null && VOID_TAGS.has(tagName(line)!))
}

/**
 * Pretty-print compact signature HTML (e.g. one line from Missive) for editing.
 */
export function formatSignatureHtmlForEditing(html: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ''

  const normalized = trimmed.replace(/>\s+</g, '><')
  const rawLines = normalized.replace(/></g, '>\n<').split('\n')

  let depth = 0
  const lines: string[] = []

  for (const raw of rawLines) {
    const line = raw.trim()
    if (!line) continue

    if (isClosingTag(line)) {
      depth = Math.max(0, depth - 1)
    }

    lines.push(`${'  '.repeat(depth)}${line}`)

    if (isOpeningTag(line)) {
      const name = tagName(line)
      if (name && !VOID_TAGS.has(name) && !line.includes('</')) {
        depth += 1
      }
    }
  }

  return lines.join('\n')
}
