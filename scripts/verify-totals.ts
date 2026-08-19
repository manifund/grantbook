// Cross-checks ingested totals against published figures in
// data/expected-totals.json. Exits nonzero on any check outside tolerance.
import expectedFile from '@/data/expected-totals.json'
import { createAdminClient } from '@/db/supabase-admin'

type Check = {
  id: string
  description: string
  source_id: string
  round_contains?: string
  expected_usd: number
  tolerance: number
}

const db = createAdminClient()

async function sumForSource(sourceId: string, roundContains?: string): Promise<number> {
  let total = 0
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from('grant_sources')
      .select(
        `is_primary,
         grants!inner(amount_usd, round, status),
         source_records!inner(source_id)`
      )
      .eq('is_primary', true)
      .eq('source_records.source_id', sourceId)
      .eq('grants.status', 'approved')
      .range(from, from + 999)
      .throwOnError()
    const rows = (data ?? []) as never as {
      grants: { amount_usd: number | null; round: string | null }
    }[]
    for (const row of rows) {
      if (roundContains && !(row.grants.round ?? '').includes(roundContains)) continue
      total += row.grants.amount_usd ?? 0
    }
    if (!data || data.length < 1000) break
  }
  return total
}

async function main() {
  const checks = (expectedFile as never as { checks: Check[] }).checks
  let failed = 0
  for (const check of checks) {
    const actual = await sumForSource(check.source_id, check.round_contains)
    const deviation = Math.abs(actual - check.expected_usd) / check.expected_usd
    const ok = deviation <= check.tolerance
    if (!ok) failed++
    console.log(
      `${ok ? 'PASS' : 'FAIL'} ${check.id}: actual $${Math.round(actual).toLocaleString()} vs expected $${check.expected_usd.toLocaleString()} (dev ${(deviation * 100).toFixed(2)}%)`
    )
  }
  if (failed > 0) {
    console.error(`${failed} checks failed`)
    process.exit(1)
  }
}

await main()
