import type { DayPlan, Place, PoiHit, TravelMode } from '../types'
import { uid } from './uid'

export function placeFromHit(hit: PoiHit): Place {
  return {
    id: uid(),
    name: hit.name,
    address: hit.address,
    lng: hit.lng,
    lat: hit.lat,
    city: hit.city,
    poiId: hit.poiId,
  }
}

export function makeDay(title: string, places: Place[] = [], mode: TravelMode = 'driving'): DayPlan {
  return {
    id: uid(),
    title,
    mode,
    places,
  }
}
