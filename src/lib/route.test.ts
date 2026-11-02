import { describe, expect, it } from 'vitest'
import { chunkOverlap, extractRoute } from './route'

describe('chunkOverlap', () => {
  it('keeps a short day in one request', () => {
    expect(chunkOverlap([[0, 0], [1, 1], [2, 2]], 18)).toHaveLength(1)
  })

  it('overlaps chunks so each leg shares its joint point', () => {
    const points = Array.from({ length: 5 }, (_, index) => [index, 0])
    expect(chunkOverlap(points, 2)).toEqual([
      [[0, 0], [1, 0]],
      [[1, 0], [2, 0]],
      [[2, 0], [3, 0]],
      [[3, 0], [4, 0]],
    ])
  })
})

describe('extractRoute', () => {
  it('reads a flat step list and skips a repeated joint', () => {
    const extracted = extractRoute({
      routes: [
        {
          distance: 1200,
          time: 300,
          steps: [
            { path: [{ lng: 1, lat: 2 }, { lng: 1.1, lat: 2.1 }] },
            { path: [{ lng: 1.1, lat: 2.1 }, { getLng: () => 1.2, getLat: () => 2.2 }] },
          ],
        },
      ],
    })
    expect(extracted.distance).toBe(1200)
    expect(extracted.duration).toBe(300)
    expect(extracted.path).toEqual([[1, 2], [1.1, 2.1], [1.2, 2.2]])
  })

  it('flattens waypoint legs that come back as nested steps', () => {
    const extracted = extractRoute({
      routes: [
        {
          distance: 10,
          time: 20,
          steps: [[{ path: [[1, 2], [3, 4]] }], [{ path: [[3, 4], [5, 6]] }]],
        },
      ],
    })
    expect(extracted.path).toEqual([[1, 2], [3, 4], [5, 6]])
  })
})
