// Ortssuche über Photon (Komoot), kostenlos und ohne API-Schlüssel.
// https://photon.komoot.io – Ergebnisse basieren auf OpenStreetMap.

export interface PlaceInput {
  name: string
  lat: number | null
  lng: number | null
  address: string | null
  category: string | null
  source: 'manual' | 'search'
}

export interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    name?: string
    street?: string
    housenumber?: string
    postcode?: string
    city?: string
    district?: string
    state?: string
    country?: string
    osm_key?: string
    osm_value?: string
    type?: string
  }
}

export function photonToPlace(feature: PhotonFeature): PlaceInput {
  const p = feature.properties
  const [lng, lat] = feature.geometry.coordinates
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const town = [p.postcode, p.city ?? p.district].filter(Boolean).join(' ')
  const parts = [street, town, p.country].filter((part) => part && part !== p.name)
  const name = p.name ?? (street || p.city || p.country || 'Unbenannter Ort')
  return {
    name,
    lat,
    lng,
    address: parts.length > 0 ? parts.join(', ') : null,
    category: p.osm_value ?? p.type ?? null,
    source: 'search',
  }
}

export async function searchPlaces(
  query: string,
  options: { near?: { lat: number; lng: number }; signal?: AbortSignal } = {},
): Promise<PlaceInput[]> {
  const params = new URLSearchParams({ q: query, limit: '6', lang: 'de' })
  if (options.near) {
    params.set('lat', String(options.near.lat))
    params.set('lon', String(options.near.lng))
  }
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: options.signal })
  if (!response.ok) throw new Error('Die Ortssuche ist gerade nicht erreichbar')
  const data = (await response.json()) as { features: PhotonFeature[] }
  return data.features.map(photonToPlace)
}

export function manualPlace(name: string): PlaceInput {
  return { name: name.trim(), lat: null, lng: null, address: null, category: null, source: 'manual' }
}
