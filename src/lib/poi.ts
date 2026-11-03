import { readLngLat } from './geo'
import type { PoiHit } from '../types'

export function parsePoiList(result: unknown): PoiHit[] {
  const root = asRecord(result)
  const poiList = asRecord(root?.poiList)
  const pois = Array.isArray(poiList?.pois) ? poiList.pois : []
  const hits: PoiHit[] = []
  pois.forEach((item) => {
    const poi = asRecord(item)
    if (!poi) return
    const name = asString(poi.name)
    const point = readLngLat(poi.entr_location) ?? readLngLat(poi.location)
    if (!name || !point) return
    const city = asString(poi.cityname) || asString(poi.pname)
    const addressParts = [asString(poi.pname), asString(poi.cityname), asString(poi.adname), asString(poi.address)]
      .filter((part, index, all) => part && all.indexOf(part) === index)
    hits.push({
      poiId: asString(poi.id),
      name,
      address: addressParts.join(''),
      lng: point.lng,
      lat: point.lat,
      city,
    })
  })
  return hits
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
