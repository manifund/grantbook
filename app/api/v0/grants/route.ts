import { NextResponse } from 'next/server'
import { CORS_HEADERS, grantQueryFromParams, queryGrants, serializeGrant } from '@/db/api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const rows = await queryGrants(grantQueryFromParams(searchParams))
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 1000)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)
  const totalUsd = rows.reduce((sum, row) => sum + (row.amountUsd ?? 0), 0)
  return NextResponse.json(
    {
      total: rows.length,
      total_usd: Math.round(totalUsd),
      limit,
      offset,
      grants: rows.slice(offset, offset + limit).map(serializeGrant),
    },
    { headers: CORS_HEADERS }
  )
}

export function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS })
}
