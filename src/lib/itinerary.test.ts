import { describe, expect, it } from 'vitest'
import { orderByNearest, parsePlaceText, splitPlaces } from './itinerary'

describe('parsePlaceText', () => {
  it('keeps a plain list as one group', () => {
    const parsed = parsePlaceText('1. 西湖\n2、灵隐寺\n- 河坊街')
    expect(parsed.grouped).toBe(false)
    expect(parsed.groups[0]?.names).toEqual(['西湖', '灵隐寺', '河坊街'])
  })

  it('splits blank lines and dash lines into days', () => {
    const parsed = parsePlaceText('西湖\n灵隐寺\n\n---\n千岛湖')
    expect(parsed.grouped).toBe(true)
    expect(parsed.groups.map((group) => group.names)).toEqual([['西湖', '灵隐寺'], ['千岛湖']])
    expect(parsed.groups.map((group) => group.title)).toEqual(['第1天', '第2天'])
  })

  it('splits day headers, including Chinese numerals and places on the header line', () => {
    const parsed = parsePlaceText('西湖、灵隐寺\n第２天：宋城\n第三天\n千岛湖')
    expect(parsed.grouped).toBe(true)
    expect(parsed.groups.map((group) => group.title)).toEqual(['第1天', '第2天', '第3天'])
    expect(parsed.groups.map((group) => group.names)).toEqual([['西湖', '灵隐寺'], ['宋城'], ['千岛湖']])
  })
})

describe('splitPlaces', () => {
  it('gives earlier days the remainder', () => {
    expect(splitPlaces([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { days: 3 }).map((day) => day.length)).toEqual([4, 3, 3])
  })

  it('uses places per day when a day count is not given', () => {
    expect(splitPlaces(['a', 'b', 'c', 'd', 'e'], { perDay: 4 })).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ])
  })

  it('does not create empty days', () => {
    expect(splitPlaces(['a', 'b'], { days: 5 })).toEqual([['a'], ['b']])
  })
})

describe('orderByNearest', () => {
  it('keeps the first stop and then visits the nearest remaining point', () => {
    const ordered = orderByNearest([
      { id: 'start', lng: 0, lat: 0 },
      { id: 'far', lng: 3, lat: 0 },
      { id: 'near', lng: 1, lat: 0 },
      { id: 'mid', lng: 2, lat: 0 },
    ])
    expect(ordered.map((place) => place.id)).toEqual(['start', 'near', 'mid', 'far'])
  })
})
