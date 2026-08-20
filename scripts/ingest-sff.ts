// SFF recommendations, all rounds 2019-2025, from the single index table at
// https://survivalandflourishing.fund/recommendations
// Columns: Round | Source | Organization | Amount | Receiving Charity | Purpose
// * Source is the actual funder (Jaan Tallinn, Jed McCaleb, ...).
// * Organization vs Receiving Charity encodes fiscal sponsorship.
// * Amount cells can carry a speculation-grant top-up: "$X +$Y‡" — both count.
import * as cheerio from 'cheerio'
import { classifyCauses } from './lib/causes'
import { runIngest, type SourceRecordInput } from './lib/ingest'
import { sha256 } from './lib/normalize'

const URL = 'https://survivalandflourishing.fund/recommendations'

function parseAmount(cell: string): number | null {
  const parts = Array.from(cell.matchAll(/\$([\d,]+)/g)).map((m) => Number(m[1].replace(/,/g, '')))
  if (parts.length === 0) return null
  return parts.reduce((a, b) => a + b, 0)
}

// Round labels: SFF-2019-Q3, SFF-2020-H1, SFF-2024, SFF-2024-FlexHEGs,
// Initiative Committee 2024, SFF-2025. Quarters/halves map to their final
// month; plain years stay year-precision.
function parseRound(round: string): { date: string | null; precision: 'month' | 'year' | null } {
  const year = round.match(/(\d{4})/)?.[1]
  if (!year) return { date: null, precision: null }
  const quarter = round.match(/Q([1-4])/)?.[1]
  if (quarter) {
    const month = Number(quarter) * 3
    return { date: `${year}-${String(month).padStart(2, '0')}-01`, precision: 'month' }
  }
  const half = round.match(/H([12])/)?.[1]
  if (half) {
    const month = half === '1' ? 6 : 12
    return { date: `${year}-${String(month).padStart(2, '0')}-01`, precision: 'month' }
  }
  return { date: `${year}-01-01`, precision: 'year' }
}

async function main() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`SFF fetch failed: ${res.status}`)
  const $ = cheerio.load(await res.text())

  const records: SourceRecordInput[] = []
  const rows = $('tr').toArray()
  for (const tr of rows) {
    const cells = $(tr)
      .find('td')
      .toArray()
      .map((td) => $(td).text().replace(/\s+/g, ' ').trim())
    if (cells.length !== 6) continue
    const [round, source, organization, amountCell, receivingCharity, purpose] = cells
    if (!organization) continue

    // Bracketed qualifiers ("Org [Project Name]") stay out of the org entity.
    const recipient = organization.replace(/\s*\[[^\]]*\]\s*$/, '').trim()
    const sponsor =
      receivingCharity && receivingCharity !== organization && receivingCharity !== recipient
        ? receivingCharity
        : null
    const { date, precision } = parseRound(round)

    // Joint-funder rows ("Jaan Tallinn and Blake Borgeson") pair each funder
    // with their own amount ("$1,094,000 and $135,000", same order). Split
    // them into one grant per funder. Only split when the amount cell itself
    // pairs two figures — org names can contain "and" ("The Casey and Family
    // Foundation") without being joint.
    const jointAmounts = amountCell.match(/^\$([\d,]+) and \$([\d,]+)$/)
    const funders =
      jointAmounts && source.includes(' and ')
        ? source.split(' and ').map((name, i) => ({
            name: name.trim(),
            amount: Number(jointAmounts[i + 1].replace(/,/g, '')),
          }))
        : [{ name: source, amount: parseAmount(amountCell) }]

    for (const funder of funders) {
      records.push({
        key: await sha256(
          [round, funder.name, organization, amountCell, receivingCharity, purpose].join('|')
        ),
        raw: {
          round,
          source,
          funder: funder.name,
          organization,
          amount: amountCell,
          receivingCharity,
          purpose,
        },
        parsed: {
          funderName: funder.name,
          funderType: 'individual',
          recipientName: recipient,
          sponsorName: sponsor,
          viaNames: ['Survival and Flourishing Fund'],
          amount: funder.amount,
          currency: 'USD',
          date,
          datePrecision: precision,
          description: purpose || null,
          round,
          url: URL,
          causeSlugs: classifyCauses({
            fund: 'sff',
            text: `${recipient} ${purpose ?? ''}`,
          }),
        },
      })
    }
  }
  if (records.length < 400) {
    throw new Error(`SFF parse suspiciously small: ${records.length} rows — page layout changed?`)
  }
  await runIngest('sff', records)
}

await main()
