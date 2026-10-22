const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })

function parseDate(value: string): Date {
  // Datumswerte aus Postgres ("2027-05-01") als lokale Daten lesen, nicht als UTC.
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Datum offen'
  if (start && !end) return `ab ${dateFormat.format(parseDate(start))}`
  if (!start && end) return `bis ${dateFormat.format(parseDate(end))}`
  return dateFormat.formatRange(parseDate(start!), parseDate(end!))
}

export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/join/${encodeURIComponent(token)}`
}

const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDateTime(iso: string | null): string | null {
  return iso ? dateTimeFormat.format(new Date(iso)) : null
}

export function parseCost(value: string): number | null {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

const money = new Map<string, Intl.NumberFormat>()

export function formatCost(cost: number | null, currency: string | null): string | null {
  if (cost === null) return null
  const code = currency ?? 'EUR'
  let format = money.get(code)
  if (!format) {
    try {
      format = new Intl.NumberFormat('de-DE', { style: 'currency', currency: code })
    } catch {
      format = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 })
    }
    money.set(code, format)
  }
  return format.format(cost)
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}
