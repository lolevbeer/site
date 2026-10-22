'use client'

/**
 * Private-event inquiry form on /private-events. Asks about the event first
 * (date, flexible?, guests, one-tap taproom and occasion) and contact details
 * last; phone is optional. The taproom starts on the one picked in the site
 * header. Submits to the event-inquiries staff inbox (never Events).
 * Text fields are checked on blur with the same validator the server runs;
 * server errors also show under each field and clear when it changes. On
 * success the confirmation repeats what was sent, focus moves to it, and the
 * `event_inquiry_submitted` conversion is sent. Field ids are prefixed
 * `inquiry-` so they cannot collide with other ids on the page.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { HoneypotField } from '@/components/ui/honeypot-field'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { submitEventInquiry } from '@/src/actions/event-inquiry'
import { trackConversion } from '@/lib/analytics/events'
import { useLocationContext } from '@/components/location/location-provider'
import {
  EVENT_INQUIRY_MAX_HEADCOUNT,
  EVENT_INQUIRY_OCCASIONS,
  emptyEventInquiry,
  validateEventInquiry,
  type EventInquiryErrors,
  type EventInquiryInput,
} from '@/lib/events/inquiry'
import { useTodayEST } from '@/lib/hooks/use-today-est'
import { maximumEventDate } from '@/lib/donate/donation-request'
import { formatDate } from '@/lib/utils/formatters'

/** Text fields checked when the visitor leaves them. */
type BlurField = 'name' | 'email' | 'phone' | 'headcount'

