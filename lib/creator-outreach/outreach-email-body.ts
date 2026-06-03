/** Spacing between template body and signature (Missive-style). */
const BODY_SIGNATURE_SEPARATOR = '<div><br></div>'

/**
 * Append a sender signature after the outreach body HTML.
 * Signature is trusted HTML from Pipeline → Signatures (Missive export).
 */
export function appendOutreachSignatureHtml(
  bodyHtml: string,
  signatureHtml?: string | null
): string {
  const body = bodyHtml.trim()
  const signature = signatureHtml?.trim()
  if (!signature) return body || '<div><br></div>'
  if (!body) return signature
  return `${body}${BODY_SIGNATURE_SEPARATOR}${signature}`
}
