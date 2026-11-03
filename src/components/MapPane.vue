<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { explainAmapError, hasAmapKey, loadAmap, planRoute, type AMapNamespace, type PlannedRoute } from '../lib/amap'
import { formatDistance, formatDuration } from '../lib/format'
import type { Place, RouteSummary, TravelMode } from '../types'

const props = defineProps<{
  places: Place[]
  mode: TravelMode
  activeId: string | null
}>()

const emit = defineEmits<{
  summary: [summary: RouteSummary | null]
  planning: [value: boolean]
  select: [id: string]
}>()

const container = ref<HTMLElement | null>(null)
const status = ref<'loading' | 'ready' | 'error' | 'no-key'>('loading')
const errorText = ref('')
const planning = ref(false)
const placeKey = computed(() => props.places.map((place) => `${place.id}:${place.lng}:${place.lat}`).join('|'))

type MapInstance = {
  add: (overlay: unknown) => void
  remove: (overlay: unknown) => void
  destroy: () => void
  resize: () => void
  setFitView: (overlays?: unknown, immediately?: boolean, avoid?: number[]) => void
  setZoomAndCenter: (zoom: number, center: number[]) => void
  addControl: (control: unknown) => void
}

let map: MapInstance | null = null
let amap: AMapNamespace | null = null
let markers: { on: (event: string, handler: () => void) => void }[] = []
let polyline: { on: (event: string, handler: () => void) => void } | null = null
let latestPlan: PlannedRoute | null = null
let pendingFocus: string | null = null
let requestId = 0
let routeTimer = 0
let resizeObserver: ResizeObserver | null = null
let boxObserver: ResizeObserver | null = null
let alive = true

onMounted(() => {
  void bootMap()
})

onBeforeUnmount(() => {
  alive = false
  window.clearTimeout(routeTimer)
  requestId += 1
  resizeObserver?.disconnect()
  boxObserver?.disconnect()
  map?.destroy()
  map = null
})

watch([placeKey, () => props.mode], () => scheduleRoute(), { immediate: true })
watch(() => props.activeId, () => drawMarkers())

async function bootMap() {
  if (!hasAmapKey()) {
    status.value = 'no-key'
    errorText.value = explainAmapError(new Error('NO_KEY'))
    return
  }
  try {
    amap = await loadAmap()
    if (!alive || !container.value) return
    await waitForBox(container.value)
    if (!alive || !container.value || !amap) return
    const first = props.places[0]
    map = new amap.Map(container.value, {
      zoom: first ? 13 : 4.4,
      center: first ? [first.lng, first.lat] : [104.2, 35.6],
      viewMode: '2D',
      resizeEnable: true,
    })
    try {
      map.addControl(new amap.Scale())
    } catch {
      // The scale control is optional.
    }
    try {
      map.addControl(new amap.ToolBar({ position: 'RB' }))
    } catch {
      // The toolbar is optional.
    }
    resizeObserver = new ResizeObserver(() => map?.resize())
    resizeObserver.observe(container.value)
    status.value = 'ready'
    drawMarkers()
    renderPolyline()
    if (pendingFocus) focusPlace(pendingFocus)
    else fit()
  } catch (error) {
    if (!alive) return
    status.value = 'error'
    errorText.value = explainAmapError(error)
  }
}

function scheduleRoute() {
  window.clearTimeout(routeTimer)
  if (props.places.length < 2) {
    void drawRoute()
    return
  }
  planning.value = true
  emit('planning', true)
  routeTimer = window.setTimeout(() => {
    void drawRoute()
  }, 180)
}

async function drawRoute() {
  const current = ++requestId
  try {
    if (!hasAmapKey()) {
      latestPlan = null
      emit(
        'summary',
        props.places.length >= 2
          ? {
              distance: 0,
              duration: 0,
              routedLegs: 0,
              totalLegs: 0,
              text: '配置高德 Key 后可以搜索地点并画出路线。',
            }
          : null,
      )
      renderPolyline()
      return
    }
    if (props.places.length < 2) {
      latestPlan = null
      emit('summary', null)
      renderPolyline()
      fit()
      return
    }
    const plan = await planRoute(
      props.places.map((place) => [place.lng, place.lat]),
      props.mode,
    )
    if (!alive || current !== requestId) return
    latestPlan = plan
    emit('summary', summarize(plan))
    renderPolyline()
    fit()
  } catch (error) {
    if (!alive || current !== requestId) return
    latestPlan = null
    renderPolyline()
    emit('summary', {
      distance: 0,
      duration: 0,
      routedLegs: 0,
      totalLegs: 1,
      text: explainAmapError(error),
    })
  } finally {
    if (current === requestId) {
      planning.value = false
      emit('planning', false)
    }
  }
}

