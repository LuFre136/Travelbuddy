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
