// Manifund funded projects. Two modes:
// * --direct (the real one): read Manifund's own Supabase (set
//   MANIFUND_SUPABASE_URL + MANIFUND_SUPABASE_ANON_KEY in .env.local) and
//   create one grant per (project, donor) from 'project donation' txns —
//   funder is the actual donor, via = Manifund.
// * default API mode: https://manifund.org/api/v0/projects returns only the
//   ~100 most recent projects and no donor identities, so it can only record
//   a coarse aggregate grant (funder = Manifund). Use --direct for real runs;
//   a later --direct run tombstones the coarse records automatically.
import { createClient } from '@supabase/supabase-js'
import { classifyCauses } from './lib/causes'
import { runIngest, type SourceRecordInput } from './lib/ingest'

type Txn = {
  amount: number
  token: string
  type: string | null
  created_at: string | null
  donor: { username: string; full_name: string | null } | null
}

type Project = {
  id: string
  title: string
  created_at: string
  slug: string
  stage: string
  type: string
  blurb: string | null
  profiles: { username: string; full_name: string } | null
  txns: Txn[]
  causes: { title: string; slug: string }[]
}

async function fetchViaApi(): Promise<Project[]> {
  const res = await fetch('https://manifund.org/api/v0/projects')
  if (!res.ok) throw new Error(`Manifund API ${res.status}`)
  return (await res.json()) as Project[]
}

async function fetchDirect(): Promise<Project[]> {
  const url = process.env.MANIFUND_SUPABASE_URL
  const key = process.env.MANIFUND_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Set MANIFUND_SUPABASE_URL and MANIFUND_SUPABASE_ANON_KEY for --direct')
  }
  const db = createClient(url, key)
  const all: Project[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('projects')
      .select(
        `id, title, created_at, slug, stage, type, blurb,
         profiles!projects_creator_fkey(username, full_name),
         txns(amount, token, type, created_at, donor:profiles!txns_from_id_fkey(username, full_name)),
         causes(title, slug)`
      )
      .neq('stage', 'hidden')
      .neq('stage', 'draft')
      .range(from, from + 999)
    if (error) throw error
    all.push(...((data ?? []) as never as Project[]))
    if (!data || data.length < 1000) break
  }
  return all
}

async function main() {
  const direct = process.argv.includes('--direct')
  const projects = await (direct ? fetchDirect() : fetchViaApi())
  console.log(`${projects.length} projects fetched${direct ? ' (direct)' : ' (api, recent only)'}`)

  // Creators whose projects belong to their organization, not to them.
  const RECIPIENT_OVERRIDES: Record<string, string> = {
    'Oliver Habryka': 'Lightcone Infrastructure',
  }
  // Donor accounts that pass through someone else's money: the person is the
  // funder, the account is the vehicle.
  const DONOR_OVERRIDES: Record<string, { name: string; via: string }> = {
    'grantmaking-ai': { name: 'Anton Makiievskyi', via: 'grantmaking.ai' },
  }

  const records: SourceRecordInput[] = []
  for (const project of projects) {
    const creatorName =
      project.profiles?.full_name?.trim() || project.profiles?.username || project.title
    const recipient = RECIPIENT_OVERRIDES[creatorName] ?? creatorName
    const causeSlugs = (project.causes ?? []).map((cause) => cause.slug)
    const causes = classifyCauses({
      labels: causeSlugs,
      text: `${recipient} ${project.title} ${project.blurb ?? ''}`,
    })
    const url = `https://manifund.org/projects/${project.slug}`
    const shared = { title: project.title, slug: project.slug, stage: project.stage }

    if (!direct) {
      const funded = (project.txns ?? [])
        .filter((txn) => txn.token === 'USD')
        .reduce((sum, txn) => sum + txn.amount, 0)
      if (funded <= 0) continue
      records.push({
        key: project.id,
        raw: { ...shared, id: project.id, funded_usd: funded, causes: causeSlugs },
        parsed: {
          funderName: 'Manifund',
          funderType: 'fund',
          viaName: 'Manifund',
          recipientName: recipient,
          amount: funded,
          currency: 'USD',
          date: project.created_at.slice(0, 10),
          datePrecision: 'day',
          description: project.title,
          url,
          causeSlugs: causes,
        },
      })
      continue
    }

    // Direct mode: one grant per donor per project.
    const byDonor = new Map<string, { name: string; total: number; last: string }>()
    for (const txn of project.txns ?? []) {
      if (txn.token !== 'USD' || txn.type !== 'project donation') continue
      if (txn.amount <= 0) continue
      const username = txn.donor?.username ?? 'anonymous'
      const name = txn.donor?.full_name?.trim() || txn.donor?.username || 'Anonymous'
      const entry = byDonor.get(username) ?? { name, total: 0, last: project.created_at }
      entry.total += txn.amount
      if (txn.created_at && txn.created_at > entry.last) entry.last = txn.created_at
      byDonor.set(username, entry)
    }
    for (const [username, donor] of byDonor) {
      records.push({
        key: `${project.id}:${username}`,
        raw: {
          ...shared,
          project_id: project.id,
          donor: username,
          amount: donor.total,
          causes: causeSlugs,
        },
        parsed: {
          funderName: DONOR_OVERRIDES[username]?.name ?? donor.name,
          funderType: 'individual',
          viaName: DONOR_OVERRIDES[username]?.via ?? 'Manifund',
          recipientName: recipient,
          amount: Math.round(donor.total * 100) / 100,
          currency: 'USD',
          date: donor.last.slice(0, 10),
          datePrecision: 'day',
          description: project.title,
          url,
          causeSlugs: causes,
        },
      })
    }
  }
  // Never tombstone from the API's partial view.
  await runIngest('manifund', records, { tombstone: direct })
}

await main()
