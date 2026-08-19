import { notFound } from 'next/navigation'
import { listGrantsByOrg, type GrantRow } from '@/db/grant'
import { getOrgBySlug } from '@/db/org'
import { formatGrantDate, formatMoney } from '@/utils/format'

export const revalidate = 3600

function GrantList(props: { title: string; grants: GrantRow[]; side: 'made' | 'received' }) {
  if (props.grants.length === 0) return null
  const total = props.grants.reduce((sum, grant) => sum + (grant.amountUsd ?? 0), 0)
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-serif text-lg font-bold">
        {props.title}{' '}
        <span className="text-sm font-normal text-ink-muted">
          {props.grants.length.toLocaleString()} · {formatMoney(total)}
        </span>
      </h2>
      <div className="overflow-x-auto">
        <table className="gb-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>{props.side === 'made' ? 'Recipient' : 'Funder'}</th>
              <th className="gb-num">Amount</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {props.grants.map((grant) => {
              const other =
                props.side === 'made'
                  ? { slug: grant.recipientSlug, name: grant.recipientName }
                  : { slug: grant.funderSlug, name: grant.funderName }
              return (
                <tr key={grant.id}>
                  <td className="whitespace-nowrap">
                    {formatGrantDate(grant.date, grant.datePrecision)}
                  </td>
                  <td>
                    <a href={`/orgs/${other.slug}`}>{other.name}</a>
                    {props.side === 'made' && grant.sponsorName && (
                      <span className="block text-xs text-ink-muted">
                        via <a href={`/orgs/${grant.sponsorSlug}`}>{grant.sponsorName}</a>
                      </span>
                    )}
                  </td>
                  <td className="gb-num whitespace-nowrap">{formatMoney(grant.amountUsd)}</td>
                  <td className="max-w-md">
                    <span className="line-clamp-2">{grant.description}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const [made, received, sponsored] = await Promise.all([
    listGrantsByOrg('funder_org_id', org.id),
    listGrantsByOrg('recipient_org_id', org.id),
    listGrantsByOrg('fiscal_sponsor_org_id', org.id),
  ])
  const formerNames = org.names.filter((name) => name.kind !== 'canonical')

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold">{org.name}</h1>
      <p className="mb-6 text-sm text-ink-muted">
        {org.website && (
          <>
            <a href={org.website}>{org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
            {' · '}
          </>
        )}
        {org.org_type}
        {formerNames.length > 0 && (
          <>
            {' · '}
            {formerNames
              .map(
                (name) =>
                  `${name.name}${name.valid_to ? ` (until ${name.valid_to.slice(0, 4)})` : ''}`
              )
              .join(', ')}
          </>
        )}
      </p>
      <GrantList title="Grants received" grants={received} side="received" />
      <GrantList title="Grants made" grants={made} side="made" />
      <GrantList title="As fiscal sponsor" grants={sponsored} side="received" />
    </div>
  )
}
