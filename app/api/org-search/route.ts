import { NextResponse } from 'next/server'
import { dbConfigured } from '@/db/grant'
import { createPublicSupabaseClient } from '@/db/supabase-server'

// Typeahead over org names (canonical + former + aliases), deduped by org.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2 || !dbConfigured()) return NextResponse.json([])
  const supabase = createPublicSupabaseClient()
  const escaped = q.replace(/[%_\\]/g, '\\$&')
  const { data } = await supabase
    .from('org_names')
    .select('name, orgs!inner(slug, name)')
    .ilike('name', `%${escaped}%`)
    .limit(40)
    .throwOnError()
  const rows = (data ?? []) as never as { name: string; orgs: { slug: string; name: string } }[]
  const seen = new Set<string>()
  const results: { slug: string; name: string }[] = []
  // Prefix matches first, then substring matches.
  for (const pass of [0, 1]) {
    for (const row of rows) {
      const isPrefix = row.name.toLowerCase().startsWith(q.toLowerCase())
      if ((pass === 0) !== isPrefix) continue
      if (seen.has(row.orgs.slug)) continue
      seen.add(row.orgs.slug)
      results.push({ slug: row.orgs.slug, name: row.orgs.name })
      if (results.length >= 8) return NextResponse.json(results)
    }
  }
  return NextResponse.json(results)
}
