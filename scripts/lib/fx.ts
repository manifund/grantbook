import fxRates from '@/data/fx-rates.json'

const RATES: Record<string, Record<string, number>> = fxRates as never

// Convert to USD using checked-in annual-average rates. Returns null when the
// rate is unknown so the gap is visible rather than silently wrong.
export function toUsd(amount: number, currency: string, year: number | null): number | null {
  if (currency === 'USD') return amount
  const byYear = RATES[currency]
  if (!byYear) return null
  const years = Object.keys(byYear).map(Number)
  const usable = year ?? Math.max(...years)
  const closest = years.reduce((best, y) =>
    Math.abs(y - usable) < Math.abs(best - usable) ? y : best
  )
  return Math.round(amount * byYear[String(closest)] * 100) / 100
}
