'use client'

/**
 * Three-page donation ringer. Page 1 is eligibility, page 2 is the
 * organization, page 3 is the event and the ask. Server action re-checks every
 * rule; this UI just keeps people from discovering them at submit.
 */

import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { submitDonationRequest } from '@/src/actions/donation-request'
import { useLocationContext } from '@/components/location/location-provider'
import {
  donationStepErrors,
  emptyDonationRequest,
  page1Gates,
  type DonationRequestErrors,
  type DonationRequestInput,
} from '@/lib/donate/donation-request'
import { firstFieldError } from '@/lib/public-forms/fields'
import { AskStep } from './ask-step'
import { EligibilityStep } from './eligibility-step'
import { OrganizationStep } from './organization-step'

export function DonationRequestForm() {
  const { locations } = useLocationContext()
  const taprooms = locations.filter((location) => location.active !== false && location.slug)
  const gates = page1Gates(taprooms)
  const [step, setStep] = useState(1)
  const [values, setValues] = useState<DonationRequestInput>(emptyDonationRequest)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<DonationRequestErrors>({})
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const panelRef = useRef<HTMLFieldSetElement>(null)
  const step1Complete = gates.every((gate) => values[gate.key] === true)

  useEffect(() => {
    panelRef.current?.focus()
  }, [step])

  function set<K extends keyof DonationRequestInput>(key: K, value: DonationRequestInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function goTo(next: 1 | 2 | 3) {
    if (next === 2 && !step1Complete) return
    if (next === 3) {
      const errors = donationStepErrors(2, values)
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        setError(firstFieldError(errors))
        return
      }
    }
    setFieldErrors({})
    setError(null)
    setStep(next)
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setError(null)
    setPending(true)
    try {
      const result = await submitDonationRequest(values)
      if (result.ok) setDone(true)
      else {
        setError(result.error)
        if (result.step) setStep(result.step)
      }
    } catch {
      setError('Could not submit the request. Try again in a minute.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <Empty role="status">
        <EmptyHeader>
          <EmptyTitle>We got it</EmptyTitle>
          <EmptyDescription>
            If we can help, we will email you. Completing this form is not a yes — please do not
            follow up by phone, Instagram, or at the bar.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="relative overflow-visible flex flex-col gap-8 text-left"
    >
      <ol className="flex justify-center gap-6 text-sm">
        {['Eligibility', 'Organization', 'The ask'].map((label, index) => {
          const n = index + 1
          return (
            <li
              key={label}
              aria-current={n === step ? 'step' : undefined}
              className={cn(
                'tabular-nums',
                n === step ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {n}. {label}
            </li>
          )
        })}
      </ol>

      {step === 1 ? (
        <EligibilityStep
          panelRef={panelRef}
          gates={gates}
          values={values}
          set={set}
          canContinue={step1Complete}
          onContinue={() => goTo(2)}
        />
      ) : null}
      {step === 2 ? (
        <OrganizationStep
          panelRef={panelRef}
          values={values}
          set={set}
          error={error}
          fieldErrors={fieldErrors}
          onBack={() => goTo(1)}
          onContinue={() => goTo(3)}
        />
      ) : null}
      {step === 3 ? (
        <AskStep
          panelRef={panelRef}
          values={values}
          set={set}
          taprooms={taprooms}
          error={error}
          fieldErrors={fieldErrors}
          pending={pending}
          onBack={() => goTo(2)}
        />
      ) : null}
    </form>
  )
}
