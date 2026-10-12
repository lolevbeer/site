'use client'

/**
 * Short private-event inquiry form for /events, collapsed behind a
 * "Planning a private event?" disclosure. Submits to the event-inquiries
 * staff inbox (never Events). Server validation errors show under each field
 * and clear when it changes. On success focus moves to the confirmation
 * title and the `event_inquiry_submitted` conversion is sent. Field ids are
 * prefixed `inquiry-` so they cannot collide with other ids on the page.
 */

import React, { useEffect, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { FieldGroup } from '@/components/ui/field'
import { FormField, formFieldAria } from '@/components/ui/form-field'
import { HoneypotField } from '@/components/ui/honeypot-field'
import { Input } from '@/components/ui/input'
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
import { submitEventInquiry } from '@/src/actions/event-inquiry'
import { trackConversion } from '@/lib/analytics/events'
import {
  EVENT_INQUIRY_MAX_HEADCOUNT,
  emptyEventInquiry,
  type EventInquiryErrors,
  type EventInquiryInput,
} from '@/lib/events/inquiry'
import { useTodayEST } from '@/lib/hooks/use-today-est'

export function EventInquiryForm({
  taprooms,
}: {
  taprooms: Array<{ id: string; slug?: string | null; name?: string | null }>
}) {
  const [values, setValues] = useState<EventInquiryInput>(emptyEventInquiry)
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

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setError(null)
    setFieldErrors({})
    setPending(true)
    try {
      const result = await submitEventInquiry(values)
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
    <details className="mx-auto max-w-md text-left">
      <summary className="cursor-pointer text-center text-sm font-medium underline-offset-4 hover:underline">
        Planning a private event?
      </summary>
      <div className="pt-6">
        {done ? (
          <Empty role="status">
            <EmptyHeader>
              <EmptyTitle ref={doneTitleRef} tabIndex={-1} className="outline-none">
                Inquiry received
              </EmptyTitle>
              <EmptyDescription>We will email or call you about availability.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <form noValidate onSubmit={onSubmit} className="relative overflow-visible flex flex-col gap-4">
            <FieldGroup className="overflow-visible p-1">
              <FormField id="inquiry-name" label="Your name" error={fieldErrors.name}>
                <Input
                  id="inquiry-name"
                  name="name"
                  autoComplete="name"
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
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                  required
                />
              </FormField>
              <FormField id="inquiry-phone" label="Phone" error={fieldErrors.phone}>
                <Input
                  id="inquiry-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  required
                />
              </FormField>
              <FormField
                id="inquiry-preferredDate"
                label="Preferred date"
                error={fieldErrors.preferredDate}
              >
                <Input
                  id="inquiry-preferredDate"
                  name="preferredDate"
                  type="date"
                  min={minDate}
                  value={values.preferredDate}
                  onChange={(e) => set('preferredDate', e.target.value)}
                  required
                />
              </FormField>
              <FormField id="inquiry-headcount" label="How many guests?" error={fieldErrors.headcount}>
                <Input
                  id="inquiry-headcount"
                  name="headcount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={EVENT_INQUIRY_MAX_HEADCOUNT}
                  value={values.headcount}
                  onChange={(e) =>
                    set('headcount', e.target.value === '' ? '' : Number(e.target.value))
                  }
                  required
                />
              </FormField>
              <FormField id="inquiry-taproom" label="Taproom" error={fieldErrors.taproom}>
                <Select
                  value={values.taproom || undefined}
                  onValueChange={(value) => set('taproom', value)}
                >
                  <SelectTrigger
                    id="inquiry-taproom"
                    className="w-full"
                    aria-required
                    {...formFieldAria('inquiry-taproom', { error: fieldErrors.taproom })}
                  >
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {taprooms
                        .filter((location) => location.slug)
                        .map((location) => (
                          <SelectItem key={location.id} value={location.slug as string}>
                            {location.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                id="inquiry-message"
                label="Anything else?"
                hint="Optional. The occasion, timing, food, and so on."
                error={fieldErrors.message}
              >
                <Textarea
                  id="inquiry-message"
                  name="message"
                  value={values.message}
                  onChange={(e) => set('message', e.target.value)}
                />
              </FormField>
            </FieldGroup>
            <HoneypotField value={values.companyUrlHp} onChange={(value) => set('companyUrlHp', value)} />
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner /> : null}
                {pending ? 'Sending…' : 'Send inquiry'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </details>
  )
}
