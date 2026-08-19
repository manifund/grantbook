// EA Funds public grants CSV: https://funds.effectivealtruism.org/api/grants
// Columns: id,fund,description,grantee,amount,round,year,highlighted
// The Airtable rec id is the stable per-grant key.
import { classifyCauses } from './lib/causes'
import { csvToObjects } from './lib/csv'
import { runIngest, type SourceRecordInput } from './lib/ingest'

const CSV_URL = 'https://funds.effectivealtruism.org/api/grants'

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
}

// Rounds look like "July 2021", "Q1 2022", or arbitrary labels. Fall back to
// the year column at year precision.
function parseDate(
  round: string,
  year: string
): { date: string | null; precision: 'month' | 'year' | null } {
  const monthMatch = round.toLowerCase().match(/([a-z]+)\s+(\d{4})/)
  if (monthMatch && MONTHS[monthMatch[1]]) {
    return {
      date: `${monthMatch[2]}-${String(MONTHS[monthMatch[1]]).padStart(2, '0')}-01`,
      precision: 'month',
    }
  }
  // Both "Q1 2022" and "2026 Q2" appear across rounds.
  const lower = round.toLowerCase()
  const qFirst = lower.match(/q([1-4])\s*(\d{4})/)
  const yFirst = lower.match(/(\d{4})\s*q([1-4])/)
  const quarter = qFirst ? Number(qFirst[1]) : yFirst ? Number(yFirst[2]) : null
  const qYear = qFirst ? qFirst[2] : yFirst ? yFirst[1] : null
  if (quarter && qYear) {
    const month = (quarter - 1) * 3 + 1
    return { date: `${qYear}-${String(month).padStart(2, '0')}-01`, precision: 'month' }
  }
  const y = Number(year)
  if (y >= 2000 && y <= 2100) return { date: `${y}-01-01`, precision: 'year' }
  return { date: null, precision: null }
}

async function main() {
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`EA Funds fetch failed: ${res.status}`)
  const rows = csvToObjects(await res.text())

  const records: SourceRecordInput[] = []
  for (const row of rows) {
    if (!row.id || !row.grantee) continue
    const { date, precision } = parseDate(row.round ?? '', row.year ?? '')
    const amount = Number((row.amount ?? '').replace(/[$,]/g, ''))
    records.push({
      key: row.id,
      raw: row,
      parsed: {
        funderName: row.fund,
        funderType: 'fund',
        recipientName: row.grantee,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        currency: 'USD',
        date,
        datePrecision: precision,
        description: row.description || null,
        round: row.round ? `${row.fund}: ${row.round}` : null,
        causeSlugs: classifyCauses({
          fund: row.fund,
          text: `${row.description ?? ''} ${row.grantee ?? ''}`,
        }),
      },
    })
  }
  await runIngest('ea_funds', records)
}

await main()
