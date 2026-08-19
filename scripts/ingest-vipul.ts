// Donations List Website (vipulnaik/donations, CC0). Parses the hand-written
// MySQL INSERT files under sql/donations/ from raw GitHub, pinned to a commit
// SHA for reproducibility. The full corpus spans all cause areas (~207K rows,
// $72B); v1 keeps the x-risk / EA cluster and leaves global health & similar
// out — widen KEEP if grantbook broadens.
// Amounts: the `amount` column is already USD-converted upstream; the original
// currency amount stays in raw.
import { classifyCauses } from './lib/causes'
import { runIngest, type SourceRecordInput } from './lib/ingest'
import { parseInserts, type SqlValue } from './lib/mysqldump-parse'
import { sha256 } from './lib/normalize'

const REPO = 'vipulnaik/donations'
const KEEP =
  /ai safety|ai risk|artificial intelligence|global catastrophic|existential risk|x-risk|biosecurity|pandemic|nuclear|effective altruism|rationality|epistemic|forecast|animal welfare|long-?term/i

const PRECISION: Record<string, 'day' | 'month' | 'year'> = {
  day: 'day',
  month: 'month',
  quarter: 'month',
  year: 'year',
  'multi-year': 'year',
}

async function githubJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'user-agent': 'grantbook-ingest' } })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${url}`)
  return res.json()
}

async function main() {
  const pinnedSha = process.argv[2]
  const sha =
    pinnedSha ??
    (
      (await githubJson(`https://api.github.com/repos/${REPO}/git/refs/heads/master`)) as never as {
        object: { sha: string }
      }
    ).object.sha
  console.log(`Ingesting ${REPO} @ ${sha}`)

  const tree = (
    (await githubJson(
      `https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`
    )) as never as { tree: { path: string; type: string }[] }
  ).tree
  const files = tree
    .filter(
      (t) =>
        t.type === 'blob' &&
        t.path.startsWith('sql/donations/') &&
        t.path.endsWith('.sql') &&
        !t.path.endsWith('-schema.sql')
    )
    .map((t) => t.path)
  console.log(`${files.length} donation SQL files`)

  const records: SourceRecordInput[] = []
  const keyCounts = new Map<string, number>()
  let total = 0
  let kept = 0

  const queue = [...files]
  const workers = Array.from({ length: 8 }, async () => {
    for (;;) {
      const path = queue.shift()
      if (!path) return
      const res = await fetch(`https://raw.githubusercontent.com/${REPO}/${sha}/${path}`)
      if (!res.ok) throw new Error(`raw fetch ${res.status}: ${path}`)
      const rows = parseInserts(await res.text(), 'donations')
      total += rows.length
      for (const row of rows) {
        const str = (v: SqlValue) => (v === null || v === undefined ? '' : String(v))
        const causeArea = str(row.cause_area)
        const searchable = `${str(row.donee)} ${causeArea} ${str(row.notes)} ${str(row.intended_use_of_funds)}`
        if (!KEEP.test(searchable)) continue
        const donor = str(row.donor)
        const donee = str(row.donee)
        if (!donor || !donee) continue
        kept++

        const amount = typeof row.amount === 'number' ? row.amount : null
        const date = str(row.donation_date) || null
        const baseKey = await sha256(
          [path, donor, donee, amount ?? '', date ?? '', str(row.url)].join('|')
        )
        const n = (keyCounts.get(baseKey) ?? 0) + 1
        keyCounts.set(baseKey, n)

        // Keep raw compact: drop nulls, record provenance file.
        const raw: Record<string, SqlValue> = { _file: path }
        for (const [k, v] of Object.entries(row)) if (v !== null) raw[k] = v

        records.push({
          key: n === 1 ? baseKey : `${baseKey}#${n}`,
          raw,
          parsed: {
            funderName: donor,
            recipientName: donee,
            amount,
            currency: 'USD',
            date,
            datePrecision: date ? (PRECISION[str(row.donation_date_precision)] ?? 'day') : null,
            description: str(row.intended_use_of_funds) || str(row.notes) || null,
            round: null,
            url: str(row.url) || null,
            causeSlugs: classifyCauses({
              labels: causeArea ? [causeArea] : [],
              text: searchable,
            }),
          },
        })
      }
    }
  })
  await Promise.all(workers)

  console.log(`Parsed ${total} donations; kept ${kept} in the x-risk/EA cluster`)
  await runIngest('vipul_donations', records)
}

await main()
