/**
 * Renders staff-written rich text (FAQ answers, job descriptions) with the
 * site's link and list styles. The editor for these fields allows paragraphs,
 * bold, italic, links and lists only (see `simpleEditor` in src/fields/rich-text.ts).
 */
import { RichText as LexicalRichText } from '@payloadcms/richtext-lexical/react'
import type { SimpleRichText } from '@/src/fields/rich-text'
import { cn } from '@/lib/utils'

const STYLES = [
  'space-y-4 text-pretty',
  // Underlined, not colour alone: on the job page body text is already the primary colour.
  '[&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:mt-1',
].join(' ')

export function RichText({ data, className }: { data: SimpleRichText; className?: string }) {
  return <LexicalRichText data={data} className={cn(STYLES, className)} />
}
