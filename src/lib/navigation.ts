import type { Place, TravelMode } from '../types'

function token(place: Place): string {
  const name = place.name.replace(/[,，]/g, ' ').trim()
  return `${place.lng},${place.lat},${encodeURIComponent(name)}`
}

export function navigationUrl(options: {
  to: Place
  from?: Place | null
  via?: Place | null
  mode: TravelMode
}): string {
  const mode = options.mode === 'walking' ? 'walk' : 'car'
  const parts = [`to=${token(options.to)}`, `mode=${mode}`, 'policy=0', 'callnative=1', 'src=tripplanh5']
  if (options.from) parts.unshift(`from=${token(options.from)}`)
  if (options.via && options.mode === 'driving') parts.push(`via=${token(options.via)}`)
  return `https://uri.amap.com/navigation?${parts.join('&')}`
}

export function dayNavigationUrl(places: Place[], mode: TravelMode): string | null {
  if (!places.length) return null
  if (places.length === 1) return navigationUrl({ to: places[0], mode })
  const from = places[0]
  const to = places[places.length - 1]
  let via: Place | null = null
  if (mode === 'driving' && places.length >= 3) {
    via = places[Math.floor((places.length - 1) / 2)] ?? null
    if (via && (via.id === from.id || via.id === to.id)) via = places[1] ?? null
  }
  return navigationUrl({ from, to, via, mode })
}

export function legNavigationUrl(places: Place[], index: number, mode: TravelMode): string | null {
  const to = places[index]
  if (!to) return null
  const from = index > 0 ? places[index - 1] : null
  return navigationUrl({ from, to, mode })
}

export function dayNavigationHint(count: number, mode: TravelMode): string {
  if (count <= 1) return ''
  if (mode === 'walking' && count > 2) {
    return '步行导航链接不含途经点。「导航本日」会从第一站到最后一站，地图上仍画出全程。逐站「导航」可以一段段走。'
  }
  if (count > 3) {
    return '高德导航链接最多 1 个途经点。地点更多时，「导航本日」从第一站到最后一站，并带上中间一站。逐站「导航」会按顺序走完。'
  }
  return ''
}
