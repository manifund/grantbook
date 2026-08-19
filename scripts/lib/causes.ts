import causeMap from '@/data/cause-area-map.json'
import { CAUSE_PARENTS } from '@/utils/cause-tree'

const LABELS: Record<string, string> = (causeMap as never as { labels: Record<string, string> })
  .labels
const FUNDS: Record<string, string> = (causeMap as never as { funds: Record<string, string> }).funds
const KEYWORDS: Record<string, string[]> = (
  causeMap as never as { keywords: Record<string, string[]> }
).keywords
const FALLBACKS: Record<string, string> = (
  causeMap as never as { fallbacks: Record<string, string> }
).fallbacks
const SUBCAUSES: Record<string, Record<string, string[]>> = (
  causeMap as never as { subcauses: Record<string, Record<string, string[]>> }
).subcauses

// Vipul cause areas are hierarchical ("Animal welfare/factory farming/...");
// match the longest known prefix.
function lookupLabel(label: string): string | undefined {
  const trimmed = label.trim()
  const direct = LABELS[trimmed]
  if (direct) return direct
  const parts = trimmed.split('/')
  for (let n = parts.length - 1; n >= 1; n--) {
    const prefix = parts.slice(0, n).join('/')
    if (LABELS[prefix]) return LABELS[prefix]
  }
  return undefined
}

export const CAUSE_SLUGS = [
  'ai-safety',
  'biosecurity',
  'x-risk-other',
  'ea-infrastructure',
  'animal-welfare',
  'global-health-development',
  'other',
]

// Add subcause tags by keyword (evals, interp, policy, fieldbuilding, ...)
// wherever a matched cause has a subcause map, then close the set upward so
// every tag's ancestors are present — that's what makes filtering on any
// level of the tree work.
function refine(slugs: string[], text: string): string[] {
  const out = new Set(slugs)
  for (let changed = true; changed; ) {
    changed = false
    for (const slug of Array.from(out)) {
      const subs = SUBCAUSES[slug]
      if (!subs) continue
      for (const [child, words] of Object.entries(subs)) {
        if (!out.has(child) && words.some((word) => text.includes(word))) {
          out.add(child)
          changed = true
        }
      }
    }
  }
  for (const slug of Array.from(out)) {
    let parent = CAUSE_PARENTS[slug]
    while (parent) {
      out.add(parent)
      parent = CAUSE_PARENTS[parent]
    }
  }
  return Array.from(out)
}

// Resolve cause slugs for a grant. Precedence: explicit source labels, then
// the fund's default, then keyword classification of the description, then
// 'other'. A fund default of 'keyword' forces classification. The result is
// refined with subcause tags and closed over ancestors.
export function classifyCauses(opts: {
  labels?: string[]
  fund?: string
  text?: string
}): string[] {
  const text = (opts.text ?? '').toLowerCase()

  const fromLabels = (opts.labels ?? [])
    .map(lookupLabel)
    .filter((slug): slug is string => Boolean(slug))
  if (fromLabels.length > 0) return refine(Array.from(new Set(fromLabels)), text)

  const fundDefault = opts.fund ? FUNDS[opts.fund] : undefined
  if (fundDefault && fundDefault !== 'keyword') return refine([fundDefault], text)

  if (text) {
    for (const [slug, words] of Object.entries(KEYWORDS)) {
      if (words.some((word) => text.includes(word))) return refine([slug], text)
    }
  }
  const fallback = opts.fund ? FALLBACKS[opts.fund] : undefined
  return refine([fallback ?? 'other'], text)
}
