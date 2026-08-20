'use client'

import { useEffect, useRef, useState } from 'react'

export function OrgSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ slug: string; name: string }[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/org-search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        setResults(await res.json())
        setOpen(true)
        setActive(-1)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (slug: string) => {
    window.location.href = `/orgs/${slug}`
  }

  return (
    <div ref={wrap} className="relative ml-auto">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, -1))
          } else if (e.key === 'Enter' && open && results.length > 0) {
            go(results[Math.max(active, 0)].slug)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder="Search orgs"
        className="w-44 rounded border border-rule bg-paper-alt px-2 py-1 text-sm sm:w-56"
      />
      {open && results.length > 0 && (
        <ul className="absolute right-0 z-20 mt-1 w-72 rounded border border-rule bg-paper py-1 text-sm">
          {results.map((r, i) => (
            <li key={r.slug}>
              <button
                className={`block w-full truncate px-3 py-1 text-left ${i === active ? 'bg-paper-alt' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.slug)}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
