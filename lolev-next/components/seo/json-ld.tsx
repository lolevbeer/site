/**
 * JSON-LD component for injecting structured data into pages
 * Used for SEO and rich results in search engines
 */

import Script from 'next/script';
import { serializeJsonLd } from '@/lib/utils/json-ld';

interface JsonLdProps {
  /** The JSON-LD data object */
  data: object;
}

/**
 * Component that renders a script tag with JSON-LD structured data
 * This helps search engines understand the content and display rich results
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <Script
      id={`json-ld-${JSON.stringify(data).substring(0, 20)}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
      strategy="beforeInteractive"
    />
  );
}
