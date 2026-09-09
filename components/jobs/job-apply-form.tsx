'use client'

/**
 * Apply form for a single opening. Cover letter only — Media does not accept PDFs.
 */

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert, fieldClass } from '@/components/ui/form-field'
import { HoneypotField } from '@/components/ui/honeypot-field'
import { Input } from '@/components/ui/input'
import { submitJobApplication } from '@/src/actions/job-application'
import { emptyJobApplication, type JobApplicationInput } from '@/lib/jobs/application'

export function JobApplyForm({ jobSlug }: { jobSlug: string }) {
  const [values, setValues] = useState<JobApplicationInput>(() => emptyJobApplication(jobSlug))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setValues(emptyJobApplication(jobSlug))
    setError(null)
    setDone(false)
  }, [jobSlug])

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
      <div className="text-center space-y-3 py-8" role="status">
        <h2 className="text-2xl font-semibold">Application received</h2>
        <p className="text-muted-foreground text-pretty max-w-md mx-auto">
          If we want to talk, we will email you. Please do not follow up at the bar.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="relative flex flex-col gap-4 text-left">
      <Field id="name" label="Your name">
        <Input
          id="name"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          required
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
        />
      </Field>
      <Field id="message" label="Why this role?" hint="At least 40 characters.">
        <textarea
          id="message"
          name="message"
          className={fieldClass}
          value={values.message}
          onChange={(e) => set('message', e.target.value)}
          required
          minLength={40}
        />
      </Field>
      <HoneypotField
        value={values.companyUrlHp}
        onChange={(value) => set('companyUrlHp', value)}
      />
      <FormAlert error={error} />
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Submitting…' : 'Submit application'}
        </Button>
      </div>
    </form>
  )
}
