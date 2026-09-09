/** Typed setter shared by the three donation wizard steps. */

import type { DonationRequestInput } from '@/lib/donate/donation-request'

export type SetDonationField = <K extends keyof DonationRequestInput>(
  key: K,
  value: DonationRequestInput[K],
) => void
