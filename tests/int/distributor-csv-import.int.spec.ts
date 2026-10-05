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

describe('Distributors collection', () => {
  async function field(name: string) {
    const { Distributors } = await import('@/src/collections/Distributors')
    return Distributors.fields.find((f) => 'name' in f && f.name === name) as {
      defaultValue?: unknown
      validate?: (value: unknown) => true | string
    }
  }

  it('rejects a website without http(s) on every write path, and allows blank', async () => {
    const { validate } = await field('website')
    expect(validate!('www.example.com')).toMatch(/http/)
    expect(validate!('https://example.com')).toBe(true)
    expect(validate!('')).toBe(true)
    expect(validate!(null)).toBe(true)
  })

  it('has no default region, so a manual entry must pick its state', async () => {
    expect((await field('region')).defaultValue).toBeUndefined()
  })

  it('validates country as an ISO-2 code on every write path, and allows blank (= US)', async () => {
    const { validate } = await field('country')
    expect(validate!('NL')).toBe(true)
    expect(validate!('US')).toBe(true)
    expect(validate!('')).toBe(true)
    expect(validate!(null)).toBe(true)
    expect(validate!('Netherlands')).toMatch(/two-letter/)
    expect(validate!('nl')).toMatch(/two-letter/)
    expect(validate!('ZZ')).toMatch(/two-letter/)
  })

  it('does not require region, so a non-US venue saves without one', async () => {
    const { Distributors } = await import('@/src/collections/Distributors')
    const region = Distributors.fields.find((f) => 'name' in f && f.name === 'region') as {
      required?: boolean
    }
    expect(region.required).toBeFalsy()
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
      {
        line: 2,
        message:
          'state "va" is not a two-letter US state code (uppercase); for a non-US venue, fill the country column',
      },
    ])
  })

  it('fails the whole file when a required column is missing', () => {
    const { rows, errors } = parseDistributorsCsv('name,city,state\nA,Richmond,VA\n')
    expect(rows).toEqual([])
    expect(errors).toEqual([{ line: 1, message: 'missing required column(s): address' }])
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
      {
        line: 5,
        message:
          'state "ZZ" is not a two-letter US state code (uppercase); for a non-US venue, fill the country column',
      },
      { line: 6, message: 'zip "2322" must be 5 digits or ZIP+4' },
    ])
  })

  describe('latitude and longitude', () => {
    const geo = 'name,address,city,state,zip,phone,latitude,longitude\n'

    it('keeps a valid pair as a [longitude, latitude] location', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${geo}BeerTemple,250 Nieuwezijds Voorburgwal,Amsterdam,,,,52.3719711,4.8903227\n`,
      )
      expect(errors).toEqual([])
      expect(rows[0].location).toEqual([4.8903227, 52.3719711])
    })

    it('leaves location unset when both cells are blank', () => {
      const { rows } = parseDistributorsCsv(`${geo}A,1 Main,Richmond,VA,,,,\n`)
      expect(rows[0].location).toBeUndefined()
    })

    it('rejects half a pair, a non-number, and an out-of-range value', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${geo}A,1 Main,X,,,,52.37,\nB,2 Main,X,,,,north,4.89\nC,3 Main,X,,,,91,4.89\nD,4 Main,X,,,,52.37,181\n`,
      )
      expect(rows).toEqual([])
      const both = 'latitude and longitude must both be given, or both left blank'
      expect(errors).toEqual([
        { line: 2, message: both },
        { line: 3, message: 'latitude "north" must be a number from -90 to 90' },
        { line: 4, message: 'latitude "91" must be a number from -90 to 90' },
        { line: 5, message: 'longitude "181" must be a number from -180 to 180' },
      ])
    })
  })

  describe('country', () => {
    const intl = 'name,address,city,state,zip,phone,country,region'

    it('accepts the shape of the international file: blank city and state, no country', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${intl}\nCraft Metropolis,47 High Street,Penge,,,,,\nFritz Fritz,255 Jeonpo,,,,,,\n`,
      )
      expect(errors).toEqual([])
      expect(rows).toHaveLength(2)
      // blank cells stay unset so a re-import never clears a value the geocoder filled
      expect(rows[0]).toMatchObject({ city: 'Penge' })
      expect(rows[0].state).toBeUndefined()
      expect(rows[0].country).toBeUndefined()
      expect(rows[0].region).toBeUndefined()
      expect(rows[1].city).toBeUndefined()
    })

    it('keeps a non-US state, zip, and phone as free text and gives it no region', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${intl}\nBeerTemple,250 Nieuwezijds Voorburgwal,Amsterdam,Noord-Holland,1012 RR,+31 20 626 6544,NL,\n`,
      )
      expect(errors).toEqual([])
      expect(rows[0]).toMatchObject({
        country: 'NL',
        state: 'Noord-Holland',
        zip: '1012 RR',
        phone: '+31 20 626 6544',
      })
      expect(rows[0].region).toBeUndefined()
    })

    it('treats a blank country with a long state as a non-US venue to be located', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${intl}\nPub Kultainen Apina,Insinöörinkatu 30,Tampere,Pirkanmaa,,,,\n`,
      )
      expect(errors).toEqual([])
      expect(rows[0]).toMatchObject({ state: 'Pirkanmaa' })
      expect(rows[0].region).toBeUndefined()
    })

    it('keeps every US rule for a US row, with or without an explicit US country', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${intl}\nA,1 Main,Richmond,VA,23229-1234,804.288.0816,,\nB,2 Main,Richmond,VA,,1-703-533-3030,US,\n`,
      )
      expect(errors).toEqual([])
      expect(rows.map((r) => [r.region, r.zip, r.phone])).toEqual([
        ['VA', '23229', '(804) 288-0816'],
        ['VA', '', '(703) 533-3030'],
      ])
    })

    it('accepts an explicit US row with a blank state, but not one with a non-code state', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${intl}\nA,1 Main,Richmond,,,,US,\nB,2 Main,Richmond,Virginia,,,US,\n`,
      )
      expect(rows.map((r) => r.name)).toEqual(['A'])
      expect(errors).toEqual([
        { line: 3, message: 'state "Virginia" is not a two-letter US state code (uppercase)' },
      ])
    })

    it('accepts a US row with no city, to be filled in', () => {
      const { rows, errors } = parseDistributorsCsv(`${intl}\nA,1 Main,,VA,,,,\n`)
      expect(errors).toEqual([])
      expect(rows[0].city).toBeUndefined()
      expect(rows[0].region).toBe('VA')
    })

    it('rejects a Canadian province with no country, because a two-letter code is ambiguous', () => {
      const { rows, errors } = parseDistributorsCsv(`${intl}\nA,1 Rue Main,Montréal,QC,,,,\n`)
      expect(rows).toEqual([])
      expect(errors).toEqual([
        {
          line: 2,
          message:
            'state "QC" is not a two-letter US state code (uppercase); for a non-US venue, fill the country column',
        },
      ])
    })

    it('rejects a country that is not an uppercase ISO code', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${intl}\nA,1 Main,Penge,,,,nl,\nB,2 Main,Penge,,,,Netherlands,\nC,3 Main,Penge,,,,ZZ,\n`,
      )
      expect(rows).toEqual([])
      const expected = (v: string) =>
        `country "${v}" must be an uppercase two-letter ISO code, e.g. NL, JP, GB`
      expect(errors).toEqual([
        { line: 2, message: expected('nl') },
        { line: 3, message: expected('Netherlands') },
        { line: 4, message: expected('ZZ') },
      ])
    })

    it('rejects a region on a non-US row, since region is US-only', () => {
      const { rows, errors } = parseDistributorsCsv(`${intl}\nA,1 Main,Berlin,,,,DE,DE\n`)
      expect(rows).toEqual([])
      expect(errors).toEqual([
        { line: 2, message: 'region "DE" applies to US venues only; leave it blank for DE' },
      ])
    })

    it('keeps Germany apart from Delaware when flagging duplicates', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${intl}\nBrew,1 Main,Wilmington,DE,,,,\nBrew,2 Strasse,Berlin,,,,DE,\nBrew,3 Strasse,Munich,,,,DE,\n`,
      )
      expect(rows.map((r) => [r.name, r.region ?? r.country])).toEqual([
        ['Brew', 'DE'],
        ['Brew', 'DE'],
      ])
      expect(errors).toEqual([
        { line: 4, message: 'duplicate of line 3: "Brew" already appears in DE' },
      ])
    })

    it('compares rows with no known group by name and address', () => {
      const { rows, errors } = parseDistributorsCsv(
        `${intl}\nBar,1 High St,Penge,,,,,\nBar,2 High St,Penge,,,,,\nBar,1 High St,Penge,,,,,\n`,
      )
      expect(rows.map((r) => r.address)).toEqual(['1 High St', '2 High St'])
      expect(errors).toEqual([
        {
          line: 4,
          message: 'duplicate of line 2: "Bar" already appears at the same address',
        },
      ])
    })
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
const geocodeDistributor = vi.fn()
const resolveDistributor = vi.fn()
const reverseDistributor = vi.fn()
vi.mock('@/src/endpoints/geocode', () => ({
  geocodeDistributor: (...a: unknown[]) => geocodeDistributor(...a),
  resolveDistributor: (...a: unknown[]) => resolveDistributor(...a),
  reverseDistributor: (...a: unknown[]) => reverseDistributor(...a),
}))

const admin: User = {
  id: 'admin-id',
  collection: 'users',
  email: 'admin@example.com',
  roles: ['admin'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
const bartender = { ...admin, id: 'b', roles: ['bartender'] } as unknown as User

function csvReq(
  csv: string | null,
  user: User | null,
  existing: unknown[] = [],
  fields: Record<string, string> = {},
) {
  const payload = {
    find: vi.fn(async () => ({ docs: existing })),
    create: vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 'new', ...args.data })),
    update: vi.fn(async () => ({})),
  }
  const formData = new FormData()
  if (csv !== null) formData.set('file', new File([csv], 'd.csv', { type: 'text/csv' }))
  for (const [k, v] of Object.entries(fields)) formData.set(k, v)
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
    geocodeDistributor.mockReset()
    geocodeDistributor.mockResolvedValue([-77.05, 38.8])
    resolveDistributor.mockReset()
    reverseDistributor.mockReset()
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
    const bad = await handler(csvReq('name,city\nA,Richmond\n', admin).req)
    expect(bad.status).toBe(400)
    expect(await bad.json()).toMatchObject({ error: expect.stringContaining('address') })
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
    expect(geocodeDistributor).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '2004 Mt Vernon Ave',
        city: 'Alexandria',
        state: 'VA',
        zip: '22301',
      }),
    )
    expect(evs.at(-1)).toMatchObject({ event: 'complete', data: { imported: 1, errors: 0 } })
  })

  it('does not create a row it cannot geocode, and says so', async () => {
    geocodeDistributor.mockResolvedValue(null)
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

  describe('international rows', () => {
    const intl = 'name,address,city,state,zip,phone,country\n'
    const amsterdam = {
      coords: [4.89, 52.37],
      parts: { city: 'Amsterdam', state: 'North Holland', zip: '1012 RR', country: 'NL' },
      source: 'Mapbox',
      uncertain: false,
    }

    it('creates a non-US row with its country, filled blanks, and no region', async () => {
      resolveDistributor.mockResolvedValue(amsterdam)
      const handler = await load()
      const { req, payload } = csvReq(`${intl}BeerTemple,Nieuwezijds Voorburgwal 250,,,,,\n`, admin)
      const evs = await events(await handler(req))
      expect(payload.create).toHaveBeenCalledWith({
        collection: 'distributors',
        data: {
          name: 'BeerTemple',
          address: 'Nieuwezijds Voorburgwal 250',
          city: 'Amsterdam',
          state: 'North Holland',
          zip: '1012 RR',
          country: 'NL',
          phone: '',
          location: [4.89, 52.37],
          active: true,
        },
        overrideAccess: false,
        user: admin,
      })
      expect(geocodeDistributor).not.toHaveBeenCalled()
      const text = JSON.stringify(evs)
      expect(text).toContain('Imported: BeerTemple')
      expect(text).toContain('Amsterdam')
      expect(text).toContain('inferred: city, state, country, zip')
      expect(evs.at(-1)).toMatchObject({ data: { imported: 1, errors: 0 } })
    })

    it('never overwrites a city the CSV supplied', async () => {
      resolveDistributor.mockResolvedValue({
        ...amsterdam,
        parts: { ...amsterdam.parts, city: 'London' },
      })
      const handler = await load()
      const { req, payload } = csvReq(`${intl}Craft Metropolis,47 High Street,Penge,,,,\n`, admin)
      await events(await handler(req))
      expect(payload.create.mock.calls[0][0].data).toMatchObject({ city: 'Penge' })
    })

    it('flags an uncertain match for review', async () => {
      resolveDistributor.mockResolvedValue({ ...amsterdam, uncertain: true })
      const handler = await load()
      const evs = await events(await handler(csvReq(`${intl}Fritz,255 Jeonpo,,,,,\n`, admin).req))
      expect(JSON.stringify(evs)).toContain('check this')
    })

    it('does not create a row it cannot locate, and says so', async () => {
      resolveDistributor.mockResolvedValue(null)
      const handler = await load()
      const { req, payload } = csvReq(`${intl}Nowhere,1 Nowhere,,,,,\n`, admin)
      const evs = await events(await handler(req))
      expect(payload.create).not.toHaveBeenCalled()
      expect(evs.at(-1)).toMatchObject({ data: { imported: 0, errors: 1 } })
      expect(JSON.stringify(evs)).toContain('Could not geocode')
    })

    it('matches an existing row by name within its country, not a US state with the same code', async () => {
      resolveDistributor.mockResolvedValue({
        ...amsterdam,
        parts: { city: 'Berlin', country: 'DE' },
      })
      const handler = await load()
      const delaware = { id: 'us', name: 'Brew', address: '1 Main', region: 'DE', state: 'DE' }
      const germany = {
        id: 'de',
        name: 'Brew',
        address: '2 Strasse',
        city: 'Berlin',
        country: 'DE',
        phone: '',
        zip: '',
      }
      const { req, payload } = csvReq(`${intl}Brew,2 Strasse,Berlin,,,,DE\n`, admin, [
        delaware,
        germany,
      ])
      const evs = await events(await handler(req))
      expect(payload.create).not.toHaveBeenCalled()
      expect(payload.update).not.toHaveBeenCalled()
      expect(evs.at(-1)).toMatchObject({ data: { skipped: 1, errors: 0 } })
    })

    it('flags two rows that resolve to the same venue in the same country', async () => {
      resolveDistributor.mockResolvedValue(amsterdam)
      const handler = await load()
      const { req, payload } = csvReq(`${intl}Bar,1 Dam,,,,,\nBar,2 Dam,,,,,\n`, admin)
      const evs = await events(await handler(req))
      expect(payload.create).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(evs)).toContain('duplicate of line 2')
    })
  })

  describe('dry run', () => {
    it('reports what would happen and writes nothing', async () => {
      resolveDistributor.mockResolvedValue({
        coords: [4.89, 52.37],
        parts: { city: 'Amsterdam', country: 'NL' },
        source: 'Mapbox',
        uncertain: false,
      })
      const handler = await load()
      const { req, payload } = csvReq(
        `${csv}BeerTemple,Nieuwezijds Voorburgwal 250,,,,\n`,
        admin,
        [],
        { dryRun: 'true' },
      )
      const evs = await events(await handler(req))
      expect(payload.create).not.toHaveBeenCalled()
      expect(payload.update).not.toHaveBeenCalled()
      const text = JSON.stringify(evs)
      expect(text).toContain('Would import: Planet Wine')
      expect(text).toContain('Would import: BeerTemple')
      expect(text).toContain('Amsterdam, Netherlands')
      expect(evs.at(-1)).toMatchObject({ data: { imported: 2, dryRun: true } })
    })

    it('reports a would-be update without writing it', async () => {
      const handler = await load()
      const existing = {
        id: 'd1',
        name: 'Planet Wine',
        address: 'Old St',
        region: 'VA',
        state: 'VA',
      }
      const { req, payload } = csvReq(csv, admin, [existing], { dryRun: 'true' })
      const evs = await events(await handler(req))
      expect(payload.update).not.toHaveBeenCalled()
      expect(geocodeDistributor).not.toHaveBeenCalled()
      expect(JSON.stringify(evs)).toContain('Would update: \\"Planet Wine\\"')
      expect(evs.at(-1)).toMatchObject({ data: { updated: 1, dryRun: true } })
    })
  })

  describe('rows with coordinates', () => {
    const geo = 'name,address,city,state,zip,phone,latitude,longitude\n'

    it('keeps the file pin and fills blanks from a reverse lookup', async () => {
      reverseDistributor.mockResolvedValue({
        coords: [0, 0],
        parts: { city: 'Amsterdam', state: 'North Holland', country: 'NL' },
        source: 'Mapbox',
        uncertain: false,
      })
      const handler = await load()
      const { req, payload } = csvReq(
        `${geo}BeerTemple,250 Nieuwezijds Voorburgwal,Amsterdam,,,,52.3719711,4.8903227\n`,
        admin,
      )
      await events(await handler(req))
      expect(reverseDistributor).toHaveBeenCalledWith([4.8903227, 52.3719711])
      expect(resolveDistributor).not.toHaveBeenCalled()
      expect(payload.create.mock.calls[0][0].data).toMatchObject({
        city: 'Amsterdam',
        state: 'North Holland',
        country: 'NL',
        location: [4.8903227, 52.3719711],
      })
    })

    it('still imports with the file pin when the reverse lookup finds nothing', async () => {
      reverseDistributor.mockResolvedValue(null)
      const handler = await load()
      const { req, payload } = csvReq(`${geo}Bar,1 Dam,Amsterdam,,,,52.37,4.89\n`, admin)
      const evs = await events(await handler(req))
      expect(payload.create.mock.calls[0][0].data).toMatchObject({ location: [4.89, 52.37] })
      expect(evs.at(-1)).toMatchObject({ data: { imported: 1, errors: 0 } })
    })

    it('does not look anything up for a complete US row with coordinates', async () => {
      const handler = await load()
      const { req, payload } = csvReq(`${geo}Shop,1 Main,Richmond,VA,,,37.5,-77.4\n`, admin)
      await events(await handler(req))
      expect(reverseDistributor).not.toHaveBeenCalled()
      expect(geocodeDistributor).not.toHaveBeenCalled()
      expect(payload.create.mock.calls[0][0].data).toMatchObject({ location: [-77.4, 37.5] })
    })
  })

  describe('lookup concurrency', () => {
    it('locates several rows at once but reports them in file order', async () => {
      let inFlight = 0
      let peak = 0
      resolveDistributor.mockImplementation(async (row: { address: string }) => {
        inFlight++
        peak = Math.max(peak, inFlight)
        // later rows answer first, to prove order comes from the file, not the network
        await new Promise((r) => setTimeout(r, 40 - Number(row.address.split(' ')[0]) * 5))
        inFlight--
        return {
          coords: [4.89, 52.37],
          parts: { city: 'Amsterdam', country: 'NL' },
          source: 'Mapbox',
          uncertain: false,
        }
      })
      const handler = await load()
      const csvText =
        'name,address,city,state,zip,phone,country\n' +
        [1, 2, 3, 4, 5, 6].map((n) => `Bar ${n},${n} Dam,,,,,`).join('\n') +
        '\n'
      const { req, payload } = csvReq(csvText, admin)
      await events(await handler(req))
      expect(peak).toBeGreaterThan(1)
      expect(peak).toBeLessThanOrEqual(4)
      expect(payload.create.mock.calls.map((c) => c[0].data.name)).toEqual([
        'Bar 1',
        'Bar 2',
        'Bar 3',
        'Bar 4',
        'Bar 5',
        'Bar 6',
      ])
    })
  })
})
