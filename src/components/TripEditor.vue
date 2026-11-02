<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import ImportDialog from './ImportDialog.vue'
import MapPane from './MapPane.vue'
import PlaceSearch from './PlaceSearch.vue'
import StopList from './StopList.vue'
import { useToast } from '../composables/useToast'
import {
  addDay,
  addPlace,
  appendDays,
  closeTrip,
  deleteTrip,
  movePlace,
  movePlaceToDay,
  removeDay,
  removePlace,
  touchTrip,
  useTrips,
} from '../composables/useTrips'
import { dayNavigationHint, dayNavigationUrl, legNavigationUrl } from '../lib/navigation'
import type { Place, PoiHit, RouteSummary } from '../types'

const props = defineProps<{
  tripId: string
}>()

const { trips } = useTrips()
const { show } = useToast()
const trip = computed(() => trips.value.find((item) => item.id === props.tripId) ?? null)
const activeDayId = ref<string | null>(null)
const activePlaceId = ref<string | null>(null)
const panel = ref<'list' | 'map'>('list')
const importing = ref(false)
const summary = ref<RouteSummary | null>(null)
const planning = ref(false)
const mapRef = ref<{ resize: () => void; focusPlace: (id: string) => void } | null>(null)

const day = computed(() => trip.value?.days.find((item) => item.id === activeDayId.value) ?? trip.value?.days[0] ?? null)
const hint = computed(() => (day.value ? dayNavigationHint(day.value.places.length, day.value.mode) : ''))

watch(
  trip,
  (value) => {
    if (!value) return
    if (!value.days.some((item) => item.id === activeDayId.value)) {
      activeDayId.value = value.days[0]?.id ?? null
    }
  },
  { immediate: true },
)

watch(
  () => day.value?.id,
  () => {
    summary.value = null
    activePlaceId.value = null
  },
)

function rename(value: string) {
  if (!trip.value) return
  trip.value.name = value
  touchTrip(trip.value.id)
}

function setCity(value: string) {
  if (!trip.value) return
  trip.value.city = value
  touchTrip(trip.value.id)
}

function renameDay(value: string) {
  if (!day.value || !trip.value) return
  day.value.title = value
  touchTrip(trip.value.id)
}

function setMode(mode: 'driving' | 'walking') {
  if (!day.value || !trip.value || day.value.mode === mode) return
  day.value.mode = mode
  touchTrip(trip.value.id)
}

function selectDay(id: string) {
  activeDayId.value = id
  panel.value = 'list'
  document.getElementById(`day-tab-${id}`)?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
}

function createDay() {
  const id = addDay(props.tripId)
  if (id) {
    activeDayId.value = id
    show('已加上新的一天')
  }
}

function destroyDay() {
  if (!day.value || !trip.value) return
  if (trip.value.days.length <= 1) {
    show('至少留一天。可以把地点删光。')
    return
  }
  if (!window.confirm(`删除「${day.value.title}」？这一天的地点会一起去掉。`)) return
  removeDay(trip.value.id, day.value.id)
  show('已删除这一天')
}

function destroyTrip() {
  if (!trip.value) return
  if (!window.confirm(`删除行程「${trip.value.name}」？`)) return
  deleteTrip(trip.value.id)
  show('已删除行程')
}

function onSelectPlace(hit: PoiHit) {
  if (!day.value) return
  addPlace(props.tripId, day.value.id, hit)
  const added = day.value.places[day.value.places.length - 1]
  activePlaceId.value = added?.id ?? null
  show(`已加入「${hit.name}」`)
  if (added) {
    void nextTick(() => {
      document.getElementById(`stop-${added.id}`)?.scrollIntoView({ block: 'nearest' })
    })
  }
}

function selectPlace(id: string) {
  activePlaceId.value = id
}

async function locate(id: string) {
  activePlaceId.value = id
  panel.value = 'map'
  await nextTick()
  mapRef.value?.resize()
  mapRef.value?.focusPlace(id)
}

async function showMap() {
  panel.value = 'map'
  await nextTick()
  mapRef.value?.resize()
}

function move(id: string, direction: -1 | 1) {
  if (!day.value) return
  movePlace(props.tripId, day.value.id, id, direction)
}

function moveTo(id: string, toDayId: string) {
  if (!day.value || !trip.value) return
  const target = trip.value.days.find((item) => item.id === toDayId)
  movePlaceToDay(props.tripId, day.value.id, id, toDayId)
  show(target ? `已移到「${target.title}」` : '已移到另一天')
}

function removeStop(id: string) {
  if (!day.value) return
  const removed = removePlace(props.tripId, day.value.id, id)
  if (removed) show(`已移除「${removed.name}」`)
  if (activePlaceId.value === id) activePlaceId.value = null
}

function openUrl(url: string | null) {
  if (!url) return
  window.open(url, '_blank', 'noopener')
}

