import { lazy, Suspense, useMemo, useState } from 'react'
import { kindColors } from '../../components/map/colors'
import { formatDay } from '../../lib/datetime'
import { buildMapData, type MapKind } from '../../lib/mapdata'
import { buildTimeline } from '../../lib/timeline'
import { Select } from '../../components/ui'
import { EmptyState, type TabProps } from './shared'

// MapLibre ist groß; erst laden, wenn jemand die Karte öffnet.
const MapView = lazy(() => import('../../components/map/MapView'))

const kindLabels: Record<MapKind, string> = {
  stay: 'Unterkünfte',
  activity: 'Aktivitäten',
  waypoint: 'Transfers',
}

export function MapTab({ trip, plan }: TabProps) {
  const [day, setDay] = useState<string>('all')
  const [kinds, setKinds] = useState<Set<MapKind>>(() => new Set(['stay', 'activity', 'waypoint']))
  const days = useMemo(() => buildTimeline(trip, plan).days.map((d) => d.key), [trip, plan])
  const data = useMemo(() => buildMapData(plan, { day, kinds }), [plan, day, kinds])

  function toggle(kind: MapKind) {
    setKinds((current) => {
      const next = new Set(current)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-64">
          <Select id="map-day" aria-label="Tag" value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="all">Alle Tage</option>
            {days.map((key, i) => (
              <option key={key} value={key}>
                Tag {i + 1}: {formatDay(key)}
              </option>
            ))}
          </Select>
        </div>
        <div role="group" aria-label="Was zeigen" className="flex flex-wrap gap-2">
          {(Object.keys(kindLabels) as MapKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={kinds.has(kind)}
              onClick={() => toggle(kind)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                kinds.has(kind)
                  ? 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
                  : 'border-dashed border-slate-300 text-slate-400 dark:border-slate-700'
              }`}
            >
              <span className="size-2.5 rounded-full" style={{ background: kindColors[kind] }} />
              {kindLabels[kind]}
            </button>
          ))}
        </div>
      </div>

      <Suspense
        fallback={<div className="h-[60vh] min-h-80 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />}
      >
        <MapView data={data} />
      </Suspense>

      <p className="text-xs text-slate-500">
        Ausgefüllter Punkt: eingeplant, heller Punkt: optional. Transfers sind als Luftlinie zwischen den Wegpunkten
        gezeichnet.
      </p>

      {data.points.length === 0 && data.lines.length === 0 && (
        <EmptyState>Für diese Auswahl gibt es keine Orte mit Kartenposition.</EmptyState>
      )}

      {data.unplaced.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="font-medium">Ohne Kartenposition</p>
          <p className="text-slate-500">
            Diese Orte wurden ohne Suche eingetragen. Wähle sie beim Bearbeiten über die Ortssuche aus, damit sie auf
            der Karte erscheinen.
          </p>
          <ul className="list-disc pl-5 text-slate-600 dark:text-slate-300">
            {data.unplaced.map((u) => (
              <li key={u.id}>{u.title}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
