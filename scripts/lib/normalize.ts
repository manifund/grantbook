// Conservative name normalization for entity matching. Deliberately no fuzzy
// matching: near-misses go through data/aliases.json instead.
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(inc|llc|ltd|incorporated)$/, '')
    .trim()
}

export function slugify(name: string): string {
  return normalizeName(name).replace(/\s/g, '-').slice(0, 80) || 'unnamed'
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
