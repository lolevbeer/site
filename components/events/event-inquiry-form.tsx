'use client'

/**
 * Private-event inquiry form on /private-events. Asks about the event first
 * (date, guests, flexible-date switch with an inline calendar for other
 * days, start time from one half-hour list, then one-tap buttons for
 * length, taproom, occasion, drinks (starting on "Not sure") and food plan;
 * tapping a chosen optional button again clears it) so staff can quote
 * in the first reply, and contact details last; phone and company name are
 * optional (a company name means a company is paying). The guest count is a
 * digits-only text field so a scroll wheel cannot change it. One column on
 * phones. The taproom starts on the one picked in the
 * site header. Submits to the event-inquiries staff inbox (never Events).
 * Text fields are checked on blur with the same validator the server runs;
 * server errors also show under each field and clear when it changes. On
 * success the confirmation repeats what was sent, promises a reply within
 * 24 hours, focus moves to it, and the
 * `event_inquiry_submitted` conversion is sent. Rejected submissions focus the
 * first invalid control. Related fields share rows when space allows.
 * Field ids use the `inquiry-` prefix to avoid collisions elsewhere on the page.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { XIcon } from '@/components/icons'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { FormField, formFieldAria } from '@/components/ui/form-field'
import { HoneypotField } from '@/components/ui/honeypot-field'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { submitEventInquiry } from '@/src/actions/event-inquiry'
import { trackConversion } from '@/lib/analytics/events'
import { useLocationContext } from '@/components/location/location-provider'
import {
  EVENT_INQUIRY_DRINKS,
  EVENT_INQUIRY_DURATIONS,
  EVENT_INQUIRY_FOOD_PLANS,
  EVENT_INQUIRY_MAX_HEADCOUNT,
  EVENT_INQUIRY_MAX_OTHER_DATES,
  EVENT_INQUIRY_OCCASIONS,
  EVENT_INQUIRY_START_TIMES,
  emptyEventInquiry,
  validateEventInquiry,
  type EventInquiryErrors,
  type EventInquiryInput,
} from '@/lib/events/inquiry'
import { useTodayEST } from '@/lib/hooks/use-today-est'
import { maximumEventDate } from '@/lib/donate/donation-request'
import { formatDate, formatTime, parseLocalDate } from '@/lib/utils/formatters'
import { toDateKey } from '@/lib/utils/food-dates'

/** Text fields checked when the visitor leaves them. */
type BlurField = 'name' | 'email' | 'phone' | 'headcount' | 'companyName'

function formatInquiryDate(values: EventInquiryInput): string | null {
  if (!values.preferredDate) return null

  const date = formatDate(values.preferredDate, 'full')
  if (!values.flexibleDate) return date
  if (values.otherDates.length === 0) return `${date} (flexible)`

  const count = values.otherDates.length
  return `${date} + ${count} other ${count === 1 ? 'date' : 'dates'}`
}

