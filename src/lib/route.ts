import { readLngLat } from './geo'

export interface ExtractedRoute {
  path: number[][]
  distance: number
  duration: number
}

export function chunkOverlap(points: number[][], size: number): number[][][] {
  if (points.length === 0) return []
  const max = Math.max(2, size)
  if (points.length <= max) return [points.slice()]
  const chunks: number[][][] = []
  let index = 0
  while (index < points.length - 1) {
    const slice = points.slice(index, Math.min(index + max, points.length))
    if (slice.length < 2) break
    chunks.push(slice)
    index += slice.length - 1
  }
  return chunks
}

export function extractRoute(result: unknown): ExtractedRoute {
  const route = firstRoute(result)
  if (!route) return { path: [], distance: 0, duration: 0 }
  const path: number[][] = []
  collectPath(route.steps, path)
  if (!path.length) collectPath(route.path, path)
  return {
    path: dedupeConsecutive(path),
    distance: asNumber(route.distance),
    duration: asNumber(route.time),
  }
}

function firstRoute(result: unknown): Record<string, unknown> | null {
  const root = asRecord(result)
  const routes = root && Array.isArray(root.routes) ? root.routes : []
  return asRecord(routes[0])
}

function collectPath(node: unknown, out: number[][]) {
  if (Array.isArray(node)) {
    if (isCoordinatePair(node)) {
      const point = readLngLat(node)
      if (point) out.push([point.lng, point.lat])
      return
    }
    node.forEach((item) => collectPath(item, out))
    return
  }
  const record = asRecord(node)
  if (record && (record.path || record.steps)) {
    collectPath(record.steps ?? record.path, out)
    return
  }
  const point = readLngLat(node)
  if (point) out.push([point.lng, point.lat])
}

function isCoordinatePair(value: unknown[]): boolean {
  return value.length >= 2 && value.length <= 3 && value.every((item) => typeof item === 'number')
}

function dedupeConsecutive(path: number[][]): number[][] {
  const result: number[][] = []
  path.forEach((point) => {
    const previous = result[result.length - 1]
    if (previous && Math.abs(previous[0] - point[0]) < 1e-6 && Math.abs(previous[1] - point[1]) < 1e-6) return
    result.push(point)
  })
  return result
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}
