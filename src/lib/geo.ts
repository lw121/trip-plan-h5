export interface LngLat {
  lng: number
  lat: number
}

export function distanceMeters(a: LngLat, b: LngLat): number {
  const earth = 6371000
  const toRad = (degree: number) => (degree * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function readLngLat(value: unknown): LngLat | null {
  if (Array.isArray(value) && value.length >= 2 && value.every((item) => typeof item === 'number')) {
    const lng = value[0]
    const lat = value[1]
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat }
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as { lng?: unknown; lat?: unknown; getLng?: () => unknown; getLat?: () => unknown }
  const lng = typeof record.lng === 'number' ? record.lng : record.getLng?.()
  const lat = typeof record.lat === 'number' ? record.lat : record.getLat?.()
  if (typeof lng === 'number' && typeof lat === 'number' && Number.isFinite(lng) && Number.isFinite(lat)) {
    return { lng, lat }
  }
  return null
}