export function EventInquiryForm({
  taprooms,
}: {
  taprooms: Array<{ id: string; slug?: string | null; name?: string | null }>
}) {
  const taproomOptions = taprooms
    .filter((location) => location.slug)
    .map((location) => ({ value: location.slug as string, label: location.name || '' }))
  const taproomSlugs = taproomOptions.map((option) => option.value)
  const { currentLocation } = useLocationContext()
  const [values, setValues] = useState<EventInquiryInput>(emptyEventInquiry)
  // Until the visitor picks one: the only taproom, else the header's taproom.
  // Derived, not stored, because the header location resolves after mount.
  const defaultTaproom =
    taproomSlugs.length === 1
      ? taproomSlugs[0]
      : taproomSlugs.includes(currentLocation)
        ? currentLocation
        : ''
  const taproom = values.taproom || defaultTaproom
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<EventInquiryErrors>({})
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  // Client-only (null until mounted): /events is ISR-cached, so a
  // server-rendered "today" can be a day stale. The server rejects past dates.
  const minDate = useTodayEST() ?? undefined
  const doneTitleRef = useRef<HTMLDivElement>(null)

  // The form (and its focused submit button) unmounts on success; move focus
  // to the confirmation so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (done) doneTitleRef.current?.focus()
  }, [done])

  function set<K extends keyof EventInquiryInput>(key: K, value: EventInquiryInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** Show this field's validator error once it has a value; empty fields wait for submit. */
  function checkField(key: BlurField) {
    if (values[key] === '') return
    const result = validateEventInquiry({ ...values, taproom }, minDate, taproomSlugs)
    const message = result.ok ? undefined : result.errors[key]
    if (message) setFieldErrors((prev) => ({ ...prev, [key]: message }))
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setError(null)
    setFieldErrors({})
    setPending(true)
    try {
      const result = await submitEventInquiry({ ...values, taproom })
      if (result.ok) {
        setDone(true)
        trackConversion('event_inquiry_submitted')
      } else {
        setError(result.error)
        setFieldErrors(result.errors ?? {})
      }
    } catch {
      setError('Could not send the inquiry. Try again in a minute.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="text-left">
      {done ? (
        <Empty role="status">
          <EmptyHeader>
            <EmptyTitle ref={doneTitleRef} tabIndex={-1} className="outline-none">
              Inquiry received
            </EmptyTitle>
            <EmptyDescription>
              {[
                values.preferredDate
                  ? `${formatDate(values.preferredDate, 'full')}${values.flexibleDate ? ' (flexible)' : ''}`
                  : null,
                values.headcount ? `${values.headcount} guests` : null,
                taproomOptions.find((option) => option.value === taproom)?.label,
              ]
                .filter(Boolean)
                .join(' · ')}
            </EmptyDescription>
            <EmptyDescription>
              Thanks! We will email {values.email || 'you'} about availability.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <form
          noValidate
          onSubmit={onSubmit}
          className="relative overflow-visible flex flex-col gap-4"
        >
          <FieldGroup className="overflow-visible p-1 gap-5">
            <div data-slot="field-row" className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="inquiry-preferredDate"
                label="Preferred date"
                error={fieldErrors.preferredDate}
              >
                <DatePicker
                  id="inquiry-preferredDate"
                  min={minDate}
                  max={minDate && maximumEventDate(minDate)}
                  value={values.preferredDate}
                  onChange={(value) => set('preferredDate', value)}
                />
              </FormField>
              <FormField
                id="inquiry-headcount"
                label="How many guests?"
                error={fieldErrors.headcount}
              >
                <Input
                  id="inquiry-headcount"
                  name="headcount"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 25"
                  onBlur={() => checkField('headcount')}
                  min={1}
                  max={EVENT_INQUIRY_MAX_HEADCOUNT}
                  value={values.headcount}
                  onChange={(e) =>
                    set('headcount', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  required
                />
              </FormField>
            </div>
            <Field orientation="horizontal">
              <Checkbox
                id="inquiry-flexibleDate"
                // border-input nearly vanishes on the dark card.
                className="border-muted-foreground"
                checked={values.flexibleDate}
                onCheckedChange={(checked) => set('flexibleDate', checked === true)}
              />
              <FieldLabel htmlFor="inquiry-flexibleDate" className="font-normal">
                My date is flexible
              </FieldLabel>
            </Field>
            <FormField id="inquiry-taproom" label="Taproom" error={fieldErrors.taproom}>
              <SegmentedControl
                aria-label="Taproom"
                className="w-full"
                options={taproomOptions}
                value={taproom || undefined}
                onValueChange={(value) => set('taproom', value)}
              />
            </FormField>
            <FormField
              id="inquiry-occasion"
              label="Occasion (optional)"
              error={fieldErrors.occasion}
            >
              <SegmentedControl
                aria-label="Occasion"
                className="w-full"
                options={EVENT_INQUIRY_OCCASIONS}
                value={values.occasion || undefined}
                // Tapping the chosen occasion again clears it (the field is optional).
                onValueChange={(value) => set('occasion', value === values.occasion ? '' : value)}
              />
            </FormField>
            <FormField id="inquiry-name" label="Your name" error={fieldErrors.name}>
              <Input
                id="inquiry-name"
                name="name"
                autoComplete="name"
                onBlur={() => checkField('name')}
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </FormField>
            <FormField id="inquiry-email" label="Email" error={fieldErrors.email}>
              <Input
                id="inquiry-email"
                name="email"
                type="email"
                autoComplete="email"
                onBlur={() => checkField('email')}
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
                required
              />
            </FormField>
            <FormField id="inquiry-phone" label="Phone (optional)" error={fieldErrors.phone}>
              <Input
                id="inquiry-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                onBlur={() => checkField('phone')}
                value={values.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </FormField>
            <FormField
              id="inquiry-message"
              label="Anything else? (optional)"
              error={fieldErrors.message}
            >
              <Textarea
                id="inquiry-message"
                name="message"
                rows={3}
                placeholder="Timing, food, anything we should know"
                value={values.message}
                onChange={(e) => set('message', e.target.value)}
              />
            </FormField>
            {/* Same ring gutter as FormField, so the button lines up with the inputs. */}
            <div className="w-full p-1 -m-1">
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? <Spinner /> : null}
                {pending ? 'Sending…' : 'Send inquiry'}
              </Button>
            </div>
          </FieldGroup>
          <HoneypotField
            value={values.companyUrlHp}
            onChange={(value) => set('companyUrlHp', value)}
          />
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      )}
    </div>
  )
}
