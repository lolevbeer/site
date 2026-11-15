/**
 * Renders staff-written rich text (FAQ answers, job descriptions, the homepage
 * introduction and About page sections) with the
 * site's link and list styles. The editor for these fields allows paragraphs,
 * bold, italic, links and lists, plus h2/h3 on job descriptions and h4 on FAQ answers (see `simpleEditor` in src/fields/rich-text.ts).
 */
import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import type { SimpleRichText } from '@/src/fields/rich-text'
import { cn } from '@/lib/utils'

const STYLES = [
  'space-y-4 text-pretty',
  // Underlined, not colour alone: on the job page body text is already the primary colour.
  '[&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2',
  // h2 matches the job page's own "Apply" heading.
  '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-balance [&_h3]:text-xl [&_h3]:font-semibold',
  '[&_h4]:font-semibold',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mt-1',
].join(' ')

export function RichText({ data, className }: { data: SimpleRichText; className?: string }) {
  return <LexicalRichText data={data} className={cn(STYLES, className)} />
}
