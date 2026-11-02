export type TravelMode = 'driving' | 'walking'

export interface Place {
  id: string
  name: string
  address: string
  lng: number
  lat: number
  city: string
  poiId: string
}

export interface DayPlan {
  id: string
  title: string
  mode: TravelMode
  places: Place[]
}

export interface Trip {
  id: string
  name: string
  city: string
  days: DayPlan[]
  createdAt: number
  updatedAt: number
}

export interface PoiHit {
  poiId: string
  name: string
  address: string
  lng: number
  lat: number
  city: string
}

export interface RouteSummary {
  distance: number
  duration: number
  routedLegs: number
  totalLegs: number
  text: string
}
