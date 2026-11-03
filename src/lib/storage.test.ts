import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTrips, normalizeTrips, saveTrips, STORAGE_KEY } from './storage'
import type { Trip } from '../types'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size
    },
  })
})

describe('trip storage', () => {
  it('drops broken places and keeps a stable empty day', () => {
    const trips = normalizeTrips({
      version: 1,
      trips: [
        {
          id: 'trip-1',
          name: ' 杭州 ',
          city: '杭州',
          days: [
            {
              id: 'day-1',
              title: '第1天',
              mode: 'walking',
              places: [
                { id: 'ok', name: '西湖', lng: 120.1, lat: 30.2 },
                { id: 'bad', name: '坏坐标', lng: 999, lat: 30 },
              ],
            },
          ],
        },
        { id: 'trip-2', name: '', days: [] },
      ],
    })
    expect(trips[0]?.days[0]?.mode).toBe('walking')
    expect(trips[0]?.days[0]?.places.map((place) => place.name)).toEqual(['西湖'])
    expect(trips[1]?.name).toBe('未命名行程')
    expect(trips[1]?.days[0]?.id).toBe('trip-2:day1')
  })

  it('round-trips through localStorage', () => {
    const trip: Trip = {
      id: 'trip-1',
      name: '杭州',
      city: '杭州',
      createdAt: 1,
      updatedAt: 2,
      days: [
        {
          id: 'day-1',
          title: '第1天',
          mode: 'driving',
          places: [
            { id: 'p1', name: '西湖', address: '龙井路', lng: 120.1, lat: 30.2, city: '杭州', poiId: 'B1' },
          ],
        },
      ],
    }
    saveTrips([trip])
    expect(memory.get(STORAGE_KEY)).toContain('西湖')
    expect(loadTrips()).toEqual([trip])
  })

  it('ignores corrupt saved text', () => {
    memory.set(STORAGE_KEY, '{')
    expect(loadTrips()).toEqual([])
  })
})
