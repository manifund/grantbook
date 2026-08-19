import { grantYearRange, listCauseAreas } from '@/db/grant'
import { listOrgAggregates } from '@/db/org'
import { formatMoney } from '@/utils/format'

export type OrgIndexSearchParams = { cause?: string; yearMin?: string; yearMax?: string }

// Shared server-rendered index for /funders and /recipients: a plain GET
// filter form plus the aggregate table. No client JS.
export async function OrgIndex(props: {
  side: 'funder' | 'recipient'
  searchParams: OrgIndexSearchParams
}) {
  const cause = props.searchParams.cause ?? 'ai-safety'
  const yearMin = Number(props.searchParams.yearMin) || null
  const yearMax = Number(props.searchParams.yearMax) || null
  const [rows, causeAreas, yearRange] = await Promise.all([
    listOrgAggregates(props.side, { cause, yearMin, yearMax }),
    listCauseAreas(),
    grantYearRange(),
  ])
  const totalUsd = rows.reduce((sum, row) => sum + row.totalUsd, 0)
  const years: number[] = []
  for (let year = yearRange.max; year >= yearRange.min; year--) years.push(year)

  return (
    <div>
      <form method="get" className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <select
          name="cause"
          defaultValue={cause}
          className="rounded border border-rule bg-paper-alt px-2 py-1"
        >
          <option value="all">All causes</option>
          {causeAreas.map((area) => (
            <option key={area.slug} value={area.slug}>
              {area.name}
            </option>
          ))}
        </select>
        <select
          name="yearMin"
          defaultValue={yearMin ?? ''}
          className="rounded border border-rule bg-paper-alt px-2 py-1"
        >
          <option value="">From: start</option>
          {years.map((year) => (
            <option key={year} value={year}>
              From {year}
            </option>
          ))}
        </select>
        <select
          name="yearMax"
          defaultValue={yearMax ?? ''}
          className="rounded border border-rule bg-paper-alt px-2 py-1"
        >
          <option value="">To: present</option>
          {years.map((year) => (
            <option key={year} value={year}>
              To {year}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded border border-rule bg-paper-alt px-3 py-1">
          Apply
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="gb-table">
          <thead>
            <tr>
              <th>{props.side === 'funder' ? 'Funder' : 'Recipient'}</th>
              <th className="gb-num">Grants</th>
              <th className="gb-num">Total</th>
              <th className="gb-num">Years</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug}>
                <td>
                  <a href={`/orgs/${row.slug}`}>{row.name}</a>
                </td>
                <td className="gb-num">{row.grantCount.toLocaleString()}</td>
                <td className="gb-num">{formatMoney(row.totalUsd)}</td>
                <td className="gb-num whitespace-nowrap">
                  {row.firstYear === null
                    ? '—'
                    : row.firstYear === row.lastYear
                      ? row.firstYear
                      : `${row.firstYear}–${row.lastYear}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        {rows.length.toLocaleString()} {props.side === 'funder' ? 'funders' : 'recipients'} ·{' '}
        {formatMoney(totalUsd)}
      </p>
    </div>
  )
}
