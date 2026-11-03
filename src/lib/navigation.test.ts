import { describe, expect, it } from 'vitest'
import { dayNavigationUrl, legNavigationUrl } from './navigation'
import type { Place } from '../types'

function place(id: string, name: string, lng: number, lat: number): Place {
  return { id, name, address: '', lng, lat, city: '杭州', poiId: id }
}

const places = [
  place('a', '西湖', 120.1, 30.2),
  place('b', '灵隐,寺', 120.2, 30.3),
  place('c', '河坊街', 120.3, 30.1),
  place('d', '宋城', 120.4, 30.15),
]

describe('navigation urls', () => {
  it('opens a driving day from the first stop to the last and keeps one via point', () => {
    const url = dayNavigationUrl(places, 'driving') ?? ''
    expect(url.startsWith('https://uri.amap.com/navigation?')).toBe(true)
    expect(url).toContain('from=120.1,30.2,%E8%A5%BF%E6%B9%96')
    expect(url).toContain('to=120.4,30.15,%E5%AE%8B%E5%9F%8E')
    expect(url).toContain('via=120.2,30.3,%E7%81%B5%E9%9A%90%20%E5%AF%BA')
    expect(url).toContain('mode=car')
    expect(url).toContain('callnative=1')
    expect(url).not.toContain('%2C')
  })

  it('does not attach a via point to a walking day', () => {
    const url = dayNavigationUrl(places.slice(0, 3), 'walking') ?? ''
    expect(url).toContain('mode=walk')
    expect(url).not.toContain('via=')
  })

  it('navigates a later stop from the previous one', () => {
    const url = legNavigationUrl(places, 2, 'driving') ?? ''
    expect(url).toContain('from=120.2,30.3,')
    expect(url).toContain('to=120.3,30.1,')
  })

  it('leaves the first stop origin empty so the phone can use the current location', () => {
    const url = legNavigationUrl(places, 0, 'walking') ?? ''
    expect(url).not.toContain('from=')
    expect(url).toContain('mode=walk')
  })
})
