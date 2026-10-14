import { describe, expect, it } from 'vitest'
import { formatPhoneLines, formatPouringNow } from '@/lib/utils/llms-now'
import { getBreweryFAQs } from '@/lib/utils/faq-schema'
import type { PayloadLocation } from '@/lib/types/location'

describe('formatPouringNow', () => {
  it('lists draft, cans, food, and events for each taproom', () => {
    const section = formatPouringNow([
      {
        name: 'Lawrenceville',
        onTap: ['Lupula'],
        cans: ['Wolverine'],
        food: [{ name: 'El Rincon', date: '2026-09-29' }],
        events: [{ name: 'Trivia', date: '2026-10-01' }],
      },
      {
        name: 'Zelienople',
        onTap: [],
        cans: [],
        food: [],
        events: [],
      },
    ])

    expect(section).toContain('## Pouring now')
    expect(section).toContain('### Lawrenceville')
    expect(section).toContain('- On tap: Lupula')
    expect(section).toContain('- Cans to go: Wolverine')
    expect(section).toContain('- Food: 2026-09-29 El Rincon')
    expect(section).toContain('- Events: 2026-10-01 Trivia')
    expect(section).not.toContain('### Zelienople')
  })
})

describe('formatPhoneLines', () => {
  it('uses each location phone and skips a taproom with none', () => {
    const lines = formatPhoneLines([
      { name: 'Lawrenceville', basicInfo: { phone: '(412) 336-8965' } },
      { name: 'Zelienople', basicInfo: { phone: '(724) 609-5100' } },
      { name: 'Empty', basicInfo: { phone: '  ' } },
    ])
    expect(lines).toBe('- Lawrenceville: (412) 336-8965\n- Zelienople: (724) 609-5100')
  })
})

describe('private event FAQ phones', () => {
  it('names every taproom phone from the location documents', () => {
    const answer = getBreweryFAQs([
      {
        name: 'Lawrenceville',
        basicInfo: { phone: '(412) 336-8965' },
      },
      {
        name: 'Zelienople',
        basicInfo: { phone: '(724) 609-5100' },
      },
    ] as PayloadLocation[]).find((faq) => faq.question === 'Can I book a private event?')

    expect(answer?.answer).toContain('Lawrenceville at (412) 336-8965')
    expect(answer?.answer).toContain('Zelienople at (724) 609-5100')
    expect(answer?.answer).toContain('https://lolev.beer/donate')
    expect(answer?.answer).not.toContain('DONATE_URL')
  })
})
