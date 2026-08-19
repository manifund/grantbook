'use client'

import { Popover } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { GrantRow } from '@/db/grant'
import { formatGrantDate, formatMoney } from '@/utils/format'
import {
  applyFilters,
  filtersFromParams,
  filtersToParams,
  type GrantFilters,
} from '@/utils/grant-filters'

const PAGE = 200

function MultiSelect(props: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const { label, options, selected, onChange } = props
  return (
    <Popover className="relative">
      <Popover.Button className="flex items-center gap-1 rounded border border-rule bg-paper-alt px-2 py-1 text-sm">
        {label}
        {selected.length > 0 && <span className="text-accent">({selected.length})</span>}
        <ChevronDownIcon className="h-4 w-4 text-ink-muted" />
      </Popover.Button>
      <Popover.Panel className="absolute z-10 mt-1 max-h-72 w-64 overflow-y-auto rounded border border-rule bg-paper p-2 shadow-none">
        {selected.length > 0 && (
          <button className="mb-1 text-xs text-accent" onClick={() => onChange([])}>
            clear
          </button>
        )}
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 py-0.5 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, option.value]
                    : selected.filter((v) => v !== option.value)
                )
              }
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </Popover.Panel>
    </Popover>
  )
}

export function GrantsTable(props: {
  grants: GrantRow[]
  sources: { id: string; name: string }[]
  causeOptions: { slug: string; name: string }[]
  cause: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<GrantFilters>(() =>
    filtersFromParams(new URLSearchParams(searchParams.toString()))
  )
  const [limit, setLimit] = useState(PAGE)

  const update = (partial: Partial<GrantFilters>) => {
    const next = { ...filters, ...partial }
    setFilters(next)
    setLimit(PAGE)
    const params = filtersToParams(next, props.cause)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const setCause = (cause: string) => {
    const params = filtersToParams(filters, cause)
    router.push(`${pathname}?${params.toString()}`)
  }

  const funderOptions = useMemo(() => {
    const names = new Map<string, string>()
    for (const grant of props.grants) names.set(grant.funderSlug, grant.funderName)
    return Array.from(names.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [props.grants])

  const sourceOptions = props.sources.map((source) => ({ value: source.id, label: source.name }))

  const rows = useMemo(() => applyFilters(props.grants, filters), [props.grants, filters])
  const totalUsd = useMemo(() => rows.reduce((sum, row) => sum + (row.amountUsd ?? 0), 0), [rows])

  const sortHeader = (key: GrantFilters['sort'], label: string, numeric = false) => (
    <th
      className={numeric ? 'gb-num cursor-pointer' : 'cursor-pointer'}
      onClick={() =>
        update(
          filters.sort === key
            ? { dir: filters.dir === 'asc' ? 'desc' : 'asc' }
            : { sort: key, dir: key === 'date' || key === 'amount' ? 'desc' : 'asc' }
        )
      }
    >
      {label}
      {filters.sort === key ? (filters.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  )

  const csvHref = `/grants.csv?${filtersToParams(filters, props.cause).toString()}`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search"
          value={filters.q}
          onChange={(e) => update({ q: e.target.value })}
          className="w-56 rounded border border-rule bg-paper px-2 py-1 text-sm"
        />
        <MultiSelect
          label="Funder"
          options={funderOptions}
          selected={filters.funders}
          onChange={(funders) => update({ funders })}
        />
        <MultiSelect
          label="Source"
          options={sourceOptions}
          selected={filters.sources}
          onChange={(sources) => update({ sources })}
        />
        <select
          value={props.cause}
          onChange={(e) => setCause(e.target.value)}
          className="rounded border border-rule bg-paper-alt px-2 py-1 text-sm"
        >
          <option value="all">All causes</option>
          {props.causeOptions.map((cause) => (
            <option key={cause.slug} value={cause.slug}>
              {cause.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="From"
          value={filters.yearMin ?? ''}
          onChange={(e) => update({ yearMin: e.target.value ? Number(e.target.value) : null })}
          className="w-20 rounded border border-rule bg-paper px-2 py-1 text-sm"
        />
        <input
          type="number"
          placeholder="To"
          value={filters.yearMax ?? ''}
          onChange={(e) => update({ yearMax: e.target.value ? Number(e.target.value) : null })}
          className="w-20 rounded border border-rule bg-paper px-2 py-1 text-sm"
        />
        <a href={csvHref} className="ml-auto text-sm">
          CSV
        </a>
      </div>

      <div className="overflow-x-auto">
        <table className="gb-table">
          <thead>
            <tr>
              {sortHeader('date', 'Date')}
              {sortHeader('funder', 'Funder')}
              {sortHeader('recipient', 'Recipient')}
              {sortHeader('amount', 'Amount', true)}
              <th>Source</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((row) => (
              <tr key={row.id}>
                <td className="whitespace-nowrap">
                  {formatGrantDate(row.date, row.datePrecision)}
                </td>
                <td>
                  <a href={`/orgs/${row.funderSlug}`}>{row.funderName}</a>
                </td>
                <td>
                  <a href={`/orgs/${row.recipientSlug}`}>{row.recipientName}</a>
                  {row.sponsorName && (
                    <span className="block text-xs text-ink-muted">
                      via <a href={`/orgs/${row.sponsorSlug}`}>{row.sponsorName}</a>
                    </span>
                  )}
                </td>
                <td className="gb-num whitespace-nowrap">{formatMoney(row.amountUsd)}</td>
                <td className="whitespace-nowrap">
                  {row.url ? <a href={row.url}>{row.sourceId}</a> : row.sourceId}
                </td>
                <td className="max-w-md">
                  <span className="line-clamp-2">{row.description}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-baseline gap-4 text-sm text-ink-muted">
        <span>
          {rows.length.toLocaleString()} grants · {formatMoney(totalUsd)}
        </span>
        {limit < rows.length && (
          <button className="text-accent" onClick={() => setLimit(limit + PAGE)}>
            Show more
          </button>
        )}
      </div>
    </div>
  )
}
