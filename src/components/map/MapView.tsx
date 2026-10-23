import { useEffect, useRef } from 'react'
import maplibregl, { type FilterSpecification, type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { toGeoJson, type MapData } from '../../lib/mapdata'
import { kindColors } from './colors'

// Kostenlose Vektorkarte ohne API-Schlüssel: https://openfreemap.org
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

function popupContent(title: string, subtitle: string): HTMLElement {
  // DOM statt HTML-String, damit Namen aus Nutzereingaben nicht als HTML interpretiert werden.
  const root = document.createElement('div')
  root.style.cssText = 'font: 14px/1.4 system-ui, sans-serif; color: #15211e; max-width: 220px'
  const strong = document.createElement('strong')
  strong.textContent = title
  root.append(strong)
  if (subtitle) {
    const small = document.createElement('div')
    small.style.cssText = 'color: #56645f; font-size: 12px; margin-top: 2px'
    small.textContent = subtitle
    root.append(small)
  }
  return root
}

export default function MapView({ data }: { data: MapData }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibreMap | null>(null)
  const loaded = useRef(false)
  const latest = useRef(data)
  latest.current = data

  useEffect(() => {
    if (!container.current) return
    const instance = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: [10, 50],
      zoom: 3,
      attributionControl: { compact: true },
    })
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.current = instance

    instance.on('load', () => {
      const geo = toGeoJson(latest.current)
      instance.addSource('lines', { type: 'geojson', data: geo.lines })
      instance.addSource('points', { type: 'geojson', data: geo.points })
      // Flüge und Fähren gestrichelt, Landwege durchgezogen.
      const overWater: FilterSpecification = ['in', ['get', 'mode'], ['literal', ['flight', 'ferry']]]
      const linePaint = { 'line-color': kindColors.waypoint, 'line-width': 3, 'line-opacity': 0.7 }
      instance.addLayer({
        id: 'transfer-lines',
        type: 'line',
        source: 'lines',
        filter: ['!', overWater],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: linePaint,
      })
      instance.addLayer({
        id: 'transfer-lines-dashed',
        type: 'line',
        source: 'lines',
        filter: overWater,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { ...linePaint, 'line-dasharray': [2, 1.5] },
      })
      instance.addLayer({
        id: 'place-points',
        type: 'circle',
        source: 'points',
        // Unterkünfte über Aktivitäten über Wegpunkten, falls sie am selben Ort liegen.
        layout: { 'circle-sort-key': ['match', ['get', 'kind'], 'stay', 3, 'activity', 2, 1] },
        paint: {
          'circle-radius': ['match', ['get', 'kind'], 'waypoint', 6, 8],
          'circle-color': [
            'case',
            ['==', ['get', 'status'], 'optional'],
            '#ffffff',
            ['match', ['get', 'kind'], 'stay', kindColors.stay, 'activity', kindColors.activity, kindColors.waypoint],
          ],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': [
            'match',
            ['get', 'kind'],
            'activity',
            kindColors.activity,
            'stay',
            '#ffffff',
            '#ffffff',
          ],
        },
      })

      instance.on('click', 'place-points', (event) => {
        const feature = event.features?.[0]
        if (!feature || feature.geometry.type !== 'Point') return
        const props = feature.properties as { title: string; subtitle: string }
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setDOMContent(popupContent(props.title, props.subtitle))
          .addTo(instance)
      })
      instance.on('click', ['transfer-lines', 'transfer-lines-dashed'], (event) => {
        // Punkte haben Vorrang, wenn beide getroffen werden.
        if (instance.queryRenderedFeatures(event.point, { layers: ['place-points'] }).length > 0) return
        const feature = event.features?.[0]
        if (!feature) return
        new maplibregl.Popup({ offset: 6 })
          .setLngLat(event.lngLat)
          .setDOMContent(popupContent((feature.properties as { title: string }).title, ''))
          .addTo(instance)
      })
      instance.on('mouseenter', 'place-points', () => (instance.getCanvas().style.cursor = 'pointer'))
      instance.on('mouseleave', 'place-points', () => (instance.getCanvas().style.cursor = ''))

      loaded.current = true
      fit(instance, latest.current, false)
    })

    return () => {
      loaded.current = false
      instance.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance || !loaded.current) return
    const geo = toGeoJson(data)
    ;(instance.getSource('points') as GeoJSONSource).setData(geo.points)
    ;(instance.getSource('lines') as GeoJSONSource).setData(geo.lines)
    fit(instance, data, true)
  }, [data])

  return <div ref={container} className="h-[60vh] min-h-80 w-full overflow-hidden rounded-xl" />
}

function fit(instance: MapLibreMap, data: MapData, animate: boolean) {
  if (!data.bounds) return
  const [minLng, minLat, maxLng, maxLat] = data.bounds
  instance.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding: 48, maxZoom: 14, animate },
  )
}
