/**
 * Untappd check-in comments can embed inline HTML — most commonly an @-mention
 * anchor like `<a href="/user/smbar2001">Mike B.</a>`. Reviews are shown as plain
 * text, so strip tags but keep their inner text ("Thanks <a ...>Mike B.</a> for the ⛽"
 * → "Thanks Mike B. for the ⛽") and decode the handful of entities Untappd emits.
 * ponytail: regex strip, not a full HTML parser — fine because the source markup is
 * machine-generated and well-formed; swap in a parser only if arbitrary HTML appears.
 */
export function stripReviewHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim()
}
