// Reports likely duplicate org pairs for the aliases.json curation loop.
// Signals, strongest first:
//   paren  — names equal once trailing "(...)"/"[...]" are stripped
//   abbrev — one name is the initials of the other
//   subset — one name's tokens are contained in the other's
//   fuzzy  — token Jaccard similarity >= threshold
// Resolve by adding `"<dupe name>": "<canonical slug>"` to data/aliases.json
// and re-running `bun run seed`.
import { createAdminClient } from '@/db/supabase-admin'
import { normalizeName } from './lib/normalize'

const JACCARD_THRESHOLD = 0.72
const STOPWORDS = new Set(['the', 'of', 'for', 'and', 'a', 'an', 'in', 'on'])

type Org = {
  id: string
  slug: string
  name: string
  needs_review: boolean
  grants: number
  usd: number
}

function stripParens(name: string): string {
  return name
    .replace(/\s*[([][^)\]]*[)\]]\s*$/g, '')
    .replace(/\s*[([][^)\]]*[)\]]\s*$/g, '')
    .trim()
}

function tokens(name: string): Set<string> {
  return new Set(
    normalizeName(name)
      .split(' ')
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  )
}

function initials(name: string): string {
  return normalizeName(name)
    .split(' ')
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => t[0])
    .join('')
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

async function main() {
  const db = createAdminClient()
  const orgs: Org[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from('orgs')
      .select('id, slug, name, needs_review')
      .range(from, from + 999)
      .throwOnError()
    for (const o of data ?? []) orgs.push({ ...o, grants: 0, usd: 0 })
    if (!data || data.length < 1000) break
  }
  const byId = new Map(orgs.map((o) => [o.id, o]))
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from('grants')
      .select('funder_org_id, recipient_org_id, amount_usd')
      .eq('status', 'approved')
      .range(from, from + 999)
      .throwOnError()
    for (const g of data ?? []) {
      for (const id of [g.funder_org_id, g.recipient_org_id]) {
        const o = byId.get(id)
        if (o) {
          o.grants++
          o.usd += g.amount_usd ?? 0
        }
      }
    }
    if (!data || data.length < 1000) break
  }

  const active = orgs.filter((o) => o.grants > 0)
  const meta = active.map((o) => ({
    o,
    norm: normalizeName(o.name),
    stripped: normalizeName(stripParens(o.name)),
    toks: tokens(o.name),
    inits: initials(o.name),
  }))

  type Pair = { a: Org; b: Org; signal: string; score: number }
  const pairs: Pair[] = []
  for (let i = 0; i < meta.length; i++) {
    for (let j = i + 1; j < meta.length; j++) {
      const x = meta[i]
      const y = meta[j]
      let signal: string | null = null
      let score = 0
      if (x.stripped && x.stripped === y.stripped) {
        signal = 'paren'
        score = 1
      } else if (x.norm && x.norm.replace(/\s/g, '') === y.norm.replace(/\s/g, '')) {
        // spacing-only differences (1DaySooner vs 1Day Sooner) tokenize
        // differently, so no other signal fires on them
        signal = 'spaceless'
        score = 1
      } else if (
        (x.inits.length >= 3 && x.inits === y.norm.replace(/\s/g, '')) ||
        (y.inits.length >= 3 && y.inits === x.norm.replace(/\s/g, ''))
      ) {
        signal = 'abbrev'
        score = 0.95
      } else if (x.toks.size >= 2 && y.toks.size >= 2) {
        const small = x.toks.size <= y.toks.size ? x.toks : y.toks
        const large = x.toks.size <= y.toks.size ? y.toks : x.toks
        const contained = Array.from(small).every((t) => large.has(t))
        const sim = jaccard(x.toks, y.toks)
        if (contained && large.size - small.size <= 2) {
          signal = 'subset'
          score = 0.9
        } else if (sim >= JACCARD_THRESHOLD) {
          signal = 'fuzzy'
          score = sim
        }
      }
      if (signal) pairs.push({ a: x.o, b: y.o, signal, score })
    }
  }

  pairs.sort((p, q) => q.a.usd + q.b.usd - (p.a.usd + p.b.usd))
  const limit = Number(process.argv[2] ?? 120)
  console.log(`${pairs.length} candidate pairs; top ${Math.min(limit, pairs.length)}:\n`)
  for (const p of pairs.slice(0, limit)) {
    const tag = (o: Org) =>
      `${o.name} [${o.slug}${o.needs_review ? '' : ' *curated'}] ${o.grants}g $${Math.round(o.usd).toLocaleString()}`
    console.log(`${p.signal.padEnd(6)} ${tag(p.a)}`)
    console.log(`       ${tag(p.b)}\n`)
  }
}

await main()
