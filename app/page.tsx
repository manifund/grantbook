import { Suspense } from 'react'
import { GrantsTable } from '@/components/grants-table'
import { listCauseAreas, listGrants, listSources } from '@/db/grant'

export const revalidate = 3600

export default async function Page(props: { searchParams: Promise<{ cause?: string }> }) {
  const { cause = 'ai-safety' } = await props.searchParams
  const [grants, sources, causeAreas] = await Promise.all([
    listGrants(cause),
    listSources(),
    listCauseAreas(),
  ])
  return (
    <Suspense>
      <GrantsTable
        grants={grants}
        sources={sources.filter((source) => source.last_ingested_at !== null)}
        causeOptions={causeAreas}
        cause={cause}
      />
    </Suspense>
  )
}
