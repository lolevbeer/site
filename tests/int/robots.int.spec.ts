/**
 * robots.txt keeps private/utility paths, and the per-event .ics downloads
 * (no search value, one fetch per event), away from every crawler.
 */
import { describe, expect, it } from 'vitest'
import robots from '@/src/app/robots'

describe('robots', () => {
  it('disallows the per-event calendar.ics route for every rule', () => {
    const rules = robots().rules
    const list = Array.isArray(rules) ? rules : [rules]
    expect(list.length).toBeGreaterThan(1)
    for (const rule of list) {
      expect(rule.disallow).toContain('/events/*/calendar.ics')
      expect(rule.disallow).toContain('/admin')
    }
  })
})