function drawMarkers() {
  if (!map || !amap) return
  if (markers.length) map.remove(markers)
  markers = props.places.map((place, index) => {
    const marker = new amap!.Marker({
      position: [place.lng, place.lat],
      anchor: 'center',
      title: place.name,
      zIndex: place.id === props.activeId ? 130 : 100,
      content: pinHtml(index + 1, place.name, place.id === props.activeId),
    })
    marker.on('click', () => emit('select', place.id))
    return marker
  })
  if (markers.length) map.add(markers)
}

function renderPolyline() {
  if (!map || !amap) return
  if (polyline) {
    map.remove(polyline)
    polyline = null
  }
  const plan = latestPlan
  if (!plan || plan.path.length < 2) return
  const failed = plan.routedLegs === 0
  const options: Record<string, unknown> = {
    path: plan.path,
    strokeColor: failed ? '#8d7b68' : props.mode === 'walking' ? '#1c6b54' : '#d24b24',
    strokeWeight: failed ? 4 : 6,
    strokeOpacity: 0.92,
    strokeStyle: failed ? 'dashed' : 'solid',
    lineJoin: 'round',
    lineCap: 'round',
    showDir: !failed,
    zIndex: 60,
  }
  if (failed) options.strokeDasharray = [8, 8]
  polyline = new amap.Polyline(options)
  map.add(polyline)
}

function fit() {
  if (!map) return
  if (props.places.length === 1) {
    map.setZoomAndCenter(15, [props.places[0].lng, props.places[0].lat])
    return
  }
  const overlays = [...markers, ...(polyline ? [polyline] : [])]
  if (overlays.length) map.setFitView(overlays, true, [72, 88, 48, 48])
}

function summarize(plan: PlannedRoute): RouteSummary {
  const distance = formatDistance(plan.distance)
  const duration = formatDuration(plan.duration)
  const headline = [distance, duration].filter(Boolean).join(' · ')
  let text = headline || '已标出当天地点'
  if (plan.routedLegs === 0) text = distance ? `路网规划失败，直线约 ${distance}` : '路网规划失败，先显示直线'
  else if (plan.routedLegs < plan.totalLegs) text = headline ? `${headline}（部分路段是直线）` : '部分路段是直线'
  return { ...plan, text }
}

function resize() {
  map?.resize()
}

function focusPlace(id: string) {
  pendingFocus = id
  const place = props.places.find((item) => item.id === id)
  if (!map || !place) return
  map.setZoomAndCenter(15, [place.lng, place.lat])
  pendingFocus = null
}

function pinHtml(index: number, name: string, active: boolean): string {
  return `<div class="pin${active ? ' is-active' : ''}"><em>${escapeHtml(name)}</em><span>${index}</span></div>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
    return entities[char] ?? char
  })
}

function waitForBox(element: HTMLElement): Promise<void> {
  if (element.clientWidth > 0 && element.clientHeight > 0) return Promise.resolve()
  return new Promise((resolve) => {
    boxObserver = new ResizeObserver(() => {
      if (!alive || (element.clientWidth > 0 && element.clientHeight > 0)) {
        boxObserver?.disconnect()
        boxObserver = null
        resolve()
      }
    })
    boxObserver.observe(element)
  })
}

defineExpose({ resize, focusPlace })
</script>

<template>
  <div class="map-shell">
    <div ref="container" class="map-canvas"></div>
    <div v-if="status === 'loading'" class="map-mask">正在加载高德地图…</div>
    <div v-else-if="status !== 'ready'" class="map-mask">
      <strong>地图还不可用</strong>
      <p>{{ errorText }}</p>
    </div>
    <div v-else-if="!places.length" class="map-note">
      <strong>地图会跟着这一天走</strong>
      <p>加上地点后，这里会标出顺序并画出路线。</p>
    </div>
    <p v-else-if="planning" class="map-chip">正在规划路线…</p>
  </div>
</template>
