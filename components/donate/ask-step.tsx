import React from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { HoneypotField } from '@/components/ui/honeypot-field'
import {
  DONATION_LEAD_DAYS,
  minimumEventDate,
  type DonationRequestErrors,
  type DonationRequestInput,
} from '@/lib/donate/donation-request'
import { firstErrorKey, FormAlert, FormField, type SetDonationField } from './form-shared'

export function AskStep({
  panelRef,
  values,
  set,
  taprooms,
  error,
  fieldErrors,
  pending,
  onBack,
}: {
  panelRef: React.Ref<HTMLFieldSetElement>
  values: DonationRequestInput
  set: SetDonationField
  taprooms: Array<{ id: string; slug?: string | null; name?: string | null }>
  error: string | null
  fieldErrors: DonationRequestErrors
  pending: boolean
  onBack: () => void
}) {
  const openKey = firstErrorKey(fieldErrors)
  return (
    <FieldSet ref={panelRef} tabIndex={-1} className="overflow-visible outline-none">
      <legend className="sr-only">The ask</legend>
      <FieldGroup className="overflow-visible p-1">
        <FieldSet>
          <FieldLegend variant="label">What are you asking for?</FieldLegend>
          <RadioGroup
            name="askType"
            value={values.askType}
            onValueChange={(value) => {
              if (value === 'product' || value === 'taproom-night') set('askType', value)
            }}
          >
            <Field orientation="horizontal">
              <RadioGroupItem
                value="product"
                id="ask-product"
                aria-labelledby="ask-product-label"
              />
              <FieldLabel id="ask-product-label" htmlFor="ask-product" className="font-normal">
                Beer / product, picked up at a taproom
              </FieldLabel>
            </Field>
            <Field orientation="horizontal">
              <RadioGroupItem
                value="taproom-night"
                id="ask-taproom-night"
                aria-labelledby="ask-taproom-night-label"
              />
              <FieldLabel
                id="ask-taproom-night-label"
                htmlFor="ask-taproom-night"
                className="font-normal"
              >
                A fundraiser night at a Lolev taproom
              </FieldLabel>
            </Field>
          </RadioGroup>
        </FieldSet>
        <FormField
          id="eventName"
          label="Event name"
          error={fieldErrors.eventName}
          forceOpen={openKey === 'eventName'}
        >
          <Input
            id="eventName"
            name="eventName"
            value={values.eventName}
            onChange={(e) => set('eventName', e.target.value)}
            required
          />
        </FormField>
        <FormField
          id="eventDate"
          label="Event date"
          hint={`Must be at least ${DONATION_LEAD_DAYS} days out.`}
          error={fieldErrors.eventDate}
          forceOpen={openKey === 'eventDate'}
        >
          <Input
            id="eventDate"
            name="eventDate"
            type="date"
            min={minimumEventDate()}
            value={values.eventDate}
            onChange={(e) => set('eventDate', e.target.value)}
            required
          />
        </FormField>
        <FormField
          id="venue"
          label="Venue and city"
          error={fieldErrors.venue}
          forceOpen={openKey === 'venue'}
        >
          <Input
            id="venue"
            name="venue"
            value={values.venue}
            onChange={(e) => set('venue', e.target.value)}
            required
          />
        </FormField>
        <FormField
          id="attendees"
          label="Expected 21+ attendance"
          error={fieldErrors.attendees}
          forceOpen={openKey === 'attendees'}
        >
          <Input
            id="attendees"
            name="attendees"
            type="number"
            min={1}
            max={10000}
            value={values.attendees}
            onChange={(e) => set('attendees', e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
        </FormField>
        <FormField
          id="requestDetails"
          label="What exactly are you asking for?"
          hint="At least 40 characters."
          error={fieldErrors.requestDetails}
          forceOpen={openKey === 'requestDetails'}
        >
          <Textarea
            id="requestDetails"
            name="requestDetails"
            value={values.requestDetails}
            onChange={(e) => set('requestDetails', e.target.value)}
            required
            minLength={40}
          />
        </FormField>
        {values.askType === 'product' ? (
          <>
            <FormField
              id="howServed"
              label="How will the beer be served?"
              hint="At least 20 characters."
              error={fieldErrors.howServed}
              forceOpen={openKey === 'howServed'}
            >
              <Textarea
                id="howServed"
                name="howServed"
                value={values.howServed}
                onChange={(e) => set('howServed', e.target.value)}
                required
                minLength={20}
              />
            </FormField>
            <FormField
              id="pickupName"
              label="Who is picking up? (21+, can haul it)"
              error={fieldErrors.pickupName}
              forceOpen={openKey === 'pickupName'}
            >
              <Input
                id="pickupName"
                name="pickupName"
                value={values.pickupName}
                onChange={(e) => set('pickupName', e.target.value)}
                required
              />
            </FormField>
          </>
        ) : null}
        {values.askType === 'taproom-night' ? (
          <FormField
            id="taproom"
            label="Which taproom?"
            error={fieldErrors.taproom}
            forceOpen={openKey === 'taproom'}
          >
            <Select
              value={values.taproom || undefined}
              onValueChange={(value) => set('taproom', value)}
            >
              <SelectTrigger id="taproom" className="w-full">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {taprooms.map((location) => (
                    <SelectItem key={location.slug || location.id} value={location.slug || location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        <FormField
          id="recognition"
          label="How will Lolev be recognized?"
          hint="At least 40 characters."
          error={fieldErrors.recognition}
          forceOpen={openKey === 'recognition'}
        >
          <Textarea
            id="recognition"
            name="recognition"
            value={values.recognition}
            onChange={(e) => set('recognition', e.target.value)}
            required
            minLength={40}
          />
        </FormField>
        <FormField
          id="whyLolev"
          label="Why Lolev, specifically?"
          hint="At least 80 characters."
          error={fieldErrors.whyLolev}
          forceOpen={openKey === 'whyLolev'}
        >
          <Textarea
            id="whyLolev"
            name="whyLolev"
            value={values.whyLolev}
            onChange={(e) => set('whyLolev', e.target.value)}
            required
            minLength={80}
          />
        </FormField>
        <Field orientation="horizontal">
          <Checkbox
            id="certify"
            name="certify"
            checked={values.certify}
            onCheckedChange={(checked) => set('certify', checked === true)}
            required
          />
          <FieldLabel htmlFor="certify" className="font-normal">
            I certify this is true. I understand this is not a yes.
          </FieldLabel>
        </Field>
      </FieldGroup>
      <HoneypotField value={values.companyUrlHp} onChange={(value) => set('companyUrlHp', value)} />
      <FormAlert error={error} />
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button type="submit" disabled={pending || !values.certify || !values.askType}>
          {pending ? <Spinner /> : null}
          {pending ? 'Submitting…' : 'Submit request'}
        </Button>
      </div>
    </FieldSet>
  )
}
