import 'server-only'

import { dbConfigured } from './grant'
import { createPublicSupabaseClient } from './supabase-server'

export type OrgDetail = {
  id: string
  slug: string
  name: string
  org_type: string
  website: string | null
  names: { name: string; kind: string; valid_from: string | null; valid_to: string | null }[]
}

export async function getOrgBySlug(slug: string): Promise<OrgDetail | null> {
  if (!dbConfigured()) return null
  const supabase = createPublicSupabaseClient()
  const { data } = await supabase
    .from('orgs')
    .select('id, slug, name, org_type, website, org_names(name, kind, valid_from, valid_to)')
    .eq('slug', slug)
    .maybeSingle()
    .throwOnError()
  if (!data) return null
  const org = data as never as Omit<OrgDetail, 'names'> & { org_names: OrgDetail['names'] }
  return { ...org, names: org.org_names }
}

export type FunderSummary = {
  slug: string
  name: string
  grantCount: number
  totalUsd: number
  firstYear: number | null
  lastYear: number | null
}

export async function listFunders(): Promise<FunderSummary[]> {
  if (!dbConfigured()) return []
  const supabase = createPublicSupabaseClient()
  const byFunder = new Map<string, FunderSummary>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('grants')
      .select('amount_usd, grant_date, funder:orgs!grants_funder_org_id_fkey(slug, name)')
      .eq('status', 'approved')
      .range(from, from + 999)
      .throwOnError()
    for (const grant of (data ?? []) as never as {
      amount_usd: number | null
      grant_date: string | null
      funder: { slug: string; name: string } | null
    }[]) {
      if (!grant.funder) continue
      const entry = byFunder.get(grant.funder.slug) ?? {
        slug: grant.funder.slug,
        name: grant.funder.name,
        grantCount: 0,
        totalUsd: 0,
        firstYear: null,
        lastYear: null,
      }
      entry.grantCount++
      entry.totalUsd += grant.amount_usd ?? 0
      const year = grant.grant_date ? Number(grant.grant_date.slice(0, 4)) : null
      if (year !== null) {
        entry.firstYear = entry.firstYear === null ? year : Math.min(entry.firstYear, year)
        entry.lastYear = entry.lastYear === null ? year : Math.max(entry.lastYear, year)
      }
      byFunder.set(grant.funder.slug, entry)
    }
    if (!data || data.length < 1000) break
  }
  return Array.from(byFunder.values()).sort((a, b) => b.totalUsd - a.totalUsd)
}
