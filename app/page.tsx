import { Suspense } from 'react'
import { GrantsTable } from '@/components/grants-table'
import { listGrants, listSources } from '@/db/grant'

export const revalidate = 600

export default async function Page(props: { searchParams: Promise<{ cause?: string }> }) {
  const { cause = 'ai-safety' } = await props.searchParams
  const [grants, sources] = await Promise.all([listGrants(cause), listSources()])
  return (
    <Suspense>
      <GrantsTable
        grants={grants}
        sources={sources.filter((source) => source.last_ingested_at !== null)}
        cause={cause}
      />
    </Suspense>
  )
}
