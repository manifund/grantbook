// Finds vipul_donations-primary grants that likely duplicate a grant from the
// original source (CG, EA Funds, SFF, FLI, ...) but were missed by strict
// dedup: amounts revised after Vipul recorded them, dates off by months, or
// the recipient named differently (CHAI vs UC Berkeley). Review the output,
// then fix recipients via overrides/aliases and record merges in
// data/dedup-resolutions.json.
import { createAdminClient } from '@/db/supabase-admin'
import { normalizeName } from './lib/normalize'

const AMOUNT_TOLERANCE = 0.12
const DAY_WINDOW = 550

type Grant = {
  id: string
  funder: string
  recipient: string
  recipientName: string
  sponsor: string | null
  amountUsd: number | null
  date: string | null
  sourceId: string
  key: string
  description: string
}

async function load(): Promise<Grant[]> {
  const db = createAdminClient()
  const grants: Grant[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from('grant_sources')
      .select(
        `is_primary,
         grants!inner(id, funder_org_id, recipient_org_id, fiscal_sponsor_org_id, amount_usd, grant_date, description, status,
           recipient:orgs!grants_recipient_org_id_fkey(name)),
         source_records!inner(source_id, source_record_key)`
      )
      .range(from, from + 999)
      .throwOnError()
    const rows = (data ?? []) as never as {
      is_primary: boolean
      grants: {
        id: string
        funder_org_id: string
        recipient_org_id: string
        fiscal_sponsor_org_id: string | null
        amount_usd: number | null
        grant_date: string | null
        description: string | null
        status: string
        recipient: { name: string }
      }
      source_records: { source_id: string; source_record_key: string }
    }[]
    for (const row of rows) {
      if (!row.is_primary || row.grants.status !== 'approved') continue
      grants.push({
        id: row.grants.id,
        funder: row.grants.funder_org_id,
        recipient: row.grants.recipient_org_id,
        recipientName: row.grants.recipient.name,
        sponsor: row.grants.fiscal_sponsor_org_id,
        amountUsd: row.grants.amount_usd,
        date: row.grants.grant_date,
        sourceId: row.source_records.source_id,
        key: `${row.source_records.source_id}:${row.source_records.source_record_key}`,
        description: row.grants.description ?? '',
      })
    }
    if (!data || data.length < 1000) break
  }
  return grants
}

function tokens(name: string): Set<string> {
  return new Set(normalizeName(name).split(' ').filter((t) => t.length > 2))
}

function nameSimilar(a: string, b: string): boolean {
  if (normalizeName(a) === normalizeName(b)) return true
  const ta = tokens(a)
  const tb = tokens(b)
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter >= 2 || (inter >= 1 && Math.min(ta.size, tb.size) === 1)
}

async function main() {
  const grants = await load()
  const vipul = grants.filter((g) => g.sourceId === 'vipul_donations')
  const others = grants.filter((g) => g.sourceId !== 'vipul_donations')
  const byFunder = new Map<string, Grant[]>()
  for (const g of others) {
    const bucket = byFunder.get(g.funder) ?? []
    bucket.push(g)
    byFunder.set(g.funder, bucket)
  }

  let count = 0
  for (const v of vipul) {
    if (v.amountUsd === null) continue
    for (const o of byFunder.get(v.funder) ?? []) {
      if (o.amountUsd === null) continue
      const ratio =
        Math.abs(v.amountUsd - o.amountUsd) / Math.max(v.amountUsd, o.amountUsd)
      if (ratio > AMOUNT_TOLERANCE) continue
      const days =
        v.date && o.date
          ? Math.abs(new Date(v.date).getTime() - new Date(o.date).getTime()) / 86400000
          : null
      if (days !== null && days > DAY_WINDOW) continue
      const sameRecipient =
        v.recipient === o.recipient || v.recipient === o.sponsor || v.sponsor === o.recipient
      const fuzzyRecipient =
        !sameRecipient &&
        (nameSimilar(v.recipientName, o.recipientName) ||
          normalizeName(o.description).includes(normalizeName(v.recipientName)) ||
          normalizeName(v.description).includes(normalizeName(o.recipientName)))
      if (!sameRecipient && !fuzzyRecipient) continue
      count++
      const pct = (ratio * 100).toFixed(1)
      console.log(
        `PAIR amt±${pct}% ${days === null ? '?' : Math.round(days)}d ${sameRecipient ? 'same-org' : 'FUZZY'}`
      )
      console.log(`  vipul: ${v.date} $${Math.round(v.amountUsd).toLocaleString()} -> ${v.recipientName}`)
      console.log(`         ${v.key}`)
      console.log(`  ${o.sourceId}: ${o.date} $${Math.round(o.amountUsd).toLocaleString()} -> ${o.recipientName} | ${o.description.slice(0, 60)}`)
      console.log(`         ${o.key}`)
    }
  }
  console.log(`\n${count} candidate pairs`)
}

await main()
