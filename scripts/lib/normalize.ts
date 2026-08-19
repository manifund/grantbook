// Conservative name normalization for entity matching. Deliberately no fuzzy
// matching: near-misses go through data/aliases.json instead.
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(inc|llc|ltd|incorporated)$/, '')
    .trim()
}

// Slugs stay ASCII for URLs; fully non-Latin names get a stable hash slug.
export function slugify(name: string): string {
  const ascii = normalizeName(name)
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-')
    .slice(0, 80)
  if (ascii) return ascii
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return `org-${hash.toString(16)}`
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
