import React from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert, fieldClass, selectClass } from '@/components/ui/form-field'
import { HoneypotField } from '@/components/ui/honeypot-field'
import { Input } from '@/components/ui/input'
import { DONATION_LEAD_DAYS, minimumEventDate, type DonationRequestInput } from '@/lib/donate/donation-request'
import type { SetDonationField } from './form-shared'

export function AskStep({
  panelRef,
  values,
  set,
  taprooms,
  error,
  pending,
  onBack,
}: {
  panelRef: React.Ref<HTMLFieldSetElement>
  values: DonationRequestInput
  set: SetDonationField
  taprooms: Array<{ id: string; slug?: string | null; name?: string | null }>
  error: string | null
  pending: boolean
  onBack: () => void
}) {
  return (
    <fieldset ref={panelRef} tabIndex={-1} className="space-y-4 outline-none">
      <legend className="sr-only">The ask</legend>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-2">What are you asking for?</legend>
        <label className="flex gap-2 items-center cursor-pointer">
          <input
            type="radio"
            name="askType"
            value="product"
            required
            checked={values.askType === 'product'}
            onChange={() => set('askType', 'product')}
          />
          <span className="text-sm">Beer / product, picked up at a taproom</span>
        </label>
        <label className="flex gap-2 items-center cursor-pointer">
          <input
            type="radio"
            name="askType"
            value="taproom-night"
            checked={values.askType === 'taproom-night'}
            onChange={() => set('askType', 'taproom-night')}
          />
          <span className="text-sm">A fundraiser night at a Lolev taproom</span>
        </label>
      </fieldset>
      <Field id="eventName" label="Event name">
        <Input
          id="eventName"
          name="eventName"
          value={values.eventName}
          onChange={(e) => set('eventName', e.target.value)}
          required
        />
      </Field>
      <Field
        id="eventDate"
        label="Event date"
        hint={`Must be at least ${DONATION_LEAD_DAYS} days out.`}
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
      </Field>
      <Field id="venue" label="Venue and city">
        <Input
          id="venue"
          name="venue"
          value={values.venue}
          onChange={(e) => set('venue', e.target.value)}
          required
        />
      </Field>
      <Field id="attendees" label="Expected 21+ attendance">
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
      </Field>
      <Field
        id="requestDetails"
        label="What exactly are you asking for?"
        hint="At least 40 characters."
      >
        <textarea
          id="requestDetails"
          name="requestDetails"
          className={fieldClass}
          value={values.requestDetails}
          onChange={(e) => set('requestDetails', e.target.value)}
          required
          minLength={40}
        />
      </Field>
      {values.askType === 'product' ? (
        <>
          <Field id="howServed" label="How will the beer be served?" hint="At least 20 characters.">
            <textarea
              id="howServed"
              name="howServed"
              className={fieldClass}
              value={values.howServed}
              onChange={(e) => set('howServed', e.target.value)}
              required
              minLength={20}
            />
          </Field>
          <Field id="pickupName" label="Who is picking up? (21+, can haul it)">
            <Input
              id="pickupName"
              name="pickupName"
              value={values.pickupName}
              onChange={(e) => set('pickupName', e.target.value)}
              required
            />
          </Field>
        </>
      ) : null}
      {values.askType === 'taproom-night' ? (
        <Field id="taproom" label="Which taproom?">
          <select
            id="taproom"
            name="taproom"
            className={selectClass}
            value={values.taproom}
            onChange={(e) => set('taproom', e.target.value)}
            required
          >
            <option value="">Select</option>
            {taprooms.map((location) => (
              <option key={location.slug || location.id} value={location.slug || location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field id="recognition" label="How will Lolev be recognized?" hint="At least 40 characters.">
        <textarea
          id="recognition"
          name="recognition"
          className={fieldClass}
          value={values.recognition}
          onChange={(e) => set('recognition', e.target.value)}
          required
          minLength={40}
        />
      </Field>
      <Field id="whyLolev" label="Why Lolev, specifically?" hint="At least 80 characters.">
        <textarea
          id="whyLolev"
          name="whyLolev"
          className={fieldClass}
          value={values.whyLolev}
          onChange={(e) => set('whyLolev', e.target.value)}
          required
          minLength={80}
        />
      </Field>
      <div className="flex gap-3 items-start">
        <input
          id="certify"
          name="certify"
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={values.certify}
          onChange={(e) => set('certify', e.target.checked)}
          required
        />
        <label htmlFor="certify" className="text-sm leading-snug cursor-pointer">
          I certify this is true. I understand this is not a yes.
        </label>
      </div>
      <HoneypotField value={values.companyUrlHp} onChange={(value) => set('companyUrlHp', value)} />
      <FormAlert error={error} />
      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
          Back
        </Button>
        <Button type="submit" disabled={pending || !values.certify || !values.askType}>
          {pending ? 'Submitting…' : 'Submit request'}
        </Button>
      </div>
    </fieldset>
  )
}
