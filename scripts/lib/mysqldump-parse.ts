// Parser for vipulnaik/donations-style hand-written MySQL INSERT files:
//   insert into donations(col1,col2,...) values (v1,...),(v2,...);
// Handles /* */ and -- comments, single-quoted strings with backslash escapes
// and doubled quotes, numbers, and NULL. Not a general SQL parser.

export type SqlValue = string | number | null

type Cursor = { sql: string; i: number }

function skipWhitespaceAndComments(c: Cursor) {
  for (;;) {
    while (c.i < c.sql.length && /\s/.test(c.sql[c.i])) c.i++
    if (c.sql.startsWith('/*', c.i)) {
      const end = c.sql.indexOf('*/', c.i + 2)
      c.i = end === -1 ? c.sql.length : end + 2
    } else if (c.sql.startsWith('--', c.i)) {
      const end = c.sql.indexOf('\n', c.i)
      c.i = end === -1 ? c.sql.length : end + 1
    } else {
      return
    }
  }
}

function parseString(c: Cursor): string {
  // c.i is at the opening quote
  c.i++
  let out = ''
  while (c.i < c.sql.length) {
    const ch = c.sql[c.i]
    if (ch === '\\') {
      const next = c.sql[c.i + 1]
      out += next === 'n' ? '\n' : next === 't' ? '\t' : next
      c.i += 2
    } else if (ch === "'") {
      if (c.sql[c.i + 1] === "'") {
        out += "'"
        c.i += 2
      } else {
        c.i++
        return out
      }
    } else {
      out += ch
      c.i++
    }
  }
  throw new Error('Unterminated string literal')
}

function parseValue(c: Cursor): SqlValue {
  skipWhitespaceAndComments(c)
  const ch = c.sql[c.i]
  if (ch === "'") return parseString(c)
  const word = c.sql.slice(c.i).match(/^[-+]?[A-Za-z0-9_.]+/)?.[0]
  if (!word) throw new Error(`Unexpected character at ${c.i}: ${c.sql.slice(c.i, c.i + 40)}`)
  c.i += word.length
  if (word.toUpperCase() === 'NULL') return null
  const num = Number(word)
  if (Number.isFinite(num)) return num
  return word
}

export function parseInserts(sql: string, table: string): Record<string, SqlValue>[] {
  const rows: Record<string, SqlValue>[] = []
  const c: Cursor = { sql, i: 0 }
  const insertRe = new RegExp(`^insert\\s+into\\s+\`?${table}\`?\\s*\\(`, 'i')

  while (c.i < sql.length) {
    skipWhitespaceAndComments(c)
    if (c.i >= sql.length) break
    const rest = sql.slice(c.i)
    const match = rest.match(insertRe)
    if (!match) {
      // Skip to the end of this statement (respecting strings).
      while (c.i < sql.length) {
        const ch = sql[c.i]
        if (ch === "'") parseString(c)
        else if (sql.startsWith('/*', c.i) || sql.startsWith('--', c.i)) {
          skipWhitespaceAndComments(c)
        } else if (ch === ';') {
          c.i++
          break
        } else c.i++
      }
      continue
    }
    c.i += match[0].length
    const closeParen = sql.indexOf(')', c.i)
    const columns = sql
      .slice(c.i, closeParen)
      .split(',')
      .map((col) => col.trim().replace(/`/g, ''))
    c.i = closeParen + 1
    skipWhitespaceAndComments(c)
    if (!/^values/i.test(sql.slice(c.i))) throw new Error(`Expected VALUES at ${c.i}`)
    c.i += 'values'.length

    for (;;) {
      skipWhitespaceAndComments(c)
      if (sql[c.i] !== '(') break
      c.i++
      const values: SqlValue[] = []
      for (;;) {
        values.push(parseValue(c))
        skipWhitespaceAndComments(c)
        if (sql[c.i] === ',') {
          c.i++
        } else if (sql[c.i] === ')') {
          c.i++
          break
        } else {
          throw new Error(`Expected , or ) at ${c.i}: ${sql.slice(c.i, c.i + 40)}`)
        }
      }
      if (values.length !== columns.length) {
        throw new Error(`Column/value count mismatch: ${columns.length} vs ${values.length}`)
      }
      rows.push(Object.fromEntries(columns.map((col, idx) => [col, values[idx]])))
      skipWhitespaceAndComments(c)
      if (sql[c.i] === ',') {
        c.i++
        continue
      }
      if (sql[c.i] === ';') c.i++
      break
    }
  }
  return rows
}
