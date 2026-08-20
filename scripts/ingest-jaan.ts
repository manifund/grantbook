// Jaan Tallinn's personal donation log at jaan.online — first-party record
// with exact disbursement dates, original currencies, and the disbursing
// vehicle per row. Overlaps heavily with SFF, BERI, and Vipul; dedup
// reconciles those (SFF stays primary for its rounds, this source beats
// vipul_donations). Rows with negative value (refunds/corrections) are
// skipped.
import * as cheerio from 'cheerio'
import { classifyCauses } from './lib/causes'
import { runIngest, type SourceRecordInput } from './lib/ingest'
import { sha256 } from './lib/normalize'

const URL = 'https://jaan.online/philanthropy/donations.html'

// The page legend, mapped to canonical org names. His own holding/DAF
// vehicles count as vias too — the money is his either way.
const VIA_NAMES: Record<string, string | null> = {
  direct: null,
  BERI: 'Berkeley Existential Risk Initiative',
  BSF: 'Berkeley Existential Risk Initiative',
  'FP-UK': 'Founders Pledge',
  'FP-US': 'Founders Pledge',
  LSG: 'Lightspeed Grants',
  Metaplanet: 'Metaplanet Holdings',
  SFC: 'Survival and Flourishing Com',
  SFF: 'Survival and Flourishing Fund',
  'SFF-spec': 'Survival and Flourishing Fund',
  SFP: 'Survival and Flourishing Projects',
  Slimrock: 'Slimrock Holdings',
  Solenum: 'Solenum Foundation',
  TCF: 'Tallinn Community Fund',
}

// Currencies the checked-in fx table can convert; everything else falls back
// to the page's own coarse USD estimate ("$102k").
const FX_CURRENCIES = new Set(['USD', 'GBP', 'EUR'])

async function main() {
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`jaan.online ${res.status}`)
  const $ = cheerio.load(await res.text())

  const records: SourceRecordInput[] = []
  const keyCounts = new Map<string, number>()
  let skippedNegative = 0

  for (const tr of $('tr').toArray()) {
    const cells = $(tr)
      .find('td')
      .toArray()
      .map((td) => $(td).text().trim())
    if (cells.length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) continue
    const [date, viaCode, currency, amountCell, valueCell, recipient, purpose] = cells
    if (!recipient) continue
    if (valueCell.startsWith('-')) {
      skippedNegative++
      continue
    }
    const amount = Number(amountCell.replace(/,/g, ''))
    const valueUsd = (Number(valueCell.match(/\$([\d.]+)k/)?.[1]) || 0) * 1000
    const useFx = FX_CURRENCIES.has(currency) && Number.isFinite(amount) && amount > 0
    const viaName = VIA_NAMES[viaCode] ?? null
    if (!(viaCode in VIA_NAMES)) console.warn(`unknown via code: ${viaCode}`)

    const baseKey = await sha256(
      [date, viaCode, currency, amountCell, recipient, purpose].join('|')
    )
    const n = (keyCounts.get(baseKey) ?? 0) + 1
    keyCounts.set(baseKey, n)

    records.push({
      key: n === 1 ? baseKey : `${baseKey}#${n}`,
      raw: {
        date,
        via: viaCode,
        currency,
        amount: amountCell,
        value: valueCell,
        recipient,
        purpose,
      },
      parsed: {
        funderName: 'Jaan Tallinn',
        funderType: 'individual',
        recipientName: recipient,
        viaNames: viaName ? [viaName] : [],
        amount: useFx ? amount : valueUsd > 0 ? valueUsd : null,
        currency: useFx ? currency : 'USD',
        date,
        datePrecision: 'day',
        description: purpose || null,
        round: viaCode === 'SFF-spec' ? 'SFF speculation grant' : null,
        url: URL,
        causeSlugs: classifyCauses({ text: `${recipient} ${purpose}` }),
      },
    })
  }

  if (records.length < 900) throw new Error(`Suspiciously few rows: ${records.length}`)
  if (skippedNegative > 0) console.log(`${skippedNegative} negative-value rows skipped`)
  await runIngest('jaan_online', records, { tombstone: true })
}

await main()
