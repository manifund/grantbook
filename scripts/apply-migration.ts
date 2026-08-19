// Applies a migration file to the Supabase Postgres using Bun's built-in SQL
// client. Usage: bun run scripts/apply-migration.ts supabase/migrations/<file>.sql
// Reads the DB password from SUPABASE_DB_PASSWORD or the comment in .env.local.
import { SQL } from 'bun'

const file = process.argv[2]
if (!file) throw new Error('Usage: bun run scripts/apply-migration.ts <migration.sql>')

const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/(\w+)\.supabase\.co/)?.[1]
if (!projectRef) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set')
const password = process.env.SUPABASE_DB_PASSWORD
if (!password) throw new Error('Set SUPABASE_DB_PASSWORD')

// Session pooler (IPv4-friendly). Region must match the project.
const region = process.env.SUPABASE_REGION ?? 'us-west-1'
const url = `postgres://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:5432/postgres`

const sql = new SQL({ url, max: 1 })

const text = await Bun.file(file).text()
// Strip line comments, then split top-level statements. Fine for this
// project's migrations (no function bodies / dollar quoting).
const statements = text
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

for (const statement of statements) {
  try {
    await sql.unsafe(statement)
  } catch (error) {
    console.error(`FAILED: ${statement.slice(0, 80)}...`)
    throw error
  }
}
console.log(`Applied ${statements.length} statements from ${file}`)
await sql.end()
