import { load as loadAmapScript } from '@amap/amap-jsapi-loader'
import * as amapLoaderModule from '@amap/amap-jsapi-loader'
import { distanceMeters } from './geo'
import { parsePoiList } from './poi'
import { chunkOverlap, extractRoute } from './route'
import type { PoiHit, TravelMode } from '../types'

const PLUGINS = ['AMap.Scale', 'AMap.ToolBar', 'AMap.PlaceSearch', 'AMap.Driving', 'AMap.Walking']
const DRIVING_MAX_POINTS = 18

export interface AMapNamespace {
  Map: new (container: HTMLElement, options?: Record<string, unknown>) => AMapMap
  Marker: new (options: Record<string, unknown>) => AMapMarker
  Polyline: new (options: Record<string, unknown>) => AMapMarker
  Pixel: new (x: number, y: number) => unknown
  Scale: new (options?: Record<string, unknown>) => unknown
  ToolBar: new (options?: Record<string, unknown>) => unknown
  PlaceSearch: new (options?: Record<string, unknown>) => PlaceSearcher
  Driving: new (options?: Record<string, unknown>) => RouteSearcher
  Walking: new (options?: Record<string, unknown>) => RouteSearcher
}

interface AMapMap {
  add: (overlay: unknown) => void
  remove: (overlay: unknown) => void
  destroy: () => void
  resize: () => void
  setFitView: (overlays?: unknown, immediately?: boolean, avoid?: number[]) => void
  setZoomAndCenter: (zoom: number, center: number[]) => void
  panTo: (position: number[]) => void
  addControl: (control: unknown) => void
}

interface AMapMarker {
  on: (event: string, handler: () => void) => void
}

interface PlaceSearcher {
  setCity: (city: string) => void
  setCityLimit?: (limit: boolean) => void
  search: (keyword: string, callback: (status: string, result: unknown) => void) => void
}

interface RouteSearcher {
  search: (...args: unknown[]) => void
}

export interface PlannedRoute {
  path: number[][]
  distance: number
  duration: number
  routedLegs: number
  totalLegs: number
}

export interface ResolvedName {
  query: string
  options: PoiHit[]
  error: string
}

let loading: Promise<AMapNamespace> | null = null
let chain: Promise<unknown> = Promise.resolve()

export function hasAmapKey(): boolean {
  return Boolean(readEnv('VITE_AMAP_KEY'))
}

export function loadAmap(): Promise<AMapNamespace> {
  const key = readEnv('VITE_AMAP_KEY')
  if (!key) return Promise.reject(new Error('NO_KEY'))
  if (!loading) {
    const security = readEnv('VITE_AMAP_SECURITY_JS_CODE')
    if (security) window._AMapSecurityConfig = { securityJsCode: security }
    loading = loadWithGuard(key).catch((error: unknown) => {
      loading = null
      throw error
    })
  }
  return loading
}

function resetAmapLoader() {
  const moduleRef = amapLoaderModule as { reset?: () => void; default?: { reset?: () => void } }
  const reset = moduleRef.reset ?? moduleRef.default?.reset
  reset?.()
}

function loadWithGuard(key: string): Promise<AMapNamespace> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: unknown, value?: AMapNamespace) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      console.log = originalLog
      if (error) {
        resetAmapLoader()
        reject(error)
        return
      }
      resolve(value as AMapNamespace)
    }
    const timer = window.setTimeout(() => finish(new Error('INVALID_USER_KEY')), 12000)
    const originalLog = console.log.bind(console)
    console.log = (...args: unknown[]) => {
      originalLog(...args)
      const text = args.map((item) => String(item)).join(' ')
      if (/Error key|INVALID_USER_KEY|INVALID_USER_SCODE|INVALID_USER_DOMAIN|USERKEY_PLAT_NOMATCH/i.test(text)) {
        finish(new Error(text))
      }
    }
    loadAmapScript({ key, version: '2.0', plugins: PLUGINS }).then(
      (value) => finish(undefined, value as AMapNamespace),
      (error: unknown) => finish(error),
    )
  })
}

export async function searchPois(keyword: string, city: string): Promise<PoiHit[]> {
  const query = keyword.trim()
  if (!query) return []
  return enqueue(async () => {
    const AMap = await loadAmap()
    const searcher = new AMap.PlaceSearch({ pageSize: 8, pageIndex: 1, extensions: 'all' })
    const scoped = city.trim()
    const primary = await runSearch(searcher, query, scoped, Boolean(scoped))
    if (primary.length || !scoped) return primary
    return runSearch(searcher, query, scoped, false)
  })
}

export async function resolveNames(
  names: string[],
  city: string,
  onProgress?: (done: number, total: number, current: string) => void,
): Promise<ResolvedName[]> {
  const results: ResolvedName[] = []
  for (let index = 0; index < names.length; index += 1) {
    const name = names[index]
    onProgress?.(index, names.length, name)
    try {
      const options = (await searchPois(name, city)).slice(0, 5)
      results.push({
        query: name,
        options,
        error: options.length ? '' : '没有匹配的地点',
      })
    } catch (error) {
      if (isConfigError(error)) throw error
      results.push({ query: name, options: [], error: explainAmapError(error) })
    }
    if (index < names.length - 1) await wait(60)
  }
  onProgress?.(names.length, names.length, '')
  return results
}

