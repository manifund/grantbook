// Coefficient Giving (formerly Open Philanthropy), full grants database.
// The Nov 2025 rebrand removed the site's grants index page, but the data
// still lives in their public Algolia search index
// (coefficientgiving_grants_award_date_desc, app wbc743wf65), which powers
// the per-fund "Featured Grants" widgets. Their site is Cloudflare-gated to
// non-browser clients, so the export runs in a real browser session and the
// result is checked in as data/coefficient-grants.json (2,889 grants,
// 2012 through 2026 at last export).
//
// To refresh: open any fund page (e.g. /funds/navigating-transformative-ai/),
// export the index via the page's own Algolia client, and overwrite
// data/coefficient-grants.json — then re-run this script.
import snapshot from '@/data/coefficient-grants.json'
import { classifyCauses } from './lib/causes'
import { runIngest, type SourceRecordInput } from './lib/ingest'

type SnapshotGrant = {
  id: string
  title: string | null
  amount: number | null
  date: number | null
  year: number | null
  org: string | null
  areas: string[]
  slug: string | null
}

async function main() {
  const grants = (snapshot as never as { grants: SnapshotGrant[] }).grants
  if (grants.length < 2500) throw new Error(`Suspiciously few rows: ${grants.length}`)

  const records: SourceRecordInput[] = []
  for (const grant of grants) {
    const recipient = (grant.org ?? '').trim()
    if (!recipient) continue
    // Algolia object ids look like "grants-36950-0"; the WP post id is the
    // stable key.
    const postId = grant.id.match(/grants-(\d+)/)?.[1] ?? grant.id
    const date = grant.date ? new Date(grant.date * 1000).toISOString().slice(0, 10) : null

    records.push({
      key: postId,
      raw: {
        id: grant.id,
        title: grant.title,
        amount: grant.amount,
        award_date: grant.date,
        organization: grant.org,
        areas: grant.areas,
        slug: grant.slug,
      },
      parsed: {
        funderName: 'Coefficient Giving',
        funderType: 'foundation',
        recipientName: recipient,
        amount: grant.amount && grant.amount > 0 ? grant.amount : null,
        currency: 'USD',
        date,
        datePrecision: date ? 'month' : null,
        description: grant.title || null,
        round: grant.areas[0] ?? null,
        url: grant.slug ? `https://coefficientgiving.org/grants/${grant.slug}` : null,
        causeSlugs: classifyCauses({
          labels: grant.areas,
          text: `${grant.title ?? ''} ${grant.areas.join(' ')}`,
        }),
      },
    })
  }
  await runIngest('coefficient_giving', records)
}

await main()
