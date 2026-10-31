/**
 * Job apply validation (required fields, honeypot, length cap) and the staff review status.
 */
import { describe, expect, it, vi } from 'vitest'
import type { SelectField } from 'payload'
import type { MigrateUpArgs } from '@payloadcms/db-mongodb'
import { emptyJobApplication, validateJobApplication } from '@/lib/jobs/application'
import { adminAccess } from '@/src/access/roles'
import { JobApplications } from '@/src/collections/JobApplications'
import { up } from '@/src/migrations/20261031_160000_job_application_status'

function valid() {
  return {
    ...emptyJobApplication('bartender'),
    name: 'Alex Rivera',
    email: 'alex@example.com',
    phone: '412-555-0100',
    message: 'I have poured at two taprooms and want to work nights on Butler Street.',
  }
}

describe('validateJobApplication', () => {
  it('accepts a complete application', () => {
    expect(validateJobApplication(valid())).toEqual({ ok: true, spam: false })
  })

  it('rejects a short note', () => {
    const result = validateJobApplication({ ...valid(), message: 'Hi' })
    expect(result.ok).toBe(false)
  })

  it('treats a filled honeypot as silent spam', () => {
    expect(validateJobApplication({ ...valid(), companyUrlHp: 'https://spam.test' })).toEqual({
      ok: true,
      spam: true,
    })
  })

  it('rejects a non-object payload without throwing', () => {
    expect(validateJobApplication(null).ok).toBe(false)
  })
})

describe('JobApplications review status', () => {
  const status = JobApplications.fields.find(
    (field) => 'name' in field && field.name === 'status',
  ) as SelectField | undefined

  it('defaults new submissions to new, with new and reviewed options', () => {
    expect(status?.type).toBe('select')
    expect(status?.defaultValue).toBe('new')
    expect(status?.options).toEqual([
      { label: 'New', value: 'new' },
      { label: 'Reviewed', value: 'reviewed' },
    ])
    expect(status?.admin?.position).toBe('sidebar')
  })

  it('shows status in the list view', () => {
    expect(JobApplications.admin?.defaultColumns).toContain('status')
  })

  it('leaves updates to the collection rule (admins only)', () => {
    expect(status?.access).toBeUndefined()
    expect(JobApplications.access?.update).toBe(adminAccess)
  })
})

describe('job application status migration', () => {
  it('marks only applications without a status as reviewed', async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 2 })
    const payload = { db: { collections: { 'job-applications': { collection: { updateMany } } } } }
    await up({ payload } as unknown as MigrateUpArgs)
    expect(updateMany).toHaveBeenCalledOnce()
    expect(updateMany).toHaveBeenCalledWith(
      { status: { $exists: false } },
      { $set: { status: 'reviewed' } },
    )
  })
})
