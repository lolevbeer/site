import React from 'react'
import { Button } from '@/components/ui/button'
import { FieldGroup, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormAlert, FormField, formFieldAria, type SetDonationField } from './form-shared'
import type { DonationRequestErrors, DonationRequestInput } from '@/lib/donate/donation-request'

export function OrganizationStep({
  panelRef,
  values,
  set,
  error,
  fieldErrors,
  onBack,
  onContinue,
}: {
  panelRef: React.Ref<HTMLFieldSetElement>
  values: DonationRequestInput
  set: SetDonationField
  error: string | null
  fieldErrors: DonationRequestErrors
  onBack: () => void
  onContinue: () => void
}) {
  return (
    <FieldSet ref={panelRef} tabIndex={-1} className="overflow-visible outline-none">
      <legend className="sr-only">Organization</legend>
      <FieldGroup className="overflow-visible p-1">
        <FormField
          id="organizationName"
          label="Organization name"
          error={fieldErrors.organizationName}
        >
          <Input
            id="organizationName"
            name="organizationName"
            autoComplete="organization"
            value={values.organizationName}
            onChange={(e) => set('organizationName', e.target.value)}
            required
            aria-required="true"
          />
        </FormField>
        <FormField
          id="contactName"
          label="Your name"
          error={fieldErrors.contactName}
        >
          <Input
            id="contactName"
            name="contactName"
            autoComplete="name"
            value={values.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            required
            aria-required="true"
          />
        </FormField>
        <FormField id="email" label="Email" error={fieldErrors.email}>
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
        </FormField>
        <FormField id="phone" label="Phone" error={fieldErrors.phone}>
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
        </FormField>
        <FormField
          id="mission"
          label="What does the organization do?"
          hint="At least 80 characters."
          error={fieldErrors.mission}
        >
          <Textarea
            id="mission"
            name="mission"
            value={values.mission}
            onChange={(e) => set('mission', e.target.value)}
            required
            minLength={80}
          />
        </FormField>
        <FormField
          id="howHeard"
          label="How did you hear about Lolev?"
          hint="At least 20 characters."
          error={fieldErrors.howHeard}
        >
          <Textarea
            id="howHeard"
            name="howHeard"
            value={values.howHeard}
            onChange={(e) => set('howHeard', e.target.value)}
            required
            minLength={20}
          />
        </FormField>
        <FormField
          id="previousDonation"
          label="Have we donated to you before?"
          error={fieldErrors.previousDonation}
        >
          <Select
            value={values.previousDonation || undefined}
            onValueChange={(value) => {
              if (value === 'yes' || value === 'no') set('previousDonation', value)
            }}
          >
            <SelectTrigger
              id="previousDonation"
              className="w-full"
              aria-required="true"
              {...formFieldAria('previousDonation', { error: fieldErrors.previousDonation })}
            >
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="no">No</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormField>
      </FieldGroup>
      <FormAlert error={error} />
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </FieldSet>
  )
}
