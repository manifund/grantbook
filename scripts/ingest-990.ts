// IRS Form 990-PF grants for private foundations in the x-risk/EA funding
// cluster. XML e-files come from the Giving Tuesday 990 data lake (public S3
// mirror of IRS e-file data), pinned by immutable IRS object id. New filings:
// find the object id on the foundation's ProPublica page and add it here.
// Grants carry the filing's tax-period end date at year precision.
import { classifyCauses } from './lib/causes'
import { runIngest, type SourceRecordInput } from './lib/ingest'

const XML_BASE = 'https://gt990datalake-rawdata.s3.amazonaws.com/EfileData/XmlFiles'

const FOUNDATIONS: { ein: string; funderName: string; objectIds: string[] }[] = [
  {
    ein: '460538779',
    funderName: 'Robert and Virginia Shiller Foundation',
    objectIds: [
      '201421339349100842',
      '201811359349101396',
      '201901359349103130',
      '202032669349100708',
      '202102179349100420',
      '202201339349103895',
      '202301329349100225',
      '202401359349102510',
      '202501359349101480',
      // 2025 tax year (object 202621349349102937) not yet in the data lake
    ],
  },
  {
    ein: '276364101',
    funderName: 'Casey and Family Foundation',
    objectIds: [
      '201622109349100407',
      '201732159349100513',
      '201821349349100147',
      '201931419349100123',
      '202041579349100209',
      '202111049349100226',
      '202221539349100322',
      '202321359349100212',
      '202421359349100427',
      // 2025 tax year (object 202631319349100533) not yet in the data lake
    ],
  },
]

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}>([^<]*)</${name}>`))
  return match ? match[1].trim() : ''
}

// 990 names are usually ALL CAPS; title-case them for display. Resolution is
// case-insensitive, so this only affects newly created orgs.
function displayName(name: string): string {
  if (name !== name.toUpperCase()) return name
  return name
    .toLowerCase()
    .replace(/(^|[\s\-/(])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

async function main() {
  const records: SourceRecordInput[] = []
  for (const foundation of FOUNDATIONS) {
    for (const objectId of foundation.objectIds) {
      const res = await fetch(`${XML_BASE}/${objectId}_public.xml`)
      if (!res.ok) throw new Error(`${objectId}: HTTP ${res.status}`)
      const xml = await res.text()
      if (!xml.includes('<Return')) throw new Error(`${objectId}: not an e-file XML`)
      const periodEnd = tag(xml, 'TaxPeriodEndDt')
      const blocks =
        xml.match(/<GrantOrContributionPdDurYrGrp>[\s\S]*?<\/GrantOrContributionPdDurYrGrp>/g) ?? []
      blocks.forEach((block, index) => {
        const rawName = tag(block, 'BusinessNameLine1Txt') || tag(block, 'RecipientPersonNm')
        if (!rawName) return
        const amount = Number(tag(block, 'Amt'))
        const purpose = tag(block, 'GrantOrContributionPurposeTxt')
        const recipient = displayName(rawName)
        records.push({
          key: `${foundation.ein}:${objectId}:${index}`,
          raw: {
            ein: foundation.ein,
            object_id: objectId,
            period_end: periodEnd,
            recipient: rawName,
            amount,
            purpose,
            city: tag(block, 'CityNm'),
            state: tag(block, 'StateAbbreviationCd'),
          },
          parsed: {
            funderName: foundation.funderName,
            funderType: 'foundation',
            recipientName: recipient,
            amount: Number.isFinite(amount) && amount > 0 ? amount : null,
            currency: 'USD',
            date: periodEnd || null,
            datePrecision: 'year',
            description: purpose || null,
            url: `https://projects.propublica.org/nonprofits/organizations/${foundation.ein}/${objectId}/full`,
            causeSlugs: classifyCauses({ text: `${recipient} ${purpose}` }),
          },
        })
      })
    }
  }
  await runIngest('irs_990', records, { tombstone: true })
}

await main()
