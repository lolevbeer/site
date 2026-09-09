import React from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert, fieldClass, selectClass } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import type { DonationRequestInput } from '@/lib/donate/donation-request'
import type { SetDonationField } from './form-shared'

export function OrganizationStep({
  panelRef,
  values,
  set,
  error,
  onBack,
  onContinue,
}: {
  panelRef: React.Ref<HTMLFieldSetElement>
  values: DonationRequestInput
  set: SetDonationField
  error: string | null
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <fieldset ref={panelRef} tabIndex={-1} className="space-y-4 outline-none">
      <legend className="sr-only">Organization</legend>
      <Field id="organizationName" label="Organization name">
        <Input
          id="organizationName"
          name="organizationName"
          autoComplete="organization"
          value={values.organizationName}
          onChange={(e) => set('organizationName', e.target.value)}
          required
          aria-required="true"
        />
      </Field>
      <Field id="contactName" label="Your name">
        <Input
          id="contactName"
          name="contactName"
          autoComplete="name"
          value={values.contactName}
          onChange={(e) => set('contactName', e.target.value)}
          required
          aria-required="true"
        />
      </Field>
      <Field id="email" label="Email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => set('email', e.target.value)}
          required
          aria-required="true"
        />
      </Field>
      <Field id="phone" label="Phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(e) => set('phone', e.target.value)}
          required
          aria-required="true"
        />
      </Field>
      <Field id="mission" label="What does the organization do?" hint="At least 80 characters.">
        <textarea
          id="mission"
          name="mission"
          className={fieldClass}
          value={values.mission}
          onChange={(e) => set('mission', e.target.value)}
          required
          minLength={80}
        />
      </Field>
      <Field id="howHeard" label="How did you hear about Lolev?" hint="At least 20 characters.">
        <textarea
          id="howHeard"
          name="howHeard"
          className={fieldClass}
          value={values.howHeard}
          onChange={(e) => set('howHeard', e.target.value)}
          required
          minLength={20}
        />
      </Field>
      <Field id="previousDonation" label="Have we donated to you before?">
        <select
          id="previousDonation"
          name="previousDonation"
          className={selectClass}
          value={values.previousDonation}
          onChange={(e) => {
            const value = e.target.value
            if (value === '' || value === 'yes' || value === 'no') set('previousDonation', value)
          }}
          required
        >
          <option value="">Select</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </Field>
      <FormAlert error={error} />
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </fieldset>
  )
}
