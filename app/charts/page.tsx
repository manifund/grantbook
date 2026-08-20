import { ChartsView } from '@/components/charts-view'
import { listGrants } from '@/db/grant'

export const revalidate = 600

export default async function Page() {
  const grants = await listGrants('all')
  return <ChartsView grants={grants} />
}
