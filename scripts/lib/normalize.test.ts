import { describe, expect, test } from 'bun:test'
import { normalizeName, slugify } from './normalize'

describe('normalizeName', () => {
  test('case, punctuation, whitespace', () => {
    expect(normalizeName('  Machine  Intelligence Research Institute ')).toBe(
      'machine intelligence research institute'
    )
    expect(normalizeName('Epistea, z.s.')).toBe('epistea z s')
    expect(normalizeName('Ashgro, Inc.')).toBe('ashgro')
  })
  test('diacritics', () => {
    expect(normalizeName('Café Müller')).toBe('cafe muller')
  })
  test('corporate suffixes', () => {
    expect(normalizeName('OpenAI, LLC')).toBe('openai')
    expect(normalizeName('Redwood Research Ltd')).toBe('redwood research')
  })
})

describe('slugify', () => {
  test('kebab-case', () => {
    expect(slugify('Survival and Flourishing Fund')).toBe('survival-and-flourishing-fund')
  })
  test('non-latin names get a stable hash slug', () => {
    expect(slugify('!!!')).toMatch(/^org-[0-9a-f]+$/)
    expect(slugify('הארגון למען קיימות')).toMatch(/^org-[0-9a-f]+$/)
    expect(slugify('הארגון למען קיימות')).toBe(slugify('הארגון למען קיימות'))
  })
})
