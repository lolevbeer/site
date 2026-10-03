/**
 * Distributor CSV import: the state list, the CSV parser, and the upload endpoint.
 *
 * The format is documented in `public/distributor-csv-import.md`; these
 * tests pin the rules that document promises, so an agent that normalizes raw
 * data to that format gets the behavior the document describes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import type { User } from '@/src/payload-types'
import { CUSTOMER_TYPES, US_STATES, isCustomerType, isStateCode } from '@/lib/distributors/fields'
import { parseDistributorsCsv } from '@/lib/distributors/parse-distributors-csv'

describe('US_STATES', () => {
  it('lists the 50 states plus DC with unique two-letter codes', () => {
    expect(US_STATES).toHaveLength(51)
    expect(new Set(US_STATES.map((s) => s.value)).size).toBe(51)
    for (const { value, label } of US_STATES) {
      expect(value).toMatch(/^[A-Z]{2}$/)
      expect(label.length).toBeGreaterThan(1)
    }
  })

  it('includes every region the importers already write', () => {
    for (const code of ['NY', 'OH', 'PA', 'WV', 'VA', 'DC']) expect(isStateCode(code)).toBe(true)
  })

  it('rejects non-states', () => {
    expect(isStateCode('XX')).toBe(false)
    expect(isStateCode('va')).toBe(false)
    expect(isStateCode('')).toBe(false)
  })
})

describe('CUSTOMER_TYPES', () => {
  it('validates stored values, not admin labels', () => {
    expect(CUSTOMER_TYPES.map((t) => t.value)).toEqual(['Retail', 'On Premise', 'Home-D'])
    expect(isCustomerType('Home-D')).toBe(true)
    expect(isCustomerType('Home Delivery')).toBe(false)
  })
})

describe('parseDistributorsCsv', () => {
  const header = 'name,address,city,state,zip,phone'

  it('parses a clean row', () => {
    const { rows, errors } = parseDistributorsCsv(
      `${header}\nCorks & Kegs,7110 Patterson Ave A,Richmond,VA,23229,(804) 288-0816\n`,
    )
    expect(errors).toEqual([])
    expect(rows).toEqual([
      {
        line: 2,
        name: 'Corks & Kegs',
        address: '7110 Patterson Ave A',
        city: 'Richmond',
        state: 'VA',
        zip: '23229',
        phone: '(804) 288-0816',
        region: 'VA',
      },
    ])
  })

  it('parses the optional columns: region, customerType, website, active', () => {
    const { rows, errors } = parseDistributorsCsv(
      [
        `${header},region,customerType,website,active`,
        'A,1 Main,Alexandria,VA,,,DC,On Premise,https://a.example.com,false',
        'B,2 Main,Richmond,VA,,,,Home-D,,TRUE',
        'C,3 Main,Richmond,VA,,,,,,',
      ].join('\n'),
    )
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      region: 'DC',
      customerType: 'On Premise',
      website: 'https://a.example.com',
      active: false,
    })
    expect(rows[1]).toMatchObject({ region: 'VA', customerType: 'Home-D', active: true })
    // blank optional cells stay unset so a re-import never overwrites with a guess
    expect(rows[1].website).toBeUndefined()
    expect(rows[2].customerType).toBeUndefined()
    expect(rows[2].active).toBeUndefined()
    expect(rows[2].region).toBe('VA')
  })

  it('rejects an unknown customerType, a bad active flag, a bad website, and a bad region', () => {
    const { rows, errors } = parseDistributorsCsv(
      [
        `${header},region,customerType,website,active`,
        'A,1 Main,Richmond,VA,,,,Bar,,',
        'B,2 Main,Richmond,VA,,,,,,maybe',
        'C,3 Main,Richmond,VA,,,,,www.c.example.com,',
        'D,4 Main,Richmond,VA,,,ZZ,,,',
      ].join('\n'),
    )
    expect(rows).toEqual([])
    expect(errors).toEqual([
      { line: 2, message: 'customerType "Bar" must be one of: Retail, On Premise, Home-D' },
      { line: 3, message: 'active "maybe" must be true or false' },
      { line: 4, message: 'website "www.c.example.com" must start with http:// or https://' },
      { line: 5, message: 'region "ZZ" is not a two-letter US state code (uppercase)' },
    ])
  })

  it('accepts columns in any order, any header case, and ignores unknown columns', () => {
    const { rows, errors } = parseDistributorsCsv(
      ' State , NAME ,notes,City,Address\nVA,Planet Wine,hi,Alexandria,2004 Mt Vernon Ave\n',
    )
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      name: 'Planet Wine',
      address: '2004 Mt Vernon Ave',
      city: 'Alexandria',
      state: 'VA',
      zip: '',
      phone: '',
    })
  })

  it('rejects a lowercase state; lowercasing is the normalizer’s job, not the parser’s', () => {
    const { rows, errors } = parseDistributorsCsv(`${header}\nPlanet Wine,1 Main,Alexandria,va,,\n`)
    expect(rows).toEqual([])
    expect(errors).toEqual([
      { line: 2, message: 'state "va" is not a two-letter US state code (uppercase)' },
    ])
  })

  it('fails the whole file when a required column is missing', () => {
    const { rows, errors } = parseDistributorsCsv('name,address,city\nA,1 Main,Richmond\n')
    expect(rows).toEqual([])
    expect(errors).toEqual([{ line: 1, message: 'missing required column(s): state' }])
  })

  it('handles BOM, CRLF, blank lines, and quoted commas', () => {
    const { rows, errors } = parseDistributorsCsv(
      `﻿${header}\r\n\r\n"Smith, Jones & Co",1 Main St,Falls Church,VA,22046,\r\n`,
    )
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: 'Smith, Jones & Co', line: 3 })
  })

  it('reports each bad row with its file line and keeps the good rows', () => {
    const { rows, errors } = parseDistributorsCsv(
      [
        header,
        ',1 Main,Richmond,VA,,',
        'Good Shop,2 Main,Richmond,VA,,',
        'No Address,,Richmond,VA,,',
        'Bad State,3 Main,Richmond,ZZ,,',
        'Bad Zip,4 Main,Richmond,VA,2322,',
      ].join('\n'),
    )
    expect(rows.map((r) => r.name)).toEqual(['Good Shop'])
    expect(errors).toEqual([
      { line: 2, message: 'name is required' },
      { line: 4, message: 'address is required' },
      { line: 5, message: 'state "ZZ" is not a two-letter US state code (uppercase)' },
      { line: 6, message: 'zip "2322" must be 5 digits or ZIP+4' },
    ])
  })

  it('reduces ZIP+4 to five digits and formats ten-digit phones', () => {
    const { rows } = parseDistributorsCsv(
      `${header}\nA,1 Main,Richmond,VA,23229-1234,804.288.0816\nB,2 Main,Richmond,VA,,1-703-533-3030\nC,3 Main,Richmond,VA,,ext 5\n`,
    )
    expect(rows.map((r) => [r.zip, r.phone])).toEqual([
      ['23229', '(804) 288-0816'],
      ['', '(703) 533-3030'],
      ['', 'ext 5'],
    ])
  })

  it('flags a repeated name within the same state, but not across states', () => {
    const { rows, errors } = parseDistributorsCsv(
      `${header}\nSheetz,1 Main,Richmond,VA,,\nSheetz,2 Main,Norfolk,VA,,\nSheetz,3 Main,Erie,PA,,\n`,
    )
    expect(rows.map((r) => [r.name, r.state])).toEqual([
      ['Sheetz', 'VA'],
      ['Sheetz', 'PA'],
    ])
    expect(errors).toEqual([
      { line: 3, message: 'duplicate of line 2: "Sheetz" already appears in VA' },
    ])
  })

  it('reports an empty file', () => {
    expect(parseDistributorsCsv('').errors).toEqual([{ line: 1, message: 'file is empty' }])
    expect(parseDistributorsCsv(`${header}\n`).rows).toEqual([])
  })
})

// ---- endpoint ---------------------------------------------------------------

const getUserFromRequest = vi.fn()
vi.mock('@/src/endpoints/auth-helper', () => ({
  getUserFromRequest: (...args: unknown[]) => getUserFromRequest(...args),
}))
const geocode = vi.fn()
vi.mock('@/src/endpoints/geocode', () => ({ geocode: (...a: unknown[]) => geocode(...a) }))
vi.mock('@/src/utils/async', () => ({ sleep: vi.fn(async () => undefined) }))

const admin: User = {
  id: 'admin-id',
  collection: 'users',
  email: 'admin@example.com',
  roles: ['admin'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const bartender = { ...admin, id: 'b', roles: ['bartender'] } as unknown as User

function csvReq(csv: string | null, user: User | null, existing: unknown[] = []) {
  const payload = {
    find: vi.fn(async () => ({ docs: existing })),
    create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'new', ...args.data })),
    update: vi.fn(async () => ({})),
  }
  const formData = new FormData()
  if (csv !== null) formData.set('file', new File([csv], 'd.csv', { type: 'text/csv' }))
  const req = {
    payload,
    user,
    url: 'http://localhost/api/import-distributors-csv',
    headers: new Headers(),
    formData: async () => formData,
  } as unknown as PayloadRequest
  return { payload, req }
}

async function events(res: Response) {
  const text = await res.text()
  return [...text.matchAll(/event: (\w+)\ndata: (.*)\n/g)].map(([, event, data]) => ({
    event,
    data: JSON.parse(data) as Record<string, unknown>,
  }))
}

describe('importDistributorsCsv endpoint', () => {
  const csv =
    'name,address,city,state,zip,phone\nPlanet Wine,2004 Mt Vernon Ave,Alexandria,VA,22301,703-549-3444\n'

  beforeEach(() => {
    getUserFromRequest.mockReset()
    geocode.mockReset()
    geocode.mockResolvedValue([-77.05, 38.8])
  })

  async function load() {
    return (await import('@/src/endpoints/import-distributors-csv')).importDistributorsCsv
  }

  it('rejects non-admins', async () => {
    const handler = await load()
    const { req, payload } = csvReq(csv, bartender)
    const res = await handler(req)
    expect(res.status).toBe(401)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('reports how many lines failed when no row is valid', async () => {
    const handler = await load()
    const res = await handler(csvReq('name,address,city,state\nA,,X,VA\nB,,Y,VA\n', admin).req)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      errors: 2,
      details: [expect.any(String), expect.any(String)],
    })
  })

  it('400s when no file is uploaded or the header is unusable', async () => {
    const handler = await load()
    expect((await handler(csvReq(null, admin).req)).status).toBe(400)
    const bad = await handler(csvReq('name,address\nA,1 Main\n', admin).req)
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({ error: expect.stringContaining('state') })
  })

  it('creates a geocoded distributor in the row state as the signed-in admin', async () => {
    const handler = await load()
    const { req, payload } = csvReq(csv, admin)
    const evs = await events(await handler(req))
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(payload.create).toHaveBeenCalledWith({
      collection: 'distributors',
      data: {
        name: 'Planet Wine',
        address: '2004 Mt Vernon Ave',
        city: 'Alexandria',
        state: 'VA',
        zip: '22301',
        phone: '(703) 549-3444',
        region: 'VA',
        location: [-77.05, 38.8],
        active: true,
      },
      overrideAccess: false,
      user: admin,
    })
    expect(geocode).toHaveBeenCalledWith('2004 Mt Vernon Ave, Alexandria VA 22301')
    expect(evs.at(-1)).toMatchObject({ event: 'complete', data: { imported: 1, errors: 0 } })
  })

  it('does not create a row it cannot geocode, and says so', async () => {
    geocode.mockResolvedValue(null)
    const handler = await load()
    const { req, payload } = csvReq(csv, admin)
    const evs = await events(await handler(req))
    expect(payload.create).not.toHaveBeenCalled()
    expect(evs.at(-1)).toMatchObject({ event: 'complete', data: { imported: 0, errors: 1 } })
    expect(JSON.stringify(evs.at(-1))).toContain('Could not geocode')
  })

  it('reports parse errors in the summary while importing the good rows', async () => {
    const handler = await load()
    const { req, payload } = csvReq(`${csv}Bad,,Richmond,VA,,\n`, admin)
    const evs = await events(await handler(req))
    expect(payload.create).toHaveBeenCalledTimes(1)
    expect(evs.at(-1)).toMatchObject({ event: 'complete', data: { imported: 1, errors: 1 } })
    expect(JSON.stringify(evs.at(-1))).toContain('Line 3')
  })

  it('updates an existing same-name row in that state instead of duplicating it', async () => {
    const handler = await load()
    const existing = {
      id: 'd1',
      name: 'Planet Wine',
      address: 'Old St',
      city: 'Alexandria',
      state: 'VA',
      zip: '22301',
      phone: '(703) 549-3444',
      region: 'VA',
    }
    const { req, payload } = csvReq(csv, admin, [existing])
    const evs = await events(await handler(req))
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'd1',
        overrideAccess: false,
        user: admin,
        data: expect.objectContaining({ address: '2004 Mt Vernon Ave', location: [-77.05, 38.8] }),
      }),
    )
    expect(evs.at(-1)).toMatchObject({ data: { imported: 0, updated: 1 } })
  })

  it('skips an unchanged existing row', async () => {
    const handler = await load()
    const existing = {
      id: 'd1',
      name: 'Planet Wine',
      address: '2004 Mt Vernon Ave',
      city: 'Alexandria',
      state: 'VA',
      zip: '22301',
      phone: '(703) 549-3444',
      region: 'VA',
    }
    const { req, payload } = csvReq(csv, admin, [existing])
    const evs = await events(await handler(req))
    expect(payload.update).not.toHaveBeenCalled()
    expect(evs.at(-1)).toMatchObject({ data: { skipped: 1 } })
  })

  const full =
    'name,address,city,state,zip,phone,region,customerType,website,active\n' +
    'Planet Wine,2004 Mt Vernon Ave,Alexandria,VA,22301,,DC,On Premise,https://pw.example.com,false\n'

  it('creates with every provided optional field', async () => {
    const handler = await load()
    const { req, payload } = csvReq(full, admin)
    await events(await handler(req))
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          region: 'DC',
          customerType: 'On Premise',
          website: 'https://pw.example.com',
          active: false,
          location: [-77.05, 38.8],
        }),
      }),
    )
  })

  it('updates customerType, website, and active only when the file provides them', async () => {
    const handler = await load()
    const existing = {
      id: 'd1',
      name: 'Planet Wine',
      address: '2004 Mt Vernon Ave',
      city: 'Alexandria',
      state: 'VA',
      zip: '22301',
      phone: '',
      region: 'DC',
      customerType: 'Retail',
      website: '',
      active: true,
    }
    const filled = csvReq(full, admin, [existing])
    await events(await handler(filled.req))
    expect(filled.payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { customerType: 'On Premise', website: 'https://pw.example.com', active: false },
      }),
    )

    // the same row with the optional cells blank changes nothing
    const blank = csvReq(
      'name,address,city,state,zip,phone,region,customerType,website,active\n' +
        'Planet Wine,2004 Mt Vernon Ave,Alexandria,VA,22301,,DC,,,\n',
      admin,
      [existing],
    )
    await events(await handler(blank.req))
    expect(blank.payload.update).not.toHaveBeenCalled()
  })
})
