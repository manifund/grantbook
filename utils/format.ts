export function formatMoney(amount: number | null, currency = 'USD') {
  if (amount === null) return '—'
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
  return formatted
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatGrantDate(date: string | null, precision: 'day' | 'month' | 'year' | null) {
  if (!date) return '—'
  const [year, month, day] = date.split('-').map(Number)
  if (precision === 'year') return String(year)
  if (precision === 'month') return `${MONTHS[month - 1]} ${year}`
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

// Footnote markers for estimated amounts, in table order.
export const ESTIMATE_SYMBOLS = ['*', '\u2020', '\u2021', '\u00a7', '\u00b6']
