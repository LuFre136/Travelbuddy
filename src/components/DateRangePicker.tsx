import { useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { de } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { dateToDayKey, dayKeyToDate } from '../lib/datetime'
import { formatDateRange } from '../lib/format'

export interface DayRange {
  start: string | null
  end: string | null
}

/** Kalender zum Auswählen von „von“ und „bis“. Erster Klick = Anreise, zweiter = Abreise. */
export function DateRangePicker({
  value,
  onChange,
  defaultMonth,
}: {
  value: DayRange
  onChange: (range: DayRange) => void
  /** Monat, der ohne Auswahl angezeigt wird, z. B. der Reisebeginn. */
  defaultMonth?: string | null
}) {
  const [open, setOpen] = useState(!value.start)
  const selected: DateRange | undefined = value.start
    ? { from: dayKeyToDate(value.start), to: dayKeyToDate(value.end) }
    : undefined

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-left dark:border-slate-700 dark:bg-slate-900"
        >
          {value.start ? formatDateRange(value.start, value.end) : 'Zeitraum wählen'}
        </button>
        {value.start && (
          <button
            type="button"
            className="text-brand-700 hover:underline dark:text-brand-100"
            onClick={() => onChange({ start: null, end: null })}
          >
            Zurücksetzen
          </button>
        )}
      </div>
      {open && (
        <DayPicker
          mode="range"
          locale={de}
          weekStartsOn={1}
          defaultMonth={selected?.from ?? dayKeyToDate(defaultMonth ?? null)}
          selected={selected}
          onSelect={(range) => onChange({ start: dateToDayKey(range?.from), end: dateToDayKey(range?.to) })}
          className="tb-calendar rounded-xl border border-slate-200 p-3 dark:border-slate-800"
        />
      )}
    </div>
  )
}
