/**
 * JSON-LD component for injecting structured data into pages
 * Used for SEO and rich results in search engines
 */

import { serializeJsonLd } from '@/lib/utils/json-ld';

interface JsonLdProps {
  /** The JSON-LD data object */
  data: object;
}

/**
 * Component that renders a script tag with JSON-LD structured data
 * This helps search engines understand the content and display rich results
 *
 * Uses a plain script tag (not next/script) to ensure it's in the initial HTML
 * that search engine crawlers can see without JavaScript execution
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
