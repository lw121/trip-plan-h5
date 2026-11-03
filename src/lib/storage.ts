import type { DayPlan, Place, Trip } from '../types'

export const STORAGE_KEY = 'trip-plan-h5:v1'

export function loadTrips(): Trip[] {
  const storage = browserStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    return normalizeTrips(JSON.parse(raw))
  } catch {
    return []
  }
}

export function saveTrips(trips: Trip[]): void {
  const storage = browserStorage()
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips }))
  } catch {
    // Private mode or a full quota should not break editing.
  }
}

export function normalizeTrips(input: unknown): Trip[] {
  const root = asRecord(input)
  const list = Array.isArray(input) ? input : root && Array.isArray(root.trips) ? root.trips : []
  const trips: Trip[] = []
  list.forEach((item) => {
    const trip = asRecord(item)
    if (!trip || typeof trip.id !== 'string') return
    const days = Array.isArray(trip.days) ? trip.days.map(normalizeDay).filter((day): day is DayPlan => Boolean(day)) : []
    if (!days.length) {
      days.push({ id: `${trip.id}:day1`, title: '第1天', mode: 'driving', places: [] })
    }
    const now = Date.now()
    trips.push({
      id: trip.id,
      name: asText(trip.name) || '未命名行程',
      city: asText(trip.city),
      days,
      createdAt: asTime(trip.createdAt) ?? now,
      updatedAt: asTime(trip.updatedAt) ?? now,
    })
  })
  return trips
}

function normalizeDay(value: unknown): DayPlan | null {
  const day = asRecord(value)
  if (!day || typeof day.id !== 'string') return null
  const places = Array.isArray(day.places) ? day.places.map(normalizePlace).filter((place): place is Place => Boolean(place)) : []
  return {
    id: day.id,
    title: asText(day.title) || '未命名的一天',
    mode: day.mode === 'walking' ? 'walking' : 'driving',
    places,
  }
}

function normalizePlace(value: unknown): Place | null {
  const place = asRecord(value)
  if (!place || typeof place.id !== 'string' || !asText(place.name)) return null
  const lng = asFinite(place.lng)
  const lat = asFinite(place.lat)
  if (lng == null || lat == null || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null
  return {
    id: place.id,
    name: asText(place.name),
    address: asText(place.address),
    lng,
    lat,
    city: asText(place.city),
    poiId: asText(place.poiId),
  }
}

function browserStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asTime(value: unknown): number | null {
  const time = asFinite(value)
  return time == null || time < 0 ? null : time
}
