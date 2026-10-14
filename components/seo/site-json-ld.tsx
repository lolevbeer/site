/**
 * Schema.org graph emitted as a raw script tag in the document HTML.
 * The frontend layout renders this as a direct child of body so non-JS
 * crawlers receive the script in the HTML document.
 */

import type { PayloadLocation } from '@/lib/types/location'
import { serializeJsonLd } from '@/lib/utils/json-ld'
import { generateCrawlableSiteGraph } from '@/lib/utils/local-business-schema'

export function SiteJsonLd({ locations }: { locations: PayloadLocation[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(generateCrawlableSiteGraph(locations)),
      }}
    />
  )
}