export function EventInquiryForm({
  taprooms,
}: {
  taprooms: Array<{ id: string; slug?: string | null; name?: string | null }>
}) {
  const taproomOptions = taprooms
    .filter((location) => location.slug)
    // "Lawrenceville", not "Lolev Lawrenceville": the brand is implied and the row is narrow.
    .map((location) => ({
      value: location.slug as string,
      label: (location.name || '').replace(/^Lolev\s+/, ''),
    }))
  const taproomSlugs = taproomOptions.map((option) => option.value)
  const { currentLocation } = useLocationContext()
  const [values, setValues] = useState<EventInquiryInput>(emptyEventInquiry)
  // Until the visitor picks one: the only taproom, else the header's taproom.
  // Derived, not stored, because the header location resolves after mount.
  let defaultTaproom = ''
  if (taproomSlugs.length === 1) {
    defaultTaproom = taproomSlugs[0]
  } else if (taproomSlugs.includes(currentLocation)) {
    defaultTaproom = currentLocation
  }
  const taproom = values.taproom || defaultTaproom
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<EventInquiryErrors>({})
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState<{
    values: EventInquiryInput
    taproomLabel: string
  } | null>(null)
  const [calendarMonths, setCalendarMonths] = useState(1)
  // Client-only (null until mounted): /events is ISR-cached, so a
  // server-rendered "today" can be a day stale. The server rejects past dates.
  const minDate = useTodayEST() ?? undefined
  const doneTitleRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia('(min-width: 1024px)')
    function updateCalendarMonths() {
      setCalendarMonths(desktopMediaQuery.matches ? 3 : 1)
    }

    updateCalendarMonths()
    desktopMediaQuery.addEventListener('change', updateCalendarMonths)
    return () => desktopMediaQuery.removeEventListener('change', updateCalendarMonths)
  }, [])

  useEffect(() => {
    if (!error || pending) return
    const invalid = formRef.current?.querySelector<HTMLElement>(
      '[data-invalid="true"] :is(button, input, textarea)',
    )
    const target = invalid ?? errorRef.current
    target?.focus({ preventScroll: true })
    target?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [error, pending])

  // The form (and its focused submit button) unmounts on success; move focus
  // to the confirmation so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (submitted) doneTitleRef.current?.focus()
  }, [submitted])

  function set<K extends keyof EventInquiryInput>(key: K, value: EventInquiryInput[K]) {
    if (pending) return
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'preferredDate') {
        next.otherDates = prev.otherDates.filter((day) => day !== value)
      }
      return next
    })
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** Show this field's validator error once it has a value; empty fields wait for submit. */
  function checkField(key: BlurField) {
    if (pending || values[key] === '') return
    const result = validateEventInquiry({ ...values, taproom }, minDate, taproomSlugs)
    const message = result.ok ? undefined : result.errors[key]
    if (message) setFieldErrors((prev) => ({ ...prev, [key]: message }))
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    const submittedValues: EventInquiryInput = {
      ...values,
      taproom,
      // Kept in state so toggling back restores them, but only sent when flexible.
      otherDates: values.flexibleDate ? [...values.otherDates] : [],
    }
    const taproomLabel = taproomOptions.find((option) => option.value === taproom)?.label || ''
    // Keep the resolved taproom stable if the site header changes while sending.
    setValues((prev) => ({ ...prev, taproom }))
    setError(null)
    setFieldErrors({})
    setPending(true)
    try {
      const result = await submitEventInquiry(submittedValues)
      if (result.ok) {
        setSubmitted({ values: submittedValues, taproomLabel })
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
      {submitted ? (
        <Empty role="status">
          <EmptyHeader>
            <EmptyTitle ref={doneTitleRef} tabIndex={-1} className="outline-none">
              Inquiry received
            </EmptyTitle>
            <EmptyDescription>
              {[
                formatInquiryDate(submitted.values),
                submitted.values.startTime
                  ? `${formatTime(submitted.values.startTime)} Eastern`
                  : null,
                submitted.values.headcount ? `${submitted.values.headcount} guests` : null,
                submitted.taproomLabel,
              ]
                .filter(Boolean)
                .join(' · ')}
            </EmptyDescription>
            <EmptyDescription>
              We will email {submitted.values.email || 'you'} within 24 hours about availability.
              Your date is not reserved yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <form
          ref={formRef}
          noValidate
          onSubmit={onSubmit}
          className="relative overflow-visible flex flex-col gap-4"
        >
          <FieldGroup className="overflow-visible p-1 gap-4 sm:gap-5">
            <FieldSet disabled={pending}>
              <FieldLegend>Your event</FieldLegend>
              <FieldGroup className="gap-4 sm:gap-5">
                {/* Side by side even on phones: a guest count needs only a narrow column. */}
                <FieldGroup
                  data-slot="field-row"
                  className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 sm:grid-cols-2 sm:gap-5"
                >
                  <FormField
                    id="inquiry-preferredDate"
                    label="Preferred date"
                    error={fieldErrors.preferredDate}
                  >
                    <DatePicker
                      id="inquiry-preferredDate"
                      disabled={pending}
                      min={minDate}
                      max={minDate && maximumEventDate(minDate)}
                      value={values.preferredDate}
                      onChange={(value) => set('preferredDate', value)}
                    />
                  </FormField>
                  <FormField id="inquiry-headcount" label="Guests" error={fieldErrors.headcount}>
                    {/* Text, not type="number": a scroll wheel over a number field changes it. */}
                    <Input
                      id="inquiry-headcount"
                      name="headcount"
                      inputMode="numeric"
                      placeholder="e.g. 25"
                      onBlur={() => checkField('headcount')}
                      maxLength={String(EVENT_INQUIRY_MAX_HEADCOUNT).length}
                      value={values.headcount}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '')
                        set('headcount', digits === '' ? '' : Number(digits))
                      }}
                      required
                    />
                  </FormField>
                </FieldGroup>
                <Field orientation="horizontal">
                  <Switch
                    id="inquiry-flexibleDate"
                    disabled={pending}
                    // Off: white track, gray outline and knob. On: accent blue, white knob.
                    // Both states clear 3:1 on the card in light and dark themes.
                    className="border data-[state=unchecked]:bg-white data-[state=unchecked]:border-neutral-500/85 dark:data-[state=unchecked]:border-neutral-300 data-[state=checked]:bg-accent [&>span]:bg-white [&>span]:data-[state=unchecked]:ring-1 [&>span]:data-[state=unchecked]:ring-neutral-300"
                    checked={values.flexibleDate}
                    onCheckedChange={(checked) => set('flexibleDate', checked)}
                  />
                  <FieldLabel htmlFor="inquiry-flexibleDate" className="font-normal">
                    My date is flexible
                  </FieldLabel>
                </Field>
                {values.flexibleDate ? (
                  <div
                    role="group"
                    aria-labelledby="inquiry-otherDates-label"
                    className="flex flex-col gap-3"
                  >
                    <p id="inquiry-otherDates-label" className="text-sm font-medium">
                      Other dates that also work
                    </p>
                    <Calendar
                      mode="multiple"
                      disableNavigation={pending}
                      numberOfMonths={calendarMonths}
                      max={EVENT_INQUIRY_MAX_OTHER_DATES}
                      selected={values.otherDates.map(parseLocalDate)}
                      onSelect={(days) => set('otherDates', (days ?? []).map(toDateKey).sort())}
                      today={minDate ? parseLocalDate(minDate) : undefined}
                      defaultMonth={parseLocalDate(
                        values.preferredDate || minDate || toDateKey(new Date()),
                      )}
                      startMonth={minDate ? parseLocalDate(minDate) : undefined}
                      endMonth={minDate ? parseLocalDate(maximumEventDate(minDate)) : undefined}
                      disabled={[
                        pending,
                        ...(minDate
                          ? [
                              { before: parseLocalDate(minDate) },
                              { after: parseLocalDate(maximumEventDate(minDate)) },
                            ]
                          : []),
                        // The preferred date is already the first choice.
                        ...(values.preferredDate ? [parseLocalDate(values.preferredDate)] : []),
                      ]}
                      className="rounded-md border border-muted-foreground/40"
                      // Show one month below lg and three across on larger screens.
                      classNames={{
                        root: 'w-fit lg:w-full',
                        months: 'relative flex flex-col gap-4 lg:flex-row',
                      }}
                    />
                    {values.otherDates.length > 0 ? (
                      <ul
                        aria-label="Other dates picked"
                        className="flex flex-wrap gap-2 list-none p-0 m-0"
                      >
                        {values.otherDates.map((day) => (
                          <li
                            key={day}
                            className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1 text-sm"
                          >
                            {formatDate(day, 'short')}
                            <button
                              type="button"
                              aria-label={`Remove ${formatDate(day, 'full')}`}
                              className="inline-flex size-6 items-center justify-center rounded-full hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() =>
                                set(
                                  'otherDates',
                                  values.otherDates.filter((other) => other !== day),
                                )
                              }
                            >
                              <XIcon className="size-3.5" aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p aria-live="polite" className="text-sm text-muted-foreground">
                      {values.otherDates.length === 0
                        ? `Tap any days that also work, up to ${EVENT_INQUIRY_MAX_OTHER_DATES}.`
                        : `${values.otherDates.length} other ${values.otherDates.length === 1 ? 'date' : 'dates'} picked`}
                    </p>
                    {fieldErrors.otherDates ? (
                      <p className="text-sm text-destructive">{fieldErrors.otherDates}</p>
                    ) : null}
                  </div>
                ) : null}
                <FieldGroup data-slot="field-row" className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                  <FormField
                    id="inquiry-startTime"
                    label="Start time (Eastern)"
                    error={fieldErrors.startTime}
                  >
                    <Select
                      disabled={pending}
                      value={values.startTime}
                      onValueChange={(value) => set('startTime', value)}
                    >
                      <SelectTrigger
                        id="inquiry-startTime"
                        className="w-full"
                        {...formFieldAria('inquiry-startTime', { error: fieldErrors.startTime })}
                      >
                        <SelectValue placeholder="Choose a time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {EVENT_INQUIRY_START_TIMES.map((time) => (
                            <SelectItem key={time} value={time}>
                              {formatTime(time)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField id="inquiry-duration" label="Length" error={fieldErrors.duration}>
                    <SegmentedControl
                      aria-label="Length"
                      className="w-full"
                      options={EVENT_INQUIRY_DURATIONS}
                      value={values.duration}
                      onValueChange={(value) => set('duration', value)}
                    />
                  </FormField>
                </FieldGroup>
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
                    onValueChange={(value) =>
                      set('occasion', value === values.occasion ? '' : value)
                    }
                  />
                </FormField>
              </FieldGroup>
            </FieldSet>
            <FieldSet disabled={pending}>
              <FieldLegend>Drinks &amp; food</FieldLegend>
              <FieldGroup className="gap-4 sm:gap-5">
                <FormField
                  id="inquiry-drinks"
                  label="How will drinks be handled?"
                  error={fieldErrors.drinks}
                >
                  <SegmentedControl
                    aria-label="How will drinks be handled?"
                    className="w-full"
                    options={EVENT_INQUIRY_DRINKS}
                    value={values.drinks}
                    onValueChange={(value) => set('drinks', value)}
                  />
                </FormField>
                <FormField
                  id="inquiry-foodPlan"
                  label="Food plan (optional)"
                  error={fieldErrors.foodPlan}
                >
                  <SegmentedControl
                    aria-label="Food plan (optional)"
                    className="w-full"
                    options={EVENT_INQUIRY_FOOD_PLANS}
                    value={values.foodPlan || undefined}
                    // Tapping the chosen plan again clears it (the field is optional).
                    onValueChange={(value) =>
                      set('foodPlan', value === values.foodPlan ? '' : value)
                    }
                  />
                </FormField>
              </FieldGroup>
            </FieldSet>
            {/* The submit bar sticks to the screen bottom only while this last
                section is on screen: sticky is bounded by this wrapper. */}
            <div className="flex flex-col gap-4 sm:gap-5">
              <FieldSet disabled={pending}>
                <FieldLegend>Contact details</FieldLegend>
                <FieldGroup className="gap-4 sm:gap-5">
                  <FieldGroup className="grid gap-4 sm:grid-cols-2 sm:gap-5">
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
                    <FormField
                      id="inquiry-phone"
                      label="Phone (optional)"
                      error={fieldErrors.phone}
                    >
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
                      id="inquiry-companyName"
                      label="Company name (if a company is paying)"
                      error={fieldErrors.companyName}
                    >
                      <Input
                        id="inquiry-companyName"
                        name="companyName"
                        autoComplete="organization"
                        onBlur={() => checkField('companyName')}
                        value={values.companyName}
                        onChange={(e) => set('companyName', e.target.value)}
                      />
                    </FormField>
                  </FieldGroup>
                  <FormField
                    id="inquiry-message"
                    label="Anything else? (optional)"
                    error={fieldErrors.message}
                  >
                    <Textarea
                      id="inquiry-message"
                      name="message"
                      rows={3}
                      placeholder="Anything we should know"
                      value={values.message}
                      onChange={(e) => set('message', e.target.value)}
                    />
                  </FormField>
                </FieldGroup>
              </FieldSet>
              {/* Full card width (negative margins undo the card and gutter padding)
                with the card background, so fields scroll under it cleanly; the
                button sits in FormField's ring gutter so it lines up with the inputs. */}
              <div className="sticky bottom-0 z-10 -mx-4 bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-7 sm:px-7">
                <div className="w-full p-1 -m-1">
                  <Button type="submit" size="lg" className="w-full" disabled={pending}>
                    {pending ? <Spinner /> : null}
                    {pending ? 'Sending…' : 'Send inquiry'}
                  </Button>
                </div>
              </div>
            </div>
          </FieldGroup>
          <HoneypotField
            value={values.companyUrlHp}
            onChange={(value) => set('companyUrlHp', value)}
          />
          {error ? (
            <Alert ref={errorRef} tabIndex={-1} variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      )}
    </div>
  )
}
