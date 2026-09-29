/**
 * CMS-editable paragraph under a hub page's <h1> (Site SEO "Intro text"). Renders nothing when blank.
 */
export function HubIntro({ text }: { text?: string }) {
  if (!text) return null
  return <p className="mt-3 text-muted-foreground text-balance whitespace-pre-line">{text}</p>
}
