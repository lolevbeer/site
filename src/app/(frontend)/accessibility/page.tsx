import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { LegalPage } from '@/components/legal/legal-page'
import { generateWebPageSchema } from '@/lib/utils/breadcrumb-schema'
import { LEGAL_PAGES_LASTMOD, LEGAL_PAGES_LASTMOD_LABEL } from '@/lib/legal/dates'
import { getSiteSeo, hubPageSeo } from '@/lib/utils/site-seo'
import { buildPageMetadata } from '@/lib/seo/resolve-metadata'

const DESCRIPTION =
  'How lolev.beer is built for keyboard, screen reader, and magnification use, and how to report barriers.'

export async function generateMetadata(): Promise<Metadata> {
  const siteSeo = await getSiteSeo()
  return buildPageMetadata({
    fallbackTitle: 'Accessibility Statement',
    fallbackDescription: DESCRIPTION,
    canonicalPath: '/accessibility',
    seo: hubPageSeo(siteSeo, 'accessibility'),
    siteSeo,
  })
}


export default function AccessibilityPage() {
  const webPageSchema = generateWebPageSchema({
    name: 'Accessibility Statement',
    description: DESCRIPTION,
    path: '/accessibility',
    dateModified: LEGAL_PAGES_LASTMOD,
  })

  return (
    <>
      <JsonLd data={webPageSchema} />
      <LegalPage title="Accessibility Statement" lastUpdated={LEGAL_PAGES_LASTMOD_LABEL}>
        <section>
          <h2>What we aim for</h2>
          <p>
            We want lolev.beer to work for people using keyboards, screen readers, and
            magnification. We design to{' '}
            <a
              href="https://www.w3.org/TR/WCAG22/"
              target="_blank"
              rel="noopener noreferrer"
            >
              WCAG 2.2 Level AA
            </a>
            . We have not published a third-party audit that every criterion is met.
          </p>
        </section>

        <section>
          <h2>What is in place</h2>
          <ul>
            <li>A skip link to main content</li>
            <li>Keyboard access for site navigation and public forms</li>
            <li>Visible focus styles</li>
            <li>Text contrast aimed at 4.5:1</li>
            <li>Pinch-zoom allowed; text can grow without trapping content</li>
            <li>Form labels and error text, not color alone</li>
            <li>Hit areas at least 24×24 pixels</li>
          </ul>
        </section>

        <section>
          <h2>Known limits</h2>
          <ul>
            <li>
              The beer map is Mapbox. Map controls and popups can be harder with a keyboard
              or screen reader. Store names and addresses are also listed beside the map.
            </li>
            <li>
              Some beer pages include a 3D can. That is decorative; the beer information is
              also in text.
            </li>
          </ul>
        </section>

        <section>
          <h2>Reporting issues</h2>
          <p>
            If you hit a barrier, email{' '}
            <a href="mailto:info@lolev.beer?subject=Accessibility">info@lolev.beer</a> with
            &quot;Accessibility&quot; in the subject, and tell us the page and what you were
            trying to do. You can also call{' '}
            <a href="tel:4123368965">(412) 336-8965</a>. We aim to reply within 2 business
            days.
          </p>
        </section>
      </LegalPage>
    </>
  )
}
