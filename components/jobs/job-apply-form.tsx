'use client'

/**
 * Apply form for a single opening. Cover letter only — Media does not accept PDFs.
 * Remount with `key={job.slug}` when the opening changes so form state resets.
 */

import React, { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { FieldGroup } from '@/components/ui/field'
import { FormField } from '@/components/ui/form-field'
import { HoneypotField } from '@/components/ui/honeypot-field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { submitJobApplication } from '@/src/actions/job-application'
import { emptyJobApplication, type JobApplicationInput } from '@/lib/jobs/application'

export function JobApplyForm({ jobSlug }: { jobSlug: string }) {
  const [values, setValues] = useState<JobApplicationInput>(() => emptyJobApplication(jobSlug))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  function set<K extends keyof JobApplicationInput>(key: K, value: JobApplicationInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setError(null)
    setPending(true)
    try {
      const result = await submitJobApplication(values)
      if (result.ok) setDone(true)
      else setError(result.error)
    } catch {
      setError('Could not submit the application. Try again in a minute.')
    } finally {
      setPending(false)
    }
  }

  if (done) {
    return (
      <Empty role="status">
        <EmptyHeader>
          <EmptyTitle>Application received</EmptyTitle>
          <EmptyDescription>
            If we want to talk, we will email you. Please do not follow up at the bar.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <form noValidate onSubmit={onSubmit} className="relative overflow-visible flex flex-col gap-4 text-left">
      <FieldGroup className="overflow-visible p-1">
        <FormField id="name" label="Your name">
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </FormField>
        <FormField id="email" label="Email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
        </FormField>
        <FormField id="phone" label="Phone">
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
          />
        </FormField>
        <FormField id="message" label="Why this role?" hint="At least 40 characters.">
          <Textarea
            id="message"
            name="message"
            value={values.message}
            onChange={(e) => set('message', e.target.value)}
            required
            minLength={40}
          />
        </FormField>
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
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          {pending ? 'Submitting…' : 'Submit application'}
        </Button>
      </div>
    </form>
  )
}
