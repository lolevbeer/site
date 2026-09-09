import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { LegalPage } from '@/components/legal/legal-page'
import { generateWebPageSchema } from '@/lib/utils/breadcrumb-schema'
import { DEFAULT_OG_IMAGES } from '@/lib/utils/seo'
import { LEGAL_PAGES_LASTMOD, LEGAL_PAGES_LASTMOD_LABEL } from '@/lib/legal/dates'

const DESCRIPTION =
  'Terms for using lolev.beer, including age, menus and hours, donation requests, and job applications.'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: DESCRIPTION,
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service | Lolev Beer',
    description: DESCRIPTION,
    type: 'website',
    images: DEFAULT_OG_IMAGES,
  },
}

export default function TermsPage() {
  const webPageSchema = generateWebPageSchema({
    name: 'Terms of Service',
    description: DESCRIPTION,
    path: '/terms',
    dateModified: LEGAL_PAGES_LASTMOD,
  })

  return (
    <>
      <JsonLd data={webPageSchema} />
      <LegalPage title="Terms of Service" lastUpdated={LEGAL_PAGES_LASTMOD_LABEL}>
        <section>
          <p>
            By using lolev.beer you agree to these terms. If you do not agree, do not use the
            site.
          </p>
        </section>

        <section>
          <h2>Age</h2>
          <p>
            You must be 21 or older to use this website. By using it, you represent that you
            are of legal drinking age.
          </p>
        </section>

        <section>
          <h2>Hours, menus, and listings</h2>
          <p>
            Hours, beer lists, food, events, and job openings change. What you see here is not
            a guarantee we have that beer, table, or role when you arrive.
          </p>
        </section>

        <section>
          <h2>Donation requests and job applications</h2>
          <p>
            Sending a donation request or job application is not a yes, an offer, or a
            contract. We email only if we want to continue. Please do not follow up at the bar
            about an application.
          </p>
        </section>

        <section>
          <h2>Using the site</h2>
          <p>
            You may browse the site for personal use. Do not copy the site wholesale, scrape
            it in a way that harms the service, or interfere with other people&apos;s
            submissions.
          </p>
        </section>

        <section>
          <h2>Disclaimer</h2>
          <p>
            The site is provided as-is. We do not warrant that it is complete, current, or
            error-free. Linked sites are not ours, and a link is not an endorsement.
          </p>
        </section>

        <section>
          <h2>Limits on liability</h2>
          <p>
            Lolev Beer is not liable for damages that come from using, or being unable to use,
            this website.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            We may update these terms. The date at the top is the current version. Keep using
            the site after a change means you accept the new terms.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Lolev Beer ·{' '}
            <a href="mailto:info@lolev.beer">info@lolev.beer</a>
          </p>
        </section>
      </LegalPage>
    </>
  )
}