function navigateDay() {
  if (!day.value?.places.length) return
  openUrl(dayNavigationUrl(day.value.places, day.value.mode))
}

function navigateStop(id: string) {
  if (!day.value) return
  const index = day.value.places.findIndex((place) => place.id === id)
  openUrl(legNavigationUrl(day.value.places, index, day.value.mode))
}

function onImport(payload: { city: string; days: { title: string; places: Place[] }[] }) {
  if (!trip.value) return
  if (payload.city && !trip.value.city) trip.value.city = payload.city
  const firstNewIndex = trip.value.days.length
  appendDays(props.tripId, payload.days)
  importing.value = false
  activeDayId.value = trip.value.days[firstNewIndex]?.id ?? activeDayId.value
  show(`已导入 ${payload.days.length} 天`)
}
</script>

<template>
  <section v-if="trip && day" class="editor" :class="panel === 'map' ? 'panel-map' : 'panel-list'">
    <header class="editor-head">
      <div class="head-row">
        <button type="button" class="btn ghost" @click="closeTrip">返回</button>
        <input
          class="title-input"
          :value="trip.name"
          maxlength="40"
          aria-label="行程名称"
          @input="rename(($event.target as HTMLInputElement).value)"
        />
        <button type="button" class="btn ghost danger" @click="destroyTrip">删除</button>
      </div>
      <label class="city-field">
        <span>城市</span>
        <input
          :value="trip.city"
          maxlength="20"
          placeholder="如杭州，搜索时优先该城市"
          @input="setCity(($event.target as HTMLInputElement).value)"
        />
      </label>
      <div class="day-tabs" role="tablist" aria-label="行程天数">
        <button
          v-for="item in trip.days"
          :id="`day-tab-${item.id}`"
          :key="item.id"
          type="button"
          role="tab"
          class="day-tab"
          :class="{ 'is-active': item.id === day.id }"
          :aria-selected="item.id === day.id"
          @click="selectDay(item.id)"
        >
          {{ item.title || '未命名' }}
          <small>{{ item.places.length }}</small>
        </button>
        <button type="button" class="day-tab add" @click="createDay">加一天</button>
      </div>
    </header>

    <div class="editor-body">
      <div class="list-pane">
        <div class="day-tools">
          <input
            class="day-title"
            :value="day.title"
            maxlength="20"
            aria-label="这一天的名称"
            @input="renameDay(($event.target as HTMLInputElement).value)"
          />
          <div class="segmented" role="group" aria-label="出行方式">
            <button type="button" :class="{ 'is-active': day.mode === 'driving' }" @click="setMode('driving')">驾车</button>
            <button type="button" :class="{ 'is-active': day.mode === 'walking' }" @click="setMode('walking')">步行</button>
          </div>
          <button type="button" class="btn ghost" @click="importing = true">导入名单</button>
          <button type="button" class="btn ghost danger" @click="destroyDay">删除这天</button>
        </div>
        <p class="route-line">
          <template v-if="planning">正在规划路线…</template>
          <template v-else-if="summary">{{ summary.text }}</template>
          <template v-else-if="day.places.length === 1">再加一个地点后显示路线</template>
          <template v-else-if="!day.places.length">搜索地点，或导入一份名单</template>
          <template v-else>打开地图查看这一天的路线</template>
        </p>

        <PlaceSearch :city="trip.city" @select="onSelectPlace" />
        <StopList
          :places="day.places"
          :days="trip.days"
          :day-id="day.id"
          :active-id="activePlaceId"
          @select="selectPlace"
          @locate="locate"
          @up="move($event, -1)"
          @down="move($event, 1)"
          @remove="removeStop"
          @move="moveTo"
          @navigate="navigateStop"
        />

        <div class="day-footer">
          <p v-if="hint" class="form-hint">{{ hint }}</p>
          <button type="button" class="btn primary block" :disabled="!day.places.length" @click="navigateDay">
            {{ day.places.length > 1 ? '用高德导航本日' : '用高德导航到这里' }}
          </button>
        </div>
      </div>

      <div class="map-pane">
        <MapPane
          ref="mapRef"
          :places="day.places"
          :mode="day.mode"
          :active-id="activePlaceId"
          @summary="summary = $event"
          @planning="planning = $event"
          @select="selectPlace"
        />
      </div>
    </div>

    <nav class="mobile-tabs" aria-label="行程和地图">
      <button type="button" :class="{ 'is-active': panel === 'list' }" @click="panel = 'list'">
        行程
        <small>{{ day.places.length }}</small>
      </button>
      <button type="button" :class="{ 'is-active': panel === 'map' }" @click="showMap">地图</button>
    </nav>

    <ImportDialog
      v-if="importing"
      mode="append"
      :initial-city="trip.city"
      @close="importing = false"
      @confirm="onImport"
    />
  </section>
</template>
