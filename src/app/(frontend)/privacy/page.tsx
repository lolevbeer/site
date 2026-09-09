import type { Metadata } from 'next'
import { JsonLd } from '@/components/seo/json-ld'
import { LegalPage } from '@/components/legal/legal-page'
import { generateWebPageSchema } from '@/lib/utils/breadcrumb-schema'
import { DEFAULT_OG_IMAGES } from '@/lib/utils/seo'
import { LEGAL_PAGES_LASTMOD, LEGAL_PAGES_LASTMOD_LABEL } from '@/lib/legal/dates'

const DESCRIPTION =
  'How Lolev Beer collects and uses information on lolev.beer, including analytics, the beer map, donation requests, and job applications.'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy | Lolev Beer',
    description: DESCRIPTION,
    type: 'website',
    images: DEFAULT_OG_IMAGES,
  },
}

export default function PrivacyPage() {
  const webPageSchema = generateWebPageSchema({
    name: 'Privacy Policy',
    description: DESCRIPTION,
    path: '/privacy',
    dateModified: LEGAL_PAGES_LASTMOD,
  })

  return (
    <>
      <JsonLd data={webPageSchema} />
      <LegalPage title="Privacy Policy" lastUpdated={LEGAL_PAGES_LASTMOD_LABEL}>
        <section>
          <h2>About this policy</h2>
          <p>
            This policy is about lolev.beer. It covers browsing, the beer map, donation
            requests, and job applications.
          </p>
        </section>

        <section>
          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Usage.</strong> Pages you visit, device and browser information, and
              approximate location from your IP, through Google Analytics and Vercel Analytics.
            </li>
            <li>
              <strong>Taproom preference.</strong> Which taproom you last picked, saved in
              your browser.
            </li>
            <li>
              <strong>Beer map.</strong> If you use Near Me, your browser may share your
              location so we can sort nearby stores and move the map. We do not keep that
              GPS on our servers. City, ZIP, and address search is sent to Mapbox to geocode.
            </li>
            <li>
              <strong>Donation requests.</strong> Organization and contact name, email, phone,
              mission, event details, and what you are asking for.
            </li>
            <li>
              <strong>Job applications.</strong> Name, email, phone, and your note. We do not
              accept resume files.
            </li>
          </ul>
          <p>
            When you submit a public form, we store a hash of your IP so we can rate-limit
            spam. We do not store the raw IP on the form row.
          </p>
        </section>

        <section>
          <h2>Cookies and local storage</h2>
          <p>
            Google Analytics sets cookies to measure traffic. Your taproom choice is stored
            in localStorage on your device. Staff who sign in to the admin use a session
            cookie. There is no mailing-list form on this site. The homepage Newsletter
            button opens Square, where you can enroll if you want updates.
          </p>
        </section>

        <section>
          <h2>How we use it</h2>
          <p>
            We use this information to run the site, see which pages work, answer donation
            and job messages, and keep forms from being spammed. We do not sell your
            information.
          </p>
        </section>

        <section>
          <h2>Who we share it with</h2>
          <p>We share information with the services that run the site, including:</p>
          <ul>
            <li>Google Analytics and Vercel Analytics, to measure traffic.</li>
            <li>
              Mapbox, to draw the beer map, serve map tiles, and geocode city, ZIP, and
              address search. If you use Near Me, Mapbox sees the map around your location.
              Search text is sent to Mapbox Geocoding.
            </li>
            <li>
              Sentry, for errors and sampled session replay so we can debug problems. Some
              page activity may be recorded.
            </li>
            <li>
              Square, if you use the homepage Newsletter link. That mailing-list form is on
              Square, not this site.
            </li>
            <li>
              Slack, to tell staff a donation request or job application arrived. Those pings
              do not include your email or phone.
            </li>
            <li>Our hosting provider, to serve the website.</li>
            <li>Anyone we must tell if the law requires it.</li>
          </ul>
          <p>
            Donation requests and job applications are stored in our staff inbox so we can
            reply.
          </p>
        </section>

        <section>
          <h2>Age</h2>
          <p>This website is for people 21 and older.</p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            Email{' '}
            <a href="mailto:info@lolev.beer">info@lolev.beer</a> to ask what we have, to
            correct it, or to ask us to delete a donation request or job application. You can
            also block Analytics cookies in your browser.
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
