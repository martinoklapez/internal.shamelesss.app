const GMAIL_MAIL_SIG_PATTERN =
  /^https:\/\/ci\d+\.googleusercontent\.com\/mail-sig\//i

/** Gmail mail-sig image URLs only load with a Gmail referer — rewrite for in-app preview. */
export function signatureHtmlForPreview(html: string): string {
  return html.replace(
    /\bsrc=(["'])(https:\/\/ci\d+\.googleusercontent\.com\/mail-sig\/[^"']+)\1/gi,
    (_match, quote: string, src: string) => {
      if (!GMAIL_MAIL_SIG_PATTERN.test(src)) return _match
      const proxy = `/api/creator-pipeline/signature-image-preview?url=${encodeURIComponent(src)}`
      return `src=${quote}${proxy}${quote}`
    }
  )
}
