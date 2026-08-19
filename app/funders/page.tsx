import { listFunders } from '@/db/org'
import { formatMoney } from '@/utils/format'

export const revalidate = 3600

export default async function Page() {
  const funders = await listFunders()
  return (
    <div className="overflow-x-auto">
      <table className="gb-table">
        <thead>
          <tr>
            <th>Funder</th>
            <th className="gb-num">Grants</th>
            <th className="gb-num">Total</th>
            <th className="gb-num">Years</th>
          </tr>
        </thead>
        <tbody>
          {funders.map((funder) => (
            <tr key={funder.slug}>
              <td>
                <a href={`/orgs/${funder.slug}`}>{funder.name}</a>
              </td>
              <td className="gb-num">{funder.grantCount.toLocaleString()}</td>
              <td className="gb-num">{formatMoney(funder.totalUsd)}</td>
              <td className="gb-num whitespace-nowrap">
                {funder.firstYear === null
                  ? '—'
                  : funder.firstYear === funder.lastYear
                    ? funder.firstYear
                    : `${funder.firstYear}–${funder.lastYear}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
