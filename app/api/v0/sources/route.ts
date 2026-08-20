import { NextResponse } from 'next/server'
import { CORS_HEADERS } from '@/db/api'
import { listSources } from '@/db/grant'

export async function GET() {
  const sources = await listSources()
  return NextResponse.json(
    {
      sources: sources.map((source) => ({
        id: source.id,
        name: source.name,
        url: source.url,
        last_ingested_at: source.last_ingested_at,
      })),
    },
    { headers: CORS_HEADERS }
  )
}

export function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}
