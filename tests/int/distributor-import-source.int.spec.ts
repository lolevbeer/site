import { expect, it } from 'vitest'
import {
  isDistributorImportUrl,
  validateDistributorImportUrl,
} from '@/lib/distributors/import-source'

it.each(['https://sixthcity.encompass8.com/report?key=example', 'https://encompass8.com/report'])(
  'allows supported vendor URL %s',
  (url) => expect(isDistributorImportUrl(url)).toBe(true),
)
it.each([
  'http://sixthcity.encompass8.com',
  'https://127.0.0.1',
  'https://localhost',
  'https://encompass8.com.attacker.test',
  'https://encompass8.com@attacker.test',
  'https://user:password@encompass8.com',
  'https://encompass8.com:8443',
  'file:///tmp/data',
  'invalid',
])('rejects %s', (url) => expect(isDistributorImportUrl(url)).toBe(false))
it('allows clearing the stored source', () => expect(validateDistributorImportUrl('')).toBe(true))
