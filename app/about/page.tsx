import { listSources } from '@/db/grant'

export const revalidate = 3600

export default async function Page() {
  const sources = await listSources()
  return (
    <div>
      <h1 className="mb-4 font-serif text-2xl font-bold">Sources</h1>
      <div className="overflow-x-auto">
        <table className="gb-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>License</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>{source.url ? <a href={source.url}>{source.name}</a> : source.name}</td>
                <td>{source.license ?? '—'}</td>
                <td className="whitespace-nowrap">
                  {source.last_ingested_at ? source.last_ingested_at.slice(0, 10) : 'planned'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-ink-muted">
        Predecessors: <a href="https://donations.vipulnaik.com/">donations.vipulnaik.com</a>,{' '}
        <a href="https://openbook.fyi/">openbook.fyi</a>
      </p>
    </div>
  )
}
