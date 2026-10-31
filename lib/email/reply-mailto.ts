/**
 * mailto: links for the admin "Email ..." reply buttons (donation requests,
 * event inquiries, job applications). Each opens the staff member's own email
 * app, so the thread lives in their inbox, with the submitter's address and a
 * plain-text summary filled in. Nothing is sent from the site.
 */

/** ponytail: free text clipped to keep the link short; some email apps drop bodies near 2,000 characters. */
const MAX_DETAILS = 500

/**
 * Stricter than the public forms' email check, which lets `? & = % #` through:
 * in a mailto: address those would add fields such as `?cc=` to the staff reply.
 */
const SAFE_ADDRESS = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

/** Shortens submitter free text for a mailto: body; the full text stays in Admin. */
export function clipDetails(text: string): string {
  return text.length > MAX_DETAILS ? `${text.slice(0, MAX_DETAILS)}…` : text
}

/** Null when `to` is missing or not safe to put in a mailto: link. */
export function replyMailto({
  to,
  subject,
  body,
}: {
  to: string | null | undefined
  subject: string
  body: string
}): string | null {
  if (!to || !SAFE_ADDRESS.test(to)) return null
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
