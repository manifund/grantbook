import { OrgIndex, type OrgIndexSearchParams } from '@/components/org-index'

export const revalidate = 600

export default async function Page(props: { searchParams: Promise<OrgIndexSearchParams> }) {
  return <OrgIndex side="funder" searchParams={await props.searchParams} />
}
