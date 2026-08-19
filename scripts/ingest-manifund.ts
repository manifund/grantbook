// Manifund funded projects. Two modes:
// * default: public API (https://manifund.org/api/v0/projects) — currently
//   returns only the ~100 most recent projects; fine for incremental runs.
// * --direct: read Manifund's own Supabase (set MANIFUND_SUPABASE_URL +
//   MANIFUND_SUPABASE_ANON_KEY in .env.local) for the full history.
// Funder is recorded as Manifund in v1; regrantor-level attribution can come
// later from the regranting ledger (manifund.org/about/regranting-data).
import { createClient } from '@supabase/supabase-js'
import { classifyCauses } from './lib/causes'
import { runIngest, type SourceRecordInput } from './lib/ingest'

type ApiProject = {
  id: string
  title: string
  created_at: string
  slug: string
  stage: string
  type: string
  blurb: string | null
  profiles: { username: string; full_name: string } | null
  txns: { amount: number; token: string }[]
  causes: { title: string; slug: string }[]
}

async function fetchViaApi(): Promise<ApiProject[]> {
  const res = await fetch('https://manifund.org/api/v0/projects')
  if (!res.ok) throw new Error(`Manifund API ${res.status}`)
  return (await res.json()) as ApiProject[]
}

async function fetchDirect(): Promise<ApiProject[]> {
  const url = process.env.MANIFUND_SUPABASE_URL
  const key = process.env.MANIFUND_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Set MANIFUND_SUPABASE_URL and MANIFUND_SUPABASE_ANON_KEY for --direct')
  }
  const db = createClient(url, key)
  const all: ApiProject[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('projects')
      .select(
        `id, title, created_at, slug, stage, type, blurb,
         profiles!projects_creator_fkey(username, full_name),
         txns(amount, token),
         causes(title, slug)`
      )
      .neq('stage', 'hidden')
      .neq('stage', 'draft')
      .range(from, from + 999)
    if (error) throw error
    all.push(...((data ?? []) as never as ApiProject[]))
    if (!data || data.length < 1000) break
  }
  return all
}

async function main() {
  const direct = process.argv.includes('--direct')
  const projects = await (direct ? fetchDirect() : fetchViaApi())
  console.log(`${projects.length} projects fetched${direct ? ' (direct)' : ' (api, recent only)'}`)

  const records: SourceRecordInput[] = []
  for (const project of projects) {
    const funded = (project.txns ?? [])
      .filter((txn) => txn.token === 'USD')
      .reduce((sum, txn) => sum + txn.amount, 0)
    if (funded <= 0) continue

    const causeSlugs = (project.causes ?? []).map((cause) => cause.slug)
    const recipient = project.profiles?.full_name || project.profiles?.username || project.title
    records.push({
      key: project.id,
      raw: {
        id: project.id,
        title: project.title,
        slug: project.slug,
        created_at: project.created_at,
        stage: project.stage,
        type: project.type,
        funded_usd: funded,
        causes: causeSlugs,
        creator: project.profiles?.username ?? null,
      },
      parsed: {
        funderName: 'Manifund',
        funderType: 'fund',
        recipientName: recipient,
        amount: funded,
        currency: 'USD',
        date: project.created_at.slice(0, 10),
        datePrecision: 'day',
        description: project.title,
        round: null,
        url: `https://manifund.org/projects/${project.slug}`,
        causeSlugs: classifyCauses({
          labels: causeSlugs,
          text: `${project.title} ${project.blurb ?? ''}`,
        }),
      },
    })
  }
  // The API mode only sees recent projects; never tombstone from a partial view.
  await runIngest('manifund', records, { tombstone: direct })
}

await main()
