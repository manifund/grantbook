import causeMap from '@/data/cause-area-map.json'

const LABELS: Record<string, string> = (causeMap as never as { labels: Record<string, string> })
  .labels
const FUNDS: Record<string, string> = (causeMap as never as { funds: Record<string, string> }).funds
const KEYWORDS: Record<string, string[]> = (
  causeMap as never as { keywords: Record<string, string[]> }
).keywords
const FALLBACKS: Record<string, string> = (
  causeMap as never as { fallbacks: Record<string, string> }
).fallbacks

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

// Resolve cause slugs for a grant. Precedence: explicit source labels, then
// the fund's default, then keyword classification of the description, then
// 'other'. A fund default of 'keyword' forces classification.
export function classifyCauses(opts: {
  labels?: string[]
  fund?: string
  text?: string
}): string[] {
  const fromLabels = (opts.labels ?? [])
    .map(lookupLabel)
    .filter((slug): slug is string => Boolean(slug))
  if (fromLabels.length > 0) return Array.from(new Set(fromLabels))

  const fundDefault = opts.fund ? FUNDS[opts.fund] : undefined
  if (fundDefault && fundDefault !== 'keyword') return [fundDefault]

  const text = (opts.text ?? '').toLowerCase()
  if (text) {
    for (const [slug, words] of Object.entries(KEYWORDS)) {
      if (words.some((word) => text.includes(word))) return [slug]
    }
  }
  const fallback = opts.fund ? FALLBACKS[opts.fund] : undefined
  return [fallback ?? 'other']
}