export async function planRoute(points: number[][], mode: TravelMode): Promise<PlannedRoute> {
  if (points.length < 2) {
    return { path: [], distance: 0, duration: 0, routedLegs: 0, totalLegs: 0 }
  }
  return enqueue(async () => {
    const AMap = await loadAmap()
    const chunks = chunkOverlap(points, mode === 'driving' ? DRIVING_MAX_POINTS : 2)
    const service = mode === 'driving' ? new AMap.Driving({ policy: 0 }) : new AMap.Walking()
    const path: number[][] = []
    let distance = 0
    let duration = 0
    let routedLegs = 0
    for (const chunk of chunks) {
      try {
        const extracted = extractRoute(await searchLeg(service, chunk, mode))
        if (extracted.path.length >= 2) {
          appendPath(path, extracted.path)
          distance += extracted.distance
          duration += extracted.duration
          routedLegs += 1
          continue
        }
      } catch {
        // Fall through to a straight segment so the day still has a visible line.
      }
      appendPath(path, chunk)
      for (let index = 1; index < chunk.length; index += 1) {
        distance += distanceMeters(
          { lng: chunk[index - 1][0], lat: chunk[index - 1][1] },
          { lng: chunk[index][0], lat: chunk[index][1] },
        )
      }
    }
    return { path, distance, duration, routedLegs, totalLegs: chunks.length }
  })
}

export function explainAmapError(error: unknown): string {
  const raw = errorText(error)
  if (raw === 'NO_KEY' || /NO_KEY/.test(raw)) {
    return '还没有配置高德 Key。在项目根目录复制 .env.example 为 .env，填入 VITE_AMAP_KEY 后重新运行 npm run dev。'
  }
  if (/INVALID_USER_SCODE|securityJsCode|SECURITY_JS_CODE/i.test(raw)) {
    return '安全密钥没有通过校验。请把控制台中的安全密钥填到 VITE_AMAP_SECURITY_JS_CODE，然后重启 npm run dev。'
  }
  if (/INVALID_USER_KEY|Error key/i.test(raw)) {
    return 'Key 无效。请确认它是「Web端(JS API)」Key，并且已经写在 VITE_AMAP_KEY。'
  }
  if (/INVALID_USER_DOMAIN|USERKEY_PLAT_NOMATCH/i.test(raw)) {
    return '当前网址不在 Key 白名单。本地开发请在高德控制台加入 localhost 和 127.0.0.1。'
  }
  return raw || '高德服务暂时没有响应，请稍后再试。'
}

export function isConfigError(error: unknown): boolean {
  const raw = errorText(error)
  return (
    raw === 'NO_KEY' ||
    /INVALID_USER_KEY|INVALID_USER_SCODE|INVALID_USER_DOMAIN|USERKEY_PLAT_NOMATCH|SECURITY_JS_CODE/i.test(raw)
  )
}

function runSearch(searcher: PlaceSearcher, keyword: string, city: string, limit: boolean): Promise<PoiHit[]> {
  searcher.setCity(city || '全国')
  searcher.setCityLimit?.(limit)
  return new Promise((resolve, reject) => {
    searcher.search(keyword, (status, result) => {
      if (status === 'complete') {
        resolve(parsePoiList(result))
        return
      }
      if (status === 'no_data') {
        resolve([])
        return
      }
      reject(new Error(errorText(result) || status || 'SEARCH_FAILED'))
    })
  })
}

function searchLeg(service: RouteSearcher, points: number[][], mode: TravelMode): Promise<unknown> {
  const start = points[0]
  const end = points[points.length - 1]
  const waypoints = points.slice(1, -1)
  return new Promise((resolve, reject) => {
    const callback = (status: unknown, result: unknown) => {
      if (status === 'complete') {
        resolve(result)
        return
      }
      if (status === 'no_data') {
        resolve({ routes: [] })
        return
      }
      reject(new Error(errorText(result) || String(status || 'ROUTE_FAILED')))
    }
    if (mode === 'driving' && waypoints.length) service.search(start, end, { waypoints }, callback)
    else service.search(start, end, callback)
  })
}

function appendPath(target: number[][], incoming: number[][]) {
  incoming.forEach((point) => {
    const previous = target[target.length - 1]
    if (previous && Math.abs(previous[0] - point[0]) < 1e-6 && Math.abs(previous[1] - point[1]) < 1e-6) return
    target.push(point)
  })
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function readEnv(name: 'VITE_AMAP_KEY' | 'VITE_AMAP_SECURITY_JS_CODE'): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message || error.name
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; info?: unknown }
    if (typeof record.info === 'string' && record.info) return record.info
    if (typeof record.message === 'string' && record.message) return record.message
  }
  return ''
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
