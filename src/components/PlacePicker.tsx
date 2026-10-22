import { useEffect, useId, useState } from 'react'
import { manualPlace, searchPlaces, type PlaceInput } from '../lib/places'
import type { Place } from '../lib/plan'
import { Input, TextButton } from './ui'

interface Props {
  id?: string
  value: PlaceInput | Place | null
  onChange: (place: PlaceInput | Place | null) => void
  placeholder?: string
}

export function PlacePicker({ id, value, onChange, placeholder = 'Ort, Adresse oder Name suchen' }: Props) {
  const fallbackId = useId()
  const inputId = id ?? fallbackId
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceInput[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      setError(null)
      try {
        setResults(await searchPlaces(q, { signal: controller.signal }))
      } catch (e) {
        if (!controller.signal.aborted) setError((e as Error).message)
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700">
        <div className="min-w-0">
          <p className="font-medium">{value.name}</p>
          <p className="text-xs text-slate-500">
            {value.address ?? (value.lat === null ? 'Ohne Kartenposition' : 'Position bekannt')}
          </p>
        </div>
        <TextButton onClick={() => onChange(null)}>Ändern</TextButton>
      </div>
    )
  }

  function pick(place: PlaceInput) {
    onChange(place)
    setQuery('')
    setResults([])
  }

  return (
    <div className="relative">
      <Input
        id={inputId}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {query.trim().length >= 2 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {searching && <li className="px-3 py-2 text-slate-500">Sucht …</li>}
          {error && <li className="px-3 py-2 text-red-700 dark:text-red-400">{error}</li>}
          {results.map((place, i) => (
            <li key={`${place.name}-${i}`}>
              <button
                type="button"
                onClick={() => pick(place)}
                className="block w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="block font-medium">{place.name}</span>
                {place.address && <span className="block text-xs text-slate-500">{place.address}</span>}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => pick(manualPlace(query))}
              className="block w-full border-t border-slate-100 px-3 py-2 text-left text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              „{query.trim()}“ ohne Kartenposition übernehmen
            </button>
          </li>
        </ul>
      )}
      <p className="mt-1 text-xs text-slate-500">Ortssuche: © OpenStreetMap-Mitwirkende, Photon</p>
    </div>
  )
}
