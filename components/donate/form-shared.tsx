/** Shared donation-wizard types and shadcn field helpers. */

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { DonationRequestErrors, DonationRequestInput } from '@/lib/donate/donation-request'

export function firstErrorKey(errors: DonationRequestErrors): string | undefined {
  return Object.keys(errors)[0]
}

export type SetDonationField = <K extends keyof DonationRequestInput>(
  key: K,
  value: DonationRequestInput[K],
) => void

export { FormField } from '@/components/ui/form-field'

export function FormAlert({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}
