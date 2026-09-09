/**
 * Public beer / taproom-night donation request. Three-page ringer; staff
 * review lives in Payload. Slack #events is pinged on submit.
 */

import type { Metadata } from 'next'
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs'
import { Card, CardContent } from '@/components/ui/card'
import { DonationRequestForm } from '@/components/donate/donation-request-form'
import { PageTransition } from '@/components/motion'

export const metadata: Metadata = {
  title: 'Donations',
  description:
    'Request a Lolev Beer donation or a fundraiser night at a taproom. We review completed forms only.',
  alternates: { canonical: '/donate' },
  robots: { index: true, follow: true },
}

export default function DonatePage() {
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <PageBreadcrumbs className="mb-6" />
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Donations</h1>
          <p className="text-muted-foreground text-pretty">
            We like helping neighborhood fundraisers. We cannot help all of them. Fill this
            out completely if you want to be considered.
          </p>
        </div>
        <Card>
          <CardContent className="overflow-visible p-6">
            <DonationRequestForm />
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
