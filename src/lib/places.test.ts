import { describe, expect, it } from 'vitest'
import { manualPlace, photonToPlace } from './places'

describe('photonToPlace', () => {
  it('übernimmt Name, Koordinaten und Adresse', () => {
    const place = photonToPlace({
      geometry: { coordinates: [-9.1459, 38.7071] },
      properties: {
        name: 'Time Out Market',
        street: 'Avenida 24 de Julho',
        housenumber: '49',
        postcode: '1200-479',
        city: 'Lissabon',
        country: 'Portugal',
        osm_value: 'marketplace',
      },
    })
    expect(place).toEqual({
      name: 'Time Out Market',
      lat: 38.7071,
      lng: -9.1459,
      address: 'Avenida 24 de Julho 49, 1200-479 Lissabon, Portugal',
      category: 'marketplace',
      source: 'search',
    })
  })

  it('nimmt die Stadt als Namen, wenn kein Name da ist', () => {
    const place = photonToPlace({
      geometry: { coordinates: [-8.61, 41.15] },
      properties: { city: 'Porto', country: 'Portugal', type: 'city' },
    })
    expect(place.name).toBe('Porto')
    expect(place.address).toBe('Porto, Portugal')
  })
})

describe('manualPlace', () => {
  it('legt einen Ort ohne Koordinaten an', () => {
    expect(manualPlace('  Oma Rosas Haus ')).toMatchObject({ name: 'Oma Rosas Haus', lat: null, source: 'manual' })
  })
})
