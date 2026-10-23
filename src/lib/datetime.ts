// Hilfen für <input type="datetime-local"> und die Anzeige in lokaler Zeit.

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** ISO-Zeitstempel aus der DB → Wert für datetime-local ("2027-05-01T14:30"). */
export function toDateTimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Wert aus datetime-local (lokale Zeit) → ISO-Zeitstempel für die DB. */
export function fromDateTimeInput(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

/** Lokales Datum als Schlüssel "YYYY-MM-DD". */
export function localDayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Uhrzeit "14:30" aus ISO-Zeitstempel oder aus Postgres-time ("14:30:00"). */
export function formatTime(value: string | null): string | null {
  if (!value) return null
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5)
  const d = new Date(value)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const dayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

export function formatDay(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return dayFormat.format(new Date(y, m - 1, d))
}

/** "YYYY-MM-DD" → lokales Date um Mitternacht. */
export function dayKeyToDate(dayKey: string | null): Date | undefined {
  if (!dayKey) return undefined
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Lokales Date → "YYYY-MM-DD". */
export function dateToDayKey(date: Date | undefined): string | null {
  if (!date) return null
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
