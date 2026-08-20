import './globals.css'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Grantbook',
  description: 'A database of AI safety grants, aggregated from public sources.',
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6 flex items-baseline gap-6 border-b border-rule pb-3">
          <Link href="/" className="font-serif text-xl font-bold !text-ink hover:!no-underline">
            Grantbook
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/">Grants</Link>
            <Link href="/funders">Funders</Link>
            <Link href="/recipients">Recipients</Link>
            <Link href="/charts">Charts</Link>
            <Link href="/about">About</Link>
          </nav>
        </header>
        {props.children}
      </body>
    </html>
  )
}
